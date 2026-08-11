# GreenCity — Nội dung chi tiết sản phẩm (bản dành cho team)

**Mục đích:** để cả team hiểu đúng và nói giống nhau về sản phẩm.
**Nguồn:** đọc trực tiếp từ code trong repo, không phải từ slide marketing.
**Nguyên tắc số 1:** cái gì code làm được thì nói là làm được, cái gì chưa thì
nói thẳng là chưa. Đừng chế số liệu người dùng / doanh thu / đối tác.

---

## 1. GreenCity là gì — nói trong 30 giây

> GreenCity là nền tảng web (tiếng Việt + tiếng Anh) khép kín một vòng lặp cho
> rác tái chế ở đô thị: **người dân bán phế liệu theo khung giá niêm yết công
> khai**, **đơn vị thu mua đặt giữ lô hàng đã được kiểm duyệt**, và **cộng đồng
> báo cáo điểm rác tự phát để được xác minh**. Mỗi việc hoàn tất đều được ghi
> vào một sổ điểm chỉ-ghi-thêm, truy ngược được về đúng sự kiện sinh ra nó.

Slogan trong sản phẩm: **"Rác có người mua! Người báo điểm rác!"**

Điểm khác biệt để nhấn khi thuyết trình **không phải** là "app thu gom rác" (thị
trường đã có nhiều) mà là **tính truy vết và kỷ luật trạng thái**: giá nằm trong
khung công khai, mỗi lô chỉ một người đặt giữ được, điểm thưởng chỉ sinh ra sau
khi admin xác nhận, và không có ô "số dư" nào để sửa tay.

---

## 2. Vấn đề và người dùng

| Nhóm | Vấn đề hôm nay | GreenCity làm gì |
|---|---|---|
| Người dân / hộ gia đình (người bán) | Bán ve chai bị ép giá, không biết giá thị trường, không có bằng chứng gì | Xem khung giá công khai theo từng loại, gửi ảnh + khối lượng ước tính, nhận báo giá cụ thể nằm **trong** khung đó |
| Vựa thu mua / doanh nghiệp tái chế (người mua) | Nguồn hàng rời rạc, không biết chất lượng, tranh nhau một lô | Chợ online chỉ hiện lô đã được quản trị viên duyệt giá; **mỗi lô đúng một người đặt giữ thành công** |
| Cộng đồng (người báo) | Thấy điểm rác tự phát nhưng không có kênh báo và không có ghi nhận | Gửi ảnh + ghim vị trí trên bản đồ; admin xác minh; được cộng 50 điểm |
| Quản trị viên / vận hành | Không có nơi kiểm soát giá và chống gian lận | 3 hàng chờ: báo giá, duyệt báo cáo rác, xác nhận giao dịch — mọi thao tác đều vào nhật ký kiểm toán |

---

## 3. Bốn dịch vụ đang chạy + giới hạn thật của từng cái

Đây chính là nội dung trang `/dich-vu`. Team **phải thuộc cả cột giới hạn**, vì
đó là thứ giám khảo sẽ hỏi.

| Dịch vụ | Làm được | Giới hạn hiện tại |
|---|---|---|
| **Bán phế liệu** (`/ban-phe-lieu`) | Gửi yêu cầu kèm 1 ảnh + khối lượng ước tính, nhận báo giá trong khung công khai, tự bấm chấp nhận / từ chối | GreenCity báo giá và niêm yết lô hàng. **Việc hẹn giờ lấy hàng do hai bên tự thỏa thuận**, hệ thống chưa điều phối lịch thu gom |
| **Chợ online** (`/cho-online`) | Xem các lô đã duyệt giá; người mua có Gói còn hiệu lực thì đặt giữ | Đặt giữ cần Gói người mua. **Checkout payOS chưa từng chạy thật với tài khoản merchant** nên chưa khẳng định được thanh toán hoạt động |
| **Bản đồ điểm rác** (`/dong-gop`) | Gửi ảnh + ghim toạ độ, admin xác minh, +50 điểm | Việc **dọn dẹp thực địa do đơn vị vệ sinh địa phương làm**, GreenCity chưa điều phối phần đó |
| **Điểm thưởng** (`/diem-thuong`) | Sổ điểm thật, cộng tự động, xem được lịch sử | Coupon đổi điểm **mới là prototype dự thi**: mã `DEMO-ONLY`, không dùng được ở đâu, không trừ điểm |

Ngoài 4 cái trên còn có:

- **`/thung-rac`** — bản đồ điểm thu gom tái chế ở TP.HCM lấy từ **OpenStreetMap
  (ODbL 1.0)**, chụp ngày 2026-08-07. Hiện chỉ có **10 điểm**, trong đó **4 điểm**
  được gắn thẻ là thùng chứa. Trang tự nói rõ là dữ liệu cộng đồng còn rất thưa
  và **không phải danh sách chính thức của thành phố** — không tự dựng thêm điểm ảo.
- **`/tai-khoan`** — dashboard **chỉ đọc**: hồ sơ, số dư điểm, yêu cầu bán gần
  đây, lô đã đặt giữ, Gói người mua + lịch sử thanh toán, báo cáo rác gần đây.
- **`/admin`** — 3 hàng chờ + chức năng cấp Gói người mua thủ công.
- Widget hỗ trợ **Chatwoot** có xác thực danh tính bằng HMAC (agent biết chắc
  đang nói chuyện với ai, không phải người dùng tự khai).

---

## 4. Vòng lặp sản phẩm — luồng đầy đủ

### 4.1 Luồng bán phế liệu (Chợ online)

```
[Người bán]  chọn loại + ảnh + kg ước tính  →  ScrapRequest (SUBMITTED)
[Admin]      báo giá, giá BẮT BUỘC nằm trong khung của loại đó  →  QUOTED
[Người bán]  chấp nhận  →  ACCEPTED  →  sinh MarketplaceListing (AVAILABLE)
             (từ chối → REJECTED, kết thúc)
[Người mua]  có Gói còn hiệu lực → Đặt giữ  →  Reservation, listing → RESERVED
             (người thứ hai bấm sẽ nhận 409 "Lô hàng không còn khả dụng")
[Admin]      Xác nhận giao dịch hoàn tất  →  COMPLETED
[Hệ thống]   cộng điểm cho người bán vào sổ (trong cùng một transaction)
```

**Những chỗ team hay hiểu sai:**

- Bước "chấp nhận báo giá" là của **người bán**, không phải admin. Admin chỉ ra
  giá, không quyết thay người bán.
- Admin **không thể** báo giá ngoài khung. Ràng buộc này có ở cả tầng ứng dụng
  **và** một `CHECK constraint` dưới database — nói được ý này là ghi điểm.
- Trạng thái thật trong DB là 4 giá trị: `AVAILABLE / RESERVED / COMPLETED /
  CANCELLED`. Máy trạng thái dài hơn trong `docs/state-machines.md` là **thiết
  kế cho các pha sau**, không phải cái đang chạy. Đừng vẽ 12 trạng thái lên slide
  rồi bị hỏi cái nào chạy thật.
- **Chưa có bước cân thực tế và chưa có thanh toán cho chính lô phế liệu.** Điểm
  hiện được tính trên **khối lượng ước tính**. Bước "cân thực tế → tiền = đơn giá
  × khối lượng xác nhận" nằm trong thiết kế, chưa code.

### 4.2 Luồng báo cáo điểm rác (Đóng góp)

```
[Người báo]  ảnh + mô tả + ghim toạ độ trên bản đồ (hoặc "Dùng vị trí hiện tại")
             →  CleanupReport (SUBMITTED)
[Admin]      Xác minh  →  VERIFIED  →  +50 điểm cho người báo
             hoặc Từ chối  →  REJECTED (không điểm)
```

- Toạ độ chính xác **chỉ chủ báo cáo và admin thấy được**. Feed công khai và
  trang chủ chỉ hiện **quận/thành phố**. Đây là ràng buộc bảo mật cố ý (tách
  `LocationExact` / `LocationPublic`).
- Nếu ghim ngoài phạm vi TP.HCM, hệ thống vẫn cho gửi nhưng báo rõ: *"Vị trí này
  nằm ngoài TP.HCM. GreenCity hiện chưa thu gom ở khu vực đó."*
- **Chưa code:** giao việc cho đối tác vệ sinh, ảnh trước/sau, xác nhận đã dọn
  xong ngoài thực địa. Xác minh của admin là xác minh **báo cáo có thật**, không
  phải xác nhận **đã dọn xong**.

---

## 5. Hệ điểm thưởng — con số chính xác

