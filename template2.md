# TEMPLATE 2 – LANDING PAGE BÁN SẢN PHẨM (HUD HIỂN THỊ TỐC ĐỘ)

## 0. Link landing page mẫu

Mẫu tham khảo: https://www.buydash.click/hudhienthitocdo

Landing page này là template bán 1 sản phẩm, tập trung nhiều hơn vào feedback ở phía trên.  
Input chính: link sản phẩm từ 1688, từ đó sinh ra một landing page theo cấu trúc chuẩn bên dưới.

---

## 1. Mô tả tổng quan Template 2

Hãy tạo một landing page bán 1 sản phẩm theo Template 2. Landing page nhận input chính là `link_1688` của sản phẩm. Từ link này, tự động lấy: tên sản phẩm, hình ảnh, giá tham khảo, một số điểm nổi bật nếu có. Cho phép override thủ công các text quan trọng như: tiêu đề, mô tả ngắn, giá bán, lợi ích. Template này có các section:

1. Carousel sản phẩm
2. Tóm tắt sản phẩm (tiêu đề, review, giao hàng, giá)
3. Feedback khách hàng (đặt sớm, phía trên)
4. Mô tả chi tiết / Lợi ích
5. (Bỏ qua số 5 trong mô tả gốc)
6. Form đặt hàng
7. Chính sách & Cam kết
8. Footer
9. Nút MUA NGAY cố định khi scroll

---

## 2. Section 1 – Carousel 5 ảnh vuông

Tạo Section 1 là carousel hiển thị tối đa 5 ảnh sản phẩm dạng hình vuông.

- Ảnh ưu tiên lấy tự động từ link 1688.  
- Nếu số ảnh sản phẩm < 5 thì hiển thị đúng số ảnh hiện có, không thêm ảnh giả.  
- Cho phép cấu hình thủ công danh sách ảnh (image_url, alt_text) để ghi đè nếu cần.  
- Carousel hỗ trợ vuốt trên mobile và chuyển slide tự động sau vài giây.

---

## 3. Section 2 – Tóm tắt sản phẩm (tiêu đề, review, giao hàng, giá)

Tạo Section 2 hiển thị tóm tắt sản phẩm giống cấu trúc Template 1, gồm:

- **Tiêu đề sản phẩm**  
  - Mặc định lấy từ tên sản phẩm 1688.  
  - Cho phép override bằng text nhập tay.

- **Mô tả/benefit ngắn (sub-title)**  
  - Tự động gợi ý 1–2 dòng lợi ích nổi bật của HUD hiển thị tốc độ (ví dụ: xem tốc độ rõ ràng, an toàn hơn khi lái xe, hạn chế bị bắn tốc độ).  
  - Cho phép chỉnh sửa thủ công.

- **Khối đánh giá (rating)**  
  - Hiển thị số sao (ví dụ 4.9/5) và tổng số đánh giá.  
  - Có thể lấy dữ liệu từ 1688 nếu có hoặc nhập tay.

- **Thông tin giao hàng**  
  - Liệt kê 2–3 bullet như:  
    - Giao hàng toàn quốc  
    - Kiểm tra hàng trước khi thanh toán  
    - Bảo hành sản phẩm  
  - Nội dung có thể chỉnh sửa linh hoạt.

- **Khối giá bán**  
  - Hiển thị giá gốc, giá khuyến mãi, phần trăm giảm (nếu có).  
  - Cho phép auto-fill từ dữ liệu 1688 hoặc nhập tay giá riêng cho thị trường Việt Nam.  
  - Có thể hiển thị badge giảm giá, flash sale nếu cần.

---

## 4. Section 3 – Feedback khách hàng (ảnh + text hoặc chỉ text)

Tạo Section 3 hiển thị feedback của khách hàng, được đặt sớm ngay sau phần tóm tắt để tăng độ tin tưởng.

- Mỗi feedback gồm:  
  - Tên khách (có thể cố định hoặc ẩn, ví dụ “Anh T.”, “Chị H.”).  
  - Số sao đánh giá.  
  - Nội dung nhận xét.  
  - Ảnh thật (nếu có).

Yêu cầu xử lý tên và ảnh khách:

