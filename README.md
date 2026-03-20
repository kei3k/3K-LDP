# 🚀 LDP Generator — Template PKE + Dịch Ảnh

Công cụ tạo Landing Page từ Template PKE Webcake & dịch ảnh sản phẩm bằng AI.

---

## 📋 Phiên bản

| Tag | Ngày | Nội dung |
|-----|------|----------|
| **v2.1** | 2026-03-20 | Fix preview layout, PKE export cải thiện, gitignore update |
| **v2.0** | 2026-03-18 | Template PKE Wizard 4 bước + Image Translator |
| **v1.0** | 2026-03-12 | LDP Generator đầu tiên — Clone & Localize Landing Pages với Gemini AI |

---

## ⚡ Cài đặt mới (lần đầu)

### Yêu cầu
- **Node.js** phiên bản 18+ — [Tải tại đây](https://nodejs.org/)
- **Git** — [Tải tại đây](https://git-scm.com/)
- **Gemini API Key** — [Lấy miễn phí tại AI Studio](https://aistudio.google.com/apikey)

### 🪟 Windows

```powershell
# 1. Clone repo
git clone https://github.com/kei3k/3K-LDP.git

# 2. Vào thư mục
cd 3K-LDP

# 3. Cài dependencies
npm install

# 4. Chạy tool
npm run dev
```

> Hoặc **click đúp** file `install_and_run.bat` để tự động cài + chạy.

### 🍎 macOS / Linux

```bash
# 1. Cài Node.js (nếu chưa có)
brew install node         # macOS
# sudo apt install nodejs npm   # Ubuntu/Debian

# 2. Clone repo
git clone https://github.com/kei3k/3K-LDP.git
cd 3K-LDP

# 3. Cài dependencies
npm install

# 4. Chạy tool
npm run dev
```

> **macOS:** Nếu gặp lỗi `permission denied`, chạy: `sudo chown -R $USER 3K-LDP`

---

## 🔄 Cập nhật lên bản mới

### 🪟 Windows

```powershell
cd 3K-LDP
git pull origin main
npm install
npm run dev
```

### 🍎 macOS / Linux

```bash
cd 3K-LDP
git pull origin main
npm install
npm run dev
```

> **Lưu ý:** `npm install` chỉ cần khi có thay đổi dependencies. Nếu `git pull` chỉ báo sửa code, có thể bỏ qua bước này.

### Quay về phiên bản cũ

```bash
# Xem danh sách phiên bản
git tag --list

# Chuyển về phiên bản cụ thể (ví dụ v2.0)
git checkout v2.0

# Quay lại bản mới nhất
git checkout main
```

---

## 🎯 Cách sử dụng

### Tab 1: 📦 Template PKE

1. **Upload file .PKE** từ Webcake
2. **Dán HTML trang 1688** (Ctrl+U / Cmd+U → copy) hoặc nhập link 1688
3. Bấm **"Bắt đầu tạo LDP mới"** → 4 bước wizard:
   - **Trích xuất**: Xem/sửa data sản phẩm mới
   - **Ảnh**: Re-host & preview ảnh cũ → mới
   - **Text**: Đọc bản dịch Việt, chỉnh bản ngôn ngữ đích
   - **Xuất**: Tải file PKE mới
4. **Import file .PKE** vào Webcake — mọi element vẫn editable ✨

### Tab 2: 🌐 Dịch ảnh SP

1. **Kéo thả ảnh** hoặc dán URL ảnh từ 1688
2. **Chọn ngôn ngữ đích** (Thai, Việt, Anh, Trung, Nhật, Hàn...)
3. **Chọn model AI** (Nano Banana 2 hoặc Nano Banana Pro)
4. Bấm **"Dịch X ảnh"** → Gemini dịch text trên ảnh
5. **Tải về** hoặc **Upload ImgBB + copy URL** để dùng trong template

---

## ⚙️ Cấu hình

Khi mở app, nhập **Gemini API Key** ở phần **Cài đặt API** trong sidebar.
Key được lưu trong localStorage, chỉ cần nhập 1 lần.

---

## 📌 Lưu ý quan trọng

- **Tracking code** (Facebook Pixel, Google Ads, TikTok, GTM) giữ nguyên theo template
- **Footer & thanh sticky** CTA không bị thay ảnh
- **ImgBB** sử dụng 4 API key xoay vòng, delay 1.5s giữa mỗi upload
- Ảnh từ **alicdn.com** tự động qua proxy với Referer header
