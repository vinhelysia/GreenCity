# Luồng thu gom — 2026-10-02

Quy tắc đã được user chọn: admin điều phối; buyer/seller xem lịch; admin xác nhận tiền seller thực nhận bằng biên nhận thủ công; giữ tỷ lệ điểm hiện tại nhưng tính từ tiền thực nhận.

## Phạm vi và acceptance criteria

- Đặt giữ thành công dẫn tới chi tiết đơn trong tài khoản. Buyer và seller đều tìm được đơn trong lịch sử; người ngoài không đọc được đơn.
- Admin ghi ngày giờ, điểm hẹn và liên hệ điều phối. Buyer/seller chỉ xem; liên hệ riêng của hai bên chỉ hiện cho admin.
- Admin hủy với lý do: giữ đơn CANCELLED trong lịch sử, đưa tin về AVAILABLE và cho phép đặt lại. Database chỉ cho một reservation RESERVED trên một tin.
- Admin hoàn tất với kg thực cân (>0, <=1000), tiền seller đã nhận (số nguyên VND >0, <=2,147,483,647) và mã/ghi chú biên nhận (bắt buộc). Lưu người xử lý và thời điểm.
- Hoàn tất, cập nhật tin và cộng điểm nằm trong một transaction. Điểm = max(1, floor(tiền thực nhận / 1000)); một tin chỉ thưởng một lần. Hủy và hoàn tất đồng thời chỉ một thao tác thành công.
- Đơn lịch sử được backfill trạng thái từ tin; các số thực nhận chưa có giữ null, UI ghi rõ chưa có dữ liệu. Không suy diễn số ước tính thành giao dịch thực.
- Dùng reservationId cho mọi mutation, ngăn thao tác từ một tab cũ tác động tới lượt đặt mới.
- Chỉ migrate và kiểm thử database loopback đã backup. Không deploy hoặc thay keys, không thay Buyer Pass/payOS.

## Các bước

- [x] Contract + migration giữ lịch sử; backup local và kiểm tra backfill bằng fixture 4 trạng thái trong transaction rollback.
- [x] Private detail, admin schedule/cancel/complete, lịch sử hai phía; tests quyền truy cập, đặt lại, concurrency, điểm thực nhận và rollback khi ledger lỗi.
- [x] UI dùng account và admin queue hiện có; form native, nhãn VI/EN, trạng thái lỗi/đang xử lý.
- [x] Typecheck, unit/integration, smoke, build và browser E2E local; cập nhật audit.

Giới hạn pilot: không chat, routing tài xế, tự động thanh toán tiền phế liệu hoặc tự gửi thông báo. Lịch hẹn hiển thị theo timezone thiết bị; thời gian lưu UTC. Deploy phải áp dụng migration API trước khi dùng UI mới; không rollback migration về unique listingId nếu đã có lịch sử đặt lại.

## Verification

- API: 19 unit suites / 174 tests, 8 integration suites / 130 tests; custom storage/path checks và Nest build pass.
- Web: typecheck/lint, smoke (70 files, 453 dictionary keys), production build (31 pages) pass.
- Browser: 22 targeted tests đã pass qua các lượt chạy auth, account dashboard, pagination và marketplace. Không chạy toàn bộ E2E suite.
- Full marketplace browser test dùng seller/buyer riêng: yêu cầu + ảnh → báo giá → chấp nhận → admin cấp pass cho buyer → đặt giữ → hủy → đặt lại → lịch hẹn → seller xem lịch → hoàn tất → seller thấy tiền, biên nhận và điểm đúng. Form và detail không overflow ở 375px; receipt VI/EN có checks riêng.
- Test đầu tiên tái hiện sai điểm 6 thay vì 4 cho tiền thực nhận 4.500đ. Test browser ban đầu còn phụ thuộc Buyer Pass demo hết hạn; đã thay bằng buyer test riêng, không sửa pass demo hoặc ghi nhận payment thật.
- Backup và ảnh: `.local/verification/collection-flow-2026-10-02/`. Test users, listing, reservations được cleanup; screenshot là dữ liệu demo.
- Keys `.env`, `.env.render.local`, `.env.supabase.local` không đổi. Không push/deploy hoặc migrate production.

API mới: `GET /marketplace/reservations/:id`, `POST /admin/reservations/:id/{schedule,cancel,complete}`. Endpoint hoàn tất cũ theo listingId được thay bằng reservationId để tránh xử lý nhầm lần đặt mới. Khi deploy, phối hợp rollout API/web; frontend cũ không thể hoàn tất qua endpoint cũ.
