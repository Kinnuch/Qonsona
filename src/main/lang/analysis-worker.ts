/** Dictionary/grammar work stays off Electron's event loop. No user-data writes occur here. */
import { parentPort } from 'node:worker_threads'
import { LexDb } from './lexdb'
import { analyzeLex, lexicalLevel } from './analyze'
import type { LangCode } from '../../shared/lang/types'

const dictionaries = new Map<string, LexDb>()
parentPort?.on(
  'message',
  (request: {
    id: number
    code: LangCode
    file: string
    kind: 'analyze' | 'level'
    text: string
  }) => {
    try {
      const key = `${request.code}:${request.file}`
      let db = dictionaries.get(key)
      if (!db) {
        db = new LexDb(request.code, request.file)
        dictionaries.set(key, db)
      }
      const value =
        request.kind === 'level' ? lexicalLevel(db, request.text) : analyzeLex(db, request.text)
      parentPort?.postMessage({ id: request.id, value })
    } catch (error) {
      parentPort?.postMessage({
        id: request.id,
        error: error instanceof Error ? error.message : String(error)
      })
    }
  }
)
