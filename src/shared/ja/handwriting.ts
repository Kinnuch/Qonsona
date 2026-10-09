/**
 * 手写查字的识别（纯函数，主进程、界面都能用）：用户在画板上一笔一笔写一个字，
 * 跟 KanjiVG 的笔顺数据比，给出最像的几个字。不用机器学习，只比几何形状：
 *
 * 1. 规范化：整个字按外框缩放平移到边长为 1 的方框里（长边撑满、短边居中，长宽比不变，
 *    「一」还是扁的、「丨」还是细的），每一笔按弧长重采样成 P 个点；
 * 2. 粗排：笔数差得不多的字（多写三笔、少写四笔以内）先按「方向特征」排——方框分成 5×5 格，
 *    每格记横、竖、撇、捺四个方向各有多长的笔迹，跟笔顺、笔数都无关；再按这个顺序每笔只取
 *    四个点，做一遍简化的细比，留下前一百个；方向特征的前几十个也留下（笔顺乱了时靠它）；
 * 3. 细比：按笔顺一笔对一笔比，一对的代价是「两笔重心对齐以后对应点的平均距离 + 重心差的四分之一」
 *    （手写时整笔、整个部件挪了点位置很常见，形状比位置要紧）；用动态规划找总代价最小的对法，
 *    容许漏写一笔、多写一笔、两笔连成一笔、一笔断成两笔、相邻两笔顺序写反、一笔方向写反，各有罚分；
 * 4. 不管笔顺再比一遍：细比和方向特征的前几十个字，每一笔找一笔对上（匈牙利算法求总代价最小的
 *    一一对应），按写错顺序的笔数加罚分；两种比法取好的那个。
 *
 * 分数越小越像：大致是「平均每一笔差多少」，方框边长算 1，完全一样是 0
 * （写得比较端正时，对的字多在 0.06 以下，最像的错字多在 0.06～0.1）。
 */

/** 一个点：[x, y]（画板坐标或 KanjiVG 的 109×109 坐标，y 朝下） */
export type Point = [number, number]
/** 一笔：按书写顺序的点 */
export type Stroke = Point[]

export interface Candidate {
  ch: string
  /** 越小越像（见文件开头）；结果按它从小到大排 */
  score: number
}

// ───────────────────────── 参数 ─────────────────────────

/** 每一笔重采样成几个点 */
export const P = 10
/** 粗排时每一笔只取几个点（首、1/3、2/3、尾） */
const Q = 4
/** 坐标存成整数：方框边长是 S（参考数据用 Uint16Array，比 Float32Array 省一半内存） */
const S = 4096
/** 方向特征：方框分成 G×G 格，每格四个方向 */
const G = 5
const FEAT = G * G * 4
/** 最多比多少笔（KanjiVG 里笔画最多的字是 30 笔） */
const MAX_STROKES = 64

/** 识别时的取舍与罚分：距离都按方框边长算 1，是拿 KanjiVG 的笔画加上各种扰动试出来的 */
const COST = {
  /** 比参考字多写几笔以内、少写几笔以内（连笔会少）还比 */
  maxExtra: 3,
  maxMissing: 4,
  /** 粗排留下几个字、方向特征再留下几个字、不管笔顺再比几个字 */
  liteKeep: 100,
  featKeep: 60,
  freeKeep: 40,
  /** 方向特征排序时，笔数差一笔加多少（方向特征的差大约是 0.5～3） */
  countDiff: 0.3,
  /** 一笔整体挪了位置（重心差）算几成 */
  pos: 0.25,
  /** 漏写参考字的一笔：基本罚分 + 按这一笔的长度 */
  miss: 0.12,
  missLen: 0.12,
  /** 多写了一笔 */
  extra: 0.12,
  extraLen: 0.12,
  /** 两笔连成一笔、一笔断成两笔、相邻两笔顺序写反、一笔方向写反 */
  merge: 0.04,
  split: 0.04,
  swap: 0.06,
  reverse: 0.08,
  /** 不管笔顺时，每一笔写错了顺序加多少 */
  disorder: 0.08
}

// ───────────────────────── SVG path → 折线 ─────────────────────────

