// Local proxy to fetch external URLs — bypasses CORS.
// SECURITY: this endpoint is a classic SSRF vector (arbitrary server-side
// fetch controlled by the client). Hardened with two independent gates:
//   1. Hostname allowlist — only domains this tool actually needs to reach
//      (LadiPage/Webcake sources + the image CDNs referenced in the fetch
//      headers below: alicdn/1688/shopee).
//   2. DNS-resolve-then-check — resolve the hostname and reject if any
//      resolved IP is private/loopback/link-local, so an allowed hostname
//      can't be re-pointed (DNS rebinding) at internal infra.
import https from 'https'
import http from 'http'
import zlib from 'zlib'
import dns from 'dns/promises'
import net from 'net'

// Domains the tool legitimately needs (landing page sources + image CDNs
// referenced by the Referer/anti-bot headers below). Subdomains allowed.
const DEFAULT_ALLOWED_HOSTS = [
  'ladipage.vn', 'ladipage.com',
  'webcake.io', 'webcake.vn',
  'alicdn.com', '1688.com', 'detail.1688.com',
  'shopee.vn', 'susercontent.com', 'shopeemobile.com',
  'cdn.tgdd.vn', 'lazada.vn', 'lzd-img-global.slatic.net',
]

function getAllowedHosts(env) {
  const extra = (env.ALLOWED_FETCH_HOSTS || '')
    .split(',').map((h) => h.trim().toLowerCase()).filter(Boolean)
  return new Set([...DEFAULT_ALLOWED_HOSTS, ...extra])
}

function hostAllowed(hostname, allowedHosts) {
  const h = hostname.toLowerCase()
  for (const allowed of allowedHosts) {
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

async function assertSafeTarget(parsedUrl, allowedHosts) {
  if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
    throw new Error(`Protocol not allowed: ${parsedUrl.protocol}`)
  }
  if (!hostAllowed(parsedUrl.hostname, allowedHosts)) {
    throw new Error(`Host not in allowlist: ${parsedUrl.hostname}`)
  }
  // Reject raw-IP targets outright (allowlist is hostname-based).
  if (net.isIP(parsedUrl.hostname)) {
    throw new Error('Raw IP targets are not allowed')
  }
  const addresses = await dns.lookup(parsedUrl.hostname, { all: true })
  for (const { address } of addresses) {
    if (isPrivateOrReservedIp(address)) {
      throw new Error(`Resolved IP blocked (private/reserved): ${address}`)
    }
  }
}

function fetchWithRedirects(url, allowedHosts, maxRedirects = 5) {
  return new Promise((resolve, reject) => {
    if (maxRedirects <= 0) return reject(new Error('Too many redirects'))

    const parsedUrl = new URL(url)

    assertSafeTarget(parsedUrl, allowedHosts).then(() => {
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
          fetchWithRedirects(redirectUrl, allowedHosts, maxRedirects - 1).then(resolve).catch(reject)
          return
        }

        if (response.statusCode !== 200) {
          return reject(new Error(`HTTP ${response.statusCode} from ${url}`))
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
        stream.on('error', reject)
        response.on('error', reject)
      })

      req.on('error', reject)
      req.on('timeout', () => {
        req.destroy()
        reject(new Error('Request timeout (60s)'))
      })
      req.end()
    }).catch(reject)
  })
}

export function createFetchUrlHandler(env) {
  const allowedHosts = getAllowedHosts(env)
  return async function fetchUrlHandler(req, res) {
    const url = new URL(req.url, 'http://localhost').searchParams.get('url')
    if (!url) {
      res.statusCode = 400
      res.end(JSON.stringify({ error: 'Missing url param' }))
      return
    }

    try {
      const result = await fetchWithRedirects(url, allowedHosts)

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
      console.error('[Proxy] Error:', e.message)
      res.statusCode = 502
      res.setHeader('Content-Type', 'application/json')
      res.end(JSON.stringify({ error: e.message }))
    }
  }
}
