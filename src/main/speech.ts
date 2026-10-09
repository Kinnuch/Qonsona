/**
 * 朗读：调 Windows 自带的 SAPI 语音（System.Speech），离线可用。
 *
 * 两种读法：
 * - 按文字读（日语这类有系统语音的语言）；
 * - 按 IPA 读（人造语言）：PromptBuilder.AppendTextWithPronunciation 接受 IPA，
 *   任何一个 SAPI 声音都能读，只是外语的音会被近似成这个声音会发的音。
 *
 * 常驻一个 PowerShell 进程，一行 JSON 进、一行 JSON 出（每次都起 PowerShell 要一秒左右）。
 * 合成结果按「声音 + 语速 + 内容」缓存成 WAV，同一个词第二次读不再合成。
 */
import { spawn, type ChildProcessWithoutNullStreams } from 'child_process'
import { createHash } from 'crypto'
import { existsSync, promises as fs } from 'fs'
import { join } from 'path'

export interface Voice {
  name: string
  culture: string
  gender: string
}

export interface SpeakRequest {
  /** 按文字读时是文字，按 IPA 读时是 IPA */
  content: string
  ipa: boolean
  /** 声音名；空着或找不到时用系统默认声音 */
  voice: string
  /** -10 … 10 */
  rate: number
}

export interface SpeakResult {
  wav: Buffer | null
  /** 系统语音读不出、朗读时略去的符号 */
  dropped: string[]
  error?: string
}

const HELPER = String.raw`
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Speech
$s = New-Object System.Speech.Synthesis.SpeechSynthesizer
$in = New-Object IO.StreamReader([Console]::OpenStandardInput(), (New-Object Text.UTF8Encoding $false))
$out = New-Object IO.StreamWriter([Console]::OpenStandardOutput(), (New-Object Text.UTF8Encoding $false))
while ($null -ne ($line = $in.ReadLine())) {
  $req = $line | ConvertFrom-Json
  try {
    if ($req.op -eq 'voices') {
      $list = @($s.GetInstalledVoices() | Where-Object { $_.Enabled } | ForEach-Object {
        @{ name = $_.VoiceInfo.Name; culture = $_.VoiceInfo.Culture.Name; gender = [string]$_.VoiceInfo.Gender } })
      $res = @{ id = $req.id; ok = $true; voices = $list }
    } else {
      $info = $null
      foreach ($v in $s.GetInstalledVoices()) { if ($v.VoiceInfo.Name -eq $req.voice) { $info = $v.VoiceInfo } }
      if ($null -eq $info) { $info = $s.Voice }
      $s.Rate = [int]$req.rate
      $pb = New-Object System.Speech.Synthesis.PromptBuilder($info.Culture)
      $pb.StartVoice($info)
      $first = $true
      foreach ($w in $req.words) {
        if (-not $first) { $pb.AppendBreak([System.Speech.Synthesis.PromptBreak]::ExtraSmall) }
        $first = $false
        if ($req.ipa) { $pb.AppendTextWithPronunciation('x', $w) } else { $pb.AppendText($w) }
      }
      $pb.EndVoice()
      $s.SetOutputToWaveFile($req.out)
      try { $s.Speak($pb) } finally { $s.SetOutputToNull() }
      $res = @{ id = $req.id; ok = $true }
    }
  } catch {
    $e = $_.Exception
    while ($null -ne $e.InnerException) { $e = $e.InnerException }
    $res = @{ id = $req.id; ok = $false; error = $e.Message }
  }
  $out.WriteLine(($res | ConvertTo-Json -Compress -Depth 4))
  $out.Flush()
}
`

/** 系统语音肯定读不出、先拿掉并告诉用户的符号：声调字母与调号数字、升降调箭头 */
const NEVER = /[˥˦˧˨˩꜒꜓꜔꜕꜖0-9↗↘]/gu

/**
 * 标点不是音。原文里的撇号、引号、逗号……会原样带进按拼写转出来的 IPA，系统语音不认：
 * 以前一律报「读不出」，撇号、引号还会让整句读不出来。现在读之前先处理掉，不算读不出——
 * 撇号、连字符在词里直接去掉（kin'en → kinen），两个字母之间的冒号当长音（ka:so → kaːso），
 * 别的标点当作词界（停顿一下）。IPA 自己的 ˈ ˌ ː . ‿ ʼ 不动。
 */
