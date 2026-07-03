// ffmpeg-based handlers: compress-video, swap-audio, clone-tx.
// Extracted verbatim from vite.config.js so both dev (Vite middleware) and
// production (Express) share the exact same logic.
import path from 'path'
import { randomUUID } from 'crypto'
import { spawn } from 'child_process'
import { tmpdir } from 'os'
import { promises as fs } from 'fs'
import ffmpegStatic from 'ffmpeg-static'
import ffprobeStatic from 'ffprobe-static'

const FFMPEG_BIN = ffmpegStatic || 'ffmpeg'
const FFPROBE_BIN = (ffprobeStatic && ffprobeStatic.path) || 'ffprobe'

// ── Concurrency guard ─────────────────────────────────────────────────────
// ffmpeg is CPU-bound; running many encodes at once starves the VPS.
// Simple in-process semaphore (limit=1) — one spawn at a time, queued after.
let running = 0
const queue = []
const MAX_CONCURRENT = 1
async function withFfmpegSlot(fn) {
  if (running >= MAX_CONCURRENT) {
    await new Promise((resolve) => queue.push(resolve))
  }
  running++
  try {
    return await fn()
  } finally {
    running--
    const next = queue.shift()
    if (next) next()
  }
}

// Wrap spawn with `nice` so ffmpeg never starves other pm2 services on the box.
function spawnNiced(bin, args) {
  return spawn('nice', ['-n', '10', bin, ...args])
}

// ── /api/compress-video ───────────────────────────────────────────────────
export async function compressVideo(req, res) {
  if (req.method !== 'POST') {
    res.statusCode = 405
    res.end('POST only')
    return
  }
  const id = randomUUID()
  const inPath = path.join(tmpdir(), `vc_in_${id}.mp4`)
  const outPath = path.join(tmpdir(), `vc_out_${id}.mp4`)
  try {
    const fh = await fs.open(inPath, 'w')
    const ws = fh.createWriteStream()
    await new Promise((resolve, reject) => {
      req.pipe(ws)
      req.on('end', resolve)
      req.on('error', reject)
      ws.on('error', reject)
    })
    console.log(`[Compress] Input saved: ${inPath} (${(await fs.stat(inPath)).size} bytes)`)

    await withFfmpegSlot(() => new Promise((resolve, reject) => {
      const ff = spawnNiced(FFMPEG_BIN, [
        '-y',
        '-i', inPath,
        '-vf', 'scale=-2:480',
        '-c:v', 'libx264',
        '-preset', 'veryfast',
        '-crf', '30',
        '-c:a', 'aac',
        '-b:a', '64k',
        '-ac', '1',
        '-movflags', '+faststart',
        outPath,
      ])
      let stderr = ''
      ff.stderr.on('data', (c) => { stderr += c.toString() })
      ff.on('close', (code) => {
        if (code === 0) resolve()
        else reject(new Error(`ffmpeg exit ${code}: ${stderr.slice(-400)}`))
      })
      ff.on('error', reject)
    }))
    const outBuf = await fs.readFile(outPath)
    console.log(`[Compress] Output: ${outBuf.length} bytes`)
    res.statusCode = 200
    res.setHeader('Content-Type', 'video/mp4')
    res.setHeader('Content-Length', outBuf.length)
    res.end(outBuf)
  } catch (e) {
    console.error('[Compress] Error:', e.message)
    res.statusCode = 500
    res.setHeader('Content-Type', 'text/plain')
    res.end(e.message)
  } finally {
    fs.unlink(inPath).catch(() => {})
    fs.unlink(outPath).catch(() => {})
  }
}

