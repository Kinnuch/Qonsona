/**
 * 手写查字：SVG path 展开、规范化、识别。有 dict.sqlite 时拿 KanjiVG 的笔画加上「像手写」的扰动
 * 当输入，量准确率和耗时（设环境变量 HANDWRITING_REPORT=1、加 --silent=false 会打印各种扰动下的结果）。
 */
import { existsSync } from 'fs'
import { resolve } from 'path'
import { DatabaseSync } from 'node:sqlite'
import { inflateRawSync } from 'node:zlib'
import { beforeAll, describe, expect, it } from 'vitest'
import { rng } from '../src/shared/course'
import {
  buildRefs,
  normalize,
  pathPoints,
  recognize,
  resample,
  type Point,
  type Stroke
} from '../src/shared/ja/handwriting'
import { HandwritingIndex } from '../src/main/handwriting'

const close = (a: Point, b: Point, eps = 1e-6): boolean =>
  Math.abs(a[0] - b[0]) < eps && Math.abs(a[1] - b[1]) < eps

/** 两组笔画的点一一相等（浮点误差以内） */
const expectNear = (a: Stroke[], b: Stroke[]): void => {
  expect(a.length).toBe(b.length)
  a.forEach((s, i) => {
    expect(s.length).toBe(b[i].length)
    s.forEach((p, j) => expect(close(p, b[i][j], 1e-9)).toBe(true))
  })
}

describe('笔画 path 展开成折线', () => {
  it('直线：绝对坐标、相对坐标', () => {
    expect(pathPoints('M10,20L30,40')).toEqual([
      [10, 20],
      [30, 40]
    ])
    expect(pathPoints('m10,20l5,0l0,5')).toEqual([
      [10, 20],
      [15, 20],
      [15, 25]
    ])
  })

  it('M 后面接着的坐标对按直线算；H、V、Z', () => {
    expect(pathPoints('M0,0 10,0 10,10')).toEqual([
      [0, 0],
      [10, 0],
      [10, 10]
    ])
    expect(pathPoints('M0,0H10V10h-5v-5z')).toEqual([
      [0, 0],
      [10, 0],
      [10, 10],
      [5, 10],
      [5, 5],
      [0, 0]
    ])
  })

  it('数字之间不隔开也认（KanjiVG 就这么写）', () => {
    expect(pathPoints('M1-2l3-4')).toEqual([
      [1, -2],
      [4, -6]
    ])
    expect(pathPoints('M.5.5l1.5.5')).toEqual([
      [0.5, 0.5],
      [2, 1]
    ])
  })

  it('三次贝塞尔曲线：首尾是端点，中间按段采样，点都在曲线上', () => {
    const pts = pathPoints('M0,0C0,10,10,10,10,0')
    expect(pts.length).toBeGreaterThan(5)
    expect(pts[0]).toEqual([0, 0])
    expect(close(pts.at(-1)!, [10, 0])).toBe(true)
    // 这条曲线是 x = 10t²(3 - 2t)、y = 30t(1 - t)，最高 7.5（t = 0.5）
    for (const [x, y] of pts) {
      const t = (() => {
        let lo = 0
        let hi = 1
        for (let k = 0; k < 60; k++) {
          const mid = (lo + hi) / 2
          if (10 * mid * mid * (3 - 2 * mid) < x) lo = mid
          else hi = mid
        }
        return lo
      })()
      expect(y).toBeCloseTo(30 * t * (1 - t), 6)
    }
    expect(Math.max(...pts.map((p) => p[1]))).toBeGreaterThan(7.4)
    // 采样得密一些，段就短一些
    expect(pathPoints('M0,0C0,10,10,10,10,0', 0.5).length).toBeGreaterThan(pts.length)
  })

  it('相对坐标的曲线跟绝对坐标的一样；S 的第一个控制点是上一段的镜像', () => {
    expect(pathPoints('M10,10c0,10,10,10,10,0')).toEqual(pathPoints('M10,10C10,20,20,20,20,10'))
    const s = pathPoints('M0,0C0,10,10,10,10,0S20,-10,20,0')
    const c = pathPoints('M0,0C0,10,10,10,10,0C10,-10,20,-10,20,0')
    expect(s.length).toBe(c.length)
    s.forEach((p, i) => expect(close(p, c[i])).toBe(true))
    expect(Math.min(...s.map((p) => p[1]))).toBeLessThan(-7.4)
    const rel = pathPoints('M0,0c0,10,10,10,10,0s10,-10,10,0')
    rel.forEach((p, i) => expect(close(p, c[i])).toBe(true))
  })

  it('二次曲线 Q、T', () => {
    const q = pathPoints('M0,0Q5,10,10,0T20,0')
    expect(q[0]).toEqual([0, 0])
    expect(close(q.at(-1)!, [20, 0])).toBe(true)
    // T 的控制点是 (15, -10)：后半段在下面
    expect(Math.max(...q.map((p) => p[1]))).toBeCloseTo(5, 0)
    expect(Math.min(...q.map((p) => p[1]))).toBeCloseTo(-5, 0)
  })

  it('KanjiVG 的一笔（「一」）', () => {
    const pts = pathPoints(
      'M11,54.25c3.19,0.62,6.25,0.75,9.73,0.5c20.64-1.5,50.39-5.12,68.58-5.24c3.6-0.02,5.77,0.24,7.57,0.49'
    )
    expect(pts[0]).toEqual([11, 54.25])
    expect(close(pts.at(-1)!, [96.88, 50], 1e-9)).toBe(true)
    for (const [, y] of pts) expect(y > 48 && y < 56).toBe(true)
  })

  it('写坏的 path 不出错', () => {
    expect(pathPoints('')).toEqual([])
    expect(pathPoints('M10')).toEqual([])
    expect(pathPoints('garbage')).toEqual([])
    expect(pathPoints('M0,0L10')).toEqual([[0, 0]])
  })
})

