<!-- Hallmark · pre-emit critique: P5 H4 E4 S5 R5 V4 -->
# GreenCity — audit tính thực tế, business và UI cho DBC 2026

Cập nhật: **02/10/2026**, source nền **14a87bdd08ef1e0449b4c69921db2783e4a09d8b** (`14a87bd`). Báo cáo này thay thế danh sách lỗi ở các checkout cũ. Findings bên dưới mô tả bản nền; một nhóm đã được sửa local theo bảng sau. Chưa push/deploy hoặc thực hiện thanh toán thật.

## Trạng thái sau lượt sửa UI/auth ngày 02/10

| Finding | Trạng thái local và bằng chứng |
|---|---|
| F01 GPS | Header đã đổi sang `geolocation=(self)`, HTTP response xác nhận; giữ camera/microphone bị chặn. Chưa thử tọa độ thiết bị thật |
| F07 bảng giá | Table vừa vùng chứa ở 320/375/414px, cả VI/EN; không còn minimum width 448px |
| F08 PageHeader | Utility đổi thành `text-3xl`; browser đo H1 30px ở mobile |
| F09 quay lại sau auth | Các entry links giữ canonical `next`; login/register success quay lại route được allowlist, fallback Tài khoản. Browser xác nhận login VI → Bán phế liệu, English → Community Reporting, chuyển register → login giữ đích, URL ngoài site → Tài khoản |

Typecheck, lint, smoke + auth-return regression checks và production build đã pass. Regression check đã fail trước khi thêm allowlist và pass sau fix; chạy lại bằng `corepack pnpm --filter web test`. Auth return chỉ nhận canonical routes trong allowlist, không nhận URL tùy ý, encoded URL hoặc auth pages; next-intl quyết định đường dẫn theo locale. Session hết hạn cũng giữ trang đích. Không giữ input chưa gửi qua redirect.

Trong lượt UI/auth này chưa chạy toàn bộ Playwright E2E hoặc tạo tài khoản mới trong browser verification; assertion của auth E2E được cập nhật để đợi Account dashboard sau đăng ký thay cho success text ở form cũ. Các file `.env`, `.env.render.local`, `.env.supabase.local` được đối chiếu SHA256 và giữ nguyên. Lượt này không đổi API/database/dependencies. F02/F03 sau đó được xử lý ở lượt dưới; F04–F06/F10 còn mở.

Ảnh kết quả local: `.local/verification/ui-fixes-2026-10-02/sell-scrap-mobile.jpg` (375px).

## Trạng thái sau lượt sửa luồng thu gom ngày 02/10

| Finding | Trạng thái local và bằng chứng |
|---|---|
| F02 quyết toán | Admin phải nhập kg thực cân, tiền người bán đã nhận và mã/ghi chú biên nhận. Lưu admin và thời điểm; quyết toán, trạng thái và điểm trong một transaction. Điểm tính từ tiền thực nhận. Đây là ghi nhận thủ công, chưa phải xác nhận ngân hàng hoặc một đơn thu gom ngoài đời |
| F03 sau đặt giữ | Đặt giữ dẫn đến private detail; buyer/seller xem lịch, điểm hẹn, liên hệ điều phối và biên nhận. Admin hủy có lý do, giữ lịch sử và mở lại tin. Một partial unique index chỉ cho một đơn RESERVED trên mỗi tin. Mutation dùng reservationId để tab cũ không xử lý đơn mới |

User đã chọn admin điều phối, biên nhận thủ công và tỷ lệ điểm hiện tại trên tiền thực nhận. Đơn cũ được backfill trạng thái, không suy diễn kg/tiền thực nhận từ số ước tính. API giới hạn detail cho hai bên và admin, liên hệ tài khoản riêng chỉ hiện với admin; các read routes mới/sửa có `private, no-store`.

