/**
 * AI Video Pipeline — Hướng dẫn sử dụng.
 * Pure HTML/Tailwind, không cần data từ session.
 */

export default function VideoPipelineHelp() {
  return (
    <div className="flex-1 overflow-y-auto px-6 py-8 bg-background">
      <div className="max-w-3xl mx-auto prose prose-invert prose-sm">

        <h1 className="text-2xl font-bold text-pink-500 mb-1 flex items-center gap-2">
          🎬 AI Video Pipeline — Hướng dẫn sử dụng
        </h1>
        <p className="text-muted-foreground text-sm mb-6">
          Pipeline 6 bước dựng video quảng cáo AI: phân tích video mẫu → sinh kịch bản → tạo ảnh tham chiếu → render Veo 3.1 → ghép.
        </p>

        {/* TỔNG QUAN */}
        <Section emoji="📋" title="Tổng quan pipeline">
          <Step n="1" label="Phân tích" desc="Upload mp4 → Gemini 2.5 Pro đọc audio + visual → JSON template (transcript, cấu trúc cảnh, hook/CTA)" />
          <Step n="2" label="Assets" desc="Upload ảnh sản phẩm (hoặc import Shopee URL) + khai báo nhân vật + chọn duration" />
          <Step n="3" label="Kịch bản" desc="Gemini sinh narration + imagePrompt + videoPrompt cho mỗi cảnh 8s" />
          <Step n="4" label="Ref Images" desc="Nano Banana 2 sinh ảnh tham chiếu — auto-sinh chân dung anchor trước để giữ nhân vật nhất quán" />
          <Step n="5" label="Veo 3.1" desc="Sinh clip 8s mỗi cảnh, dùng ref image làm first frame" />
          <Step n="6" label="Ghép" desc="Tải clip rời + ffmpeg.wasm concat thành video hoàn chỉnh" />
        </Section>

        {/* SETUP */}
        <Section emoji="⚙️" title="Setup ban đầu (đã làm — chỉ tham khảo)">
          <ul className="list-disc pl-5 space-y-1.5 text-sm text-foreground/90">
            <li>Service account GCP <code className="text-pink-400">vertex-nam</code> + JSON key đã đặt ở <code>vertex-key.json</code></li>
            <li>File <code>.env</code> chứa <code>VERTEX_PROJECT_ID</code>, <code>VERTEX_REGION=global</code></li>
            <li>FFmpeg native cần có sẵn trên PATH (để compress video server-side)</li>
            <li>Badge "✓ Vertex AI: project-... (global)" ở góc trên = OK</li>
          </ul>
        </Section>

        {/* 2 CHẾ ĐỘ */}
        <Section emoji="🧭" title="2 chế độ: Wizard vs Flow">
          <div className="grid md:grid-cols-2 gap-3">
            <Card title="🪄 Wizard" border="border-pink-500/40">
              <p>Giao diện dắt tay từng bước 1→6. Có Approve/Edit/Regenerate. <b>Phù hợp cho người mới + việc lặp lại tuần tự</b>.</p>
            </Card>
            <Card title="🔀 Flow" border="border-violet-500/40">
              <p>Canvas node-based như ComfyUI. Kéo-thả node, nối edge, custom config. <b>Phù hợp khi muốn skip step hoặc tái sử dụng pipeline khác</b>.</p>
            </Card>
          </div>
          <p className="mt-3 text-xs text-muted-foreground italic">Toggle "Wizard | Flow" ở góc trên-trái tab AI Video.</p>
        </Section>

        {/* NGÔN NGỮ */}
        <Section emoji="🌐" title="Chọn ngôn ngữ + Bilingual mode">
          <p>Dropdown ngôn ngữ ở top tab — chọn ngôn ngữ <b>nhân vật sẽ nói trong video</b>:</p>
          <ul className="list-disc pl-5 space-y-1 mt-2 text-sm">
            <li>🇻🇳 Tiếng Việt (mặc định) — output thuần Việt</li>
            <li>🇹🇭 ภาษาไทย, 🇺🇸 English, 🇨🇳 中文, 🇯🇵 日本語, 🇰🇷 한국어, 🇮🇩 Indonesia</li>
          </ul>
          <Callout color="blue">
            Khi chọn <b>ngôn ngữ khác Việt</b>, Gemini auto-emit thêm bản dịch Việt (<code>_vi</code> field) → ô gọn dưới mỗi text gốc với chip "VI" xanh dương. Anh đọc Việt để hiểu, edit cả 2 (Thai/Việt) trước khi qua step kế.
          </Callout>
        </Section>

        {/* PERSISTENCE */}
        <Section emoji="💾" title="Auto-save + Resume">
          <p>Mọi data (template, ảnh, clips Veo) tự lưu IndexedDB sau mỗi thay đổi. Refresh / mất điện / đóng tab → mở lại tool:</p>
          <ul className="list-disc pl-5 space-y-1 mt-2 text-sm">
            <li>Banner "♻️ Session đã restore" xuất hiện ở top</li>
            <li>Wizard auto-jump tới step anh dừng</li>
            <li>Nút "🗑 Clear" ở cuối step bar = xoá toàn bộ session</li>
          </ul>
        </Section>

        {/* CHI TIẾT TỪNG STEP */}
        <Section emoji="📝" title="Chi tiết từng step">
          <DetailStep n="1" title="Phân tích video">
            <ul>
              <li>Drag-drop file <code>.mp4</code> (bất kỳ độ dài). Video &gt;18MB tự compress local (ffmpeg native server-side) xuống 480p giữ audio.</li>
              <li>Optional: paste FB Reel URL (chỉ lưu metadata, không fetch).</li>
              <li>Đặt tên template để save vào library — reuse cho video sau.</li>
              <li>Output: transcript + cấu trúc cảnh (hook + scenes + CTA, đều editable).</li>
            </ul>
          </DetailStep>

          <DetailStep n="2" title="Assets (ảnh + nhân vật)">
            <ul>
              <li><b>Import Shopee</b>: paste URL sản phẩm → tool tự fetch tên + 6 ảnh đầu (qua proxy có anti-bot headers)</li>
              <li><b>Upload thủ công</b>: chọn nhiều ảnh, hiện thumbnail có nút X xóa</li>
              <li><b>Nhân vật</b>: form structured — giới tính / quốc tịch / tuổi / mô tả tự do. Bấm "+ Thêm" để có nhiều nhân vật.</li>
              <li><b>Duration</b>: 5 preset (16/24/32/48/60s) hoặc custom. Số cảnh = ceil(duration ÷ 8)</li>
            </ul>
          </DetailStep>

          <DetailStep n="3" title="Sinh kịch bản (Gemini 2.5 Pro)">
            <ul>
              <li>Mỗi cảnh có 3 trường: <code className="text-pink-400">narration</code> (lời thoại, ngôn ngữ đã chọn) + <code className="text-violet-400">imagePrompt</code> (English, cho Nano Banana) + <code className="text-cyan-400">videoPrompt</code> (English, cho Veo)</li>
              <li>Click cảnh nào để xem detail + edit từng field</li>
              <li>Bilingual: nếu khác Việt → có thêm <code>narration_vi</code> để review</li>
            </ul>
          </DetailStep>

          <DetailStep n="4" title="Sinh ảnh tham chiếu (Nano Banana 2)">
            <ul>
              <li><b>Auto-sinh Character Portrait Anchor</b> trước — chân dung close-up neutral background. Dùng làm identity reference cho tất cả cảnh → giữ mặt nhân vật nhất quán</li>
              <li>Mỗi cảnh sinh tuần tự, refs = [portraits, scene_1, scene_prev, products]</li>
              <li>Rate limit 7.5s/call (8 RPM) + auto retry 429 với exponential backoff</li>
              <li><b>Custom ref per scene</b>: hover thumbnail → nút "+" upload ref riêng cho cảnh đó. Checkbox "chỉ ref riêng" = bỏ ảnh sản phẩm mặc định</li>
            </ul>
            <Callout color="amber">
              Regenerate 1 cảnh sẽ hỏi "regen luôn các cảnh sau?" — vì chúng dùng cảnh này làm ref. Đồng ý nếu muốn giữ consistency.
            </Callout>
          </DetailStep>

          <DetailStep n="5" title="Sinh clip Veo 3.1">
            <ul>
              <li>Mỗi cảnh: input = videoPrompt + refImage (làm first frame)</li>
              <li>Max 3 clips song song (semaphore)</li>
              <li>Mỗi clip ~30-60s wall time, preview inline khi xong</li>
              <li>Retry per clip nếu fail</li>
            </ul>
          </DetailStep>

          <DetailStep n="6" title="Ghép video hoàn chỉnh">
            <ul>
              <li><b>Section A — Clip rời</b>: download từng clip / hoặc all-in-zip</li>
              <li><b>Section B — Auto concat</b>: ffmpeg.wasm thử stream-copy trước (~1s), fail thì re-encode (~30s)</li>
              <li><b>Test mode</b>: upload 3 mp4 bất kỳ để test concat không cần Veo</li>
            </ul>
          </DetailStep>
        </Section>

        {/* CHI PHÍ */}
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
              <tr><td className="border border-border px-2 py-1">Gemini 2.5 Pro (analyze + script)</td><td className="border border-border px-2 py-1">~$0.05/video</td><td className="border border-border px-2 py-1 text-muted-foreground">2 calls, video + script</td></tr>
              <tr><td className="border border-border px-2 py-1">Nano Banana 2 (mỗi ảnh)</td><td className="border border-border px-2 py-1">~$0.04</td><td className="border border-border px-2 py-1 text-muted-foreground">Portrait + N cảnh</td></tr>
              <tr><td className="border border-border px-2 py-1">Veo 3.1 (mỗi clip 8s)</td><td className="border border-border px-2 py-1">~$0.50</td><td className="border border-border px-2 py-1 text-muted-foreground">Đắt nhất, chia theo số cảnh</td></tr>
            </tbody>
          </table>
          <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
            <Estimate dur="24s" scenes={3} cost="$1.62" />
            <Estimate dur="48s" scenes={6} cost="$3.24" />
            <Estimate dur="60s" scenes={8} cost="$4.32" />
          </div>
          <p className="mt-2 text-xs text-muted-foreground italic">
            Google cho $300 credit miễn phí account mới — đủ test ~70-180 video tuỳ duration.
          </p>
        </Section>

        {/* TIPS */}
        <Section emoji="💡" title="Tips chất lượng">
          <ul className="list-disc pl-5 space-y-1.5 text-sm">
            <li><b>Video mẫu rõ</b>: chọn reel có cấu trúc cảnh rõ ràng, audio sạch → Gemini phân tích chuẩn hơn.</li>
            <li><b>Ảnh sản phẩm trên nền trắng</b>: Nano Banana ghép vào tay/cảnh tốt hơn.</li>
            <li><b>Mô tả nhân vật chi tiết</b>: "Nữ Việt 25 tuổi" generic — thêm "tóc dài đen, da trắng, mặc áo blouse trắng" → portrait ổn định hơn.</li>
            <li><b>Edit imagePrompt</b> trước khi qua Step 4: thêm "natural lighting, soft focus, no text overlay" giúp Nano Banana ra ảnh sạch.</li>
            <li><b>Regen từ Step 4 trở lên</b> rẻ: chỉ $0.04. Regen Veo Step 5 đắt: $0.50/clip — chắc chắn rồi mới chạy.</li>
          </ul>
        </Section>

        {/* TROUBLESHOOTING */}
        <Section emoji="🔧" title="Lỗi thường gặp">
          <Issue title='"Failed to fetch" khi upload video'>
            Port mismatch — Vite không chạy port 5173 (bị chiếm). Kill all node, restart <code>npm run dev</code>, kiểm tra log "Local: http://localhost:5173/".
          </Issue>
          <Issue title='"RESOURCE_EXHAUSTED" / 429'>
            Quota Vertex AI hết. Tool tự retry sau 8/16/32s. Nếu vẫn 429 → xin tăng quota ở GCP Console → Vertex AI API → Quotas.
          </Issue>
          <Issue title='Concat "failed to import ffmpeg-core.js"'>
            Đã fix bằng cách self-host ffmpeg trong <code>public/ffmpeg/</code>. Nếu file mất sau <code>git clone</code> → chạy <code>npm install</code> rồi copy <code>node_modules/@ffmpeg/core/dist/esm/ffmpeg-core.*</code> sang <code>public/ffmpeg/</code>.
          </Issue>
          <Issue title='Nhân vật không nhất quán giữa các cảnh'>
            Mô tả nhân vật quá generic. Step 4 đã có portrait anchor, nhưng cần mô tả chi tiết (tóc, da, trang phục cụ thể). Hoặc upload ảnh tham chiếu nhân vật vào "custom ref" của Step 4.
          </Issue>
          <Issue title='Vertex AI chưa cấu hình banner'>
            File <code>vertex-key.json</code> hoặc <code>.env</code> thiếu / sai path. Hard refresh sau khi đặt file. Restart dev server để Vite reload env.
          </Issue>
        </Section>

        <div className="mt-10 mb-6 pt-4 border-t border-border text-center text-xs text-muted-foreground">
          Updated 2026 · Tool by <span className="text-pink-400 font-bold">anh Kei</span> + Claude
        </div>
      </div>
    </div>
  );
}

