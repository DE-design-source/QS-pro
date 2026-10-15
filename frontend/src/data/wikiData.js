/* Dữ liệu trang Wiki — lấy nguyên từ wiki.html (hằng WIKI).
   Bản HTML lưu thân bài dưới dạng chuỗi HTML rồi gán innerHTML; ở đây chuyển
   thành dữ liệu có cấu trúc (danh sách khối) để render bằng JSX, không dùng
   dangerouslySetInnerHTML. Trang Wiki trong HTML chỉ đọc (không có soạn thảo),
   nên không cần xử lý markup do người dùng nhập.

   Khối (block):
     { t:'p', c }                 — đoạn văn
     { t:'h2', id, text }         — tiêu đề mục (dùng cho mục lục)
     { t:'ul' | 'ol', items:[c] } — danh sách
     { t:'table', rows:[[cell]] } — bảng; cell là { th:c } hoặc c (ô td)
     { t:'callout', icon, c }     — hộp ghi chú (.wiki-callout), icon: 'phone' | 'shield' | 'clock'
   Nội dung inline (c): chuỗi, hoặc mảng gồm chuỗi / { b } (strong) / { em } /
     { route, text, style } (liên kết sang trang khác) /
     { page, text, style } (liên kết nội bộ sang trang Wiki khác — data-page-link). */

const PHONE_HOTLINE = [
  { b: 'Hotline IT nội bộ:' }, ' 1900 6868 (nhánh 1) · ',
  { b: 'Hotline Nhân sự:' }, ' 1900 6868 (nhánh 2) · ',
  { b: 'Hotline An toàn lao động:' }, ' 1900 6868 (nhánh 3, trực 24/7)',
]

