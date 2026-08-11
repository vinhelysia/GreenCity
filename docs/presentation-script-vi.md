# GreenCity — Kịch bản thuyết trình (5 phút + demo)

**Dùng kèm:** `docs/product-details-vi.md` (nội dung sản phẩm) và
`docs/demo-runbook.md` (chuẩn bị kỹ thuật trước giờ diễn).

**Luật bất di bất dịch:** không nêu số người dùng, doanh thu, tác động môi
trường, tên đối tác đã ký, hay "thanh toán đã chạy" — vì chưa có bằng chứng nào
cho những điều đó. Sức mạnh của bài này nằm ở **một vòng lặp chạy thật, truy vết
được**, chứ không ở con số.

---

## 0. Phân vai (nếu trình bày nhóm)

| Vai | Việc |
|---|---|
| **Người kể chuyện** | Slide 1–2 và 6–8, giữ nhịp thời gian |
| **Người demo** | Slide 3–4, tay đặt sẵn trên bàn phím, đã đăng nhập sẵn 2 tab |
| **Người kỹ thuật** | Slide 5 và đỡ các câu hỏi kiến trúc / bảo mật ở Q&A |

Nếu chỉ có một người: vẫn giữ nguyên trình tự, mở sẵn 3 tab trình duyệt trước khi
lên (seller / buyer / admin) để không mất thời gian đăng nhập trên sân khấu.

---

## 1. Kịch bản 5 phút — 8 slide, có lời thoại

### Slide 1 · 0:00–0:30 — Vòng lặp đang đứt

**Hiện trên màn hình:** slogan *"Rác có người mua! Người báo điểm rác!"*

> "Một ký giấy carton ở nhà bạn có giá. Nhưng người bán không biết giá đó là bao
> nhiêu, vựa thu mua không biết ở đâu có hàng, còn một đống rác tự phát ngoài
> đường thì không ai ghi nhận là nó tồn tại.
>
> Ba việc này đang xảy ra rời rạc. GreenCity nối chúng thành **một vòng lặp duy
> nhất, và quan trọng hơn — một vòng lặp truy vết được**.
>
> Chúng em nói trước một điều: đây là sản phẩm đang chạy, chưa có người dùng
> thật. Tất cả những gì các thầy cô sắp thấy đều là chức năng chạy thật trên
> code, không phải bản dựng hình."

*(Câu cuối là câu đắt giá nhất bài. Nói chậm.)*

---

### Slide 2 · 0:30–1:05 — Vòng lặp sản phẩm hiện tại

**Hiện trên màn hình:** sơ đồ 5 khối

```
Người bán gửi ảnh  →  Admin báo giá trong khung công khai  →  Lên chợ
     →  Người mua có Gói đặt giữ (một người thắng)  →  Admin xác nhận hoàn tất
     →  Cộng điểm vào sổ chỉ-ghi-thêm
                      ↑
     Báo cáo điểm rác được xác minh (nguồn điểm thứ hai)
```

> "Vòng lặp có năm bước.
>
> Người bán chọn loại phế liệu, chụp một tấm ảnh, nhập khối lượng ước tính.
> Quản trị viên báo giá — và **giá bắt buộc phải nằm trong khung giá đã niêm yết
> công khai** cho loại đó. Người bán chấp nhận thì lô hàng lên chợ.
>
> Người mua có Gói người mua còn hiệu lực thì đặt giữ. **Mỗi lô đúng một người
> đặt giữ thành công** — người thứ hai bấm sẽ bị hệ thống từ chối.
>
> Quản trị viên xác nhận giao dịch hoàn tất, và điểm thưởng được ghi vào sổ.
>
> Có một nguồn điểm thứ hai: người dân báo cáo điểm rác tự phát, quản trị viên
> xác minh, được 50 điểm."

---

### Slide 3 · 1:05–1:50 — Demo trực tiếp

**Nói trước khi bấm:**

> "Em demo trên một database demo riêng, không phải dữ liệu thật của ai."

**Trình tự bấm — tập đúng thứ tự này:**