// ── /api/swap-audio (upload + run) ────────────────────────────────────────
export async function swapAudio(req, res) {
  const parsedUrl = new URL(req.url, 'http://localhost')
  const pathname = parsedUrl.pathname
  const id = parsedUrl.searchParams.get('id') || ''
  const slot = parsedUrl.searchParams.get('slot') || ''

  if (req.method !== 'POST') {
    res.statusCode = 405; res.end('POST only'); return
  }
  if (!id) {
    res.statusCode = 400; res.end('Missing id param'); return
  }

  if (pathname === '/upload' || pathname === '/api/swap-audio/upload') {
    if (!['video', 'audio'].includes(slot)) {
      res.statusCode = 400; res.end('slot must be video or audio'); return
    }
    const ext = slot === 'video' ? 'mp4' : 'audio'
    const tmpPath = path.join(tmpdir(), `sa_${id}_${slot}.${ext}`)
    try {
      const fh = await fs.open(tmpPath, 'w')
      const ws = fh.createWriteStream()
      await new Promise((resolve, reject) => {
        req.pipe(ws)
        req.on('end', resolve)
        req.on('error', reject)
        ws.on('error', reject)
      })
      console.log(`[SwapAudio] Saved ${slot}: ${tmpPath}`)
      res.statusCode = 200; res.end('ok')
    } catch (e) {
      console.error('[SwapAudio] Upload error:', e.message)
      res.statusCode = 500; res.end(e.message)
    }
    return
  }

  if (pathname === '/run' || pathname === '/api/swap-audio/run') {
    const videoPath = path.join(tmpdir(), `sa_${id}_video.mp4`)
    const audioPath = path.join(tmpdir(), `sa_${id}_audio.audio`)
    const outPath = path.join(tmpdir(), `sa_${id}_out.mp4`)
    try {
      await fs.access(videoPath)
      await fs.access(audioPath)

      let stderr = ''
      await withFfmpegSlot(() => new Promise((resolve, reject) => {
        const ff = spawnNiced(FFMPEG_BIN, [
          '-y',
          '-i', videoPath,
          '-i', audioPath,
          '-map', '0:v',
          '-map', '1:a',
          '-c:v', 'copy',
          '-c:a', 'aac',
          '-shortest',
          outPath,
        ])
        ff.stderr.on('data', (c) => { stderr += c.toString() })
        ff.on('close', (code) => {
          if (code === 0) resolve()
          else reject(new Error(`ffmpeg exit ${code}: ${stderr.slice(-600)}`))
        })
        ff.on('error', (e) => reject(new Error(`spawn error: ${e.message}`)))
      }))

      const outBuf = await fs.readFile(outPath)
      console.log(`[SwapAudio] Output: ${outBuf.length} bytes`)
      res.statusCode = 200
      res.setHeader('Content-Type', 'video/mp4')
      res.setHeader('Content-Length', outBuf.length)
      res.end(outBuf)
    } catch (e) {
      console.error('[SwapAudio] Run error:', e.message)
      res.statusCode = 500
      res.setHeader('Content-Type', 'text/plain')
      res.end(e.message)
    } finally {
      fs.unlink(videoPath).catch(() => {})
      fs.unlink(audioPath).catch(() => {})
      fs.unlink(outPath).catch(() => {})
    }
    return
  }

  res.statusCode = 404; res.end('Not found')
}

// ── /api/clone-tx (stt / upload / assemble) ───────────────────────────────
function ctVideo(id) { return path.join(tmpdir(), `ct_${id}_video.mp4`) }
function ctChunk(id, idx) { return path.join(tmpdir(), `ct_${id}_chunk_${idx}.audio`) }

function streamToFile(req, dest) {
  return new Promise((resolve, reject) => {
    fs.open(dest, 'w').then((fh) => {
      const ws = fh.createWriteStream()
      req.pipe(ws)
      req.on('end', resolve)
      req.on('error', reject)
      ws.on('error', reject)
    }).catch(reject)
  })
}

function probeDuration(file) {
  return new Promise((resolve) => {
    const ff = spawn(FFPROBE_BIN, ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file])
    let out = ''
    ff.stdout.on('data', (c) => { out += c.toString() })
    ff.on('close', () => resolve(parseFloat(out.trim()) || 0))
    ff.on('error', () => resolve(0))
  })
}

function atempoChain(ratio) {
  let r = Math.max(0.25, Math.min(4, ratio))
  const f = []
  while (r > 2.0) { f.push(2.0); r /= 2.0 }
  while (r < 0.5) { f.push(0.5); r /= 0.5 }
  f.push(Number(r.toFixed(4)))
  return f
}

