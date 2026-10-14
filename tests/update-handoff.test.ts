import { expect, it } from 'vitest'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { prepareWindowsInstaller } from '../src/main/update-handoff'

it.skipIf(process.platform !== 'win32')(
  'real Windows helper acquires the parent handle, waits while it is alive, and honors cancellation without launching an installer',
  async () => {
    const dir = await mkdtemp(join(tmpdir(), 'qonsona-handoff-test-'))
    const installer = join(
      process.env.SystemRoot ?? 'C:\\Windows',
      'System32',
      'WindowsPowerShell',
      'v1.0',
      'powershell.exe'
    )
    const log = join(dir, 'handoff.json')
    const failures: Error[] = []
    let helper: Awaited<ReturnType<typeof prepareWindowsInstaller>> | undefined
    try {
      helper = await prepareWindowsInstaller(installer, true, log, (error) => failures.push(error))
      expect(JSON.parse(await readFile(log, 'utf8')).phase).toBe('ready')
      await helper.commit()
      expect(JSON.parse(await readFile(log, 'utf8')).phase).toBe('armed')
      helper.cancel()
      const deadline = Date.now() + 5000
      let report: { phase: string; error?: string }
      do {
        report = JSON.parse(await readFile(log, 'utf8'))
        if (report.phase === 'failed') break
        await new Promise((resolve) => setTimeout(resolve, 20))
      } while (Date.now() < deadline)
      expect(report.phase).toBe('failed')
      expect(report.error).toContain('installer was not started')
      expect(failures).toEqual([])
    } finally {
      helper?.cancel()
      await rm(dir, { recursive: true, force: true })
    }
  },
  25_000
)
