/**
 * 把阿拉伯语数据管线要的原始文件都下载到 .cache/data/ar/（已经有的跳过）。
 *   node scripts/data/run-ts.mjs scripts/data/ar/fetch.ts [键…]
 * 不给键就下载全部；英语词条（翻译表用，五百多 MB）最大，可以单独先下：… fetch.ts wiktEnEnglish
 */
import { FILES, fetchFile, type FileKey } from './sources'

const keys = (
  process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(FILES)
) as FileKey[]
for (const k of keys) {
  if (!(k in FILES)) throw new Error(`没有这份文件：${k}（可选：${Object.keys(FILES).join('、')}）`)
  console.log(`${k} → ${await fetchFile(k)}`)
}
