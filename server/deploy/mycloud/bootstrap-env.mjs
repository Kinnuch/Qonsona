import { existsSync, writeFileSync, chmodSync } from 'node:fs'
import { randomBytes } from 'node:crypto'
const file = '/home/ubuntu/qon-account-data/testing.env'
if (!existsSync(file)) {
  const variables = {
    NODE_ENV: 'test',
    QON_HOST: '127.0.0.1',
    QON_PORT: '3781',
    QON_DB: '/home/ubuntu/qon-account-data/testing.sqlite',
    QON_TRUST_PROXY: '1',
    QON_TEST_GRANTS: '1',
    QON_TEST_EPOCH: 'collection-online-20261013',
    QON_PAYMENTS_ENABLED: '0',
    QON_SUPPORT_TICKET_FEN: '600',
    QON_ADMIN_KEY: randomBytes(32).toString('hex')
  }
  writeFileSync(
    file,
    Object.entries(variables)
      .map(([key, value]) => `${key}=${value}`)
      .join('\n') + '\n',
    { mode: 0o600 }
  )
}
chmodSync(file, 0o600)
console.log('Isolated test configuration ready; administrator credential is not printed.')