export const WIKI = {
  intro: {
    cat: 'Sổ tay nhân viên', title: 'Giới thiệu công ty', updated: '12/09/2026', blocks: [
      { t: 'p', c: 'Công ty TNHH Xây dựng SiteFlow hoạt động trong lĩnh vực thi công xây dựng dân dụng & công nghiệp, tổng thầu và quản lý dự án. SiteFlow được xây dựng trên nền tảng số hoá toàn diện quy trình công trường — từ lập tiến độ, chấm công theo địa điểm đến kiểm soát dòng tiền — nhằm giảm sai sót và rút ngắn thời gian ra quyết định cho ban chỉ huy công trình.' },
      { t: 'h2', id: 'h-info', text: 'Thông tin công ty' },
      {
        t: 'table', rows: [
          [{ th: 'Tên công ty' }, 'Công ty TNHH Xây dựng SiteFlow'],
          [{ th: 'Mã số thuế' }, '0312xxxxxx'],
          [{ th: 'Địa chỉ trụ sở' }, '123 Đại lộ Nguyễn Văn Linh, Quận 7, TP.HCM'],
          [{ th: 'Ngày thành lập' }, '15/03/2016'],
          [{ th: 'Lĩnh vực' }, 'Thi công xây dựng, tổng thầu, quản lý dự án'],
          [{ th: 'Người đại diện' }, 'Ông Nguyễn Đức Anh — Tổng Giám đốc'],
        ],
      },
      { t: 'h2', id: 'h-vision', text: 'Tầm nhìn & sứ mệnh' },
      { t: 'p', c: 'Trở thành nhà thầu xây dựng dân dụng hàng đầu khu vực phía Nam, lấy chất lượng công trình và minh bạch tài chính làm nền tảng cho mọi dự án.' },
      { t: 'h2', id: 'h-org', text: 'Cơ cấu tổ chức' },
      {
        t: 'ul', items: [
          'Ban Giám đốc',
          'Ban chỉ huy công trường',
          'Phòng Kỹ thuật & Thiết kế',
          'Phòng Kế toán — Tài chính',
          'Phòng Nhân sự',
          'Phòng Mua hàng & Cung ứng',
        ],
      },
      { t: 'h2', id: 'h-contact', text: 'Liên hệ nội bộ' },
      { t: 'callout', icon: 'phone', c: PHONE_HOTLINE },
    ],
  },
  culture: {
    cat: 'Sổ tay nhân viên', title: 'Văn hoá & giá trị cốt lõi', updated: '02/08/2026', blocks: [
      { t: 'p', c: 'Bốn giá trị cốt lõi định hướng cách SiteFlow làm việc mỗi ngày trên công trường và tại văn phòng.' },
      { t: 'h2', id: 'h-v1', text: 'An toàn là ưu tiên số một' },
      { t: 'p', c: 'Không đánh đổi tiến độ lấy an toàn. Mọi công trường đều có quyền dừng thi công khi phát hiện rủi ro.' },
      { t: 'h2', id: 'h-v2', text: 'Minh bạch số liệu' },
      { t: 'p', c: 'Tiến độ, chấm công và chi phí được ghi nhận đúng thời điểm phát sinh, không xử lý trên giấy sau đó.' },
      { t: 'h2', id: 'h-v3', text: 'Đúng hẹn với khách hàng' },
      { t: 'p', c: 'Cam kết tiến độ bàn giao là cam kết pháp lý, không phải con số ước lượng.' },
    ],
  },
  salary: {
    cat: 'Sổ tay nhân viên', title: 'Chính sách lương thưởng', updated: '01/09/2026', blocks: [
      { t: 'p', c: 'Áp dụng cho toàn thể nhân viên khối văn phòng và cán bộ quản lý công trường, có hiệu lực từ 01/09/2026.' },
      { t: 'h2', id: 'h-pay', text: 'Kỳ trả lương' },
      { t: 'p', c: ['Lương được trả vào ngày ', { b: '05 hàng tháng' }, ' qua chuyển khoản ngân hàng. Nếu trùng ngày nghỉ lễ, lương được trả vào ngày làm việc liền trước.'] },
      { t: 'h2', id: 'h-allow', text: 'Các khoản phụ cấp' },
      {
        t: 'table', rows: [
          [{ th: 'Loại phụ cấp' }, { th: 'Đối tượng' }, { th: 'Mức áp dụng' }],
          ['Phụ cấp công trường xa', 'Nhân sự công trường ngoài nội thành', '500.000đ / tháng'],
          ['Phụ cấp trách nhiệm', 'Chỉ huy trưởng, Trưởng phòng', '1.000.000 – 2.000.000đ / tháng'],
          ['Phụ cấp ăn trưa', 'Toàn thể nhân viên', '730.000đ / tháng'],
          ['Phụ cấp điện thoại', 'Quản lý từ cấp Trưởng phòng', '300.000đ / tháng'],
        ],
      },
      { t: 'h2', id: 'h-bonus', text: 'Thưởng hiệu suất' },
      {
        t: 'ul', items: [
          'Thưởng hoàn thành tiến độ: 1 tháng lương khi dự án bàn giao đúng hoặc sớm hơn mốc cam kết.',
          'Thưởng cuối năm theo kết quả kinh doanh, xét duyệt bởi Ban Giám đốc.',
          'Thưởng sáng kiến cải tiến quy trình thi công / vận hành.',
        ],
      },
    ],
  },
  leave: {
    cat: 'Sổ tay nhân viên', title: 'Chế độ nghỉ phép', updated: '01/09/2026', blocks: [
      { t: 'h2', id: 'h-annual', text: 'Nghỉ phép năm' },
      { t: 'p', c: '12 ngày phép/năm đối với nhân viên chính thức, cộng thêm 1 ngày cho mỗi 5 năm thâm niên. Phép chưa dùng hết được chuyển tối đa sang quý I năm sau.' },
      { t: 'h2', id: 'h-sick', text: 'Nghỉ ốm, thai sản' },
      { t: 'p', c: 'Thực hiện theo quy định của Luật Bảo hiểm xã hội hiện hành; nhân viên nộp giấy chứng nhận nghỉ ốm cho Phòng Nhân sự trong vòng 3 ngày làm việc.' },
      { t: 'h2', id: 'h-holiday', text: 'Nghỉ lễ, Tết' },
      {
        t: 'ul', items: [
          'Tết Dương lịch: 1 ngày',
          'Tết Âm lịch: 5 ngày',
          'Giỗ Tổ Hùng Vương, 30/4, 1/5, Quốc khánh: theo lịch nghỉ chung của Nhà nước',
        ],
      },
      { t: 'h2', id: 'h-request', text: 'Quy trình xin nghỉ' },
      { t: 'p', c: ['Gửi yêu cầu trước tối thiểu 1 ngày làm việc qua mục ', { b: 'Chấm công' }, ' trên SiteFlow hoặc theo mẫu đơn giấy đối với công nhân công trường chưa có tài khoản. Xem chi tiết tại trang ', { em: 'Quy trình chấm công & xin nghỉ' }, '.'] },
    ],
  },
  'labor-rules': {
    cat: 'Nội quy công ty', title: 'Nội quy lao động', updated: '20/07/2026', blocks: [
      { t: 'h2', id: 'h-hours', text: 'Giờ làm việc' },
      { t: 'p', c: 'Khối văn phòng: 08:00 – 17:00, thứ Hai đến thứ Sáu, nghỉ trưa 12:00 – 13:00. Khối công trường: theo ca do Ban chỉ huy công trường quy định, chấm công bắt buộc qua định vị GPS trong bán kính công trường.' },
      { t: 'h2', id: 'h-access', text: 'Quy định ra vào công trường' },
      {
        t: 'ul', items: [
          'Đeo thẻ nhân viên và trang bị bảo hộ lao động đầy đủ khi vào khu vực thi công.',
          'Khách và nhà thầu phụ phải đăng ký với bảo vệ và được giám sát dẫn vào.',
          'Không mang chất kích thích, vũ khí, vật dụng dễ cháy nổ vào công trường.',
        ],
      },
      { t: 'h2', id: 'h-violate', text: 'Các hành vi vi phạm và hình thức xử lý' },
      {
        t: 'table', rows: [
          [{ th: 'Vi phạm' }, { th: 'Hình thức xử lý' }],
          ['Đi trễ, về sớm không phép (dưới 3 lần/tháng)', 'Nhắc nhở bằng văn bản'],
          ['Không mang bảo hộ lao động khi thi công', 'Đình chỉ công việc trong ngày'],
          ['Giả mạo vị trí chấm công', 'Khiển trách, trừ điểm thi đua'],
          ['Vi phạm an toàn nghiêm trọng gây nguy hiểm', 'Xem xét chấm dứt hợp đồng lao động'],
        ],
      },
    ],
  },
  safety: {
    cat: 'Nội quy công ty', title: 'Quy định an toàn lao động', updated: '05/09/2026', blocks: [
      { t: 'callout', icon: 'shield', c: 'An toàn lao động là điều kiện bắt buộc, không phải khuyến nghị. Mọi nhân sự có quyền và trách nhiệm dừng công việc nếu phát hiện nguy cơ mất an toàn.' },
      { t: 'h2', id: 'h-ppe', text: 'Trang bị bảo hộ lao động (PPE) bắt buộc' },
      {
        t: 'ul', items: [
          'Mũ bảo hộ đạt chuẩn khi vào khu vực thi công.',
          'Giày bảo hộ chống đinh, chống trơn trượt.',
          'Dây đai an toàn khi làm việc trên cao từ 2m trở lên.',
          'Kính, khẩu trang, găng tay khi hàn cắt, mài, tiếp xúc hoá chất.',
        ],
      },
      { t: 'h2', id: 'h-pccc', text: 'Quy định PCCC' },
      { t: 'p', c: 'Mỗi công trường bố trí bình chữa cháy tại các tầng đang thi công, sơ đồ thoát hiểm được cập nhật theo tiến độ và diễn tập PCCC tối thiểu 1 lần/quý.' },
      { t: 'h2', id: 'h-incident', text: 'Xử lý sự cố tai nạn lao động' },
      {
        t: 'ol', items: [
          'Sơ cứu tại chỗ, cách ly khu vực nguy hiểm.',
          'Báo ngay cho Giám sát an toàn lao động và Chỉ huy trưởng.',
          'Ghi nhận sự cố trên SiteFlow (mục Chấm công > Sự cố) trong vòng 1 giờ.',
          'Lập biên bản, điều tra nguyên nhân trong vòng 24 giờ.',
        ],
      },
      { t: 'callout', icon: 'phone', c: [{ b: 'Hotline An toàn lao động:' }, ' 1900 6868 (nhánh 3) — trực 24/7.'] },
    ],
  },
  'dress-code': {
    cat: 'Nội quy công ty', title: 'Trang phục & tác phong', updated: '10/06/2026', blocks: [
      { t: 'p', c: 'Nội dung đang được Phòng Nhân sự biên soạn, dự kiến cập nhật trong tháng 10/2026.' },
    ],
  },
  'attendance-process': {
    cat: 'Quy trình làm việc', title: 'Chấm công & xin nghỉ', updated: '15/09/2026', blocks: [
      { t: 'p', c: ['Quy trình áp dụng cho toàn bộ nhân sự công trường và văn phòng sử dụng module ', { b: 'Chấm công' }, ' trên SiteFlow.'] },
      { t: 'h2', id: 'h-checkin', text: 'Chấm công vào / ra' },
      {
        t: 'ol', items: [
          'Mở SiteFlow (web hoặc mobile) > mục Chấm công.',
          'Ứng dụng xác định vị trí GPS và đối chiếu với bán kính công trường (geofence).',
          'Trong bán kính cho phép: chấm công được ghi nhận ngay, chọn công việc đang thi công.',
          ['Ngoài bán kính cho phép: hệ thống gắn cờ "ngoài vùng", gửi yêu cầu duyệt tới giám sát công trường qua mục ', { em: 'Duyệt ngoại vùng' }, '.'],
        ],
      },
      { t: 'h2', id: 'h-leave2', text: 'Xin nghỉ phép' },
      {
        t: 'ol', items: [
          'Gửi yêu cầu nghỉ trước tối thiểu 1 ngày làm việc trên SiteFlow.',
          'Quản lý trực tiếp duyệt hoặc từ chối, có thể trao đổi qua Chat.',
          'Ngày nghỉ được duyệt tự động phản ánh vào bảng công tuần/tháng.',
        ],
      },
      { t: 'callout', icon: 'clock', c: ['Xem hướng dẫn thao tác chi tiết và các trạng thái chấm công tại module ', { route: '/cham-cong', text: 'Chấm công', style: { color: 'inherit', fontWeight: 700 } }, '.'] },
    ],
  },
  'expense-process': {
    cat: 'Quy trình làm việc', title: 'Duyệt chi phí', updated: '28/08/2026', blocks: [
      { t: 'p', c: ['Nội dung đang được Phòng Kế toán biên soạn. Tham khảo tạm thời tại module ', { route: '/tai-chinh', text: 'Tài chính', style: { color: 'var(--wiki)', fontWeight: 700 } }, ' — tab Ngân sách / Hoá đơn.'] },
    ],
  },
  'acceptance-process': {
    cat: 'Quy trình làm việc', title: 'Nghiệm thu công việc', updated: '22/08/2026', blocks: [
      { t: 'p', c: 'Nội dung đang được Phòng Kỹ thuật biên soạn, dự kiến hoàn thiện cùng đợt cập nhật module Tiến độ quý IV/2026.' },
    ],
  },
  'incident-process': {
    cat: 'Quy trình làm việc', title: 'Xử lý sự cố công trường', updated: '22/08/2026', blocks: [
      { t: 'p', c: ['Nội dung đang được biên soạn — tham khảo mục "Xử lý sự cố tai nạn lao động" tại trang ', { page: 'safety', text: 'Quy định an toàn lao động', style: { color: 'var(--wiki)', fontWeight: 700 } }, ' trong lúc chờ cập nhật.'] },
    ],
  },
  'form-leave': { cat: 'Biểu mẫu & tài liệu', title: 'Mẫu đơn xin nghỉ phép', updated: '01/03/2026', isForm: true, fileName: 'Mau_don_xin_nghi_phep.docx', fileSize: '48 KB' },
  'form-acceptance': { cat: 'Biểu mẫu & tài liệu', title: 'Mẫu biên bản nghiệm thu', updated: '14/05/2026', isForm: true, fileName: 'Bien_ban_nghiem_thu.docx', fileSize: '62 KB' },
  'form-advance': { cat: 'Biểu mẫu & tài liệu', title: 'Mẫu đề nghị tạm ứng', updated: '14/05/2026', isForm: true, fileName: 'De_nghi_tam_ung.xlsx', fileSize: '35 KB' },
}

