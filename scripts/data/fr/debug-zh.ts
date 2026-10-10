/**
 * 看一个词的中文候选从哪来、为什么对上或没对上（调试用）：
 *   node scripts/data/run-ts.mjs scripts/data/fr/debug-zh.ts drap vitre
 */
import { frKey } from '../../../src/shared/lang/fr/rules'
import { loadEnWikt } from './wikt-en'
import { loadCedict, loadCfdict, loadZhWikt } from './zh-sources'
import { loadPivot } from './pivot'
import { pivotFits } from './align'

const enw = await loadEnWikt()
const cedict = await loadCedict()
const cf = await loadCfdict()
const zw = await loadZhWikt(cedict.t2s)
const pv = await loadPivot()
for (const w of process.argv.slice(2)) {
  const k = frKey(w)
  for (const d of enw.drafts.filter((x) => x.k === k)) {
    console.log(
      `== ${d.w} [${d.p}${d.g ? ' ' + d.g : ''}] senses: ${d.senses.map((s) => s.en[0]).join(' ‖ ')}`
    )
    console.log('   zhwikt:', JSON.stringify(zw.filter((z) => z.k === k)))
    console.log('   cfdict:', JSON.stringify(cf[k]?.slice(0, 8)))
    const ps = pv.filter((p) => p.fr.some(([x]) => frKey(x) === k))
    for (const p of ps.slice(0, 8))
      console.log(
        `   pivot ${p.e}/${p.p} "${p.s}" fits=${pivotFits(p, k, d.p, d.g)} fr=${JSON.stringify(p.fr)} zh=${JSON.stringify(p.zh)}`
      )
  }
}
