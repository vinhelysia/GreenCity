# Runbook ngày demo

Tài liệu này là hướng dẫn vận hành cho người thuyết trình, không phải hướng dẫn
can thiệp vào dữ liệu đang phục vụ người dùng. Đọc mục 1 trước khi lên sân khấu.

## Trạng thái phải nói đúng

- **CURRENT**: đăng ký/đăng nhập, yêu cầu bán phế liệu, báo giá và xác nhận giao
  dịch bởi admin, marketplace với một người đặt giữ, báo cáo điểm rác, sổ điểm
  và Account dashboard đọc dữ liệu gần đây.
- **DEMO**: catalog coupon, ưu đãi EVN và nước chỉ cho xem minh hoạ. Mã
  `DEMO-ONLY` không đổi điểm, không thanh toán và không có giá trị sử dụng.
- **ROADMAP**: redemption thật chỉ được mở sau thỏa thuận và integration với
  đối tác. Không có ngày phát hành đã xác nhận.

Không gọi số liệu trong demo database là traction, số người dùng hay doanh thu.

## 1. Chuẩn bị an toàn (T-5 phút)

### 1.1 Xác nhận đúng deployment — chỉ đọc

`https://green-city-web.vercel.app` là fallback canonical trong code, không phải
bằng chứng rằng URL đó đang trỏ vào một demo database riêng. Chỉ dùng một web/API
deployment sau khi operator xác nhận cả hai đang dùng **dedicated demo project**
và dedicated storage; nếu URL hiện tại dùng shared/production data, chỉ kiểm tra
read-only hoặc dùng một demo deployment khác.

Từ PowerShell, thay hai URL bằng URL của dedicated demo deployment. Lệnh này chỉ
đọc health endpoint và không hiển thị bí mật:

```powershell
$demoWebUrl = 'https://<dedicated-demo-web-host>'
$demoApiUrl = 'https://<dedicated-demo-api-host>'

$health = Invoke-RestMethod -Uri "$demoApiUrl/health" -TimeoutSec 90
if ($health.status -ne 'ok') {
  throw 'Dedicated demo API is not ready. Stop; do not reset any data.'
}

# Mở $demoWebUrl thủ công trước khi trình bày.
```

Render free-tier có thể cold-start. Warm endpoint của **dedicated** API trước,
chờ `status: ok`, rồi giữ tab web mở. Không dùng điều này để suy ra trạng thái của
database khác.

### 1.2 Reset dữ liệu chỉ cho dedicated demo project

`corepack pnpm --filter api db:seed` có chủ đích reset seed-owned listings, reservations,
báo cáo và point entries. Dù seed không nhắm tới row do người dùng thật tạo, nó vẫn
là thao tác ghi dữ liệu và **không được chạy** với shared hoặc production database.

Điều kiện bắt buộc trước khi seed:

1. Có Supabase project/database và storage riêng, disposable, dành cho demo.
2. Dedicated web/API deployment ở mục 1.1 đã được cấu hình chính xác tới project đó.
3. File không commit `.env.demo.local` chứa credentials của **chỉ** project này:
   `DATABASE_URL`, `DEMO_PASSWORD`, `STORAGE_DRIVER=supabase`, `SUPABASE_URL`,
   `SUPABASE_SERVICE_KEY`, `SUPABASE_STORAGE_BUCKET`; không in file hay dán
   secret vào terminal, slide hoặc recording.
4. Operator biết chính xác **project ref** từ Supabase Dashboard URL/Connection.

Chạy từ repository root. Điền giá trị không bí mật của đúng dedicated project;
script không echo giá trị environment hoặc password:

