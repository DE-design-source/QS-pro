/* Danh mục font của SiteFlow (Cài đặt ▸ Giao diện ▸ Font chữ).
   Font Google trong danh sách đều có bộ chữ tiếng Việt và chỉ được tải khi người dùng chọn. */

export const FONT_CATEGORIES = [
  ['all', 'Tất cả'], ['sans', 'Không chân'], ['serif', 'Có chân'], ['display', 'Trang trí'],
  ['hand', 'Viết tay'], ['mono', 'Đơn cách'], ['microsoft', 'Microsoft'], ['apple', 'Apple'],
]

const FALLBACK = { sans: 'sans-serif', serif: 'serif', display: 'sans-serif', hand: 'cursive', mono: 'monospace' }
const google = (cat, names) => names.map(name => ({ name, cat, google: true, value: `'${name}', ${FALLBACK[cat]}` }))
/* Font cài sẵn của Windows / Office / macOS / iOS: local = chỉ hiện đúng khi máy có font (xem isFontAvailable);
   src = nơi có sẵn font; detect = tên dùng để kiểm tra máy đã có font chưa (mặc định là name);
   alias = font mà hệ điều hành tự thay vào khi thiếu font này (vd. Windows: Helvetica → Arial).
   Chỉ giữ font có đủ 146 chữ cái tiếng Việt có dấu — đã kiểm tra trực tiếp trong file font. Georgia, Trebuchet MS,
   Comic Sans, Century Gothic, Avenir, Futura, Optima, Menlo… thiếu dấu (ả, ẩ, ơ, ư…) nên không đưa vào */
const local = cat => (name, value, src, detect) => ({ name, cat, value, src, local: true, ...(detect ? { detect } : {}) })
const microsoft = local('microsoft')
const apple = local('apple')