| Nguồn điểm | Công thức trong code | Ví dụ |
|---|---|---|
| Bán phế liệu hoàn tất | `max(1, floor(kg × đơn_giá_người_bán / 1000))` → xấp xỉ **1 điểm / 1.000 ₫** | 15 kg giấy carton × 3.000 ₫ = 45.000 ₫ → **45 điểm** |
| Báo cáo rác được xác minh | **50 điểm** cố định | 1 báo cáo duyệt → **50 điểm** |

**Ba tính chất phải nói được:**

1. **Sổ chỉ-ghi-thêm.** Bảng `PointEntry` **không có cột số dư**. Số dư =
   `SUM(delta)` của người đó. Nghĩa là không có ô nào để sửa tay, và không thể
   mất điểm vì hai lần ghi đè lên nhau.
2. **Chống cộng trùng ở tầng database.** Ràng buộc `UNIQUE(reason, referenceId)`
   — một lô hàng chỉ cộng điểm được đúng một lần, một báo cáo cũng vậy, kể cả khi
   logic ứng dụng có lỗi.
3. **Điểm chỉ sinh ra sau hành động của admin**, cùng transaction với việc đổi
   trạng thái. Không có đường nào cộng điểm mà không có sự kiện tương ứng.

**Điểm KHÔNG phải là gì:** không phải tiền, không rút được, không chuyển nhượng
được, không mua bán được. Trang tài khoản ghi thẳng: *"Không hỗ trợ rút tiền mặt."*

**Catalog đổi điểm (`DEMO-ONLY`, không có đối tác thật):**

| Ưu đãi minh hoạ | Điểm |
|---|---|
| Starbucks — voucher 50.000 ₫ | 500 |
| Highlands Coffee — voucher 50.000 ₫ | 500 |
| Jollibee — combo 79.000 ₫ | 750 |
| KFC — combo 99.000 ₫ | 900 |
| EVN — hỗ trợ 100.000 ₫ hoá đơn điện | 1.000 |
| Nước sạch đô thị — hỗ trợ 100.000 ₫ | 1.000 |

Cột `demoOnly` là **một cột thật trong database**, không phải cái nhãn dán ở giao
diện. Bấm "Xem mô phỏng" chỉ mở một hộp thoại nói rõ: không trừ điểm nào, mã
không có giá trị sử dụng, GreenCity không tuyên bố có liên kết với thương hiệu đó.

---

## 6. Mô hình kinh doanh (đang là **giả thuyết**, chưa được chứng minh)

- **Gói người mua (Buyer Pass): 50.000 ₫ / 30 ngày**, trả một lần, **không tự
  động gia hạn**. Đây là điều kiện để được đặt giữ lô hàng.
- Thanh toán qua **payOS VietQR** (chuyển khoản ngân hàng), webhook được **ký
  HMAC và xác thực phía server** — không tin vào redirect của trình duyệt.
- **Trạng thái thật: code có, nhưng chưa từng chạy với tài khoản merchant thật.**
  payOS không có sandbox, nên tới khi có merchant account và quan sát được một
  vòng checkout + webhook thật thì mới được nói là "thanh toán hoạt động".
  Trong demo, admin **cấp Gói thủ công** (có ghi lý do vào nhật ký kiểm toán) —
  và phải gọi đúng tên: **cấp quyền, không phải giao dịch**.
- **Biên lợi nhuận hiện tại = 0.** Trong code, `buyerPricePerKgVnd` đang được gán
  bằng `sellerPricePerKgVnd` — schema đã tách sẵn hai cột để sau này chèn biên,
  nhưng mức biên là **quyết định kinh doanh chưa chốt**. Nếu bị hỏi doanh thu,
  trả lời: hiện chỉ có một giả thuyết doanh thu là phí Gói người mua, chưa validate.

**Hướng doanh thu tương lai (chỉ nêu là hướng, không nêu là kế hoạch có ngày):**
biên giá giữa người bán và người mua, phí dịch vụ thu gom, hợp tác với đơn vị
tái chế và tiện ích công (EVN / cấp nước) cho phần đổi điểm.

---

## 7. Kiến trúc & công nghệ

```
Trình duyệt  →  Next.js (App Router, same-origin /api)  ⇄  NestJS API
                                                            ⇄ PostgreSQL + PostGIS
                                                            ⇄ Object storage riêng tư
                                                              (ảnh phục vụ qua API)
```