describe('规范化', () => {
  it('一笔重采样：点数固定、首尾不变、点距相等', () => {
    const pts = resample(
      [
        [0, 0],
        [1, 0],
        [1.5, 0],
        [10, 0],
        [10, 3],
        [10, 10]
      ],
      11
    )
    expect(pts.length).toBe(11)
    expect(pts[0]).toEqual([0, 0])
    expect(pts[10]).toEqual([10, 10])
    // 总长 20，十段，每段 2
    for (let k = 1; k < 11; k++)
      expect(Math.hypot(pts[k][0] - pts[k - 1][0], pts[k][1] - pts[k - 1][1])).toBeCloseTo(2, 9)
    expect(resample([[3, 4]], 5)).toEqual(Array(5).fill([3, 4]))
  })

  it('整个字按外框缩放到方框里，长宽比不变：「一」还是扁的、「丨」还是细的', () => {
    const one = normalize([
      [
        [100, 300],
        [500, 310]
      ]
    ])
    expectNear(one, [
      [
        [0, 0.4875],
        [1, 0.5125]
      ]
    ])
    const bar = normalize([
      [
        [40, 10],
        [42, 210]
      ]
    ])
    expectNear(bar, [
      [
        [0.495, 0],
        [0.505, 1]
      ]
    ])
    // 两笔一起算外框：十
    const ten = normalize([
      [
        [0, 50],
        [100, 50]
      ],
      [
        [50, 0],
        [50, 100]
      ]
    ])
    expectNear(ten, [
      [
        [0, 0.5],
        [1, 0.5]
      ],
      [
        [0.5, 0],
        [0.5, 1]
      ]
    ])
  })

  it('只点了一下：放在正中', () => {
    expect(normalize([[[7, 9]]])).toEqual([[[0.5, 0.5]]])
  })
})