```powershell
$ErrorActionPreference = 'Stop'
$demoEnvPath = Join-Path $PWD '.env.demo.local'
$expectedDemoProjectRef = '<exact dedicated Supabase project ref>'
$allowedNames = @(
  'DATABASE_URL', 'DEMO_PASSWORD', 'STORAGE_DRIVER', 'SUPABASE_URL',
  'SUPABASE_SERVICE_KEY', 'SUPABASE_STORAGE_BUCKET'
)
$requiredNames = $allowedNames

if (-not (Test-Path -LiteralPath $demoEnvPath)) {
  throw 'Missing .env.demo.local. Stop; do not fall back to .env.'
}

$loadedNames = [System.Collections.Generic.List[string]]::new()
$previousValues = @{}

try {
  foreach ($line in Get-Content -LiteralPath $demoEnvPath) {
    if ($line -notmatch '^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=(.*)$') { continue }
    $name = $Matches[1]
    if ($name -notin $allowedNames) {
      throw "Unexpected key '$name' in .env.demo.local. Stop."
    }
    $value = $Matches[2].Trim()
    if ($value -match '^"(.*)"$' -or $value -match "^'(.*)'$") {
      $value = $Matches[1]
    }
    if (-not $previousValues.ContainsKey($name)) {
      $existing = Get-Item -LiteralPath "Env:$name" -ErrorAction SilentlyContinue
      $previousValues[$name] = @{
        Exists = $null -ne $existing
        Value = if ($null -ne $existing) { $existing.Value } else { $null }
      }
      $null = $loadedNames.Add($name)
    }
    Set-Item -LiteralPath "Env:$name" -Value $value
  }

  foreach ($requiredName in $requiredNames) {
    if ([string]::IsNullOrWhiteSpace([Environment]::GetEnvironmentVariable($requiredName))) {
      throw "Required dedicated key '$requiredName' is missing. Stop."
    }
  }
  if ($env:STORAGE_DRIVER -ne 'supabase') {
    throw 'Hosted demo seed must use dedicated Supabase storage. Stop.'
  }

  $databaseUri = [Uri]$env:DATABASE_URL
  $databaseUser = [Uri]::UnescapeDataString(($databaseUri.UserInfo -split ':', 2)[0])
  $actualProjectRef = $null
  if ($databaseUri.Host -match '^db\.([a-z0-9]+)\.supabase\.co$') {
    $actualProjectRef = $Matches[1]
  } elseif ($databaseUri.Host -match '\.pooler\.supabase\.com$' -and
            $databaseUser -match '^postgres\.([a-z0-9]+)$') {
    $actualProjectRef = $Matches[1]
  }

  if ($databaseUri.Scheme -notin @('postgres', 'postgresql') -or
      [string]::IsNullOrWhiteSpace($actualProjectRef) -or
      $actualProjectRef -ine $expectedDemoProjectRef) {
    throw 'Could not prove DATABASE_URL belongs to the approved demo project ref. Stop.'
  }

  $storageUri = [Uri]$env:SUPABASE_URL
  if ($storageUri.Scheme -ne 'https' -or
      $storageUri.Host -ine "$expectedDemoProjectRef.supabase.co") {
    throw 'SUPABASE_URL does not match the approved dedicated demo project ref. Stop.'
  }

  $confirmation = Read-Host "Type '$expectedDemoProjectRef' to seed this dedicated demo project"
  if ($confirmation -cne $expectedDemoProjectRef) {
    throw 'Confirmation did not match. Nothing was seeded.'
  }

  corepack pnpm --filter api db:seed
  if ($LASTEXITCODE) { throw 'db:seed failed.' }
} finally {
  foreach ($name in $loadedNames) {
    $before = $previousValues[$name]
    if ($before.Exists) {
      Set-Item -LiteralPath "Env:$name" -Value $before.Value
    } else {
      Remove-Item -LiteralPath "Env:$name" -ErrorAction SilentlyContinue
    }
  }
}
```

The preflight accepts only a direct Supabase host `db.<project-ref>.supabase.co`
or a pooler URL whose username is `postgres.<project-ref>`. If it cannot extract
and match the project ref, it stops. Also confirm the web/API deployment selected
in 1.1 uses that project; if any part is unclear, do not seed.

After a successful dedicated seed, verify the API wired to that same project:

```powershell
$stats = Invoke-RestMethod -Uri "$demoApiUrl/stats" -TimeoutSec 30
if ($stats.availableListings -ne 5 -or $stats.totalPointsAwarded -ne 0) {
  throw 'Unexpected dedicated demo start state. Stop and investigate; do not seed another target.'
}
```

For an otherwise clean dedicated project, the seed defines five available listings,
one submitted cleanup report, an active **demo** Buyer Pass for
`buyer@greencity.demo`, and zero seeded reward points. The created demo pass has
no real payment processed.

## 2. Tài khoản và tab chuẩn bị sẵn

| Mục đích | Tài khoản | Route |
| --- | --- | --- |
| Duyệt giao dịch, báo giá, báo cáo | `admin@greencity.demo` | `/admin/giao-dich`, `/admin/dong-gop`, `/admin/bao-gia` |
| Xem bán và điểm sau giao dịch | `seller@greencity.demo` | `/tai-khoan` |
| Đặt giữ, báo cáo điểm rác, xem lịch sử | `buyer@greencity.demo` | `/cho-online`, `/tai-khoan` |

Password là `DEMO_PASSWORD` của dedicated demo environment, không nằm trong repo
và không hiển thị trên slide. Admin routes không xuất hiện trong navigation; mở
sẵn các tab sau khi đăng nhập và xác nhận chúng là dedicated demo deployment.

## 3. Kịch bản 5 phút

