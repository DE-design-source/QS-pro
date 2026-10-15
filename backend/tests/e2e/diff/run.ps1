# Chạy bộ so sánh vi sai Node <-> Go từ đầu đến cuối:
#   reset qspro_nodetest + qspro_gotest về cùng seed -> bật server Node (3997) và Go (3998, trong container) với env an toàn
#   -> chạy kịch bản -> tắt 2 server -> in báo cáo, thoát mã khác 0 nếu có chỗ khác.
# Dùng:  powershell -ExecutionPolicy Bypass -File backend/tests/e2e/diff/run.ps1 [-Filter area1/02,area1/03] [-ShowAll] [-KeepServers] [-NoReset]
# Chỉ đụng 2 database tạm; không đọc DATABASE_URL trong .env; webhook / storage / Lark đều trỏ vào server giả cục bộ (cổng 4101 / 4102).
param([string[]]$Filter = @(), [switch]$ShowAll, [switch]$KeepServers, [switch]$NoReset)
$ErrorActionPreference = 'Continue'
$Filter = @($Filter | ForEach-Object { $_ -split ',' } | Where-Object { $_ })
$here = $PSScriptRoot
$repo = (Resolve-Path (Join-Path $here '..\..\..\..')).Path
$out = Join-Path $here '.out'
New-Item -ItemType Directory -Force $out | Out-Null

$pw = (docker exec qspro-postgres printenv POSTGRES_PASSWORD | Out-String).Trim()
if (-not $pw) { Write-Host 'Khong doc duoc mat khau Postgres (container qspro-postgres).'; exit 2 }
$nodeDb = "postgresql://qspro:$pw@localhost:5434/qspro_nodetest"
$goDb = "postgresql://qspro:$pw@localhost:5434/qspro_gotest"
$goDbIn = "postgresql://qspro:$pw@host.docker.internal:5434/qspro_gotest"
# Env dùng CHUNG cho 2 server (đặt rõ để không lấy từ .env)
$common = [ordered]@{
  AUTH_SECRET = 'diff-harness-secret-1'; RENDER_GIT_COMMIT = 'diff-harness'; SWAGGER_DOCS = '0'
  LARK_APP_ID = 'cli_fake_app'; LARK_APP_SECRET = 'fake-app-secret'; SUPABASE_KEY_OVERRIDE = 'fake-storage-key'; SUPABASE_BUCKET = 'products'
  TZ = 'Asia/Ho_Chi_Minh'   # thẻ Lark in ngày theo giờ máy: 2 server phải cùng múi giờ
}
# Kho file / webhook / Lark: server GIẢ của bộ so sánh (lib/fake.js), mỗi phía một cổng; Go trong container gọi qua host.docker.internal
function Fake-Env([string]$base) {
  return [ordered]@{ SUPABASE_URL_OVERRIDE = $base; PURCHASE_WEBHOOK = "$base/hook/purchase"; REPORT_WEBHOOK = "$base/hook/report"; LARK_DOMAIN = $base }
}
$nodeFake = Fake-Env 'http://127.0.0.1:4101'
$goFake = Fake-Env 'http://host.docker.internal:4102'

function Stop-Servers {
  docker exec qspro-go pkill qsapi 2>$null | Out-Null
  $c = Get-NetTCPConnection -LocalPort 3997 -State Listen -ErrorAction SilentlyContinue
  foreach ($x in $c) {
    $p = Get-Process -Id $x.OwningProcess -ErrorAction SilentlyContinue
    if ($p -and $p.ProcessName -eq 'node') { Stop-Process -Id $p.Id -Force -Confirm:$false }
  }
}
function Reset-Db([string]$db) {
  if ($db -ne 'qspro_nodetest' -and $db -ne 'qspro_gotest') { throw "khong reset $db" }
  docker exec qspro-postgres sh -c "dropdb -U qspro --if-exists --force $db && createdb -U qspro $db && psql -q -U qspro -d $db -f /tmp/qspro_seed.sql >/dev/null"
  if ($LASTEXITCODE -ne 0) { Write-Host "Reset $db loi"; exit 2 }
}