| # | Tab | Thao tác | Nói |
|---|---|---|---|
| 1 | Buyer | Mở `/cho-online` | "Đây là chợ. Mỗi lô đã được duyệt giá, hiện rõ loại, khối lượng và đơn giá." |
| 2 | Buyer | Bấm **Đặt giữ lô hàng** | "Người mua này có Gói còn hiệu lực nên đặt giữ được. Lô vừa chuyển sang trạng thái đã đặt giữ." |
| 3 | Admin | Mở `/admin/giao-dich` | "Bên quản trị, giao dịch vừa rồi đã vào hàng chờ xác nhận." |
| 4 | Admin | Bấm **Xác nhận giao dịch hoàn tất** | "Đây là hành động quyết định — điểm chỉ sinh ra sau bước này, không phải trước." |
| 5 | Seller | Mở `/diem-thuong` (F5) | "Và điểm đã vào sổ của người bán, kèm đúng mã giao dịch đã sinh ra nó." |

**Phương án dự phòng nếu mạng chết hoặc server cold-start:** chuyển sang bộ ảnh
chụp màn hình đã chuẩn bị, và nói thẳng: *"Mạng đang chậm, em dùng ảnh chụp từ
chính hệ thống này."* — **tuyệt đối không** giả vờ ảnh tĩnh là thao tác trực tiếp.

---

### Slide 4 · 1:50–2:35 — Tài khoản là bằng chứng

**Thao tác:** mở `/tai-khoan` bằng tài khoản người bán, rồi tài khoản người mua.

> "Trang tài khoản là nơi mọi thứ quy về một mối: số dư điểm, các yêu cầu bán gần
> đây, các lô đã đặt giữ, tình trạng Gói người mua, và lịch sử báo cáo rác.
>
> Các thầy cô để ý phần lịch sử thanh toán đang trống. Chúng em **cố ý để trống**
> — vì chưa có giao dịch thanh toán thật nào diễn ra. Bịa một dòng vào đó thì dễ
> hơn, nhưng như vậy thì cái dashboard này không còn là bằng chứng nữa.
>
> Và một dòng ngay trên trang này: **không hỗ trợ rút tiền mặt**. Điểm không phải
> là tiền."

---

### Slide 5 · 2:35–3:20 — Kiến trúc và ranh giới tin cậy

**Hiện trên màn hình:** sơ đồ Web → API → DB/Storage

> "Ba quyết định kỹ thuật mà chúng em muốn được đánh giá:
>
> **Một — máy chủ sở hữu trạng thái.** Trình duyệt chỉ gửi *lệnh*, không bao giờ
> gửi trạng thái. Không có API nào cho phép client tự đặt một đơn hàng thành 'đã
> hoàn tất'.
>
> **Hai — chống tranh chấp ở tầng database.** Việc mỗi lô chỉ một người đặt giữ
> không phải là disable một cái nút ở giao diện, mà là một ràng buộc duy nhất
> dưới database cộng với một câu cập nhật có điều kiện. Hai người bấm cùng một
> phần nghìn giây thì đúng một người thắng.
>
> **Ba — sổ điểm chỉ ghi thêm.** Bảng điểm **không có cột số dư**; số dư là tổng
> của các dòng ghi. Nghĩa là không có ô nào để sửa tay, và mỗi điểm luôn truy
> ngược được về đúng sự kiện đã sinh ra nó. Một sự kiện chỉ cộng điểm được đúng
> một lần — ràng buộc đó nằm ở database, không chỉ ở code.
>
> Thêm hai điều: toạ độ chính xác của điểm rác chỉ người báo và quản trị viên
> thấy, công khai chỉ tới mức quận. Và mọi thao tác của quản trị viên đều vào
> nhật ký kiểm toán."

---

### Slide 6 · 3:20–3:55 — Phần chúng em chưa làm được

**Hiện trên màn hình:** bảng CURRENT / DEMO / ROADMAP

> "Slide này quan trọng ngang slide demo.
>
> Catalog đổi điểm — Starbucks, Highlands, EVN, tiền nước — **chỉ là prototype**.
> Mã hiện ra là `DEMO-ONLY`, bấm vào không trừ điểm nào, và chúng em **chưa có
> liên kết với bất kỳ thương hiệu nào trong đó**. Nó ở đây để minh hoạ ý tưởng
> hợp tác, không phải để tuyên bố đã hợp tác.
>
> Gói người mua trong demo là do quản trị viên cấp tay, có ghi lý do vào nhật ký.
> Đó là **cấp quyền, không phải một giao dịch** — hệ thống không ghi nhận đồng
> nào cả.
>
> Và phần thu gom ngoài thực địa, cân thực tế, dọn dẹp hiện trường — chúng em
> chưa điều phối. Đó là việc tiếp theo, không phải việc đã xong."

---

