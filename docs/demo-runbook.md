# Runbook ngày demo

Trang cầm tay khi trình bày. Đọc mục 1 **trước khi lên sân khấu**, không phải lúc đang đứng trên đó.

## 1. Chuẩn bị (T-5 phút) — bắt buộc

**a) Hâm nóng server.** Render bản miễn phí ngủ sau ~15 phút không có traffic; lần gọi đầu mất
~50 giây. Workflow `keepalive.yml` chỉ là dự phòng — GitHub throttle cron tần suất cao xuống
còn ~1 lần/giờ, nên **không được tin nó**. Chạy đến khi thấy `"status":"ok"`:

```bash
curl -s -m 90 https://greencity-api.onrender.com/health
```

Rồi mở sẵn `https://green-city-web.vercel.app` trên trình duyệt và để nguyên tab đó.

**b) Đưa dữ liệu về vạch xuất phát.** Bắt buộc nếu vừa chạy thử:

```bash
set -a; . ./.env.supabase.local; set +a; cd apps/api && pnpm db:seed
```

Vạch xuất phát đúng phải là: **4 tin đang bán · 1 báo cáo rác chờ xác minh · 0 điểm thưởng**.
Kiểm nhanh bằng `curl -s https://greencity-api.onrender.com/stats` →
`availableListings:4`, `totalPointsAwarded:0`.

## 2. Địa chỉ và tài khoản

| | |
|---|---|
| Web | https://green-city-web.vercel.app |
| API | https://greencity-api.onrender.com |
| Tài khoản | `admin@` · `seller@` · `buyer@` (đều `@greencity.demo`) |
| Mật khẩu | `DEMO_PASSWORD` trong `.env.supabase.local` — **không nằm trong repo** |

Trang quản trị **không nằm trong thanh điều hướng** — phải gõ thẳng địa chỉ, nên **mở sẵn tab
trước khi lên**:

| Việc | Địa chỉ |
|---|---|
| Xác nhận giao dịch (khoảnh khắc chốt) | `/admin/giao-dich` |
| Duyệt báo cáo điểm rác | `/admin/dong-gop` |
| Báo giá cho tin đăng | `/admin/bao-gia` |

`buyer@` đã có gói đang hoạt động (điều kiện để đặt giữ) và cũng là người gửi báo cáo rác.

## 3. Kịch bản 5 phút

| Phút | Làm gì | Đăng nhập bằng |
|---|---|---|
| 0:00 | Trang chủ — chỉ vào dải số liệu thật | — |
| 0:30 | Đăng tin bán phế liệu (`/ban-phe-lieu`) | `seller@` |
| 1:30 | Đặt giữ một tin trên `/cho-online` — nêu rõ **không thấy danh tính người bán** | `buyer@` |
| 2:30 | **Khoảnh khắc chốt**: `/admin/giao-dich` → bấm **Hoàn tất giao dịch** → mở `/diem-thuong` thấy điểm nhảy từ 0 | `admin@` rồi `seller@` |
| 3:30 | `/admin/dong-gop` → xác minh báo cáo đang chờ → người báo được +50 | `admin@` |
| 4:15 | Chốt vòng lặp: điểm đổi qua Dịch vụ công cộng TPHCM (định hướng) | — |

Cách tính điểm: **1 điểm cho mỗi 1.000đ người bán nhận** (tối thiểu 1), và **50 điểm** cho mỗi
điểm rác được xác minh. Ví dụ tin Sắt vụn 8kg × 6.000đ = 48.000đ → **48 điểm**.

## 4. Sự cố và cách xử lý

| Hiện tượng | Nguyên nhân | Xử lý |
|---|---|---|
| Trang quay mãi ở lần tải đầu | Render đang ngủ | Chờ ~50s, tải lại. Tránh bằng mục 1a |
| Đặt giữ báo `SUBSCRIPTION_REQUIRED` | Đang đăng nhập sai tài khoản | Phải là `buyer@` |
| Đặt giữ báo `CANNOT_RESERVE_OWN_LISTING` | Đang là `seller@` | Đổi sang `buyer@` |
| Hoàn tất báo 409 | Tin chưa được đặt giữ, hoặc đã hoàn tất rồi | Đặt giữ trước, hoặc chạy lại seed |
| Xác minh báo cáo báo 409 | Báo cáo đã được xác minh | Chạy lại seed để có báo cáo mới |
| Điểm không nhảy | Xem nhầm tài khoản | Điểm bán thuộc `seller@`, điểm rác thuộc `buyer@` |
| Ảnh không hiện | Supabase Storage | Kiểm `/health`; ảnh phục vụ qua API, không phải link công khai |

**Quy tắc vàng khi bí:** chạy lại seed ở mục 1b — nó đưa mọi thứ về vạch xuất phát trong vài giây.

## 5. Câu phản biện hay gặp

- **"Kiếm tiền kiểu gì?"** — phí gói người mua, cộng chênh lệch giá mua/bán mỗi kg (hệ thống lưu
  cả hai mức giá). Điểm thưởng là chi phí giữ chân, không phải doanh thu.
- **"Điểm có phải tiền không?"** — không. Điểm nội bộ, chỉ đổi lấy dịch vụ công cộng. Sổ điểm
  **chỉ ghi thêm**, mỗi điểm truy được về sự kiện sinh ra nó. Cố tình không làm đổi tự do.
- **"Chống cày điểm thế nào?"** — chỉ cộng khi giao dịch **hoàn tất** (admin xác minh), không cộng
  lúc đăng hay đặt giữ; mỗi sự kiện cộng đúng một lần, ràng buộc ở tầng cơ sở dữ liệu.
- **"Số liệu nhỏ quá?"** — số thật trên cơ sở dữ liệu chạy thật, không thổi phồng.