/* value = giá trị lưu vào siteflow-customize.fontFamily ('' = Montserrat mặc định, đi kèm app) */
export const FONT_CATALOG = [
  { name: 'Montserrat', cat: 'sans', value: '' },
  ...google('sans', [
    'Be Vietnam Pro', 'Inter', 'Roboto', 'Open Sans', 'Nunito', 'Nunito Sans', 'Lexend', 'Lexend Deca', 'Noto Sans',
    'Source Sans 3', 'Manrope', 'Plus Jakarta Sans', 'Quicksand', 'Raleway', 'Mulish', 'Josefin Sans', 'Work Sans',
    'IBM Plex Sans', 'Fira Sans', 'Barlow', 'Exo 2', 'Public Sans', 'Space Grotesk', 'Cabin', 'Dosis', 'Kanit', 'Prompt',
    'Sarabun', 'Signika', 'Saira', 'Encode Sans', 'Asap', 'Archivo', 'Maven Pro', 'Arimo', 'Varela Round', 'Play',
    'Roboto Condensed', 'Oswald', 'Montserrat Alternates', 'Chakra Petch', 'Bai Jamjuree', 'K2D', 'Niramit', 'Andika',
    'Geologica', 'Onest', 'Wix Madefor Display', 'Readex Pro', 'Epilogue', 'Hanken Grotesk', 'Bricolage Grotesque',
  ]),
  ...google('serif', [
    'Noto Serif', 'Playfair Display', 'Merriweather', 'Lora', 'Roboto Slab', 'Bitter', 'EB Garamond', 'Cormorant Garamond',
    'Tinos', 'Alegreya', 'Crimson Pro', 'Philosopher', 'Old Standard TT', 'Spectral', 'Vollkorn', 'Faustina', 'Literata',
    'Newsreader', 'Gelasio',
  ]),
  ...google('display', [
    'Comfortaa', 'Baloo 2', 'Lobster', 'Bungee', 'Anton', 'Paytone One', 'Alfa Slab One', 'Yeseva One', 'Grandstander',
    'Amatic SC',
  ]),
  ...google('hand', ['Pacifico', 'Dancing Script', 'Patrick Hand', 'Charm', 'Mali', 'Itim', 'Pangolin', 'Sriracha']),
  ...google('mono', ['Roboto Mono', 'Inconsolata', 'Source Code Pro', 'JetBrains Mono', 'Space Mono']),
  /* Giá trị của Segoe UI, Arial, Tahoma, Verdana, Times New Roman, Courier New giữ nguyên như trước để lựa chọn đã lưu vẫn khớp */
  microsoft('Segoe UI', "'Segoe UI', sans-serif", 'Windows'),
  microsoft('Segoe UI Variable', "'Segoe UI Variable Text', 'Segoe UI', sans-serif", 'Windows 11', ['Segoe UI Variable Text']),
  microsoft('Aptos', 'Aptos, sans-serif', 'Office 365'),
  microsoft('Calibri', 'Calibri, sans-serif', 'Windows · Office'),
  microsoft('Arial', 'Arial, sans-serif', 'Windows · macOS'),
  microsoft('Times New Roman', "'Times New Roman', serif", 'Windows · macOS'),
  microsoft('Tahoma', 'Tahoma, sans-serif', 'Windows · macOS'),
  microsoft('Verdana', 'Verdana, sans-serif', 'Windows · macOS'),
  microsoft('Cambria', 'Cambria, serif', 'Windows · Office'),
  microsoft('Aptos Serif', "'Aptos Serif', serif", 'Office 365'),
  microsoft('Candara', 'Candara, sans-serif', 'Windows'),
  microsoft('Corbel', 'Corbel, sans-serif', 'Windows'),
  microsoft('Constantia', 'Constantia, serif', 'Windows'),
  microsoft('Palatino Linotype', "'Palatino Linotype', serif", 'Windows'),
  microsoft('Sitka', "'Sitka Text', serif", 'Windows', ['Sitka Text']),
  microsoft('Consolas', 'Consolas, monospace', 'Windows'),
  microsoft('Cascadia Code', "'Cascadia Code', monospace", 'Windows 11'),
  microsoft('Courier New', "'Courier New', monospace", 'Windows · macOS'),
  /* Font hệ thống của Apple (SF Pro, SF Pro Rounded, New York, SF Mono) không gọi được bằng tên, phải qua từ khoá CSS;
     ui-rounded / ui-serif / ui-monospace hiện chỉ Safari và trình duyệt trên iPhone, iPad hỗ trợ */
  apple('SF Pro', '-apple-system, BlinkMacSystemFont, sans-serif', 'macOS · iOS', ['-apple-system', 'BlinkMacSystemFont']),
  apple('SF Pro Rounded', 'ui-rounded, -apple-system, sans-serif', 'Safari · iOS', ['ui-rounded']),
  apple('New York', 'ui-serif, serif', 'Safari · iOS', ['ui-serif']),
  apple('SF Mono', "ui-monospace, 'SF Mono', monospace", 'Safari · iOS', ['ui-monospace', 'SF Mono']),
  apple('Helvetica Neue', "'Helvetica Neue', sans-serif", 'macOS · iOS'),
  { ...apple('Helvetica', 'Helvetica, sans-serif', 'macOS · iOS'), alias: 'Arial' },
  apple('Lucida Grande', "'Lucida Grande', sans-serif", 'macOS'),
  apple('Baskerville', 'Baskerville, serif', 'macOS · iOS'),
  apple('Cochin', 'Cochin, serif', 'macOS · iOS'),
  apple('American Typewriter', "'American Typewriter', serif", 'macOS · iOS'),
  apple('Chalkboard SE', "'Chalkboard SE', cursive", 'macOS · iOS'),
  apple('Marker Felt', "'Marker Felt', cursive", 'macOS · iOS'),
  apple('Noteworthy', 'Noteworthy, cursive', 'macOS · iOS'),
  apple('Monaco', 'Monaco, monospace', 'macOS'),
]

/* Font Google đã nạp sẵn trong index.html, không cần tải thêm */
const PRELOADED = new Set(['Be Vietnam Pro', 'Inter', 'Lexend', 'Nunito', 'Open Sans', 'Roboto'])

export function findFont(value) {
  return FONT_CATALOG.find(f => f.value === (value || '')) || null
}