/* Cây Wiki ở cột trái (thứ tự, nhóm và icon giống wiki.html).
   icon: 'book' | 'check' | 'file'; { divider:true } là đường kẻ ngăn giữa các mục. */
export const WIKI_TREE = [
  {
    cat: 'Sổ tay nhân viên', items: [
      { slug: 'intro', icon: 'book' },
      { slug: 'culture', icon: 'book' },
      { slug: 'salary', icon: 'book' },
      { slug: 'leave', icon: 'book' },
    ],
  },
  {
    cat: 'Nội quy công ty', items: [
      { slug: 'labor-rules', icon: 'book' },
      { slug: 'safety', icon: 'book' },
      { slug: 'dress-code', icon: 'book' },
    ],
  },
  {
    cat: 'Quy trình làm việc', items: [
      { slug: 'attendance-process', icon: 'check' },
      { slug: 'expense-process', icon: 'check' },
      { divider: true },
      { slug: 'acceptance-process', icon: 'check' },
      { slug: 'incident-process', icon: 'check' },
    ],
  },
  {
    cat: 'Biểu mẫu & tài liệu', items: [
      { slug: 'form-leave', icon: 'file' },
      { slug: 'form-acceptance', icon: 'file' },
      { slug: 'form-advance', icon: 'file' },
    ],
  },
]

