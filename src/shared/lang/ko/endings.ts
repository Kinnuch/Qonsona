/**
 * 韩语谓词（动词、形容词、이다）的词尾表：活用（conjugate.ts）与还原（deinflect.ts）共用。
 *
 * 词尾按接法分四类（字母串，见 hangul.ts 的 toJamo）：
 *   A：接在「아/어 形」后面（먹어 + 요 → 먹어요，가 + 서 → 가서，먹어 + ㅆ → 먹었）
 *   C：辅音开头，直接接词干（먹 + 고）；ㄹ 词干遇 ㄴ、ㅂ、ㅅ 脱落（사 + 는）
 *   E：「(으)」类，辅音词干后加 으（먹으면 / 가면 / 살면），见 conjugate.ts 的 attachE
 *   B：辅音词干、元音词干用不同写法的成对词尾（-습니다 / -ㅂ니다，-는다 / -ㄴ다）
 * base 说明能接在什么后面：
 *   v（只接动词）、ve（动词与 있다/없다 类）、vep（动词、있다/없다 类，或已经带了时制的 -았-/-겠-）、
 *   ap（形容词、이다、있다/없다 类，或带了时制的）、a（只接形容词与 이다，不带时制）、any（都行）、
 *   cop（只接 이다、아니다）
 * tensed：能不能接在 -았-、-겠- 后面（默认能；no 表示不能）。
 */

export type EndingType = 'A' | 'C' | 'E' | 'B'
export type EndingBase = 'v' | 've' | 'vep' | 'ap' | 'a' | 'any' | 'cop'

export interface Ending {
  id: string
  /** 词典式的写法（显示、还原结果的标签） */
  label: string
  type: EndingType
  /** 字母串：A 类是 아/어 后面的部分，C 类是整个词尾，E 类是 으 后面的部分，B 类是接辅音词干的写法 */
  j: string
  /** B 类接元音词干的写法 */
  jv?: string
  base: EndingBase
  /** 能不能接在 -았-、-겠- 后面 */
  tensed?: boolean
  /** 是不是语法上的「最后一个」：词尾后面还能接助词（-기는、-고요）由 lemma.ts 另外剥 */
  note?: string
}

const A = (id: string, label: string, j: string, base: EndingBase = 'any', tensed = true): Ending => ({
  id,
  label,
  type: 'A',
  j,
  base,
  tensed
})
const C = (id: string, label: string, j: string, base: EndingBase = 'any', tensed = true): Ending => ({
  id,
  label,
  type: 'C',
  j,
  base,
  tensed
})
const E = (id: string, label: string, j: string, base: EndingBase = 'any', tensed = true): Ending => ({
  id,
  label,
  type: 'E',
  j,
  base,
  tensed
})
const B = (
  id: string,
  label: string,
  j: string,
  jv: string,
  base: EndingBase = 'any',
  tensed = true
): Ending => ({ id, label, type: 'B', j, jv, base, tensed })

/** 先语末词尾（尊敬 -(으)시-、过去 -았/었-、推测与意志 -겠-）；按这个顺序叠 */
export const PREFINALS: Ending[] = [
  E('hon', '-(으)시-', 'ㅅㅣ'),
  A('past', '-았/었-', 'ㅆ'),
  C('fut', '-겠-', 'ㄱㅔㅆ')
]

