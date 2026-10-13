import { statSync } from 'node:fs'
import { join } from 'node:path'

/** All speech backends require the bundled, platform-independent phonemizer. */
export function checkSpeechResources(resources) {
  const files = ['runner.mjs', 'neural-runner.mjs', 'espeak/espeak-ng.js', 'espeak/espeak-ng.data']
  for (const file of files) {
    if (!statSync(join(resources, 'speech', ...file.split('/'))).size)
      throw new Error(`Missing/empty speech resource: ${file}`)
  }
  return files.length
}

/** Catch an accidentally test-enabled Vite build before installers are uploaded. */
export function checkProductionRenderer(archive, asar) {
  const scripts = asar
    .listPackage(archive)
    .map((path) => path.replaceAll('\\', '/').replace(/^\//, ''))
    .filter((path) => /^out\/renderer\/.+\.js$/.test(path))
  if (!scripts.length) throw new Error('Missing renderer JavaScript')
  for (const path of scripts) {
    const body = asar.extractFile(archive, join(...path.split('/'))).toString()
    if (
      /(['"`])testGrant\1/.test(body) ||
      body.includes('100 test tickets granted; repeatable in testing')
    )
      throw new Error(`Production renderer contains the test ticket command: ${path}`)
  }
  return scripts.length
}
