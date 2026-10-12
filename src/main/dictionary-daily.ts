import {
  makeDaily,
  dailyOrdinal,
  type DailyPool,
  type DictionaryDaily
} from '../shared/dictionary-daily'

/** 只在内存保存候选与最近64个语言/日期组合；历史日期按同一真实数据池重现，不写用户项目。 */
export class DictionaryDailyRepository {
  #pools = new Map<string, DailyPool>()
  #days = new Map<string, DictionaryDaily>()
  #loading = new Map<string, Promise<DailyPool>>()
  constructor(private readonly loader: (packId: string) => DailyPool | Promise<DailyPool>) {}
  async get(packId: string, date: string): Promise<DictionaryDaily> {
    dailyOrdinal(date)
    const key = `${packId}/${date}`
    const cached = this.#days.get(key)
    if (cached) return structuredClone(cached)
    let pool = this.#pools.get(packId)
    if (!pool) {
      if (!this.#loading.has(packId))
        this.#loading.set(
          packId,
          Promise.resolve()
            .then(() => this.loader(packId))
            .then((p) => {
              this.#pools.set(packId, p)
              return p
            })
            .finally(() => this.#loading.delete(packId))
        )
      pool = await this.#loading.get(packId)!
    }
    const bundle = makeDaily(packId, date, pool)
    this.#days.set(key, bundle)
    while (this.#days.size > 64) this.#days.delete(this.#days.keys().next().value!)
    return structuredClone(bundle)
  }
}
