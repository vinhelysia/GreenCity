# GreenCity — Tài liệu thuyết trình

Dành cho người trình bày. Đọc mục 1, 2, 4 là đủ để nói. Mục 6–8 để trả lời
câu hỏi của ban giám khảo.

---

## 1. Nói trong 30 giây (học thuộc phần này)

> "Người bán phế liệu ở Việt Nam hầu như không biết mình đáng được trả bao
> nhiêu — giá do người thu mua quyết. Cùng lúc đó, điểm rác tự phát mọc lên
> khắp nơi mà người dân thấy nhưng không có kênh nào để báo.
>
> GreenCity giải quyết cả hai bằng một nền tảng: chợ phế liệu **niêm yết giá
> công khai**, và kênh **báo điểm rác có thưởng**. Điều khác biệt là sự minh
> bạch của chúng tôi không phải lời hứa — nó được ràng buộc trong hệ thống:
> nhân viên của chính chúng tôi cũng **không thể** báo giá nằm ngoài khung giá
> đã công bố. Hệ thống sẽ từ chối."

Câu cuối là câu mạnh nhất. Nói chậm lại ở đó.

---

## 2. Vấn đề (30 giây)

**Với người bán:**
- Không biết giá thị trường, phụ thuộc hoàn toàn vào người thu mua.
- Mỗi lần bán là một lần thương lượng riêng lẻ, không có chuẩn nào.

**Với môi trường đô thị:**
- Điểm rác tự phát xuất hiện nhanh, xử lý chậm.
- Người dân nhìn thấy hằng ngày nhưng không có kênh báo hiệu quả, và cũng
  không có lý do gì để bỏ công ra báo.

**Điểm chung:** cả hai vấn đề đều thiếu *niềm tin* và thiếu *động lực*.

---

## 3. Giải pháp

GreenCity nối hai hoạt động vào một vòng lặp:

1. **Bán phế liệu** — người bán chụp ảnh, gửi yêu cầu, nhận báo giá nằm trong
   khung giá đã niêm yết công khai, chấp nhận thì lô hàng lên chợ.
2. **Báo điểm rác** — người dân chụp ảnh, ghim vị trí bằng GPS hoặc bản đồ,
   ban quản lý xác minh, người báo nhận **50 điểm thưởng**.
3. **Chợ online** — doanh nghiệp tái chế mua gói người mua để đặt giữ lô hàng.

Điểm thưởng gắn hai hoạt động lại: bán phế liệu được điểm, báo điểm rác cũng
được điểm.

---

## 4. Kịch bản demo (5 bước — tập trước ít nhất 2 lần)

Mở sẵn `https://green-city-web.vercel.app` trên trình duyệt, **đăng nhập
sẵn**, và mở sẵn tab quản trị ở cửa sổ thứ hai.

| Bước | Làm gì | Câu nói kèm theo |
|---|---|---|
| 1 | Mở trang chủ, chỉ vào bảng số liệu | "Những con số này đọc thẳng từ cơ sở dữ liệu đang chạy. Không có con số nào chúng tôi tự điền vào." |
| 2 | Vào **Bán phế liệu**, chỉ vào khung giá của từng loại | "Khung giá được công khai trước. Người bán biết mình sẽ nhận khoảng bao nhiêu *trước khi* gửi yêu cầu." |
| 3 | Vào **Đóng góp**, bấm "Dùng vị trí hiện tại", cho thấy ghim rơi đúng chỗ | "Người dân đứng ngay tại điểm rác, bấm một nút. Toạ độ chính xác đi thẳng tới đội xác minh." |
| 4 | Chuyển sang tab quản trị, mở hàng chờ, chỉ vào toạ độ + link bản đồ | "Người xác minh mở đúng vị trí trên bản đồ, không phải đoán từ địa chỉ gõ tay." |
| 5 | Vào **Chợ online**, chỉ vào giá tổng và khung giá công khai bên dưới | "Người mua thấy cả giá lô hàng lẫn khung giá công khai của loại phế liệu đó. Không có giá nào được thoả thuận kín." |

**Mẹo:** nếu mạng chậm, API chạy trên gói miễn phí nên lần gọi đầu có thể mất
~30 giây để khởi động. **Mở trang trước khi lên sân khấu 1–2 phút** để hệ
thống "nóng máy".

---

## 5. Ba điểm khác biệt (dùng khi giám khảo hỏi "khác gì các bên khác?")

### 5.1. Minh bạch giá là *ràng buộc*, không phải lời hứa

Mọi loại phế liệu có một khung giá công khai. Khi nhân viên của GreenCity báo
giá, hệ thống kiểm tra giá đó có nằm trong khung không — **nếu ngoài khung,
server từ chối**, không phải cảnh báo, mà là từ chối.

> Nói thế này: "Chúng tôi không tự tin vào kỷ luật của nhân viên mình. Chúng
> tôi viết luật đó vào hệ thống."

### 5.2. Sổ điểm thưởng chỉ ghi thêm, không sửa được

Không có ô "số dư" nào để ai đó sửa. Số dư của bạn = tổng các dòng ghi nhận.
Mỗi điểm truy ngược được về đúng sự việc đã sinh ra nó, và một sự việc chỉ
được cộng đúng một lần.

> Nói thế này: "Điểm thưởng không thể tự nhiên xuất hiện. Muốn có điểm thì
> phải có một giao dịch hoặc một báo cáo đã được xác minh đứng sau."

### 5.3. Bảo vệ người bán khỏi bị "đi đêm"