const TOKEN = /[a-zA-Z]|[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?/g
const isCommand = (t: string): boolean => /^[a-zA-Z]$/.test(t)

/**
 * 一笔的 SVG path 展开成折线（x、y 交替放在一个数组里）：直线只取端点，
 * 贝塞尔曲线按控制多边形的长度切段，每段大约 step 长。
 * 认 M L H V C S Q T Z，大小写都认（小写是相对坐标）；A 弧线按直线算（KanjiVG 里没有）。
 * 数字之间可以不隔开（13.11-1.04、.5.5），KanjiVG 就是这么写的
 */
function pathFlat(d: string, step: number): number[] {
  const tokens = d.match(TOKEN) ?? []
  const out: number[] = []
  let i = 0
  let cmd = ''
  let x = 0
  let y = 0
  let startX = 0
  let startY = 0
  // 上一段曲线的最后一个控制点：S、T 拿它做镜像得到第一个控制点
  let ctrlX = 0
  let ctrlY = 0
  let lastCurve = ''
  const add = (px: number, py: number): void => {
    const k = out.length
    if (k && out[k - 2] === px && out[k - 1] === py) return
    out.push(px, py)
  }
  /** 取 k 个数；不够或者遇到命令字母时返回 null（path 写坏了，到此为止） */
  const take = (k: number): number[] | null => {
    if (i + k > tokens.length) return null
    const a: number[] = []
    for (let j = 0; j < k; j++) {
      const t = tokens[i + j]
      if (isCommand(t)) return null
      a.push(Number(t))
    }
    i += k
    return a
  }
  const segments = (len: number): number => Math.max(1, Math.min(64, Math.ceil(len / step)))
  const cubic = (x1: number, y1: number, x2: number, y2: number, x3: number, y3: number): void => {
    const n = segments(
      Math.hypot(x1 - x, y1 - y) + Math.hypot(x2 - x1, y2 - y1) + Math.hypot(x3 - x2, y3 - y2)
    )
    for (let k = 1; k <= n; k++) {
      const t = k / n
      const u = 1 - t
      const a = u * u * u
      const b = 3 * u * u * t
      const c = 3 * u * t * t
      const e = t * t * t
      add(a * x + b * x1 + c * x2 + e * x3, a * y + b * y1 + c * y2 + e * y3)
    }
    ctrlX = x2
    ctrlY = y2
    lastCurve = 'C'
    x = x3
    y = y3
  }
  const quad = (x1: number, y1: number, x2: number, y2: number): void => {
    const n = segments(Math.hypot(x1 - x, y1 - y) + Math.hypot(x2 - x1, y2 - y1))
    for (let k = 1; k <= n; k++) {
      const t = k / n
      const u = 1 - t
      add(u * u * x + 2 * u * t * x1 + t * t * x2, u * u * y + 2 * u * t * y1 + t * t * y2)
    }
    ctrlX = x1
    ctrlY = y1
    lastCurve = 'Q'
    x = x2
    y = y2
  }
  const line = (x1: number, y1: number): void => {
    add(x1, y1)
    lastCurve = ''
    x = x1
    y = y1
  }

  while (i < tokens.length) {
    if (isCommand(tokens[i])) cmd = tokens[i++]
    else if (!cmd) {
      // 开头就是数字、或者 Z 后面跟着数字：不合法，跳过
      i++
      continue
    }
    const rel = cmd >= 'a'
    const ox = rel ? x : 0
    const oy = rel ? y : 0
    let a: number[] | null = []
    switch (cmd.toUpperCase()) {
      case 'M':
        a = take(2)
        if (!a) break
        x = startX = ox + a[0]
        y = startY = oy + a[1]
        add(x, y)
        lastCurve = ''
        // M 后面接着的坐标对按 L 算
        cmd = rel ? 'l' : 'L'
        break
      case 'L':
        a = take(2)
        if (a) line(ox + a[0], oy + a[1])
        break
      case 'H':
        a = take(1)
        if (a) line(ox + a[0], y)
        break
      case 'V':
        a = take(1)
        if (a) line(x, oy + a[0])
        break
      case 'C':
        a = take(6)
        if (a) cubic(ox + a[0], oy + a[1], ox + a[2], oy + a[3], ox + a[4], oy + a[5])
        break
      case 'S':
        a = take(4)
        if (a)
          cubic(
            lastCurve === 'C' ? 2 * x - ctrlX : x,
            lastCurve === 'C' ? 2 * y - ctrlY : y,
            ox + a[0],
            oy + a[1],
            ox + a[2],
            oy + a[3]
          )
        break
      case 'Q':
        a = take(4)
        if (a) quad(ox + a[0], oy + a[1], ox + a[2], oy + a[3])
        break
      case 'T':
        a = take(2)
        if (a)
          quad(
            lastCurve === 'Q' ? 2 * x - ctrlX : x,
            lastCurve === 'Q' ? 2 * y - ctrlY : y,
            ox + a[0],
            oy + a[1]
          )
        break
      case 'A':
        a = take(7)
        if (a) line(ox + a[5], oy + a[6])
        break
      case 'Z':
        line(startX, startY)
        cmd = ''
        break
      default:
        cmd = ''
    }
    if (!a) break
  }
  return out
}

/** 一笔的 SVG path 展开成折线点：直线只取端点，贝塞尔曲线按段采样（每段大约 step 长） */
export function pathPoints(d: string, step = 2): Point[] {
  const flat = pathFlat(d, step)
  const out: Point[] = []
  for (let k = 0; k < flat.length; k += 2) out.push([flat[k], flat[k + 1]])
  return out
}

// ───────────────────────── 规范化 ─────────────────────────

/** 折线：x、y 交替放在一个数组里 */
type Flat = ArrayLike<number>
type Store = Uint16Array | Float64Array

/**
 * src 的前 n 个点按弧长等距取 count 个（首尾就是原来的首尾），x、y 交替写进 out 的 at 位置起；
 * 整笔长度是 0（只点了一下）时全取第一个点
 */
function resampleInto(
  src: Flat,
  count: number,
  out: Float64Array,
  at: number,
  n = src.length >> 1
): void {
  let total = 0
  for (let k = 1; k < n; k++) {
    const dx = src[2 * k] - src[2 * k - 2]
    const dy = src[2 * k + 1] - src[2 * k - 1]
    total += Math.sqrt(dx * dx + dy * dy)
  }
  if (n < 2 || total === 0 || count < 2) {
    for (let k = 0; k < count; k++) {
      out[at + 2 * k] = n ? src[0] : 0
      out[at + 2 * k + 1] = n ? src[1] : 0
    }
    return
  }
  const gap = total / (count - 1)
  let seg = 1
  let segStart = 0
  let dx = src[2] - src[0]
  let dy = src[3] - src[1]
  let segLen = Math.sqrt(dx * dx + dy * dy)
  for (let k = 0; k < count - 1; k++) {
    const target = gap * k
    while (seg < n - 1 && segStart + segLen < target) {
      segStart += segLen
      seg++
      dx = src[2 * seg] - src[2 * seg - 2]
      dy = src[2 * seg + 1] - src[2 * seg - 1]
      segLen = Math.sqrt(dx * dx + dy * dy)
    }
    const t = segLen > 0 ? Math.min(1, Math.max(0, (target - segStart) / segLen)) : 0
    out[at + 2 * k] = src[2 * seg - 2] + dx * t
    out[at + 2 * k + 1] = src[2 * seg - 1] + dy * t
  }
  out[at + 2 * count - 2] = src[2 * n - 2]
  out[at + 2 * count - 1] = src[2 * n - 1]
}

/** 一笔按弧长重采样成 count 个点（首尾不变，点距相等） */
export function resample(points: readonly Point[], count = P): Point[] {
  const out = new Float64Array(count * 2)
  resampleInto(points.flat(), count, out, 0)
  const pts: Point[] = []
  for (let k = 0; k < count; k++) pts.push([out[2 * k], out[2 * k + 1]])
  return pts
}

/** 外框换算：x' = (x - cx) * scale + 方框边长 / 2，y 同理 */
interface Box {
  cx: number
  cy: number
  scale: number
}

/** 整个字的外框换算到边长 size 的方框里：长边撑满，短边居中 */
function boxOf(strokes: readonly Flat[], size: number): Box {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const s of strokes)
    for (let k = 0; k < s.length; k += 2) {
      if (s[k] < minX) minX = s[k]
      if (s[k] > maxX) maxX = s[k]
      if (s[k + 1] < minY) minY = s[k + 1]
      if (s[k + 1] > maxY) maxY = s[k + 1]
    }
  const side = Math.max(maxX - minX, maxY - minY)
  // 只点了一下（外框是一个点）时不缩放，放在正中
  return { cx: (minX + maxX) / 2, cy: (minY + maxY) / 2, scale: side > 0 ? size / side : 1 }
}