/* ---------- Dezbot (AI_KB trong wiki.html) ---------- */
export const AI_KB = {
  tiendo: 'Dự án "Chung cư Riverside GĐ2" đang hoàn thành 62% khối lượng — đúng tiến độ tổng thể. Hạng mục "Hoàn thiện" có 2 đầu việc đang trễ hạn, cần ưu tiên xử lý trong tuần này.',
  chamcong: 'Hôm nay có 18/21 nhân sự đã chấm công đúng giờ, 2 người chấm công trễ và 1 người xin nghỉ phép. Tỷ lệ chuyên cần tuần này đạt 94%.',
  dongtien: 'Dòng tiền tháng này: Thu về 1.85 tỷ, Chi ra 1.42 tỷ — dương 430 triệu. Có 3 hoá đơn nhà cung cấp sắp đến hạn thanh toán trong 7 ngày tới.',
  khachhang: 'Hiện có 12 khách hàng đang trong giai đoạn đàm phán, 4 khách vừa ký hợp đồng trong tuần này. Cơ hội "Nhà phố Lô B12" có giá trị lớn nhất, đang chờ chốt hợp đồng.',
  tinnhan: 'Bạn có 6 tin nhắn chưa đọc trong Chat, tập trung ở nhóm "Dự án Riverside" và "Ban giám đốc". Muốn mình tóm tắt nội dung chính không?',
  boctach: 'Bóc tách khối lượng mới nhất từ QS ghi nhận tổng giá trị vật tư khoảng 11.93 triệu trên 5 đơn mua hàng, trong đó 2 đơn chưa đặt hàng.',
  quytrinh: 'Quy trình thi công hiện tại gồm 5 bước: Khảo sát → Thiết kế → Xin phép → Thi công → Nghiệm thu. Chi tiết từng bước đã được ghi trong Wiki, mục "Quy trình thi công".',
  default: 'Mình đã tra trong dữ liệu workspace nhưng chưa tìm thấy câu trả lời chính xác cho câu hỏi này — bạn thử hỏi cụ thể hơn về tiến độ, chấm công, dòng tiền, khách hàng, bóc tách hoặc quy trình nhé.',
}

