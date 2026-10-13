// SPDX-License-Identifier: GPL-3.0-only
/** Separate offline eSpeak NG process; the engine license and COPYING remain beside this file. */
import { createInterface } from 'node:readline'
import init from './espeak/espeak-ng.js'
const m = await init({ print: () => {}, printErr: () => {} }),
  engine = new m.eSpeakNGWorker()
// Engine-supported voice configuration; vendor data stays unchanged on disk.
for (const profile of ['en', 'fr', 'de'])
  m.FS.writeFile(
    `/usr/share/espeak-ng-data/lang/qonsona-ipa-${profile}`,
    `name Qonsona-IPA-${profile}\nlanguage en\nphonemes ${profile}\n`
  )
const voiceList = engine.list_voices()
const send = (value) => process.stdout.write(JSON.stringify(value) + '\n')
function wave(chunks) {
  const bytes = Buffer.concat(chunks),
    output = Buffer.alloc(44 + bytes.length)
  output.write('RIFF')
  output.writeUInt32LE(36 + bytes.length, 4)
  output.write('WAVEfmt ', 8)
  output.writeUInt32LE(16, 16)
  output.writeUInt16LE(1, 20)
  output.writeUInt16LE(1, 22)
  output.writeUInt32LE(22050, 24)
  output.writeUInt32LE(44100, 28)
  output.writeUInt16LE(2, 32)
  output.writeUInt16LE(16, 34)
  output.write('data', 36)
  output.writeUInt32LE(bytes.length, 40)
  bytes.copy(output, 44)
  return output
}
for await (const line of createInterface({ input: process.stdin, crlfDelay: Infinity })) {
  let request
  try {
    request = JSON.parse(line)
    if (request.op === 'voices') {
      send({ id: request.id, ok: true, voices: voiceList })
      continue
    }
    const voice = request.ipa
      ? `qonsona-ipa-${['en', 'fr', 'de'].includes(request.profile) ? request.profile : 'en'}`
      : request.voice
    if (!request.ipa && !voiceList.some((v) => v.identifier === voice))
      throw new Error('Unavailable offline language voice')
    engine.set_voice(voice)
    engine.set_rate(Math.max(80, Math.min(350, 175 + Number(request.rate || 0) * 15)))
    const chunks = [],
      trace = []
    const text = request.ipa ? '[[' + request.content + ']]' : request.content
    if (typeof text !== 'string' || text.length > 50000) throw new Error('Invalid speech input')
    engine.synthesize(text, (samples, events) => {
      if (samples.length)
        chunks.push(Buffer.from(samples.buffer, samples.byteOffset, samples.byteLength))
      trace.push(...events.filter((e) => e.type === 'phoneme' && e.id).map((e) => e.id))
      return false
    })
    const wav = wave(chunks)
    if (wav.length <= 44 || (request.ipa && !trace.length))
      throw new Error('No supported speech generated')
    send({ id: request.id, ok: true, wav: wav.toString('base64'), trace })
  } catch (error) {
    send({ id: request?.id, ok: false, error: String(error.message || error) })
  }
}