export function createCloneTxHandler(env) {
  return async function cloneTx(req, res) {
    const parsed = new URL(req.url, 'http://localhost')
    const pathname = parsed.pathname.replace('/api/clone-tx', '') || parsed.pathname
    const id = parsed.searchParams.get('id') || ''
    if (req.method !== 'POST') { res.statusCode = 405; res.end('POST only'); return }
    if (!id) { res.statusCode = 400; res.end('Missing id'); return }

    if (pathname === '/stt') {
      const lang = parsed.searchParams.get('lang') || 'auto'
      const videoPath = ctVideo(id)
      const audioPath = path.join(tmpdir(), `ct_${id}_stt.wav`)
      try {
        const { GoogleAuth } = await import('google-auth-library')
        if (!env.VERTEX_KEY_FILE || !env.VERTEX_PROJECT_ID) { res.statusCode = 500; res.end('Vertex chưa cấu hình (.env)'); return }
        const a = new GoogleAuth({
          keyFile: path.resolve(env.VERTEX_KEY_FILE),
          scopes: ['https://www.googleapis.com/auth/cloud-platform'],
        })

        await streamToFile(req, videoPath)
        await withFfmpegSlot(() => new Promise((resolve, reject) => {
          const ff = spawnNiced(FFMPEG_BIN, ['-y', '-i', videoPath, '-vn', '-ac', '1', '-ar', '16000', '-c:a', 'pcm_s16le', audioPath])
          let er = ''
          ff.stderr.on('data', (c) => { er += c.toString() })
          ff.on('close', (code) => code === 0 ? resolve() : reject(new Error(`ffmpeg extract exit ${code}: ${er.slice(-300)}`)))
          ff.on('error', (e) => reject(new Error(`ffmpeg spawn: ${e.message}`)))
        }))

        const duration = await probeDuration(audioPath)
        const audioBuf = await fs.readFile(audioPath)
        const b64 = audioBuf.toString('base64')

        const region = env.VERTEX_REGION || 'us-central1'
        const project = env.VERTEX_PROJECT_ID
        const host = region === 'global' ? 'aiplatform.googleapis.com' : `${region}-aiplatform.googleapis.com`
        const model = 'gemini-2.5-flash'
        const upstream = `https://${host}/v1/projects/${project}/locations/${region}/publishers/google/models/${model}:generateContent`

        const prompt = `Bạn là công cụ tách lời thoại (speech-to-text) từ audio. Ngôn ngữ nguồn: ${lang}.
Nghe audio và trả về JSON array các đoạn lời thoại theo thứ tự thời gian.
Mỗi phần tử: {"start": <giây bắt đầu, số thực>, "end": <giây kết thúc, số thực>, "text": "<lời thoại nguyên văn>"}.
Tách đoạn theo câu hoặc khoảng nghỉ tự nhiên, mỗi đoạn khoảng 2-8 giây.
Giữ nguyên ngôn ngữ gốc, KHÔNG dịch. CHỈ trả JSON array, không giải thích.`

        const client = await a.getClient()
        const token = (await client.getAccessToken()).token
        const upstreamResp = await fetch(upstream, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify({
            contents: [{ role: 'user', parts: [{ text: prompt }, { inlineData: { mimeType: 'audio/wav', data: b64 } }] }],
            generationConfig: { temperature: 0.2, responseMimeType: 'application/json', maxOutputTokens: 8192, thinkingConfig: { thinkingBudget: 0 } },
          }),
        })
        const data = await upstreamResp.json()
        if (!upstreamResp.ok) throw new Error(`Vertex STT ${upstreamResp.status}: ${JSON.stringify(data).slice(0, 300)}`)
        const txt = data?.candidates?.[0]?.content?.parts?.[0]?.text
        if (!txt) throw new Error(`STT rỗng (finishReason=${data?.candidates?.[0]?.finishReason || '?'})`)

        let segments = []
        try {
          const clean = txt.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '')
          segments = JSON.parse(clean.match(/\[[\s\S]*\]/)?.[0] || clean)
        } catch { throw new Error('Không parse được transcript JSON') }

        res.statusCode = 200
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify({ segments, duration }))
      } catch (e) {
        console.error('[CloneTx/stt] Error:', e.message)
        res.statusCode = 500; res.setHeader('Content-Type', 'text/plain'); res.end(e.message)
      } finally {
        fs.unlink(audioPath).catch(() => {})
      }
      return
    }

    if (pathname === '/upload') {
      const kind = parsed.searchParams.get('kind') || 'chunk'
      const idx = parsed.searchParams.get('idx') || '0'
      const dest = kind === 'video' ? ctVideo(id) : ctChunk(id, idx)
      try {
        await streamToFile(req, dest)
        res.statusCode = 200; res.end('ok')
      } catch (e) {
        console.error('[CloneTx/upload] Error:', e.message)
        res.statusCode = 500; res.end(e.message)
      }
      return
    }

    if (pathname === '/assemble') {
      const videoPath = ctVideo(id)
      const outPath = path.join(tmpdir(), `ct_${id}_out.mp4`)
      const cleanup = []
      try {
        const chunks = []
        for await (const c of req) chunks.push(c)
        const body = JSON.parse(Buffer.concat(chunks).toString('utf-8') || '{}')
        const segments = body.segments || []
        const videoDuration = body.videoDuration || 0
        if (!segments.length) throw new Error('Không có segment để ghép')
        await fs.access(videoPath)

        const mode = body.mode || 'segment'

        const inputs = []
        const valid = []
        for (let k = 0; k < segments.length; k++) {
          const seg = segments[k]
          const chunkPath = ctChunk(id, seg.idx)
          let measured = 0
          try { await fs.access(chunkPath); measured = await probeDuration(chunkPath) } catch { continue }
          if (!measured) continue
          cleanup.push(chunkPath)
          const inIdx = valid.length + 1
          inputs.push('-i', chunkPath)
          valid.push({ inIdx, measured, start: seg.start, end: seg.end })
        }
        const N = valid.length
        if (!N) throw new Error('Không có audio chunk hợp lệ')

        const totalVoice = valid.reduce((s, v) => s + v.measured, 0)
        const leadMs = Math.max(0, Math.round(valid[0].start * 1000))
        const norm = valid.map((v, j) => `[${v.inIdx}:a]aresample=48000,aformat=sample_fmts=fltp:channel_layouts=stereo[n${j}]`)
        const concatLabel = N === 1 ? '[n0]anull[cat]' : `${valid.map((_, j) => `[n${j}]`).join('')}concat=n=${N}:v=0:a=1[cat]`

        let filterComplex, args
        if (mode === 'voice') {
          const factors = atempoChain(videoDuration > 0 ? totalVoice / videoDuration : 1)
          const tempo = factors.map((f) => `atempo=${f}`).join(',')
          const aout = `[cat]${tempo}${leadMs ? `,adelay=${leadMs}:all=1` : ''}[aout]`
          filterComplex = [...norm, concatLabel, aout].join(';')
          args = ['-y', '-i', videoPath, ...inputs, '-filter_complex', filterComplex,
            '-map', '0:v', '-map', '[aout]', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '128k']
          if (videoDuration > 0) args.push('-t', String(videoDuration))
          args.push('-movflags', '+faststart', outPath)
        } else if (mode === 'video') {
          let vf = videoDuration > 0 ? totalVoice / videoDuration : 1
          vf = Math.max(0.5, Math.min(2.5, vf))
          const vpart = `[0:v]setpts=${vf.toFixed(5)}*PTS[v]`
          const aout = `[cat]${leadMs ? `adelay=${leadMs}:all=1,` : ''}anull[aout]`
          filterComplex = [...norm, concatLabel, vpart, aout].join(';')
          args = ['-y', '-i', videoPath, ...inputs, '-filter_complex', filterComplex,
            '-map', '[v]', '-map', '[aout]',
            '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '23', '-pix_fmt', 'yuv420p',
            '-c:a', 'aac', '-b:a', '128k', '-shortest', '-movflags', '+faststart', outPath]
        } else {
          const segParts = valid.map((v, j) => {
            const target = Math.max(0.3, v.end - v.start)
            const factors = atempoChain(v.measured / target)
            const startMs = Math.max(0, Math.round(v.start * 1000))
            return `[n${j}]${factors.map((f) => `atempo=${f}`).join(',')},adelay=${startMs}:all=1[a${j}]`
          })
          const mix = N === 1
            ? '[a0]anull[aout]'
            : `${valid.map((_, j) => `[a${j}]`).join('')}amix=inputs=${N}:normalize=0:dropout_transition=0[aout]`
          filterComplex = [...norm, ...segParts, mix].join(';')
          args = ['-y', '-i', videoPath, ...inputs, '-filter_complex', filterComplex,
            '-map', '0:v', '-map', '[aout]', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '128k']
          if (videoDuration > 0) args.push('-t', String(videoDuration))
          args.push('-movflags', '+faststart', outPath)
        }

        let stderr = ''
        await withFfmpegSlot(() => new Promise((resolve, reject) => {
          const ff = spawnNiced(FFMPEG_BIN, args)
          ff.stderr.on('data', (c) => { stderr += c.toString() })
          ff.on('close', (code) => code === 0 ? resolve() : reject(new Error(`ffmpeg exit ${code}: ${stderr.slice(-600)}`)))
          ff.on('error', (e) => reject(new Error(`spawn: ${e.message}`)))
        }))

        const outBuf = await fs.readFile(outPath)
        console.log(`[CloneTx/assemble] mode=${mode} Output: ${outBuf.length} bytes, ${N} chunks`)
        res.statusCode = 200
        res.setHeader('Content-Type', 'video/mp4')
        res.setHeader('Content-Length', outBuf.length)
        res.end(outBuf)
      } catch (e) {
        console.error('[CloneTx/assemble] Error:', e.message)
        res.statusCode = 500; res.setHeader('Content-Type', 'text/plain'); res.end(e.message)
      } finally {
        fs.unlink(videoPath).catch(() => {})
        fs.unlink(outPath).catch(() => {})
        for (const c of cleanup) fs.unlink(c).catch(() => {})
      }
      return
    }

    res.statusCode = 404; res.end('Not found')
  }
}