Verification: **174 unit tests, 130 integration tests**, custom storage/path checks, typecheck/lint/smoke và Nest/Next production builds pass. **22 targeted browser tests** đã pass qua các lượt chạy auth, account, pagination và marketplace; chưa chạy toàn bộ E2E suite. Full browser flow đã chạy qua hủy → đặt lại → lịch hẹn → quyết toán → seller xem biên nhận/điểm; mobile 375px không overflow. Chi tiết đơn VI/EN cũng có checks riêng. API tests bao gồm quyền truy cập, chống duplicate active reservation, race cancel/complete, rollback nếu ghi điểm lỗi và backfill dữ liệu cũ. Test users/listing/reservations được cleanup; tài khoản demo và keys không đổi.

Migration `20261002000001_reservation_collection_flow` chỉ được áp dụng database loopback sau backup. Backup/ảnh/log ở `.local/verification/collection-flow-2026-10-02/`; ảnh là dữ liệu test, không phải traction. [Spec và ghi chú rollout](../tasks/collection-flow.md). Chưa push/deploy. API complete đã đổi từ listingId sang reservationId; phải phối hợp rollout API/web và áp dụng migration khi deploy.

**Kết luận:** giữ MVP hiện có, sửa các điểm làm đứt luồng thu gom và chạy một pilot nhỏ có cân, nhận tiền và chi phí thực tế. Ưu tiên chứng minh giao dịch hoàn thành và mô hình thu phí. Làm lại toàn bộ giao diện chưa giải quyết được khoảng trống đó.

## 1. Phạm vi và bằng chứng

Đã đối chiếu frontend, API, shared contracts, database schema, marketplace, account history, báo điểm rác, điểm thưởng, payment, tests/CI, tài liệu và pitch. Đã kiểm tra bảng giá trên production build local ở 320/375/414/768px; kiểm tra HTTP header và schema validation mà không lấy vị trí thật hay gửi báo cáo mới.

| Hạng mục | Kết quả và giới hạn |
|---|---|
| Source duy nhất | Folder chính ở `master`, bằng `origin/master` tại thời điểm đồng bộ 01/10; tracked source không đổi |
| Web deployment | GitHub ghi nhận Vercel Production deployment 5930825644 thành công cho `14a87bd`; không tự deploy lại |
| API production | Chưa xác minh Render chạy cùng SHA; kết quả local không chứng minh toàn bộ production |
| Bản dự phòng | `.local/recovery/sync-deployed-2026-10-01`: Git bundle, file local/environment và database dump; environment gốc được giữ nguyên |
| Verification trên đúng SHA | Typecheck, web lint, web smoke, API unit/integration và production build đã pass sau đồng bộ |
| Giới hạn | Không penetration test, không full browser E2E, không thanh toán merchant thật, không xác nhận một đơn thu gom ngoài đời |

Kết quả đã chạy trong bước đồng bộ: API unit **19 suites / 173 tests**, integration **8 suites / 126 tests**; web smoke kiểm tra **17 routes, 25 components, 67 files**, dictionary parity **420 keys**; build API/web thành công, Next build **31 pages**. Chi tiết và lệnh chạy lại ở `.local/recovery/sync-deployed-2026-10-01/README.md`. Không chạy lại toàn bộ suite chỉ để chỉnh tài liệu.