describe('识别（几个简单的字）', () => {
  // 用直线、曲线自己画的几个字，坐标跟 KanjiVG 一样是 109 格
  const refs = buildRefs([
    { ch: '一', paths: ['M10,55L95,52'] },
    { ch: '丨', paths: ['M54,10L54,95'] },
    { ch: '二', paths: ['M25,35L80,33', 'M12,75L95,72'] },
    { ch: '三', paths: ['M22,25L85,23', 'M28,52L80,50', 'M12,85L95,82'] },
    { ch: '十', paths: ['M10,45L95,43', 'M53,10L53,98'] },
    { ch: '口', paths: ['M22,25L24,85', 'M24,27L85,25L83,85', 'M24,83L83,82'] },
    { ch: '日', paths: ['M30,12L31,96', 'M31,14L78,13L77,96', 'M32,54L76,53', 'M32,93L76,92'] },
    { ch: '人', paths: ['M52,12C52,45,40,72,12,92', 'M48,50C60,66,75,82,95,92'] },
    { ch: '入', paths: ['M55,40C50,60,35,80,12,92', 'M35,15C50,20,65,70,95,92'] }
  ])
  /** 照 109 格的坐标写，放大到画板上：一笔写成 '22,25 24,85'，折线上每段再取几个点（点距不匀） */
  const draw = (...strokes: string[]): Stroke[] =>
    strokes.map((text) => {
      const s = text.split(' ').map((p) => p.split(',').map(Number))
      const out: Point[] = []
      for (let k = 1; k < s.length; k++)
        for (let t = 0; t < 1; t += 0.25 + 0.2 * (k % 2))
          out.push([
            200 + 3 * (s[k - 1][0] + (s[k][0] - s[k - 1][0]) * t),
            100 + 3 * (s[k - 1][1] + (s[k][1] - s[k - 1][1]) * t)
          ])
      out.push([200 + 3 * s[s.length - 1][0], 100 + 3 * s[s.length - 1][1]])
      return out
    })
  const top = (...strokes: string[]): string => recognize(draw(...strokes), refs, 3)[0]?.ch ?? ''

  it('照着写认得出来；结果按分数从小到大排、最多 n 个', () => {
    expect(top('12,50 94,54')).toBe('一')
    expect(top('50,8 52,90')).toBe('丨')
    expect(top('20,30 85,30', '10,70 95,75')).toBe('二')
    const res = recognize(draw('10,45 95,43', '53,10 53,98'), refs, 4)
    expect(res.length).toBe(4)
    expect(res[0].ch).toBe('十')
    expect(res[0].score).toBeLessThan(0.02)
    for (let i = 1; i < res.length; i++)
      expect(res[i].score).toBeGreaterThanOrEqual(res[i - 1].score)
  })

  it('「一」「丨」不会被拉成方的，两个分得开', () => {
    const one = recognize(draw('10,50 95,56'), refs, 9)
    expect(one[0].ch).toBe('一')
    expect(one.find((r) => r.ch === '丨')!.score).toBeGreaterThan(one[0].score + 0.1)
  })

  it('笔顺写反、方向写反、一笔断成两笔、两笔连成一笔', () => {
    // 十：先写竖
    expect(top('53,10 53,98', '10,45 95,43')).toBe('十')
    // 二：下面一横从右往左写
    expect(top('25,35 80,33', '95,72 12,75')).toBe('二')
    // 口：第二笔「横折」分成一横、一竖两笔写
    expect(top('22,25 24,85', '24,27 85,25', '85,25 83,85', '24,83 83,82')).toBe('口')
    // 三：后两横连成一笔
    expect(top('22,25 85,23', '28,52 80,50 12,85 95,82')).toBe('三')
    // 日：中间一横第一个写（挪了两笔，按笔顺对不上，靠不管笔顺的比法）
    expect(top('32,54 76,53', '30,12 31,96', '31,14 78,13 77,96', '32,93 76,92')).toBe('日')
  })

  it('人、入分得开', () => {
    expect(top('52,12 45,55 12,92', '48,50 70,76 95,92')).toBe('人')
    expect(top('55,40 40,72 12,92', '35,15 62,55 95,92')).toBe('入')
  })

  it('没写、点了一下、坏点都不出错', () => {
    expect(recognize([], refs)).toEqual([])
    expect(recognize([[]], refs)).toEqual([])
    expect(recognize(draw('12,50 94,54'), refs, 0)).toEqual([])
    expect(recognize([[[100, 100]]], refs, 3).length).toBe(3)
    const bad: Stroke = [
      [NaN, 1],
      [236, 250],
      [Infinity, 2],
      [482, 262]
    ]
    expect(recognize([bad], refs, 1)[0].ch).toBe('一')
  })
})

