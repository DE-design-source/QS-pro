/* Danh mục font của SiteFlow (Cài đặt ▸ Giao diện ▸ Font chữ).
   Font Google trong danh sách đều có bộ chữ tiếng Việt và chỉ được tải khi người dùng chọn. */

export const FONT_CATEGORIES = [
  ['all', 'Tất cả'], ['sans', 'Không chân'], ['serif', 'Có chân'], ['display', 'Trang trí'],
  ['hand', 'Viết tay'], ['mono', 'Đơn cách'], ['system', 'Hệ thống'],
]

const FALLBACK = { sans: 'sans-serif', serif: 'serif', display: 'sans-serif', hand: 'cursive', mono: 'monospace' }
const google = (cat, names) => names.map(name => ({ name, cat, google: true, value: `'${name}', ${FALLBACK[cat]}` }))
const system = (name, value) => ({ name, cat: 'system', value })

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
  system('Arial', 'Arial, sans-serif'),
  system('Segoe UI', "'Segoe UI', sans-serif"),
  system('Tahoma', 'Tahoma, sans-serif'),
  system('Verdana', 'Verdana, sans-serif'),
  system('Times New Roman', "'Times New Roman', serif"),
  system('Georgia', 'Georgia, serif'),
  system('Courier New', "'Courier New', monospace"),
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
