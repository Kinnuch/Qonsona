/**
 * 韩语谓词（动词、形容词、이다）的词尾表：活用（conjugate.ts）与还原（deinflect.ts）共用。
 *
 * 词尾按接法分四类（j 是字母串，见 hangul.ts 的 toJamo）：
 *   A：接在「아/어 形」后面（먹어 + 요 → 먹어요，가 + 서 → 가서，먹어 + ㅆ → 먹었）
 *   C：辅音开头，直接接词干（먹 + 고）；ㄹ 词干遇 ㄴ、ㅂ、ㅅ 开头的词尾脱落（살 + 는 → 사는）
 *   E：「(으)」类：辅音词干后加 으（먹으면），元音词干、ㄹ 词干直接接（가면、살면；사니까）
 *   B：辅音词干、元音词干写法不同的成对词尾（-습니다 / -ㅂ니다，-는다 / -ㄴ다）
 * 接什么词（base）：
 *   v 只接动词；ve 动词与 있다/없다 类；vep 动词、있다/없다 类，或带了 -았-/-겠- 的；
 *   ap 形容词、이다，或带了 -았-/-겠- 的；a 只接形容词与 이다（不带时制）；any 都行。
 * 「tensed: false」的不能接在 -았-、-겠- 后面（-는、-아서、-(으)러……）。
 * label 同时是还原结果的标签（阅读器显示「먹다 + -었- + -어요」，以后认语法点也按它）。
 */

export type EndingType = 'A' | 'C' | 'E' | 'B'
export type EndingBase = 'v' | 've' | 'vep' | 'ap' | 'a' | 'any'

export interface Ending {
  id: string
  /** 词典式写法（标签、显示） */
  label: string
  type: EndingType
  /** 字母串：A 类是 아/어 后面的部分，C 类是整个词尾，E 类是 으 后面的部分，B 类是接辅音词干的写法 */
  j: string
  /** B 类接元音词干（含脱落了 ㄹ 的词干）的写法 */
  jv?: string
  base: EndingBase
  /** 能接在 -았-、-겠- 后面（默认能） */
  tensed: boolean
  /** 后面还能再接助词（-고요、-기는、-지도、-어서는） */
  takesParticle?: boolean
  /** 常用程度：0 课本第一年就学、1 常见、2 少见或书面；还原时同样对得上的几种分析，常用的排前面 */
  rank: number
}

function mk(
  type: EndingType,
  id: string,
  label: string,
  j: string,
  base: EndingBase,
  rank: number,
  opts: { tensed?: boolean; jv?: string; particle?: boolean } = {}
): Ending {
  return {
    id,
    label,
    type,
    j,
    jv: opts.jv,
    base,
    tensed: opts.tensed ?? true,
    takesParticle: opts.particle,
    rank
  }
}

/** 先语末词尾：尊敬 -(으)시-、过去 -았/었-、推测与意志 -겠-；按这个顺序叠（가셨겠다） */
export const PREFINALS = {
  hon: mk('E', 'hon', '-(으)시-', 'ㅅㅣ', 'any', 0),
  past: mk('A', 'past', '-았/었-', 'ㅆ', 'any', 0),
  fut: mk('C', 'fut', '-겠-', 'ㄱㅔㅆ', 'any', 0)
}

