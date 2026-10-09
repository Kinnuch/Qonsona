/**
 * 韩语的标准发音（표준 발음법）与国语罗马字（국어의 로마자 표기법，2000 年）。
 *
 * 韩文按词素写、按音变读：먹는 读 [멍는]，같이 读 [가치]，신라 读 [실라]。学的人看字读不对，
 * 所以词典与正文要给「发音变化提示」；罗马字也是按发音转写的（신라 → Silla），只是不标紧音（학교 → hakgyo）。
 *
 * 这里按音节交界逐个处理（一个语节 = 一串连写的韩文音节；语节之间不连读）：
 *   连音（연음）、收音中和（받침 7 个代表音）、双收音简化、ㅎ 的送气与脱落（격음화、ㅎ 탈락）、
 *   腭化（구개음화）、鼻音化（비음화）、ㄹ 鼻音化、流音化（유음화）、紧音化（경음화）、
 *   져/쪄/쳐 读 [저/쩌/처]、辅音后的 ㅢ 读 [ㅣ]。
 * 要看词素才能定的音变（合成词的 ㄴ 添加「솜이불 [솜니불]」、汉字词 ㄹ 后的紧音「갈등 [갈뜽]」、
 * 动词词干 ㄴ/ㅁ 后的紧音「신고 [신꼬]」）由调用方用选项说明；不知道时不做（宁可少变，不乱变）。
 */
import { CLUSTERS, compose, decompose } from './hangul'

export interface PronounceOptions {
  /** 做紧音化（默认做）；转写罗马字时不做（罗马字不标紧音） */
  tense?: boolean
  /**
   * 汉字词：ㄹ 收音后的 ㄷ、ㅅ、ㅈ 读紧音（갈등 [갈뜽]、발전 [발쩐]）。
   * 给数字时只有前这么多个音节是汉字（決定하다 → 2：결정 之间按汉字词读，하다 不算）
   */
  sino?: boolean | number
  /**
   * 动词、形容词词干在第几个音节结束（从 0 数）：词干末的 ㄴ、ㅁ、ㄼ、ㄾ 后的词尾辅音读紧音（신고 [신꼬]），
   * ㄺ 在 ㄱ 前读 ㄹ（맑고 [말꼬]）
   */
  stemEnd?: number
  /** 体词（名词）：罗马字里 ㄱ、ㄷ、ㅂ 后的 ㅎ 照写 h（묵호 Mukho）；发音照样送气 */
  noun?: boolean
}

interface Syl {
  l: string
  v: string
  t: string
}

/** 收音的代表音（7 个）：ㄲ、ㅋ → ㄱ；ㅅ、ㅆ、ㅈ、ㅊ、ㅌ、ㅎ → ㄷ；ㅍ → ㅂ */
const NEUTRAL: Record<string, string> = {
  ㄱ: 'ㄱ',
  ㄲ: 'ㄱ',
  ㅋ: 'ㄱ',
  ㄴ: 'ㄴ',
  ㄷ: 'ㄷ',
  ㅅ: 'ㄷ',
  ㅆ: 'ㄷ',
  ㅈ: 'ㄷ',
  ㅊ: 'ㄷ',
  ㅌ: 'ㄷ',
  ㅎ: 'ㄷ',
  ㄹ: 'ㄹ',
  ㅁ: 'ㅁ',
  ㅂ: 'ㅂ',
  ㅍ: 'ㅂ',
  ㅇ: 'ㅇ'
}
/** 双收音在辅音前、词末读哪一个（ㄺ、ㄼ 有例外，见 simplifyCluster） */
const CLUSTER_KEEP: Record<string, string> = {
  ㄳ: 'ㄱ',
  ㄵ: 'ㄴ',
  ㄶ: 'ㄴ',
  ㄺ: 'ㄱ',
  ㄻ: 'ㅁ',
  ㄼ: 'ㄹ',
  ㄽ: 'ㄹ',
  ㄾ: 'ㄹ',
  ㄿ: 'ㅂ',
  ㅀ: 'ㄹ',
  ㅄ: 'ㅂ'
}
const TENSE: Record<string, string> = { ㄱ: 'ㄲ', ㄷ: 'ㄸ', ㅂ: 'ㅃ', ㅅ: 'ㅆ', ㅈ: 'ㅉ' }
/** ㅎ 收音后的 ㄱ、ㄷ、ㅈ 变送气音 */
const ASPIRATE: Record<string, string> = { ㄱ: 'ㅋ', ㄷ: 'ㅌ', ㅈ: 'ㅊ' }
/** 收音碰上后面的 ㅎ 变成什么送气音 */
const ASPIRATE_BEFORE_H: Record<string, string> = {
  ㄱ: 'ㅋ',
  ㄲ: 'ㅋ',
  ㅋ: 'ㅋ',
  ㄷ: 'ㅌ',
  ㅅ: 'ㅌ',
  ㅆ: 'ㅌ',
  ㅌ: 'ㅌ',
  ㅈ: 'ㅊ',
  ㅊ: 'ㅊ',
  ㅂ: 'ㅍ',
  ㅍ: 'ㅍ'
}
/** 后面的 ㄱ、ㄷ、ㅂ、ㅅ、ㅈ 读紧音的收音（标准发音法第 23 项：ㄱ(ㄲ ㅋ ㄳ ㄺ)、ㄷ(ㅅ ㅆ ㅈ ㅊ ㅌ)、ㅂ(ㅍ ㄼ ㄿ ㅄ)） */
const OBSTRUENT_CODA = 'ㄱㄲㅋㄳㄺㄷㅅㅆㅈㅊㅌㅂㅍㄼㄿㅄ'
/** 词干末这些收音后的词尾辅音读紧音（第 24、25 项：ㄴ(ㄵ)、ㅁ(ㄻ)、ㄼ、ㄾ） */
const STEM_TENSE_CODA = 'ㄴㄵㅁㄻㄼㄾ'