/**
 * 整个字按外框缩放平移到 [0, 1] 的方框里：长边撑满，短边居中，长宽比不变
 * （「一」规范化以后还是一条横线，不会被拉成方的）
 */
export function normalize(strokes: readonly Stroke[]): Stroke[] {
  const { cx, cy, scale } = boxOf(
    strokes.map((s) => s.flat()),
    1
  )
  return strokes.map((s) =>
    s.map(([x, y]): Point => [(x - cx) * scale + 0.5, (y - cy) * scale + 0.5])
  )
}

// ───────────────────────── 特征 ─────────────────────────

/**
 * 一个字（参考字或用户写的字）规范化、重采样以后的样子。坐标乘过 S、取整，
 * 第 s 笔的点从 s * 2P（Q 个点的从 s * 2Q）起
 */
interface Shapes {
  /** 每一笔 P 个点 */
  pts: Store
  /** 第 s 笔跟第 s + 1 笔连成一笔的样子（连笔、断笔时比这个），也是 P 个点；最后一笔那格空着 */
  joined: Store
  /** 同上，粗排用的 Q 个点 */
  ptsQ: Store
  joinedQ: Store
  /** 每一笔的长度（方框边长算 1） */
  len: Float32Array | Float64Array
  /** 每一笔、每个连笔的重心（x、y，乘过 S） */
  cen: Float32Array | Float64Array
  cenJ: Float32Array | Float64Array
}

/** 重采样、连笔用的临时数组（规范化一个字时反复用，不每笔都开新的） */
interface Scratch {
  pts: Float64Array
  join: Float64Array
}

const scratch = (): Scratch => ({
  pts: new Float64Array(2 * Math.max(P, Q)),
  join: new Float64Array(512)
})