[CI của commit được audit](https://github.com/vinhelysia/GreenCity/actions/runs/31946414104).

## Các nhận định cũ đã loại khỏi backlog

- Logout không còn xóa local session khi server logout thất bại; lỗi được trả về UI.
- Account history đã có đơn đặt giữ, subscription và payment gần đây. Khoảng trống còn lại là hành động tiếp theo sau đặt giữ.
- Marketplace đã có pagination; không còn kết luận toàn bộ danh sách lấy không giới hạn.
- Homepage phân biệt lỗi tải với danh sách rỗng; báo điểm rác mới nhất lấy từ `slice(0, 2)`.
- Supabase storage dùng timeout cho cả request và body qua AbortSignal.
- Trang Dịch vụ đã mô tả chức năng và giới hạn; language switch, map và catalog coupon demo đã có.
- Đã xử lý các checkout/branch local dư. Không còn dùng finding dependency hoặc generated files lệch của worktree cũ để đánh giá bản hiện tại.

**Đính chính mobile:** hero trang chủ dùng `text-3xl`; PageHeader dùng chung vẫn dùng utility `text-3.5xl` không được khai báo. Đo runtime local xác nhận H1 trang Bán phế liệu là **16px** tại 375px. Không gộp hai loại tiêu đề thành kết luận “đã sửa hết H1 mobile”.

## 2. DBC chấm gì và GreenCity nên chọn hướng nào

Giả định phù hợp nhất là **Nội dung 3 — Ý tưởng Kinh doanh số**. Đây là khuyến nghị theo bản chất project, chưa phải xác nhận đội đã đăng ký nội dung này. DBC có ba nội dung thi. [Quy chế DBC 2026](https://dbc.vecomnet.vn/quyche2026), [giới thiệu chính thức của VECOMNET](https://www.vecomnet.vn/le-phat-dong-cuoc-thi-sinh-vien-kinh-doanh-so-2026).

Đã đọc trực tiếp các PDF ND3 trong [thư mục tài liệu chính thức](https://drive.google.com/drive/folders/1XIK70m9hXvDLdbo8Br8kcEOKD4IIOAa8?usp=sharing), gồm đề thi, tiêu chí sơ loại v1.5 và thể lệ:

| Tiêu chí sơ loại ND3 | Điểm | Công việc cần có |
|---|---:|---|
| Xây dựng ý tưởng kinh doanh số | 35 | Business plan hoàn chỉnh, mục tiêu và tính bền vững |
| Giá trị giải pháp | 10 | Vấn đề thực, khách hàng đúng, giải pháp sử dụng được |
| Khác biệt dự án | 10 | Lợi thế cụ thể và cơ sở bảo vệ lợi thế |
| Kế hoạch nhân sự | 5 | Vai trò, năng lực, người chịu trách nhiệm |
| Marketing | 15 | Sản phẩm, giá, phân phối, truyền thông |
| Tổ chức sản xuất kinh doanh | 10 | Nguồn lực và quy trình vận hành |
| Tài liệu báo cáo | 15 | Đầy đủ, rõ ràng, trình bày tốt |
| **Tổng** | **100** | |

Không có mục điểm UI độc lập trong bảng này. UI giúp chứng minh giá trị và chất lượng demo; business plan, marketing và vận hành mới là phần phải làm rõ.

Theo thể lệ ND3 đã đọc, sơ loại cần báo cáo theo mẫu BTC; demo là tùy chọn. Hạn ghi trong tài liệu là **trước 24:00 ngày 10/11/2026**. Hồ sơ có PDF tiếng Việt và PowerPoint; slide tối đa 30 trang, có Executive Summary hoặc mục lục ở đầu. PDF dùng A4, Times New Roman 13, giãn dòng 1.3, lề 2cm. Kiểm tra lại thông báo BTC trước khi nộp vì lịch có thể được điều chỉnh. Nguồn: các PDF trong thư mục chính thức trên.

## 3. Findings hiện hành, xếp theo mức ảnh hưởng

P1: cản trở pilot hoặc làm sai kỳ vọng giao dịch/business. P2: cải thiện UX và độ tin cậy sau khi luồng vận hành rõ ràng. Findings bên dưới mô tả bản nền; trạng thái implementation local mới nhất nằm ở hai bảng đầu báo cáo.

### F01 — P1: GPS bị policy của website chặn

**Where:** `apps/web/next.config.ts:39`, `apps/web/src/components/location-picker.tsx:133`.

Config trả về `Permissions-Policy: camera=(), microphone=(), geolocation=()`, trong khi nút dùng vị trí gọi `navigator.geolocation.getCurrentPosition`. HTTP response local xác nhận header này thực sự được gửi. Trên browser hỗ trợ policy, GPS bị từ chối dù người dùng muốn cho phép; đây là mâu thuẫn giữa cấu hình và chức năng.

**Fix tối thiểu:** đổi riêng geolocation thành `(self)`; giữ camera/microphone bị chặn. Vẫn cần browser permission và fallback nhập địa chỉ/chọn pin. Chưa yêu cầu hoặc đọc tọa độ thật trong audit.

**Đạt khi:** header cho phép cùng origin; thử thành công, từ chối và timeout bằng vị trí kiểm thử; luồng không mất dữ liệu khi GPS thất bại. [MDN: geolocation Permissions-Policy](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Permissions-Policy/geolocation).

### F02 — P1: Hoàn tất đơn chưa ghi nhận kết quả giao dịch ngoài đời

**Where:** `apps/api/src/marketplace/listing.service.ts:209`, `apps/api/src/marketplace/admin.controller.ts:98`, `apps/api/src/points/points.service.ts:9`, `apps/web/src/components/admin-listing-queue.tsx:219`.

Admin complete chuyển RESERVED → COMPLETED mà không nhận cân nặng thực tế, số tiền seller thực nhận hoặc biên nhận. Điểm vẫn tính theo khối lượng ước tính và giá seller niêm yết. Marketplace đã ghi audit actor khi complete và dùng transaction; vấn đề còn lại là dữ liệu quyết toán, không phải thiếu toàn bộ audit log.

**Fix tối thiểu:** form hoàn tất lưu kg cân, số tiền thực nhận, thời điểm và mã/ghi chú biên nhận; gắn người xác nhận hiện có. Chốt quy tắc điểm theo dữ liệu đã xác nhận. Thanh toán thủ công có chứng từ đủ cho pilot.

**Đạt khi:** một đơn có kết quả cân và nhận tiền đọc lại được; hoàn tất lặp không cộng điểm hai lần; thiếu/sai dữ liệu không hoàn tất; lỗi giữa transaction không để lại trạng thái dở dang. Không cần wallet hoặc escrow để đạt mục tiêu này.

### F03 — P1: Có lịch sử đặt giữ nhưng chưa có cách tiếp tục lấy hàng

**Where:** `apps/api/src/marketplace/account-history.service.ts:21`, `apps/web/src/components/account-dashboard.tsx:403`, `apps/api/prisma/schema.prisma:260`.

History hiển thị loại phế liệu, kg/tiền ước tính, ngày và status. Không có lịch lấy hàng, nơi hẹn được phép chia sẻ, chi tiết đơn hay hành động liên hệ gắn mã đơn. Link hiện đưa người dùng về Chợ, nơi public chỉ liệt kê AVAILABLE. Chưa thấy endpoint hủy hoặc giải phóng đơn; Reservation có unique listingId và không có thời hạn giữ.

**Fix tối thiểu:** chi tiết đơn riêng cho người liên quan, mã đơn và hướng dẫn/liên hệ điều phối, lịch hẹn đơn giản; admin xử lý hủy và trả đơn về AVAILABLE theo quy tắc rõ ràng. Đừng công khai thông tin seller trong public feed. Giữ được lịch sử khi đặt lại: không xóa reservation để né unique constraint mà mất dấu giao dịch.

**Đạt khi:** reload xong buyer vẫn biết lấy hàng thế nào; seller/admin biết đơn nào cần xử lý; đơn hủy có thể đặt lại mà không mất lịch sử. Chốt mô hình trạng thái trước migration.

### F04 — P1: Nguồn thu chưa được chứng minh; spread hiện bằng 0

**Where:** `apps/api/src/marketplace/scrap-request.service.ts:187–188`, `apps/web/messages/vi.json:241`.

Giá seller và buyer đều gán từ cùng quote, nên chênh lệch giá của luồng này bằng 0. Buyer Pass hiện hiển thị 50.000đ/30 ngày; có checkout không đồng nghĩa collector sẵn sàng trả tiền hoặc đã có doanh thu.

**Fix tối thiểu:** chọn một giả thuyết thu phí để thử với collector; ghi rõ ai trả, trả khi nào và được gì. Nếu giữ Buyer Pass, đo willingness to pay và lượng đơn hữu ích mỗi kỳ. Nếu dùng phí theo đơn hoặc spread, sửa contract/giá công khai theo thỏa thuận thực tế.

`Contribution margin/đơn = doanh thu nền tảng trên đơn − chi phí nền tảng thực chịu trên đơn`.

Phân bổ rõ vận chuyển, vận hành, phí thanh toán và thưởng; tránh tính cả chi phí collector rồi gọi đó là chi phí nền tảng nếu collector tự chịu. Subscription ghi riêng theo kỳ và không tính hai lần. Cần dữ liệu và assumption cho ba kịch bản, chưa coi số minh họa là traction.

### F05 — P1: Thông điệp payOS dễ bị hiểu là thanh toán tiền bán phế liệu

**Where:** `apps/web/messages/vi.json:66`, `:176`, phần subscription payment trong API.

Hero ghi “Chuyển khoản qua payOS”; payment hiện phục vụ mua Buyer Pass. Trang Dịch vụ đã công khai rằng merchant checkout chưa được chạy thật, nhưng hero không nói rõ phạm vi. Chưa có quyết toán tiền bán phế liệu cho seller qua luồng payment này.

**Fix tối thiểu:** mô tả rõ payOS dùng mua Gói người mua, seller nhận tiền qua bước thu gom nào. Giữ nhãn demo/chưa kiểm chứng đến khi có giao dịch merchant hợp lệ và đối soát. Audit không thực hiện giao dịch trả tiền.

### F06 — P1: Báo điểm rác có thể thiếu vị trí; duyệt chưa đủ dấu vết vận hành

**Where:** `packages/shared/src/index.ts:562`, `apps/api/src/cleanup/cleanup.service.ts:143,176`, `apps/api/src/cleanup/cleanup-admin.controller.ts:34`, `apps/api/src/points/points.service.ts:18`.

Schema chỉ bắt buộc tọa độ xuất hiện theo cặp; mọi trường địa chỉ đều optional. Kiểm tra `safeParse` với description + mediaAssetId, không địa chỉ/tọa độ, trả về **success=true**. Dịch vụ lưu các trường thiếu thành null. Admin verify/reject chưa nhận actor hoặc lý do; verify cộng 50 điểm/report. Unique mediaAssetId và point reference chống dùng lại cùng record, chưa chứng minh cùng một bãi rác không được gửi lại bằng ảnh upload mới.

**Fix tối thiểu:** yêu cầu pin hoặc địa chỉ đủ tìm hiện trường tại API boundary; cho phép từ chối GPS. Ghi người duyệt, lý do từ chối và liên kết report trùng trong quy trình admin thủ công. Giữ tọa độ chính xác trong owner/admin view.

**Đạt khi:** payload không có nơi tìm bị từ chối; có địa chỉ hợp lệ vẫn gửi được khi từ chối GPS; cùng sự việc được kiểm tra trùng trước cấp điểm. VERIFIED là “báo cáo đã xác minh”, chưa phải “rác đã được dọn”; cần chứng từ xử lý riêng nếu đưa impact đó vào pitch.

### F07 — P2 / UI major: Bảng giá khó đọc trên mobile

**Where:** `apps/web/src/components/sell-scrap-view.tsx:81`.

Table hai cột có `min-w-[28rem]`. Đo production build local:

| Viewport | Vùng chứa | Bảng | Kết quả |
|---|---:|---:|---|
| 320px | 271px | 448px | Cần cuộn ngang |
| 375px | 326px | 448px | Cần cuộn ngang, giá bị khuất lúc đầu |
| 414px | 366px | 448px | Cần cuộn ngang |
| 768px | 703px | ~703px | Hai cột vừa vùng chứa |

Overflow nằm trong table container, không phải toàn trang. **Tell:** hierarchy bị yếu khi giá — thông tin cần ra quyết định — bị khuất.

**Fix:** bỏ minimum width cố định, cho tên vật liệu xuống dòng và giữ giá đọc được trong hai cột; chỉ đổi sang mỗi dòng tên/giá nếu cách đó vẫn quá chật. Không cần table library.

**Đạt khi:** cả tên và giá đọc được ngay ở 320/375/414px, số tiền không bị cắt; kiểm tra cả VI/EN.

### F08 — P2 / UI major: PageHeader mobile mất hierarchy

**Where:** `apps/web/src/components/page-header.tsx:21`, `apps/web/tailwind.config.ts`.

Utility `text-3.5xl` không có trong fontSize config. Browser đo H1 “Bán phế liệu” **16px** ở 375px; `sm:text-4xl` chỉ cứu cỡ chữ ở breakpoint lớn hơn. Component này được dùng ở nhiều trang công khai và admin. **Tell:** tiêu đề trang nhỏ như body text.

**Fix:** dùng utility đã có như `text-3xl` tại PageHeader chung; không thêm token mới chỉ cho một cỡ chữ.

**Đạt khi:** H1 các trang dùng PageHeader có cỡ 30px ở mobile, hierarchy rõ; text dài tiếng Việt/English không tràn. Không sửa riêng từng caller.

### F09 — P2: Đăng nhập xong chưa quay lại hành động đang làm

**Where:** `apps/web/src/components/sign-in-required.tsx:50`, `apps/web/src/components/login-form.tsx:78`, `apps/web/src/components/register-form.tsx:102`.

Link auth không lưu destination. Thành công chỉ chuyển sang thông báo đã đăng nhập; người dùng muốn bán phế liệu hoặc báo điểm rác phải tự tìm lại trang.

**Fix:** giữ internal return path theo locale cho login/register; sau thành công quay lại hành động đó, fallback về account. Validate destination để tránh open redirect; không dùng URL tùy ý từ query.

**Đạt khi:** VI/EN bắt đầu bán/báo điểm rác → auth → trở về đúng trang; destination ngoài website bị bỏ qua; lỗi auth giữ được input phù hợp.

### F10 — P2: Coupon còn là demo, chưa có bằng chứng giá trị đổi thưởng

**Where:** `apps/api/src/points/points.service.ts:94`, catalog migration `20260804000001_reward_offer_localized_catalog`, màn hình điểm thưởng.

Có 6 offers với nội dung VI/EN và preview, endpoint cố ý chỉ trả demoOnly. Chưa có redemption/đối tác thực được kiểm chứng. Đây là giới hạn demo đã công khai, không phải chứng minh endpoint hỏng.

**Fix tối thiểu:** giữ nhãn demo. Nếu dùng điểm thưởng làm value proposition chính, cần một đối tác, ngân sách thưởng, quy tắc và chứng từ đổi thưởng trong pilot; có thể xử lý thủ công trước khi viết redemption system.

## 4. Thiết kế nên cải thiện ở đâu

Giữ palette xanh, typography, navigation responsive, các trạng thái loading/error/empty và language switch đang có. Không đổi design system trong lượt sửa lỗi này. Các màn hình giao dịch cần trả lời ngay: “đơn của tôi đang ở đâu, ai xử lý, tôi phải làm gì, số tiền này là ước tính hay thực nhận”.

| Màn hình | Thay đổi nhỏ có giá trị |
|---|---|
| Hero | Làm rõ đối tượng, phạm vi thu gom và phạm vi payment; một CTA dẫn vào luồng đã chạy được |
| Bán phế liệu | Bảng giá đọc được mobile; phân biệt giá tham khảo, báo giá và tiền thực nhận |
| Đơn đã giữ | Bước tiếp theo + lịch hẹn + liên hệ điều phối có mã đơn |
| Admin hoàn tất | Cân và tiền thực tế trước nút xác nhận; đọc lại kết quả được |
| Báo điểm rác | Pin hoặc địa chỉ dùng được; trạng thái xác minh và xử lý có nghĩa khác nhau |
| Điểm thưởng | Demo label rõ; chỉ gọi là đổi thưởng thật sau khi đối tác thực hiện |

Hallmark UI audit: **0 critical · 2 major · 0 minor** trong các lỗi hiển thị đã xác minh ở lượt kiểm tra mobile này (F07/F08). Đây không phải chứng nhận mọi màn hình hoặc mọi accessibility requirement đều đạt. P1 business/flow ở trên dùng severity kỹ thuật riêng.

## 5. Pilot nhỏ để dự án trở nên thực tế

Đây là đề xuất phạm vi, chưa có cam kết từ đối tác hoặc người dùng: một trường/chung cư, một collector, một điểm tập kết và lịch thu gom cố định. Chọn 2–3 vật liệu dễ cân/phân loại. Người điều phối xử lý lịch và chứng từ thủ công trước.

Mục tiêu đầu tiên là một vòng khép kín: yêu cầu → báo giá → đồng ý → đặt giữ → hẹn lấy → cân → xác nhận nhận tiền → hoàn tất. Sau đó lặp đủ đơn để nhìn thấy chi phí và đơn hủy; không lấy việc dựng demo thay cho bằng chứng nhu cầu.

Ghi mỗi đơn: kg ước tính/thực cân, giá và tiền hai bên, phí nền tảng, ai chịu vận chuyển, thời gian điều phối, lý do hủy/khiếu nại và chứng từ. Tách số demo khỏi số pilot. Khối lượng “đã niêm yết” hiện tại không đổi tên thành “đã tái chế”; report VERIFIED không đổi tên thành “đã dọn”. Chưa có cơ sở để công bố giảm CO2.

Phỏng vấn seller và collector về ngưỡng khối lượng tối thiểu, giờ nhận, lỗi phân loại, khoản tiền sẵn sàng trả và lý do dùng lại. Đưa câu trả lời thực, số mẫu và giới hạn vào hồ sơ. Không tự viết testimonial hoặc financial traction.

## 6. Thứ tự làm tiếp

1. **Sửa nhỏ trước:** F01 GPS, F07 bảng giá, F08 PageHeader, F09 quay lại sau auth; chỉnh phạm vi copy payOS (F05). Không dependency mới hoặc redesign toàn site.
2. **Chốt một đơn chạy trọn vòng:** F02 quyết toán và F03 lấy/hủy đơn, schema/authorization rõ, test trạng thái và lịch sử. Tận dụng audit actor, transaction và account history sẵn có.
3. **Làm báo điểm rác dùng được:** F06 location validation và dấu vết duyệt; manual duplicate review đủ cho pilot.
4. **Có dữ liệu kinh doanh:** F04 thử một cơ chế thu phí với collector; F10 chỉ triển khai đổi thưởng thật khi có đối tác/ngân sách.
5. **Cập nhật pitch/báo cáo DBC:** Executive Summary, khách hàng/vấn đề có dẫn chứng, cạnh tranh, vận hành, marketing, vai trò đội, financial assumptions và kết quả pilot. UI hỗ trợ demo; business plan cần bằng chứng riêng.

Chưa có bằng chứng cần thêm microservices, AI phân loại, wallet, routing optimizer hay nhiều dashboard. Chỉ thêm khi pilot chỉ ra nhu cầu cụ thể.
