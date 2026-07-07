// Local proxy to fetch external URLs — bypasses CORS.
// SECURITY: this endpoint is a classic SSRF vector (arbitrary server-side
// fetch controlled by the client). Policy (founder-approved 2026-07-07):
// any PUBLIC hostname may be fetched — no allowlist gate. Safety instead
// comes from two independent, unconditional checks that always run:
//   1. Protocol + raw-IP rejection — only http/https, and the hostname
//      itself may not be a literal IP (forces a DNS name to resolve).
//   2. DNS-resolve-then-check — resolve the hostname and reject if ANY
//      resolved IP is private/loopback/link-local/CGNAT, so a public-looking
//      hostname can't be re-pointed (DNS rebinding) at internal infra.
// ALLOWED_FETCH_HOSTS (env) is kept as an optional fast-path allowlist:
// if set and the hostname matches, DNS-safety check is skipped (trusted,
// pre-vetted partner hosts only — e.g. hosts that returned non-public IPs
// legitimately, like a CDN behind a CGNAT-range anycast). Empty by default,
// meaning by default every request goes through the full safety check.
import https from 'https'
import http from 'http'
import zlib from 'zlib'
import dns from 'dns/promises'
import net from 'net'

function getFastPathHosts(env) {
  const extra = (env.ALLOWED_FETCH_HOSTS || '')
    .split(',').map((h) => h.trim().toLowerCase()).filter(Boolean)
  return new Set(extra)
}

function hostMatchesFastPath(hostname, fastPathHosts) {
  const h = hostname.toLowerCase()
  for (const allowed of fastPathHosts) {
    if (h === allowed || h.endsWith('.' + allowed)) return true
  }
  return false
}

function isPrivateOrReservedIp(ip) {
  const type = net.isIP(ip)
  if (type === 4) {
    const parts = ip.split('.').map(Number)
    if (parts[0] === 10) return true
    if (parts[0] === 127) return true
    if (parts[0] === 0) return true
    if (parts[0] === 169 && parts[1] === 254) return true // link-local
    if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true
    if (parts[0] === 192 && parts[1] === 168) return true
    if (parts[0] === 100 && parts[1] >= 64 && parts[1] <= 127) return true // CGNAT
    return false
  }
  if (type === 6) {
    const lower = ip.toLowerCase()
    if (lower === '::1') return true // loopback
    if (lower.startsWith('fe80') || lower.startsWith('fc') || lower.startsWith('fd')) return true // link-local/ULA
    return false
  }
  return true // unknown → block
}

// Errors thrown here carry a `code` so the HTTP layer can tell "we refused
// to even try" (SSRF guard) apart from "we tried and the network/target
// failed" — the two must never be reported to the client with the same
// wording, or the security guard's behavior becomes indistinguishable from
// a flaky network, which is both unhelpful and a mild info-leak either way.
class BlockedTargetError extends Error {
  constructor(message) {
    super(message)
    this.code = 'BLOCKED_TARGET'
  }
}

async function assertSafeTarget(parsedUrl, fastPathHosts) {
  if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
    throw new BlockedTargetError(`Protocol not allowed: ${parsedUrl.protocol}`)
  }
  // Reject raw-IP targets outright — a hostname must resolve via DNS so the
  // check below can actually inspect what it resolves to.
  if (net.isIP(parsedUrl.hostname)) {
    throw new BlockedTargetError('Raw IP targets are not allowed')
  }
  if (hostMatchesFastPath(parsedUrl.hostname, fastPathHosts)) {
    return // pre-vetted partner host — skip DNS-safety check
  }
  const addresses = await dns.lookup(parsedUrl.hostname, { all: true })
  for (const { address } of addresses) {
    if (isPrivateOrReservedIp(address)) {
      throw new BlockedTargetError(`Resolved IP blocked (private/reserved): ${address}`)
    }
  }
}

