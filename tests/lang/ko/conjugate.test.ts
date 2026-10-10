/**
 * 谓词活用：每一类不规则、常用词尾、先语末词尾的叠加、이다 与 아니다、敬语动词。
 * 整体跟英文维基词典 4,685 个谓词的活用表比对过（一致 99.93%，见 docs/lang/ko.md）。
 */
import { describe, expect, it } from 'vitest'
import {
  classify,
  conjugate,
  possibleClasses,
  type PredClass
} from '../../../src/shared/lang/ko/conjugate'

const c = (lemma: string, cls: PredClass, chain: string): string =>
  conjugate(lemma, cls, chain.split(' '))[0]

describe('规则活用', () => {
  it('辅音词干、元音调和', () => {
    expect(c('먹다', 'reg', 'haeyo')).toBe('먹어요')
    expect(c('잡다', 'reg', 'haeyo')).toBe('잡아요')
    expect(c('얇다', 'reg', 'hae')).toBe('얇아')
    expect(c('먹다', 'reg', 'seumnida')).toBe('먹습니다')
    expect(c('먹다', 'reg', 'neunda')).toBe('먹는다')
    expect(c('먹다', 'reg', 'myeon')).toBe('먹으면')
    expect(c('먹다', 'reg', 'n')).toBe('먹은')
  })
  it('元音词干的缩约（通行写法在前，另一种也给）', () => {
    expect(c('가다', 'reg', 'haeyo')).toBe('가요')
    expect(c('서다', 'reg', 'hae')).toBe('서')
    expect(conjugate('보다', 'reg', ['haeyo'])).toEqual(['봐요', '보아요'])
    expect(conjugate('오다', 'reg', ['haeyo'])).toEqual(['와요'])
    expect(conjugate('주다', 'reg', ['past', 'da'])).toEqual(['줬다', '주었다'])
    expect(conjugate('마시다', 'reg', ['haeyo'])).toEqual(['마셔요', '마시어요'])
    expect(conjugate('되다', 'reg', ['haeyo'])).toEqual(['돼요', '되어요'])
    expect(c('보내다', 'reg', 'past da')).toBe('보냈다')
    expect(c('뛰다', 'reg', 'haeyo')).toBe('뛰어요')
    expect(conjugate('놓다', 'reg', ['haeyo'])).toContain('놔요')
  })
  it('하다：해 / 하여', () => {
    expect(conjugate('하다', 'reg', ['haeyo'])).toEqual(['해요', '하여요'])
    expect(c('공부하다', 'reg', 'past haeyo')).toBe('공부했어요')
    expect(conjugate('공부하다', 'reg', ['past', 'da'])).toContain('공부하였다')
    expect(c('깨끗하다', 'reg', 'n')).toBe('깨끗한')
  })
  it('ㅡ 脱落', () => {
    expect(c('쓰다', 'reg', 'haeyo')).toBe('써요')
    expect(c('크다', 'reg', 'past da')).toBe('컸다')
    expect(c('바쁘다', 'reg', 'haeyo')).toBe('바빠요')
    expect(c('예쁘다', 'reg', 'haeyo')).toBe('예뻐요')
    expect(c('아프다', 'reg', 'aseo')).toBe('아파서')
    expect(c('따르다', 'reg', 'haeyo')).toBe('따라요')
  })
  it('ㄹ 脱落：遇 ㄴ、ㅂ、ㅅ 与 -ㄹ까 这类', () => {
    expect(c('살다', 'reg', 'neun')).toBe('사는')
    expect(c('살다', 'reg', 'seumnida')).toBe('삽니다')
    expect(c('살다', 'reg', 'neunda')).toBe('산다')
    expect(c('살다', 'reg', 'nikka')).toBe('사니까')
    expect(c('살다', 'reg', 'seyo')).toBe('사세요')
    expect(c('살다', 'reg', 'n')).toBe('산')
    expect(c('살다', 'reg', 'l')).toBe('살')
    expect(c('살다', 'reg', 'lkkayo')).toBe('살까요')
    expect(c('살다', 'reg', 'myeon')).toBe('살면')
    expect(c('살다', 'reg', 'reo')).toBe('살러')
    expect(c('살다', 'reg', 'go')).toBe('살고')
    expect(c('만들다', 'reg', 'm')).toBe('만듦')
    expect(c('알다', 'reg', 'haeyo')).toBe('알아요')
  })
})

