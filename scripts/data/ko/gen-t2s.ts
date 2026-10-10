/**
 * 生成 src/shared/lang/ko/t2s.ts：韩语汉字词里的汉字（繁体、韩国写法）→ 简体，给宽松查词键用
 * （中文用户输入「学校」查得到 學校 = 학교）。
 *
 * 只收词典里真出现的汉字。对照来自 OpenCC 的繁简表（Apache 2.0）与 Unihan 的异体字（Unicode 许可）：
 * 把 kSimplifiedVariant、kTraditionalVariant、kZVariant、kJapaneseNew/OldVariant 连成等价类
 * （kSemanticVariant 太宽，三 与 參 会连到一起，不用），每类取简体的那个字（GB 2312 里有的）当代表；
 * 韩国写法里 Unihan 没连上的几个（靑、淸……）手工补上。同一类里的字都收进表（用户输入的是哪个都能对上）。
 *   node scripts/data/run-ts.mjs scripts/data/ko/gen-t2s.ts
 */
import { unzipSync } from 'fflate'
import { readFileSync, writeFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { join } from 'node:path'
import { cacheDir } from '../../lang/lexdb-writer'
import { readKrdict } from './krdict'

const cache = cacheDir('ko')

/**
 * 韩国通行的字形 → 中国大陆的字形（Unihan 的异体字里没给、或者只算「意义相同」的）。
 * 畓、媤、垈、欌这些韩国自造的字没有对应，不收
 */
const KS_VARIANTS: Record<string, string> = {
  靑: '青',
  淸: '清',
  請: '请',
  靜: '静',
  尙: '尚',
  鬪: '斗',
  窓: '窗',
  氷: '冰',
  汚: '污',
  姙: '妊',
  喩: '喻',
  顚: '颠',
  妬: '妒',
  姉: '姊',
  劒: '剑',
  隣: '邻',
  呑: '吞',
  寃: '冤',
  廻: '回',
  屛: '屏',
  幇: '帮',
  讐: '雠',
  髥: '髯',
  晳: '皙',
  柹: '柿',
  栢: '柏',
  壻: '婿',
  疎: '疏',
  毘: '毗',
  廐: '厩',
  廏: '厩',
  叡: '睿',
  彊: '强',
  粧: '妆',
  菓: '果',
  碁: '棋',
  煖: '暖',
  痺: '痹',
  甦: '苏',
  悤: '匆',
  拏: '拿',
  燐: '磷',
  筩: '筒',
  瑯: '琅',
  楡: '榆',
  茘: '荔',
  搾: '榨',
  簒: '篡',
  楕: '椭',
  悧: '俐',
  暎: '映',
  遯: '遁',
  倣: '仿',
  慂: '恿',
  臙: '胭',
  髣: '仿',
  髴: '佛',
  呪: '咒',
  潟: '泻',
  靭: '韧',
  靷: '韧',
  痲: '麻',
  姸: '妍',
  韈: '袜',
  躙: '躏',
  蹸: '躏',
  慽: '戚',
  醝: '鹾',
  藷: '薯',
  槃: '盘',
  厖: '庞',
  尨: '庞',
  烝: '蒸',
  瑇: '玳',
  畵: '画',
  緖: '绪',
  卽: '即',
  旣: '既',
  槪: '概',
  慨: '慨',
  黃: '黄',
  吳: '吴'
}

// 1. 词典里出现的汉字
const chars = new Set<string>()
const han = /\p{Script=Han}/u
for (const e of readKrdict(join(cache, 'krdict-xml-20260919.zip')))
  for (const c of (e.origin ?? '').normalize('NFC')) if (han.test(c)) chars.add(c)
for (const line of gunzipSync(readFileSync(join(cache, 'kaikki-en-ko.jsonl.gz')))
  .toString('utf8')
  .split('\n')) {
  if (!line.includes('"hanja"')) continue
  const o = JSON.parse(line) as { forms?: { form: string; tags?: string[] }[] }
  for (const f of o.forms ?? [])
    if (f.tags?.includes('hanja'))
      for (const c of f.form.normalize('NFC')) if (han.test(c)) chars.add(c)
}
console.log(`词典里的汉字 ${chars.size} 个`)

// 2. 等价类
const parent = new Map<string, string>()
const find = (x: string): string => {
  let r = x
  while (parent.has(r) && parent.get(r) !== r) r = parent.get(r)!
  parent.set(x, r)
  return r
}
const union = (a: string, b: string): void => {
  const ra = find(a)
  const rb = find(b)
  if (ra !== rb) parent.set(ra, rb)
}
const simplifiedSide = new Set<string>()
for (const line of readFileSync(join(cache, 'opencc-TSCharacters.txt'), 'utf8').split('\n')) {
  if (!line || line.startsWith('#')) continue
  const [t, v] = line.split('\t')
  const s = v?.split(' ')[0]
  if (t && s && [...t].length === 1 && [...s].length === 1) {
    union(t, s)
    simplifiedSide.add(s)
  }
}
const uni = unzipSync(readFileSync(join(cache, 'Unihan.zip')))
const cp = (u: string): string => String.fromCodePoint(parseInt(u.slice(2), 16))
const gb0 = new Set<string>()
for (const line of Buffer.from(uni['Unihan_OtherMappings.txt']).toString('utf8').split('\n')) {
  const [u, field] = line.split('\t')
  if (field === 'kGB0' && u.startsWith('U+')) gb0.add(cp(u))
}
for (const line of Buffer.from(uni['Unihan_Variants.txt']).toString('utf8').split('\n')) {
  if (!line.startsWith('U+')) continue
  const [u, field, value] = line.split('\t')
  const keep =
    field === 'kSimplifiedVariant' ||
    field === 'kTraditionalVariant' ||
    field === 'kZVariant' ||
    field === 'kJapaneseNewVariant' ||
    field === 'kJapaneseOldVariant'
  if (!keep) continue
  for (const v of value.split(' ')) {
    const target = v.split('<')[0]
    if (!target.startsWith('U+')) continue
    union(cp(u), cp(target))
    if (field === 'kSimplifiedVariant') simplifiedSide.add(cp(target))
  }
}

// 韩国写法（KS X 1001 的字形）Unihan 没连上的
for (const [k, c] of Object.entries(KS_VARIANTS)) union(k, c)

// 3. 每类的代表：简体（OpenCC 简体一侧且在 GB 2312 里）优先，其次 GB 2312，其次码位最小
const members = new Map<string, string[]>()
for (const c of parent.keys()) {
  const r = find(c)
  const list = members.get(r) ?? []
  list.push(c)
  members.set(r, list)
}
const rep = new Map<string, string>()
for (const list of members.values()) {
  const score = (c: string): number =>
    (simplifiedSide.has(c) && gb0.has(c) ? 0 : gb0.has(c) ? 1 : simplifiedSide.has(c) ? 2 : 3) *
      1e6 +
    c.codePointAt(0)!
  const best = [...list].sort((a, b) => score(a) - score(b))[0]
  for (const c of list) rep.set(c, best)
}

// 4. 词典里出现过的字所在的类，类里每个字都收
const want = new Set<string>()
for (const c of chars) if (rep.has(c)) for (const m of members.get(find(c)) ?? []) want.add(m)
const pairs: string[] = []
for (const c of [...want].sort()) {
  const s = rep.get(c)
  if (s && s !== c) pairs.push(c + s)
}
console.log(`要转换的 ${pairs.length} 个`)
const odd = [...chars].filter((c) => !gb0.has(c) && (rep.get(c) ?? c) === c)
console.log(`不在 GB 2312、也没对上简体的 ${odd.length} 个：${odd.slice(0, 200).join('')}`)
for (const c of '學國說靑硏値敎眞戶德樂讀經濟') console.log(c, '→', rep.get(c) ?? c)

const out = `/**
 * 韩语汉字（繁体、韩国写法）→ 简体，给宽松查词键用。由 scripts/data/ko/gen-t2s.ts 生成，别手改。
 * 只收한국어기초사전与维基词典的汉字词里出现过的字；对照来自 OpenCC（Apache 2.0）与 Unihan（Unicode 许可）。
 */
const PAIRS =
  ${JSON.stringify(pairs.join(''))}

let map: Map<string, string> | null = null

/** 把汉字换成简体（不是汉字、本来就是简体的不变） */
export function toSimplified(text: string): string {
  if (!/\\p{Script=Han}/u.test(text)) return text
  if (!map) {
    map = new Map()
    const cps = [...PAIRS]
    for (let i = 0; i + 1 < cps.length; i += 2) map.set(cps[i], cps[i + 1])
  }
  let s = ''
  for (const c of text) s += map.get(c) ?? c
  return s
}
`
writeFileSync('src/shared/lang/ko/t2s.ts', out)
console.log('写好 src/shared/lang/ko/t2s.ts')
