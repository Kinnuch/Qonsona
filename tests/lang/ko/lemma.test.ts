/**
 * 猜原形（rules.lemmaCandidates）：剥助词（含组合）、剥词尾还原词干（每一类不规则）、이다、代词特殊写法、
 * 带空格的惯用语；另外用正向活用做往返检查：活用出来的每个形式都要能还原回原形。
 */
import { describe, expect, it } from 'vitest'
import { conjugate, type PredClass } from '../../../src/shared/lang/ko/conjugate'
import { FINALS } from '../../../src/shared/lang/ko/endings'
import { lemmaCandidates } from '../../../src/shared/lang/ko/lemma'

const lemmas = (w: string): string[] => lemmaCandidates(w).map((g) => g.lemma)
const tagsOf = (w: string, lemma: string): string[] | undefined =>
  lemmaCandidates(w).find((g) => g.lemma === lemma)?.tags

/** 小词典：模拟阅读器「取第一个查得到的」 */
const DICT = new Set([
  ...'먹다 가다 가 오다 보다 주다 되다 하다 나 나다 날다 우리 우리다 저 절다 너 학교 학생 의사 공부 공부하다 듣다 들다 춥다 덥다 돕다 모르다 부르다 예쁘다 바쁘다 쓰다 살다 사다 알다 좋다 있다 없다 친구 이것 그것 무엇 아니다 한국어 사람 책 시간 마시다 낫다 짓다 파랗다 그렇다 어떻다 걷다 묻다 물다 맛있다 재미있다 기다리다 가르치다 만들다 열다 길다 푸다 이르다 계시다 드시다 일하다 운동 운동하다 날씨 어제 집 서울 도서관 커피 물 밥 사과 기차'.split(
    ' '
  ),
  '마음에 들다',
  '눈이 높다'
])
const reader = (w: string): string | undefined =>
  lemmaCandidates(w).find((g) => DICT.has(g.lemma))?.lemma

describe('谓词：常用词尾', () => {
  it.each([
    ['먹었어요', '먹다'],
    ['가요', '가다'],
    ['갔습니다', '가다'],
    ['봐요', '보다'],
    ['와요', '오다'],
    ['줬어요', '주다'],
    ['돼요', '되다'],
    ['되어', '되다'],
    ['마셔요', '마시다'],
    ['기다려요', '기다리다'],
    ['가르쳐요', '가르치다'],
    ['했습니다', '하다'],
    ['하세요', '하다'],
    ['하셨어요', '하다'],
    ['합니다', '하다'],
    ['한다', '하다'],
    ['하여', '하다'],
    ['공부했어요', '공부하다'],
    ['일하는', '일하다'],
    ['먹겠습니다', '먹다'],
    ['먹었겠다', '먹다'],
    ['먹고', '먹다'],
    ['먹어서', '먹다'],
    ['먹으면', '먹다'],
    ['먹으니까', '먹다'],
    ['먹지만', '먹다'],
    ['먹는데', '먹다'],
    ['먹을까요', '먹다'],
    ['먹을게요', '먹다'],
    ['먹으러', '먹다'],
    ['먹으려고', '먹다'],
    ['먹으면서', '먹다'],
    ['먹자', '먹다'],
    ['먹읍시다', '먹다'],
    ['드세요', '드시다'],
    ['먹어라', '먹다'],
    ['먹는', '먹다'],
    ['먹은', '먹다'],
    ['먹을', '먹다'],
    ['먹던', '먹다'],
    ['먹기', '먹다'],
    ['먹음', '먹다'],
    ['먹네요', '먹다'],
    ['먹죠', '먹다'],
    ['먹잖아요', '먹다'],
    ['먹는다고', '먹다'],
    ['먹었는지', '먹다'],
    ['먹어도', '먹다'],
    ['먹어야', '먹다'],
    ['먹다가', '먹다'],
    ['먹도록', '먹다'],
    ['좋네요', '좋다'],
    ['좋은', '좋다'],
    ['좋다고', '좋다'],
    ['맛있는', '맛있다'],
    ['재미있었어요', '재미있다'],
    ['없어요', '없다'],
    ['계세요', '계시다']
  ])('%s → %s', (w, l) => expect(lemmas(w)).toContain(l))
})

