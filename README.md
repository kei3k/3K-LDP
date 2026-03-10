# 🚀 LDP Generator — Landing Page Clone Tool

Công cụ clone và localize landing page sử dụng AI (Gemini). Giữ nguyên 100% layout/design gốc, chỉ thay nội dung sản phẩm và ngôn ngữ.

![Preview](https://img.shields.io/badge/React-19-blue) ![Vite](https://img.shields.io/badge/Vite-7-purple) ![AI](https://img.shields.io/badge/Gemini-3.1_Pro-green)

## ✨ Tính năng

- 🔄 **Clone Landing Page** — Giữ nguyên HTML/CSS/JS gốc, chỉ thay text sản phẩm
- 🌍 **Đa ngôn ngữ** — Dịch toàn bộ sang Tiếng Việt, English, Thai, Chinese, Japanese, Korean, Indonesia
- 📱 **Preview responsive** — Xem trước trên 13+ thiết bị (iPhone, Galaxy, iPad, Desktop)
- ✏️ **Inline Editor** — Chỉnh sửa text và hình ảnh trực tiếp trên landing page
- 📝 **Custom Form Fields** — Thêm trường tùy chỉnh vào form đăng ký
- ✨ **Custom Prompt** — Yêu cầu Gemini điều chỉnh thiết kế theo ý bạn
- 📊 **Tracking** — Tích hợp Google Ads, Facebook Pixel, TikTok Pixel, Google Sheet webhook
- 📦 **Export** — Copy HTML cho Webcake.io, tải file HTML, deploy lên Vercel

## 📋 Yêu cầu

- [Node.js](https://nodejs.org/) phiên bản **18+** (khuyến nghị LTS)
- [Gemini API Key](https://aistudio.google.com/apikey) (miễn phí)

## 🚀 Cài đặt & Chạy

### Windows (1 click)

```
Nhấp đúp vào file: install_and_run.bat
```

### Mac / Linux

```bash
chmod +x start.sh
./start.sh
```

### Hoặc chạy thủ công

```bash
# Cài đặt thư viện
npm install

# Chạy
npm run dev
```

Mở trình duyệt tại **http://localhost:5173**

## 📖 Hướng dẫn sử dụng

### Bước 1: Cấu hình API
1. Lấy API key miễn phí tại [Google AI Studio](https://aistudio.google.com/apikey)
2. Dán API key vào phần **"Cài đặt API"**
3. Chọn model (khuyến nghị **Gemini 3.1 Pro**)

### Bước 2: Nhập thông tin sản phẩm
- **Tên sản phẩm**: Tên sản phẩm mới của bạn
- **Mô tả ngắn**: 2-3 câu mô tả sản phẩm
- **Lợi ích**: Mỗi dòng 1 lợi ích
- **Ngôn ngữ**: Chọn ngôn ngữ đầu ra cho landing page

### Bước 3: Nhập landing page mẫu
**Cách 1 — Nhập URL** (tự động):
- Dán link landing page mẫu vào ô URL

**Cách 2 — Dán HTML** (tin cậy hơn):
1. Mở trang mẫu trong trình duyệt
2. Nhấn `Ctrl+U` (View Source)
3. `Ctrl+A` → `Ctrl+C` (copy toàn bộ)
4. Dán vào ô **"HOẶC dán HTML trực tiếp"**

### Bước 4: Tạo Landing Page
Nhấn **"Tạo Landing Page"** → Chờ 10-30 giây

### Bước 5: Tùy chỉnh & Xuất
- Xem trước trên nhiều thiết bị (iPhone, iPad, Desktop...)
- Chỉnh sửa inline (nhấn nút "Chỉnh sửa")
- Copy HTML cho Webcake hoặc tải file HTML

## 🛠️ Tính năng nâng cao

### Custom Prompt
Viết yêu cầu trong ô **"✨ Hướng dẫn tùy chỉnh"** để Gemini điều chỉnh:
- "Đổi màu nền thành gradient xanh đậm"
- "Thêm section FAQ ở cuối"
- "Làm nút CTA to hơn, bo tròn"

### Custom Form Fields
Thêm trường tùy chỉnh vào form đăng ký:
- Text, Số điện thoại, Email, Textarea, Dropdown
- Đặt placeholder và bắt buộc/tùy chọn

### Tracking
- **Google Sheet Webhook**: Gửi data form về Google Sheet
- **Facebook Pixel**: Theo dõi conversion
- **TikTok Pixel**: Theo dõi TikTok Ads
- **Google Ads**: Tracking code tùy chỉnh

## 📁 Cấu trúc dự án

```
├── src/
│   ├── App.jsx              # Layout chính
│   ├── main.jsx             # Entry point
│   ├── index.css            # Theme & styles
│   ├── components/
│   │   ├── ConfigForm.jsx   # Form cấu hình sidebar
│   │   ├── PreviewPanel.jsx # Preview với device presets
│   │   ├── HtmlEditor.jsx   # Inline editor
│   │   ├── ImageUploader.jsx # Upload ảnh sản phẩm
│   │   └── ExportButtons.jsx # Nút xuất/tải
│   └── lib/
│       ├── gemini.js        # Gemini API & clone logic
│       ├── generator.js     # Pipeline sinh landing page
│       └── templates/       # Template fallback
├── install_and_run.bat      # 1-click Windows
├── start.sh                 # 1-click Mac/Linux
├── vite.config.js           # Vite + proxy config
└── package.json
```

## ❓ FAQ

**Q: Có cần trả phí Gemini API không?**
A: Không, Gemini API có tier miễn phí đủ dùng.

**Q: Landing page clone có giống 100% trang gốc không?**
A: Layout/CSS/JS giữ 100%. Nội dung text được dịch sang ngôn ngữ bạn chọn. Kết quả ~90-95% giống trang gốc.

**Q: Trang mẫu bị chặn khi nhập URL?**
A: Dùng cách 2 — dán HTML trực tiếp (Ctrl+U → copy → paste).

## 📄 License

MIT License — Tự do sử dụng và chỉnh sửa.
