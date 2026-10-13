import { readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

export function binaryArch(file, platform) {
  const data = readFileSync(file)
  if (platform === 'win32') {
    if (data.toString('ascii', 0, 2) !== 'MZ') throw new Error(`Not PE: ${file}`)
    const header = data.readUInt32LE(0x3c)
    if (data.toString('ascii', header, header + 4) !== 'PE\0\0')
      throw new Error(`Invalid PE: ${file}`)
    return { 0x8664: 'x64', 0xaa64: 'arm64' }[data.readUInt16LE(header + 4)]
  }
  if (platform === 'darwin') {
    if (data.readUInt32LE(0) !== 0xfeedfacf) throw new Error(`Not 64-bit Mach-O: ${file}`)
    return { 0x01000007: 'x64', 0x0100000c: 'arm64' }[data.readUInt32LE(4)]
  }
  if (platform === 'linux') {
    if (
      data.length < 20 ||
      data.toString('ascii', 0, 4) !== '\x7fELF' ||
      data[4] !== 2 ||
      data[5] !== 1
    )
      throw new Error(`Not 64-bit little-endian ELF: ${file}`)
    return { 62: 'x64', 183: 'arm64' }[data.readUInt16LE(18)]
  }
  throw new Error(`Unsupported release platform ${platform}`)
}

export function checkNeuralPackage(
  resources,
  asar,
  platform = process.platform,
  arch = process.arch
) {
  const archive = join(resources, 'app.asar')
  const metadata = JSON.parse(
    asar.extractFile(archive, join('node_modules', 'onnxruntime-node', 'package.json'))
  )
  if (metadata.version !== '1.21.0') throw new Error('Missing pinned ONNX Runtime 1.21.0')
  const nodeRoot = join('node_modules', 'onnxruntime-node')
  // 手动打包保留父依赖的嵌套解析；electron-builder 也可能将同版本提升到顶层。
  const commonRoot = [
    join(nodeRoot, 'node_modules', 'onnxruntime-common'),
    join('node_modules', 'onnxruntime-common')
  ].find((candidate) => {
    try {
      return asar.statFile(archive, join(candidate, 'package.json')).size > 0
    } catch {
      return false
    }
  })
  if (!commonRoot) throw new Error('Missing ONNX Runtime common dependency')
  const common = JSON.parse(asar.extractFile(archive, join(commonRoot, 'package.json')))
  if (common.version !== '1.21.0') throw new Error('ONNX Runtime common version mismatch')
  for (const entry of [
    join(nodeRoot, 'dist', 'index.js'),
    join(commonRoot, 'dist', 'cjs', 'index.js')
  ]) {
    if (
      !asar.statFile(archive, entry).unpacked ||
      !statSync(join(resources, 'app.asar.unpacked', entry)).size
    )
      throw new Error(`Runtime API must be unpacked: ${entry}`)
  }
  const folder = join('node_modules', 'onnxruntime-node', 'bin', 'napi-v3', platform, arch)
  const files =
    platform === 'win32'
      ? ['onnxruntime_binding.node', 'onnxruntime.dll', 'DirectML.dll']
      : platform === 'darwin'
        ? ['onnxruntime_binding.node', 'libonnxruntime.1.21.0.dylib']
        : platform === 'linux'
          ? [
              'onnxruntime_binding.node',
              'libonnxruntime.so.1',
              'libonnxruntime.so.1.21.0',
              ...(arch === 'x64' ? ['libonnxruntime_providers_shared.so'] : [])
            ]
          : (() => {
              throw new Error(`Unsupported release platform ${platform}`)
            })()
  for (const file of files) {
    const entry = join(folder, file)
    const absolute = join(resources, 'app.asar.unpacked', entry)
    if (!asar.statFile(archive, entry).unpacked || !statSync(absolute).size)
      throw new Error(`Native runtime must be unpacked: ${entry}`)
    if (binaryArch(absolute, platform) !== arch)
      throw new Error(`Native architecture mismatch: ${entry}`)
  }
  return { platform, arch, version: metadata.version, nativeFiles: files.length }
}
