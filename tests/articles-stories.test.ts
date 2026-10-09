/**
 * 文章库与故事课：导入时填的主题、自己贴的译文（存取、删掉、跟原文按段落对齐），
 * 民间故事是内置文章（主题 folktale），故事课的每一课对得上一篇；课文的本文练习过关的规则。
 */
import { mkdtempSync, readFileSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join, resolve } from 'path'
import { afterAll, describe, expect, it } from 'vitest'
import { ArticleStore } from '../src/main/articles'
import { alignParagraphs } from '$shared/articles'
import { PASS, emptyProgress, lessonState, markLearned, recordText } from '$shared/course'
import { STORY_ARTICLE_IDS, jaStoriesCourse } from '$shared/ja/stories-course'

const dir = mkdtempSync(join(tmpdir(), 'qs-articles-'))
afterAll(() => rmSync(dir, { recursive: true, force: true }))
const store = new ArticleStore(dir, async () => 4)

describe('文章：主题与译文', () => {
  it('导入时填的主题记在文章上（去掉首尾空白）；没填的没有主题', async () => {
    const a = await store.save({ title: '日記', body: '今日は雨でした。', topic: ' 随筆 ' })
    const b = await store.save({ title: '', body: '明日は晴れるでしょう。' })
    const list = await store.list()
    expect(list.find((x) => x.id === a.id)?.topic).toBe('随筆')
    expect(list.find((x) => x.id === b.id)?.topic).toBeUndefined()
  })

  it('译文：存了 get 能取到、列表上标出来；存空的就删掉；删文章连译文一起删', async () => {
    const a = await store.save({ title: 't', body: '一段目。\n二段目。' })
    await store.setTranslation(a.id, '第一段。\r\n第二段。\n')
    const got = await store.get(a.id)
    expect(got?.translation).toBe('第一段。\n第二段。')
    expect((await store.list()).find((x) => x.id === a.id)?.translated).toBe(true)
    await store.setTranslation(a.id, '  ')
    expect((await store.get(a.id))?.translation).toBeUndefined()
    await store.setTranslation(a.id, '再来一次。')
    await store.remove(a.id)
    expect(await store.get(a.id)).toBeNull()
    await expect(store.setTranslation(a.id, 'x')).rejects.toThrow()
  })

  it('内置文章也能加译文；没有的文章、不合法的 id 不行', async () => {
    await store.setTranslation('aozora-18376', 'Momotaro')
    expect((await store.get('aozora-18376'))?.translation).toBe('Momotaro')
    await expect(store.setTranslation('nope', 'x')).rejects.toThrow()
    await expect(store.setTranslation('../x', 'x')).rejects.toThrow()
  })

  it('译文按段落对齐：空行不算，多出来的放在最后', () => {
    expect(alignParagraphs(2, 'A\n\nB\nC\n')).toEqual({ at: ['A', 'B'], rest: ['C'] })
    expect(alignParagraphs(3, ' A ')).toEqual({ at: ['A'], rest: [] })
  })
})

describe('民间故事', () => {
  const tales = (
    JSON.parse(readFileSync(resolve(__dirname, '../data/ja/folktales.json'), 'utf8')) as {
      tales: { id: string; title: string }[]
    }
  ).tales

  it('是内置文章：来源青空文库、主题 folktale、带难度', async () => {
    const list = await store.list()
    for (const t of tales) {
      const a = list.find((x) => x.id === t.id)
      expect(a, t.id).toBeTruthy()
      expect(a!.source).toBe('aozora')
      expect(a!.topic).toBe('folktale')
      expect(a!.level).toBeGreaterThanOrEqual(1)
    }
    await expect(store.remove(tales[0].id)).rejects.toThrow()
  })

  it('故事课：每一课一篇，篇目都在数据里、标题对得上，每篇都排进了课', () => {
    const course = jaStoriesCourse()
    expect(course.kind).toBe('texts')
    const lessons = course.units.flatMap((u) => u.lessons)
    expect(lessons).toHaveLength(tales.length)
    expect([...STORY_ARTICLE_IDS].sort()).toEqual(tales.map((t) => t.id).sort())
    for (const l of lessons) {
      const item = course.texts![l.items[0]]
      const tale = tales.find((t) => t.id === item.articleId)
      expect(tale?.title.startsWith(item.title), l.id).toBe(true)
    }
  })

  it('本文练习答对八成过关；读了但没过关算学过；文档课以外打开不算过关', () => {
    const course = jaStoriesCourse()
    const lesson = course.units[0].lessons[0].id
    const p = emptyProgress()
    markLearned(p, course, lesson)
    expect(lessonState(p, course, lesson)).toBe('learned')
    expect(recordText(p, course, lesson, PASS - 0.1)).toBe(false)
    expect(lessonState(p, course, lesson)).toBe('learned')
    expect(recordText(p, course, lesson, PASS)).toBe(true)
    expect(lessonState(p, course, lesson)).toBe('passed')
    // 过关之后再做得差也还是过关
    recordText(p, course, lesson, 0)
    expect(lessonState(p, course, lesson)).toBe('passed')
  })
})