// ───────────────────────── 拿 KanjiVG 的全部汉字量 ─────────────────────────

/** 「像手写」的扰动 */
interface Shake {
  /** 轻微旋转的最大角度（度） */
  rot: number
  /** 每个点抖动多少（字大小的几成，正态分布的标准差） */
  jitter: number
  /** 每笔首尾各截掉最多几成 */
  trim: number
  /** 横竖各自再拉伸、斜切多少（0.1 是 ±10%） */
  aniso?: number
  shear?: number
  /** 整个字平滑地扭一扭、每笔各自挪一点（字大小的几成） */
  warp?: number
  shift?: number
  /** 笔顺、笔数写错的概率：相邻两笔写反、两笔连成一笔、最长的一笔断成两笔、一笔方向写反 */
  swap?: number
  merge?: number
  split?: number
  reverse?: number
}

const SHAKES: Record<string, Shake> = {
  /** 题目要求的：整体缩放平移、轻微旋转、每个点抖动、首尾截短、点距不均匀 */
  normal: { rot: 5, jitter: 0.008, trim: 0.06 },
  /** 更大的扰动：再加上横竖拉伸、斜切、整个字扭一扭、每笔挪一点 */
  larger: { rot: 12, jitter: 0.015, trim: 0.15, aniso: 0.2, shear: 0.15, warp: 0.06, shift: 0.04 },
  /** 中等的扰动加上笔顺、笔数写错 */
  order: {
    rot: 8,
    jitter: 0.012,
    trim: 0.1,
    aniso: 0.1,
    shear: 0.08,
    warp: 0.03,
    shift: 0.02,
    swap: 0.3,
    merge: 0.3,
    split: 0.2,
    reverse: 0.2
  },
  /** 很大的扰动（只记结果，要求放得很宽） */
  extreme: { rot: 20, jitter: 0.025, trim: 0.25, aniso: 0.3, shear: 0.25, warp: 0.12, shift: 0.08 }
}

const gauss = (rand: () => number): number =>
  Math.sqrt(-2 * Math.log(1 - rand())) * Math.cos(2 * Math.PI * rand())

/** 折线加密，每段不超过 step */
function densify(pts: Point[], step: number): Point[] {
  const out: Point[] = [pts[0]]
  for (let k = 1; k < pts.length; k++) {
    const [x0, y0] = pts[k - 1]
    const [x1, y1] = pts[k]
    const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) / step))
    for (let j = 1; j <= n; j++) out.push([x0 + ((x1 - x0) * j) / n, y0 + ((y1 - y0) * j) / n])
  }
  return out
}

/** 折线上到每个点为止的弧长 */
function arcs(pts: Point[]): number[] {
  const out = [0]
  for (let k = 1; k < pts.length; k++)
    out.push(out[k - 1] + Math.hypot(pts[k][0] - pts[k - 1][0], pts[k][1] - pts[k - 1][1]))
  return out
}

/** 折线上弧长 s 处的点 */
function along(pts: Point[], cum: number[], s: number): Point {
  let k = 1
  while (k < pts.length - 1 && cum[k] < s) k++
  if (pts.length < 2) return pts[0]
  const seg = cum[k] - cum[k - 1]
  const t = seg > 0 ? Math.min(1, Math.max(0, (s - cum[k - 1]) / seg)) : 0
  return [
    pts[k - 1][0] + (pts[k][0] - pts[k - 1][0]) * t,
    pts[k - 1][1] + (pts[k][1] - pts[k - 1][1]) * t
  ]
}