/** 双收音在辅音前怎么读：밟- 读 ㅂ（밟다 [밥따]），ㄺ 在词干末接 ㄱ 时读 ㄹ（맑게 [말께]） */
function simplifyCluster(t: string, next: Syl, stemBoundary: boolean, syl: Syl): string {
  if (t === 'ㄼ' && syl.l === 'ㅂ' && syl.v === 'ㅏ') return 'ㅂ' // 밟다 [밥따]
  if (
    t === 'ㄼ' &&
    syl.l === 'ㄴ' &&
    syl.v === 'ㅓ' &&
    ((next.v === 'ㅜ' && (next.l === 'ㅈ' || next.l === 'ㄷ')) ||
      (next.l === 'ㅈ' && next.v === 'ㅓ'))
  )
    return 'ㅂ' // 넓죽하다 [넙쭈카다]、넓둥글다 [넙뚱글다]、넓적하다 [넙쩌카다]
  if (t === 'ㄺ' && stemBoundary && next.l === 'ㄱ') return 'ㄹ' // 맑게 [말께]、읽고 [일꼬]
  return CLUSTER_KEEP[t] ?? t
}

/**
 * 词尾常见的开头音节：没有词干信息时，ㄻ 后面是这些就当作「词干 + 词尾」（젊다 [점따]、삶고 [삼꼬]）。
 * 不收「기」：굶기다、옮기다 的 -기- 是使动后缀，不读紧音
 */
const ENDING_START = new Set([
  '다',
  '고',
  '지',
  '게',
  '자',
  '더',
  '던',
  '든',
  '죠',
  '잖',
  '겠',
  '네',
  '습'
])

/** 没有词干信息时，双收音后的辅音按「词干末」读紧音吗：ㄵ、ㄾ 只出现在词干末；ㄼ 除了「여덟」；ㄻ 看后面像不像词尾 */
function stemLikeCluster(c: string, a: Syl, nextChar: string): boolean {
  if (c === 'ㄵ' || c === 'ㄾ') return true
  if (c === 'ㄼ') return !(a.l === 'ㄷ' && a.v === 'ㅓ') // 여덟
  if (c === 'ㄻ') return ENDING_START.has(nextChar)
  return false
}