/** src 的前 n 个点按弧长重采样成 count 个点，换算到方框里、取整，写进 out 的第 s 笔 */
function putStroke(
  src: Flat,
  n: number,
  count: number,
  box: Box,
  out: Store,
  s: number,
  tmp: Float64Array
): void {
  resampleInto(src, count, tmp, 0, n)
  for (let k = 0; k < 2 * count; k += 2) {
    out[s * 2 * count + k] = Math.round((tmp[k] - box.cx) * box.scale + S / 2)
    out[s * 2 * count + k + 1] = Math.round((tmp[k + 1] - box.cy) * box.scale + S / 2)
  }
}

/** 第 s 笔（P 个点）的长度与重心 */
function measure(pts: Store, s: number, len: Shapes['len'] | null, cen: Shapes['cen']): void {
  let l = 0
  let x = 0
  let y = 0
  for (let k = s * 2 * P; k < (s + 1) * 2 * P; k += 2) {
    x += pts[k]
    y += pts[k + 1]
    if (k > s * 2 * P) {
      const dx = pts[k] - pts[k - 2]
      const dy = pts[k + 1] - pts[k - 1]
      l += Math.sqrt(dx * dx + dy * dy)
    }
  }
  if (len) len[s] = l / S
  cen[2 * s] = x / P
  cen[2 * s + 1] = y / P
}

/**
 * 一个字的笔画（原来坐标的折线）按外框换算到方框里、重采样，从第 s0 笔起写进 out。
 * 先重采样再换算（只是缩放平移，等弧长取的点不变），不用为每一笔再开一个数组
 */
function packStrokes(strokes: readonly Flat[], out: Shapes, s0: number, tmp: Scratch): void {
  const box = boxOf(strokes, S)
  for (let s = 0; s < strokes.length; s++) {
    const at = s0 + s
    const a = strokes[s]
    putStroke(a, a.length >> 1, P, box, out.pts, at, tmp.pts)
    putStroke(a, a.length >> 1, Q, box, out.ptsQ, at, tmp.pts)
    measure(out.pts, at, out.len, out.cen)
    if (s + 1 < strokes.length) {
      // 连笔：这一笔接着下一笔，中间空中走的那一段也算进去
      const b = strokes[s + 1]
      const n = a.length + b.length
      if (tmp.join.length < n) tmp.join = new Float64Array(2 * n)
      tmp.join.set(a, 0)
      tmp.join.set(b, a.length)
      putStroke(tmp.join, n >> 1, P, box, out.joined, at, tmp.pts)
      putStroke(tmp.join, n >> 1, Q, box, out.joinedQ, at, tmp.pts)
      measure(out.joined, at, null, out.cenJ)
    }
  }
}

/**
 * 方向特征：每一段笔迹按中点落在哪一格（双线性分给相邻四格）、朝哪个方向
 * （横 0°、捺 45°、竖 90°、撇 135°，夹在中间的按角度分给两边），把长度加进去。
 * pts 里从第 s0 笔起的 count 笔，写进 out 的 o 位置起
 */
function featureInto(
  pts: Store,
  s0: number,
  count: number,
  out: Float32Array | Float64Array,
  o: number
): void {
  for (let s = s0; s < s0 + count; s++) {
    const base = s * 2 * P
    for (let k = 1; k < P; k++) {
      const x0 = pts[base + 2 * k - 2] / S
      const y0 = pts[base + 2 * k - 1] / S
      const dx = pts[base + 2 * k] / S - x0
      const dy = pts[base + 2 * k + 1] / S - y0
      const len = Math.sqrt(dx * dx + dy * dy)
      if (len === 0) continue
      // 方向：0～4（不分正反，0 和 4 是同一个方向）
      let ang = Math.atan2(dy, dx)
      if (ang < 0) ang += Math.PI
      const db = (ang / Math.PI) * 4
      const d0 = Math.floor(db) % 4
      const d1 = (d0 + 1) % 4
      const wd = db - Math.floor(db)
      // 位置：按格子中心算
      const gx = (x0 + dx / 2) * G - 0.5
      const gy = (y0 + dy / 2) * G - 0.5
      const fx0 = Math.floor(gx)
      const fy0 = Math.floor(gy)
      const wx = gx - fx0
      const wy = gy - fy0
      for (let cy = 0; cy < 2; cy++) {
        const yy = Math.min(G - 1, Math.max(0, fy0 + cy))
        const wyy = cy ? wy : 1 - wy
        for (let cx = 0; cx < 2; cx++) {
          const xx = Math.min(G - 1, Math.max(0, fx0 + cx))
          const w = len * wyy * (cx ? wx : 1 - wx)
          const cell = o + (yy * G + xx) * 4
          out[cell + d0] += w * (1 - wd)
          out[cell + d1] += w * wd
        }
      }
    }
  }
}

// ───────────────────────── 参考数据 ─────────────────────────

