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

function newMemo(): DictMemo {
  const memo = $state<DictMemo>({
    query: '',
    tab: 'words',
    selected: null,
    char: null,
    history: [],
    grammar: null,
    grammarLevel: null
  })
  return memo
}

class DictState {
  /**
   * 每门语言一份记录：记录本身是响应式的，表不是（一门语言的记录建好就不换）。
   * 这样第一次取的时候新建不算「改状态」，在 $derived 里取也行（框架语言的词典按 code 取）
   */
  #byPack = new Map<string, DictMemo>()

  of(packId: string): DictMemo {
    let memo = this.#byPack.get(packId)
    if (!memo) {
      memo = newMemo()
      this.#byPack.set(packId, memo)
    }
    return memo
  }

  remember(packId: string, query: string): void {
    const q = query.trim()
    if (!q) return
    const m = this.of(packId)
    m.history = [q, ...m.history.filter((x) => x !== q)].slice(0, 20)
  }
}

export const dictState = new DictState()
