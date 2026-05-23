# Hướng dẫn setup Google Cloud (Vertex AI) cho tool AI Video Pipeline

> Mục tiêu: tool gọi được **Veo 3.1** + **Nano Banana 2** trên Vertex AI mà khách chỉ cần mở dùng, không cần config gì. Anh Kei làm 1 lần ban đầu.

## ⏱ Tổng thời gian: ~10 phút

---

## Bước 1 — Tạo Google Cloud Project (2p)

1. Mở https://console.cloud.google.com → đăng nhập Google của anh.
2. Click dropdown project ở góc trên-trái → **New Project**.
3. Đặt tên ví dụ: `ai-video-tool` → **Create**.
4. Đợi 30s, chọn project vừa tạo (dropdown).
5. **Copy Project ID** (dạng `ai-video-tool-XXXXXX`) — paste vào file `.env` sau.

---

## Bước 2 — Bật Billing (3p, BẮT BUỘC)

> Veo 3.1 và Nano Banana 2 đều **không có free tier** — phải có thẻ credit/visa kết nối. Google cho **$300 credit miễn phí** cho account mới (~90 ngày).

1. Console → menu trái → **Billing**.
2. **Link a billing account** → tạo mới nếu chưa có.
3. Nhập thông tin thẻ. Google sẽ charge $1 verify rồi trả lại.

**Lưu ý chi phí thực tế:**
- Nano Banana 2 (image): ~$0.04 / ảnh (1024x1024)
- Veo 3.1 (video 8s 9:16): ~$0.50 / clip
- Test 1 video 24s = 3 ảnh + 3 clip ≈ **$1.62**

---

## Bước 3 — Enable Vertex AI API (1p)

1. Console → search bar gõ **"Vertex AI API"** → click kết quả đầu.
2. Click **Enable**. Đợi ~30s.

---

## Bước 4 — Tạo Service Account (2p)

1. Console → menu trái → **IAM & Admin** → **Service Accounts**.
2. **+ Create Service Account**:
   - Name: `video-tool-runner`
   - **Create and Continue**.
3. **Grant role**: chọn **Vertex AI User** (gõ "vertex" để filter).
   - **Continue** → **Done**.

---

## Bước 5 — Download JSON key (1p)

1. Click vào service account vừa tạo (`video-tool-runner@...`).
2. Tab **Keys** → **Add Key** → **Create new key** → JSON → **Create**.
3. File JSON tự download. **Đổi tên** thành `vertex-key.json`.
4. Đặt file này vào thư mục root của tool:
   ```
   D:\K\ToolNam\.claude\worktrees\hardcore-payne-74b124\vertex-key.json
   ```

> ⚠️ File này tương đương mật khẩu — KHÔNG commit lên git. Em đã thêm vào `.gitignore` sẵn.

---

## Bước 6 — Tạo file .env (30s)

Tạo file `.env` trong cùng thư mục với `package.json`, nội dung:

```bash
# GCP Service Account JSON path (relative to project root)
VERTEX_KEY_FILE=./vertex-key.json

# GCP Project ID (lấy từ Bước 1)
VERTEX_PROJECT_ID=ai-video-tool-XXXXXX

# Region — us-central1 hỗ trợ Veo 3.1 và Nano Banana 2 tốt nhất
VERTEX_REGION=us-central1
```

Thay `ai-video-tool-XXXXXX` bằng Project ID thật của anh.

---

## Bước 7 — Báo em đã xong

Anh chỉ cần báo "**xong rồi**" và **paste Project ID** vào chat.
Em sẽ:
1. Restart Vite dev server để load .env mới
2. Gọi 1 API test (rẻ, ~$0.04) verify proxy auth chạy được
3. Chạy thử Step 1 (analyze video) với mp4 mẫu
4. Báo kết quả + chi phí

---

## FAQ

**Q: Em deploy production sau này khách dùng được không?**
A: Được. Khi deploy, anh copy `vertex-key.json` + `.env` lên server (KHÔNG bundle vào client). Khách chỉ mở URL là dùng được.

**Q: Token có hết hạn không?**
A: Tool tự refresh access token mỗi 50 phút (server-side, anh không thấy).

**Q: Nếu hết $300 credit?**
A: Console → Billing → Budgets & alerts → set cảnh báo ở $250 để biết trước.
