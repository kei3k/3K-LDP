import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'
import https from 'https'
import http from 'http'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    // Local proxy to fetch external URLs — bypasses CORS
    {
      name: 'fetch-proxy',
      configureServer(server) {
        server.middlewares.use('/api/fetch-url', async (req, res) => {
          const url = new URL(req.url, 'http://localhost').searchParams.get('url');
          if (!url) {
            res.statusCode = 400;
            res.end(JSON.stringify({ error: 'Missing url param' }));
            return;
          }
          
          try {
            const result = await fetchWithRedirects(url, 5);
            
            // Binary mode: if content-type is image, return raw buffer
            if (result.contentType && result.contentType.startsWith('image/')) {
              res.setHeader('Content-Type', result.contentType);
              res.setHeader('Access-Control-Allow-Origin', '*');
              res.end(result.buffer);
            } else {
              // Text mode: return as UTF-8 string
              const html = result.buffer.toString('utf-8');
              res.setHeader('Content-Type', 'text/html; charset=utf-8');
              res.setHeader('Access-Control-Allow-Origin', '*');
              res.end(html);
            }
          } catch (e) {
            console.error('[Proxy] Error:', e.message);
            res.statusCode = 502;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: e.message }));
          }
        });
      }
    }
  ],
  server: {
    open: !process.env.DOCKER,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})

/**
 * Fetch URL using Node.js native https/http modules
 * Handles redirects, SSL, and sets proper browser-like headers
 */
function fetchWithRedirects(url, maxRedirects = 5) {
  return new Promise((resolve, reject) => {
    if (maxRedirects <= 0) return reject(new Error('Too many redirects'));
    
    const parsedUrl = new URL(url);
    const client = parsedUrl.protocol === 'https:' ? https : http;
    
    const options = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port,
      path: parsedUrl.pathname + parsedUrl.search,
      method: 'GET',
      timeout: 15000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/jpeg,image/png,*/*;q=0.8',
        'Accept-Language': 'vi-VN,vi;q=0.9,en;q=0.8',
        'Accept-Encoding': 'identity',
        'Connection': 'keep-alive',
        // Add Referer for alicdn.com images (prevents 403)
        ...(parsedUrl.hostname.includes('alicdn.com') || parsedUrl.hostname.includes('1688.com')
          ? { 'Referer': 'https://detail.1688.com/' }
          : {}),
      },
      rejectUnauthorized: false, // Accept self-signed certs
    };

    const req = client.request(options, (response) => {
      // Handle redirects
      if ([301, 302, 303, 307, 308].includes(response.statusCode) && response.headers.location) {
        const redirectUrl = new URL(response.headers.location, url).href;
        console.log('[Proxy] Redirect:', response.statusCode, '->', redirectUrl);
        fetchWithRedirects(redirectUrl, maxRedirects - 1).then(resolve).catch(reject);
        return;
      }

      if (response.statusCode !== 200) {
        return reject(new Error(`HTTP ${response.statusCode} from ${url}`));
      }

      const chunks = [];
      const contentType = response.headers['content-type'] || '';
      response.on('data', chunk => chunks.push(chunk));
      response.on('end', () => {
        const buffer = Buffer.concat(chunks);
        console.log('[Proxy] Success:', url, '- Size:', buffer.length, '- Type:', contentType);
        resolve({ buffer, contentType });
      });
      response.on('error', reject);
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout (15s)'));
    });
    req.end();
  });
}
