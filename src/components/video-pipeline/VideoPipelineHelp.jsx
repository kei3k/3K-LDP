/**
 * Hướng dẫn sử dụng — bao phủ ALL tính năng chính của tool.
 * Sections: LadiPage Clone · AI Video Pipeline · Clone Voice · TTS
 */
import { useRef } from 'react';
import { FULL_VERSION } from '../../version';

export default function VideoPipelineHelp() {
  const refs = {
    ladi: useRef(null),
    video: useRef(null),
    clone: useRef(null),
    tts: useRef(null),
  };

  const scrollTo = (key) => {
    refs[key]?.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className="flex-1 overflow-y-auto px-6 py-8 bg-background">
      <div className="max-w-3xl mx-auto prose prose-invert prose-sm">

        {/* HEADER */}
        <div className="flex items-center gap-3 mb-2 flex-wrap">
          <h1 className="text-2xl font-bold text-emerald-400 m-0">
            📖 Hướng dẫn sử dụng
          </h1>
          <span className="text-[11px] font-mono bg-muted/40 border border-border rounded-full px-2 py-0.5 text-muted-foreground">
            {FULL_VERSION}
          </span>
        </div>
        <p className="text-muted-foreground text-sm mb-5">
          Tổng hợp hướng dẫn cho tất cả tính năng: LadiPage Clone, AI Video Pipeline, Clone Voice và TTS.
        </p>

        {/* SUB-NAV */}
        <div className="flex gap-2 flex-wrap mb-8 sticky top-0 z-10 bg-background/90 backdrop-blur py-2 -mx-2 px-2 rounded-lg">
          {[
            { key: 'ladi',  label: '🔥 LadiPage Clone',   color: 'orange' },
            { key: 'video', label: '🎬 AI Video Pipeline', color: 'pink'   },
            { key: 'clone', label: '🎙 Clone Voice',       color: 'violet' },
            { key: 'tts',   label: '🔊 TTS',              color: 'cyan'   },
          ].map(({ key, label, color }) => (
            <button
              key={key}
              onClick={() => scrollTo(key)}
              className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-all
                ${color === 'orange' ? 'border-orange-500/40 text-orange-300 hover:bg-orange-500/10' : ''}
                ${color === 'pink'   ? 'border-pink-500/40   text-pink-300   hover:bg-pink-500/10'   : ''}
                ${color === 'violet' ? 'border-violet-500/40 text-violet-300 hover:bg-violet-500/10' : ''}
                ${color === 'cyan'   ? 'border-cyan-500/40   text-cyan-300   hover:bg-cyan-500/10'   : ''}
              `}
            >
              {label}
            </button>
          ))}
        </div>

        {/* ═══════════════════════════════════════════════════
            SECTION 1 — LadiPage Clone
        ═══════════════════════════════════════════════════ */}
        <section ref={refs.ladi} id="ladi" className="mb-12 scroll-mt-16">
          <SectionHeading emoji="🔥" title="LadiPage Clone" color="text-orange-400" />
          <p className="text-sm text-foreground/85 mb-4">
            Clone landing page LadiPage thành file <code>.pke</code> để import vào Webcake — không cần rebuild từ đầu.
          </p>

          <Section emoji="🔄" title="Quy trình">
            <ol className="list-decimal pl-5 space-y-2 text-sm">
              <li>Dán URL landing page LadiPage (hoặc paste HTML thủ công)</li>
              <li>(Tùy chọn) Chọn ngôn ngữ dịch văn bản → Vertex gemini-flash chunked 40 text/batch</li>
              <li>(Tùy chọn) Tick "Dịch ảnh" → nhận dạng + dịch chữ trong ảnh qua Nano Banana 2</li>
              <li>(Tùy chọn) Tick "Xóa contact" → tự động xóa SĐT, Zalo, widget</li>
              <li>Bấm <b>Tải PKE</b> → lưu file <code>.pke</code></li>
              <li>Webcake: <b>New page → Import .pke → Edit</b></li>
            </ol>
          </Section>

          <Section emoji="⚙️" title="Tính năng kỹ thuật (đã fix)">
            <ul className="list-disc pl-5 space-y-1.5 text-sm">
              <li><b>Auto-detect schema section LadiPage</b>: hỗ trợ cả schema cũ (<code>com-section</code>) lẫn schema mới (<code>ladi-section</code> với <code>id=SECTION{'{N}'}</code>)</li>
              <li><b>Canvas width detection tự động</b>: đọc thuộc tính width của <code>.ladi-wraper</code> → mobile-only trang = 420px, desktop = 1200px — không cần chỉnh tay</li>
              <li><b>Strip lazy-load class</b>: xóa class <code>ladi-lazyload</code> → ảnh hiện ngay, không cần scroll để trigger load</li>
              <li><b>Filter section ẩn thật sự</b>: chỉ bỏ qua section có <code>display:none</code> trong CSS inline — <b>KHÔNG</b> filter popup nhầm (popup dùng <code>visibility:hidden</code> khác)</li>
              <li><b>Empty scaffolding filter</b>: phát hiện section chỉ có class container trống, không có content thực → bỏ qua</li>
            </ul>
          </Section>

          <Section emoji="🌐" title="Dịch ngôn ngữ">
            <ul className="list-disc pl-5 space-y-1 text-sm">
              <li>Dropdown 7 ngôn ngữ: Việt · Thai · English · 中文 · 日本語 · 한국어 · Indonesia</li>
              <li>Dùng <b>Vertex gemini-2.0-flash-preview</b>, chunked 40 đoạn text/batch</li>
              <li>Chỉ dịch text visible, giữ nguyên cấu trúc HTML</li>
            </ul>
          </Section>

          <Section emoji="🖼️" title="Dịch ảnh (Nano Banana 2)">
            <ul className="list-disc pl-5 space-y-1 text-sm">
              <li>Tick checkbox "Dịch ảnh" ở form → tool extract tất cả ảnh trong trang</li>
              <li>Modal grid: xem preview từng ảnh, tick chọn ảnh cần dịch</li>
              <li>Nano Banana 2 detect text trong ảnh → dịch sang ngôn ngữ đích → re-render ảnh</li>
              <li>Chi phí: ~$0.04/ảnh</li>
            </ul>
          </Section>

          <Section emoji="🚫" title="Xóa contact cũ">
            <ul className="list-disc pl-5 space-y-1 text-sm">
              <li>Auto xóa: số điện thoại định dạng <code>0xxxxxxxxx</code>, <code>+84xxxxxxxxx</code></li>
              <li>Xóa link Zalo: <code>zalo.me/...</code>, <code>tel:...</code></li>
              <li>Xóa DOM widget nhúng ngoài (chat widget, call button)</li>
              <li>Custom strings: thêm text muốn xóa thêm vào ô tùy chỉnh</li>
            </ul>
          </Section>
        </section>

        {/* ═══════════════════════════════════════════════════
            SECTION 2 — AI Video Pipeline
        ═══════════════════════════════════════════════════ */}
        <section ref={refs.video} id="video" className="mb-12 scroll-mt-16">
          <SectionHeading emoji="🎬" title="AI Video Pipeline" color="text-pink-400" />
          <p className="text-sm text-foreground/85 mb-4">
            Pipeline 6 bước dựng video quảng cáo AI: phân tích video mẫu → sinh kịch bản → tạo ảnh tham chiếu → render Veo 3.1 → ghép. Bao gồm sub-mode <b>Clone Voice</b> trong tab AI Video.
          </p>

          <Section emoji="📋" title="Tổng quan pipeline">
            <div className="space-y-2.5">
              <Step n="1" label="Phân tích" desc="Upload mp4 → Gemini 2.5 Pro đọc audio + visual → JSON template (transcript, cấu trúc cảnh, hook/CTA)" color="pink" />
              <Step n="2" label="Assets" desc="Upload ảnh sản phẩm (hoặc import Shopee URL) + khai báo nhân vật + chọn duration" color="pink" />
              <Step n="3" label="Kịch bản" desc="Gemini sinh narration + imagePrompt + videoPrompt cho mỗi cảnh 8s" color="pink" />
              <Step n="4" label="Ref Images" desc="Nano Banana 2 sinh ảnh tham chiếu — auto-sinh chân dung anchor trước để giữ nhân vật nhất quán" color="pink" />
              <Step n="5" label="Veo 3.1" desc="Sinh clip 8s mỗi cảnh, dùng ref image làm first frame" color="pink" />
              <Step n="6" label="Ghép" desc="Tải clip rời + ffmpeg.wasm concat thành video hoàn chỉnh" color="pink" />
            </div>
          </Section>

          <Section emoji="🧭" title="2 chế độ: Wizard vs Flow">
            <div className="grid md:grid-cols-2 gap-3 mt-2">
              <Card title="🪄 Wizard" border="border-pink-500/40">
                <p>Giao diện dắt tay từng bước 1→6. Có Approve/Edit/Regenerate. <b>Phù hợp cho người mới + việc lặp tuần tự</b>.</p>
              </Card>
              <Card title="🔀 Flow" border="border-violet-500/40">
                <p>Canvas node-based. Kéo-thả node, nối edge, custom config. <b>Phù hợp khi muốn skip step hoặc tái sử dụng pipeline</b>.</p>
              </Card>
            </div>
            <p className="mt-3 text-xs text-muted-foreground italic">Toggle "Wizard | Flow" ở góc trên-trái tab AI Video. Sub-tab "Clone Voice" cũng có ở đây.</p>
          </Section>

          <Section emoji="🌐" title="Ngôn ngữ + Bilingual mode">
            <p className="mb-2">Dropdown chọn ngôn ngữ nhân vật nói trong video:</p>
            <ul className="list-disc pl-5 space-y-1 text-sm">
              <li>🇻🇳 Tiếng Việt (mặc định) · 🇹🇭 Thai · 🇺🇸 English · 🇨🇳 中文 · 🇯🇵 日本語 · 🇰🇷 한국어 · 🇮🇩 Indonesia</li>
            </ul>
            <Callout color="blue">
              Chọn ngôn ngữ khác Việt → Gemini tự sinh thêm bản dịch Việt (<code>_vi</code> field) hiện bên dưới text gốc với chip "VI" xanh — anh đọc Việt để hiểu nội dung, edit cả hai trước khi qua step kế.
            </Callout>
          </Section>

          <Section emoji="💾" title="Auto-save + Resume">
            <p className="mb-2">Mọi data (template, ảnh, clips Veo) tự lưu IndexedDB. Refresh / mất điện / đóng tab → mở lại tool:</p>
            <ul className="list-disc pl-5 space-y-1 text-sm">
              <li>Banner "♻️ Session đã restore" xuất hiện ở top</li>
              <li>Wizard auto-jump tới step anh đang dở</li>
              <li>Nút "🗑 Clear" ở cuối step bar = xóa toàn bộ session</li>
            </ul>
          </Section>

          <Section emoji="📝" title="Chi tiết từng step">
            <DetailStep n="1" title="Phân tích video" color="pink">
              <ul>
                <li>Drag-drop file <code>.mp4</code> (bất kỳ độ dài). Video &gt;18MB tự compress local (ffmpeg native server-side) xuống 480p giữ audio.</li>
                <li>Optional: paste FB Reel URL (chỉ lưu metadata, không fetch).</li>
                <li>Đặt tên template → save vào library, reuse cho video sau.</li>
                <li>Output: transcript + cấu trúc cảnh (hook + scenes + CTA, đều editable).</li>
              </ul>
            </DetailStep>

            <DetailStep n="2" title="Assets (ảnh + nhân vật)" color="pink">
              <ul>
                <li><b>Import Shopee</b>: paste URL sản phẩm → tool tự fetch tên + 6 ảnh đầu (qua proxy có anti-bot headers)</li>
                <li><b>Upload thủ công</b>: chọn nhiều ảnh, hiện thumbnail có nút X xóa</li>
                <li><b>Nhân vật</b>: form structured — giới tính / quốc tịch / tuổi / mô tả tự do. Bấm "+ Thêm" để nhiều nhân vật.</li>
                <li><b>Duration</b>: 5 preset (16/24/32/48/60s) hoặc custom. Số cảnh = ceil(duration ÷ 8)</li>
              </ul>
            </DetailStep>

            <DetailStep n="3" title="Sinh kịch bản (Gemini 2.5 Pro)" color="pink">
              <ul>
                <li>Mỗi cảnh: <code className="text-pink-400">narration</code> (lời thoại) + <code className="text-violet-400">imagePrompt</code> (English, Nano Banana) + <code className="text-cyan-400">videoPrompt</code> (English, Veo)</li>
                <li>Click cảnh để xem detail + edit từng field</li>
                <li>Bilingual: ngôn ngữ khác Việt → có thêm <code>narration_vi</code> để review</li>
              </ul>
            </DetailStep>

            <DetailStep n="4" title="Ref Images (Nano Banana 2)" color="pink">
              <ul>
                <li><b>Auto-sinh Character Portrait Anchor</b> — chân dung close-up neutral background. Dùng làm identity reference cho tất cả cảnh → nhân vật nhất quán</li>
                <li>Rate limit 7.5s/call (8 RPM) + auto retry 429 với exponential backoff</li>
                <li><b>Custom ref per scene</b>: hover thumbnail → nút "+" upload ref riêng. Checkbox "chỉ ref riêng" = bỏ ảnh sản phẩm mặc định</li>
              </ul>
              <Callout color="amber">
                Regenerate 1 cảnh sẽ hỏi "regen luôn các cảnh sau?" — vì chúng dùng cảnh này làm ref. Đồng ý để giữ consistency.
              </Callout>
            </DetailStep>

            <DetailStep n="5" title="Sinh clip Veo 3.1" color="pink">
              <ul>
                <li>Input = videoPrompt + refImage (làm first frame)</li>
                <li>Max 3 clips song song (semaphore), mỗi clip ~30-60s</li>
                <li>Preview inline khi xong, retry per clip nếu fail</li>
              </ul>
            </DetailStep>

            <DetailStep n="6" title="Ghép video hoàn chỉnh" color="pink">
              <ul>
                <li><b>Section A — Clip rời</b>: download từng clip / hoặc all-in-zip</li>
                <li><b>Section B — Auto concat</b>: ffmpeg.wasm thử stream-copy trước (~1s), fail thì re-encode (~30s)</li>
                <li><b>Test mode</b>: upload 3 mp4 bất kỳ để test concat không cần Veo</li>
              </ul>
            </DetailStep>
          </Section>

          <Section emoji="💰" title="Chi phí ước tính">
            <table className="w-full text-xs border-collapse border border-border">
              <thead>
                <tr className="bg-muted/30">
                  <th className="border border-border px-2 py-1.5 text-left">Service</th>
                  <th className="border border-border px-2 py-1.5 text-left">Đơn giá</th>
                  <th className="border border-border px-2 py-1.5 text-left">Ghi chú</th>
                </tr>
              </thead>
              <tbody>
                <tr><td className="border border-border px-2 py-1">Gemini 2.5 Pro (analyze + script)</td><td className="border border-border px-2 py-1">~$0.05/video</td><td className="border border-border px-2 py-1 text-muted-foreground">2 calls</td></tr>
                <tr><td className="border border-border px-2 py-1">Nano Banana 2 (mỗi ảnh)</td><td className="border border-border px-2 py-1">~$0.04</td><td className="border border-border px-2 py-1 text-muted-foreground">Portrait + N cảnh</td></tr>
                <tr><td className="border border-border px-2 py-1">Veo 3.1 (mỗi clip 8s)</td><td className="border border-border px-2 py-1">~$0.50</td><td className="border border-border px-2 py-1 text-muted-foreground">Đắt nhất</td></tr>
                <tr><td className="border border-border px-2 py-1">Dịch ảnh LadiPage (Nano Banana 2)</td><td className="border border-border px-2 py-1">~$0.04/ảnh</td><td className="border border-border px-2 py-1 text-muted-foreground">Tuỳ số ảnh tick</td></tr>
              </tbody>
            </table>
            <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
              <Estimate dur="24s" scenes={3} cost="$1.62" />
              <Estimate dur="48s" scenes={6} cost="$3.24" />
              <Estimate dur="60s" scenes={8} cost="$4.32" />
            </div>
            <p className="mt-2 text-xs text-muted-foreground italic">Google cho $300 credit miễn phí account mới — đủ test ~70-180 video tuỳ duration.</p>
          </Section>

          <Section emoji="💡" title="Tips chất lượng">
            <ul className="list-disc pl-5 space-y-1.5 text-sm">
              <li><b>Video mẫu rõ</b>: chọn reel có cấu trúc cảnh rõ, audio sạch → Gemini phân tích chuẩn hơn.</li>
              <li><b>Ảnh sản phẩm nền trắng</b>: Nano Banana ghép vào cảnh tốt hơn.</li>
              <li><b>Mô tả nhân vật chi tiết</b>: "tóc dài đen, da trắng, mặc áo blouse trắng" → portrait ổn định hơn "Nữ Việt 25 tuổi".</li>
              <li><b>Edit imagePrompt</b> trước Step 4: thêm "natural lighting, soft focus, no text overlay" → ảnh sạch hơn.</li>
              <li><b>Regen Step 4</b> rẻ ($0.04). <b>Regen Veo Step 5</b> đắt ($0.50/clip) — chắc chắn rồi mới chạy.</li>
            </ul>
          </Section>

          <Section emoji="🔧" title="Lỗi thường gặp">
            <Issue title='"Failed to fetch" khi upload video'>
              Port mismatch — Vite không chạy port 5173. Kill all node, restart <code>npm run dev</code>, kiểm tra log "Local: http://localhost:5173/".
            </Issue>
            <Issue title='"RESOURCE_EXHAUSTED" / 429'>
              Quota Vertex AI hết. Tool tự retry sau 8/16/32s. Nếu vẫn 429 → GCP Console → Vertex AI API → Quotas → xin tăng.
            </Issue>
            <Issue title='Concat "failed to import ffmpeg-core.js"'>
              Self-host ffmpeg trong <code>public/ffmpeg/</code>. Nếu file mất sau clone → <code>npm install</code> rồi copy <code>node_modules/@ffmpeg/core/dist/esm/ffmpeg-core.*</code> sang <code>public/ffmpeg/</code>.
            </Issue>
            <Issue title='Nhân vật không nhất quán giữa cảnh'>
              Mô tả nhân vật quá generic. Thêm chi tiết (tóc, da, trang phục) hoặc upload ảnh tham chiếu vào "custom ref" Step 4.
            </Issue>
            <Issue title='Banner "Vertex AI chưa cấu hình"'>
              File <code>vertex-key.json</code> hoặc <code>.env</code> thiếu / sai path. Hard refresh sau khi đặt file. Restart dev server để Vite reload env.
            </Issue>
          </Section>
        </section>

        {/* ═══════════════════════════════════════════════════
            SECTION 3 — Clone Voice
        ═══════════════════════════════════════════════════ */}
        <section ref={refs.clone} id="clone" className="mb-12 scroll-mt-16">
          <SectionHeading emoji="🎙" title="Clone Voice" color="text-violet-400" />
          <p className="text-sm text-foreground/85 mb-4">
            Sub-mode trong tab AI Video. Thay audio của video gốc bằng audio mới — không re-encode video → nhanh ~5s.
          </p>

          <Section emoji="🔄" title="Quy trình">
            <ol className="list-decimal pl-5 space-y-2 text-sm">
              <li>Vào tab <b>AI Video</b> → chọn sub-tab <b>Clone Voice</b></li>
              <li>Upload <b>video mp4</b> gốc (video cần thay audio)</li>
              <li>Upload <b>audio mới</b> (mp3 / wav / m4a) — hoặc nhận từ tab TTS (xem bên dưới)</li>
              <li>Bấm <b>Swap Audio</b> → server dùng ffmpeg ghép</li>
              <li>Tải <b>output.mp4</b> (video gốc + audio mới)</li>
            </ol>
          </Section>

          <Section emoji="⚙️" title="Kỹ thuật">
            <ul className="list-disc pl-5 space-y-1.5 text-sm">
              <li>Server-side: <code>/api/swap-audio</code> (cấu hình proxy trong <code>vite.config.js</code>)</li>
              <li>ffmpeg command: <code>-c:v copy</code> — không re-encode video stream → giữ nguyên chất lượng gốc, tốc độ xử lý ~5s</li>
              <li>Audio stream được thay hoàn toàn, sync theo video duration</li>
            </ul>
          </Section>

          <Section emoji="🔗" title="Nhận audio từ TTS">
            <Callout color="blue">
              <b>Luồng TTS → Clone Voice:</b> Vào tab TTS → generate audio → bấm nút <b>"Gửi vào Clone Voice"</b> → tool tự động load audio vào ô Clone Voice, không cần download rồi upload lại.
            </Callout>
            <p className="mt-2 text-sm">Use case điển hình: video tiếng Việt → dùng Azure TTS tạo giọng Thai → swap audio → ra video tiếng Thái.</p>
          </Section>
        </section>

        {/* ═══════════════════════════════════════════════════
            SECTION 4 — TTS
        ═══════════════════════════════════════════════════ */}
        <section ref={refs.tts} id="tts" className="mb-12 scroll-mt-16">
          <SectionHeading emoji="🔊" title="TTS — Text to Speech" color="text-cyan-400" />
          <p className="text-sm text-foreground/85 mb-4">
            Chuyển văn bản thành giọng nói qua 4 provider. Chọn provider bằng chip segment ở top tab TTS.
          </p>

          {/* Gemini */}
          <details className="mb-3 rounded-xl border border-cyan-500/30 bg-cyan-500/5">
            <summary className="px-4 py-3 cursor-pointer font-bold text-cyan-300 text-sm hover:bg-cyan-500/10 transition-colors flex items-center gap-2">
              <span className="bg-cyan-500/20 text-cyan-300 text-[10px] font-bold px-1.5 py-0.5 rounded">FREE trial</span>
              Gemini TTS (Vertex AI)
            </summary>
            <div className="px-4 pb-4 pt-2 text-xs text-foreground/85 leading-relaxed space-y-1.5">
              <p>Dùng credit GCP — <b>$300 miễn phí</b> cho account mới, không cần thêm billing.</p>
              <ul className="list-disc pl-5 space-y-1">
                <li>Model: <code>gemini-2.5-flash-tts</code> (mặc định, nhanh) hoặc <code>gemini-2.5-pro-tts</code> (chất lượng cao hơn)</li>
                <li>30 voice prebuilt: Kore, Zephyr, Puck, Charon, Fenrir, Leda, Orus, Aoede, ...</li>
                <li>Output: WAV (tự convert từ PCM 24kHz mono)</li>
                <li>Cần: <code>vertex-key.json</code> + <code>.env</code> có <code>VERTEX_PROJECT_ID</code></li>
              </ul>
            </div>
          </details>

          {/* ElevenLabs */}
          <details className="mb-3 rounded-xl border border-yellow-500/30 bg-yellow-500/5">
            <summary className="px-4 py-3 cursor-pointer font-bold text-yellow-300 text-sm hover:bg-yellow-500/10 transition-colors flex items-center gap-2">
              <span className="bg-yellow-500/20 text-yellow-300 text-[10px] font-bold px-1.5 py-0.5 rounded">Chất lượng cao nhất</span>
              ElevenLabs
            </summary>
            <div className="px-4 pb-4 pt-2 text-xs text-foreground/85 leading-relaxed space-y-1.5">
              <ul className="list-disc pl-5 space-y-1">
                <li><b>Guest mode</b>: KHÔNG cần API key — giới hạn ~10,000 chars/tháng theo IP, dùng được ngay</li>
                <li><b>Paid mode</b>: paste API key vào ô → không giới hạn theo plan của anh</li>
                <li>8 voice preset: Rachel, Adam, Bella, Antoni, Josh, Arnold, Sam, Elli</li>
                <li>Giọng tự nhiên nhất trong 4 provider</li>
              </ul>
            </div>
          </details>

          {/* OpenAI */}
          <details className="mb-3 rounded-xl border border-green-500/30 bg-green-500/5">
            <summary className="px-4 py-3 cursor-pointer font-bold text-green-300 text-sm hover:bg-green-500/10 transition-colors flex items-center gap-2">
              <span className="bg-green-500/20 text-green-300 text-[10px] font-bold px-1.5 py-0.5 rounded">Cần API key</span>
              OpenAI TTS
            </summary>
            <div className="px-4 pb-4 pt-2 text-xs text-foreground/85 leading-relaxed space-y-1">
              <ul className="list-disc pl-5 space-y-1">
                <li>6 voice: alloy, echo, fable, onyx, nova, shimmer</li>
                <li>Chi phí: ~$15/1 triệu ký tự</li>
                <li>Ổn định, latency thấp</li>
              </ul>
            </div>
          </details>

          {/* Azure */}
          <details className="mb-3 rounded-xl border border-blue-500/30 bg-blue-500/5">
            <summary className="px-4 py-3 cursor-pointer font-bold text-blue-300 text-sm hover:bg-blue-500/10 transition-colors flex items-center gap-2">
              <span className="bg-blue-500/20 text-blue-300 text-[10px] font-bold px-1.5 py-0.5 rounded">Việt + Thai tốt nhất</span>
              Azure TTS
            </summary>
            <div className="px-4 pb-4 pt-2 text-xs text-foreground/85 leading-relaxed">
              <p className="mb-2">Cần API key + region. Free tier: <b>500,000 chars/tháng</b>.</p>
              <div className="grid sm:grid-cols-2 gap-3 mt-2">
                <div>
                  <p className="font-bold text-blue-300 mb-1">Giọng Tiếng Việt</p>
                  <ul className="list-disc pl-4 space-y-0.5">
                    <li>vi-VN-HoaiMyNeural (nữ)</li>
                    <li>vi-VN-NamMinhNeural (nam)</li>
                  </ul>
                </div>
                <div>
                  <p className="font-bold text-blue-300 mb-1">Giọng Tiếng Thái</p>
                  <ul className="list-disc pl-4 space-y-0.5">
                    <li>th-TH-AcharaNeural (nữ)</li>
                    <li>th-TH-NiwatNeural (nam)</li>
                    <li>th-TH-PremwadeeNeural (nữ)</li>
                  </ul>
                </div>
              </div>
            </div>
          </details>

          <Section emoji="▶️" title="Sau khi generate">
            <ul className="list-disc pl-5 space-y-1 text-sm">
              <li>Preview audio player ngay trong tab</li>
              <li>Download mp3</li>
              <li>Nút <b>"Gửi vào Clone Voice"</b> → tự động load audio sang sub-tab Clone Voice</li>
            </ul>
          </Section>
        </section>

        {/* FOOTER */}
        <div className="mt-10 mb-6 pt-4 border-t border-border text-center text-xs text-muted-foreground">
          Updated 2026 · Tool by <span className="text-emerald-400 font-bold">anh Kei</span> + Claude
        </div>
      </div>
    </div>
  );
}

// ─────────── helpers ───────────

function SectionHeading({ emoji, title, color }) {
  return (
    <h2 className={`text-xl font-bold ${color} flex items-center gap-2 mb-4 mt-2 pb-2 border-b border-border`}>
      <span>{emoji}</span><span>{title}</span>
    </h2>
  );
}

function Section({ emoji, title, children }) {
  return (
    <section className="mb-6">
      <h3 className="text-sm font-bold text-foreground flex items-center gap-2 mb-2.5 mt-5">
        <span>{emoji}</span><span>{title}</span>
      </h3>
      <div className="text-sm text-foreground/85 leading-relaxed">{children}</div>
    </section>
  );
}

function Step({ n, label, desc, color }) {
  const ringColor = color === 'pink' ? 'bg-pink-500/15 text-pink-400 border-pink-500/30' : 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30';
  return (
    <div className="flex gap-3 items-start">
      <div className={`shrink-0 w-7 h-7 rounded-full ${ringColor} font-bold text-xs flex items-center justify-center border`}>{n}</div>
      <div>
        <div className="font-bold text-foreground text-sm">{label}</div>
        <div className="text-xs text-muted-foreground">{desc}</div>
      </div>
    </div>
  );
}

function Card({ title, border, children }) {
  return (
    <div className={`rounded-xl border ${border} bg-muted/10 p-3`}>
      <div className="font-bold mb-1.5 text-sm">{title}</div>
      <div className="text-xs text-foreground/85">{children}</div>
    </div>
  );
}

function Callout({ color, children }) {
  const colorMap = {
    blue:  'bg-blue-500/10  border-blue-500/30  text-blue-200',
    amber: 'bg-amber-500/10 border-amber-500/30 text-amber-200',
    green: 'bg-green-500/10 border-green-500/30 text-green-200',
  };
  return (
    <div className={`mt-3 p-3 rounded-lg border text-xs ${colorMap[color] || colorMap.blue}`}>
      {children}
    </div>
  );
}

function DetailStep({ n, title, children, color }) {
  const numColor = color === 'pink' ? 'bg-pink-500/20 text-pink-400' : 'bg-violet-500/20 text-violet-400';
  return (
    <details className="mb-2 rounded-lg border border-border bg-muted/10">
      <summary className="px-3 py-2 cursor-pointer text-sm font-bold flex items-center gap-2 hover:bg-muted/30 transition-colors">
        <span className={`w-6 h-6 rounded-full ${numColor} text-[11px] flex items-center justify-center font-bold`}>{n}</span>
        {title}
      </summary>
      <div className="px-3 pb-3 pt-1 text-xs text-foreground/85 leading-relaxed [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1 [&_code]:text-pink-400 [&_code]:text-[11px]">
        {children}
      </div>
    </details>
  );
}

function Issue({ title, children }) {
  return (
    <details className="mb-2 rounded-lg border border-amber-500/20 bg-amber-500/5">
      <summary className="px-3 py-2 cursor-pointer text-xs font-bold text-amber-300 hover:bg-amber-500/10 transition-colors">
        ⚠️ {title}
      </summary>
      <div className="px-3 pb-3 pt-1 text-xs text-foreground/85 leading-relaxed [&_code]:text-pink-400">
        {children}
      </div>
    </details>
  );
}

function Estimate({ dur, scenes, cost }) {
  return (
    <div className="rounded-lg border border-border bg-muted/20 p-2 text-center">
      <div className="text-xs text-muted-foreground">{dur}</div>
      <div className="font-bold text-pink-400 text-base">{cost}</div>
      <div className="text-[10px] text-muted-foreground">{scenes} cảnh</div>
    </div>
  );
}