| Lớp | Công nghệ |
|---|---|
| Kiến trúc | Modular monolith (không microservices) |
| Monorepo | pnpm workspaces — `apps/web`, `apps/api`, `packages/shared` |
| Frontend | Next.js App Router + TypeScript + Tailwind, `next-intl` (vi mặc định, có en) |
| Backend | NestJS + TypeScript |
| Database | PostgreSQL + PostGIS, ORM Prisma |
| Xác thực | Mật khẩu băm **Argon2id**; session **opaque lưu trong DB** (chỉ lưu SHA-256 của token), cookie HttpOnly, thu hồi được |
| Lưu trữ | Local filesystem khi dev → Supabase Storage khi deploy; ảnh **không public**, đi qua API |
| Thanh toán | payOS VietQR + webhook ký HMAC |
| Hỗ trợ | Chatwoot có xác thực HMAC |
| Test | Unit (Jest) + **Playwright E2E** (a11y, auth, marketplace, pagination, responsive, rewards catalog, subscription payment…) |
| CI/CD | GitHub Actions: install → lint → typecheck → test → build. Web trên Vercel, API trên Render (Singapore), DB Supabase |

**Tại sao chọn monolith, không microservices:** đây là câu hỏi giám khảo kỹ thuật
hay hỏi. Câu trả lời: quy mô hiện tại, ranh giới module đã tách rõ trong code
(`auth`, `marketplace`, `cleanup`, `points`, `payment`, `media`, `location`,
`audit`, `authz`), gọi nhau qua service nội bộ chứ không qua HTTP — tách ra sau
được, mà không phải trả giá vận hành ngay bây giờ.

---

## 8. Bảy nguyên tắc kỹ thuật đáng đem đi thi

Đây là phần "kỷ luật kỹ thuật" — thứ phân biệt sản phẩm này với một bản demo dựng vội.

1. **Server sở hữu trạng thái.** Frontend gửi *lệnh*, không bao giờ gửi trạng
   thái. Không có API kiểu `PATCH { status: "COMPLETED" }`.
2. **Một lô — một người đặt giữ.** Bảo đảm bằng `UNIQUE` trên `listingId` + một
   `updateMany` có điều kiện trạng thái, nên hai người bấm cùng lúc thì đúng một
   người thắng, người kia nhận 409. Không phải chỉ disable cái nút ở UI.
3. **Sổ điểm chỉ ghi thêm, chống trùng bằng ràng buộc DB.** (mục 5)
4. **Giá bị kẹp trong khung công khai** ở cả tầng ứng dụng lẫn `CHECK constraint`.
5. **Riêng tư vị trí.** Toạ độ chính xác tách bảng riêng và không bao giờ lọt vào
   DTO công khai; công khai chỉ tới mức quận/thành phố.
6. **Không tin client về tiền.** Trạng thái thanh toán chỉ đổi khi webhook đã ký
   được xác thực phía server.
7. **Nhật ký kiểm toán** cho mọi hành động của admin: ai, làm gì, lên đối tượng
   nào, lúc nào, `requestId` nào.

---

## 9. Bảng trạng thái: CURRENT / DEMO / ROADMAP

**Học thuộc bảng này.** Đây là ranh giới giữa trung thực và nói quá.

| Hạng mục | Trạng thái |
|---|---|
| Đăng ký / đăng nhập / đăng xuất, session | **CURRENT** |
| Gửi yêu cầu bán + upload ảnh | **CURRENT** |
| Admin báo giá trong khung, người bán chấp nhận | **CURRENT** |
| Chợ online + đặt giữ một-người-thắng | **CURRENT** |
| Admin xác nhận giao dịch hoàn tất | **CURRENT** |
| Báo cáo điểm rác + admin xác minh | **CURRENT** |
| Sổ điểm thưởng (cả 2 nguồn) | **CURRENT** |
| Dashboard tài khoản (chỉ đọc) | **CURRENT** |
| Bản đồ điểm tái chế OpenStreetMap | **CURRENT** (dữ liệu thưa: 10 điểm) |
| Song ngữ vi/en | **CURRENT** |
| Catalog coupon / EVN / nước | **DEMO** — không đổi, không trừ điểm, không có đối tác |
| Gói người mua do admin cấp | **DEMO** — là cấp quyền, không phải giao dịch |
| Checkout payOS thật + webhook merchant | **ROADMAP** — code có, chưa verify thật |
| Trả tiền mặt cho người bán | **ROADMAP** — chưa code |
| Giao việc cho đối tác vệ sinh, ảnh trước/sau, xác nhận dọn xong | **ROADMAP** — chưa code |
| Điều phối lịch thu gom, cân thực tế | **ROADMAP** — chưa code |
| Đổi điểm thật với đối tác | **ROADMAP** — cần thoả thuận, chưa có ngày |