/** 一个语节（全是韩文音节）的发音：返回音节串 */
function pronounceWord(word: string, opts: PronounceOptions): string {
  const chars = [...word]
  const syls: Syl[] = chars.map((ch) => decompose(ch)!)
  const spelled = syls.map((s) => ({ ...s }))
  const tense = opts.tense !== false
  const n = syls.length
  const sinoUpTo = opts.sino === true ? n : typeof opts.sino === 'number' ? opts.sino : 0
  // 名词 + 없다（맛없다、끝없이）：前面的收音先变成代表音再连过去（第 15 项：[마덥따]、[끄덥씨]）
  for (let i = 0; i < n - 1; i++)
    if (chars[i + 1] === '없' && syls[i].t && syls[i].t !== 'ㅇ' && syls[i].t !== 'ㅎ') {
      const t = syls[i].t
      syls[i].t = CLUSTERS[t]
        ? t === 'ㄳ' || t === 'ㅄ'
          ? CLUSTERS[t][0]
          : (CLUSTER_KEEP[t] ?? t)
        : (NEUTRAL[t] ?? t)
    }
  for (let i = 0; i < n; i++) {
    const a = syls[i]
    const b = syls[i + 1]
    if (!b) {
      // 词末：双收音简化、中和
      if (a.t) a.t = CLUSTER_KEEP[a.t] ?? NEUTRAL[a.t] ?? a.t
      continue
    }
    const stemBoundary = opts.stemEnd === i
    let c = a.t
    if (!c) continue
    // ── 后面是元音（初声 ㅇ）：连音 ──
    if (b.l === 'ㅇ') {
      if (c === 'ㅇ') continue
      if (c === 'ㅎ') {
        a.t = '' // 좋아 [조아]
        continue
      }
      if (c === 'ㄶ' || c === 'ㅀ') {
        a.t = ''
        b.l = c === 'ㄶ' ? 'ㄴ' : 'ㄹ' // 많아 [마나]、싫어 [시러]
        continue
      }
      const cl = CLUSTERS[c]
      if (cl) {
        a.t = cl[0]
        b.l = cl[1] === 'ㅅ' ? 'ㅆ' : cl[1] // 읽어 [일거]、값이 [갑씨]
        if (b.l === 'ㅌ' && b.v === 'ㅣ') b.l = 'ㅊ' // 핥이다 [할치다]
        continue
      }
      // 腭化：ㄷ、ㅌ + 이 → 지、치（굳이 [구지]、같이 [가치]）
      if ((c === 'ㄷ' || c === 'ㅌ') && b.v === 'ㅣ') {
        a.t = ''
        b.l = c === 'ㄷ' ? 'ㅈ' : 'ㅊ'
        continue
      }
      a.t = ''
      b.l = c
      continue
    }
    // ── 后面是辅音 ──
    const o = b.l
    // ㅎ 收音（含 ㄶ、ㅀ）
    if (c === 'ㅎ' || c === 'ㄶ' || c === 'ㅀ') {
      const rest = c === 'ㅎ' ? '' : c === 'ㄶ' ? 'ㄴ' : 'ㄹ'
      if (ASPIRATE[o]) {
        a.t = rest
        b.l = ASPIRATE[o] // 좋고 [조코]、않다 [안타]、싫지 [실치]
        continue
      }
      if (o === 'ㅅ') {
        a.t = rest
        b.l = 'ㅆ' // 좋소 [조쏘]
        continue
      }
      if (o === 'ㄴ') {
        if (c === 'ㅀ') {
          a.t = 'ㄹ'
          b.l = 'ㄹ' // 뚫는 [뚤른]
        } else a.t = 'ㄴ' // 놓는 [논는]、않네 [안네]
        continue
      }
      a.t = rest || 'ㄷ'
      c = a.t
    }
    // 后面是 ㅎ：送气（축하 [추카]、입학 [이팍]、앉히다 [안치다]、밝히다 [발키다]）
    if (o === 'ㅎ') {
      const cl = CLUSTERS[c]
      // 双收音里跟 ㅎ 合成送气音的是后一个（ㄵ、ㄺ、ㄼ），ㄳ、ㅄ 是前一个（ㅅ 脱落）
      const meet = cl ? (cl[1] === 'ㅅ' ? cl[0] : cl[1]) : c
      const keep = cl ? (cl[1] === 'ㅅ' ? '' : cl[0]) : ''
      const asp = ASPIRATE_BEFORE_H[meet]
      if (asp) {
        a.t = keep
        b.l = asp === 'ㅌ' && b.v === 'ㅣ' ? 'ㅊ' : asp // 닫히다 [다치다]
        continue
      }
    }
    // 双收音简化、收音中和
    let t = CLUSTERS[c] ? simplifyCluster(c, b, stemBoundary, a) : (NEUTRAL[c] ?? c)
    let on = o
    // ㄹ 的鼻音化：ㅁ、ㅇ 后的 ㄹ 读 ㄴ（심리 [심니]）；ㄱ、ㅂ 后也读 ㄴ，再引起鼻音化（국립 [궁닙]）
    if (on === 'ㄹ' && t !== 'ㄹ' && t !== 'ㄴ') on = 'ㄴ'
    // 流音化：ㄴ + ㄹ、ㄹ + ㄴ → ㄹㄹ（신라 [실라]、설날 [설랄]）
    if (t === 'ㄴ' && on === 'ㄹ') t = 'ㄹ'
    else if (t === 'ㄹ' && on === 'ㄴ') on = 'ㄹ'
    // 鼻音化：ㄱ、ㄷ、ㅂ + ㄴ、ㅁ → ㅇ、ㄴ、ㅁ（먹는 [멍는]、합니다 [함니다]）
    if ((on === 'ㄴ' || on === 'ㅁ') && (t === 'ㄱ' || t === 'ㄷ' || t === 'ㅂ'))
      t = t === 'ㄱ' ? 'ㅇ' : t === 'ㄷ' ? 'ㄴ' : 'ㅁ'
    // 紧音化
    if (tense && TENSE[on]) {
      const stemish = stemBoundary || stemLikeCluster(c, a, chars[i + 1])
      if (OBSTRUENT_CODA.includes(c) && (t !== 'ㄹ' || stemish))
        on = TENSE[on] // 학교 [학꾜]、맑게 [말께]
      else if (STEM_TENSE_CODA.includes(c) && stemish)
        on = TENSE[on] // 신고 [신꼬]、앉고 [안꼬]、넓다 [널따]
      else if (i + 1 < sinoUpTo && t === 'ㄹ' && (on === 'ㄷ' || on === 'ㅅ' || on === 'ㅈ'))
        on = TENSE[on] // 갈등 [갈뜽]
    }
    a.t = t
    b.l = on
  }
  // 冠形词尾 -(으)ㄹ 后的词尾辅音读紧音：-ㄹ게요、-을게、-ㄹ수록、-ㄹ걸、-을지（할게요 [할께요]）
  if (tense) tenseAfterRieul(syls, chars)
  // 元音：져、쪄、쳐 读 [저、쩌、처]；辅音后的 ㅢ 读 [ㅣ]（희망 [히망]、무늬 [무니]）
  syls.forEach((s, i) => {
    if (s.v === 'ㅕ' && (s.l === 'ㅈ' || s.l === 'ㅉ' || s.l === 'ㅊ')) s.v = 'ㅓ'
    // 按写法看：写成 희、늬 的读 [히]、[니]；连音连过来的（건의 [거늬]）不变
    if (s.v === 'ㅢ' && spelled[i].l !== 'ㅇ') s.v = 'ㅣ'
  })
  return syls.map((s) => compose(s.l, s.v, s.t) ?? '').join('')
}