describe('不规则活用', () => {
  it('ㅂ 不规则', () => {
    expect(c('춥다', 'p', 'haeyo')).toBe('추워요')
    expect(c('춥다', 'p', 'myeon')).toBe('추우면')
    expect(c('춥다', 'p', 'n')).toBe('추운')
    expect(c('춥다', 'p', 'go')).toBe('춥고')
    expect(c('춥다', 'p', 'seumnida')).toBe('춥습니다')
    expect(c('아름답다', 'p', 'past da')).toBe('아름다웠다')
    expect(c('돕다', 'po', 'haeyo')).toBe('도와요')
    expect(c('돕다', 'po', 'myeon')).toBe('도우면')
    expect(c('섧다', 'p', 'hae')).toBe('설워')
  })
  it('ㄷ 不规则', () => {
    expect(c('듣다', 't', 'haeyo')).toBe('들어요')
    expect(c('듣다', 't', 'nikka')).toBe('들으니까')
    expect(c('듣다', 't', 'neun')).toBe('듣는')
    expect(c('걷다', 't', 'past da')).toBe('걸었다')
    expect(c('깨닫다', 't', 'hae')).toBe('깨달아')
  })
  it('ㅅ 不规则（不缩约）', () => {
    expect(c('낫다', 's', 'haeyo')).toBe('나아요')
    expect(c('짓다', 's', 'haeyo')).toBe('지어요')
    expect(c('짓다', 's', 'myeon')).toBe('지으면')
    expect(c('짓다', 's', 'go')).toBe('짓고')
  })
  it('르 不规则、러 不规则', () => {
    expect(c('모르다', 'reu', 'haeyo')).toBe('몰라요')
    expect(c('부르다', 'reu', 'past da')).toBe('불렀다')
    expect(c('빠르다', 'reu', 'aseo')).toBe('빨라서')
    expect(c('모르다', 'reu', 'myeon')).toBe('모르면')
    expect(c('이르다', 'reo', 'hae')).toBe('이르러')
    expect(c('푸르다', 'reo', 'past da')).toBe('푸르렀다')
  })
  it('ㅎ 不规则：ㅏ→ㅐ、ㅑ→ㅒ、ㅓ→ㅔ，이렇다类是 ㅐ', () => {
    expect(c('파랗다', 'h', 'haeyo')).toBe('파래요')
    expect(c('파랗다', 'h', 'n')).toBe('파란')
    expect(c('파랗다', 'h', 'myeon')).toBe('파라면')
    expect(c('하얗다', 'h', 'hae')).toBe('하얘')
    expect(c('누렇다', 'h', 'hae')).toBe('누레')
    expect(c('그렇다', 'h', 'haeyo')).toBe('그래요')
    expect(c('어떻다', 'h', 'haeyo')).toBe('어때요')
    expect(conjugate('파랗다', 'h', ['neyo'])).toEqual(['파랗네요', '파라네요'])
  })
  it('우 不规则', () => {
    expect(c('푸다', 'u', 'haeyo')).toBe('퍼요')
    expect(c('푸다', 'u', 'past da')).toBe('펐다')
  })
  it('그러다、어쩌다 缩成 래、째', () => {
    expect(c('그러다', 'reg', 'aseo')).toBe('그래서')
    expect(c('어쩌다', 'reg', 'past da')).toBe('어쨌다')
  })
})

