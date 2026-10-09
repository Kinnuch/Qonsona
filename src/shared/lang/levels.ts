/**
 * 各语言共用的分级：CEFR 六级（欧洲共同语言参考标准）。
 * 说明是自己写的概括（不是欧洲委员会原文），各语言可以在自己的 spec 里另写更细的。
 */
import type { CefrLevel, LevelDef, LevelSystemDef, SourceRef } from './types'

export const CEFR_DESC: Record<
  CefrLevel,
  { zh: string; en: string; name: { zh: string; en: string } }
> = {
  A1: {
    name: { zh: 'A1 入门', en: 'A1 Beginner' },
    zh: '能听懂、会用最常用的日常说法，能介绍自己、问答简单的个人信息。',
    en: 'Understands and uses everyday expressions; can introduce themselves and ask and answer simple personal questions.'
  },
  A2: {
    name: { zh: 'A2 基础', en: 'A2 Elementary' },
    zh: '能就熟悉的日常事务（购物、家庭、工作、周边）作简单交流，描述自己的背景和眼前的事。',
    en: 'Communicates in simple, routine tasks about familiar matters such as shopping, family, work and the local area.'
  },
  B1: {
    name: { zh: 'B1 进阶', en: 'B1 Intermediate' },
    zh: '能读懂工作、学习、休闲里常见话题的要点，应付旅行中的大多数情况，简单说明理由和打算。',
    en: 'Understands the main points of familiar topics, handles most travel situations and briefly gives reasons and plans.'
  },
  B2: {
    name: { zh: 'B2 中高级', en: 'B2 Upper intermediate' },
    zh: '能看懂较复杂文章的主旨，跟母语者交流比较流利自然，能就多种话题清楚、详细地表达看法。',
    en: 'Understands complex texts, interacts fluently with native speakers and gives clear, detailed views on many subjects.'
  },
  C1: {
    name: { zh: 'C1 高级', en: 'C1 Advanced' },
    zh: '能读懂各类长篇、难度高的文章并体会言外之意，在社交、学术、工作中灵活有效地运用语言。',
    en: 'Understands demanding, longer texts and implicit meaning; uses the language flexibly for social, academic and professional purposes.'
  },
  C2: {
    name: { zh: 'C2 精通', en: 'C2 Proficient' },
    zh: '几乎能毫不费力地听懂、读懂一切，能概括各种来源的信息，表达精确，细微的意思差别也能分清。',
    en: 'Understands virtually everything with ease, summarises from different sources and expresses fine shades of meaning precisely.'
  }
}

export const CEFR_SOURCE: SourceRef = {
  id: 'cefr',
  name: 'Common European Framework of Reference for Languages (CEFR)',
  license: '参考框架（等级说明为本软件概括）',
  credit: 'Council of Europe',
  home: 'https://www.coe.int/en/web/common-european-framework-reference-languages'
}

/** CEFR 六级（A1–C2）的等级定义 */
export function cefrLevels(): LevelDef[] {
  return (Object.keys(CEFR_DESC) as CefrLevel[]).map((id) => ({
    id,
    name: CEFR_DESC[id].name,
    short: id,
    desc: { zh: CEFR_DESC[id].zh, en: CEFR_DESC[id].en }
  }))
}

/** 一套以 CEFR 为主分级的体系；sources 写这门语言按什么把词分到各级 */
export function cefrSystem(sources: SourceRef[], primary = true): LevelSystemDef {
  return {
    id: 'cefr',
    name: { zh: '欧洲共同语言参考标准（CEFR）', en: 'CEFR' },
    kind: 'proficiency',
    levels: cefrLevels(),
    primary,
    cefr: { A1: 'A1', A2: 'A2', B1: 'B1', B2: 'B2', C1: 'C1', C2: 'C2' },
    sources: [CEFR_SOURCE, ...sources]
  }
}

/** 一门语言的主分级 */
export function primarySystem(systems: LevelSystemDef[]): LevelSystemDef {
  const p = systems.filter((s) => s.primary)
  if (p.length !== 1) throw new Error(`主分级要恰好一套，现在有 ${p.length} 套`)
  return p[0]
}