/** 后面接词尾就一定是 -(으)ㄹ 冠形词尾的几种（写法上不会跟别的词尾混） */
const RIEUL_ENDINGS = ['게요', '수록', '걸요', '걸', '지라도', '지언정', '세라']
/** 只接「게、지」时，前一个音节是这些才算 -(으)ㄹ게、-(으)ㄹ지（「알게」是 알다 + -게，不变） */
const RIEUL_SYLLABLES = new Set(['을', '할', '갈', '올', '볼', '줄', '될', '잘', '쓸', '탈', '울'])

/** -ㄹ게요、-을게、-ㄹ수록、-ㄹ걸、-을지：这些词尾里 ㄹ 后的辅音读紧音 */
function tenseAfterRieul(syls: Syl[], chars: string[]): void {
  const w = chars.join('')
  let at = -1
  for (const e of RIEUL_ENDINGS)
    if (w.endsWith(e) && chars.length > e.length) {
      at = chars.length - e.length
      break
    }
  if (at < 0)
    for (const e of ['게', '지', '지요', '지도'])
      if (
        w.endsWith(e) &&
        chars.length > e.length &&
        RIEUL_SYLLABLES.has(chars[chars.length - e.length - 1])
      ) {
        at = chars.length - e.length
        break
      }
  if (at < 1) return
  if (decompose(chars[at - 1])?.t !== 'ㄹ') return
  const s = syls[at]
  if (TENSE[s.l]) s.l = TENSE[s.l]
}

