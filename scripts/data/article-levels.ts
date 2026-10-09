/**
 * 内置文章与民间故事课文的难度先算好：跟软件里同一套办法（kuromoji 分词、JLPT 词表里的实词 85% 在哪一级以内），
 * 写进 data/ja/articles.json 每篇的 level，和 data/ja/folktales.json 里 tales 每篇的 level。这样第一次打开软件
 * 不用现算（内置文章八篇四万多字，要二三十秒，首页的新闻栏、阅读页都得等它）。重新下载内置文章
 * （node scripts/data/articles-ja.mjs）或民间故事（node scripts/data/folktales-ja.mjs）之后要再跑一次。
 * 两个文件有哪个算哪个；算完跟原来一字不差的文件不重写。
 *
 * 用法：npm run data:levels（先要有 npm run data:ja 生成的词典）
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { JaAnalyzer } from '../../src/main/ja-analyze'
import { JapaneseDict } from '../../src/main/dict'
import { analysisLevel } from '../../src/shared/articles'

const ROOT = process.cwd()
const DB = resolve(ROOT, 'resources/data/ja/dict.sqlite')

interface Text {
  id: string
  title: string
  body: string
  level?: number | null
}

/** 要算的文件，和文件里那一组文章在哪：内置文章整个是数组，民间故事在 tales 里 */
const FILES: { file: string; texts: (data: unknown) => Text[] }[] = [
  { file: 'data/ja/articles.json', texts: (data) => data as Text[] },
  { file: 'data/ja/folktales.json', texts: (data) => (data as { tales: Text[] }).tales }
]

if (!existsSync(DB)) {
  console.error(`没有词典数据库 ${DB}：先跑 npm run data:ja`)
  process.exit(1)
}

const analyzer = new JaAnalyzer(resolve(ROOT, 'node_modules/kuromoji/dict'))
const dict = new JapaneseDict(DB)
const lookup = (base: string, reading: string, inflected: boolean) =>
  dict.word(base, reading, inflected)

for (const { file, texts } of FILES) {
  const path = resolve(ROOT, file)
  if (!existsSync(path)) {
    console.log(`没有 ${file}，跳过`)
    continue
  }
  const old = readFileSync(path, 'utf8')
  const data: unknown = JSON.parse(old)
  for (const a of texts(data)) {
    a.level = analysisLevel(await analyzer.analyze(a.body, lookup))
    console.log(`${a.id} ${a.title}：${a.level ? `N${a.level}` : '难度未知'}`)
  }
  const json = JSON.stringify(data, null, 1) + '\n'
  if (json === old) console.log(`${file}：跟原来一样，不用重写`)
  else {
    writeFileSync(path, json)
    console.log(`写好 ${file}`)
  }
}
dict.close()