export interface RefIndex extends Shapes {
  /** 字；下标是字的编号 */
  chars: string[]
  /** 第 c 个字的笔画是第 first[c] 笔到第 first[c + 1] - 1 笔（所有字的笔画连着编号） */
  first: Uint32Array
  pts: Uint16Array
  joined: Uint16Array
  ptsQ: Uint16Array
  joinedQ: Uint16Array
  len: Float32Array
  cen: Float32Array
  cenJ: Float32Array
  /** 每个字的方向特征（粗排用），FEAT 个数一组 */
  feat: Float32Array
  /** 生僻度：0 最常用，1 最生僻（按 RefRow.rank 算，没给时 1） */
  rarity: Float32Array
  /**
   * 常用字往前排的力度：结果按「分数 + commonBias × 生僻度」排，分数差在 commonBias 以内时
   * 常用的可以排到前面；0（默认）时只在同分时看常用度
   */
  commonBias: number
}

export interface RefRow {
  ch: string
  /** KanjiVG 的笔画（SVG path），按笔顺 */
  paths: string[]
  /** 常用度排名（1 最常用，比如报纸用字的频度排名）；没有时算最生僻 */
  rank?: number | null
}

/** 常用度排名换成生僻度（0～1）：按对数，排名 1 是 0，RANK_MAX 以后是 1 */
const RANK_MAX = 6000
const rarityOf = (rank: number | null | undefined): number =>
  rank && rank > 0 ? Math.min(1, Math.log(rank) / Math.log(RANK_MAX)) : 1

/**
 * 从 KanjiVG 的笔画建参考数据（没有笔画、有一笔解析不出来的字跳过）。
 * 数组按 path 的条数一次开好，再一个字一个字地解析、规范化、重采样，不留中间结果
 */
export function buildRefs(rows: readonly RefRow[]): RefIndex {
  const total = rows.reduce((n, r) => n + r.paths.length, 0)
  const refs: RefIndex = {
    chars: [],
    first: new Uint32Array(rows.length + 1),
    pts: new Uint16Array(total * 2 * P),
    joined: new Uint16Array(total * 2 * P),
    ptsQ: new Uint16Array(total * 2 * Q),
    joinedQ: new Uint16Array(total * 2 * Q),
    len: new Float32Array(total),
    cen: new Float32Array(total * 2),
    cenJ: new Float32Array(total * 2),
    feat: new Float32Array(rows.length * FEAT),
    rarity: new Float32Array(rows.length),
    commonBias: 0
  }
  const tmp = scratch()
  let s0 = 0
  for (const r of rows) {
    const strokes = r.paths.map((d) => pathFlat(d, 2))
    if (!strokes.length || strokes.some((s) => !s.length)) continue
    const c = refs.chars.length
    refs.chars.push(r.ch)
    refs.first[c] = s0
    packStrokes(strokes, refs, s0, tmp)
    featureInto(refs.pts, s0, strokes.length, refs.feat, c * FEAT)
    refs.rarity[c] = rarityOf(r.rank)
    s0 += strokes.length
  }
  const chars = refs.chars.length
  refs.first[chars] = s0
  // 有跳过的字时数组开大了，截掉多的
  if (chars < rows.length) {
    refs.first = refs.first.slice(0, chars + 1)
    refs.pts = refs.pts.slice(0, s0 * 2 * P)
    refs.joined = refs.joined.slice(0, s0 * 2 * P)
    refs.ptsQ = refs.ptsQ.slice(0, s0 * 2 * Q)
    refs.joinedQ = refs.joinedQ.slice(0, s0 * 2 * Q)
    refs.len = refs.len.slice(0, s0)
    refs.cen = refs.cen.slice(0, 2 * s0)
    refs.cenJ = refs.cenJ.slice(0, 2 * s0)
    refs.feat = refs.feat.slice(0, chars * FEAT)
    refs.rarity = refs.rarity.slice(0, chars)
  }
  return refs
}

// ───────────────────────── 细比 ─────────────────────────

/** 用户写的字整理成跟参考数据一样的形状 */
interface Query extends Shapes {
  n: number
  feat: Float64Array
}

function prepare(strokes: readonly Stroke[]): Query {
  const flat = strokes.map((s) => s.flat())
  const n = flat.length
  const q: Query = {
    n,
    pts: new Float64Array(n * 2 * P),
    joined: new Float64Array(n * 2 * P),
    ptsQ: new Float64Array(n * 2 * Q),
    joinedQ: new Float64Array(n * 2 * Q),
    len: new Float64Array(n),
    cen: new Float64Array(n * 2),
    cenJ: new Float64Array(n * 2),
    feat: new Float64Array(FEAT)
  }
  packStrokes(flat, q, 0, scratch())
  featureInto(q.pts, 0, n, q.feat, 0)
  return q
}

/**
 * 两笔的差：a 从 ai 起、b 从 bi 起各 np 个点，rev 时 b 倒过来比；(dx0, dy0) 是两笔的重心差。
 * 重心对齐以后对应点的平均距离，加上重心差的 pos 成，换算成方框边长算 1
 */
