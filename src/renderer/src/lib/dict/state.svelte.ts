/**
 * 词典页的状态：每门语言各记一份（查询、页签、选中的词条和字），离开词典再回来原样还在。
 * 只记在内存里，重启软件不保留。
 */
export type DictTab = 'words' | 'characters' | 'sentences' | 'grammar'

export interface DictMemo {
  query: string
  tab: DictTab
  /** 选中的词条 id（日语是 JMdict 词条号，千语集语言是词条 id） */
  selected: string | null
  /** 「字」页签选中的字（日语是汉字，千语集语言是语素 id） */
  char: string | null
  /** 最近查过的词，新的在前 */
  history: string[]
  /** 「语法」页签（日语）：选中的语法点、按等级筛（null 是全部） */
  grammar: string | null
  grammarLevel: number | null
}

class DictState {
  #byPack = $state<Record<string, DictMemo>>({})

  of(packId: string): DictMemo {
    // 先放进状态再读出来：读出来的才是响应式代理（a[k] ??= v 返回的是原始对象，改它界面不会更新）
    if (!this.#byPack[packId])
      this.#byPack[packId] = {
        query: '',
        tab: 'words',
        selected: null,
        char: null,
        history: [],
        grammar: null,
        grammarLevel: null
      }
    return this.#byPack[packId]
  }

  remember(packId: string, query: string): void {
    const q = query.trim()
    if (!q) return
    const m = this.of(packId)
    m.history = [q, ...m.history.filter((x) => x !== q)].slice(0, 20)
  }
}

export const dictState = new DictState()