/** 参考字的笔画照着「写」一遍：放到画板上（200～400 像素见方），按 o 加扰动 */
function scribble(paths: string[], rand: () => number, o: Shake): Stroke[] {
  const sym = (a = 0): number => (rand() * 2 - 1) * a
  const strokes = paths.map((d) => densify(pathPoints(d), 0.5))
  if (strokes.length > 1 && rand() < (o.merge ?? 0)) {
    const k = Math.floor(rand() * (strokes.length - 1))
    strokes.splice(k, 2, [...strokes[k], ...strokes[k + 1]])
  }
  if (rand() < (o.split ?? 0)) {
    const lens = strokes.map((s) => arcs(s).at(-1)!)
    const k = lens.indexOf(Math.max(...lens))
    const mid = Math.floor(strokes[k].length / 2)
    strokes.splice(k, 1, strokes[k].slice(0, mid + 1), strokes[k].slice(mid))
  }
  if (strokes.length > 1 && rand() < (o.swap ?? 0)) {
    const k = Math.floor(rand() * (strokes.length - 1))
    ;[strokes[k], strokes[k + 1]] = [strokes[k + 1], strokes[k]]
  }
  if (rand() < (o.reverse ?? 0)) {
    const k = Math.floor(rand() * strokes.length)
    strokes[k] = [...strokes[k]].reverse()
  }
  const size = 200 + rand() * 200
  const scale = size / 109
  const th = (sym(o.rot) * Math.PI) / 180
  const cos = Math.cos(th)
  const sin = Math.sin(th)
  const ax = 1 + sym(o.aniso)
  const ay = 1 + sym(o.aniso)
  const sh = sym(o.shear)
  const left = 30 + rand() * 100
  const topY = 30 + rand() * 100
  // 平滑的扭曲：x、y 各一个斜着的正弦波
  const wave = [0, 1].map(() => ({ f: 0.5 + rand(), g: sym(1), ph: rand() * 2 * Math.PI }))
  const amp = (o.warp ?? 0) * 109
  return strokes.map((s) => {
    const cum = arcs(s)
    const len = cum.at(-1)!
    const from = rand() * o.trim * len
    const to = len - rand() * o.trim * len
    const dx = sym(o.shift) * 109
    const dy = sym(o.shift) * 109
    const out: Point[] = []
    for (let at = from; ;) {
      const [x0, y0] = along(s, cum, Math.min(at, to))
      const u = x0 / 109
      const v = y0 / 109
      const x = x0 + dx + amp * Math.sin(2 * Math.PI * (wave[0].f * u + wave[0].g * v) + wave[0].ph)
      const y = y0 + dy + amp * Math.sin(2 * Math.PI * (wave[1].f * v + wave[1].g * u) + wave[1].ph)
      const X = (x - 54.5) * ax + (y - 54.5) * sh
      const Y = (y - 54.5) * ay
      out.push([
        (X * cos - Y * sin) * scale + left + size / 2 + gauss(rand) * o.jitter * size,
        (X * sin + Y * cos) * scale + topY + size / 2 + gauss(rand) * o.jitter * size
      ])
      if (at >= to) break
      // 鼠标报上来的点相隔 1～9 像素，有快有慢
      at += (1 + rand() * 8) / scale
    }
    return out
  })
}

// 词典数据库要先跑 node scripts/data/build-ja.mjs 生成（不入库）；没有时跳过
const DB = resolve(__dirname, '../resources/data/ja/dict.sqlite')
const run = existsSync(DB) ? describe : describe.skip