### Slide 7 · 3:55–4:30 — Bằng chứng và lộ trình

| | Nội dung |
|---|---|
| **Đang chạy thật** | Xác thực, gửi yêu cầu bán, báo giá trong khung, chợ + đặt giữ một-người-thắng, xác nhận giao dịch, báo cáo rác + xác minh, sổ điểm, dashboard tài khoản, bản đồ OSM, song ngữ |
| **Prototype dự thi** | Catalog coupon, Gói người mua cấp tay |
| **Chưa làm** | Checkout payOS thật, trả tiền người bán, điều phối thu gom, giao việc đối tác vệ sinh, đổi điểm thật |

> "Ba việc tiếp theo, theo đúng thứ tự:
>
> Một, chạy được một vòng thanh toán thật với tài khoản merchant payOS — code đã
> viết, webhook đã ký HMAC và xác thực phía server, nhưng chưa từng chạy thật nên
> chúng em chưa dám nói là nó hoạt động.
>
> Hai, bổ sung bước cân thực tế và trả tiền cho người bán.
>
> Ba, ký được thoả thuận đầu tiên với một đơn vị thu gom, để phần dọn dẹp không
> còn nằm ngoài hệ thống."

---

### Slide 8 · 4:30–5:00 — Lời đề nghị

> "Chúng em không xin các thầy cô đánh giá dựa trên số người dùng, vì chúng em
> chưa có.
>
> Chúng em xin được đánh giá dựa trên hai thứ: **một vòng lặp chạy được từ đầu
> đến cuối và truy vết được ở từng bước**, và **kỷ luật của nhóm trong việc phân
> biệt rạch ròi cái gì đã chạy, cái gì là mô phỏng, cái gì còn ở phía trước**.
>
> Em xin nhận câu hỏi ạ."

---

## 2. Bộ câu trả lời Q&A

**Đây là ví hay ví điểm thưởng thân thiết?**
> Không phải ví. Điểm không rút được, không chuyển nhượng được, không mua bán
> được. Nó là các dòng ghi trong một sổ chỉ-ghi-thêm — nó ghi nhận việc đã làm,
> không lưu trữ giá trị.

**Coupon dùng được chưa?**
> Chưa. Đó là prototype dự thi. Mã là `DEMO-ONLY`, bấm vào không trừ điểm, và
> chúng em không tuyên bố có liên kết với các thương hiệu được nêu.

**Làm sao chặn người ta cày điểm giả?**
> Ba lớp. Thứ nhất, điểm chỉ sinh ra sau khi quản trị viên xác nhận hoặc xác
> minh — không có đường nào tự cộng. Thứ hai, mỗi sự kiện chỉ cộng điểm được đúng
> một lần, ràng buộc ở tầng database chứ không chỉ ở code. Thứ ba, báo cáo phải
> có ảnh và toạ độ, và mọi quyết định của quản trị viên đều vào nhật ký kiểm toán.
> Thành thật mà nói, chống gian lận ở quy mô lớn còn cần thêm kiểm tra tần suất và
> phát hiện trùng lặp — đó là việc chưa làm.

**Doanh thu đã chứng minh chưa?**
> Chưa. Gói người mua 50.000 đồng cho 30 ngày là **giả thuyết** về mô hình doanh
> thu. Giá và cơ chế chặn quyền thì đã tồn tại trong sản phẩm, nhưng chưa có một
> đồng doanh thu thật nào.

**Sao lịch sử thanh toán để trống?**
> Vì chưa có thanh toán nào xảy ra. Để trống thì trung thực hơn là bịa một giao
> dịch. Dashboard được thiết kế để hiện trạng thái thật khi có trạng thái thật.

**Người mua trả tiền lô phế liệu thế nào?**
> Hiện chưa qua hệ thống. Chức năng thanh toán duy nhất trong code là Gói người
> mua. Sau khi đặt giữ, hai bên giao dịch, rồi quản trị viên xác nhận hoàn tất.
> Bước cân thực tế và thanh toán qua nền tảng là hạng mục tiếp theo.

**Bản đồ chỉ có 10 điểm thu gom?**
> Đúng, 10 điểm, trong đó 4 điểm được gắn thẻ là thùng chứa. Đó là toàn bộ những
> gì cộng đồng OpenStreetMap ghi nhận trong khung TP.HCM tại thời điểm chúng em
> chụp dữ liệu. Chúng em hiển thị đúng những gì có thật và ghi rõ nguồn, thay vì
> tự dựng thêm điểm cho bản đồ trông đẹp.

