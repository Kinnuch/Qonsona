import { afterEach, expect, it } from 'vitest'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { createRequire } from 'node:module'
// @ts-expect-error Executable release tooling is JavaScript.
import {
  checkProductionRenderer,
  checkSpeechResources
} from '../scripts/release/package-policy.mjs'

const asar = createRequire(import.meta.url)('@electron/asar'),
  roots: string[] = []
const temp = (): string => {
  const root = mkdtempSync(join(tmpdir(), 'qonsona-release-policy-'))
  roots.push(root)
  return root
}
afterEach(() => roots.splice(0).forEach((path) => rmSync(path, { recursive: true, force: true })))
const renderer = async (body: string): Promise<string> => {
  const root = temp(),
    archive = join(temp(), 'app.asar')
  mkdirSync(join(root, 'out/renderer/assets'), { recursive: true })
  writeFileSync(join(root, 'out/renderer/assets/main.js'), body)
  await asar.createPackage(root, archive)
  return archive
}
it('allows the fixed HTTPS domain but rejects a bundled dictionary test grant command', async () => {
  const normal = await renderer('const api="https://kinnuch.cn/qon-api/v1";')
  expect(checkProductionRenderer(normal, asar)).toBe(1)
  for (const body of [
    'account.mutate("testGrant",{requestId:crypto.randomUUID()});',
    "account.mutate('testGrant',{});",
    'toast("100 test tickets granted; repeatable in testing");'
  ]) {
    const archive = await renderer(body)
    expect(() => checkProductionRenderer(archive, asar)).toThrow('test ticket command')
  }
})
it('requires both runner scripts and the complete bundled eSpeak data', () => {
  const resources = temp(),
    files = ['runner.mjs', 'neural-runner.mjs', 'espeak/espeak-ng.js', 'espeak/espeak-ng.data']
  mkdirSync(join(resources, 'speech/espeak'), { recursive: true })
  for (const file of files) writeFileSync(join(resources, 'speech', file), 'fixture')
  expect(checkSpeechResources(resources)).toBe(4)
  writeFileSync(join(resources, 'speech/espeak/espeak-ng.data'), '')
  expect(() => checkSpeechResources(resources)).toThrow('Missing/empty speech resource')
})
