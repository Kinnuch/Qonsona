/**
 * 法语的规则：查词的键、切词、猜原形……（纯函数；数据管线写 form 表、主进程查词都用这一份）。
 * 这是框架先放的占位，由负责法语的分支改写。
 */
import { defaultKey, stripMarks } from '../text'
import type { LangRules } from '../types'

export const rules: LangRules = {
  key: (text) => defaultKey(text, 'fr'),
  looseKey: (text) => stripMarks(defaultKey(text, 'fr'))
}