Tin đăng trên chợ **cố ý không hiển thị** danh tính, liên hệ hay vị trí chính
xác của người bán. Người mua không thể liên hệ riêng để ép giá ngoài nền tảng.

Tương tự với điểm rác: toạ độ chính xác chỉ người báo và ban quản lý thấy;
danh sách công khai chỉ hiện quận/thành phố.

---

## 6. Mô hình doanh thu

| Nguồn | Chi tiết |
|---|---|
| **Gói người mua** | 50.000đ / 30 ngày, thanh toán VietQR qua payOS, **không tự động gia hạn** |
| **Chênh lệch giá** | Hệ thống lưu riêng giá trả người bán và giá thu người mua |

Chọn "không tự động gia hạn" là có chủ đích: người dùng Việt Nam rất ngại đăng
ký thứ tự động trừ tiền. Đây là quyết định đánh đổi doanh thu lấy niềm tin.

---

## 7. Công nghệ (chỉ nói khi được hỏi)

- **Web:** Next.js 15 / React 19, triển khai trên Vercel, song ngữ Việt–Anh.
- **API:** NestJS 11 trên Render.
- **Dữ liệu:** PostgreSQL + PostGIS trên Supabase.
- **Thanh toán:** payOS (VietQR), xác thực webhook bằng chữ ký HMAC.
- **Bản đồ:** OpenStreetMap + Leaflet — miễn phí, không cần khoá API, không
  phụ thuộc Google.
- **Hỗ trợ trực tuyến:** Chatwoot, có xác thực danh tính bằng HMAC nên nhân
  viên hỗ trợ biết chắc mình đang nói chuyện với ai.
- **Bảo mật:** mật khẩu băm bằng Argon2id, phiên đăng nhập lưu trong cơ sở dữ
  liệu (thu hồi được), kiểm tra Origin chống CSRF, giới hạn số lần đăng nhập.

---

## 8. Câu hỏi giám khảo hay hỏi (chuẩn bị sẵn)

**"Làm sao đảm bảo giá minh bạch thật, không phải nói suông?"**
> Khung giá công khai trước. Server từ chối mọi báo giá nằm ngoài khung, kể cả
> báo giá từ nhân viên của chúng tôi. Đó là ràng buộc kỹ thuật, không phải quy
> định nội bộ.

**"Điểm thưởng có phải là tiền ảo không? Có bị coi là tiền tệ không?"**
> Không. Điểm không mua bán được, không chuyển nhượng được, và hiện chưa mở
> đổi điểm. Hướng đổi sang dịch vụ công của thành phố mới ở mức đề xuất.

**"Làm sao chống báo cáo điểm rác giả để lấy điểm?"**
> Mỗi báo cáo bắt buộc có ảnh, mỗi ảnh chỉ dùng được cho đúng một báo cáo, và
> phải qua ban quản lý xác minh mới được cộng điểm. Có toạ độ GPS nên kiểm tra
> chéo được vị trí.

**"Sao không dùng Google Maps?"**
> OpenStreetMap không cần khoá API, không cần tài khoản thanh toán, và không
> khoá chúng tôi vào một nhà cung cấp. Với quy mô hiện tại thì chi phí bằng 0.

**"Quy mô hiện tại tới đâu?"**
> Đang thí điểm ở TP.HCM. Nếu ai đó ghim vị trí ngoài thành phố, hệ thống báo
> rõ là chưa thu gom ở khu vực đó nhưng **vẫn nhận báo cáo** — vì một điểm rác
> có thật thì vẫn đáng được ghi nhận.

**"Ai thu gom rác sau khi xác minh?"**
> Hiện tại đơn vị vệ sinh của địa phương làm việc đó. GreenCity chưa điều phối
> khâu thu gom — chúng tôi nói rõ điều này trên trang web.

---

## 9. Thành thật về giới hạn (đừng giấu — giám khảo sẽ tìm ra)

Nếu bị hỏi "còn gì chưa làm được", trả lời thẳng. Thành thật ở đây **tăng**
điểm tin cậy:

- **payOS chưa chạy với tài khoản merchant thật.** Luồng thanh toán đã viết
  xong và có kiểm thử tự động, nhưng chưa giao dịch thật lần nào.
- **Chưa điều phối thu gom.** Chúng tôi ghi nhận và xác minh điểm rác; việc
  thu gom vẫn do đơn vị địa phương thực hiện.
- **Chưa mở đổi điểm thưởng.**
- **Số liệu hiện tại là dữ liệu demo,** không phải người dùng thật.

> Câu nên nói: "Chúng tôi chọn làm ít tính năng nhưng làm cho chạy thật, thay
> vì trình diễn nhiều thứ chưa hoạt động."

---

## 10. Lưu ý cuối trước khi lên trình bày

- [ ] Mở sẵn trang web và **đăng nhập trước 1–2 phút** (API gói miễn phí cần
      thời gian khởi động).
- [ ] Mở sẵn 2 tab: giao diện người dùng + giao diện quản trị.
- [ ] Chuẩn bị sẵn 1 ảnh trong máy để demo phần báo điểm rác.
- [ ] Có phương án dự phòng: nếu mạng hỏng, dùng ảnh chụp màn hình đã lưu.
- [ ] **Không thổi phồng số liệu.** Nếu bị hỏi có bao nhiêu người dùng, nói
      thật là đang ở giai đoạn demo. Con số nhỏ mà thật thì mạnh hơn con số to
      mà bịa.
