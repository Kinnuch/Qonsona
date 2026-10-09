// 千语集 1.0.0-beta.1（41e5354）的 src/renderer/src/lib/core/pasteGenerator.ts，由 scripts/sync-qonlang.mjs 同步，别手改。
import type { SlotGenerator } from './model'
import { newId } from './factory'

/** 贴进来的生成方式：整份拷贝，流水线的每一步换新 id（同一页里不会撞键） */
export function pastedGenerator(g: SlotGenerator): SlotGenerator {
  const c = JSON.parse(JSON.stringify(g)) as SlotGenerator
  if (c.kind === 'pipeline') {
    c.steps = c.steps.map((s) => ({ ...s, id: newId() }))
    if (c.pron) c.pron.steps = c.pron.steps.map((s) => ({ ...s, id: newId() }))
  }
  return c
}