Stop-Servers
Start-Sleep -Milliseconds 500
if (-not $NoReset) { Reset-Db 'qspro_nodetest'; Reset-Db 'qspro_gotest'; Write-Host 'Da reset 2 database ve seed.' }
# Job báo cáo tự động của Node không tắt được bằng env: 70 giây sau khi bật (và lúc 8h00) vào thứ 4 / thứ 7 nó gửi thẻ + ghi audit_logs,
# trong khi Go chạy với REPORT_JOB=0 -> 2 database lệch nhau giữa chừng. Node bỏ qua khi hôm nay ĐÃ có dòng audit 'bao_cao_nhap_sp'
# (daGuiBaoCaoHomNay_, server/index.js:554), nên chèn sẵn 1 dòng như vậy vào CẢ HAI database (giống hệt nhau, chỉ khi hôm nay chưa có).
$guard = "insert into audit_logs (username, action, detail) select 'diff-harness', 'bao_cao_nhap_sp', 'diff-harness: chan job bao cao tu dong cua Node trong luot chay' where not exists (select 1 from audit_logs where action = 'bao_cao_nhap_sp' and (created_at at time zone 'Asia/Ho_Chi_Minh')::date = (now() at time zone 'Asia/Ho_Chi_Minh')::date)"
foreach ($db in 'qspro_nodetest', 'qspro_gotest') {
  docker exec qspro-postgres psql -q -U qspro -d $db -c $guard
  if ($LASTEXITCODE -ne 0) { Write-Host "Khong chen duoc dong chan job bao cao vao $db"; exit 2 }
}

# Go: build + chạy trong container
docker exec qspro-go sh -c "cd /repo/backend && go build -o /tmp/qsapi ./cmd/api"
if ($LASTEXITCODE -ne 0) { Write-Host 'go build loi'; exit 2 }
$goArgs = @('exec', '-d', '-e', 'PORT=3998', '-e', "DATABASE_URL=$goDbIn", '-e', 'REPORT_JOB=0')
foreach ($k in $common.Keys) { $goArgs += @('-e', "$k=$($common[$k])") }
foreach ($k in $goFake.Keys) { $goArgs += @('-e', "$k=$($goFake[$k])") }
$goArgs += @('qspro-go', 'sh', '-c', 'cd /repo/backend && /tmp/qsapi > /tmp/qsapi.log 2>&1')
& docker @goArgs | Out-Null

# Node tham chiếu: env chỉ đặt cho tiến trình con
$saved = @{}
$nodeEnv = @{ PORT = '3997'; DATABASE_URL = $nodeDb }
foreach ($k in $common.Keys) { $nodeEnv[$k] = $common[$k] }
foreach ($k in $nodeFake.Keys) { $nodeEnv[$k] = $nodeFake[$k] }
foreach ($k in $nodeEnv.Keys) { $saved[$k] = [Environment]::GetEnvironmentVariable($k, 'Process'); [Environment]::SetEnvironmentVariable($k, $nodeEnv[$k], 'Process') }
$nodeProc = Start-Process -FilePath 'node' -ArgumentList 'server/index.js' -WorkingDirectory $repo -WindowStyle Hidden -PassThru `
  -RedirectStandardOutput (Join-Path $out 'node.log') -RedirectStandardError (Join-Path $out 'node.err.log')
foreach ($k in $nodeEnv.Keys) { [Environment]::SetEnvironmentVariable($k, $saved[$k], 'Process') }

$code = 2
try {
  $env:NODE_DB = $nodeDb; $env:GO_DB = $goDb; $env:AUTH_SECRET = $common.AUTH_SECRET
  $env:NODE_URL = 'http://localhost:3997'; $env:GO_URL = 'http://localhost:3998'; $env:DIFF_OUT = $out
  if ($ShowAll) { $env:VERBOSE = '1' } else { $env:VERBOSE = '' }
  & node (Join-Path $here 'index.js') @Filter
  $code = $LASTEXITCODE
} finally {
  foreach ($k in 'NODE_DB', 'GO_DB', 'AUTH_SECRET', 'NODE_URL', 'GO_URL', 'DIFF_OUT', 'VERBOSE') { [Environment]::SetEnvironmentVariable($k, $null, 'Process') }
  docker exec qspro-go cat /tmp/qsapi.log 2>$null | Out-File -Encoding utf8 (Join-Path $out 'go.log')
  if (-not $KeepServers) {
    Stop-Servers
    if ($nodeProc -and -not $nodeProc.HasExited) { Stop-Process -Id $nodeProc.Id -Force -Confirm:$false }
  }
}
Write-Host "Log server: $out\node.log, $out\go.log. Ma thoat: $code"
exit $code