run('手写识别（词典里的全部汉字）', () => {
  const index = new HandwritingIndex(DB)
  /** 报纸用字频度前 1500 的字，每隔 10 个取一个：150 个常用字 */
  let common: { ch: string; paths: string[] }[] = []
  /** 所有字的笔画 */
  const paths = new Map<string, string[]>()
  const results: Record<string, { top1: number; top5: number; ms: number }> = {}

  beforeAll(() => {
    const db = new DatabaseSync(DB, { readOnly: true })
    const rows = db.prepare('SELECT ch, data, strokes FROM kanji WHERE strokes IS NOT NULL').all()
    db.close()
    const all = rows.map((r) => ({
      ch: String(r.ch),
      fr: (JSON.parse(String(r.data)) as { fr?: number | null }).fr ?? null,
      paths: JSON.parse(inflateRawSync(r.strokes as Uint8Array).toString()) as string[]
    }))
    for (const r of all) paths.set(r.ch, r.paths)
    common = all
      .filter((r) => r.fr !== null && r.fr <= 1500)
      .sort((a, b) => a.fr! - b.fr!)
      .filter((_, i) => i % 10 === 0)
  })

  /** 每个字按 shake 写一遍去识别：第一名、前五名里有正确答案的比例，平均每次识别几毫秒 */
  const measure = (name: string, seed: number): { top1: number; top5: number; ms: number } => {
    const rand = rng(seed)
    let top1 = 0
    let top5 = 0
    let ms = 0
    for (const k of common) {
      const input = scribble(k.paths, rand, SHAKES[name])
      const t = performance.now()
      const res = index.recognize(input, 20)
      ms += performance.now() - t
      const at = res.findIndex((r) => r.ch === k.ch)
      if (at === 0) top1++
      if (at >= 0 && at < 5) top5++
    }
    const n = common.length
    return (results[name] = { top1: top1 / n, top5: top5 / n, ms: ms / n })
  }

  it('第一次识别时才读笔画、建参考数据', () => {
    expect(common.length).toBe(150)
    expect(index.stats).toBeNull()
    expect(index.recognize(scribble(common[0].paths, rng(1), SHAKES.normal), 5)[0].ch).toBe(
      common[0].ch
    )
    const s = index.stats!
    expect(s.chars).toBeGreaterThan(6000)
    expect(s.strokes).toBeGreaterThan(70000)
    // 目标一两秒内；测试里放宽
    expect(s.readMs + s.buildMs).toBeLessThan(5000)
    expect(s.bytes).toBeLessThan(32 * 1024 * 1024)
  })

  it('常用字照着笔画加上手写的扰动：前五名 ≥ 90%，第一名 ≥ 75%', () => {
    const r = measure('normal', 20261008)
    expect(r.top5).toBeGreaterThanOrEqual(0.9)
    expect(r.top1).toBeGreaterThanOrEqual(0.75)
  }, 60_000)

  it('更大的扰动、笔顺笔数写错时也大多认得出', () => {
    const larger = measure('larger', 7)
    expect(larger.top5).toBeGreaterThanOrEqual(0.9)
    expect(larger.top1).toBeGreaterThanOrEqual(0.8)
    const order = measure('order', 8)
    expect(order.top5).toBeGreaterThanOrEqual(0.9)
    expect(order.top1).toBeGreaterThanOrEqual(0.8)
    const extreme = measure('extreme', 9)
    expect(extreme.top5).toBeGreaterThanOrEqual(0.7)
  }, 120_000)

  it('识别一次的耗时（参考数据建好以后）：目标 50 ms 以内，测试里放宽', () => {
    const r = results.normal ?? measure('normal', 20261008)
    expect(r.ms).toBeLessThan(150)
    if (process.env.HANDWRITING_REPORT) {
      const pct = (x: number): string => `${(x * 100).toFixed(1)}%`
      const s = index.stats!
      console.log(
        `参考数据：${s.chars} 字 ${s.strokes} 笔，读 ${s.readMs} ms + 建 ${s.buildMs} ms，` +
          `${(s.bytes / 1048576).toFixed(1)} MB`
      )
      for (const [name, x] of Object.entries(results))
        console.log(
          `${name}: 第一名 ${pct(x.top1)}，前五名 ${pct(x.top5)}，平均 ${x.ms.toFixed(1)} ms`
        )
    }
  })

  it('形状差不多时常用字在前（preferCommon）', () => {
    const input = scribble(paths.get('口')!, rng(3), SHAKES.normal)
    const names = (): string[] => index.recognize(input, 5).map((r) => r.ch)
    index.preferCommon()
    expect(names()[0]).toBe('口')
    // 不偏向常用字时，口、囗 这类一样的形状只看分数
    index.preferCommon(0)
    expect(names()).toContain('口')
    index.preferCommon()
  })
})