// ─────────── helpers ───────────

function Section({ emoji, title, children }) {
  return (
    <section className="mb-8">
      <h2 className="text-base font-bold text-foreground flex items-center gap-2 mb-3 mt-6">
        <span>{emoji}</span><span>{title}</span>
      </h2>
      <div className="text-sm text-foreground/85 leading-relaxed">{children}</div>
    </section>
  );
}

function Step({ n, label, desc }) {
  return (
    <div className="flex gap-3 items-start mb-2.5">
      <div className="shrink-0 w-7 h-7 rounded-full bg-pink-500/15 text-pink-400 font-bold text-xs flex items-center justify-center border border-pink-500/30">{n}</div>
      <div>
        <div className="font-bold text-foreground">{label}</div>
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
    blue: 'bg-blue-500/10 border-blue-500/30 text-blue-200',
    amber: 'bg-amber-500/10 border-amber-500/30 text-amber-200',
  };
  return (
    <div className={`mt-3 p-3 rounded-lg border text-xs ${colorMap[color] || colorMap.blue}`}>
      {children}
    </div>
  );
}

function DetailStep({ n, title, children }) {
  return (
    <details className="mb-2 rounded-lg border border-border bg-muted/10">
      <summary className="px-3 py-2 cursor-pointer text-sm font-bold flex items-center gap-2 hover:bg-muted/30 transition-colors">
        <span className="w-6 h-6 rounded-full bg-pink-500/20 text-pink-400 text-[11px] flex items-center justify-center font-bold">{n}</span>
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
