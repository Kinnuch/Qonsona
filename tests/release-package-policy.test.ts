import { afterEach, expect, it } from 'vitest'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
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

it('publishes explicit Linux x64 names that match release globs despite builder architecture aliases', () => {
  const require = createRequire(import.meta.url)
  const { load } = require('js-yaml')
  const { Arch, getArtifactArchName } = require('builder-util')
  const { expandMacro } = require('app-builder-lib/out/util/macroExpander')
  const config = load(readFileSync(new URL('../electron-builder.yml', import.meta.url), 'utf8'))
  const workflow = load(
    readFileSync(new URL('../.github/workflows/release.yml', import.meta.url), 'utf8')
  )
  const version = JSON.parse(
    readFileSync(new URL('../package.json', import.meta.url), 'utf8')
  ).version
  const files: string[] = workflow.jobs.build.strategy.matrix.include
    .find((platform: { artifact: string }) => platform.artifact === 'linux')
    .files.trim()
    .split(/\s+/)
  expect(config.linux.target).toEqual([
    { target: 'AppImage', arch: ['x64'] },
    { target: 'deb', arch: ['x64'] }
  ])
  expect(config.linux.artifactName).not.toContain('${arch}')
  for (const [extension, alias] of [
    ['AppImage', 'x86_64'],
    ['deb', 'amd64']
  ]) {
    const actualBuilderArch = getArtifactArchName(Arch.x64, extension)
    expect(actualBuilderArch).toBe(alias)
    const filename = expandMacro(
      config.linux.artifactName,
      actualBuilderArch,
      { version },
      {
        ext: extension
      }
    )
    expect(filename).toBe(`Qonsona-${version}-linux-x64.${extension}`)
    const glob = files.find((pattern) => pattern.endsWith(`.${extension}`))
    expect(glob).toBe(`dist/*-linux-x64.${extension}`)
    const expression = new RegExp(
      `^${glob!.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replaceAll('*', '.*')}$`
    )
    expect(`dist/${filename}`).toMatch(expression)
    // The original macro creates a real builder filename the release glob cannot discover.
    const previous = expandMacro(
      'Qonsona-${version}-linux-${arch}.${ext}',
      actualBuilderArch,
      {
        version
      },
      { ext: extension }
    )
    expect(`dist/${previous}`).not.toMatch(expression)
  }
})

it('Linux repair builds an existing tag and cannot overwrite Windows/macOS assets or retag the release', () => {
  const { load } = createRequire(import.meta.url)('js-yaml')
  const workflow = load(
    readFileSync(new URL('../.github/workflows/release-linux-repair.yml', import.meta.url), 'utf8')
  )
  expect(Object.keys(workflow.on)).toEqual(['workflow_dispatch'])
  expect(workflow.on.workflow_dispatch.inputs.release_tag).toMatchObject({
    required: true,
    default: 'v0.4.0'
  })
  const steps = workflow.jobs.linux.steps
  const checkout = steps.find((step: { uses?: string }) => step.uses === 'actions/checkout@v4')
  expect(checkout.with.ref).toBe('${{ inputs.release_tag }}')
  expect(workflow.jobs.linux.env.RELEASE_TAG).toBe('${{ inputs.release_tag }}')
  const build = steps.find(
    (step: { name?: string }) =>
      step.name === 'Build original Linux source with stable x64 asset names'
  )
  expect(build.run).toContain("--config.linux.artifactName='Qonsona-${version}-linux-x64.${ext}'")
  expect(build.run).toContain('--linux --x64')
  const release = steps.find(
    (step: { uses?: string }) => step.uses === 'softprops/action-gh-release@v2'
  )
  expect(release.with.tag_name).toBe('${{ inputs.release_tag }}')
  expect(release.with.files.trim().split(/\s+/)).toEqual([
    'dist/*-linux-x64.AppImage',
    'dist/*-linux-x64.deb'
  ])
  expect(release.with.overwrite_files).toBe(false)
  expect(release.with.fail_on_unmatched_files).toBe(true)
  expect(release.with).not.toHaveProperty('target_commitish')
  const guardIndex = steps.findIndex((step: { id?: string }) => step.id === 'guard')
  const recheckIndex = steps.findIndex(
    (step: { name?: string }) =>
      step.name === 'Recheck existing release and protected assets before upload'
  )
  const releaseIndex = steps.indexOf(release)
  expect(guardIndex).toBeGreaterThan(0)
  expect(recheckIndex).toBeGreaterThan(guardIndex)
  expect(releaseIndex).toBeGreaterThan(recheckIndex)
  expect(steps[guardIndex].run).toContain('7af7ceae20a24d8327266e4dd5ba32d7b87a8cf6')
  expect(steps[guardIndex].run).toContain('411811580')
  for (const index of [guardIndex, recheckIndex]) {
    expect(steps[index].run).toContain('tag !== `v${version}`')
    expect(steps[index].run).toContain('/releases/tags/${tag}')
    expect(steps[index].run).toContain('release.draft || release.prerelease')
  }
  for (const step of steps.filter((step: { run?: string }) => step.run)) {
    expect(step.run).not.toContain('${{ inputs.release_tag }}')
    expect(step.run).not.toMatch(/git\s+(?:tag|push|update-ref)\b/)
  }
})