**Sao không dùng microservices / AI nhận diện ảnh / blockchain?**
> Vì chưa có vấn đề nào ở quy mô này cần tới chúng. Kiến trúc là monolith có
> module tách rõ — tách ra sau vẫn được, mà không phải trả giá vận hành ngay bây
> giờ. AI nhận diện phế liệu và các hướng đó nằm ngoài phạm vi MVP một cách có
> chủ đích.

**Khác gì các app thu gom rác hiện có?**
> Chúng em không cạnh tranh ở khâu thu gom — hiện chúng em còn chưa làm khâu đó.
> Khác biệt nằm ở **kiểm soát giá và khả năng truy vết**: khung giá công khai mà
> ngay cả quản trị viên cũng không được ra giá vượt ra ngoài, mỗi lô đúng một
> người mua, và mọi điểm thưởng đều truy ngược được về đúng sự kiện.

**Bảo mật dữ liệu người dùng thì sao?**
> Mật khẩu băm bằng Argon2id, session là token ngẫu nhiên lưu trong database dưới
> dạng băm và thu hồi được, cookie HttpOnly. Ảnh không public, phải đi qua API.
> Toạ độ chính xác tách bảng riêng, không bao giờ lọt vào dữ liệu công khai.
> Chúng em có một sổ đăng ký rủi ro 18 mục trong repo.

---

## 3. Những câu **không được nói**

| ❌ Đừng nói | ✅ Nói thay bằng |
|---|---|
| "Chúng em có X người dùng" | "Chúng em chưa có người dùng thật; đây là dữ liệu demo" |
| "Thanh toán đã hoạt động" | "Code thanh toán đã viết, chưa verify với merchant thật" |
| "Đối tác của chúng em là Starbucks / EVN" | "Đây là minh hoạ ý tưởng hợp tác, chưa có liên kết nào" |
| "Người mua này đã mua gói" | "Gói này do quản trị viên cấp cho demo, không có giao dịch tiền" |
| "Đã giúp thu gom N tấn rác" | (không nói gì về tác động — chưa đo được) |
| "Đổi điểm lấy hoá đơn điện" | "Hướng đổi điểm sang dịch vụ công mới ở giai đoạn đề xuất" |
| "Hệ thống điều phối đội thu gom" | "Việc hẹn lấy hàng hiện do hai bên tự thoả thuận" |

---

## 4. Checklist trước giờ diễn

**T-30 phút**
- [ ] Xác nhận đang trỏ vào **database demo riêng**, không phải dữ liệu dùng chung
      (mục 1 của `docs/demo-runbook.md`)
- [ ] Gọi `/health` cho API tới khi `status: ok` (Render free tier có cold-start)
- [ ] Reset dữ liệu demo nếu cần — **chỉ trên project demo riêng**

**T-10 phút**
- [ ] Mở sẵn 3 tab, đã đăng nhập: seller / buyer / admin
- [ ] Chợ có **ít nhất 2 lô** đang mở bán (để lỡ 1 lô lỗi vẫn còn cái để demo)
- [ ] Tab seller đang mở sẵn `/diem-thuong` để chỉ cần F5
- [ ] Bộ ảnh chụp màn hình dự phòng nằm sẵn trong slide ẩn
- [ ] Zoom trình duyệt ~125% cho người ngồi xa đọc được
- [ ] Tắt thông báo hệ thống, tắt các tab không liên quan

**T-1 phút**
- [ ] Đọc lại đúng một lần: *"chưa có người dùng thật · payOS chưa verify ·
      coupon là DEMO-ONLY · điểm không phải tiền"*

---

## 5. Biến thể theo thời lượng

**Nếu chỉ có 3 phút:** bỏ slide 4 và 7. Gộp: 1 (30s) → 2 (30s) → 3 demo (60s) →
5 kỹ thuật rút gọn còn 2 ý (30s) → 6 trung thực (20s) → 8 (10s).

**Nếu có 10 phút:** giữ nguyên 8 slide, mở rộng 3 chỗ — thêm luồng người bán đầy
đủ vào demo (gửi yêu cầu → admin báo giá → người bán chấp nhận, khoảng +90 giây),
thêm một slide sơ đồ ERD / ranh giới module sau slide 5, và thêm một slide thị
trường + mô hình doanh thu (nêu rõ là **giả thuyết chưa validate**) trước slide 7.