describe('谓词：不规则与脱落', () => {
  it.each([
    // ㅂ
    ['추워요', '춥다'],
    ['추운', '춥다'],
    ['추우면', '춥다'],
    ['더웠어요', '덥다'],
    ['도와요', '돕다'],
    ['도와주세요', '도와주다'],
    // ㄷ
    ['들어요', '듣다'],
    ['들으니까', '듣다'],
    ['듣는', '듣다'],
    ['걸어서', '걷다'],
    ['물어봤어요', '물어보다'],
    // ㅅ
    ['나아요', '낫다'],
    ['지어요', '짓다'],
    ['지으면', '짓다'],
    // 르、러
    ['몰라요', '모르다'],
    ['불렀어요', '부르다'],
    ['이르러', '이르다'],
    // ㅎ
    ['파래요', '파랗다'],
    ['파란', '파랗다'],
    ['그래요', '그렇다'],
    ['그런', '그렇다'],
    ['어때요', '어떻다'],
    // 우
    ['퍼요', '푸다'],
    // 으 脱落
    ['예뻐요', '예쁘다'],
    ['바빠서', '바쁘다'],
    ['써요', '쓰다'],
    // ㄹ 脱落
    ['살아요', '살다'],
    ['사는', '살다'],
    ['삽니다', '살다'],
    ['산다', '살다'],
    ['아세요', '알다'],
    ['만드는', '만들다'],
    ['여니까', '열다'],
    ['긴', '길다']
  ])('%s → %s', (w, l) => expect(lemmas(w)).toContain(l))
  it('同一写法几种可能都给（들어요：들다 / 듣다）', () => {
    expect(lemmas('들어요')).toEqual(expect.arrayContaining(['들다', '듣다']))
    expect(lemmas('사는')).toEqual(expect.arrayContaining(['살다', '사다']))
    expect(lemmas('지어요')).toEqual(expect.arrayContaining(['짓다', '지다']))
  })
  it('标签是词尾的词典式写法', () => {
    expect(tagsOf('먹었어요', '먹다')).toEqual(['-았/었-', '-아요/어요'])
    expect(tagsOf('가셨어요', '가다')).toEqual(['-(으)시-', '-았/었-', '-아요/어요'])
    expect(tagsOf('먹겠습니다', '먹다')).toEqual(['-겠-', '-습니다'])
  })
})

describe('体词 + 助词', () => {
  it.each([
    ['학교에서는', '학교', ['에서', '은/는']],
    ['친구랑', '친구', ['(이)랑']],
    ['책을', '책', ['을/를']],
    ['사과를', '사과', ['을/를']],
    ['도서관으로', '도서관', ['(으)로']],
    ['서울로', '서울', ['(으)로']],
    ['물로', '물', ['(으)로']],
    ['사람들이', '사람', ['-들', '이/가']],
    ['집까지도', '집', ['까지', '도']],
    ['학생에게서', '학생', ['에게서']],
    ['시간밖에', '시간', ['밖에']],
    ['커피요', '커피', ['요']]
  ])('%s → %s', (w, l, tags) => expect(tagsOf(w, l)).toEqual(tags))
  it('助词的两种写法按有没有收音核对：「학교이」不是「학교 + 이」', () => {
    expect(lemmas('학교이')).not.toContain('학교')
    expect(lemmas('책를')).not.toContain('책')
    expect(lemmas('물으로')).not.toContain('물') // ㄹ 收音后面是「로」
  })
  it('收音式缩约：난、전、이건、그걸', () => {
    expect(lemmas('난')).toContain('나')
    expect(lemmas('전')).toContain('저')
    expect(lemmas('이건')).toContain('이거')
    expect(lemmas('그걸')).toContain('그거')
  })
  it('代词的特殊写法', () => {
    expect(lemmas('내가')).toContain('나')
    expect(lemmas('제가')).toContain('저')
    expect(lemmas('누가')).toContain('누구')
    expect(lemmas('뭘')).toContain('무엇')
    expect(lemmas('제가요')).toContain('저')
  })
  it('谓词名词形后面接助词：먹기를、먹고요、하지는', () => {
    expect(tagsOf('먹기를', '먹다')).toEqual(['-기', '을/를'])
    expect(tagsOf('먹고요', '먹다')).toEqual(['-고', '요'])
    expect(lemmas('하지는')).toContain('하다')
    expect(lemmas('먹긴')).toContain('먹다')
  })
  it('汉字、拉丁字母后面接助词', () => {
    expect(lemmas('學校에')).toContain('學校')
    expect(lemmas('SNS에서')).toContain('SNS')
    expect(lemmas('TV를')).toContain('TV')
  })
})