const JOINERS = /['‘’‛′`´ʹ-]/g
const BREAKS = /[:,;!?¡¿、。，；：！？…—–«»‹›「」『』“”"()（）[\]{}/\\_|‖·•]/g

/** 按 IPA 读之前整理一遍：标点处理掉，肯定读不出的符号拿掉并记下 */
export function prepareIpa(ipa: string): { text: string; dropped: string[] } {
  let text = ipa.normalize('NFC')
  const dropped = [...new Set(text.match(NEVER) ?? [])]
  text = text
    .replace(NEVER, '')
    .replace(JOINERS, '')
    .replace(/(\p{L}):(?=\p{L})/gu, '$1ː')
    .replace(BREAKS, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return { text, dropped }
}

/** 系统语音报错里成对的引号（中文系统是「音素“X”无效。」，英文系统用单引号） */
const QUOTE_PAIRS: [string, string][] = [
  ['“', '”'],
  ['「', '」'],
  ['『', '』'],
  ['‘', '’'],
  ['«', '»'],
  ["'", "'"],
  ['"', '"']
]

/**
 * 从「音素“'”无效。」这类报错里找出读不出的那个符号：按成对的引号找，符号本身是引号也认得出
 * （以前的写法把引号都当分隔符，读不出的正好是撇号时找不到，整句就读不出来）。
 * 找到的必须真在要读的内容里；引号里最多三个字符（带附加符号的音、t͡s 这类）；找不到返回 null。
 */
export function invalidPhoneme(error: string, content: string): string | null {
  for (const [open, close] of QUOTE_PAIRS)
    for (let a = error.indexOf(open); a >= 0; a = error.indexOf(open, a + 1))
      for (let len = 1; len <= 3; len++) {
        const inner = error.slice(a + 1, a + 1 + len)
        if (error.slice(a + 1 + len, a + 1 + len + close.length) !== close) continue
        // 好几个普通字母连在一起的是整段读音，不是某一个音
        if (content.includes(inner) && !/^[a-z]{2,}$/i.test(inner)) return inner
      }
  return null
}

interface Pending {
  resolve: (v: { ok: boolean; error?: string; voices?: Voice[] }) => void
}

export class Speech {
  #proc: ChildProcessWithoutNullStreams | null = null
  #pending = new Map<number, Pending>()
  #seq = 0
  #buf = ''

  constructor(private cacheDir: string) {}

  get available(): boolean {
    return process.platform === 'win32'
  }

  #start(): ChildProcessWithoutNullStreams {
    if (this.#proc) return this.#proc
    const encoded = Buffer.from(HELPER, 'utf16le').toString('base64')
    const proc = spawn(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-EncodedCommand', encoded],
      { windowsHide: true }
    )
    proc.stdout.setEncoding('utf8')
    proc.stdout.on('data', (chunk: string) => {
      this.#buf += chunk
      let nl: number
      while ((nl = this.#buf.indexOf('\n')) >= 0) {
        const line = this.#buf.slice(0, nl).trim()
        this.#buf = this.#buf.slice(nl + 1)
        if (!line) continue
        try {
          const msg = JSON.parse(line)
          this.#pending.get(msg.id)?.resolve(msg)
          this.#pending.delete(msg.id)
        } catch {
          // PowerShell 偶尔吐出的非 JSON 行（警告之类）不管
        }
      }
    })
    const fail = (): void => {
      for (const p of this.#pending.values())
        p.resolve({ ok: false, error: 'speech helper exited' })
      this.#pending.clear()
      this.#proc = null
    }
    proc.on('exit', fail)
    proc.on('error', fail)
    this.#proc = proc
    return proc
  }

  #call(req: Record<string, unknown>): Promise<{ ok: boolean; error?: string; voices?: Voice[] }> {
    const id = ++this.#seq
    return new Promise((resolve) => {
      this.#pending.set(id, { resolve })
      this.#start().stdin.write(JSON.stringify({ ...req, id }) + '\n', 'utf8')
    })
  }

  async voices(): Promise<Voice[]> {
    if (!this.available) return []
    const r = await this.#call({ op: 'voices' })
    return r.ok ? (r.voices ?? []) : []
  }

  async speak(req: SpeakRequest): Promise<SpeakResult> {
    if (!this.available) return { wav: null, dropped: [], error: 'unsupported platform' }
    const dropped = new Set<string>()
    let content = req.content.normalize('NFC')
    if (req.ipa) {
      const p = prepareIpa(content)
      content = p.text
      for (const d of p.dropped) dropped.add(d)
    }
    const key = createHash('sha1')
      .update(JSON.stringify([req.voice, req.rate, req.ipa, content]))
      .digest('hex')
    const file = join(this.cacheDir, key + '.wav')
    const meta = file + '.json'
    if (existsSync(file) && existsSync(meta)) {
      const prev = JSON.parse(await fs.readFile(meta, 'utf8')) as { dropped: string[] }
      return { wav: await fs.readFile(file), dropped: [...new Set([...dropped, ...prev.dropped])] }
    }
    await fs.mkdir(this.cacheDir, { recursive: true })
    // IPA 按空白分词，每个词单独给出读音，词之间停顿一下
    let words = req.ipa ? content.split(/\s+/).filter(Boolean) : [content]
    for (let tries = 0; tries < 20; tries++) {
      if (!words.length) return { wav: null, dropped: [...dropped], error: 'nothing to speak' }
      const r = await this.#call({
        op: 'speak',
        words,
        ipa: req.ipa,
        voice: req.voice,
        rate: Math.max(-10, Math.min(10, Math.round(req.rate))),
        out: file
      })
      if (r.ok) {
        await fs.writeFile(meta, JSON.stringify({ dropped: [...dropped] }))
        return { wav: await fs.readFile(file), dropped: [...dropped] }
      }
      // 「音素“X”无效」：拿掉这个符号再试（系统语音的音素表里没有它）
      const bad = req.ipa ? invalidPhoneme(r.error ?? '', words.join(' ')) : null
      if (!bad) return { wav: null, dropped: [...dropped], error: r.error }
      // 带附加符号的合成字母（ã、é）先拆成字母 + 附加符号再读：读不出的最多是附加符号，元音还在
      const parts = bad.normalize('NFD')
      if (parts !== bad) {
        words = words.map((w) => w.split(bad).join(parts))
        continue
      }
      dropped.add(bad)
      words = words.map((w) => w.split(bad).join('')).filter(Boolean)
    }
    return { wav: null, dropped: [...dropped], error: 'too many unsupported symbols' }
  }

  dispose(): void {
    this.#proc?.kill()
    this.#proc = null
  }
}