/** 语末词尾（终结、连接、转成） */
export const FINALS: Ending[] = [
  // ── 아/어 类 ──
  mk('A', 'hae', '-아/어', '', 'any', 0),
  mk('A', 'haeyo', '-아요/어요', 'ㅇㅛ', 'any', 0),
  mk('A', 'aseo', '-아서/어서', 'ㅅㅓ', 'any', 0, { tensed: false, particle: true }),
  mk('A', 'ado', '-아도/어도', 'ㄷㅗ', 'any', 0),
  mk('A', 'aya', '-아야/어야', 'ㅇㅑ', 'any', 0, { particle: true }),
  mk('A', 'ayaji', '-아야지/어야지', 'ㅇㅑㅈㅣ', 'any', 1),
  mk('A', 'ara', '-아라/어라', 'ㄹㅏ', 'v', 1, { tensed: false }),
  mk('A', 'adaga', '-아다가/어다가', 'ㄷㅏㄱㅏ', 'v', 2, { tensed: false }),
  // ── 辅音开头 ──
  mk('C', 'go', '-고', 'ㄱㅗ', 'any', 0, { particle: true }),
  mk('C', 'goseo', '-고서', 'ㄱㅗㅅㅓ', 'v', 2, { tensed: false }),
  mk('C', 'goja', '-고자', 'ㄱㅗㅈㅏ', 'v', 2, { tensed: false }),
  mk('C', 'ji', '-지', 'ㅈㅣ', 'any', 0, { particle: true }),
  mk('C', 'jiyo', '-지요', 'ㅈㅣㅇㅛ', 'any', 1),
  mk('C', 'jyo', '-죠', 'ㅈㅛ', 'any', 0),
  mk('C', 'jiman', '-지만', 'ㅈㅣㅁㅏㄴ', 'any', 0),
  mk('C', 'ge', '-게', 'ㄱㅔ', 'any', 0, { tensed: false, particle: true }),
  mk('C', 'gi', '-기', 'ㄱㅣ', 'any', 0, { particle: true }),
  mk('C', 'gillae', '-길래', 'ㄱㅣㄹㄹㅐ', 'any', 2),
  mk('C', 'deon', '-던', 'ㄷㅓㄴ', 'any', 1),
  mk('C', 'deonde', '-던데', 'ㄷㅓㄴㄷㅔ', 'any', 1, { particle: true }),
  mk('C', 'deonga', '-던가', 'ㄷㅓㄴㄱㅏ', 'any', 2),
  mk('C', 'deonji', '-던지', 'ㄷㅓㄴㅈㅣ', 'any', 2),
  mk('C', 'deora', '-더라', 'ㄷㅓㄹㅏ', 'any', 1),
  mk('C', 'deorago', '-더라고', 'ㄷㅓㄹㅏㄱㅗ', 'any', 1, { particle: true }),
  mk('C', 'deorado', '-더라도', 'ㄷㅓㄹㅏㄷㅗ', 'any', 1),
  mk('C', 'deoramyeon', '-더라면', 'ㄷㅓㄹㅏㅁㅕㄴ', 'any', 2),
  mk('C', 'deoni', '-더니', 'ㄷㅓㄴㅣ', 'any', 1),
  mk('C', 'deogun', '-더군', 'ㄷㅓㄱㅜㄴ', 'any', 2, { particle: true }),
  mk('C', 'deoguna', '-더구나', 'ㄷㅓㄱㅜㄴㅏ', 'any', 2),
  mk('C', 'daga', '-다가', 'ㄷㅏㄱㅏ', 'any', 0, { particle: true }),
  mk('C', 'dorok', '-도록', 'ㄷㅗㄹㅗㄱ', 'any', 1, { tensed: false }),
  mk('C', 'deusi', '-듯이', 'ㄷㅡㅅㅇㅣ', 'any', 1),
  mk('C', 'deut', '-듯', 'ㄷㅡㅅ', 'any', 2),
  mk('C', 'ja', '-자', 'ㅈㅏ', 'v', 0, { tensed: false }),
  mk('C', 'jamaja', '-자마자', 'ㅈㅏㅁㅏㅈㅏ', 'v', 1, { tensed: false }),
  mk('C', 'jago', '-자고', 'ㅈㅏㄱㅗ', 'v', 1, { tensed: false, particle: true }),
  mk('C', 'geona', '-거나', 'ㄱㅓㄴㅏ', 'any', 0),
  mk('C', 'geodeun', '-거든', 'ㄱㅓㄷㅡㄴ', 'any', 1, { particle: true }),
  mk('C', 'ne', '-네', 'ㄴㅔ', 'any', 1),
  mk('C', 'neyo', '-네요', 'ㄴㅔㅇㅛ', 'any', 0),
  mk('C', 'jana', '-잖아', 'ㅈㅏㄴㅎㅇㅏ', 'any', 1),
  mk('C', 'janayo', '-잖아요', 'ㅈㅏㄴㅎㅇㅏㅇㅛ', 'any', 1),
  mk('C', 'gun', '-군', 'ㄱㅜㄴ', 'ap', 2, { particle: true }),
  mk('C', 'gunyo', '-군요', 'ㄱㅜㄴㅇㅛ', 'ap', 1),
  mk('C', 'guna', '-구나', 'ㄱㅜㄴㅏ', 'ap', 1),
  mk('C', 'neungunyo', '-는군요', 'ㄴㅡㄴㄱㅜㄴㅇㅛ', 've', 1, { tensed: false }),
  mk('C', 'neunguna', '-는구나', 'ㄴㅡㄴㄱㅜㄴㅏ', 've', 1, { tensed: false }),
  mk('C', 'neun', '-는', 'ㄴㅡㄴ', 've', 0, { tensed: false }),
  mk('C', 'neunde', '-는데', 'ㄴㅡㄴㄷㅔ', 'vep', 0, { particle: true }),
  mk('C', 'neunji', '-는지', 'ㄴㅡㄴㅈㅣ', 'vep', 0, { particle: true }),
  mk('C', 'neunga', '-는가', 'ㄴㅡㄴㄱㅏ', 'vep', 2),
  mk('C', 'neunya', '-느냐', 'ㄴㅡㄴㅑ', 'vep', 2),
  mk('C', 'neunyago', '-느냐고', 'ㄴㅡㄴㅑㄱㅗ', 'vep', 2),
  mk('C', 'na', '-나', 'ㄴㅏ', 'vep', 1),
  mk('C', 'nayo', '-나요', 'ㄴㅏㅇㅛ', 'vep', 0),
  mk('C', 'ni', '-니', 'ㄴㅣ', 'vep', 1),
  mk('C', 'nya', '-냐', 'ㄴㅑ', 'vep', 1),
  mk('C', 'nyago', '-냐고', 'ㄴㅑㄱㅗ', 'vep', 1, { particle: true }),
  mk('C', 'neurago', '-느라고', 'ㄴㅡㄹㅏㄱㅗ', 'v', 1, { tensed: false }),
  mk('C', 'neura', '-느라', 'ㄴㅡㄹㅏ', 'v', 2, { tensed: false }),
  mk('C', 'da', '-다', 'ㄷㅏ', 'ap', 0),
  mk('C', 'dago', '-다고', 'ㄷㅏㄱㅗ', 'ap', 0, { particle: true }),
  mk('C', 'dae', '-대', 'ㄷㅐ', 'ap', 1),
  mk('C', 'daeyo', '-대요', 'ㄷㅐㅇㅛ', 'ap', 1),
  mk('C', 'damyeon', '-다면', 'ㄷㅏㅁㅕㄴ', 'ap', 1),
  mk('C', 'damyeonseo', '-다면서', 'ㄷㅏㅁㅕㄴㅅㅓ', 'ap', 2),
  mk('C', 'damyeo', '-다며', 'ㄷㅏㅁㅕ', 'ap', 2),
  mk('C', 'dani', '-다니', 'ㄷㅏㄴㅣ', 'ap', 2),
  mk('C', 'danikka', '-다니까', 'ㄷㅏㄴㅣㄲㅏ', 'ap', 2),
  mk('C', 'danda', '-단다', 'ㄷㅏㄴㄷㅏ', 'ap', 2),
  mk('C', 'damnida', '-답니다', 'ㄷㅏㅂㄴㅣㄷㅏ', 'ap', 2),
  mk('C', 'daneun', '-다는', 'ㄷㅏㄴㅡㄴ', 'ap', 1),
  mk('C', 'dasipi', '-다시피', 'ㄷㅏㅅㅣㅍㅣ', 'vep', 2),
  // ── 成对：-습니다 / -ㅂ니다、-는다 / -ㄴ다 ──
  mk('B', 'seumnida', '-습니다', 'ㅅㅡㅂㄴㅣㄷㅏ', 'any', 0, { jv: 'ㅂㄴㅣㄷㅏ' }),
  mk('B', 'seumnikka', '-습니까', 'ㅅㅡㅂㄴㅣㄲㅏ', 'any', 0, { jv: 'ㅂㄴㅣㄲㅏ' }),
  mk('B', 'seupdida', '-습디다', 'ㅅㅡㅂㄷㅣㄷㅏ', 'any', 2, { jv: 'ㅂㄷㅣㄷㅏ' }),
  mk('B', 'neunda', '-는다', 'ㄴㅡㄴㄷㅏ', 'v', 0, { tensed: false, jv: 'ㄴㄷㅏ' }),
  mk('B', 'neundago', '-는다고', 'ㄴㅡㄴㄷㅏㄱㅗ', 'v', 0, {
    tensed: false,
    jv: 'ㄴㄷㅏㄱㅗ',
    particle: true
  }),
  mk('B', 'neundae', '-는대', 'ㄴㅡㄴㄷㅐ', 'v', 1, { tensed: false, jv: 'ㄴㄷㅐ' }),
  mk('B', 'neundaeyo', '-는대요', 'ㄴㅡㄴㄷㅐㅇㅛ', 'v', 1, { tensed: false, jv: 'ㄴㄷㅐㅇㅛ' }),
  mk('B', 'neundamyeon', '-는다면', 'ㄴㅡㄴㄷㅏㅁㅕㄴ', 'v', 1, {
    tensed: false,
    jv: 'ㄴㄷㅏㅁㅕㄴ'
  }),
  mk('B', 'neundamyeonseo', '-는다면서', 'ㄴㅡㄴㄷㅏㅁㅕㄴㅅㅓ', 'v', 2, {
    tensed: false,
    jv: 'ㄴㄷㅏㅁㅕㄴㅅㅓ'
  }),
  mk('B', 'neundani', '-는다니', 'ㄴㅡㄴㄷㅏㄴㅣ', 'v', 2, { tensed: false, jv: 'ㄴㄷㅏㄴㅣ' }),
  mk('B', 'neundanda', '-는단다', 'ㄴㅡㄴㄷㅏㄴㄷㅏ', 'v', 2, {
    tensed: false,
    jv: 'ㄴㄷㅏㄴㄷㅏ'
  }),
  mk('B', 'neundamnida', '-는답니다', 'ㄴㅡㄴㄷㅏㅂㄴㅣㄷㅏ', 'v', 2, {
    tensed: false,
    jv: 'ㄴㄷㅏㅂㄴㅣㄷㅏ'
  }),
  mk('B', 'neundaneun', '-는다는', 'ㄴㅡㄴㄷㅏㄴㅡㄴ', 'v', 1, {
    tensed: false,
    jv: 'ㄴㄷㅏㄴㅡㄴ'
  }),
  // ── (으) 类 ──
  mk('E', 'myeon', '-(으)면', 'ㅁㅕㄴ', 'any', 0, { particle: true }),
  mk('E', 'nikka', '-(으)니까', 'ㄴㅣㄲㅏ', 'any', 0, { particle: true }),
  mk('E', 'euni', '-(으)니', 'ㄴㅣ', 'any', 1),
  mk('E', 'n', '-(으)ㄴ', 'ㄴ', 'any', 0, { tensed: false }),
  mk('E', 'l', '-(으)ㄹ', 'ㄹ', 'any', 0),
  mk('E', 'lkka', '-(으)ㄹ까', 'ㄹㄲㅏ', 'any', 1),
  mk('E', 'lkkayo', '-(으)ㄹ까요', 'ㄹㄲㅏㅇㅛ', 'any', 0),
  mk('E', 'lge', '-(으)ㄹ게', 'ㄹㄱㅔ', 'v', 1, { tensed: false }),
  mk('E', 'lgeyo', '-(으)ㄹ게요', 'ㄹㄱㅔㅇㅛ', 'v', 0, { tensed: false }),
  mk('E', 'llae', '-(으)ㄹ래', 'ㄹㄹㅐ', 'v', 1, { tensed: false }),
  mk('E', 'llaeyo', '-(으)ㄹ래요', 'ㄹㄹㅐㅇㅛ', 'v', 1, { tensed: false }),
  mk('E', 'lji', '-(으)ㄹ지', 'ㄹㅈㅣ', 'any', 1, { particle: true }),
  mk('E', 'ljirado', '-(으)ㄹ지라도', 'ㄹㅈㅣㄹㅏㄷㅗ', 'any', 2),
  mk('E', 'lsurok', '-(으)ㄹ수록', 'ㄹㅅㅜㄹㅗㄱ', 'any', 1, { tensed: false }),
  mk('E', 'lgeol', '-(으)ㄹ걸', 'ㄹㄱㅓㄹ', 'any', 1),
  mk('E', 'lgeoryo', '-(으)ㄹ걸요', 'ㄹㄱㅓㄹㅇㅛ', 'any', 1),
  mk('E', 'lmangjeong', '-(으)ㄹ망정', 'ㄹㅁㅏㅇㅈㅓㅇ', 'any', 2),
  mk('E', 'nde', '-(으)ㄴ데', 'ㄴㄷㅔ', 'a', 0, { tensed: false, particle: true }),
  mk('E', 'nji', '-(으)ㄴ지', 'ㄴㅈㅣ', 'a', 0, { tensed: false, particle: true }),
  mk('E', 'nga', '-(으)ㄴ가', 'ㄴㄱㅏ', 'a', 1, { tensed: false }),
  mk('E', 'ngayo', '-(으)ㄴ가요', 'ㄴㄱㅏㅇㅛ', 'a', 1, { tensed: false }),
  mk('E', 'eunya', '-(으)냐', 'ㄴㅑ', 'a', 2, { tensed: false }),
  mk('E', 'ndeul', '-(으)ㄴ들', 'ㄴㄷㅡㄹ', 'any', 2, { tensed: false }),
  mk('E', 'nikkayo', '-(으)니까요', 'ㄴㅣㄲㅏㅇㅛ', 'any', 1),
  mk('E', 'seyo', '-(으)세요', 'ㅅㅔㅇㅛ', 'any', 0, { tensed: false }),
  mk('E', 'syeoyo', '-(으)셔요', 'ㅅㅕㅇㅛ', 'any', 2, { tensed: false }),
  mk('E', 'sipsio', '-(으)십시오', 'ㅅㅣㅂㅅㅣㅇㅗ', 'v', 0, { tensed: false }),
  mk('E', 'sipsida', '-(으)십시다', 'ㅅㅣㅂㅅㅣㄷㅏ', 'v', 2, { tensed: false }),
  mk('E', 'psida', '-(으)ㅂ시다', 'ㅂㅅㅣㄷㅏ', 'v', 0, { tensed: false }),
  mk('E', 'reo', '-(으)러', 'ㄹㅓ', 'v', 0, { tensed: false }),
  mk('E', 'ryeogo', '-(으)려고', 'ㄹㅕㄱㅗ', 'v', 0, { tensed: false, particle: true }),
  mk('E', 'ryeomyeon', '-(으)려면', 'ㄹㅕㅁㅕㄴ', 'v', 1, { tensed: false }),
  mk('E', 'ryeoneun', '-(으)려는', 'ㄹㅕㄴㅡㄴ', 'v', 1, { tensed: false }),
  mk('E', 'ryeo', '-(으)려', 'ㄹㅕ', 'v', 2, { tensed: false }),
  mk('E', 'myeonseo', '-(으)면서', 'ㅁㅕㄴㅅㅓ', 'any', 0, { tensed: false, particle: true }),
  mk('E', 'myeo', '-(으)며', 'ㅁㅕ', 'any', 1),
  mk('E', 'meuro', '-(으)므로', 'ㅁㅡㄹㅗ', 'any', 2),
  mk('E', 'm', '-(으)ㅁ', 'ㅁ', 'any', 1, { particle: true }),
  mk('E', 'rago', '-(으)라고', 'ㄹㅏㄱㅗ', 'v', 1, { tensed: false, particle: true }),
  mk('E', 'raneun', '-(으)라는', 'ㄹㅏㄴㅡㄴ', 'v', 2, { tensed: false }),
  mk('E', 'raeyo', '-(으)래요', 'ㄹㅐㅇㅛ', 'v', 2, { tensed: false }),
  mk('E', 'rae', '-(으)래', 'ㄹㅐ', 'v', 2, { tensed: false }),
  mk('E', 'ra', '-(으)라', 'ㄹㅏ', 'v', 2, { tensed: false }),
  mk('E', 'euna', '-(으)나', 'ㄴㅏ', 'any', 2),
  mk('E', 'rira', '-(으)리라', 'ㄹㅣㄹㅏ', 'any', 2)
]

export const ENDINGS = new Map<string, Ending>(
  [...Object.values(PREFINALS), ...FINALS].map((e) => [e.id, e])
)
