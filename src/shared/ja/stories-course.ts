/**
 * 日语的故事课：日本民间故事（楠山正雄整理，青空文库的公有领域作品，data/ja/folktales.json），
 * 按主题分单元，一课一篇。课文就是文章库里的内置文章（主题「民间故事」）：在阅读器里读，
 * 做本文练习（用这篇的词、语法、句子出题）答对八成过关。篇目与分组是这里排的，正文、难度在数据里。
 */
import type { Course, CourseLesson, CourseUnit, Text, TextItem } from '../course'

/** 一篇：青空文库的图书卡号（文章 id 是 aozora-<号>）与标题 */
type Tale = [number, string]

interface UnitSpec {
  id: string
  title: Text
  tales: Tale[]
}

const UNITS: UnitSpec[] = [
  {
    id: 'animals',
    title: { zh: '动物的故事', en: 'Animal tales' },
    tales: [
      [18335, 'ねずみの嫁入り'],
      [18334, '猿かに合戦'],
      [18378, '舌切りすずめ'],
      [18336, '文福茶がま'],
      [18379, 'くらげのお使い']
    ]
  },
  {
    id: 'heroes',
    title: { zh: '英雄与冒险', en: 'Heroes and adventures' },
    tales: [
      [18376, '桃太郎'],
      [18337, '金太郎'],
      [43457, '一寸法師'],
      [3390, '浦島太郎']
    ]
  },
  {
    id: 'fortune',
    title: { zh: '福气与智慧', en: 'Luck and wit' },
    tales: [
      [3391, '花咲かじじい'],
      [43461, '瘤とり'],
      [18389, '鬼六'],
      [33214, '松山鏡'],
      [43458, '一本のわら']
    ]
  }
]

/** 故事课里所有的文章 id，按课的顺序 */
export const STORY_ARTICLE_IDS = UNITS.flatMap((u) => u.tales.map(([card]) => `aozora-${card}`))

/** 故事这门课 */
export function jaStoriesCourse(): Course {
  const texts: Record<string, TextItem> = {}
  const units: CourseUnit[] = UNITS.map((u) => ({
    id: u.id,
    title: u.title,
    test: false,
    lessons: u.tales.map(([card, title]): CourseLesson => {
      const key = `aozora-${card}`
      texts[key] = { key, title, author: '楠山正雄', articleId: key }
      return { id: `tale-${card}`, title, items: [key] }
    })
  }))
  return {
    id: 'stories',
    kind: 'texts',
    title: { zh: '民间故事', en: 'Folk tales' },
    intro: {
      zh: '日本的民间故事，一课一篇：先在阅读器里读（汉字注振假名，点击词语即可查词），再做本文练习，答对八成就算过关。',
      en: 'Japanese folk tales, one per lesson: read it in the reader (furigana over kanji, click a word to look it up), then do the article practice; getting 80% right passes the lesson.'
    },
    units,
    symbols: {},
    grammar: {},
    docs: {},
    texts
  }
}