describe('이다、아니다', () => {
  it.each([
    ['학생이에요', '학생'],
    ['학생입니다', '학생'],
    ['학생이었어요', '학생'],
    ['학생이라서', '학생'],
    ['학생인데', '학생'],
    ['의사예요', '의사'],
    ['의사였어요', '의사'],
    ['의사야', '의사'],
    ['의사라고', '의사'],
    ['의사죠', '의사'],
    ['의사입니다', '의사'],
    ['학생이라서요', '학생']
  ])('%s → %s', (w, l) => expect(tagsOf(w, l)?.[0]).toBe('이다'))
  it('아니다', () => {
    expect(lemmas('아니에요')).toContain('아니다')
    expect(lemmas('아니라서')).toContain('아니다')
    expect(lemmas('아냐')).toContain('아니다')
    expect(lemmas('아닙니다')).toContain('아니다')
  })
})

describe('阅读器取第一个查得到的', () => {
  it.each([
    ['나는', '나'],
    ['우리는', '우리'],
    ['저는', '저'],
    ['먹었어요', '먹다'],
    ['학교에서는', '학교'],
    ['의사예요', '의사'],
    ['공부했어요', '공부하다'],
    ['운동했어요', '운동하다'],
    ['몰라요', '모르다'],
    ['추워요', '춥다'],
    ['예뻐요', '예쁘다'],
    ['기차는', '기차'],
    ['날씨가', '날씨'],
    ['어제', undefined],
    ['파란', '파랗다']
  ])('%s → %s', (w, l) => expect(reader(w)).toBe(l))
  it('冠形词尾跟助词同形的，两种都给（阅读器在变形表里按词频挑：가는 多半是 가다）', () => {
    expect(lemmas('가는')).toEqual(expect.arrayContaining(['가다', '가']))
    expect(lemmas('그런데')).toContain('그렇다')
  })
})

describe('带空格的惯用语', () => {
  it('只还原最后一个语节', () => {
    expect(lemmas('마음에 들어요')).toContain('마음에 들다')
    expect(lemmas('눈이 높아서')).toContain('눈이 높다')
    expect(lemmas('마음에  드는')).toContain('마음에 들다')
  })
})

describe('往返：活用出来的每个形式都能还原回原形', () => {
  const cases: [string, PredClass][] = [
    ['먹다', 'reg'],
    ['가다', 'reg'],
    ['오다', 'reg'],
    ['보다', 'reg'],
    ['주다', 'reg'],
    ['되다', 'reg'],
    ['마시다', 'reg'],
    ['보내다', 'reg'],
    ['쓰다', 'reg'],
    ['바쁘다', 'reg'],
    ['살다', 'reg'],
    ['하다', 'reg'],
    ['공부하다', 'reg'],
    ['좋다', 'reg'],
    ['있다', 'reg'],
    ['춥다', 'p'],
    ['돕다', 'po'],
    ['듣다', 't'],
    ['낫다', 's'],
    ['모르다', 'reu'],
    ['이르다', 'reo'],
    ['파랗다', 'h'],
    ['그렇다', 'h'],
    ['푸다', 'u']
  ]
  const chains: string[][] = []
  for (const e of FINALS) {
    chains.push([e.id])
    if (e.tensed) chains.push(['past', e.id], ['fut', e.id])
    if (e.id !== 'seyo' && e.id !== 'syeoyo') chains.push(['hon', e.id])
  }
  chains.push(['hon', 'past', 'haeyo'], ['past', 'fut', 'da'])
  it.each(cases)('%s（%s）', (lemma, cls) => {
    const missed: string[] = []
    for (const chain of chains)
      for (const form of conjugate(lemma, cls, chain))
        if (form !== lemma && !lemmas(form).includes(lemma))
          missed.push(`${form}（${chain.join('+')}）`)
    expect(missed).toEqual([])
  })
})