function fetchWithRedirects(url, fastPathHosts, maxRedirects = 5) {
  return new Promise((resolve, reject) => {
    if (maxRedirects <= 0) return reject(new Error('Too many redirects'))

    const parsedUrl = new URL(url)

    assertSafeTarget(parsedUrl, fastPathHosts).then(() => {
      const client = parsedUrl.protocol === 'https:' ? https : http

      const options = {
        hostname: parsedUrl.hostname,
        port: parsedUrl.port,
        path: parsedUrl.pathname + parsedUrl.search,
        method: 'GET',
        timeout: 60000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/jpeg,image/png,*/*;q=0.8',
          'Accept-Language': 'vi-VN,vi;q=0.9,en;q=0.8',
          'Accept-Encoding': 'gzip, deflate',
          'Connection': 'keep-alive',
          ...(parsedUrl.hostname.includes('alicdn.com') || parsedUrl.hostname.includes('1688.com')
            ? { 'Referer': 'https://detail.1688.com/' }
            : {}),
          ...(parsedUrl.hostname.includes('shopee.vn') || parsedUrl.hostname.includes('susercontent.com') || parsedUrl.hostname.includes('shopeemobile.com')
            ? {
                'Referer': 'https://shopee.vn/',
                'X-API-SOURCE': 'pc',
                'X-Requested-With': 'XMLHttpRequest',
                'X-Shopee-Language': 'vi',
                'af-ac-enc-dat': 'null',
                'Sec-Fetch-Dest': 'empty',
                'Sec-Fetch-Mode': 'cors',
                'Sec-Fetch-Site': 'same-origin',
              }
            : {}),
        },
        rejectUnauthorized: false,
      }

      const req = client.request(options, (response) => {
        if ([301, 302, 303, 307, 308].includes(response.statusCode) && response.headers.location) {
          const redirectUrl = new URL(response.headers.location, url).href
          console.log('[Proxy] Redirect:', response.statusCode, '->', redirectUrl)
          fetchWithRedirects(redirectUrl, fastPathHosts, maxRedirects - 1).then(resolve).catch(reject)
          return
        }

        if (response.statusCode !== 200) {
          const err = new Error(`HTTP ${response.statusCode} from ${url}`)
          err.code = 'TARGET_HTTP_ERROR'
          err.targetStatus = response.statusCode
          return reject(err)
        }

        const chunks = []
        const contentType = response.headers['content-type'] || ''
        const encoding = (response.headers['content-encoding'] || '').toLowerCase()
        let stream = response
        if (encoding === 'gzip') stream = response.pipe(zlib.createGunzip())
        else if (encoding === 'deflate') stream = response.pipe(zlib.createInflate())
        else if (encoding === 'br') stream = response.pipe(zlib.createBrotliDecompress())
        stream.on('data', (chunk) => chunks.push(chunk))
        stream.on('end', () => {
          const buffer = Buffer.concat(chunks)
          console.log('[Proxy] Success:', url, '- Size:', buffer.length, '- Enc:', encoding || 'none', '- Type:', contentType)
          resolve({ buffer, contentType })
        })
        stream.on('error', (e) => { e.code = e.code || 'TARGET_UNREACHABLE'; reject(e) })
        response.on('error', (e) => { e.code = e.code || 'TARGET_UNREACHABLE'; reject(e) })
      })

      req.on('error', (e) => { e.code = 'TARGET_UNREACHABLE'; reject(e) })
      req.on('timeout', () => {
        req.destroy()
        const err = new Error('Request timeout (60s)')
        err.code = 'TARGET_UNREACHABLE'
        reject(err)
      })
      req.end()
    }).catch(reject)
  })
}

export function createFetchUrlHandler(env) {
  const fastPathHosts = getFastPathHosts(env)
  return async function fetchUrlHandler(req, res) {
    const url = new URL(req.url, 'http://localhost').searchParams.get('url')
    if (!url) {
      res.statusCode = 400
      res.end(JSON.stringify({ error: 'Missing url param', code: 'BAD_REQUEST' }))
      return
    }

    try {
      const result = await fetchWithRedirects(url, fastPathHosts)

      if (result.contentType && result.contentType.startsWith('image/')) {
        res.setHeader('Content-Type', result.contentType)
        res.setHeader('Access-Control-Allow-Origin', '*')
        res.end(result.buffer)
      } else {
        const html = result.buffer.toString('utf-8')
        res.setHeader('Content-Type', 'text/html; charset=utf-8')
        res.setHeader('Access-Control-Allow-Origin', '*')
        res.end(html)
      }
    } catch (e) {
      console.error('[Proxy] Error:', e.code || 'UNKNOWN', e.message)
      res.setHeader('Content-Type', 'application/json')
      if (e.code === 'BLOCKED_TARGET') {
        res.statusCode = 403
        res.end(JSON.stringify({ error: e.message, code: 'BLOCKED_TARGET' }))
      } else if (e.code === 'TARGET_HTTP_ERROR') {
        res.statusCode = 502
        res.end(JSON.stringify({ error: e.message, code: 'TARGET_HTTP_ERROR', targetStatus: e.targetStatus }))
      } else {
        // Network failure, timeout, DNS failure, or anything unclassified —
        // all mean "we tried, the target/network didn't cooperate", never
        // the same thing as a deliberate security block.
        res.statusCode = 504
        res.end(JSON.stringify({ error: e.message, code: 'TARGET_UNREACHABLE' }))
      }
    }
  }
}
