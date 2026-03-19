# 🚀 LDP Generator — Template PKE + Dịch Ảnh

Công cụ tạo Landing Page từ Template PKE Webcake & dịch ảnh sản phẩm bằng AI.

## ⚡ Cài đặt nhanh

### Yêu cầu
- **Node.js** phiên bản 18 trở lên — [Tải tại đây](https://nodejs.org/)
- **Git** — [Tải tại đây](https://git-scm.com/)
- **Gemini API Key** — [Lấy miễn phí tại AI Studio](https://aistudio.google.com/apikey)

---

### 🪟 Windows

```powershell
# 1. Clone repo (lần đầu)
git clone https://github.com/kei3k/3K-LDP.git
cd 3K-LDP

# 2. Cài dependencies
npm install

# 3. Chạy
npm run dev
```

**Cập nhật bản mới:**
```powershell
cd 3K-LDP
git pull origin main
npm install
npm run dev
```

---

### 🍎 macOS

```bash
# 1. Cài Node.js (nếu chưa có)
brew install node

# 2. Clone repo (lần đầu)
git clone https://github.com/kei3k/3K-LDP.git
cd 3K-LDP

# 3. Cài dependencies
npm install

# 4. Chạy
npm run dev
```

**Cập nhật bản mới:**
```bash
cd 3K-LDP
git pull origin main
npm install
npm run dev
```

> **Lưu ý macOS:** Nếu gặp lỗi `permission denied`, chạy: `sudo chown -R $USER 3K-LDP`

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
