/* eslint @typescript-eslint/explicit-function-return-type: "off" -- Plain JavaScript runs directly on Node24 without a TypeScript build. */
import { createServer } from 'node:http'
import { mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Service } from './service.mjs'
import { ApiError } from './domain.mjs'

export function createApi({
  service = new Service(),
  trustProxy = false,
  production = false
} = {}) {
  const server = createServer(async (req, res) => {
    let paymentNotification = false
    res.setHeader('Content-Type', 'application/json; charset=utf-8')
    res.setHeader('Cache-Control', 'no-store')
    res.setHeader('X-Content-Type-Options', 'nosniff')
    const respond = (status, data) => {
      res.writeHead(status)
      res.end(JSON.stringify(data))
    }
    try {
      const loopback = ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.socket.remoteAddress)
      if (production && !(loopback && trustProxy && req.headers['x-forwarded-proto'] === 'https'))
        throw new ApiError('HTTPS_REQUIRED', 403)
      const url = new URL(req.url, 'http://localhost')
      paymentNotification = url.pathname === '/v1/payments/yungouos/notify'
      if (!url.pathname.startsWith('/v1/')) throw new ApiError('NOT_FOUND', 404)
      if (!['GET', 'POST', 'PATCH'].includes(req.method))
        throw new ApiError('METHOD_NOT_ALLOWED', 405)
      let body = {}
      const declared = Number(req.headers['content-length'] || 0)
      if (!Number.isFinite(declared) || declared > 32768) throw new ApiError('BODY_TOO_LARGE', 413)
      if (req.method !== 'GET') {
        const media = req.headers['content-type'] || ''
        if (
          paymentNotification
            ? !/^application\/x-www-form-urlencoded(?:\s*;|$)/i.test(media)
            : !/^application\/json(?:\s*;|$)/i.test(media)
        )
          throw new ApiError(paymentNotification ? 'FORM_REQUIRED' : 'JSON_REQUIRED', 415)
        let size = 0
        const chunks = []
        for await (const chunk of req) {
          size += chunk.length
          if (size > 32768) throw new ApiError('BODY_TOO_LARGE', 413)
          chunks.push(chunk)
        }
        try {
          const raw = new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks))
          if (paymentNotification) {
            const form = new URLSearchParams(raw)
            body = Object.create(null)
            for (const [key, value] of form) {
              if (Object.hasOwn(body, key)) throw new ApiError('DUPLICATE_FORM_FIELD')
              body[key] = value
            }
          } else body = JSON.parse(raw || '{}')
        } catch {
          throw new ApiError(paymentNotification ? 'INVALID_FORM' : 'INVALID_JSON')
        }
      }
      const authorization = req.headers.authorization || ''
      const token = authorization.startsWith('Bearer ') ? authorization.slice(7) : undefined
      const ip =
        trustProxy && loopback
          ? String(req.headers['x-real-ip'] || req.socket.remoteAddress)
          : req.socket.remoteAddress
      const result = await service.handle(req.method, url.pathname, body, {
        token,
        ip,
        app: req.headers['x-qon-app'] || 'qonsona',
        clientVersion: req.headers['x-qon-version'],
        paymentProtocol: req.headers['x-qon-payment-protocol'],
        query: Object.fromEntries(url.searchParams)
      })
      if (paymentNotification) {
        res.setHeader('Content-Type', 'text/plain; charset=utf-8')
        res.writeHead(200)
        res.end('SUCCESS')
      } else respond(200, result)
    } catch (error) {
      const known = error instanceof ApiError
      if (!known) console.error('API internal failure', error.name)
      if (paymentNotification) {
        res.setHeader('Content-Type', 'text/plain; charset=utf-8')
        res.writeHead(known ? error.status : 500)
        res.end('FAIL')
        return
      }
      respond(known ? error.status : 500, {
        error: {
          code: known ? error.code : 'INTERNAL_ERROR',
          message: known ? error.code : 'Internal server error',
          ...(known && error.code === 'CLIENT_UPDATE_REQUIRED'
            ? { currentVersion: error.currentVersion, releaseUrl: error.releaseUrl }
            : {})
        }
      })
    }
  })
  server.requestTimeout = 15000
  server.headersTimeout = 10000
  server.keepAliveTimeout = 5000
  return server
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const path = resolve(process.env.QON_DB || './server/data/accounts.sqlite')
  mkdirSync(dirname(path), { recursive: true, mode: 0o700 })
  const service = new Service({ path })
  const production = process.env.NODE_ENV === 'production'
  const server = createApi({ service, production, trustProxy: process.env.QON_TRUST_PROXY === '1' })
  const host = process.env.QON_HOST || '127.0.0.1',
    port = Number(process.env.QON_PORT || 8787)
  if (production && host !== '127.0.0.1')
    throw new Error('Production API must bind to loopback behind HTTPS nginx')
  server.listen(port, host, () => {
    console.log(
      `Qon accounts API listening ${host}:${port}; test grants ${service.testEnabled ? 'enabled' : 'disabled'}`
    )
    service.supportPayments.startMaintenance()
  })
  let closing = false
  const stop = () => {
    if (closing) return
    closing = true
    service.supportPayments.stopMaintenance()
    server.close(() => {
      service.close()
      process.exit(0)
    })
    server.closeIdleConnections()
    setTimeout(() => process.exit(1), 15000).unref()
  }
  process.on('SIGTERM', stop)
  process.on('SIGINT', stop)
}