| Thời gian | Thao tác | Bằng chứng nên nói |
| --- | --- | --- |
| 0:00 | Trang chủ | Dữ liệu đang hiển thị là dữ liệu từ dedicated demo DB; không gọi là traction. |
| 0:30 | `seller@` mở một lô có sẵn ở `/cho-online` | Lô đã qua luồng báo giá/niêm yết; UI không công khai danh tính hay liên hệ người bán cho buyer. |
| 1:15 | `buyer@` đặt giữ đúng lô | Một lô chỉ có một đặt giữ thành công; Buyer Pass là điều kiện eligibility. |
| 2:00 | `admin@` vào `/admin/giao-dich` và hoàn tất giao dịch | Điểm không được cộng lúc đăng tin hoặc đặt giữ; chỉ sau xác nhận hoàn tất. |
| 2:35 | `seller@` mở `/tai-khoan` | Account dashboard chứng minh sale gần đây và point ledger/balance thay đổi từ sự kiện đã hoàn tất. |
| 3:10 | `admin@` xác minh báo cáo đang chờ ở `/admin/dong-gop` | Chỉ báo cáo đã xác minh nhận +50 điểm. |
| 3:35 | `buyer@` mở `/tai-khoan` | Chỉ ra cleanup report và điểm, reservation gần đây, Buyer Pass và phần payment history. Với seed, payment history trống là **đúng**: pass demo không phải thanh toán thật. |
| 4:15 | Mở catalog rewards hoặc notice trên Account dashboard | Nói rõ no-cash: không rút/chuyển điểm. Coupon, EVN và nước là demo-only; không đổi điểm, thanh toán hay affiliation hiện hành. |

Account dashboard là bằng chứng read-only cho năm nhóm dữ liệu: điểm, yêu cầu bán,
đặt giữ, trạng thái/lịch sử payment và cleanup report. Nó không khởi tạo withdrawal,
redemption, payment hay mutation nào. Không tạo payment record giả chỉ để demo phần
lịch sử; trạng thái rỗng là bằng chứng trung thực khi chưa có giao dịch thật.

## 4. Xử lý sự cố

| Hiện tượng | Xử lý an toàn |
| --- | --- |
| API chậm ở lần đầu | Chờ health của dedicated API trả `status: ok`, rồi reload. |
| `SUBSCRIPTION_REQUIRED` | Kiểm đúng `buyer@` và active demo Buyer Pass trong dedicated project. |
| `CANNOT_RESERVE_OWN_LISTING` | Đổi từ `seller@` sang `buyer@`. |
| Hoàn tất/xác minh trả 409 | Kiểm trạng thái của item. Chỉ khi đang ở dedicated demo project mới quay lại mục 1.2, lặp lại preflight và confirmation; không “seed lại cho nhanh”. |
| Điểm chưa đổi | Điểm bán thuộc seller sau completed transaction; điểm cleanup thuộc reporter sau verified report. Mở đúng Account dashboard. |
| Ảnh không hiện | Kiểm health và dedicated storage configuration. Không thay ảnh bằng link public hay tiết lộ storage credentials. |

## 5. Câu hỏi phản biện thường gặp

- **“Điểm có phải tiền hoặc rút được không?”** Không. Điểm là reward nội bộ,
  không mua bán, chuyển nhượng hoặc rút tiền mặt.
- **“Coupon/EVN/nước có dùng thật không?”** Không. Đó là demo-only catalog;
  preview không trừ điểm, không thanh toán và GreenCity không tuyên bố hợp tác
  chính thức với đơn vị được nêu.
- **“Đã có thanh toán payOS thật chưa?”** Không tuyên bố điều đó. Code có flow
  có điều kiện, nhưng chưa có checkout và signed webhook nào được quan sát với
  merchant account thật; seed Buyer Pass cũng không phải payment.
- **“Mô hình doanh thu là gì?”** Buyer Pass và price spread là giả thuyết mô
  hình, không phải revenue/traction đã được chứng minh trong demo này.
- **“Chống cày điểm thế nào?”** Điểm chỉ được ghi khi admin xác nhận completed
  sale hoặc verified report; mỗi source event được bảo vệ để không cộng lặp.

## 6. Ảnh và bằng chứng trình bày

Không sửa binary trong `apps/web/screenshots/` bằng tay. Bộ ảnh committed hiện
chỉ là public/foundation evidence. Để regenerate đúng bộ đó sau khi có local
test prerequisites, dùng:

```powershell
corepack pnpm --filter web exec playwright install chromium
corepack pnpm --filter web test:e2e -- --grep "Approved screenshot set"
```

Lệnh trên cần dependency đã cài, Chromium, production build do `pretest:e2e`
tạo, và local API/database test-ready theo `apps/web/playwright.config.ts`.
Nó không tạo ảnh Account đã đăng nhập. Chụp Account dashboard thủ công chỉ trên
dedicated demo deployment, che email/định danh không cần thiết và không ghi đè
bộ binary committed. Muốn thêm Account screenshot có thể tái tạo phải có một
deterministic auth fixture và reviewed Playwright spec trước.

Xem [`docs/startup-contest-presentation.md`](startup-contest-presentation.md)
để có slide outline và screenshot checklist.