describe('先语末词尾与敬语', () => {
  it('-(으)시-、-았/었-、-겠- 按顺序叠', () => {
    expect(c('가다', 'reg', 'hon haeyo')).toBe('가세요')
    expect(c('가다', 'reg', 'seyo')).toBe('가세요')
    expect(c('읽다', 'reg', 'seyo')).toBe('읽으세요')
    expect(c('가다', 'reg', 'hon past haeyo')).toBe('가셨어요')
    expect(c('하다', 'reg', 'hon past seumnida')).toBe('하셨습니다')
    expect(c('먹다', 'reg', 'fut seumnida')).toBe('먹겠습니다')
    expect(c('먹다', 'reg', 'past fut da')).toBe('먹었겠다')
    expect(c('가다', 'reg', 'past hae')).toBe('갔어') // -았- 后面一律接 어，不接 아
    expect(c('가다', 'reg', 'past haeyo')).toBe('갔어요')
    expect(c('듣다', 't', 'seyo')).toBe('들으세요')
    expect(c('춥다', 'p', 'hon da')).toBe('추우시다')
  })
  it('계시다、주무시다 是 -세요；모시다 是 -셔요', () => {
    expect(c('계시다', 'reg', 'haeyo')).toBe('계세요')
    expect(c('주무시다', 'reg', 'haeyo')).toBe('주무세요')
    expect(c('모시다', 'reg', 'haeyo')).toBe('모셔요')
  })
  it('가다、오다 的命令形另有 가거라、오너라', () => {
    expect(conjugate('가다', 'reg', ['ara'])).toEqual(['가라', '가거라'])
    expect(conjugate('오다', 'reg', ['ara'])).toEqual(['와라', '오너라'])
  })
})

describe('이다、아니다', () => {
  it('이다', () => {
    expect(conjugate('이다', 'cop', ['haeyo'])).toEqual(['이에요', '이어요'])
    expect(c('이다', 'cop', 'hae')).toBe('이야')
    expect(c('이다', 'cop', 'seumnida')).toBe('입니다')
    expect(c('이다', 'cop', 'past haeyo')).toBe('이었어요')
    expect(conjugate('이다', 'cop', ['aseo'])).toEqual(['이라서', '이어서', '이라'])
    expect(c('이다', 'cop', 'dago')).toBe('이라고')
    expect(c('이다', 'cop', 'n')).toBe('인')
  })
  it('아니다', () => {
    expect(c('아니다', 'cop', 'haeyo')).toBe('아니에요')
    expect(c('아니다', 'cop', 'hae')).toBe('아니야')
    expect(c('아니다', 'cop', 'seumnida')).toBe('아닙니다')
    expect(c('아니다', 'cop', 'past da')).toBe('아니었다')
    expect(c('아니다', 'cop', 'dago')).toBe('아니라고')
  })
})

describe('定类别', () => {
  it('按形状可能的几类', () => {
    expect(possibleClasses('듣다')).toEqual(['reg', 't'])
    expect(possibleClasses('모르다')[0]).toBe('reu')
    expect(possibleClasses('공부하다')).toEqual(['reg'])
    expect(possibleClasses('이다')).toEqual(['cop'])
  })
  it('按词典给的活用形定', () => {
    expect(classify('듣다', ['들어', '들으니', '듣는'])).toBe('t')
    expect(classify('받다', ['받아', '받으니'])).toBe('reg')
    expect(classify('춥다', ['추워', '추우니'])).toBe('p')
    expect(classify('입다', ['입어', '입으니'])).toBe('reg')
    expect(classify('돕다', ['도와', '도우니'])).toBe('po')
    expect(classify('낫다', ['나아', '나으니'])).toBe('s')
    expect(classify('웃다', ['웃어', '웃으니'])).toBe('reg')
    expect(classify('따르다', ['따라', '따르니'])).toBe('reg')
    expect(classify('이르다', ['이르러', '이르니'])).toBe('reo')
    expect(classify('좋다', ['좋아', '좋으니'])).toBe('reg')
    expect(classify('하얗다', ['하얘', '하야니'])).toBe('h')
  })
  it('没有活用形时按形状给默认', () => {
    expect(classify('파랗다', [])).toBe('h')
    expect(classify('부르다', [])).toBe('reu')
    expect(classify('먹다', [])).toBe('reg')
  })
})
