/** Own-app CLI probe: ELECTRON_RUN_AS_NODE=1 <Electron> this-file <app-root> [arch]. */
import { createRequire } from 'node:module'
import { resolve, join } from 'node:path'
import { readFileSync } from 'node:fs'

const appRoot = resolve(process.argv[2] || '.')
const root = appRoot.endsWith('.asar') ? `${appRoot}.unpacked` : appRoot
const expectedArch = process.argv[3] || process.arch
if (expectedArch !== process.arch)
  throw new Error(`Expected ${expectedArch}; running ${process.arch}`)
if (!process.versions.electron && process.env.ALLOW_NODE_RUNTIME_PROBE !== '1')
  throw new Error('Run this probe with the target Electron executable and ELECTRON_RUN_AS_NODE=1')
const require = createRequire(join(root, 'package.json'))
const ort = require('onnxruntime-node')
const metadata = JSON.parse(readFileSync(require.resolve('onnxruntime-node/package.json'), 'utf8'))
if (metadata.version !== '1.21.0' || ort.env.versions.node !== metadata.version)
  throw new Error('ONNX Runtime pin mismatch')

// Tiny protobuf Identity(float[1]) model: local fixture, no downloads or speech weights.
const variable = (value) => {
  const result = []
  do {
    const next = value & 127
    value >>>= 7
    result.push(next | (value ? 128 : 0))
  } while (value)
  return Buffer.from(result)
}
const integer = (field, value) => Buffer.concat([variable(field * 8), variable(value)])
const bytes = (field, value) => {
  const body = typeof value === 'string' ? Buffer.from(value) : value
  return Buffer.concat([variable(field * 8 + 2), variable(body.length), body])
}
const message = (...fields) => Buffer.concat(fields)
const valueInfo = (name) =>
  message(
    bytes(1, name),
    bytes(2, bytes(1, message(integer(1, 1), bytes(2, bytes(1, integer(1, 1))))))
  )
const graph = message(
  bytes(1, message(bytes(1, 'input'), bytes(2, 'output'), bytes(4, 'Identity'))),
  bytes(2, 'qonsona-runtime-smoke'),
  bytes(11, valueInfo('input')),
  bytes(12, valueInfo('output'))
)
const model = message(integer(1, 8), bytes(7, graph), bytes(8, integer(2, 13)))
const session = await ort.InferenceSession.create(model, { executionProviders: ['cpu'] })
try {
  const result = await session.run({ input: new ort.Tensor('float32', new Float32Array([7]), [1]) })
  if (result.output.data[0] !== 7) throw new Error('CPU Identity inference failed')
  console.log(
    JSON.stringify({
      ok: true,
      electron: process.versions.electron || null,
      platform: process.platform,
      arch: process.arch,
      runtime: metadata.version,
      inputNames: session.inputNames,
      outputNames: session.outputNames,
      cpuInference: true
    })
  )
} finally {
  await session.release()
}