/* Câu hỏi gửi đi khi bấm chip chủ đề */
export const AI_TOPIC_LABELS = {
  tiendo: 'Tiến độ dự án đang thế nào?',
  chamcong: 'Tình hình chấm công hôm nay?',
  dongtien: 'Dòng tiền tháng này ra sao?',
  khachhang: 'Khách hàng nào đang tiềm năng?',
  tinnhan: 'Tôi có tin nhắn nào chưa đọc?',
}

export const AI_SUGGESTIONS = [
  'Quy trình thi công gồm những bước nào?',
  'Tài liệu nào vừa được cập nhật?',
  'Tóm tắt nội quy công ty',
]

export function matchTopic(text) {
  const t = text.toLowerCase()
  const has = (...keys) => keys.some(k => t.indexOf(k) > -1)
  if (has('tiến độ', 'tien do', 'dự án')) return 'tiendo'
  if (has('chấm công', 'nhân công', 'nhân sự', 'nghỉ phép')) return 'chamcong'
  if (has('dòng tiền', 'hoá đơn', 'hóa đơn', 'thu', 'chi')) return 'dongtien'
  if (has('khách hàng', 'hợp đồng')) return 'khachhang'
  if (has('tin nhắn', 'chat')) return 'tinnhan'
  if (has('bóc tách', 'mua hàng', 'vật tư')) return 'boctach'
  if (has('quy trình', 'nội quy', 'tài liệu')) return 'quytrinh'
  return 'default'
}