/** 语末词尾（终结、连接、转成） */
export const FINALS: Ending[] = [
  // ── 아/어 类 ──
  A('hae', '-아/어', ''),
  A('haeyo', '-아요/어요', 'ㅇㅛ'),
  A('aseo', '-아서/어서', 'ㅅㅓ', 'any', false),
  A('ado', '-아도/어도', 'ㄷㅗ'),
  A('aya', '-아야/어야', 'ㅇㅑ'),
  A('ayaji', '-아야지/어야지', 'ㅇㅑㅈㅣ'),
  A('ayaman', '-아야만/어야만', 'ㅇㅑㅁㅏㄴ'),
  A('ara', '-아라/어라', 'ㄹㅏ', 'v', false),
  A('ada', '-아다/어다', 'ㄷㅏ', 'v', false),
  A('adaga', '-아다가/어다가', 'ㄷㅏㄱㅏ', 'v', false),
  A('aseoya', '-아서야/어서야', 'ㅅㅓㅇㅑ', 'any', false),
  // ── 辅音开头 ──
  C('go', '-고', 'ㄱㅗ'),
  C('goseo', '-고서', 'ㄱㅗㅅㅓ', 'v', false),
  C('goja', '-고자', 'ㄱㅗㅈㅏ', 'v', false),
  C('ji', '-지', 'ㅈㅣ'),
  C('jiyo', '-지요', 'ㅈㅣㅇㅛ'),
  C('jyo', '-죠', 'ㅈㅛ'),
  C('jiman', '-지만', 'ㅈㅣㅁㅏㄴ'),
  C('ge', '-게', 'ㄱㅔ', 'any', false),
  C('gekkeum', '-게끔', 'ㄱㅔㄲㅡㅁ', 'any', false),
  C('gi', '-기', 'ㄱㅣ'),
  C('gillae', '-길래', 'ㄱㅣㄹㄹㅐ'),
  C('deon', '-던', 'ㄷㅓㄴ'),
  C('deonde', '-던데', 'ㄷㅓㄴㄷㅔ'),
  C('deonga', '-던가', 'ㄷㅓㄴㄱㅏ'),
  C('deonji', '-던지', 'ㄷㅓㄴㅈㅣ'),
  C('deora', '-더라', 'ㄷㅓㄹㅏ'),
  C('deorago', '-더라고', 'ㄷㅓㄹㅏㄱㅗ'),
  C('deorado', '-더라도', 'ㄷㅓㄹㅏㄷㅗ'),
  C('deoramyeon', '-더라면', 'ㄷㅓㄹㅏㅁㅕㄴ'),
  C('deoni', '-더니', 'ㄷㅓㄴㅣ'),
  C('deogun', '-더군', 'ㄷㅓㄱㅜㄴ'),
  C('deoguna', '-더구나', 'ㄷㅓㄱㅜㄴㅏ'),
  C('daga', '-다가', 'ㄷㅏㄱㅏ'),
  C('dorok', '-도록', 'ㄷㅗㄹㅗㄱ', 'any', false),
  C('deusi', '-듯이', 'ㄷㅡㅅㅇㅣ'),
  C('deut', '-듯', 'ㄷㅡㅅ'),
  C('ja', '-자', 'ㅈㅏ', 'v', false),
  C('jamaja', '-자마자', 'ㅈㅏㅁㅏㅈㅏ', 'v', false),
  C('jago', '-자고', 'ㅈㅏㄱㅗ', 'v', false),
  C('jamyeon', '-자면', 'ㅈㅏㅁㅕㄴ', 'v', false),
  C('geona', '-거나', 'ㄱㅓㄴㅏ'),
  C('geodeun', '-거든', 'ㄱㅓㄷㅡㄴ'),
  C('geonman', '-건만', 'ㄱㅓㄴㅁㅏㄴ'),
  C('ne', '-네', 'ㄴㅔ'),
  C('neyo', '-네요', 'ㄴㅔㅇㅛ'),
  C('jana', '-잖아', 'ㅈㅏㄴㅎㅇㅏ'),
  C('janayo', '-잖아요', 'ㅈㅏㄴㅎㅇㅏㅇㅛ'),
  C('gun', '-군', 'ㄱㅜㄴ', 'ap'),
  C('gunyo', '-군요', 'ㄱㅜㄴㅇㅛ', 'ap'),
  C('guna', '-구나', 'ㄱㅜㄴㅏ', 'ap'),
  C('neungun', '-는군', 'ㄴㅡㄴㄱㅜㄴ', 've', false),
  C('neungunyo', '-는군요', 'ㄴㅡㄴㄱㅜㄴㅇㅛ', 've', false),
  C('neunguna', '-는구나', 'ㄴㅡㄴㄱㅜㄴㅏ', 've', false),
  C('neun', '-는', 'ㄴㅡㄴ', 've', false),
  C('neunde', '-는데', 'ㄴㅡㄴㄷㅔ', 'vep'),
  C('neunji', '-는지', 'ㄴㅡㄴㅈㅣ', 'vep'),
  C('neunga', '-는가', 'ㄴㅡㄴㄱㅏ', 'vep'),
  C('neungayo', '-는가요', 'ㄴㅡㄴㄱㅏㅇㅛ', 'vep'),
  C('neunyo', '-느냐', 'ㄴㅡㄴㅑ', 'vep'),
  C('neunyago', '-느냐고', 'ㄴㅡㄴㅑㄱㅗ', 'vep'),
  C('na', '-나', 'ㄴㅏ', 'vep'),
  C('nayo', '-나요', 'ㄴㅏㅇㅛ', 'any'),
  C('ni', '-니', 'ㄴㅣ', 'vep'),
  C('nya', '-냐', 'ㄴㅑ', 'vep'),
  C('nyago', '-냐고', 'ㄴㅑㄱㅗ', 'vep'),
  C('neura', '-느라', 'ㄴㅡㄹㅏ', 'v', false),
  C('neurago', '-느라고', 'ㄴㅡㄹㅏㄱㅗ', 'v', false),
  C('neunbaram', '-는바', 'ㄴㅡㄴㅂㅏ', 'vep'),
  C('da', '-다', 'ㄷㅏ', 'ap'),
  C('dago', '-다고', 'ㄷㅏㄱㅗ', 'ap'),
  C('dae', '-대', 'ㄷㅐ', 'ap'),
  C('daeyo', '-대요', 'ㄷㅐㅇㅛ', 'ap'),
  C('damyeon', '-다면', 'ㄷㅏㅁㅕㄴ', 'ap'),
  C('damyeonseo', '-다면서', 'ㄷㅏㅁㅕㄴㅅㅓ', 'ap'),
  C('damyeo', '-다며', 'ㄷㅏㅁㅕ', 'ap'),
  C('dani', '-다니', 'ㄷㅏㄴㅣ', 'ap'),
  C('danikka', '-다니까', 'ㄷㅏㄴㅣㄲㅏ', 'ap'),
  C('danda', '-단다', 'ㄷㅏㄴㄷㅏ', 'ap'),
  C('damnida', '-답니다', 'ㄷㅏㅂㄴㅣㄷㅏ', 'ap'),
  C('daneun', '-다는', 'ㄷㅏㄴㅡㄴ', 'ap'),
  C('dagoyo', '-다고요', 'ㄷㅏㄱㅗㅇㅛ', 'ap'),
  C('dasipi', '-다시피', 'ㄷㅏㅅㅣㅍㅣ', 'vep'),
  // ── 成对：-습니다 / -ㅂ니다、-는다 / -ㄴ다 ──
  B('seumnida', '-습니다', 'ㅅㅡㅂㄴㅣㄷㅏ', 'ㅂㄴㅣㄷㅏ'),
  B('seumnikka', '-습니까', 'ㅅㅡㅂㄴㅣㄲㅏ', 'ㅂㄴㅣㄲㅏ'),
  B('seupdida', '-습디다', 'ㅅㅡㅂㄷㅣㄷㅏ', 'ㅂㄷㅣㄷㅏ'),
  B('seupjyo', '-습죠', 'ㅅㅡㅂㅈㅛ', 'ㅂㅈㅛ'),
  B('neunda', '-는다', 'ㄴㅡㄴㄷㅏ', 'ㄴㄷㅏ', 'v', false),
  B('neundago', '-는다고', 'ㄴㅡㄴㄷㅏㄱㅗ', 'ㄴㄷㅏㄱㅗ', 'v', false),
  B('neundae', '-는대', 'ㄴㅡㄴㄷㅐ', 'ㄴㄷㅐ', 'v', false),
  B('neundaeyo', '-는대요', 'ㄴㅡㄴㄷㅐㅇㅛ', 'ㄴㄷㅐㅇㅛ', 'v', false),
  B('neundamyeon', '-는다면', 'ㄴㅡㄴㄷㅏㅁㅕㄴ', 'ㄴㄷㅏㅁㅕㄴ', 'v', false),
  B('neundamyeonseo', '-는다면서', 'ㄴㅡㄴㄷㅏㅁㅕㄴㅅㅓ', 'ㄴㄷㅏㅁㅕㄴㅅㅓ', 'v', false),
  B('neundamyeo', '-는다며', 'ㄴㅡㄴㄷㅏㅁㅕ', 'ㄴㄷㅏㅁㅕ', 'v', false),
  B('neundani', '-는다니', 'ㄴㅡㄴㄷㅏㄴㅣ', 'ㄴㄷㅏㄴㅣ', 'v', false),
  B('neundanikka', '-는다니까', 'ㄴㅡㄴㄷㅏㄴㅣㄲㅏ', 'ㄴㄷㅏㄴㅣㄲㅏ', 'v', false),
  B('neundanda', '-는단다', 'ㄴㅡㄴㄷㅏㄴㄷㅏ', 'ㄴㄷㅏㄴㄷㅏ', 'v', false),
  B('neundamnida', '-는답니다', 'ㄴㅡㄴㄷㅏㅂㄴㅣㄷㅏ', 'ㄴㄷㅏㅂㄴㅣㄷㅏ', 'v', false),
  B('neundaneun', '-는다는', 'ㄴㅡㄴㄷㅏㄴㅡㄴ', 'ㄴㄷㅏㄴㅡㄴ', 'v', false),
  // ── (으) 类 ──
  E('myeon', '-(으)면', 'ㅁㅕㄴ'),
  E('nikka', '-(으)니까', 'ㄴㅣㄲㅏ'),
  E('ni2', '-(으)니', 'ㄴㅣ'),
  E('n', '-(으)ㄴ', 'ㄴ', 'any', false),
  E('l', '-(으)ㄹ', 'ㄹ'),
  E('lkka', '-(으)ㄹ까', 'ㄹㄲㅏ'),
  E('lkkayo', '-(으)ㄹ까요', 'ㄹㄲㅏㅇㅛ'),
  E('lge', '-(으)ㄹ게', 'ㄹㄱㅔ', 'v', false),
  E('lgeyo', '-(으)ㄹ게요', 'ㄹㄱㅔㅇㅛ', 'v', false),
  E('llae', '-(으)ㄹ래', 'ㄹㄹㅐ', 'v', false),
  E('llaeyo', '-(으)ㄹ래요', 'ㄹㄹㅐㅇㅛ', 'v', false),
  E('lji', '-(으)ㄹ지', 'ㄹㅈㅣ'),
  E('ljido', '-(으)ㄹ지도', 'ㄹㅈㅣㄷㅗ'),
  E('ljirado', '-(으)ㄹ지라도', 'ㄹㅈㅣㄹㅏㄷㅗ'),
  E('lsurok', '-(으)ㄹ수록', 'ㄹㅅㅜㄹㅗㄱ', 'any', false),
  E('lgeol', '-(으)ㄹ걸', 'ㄹㄱㅓㄹ'),
  E('lgeoryo', '-(으)ㄹ걸요', 'ㄹㄱㅓㄹㅇㅛ'),
  E('lttenikka', '-(으)ㄹ테니까', 'ㄹㅌㅔㄴㅣㄲㅏ'),
  E('lmangjeong', '-(으)ㄹ망정', 'ㄹㅁㅏㅇㅈㅓㅇ'),
  E('lppun', '-(으)ㄹ뿐', 'ㄹㅃㅜㄴ'),
  E('nde', '-(으)ㄴ데', 'ㄴㄷㅔ', 'a', false),
  E('nji', '-(으)ㄴ지', 'ㄴㅈㅣ', 'a', false),
  E('nga', '-(으)ㄴ가', 'ㄴㄱㅏ', 'a', false),
  E('ngayo', '-(으)ㄴ가요', 'ㄴㄱㅏㅇㅛ', 'a', false),
  E('nya2', '-(으)냐', 'ㄴㅑ', 'a', false),
  E('nyago2', '-(으)냐고', 'ㄴㅑㄱㅗ', 'a', false),
  E('ndeul', '-(으)ㄴ들', 'ㄴㄷㅡㄹ', 'any', false),
  E('nikkayo', '-(으)니까요', 'ㄴㅣㄲㅏㅇㅛ'),
  E('sipsio', '-(으)십시오', 'ㅅㅣㅂㅅㅣㅇㅗ', 'v', false),
  E('sipsida', '-(으)십시다', 'ㅅㅣㅂㅅㅣㄷㅏ', 'v', false),
  E('psida', '-(으)ㅂ시다', 'ㅂㅅㅣㄷㅏ', 'v', false),
  E('reo', '-(으)러', 'ㄹㅓ', 'v', false),
  E('ryeogo', '-(으)려고', 'ㄹㅕㄱㅗ', 'v', false),
  E('ryeomyeon', '-(으)려면', 'ㄹㅕㅁㅕㄴ', 'v', false),
  E('ryeo', '-(으)려', 'ㄹㅕ', 'v', false),
  E('ryeoneun', '-(으)려는', 'ㄹㅕㄴㅡㄴ', 'v', false),
  E('ryeonda', '-(으)련다', 'ㄹㅕㄴㄷㅏ', 'v', false),
  E('myeo', '-(으)며', 'ㅁㅕ'),
  E('myeonseo', '-(으)면서', 'ㅁㅕㄴㅅㅓ', 'any', false),
  E('meuro', '-(으)므로', 'ㅁㅡㄹㅗ'),
  E('m', '-(으)ㅁ', 'ㅁ'),
  E('ra', '-(으)라', 'ㄹㅏ', 'v', false),
  E('rago', '-(으)라고', 'ㄹㅏㄱㅗ', 'v', false),
  E('rae', '-(으)래', 'ㄹㅐ', 'v', false),
  E('raeyo', '-(으)래요', 'ㄹㅐㅇㅛ', 'v', false),
  E('ramyeon', '-(으)라면', 'ㄹㅏㅁㅕㄴ', 'v', false),
  E('raneun', '-(으)라는', 'ㄹㅏㄴㅡㄴ', 'v', false),
  E('na2', '-(으)나', 'ㄴㅏ'),
  E('nama', '-(으)나마', 'ㄴㅏㅁㅏ'),
  E('ri', '-(으)리라', 'ㄹㅣㄹㅏ'),
  // 이다、아니다 专用：-이라서、-이라고、-이래요、-이라면（이다 / 아니다 + 라）
  E('raseo', '-라서', 'ㄹㅏㅅㅓ', 'cop', false),
  E('rago-cop', '-라고', 'ㄹㅏㄱㅗ', 'cop'),
  E('rae-cop', '-래', 'ㄹㅐ', 'cop'),
  E('raeyo-cop', '-래요', 'ㄹㅐㅇㅛ', 'cop'),
  E('ramyeon-cop', '-라면', 'ㄹㅏㅁㅕㄴ', 'cop'),
  E('rado-cop', '-라도', 'ㄹㅏㄷㅗ', 'cop'),
  E('raneun-cop', '-라는', 'ㄹㅏㄴㅡㄴ', 'cop')
]

export const ENDING_BY_ID = new Map([...PREFINALS, ...FINALS].map((e) => [e.id, e]))

/** 先语末词尾的显示名 */
export const PREFINAL_LABEL: Record<string, string> = {
  hon: '-(으)시-',
  past: '-았/었-',
  fut: '-겠-'
}