/* CSS dùng để hiển thị thử một font trong danh sách */
export function fontPreviewCss(font) {
  return font.value || "'Montserrat', sans-serif"
}

/* Font Microsoft / Apple không tải qua mạng được (bản quyền), chỉ hiện đúng khi máy đã cài sẵn.
   Cách kiểm tra: vẽ cùng một chuỗi bằng font cần kiểm tra (dự phòng là một font chung) và bằng riêng font chung đó;
   độ rộng khác nhau ở bất kỳ font chung nào nghĩa là trình duyệt đã tìm thấy font. */
const PROBE_TEXT = 'mmmmmmmmmmlli WwQ@ĐđẤặỹ 0123456789'
const PROBE_BASES = ['monospace', 'serif', 'sans-serif']
const availability = new Map()
let probeCtx = null

/* Từ khoá CSS (-apple-system, ui-rounded, BlinkMacSystemFont…) phải để nguyên, tên font thường thì đặt trong nháy */
const cssFamily = fam => (/^(-|ui-|system-ui$|BlinkMacSystemFont$)/.test(fam) ? fam : `'${fam}'`)

/* Dấu vân của nét chữ: vẽ chuỗi mẫu rồi gom kênh alpha của các điểm ảnh thành chuỗi */
function glyphPrint(css) {
  const { canvas } = probeCtx
  probeCtx.clearRect(0, 0, canvas.width, canvas.height)
  probeCtx.font = `48px ${css}`
  probeCtx.textBaseline = 'top'
  probeCtx.fillText('RGQ1at', 2, 2)
  const data = probeCtx.getImageData(0, 0, canvas.width, 60).data
  let print = ''
  for (let i = 3; i < data.length; i += 16) print += data[i] > 127 ? '1' : '0'
  return print
}

export function isFontAvailable(font) {
  if (!font || !font.local) return true
  if (availability.has(font.name)) return availability.get(font.name)
  if (!probeCtx) {
    try { probeCtx = document.createElement('canvas').getContext('2d') } catch { /* bỏ qua */ }
    if (!probeCtx) return true
  }
  const width = css => { probeCtx.font = `72px ${css}`; return probeCtx.measureText(PROBE_TEXT).width }
  let found = (font.detect || [font.name]).some(fam =>
    PROBE_BASES.some(base => width(`${cssFamily(fam)}, ${base}`) !== width(base)))
  /* Windows tự đổi tên Helvetica thành Arial, mà hai font cố ý có cùng độ rộng chữ: so thêm hình nét chữ (R, G, 1 khác nhau) */
  if (found && font.alias) found = glyphPrint(`${cssFamily(font.name)}, monospace`) !== glyphPrint(`${font.alias}, monospace`)
  availability.set(font.name, found)
  return found
}

/* Dùng API css (v1) của Google Fonts: tự bỏ qua độ đậm mà font không có, không báo lỗi cả yêu cầu */
function googleCssUrl(names, weights) {
  return 'https://fonts.googleapis.com/css?family=' + names.map(n => n.replace(/ /g, '+') + ':' + weights).join('|') + '&display=swap'
}

function setFontLink(id, href) {
  let link = document.getElementById(id)
  if (!href) { if (link) link.remove(); return }
  if (!link) {
    link = document.createElement('link')
    link.id = id
    link.rel = 'stylesheet'
    document.head.appendChild(link)
  }
  if (link.getAttribute('href') !== href) link.setAttribute('href', href)
}

/* Nạp đủ độ đậm cho font đang dùng làm font của toàn app */
export function loadAppFont(value) {
  const font = findFont(value)
  const needed = font && font.google && !PRELOADED.has(font.name)
  setFontLink('siteflow-app-font', needed ? googleCssUrl([font.name], '400,500,600,700,800') : null)
}

/* Nạp kiểu chữ thường của mọi font Google để hiển thị thử trong danh sách chọn font.
   Trình duyệt chỉ tải file font của những dòng thực sự hiện ra. */
export function loadFontPreviews() {
  setFontLink('siteflow-font-previews', googleCssUrl(FONT_CATALOG.filter(f => f.google && !PRELOADED.has(f.name)).map(f => f.name), '400'))
}