function dist(
  a: Store,
  ai: number,
  b: Store,
  bi: number,
  np: number,
  rev: boolean,
  dx0: number,
  dy0: number
): number {
  let s = 0
  if (!rev)
    for (let k = 0; k < 2 * np; k += 2) {
      const dx = a[ai + k] - b[bi + k] - dx0
      const dy = a[ai + k + 1] - b[bi + k + 1] - dy0
      s += Math.sqrt(dx * dx + dy * dy)
    }
  else
    for (let k = 0; k < 2 * np; k += 2) {
      const r = bi + 2 * np - 2 - k
      const dx = a[ai + k] - b[r] - dx0
      const dy = a[ai + k + 1] - b[r + 1] - dy0
      s += Math.sqrt(dx * dx + dy * dy)
    }
  return (s / np + COST.pos * Math.sqrt(dx0 * dx0 + dy0 * dy0)) / S
}

/**
 * 按笔顺比：用户写的 n 笔跟第 c 个字的 m 笔对上，返回总代价除以 (n + m) / 2；
 * 算到一半已经确定超过 limit 时提前放弃，返回 Infinity。
 * D[i][j] 是用户的前 i 笔对参考字前 j 笔的最小代价，M[i][j] 是第 i 笔对第 j 笔的代价（用到才算）。
 * lite（粗排）时每笔只比 Q 个点、不试方向写反、只看对角线附近窄一些的带子
 */
function orderedScore(
  q: Query,
  refs: RefIndex,
  c: number,
  limit: number,
  D: Float64Array,
  M: Float64Array,
  lite: boolean
): number {
  const n = q.n
  const s0 = refs.first[c]
  const m = refs.first[c + 1] - s0
  const norm = (n + m) / 2
  const W = m + 1
  const np = lite ? Q : P
  const qa = lite ? q.ptsQ : q.pts
  const qj = lite ? q.joinedQ : q.joined
  const ra = lite ? refs.ptsQ : refs.pts
  const rj = lite ? refs.joinedQ : refs.joined
  const st = 2 * np
  const rev = lite ? Infinity : COST.reverse
  // 只算对角线附近：i - j 在 [lo, hi] 里
  const band = lite ? 1 : 2
  const lo = Math.min(0, n - m) - band
  const hi = Math.max(0, n - m) + band
  D.fill(Infinity, 0, (n + 1) * W)
  D[0] = 0
  for (let i = 0; i <= n; i++) {
    if (i > 0) {
      // 第 i - 1 笔对各笔的代价（方向写反也试一下），比带子宽一格，交换顺序时要用
      const r = i - 1
      const j0 = Math.max(0, r - hi - 1)
      const j1 = Math.min(m - 1, r - lo + 1)
      for (let j = j0; j <= j1; j++) {
        const dx0 = q.cen[2 * r] - refs.cen[2 * (s0 + j)]
        const dy0 = q.cen[2 * r + 1] - refs.cen[2 * (s0 + j) + 1]
        const f = dist(qa, r * st, ra, (s0 + j) * st, np, false, dx0, dy0)
        M[r * MAX_STROKES + j] =
          f <= rev ? f : Math.min(f, dist(qa, r * st, ra, (s0 + j) * st, np, true, dx0, dy0) + rev)
      }
    }
    let rowMin = i === 0 ? 0 : Infinity
    const j0 = Math.max(0, i - hi)
    const j1 = Math.min(m, i - lo)
    for (let j = j0; j <= j1; j++) {
      if (i === 0 && j === 0) continue
      const at = i * W + j
      let best = Infinity
      if (i > 0) {
        // 多写了一笔
        best = D[at - W] + COST.extra + COST.extraLen * q.len[i - 1]
        if (j > 0) {
          const v = D[at - W - 1] + M[(i - 1) * MAX_STROKES + j - 1]
          if (v < best) best = v
        }
        if (j > 1 && D[at - W - 2] + COST.merge < best) {
          // 参考字的两笔连成了一笔
          const r = s0 + j - 2
          const dx0 = q.cen[2 * i - 2] - refs.cenJ[2 * r]
          const dy0 = q.cen[2 * i - 1] - refs.cenJ[2 * r + 1]
          const v =
            D[at - W - 2] +
            1.5 * dist(qa, (i - 1) * st, rj, r * st, np, false, dx0, dy0) +
            COST.merge
          if (v < best) best = v
        }
        if (i > 1 && j > 0 && D[at - 2 * W - 1] + COST.split < best) {
          // 参考字的一笔断成了两笔
          const r = s0 + j - 1
          const dx0 = q.cenJ[2 * i - 4] - refs.cen[2 * r]
          const dy0 = q.cenJ[2 * i - 3] - refs.cen[2 * r + 1]
          const v =
            D[at - 2 * W - 1] +
            1.5 * dist(qj, (i - 2) * st, ra, r * st, np, false, dx0, dy0) +
            COST.split
          if (v < best) best = v
        }
        if (i > 1 && j > 1) {
          // 相邻两笔顺序写反
          const v =
            D[at - 2 * W - 2] +
            M[(i - 2) * MAX_STROKES + j - 1] +
            M[(i - 1) * MAX_STROKES + j - 2] +
            COST.swap
          if (v < best) best = v
        }
      }
      if (j > 0) {
        // 漏写了参考字的一笔
        const v = D[at - 1] + COST.miss + COST.missLen * refs.len[s0 + j - 1]
        if (v < best) best = v
      }
      D[at] = best
      if (best < rowMin) rowMin = best
    }
    // 代价只增不减：这一行最小的已经超了，后面不用算
    if (rowMin / norm > limit) return Infinity
  }
  return D[n * W + m] / norm
}