/** 把文字里的每个语节换成标准发音（不是韩文的字符原样留着） */
export function pronounce(text: string, opts: PronounceOptions = {}): string {
  return text.normalize('NFC').replace(/[가-힣]+/g, (w) => pronounceWord(w, opts))
}

// ───────────────────────── 罗马字 ─────────────────────────

const RR_ONSET: Record<string, string> = {
  ㄱ: 'g',
  ㄲ: 'kk',
  ㄴ: 'n',
  ㄷ: 'd',
  ㄸ: 'tt',
  ㄹ: 'r',
  ㅁ: 'm',
  ㅂ: 'b',
  ㅃ: 'pp',
  ㅅ: 's',
  ㅆ: 'ss',
  ㅇ: '',
  ㅈ: 'j',
  ㅉ: 'jj',
  ㅊ: 'ch',
  ㅋ: 'k',
  ㅌ: 't',
  ㅍ: 'p',
  ㅎ: 'h'
}
const RR_VOWEL: Record<string, string> = {
  ㅏ: 'a',
  ㅐ: 'ae',
  ㅑ: 'ya',
  ㅒ: 'yae',
  ㅓ: 'eo',
  ㅔ: 'e',
  ㅕ: 'yeo',
  ㅖ: 'ye',
  ㅗ: 'o',
  ㅘ: 'wa',
  ㅙ: 'wae',
  ㅚ: 'oe',
  ㅛ: 'yo',
  ㅜ: 'u',
  ㅝ: 'wo',
  ㅞ: 'we',
  ㅟ: 'wi',
  ㅠ: 'yu',
  ㅡ: 'eu',
  ㅢ: 'ui',
  ㅣ: 'i'
}
const RR_CODA: Record<string, string> = {
  ㄱ: 'k',
  ㄴ: 'n',
  ㄷ: 't',
  ㄹ: 'l',
  ㅁ: 'm',
  ㅂ: 'p',
  ㅇ: 'ng'
}

/** 一个语节 → 罗马字：辅音按发音（不标紧音），元音按写法（져 写 jyeo，ㅢ 一律 ui） */
function romanizeWord(word: string, opts: PronounceOptions): string {
  const spelled = [...word].map((ch) => decompose(ch)!)
  let pron = pronounceWord(word, { ...opts, tense: false })
  // 体词里 ㄱ、ㄷ、ㅂ 后的 ㅎ 照写（묵호 Mukho、집현전 Jiphyeonjeon）
  if (opts.noun) pron = nounAspirationUndo(word, pron)
  const syls = [...pron].map((ch) => decompose(ch)!)
  let out = ''
  for (let i = 0; i < syls.length; i++) {
    const s = syls[i]
    const prev = syls[i - 1]
    let onset = RR_ONSET[s.l] ?? ''
    if (s.l === 'ㄹ' && prev?.t === 'ㄹ') onset = 'l' // ㄹㄹ 写 ll（신라 Silla）
    const v = spelled[i]?.v ?? s.v
    out += onset + (RR_VOWEL[v] ?? '') + (RR_CODA[s.t] ?? '')
  }
  return out
}

/** 体词的罗马字：收音 ㄱ、ㄷ、ㅂ 加 ㅎ 不合成送气音，写成 k + h（백화점 baekhwajeom） */
function nounAspirationUndo(word: string, pron: string): string {
  const w = [...word].map((ch) => decompose(ch)!)
  const p = [...pron].map((ch) => decompose(ch)!)
  for (let i = 0; i < w.length - 1; i++) {
    const t = w[i].t
    if (w[i + 1].l !== 'ㅎ' || !t) continue
    const cl = CLUSTERS[t]
    const neutral = NEUTRAL[cl ? cl[1] : t]
    if (neutral === 'ㄱ' || neutral === 'ㄷ' || neutral === 'ㅂ') {
      p[i].t = cl ? cl[0] : neutral
      p[i + 1].l = 'ㅎ'
    }
  }
  return p.map((s) => compose(s.l, s.v, s.t) ?? '').join('')
}

/**
 * 国语罗马字（Revised Romanization）：按发音转写，不标紧音；韩文以外的字符原样留下。
 * 例：먹는다 → meongneunda，같이 → gachi，신라 → silla，학교 → hakgyo，좋고 → joko。
 */
export function romanize(text: string, opts: PronounceOptions = {}): string {
  return text.normalize('NFC').replace(/[가-힣]+/g, (w) => romanizeWord(w, opts))
}
