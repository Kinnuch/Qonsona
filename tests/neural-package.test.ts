import { describe, it, expect, afterEach } from 'vitest'
import { mkdirSync, mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { createRequire } from 'node:module'
// @ts-expect-error Executable release tooling is JavaScript.
import {
  copyRuntimeDependencies,
  NATIVE_ASAR_OPTIONS
} from '../scripts/release/runtime-dependencies.mjs'
// @ts-expect-error Executable release tooling is JavaScript.
import { binaryArch, checkNeuralPackage } from '../scripts/release/neural-package.mjs'

const asar = createRequire(import.meta.url)('@electron/asar')
const roots: string[] = []
const temp = (): string => {
  const root = mkdtempSync(join(tmpdir(), 'qonsona-native-package-'))
  roots.push(root)
  return root
}
afterEach(() => roots.splice(0).forEach((path) => rmSync(path, { recursive: true, force: true })))
const write = (root: string, path: string, data: string | Buffer): void => {
  const parts = path.split('/')
  mkdirSync(join(root, ...parts.slice(0, -1)), { recursive: true })
  writeFileSync(join(root, ...parts), data)
}
const pkg = (root: string, name: string, version: string, dependencies = {}): void => {
  write(root, 'package.json', JSON.stringify({ name, version, main: 'index.js', dependencies }))
  write(root, 'index.js', 'module.exports = {}')
}
const pe = (arch: 'x64' | 'arm64'): Buffer => {
  const data = Buffer.alloc(256)
  data.write('MZ')
  data.writeUInt32LE(128, 0x3c)
  data.write('PE\0\0', 128)
  data.writeUInt16LE(arch === 'x64' ? 0x8664 : 0xaa64, 132)
  return data
}
const fixture = (root: string, nested = false): void => {
  pkg(join(root, 'node_modules/onnxruntime-node'), 'onnxruntime-node', '1.21.0')
  write(root, 'node_modules/onnxruntime-node/dist/index.js', 'module.exports = {}')
  const commonRoot = nested
    ? 'node_modules/onnxruntime-node/node_modules/onnxruntime-common'
    : 'node_modules/onnxruntime-common'
  pkg(join(root, commonRoot), 'onnxruntime-common', '1.21.0')
  write(root, commonRoot + '/dist/cjs/index.js', 'module.exports = {}')
  for (const file of ['onnxruntime_binding.node', 'onnxruntime.dll', 'DirectML.dll'])
    write(root, `node_modules/onnxruntime-node/bin/napi-v3/win32/x64/${file}`, pe('x64'))
}

describe('neural release packaging', () => {
  it('validates the common API at its real nested Node resolution path', async () => {
    const source = temp(),
      resources = temp()
    fixture(source, true)
    await asar.createPackageWithOptions(source, join(resources, 'app.asar'), NATIVE_ASAR_OPTIONS)
    expect(checkNeuralPackage(resources, asar, 'win32', 'x64').version).toBe('1.21.0')
  })
  it('preserves conflicting nested dependency versions and skips missing optional packages', () => {
    const source = temp(),
      target = temp()
    pkg(source, 'fixture', '1', { a: '1', b: '1' })
    pkg(join(source, 'node_modules/a'), 'a', '1', { shared: '1' })
    pkg(join(source, 'node_modules/b'), 'b', '1', { shared: '2' })
    pkg(join(source, 'node_modules/shared'), 'shared', '1')
    pkg(join(source, 'node_modules/b/node_modules/shared'), 'shared', '2')
    const a = join(source, 'node_modules/a/package.json')
    const metadata = JSON.parse(readFileSync(a, 'utf8'))
    metadata.optionalDependencies = { unavailable: '*' }
    writeFileSync(a, JSON.stringify(metadata))
    const graph = copyRuntimeDependencies(source, target)
    expect(
      graph
        .filter((item: { name: string }) => item.name === 'shared')
        .map((item: { version: string }) => item.version)
    ).toEqual(['1', '2'])
    expect(
      JSON.parse(
        readFileSync(join(target, 'node_modules/b/node_modules/shared/package.json'), 'utf8')
      ).version
    ).toBe('2')
  })
  it('puts the entire native package and common API outside ASAR and validates actual binary architecture', async () => {
    const source = temp(),
      resources = temp()
    fixture(source)
    await asar.createPackageWithOptions(source, join(resources, 'app.asar'), NATIVE_ASAR_OPTIONS)
    expect(checkNeuralPackage(resources, asar, 'win32', 'x64')).toMatchObject({
      arch: 'x64',
      version: '1.21.0',
      nativeFiles: 3
    })
    const binding = join(
      resources,
      'app.asar.unpacked/node_modules/onnxruntime-node/bin/napi-v3/win32/x64/onnxruntime_binding.node'
    )
    writeFileSync(binding, pe('arm64'))
    expect(() => checkNeuralPackage(resources, asar, 'win32', 'x64')).toThrow(
      'architecture mismatch'
    )
  })
  it('rejects a package that leaves native files in ASAR or loses a sibling DLL', async () => {
    const source = temp(),
      packed = temp(),
      unpacked = temp()
    fixture(source)
    await asar.createPackage(source, join(packed, 'app.asar'))
    expect(() => checkNeuralPackage(packed, asar, 'win32', 'x64')).toThrow('must be unpacked')
    await asar.createPackageWithOptions(source, join(unpacked, 'app.asar'), NATIVE_ASAR_OPTIONS)
    rmSync(
      join(
        unpacked,
        'app.asar.unpacked/node_modules/onnxruntime-node/bin/napi-v3/win32/x64/onnxruntime.dll'
      )
    )
    expect(() => checkNeuralPackage(unpacked, asar, 'win32', 'x64')).toThrow()
  })
  it('recognizes both shipped macOS Mach-O architectures and rejects malformed binaries', () => {
    const root = temp()
    for (const [name, cpu] of [
      ['x64', 0x01000007],
      ['arm64', 0x0100000c]
    ] as const) {
      const body = Buffer.alloc(32)
      body.writeUInt32LE(0xfeedfacf, 0)
      body.writeUInt32LE(cpu, 4)
      const file = join(root, name)
      writeFileSync(file, body)
      expect(binaryArch(file, 'darwin')).toBe(name)
    }
    const broken = join(root, 'invalid')
    writeFileSync(broken, Buffer.alloc(32))
    expect(() => binaryArch(broken, 'darwin')).toThrow('Mach-O')
  })
})