/** 匈牙利算法用的数组（按最大的规模一次开好） */
interface Hungarian {
  cost: Float64Array
  /** 这一格是真的一对一（不是「两笔都没对上」） */
  real: Uint8Array
  u: Float64Array
  v: Float64Array
  p: Int32Array
  way: Int32Array
  minv: Float64Array
  used: Uint8Array
}

const hungarian = (size: number): Hungarian => ({
  cost: new Float64Array(size * size),
  real: new Uint8Array(size * size),
  u: new Float64Array(size + 1),
  v: new Float64Array(size + 1),
  p: new Int32Array(size + 1),
  way: new Int32Array(size + 1),
  minv: new Float64Array(size + 1),
  used: new Uint8Array(size + 1)
})

/**
 * 方阵 cost（N×N，按行存）的最小代价一一对应（带势的 O(N³) 写法）；
 * 返回总代价，h.p[j] 是第 j 列（从 1 数）对上的行（从 1 数）
 */
function assign(h: Hungarian, N: number): number {
  const { cost, u, v, p, way, minv, used } = h
  u.fill(0, 0, N + 1)
  v.fill(0, 0, N + 1)
  p.fill(0, 0, N + 1)
  for (let i = 1; i <= N; i++) {
    p[0] = i
    let j0 = 0
    minv.fill(Infinity, 0, N + 1)
    used.fill(0, 0, N + 1)
    do {
      used[j0] = 1
      const i0 = p[j0]
      let delta = Infinity
      let j1 = 0
      for (let j = 1; j <= N; j++) {
        if (used[j]) continue
        const cur = cost[(i0 - 1) * N + j - 1] - u[i0] - v[j]
        if (cur < minv[j]) {
          minv[j] = cur
          way[j] = j0
        }
        if (minv[j] < delta) {
          delta = minv[j]
          j1 = j
        }
      }
      for (let j = 0; j <= N; j++)
        if (used[j]) {
          u[p[j]] += delta
          v[j] -= delta
        } else minv[j] -= delta
      j0 = j1
    } while (p[j0] !== 0)
    do {
      const j1 = way[j0]
      p[j0] = p[j1]
      j0 = j1
    } while (j0)
  }
  return -v[0]
}

/**
 * 不管笔顺的比法：每一笔找一笔对上（总代价最小的一一对应，对不上的按漏写、多写罚），
 * 再按写错顺序的笔数加罚分：对上的笔按用户写的顺序排，参考字笔顺里最长的递增子列以外的算写错。
 * 隔得远的两笔写反了顺序、整个部件先写后写时靠它；连笔、断笔这里不管
 */
function freeScore(q: Query, refs: RefIndex, c: number, h: Hungarian): number {
  const n = q.n
  const s0 = refs.first[c]
  const m = refs.first[c + 1] - s0
  // 方阵 N×N：一对一的代价最多算到「这一笔多写了 + 那一笔漏写了」（再大就当两笔都没对上）；
  // 笔数不一样时补上的空行是「漏写」、空列是「多写」
  const N = Math.max(n, m)
  for (let i = 0; i < N; i++)
    for (let j = 0; j < N; j++) {
      const extra = i < n ? COST.extra + COST.extraLen * q.len[i] : 0
      const miss = j < m ? COST.miss + COST.missLen * refs.len[s0 + j] : 0
      let v = extra + miss
      let real = 0
      if (i < n && j < m) {
        const dx0 = q.cen[2 * i] - refs.cen[2 * (s0 + j)]
        const dy0 = q.cen[2 * i + 1] - refs.cen[2 * (s0 + j) + 1]
        const a = i * 2 * P
        const b = (s0 + j) * 2 * P
        let d = dist(q.pts, a, refs.pts, b, P, false, dx0, dy0)
        if (d > COST.reverse)
          d = Math.min(d, dist(q.pts, a, refs.pts, b, P, true, dx0, dy0) + COST.reverse)
        if (d < v) {
          v = d
          real = 1
        }
      }
      h.cost[i * N + j] = v
      h.real[i * N + j] = real
    }
  let total = assign(h, N)
  // 对上的笔按用户的笔顺排，数参考字的笔顺乱了几笔（最长递增子列以外的）
  const refOf: number[] = []
  for (let j = 1; j <= N; j++) {
    const i = h.p[j] - 1
    if (h.real[i * N + j - 1]) refOf[i] = j - 1
  }
  const seq = refOf.filter((x) => x !== undefined)
  const tails: number[] = []
  for (const x of seq) {
    let lo = 0
    let hi = tails.length
    while (lo < hi) {
      const mid = (lo + hi) >> 1
      if (tails[mid] < x) lo = mid + 1
      else hi = mid
    }
    tails[lo] = x
  }
  total += COST.disorder * (seq.length - tails.length)
  return total / ((n + m) / 2)
}