---

## 10. Chạy thử ở máy mình

```powershell
pnpm install --frozen-lockfile
copy .env.example .env        # sửa DATABASE_URL thật
pnpm db:setup ; pnpm db:postgis ; pnpm db:generate ; pnpm db:migrate ; pnpm db:verify
corepack pnpm --filter api db:seed

pnpm dev:api   # http://localhost:3001
pnpm dev:web   # http://localhost:3000
```

**Tài khoản demo** (mật khẩu `GreenCity-Demo-2026`, chỉ dùng cho DB local):

| Email | Vai trò | Dùng để |
|---|---|---|
| `admin@greencity.demo` | ADMIN | Hàng chờ báo giá `/admin/bao-gia` |
| `seller@greencity.demo` | USER | Gửi yêu cầu bán `/ban-phe-lieu` |
| `buyer@greencity.demo` | USER + Gói demo | Đặt giữ ở `/cho-online` |

Khung giá được seed sẵn: PET 1.000–1.500 · Carton 2.500–3.500 · Lon nhôm
15.000–20.000 · Sắt vụn 5.000–7.000 · Chai thuỷ tinh 500–1.000 (₫/kg).

> ⚠️ **Không bao giờ chạy `db:seed` lên database dùng chung hoặc production.**
> Trước mỗi buổi demo có reset dữ liệu, đọc `docs/demo-runbook.md`.

---

## 11. FAQ nội bộ — mấy câu team hay vướng

**Hỏi: Vậy rốt cuộc mình có thu gom rác không?**
Không, chưa. GreenCity hiện là lớp **khớp nối và kiểm soát giá + ghi nhận**:
định giá, niêm yết, khớp người mua, xác minh báo cáo. Việc lấy hàng và dọn dẹp
ngoài thực địa hiện do hai bên / đơn vị vệ sinh địa phương làm.

**Hỏi: Trang chủ có câu "Đội gom nhận hàng, cân thực tế và thanh toán tiền trực
tiếp" mà?**
Câu đó mô tả **quy trình mục tiêu**, còn trang `/dich-vu` mới nói đúng trạng thái
hôm nay (chưa điều phối lịch thu gom). Nếu giám khảo bắt được chỗ này, đừng cãi —
nhận là bước 4 chưa được hệ thống điều phối, và đây là hạng mục kế tiếp.

**Hỏi: Người mua trả tiền cho lô phế liệu bằng cách nào?**
Hiện chưa có. Thứ duy nhất có thanh toán trong code là **Gói người mua 50k/30
ngày**. Người mua đặt giữ, rồi hai bên tự giao dịch, admin bấm xác nhận hoàn tất.

**Hỏi: Điểm đổi được gì?**
Chưa đổi được gì. Catalog là prototype dự thi, mã `DEMO-ONLY`.

**Hỏi: Bản đồ chỉ có 10 điểm, có ít quá không?**
Ít, và mình nói thẳng là ít. Đó là toàn bộ những gì OpenStreetMap ghi nhận trong
khung TP.HCM tại thời điểm chụp. Mình hiển thị đúng dữ liệu có thật thay vì bịa
thêm điểm — chính điều đó là điểm cộng, không phải điểm trừ.

**Hỏi: Có bao nhiêu người dùng rồi?**
**Chưa có người dùng thật.** Dữ liệu trong demo là dữ liệu seed. Không được gọi
bất kỳ con số nào trong demo database là traction, người dùng hay doanh thu.

---

## 12. Đọc thêm

| Tài liệu | Nội dung |
|---|---|
| `docs/presentation-script-vi.md` | Kịch bản thuyết trình + lời thoại + Q&A |
| `docs/project-context.md` | Bối cảnh và phạm vi dự án |
| `docs/domain-model.md` | Actor, aggregate, bất biến nghiệp vụ |
| `docs/state-machines.md` | Máy trạng thái (thiết kế đầy đủ, gồm cả phần chưa code) |
| `docs/architecture.md` | Module, ERD, ranh giới phụ thuộc |
| `docs/security-risks.md` | Sổ đăng ký rủi ro R1–R18 |
| `docs/demo-runbook.md` | Quy trình an toàn ngày demo |
| `docs/startup-contest-presentation.md` | Bản gốc tiếng Anh của ma trận bằng chứng |