- Tên và avatar khách hàng có thể cấu hình cố định (ví dụ một số tên generic) nếu không muốn upload thật.  
- Cho phép tùy chọn:
  - Trường hợp 1: Up ảnh thật của khách (image_url), hiển thị avatar/ảnh lớn.  
  - Trường hợp 2: Không up ảnh thì hiển thị icon avatar mặc định và chỉ dùng text review.

Hiển thị nhiều feedback theo dạng list hoặc slider, tùy thiết kế.  
Nên có tiêu đề section như: “Khách hàng đánh giá HUD hiển thị tốc độ” hoặc tương tự.

---

## 5. Section 4 – Mô tả chi tiết / Lợi ích (tối đa 6 item)

Tạo Section 4 hiển thị chi tiết lợi ích/công dụng của sản phẩm HUD.

- Mỗi item gồm:  
  - Ảnh minh họa (ví dụ ảnh sản phẩm ở các góc sử dụng khác nhau)  
  - Tiêu đề ngắn (headline)  
  - Đoạn mô tả chi tiết

- Tối đa 6 lợi ích:
  - Nếu số lợi ích ít hơn 6 thì chỉ hiển thị đúng số lượng đang có.  
  - Nếu không có lợi ích nào được nhập thì ẩn hoàn toàn section này.

- Cho phép upload ảnh và nhập text cho từng benefit.  
- Có thể map nội dung dựa trên mô tả sản phẩm từ 1688 (ví dụ: hiển thị tốc độ rõ nét, nhiều chế độ hiển thị, lắp đặt đơn giản, phù hợp nhiều dòng xe), nhưng vẫn ưu tiên cho phép sửa tay.

---

## 6. Section 6 – Form đặt hàng

Tạo form đặt hàng chuẩn COD với các trường:

- Họ tên (bắt buộc)  
- Số điện thoại (bắt buộc, validate số Việt Nam)  
- Địa chỉ nhận hàng (bắt buộc)  
- Chọn combo (bắt buộc, dạng select, mỗi option có tên combo + giá)  
- Ghi chú thêm (không bắt buộc)

Yêu cầu:

- Nút submit: “ĐẶT HÀNG NGAY”, màu nổi bật.  
- Khi submit sẽ gửi dữ liệu lên endpoint cấu hình sẵn.  
- Form đặt ở giữa-cuối trang, sau phần feedback và mô tả chi tiết.

---

## 7. Section 7 – Chính sách & Cam kết

Tạo Section 7 hiển thị các chính sách và cam kết của shop.

- Mỗi item gồm: icon, headline ngắn và mô tả chi tiết.  
- Ví dụ một số cam kết:  
  - Sản phẩm đúng mô tả – Đổi trả nếu không đúng như quảng cáo  
  - Bảo hành theo chính sách shop  
  - Hỗ trợ kỹ thuật lắp đặt (nếu có)

Nội dung các bullet có thể chỉnh sửa linh hoạt theo từng sản phẩm/shop.

---

## 8. Section 8 – Footer

Tạo Section 8 là footer hiển thị thông tin doanh nghiệp:

- Tên công ty/chủ shop  
- Địa chỉ  
- Số điện thoại hotline  
- Email liên hệ  
- Một dòng ghi chú thêm (nếu cần)

Cho phép hiển thị link tới các trang chính sách như:

- Chính sách bảo mật  
- Chính sách đổi trả  
- Điều khoản sử dụng  

Link có thể là anchor trong trang hoặc link ngoài.

---

## 9. Section 9 – Nút MUA NGAY cố định

Tạo một nút “MUA NGAY” dạng cố định (sticky button) nằm ở cạnh dưới màn hình, ưu tiên hiển thị trên mobile khi người dùng scroll.

Yêu cầu:

- Khi người dùng bấm vào nút “MUA NGAY” thì tự động cuộn (scroll) đến vị trí form đặt hàng (Section 6).  
- Nút luôn hiển thị khi người dùng cuộn xuống, có thể ẩn nếu form đang nằm trong khung nhìn (viewport) nếu implement được.  
- Thiết kế nút nổi bật, dễ bấm trên màn hình nhỏ.