// ───────────────────────── 识别 ─────────────────────────

/** 留下分数最小的 k 个：大根堆，堆顶是目前的第 k 名（满了以后比它差的不用再算） */
class Keep {
  ids: Int32Array
  sc: Float64Array
  size = 0
  k: number
  constructor(k: number) {
    this.k = k
    this.ids = new Int32Array(k)
    this.sc = new Float64Array(k)
  }
  /** 目前的第 k 名；还没满时是 Infinity */
  get limit(): number {
    return this.size < this.k ? Infinity : this.sc[0]
  }
  push(id: number, s: number): void {
    const { ids, sc } = this
    let i: number
    if (this.size < this.k) {
      // 放在最后，往上浮
      i = this.size++
      while (i > 0) {
        const p = (i - 1) >> 1
        if (sc[p] >= s) break
        ids[i] = ids[p]
        sc[i] = sc[p]
        i = p
      }
    } else {
      if (s >= sc[0]) return
      // 换掉堆顶，往下沉
      i = 0
      for (;;) {
        const l = 2 * i + 1
        if (l >= this.size) break
        const r = l + 1
        const c = r < this.size && sc[r] > sc[l] ? r : l
        if (sc[c] <= s) break
        ids[i] = ids[c]
        sc[i] = sc[c]
        i = c
      }
    }
    ids[i] = id
    sc[i] = s
  }
  /** 留下的 [下标, 分数]，按分数从小到大 */
  sorted(): [number, number][] {
    const out: [number, number][] = []
    for (let i = 0; i < this.size; i++) out.push([this.ids[i], this.sc[i]])
    return out.sort((a, b) => a[1] - b[1])
  }
}

/**
 * 识别：input 是用户写的若干笔（画板坐标，点数、点距随意），返回最像的 n 个字。
 * 分数越小越像（见文件开头），按「分数 + 常用度微调」从小到大排（见 RefIndex.commonBias），
 * 同分时常用的在前
 */
export function recognize(input: readonly Stroke[], refs: RefIndex, n = 20): Candidate[] {
  const strokes = input
    .map((s) => s.filter((p) => Number.isFinite(p[0]) && Number.isFinite(p[1])))
    .filter((s) => s.length > 0)
  const total = refs.chars.length
  if (!strokes.length || strokes.length > MAX_STROKES || !total || n <= 0) return []
  const q = prepare(strokes)
  const D = new Float64Array((MAX_STROKES + 1) * (MAX_STROKES + 1))
  const M = new Float64Array(MAX_STROKES * MAX_STROKES)
  const bias = (c: number): number => refs.commonBias * refs.rarity[c]

  // 粗排：笔数差得不多的字先按方向特征排好，再按这个顺序每笔只看 Q 个点按笔顺比一遍，
  // 留下前 liteKeep 个（比到一半已经确定比第 liteKeep 名差的就不往下比了）
  const feat = new Float64Array(total)
  const ids: number[] = []
  for (let c = 0; c < total; c++) {
    const m = refs.first[c + 1] - refs.first[c]
    if (q.n - m > COST.maxExtra || m - q.n > COST.maxMissing || m > MAX_STROKES) continue
    ids.push(c)
    let s = 0
    const o = c * FEAT
    for (let k = 0; k < FEAT; k++) s += Math.abs(q.feat[k] - refs.feat[o + k])
    feat[c] = s + COST.countDiff * Math.abs(q.n - m)
  }
  ids.sort((a, b) => feat[a] - feat[b])
  const lite = new Keep(COST.liteKeep)
  for (const c of ids) {
    const s = orderedScore(q, refs, c, lite.limit, D, M, true)
    if (s < lite.limit) lite.push(c, s)
  }
  const short = new Set([...lite.sorted().map(([c]) => c), ...ids.slice(0, COST.featKeep)])

  // 细比：按笔顺比，已经比第 keep 名差的中途放弃
  const fine = new Keep(Math.max(n, COST.freeKeep))
  for (const c of short) {
    const s = orderedScore(q, refs, c, fine.limit - bias(c), D, M, false)
    if (Number.isFinite(s)) fine.push(c, s + bias(c))
  }
  const score = new Map(fine.sorted())

  // 不管笔顺再比一遍：细比和方向特征的前几名，两种比法取好的
  const h = hungarian(q.n + COST.maxMissing)
  for (const c of new Set(
    [...score.keys()].slice(0, COST.freeKeep).concat(ids.slice(0, COST.freeKeep))
  )) {
    const s = freeScore(q, refs, c, h) + bias(c)
    if (s < (score.get(c) ?? Infinity)) score.set(c, s)
  }
  return [...score]
    .sort((a, b) => a[1] - b[1] || refs.rarity[a[0]] - refs.rarity[b[0]] || a[0] - b[0])
    .slice(0, n)
    .map(([c, s]) => ({ ch: refs.chars[c], score: s }))
}
