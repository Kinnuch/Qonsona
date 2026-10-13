/** Consistent online backup before a test-service schema migration; no account data or secrets are printed. */
import { DatabaseSync, backup } from 'node:sqlite'
import { chmodSync } from 'node:fs'
const directory = '/home/ubuntu/qon-account-data'
process.umask(0o077)
const target = `${directory}/testing-before-gallery-${Date.now()}.sqlite`
const database = new DatabaseSync(`${directory}/testing.sqlite`, { readOnly: true })
try {
  await backup(database, target)
  chmodSync(target, 0o600)
  console.log('Private SQLite online backup completed before gallery migration.')
} finally {
  database.close()
}
