/**
 * 冒烟测试用的视听素材：在页面里用 MediaRecorder 录一段带画面、带声音的 WebM
 * （MediaRecorder 录出来的没有时长，这里补上，拖进度条、显示总长才正常），和两份字幕。
 */

/** 在页面里录 seconds 秒：画面是大号的秒数，每秒响一声；返回 base64 */
export const recordScript = (seconds) => `
  const canvas = document.createElement('canvas')
  canvas.width = 640
  canvas.height = 360
  const g = canvas.getContext('2d')
  const ac = new AudioContext()
  const dest = ac.createMediaStreamDestination()
  const osc = ac.createOscillator()
  const gain = ac.createGain()
  osc.frequency.value = 440
  gain.gain.value = 0
  osc.connect(gain).connect(dest)
  osc.start()
  const stream = new MediaStream([...canvas.captureStream(25).getVideoTracks(), ...dest.stream.getAudioTracks()])
  const rec = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp8,opus' })
  const chunks = []
  rec.ondataavailable = (e) => e.data.size && chunks.push(e.data)
  const t0 = performance.now()
  let last = -1
  const draw = () => {
    const s = (performance.now() - t0) / 1000
    g.fillStyle = 'hsl(' + ((s * 40) % 360) + ' 55% 35%)'
    g.fillRect(0, 0, 640, 360)
    g.fillStyle = '#fff'
    g.font = 'bold 120px sans-serif'
    g.textAlign = 'center'
    g.fillText(s.toFixed(1), 320, 220)
    const whole = Math.floor(s)
    if (whole !== last) {
      last = whole
      gain.gain.setValueAtTime(0.2, ac.currentTime)
      gain.gain.setValueAtTime(0, ac.currentTime + 0.25)
    }
    if (rec.state === 'recording') requestAnimationFrame(draw)
  }
  rec.start(250)
  draw()
  // 窗口在后台时 requestAnimationFrame 不走，画面靠定时器补
  const timer = setInterval(draw, 100)
  await new Promise((r) => setTimeout(r, ${seconds * 1000}))
  await new Promise((r) => {
    rec.onstop = r
    rec.stop()
  })
  clearInterval(timer)
  osc.stop()
  ac.close()
  const buf = new Uint8Array(await new Blob(chunks, { type: 'video/webm' }).arrayBuffer())
  let bin = ''
  for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000))
  return btoa(bin)`

// ── EBML：给 Segment 的 Info 补上 Duration ──

function readVint(b, pos) {
  const first = b[pos]
  let len = 1
  while (len <= 8 && !(first & (0x80 >> (len - 1)))) len++
  let value = first & (0xff >> len)
  for (let i = 1; i < len; i++) value = value * 256 + b[pos + i]
  return { len, value, unknown: value === 2 ** (7 * len) - 1 }
}

function readId(b, pos) {
  const first = b[pos]
  let len = 1
  while (len <= 4 && !(first & (0x80 >> (len - 1)))) len++
  let id = 0
  for (let i = 0; i < len; i++) id = id * 256 + b[pos + i]
  return { id, len }
}

/** 8 字节写法的长度 */
function vint8(n) {
  const out = Buffer.alloc(8)
  out[0] = 0x01
  let v = n
  for (let i = 7; i >= 1; i--) {
    out[i] = v % 256
    v = Math.floor(v / 256)
  }
  return out
}

/** Info 里去掉旧的 Duration、加一个（毫秒；MediaRecorder 的 TimecodeScale 是 1 毫秒） */
export function fixWebmDuration(buf, ms) {
  const b = Buffer.from(buf)
  let { id, len } = readId(b, 0)
  if (id !== 0x1a45dfa3) throw new Error('不是 EBML')
  let sz = readVint(b, len)
  const pos = len + sz.len + sz.value
  ;({ id, len } = readId(b, pos))
  if (id !== 0x18538067) throw new Error('没有 Segment')
  sz = readVint(b, pos + len)
  let p = pos + len + sz.len
  while (p < b.length) {
    const e = readId(b, p)
    const s = readVint(b, p + e.len)
    const bodyStart = p + e.len + s.len
    if (e.id === 0x1549a966) {
      const body = b.subarray(bodyStart, bodyStart + s.value)
      const kept = []
      let q = 0
      while (q < body.length) {
        const ce = readId(body, q)
        const cs = readVint(body, q + ce.len)
        const end = q + ce.len + cs.len + cs.value
        if (ce.id !== 0x4489) kept.push(body.subarray(q, end))
        q = end
      }
      const dur = Buffer.alloc(8)
      dur.writeDoubleBE(ms)
      const newBody = Buffer.concat([...kept, Buffer.from([0x44, 0x89, 0x88]), dur])
      return Buffer.concat([
        b.subarray(0, p),
        b.subarray(p, p + e.len),
        vint8(newBody.length),
        newBody,
        b.subarray(bodyStart + s.value)
      ])
    }
    if (s.unknown) break
    p = bodyStart + s.value
  }
  throw new Error('没找到 Info')
}

export const JA_SRT = `1
00:00:01,000 --> 00:00:03,000
今日はいい天気ですね。

2
00:00:03,500 --> 00:00:05,500
駅まで歩いて行きましょう。

3
00:00:06,000 --> 00:00:08,000
この本はとても面白いです。

4
00:00:08,500 --> 00:00:11,000
明日また会いましょう。
`

export const ZH_SRT = `1
00:00:01,000 --> 00:00:03,000
今天天气真好啊。

2
00:00:03,500 --> 00:00:05,500
我们走着去车站吧。

3
00:00:06,000 --> 00:00:08,000
这本书非常有意思。

4
00:00:08,500 --> 00:00:11,000
明天再见吧。
`
