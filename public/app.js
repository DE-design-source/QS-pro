/* DECOX QS Pro — logic giao diện mới, nối backend /api/:fn */
'use strict';

/* ===== AUTH token ===== */
function authToken(){ try{ return localStorage.getItem('qs_token')||''; }catch(e){ return ''; } }
function setAuthToken(t){ try{ if(t) localStorage.setItem('qs_token',t); else localStorage.removeItem('qs_token'); }catch(e){} }
function authLogout_(){ setAuthToken(''); try{ localStorage.removeItem('qs_user'); }catch(e){} location.reload(); }

/* ===== API ===== */
function api(fn){
  var args = Array.prototype.slice.call(arguments,1);
  var h={'Content-Type':'application/json'}; var t=authToken(); if(t) h['Authorization']='Bearer '+t;
  // Super admin đang "xem như" 1 công ty -> server lọc dữ liệu theo công ty đó
  if(S._viewAs===undefined){ try{ S._viewAs=localStorage.getItem('qs_viewAs')||''; }catch(e){ S._viewAs=''; } }
  if(S._viewAs) h['x-view-company']=S._viewAs;
  return fetch('/api/'+encodeURIComponent(fn),{method:'POST',headers:h, body:JSON.stringify({args:args})})
    .then(function(r){ return r.json().catch(function(){ return {error:'HTTP '+r.status}; }).then(function(d){ d=d||{}; d._status=r.status; return d; }); })
    .then(function(d){ if(d && d.code==='NOAUTH'){ setAuthToken(''); if(typeof showLogin_==='function') showLogin_('Phiên đã hết, mời đăng nhập lại.'); throw new Error('Chưa đăng nhập'); }
      if(d&&d.error) throw new Error(d.error); return d?d.result:null; });
}
function money(n){ return (Math.round(Number(n)||0)).toLocaleString('vi-VN'); }
function esc(s){ return String(s==null?'':s).replace(/[&<>"]/g,function(m){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[m];}); }
// Ngày tạo -> dd/mm/yyyy (không lệch ngày do múi giờ)
function fmtDate(v){
  if(!v) return '—';
  var s=String(v).trim();
  var m=s.match(/^(\d{4})-(\d{2})-(\d{2})/); if(m) return m[3]+'/'+m[2]+'/'+m[1];
  m=s.match(/^(\d{2})\/(\d{2})\/(\d{4})/); if(m) return s.slice(0,10);
  var d=new Date(s); if(!isNaN(d.getTime())) return ('0'+d.getDate()).slice(-2)+'/'+('0'+(d.getMonth()+1)).slice(-2)+'/'+d.getFullYear();
  return s;
}
function toast(m){ var t=document.getElementById('toast'); t.textContent=m; t.classList.add('on'); clearTimeout(t._t); t._t=setTimeout(function(){t.classList.remove('on');},2200); }

/* ===== STATE ===== */
var S={ projects:[], products:[], cur:null, lines:[], node:'3.2.6.1', selFloor:'', _dragProd:null,
  fWatt:{}, fKelvin:{}, fAngle:{}, fIP:{}, fCRI:{}, fVolt:{}, fBrand:'', fNhom:'', fNhomSet:{}, demucKw:'', cols:{}, _drag:null,
  fsecOpen:(function(){ try{ return JSON.parse(localStorage.getItem('qs_fsec')||'{}')||{}; }catch(e){ return {}; } })(), fsecMore:{}, onlyProject:false,
  _imgMain:'', _imgList:[],
  rowH:(function(){ try{ return JSON.parse(localStorage.getItem('qs_rowh')||'{}')||{}; }catch(e){ return {}; } })() };

/* cây hạng mục (mã, tên, cấp) */
var TREE=[
  ['1','Tư vấn dự án',1],['1.1','Tư vấn quản lý dự án',2],
  ['2','Tư vấn thiết kế',1],['2.1','Tư vấn thiết kế kiến trúc',2],['2.2','Tư vấn thiết kế nội thất',2],
  ['2.3','Tư vấn thiết kế kết cấu',2],['2.4','Tư vấn thiết kế MEP',2],
  ['3','Xây dựng',1],['3.1','Phần thô',2],['3.2','Phần hoàn thiện cơ bản',2],
  ['3.2.1','Thạch cao',3],['3.2.2','Sơn nước',3],['3.2.3','Xây tô',3],['3.2.4','Ốp lát',3],
  ['3.2.5','Thiết bị vệ sinh',3],['3.2.6','Thiết bị điện',3],['3.2.6.1','Thiết bị đèn',4],
  ['3.2.6.2','Công tắc - ổ cắm',4],['3.2.7','Điện lạnh',3],['3.2.8','Cửa',3],
  ['3.2.8.1','Cửa ngoại thất',4],['3.2.8.2','Cửa nội thất',4],
  ['4','Hoàn thiện nội thất',1],['4.1','Nội thất liền tường',2],['4.2','Nội thất rời',2],
  ['4.3','Rèm cửa',2],['4.4','Đồ trang trí',2],['5','Bảo dưỡng',1],['X','Thêm hạng mục',1]
];
function nodeName(code){ for(var i=0;i<TREE.length;i++) if(TREE[i][0]===code) return TREE[i][1]; return code; }

/* cột bảng bóc: key,label,default */
/* Khối cột thương mại (Hình ảnh → Ghi chú) theo file mẫu của Dezon: LUÔN mở sẵn ở
   MỌI hạng mục bóc tách. Người dùng vẫn tắt bớt được bằng chip cột, nhưng mặc định
   là hiện đủ — trước đây một nửa khối này mặc định ẩn nên mỗi hạng mục nhìn một kiểu. */
var COLS=[
  ['stt','STT',1],['khuVuc','Phòng',1],['maBanVe','Mã số bản vẽ',0],['nganh','Dòng sản phẩm',0],
  ['maSP','Mã sản phẩm',0],['ten','Tên sản phẩm',1],['thuongHieu','Thương hiệu',1],['ncc','Nhà cung cấp',0],
  ['moTa','Thông tin chính',1],['kichThuoc','Thông số thiết kế',1],['hinhAnh','Hình ảnh',1],['dvt','Đơn vị tính',1],
  ['soLuong','Số lượng',1],['giaNCC','Giá bán lẻ',1],['chietKhau','Chiết khấu của đại lý (%)',1],
  ['giaDaiLy','Giá đại lý',1],['lnPct','Lợi nhuận dự kiến (%)',1],['donGia','Giá bán',1],
  ['ckKhach','Chiết khấu cho khách hàng (%)',1],['donGiaCK','Đơn giá',1],
  ['markup','Markup (%) — LN/giá vốn',1],['margin','Margin (%) — LN/giá bán',1],['lnVnd','Lợi nhuận (VND)',1],
  ['thanhTien','Thành tiền',1],['trangThai','Trạng thái',1],['ghiChu','Ghi chú',1]
];
COLS.forEach(function(c){ S.cols[c[0]]=!!c[2]; });
// Theo Figma: mở sẵn Công suất/Nhiệt độ/Góc chiếu; thu gọn IP/CRI/Điện áp
['ip','cri','volt'].forEach(function(k){ if(S.fsecOpen[k]===undefined) S.fsecOpen[k]=false; });

/* ===== Bộ icon SVG line đồng nhất (kiểu Lucide, theo màu chữ) ===== */
var ICONS={
  bell:'<path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/>',
  up:'<path d="M12 19V5M5 12l7-7 7 7"/>',
  down:'<path d="M12 5v14M19 12l-7 7-7-7"/>',
  close:'<path d="M18 6L6 18M6 6l12 12"/>',
  left:'<path d="M15 18l-6-6 6-6"/>',
  link:'<path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7"/><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7"/>',
  star:'<path d="M12 2.5l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.4 6.1 20.5l1.2-6.5L2.5 9.4l6.6-.9z"/>',
  heart:'<path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>',
  comment:'<path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/>',
  bookmark:'<path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z"/>',
  power:'<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>',
  temp:'<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M6.3 17.7l-1.4 1.4M19.1 4.9l-1.4 1.4"/>',
  color:'<path d="M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5s-3.5-4-4-6.5c-.5 2.5-2 4.9-4 6.5C6 11.1 5 13 5 15a7 7 0 0 0 7 7z"/>',
  angle:'<circle cx="12" cy="12" r="10"/><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/>',
  tag:'<path d="M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l8.704 8.704a2.426 2.426 0 0 0 3.42 0l6.58-6.58a2.426 2.426 0 0 0 0-3.42z"/><circle cx="7.5" cy="7.5" r="1"/>',
  bulb:'<path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.8 1.3 1.5 1.5 2.5"/><path d="M9 18h6M10 22h4"/>',
  gauge:'<path d="m12 14 4-4"/><path d="M3.34 19a10 10 0 1 1 17.32 0"/>',
  ruler:'<path d="M21.3 15.3a2.4 2.4 0 0 1 0 3.4l-2.6 2.6a2.4 2.4 0 0 1-3.4 0L2.7 8.7a2.41 2.41 0 0 1 0-3.4l2.6-2.6a2.41 2.41 0 0 1 3.4 0Z"/><path d="m14.5 12.5 2-2M11.5 9.5l2-2M8.5 6.5l2-2M17.5 15.5l2-2"/>',
  wrench:'<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>',
  plug:'<path d="M12 22v-5M9 8V2M15 8V2M18 8v5a4 4 0 0 1-4 4h-4a4 4 0 0 1-4-4V8Z"/>',
  money:'<rect width="20" height="12" x="2" y="6" rx="2"/><circle cx="12" cy="12" r="2"/><path d="M6 12h.01M18 12h.01"/>',
  lock:'<rect width="18" height="11" x="3" y="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
  image:'<rect width="18" height="18" x="3" y="3" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.1-3.1a2 2 0 0 0-2.8 0L6 21"/>',
  sliders:'<path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M2 14h4M10 8h4M18 16h4"/>',
  camera:'<path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3z"/><circle cx="12" cy="13" r="3"/>',
  download:'<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>',
  list:'<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
  eye:'<path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>',
  trash:'<path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M10 11v6M14 11v6"/>',
  check:'<path d="M20 6 9 17l-5-5"/>',
  plus:'<path d="M5 12h14M12 5v14"/>',
  search:'<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
  x:'<path d="M18 6 6 18M6 6l12 12"/>',
  building:'<rect width="16" height="20" x="4" y="2" rx="2"/><path d="M9 22v-4h6v4M8 6h.01M16 6h.01M8 10h.01M16 10h.01M8 14h.01M16 14h.01"/>',
  layers:'<path d="M12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83zM2 12l8.6 3.91a2 2 0 0 0 1.65 0L21 12M2 17l8.6 3.91a2 2 0 0 0 1.65 0L21 17"/>',
  doc:'<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7z"/><path d="M14 2v5h5M9 13h6M9 17h4"/>',
  cart:'<circle cx="8" cy="21" r="1"/><circle cx="19" cy="21" r="1"/><path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12"/>',
  home:'<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M9 22V12h6v10"/>',
  pluscircle:'<circle cx="12" cy="12" r="9"/><path d="M12 8.5v7M8.5 12h7"/>',
  copy:'<rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>',
  edit:'<path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
  clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'
};
function icon(name,size){ size=size||16; var p=ICONS[name]; if(!p) return ''; return '<svg class="ico" width="'+size+'" height="'+size+'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+p+'</svg>'; }
// Độ rộng mặc định + cấu hình cột (thứ tự, rộng, lọc) lưu localStorage
var DEFW={stt:66,khuVuc:120,maBanVe:92,nganh:120,maSP:110,ten:190,thuongHieu:110,ncc:120,moTa:186,kichThuoc:150,hinhAnh:104,dvt:84,soLuong:84,giaNCC:104,chietKhau:120,giaDaiLy:104,lnPct:96,donGia:104,ckKhach:130,donGiaCK:104,markup:130,margin:130,lnVnd:120,thanhTien:112,trangThai:104,ghiChu:150};
S.colOrder=null; S.colW={}; S.colFilter={}; S.collapsed={};
// Công cụ kiểu bảng tính cho Bóc tách: sắp xếp / cố định cột / tô màu điều kiện
S.sortKey=''; S.sortDir='asc'; S.freezeN=0; S.cfRules={};
var NUMSORT={stt:1,soLuong:1,giaNCC:1,giaDaiLy:1,donGia:1,donGiaCK:1,lnVnd:1,thanhTien:1,lnPct:1,chietKhau:1,ckKhach:1,markup:1,margin:1};
var FR_FIELDS=['ten','thuongHieu','ncc','moTa','kichThuoc','maSP','khuVuc','maBanVe','ghiChu','trangThai','dvt'];
function cellSortVal_(l,k){ switch(k){
  case 'soLuong': return Number(l.soLuong)||0;
  case 'giaNCC': return Number(l.donGiaVon)||0;
  case 'giaDaiLy': return Number(typeof giaDaiLy_==='function'?giaDaiLy_(l):0)||0;
  case 'donGia': return Number(l.donGiaBan)||0;
  case 'thanhTien': return Number(l.thanhTienBan)||0;
  case 'lnVnd': return Number(l.lnVnd)||0;
  case 'lnPct': return Number(l.lnPct)||0;
  case 'chietKhau': return Number(l.chietKhau)||0;
  case 'ckKhach': return Number(l.ckKhach)||0;
  default: return colPlain(l,k); } }
function sortLines_(arr){ if(!S.sortKey) return arr; var k=S.sortKey, dir=S.sortDir==='desc'?-1:1;
  return arr.slice().sort(function(a,b){ var va=cellSortVal_(a,k), vb=cellSortVal_(b,k);
    if(NUMSORT[k]) return ((Number(va)||0)-(Number(vb)||0))*dir;
    return String(va).localeCompare(String(vb),'vi',{numeric:true})*dir; }); }
function toggleSort(k){ if(S.sortKey!==k){ S.sortKey=k; S.sortDir='asc'; } else if(S.sortDir==='asc'){ S.sortDir='desc'; } else { S.sortKey=''; S.sortDir='asc'; } renderTable(); }
function colSort(k,dir){ S.sortKey=k; S.sortDir=dir; closePop(); renderTable(); }
function colFreezeTo(k){ var cols=visCols(); var i=cols.map(function(c){return c[0];}).indexOf(k); S.freezeN=i+1; closePop(); renderTable(); }
function colUnfreeze(){ S.freezeN=0; closePop(); renderTable(); }
function resetSort(){ S.sortKey=''; renderTable(); }
function cfClass_(l){ var r=S.cfRules||{}, c='';
  var sl=Number(l.soLuong)||0, ban=Number(l.donGiaBan)||0, dl=Number(typeof giaDaiLy_==='function'?giaDaiLy_(l):0)||0;
  if(r.ln0 && (ban-dl)*sl<0) c+=' cf-red';
  if(r.noPrice && !ban) c+=' cf-yellow';
  if(r.sl0 && !sl) c+=' cf-grey';
  return c; }
function cfToggle(rule){ S.cfRules=S.cfRules||{}; if(S.cfRules[rule]) delete S.cfRules[rule]; else S.cfRules[rule]=1; closePop(); renderTable(); }
// Chuột phải trên bảng — menu kiểu Excel (ô / dòng / cột / tô màu / tìm kiếm)
function tkCtx(e){
  var th=e.target.closest('th.thk'); var td=e.target.closest('td'); var tr=e.target.closest('tr.drow');
  var key = th?th.getAttribute('data-k') : (td && tr ? colKeyOfCell_(td) : '');
  e.preventDefault(); closePop();
  var inp = td?td.querySelector('input,textarea'):null;
  S._ctxCell = (td&&tr&&key) ? {lineId:tr.getAttribute('data-id'), key:key,
    text: inp ? String(inp.value||'') : String(td.textContent||'').trim()} : null;
  var r=S.cfRules||{};
  var pop=document.createElement('div'); pop.className='fltpop ctxmenu'; pop.id='qs_pop';
  function mi(ic,label,fn,hint,cls){
    return '<div class="cmi '+(cls||'')+'" onclick="'+fn+'">'+icon(ic,14)+'<span>'+label+'</span>'
      +(hint?'<i class="cmi-k">'+hint+'</i>':'')+'</div>';
  }
  function sec(t){ return '<div class="cmh">'+esc(t)+'</div>'; }
  var html='';
  if(S._ctxCell){
    html+=sec('Ô đang chọn')
      +mi('copy','Sao chép ô','ctxCopyCell()','Ctrl+C')
      +mi('copy','Sao chép cả dòng','ctxCopyRow()')
      +mi('edit','Dán vào ô','ctxPasteCell()','Ctrl+V')
      +mi('trash','Xoá nội dung ô','ctxClearCell()','Del')
      +'<div class="cmsep"></div>';
  }
  if(tr){ var lineId=tr.getAttribute('data-id');
    html+=sec('Dòng')
      +mi('check','Chọn dòng này','closePop();tkSelClick_(null,\''+lineId+'\')')
      +mi('list','Chọn tất cả dòng đang hiện','closePop();tkSelAllVisible_()')
      +mi('copy','Nhân bản dòng','ctxDupRow(\''+lineId+'\')')
      +mi('plus','Chèn dòng trống bên dưới','ctxInsertRow(\''+lineId+'\')')
      +mi('trash','Xoá dòng này','closePop();delLine(\''+lineId+'\')','','danger')
      +'<div class="cmsep"></div>';
  }
  if(key){ var col=(COLS.filter(function(c){return c[0]===key;})[0]||[key,key]); var lbl=col[1];
    var isNum=['soLuong','giaNCC','giaDaiLy','donGia','donGiaCK','thanhTien','lnVnd','chietKhau','lnPct','ckKhach','donGiaBan','thanhTienBan','thanhTienVon'].indexOf(key)>=0;
    html+=sec('Cột: '+esc(lbl))
      +mi('up','Sắp xếp tăng dần','colSort(\''+key+'\',\'asc\')')
      +mi('down','Sắp xếp giảm dần','colSort(\''+key+'\',\'desc\')')
      +(S.sortKey?mi('close','Bỏ sắp xếp','resetSort();closePop()'):'')
      +(S._ctxCell?mi('down','Điền giá trị ô này xuống cả cột','ctxFillDown()'):'')
      +(isNum?mi('gauge','Tính tổng cột','ctxSumCol(\''+key+'\')'):'')
      +mi('lock','Cố định đến cột này','colFreezeTo(\''+key+'\')')
      +((S.freezeN||0)>0?mi('close','Bỏ cố định cột','colUnfreeze()'):'')
      +(tr?mi('lock','Cố định đến hàng này','tkFreezeRowTo(\''+tr.getAttribute('data-id')+'\')'):'')
      +((S.frzRows||0)>0?mi('close','Bỏ cố định hàng','tkUnfreezeRows()'):'')
      +mi('eye','Ẩn cột này','ctxHideCol(\''+key+'\')')
      +mi('list','Hiện lại tất cả cột','ctxShowAllCols()')
      +'<div class="cmsep"></div>';
  }
  html+=sec('Tô màu điều kiện')
    +'<div class="cmi cmck'+(r.ln0?' on':'')+'" onclick="cfToggle(\'ln0\')"><span class="bx">'+(r.ln0?'✓':'')+'</span><span class="cfdot cf-red"></span><span>Lợi nhuận &lt; 0</span></div>'
    +'<div class="cmi cmck'+(r.noPrice?' on':'')+'" onclick="cfToggle(\'noPrice\')"><span class="bx">'+(r.noPrice?'✓':'')+'</span><span class="cfdot cf-yellow"></span><span>Chưa có giá bán</span></div>'
    +'<div class="cmi cmck'+(r.sl0?' on':'')+'" onclick="cfToggle(\'sl0\')"><span class="bx">'+(r.sl0?'✓':'')+'</span><span class="cfdot cf-grey"></span><span>Số lượng = 0</span></div>'
    +'<div class="cmsep"></div>'
    +mi('search','Tìm & thay thế','closePop();openFindReplace()','Ctrl+F')
    +mi('download','Xuất bảng ra Excel','closePop();showTab(\'export\')');
  pop.innerHTML=html; document.body.appendChild(pop);
  var L=Math.min(e.clientX, window.innerWidth-pop.offsetWidth-12), T=Math.min(e.clientY, window.innerHeight-pop.offsetHeight-12);
  pop.style.left=Math.max(8,L)+'px'; pop.style.top=Math.max(8,T)+'px';
  setTimeout(function(){ document.addEventListener('mousedown',popOutside); },0);
}
/* ===== Thao tác kiểu Excel trên bảng ===== */
function ctxCopy_(txt){
  try{ if(navigator.clipboard&&navigator.clipboard.writeText){ navigator.clipboard.writeText(txt); return; } }catch(e){}
  var t=document.createElement('textarea'); t.value=txt; t.style.position='fixed'; t.style.opacity='0';
  document.body.appendChild(t); t.select(); try{ document.execCommand('copy'); }catch(x){} t.remove();
}
function ctxCopyCell(){ var c=S._ctxCell; closePop(); if(!c) return;
  ctxCopy_(String(c.text||'')); toast('Đã sao chép: '+String(c.text||'').slice(0,40)); }
function ctxCopyRow(){ var c=S._ctxCell; closePop(); if(!c) return;
  var l=S.lines.filter(function(x){return x.lineId===c.lineId;})[0]; if(!l) return;
  var vals=visCols().map(function(col){ var v=l[col[0]]; return v==null?'':String(v); });
  ctxCopy_(vals.join('\t')); toast('Đã sao chép cả dòng — dán được thẳng vào Excel'); }
async function ctxPasteCell(){ var c=S._ctxCell; closePop(); if(!c||!c.key) return;
  var txt='';
  try{ txt=await navigator.clipboard.readText(); }
  catch(e){ toast('Trình duyệt chặn đọc clipboard — bấm vào ô rồi nhấn Ctrl+V'); return; }
  if(!txt) return; var d={}; d[c.key]=String(txt).split('\t')[0].split('\n')[0].trim();
  editLine(c.lineId,d); toast('Đã dán vào ô'); }
function ctxClearCell(){ var c=S._ctxCell; closePop(); if(!c||!c.key) return;
  var d={}; d[c.key]=''; editLine(c.lineId,d); toast('Đã xoá nội dung ô'); }
async function ctxDupRow(lineId){ closePop();
  var l=S.lines.filter(function(x){return x.lineId===lineId;})[0]; if(!l||!S.cur) return;
  var prod=Object.assign({},l); delete prod.lineId; delete prod.recordId;
  try{ var nl=await api('addLine', S.cur.maDA, prod, Number(l.soLuong)||1);
    S.lines.push(nl); renderTable(); renderCard(); renderActGutter&&renderActGutter(); toast('Đã nhân bản dòng'); }
  catch(e){ toast('Lỗi nhân bản: '+e.message); } }
async function ctxInsertRow(lineId){ closePop();
  if(!S.cur) return;
  var l=S.lines.filter(function(x){return x.lineId===lineId;})[0];
  try{ var nl=await api('addBlankLine', S.cur.maDA, S.node, l?(l.tang||''):'');
    S.lines.push(nl); renderTable(); renderCard(); renderActGutter&&renderActGutter(); toast('Đã chèn dòng trống'); }
  catch(e){ toast('Lỗi chèn dòng: '+e.message); } }
function ctxFillDown(){ var c=S._ctxCell; closePop(); if(!c||!c.key) return;
  var rows=S.lines.filter(function(l){ return l.nhom===S.node && l.lineId!==c.lineId; });
  if(!rows.length){ toast('Không có dòng nào khác trong hạng mục này'); return; }
  if(!confirm('Điền "'+String(c.text||'').slice(0,30)+'" cho '+rows.length+' dòng còn lại trong cột này?')) return;
  rows.forEach(function(l){ var d={}; d[c.key]=c.text; editLine(l.lineId,d); });
  toast('Đã điền xuống '+rows.length+' dòng'); }
function ctxSumCol(key){ closePop();
  var rows=S.lines.filter(function(l){ return l.nhom===S.node; });
  var sum=rows.reduce(function(a,l){ return a+(Number(l[key])||0); },0);
  var lbl=(COLS.filter(function(c){return c[0]===key;})[0]||[key,key])[1];
  toast('Tổng cột "'+lbl+'" ('+rows.length+' dòng): '+money(sum)); }
function ctxHideCol(key){ closePop();
  if(key==='ten'){ toast('Không thể ẩn cột Tên sản phẩm'); return; }
  S.cols=S.cols||{}; S.cols[key]=false; renderColChips&&renderColChips(); renderTable();
  var lbl=(COLS.filter(function(c){return c[0]===key;})[0]||[key,key])[1];
  toast('Đã ẩn cột "'+lbl+'" — bật lại ở hàng chip phía trên'); }
function ctxShowAllCols(){ closePop(); S.cols=S.cols||{};
  COLS.forEach(function(c){ S.cols[c[0]]=true; });
  renderColChips&&renderColChips(); renderTable(); toast('Đã hiện lại tất cả cột'); }
function colKeyOfCell_(td){ var tr=td.parentNode; var idx=[].indexOf.call(tr.children,td); var cols=visCols(); return cols[idx]?cols[idx][0]:''; }
// ---- Tìm & thay thế ----
function openFindReplace(){ var ex=document.getElementById('frPanel'); if(ex){ ex.remove(); return; }
  var p=document.createElement('div'); p.id='frPanel'; p.className='fr-panel';
  p.innerHTML='<div class="fr-row"><input id="frFind" placeholder="Tìm…" oninput="frFind()"><span class="fr-cnt" id="frCnt"></span></div>'
    +'<div class="fr-row"><input id="frRep" placeholder="Thay bằng…"><button class="btn blue xs" onclick="frReplaceAll()">Thay tất cả</button></div>'
    +'<div class="fr-row" style="justify-content:flex-end"><button class="btn ghost xs" onclick="frClose()">Đóng</button></div>';
  document.body.appendChild(p);
  var w=document.querySelector('#v-boc .tbl-wrap')||document.body; var r=w.getBoundingClientRect();
  p.style.right='24px'; p.style.top=(Math.max(90,r.top)+8)+'px';
  document.getElementById('frFind').focus();
}
// Phím tắt kiểu Excel: Ctrl/Cmd + F (tìm) và + H (thay) khi đang ở Bóc tách
document.addEventListener('keydown',function(e){
  if(!(e.ctrlKey||e.metaKey)) return;
  var k=(e.key||'').toLowerCase(); if(k!=='f'&&k!=='h') return;
  if(!bocVisible_()) return;
  e.preventDefault();
  if(!document.getElementById('frPanel')) openFindReplace();
  var f=document.getElementById('frFind'); if(f) f.focus();
});
function bocVisible_(){ var v=document.getElementById('v-boc'); return v && v.classList.contains('on'); }
function frClose(){ var p=document.getElementById('frPanel'); if(p)p.remove(); frClearHits_(); }
/* Đang đứng ở bảng nào thì Tìm & thay thế chạy cho bảng đó (Bóc tách hay Phần thô) */
function frPT_(){ var w=document.getElementById('ptWrap'); return !!(w && w.style.display!=='none' && w.querySelector('tr.pt-row')); }
function frClearHits_(){ document.querySelectorAll('#tkTable .fr-hit,#ptWrap .fr-hit').forEach(function(e){ e.classList.remove('fr-hit','fr-hit-cur'); }); }
function frFind(){ frClearHits_(); var q=(document.getElementById('frFind')||{}).value||''; var cnt=document.getElementById('frCnt');
  if(!q){ if(cnt)cnt.textContent=''; return; }
  var ql=q.toLowerCase(), hits=[];
  var sel=frPT_()?'#ptWrap tr.pt-row td':'#tkTable tr.drow td';
  document.querySelectorAll(sel).forEach(function(td){
    var inp=td.querySelector('input,textarea');
    var txt=inp?String(inp.value||''):String(td.textContent||'');
    if(txt.toLowerCase().indexOf(ql)>=0){ td.classList.add('fr-hit'); hits.push(td); } });
  if(cnt) cnt.textContent=hits.length?('★ '+hits.length):'0';
  if(hits.length){ hits[0].classList.add('fr-hit-cur'); hits[0].scrollIntoView({block:'center'}); } }
function frReplaceAll(){ var q=(document.getElementById('frFind')||{}).value||''; var rep=(document.getElementById('frRep')||{}).value||'';
  if(!q){ toast('Nhập từ cần tìm'); return; }
  if(frPT_()){                                   // bảng Phần thô: thay ở các ô chữ (nội dung / ĐVT / ghi chú)
    var m=0;
    (S.phanTho||[]).forEach(function(sec,si){ (sec.items||[]).forEach(function(it,ii){
      var doi=false;
      ['n','dvt','gc'].forEach(function(f){
        var v=String(it[f]==null?'':it[f]);
        if(v.indexOf(q)>=0){ ptEdit(si,ii,f, v.split(q).join(rep)); doi=true; } });
      if(doi) m++; }); });
    toast(m?('Đã thay ở '+m+' dòng'):'Không tìm thấy “'+q+'”'); setTimeout(frFind,60); return;
  }
  var code=S.node, lines=S.lines.filter(function(l){ return l.nhom===code || String(l.nhom||'').indexOf(code+'.')===0; });
  var n=0; lines.forEach(function(l){ var patch={}; FR_FIELDS.forEach(function(f){ var v=String(l[f]==null?'':l[f]); if(v.indexOf(q)>=0) patch[f]=v.split(q).join(rep); });
    if(Object.keys(patch).length){ editLine(l.lineId,patch); n++; } });
  toast(n?('Đã thay ở '+n+' dòng'):'Không tìm thấy “'+q+'”'); setTimeout(frFind,60); }
function initCols(){ var d={}; try{ d=JSON.parse(localStorage.getItem('qs_colcfg')||'{}'); }catch(e){}
  var keys=COLS.map(function(c){return c[0];});
  S.colOrder=(d.order&&d.order.filter(function(k){return keys.indexOf(k)>=0;}))||keys.slice();
  keys.forEach(function(k){ if(S.colOrder.indexOf(k)<0) S.colOrder.push(k); });
  S.colW=d.w||{}; }
function saveCols(){ try{ localStorage.setItem('qs_colcfg',JSON.stringify({order:S.colOrder,w:S.colW})); }catch(e){} }
function colW(k){ return S.colW[k]||DEFW[k]||110; }
function colPlain(l,key){
  if(key==='nganh') return (l.extra&&l.extra.nganh)||'';
  var m={khuVuc:'khuVuc',maBanVe:'maBanVe',maSP:'maSP',ten:'ten',thuongHieu:'thuongHieu',ncc:'ncc',moTa:'moTa',kichThuoc:'kichThuoc',dvt:'dvt',trangThai:'trangThai',ghiChu:'ghiChu'};
  if(m[key]) return String(l[m[key]]||'');
  if(key==='soLuong') return String(l.soLuong||0);
  if(key==='giaNCC') return String(l.donGiaVon||0);
  if(key==='donGia') return String(l.donGiaBan||0);
  if(key==='lnPct') return String(l.lnPct||0);
  return '';
}

var WATTS=['3W','5W','7W','9W','11W','12W','15W','17W','20W','25W'];
var KELVINS=[['2700K','#f0a500'],['3000K','#f08a00'],['4000K','#f2c200'],['5000K','#3b82f6']];
var ANGLES=['8°','12°','20°','22°','30°','38°','40°','50°','60°','12x60°','40x70°','30x60°','20x60°','35x70°','50x70°','50x80°','30x70°','50° Asymmetrical','10x30°'];

/* ===== BOOT ===== */
async function boot(){
  try{
    var b=await api('bootstrap', S.cur?S.cur.maDA:null);
    S.projects=b.projects||[]; S.products=b.products||[];
    if(!S.cur && S.projects.length) S.cur=S.projects[0];
    if(S.cur){ var f=S.projects.filter(function(p){return p.maDA===S.cur.maDA;})[0]; if(f) S.cur=f; }
    S.lines = S.cur ? (await api('getLines',S.cur.maDA)||[]) : [];
    renderAll(); bocBoot_(); hmInit_(); sideApply_();      // hạng mục dùng chung: khôi phục lựa chọn lần trước
    ctLoad_(true).then(function(){ if(S.node==='3.1'||spPTMode_()) ctReload_(); });
  }catch(e){ toast('Lỗi tải: '+e.message); }
}
function bocBoot_(){ try{
  dragSelInit_();
  try{ S.sheet=localStorage.getItem('qs_sheet')||''; }catch(e){ S.sheet=''; }
  rngInit_(); tkZenApply_();
}catch(e){} }
function renderAll(){
  // Ô "Lọc theo đề mục" bên trái phải khớp với đề mục ĐANG BÓC ở bảng phải.
  // Trước đây chỉ đồng bộ khi bấm chọn ở cây; mở lại trang là hai bên lệch nhau.
  if(S.node && S.node!=='X' && S.demucCode!==S.node){ S.demucCode=S.node; S.demucKw=nodeName(S.node)||''; }
  renderProjSel(); renderCard(); renderFilters(); renderCatalog(); renderTree(); renderColChips(); renderFloors(); renderTable();
  updateDemucBox_&&updateDemucBox_();
}

/* ===== TẦNG (floors) ===== */
function floorsList(){
  var set=[], seen={};
  var custom=(S.cur&&S.cur.tangTuTao)?String(S.cur.tangTuTao).split('|'):[];
  custom.forEach(function(t){ t=t.trim(); if(t&&!seen[t]){seen[t]=1;set.push(t);} });
  S.lines.forEach(function(l){ var t=(l.tang||'').trim(); if(t&&!seen[t]){seen[t]=1;set.push(t);} });
  if(S.lines.some(function(l){ return !(l.tang||'').trim(); }) && !seen['CHƯA PHÂN TẦNG']) set.push('CHƯA PHÂN TẦNG');
  return set;
}
function renderFloors(){
  var fl=floorsList();
  if((!S.selFloor || fl.indexOf(S.selFloor)<0)) S.selFloor = fl[0] || '';
  var hint=document.getElementById('floorHint'); if(!hint) return;
  if(!fl.length){ hint.innerHTML='Chưa có tầng. Bấm <b>＋ Thêm tầng</b> ở cuối bảng để tạo tầng.'; return; }
  hint.innerHTML='Đang thêm vào tầng: <b>'+esc(S.selFloor||'—')+'</b> · bấm tên tầng để đổi · hoặc <b>kéo sản phẩm</b> từ danh mục thả vào tầng.';
}
function selectFloor(g){ S.selFloor = g||''; renderFloors(); renderTable(); }
var FLOOR_PRESETS=['TẦNG HẦM','TẦNG LỬNG','TẦNG TRỆT','TẦNG 1','TẦNG 2','TẦNG 3','TẦNG 4','TẦNG 5','SÂN THƯỢNG','TẦNG MÁI','TUM THANG'];
var ROOM_PRESETS=['PHÒNG KHÁCH','PHÒNG BẾP','PHÒNG ĂN','PHÒNG NGỦ MASTER','PHÒNG NGỦ 1','PHÒNG NGỦ 2','PHÒNG NGỦ 3',
  'PHÒNG VỆ SINH','WC CHUNG','WC MASTER','PHÒNG LÀM VIỆC','PHÒNG THỜ','SẢNH','HÀNH LANG','CẦU THANG',
  'BAN CÔNG','PHÒNG GIẶT','KHO','PHÒNG ĐỂ XE','SÂN VƯỜN'];
function aflMode_(){ return S._aflMode==='phong'?'phong':'tang'; }
function aflSetMode(m){ S._aflMode=m; refreshAddFloorPop_(); }
function addFloorPopInner_(){
  var mode=aflMode_(), phong=(mode==='phong');
  var existing=floorsList().filter(function(f){return f!=='CHƯA PHÂN TẦNG';});
  var presets=phong?ROOM_PRESETS:FLOOR_PRESETS;
  var chips=presets.map(function(nm){ var on=existing.indexOf(nm)>=0;
    return '<span class="afl-chip'+(on?' on':'')+'" onclick="addFloorName(this.dataset.n)" data-n="'+esc(nm)+'">'+icon(on?'check':'plus',13)+esc(nm)+'</span>'; }).join('');
  return '<div class="afl-seg">'
      +'<button class="'+(phong?'':'on')+'" onclick="aflSetMode(\'tang\')">'+icon('layers',14)+' Thêm tầng</button>'
      +'<button class="'+(phong?'on':'')+'" onclick="aflSetMode(\'phong\')">'+icon('building',14)+' Thêm phòng</button>'
    +'</div>'
    +'<div class="afl-chips'+(phong?' room':'')+'">'+chips+'</div>'
    +'<div class="afl-cust"><input id="aflInput" placeholder="'+(phong?'Tên phòng khác…':'Tên tầng khác…')+'" autocomplete="off" onkeydown="if(event.key===\'Enter\'){event.preventDefault();addFloorCustom();}"><button class="btn blue sm" onclick="addFloorCustom()">'+icon('plus',14)+'Thêm</button></div>'
    +'<div class="afl-hint">Bấm chip để thêm nhanh · thêm được nhiều '+(phong?'phòng':'tầng')+' liên tiếp. '
      +(phong?'Phòng cũng là một khối trong bảng — kéo dòng vào như tầng.':'')+'</div>';
}
function openAddFloor(e){
  if(!S.cur){ toast('Chưa chọn dự án'); return; }
  if(e) e.stopPropagation();
  closePop();
  var pop=document.createElement('div'); pop.className='fltpop addfloor-pop'; pop.id='qs_pop'; pop.style.width='320px'; pop.style.visibility='hidden';
  pop.innerHTML=addFloorPopInner_();
  document.body.appendChild(pop);
  var r=e.currentTarget.getBoundingClientRect(), h=pop.offsetHeight;
  var top=r.top-h-8; if(top<8) top=r.bottom+8;                 // ưu tiên hiện phía trên nút
  pop.style.left=Math.max(8,Math.min(r.left, window.innerWidth-330))+'px';
  pop.style.top=top+'px'; pop.style.visibility='';
  setTimeout(function(){ document.addEventListener('mousedown',popOutside); var i=document.getElementById('aflInput'); if(i)i.focus(); },0);
}
function addFloorCustom(){ var el=document.getElementById('aflInput'); if(!el) return; var v=el.value.trim(); if(!v) return; el.value=''; addFloorName(v); }
async function addFloorName(name){
  if(!S.cur){ toast('Chưa chọn dự án'); return; }
  name=String(name||'').trim().toUpperCase(); if(!name) return;
  var cur=(S.cur.tangTuTao?String(S.cur.tangTuTao).split('|'):[]).map(function(s){return s.trim();}).filter(Boolean);
  if(cur.indexOf(name)>=0){ S.selFloor=name; renderFloors(); renderTable(); toast('Tầng "'+name+'" đã có — chuyển sang đang thêm'); refreshAddFloorPop_(); return; }
  cur.push(name);
  try{
    var p=await api('updateProject', S.cur.maDA, {tangTuTao:cur.join('|')}); S.cur=p;
    var i=S.projects.findIndex(function(x){return x.maDA===p.maDA;}); if(i>=0)S.projects[i]=p;
    S.selFloor=name; renderFloors(); renderTable(); toast('Đã thêm tầng: '+name);
    refreshAddFloorPop_();
  }catch(e){ toast('Lỗi: '+e.message); }
}
function refreshAddFloorPop_(){ var pop=document.getElementById('qs_pop'); if(pop&&pop.classList.contains('addfloor-pop')){ pop.innerHTML=addFloorPopInner_(); var i=document.getElementById('aflInput'); if(i)i.focus(); } }
// giữ tương thích cũ
function addFloor(){ openAddFloor({stopPropagation:function(){},currentTarget:{getBoundingClientRect:function(){return {top:200,bottom:230,left:200};}}}); }
async function addBlankItem(){ await addItemToFloor(S.selFloor||''); }
async function addItemToFloor(tang){
  if(!S.cur){ toast('Chưa chọn dự án'); return; }
  if(tang==='CHƯA PHÂN TẦNG') tang='';
  try{
    var l=await api('addLine', S.cur.maDA, {ten:'Hạng mục mới', dvt:'Cái', donGiaVon:0, donGiaBan:0,
      nhom:S.node, hangMuc:nodeName(S.node), loai:nodeName(S.node), tang:tang,
      extra:((S.sheet&&tkSheetCo_())?{sheet:S.sheet}:null)}, 1);
    S.lines.push(l); renderTree(); renderFloors(); renderTable();
    focusNewLine(l.lineId);
    toast('Đã thêm hạng mục'+(tang?' vào '+tang:'')+' — sửa ngay trong bảng');
  }catch(e){ toast('Lỗi: '+e.message); }
}
// đưa dòng vừa thêm vào tầm nhìn + focus ô Tên + nhấp nháy cho dễ thấy
function focusNewLine(id){
  setTimeout(function(){
    var tr=document.querySelector('#tkTable tr.drow[data-id="'+id+'"]'); if(!tr) return;
    try{ tr.scrollIntoView({block:'center',behavior:'smooth'}); }catch(e){}
    var inp=tr.querySelector('.td-ten input')||tr.querySelector('input.cin'); if(inp){ inp.focus(); inp.select&&inp.select(); }
    var old=tr.style.background; tr.style.transition='background .4s'; tr.style.background='#fff6c9';
    setTimeout(function(){ tr.style.background=old||''; },1300);
  },70);
}

/* ===== NAV / TABS ===== */
document.getElementById('nav').addEventListener('click',function(e){
  var a=e.target.closest('a[data-tab]'); if(!a) return; e.preventDefault(); showTab(a.getAttribute('data-tab'));
});
document.querySelector('.topnav .right').addEventListener('click',function(e){
  var a=e.target.closest('a[data-tab]'); if(a){ e.preventDefault(); showTab(a.getAttribute('data-tab')); }
});
/* ===== MOBILE: ngăn kéo menu ===== */
function mbToggleNav(force){
  var nav=document.getElementById('nav'), sc=document.getElementById('mbScrim'), bg=document.getElementById('mbBurger');
  if(!nav) return;
  var open = force==null ? !nav.classList.contains('open') : !!force;
  nav.classList.toggle('open',open);
  if(sc) sc.classList.toggle('on',open);
  if(bg) bg.classList.toggle('on',open);
  document.body.style.overflow = open?'hidden':'';
}
function mbIsMobile_(){ return window.innerWidth<=900; }
function showTab(tab){
  if(mbIsMobile_()) mbToggleNav(false);   // chọn tab xong tự đóng menu

  // Chặn tab không được cấp quyền -> chuyển về tab đầu tiên hợp lệ
  if(S.me && !canTab(tab)){ var f=firstAllowedTab_(); if(!f){ toast('Tài khoản chưa được cấp quyền vào phần nào'); return; } if(f!==tab){ tab=f; } }
  document.querySelectorAll('#nav a, .topnav .right a').forEach(function(a){ a.classList.toggle('active',a.getAttribute('data-tab')===tab); });
  ['boc','project','dash','chiphi','export','import','sanpham','muahang','duan','admin','congty'].forEach(function(v){
    var el=document.getElementById('v-'+v); if(el) el.classList.toggle('on',v===tab);
  });
  // Ẩn breadcrumb + banner dự án ở các trang KHÔNG thuộc 1 dự án cụ thể
  var noProj = (tab==='admin' || tab==='sanpham' || tab==='import' || tab==='congty');
  var crumb=document.querySelector('.crumb'); if(crumb) crumb.style.display = noProj?'none':'';
  // Dashboard đã có banner "Đang làm việc" + KPI riêng -> ẩn banner #pcard để khỏi TRÙNG LẶP
  var pcard=document.getElementById('pcard'); if(pcard) pcard.style.display = (noProj||tab==='dash')?'none':'';
  if(tab==='project') renderProjects();
  if(tab==='congty') renderCongTy();
  if(tab==='dash') renderDash();
  if(tab==='chiphi') renderChiphi();
  if(tab==='export') renderExport();
  if(tab==='import') renderImport();
  if(tab==='sanpham') renderSanpham();
  if(tab==='muahang') renderMuahang();
  if(tab==='duan') renderDuAn();
  if(tab==='admin') renderAdmin();
}

/* ===== PROJECT ===== */
// Render lại tab đang mở (dùng sau khi đổi dự án/bản nháp -> UI cập nhật tức thì, không cần bấm lại tab)
function refreshActiveTab_(){
  var on=[].slice.call(document.querySelectorAll('.view')).filter(function(v){ return v.classList.contains('on'); })[0];
  var tab=on?on.id.replace('v-',''):'';
  if(tab==='dash') renderDash();
  else if(tab==='chiphi') renderChiphi();
  else if(tab==='export') renderExport();
  else if(tab==='muahang') renderMuahang();
  else if(tab==='duan') renderDuAn();
  else if(tab==='sanpham'){ renderSpProjPanel_&&renderSpProjPanel_(); }
}
function renderProjSel(){
  var s=document.getElementById('projSel');
  s.innerHTML = S.projects.length ? S.projects.map(function(p){
    return '<option value="'+esc(p.maDA)+'"'+(S.cur&&S.cur.maDA===p.maDA?' selected':'')+'>'+esc(p.ten)+'</option>';
  }).join('') : '<option>— Chưa có dự án —</option>';
  s.onchange=async function(){ S.cur=S.projects.filter(function(p){return p.maDA===s.value;})[0];
    if(!S.cur) return;
    S._coverDA=null;
    try{ S.lines=await api('getLines',S.cur.maDA)||[]; }catch(e){ S.lines=[]; }
    renderAll(); refreshActiveTab_();   // render lại ĐÚNG tab đang mở -> cập nhật tức thì
  };
}
function renderCard(){
  var p=S.cur||{};
  document.getElementById('cbName').textContent=p.ten||'—';
  document.getElementById('cbStatus').textContent=(p.trangThai||'Bản nháp');
  document.getElementById('pcCode').textContent=p.maDA||'—';
  document.getElementById('pcName').textContent=(p.ten||'Chưa chọn dự án');
  document.getElementById('pcKH').textContent=p.khachHang||'—';
  document.getElementById('pcSDT').textContent=p.sdt||'—';
  document.getElementById('pcAddr').textContent=p.diaChi||'—';
  document.getElementById('pcDate').textContent=fmtDate(p.ngayTao);
  document.getElementById('pcStatus').textContent=p.trangThai||'Bản nháp';
  var pct=Math.max(0,Math.min(100,Number(p.tienDo)||0));
  document.getElementById('pcPct').textContent=pct+'%';
  document.getElementById('pcBar').style.width=pct+'%';
  // KPI nhanh về dự án (bản nháp đang mở)
  var kp=document.getElementById('pcKpi');
  if(kp){
    var von=0,ban=0; (S.lines||[]).forEach(function(l){ von+=Number(l.thanhTienVon)||0; ban+=Number(l.thanhTienBan)||0; });
    function kpi(l,v){ return '<div class="pck"><span class="pck-v">'+v+'</span><span class="pck-l">'+l+'</span></div>'; }
    kp.innerHTML = S.cur ? (kpi('Hạng mục',(S.lines||[]).length)+kpi('Tổng giá bán',money(ban)+'đ')+kpi('Lợi nhuận',money(ban-von)+'đ')) : '';
  }
}
function openCreate(){ document.getElementById('mCreate').classList.add('on'); }
function closeCreate(){ document.getElementById('mCreate').classList.remove('on'); }
async function doCreate(){
  var ten=document.getElementById('npTen').value.trim();
  if(!ten){ toast('Nhập tên dự án'); return; }
  try{
    var p=await api('createProject',{ten:ten,khachHang:document.getElementById('npKH').value,
      sdt:document.getElementById('npSDT').value,diaChi:document.getElementById('npAddr').value,
      linkDezon:(function(v){ v=String(v||'').trim(); return v?dezonUrl_(v):''; })((document.getElementById('npLink')||{}).value),
      vat:Number(document.getElementById('npVat').value)||0});
    closeCreate(); S.cur=p; document.getElementById('npTen').value='';
    await boot(); renderDash(); renderProjects(); toast('Đã tạo bản nháp');
  }catch(e){ toast('Lỗi: '+e.message); }
}

/* ===== FILTERS (trái) ===== */
function parseWatt(nm){ var m=/(\d+(?:\.\d+)?)\s*w\b/i.exec(nm||''); return m?m[1]+'W':''; }
function parseKelvin(nm){ var m=/(\d{4})\s*k\b/i.exec(nm||''); return m?m[1]+'K':''; }
// tách chuỗi "3000K, 4000K" -> ['3000K','4000K']
function splitVals(s){ return String(s||'').split(',').map(function(x){return x.trim();}).filter(Boolean); }
// gom các giá trị THẬT (không trùng) của 1 cột spec trên toàn bộ sản phẩm
function distinctSpec(field){ var set={}; (S.products||[]).forEach(function(p){ splitVals(p[field]).forEach(function(v){ set[v]=1; }); }); return Object.keys(set); }
// sắp theo số trong chuỗi (7W<12W, IP20<IP44, 220V<240V)
function cmpNum(a,b){ var na=parseFloat(String(a).replace(/[^0-9.]/g,''))||0, nb=parseFloat(String(b).replace(/[^0-9.]/g,''))||0; return na-nb; }
// màu chấm theo nhiệt độ màu
function ctColor(k){ var n=parseInt(k,10)||0; if(n<=2700)return '#f0a500'; if(n<=3000)return '#f08a00'; if(n<=4000)return '#f2c200'; if(n<=5000)return '#dbe6f0'; return '#3b82f6'; }
// 1 nhóm lọc gập/mở: sinh chip từ giá trị thật, giới hạn số chip hiện + "Xem thêm",
// badge đếm trên tiêu đề, click chip để lọc.
function chipGroup(key, elId, badgeId, field, stateMap, dataAttr, opts){
  opts=opts||{};
  var el=document.getElementById(elId); if(!el) return;
  // bỏ giá trị rỗng kiểu "0K" / "0W" (dữ liệu nhập thiếu) — không phải lựa chọn lọc thật
  var all=distinctSpec(field).filter(function(v){ return !/^0+([.,]0+)?\s*[a-z°]*$/i.test(String(v).trim()); }).sort(cmpNum);
  var selN=all.filter(function(v){return stateMap[v];}).length;
  var badge=document.getElementById(badgeId);
  if(badge) badge.textContent = selN ? ('· '+selN+' đã chọn') : (all.length ? ('· '+all.length) : '');
  var html;
  if(!all.length){ html='<span style="color:#9aa;font-size:12px">—</span>'; }
  else{
    html=all.map(function(v){
      var dot=opts.dot?'<span class="dot" style="background:'+opts.dot(v)+'"></span>':'';
      return '<span class="chip'+(opts.wide?' wide':'')+(stateMap[v]?' on':'')+'" '+dataAttr+'="'+esc(v)+'" title="'+esc(v)+'">'+dot+'<span class="ctx">'+esc(v)+'</span></span>';
    }).join('');
  }
  el.innerHTML=html;
  el.onclick=function(e){
    var c=e.target.closest('['+dataAttr+']'); if(!c)return; var v=c.getAttribute(dataAttr);
    stateMap[v]=!stateMap[v]; renderFilters(); renderCatalog();
  };
}
// gập/mở 1 nhóm lọc (mặc định MỞ; nhớ trạng thái ở localStorage)
/* Ẩn / hiện panel sản phẩm bên trái — ẩn đi thì bảng bóc tách chiếm hết bề ngang */
function sideGet_(){ try{ return localStorage.getItem('qs_sideOff')==='1'; }catch(e){ return false; } }
function sideApply_(){
  var g=document.getElementById('bocGrid'), off=sideGet_(); if(g) g.classList.toggle('nocat', off);
  var b=document.getElementById('sideTog');
  if(b){ b.classList.toggle('on', off); b.title=off?'Hiện panel sản phẩm':'Ẩn panel sản phẩm — bảng rộng hơn'; }
  if(typeof tkHBarSync_==='function') try{ tkHBarSync_(); }catch(e){}
}
function sideToggle_(){ try{ localStorage.setItem('qs_sideOff', sideGet_()?'0':'1'); }catch(e){} sideApply_(); }
function toggleFsec(key){
  if(FSEC_ALWAYS[key]) return;            // Công suất / Nhiệt độ màu luôn mở
  var open=(S.fsecOpen[key]!==false);
  S.fsecOpen[key]=!open;
  try{ localStorage.setItem('qs_fsec', JSON.stringify(S.fsecOpen)); }catch(e){}
  applyFsec();
}
var FSEC_ALWAYS={};      // Công suất / Nhiệt độ màu giờ cũng gập/mở được (nhớ trạng thái) cho panel gọn
function applyFsec(){
  ['watt','kelvin','angle','ip','cri','volt','combo','yeuthich','brand','price'].forEach(function(k){
    var s=document.getElementById('sec_'+k); if(!s) return;
    s.classList.toggle('open', FSEC_ALWAYS[k] ? true : (S.fsecOpen[k]!==false));
    if(FSEC_ALWAYS[k]) s.classList.add('nofold');
  });
}
// Nhóm của SP: dùng field Nhóm, nếu rỗng thì lấy "Danh mục: X" trong mô tả
function prodNhom_(p){ if(p&&p.nhom) return p.nhom; var m=/Danh m[uụ]c\s*[:：]\s*([^\n]+)/i.exec((p&&p.moTa)||''); return m?m[1].trim():''; }
function nhomOptions(){ var s={}; S.products.forEach(function(p){ var n=prodNhom_(p); if(n) s[n]=(s[n]||0)+1; }); return s; }
// Lọc "Hạng mục sản phẩm" -> dùng cột "Hạng mục" của Lark (Đèn nội thất / ngoại thất)
function prodHmuc_(p){ var h=(p&&p.hangMuc)||'';                     // vệ sinh: chuẩn hoá tên ("bồn cầu" = "Bồn cầu")
  return (h && nganhCuaSP_(p)==='vs' && VS_SPEC.chuanHM(h)) || h; }
function hmucOptions(){ var s={}, vs=vsFltOn_();       // đề mục vệ sinh: chỉ liệt kê hạng mục vệ sinh
  S.products.forEach(function(p){ if(vs&&nganhCuaSP_(p)!=='vs') return; var n=prodHmuc_(p); if(n) s[n]=(s[n]||0)+1; }); return s; }
/* ═══ BỘ LỌC THIẾT BỊ VỆ SINH (panel trái tab Bóc tách, đề mục 3.2.5) ═══
   Sinh từ CÙNG bộ thông số với form Nhập & file mẫu (public/vs-spec.js):
     · "Hạng mục" = chip các hạng mục vệ sinh (đồng bộ 2 chiều với ô "Hạng mục sản phẩm")
     · Chọn đúng 1 hạng mục -> hiện các thông số dạng CHỌN của hạng mục đó (VD Bồn cầu: Kiểu lắp đặt,
       Hệ thống xả, Loại nắp…; Sen tắm: Loại sen…); chưa chọn / nhiều hạng mục -> Màu sắc + Kiểu lắp đặt.
     · Giá trị chip = giá trị THẬT có trong dữ liệu, kèm số SP. Trạng thái: S.fVs = {cột DB: {giá trị: 1}}. */
function vsFltOn_(){ return S.node==='3.2.5'; }
function vsFltHM_(){   // hạng mục vệ sinh đang lọc (chỉ khi chọn đúng 1)
  var sel=Object.keys(S.fNhomSet||{}).filter(function(k){ return S.fNhomSet[k]; });
  return sel.length===1?VS_SPEC.chuanHM(sel[0]):'';
}
function vsFltKeys_(){
  var hm=vsFltHM_();
  if(!hm) return ['MÀU SẮC','KIỂU LẮP ĐẶT'];
  return VS_SPEC.labelsOf(hm).filter(function(lb){ return VS_SPEC.METRIC[lb][2]==='sel'; });
}
function vsProds_(){ return (S.products||[]).filter(function(p){ return nganhCuaSP_(p)==='vs'; }); }
function vsFltCount_(){ var n=0, f=S.fVs||{}; Object.keys(f).forEach(function(c){ if(Object.keys(f[c]).some(function(v){ return f[c][v]; })) n++; }); return n; }
function vsFltMatch_(p){
  var f=S.fVs||{};
  return Object.keys(f).every(function(col){
    var want=Object.keys(f[col]).filter(function(v){ return f[col][v]; }); if(!want.length) return true;
    return splitVals((p.raw||{})[col]).some(function(v){ return want.indexOf(v)>=0; });
  });
}
function vsFltClear_(col){ if(S.fVs) delete S.fVs[col]; renderFilters(); renderCatalog(); updateCatUI(); }
function vsFltPick_(el){
  var col=el.getAttribute('data-c'), v=el.getAttribute('data-v');
  if(col==='__hm'){ S.fNhomSet=S.fNhomSet||{}; if(S.fNhomSet[v]) delete S.fNhomSet[v]; else S.fNhomSet[v]=1; }
  else { S.fVs=S.fVs||{}; var o=S.fVs[col]=S.fVs[col]||{}; if(o[v]) delete o[v]; else o[v]=1; }
  renderFilters(); renderCatalog(); updateCatUI();
}
function vsFltFold_(key){ S.fsecOpen['vs_'+key]=(S.fsecOpen['vs_'+key]===false);
  try{ localStorage.setItem('qs_fsec', JSON.stringify(S.fsecOpen)); }catch(e){} renderVsFilters_(); }
function renderVsFilters_(){
  var box=document.getElementById('vsFilters'); if(!box) return;
  // Đổi ngành (đèn <-> vệ sinh): bỏ lọc hạng mục / thông số của ngành cũ, nếu không danh sách trống trơn
  var ng=vsFltOn_()?'vs':'den';
  if(S._fltNg && S._fltNg!==ng){ S.fNhomSet={}; S.fVs={}; S._fltNg=ng; renderFilters(); }
  S._fltNg=ng;
  if(!vsFltOn_()){ box.style.display='none'; box.innerHTML=''; return; }
  box.style.display='';
  S.fVs=S.fVs||{};
  // bỏ lọc của thông số không còn áp dụng cho hạng mục đang chọn
  var keys=vsFltKeys_(), cols=keys.map(function(lb){ return VS_SPEC.METRIC[lb][0]; });
  Object.keys(S.fVs).forEach(function(c){ if(cols.indexOf(c)<0) delete S.fVs[c]; });
  var ps=vsProds_(), hmSel=Object.keys(S.fNhomSet||{}).filter(function(k){ return S.fNhomSet[k]; });
  var trongHM=hmSel.length?ps.filter(function(p){ return hmSel.indexOf(prodHmuc_(p))>=0; }):ps;
  function sec(key, title, chips, n){
    var open=(S.fsecOpen['vs_'+key]!==false);
    return '<div class="fsec'+(open?' open':'')+'"><div class="fsec-h" onclick="vsFltFold_(\''+esc(key)+'\')">'
      +'<span class="fsec-t">'+esc(title)+'</span>'+(n?'<span class="fsec-n">'+n+' đã chọn</span>':'')+'<span class="fsec-c">▾</span></div>'
      +'<div class="chips">'+(chips||'<span style="color:#9aa;font-size:12px">—</span>')+'</div></div>';
  }
  function chip(col,v,cnt,on){ return '<span class="chip'+(on?' on':'')+'" data-c="'+esc(col)+'" data-v="'+esc(v)+'" onclick="vsFltPick_(this)">'
    +esc(v)+'<i>'+cnt+'</i></span>'; }
  // Hạng mục: đếm theo dữ liệu, xếp theo thứ tự khai báo
  var demHM={}; ps.forEach(function(p){ var h=prodHmuc_(p); if(h) demHM[h]=(demHM[h]||0)+1; });
  var hmList=VS_SPEC.HANG_MUC.filter(function(h){ return demHM[h]; })
    .concat(Object.keys(demHM).filter(function(h){ return VS_SPEC.HANG_MUC.indexOf(h)<0; }));
  var html=sec('hm','Hạng mục', hmList.map(function(h){ return chip('__hm',h,demHM[h],!!(S.fNhomSet||{})[h]); }).join(''), hmSel.length);
  keys.forEach(function(lb){
    var col=VS_SPEC.METRIC[lb][0], dem={};
    trongHM.forEach(function(p){ splitVals((p.raw||{})[col]).forEach(function(v){ dem[v]=(dem[v]||0)+1; }); });
    var thuTu=VS_SPEC.optsOf(vsFltHM_(),lb);
    var vals=Object.keys(dem).sort(function(a,b){ var ia=thuTu.indexOf(a), ib=thuTu.indexOf(b);
      return ((ia<0?999:ia)-(ib<0?999:ib)) || a.localeCompare(b,'vi'); });
    if(!vals.length) return;                                    // thông số chưa có dữ liệu -> không hiện khối rỗng
    var o=S.fVs[col]||{};
    html+=sec(col, VS_SPEC.METRIC[lb][1], vals.map(function(v){ return chip(col,v,dem[v],!!o[v]); }).join(''),
      Object.keys(o).filter(function(v){ return o[v]; }).length);
  });
  if(!vsFltHM_()) html+='<div class="fp-note" style="padding:10px 6px 0">Chọn 1 hạng mục để lọc theo thông số riêng của hạng mục đó.</div>';
  box.innerHTML=html;
}
function renderFilters(){
  // nhóm (multi-select)
  var sel=Object.keys(S.fNhomSet||{}).filter(function(k){return S.fNhomSet[k];});
  var fn=document.getElementById('fNhom');
  if(fn){ var lb=fn.querySelector('.mlabel'); if(lb) lb.textContent = sel.length? (sel.length===1?sel[0]:sel.length+' hạng mục đã chọn') : 'Hạng mục sản phẩm'; fn.classList.toggle('active',sel.length>0); }
  // brand
  var br={}; S.products.forEach(function(p){ if(p.thuongHieu) br[p.thuongHieu]=1; });
  var fb=document.getElementById('fBrand');
  fb.innerHTML='<option value="">Tất cả thương hiệu</option>'+Object.keys(br).sort().map(function(n){return '<option>'+esc(n)+'</option>';}).join('');
  fb.value=S.fBrand; fb.onchange=function(){ S.fBrand=fb.value; renderCatalog(); };
  // 6 nhóm lọc: gập/mở từng phần + chỉ hiện một số chip, còn lại "Xem thêm"
  chipGroup('watt','fWatt','nWatt','congSuat',S.fWatt,'data-w',{wide:true});
  chipGroup('kelvin','fKelvin','nKelvin','nhietDo',S.fKelvin,'data-k',{dot:ctColor});
  chipGroup('angle','fAngle','nAngle','gocChieu',S.fAngle,'data-a',{});
  chipGroup('ip','fIP','nIP','capBaoVe',S.fIP,'data-v',{});
  chipGroup('cri','fCRI','nCRI','cri',S.fCRI,'data-v',{});
  favChips_();
  comboChips_();
  applyFsec();
  updateInProj_();
  document.getElementById('fMin').oninput=renderCatalog;
  document.getElementById('fMax').oninput=renderCatalog;
  document.getElementById('fSearch').oninput=renderCatalog;
}
/* ═══ GOM BIẾN THỂ VỀ CẠNH NHAU ═══
   Cùng 1 mã SP nhưng khác công suất / nhiệt độ màu / góc chiếu = các BIẾN THỂ của 1 sản phẩm.
   Trước đây chúng nằm rải rác trong danh sách (VD FL76001 ở dòng 14 rồi lại 21-24) rất khó đối chiếu.
   Cách gom: GIỮ NGUYÊN thứ tự xuất hiện của từng mã (không đảo lộn cả danh sách),
   chỉ kéo các biến thể sau về ngay dưới biến thể đầu tiên, rồi xếp trong nhóm theo W -> K -> góc. */
/* Chip lọc Combo — SP có sản phẩm đi kèm hay đứng riêng (đếm cả 2 chiều liên kết) */
function comboChips_(){
  var box=document.getElementById('fComboChips'); if(!box) return;
  var co=0, khong=0;
  (S.products||[]).forEach(function(p){ if(p.comboN>0) co++; else khong++; });
  var cur=S.fCombo||'';
  box.innerHTML=[['co','Có',co],['khong','Không có',khong]].map(function(x){
    return '<span class="chip'+(cur===x[0]?' on':'')+'" onclick="setComboFilter(\''+x[0]+'\')">'
      +esc(x[1])+'<i class="chip-n">'+x[2]+'</i></span>';
  }).join('');
  var n=document.getElementById('nCombo'); if(n) n.textContent=cur?'1':'';
}
function setComboFilter(v){ S.fCombo=(S.fCombo===v)?'':v; renderFilters(); renderCatalog(); }
/* Chip lọc Yêu thích — nút riêng ngoài header đã bỏ, chuyển vào trong Bộ lọc */
function favChips_(){
  var box=document.getElementById('fFavChips'); if(!box) return;
  var so=(S.products||[]).filter(function(p){ return p.yeuThich; }).length;
  box.innerHTML='<span class="chip'+(S.fFav?' on':'')+'" onclick="catFavToggle()">'
    +'♥ Chỉ sản phẩm yêu thích<i class="chip-n">'+so+'</i></span>';
  var n=document.getElementById('nYeuThich'); if(n) n.textContent=S.fFav?'1':'';
}
/* Khoá gom biến thể: nhóm do người dùng tự đặt (nhom_bt) đứng trước, chưa gom thì theo MÃ SP. */
function spVarKey_(p){ return spNorm_(p.nhomBT||'')||spNorm_(p.ma||'')||spNorm_(p.ten||''); }
function spNum1_(v){ var m=String(v==null?'':v).match(/-?\d+(?:[.,]\d+)?/); return m?parseFloat(m[0].replace(',','.')):-1; }
function spGroupVariants_(list){
  var order=[], bag={};
  list.forEach(function(p){ var k=spVarKey_(p); if(!bag[k]){ bag[k]=[]; order.push(k); } bag[k].push(p); });
  var out=[];
  order.forEach(function(k){
    var g=bag[k];
    if(g.length>1) g.sort(function(x,y){
      return (spNum1_(x.congSuat)-spNum1_(y.congSuat))
          || (spNum1_(x.nhietDo)-spNum1_(y.nhietDo))
          || (spNum1_(x.gocChieu)-spNum1_(y.gocChieu))
          || String(x.mauSac||'').localeCompare(String(y.mauSac||''),'vi');
    });
    out=out.concat(g);
  });
  return out;
}
function filteredProducts(){
  var q=(document.getElementById('fSearch').value||'').toLowerCase();
  var mn=Number(document.getElementById('fMin').value)||0, mx=Number(document.getElementById('fMax').value)||0;
  var watts=Object.keys(S.fWatt).filter(function(k){return S.fWatt[k];});
  var kels=Object.keys(S.fKelvin).filter(function(k){return S.fKelvin[k];});
  var angs=Object.keys(S.fAngle).filter(function(k){return S.fAngle[k];});
  var ips=Object.keys(S.fIP).filter(function(k){return S.fIP[k];});
  var cris=Object.keys(S.fCRI).filter(function(k){return S.fCRI[k];});
  var volts=Object.keys(S.fVolt).filter(function(k){return S.fVolt[k];});
  var hmucSel=Object.keys(S.fNhomSet||{}).filter(function(k){return S.fNhomSet[k];});
  var dk=(S.demucKw||'').toLowerCase().trim();
  var isVS=vsFltOn_();
  var usedKeys=null;
  if(S._inProjKeys){ usedKeys=S._inProjKeys; }                 // đã chọn 1 dự án cụ thể ở "Đèn trong dự án"
  else if(S.onlyProject){ usedKeys={}; (S.lines||[]).forEach(function(l){ var k=String(l.maSP||l.ten||'').toLowerCase().trim(); if(k) usedKeys[k]=1; }); }
  return spGroupVariants_(S.products.filter(function(p){
    if(S.fFav && !p.yeuThich) return false;                    // chỉ hiện SP đã lưu yêu thích
    if(S.fCombo==='co'    && !(p.comboN>0)) return false;      // chỉ SP có sản phẩm đi kèm
    if(S.fCombo==='khong' &&  (p.comboN>0)) return false;      // chỉ SP đứng riêng
    if(hmucSel.length && hmucSel.indexOf(prodHmuc_(p))<0) return false;
    if(usedKeys){ var uk=String(p.ma||p.ten||'').toLowerCase().trim(); if(!usedKeys[uk]) return false; }
    if(S.fBrand && p.thuongHieu!==S.fBrand) return false;
    if(q && (p.ten+' '+p.ma+' '+p.thuongHieu).toLowerCase().indexOf(q)<0) return false;
    if(dk){ var muc=String(p.muc||'').toLowerCase().trim(); if(muc.indexOf(dk)<0) return false; }   // lọc theo cột "Mục" của Lark
    var pr=Number(p.donGiaBan)||0; if(mn&&pr<mn) return false; if(mx&&pr>mx) return false;
    if(isVS) return vsFltMatch_(p);   // đề mục vệ sinh: lọc theo thông số vệ sinh, KHÔNG áp bộ lọc đèn còn sót
    if(watts.length){ var pw=splitVals(p.congSuat); if(!pw.some(function(x){return watts.indexOf(x)>=0;})) return false; }
    if(kels.length){ var pk=splitVals(p.nhietDo); if(!pk.some(function(x){return kels.indexOf(x)>=0;})) return false; }
    if(angs.length){ var pa=splitVals(p.gocChieu); if(!pa.some(function(x){return angs.indexOf(x)>=0;})) return false; }
    if(ips.length){ var pi=splitVals(p.capBaoVe); if(!pi.some(function(x){return ips.indexOf(x)>=0;})) return false; }
    if(cris.length){ var pc=splitVals(p.cri); if(!pc.some(function(x){return cris.indexOf(x)>=0;})) return false; }
    if(volts.length){ var pvv=splitVals(p.dienAp); if(!pvv.some(function(x){return volts.indexOf(x)>=0;})) return false; }
    return true;
  })); 
}
/* multi-select Nhóm */
function openNhomMsel(e){
  e.stopPropagation(); closePop();
  var opts=hmucOptions(); var keys=Object.keys(opts).sort();
  var allOn=keys.length && keys.every(function(k){return S.fNhomSet[k];});
  var pop=document.createElement('div'); pop.className='fltpop'; pop.id='qs_pop'; pop.style.width='300px';
  pop.innerHTML='<div class="fhdr">Chọn hạng mục (nhiều)</div>'
    +'<input class="fsearch" placeholder="Tìm hạng mục…" oninput="filterPop(this.value)">'
    +'<div id="fpItems"><div class="fchk'+(allOn?' on':'')+'" onclick="nhomAll('+(!allOn)+')"><span class="bx">'+(allOn?'✓':'')+'</span><b>Chọn tất cả</b></div>'
    +keys.map(function(k){ var on=!!S.fNhomSet[k]; return '<div class="fchk'+(on?' on':'')+'" data-t="'+esc(k.toLowerCase())+'" data-v="'+esc(k)+'" onclick="nhomToggle(this.dataset.v)"><span class="bx">'+(on?'✓':'')+'</span>'+esc(k)+' <span style="color:#98a6b3">('+opts[k]+')</span></div>'; }).join('')
    +(keys.length?'':'<div class="fi">Chưa có nhóm (SP chưa gán nhóm).</div>')+'</div>';
  document.body.appendChild(pop);
  var r=e.currentTarget.getBoundingClientRect(); pop.style.left=Math.max(8,r.left)+'px'; pop.style.top=(r.bottom+4)+'px';
  setMselIcon('fNhom',true);
  setTimeout(function(){ document.addEventListener('mousedown',popOutside); },0);
}
function nhomToggle(n){ if(S.fNhomSet[n]) delete S.fNhomSet[n]; else S.fNhomSet[n]=1; renderFilters(); renderCatalog();
  var pop=document.getElementById('qs_pop'); if(pop){ var el=pop.querySelector('[data-v="'+CSS.escape(n)+'"]'); if(el){ el.classList.toggle('on'); el.querySelector('.bx').textContent=S.fNhomSet[n]?'✓':''; } } }
function nhomAll(on){ var opts=hmucOptions(); S.fNhomSet={}; if(on) Object.keys(opts).forEach(function(k){S.fNhomSet[k]=1;}); closePop(); renderFilters(); renderCatalog(); }
// Đèn trong dự án: chỉ hiện SP đã dùng trong dự án hiện tại
function toggleOnlyProject(){ S.onlyProject=!S.onlyProject; var b=document.getElementById('fInProj'); if(b) b.classList.toggle('on',S.onlyProject); renderCatalog(); }
/* Bộ chọn thứ 3 "Đèn trong dự án": lọc chỉ SP đã dùng trong dự án hiện tại */
// icon +/− cho các ô chọn (msel): mở dropdown / đang bật -> dấu trừ
var SVG_PLUS='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 8.5v7M8.5 12h7"/></svg>';
var SVG_MINUS='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M8.5 12h7"/></svg>';
function setMselIcon(id,minus){ var el=document.getElementById(id); if(!el)return; var p=el.querySelector('.mplus'); if(p) p.innerHTML=minus?SVG_MINUS:SVG_PLUS; }
// "Đèn trong dự án": mở dropdown chọn 1 dự án -> chỉ hiện SP đã bóc trong dự án đó
function openInProjSel(e){
  if(e){ e.stopPropagation(); } closePop();
  var cur=S._inProjMa||'';
  var pop=document.createElement('div'); pop.className='fltpop'; pop.id='qs_pop'; pop.style.width='300px'; pop.style.maxHeight='60vh';
  pop.innerHTML='<div class="fhdr">'+(vsFltOn_()?'Thiết bị trong dự án':'Đèn trong dự án')+'</div>'
    +'<input class="fsearch" placeholder="Tìm dự án…" oninput="filterPop(this.value)">'
    +'<div id="fpItems"><div class="demuc-opt'+(!cur?' on':'')+'" data-t="tất cả sản phẩm" onclick="pickInProj(\'\')">Tất cả sản phẩm</div>'
    +(S.projects||[]).map(function(p){ return '<div class="demuc-opt'+(cur===p.maDA?' on':'')+'" data-t="'+esc(String(p.ten||'').toLowerCase())+'" onclick="pickInProj(\''+esc(p.maDA)+'\')"><span>'+esc(p.ten||p.maDA)+'</span></div>'; }).join('')
    +((S.projects||[]).length?'':'<div class="fi">Chưa có dự án nào.</div>')+'</div>';
  document.body.appendChild(pop);
  var r=e.currentTarget.getBoundingClientRect(); pop.style.left=Math.max(8,r.left)+'px'; pop.style.top=(r.bottom+4)+'px'; pop.style.width=Math.max(260,r.width)+'px';
  setMselIcon('fInProj',true);
  setTimeout(function(){ document.addEventListener('mousedown',popOutside); },0);
}
async function pickInProj(maDA){
  closePop();
  if(!maDA){ S._inProjMa=''; S._inProjKeys=null; S.onlyProject=false; updateInProj_(); renderCatalog(); return; }
  var lines;
  if(S.cur && S.cur.maDA===maDA){ lines=S.lines||[]; }
  else { try{ lines=await api('getLines',maDA)||[]; }catch(e){ lines=[]; } }
  var keys={}; lines.forEach(function(l){ var k=String(l.maSP||l.ten||'').toLowerCase().trim(); if(k) keys[k]=1; });
  S._inProjMa=maDA; S._inProjKeys=keys; S.onlyProject=true;
  updateInProj_(); renderCatalog();
}
function toggleInProj(){ openInProjSel({stopPropagation:function(){},currentTarget:document.getElementById('fInProj')}); }
function updateInProj_(){
  var box=document.getElementById('fInProj'), lb=document.getElementById('fInProjLabel'); if(!lb) return;
  var name=''; if(S._inProjMa){ var p=(S.projects||[]).filter(function(x){return x.maDA===S._inProjMa;})[0]; name=p?(p.ten||p.maDA):S._inProjMa; }
  lb.textContent = S._inProjMa ? name : (vsFltOn_()?'Thiết bị trong dự án':'Đèn trong dự án');
  if(box) box.classList.toggle('active', !!S._inProjMa);
  setMselIcon('fInProj', !!S._inProjMa);
}
/* lọc danh mục theo đề mục đang chọn ở cây */
function setDemucFilter(code){
  var nm=nodeName(code)||''; S.demucKw = code==='X'?'':nm; S.demucCode = code==='X'?'':code;
  updateDemucBox_();
  renderCatalog();
}
function updateDemucBox_(){
  var lb=document.getElementById('fDemucLabel'), box=document.getElementById('fDemuc');
  if(!lb) return;
  if(S.demucKw){ lb.textContent=(S.demucCode?S.demucCode+'.':'')+S.demucKw; if(box)box.classList.add('active'); }
  else { lb.textContent='Tất cả đề mục'; if(box)box.classList.remove('active'); }
}
function clearDemuc(){ S.demucKw=''; S.demucCode=''; updateDemucBox_(); renderCatalog(); }
/* Dropdown chọn đề mục ở panel trái (dùng cây hạng mục) */
function openDemucSel(e){
  if(e){ e.stopPropagation(); }
  closePop();
  var nodes=TREE.filter(function(t){return t[0]!=='X';}).map(function(t){return {code:t[0],name:t[1],lvl:t[2]};});
  (typeof customGroups==='function'?customGroups():[]).forEach(function(n){ nodes.push({code:n,name:n,lvl:1}); });
  var pop=document.createElement('div'); pop.className='fltpop'; pop.id='qs_pop'; pop.style.width='330px'; pop.style.maxHeight='70vh';
  pop.innerHTML='<div class="fhdr">Chọn đề mục</div>'
    +'<div class="demuc-opt'+(!S.demucCode?' on':'')+'" onclick="pickDemuc(\'X\')">Tất cả đề mục</div>'
    +nodes.map(function(t){ var cnt=(typeof nodeCount==='function')?nodeCount(t.code):0;
      return '<div class="demuc-opt l'+t.lvl+(S.demucCode===t.code?' on':'')+'" onclick="pickDemuc(\''+t.code+'\')"><span>'+esc(t.code+'.'+t.name)+'</span><span class="dc">['+pad2(cnt)+']</span></div>'; }).join('');
  document.body.appendChild(pop);
  var r=e.currentTarget.getBoundingClientRect(); pop.style.left=Math.max(8,r.left)+'px'; pop.style.top=(r.bottom+4)+'px'; pop.style.width=Math.max(300,r.width)+'px';
  setMselIcon('fDemuc',true);
  setTimeout(function(){ document.addEventListener('mousedown',popOutside); },0);
}
function pickDemuc(code){
  closePop();
  if(code==='X'){ clearDemuc(); return; }
  if(typeof pickNode==='function') pickNode(code);   // set S.node + lọc đề mục + đồng bộ cây/bảng
  else setDemucFilter(code);
}
/* Bộ lọc nâng cao: gập/mở + đếm số lọc đang bật */
function toggleAdv(){
  var w=document.getElementById('advFilters'); if(!w) return;
  var open=w.classList.toggle('open');
  var t=document.getElementById('advToggle'); if(t) t.classList.toggle('on',open);
}
function activeFilterCount(){
  var n=vsFltOn_()?vsFltCount_():0;
  if(!vsFltOn_()) ['fWatt','fKelvin','fAngle','fIP','fCRI','fVolt'].forEach(function(k){
    var m=S[k]||{}; if(Object.keys(m).some(function(x){return m[x];})) n++;
  });
  if(S.fBrand) n++;
  var mn=document.getElementById('fMin'), mx=document.getElementById('fMax');
  if((mn&&+mn.value)||(mx&&+mx.value)) n++;
  return n;
}
function updateCatUI(){
  favGoSync_();
  var n=activeFilterCount();
  var b=document.getElementById('advBadge'); if(b){ b.textContent=n||''; b.style.display=n?'inline-flex':'none'; }
  var c=document.getElementById('advClear'); if(c) c.style.display=n?'inline-block':'none';
  catActiveChips_();
}
/* Bộ lọc đang bật hiện thành thẻ ngay dưới ô Đề mục — các khối lọc đã dọn vào nút "Bộ lọc"
   nên phải thấy ngay mình đang lọc theo gì, bấm ✕ là bỏ.                                   */
function catActiveChips_(){
  var box=document.getElementById('catActive'); if(!box) return;
  if(S.node==='3.1'){ box.innerHTML=''; return; }          // Phần thô có bộ lọc riêng
  var out=[];
  function tag(lb,val,fn){ out.push('<span class="fltag" title="'+esc(lb)+'"><i>'+esc(lb)+'</i>'+esc(val)
    +'<b onclick="'+fn+'" title="Bỏ lọc này">✕</b></span>'); }
  function setVals(k){ return Object.keys(S[k]||{}).filter(function(x){ return S[k][x]; }); }
  var nhom=Object.keys(S.fNhomSet||{}).filter(function(k){ return S.fNhomSet[k]; });
  if(nhom.length) tag('Hạng mục', nhom.length>1?(nhom.length+' mục'):nhom[0], 'catClearF_(\'nhom\')');
  if(S._inProjMa) tag('Trong dự án', S._inProjLabel||'đang lọc', 'catClearF_(\'inproj\')');
  if(vsFltOn_()){
    Object.keys(S.fVs||{}).forEach(function(col){ var v=Object.keys(S.fVs[col]).filter(function(x){ return S.fVs[col][x]; });
      var m=VS_SPEC.METRIC[SP_COL2LABEL_[col]];
      if(v.length) tag(m?m[1]:col, v.length>2?(v.length+' giá trị'):v.join(', '), 'vsFltClear_(\''+col+'\')'); });
  } else
  [['fWatt','Công suất'],['fKelvin','Nhiệt độ'],['fAngle','Góc chiếu'],['fCRI','CRI'],['fIP','IP'],['fVolt','Điện áp']]
    .forEach(function(x){ var v=setVals(x[0]); if(v.length) tag(x[1], v.length>2?(v.length+' giá trị'):v.join(', '), 'catClearF_(\''+x[0]+'\')'); });
  if(S.fBrand) tag('Thương hiệu', S.fBrand, 'catClearF_(\'brand\')');
  if(S.fFav) tag('Lọc', 'Yêu thích', 'catClearF_(\'fav\')');
  if(S.fCombo) tag('Lọc', 'Có combo', 'catClearF_(\'combo\')');
  var mn=document.getElementById('fMin'), mx=document.getElementById('fMax');
  if((mn&&mn.value)||(mx&&mx.value))
    tag('Khoảng giá', ((mn&&mn.value)?money(mn.value):'0')+' – '+((mx&&mx.value)?money(mx.value):'∞'), 'catClearF_(\'gia\')');
  box.innerHTML = out.length
    ? ('<div class="fltags">'+out.join('')+'<button class="btn ghost xs" onclick="clearAllFilters();catClearF_(\'nhom\')">Xoá hết</button></div>')
    : '';
}
function catClearF_(k){
  if(k==='nhom'){ S.fNhomSet={}; }
  else if(k==='inproj'){ S._inProjMa=''; S._inProjLabel=''; }
  else if(k==='brand'){ S.fBrand=''; }
  else if(k==='fav'){ S.fFav=false; }
  else if(k==='combo'){ S.fCombo=''; }
  else if(k==='gia'){ var a=document.getElementById('fMin'), b=document.getElementById('fMax'); if(a)a.value=''; if(b)b.value=''; }
  else S[k]={};
  renderFilters(); renderCatalog(); updateCatUI();
}
function clearAllFilters(){
  S.fWatt={}; S.fKelvin={}; S.fAngle={}; S.fIP={}; S.fCRI={}; S.fVolt={}; S.fBrand=''; S.fCombo=''; S.fFav=false; S.fVs={};
  var mn=document.getElementById('fMin'); if(mn) mn.value='';
  var mx=document.getElementById('fMax'); if(mx) mx.value='';
  renderFilters(); renderCatalog();
}
// ==== Dropdown "bộ lọc": gập/mở khối lọc (Hạng mục SP, Đèn trong DA, Công suất, Nhiệt độ, Góc chiếu, Thương hiệu, giá) ====
function activeFiltCount_(){
  var n=0;
  if(vsFltOn_()) n+=vsFltCount_();
  else ['fWatt','fKelvin','fAngle','fIP','fCRI','fVolt'].forEach(function(k){ if(Object.keys(S[k]||{}).some(function(x){return S[k][x];})) n++; });
  if(S.fBrand) n++;
  if(S.fCombo) n++;
  if(S.fFav) n++;
  var mn=document.getElementById('fMin'), mx=document.getElementById('fMax');
  if((mn&&mn.value)||(mx&&mx.value)) n++;
  if(Object.keys(S.fNhomSet||{}).some(function(k){return S.fNhomSet[k];})) n++;
  if(S._inProjMa) n++;
  return n;
}
function positionFiltPop_(){
  var lf=document.getElementById('lightFilters'), btn=document.getElementById('filtBtn'), lc=document.getElementById('leftCat');
  if(!lf||!btn||!lc) return;
  var br=btn.getBoundingClientRect(), pr=lc.getBoundingClientRect();
  var w=Math.min(Math.max(260,pr.width-24), window.innerWidth-16);
  var left=Math.max(8, Math.min(pr.left+12, window.innerWidth-w-8));
  var top=br.bottom+6;
  lf.style.position='fixed'; lf.style.width=w+'px'; lf.style.left=left+'px'; lf.style.top=top+'px';
  lf.style.maxHeight=Math.max(220,window.innerHeight-top-12)+'px';
}
/* ═══ BỘ LỌC: popover chỉ liệt kê TÊN bộ lọc; bật tên nào thì bộ lọc đó hiện trên panel ═══
   Mặc định trên panel có Công suất + Nhiệt độ màu. Khối bộ lọc là CÙNG một phần tử DOM,
   chỉ chuyển qua lại giữa panel (#pinFilters) và kho ẩn (#filtStore) — nên mọi hàm vẽ /
   lọc cũ vẫn chạy nguyên, không phải viết lại từng bộ lọc. */
var FLT_REG=[['watt','Công suất'],['kelvin','Nhiệt độ màu'],['angle','Góc chiếu sáng'],
  ['yeuthich','Yêu thích'],['combo','Combo'],['brand','Thương hiệu'],['price','Khoảng giá']];
function fltPins_(){
  try{ var v=JSON.parse(localStorage.getItem('qs_pinflt')||'null'); if(Array.isArray(v)) return v; }catch(e){}
  return ['watt','kelvin'];
}
function fltApplyPins_(){
  var pin=fltPins_(), box=document.getElementById('pinFilters'), store=document.getElementById('filtStore');
  if(!box||!store) return;
  pin.forEach(function(k){ var el=document.getElementById('sec_'+k); if(el && el.parentNode!==box) box.appendChild(el); });
  FLT_REG.forEach(function(f){ if(pin.indexOf(f[0])>=0) return;
    var el=document.getElementById('sec_'+f[0]); if(el && el.parentNode!==store) store.appendChild(el); });
}
function fltActiveN_(k){
  function n(o){ return Object.keys(o||{}).filter(function(x){ return o[x]; }).length; }
  if(k==='watt') return n(S.fWatt); if(k==='kelvin') return n(S.fKelvin); if(k==='angle') return n(S.fAngle);
  if(k==='yeuthich') return S.fFav?1:0; if(k==='combo') return S.fCombo?1:0; if(k==='brand') return S.fBrand?1:0;
  if(k==='price'){ var a=document.getElementById('fMin'), b=document.getElementById('fMax'); return ((a&&a.value)||(b&&b.value))?1:0; }
  return 0;
}
function fltNamesRender_(){
  var el=document.getElementById('filtNames'); if(!el) return;
  var pin=fltPins_();
  var denOnly={watt:1,kelvin:1,angle:1};
  el.innerHTML=FLT_REG.filter(function(f){ return !(vsFltOn_()&&denOnly[f[0]]); }).map(function(f){
    var on=pin.indexOf(f[0])>=0, n=fltActiveN_(f[0]);
    return '<button class="fn-row'+(on?' on':'')+'" onclick="fltTogglePin_(\''+f[0]+'\')" title="'+(on?'Đang hiện trên panel — bấm để ẩn':'Bấm để hiện trên panel')+'">'
      +'<span class="fn-t">'+esc(f[1])+'</span>'+(n?'<span class="fn-n">'+n+'</span>':'')
      +'<span class="fn-sw"></span></button>';
  }).join('');
}
function fltTogglePin_(k){
  var pin=fltPins_(), i=pin.indexOf(k);
  if(i>=0) pin.splice(i,1); else pin.push(k);          // bật mới -> nằm cuối panel
  try{ localStorage.setItem('qs_pinflt', JSON.stringify(pin)); }catch(e){}
  fltApplyPins_(); fltNamesRender_();
  if(S._filtOpen && typeof positionFiltPop_==='function') positionFiltPop_();
}
function applyFiltDrop(){
  var isPT=(S.node==='3.1');
  fltApplyPins_(); fltNamesRender_();
  var lf=document.getElementById('lightFilters'), se=document.getElementById('selExtra'), btn=document.getElementById('filtBtn');
  var open=!!S._filtOpen && !isPT;
  if(se) se.style.display=isPT?'none':'';
  if(btn){ btn.style.display=isPT?'none':''; btn.classList.toggle('open',open); }
  if(lf){
    if(open){ if(lf.parentElement!==document.body) document.body.appendChild(lf); lf.style.display='block'; positionFiltPop_(); }
    else lf.style.display='none';
  }
  var bd=document.getElementById('filtBadge');
  if(bd){ var c=activeFiltCount_(); bd.textContent=c?c:''; bd.style.display=c?'':'none'; }
}
function filtOutside_(e){ var t=e.target; if(t&&t.closest&&(t.closest('#lightFilters')||t.closest('#filtBtn'))) return; toggleFiltDrop(); }
function filtReposition_(){ if(S._filtOpen) positionFiltPop_(); }
function toggleFiltDrop(){
  S._filtOpen=!S._filtOpen; applyFiltDrop();
  document.removeEventListener('mousedown',filtOutside_);
  window.removeEventListener('scroll',filtReposition_,true);
  window.removeEventListener('resize',filtReposition_);
  if(S._filtOpen){
    setTimeout(function(){ document.addEventListener('mousedown',filtOutside_); },0);
    window.addEventListener('scroll',filtReposition_,true);
    window.addEventListener('resize',filtReposition_);
  }
}
function renderCatalog(){
  var isPT=(S.node==='3.1');
  if(typeof renderMM_==='function') renderMM_();
  if(typeof qbRender_==='function') qbRender_();     // thanh công cụ nhanh: hạng mục gần đây / số bộ lọc
  applyFiltDrop();   // ẩn/hiện khối bộ lọc theo trạng thái gập/mở (và ẩn hẳn khi Phần thô)
  var hd=document.querySelector('#leftCat .cat-hd h3'); if(hd) hd.textContent=isPT?'Nội dung công việc':'Hạng mục';
  // Lọc nhanh Công suất / Nhiệt độ màu chỉ có nghĩa với ĐÈN -> ẩn ở đề mục Thiết bị vệ sinh
  var isVS=(S.node==='3.2.5');
  var ctSecs=isPT?[]:ctSecsOfNode_(S.node);          // Thạch cao / Sơn nước / Xây tô / Ốp lát / Cửa: có công tác để chọn
  ['sec_watt','sec_kelvin','sec_angle'].forEach(function(id){ var e=document.getElementById(id); if(e) e.style.display=(isVS||isPT||ctSecs.length)?'none':''; });
  renderVsFilters_(); updateInProj_();
  var fg0=document.getElementById('favGoBtn'); if(fg0) fg0.style.display=isPT?'none':'';   // Phần thô: không có SP yêu thích
  var fw0=document.getElementById('ptFilters'); if(fw0&&!isPT) fw0.innerHTML='';   // rời Phần thô -> dọn bộ lọc riêng
  if(isPT){ renderPTLibrary(); return; }   // Phần thô: hiện thư viện nội dung công việc
  var list=filteredProducts();
  var el=document.getElementById('catList');
  var cc=document.getElementById('catCount'); if(cc) cc.textContent=list.length+' SP';
  updateCatUI();
  if(ctSecs.length){
    var nCt=ctSecs.reduce(function(n,s){ return n+s.items.length; },0);
    if(cc) cc.textContent=nCt+' công tác'+(list.length?(' · '+list.length+' SP'):'');
    if(!list.length){ el.innerHTML=renderCtLib_(ctSecs); S._filtered=list; return; }
  }
  if(!list.length){ el.innerHTML=S.fFav
      ? '<div class="ptlib-empty">'+icon('heart',22)+'<b>Chưa có sản phẩm yêu thích</b><span>Bấm biểu tượng trái tim ở một sản phẩm (tại đây hoặc trong Danh sách sản phẩm) để lưu lại, lần sau mở dự án mới là lấy ra dùng ngay.</span></div>'
      : '<div class="empty">Không có sản phẩm khớp lọc.</div>';
    S._filtered=list; return; }
  var grp=catVarGroups_(list.slice(0,300));
  el.innerHTML=grp.map(function(G){ var i=G.i, p=list[i];
    var img=p.hinhAnh?'<img class="thumb" src="'+esc(imgSrc1_(p.hinhAnh))+'" onerror="this.style.visibility=\'hidden\'">':'<div class="thumb"></div>';
    var im2=p.hinhAnh?'<img class="thumb" src="'+esc(imgSrc1_(p.hinhAnh))+'" onclick="showDetail('+i+')" style="cursor:pointer" onerror="this.style.visibility=\'hidden\'">':'<div class="thumb" onclick="showDetail('+i+')" style="cursor:pointer"></div>';
    var brand=esc(p.thuongHieu||'');
    // Thông số nhanh (công suất · nhiệt độ màu · CRI · góc chiếu) — dùng chung cách hiện với bảng Danh sách SP
    var specs=spSpecs_(p); if(specs.indexOf('muted')>=0) specs='';
    return '<div class="citem'+(catCbMo_(p)?' cb-open':'')+'" draggable="true" ondragstart="prodDragStart(event,'+i+')" ondragend="prodDragEnd()">'
      +'<div class="no"><span class="no-n">'+(i+1)+'</span></div>'+im2
      +'<div class="cmid" onclick="showDetail('+i+')" title="Xem chi tiết sản phẩm">'
        +'<div class="nm">'+esc(p.ten)+'</div>'
        +'<div class="meta"><span class="pr">'+money(p.donGiaBan)+' đ</span></div>'
      +'</div>'
      +'<div class="cacts">'
        +'<button class="cfav'+(p.yeuThich?' on':'')+'" title="'+(p.yeuThich?'Bỏ khỏi sản phẩm yêu thích':'Thêm vào sản phẩm yêu thích')+'" onclick="event.stopPropagation();catFav('+i+','+(p.yeuThich?0:1)+')">'+icon('heart',15)+'</button>'
        +'<button class="add" title="Thêm vào bóc tách" onclick="event.stopPropagation();addProduct('+i+')">'+icon('plus',15)+'</button>'
      +'</div>'
      // hàng chip thông số nằm RIÊNG 1 hàng, rộng hết thẻ -> đủ chỗ, không cắt, không rớt dòng
      +((brand||p.comboN||G.kids.length)?('<div class="cmeta metarow">'
          +(brand?'<span class="sz brand">'+brand+'</span>':'')
          +(p.comboN?('<button class="cc-tag'+(catCbMo_(p)?' on':'')+'" title="Xem '+p.comboN+' sản phẩm đi kèm"'
              +' onclick="event.stopPropagation();catComboToggle_('+i+')">'
              +'<i class="cc-car">'+(catCbMo_(p)?'▾':'▸')+'</i>Combo <b>'+p.comboN+'</b></button>'):'')
          +(G.kids.length?('<button class="cc-tag bt-tag'+(catVarMo_(p)?' on':'')+'" title="Xem '+(G.kids.length+1)+' biến thể của sản phẩm này"'
              +' onclick="event.stopPropagation();catVarToggle_('+i+')">'
              +'<i class="cc-car">'+(catVarMo_(p)?'▾':'▸')+'</i>Biến thể <b>'+(G.kids.length+1)+'</b></button>'):'')
        +'</div>'):'')
      +(specs?'<div class="cspecs" onclick="showDetail('+i+')">'+specs+'</div>':'')
    +'</div>'
    +(catCbMo_(p)?catComboHtml_(p,i):'')             // thành phần combo = thẻ SP thật, nằm ngang hàng
    +(catVarMo_(p)?catVarHtml_(list,G):'');          // các biến thể còn lại của cùng 1 sản phẩm
  }).join('');
  if(ctSecs.length) el.innerHTML=renderCtLib_(ctSecs)+'<div class="ctlib-h sp">'+icon('tag',13)+' Sản phẩm<span>'+list.length+'</span></div>'+el.innerHTML;
  S._filtered=list;
}
function specRows_(text){
  return String(text||'').split(/\r?\n|;|·/).map(function(s){return s.trim();}).filter(Boolean).map(function(line){
    var m=line.match(/^([^:：]{2,32})[:：]\s*(.+)$/);
    if(m) return '<div class="spec"><span class="k">'+esc(m[1].trim())+'</span><span class="v">'+esc(m[2].trim())+'</span></div>';
    return '<div class="spec"><span class="v" style="text-align:left;color:#3a4753">'+esc(line)+'</span></div>';
  }).join('');
}
// 1 nhóm thông số: chỉ hiện dòng có giá trị; cả nhóm ẩn nếu rỗng hết
// title dạng "English|Tiếng Việt" -> render EN đậm + (VN) nghiêng nhạt
function pdSection_(title, rows){
  var body=rows.filter(function(r){return r[1]!=null && r[1]!=='';}).map(function(r){
    return '<div class="spec"><span class="k">'+esc(r[0])+'</span><span class="v">'+esc(r[1])+'</span></div>';
  }).join('');
  var t=String(title).split('|');
  var head=esc(t[0])+(t[1]?' <i>('+esc(t[1])+')</i>':'');
  return body?'<div class="pd-block"><div class="pd-sec">'+head+'</div>'+body+'</div>':'';
}
// Ảnh (gallery nhiều ảnh) + mã + tên + Key Product Info — bám Figma
function pdMedia_(p){
  var cong=p.congSuat||parseWatt(p.ten), nd=p.nhietDo||parseKelvin(p.ten);
  var keyItems=(nganhCuaSP_(p)==='vs')
    ? vsChip_(p)
    : [
    ['power', cong + (p.dongRa?(' ('+p.dongRa+(/mA/i.test(p.dongRa)?'':'mA')+')'):'')],
    ['temp', nd + (p.quangThong?(' ('+p.quangThong+(/lm/i.test(p.quangThong)?'':'lm')+')'):'')],
    ['color', p.mauSac],
    ['angle', p.gocChieu]
  ].filter(function(x){ return x[1] && String(x[1]).trim(); });
  var keyHtml='';
  if(keyItems.length){
    keyHtml='<div class="pd-block"><div class="pd-sec">Key Product Info <i>(Thông tin chính)</i></div>'
      +'<div class="pd-keys">'+keyItems.map(function(x){ return '<div class="pd-key"><span class="ic">'+icon(x[0],15)+'</span><span>'+esc(x[1])+'</span></div>'; }).join('')+'</div></div>';
  }
  /* ═══ GALLERY: xem được TẤT CẢ ảnh của sản phẩm ═══
     - Ảnh lớn có nút ‹ › lật ảnh + số đếm 2/5, bấm vào mở xem cỡ lớn
     - Dải ảnh nhỏ bên dưới, bấm chọn nhanh; cuộn ngang nếu nhiều ảnh    */
  var imgs=String(p.anhTatCa||p.hinhAnh||'').split('\n').map(function(s){return s.trim();}).filter(Boolean)
             .map(function(v){ return imgUrlOf(v); });
  S._pdImgs=imgs; S._pdIdx=0;
  var nav = imgs.length>1
    ? '<button class="pd-nav prev" title="Ảnh trước (←)" onclick="event.stopPropagation();pdGoImg_(-1)">'+icon('left',18)+'</button>'
      +'<button class="pd-nav next" title="Ảnh sau (→)" onclick="event.stopPropagation();pdGoImg_(1)">'
      +'<svg class="ico" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18l6-6-6-6"/></svg></button>'
      +'<span class="pd-count" id="pdCount">1/'+imgs.length+'</span>'
    : '';
  var main = imgs[0]
    ? '<img id="pdMainImg" src="'+esc(imgs[0])+'" onclick="imgPop_(this.src)" title="Bấm để xem ảnh lớn" onerror="this.style.visibility=\'hidden\'">'
    : '<span class="pd-noimg">'+icon('image',26)+'<i>Chưa có ảnh</i></span>';
  var dl = imgs[0] ? '<a class="pd-imgdl" href="'+esc(imgs[0])+'" target="_blank" rel="noopener" title="Mở ảnh gốc">'+icon('download',14)+'</a>' : '';
  var thumbs = imgs.length>1
    ? '<div class="pd-thumbs" id="pdThumbs">'+imgs.map(function(v,i){
        return '<button class="pd-thumb'+(i===0?' on':'')+'" title="Ảnh '+(i+1)+'" onclick="pdSetImg_('+i+')">'
          +'<img src="'+esc(v)+'" onerror="this.style.visibility=\'hidden\'"></button>'; }).join('')+'</div>'
    : '';
  return '<div class="pd-gal"><div class="imgbox">'+main+nav+dl+'</div>'+thumbs+'</div>'
    +'<div class="pcode">'+esc(p.ma||p.ten)+'</div>'
    +(p.ten?'<div class="pd-name">'+esc(p.ten)+'</div>':'')
    +keyHtml;
}
/* pdMedia_ dùng CHUNG cho panel Bóc tách và popup Danh sách SP -> id bên trong bị TRÙNG.
   Phải tra phần tử trong đúng khung đang mở, nếu không bấm ‹ › ở popup lại lật ảnh của panel. */
function pdBox_(){
  return document.querySelector('#spModalOv .sp-modal') || document.getElementById('pdPanel') || document;
}
function pdEl_(id){ var b=pdBox_(); return (b&&b.querySelector)?b.querySelector('#'+id):document.getElementById(id); }
// Chọn ảnh thứ i trong gallery
function pdSetImg_(i){
  var imgs=S._pdImgs||[]; if(!imgs.length) return;
  i=((i%imgs.length)+imgs.length)%imgs.length; S._pdIdx=i;
  var im=pdEl_('pdMainImg');
  if(im){ im.src=imgs[i]; im.style.visibility='visible'; }
  var c=pdEl_('pdCount'); if(c) c.textContent=(i+1)+'/'+imgs.length;
  var tw=pdEl_('pdThumbs');
  if(tw){ [].slice.call(tw.children).forEach(function(b,k){ b.classList.toggle('on',k===i); });
    var on=tw.children[i]; if(on&&on.scrollIntoView) on.scrollIntoView({block:'nearest',inline:'nearest'}); }
}
function pdGoImg_(d){ pdSetImg_((S._pdIdx||0)+d); }
function pdPickImg_(btn,src){   // giữ để tương thích chỗ gọi cũ
  var i=[].slice.call(btn.parentNode.children).indexOf(btn); pdSetImg_(i<0?0:i);
}
// Các nhóm thông số — tiêu đề song ngữ + thứ tự theo Figma
function pdSpecs_(p){
  if(nganhCuaSP_(p)==='vs') return pdSpecsVS_(p);
  return pdSection_('Design Specifications|Thông số thiết kế',[
      ['Chất liệu',p.chatLieu],['Chiều cao',p.chieuCao],['Đường kính',p.duongKinh],
      ['Góc nghiêng / góc chỉnh hướng',p.gocNghieng],['Dòng sản phẩm',p.dongSanPham||p.nhom]])
    +pdSection_('Performance Specifications|Thông số hiệu suất',[
      ['Quang thông',p.quangThong],['Chỉ số IP (Chống bụi, nước)',p.capBaoVe],['CRI',p.cri],
      ['Hiệu suất phát quang (Efficacy)',p.hieuSuat],['Chỉ số gây chói mắt (UGR)',p.ugr],
      ['Tuổi thọ đèn',p.tuoiTho],['Loại chip LED',p.chipLed],
      ['Độ đồng nhất màu sắc (SDCM)',p.sdcm],['Chỉ số ngộ độc Cyanosis (COI Compliance)',p.coi],
      ['Thời gian bảo hành',p.baoHanh]])
    +pdSection_('Driver|Nguồn LED / Chấn lưu',[
      ['Bộ nguồn',p.tenBoNguon],['Mã sản phẩm',p.maBoNguon],['Hãng bộ nguồn',p.hangBoNguon],
      ['Vị trí lắp đặt bộ nguồn',p.viTriNguon],['Tương thích điều khiển (Control Type)',p.tuongThich],
      ['Cường độ dòng điện đầu ra tối đa',p.dongRa]])
    +pdSection_('Installation Specifications|Thông số lắp đặt',[
      ['Lắp đặt bộ nguồn rời',p.lapNguonRoi],['Kích thước lỗ khoét trần (Cutout Size)',p.loKhoet],
      ['Cấp bảo vệ an toàn điện (Class Rating)',p.capBaoVeDien]])
    +(p.moTa && !p.chatLieu && !p.quangThong ? '<div class="pd-block"><div class="pd-sec">Thông số kỹ thuật <i>(mô tả)</i></div>'+specRows_(p.moTa)+'</div>' : '');
}
/* Thiết bị vệ sinh: nhóm thông số theo HẠNG MỤC của SP (VS_SPEC) — cùng bộ với form Nhập & file mẫu */
function vsVal_(p,lb){ var m=VS_SPEC.METRIC[lb]; var v=m&&p.raw?p.raw[m[0]]:''; return (v==null?'':String(v)).trim(); }
function vsNhom_(p){
  var h=VS_SPEC.hmOf(p.hangMuc);
  if(h) return {chinh:h.chinh, tk:h.tk};
  return {chinh:VS_SPEC.CHINH_ALL, tk:VS_SPEC.TK_ALL};     // hạng mục lạ: cùng cách chia với server (dòng trống tự ẩn)
}
function pdSpecsVS_(p){
  var g=vsNhom_(p), rows=function(ds){ return ds.map(function(lb){ return [VS_SPEC.METRIC[lb][1], vsVal_(p,lb)]; }); };
  // (Khối chip "Key Product Info" đã do pdMedia_ vẽ phía trên -> đặt tên khác cho khỏi trùng)
  return pdSection_('Product Overview|Tổng quan sản phẩm',
      rows(g.chinh).concat([['Dòng sản phẩm',p.dongSanPham||p.nhom],['Hạng mục',VS_SPEC.chuanHM(p.hangMuc)||p.hangMuc],['Thời gian bảo hành',p.baoHanh]]))
    +pdSection_('Design Specifications|Thông số thiết kế', rows(g.tk))
    +(String(p.tinhNang||'').trim()
      ? '<div class="pd-block"><div class="pd-sec">Features <i>(Tính năng)</i></div>'+pdBullets_(p.tinhNang)+'</div>' : '');
}
// 4 thông số nổi bật của SP vệ sinh (chip Key Product Info / cột Thông số trong danh sách)
function vsChip_(p){
  var g=vsNhom_(p), ds=['KÍCH THƯỚC','MÀU SẮC'].concat(g.chinh.filter(function(lb){ return lb!=='MÀU SẮC'&&lb!=='THIẾT KẾ'; }));
  var ic={'KÍCH THƯỚC':'ruler','MÀU SẮC':'color'};
  return ds.map(function(lb){ return [ic[lb]||'gauge', vsVal_(p,lb), lb]; }).filter(function(x){ return x[1]; }).slice(0,4);
}
function pdBullets_(text){
  return '<div class="pd-bullets">'+String(text||'').split(/\r?\n/).map(function(x){ return x.replace(/^[•\-\*\s]+/,'').trim(); })
    .filter(Boolean).map(function(x){ return '<div class="pd-bl">'+esc(x)+'</div>'; }).join('')+'</div>';
}
function pdPriceFoot_(p){
  var ds=p.linkDatasheet;
  return '<div class="pd-price"><span>Đơn giá</span><b>'+money(p.donGiaBan)+' đ</b></div>'
    +'<div class="pd-foot2">'
      +(ds?'<a class="pd-fbtn" href="'+esc(ds)+'" target="_blank" rel="noopener">'+icon('doc',14)+' Tài liệu kỹ thuật</a>'
          :'<span class="pd-fbtn dis" title="Sản phẩm chưa có link datasheet">'+icon('doc',14)+' Tài liệu kỹ thuật</span>')
      +(ds?'<a class="pd-fbtn" href="'+esc(ds)+'" download target="_blank" rel="noopener">'+icon('download',14)+' Tải về</a>':'')
    +'</div>';
}
// Nội dung chi tiết SP xếp dọc (panel Bóc tách)
function pdContent_(p){ return pdMedia_(p)+pdSpecs_(p)+pdPriceFoot_(p); }
/* Bấm 1 sản phẩm đi kèm -> hiện thông tin của chính sản phẩm đó.
   Thẻ con không nằm trong danh sách đang lọc nên mở panel theo OBJECT, không theo chỉ số. */
function catChildDetail_(pk,k){
  var ds=(S._catCbIdx||{})[pk]||(S._catCb||{})[pk]||[];
  var x=ds[k]; if(!x) return;
  showDetailObj_(x, 'catAddChild_(\''+pk+'\','+k+')');
}
function showDetailObj_(p, addJs){
  var el=document.getElementById('pdPanel'); if(!el) return;
  S._detailIdx=null;
  var g=document.getElementById('bocGrid'); if(g) g.classList.add('detail');
  el.style.display='block'; el.classList.remove('ptdetail');
  el.innerHTML='<div class="pd-head"><h3>Thông tin sản phẩm</h3><button class="pd-x" title="Đóng" onclick="hideDetail()">✕</button></div>'
    +pdContent_(p)
    +'<div id="pdComboPanel"></div>'
    +'<div class="pd-actions">'
      +'<button class="btn ghost sm" onclick="hideDetail()">Đóng</button>'
      +'<button class="btn blue sm" onclick="'+addJs+'">'+icon('plus',14)+' Thêm vào bóc tách</button></div>';
  document.addEventListener('keydown',pdPanelKey_);
  el.scrollTop=0;
  pdLoadCombo_(p, null, 'bóc tách', 'pdComboPanel');     // xem combo của chính SP này (nếu có)
}
function showDetail(i){
  var p=(S._filtered||[])[i]; if(!p) return;
  S._detailIdx=i;
  var el=document.getElementById('pdPanel');
  document.getElementById('bocGrid').classList.add('detail');
  el.style.display='block'; el.classList.remove('ptdetail');
  el.innerHTML='<div class="pd-head"><h3>Thông tin sản phẩm</h3><button class="pd-x" title="Đóng" onclick="hideDetail()">✕</button></div>'
    +pdContent_(p)
    +'<div id="pdComboPanel"></div>'
    +'<div class="pd-actions">'
      +'<button class="btn ghost sm" onclick="hideDetail()">Đóng</button>'
      +'<button class="btn blue sm" onclick="addProduct('+i+')">'+icon('plus',14)+' Thêm vào bóc tách</button></div>';
  document.addEventListener('keydown',pdPanelKey_);
  pdLoadCombo_(p, i, 'bóc tách', 'pdComboPanel');
}
// ←/→ lật ảnh trong panel chi tiết bên Bóc tách
function pdPanelKey_(e){
  var el=document.getElementById('pdPanel'); if(!el||el.style.display==='none') return;
  if(document.getElementById('imgPop') && document.getElementById('imgPop').style.display==='flex') return;
  var a=document.activeElement, tg=a?a.tagName:''; if(tg==='INPUT'||tg==='TEXTAREA') return;
  if(e.key==='ArrowLeft'){ e.preventDefault(); pdGoImg_(-1); }
  else if(e.key==='ArrowRight'){ e.preventDefault(); pdGoImg_(1); }
}
/* ===== DANH SÁCH SẢN PHẨM ===== */
function renderSanpham(){
  var box=document.getElementById('v-sanpham');
  var searchIc='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>';
  box.innerHTML='<div class="sechd"><h2>Danh sách sản phẩm</h2><span class="count" id="spCount">0</span></div>'
    +'<div class="sp-workspace'+(spPanelHidden_()?' panel-hidden':'')+'" id="spWorkspace">'
      +'<button class="spp-show" id="sppShow" title="Hiện panel Sản phẩm trong dự án" onclick="spPanelToggle()">'
        +icon('layers',15)+'<span class="spp-show-n">'+((S.cur?S.lines:[])||[]).length+'</span></button>'
      +'<div class="sp-projpanel" id="spProjPanel" ondragover="spPanelDragOver(event)" ondragleave="spPanelDragLeave(event)" ondrop="spPanelDrop(event)"></div>'
      +'<div class="sp-main">'
        +'<div class="dbcard sp-card">'
          +'<div class="sp-toolbar">'
            +'<div class="sp-search-wrap">'+searchIc+'<input id="spSearch" placeholder="Tìm theo tên, mã hoặc thương hiệu…" oninput="spFilter()"></div>'
            +'<span class="sp-flex"></span>'
            +'<button class="btn ghost sm sp-undobtn" id="spUndoBtn" onclick="spUndo_()" disabled title="Chưa có thao tác nào để hoàn tác">'
              +'<svg class="ico" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 14L4 9l5-5"/><path d="M4 9h11a5 5 0 0 1 0 10h-4"/></svg> Hoàn tác</button>'
            +'<button class="btn ghost sm sp-editbtn" id="spEditBtn" onclick="spEditToggle()" title="Sửa nhanh ngay trên bảng — hiện tất cả cột nhập liệu">'+icon('edit',14)+' Edit</button>'

            +'<button class="btn ghost sm" id="spBoLocBtn" onclick="spToggleBoLoc(event)">'+icon('sliders',14)+' Bộ lọc<span class="spflt-badge" id="spFltBadge"></span></button>'
            +'<button class="btn ghost sm" id="spXlsBtn" onclick="spXlsClick_()" title="Tải danh sách ra file Excel">'+icon('download',14)+' <span id="spXlsLbl">Tải Excel</span></button>'
            +'<button class="btn blue sm" onclick="showTab(\'import\')">'+icon('plus',14)+' Thêm sản phẩm</button>'
          +'</div>'
          +'<div class="sp-headrow"><div class="spviewtabs" id="spViewTabs"></div><div class="spbar" id="spBar"></div></div>'
          +'<div class="colchips sp-colchips" id="spColBar"></div>'
          +'<div class="tbl-wrap"><table class="sp-table"><colgroup id="spColg"></colgroup><thead id="spHead"></thead>'
            +'<tbody id="spBody"></tbody></table></div>'
          // thanh kéo ngang nằm NGAY DƯỚI bảng, trên phân trang — đúng chỗ người dùng quen tìm
          +'<div class="tk-hbar sp-hbar" id="spHBar" style="display:none"><div class="tk-hthumb" id="spHThumb"></div></div>'
          +'<div id="spPager"></div>'
        +'</div><div id="spBulkWrap"></div>'
      +'</div>'
    +'</div>';
  S._spSel=S._spSel||{}; S._spFilters=S._spFilters||{};
  spColsSync_();          // bộ cột theo ngành hàng đang lọc (đèn / vệ sinh)
  S._spView=S._spView||'all';
  renderSpProjPanel_(); renderSpChips_(); spEditBtnSync_(); spUndoBtnSync_(); spColChips_(); spRenderHead_(); spFilter();
  spLoadPerm_().then(function(){ spEditBtnSync_(); spViewTabs_(); spFilter(); });
}
// LEFT: sản phẩm đã ghi danh vào dự án hiện tại (S.lines)
function renderSpProjPanel_(){
  var el=document.getElementById('spProjPanel'); if(!el) return;
  var head='<div class="spp-head"><span class="spp-ic">'+icon('layers',16)+'</span><h3>Sản phẩm trong dự án</h3>'
    +'<span class="spp-count">'+((S.cur?S.lines:[])||[]).length+'</span>'
    +'<button class="spp-hide" title="Thu gọn panel (mở rộng bảng)" onclick="spPanelToggle()">'+icon('left',14)+'</button></div>';
  // dropdown chọn/tạo dự án ngay trong panel (bám mockup)
  var projSel='<select class="spp-projsel" onchange="spSwitchProject(this.value)">'
    +'<option value="">— Chọn hoặc tạo dự án —</option>'
    +(S.projects||[]).map(function(p){ return '<option value="'+esc(p.maDA)+'"'+(S.cur&&S.cur.maDA===p.maDA?' selected':'')+'>'+esc(p.ten)+'</option>'; }).join('')
    +'<option value="__new__">＋ Tạo dự án mới…</option></select>';
  if(!S.cur){ el.innerHTML=head+projSel+'<div class="spp-empty">Chưa chọn dự án.<br>Chọn dự án ở trên để bắt đầu ghi danh sản phẩm.</div>'; return; }
  var lines=S.lines||[];
  var rows=lines.map(function(l){
    var im=imgSrc1_(l.hinhAnh);
    var sub=[l.kichThuoc,l.tang].map(function(x){return String(x||'').trim();}).filter(Boolean).join(' · ');
    return '<div class="spp-item">'
      +(im?'<img class="spp-img" src="'+esc(im)+'" onerror="this.style.visibility=\'hidden\'">':'<span class="spp-img"></span>')
      +'<div class="spp-info"><div class="spp-name" title="'+esc(l.ten||'')+'">'+esc(l.ten||'')+'</div>'+(sub?'<div class="spp-sub">'+esc(sub)+'</div>':'')+'</div>'
      +'<span class="spp-qty">×'+(Number(l.soLuong)||0)+'</span>'
      +'<button class="spp-del" title="Bỏ khỏi dự án" onclick="spRemoveFromProject(\''+l.lineId+'\')">✕</button>'
    +'</div>';
  }).join('')||'<div class="spp-empty">Chưa có sản phẩm.<br><b>Kéo sản phẩm</b> từ bảng bên phải thả vào đây,<br>hoặc bấm ＋ trên từng dòng.</div>';
  el.innerHTML=head+projSel+'<div class="spp-sub2">Danh sách sản phẩm tham gia dự án</div><div class="spp-list">'+rows+'</div>';
}
async function spSwitchProject(maDA){
  if(maDA==='__new__'){ if(typeof openCreate==='function') openCreate(); renderSpProjPanel_(); return; }
  if(!maDA){ return; }
  var p=(S.projects||[]).filter(function(x){return x.maDA===maDA;})[0]; if(!p) return;
  S.cur=p; S._coverDA=null; try{ S.lines=await api('getLines',maDA)||[]; }catch(e){ S.lines=[]; }
  if(typeof renderProjSel==='function') renderProjSel();
  renderCard&&renderCard();
  renderSpProjPanel_(); renderSpChips_(); spFilter();
}
/* ===== Thu gọn / hiện panel "Sản phẩm trong dự án" ===== */
function spPanelHidden_(){ try{ return localStorage.getItem('qs_spPanelHide')==='1'; }catch(e){ return false; } }
function spPanelToggle(){
  var on=!spPanelHidden_();
  try{ localStorage.setItem('qs_spPanelHide', on?'1':'0'); }catch(e){}
  var ws=document.getElementById('spWorkspace');
  if(ws) ws.classList.toggle('panel-hidden', on);
  toast(on?'Đã thu gọn panel — bấm nút bên trái để hiện lại':'Đã hiện panel Sản phẩm trong dự án');
}

/* ===== Kéo–thả sản phẩm từ bảng vào panel "Sản phẩm trong dự án" ===== */
function spRowDragStart(e,i){
  var p=(S._spList||[])[i]; if(!p){ e.preventDefault(); return; }
  // Nếu dòng đang kéo NẰM TRONG nhóm đã tick -> kéo CẢ LÔ đã chọn
  var key=String(p.recordId||p.ma||''), sel=S._spSel||{};
  var list = sel[key] ? spSelProds_() : [p];
  if(!list.length) list=[p];
  S._spDragList=list; S._spDragProd=list[0];
  var many=list.length>1;
  try{
    e.dataTransfer.effectAllowed='copy';
    e.dataTransfer.setData('text/plain', many ? (list.length+' sản phẩm') : (p.ten||''));
    var img=p.hinhAnh?'<img src="'+esc(imgSrc1_(p.hinhAnh))+'" onerror="this.style.visibility=\'hidden\'">':'<span class="dg-img"></span>';
    var g=document.createElement('div'); g.className='drag-ghost'+(many?' multi':'');
    g.innerHTML=img
      +'<span class="dg-b"><span class="dg-nm">'+esc(many ? (list.length+' sản phẩm đã chọn') : (p.ten||''))+'</span>'
      +'<span class="dg-pr">'+(many ? ('Tổng '+money(list.reduce(function(a,x){return a+(Number(x.donGiaBan)||0);},0))+' đ') : (money(p.donGiaBan)+' đ'))+'</span></span>'
      +(many?'<span class="dg-badge">'+list.length+'</span>':'')
      +'<span class="dg-add">'+icon('plus',14)+'Thả vào dự án</span>';
    document.body.appendChild(g); S._spDragGhost=g;
    e.dataTransfer.setDragImage(g,24,28);
  }catch(x){}
  // mờ TẤT CẢ dòng đang kéo
  var keys={}; list.forEach(function(x){ keys[String(x.recordId||x.ma||'')]=1; });
  [].slice.call(document.querySelectorAll('#v-sanpham .sp-row')).forEach(function(tr,ri){
    var q=(S._spList||[])[ri]; if(q && keys[String(q.recordId||q.ma||'')]) tr.classList.add('dragging');
  });
  var panel=document.getElementById('spProjPanel'); if(panel) panel.classList.add('drop-ready');
}
function spRowDragEnd(){
  S._spDragProd=null; S._spDragList=null;
  if(S._spDragGhost){ try{ S._spDragGhost.remove(); }catch(x){} S._spDragGhost=null; }
  document.querySelectorAll('.sp-row.dragging').forEach(function(x){ x.classList.remove('dragging'); });
  var panel=document.getElementById('spProjPanel'); if(panel) panel.classList.remove('drop-ready','drop-over');
}
function spPanelDragOver(e){ if(!S._spDragProd) return; e.preventDefault();
  try{ e.dataTransfer.dropEffect='copy'; }catch(x){}
  var panel=document.getElementById('spProjPanel'); if(panel) panel.classList.add('drop-over'); }
function spPanelDragLeave(e){
  var panel=document.getElementById('spProjPanel');
  if(panel && (!e.relatedTarget || !panel.contains(e.relatedTarget))) panel.classList.remove('drop-over'); }
function spPanelDrop(e){
  e.preventDefault();
  var list=(S._spDragList&&S._spDragList.length)?S._spDragList.slice():(S._spDragProd?[S._spDragProd]:[]);
  spRowDragEnd();
  if(!list.length) return;
  if(!S.cur){ toast('Chưa chọn dự án — chọn dự án ở ô trên trước'); return; }
  spAddManyToProject_(list);
}
// Ghi danh NHIỀU sản phẩm vào dự án (dùng chung cho kéo-thả lô và nút trên thanh hàng loạt)
function spAddManyToProject_(list){
  if(!S.cur){ toast('Chưa chọn dự án'); return; }
  list.forEach(function(p){ addProdObj(p); });
  renderSpProjPanel_(); setTimeout(renderSpProjPanel_,800);
  toast(list.length>1 ? ('Đã thêm '+list.length+' sản phẩm vào "'+S.cur.ten+'"')
                      : ('Đã thêm "'+(list[0].ten||'')+'" vào dự án'));
}
// nút trên thanh hàng loạt
function spBulkToProject(){
  var list=spSelProds_(); if(!list.length) return;
  if(!S.cur){ toast('Chưa chọn dự án — chọn ở ô "Sản phẩm trong dự án" bên trái'); return; }
  spAddManyToProject_(list); S._spSel={}; spFilter();
}
async function spAddToProject(i){ var p=(S._spList||[])[i]; if(!p) return; if(!S.cur){ toast('Chưa chọn dự án'); return; }
  await addProdObj(p); renderSpProjPanel_(); setTimeout(renderSpProjPanel_,700); }
async function spRemoveFromProject(id){ await delLine(id); renderSpProjPanel_(); }
// ==== Cột bảng SP có thể ẩn/hiện (giữa cột chọn và cột thao tác) ====
/* ═══ CỘT BẢNG DANH SÁCH SP = ĐÚNG BỘ TRƯỜNG CỦA FORM NHẬP ═══
   Ngoài 4 cột đặc biệt (Ảnh · Sản phẩm · Thông số · Giá đại lý), MỌI trường trong
   DB_GROUPS đều tự sinh ra 1 chip cột + 1 cột sửa được -> form nhập có bao nhiêu
   trường thì bảng có bấy nhiêu chip, thêm trường mới không phải sửa chỗ này.   */

// cột DB -> thuộc tính đã format sẵn trong object sản phẩm (hiển thị cho đẹp: "12W", "Ø100mm"…)
var COL2PROP={ thuong_hieu:'thuongHieu', nha_cung_cap:'ncc', hang_muc:'hangMuc', dong_sp:'dongSanPham',
  cong_suat_w:'congSuat', nhiet_do_mau_k:'nhietDo', goc_chieu_deg:'gocChieu', goc_nghieng_deg:'gocNghieng',
  mau_sac:'mauSac', chat_lieu:'chatLieu', chieu_cao_mm:'chieuCao', duong_kinh_mm:'duongKinh',
  cutout_mm:'loKhoet', chi_so_ip:'capBaoVe', cri:'cri', hieu_suat_lm_w:'hieuSuat', quang_thong_lm:'quangThong',
  ugr:'ugr', sdcm:'sdcm', coi:'coi', tuoi_tho:'tuoiTho', ten_chip_led:'tenChip', loai_chip_led:'chipLed',
  class_rating:'capBaoVeDien', lap_nguon_roi:'lapNguonRoi', ten_bo_nguon:'tenBoNguon', ma_bo_nguon:'maBoNguon',
  hang_bo_nguon:'hangBoNguon', vi_tri_lap_nguon:'viTriNguon', dieu_khien:'tuongThich', dong_ra_max_ma:'dongRa',
  bao_hanh_nam:'baoHanh', dvt:'dvt', link_datasheet:'linkDatasheet' };
var SP_NUMCOL={gia_ban_le:1, ck_dai_ly_pct:1, gia_ban_bo_nguon:1, quang_thong_lm:1, hieu_suat_lm_w:1, dong_ra_max_ma:1,
  bao_hanh_nam:1, chieu_cao_mm:1, duong_kinh_mm:1};
var SP_CTCOL={cong_suat_w:1, nhiet_do_mau_k:1, goc_chieu_deg:1, goc_nghieng_deg:1, cri:1, chi_so_ip:1,
  ugr:1, sdcm:1, coi:1, dvt:1, loai_chip_led:1, lap_nguon_roi:1, class_rating:1};
var SP_SFX={gia_ban_le:'đ', ck_dai_ly_pct:'%', gia_ban_bo_nguon:'đ'};      // đơn vị chỉ hiện cạnh ô, KHÔNG nằm trong giá trị
var SP_ALWAYS={gia_ban_le:1, ck_dai_ly_pct:1};       // 2 cột này sửa được cả khi CHƯA bật Edit
var SP_MONEY={gia_ban_le:1, gia_ban_bo_nguon:1};                         // ô tiền: hiện có dấu chấm 930.000, lưu số thuần
var SP_SKIP={'TÊN SẢN PHẨM':1,'MÃ SẢN PHẨM':1,'GIÁ ĐẠI LÝ':1,'ẢNH SẢN PHẨM':1};   // đã có cột đặc biệt lo
// Nhãn hiển thị RIÊNG trong bảng (form Nhập / modal Sửa vẫn giữ nhãn gốc)
var SP_COLLBL={trang_thai:'Trạng thái KD'};   // tránh trùng tên với cột "Trạng thái" (duyệt)

// giá trị HIỂN THỊ của 1 cột: ưu tiên bản đã format, không có thì lấy giá trị gốc
function spColVal_(p,col){
  var prop=COL2PROP[col];
  var v=(prop && p[prop]!=null && p[prop]!=='') ? p[prop] : (p.raw||{})[col];
  return v==null?'':String(v);
}
// giá trị đưa vào Ô NHẬP: ĐÚNG giá trị gốc trong DB (giống modal Sửa)
function spEditRaw_(p,col){ var r=p.raw||{}; return r[col]!=null?String(r[col]):spColVal_(p,col); }
function spDash_(v){ return v?esc(v):'<span class="muted">—</span>'; }

// Số SKU = số biến thể đang dùng CHUNG một mã sản phẩm (khác nhiệt độ màu / công suất / góc / màu)
var _skuMap=null;
function spSkuCount_(p){
  if(!_skuMap){ _skuMap={}; (S.products||[]).forEach(function(x){
    var k=String(x.ma||'').trim().toLowerCase(); if(k) _skuMap[k]=(_skuMap[k]||0)+1; }); }
  var k=String(p.ma||'').trim().toLowerCase();
  return k?(_skuMap[k]||1):1;
}
var _spColCache=null, _spColNganh=null;
/* Bảng Danh sách SP sinh cột từ bộ trường của NGÀNH đang xem:
   lọc hạng mục = Thiết bị vệ sinh -> cột của ngành vệ sinh; Thiết bị đèn -> cột đèn;
   chưa lọc -> gộp cả hai (cột của ngành kia vẫn tắt/rỗng, bật lại bằng chip cột). */
function spNganhCur_(){
  var nd=((S._spFilters||{}).node)||'';
  if(nd==='3.2.5') return 'vs';
  if(nd==='3.2.6'||nd==='3.2.6.1') return 'den';
  return '';
}
function spColFlat_(){
  var ng=spNganhCur_();
  if(ng==='vs') return DB_FLAT_VS;
  if(ng==='den') return DB_FLAT;
  return DB_FLAT.concat(DB_FLAT_VS);
}
function spAllCols_(){
  if(spPTMode_()) return spPTCols_();
  var ng=spNganhCur_();
  if(_spColCache && _spColNganh===ng) return _spColCache;
  _spColNganh=ng;
  var head=[
    ['stt','STT','ct',function(p,i){
      var m=(S._rowMeta||[])[i];
      if(m&&m.no) return '<span class="sp-stt'+(m.k?' sub':'')+'">'+m.no+'</span>';   // con: 1.1 · 1.2…
      var per=spPerGet_(), tr=Math.max(1,S._spPage||1);
      return '<span class="sp-stt">'+((per?(tr-1)*per:0)+i+1)+'</span>'; }],
    ['thumb','Ảnh','thumbcol',function(p){ return p.hinhAnh?'<img class="sp-th" src="'+esc(imgSrc1_(p.hinhAnh))+'" onerror="this.style.visibility=\'hidden\'">':'<span class="sp-th"></span>'; }],
    ['ten','Sản phẩm','sp-name',function(p,i){ return '<b>'+esc(p.ten||'')+'</b><span class="sp-code">'+esc(p.ma||'')
        +(p.spChung?'<span class="sp-chung" title="Sản phẩm thuộc kho chung của Dezon — chỉ xem">Kho Dezon</span>':'')
        +(p.comboN?'<button class="sp-cbn sp-cbtog'+(spCbMo_(p)?' on':'')+'" title="Xem '+p.comboN+' sản phẩm đi kèm" onclick="event.stopPropagation();spComboToggle_('+i+')"><span class="cbc">▸</span>'+icon('layers',10)+' combo '+p.comboN+'</button>':'')
        +spVarChip_(p)+spCbQty_(i)+'</span>'; },
      {lark:'TÊN SẢN PHẨM', col:'ten_sp', sfx:''}],
    ['duyet','Trạng thái','ct',function(p){
      var on=!!p.daDuyet;
      return '<span class="spduyet'+(on?' on':'')+'" title="'+(on?'Duyệt bởi '+esc(p.nguoiDuyet||'?')+(p.ngayDuyet?' · '+fmtDateTime_(p.ngayDuyet):''):'Chưa được duyệt')+'">'
        +(on?'Đã duyệt':'Chưa duyệt')+'</span>'; }],
    ['sku','Số SKU','ct',function(p){ var n=spSkuCount_(p);
      return '<span class="sku-badge'+(n>1?' multi':'')+'" title="'+(n>1?n+' biến thể cùng mã '+esc(p.ma||''):'Chỉ 1 biến thể')+'">'+n+'</span>'; }]
  ];
  var tail=[
    ['giaDaiLy','Giá đại lý','num sp-price',function(p){ return money(p.donGiaBan)+'<span class="unit">đ</span>'; }],
    ['nguoiTao','Người tạo','',function(p){ return p.nguoiTao?'<span class="sp-who">'+esc(p.nguoiTao)+'</span>':'<span class="muted">—</span>'; }],
    ['ngayTao','Ngày tạo','ct',function(p){ return p.ngayTao?fmtDate(p.ngayTao):'<span class="muted">—</span>'; }],
    ['nguoiSua','Người sửa cuối','',function(p){
      return p.nguoiSua?'<span class="sp-who" title="Lúc '+esc(fmtDateTime_(p.ngayCapNhat))+'">'+esc(p.nguoiSua)+'</span>':'<span class="muted">—</span>'; }]
  ];
  var gen=[], daCo={};
  spColFlat_().forEach(function(f){
    if(daCo[f[0]]) return; daCo[f[0]]=1;
    var lark=f[0]; if(SP_SKIP[lark]) return;
    var col=DB_LABEL2COL_[lark]; if(!col) return;
    var e={lark:lark, col:col, sfx:SP_SFX[col]||'', num:!!SP_NUMCOL[col], money:!!SP_MONEY[col]};
    var cls=SP_NUMCOL[col]?'num':(SP_CTCOL[col]?'ct':'');
    gen.push([col, SP_COLLBL[col]||f[1], cls, function(p,i){
      if(SP_ALWAYS[col]) return spInp_(i,e,spEditRaw_(p,col),p);          // giá bán lẻ / chiết khấu: luôn sửa được
      var v=spColVal_(p,col);
      if(SP_MONEY[col]) return v===''?'<span class="muted">—</span>':(money(v)+'<span class="unit">đ</span>');
      if(col==='link_datasheet') return v?'<a href="'+esc(v)+'" target="_blank" rel="noopener" onclick="event.stopPropagation()">Datasheet</a>':'<span class="muted">—</span>';
      return spDash_(v);
    }, e]);
  });
  _spColCache=head.concat(gen).concat(tail);
  return _spColCache;
}
/* ═══ CHẾ ĐỘ SỬA NHANH: bật nút Edit -> mọi cột nhập được thành ô input ═══ */
function spUnitRe_(u){ return new RegExp(u.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'$','i'); }
// "4000, 3000" -> "4000K, 3000K"  (chỉ dùng để cập nhật phần HIỂN THỊ sau khi lưu)
function spAddUnit_(v,u){ var t=String(v==null?'':v).trim(); if(!u||!t) return t; var re=spUnitRe_(u);
  return t.split(',').map(function(x){ x=x.trim(); return x?(re.test(x)?x:x+u):''; }).filter(Boolean).join(', '); }
// 1 ô nhập trong bảng
function spInp_(i,e,val,p){
  val=(val==null?'':String(val));
  if(e.money) val = val===''?'':money(val);        // 930000 -> 930.000
  if(p&&p.spChung) return '<span class="spin-wrap'+(e.num?'':' tx')+' ro" title="Sản phẩm kho chung — không sửa được">'
    +'<span class="spin-ro">'+esc(val)+'</span>'+(e.sfx?'<i>'+e.sfx+'</i>':'')+'</span>';
  return '<span class="spin-wrap'+(e.num?'':' tx')+'" onclick="event.stopPropagation()">'
    +'<input class="spin'+(e.num?'':' spin-tx')+'" value="'+esc(val)+'"'
    +' title="'+esc(val)+'" data-i="'+i+'" data-lark="'+esc(e.lark)+'" data-col="'+esc(e.col||'')+'" data-money="'+(e.money?1:0)+'" data-old="'+esc(val)+'"'
    +' onchange="spInlineSave(this)" onkeydown="if(event.key===\'Enter\')this.blur()">'
    +(e.sfx?'<i>'+e.sfx+'</i>':'')+'</span>';
}
// Cột "Sản phẩm" khi sửa = 2 ô: tên + mã
function spNameEdit_(p,i){
  return '<span class="spin-name" onclick="event.stopPropagation()">'
    +'<input class="spin spin-tx" title="'+esc(p.ten||'')+'" value="'+esc(p.ten||'')+'" data-i="'+i+'" data-lark="TÊN SẢN PHẨM" data-col="ten_sp" data-old="'+esc(p.ten||'')+'"'
    +' onchange="spInlineSave(this)" onkeydown="if(event.key===\'Enter\')this.blur()" placeholder="Tên sản phẩm">'
    +'<input class="spin spin-tx code" title="'+esc(p.ma||'')+'" value="'+esc(p.ma||'')+'" data-i="'+i+'" data-lark="MÃ SẢN PHẨM" data-col="ma_sp" data-old="'+esc(p.ma||'')+'"'
    +' onchange="spInlineSave(this)" onkeydown="if(event.key===\'Enter\')this.blur()" placeholder="Mã sản phẩm">'
    +'</span>';
}
// Ô của 1 cột khi ĐANG ở chế độ sửa (cột không nhập được thì vẽ như bình thường)
function spEditCell_(c,p,i){
  if(p&&p.spChung) return c[3](p,i);            // kho chung Dezon: chỉ xem
  if(c[0]==='ten') return spNameEdit_(p,i);
  var e=c[4]; if(!e) return c[3](p,i);          // Ảnh / Thông số / Giá đại lý: hiển thị
  return spInp_(i,e,spEditRaw_(p,e.col),p);
}
function spEditToggle(){
  S._spEdit=!S._spEdit;
  if(spPTMode_()){
    if(S._spEdit){ ptOrder2_(); S._ptColsOnBak=Object.assign({},S._ptColsOn||{});
      spPTCols_().forEach(function(c){ if(c[4]) S._ptColsOn[c[0]]=1; }); }
    else if(S._ptColsOnBak){ S._ptColsOn=S._ptColsOnBak; S._ptColsOnBak=null; }
    spEditBtnSync_(); spColChips_(); spRenderHead_(); spFilter();
    toast(S._spEdit?'Sửa nhanh: gõ đơn giá / thông số ngay trên bảng, rời ô là lưu (áp cho cả thư viện)':'Đã tắt chế độ sửa nhanh');
    return;
  }
  if(S._spEdit){
    S._spColsBak=Object.assign({},S._spCols||{});
    S._spCols=S._spCols||{}; S._spCols.thumb=1;
    spAllCols_().forEach(function(c){ if(c[4]) S._spCols[c[0]]=1; });   // hiện TẤT CẢ cột nhập được
  }else if(S._spColsBak){ S._spCols=S._spColsBak; S._spColsBak=null; }
  spEditBtnSync_(); spColChips_(); spRenderHead_(); spFilter();
  toast(S._spEdit?'Sửa nhanh: gõ thẳng vào ô, rời ô là tự lưu':'Đã tắt chế độ sửa nhanh');
}
/* ═══ QUYỀN SỬA / DUYỆT SẢN PHẨM ═══
   Trạng thái duyệt nằm TRÊN sản phẩm, không có bước "gửi duyệt":
   - Được sửa  -> sửa thẳng, sửa xong SP quay về Chưa duyệt
   - Được duyệt-> sửa thẳng + bấm Duyệt
   - Admin     -> cả hai                                                    */
function spCanEdit_(){ var p=S._spPerm; return p?!!p.edit:true; }
function spCanDuyet_(){ var p=S._spPerm; return p?!!p.duyet:true; }
async function spLoadPerm_(){
  try{ S._spPerm=await api('spMyPerms'); }catch(e){ S._spPerm={edit:true,duyet:true}; }
  spViewTabs_();
}
/* 3 khung nhìn = LỌC theo trạng thái duyệt của sản phẩm */
function spViewTabs_(){
  if(spPTMode_()) return spPTTabs_();
  var el=document.getElementById('spViewTabs'); if(!el) return;
  var cur=S._spView||'all', all=S.products||[];
  var chua=all.filter(function(p){ return !p.daDuyet; }).length;
  var da=all.length-chua;
  var fav=all.filter(function(p){ return p.yeuThich; }).length;
  var tabs=[['all','Tất cả', all.length?String(all.length):''],
            ['chua','Chưa duyệt', chua?String(chua):''],
            ['da','Đã duyệt', da?String(da):''],
            ['fav','♥ Yêu thích', fav?String(fav):'']];
  el.innerHTML=tabs.map(function(t){
    return '<button class="spvt'+(cur===t[0]?' on':'')+(t[0]==='chua'?' warn':(t[0]==='fav'?' fav':''))+'" onclick="spSetView(\''+t[0]+'\')">'+esc(t[1])
      +(t[2]?'<span class="spvt-n">'+t[2]+'</span>':'')+'</button>';
  }).join('')
  +(spCanDuyet_()?'':'<span class="spvt-note">Bạn chỉ được sửa — sản phẩm sửa xong sẽ chờ người có quyền duyệt</span>');
}
/* ═══ SẢN PHẨM YÊU THÍCH ═══
   Kho SP hay dùng, giữ lại để lấy nhanh cho các dự án sau (yêu cầu slide Update QS).
   Dấu yêu thích thuộc về CÔNG TY, lưu ở bảng riêng sp_yeu_thich nên đánh dấu được
   cả sản phẩm trong kho chung của Dezon (những SP đó không sửa được). */
function spKey_(p){ return String((p&&(p.recordId||p.ma))||''); }
// server trả {ok, errors} chứ không ném lỗi -> phải tự kiểm để còn hoàn tác dấu sao
function spFavChk_(r){
  if(r && r.ok===0 && r.errors && r.errors.length) throw new Error(r.errors[0].error);
  return r;
}
function spFavSet_(keys,on){        // cập nhật ngay tại chỗ để bảng phản hồi tức thì
  var m={}; keys.forEach(function(k){ m[k]=1; });
  (S.products||[]).forEach(function(p){ if(m[spKey_(p)]) p.yeuThich=!!on; });
}
async function spFav(i,on){
  var p=(S._spList||[])[i]; if(!p) return;
  var k=spKey_(p); if(!k) return;
  spFavSet_([k],on); spViewTabs_(); spFilter();          // lạc quan: đổi trước, có lỗi thì trả lại
  try{ spFavChk_(await api('setYeuThich',[k],!!on)); }
  catch(e){ spFavSet_([k],!on); spViewTabs_(); spFilter(); toast(e.message); return; }
  toast(on?'Đã thêm vào sản phẩm yêu thích':'Đã bỏ khỏi sản phẩm yêu thích');
}
async function spFavBulk(on){
  var prods=spSelProds_(); if(!prods.length) return;
  var keys=prods.map(spKey_).filter(Boolean);
  spFavSet_(keys,on); spViewTabs_(); spFilter();
  try{ spFavChk_(await api('setYeuThich',keys,!!on)); }
  catch(e){ spFavSet_(keys,!on); spViewTabs_(); spFilter(); toast(e.message); return; }
  toast('Đã lưu '+keys.length+' sản phẩm vào Yêu thích');
}
/* ═══ MỞ COMBO NGAY TRÊN DÒNG (bảng Danh sách SP) ═══ dùng chung kho dữ liệu với thư viện Bóc tách */
function spCbMo_(p){ return !!(S._catCbOpen && S._catCbOpen[catCbKey_(p)]); }
async function spComboToggle_(i){
  var p=(S._spList||[])[i]; if(!p) return;
  var k=catCbKey_(p); if(!k) return;
  S._catCbOpen=S._catCbOpen||{}; S._catCb=S._catCb||{};
  var mo=!S._catCbOpen[k];
  if(mo) S._catCbOpen[k]=1; else delete S._catCbOpen[k];
  spFilter();
  if(mo && !S._catCb[k]){
    try{ S._catCb[k]=await api('getCombo',k)||[]; }catch(e){ S._catCb[k]=[]; }
    if(S._catCbOpen[k]) spFilter();
  }
}
/* Nút ★ cạnh Bộ lọc = LỌC ngay trong panel, chỉ hiện SP đã đánh sao.
   Bấm lần nữa để bỏ lọc. Dùng chung trạng thái với chip trong Bộ lọc. */
function favGoSync_(){
  var b=document.getElementById('favGoBtn'), n=document.getElementById('favGoN'); if(!b) return;
  var so=(S.products||[]).filter(function(p){ return p.yeuThich; }).length;
  if(n) n.textContent=so||'';
  b.classList.toggle('empty',!so);
  b.classList.toggle('on',!!S.fFav);
  b.title=S.fFav ? 'Đang lọc sản phẩm yêu thích — bấm để bỏ lọc'
        : (so?('Chỉ hiện '+so+' sản phẩm yêu thích'):'Chưa có sản phẩm yêu thích nào');
}
/* ═══ TẢI DANH SÁCH SẢN PHẨM RA EXCEL ═══
   Có tick dòng nào -> chỉ tải đúng những dòng đó; không tick -> tải toàn bộ
   (theo bộ lọc đang áp dụng, không phải chỉ trang đang xem).                 */
function spXlsSync_(){
  var l=document.getElementById('spXlsLbl'); if(!l) return;
  var n=Object.keys(S._spSel||{}).length;
  l.textContent = n ? ('Tải Excel ('+n+')') : 'Tải Excel';
  var b=document.getElementById('spXlsBtn');
  var dv=spPTMode_()?'công tác':'sản phẩm';
  if(b) b.title = n ? ('Tải '+n+' '+dv+' đã chọn ra Excel') : 'Tải toàn bộ danh sách đang lọc ra Excel';
}
async function spExportXlsx(){
  var btn=document.getElementById('spXlsBtn'), lbl=document.getElementById('spXlsLbl');
  var chon=Object.keys(S._spSel||{});
  var keys = chon.length ? chon : (S._spFull||[]).map(function(p){ return String(p.recordId||p.ma||''); }).filter(Boolean);
  if(!keys.length){ toast('Không có sản phẩm nào để tải'); return; }
  var cu=lbl?lbl.textContent:'';
  if(btn) btn.disabled=true; if(lbl) lbl.textContent='Đang tạo file…';
  try{
    var r=await fetch('/export/san-pham',{ method:'POST',
      headers:{'Content-Type':'application/json','Authorization':'Bearer '+authToken()},
      body: JSON.stringify({ keys: keys }) });
    if(!r.ok){ var e=await r.json().catch(function(){return{};}); throw new Error(e.error||('HTTP '+r.status)); }
    var so=r.headers.get('X-Row-Count')||keys.length;
    var blob=await r.blob();
    var url=URL.createObjectURL(blob), a2=document.createElement('a');
    a2.href=url; a2.download='danh-sach-san-pham-'+new Date().toISOString().slice(0,10)+'.xlsx';
    document.body.appendChild(a2); a2.click(); a2.remove();
    setTimeout(function(){ URL.revokeObjectURL(url); },4000);
    toast('Đã tải '+so+' sản phẩm ra Excel');
  }catch(err){ toast('Lỗi tải Excel: '+err.message); }
  if(btn) btn.disabled=false; if(lbl) lbl.textContent=cu||'Tải Excel'; spXlsSync_();
}
function spSetView(v){ S._spView=v; S._spPage=1; spViewTabs_(); spFilter(); }
// Duyệt / bỏ duyệt 1 sản phẩm
async function spDuyet(i,approve){
  var p=(S._spList||[])[i]; if(!p) return;
  try{
    await api('setSpDuyet',[String(p.recordId||p.ma)],!!approve);
    p.daDuyet=!!approve; p.nguoiDuyet=approve?((S.me||{}).username||''):''; p.ngayDuyet=approve?new Date().toISOString():'';
    spViewTabs_(); spFilter();
    toast(approve?'Đã duyệt "'+(p.ten||p.ma)+'"':'Đã bỏ duyệt "'+(p.ten||p.ma)+'"');
  }catch(e){ toast('Lỗi: '+e.message.slice(0,110)); }
}
// Duyệt hàng loạt các sản phẩm đang chọn
async function spDuyetBulk(approve){
  var prods=spSelProds_().filter(function(p){ return !p.spChung; });
  if(!prods.length){ toast('Chưa chọn sản phẩm nào'); return; }
  try{
    var r=await api('setSpDuyet',prods.map(function(p){ return String(p.recordId||p.ma); }),!!approve);
    prods.forEach(function(p){ p.daDuyet=!!approve; });
    S.products=await api('getProducts')||S.products;
    spViewTabs_(); spFilter();
    toast((approve?'Đã duyệt ':'Đã bỏ duyệt ')+(r.ok||0)+' sản phẩm');
  }catch(e){ toast('Lỗi: '+e.message.slice(0,110)); }
}
function spEditBtnSync_(){
  var b=document.getElementById('spEditBtn'); if(!b) return;
  b.style.display = (spPTMode_()||spCanEdit_())?'':'none';
  b.classList.toggle('on',!!S._spEdit);
  b.innerHTML = S._spEdit ? (icon('check',14)+' Xong') : (icon('edit',14)+' Edit');
  b.title = S._spEdit ? 'Tắt chế độ sửa nhanh' : 'Sửa nhanh ngay trên bảng — hiện tất cả cột nhập liệu';
}
/* ═══ HOÀN TÁC (Ctrl+Z) ═══
   Mỗi thao tác SỬA đẩy 1 mục vào kho; 1 mục có thể gồm NHIỀU ô (sửa hàng loạt)
   nên bấm Ctrl+Z một lần là trả lại toàn bộ thao tác đó.
   Lưu ý: XOÁ sản phẩm KHÔNG hoàn tác được (đã có hộp xác nhận riêng).        */
function spUndoPush_(changes,label){
  if(!changes||!changes.length) return;
  S._undo=S._undo||[]; S._undo.push({items:changes,label:label||'sửa'});
  if(S._undo.length>50) S._undo.shift();
  spUndoBtnSync_();
}
function spUndoBtnSync_(){
  var b=document.getElementById('spUndoBtn'); if(!b) return;
  var n=(S._undo||[]).length;
  b.disabled=!n;
  b.title=n?('Hoàn tác: '+S._undo[n-1].label+' (Ctrl+Z) — còn '+n+' bước'):'Chưa có thao tác nào để hoàn tác';
}
async function spUndo_(){
  var st=S._undo||[];
  if(!st.length){ toast('Không còn thao tác nào để hoàn tác'); return; }
  var step=st.pop(); spUndoBtnSync_();
  var ok=0, err='';
  for(var i=0;i<step.items.length;i++){
    var it=step.items[i];
    try{
      var d={}; if(it.lark!=='MÃ SẢN PHẨM') d['MÃ SẢN PHẨM']=it.ma;
      d[it.lark]=it.old;
      await api('updateDbProductTracked', String(it.key), d);
      var p=(S.products||[]).filter(function(x){ return String(x.recordId||x.ma||'')===String(it.key); })[0];
      if(p) spPatchLocal_(p, it.lark, it.col, it.old);
      ok++;
    }catch(e){ if(!err) err=e.message; }
  }
  spFilter();
  if(ok && !err) toast('↶ Đã hoàn tác: '+step.label);
  else if(ok) toast('Hoàn tác '+ok+'/'+step.items.length+' — lỗi: '+err.slice(0,70));
  else { st.push(step); spUndoBtnSync_(); toast('Không hoàn tác được: '+err.slice(0,90)); }
}
// Ctrl+Z / Cmd+Z — chỉ bắt khi KHÔNG đang gõ trong ô nhập (để trình duyệt lo undo chữ)
document.addEventListener('keydown', function(e){
  if(!(e.key==='z'||e.key==='Z') || !(e.ctrlKey||e.metaKey) || e.shiftKey) return;
  var v=document.getElementById('v-sanpham'); if(!v||!v.classList.contains('on')) return;
  var a=document.activeElement, tag=a?a.tagName:'';
  if(tag==='INPUT'||tag==='TEXTAREA'||tag==='SELECT'||(a&&a.isContentEditable)) return;
  e.preventDefault(); spUndo_();
});
async function spInlineSave(el){
  var i=+el.getAttribute('data-i'), lark=el.getAttribute('data-lark'), col=el.getAttribute('data-col')||'';
  var p=(S._spList||[])[i]; if(!p) return;
  var isMoney=el.getAttribute('data-money')==='1';
  var v=String(el.value).trim();
  if(isMoney) v=v.replace(/[^\d]/g,'');                                  // "930.000 đ" -> "930000"
  var shown=isMoney?(v===''?'':money(v)):v;
  var old=el.getAttribute('data-old');
  if(old!=null && old===shown){ if(isMoney) el.value=shown; return; }     // không đổi thì khỏi gọi server
  var oldRaw=(col && p.raw && p.raw[col]!=null) ? String(p.raw[col]) : (isMoney?String(old||'').replace(/[^\d]/g,''):String(old||''));
  el.classList.remove('err','ok'); el.classList.add('saving');
  var d={};
  if(lark!=='MÃ SẢN PHẨM') d['MÃ SẢN PHẨM']=p.ma;                        // khoá tra cứu, trừ khi đang sửa chính nó
  d[lark]=v;                                                             // ghi ĐÚNG giá trị gốc người dùng gõ
  try{
    var res=await api('updateDbProductTracked', String(p.recordId||p.ma), d);
    el.classList.remove('saving'); el.classList.add('ok');

    spUndoPush_([{key:String(p.recordId||p.ma), ma:p.ma, lark:lark, col:col, old:oldRaw}],
      lark+' của "'+(p.ten||p.ma||'')+'"');
    el.setAttribute('data-old', shown); if(isMoney) el.value=shown;
    spPatchLocal_(p, lark, col, v);
    if(res && res.daDuyet===false && p.daDuyet){    // sửa nội dung -> phải duyệt lại
      p.daDuyet=false; p.nguoiDuyet=''; p.ngayDuyet='';
      spViewTabs_();
    }
    spSyncRow_(el, p);
    setTimeout(function(){ el.classList.remove('ok'); }, 1300);
  }catch(e){
    el.classList.remove('saving'); el.classList.add('err');
    toast('Lỗi lưu: '+e.message.slice(0,110));
  }
}
// Cập nhật object sản phẩm trong bộ nhớ (S._spList dùng CHUNG tham chiếu với S.products)
var SP_DISPUNIT={cong_suat_w:'W', nhiet_do_mau_k:'K', goc_chieu_deg:'°', goc_nghieng_deg:'°'};
function spPatchLocal_(p,lark,col,v){
  if(col){ p.raw=p.raw||{}; p.raw[col]=v; }
  var prop=COL2PROP[col];
  if(prop) p[prop]=SP_DISPUNIT[col]?spAddUnit_(v,SP_DISPUNIT[col]):v;
  if(col==='ten_sp') p.ten=v;
  else if(col==='ma_sp') p.ma=v;
  else if(col==='gia_ban_le') p.giaBanLe=Number(v)||0;
  else if(col==='ck_dai_ly_pct') p.ckDaiLy=Number(v)||0;
  // GIÁ ĐẠI LÝ là cột generated trong DB: round(giá bán lẻ × (1 − CK/100)) — tính lại y hệt để hiện ngay
  p.donGiaBan=Math.round((Number(p.giaBanLe)||0)*(1-(Number(p.ckDaiLy)||0)/100));
  p.donGiaVon=p.donGiaBan;
}
// Vẽ lại các ô CHỈ ĐỌC của đúng dòng vừa sửa — giữ nguyên con trỏ đang gõ
function spSyncRow_(el,p){
  var tr=el.closest('tr'); if(!tr) return;
  var i=+el.getAttribute('data-i');
  spVisCols_().forEach(function(c,k){
    if(c[0]!=='giaDaiLy' && c[0]!=='duyet') return;   // 2 cột này phụ thuộc ô vừa sửa
    var td=tr.children[k+1]; if(td) td.innerHTML=c[3](p,i);   // +1: bỏ qua cột chọn
  });
}
/* Đóng băng kiểu Excel: cột chọn + 2 cột đầu bám trái, hàng tiêu đề bám trên.
   Bề rộng cột thay đổi theo dữ liệu nên phải ĐO rồi gán left sau mỗi lần vẽ.  */
var SP_FRZ=3;                       // số CỘT DỮ LIỆU được cố định (chưa kể cột chọn) — STT · Ảnh · Sản phẩm
function spFreeze_(){
  var head=document.getElementById('spHead'), body=document.getElementById('spBody');
  if(!head||!body) return;
  var hr=head.querySelector('tr'); if(!hr) return;
  var n=Math.min(SP_FRZ+1, hr.children.length);          // +1: cột chọn
  var left=0, offs=[];
  for(var k=0;k<n;k++){ offs.push(left); left+=hr.children[k].getBoundingClientRect().width; }
  var rows=[hr].concat([].slice.call(body.rows));
  rows.forEach(function(tr){
    if(tr.children.length<n) return;                     // dòng "không có sản phẩm" (colspan)
    for(var k=0;k<n;k++){
      var c=tr.children[k];
      c.classList.add('frz'); c.style.left=offs[k]+'px';
      c.classList.toggle('frz-last', k===n-1);
    }
  });
  var wrap=body.closest('.tbl-wrap');
  if(wrap && !wrap._frzBound){                            // đổ bóng khi đã cuộn ngang
    wrap._frzBound=1;
    wrap.addEventListener('scroll',function(){
      wrap.classList.toggle('xscroll', wrap.scrollLeft>0);      // đã cuộn ngang -> đổ bóng cột đóng băng
      wrap.classList.toggle('yscroll', wrap.scrollTop>0);       // đã cuộn dọc  -> đổ bóng dưới tiêu đề
    },{passive:true});
    window.addEventListener('resize',function(){ clearTimeout(wrap._frzT); wrap._frzT=setTimeout(spFreeze_,120); });
  }
}
/* ═══ PHÂN TRANG ═══ */
var SP_PER=[25,50,100,200,0];                       // 0 = xem tất cả
function spPerGet_(){
  if(S._spPer===undefined){ var v=null; try{ v=localStorage.getItem('qs_spPer'); }catch(e){}
    S._spPer = (v===null||v==='') ? 50 : Number(v); }
  return S._spPer;
}
function spSetPer(v){ S._spPer=Number(v); try{ localStorage.setItem('qs_spPer',String(S._spPer)); }catch(e){}
  S._spPage=1; spFilter(); }
function spGoPage(n){ S._spPage=n; spFilter();
  var w=document.querySelector('.sp-card .tbl-wrap'); if(w) w.scrollTop=0; }
function spPageNums_(cur,pages){
  var out=[], add=function(x){ if(out[out.length-1]!==x) out.push(x); };
  add(1);
  for(var i=cur-2;i<=cur+2;i++) if(i>1&&i<pages) { if(i>2&&out[out.length-1]===1&&i-1>1) add('…'); add(i); }
  if(pages>1){ if(out[out.length-1]!=='…' && out[out.length-1]<pages-1) add('…'); add(pages); }
  return out;
}
/* total = số DÒNG đại diện (mỗi nhóm biến thể chỉ 1 dòng) — phân trang đếm theo đây;
   totalSP = tổng số sản phẩm thật, để câu "…/ N sản phẩm" vẫn đúng.                    */
function spPager_(total,cur,pages,per,totalSP){
  var el=document.getElementById('spPager'); if(!el) return;
  var from=total?((cur-1)*(per||total)+1):0, to=per?Math.min(total,cur*per):total;
  var sel='<select class="sppg-per" onchange="spSetPer(this.value)">'+SP_PER.map(function(v){
    return '<option value="'+v+'"'+(v===per?' selected':'')+'>'+(v?v+' SP/trang':'Tất cả')+'</option>'; }).join('')+'</select>';
  var nav='';
  if(pages>1){
    nav='<button class="sppg-b" '+(cur<=1?'disabled':'')+' onclick="spGoPage('+(cur-1)+')" title="Trang trước">'+icon('left',14)+'</button>'
      + spPageNums_(cur,pages).map(function(n){
          return n==='…' ? '<span class="sppg-dots">…</span>'
            : '<button class="sppg-n'+(n===cur?' on':'')+'" onclick="spGoPage('+n+')">'+n+'</button>'; }).join('')
      + '<button class="sppg-b" '+(cur>=pages?'disabled':'')+' onclick="spGoPage('+(cur+1)+')" title="Trang sau">'
        +'<svg class="ico" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18l6-6-6-6"/></svg></button>';
  }
  var nSP=(totalSP==null?total:totalSP);
  var info=(nSP===total)?(total+' sản phẩm'):(total+' dòng · '+nSP+' sản phẩm');
  el.innerHTML='<div class="sppg"><span class="sppg-info">'+(total?('Hiện <b>'+from+'–'+to+'</b> / '+info):'Không có sản phẩm')+'</span>'
    +'<span class="sppg-nav">'+nav+'</span>'+sel+'</div>';
}
/* ═══ THỨ TỰ + ĐỘ RỘNG CỘT (kéo giãn, kéo đổi chỗ — giống bảng Bóc tách) ═══ */
var SP_DEFW={stt:52,thumb:56,ten:215,duyet:124,sku:78,giaDaiLy:122,nguoiTao:126,ngayTao:104,nguoiSua:130,gia_ban_bo_nguon:130,
  thuong_hieu:126,nha_cung_cap:170,hang_muc:130,dong_sp:130,nhom_sp:130,
  gia_ban_le:118,ck_dai_ly_pct:106,cong_suat_w:96,nhiet_do_mau_k:112,goc_chieu_deg:96,
  goc_nghieng_deg:106,mau_sac:106,chat_lieu:126,chieu_cao_mm:98,duong_kinh_mm:104,
  quang_thong_lm:110,chi_so_ip:98,cri:88,hieu_suat_lm_w:126,ugr:80,sdcm:80,coi:80,
  tuoi_tho:104,ten_chip_led:126,loai_chip_led:110,lap_nguon_roi:108,ten_bo_nguon:134,
  ma_bo_nguon:120,hang_bo_nguon:134,vi_tri_lap_nguon:134,dieu_khien:140,
  dong_ra_max_ma:116,cutout_mm:134,class_rating:116,bao_hanh_nam:104,dvt:88,
  trang_thai:126,link_datasheet:112,ghi_chu:170};
function spColW_(k){ if(spPTMode_()) return (S._ptW2&&S._ptW2[k])||PT_SPDEFW[k]||124;
  return (S._spW&&S._spW[k])||SP_DEFW[k]||124; }
/* Bộ cột hiện mặc định theo NGÀNH: đèn thì công suất/nhiệt độ/CRI/góc chiếu,
   vệ sinh thì kích thước/hệ thống xả/lượng nước xả/màu — và nhớ riêng cho từng ngành. */
function spColsDefault_(ng){
  var b={thumb:1,ten:1,duyet:1,sku:1,thuong_hieu:1,hang_muc:1,giaDaiLy:1};
  if(ng==='vs'){ b.kich_thuoc=1; b.mau_sac=1; b.kieu_lap_dat=1; b.he_thong_xa=1; return b; }
  b.cong_suat_w=1; b.nhiet_do_mau_k=1; b.cri=1; b.goc_chieu_deg=1; return b;
}
function spColsSync_(){
  if(spPTMode_()) return;
  var ng=(spNganhCur_()==='vs')?'vs':'den';
  if(S._spColsNganh===ng && S._spCols) return;
  S._spColsNganh=ng;
  var luu=null;
  try{ var j=JSON.parse(localStorage.getItem('qs_spcolcfg')||'{}'); luu=(ng==='vs')?j.onVs:j.on; }catch(e){}
  S._spCols=(luu&&Object.keys(luu).length)?luu:spColsDefault_(ng);
}
function spOrder_(){
  if(spPTMode_()) return ptOrder2_();
  spColsSync_();
  var all=spAllCols_().map(function(c){ return c[0]; });
  if(!S._spOrder){
    try{ var j=JSON.parse(localStorage.getItem('qs_spcolcfg')||'{}'); S._spOrder=j.order||null; S._spW=j.w||{}; }
    catch(e){ S._spW={}; }
    if(!S._spOrder) S._spOrder=all.slice();
  }
  var co={}; S._spOrder.forEach(function(k){ co[k]=1; });
  // Cột mới nối vào cuối, RIÊNG stt phải nằm đầu bảng — người dùng đã lưu thứ tự cột
  // từ trước (chưa có stt) nên nếu cứ nối đuôi thì số thứ tự rơi ra tận cột cuối.
  all.forEach(function(k){ if(!co[k]){ if(k==='stt') S._spOrder.unshift(k); else S._spOrder.push(k); } });
  S._spOrder=S._spOrder.filter(function(k){ return all.indexOf(k)>=0; }); // bỏ cột đã xoá
  return S._spOrder;
}
function spSaveCols_(){
  try{
    if(spPTMode_()) localStorage.setItem('qs_ptcolcfg',JSON.stringify({order:S._ptOrder2,w:S._ptW2||{},on:S._ptColsOn||{}}));
    else {
      var j={}; try{ j=JSON.parse(localStorage.getItem('qs_spcolcfg')||'{}')||{}; }catch(e2){}
      j.order=S._spOrder; j.w=S._spW||{};
      if(S._spColsNganh==='vs') j.onVs=S._spCols||{}; else j.on=S._spCols||{};
      localStorage.setItem('qs_spcolcfg',JSON.stringify(j));
    }
  }catch(e){}
}
// thứ tự + độ rộng + cột hiện của BẢNG CÔNG TÁC (lưu riêng, không đụng cấu hình cột SP)
function ptOrder2_(){
  var all=spPTCols_().map(function(c){ return c[0]; });
  if(!S._ptOrder2){
    var j=null; try{ j=JSON.parse(localStorage.getItem('qs_ptcolcfg')||'null'); }catch(e){}
    S._ptOrder2=(j&&j.order)||null; S._ptW2=(j&&j.w)||{}; S._ptColsOn=(j&&j.on)||null;
    if(!S._ptOrder2) S._ptOrder2=all.slice();
    if(!S._ptColsOn){ S._ptColsOn={}; ['thumb','duyet','loai','nhom','dvt','kl','dgnt','dg','gc'].forEach(function(k){ S._ptColsOn[k]=1; }); }
  }
  var co={}; S._ptOrder2.forEach(function(k){ co[k]=1; });
  all.forEach(function(k){ if(!co[k]){ if(k==='stt') S._ptOrder2.unshift(k); else S._ptOrder2.push(k); } });
  S._ptOrder2=S._ptOrder2.filter(function(k){ return all.indexOf(k)>=0; });
  return S._ptOrder2;
}
function spResetCols_(){
  if(spPTMode_()){ S._ptOrder2=null; S._ptW2={}; S._ptColsOn=null; try{ localStorage.removeItem('qs_ptcolcfg'); }catch(e){}
    ptOrder2_(); spColChips_(); spRenderHead_(); spFilter(); toast('Đã đặt lại cột bảng công tác'); return; }
  S._spOrder=null; S._spW={}; S._spCols=null; S._spColsNganh=null;
  try{ localStorage.removeItem('qs_spcolcfg'); }catch(e){}
  spColsSync_();
  spOrder_(); spColChips_(); spRenderHead_(); spFilter(); toast('Đã đặt lại cột bảng sản phẩm'); }
/* Nội dung dài hơn bề rộng cột -> khi bấm vào ô, ô tự nới rộng đè lên cột bên cạnh
   để đọc và sửa trọn vẹn; rời ô là thu lại như cũ.                              */
function spInpFocus_(e){
  var el=e.target; if(!el.classList||!el.classList.contains('spin')) return;
  if(el.scrollWidth<=el.clientWidth+2) return;              // nội dung đã vừa ô
  var td=el.closest('td'); if(!td) return;
  td._ovf=td.style.overflow; td._pos=td.style.position; td._z=td.style.zIndex;
  td.style.overflow='visible'; td.style.position='relative'; td.style.zIndex='12';
  el.classList.add('spin-wide');
  el.style.width=Math.min(el.scrollWidth+28, 460)+'px';
}
function spInpBlur_(e){
  var el=e.target; if(!el.classList||!el.classList.contains('spin')) return;
  el.classList.remove('spin-wide'); el.style.width='';
  var td=el.closest('td'); if(!td) return;
  td.style.overflow=td._ovf||''; td.style.position=td._pos||''; td.style.zIndex=td._z||'';
}
function spMoveCol_(from,to,before){
  var o=spOrder_().slice(), fi=o.indexOf(from); if(fi<0) return;
  o.splice(fi,1); var ti=o.indexOf(to); if(ti<0) ti=o.length;
  o.splice(before?ti:ti+1,0,from);
  if(spPTMode_()) S._ptOrder2=o; else S._spOrder=o;
  spSaveCols_(); spColChips_(); spRenderHead_(); spFilter();
}
// gắn 1 lần: kéo tiêu đề để đổi chỗ, kéo mép phải để giãn cột
function spInitCols_(){
  var t=document.querySelector('.sp-card .sp-table'); if(!t||t._colInit) return; t._colInit=1;
  t.addEventListener('focusin',spInpFocus_); t.addEventListener('focusout',spInpBlur_);
  var clr=function(){ t.querySelectorAll('.dropL,.dropR').forEach(function(x){ x.classList.remove('dropL','dropR'); }); };
  t.addEventListener('dragstart',function(e){
    var th=e.target.closest('th.spth'); if(!th) return;
    if(e.target.closest('.spthrsz')){ e.preventDefault(); return; }
    S._spDragCol=th.dataset.k; th.classList.add('dragging');
    try{ e.dataTransfer.setData('text/plain',th.dataset.k); }catch(x){}
  });
  t.addEventListener('dragend',function(){ t.querySelectorAll('.dragging').forEach(function(x){ x.classList.remove('dragging'); }); clr(); S._spDragCol=null; });
  t.addEventListener('dragover',function(e){
    if(!S._spDragCol) return;
    var th=e.target.closest('th.spth'); if(!th) return;
    e.preventDefault(); clr();
    var r=th.getBoundingClientRect(); th.classList.add(e.clientX<r.left+r.width/2?'dropL':'dropR');
  });
  t.addEventListener('drop',function(e){
    if(!S._spDragCol) return; e.preventDefault();
    var th=e.target.closest('th.spth');
    if(th && th.dataset.k!==S._spDragCol){ var r=th.getBoundingClientRect(); spMoveCol_(S._spDragCol,th.dataset.k,e.clientX<r.left+r.width/2); }
    S._spDragCol=null; clr();
  });
  t.addEventListener('mousedown',function(e){
    var rs=e.target.closest('.spthrsz'); if(!rs) return;
    e.preventDefault(); e.stopPropagation();
    var k=rs.dataset.k, sx=e.clientX, sw=spColW_(k);
    document.body.classList.add('col-resizing');
    function mv(ev){ var w=Math.max(56, sw+(ev.clientX-sx));
      if(spPTMode_()){ S._ptW2=S._ptW2||{}; S._ptW2[k]=w; } else { S._spW=S._spW||{}; S._spW[k]=w; }
      spRenderHead_(); spFreeze_(); }
    function up(){ document.removeEventListener('mousemove',mv); document.removeEventListener('mouseup',up);
      document.body.classList.remove('col-resizing'); spSaveCols_(); }
    document.addEventListener('mousemove',mv); document.addEventListener('mouseup',up);
  });
}
function spColOn_(k){
  if(k==='ten'||k==='stt') return true;
  if(spPTMode_()){ ptOrder2_(); return !!(S._ptColsOn&&S._ptColsOn[k]); }
  return !!(S._spCols&&S._spCols[k]);
}
function spThCls_(c){ var cl=c[2]||''; if(cl.indexOf('num')>=0)return 'num'; if(cl.indexOf('ct')>=0)return 'ct'; if(cl.indexOf('thumbcol')>=0)return 'thumbcol'; return ''; }
function spVisCols_(){
  var by={}; spAllCols_().forEach(function(c){ by[c[0]]=c; });
  return spOrder_().map(function(k){ return by[k]; }).filter(function(c){ return c && spColOn_(c[0]); });
}
function spColToggle(k){
  if(k==='ten'||k==='stt') return;
  if(spPTMode_()){ ptOrder2_(); S._ptColsOn[k]=!S._ptColsOn[k]; }
  else { S._spCols=S._spCols||{}; S._spCols[k]=!S._spCols[k]; }
  spSaveCols_();                       // cả 2 hạng mục đều nhớ cột đang bật/tắt
  spColChips_(); spRenderHead_(); spFilter();
}
/* Chọn cột: gom vào 1 nút + bảng chọn thả xuống (trước đây trải 3 hàng chip
   chiếm gần hết phần đầu bảng và át cả dữ liệu).                            */
function spColList_(){
  var by={}; spAllCols_().forEach(function(c){ by[c[0]]=c; });
  return spOrder_().map(function(k){ return by[k]; }).filter(Boolean);
}
function spColChips_(){
  var cols=spColList_(), on=cols.filter(function(c){ return spColOn_(c[0]); }).length;
  var bar=document.getElementById('spColBar');
  if(bar) bar.innerHTML='<span class="cp-collbl">Cột hiển thị</span>'+cols.filter(function(c){ return c[0]!=='stt'&&c[0]!=='ten'; })
    .map(function(c){ return '<span class="chip'+(spColOn_(c[0])?' on':'')+'" onclick="spColToggle(\''+c[0]+'\')">'+esc(c[1])+'</span>'; }).join('');
  var n=document.getElementById('spColN'); if(n) n.textContent=on+'/'+cols.length;
  if(document.getElementById('spColPop')) spColPopRender_();
}
function spColPop_(e){
  if(e&&e.stopPropagation) e.stopPropagation();
  var old=document.getElementById('spColPop');
  if(old){ old.remove(); document.removeEventListener('mousedown',spColOutside_); return; }
  var pop=document.createElement('div'); pop.className='fltpop colpop'; pop.id='spColPop';
  document.body.appendChild(pop); spColPopRender_();
  var btn=document.getElementById('spColBtn');
  if(btn){ var r=btn.getBoundingClientRect(), w=pop.offsetWidth||300;
    pop.style.top=(r.bottom+6)+'px';
    pop.style.left=Math.max(8,Math.min(r.left, window.innerWidth-w-10))+'px'; }
  setTimeout(function(){ document.addEventListener('mousedown',spColOutside_); },0);
  var q=document.getElementById('spColQ'); if(q) q.focus();
}
function spColOutside_(e){
  if(e.target.closest('#spColPop')||e.target.closest('#spColBtn')) return;
  var p=document.getElementById('spColPop'); if(p) p.remove();
  document.removeEventListener('mousedown',spColOutside_);
}
function spColPopRender_(){
  var pop=document.getElementById('spColPop'); if(!pop) return;
  var q=spNorm_((document.getElementById('spColQ')||{}).value||'');
  var cols=spColList_(), on=cols.filter(function(c){ return spColOn_(c[0]); }).length;
  var list=cols.filter(function(c){ return !q || spNorm_(c[1]).indexOf(q)>=0; });
  pop.innerHTML='<div class="colpop-h"><b>Cột hiển thị</b><span class="colpop-n">'+on+'/'+cols.length+'</span>'
      +'<button class="colpop-x" onclick="spColPop_()">✕</button></div>'
    +'<div class="colpop-s"><input id="spColQ" placeholder="Tìm cột…" value="'+esc((document.getElementById('spColQ')||{}).value||'')+'" oninput="spColPopRender_()"></div>'
    +'<div class="colpop-b">'+(list.length?list.map(function(c){
        var lock=c[0]==='ten'||c[0]==='stt', act=spColOn_(c[0]);
        return '<label class="colpop-i'+(lock?' lock':'')+'">'
          +'<input type="checkbox" '+(act?'checked':'')+(lock?' disabled':'')+' onchange="spColToggle(\''+c[0]+'\')">'
          +'<span>'+esc(c[1])+'</span>'+(lock?'<i>luôn hiện</i>':'')+'</label>';
      }).join(''):'<div class="colpop-empty">Không có cột nào khớp</div>')+'</div>'
    +'<div class="colpop-f"><button class="btn ghost xs" onclick="spResetCols_()">Đặt lại thứ tự & độ rộng</button>'
      +'<button class="btn ghost xs" onclick="spColAll_(1)">Hiện tất cả</button>'
      +'<button class="btn ghost xs" onclick="spColAll_(0)">Ẩn bớt</button></div>';
  var i=document.getElementById('spColQ'); if(i&&document.activeElement!==i) i.value=(q?i.value:i.value);
}
function spColAll_(on){
  spColList_().forEach(function(c){
    if(c[0]==='ten'||c[0]==='stt') return;
    if(spPTMode_()){ ptOrder2_(); S._ptColsOn[c[0]]=!!on; }
    else { S._spCols=S._spCols||{}; S._spCols[c[0]]=!!on; }
  });
  spSaveCols_(); spColChips_(); spRenderHead_(); spFilter();
}
/* Đặt lại cột: xoá luôn phần đã lưu để lần sau mở trang về đúng mặc định */
function spRenderHead_(){
  var head=document.getElementById('spHead'); if(!head) return;
  var vis=spVisCols_(), ACT=150, SEL=38;
  var cg=document.getElementById('spColg');
  if(cg) cg.innerHTML='<col style="width:'+SEL+'px">'
    +vis.map(function(c){ return '<col style="width:'+spColW_(c[0])+'px">'; }).join('')
    +'<col style="width:'+ACT+'px">';
  head.innerHTML='<tr><th class="selcol"><input type="checkbox" class="spck" id="spCkAll" onclick="spSelAll(this.checked)"></th>'
    +vis.map(function(c){
      return '<th class="'+spThCls_(c)+' spth" data-k="'+esc(c[0])+'" draggable="true" title="Kéo để đổi chỗ cột · kéo mép phải để giãn">'
        +esc(c[1])+'<span class="spthrsz" data-k="'+esc(c[0])+'"></span></th>'; }).join('')
    +'<th class="act-sp"></th></tr>';
  var tb=head.closest('table');
  if(tb){ var total=SEL+ACT; vis.forEach(function(c){ total+=spColW_(c[0]); });
    tb.style.tableLayout='fixed'; tb.style.width=total+'px'; }
  spInitCols_();
}
// Thanh chip "Hạng mục đã bóc" = nhóm/dòng SP (giống bộ chọn hạng mục bên Bóc tách)
// chuẩn hoá tên (gộp trùng hoa/thường + khoảng trắng)
function spNorm_(s){ return String(s||'').trim().toLowerCase().replace(/\s+/g,' '); }
// map sản phẩm -> node cây đề mục qua "muc" (vd "Thiết bị đèn" -> 3.2.6.1)
function spNodeCodeOf_(p){ var muc=(p&&p.muc)||''; for(var i=0;i<TREE.length;i++){ if(TREE[i][1]===muc) return TREE[i][0]; } return ''; }
function spNodeCount_(code){ if(!code) return (S.products||[]).length;
  if(code==='3.1') return spPTAll_().length;           // Phần thô đếm theo thư viện công tác

  return (S.products||[]).filter(function(p){ var c=spNodeCodeOf_(p); return c===code || c.indexOf(code+'.')===0; }).length; }
function renderSpChips_(){
  if(spPTMode_()) return spPTChips_();
  var bar=document.getElementById('spBar'); if(!bar) return; var f=S._spFilters||{};
  var total=(S.products||[]).length;
  var label = f.node ? (f.node+'.'+nodeName(f.node)) : 'Tất cả hạng mục';
  var cnt = f.node ? spNodeCount_(f.node) : total;
  var scope=spScopeProducts_();
  // options trong phạm vi hạng mục đang chọn (gộp trùng hoa/thường)
  function optList(field){ var m={}; scope.forEach(function(p){ if(p[field]) m[spNorm_(p[field])]=p[field]; });
    return Object.keys(m).sort(function(a,b){ return m[a].localeCompare(m[b],'vi'); }).map(function(k){ return m[k]; }); }
  function fsel(key,lb,field,ph){ var opts=optList(field), cur=f[key]||'';
    return '<div class="sp-fcol"><label>'+lb+'</label><select class="sp-fsel" onchange="spSelFilter(\''+key+'\',this.value)">'
      +'<option value="">'+ph+'</option>'
      +opts.map(function(v){ return '<option value="'+esc(v)+'"'+(spNorm_(cur)===spNorm_(v)?' selected':'')+'>'+esc(v)+'</option>'; }).join('')+'</select></div>'; }
  // hàng lọc: cây Hạng mục + 3 dropdown (Thương hiệu / Hạng mục SP / Dòng SP)  — bám mockup
  // Hàng lọc chỉ giữ thứ quyết định phạm vi (đề mục) + các bộ lọc ĐANG bật.
  // Ba dropdown thương hiệu / hạng mục SP / dòng SP nằm trong nút "Bộ lọc" cho gọn.
  function fchip(key,lb,val){
    return '<span class="fltag" title="'+esc(lb)+'"><i>'+esc(lb)+'</i>'+esc(val)
      +'<b onclick="spSelFilter(\''+key+'\',\'\')" title="Bỏ lọc này">✕</b></span>';
  }
  var tags='';
  if(f.brand)   tags+=fchip('brand','Thương hiệu',f.brand);
  if(f.hangMuc) tags+=fchip('hangMuc','Hạng mục SP',f.hangMuc);
  if(f.dong)    tags+=fchip('dong','Dòng SP',f.dong);
  var treeCol='<div class="sp-scope"><button class="tree-btn sp-catbtn" id="spCatBtn" onclick="spCatToggle(event)">'
      +'<span class="sp-catlbl">'+esc(label)+'</span><span class="cnt">'+cnt+'</span><span class="sp-caret">▾</span></button>'
      +'<div class="tree-pop" id="spCatPop" style="display:none"></div></div>';
  bar.innerHTML='<div class="sp-filtrow">'+treeCol
    +(tags?('<div class="fltags">'+tags+'</div>'):'')
    +(spAnyFilter_()?'<button class="btn ghost xs sp-clrflt" onclick="spClearFilters()">Xoá lọc</button>':'')
    +'</div>';
  S._spFselHtml=fsel('brand','Thương hiệu','thuongHieu','Tất cả thương hiệu')
    +fsel('hangMuc','Hạng mục sản phẩm','hangMuc','Tất cả hạng mục SP')
    +fsel('dong','Dòng sản phẩm','nhom','Tất cả dòng SP');
  var badge=document.getElementById('spFltBadge'); var n=spFltCount_();
  if(badge){ badge.textContent=n||''; badge.style.display=n?'inline-flex':'none'; }
  var btn=document.getElementById('spBoLocBtn'); if(btn) btn.classList.toggle('on', n>0);
}
function spSelFilter(key,val){
  S._spFilters=S._spFilters||{}; if(!val) delete S._spFilters[key]; else S._spFilters[key]=val;
  S._spPage=1; renderSpChips_(); spFilter();
  if(document.getElementById('spFltPop')) spBoLocPop_();     // popover đang mở thì cập nhật theo
}
// chip "Dòng SP" — gộp nhom (đã chuẩn hoá) trong phạm vi hạng mục đang chọn
function spDongChips_(){
  var scope=spScopeProducts_(), map={};
  scope.forEach(function(p){ if(!p.nhom) return; var k=spNorm_(p.nhom); if(!map[k]) map[k]={count:0,labels:{}}; map[k].count++; map[k].labels[p.nhom]=(map[k].labels[p.nhom]||0)+1; });
  Object.keys(map).forEach(function(k){ var lb=map[k].labels,best='',bc=-1; Object.keys(lb).forEach(function(v){ if(lb[v]>bc){bc=lb[v];best=v;} }); map[k].label=best; });
  var keys=Object.keys(map).sort(function(a,b){ return map[a].label.localeCompare(map[b].label,'vi'); });
  if(!keys.length) return '';
  var f=S._spFilters||{}, fk=f.dong?spNorm_(f.dong):'';
  function esq(s){ return esc(s).replace(/'/g,"\\'"); }
  return '<div class="sp-dongrow"><span class="lb">Dòng SP</span>'
    +'<span class="chip'+(!f.dong?' on':'')+'" onclick="spSetDong(\'\')">Tất cả</span>'
    +keys.map(function(k){ return '<span class="chip'+(fk===k?' on':'')+'" onclick="spSetDong(\''+esq(map[k].label)+'\')">'+esc(map[k].label)+'<b class="cc">'+map[k].count+'</b></span>'; }).join('')+'</div>';
}
function spSetDong(label){ S._spFilters=S._spFilters||{}; if(!label) delete S._spFilters.dong; else S._spFilters.dong=label; renderSpChips_(); spFilter(); }
function spCatToggle(e){ if(e&&e.stopPropagation)e.stopPropagation();
  var pop=document.getElementById('spCatPop'); if(!pop) return;
  if(pop.style.display==='block'){ pop.style.display='none'; document.removeEventListener('mousedown',spCatOutside); return; }
  var f=S._spFilters||{}, total=(S.products||[]).length;
  var html='<div class="tnode lvl1'+(!f.node?' on':'')+'" onclick="spCatPickNode(\'\')"><span class="nm">Tất cả hạng mục</span><span class="cn">['+pad2(total)+']</span><span class="rd"></span></div>'
    +TREE.filter(function(t){return t[0]!=='X';}).map(function(t){ var c=spNodeCount_(t[0]);
      return '<div class="tnode lvl'+t[2]+(f.node===t[0]?' on':'')+'" onclick="spCatPickNode(\''+t[0]+'\')"><span class="nm">'+esc(t[0]+'.'+t[1])+'</span><span class="cn">['+pad2(c)+']</span><span class="rd"></span></div>'; }).join('');
  pop.innerHTML=html; pop.style.display='block';
  setTimeout(function(){ document.addEventListener('mousedown',spCatOutside); },0);
}
function spCatOutside(e){ if(!e.target.closest('#spCatPop') && !e.target.closest('#spCatBtn')){ var p=document.getElementById('spCatPop'); if(p)p.style.display='none'; document.removeEventListener('mousedown',spCatOutside); } }
function spCatPickNode(code){
  // đổi hạng mục -> reset bộ lọc nâng cao cho tương ứng phạm vi hạng mục mới
  S._spFilters={watt:{},kelvin:{},angle:{},cri:{}}; if(code) S._spFilters.node=code;
  var p=document.getElementById('spCatPop'); if(p)p.style.display='none'; document.removeEventListener('mousedown',spCatOutside);
  S._spPage=1; S._spSel={};
  hmSet_(code,'sp');                                    // đồng bộ sang các tab khác
  renderSpChips_(); spViewTabs_(); spFilter();          // Phần thô đổi cả tab lọc lẫn bảng
  if(document.getElementById('spFltPop')) spBoLocPop_();
}
function spSetFilter(key,val){ S._spFilters=S._spFilters||{}; if(!val) delete S._spFilters[key]; else if(S._spFilters[key]===val) delete S._spFilters[key]; else S._spFilters[key]=val; renderSpChips_(); spFilter(); }
function spClearFilters(){
  var node=(S._spFilters||{}).node;
  S._spFilters={watt:{},kelvin:{},angle:{},cri:{}}; if(node) S._spFilters.node=node;
  renderSpChips_(); spFilter(); if(document.getElementById('spFltPop')) spBoLocPop_();
}
// đếm số điều kiện "bộ lọc nâng cao" đang bật (không tính chip Hạng mục hiển thị sẵn)
function actKeys_(o){ return Object.keys(o||{}).filter(function(k){ return o[k]; }); }
function spFltCount_(){ if(spPTMode_()) return ptFltCount_();
  var f=S._spFilters||{}; var n=0; if(f.min)n++; if(f.max)n++;
  ['watt','kelvin','angle','cri'].forEach(function(g){ n+=actKeys_(f[g]).length; }); return n; }
function spAnyFilter_(){ var f=S._spFilters||{}; return !!(f.brand||f.hangMuc||f.dong||spFltCount_()); }
// ==== Popover "Bộ lọc" cho Danh sách SP (công suất / nhiệt độ / góc / CRI / thương hiệu / giá) ====
// phạm vi bộ lọc = sản phẩm thuộc hạng mục (node) đang chọn — để option lọc tương ứng hạng mục
function spScopeProducts_(){ var f=S._spFilters||{}; if(!f.node) return S.products||[];
  return (S.products||[]).filter(function(p){ var c=spNodeCodeOf_(p); return c===f.node || c.indexOf(f.node+'.')===0; }); }
function spSingleVals_(field){ var m={}; spScopeProducts_().forEach(function(p){ if(p[field]) m[p[field]]=(m[p[field]]||0)+1; }); return m; }
function spSpecOpts_(field){ var m={}; spScopeProducts_().forEach(function(p){ splitVals(p[field]).forEach(function(v){ m[v]=(m[v]||0)+1; }); }); return m; }
function spToggleBoLoc(e){ if(e&&e.stopPropagation) e.stopPropagation();
  if(document.getElementById('spFltPop')){ document.getElementById('spFltPop').remove(); document.removeEventListener('mousedown',spFltOutside); return; }
  spBoLocPop_(); }
function spFltOutside(e){ var p=document.getElementById('spFltPop'), b=document.getElementById('spBoLocBtn');
  if(p && !p.contains(e.target) && b && !b.contains(e.target)){ p.remove(); document.removeEventListener('mousedown',spFltOutside); } }
function spBoLocPop_(){
  if(spPTMode_()) return ptFltPop_();
  var f=S._spFilters=S._spFilters||{}; f.watt=f.watt||{}; f.kelvin=f.kelvin||{}; f.angle=f.angle||{}; f.cri=f.cri||{};
  var old=document.getElementById('spFltPop'); if(old) old.remove();
  function esq(s){ return esc(s).replace(/'/g,"\\'"); }
  function single(title,key,field){ var m=spSingleVals_(field||key); var keys=Object.keys(m); if(keys.length<2) return '';
    keys.sort(function(a,b){ return a.localeCompare(b,'vi'); });
    return '<div class="fgrp"><div class="fgt">'+title+'</div><div class="fchips">'
      +'<span class="spchip sm'+(!f[key]?' on':'')+'" onclick="spFltSet(\''+key+'\',\'\')">Tất cả</span>'
      +keys.map(function(v){ return '<span class="spchip sm'+(f[key]===v?' on':'')+'" onclick="spFltSet(\''+key+'\',\''+esq(v)+'\')">'+esc(v)+'</span>'; }).join('')
      +'</div></div>'; }
  function multi(title,field,fkey,opt){ opt=opt||{}; var m=spSpecOpts_(field); var keys=Object.keys(m); if(!keys.length) return '';
    keys.sort(function(a,b){ var na=parseFloat(a),nb=parseFloat(b); if(!isNaN(na)&&!isNaN(nb)&&na!==nb) return na-nb; return a.localeCompare(b); });
    return '<div class="fgrp"><div class="fgt">'+title+'</div><div class="fchips">'
      +keys.map(function(k){ var on=!!f[fkey][k]; var dot=opt.dot?'<i class="cdot" style="background:'+opt.dot(k)+'"></i>':'';
        return '<span class="spchip sm'+(on?' on':'')+'" onclick="spFltSpec(\''+fkey+'\',\''+esq(k)+'\')">'+dot+esc(k)+'</span>'; }).join('')
      +'</div></div>'; }
  var pop=document.createElement('div'); pop.className='fltpop spfltpop'; pop.id='spFltPop';
  pop.innerHTML='<div class="fhdr">Bộ lọc</div>'
    +'<div class="fgrp fgrp-sel">'+(S._spFselHtml||'')+'</div>'
    +multi('Công suất','congSuat','watt')
    +multi('Nhiệt độ màu','nhietDo','kelvin',{dot:ctColor})
    +multi('Góc chiếu','gocChieu','angle')
    +multi('CRI','cri','cri')
    +'<div class="fgrp"><div class="fgt">Khoảng giá (đ)</div><div class="fprice">'
      +'<input type="number" id="spFMin" placeholder="Từ" value="'+(f.min||'')+'" oninput="spFltPrice()">'
      +'<span>–</span><input type="number" id="spFMax" placeholder="Đến" value="'+(f.max||'')+'" oninput="spFltPrice()"></div></div>'
    +'<div class="fftr"><button class="btn ghost sm" onclick="spFltReset()">Xóa lọc</button>'
      +'<button class="btn blue sm" onclick="spToggleBoLoc()">Xong</button></div>';
  document.body.appendChild(pop);
  var btn=document.getElementById('spBoLocBtn'); var w=pop.offsetWidth||340;
  if(btn){ var r=btn.getBoundingClientRect(); pop.style.top=(r.bottom+6)+'px'; pop.style.left=Math.max(8,Math.min(r.right-w,window.innerWidth-w-8))+'px'; }
  setTimeout(function(){ document.addEventListener('mousedown',spFltOutside); },0);
}
function spAfterFlt_(){ S._spPage=1; renderSpChips_(); spFilter(); }
function spFltSet(key,val){ S._spFilters=S._spFilters||{}; if(!val) delete S._spFilters[key]; else S._spFilters[key]=val; spAfterFlt_(); spBoLocPop_(); }
function spFltSpec(fkey,val){ S._spFilters=S._spFilters||{}; var o=S._spFilters[fkey]=S._spFilters[fkey]||{}; if(o[val]) delete o[val]; else o[val]=1; spAfterFlt_(); spBoLocPop_(); }
function spFltPrice(){ var f=S._spFilters=S._spFilters||{}; var mn=document.getElementById('spFMin'), mx=document.getElementById('spFMax');
  f.min=mn?(Number(mn.value)||0):0; f.max=mx?(Number(mx.value)||0):0; spAfterFlt_(); }
function spFltReset(){ S._spFilters={watt:{},kelvin:{},angle:{},cri:{}}; spAfterFlt_(); spBoLocPop_(); }
function spSpecs_(p){ var out=[];
  if(nganhCuaSP_(p)==='vs'){                       // thiết bị vệ sinh: chip theo thông số của ngành
    vsChip_(p).forEach(function(x,k){ out.push('<span class="spec'+(k===2?' k':'')+'">'+esc(x[1])+'</span>'); });
    return out.join('')||'<span class="muted">—</span>';
  }
  if(p.congSuat) out.push('<span class="spec">'+esc(p.congSuat)+'</span>');
  if(p.nhietDo) out.push('<span class="spec k">'+esc(p.nhietDo)+'</span>');
  if(p.cri) out.push('<span class="spec">CRI '+esc(p.cri)+'</span>');
  if(p.gocChieu) out.push('<span class="spec">'+esc(p.gocChieu)+'</span>');
  return out.join('')||'<span class="muted">—</span>'; }
/* ═══ PHẦN THÔ TRONG TRANG DANH SÁCH SẢN PHẨM ═══
   Chọn hạng mục "3.1 Phần thô" ở ô Danh sách sản phẩm -> bảng đổi sang liệt kê THƯ VIỆN
   CÔNG TÁC xây dựng (khái toán chi tiết · khái toán sơ bộ · dự toán) thay cho sản phẩm đèn.
   Vẫn dùng chung khung bảng, ô tìm kiếm, phân trang và thanh kéo ngang của trang SP.       */
var SP_PTCOLS=[['stt','STT',58,'c'],['loai','LOẠI BÁO GIÁ',126,'l'],['nhom','HẠNG MỤC',196,'l'],
  ['ten','NỘI DUNG CÔNG VIỆC',330,'l'],['dvt','ĐVT',62,'c'],['dg','ĐƠN GIÁ',124,'n'],['gc','GHI CHÚ',280,'l']];
/* ═══ CỘT CỦA BẢNG CÔNG TÁC — dùng chung bộ máy cột của bảng sản phẩm ═══
   Cùng dạng [khoá, nhãn, class, hàm vẽ, thông tin ô sửa] nên chip chọn cột, kéo đổi chỗ,
   kéo giãn, cố định cột, phân trang, sửa nhanh… chạy y như bảng sản phẩm.               */
var PT_SPDEFW={stt:52,thumb:56,duyet:120,ten:300,loai:126,nhom:180,dvt:70,kl:116,dt:112,hs:80,dgnt:156,dg:140,gc:260};
var _ptColCache=null;
function ptRowVal_(r,f){ return ptVal_(r.sec,r.a,f); }
function ptAnh_(r){
  var c=ctOf_(r.a); if(c) return String(c.hinhAnh||'');
  return String((ptInfo_(r.ten)||{}).anh||'');
}
function ptAnh1_(r){
  var v=String(ptAnh_(r)||'').split(/[\n,]/).map(function(x){return x.trim();}).filter(Boolean)[0];
  return v?imgUrlOf(v):'';
}
function ptNumCell_(r,f,money_){
  if(!ptCanEditF_(r.sec,f)) return '<span class="muted">—</span>';
  var v=ptRowVal_(r,f);
  if(!v) return '<span class="muted">—</span>';
  return money_?(money(v)+'<span class="unit">đ</span>'):ptQty(v);
}
function spPTCols_(){
  if(_ptColCache) return _ptColCache;
  _ptColCache=[
    ['stt','STT','ct',function(r,i){ var per=spPerGet_(), tr=Math.max(1,S._spPage||1);
      return '<span class="sp-stt">'+((per?(tr-1)*per:0)+i+1)+'</span>'; }],
    ['thumb','Ảnh','thumbcol',function(r){
      var im=ptAnh1_(r);
      return im?'<img class="sp-th" src="'+esc(im)+'" onerror="this.style.visibility=\'hidden\'">':'<span class="sp-th"></span>'; }],
    ['duyet','Trạng thái','ct',function(r){
      var c=ctOf_(r.a);
      if(!c) return '<span class="spduyet mau" title="Công tác mẫu dựng sẵn trong ứng dụng — nạp vào cơ sở dữ liệu để duyệt / sửa ảnh">Thư viện mẫu</span>';
      return '<span class="spduyet'+(c.daDuyet?' on':'')+'" title="'+(c.daDuyet?('Duyệt bởi '+esc(c.nguoiDuyet||'?')):'Chưa được duyệt')+'">'
        +(c.daDuyet?'Đã duyệt':'Chưa duyệt')+'</span>'; }],
    ['ten','Nội dung công việc','sp-name',function(r){
      var da=ptDaCo_(r.sec,r.a);
      return '<b>'+esc(r.ten)+'</b>'+(da?'<span class="ptl-da" title="Đã có trong bảng khái toán của dự án đang chọn">✓ đã thêm</span>':'')
        +'<span class="sp-code">'+esc((r.r?r.r+'. ':'')+r.nhom)+(r.daSua?'<span class="ptl-sua" title="Đơn giá / thông số đã được sửa lại">đã sửa</span>':'')+'</span>'; }],
    ['loai','Loại báo giá','ct',function(r){
      return '<span class="ptl-tag '+esc(r.loai)+'" title="'+esc(ptLoaiLabel_(r.loai))+'">'+esc(ptLoaiNgan_(r.loai))+'</span>'; }],
    ['nhom','Hạng mục','',function(r){
      return '<span class="ptl-nhom" title="Bấm để chỉ xem hạng mục này" onclick="event.stopPropagation();spSelFilter(\'ptNhom\',\''+esc(String(r.nhom).replace(/'/g,"\\'"))+'\')">'+esc(r.nhom)+'</span>'; }],
    ['dvt','ĐVT','ct',function(r){ return spDash_(ptRowVal_(r,'dvt')); },{f:'dvt'}],
    ['kl','Khối lượng mẫu','num',function(r){ return ptNumCell_(r,'kl'); },{f:'kl',num:1}],
    ['dt','Diện tích mẫu','num',function(r){ return ptNumCell_(r,'dt'); },{f:'dt',num:1}],
    ['hs','Hệ số','num',function(r){ return ptNumCell_(r,'hs'); },{f:'hs',num:1}],
    ['dgnt','Đơn giá (nhà thầu)','num sp-price',function(r){ return ptNumCell_(r,'dgnt',1); },{f:'dgnt',num:1,money:1}],
    ['dg','Đơn giá','num sp-price',function(r){
      if(r.sec.mode==='area') return '<span title="Đơn giá chung của cả hạng mục">'+money(r.dg)+'<span class="unit">đ</span></span>';
      return ptNumCell_(r,'dg',1); },{f:'dg',num:1,money:1}],
    ['gc','Ghi chú','',function(r){ return '<span class="ptl-gc">'+esc(ptRowVal_(r,'gc'))+'</span>'; },{f:'gc'}]
  ];
  return _ptColCache;
}
function ptEditCell_(c,r,i){
  var e=c[4]; if(!e || !ptCanEditF_(r.sec,e.f)) return c[3](r,i);
  var v=ptRowVal_(r,e.f);
  if(e.money) v=v?money(v):'';
  else if(e.num) v=(v||v===0)?String(v):'';
  return '<span class="spin-wrap'+(e.num?'':' tx')+'" onclick="event.stopPropagation()">'
    +'<input class="spin'+(e.num?'':' spin-tx')+'" value="'+esc(v)+'" title="'+esc(v)+'"'
    +' data-si="'+r.si+'" data-ii="'+r.ii+'" data-f="'+esc(e.f)+'" data-money="'+(e.money?1:0)+'" data-old="'+esc(v)+'"'
    +' onchange="ptOvrSave(this)" onkeydown="if(event.key===\'Enter\')this.blur()"></span>';
}
async function ptOvrSave(inp){
  var si=+inp.dataset.si, ii=+inp.dataset.ii, f=inp.dataset.f;
  var sec=PT_TEMPLATE[si]; if(!sec) return; var a=sec.items[ii]; if(!a) return;
  var raw=String(inp.value||'').trim();
  var v = (+inp.dataset.money) ? (raw===''?'':ptMoneyN_(raw)) : (['kl','dt','hs'].indexOf(f)>=0 ? (raw===''?'':ptN(raw)) : raw);
  var c=ctOf_(a);
  if(c){                                                        // công tác trong CSDL -> lưu thẳng
    var patch=ctPatchOf_(c); patch[f]=v;
    try{ var out=await api('ctUpdate', c.id, patch); Object.assign(c,out); }
    catch(e){ toast('Lỗi lưu: '+e.message); inp.value=inp.dataset.old||''; return; }
    ctSyncTemplate_(); spFilter(); if(S.node==='3.1') renderPTLibrary();
    toast('Đã lưu vào cơ sở dữ liệu');
    return;
  }
  var base=ptBase_(sec,a,f);
  if(v===''||String(v)===String(base)) ptOvrSet_(sec,a,f,'');    // trùng giá gốc -> bỏ phần sửa
  else ptOvrSet_(sec,a,f,v);
  spFilter(); if(S.node==='3.1') renderPTLibrary();
  toast('Đã lưu — giá này dùng cho cả thư viện và khi thêm vào bảng');
}
// gói dữ liệu 1 công tác để gửi lên server (giữ nguyên các trường không sửa)
function ctPatchOf_(c){
  return {loai:c.loai, mode:c.mode, maNhom:c.maNhom, hangMuc:c.hangMuc, ten:c.ten, dvt:c.dvt,
    kl:c.kl, dt:c.dt, hs:c.hs, dgnt:c.dgnt, dg:c.dg, gc:c.gc, hinhAnh:c.hinhAnh,
    thongSo:c.thongSo, phamVi:c.phamVi, linkTaiLieu:c.linkTaiLieu};
}
function ptResetOvr_(){
  var n=Object.keys(ptOvrAll_()).length;
  if(!n){ toast('Chưa có công tác nào bị sửa'); return; }
  if(!confirm('Trả '+n+' công tác đã sửa về đúng bảng giá gốc?')) return;
  S._ptOvr={}; try{ localStorage.removeItem('qs_ptovr'); }catch(e){}
  spFilter(); if(S.node==='3.1') renderPTLibrary(); toast('Đã trả về bảng giá gốc');
}
/* --- chọn dòng + hành động hàng loạt --- */
function ptSelKey_(r){ return 'pt|'+r.si+'|'+r.ii; }
function ptSelRows_(){
  var sel=S._spSel||{}; return spPTAll_().filter(function(r){ return sel[ptSelKey_(r)]; });
}
function ptBulkAdd_(){
  var rows=ptSelRows_(); if(!rows.length) return;
  if(!S.cur){ toast('Chọn dự án trước khi thêm công tác vào bảng'); return; }
  rows.forEach(function(r){ ptAddFromLib(r.si,r.ii,true); });
  ptPersist(); renderPhanTho();
  S._spSel={}; spFilter();
  toast('Đã thêm '+rows.length+' công tác vào bảng khái toán');
}
function ptBulkBar_(){
  var wrap=document.getElementById('spBulkWrap'); if(!wrap) return;
  var n=Object.keys(S._spSel||{}).length; if(!n){ wrap.innerHTML=''; return; }
  // cùng khung với bảng sản phẩm: [số đã chọn] · [sửa hàng loạt] · [hành động]
  wrap.innerHTML='<div class="spbulk">'
    +'<div class="spb-z spb-count"><span class="spb-n">'+n+'</span><span class="spb-ntxt">công tác<br>đã chọn</span>'
      +'<button class="spb-x" title="Bỏ chọn tất cả" onclick="spClearSel()">✕</button></div>'
    +'<div class="spb-z spb-edit">'
      +'<span class="spb-lb">Sửa hàng loạt</span>'
      +'<div class="spb-row">'
        +'<select class="spb-sel" id="ctbField">'+CT_BULK_F.map(function(x){ return '<option value="'+x[0]+'">'+esc(x[1])+'</option>'; }).join('')+'</select>'
        +'<input class="spb-in" id="ctbValue" placeholder="Giá trị mới…" onkeydown="if(event.key===\'Enter\')ctBulkEdit_()">'
        +'<button class="spb-apply" id="ctbApply" onclick="ctBulkEdit_()">'+icon('check',14)+'<span>Áp dụng</span></button>'
      +'</div>'
    +'</div>'
    +'<div class="spb-z spb-act">'
      +'<button class="spb-b primary" onclick="ptBulkAdd_()">'+icon('plus',14)+' Thêm vào bảng khái toán</button>'
      +'<button class="spb-b fav" onclick="ctFavBulk_(1)" title="Lưu vào công tác yêu thích">'+icon('heart',14)+' Yêu thích</button>'
      +(spCanDuyet_()?'<button class="spb-b duyet" onclick="ctDuyetBulk_(1)" title="Duyệt các công tác đã lưu trong cơ sở dữ liệu">'+icon('check',14)+' Duyệt</button>':'')

      +'<button class="spb-b" onclick="ptBulkXlsx_()">'+icon('download',14)+' Tải Excel</button>'
      +(isAdminRole_()?'<button class="spb-b danger" title="Xoá công tác khỏi cơ sở dữ liệu" onclick="ctDeleteBulk_()">'+icon('trash',14)+'</button>':'')
    +'</div></div>';
}
/* --- bộ lọc nâng cao --- */
function ptFltPop_(){
  var f=S._spFilters=S._spFilters||{};
  var old=document.getElementById('spFltPop'); if(old) old.remove();
  var all=spPTAll_();
  function esq(s){ return esc(String(s)).replace(/'/g,"\\'"); }
  function chips(title,key,vals){
    return '<div class="fgrp"><div class="fgt">'+title+'</div><div class="fchips">'
      +'<span class="spchip sm'+(!f[key]?' on':'')+'" onclick="spFltSet(\''+key+'\',\'\')">Tất cả</span>'
      +vals.map(function(v){ return '<span class="spchip sm'+(f[key]===v[0]?' on':'')+'" onclick="spFltSet(\''+key+'\',\''+esq(v[0])+'\')">'+esc(v[1])+'</span>'; }).join('')
      +'</div></div>';
  }
  var dvt={}; all.forEach(function(r){ if(r.dvt) dvt[r.dvt]=(dvt[r.dvt]||0)+1; });
  var dvtVals=Object.keys(dvt).sort(function(a,b){ return dvt[b]-dvt[a]; }).slice(0,14).map(function(v){ return [v,v+' ('+dvt[v]+')']; });
  var nhom={}; all.forEach(function(r){ nhom[r.nhom]=(nhom[r.nhom]||0)+1; });
  var nhomVals=Object.keys(nhom).map(function(v){ return [v,v]; });
  var pop=document.createElement('div'); pop.className='fltpop spfltpop'; pop.id='spFltPop';
  pop.innerHTML='<div class="fhdr">Bộ lọc công tác</div>'
    +chips('Loại báo giá','ptLoai',PT_LOAI.map(function(x){ return [x[0],x[1]]; }))
    +chips('Đơn vị tính','ptDvt',dvtVals)
    +'<div class="fgrp"><div class="fgt">Hạng mục</div><select class="sp-fsel" onchange="spFltSet(\'ptNhom\',this.value)">'
      +'<option value="">Tất cả hạng mục</option>'
      +nhomVals.map(function(v){ return '<option value="'+esc(v[0])+'"'+(f.ptNhom===v[0]?' selected':'')+'>'+esc(v[1])+'</option>'; }).join('')
    +'</select></div>'
    +'<div class="fgrp"><div class="fgt">Khoảng đơn giá (đ)</div><div class="fprice">'
      +'<input type="number" id="spFMin" placeholder="Từ" value="'+(f.min||'')+'" oninput="spFltPrice()">'
      +'<span>–</span><input type="number" id="spFMax" placeholder="Đến" value="'+(f.max||'')+'" oninput="spFltPrice()"></div></div>'
    +'<div class="fgrp"><div class="fgt">Trạng thái</div><div class="fchips">'
      +'<span class="spchip sm'+(!f.ptDa?' on':'')+'" onclick="spFltSet(\'ptDa\',\'\')">Tất cả</span>'
      +'<span class="spchip sm'+(f.ptDa==='1'?' on':'')+'" onclick="spFltSet(\'ptDa\',\'1\')">Đã có trong bảng</span>'
      +'<span class="spchip sm'+(f.ptDa==='0'?' on':'')+'" onclick="spFltSet(\'ptDa\',\'0\')">Chưa thêm</span>'
      +'<span class="spchip sm'+(f.ptSua==='1'?' on':'')+'" onclick="spFltSet(\'ptSua\',f.ptSua===\'1\'?\'\':\'1\')">Đã sửa giá</span>'
    +'</div></div>'
    +'<div class="fftr"><button class="btn ghost sm" onclick="ptFltReset_()">Xóa lọc</button>'
      +'<button class="btn blue sm" onclick="spToggleBoLoc()">Xong</button></div>';
  document.body.appendChild(pop);
  var btn=document.getElementById('spBoLocBtn'); var w=pop.offsetWidth||340;
  if(btn){ var r=btn.getBoundingClientRect(); pop.style.top=(r.bottom+6)+'px'; pop.style.left=Math.max(8,Math.min(r.right-w,window.innerWidth-w-8))+'px'; }
}
function ptFltReset_(){
  var f=S._spFilters||{}; ['ptLoai','ptDvt','ptNhom','ptDa','ptSua','min','max'].forEach(function(k){ delete f[k]; });
  renderSpChips_(); spFilter(); ptFltPop_();
}
function ptFltCount_(){ var f=S._spFilters||{}; var n=0;
  ['ptLoai','ptDvt','ptNhom','ptDa','ptSua','min','max'].forEach(function(k){ if(f[k]) n++; }); return n; }
/* --- tải Excel --- */
function ptXlsRows_(chiChon){
  var rows=chiChon?ptSelRows_():spPTList_();
  return rows.map(function(r,i){
    return {stt:i+1, loai:ptLoaiLabel_(r.loai), hangMuc:(r.r?r.r+'. ':'')+r.nhom, noiDung:r.ten,
      dvt:r.dvt, khoiLuong:(r.mode==='item'?r.kl:''), dienTich:(r.mode!=='item'&&r.mode!=='none'?r.dt:''),
      heSo:(r.mode!=='item'&&r.mode!=='none'?r.hs:''), dgnt:(r.mode==='item'?r.dgnt:''), dg:r.dg, ghiChu:r.gc};
  });
}
async function ptBulkXlsx_(){ return ptExportXlsx(true); }
async function ptExportXlsx(chiChon){
  var rows=ptXlsRows_(chiChon);
  if(!rows.length){ toast('Không có công tác nào để tải'); return; }
  var btn=document.getElementById('spXlsBtn'); if(btn) btn.disabled=true;
  try{
    var res=await fetch('/export/cong-tac',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+authToken()},body:JSON.stringify({rows:rows})});
    if(!res.ok) throw new Error('Lỗi '+res.status);
    var blob=await res.blob();
    var url=URL.createObjectURL(blob), a=document.createElement('a');
    a.href=url; a.download='cong-tac-xay-dung.xlsx'; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function(){ URL.revokeObjectURL(url); },1500);
    toast('Đã tải '+rows.length+' công tác ra Excel');
  }catch(e){ toast('Không tải được Excel: '+e.message); }
  if(btn) btn.disabled=false;
}
function spXlsClick_(){ return spPTMode_()?ptExportXlsx(Object.keys(S._spSel||{}).length>0):spExportXlsx(); }
function spPTMode_(){ return String((S._spFilters||{}).node||'')==='3.1'; }
function ptLoaiLabel_(v){ var m=PT_LOAI.filter(function(x){ return x[0]===ptLoaiGop_(v); })[0]; return m?m[1]:v; }
var PT_LOAI_NGAN={kt_chitiet:'KT chi tiết',kt_sobo:'KT sơ bộ',dt_nhancong:'DT · Nhân công',dt_vattu:'DT · Vật tư'};
function ptLoaiNgan_(v){ return PT_LOAI_NGAN[v]||ptLoaiLabel_(v); }
/* Loại báo giá Phần thô (theo sơ đồ nghiệp vụ):
     KHÁI TOÁN CHI TIẾT → chọn nhà thầu → báo giá theo m2 / md / cái
     KHÁI TOÁN SƠ BỘ    → chọn nhà thầu → chọn dự án mẫu → đơn giá trọn gói
     DỰ TOÁN → NHÂN CÔNG (báo giá theo m2 / md / cái) · VẬT TƯ (báo giá vật tư)
   ptLoaiGop_ giữ lại làm chuẩn hoá (rỗng -> kt_chitiet); 4 loại KHÔNG gộp nhau.            */
function ptLoaiGop_(v){ return String(v||'kt_chitiet'); }
// "Khái toán chi tiết" -> "Chi tiết" khi đã nằm dưới nhóm Khái toán
var PT_LOAI_NHOM=[
  ['kt','1','Khái toán',[['kt_chitiet','1.1','Khái toán chi tiết','Chọn nhà thầu → báo giá theo m2 / md / cái'],
                         ['kt_sobo','1.2','Khái toán sơ bộ','Chọn nhà thầu → chọn dự án mẫu → đơn giá trọn gói']]],
  ['dt','2','Dự toán',[['dt_nhancong','2.1','Nhân công','Báo giá theo m2 / md / cái'],
                       ['dt_vattu','2.2','Vật tư','Báo giá vật tư']]]
];
function spPTAll_(){
  var out=[];
  PT_TEMPLATE.forEach(function(sec,si){
    if(sec.an) return;                       // bản dựng sẵn đã được thay bằng dữ liệu CSDL
    (sec.items||[]).forEach(function(a,ii){
      out.push({si:si,ii:ii,sec:sec,a:a,loai:sec.loai||'kt_chitiet',r:sec.r||'',mode:sec.mode,
        nhom:String(sec.t).split('\n')[0],ten:String(a[0]),
        dvt:ptVal_(sec,a,'dvt'),dg:ptLibDg_(sec,a),dgnt:ptVal_(sec,a,'dgnt'),
        kl:ptVal_(sec,a,'kl'),dt:ptVal_(sec,a,'dt'),hs:ptVal_(sec,a,'hs'),gc:ptVal_(sec,a,'gc'),
        daSua:ptOvrDaSua_(sec,a)});
    });
  });
  return out;
}
function spPTList_(){
  var f=S._spFilters||{}, el=document.getElementById('spSearch');
  var q=spNorm_((el&&el.value)||''), view=S._ptView||'all';
  var mn=Number(f.min)||0, mx=Number(f.max)||0;
  return spPTAll_().filter(function(r){
    if(view==='__chua'){ var c1=ctOf_(r.a); if(!c1||c1.daDuyet) return false; }
    else if(view==='__da'){ var c2=ctOf_(r.a); if(!c2||!c2.daDuyet) return false; }
    else if(view==='__fav'){ var c3=ctOf_(r.a); if(!c3||!c3.yeuThich) return false; }
    if(f.ptLoai && ptLoaiGop_(r.loai)!==ptLoaiGop_(f.ptLoai)) return false;
    if(f.ptNhom && r.nhom!==f.ptNhom) return false;
    if(f.ptDvt && r.dvt!==f.ptDvt) return false;
    if(f.ptSua==='1' && !r.daSua) return false;
    if(f.ptDa==='1' && !ptDaCo_(r.sec,r.a)) return false;
    if(f.ptDa==='0' && ptDaCo_(r.sec,r.a)) return false;
    if(mn && r.dg<mn) return false;
    if(mx && r.dg>mx) return false;
    if(q && spNorm_(r.ten+' '+r.nhom+' '+r.gc+' '+r.dvt).indexOf(q)<0) return false;
    return true;
  });
}
function spPTHead_(){
  var head=document.getElementById('spHead'), cg=document.getElementById('spColg');
  var ACT=96;
  if(cg) cg.innerHTML=SP_PTCOLS.map(function(c){ return '<col style="width:'+c[2]+'px">'; }).join('')+'<col style="width:'+ACT+'px">';
  if(head) head.innerHTML='<tr>'+SP_PTCOLS.map(function(c){
      return '<th class="'+c[3]+'">'+esc(c[1])+'</th>'; }).join('')+'<th class="act-sp"></th></tr>';
  var tb=head?head.closest('table'):null;
  if(tb){ var total=ACT; SP_PTCOLS.forEach(function(c){ total+=c[2]; });
    tb.style.tableLayout='fixed'; tb.style.width=total+'px'; }
}
function spPTRender_(){ return spFilter(); }
function spPTSetView(v){ S._ptView=v; S._spPage=1; spViewTabs_(); spFilter(); }
function spPTTabs_(){
  var el=document.getElementById('spViewTabs'); if(!el) return;
  // ĐÚNG bộ chip như Thiết bị đèn: chỉ 4 trạng thái, cùng kiểu màu.
  // Lọc theo "loại báo giá" đã nằm trong nút Bộ lọc (và hiện thành thẻ khi đang bật).
  var all=spPTAll_(), cur=S._ptView||'all';
  var db=all.filter(function(r){ return ctOf_(r.a); });
  var chua=db.filter(function(r){ return !ctOf_(r.a).daDuyet; }).length;
  var da=db.filter(function(r){ return ctOf_(r.a).daDuyet; }).length;
  var fav=db.filter(function(r){ return ctOf_(r.a).yeuThich; }).length;
  var tabs=[['all','Tất cả',all.length],['__chua','Chưa duyệt',chua],
            ['__da','Đã duyệt',da],['__fav','♥ Yêu thích',fav]];
  el.innerHTML=tabs.map(function(t){
    return '<button class="spvt'+(cur===t[0]?' on':'')
      +(t[0]==='__chua'?' warn':(t[0]==='__fav'?' fav':''))+'" onclick="spPTSetView(\''+t[0]+'\')">'+esc(t[1])
      +(t[2]?'<span class="spvt-n">'+t[2]+'</span>':'')+'</button>'; }).join('');
}
function spPTChips_(){
  var bar=document.getElementById('spBar'); if(!bar) return;
  var f=S._spFilters||{}, all=spPTAll_();
  // Hàng lọc giống hệt Thiết bị đèn: chỉ ô ĐỀ MỤC + các bộ lọc ĐANG bật (dạng thẻ có ✕).
  // Mọi bộ lọc khác (loại báo giá · hạng mục công tác · ĐVT · khoảng giá · trạng thái)
  // nằm trong nút "Bộ lọc", không bày inline nữa.
  function fchip(key,lb,val){
    return '<span class="fltag" title="'+esc(lb)+'"><i>'+esc(lb)+'</i>'+esc(val)
      +'<b onclick="spSelFilter(\'' + key + '\',\'\')" title="Bỏ lọc này">✕</b></span>';
  }
  var tags='';
  if(f.ptLoai) tags+=fchip('ptLoai','Loại báo giá',ptLoaiNgan_(f.ptLoai));
  if(f.ptNhom) tags+=fchip('ptNhom','Hạng mục',f.ptNhom);
  if(f.ptDvt)  tags+=fchip('ptDvt','ĐVT',f.ptDvt);
  if(f.ptDa==='1') tags+=fchip('ptDa','Trạng thái','Đã có trong bảng');
  if(f.ptDa==='0') tags+=fchip('ptDa','Trạng thái','Chưa thêm');
  if(f.ptSua==='1') tags+=fchip('ptSua','Lọc','Đã sửa giá');
  if(f.min||f.max) tags+='<span class="fltag"><i>Khoảng giá</i>'
      +(f.min?money(f.min):'0')+' – '+(f.max?money(f.max):'∞')
      +'<b onclick="spFltSet(\'min\',\'\');spFltSet(\'max\',\'\')" title="Bỏ lọc này">✕</b></span>';
  var treeCol='<div class="sp-scope"><button class="tree-btn sp-catbtn" id="spCatBtn" onclick="spCatToggle(event)">'
      +'<span class="sp-catlbl">3.1.Phần thô</span><span class="cnt">'+all.length+'</span><span class="sp-caret">▾</span></button>'
      +'<div class="tree-pop" id="spCatPop" style="display:none"></div></div>';
  var nS=Object.keys(ptOvrAll_()).length;
  bar.innerHTML='<div class="sp-filtrow">'+treeCol
    +(tags?('<div class="fltags">'+tags+'</div>'):'')
    +(nS?'<button class="btn ghost xs sua" title="Trả các công tác đã sửa về đúng bảng giá gốc" onclick="ptResetOvr_()">'+nS+' công tác đã sửa giá ✕</button>':'')
    +(ptFltCount_()?'<button class="btn ghost xs sp-clrflt" onclick="ptFltReset_()">Xoá lọc</button>':'')
    +'</div>';
  var badge=document.getElementById('spFltBadge'); var n=ptFltCount_();
  if(badge){ badge.textContent=n||''; badge.style.display=n?'inline-flex':'none'; }
  var btn=document.getElementById('spBoLocBtn'); if(btn) btn.classList.toggle('on', n>0);
}
// Thông tin công tác dạng popup (trang Danh sách SP không có panel bên như tab Bóc tách)
function ptModal_(si,ii){
  var sec=PT_TEMPLATE[si]; if(!sec||!sec.items[ii]) return;
  var ctr=ctOf_(sec.items[ii]);
  spClose();
  var ov=document.createElement('div'); ov.className='sp-modal-ov'; ov.id='spModalOv';
  ov.onclick=function(e){ if(e.target===ov) spClose(); };
  var P=ptDetailParts_(si,ii);
  var duyet = ctr ? ('<span class="spduyet'+(ctr.daDuyet?' on':'')+'">'+(ctr.daDuyet?'Đã duyệt':'Chưa duyệt')+'</span>')
                  : '<span class="spduyet mau">Thư viện mẫu</span>';
  ov.innerHTML='<div class="sp-modal sp-modal-wide pd ptdetail"><div class="pd-head"><h3>Thông tin công tác</h3>'
      +duyet+'<span class="pd-loai">'+esc(ptLoaiLabel_(sec.loai||'kt_chitiet'))+'</span>'
      +'<button class="pd-x" onclick="spClose()">✕</button></div>'
    +'<div class="pdm-grid">'
      +'<div class="pdm-left">'+P.media+P.hero+P.foot+'</div>'
      +'<div class="pdm-right">'+P.chinh+P.thongSo+P.ghiChu+P.phamVi+P.thieu+'</div>'
    +'</div>'
    +'<div class="pd-actions">'
      +'<button class="btn ghost sm" onclick="spClose()">Đóng</button>'
      +(ctr?'<button class="btn ghost sm" onclick="ctEditModal_(\''+ctr.id+'\')">'+icon('edit',14)+' Sửa công tác</button>'
           :'<button class="btn ghost sm" onclick="ptInfoEditModal_('+si+','+ii+')">'+icon('edit',14)+' Sửa thông tin</button>')
      +'<button class="btn blue" onclick="ptAddFromLib('+si+','+ii+');spClose()">'+icon('plus',15)+' Thêm vào bảng khái toán</button>'
    +'</div></div>';
  document.body.appendChild(ov);
  document.addEventListener('keydown',spModalKey_);
}
function ptInfoEditModal_(si,ii){
  var box=document.querySelector('#spModalOv .sp-modal'); if(!box) return;
  box.innerHTML='<div class="pd-head"><h3>Sửa thông tin công tác</h3><button class="pd-x" onclick="spClose()">✕</button></div>'
    +ptInfoForm_(si,ii);
  var huy=box.querySelector('.ptinf-act .btn.ghost');
  if(huy) huy.setAttribute('onclick','ptModal_('+si+','+ii+')');
  var luu=box.querySelector('.ptinf-act .btn.blue');
  if(luu) luu.setAttribute('onclick','ptInfoSaveModal_('+si+','+ii+')');
}
function ptInfoSaveModal_(si,ii){
  var a=PT_TEMPLATE[si].items[ii], k=ptInfoKey_(String(a[0]));
  function v(id){ var e=document.getElementById(id); return e?String(e.value||'').replace(/\s+$/,''):''; }
  var o={model:v('ptInfModel'),anh:v('ptInfAnh'),ts:v('ptInfTs'),gc:v('ptInfGc'),pv:v('ptInfPv'),tl:v('ptInfTl')};
  var U=ptInfoUser_();
  if(!o.model&&!o.anh&&!o.ts&&!o.gc&&!o.pv&&!o.tl) delete U[k]; else U[k]=o;
  try{ localStorage.setItem('qs_ptinfo',JSON.stringify(U)); }catch(e){ toast('Không lưu được (bộ nhớ trình duyệt đầy)'); }
  toast('Đã lưu thông tin công tác'); ptModal_(si,ii);
  if(spPTMode_()) spFilter();
}
/* ═══════════ MỘT BỘ KHUNG BẢNG DÙNG CHUNG CHO MỌI HẠNG MỤC ═══════════
   Bảng "Danh sách sản phẩm" vẽ bằng ĐÚNG một hàm cho cả Thiết bị đèn và Phần thô:
   cùng ô tích chọn, cùng chế độ sửa nhanh, cùng hàng nút thao tác, cùng phân trang,
   cùng thanh chọn nhiều. Chỉ 3 thứ đổi theo hạng mục: NGUỒN DỮ LIỆU · BỘ CỘT · BỘ LỌC. */
function spKeyOf_(p){ return spPTMode_() ? ptSelKey_(p) : String(p.recordId||p.ma||''); }
function spOpen_(i){
  var p=(S._spList||[])[i]; if(!p) return;
  if(spPTMode_()) ptModal_(p.si,p.ii); else spModal(i);
}
function spEditCellAny_(c,p,i){ return spPTMode_()?ptEditCell_(c,p,i):spEditCell_(c,p,i); }
function spCellEditable_(c,p){
  if(!c[4]) return false;
  return spPTMode_() ? ptCanEditF_(p.sec,c[4].f) : !p.spChung;
}
/* Hàng nút thao tác — cùng thứ tự, cùng biểu tượng ở mọi hạng mục:
   ★ yêu thích · ⊕ đưa vào dự án · ✓ duyệt · ✎ sửa · 👁 xem · 🗑 xoá            */
function spRowActions_(p,i){
  var isAdmin=isAdminRole_();
  if(spPTMode_()){
    var c=ctOf_(p.a), da=ptDaCo_(p.sec,p.a);
    return (c?'<button class="sp-act fav'+(c.yeuThich?' on':'')+'" title="'+(c.yeuThich?'Bỏ khỏi công tác yêu thích':'Thêm vào công tác yêu thích')+'" onclick="ctFav_(\''+c.id+'\','+(c.yeuThich?0:1)+')">'+icon('heart',16)+'</button>':'')
      +'<button class="sp-act add" title="'+(da?'Đã có trong bảng — bấm để thêm 1 dòng nữa':'Thêm vào bảng khái toán của dự án đang chọn')+'" onclick="ptAddFromLib('+p.si+','+p.ii+');spFilter()">'+icon('pluscircle',18)+'</button>'
      +((c&&spCanDuyet_())?'<button class="sp-act '+(c.daDuyet?'undo':'ok')+'" title="'+(c.daDuyet?'Bỏ duyệt':'Duyệt công tác này')+'" onclick="ctDuyet_(\''+c.id+'\','+(c.daDuyet?0:1)+')">'+icon('check',16)+'</button>':'')
      +(c?'<button class="sp-act edit" title="Cập nhật công tác" onclick="ctEditModal_(\''+c.id+'\')">'+icon('edit',16)+'</button>':'')
      +'<button class="sp-act" title="Xem chi tiết" onclick="spOpen_('+i+')">'+icon('eye',16)+'</button>'
      +((c&&isAdmin)?'<button class="sp-act del" title="Xoá công tác" onclick="ctDelete_(\''+c.id+'\',\''+esc(String(p.ten).replace(/'/g,"\\'"))+'\')">'+icon('trash',16)+'</button>':'');
  }
  return '<button class="sp-act fav'+(p.yeuThich?' on':'')+'" title="'+(p.yeuThich?'Bỏ khỏi sản phẩm yêu thích':'Thêm vào sản phẩm yêu thích')+'" onclick="spFav('+i+','+(p.yeuThich?0:1)+')">'+icon('heart',16)+'</button>'
    +'<button class="sp-act add" title="Ghi danh vào dự án" onclick="spAddToProject('+i+')">'+icon('pluscircle',18)+'</button>'
    +((spCanDuyet_()&&!p.spChung)?'<button class="sp-act '+(p.daDuyet?'undo':'ok')+'" title="'+(p.daDuyet?'Bỏ duyệt':'Duyệt sản phẩm này')+'" onclick="spDuyet('+i+','+(p.daDuyet?0:1)+')">'+icon('check',16)+'</button>':'')
    +(p.spChung?'':'<button class="sp-act edit" title="Cập nhật sản phẩm" onclick="spEditModal('+i+')">'+icon('edit',16)+'</button>')
    +'<button class="sp-act" title="Xem chi tiết" onclick="spOpen_('+i+')">'+icon('eye',16)+'</button>'
    +((isAdmin&&!p.spChung)?'<button class="sp-act del" title="Xoá" onclick="spDelete('+i+')">'+icon('trash',16)+'</button>':'');
}
// Nguồn dữ liệu theo hạng mục (chỉ chỗ này khác nhau)
function spDataList_(){
  if(spPTMode_()){ if(S.cur) ptEnsure(); return spPTList_(); }
  _skuMap=null;
  var el=document.getElementById('spSearch'); var q=(el&&el.value||'').toLowerCase().trim(); var f=S._spFilters||{};
  var watts=actKeys_(f.watt), kels=actKeys_(f.kelvin), angs=actKeys_(f.angle), cris=actKeys_(f.cri);
  var mn=Number(f.min)||0, mx=Number(f.max)||0;
  var list=(S.products||[]).filter(function(p){
    if(q && (p.ten+' '+p.ma+' '+p.thuongHieu+' '+p.ncc).toLowerCase().indexOf(q)<0) return false;
    if(f.node){ var c=spNodeCodeOf_(p); if(!(c===f.node || c.indexOf(f.node+'.')===0)) return false; }
    if(f.dong && spNorm_(p.nhom)!==spNorm_(f.dong)) return false;
    if(S._spView==='fav' && !p.yeuThich) return false;
    if(S._spView==='chua' && p.daDuyet) return false;
    if(S._spView==='da' && !p.daDuyet) return false;
    if(f.brand && p.thuongHieu!==f.brand) return false;
    if(f.hangMuc && p.hangMuc!==f.hangMuc) return false;
    var pr=Number(p.donGiaBan)||0; if(mn&&pr<mn) return false; if(mx&&pr>mx) return false;
    if(watts.length){ var pw=splitVals(p.congSuat); if(!pw.some(function(x){return watts.indexOf(x)>=0;})) return false; }
    if(kels.length){ var pk=splitVals(p.nhietDo); if(!pk.some(function(x){return kels.indexOf(x)>=0;})) return false; }
    if(angs.length){ var pa=splitVals(p.gocChieu); if(!pa.some(function(x){return angs.indexOf(x)>=0;})) return false; }
    if(cris.length){ var pc=splitVals(p.cri); if(!pc.some(function(x){return cris.indexOf(x)>=0;})) return false; }
    return true;
  });
  return spGroupVariants_(list);          // biến thể cùng mã SP nằm liền nhau
}
/* ═══ GOM BIẾN THỂ TRONG BẢNG DANH SÁCH SP ═══
   Trước đây mỗi biến thể là 1 dòng phẳng, chỉ nằm cạnh nhau -> bảng dài, khó nhìn,
   lại khác hẳn cách combo hiển thị (chip bung ra). Nay đồng bộ: mỗi nhóm biến thể
   chỉ hiện 1 DÒNG ĐẠI DIỆN + chip "Biến thể N"; bấm chip mới bung các dòng còn lại.
   Dòng con vẫn là dòng thật (chọn / sửa / mở chi tiết bình thường), chỉ thụt vào. */
function spCbQty_(i){
  var m=(S._rowMeta||[])[i]; if(!m||m.k!=='cb') return '';
  return '<span class="sp-cbq2" title="Số lượng đi kèm cho mỗi sản phẩm chính">×'+ptQty(m.sl)+'</span>';
}
function spVarChip_(p){
  var m=(S._btMap||{})[spKeyOf_(p)]; if(!m) return '';
  var k=String(m.key||'').replace(/\\/g,'\\\\').replace(/'/g,"\\'");
  return '<button class="sp-cbn sp-btchip'+(m.mo?' on':'')+'" title="'+(m.mo?'Thu gọn':'Xem')+' '+m.n+' biến thể của sản phẩm này"'
    +' onclick="event.stopPropagation();spVarToggle_(\''+esc(k)+'\')"><span class="cbc">▸</span>'+icon('layers',10)+' biến thể '+m.n+'</button>';
}
function spVarGroups2_(list){
  var out=[], at={};
  (list||[]).forEach(function(p){
    var k=spVarKey_(p);
    if(k && at[k]!=null){ out[at[k]].kids.push(p); return; }
    if(k) at[k]=out.length;
    out.push({key:k, head:p, kids:[]});
  });
  return out;
}
function spVarOpen_(k){ return !!(S._spBtOpen && S._spBtOpen[k]); }
function spVarToggle_(k){
  S._spBtOpen=S._spBtOpen||{};
  if(S._spBtOpen[k]) delete S._spBtOpen[k]; else S._spBtOpen[k]=1;
  var w=document.querySelector('.sp-card .tbl-wrap'), t=w?w.scrollTop:0;
  spFilter(); if(w) w.scrollTop=t;                 // giữ nguyên chỗ đang xem
}
function spFilter(){
  var PT=spPTMode_();
  if(!PT){ var _ngTruoc=S._spColsNganh; spColsSync_(); if(_ngTruoc!==S._spColsNganh){ _spColCache=null; S._spOrder=null; } }
  var card=document.querySelector('.sp-card');
  if(card){
    if(PT) card.classList.add('ptmode');
    else if(card.classList.contains('ptmode')){ card.classList.remove('ptmode'); spColChips_(); spRenderHead_(); }
  }
  var se=document.getElementById('spSearch');
  if(se) se.placeholder = PT ? 'Tìm công tác, hạng mục hoặc ghi chú…' : 'Tìm theo tên, mã hoặc thương hiệu…';

  var full=spDataList_();
  S._spFull=full; S._spSel=S._spSel||{};
  // Gom biến thể: đếm trang theo NHÓM (1 nhóm = 1 dòng), bung ra mới thêm dòng con
  var groups = PT ? (full||[]).map(function(x){ return {key:'', head:x, kids:[]}; }) : spVarGroups2_(full);
  var per=spPerGet_(), pages=per?Math.max(1,Math.ceil(groups.length/per)):1;
  var cur=Math.min(Math.max(1, S._spPage||1), pages); S._spPage=cur;
  var pageG=per?groups.slice((cur-1)*per, cur*per):groups;
  var base=[], bno=[], no0=per?(cur-1)*per:0; S._btMap={}; S._btKid={};
  pageG.forEach(function(g,gi){
    var n=g.kids.length+1, mo=spVarOpen_(g.key), so=String(no0+gi+1);
    if(!PT && n>1) S._btMap[spKeyOf_(g.head)]={key:g.key, n:n, mo:mo};
    base.push(g.head); bno.push(so);
    if(mo) g.kids.forEach(function(x,ki){ S._btKid[spKeyOf_(x)]=1; base.push(x); bno.push(so+'.'+(ki+1)); });
  });
  // Combo đang mở -> chèn SP đi kèm thành DÒNG THẬT ngay dưới (đúng cột, giống biến thể),
  // thay cho khối gộp 1 ô trước đây. S._rowMeta chạy song song với S._spList để biết
  // dòng nào là SP đi kèm (có ×SL), dòng nào là dòng tổng / dòng báo trạng thái.
  var list=[], meta=[];
  base.forEach(function(p,bi){
    var so=bno[bi];
    list.push(p); meta.push({k:'', no:PT?'':so});
    if(PT || !spCbMo_(p)) return;
    var ds=(S._catCb||{})[catCbKey_(p)];
    if(!ds){ list.push(p); meta.push({k:'note', t:'Đang tải sản phẩm đi kèm…'}); return; }
    if(!ds.length){ list.push(p); meta.push({k:'note', t:'Không có sản phẩm đi kèm.'}); return; }
    var tong=0;
    ds.forEach(function(x,ci){ var sl=Number(x.comboSL)||1;
      tong+=(Number(x.donGiaBan)||0)*sl; list.push(x); meta.push({k:'cb', sl:sl, no:so+'.'+(ci+1)}); });
    list.push(p); meta.push({k:'sum', n:ds.length, tong:tong});
  });
  S._spList=list; S._rowMeta=meta;
  if(PT) S._ptRows=list;

  var cnt=document.getElementById('spCount');
  if(cnt) cnt.textContent = full.length+(PT?' công việc':' SP');
  spColChips_(); spRenderHead_();

  var vis=spVisCols_(), ncol=vis.length+2, edit=!!S._spEdit;
  document.getElementById('spBody').innerHTML = list.length ? list.map(function(p,i){
    var m=(S._rowMeta||[])[i];
    if(m&&m.k==='note') return '<tr class="sp-cbrow"><td colspan="'+ncol+'"><div class="sp-cbnote">'+esc(m.t)+'</div></td></tr>';
    if(m&&m.k==='sum') return '<tr class="sp-cbsum"><td colspan="'+ncol+'">'
      +'<span class="sp-cbsl">Tổng combo · '+m.n+' sản phẩm đi kèm</span><b>'+money(m.tong)+' đ</b></td></tr>';
    var key=spKeyOf_(p), sel=!!S._spSel[key];
    var daCo = PT && ptDaCo_(p.sec,p.a);
    var drag = (!PT && !edit) ? ' draggable="true" ondragstart="spRowDragStart(event,'+i+')" ondragend="spRowDragEnd()"' : '';
    return '<tr class="sp-row'+(PT?' ptrow':'')+(daCo?' da':'')+(sel?' selrow':'')+(edit?' editrow':'')
        +((m&&m.k==='cb')?' sp-cbkid':((S._btKid&&S._btKid[key])?' sp-btkid':''))+'"'+drag
        +(edit?'':' onclick="spOpen_('+i+')"')+'>'
      +'<td class="selcol" onclick="event.stopPropagation()"><input type="checkbox" class="spck" data-k="'+esc(key)+'" '+(sel?'checked':'')
        +' onclick="spSelToggle(\''+esc(key)+'\',this.checked)"></td>'
      +vis.map(function(c){
          return '<td class="'+c[2]+((edit&&spCellEditable_(c,p))?' edt':'')+'">'
            +(edit?spEditCellAny_(c,p,i):c[3](p,i))+'</td>'; }).join('')
      +'<td class="act-sp" onclick="event.stopPropagation()">'+spRowActions_(p,i)+'</td>'
    +'</tr>';
  }).join('') : ('<tr><td colspan="'+ncol+'"><div class="empty" style="margin:10px">'
      +(PT?'Không có công tác nào khớp bộ lọc.':'Không có sản phẩm khớp bộ lọc.')+'</div></td></tr>');

  var all=document.getElementById('spCkAll');
  if(all) all.checked = list.length>0 && list.every(function(p){ return S._spSel[spKeyOf_(p)]; });
  spPager_(groups.length, cur, pages, per, full.length);
  spFreeze_(); spBulkBar_(); spEditBtnSync_();
  spHBarInit_(); spHBarSync_(); spXlsSync_();
}
function spSelToggle(k,on){ S._spSel=S._spSel||{}; if(on) S._spSel[k]=1; else delete S._spSel[k]; spFilter(); }
function spSelAll(on){
  S._spSel={};
  if(on){
    if(spPTMode_()) (S._ptRows||[]).forEach(function(r){ S._spSel[ptSelKey_(r)]=1; });
    else (S._spList||[]).forEach(function(p){ var k=String(p.recordId||p.ma||''); if(k) S._spSel[k]=1; });
  }
  spFilter();
}
// đổi khoá đã chọn -> danh sách sản phẩm tương ứng
function spSelProds_(){ var sel=S._spSel||{};
  return (S._spList||[]).concat(S.products||[]).filter(function(p,i,arr){
    var k=String(p.recordId||p.ma||''); if(!sel[k]) return false;
    return arr.findIndex(function(q){return String(q.recordId||q.ma||'')===k;})===i;   // bỏ trùng
  }); }
function spClearSel(){ S._spSel={}; spFilter(); }
/* ═══════════ THANH CHỌN NHIỀU — một thiết kế cho cả 2 hạng mục ═══════════
   Thanh nổi cố định ở đáy màn hình:
     [số đã chọn ✕] | hành động chính | Sửa hàng loạt ▾ | ⋯
   "Sửa hàng loạt" và các thao tác phụ nằm trong bảng thả xuống nên thanh luôn gọn,
   không bị chen chúc / đè lên nhau như trước.                                      */
var SP_BULK_F=[['CHIẾT KHẤU ĐẠI LÝ (%)','Chiết khấu (%)'],['GIÁ BÁN LẺ','Giá bán lẻ'],['THƯƠNG HIỆU','Thương hiệu'],
  ['NHÀ CUNG CẤP','Nhà cung cấp'],['HẠNG MỤC','Hạng mục SP'],['DÒNG SẢN PHẨM','Dòng sản phẩm'],
  ['BẢO HÀNH (năm)','Bảo hành (năm)'],['TRẠNG THÁI','Trạng thái'],['ĐƠN VỊ TÍNH','Đơn vị tính']];
function spBulkFields_(){
  return spPTMode_() ? CT_BULK_F.map(function(x){ return [x[0],x[1]]; }) : SP_BULK_F;
}
function spBulkBar_(){
  var wrap=document.getElementById('spBulkWrap'); if(!wrap) return;
  var n=Object.keys(S._spSel||{}).length;
  if(!n){ wrap.innerHTML=''; spBulkPopClose_(); return; }
  var PT=spPTMode_(), isAdmin=isAdminRole_();
  var dv = PT?'công tác':'sản phẩm';
  var chinh = PT
    ? '<button class="bb-b primary" onclick="ptBulkAdd_()">'+icon('plus',15)+' Thêm vào bảng khái toán</button>'
    : '<button class="bb-b primary" onclick="spBulkToProject()">'+icon('plus',15)+' Thêm vào dự án</button>';
  var fav = PT ? 'ctFavBulk_(1)' : 'spFavBulk(1)';
  var duyet = PT ? 'ctDuyetBulk_(1)' : 'spDuyetBulk(1)';
  wrap.innerHTML='<div class="bbar" id="spBulkBar">'
    +'<div class="bb-count"><b>'+n+'</b><span>'+dv+' đã chọn</span>'
      +'<button class="bb-x" title="Bỏ chọn (Esc)" onclick="spClearSel()">✕</button></div>'
    +'<div class="bb-sep"></div>'
    +chinh
    +'<button class="bb-b" onclick="'+fav+'" title="Lưu vào danh sách yêu thích">'+icon('heart',15)+' Yêu thích</button>'
    +(spCanDuyet_()?'<button class="bb-b" onclick="'+duyet+'" title="Đánh dấu Đã duyệt">'+icon('check',15)+' Duyệt</button>':'')
    +'<button class="bb-b" id="bbEditBtn" onclick="spBulkEditPop_(event)" title="Đổi một trường cho tất cả dòng đã chọn">'
      +icon('edit',15)+' Sửa hàng loạt <i class="bb-car">▾</i></button>'
    +'<div class="bb-sep"></div>'
    +'<button class="bb-ic" id="bbMoreBtn" onclick="spBulkMorePop_(event)" title="Thao tác khác">⋯</button>'
  +'</div>';
}
function spBulkPopClose_(){
  ['bbEditPop','bbMorePop'].forEach(function(id){ var e=document.getElementById(id); if(e) e.remove(); });
  document.removeEventListener('mousedown',spBulkPopOutside_);
}
function spBulkPopOutside_(e){
  if(e.target.closest('#bbEditPop')||e.target.closest('#bbMorePop')
    ||e.target.closest('#bbEditBtn')||e.target.closest('#bbMoreBtn')) return;
  spBulkPopClose_();
}
function spBulkPopPlace_(pop,btnId){
  var b=document.getElementById(btnId); if(!b) return;
  var r=b.getBoundingClientRect(), w=pop.offsetWidth||280;
  pop.style.left=Math.max(10,Math.min(r.left+r.width/2-w/2, window.innerWidth-w-10))+'px';
  pop.style.top=Math.max(10,r.top-pop.offsetHeight-10)+'px';
}
function spBulkEditPop_(e){
  if(e&&e.stopPropagation) e.stopPropagation();
  if(document.getElementById('bbEditPop')){ spBulkPopClose_(); return; }
  spBulkPopClose_();
  var F=spBulkFields_();
  var pop=document.createElement('div'); pop.className='bb-pop'; pop.id='bbEditPop';
  pop.innerHTML='<div class="bb-pop-h">Sửa hàng loạt <span>'+Object.keys(S._spSel||{}).length+' dòng</span></div>'
    +'<div class="bb-pop-b">'
      +'<label>Trường cần đổi</label>'
      +'<select id="spbField">'+F.map(function(f){ return '<option value="'+esc(f[0])+'">'+esc(f[1])+'</option>'; }).join('')+'</select>'
      +'<label>Giá trị mới</label>'
      +'<input id="spbValue" placeholder="Nhập giá trị…" onkeydown="if(event.key===\'Enter\')spBulkApplyAny_()">'
    +'</div>'
    +'<div class="bb-pop-f"><button class="btn ghost sm" onclick="spBulkPopClose_()">Huỷ</button>'
      +'<button class="btn blue sm" id="spbApplyBtn" onclick="spBulkApplyAny_()">'+icon('check',14)+' Áp dụng</button></div>';
  document.body.appendChild(pop); spBulkPopPlace_(pop,'bbEditBtn');
  setTimeout(function(){ document.addEventListener('mousedown',spBulkPopOutside_);
    var v=document.getElementById('spbValue'); if(v) v.focus(); },0);
}
function spBulkApplyAny_(){
  var f=document.getElementById('spbField'), v=document.getElementById('spbValue');
  if(!f||!v) return;
  var fld=f.value, val=v.value, nhan=f.options.length?f.options[f.selectedIndex].text:fld;
  if(String(val).trim()===''){ toast('Chưa nhập giá trị mới'); v.focus(); return; }
  spBulkPopClose_();
  return spPTMode_() ? ctBulkEditRun_(fld,val) : spBulkApply(fld,val,nhan);
}
function spBulkMorePop_(e){
  if(e&&e.stopPropagation) e.stopPropagation();
  if(document.getElementById('bbMorePop')){ spBulkPopClose_(); return; }
  spBulkPopClose_();
  var PT=spPTMode_(), isAdmin=isAdminRole_(), n=Object.keys(S._spSel||{}).length;
  var pop=document.createElement('div'); pop.className='bb-pop bb-menu'; pop.id='bbMorePop';
  pop.innerHTML=
     '<button onclick="spBulkPopClose_();'+(PT?'ptBulkXlsx_()':'spExportXlsx()')+'">'+icon('download',15)+' Tải Excel '+n+' dòng</button>'
    +(spCanDuyet_()?'<button onclick="spBulkPopClose_();'+(PT?'ctDuyetBulk_(0)':'spDuyetBulk(0)')+'">'+icon('close',15)+' Bỏ duyệt</button>':'')
    +'<button onclick="spBulkPopClose_();'+(PT?'ctFavBulk_(0)':'spFavBulk(0)')+'">'+icon('heart',15)+' Bỏ yêu thích</button>'
    +'<div class="bb-menu-sep"></div>'
    +'<button class="danger" onclick="spBulkPopClose_();'
      +(PT?'ctDeleteBulk_()':(isAdmin?'spBulkDelete()':'spBulkRequest()'))+'">'+icon('trash',15)+' '
      +(PT?'Xoá công tác':(isAdmin?'Xoá sản phẩm':'Gửi yêu cầu xoá'))+'</button>';
  document.body.appendChild(pop); spBulkPopPlace_(pop,'bbMoreBtn');
  setTimeout(function(){ document.addEventListener('mousedown',spBulkPopOutside_); },0);
}
// Esc: bỏ chọn nhanh
document.addEventListener('keydown',function(e){
  if(e.key!=='Escape') return;
  if(document.getElementById('bbEditPop')||document.getElementById('bbMorePop')){ spBulkPopClose_(); return; }
  if(Object.keys(S._spSel||{}).length && document.getElementById('spBulkBar')) spClearSel();
});
// SỬA HÀNG LOẠT: đặt 1 giá trị cho tất cả SP đang chọn
async function spBulkApply(larkIn, valIn, labelIn){
  var f=document.getElementById('spbField'), v=document.getElementById('spbValue'), btn=document.getElementById('spbApplyBtn');
  var lark = larkIn!=null?larkIn:(f?f.value:'');
  var val  = String(valIn!=null?valIn:(v?v.value:'')).trim();
  var label= labelIn || (f&&f.options.length?f.options[f.selectedIndex].text:lark);
  if(!lark) return;
  if(val===''){ toast('Chưa nhập giá trị mới'); if(v) v.focus(); return; }
  var all=spSelProds_(); if(!all.length) return;
  var prods=all.filter(function(p){return !p.spChung;}), bo=all.length-prods.length;
  if(!prods.length){ toast('Các sản phẩm đã chọn đều thuộc kho chung của Dezon — không sửa được'); return; }
  if(!confirm('Đặt "'+label+'" = "'+val+'" cho '+prods.length+' sản phẩm đã chọn?'
    +(bo?'\n(Bỏ qua '+bo+' sản phẩm kho chung Dezon)':''))) return;
  if(btn){ btn.disabled=true; }
  var ok=0, errs=[], undo=[];
  var col=(typeof DB_LABEL2COL_!=='undefined')?DB_LABEL2COL_[lark]:'';
  for(var i=0;i<prods.length;i++){
    if(btn) btn.textContent='⏳ '+(i+1)+'/'+prods.length+'…';
    var d={}; d['MÃ SẢN PHẨM']=prods[i].ma; d[lark]=val;
    var truoc=(col && prods[i].raw && prods[i].raw[col]!=null) ? String(prods[i].raw[col]) : '';
    try{ await api('updateDbProductTracked', String(prods[i].recordId||prods[i].ma), d); ok++;
      undo.push({key:String(prods[i].recordId||prods[i].ma), ma:prods[i].ma, lark:lark, col:col, old:truoc}); }
    catch(e){ if(errs.length<3) errs.push((prods[i].ma||'?')+': '+e.message.slice(0,60)); }
  }
  spUndoPush_(undo, 'sửa hàng loạt '+label+' cho '+ok+' SP');
  S.products=await api('getProducts')||S.products;
  spFilter(); renderFilters&&renderFilters(); renderCatalog&&renderCatalog();
  if(errs.length) toast('Cập nhật '+ok+'/'+prods.length+' — lỗi: '+errs.join(' | '));
  else toast('Đã đặt '+label+' = "'+val+'" cho '+ok+' sản phẩm');
}
async function spBulkDelete(){
  var prods=spSelProds_().filter(function(p){return !p.spChung;});
  var keys=prods.map(function(p){return String(p.recordId||p.ma||'');}).filter(Boolean);
  if(!keys.length){ toast('Không có sản phẩm nào xoá được (kho chung Dezon chỉ xem)'); return; }
  var bo=Object.keys(S._spSel||{}).length-keys.length;
  if(!confirm('Xóa '+keys.length+' sản phẩm khỏi danh mục? Không thể hoàn tác.'
    +(bo?'\n(Bỏ qua '+bo+' sản phẩm kho chung Dezon)':''))) return;
  var ok=0; for(var i=0;i<keys.length;i++){ try{ await api('deleteDbProduct', keys[i]); ok++; }catch(e){} }
  S._spSel={}; S.products=await api('getProducts')||S.products; spFilter(); renderFilters&&renderFilters(); renderCatalog&&renderCatalog();
  toast('Đã xóa '+ok+' sản phẩm');
}
async function spBulkRequest(){
  var sel=S._spSel||{}; var byMa={}; (S.products||[]).forEach(function(p){ byMa[p.ma]=p; });
  var items=Object.keys(sel).map(function(ma){ var p=byMa[ma]||{}; return {maSP:ma, ten:p.ten||''}; });
  if(!items.length) return;
  try{ var r=await api('requestDeleteProducts', items); S._spSel={}; spFilter(); refreshNotifCount_(); toast('Đã gửi yêu cầu xóa '+r.count+' sản phẩm tới Admin'); }
  catch(e){ toast('Lỗi: '+e.message); }
}
function spModal(i){
  var p=(S._spList||[])[i]; if(!p) return;
  var ov=document.createElement('div'); ov.className='sp-modal-ov'; ov.id='spModalOv';
  ov.onclick=function(e){ if(e.target===ov) spClose(); };
  var duyet=p.daDuyet?'<span class="spduyet on">Đã duyệt</span>':'<span class="spduyet">Chưa duyệt</span>';
  ov.innerHTML='<div class="sp-modal sp-modal-wide pd"><div class="pd-head"><h3>Thông tin sản phẩm</h3>'
      +duyet+'<button class="pd-x" onclick="spClose()">✕</button></div>'
    +'<div class="pdm-grid">'
      +'<div class="pdm-left">'+pdMedia_(p)+pdPriceFoot_(p)+'</div>'
      +'<div class="pdm-right">'+pdSpecs_(p)+'</div>'
    +'</div>'
    +'<div id="pdComboModal"></div>'
    +'<div class="pd-actions">'
      +'<button class="btn ghost sm" onclick="spClose()">Đóng</button>'
      +((spCanEdit_()&&!p.spChung)?'<button class="btn ghost sm" onclick="spClose();spEditModal('+i+')">'+icon('edit',14)+' Cập nhật</button>':'')
      +'<button class="btn blue" onclick="spAddToProject('+i+')">'+icon('plus',15)+' Thêm vào dự án</button>'
    +'</div></div>';
  document.body.appendChild(ov);
  document.addEventListener('keydown',spModalKey_);
  pdLoadCombo_(p, i, 'dự án', 'pdComboModal');
}
/* Nạp & hiện danh sách sản phẩm đi kèm trong modal chi tiết */
async function pdLoadCombo_(p, idx, dich, boxId){
  var box=document.getElementById(boxId||'pdCombo'); if(!box) return;
  var list=[];
  try{ list=await api('getCombo', String(p.recordId||p.ma))||[]; }catch(e){ list=[]; }
  S._pdCombo=list; S._pdComboBox={idx:idx, dich:dich, boxId:boxId||'pdCombo'};
  S._pdComboBo=1;                       // mỗi lần mở sản phẩm khác thì số bộ về 1
  pdComboVe_();
}
/* Khối "Sản phẩm đi kèm" — bố cục C:
   · Danh sách ở trên để trống trải, không khung lồng khung.
   · SỐ BỘ nằm ngay cạnh nút "Thêm combo" — chỉnh xong bấm liền tay.
   · SL kèm mỗi dòng vẫn sửa được: ô không viền, nhìn như chữ, bấm vào là gõ. */
function pdComboVe_(){
  var o=S._pdComboBox||{}, list=S._pdCombo||[];
  var box=document.getElementById(o.boxId||'pdCombo'); if(!box) return;
  if(!list.length){ box.innerHTML=''; return; }
  var bo=pdCbBo_();
  var tong=list.reduce(function(a,x){ return a+(Number(x.donGiaBan)||0)*(Number(x.comboSL)||1)*bo; },0);
  var rows=list.map(function(x,k){
    var sl=Number(x.comboSL)||1, dg=Number(x.donGiaBan)||0, slTong=sl*bo;
    var tip=x.comboNguoc?' title="Liên kết đặt từ phía sản phẩm kia — đi kèm 2 chiều"':'';
    return '<div class="cbi"'+tip+' draggable="true"'
      +' ondragstart="pdComboDrag_(event,'+k+')" ondragend="prodDragEnd()">'
      +(x.hinhAnh?'<img class="cbi-th" src="'+esc(imgSrc1_(x.hinhAnh))+'" onerror="this.style.visibility=\'hidden\'">':'<span class="cbi-th"></span>')
      +'<div class="cbi-m">'
        +'<b>'+esc(x.ten||'')+(x.comboNguoc?' <span class="cbi-rev">↔</span>':'')+'</b>'
        +'<span class="cbi-sub">'+esc(x.ma||'')+' · '+money(dg)+' đ/cái</span>'
      +'</div>'
      +'<div class="cbi-p">'
        +'<b>'+money(dg*slTong)+' đ</b>'
        +'<span class="cbi-q" title="Số lượng đi kèm cho MỖI bộ — bấm để sửa">'
          +'<input type="number" min="1" step="1" value="'+sl+'"'
            +' onclick="event.stopPropagation()" onchange="pdCbSL_('+k+',null,this.value)">'
          +(bo>1?('<em>× '+bo+'</em>'):'')+' cái</span>'
      +'</div>'
    +'</div>';
  }).join('');
  box.innerHTML='<div class="pd-block pd-combo">'
    +'<div class="pd-sec">Sản phẩm đi kèm <i>('+list.length+')</i></div>'
    +'<div class="cbi-list">'+rows+'</div>'
    +'<div class="cbi-tot"><span>Tổng'+(bo>1?(' '+bo+' bộ'):'')+'</span><b>'+money(tong)+' đ</b></div>'
    +((o.idx==null||o.idx<0)?''
      :('<div class="cbi-act">'
        +'<span class="cbi-bost" title="Số bộ combo cần thêm">'
          +'<button class="cbi-b" onclick="event.stopPropagation();pdCbBoSet_(-1)">−</button>'
          +'<input type="number" min="1" step="1" value="'+bo+'" onclick="event.stopPropagation()"'
            +' onchange="pdCbBoSet_(null,this.value)">'
          +'<button class="cbi-b" onclick="event.stopPropagation();pdCbBoSet_(1)">+</button>'
        +'</span>'
        +'<button class="btn blue sm cbi-add" title="Thêm sản phẩm chính và toàn bộ sản phẩm đi kèm vào '+esc(o.dich||'bóc tách')+'"'
          +' onclick="pdAddCombo_('+o.idx+')">'+icon('plus',14)+' Thêm '+(bo>1?(bo+' bộ'):'combo')+'</button>'
      +'</div>'))
  +'</div>';
}
/* Số BỘ combo — số lượng mỗi dòng nhân với số này */
function pdCbBo_(){ return Math.max(1, Math.min(999, Number(S._pdComboBo)||1)); }
function pdCbBoSet_(d, giaTri){
  var bo = (giaTri!=null&&giaTri!=='') ? Math.round(Number(String(giaTri).replace(',','.'))||0)
                                       : pdCbBo_()+(Number(d)||0);
  S._pdComboBo = Math.max(1, Math.min(999, bo||1));
  pdComboVe_();
}
/* Đổi số lượng 1 dòng combo: d=+1/-1 hoặc nhập thẳng số */
function pdCbSL_(k, d, giaTri){
  var x=(S._pdCombo||[])[k]; if(!x) return;
  var sl = (giaTri!=null&&giaTri!=='') ? Math.round(Number(String(giaTri).replace(',','.'))||0)
                                       : (Number(x.comboSL)||1)+(Number(d)||0);
  x.comboSL = Math.max(1, Math.min(9999, sl||1));
  pdComboVe_();
}
// Thêm sản phẩm chính + toàn bộ sản phẩm đi kèm vào dự án / bóc tách
async function pdAddCombo_(idx){
  var list=S._pdCombo||[], bo=pdCbBo_();
  var okTab=document.getElementById('v-sanpham').classList.contains('on');
  if(okTab){
    var chinh=(S._spList||[])[idx];
    if(chinh){ if(!S.cur){ toast('Chưa chọn dự án'); return; }
      await addProdObj(chinh, undefined, bo); renderSpProjPanel_(); setTimeout(renderSpProjPanel_,700); }
  } else {
    var p=(S._filtered||[])[idx];
    if(p) await addProdObj(p, S.selFloor||'', bo);
  }
  for(var k=0;k<list.length;k++){
    var x=list[k];
    await addProdObj(x, S.selFloor||'', (Number(x.comboSL)||1)*bo);   // 1 dòng, đúng số lượng × số bộ
  }
  toast('Đã thêm '+(bo>1?(bo+' bộ combo'):'combo')+': sản phẩm chính + '+list.length+' sản phẩm đi kèm');
}
// ←/→ lật ảnh ngay trong modal chi tiết, Esc để đóng
function spModalKey_(e){
  if(!document.getElementById('spModalOv')) return;
  if(document.getElementById('imgPop') && document.getElementById('imgPop').style.display==='flex') return;
  if(e.key==='Escape'){ spClose(); }
  else if(e.key==='ArrowLeft'){ e.preventDefault(); pdGoImg_(-1); }
  else if(e.key==='ArrowRight'){ e.preventDefault(); pdGoImg_(1); }
}
function spClose(){ var o=document.getElementById('spModalOv'); if(o)o.remove(); document.removeEventListener('keydown',spModalKey_); }
// ===== Cập nhật sản phẩm + lịch sử =====
// Nhãn (Lark) -> cột DB. Modal SỬA dùng CHUNG DB_GROUPS với form NHẬP -> 2 bên luôn giống nhau.
var DB_LABEL2COL_={
  'MÃ SẢN PHẨM':'ma_sp','TÊN SẢN PHẨM':'ten_sp','DÒNG SẢN PHẨM':'dong_sp','HẠNG MỤC':'hang_muc','NHÓM SẢN PHẨM':'nhom_sp',
  'THƯƠNG HIỆU':'thuong_hieu','NHÀ CUNG CẤP':'nha_cung_cap','CÔNG SUẤT (W)':'cong_suat_w','NHIỆT ĐỘ MÀU (K)':'nhiet_do_mau_k',
  'QUANG THÔNG (lm)':'quang_thong_lm','GÓC CHIẾU (°)':'goc_chieu_deg','GÓC NGHIÊNG (°)':'goc_nghieng_deg','MÀU SẮC':'mau_sac',
  'CHẤT LIỆU':'chat_lieu','CHIỀU CAO (mm)':'chieu_cao_mm','ĐƯỜNG KÍNH (mm)':'duong_kinh_mm','LỖ KHOÉT TRẦN (mm)':'cutout_mm',
  'CHỈ SỐ IP':'chi_so_ip','CRI':'cri','HIỆU SUẤT PHÁT QUANG (lm/W)':'hieu_suat_lm_w','UGR':'ugr','SDCM':'sdcm','COI':'coi',
  'TUỔI THỌ':'tuoi_tho','TÊN CHIP LED':'ten_chip_led','LOẠI CHIP LED':'loai_chip_led','CẤP BẢO VỆ ĐIỆN':'class_rating','LẮP NGUỒN RỜI':'lap_nguon_roi',
  'TÊN BỘ NGUỒN':'ten_bo_nguon','MÃ BỘ NGUỒN':'ma_bo_nguon','HÃNG BỘ NGUỒN':'hang_bo_nguon','GIÁ BÁN BỘ NGUỒN':'gia_ban_bo_nguon','VỊ TRÍ LẮP NGUỒN':'vi_tri_lap_nguon',
  'TƯƠNG THÍCH ĐIỀU KHIỂN':'dieu_khien','DÒNG RA TỐI ĐA (mA)':'dong_ra_max_ma','BẢO HÀNH (năm)':'bao_hanh_nam','ĐƠN VỊ TÍNH':'dvt',
  'GIÁ BÁN LẺ':'gia_ban_le','CHIẾT KHẤU ĐẠI LÝ (%)':'ck_dai_ly_pct','ẢNH SẢN PHẨM':'anh_sp','LINK DATASHEET':'link_datasheet',
  'TRẠNG THÁI':'trang_thai','GHI CHÚ':'ghi_chu',
  // ---- Ngành THIẾT BỊ VỆ SINH (db/thiet_bi_ve_sinh.sql) ----
  'NGÀNH HÀNG':'nganh','KÍCH THƯỚC':'kich_thuoc','HỆ THỐNG XẢ':'he_thong_xa',
  'LƯỢNG NƯỚC XẢ':'luong_nuoc_xa','THIẾT KẾ':'thiet_ke','TÂM XẢ':'tam_xa',
  'ÁP LỰC NƯỚC':'ap_luc_nuoc','LƯU Ý':'luu_y','TÍNH NĂNG':'tinh_nang',
  'GIÁ ĐẠI LÝ':'gia_dai_ly'   // chỉ HIỂN THỊ: cột tự tính, server bỏ qua khi lưu
};
Object.keys(VS_SPEC.METRIC).forEach(function(lb){ if(!DB_LABEL2COL_[lb]) DB_LABEL2COL_[lb]=VS_SPEC.METRIC[lb][0]; });
var SP_COL2LABEL_={}; Object.keys(DB_LABEL2COL_).forEach(function(k){ SP_COL2LABEL_[DB_LABEL2COL_[k]]=k; });
// Dựng 1 ô nhập trong modal Sửa theo ĐÚNG định nghĩa của form Nhập (nhãn, kiểu, gợi ý, danh sách chọn)
function speField_(f, raw){
  var lark=f[0], label=f[1], type=f[2], req=f[3], opts=f[4]||[], ph=f[5]||label;
  var col=DB_LABEL2COL_[lark]; if(!col) return '';
  var val=raw[col]==null?'':String(raw[col]);
  if(lark==='LẮP NGUỒN RỜI') val=(val===true||val==='true')?'Có':(val?'Có':'');
  var star=req?' <span class="spe-req">*</span>':'';
  var inner;
  if(type==='hm'){
    var hmC=VS_SPEC.chuanHM(val)||val;
    inner='<select data-col="'+col+'" onchange="vsApplyHM_(document.getElementById(\'spEditOv\'),this.value,1)"><option value="">— Chọn hạng mục —</option>'
      +opts.concat(hmC&&opts.indexOf(hmC)<0?[hmC]:[]).map(function(o){ return '<option value="'+esc(o)+'"'+(o===hmC?' selected':'')+'>'+esc(o)+'</option>'; }).join('')+'</select>';
    return '<div class="spe-f"><label>'+esc(label)+star+'</label>'+inner+'</div>';
  }
  if(type==='area') inner='<textarea data-col="'+col+'" placeholder="'+esc(ph)+'">'+esc(val)+'</textarea>';
  else if(type==='calc') inner='<input data-col="'+col+'" class="calc" value="'+esc(val)+'" readonly placeholder="Tự tính từ giá bán & %CK">';
  else if(type==='sel') inner='<input data-col="'+col+'" list="spe_dl_'+col+'" value="'+esc(val)+'" placeholder="'+esc(ph)+'">'
      +'<datalist id="spe_dl_'+col+'">'+opts.map(function(o){return '<option value="'+esc(o)+'">';}).join('')+'</datalist>';
  else {
    var trg=(lark==='GIÁ BÁN LẺ'||lark==='CHIẾT KHẤU ĐẠI LÝ (%)')?' oninput="speCalcDaiLy_()"':'';
    inner='<input type="'+(type==='num'?'number':'text')+'" data-col="'+col+'" value="'+esc(val)+'" placeholder="'+esc(ph)+'"'+trg+(lark==='MÃ SẢN PHẨM'?' readonly':'')+'>';
  }
  return '<div class="spe-f'+(type==='area'?' wide':'')+'"'+(f[6]==='vs'?' data-vs="'+esc(lark)+'"':'')+'><label>'+esc(label)+star+'</label>'+inner+'</div>';
}
function fmtDateTime_(v){
  if(v==null||v==='') return '—';
  var d=new Date(v); if(isNaN(d.getTime())) return String(v);
  var z=function(n){ return (n<10?'0':'')+n; };
  return z(d.getDate())+'/'+z(d.getMonth()+1)+'/'+d.getFullYear()+' '+z(d.getHours())+':'+z(d.getMinutes());
}
/* ═══ COMBO: chọn sản phẩm đi kèm ═══
   Dùng trong modal Sửa (quản lý danh sách) và modal Chi tiết (xem + thêm cả combo).
   S._combo = [{id, ma, ten, hinhAnh, donGiaBan, comboSL}]                        */
function cbRow_(x,i){
  return '<div class="cb-item">'
    +(x.hinhAnh?'<img class="cb-img" src="'+esc(imgSrc1_(x.hinhAnh))+'" onerror="this.style.visibility=\'hidden\'">':'<span class="cb-img"></span>')
    +'<div class="cb-info"><div class="cb-nm" title="'+esc(x.ten||'')+'">'+esc(x.ten||'')
        +(x.comboNguoc?'<span class="cb-rev" title="Liên kết được đặt từ phía sản phẩm này (bộ gồm 1 '+esc(x.ma||'')+' + '+(Number(x.comboBoSL)||1)+' sản phẩm đang mở). Bỏ ở đây thì bên kia cũng mất.">↔ hai chiều</span>':'')+'</div>'
      +'<div class="cb-sub">'+esc(x.ma||'')+(x.donGiaBan?' · '+money(x.donGiaBan)+'đ':'')+'</div></div>'
    +'<label class="cb-sl" title="Số lượng đi kèm cho mỗi sản phẩm chính">×'
      +'<input type="number" min="0" step="1" value="'+(Number(x.comboSL)||1)+'" oninput="cbSetSL_('+i+',this.value)"></label>'
    +'<button class="cb-del" title="Bỏ khỏi combo" onclick="cbRemove_('+i+')">'+icon('x',14)+'</button>'
  +'</div>';
}
function cbRender_(){
  var box=document.getElementById('cbList'); if(!box) return;
  var list=S._combo||[];
  box.innerHTML=list.length?list.map(cbRow_).join('')
    :'<div class="cb-empty">Chưa chọn sản phẩm nào đi kèm. Gõ tên/mã ở ô trên để tìm và thêm.</div>';
  var n=document.getElementById('cbCount'); if(n) n.textContent=list.length;
}
function cbSetSL_(i,v){ var x=(S._combo||[])[i]; if(x) x.comboSL=Math.max(0,Number(v)||0); }
function cbRemove_(i){ (S._combo||[]).splice(i,1); cbRender_(); }
function cbAdd_(recordId){
  var p=(S.products||[]).filter(function(x){ return String(x.recordId)===String(recordId); })[0];
  if(!p) return;
  S._combo=S._combo||[];
  if(String(p.recordId)===String(S._spEditRecId)){ toast('Không thể cho sản phẩm đi kèm chính nó'); return; }
  if(S._combo.some(function(x){ return String(x.recordId)===String(p.recordId); })){ toast('Sản phẩm này đã có trong combo'); return; }
  S._combo.push({recordId:p.recordId, ma:p.ma, ten:p.ten, hinhAnh:p.hinhAnh, donGiaBan:p.donGiaBan, comboSL:1});
  cbRender_(); cbSearch_('');
  var inp=document.getElementById('cbSearch'); if(inp){ inp.value=''; inp.focus(); }
}
/* SP đang sửa là thiết bị vệ sinh? -> chữ hướng dẫn, gợi ý & nhãn theo ngành vệ sinh */
function cbVS_(){ return nganhCuaSP_(S._spEditP)==='vs'; }
function cbLbl_(p){ return nganhCuaSP_(p)==='vs'
  ? [VS_SPEC.chuanHM(p.hangMuc)||p.hangMuc, p.mauSac].filter(Boolean).join(' · ')
  : [p.congSuat, p.nhietDo].filter(Boolean).join(' · '); }
function cbSearch_(q){
  var box=document.getElementById('cbSug'); if(!box) return;
  q=String(q||'').trim().toLowerCase();
  var cur=String(S._spEditRecId||''), me=S._spEditP||{}, ng=nganhCuaSP_(me);
  var chon={}; (S._combo||[]).forEach(function(x){ chon[String(x.recordId)]=1; });
  var ok=function(p){ return String(p.recordId)!==cur && !chon[String(p.recordId)]; };
  var hit, tieuDe='';
  if(q.length<1){
    // Ô trống: thiết bị vệ sinh gợi ý SP thuộc các hạng mục hay đi kèm (bồn cầu -> nắp rửa, lavabo -> vòi…)
    var h=(ng==='vs')?VS_SPEC.hmOf(me.hangMuc):null;
    if(!h||!h.kem.length){ box.innerHTML=''; box.style.display='none'; return; }
    hit=(S.products||[]).filter(function(p){ return ok(p) && nganhCuaSP_(p)==='vs' && h.kem.indexOf(VS_SPEC.chuanHM(p.hangMuc))>=0; }).slice(0,8);
    if(!hit.length){ box.innerHTML=''; box.style.display='none'; return; }
    tieuDe='<div class="cb-sug-h">Gợi ý đi kèm: '+esc(h.kem.join(', '))+'</div>';
  } else {
    hit=(S.products||[]).filter(function(p){
      return ok(p) && ((p.ten||'')+' '+(p.ma||'')+' '+(p.thuongHieu||'')+' '+(p.hangMuc||'')).toLowerCase().indexOf(q)>=0;
    });
    // cùng ngành với SP đang sửa lên trước (vệ sinh đi với vệ sinh, đèn đi với đèn)
    hit.sort(function(a,b){ return (nganhCuaSP_(a)===ng?0:1)-(nganhCuaSP_(b)===ng?0:1); });
    hit=hit.slice(0,8);
  }
  box.innerHTML=hit.length?tieuDe+hit.map(function(p){
    var lbl=cbLbl_(p);
    return '<button class="cb-sug" onmousedown="event.preventDefault()" onclick="cbAdd_(\''+esc(String(p.recordId))+'\')">'
      +(p.hinhAnh?'<img src="'+esc(imgSrc1_(p.hinhAnh))+'" onerror="this.style.visibility=\'hidden\'">':'<span class="cb-img"></span>')
      +'<span class="cb-sug-nm">'+esc(p.ten||'')+'<i>'+esc(p.ma||'')+(lbl?' · '+esc(lbl):'')+(p.donGiaBan?' · '+money(p.donGiaBan)+'đ':'')+'</i></span></button>';
  }).join(''):'<div class="cb-empty">Không tìm thấy sản phẩm khớp.</div>';
  box.style.display='block';
}
/* ═══ BIẾN THỂ: nhóm sản phẩm cùng dòng, do người dùng tự gom ═══
   S._bt = [{recordId, ma, ten, hinhAnh, donGiaBan, ...}] — chỉ là danh sách SP,
   không có số lượng như combo (biến thể là CÙNG một sản phẩm, khác thông số). */
function btLbl_(x){
  if(x.nganh==='vs') return [x.mauSac, x.raw&&x.raw.kich_thuoc].map(function(v){ return String(v==null?'':v).trim(); }).filter(Boolean).join(' · ');
  return [x.congSuat,x.nhietDo,x.gocChieu,x.mauSac].map(function(v){ return String(v==null?'':v).trim(); })
    .filter(Boolean).join(' · ');
}
function btRow_(x,i){
  var lbl=btLbl_(x);
  return '<div class="cb-item">'
    +(x.hinhAnh?'<img class="cb-img" src="'+esc(imgSrc1_(x.hinhAnh))+'" onerror="this.style.visibility=\'hidden\'">':'<span class="cb-img"></span>')
    +'<div class="cb-info"><div class="cb-nm" title="'+esc(x.ten||'')+'">'+esc(x.ten||'')+'</div>'
      +'<div class="cb-sub">'+esc(x.ma||'')+(lbl?' · '+esc(lbl):'')+(x.donGiaBan?' · '+money(x.donGiaBan)+'đ':'')+'</div></div>'
    +'<button class="cb-del" title="Bỏ khỏi nhóm biến thể" onclick="btRemove_('+i+')">'+icon('x',14)+'</button>'
  +'</div>';
}
function btRender_(){
  var box=document.getElementById('btList'); if(!box) return;
  var list=S._bt||[];
  box.innerHTML=list.length?list.map(btRow_).join('')
    :'<div class="cb-empty">Chưa gom biến thể nào. Sản phẩm trùng MÃ vẫn tự động là biến thể của nhau — ô này dùng khi muốn gom cả sản phẩm khác mã.</div>';
  var n=document.getElementById('btCount'); if(n) n.textContent=list.length;
}
function btRemove_(i){ (S._bt||[]).splice(i,1); btRender_(); }
function btAdd_(recordId){
  var p=(S.products||[]).filter(function(x){ return String(x.recordId)===String(recordId); })[0];
  if(!p) return;
  S._bt=S._bt||[];
  if(String(p.recordId)===String(S._spEditRecId)){ toast('Không thể gom sản phẩm với chính nó'); return; }
  if(S._bt.some(function(x){ return String(x.recordId)===String(p.recordId); })){ toast('Sản phẩm này đã có trong nhóm biến thể'); return; }
  if(String(p.nhomBT||'').trim()) toast('Sản phẩm này đang ở nhóm biến thể khác — lưu xong sẽ chuyển sang nhóm này');
  S._bt.push({recordId:p.recordId, ma:p.ma, ten:p.ten, hinhAnh:p.hinhAnh, donGiaBan:p.donGiaBan,
              congSuat:p.congSuat, nhietDo:p.nhietDo, gocChieu:p.gocChieu, mauSac:p.mauSac, nganh:p.nganh, raw:p.raw});
  btRender_(); btSearch_('');
  var inp=document.getElementById('btSearch'); if(inp){ inp.value=''; inp.focus(); }
}
function btSearch_(q){
  var box=document.getElementById('btSug'); if(!box) return;
  q=String(q||'').trim().toLowerCase();
  if(q.length<1){ box.innerHTML=''; box.style.display='none'; return; }
  var cur=String(S._spEditRecId||'');
  var chon={}; (S._bt||[]).forEach(function(x){ chon[String(x.recordId)]=1; });
  var hit=(S.products||[]).filter(function(p){
    if(String(p.recordId)===cur || chon[String(p.recordId)] || p.spChung) return false;
    return ((p.ten||'')+' '+(p.ma||'')+' '+(p.thuongHieu||'')).toLowerCase().indexOf(q)>=0;
  }).slice(0,8);
  box.innerHTML=hit.length?hit.map(function(p){
    var lbl=btLbl_(p);
    return '<button class="cb-sug" onclick="btAdd_(\''+esc(String(p.recordId))+'\')">'
      +(p.hinhAnh?'<img src="'+esc(imgSrc1_(p.hinhAnh))+'" onerror="this.style.visibility=\'hidden\'">':'<span class="cb-img"></span>')
      +'<span class="cb-sug-nm">'+esc(p.ten||'')+'<i>'+esc(p.ma||'')+(lbl?' · '+esc(lbl):'')+'</i></span></button>';
  }).join(''):'<div class="cb-empty">Không tìm thấy sản phẩm khớp.</div>';
  box.style.display='block';
}
/* Chuyển tab Combo / Biến thể trong khối "Sản phẩm liên quan" */
function cbTab_(v){
  S._cbTab=(v==='bt')?'bt':'combo';
  ['combo','bt'].forEach(function(k){
    var t=document.getElementById(k==='bt'?'cbTabBT':'cbTabCombo');
    var pane=document.getElementById(k==='bt'?'btPane':'cbPane');
    if(t) t.classList.toggle('on', S._cbTab===k);
    if(pane) pane.style.display=(S._cbTab===k)?'':'none';
  });
}
function cbSection_(){
  return '<div class="cb-box">'
    +'<div class="cb-h">'+icon('layers',15)+' Sản phẩm liên quan'
      +'<div class="cb-tabs">'
        +'<button type="button" class="cb-tab on" id="cbTabCombo" onclick="cbTab_(\'combo\')">Đi kèm (combo)<span class="cb-n" id="cbCount">0</span></button>'
        +'<button type="button" class="cb-tab" id="cbTabBT" onclick="cbTab_(\'bt\')">Biến thể<span class="cb-n" id="btCount">0</span></button>'
      +'</div></div>'
    +'<div id="cbPane">'
      +'<p class="cb-note">'+(cbVS_()
          ?'Chọn các thiết bị luôn bán/lắp cùng sản phẩm này (VD bồn cầu + nắp rửa điện tử + vòi xịt, lavabo + vòi lavabo + bộ xả). '
          :'Chọn các sản phẩm luôn bán/lắp cùng sản phẩm này (bộ nguồn, thanh ray…). ')
        +'Khi thêm vào dự án có thể thêm cả combo một lượt.</p>'
      +'<div class="cb-find"><input id="cbSearch" placeholder="Tìm theo tên, mã hoặc thương hiệu…" autocomplete="off" oninput="cbSearch_(this.value)" onfocus="cbSearch_(this.value)">'
        +'<div class="cb-sug-box" id="cbSug"></div></div>'
      +'<div class="cb-list" id="cbList"></div>'
    +'</div>'
    +'<div id="btPane" style="display:none">'
      +'<p class="cb-note">Gom các sản phẩm là CÙNG một sản phẩm nhưng khác thông số ('+(cbVS_()?'màu sắc, kích thước':'công suất, nhiệt độ màu, góc chiếu, màu')+'). '
        +'Bảng Danh sách SP và thư viện Bóc tách sẽ gộp chúng thành một dòng, bung ra mới thấy từng biến thể.</p>'
      +'<div class="cb-find"><input id="btSearch" placeholder="Tìm biến thể theo tên, mã hoặc thương hiệu…" autocomplete="off" oninput="btSearch_(this.value)">'
        +'<div class="cb-sug-box" id="btSug"></div></div>'
      +'<div class="cb-list" id="btList"></div>'
    +'</div></div>';
}
async function spEditModal(i){
  // nhận cả chỉ số trong bảng lẫn object sản phẩm (dùng từ panel "SP vừa nhập")
  var p=(i&&typeof i==='object') ? i : (S._spList||[])[i];
  if(!p) return;
  if(!p.ma){ toast('Sản phẩm chưa có mã — không cập nhật được'); return; }
  var ov=document.createElement('div'); ov.className='sp-modal-ov'; ov.id='spEditOv';
  ov.onclick=function(e){ if(e.target===ov) spEditClose(); };
  ov.innerHTML='<div class="sp-modal sp-edit pd"><div class="pd-head"><h3>'+icon('edit',16)+' Cập nhật sản phẩm</h3><button class="pd-x" onclick="spEditClose()">✕</button></div>'
    +'<div class="spe-2col"><div class="spe-body"><div class="empty" style="padding:24px">Đang tải…</div></div><aside class="spe-side" id="speSide"></aside></div></div>';
  document.body.appendChild(ov);
  var raw=null, hist=[];
  var editKey = (p.recordId!=null && p.recordId!=='') ? String(p.recordId) : p.ma;   // id dòng = đúng biến thể
  S._spEditRecId=p.recordId; S._spEditP=p; S._combo=[]; S._bt=[]; S._cbTab='combo';
  try{ raw=await api('getDbProduct', editKey); hist=await api('getProductHistory', p.ma)||[]; }catch(e){}
  try{ S._combo=(await api('getCombo', editKey)||[]).map(function(x){
        return {recordId:x.recordId, ma:x.ma, ten:x.ten, hinhAnh:x.hinhAnh, donGiaBan:x.donGiaBan, comboSL:x.comboSL||1,
                comboNguoc:!!x.comboNguoc, comboBoSL:x.comboBoSL}; }); }catch(e){ S._combo=[]; }
  try{ S._bt=(await api('getBienThe', editKey)||[]).map(function(x){
        return {recordId:x.recordId, ma:x.ma, ten:x.ten, hinhAnh:x.hinhAnh, donGiaBan:x.donGiaBan,
                congSuat:x.congSuat, nhietDo:x.nhietDo, gocChieu:x.gocChieu, mauSac:x.mauSac}; }); }catch(e){ S._bt=[]; }
  if(!raw){ ov.querySelector('.spe-body').innerHTML='<div class="empty" style="padding:24px">Không tải được dữ liệu sản phẩm.</div>';
    ov.querySelector('#speSide').innerHTML=''; return; }
  S._spEditMa=editKey;
  // tách anh_sp: ảnh đầu = đại diện, còn lại = ảnh chi tiết/mô tả (dùng chung bộ upload với trang Nhập dữ liệu)
  var imgsRaw=String(raw.anh_sp||'').split('\n').map(function(s){return s.trim();}).filter(Boolean);
  S._imgMain=imgsRaw[0]||''; S._imgList=imgsRaw.slice(1);
  // ĐẦY ĐỦ trường, chia nhóm y hệt form Nhập dữ liệu
  var fields=groupsCuaSP_(p).map(function(gr){
    var inner=gr.f.map(function(f){ return speField_(f, raw); }).join('');
    if(!inner) return '';
    return '<div class="spe-grp"><div class="spe-grp-h">'+esc(gr.g)+'</div><div class="spe-fields">'+inner+'</div></div>';
  }).join('');
  var histHtml=hist.length?hist.map(function(h){
    return '<div class="spe-h"><div class="spe-h-top"><b>'+esc(h.field)+'</b><span class="spe-h-by">'+icon('clock',11)+' '+esc(h.by||'?')+' · '+fmtDateTime_(h.at)+'</span></div>'
      +'<div class="spe-h-diff"><span class="old">'+esc(h.old||'—')+'</span><span class="arr">→</span><span class="new">'+esc(h.new||'—')+'</span></div></div>';
  }).join(''):'<div class="empty" style="padding:14px;font-size:12.5px">Chưa có lịch sử cập nhật.</div>';
  ov.querySelector('#speSide').innerHTML=
    '<div class="spe-who">'
      +'<span>'+icon('plus',13)+' Tạo bởi <b>'+esc(p.nguoiTao||'—')+'</b>'+(p.ngayTao?' · '+esc(fmtDate(p.ngayTao)):'')+'</span>'
      +'<span>'+icon('edit',13)+' Sửa cuối bởi <b>'+esc(p.nguoiSua||'—')+'</b>'+(p.ngayCapNhat?' · '+esc(fmtDateTime_(p.ngayCapNhat)):'')+'</span>'
      +(p.daDuyet?'<span class="ok">'+icon('check',13)+' Duyệt bởi <b>'+esc(p.nguoiDuyet||'—')+'</b>'+(p.ngayDuyet?' · '+esc(fmtDateTime_(p.ngayDuyet)):'')+'</span>'
                : '<span class="warn">'+icon('clock',13)+' Chưa duyệt</span>')
    +'</div>'
    +'<div class="spe-hist"><div class="spe-hist-h">'+icon('clock',15)+' Lịch sử cập nhật <span class="spe-hist-n">'+hist.length+'</span></div>'
    +'<div class="spe-hist-list">'+histHtml+'</div></div>';
  ov.querySelector('.spe-body').innerHTML=spEditImgSection_()
    +fields
    +cbSection_()
    +'<div class="spe-actions">'
      +'<button class="btn ghost sm" onclick="spEditClose()">Huỷ</button>'
      +(spCanDuyet_()?'<button class="btn ghost sm" id="speDuyetBtn" onclick="spEditSave(1)" title="Lưu thay đổi rồi đánh dấu Đã duyệt">'+icon('check',14)+' Lưu &amp; duyệt</button>':'')
      +'<button class="btn blue" id="speSaveBtn" onclick="spEditSave()">'+icon('check',15)+' Lưu cập nhật</button></div>';
  if(nganhCuaSP_(p)==='vs'){ var hmSel=ov.querySelector('[data-col="hang_muc"]'); vsApplyHM_(ov, hmSel?hmSel.value:raw.hang_muc, 1); }
  cbRender_(); btRender_(); cbTab_((S._bt||[]).length&&!(S._combo||[]).length?'bt':'combo');
  document.addEventListener('mousedown',cbOutside_);
}
// bấm ra ngoài thì đóng gợi ý tìm sản phẩm
function cbOutside_(e){
  if(e.target.closest('.cb-find')) return;
  ['cbSug','btSug'].forEach(function(id){ var b=document.getElementById(id); if(b) b.style.display='none'; });
}
// 2 vùng ảnh (đại diện + chi tiết) — DÙNG ĐÚNG layout .imgup của trang Nhập dữ liệu (2 cột đều, đồng nhất)
function spEditImgSection_(){ return imgUpBlock_('spe-imgup'); }
// Giá đại lý = Giá bán lẻ × (1 − CK%) — tính lại ngay trong modal Sửa (giống form Nhập)
function speCalcDaiLy_(){
  var ov=document.getElementById('spEditOv'); if(!ov) return;
  function v(c){ var e=ov.querySelector('[data-col="'+c+'"]'); return e?(Number(e.value)||0):0; }
  var out=ov.querySelector('[data-col="gia_dai_ly"]'); if(!out) return;
  var g=v('gia_ban_le'), ck=v('ck_dai_ly_pct');
  out.value = g? Math.round(g*(1-ck/100)) : '';
}
function spEditClose(){ document.removeEventListener('mousedown',cbOutside_); var o=document.getElementById('spEditOv'); if(o)o.remove(); }
async function spEditSave(luuVaDuyet){
  var ov=document.getElementById('spEditOv'); if(!ov) return;
  var data={};
  ov.querySelectorAll('[data-col]').forEach(function(el){
    var col=el.getAttribute('data-col'); if(col==='gia_dai_ly') return;   // cột tự tính, không gửi
    var lbl=SP_COL2LABEL_[col]; if(!lbl) return;
    // Thiết bị vệ sinh: thông số KHÔNG thuộc hạng mục đang chọn -> xoá, giữ dữ liệu đúng bộ của hạng mục
    data[lbl]=(el.closest('.vs-off'))?'':el.value;
  });
  var btn=document.getElementById('speSaveBtn'); if(btn){ btn.disabled=true; btn.textContent='Đang lưu…'; }
  if((S._imgUploading||0)>0){ if(btn) btn.textContent='⏳ Đợi tải ảnh…'; await waitUploads_(15000); }
  // gộp ảnh: đại diện (đầu) + chi tiết; bỏ preview base64 chưa upload xong
  var imgs=[S._imgMain].concat(S._imgList||[]).filter(Boolean).filter(function(v){ return v.indexOf('data:')!==0; });
  data['ẢNH SẢN PHẨM']=imgs.join('\n');
  if(btn) btn.textContent='Đang lưu…';
  var lai=function(){ if(btn){ btn.disabled=false; btn.innerHTML=icon('check',15)+' Lưu cập nhật'; } };
  try{
    var r=await api('updateDbProductTracked', S._spEditMa, data);

    try{ await api('setCombo', S._spEditMa, (S._combo||[]).map(function(x){ return {id:x.recordId, soLuong:x.comboSL}; })); }
    catch(e){ toast('Lưu sản phẩm đi kèm lỗi: '+e.message.slice(0,90)); }
    try{ await api('setBienThe', S._spEditMa, (S._bt||[]).map(function(x){ return {id:x.recordId}; })); }
    catch(e){ toast('Lưu nhóm biến thể lỗi: '+e.message.slice(0,90)); }
    if(r&&r.updated){
      if(luuVaDuyet){ try{ await api('setSpDuyet',[String(S._spEditMa)],true); }catch(e){ toast('Lưu xong nhưng duyệt lỗi: '+e.message.slice(0,80)); } }
      toast('Đã cập nhật '+r.changes+' trường'+(luuVaDuyet?' và duyệt':(r.daDuyet===false?' — sản phẩm chuyển về Chưa duyệt':'')));
      S.products=await api('getProducts')||S.products; spViewTabs_(); spFilter(); if(typeof renderCatalog==='function') renderCatalog();
      impSyncSession_(S._spEditMa); spEditClose(); }
    else { toast('Đã lưu sản phẩm đi kèm'); S.products=await api('getProducts')||S.products; spEditClose(); }
  }catch(e){ toast('Lỗi lưu: '+e.message); lai(); }
}
async function spDelete(i){
  var p=(S._spList||[])[i]; if(!p) return;
  if(!confirm('Xoá sản phẩm "'+p.ten+'" khỏi danh mục?')) return;
  try{ await api('deleteDbProduct', p.ma||String(p.recordId)); S.products=await api('getProducts')||S.products;
    toast('Đã xoá: '+p.ten); spFilter(); renderFilters&&renderFilters(); renderCatalog&&renderCatalog(); }
  catch(e){ toast('Lỗi xoá: '+e.message); }
}
function hideDetail(){ S._detailIdx=null; document.getElementById('pdPanel').style.display='none'; document.getElementById('bocGrid').classList.remove('detail'); document.removeEventListener('keydown',pdPanelKey_); }

/* ===== Kéo/thêm SP xong: cuộn bảng tới dòng vừa thêm + nháy nhẹ dòng đó =====
   renderTable() dựng lại innerHTML nên class nháy sẽ mất; vì vậy giữ id + mốc thời gian
   trong S rồi vẽ lại sau mỗi lần render (dùng animation-delay âm để mạch nháy chạy tiếp,
   không giật lại từ đầu khi server trả về và dòng tạm đổi thành dòng thật). */
var TK_NEW_MS=1350;
function tkRowEl_(id){
  if(!id) return null;
  var rows=document.querySelectorAll('#tkTable tr.drow');
  for(var i=0;i<rows.length;i++) if(rows[i].dataset.id===id) return rows[i];
  return null;
}
function tkStickyH_(){                                   // header + các hàng đang ghim
  var t=document.getElementById('tkTable'); if(!t) return 0;
  var h=(t.rows[0]||{}).offsetHeight||0;
  t.querySelectorAll('tr.frzrow').forEach(function(tr){ h+=tr.offsetHeight; });
  return h;
}
function tkRowNewPaint_(){                               // gọi ở cuối renderTable()
  var id=S._newLid; if(!id) return;
  var el=Date.now()-(S._newT0||0);
  if(el>=TK_NEW_MS){ S._newLid=null; return; }
  var tr=tkRowEl_(id); if(!tr) return;
  tr.style.setProperty('--fdl','-'+el+'ms');
  tr.classList.add('rownew');
}
function tkGotoNewRow_(id){
  S._newLid=id; S._newT0=Date.now();
  var tr=tkRowEl_(id); if(!tr) return;
  tr.style.setProperty('--fdl','0s'); tr.classList.remove('rownew'); void tr.offsetWidth; tr.classList.add('rownew');
  clearTimeout(S._newTmr);
  S._newTmr=setTimeout(function(){ S._newLid=null; var x=tkRowEl_(id); if(x) x.classList.remove('rownew'); }, TK_NEW_MS+80);
  var w=tr.closest('.tbl-wrap'); if(!w) return;
  var wr=w.getBoundingClientRect(), rr=tr.getBoundingClientRect(), pad=tkStickyH_()+10;
  var duoi=rr.bottom-(wr.bottom-10), tren=(wr.top+pad)-rr.top;
  var d=(duoi>0)?duoi:((tren>0)?-tren:0);
  if(Math.abs(d)<2) return;                      // đang thấy rồi -> đứng yên, không giật
  var to=Math.max(0, Math.min(w.scrollHeight-w.clientHeight, w.scrollTop+d));
  w.scrollTo({top:to, behavior:tkSmooth_()});    // cuộn tối thiểu, vừa đủ lộ dòng mới
}
function tkSmooth_(){
  try{ return window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'; }catch(e){ return 'smooth'; }
}

/* ===== ADD to takeoff ===== */
async function addProduct(i){ var p=(S._filtered||[])[i]; if(p) await addProdObj(p); }
async function addProductObj(i){ var p=(S._filtered||[])[i]; if(p) await addProdObj(p); }
async function addProdObj(p,floor,sl){
  if(!S.cur){ toast('Chưa chọn dự án — bấm Tạo dự án +'); return; }
  sl=Math.max(1, Math.round(Number(sl)||1));      // thêm nhiều đơn vị 1 lần (dùng cho combo)
  if(floor==null) floor=S.selFloor||'';
  if(floor==='CHƯA PHÂN TẦNG') floor='';
  // cộng dồn SL nếu đã có cùng SP trong cùng hạng mục + tầng
  // Gộp SL chỉ khi TRÙNG CẢ THÔNG SỐ. Biến thể khác nhiệt độ/công suất/góc/màu tuy cùng mã+tên
  // vẫn là 2 DÒNG RIÊNG (trước đây gộp mất, kéo 4 biến thể chỉ vào 1 dòng).
  // Gộp SL chỉ khi: cùng hạng mục + tầng, TRÙNG CẢ THÔNG SỐ (biến thể khác = dòng riêng)
  // VÀ dòng đó CHƯA điền PHÒNG. Đã gán phòng -> thêm SP đó nữa nghĩa là cho PHÒNG KHÁC -> tạo DÒNG MỚI.
  var same=S.lines.filter(function(l){
    return l.nhom===S.node && (l.tang||'')===floor
      && ((p.ma&&l.maSP&&l.maSP===p.ma)||l.ten===p.ten)
      && String(l.moTa||'').trim()===String(p.moTa||'').trim()
      && !String(l.khuVuc||'').trim()
      && tkSheetOf_(l)===((tkSheetCo_()&&S.sheet)||'');
  })[0];
  if(same){ editLine(same.lineId,{soLuong:(Number(same.soLuong)||0)+sl}); toast('+'+sl+' số lượng: '+p.ten);
    tkGotoNewRow_(same.lineId); return; }
  var prod=Object.assign({},p,{ nhom:S.node, hangMuc:nodeName(S.node), loai:nodeName(S.node), tang:floor,
    extra:Object.assign({nganh:p.nhom||''}, (S.sheet&&tkSheetCo_())?{sheet:S.sheet}:{}) });
  // ---- Optimistic: hiện dòng NGAY, đồng bộ server chạy nền ----
  var dgVon=Number(p.donGiaVon)||0, dgBan=Number(p.donGiaBan)||0;
  var temp={ lineId:'tmp_'+(S._tmpN=(S._tmpN||0)+1), _pending:true,
    khuVuc:'', maBanVe:'', maSP:p.ma||'', ten:p.ten||'', thuongHieu:p.thuongHieu||'', ncc:p.ncc||'',
    moTa:p.moTa||'', kichThuoc:p.kichThuoc||p.size||'', dvt:p.dvt||'Cái', hinhAnh:p.hinhAnh||'',
    soLuong:sl, donGiaVon:dgVon, donGiaBan:dgBan, thanhTienVon:dgVon*sl, thanhTienBan:dgBan*sl, lnPct:0,
    nhom:S.node, hangMuc:nodeName(S.node), tang:floor };
  var gKey=floor||'CHƯA PHÂN TẦNG';
  if(S.collapsed[gKey]) S.collapsed[gKey]=false;      // tầng đang gập -> mở ra để thấy dòng vừa thêm
  S.lines.push(temp); renderTree(); renderFloors(); renderTable(); renderCard();
  tkGotoNewRow_(temp.lineId);                         // cuộn tới dòng mới + nháy nhẹ
  toast('Đã thêm: '+p.ten+(sl>1?(' ×'+sl):''));
  return api('addLine', S.cur.maDA, prod, sl).then(function(l){
    var i=S.lines.indexOf(temp); if(i>=0) S.lines[i]=l; else S.lines.push(l);
    if(S._newLid===temp.lineId) S._newLid=l.lineId;   // dòng tạm -> dòng thật: nháy chạy tiếp, không giật
    renderTree(); renderTable(); renderCard();
    if(document.getElementById('v-dash').classList.contains('on')) renderDash();
    if(bgVis()) drawBaogia();
  }).catch(function(e){
    var i=S.lines.indexOf(temp); if(i>=0) S.lines.splice(i,1);
    renderTree(); renderFloors(); renderTable(); renderCard(); toast('Lỗi thêm: '+e.message);
  });
}

/* ===== Thanh kéo: thu gọn / mở rộng khối lọc ở panel trái ===== */
function catSplitInit_(){
  var sp=document.getElementById('catSplit'), top=document.querySelector('#leftCat .catpanel-top'), panel=document.getElementById('leftCat');
  if(!sp||!top||sp._init) return; sp._init=1;
  // khôi phục chiều cao đã lưu
  try{ var h=localStorage.getItem('qs_catTopH'); if(h) top.style.height=h+'px';
       if(localStorage.getItem('qs_catCollapsed')==='1') panel.classList.add('filt-collapsed'); }catch(e){}
  sp.addEventListener('mousedown',function(e){
    e.preventDefault();
    if(panel.classList.contains('filt-collapsed')) return;      // đang gập thì kéo lại mở bằng dblclick
    var sy=e.clientY, sh=top.getBoundingClientRect().height;
    sp.classList.add('dragging'); document.body.style.cursor='row-resize';
    function mv(ev){
      var max=panel.getBoundingClientRect().height-120;
      var h=Math.max(44, Math.min(max, sh+(ev.clientY-sy)));
      top.style.height=h+'px';
    }
    function up(){
      document.removeEventListener('mousemove',mv); document.removeEventListener('mouseup',up);
      sp.classList.remove('dragging'); document.body.style.cursor='';
      try{ localStorage.setItem('qs_catTopH', Math.round(top.getBoundingClientRect().height)); }catch(x){}
    }
    document.addEventListener('mousemove',mv); document.addEventListener('mouseup',up);
  });
  // bấm đúp: gập / mở nhanh
  sp.addEventListener('dblclick',function(){
    var on=panel.classList.toggle('filt-collapsed');
    try{ localStorage.setItem('qs_catCollapsed', on?'1':'0'); }catch(x){}
    toast(on?'Đã thu gọn bộ lọc — bấm đúp thanh kéo để mở lại':'Đã mở lại bộ lọc');
  });
}

/* ===== CATEGORY TREE ===== */
function nodeCount(code){
  return S.lines.filter(function(l){ return l.nhom===code || String(l.nhom||'').indexOf(code+'.')===0; }).length;
}
function pad2(n){ return (n<10?'0':'')+n; }
function customGroups(){ return (S.cur&&S.cur.nhomTuTao)?String(S.cur.nhomTuTao).split('|').map(function(s){return s.trim();}).filter(Boolean):[]; }
function renderTree(){
  var pop=document.getElementById('treePop');
  var nodes=TREE.filter(function(t){return t[0]!=='X';}).map(function(t){return {code:t[0],name:t[1],lvl:t[2]};});
  customGroups().forEach(function(n){ nodes.push({code:n,name:n,lvl:1,custom:true}); });
  S._tree=nodes;
  // Ô Hạng mục trên đầu bảng dùng CÙNG bộ chọn kiểu mind map với ô đề mục ở panel trái (renderMM_)
  pop.classList.add('mm-pop');
  pop.innerHTML=mmHtml_(true);
  var sel=nodes.filter(function(t){return t.code===S.node;})[0];
  document.getElementById('treeLabel').textContent=sel?(sel.code+'.'+sel.name):'Chọn hạng mục';
  document.getElementById('treeCnt').textContent='['+pad2(nodeCount(S.node))+']';
}
function toggleTree(){ var p=document.getElementById('treePop'); var mo=(p.style.display==='none');
  if(mo){ S._mmBrowse=null; p.innerHTML=mmHtml_(true); }          // mở ra luôn bắt đầu từ đường đang chọn
  p.style.display=mo?'block':'none'; }
/* ═══════════ HẠNG MỤC DÙNG CHUNG CHO MỌI TAB ═══════════
   Trước đây mỗi tab giữ một lựa chọn riêng: Bóc tách có "Hạng mục đã bóc", Danh sách
   sản phẩm có ô lọc hạng mục, Xuất báo giá có bảng tích chọn -> chọn ở tab này sang
   tab kia lại phải chọn lại. Nay tất cả đọc/ghi chung một chỗ: S.hmNode.
   Chọn ở đâu cũng được, mọi tab đang mở tự cập nhật theo, và nhớ lại ở lần mở sau. */
function hmGet_(){ return S.hmNode||''; }                    // '' = tất cả hạng mục
function hmBtnSync_(){}   /* không còn nút riêng trên thanh trên — mỗi tab dùng ô chọn sẵn có của mình */
function viewOn_(id){ var v=document.getElementById(id); return !!(v && v.classList.contains('on')); }
function hmSet_(code, tuTab){
  code=String(code||'');
  S.hmNode=code;
  try{ localStorage.setItem('qs_hm', code); }catch(e){}
  hmBtnSync_();
  // --- Bóc tách: đề mục đang bóc (chọn "tất cả" thì giữ nguyên đề mục đang làm) ---
  if(code && S.node!==code){
    S.node=code;
    if(typeof renderTree==='function') renderTree();
    if(typeof renderFloors==='function') renderFloors();
    if(typeof renderTable==='function') renderTable();
    if(typeof setDemucFilter==='function') setDemucFilter(code);   // kèm lọc thư viện bên trái
  }
  // --- Danh sách sản phẩm ---
  S._spFilters=S._spFilters||{};
  if(code) S._spFilters.node=code; else delete S._spFilters.node;
  if(tuTab!=='sp' && viewOn_('v-sanpham')){
    S._spPage=1; S._spSel={};
    if(typeof renderSpChips_==='function') renderSpChips_();
    if(typeof spViewTabs_==='function') spViewTabs_();
    if(typeof spFilter==='function') spFilter();
  }
  /* --- Xuất báo giá: chỉ theo khi người dùng CHƯA tự tích nhiều hạng mục ---
     Tích nhiều hạng mục là thao tác riêng của tab đó (xuất gộp nhiều phần);
     nếu ghi đè thì đổi hạng mục ở tab khác sẽ âm thầm làm file xuất thiếu phần.
     Lúc mở app (tuTab='init') cũng không đụng vào, giữ nếp cũ: chưa tích = xuất tất cả. */
  if(tuTab!=='bg' && tuTab!=='init'){
    var daTich=Object.keys(S.bgNodes||{}).filter(function(k){ return S.bgNodes[k]; });
    if(daTich.length<2){
      S.bgNodes={}; if(code) S.bgNodes[code]=1;
      S.bgDeMuc=code||'__all__'; S.bgPage=1;
      if(typeof bgVis==='function' && bgVis() && typeof drawBaogia==='function') drawBaogia();
    }
  }
  // --- Các tab còn lại chỉ cần vẽ lại nếu đang mở ---
  if(viewOn_('v-chiphi') && typeof renderChiphi==='function') renderChiphi();
  if(viewOn_('v-project') && typeof renderProjects==='function') renderProjects();
  if(viewOn_('v-duan') && typeof renderDuAn==='function') renderDuAn();
  if(viewOn_('v-muahang') && typeof renderMuahang==='function') renderMuahang();
}
/* Bảng chọn hạng mục DÙNG LẠI ĐƯỢC — trang nào thật sự cần đổi hạng mục thì gọi,
   truyền id của chính nút bấm để bảng bám vào đó. Trang chỉ HIỂN THỊ hạng mục
   (Chi phí, Bảng điều khiển) hoặc đã có ô chọn riêng (Bóc tách, Danh sách SP,
   Xuất báo giá) thì KHÔNG dùng — tránh đẻ thêm nút trùng nhau.                   */
/* ═══ Ô CHỌN HẠNG MỤC — MỘT KIỂU DUY NHẤT cho mọi tab ═══
   Lấy đúng dáng của ô ở trang Bóc tách: nhãn "Hạng mục" + số đếm, rồi ô chọn
   viền tròn ghi tên hạng mục kèm số dòng. Dùng chung cho Chi phí · Dự án ·
   Mua hàng · Thông tin dự án nên không còn cảnh mỗi trang một kiểu.            */
function hmSelect_(id){
  var hm=hmGet_();
  var n=(S.lines||[]).filter(function(l){ if(!hm) return true; var c=String(l.nhom||'');
    return c===hm || c.indexOf(hm+'.')===0; }).length;
  return '<div class="hm-wrap">'
    +'<span class="hm-lbl">Hạng mục</span><span class="count">['+pad2(n)+']</span>'
    +'<button class="tree-btn hm-open'+(hm?' on':'')+'" id="'+id+'" onclick="hmPop_(event,\''+id+'\')" title="Chọn hạng mục">'
      +'<span class="hm-name">'+esc(hm?(hm+'.'+(nodeName(hm)||hm)):'Tất cả hạng mục')+'</span>'
      +'<span class="cnt">['+pad2(n)+']</span>'
    +'</button></div>';
}
function hmPop_(e, btnId){
  if(e&&e.stopPropagation) e.stopPropagation();
  var id='hmPop'; if(document.getElementById(id)){ hmPopClose_(); return; }
  var cur=hmGet_(), pop=document.createElement('div');
  pop.className='fltpop bgtree'; pop.id=id;
  pop.innerHTML='<div class="bgt-h"><b>Chọn hạng mục</b>'
      +'<button class="colpop-x" onclick="hmPopClose_()">✕</button></div>'
    +'<div class="bgt-b">'
      // luôn có lối bỏ lọc (ô chọn không còn dấu ✕ như bản trước)
      +'<div class="bgt-i lvl1'+(cur?'':' on')+'" onclick="hmPick_(\'\')"><span class="nm">Tất cả hạng mục</span>'
        +'<span class="cn">['+pad2((S.lines||[]).length)+']</span><span class="rd'+(cur?'':' on')+'"></span></div>'
      +TREE.filter(function(t){ return t[0]!=='X'; }).map(function(t){
        var on=(cur===t[0]), n=(typeof nodeCount==='function')?nodeCount(t[0]):0;
        return '<div class="bgt-i lvl'+t[2]+(on?' on':'')+'" onclick="hmPick_(\''+esc(t[0])+'\')">'
          +'<span class="nm">'+esc(t[0]+'. '+t[1])+'</span>'
          +'<span class="cn">'+(n?'['+pad2(n)+']':'')+'</span>'
          +'<span class="rd'+(on?' on':'')+'"></span></div>';
      }).join('')+'</div>';
  document.body.appendChild(pop);
  var b=btnId?document.getElementById(btnId):(e&&e.currentTarget);
  if(b&&b.getBoundingClientRect){
    var r=b.getBoundingClientRect(), w=pop.offsetWidth||330, h=pop.offsetHeight;
    var top=r.bottom+6; if(top+h>window.innerHeight-10) top=Math.max(10, r.top-h-6);
    pop.style.top=top+'px'; pop.style.left=Math.max(8,Math.min(r.left, window.innerWidth-w-10))+'px';
  }
  setTimeout(function(){ document.addEventListener('mousedown',hmOutside_); },0);
}
function hmOutside_(e){ if(e.target.closest('#hmPop')||e.target.closest('.hm-open')) return; hmPopClose_(); }
function hmPopClose_(){ var p=document.getElementById('hmPop'); if(p) p.remove(); document.removeEventListener('mousedown',hmOutside_); }
function hmPick_(code){ hmPopClose_(); hmSet_(code); }
function hmInit_(){
  var luu=''; try{ luu=localStorage.getItem('qs_hm')||''; }catch(e){}
  S.hmNode=luu||S.node||'';
  hmBtnSync_();
  if(luu) hmSet_(luu,'init');
}
/* ═══════════ CHỌN HẠNG MỤC KIỂU MIND MAP ═══════════
   Bấm tới đâu hiện cấp con tới đó:  3. Xây dựng → 3.1. Phần thô →
   3.1.1 Khái toán chi tiết / 3.1.2 Khái toán sơ bộ / 3.1.3 Dự toán → Nhân công / Vật tư.
   Nút có cấp con: bấm = mở cấp con (chưa đổi đề mục đang bóc).
   Nút lá: bấm = chọn thật (pickNode -> đồng bộ mọi tab như cũ).
   Bấm lại một nút đã chọn ở giữa đường = mở lại cấp đó để chọn nhánh khác.       */
function mmNodes_(){
  var out=TREE.filter(function(t){ return t[0]!=='X'; }).map(function(t){ return {c:t[0], t:t[1], l:t[2]}; });
  customGroups().forEach(function(n){ out.push({c:n, t:n, l:1, custom:true}); });
  return out;
}
function mmNode_(code){ return mmNodes_().filter(function(n){ return n.c===code; })[0]||null; }
function mmKids_(code){
  var ns=mmNodes_();
  if(code==='#') return ns.filter(function(n){ return n.l===1; });
  var me=ns.filter(function(n){ return n.c===code; })[0]; if(!me||me.custom) return [];
  return ns.filter(function(n){ return n.l===me.l+1 && n.c.indexOf(code+'.')===0; });
}
function mmPath_(code){                              // '3.2.6.1' -> ['3','3.2','3.2.6','3.2.6.1']
  if(!code||code==='#') return [];
  var me=mmNode_(code); if(!me) return [];
  if(me.custom) return [code];
  var parts=String(code).split('.'), out=[];
  for(var i=1;i<=parts.length;i++){ var c=parts.slice(0,i).join('.'); if(mmNode_(c)) out.push(c); }
  return out;
}
function mmLbl_(code){ var n=mmNode_(code); return n?(n.custom?n.t:(n.c+'. '+n.t)):code; }
function mmCnt_(code){ var n=(typeof nodeCount==='function')?nodeCount(code):0; return n?('<span class="mm-n">['+pad2(n)+']</span>'):''; }
function mmCode_(code){ var n=mmNode_(code); return (n&&!n.custom)?n.c:''; }
function mmName_(code){ var n=mmNode_(code); return n?n.t:code; }
function mmNum_(code){ var n=(typeof nodeCount==='function')?nodeCount(code):0; return n?'<span class="mm-num">'+n+'</span>':''; }
/* Ô đề mục gọn 1 dòng: ghi đủ đường đang chọn (vd "3.1.Phần thô · Dự toán · Nhân công") */
function mmSelSync_(){
  var sel=document.getElementById('mmSel'), lb=document.getElementById('mmSelLbl'); if(!lb) return;
  var t=(S.node?(mmCode_(S.node)?mmCode_(S.node)+'.':'')+mmName_(S.node):'Hạng mục');
  if(S.node==='3.1'){ var lo=ptLoai_();
    t+=' · '+({kt_chitiet:'Khái toán chi tiết',kt_sobo:'Khái toán sơ bộ',dt_nhancong:'Dự toán · Nhân công',dt_vattu:'Dự toán · Vật tư'}[lo]||''); }
  else if(S.sheet && typeof tkSheetCo_==='function' && tkSheetCo_(S.node)) t+=' · '+(S.sheet==='nc'?'Nhân công':'Vật tư');
  lb.textContent=t;
  var nav=document.getElementById('mmNav');
  if(sel) sel.classList.toggle('open', !!S._mmUI);
  if(nav) nav.style.display=S._mmUI?'':'none';
}
function mmToggle_(e){ if(e&&e.stopPropagation) e.stopPropagation(); S._mmUI=!S._mmUI; if(!S._mmUI) S._mmBrowse=null; renderMM_(); }
function mmClose_(){ S._mmUI=false; S._mmBrowse=null; renderMM_(); }
// bấm ra ngoài ô đề mục / bộ chọn thì thu gọn lại
document.addEventListener('mousedown',function(e){
  if(!S._mmUI) return;
  if(e.target.closest && (e.target.closest('#mmNav')||e.target.closest('#mmSel')||e.target.closest('#treePop')||e.target.closest('#treeBtn'))) return;
  mmClose_();
});
function renderMM_(){
  mmSelSync_();
  if(S._mmBrowse!=null && S._mmAt!==S.node) S._mmBrowse=null;   // đề mục đổi từ nơi khác -> thôi duyệt dở
  var el=document.getElementById('mmNav'); if(el) el.innerHTML=mmHtml_(false);
  var tp=document.getElementById('treePop'); if(tp && tp.style.display!=='none') tp.innerHTML=mmHtml_(true);   // ô Hạng mục trên bảng
}
/* HTML bộ chọn mind map — dùng cho ô đề mục panel trái (forTree=false) và ô Hạng mục đầu bảng (true).
   Bản trên bảng có thêm số dòng đã bóc, nút thêm / xoá hạng mục tự tạo. */
function mmHtml_(forTree){
  var dangDuyet=(S._mmBrowse!=null);
  var cur=dangDuyet?S._mmBrowse:(S.node||'');
  var path=mmPath_(cur), st=[], parent='#';
  // --- các nút ĐÃ CHỌN trên đường đi: viên thuốc gọn, bấm để đổi nhánh ở cấp đó ---
  path.forEach(function(code,i){
    var laLa=(!dangDuyet && i===path.length-1 && !mmKids_(code).length);
    st.push('<div class="mm-step path'+(laLa?' leaf':'')+'">'
      +'<button class="mm-pill" onclick="mmOpen_(\''+esc(parent)+'\')" title="Bấm để đổi sang nhánh khác ở cấp này">'
        +(mmCode_(code)?'<span class="mm-code">'+esc(mmCode_(code))+'</span>':'')
        +'<span class="mm-t">'+esc(mmName_(code))+'</span>'+mmNum_(code)
        +'<span class="mm-ic">'+(laLa?'✓':'⌄')+'</span></button></div>');
    parent=code;
  });
  // --- cấp đang mở: danh sách nhánh con ---
  var kids=mmKids_(parent);
  if(kids.length){
    st.push('<div class="mm-step pick"><div class="mm-cap">'+(parent==='#'?'Chọn hạng mục':'Chọn tiếp')+'</div>'
      +'<div class="mm-list">'+kids.map(function(k){
        var coCon=mmKids_(k.c).length>0;
        return '<button class="mm-item" onclick="mmPick_(\''+esc(k.c)+'\')">'
          +(mmCode_(k.c)?'<span class="mm-code">'+esc(mmCode_(k.c))+'</span>':'')
          +'<span class="mm-t">'+esc(k.t)+'</span>'+mmNum_(k.c)
          +(coCon?'<span class="mm-go">›</span>':'')+'</button>';
      }).join('')+'</div></div>');
  } else if(!dangDuyet){                              // tới lá: các cấp phụ của đề mục đó
    if(S.node==='3.1'){
      var lo=ptLoai_(), top=(lo.indexOf('dt_')===0)?'dt':lo;
      var nhom=(lo.indexOf('dt_')===0)?'dt':'kt';
      st.push(mmPick2_('Loại báo giá',PT_LOAI_NHOM.map(function(g){ return [g[0],g[1],g[2]]; }),nhom,'mmLoai_'));
      var g=PT_LOAI_NHOM.filter(function(x){ return x[0]===nhom; })[0];
      st.push(mmPick2_(g[2],g[3].map(function(x){ return [x[0],x[1],x[2].replace(/^Khái toán (\S)/,function(m,c){ return c.toUpperCase(); })]; }),lo,'mmLoai_'));
    } else if(typeof tkSheetCo_==='function' && tkSheetCo_(S.node)){
      st.push(mmPick2_('Phân loại',[['','','Tất cả'],['nc','1','Nhân công'],['vt','2','Vật tư']],S.sheet||'','mmSheet_'));
    }
  }
  var them='';
  if(forTree && parent==='#'){          // đang ở cấp gốc: quản lý hạng mục tự tạo của dự án
    var tu=customGroups();
    them=(tu.length?'<div class="mm-cust">'+tu.map(function(n){ var i=(S._tree||[]).map(function(t){ return t.code; }).indexOf(n);
        return '<span class="mm-cust-i">'+esc(n)+'<b title="Xoá hạng mục tự tạo" onclick="event.stopPropagation();delCustomGroup('+i+')">✕</b></span>'; }).join('')+'</div>':'')
      +'<button class="mm-add" onclick="addCustomGroup()">＋ Thêm hạng mục</button>';
  } else if(forTree) them='<button class="mm-add" onclick="addCustomGroup()">＋ Thêm hạng mục</button>';
  return '<div class="mm-rail">'+st.join('')+'</div>'
    +(dangDuyet?'<button class="mm-reset" onclick="mmCancel_()">← Về hạng mục đang bóc</button>':'')
    +them;
}
// cấp phụ (loại báo giá / nhân công - vật tư): chọn 1 trong vài mục
function mmPick2_(cap, opts, sel, fn){
  return '<div class="mm-step pick"><div class="mm-cap">'+esc(cap)+'</div><div class="mm-list">'+opts.map(function(o){
      var on=(o[0]===sel);
      return '<button class="mm-item'+(on?' on':'')+'" onclick="'+fn+'(\''+o[0]+'\')">'
        +(o[1]?'<span class="mm-code">'+esc(o[1])+'</span>':'')
        +'<span class="mm-t">'+esc(o[2])+'</span>'+(on?'<span class="mm-go">✓</span>':'')+'</button>';
    }).join('')+'</div></div>';
}
function mmTreeOpen_(){ var tp=document.getElementById('treePop'); return !!(tp && tp.style.display!=='none'); }
function mmTreeClose_(){ var tp=document.getElementById('treePop'); if(tp) tp.style.display='none'; }
function mmPick_(code){
  if(mmKids_(code).length){ S._mmBrowse=code; S._mmAt=S.node; renderMM_(); return; }   // còn cấp con -> mở tiếp
  var tuTren=mmTreeOpen_();                      // đang chọn từ ô Hạng mục đầu bảng
  S._mmBrowse=null; pickNode(code);
  var coPhu=(code==='3.1')||(typeof tkSheetCo_==='function'&&tkSheetCo_(code));
  if(!coPhu) S._mmUI=false;                      // đề mục không có cấp phụ -> chọn xong thu gọn
  if(tuTren && coPhu){ var tp=document.getElementById('treePop'); if(tp) tp.style.display='block'; }   // giữ mở để chọn cấp phụ
  renderMM_();
}
function mmOpen_(parent){ S._mmBrowse=parent; S._mmAt=S.node; renderMM_(); }
function mmCancel_(){ S._mmBrowse=null; renderMM_(); }
function mmLoai_(v){
  var lo=ptLoai_(), vuaMoNhom=false;
  if(v==='dt'){ vuaMoNhom=(lo.indexOf('dt_')!==0); v=vuaMoNhom?'dt_nhancong':lo; }
  else if(v==='kt'){ vuaMoNhom=(lo.indexOf('kt_')!==0); v=vuaMoNhom?'kt_chitiet':lo; }
  var vuaMoDT=vuaMoNhom;                        // vừa đổi nhóm -> giữ mở để chọn loại con
  ptSetLoai(v); if(!vuaMoDT){ S._mmUI=false; mmTreeClose_(); }   // chọn xong cấp cuối -> thu gọn; vừa mở "Dự toán" thì giữ để chọn Nhân công/Vật tư
  renderTable(); renderMM_();
}
function mmSheet_(v){
  S._mmDT=null;
  S.sheet=v||''; try{ localStorage.setItem('qs_sheet', S.sheet); }catch(e){}
  S._tkSel={}; S._mmUI=false; mmTreeClose_(); renderTable(); if(typeof renderCard==='function') renderCard(); renderMM_();
}
/* ═══════════ THANH CÔNG CỤ NHANH (trang Bóc tách) ═══════════
   Nằm giữa băng thông tin dự án và 2 panel. 3 cụm:
     · ⏱ Hạng mục gần đây — chip các hạng mục vừa làm, bấm để chuyển qua lại (nhớ theo máy)
     · 🔍 Tìm nhanh (Ctrl/⌘+K) — một ô cho tất cả: dòng trong bảng (nhảy tới), sản phẩm /
          công tác (thêm vào hạng mục đang bóc), hạng mục (chuyển sang). ↑ ↓ Enter · Esc
     · Nút nhanh — Bộ lọc · Yêu thích · Vừa thêm · Tìm & thay · Ẩn panel trái · Thu gọn đầu bảng · Xuất báo giá */
var QB_RECENT_N=6;
function qbRecent_(){ try{ var v=JSON.parse(localStorage.getItem('qs_hmRecent')||'[]'); return Array.isArray(v)?v:[]; }catch(e){ return []; } }
function qbRecentPush_(code){
  code=String(code||''); if(!code||code==='X') return;
  var v=qbRecent_().filter(function(c){ return c!==code; }); v.unshift(code); v=v.slice(0,QB_RECENT_N);
  try{ localStorage.setItem('qs_hmRecent', JSON.stringify(v)); }catch(e){}
}
function qbBtn_(id, ic, tip, js, on, badge){
  return '<button class="qb-ib'+(on?' on':'')+'" id="'+id+'" title="'+esc(tip)+'" aria-label="'+esc(tip)+'" onclick="'+js+'">'+ic
    +(badge?'<b class="qb-badge">'+badge+'</b>':'')+'</button>';
}
var QB_IC={
  filter:'<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 5h18l-7 8v6l-4 2v-8z"/></svg>',
  panel:'<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M9 4v16"/></svg>',
  zen:'<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3H5a2 2 0 0 0-2 2v3M16 3h3a2 2 0 0 1 2 2v3M8 21H5a2 2 0 0 1-2-2v-3M16 21h3a2 2 0 0 0 2-2v-3"/></svg>',
  hist:'<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5M12 7v5l3 2"/></svg>',
  repl:'<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="10" cy="10" r="6"/><path d="M20 20l-5.6-5.6M8 10h4"/></svg>'
};
function qbRender_(){
  var el=document.getElementById('qbar'); if(!el) return;
  if(document.activeElement && document.activeElement.id==='qbQ') { qbRightSync_(); qbRecentSync_(); return; }   // đang gõ: không vẽ lại ô tìm
  el.innerHTML='<div class="qb-recent" id="qbRecent"></div>'
    +'<div class="qb-find">'+icon('search',15)
      +'<input id="qbQ" placeholder="Tìm sản phẩm, công tác, dòng trong bảng, hạng mục…" autocomplete="off" spellcheck="false"'
      +' oninput="qbSearch_(this.value)" onfocus="qbSearch_(this.value)" onkeydown="qbKey_(event)">'
      +'<kbd>'+(/Mac/i.test(navigator.platform||'')?'⌘':'Ctrl')+' K</kbd></div>'
    +'<div class="qb-right" id="qbRight"></div>';
  qbRecentSync_(); qbRightSync_();
}
function qbRecentSync_(){
  var box=document.getElementById('qbRecent'); if(!box) return;
  var v=qbRecent_().filter(function(c){ return TREE.some(function(t){ return t[0]===c; }) || customGroups().indexOf(c)>=0; });
  if(S.node && v.indexOf(S.node)<0) v.unshift(S.node);
  box.innerHTML='<span class="qb-lbl" title="Hạng mục gần đây — bấm để chuyển">'+icon('clock',14)+'</span>'
    +(v.length?v.slice(0,QB_RECENT_N).map(function(c){
      var on=(c===S.node), n=(typeof nodeCount==='function')?nodeCount(c):0;
      return '<button class="qb-chip'+(on?' on':'')+'" title="'+esc(c+'. '+nodeName(c))+'" onclick="qbGoNode_(\''+esc(c)+'\')">'
        +'<span class="qb-cc">'+esc(c)+'</span>'+esc(nodeName(c))+(n?'<i>'+n+'</i>':'')+'</button>';
    }).join(''):'<span class="qb-empty">Chưa có hạng mục gần đây</span>');
}
function qbRightSync_(){
  var box=document.getElementById('qbRight'); if(!box) return;
  var nf=(typeof activeFiltCount_==='function')?activeFiltCount_():0;
  var side=(typeof sideGet_==='function')&&sideGet_(), zen=(typeof foldAllOn_==='function')&&foldAllOn_();
  box.innerHTML=qbBtn_('qbFilt',QB_IC.filter,'Bộ lọc sản phẩm'+(nf?(' — đang lọc '+nf):''),'qbFilter_(event)',nf>0,nf||'')
    +qbBtn_('qbFav',icon('heart',16),S.fFav?'Đang chỉ hiện sản phẩm yêu thích — bấm để bỏ':'Chỉ hiện sản phẩm yêu thích','catFavToggle();qbRightSync_()',!!S.fFav)
    +qbBtn_('qbHist',QB_IC.hist,'Vừa thêm vào bảng — xem lại / thêm lại','qbHistPop_(event)',false)
    +qbBtn_('qbRepl',QB_IC.repl,'Tìm & thay trong bảng (Ctrl+F)','openFindReplace()',false)
    +'<span class="qb-sep"></span>'
    +qbBtn_('qbSide',QB_IC.panel,side?'Hiện panel sản phẩm bên trái':'Ẩn panel sản phẩm — bảng rộng hơn','sideToggle_();qbRightSync_()',side)
    +qbBtn_('qbZen',QB_IC.zen,zen?'Mở lại các khối đầu trang':'Mở rộng bảng — thu gọn băng dự án, tổng tiền, chip cột','foldAll_()',zen)
    +'<button class="qb-exp" onclick="showTab(\'export\')" title="Sang tab Xuất báo giá">'+icon('download',14)+' Xuất báo giá</button>';
}
function qbGoNode_(code){ if(code===S.node) return; pickNode(code); }
function qbFilter_(e){
  if(e&&e.stopPropagation) e.stopPropagation();
  if(typeof sideGet_==='function' && sideGet_()) sideToggle_();      // bộ lọc nằm ở panel trái -> mở panel nếu đang ẩn
  toggleFiltDrop(); qbRightSync_();
}
/* ---------- Tìm nhanh ---------- */
function qbNorm_(s){ return String(s||'').normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/đ/g,'d').replace(/Đ/g,'D').toLowerCase(); }
function qbResults_(q){
  var n=qbNorm_(q).trim(); if(!n) return [];
  var ws=n.split(/\s+/), hit=function(t){ t=qbNorm_(t); return ws.every(function(w){ return t.indexOf(w)>=0; }); };
  var out=[];
  (S.lines||[]).forEach(function(l){ if(hit([l.ten,l.maSP,l.thuongHieu,l.khuVuc].join(' ')))
    out.push({g:'Trong bảng bóc tách', t:l.ten, s:[l.nhom+'. '+nodeName(l.nhom), l.khuVuc, 'SL '+(l.soLuong||0)].filter(Boolean).join(' · '), k:'line', id:l.lineId}); });
  TREE.forEach(function(t){ if(t[0]!=='X' && hit(t[0]+' '+t[1])) out.push({g:'Hạng mục', t:t[0]+'. '+t[1], s:(nodeCount(t[0])||0)+' dòng', k:'node', id:t[0]}); });
  (S.products||[]).forEach(function(p,i){ if(hit([p.ten,p.ma,p.thuongHieu,p.hangMuc].join(' ')))
    out.push({g:'Sản phẩm — thêm vào '+nodeName(S.node), t:p.ten, s:[p.ma,p.thuongHieu,p.donGiaBan?money(p.donGiaBan)+' đ':''].filter(Boolean).join(' · '), k:'prod', id:i, img:p.hinhAnh}); });
  PT_TEMPLATE.forEach(function(sec,si){ if(!sec.db) return; sec.items.forEach(function(a,ii){ if(hit(String(a[0])+' '+sec.t))
    out.push({g:'Công tác — thêm vào '+nodeName(S.node), t:String(a[0]).split('\n')[0], s:[String(sec.t).split('\n')[0], a[1], ptLibDg_(sec,a)?money(ptLibDg_(sec,a))+' đ':''].filter(Boolean).join(' · '), k:'ct', id:si+':'+ii}); }); });
  // mỗi nhóm tối đa vài kết quả cho gọn
  var dem={}; return out.filter(function(r){ dem[r.g]=(dem[r.g]||0)+1; return dem[r.g]<=(r.k==='node'?4:6); });
}
function qbSearch_(q){
  var old=document.getElementById('qbPop');
  var rs=qbResults_(q); S._qbRs=rs; S._qbI=0;
  if(!String(q||'').trim()){ if(old) old.remove(); return; }
  var pop=old||document.createElement('div'); pop.id='qbPop'; pop.className='qb-pop';
  var g='', html=rs.map(function(r,i){
    var h=(r.g!==g)?('<div class="qb-g">'+esc(r.g)+'</div>'):''; g=r.g;
    var ic=r.k==='line'?icon('list',14):(r.k==='node'?icon('layers',14):(r.k==='ct'?icon('doc',14):icon('tag',14)));
    return h+'<div class="qb-r'+(i===0?' on':'')+'" data-i="'+i+'" onmousedown="event.preventDefault();qbPick_('+i+')" onmousemove="qbMouse_(event,'+i+')">'
      +'<span class="qb-ri">'+ic+'</span><span class="qb-rt"><b>'+esc(r.t)+'</b><i>'+esc(r.s)+'</i></span>'
      +'<span class="qb-ra">'+({line:'Tới dòng',node:'Chuyển',prod:'＋ Thêm',ct:'＋ Thêm'}[r.k])+'</span></div>';
  }).join('');
  pop.innerHTML=html||'<div class="qb-none">Không tìm thấy “'+esc(q)+'”</div>';
  if(!old){ document.body.appendChild(pop); }
  var inp=document.getElementById('qbQ'); if(inp){ var r=inp.closest('.qb-find').getBoundingClientRect();
    pop.style.top=(r.bottom+6)+'px'; pop.style.left=r.left+'px'; pop.style.width=Math.max(r.width,420)+'px'; }
}
// Chỉ đổi dòng chọn khi chuột THẬT SỰ di chuyển — popup vẽ lại dưới con trỏ đứng yên cũng bắn mousemove,
// làm lựa chọn bằng phím ↑ ↓ bị nhảy về dòng dưới chuột.
document.addEventListener('mousemove',function(e){ S._mPrev=S._mCur; S._mCur=e.clientX+','+e.clientY; },true);   // chạy trước handler của dòng
function qbMouse_(e,i){ if(S._mPrev===S._mCur) return; qbHover_(i); }
function qbHover_(i){ S._qbI=i; document.querySelectorAll('#qbPop .qb-r').forEach(function(e){ e.classList.toggle('on', +e.dataset.i===i); }); }
function qbClose_(){ var p=document.getElementById('qbPop'); if(p) p.remove(); }
function qbKey_(e){
  var rs=S._qbRs||[], k=e.key||({13:'Enter',27:'Escape',38:'ArrowUp',40:'ArrowDown'})[e.keyCode]||'';   // dự phòng trình duyệt/IME không có e.key
  if(k==='Escape'){ qbClose_(); e.target.blur(); return; }
  if(k==='ArrowDown'||k==='ArrowUp'){ e.preventDefault(); if(!rs.length) return;
    var i=((S._qbI||0)+(k==='ArrowDown'?1:-1)+rs.length)%rs.length; qbHover_(i);
    var el=document.querySelector('#qbPop .qb-r[data-i="'+i+'"]'); if(el&&el.scrollIntoView) el.scrollIntoView({block:'nearest'}); return; }
  if(k==='Enter'){ e.preventDefault(); if(rs.length) qbPick_(S._qbI||0); }
}
async function qbPick_(i){
  var r=(S._qbRs||[])[i]; if(!r) return;
  var inp=document.getElementById('qbQ');
  if(r.k==='line'){ qbClose_(); if(inp) inp.blur();
    var l=(S.lines||[]).filter(function(x){ return x.lineId===r.id; })[0];
    if(l && l.nhom!==S.node) pickNode(l.nhom);
    setTimeout(function(){ tkGotoNewRow_(r.id); },60); return; }
  if(r.k==='node'){ qbClose_(); if(inp){ inp.value=''; inp.blur(); } pickNode(r.id); return; }
  if(r.k==='prod'){ var p=(S.products||[])[r.id]; if(p){ await addProdObj(p); toast('Đã thêm "'+p.ten+'" vào '+nodeName(S.node)); } }
  if(r.k==='ct'){ var x=r.id.split(':'); if(S.node==='3.1') ptAddFromLib(+x[0],+x[1]); else ctAddToBoc_(+x[0],+x[1]); }
  if(inp) inp.focus();                               // thêm xong vẫn giữ ô tìm để thêm tiếp
}
document.addEventListener('mousedown',function(e){ if(e.target.closest && (e.target.closest('#qbPop')||e.target.closest('.qb-find'))) return; qbClose_(); });
document.addEventListener('keydown',function(e){
  if(!(e.ctrlKey||e.metaKey) || String(e.key).toLowerCase()!=='k') return;
  if(!bocVisible_()) return;
  e.preventDefault(); var q=document.getElementById('qbQ'); if(q){ q.focus(); q.select(); }
});
/* ---------- Vừa thêm: 10 dòng mới nhất của dự án ---------- */
function qbHistPop_(e){
  if(e&&e.stopPropagation) e.stopPropagation();
  var old=document.getElementById('qbHistPop'); if(old){ old.remove(); return; }
  var ds=(S.lines||[]).slice(-10).reverse();
  var pop=document.createElement('div'); pop.id='qbHistPop'; pop.className='fltpop qb-hist';
  pop.innerHTML='<div class="bgt-h"><b>Vừa thêm vào bảng</b><button class="colpop-x" onclick="document.getElementById(\'qbHistPop\').remove()">✕</button></div>'
    +(ds.length?ds.map(function(l){
      return '<div class="qb-hr"><div class="qb-rt" onclick="qbHistGo_(\''+esc(l.lineId)+'\')" title="Tới dòng này"><b>'+esc(l.ten||'')+'</b>'
        +'<i>'+esc(l.nhom+'. '+nodeName(l.nhom))+(l.khuVuc?' · '+esc(l.khuVuc):'')+' · SL '+(l.soLuong||0)+'</i></div>'
        +'<button class="qb-plus" title="Thêm 1 số lượng" onclick="qbHistPlus_(\''+esc(l.lineId)+'\')">+1</button></div>';
    }).join(''):'<div class="qb-none">Bảng chưa có dòng nào.</div>');
  document.body.appendChild(pop);
  var b=document.getElementById('qbHist'); if(b){ var r=b.getBoundingClientRect(), w=pop.offsetWidth||320;
    pop.style.top=(r.bottom+6)+'px'; pop.style.left=Math.max(8,Math.min(r.right-w, window.innerWidth-w-10))+'px'; }
  setTimeout(function(){ document.addEventListener('mousedown',function h(ev){ if(ev.target.closest('#qbHistPop')||ev.target.closest('#qbHist')) return;
    var p=document.getElementById('qbHistPop'); if(p) p.remove(); document.removeEventListener('mousedown',h); }); },0);
}
function qbHistGo_(id){ var p=document.getElementById('qbHistPop'); if(p) p.remove();
  var l=(S.lines||[]).filter(function(x){ return x.lineId===id; })[0]; if(l && l.nhom!==S.node) pickNode(l.nhom);
  setTimeout(function(){ tkGotoNewRow_(id); },60); }
function qbHistPlus_(id){ var l=(S.lines||[]).filter(function(x){ return x.lineId===id; })[0]; if(!l) return;
  editLine(id,{soLuong:(Number(l.soLuong)||0)+1}); toast('+1 số lượng: '+l.ten);
  var p=document.getElementById('qbHistPop'); if(p){ p.remove(); qbHistPop_(); } }
function pickNode(code){
  S.node=code; qbRecentPush_(code);
  var tp=document.getElementById('treePop'); if(tp) tp.style.display='none';
  renderTree(); renderTable(); setDemucFilter(code);      // ô lọc trái luôn khớp đề mục đang bóc
  hmSet_(code,'boc');                                     // đồng bộ sang các tab khác
}
function pickNodeIdx(i){ var t=(S._tree||[])[i]; if(t) pickNode(t.code); }
async function addCustomGroup(){
  if(!S.cur){ toast('Chưa chọn dự án'); return; }
  var name=await askInput_({title:'Thêm hạng mục', label:'Tên hạng mục / nhóm mới', placeholder:'VD: Thiết bị vệ sinh', confirmText:'Thêm'});
  if(name==null) return; name=String(name).trim(); if(!name) return;
  var cur=customGroups(); if(cur.indexOf(name)<0) cur.push(name);
  try{ var p=await api('updateProject',S.cur.maDA,{nhomTuTao:cur.join('|')}); syncProj(p); S.node=name;
    document.getElementById('treePop').style.display='none'; renderTree(); renderTable(); toast('Đã thêm hạng mục: '+name); }
  catch(e){ toast('Lỗi: '+e.message); }
}
async function delCustomGroup(i){
  var t=(S._tree||[])[i]; if(!t) return;
  if(!confirm('Xoá hạng mục "'+t.name+'"?')) return;
  var cur=customGroups().filter(function(s){ return s!==t.code; });
  try{ var p=await api('updateProject',S.cur.maDA,{nhomTuTao:cur.join('|')}); syncProj(p); if(S.node===t.code)S.node='3.2.6.1'; renderTree(); renderTable(); toast('Đã xoá'); }
  catch(e){ toast('Lỗi: '+e.message); }
}
document.addEventListener('click',function(e){
  if(!document.contains(e.target)) return;      // mục vừa bấm đã được vẽ lại (duyệt cấp con) -> không phải bấm ra ngoài
  if(!e.target.closest('#treePop') && !e.target.closest('#treeBtn')){ var p=document.getElementById('treePop'); if(p) p.style.display='none'; }
});

/* ===== CHỌN CỘT — 1 nút + bảng chọn thả xuống (dùng chung cho bảng Bóc tách và Khái toán) =====
   Trước đây trải hết chip ra 2-3 hàng, chiếm gần hết phần đầu bảng.                     */
/* ═══ CHỌN NHANH bộ cột cho bảng bóc tách ═══
   Hàng chip vẫn giữ để bật/tắt từng cột; nút "Chọn nhanh" bật cả một bộ cột
   theo mục đích trong 1 lần bấm. Bộ "Báo giá cho khách" ẩn đúng các cột mà file
   mẫu ghi "Ẩn trong xuất báo giá" (giá đại lý, lợi nhuận, markup, margin…).       */
var TK_PRESETS=[
  ['all','Hiện tất cả cột',null],
  ['macdinh','Mặc định','default'],
  ['khach','Báo giá cho khách',['stt','khuVuc','ten','thuongHieu','moTa','kichThuoc','hinhAnh','dvt','soLuong','donGia','ckKhach','donGiaCK','thanhTien','ghiChu']],
  ['sp','Thông tin sản phẩm',['stt','khuVuc','maBanVe','maSP','ten','thuongHieu','ncc','moTa','kichThuoc','hinhAnh','dvt','soLuong']],
  ['gia','Giá & lợi nhuận',['stt','ten','soLuong','giaNCC','chietKhau','giaDaiLy','lnPct','donGia','ckKhach','donGiaCK','markup','margin','lnVnd','thanhTien']],
  ['gon','Tối giản',['stt','ten','soLuong','donGiaCK','thanhTien']]
];
function tkPresetKeys_(ps){
  if(ps[2]===null) return COLS.map(function(c){ return c[0]; });
  if(ps[2]==='default') return COLS.filter(function(c){ return c[2]; }).map(function(c){ return c[0]; });
  return ps[2];
}
function tkPresetOn_(ps){                      // bộ cột nào đang khớp đúng với cột đang bật
  var want={}; tkPresetKeys_(ps).forEach(function(k){ want[k]=1; });
  return COLS.every(function(c){ return !!S.cols[c[0]]===!!want[c[0]]; });
}
function tkPresetApply_(id){
  var ps=TK_PRESETS.filter(function(x){ return x[0]===id; })[0]; if(!ps) return;
  var want={}; tkPresetKeys_(ps).forEach(function(k){ want[k]=1; });
  COLS.forEach(function(c){ S.cols[c[0]]=!!want[c[0]]; });
  S.cols.ten=true;                               // cột Tên sản phẩm luôn phải có
  tkPresetClose_(); renderColChips(); renderTable(); if(bgVis()) drawBaogia();
  toast('Đã bật bộ cột: '+ps[1]);
}
/* ═══ BỘ CỘT "CỦA TÔI" — lưu theo TÀI KHOẢN ═══
   Bấm "Lưu cột đang hiện…" -> ghi vào users.ui_prefs.tkCols trên server (đăng nhập máy khác vẫn còn),
   kèm bản dự phòng localStorage theo tên tài khoản. Mỗi lần đăng nhập tự bật lại đúng bộ này. */
function tkMyKey_(){ return 'qs_tkcols_'+String((S.me&&S.me.username)||'').toLowerCase(); }
function tkMyCols_(){
  var v=S.me&&S.me.uiPrefs&&S.me.uiPrefs.tkCols;
  if(!Array.isArray(v)){ try{ v=JSON.parse(localStorage.getItem(tkMyKey_())||'null'); }catch(e){ v=null; } }
  if(!Array.isArray(v)) return null;
  var ok={}; COLS.forEach(function(c){ ok[c[0]]=1; });
  v=v.filter(function(k){ return ok[k]; });
  return v.length?v:null;
}
function tkMyOn_(){ var v=tkMyCols_(); if(!v) return false; var want={}; v.forEach(function(k){ want[k]=1; }); want.ten=1;
  return COLS.every(function(c){ return !!S.cols[c[0]]===!!want[c[0]]; }); }
// Đăng nhập xong: bật bộ cột của tài khoản (chưa lưu thì về Mặc định — không mang bộ cột của tài khoản trước)
function tkMyColsApply_(){
  var v=tkMyCols_(), want={};
  if(v){ v.forEach(function(k){ want[k]=1; }); } else COLS.forEach(function(c){ if(c[2]) want[c[0]]=1; });
  COLS.forEach(function(c){ S.cols[c[0]]=!!want[c[0]]; }); S.cols.ten=true;
}
function tkMyUse_(){
  if(!tkMyCols_()) return; tkMyColsApply_();
  tkPresetClose_(); renderColChips(); renderTable(); if(bgVis()) drawBaogia();
  toast('Đã bật bộ cột của tôi');
}
async function tkMySave_(){
  var keys=COLS.filter(function(c){ return S.cols[c[0]]; }).map(function(c){ return c[0]; });
  try{ localStorage.setItem(tkMyKey_(), JSON.stringify(keys)); }catch(e){}
  try{
    var r=await api('setMyPref','tkCols',keys);
    if(S.me) S.me.uiPrefs=(r&&r.uiPrefs)||Object.assign({},S.me.uiPrefs,{tkCols:keys});
    toast('Đã lưu '+keys.length+' cột làm mặc định của tài khoản '+((S.me&&S.me.username)||''));
  }catch(e){ toast('Đã lưu trên máy này. Lưu theo tài khoản lỗi: '+e.message); }
  tkPresetClose_(); renderColChips();
}
async function tkMyClear_(){
  if(!confirm('Xoá bộ cột "Của tôi"? Lần sau đăng nhập sẽ dùng bộ Mặc định.')) return;
  try{ localStorage.removeItem(tkMyKey_()); }catch(e){}
  try{ var r=await api('setMyPref','tkCols',null); if(S.me) S.me.uiPrefs=(r&&r.uiPrefs)||{}; }
  catch(e){ if(S.me&&S.me.uiPrefs) delete S.me.uiPrefs.tkCols; }
  tkPresetClose_(); renderColChips(); toast('Đã xoá bộ cột của tôi');
}
function tkPresetPop_(e){
  if(e&&e.stopPropagation) e.stopPropagation();
  if(document.getElementById('tkPresetPop')){ tkPresetClose_(); return; }
  var pop=document.createElement('div'); pop.className='fltpop bgtree'; pop.id='tkPresetPop';
  var mine=tkMyCols_(), mineOn=tkMyOn_(), dem=COLS.filter(function(c){ return S.cols[c[0]]; }).length;
  pop.innerHTML='<div class="bgt-h"><b>Chọn nhanh cột</b><button class="colpop-x" onclick="tkPresetClose_()">✕</button></div>'
    +'<div class="bgt-b">'
      // bộ cột RIÊNG của tài khoản — luôn đứng đầu
      +(mine?('<div class="bgt-i lvl1 tkmine'+(mineOn?' on':'')+'" onclick="tkMyUse_()">'
          +'<span class="nm">'+icon('check',13)+' Của tôi <i class="tkmine-u">'+esc((S.me&&S.me.username)||'')+'</i></span><span class="cn">'+mine.length+' cột</span>'
          +'<span class="rd'+(mineOn?' on':'')+'"></span></div>'):'')
      +TK_PRESETS.map(function(ps){
        var on=tkPresetOn_(ps), n=tkPresetKeys_(ps).length;
        return '<div class="bgt-i lvl1'+(on?' on':'')+'" onclick="tkPresetApply_(\''+ps[0]+'\')">'
          +'<span class="nm">'+esc(ps[1])+'</span><span class="cn">'+n+' cột</span>'
          +'<span class="rd'+(on?' on':'')+'"></span></div>';
      }).join('')+'</div>'
    +'<div class="tkmine-f">'
      +'<button class="btn blue sm" onclick="tkMySave_()"'+(mineOn?' disabled title="Bộ cột đang hiện đã là bộ của bạn"':'')+'>'+icon('check',13)
        +' Lưu '+dem+' cột đang hiện làm mặc định của tôi</button>'
      +(mine?'<button class="btn ghost sm" onclick="tkMyClear_()">Xoá bộ của tôi</button>':'')
      +'<div class="tkmine-n">Lưu theo tài khoản — lần sau đăng nhập (kể cả máy khác) tự hiện đúng các cột này.</div>'
    +'</div>';
  document.body.appendChild(pop);
  var b=document.getElementById('tkPresetBtn');
  if(b){ var r=b.getBoundingClientRect(), w=pop.offsetWidth||300, h=pop.offsetHeight;
    var top=r.bottom+6; if(top+h>window.innerHeight-10) top=Math.max(10, r.top-h-6);
    pop.style.top=top+'px'; pop.style.left=Math.max(8,Math.min(r.left, window.innerWidth-w-10))+'px'; }
  setTimeout(function(){ document.addEventListener('mousedown',tkPresetOutside_); },0);
}
function tkPresetOutside_(e){ if(e.target.closest('#tkPresetPop')||e.target.closest('#tkPresetBtn')) return; tkPresetClose_(); }
function tkPresetClose_(){ var p=document.getElementById('tkPresetPop'); if(p) p.remove(); document.removeEventListener('mousedown',tkPresetOutside_); }
function renderColChips(){
  var el=document.getElementById('colChips'); if(!el) return;
  var on=COLS.filter(function(c){ return S.cols[c[0]]; }).length;
  var cur=TK_PRESETS.filter(tkPresetOn_)[0];
  var nhan=tkMyOn_()?'Của tôi':(cur?cur[1]:'Chọn nhanh');
  var nut='<button class="chip-quick" id="tkPresetBtn" onclick="tkPresetPop_(event)" title="Bật cả một bộ cột theo mục đích / bộ cột của tôi">'
      +icon('sliders',13)+'<span>'+esc(nhan)+'</span><b>'+on+'/'+COLS.length+'</b><i>▾</i></button>';
  var slot=document.getElementById('tkPresetSlot'), nEl=document.getElementById('tkColsN');
  if(nEl) nEl.textContent=on+'/'+COLS.length;
  if(slot) slot.innerHTML=nut;
  el.innerHTML=(slot?'':nut)
    +COLS.map(function(c){
    return '<span class="chip'+(S.cols[c[0]]?' on':'')+'" onclick="toggleCol(\''+c[0]+'\')">'+esc(c[1])+'</span>';
  }).join('');
  if(document.getElementById('tkColPop')) tkColPopRender_();
}
function tkColPop_(e){
  if(e&&e.stopPropagation) e.stopPropagation();
  var old=document.getElementById('tkColPop');
  if(old){ old.remove(); document.removeEventListener('mousedown',tkColOutside_); return; }
  var pop=document.createElement('div'); pop.className='fltpop colpop'; pop.id='tkColPop';
  document.body.appendChild(pop); tkColPopRender_();
  var btn=document.getElementById('tkColBtn');
  if(btn){ var r=btn.getBoundingClientRect(), w=pop.offsetWidth||300;
    pop.style.top=(r.bottom+6)+'px'; pop.style.left=Math.max(8,Math.min(r.left, window.innerWidth-w-10))+'px'; }
  setTimeout(function(){ document.addEventListener('mousedown',tkColOutside_); },0);
  var q=document.getElementById('tkColQ'); if(q) q.focus();
}
function tkColOutside_(e){
  if(e.target.closest('#tkColPop')||e.target.closest('#tkColBtn')) return;
  var p=document.getElementById('tkColPop'); if(p) p.remove();
  document.removeEventListener('mousedown',tkColOutside_);
}
function tkColPopRender_(){
  var pop=document.getElementById('tkColPop'); if(!pop) return;
  var q=spNorm_((document.getElementById('tkColQ')||{}).value||'');
  var on=COLS.filter(function(c){ return S.cols[c[0]]; }).length;
  var list=COLS.filter(function(c){ return !q || spNorm_(c[1]).indexOf(q)>=0; });
  pop.innerHTML='<div class="colpop-h"><b>Cột hiển thị</b><span class="colpop-n">'+on+'/'+COLS.length+'</span>'
      +'<button class="colpop-x" onclick="tkColPop_()">✕</button></div>'
    +'<div class="colpop-s"><input id="tkColQ" placeholder="Tìm cột…" value="'+esc((document.getElementById('tkColQ')||{}).value||'')+'" oninput="tkColPopRender_()"></div>'
    +'<div class="colpop-b">'+(list.length?list.map(function(c){
        return '<label class="colpop-i"><input type="checkbox" '+(S.cols[c[0]]?'checked':'')+' onchange="toggleCol(\''+c[0]+'\')"><span>'+esc(c[1])+'</span></label>';
      }).join(''):'<div class="colpop-empty">Không có cột nào khớp</div>')+'</div>'
    +'<div class="colpop-f"><button class="btn ghost xs" onclick="tkColAll_(1)">Hiện tất cả</button>'
      +'<button class="btn ghost xs" onclick="tkColAll_(0)">Chỉ cột cơ bản</button></div>';
}
var TK_COL_CB=['stt','tang','ten','thuongHieu','soLuong','donGia','thanhTien','hinhAnh'];
function tkColAll_(on){
  COLS.forEach(function(c){ S.cols[c[0]] = on ? true : (TK_COL_CB.indexOf(c[0])>=0); });
  saveCols&&saveCols(); renderColChips(); renderTable(); if(bgVis()) drawBaogia();
}
function bgVis(){ var e=document.getElementById('v-export'); return e && e.classList.contains('on'); }
function toggleCol(k){ S.cols[k]=!S.cols[k]; renderColChips(); renderTable(); if(bgVis()) drawBaogia(); }

/* ===== TAKEOFF TABLE ===== */
function visCols(){ var byK={}; COLS.forEach(function(c){ byK[c[0]]=c; });
  return (S.colOrder||COLS.map(function(c){return c[0];})).map(function(k){ return byK[k]; }).filter(function(c){ return c && S.cols[c[0]]; }); }
// giá đại lý = giá bán lẻ (giá vốn NCC) sau chiết khấu đại lý  |  đơn giá = giá bán sau chiết khấu khách
function giaDaiLy_(l){ return Math.round((Number(l.donGiaVon)||0)*(1-(Number(l.chietKhau)||0)/100)); }
function donGiaCK_(l){ return Math.round((Number(l.donGiaBan)||0)*(1-(Number(l.ckKhach)||0)/100)); }
// các cột dẫn xuất — tính trực tiếp từ dòng để luôn nhất quán với server (không phụ thuộc field đã lưu)
function ttVon_(l){ return Math.round((Number(l.soLuong)||0)*giaDaiLy_(l)); }
function ttBan_(l){ return Math.round((Number(l.soLuong)||0)*donGiaCK_(l)); }
function lnVnd_(l){ return Math.round((donGiaCK_(l)-giaDaiLy_(l))*(Number(l.soLuong)||0)); }
function markup_(l){ var g=giaDaiLy_(l); return g>0?Math.round((donGiaCK_(l)-g)/g*100):0; }
function margin_(l){ var d=donGiaCK_(l); return d>0?Math.round((d-giaDaiLy_(l))/d*100):0; }
// Tính lại dòng khi sửa — mirror y hệt calc_() ở server. Chỉ đổi hướng giá bán khi trường liên quan bị sửa
function recalcLine_(l, changed){
  changed=changed||{};
  var von=Number(l.donGiaVon)||0;
  if(changed.hasOwnProperty('donGiaBan')){ l.lnPct = von>0 ? Math.round(((Number(l.donGiaBan)||0)-von)/von*100) : 0; }
  else if(changed.hasOwnProperty('lnPct') || changed.hasOwnProperty('donGiaVon')){ l.donGiaBan = Math.round(von*(1+(Number(l.lnPct)||0)/100)); }
  l.thanhTienVon=ttVon_(l); l.thanhTienBan=ttBan_(l);
  l.lnVnd=lnVnd_(l); l.markup=markup_(l); l.margin=margin_(l);
}
function cellVal(l,key){
  switch(key){
    case 'khuVuc': return esc(l.khuVuc||'');
    case 'maBanVe': return esc(l.maBanVe||'');
    case 'nganh': return esc((l.extra&&l.extra.nganh)||'');
    case 'maSP': return esc(l.maSP||'');
    case 'ten': return '<span class="pname">'+esc(l.ten||'')+'</span>';
    case 'thuongHieu': return esc(l.thuongHieu||'');
    case 'ncc': return esc(l.ncc||'');
    case 'moTa': return '<div class="desc">'+esc(l.moTa||'')+'</div>';
    case 'kichThuoc': return esc(l.kichThuoc||'');
    case 'hinhAnh': return l.hinhAnh?'<img class="pimg" src="'+esc(imgSrc1_(l.hinhAnh))+'" onclick="imgPop_(this.src)" title="Bấm để xem ảnh lớn" onerror="this.style.visibility=\'hidden\'">':'';
    case 'dvt': return esc(l.dvt||'');
    case 'giaNCC': return money(l.donGiaVon);
    case 'chietKhau': return (Number(l.chietKhau)||0)+'%';
    case 'giaDaiLy': return money(giaDaiLy_(l));
    case 'lnPct': return (Number(l.lnPct)||0)+'%';
    case 'donGiaCK': return money(donGiaCK_(l));
    case 'markup': { var dl=giaDaiLy_(l),dg=donGiaCK_(l); return dl>0?Math.round((dg-dl)/dl*100)+'%':'—'; }
    case 'margin': { var dl2=giaDaiLy_(l),dg2=donGiaCK_(l); return dg2>0?Math.round((dg2-dl2)/dg2*100)+'%':'—'; }
    case 'lnVnd': return money((donGiaCK_(l)-giaDaiLy_(l))*(Number(l.soLuong)||0));
    case 'thanhTien': return money(l.thanhTienBan);
    case 'trangThai': return esc(l.trangThai||'');
    case 'ghiChu': return esc(l.ghiChu||'');
  }
  return '';
}
// Ô sửa được (như bảng Excel cũ). Cột chỉ-đọc: stt, hình ảnh, ngành, giá đại lý, thành tiền.
var TXT_COL={ khuVuc:'khuVuc', maBanVe:'maBanVe', ncc:'ncc', maSP:'maSP', thuongHieu:'thuongHieu',
  dvt:'dvt', trangThai:'trangThai', ghiChu:'ghiChu', kichThuoc:'kichThuoc', ten:'ten' };
var NUM_COL={ soLuong:'soLuong', giaNCC:'donGiaVon', lnPct:'lnPct', chietKhau:'chietKhau', donGia:'donGiaBan', ckKhach:'ckKhach' };
var MONEY_COL={ giaNCC:1, donGia:1 };
function editLineMoney_(id,f,v){ var d={}; d[f]=tkNum_(v); editLine(id,d); }
function cellInput(l,key){
  if(key==='moTa') return '<td class="wrap"><textarea class="cin" rows="1" oninput="autoGrow(this)" onchange="editLine(\''+l.lineId+'\',{moTa:this.value})">'+esc(l.moTa||'')+'</textarea></td>';
  if(key==='kichThuoc') return '<td class="wrap"><textarea class="cin" rows="1" oninput="autoGrow(this)" onchange="editLine(\''+l.lineId+'\',{kichThuoc:this.value})">'+esc(l.kichThuoc||'')+'</textarea></td>';
  if(key==='ten') return '<td class="td-ten"><div style="display:flex;gap:2px;align-items:center"><input class="cin" value="'+esc(l.ten||'')+'" onchange="editLine(\''+l.lineId+'\',{ten:this.value})"><button class="pick" title="Chọn sản phẩm từ danh mục" onclick="openPick(\''+l.lineId+'\',event)">⌕</button></div></td>';
  if(TXT_COL[key]){ var f=TXT_COL[key];
    return '<td'+(key==='dvt'?' class="ct"':'')+'><input class="cin'+(key==='dvt'?' dvt-in':'')+'"'+(key==='khuVuc'?' placeholder="Phòng…" list="phongList"':'')+' value="'+esc(l[f]||'')+'" onchange="editLine(\''+l.lineId+'\',{'+f+':this.value})"></td>'; }
  if(key==='lnPct'){
    return '<td class="num ln-cell"><input class="cin num" type="number" step="any" value="'+(Number(l.lnPct)||0)+'"'
      +' onchange="editLine(\''+l.lineId+'\',{lnPct:this.value})">'
      +'<button class="ln-pick" title="Chọn nhanh 5 · 10 · 15 · 20 · 30 · 35 · 40 · 45%"'
      +' onclick="lnPickPop_(event,\''+l.lineId+'\')">▾</button></td>';
  }
  if(NUM_COL[key]){ var f2=NUM_COL[key];
    // Ô TIỀN hiện dấu chấm ngàn cho dễ đọc (gõ kiểu nào cũng nhận); ô số lượng/% giữ ô number
    if(MONEY_COL[key]) return '<td class="num"><input class="cin num money" type="text" inputmode="numeric"'
      +' value="'+(Number(l[f2])?money(l[f2]):'')+'" placeholder="0"'
      +' onchange="editLineMoney_(\''+l.lineId+'\',\''+f2+'\',this.value)"></td>';
    return '<td class="num"><input class="cin num" type="number" value="'+(Number(l[f2])||0)+'" onchange="editLine(\''+l.lineId+'\',{'+f2+':this.value})"></td>'; }
  // Lợi nhuận: gõ vào là tính NGƯỢC ra giá bán (trước đây chỉ hiện số, không nhập được)
  if(key==='markup'||key==='margin'||key==='lnVnd'){
    var cur = key==='lnVnd' ? Math.round((donGiaCK_(l)-giaDaiLy_(l))*(Number(l.soLuong)||0))
            : (key==='markup'?markup_(l):margin_(l));
    var ttl = key==='markup' ? 'Lợi nhuận trên giá vốn — gõ % để tính ra giá bán'
            : (key==='margin' ? 'Lợi nhuận trên giá bán — gõ % để tính ra giá bán'
                              : 'Lợi nhuận cả dòng (VND) — gõ số để tính ra giá bán');
    return '<td class="num"><input class="cin num ln-in" type="number" step="any" title="'+ttl+'"'
      +' value="'+cur+'" onchange="editProfit_(\''+l.lineId+'\',\''+key+'\',this.value)">'
      +(key==='lnVnd'?'':'<i class="ln-pc">%</i>')+'</td>';
  }
  var cls=(['giaDaiLy','donGiaCK','thanhTien'].indexOf(key)>=0)?'num':(['hinhAnh','nganh'].indexOf(key)>=0?'ct':'');
  return '<td class="'+cls+'">'+cellVal(l,key)+'</td>';
}
function renderTable(){
  var code=S.node;
  // Đề mục "Phần thô" (3.1) -> bảng ước tính chi phí xây dựng thô (theo mẫu Excel)
  var isPT = (code==='3.1');
  var tkN=document.getElementById('tkNormal'), pw=document.getElementById('ptWrap');
  // Phần thô chỉ là 1 hạng mục: khi chọn thì hiện bảng của nó ở khu bên phải,
  // vẫn giữ nguyên khung chọn sản phẩm bên trái + bố cục 2 cột.
  if(tkN) tkN.style.display = isPT?'none':'';
  if(pw) pw.style.display = isPT?'':'none';
  // panel chi tiết dùng chung: rời đề mục thì đóng panel của đề mục cũ
  if(isPT && S._detailIdx!=null) hideDetail();
  if(!isPT && S._ptDetail) ptHideDetail_();
  if(isPT){ tkSheetChips_([]); renderPhanTho(); return; }     // Phần thô: chip gắn với Loại báo giá bên trái
  var lines=S.lines.filter(function(l){ return l.nhom===code || String(l.nhom||'').indexOf(code+'.')===0; });
  tkSheetChips_(tkSheetCo_()?lines:null);                 // chip Nhân công / Vật tư (chỉ vài hạng mục có)
  if(S.sheet && tkSheetCo_()) lines=lines.filter(function(l){ return tkSheetOf_(l)===S.sheet; });
  document.getElementById('tkCount').textContent='['+pad2(lines.length)+']';
  var t=document.getElementById('tkTable');
  if(!S.cur){ t.style.width=''; t.innerHTML='<tr><td class="empty">Chưa chọn dự án.</td></tr>'; tkSheetChips_(null); return; }
  var flt=S.colFilter||{};
  Object.keys(flt).forEach(function(k){ lines=lines.filter(function(l){ return colPlain(l,k)===flt[k]; }); });
  var cols=visCols();
  var numK=['soLuong','giaNCC','giaDaiLy','donGia','donGiaCK','lnVnd','thanhTien'], ctK=['stt','hinhAnh','dvt','chietKhau','lnPct','ckKhach','markup','margin'];
  var groups={};
  lines.forEach(function(l){ var g=(l.tang||'').trim()||'CHƯA PHÂN TẦNG'; (groups[g]=groups[g]||[]).push(l); });
  var order=floorsList().slice();
  Object.keys(groups).forEach(function(g){ if(order.indexOf(g)<0) order.push(g); });
  var totalW=cols.reduce(function(s,c){ return s+colW(c[0]); },0);
  var colg='<colgroup>'+cols.map(function(c){ return '<col style="width:'+colW(c[0])+'px">'; }).join('')+'</colgroup>';
  var head='<tr>'+cols.map(function(c){ var cls=numK.indexOf(c[0])>=0?'num':(ctK.indexOf(c[0])>=0?'ct':'');
    var lbl=c[1], on=S.sortKey===c[0];
    return '<th class="thk '+cls+(flt[c[0]]?' fltOn':'')+(on?' sortOn':'')+'" data-k="'+c[0]+'" draggable="true"><span class="thl" onclick="toggleSort(\''+c[0]+'\')" title="Bấm để sắp xếp">'+esc(lbl)+(on?(S.sortDir==='desc'?' ▼':' ▲'):'')+'</span>'
      +'<span class="thflt" title="Lọc cột" onclick="openFilter(event,\''+c[0]+'\')">▾</span><span class="thrsz" data-k="'+c[0]+'"></span></th>'; }).join('')+'</tr>';
  var body='';
  if(!order.length){ body='<tr><td class="empty" colspan="'+cols.length+'">Chưa có tầng/hạng mục. Bấm “＋ Tầng”, rồi “＋ Hạng mục” — hoặc thêm sản phẩm từ danh mục bên trái.</td></tr>'; }
  order.forEach(function(g,gi){
    var roman=['I','II','III','IV','V','VI','VII','VIII','IX','X'][gi]||(gi+1);
    var col=S.collapsed[g]?'▸':'▾';
    var gval=(g==='CHƯA PHÂN TẦNG'?'':g), isSel=((S.selFloor||'')===gval);
    var gsum=(groups[g]||[]).reduce(function(s,l){ return s+(Number(l.thanhTienBan)||0); },0);
    body+='<tr class="grp'+(isSel?' selFloor':'')+'" draggable="true" data-g="'+esc(g)+'"><td colspan="'+cols.length+'" data-f="'+esc(g)+'">'
      +'<span class="gcol" onclick="event.stopPropagation();toggleFloor(this.closest(\'td\').dataset.f)">'+col+'</span> '
      +'<span class="gname" onclick="selectFloor(this.closest(\'td\').dataset.f)" ondblclick="renameFloor(this.closest(\'td\').dataset.f)" title="Bấm để chọn tầng · bấm đúp đổi tên" style="cursor:pointer">'+roman+'. '+esc(g)+'</span>'
      +'<span class="gsel" onclick="selectFloor(this.closest(\'td\').dataset.f)">'+(isSel?'✓ đang thêm':'chọn')+'</span>'
      +'<span class="gsum">Tổng tầng: <b>'+money(gsum)+' đ</b></span></td></tr>';
    if(S.collapsed[g]) return;
    var tkSpacer='<tr class="tk-spacer"><td colspan="'+cols.length+'"></td></tr>';   // khoảng trắng: 1 ô, KHÔNG kẻ dọc
    body+=tkSpacer;   // dòng khoảng trắng sau header tầng (như PDF)
    sortLines_(groups[g]||[]).forEach(function(l,ri){
      var hs=S.rowH[l.lineId]?' style="height:'+S.rowH[l.lineId]+'px"':'';
      body+='<tr class="drow'+(ri%2===0?' alt':'')+cfClass_(l)+(tkSelHas_(l.lineId)?' rowsel':'')+'" draggable="true" data-id="'+l.lineId+'" data-tang="'+esc(l.tang||'')+'"'+hs+'>'+cols.map(function(c){
        var k=c[0];
        if(k==='stt') return '<td class="ct dragH" data-k="stt" title="Kéo để di chuyển dòng · chuột phải để xoá">'
          +'<input type="checkbox" class="tkck" '+(tkSelHas_(l.lineId)?'checked':'')+' onclick="tkSelClick_(event,\''+l.lineId+'\')" title="Chọn dòng (giữ Shift để chọn cả vùng)">'
          +'<span class="grip">⠿</span><span class="sttn">'+(gi+1)+'.'+(ri+1)+'</span></td>';
        return tdK_(cellInput(l,k),k);
      }).join('')+'</tr>';
    });
    body+=tkSpacer;   // dòng khoảng trắng trước tầng kế (như PDF)
  });
  var selF=(S.selFloor||'').trim();
  body+='<tr class="addrow"><td colspan="'+cols.length+'">'
    +'<button class="addbtn floor" onclick="openAddFloor(event)">'+icon('plus',15)+'Thêm tầng / phòng</button>'
    +'<button class="addbtn item" onclick="addBlankItem()" title="Thêm 1 hạng mục trống vào tầng đang chọn">'+icon('plus',15)+'Thêm hạng mục'
      +(selF?'<span class="addbtn-sub">vào '+esc(selF)+'</span>':'')+'</button>'
    +'</td></tr>';
  t.style.width=totalW+'px';
  var frzN=Math.min(S.freezeN||0,cols.length);
  t.className='tk'+(frzN?(' frz'+frzN):'');
  t.style.setProperty('--frz1w', colW(cols[0][0])+'px');
  // Giữ nguyên chỗ đang cuộn: đổi innerHTML làm khung cuộn tụt về đầu, nên mỗi lần thêm/sửa
  // 1 dòng là cả bảng nhảy lên trên. Lưu lại rồi trả về ngay sau khi dựng xong.
  var _w=t.closest('.tbl-wrap'), _sT=_w?_w.scrollTop:0, _sL=_w?_w.scrollLeft:0;
  t.innerHTML=colg+head+body;
  if(_w && (_sT||_sL)){ _w.scrollTop=_sT; _w.scrollLeft=_sL; }
  t.querySelectorAll('td.wrap textarea').forEach(autoGrow);   // ô "Thông tin chính" tự giãn hết dòng
  if(t.rows[0]) t.style.setProperty('--thH', t.rows[0].offsetHeight+'px');  // để dòng tầng dính ngay dưới header
  markBlocks_('#tkTable');   // kẻ dọc liền trong 1 tầng, hở giữa các tầng
  tkSelPrune_();       // bỏ khỏi vùng chọn những dòng không còn trên bảng
  tkFreezeRows_();     // cố định N hàng đầu (như Excel)
  tkSelBar_();         // thanh thao tác hàng loạt (nổi ở đáy màn hình)
  if(_w && (_sT||_sL) && (_w.scrollTop!==_sT||_w.scrollLeft!==_sL)){ _w.scrollTop=_sT; _w.scrollLeft=_sL; }
  tkRowNewPaint_();    // giữ vệt nháy của dòng vừa thêm qua các lần render lại
  renderActGutter();   // nút xoá đặt NGOÀI bảng (gutter phải), đồng bộ cuộn
  // ----- Tổng tiền (chưa VAT / VAT / tổng thành tiền) -----
  var sub=lines.reduce(function(s,l){ return s+(Number(l.thanhTienBan)||0); },0);
  var vatPct=Number(S.cur&&S.cur.vat)||0;
  var vat=Math.round(sub*vatPct/100);
  var te=document.getElementById('tkTotals');
  if(te){
    te.innerHTML='<div class="tkt-bar">'
     +'<div class="tkt-seg"><span class="tkt-ic">'+icon('money',16)+'</span><span class="tkt-c"><span class="tkt-l">Tổng chưa VAT</span><span class="tkt-v">'+money(sub)+' đ</span></span></div>'
     +'<div class="tkt-seg"><span class="tkt-ic">'+icon('gauge',16)+'</span><span class="tkt-c"><span class="tkt-l">Thuế VAT <input class="tkt-vat" type="number" step="any" min="0" value="'+vatPct+'" onchange="setVat(this.value)">%</span><span class="tkt-v">'+money(vat)+' đ</span></span></div>'
     +'<div class="tkt-seg grand"><span class="tkt-ic">'+icon('cart',17)+'</span><span class="tkt-c"><span class="tkt-l">Tổng thành tiền</span><span class="tkt-v">'+money(sub+vat)+' đ</span></span></div>'
     +'<button class="fold-btn tkt-fold" onclick="foldToggle_(\'totals\')" title="Thu gọn khối tổng tiền (vẫn thấy tổng trên hàng Hạng mục)"><i class="fold-ic"></i></button>'
     +'</div>';
  }
  var mini=document.getElementById('tkMini');
  if(mini) mini.innerHTML='<span>Tổng</span><b>'+money(sub+vat)+' đ</b>'+(vatPct?'<i>gồm VAT '+vatPct+'%</i>':'');
}
function setVat(v){
  v=Number(v)||0; if(!S.cur) return;
  S.cur.vat=v; renderTable();
  api('updateProject', S.cur.maDA, {vat:v}).then(function(p){ if(p){ p.vat=v; S.cur=p; var i=S.projects.findIndex(function(x){return x.maDA===p.maDA;}); if(i>=0)S.projects[i]=p; } }).catch(function(){});
}
// textarea tự cao theo nội dung (xuống dòng hiện đủ, không cắt)
function autoGrow(t){ if(!t) return; t.style.height='auto'; t.style.height=(t.scrollHeight+2)+'px'; t.style.overflowY='hidden'; }
/* Gõ lợi nhuận -> ra giá bán.
   giá đại lý (vốn thực) = giá bán lẻ NCC × (1 − CK đại lý)
   đơn giá sau CK khách  = giá bán × (1 − CK khách)
   Markup k : đơn giá = vốn × (1 + k/100)
   Margin m : đơn giá = vốn / (1 − m/100)
   Lợi nhuận L (cả dòng): đơn giá = vốn + L/số lượng                                     */
function editProfit_(id, key, val){
  var l=S.lines.filter(function(x){return x.lineId===id;})[0]; if(!l) return;
  var von=giaDaiLy_(l), sl=Number(l.soLuong)||0, ckK=(Number(l.ckKhach)||0)/100;
  var v=Number(String(val).replace(',','.'))||0;
  if(!von){ toast('Nhập "Giá bán lẻ" (giá vốn nhà cung cấp) trước — chưa có giá vốn thì không tính ngược được lợi nhuận'); renderTable(); return; }
  var dgCK;
  if(key==='markup') dgCK = von*(1+v/100);
  else if(key==='margin'){
    if(v>=100){ toast('Margin phải nhỏ hơn 100%'); renderTable(); return; }
    dgCK = von/(1-v/100);
  }
  else {                                    // lnVnd: lợi nhuận cả dòng
    if(!sl){ toast('Nhập số lượng trước'); renderTable(); return; }
    dgCK = von + v/sl;
  }
  if(ckK>=1){ toast('Chiết khấu khách hàng phải nhỏ hơn 100%'); renderTable(); return; }
  var giaBan=Math.round(dgCK/(1-ckK));
  if(giaBan<0){ toast('Lợi nhuận âm quá mức — giá bán ra số âm'); renderTable(); return; }
  editLine(id,{donGiaBan:giaBan});
}
function editLine(id,fields){
  // ---- Optimistic: cập nhật + render NGAY, đồng bộ server chạy nền ----
  var l=S.lines.filter(function(x){return x.lineId===id;})[0];
  if(l){
    Object.keys(fields).forEach(function(k){ l[k]=fields[k]; });
    recalcLine_(l, fields);   // mirror calc_() ở server -> optimistic khớp, không nhảy số / không lag
    renderTable(); renderCard();
    if(document.getElementById('v-chiphi').classList.contains('on')) renderChiphi();
    if(bgVis()) drawBaogia();
  }
  api('updateLine',id,fields).then(function(u){
    if(u){ var i=S.lines.findIndex(function(x){return x.lineId===id;}); if(i>=0) S.lines[i]=u; renderTable(); renderCard(); }
    else {
      // Server không tìm thấy dòng (đã bị xoá ở nơi khác) -> trước đây mất im lặng, nay báo + đồng bộ lại
      S.lines=S.lines.filter(function(x){ return x.lineId!==id; });
      renderTable(); renderCard(); renderActGutter&&renderActGutter();
      toast('Dòng này không còn tồn tại (đã bị xoá) — đã cập nhật lại bảng');
    }
    if(document.getElementById('v-chiphi').classList.contains('on')) renderChiphi();
    if(document.getElementById('v-dash').classList.contains('on')) renderDash();
    if(bgVis()) drawBaogia();
  }).catch(function(e){ toast('Lỗi sửa: '+e.message); });
}

/* ===== KÉO DI CHUYỂN DÒNG + KÉO CHỈNH CAO DÒNG ===== */
function initTableInteractions(){
  var tk=document.getElementById('tkTable'); if(!tk || tk._init) return; tk._init=1;
  function clr(){ tk.querySelectorAll('.dropTop,.dropBot,.dropInto,.dropL,.dropR').forEach(function(x){ x.classList.remove('dropTop','dropBot','dropInto','dropL','dropR'); }); }
  tk.addEventListener('dragstart',function(e){
    var th=e.target.closest('th.thk');
    if(th){ if(e.target.closest('.thrsz')){ e.preventDefault(); return; } S._dragCol=th.dataset.k; S._drag=S._dragGrp=null; th.classList.add('dragging'); try{e.dataTransfer.setData('text/plain',th.dataset.k);}catch(x){} return; }
    var grp=e.target.closest('tr.grp');
    if(grp){ if(e.target.closest('button,.gcol,.gname,.gsel,input')){ e.preventDefault(); return; } S._dragGrp=grp.dataset.g; S._drag=S._dragCol=null; grp.classList.add('dragging'); try{e.dataTransfer.setData('text/plain',grp.dataset.g);}catch(x){} return; }
    if(e.target.closest('input,button,textarea,.rgrip')){ e.preventDefault(); return; }
    var tr=e.target.closest('tr.drow'); if(!tr){ e.preventDefault(); return; }
    S._drag=tr.dataset.id; S._dragCol=S._dragGrp=null; tr.classList.add('dragging'); try{ e.dataTransfer.setData('text/plain',tr.dataset.id); }catch(x){}
  });
  tk.addEventListener('dragend',function(){ tk.querySelectorAll('.dragging').forEach(function(x){x.classList.remove('dragging');}); clr(); S._drag=S._dragCol=S._dragGrp=null; });
  tk.addEventListener('dragover',function(e){
    clr();
    if(S._dragProd){ e.preventDefault(); e.dataTransfer.dropEffect='copy'; var gp=e.target.closest('tr.grp'); if(gp) gp.classList.add('prodDrop'); else { var rw=e.target.closest('tr.drow'); if(rw) rw.classList.add('dropBot'); } return; }
    if(S._dragCol){ var th=e.target.closest('th.thk'); if(th){ e.preventDefault(); var r=th.getBoundingClientRect(); th.classList.add(e.clientX<r.left+r.width/2?'dropL':'dropR'); } return; }
    if(S._dragGrp){ var gg=e.target.closest('tr.grp'); if(gg){ e.preventDefault(); gg.classList.add('dropInto'); } return; }
    if(!S._drag) return; e.preventDefault();
    var tr=e.target.closest('tr'); if(!tr) return;
    if(tr.classList.contains('grp')){ tr.classList.add('dropInto'); return; }
    if(!tr.classList.contains('drow')) return;
    var rr=tr.getBoundingClientRect(); tr.classList.add((e.clientY<rr.top+rr.height/2)?'dropTop':'dropBot');
  });
  tk.addEventListener('drop',function(e){
    e.preventDefault();
    if(S._dragProd){ var p=S._dragProd; S._dragProd=null; clr();
      var gp=e.target.closest('tr.grp'), rw=e.target.closest('tr.drow');
      var floor = gp?gp.dataset.g : (rw?(rw.dataset.tang||''):(S.selFloor||''));
      if(floor==='CHƯA PHÂN TẦNG') floor='';
      if(floor) S.selFloor=floor;
      var slDrop=S._dragSL||1; S._dragSL=1;
      addProdObj(p, floor, slDrop); return; }
    if(S._dragCol){ var th=e.target.closest('th.thk'); if(th && th.dataset.k!==S._dragCol){ var r=th.getBoundingClientRect(); moveCol(S._dragCol,th.dataset.k,e.clientX<r.left+r.width/2); } S._dragCol=null; clr(); return; }
    if(S._dragGrp){ var gg=e.target.closest('tr.grp'); if(gg && gg.dataset.g!==S._dragGrp){ moveFloor(S._dragGrp,gg.dataset.g); } S._dragGrp=null; clr(); return; }
    if(!S._drag){ clr(); return; }
    var tr=e.target.closest('tr'); if(!tr){ clr(); return; }
    var before=true; if(tr.classList.contains('drow')){ var rr=tr.getBoundingClientRect(); before=(e.clientY<rr.top+rr.height/2); }
    var id=S._drag; S._drag=null; clr(); onRowDrop(id,tr,before);
  });
  document.addEventListener('mousedown',function(e){
    var rs=e.target.closest('.thrsz');
    if(rs){ e.preventDefault(); e.stopPropagation(); var k=rs.dataset.k, sx=e.clientX, sw=colW(k);
      function cmv(ev){ var w=Math.max(50, sw+(ev.clientX-sx)); S.colW[k]=w; renderWidths(); cpflatColW_(k,w); }
      function cup(){ document.removeEventListener('mousemove',cmv); document.removeEventListener('mouseup',cup); saveCols();
        if(document.getElementById('v-duan').classList.contains('on')) renderDuAn();
        if(document.getElementById('v-chiphi').classList.contains('on')) renderChiphi(); }
      document.addEventListener('mousemove',cmv); document.addEventListener('mouseup',cup); return; }
    var g=e.target.closest('.rgrip'); if(!g) return; e.preventDefault();
    var tr=g.closest('tr'), id=g.dataset.id, sy=e.clientY, sh=tr.offsetHeight;
    function mv(ev){ var h=Math.max(34, sh+(ev.clientY-sy)); tr.style.height=h+'px'; S.rowH[id]=h; }
    function up(){ document.removeEventListener('mousemove',mv); document.removeEventListener('mouseup',up); try{ localStorage.setItem('qs_rowh',JSON.stringify(S.rowH)); }catch(x){} }
    document.addEventListener('mousemove',mv); document.addEventListener('mouseup',up);
  });
}
function renderWidths(){ var t=document.getElementById('tkTable'); var cols=visCols(), ce=t.querySelectorAll('colgroup col'), total=0;
  cols.forEach(function(c,i){ var w=colW(c[0]); if(ce[i]) ce[i].style.width=w+'px'; total+=w; }); t.style.width=(total+44)+'px'; }
function moveCol(from,to,before){ var o=S.colOrder.slice(), fi=o.indexOf(from); if(fi<0)return; o.splice(fi,1); var ti=o.indexOf(to); if(ti<0)ti=o.length; o.splice(before?ti:ti+1,0,from); S.colOrder=o; saveCols(); renderTable(); }
async function moveFloor(from,to){
  var fl=floorsList().filter(function(t){return t!=='CHƯA PHÂN TẦNG';}); var fi=fl.indexOf(from), ti=fl.indexOf(to); if(fi<0||ti<0)return;
  fl.splice(fi,1); ti=fl.indexOf(to); fl.splice(ti,0,from);
  try{ var p=await api('updateProject',S.cur.maDA,{tangTuTao:fl.join('|')}); syncProj(p); renderFloors(); renderTable(); toast('Đã đổi thứ tự tầng'); }catch(e){ toast('Lỗi: '+e.message); }
}
/* thu gọn / đổi tên tầng */
function toggleFloor(g){ S.collapsed[g]=!S.collapsed[g]; renderTable(); }
async function renameFloor(g){
  if(g==='CHƯA PHÂN TẦNG')return;
  var name=await askInput_({title:'Đổi tên tầng', label:'Tên tầng', value:g, confirmText:'Lưu'});
  if(name==null)return; name=String(name).trim(); if(!name||name===g)return;
  var fl=floorsList().filter(function(t){return t!=='CHƯA PHÂN TẦNG';}).map(function(t){return t===g?name:t;});
  try{ var p=await api('updateProject',S.cur.maDA,{tangTuTao:fl.join('|')}); syncProj(p);
    var aff=S.lines.filter(function(l){return (l.tang||'')===g;});
    await Promise.all(aff.map(function(l){ return api('updateLine',l.lineId,{tang:name}); }));
    S.lines=await api('getLines',S.cur.maDA)||[]; renderFloors(); renderTable(); toast('Đã đổi tên tầng'); }
  catch(e){ toast('Lỗi: '+e.message); }
}
/* lọc cột (AutoFilter) */
function openFilter(e,key){
  e.stopPropagation(); closePop();
  var lines=S.lines.filter(function(l){ return l.nhom===S.node || String(l.nhom||'').indexOf(S.node+'.')===0; });
  var lbl=(COLS.filter(function(c){return c[0]===key;})[0]||[key,key])[1];
  var vals={}, meta={};
  lines.forEach(function(l){ var v=colPlain(l,key); if(v!==''){ vals[v]=(vals[v]||0)+1; if(!meta[v]) meta[v]={img:l.hinhAnh,price:l.donGiaBan}; } });
  var keys=Object.keys(vals).sort();
  var rich=(key==='ten');   // cột Tên: hiện ảnh + tên + giá như bản cũ
  var w = rich?400:250;
  var items=keys.map(function(v){
    var on=S.colFilter[key]===v;
    if(rich){ var m=meta[v]||{};
      return '<div class="fi frow'+(on?' on':'')+'" data-t="'+esc(v.toLowerCase())+'" data-v="'+esc(v)+'" onclick="setFilter(\''+key+'\',this.dataset.v)">'
        +(m.img?'<img src="'+esc(imgSrc1_(m.img))+'" onerror="this.style.visibility=\'hidden\'">':'<span class="noimg"></span>')
        +'<span class="fnm">'+esc(v)+'</span><span class="fpr">'+money(m.price)+'</span></div>';
    }
    return '<div class="fi'+(on?' on':'')+'" data-t="'+esc(v.toLowerCase())+'" data-v="'+esc(v)+'" onclick="setFilter(\''+key+'\',this.dataset.v)">'+esc(v)+' <span style="color:#98a6b3">('+vals[v]+')</span></div>';
  }).join('');
  var pop=document.createElement('div'); pop.className='fltpop'; pop.id='qs_pop'; pop.style.width=w+'px';
  pop.innerHTML='<div class="fhdr">'+esc(lbl)+'</div>'
    +'<div class="fpa" onclick="colSort(\''+key+'\',\'asc\')">▲ Sắp xếp tăng dần</div>'
    +'<div class="fpa" onclick="colSort(\''+key+'\',\'desc\')">▼ Sắp xếp giảm dần</div>'
    +(S.sortKey===key?'<div class="fpa" onclick="resetSort();closePop()">✕ Bỏ sắp xếp</div>':'')
    +'<div class="fpa" onclick="colFreezeTo(\''+key+'\')">❄ Cố định đến cột này</div>'
    +((S.freezeN||0)>0?'<div class="fpa" onclick="colUnfreeze()">✕ Bỏ cố định cột</div>':'')
    +'<div class="fpsep"></div><div class="fhdr sm">Lọc giá trị</div>'
    +'<input class="fsearch" placeholder="Tìm giá trị…" oninput="filterPop(this.value)">'
    +'<div id="fpItems"><div class="fi all" onclick="setFilter(\''+key+'\',null)">— Tất cả ('+lines.length+') —</div>'+items+'</div>';
  document.body.appendChild(pop);
  var r=e.target.getBoundingClientRect(); pop.style.left=Math.max(8,Math.min(r.left, window.innerWidth-w-12))+'px'; pop.style.top=(r.bottom+4)+'px';
  setTimeout(function(){ document.addEventListener('mousedown',popOutside); var s=pop.querySelector('.fsearch'); if(s)s.focus(); },0);
}
function filterPop(q){ q=(q||'').toLowerCase().trim(); document.querySelectorAll('#fpItems .fi').forEach(function(el){ if(el.classList.contains('all')) return; el.style.display=(!q||(el.dataset.t||'').indexOf(q)>=0)?'':'none'; }); }
function popOutside(e){ if(!e.target.closest('#qs_pop')) closePop(); }
function closePop(){ var p=document.getElementById('qs_pop'); if(p)p.remove(); document.removeEventListener('mousedown',popOutside);
  setMselIcon('fDemuc',false); setMselIcon('fNhom',false); }
function setFilter(key,v){ if(v==null||v==='__all__') delete S.colFilter[key]; else S.colFilter[key]=v; closePop(); renderTable(); }
/* popup chọn sản phẩm cho cột Tên */
function openPick(lineId,e){
  if(e)e.stopPropagation(); closePop();
  var pop=document.createElement('div'); pop.className='fltpop'; pop.id='qs_pop'; pop.style.width='380px'; pop.style.maxHeight='440px';
  pop.innerHTML='<input class="cin" id="pickq" placeholder="Tìm sản phẩm…" style="width:100%;border:1px solid var(--line);padding:8px;margin-bottom:6px">'
    +'<div class="pick-new" onclick="openCreateProduct(\''+lineId+'\')">＋ Tạo sản phẩm mới</div>'
    +'<div id="picklist"></div>';
  document.body.appendChild(pop);
  var an=(e&&e.target)?e.target.getBoundingClientRect():{left:200,bottom:200}; pop.style.left=Math.max(8,Math.min(an.left, window.innerWidth-390))+'px'; pop.style.top=(an.bottom+4)+'px';
  var q=document.getElementById('pickq'); q.oninput=function(){ drawPick(lineId,q.value); }; drawPick(lineId,''); q.focus();
  setTimeout(function(){ document.addEventListener('mousedown',popOutside); },0);
}
function drawPick(lineId,q){
  q=(q||'').toLowerCase();
  var list=S.products.filter(function(p){ return !q || (p.ten+' '+p.ma+' '+p.thuongHieu).toLowerCase().indexOf(q)>=0; }).slice(0,60);
  document.getElementById('picklist').innerHTML=list.map(function(p){
    return '<div class="fi" onclick="pickProduct(\''+lineId+'\','+S.products.indexOf(p)+')"><b>'+esc(p.ten)+'</b><div style="font-size:12px;color:#889">'+esc(p.thuongHieu||'')+' · '+money(p.donGiaBan)+'</div></div>';
  }).join('')||'<div class="fi">Không có SP khớp.</div>';
}
/* kéo sản phẩm từ danh mục thả vào tầng */
function prodDragStart(e,i){
  var p=(S._filtered||[])[i]; if(!p){ e.preventDefault(); return; }
  return prodDragObj_(e,p);
}
// Kéo BẤT KỲ sản phẩm nào (thẻ danh mục, thẻ con của combo, dòng "Sản phẩm đi kèm" ở panel chi tiết)
function prodDragObj_(e,p,sl){
  if(!p){ if(e&&e.preventDefault) e.preventDefault(); return; }
  S._dragProd=p; S._dragSL=Math.max(1, Math.round(Number(sl)||1));
  try{
    e.dataTransfer.effectAllowed='copy'; e.dataTransfer.setData('text/plain',p.ten||'');
    var img=p.hinhAnh?'<img src="'+esc(imgSrc1_(p.hinhAnh))+'" onerror="this.style.visibility=\'hidden\'">':'<span class="dg-img"></span>';
    var g=document.createElement('div'); g.className='drag-ghost';
    g.innerHTML=img+'<span class="dg-b"><span class="dg-nm">'+esc(p.ten||'')+'</span><span class="dg-pr">'
        +(S._dragSL>1?(S._dragSL+' × '):'')+money(p.donGiaBan)+' đ</span></span>'
      +'<span class="dg-add">'+icon('plus',14)+'Thả vào bảng</span>';
    document.body.appendChild(g); S._dragGhost=g;
    e.dataTransfer.setDragImage(g, 24, 28);
  }catch(x){}
  var c=e.target.closest('.citem'); if(c)c.classList.add('dragging');
}
function prodDragEnd(){
  S._dragProd=null; S._dragSL=1;
  if(S._dragGhost){ S._dragGhost.remove(); S._dragGhost=null; }
  document.querySelectorAll('.citem.dragging').forEach(function(x){x.classList.remove('dragging');});
  var tk=document.getElementById('tkTable'); if(tk) tk.querySelectorAll('.prodDrop,.dropBot').forEach(function(x){x.classList.remove('prodDrop','dropBot');});
}
async function pickProduct(lineId,pi){
  var p=S.products[pi]; if(!p)return; closePop();
  await editLine(lineId,{ten:p.ten,thuongHieu:p.thuongHieu,ncc:p.ncc,maSP:p.ma,kichThuoc:p.kichThuoc,moTa:p.moTa,dvt:p.dvt||'Cái',donGiaVon:p.donGiaVon,donGiaBan:p.donGiaBan,hinhAnh:p.hinhAnh,loai:p.hangMuc});
  toast('Đã chọn: '+p.ten);
}
/* ＋ Tạo sản phẩm mới: nhập tay -> lưu vào Danh mục SP + điền ngược vào dòng bóc tách */
function openCreateProduct(lineId){
  closePop();
  var l=(S.lines||[]).find(function(x){return x.lineId===lineId;})||{};
  var nhoms=Object.keys(nhomOptions()).sort();
  var dl='<datalist id="cpNhomList">'+nhoms.map(function(n){return '<option value="'+esc(n)+'">';}).join('')+'</datalist>';
  var pop=document.createElement('div'); pop.className='fltpop'; pop.id='qs_pop';
  pop.style.width='440px'; pop.style.maxHeight='90vh'; pop.style.overflow='auto'; pop.style.padding='14px';
  function row(label,inner){ return '<label style="display:block;margin-bottom:8px"><span style="display:block;font-size:11px;color:var(--muted);margin-bottom:3px">'+label+'</span>'+inner+'</label>'; }
  function inp(id,val,ph,extra){ return '<input id="'+id+'" class="cin" style="width:100%;border:1px solid var(--line);padding:7px 9px;border-radius:7px" value="'+esc(val||'')+'" placeholder="'+esc(ph||'')+'"'+(extra||'')+'>'; }
  pop.innerHTML='<div style="font-weight:800;font-size:14px;margin-bottom:10px">＋ Tạo sản phẩm mới vào danh mục</div>'
    +dl
    +row('Tên sản phẩm *', inp('cp_ten', l.ten, 'Tên sản phẩm…'))
    +'<div style="display:flex;gap:8px">'
      +'<div style="flex:1">'+row('Nhóm *', inp('cp_nhom', '', 'VD: Đèn rọi', ' list="cpNhomList"'))+'</div>'
      +'<div style="flex:1">'+row('Hạng mục', inp('cp_hm', '', 'VD: Đèn chiếu sáng'))+'</div>'
    +'</div>'
    +'<div style="display:flex;gap:8px">'
      +'<div style="flex:1">'+row('Thương hiệu', inp('cp_th', l.thuongHieu, ''))+'</div>'
      +'<div style="flex:1">'+row('Nhà cung cấp', inp('cp_ncc', l.ncc, ''))+'</div>'
    +'</div>'
    +'<div style="display:flex;gap:8px">'
      +'<div style="flex:1">'+row('Mã SP', inp('cp_ma', l.maSP, ''))+'</div>'
      +'<div style="flex:1">'+row('Kích thước', inp('cp_kt', l.kichThuoc, ''))+'</div>'
    +'</div>'
    +'<div style="display:flex;gap:8px">'
      +'<div style="width:90px">'+row('ĐVT', inp('cp_dvt', l.dvt||'Cái', ''))+'</div>'
      +'<div style="flex:1">'+row('Đơn giá', inp('cp_gia', (Number(l.donGiaBan)||0), '', ' type="number"'))+'</div>'
    +'</div>'
    +row('Mô tả', '<textarea id="cp_mota" class="cin" style="width:100%;border:1px solid var(--line);padding:7px 9px;border-radius:7px;min-height:56px">'+esc(l.moTa||'')+'</textarea>')
    +row('Link ảnh (URL)', inp('cp_img', (String(l.hinhAnh||'').indexOf('http')===0?l.hinhAnh:''), 'https://…'))
    +'<div style="display:flex;gap:8px;justify-content:flex-end;margin-top:6px">'
      +'<button class="btn ghost sm" onclick="closePop()">Huỷ</button>'
      +'<button class="btn blue sm" id="cpSave" onclick="submitCreateProduct(\''+lineId+'\')">'+icon('check',15)+' Lưu vào danh mục</button>'
    +'</div>';
  document.body.appendChild(pop);
  pop.style.left=Math.max(8,(window.innerWidth-440)/2)+'px'; pop.style.top=Math.max(8,(window.innerHeight-pop.offsetHeight)/2)+'px';
  setTimeout(function(){ document.addEventListener('mousedown',popOutside); var i=document.getElementById('cp_ten'); if(i)i.focus(); },0);
}
async function submitCreateProduct(lineId){
  function g(id){ var e=document.getElementById(id); return e?String(e.value||'').trim():''; }
  var ten=g('cp_ten'); if(!ten){ toast('Chưa có Tên sản phẩm'); return; }
  var nhom=g('cp_nhom'); if(!nhom){ toast('Chọn/nhập Nhóm — nhóm để lọc trong danh mục'); return; }
  var gia=Number(g('cp_gia'))||0;
  var payload={ nhom:nhom, hangMuc:g('cp_hm'), ten:ten, thuongHieu:g('cp_th'), ncc:g('cp_ncc'),
    ma:g('cp_ma'), moTa:g('cp_mota'), kichThuoc:g('cp_kt'), dvt:g('cp_dvt')||'Cái', gia:gia, hinhAnh:g('cp_img') };
  var btn=document.getElementById('cpSave'); if(btn){ btn.disabled=true; btn.textContent='⏳ Đang lưu…'; }
  try{
    var p=await api('saveLineAsProduct', payload);
    if(p) S.products.push(p);
    await editLine(lineId,{ ten:ten, thuongHieu:payload.thuongHieu, ncc:payload.ncc, maSP:payload.ma,
      moTa:payload.moTa, kichThuoc:payload.kichThuoc, dvt:payload.dvt,
      donGiaVon:gia, donGiaBan:gia, hinhAnh:payload.hinhAnh });
    toast('Đã lưu "'+ten+'" vào danh mục và điền vào dòng');
    closePop(); renderFilters(); renderCatalog();
  }catch(e){
    var msg=String((e&&e.message)||'');
    if(msg.indexOf('đã có sẵn')>=0){ toast('Sản phẩm này đã có trong danh mục'); closePop(); }
    else { toast('Lỗi: '+msg); if(btn){ btn.disabled=false; btn.innerHTML=icon('check',15)+' Lưu vào danh mục'; } }
  }
}
async function onRowDrop(dragId,targetTr,before){
  var di=S.lines.findIndex(function(l){return l.lineId===dragId;}); if(di<0) return;
  var dragged=S.lines[di], floor, targetId=null;
  if(targetTr.classList.contains('grp')){ floor=targetTr.querySelector('td').dataset.f; }
  else { floor=targetTr.dataset.tang||''; targetId=targetTr.dataset.id; }
  if(floor==='CHƯA PHÂN TẦNG') floor='';
  if(targetId===dragId) return;
  var oldTang=dragged.tang||'';
  S.lines.splice(di,1); dragged.tang=floor;
  var idx;
  if(targetId){ var ti=S.lines.findIndex(function(l){return l.lineId===targetId;}); idx=ti<0?S.lines.length:(before?ti:ti+1); }
  else { var last=-1; S.lines.forEach(function(l,i){ if((l.tang||'')===floor) last=i; }); idx=last>=0?last+1:S.lines.length; }
  S.lines.splice(idx,0,dragged);
  var changed=[];
  S.lines.forEach(function(l,i){ if(l.stt!==i+1){ l.stt=i+1; if(changed.indexOf(l)<0) changed.push(l); } });
  if(dragged.tang!==oldTang && changed.indexOf(dragged)<0) changed.push(dragged);
  renderFloors(); renderTable();
  try{ await Promise.all(changed.map(function(l){ return api('updateLine', l.lineId, {stt:l.stt, tang:l.tang}); })); }
  catch(e){ toast('Lỗi lưu thứ tự: '+(e.message||e)); }
}
async function delLine(id){
  try{ await api('deleteLine',id); S.lines=S.lines.filter(function(l){return l.lineId!==id;}); renderTree(); renderFloors(); renderTable(); if(bgVis())drawBaogia(); toast('Đã xoá'); }
  catch(e){ toast('Lỗi xoá: '+e.message); }
}
// Nút xoá đặt NGOÀI bảng (gutter bên phải), đồng bộ vị trí theo cuộn dọc/ngang
function renderActGutter(){
  var inner=document.getElementById('actGutterInner'); if(!inner) return;
  var rows=document.querySelectorAll('#tkTable tr.drow');
  inner.innerHTML=[].map.call(rows,function(tr){ var id=tr.getAttribute('data-id');
    return '<button class="agx" data-id="'+id+'" title="Xoá hạng mục này" onclick="delLine(\''+id+'\')"></button>'; }).join('');
  if(!S._agBound){ var wrap=document.querySelector('#tkNormal .tbl-wrap'); if(wrap){ wrap.addEventListener('scroll',syncActGutter,{passive:true}); window.addEventListener('resize',syncActGutter); S._agBound=1; } }
  bindActGutterHover_();
  syncActGutter();
  tkHBarInit_(); tkHBarSync_();
}
// ✕ chỉ hiện ở DÒNG đang rê chuột (nút nằm ngoài bảng nên phải gắn bằng JS)
function bindActGutterHover_(){
  if(S._agHoverBound) return; S._agHoverBound=1;
  function clear(){ document.querySelectorAll('#actGutterInner .agx.on').forEach(function(b){ b.classList.remove('on'); }); }
  function markByRow(tr){
    clear(); if(!tr) return;
    var rows=[].slice.call(document.querySelectorAll('#tkTable tr.drow'));
    var i=rows.indexOf(tr); if(i<0) return;
    var b=document.querySelectorAll('#actGutterInner .agx')[i];
    if(b && b.style.display!=='none') b.classList.add('on');
  }
  var norm=document.getElementById('tkNormal'); if(!norm) return;
  norm.addEventListener('mouseover',function(e){
    var t=e.target;
    if(t.closest && t.closest('.agx')){ t.closest('.agx').classList.add('on'); return; }  // giữ hiện khi rê vào chính nút
    markByRow(t.closest?t.closest('#tkTable tr.drow'):null);
  });
  norm.addEventListener('mouseleave',clear);
}
/* ═══ THANH KÉO NGANG TỰ DỰNG (dùng chung cho bảng Bóc tách và Danh sách SP) ═══
   Toàn bộ scrollbar gốc bị ẩn theo thiết kế, nên bảng nào kéo ngang được cũng
   phải có thanh riêng — nếu không người dùng không biết là còn cột bên phải.
   Thanh mảnh, bo tròn, tự ẩn khi bảng không tràn.                              */
function hbarSync_(sel, barId, thId){
  var wrap=document.querySelector(sel), bar=document.getElementById(barId), th=document.getElementById(thId);
  if(!wrap||!bar||!th) return;
  var sw=wrap.scrollWidth, cw=wrap.clientWidth;
  if(sw<=cw+1){ bar.style.display='none'; return; }      // vừa khít -> không cần thanh
  bar.style.display='';
  var bw=bar.clientWidth;
  var tw=Math.max(48, Math.round(bw*cw/sw));
  var maxLeft=bw-tw, maxScroll=sw-cw;
  th.style.width=tw+'px';
  th.style.left=Math.round(maxScroll?(wrap.scrollLeft/maxScroll)*maxLeft:0)+'px';
}
function hbarBind_(sel, barId, thId){
  var wrap=document.querySelector(sel), bar=document.getElementById(barId), th=document.getElementById(thId);
  if(!wrap||!bar||!th) return;
  var sync=function(){ hbarSync_(sel,barId,thId); };
  // Gắn theo TỪNG PHẦN TỬ, không dùng cờ toàn cục: bảng Danh sách SP dựng lại
  // innerHTML mỗi lần vào tab -> cờ toàn cục làm listener kẹt ở phần tử cũ đã bị gỡ.
  if(wrap.dataset.hb!=='1'){ wrap.dataset.hb='1'; wrap.addEventListener('scroll',sync,{passive:true}); }
  if(!S._hbarResize){ S._hbarResize={}; }
  if(!S._hbarResize[barId]){                       // 1 listener resize cho mỗi thanh, tra phần tử lúc chạy
    S._hbarResize[barId]=1;
    window.addEventListener('resize',function(){ hbarSync_(sel,barId,thId); });
  }
  if(th.dataset.hb!=='1'){
    th.dataset.hb='1';
    th.addEventListener('mousedown',function(e){                 // kéo thumb
      e.preventDefault(); e.stopPropagation();
      var sx=e.clientX, sl=wrap.scrollLeft;
      var bw=bar.clientWidth, tw=th.offsetWidth, maxLeft=bw-tw, maxScroll=wrap.scrollWidth-wrap.clientWidth;
      th.classList.add('dragging'); document.body.style.cursor='grabbing';
      function mv(ev){ var d=ev.clientX-sx; wrap.scrollLeft = sl + (maxLeft? d*maxScroll/maxLeft : 0); sync(); }
      function up(){ document.removeEventListener('mousemove',mv); document.removeEventListener('mouseup',up);
        th.classList.remove('dragging'); document.body.style.cursor=''; }
      document.addEventListener('mousemove',mv); document.addEventListener('mouseup',up);
    });
  }
  if(bar.dataset.hb!=='1'){
    bar.dataset.hb='1';
    bar.addEventListener('mousedown',function(e){                // bấm vào rãnh -> nhảy tới
      if(e.target===th) return;
      var r=bar.getBoundingClientRect(), tw=th.offsetWidth;
      var pos=Math.min(Math.max(0,e.clientX-r.left-tw/2), r.width-tw);
      var maxScroll=wrap.scrollWidth-wrap.clientWidth, maxLeft=r.width-tw;
      wrap.scrollLeft = maxLeft? pos*maxScroll/maxLeft : 0; sync();
    });
  }
  sync();
}
function tkHBarSync_(){ hbarSync_('#tkNormal .tbl-wrap','tkHBar','tkHThumb'); }
function tkHBarInit_(){ hbarBind_('#tkNormal .tbl-wrap','tkHBar','tkHThumb'); tkVBarInit_&&tkVBarInit_(); }
function spHBarSync_(){ hbarSync_('.sp-card .tbl-wrap','spHBar','spHThumb'); }
function spHBarInit_(){ hbarBind_('.sp-card .tbl-wrap','spHBar','spHThumb'); }
function syncActGutter(){
  tkHBarSync_();   // đồng bộ luôn thanh kéo ngang (hàm này đã chạy mỗi khi cuộn bảng)
  tkVBarSync_&&tkVBarSync_();
  var norm=document.getElementById('tkNormal'), g=document.getElementById('actGutter'); if(!norm||!g) return;
  var wrap=norm.querySelector('.tbl-wrap'), t=document.getElementById('tkTable'); if(!wrap||!t) return;
  var nb=norm.getBoundingClientRect(), wr=wrap.getBoundingClientRect();
  var headH=(document.querySelector('#tkTable tr:first-child th')||{}).offsetHeight||46;
  // Thanh cuộn dọc là OVERLAY (không chiếm chỗ) -> nút bám sát mép nội dung/bảng, không hở, không đè.
  var edge = Math.min(t.getBoundingClientRect().right, wr.left + wrap.clientWidth);
  var hsb = wrap.offsetHeight - wrap.clientHeight;   // chiều cao thanh cuộn ngang (đáy)
  g.style.left=(edge - nb.left + 2)+'px'; g.style.right='auto';
  // gutter bắt đầu DƯỚI header dính, kết thúc TRÊN thanh cuộn ngang -> overflow:hidden che phần thừa
  g.style.top=(wr.top - nb.top + headH)+'px'; g.style.height=Math.max(0, wr.height - headH - hsb)+'px';
  var rows=document.querySelectorAll('#tkTable tr.drow');
  var btns=document.querySelectorAll('#actGutterInner .agx');
  btns.forEach(function(b,i){ var tr=rows[i]; if(!tr){ b.style.display='none'; return; }
    var r=tr.getBoundingClientRect(), mid=r.top + r.height/2;
    var vis = mid > wr.top+headH+1 && mid < wr.bottom-hsb-1;   // chỉ hiện khi TÂM dòng trong vùng nhìn thấy
    b.style.top=(mid - (wr.top+headH) - (b.offsetHeight/2||12))+'px';
    b.style.display=vis?'':'none';
  });
}

/* ===== THÔNG TIN DỰ ÁN ===== */
function syncProj(p){ if(!p)return; S.cur=p; var i=S.projects.findIndex(function(x){return x.maDA===p.maDA;}); if(i>=0)S.projects[i]=p; renderProjSel(); }
function pf_(label,id,val,type){ return '<div class="field"><label>'+esc(label)+'</label><input id="'+id+'" type="'+(type||'text')+'" value="'+esc(val==null?'':val)+'"></div>'; }
// Nhóm bản nháp của dự án đang mở
function currentGroup(){
  if(!S.cur) return null;
  var key=String(S.cur.ten||'').trim().toLowerCase();
  var drafts=(S.projects||[]).filter(function(p){ return String(p.ten||'').trim().toLowerCase()===key; })
    .sort(function(a,b){ return String(a.ngayTao||'').localeCompare(String(b.ngayTao||'')); });
  return {name:S.cur.ten, drafts:drafts, idx:drafts.findIndex(function(d){return d.maDA===S.cur.maDA;})};
}
// tên bản nháp: dùng tên tuỳ chỉnh nếu có, ngược lại "Bản nháp N"
function draftName_(d,i){ return String(d.tenBanNhap||'').trim() || ('Bản nháp '+(i+1)); }
// Nội dung form thông tin dự án (dùng cho cả popup)
function projInfoInner_(p, gr){
  var tabs=gr.drafts.map(function(d,i){ var on=d.maDA===p.maDA;
    return '<button class="draft-tab'+(on?' on':'')+'" onclick="openDraft(\''+esc(d.maDA)+'\')">'+icon('doc',12)+' '+esc(draftName_(d,i))+'</button>'; }).join('');
  var switcher='<div class="proj-switch2">'
    +'<div class="ps2-l"><span class="ps2-ic">'+icon('building',20)+'</span>'
      +'<div><div class="ps2-name">'+esc(gr.name)+'</div><div class="ps2-sub">'+esc(p.khachHang||'Chưa có khách hàng')+(p.sdt?' · '+esc(p.sdt):'')+' · '+gr.drafts.length+' bản nháp</div></div></div>'
    +'<div class="ps2-tabs">'+tabs+'<button class="draft-tab add" onclick="addDraftForCur()">'+icon('plus',13)+' Thêm bản nháp</button></div></div>';
  var shared=dbCard_('Thông tin dự án','building','Áp dụng cho tất cả bản nháp của dự án này.',
    '<div class="dbgrid">'+pf_('Tên dự án','pf_ten',p.ten)+pf_('Khách hàng','pf_kh',p.khachHang)+pf_('Số điện thoại','pf_sdt',p.sdt)
    +pf_('Địa chỉ','pf_addr',p.diaChi)
    // Link bài dự án trên dezon.vn — dán link, bấm biểu tượng để mở
    +'<div class="field pf-link"><label>Link dự án trên Dezon</label><div class="pf-link-row">'
      +'<input id="pf_link" type="url" placeholder="https://dezon.vn/…" value="'+esc(p.linkDezon||'')+'">'
      +(p.linkDezon?'<a class="btn ghost sm" href="'+esc(dezonUrl_(p.linkDezon))+'" target="_blank" rel="noopener" title="Mở bài dự án trên dezon.vn">'+icon('link',14)+' Mở</a>':'')
    +'</div></div>'
    +'</div>'
    +'<div class="pf-save"><button class="btn blue" onclick="saveProjectShared(this)">'+icon('check',15)+' Lưu thông tin dự án</button></div>');
  var draftInner='<div class="dbgrid">'
    +pf_('Tên bản nháp','pf_tbn',p.tenBanNhap)
    +'<div class="field"><label>Trạng thái</label><select id="pf_tt">'+['Bản nháp','Đang thực hiện','Hoàn thành'].map(function(s){return '<option'+(p.trangThai===s?' selected':'')+'>'+s+'</option>';}).join('')+'</select></div>'
    +pf_('VAT (%)','pf_vat',p.vat,'number')+pf_('Mã báo giá','pf_mbg',p.maBaoGia)
    +pf_('Quy mô','pf_qm',p.quyMo)+pf_('Tổng DT XD (m²)','pf_tdt',p.tongDT)+pf_('DT báo giá (m²)','pf_dtbg',p.dtBaoGia)
    +pf_('Nhu cầu','pf_nc',p.nhuCau)+pf_('Phân khúc','pf_pk',p.phanKhuc)+'</div>'
    +'<div class="field" style="margin-top:2px"><label>Ghi chú</label><textarea id="pf_gc" placeholder="Ghi chú cho bản nháp này" style="min-height:56px">'+esc(p.ghiChu||'')+'</textarea></div>'
    +'<div class="pf-prog"><label>Tiến độ</label>'
    +'<input id="pf_prog" type="range" min="0" max="100" value="'+(Number(p.tienDo)||0)+'" oninput="document.getElementById(\'pf_pv\').textContent=this.value+\'%\'">'
    +'<b id="pf_pv">'+(Number(p.tienDo)||0)+'%</b><button class="btn ghost sm" onclick="saveProgress(this)">Cập nhật</button></div>'
    +'<div class="pf-save"><button class="btn blue" onclick="saveDraftInfo(this)">'+icon('check',15)+' Lưu bản nháp</button></div>';
  var draft='<div class="dbcard"><div class="dbcard-h"><span class="dbcard-ic">'+icon('doc',18)+'</span><h3>Thông tin bản nháp — '+esc(draftName_(p,gr.idx))+'</h3>'
    +'<span class="ps2-badge">'+esc(p.maDA)+'</span><span class="sp" style="flex:1"></span>'
    +(gr.drafts.length>1?'<button class="btn ghost sm" onclick="removeProject(\''+esc(p.maDA)+'\')">'+icon('trash',13)+' Xoá bản nháp</button>':'')+'</div>'
    +'<div class="dbcard-b">'+draftInner+'</div></div>';
  return switcher+shared+draft;
}
function renderProjects(){
  var el=document.getElementById('v-project'); if(!el) return;
  var head='<div class="sechd"><h2>Thông tin dự án</h2><span class="sp" style="flex:1"></span>'
    +(S.cur?hmSelect_('pjHmBtn'):'')
    +'<button class="btn ghost sm" onclick="showTab(\'dash\')">'+icon('list',14)+' Danh sách dự án</button></div>';
  if(!S.cur){ el.innerHTML=head+'<div class="dash-empty">'+icon('building',40)+'<h3>Chưa chọn dự án</h3><p>Vào <b>Bảng điều khiển</b> để tạo hoặc chọn một bản nháp.</p></div>'; return; }
  el.innerHTML=head+projInfoInner_(S.cur, currentGroup());
}
// ===== Popup Thông tin dự án (mở từ Bảng điều khiển) =====
async function projInfoModal(maDA){
  var p=(S.projects||[]).filter(function(x){return x.maDA===maDA;})[0]; if(!p) return;
  S.cur=p; S._coverDA=null;
  try{ S.lines=await api('getLines',maDA)||[]; }catch(e){}
  renderCard&&renderCard(); renderProjSel&&renderProjSel(); renderDash&&renderDash();
  var ov=document.getElementById('projModalOv');
  if(!ov){ ov=document.createElement('div'); ov.className='sp-modal-ov'; ov.id='projModalOv';
    ov.onclick=function(e){ if(e.target===ov) projModalClose(); }; document.body.appendChild(ov); }
  ov.innerHTML='<div class="sp-modal proj-modal pd"><div class="pd-head"><h3>'+icon('building',16)+' Thông tin dự án</h3><button class="pd-x" onclick="projModalClose()">✕</button></div><div class="proj-modal-b" id="projModalBody">'+projInfoInner_(S.cur, currentGroup())+'</div></div>';
}
function projModalClose(){ var o=document.getElementById('projModalOv'); if(o)o.remove(); }
function projModalRefresh_(){ var b=document.getElementById('projModalBody'); if(b && S.cur){ b.innerHTML=projInfoInner_(S.cur, currentGroup()); } }
// đổi tên bản nháp (modal — không dùng prompt vì 1 số trình duyệt chặn)

/* ═══════════ QUẢN LÝ CÔNG TY (chỉ super admin) ═══════════ */
var CT_FEATURES=[['dash','Bảng điều khiển'],['boc','Bóc tách'],['chiphi','Chi phí'],
  ['export','Xuất báo giá'],['muahang','Mua hàng'],['duan','Dự án'],
  ['sanpham','Danh sách sản phẩm'],['import','Nhập dữ liệu']];
async function renderCongTy(){
  var box=document.getElementById('v-congty'); if(!box) return;
  box.innerHTML='<div class="sechd"><h2>Quản lý công ty</h2></div><div class="empty" style="padding:26px">Đang tải…</div>';
  var list=[];
  try{ list=await api('listCongTy')||[]; }
  catch(e){ box.innerHTML='<div class="sechd"><h2>Quản lý công ty</h2></div><div class="empty" style="padding:26px">'+esc(e.message)+'</div>'; return; }
  S._ctList=list;
  var today=new Date(new Date().toDateString());
  function ngayConLai(h){ if(!h) return null; return Math.round((new Date(h)-today)/86400000); }
  // ---- thống kê nhanh ----
  var tong=list.length, dangHD=0, sapHet=0, tongUser=0;
  list.forEach(function(c){
    var d=ngayConLai(c.hanDung);
    if(c.active && !(d!==null&&d<0)) dangHD++;
    if(d!==null && d>=0 && d<=30) sapHet++;
    tongUser+=c.soUser||0;
  });
  var stats='<div class="ct-stats">'
    +'<div class="ct-stat"><span class="ct-stat-ic">'+icon('building',17)+'</span><div><b>'+tong+'</b><i>Công ty</i></div></div>'
    +'<div class="ct-stat ok"><span class="ct-stat-ic">'+icon('check',17)+'</span><div><b>'+dangHD+'</b><i>Đang hoạt động</i></div></div>'
    +'<div class="ct-stat warn"><span class="ct-stat-ic">'+icon('clock',17)+'</span><div><b>'+sapHet+'</b><i>Sắp hết hạn (30 ngày)</i></div></div>'
    +'<div class="ct-stat"><span class="ct-stat-ic">'+icon('list',17)+'</span><div><b>'+tongUser+'</b><i>Tổng người dùng</i></div></div>'
    +'</div>';
  // ---- thẻ từng công ty ----
  var cards=list.map(function(c,i){
    var d=ngayConLai(c.hanDung), het=(d!==null&&d<0);
    var st = !c.active ? ['locked','Tạm khoá'] : (het ? ['expired','Hết hạn'] : ['ok','Đang hoạt động']);
    var pct = c.gioiHanUser>0 ? Math.min(100, Math.round((c.soUser||0)/c.gioiHanUser*100)) : 0;
    var fullUser = c.gioiHanUser>0 && (c.soUser||0)>=c.gioiHanUser;
    var fpct = Math.round((c.tinhNang.length/CT_FEATURES.length)*100);
    var lbl={}; CT_FEATURES.forEach(function(f){ lbl[f[0]]=f[1]; });
    var chips=CT_FEATURES.map(function(f){
      var on=c.tinhNang.indexOf(f[0])>=0;
      return '<span class="ct-fc'+(on?' on':'')+'" title="'+esc(f[1])+(on?' — đã bật':' — chưa bật')+'">'+esc(f[1])+'</span>';
    }).join('');
    var hanTxt = c.hanDung
      ? (het ? '<span class="ct-han expired">Hết hạn '+fmtDate(c.hanDung)+'</span>'
             : (d<=30 ? '<span class="ct-han warn">Còn '+d+' ngày · '+fmtDate(c.hanDung)+'</span>'
                      : '<span class="ct-han">Đến '+fmtDate(c.hanDung)+'</span>'))
      : '<span class="ct-han muted">Không giới hạn</span>';
    var shareBadge = c.dungSpDezon ? '<span class="ct-sharetag" title="Được dùng kho sản phẩm của Dezon">'+icon('layers',11)+' Kho SP Dezon</span>' : '';
    return '<div class="ct-card'+(c.active?'':' off')+'">'
      +'<div class="ct-card-h">'
        +(c.logoUrl?'<img class="ct-lg" src="'+esc(c.logoUrl)+'" onerror="this.outerHTML=\'<span class=&quot;ct-ini&quot;>'+esc((c.ten||'?').trim().charAt(0).toUpperCase())+'</span>\'">'
                   :'<span class="ct-ini">'+esc((c.ten||'?').trim().charAt(0).toUpperCase())+'</span>')
        +'<div class="ct-card-t"><div class="ct-nm">'+esc(c.ten)+'</div>'
          +'<div class="ct-sub">'+esc(c.ma)+(c.email?(' · '+esc(c.email)):'')+(c.sdt?(' · '+esc(c.sdt)):'')+'</div></div>'
        +'<span class="ct-badge '+st[0]+'">'+st[1]+'</span>'
      +'</div>'
      +(shareBadge?'<div class="ct-sharerow">'+shareBadge+'</div>':'')
      +'<div class="ct-card-b">'
        +'<div class="ct-metric"><div class="ct-mh"><span>Người dùng</span><b'+(fullUser?' class="full"':'')+'>'+(c.soUser||0)+' / '+(c.gioiHanUser||'∞')+'</b></div>'
          +'<div class="ct-bar"><i class="'+(fullUser?'full':'')+'" style="width:'+pct+'%"></i></div></div>'
        +'<div class="ct-metric"><div class="ct-mh"><span>Tính năng</span><b>'+c.tinhNang.length+' / '+CT_FEATURES.length+'</b></div>'
          +'<div class="ct-bar"><i style="width:'+fpct+'%"></i></div></div>'
        +'<div class="ct-metric"><div class="ct-mh"><span>Hạn dùng</span></div>'+hanTxt+'</div>'
      +'</div>'
      +'<div class="ct-chips">'+chips+'</div>'
      +'<div class="ct-card-f">'
        +'<button class="ct-b" onclick="ctViewAs(\''+esc(c.id)+'\')">'+icon('eye',14)+' Xem dữ liệu</button>'
        +'<button class="ct-b" onclick="ctEdit('+i+')">'+icon('edit',14)+' Phân quyền</button>'
        +'<span class="sp" style="flex:1"></span>'
        +'<button class="ct-b del" title="Xoá công ty và toàn bộ dữ liệu" onclick="ctDelete('+i+')">'+icon('trash',14)+'</button>'
      +'</div></div>';
  }).join('') || '<div class="empty" style="padding:40px;text-align:center">Chưa có công ty nào. Bấm <b>Tạo công ty</b> để bắt đầu.</div>';
  var viewing=S._viewAs?(list.filter(function(c){return String(c.id)===String(S._viewAs);})[0]||{}).ten:'';
  box.innerHTML='<div class="sechd"><h2>Quản lý công ty</h2><span class="count">'+list.length+'</span>'
      +'<span class="sp" style="flex:1"></span>'
      +'<button class="btn blue sm" onclick="ctCreate()">'+icon('plus',14)+' Tạo công ty</button></div>'
    +(viewing?'<div class="ct-viewbar">'+icon('eye',15)+' Đang xem dữ liệu của <b>'+esc(viewing)+'</b>'
      +'<button class="btn ghost xs" onclick="ctViewAs(\'\')">Thoát chế độ xem</button></div>':'')
    +stats+'<div class="ct-grid">'+cards+'</div>';
}
// Super admin "xem như" 1 công ty -> mọi API gắn header x-view-company
function ctViewAs(id){
  S._viewAs=id||'';
  try{ id?localStorage.setItem('qs_viewAs',id):localStorage.removeItem('qs_viewAs'); }catch(e){}
  toast(id?'Đang xem dữ liệu công ty đã chọn':'Đã thoát chế độ xem');
  boot().then(function(){ renderCongTy(); });
}
function ctCreate(){ ctForm_(null); }
function ctEdit(i){ ctForm_((S._ctList||[])[i]||null); }
function ctForm_(c){
  var isNew=!c;
  c=c||{tinhNang:CT_FEATURES.map(function(f){return f[0];}), gioiHanUser:10, active:true};
  S._ctEditing=c;
  var ov=document.createElement('div'); ov.className='sp-modal-ov'; ov.id='ctOv';
  ov.onclick=function(e){ if(e.target===ov) ctClose(); };
  ov.innerHTML='<div class="sp-modal ct-modal pd"><div class="pd-head"><h3>'+icon('building',16)+' '
      +(isNew?'Tạo công ty mới':esc(c.ten))+'</h3><button class="pd-x" onclick="ctClose()">✕</button></div>'
    +'<div class="ct-tabs">'
      +'<button class="ct-tab on" data-t="info" onclick="ctTab_(\'info\')">Thông tin</button>'
      +'<button class="ct-tab" data-t="goi" onclick="ctTab_(\'goi\')">Gói &amp; tính năng</button>'
      +(isNew?'<button class="ct-tab" data-t="ad" onclick="ctTab_(\'ad\')">Tài khoản quản trị</button>'
             :'<button class="ct-tab" data-t="users" onclick="ctTab_(\'users\')">Người dùng</button>')
    +'</div>'
    // ---- Thông tin ----
    +'<div class="ct-pane on" data-p="info"><div class="ct-form">'
      +'<div class="spe-f"><label>Tên công ty *</label><input id="ctTen" value="'+esc(c.ten||'')+'" placeholder="VD: Nội thất An Phát"></div>'
      +'<div class="spe-f"><label>Mã công ty</label><input id="ctMa" value="'+esc(c.ma||'')+'" placeholder="tự tạo từ tên"'+(isNew?'':' readonly')+'></div>'
      +'<div class="spe-f"><label>Email liên hệ</label><input id="ctEmail" type="email" value="'+esc(c.email||'')+'" placeholder="ketoan@congty.vn"></div>'
      +'<div class="spe-f"><label>Điện thoại</label><input id="ctSdt" value="'+esc(c.sdt||'')+'" placeholder="09xx xxx xxx"></div>'
      +'<div class="spe-f wide"><label>Logo công ty</label>'
        +'<input type="hidden" id="ctLogo" value="'+esc(c.logoUrl||'')+'">'
        +'<div class="ctlogo-wrap" id="ctLogoWrap" onclick="ctLogoPick()" ondragover="ctLogoDrag(event,1)" ondragleave="ctLogoDrag(event,0)" ondrop="ctLogoDrop(event)">'+ctLogoInner_(c.logoUrl||'')+'</div>'
        +'<div class="upurl ctlogo-url"><span class="upurl-ic">'+icon('link',13)+'</span>'
          +'<input id="ctLogoUrl" placeholder="Hoặc dán link ảnh…" onkeydown="if(event.key===\'Enter\'){event.preventDefault();ctLogoAddUrl();}">'
          +'<button class="upurl-btn" onclick="ctLogoAddUrl()">Dùng link</button></div>'
      +'</div>'
    +'</div></div>'
    // ---- Gói & tính năng ----
    +'<div class="ct-pane" data-p="goi">'
      +'<div class="ct-form">'
        +'<div class="spe-f"><label>Số người dùng tối đa</label><input id="ctLimit" type="number" min="1" value="'+(c.gioiHanUser||10)+'"></div>'
        +'<div class="spe-f"><label>Hạn dùng <i class="ct-hint">(trống = không giới hạn)</i></label><input id="ctHan" type="date" value="'+esc(c.hanDung||'')+'"></div>'
        +'<div class="spe-f"><label>Trạng thái</label><select id="ctActive"><option value="1"'+(c.active!==false?' selected':'')+'>Đang hoạt động</option><option value="0"'+(c.active===false?' selected':'')+'>Tạm khoá</option></select></div>'
        +'<div class="spe-f"><label>Ghi chú</label><input id="ctGhiChu" value="'+esc(c.ghiChu||'')+'" placeholder="Gói/hợp đồng…"></div>'
      +'</div>'
      +'<div class="ct-share"><label class="ct-sw'+(c.dungSpDezon?' on':'')+'">'
        +'<input type="checkbox" id="ctShareSp"'+(c.dungSpDezon?' checked':'')+' onchange="this.closest(\'.ct-sw\').classList.toggle(\'on\',this.checked)">'
        +'<span class="ct-sw-b"></span>'
        +'<span class="ct-sw-t"><b>Cho dùng danh sách sản phẩm của Dezon</b>'
          +'<i>Công ty thấy thêm kho SP mẫu của Dezon (chỉ xem, không sửa/xoá được). Vẫn nhập được SP riêng.</i></span>'
      +'</label></div>'
      +'<div class="ct-feat"><div class="ct-feat-h">Tính năng được dùng'
        +'<button class="ct-all" onclick="ctToggleAll_(true)">Chọn hết</button>'
        +'<button class="ct-all" onclick="ctToggleAll_(false)">Bỏ hết</button></div><div class="ct-feat-b">'
        +CT_FEATURES.map(function(f){ var on=(c.tinhNang||[]).indexOf(f[0])>=0;
          return '<label class="ct-fchk'+(on?' on':'')+'"><input type="checkbox" data-f="'+f[0]+'"'+(on?' checked':'')
            +' onchange="this.parentNode.classList.toggle(\'on\',this.checked)"><span>'+esc(f[1])+'</span></label>';
        }).join('')+'</div></div>'
    +'</div>'
    // ---- Tài khoản quản trị (khi TẠO MỚI) ----
    +(isNew?'<div class="ct-pane" data-p="ad">'
      +'<p class="ct-note">Tạo sẵn tài khoản quản trị để bàn giao cho công ty. Họ đăng nhập được bằng <b>tên đăng nhập hoặc email</b>.</p>'
      +'<div class="ct-form">'
        +'<div class="spe-f"><label>Tên đăng nhập</label><input id="ctAdU" placeholder="vd: anphat.admin"></div>'
        +'<div class="spe-f"><label>Email đăng nhập</label><input id="ctAdE" type="email" placeholder="admin@congty.vn"></div>'
        +'<div class="spe-f"><label>Họ tên</label><input id="ctAdN" placeholder="Nguyễn Văn A"></div>'
        +'<div class="spe-f"><label>Mật khẩu</label><input id="ctAdP" type="password" placeholder="≥4 ký tự"></div>'
      +'</div></div>':'')
    // ---- Người dùng (khi SỬA) ----
    +(isNew?'':'<div class="ct-pane" data-p="users"><div id="ctUsers"><div class="empty" style="padding:20px">Đang tải…</div></div></div>')
    +'<div class="ct-f-btn"><button class="btn ghost sm" onclick="ctClose()">Huỷ</button>'
      +'<button class="btn blue" id="ctSaveBtn" onclick="ctSave(\''+esc(isNew?'':c.id)+'\')">'+icon('check',15)+' '+(isNew?'Tạo công ty':'Lưu thay đổi')+'</button></div></div>';
  document.body.appendChild(ov);
}
// ===== Logo công ty: tải ảnh lên (kéo/thả · bấm chọn · dán Ctrl+V · hoặc link) =====
function ctLogoInner_(url){
  if(url) return '<div class="ctlogo-box has"><img src="'+esc(imgUrlOf(url))+'" onerror="this.style.visibility=\'hidden\'">'
    +'<button class="ctlogo-x" title="Xoá logo" onclick="event.stopPropagation();ctLogoClear()">✕</button>'
    +'<span class="ctlogo-swap">'+icon('edit',12)+' Đổi logo</span></div>';
  return '<div class="ctlogo-box"><div class="ctlogo-ic">'+icon('camera',24)+'</div>'
    +'<div class="ctlogo-t">Kéo/thả hoặc bấm để tải logo</div>'
    +'<div class="ctlogo-s">PNG nền trong suốt · tối đa 5MB</div></div>';
}
function ctLogoRefresh_(){
  var w=document.getElementById('ctLogoWrap'), h=document.getElementById('ctLogo');
  if(w&&h) w.innerHTML=ctLogoInner_(h.value||'');
}
function ctLogoClear(){ var h=document.getElementById('ctLogo'); if(h) h.value=''; ctLogoRefresh_(); }
function ctLogoAddUrl(){
  var i=document.getElementById('ctLogoUrl'), h=document.getElementById('ctLogo');
  var v=i?String(i.value).trim():''; if(!v) return;
  h.value=v; i.value=''; ctLogoRefresh_(); toast('Đã dùng link ảnh làm logo');
}
function ctLogoPick(){
  var inp=document.createElement('input'); inp.type='file'; inp.accept='image/*';
  inp.onchange=function(){ var f=(inp.files||[])[0]; if(f) ctLogoUpload_(f); };
  inp.click();
}
async function ctLogoUpload_(file){
  var w=document.getElementById('ctLogoWrap'), h=document.getElementById('ctLogo');
  if(!w||!h) return;
  w.innerHTML='<div class="ctlogo-box loading"><div class="ctlogo-t">Đang tải logo lên…</div></div>';
  try{
    var dataUrl=await downscaleImage_(file, 512, 0.9);
    if(!dataUrl||dataUrl==='__DECODE_FAIL__'){ toast('Không đọc được ảnh — thử PNG/JPG khác'); ctLogoRefresh_(); return; }
    var tok=await uploadImg_(dataUrl, 'logo-'+Date.now()+'.png');
    h.value=tok; ctLogoRefresh_(); toast('Đã tải logo lên');
  }catch(e){ toast('Lỗi tải logo: '+e.message); ctLogoRefresh_(); }
}
function ctLogoDrag(e,on){ e.preventDefault();
  var b=document.querySelector('#ctLogoWrap .ctlogo-box'); if(b) b.classList.toggle('drag',!!on); }
function ctLogoDrop(e){ e.preventDefault(); ctLogoDrag(e,0);
  var f=[].slice.call((e.dataTransfer&&e.dataTransfer.files)||[]).filter(function(x){ return !x.type||/^image\//.test(x.type); })[0];
  if(f) ctLogoUpload_(f);
}
function ctTab_(t){
  var ov=document.getElementById('ctOv'); if(!ov) return;
  ov.querySelectorAll('.ct-tab').forEach(function(b){ b.classList.toggle('on', b.getAttribute('data-t')===t); });
  ov.querySelectorAll('.ct-pane').forEach(function(p){ p.classList.toggle('on', p.getAttribute('data-p')===t); });
  if(t==='users') ctLoadUsers_();
}
function ctToggleAll_(on){
  var ov=document.getElementById('ctOv'); if(!ov) return;
  ov.querySelectorAll('[data-f]').forEach(function(e){ e.checked=on; e.parentNode.classList.toggle('on',on); });
}
async function ctLoadUsers_(){
  var box=document.getElementById('ctUsers'); var c=S._ctEditing; if(!box||!c) return;
  try{
    var us=await api('listCongTyUsers', c.id);
    var lbl={}; CT_FEATURES.forEach(function(f){ lbl[f[0]]=f[1]; });
    var rows=us.map(function(u){
      var role={super:'Quản trị hệ thống',admin:'Quản trị công ty',staff:'Nhân viên'}[u.role]||u.role;
      var q = u.role==='staff' ? ((u.perms||[]).map(function(k){return '<span class="permchip">'+esc(lbl[k]||k)+'</span>';}).join(' ')||'<span class="st-lk">Chưa cấp</span>') : '<span class="muted">Toàn quyền</span>';
      return '<tr><td><b>'+esc(u.username)+'</b>'+(u.email?'<span class="ct-ma">'+esc(u.email)+'</span>':'')+'</td>'
        +'<td>'+esc(u.hoTen||'')+'</td><td>'+esc(role)+'</td><td>'+q+'</td>'
        +'<td class="c"><span class="ct-badge '+(u.active?'ok':'locked')+'">'+(u.active?'Hoạt động':'Khoá')+'</span></td></tr>';
    }).join('') || '<tr><td colspan="5" class="empty" style="padding:18px">Công ty chưa có tài khoản nào.</td></tr>';
    box.innerHTML='<div class="ct-uhead"><span>'+us.length+' / '+(c.gioiHanUser||'∞')+' tài khoản</span>'
        +'<button class="btn blue xs" onclick="ctAddUser_()">'+icon('plus',13)+' Thêm tài khoản</button></div>'
      +'<div class="tbl-wrap"><table class="sp-table"><thead><tr><th>Đăng nhập</th><th>Họ tên</th><th>Vai trò</th><th>Quyền</th><th class="ct">Trạng thái</th></tr></thead><tbody>'+rows+'</tbody></table></div>';
  }catch(e){ box.innerHTML='<div class="empty" style="padding:20px">Lỗi: '+esc(e.message)+'</div>'; }
}
async function ctAddUser_(){
  var c=S._ctEditing; if(!c) return;
  var r=await askInput_({title:'Thêm tài khoản cho '+c.ten, confirmText:'Tạo tài khoản', fields:[
    {key:'u', label:'Tên đăng nhập'}, {key:'e', label:'Email (đăng nhập được)'},
    {key:'n', label:'Họ tên'}, {key:'p', label:'Mật khẩu (≥4 ký tự)', type:'password'} ], required:false});
  if(!r) return;
  if(!r.u || String(r.p).length<4){ toast('Cần tên đăng nhập và mật khẩu ≥4 ký tự'); return; }
  try{ await api('createCongTyUser', c.id, {username:r.u, email:r.e, hoTen:r.n, password:r.p, role:'staff', perms:[]});
    toast('Đã tạo tài khoản '+r.u); ctLoadUsers_(); renderCongTy(); }
  catch(e){ toast('Lỗi: '+e.message); }
}
function ctClose(){ var o=document.getElementById('ctOv'); if(o)o.remove(); S._ctEditing=null; }
async function ctSave(id){
  var ov=document.getElementById('ctOv'); if(!ov) return;
  function v(i){ var e=document.getElementById(i); return e?String(e.value).trim():''; }
  var feats=[].slice.call(ov.querySelectorAll('[data-f]')).filter(function(e){return e.checked;}).map(function(e){return e.getAttribute('data-f');});
  var d={ ten:v('ctTen'), logoUrl:v('ctLogo'), email:v('ctEmail'), sdt:v('ctSdt'), tinhNang:feats,
          gioiHanUser:Number(v('ctLimit'))||0, hanDung:v('ctHan')||null,
          active:v('ctActive')==='1', ghiChu:v('ctGhiChu'),
          dungSpDezon: !!(document.getElementById('ctShareSp')||{}).checked };
  if(!d.ten){ toast('Chưa nhập tên công ty'); ctTab_('info'); return; }
  if(!feats.length){ toast('Chọn ít nhất 1 tính năng cho công ty'); ctTab_('goi'); return; }
  var btn=document.getElementById('ctSaveBtn'); if(btn){ btn.disabled=true; btn.textContent='Đang lưu…'; }
  try{
    if(id){ await api('updateCongTy', id, d); toast('Đã cập nhật công ty'); }
    else{
      d.ma=v('ctMa'); d.adminUser=v('ctAdU'); d.adminEmail=v('ctAdE'); d.adminHoTen=v('ctAdN'); d.adminPass=v('ctAdP');
      if(d.adminUser && String(d.adminPass).length<4){ toast('Mật khẩu quản trị tối thiểu 4 ký tự'); ctTab_('ad');
        if(btn){btn.disabled=false;btn.textContent='Tạo công ty';} return; }
      var c=await api('createCongTy', d);
      toast('Đã tạo "'+c.ten+'"'+(d.adminUser?(' — đăng nhập: '+d.adminUser):''));
    }
    ctClose(); renderCongTy();
  }catch(e){ toast('Lỗi: '+e.message); if(btn){ btn.disabled=false; btn.textContent=id?'Lưu thay đổi':'Tạo công ty'; } }
}

async function ctDelete(i){
  var c=(S._ctList||[])[i]; if(!c) return;
  var ok=await askInput_({title:'Xoá công ty', note:'Xoá VĨNH VIỄN công ty "'+c.ten+'" và TOÀN BỘ dữ liệu (dự án, sản phẩm, đơn hàng, tài khoản). Không thể hoàn tác.',
    label:'Gõ đúng mã công ty để xác nhận: '+c.ma, placeholder:c.ma, confirmText:'Xoá vĩnh viễn'});
  if(ok==null) return;
  if(String(ok).trim()!==c.ma){ toast('Mã xác nhận không đúng — đã huỷ'); return; }
  try{ var r=await api('deleteCongTy', c.id); toast('Đã xoá công ty "'+r.ten+'"'); renderCongTy(); }
  catch(e){ toast('Lỗi: '+e.message); }
}

/* ===== Hộp nhập liệu dùng chung — THAY prompt() (bị nhiều trình duyệt chặn) ===== */
function askInput_(o){
  o=o||{};
  var fields=o.fields||[{key:'v', label:o.label||'', value:o.value||'', type:o.type||'text', placeholder:o.placeholder||''}];
  return new Promise(function(resolve){
    var ov=document.createElement('div'); ov.className='sp-modal-ov'; ov.id='askOv';
    function done(val){ try{ ov.remove(); }catch(e){} document.removeEventListener('keydown',esckey); resolve(val); }
    function esckey(e){ if(e.key==='Escape') done(null); }
    document.addEventListener('keydown',esckey);
    ov.onclick=function(e){ if(e.target===ov) done(null); };
    ov.innerHTML='<div class="sp-modal ask-modal pd"><div class="pd-head"><h3>'+esc(o.title||'Nhập thông tin')+'</h3>'
      +'<button class="pd-x" data-ask="cancel">✕</button></div>'
      +(o.note?'<p class="ask-note">'+esc(o.note)+'</p>':'')
      +fields.map(function(f,i){
        return '<div class="ask-f"><label>'+esc(f.label||'')+'</label>'
          +'<input class="ask-in" data-k="'+esc(f.key)+'" type="'+(f.type||'text')+'" value="'+esc(f.value||'')+'" placeholder="'+esc(f.placeholder||'')+'">'
          +'</div>';
      }).join('')
      +'<div class="ask-err" style="display:none"></div>'
      +'<div class="ask-f-btn"><button class="btn ghost sm" data-ask="cancel">Huỷ</button>'
      +'<button class="btn blue" data-ask="ok">'+esc(o.confirmText||'Xác nhận')+'</button></div></div>';
    document.body.appendChild(ov);
    function submit(){
      var out={}, ok=true;
      ov.querySelectorAll('.ask-in').forEach(function(el){
        var v=String(el.value||'').trim(); out[el.getAttribute('data-k')]=v;
        if(!v && o.required!==false) ok=false;
      });
      if(!ok){ var er=ov.querySelector('.ask-err'); er.textContent='Vui lòng nhập đầy đủ.'; er.style.display='block'; return; }
      done(fields.length===1 ? out[fields[0].key] : out);
    }
    ov.addEventListener('click',function(e){
      var b=e.target.closest('[data-ask]'); if(!b) return;
      if(b.getAttribute('data-ask')==='ok') submit(); else done(null);
    });
    ov.addEventListener('keydown',function(e){ if(e.key==='Enter'){ e.preventDefault(); submit(); } });
    setTimeout(function(){ var f=ov.querySelector('.ask-in'); if(f){ f.focus(); f.select(); } },40);
  });
}
function renameDraft(maDA){
  var p=(S.projects||[]).filter(function(x){return x.maDA===maDA;})[0]; if(!p) return;
  // đang sửa tên tại chỗ mà bấm nút bút chì -> dọn ô sửa đi, tránh 2 giao diện đổi tên chồng nhau
  if(document.querySelector('.dh-draft-in')) renderDash();
  var gr=projectGroups().filter(function(g){ return g.drafts.some(function(d){return d.maDA===maDA;}); })[0];
  var i=gr?gr.drafts.findIndex(function(d){return d.maDA===maDA;}):0;
  var cur=p.tenBanNhap||('Bản nháp '+(i+1));
  var ov=document.createElement('div'); ov.className='sp-modal-ov'; ov.id='rnOv';
  ov.onclick=function(e){ if(e.target===ov) rnClose_(); };
  ov.innerHTML='<div class="sp-modal rn-modal pd"><div class="pd-head"><h3>'+icon('edit',15)+' Đổi tên bản nháp</h3><button class="pd-x" onclick="rnClose_()">✕</button></div>'
    +'<input class="rn-in" id="rnInput" value="'+esc(cur)+'" placeholder="Tên bản nháp" onkeydown="if(event.key===\'Enter\')rnSave_(\''+esc(maDA)+'\')">'
    +'<div class="rn-f"><button class="btn ghost sm" onclick="rnClose_()">Huỷ</button><button class="btn blue" onclick="rnSave_(\''+esc(maDA)+'\')">'+icon('check',14)+' Lưu</button></div></div>';
  document.body.appendChild(ov);
  setTimeout(function(){ var el=document.getElementById('rnInput'); if(el){ el.focus(); el.select(); } },40);
}
/* Sửa tên bản nháp NGAY TRÊN CHỮ — người dùng bấm vào tên là muốn đổi tên,
   không phải đi tìm nút bút chì lẫn trong dãy icon. Enter/rời ô = lưu, Esc = huỷ. */
function draftNameEdit_(ev, maDA){
  ev.stopPropagation();
  var b=ev.currentTarget; if(b.dataset.dang==='1') return;
  var cu=b.textContent, w=Math.max(120, b.getBoundingClientRect().width+24);
  b.dataset.dang='1';
  var inp=document.createElement('input');
  inp.className='dh-draft-in'; inp.value=cu; inp.style.width=w+'px';
  b.replaceWith(inp); inp.focus(); inp.select();
  var xong=false;
  function huy(){ if(xong) return; xong=true; renderDash(); }
  async function luu(){
    if(xong) return; xong=true;
    var ten=inp.value.trim();
    if(!ten || ten===cu){ renderDash(); return; }
    try{ var np=await api('updateProject', maDA, {tenBanNhap:ten}); syncProj(np); toast('Đã đổi tên bản nháp'); }
    catch(e){ toast('Lỗi: '+e.message); }
    renderDash();
    if(document.getElementById('projModalOv')) projModalRefresh_();
  }
  inp.addEventListener('keydown',function(e){
    if(e.key==='Enter'){ e.preventDefault(); luu(); }
    else if(e.key==='Escape'){ e.preventDefault(); huy(); }
  });
  inp.addEventListener('blur', luu);
}
function rnClose_(){ var o=document.getElementById('rnOv'); if(o)o.remove(); }
async function rnSave_(maDA){
  var el=document.getElementById('rnInput'); var name=el?el.value.trim():'';
  try{ var np=await api('updateProject',maDA,{tenBanNhap:name}); syncProj(np); rnClose_(); renderDash();
    if(document.getElementById('projModalOv')) projModalRefresh_(); toast('Đã đổi tên bản nháp'); }
  catch(e){ toast('Lỗi: '+e.message); }
}
// Mở 1 bản nháp (ở lại trang Thông tin dự án)
async function openDraft(maDA){
  var p=(S.projects||[]).filter(function(x){return x.maDA===maDA;})[0]; if(!p) return;
  S.cur=p; S.lines=await api('getLines',maDA)||[]; S._coverDA=null;
  projRefreshUI_(); refreshActiveTab_();
  if(document.getElementById('v-boc').classList.contains('on')) renderAll();
}
// Thêm bản nháp cho dự án đang mở
async function addDraftForCur(){
  var gr=currentGroup(); if(!gr) return;
  try{ var p=await api('createProject',{ten:gr.name,khachHang:S.cur.khachHang,sdt:S.cur.sdt,diaChi:S.cur.diaChi,vat:Number(S.cur.vat)||0});
    S.cur=p; S.lines=[]; await boot(); projRefreshUI_(); toast('Đã thêm bản nháp mới'); }catch(e){ toast('Lỗi: '+e.message); }
}
// Lưu thông tin dự án -> áp dụng cho MỌI bản nháp (giữ nhóm nhất quán)
async function saveProjectShared(btn){
  var g=function(id){var e=document.getElementById(id);return e?e.value:'';};
  var shared={ten:g('pf_ten'),khachHang:g('pf_kh'),sdt:g('pf_sdt'),diaChi:g('pf_addr'),linkDezon:String(g('pf_link')||'').trim()};
  if(shared.linkDezon && !/^https?:\/\//i.test(shared.linkDezon)) shared.linkDezon='https://'+shared.linkDezon;
  if(shared.linkDezon && !/(^|\.)dezon\.vn$/i.test(dezonHost_(shared.linkDezon))
     && !confirm('Link này không thuộc dezon.vn:\n'+shared.linkDezon+'\n\nVẫn lưu?')) return;
  if(!shared.linkDezon && !(S.cur&&S.cur.linkDezon)) delete shared.linkDezon;   // không đụng cột khi không có link
  var gr=currentGroup(); if(!gr) return; btn.disabled=true;
  try{
    for(var i=0;i<gr.drafts.length;i++){ var pp=await api('updateProject',gr.drafts[i].maDA,shared); syncProj(pp); }
    projRefreshUI_(); toast('Đã lưu thông tin dự án ('+gr.drafts.length+' bản nháp)');
  }catch(e){ toast('Lỗi: '+e.message); } btn.disabled=false;
}
// Lưu thông tin của riêng bản nháp đang mở
function projRefreshUI_(){ renderCard&&renderCard(); renderProjSel&&renderProjSel();
  if(document.getElementById('projModalOv')) projModalRefresh_();
  else { var vp=document.getElementById('v-project'); if(vp&&vp.classList.contains('on')) renderProjects(); }
  renderDash&&renderDash(); }
async function saveDraftInfo(btn){
  var g=function(id){var e=document.getElementById(id);return e?e.value:'';};
  var data={tenBanNhap:g('pf_tbn'),trangThai:g('pf_tt'),vat:Number(g('pf_vat'))||0,maBaoGia:g('pf_mbg'),quyMo:g('pf_qm'),tongDT:g('pf_tdt'),dtBaoGia:g('pf_dtbg'),nhuCau:g('pf_nc'),phanKhuc:g('pf_pk'),ghiChu:g('pf_gc')};
  btn.disabled=true; try{ var p=await api('updateProject',S.cur.maDA,data); syncProj(p); projRefreshUI_(); toast('Đã lưu bản nháp'); }catch(e){ toast('Lỗi: '+e.message); } btn.disabled=false;
}
async function saveProgress(btn){ var v=Number(document.getElementById('pf_prog').value)||0;
  try{ var p=await api('updateProject',S.cur.maDA,{tienDo:v}); syncProj(p); renderCard(); renderDash&&renderDash(); toast('Đã cập nhật tiến độ '+v+'%'); }catch(e){ toast('Lỗi: '+e.message); } }
async function pickProject(maDA){ S.cur=S.projects.filter(function(p){return p.maDA===maDA;})[0]; S.lines=await api('getLines',maDA)||[]; S._coverDA=null; renderAll(); renderProjSel&&renderProjSel(); showTab('boc'); }
async function removeProject(maDA, ev){
  if(ev&&ev.stopPropagation) ev.stopPropagation();
  if(!confirm('Xoá bản nháp này?')) return;
  try{ await api('deleteProject',maDA); }
  catch(e){ toast('Lỗi xoá bản nháp: '+e.message); return; }      // trước đây lỗi API rơi im lặng
  if(S.cur&&S.cur.maDA===maDA) S.cur=null;
  try{ projModalClose(); }catch(e){}
  await projReload_(); projRefreshAll_(); toast('Đã xoá bản nháp');
}

/* ===== DASHBOARD ===== */
function card(t,n){ return '<div class="scard"><div class="n">'+n+'</div><div class="t">'+t+'</div></div>'; }
function dezonHost_(u){ try{ return new URL(u).hostname; }catch(e){ return ''; } }
function dezonUrl_(u){ u=String(u||'').trim(); return /^https?:\/\//i.test(u)?u:('https://'+u); }
// Gom bản nháp theo Dự án (cùng tên dự án = cùng 1 dự án)
function projectGroups(){
  var groups={}, order=[];
  (S.projects||[]).forEach(function(p){
    var key=String(p.ten||'(Chưa đặt tên)').trim().toLowerCase();
    if(!groups[key]){ groups[key]={name:p.ten||'(Chưa đặt tên)', khachHang:p.khachHang, diaChi:p.diaChi, sdt:p.sdt, drafts:[]}; order.push(key); }
    var g=groups[key]; g.drafts.push(p);
    if(p.khachHang) g.khachHang=p.khachHang; if(p.diaChi) g.diaChi=p.diaChi; if(p.sdt) g.sdt=p.sdt;
    if(p.linkDezon) g.linkDezon=p.linkDezon;
  });
  order.forEach(function(k){ groups[k].drafts.sort(function(a,b){ return String(a.ngayTao||'').localeCompare(String(b.ngayTao||'')); }); });
  return order.map(function(k){ return groups[k]; });
}
// Dự án (nhiều) -> mỗi dự án có nhiều bản nháp (phương án báo giá riêng)
function draftListHtml(){
  var groups=projectGroups(); S._projGroups=groups;
  var cards=groups.map(function(g,gi){
    var drafts=g.drafts.map(function(p,i){
      var on=S.cur&&S.cur.maDA===p.maDA;
      return '<div class="draft-row'+(on?' active':'')+'">'
        +'<div class="draft-info" onclick="projInfoModal(\''+esc(p.maDA)+'\')" title="Bấm xem/sửa thông tin"><b>'+esc(draftName_(p,i))+'</b><span class="draft-code">'+esc(p.maDA)+' · '+fmtDate(p.ngayTao)+'</span></div>'
        +'<div class="draft-act">'
        +(on?'<span class="draft-badge">'+icon('check',12)+' Đang dùng</span>'
            :'<button class="btn blue xs" onclick="pickProject(\''+esc(p.maDA)+'\')">Dùng</button>')
        +'<button class="btn ghost xs iconbtn" title="Sửa tên bản nháp" onclick="renameDraft(\''+esc(p.maDA)+'\')">'+icon('edit',12)+'</button>'
        +'<button class="btn ghost xs iconbtn" title="Nhân bản bản nháp" onclick="duplicateDraft(\''+esc(p.maDA)+'\')">'+icon('copy',12)+'</button>'
        +'<button class="btn ghost xs iconbtn" title="Xoá bản nháp" onclick="removeProject(\''+esc(p.maDA)+'\',event)">'+icon('trash',12)+'</button></div></div>';
    }).join('');
    return '<div class="proj-card2">'
      +'<div class="proj-head2 clickable" onclick="projInfoModal(\''+esc(g.drafts[0].maDA)+'\')" title="Bấm xem thông tin dự án"><span class="proj-ic">'+icon('building',17)+'</span>'
        +'<div class="proj-ht"><div class="proj-name">'+esc(g.name)+'</div>'
          +'<div class="proj-meta">'+esc(g.khachHang||'Chưa có khách hàng')+(g.sdt?' · '+esc(g.sdt):'')+'</div></div>'
        +'<span class="proj-count">'+g.drafts.length+' bản nháp</span></div>'
      +'<button class="proj-del" title="Xoá cả dự án này (mọi bản nháp)" onclick="removeProjectGroup(\''+esc(g.drafts[0].maDA)+'\',event)">'+icon('trash',13)+'</button>'
      +'<div class="draft-list">'+drafts+'</div>'
      +'<button class="btn ghost sm proj-add" onclick="addDraft(\''+esc(g.drafts[0].maDA)+'\')">'+icon('plus',13)+' Thêm bản nháp</button></div>';
  }).join('') || '<div class="empty" style="padding:26px;text-align:center;color:var(--muted)">Chưa có dự án. Bấm <b>"Tạo dự án"</b> để bắt đầu.</div>';
  return '<div class="dbcard"><div class="dbcard-h"><span class="dbcard-ic">'+icon('home',18)+'</span><h3>Danh sách dự án</h3>'
    +'<span class="ps2-badge">'+pad2(groups.length)+'</span><span class="sp" style="flex:1"></span>'
    +'<button class="btn blue sm" onclick="openCreate()">'+icon('plus',14)+' Tạo dự án</button></div>'
    +'<div class="dbcard-b"><div class="proj-grid">'+cards+'</div></div></div>';
}
/* Tìm dự án (nhóm bản nháp) theo MÃ của một bản nháp bất kỳ trong nhóm.
   Trước đây các nút trên trang Dự án / Bảng điều khiển gọi theo CHỈ SỐ trong
   S._projGroups — mà mảng này bị cả hai trang ghi đè, nên bấm "Thêm bản nháp"
   ở thẻ này lại rơi vào dự án khác. Khoá theo mã thì không bao giờ lệch.        */
/* Tải lại NHẸ sau khi thêm/xoá bản nháp: chỉ lấy danh sách dự án + dòng của bản
   đang mở. Trước đây gọi boot() -> kéo lại toàn bộ danh mục sản phẩm nên bấm phát
   nào cũng phải chờ. */
async function projReload_(){
  try{ S.projects=await api('getProjects')||[]; }catch(e){ toast('Lỗi tải danh sách dự án: '+e.message); }
  if(S.cur){ var f=(S.projects||[]).filter(function(p){ return p.maDA===S.cur.maDA; })[0]; S.cur=f||S.projects[0]||null; }
  else S.cur=(S.projects||[])[0]||null;
  try{ S.lines = S.cur ? (await api('getLines', S.cur.maDA)||[]) : []; }catch(e){ S.lines=[]; }
  if(typeof renderAll==='function') renderAll();
}
function projGroupOf_(key){
  key=String(key||''); if(!key) return null;
  var gs=projectGroups();
  for(var i=0;i<gs.length;i++){
    for(var j=0;j<gs[i].drafts.length;j++) if(String(gs[i].drafts[j].maDA)===key) return gs[i];
  }
  return null;
}
// Vẽ lại MỌI trang có danh sách dự án (trước đây chỉ vẽ 1 trang -> trang kia còn nút cũ, bấm ra dự án sai)
function projRefreshAll_(){
  try{ if(viewOn_('v-dash') && typeof renderDash==='function') renderDash(); }catch(e){}
  try{ if(viewOn_('v-project') && typeof renderProjects==='function') renderProjects(); }catch(e){}
  try{ if(typeof renderProjSel==='function') renderProjSel(); if(typeof renderCard==='function') renderCard(); }catch(e){}
}
// Thêm 1 bản nháp (phương án báo giá mới) cho dự án đang có
async function addDraft(key){
  var g=projGroupOf_(key);
  if(!g){ toast('Không tìm thấy dự án này — bấm F5 tải lại trang'); return; }
  try{
    var p=await api('createProject',{ten:g.name, khachHang:g.khachHang, sdt:g.sdt, diaChi:g.diaChi, vat:0});
    S.cur=p; S.lines=[]; await projReload_(); projRefreshAll_();
    toast('Đã thêm bản nháp mới cho "'+g.name+'"');
  }catch(e){ toast('Lỗi thêm bản nháp: '+e.message); }
}
/* Xoá NHANH cả dự án (mọi bản nháp của nó) — nút ✕ ở góc thẻ dự án */
async function removeProjectGroup(key, ev){
  if(ev&&ev.stopPropagation) ev.stopPropagation();
  var g=projGroupOf_(key);
  if(!g){ toast('Không tìm thấy dự án này — bấm F5 tải lại trang'); return; }
  var n=g.drafts.length;
  if(!confirm('Xoá cả dự án "'+g.name+'" cùng '+n+' bản nháp?\n\nToàn bộ hạng mục đã bóc trong các bản nháp này sẽ mất và KHÔNG khôi phục được.')) return;
  var loi=[];
  for(var i=0;i<g.drafts.length;i++){
    try{ await api('deleteProject', g.drafts[i].maDA); }
    catch(e){ loi.push(g.drafts[i].maDA+': '+e.message); }
  }
  if(S.cur && g.drafts.some(function(d){ return d.maDA===S.cur.maDA; })) S.cur=null;
  try{ projModalClose&&projModalClose(); }catch(e){}
  await projReload_(); projRefreshAll_();
  toast(loi.length?('Xoá xong '+(n-loi.length)+'/'+n+' bản — lỗi: '+loi[0]):('Đã xoá dự án "'+g.name+'" ('+n+' bản nháp)'));
}
// Nhân bản 1 bản nháp (copy toàn bộ hạng mục + tờ bìa sang bản nháp mới)
// Nhân bản: popup chọn phần cần sao chép
function duplicateDraft(maDA){
  var hasPT=false; try{ hasPT=!!localStorage.getItem('pt_'+maDA); }catch(e){}
  var ov=document.createElement('div'); ov.className='sp-modal-ov'; ov.id='dupOv';
  ov.onclick=function(e){ if(e.target===ov) dupClose_(); };
  ov.innerHTML='<div class="sp-modal dup-modal pd"><div class="pd-head"><h3>'+icon('copy',15)+' Nhân bản bản nháp</h3><button class="pd-x" onclick="dupClose_()">✕</button></div>'
    +'<p class="dup-hint">Chọn phần cần sao chép sang bản nháp mới (Thông tin dự án luôn được copy):</p>'
    +'<div class="dup-list">'
      +'<label class="dup-ck"><input type="checkbox" id="dupBoc" checked><span><b>Bóc tách</b> — sản phẩm đã bóc (Chi phí · Mua hàng đi theo phần này)</span></label>'
      +'<label class="dup-ck"><input type="checkbox" id="dupCover" checked><span><b>Xuất báo giá</b> — tờ bìa / ước tính chi phí</span></label>'
      +(hasPT?'<label class="dup-ck"><input type="checkbox" id="dupPT" checked><span><b>Phần thô</b> — bảng ước tính xây thô</span></label>':'')
    +'</div>'
    +'<div class="dup-f"><button class="btn ghost sm" onclick="dupClose_()">Huỷ</button><button class="btn blue" onclick="dupDo_(\''+esc(maDA)+'\',this)">'+icon('copy',14)+' Nhân bản</button></div></div>';
  document.body.appendChild(ov);
}
function dupClose_(){ var o=document.getElementById('dupOv'); if(o)o.remove(); }
async function dupDo_(maDA, btn){
  var g=function(id){var e=document.getElementById(id);return e?e.checked:false;};
  var opts={boc:g('dupBoc'), cover:g('dupCover')}, cpPT=g('dupPT');
  if(btn){ btn.disabled=true; btn.textContent='Đang nhân bản…'; }
  try{
    var p=await api('duplicateProject',maDA,opts);
    if(cpPT){ try{ var v=localStorage.getItem('pt_'+maDA); if(v) localStorage.setItem('pt_'+p.maDA, v);
      var vv=localStorage.getItem('pt_'+maDA+'_vat'); if(vv) localStorage.setItem('pt_'+p.maDA+'_vat', vv); }catch(e){} }
    S.cur=p; S._coverDA=null; S._ptKey=null;
    await boot(); renderDash(); dupClose_(); projModalClose&&projModalClose();
    toast('Đã nhân bản ('+ ((S.lines||[]).length) +' hạng mục)');
  }catch(e){ toast('Lỗi nhân bản: '+e.message); if(btn){ btn.disabled=false; btn.innerHTML=icon('copy',14)+' Nhân bản'; } }
}
function kpi(ic,label,val,accent){ return '<div class="kpi"><div class="kpi-ic '+(accent||'')+'">'+ic+'</div><div class="kpi-b"><div class="kpi-n">'+val+'</div><div class="kpi-t">'+esc(label)+'</div></div></div>'; }
function dhKpi_(ic,label,val,sub,accent){ return '<div class="dh-kpi '+(accent||'')+'"><div class="dh-kpi-ic">'+icon(ic,18)+'</div><div class="dh-kpi-b"><div class="dh-kpi-v">'+val+'</div><div class="dh-kpi-l">'+esc(label)+(sub?' · <span class="dh-kpi-sub">'+esc(sub)+'</span>':'')+'</div></div></div>'; }
function renderDash(){
  var el=document.getElementById('v-dash');
  var header='<div class="sechd"><h2>Bảng điều khiển</h2></div>';
  if(!S.cur){
    el.innerHTML=header+'<div class="dash-empty">'+icon('layers',40)+'<h3>Chưa chọn bản nháp</h3><p>Chọn một bản nháp bên dưới để xem tổng quan — hoặc tạo dự án mới.</p></div>'
      +'<div class="dh-grid"><div class="dh-main">'+dashProjSection_()+'</div><div class="dh-side">'+dashQuick_()+'</div></div>';
    return;
  }
  var von=0,ban=0,kl=0,groups={}; S.lines.forEach(function(l){ von+=ttVon_(l);ban+=ttBan_(l);kl+=Number(l.soLuong)||0; var k=l.nhom||'Khác'; (groups[k]=groups[k]||{ban:0}).ban+=ttBan_(l); });
  var lnT=ban-von, bien=ban>0?(lnT/ban*100):0, gr=currentGroup();
  // ---- HERO ----
  var hero='<div class="dh-hero"><div class="dh-hero-l">'
    +'<div class="dh-eyebrow"><span class="dh-dot"></span> ĐANG LÀM VIỆC</div>'
    +'<div class="dh-title">'+icon('building',20)+'<span class="dh-pn">'+esc(S.cur.ten)+'</span><b class="dh-sep">›</b>'+esc(draftName_(S.cur, gr?gr.idx:0))+'</div>'
    +'<div class="dh-sub">'+esc(S.cur.maDA)+'　·　Tạo '+fmtDate(S.cur.ngayTao)+'　·　<span class="dh-status">'+esc(S.cur.trangThai||'Bản nháp')+'</span></div>'
    +'</div><div class="dh-hero-r">'
      +'<button class="dh-act primary" onclick="showTab(\'boc\')">'+icon('layers',15)+' Mở bóc tách</button>'
      +'<button class="dh-act" onclick="showTab(\'chiphi\')">'+icon('money',15)+' Chi phí</button>'
      +'<button class="dh-act" onclick="showTab(\'export\')">'+icon('doc',15)+' Xuất báo giá</button>'
      +'<button class="dh-act" onclick="projInfoModal(S.cur.maDA)">'+icon('sliders',15)+' Thông tin</button>'
    +'</div></div>';
  // ---- KPI ----
  var kpis='<div class="dh-kpis">'
    +dhKpi_('list','Số hạng mục',S.lines.length,'','blue')
    +dhKpi_('layers','Tổng khối lượng',kl,'','slate')
    +dhKpi_('lock','Giá trị vốn',money(von)+' đ','','slate')
    +dhKpi_('money','Tổng giá bán',money(ban)+' đ','','blue')
    +dhKpi_('gauge','Lợi nhuận',money(lnT)+' đ',bien.toFixed(1)+'% biên',lnT<0?'red':'green')+'</div>';
  // ---- Side: chart nhóm + thao tác nhanh ----
  var byG=Object.keys(groups).map(function(k){return {k:k,ban:groups[k].ban};}).sort(function(a,b){return b.ban-a.ban;});
  var max=byG.reduce(function(m,g){return Math.max(m,g.ban);},1);
  var bars=byG.map(function(g){ var pct=Math.round(g.ban/max*100);
    return '<div class="dh-bar"><div class="dh-bar-t"><span>'+esc(nodeName(g.k))+'</span><b>'+money(g.ban)+' đ</b></div><div class="dh-bar-track"><i style="width:'+pct+'%"></i></div></div>'; }).join('')
    ||'<div class="dh-empty2">Chưa có hạng mục nào trong bản nháp này.</div>';
  var side='<div class="dh-card"><div class="dh-card-h">'+icon('gauge',16)+' Giá trị theo nhóm</div><div class="dh-card-b">'+bars+'</div></div>'+dashQuick_();
  el.innerHTML=header+hero+kpis+'<div class="dh-grid"><div class="dh-main">'+dashProjSection_()+'</div><div class="dh-side">'+side+'</div></div>';
}
function dashQuick_(){
  return '<div class="dh-card"><div class="dh-card-h">'+icon('sliders',16)+' Thao tác nhanh</div><div class="dh-card-b dh-quick">'
    +'<button onclick="showTab(\'muahang\')">'+icon('cart',18)+'<span>Mua hàng</span></button>'
    +'<button onclick="showTab(\'duan\')">'+icon('list',18)+'<span>SP trong dự án</span></button>'
    +'<button onclick="showTab(\'import\')">'+icon('download',18)+'<span>Nhập dữ liệu</span></button>'
    +'<button onclick="showTab(\'sanpham\')">'+icon('tag',18)+'<span>Danh sách SP</span></button>'
    +'</div></div>';
}
// Danh sách dự án (có tìm kiếm) — render chỉ lại grid khi tìm để mượt
function dashProjSection_(){
  var groups=projectGroups(); S._projGroups=groups;
  var searchIc='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>';
  return '<div class="dh-card"><div class="dh-card-h">'+icon('home',16)+' Danh sách dự án <span class="dh-count">'+groups.length+'</span>'
    +'<span class="sp" style="flex:1"></span>'
    +'<div class="dh-search">'+searchIc+'<input placeholder="Tìm dự án, khách hàng…" value="'+esc(S._dashSearch||'')+'" oninput="dashSearch_(this.value)"></div>'
    +'<button class="dh-newbtn" onclick="openCreate()">'+icon('plus',14)+' Tạo dự án</button></div>'
    +'<div class="dh-card-b"><div class="dh-projgrid" id="dhProjGrid">'+dashProjCards_(groups)+'</div></div></div>';
}
function dashProjCards_(groups){
  var q=(S._dashSearch||'').toLowerCase().trim();
  var filt=q?groups.filter(function(g){ return (g.name+' '+(g.khachHang||'')+' '+(g.sdt||'')).toLowerCase().indexOf(q)>=0; }):groups;
  if(!filt.length) return '<div class="dh-empty2" style="padding:30px">'+(q?'Không tìm thấy dự án khớp "'+esc(q)+'".':'Chưa có dự án. Bấm <b>Tạo dự án</b> để bắt đầu.')+'</div>';
  return filt.map(dashProjCard_).join('');
}
function dashProjCard_(g){
  var gi=(S._projGroups||[]).indexOf(g);
  var drafts=g.drafts.map(function(p,i){ var on=S.cur&&S.cur.maDA===p.maDA;
    return '<div class="dh-draft'+(on?' on':'')+'">'
      +'<div class="dh-draft-i">'
        +'<b class="dh-draft-n" title="Bấm để đổi tên bản nháp" onclick="draftNameEdit_(event,\''+esc(p.maDA)+'\')">'+esc(draftName_(p,i))+'</b>'
        +'<span onclick="projInfoModal(\''+esc(p.maDA)+'\')" title="Xem / sửa thông tin">'+esc(p.maDA)+' · '+fmtDate(p.ngayTao)+'</span></div>'
      +'<div class="dh-draft-a">'
      +(on?'<span class="dh-badge">'+icon('check',12)+' Đang dùng</span>':'<button class="dh-use" title="Mở bóc tách bản này" onclick="pickProject(\''+esc(p.maDA)+'\')">Dùng</button>')
      +'<button class="dh-ic" title="Sửa tên bản nháp" onclick="renameDraft(\''+esc(p.maDA)+'\')">'+icon('edit',13)+'</button>'
      +'<button class="dh-ic" title="Nhân bản bản nháp" onclick="duplicateDraft(\''+esc(p.maDA)+'\')">'+icon('copy',13)+'</button>'
      +'<button class="dh-ic del" title="Xoá bản nháp" onclick="removeProject(\''+esc(p.maDA)+'\',event)">'+icon('trash',13)+'</button>'
      +'</div></div>';
  }).join('');
  return '<div class="dh-proj">'
    +'<div class="dh-proj-h" onclick="projInfoModal(\''+esc(g.drafts[0].maDA)+'\')" title="Xem thông tin dự án"><span class="dh-proj-ic">'+icon('building',16)+'</span>'
      +'<div class="dh-proj-t"><div class="dh-proj-n">'+esc(g.name)+'</div><div class="dh-proj-m">'+esc(g.khachHang||'Chưa có khách hàng')+(g.sdt?' · '+esc(g.sdt):'')+'</div></div>'
      +(g.linkDezon?'<a class="dh-dezon" href="'+esc(dezonUrl_(g.linkDezon))+'" target="_blank" rel="noopener" title="Mở bài dự án trên dezon.vn" onclick="event.stopPropagation()">'+icon('link',12)+'<span>Dezon</span></a>':'')
      +'<span class="dh-proj-c">'+g.drafts.length+' bản</span></div>'
    +'<button class="proj-del" title="Xoá cả dự án này (mọi bản nháp)" onclick="removeProjectGroup(\''+esc(g.drafts[0].maDA)+'\',event)">'+icon('trash',13)+'</button>'
    +'<div class="dh-drafts">'+drafts+'</div>'
    +'<button class="dh-adddraft" onclick="addDraft(\''+esc(g.drafts[0].maDA)+'\')">'+icon('plus',13)+' Thêm bản nháp</button></div>';
}
/* Chọn cột — dùng chung mẫu nút + bảng chọn cho tab Chi phí và tab Dự án */
function colPopMake_(id,btnId,title,keys,isOn,onToggle,onAll){
  var pop=document.getElementById(id);
  function render(){
    var p=document.getElementById(id); if(!p) return;
    var on=keys.filter(isOn).length;
    p.innerHTML='<div class="colpop-h"><b>'+esc(title)+'</b><span class="colpop-n">'+on+'/'+keys.length+'</span>'
        +'<button class="colpop-x" onclick="colPopClose_(\''+id+'\')">✕</button></div>'
      +'<div class="colpop-b">'+keys.map(function(k){
          return '<label class="colpop-i"><input type="checkbox" '+(isOn(k)?'checked':'')
            +' onchange="'+onToggle+'(\''+k+'\');colPopRefresh_(\''+id+'\')"><span>'+esc(cpLabel_(k))+'</span></label>';
        }).join('')+'</div>'
      +'<div class="colpop-f"><button class="btn ghost xs" onclick="'+onAll+'(1);colPopRefresh_(\''+id+'\')">Hiện tất cả</button>'
        +'<button class="btn ghost xs" onclick="'+onAll+'(0);colPopRefresh_(\''+id+'\')">Chỉ cột cơ bản</button></div>';
  }
  S._colPopRender=S._colPopRender||{}; S._colPopRender[id]=render;
  if(pop){ colPopClose_(id); return; }
  pop=document.createElement('div'); pop.className='fltpop colpop'; pop.id=id;
  document.body.appendChild(pop); render();
  var btn=document.getElementById(btnId);
  if(btn){ var r=btn.getBoundingClientRect(), w=pop.offsetWidth||300;
    pop.style.top=(r.bottom+6)+'px'; pop.style.left=Math.max(8,Math.min(r.left, window.innerWidth-w-10))+'px'; }
  S._colPopBtn=S._colPopBtn||{}; S._colPopBtn[id]=btnId;
  setTimeout(function(){ document.addEventListener('mousedown',colPopOutside_); },0);
}
function colPopRefresh_(id){ var f=(S._colPopRender||{})[id]; if(f) f(); }
function colPopClose_(id){ var p=document.getElementById(id); if(p) p.remove(); document.removeEventListener('mousedown',colPopOutside_); }
function colPopOutside_(e){
  ['cpColPop','daColPop','bgColPop'].forEach(function(id){
    var p=document.getElementById(id); if(!p) return;
    var btnId=(S._colPopBtn||{})[id];
    if(e.target.closest('#'+id)||(btnId&&e.target.closest('#'+btnId))) return;
    colPopClose_(id);
  });
}
function cpColBar_(){
  var on=CP_KEYS.filter(function(k){ return S.cpCols[k]; }).length;
  return '<div class="colchips cp-colchips"><span class="cp-collbl">Cột hiển thị</span>'
    +CP_KEYS.map(function(k){ return '<span class="chip'+(S.cpCols[k]?' on':'')+'" onclick="cpToggle(\''+k+'\')">'+esc(cpLabel_(k))+'</span>'; }).join('')+'</div>';
}
function cpColPop_(e){ if(e&&e.stopPropagation) e.stopPropagation();
  colPopMake_('cpColPop','cpColBtn','Cột hiển thị',CP_KEYS,function(k){ return !!S.cpCols[k]; },'cpToggle','cpColAll_'); }
var CP_COL_CB=['ten','soLuong','giaDaiLy','donGia','thanhTien','lnVnd'];
function cpColAll_(on){ CP_KEYS.forEach(function(k){ S.cpCols[k]= on?true:(CP_COL_CB.indexOf(k)>=0); }); renderChiphi(); }
function daColBar_(){
  var on=DA_KEYS.filter(function(k){ return S._daCols[k]; }).length;
  return '<div class="colchips cp-colchips"><span class="cp-collbl">Cột hiển thị</span>'
    +DA_KEYS.map(function(k){ return '<span class="chip'+(S._daCols[k]?' on':'')+'" onclick="daColToggle(\''+k+'\')">'+esc(cpLabel_(k))+'</span>'; }).join('')+'</div>';
}
function daColPop_(e){ if(e&&e.stopPropagation) e.stopPropagation();
  colPopMake_('daColPop','daColBtn','Cột hiển thị',DA_KEYS,function(k){ return !!(S._daCols&&S._daCols[k]); },'daColToggle','daColAll_'); }
var DA_COL_CB=['ten','soLuong','giaDaiLy','donGia','thanhTien','hinhAnh'];
function daColAll_(on){ S._daCols=S._daCols||{}; DA_KEYS.forEach(function(k){ S._daCols[k]= on?true:(DA_COL_CB.indexOf(k)>=0); }); renderDuAn(); }
function dashSearch_(v){ S._dashSearch=v; var grid=document.getElementById('dhProjGrid'); if(grid) grid.innerHTML=dashProjCards_(S._projGroups||projectGroups()); }

/* ===== CHI PHÍ (bảng linh hoạt + chip chọn cột) ===== */
function cpToggle(k){ S.cpCols=S.cpCols||{}; S.cpCols[k]=!S.cpCols[k]; renderChiphi(); }
function cpColsToggle(){ S._cpColsOpen=!S._cpColsOpen; renderChiphi(); }
function cpSigned_(v){ v=Math.round(Number(v)||0); return '<span class="'+(v<0?'cp-neg':(v>0?'cp-pos':''))+'">'+money(v)+'</span>'; }
function cpKpi_(ic,label,val,cls){ return '<div class="cp-kpi '+(cls||'')+'"><span class="cp-kpi-ic">'+ic+'</span><div class="cp-kpi-t"><div class="cp-kpi-v">'+val+'</div><div class="cp-kpi-l">'+label+'</div></div></div>'; }
// Bảng Chi phí dùng ĐÚNG key cột + cellInput của Bóc tách -> giao diện/hành vi ô y hệt
var CP_KEYS=['ten','dvt','soLuong','giaNCC','chietKhau','giaDaiLy','lnPct','donGia','ckKhach','donGiaCK','markup','margin','lnVnd','thanhTien'];
function cpLabel_(k){ var c=COLS.filter(function(x){return x[0]===k;})[0]; return c?c[1]:k; }
// Ô tab Chi phí: giống cellInput của Bóc tách, RIÊNG cột Tên bỏ nút ⌕ chọn/tạo SP
function cpCell_(l,k){
  if(k==='ten') return '<td class="td-ten" data-k="ten"><input class="cin" value="'+esc(l.ten||'')+'" onchange="editLine(\''+l.lineId+'\',{ten:this.value})"></td>';
  return tdK_(cellInput(l,k),k);
}
function renderChiphi(){
  var box=document.getElementById('v-chiphi'); if(!box) return;
  if(!S.cur){ box.innerHTML='<div class="sechd"><h2>Chi phí</h2></div>'
    +'<div class="cp-empty">'+icon('money',30)+'<b>Chưa chọn dự án</b>'
    +'<span>Vào <b>Bảng điều khiển</b> chọn hoặc tạo một dự án để xem bảng chi phí.</span></div>'; return; }
  if(!S.cpCols) S.cpCols={ten:1,dvt:1,soLuong:1,giaNCC:1,chietKhau:1,giaDaiLy:1,lnPct:1,donGia:1,thanhTien:1,lnVnd:1};
  if(S._cpGroup===undefined) S._cpGroup=true;
  var keys=CP_KEYS.filter(function(k){ return S.cpCols[k]; });
  var rows=cpRows_();

  /* ---- số liệu tổng: tính trên ĐÚNG HẠNG MỤC đang chọn (phạm vi của cả trang),
     không phụ thuộc ô tìm kiếm / chip lọc trạng thái (những cái đó chỉ là lọc tạm). ---- */
  var hmNow=hmGet_();
  var scope=hmNow?(S.lines||[]).filter(function(l){ var c=String(l.nhom||'');
      return c===hmNow || c.indexOf(hmNow+'.')===0; }):(S.lines||[]);
  var von=0,ban=0; scope.forEach(function(l){ von+=ttVon_(l); ban+=ttBan_(l); });
  var lnT=ban-von, bien=ban>0?(lnT/ban*100):0, lnCls=lnT<0?'red':(lnT>0?'green':'');
  var vatPct=Number(S.cur.vat)||0, vat=Math.round(ban*vatPct/100);
  var stat='<div class="cp-kpis">'
    +cpKpi_(icon('lock',17),'Giá trị vốn',money(von)+' đ','')
    +cpKpi_(icon('money',17),'Tổng giá bán',money(ban)+' đ','blue')
    +cpKpi_(icon('gauge',17),'Lợi nhuận',money(lnT)+' đ',lnCls)
    +cpKpi_(icon('gauge',17),'Biên lợi nhuận',bien.toFixed(1)+'%',lnCls)
    +cpKpi_(icon('cart',17),'Tổng gồm VAT '+vatPct+'%',money(ban+vat)+' đ','')+'</div>';

  box.innerHTML='<div class="sechd"><h2>Chi phí</h2><span class="count">'+scope.length+'</span>'
      +'<span class="sp" style="flex:1"></span>'
      +'<span class="cp-hint">'+icon('sliders',13)+' Bấm thẳng vào ô để sửa giá NCC · CK · %LN · giá bán — số tính lại ngay</span></div>'
    +stat+hmPTNote_()
    +cpToolbar_(rows, scope)
    +'<div class="dbcard cp-card">'+cpTableHtml_(keys,rows)+'</div>'
    +'<div class="tk-hbar cp-hbar" id="cpHBar" style="display:none"><div class="tk-hthumb" id="cpHThumb"></div></div>';
  markBlocks_('#v-chiphi table.cpflat');
  hbarBind_('#v-chiphi .cp-card .tbl-wrap','cpHBar','cpHThumb');
  // dòng tiêu đề nhóm dính NGAY DƯỚI hàng tiêu đề cột (chiều cao hàng này thay đổi theo số cột)
  var tb=document.querySelector('#v-chiphi table.cpflat'), th0=tb&&tb.querySelector('th');
  if(tb&&th0) tb.style.setProperty('--cpTh', th0.offsetHeight+'px');
}
/* ---------- dữ liệu bảng: tìm kiếm · lọc · sắp xếp ---------- */
function cpRows_(){
  var q=spNorm_(S._cpQ||''), f=S._cpFlt||'', hm=hmGet_();
  var out=(S.lines||[]).filter(function(l){
    if(hm){ var c=String(l.nhom||''); if(!(c===hm || c.indexOf(hm+'.')===0)) return false; }   // hạng mục dùng chung
    if(q && spNorm_([l.ten,l.maSP,l.thuongHieu,l.ncc,l.khuVuc].join(' ')).indexOf(q)<0) return false;
    if(f==='lo'  && (ttBan_(l)-ttVon_(l))>=0) return false;
    if(f==='chuaGia' && Number(l.donGiaBan)>0) return false;
    if(f==='chuaVon' && Number(l.donGiaVon)>0) return false;
    return true;
  });
  var sk=S._cpSort, dir=(S._cpSortDir==='desc')?-1:1;
  if(sk) out=out.slice().sort(function(a,b){
    var x=cpSortVal_(a,sk), y=cpSortVal_(b,sk);
    if(typeof x==='number'&&typeof y==='number') return (x-y)*dir;
    return String(x).localeCompare(String(y),'vi')*dir;
  });
  return out;
}
function cpSortVal_(l,k){
  switch(k){
    case 'soLuong': return Number(l.soLuong)||0;
    case 'giaNCC': return Number(l.donGiaVon)||0;
    case 'chietKhau': return Number(l.chietKhau)||0;
    case 'giaDaiLy': return giaDaiLy_(l);
    case 'lnPct': return Number(l.lnPct)||0;
    case 'donGia': return Number(l.donGiaBan)||0;
    case 'ckKhach': return Number(l.ckKhach)||0;
    case 'donGiaCK': return donGiaCK_(l);
    case 'markup': return markup_(l);
    case 'margin': return margin_(l);
    case 'lnVnd': return lnVnd_(l);
    case 'thanhTien': return Number(l.thanhTienBan)||0;
    default: return String(l[k]||'');
  }
}
function cpSort(k){
  if(S._cpSort!==k){ S._cpSort=k; S._cpSortDir='asc'; }
  else if(S._cpSortDir==='asc'){ S._cpSortDir='desc'; }
  else { S._cpSort=''; S._cpSortDir='asc'; }
  renderChiphi();
}
function cpSetQ(v){ S._cpQ=v; renderChiphi();
  var i=document.getElementById('cpQ'); if(i){ i.focus(); i.setSelectionRange(i.value.length,i.value.length); } }
function cpSetFlt(v){ S._cpFlt=(S._cpFlt===v)?'':v; renderChiphi(); }
function cpToggleGroup(){ S._cpGroup=!S._cpGroup; renderChiphi(); }
/* ---------- thanh công cụ ---------- */
/* Phần thô (3.1) có bảng riêng, số liệu nằm ở tab Bóc tách chứ không nằm trong
   danh sách dòng của dự án -> các trang đọc S.lines sẽ trống. Báo rõ cho người dùng
   thay vì để bảng rỗng không lời giải thích. */
function hmPTNote_(){
  if(hmGet_()!=='3.1') return '';
  return '<div class="hm-note">'+icon('layers',15)
    +'<span><b>Hạng mục Phần thô</b> có bảng ước tính riêng — số liệu không nằm trong danh sách dòng của trang này. '
    +'Xem và sửa ở tab <b>Bóc tách</b>, hoặc chọn hạng mục khác ở ô bên trên.</span>'
    +'<button class="btn ghost xs" onclick="showTab(\'boc\')">Mở Bóc tách</button></div>';
}
function cpToolbar_(rows, scope){
  // Đếm trên ĐÚNG phạm vi hạng mục đang xem — trước đây đếm cả dự án nên chip ghi
  // "Tất cả 3" trong khi bảng chỉ có 2 dòng, bấm "Đang lỗ 1" lại ra bảng rỗng.
  scope=scope||(S.lines||[]);
  var soLo=scope.filter(function(l){ return (ttBan_(l)-ttVon_(l))<0; }).length;
  var soChuaGia=scope.filter(function(l){ return !(Number(l.donGiaBan)>0); }).length;
  var soChuaVon=scope.filter(function(l){ return !(Number(l.donGiaVon)>0); }).length;
  function chip(k,nhan,n,cls){
    if(!n && k) return '';
    return '<button class="cpchip'+(S._cpFlt===k?' on':'')+(cls?' '+cls:'')+'" onclick="cpSetFlt(\'' +k+ '\')">'
      +esc(nhan)+(n!=null?'<i>'+n+'</i>':'')+'</button>';
  }
  var loc='<div class="cp-flt">'
    +'<button class="cpchip'+(!S._cpFlt?' on':'')+'" onclick="cpSetFlt(\'\')">Tất cả<i>'+scope.length+'</i></button>'
    +chip('lo','Đang lỗ',soLo,'warn')
    +chip('chuaGia','Chưa có giá bán',soChuaGia)
    +chip('chuaVon','Chưa có giá vốn',soChuaVon)
    +'</div>';
  var tim='<div class="cp-search">'+icon('search',14)
    +'<input id="cpQ" value="'+esc(S._cpQ||'')+'" placeholder="Tìm tên · mã · thương hiệu · phòng…" oninput="cpSetQ(this.value)">'
    +((S._cpQ||'')?'<button class="cp-x" title="Xoá tìm kiếm" onclick="cpSetQ(\'\')">✕</button>':'')+'</div>';
  var ket=(S._cpQ||S._cpFlt)?('<span class="cp-found">'+rows.length+' / '+scope.length+' dòng</span>'):'';
  var hmBtn=hmSelect_('cpHmBtn');
  return '<div class="cp-bar">'+tim+loc+ket+'<span style="flex:1"></span>'+hmBtn
    +'<button class="btn ghost sm'+(S._cpGroup?' on':'')+'" onclick="cpToggleGroup()" title="Gom các dòng theo hạng mục và cộng tổng từng nhóm">'
      +icon('layers',14)+' Gom theo hạng mục</button>'
    +'</div>'
    +cpColBar_()
    +(cpLnBulkHien_()?cpLnQuick_():'');
}
/* ---------- bảng ---------- */
function cpAlign_(k){
  var numK=['soLuong','giaNCC','giaDaiLy','donGia','donGiaCK','lnVnd','thanhTien'];
  var ctK=['dvt','chietKhau','lnPct','ckKhach','markup','margin'];
  return numK.indexOf(k)>=0?'num':(ctK.indexOf(k)>=0?'ct':'');
}
function cpTotOf_(list){
  var von=0,ban=0,sl=0; list.forEach(function(l){ von+=ttVon_(l); ban+=ttBan_(l); sl+=Number(l.soLuong)||0; });
  return {von:von,ban:ban,ln:ban-von,sl:sl,n:list.length};
}
function cpCellTot_(k,t,ncol){
  if(k==='ten') return '<td><b>'+(t.nhan||('TỔNG · '+t.n+' hạng mục'))+'</b></td>';
  if(k==='soLuong') return '<td class="num"><b>'+ptQty(t.sl)+'</b></td>';
  if(k==='giaDaiLy') return '<td class="num"><b>'+money(t.von)+'</b></td>';
  if(k==='lnVnd') return '<td class="num">'+cpSigned_(t.ln)+'</td>';
  if(k==='thanhTien') return '<td class="num"><b class="cp-strong">'+money(t.ban)+'</b></td>';
  return '<td class="'+cpAlign_(k)+'"></td>';
}
function cpTableHtml_(keys,rows){
  var ncol=keys.length+1;
  var totalW=58+keys.reduce(function(s,k){ return s+colW(k); },0);
  var colg='<colgroup><col style="width:58px">'+keys.map(function(k){ return '<col style="width:'+colW(k)+'px">'; }).join('')+'</colgroup>';
  var head='<tr><th class="ct">STT</th>'+keys.map(function(k){
      var on=S._cpSort===k, ar=on?(S._cpSortDir==='desc'?' ▼':' ▲'):'';
      return '<th class="thk '+cpAlign_(k)+(on?' sortOn':'')+'" data-k="'+k+'">'
        +'<span class="thl" onclick="cpSort(\''+k+'\')" title="Bấm để sắp xếp">'+esc(cpLabel_(k))+ar+'</span>'
        +'<span class="thrsz" data-k="'+k+'"></span></th>'; }).join('')+'</tr>';
  var body='';
  if(!S.lines.length){
    body='<tr><td class="empty" colspan="'+ncol+'">Chưa có hạng mục nào. Vào tab <b>Bóc tách</b> để thêm sản phẩm.</td></tr>';
  } else if(!rows.length){
    body='<tr><td class="empty" colspan="'+ncol+'">Không có dòng nào khớp bộ lọc. '
      +'<button class="btn ghost xs" onclick="S._cpQ=\'\';S._cpFlt=\'\';renderChiphi()">Xoá lọc</button></td></tr>';
  } else if(S._cpGroup){
    var by={}, ord=[];
    rows.forEach(function(l){ var c=(l.nhom||'').trim()||'__k'; if(!by[c]){ by[c]=[]; ord.push(c); } by[c].push(l); });
    ord.forEach(function(code,gi){
      var list=by[code], t=cpTotOf_(list), ten=(code==='__k'?'Chưa xếp hạng mục':(nodeName(code)||code));
      body+='<tr class="grp cp-grp"><td colspan="'+ncol+'">'
        +'<span class="gname">'+(ROMAN_[gi]||(gi+1))+'. '+esc(ten)+'</span>'
        +'<span class="cp-gn">'+list.length+' dòng</span>'
        +'<span class="gsum">Vốn <b>'+money(t.von)+'</b> · Bán <b>'+money(t.ban)+'</b> · LN '+cpSigned_(t.ln)+'</span>'
        +'</td></tr>';
      list.forEach(function(l,ri){ body+=cpRowHtml_(l,keys,(gi+1)+'.'+(ri+1)); });
      if(ord.length>1){          // 1 nhóm duy nhất thì dòng cộng nhóm trùng dòng TỔNG -> bỏ cho gọn
        body+='<tr class="cp-sub"><td class="ct"></td>'
          +keys.map(function(k){ return cpCellTot_(k, Object.assign({nhan:'Cộng '+esc(ten)},t)); }).join('')+'</tr>';
        body+='<tr class="tk-spacer"><td colspan="'+ncol+'"></td></tr>';
      }
    });
  } else {
    rows.forEach(function(l,ri){ body+=cpRowHtml_(l,keys,ri+1); });
  }
  var foot='';
  if(rows.length){ var T=cpTotOf_(rows);
    foot='<tr class="cp-foot"><td class="ct"></td>'
      +keys.map(function(k){ return cpCellTot_(k,T); }).join('')+'</tr>'; }
  return '<div class="tbl-wrap"><table class="tk cpflat" style="min-width:'+totalW+'px;width:100%">'
    +colg+head+body+foot+'</table></div>';
}
function cpRowHtml_(l,keys,stt){
  var ln=ttBan_(l)-ttVon_(l);
  var cls=(ln<0?' cp-rowneg':'')+(Number(l.donGiaBan)>0?'':' cp-rownogia');
  return '<tr class="drow'+cls+'" data-id="'+l.lineId+'"><td class="ct">'+stt+'</td>'
    +keys.map(function(k){ return cpCell_(l,k); }).join('')+'</tr>';
}

/* ===== DỰ ÁN — Sản phẩm trong dự án (gom theo tầng, y kiểu Bóc tách) ===== */
var DA_KEYS=['khuVuc','maBanVe','nganh','maSP','ten','thuongHieu','ncc','moTa','kichThuoc','hinhAnh','dvt','soLuong','giaNCC','chietKhau','giaDaiLy','lnPct','donGia','thanhTien'];
function daColToggle(k){ S._daCols=S._daCols||{}; S._daCols[k]=!S._daCols[k]; renderDuAn(); }
// kéo đổi vị trí cột (tab Dự án)
function daColDragStart(e,k){ if(e.target&&e.target.closest&&e.target.closest('.thrsz')){ e.preventDefault(); return; } S._daDragK=k; try{ e.dataTransfer.setData('text/plain',k); }catch(x){} }
function daColDrop(e,k){ e.preventDefault(); var from=S._daDragK; S._daDragK=null; if(!from||from===k) return;
  var ord=(S._daOrder||DA_KEYS.slice()).filter(function(x){ return x!==from; });
  var idx=ord.indexOf(k); if(idx<0) idx=ord.length; ord.splice(idx,0,from); S._daOrder=ord; renderDuAn(); }
// cập nhật rộng cột trực tiếp cho các bảng .cpflat khi kéo mép (dùng chung S.colW)
function cpflatColW_(k,w){
  document.querySelectorAll('table.cpflat').forEach(function(t){
    var ths=t.querySelectorAll('tr:first-child th'), cols=t.querySelectorAll('colgroup col');
    for(var i=0;i<ths.length;i++){ if(ths[i].getAttribute('data-k')===k){ if(cols[i]) cols[i].style.width=w+'px'; break; } }
    var total=0; cols.forEach(function(c){ total+=parseFloat(c.style.width)||0; });
    if(total){ if(t.style.minWidth) t.style.minWidth=total+'px'; else t.style.width=total+'px'; }
  });
}
function renderDuAn(){
  var box=document.getElementById('v-duan'); if(!box) return;
  if(!S.cur){ box.innerHTML='<div class="sechd"><h2>Sản phẩm trong dự án</h2></div>'
    +'<div class="empty" style="padding:30px;text-align:center;background:#fff;border:1px solid var(--line);border-radius:14px">Chưa chọn dự án. Vào <b>Bảng điều khiển</b> để chọn/tạo dự án.</div>'; return; }
  if(!S._daCols) S._daCols={khuVuc:1,ten:1,thuongHieu:1,moTa:1,kichThuoc:1,hinhAnh:1,dvt:1,soLuong:1,donGia:1,thanhTien:1};
  if(!S._daOrder) S._daOrder=DA_KEYS.slice();
  DA_KEYS.forEach(function(k){ if(S._daOrder.indexOf(k)<0) S._daOrder.push(k); });   // đồng bộ nếu DA_KEYS thêm cột mới
  var keys=S._daOrder.filter(function(k){ return S._daCols[k]; });
  // Lọc theo HẠNG MỤC đang chọn (dùng chung với các tab khác) — KPI, bảng, dòng tổng đều theo đây
  var hmNow=hmGet_();
  var daLines_=hmNow?(S.lines||[]).filter(function(l){ var c=String(l.nhom||'');
      return c===hmNow || c.indexOf(hmNow+'.')===0; }):(S.lines||[]);
  var numK=['soLuong','giaNCC','giaDaiLy','donGia','donGiaCK','lnVnd','thanhTien'], ctK=['maBanVe','nganh','hinhAnh','dvt','chietKhau','lnPct','ckKhach','markup','margin'];
  function alignCls(k){ return numK.indexOf(k)>=0?'num':(ctK.indexOf(k)>=0?'ct':''); }
  var ban=0; daLines_.forEach(function(l){ ban+=ttBan_(l); });
  var vat=Math.round(ban*(Number(S.cur.vat)||0)/100);
  // KPI
  var stat='<div class="cp-kpis">'
    +cpKpi_(icon('list',17),'Số sản phẩm',daLines_.length,'blue')
    +cpKpi_(icon('layers',17),'Tổng số lượng',daLines_.reduce(function(s,l){return s+(Number(l.soLuong)||0);},0),'')
    +cpKpi_(icon('money',17),'Tổng giá bán',money(ban)+' đ','blue')
    +cpKpi_(icon('gauge',17),'Tổng gồm VAT',money(ban+vat)+' đ','green')+'</div>';
  // chip chọn cột (hiện sẵn)
  var colbar=daColBar_();
  // bảng
  var ncol=keys.length+1;
  var totalW=64+keys.reduce(function(s,k){ return s+colW(k); },0);
  var colg='<colgroup><col style="width:64px">'+keys.map(function(k){ return '<col style="width:'+colW(k)+'px">'; }).join('')+'</colgroup>';
  var head='<tr><th class="ct">STT</th>'+keys.map(function(k){
      return '<th class="thk '+alignCls(k)+'" data-k="'+k+'" draggable="true" title="Kéo để đổi vị trí cột · kéo mép phải để chỉnh rộng"'
        +' ondragstart="daColDragStart(event,\''+k+'\')" ondragover="event.preventDefault()" ondrop="daColDrop(event,\''+k+'\')">'
        +'<span class="thl">'+esc(cpLabel_(k))+'</span><span class="thrsz" data-k="'+k+'"></span></th>'; }).join('')+'</tr>';
  var groups={}; daLines_.forEach(function(l){ var g=(l.tang||'').trim()||'CHƯA PHÂN TẦNG'; (groups[g]=groups[g]||[]).push(l); });
  var order=floorsList().slice(); Object.keys(groups).forEach(function(g){ if(order.indexOf(g)<0) order.push(g); });
  order=order.filter(function(g){ return groups[g]&&groups[g].length; });
  var spacer='<tr class="tk-spacer"><td colspan="'+ncol+'"></td></tr>';
  var body='';
  if(!daLines_.length){ body='<tr><td class="empty" colspan="'+ncol+'">Chưa có sản phẩm. Vào <b>Danh sách sản phẩm</b> bấm ＋ để ghi danh, hoặc <b>Bóc tách</b> để thêm.</td></tr>'; }
  order.forEach(function(g,gi){
    var roman=['I','II','III','IV','V','VI','VII','VIII','IX','X'][gi]||(gi+1);
    var gsum=(groups[g]||[]).reduce(function(s,l){ return s+ttBan_(l); },0);
    body+='<tr class="grp"><td colspan="'+ncol+'"><span class="gname">'+roman+'. '+esc(g)+'</span><span class="gsum">Tổng tầng: <b>'+money(gsum)+' đ</b></span></td></tr>'+spacer;
    (groups[g]||[]).forEach(function(l,ri){
      body+='<tr class="drow'+(ri%2===0?' alt':'')+'" data-id="'+l.lineId+'"><td class="ct">'+(gi+1)+'.'+(ri+1)+'</td>'
        +keys.map(function(k){ return cpCell_(l,k); }).join('')+'</tr>';
    });
    body+=spacer;
  });
  var foot='';
  if(daLines_.length){ foot='<tr class="cp-foot"><td class="ct"></td>'+keys.map(function(k,ki){
      if(ki===0) return '<td class="'+alignCls(k)+'"><b>TỔNG · '+daLines_.length+' SP</b></td>';
      if(k==='thanhTien') return '<td class="num"><b class="cp-strong">'+money(ban)+'</b></td>';
      if(k==='soLuong') return '<td class="num"><b>'+daLines_.reduce(function(s,l){return s+(Number(l.soLuong)||0);},0)+'</b></td>';
      return '<td class="'+alignCls(k)+'"></td>';
    }).join('')+'</tr>'; }
  box.innerHTML='<div class="sechd"><h2>Sản phẩm trong dự án</h2><span class="count">'+daLines_.length+'</span><span class="sp" style="flex:1"></span>'
      +hmSelect_('daHmBtn')
      +'<span class="cp-hint">'+icon('building',13)+' '+esc(S.cur.ten||'')+' — bấm ô để sửa</span></div>'
    +stat+hmPTNote_()+colbar
    +'<div class="dbcard cp-card"><div class="tbl-wrap"><table class="tk cpflat" style="min-width:'+totalW+'px;width:100%">'+colg+head+body+foot+'</table></div></div>';
  markBlocks_('#v-duan table.cpflat');
}

/* ===== MUA HÀNG (gom theo Nhà cung cấp) ===== */
function mhPrice(l){ return giaDaiLy_(l)||Number(l.donGiaVon)||Number(l.donGiaBan)||0; }
// Giảm giá từ NCC (%) theo dòng -> lưu TRÊN DÒNG (giamGiaNcc) nên copy theo khi nhân bản
function mhDisc_(l){ return Math.max(0,Math.min(100,Number(l.giamGiaNcc)||0)); }
function mhPriceCK_(l){ return Math.round(mhPrice(l)*(1-mhDisc_(l)/100)); }
function mhSub_(items){ return items.reduce(function(a,l){ return a+(Number(l.soLuong)||0)*mhPriceCK_(l); },0); }  // tổng = giá SAU chiết khấu
function mhTot_(items,vatPct){ var s=mhSub_(items); return s+Math.round(s*vatPct/100); }
function mhSetDisc(lineId,v){ var l=(S.lines||[]).filter(function(x){return x.lineId===lineId;})[0]; if(!l) return;
  var p=Math.max(0,Math.min(100,Number(v)||0)); l.giamGiaNcc=p; renderMuahang();
  api('updateLine',lineId,{giamGiaNcc:p}).catch(function(){}); }
function mhSetDiscAll(gi,v){ var g=(S._mhGroups||[])[gi]; if(!g) return; var p=Math.max(0,Math.min(100,Number(v)||0));
  g.items.forEach(function(l){ l.giamGiaNcc=p; api('updateLine',l.lineId,{giamGiaNcc:p}).catch(function(){}); }); renderMuahang(); }
function mhOn_(ncc){ return !(S._mhSel&&S._mhSel[ncc]===false); }
/* Thẻ NCC — dùng lại frontend thẻ của trang Nhập dữ liệu (.dbcard + icon chip) */
function muahangCard(g, gi, vatPct){
  var ncc=g.ncc, items=g.items, sub=0;
  var rows=items.map(function(l,i){
    var dg=mhPrice(l), sl=Number(l.soLuong)||0, ttGoc=sl*dg;
    var pct=mhDisc_(l), ttCK=sl*mhPriceCK_(l); sub+=ttCK;
    var im=String(l.hinhAnh||'').split('\n')[0];
    var img=im?'<img class="mhp-img" src="'+esc(imgUrlOf(im))+'" onerror="this.style.visibility=\'hidden\'">':'<span class="mhp-img ph"></span>';
    var mo=String(l.moTa||'').trim(), kt=String(l.kichThuoc||'').trim();
    // mô tả và kích thước hay lặp nhau -> chỉ nối phần thật sự mới
    var spec=(mo+(kt && spNorm_(mo).indexOf(spNorm_(kt))<0 ? (mo?' · ':'')+kt : '')).replace(/\s+/g,' ').trim();
    var sub2=[l.khuVuc,l.thuongHieu].map(function(x){return String(x||'').trim();}).filter(Boolean).join(' · ');
    return '<tr>'
      +'<td class="c mut">'+(gi+1)+'.'+(i+1)+'</td>'
      +'<td class="c">'+img+'</td>'
      +'<td class="mhp-cell" title="Bấm để xem thông tin sản phẩm" onclick="mhProdModal_(\''+l.lineId+'\')">'
        +'<div class="mhp-name">'+esc(l.ten||'')+icon('eye',12)+'</div>'
        +(sub2?'<div class="mhp-sub">'+esc(sub2)+'</div>':'')
        +(spec?'<div class="mhp-spec">'+esc(spec)+'</div>':'')+'</td>'
      +'<td class="c">'+esc(l.dvt||'Cái')+'</td>'
      +'<td class="c b">'+sl+'</td>'
      +'<td class="n">'+money(dg)+'</td>'
      +'<td class="n b">'+money(ttGoc)+'</td>'
      +'<td class="c"><span class="mh-discwrap dx"><input class="mh-disc" type="number" min="0" max="100" value="'+(mhDx_(l)||'')+'" placeholder="0" onchange="mhSetDx(\''+l.lineId+'\',this.value)" title="Mức giảm giá phòng mua hàng đề xuất với nhà cung cấp"><i>%</i></span></td>'
      +'<td class="c"><span class="mh-discwrap"><input class="mh-disc" type="number" min="0" max="100" value="'+(pct||'')+'" placeholder="0" onchange="mhSetDisc(\''+l.lineId+'\',this.value)"><i>%</i></span></td>'
      +'<td class="n b mh-ttck">'+money(ttCK)+'</td></tr>';
  }).join('');
  var vat=Math.round(sub*vatPct/100), tot=sub+vat, on=mhOn_(ncc);
  return '<div class="dbcard mhc'+(on?' sel':'')+'">'
    +'<div class="dbcard-h mhc-h">'
      +'<span class="dbcard-ic">'+icon('building',18)+'</span>'
      +'<h3>'+esc(ncc)+'</h3><span class="mhc-badge">'+items.length+' SP</span>'
      +'<span class="sp" style="flex:1"></span>'
      +'<span class="mhc-tot">'+money(tot)+' đ</span>'
      +'<span class="mhc-chk'+(on?' on':'')+'" onclick="mhToggle('+gi+')" title="Chọn để gửi hàng loạt">'+icon('check',13)+'</span>'
    +'</div>'
    +'<div class="dbcard-b mhc-b">'
      +'<div class="mh-scroll"><table class="mh-tbl2">'
        +'<thead><tr><th class="c">#</th><th class="c">Ảnh</th><th>Sản phẩm</th><th class="c">ĐVT</th><th class="c">SL</th><th class="n">Đơn giá</th><th class="n">Thành tiền</th>'
          +'<th class="c mh-disc-th dx-th" title="Mức giảm giá phòng mua hàng đề xuất với nhà cung cấp">Đề xuất giảm (%)'
            +'<span class="mh-bulk"><input type="number" min="0" max="100" placeholder="%" onchange="mhSetDxAll('+gi+',this.value)" title="Đề xuất % cho tất cả dòng"></span></th>'
          +'<th class="c mh-disc-th" title="Mức giảm giá nhà cung cấp đã chốt">Giảm giá NCC (%)'
            +'<span class="mh-bulk"><input type="number" min="0" max="100" placeholder="%" onchange="mhSetDiscAll('+gi+',this.value)" title="Áp dụng % cho tất cả dòng"></span></th>'
          +'<th class="n">Thành tiền sau CK</th></tr></thead>'
        +'<tbody>'+(rows||'<tr><td colspan="10" class="empty">—</td></tr>')+'</tbody>'
        +'<tfoot><tr class="mhf-vat"><td colspan="8"></td><td class="n">VAT '+vatPct+'%</td><td class="n">'+money(vat)+'</td></tr>'
        +'<tr class="mhf-tot"><td colspan="8"></td><td class="n">TỔNG</td><td class="n">'+money(tot)+'</td></tr></tfoot>'
      +'</table></div>'
      +mhPayHtml_(g,gi,tot)
      +'<div class="mhc-f">'
        +(mhDxSum_(items)?'<button class="btn amber sm" onclick="mhSendDx('+gi+',this)" title="Gửi mức chiết khấu phòng mua hàng đề xuất cho nhà cung cấp">'+icon('gauge',15)+' Gửi yêu cầu chiết khấu đề xuất</button>':'')
        +'<span style="flex:1"></span>'
        +'<button class="btn navy sm" onclick="mhSend('+gi+',this)">'+icon('cart',15)+' Gửi mua hàng NCC này</button>'
      +'</div>'
    +'</div></div>';
}
/* Panel tổng hợp bên phải — dùng lại .imp-recent của trang Nhập dữ liệu */
function mhSummary(groups, vatPct, grand){
  var rows=groups.map(function(g,gi){
    var tot=mhTot_(g.items,vatPct), on=mhOn_(g.ncc);
    return '<div class="mhs-row'+(on?'':' off')+'" onclick="mhToggle('+gi+')">'
      +'<span class="mhs-chk'+(on?' on':'')+'">'+icon('check',12)+'</span>'
      +'<div class="mhs-mid"><div class="mhs-name">'+esc(g.ncc)+'</div><div class="mhs-sub">'+g.items.length+' SP</div></div>'
      +'<div class="mhs-tot">'+money(tot)+'</div></div>';
  }).join('') || '<div class="empty" style="padding:20px 14px;font-size:12.5px">Chưa có nhà cung cấp.</div>';
  var nSel=groups.filter(function(g){return mhOn_(g.ncc);}).length;
  var mi=S._mhInfo||(S._mhInfo={});
  return '<div class="imp-recent mhsum">'
    +'<div class="imp-recent-h">'+icon('cart',15)+' Tổng hợp đơn <span class="count">'+pad2(groups.length)+'</span></div>'
    +'<div class="imp-recent-b">'+rows+'</div>'
    +'<div class="mhsum-info">'
      +'<div class="field"><label>Người gửi <span style="color:#c33">*</span></label><input id="mhNguoiGui" placeholder="Tên người gửi" value="'+esc(mi.nguoiGui||'')+'" oninput="mhInfo(\'nguoiGui\',this.value)"></div>'
      +'<div class="field"><label>Phòng ban <span style="color:#c33">*</span></label><input id="mhPhongBan" placeholder="VD: Mua hàng / Kỹ thuật" value="'+esc(mi.phongBan||'')+'" oninput="mhInfo(\'phongBan\',this.value)"></div>'
      +'<div class="field"><label>Ghi chú</label><textarea id="mhGhiChu" placeholder="Ghi chú cho đơn…" oninput="mhInfo(\'ghiChu\',this.value)">'+esc(mi.ghiChu||'')+'</textarea></div>'
    +'</div>'
    +'<div class="mhsum-f">'
      +'<div class="mhsum-grand"><span>Tổng cộng (VAT)</span><b>'+money(grand)+' đ</b></div>'
      +'<button class="btn navy" style="width:100%;justify-content:center" onclick="mhSendBulk(this)"'+(groups.length?'':' disabled')+'>'+icon('cart',15)+' Gửi '+nSel+' đơn đã chọn</button>'
    +'</div></div>';
}
function mhInfo(k,v){ S._mhInfo=S._mhInfo||{}; S._mhInfo[k]=v; if(v&&v.trim){ var id=k==='nguoiGui'?'mhNguoiGui':(k==='phongBan'?'mhPhongBan':''); if(id){ var e=document.getElementById(id); if(e&&v.trim()) e.classList.remove('need'); } } }
function renderMuahang(){
  var box=document.getElementById('v-muahang');
  if(!S.cur){ box.innerHTML='<div class="empty" style="padding:26px;text-align:center">Chưa chọn dự án.</div>'; return; }
  // Chạy theo HẠNG MỤC dùng chung (trước đây bám S.node nên chọn "Tất cả hạng mục"
  // mà trang vẫn chỉ hiện đúng đề mục đang bóc).
  var code=hmGet_();
  var lines=code?S.lines.filter(function(l){ var c=String(l.nhom||'');
      return c===code || c.indexOf(code+'.')===0; }):(S.lines||[]).slice();
  var vatPct=Number(S.cur.vat)||0;
  var groups={}, order=[];
  lines.forEach(function(l){ var s=String(l.ncc||l.thuongHieu||'Khác').trim()||'Khác'; if(!groups[s]){groups[s]=[];order.push(s);} groups[s].push(l); });
  S._mhGroups=order.map(function(k){ return {ncc:k, items:groups[k]}; });
  // Tổng cộng CHỈ tính các NCC đang được chọn (mhOn_) — khớp với "Gửi N đơn đã chọn"
  var grand=order.reduce(function(sum,k){ return mhOn_(k) ? sum+mhTot_(groups[k],vatPct) : sum; },0);
  function stat(v,l){ return '<div class="imp-stat"><div class="imp-stat-v">'+v+'</div><div class="imp-stat-l">'+l+'</div></div>'; }
  var statbar='<div class="imp-statbar">'
    +hmSelect_('mhHmBtn')
    +stat(pad2(order.length),'Nhà cung cấp')+stat(pad2(lines.length),'Sản phẩm')
    +stat('<span style="color:var(--blue)">'+money(grand)+'</span>','Tổng tiền (VAT)')+'</div>';
  var cards=S._mhGroups.map(function(g,gi){ return muahangCard(g, gi, vatPct); }).join('')
    || '<div class="empty" style="padding:34px;text-align:center;background:#fff;border:1px solid var(--line);border-radius:14px">Chưa có sản phẩm trong hạng mục này.<br>Vào tab <b>Bóc tách</b> thêm sản phẩm trước.</div>';
  box.innerHTML=statbar+hmPTNote_()+'<div class="imp-layout"><div class="mhcol">'+cards+'</div>'
    +'<div class="mhside">'+mhSummary(S._mhGroups,vatPct,grand)+mhDxPanel_()+'</div></div>';
  if(S._mhDxDA!==S.cur.maDA) mhLoadDx_();
}
function mhToggle(gi){ var g=(S._mhGroups||[])[gi]; if(!g) return; S._mhSel=S._mhSel||{}; S._mhSel[g.ncc]=!(S._mhSel[g.ncc]!==false); renderMuahang(); }
function mhOrderOf(g){
  var vatPct=Number(S.cur&&S.cur.vat)||0;
  var sub=g.items.reduce(function(s,l){ return s+(Number(l.soLuong)||0)*mhPriceCK_(l); },0);   // giá SAU chiết khấu
  var vat=Math.round(sub*vatPct/100);
  return { supplier:g.ncc, vatPct:vatPct, vat:vat, total:sub+vat,
    items:g.items.map(function(l){ return {ten:l.ten||'', ma:l.maSP||'', thuongHieu:l.thuongHieu||'', khuVuc:l.khuVuc||'', hinhAnh:String(l.hinhAnh||'').split('\n')[0], sl:Number(l.soLuong)||0, dvt:l.dvt||'Cái', donGia:mhPriceCK_(l), donGiaGoc:mhPrice(l), giamGiaPct:mhDisc_(l)}; }) };
}
function mhBase(){ var mi=S._mhInfo||{}; return { project:S.cur&&S.cur.ten, maDA:S.cur&&S.cur.maDA, khachHang:S.cur&&S.cur.khachHang, sdt:S.cur&&S.cur.sdt, node:S.node, hangMuc:nodeName(S.node), nguoiGui:mi.nguoiGui||'', phongBan:mi.phongBan||'', ghiChu:mi.ghiChu||'' }; }
function mhValidateInfo(){
  var mi=S._mhInfo||{};
  if(!String(mi.nguoiGui||'').trim()){ toast('Nhập "Người gửi" trước khi gửi đơn'); var e=document.getElementById('mhNguoiGui'); if(e){ e.focus(); e.classList.add('need'); } return false; }
  if(!String(mi.phongBan||'').trim()){ toast('Nhập "Phòng ban" trước khi gửi đơn'); var e2=document.getElementById('mhPhongBan'); if(e2){ e2.focus(); e2.classList.add('need'); } return false; }
  return true;
}
function mhSend(gi,btn){
  var g=(S._mhGroups||[])[gi]; if(!g) return;
  if(!mhValidateInfo()) return;
  if(btn){ btn.disabled=true; btn.dataset.t=btn.innerHTML; btn.innerHTML='Đang gửi…'; }
  var payload=Object.assign(mhBase(),{ orders:[mhOrderOf(g)] });
  api('sendPurchaseRequest',payload).then(function(){ toast('✔ Đã gửi yêu cầu mua hàng tới "'+g.ncc+'"'); })
    .catch(function(e){ toast('Lỗi gửi: '+e.message); })
    .then(function(){ if(btn){ btn.disabled=false; btn.innerHTML=btn.dataset.t; } });
}
function mhSendBulk(btn){
  var sel=(S._mhGroups||[]).filter(function(g){ return !(S._mhSel&&S._mhSel[g.ncc]===false); });
  if(!sel.length){ toast('Chưa chọn nhà cung cấp nào'); return; }
  if(!mhValidateInfo()) return;
  if(btn){ btn.disabled=true; btn.dataset.t=btn.innerHTML; btn.innerHTML='Đang gửi…'; }
  var payload=Object.assign(mhBase(),{ orders:sel.map(mhOrderOf) });
  api('sendPurchaseRequest',payload).then(function(){ toast('✔ Đã gửi yêu cầu hàng loạt tới '+sel.length+' nhà cung cấp'); })
    .catch(function(e){ toast('Lỗi gửi: '+e.message); })
    .then(function(){ if(btn){ btn.disabled=false; btn.innerHTML=btn.dataset.t; } });
}

/* ===== XUẤT BÁO GIÁ + TỜ BÌA ===== */
function computeQuoteLocal(){ var sub=0; S.lines.forEach(function(l){ sub+=Number(l.thanhTienBan)||0; }); var vatPct=Number(S.cur&&S.cur.vat)||0; var vat=Math.round(sub*vatPct/100); return {subtotal:sub,vatPct:vatPct,vat:vat,total:sub+vat}; }
function coverDepth(s){ return String(s).split('.').length; }
function coverSortFn(a,b){ function k(s){return String(s).split('.').map(function(x){return parseInt(x,10)||0;});} var ka=k(a.stt),kb=k(b.stt),n=Math.max(ka.length,kb.length); for(var i=0;i<n;i++){var d=(ka[i]||0)-(kb[i]||0); if(d)return d;} return 0; }
function coverHasChild(stt){ return (S.cover||[]).some(function(c){ return c.stt!==stt && String(c.stt).indexOf(stt+'.')===0; }); }
function coverCosts(){
  var cover=S.cover||[], cost={};
  cover.forEach(function(c){
    if(coverHasChild(c.stt)){ var s=0; cover.forEach(function(d){ if(d.stt!==c.stt && String(d.stt).indexOf(c.stt+'.')===0 && !coverHasChild(d.stt)) s+=Number(d.chiPhi)||0; }); cost[c.stt]=s; }
    else cost[c.stt]=Number(c.chiPhi)||0;
  });
  var total=0; cover.forEach(function(c){ if(coverDepth(c.stt)===1) total+=cost[c.stt]; });
  return {cost:cost,total:total};
}
function bgHidden(stt){ var root=String(stt).split('.')[0]; return !!(S.bgHide && S.bgHide[root]); }
function bgToggle(stt){ S.bgHide=S.bgHide||{}; if(S.bgHide[stt]) delete S.bgHide[stt]; else S.bgHide[stt]=1; drawBaogia(); }
function setCoverMau(m){ S.coverMau=m; try{localStorage.setItem('qs_covermau',m);}catch(e){} drawBaogia(); }
function setDeMuc(v){ S.bgDeMuc=v; drawBaogia(); }
function coverInfo(field,value){ if(!S.cur)return; var f={}; f[field]=value; api('updateProject',S.cur.maDA,f).then(syncProj).catch(function(e){toast('Lỗi: '+e.message);}); }
function ic(field){ var v=(S.cur&&S.cur[field])||''; return '<td><input class="cin" value="'+esc(v)+'" onchange="coverInfo(\''+field+'\',this.value)"></td>'; }
function coverEdit(i,field,value){ var c=S.cover[i]; if(!c)return;
  if(field==='chiPhi') c.chiPhi=Number(String(value).replace(/[^\d.-]/g,''))||0;
  else if(field==='stt') c.stt=String(value).replace(/[^\d.]/g,'');
  else c[field]=value; drawBaogia(); }
function coverDel(i){ S.cover.splice(i,1); drawBaogia(); }
function coverAddBig(){ var n=(S.cover||[]).filter(function(c){return coverDepth(c.stt)===1;}).length+1; S.cover.push({stt:String(n),hangMuc:'Mục mới',moTa:'',chiPhi:0}); drawBaogia(); }
function coverAddSmall(){
  var secs=(S.cover||[]).filter(function(c){return coverDepth(c.stt)===1;}).sort(coverSortFn);
  var last=secs[secs.length-1], stt='1.1';
  if(last){ var kids=(S.cover||[]).filter(function(c){return c.stt!==last.stt && String(c.stt).indexOf(last.stt+'.')===0 && coverDepth(c.stt)===2;}); stt=last.stt+'.'+(kids.length+1); }
  S.cover.push({stt:stt,hangMuc:'Mục nhỏ',moTa:'',chiPhi:0}); drawBaogia();
}
async function coverReload(btn){ if(btn)btn.disabled=true; try{ S.cover=await api('buildCoverFromTemplate',S.cur.maDA)||[]; S._coverDA=S.cur.maDA; drawBaogia(); toast('Đã nạp mẫu + tự cộng chi phí'); }catch(e){ toast('Lỗi: '+e.message); } if(btn)btn.disabled=false; }
async function coverSave(btn){ btn.disabled=true; try{ S.cover=await api('saveCover',S.cur.maDA,S.cover)||S.cover; toast('Đã lưu tờ bìa'); drawBaogia(); }catch(e){ toast('Lỗi: '+e.message); } btn.disabled=false; }

/* ===== BẢNG TÍNH HỆ SỐ DIỆN TÍCH (theo tab 0.NHẬP THÔNG TIN) ===== */
var AREA_TEMPLATE=[
  {k:'khu_dat',   label:'Diện tích khu đất (tính đơn giá xây thô)', hs:0,   usage:false},
  {k:'xay_dung',  label:'Diện tích xây dựng (trệt)',                hs:1,   usage:true},
  {k:'tang_lau',  label:'Tầng lầu',                                 hs:1,   usage:true},
  {k:'tang_lung', label:'Tầng lửng',                                hs:1,   usage:true},
  {k:'tang_thuong',label:'Tầng thượng',                            hs:1,   usage:true},
  {k:'ban_ham',   label:'Bán hầm (sâu 1.0–1.3m)',                  hs:1.5, usage:false},
  {k:'tang_ham',  label:'Tầng hầm (sâu ≥2.0m)',                    hs:2,   usage:false},
  {k:'mai_bt',    label:'Mái (bê tông)',                            hs:0.7, usage:false},
  {k:'mai_ngoi',  label:'Mái (ngói)',                               hs:0.5, usage:false}
];
function areaLoad_(){ if(!S.cur) return {}; if(S._areaDA===S.cur.maDA && S.areaData) return S.areaData;
  var d={}; try{ d=JSON.parse(localStorage.getItem('qs_area_'+S.cur.maDA)||'{}')||{}; }catch(e){ d={}; }
  S.areaData=d; S._areaDA=S.cur.maDA; return d; }
function areaSave_(){ if(!S.cur) return; try{ localStorage.setItem('qs_area_'+S.cur.maDA, JSON.stringify(S.areaData||{})); }catch(e){} }
function areaSet_(k,field,val){ var d=areaLoad_(); d[k]=d[k]||{}; d[k][field]=Number(String(val).replace(/[^\d.,-]/g,'').replace(',','.'))||0; areaSave_(); drawBaogia(); }
function areaCompute_(){ var d=areaLoad_(), rows=[], dtBG=0, dtSD=0, groundArea=0;
  AREA_TEMPLATE.forEach(function(t){ var r=d[t.k]||{}; var cnt=Number(r.count)||0, dai=Number(r.dai)||0, rong=Number(r.rong)||0;
    var dt=dai*rong, tong=dt*(cnt||1)*(cnt?1:0)||dt*cnt, bao=0, usg=0;
    tong=dt*cnt; bao=tong*t.hs; usg=t.usage?tong:0;
    if(t.k==='khu_dat') groundArea=dt;   // để tính đơn giá xây thô
    dtBG+=bao; dtSD+=usg;
    rows.push({t:t, cnt:cnt, dai:dai, rong:rong, dt:dt, tong:tong, bao:bao, usg:usg});
  });
  return {rows:rows, dtBaoGia:Math.round(dtBG*100)/100, dtSuDung:Math.round(dtSD*100)/100, groundArea:groundArea};
}
function areaToggle_(){ S.areaOpen=!S.areaOpen; drawBaogia(); }
function areaApply_(){ var c=areaCompute_();
  var f={ dtBaoGia:String(c.dtBaoGia||''), tongDT:String(c.dtSuDung||'') };
  Object.keys(f).forEach(function(k){ if(S.cur) S.cur[k]=f[k]; });
  api('updateProject',S.cur.maDA,f).then(syncProj).catch(function(e){toast('Lỗi: '+e.message);});
  toast('Đã áp DT báo giá '+c.dtBaoGia+' m² · DT sử dụng '+c.dtSuDung+' m² vào tờ bìa'); drawBaogia();
}
function fmtM2_(n){ n=Math.round((Number(n)||0)*100)/100; return String(n).replace('.',','); }
function bgAreaHTML(){
  var open=!!S.areaOpen, c=areaCompute_();
  var hdr='<div class="dbcard-h" style="cursor:pointer" onclick="areaToggle_()"><span class="dbcard-ic">'+icon('ruler',18)+'</span><h3>Bảng tính diện tích (hệ số)</h3>'
    +'<span class="dbchip">DT báo giá <b>'+fmtM2_(c.dtBaoGia)+'</b> m²</span><span class="dbchip">DT sử dụng <b>'+fmtM2_(c.dtSuDung)+'</b> m²</span>'
    +'<span style="flex:1"></span>'
    +(open?'<button class="btn blue sm" onclick="event.stopPropagation();areaApply_()">'+icon('check',14)+' Áp vào tờ bìa</button>':'')
    +'<span class="dbcaret">'+(open?'▾':'▸')+'</span></div>';
  if(!open) return '<div class="dbcard">'+hdr+'</div>';
  var body=c.rows.map(function(r){
    return '<tr><td>'+esc(r.t.label)+'</td>'
      +'<td class="num"><input class="cin num" style="width:56px" value="'+(r.cnt||'')+'" placeholder="0" onchange="areaSet_(\''+r.t.k+'\',\'count\',this.value)"></td>'
      +'<td class="num"><input class="cin num" style="width:64px" value="'+(r.dai||'')+'" placeholder="0" onchange="areaSet_(\''+r.t.k+'\',\'dai\',this.value)"></td>'
      +'<td class="num"><input class="cin num" style="width:64px" value="'+(r.rong||'')+'" placeholder="0" onchange="areaSet_(\''+r.t.k+'\',\'rong\',this.value)"></td>'
      +'<td class="num">'+fmtM2_(r.dt)+'</td><td class="num">'+fmtM2_(r.tong)+'</td>'
      +'<td class="ct">'+String(r.t.hs).replace('.',',')+'</td>'
      +'<td class="num"><b>'+fmtM2_(r.bao)+'</b></td><td class="num">'+fmtM2_(r.usg)+'</td></tr>';
  }).join('');
  var table='<table class="cvt areatbl"><tr><th>HẠNG MỤC</th><th class="num">SỐ TẦNG</th><th class="num">DÀI</th><th class="num">RỘNG</th><th class="num">DIỆN TÍCH</th><th class="num">TỔNG</th><th class="ct">HỆ SỐ</th><th class="num">DT BÁO GIÁ</th><th class="num">DT SỬ DỤNG</th></tr>'
    +body
    +'<tr class="cvtot"><td colspan="7" style="text-align:right">TỔNG (m²)</td><td class="num">'+fmtM2_(c.dtBaoGia)+'</td><td class="num">'+fmtM2_(c.dtSuDung)+'</td></tr></table>';
  return '<div class="dbcard">'+hdr+'<div class="dbcard-b" style="padding:0"><div style="overflow-x:auto">'+table+'</div>'
    +'<div class="hint" style="margin:0;padding:10px 16px;color:var(--muted);font-size:12px;border-top:1px solid #eef1f5">Công thức: Diện tích = Dài × Rộng · Tổng = Diện tích × Số tầng · DT báo giá = Tổng × Hệ số. Bấm “Áp vào tờ bìa” để điền DT báo giá & DT sử dụng.</div></div></div>';
}

/* ============================================================
   TÀI LIỆU BÁO GIÁ — xem trước phân trang (A4) + in/PDF khớp thiết kế
   ============================================================ */
function bgSetView(v){ S.bgView=v; S.bgPage=1; drawBaogia(); }
function bgGoPage(n){ S.bgPage=n; drawBaogia(); var d=document.getElementById('qsDoc'); if(d) d.scrollIntoView({block:'start',behavior:'smooth'}); }
function trimNum_(n,dec){ var f=n.toFixed(dec); if(f.indexOf('.')>=0) f=f.replace(/0+$/,'').replace(/\.$/,''); return f.replace('.',','); }
function moneyShort(v){ v=Math.round(Number(v)||0); if(!v) return '–'; var neg=v<0; v=Math.abs(v); var s;
  if(v>=1e9) s=trimNum_(v/1e9,2)+' tỷ'; else if(v>=1e6) s=trimNum_(v/1e6,1)+' triệu'; else if(v>=1e3) s=trimNum_(v/1e3,0)+' nghìn'; else s=money(v)+' đ';
  return (neg?'-':'')+s; }
function pctFmt(p){ if(!isFinite(p)||!p) return '0%'; return p.toFixed(p<1?2:1).replace('.',',')+'%'; }
var ROMAN_=['I','II','III','IV','V','VI','VII','VIII','IX','X','XI','XII','XIII','XIV','XV'];
// Dựng danh sách trang: [trang tóm tắt] + [các trang chi tiết]
// Thông tin công ty trên tài liệu báo giá (letterhead) — sửa ở đây khi đổi
var QUOTE_ORG={ brand:'DECOX', lines:[
  'B123, The Galleria Residence, Metropole Thủ Thiêm, Phường An Khánh',
  'ĐT: (08) 36200560   Email: support@decox.vn',
  'Xưởng sản xuất: KCN Vĩnh Lộc, Quận Tân Phú, TPHCM',
  'Website: decoxdesign.com' ] };
function bgBuildPages(){
  var p=S.cur||{}, comp=coverCosts();
  var inners=[];
  var hangMuc = bgNodeLabel_();
  var decoxHead='<div class="qx-head"><div class="qx-brandbox"><div class="qx-brand">'+esc(QUOTE_ORG.brand)+'</div>'
    +'<div class="qx-org">'+QUOTE_ORG.lines.map(esc).join('<br>')+'</div></div>'
    +'<div class="qx-titlebox"><div class="t1">BẢNG ƯỚC TÍNH CHI PHÍ DỰ ÁN</div><div class="t2">HẠNG MỤC: '+esc(String(hangMuc).toUpperCase())+'</div></div></div>';
  function ip(k,v){ return '<td class="k">'+k+'</td><td class="v">'+esc(v||'')+'</td>'; }
  var infoBlock='<table class="qx-info">'
    +'<tr>'+ip('Khách hàng',p.khachHang)+ip('Hiện trạng',p.hienTrang)+'</tr>'
    +'<tr>'+ip('Tên dự án',p.ten)+ip('Quy mô',p.quyMo)+'</tr>'
    +'<tr>'+ip('DT sử dụng',p.tongDT?p.tongDT+' m²':'')+ip('Nhu cầu',p.nhuCau)+'</tr>'
    +'<tr>'+ip('Phong cách',p.phanKhuc)+ip('DT báo giá [nhân hệ số]',p.dtBaoGia?p.dtBaoGia+' m²':'')+'</tr>'
    +'</table>';
  // ===== TRANG 1 = TỜ BÌA (Mẫu 1 hoặc Mẫu 2, do người dùng chọn) =====
  inners.push(decoxHead+infoBlock+(bgCoverSel_()||bgCoverPage_(comp)));
  // ===== Các trang sau: bảng chi tiết THEO ĐÚNG CHIP CỘT đang bật =====
  var lines=bgLines_();
  var cols=bgDocCols_();
  var coAnh=cols.some(function(c){ return c[0]==='hinhAnh'; });
  var nCot=cols.length+1;                       // +1 cho cột STT
  var colg='<colgroup><col style="width:30px">'+cols.map(function(c){ return '<col style="width:'+bgDocW_(c[0])+'">'; }).join('')+'</colgroup>';
  var thead='<tr class="qx-h"><th class="ct">STT</th>'
    +cols.map(function(c){ return '<th class="'+bgDocAlign_(c[0])+'">'+esc(String(c[1]).toUpperCase())+'</th>'; }).join('')+'</tr>';
  function rowHtml(l,ri){
    return '<tr><td class="ct">'+(ri+1)+'</td>'
      +cols.map(function(c){ return '<td class="'+bgDocAlign_(c[0])+'">'+bgDocCell_(l,c[0])+'</td>'; }).join('')+'</tr>';
  }
  function secRow(nhan, tien){
    var giua=Math.max(1,nCot-2);
    return '<tr class="sec"><td class="ct"></td><td colspan="'+giua+'">'+nhan+'</td>'
      +'<td class="num">'+(tien?money(tien):'-')+'</td></tr>';
  }
  var PER = coAnh ? 8 : 13;                      // có ảnh thì dòng cao hơn -> ít dòng mỗi trang
  if(bgPerSec_()){
    var byNode={}, ordN=[];
    lines.forEach(function(l){ var c=(l.nhom||'').trim()||'__k'; if(!byNode[c]){ byNode[c]=[]; ordN.push(c); } byNode[c].push(l); });
    ordN.forEach(function(code){
      var its=byNode[code], ten=(code==='__k'?'KHÁC':(nodeName(code)||code));
      var secTt=its.reduce(function(a,l){ return a+(Number(l.thanhTienBan)||0); },0);
      var flatN=[], byF={}, ordF=[];
      its.forEach(function(l){ var g=(l.tang||'').trim()||'HẠNG MỤC'; if(!byF[g]){byF[g]=[];ordF.push(g);} byF[g].push(l); });
      ordF.forEach(function(g,gi){
        var sub=byF[g].reduce(function(a,l){ return a+(Number(l.thanhTienBan)||0); },0);
        flatN.push(secRow((ROMAN_[gi]||(gi+1))+'. '+esc(g), sub));
        byF[g].forEach(function(l,ri){ flatN.push(rowHtml(l,ri)); });
      });
      flatN.push(secRow('<b>TỔNG '+esc(String(ten).toUpperCase())+'</b>', secTt));
      for(var q0=0;q0<flatN.length;q0+=PER){
        inners.push('<div class="qx-secttl">'+esc(String(ten).toUpperCase())+(q0?' (tiếp)':'')+'</div>'
          +'<table class="qx-tbl">'+colg+thead+flatN.slice(q0,q0+PER).join('')+'</table>');
      }
    });
  } else {
    var groups={},order=[]; lines.forEach(function(l){ var g=(l.tang||'').trim()||'HẠNG MỤC'; if(!groups[g]){groups[g]=[];order.push(g);} groups[g].push(l); });
    var flat=[];
    order.forEach(function(g,gi){
      var items=groups[g]||[], sec=items.reduce(function(a,l){return a+(Number(l.thanhTienBan)||0);},0);
      flat.push(secRow((ROMAN_[gi]||(gi+1))+'. '+esc(g), sec));
      items.forEach(function(l,ri){ flat.push(rowHtml(l,ri)); });
    });
    if(flat.length){ for(var i=0;i<flat.length;i+=PER){
      inners.push((i===0?'<div class="qx-secttl">BẢNG BÁO GIÁ CHI TIẾT</div>':'')+'<table class="qx-tbl">'+colg+thead+flat.slice(i,i+PER).join('')+'</table>');
    } }
  }
  // ===== Hộp tổng + ghi chú + ô ký =====
  var q=computeQuoteLocal(), giua=Math.max(1,nCot-1);
  function totRow(nhan,tien){ return '<tr><td colspan="'+giua+'" class="lbl">'+nhan+'</td><td class="num">'+money(tien)+'</td></tr>'; }
  var totbox='<table class="qx-tbl qx-totbox">'+colg
    +totRow('TỔNG CỘNG:',q.subtotal)+totRow('VAT '+q.vatPct+'%',q.vat)+totRow('THÀNH TIỀN SAU THUẾ:',q.total)+'</table>';
  var notes='<div class="qx-notes"><div class="h">Ghi chú:</div><ol>'
    +'<li>Khối lượng trên là tạm tính, khối lượng quyết toán theo diện tích xây dựng thực tế.</li>'
    +'<li>Giá trên chưa bao gồm nhân công hoàn thiện.</li>'
    +'<li>Giá trên đã bao gồm thuế VAT.</li></ol></div>';
  var sign='<div class="qx-sign"><div class="col"><div class="hd">KHÁCH HÀNG / CUSTOMER</div><div class="sp"></div></div>'
    +'<div class="col"><div class="hd">ĐƠN VỊ THI CÔNG / CONSTRUCTION UNIT</div><div class="sp"></div></div></div>';
  inners[inners.length-1]+=totbox+notes+sign;
  var N=inners.length;
  return inners.map(function(inner,idx){
    var foot='<div class="qp-foot"><span>'+esc(QUOTE_ORG.brand)+' — '+esc(p.ten||'')+'</span><span>Trang '+(idx+1)+' / '+N+'</span></div>';
    return {html:'<div class="qs-page qx-page">'+inner+foot+'</div>'};
  });
}
/* ---- Tờ bìa cho TRANG 1 (bản chỉ đọc, theo Mẫu 1 / Mẫu 2) ---- */
/* ═══ Tờ bìa khi ĐÃ TÍCH hạng mục ═══
   Trước đây tờ bìa luôn in nguyên bảng mẫu (đủ 27 mục, phần lớn 0 đ) dù người dùng
   chỉ tích vài hạng mục -> "bấm cái gì" không "hiện cái đó".
   Nay: tích mục nào thì bảng tổng hợp ở tờ bìa chỉ liệt kê đúng mục đó, số tiền lấy
   thẳng từ các dòng đã bóc. Không tích gì -> giữ nguyên bảng mẫu tờ bìa như cũ.
   Tờ bìa thì LUÔN là trang 1 trong mọi trường hợp.                                  */
function bgCoverSel_(){
  var sel=bgSelCodes_(); if(!sel.length) return '';
  var rows=sel.map(function(code){
    var its=(S.lines||[]).filter(function(l){ var c=String(l.nhom||'');
      return c===code || c.indexOf(code+'.')===0; });
    return { code:code, ten:nodeName(code)||code, n:its.length,
             tien:its.reduce(function(a,l){ return a+(Number(l.thanhTienBan)||0); },0) };
  }).sort(function(a,b){ return String(a.code).localeCompare(String(b.code),'vi',{numeric:true}); });
  var tong=rows.reduce(function(a,r){ return a+r.tien; },0);
  var body=rows.map(function(r){
    var pct=tong>0?(r.tien/tong*100):0;
    return '<tr class="lv1"><td class="ct">'+esc(r.code)+'</td>'
      +'<td>'+esc(r.ten)+'</td>'
      +'<td class="num">'+money(r.tien)+'</td>'
      +'<td class="num">'+pct.toFixed(2)+'%</td>'
      +'<td class="it">'+(r.n?(pad2(r.n)+' dòng — xem bảng chi tiết ở trang sau'):'Chưa có dòng nào trong hạng mục này')+'</td></tr>';
  }).join('');
  return '<div class="qx-secttl">CHI TIẾT CÁC HẠNG MỤC</div>'
    +'<table class="qx-tbl qx-cover"><tr class="qx-h"><th class="ct">NO</th><th>HẠNG MỤC</th>'
    +'<th class="num">CHI PHÍ DỰ KIẾN</th><th class="num">TỶ TRỌNG</th><th>MÔ TẢ</th></tr>'
    +body+'<tr class="sec"><td colspan="2" style="text-align:right"><b>TỔNG CHI PHÍ DỰ KIẾN</b></td>'
    +'<td class="num"><b>'+money(tong)+'</b></td><td class="num"><b>'+(tong?'100%':'0%')+'</b></td><td></td></tr></table>';
}
function bgCoverPage_(comp){
  var cost=comp.cost, total=comp.total;
  var rows=(S.cover||[]).filter(function(c){ return !bgHidden(c.stt); }).slice().sort(coverSortFn);
  if(!rows.length) return '<div class="qx-secttl">CHI TIẾT CÁC HẠNG MỤC</div>'
    +'<div class="qsum-card"><table class="qsum"><tr><td class="nm" style="color:#94a3b8;padding:16px 0">Chưa có tờ bìa — sang chế độ <b>Chỉnh sửa</b> bấm “↻ Nạp mẫu”.</td></tr></table></div>';
  var m1 = (S.coverMau==='m1');
  var body;
  if(m1){
    // Mẫu 1: gộp theo mục lớn (một ô HẠNG MỤC dùng chung cho các dòng con)
    var secs=rows.filter(function(c){ return coverDepth(c.stt)===1; });
    body=secs.map(function(sec){
      var kids=rows.filter(function(c){ return c.stt!==sec.stt && String(c.stt).indexOf(sec.stt+'.')===0; });
      if(!kids.length) kids=[sec];
      return kids.map(function(c,ki){
        var val=cost[c.stt]||0, pct=total>0?(val/total*100):0;
        var lead = ki===0 ? '<td class="ct" rowspan="'+kids.length+'">'+esc(sec.stt)+'</td>'
            +'<td class="hm" rowspan="'+kids.length+'">'+esc(sec.hangMuc||'')+'</td>' : '';
        return '<tr>'+lead+'<td>'+esc(c===sec?'':(c.hangMuc||''))+'</td>'
          +'<td class="num">'+money(val)+'</td><td class="num">'+pct.toFixed(2)+'%</td>'
          +'<td class="it">'+esc(c.moTa||'')+'</td></tr>';
      }).join('');
    }).join('');
    return '<div class="qx-secttl">CHI TIẾT CÁC HẠNG MỤC</div>'
      +'<table class="qx-tbl qx-cover"><tr class="qx-h"><th class="ct">NO</th><th>HẠNG MỤC</th><th>NỘI DUNG</th>'
      +'<th class="num">CHI PHÍ DỰ KIẾN</th><th class="num">TỶ TRỌNG</th><th>MÔ TẢ</th></tr>'
      +body+'<tr class="sec"><td colspan="3" style="text-align:right"><b>TỔNG CHI PHÍ DỰ KIẾN</b></td>'
      +'<td class="num"><b>'+money(total)+'</b></td><td class="num"><b>100%</b></td><td></td></tr></table>';
  }
  // Mẫu 2: danh sách phẳng phân cấp
  body=rows.map(function(c){
    var lvl=coverDepth(c.stt), val=cost[c.stt]||0, pct=total>0?(val/total*100):0;
    return '<tr class="lv'+lvl+'"><td class="ct">'+esc(c.stt)+'</td>'
      +'<td>'+esc(c.hangMuc||'')+'</td>'
      +'<td class="num">'+money(val)+'</td><td class="num">'+pct.toFixed(2)+'%</td>'
      +'<td class="it">'+esc(c.moTa||'')+'</td></tr>';
  }).join('');
  return '<div class="qx-secttl">CHI TIẾT CÁC HẠNG MỤC</div>'
    +'<table class="qx-tbl qx-cover"><tr class="qx-h"><th class="ct">NO</th><th>HẠNG MỤC</th>'
    +'<th class="num">CHI PHÍ DỰ KIẾN</th><th class="num">TỶ TRỌNG</th><th>MÔ TẢ</th></tr>'
    +body+'<tr class="sec"><td colspan="2" style="text-align:right"><b>TỔNG CHI PHÍ DỰ KIẾN</b></td>'
    +'<td class="num"><b>'+money(total)+'</b></td><td class="num"><b>100%</b></td><td></td></tr></table>';
}
/* ---- Cột của bảng chi tiết trong tài liệu = đúng các chip cột đang bật ---- */
function bgDocCols_(){
  var vis=visCols().filter(function(c){ return c[0]!=='stt'; });
  if(!vis.length) vis=[['ten','Tên sản phẩm'],['soLuong','Số lượng'],['donGiaCK','Đơn giá'],['thanhTien','Thành tiền']];
  return vis;
}
var BG_DOC_W={ khuVuc:'64px', maBanVe:'56px', nganh:'70px', maSP:'66px', ten:'auto', thuongHieu:'64px',
  ncc:'64px', moTa:'auto', kichThuoc:'82px', hinhAnh:'52px', dvt:'34px', soLuong:'40px', giaNCC:'66px',
  chietKhau:'44px', giaDaiLy:'66px', lnPct:'44px', donGia:'70px', ckKhach:'44px', donGiaCK:'70px',
  markup:'46px', margin:'46px', lnVnd:'66px', thanhTien:'84px', trangThai:'60px', ghiChu:'70px' };
function bgDocW_(k){ return BG_DOC_W[k]||'64px'; }
function bgDocAlign_(k){
  if(['soLuong','giaNCC','giaDaiLy','donGia','donGiaCK','lnVnd','thanhTien'].indexOf(k)>=0) return 'num';
  if(['hinhAnh','dvt','chietKhau','lnPct','ckKhach','markup','margin','maBanVe','nganh'].indexOf(k)>=0) return 'ct';
  return '';
}
function bgDocCell_(l,k){
  switch(k){
    case 'hinhAnh': return l.hinhAnh?('<img class="qx-img" src="'+esc(imgSrc1_(l.hinhAnh))+'" onerror="this.style.display=\'none\'">'):'';
    case 'ten': return '<b>'+esc(l.ten||'')+'</b>'+(l.maSP?'<span class="qx-ma">'+esc(l.maSP)+'</span>':'');
    case 'moTa': return '<span class="qx-desc">'+esc(l.moTa||'')+'</span>';
    case 'kichThuoc': return '<span class="qx-desc">'+esc(l.kichThuoc||'')+'</span>';
    case 'giaNCC': return money(l.donGiaVon);
    case 'giaDaiLy': return money(giaDaiLy_(l));
    case 'donGia': return l.donGiaBan?money(l.donGiaBan):'';
    case 'donGiaCK': return money(donGiaCK_(l));
    case 'lnVnd': return money(lnVnd_(l));
    case 'thanhTien': return l.thanhTienBan?money(l.thanhTienBan):'-';
    case 'markup': return markup_(l)+'%';
    case 'margin': return margin_(l)+'%';
    case 'chietKhau': return (Number(l.chietKhau)||0)+'%';
    case 'lnPct': return (Number(l.lnPct)||0)+'%';
    case 'ckKhach': return (Number(l.ckKhach)||0)+'%';
    case 'soLuong': return String(Number(l.soLuong)||0);
    case 'nganh': return esc((l.extra&&l.extra.nganh)||'');
    default: return esc(l[k]==null?'':String(l[k]));
  }
}
function bgPager(total,cur){
  if(total<=1) return '';
  var set=[]; for(var n=1;n<=total;n++){ if(n===1||n===total||Math.abs(n-cur)<=1) set.push(n); }
  var items='',prev=0;
  set.forEach(function(n){ if(n-prev>1) items+='<span class="qpg-ell">…</span>'; items+='<button class="qpg'+(n===cur?' on':'')+'" onclick="bgGoPage('+n+')">'+n+'</button>'; prev=n; });
  return '<div class="qpager">'+(cur>1?'<button class="qpg arw" onclick="bgGoPage('+(cur-1)+')">←</button>':'')
    +items+(cur<total?'<button class="qpg arw" onclick="bgGoPage('+(cur+1)+')">→</button>':'')+'</div>';
}
function bgDocHTML(){
  var pages=bgBuildPages();
  if(!S.bgPage||S.bgPage>pages.length) S.bgPage=1;
  ensureDocCss_();
  return '<div class="qs-doc" id="qsDoc">'+pages[S.bgPage-1].html+'</div>'+bgPager(pages.length,S.bgPage);
}
var QS_DOC_CSS=''
+'.qs-doc{display:flex;justify-content:center;margin:16px 0 4px}'
+'.qs-page{width:1123px;min-height:794px;background:#fff;border:1px solid #e6e9ee;border-radius:10px;box-shadow:0 8px 30px rgba(20,40,80,.10);padding:54px 60px 48px;box-sizing:border-box;position:relative;font-family:Arial,Helvetica,sans-serif;color:#1f2937}'
+'.qp-head{display:flex;justify-content:space-between;align-items:center;font-size:11px;color:#9aa4b2;border-bottom:1px solid #eef1f4;padding-bottom:9px;margin-bottom:28px}'
+'.qp-proj{font-weight:700;color:#334155;text-transform:uppercase;letter-spacing:.4px}'
+'.qp-foot{position:absolute;left:60px;right:60px;bottom:22px;display:flex;justify-content:space-between;font-size:10px;color:#aab3c0;border-top:1px solid #eef1f4;padding-top:8px}'
+'.qp-title{font-size:19px;font-weight:800;letter-spacing:.5px;text-align:center;margin:4px 0 24px;color:#1f2937}'
+'.qp-title.sm{font-size:15px;margin:2px 0 16px;text-align:left;color:#0f2942}'
+'.qc-cover{text-align:center;margin:2px 0 20px}'
+'.qc-title{font-size:22px;font-weight:800;letter-spacing:.6px;color:#0f2942}'
+'.qc-sub{font-size:12.5px;font-style:italic;color:#64748b;margin-top:3px}'
+'.qc-code{font-size:12px;color:#475569;margin-top:8px}'
+'.qc-info{width:100%;border-collapse:collapse;margin-top:16px;text-align:left;table-layout:fixed}'
+'.qc-info td{border:1px solid #dfe4ea;padding:8px 10px;font-size:12px;vertical-align:middle}'
+'.qc-info td.k{background:#f4f6f9;color:#5b6b7b;font-weight:600;width:20%}'
+'.qc-info td.v{color:#1f2937;font-weight:600;width:30%}'
+'.qsum-card{border:1px solid #ececec;border-radius:12px;padding:12px 26px}'
+'.qx-img{max-width:44px;max-height:34px;object-fit:contain;display:block;margin:0 auto}'
+'.qx-ma{display:block;font-size:8px;color:#9aa3af;font-weight:400;margin-top:1px}'
+'.qx-cover td.hm{font-weight:700}'
+'.qx-cover tr.lv1 td{font-weight:700;background:#fafbfc}'
+'.qx-cover tr.lv3 td:first-child{padding-left:14px}'
+'.qsum{width:100%;border-collapse:collapse}'
+'.qsum td{padding:9px 2px;vertical-align:baseline}'
+'.qsum .amt{width:150px;color:#374151;font-variant-numeric:tabular-nums}'
+'.qsum .pct{width:78px;text-align:right;color:#374151}'
+'.qsum tr.lv1 td{font-weight:700;font-size:14px;border-top:1px solid #ededed}'
+'.qsum tr.lv1:first-child td{border-top:none}'
+'.qsum tr.lv2 td{font-weight:400;font-size:12.5px;color:#6b7280}'
+'.qsum tr.lv2 .nm{padding-left:22px}'
+'.qsum tr.qsum-tot td{border-top:2px solid #222;font-weight:800;font-size:14px;padding-top:12px}'
+'.qd{width:100%;border-collapse:collapse;font-size:12px}'
+'.qd-h th{background:#0f2942;color:#fff;font-weight:600;padding:9px 8px;text-align:left;font-size:11px;letter-spacing:.3px}'
+'.qd-h th.num{text-align:right}'
+'.qd td{padding:8px;border-bottom:1px solid #eef1f4;vertical-align:top}'
+'.qd td.num{text-align:right;font-variant-numeric:tabular-nums}'
+'.qd td.ct{text-align:center;color:#64748b}'
+'.qd .qd-sec td{background:#f1f5f9;font-weight:700;color:#0f2942;padding:7px 8px}'
+'.qd-br{color:#94a3b8;font-weight:400;font-size:11px}'
+'.qd-desc{color:#94a3b8;font-size:10.5px;margin-top:2px;line-height:1.35}'
+'.qd-sum td{font-size:13px;padding:10px 8px}'
+'.qd-sum .qd-grand td{border-top:2px solid #0f2942;font-weight:800;font-size:15px;color:#0f2942}'
+'.qpager{display:flex;gap:8px;justify-content:center;align-items:center;margin:14px 0 30px}'
+'.qpg{min-width:34px;height:34px;padding:0 8px;border:1px solid #e2e8f0;background:#fff;border-radius:8px;font-weight:600;color:#475569;cursor:pointer;font-size:14px}'
+'.qpg:hover{border-color:#c3ccd8}'
+'.qpg.on{background:#111827;color:#fff;border-color:#111827}'
+'.qpg-ell{color:#94a3b8;padding:0 2px}'
/* ===== Decox letterhead style ===== */
+'.qx-page{padding:34px 38px 42px}'
+'.qx-head{display:flex;justify-content:space-between;align-items:flex-start;gap:20px;margin-bottom:4px}'
+'.qx-brand{font-size:26px;font-weight:700;letter-spacing:.16em;color:#0f2942;line-height:1}'
+'.qx-org{font-size:9.5px;color:#5b6b7b;line-height:1.65;margin-top:8px;letter-spacing:.01em}'
+'.qx-titlebox{background:#12314f;color:#fff;text-align:center;padding:13px 22px;min-width:280px}'
+'.qx-titlebox .t1{font-size:12.5px;font-weight:600;letter-spacing:.09em;text-transform:uppercase}'
+'.qx-titlebox .t2{font-size:11px;font-weight:500;margin-top:5px;letter-spacing:.04em;color:#c7d6e6}'
+'.qx-info{width:100%;border-collapse:collapse;margin:20px 0 0;table-layout:fixed;border-top:1px solid #dbe1e9;border-bottom:1px solid #dbe1e9}'
+'.qx-info td{padding:8px 12px;font-size:10.5px;vertical-align:top;border-bottom:1px solid #eef1f5}'+'.qx-info tr:last-child td{border-bottom:none}'
+'.qx-info td.k{font-weight:600;color:#8a96a5;width:16%;font-size:9px;letter-spacing:.06em;text-transform:uppercase;padding-top:10px}'
+'.qx-info td.v{color:#1f2937;width:34%;font-weight:500}'
+'.qx-secttl{font-size:10.5px;font-weight:600;color:#12233a;letter-spacing:.12em;text-transform:uppercase;margin:22px 0 8px;padding-bottom:6px;border-bottom:1px solid #dbe1e9}'
+'.qx-tbl{width:100%;border-collapse:collapse;font-size:10.5px}'
+'.qx-tbl th{background:#12314f;color:#fff;font-weight:600;padding:9px 8px;text-align:left;font-size:9px;vertical-align:middle;border-right:1px solid #ffffff1f;text-transform:uppercase;letter-spacing:.05em;line-height:1.25}'
+'.qx-tbl th.num{text-align:right}.qx-tbl th.ct{text-align:center}'
+'.qx-tbl th:last-child{border-right:none}'
+'.qx-tbl td{padding:8px;border-right:1px solid #e6eaef;border-bottom:1px solid #eef1f5;vertical-align:top;line-height:1.45}'
+'.qx-tbl td:last-child{border-right:none}'
+'.qx-tbl td.num{text-align:right;font-variant-numeric:tabular-nums}'
+'.qx-tbl td.ct{text-align:center}'
+'.qx-tbl td.it{font-style:italic;color:#4b5563}'
+'.qx-tbl tr.sec td{background:#eef1f5;font-weight:600;color:#12233a;letter-spacing:.02em;border-top:1px solid #d5dce4;border-bottom:1px solid #d5dce4}'
+'.qx-desc{color:#6b7280;font-size:9.5px;line-height:1.35;margin-top:2px}'
+'.qx-totbox{margin-top:0}'
+'.qx-totbox td{background:#12314f;color:#fff;padding:9px 12px;font-size:11.5px;font-weight:600;border-right:none;border-bottom:1px solid #ffffff1a;font-variant-numeric:tabular-nums}'+'.qx-totbox tr:last-child td{background:#0e2740;font-size:12.5px;font-weight:700}'
+'.qx-totbox td.lbl{text-align:right;letter-spacing:.06em;text-transform:uppercase;font-size:10px;font-weight:500;color:#c7d6e6}'
+'.qx-notes{background:#f7f9fb;border:1px solid #e6eaef;padding:12px 16px;margin-top:18px;font-size:10px;color:#4b5563;line-height:1.6}'
+'.qx-notes .h{font-weight:600;margin-bottom:5px;color:#12233a;letter-spacing:.05em;text-transform:uppercase;font-size:9px}'
+'.qx-notes ol{margin:0;padding-left:20px}.qx-notes li{margin:3px 0}'
+'.qx-sign{display:flex;margin-top:18px;border:1px solid #e6eaef}'
+'.qx-sign .col{flex:1}.qx-sign .col:first-child{border-right:1px solid #d9dee5}'
+'.qx-sign .hd{background:#f7f9fb;font-weight:600;font-size:10px;padding:9px;color:#12233a;text-align:center;letter-spacing:.06em;text-transform:uppercase;border-bottom:1px solid #e6eaef}'
+'.qx-sign .sp{height:110px}';
function ensureDocCss_(){ if(document.getElementById('qsDocCss')) return; var s=document.createElement('style'); s.id='qsDocCss'; s.textContent=QS_DOC_CSS; document.head.appendChild(s); }
function printDoc(){
  if(!S.cur){ toast('Chưa chọn dự án'); return; }
  var pages=bgBuildPages(); var p=S.cur||{};
  var html=pages.map(function(pg){return pg.html;}).join('');
  var pcss=QS_DOC_CSS
    +'@page{size:A4 landscape;margin:0}'
    +'body{margin:0;background:#fff}'
    +'.qs-doc{margin:0;display:block}'
    +'.qs-page{border:none;border-radius:0;box-shadow:none;margin:0 auto;page-break-after:always;width:297mm;min-height:209mm;padding:16mm 15mm 18mm}'
    +'.qs-page:last-child{page-break-after:auto}'
    +'.qp-foot{left:15mm;right:15mm;bottom:8mm}';
  var w=window.open('','_blank'); if(!w){ toast('Cho phép popup để in/PDF'); return; }
  w.document.write('<!doctype html><title>Báo giá — '+esc(p.ten||'')+'</title><style>'+pcss+'</style><div class="qs-doc">'+html+'</div>');
  w.document.close(); setTimeout(function(){ w.focus(); w.print(); },400);
}

/* --- bảng tờ bìa: Mẫu 2 (phân cấp phẳng) --- */
function coverTableM2(comp){
  var cost=comp.cost, total=comp.total;
  var rows=(S.cover||[]).filter(function(c){ return !bgHidden(c.stt); }).slice().sort(coverSortFn);
  var spacer='<tr class="cv-spacer"><td colspan="5"></td></tr>';
  var body=rows.map(function(c,ri){
    var i=S.cover.indexOf(c), lvl=coverDepth(c.stt), val=cost[c.stt]||0, pct=total>0?(val/total*100):0, leaf=!coverHasChild(c.stt);
    var cls=lvl===1?'lv1':(lvl===2?'lv2':'lv3');
    var price=leaf?'<td class="num"><input class="cin num" value="'+money(val)+'" onchange="coverEdit('+i+',\'chiPhi\',this.value)"></td>':'<td class="num">'+money(val)+'</td>';
    var row='<tr class="'+cls+'"><td class="ct"><input class="cin ct" style="width:52px" value="'+esc(c.stt)+'" onchange="coverEdit('+i+',\'stt\',this.value)"></td>'
      +'<td style="padding-left:'+((lvl-1)*16+9)+'px"><input class="cin" style="font-weight:'+(lvl<=1?700:600)+'" value="'+esc(c.hangMuc||'')+'" onchange="coverEdit('+i+',\'hangMuc\',this.value)">'
        +'<div><input class="cin desc2" placeholder="mô tả…" value="'+esc(c.moTa||'')+'" onchange="coverEdit('+i+',\'moTa\',this.value)"></div></td>'
      +price+'<td class="num">'+pct.toFixed(2)+'%</td>'
      +'<td class="ct"><button class="del" onclick="coverDel('+i+')">✕</button></td></tr>';
    return (lvl===1&&ri>0?spacer:'')+row;   // dòng trắng cách trước mỗi nhóm lớn (như Bóc tách)
  }).join('');
  return '<table class="cvt"><tr><th class="ct">NO</th><th>HẠNG MỤC</th><th class="num">CHI PHÍ DỰ KIẾN</th><th class="num">TỶ TRỌNG</th><th></th></tr>'
    +(body||'<tr><td colspan="5" style="padding:20px;text-align:center;color:#889">Chưa có dòng. Bấm ↻ Nạp lại mẫu.</td></tr>')
    +'<tr class="cvtot"><td colspan="2" style="text-align:right">TỔNG CHI PHÍ DỰ KIẾN (VNĐ)</td><td class="num">'+money(total)+'</td><td colspan="2"></td></tr></table>';
}
/* --- bảng tờ bìa: Mẫu 1 (gộp NO/HẠNG MỤC, cột NỘI DUNG + MÔ TẢ) --- */
function coverTableM1(comp){
  var cost=comp.cost, total=comp.total;
  var secs=(S.cover||[]).filter(function(c){ return coverDepth(c.stt)===1 && !bgHidden(c.stt); }).sort(coverSortFn);
  var body=secs.map(function(sec){
    var si=S.cover.indexOf(sec);
    var kids=(S.cover||[]).filter(function(c){ return c.stt!==sec.stt && String(c.stt).indexOf(sec.stt+'.')===0 && !bgHidden(c.stt); }).sort(coverSortFn);
    if(!kids.length) kids=[sec];
    return kids.map(function(c,ki){
      var i=S.cover.indexOf(c), val=cost[c.stt]||0, pct=total>0?(val/total*100):0, leaf=!coverHasChild(c.stt);
      var lead = ki===0
        ? '<td class="ct" rowspan="'+kids.length+'" style="vertical-align:middle"><input class="cin ct" style="width:40px" value="'+esc(sec.stt)+'" onchange="coverEdit('+si+',\'stt\',this.value)"></td>'
          +'<td rowspan="'+kids.length+'" style="font-weight:700;vertical-align:middle">'+esc(sec.hangMuc||'')+'</td>'
        : '';
      var price=leaf?'<td class="num"><input class="cin num" value="'+money(val)+'" onchange="coverEdit('+i+',\'chiPhi\',this.value)"></td>':'<td class="num">'+money(val)+'</td>';
      return '<tr>'+lead
        +'<td><input class="cin" value="'+esc(c.hangMuc||'')+'" onchange="coverEdit('+i+',\'hangMuc\',this.value)"></td>'
        +price+'<td class="num">'+pct.toFixed(2)+'%</td>'
        +'<td><input class="cin desc2" placeholder="mô tả…" value="'+esc(c.moTa||'')+'" onchange="coverEdit('+i+',\'moTa\',this.value)"></td></tr>';
    }).join('');
  }).join('');
  return '<table class="cvt"><tr><th class="ct">NO</th><th>HẠNG MỤC</th><th>NỘI DUNG</th><th class="num">CHI PHÍ DỰ KIẾN</th><th class="num">TỶ TRỌNG</th><th>MÔ TẢ</th></tr>'
    +(body||'<tr><td colspan="6" style="padding:20px;text-align:center;color:#889">Chưa có dòng. Bấm ↻ Nạp lại mẫu.</td></tr>')
    +'<tr class="cvtot"><td colspan="3" style="text-align:right">TỔNG CHI PHÍ DỰ KIẾN (VND)</td><td class="num">'+money(total)+'</td><td colspan="2"></td></tr></table>';
}
/* --- bảng báo giá chi tiết (như Bóc tách) --- */
// Bảng báo giá chi tiết — markup GIỐNG HỆT Bóc tách (renderTable): dòng nhóm xám + tổng tầng,
// dòng trắng cách, sọc xen kẽ, header .thk, ô nhập (cellInput). Sửa ở đây đồng bộ với Bóc tách.
function bgDetailHTML(){
  var cols=visCols();
  var lines=bgLines_();
  var numK=['soLuong','giaNCC','giaDaiLy','donGia','donGiaCK','lnVnd','thanhTien'], ctK=['stt','hinhAnh','dvt','chietKhau','lnPct','ckKhach','markup','margin'];
  var groups={},order=[]; lines.forEach(function(l){ var g=(l.tang||'').trim()||'CHƯA PHÂN TẦNG'; if(!groups[g]){groups[g]=[];order.push(g);} groups[g].push(l); });
  var colg='<colgroup>'+cols.map(function(c){return '<col style="width:'+colW(c[0])+'px">';}).join('')+'<col style="width:44px"></colgroup>';
  var totalW=cols.reduce(function(s,c){return s+colW(c[0]);},0)+44;
  var head='<tr>'+cols.map(function(c){ var cls=numK.indexOf(c[0])>=0?'num':(ctK.indexOf(c[0])>=0?'ct':'');
    return '<th class="thk '+cls+'"><span class="thl">'+esc(c[1])+'</span></th>'; }).join('')+'<th></th></tr>';
  var body='';
  var tkSpacer='<tr class="tk-spacer"><td colspan="'+(cols.length+1)+'"></td></tr>';
  order.forEach(function(g,gi){
    var roman=['I','II','III','IV','V','VI','VII','VIII','IX','X'][gi]||(gi+1);
    var gsum=(groups[g]||[]).reduce(function(s,l){ return s+(Number(l.thanhTienBan)||0); },0);
    body+='<tr class="grp"><td colspan="'+(cols.length+1)+'">'
      +'<span class="gname">'+roman+'. '+esc(g)+'</span>'
      +'<span class="gsum">Tổng tầng: <b>'+money(gsum)+' đ</b></span></td></tr>';
    body+=tkSpacer;
    (groups[g]||[]).forEach(function(l,ri){
      body+='<tr class="drow'+(ri%2===0?' alt':'')+'" data-id="'+l.lineId+'">'+cols.map(function(c){
        if(c[0]==='stt') return '<td class="ct">'+(gi+1)+'.'+(ri+1)+'</td>';
        return cellInput(l,c[0]);
      }).join('')+'<td class="ct actcell"><button class="del" title="Xoá dòng" onclick="delLine(\''+l.lineId+'\')">✕</button></td></tr>';
    });
    body+=tkSpacer;
  });
  if(!lines.length) body='<tr><td class="empty" colspan="'+(cols.length+1)+'">Chưa có hạng mục.</td></tr>';
  return '<div class="tbl-wrap"><table class="tk" style="width:'+totalW+'px">'+colg+head+body+'</table></div>';
}
async function renderExport(){
  var box=document.getElementById('v-export');
  if(!S.cur){ box.innerHTML='<div class="empty">Chưa chọn dự án.</div>'; return; }
  if(S._coverDA!==S.cur.maDA){ box.innerHTML='<div class="empty">Đang tải tờ bìa…</div>'; try{ S.cover=await api('getCoverOrInit',S.cur.maDA)||[]; }catch(e){ S.cover=[]; } S._coverDA=S.cur.maDA; }
  drawBaogia();
}
function drawBaogia(){
  var box=document.getElementById('v-export'); if(!box) return;
  S.coverMau=S.coverMau||(function(){try{return localStorage.getItem('qs_covermau');}catch(e){return '';}}())||'m2';
  S.bgHide=S.bgHide||{}; if(!S.bgDeMuc) S.bgDeMuc='__all__';
  if(!S.bgView) S.bgView='doc';
  // header chung + chuyển chế độ
  var seg='<div class="bgseg"><button class="'+(S.bgView==='doc'?'on':'')+'" onclick="bgSetView(\'doc\')">'+icon('eye',14)+' Xem trước & Xuất</button>'
    +'<button class="'+(S.bgView==='edit'?'on':'')+'" onclick="bgSetView(\'edit\')">'+icon('sliders',14)+' Chỉnh sửa</button></div>';
  var sechd='<div class="sechd"><h2>Xuất báo giá</h2><span style="flex:1"></span>'+seg+'</div>';
  // ---- Chế độ tài liệu (xem trước phân trang + xuất) ----
  if(S.bgView==='doc'){
    box.innerHTML=sechd
      +bgCtlBar_()
      +bgDocHTML();
    return;
  }
  var comp=coverCosts(), p=S.cur||{}, q=computeQuoteLocal();
  var secs=(S.cover||[]).filter(function(c){return coverDepth(c.stt)===1;}).sort(coverSortFn);
  var chips=secs.map(function(s){ return '<span class="bgchip'+(S.bgHide[s.stt]?' off':'')+'" onclick="bgToggle(\''+s.stt+'\')">'+esc(s.hangMuc||s.stt)+'</span>'; }).join('')||'<span class="hint" style="color:#889">Chưa có mục. Bấm ↻ Nạp lại mẫu.</span>';
  var covTable=S.coverMau==='m1'?coverTableM1(comp):coverTableM2(comp);
  var colChips=COLS.map(function(c){return '<span class="chip'+(S.cols[c[0]]?' on':'')+'" onclick="toggleCol(\''+c[0]+'\')">'+esc(c[1])+'</span>';}).join('');

  // ---- Card 1: chọn mục hiện trên tờ bìa ----
  var card1=dbCard_('Chọn mục hiện trên tờ bìa','list','Bỏ chọn mục nào thì mục đó ẩn khỏi tờ bìa.','<div class="bgchips">'+chips+'</div>');
  // ---- Card 2: Tờ bìa (banner + info + bảng) ----
  var coverInner='<div class="cvcard"><div class="cvbanner"><div class="t">BẢNG ƯỚC TÍNH CHI PHÍ DỰ ÁN</div><div class="s">[Tư vấn thiết kế, thi công chuyên nghiệp]</div>'
    +'<div class="s" style="margin-top:4px">Mã báo giá số : <input class="cin" value="'+esc(p.maBaoGia||'')+'" onchange="coverInfo(\'maBaoGia\',this.value)"></div></div>'
    +'<table class="cvinfo"><tr><td class="lb">Khách hàng</td>'+ic('khachHang')+'<td class="lb">Quy mô</td>'+ic('quyMo')+'</tr>'
    +'<tr><td class="lb">Tổng diện tích XD (m²)</td>'+ic('tongDT')+'<td class="lb">Nhu cầu</td>'+ic('nhuCau')+'</tr>'
    +'<tr><td class="lb">DT báo giá [đã nhân hệ số] (m²)</td>'+ic('dtBaoGia')+'<td class="lb">Phân khúc</td>'+ic('phanKhuc')+'</tr></table>'
    +'<div style="overflow-x:auto">'+covTable+'</div></div>'
    +'<div style="margin-top:12px;display:flex;gap:8px;align-items:center;flex-wrap:wrap"><button class="btn ghost sm" onclick="coverAddBig()">＋ Thêm mục lớn</button><button class="btn ghost sm" onclick="coverAddSmall()">＋ Thêm mục nhỏ</button><span class="hint" style="color:var(--muted);font-size:12px">Sửa số ở ô No (vd gõ 1.4) — dòng tự về đúng thứ tự.</span></div>';
  var card2='<div class="dbcard"><div class="dbcard-h"><span class="dbcard-ic">'+icon('doc',18)+'</span><h3>Tờ bìa — Ước tính chi phí dự án</h3>'
    +'<span class="hint" style="margin-left:2px">bấm thẳng vào ô để sửa</span><span style="flex:1"></span>'
    +'<div class="mau"><button class="'+(S.coverMau==='m1'?'on':'')+'" onclick="setCoverMau(\'m1\')">Mẫu 1</button><button class="'+(S.coverMau==='m2'?'on':'')+'" onclick="setCoverMau(\'m2\')">Mẫu 2</button></div>'
    +'<button class="btn ghost sm" onclick="coverReload(this)">↻ Nạp mẫu</button>'
    +'<button class="btn ghost sm" onclick="coverAutoFill(this)">'+icon('download',14)+' Tự điền từ bóc tách</button>'
    +'<button class="btn green sm" onclick="coverSave(this)">'+icon('check',15)+' Lưu tờ bìa</button></div>'
    +'<div class="dbcard-b">'+coverInner+'</div></div>';
  // ---- Card 4: bảng báo giá chi tiết ----
  var card4='<div class="dbcard"><div class="dbcard-h"><span class="dbcard-ic">'+icon('list',18)+'</span><h3>Bảng báo giá chi tiết</h3>'
    +'<span class="hint" style="margin-left:2px">đồng bộ Bóc tách</span><span style="flex:1"></span>'
    +bgNodeBtn_('bgNodeBtn2')
    +'<button class="btn green sm" onclick="doExport(\'xlsx\',this)">'+icon('download',14)+' Excel</button>'
    +'<button class="btn red sm" onclick="printDoc()">'+icon('download',14)+' PDF / In</button></div>'
    +'<div class="dbcard-b"><div class="colchips">'+colChips+'</div>'+bgDetailHTML()
    +'<div class="totbar"><div class="b"><div class="tt">TẠM TÍNH</div><div class="tv">'+money(q.subtotal)+' đ</div></div>'
      +'<div class="b"><div class="tt">VAT '+q.vatPct+'%</div><div class="tv">'+money(q.vat)+' đ</div></div>'
      +'<div class="b grand"><div class="tt">TỔNG CỘNG</div><div class="tv">'+money(q.total)+' đ</div></div></div></div></div>';
  box.innerHTML=sechd+card1+card2+bgAreaHTML()+card4;
  markBlocks_('#v-export table.tk');
}
// Feature 2: tự điền chi phí tờ bìa từ dữ liệu bóc tách (map theo mã nhóm)
function coverAutoFill(btn){
  if(!S.cover||!S.cover.length){ toast('Chưa có tờ bìa. Bấm ↻ Nạp mẫu trước.'); return; }
  var byNhom={}; S.lines.forEach(function(l){ var c=(l.nhom||'').trim(); if(!c)return; byNhom[c]=(byNhom[c]||0)+(Number(l.thanhTienBan)||0); });
  var filled=0;
  S.cover.forEach(function(c){ if(coverHasChild(c.stt)) return;
    var sum=0; Object.keys(byNhom).forEach(function(code){ if(code===c.stt || code.indexOf(c.stt+'.')===0) sum+=byNhom[code]; });
    if(sum>0){ c.chiPhi=Math.round(sum); filled++; } });
  drawBaogia();
  toast(filled?('Đã tự điền '+filled+' mục từ bóc tách'):'Không có mã nhóm bóc tách khớp mục tờ bìa');
}
// Cột đưa vào file xuất = đúng các chip cột đang bật của bảng Bóc tách
var BG_KEYMAP={donGia:'donGia', donGiaCK:'donGiaCK', thanhTien:'thanhTien', giaNCC:'giaNCC'};
function bgExportCols_(){
  var vis=visCols();
  var cols=vis.map(function(c){ return {key:c[0], label:String(c[1]).toUpperCase()}; })
    .filter(function(c){ return c.key!=='stt'; });
  cols.unshift({key:'stt',label:'STT'});
  if(!cols.some(function(c){ return c.key==='ten'; })) cols.splice(1,0,{key:'ten',label:'TÊN SẢN PHẨM'});
  return cols;
}
async function doExport(fmt,btn){
  if(!S.cur){ toast('Chưa chọn dự án'); return; }
  var cols=bgExportCols_(), nodes=bgSelCodes_();
  var o=btn.textContent; btn.disabled=true; btn.textContent='Đang xuất…';
  try{
    if(fmt==='pdf'){ toast('Đang mở bản in…'); await printQuote(cols); }
    else{ var r=await api('exportBaoGia',S.cur.maDA,cols,'xlsx',nodes); dl(r); toast('Đã xuất Excel · '+cols.length+' cột'+(nodes.length?(' · '+nodes.length+' hạng mục'):'')); }
  }catch(e){ toast('Lỗi: '+e.message); } btn.disabled=false; btn.textContent=o;
}
function dl(res){ var b=atob(res.base64),a=new Uint8Array(b.length); for(var i=0;i<b.length;i++)a[i]=b.charCodeAt(i);
  var u=URL.createObjectURL(new Blob([a],{type:res.mimeType})); var el=document.createElement('a'); el.href=u; el.download=res.name; el.click(); setTimeout(function(){URL.revokeObjectURL(u);},1500); }
async function printQuote(cols){
  var q=await api('getQuote',S.cur.maDA)||{lines:[]}; var p=q.project||{};
  var rows=(q.lines||[]).map(function(l,i){ var dgNet=(l.donGia!=null&&l.donGia!==0)?l.donGia:(typeof donGiaCK_==='function'?donGiaCK_(l):l.donGiaBan); return '<tr><td>'+(i+1)+'</td><td>'+esc(l.khuVuc||'')+'</td><td>'+esc(l.ten||'')+'</td><td>'+esc(l.thuongHieu||'')+'</td><td style="text-align:right">'+l.soLuong+'</td><td style="text-align:right">'+money(dgNet)+'</td><td style="text-align:right">'+money(l.thanhTienBan)+'</td></tr>'; }).join('');
  var w=window.open('','_blank'); if(!w){toast('Cho phép popup để in');return;}
  w.document.write('<title>Báo giá '+esc(p.ten||'')+'</title><style>body{font-family:Arial;margin:16px}table{width:100%;border-collapse:collapse}th,td{border:1px solid #b8c4d4;padding:5px 7px;font-size:12px}th{background:#12324a;color:#fff}h2{color:#12324a}</style>'
    +'<h2>BÁO GIÁ — '+esc(p.ten||'')+'</h2><div>Khách hàng: '+esc(p.khachHang||'')+' — '+esc(p.diaChi||'')+'</div><br>'
    +'<table><tr><th>STT</th><th>Phòng</th><th>Tên sản phẩm</th><th>Thương hiệu</th><th>SL</th><th>Đơn giá</th><th>Thành tiền</th></tr>'+rows+'</table>');
  w.document.close(); setTimeout(function(){w.focus();w.print();},500);
}
function tdInput(label,id,val,type){ return '<div class="field"><label>'+esc(label)+'</label><input id="'+id+'" type="'+(type||'text')+'" value="'+esc(val||'')+'"></div>'; }
/* ==== Nhập dữ liệu -> bảng DB_SẢN PHẨM (Lark). Trường khoá theo ĐÚNG tên cột Lark. ==== */
var DB_GROUPS=[
  {g:'Thông tin cơ bản', f:[
    ['THƯƠNG HIỆU','Thương hiệu','text',1],['NHÀ CUNG CẤP','Nhà cung cấp','text',1],
    ['HẠNG MỤC','Hạng mục','sel',1,['Đèn nội thất','Đèn ngoại thất','Đèn kỹ thuật']],
    ['DÒNG SẢN PHẨM','Dòng sản phẩm','text',1],['NHÓM SẢN PHẨM','Nhóm sản phẩm','text',0,null,'Để trống = lấy theo Dòng sản phẩm'],
    ['TÊN SẢN PHẨM','Tên sản phẩm','text',1],['MÃ SẢN PHẨM','Mã sản phẩm','text',1] ]},
  {g:'Thông tin giá bán', note:'Giá đại lý tự tính = Giá bán lẻ × (1 − %Chiết khấu).', f:[
    ['GIÁ BÁN LẺ','Giá bán lẻ','num',1],['CHIẾT KHẤU ĐẠI LÝ (%)','%Chiết khấu','num',1],['GIÁ ĐẠI LÝ','Giá đại lý','calc',1] ]},
  {g:'Key Product Info (Thông tin chính)', f:[
    ['CÔNG SUẤT (W)','Công suất','text',1,null,'VD: 7  ·  2×5  ·  9/18'],['NHIỆT ĐỘ MÀU (K)','Nhiệt độ màu','sel',1,['2700','3000','4000','5000','6500']],
    ['GÓC CHIẾU (°)','Góc chiếu','num',1],['MÀU SẮC','Màu sắc','text',1],['CHẤT LIỆU','Chất liệu','text',1] ]},
  {g:'Thông số thiết kế', f:[
    ['GÓC NGHIÊNG (°)','Góc nghiêng','num',0],['CHIỀU CAO (mm)','Chiều cao','num',0],['ĐƯỜNG KÍNH (mm)','Đường kính','num',1] ]},
  {g:'Performance Specifications (Thông số hiệu suất)', f:[
    ['QUANG THÔNG (lm)','Quang thông','num',1],['CHỈ SỐ IP','Chỉ số IP (Chống bụi, nước)','sel',1,['IP20','IP44','IP54','IP65']],['CRI','CRI','text',1],
    ['HIỆU SUẤT PHÁT QUANG (lm/W)','Hiệu suất phát quang (lm/W)','num',0],['UGR','UGR','text',0],['SDCM','SDCM','text',0],
    ['COI','COI','text',0],['TUỔI THỌ','Tuổi thọ','text',0],
    ['TÊN CHIP LED','Tên chip LED','sel',0,['Bridgelux','Citizen','Cree','Osram','Samsung','Lumileds','Nichia','Seoul Semiconductor','Epistar','San An'],'Hãng / model chip, VD: Samsung LM301B'],
    ['LOẠI CHIP LED','Loại chip LED','sel',0,['COB','SMD','SMD 2835','SMD 3030','SMD 5730','Modul']] ]},
  {g:'Driver (Nguồn LED / Chấn lưu)', f:[
    ['LẮP NGUỒN RỜI','Lắp nguồn rời','sel',0,['Có','Không']],['TÊN BỘ NGUỒN','Tên bộ nguồn','text',0],['MÃ BỘ NGUỒN','Mã bộ nguồn','text',0],
    ['HÃNG BỘ NGUỒN','Hãng bộ nguồn','text',0],['GIÁ BÁN BỘ NGUỒN','Giá bán bộ nguồn','num',0,null,'VNĐ — giá bán rời của bộ nguồn'],
    ['VỊ TRÍ LẮP NGUỒN','Vị trí lắp nguồn','sel',0,['Lắp rời','Tích hợp trong thân đèn']],
    ['TƯƠNG THÍCH ĐIỀU KHIỂN','Tương thích điều khiển','sel',0,['DALI','0-10V','Triac','On-Off']],['DÒNG RA TỐI ĐA (mA)','Dòng ra tối đa (mA)','num',0] ]},
  {g:'Installation Specifications (Thông số lắp đặt)', f:[
    ['LỖ KHOÉT TRẦN (mm)','Lỗ khoét trần (Cutout)','text',1,null,'VD: Ø75  ·  Ø40×78  ·  60×60'],
    ['CẤP BẢO VỆ ĐIỆN','Cấp bảo vệ điện','sel',0,['Class I','Class II','Class III']] ]},
  {g:'Thương mại', f:[
    ['BẢO HÀNH (năm)','Bảo hành (năm)','num',0],['ĐƠN VỊ TÍNH','Đơn vị tính','sel',1,['Cái','Bộ','Mét']],
    ['TRẠNG THÁI','Trạng thái','sel',0,['Đang kinh doanh','Ngưng kinh doanh','Đặt hàng']],
    ['LINK DATASHEET','Link tài liệu kỹ thuật','text',0,null,'Dán link PDF catalogue / datasheet'],
    ['GHI CHÚ','Ghi chú','area',0] ]}
];
var DB_FLAT=[]; DB_GROUPS.forEach(function(gr){ gr.f.forEach(function(f){ DB_FLAT.push(f); }); });

/* ═══ NGÀNH THIẾT BỊ VỆ SINH (hạng mục 3.2.5) ═══
   MỖI HẠNG MỤC có bộ thông số riêng — định nghĩa DUY NHẤT ở public/vs-spec.js (VS_SPEC),
   dùng chung với file mẫu nhập hàng loạt và server:
     · Key Product Info  (chinh) -> cột "Thông tin chính" của bảng bóc tách
     · Thông số thiết kế (tk)    -> cột "Thông số thiết kế"
   Hai nhóm dưới đây là HỢP của mọi hạng mục (để bảng Danh sách SP có đủ cột); form Nhập /
   modal Sửa chỉ HIỆN thông số của hạng mục đang chọn (vsApplyHM_).                       */
function vsGomNhom_(k){ return k==='chinh'?VS_SPEC.CHINH_ALL:VS_SPEC.TK_ALL; }
function vsField_(lb){ var m=VS_SPEC.METRIC[lb]; return [lb, m[1], m[2], 0, [], m[3]||'', 'vs']; }
var DB_GROUPS_VS=[
  {g:'Thông tin cơ bản', f:[
    ['THƯƠNG HIỆU','Thương hiệu','text',1],['NHÀ CUNG CẤP','Nhà cung cấp','text',1],
    ['HẠNG MỤC','Hạng mục','hm',1,VS_SPEC.HANG_MUC],
    ['DÒNG SẢN PHẨM','Dòng sản phẩm','text',1,null,'VD: Bồn cầu treo tường'],
    ['NHÓM SẢN PHẨM','Nhóm sản phẩm','text',0,null,'Để trống = lấy theo Dòng sản phẩm'],
    ['TÊN SẢN PHẨM','Tên sản phẩm','text',1],['MÃ SẢN PHẨM','Mã sản phẩm','text',1] ]},
  {g:'Thông tin giá bán', note:'Giá đại lý tự tính = Giá bán lẻ × (1 − %Chiết khấu).', f:[
    ['GIÁ BÁN LẺ','Giá bán lẻ','num',1],['CHIẾT KHẤU ĐẠI LÝ (%)','%Chiết khấu','num',1],['GIÁ ĐẠI LÝ','Giá đại lý','calc',0] ]},
  {g:'Key Product Info (Thông tin chính)', vs:1, note:'Thông số theo hạng mục đã chọn — lên cột "Thông tin chính" của bảng bóc tách.',
    f:vsGomNhom_('chinh').map(vsField_)},
  {g:'Thông số thiết kế', vs:1, note:'Thông số theo hạng mục đã chọn — lên cột "Thông số thiết kế" của bảng bóc tách.',
    f:vsGomNhom_('tk').map(vsField_)},
  {g:'Tính năng', note:'Mỗi dòng một tính năng — hiện ở phần Thông tin sản phẩm (mở rộng).', f:[
    ['TÍNH NĂNG','Tính năng','area',0,null,'• Men sứ chống dính CEFIONTECT\n• Hệ thống xả Tornado siêu êm'] ]},
  {g:'Thương mại', f:[
    ['BẢO HÀNH (năm)','Bảo hành (năm)','num',0],
    ['ĐƠN VỊ TÍNH','Đơn vị tính','sel',1,['Cái','Bộ','Chiếc']],
    ['TRẠNG THÁI','Trạng thái','sel',0,['Đang kinh doanh','Ngưng kinh doanh','Đặt hàng']],
    ['LINK DATASHEET','Link tài liệu kỹ thuật','text',0,null,'Dán link PDF catalogue / datasheet'],
    ['GHI CHÚ','Ghi chú','area',0] ]}
];
var DB_FLAT_VS=[]; DB_GROUPS_VS.forEach(function(gr){ gr.f.forEach(function(f){ DB_FLAT_VS.push(f); }); });
/* Ngành hàng đang chọn ở trang Nhập dữ liệu -> bộ trường / bộ nhóm tương ứng */
function impGroups_(){ return impLoai_()==='vs'?DB_GROUPS_VS:DB_GROUPS; }
function impFlat_(){ return impLoai_()==='vs'?DB_FLAT_VS:DB_FLAT; }
function nganhCuaSP_(p){ return (p&&VS_SPEC.nganhOf(p.nganh,p.hangMuc)==='vs')?'vs':'den'; }
function groupsCuaSP_(p){ return nganhCuaSP_(p)==='vs'?DB_GROUPS_VS:DB_GROUPS; }
function dbInput(f){
  var i=impFlat_().indexOf(f), lark=f[0], label=f[1], type=f[2], req=f[3], opts=f[4]||[];
  var ph=f[5]||label;                       // gợi ý nhập riêng (nếu có)
  var id='dbf_'+i, star=req?' <span style="color:#c33">*</span>':'', inner;
  var trg=(lark==='GIÁ BÁN LẺ'||lark==='CHIẾT KHẤU ĐẠI LÝ (%)')?' oninput="dbCalcDaiLy()"':'';
  if(type==='calc') inner='<input id="'+id+'" class="calc" type="number" placeholder="Tự tính từ giá bán & %CK" readonly>';
  else if(type==='area') inner='<textarea id="'+id+'" placeholder="'+esc(label)+'" style="min-height:54px"></textarea>';
  else if(type==='hm') inner='<select id="'+id+'" onchange="vsApplyHM_(document.getElementById(\'v-import\'),this.value)"><option value="">— Chọn hạng mục —</option>'
      +opts.map(function(o){return '<option value="'+esc(o)+'">'+esc(o)+'</option>';}).join('')+'</select>';
  else if(type==='sel') inner='<input id="'+id+'" list="dl_'+i+'" placeholder="'+esc(f[6]==='vs'?(ph||label):label)+'"><datalist id="dl_'+i+'">'+opts.map(function(o){return '<option value="'+esc(o)+'">';}).join('')+'</datalist>';
  else inner='<input id="'+id+'"'+(type==='num'?' type="number"':'')+trg+' placeholder="'+esc(ph)+'">';
  return '<div class="field"'+(f[6]==='vs'?' data-vs="'+esc(lark)+'"':'')+'><label>'+esc(label)+star+'</label>'+inner+'</div>';
}
/* THIẾT BỊ VỆ SINH: chỉ hiện thông số của hạng mục đang chọn (form Nhập & modal Sửa dùng chung).
   Ô thuộc hạng mục khác bị ẩn; dấu * và danh sách chọn đổi theo hạng mục (VS_SPEC).          */
function vsApplyHM_(box, hmRaw, hienHetKhiTrong){
  if(!box) return;
  var hm=VS_SPEC.chuanHM(hmRaw), cho=hm?VS_SPEC.labelsOf(hm):(hienHetKhiTrong?VS_SPEC.ALL:[]);
  box.querySelectorAll('[data-vs]').forEach(function(w){
    var lb=w.getAttribute('data-vs'), on=cho.indexOf(lb)>=0;
    w.style.display=on?'':'none'; w.classList.toggle('vs-off',!on);
    w.style.order=on?String(cho.indexOf(lb)):'';          // xếp đúng thứ tự khai báo của hạng mục
    var la=w.querySelector('label'), m=VS_SPEC.METRIC[lb];
    var sao=w.classList.contains('spe-f')?' <span class="spe-req">*</span>':' <span style="color:#c33">*</span>';   // modal Sửa / form Nhập
    if(la) la.innerHTML=esc(m[1])+(on&&VS_SPEC.isReq(hm,lb)?sao:'');
    var dl=w.querySelector('datalist');
    if(dl) dl.innerHTML=VS_SPEC.optsOf(hm,lb).map(function(o){ return '<option value="'+esc(o)+'">'; }).join('');
  });
  // Thẻ nhóm không còn ô nào -> báo chọn hạng mục thay vì để trống trơn
  box.querySelectorAll('.vs-empty').forEach(function(e){ e.style.display=hm?'none':''; });
}
function dbIdOf(label){ var fl=impFlat_(); for(var i=0;i<fl.length;i++) if(fl[i][0]===label) return 'dbf_'+i; return ''; }
function dbCalcDaiLy(){
  var ge=document.getElementById(dbIdOf('GIÁ BÁN LẺ')), ce=document.getElementById(dbIdOf('CHIẾT KHẤU ĐẠI LÝ (%)')), oe=document.getElementById(dbIdOf('GIÁ ĐẠI LÝ'));
  if(!oe) return; var g=Number(ge&&ge.value)||0, ck=Number(ce&&ce.value)||0;
  oe.value = g ? Math.round(g*(1-ck/100)) : '';
}
function imgUrlOf(v){
  v=String(v||'').trim(); if(!v) return '';
  // data:/blob: là ảnh XEM TRƯỚC lúc đang tải lên -> dùng THẲNG.
  // (Trước đây bị bọc thành /media?token=data:... -> 404 -> luôn hiện "ảnh lỗi")
  if(/^(data:|blob:)/i.test(v)) return v;
  if(v.indexOf('http')===0) return v;
  return '/media?token='+encodeURIComponent(v);
}
/* Xem ảnh cỡ lớn: lật ‹ › bằng chuột hoặc phím ←/→, Esc để đóng, có số đếm */
function imgPop_(src){
  if(!src) return;
  /* Ảnh bấm từ BẢNG (hoặc bất kỳ đâu ngoài panel chi tiết) không nằm trong S._pdImgs.
     Trước đây khung xem ảnh chỉ lấy src từ S._pdImgs -> bấm ảnh trong bảng thì khung
     mở ra TRỐNG, mà nếu trước đó từng mở panel SP khác thì lại hiện nhầm ảnh SP cũ.
     Nay: chỉ dùng gallery khi đúng ảnh vừa bấm nằm trong gallery đó.                 */
  var gal=(S._pdImgs&&S._pdImgs.length)?S._pdImgs:[];
  var i=gal.indexOf(src);
  S._popList=(i>=0)?gal:[src];
  S._popIdx=(i>=0)?i:0;
  var o=document.getElementById('imgPop');
  if(!o){
    o=document.createElement('div'); o.id='imgPop'; o.className='imgpop';
    o.innerHTML='<button class="imgpop-nav prev" title="Ảnh trước (←)">‹</button>'
      +'<img alt="">'
      +'<button class="imgpop-nav next" title="Ảnh sau (→)">›</button>'
      +'<span class="imgpop-n"></span><span class="imgpop-x" title="Đóng (Esc)">✕</span>';
    o.addEventListener('click',function(e){
      var b=e.target.closest('.imgpop-nav');
      if(b){ e.stopPropagation(); imgPopGo_(b.classList.contains('prev')?-1:1); return; }
      if(e.target.tagName!=='IMG') imgPopClose_();          // bấm ra ngoài ảnh = đóng
    });
    document.body.appendChild(o);
  }
  imgPopShow_();
  o.style.display='flex';
  document.addEventListener('keydown',imgPopKey_);
}
function imgPopShow_(){
  var o=document.getElementById('imgPop'); if(!o) return;
  var imgs=S._popList||[];
  var i=S._popIdx||0;
  if(imgs[i]) o.querySelector('img').src=imgs[i];
  var many=imgs.length>1;
  o.querySelectorAll('.imgpop-nav').forEach(function(b){ b.style.display=many?'':'none'; });
  var n=o.querySelector('.imgpop-n');
  n.textContent=many?((i+1)+' / '+imgs.length):''; n.style.display=many?'':'none';
}
function imgPopGo_(d){
  var imgs=S._popList||[]; if(imgs.length<2) return;
  S._popIdx=(((S._popIdx||0)+d)%imgs.length+imgs.length)%imgs.length;
  imgPopShow_();
  // chỉ đồng bộ gallery khi đang xem đúng bộ ảnh của panel chi tiết
  if(imgs===S._pdImgs && pdEl_('pdMainImg')) pdSetImg_(S._popIdx);
}
function imgPopClose_(){
  var o=document.getElementById('imgPop'); if(o) o.style.display='none';
  document.removeEventListener('keydown',imgPopKey_);
}
function imgPopKey_(e){
  var o=document.getElementById('imgPop'); if(!o||o.style.display==='none') return;
  if(e.key==='Escape'){ imgPopClose_(); }
  else if(e.key==='ArrowLeft'){ e.preventDefault(); imgPopGo_(-1); }
  else if(e.key==='ArrowRight'){ e.preventDefault(); imgPopGo_(1); }
}
// Ảnh đầu tiên (nhiều ảnh nối bằng xuống dòng) -> URL hợp lệ cho <img src>
function imgSrc1_(v){ return imgUrlOf(String(v||'').split('\n')[0].trim()); }
// Ảnh lỗi: giữ nguyên thẻ img, chỉ báo nhẹ trên khung + cho bấm thử lại (không phá huỷ như trước)
function upImgErr_(img){
  var box=img.closest('.upzone,.upthumb'); if(!box) return;
  if(box.querySelector('.up-err')) return;
  box.classList.add('has-err');
  var d=document.createElement('span'); d.className='up-err';
  d.innerHTML='<b>Không tải được ảnh</b><i onclick="event.stopPropagation();upImgRetry_(this)">Thử lại</i>';
  box.appendChild(d);
}
function upImgOk_(img){
  var box=img.closest('.upzone,.upthumb'); if(!box) return;
  box.classList.remove('has-err');
  var e=box.querySelector('.up-err'); if(e) e.remove();
}
function upImgRetry_(el){
  var box=el.closest('.upzone,.upthumb'); if(!box) return;
  var img=box.querySelector('img'); if(!img) return;
  var e=box.querySelector('.up-err'); if(e) e.remove();
  box.classList.remove('has-err');
  var src=img.getAttribute('src'); img.setAttribute('src','');
  setTimeout(function(){ img.setAttribute('src', src+(src.indexOf('?')>=0?'&':'?')+'r='+Date.now()); },40);
}
// Vùng thả LUÔN giữ nguyên (không bị ảnh chiếm chỗ) -> 2 cột giống hệt nhau
function upMainInner(){
  return '<div class="upic">'+icon('camera',26)+'</div>'
    +'<div class="up-t">'+(S._imgMain?'Kéo/thả hoặc bấm để ĐỔI ảnh':'Kéo/thả hoặc bấm để chọn')+'</div>'
    +'<div class="up-s">ảnh chính hiện trong bảng &amp; báo giá — <b>chỉ 1 ảnh</b></div>'
    +'<div class="up-paste">'+icon('copy',11)+' hoặc dán ảnh bằng Ctrl+V</div>';
}
// Ảnh đại diện hiện thành THUMBNAIL Ở GÓC — cùng kiểu, cùng vị trí với ảnh chi tiết
function upMainGridInner_(){
  if(!S._imgMain) return '';
  return '<div class="upthumb is-main"><img src="'+esc(imgUrlOf(S._imgMain))+'" onerror="upImgErr_(this)" onload="upImgOk_(this)">'
    +'<button class="upx" title="Xoá ảnh" onclick="event.stopPropagation();upRemove(\'main\')">✕</button>'
    +'<span class="upnum main">'+icon('star',10)+'</span></div>';
}
function upGridInner(){
  return (S._imgList||[]).map(function(v,i){
    return '<div class="upthumb"><img src="'+esc(imgUrlOf(v))+'" onerror="this.style.visibility=\'hidden\'">'
      +'<button class="upx" title="Xoá" onclick="event.stopPropagation();upRemove(\'more\','+i+')">✕</button>'
      +'<button class="upstar" title="Đặt làm hình đại diện" onclick="event.stopPropagation();upMakeMain_('+i+')">'+icon('star',11)+'</button>'
      +'<span class="upnum">'+(i+1)+'</span></div>';
  }).join('') || '';
}
// đặt 1 ảnh chi tiết thành ảnh đại diện (đổi chỗ)
function upMakeMain_(i){
  var list=S._imgList||[]; if(i<0||i>=list.length) return;
  var old=S._imgMain; S._imgMain=list[i];
  if(old) list[i]=old; else list.splice(i,1);
  upRefresh(); toast('Đã đặt làm hình đại diện');
}
function upRefresh(){
  var a=document.getElementById('upMain'); if(a)a.innerHTML=upMainInner();
  var g=document.getElementById('upMainGrid'); if(g)g.innerHTML=upMainGridInner_();
  var b=document.getElementById('upGrid'); if(b)b.innerHTML=upGridInner();
  var bs=document.querySelectorAll('.imgup .upbadge');
  if(bs[0]) bs[0].textContent=S._imgMain?'1 ảnh':(impLoai_()==='pt'?'tuỳ chọn':'bắt buộc');
  if(bs[1]) bs[1].textContent=(S._imgList||[]).length?((S._imgList||[]).length+' ảnh'):'tuỳ chọn';
}
function imgSection(){ return '<div class="dbcard"><div class="dbcard-h"><span class="dbcard-ic">'+icon('camera',18)+'</span><h3>Ảnh sản phẩm</h3>'
    +'<span class="sp" style="flex:1"></span><span class="up-hint2">'+icon('image',13)+' JPG · PNG · WEBP · tối đa 5MB</span></div>'
    +'<div class="dbcard-b">'+imgUpBlock_()+'</div></div>'; }
// Khối upload ảnh — dùng CHUNG cho trang Nhập dữ liệu và modal Sửa sản phẩm
function imgUpBlock_(cls){
  return '<div class="imgup '+(cls||'')+'">'
    +'<div class="upcol">'
      +'<div class="uphead"><span class="uplabel">Hình đại diện</span><span class="upbadge">'+(S._imgMain?'1 ảnh':'bắt buộc')+'</span></div>'
      +'<div class="upzone upmain" id="upMain" tabindex="0" onclick="upPick(\'main\')" ondragover="upDrag(event,1)" ondragleave="upDrag(event,0)" ondrop="upDrop(event,\'main\')">'+upMainInner()+'</div>'
      +'<div class="upgrid" id="upMainGrid">'+upMainGridInner_()+'</div>'
      +upUrlRow_('main')
    +'</div>'
    +'<div class="upcol">'
      +'<div class="uphead"><span class="uplabel">Hình chi tiết sản phẩm</span><span class="upbadge">'+((S._imgList||[]).length?((S._imgList||[]).length+' ảnh'):'tuỳ chọn')+'</span></div>'
      +'<div class="upzone upmore" id="upMore" tabindex="0" onclick="upPick(\'more\')" ondragover="upDrag(event,1)" ondragleave="upDrag(event,0)" ondrop="upDrop(event,\'more\')">'+upMoreInner_()+'</div>'
      +'<div class="upgrid" id="upGrid">'+upGridInner()+'</div>'
      +upUrlRow_('more')
    +'</div></div>';
}
function upUrlRow_(k){
  var id=(k==='main'?'upMainUrl':'upMoreUrl');
  return '<div class="upurl"><span class="upurl-ic">'+icon('link',13)+'</span>'
    +'<input id="'+id+'" placeholder="Dán link ảnh…" onkeydown="if(event.key===\'Enter\'){event.preventDefault();upAddUrl(\''+k+'\');}">'
    +'<button class="upurl-btn" onclick="upAddUrl(\''+k+'\')">Thêm</button></div>';
}
function upMoreInner_(){
  return '<div class="upic">'+icon('camera',26)+'</div>'
    +'<div class="up-t">Kéo/thả hoặc bấm để chọn</div>'
    +'<div class="up-s">chọn được <b>nhiều ảnh</b> cùng lúc</div>'
    +'<div class="up-paste">'+icon('copy',11)+' hoặc dán ảnh bằng Ctrl+V</div>';
}
var DB_GICON={'Thông tin cơ bản':'tag','Thông tin giá bán':'money','Key Product Info (Thông tin chính)':'bulb','Thông số thiết kế':'ruler','Performance Specifications (Thông số hiệu suất)':'gauge','Driver (Nguồn LED / Chấn lưu)':'plug','Installation Specifications (Thông số lắp đặt)':'wrench','Thương mại':'sliders'};
function dbCard_(title, ic, note, inner){
  return '<div class="dbcard"><div class="dbcard-h"><span class="dbcard-ic">'+(icon(ic,18)||esc(ic))+'</span><h3>'+esc(title)+'</h3></div>'
    +'<div class="dbcard-b">'+(note?'<p class="dbnote">'+esc(note)+'</p>':'')+inner+'</div></div>';
}
function impStatBar(){
  var ps=S._sessionAdded||[];  // đếm theo SP nhập trong PHIÊN NÀY (khớp danh sách bên phải)
  var brands={}, nccs={}; ps.forEach(function(p){ if(p.thuongHieu)brands[p.thuongHieu]=1; if(p.ncc)nccs[p.ncc]=1; });
  function stat(label,val){ return '<div class="imp-stat"><div class="imp-stat-v">'+val+'</div><div class="imp-stat-l">'+esc(label)+'</div></div>'; }
  return '<div class="imp-statbar">'
    +impNganhSel_()
    +stat('Số lượng SKU đã nhập',ps.length)
    +stat('Số lượng Brand',Object.keys(brands).length)
    +stat('Số lượng nhà cung cấp',Object.keys(nccs).length)
    +'</div>';
}
function impDateTime_(iso){
  try{ var d=new Date(iso); if(isNaN(d)) return ''; var p=function(n){return (n<10?'0':'')+n;};
    var h=d.getHours(), ap=h<12?'AM':'PM', h12=h%12||12;
    return p(h12)+':'+p(d.getMinutes())+' '+ap+'<br>'+p(d.getDate())+'/'+p(d.getMonth()+1)+'/'+d.getFullYear();
  }catch(e){ return ''; }
}
function impRecentList(){
  var ps=(S._sessionAdded||[]);  // CHỈ SP thêm/nhập trong PHIÊN hiện tại
  var pd=(S._pending||[]);        // chờ lưu: chưa vào Database cho tới khi bấm "Thêm sản phẩm"
  // Thẻ chờ lưu: ảnh · tên (2 dòng) · mã/biến thể · thương hiệu · trạng thái + 2 nút rõ ràng Sửa / Xoá
  var pCards=pd.map(function(p,i){
    var img=p.hinhAnh?'<img class="pc-th" src="'+esc(imgSrc1_(p.hinhAnh))+'" onerror="this.style.visibility=\'hidden\'">':'<span class="pc-th pc-noimg">'+icon('image',14)+'</span>';
    var dangSua=(S._pendEdit===p.uid);
    var phu=[p.ma, p.thuongHieu].filter(Boolean).join(' · ');
    return '<div class="pc'+(p.loi?' err':'')+(dangSua?' editing':'')+'">'+img
      +'<div class="pc-mid"><div class="pc-name" title="'+esc(p.ten||'')+'">'+esc(p.ten||'')+'</div>'
        +(p.bienThe?'<div class="pc-bt" title="Biến thể">'+esc(p.bienThe)+'</div>':'')      // biến thể dòng riêng để phân biệt thẻ
        +(phu?'<div class="pc-sub" title="'+esc(phu)+'">'+esc(phu)+'</div>':'')
        +(p.loi?'<div class="pc-loi">'+esc(p.loi)+'</div>':'')
        +'<span class="pc-tag">'+(dangSua?'Đang sửa':(p.loi?'Lỗi — sửa lại':'Chờ lưu'))+'</span></div>'
      +'<div class="pc-act">'
        +'<button class="pc-btn" title="Sửa — mở lại trong form" onclick="pendingEdit_('+i+')">'+icon('edit',14)+'</button>'
        +'<button class="pc-btn del" title="Xoá khỏi danh sách chờ" onclick="pendingDel_('+i+')">'+icon('trash',14)+'</button>'
      +'</div></div>';
  }).join('');
  var rows=ps.map(function(p,i){
    var im=String(p.hinhAnh||'').split('\n')[0];
    var img=im?'<img class="imp-rth" src="'+esc(imgSrc1_(p.hinhAnh))+'" onerror="this.style.visibility=\'hidden\'">':'<span class="imp-rth"></span>';
    var sua = p.ma
      ? '<button class="imp-redit" title="'+(p.nhieuBienThe?'Sửa biến thể đầu tiên của mã '+esc(p.ma):'Sửa lại sản phẩm này')+'" onclick="impEditSession_('+i+')">'+icon('edit',13)+'</button>'
      : '<span class="imp-redit dis" title="Không rõ mã sản phẩm — mở Danh sách sản phẩm để sửa">'+icon('edit',13)+'</span>';
    return '<tr><td class="c imp-ract">'+sua+'</td><td class="c">'+(i+1)+'</td>'
      +'<td class="imp-rname">'+esc(p.ten||'')
      +(p.ma?'<i class="imp-rma">'+esc(p.ma)+'</i>':'')+'</td><td class="c">'+img+'</td>'
      +'<td>'+esc(p.thuongHieu||'—')+'</td><td class="imp-rdate">'+(impDateTime_(p.capNhat)||'—')+'</td></tr>';
  }).join('');
  if(!pCards && !rows) rows='<tr><td colspan="6" class="empty" style="padding:24px 12px;font-size:12.5px;line-height:1.5">Chưa nhập sản phẩm nào trong phiên này.<br>Sản phẩm bạn <b>thêm / nhập file</b> sẽ hiện ở đây — bấm <b>Thêm sản phẩm</b> để lưu vào Database.</td></tr>';
  var choHtml=pd.length?('<div class="pc-hd">Chờ lưu <span>'+pd.length+'</span><i>Chưa vào Database</i></div><div class="pc-list">'+pCards+'</div>'):'';
  var daHd=(pd.length&&ps.length)?'<div class="pc-hd done">Đã lưu vào Database <span>'+ps.length+'</span></div>':'';
  var nut='<div class="imp-rfoot">'
    +(pd.length?'<div class="imp-rfoot-note"><b>'+pd.length+'</b> sản phẩm đang chờ — <b>chưa</b> lưu vào Database</div>':'')
    +'<button class="btn blue block" id="pendBtn" onclick="pendingCommit_(this)"'+((pd.length&&!S._committing)?'':' disabled')+'>'
    +(S._committing?'⏳ Đang lưu vào Database…':(icon('plus',15)+' Thêm sản phẩm'+(pd.length?' ('+pd.length+')':'')))+'</button></div>';
  return '<div class="imp-recent-h">Sản phẩm vừa nhập (phiên này) <span class="count">'+pad2(pd.length+ps.length)+'</span></div>'
    +'<div class="imp-recent-note">Danh sách này chỉ ghi lại thao tác của <b>phiên đang mở</b> — tải lại trang sẽ trống. '
    +'Sản phẩm đã lưu <b>vẫn nằm trong Database</b>: <a onclick="showTab(\'sanpham\')">xem Danh sách sản phẩm →</a></div>'
    +'<div class="imp-recent-b">'+choHtml+daHd
      +(rows?'<table class="imp-rtbl"><thead><tr><th class="c">Sửa</th><th class="c">STT</th><th>Tên sản phẩm</th><th class="c">Hình ảnh</th><th>Thương hiệu</th><th>Ngày cập nhật</th></tr></thead><tbody>'+rows+'</tbody></table>':'')+'</div>'
    +nut;
}
/* ═══ DANH SÁCH CHỜ LƯU ═══
   Form Nhập / file Excel chỉ đưa SP vào S._pending (hiện ở panel phải, nhãn "Chờ lưu").
   Bấm "Thêm sản phẩm" mới ghi vào Database: SP từ form -> saveDbProduct từng cái,
   SP từ file -> importCommit cả lô (server kiểm tra hạng mục / thông số bắt buộc).
   Lưu được -> chuyển sang danh sách "đã nhập"; lỗi -> ở lại, hiện lý do.          */
var _pendSeq=0;
function pendUid_(){ return 'p'+(++_pendSeq); }
function pendingAdd_(items){ (items||[]).forEach(function(x){ if(!x.uid) x.uid=pendUid_(); });
  S._pending=(items||[]).concat(S._pending||[]); impRecentRefresh_(); }
function pendingDel_(i){
  var it=(S._pending||[])[i]; if(!it) return;
  if(!confirm('Xoá "'+it.ten+'" khỏi danh sách chờ?\n(Sản phẩm chưa được lưu vào Database nên sẽ mất hẳn.)')) return;
  S._pending.splice(i,1);
  if(S._pendEdit===it.uid){ S._pendEdit=null; renderImport(); } else impRecentRefresh_();
}
/* SỬA 1 dòng chờ: nạp lại vào đúng form (đúng ngành, hạng mục, thông số, ảnh) để chỉnh,
   bấm "Cập nhật vào danh sách chờ" thì thay đúng dòng đó. Dòng từ file Excel cũng sửa được như vậy. */
function pendItemData_(it){
  if(it.kind==='form') return Object.assign({}, it.data);
  var d=Object.assign({}, (it.prod&&it.prod._raw)||{}), p=it.prod||{};
  var fill=function(k,v){ if(!String(d[k]||'').trim() && v) d[k]=v; };
  fill('TÊN SẢN PHẨM',p.ten); fill('MÃ SẢN PHẨM',p.ma); fill('THƯƠNG HIỆU',p.thuongHieu); fill('NHÀ CUNG CẤP',p.ncc);
  fill('HẠNG MỤC',p.hangMuc); fill('GIÁ BÁN LẺ',p.gia?String(p.gia):''); fill('ĐƠN VỊ TÍNH',p.dvt);
  if(p.hinhAnh) d['ẢNH SẢN PHẨM']=p.hinhAnh;
  return d;
}
function pendNganhLoai_(it){ return (it.nganh==='vs'||pendItemData_(it)['NGÀNH HÀNG']==='vs')?'vs':'sp'; }
function pendingEdit_(i){
  var it=(S._pending||[])[i]; if(!it) return;
  if(S._committing){ toast('Đang lưu vào Database — đợi xong rồi sửa'); return; }
  if(S._pendEdit && S._pendEdit!==it.uid && !confirm('Đang sửa một sản phẩm khác — bỏ các thay đổi chưa cập nhật?')) return;
  S._pendEdit=it.uid;
  S._impLoai=pendNganhLoai_(it);
  renderImport();                             // renderImport tự nạp dữ liệu dòng đang sửa vào form
  var f0=document.querySelector('#v-import .dbwrap'); if(f0&&f0.scrollIntoView) f0.scrollIntoView({behavior:'smooth',block:'start'});
  toast('Đã mở "'+it.ten+'" trong form — sửa xong bấm "Cập nhật vào danh sách chờ"');
}
function pendFillForm_(it){
  var d=pendItemData_(it);
  var box=document.getElementById('v-import');
  impFlat_().forEach(function(f){
    var el=document.getElementById(dbIdOf(f[0])); if(!el) return;
    var v=d[f[0]]; if(f[0]==='HẠNG MỤC' && S._impLoai==='vs') v=VS_SPEC.chuanHM(v)||v;
    if(v!=null && v!=='') el.value=String(v);
  });
  if(S._impLoai==='vs') vsApplyHM_(box, d['HẠNG MỤC']);
  dbCalcDaiLy();
  var imgs=String(d['ẢNH SẢN PHẨM']||it.hinhAnh||'').split('\n').map(function(x){ return x.trim(); }).filter(Boolean);
  S._imgMain=imgs[0]||''; S._imgList=imgs.slice(1); upRefresh();
  // ghi danh dự án đã chọn trước đó
  if(it.ghi){ var gd=document.getElementById('impGhiDanh'), ps=document.getElementById('impProjSel'), sl=document.getElementById('impGhiSL');
    if(gd) gd.checked=true; if(ps) ps.value=it.ghi.maDA; if(sl) sl.value=it.ghi.qty; }
}
function pendingEditCancel_(){ S._pendEdit=null; renderImport(); }
function impRecentRefresh_(){
  var box=document.getElementById('impRecentBox'); if(box) box.innerHTML=impRecentList();
  var sb=document.querySelector('#v-import .imp-statbar'); if(sb && impLoai_()!=='pt') sb.outerHTML=impStatBar();
}
window.addEventListener('beforeunload',function(e){
  if((S._pending||[]).length||(S._ctPending||[]).length){ e.preventDefault(); e.returnValue='Còn dữ liệu chưa lưu vào Database'; return e.returnValue; }
});
async function pendingCommit_(btn){
  if(S._committing) return;                          // đang lưu -> bỏ qua lần bấm thứ 2
  var ds=(S._pending||[]).slice(); if(!ds.length){ toast('Chưa có sản phẩm nào chờ lưu'); return; }
  if(S._pendEdit && !confirm('Bạn đang sửa 1 sản phẩm trong form nhưng chưa bấm "Cập nhật".\nLưu luôn bản CŨ của sản phẩm đó?')) return;
  if(S._pendEdit){ S._pendEdit=null; renderImport(); }
  S._committing=true; impRecentRefresh_(); btn=document.getElementById('pendBtn');
  try{ await pendingCommitRun_(ds, btn); }
  finally{ S._committing=false; impRecentRefresh_(); }
}
async function pendingCommitRun_(ds, btn){
  if(btn){ btn.disabled=true; btn.textContent='⏳ Đang lưu 0/'+ds.length+'…'; }
  var ok=0, loi=0, conLai=[], ghiN=0;
  var form=ds.filter(function(x){ return x.kind==='form'; }), file=ds.filter(function(x){ return x.kind==='file'; });
  for(var k=0;k<form.length;k++){
    var it=form[k];
    try{
      await api('saveDbProduct', it.data); ok++;
      sessionAdd_({ten:it.ten+(it.bienThe?' ('+it.bienThe+')':''), ma:it.ma, thuongHieu:it.thuongHieu, ncc:it.ncc, hinhAnh:it.hinhAnh});
      if(it.ghi){ try{ await api('addLine', it.ghi.maDA, it.ghi.prod, it.ghi.qty); ghiN++;
          if(S.cur&&S.cur.maDA===it.ghi.maDA){ S.lines=await api('getLines',it.ghi.maDA)||S.lines; } }
        catch(e3){ toast('Lưu "'+it.ten+'" OK nhưng ghi danh dự án lỗi: '+e3.message); } }
    }catch(e){ loi++; it.loi=e.message.slice(0,160); conLai.push(it); }
    if(btn) btn.textContent='⏳ Đang lưu '+(k+1)+'/'+ds.length+'…';
  }
  if(file.length){
    try{
      var r=await api('importCommit', file.map(function(x){ return x.prod; }));
      // Lỗi trả về theo CHỈ SỐ dòng (i) — 2 biến thể cùng tên không bị báo lỗi lẫn nhau
      var bad={}; (r.errors||[]).forEach(function(e){ if(e.i!=null) bad[e.i]=e.error; });
      file.forEach(function(it,fi){
        if(bad[fi]!=null){ loi++; it.loi=String(bad[fi]).slice(0,160); conLai.push(it); }
        else { ok++; sessionAdd_({ten:it.ten, ma:it.ma, thuongHieu:it.thuongHieu, ncc:it.ncc, hinhAnh:it.hinhAnh}); }
      });
    }catch(e){ file.forEach(function(it){ loi++; it.loi=e.message.slice(0,160); conLai.push(it); }); }
  }
  // Chỉ bỏ những dòng đã lưu xong — dòng thêm/sửa TRONG LÚC đang lưu vẫn được giữ lại
  var xong={}; ds.forEach(function(x){ if(conLai.indexOf(x)<0) xong[x.uid]=1; });
  S._pending=(S._pending||[]).filter(function(x){ return !xong[x.uid]; });
  try{ S.products=await api('getProducts')||S.products; }catch(e){}
  impRecentRefresh_();
  try{ renderFilters(); renderCatalog(); }catch(e){}     // làm mới panel Bóc tách (nếu đang dựng)
  var msg='Đã lưu '+ok+' sản phẩm vào Database'+(ghiN?(' · ghi danh '+ghiN+' vào dự án'):'');
  if(loi) alert(msg+'.\n\n'+loi+' sản phẩm KHÔNG lưu được (vẫn nằm trong danh sách chờ, nhãn "Lỗi"):\n'
    +conLai.slice(0,30).map(function(x){ return '• '+x.ten+': '+x.loi; }).join('\n'));
  else toast(msg);
}
/* ═══ SỬA LẠI SẢN PHẨM NGAY Ở PANEL "SP VỪA NHẬP" ═══
   Mở đúng modal Cập nhật sản phẩm đang dùng ở Danh sách SP, nên mọi trường,
   lịch sử sửa và sản phẩm đi kèm đều y hệt — không phải dựng form thứ hai. */
async function impEditSession_(i){
  var s=(S._sessionAdded||[])[i]; if(!s||!s.ma) return;
  if(!(S.products||[]).length){ try{ S.products=await api('getProducts')||[]; }catch(e){} }
  var ma=String(s.ma).trim().toLowerCase();
  var p=(S.products||[]).filter(function(x){ return String(x.ma||'').trim().toLowerCase()===ma; })[0];
  if(!p){ toast('Không tìm thấy "'+s.ma+'" trong danh mục — có thể đã bị xoá'); return; }
  spEditModal(p);
}
/* Sau khi lưu ở modal: cập nhật lại dòng trong panel phiên cho khớp dữ liệu mới */
function impSyncSession_(key){
  var ds=S._sessionAdded||[]; if(!ds.length||!key) return;
  var k=String(key).trim().toLowerCase();
  var p=(S.products||[]).filter(function(x){
    return String(x.ma||'').trim().toLowerCase()===k || String(x.recordId||'')===String(key); })[0];
  if(!p) return;
  var pm=String(p.ma||'').trim().toLowerCase();
  ds.forEach(function(s){
    if(String(s.ma||'').trim().toLowerCase()!==pm) return;
    if(!s.nhieuBienThe) s.ten=p.ten||s.ten;         // dòng gộp biến thể giữ nguyên nhãn "(N biến thể)"
    s.thuongHieu=p.thuongHieu||s.thuongHieu;
    s.hinhAnh=p.hinhAnh||s.hinhAnh;
    s.capNhat=nowIsoClient_();
  });
  var box=document.getElementById('impRecentBox');
  if(box) box.innerHTML=impRecentList();
}
function sessionAdd_(o){ S._sessionAdded=S._sessionAdded||[];
  S._sessionAdded.unshift({ten:o.ten||'',ma:o.ma||'',thuongHieu:o.thuongHieu||'',ncc:o.ncc||'',
    hinhAnh:o.hinhAnh||'',capNhat:o.capNhat||nowIsoClient_(), nhieuBienThe:!!o.nhieuBienThe}); }
function nowIsoClient_(){ try{ return new Date().toISOString(); }catch(e){ return ''; } }
// Tab Nhập dữ liệu có 2 hạng mục: Sản phẩm (đèn) và Phần thô (công tác xây dựng)
function impLoai_(){ return S._impLoai||'sp'; }
function impSetLoai(v){ S._impLoai=v; renderImport(); }
// Chọn hạng mục để nhập — gộp thẳng vào ô "Ngành hàng" (trước đây là 1 hàng tab riêng)
var IMP_LOAI=[['sp','Thiết bị đèn · sản phẩm'],['vs','Thiết bị vệ sinh · sản phẩm'],['pt','Xây dựng · công tác phần thô']];
/* Ô chọn NGÀNH HÀNG ở trang Nhập dữ liệu — dựng đúng dáng ô chọn hạng mục
   (nhãn + ô viền tròn kèm số đếm) để cả web chỉ còn một kiểu ô chọn. */
function impNganhDem_(v){
  if(v==='pt') return (typeof spPTAll_==='function')?spPTAll_().length:0;   // thư viện công tác
  var ng=(v==='vs')?'vs':'den';
  return (S.products||[]).filter(function(p){ return nganhCuaSP_(p)===ng; }).length;
}
function impNganhSel_(){
  var cur=impLoai_(), ten=(IMP_LOAI.filter(function(x){ return x[0]===cur; })[0]||['',''])[1];
  return '<div class="hm-wrap"><span class="hm-lbl">Ngành hàng</span>'
    +'<span class="count">['+pad2(impNganhDem_(cur))+']</span>'
    +'<button class="tree-btn hm-open on" id="ngBtn" onclick="ngPop_(event)" title="Chọn ngành hàng">'
      +'<span class="hm-name">'+esc(ten)+'</span>'
      +'<span class="cnt">['+pad2(impNganhDem_(cur))+']</span>'
    +'</button></div>';
}
function ngPop_(e){
  if(e&&e.stopPropagation) e.stopPropagation();
  var id='ngPop'; if(document.getElementById(id)){ ngPopClose_(); return; }
  var cur=impLoai_(), pop=document.createElement('div');
  pop.className='fltpop bgtree'; pop.id=id;
  pop.innerHTML='<div class="bgt-h"><b>Chọn ngành hàng</b>'
      +'<button class="colpop-x" onclick="ngPopClose_()">✕</button></div>'
    +'<div class="bgt-b">'+IMP_LOAI.map(function(x){
        var on=(cur===x[0]);
        return '<div class="bgt-i lvl1'+(on?' on':'')+'" onclick="ngPick_(\''+x[0]+'\')">'
          +'<span class="nm">'+esc(x[1])+'</span>'
          +'<span class="cn">['+pad2(impNganhDem_(x[0]))+']</span>'
          +'<span class="rd'+(on?' on':'')+'"></span></div>';
      }).join('')+'</div>';
  document.body.appendChild(pop);
  var b=document.getElementById('ngBtn');
  if(b){ var r=b.getBoundingClientRect(), w=pop.offsetWidth||330, h=pop.offsetHeight;
    var top=r.bottom+6; if(top+h>window.innerHeight-10) top=Math.max(10, r.top-h-6);
    pop.style.top=top+'px'; pop.style.left=Math.max(8,Math.min(r.left, window.innerWidth-w-10))+'px'; }
  setTimeout(function(){ document.addEventListener('mousedown',ngOutside_); },0);
}
function ngOutside_(e){ if(e.target.closest('#ngPop')||e.target.closest('#ngBtn')) return; ngPopClose_(); }
function ngPopClose_(){ var p=document.getElementById('ngPop'); if(p) p.remove(); document.removeEventListener('mousedown',ngOutside_); }
function ngPick_(v){ ngPopClose_(); impSetLoai(v); }
function impLoaiTabs_(){ return ''; }
function renderImport(){
  if(impLoai_()==='pt') return renderImportPT_();
  // Đang sửa 1 dòng chờ: chỉ giữ chế độ sửa nếu dòng còn tồn tại và ĐÚNG ngành đang xem (đổi ngành = huỷ sửa)
  var suaIt=S._pendEdit?(S._pending||[]).filter(function(x){ return x.uid===S._pendEdit; })[0]:null;
  if(S._pendEdit && (!suaIt || pendNganhLoai_(suaIt)!==impLoai_())){ S._pendEdit=null; suaIt=null; }
  S._imgMain=''; S._imgList=[];
  var box=document.getElementById('v-import');
  var form='<div class="dbwrap">'
    +imgSection()
    +impGroups_().map(function(gr){
      return dbCard_(gr.g, DB_GICON[gr.g]||'doc', gr.note,
        (gr.vs?'<div class="vs-empty dbnote">Chọn <b>Hạng mục</b> ở phần Thông tin cơ bản để hiện đúng thông số của hạng mục đó.</div>':'')
        +'<div class="dbgrid">'+gr.f.map(dbInput).join('')+'</div>');
    }).join('')
    +dbCard_('Nhập biến thể (tuỳ chọn)','sliders','Nhập nhiều giá trị cách nhau bằng dấu phẩy — hệ thống tạo 1 sản phẩm cho MỖI tổ hợp (cùng mã SP, khác thông số).',
      '<div class="dbgrid">'
      // Ba trục dưới chỉ có nghĩa với ĐÈN — ngành vệ sinh chỉ tách biến thể theo MÀU
      +((impLoai_()==='vs')
        ?'<div class="field"><label>Kích thước</label><input id="varSize" placeholder="VD: L580 x W380, L620 x W390" oninput="varPreview_()"></div>'
        :('<div class="field"><label>Nhiệt độ màu (K)</label><input id="varKelvin" placeholder="VD: 3000, 4000, 6500" oninput="varPreview_()"></div>'
         +'<div class="field"><label>Công suất (W)</label><input id="varWatt" placeholder="VD: 7, 9, 12" oninput="varPreview_()"></div>'
         +'<div class="field"><label>Góc chiếu (°)</label><input id="varAngle" placeholder="VD: 24, 36, 60" oninput="varPreview_()"></div>'))
      +'<div class="field"><label>Màu sắc</label><input id="varColor" placeholder="VD: Đen, Trắng, Vàng" oninput="varPreview_()"></div>'
      +'</div><div class="var-note" id="varNote">Bỏ trống = chỉ tạo 1 sản phẩm theo thông số đã nhập ở trên.</div>')
    +dbCard_('Ghi danh vào dự án','building','Tuỳ chọn — đưa sản phẩm này vào một dự án ngay sau khi lưu vào Database.',
      '<div class="dbgrid">'
      +'<div class="field"><label>Dự án</label><select id="impProjSel"><option value="">— Không ghi danh —</option>'
        +(S.projects||[]).map(function(p){ return '<option value="'+esc(p.maDA)+'"'+(S.cur&&S.cur.maDA===p.maDA?' selected':'')+'>'+esc(p.ten)+'</option>'; }).join('')+'</select></div>'
      +'<div class="field"><label>Số lượng</label><input type="number" id="impGhiSL" min="1" value="1"></div>'
      +'</div><label class="imp-ghck"><input type="checkbox" id="impGhiDanh"> Thêm sản phẩm này vào dự án đã chọn sau khi lưu</label>')
    +(S._pendEdit
      ?'<div class="savebar"><div class="pe-note">'+icon('edit',14)+' Đang sửa 1 sản phẩm trong danh sách chờ — chỉnh xong bấm <b>Cập nhật</b></div>'
        +'<button class="btn blue block" onclick="tdSave(this)">'+icon('check',15)+' Cập nhật vào danh sách chờ</button>'
        +'<button class="btn ghost sm" onclick="pendingEditCancel_()" style="margin-top:8px">Huỷ sửa</button></div>'
      :'<div class="savebar"><button class="btn blue block" onclick="tdSave(this)">Đưa vào danh sách chờ</button><button class="btn ghost sm" onclick="renderImport()" style="margin-top:8px">Xoá form</button></div>')
    +dbCard_('Nhập hàng loạt từ file', 'download', 'Tải file mẫu → điền dữ liệu → chọn file lên. Hệ thống tự dò cột theo tiêu đề; tải ảnh cho từng SP rồi đưa vào danh sách chờ — bấm Thêm sản phẩm để lưu.',
      '<div class="imp-file-row">'
      +((impLoai_()==='vs')
        ?'<a class="btn ghost sm" href="/mau-nhap-thiet-bi-ve-sinh.xlsx" download="Mau-nhap-thiet-bi-ve-sinh-DezonQS.xlsx">'+icon('download',14)+' Tải file mẫu thiết bị vệ sinh</a>'
        :'<a class="btn ghost sm" href="/mau-nhap-hang-loat.xlsx" download="Mau-nhap-hang-loat-DezonQS.xlsx">'+icon('download',14)+' Tải file mẫu</a>')
      +'<span class="imp-file-sep"></span><input type="file" id="impFile" accept=".xlsx,.xls,.csv" onchange="impPick(this)" style="font:inherit"></div>'
      +'<div id="impPreview" style="margin-top:12px"></div>')
    +'</div>';
  box.innerHTML='<div class="sechd imp-sechd"><h2>Nhập dữ liệu</h2>'
      +'<span class="imp-sub">Thêm sản phẩm vào danh mục · <b>*</b> bắt buộc</span></div>'
    +impLoaiTabs_()+impStatBar()
    +'<div class="imp-layout">'+form+'<div class="imp-recent" id="impRecentBox">'+impRecentList()+'</div></div>';
  if(impLoai_()==='vs') vsApplyHM_(box,'');
  if(suaIt) pendFillForm_(suaIt);            // nạp lại dữ liệu dòng đang sửa (sau đổi tab / vẽ lại)
}
/* Nhập dữ liệu — hạng mục PHẦN THÔ: thêm công tác xây dựng vào cơ sở dữ liệu */
function renderImportPT_(){
  var box=document.getElementById('v-import'); if(!box) return;
  var n=(S.congTac||[]).length;
  var chuaDuyet=(S.congTac||[]).filter(function(c){ return !c.daDuyet; }).length;
  var sua=ctPendItem_(S._ctPendEdit);                 // đang sửa 1 công tác trong danh sách chờ
  if(S._ctPendEdit && !sua) S._ctPendEdit=null;
  // Ảnh: dùng CHUNG khối "Ảnh sản phẩm" của form SP (ảnh đại diện + ảnh chi tiết, kéo-thả / dán)
  var anh=String((sua&&sua.d.hinhAnh)||'').split('\n').map(function(x){ return x.trim(); }).filter(Boolean);
  S._imgMain=anh[0]||''; S._imgList=anh.slice(1);
  var form='<div class="dbwrap ctimp">'
    +imgSection().replace('<h3>Ảnh sản phẩm</h3>','<h3>Ảnh công tác</h3>')
        .replace('Hình chi tiết sản phẩm','Hình chi tiết công tác')
        .replace('>bắt buộc<','>tuỳ chọn<')               // công tác không bắt buộc ảnh
    +ctFormHtml2_(sua?sua.d:{},'imp')
    +'<div class="savebar">'
      +(sua?'<div class="pe-note">'+icon('edit',14)+' Đang sửa 1 công tác trong danh sách chờ — chỉnh xong bấm <b>Cập nhật</b></div>':'')
      +'<label class="imp-ghck"><input type="checkbox" id="impCtGhi"'+((sua?sua.ghi:S._ctGhi)?' checked':'')+' onchange="S._ctGhi=this.checked">'
        +' Thêm luôn vào bảng khái toán của dự án đang chọn'+(S.cur?(' — '+esc(S.cur.ten)):' (chưa chọn dự án)')+'</label>'
      +(sua
        ?'<button class="btn blue block" onclick="ctImpSave(this)">'+icon('check',15)+' Cập nhật vào danh sách chờ</button>'
          +'<button class="btn ghost sm" onclick="S._ctPendEdit=null;renderImportPT_()" style="margin-top:8px">Huỷ sửa</button>'
        :'<button class="btn blue block" onclick="ctImpSave(this)">Đưa vào danh sách chờ</button>'
          +'<button class="btn ghost sm" onclick="renderImport()" style="margin-top:8px">Xoá form</button>')
    +'</div></div>';
  var recent='<div class="imp-recent" id="impRecentBox">'+ctRecentList_()+'</div>';
  function stat(label,val){ return '<div class="imp-stat"><div class="imp-stat-v">'+val+'</div><div class="imp-stat-l">'+esc(label)+'</div></div>'; }
  box.innerHTML='<div class="sechd imp-sechd"><h2>Nhập dữ liệu</h2>'
      +'<span class="imp-sub">Thêm công tác xây dựng vào thư viện Phần thô · <b>*</b> bắt buộc</span></div>'
    +impLoaiTabs_()
    +'<div class="imp-statbar">'
      +impNganhSel_()
      +stat('Công tác trong CSDL',n)+stat('Chờ duyệt',chuaDuyet)+stat('Hạng mục',ctHangMucList_().length)
    +'</div>'
    +'<div class="imp-layout">'+form+recent+'</div>';
  S._ctGrp={}; ctFormInit_('imp');
}
/* ═══ CÔNG TÁC: DANH SÁCH CHỜ LƯU (giống sản phẩm) ═══
   Form chỉ đưa công tác vào S._ctPending (panel phải, thẻ có Sửa / Xoá);
   bấm "Thêm công tác" mới ghi vào Database (ctSave từng công tác, lỗi thì ở lại kèm lý do). */
var _ctPendSeq=0;
function ctPendItem_(uid){ return uid?(S._ctPending||[]).filter(function(x){ return x.uid===uid; })[0]:null; }
function ctRecentList_(){
  var ps=(S._ctSessionAdded||[]);   // đã lưu trong PHIÊN này
  var pd=(S._ctPending||[]);        // chờ lưu
  var cards=pd.map(function(x,i){
    var c=x.d, im=String(c.hinhAnh||'').split('\n')[0], dangSua=(S._ctPendEdit===x.uid);
    var img=im?'<img class="pc-th" src="'+esc(imgUrlOf(im))+'" onerror="this.style.visibility=\'hidden\'">':'<span class="pc-th pc-noimg">'+icon('image',14)+'</span>';
    var phu=[c.hangMuc, c.dg?(money(c.dg)+' đ'+(c.dvt?'/'+c.dvt:'')):'', ptLoaiNgan_(c.loai)].filter(Boolean).join(' · ');
    return '<div class="pc'+(x.loi?' err':'')+(dangSua?' editing':'')+'">'+img
      +'<div class="pc-mid"><div class="pc-name" title="'+esc(c.ten||'')+'">'+esc(c.ten||'')+'</div>'
        +(phu?'<div class="pc-sub" title="'+esc(phu)+'">'+esc(phu)+'</div>':'')
        +(x.loi?'<div class="pc-loi">'+esc(x.loi)+'</div>':'')
        +'<span class="pc-tag">'+(dangSua?'Đang sửa':(x.loi?'Lỗi — sửa lại':'Chờ lưu'))+'</span>'
        +(x.ghi?'<span class="pc-tag kt">+ khái toán</span>':'')+'</div>'
      +'<div class="pc-act">'
        +'<button class="pc-btn" title="Sửa — mở lại trong form" onclick="ctPendEdit_('+i+')">'+icon('edit',14)+'</button>'
        +'<button class="pc-btn del" title="Xoá khỏi danh sách chờ" onclick="ctPendDel_('+i+')">'+icon('trash',14)+'</button>'
      +'</div></div>';
  }).join('');
  var rows=ps.map(function(c,i){
    var im=String(c.hinhAnh||'').split('\n')[0];
    var img=im?'<img class="imp-rth" src="'+esc(imgUrlOf(im))+'" onerror="this.style.visibility=\'hidden\'">':'<span class="imp-rth"></span>';
    var sua=c.id
      ? '<button class="imp-redit" title="Sửa lại công tác này" onclick="ctEditModal_(\''+c.id+'\')">'+icon('edit',13)+'</button>'
      : '<span class="imp-redit dis" title="Không rõ bản ghi — mở Danh sách sản phẩm để sửa">'+icon('edit',13)+'</span>';
    return '<tr><td class="c imp-ract">'+sua+'</td><td class="c">'+(i+1)+'</td>'
      +'<td class="imp-rname">'+esc(c.ten||'')
      +(c.hangMuc?'<i class="imp-rma">'+esc(c.hangMuc)+'</i>':'')+'</td><td class="c">'+img+'</td>'
      +'<td>'+esc(ptLoaiNgan_(c.loai))+'</td>'
      +'<td class="imp-rdate">'+(c.dg?money(c.dg)+' đ':'—')+'</td></tr>';
  }).join('');
  if(!cards && !rows) rows='<tr><td colspan="6" class="empty" style="padding:24px 12px;font-size:12.5px;line-height:1.5">Chưa nhập công tác nào trong phiên này.<br>Công tác bạn nhập sẽ hiện ở đây — bấm <b>Thêm công tác</b> để lưu vào Database.</td></tr>';
  return '<div class="imp-recent-h">Công tác vừa nhập (phiên này) <span class="count">'+pad2(pd.length+ps.length)+'</span></div>'
    +'<div class="imp-recent-note">Danh sách này chỉ ghi lại thao tác của <b>phiên đang mở</b> — tải lại trang sẽ trống. '
    +'Công tác đã lưu <b>vẫn nằm trong Database</b>: <a onclick="showTab(\'sanpham\');setTimeout(function(){spCatPickNode(\'3.1\');},300)">xem Danh sách sản phẩm →</a></div>'
    +'<div class="imp-recent-b">'
      +(pd.length?'<div class="pc-hd">Chờ lưu <span>'+pd.length+'</span><i>Chưa vào Database</i></div><div class="pc-list">'+cards+'</div>':'')
      +((pd.length&&ps.length)?'<div class="pc-hd done">Đã lưu vào Database <span>'+ps.length+'</span></div>':'')
      +(rows?'<table class="imp-rtbl"><thead><tr><th class="c">Sửa</th><th class="c">STT</th><th>Nội dung công việc</th><th class="c">Hình ảnh</th><th>Loại báo giá</th><th>Đơn giá</th></tr></thead><tbody>'+rows+'</tbody></table>':'')
    +'</div>'
    +'<div class="imp-rfoot">'
      +(pd.length?'<div class="imp-rfoot-note"><b>'+pd.length+'</b> công tác đang chờ — <b>chưa</b> lưu vào Database</div>':'')
      +'<button class="btn blue block" id="ctPendBtn" onclick="ctPendCommit_(this)"'+((pd.length&&!S._committing)?'':' disabled')+'>'
      +(S._committing?'⏳ Đang lưu vào Database…':(icon('plus',15)+' Thêm công tác'+(pd.length?' ('+pd.length+')':'')))+'</button></div>';
}
function ctRecentRefresh_(){ var b=document.getElementById('impRecentBox'); if(b && impLoai_()==='pt') b.innerHTML=ctRecentList_(); }
// Bấm nút dưới form: đưa vào danh sách chờ (hoặc cập nhật đúng dòng đang sửa) — CHƯA ghi Database
async function ctImpSave(btn){
  if((S._imgUploading||0)>0){ if(btn){ btn.disabled=true; btn.textContent='⏳ Đợi tải ảnh…'; } await waitUploads_(15000); }
  var d=ctFormRead_('imp');
  if(!d.ten){ toast('Nhập tên hạng mục / nội dung công việc'); return; }
  if(!d.hangMuc){ toast('Nhập hạng mục'); return; }
  var ghiEl=document.getElementById('impCtGhi'), ghi=!!(ghiEl&&ghiEl.checked);
  S._ctPending=S._ctPending||[];
  var sua=ctPendItem_(S._ctPendEdit);
  if(sua){ sua.d=d; sua.ghi=ghi; delete sua.loi; toast('Đã cập nhật "'+d.ten+'" trong danh sách chờ'); }
  else { S._ctPending.unshift({uid:'c'+(++_ctPendSeq), d:d, ghi:ghi});
    toast('Đã đưa "'+d.ten+'" vào danh sách chờ — bấm "Thêm công tác" để lưu vào Database'); }
  S._ctPendEdit=null;
  renderImportPT_();
}
function ctPendEdit_(i){
  var x=(S._ctPending||[])[i]; if(!x) return;
  if(S._committing){ toast('Đang lưu vào Database — đợi xong rồi sửa'); return; }
  if(S._ctPendEdit && S._ctPendEdit!==x.uid && !confirm('Đang sửa một công tác khác — bỏ các thay đổi chưa cập nhật?')) return;
  S._ctPendEdit=x.uid; renderImportPT_();
  var f=document.querySelector('#v-import .dbwrap'); if(f&&f.scrollIntoView) f.scrollIntoView({behavior:'smooth',block:'start'});
  toast('Đã mở "'+x.d.ten+'" trong form — sửa xong bấm "Cập nhật vào danh sách chờ"');
}
function ctPendDel_(i){
  var x=(S._ctPending||[])[i]; if(!x) return;
  if(!confirm('Xoá "'+x.d.ten+'" khỏi danh sách chờ?\n(Công tác chưa được lưu vào Database nên sẽ mất hẳn.)')) return;
  S._ctPending.splice(i,1);
  if(S._ctPendEdit===x.uid){ S._ctPendEdit=null; renderImportPT_(); } else ctRecentRefresh_();
}
async function ctPendCommit_(btn){
  if(S._committing) return;
  var ds=(S._ctPending||[]).slice(); if(!ds.length){ toast('Chưa có công tác nào chờ lưu'); return; }
  if(S._ctPendEdit && !confirm('Bạn đang sửa 1 công tác trong form nhưng chưa bấm "Cập nhật".\nLưu luôn bản CŨ của công tác đó?')) return;
  S._committing=true; ctRecentRefresh_(); btn=document.getElementById('ctPendBtn');
  try{ await ctPendCommitRun_(ds, btn); }
  finally{ S._committing=false; ctRecentRefresh_(); }
}
async function ctPendCommitRun_(ds, btn){
  if(btn){ btn.disabled=true; btn.textContent='⏳ Đang lưu 0/'+ds.length+'…'; }
  var ok=0, conLai=[], daLuu=[];
  for(var k=0;k<ds.length;k++){
    var x=ds[k];
    try{ var kq=await api('ctSave', x.d); ok++; daLuu.push(x);
      S._ctSessionAdded=S._ctSessionAdded||[]; S._ctSessionAdded.unshift((kq&&kq.rows&&kq.rows[0])||x.d); }
    catch(e){ x.loi=String(e.message||e).slice(0,160); conLai.push(x); }
    if(btn) btn.textContent='⏳ Đang lưu '+(k+1)+'/'+ds.length+'…';
  }
  var xong={}; daLuu.forEach(function(x){ xong[x.uid]=1; });
  S._ctPending=(S._ctPending||[]).filter(function(x){ return !xong[x.uid]; });   // giữ dòng thêm trong lúc lưu
  if(S._ctPendEdit && xong[S._ctPendEdit]) S._ctPendEdit=null;
  try{ await ctLoad_(true); }catch(e){}
  // Thêm vào bảng khái toán của dự án đang mở (những công tác đã tick)
  var them=0;
  if(S.cur) daLuu.filter(function(x){ return x.ghi; }).forEach(function(x){
    var d=x.d, si=PT_TEMPLATE.findIndex(function(t){ return t.db && t.t===d.hangMuc && ptLoaiGop_(ptSecLoai_(t))===ptLoaiGop_(d.loai); });
    var ii=si>=0?PT_TEMPLATE[si].items.findIndex(function(a){ var c=ctOf_(a); return c && c.ten===d.ten; }):-1;
    if(si>=0 && ii>=0){ ptAddFromLib(si,ii,true); them++; }
  });
  if(them){ ptPersist(); try{ renderPhanTho(); }catch(e){} }
  renderImportPT_();
  var msg='Đã lưu '+ok+' công tác vào Database'+(them?(' · thêm '+them+' vào bảng khái toán'):'');
  if(conLai.length) alert(msg+'.\n\n'+conLai.length+' công tác KHÔNG lưu được (vẫn nằm trong danh sách chờ, nhãn "Lỗi"):\n'
    +conLai.map(function(x){ return '• '+x.d.ten+': '+x.loi; }).join('\n'));
  else toast(msg);
}
/* ── Nhập hàng loạt công tác từ Excel/CSV ── */
async function ctImpPick(input){
  var f=input.files&&input.files[0]; if(!f) return;
  var ext=(f.name.split('.').pop()||'').toLowerCase();
  var pv=document.getElementById('ctImpPreview');
  pv.innerHTML='<div style="color:var(--muted)">Đang đọc file "'+esc(f.name)+'"…</div>';
  var reader=new FileReader();
  reader.onload=async function(){
    try{
      var b64=String(reader.result).split(',')[1];
      var res=await api('ctImportParse', b64, ext);
      S._ctImp=res.rows||[]; ctImpShow_();
    }catch(e){ pv.innerHTML='<div style="color:#c33">Lỗi đọc file: '+esc(e.message)+'</div>'; }
  };
  reader.onerror=function(){ pv.innerHTML='<div style="color:#c33">Không đọc được file.</div>'; };
  reader.readAsDataURL(f);
}
function ctImpShow_(){
  var pv=document.getElementById('ctImpPreview'); if(!pv) return;
  var rows=S._ctImp||[];
  if(!rows.length){ pv.innerHTML='<div style="color:#c33">Không có dòng nào để nhập.</div>'; return; }
  var COLS=[['ten','Nội dung công việc'],['hangMuc','Hạng mục'],['loai','Loại báo giá'],['mode','Cách tính'],
    ['dvt','ĐVT'],['kl','KL'],['dt','DT'],['hs','HS'],['dgnt','Giá vốn'],['dg','Giá bán'],['gc','Ghi chú']];
  pv.innerHTML='<div class="ctimp-bar"><b>'+rows.length+'</b> công tác đọc được từ file'
      +'<span class="sp"></span>'
      +'<button class="btn ghost sm" onclick="S._ctImp=null;document.getElementById(\'ctImpPreview\').innerHTML=\'\'">Huỷ</button>'
      +'<button class="btn blue sm" id="ctImpBtn" onclick="ctImpCommit_()">'+icon('check',14)+' Lưu '+rows.length+' công tác vào Database</button>'
    +'</div>'
    +'<div class="tbl-wrap ctimp-wrap"><table class="admtbl ctimp-tbl"><tr><th>STT</th>'
      +COLS.map(function(c){ return '<th>'+esc(c[1])+'</th>'; }).join('')+'</tr>'
      +rows.map(function(r,i){
        return '<tr><td>'+(i+1)+'</td>'+COLS.map(function(c){
          var v=r[c[0]]; if(c[0]==='loai') v=ptLoaiNgan_(v); if(c[0]==='mode') v=(CT_MODE_LBL[v]||v);
          if(c[0]==='dg'||c[0]==='dgnt') v=v?money(v):'';
          return '<td class="ctimp-c" contenteditable="true" spellcheck="false" data-i="'+i+'" data-f="'+c[0]+'" oninput="ctImpEdit_(this)">'+esc(v==null?'':v)+'</td>';
        }).join('')+'</tr>';
      }).join('')+'</table></div>';
}
function ctImpEdit_(el){
  var i=+el.dataset.i, f=el.dataset.f, r=(S._ctImp||[])[i]; if(!r) return;
  var t=el.textContent.trim();
  if(f==='dg'||f==='dgnt') r[f]=ptMoneyN_(t);
  else if(f==='kl'||f==='dt'||f==='hs') r[f]=ptN(t);
  else if(f==='loai'){ var m=PT_LOAI.filter(function(x){ return ptLoaiNgan_(x[0])===t||x[1]===t; })[0]; r[f]=m?m[0]:r[f]; }
  else if(f==='mode'){ var k=Object.keys(CT_MODE_LBL).filter(function(x){ return CT_MODE_LBL[x]===t; })[0]; r[f]=k||r[f]; }
  else r[f]=t;
}
async function ctImpCommit_(){
  var rows=(S._ctImp||[]).filter(function(r){ return String(r.ten||'').trim(); });
  if(!rows.length){ toast('Không có dòng nào để lưu'); return; }
  var btn=document.getElementById('ctImpBtn'); if(btn){ btn.disabled=true; btn.textContent='Đang lưu…'; }
  try{
    var r=await api('ctSave', rows);
    S._ctImp=null; await ctLoad_(true);
    S._ctSessionAdded=(S._ctSessionAdded||[]).concat((r&&r.rows)||rows);
    toast('Đã nhập '+((r&&r.ok)||rows.length)+' công tác');
    renderImportPT_();
  }catch(e){ toast('Lỗi nhập: '+e.message); if(btn){ btn.disabled=false; btn.textContent='Thử lại'; } }
}

/* ==== Upload ảnh ==== */
// Dán ảnh trực tiếp bằng Ctrl+V — vào ô đang focus, mặc định là "hình chi tiết"
(function pasteImage_(){
  document.addEventListener('paste', function(e){
    var zones=document.querySelectorAll('.upzone'); if(!zones.length) return;
    var items=(e.clipboardData&&e.clipboardData.items)||[];
    var files=[];
    for(var i=0;i<items.length;i++){ if(items[i].type&&/^image\//.test(items[i].type)){ var f=items[i].getAsFile(); if(f) files.push(f); } }
    if(!files.length) return;
    if(document.activeElement && /INPUT|TEXTAREA/.test(document.activeElement.tagName)
       && !document.activeElement.closest('.upzone')) return;   // đang gõ chữ -> bỏ qua
    e.preventDefault();
    var main=document.getElementById('upMain');
    var zone = (main && main.classList.contains('focus')) ? 'main'
             : (!S._imgMain ? 'main' : 'more');                  // chưa có ảnh đại diện -> ưu tiên
    upFilesSeq_(zone, files);
    toast('Đã dán '+files.length+' ảnh vào '+(zone==='main'?'hình đại diện':'hình chi tiết'));
  });
  // đánh dấu vùng đang chọn để dán đúng chỗ
  document.addEventListener('focusin', function(e){
    var z=e.target.closest&&e.target.closest('.upzone');
    document.querySelectorAll('.upzone.focus').forEach(function(x){x.classList.remove('focus');});
    if(z) z.classList.add('focus');
  });
})();

// Chặn trình duyệt MỞ FILE khi thả trượt ra ngoài vùng upload (nếu không, cả trang bị điều hướng
// -> người dùng tưởng "không kéo thả được"). Đồng thời sáng vùng thả gần nhất khi đang kéo file.
(function guardFileDrop_(){
  function hasFiles(e){ var d=e.dataTransfer; return d && d.types && [].indexOf.call(d.types,'Files')>=0; }
  document.addEventListener('dragover',function(e){ if(hasFiles(e)) e.preventDefault(); });
  document.addEventListener('drop',function(e){
    if(!hasFiles(e)) return;
    if(e.target.closest && e.target.closest('.upzone')) return;   // để vùng upload tự xử lý
    e.preventDefault();
    var zones=document.querySelectorAll('.upzone');
    if(zones.length) toast('Thả ảnh vào đúng khung "Hình đại diện" hoặc "Hình chi tiết" nhé');
  });
})();

function upDrag(e,on){ e.preventDefault(); e.currentTarget.classList.toggle('drag',!!on); }
async function upFilesSeq_(zone,fs){
  if(zone==='main'){ if(fs.length>1) toast('Hình đại diện chỉ 1 ảnh — lấy ảnh đầu.'); fs=fs.slice(0,1); }  // RULE: đại diện chỉ 1 ảnh
  for(var i=0;i<fs.length;i++){ try{ await upFile(zone,fs[i]); }catch(e){} }  // tải TUẦN TỰ như nhập file
}
function upPick(zone){
  var inp=document.createElement('input'); inp.type='file'; inp.accept='image/*'; if(zone==='more') inp.multiple=true;
  inp.onchange=function(){ upFilesSeq_(zone, Array.prototype.slice.call(inp.files||[])); };
  inp.click();
}
function upDrop(e,zone){ e.preventDefault(); e.currentTarget.classList.remove('drag');
  // nhận ảnh; nếu type rỗng (vd HEIC) vẫn thử (downscale sẽ báo nếu không đọc được)
  var fs=Array.prototype.slice.call((e.dataTransfer&&e.dataTransfer.files)||[]).filter(function(f){ return !f.type || /^image\//.test(f.type); });
  upFilesSeq_(zone, fs);
}
/* Nén + thu nhỏ ảnh ở client trước khi upload (tránh payload quá lớn -> "Failed to fetch") */
function downscaleImage_(file, maxDim, quality){
  return new Promise(function(resolve){
    try{
      if(!file || !/^image\//.test(file.type||'')){ return readB64_(file).then(resolve,function(){resolve('');}); }
      var url=URL.createObjectURL(file), img=new Image();
      img.onload=function(){
        try{
          var w=img.naturalWidth||img.width, h=img.naturalHeight||img.height;
          var scale=Math.min(1,(maxDim||1600)/Math.max(w,h||1));
          var nw=Math.max(1,Math.round(w*scale)), nh=Math.max(1,Math.round(h*scale));
          var c=document.createElement('canvas'); c.width=nw; c.height=nh;
          c.getContext('2d').drawImage(img,0,0,nw,nh);
          URL.revokeObjectURL(url);
          var out=c.toDataURL('image/jpeg', quality||0.82);
          // nếu vì lý do nào đó vẫn > ~4MB thì nén mạnh hơn
          if(out.length>5.5e6){ out=c.toDataURL('image/jpeg',0.6); }
          resolve(out);
        }catch(e){ URL.revokeObjectURL(url); readB64_(file).then(resolve,function(){resolve('');}); }
      };
      img.onerror=function(){ URL.revokeObjectURL(url); resolve('__DECODE_FAIL__'); }; // trình duyệt không giải mã được (vd HEIC iPhone)
      img.src=url;
    }catch(e){ resolve('__DECODE_FAIL__'); }
  });
}
// Gọi uploadImage có thử lại nhiều lần, backoff tăng dần (chịu được rớt mạng / Render cold-start / redeploy)
async function uploadImg_(dataUrl, name){
  var backoff=[1000,2500,5000,8000], lastErr;
  for(var k=0;k<=backoff.length;k++){
    try{ var r=await api('uploadImage', dataUrl, name||'image.jpg'); var tok=r&&(r.token||r.url); if(tok) return tok; throw new Error('Không nhận được ảnh'); }
    catch(e){ lastErr=e; if(k<backoff.length) await new Promise(function(res){ setTimeout(res,backoff[k]); }); }
  }
  throw lastErr;
}
function upBusy_(d){ S._imgUploading=Math.max(0,(S._imgUploading||0)+d); }
// Đợi mọi ảnh đang tải xong (tối đa timeout ms) trước khi lưu — tránh lưu thiếu ảnh
async function waitUploads_(timeout){ var t0=Date.now(); while((S._imgUploading||0)>0 && Date.now()-t0<(timeout||15000)){ await new Promise(function(r){ setTimeout(r,250); }); } }
function upFile(zone,file){
  upBusy_(1);   // đánh dấu có ảnh đang xử lý ngay từ đầu
  return downscaleImage_(file,1600,0.82).then(async function(dataUrl){
    try{
      if(dataUrl==='__DECODE_FAIL__'){ toast('Không đọc được ảnh — có thể ảnh iPhone (.HEIC). Hãy đổi sang JPG/PNG hoặc dán URL ảnh.'); return; }
      if(!dataUrl){ toast('Không đọc được ảnh — hãy thử ảnh khác hoặc dán URL.'); return; }
      // preview tạm bằng dataURL (dùng chính dataURL làm khoá để chống race khi tải nhiều ảnh cùng lúc)
      if(zone==='main'){ S._imgMain=dataUrl; } else { S._imgList.push(dataUrl); }
      upRefresh(); toast('Đang tải ảnh lên…');
      try{
        var tok=await uploadImg_(dataUrl, file.name);   // có thử lại nếu rớt mạng
        if(zone==='main'){ if(S._imgMain===dataUrl) S._imgMain=tok; }
        else { var ix=S._imgList.indexOf(dataUrl); if(ix>=0) S._imgList[ix]=tok; }   // thay đúng ô của ảnh này (nếu chưa bị xoá)
        upRefresh(); toast('Đã tải ảnh lên');
      }catch(e){
        // upload lỗi -> gỡ đúng preview tạm của ảnh này, gợi ý dán URL
        if(zone==='main'){ if(S._imgMain===dataUrl) S._imgMain=''; } else { var ie=S._imgList.indexOf(dataUrl); if(ie>=0) S._imgList.splice(ie,1); }
        upRefresh(); toast('Tải ảnh lỗi: '+(/fetch/i.test(e.message)?'mất kết nối, thử lại':e.message)+' — hoặc dán URL ảnh.');
      }
    } finally { upBusy_(-1); }
  });
}
function upAddUrl(zone){
  var id=zone==='main'?'upMainUrl':'upMoreUrl'; var el=document.getElementById(id); var u=(el&&el.value||'').trim();
  if(!u){ toast('Nhập URL ảnh'); return; }
  if(zone==='main') S._imgMain=u; else S._imgList.push(u);
  if(el)el.value=''; upRefresh();
}
function upRemove(zone,i){ if(zone==='main') S._imgMain=''; else S._imgList.splice(i,1); upRefresh(); }
async function impPick(input){
  var f=input.files&&input.files[0]; if(!f) return;
  var ext=(f.name.split('.').pop()||'').toLowerCase();
  var pv=document.getElementById('impPreview'); pv.innerHTML='<div style="color:var(--muted)">Đang đọc file "'+esc(f.name)+'"…</div>';
  var reader=new FileReader();
  reader.onload=async function(){
    try{ var b64=String(reader.result).split(',')[1]; S._impNganh=(impLoai_()==='vs')?'vs':''; var res=await api('importParse',b64,ext,S._impNganh);
      // File thiết bị vệ sinh mà ô Ngành hàng đang để Thiết bị đèn -> tự nhận theo cột HẠNG MỤC
      if(!S._impNganh){ var ps=res.products||[], soVS=ps.filter(function(p){ return VS_SPEC.chuanHM((p._raw||{})['HẠNG MỤC']||p.hangMuc); }).length;
        if(ps.length && soVS*2>=ps.length){ S._impNganh='vs'; ps.forEach(function(p){ p._nganh='vs'; });
          S._impLoai='vs'; renderImport(); pv=document.getElementById('impPreview');
          toast('File là THIẾT BỊ VỆ SINH (theo cột Hạng mục) — đã tự chuyển ngành hàng sang Thiết bị vệ sinh'); } }
      impShow(res); }
    catch(e){ pv.innerHTML='<div style="color:#c33">Lỗi đọc file: '+esc(e.message)+'</div>'; }
  };
  reader.onerror=function(){ pv.innerHTML='<div style="color:#c33">Không đọc được file.</div>'; };
  reader.readAsDataURL(f);
}
function impImgs_(p){ return String(p.hinhAnh||'').split('\n').map(function(s){return s.trim();}).filter(Boolean); }
function impMain_(p){ return impImgs_(p)[0]||''; }
function impMore_(p){ return impImgs_(p).slice(1); }
/* Ô ảnh trong bảng xem trước: 1 ảnh chính + nhiều ảnh chi tiết */
function impImgCell2_(p,i){
  var main=impMain_(p), more=impMore_(p);
  var mainHtml = main
    ? '<div class="iithumb"><img src="'+esc(imgUrlOf(main))+'" onerror="this.style.visibility=\'hidden\'"><button class="iix" title="Xoá" onclick="impDelImg('+i+',0)">✕</button></div>'
    : '<button class="iiadd" onclick="impPickMain('+i+')" title="Tải ảnh chính">'+icon('camera',16)+'</button>';
  var moreHtml = more.map(function(u,k){ return '<div class="iithumb sm"><img src="'+esc(imgUrlOf(u))+'" onerror="this.style.visibility=\'hidden\'"><button class="iix" onclick="impDelImg('+i+','+(k+1)+')">✕</button></div>'; }).join('')
    + '<button class="iiadd sm" onclick="impPickMore('+i+')" title="Thêm ảnh chi tiết">＋</button>';
  return '<div class="iicell">'
    +'<div class="iislot"><span class="iilb">Ảnh chính</span>'+mainHtml+'</div>'
    +'<div class="iislot"><span class="iilb">Ảnh chi tiết</span><div class="iimore">'+moreHtml+'</div></div>'
    +'</div>';
}
function impCellVal_(p,h){ var v=(p._raw&&p._raw[h]); return v==null?'':String(v); }
/* Thiết bị vệ sinh: kiểm tra 1 dòng theo hạng mục của nó -> {hm, loi:[...], na:{nhãn:1}, thieu:{nhãn:1}} */
function impVsCheck_(p){
  var raw=p._raw||{}, hm=VS_SPEC.chuanHM(raw['HẠNG MỤC']), out={hm:hm, loi:[], na:{}, thieu:{}};
  if(!hm){ out.loi.push(raw['HẠNG MỤC']?('Hạng mục "'+raw['HẠNG MỤC']+'" không hợp lệ'):'Chưa có hạng mục'); return out; }
  var cho=VS_SPEC.labelsOf(hm);
  Object.keys(VS_SPEC.METRIC).forEach(function(lb){ if(cho.indexOf(lb)<0) out.na[lb]=1; });
  VS_SPEC.HM[hm].req.forEach(function(lb){ if(!String(raw[lb]||'').trim()){ out.thieu[lb]=1; out.loi.push('thiếu '+VS_SPEC.METRIC[lb][1]); } });
  return out;
}
function impRow_(p,i){
  var heads=S._impHeaders||[], vs=(S._impNganh==='vs'), ck=vs?impVsCheck_(p):null;
  return '<tr'+(ck&&ck.loi.length?' class="iierr" title="'+esc((ck.hm||'')+(ck.hm?': ':'')+ck.loi.join(', '))+'"':'')+'><td class="iisttd">'+(i+1)
      +(ck&&ck.loi.length?'<span class="iiwarn" title="'+esc(ck.loi.join(', '))+'">!</span>':'')+'</td><td class="iiimgtd" id="impimg_'+i+'">'+impImgCell2_(p,i)+'</td>'
    +heads.map(function(h){
      // Cột thông số không thuộc hạng mục của dòng này -> khoá lại, không nhập
      if(ck && ck.na[h]) return '<td class="iina" title="Không áp dụng cho '+esc(ck.hm)+'">—</td>';
      return '<td class="iied'+(ck&&(ck.thieu[h]||(h==='HẠNG MỤC'&&!ck.hm))?' iimiss':'')+'" contenteditable="true" spellcheck="false" data-i="'+i+'" data-h="'+esc(h)+'" oninput="impEdit(this)"'
        +(h==='HẠNG MỤC'&&vs?' onblur="impRerow_('+i+')"':'')+'>'+esc(impCellVal_(p,h))+'</td>'; }).join('')+'</tr>';
}
// Sửa HẠNG MỤC / ô bắt buộc trong bảng xem trước -> vẽ lại dòng để cập nhật cột áp dụng & cảnh báo
function impRerow_(i){
  var tb=document.getElementById('impBody'), p=(S._impProducts||[])[i]; if(!tb||!p) return;
  var tr=tb.children[i]; if(!tr) return;
  var t=document.createElement('tbody'); t.innerHTML=impRow_(p,i); tb.replaceChild(t.firstChild,tr);
  impVsSummary_();
}
function impVsSummary_(){
  var el=document.getElementById('impVsSum'); if(!el||S._impNganh!=='vs') return;
  var loi=(S._impProducts||[]).filter(function(p){ return impVsCheck_(p).loi.length; }).length;
  el.innerHTML=loi?('<b style="color:#c33">'+loi+'</b> dòng thiếu thông số bắt buộc / sai hạng mục (ô viền đỏ) — sẽ KHÔNG được nhập nếu chưa sửa')
    :'<span style="color:#1a7f37">Mọi dòng đủ thông số bắt buộc theo hạng mục</span>';
}
function impEdit(el){
  var i=+el.getAttribute('data-i'), h=el.getAttribute('data-h'), p=S._impProducts[i]; if(!p) return;
  if(!p._raw) p._raw={}; p._raw[h]=el.textContent;
  // đồng bộ vài trường cơ bản để danh sách "vừa nhập" hiển thị đúng
  if(S._impNganh==='vs' && VS_SPEC.METRIC[h]){ el.classList.toggle('iimiss', !el.textContent.trim() && impVsCheck_(p).thieu[h]===1); impVsSummary_(); }
  if(h==='TÊN SẢN PHẨM') p.ten=el.textContent;
  else if(h==='THƯƠNG HIỆU') p.thuongHieu=el.textContent;
  else if(h==='MÃ SẢN PHẨM') p.ma=el.textContent;
}
function impRefreshRow(i){ var c=document.getElementById('impimg_'+i); if(c) c.innerHTML=impImgCell2_(S._impProducts[i],i); }
function impUpdateCounter(){ var n=(S._impProducts||[]).filter(function(p){return p.hinhAnh;}).length; var el=document.getElementById('impImgCount'); if(el){ el.textContent=n; el.style.color=(n<(S._impProducts||[]).length)?'#c9820a':'#1a7f37'; } }
function readB64_(f){ return new Promise(function(res,rej){ var r=new FileReader(); r.onload=function(){res(String(r.result));}; r.onerror=rej; r.readAsDataURL(f); }); }
async function impUploadFiles_(fs){
  upBusy_(1);
  try{
    var toks=[]; for(var k=0;k<fs.length;k++){ try{ var b=await downscaleImage_(fs[k],1600,0.82);
      if(b==='__DECODE_FAIL__'){ toast('Ảnh "'+(fs[k].name||'')+'" không đọc được (có thể .HEIC) — đổi JPG/PNG.'); continue; }
      if(!b) continue;
      var tok=await uploadImg_(b, fs[k].name); if(tok) toks.push(tok);
    }catch(e){ toast('Tải ảnh lỗi: '+(/fetch/i.test(e.message)?'mất kết nối':e.message)); } } return toks;
  } finally { upBusy_(-1); }
}
function impSetImgs_(i,arr){ S._impProducts[i].hinhAnh=arr.filter(Boolean).join('\n'); impRefreshRow(i); impUpdateCounter(); }
function impPickMain(i){
  var inp=document.createElement('input'); inp.type='file'; inp.accept='image/*';
  inp.onchange=async function(){ var fs=Array.prototype.slice.call(inp.files||[]); if(!fs.length) return;
    var cell=document.getElementById('impimg_'+i); if(cell)cell.innerHTML='<span class="iiwait">⏳ Đang tải…</span>';
    var toks=await impUploadFiles_(fs.slice(0,1)); var cur=impImgs_(S._impProducts[i]);
    if(toks.length){ if(cur.length) cur[0]=toks[0]; else cur=[toks[0]]; }
    impSetImgs_(i,cur);
  }; inp.click();
}
function impPickMore(i){
  var inp=document.createElement('input'); inp.type='file'; inp.accept='image/*'; inp.multiple=true;
  inp.onchange=async function(){ var fs=Array.prototype.slice.call(inp.files||[]); if(!fs.length) return;
    var cell=document.getElementById('impimg_'+i); if(cell)cell.innerHTML='<span class="iiwait">⏳ Đang tải…</span>';
    var toks=await impUploadFiles_(fs); var cur=impImgs_(S._impProducts[i]).concat(toks);
    impSetImgs_(i,cur);
  }; inp.click();
}
function impDelImg(i,idx){ var cur=impImgs_(S._impProducts[i]); cur.splice(idx,1); impSetImgs_(i,cur); }
function impShow(res){
  S._impProducts=res.products||[];
  // Ảnh KHÔNG lấy từ file — người dùng tự tải ảnh chính/chi tiết cho từng SP sau khi import
  S._impProducts.forEach(function(p){ p.hinhAnh=''; });
  S._impHeaders=res.headers||[];
  var pv=document.getElementById('impPreview');
  if(!res.count){ pv.innerHTML='<div style="color:#c33">Không đọc được sản phẩm nào (kiểm tra cột Tên sản phẩm).</div>'; return; }
  var heads=S._impHeaders;
  var rows=S._impProducts.map(function(p,i){ return impRow_(p,i); }).join('');
  var recog=Object.keys(res.mapped||{}).map(function(k){return esc(res.mapped[k]);}).join(' · ');
  pv.innerHTML=
    '<div class="imp-pv-info"><div class="imp-pv-h">Đọc được <b>'+res.count+'</b> sản phẩm · <b>'+heads.length+'</b> cột từ file</div>'
    +'<div class="imp-pv-sub">'+icon('image',15)+' Tải <b>ảnh chính</b> và <b>ảnh chi tiết</b> cho từng SP ở cột đầu — <b id="impImgCount">0</b>/'+res.count+' đã có ảnh</div>'
    +(S._impNganh==='vs'?'<div class="imp-pv-sub" id="impVsSum"></div>':'')+'</div>'
    +'<div class="imp-pv-wrap"><table class="imp-pvtbl"><thead><tr><th class="iistth">STT</th><th class="iiimgth">Ảnh (chính + chi tiết)</th>'
      +heads.map(function(h){return '<th>'+esc(h)+'</th>';}).join('')+'</tr></thead><tbody id="impBody">'+rows+'</tbody></table></div>'
    +'<div class="imp-pv-foot"><button class="btn blue" onclick="impCommit(this)">'+icon('check',15)+' Đưa '+res.count+' sản phẩm vào danh sách chờ</button>'
      +'<span class="imp-pv-note">Cột nhận diện & map DB: '+recog+'</span></div>';
  impUpdateCounter(); impVsSummary_();
}
async function impCommit(btn){
  if(!S._impProducts||!S._impProducts.length){ toast('Chưa có dữ liệu'); return; }
  if((S._imgUploading||0)>0){ toast('Đang tải ảnh lên, đợi chút…'); if(btn){ btn.disabled=true; var ot=btn.textContent; btn.textContent='⏳ Đợi tải ảnh…'; } await waitUploads_(20000); if(btn){ btn.disabled=false; btn.textContent=ot; } }
  var missing=S._impProducts.filter(function(p){return !p.hinhAnh;}).length;
  if(missing>0 && !confirm('Còn '+missing+' sản phẩm CHƯA có ảnh.\nBạn nên bấm ô ＋ ở cột Ảnh để tải hình cho từng SP.\n\nVẫn tiếp tục?')) return;
  // KHÔNG lưu ngay: đưa cả lô vào danh sách CHỜ LƯU — bấm "Thêm sản phẩm" ở panel phải mới ghi vào Database
  var vs=(S._impNganh==='vs');
  pendingAdd_(S._impProducts.map(function(p){
    if(vs) p._nganh='vs';                      // server đóng dấu ngành + lọc thông số theo hạng mục
    return {kind:'file', prod:p, ten:p.ten, ma:p.ma, thuongHieu:p.thuongHieu, ncc:p.ncc, hinhAnh:p.hinhAnh, nganh:vs?'vs':'den'};
  }));
  toast('Đã đưa '+S._impProducts.length+' sản phẩm vào danh sách chờ — bấm "Thêm sản phẩm" để lưu vào Database');
  S._impProducts=[]; var pv=document.getElementById('impPreview'); if(pv) pv.innerHTML='';
  var f=document.getElementById('impFile'); if(f) f.value='';
}
/* ===== BIẾN THỂ: sinh tổ hợp nhiệt độ màu × công suất × góc chiếu ===== */
function varList_(id){ var e=document.getElementById(id); if(!e) return [];
  return String(e.value||'').split(',').map(function(x){return x.trim();}).filter(Boolean); }
function varCombos_(){
  var K=varList_('varKelvin'), W=varList_('varWatt'), A=varList_('varAngle'), C=varList_('varColor'), Z=varList_('varSize');
  if(!K.length && !W.length && !A.length && !C.length && !Z.length) return [];   // không dùng biến thể
  var out=[];
  (K.length?K:[null]).forEach(function(k){
    (W.length?W:[null]).forEach(function(w){
      (A.length?A:[null]).forEach(function(a){
        (C.length?C:[null]).forEach(function(c){
          (Z.length?Z:[null]).forEach(function(z){ out.push({k:k,w:w,a:a,c:c,z:z}); });
        });
      });
    });
  });
  return out;
}
function varPreview_(){
  var el=document.getElementById('varNote'); if(!el) return;
  var K=varList_('varKelvin'), W=varList_('varWatt'), A=varList_('varAngle'), C=varList_('varColor'), Z=varList_('varSize');
  var c=varCombos_();
  if(!c.length){ el.className='var-note'; el.textContent='Bỏ trống = chỉ tạo 1 sản phẩm theo thông số đã nhập ở trên.'; return; }
  // Ghi RÕ phép nhân để không hiểu nhầm số lượng (VD 2 nhiệt độ × 2 góc = 4, KHÔNG phải 12)
  var parts=[];
  if(K.length) parts.push(K.length+' nhiệt độ');
  if(W.length) parts.push(W.length+' công suất');
  if(A.length) parts.push(A.length+' góc');
  if(C.length) parts.push(C.length+' màu');
  if(Z.length) parts.push(Z.length+' kích thước');
  el.className='var-note on';
  el.innerHTML='<div class="var-math">'+parts.join(' <b>×</b> ')+' <b>=</b> <span class="var-total">'+c.length+' sản phẩm</span></div>'
    +'<div class="var-list">'+c.slice(0,8).map(function(x){ return '<span class="var-chip">'+[x.w?x.w+'W':'',x.k?x.k+'K':'',x.a?x.a+'°':'',x.c||'',x.z||''].filter(Boolean).join(' · ')+'</span>'; }).join('')
    +(c.length>8?' <i>… +'+(c.length-8)+' nữa</i>':'')+'</div>';
}
async function tdSave(btn){
  var data={};
  var laVS=(impLoai_()==='vs'), hmVS=laVS?VS_SPEC.chuanHM((document.getElementById(dbIdOf('HẠNG MỤC'))||{}).value):'';
  impFlat_().forEach(function(f,i){ var e=document.getElementById('dbf_'+i); if(!e) return;
    if(laVS && f[6]==='vs' && VS_SPEC.labelsOf(hmVS).indexOf(f[0])<0) return;   // thông số của hạng mục khác
    var v=(e.value||'').trim(); if(v) data[f[0]]=v; });
  data['NGÀNH HÀNG']=laVS?'vs':'den';        // đóng dấu ngành -> SP về đúng đề mục trên cây
  var ten=String(data['TÊN SẢN PHẨM']||'').trim(); if(!ten){ toast('Nhập Tên sản phẩm'); return; }
  if(laVS){
    if(!hmVS){ toast('Chọn Hạng mục thiết bị vệ sinh'); return; }
    var thieu=VS_SPEC.HM[hmVS].req.filter(function(lb){ return !data[lb]; });
    // biến thể theo màu / kích thước điền ở khối Biến thể thì không tính là thiếu
    if(varList_('varColor').length) thieu=thieu.filter(function(lb){ return lb!=='MÀU SẮC'; });
    if(varList_('varSize').length) thieu=thieu.filter(function(lb){ return lb!=='KÍCH THƯỚC'; });
    if(thieu.length){ toast(hmVS+' cần nhập: '+thieu.map(function(lb){ return VS_SPEC.METRIC[lb][1]; }).join(', ')); return; }
  }
  delete data['GIÁ ĐẠI LÝ']; // cột tự tính (generated) — không ghi
  if(!data['ĐƠN VỊ TÍNH']) data['ĐƠN VỊ TÍNH']='Cái';
  if(!data['TRẠNG THÁI']) data['TRẠNG THÁI']='Đang kinh doanh';
  btn.disabled=true; var o=btn.textContent;
  if((S._imgUploading||0)>0){ btn.textContent='⏳ Đợi tải ảnh…'; await waitUploads_(15000); } // đợi ảnh tải xong để lưu đủ ảnh
  var imgs=[S._imgMain].concat(S._imgList||[]).filter(Boolean).filter(function(v){return v.indexOf('data:')!==0;}); // bỏ preview base64 chưa upload xong
  if(imgs.length) data['ẢNH SẢN PHẨM']=imgs.join('\n');
  /* KHÔNG lưu ngay: đưa vào danh sách CHỜ LƯU ở panel bên phải — bấm "Thêm sản phẩm" mới ghi vào Database */
  var meta={thuongHieu:data['THƯƠNG HIỆU']||'', ncc:data['NHÀ CUNG CẤP']||'', hinhAnh:data['ẢNH SẢN PHẨM']||'', nganh:data['NGÀNH HÀNG']};
  var combos=varCombos_(), items=[];
  if(combos.length){
    // BIẾN THỂ: 1 sản phẩm cho mỗi tổ hợp (cùng mã SP, khác nhiệt độ/công suất/góc/màu/kích thước)
    combos.forEach(function(c){
      var d2=Object.assign({},data);
      if(c.k) d2['NHIỆT ĐỘ MÀU (K)']=c.k;
      if(c.w) d2['CÔNG SUẤT (W)']=c.w;
      if(c.a) d2['GÓC CHIẾU (°)']=c.a;
      if(c.c) d2['MÀU SẮC']=c.c;
      if(c.z) d2['KÍCH THƯỚC']=c.z;
      var bt=[c.w?c.w+'W':'',c.k?c.k+'K':'',c.a?c.a+'°':'',c.c||'',c.z||''].filter(Boolean).join(' · ');
      items.push(Object.assign({kind:'form', data:d2, ten:ten, bienThe:bt, ma:data['MÃ SẢN PHẨM']||''}, meta));
    });
  } else items.push(Object.assign({kind:'form', data:data, ten:ten, ma:data['MÃ SẢN PHẨM']||''}, meta));
  // Ghi danh vào dự án (tuỳ chọn) — thực hiện SAU khi lưu thành công, gắn vào dòng đầu của lượt này
  var gd=document.getElementById('impGhiDanh'), ps=document.getElementById('impProjSel'), sl=document.getElementById('impGhiSL');
  if(gd&&gd.checked&&ps&&ps.value){
    var gia=Number(data['GIÁ BÁN LẺ'])||0, qty=Math.max(1,Number(sl&&sl.value)||1);
    items[0].ghi={ maDA:ps.value, qty:qty, prod:{ ten:ten, ma:data['MÃ SẢN PHẨM']||'', thuongHieu:data['THƯƠNG HIỆU']||'', ncc:data['NHÀ CUNG CẤP']||'',
      moTa:data['MÔ TẢ']||'', kichThuoc:data['KÍCH THƯỚC']||'', dvt:data['ĐƠN VỊ TÍNH']||'Cái', hinhAnh:data['ẢNH SẢN PHẨM']||'',
      donGiaVon:gia, donGiaBan:gia, nhom:'3.2.6.1', hangMuc:nodeName('3.2.6.1'), loai:nodeName('3.2.6.1'), tang:'', extra:{nganh:data['DÒNG SẢN PHẨM']||''} } };
  }
  var dangSua=S._pendEdit, viTri=(S._pending||[]).map(function(x){ return x.uid; }).indexOf(dangSua);
  S._pendEdit=null;
  if(dangSua && viTri>=0){
    // SỬA: thay đúng dòng đang sửa (giữ vị trí), không tạo dòng mới
    items.forEach(function(x){ x.uid=pendUid_(); });
    S._pending.splice.apply(S._pending,[viTri,1].concat(items));
    toast('Đã cập nhật "'+ten+'" trong danh sách chờ');
  } else {
    pendingAdd_(items);
    toast('Đã đưa '+(items.length>1?(items.length+' biến thể của '):'')+'"'+ten+'" vào danh sách chờ — bấm "Thêm sản phẩm" để lưu vào Database');
  }
  renderImport();
}

/* ===================================================================
 * PHẦN THÔ — Bảng ước tính chi phí xây dựng thô (theo mẫu Excel)
 * mode: 'item'  -> đơn giá theo dòng, TT = KL × ĐG
 *       'area'  -> đơn giá theo cả mục (up); KL = DT × HS; TT mục = ΣKL × up
 *       'area0' -> KL = DT × HS nhưng "Chưa bao gồm" (TT = 0)
 *       'none'  -> gói, "Chưa bao gồm" (TT = 0)
 * =================================================================== */
/* Thư viện công tác PHẦN THÔ — sinh từ file báo giá Excel (Book1.xlsx), 15 nhóm / 156 công tác.
   Cột "Đơn giá cost" của file dùng cho CẢ đơn giá lẫn giá nhà thầu (file chưa có cột đề xuất). */
var PT_TEMPLATE=[
  {r:"I",t:"CÔNG TÁC CHUẨN BỊ",loai:'kt_chitiet',mode:'item',items:[
    ["Xin phép xây dựng","gói",1,0,"Phụ thuộc vào quy mô, vị trí xây dựng",0],
    ["Định vị ranh đất","điểm",1,1200000,"Dịch vụ",1200000],
    ["Xin cấp đồng hồ điện","gói",1,10000000,"Dịch vụ",10000000],
    ["Xin cấp đồng hồ nước","gói",1,5000000,"Dịch vụ",5000000],
    ["Tháo dỡ, múc móng nhà cũ, hút hầm phân","gói",1,0,"",0],
    ["Hàng rào tạm","m",1,80000,"Hàng rào tole phẳng",80000],
    ["Cổng công trình","cái",1,3000000,"Cửa cổng sắt ốp tole, xếp trượt",3000000],
    ["Nhà vệ sinh tạm","cái",1,18000000,"Nhà vệ sinh di động + bồn cầu + vòi nước",18000000],
    ["Tủ điện tạm","cái",1,1500000,"Tủ điện, MCB chống giật, ổ cắm",1500000],
    ["Khoan khảo sát địa chất","m",1,350000,"Đất cấp I-II-III, độ sâu hố khoan 30-40m, bao gồm thí nghiệm xuyên tiêu chuẩn SPT Không bao gồm thí nghiệm 9 chỉ tiêu cơ lý đất và thí nghiệm nén 3 trục",350000]
  ]},
  {r:"II",t:"Ép cọc",loai:'kt_chitiet',mode:'item',items:[
    ["Ép cọc BTCT 250x250, m300, tải 70T","m",1,260000,"",260000],
    ["Nhân công ép cọc BTCT tải 70T","m",1,70000,"Đơn giá cho trên 20m/tim cọc (tùy địa chất khu vực)",70000],
    ["Nhân công ép cọc BTCT","tim",1,1200000,"Đơn giá cho dưới 20m/tim cọc (tùy địa chất khu vực)",1200000],
    ["Vận chuyển cọc trong hẻm nhỏ, hoặc hẻm cấm tải","m",1,40000,"Tăng bo, đẩy tay vào công trình (tùy thuộc vào chiều dài tuyến đường)",40000],
    ["Ép cọc ly tâm A300, PHC, tải 100T","m",1,360000,"",360000],
    ["Nhân công ép cọc ly tâm","m",1,80000,"Đơn giá cho trên 20m/tim cọc (tùy địa chất khu vực)",80000],
    ["Nhân công ép cọc ly tâm","tim",1,1300000,"Đơn giá cho dưới 20m/tim cọc (tùy địa chất khu vực)",1300000]
  ]},
  {r:"III",t:"Biện pháp thi công hầm",loai:'kt_chitiet',mode:'item',items:[
    ["Ép cừ C200, cừ dài 4,5m (1 hệ shoring)","m",1,2800000,"Khối lượng tính theo chu vi hầm",2800000],
    ["Đào đất hầm","m3",1,0,"Nằm trong đơn giá thi công thô, không tính riêng",0],
    ["Cọc vây biện pháp D300 (cọc khoan nhồi)","m",1,480000,"Thi công trong trường hợp không ép cừ C, khoan cọc theo chu vi hầm",480000],
    ["Vận chuyển bùn đất đi đổ","m3",1,180000,"Bùn đất trong quá trình khoan cọc nhồi",180000]
  ]},
  {r:"IV",t:"Đơn giá xây dựng thô",loai:'kt_chitiet',mode:'item',items:[
    ["Xây dựng thô","m2",1,3050000,"Nhà phố chiều ngang 4m - 6m, hoàn thiện 2 mặt trước sau, đường trên 3m",3050000],
    ["Xây dựng thô","m2",1,3150000,"Nhà phố chiều ngang 6m - 8m, hoàn thiện 2 mặt trước sau, đường trên 3m",3150000],
    ["Xây dựng thô","m2",1,3200000,"Nhà phố chiều ngang 4m - 6m, hoàn thiện 3 - 4 mặt, đường trên 3m",3200000],
    ["Xây dựng thô","m2",1,3350000,"Nhà phố chiều ngang 6m - 8m, hoàn thiện 3- 4 mặt, đường trên 3m",3350000],
    ["Xây dựng trong hẻm nhỏ","m2",1,450.0002,"Hẻm nhỏ 2m - 2,5m, vận chuyển bằng xe ba gác hoặc hẻm cấm tải",450.0002],
    ["Nhân công hoàn thiện","m2",1,450.0002,"",450.0002]
  ]},
  {r:"V",t:"Đơn giá MEP âm",loai:'kt_chitiet',mode:'item',items:[
    ["Thi công MEP phần âm","m2",1,450000,"Không bao gồm hệ thống camera, điện lạnh, mạng Lan văn phòng, chống sét, đấu nối hệ thống thoát nước ra cống chung",450000],
    ["Nhân công hoàn thiện MEP","m2",1,200.0002,"Nhân công lắp đặt thiết bị điện, đèn chiếu sáng, thiết bị nước, thiết bị vệ sinh",200.0002]
  ]},
  {r:"VI",t:"Hệ số tính diện tích",loai:'kt_chitiet',mode:'area',up:3050000,items:[
    ["Móng đơn + đà kiềng","m2",0,0.3,""],
    ["Móng cọc + giằng móng","m2",0,0.5,""],
    ["Móng băng 1 phương","m2",0,0.5,""],
    ["Móng băng 2 phương","m2",0,0.7,""],
    ["Móng bè","m2",0,1,""],
    ["Hố pit thang máy","m2",0,1,""],
    ["Hầm sâu 1 - 1,3m tính từ vỉa hè","m2",0,1.5,""],
    ["Hầm sâu 1.3m - 1,7m tính từ vỉa hè","m2",0,1.7,""],
    ["Hầm sâu 1.7m - 2m tính từ vỉa hè","m2",0,2,""],
    ["Hầm sâu 2m - 2,5m tính từ vỉa hè","m2",0,2.5,""],
    ["Tầng 1","m2",0,1,""],
    ["Sân trước, sân sau","m2",0,0.5,""],
    ["Sân vườn","m2",0,0.5,""],
    ["Tầng lửng","m2",0,1,"Diện tích không tính ô thông tầng lửng"],
    ["Ô thông tầng lửng","m2",0,0.5,"Tính 0,5 do xung quanh ô thông tầng vẫn phải đổ dầm, xây tường, trát tường"],
    ["Tầng 2 ... (bao gồm ban công)","m2",0,1,""],
    ["Sân thượng có mái che","m2",0,1,""],
    ["Sân thượng không mái che","m2",0,0.5,""],
    ["Mái Tole","m2",0,0.3,"Tính theo diện tích mặt nghiêng"],
    ["Mái BTCT","m2",0,0.5,""],
    ["Mái ngói kèo sắt (hệ xà gồ, ngói lợp)","m2",0,0.7,"Tính theo diện tích mặt nghiêng"],
    ["Mái BTCT dán ngói","m2",0,1,"Tính theo diện tích mặt nghiêng"]
  ]},
  {r:"VII",t:"Xây tường, trát tường",loai:'kt_chitiet',mode:'item',items:[
    ["Tường xây 100mm, tường gạch ống, vữa xây M75","m2",1,310000,"",310000],
    ["Tường xây 200mm, tường gạch ống 5 lớp câu gạch đinh, vữa xây M75","m2",1,590000,"",590000],
    ["Đà lanh tô cửa đi 1 cánh (tường 100)","cái",1,300000,"Đà lanh tô đúc sẵn 1100mm",300000],
    ["Nẹp V góc tường, cạnh tường","md",1,30000,"Nẹp nhựa",30000],
    ["Đóng lưới thép đường điện, giáp mí bê tông - gạch","m",1,22000,"Lưới mắt cáo",22000],
    ["Trát tường ngoài vữa xi măng M75","m2",1,160000,"",160000],
    ["Trát tường trong vữa xi măng M75","m2",1,150000,"",150000],
    ["Trát cạnh tường / má cửa, bề rộng tường 100, vữa xi măng M75","m",1,76000,"",76000],
    ["Trát cạnh tường / má cửa, bề rộng tường 200, vữa xi măng M75","m",1,120000,"",120000]
  ]},
  {r:"VIII",t:"Chống thấm, cán nền",loai:'kt_chitiet',mode:'item',items:[
    ["Cán nền 3-5cm, vữa xi măng M75","m2",1,135000,"",135000],
    ["Chống thấm sàn, tường","m2",1,225000,"Chống thấm SIKA topseal 109 / Kova CT11A quét 2 lớp",225000]
  ]},
  {r:"IX",t:"Ốp lát gạch",loai:'kt_chitiet',mode:'item',items:[
    ["Nhân công lát gạch","m2",1,150000,"Gạch 300x600, 600x600",150000],
    ["Nhân công lát gạch","m2",1,180000,"Gạch 600x1200, 800x800, 900x900",180000],
    ["Nhân công ốp gạch","m2",1,160000,"Gạch 300x600, 600x600",160000],
    ["Nhân công ốp gạch","m2",1,190000,"Gạch 600x1200, 800x800, 900x900",190000],
    ["Keo dán gạch ngoại thất","m2",1,100000,"Webertai gres / Đơn giá vật tư",100000],
    ["Keo dán gạch nội thất","m2",1,70000,"Webertai vis, Webertai fix / Đơn giá vật tư",70000],
    ["Chà ron gạch khổ lớn","m2",1,120000,"Keo ron epoxy 2 thành phần Cetex / Saveto",120000],
    ["Chà ron gạch khổ nhỏ","m2",1,230000,"Keo ron epoxy 2 thành phần Cetex / Saveto",230000]
  ]},
  {r:"X",t:"Thạch cao",loai:'kt_chitiet',mode:'item',items:[
    ["Trần thạch cao khung chìm","m2",1,165000,"Khung xương Vĩnh Tường M29 ,tấm thạch cao Gyproc 9mm",165000],
    ["Trần thạch cao khung chìm chống ẩm","m2",1,175000,"Khung xương Vĩnh Tường M29 ,tấm thạch cao Gyproc 9mm chống ẩm",175000],
    ["Trần thạch cao khung chìm","m2",1,190000,"Khung xương Vĩnh Tường Tika ,tấm thạch cao Gyproc 9mm",190000],
    ["Trần thạch cao khung chìm chống ẩm","m2",1,200000,"Khung xương Vĩnh Tường Tika ,tấm thạch cao Gyproc 9mm chống ẩm",200000],
    ["Trần thạch cao khung chìm","m2",1,230000,"Khung xương Vĩnh Tường Alpha ,tấm thạch cao Gyproc 9mm",230000],
    ["Trần thạch cao khung chìm chống ẩm","m2",1,240000,"Khung xương Vĩnh Tường Alpha ,tấm thạch cao Gyproc 9mm chống ẩm",240000],
    ["Trần thạch cao khung chìm","m2",1,315000,"Khung xương Vĩnh Tường Basi ,tấm thạch cao Gyproc 9mm",315000],
    ["Trần thạch cao khung chìm chống ẩm","m2",1,325000,"Khung xương Vĩnh Tường Basi ,tấm thạch cao Gyproc 9mm chống ẩm",325000],
    ["Thanh shadowline","md",1,75000,"",75000],
    ["Vách thạch cao 1 mặt","m2",1,220000,"Xương U Vĩnh Tường ,tấm thạch cao Gyproc 9mm ốp 1 mặt",220000],
    ["Vách thạch cao 2 mặt","m2",1,320000,"Xương U Vĩnh Tường ,tấm thạch cao Gyproc 9mm ốp 2 mặt",320000],
    ["Vách thạch cao 2 mặt cách âm","m2",1,410000,"Xương U Vĩnh Tường ,tấm thạch cao Gyproc 9mm ốp 2 mặt, bông thủy tinh cách âm, cách nhiệt",410000],
    ["Nắp thăm trần 450x450","cái",1,350000,"Vĩnh Tường",350000],
    ["Nắp thăm trần 600x600","cái",1,450000,"Vĩnh Tường",450000]
  ]},
  {r:"XI",t:"Sơn nước",loai:'kt_chitiet',mode:'item',items:[
    ["Bả matit ngoại thất, bả 2 lớp","m2",1,50000,"Dulux / Jotun ngoại thất",50000],
    ["Bả matit nội thất, bả 2 lớp","m2",1,40000,"Dulux / Jotun nội thất",40000],
    ["Sơn ngoại thất, 1 lớp lót 2 lớp phủ","m2",1,90000,"Dulux weathershield / Jotun Jotashield",90000],
    ["Sơn nội thất, 1 lớp lót 2 lớp phủ","m2",1,80000,"Dulux easyclean / Jotun essence",80000],
    ["Sơn hiệu ứng","m2",1,350000,"Pukaco / Conpa",350000],
    ["Sơn giả đá","m2",1,500000,"Kova / Hòa Bình",500000]
  ]},
  {r:"XII",t:"Đá",loai:'kt_chitiet',mode:'item',items:[
    ["Đá nung kết 12mm","m2",1,4000000,"Vasta khổ lớn chuẩn Châu Âu",4000000],
    ["Đá nung kết 9mm","m2",1,1600000,"Vasta",1600000],
    ["Đá granite 16mm -20mm","m2",1,1700000,"Đen kim sa / đen Ấn Độ",1700000],
    ["Đá marble trắng Ý","m2",1,0,"",0],
    ["Đá marble đen tia chớp","m2",1,0,"",0],
    ["Đá marble Cream Marfil","m2",1,0,"",0],
    ["Đá marble Emperador","m2",1,0,"",0],
    ["Đá xuyên sáng Onyx","m2",1,0,"Bán theo tấm - tùy nhà cung cấp",0],
    ["Đá Vicostone 20mm","m2",1,3250000,"Vicostone nhóm P",3250000],
    ["Đá Vicostone 20mm","m2",1,4800000,"Vicostone nhóm A",4800000],
    ["Đá Vicostone 20mm","m2",1,6000000,"Vicostone nhóm B",6000000],
    ["Đá Vicostone 20mm","m2",1,7700000,"Vicostone nhóm C",7700000],
    ["Đá Vicostone 20mm","m2",1,9400000,"Vicostone nhóm D",9400000],
    ["Đá Vicostone 20mm","m2",1,11100000,"Vicostone nhóm E",11100000],
    ["Đá ngạch cửa rộng 100","m2",1,350000,"Đen kim sa / đen Ấn Độ",350000],
    ["Đá ngạch cửa rộng 200","m2",1,500000,"Đen kim sa / đen Ấn Độ",500000]
  ]},
  {r:"XIII",t:"Sàn gỗ",loai:'kt_chitiet',mode:'item',items:[
    ["Sàn gỗ công nghiệp 8mm","m2",1,395000,"An Cường, cốt gỗ HDF, lớp foam 3mm",395000],
    ["Sàn gỗ công nghiệp 12mm lát thẳng","m2",1,475000,"An Cường, cốt gỗ HDF, lớp foam 3mm",475000],
    ["Sàn gỗ công nghiệp 12mm xương cá","m2",1,505000,"An Cường, cốt gỗ HDF, lớp foam 3mm",505000],
    ["Sàn gỗ kỹ thuật 15mm","m2",1,1100000,"Bề mặt gỗ tự nhiên, lớp lõi Plywood/HDF",1100000],
    ["Sàn gỗ tự nhiên 15mm","m2",1,1255000,"Gỗ sồi",1255000],
    ["Sàn gỗ tự nhiên 15mm","m2",1,1505000,"Walnut",1505000],
    ["Sàn gỗ biến tính 26mm","m2",1,2430000,"Themor thông, bao gồm khung xương sắt",2430000],
    ["Sàn gỗ biến tính 20mm","m2",1,3230000,"Themor tần bì, bao gồm khung xương sắt",3230000],
    ["Len gỗ tự nhiên","m",1,250000,"",250000],
    ["Len nhựa","m",1,75000,"",75000],
    ["Nẹp nhôm kết thúc","m",1,80000,"",80000]
  ]},
  {r:"XIV",t:"Nhôm, kính, sắt",loai:'kt_chitiet',mode:'item',items:[
    ["Xingfa Việt Nam","",1,0,"",0],
    ["Cửa đi / cửa sổ mở quay","m2",1,2100000,"Nhôm Xingfa Việt Nam hệ 55 dày1.4ly, kính trắng 08mm cường lực, phụ kiện Kinlong loại 1",2100000],
    ["Cửa đi / cửa sổ lùa","m2",1,1900000,"Nhôm Xingfa Việt Nam hệ 55 dày 1.4ly, kính trắng 08mm cường lực, phụ kiện Kinlong loại 1",1900000],
    ["Cửa sổ bật","m2",1,1950000,"Nhôm Xingfa Việt Nam hệ 55 dày 1.4ly, kính trắng 08mm cường lực, phụ kiện Kinlong loại 1",1950000],
    ["Vách kính cố định","m2",1,1200000,"Nhôm Xingfa Việt Nam hệ 55 dày 1.4ly, kính trắng 08mm cường lực",1200000],
    ["Xingfa Quảng Đông hệ 55","",1,0,"",0],
    ["Cửa đi / cửa sổ mở quay","m2",1,2600000,"Nhôm Xingfa Việt Nam Quảng Đông hệ 55 dày 2,0ly, kính trắng 10mm cường lực, phụ kiện Kinlong chính hãng",2600000],
    ["Cửa đi / cửa sổ lùa","m2",1,2400000,"Nhôm Xingfa Việt Nam Quảng Đông hệ 55 dày 2.0ly, kính trắng 10mm cường lực, phụ kiện Kinlong chính hãng",2400000],
    ["Cửa sổ bật","m2",1,2500000,"Nhôm Xingfa Việt Nam Quảng Đông hệ 55 dày 2,0ly, kính trắng 10mm cường lực, phụ kiện Kinlong chính hãng",2500000],
    ["Vách kính cố định","m2",1,1500000,"Nhôm Xingfa Việt Nam Quảng Đông hệ 55 dày 1.4ly, kính trắng 10mm cường lực",1500000],
    ["Xingfa Quảng Đông hệ 93","",1,0,"",0],
    ["Cửa đi / cửa sổ mở quay","m2",1,2800000,"Nhôm Xingfa Việt Nam Quảng Đông hệ 55 dày 2,0ly, kính trắng 10mm cường lực, phụ kiện Kinlong chính hãng",2800000],
    ["Cửa đi / cửa sổ lùa","m2",1,2600000,"Nhôm Xingfa Việt Nam Quảng Đông hệ 55 dày 2.0ly, kính trắng 10mm cường lực, phụ kiện Kinlong chính hãng",2600000],
    ["Cửa sổ bật","m2",1,2700000,"Nhôm Xingfa Việt Nam Quảng Đông hệ 55 dày 2,0ly, kính trắng 10mm cường lực, phụ kiện Kinlong chính hãng",2700000],
    ["Vách kính cố định","m2",1,1700000,"Nhôm Xingfa Việt Nam Quảng Đông hệ 55 dày 2,0ly, kính trắng 10mm cường lực",1700000],
    ["Vách kính tắm","",1,0,"",0],
    ["Vách kính WC","m2",1,800000,"Kính trắng 10mm cường lực, vách kính thẳng",800000],
    ["Vách kính WC","m2",1,1200000,"Kính màu 10mm cường lực, vách kính thẳng",1200000],
    ["Vách kính WC","m2",1,1800000,"Kính sọc 10mm cường lực, vách kính thẳng",1800000],
    ["Bộ phụ kiện vách kính tắm (bản lề, tay nắm, kẹp kính)","bộ",1,2400000,"VVP chính hãng",2400000],
    ["Bộ phụ kiện vách kính tắm (bản lề, tay nắm, kẹp kính)","bộ",1,3800000,"Hafele chính hãng",3800000],
    ["Bộ phụ kiện cửa kính (bản lề sàn 150kg, kẹp kính, khóa sàn)","bộ",1,3900000,"VVP chính hãng",3900000],
    ["Bộ phụ kiện cửa kính (bản lề sàn 150kg, kẹp kính, khóa sàn)","bộ",1,5500000,"Hafele chính hãng",5500000],
    ["Lan can cầu thang / ban công","",1,0,"",0],
    ["Lan can kính bắt hông (cầu thang)","m",1,850000,"Kính trắng 10mm cường lực, vách kính thẳng, không tay vịn",850000],
    ["Lan can kính bắt hông (cầu thang)","m",1,1300000,"Kính dán an toàn 2 lớp 10,38mm, vách kính thẳng, không tay vịn",1300000],
    ["Lan can kính âm (chôn ray U)","m",1,1200000,"Kính màu 10mm cường lực, vách kính thẳng, không tay vịn",1200000],
    ["Lan can kính âm (chôn ray U)","m",1,1750000,"Kính dán an toàn 2 lớp 10,38mm, vách kính thẳng, không tay vịn",1750000],
    ["Lan can sắt đơn giản","m",1,1200000,"Cây đứng sắt hộp / sắt la, tay vịn sắt sắt hộp / sắt la, sơn 2 thành phần",1200000],
    ["Lan can sắt cổ điển","m",1,0,"Tùy theo thiết kế",0],
    ["Tay vịn gỗ sơn Pu","m",1,550000,"Gỗ thông / gỗ sồi",550000],
    ["Tay vịn nhôm vuông 20x20","m",1,380000,"",380000]
  ]},
  {r:"XV",t:"Cửa cuốn",loai:'kt_chitiet',mode:'item',items:[
    ["Cửa cuốn trượt trần overhead","m2",1,4300000,"Austdoor",4300000],
    ["Cửa cuốn khe thoáng","m2",1,2550000,"Austdoor S7",2550000],
    ["Cửa cuốn khe thoáng","m2",1,1980000,"Mitadoor X50R",1980000],
    ["Motor cửa cuốn 300kg","cái",1,9200000,"Austdoor AH300A",9200000],
    ["Motor cửa cuốn 300kg","cái",1,5500000,"YH Đài Loan",5500000],
    ["Bình lưu điện","cái",1,4375000,"Austdoor E1000",4375000],
    ["Bình lưu điện","cái",1,4000000,"YH Power Y1000",4000000]
  ]}
];
/* ═══ KHÁI TOÁN SƠ BỘ — bộ mẫu theo báo giá thật của Decox ═══
   Nguồn: "20260805 Decox - BG Building — XD-THÔ" (Tòa nhà văn phòng, B123 The Galleria
   Residence, Metropole Thủ Thiêm; 981m² sàn, 1 bán hầm + 5 tầng + sân thượng + mái).
   Sơ bộ chạy theo NHÓM: bấm + ở tên nhóm để lấy cả nhóm, diện tích/hệ số/đơn giá sửa lại
   theo từng dự án. Nhóm nào chủ đầu tư chưa chốt thì để "chưa bao gồm" (mode none/area0). */
var PT_MAU=[{
  id:'bg_building_2026',
  ten:'Tòa nhà văn phòng 981m² — 1 bán hầm, 5 tầng, sân thượng, mái',
  mo:'Metropole Thủ Thiêm · đất trống, xây mới · phong cách hiện đại',
  tong:8881778400
}];
var PT_SOBO=[
  {r:"I",t:"CÔNG TÁC CHUẨN BỊ",loai:'kt_sobo',mode:'none',note:'Nhóm này thường do chủ đầu tư tự làm — báo giá mẫu để "chưa bao gồm"',items:[
    ["Xin phép xây dựng","gói","Chưa bao gồm"],
    ["Đập phá, tháo dỡ nhà hiện trạng","gói","Chưa bao gồm"],
    ["Khoan khảo sát địa chất","gói","Chưa bao gồm"],
    ["Cắm mốc định vị ranh xây dựng","gói","Chưa bao gồm"],
    ["Xin cấp đồng hồ điện, nước","gói","Chưa bao gồm"]
  ]},
  {r:"II",t:"CÔNG TÁC ÉP CỌC",loai:'kt_sobo',mode:'item',items:[
    ["Giàn tải, máy ép cọc Pmax 90T","gói",1,28000000,"Huy động, dựng và tháo giàn ép",28000000],
    ["Nhân công ép cọc PHC D300 lực ép P(max) 90 tấn","tim",56,2250000,"Số tim cọc tạm tính",2250000],
    ["Cọc ly tâm D300 PHC lực ép P(max) 90 tấn","md",1120,414000,"56 tim × 20m/tim — số tim, số m tạm tính",414000]
  ]},
  {r:"III",t:"BIỆN PHÁP THI CÔNG HẦM",loai:'kt_sobo',mode:'item',items:[
    ["Ép cừ C200 chu vi hầm, cừ C dài 4,5m","md",62,4436000,"Khối lượng theo chu vi hầm",4436000],
    ["Hệ Shoring","hệ",1,30000000,"",30000000],
    ["Đào đất, vận chuyển đi đổ","m3",388.65,185000,"",185000]
  ]},
  {r:"IV",t:"THI CÔNG XÂY THÔ",loai:'kt_sobo',mode:'area',up:4200000,
   note:'Không bao gồm nhân công hoàn thiện, MEP âm tường, bể PCCC. Đơn giá tính trên khối lượng quy đổi (diện tích × hệ số)',items:[
    ["Móng (diện tích bao ngoài toàn bộ móng, dầm móng)","m2",278.00,0.5,""],
    ["Hầm + ram dốc","m2",178.56,1.7,""],
    ["Tầng 1","m2",156.00,1.0,""],
    ["Sân vườn ngoài trời","m2",104.39,0.5,""],
    ["Tầng 2-4 (bao gồm ban công)","m2",178.78,3.0,"Hệ số 3 = 3 tầng giống nhau"],
    ["Tầng 5 (bao gồm ban công)","m2",185.92,1.0,""],
    ["Tầng thượng có mái che","m2",50.63,1.0,""],
    ["Tầng thượng không mái che","m2",82.37,0.5,""],
    ["Mái bê tông cốt thép","m2",50.63,0.5,""],
    ["Tum thang máy","m2",5.17,0.5,""]
  ]},
  {r:"V",t:"HỆ THỐNG MEP (điện · cấp thoát nước · data)",loai:'kt_sobo',mode:'area',up:750000,
   note:'Không bao gồm nhân công lắp đặt và thiết bị đầu cuối',items:[
    ["Hầm","m2",178.56,1.0,""],
    ["Tầng 1 (bao gồm diện tích sân vườn)","m2",260.39,1.0,""],
    ["Tầng 2-4","m2",178.78,3.0,""],
    ["Tầng 5","m2",185.92,1.0,""],
    ["Sân thượng","m2",133.00,1.0,""],
    ["Mái","m2",50.63,0.5,""]
  ]},
  {r:"VI",t:"CHỐNG THẤM",loai:'kt_sobo',mode:'area0',note:'Chưa bao gồm trong báo giá mẫu — có khối lượng để chốt đơn giá sau',items:[
    ["Hầm (sàn + vách hầm + hố pit)","m2",250.01,1.0,"Chưa bao gồm"],
    ["Nhà vệ sinh","m2",83.97,1.0,"Chưa bao gồm"],
    ["Ban công tầng 2-5","m2",195.67,1.0,"Chưa bao gồm"],
    ["Sân thượng ngoài trời","m2",121.85,1.0,"Chưa bao gồm"],
    ["Mái","m2",70.75,1.0,"Chưa bao gồm"]
  ]},
  {r:"VII",t:"HỆ THỐNG PCCC",loai:'kt_sobo',mode:'none',note:'Chưa bao gồm — báo giá riêng theo hồ sơ thẩm duyệt PCCC',items:[
    ["Bể chứa nước PCCC theo quy định","gói","Chưa bao gồm"],
    ["Hệ thống báo cháy","gói","Chưa bao gồm"],
    ["Hệ thống chữa cháy","gói","Chưa bao gồm"],
    ["Hệ thống thoát hiểm và hỗ trợ","gói","Chưa bao gồm"]
  ]},
  {r:"VIII",t:"CHI PHÍ KHÁC",loai:'kt_sobo',mode:'item',items:[
    ["Dọn dẹp mặt bằng","gói",1,30000000,"Phát quang cây cỏ, thu gom xà bần, rác thải hiện trạng, san đất tạo mặt bằng",30000000],
    ["Phun thuốc chống mối","gói",1,63690000,"Cho tầng hầm và tầng 1",63690000],
    ["Bao che công trình (giàn giáo, lưới, bạt…)","gói",1,140000000,"",140000000],
    ["Hàng rào bao quanh công trình, cổng công trình","gói",1,75000000,"",75000000],
    ["Camera quan sát công trình","cái",3,1200000,"",1200000],
    ["Mạng internet trong quá trình thi công","tháng",6,350000,"",350000],
    ["Nhà vệ sinh di động","cái",1,20000000,"",20000000],
    ["Thùng rác","cái",1,900000,"",900000],
    ["Thiết bị PCCC (bình chữa cháy 4kg)","cái",8,600000,"",600000],
    ["Vệ sinh công trình hằng ngày (xây dựng thô)","gói",1,45000000,"",45000000],
    ["Vận chuyển xà bần, rác thải trong quá trình thi công","tháng",6,7500000,"",7500000],
    ["Văn phòng tạm tại công trình trong quá trình thi công","tháng",6,8000000,"",8000000],
    ["Công tác an toàn lao động","gói",1,28000000,"Nội quy, biển báo, đồ bảo hộ, lan can chắn, lưới hứng các khu vực mép sàn",28000000],
    ["Chi phí thẩm tra biện pháp thi công hầm","gói",1,20000000,"Theo quy định",20000000],
    ["Chi phí thanh tra xây dựng kiểm tra trong quá trình thi công phần thô","gói",5,5000000,"",5000000],
    ["Chi phí trắc đạc","tầng",8,7000000,"",7000000],
    ["Chi phí điện nước thi công 6 tháng (phần thô)","gói",6,3500000,"",3500000],
    ["Chi phí thang vận","gói",1,0,"Chưa bao gồm",0],
    ["Đấu nối hệ thống thoát nước thải vào cống chung","gói",1,0,"Chưa bao gồm",0]
  ]}
];
PT_TEMPLATE=PT_TEMPLATE.concat(PT_SOBO);
var PT_ROMAN=['I','II','III','IV','V','VI','VII','VIII','IX','X','XI','XII','XIII','XIV','XV','XVI'];
function ptN(v){ if(typeof v==='number') return v; var x=parseFloat(String(v==null?'':v).replace(/[^\d.\-]/g,'')); return isNaN(x)?0:x; }
function ptR0(x){ return Math.round(x||0); }
function ptR2(x){ return Math.round((x||0)*100)/100; }
function ptQty(x){ x=Number(x)||0; return x.toLocaleString('vi-VN',{maximumFractionDigits:2}); }
// Thư viện nội dung công việc (Phần thô) — hiện ở panel trái, bấm + để thêm vào bảng ước tính
/* ═══ PHÂN LOẠI BÁO GIÁ PHẦN THÔ (theo sơ đồ nghiệp vụ) ═══
   DỰ TOÁN   ├─ Nhân công  -> ra báo giá theo m2/md/cái
             └─ Vật tư     -> ra báo giá vật tư
   KHÁI TOÁN ├─ Chi tiết   -> chọn nhà thầu -> ra báo giá theo m2/md/cái
             └─ Sơ bộ      -> chọn nhà thầu -> chọn dự án mẫu -> ra đơn giá trọn gói
   Khái toán: thư viện 156 công tác (bảng giá cố định).
   Dự toán : nhập SỐ LIỆU ĐẦU VÀO -> tự tính khối lượng -> áp ĐỊNH MỨC hao phí (xem DT_BO). */
var PT_LOAI=[
  ['kt_chitiet','Khái toán chi tiết','Khái toán','Chọn nhà thầu → ra báo giá theo m2 / md / cái'],
  ['kt_sobo',   'Khái toán sơ bộ',   'Khái toán','Chọn nhà thầu → chọn dự án mẫu → ra đơn giá trọn gói'],
  ['dt_nhancong','Dự toán · Nhân công','Dự toán','Nhập số liệu đầu vào → tính khối lượng → nhân công và ca máy theo định mức'],
  ['dt_vattu',   'Dự toán · Vật tư',  'Dự toán','Nhập số liệu đầu vào → khối lượng vật tư × đơn giá nhà cung cấp']
];
function ptCfLoad_(){ if(S.ptCf) return; try{ S.ptCf=JSON.parse(localStorage.getItem('qs_ptcf')||'{}')||{}; }catch(e){ S.ptCf={}; } }
ptCfLoad_();
function ptLoai_(){
  if(S._ptLoai===undefined){ try{ S._ptLoai=localStorage.getItem('qs_ptLoai')||'kt_chitiet'; }catch(e){ S._ptLoai='kt_chitiet'; } }
  return ptLoaiGop_(S._ptLoai||'kt_chitiet');
}
function ptSetLoai(v){ S._ptLoai=v; try{ localStorage.setItem('qs_ptLoai',v); }catch(e){} renderPTLibrary();
  if(typeof renderMM_==='function') renderMM_();
  // bảng trống: lời nhắc trong bảng khác nhau giữa Khái toán và Dự toán -> vẽ lại cho khớp
  if(Array.isArray(S.phanTho)&&!S.phanTho.length) renderPhanTho(); }
function ptSecsOfLoai_(v){ v=ptLoaiGop_(v); return PT_TEMPLATE.filter(function(s){ return !s.an && ptLoaiGop_(s.loai)===v; }); }
function ptLoaiCount_(v){ return ptSecsOfLoai_(v).reduce(function(a,s){ return a+s.items.length; },0); }

/* ═══════════════ DỰ TOÁN THEO ĐỊNH MỨC ═══════════════
   Khác Khái toán: người dùng nhập SỐ LIỆU ĐẦU VÀO (ô vàng trong file Excel)
   -> hệ thống tự tính KHỐI LƯỢNG -> nhân với ĐỊNH MỨC HAO PHÍ (nhân công / ca máy)
   -> ra bảng công tác + thành tiền.  (nguồn: file du_toan_ep_coc_D300)
   Mỗi "bộ dự toán" sinh ra 2 nhóm trong thư viện: Nhân công & máy  +  Vật tư.       */
var DT_BO=[{
  id:'ep_coc_d300',
  ten:'Ép cọc ly tâm PHC/PC D300 — máy ép robot 860T',
  nguon:'Định mức 12/2021/TT-BXD · mã AC.26300 / AC.29400 / AC.21500',
  dinhMuc:'100m',
  ghiChu:'Định mức đóng/ép tính cho đoạn cọc ngập đất; đoạn không ngập đất × 0,75 · ép cọc xiên × 1,22. '
        +'Chưa gồm: đào phá đầu cọc, thí nghiệm nén tĩnh/PDA, vận chuyển cọc ngoài phạm vi.',
  inputs:[
    ['dk',   'Đường kính cọc',            'mm',    300,     0],
    ['sl',   'Số lượng cọc',              'cây',   56,      0],
    ['dai',  'Chiều dài mỗi cọc',         'm',     18,      0],
    ['doan', 'Số đoạn cọc / 1 cọc',       'đoạn',  2,       0],
    ['dgcoc','Đơn giá cọc (nguyên cây)',  'đ/cọc', 4050000, 1],
    ['khoan','Chiều dài khoan dẫn',       'm',     0,       0]
  ],
  // [nhãn, công thức (chữ), hàm tính, đvt]
  kl:[
    ['Tổng chiều dài cọc ép',        'Số cọc × Chiều dài mỗi cọc',    function(v){ return v.sl*v.dai; },        'm'],
    ['Tổng số đoạn cọc',             'Số cọc × Số đoạn/cọc',          function(v){ return v.sl*v.doan; },       'đoạn'],
    ['Số mối nối cọc (hàn)',         'Số cọc × (Số đoạn/cọc − 1)',    function(v){ return v.sl*(v.doan-1); },   'mối nối'],
    ['Khối lượng ép cọc theo định mức','Tổng chiều dài ÷ 100',        function(v){ return v.sl*v.dai/100; },    '100m'],
    ['Chi phí vật liệu cọc',         'Số cọc × Đơn giá cọc',          function(v){ return v.sl*v.dgcoc; },      'đồng']
  ],
  // NHÂN CÔNG & MÁY: hao phí cho 1 đơn vị định mức (100m) × khối lượng định mức
  hp:[
    ['AC.26300','Nhân công ép cọc (bậc 3,5/7)',                'công', 5.5,  350000,  'Hao phí 5,5 công/100m'],
    ['AC.26300','Máy ép cọc robot thủy lực tự hành 860T',      'ca',   0.97, 9000000, 'Hao phí 0,97 ca/100m'],
    ['AC.26300','Cần cẩu 50T (phục vụ cẩu, dựng cọc)',         'ca',   0.24, 4500000, 'Hao phí 0,24 ca/100m']
  ],
  // CÔNG TÁC khác tính theo khối lượng riêng (đơn giá tự nhập theo hợp đồng)
  ct:[
    ['AC.29400','Nối cọc ống BTCT (hàn nối các đoạn cọc)','mối nối', function(v){ return v.sl*(v.doan-1); }, 0, 'Chỉ tính khi cọc > 1 đoạn — đơn giá theo báo giá nhà thầu'],
    ['AC.21500','Khoan dẫn phục vụ ép cọc (máy khoan xoay)','m',     function(v){ return v.khoan; },         0, 'Chỉ khi thiết kế/biện pháp thi công yêu cầu khoan dẫn']
  ],
  // VẬT TƯ: đơn giá quy về đơn vị đo
  vt:[
    ['Cọc bê tông ly tâm PHC/PC D300 (thân cọc, chưa gồm mũ + đệm đầu cọc)','m',
      function(v){ return v.sl*v.dai; },
      function(v){ return v.dai?(v.dgcoc/v.dai):0; },
      'Giá cọc theo báo giá nhà cung cấp thực tế']
  ]
}];
function dtKey_(id){ return 'qs_dt_'+id; }
function dtVals_(bo){
  S._dtIn=S._dtIn||{};
  if(!S._dtIn[bo.id]){
    var saved=null; try{ saved=JSON.parse(localStorage.getItem(dtKey_(bo.id))||'null'); }catch(e){}
    var v={}; bo.inputs.forEach(function(a){ v[a[0]]=a[3]; });
    if(saved&&typeof saved==='object') Object.keys(saved).forEach(function(k){ if(v[k]!==undefined) v[k]=ptN(saved[k]); });
    S._dtIn[bo.id]=v;
  }
  return S._dtIn[bo.id];
}
function dtSetIn(id,k,val){
  var bo=DT_BO.filter(function(b){ return b.id===id; })[0]; if(!bo) return;
  var def=bo.inputs.filter(function(a){ return a[0]===k; })[0];
  var v=dtVals_(bo);
  v[k]=def&&def[4]?ptMoneyN_(val):ptN(val);
  try{ localStorage.setItem(dtKey_(id),JSON.stringify(v)); }catch(e){}
  dtSync_(); dtApplyToTable_(); renderPTLibrary(); if(S.phanTho) renderPhanTho();
}
function dtResetIn(id){
  var bo=DT_BO.filter(function(b){ return b.id===id; })[0]; if(!bo) return;
  var v={}; bo.inputs.forEach(function(a){ v[a[0]]=a[3]; });
  S._dtIn=S._dtIn||{}; S._dtIn[bo.id]=v;
  try{ localStorage.removeItem(dtKey_(id)); }catch(e){}
  dtSync_(); dtApplyToTable_(); renderPTLibrary(); if(S.phanTho) renderPhanTho();
  toast('Đã trả số liệu đầu vào về mặc định');
}
// tính toàn bộ khối lượng của 1 bộ dự toán
function dtCalc_(bo){
  var v=dtVals_(bo);
  var dm=v.dai?(v.sl*v.dai/100):0;                       // khối lượng theo đơn vị định mức (100m)
  return {v:v, dm:dm, kl:bo.kl.map(function(a){ return {t:a[0],ct:a[1],r:a[2](v),dvt:a[3]}; })};
}
// sinh 2 nhóm (Nhân công & máy / Vật tư) cho mỗi bộ — GIỮ NGUYÊN object để index thư viện không đổi
function dtSync_(){
  DT_BO.forEach(function(bo,bi){
    var c=dtCalc_(bo), v=c.v;
    var nc=[], vt=[];
    bo.hp.forEach(function(a){
      var kl=ptR4_(a[3]*c.dm);
      nc.push([a[1]+'\n('+a[0]+' · '+ptQty(a[3])+' '+a[2]+'/'+bo.dinhMuc+')', a[2], kl, a[4], a[5], a[4]]);
    });
    bo.ct.forEach(function(a){
      nc.push([a[1]+'\n('+a[0]+')', a[2], ptR4_(a[3](v)), a[4], a[5], a[4]]);
    });
    bo.vt.forEach(function(a){
      vt.push([a[0], a[1], ptR4_(a[2](v)), ptR0(a[3](v)), a[4], ptR0(a[3](v))]);
    });
    dtPut_(bo,'dt_nhancong','NHÂN CÔNG & MÁY THI CÔNG — '+bo.ten.toUpperCase(), bi+1, nc);
    dtPut_(bo,'dt_vattu',   'VẬT TƯ — '+bo.ten.toUpperCase(),                   bi+1, vt);
  });
}
function ptR4_(x){ return Math.round((x||0)*10000)/10000; }
function dtPut_(bo,loai,ten,r,items){
  var sec=PT_TEMPLATE.filter(function(s){ return s.dtId===bo.id && s.loai===loai; })[0];
  if(!sec){ sec={r:String(r),t:ten,loai:loai,mode:'item',note:bo.nguon,up:0,dtId:bo.id,items:[]}; PT_TEMPLATE.push(sec); }
  sec.t=ten; sec.note=bo.nguon; sec.items=items;
}
// số liệu đầu vào đổi -> cập nhật luôn KHỐI LƯỢNG các dòng đã thêm vào bảng ước tính
function dtApplyToTable_(){
  if(!Array.isArray(S.phanTho)) return; var n=0;
  PT_TEMPLATE.filter(function(s){ return s.dtId; }).forEach(function(tsec){
    var sec=S.phanTho.filter(function(s){ return s.t===tsec.t; })[0]; if(!sec) return;
    tsec.items.forEach(function(a){
      sec.items.forEach(function(it){ if(String(it.n||'')===String(a[0])){ it.kl=a[2]; n++; } });
    });
  });
  if(n) ptPersist();
}
// bảng "Số liệu đầu vào + Khối lượng tính toán" — hiện ngay dưới bộ lọc khi chọn loại Dự toán
// các nhóm (nhân công / vật tư) do 1 bộ dự toán sinh ra
function dtSecs_(bo){ return PT_TEMPLATE.filter(function(s){ return s.dtId===bo.id; }); }
// đã đưa bộ này vào bảng ước tính chưa
function dtApplied_(bo){
  if(!Array.isArray(S.phanTho)) return false;
  return dtSecs_(bo).every(function(t){ return S.phanTho.some(function(s){ return s.t===t.t; }); });
}
// tiền của bộ: [nhân công & máy, vật tư, tổng trực tiếp]
function dtTien_(bo){
  var nc=0, vt=0;
  dtSecs_(bo).forEach(function(t){
    var s=t.items.reduce(function(a,x){ return a+ptR0(ptN(x[2])*ptN(x[3])); },0);
    if(t.loai==='dt_vattu') vt+=s; else nc+=s;
  });
  return {nc:nc, vt:vt, tong:nc+vt};
}
// MỘT NÚT = đưa CẢ bộ dự toán (nhân công & máy + vật tư) vào bảng — dự toán là 1 khối, không lượm từng dòng
function dtApply(id){
  var bo=DT_BO.filter(function(b){ return b.id===id; })[0]; if(!bo) return;
  ptEnsure();
  dtSecs_(bo).forEach(function(t){ ptAddToSec_(PT_TEMPLATE.indexOf(t), true); });
  ptPersist(); renderPhanTho(); renderPTLibrary();
  toast('Đã đưa bộ dự toán vào bảng — sửa số liệu đầu vào là bảng tự cập nhật');
}
function dtRemove(id){
  var bo=DT_BO.filter(function(b){ return b.id===id; })[0]; if(!bo) return;
  var ten={}; dtSecs_(bo).forEach(function(t){ ten[t.t]=1; });
  S.phanTho=(S.phanTho||[]).filter(function(s){ return !ten[s.t]; });
  ptPersist(); renderPhanTho(); renderPTLibrary();
  toast('Đã gỡ bộ dự toán khỏi bảng');
}
function dtPanel_(loai){
  return DT_BO.map(function(bo){
    var c=dtCalc_(bo), v=c.v, on=dtApplied_(bo), t=dtTien_(bo);
    return '<div class="dt-panel'+(on?' on':'')+'">'
      +'<div class="dt-hd"><span class="dt-tag">Bộ dự toán</span>'
        +(on?'<span class="dt-on">✓ đang dùng</span>':'')
        +'<b>'+esc(bo.ten)+'</b>'
        +'<span class="dt-src">'+esc(bo.nguon)+'</span>'
        +'<button class="dt-rs" onclick="dtResetIn(\''+bo.id+'\')" title="Trả số liệu đầu vào về mặc định">Mặc định</button></div>'
      +'<div class="dt-act">'
        +(on
          ? '<button class="dt-btn off" onclick="dtRemove(\''+bo.id+'\')">Gỡ khỏi bảng</button>'
          : '<button class="dt-btn" onclick="dtApply(\''+bo.id+'\')">'+icon('plus',14)+' Dùng bộ dự toán này</button>')
        +'<span class="dt-actn">Đưa cả nhân công · máy · vật tư vào bảng trong 1 lần</span></div>'
      +'<div class="dt-sec">I. Số liệu đầu vào</div>'
      +'<div class="dt-ins">'+bo.inputs.map(function(a){
          var val=v[a[0]];
          var inp=a[4]
            ? '<input class="dt-in" type="text" inputmode="numeric" value="'+esc(val?money(val):'')+'" onchange="dtSetIn(\''+bo.id+'\',\''+a[0]+'\',this.value)">'
            : '<input class="dt-in" type="number" step="any" value="'+(val===''||val==null?'':val)+'" onchange="dtSetIn(\''+bo.id+'\',\''+a[0]+'\',this.value)">';
          return '<label class="dt-fld"><span class="dt-lb">'+esc(a[1])+'</span>'+inp+'<span class="dt-dv">'+esc(a[2])+'</span></label>';
        }).join('')+'</div>'
      +'<div class="dt-sec">II. Khối lượng tính toán</div>'
      +'<table class="dt-kl"><thead><tr><th>Nội dung · công thức</th><th class="n">Kết quả</th><th>ĐVT</th></tr></thead><tbody>'
        +c.kl.map(function(k){
          var isMoney=k.dvt==='đồng';
          return '<tr><td><span class="dt-knm">'+esc(k.t)+'</span><span class="dt-ct">'+esc(k.ct)+'</span></td>'
            +'<td class="n b">'+(isMoney?money(ptR0(k.r)):ptQty(k.r))+'</td><td class="dt-dvt">'+esc(k.dvt)+'</td></tr>';
        }).join('')+'</tbody></table>'
      +'<div class="dt-sec">III. Chi phí trực tiếp</div>'
      +'<div class="dt-sum">'
        +'<div class="dt-srow"><span>Nhân công &amp; máy thi công</span><b>'+money(t.nc)+'</b></div>'
        +'<div class="dt-srow"><span>Vật tư</span><b>'+money(t.vt)+'</b></div>'
        +'<div class="dt-srow tot"><span>Tổng chi phí trực tiếp</span><b>'+money(t.tong)+'</b></div>'
      +'</div>'
      +'<p class="dt-note">'+esc(bo.ghiChu)+'</p>'
    +'</div>';
  }).join('');
}

dtSync_();   // nạp sẵn các bộ dự toán vào thư viện


var PT_CONTRACTORS=['H77','Decox','TTP','Unicons'];
/* ═══ CÔNG TÁC XÂY DỰNG LƯU TRÊN CSDL ═══
   Thư viện mẫu (PT_TEMPLATE) vẫn dùng được ngay; công tác do người dùng nhập nằm ở bảng
   cong_tac, có ảnh · duyệt · sửa · xoá giống hệt sản phẩm đèn. Các công tác của CSDL được
   gắn thêm vào PT_TEMPLATE dưới dạng hạng mục thật (đánh dấu sec.db) nên mọi chỗ đang dùng
   (thư viện trái, bảng Danh sách sản phẩm, panel thông tin, thêm vào bảng khái toán) chạy
   như cũ, không phải sửa lại đường đi dữ liệu.                                            */
function ctOf_(a){ return (a && a.ct) || null; }
/* ═══ PHÂN LỚP CÔNG TÁC THEO ĐỀ MỤC CÂY ═══
   Thư viện công tác (Phần thô) có cả nhóm hoàn thiện. Mỗi nhóm được xếp thêm vào đúng đề mục
   để khi bóc tách Thạch cao / Sơn nước / Xây tô / Ốp lát / Cửa thì panel trái có công tác để chọn.
   Công tác VẪN hiện ở 3.1 Phần thô như cũ (khái toán trọn gói vẫn chọn được).
   Xếp theo tên nhóm (hạng mục của công tác) — thêm quy tắc ở đây khi có nhóm mới.      */
var CT_DEMUC_RULES=[
  [/thach cao/,'3.2.1'],
  [/son nuoc|\bson\b/,'3.2.2'],
  [/xay tuong|trat tuong|xay to/,'3.2.3'],
  [/op lat|\bda\b|san go/,'3.2.4'],
  [/nhom|kinh|\bsat\b|cua cuon|\bcua\b/,'3.2.8']
];
function ctDeMucOf_(hangMuc){
  var t=String(hangMuc||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/đ/g,'d').replace(/Đ/g,'D').toLowerCase();
  for(var i=0;i<CT_DEMUC_RULES.length;i++) if(CT_DEMUC_RULES[i][0].test(t)) return CT_DEMUC_RULES[i][1];
  return '';
}
// Các nhóm công tác (trong CSDL) thuộc đề mục đang chọn (kể cả khi chọn cấp con, vd 3.2.8.1 -> nhóm 3.2.8)
function ctSecsOfNode_(node){
  node=String(node||''); if(!node || node==='3.1') return [];
  return PT_TEMPLATE.filter(function(sec){
    if(!sec.db || !(sec.items||[]).length) return false;
    var dm=ctDeMucOf_(String(sec.t).split('\n')[0]); if(!dm) return false;
    return node===dm || node.indexOf(dm+'.')===0;
  });
}
// Thêm 1 công tác vào bảng bóc tách của đề mục đang chọn (dòng thường: ĐVT · đơn giá · SL)
function ctAddToBoc_(si,ii){
  var sec=PT_TEMPLATE[si], a=sec&&sec.items[ii]; if(!a) return;
  var c=ctOf_(a)||{}, dg=Number(c.dg)||ptLibDg_(sec,a)||0, von=Number(c.dgnt)||dg;
  var anh=String(c.hinhAnh||'').split('\n')[0];
  Promise.resolve(addProdObj({ ten:String(a[0]).split('\n')[0], ma:'', thuongHieu:'', ncc:c.ncc||'', moTa:String(c.gc||c.thongSo||'').trim(),
    kichThuoc:'', dvt:a[1]||c.dvt||'', hinhAnh:anh, donGiaVon:von, donGiaBan:dg, nhom:String(sec.t).split('\n')[0] }))
    .then(function(){ try{ renderCatalog(); }catch(e){} });      // cập nhật dấu "✓ đã thêm" trên thẻ
}
function renderCtLib_(secs){
  return '<div class="ptlib ctlib"><div class="ctlib-h">'+icon('layers',13)+' Công tác '+esc(nodeName(S.node))
      +'<span>'+secs.reduce(function(n,s){ return n+s.items.length; },0)+'</span></div>'
    +secs.map(function(sec){
    var si=PT_TEMPLATE.indexOf(sec), col=S._ptLibCol&&S._ptLibCol[si];
    return '<div class="ptlib-sec"><div class="ptlib-h" onclick="ptLibToggle('+si+')">'
        +'<span class="ptlib-caret">'+(col?'▸':'▾')+'</span><span class="ptlib-htt">'+esc(String(sec.t).split('\n')[0])+'</span>'
        +'<span class="ptlib-hn">'+sec.items.length+'</span>'
        +'<span class="ptlib-lo">'+esc(ptLoaiNgan_(sec.loai))+'</span></div>'
      +(col?'':'<div class="ptlib-items">'+sec.items.map(function(a,ii){
        var dg=ptLibDg_(sec,a), dt=S._ptDetail, on=(dt&&dt.si===si&&dt.ii===ii);
        var da=(S.lines||[]).some(function(l){ return l.nhom===S.node && l.ten===String(a[0]).split('\n')[0]; });
        return '<div class="ptlib-item'+(on?' on':'')+(da?' da':'')+'" title="Bấm để xem thông tin công tác" onclick="ptShowDetail_('+si+','+ii+')">'
          +'<div class="ptlib-nm" title="'+esc(String(a[0]).replace(/\n/g,' '))+'">'+esc(String(a[0]).split('\n')[0])+'</div>'
          +'<div class="ptlib-meta"><span class="ptlib-dvt">'+esc(a[1]||'')+'</span><span class="ptlib-dg">'+(dg?(money(dg)+' đ'):'—')+'</span>'
            +(da?'<span class="ptlib-da" title="Đã có trong bảng bóc tách">✓ đã thêm</span>':'')+'</div>'
          +'<button class="ptlib-add" title="Thêm vào bảng bóc tách" onclick="event.stopPropagation();ctAddToBoc_('+si+','+ii+')">'+icon('plus',14)+'</button></div>';
      }).join('')+'</div>')+'</div>';
  }).join('')+'</div>';
}
function ctSecOf_(sec){ return !!(sec && sec.db); }
function ctItemArr_(c){
  var a;
  if(c.mode==='item') a=[c.ten, c.dvt, c.kl===''?1:c.kl, c.dg, c.gc, c.dgnt];
  else if(c.mode==='area'||c.mode==='area0') a=[c.ten, c.dvt, c.dt===''?0:c.dt, c.hs===''?1:c.hs, c.gc];
  else a=[c.ten, c.dvt, c.gc];
  a.ct=c; return a;
}
/* Gom công tác CSDL thành các hạng mục, nối vào PT_TEMPLATE.
   Loại báo giá nào ĐÃ có dữ liệu trong CSDL thì bản dựng sẵn của loại đó bị ẩn đi —
   để mỗi công tác chỉ xuất hiện MỘT lần và luôn là bản ghi thật (có ★ · duyệt · sửa · xoá),
   đúng như sản phẩm đèn.                                                                */
function ctSyncTemplate_(){
  PT_TEMPLATE=PT_TEMPLATE.filter(function(s){ return !s.db; });
  var list=S.congTac||[], secs={}, order=[];
  list.forEach(function(c){
    var loai=c.loai||'kt_chitiet', t=c.hangMuc||'CHƯA PHÂN NHÓM', k=loai+'|'+t;
    if(!secs[k]){ secs[k]={r:c.maNhom||'', t:t, loai:loai, mode:c.mode||'item', db:true, up:0, items:[]}; order.push(k); }
    var sec=secs[k];
    if(!sec.r && c.maNhom) sec.r=c.maNhom;
    if(sec.mode==='area' && !sec.up && c.dg) sec.up=c.dg;      // đơn giá chung của nhóm
    sec.items.push(ctItemArr_(c));
  });
  order.forEach(function(k){ PT_TEMPLATE.push(secs[k]); });
  // loại nào đã có trong CSDL -> ẩn bản dựng sẵn của loại đó
  var dbLoai={}; list.forEach(function(c){ dbLoai[c.loai||'kt_chitiet']=1; });
  S._ptDbLoai=dbLoai;
  PT_TEMPLATE.forEach(function(sc){ sc.an = !sc.db && !!dbLoai[ptSecLoai_(sc)]; });
  _ptColCache=null;                                            // nhãn cột không đổi nhưng cho chắc
  if(!PT_ROMAN_EXT_){ PT_ROMAN_EXT_=1; }
}
var PT_ROMAN_EXT_=0;
async function ctLoad_(quiet){
  try{
    S.congTac=await api('ctList')||[];
    ctSyncTemplate_();
    return S.congTac;
  }catch(e){
    S.congTac=S.congTac||[];
    if(!quiet) toast('Không tải được công tác: '+e.message);
    return S.congTac;
  }
}
function ctReload_(){
  return ctLoad_(true).then(function(){
    if(S.node==='3.1'){ renderPTLibrary(); renderPhanTho(); }
    if(spPTMode_()){ spViewTabs_(); renderSpChips_(); spFilter(); }
  });
}
// Nạp thư viện mẫu vào CSDL để công tác có đủ ảnh / duyệt / sửa như sản phẩm
async function ctSeedFromTemplate_(){
  var rows=[];
  PT_TEMPLATE.filter(function(s){ return !s.db; }).forEach(function(sec,si){
    (sec.items||[]).forEach(function(a,ii){
      rows.push({loai:ptSecLoai_(sec), mode:sec.mode, maNhom:sec.r||'', hangMuc:String(sec.t).split('\n')[0],
        ten:String(a[0]), dvt:ptVal_(sec,a,'dvt'), kl:ptVal_(sec,a,'kl'), dt:ptVal_(sec,a,'dt'), hs:ptVal_(sec,a,'hs'),
        dgnt:ptVal_(sec,a,'dgnt'), dg:(sec.mode==='area'?(Number(sec.up)||0):ptVal_(sec,a,'dg')),
        gc:ptVal_(sec,a,'gc'), thuTu:si*1000+ii});
    });
  });
  if(!rows.length){ toast('Không có công tác mẫu để nạp'); return; }
  if(!confirm('Nạp '+rows.length+' công tác mẫu vào cơ sở dữ liệu?\nSau khi nạp, công tác có ảnh · duyệt · sửa như sản phẩm đèn.')) return;
  toast('Đang nạp '+rows.length+' công tác…');
  try{
    var r=await api('ctSeed', rows);
    if(r && r.daCo) { toast('Cơ sở dữ liệu đã có '+r.daCo+' công tác — không nạp lại'); return; }
    await ctReload_();
    toast('Đã nạp '+((r&&r.ok)||0)+' công tác vào cơ sở dữ liệu');
  }catch(e){ toast('Lỗi nạp: '+e.message); }
}
/* --- Duyệt / xoá / sửa 1 công tác của CSDL --- */
async function ctFav_(id, on){
  var c=(S.congTac||[]).filter(function(x){ return x.id===id; })[0];
  if(c) c.yeuThich=!!on;                       // đổi trước cho nhanh tay
  ctSyncTemplate_(); if(spPTMode_()) spFilter(); if(S.node==='3.1') renderPTLibrary();
  try{ await api('ctFav',[id],!!on); toast(on?'Đã thêm vào công tác yêu thích':'Đã bỏ khỏi công tác yêu thích'); }
  catch(e){ if(c) c.yeuThich=!on; ctSyncTemplate_(); if(spPTMode_()) spFilter(); toast('Lỗi: '+e.message); }
}
async function ctFavBulk_(on){
  var ids=ptSelRows_().map(function(r){ var c=ctOf_(r.a); return c&&c.id; }).filter(Boolean);
  if(!ids.length){ toast('Chỉ đánh dấu được công tác đã lưu trong cơ sở dữ liệu'); return; }
  try{ await api('ctFav',ids,!!on); S._spSel={}; await ctReload_(); toast((on?'Đã thêm ':'Đã bỏ ')+ids.length+' công tác yêu thích'); }
  catch(e){ toast('Lỗi: '+e.message); }
}
async function ctDuyet_(id, on){
  try{ await api('ctDuyet',[id], !!on); await ctReload_(); toast(on?'Đã duyệt công tác':'Đã bỏ duyệt'); }
  catch(e){ toast('Lỗi: '+e.message); }
}
async function ctDelete_(id, ten){
  if(!confirm('Xoá công tác "'+ten+'" khỏi cơ sở dữ liệu?')) return;
  try{ await api('ctDelete',[id]); await ctReload_(); toast('Đã xoá công tác'); }
  catch(e){ toast('Lỗi: '+e.message); }
}
async function ctDuyetBulk_(on){
  var ids=ptSelRows_().map(function(r){ var c=ctOf_(r.a); return c&&c.id; }).filter(Boolean);
  if(!ids.length){ toast('Chỉ duyệt được công tác đã lưu trong cơ sở dữ liệu'); return; }
  try{ await api('ctDuyet',ids,!!on); S._spSel={}; await ctReload_(); toast((on?'Đã duyệt ':'Đã bỏ duyệt ')+ids.length+' công tác'); }
  catch(e){ toast('Lỗi: '+e.message); }
}
// Sửa hàng loạt: đổi 1 trường cho mọi công tác đang chọn (giống bảng sản phẩm)
var CT_BULK_F=[['dg','Giá bán lẻ (đ)','money'],['dgnt','Đơn giá nhà thầu (đ)','money'],['dvt','Đơn vị tính','text'],
  ['ncc','Nhà thầu · nhà cung cấp','text'],['hangMuc','Hạng mục','text'],['maNhom','Số hạng mục','text'],
  ['loai','Loại báo giá','loai'],['gc','Ghi chú','text']];
function ctBulkEdit_(){
  return ctBulkEditRun_((document.getElementById('ctbField')||{}).value||'dg',
                        (document.getElementById('ctbValue')||{}).value||'');
}
async function ctBulkEditRun_(f, val){
  var rows=ptSelRows_().filter(function(r){ return ctOf_(r.a); });
  if(!rows.length){ toast('Chỉ sửa được công tác đã lưu trong cơ sở dữ liệu'); return; }
  var def=CT_BULK_F.filter(function(x){ return x[0]===f; })[0]; if(!def) return;
  val=String(val==null?'':val).trim();
  if(val===''){ toast('Nhập giá trị mới'); return; }
  var v = def[2]==='money' ? ptMoneyN_(val) : val;
  if(!confirm('Đặt "'+def[1]+'" = "'+val+'" cho '+rows.length+' công tác đã chọn?')) return;
  var btn=document.getElementById('ctbApply'); if(btn) btn.disabled=true;
  var ok=0, err='';
  for(var i=0;i<rows.length;i++){
    var c=ctOf_(rows[i].a);
    try{ var patch=ctPatchOf_(c); patch[f]=v; var out=await api('ctUpdate', c.id, patch); Object.assign(c,out); ok++; }
    catch(e){ err=e.message; }
  }
  S._spSel={}; await ctReload_();
  toast(ok?('Đã sửa '+ok+' công tác'+(err?(' · lỗi: '+err):'')):('Lỗi: '+err));
}
async function ctDeleteBulk_(){
  var ids=ptSelRows_().map(function(r){ var c=ctOf_(r.a); return c&&c.id; }).filter(Boolean);
  if(!ids.length){ toast('Chỉ xoá được công tác đã lưu trong cơ sở dữ liệu'); return; }
  if(!confirm('Xoá '+ids.length+' công tác khỏi cơ sở dữ liệu?')) return;
  try{ await api('ctDelete',ids); S._spSel={}; await ctReload_(); toast('Đã xoá '+ids.length+' công tác'); }
  catch(e){ toast('Lỗi: '+e.message); }
}
/* ═══ FORM NHẬP / SỬA CÔNG TÁC (dùng chung cho popup Sửa và tab Nhập dữ liệu) ═══ */
function ctHangMucList_(){
  var m={};
  PT_TEMPLATE.forEach(function(s){ if(!s.an) m[String(s.t).split('\n')[0]]=1; });
  (S.congTac||[]).forEach(function(c){ if(c.hangMuc) m[c.hangMuc]=1; });
  return Object.keys(m).sort(function(a,b){ return a.localeCompare(b,'vi'); });
}
var CT_MODE_LBL={item:'Khối lượng × đơn giá',area:'Diện tích × hệ số (đơn giá chung của nhóm)',
  area0:'Chỉ tính khối lượng (chưa có đơn giá)',none:'Chỉ liệt kê (chưa bao gồm)'};
function ctFormHtml_(c, pre){
  c=c||{}; pre=pre||'ct';
  var mode=c.mode||'item';
  function fld(span,id,lbl,val,ph,req,list,type){
    return '<div class="f f-'+span+'"><label for="'+pre+id+'">'+esc(lbl)+(req?'<b class="req">*</b>':'')+'</label>'
      +'<input id="'+pre+id+'" type="'+(type||'text')+'"'+(list?' list="'+list+'"':'')
      +' value="'+esc(val==null?'':val)+'" placeholder="'+esc(ph||'')+'"></div>';
  }
  function num(span,id,lbl,val,ph,cls){
    return '<div class="f f-'+span+(cls?' '+cls:'')+'"><label for="'+pre+id+'">'+esc(lbl)+'</label>'
      +'<input id="'+pre+id+'" type="number" step="any" value="'+esc(val==null?'':val)+'" placeholder="'+esc(ph||'')+'"></div>';
  }
  function ta(span,id,lbl,val,ph,rows){
    return '<div class="f f-'+span+'"><label for="'+pre+id+'">'+esc(lbl)+'</label>'
      +'<textarea id="'+pre+id+'" rows="'+(rows||2)+'" placeholder="'+esc(ph||'')+'">'+esc(val==null?'':val)+'</textarea></div>';
  }
  var dg=Number(c.dg)||0, dgnt=Number(c.dgnt)||0;
  var ck=(dg&&dgnt)?ptR2((1-dgnt/dg)*100):'';
  var MODES=[['item','Khối lượng × đơn giá','Đa số công tác: 1 tim cọc, 1 m3 đất…'],
             ['area','Diện tích × hệ số','Sàn, tầng — đơn giá chung cho cả hạng mục'],
             ['area0','Chỉ tính khối lượng','Có khối lượng, đơn giá chốt sau'],
             ['none','Chỉ liệt kê','Hạng mục "chưa bao gồm"']];
  return '<div class="ctf" id="'+pre+'Form">'

    /* ── Bước 1 ── */
    +'<section class="ctf-step"><header><span class="ctf-no">1</span>'
      +'<div><h4>Công tác này là gì?</h4><p>Tên và chỗ đứng của nó trong bảng khái toán</p></div></header>'
      +'<div class="ctf-grid">'
        +fld(12,'Ten','Nội dung công việc',c.ten,'VD: Giàn tải, máy ép cọc Pmax 90T',1)
        +fld(5,'HangMuc','Hạng mục',c.hangMuc,'VD: Công tác ép cọc',1,'ctHangMucDL')
        +fld(2,'MaNhom','Số hạng mục',c.maNhom,'II')
        +'<div class="f f-5"><label for="'+pre+'Loai">Loại báo giá<b class="req">*</b></label>'
          +'<select id="'+pre+'Loai">'+PT_LOAI.map(function(x){
              return '<option value="'+x[0]+'"'+(ptLoaiGop_(c.loai)===x[0]?' selected':'')+'>'+esc(x[1])+'</option>'; }).join('')
        +'</select></div>'
        +fld(6,'Ncc','Nhà thầu · nhà cung cấp',c.ncc,'VD: H77',0,'ctNccDL')
        +fld(6,'Dvt','Đơn vị tính',c.dvt,'VD: m · m2 · tim · gói',1,'ctDvtDL')
      +'</div>'
      +'<datalist id="ctHangMucDL">'+ctHangMucList_().map(function(v){ return '<option value="'+esc(v)+'">'; }).join('')+'</datalist>'
      +'<datalist id="ctNccDL">'+PT_CONTRACTORS.map(function(v){ return '<option value="'+esc(v)+'">'; }).join('')+'</datalist>'
      +'<datalist id="ctDvtDL">'+['m','m2','m3','md','tim','cái','bộ','gói','tấn','ngày','tháng','tầng','hệ','điểm','công','ca']
          .map(function(v){ return '<option value="'+esc(v)+'">'; }).join('')+'</datalist>'
    +'</section>'

    /* ── Bước 2 ── */
    +'<section class="ctf-step"><header><span class="ctf-no">2</span>'
      +'<div><h4>Tính tiền thế nào?</h4><p>Chọn cách tính rồi nhập giá — hệ thống tự ra phần còn lại</p></div></header>'
      +'<div class="ctf-seg" id="'+pre+'Seg">'+MODES.map(function(m){
          return '<button type="button" class="segb'+(mode===m[0]?' on':'')+'" data-m="'+m[0]+'" onclick="ctModePick_(\''+pre+'\',\''+m[0]+'\')">'
            +'<b>'+esc(m[1])+'</b><i>'+esc(m[2])+'</i></button>'; }).join('')
      +'<input type="hidden" id="'+pre+'Mode" value="'+esc(mode)+'"></div>'
      +'<div class="ctf-grid">'
        +num(4,'Kl','Khối lượng mẫu',c.kl,'1','ct-f-kl')
        +num(4,'Dt','Diện tích mẫu (m²)',c.dt,'0','ct-f-dt')
        +num(4,'Hs','Hệ số',c.hs,'1','ct-f-hs')
        +'<div class="f f-4 ct-f-dg"><label for="'+pre+'Dg">Giá bán lẻ (đ)<b class="req">*</b></label>'
          +'<input id="'+pre+'Dg" class="ct-money" inputmode="numeric" value="'+esc(dg?money(dg):'')+'" placeholder="0" oninput="ctGiaSync_(\''+pre+'\',\'dg\')"></div>'
        +'<div class="f f-4 ct-f-ck"><label for="'+pre+'Ck">%Chiết khấu</label>'
          +'<input id="'+pre+'Ck" class="ct-pct" inputmode="decimal" value="'+esc(ck===''?'':ck)+'" placeholder="0" oninput="ctGiaSync_(\''+pre+'\',\'ck\')"></div>'
        +'<div class="f f-4 ct-f-dgnt"><label for="'+pre+'Dgnt">Giá đại lý · giá vốn (đ)</label>'
          +'<input id="'+pre+'Dgnt" class="ct-money" inputmode="numeric" value="'+esc(dgnt?money(dgnt):'')+'" placeholder="0" oninput="ctGiaSync_(\''+pre+'\',\'dgnt\')"></div>'
        +'<div class="f f-12"><div class="ctf-prev" id="'+pre+'Prev"></div></div>'
      +'</div>'
    +'</section>'

    /* ── Bước 3 ── */
    +'<section class="ctf-step"><header><span class="ctf-no">3</span>'
      +'<div><h4>Mô tả thêm <span class="opt">không bắt buộc</span></h4><p>Ghi chú, thông số, ảnh — hiện ở panel thông tin công tác</p></div></header>'
      +'<div class="ctf-grid">'
        +ta(6,'Gc','Ghi chú · điều kiện áp dụng',c.gc,'VD: Đơn giá cho trên 20m/tim cọc (tùy địa chất khu vực)',3)
        +ta(6,'PhamVi','Phạm vi ứng dụng — mỗi dòng 1 ý',c.phamVi,'Nhà phố, biệt thự có tầng hầm\nMặt bằng đủ rộng cho xe cẩu',3)
      +'</div>'
      +'<div class="ctf-sub"><span>Thông số kỹ thuật</span>'
        +'<button type="button" class="ct-addbig" onclick="ctGrpAdd_(\''+pre+'\')">'+icon('plus',13)+' Thêm đề mục lớn</button></div>'
      +'<div class="ct-grps" id="'+pre+'Grps"></div>'
      +'<input type="hidden" id="'+pre+'ThongSo" value="'+esc(c.thongSo||'')+'">'
      +'<div class="ctf-grid" style="margin-top:14px">'
        +'<div class="f f-6"><label>Ảnh công tác</label>'
          +'<div class="ct-imgrow" id="'+pre+'ImgRow"></div>'
          +'<button type="button" class="btn ghost sm" onclick="ctPickImg_(\''+pre+'\')">'+icon('plus',14)+' Thêm ảnh</button>'
          +'<input type="hidden" id="'+pre+'HinhAnh" value="'+esc(c.hinhAnh||'')+'"></div>'
        +fld(6,'LinkTaiLieu','Link tài liệu kỹ thuật',c.linkTaiLieu,'https://…')
      +'</div>'
    +'</section>'
  +'</div>';
}
/* ═══ FORM NHẬP CÔNG TÁC PHẦN THÔ — bố cục theo bản vẽ ═══
   Thông tin cơ bản (3 cột) → Thông tin giá bán → các khối "Đề mục lớn", mỗi khối là lưới
   thẻ "Đề mục nhỏ" (ô nhập + nút Lưu) → Thông tin khác (loại báo giá, cách tính, ảnh…).
   Dùng lại ĐÚNG các id của form cũ nên đọc/lưu (ctFormRead_, ctImpSave) không đổi gì. */
function ctFormHtml2_(c, pre){
  c=c||{}; pre=pre||'imp';
  var mode=c.mode||'item';
  var PLUS='<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M12 6v12M6 12h12"/></svg>';
  var IMP=(pre==='imp');       // trang Nhập dữ liệu: cùng quy ước với form Thiết bị đèn / vệ sinh
  function lbl(id,t,req){ return '<label for="'+pre+id+'">'+esc(t)+(req?(IMP?' <span style="color:#c33">*</span>':'<b class="req">✱</b>'):'')+'</label>'; }
  function note(t){ return IMP?'<p class="dbnote c2note">'+esc(t)+'</p>':''; }
  function inp(id,t,val,ph,req,list,extra){
    return '<div class="c2f">'+lbl(id,t,req)+'<div class="c2i">'
      +'<input id="'+pre+id+'"'+(list?' list="'+list+'"':'')+' value="'+esc(val==null?'':val)+'" placeholder="'+esc(ph||'')+'"'+(extra||'')+'>'
      +(list?'<button type="button" class="c2i-b" tabindex="-1" title="Chọn từ danh sách" onclick="ctListOpen_(\''+pre+id+'\')">'+PLUS+'</button>':'')
      +'</div></div>';
  }
  var dg=Number(c.dg)||0, dgnt=Number(c.dgnt)||0, ck=(dg&&dgnt)?ptR2((1-dgnt/dg)*100):'';
  var MODES=[['item','Khối lượng × đơn giá'],['area','Diện tích × hệ số'],['area0','Chỉ tính khối lượng'],['none','Chỉ liệt kê']];
  return '<div class="ctf ctx2" id="'+pre+'Form">'
    +'<section class="c2s"><h3 class="c2h"><span class="c2hic">'+icon('tag',18)+'</span>Thông tin cơ bản</h3><div class="c2g">'
      +inp('Ten','Tên hạng mục',c.ten,'VD: Giàn tải, máy ép cọc Pmax 90T',1)
      +inp('Ncc','Nhà cung cấp (Nếu có)',c.ncc,'VD: H77',0,'ctNccDL')
      +inp('HangMuc','Hạng mục',c.hangMuc,'VD: Công tác ép cọc',1,'ctHangMucDL')
    +'</div></section>'
    +'<section class="c2s"><h3 class="c2h"><span class="c2hic">'+icon('money',18)+'</span>Thông tin giá bán</h3>'
      +note('Giá đại lý tự tính = Giá bán lẻ × (1 − %Chiết khấu). Nhập giá đại lý thì %Chiết khấu tự tính ngược lại.')+'<div class="c2g">'
      +'<div class="c2f ct-f-dg">'+lbl('Dg','Giá bán lẻ',1)+'<div class="c2i"><input id="'+pre+'Dg" class="ct-money" inputmode="numeric" value="'+esc(dg?money(dg):'')+'" placeholder="VD: 450.000" oninput="ctGiaSync_(\''+pre+'\',\'dg\')"><span class="c2u">VND</span></div></div>'
      +'<div class="c2f ct-f-ck">'+lbl('Ck','%Chiết khấu',1)+'<div class="c2i"><input id="'+pre+'Ck" class="ct-pct" inputmode="decimal" value="'+esc(ck===''?'':ck)+'" placeholder="VD: 10" oninput="ctGiaSync_(\''+pre+'\',\'ck\')"><span class="c2u">%</span></div></div>'
      +'<div class="c2f ct-f-dgnt">'+lbl('Dgnt','Giá đại lý',1)+'<div class="c2i"><input id="'+pre+'Dgnt" class="ct-money" inputmode="numeric" value="'+esc(dgnt?money(dgnt):'')+'" placeholder="Tự tính" oninput="ctGiaSync_(\''+pre+'\',\'dgnt\')"><span class="c2u">VND</span></div></div>'
      +inp('Dvt','Đơn vị tính',c.dvt,'VD: gói · m · m2 · tim',1,'ctDvtDL')
      +'<div class="c2f c2-span2"><label>&nbsp;</label><div class="ctf-prev" id="'+pre+'Prev"></div></div>'
    +'</div></section>'
    +'<div id="'+pre+'Grps"></div>'
    +'<input type="hidden" id="'+pre+'ThongSo" value="'+esc(c.thongSo||'')+'">'
    +'<section class="c2s"><h3 class="c2h"><span class="c2hic">'+icon('sliders',18)+'</span>Thông tin khác'+(IMP?'':' <span class="c2opt">loại báo giá · cách tính · ảnh</span>')+'</h3>'
      +note('Loại báo giá, cách tính khối lượng và tài liệu kỹ thuật đi kèm công tác.')+'<div class="c2g">'
      +'<div class="c2f">'+lbl('Loai','Loại báo giá',1)+'<div class="c2i"><select id="'+pre+'Loai">'+PT_LOAI.map(function(x){
          return '<option value="'+x[0]+'"'+(ptLoaiGop_(c.loai)===x[0]?' selected':'')+'>'+esc(x[1])+'</option>'; }).join('')+'</select></div>'
        +'<input type="hidden" id="'+pre+'LoaiGoc" value="'+esc(c.loai||'')+'"></div>'
      +'<div class="c2f">'+lbl('ModeSel','Cách tính',0)+'<div class="c2i"><select id="'+pre+'ModeSel" onchange="ctModePick_(\''+pre+'\',this.value)">'
          +MODES.map(function(m){ return '<option value="'+m[0]+'"'+(mode===m[0]?' selected':'')+'>'+esc(m[1])+'</option>'; }).join('')
        +'</select></div><input type="hidden" id="'+pre+'Mode" value="'+esc(mode)+'"><div id="'+pre+'Seg" style="display:none"></div></div>'
      +inp('MaNhom','Số hạng mục',c.maNhom,'VD: II')
      +'<div class="c2f ct-f-kl">'+lbl('Kl','Khối lượng mẫu',0)+'<div class="c2i"><input id="'+pre+'Kl" type="number" step="any" value="'+esc(c.kl==null?'':c.kl)+'" placeholder="1"></div></div>'
      +'<div class="c2f ct-f-dt">'+lbl('Dt','Diện tích mẫu (m²)',0)+'<div class="c2i"><input id="'+pre+'Dt" type="number" step="any" value="'+esc(c.dt==null?'':c.dt)+'" placeholder="0"></div></div>'
      +'<div class="c2f ct-f-hs">'+lbl('Hs','Hệ số',0)+'<div class="c2i"><input id="'+pre+'Hs" type="number" step="any" value="'+esc(c.hs==null?'':c.hs)+'" placeholder="1"></div></div>'
      +'<div class="c2f">'+lbl('Gc','Ghi chú · điều kiện áp dụng',0)+'<div class="c2i"><textarea id="'+pre+'Gc" rows="2" placeholder="VD: Đơn giá cho trên 20m/tim cọc">'+esc(c.gc||'')+'</textarea></div></div>'
      +'<div class="c2f">'+lbl('PhamVi','Phạm vi ứng dụng',0)+'<div class="c2i"><textarea id="'+pre+'PhamVi" rows="2" placeholder="Mỗi dòng 1 ý">'+esc(c.phamVi||'')+'</textarea></div></div>'
      +inp('LinkTaiLieu','Link tài liệu kỹ thuật',c.linkTaiLieu,'https://…')
      +(IMP?'<input type="hidden" id="'+pre+'HinhAnh" value="'+esc(c.hinhAnh||'')+'">'      // ảnh: khối Ảnh dùng chung ở đầu trang
        :('<div class="c2f c2-span3 ct-f-img"><label>Ảnh công tác</label><div class="ct-imgrow" id="'+pre+'ImgRow"></div>'
        +'<button type="button" class="btn ghost sm" onclick="ctPickImg_(\''+pre+'\')">'+icon('plus',14)+' Thêm ảnh</button>'
        +'<input type="hidden" id="'+pre+'HinhAnh" value="'+esc(c.hinhAnh||'')+'"></div>'))
    +'</div></section>'
    +'<datalist id="ctHangMucDL">'+ctHangMucList_().map(function(v){ return '<option value="'+esc(v)+'">'; }).join('')+'</datalist>'
    +'<datalist id="ctNccDL">'+PT_CONTRACTORS.map(function(v){ return '<option value="'+esc(v)+'">'; }).join('')+'</datalist>'
    +'<datalist id="ctDvtDL">'+['m','m2','m3','md','tim','cái','bộ','gói','tấn','ngày','tháng','tầng','hệ','điểm','công','ca']
        .map(function(v){ return '<option value="'+esc(v)+'">'; }).join('')+'</datalist>'
  +'</div>';
}
// nút ＋ trong ô có danh sách gợi ý: mở danh sách chọn
function ctListOpen_(id){ var e=document.getElementById(id); if(!e) return; e.focus(); try{ if(e.showPicker) e.showPicker(); }catch(x){} }
/* Đề mục lớn / nhỏ dạng THẺ: mỗi đề mục lớn là 1 khối, mỗi đề mục nhỏ là 1 thẻ nhập + Lưu */
function ctGrpRenderCards_(pre){
  var box=document.getElementById(pre+'Grps'); if(!box) return;
  var grps=ctGrpsGet_(pre);
  if(!grps.length){ grps.push({t:'',rows:[{k:'',v:''},{k:'',v:''},{k:'',v:''}]}); }
  var PLUS='<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M12 6v12M6 12h12"/></svg>';
  var IMP=(pre==='imp');
  box.innerHTML=grps.map(function(g,gi){
    return '<section class="c2s c2grp">'
      +'<div class="c2gh"><span class="c2hic">'+icon('doc',18)+'</span><input class="c2gt" id="'+pre+'GT'+gi+'" value="'+esc(g.t||'')+'" placeholder="Đề mục lớn — VD: Thông số kỹ thuật tham khảo">'
        +'<button type="button" class="c2plus" title="Thêm đề mục lớn" onclick="ctGrpAddCard_(\''+pre+'\','+gi+')">'+PLUS+'</button>'
        +(grps.length>1?'<button type="button" class="c2del" title="Xoá đề mục lớn này" onclick="ctGrpDel_(\''+pre+'\','+gi+')">Xoá</button>':'')
      +'</div>'
      +((IMP&&gi===0)?'<p class="dbnote c2note">Thông số kỹ thuật của công tác — đặt tên đề mục lớn, mỗi ô đề mục nhỏ 1 thông tin (VD Lực ép tối đa: 90 tấn). Bấm + để thêm.</p>':'')
      +'<div class="c2g">'+g.rows.map(function(r,ri){
          var txt=(r.k&&String(r.k).trim())?(String(r.k).trim()+': '+(r.v||'')):(r.v||'');
          return '<div class="c2card'+(r._ok?' ok':'')+'">'
            +'<div class="c2ch"><b>Đề mục nhỏ</b>'
              +'<button type="button" class="c2plus sm" title="Thêm đề mục nhỏ" onclick="ctCardAdd_(\''+pre+'\','+gi+','+ri+')">'+PLUS+'</button>'
              +'<button type="button" class="c2x" title="Xoá đề mục nhỏ" onclick="ctRowDel_(\''+pre+'\','+gi+','+ri+')">✕</button></div>'
            +'<div class="c2cb"><textarea id="'+pre+'GV'+gi+'_'+ri+'" placeholder="Nhập thông tin đề mục nhỏ — VD: Lực ép tối đa: 90 tấn" oninput="this.closest(\'.c2card\').classList.remove(\'ok\')">'+esc(txt)+'</textarea>'
              +'<button type="button" class="c2save" onclick="ctCardSave_(\''+pre+'\','+gi+','+ri+')">'+(r._ok?'Đã lưu ✓':'Lưu')+'</button></div>'
          +'</div>';
        }).join('')+'</div>'
    +'</section>';
  }).join('');
}
function ctGrpAddCard_(pre,gi){ var g=ctGrpRead_(pre); g.splice(gi+1,0,{t:'',rows:[{k:'',v:''},{k:'',v:''},{k:'',v:''}]}); ctGrpSet_(pre,g); }
function ctCardAdd_(pre,gi,ri){ var g=ctGrpRead_(pre); g[gi].rows.splice(ri+1,0,{k:'',v:''}); ctGrpSet_(pre,g); }
function ctCardSave_(pre,gi,ri){
  var g=ctGrpRead_(pre), r=g[gi]&&g[gi].rows[ri]; if(!r) return;
  if(!String(r.v||'').trim()){ toast('Nhập thông tin đề mục nhỏ trước'); return; }
  r._ok=true; ctGrpSet_(pre,g);
  toast('Đã lưu đề mục nhỏ — bấm "Đưa vào danh sách chờ" để ghi cả công tác');
}
function ctModePick_(pre,m){
  var h=document.getElementById(pre+'Mode'); if(h) h.value=m;
  var seg=document.getElementById(pre+'Seg');
  if(seg) seg.querySelectorAll('.segb').forEach(function(b){ b.classList.toggle('on', b.dataset.m===m); });
  ctModeSync_(pre);
}
function fmtMoney_(v){ var n=Number(v)||0; return n?money(n):''; }
/* Giá bán lẻ ⟷ %Chiết khấu ⟷ Giá đại lý: gõ ô nào cũng tự tính 2 ô còn lại */
function ctGiaSync_(pre,src){
  var eDg=document.getElementById(pre+'Dg'), eCk=document.getElementById(pre+'Ck'), eNt=document.getElementById(pre+'Dgnt');
  if(!eDg||!eCk||!eNt) return;
  var dg=ptMoneyN_(eDg.value), nt=ptMoneyN_(eNt.value), ck=ptN(String(eCk.value).replace(',','.'));
  if(src==='dg'||src==='ck'){
    if(dg&&ck) nt=Math.round(dg*(1-ck/100));
    else if(dg&&!ck&&src==='dg'&&nt) ck=ptR2((1-nt/dg)*100);
  }else if(src==='dgnt'){
    if(dg&&nt) ck=ptR2((1-nt/dg)*100);
  }
  if(src!=='dgnt') eNt.value=nt?money(nt):'';
  if(src!=='ck')   eCk.value=(ck||ck===0)?ck:'';
  if(src!=='dg')   eDg.value=dg?money(dg):'';
  ctPrev_(pre);
}
/* ── Đề mục lớn / đề mục nhỏ ──
   Lưu vào 1 ô text: "## Tên đề mục lớn" rồi các dòng "Tên: giá trị" — dễ đọc, dễ sửa tay,
   và panel thông tin hiện đúng từng nhóm.                                              */
function ctGrpParse_(txt){
  var out=[], cur=null;
  String(txt||'').split(/\r?\n/).forEach(function(raw){
    var l=raw.trim(); if(!l) return;
    // dòng thụt vào = dòng tiếp theo của CÙNG một đề mục nhỏ (thẻ nhập nhiều dòng)
    if(/^\s+/.test(raw) && cur && cur.rows.length){ var last=cur.rows[cur.rows.length-1]; last.v=(last.v?last.v+'\n':'')+l; return; }
    var m=l.match(/^##\s*(.*)$/);
    if(m){ cur={t:m[1].trim(),rows:[]}; out.push(cur); return; }
    if(!cur){ cur={t:'Thông số kỹ thuật',rows:[]}; out.push(cur); }
    var kv=l.match(/^([^:：]{1,60})[:：]\s*(.*)$/);
    cur.rows.push(kv?{k:kv[1].trim(),v:kv[2].trim()}:{k:'',v:l});
  });
  return out;
}
function ctGrpText_(grps){
  grps=(grps||[]).filter(function(g){ return String(g.t||'').trim() || (g.rows||[]).some(function(r){ return String(r.k||'').trim()||String(r.v||'').trim(); }); });
  return grps.map(function(g){
    return '## '+(g.t||'Thông số kỹ thuật')+'\n'
      +g.rows.filter(function(r){ return (r.k||'').trim()||(r.v||'').trim(); })
             .map(function(r){ var t=(r.k||'').trim()?((r.k).trim()+': '+(r.v||'').trim()):(r.v||'').trim();
               return t.split(/\r?\n/).map(function(x,i){ return i?('  '+x.trim()):x; }).join('\n'); }).join('\n');
  }).join('\n').replace(/\n{3,}/g,'\n\n').trim();
}
function ctGrpsGet_(pre){
  S._ctGrp=S._ctGrp||{};
  if(!S._ctGrp[pre]) S._ctGrp[pre]=ctGrpParse_((document.getElementById(pre+'ThongSo')||{}).value||'');
  return S._ctGrp[pre];
}
function ctGrpSet_(pre,g){ S._ctGrp=S._ctGrp||{}; S._ctGrp[pre]=g; ctGrpRender_(pre); }
function ctGrpSave_(pre){
  var el=document.getElementById(pre+'ThongSo'); if(el) el.value=ctGrpText_(ctGrpsGet_(pre));
}
function ctGrpRead_(pre){                     // đọc lại từ DOM trước khi lưu
  var grps=ctGrpsGet_(pre);
  grps.forEach(function(g,gi){
    var t=document.getElementById(pre+'GT'+gi); if(t) g.t=t.value;
    g.rows.forEach(function(r,ri){
      var k=document.getElementById(pre+'GK'+gi+'_'+ri), v=document.getElementById(pre+'GV'+gi+'_'+ri);
      if(k) r.k=k.value;
      if(v){ if(!k && v.tagName==='TEXTAREA') r.k=''; r.v=v.value; }   // thẻ đề mục nhỏ: cả nội dung trong 1 ô
    });
  });
  ctGrpSave_(pre);
  return grps;
}
function ctGrpAdd_(pre){ var g=ctGrpRead_(pre); g.push({t:'',rows:[{k:'',v:''}]}); ctGrpSet_(pre,g); }
function ctGrpDel_(pre,gi){ var g=ctGrpRead_(pre); g.splice(gi,1); ctGrpSet_(pre,g); }
function ctRowAdd_(pre,gi){ var g=ctGrpRead_(pre); g[gi].rows.push({k:'',v:''}); ctGrpSet_(pre,g); }
function ctRowDel_(pre,gi,ri){ var g=ctGrpRead_(pre); g[gi].rows.splice(ri,1); if(!g[gi].rows.length) g[gi].rows.push({k:'',v:''}); ctGrpSet_(pre,g); }
function ctGrpRender_(pre){
  var f=document.getElementById(pre+'Form');
  if(f && f.classList.contains('ctx2')) return ctGrpRenderCards_(pre);
  var box=document.getElementById(pre+'Grps'); if(!box) return;
  var grps=ctGrpsGet_(pre);
  if(!grps.length){
    box.innerHTML='<div class="ct-grp-empty">Chưa có đề mục nào. Bấm <b>Thêm đề mục lớn</b> để mô tả thông số kỹ thuật '
      +'(VD: <i>Thông số kỹ thuật tham khảo</i> → <i>Lực ép tối đa (Pmax): 90 tấn</i>).</div>';
    return;
  }
  box.innerHTML=grps.map(function(g,gi){
    return '<div class="ct-grp">'
      +'<div class="ct-grp-h">'
        +'<input class="ct-grp-t" id="'+pre+'GT'+gi+'" value="'+esc(g.t||'')+'" placeholder="Tên đề mục lớn — VD: Thông số kỹ thuật tham khảo">'
        +'<button type="button" class="ct-grp-x" title="Xoá đề mục lớn" onclick="ctGrpDel_(\''+pre+'\','+gi+')">✕</button>'
      +'</div>'
      +'<div class="ct-grp-b">'+g.rows.map(function(r,ri){
        return '<div class="ct-kv">'
          +'<input class="ct-kv-k" id="'+pre+'GK'+gi+'_'+ri+'" value="'+esc(r.k||'')+'" placeholder="Tên đề mục nhỏ">'
          +'<input class="ct-kv-v" id="'+pre+'GV'+gi+'_'+ri+'" value="'+esc(r.v||'')+'" placeholder="Giá trị / mô tả">'
          +'<button type="button" class="ct-kv-x" title="Xoá dòng" onclick="ctRowDel_(\''+pre+'\','+gi+','+ri+')">✕</button>'
        +'</div>';
      }).join('')+'</div>'
      +'<button type="button" class="ct-addsmall" onclick="ctRowAdd_(\''+pre+'\','+gi+')">'+icon('plus',12)+' Thêm đề mục nhỏ</button>'
    +'</div>';
  }).join('');
}
function ctModeSync_(pre){
  var m=(document.getElementById(pre+'Mode')||{}).value||'item';
  var box=document.getElementById(pre+'Form'); if(!box) return;
  function show(cls,on){ box.querySelectorAll('.'+cls).forEach(function(e){ e.style.display=on?'':'none'; }); }
  show('ct-f-kl', m==='item');
  show('ct-f-dt', m==='area'||m==='area0');
  show('ct-f-hs', m==='area'||m==='area0');
  show('ct-f-dgnt', m==='item');
  show('ct-f-ck', m==='item');
  show('ct-f-dg', m==='item'||m==='area');
  ctGiaSync_(pre,'');
}
// Dòng xem trước: đúng như dòng sẽ nằm trong bảng khái toán
function ctPrev_(pre){
  var box=document.getElementById(pre+'Prev'); if(!box) return;
  function v(id){ var e=document.getElementById(pre+id); return e?String(e.value||'').trim():''; }
  var m=v('Mode')||'item', dvt=v('Dvt')||'—';
  var dg=ptMoneyN_(v('Dg')), nt=ptMoneyN_(v('Dgnt'));
  var kl = m==='item' ? (ptN(v('Kl'))||0) : (ptN(v('Dt'))*(ptN(v('Hs'))||0));
  if(m==='none'){ box.innerHTML='<span class="pv-l">Dòng trong bảng</span><b>chỉ liệt kê, không tính tiền</b>'; return; }
  var tt=Math.round(kl*dg), ln=Math.round(kl*(dg-nt)), pct=dg?((dg-nt)/dg*100):0;
  box.innerHTML='<span class="pv-l">Dòng trong bảng</span>'
    +'<b>'+ptQty(kl||0)+' '+esc(dvt)+' × '+money(dg)+' đ = '+money(tt)+' đ</b>'
    +(nt?'<i class="'+(ln<0?'neg':'')+'">lợi nhuận '+money(ln)+' đ · '+pct.toFixed(1)+'%</i>':'<i>chưa nhập giá vốn</i>');
}
function ctFormInit_(pre){
  ctImgRender_(pre); ctGrpRender_(pre); ctModeSync_(pre); ctGiaSync_(pre,'');
  var f=document.getElementById(pre+'Form');
  if(f) f.addEventListener('input',function(e){ if(/^(.*)(Kl|Dt|Hs|Dvt)$/.test(e.target.id)) ctPrev_(pre); });
}
function ctImgRender_(pre){
  var box=document.getElementById(pre+'ImgRow'); if(!box) return;
  var v=(document.getElementById(pre+'HinhAnh')||{}).value||'';
  var arr=String(v).split('\n').map(function(x){return x.trim();}).filter(Boolean);
  box.innerHTML=arr.length?arr.map(function(u,i){
    return '<div class="ct-img"><img src="'+esc(imgUrlOf(u))+'" onerror="this.style.visibility=\'hidden\'">'
      +'<button type="button" class="ct-imgx" title="Bỏ ảnh này" onclick="ctImgDel_(\''+pre+'\','+i+')">✕</button></div>';
  }).join(''):'<span class="ct-noimg">Chưa có ảnh — bấm "Thêm ảnh" để tải lên</span>';
}
function ctImgDel_(pre,i){
  var el=document.getElementById(pre+'HinhAnh'); if(!el) return;
  var arr=String(el.value||'').split('\n').map(function(x){return x.trim();}).filter(Boolean);
  arr.splice(i,1); el.value=arr.join('\n'); ctImgRender_(pre);
}
function ctPickImg_(pre){
  var inp=document.createElement('input'); inp.type='file'; inp.accept='image/*'; inp.multiple=true;
  inp.onchange=async function(){
    var fs=Array.prototype.slice.call(inp.files||[]); if(!fs.length) return;
    var el=document.getElementById(pre+'HinhAnh'); if(!el) return;
    toast('Đang tải '+fs.length+' ảnh…');
    for(var i=0;i<fs.length;i++){
      try{
        var d=await downscaleImage_(fs[i],1600,0.82);
        if(!d||d==='__DECODE_FAIL__'){ toast('Không đọc được ảnh '+fs[i].name); continue; }
        var tok=await uploadImg_(d, fs[i].name||'cong-tac.jpg');
        el.value=(el.value?el.value+'\n':'')+tok; ctImgRender_(pre);
      }catch(e){ toast('Lỗi tải ảnh: '+e.message); }
    }
    toast('Đã tải xong ảnh');
  };
  inp.click();
}
function ctFormRead_(pre){
  function v(id){ var e=document.getElementById(pre+id); return e?String(e.value||'').trim():''; }
  function num(id){ var t=v(id); return t===''?'':ptN(t); }
  ctGrpRead_(pre);
  var anh=v('HinhAnh');
  // Trang Nhập dữ liệu: ảnh lấy từ khối Ảnh dùng chung (bỏ ảnh xem trước chưa tải xong)
  if(pre==='imp' && document.getElementById('upMain'))
    anh=[S._imgMain].concat(S._imgList||[]).filter(function(x){ return x && String(x).indexOf('data:')!==0; }).join('\n');
  var loai=v('Loai'), goc=v('LoaiGoc');
  if(goc && ptLoaiGop_(goc)===loai) loai=goc;                  // vẫn là Khái toán -> giữ giá trị gốc (vd kt_sobo của báo giá mẫu)
  return {loai:loai, mode:v('Mode')||'item', maNhom:v('MaNhom'), hangMuc:v('HangMuc'), ten:v('Ten'),
    ncc:v('Ncc'), dvt:v('Dvt'), kl:num('Kl'), dt:num('Dt'), hs:num('Hs'),
    dgnt:ptMoneyN_(v('Dgnt')), dg:ptMoneyN_(v('Dg')),
    gc:v('Gc'), thongSo:v('ThongSo'), phamVi:v('PhamVi'), linkTaiLieu:v('LinkTaiLieu'), hinhAnh:anh};
}
function ctEditModal_(id){
  var c=(S.congTac||[]).filter(function(x){ return x.id===id; })[0]; if(!c) return;
  spClose();
  var ov=document.createElement('div'); ov.className='sp-modal-ov'; ov.id='spModalOv';
  ov.onclick=function(e){ if(e.target===ov) spClose(); };
  ov.innerHTML='<div class="sp-modal sp-modal-wide pd ctmodal"><div class="pd-head"><h3>Cập nhật công tác</h3>'
      +'<span class="spduyet'+(c.daDuyet?' on':'')+'">'+(c.daDuyet?'Đã duyệt':'Chưa duyệt')+'</span>'
      +'<button class="pd-x" onclick="spClose()">✕</button></div>'
    +'<div class="spe-2col ct-2col"><div class="spe-body">'+ctFormHtml_(c,'ctm')
      +'<div class="pd-actions">'
        +'<button class="btn ghost sm" onclick="spClose()">Đóng</button>'
        +(spCanDuyet_()?'<button class="btn ghost sm" onclick="ctDuyet_(\''+c.id+'\','+(c.daDuyet?0:1)+');spClose()">'+icon('check',14)+' '+(c.daDuyet?'Bỏ duyệt':'Duyệt')+'</button>':'')
        +'<button class="btn blue" onclick="ctSaveModal_(\''+c.id+'\')">'+icon('check',15)+' Lưu thay đổi</button>'
      +'</div></div>'
      +'<aside class="spe-side" id="ctSide">'+ctSideHtml_(c,null)+'</aside></div>'
    +'</div>';
  document.body.appendChild(ov);
  document.addEventListener('keydown',spModalKey_);
  S._ctGrp={}; ctFormInit_('ctm');
  ctLoadHistory_(id);
}
/* Cột phải form công tác: người tạo · người sửa · trạng thái duyệt · lịch sử cập nhật
   (dựng đúng khối của form sản phẩm đèn để 2 hạng mục giống nhau) */
function ctSideHtml_(c,hist){
  var histHtml;
  if(hist==null) histHtml='<div class="empty" style="padding:14px;font-size:12.5px">Đang tải…</div>';
  else if(!hist.length) histHtml='<div class="empty" style="padding:14px;font-size:12.5px">Chưa có lịch sử cập nhật.</div>';
  else histHtml=hist.map(function(h){
    return '<div class="spe-h"><div class="spe-h-top"><b>'+esc(h.field)+'</b>'
        +'<span class="spe-h-by">'+icon('clock',11)+' '+esc(h.by||'?')+' · '+fmtDateTime_(h.at)+'</span></div>'
      +'<div class="spe-h-diff"><span class="old">'+esc(h.old||'—')+'</span><span class="arr">→</span>'
        +'<span class="new">'+esc(h.new||'—')+'</span></div></div>';
  }).join('');
  return '<div class="spe-who">'
      +'<span>'+icon('plus',13)+' Tạo bởi <b>'+esc(c.nguoiTao||'—')+'</b>'+(c.ngayTao?' · '+esc(fmtDate(c.ngayTao)):'')+'</span>'
      +'<span>'+icon('edit',13)+' Sửa cuối bởi <b>'+esc(c.nguoiSua||'—')+'</b>'+(c.ngayCapNhat?' · '+esc(fmtDateTime_(c.ngayCapNhat)):'')+'</span>'
      +(c.daDuyet?'<span class="ok">'+icon('check',13)+' Duyệt bởi <b>'+esc(c.nguoiDuyet||'—')+'</b>'+(c.ngayDuyet?' · '+esc(fmtDateTime_(c.ngayDuyet)):'')+'</span>'
                : '<span class="warn">'+icon('clock',13)+' Chưa duyệt</span>')
    +'</div>'
    +'<div class="spe-hist"><div class="spe-hist-h">'+icon('clock',15)+' Lịch sử cập nhật '
      +'<span class="spe-hist-n">'+(hist?hist.length:'…')+'</span></div>'
    +'<div class="spe-hist-list">'+histHtml+'</div></div>';
}
async function ctLoadHistory_(id){
  var hist=[];
  try{ hist=await api('ctHistory', id)||[]; }catch(e){ hist=[]; }
  var c=(S.congTac||[]).filter(function(x){ return x.id===id; })[0];
  var side=document.getElementById('ctSide');
  if(side&&c) side.innerHTML=ctSideHtml_(c,hist);
}
async function ctSaveModal_(id){
  var d=ctFormRead_('ctm');
  if(!d.ten){ toast('Nhập nội dung công việc'); return; }
  if(!d.hangMuc){ toast('Nhập hạng mục'); return; }
  try{
    var out=await api('ctUpdate', id, d);
    var i=(S.congTac||[]).findIndex(function(x){ return x.id===id; });
    if(i>=0) S.congTac[i]=out;
    ctSyncTemplate_(); spClose();
    if(spPTMode_()) spFilter(); if(S.node==='3.1'){ renderPTLibrary(); }
    toast('Đã lưu công tác');
  }catch(e){ toast('Lỗi lưu: '+e.message); }
}
/* ═══ SỬA GIÁ / THÔNG SỐ CÔNG TÁC NGAY TRÊN BẢNG ═══
   Thư viện công tác nằm trong code (PT_TEMPLATE) nên phần người dùng sửa được lưu riêng
   ở localStorage 'qs_ptovr', khoá theo loại báo giá + hạng mục + tên + ĐVT để không lệch
   khi thư viện thêm/bớt dòng. Giá đã sửa dùng chung cho: thư viện trái, bảng Danh sách
   sản phẩm, panel thông tin và cả lúc thêm công tác vào bảng khái toán.                  */
function ptOvrAll_(){
  if(!S._ptOvr){ try{ S._ptOvr=JSON.parse(localStorage.getItem('qs_ptovr')||'{}')||{}; }catch(e){ S._ptOvr={}; } }
  return S._ptOvr;
}
function ptOvrKey_(sec,a){ return [ptSecLoai_(sec),String(sec.t).split('\n')[0],String(a[0]).split('\n')[0],String(a[1]||'')].join('|'); }
function ptOvrOf_(sec,a){ return ptOvrAll_()[ptOvrKey_(sec,a)]||null; }
function ptOvrSet_(sec,a,f,v){
  var U=ptOvrAll_(), k=ptOvrKey_(sec,a), o=U[k]||{};
  if(v===''||v==null) delete o[f]; else o[f]=v;
  if(Object.keys(o).length) U[k]=o; else delete U[k];
  try{ localStorage.setItem('qs_ptovr',JSON.stringify(U)); }catch(e){ toast('Không lưu được (bộ nhớ trình duyệt đầy)'); }
}
function ptOvrDaSua_(sec,a){ return ctOf_(a)?false:!!ptOvrOf_(sec,a); }
// Giá trị gốc của 1 trường theo kiểu hạng mục
function ptBase_(sec,a,f){
  var c=ctOf_(a);
  if(c){ var v=c[f]; if(f==='dg'&&sec.mode==='area'&&!v) v=Number(sec.up)||0; return (v==null?'':v); }
  if(f==='dvt') return a[1]||'';
  if(sec.mode==='item'){ if(f==='kl') return Number(a[2])||0; if(f==='dg') return Number(a[3])||0; if(f==='gc') return a[4]||''; if(f==='dgnt') return Number(a[5])||0; return ''; }
  if(sec.mode==='area'||sec.mode==='area0'){ if(f==='dt') return Number(a[2])||0; if(f==='hs') return Number(a[3])||0; if(f==='gc') return a[4]||'';
    if(f==='dg') return (sec.mode==='area')?(Number(sec.up)||0):0; return ''; }
  if(f==='gc') return a[2]||'';
  return '';
}
// Giá trị đang dùng (đã áp phần sửa của người dùng)
function ptVal_(sec,a,f){
  if(ctOf_(a)) return ptBase_(sec,a,f);          // dòng CSDL: sửa thẳng vào bản ghi, không cần lớp đè
  var o=ptOvrOf_(sec,a);
  if(o && o[f]!=null && o[f]!=='') return (['kl','dt','hs','dg','dgnt'].indexOf(f)>=0)?(Number(o[f])||0):o[f];
  return ptBase_(sec,a,f);
}
// Trường nào sửa được ở hạng mục này (đơn giá của nhóm 'area' là giá chung -> không sửa lẻ)
function ptCanEditF_(sec,f){
  if(ctSecOf_(sec)){
    if(f==='dvt'||f==='gc') return true;
    if(sec.mode==='item') return ['kl','dt','hs','dg','dgnt'].indexOf(f)>=0;
    if(sec.mode==='area'||sec.mode==='area0') return ['dt','hs','dg'].indexOf(f)>=0;
    return false;
  }
  if(f==='dvt'||f==='gc') return true;
  if(sec.mode==='item') return ['kl','dt','hs','dg','dgnt'].indexOf(f)>=0;
  if(sec.mode==='area'||sec.mode==='area0') return ['dt','hs'].indexOf(f)>=0;
  return false;
}
// Dựng 1 dòng item để thêm vào bảng khái toán — luôn lấy giá ĐANG dùng
function ptMakeItem_(sec,a){
  if(sec.mode==='item') return {n:a[0],dvt:ptVal_(sec,a,'dvt'),kl:ptVal_(sec,a,'kl'),dg:ptVal_(sec,a,'dg'),gc:ptVal_(sec,a,'gc'),dgnt:ptVal_(sec,a,'dgnt')};
  if(sec.mode==='area'||sec.mode==='area0') return {n:a[0],dvt:ptVal_(sec,a,'dvt'),dt:ptVal_(sec,a,'dt'),hs:ptVal_(sec,a,'hs'),gc:ptVal_(sec,a,'gc')};
  return {n:a[0],dvt:ptVal_(sec,a,'dvt'),gc:ptVal_(sec,a,'gc')};
}
// công tác đã có trong bảng của dự án đang mở chưa (so theo tên + đúng hạng mục/loại)
function ptDaCo_(sec,a){
  var ten=String(a[0]);
  var s=(S.phanTho||[]).filter(function(x){ return x.t===sec.t && ptSecLoai_(x)===ptSecLoai_(sec); })[0];
  return !!(s && (s.items||[]).some(function(it){ return String(it.n||'')===ten; }));
}
function ptLibDg_(sec,a){ if(sec.mode==='item') return ptVal_(sec,a,'dg'); if(sec.mode==='area') return Number(sec.up)||0; return 0; }
function renderPTLibrary(){
  var el=document.getElementById('catList'); if(!el) return;
  var loai=ptLoai_(), secs=ptSecsOfLoai_(loai);
  var cc=document.getElementById('catCount');
  if(cc) cc.textContent=secs.reduce(function(s,se){return s+se.items.length;},0)+' công việc';
  var cur=S._ptContractor||'';
  var meta=PT_LOAI.filter(function(x){ return x[0]===loai; })[0]||PT_LOAI[0];
  // Bộ lọc PHÂN LOẠI + Nhà thầu + Báo giá mẫu (theo sơ đồ nghiệp vụ)
  /* Theo sơ đồ nghiệp vụ: ① Hạng mục sản phẩm (loại báo giá) → ② Tên nhà thầu → ③ Dự án mẫu (chỉ Khái toán sơ bộ)
     → kết quả (báo giá theo m2/md/cái · đơn giá trọn gói · báo giá vật tư). */
  var nh=PT_LOAI_NHOM.filter(function(g){ return g[3].some(function(x){ return x[0]===loai; }); })[0]||PT_LOAI_NHOM[0];
  var lx=nh[3].filter(function(x){ return x[0]===loai; })[0]||nh[3][0];
  var buoc=0;
  function msel(lb, val, js, on, sub){ buoc++;
    return '<div class="pt-step"><span class="pt-sn">'+buoc+'</span><div class="pt-sb"><div class="pt-sl">'+esc(lb)+'</div>'
      +'<div class="msel pt-msel'+(on?' active':'')+'" onclick="'+js+'"><span class="mlabel">'+val+'</span>'
      +'<span class="mplus">'+SVG_PLUS+'</span></div>'+(sub?'<div class="pt-shint">'+sub+'</div>':'')+'</div></div>'; }
  var top='<div class="ptlib-top pt-flow">'
    +msel('Hạng mục sản phẩm', '<b>'+esc(nh[2])+'</b> · '+esc(lx[2].replace(/^Khái toán (\S)/,function(m,c){ return c.toUpperCase(); })), 'ptMselPop_(event,\'loai\')', true)
    +msel('Tên nhà thầu', cur?('<b>'+esc(cur)+'</b>'):'Chọn nhà thầu', 'ptMselPop_(event,\'ncc\')', !!cur)
    +(loai==='kt_sobo'?msel('Dự án mẫu','Chọn dự án mẫu → lấy cả bộ đơn giá','ptMselPop_(event,\'mau\')',false):'')
    +'<div class="pt-out">'+icon('check',13)+' '+esc({kt_chitiet:'Ra báo giá theo m2 / md / cái',kt_sobo:'Ra đơn giá theo đơn gói',
        dt_nhancong:'Ra báo giá theo m2 / md / cái',dt_vattu:'Ra báo giá vật tư'}[loai]||'')+'</div>'
    +'</div>';
  if(loai.indexOf('dt_')===0) top+=dtPanel_(loai);           // Dự toán: thêm bảng số liệu đầu vào + khối lượng
  var fw=document.getElementById('ptFilters'); if(fw) fw.innerHTML=top;   // khối lọc nằm ngay dưới ô Đề mục
  if(!secs.length){
    el.innerHTML='<div class="ptlib-empty">'+icon('layers',22)
      +'<b>Chưa có bảng giá cho "'+esc(meta[1])+'"</b>'
      +'<span>Gửi file Excel bảng giá của mục này để nạp vào thư viện, hoặc chọn loại khác ở ô trên.</span></div>';
    return;
  }
  // Dự toán: danh sách dưới đây chỉ để thêm LẺ khi thiếu — đường đi chính là nút "Dùng bộ dự toán này" ở trên
  var dtHint=(loai.indexOf('dt_')===0)
    ? '<p class="ptlib-dthint">Danh sách dưới đây là các công tác <b>trong bộ dự toán</b> — chỉ dùng khi cần thêm lẻ một dòng bị xoá.</p>' : '';
  el.innerHTML=dtHint+'<div class="ptlib">'+secs.map(function(sec){
    var si=PT_TEMPLATE.indexOf(sec);                    // giữ chỉ số THẬT để thêm đúng nhóm
    var col=S._ptLibCol&&S._ptLibCol[si];
    var nDaCo=sec.items.filter(function(a){ return ptDaCo_(sec,a); }).length;
    return '<div class="ptlib-sec"><div class="ptlib-h" onclick="ptLibToggle('+si+')">'
        +'<span class="ptlib-caret">'+(col?'▸':'▾')+'</span><span class="ptlib-htt">'+esc(sec.r)+'. '+esc(String(sec.t).split('\n')[0])+'</span>'
        +'<span class="ptlib-hn'+(nDaCo?' on':'')+'" title="'+(nDaCo?('Đã thêm '+nDaCo+'/'+sec.items.length+' công tác'):(sec.items.length+' công tác'))+'">'
          +(nDaCo?(nDaCo+'/'+sec.items.length):sec.items.length)+'</span>'
        +'<button class="ptlib-secadd" title="Thêm cả nhóm vào bảng" onclick="event.stopPropagation();ptAddToSec_('+si+')">+</button></div>'
      +(col?'':'<div class="ptlib-items">'+sec.items.map(function(a,ii){
        var dg=ptLibDg_(sec,a);
        var dt=S._ptDetail, on=(dt&&dt.si===si&&dt.ii===ii);
        var inf=ptInfo_(String(a[0])), coTL=!!(inf.anh||inf.ts||inf.pv||inf.tl||inf.model);
        var da=ptDaCo_(sec,a);
        var gc=(sec.mode==='none')?(a[2]||''):(a[4]||'');
        var ctr=ctOf_(a);
        return '<div class="ptlib-item'+(on?' on':'')+(da?' da':'')+'" title="Bấm để xem thông tin công tác · kéo để thả vào bảng"'
          +' draggable="true" ondragstart="ptLibDragStart_(event,'+si+','+ii+')" ondragend="ptLibDragEnd_()"'
          +' onclick="ptShowDetail_('+si+','+ii+')">'
          +(ctr?'<button class="ptlib-fav'+(ctr.yeuThich?' on':'')+'" title="'+(ctr.yeuThich?'Bỏ khỏi công tác yêu thích':'Thêm vào công tác yêu thích')+'" onclick="event.stopPropagation();ctFav_(\''+ctr.id+'\','+(ctr.yeuThich?0:1)+')">'+icon('heart',13)+'</button>':'')
          +'<div class="ptlib-nm" title="'+esc(String(a[0]).replace(/\n/g,' ')+(gc?(' — '+gc):''))+'">'+esc(String(a[0]).split('\n')[0])
            +(coTL?'<span class="ptlib-info" title="Đã có ảnh / thông số kỹ thuật">'+icon('doc',11)+'</span>':'')+'</div>'
          +'<div class="ptlib-meta">'
            +'<span class="ptlib-dvt">'+esc(a[1]||'')+'</span>'
            +'<span class="ptlib-dg">'+(dg?(money(dg)+' đ'):'—')+'</span>'
            +(da?'<span class="ptlib-da" title="Công tác này đã có trong bảng">✓ đã thêm</span>':'')
          +'</div>'
          +'<button class="ptlib-add" title="Thêm vào bảng ước tính" onclick="event.stopPropagation();ptAddFromLib('+si+','+ii+')">'+icon('plus',14)+'</button></div>';
      }).join('')+'</div>')+'</div>';
  }).join('')+'</div>';
}
/* Lọc nhanh "★ Yêu thích" ở thư viện Bóc tách — chính là chỗ lấy lại SP hay dùng cho dự án mới */
/* ═══ MỞ COMBO NGAY TRÊN THẺ SP (thư viện Bóc tách) ═══
   Bấm ▸ là bung danh sách thành phần combo ngay dưới thẻ, khỏi phải mở chi tiết.
   Dữ liệu nạp 1 lần rồi giữ lại trong S._catCb để lần sau mở tức thì.            */
function catCbKey_(p){ return String((p&&(p.recordId||p.ma))||''); }
function catCbMo_(p){ return !!(S._catCbOpen && S._catCbOpen[catCbKey_(p)]); }
function catComboHtml_(p, idx){
  var ds=(S._catCb||{})[catCbKey_(p)];
  if(!ds) return '<div class="cc-note">Đang tải sản phẩm đi kèm…</div>';
  if(!ds.length) return '<div class="cc-note">Không có sản phẩm đi kèm.</div>';
  S._catCbIdx=S._catCbIdx||{}; S._catCbIdx[catCbKey_(p)]=ds;
  var pk=esc(catCbKey_(p));
  var rows=ds.map(function(x,k){
    var sl=Number(x.comboSL)||1;
    var phu=[x.thuongHieu, (sl>1?('×'+ptQty(sl)):''), ccSpecTxt_(x)].map(function(t){ return String(t||'').trim(); }).filter(Boolean).join(' · ');
    return ccRow_((idx+1)+'.'+(k+1), x, phu,
      'catChildDetail_(\''+pk+'\','+k+')', 'catAddChild_(\''+pk+'\','+k+')', '');
  }).join('');
  return ccBox_('Sản phẩm đi kèm', ds.length, rows, '');
}
/* Khối sản phẩm con — GỘP THÀNH MỘT KHUNG (combo: xanh · biến thể: cam) */
function ccBox_(ten, n, rows, cls){
  return '<div class="ccbox '+(cls||'')+'">'
    +'<div class="ccbox-h">'+esc(ten)+'<i>'+n+'</i></div>'
    +'<div class="ccbox-b">'+rows+'</div></div>';
}
function ccSpecTxt_(x){
  return [x.congSuat,x.nhietDo,x.cri?('CRI '+x.cri):'',x.gocChieu].map(function(v){ return String(v==null?'':v).trim(); })
    .filter(Boolean).join(' · ');
}
function ccRow_(stt, x, phu, moJs, themJs, dragAttr){
  var img=x.hinhAnh
    ? '<img class="ccr-th" src="'+esc(imgSrc1_(x.hinhAnh))+'" onerror="this.style.visibility=\'hidden\'">'
    : '<span class="ccr-th"></span>';
  return '<div class="ccrow"'+(dragAttr||'')+' title="'+esc(String(x.ten||'')+(phu?' — '+phu:''))+'" onclick="'+moJs+'">'
    +'<span class="ccr-no">'+esc(stt)+'</span>'+img
    +'<span class="ccr-m">'
      +'<b>'+esc(x.ten||'')+'</b>'
      +'<span class="ccr-r">'+(phu?'<i>'+esc(phu)+'</i>':'<i></i>')
        +'<em class="ccr-gia">'+money(x.donGiaBan)+' đ</em></span>'
    +'</span>'
    +'<button class="ccr-add" title="Thêm vào bóc tách" onclick="event.stopPropagation();'+themJs+'">+</button>'
  +'</div>';
}
// Thêm 1 thành phần combo vào bóc tách, đúng số lượng đi kèm
async function catAddChild_(pk, k){
  var ds=(S._catCbIdx||{})[pk]||(S._catCb||{})[pk]||[];
  var x=ds[k]; if(!x) return;
  await addProdObj(x, S.selFloor||'', Number(x.comboSL)||1);
  toast('Đã thêm: '+String(x.ten||'').split('\n')[0]);
}
async function catComboToggle_(i){
  var p=(S._filtered||[])[i]; if(!p) return;
  var k=catCbKey_(p); if(!k) return;
  S._catCbOpen=S._catCbOpen||{}; S._catCb=S._catCb||{};
  var mo=!S._catCbOpen[k];
  if(mo) S._catCbOpen[k]=1; else delete S._catCbOpen[k];
  var sc=document.getElementById('catList'), top=sc?sc.scrollTop:0;      // giữ nguyên chỗ đang xem
  renderCatalog(); if(sc) sc.scrollTop=top;
  if(mo && !S._catCb[k]){
    try{ S._catCb[k]=await api('getCombo',k)||[]; }catch(e){ S._catCb[k]=[]; }
    if(S._catCbOpen[k]){ var s2=document.getElementById('catList'), t2=s2?s2.scrollTop:0; renderCatalog(); if(s2) s2.scrollTop=t2; }
  }
}
function catFavToggle(){ S.fFav=!S.fFav; renderFilters(); renderCatalog(); updateCatUI&&updateCatUI(); }
async function catFav(i,on){
  var p=(S._filtered||[])[i]; if(!p) return;
  var k=spKey_(p); if(!k) return;
  spFavSet_([k],on); renderCatalog();
  try{ spFavChk_(await api('setYeuThich',[k],!!on)); }
  catch(e){ spFavSet_([k],!on); renderCatalog(); toast(e.message); return; }
  toast(on?'Đã thêm vào sản phẩm yêu thích':'Đã bỏ khỏi sản phẩm yêu thích');
}

/* ═══════════ BẢNG KHÁI TOÁN: các thao tác kiểu bảng tính, GIỐNG bảng Bóc tách ═══════════
   Bảng đèn có sẵn: chuột phải ra menu, lọc theo cột, cố định cột, thanh kéo ngang.
   Ở đây dựng đúng bộ đó cho bảng Phần thô / khái toán.                                  */
function ptKeyLabel_(k){ var c=PT_COLS.filter(function(x){return x[0]===k;})[0]; return c?c[1]:k; }
// giá trị 1 ô theo khoá cột (để lọc & sao chép)
function ptCellVal_(sec,it,k){
  switch(k){
    case 'noidung': return String(it.n||'');
    case 'dvt':     return String(it.dvt||'');
    case 'ghichu':  return String(it.gc||'');
    case 'dientich':return it.dt==null?'':String(it.dt);
    case 'heso':    return it.hs==null?'':String(it.hs);
    case 'khoiluong':return it._kl==null?'':String(it._kl);
    case 'dgnt':    return it.dgnt==null?'':String(it.dgnt);
    case 'dg':      return it.dg==null?'':String(it.dg);
    default: return '';
  }
}
/* ---- Lọc theo cột ---- */
function ptOpenFilter(e,key){
  e.stopPropagation(); e.preventDefault(); closePop();
  var vals={}, tong=0;
  (S.phanTho||[]).forEach(function(sec){ ptSecTotals(sec); sec.items.forEach(function(it){
    var v=ptCellVal_(sec,it,key).trim(); tong++; if(v) vals[v]=(vals[v]||0)+1; }); });
  var ds=Object.keys(vals).sort(function(a,b){ return a.localeCompare(b,'vi',{numeric:true}); });
  var cur=(S._ptFilter||{})[key];
  var pop=document.createElement('div'); pop.className='fltpop'; pop.id='qs_pop';
  pop.innerHTML='<div class="fltpop-h">Lọc: '+esc(ptKeyLabel_(key))+'</div>'
    +'<div class="fltpop-b">'
      +'<div class="fpi'+(cur==null?' on':'')+'" onclick="ptSetFilter(\''+key+'\',null)">Tất cả <i>'+tong+'</i></div>'
      +(ds.length?ds.map(function(v){
          return '<div class="fpi'+(cur===v?' on':'')+'" onclick="ptSetFilter(\''+key+'\',\''+esc(v).replace(/'/g,"\\'")+'\')">'
            +esc(v)+' <i>'+vals[v]+'</i></div>'; }).join('')
        :'<div class="fpi dis">Cột này chưa có dữ liệu</div>')
    +'</div>'
    +((S._ptFilter&&Object.keys(S._ptFilter).length)?'<div class="fpa" onclick="ptClearFilter()">✕ Bỏ mọi bộ lọc cột</div>':'');
  document.body.appendChild(pop);
  var r=e.target.getBoundingClientRect();
  pop.style.left=Math.max(8,Math.min(r.left, window.innerWidth-pop.offsetWidth-12))+'px';
  pop.style.top=Math.min(r.bottom+4, window.innerHeight-pop.offsetHeight-12)+'px';
  setTimeout(function(){ document.addEventListener('mousedown',popOutside); },0);
}
function ptSetFilter(key,v){
  S._ptFilter=S._ptFilter||{};
  if(v==null) delete S._ptFilter[key]; else S._ptFilter[key]=v;
  closePop(); renderPhanTho();
}
function ptClearFilter(){ S._ptFilter={}; closePop(); renderPhanTho(); }
function ptRowPass_(sec,it){
  var f=S._ptFilter||{}; var ks=Object.keys(f); if(!ks.length) return true;
  return ks.every(function(k){ return ptCellVal_(sec,it,k).trim()===f[k]; });
}
/* ---- Chuột phải: menu kiểu Excel ---- */
/* ═══ Thao tác Ô / CỘT cho bảng PHẦN THÔ — dùng CHUNG cách làm với bảng Bóc tách ═══
   Trước đây menu chuột phải của Phần thô chỉ có vài mục về DÒNG và BẢNG, trong khi
   bảng Thiết bị đèn có đủ nhóm Ô / Dòng / Cột / Tô màu / Tìm & thay thế -> mỗi bảng
   một kiểu. Các hàm dưới đây bù cho Phần thô đúng những việc đó.                     */
/* --- Chọn dòng: khoá theo vị trí (si|ii), dọn lại sau mỗi lần vẽ vì thêm/xoá dòng làm đổi chỉ số --- */
function ptFreezeRowTo(si,ii){
  var rows=document.querySelectorAll('#ptWrap table.pt tr.pt-row'), n=0;
  for(var i=0;i<rows.length;i++){ n=i+1;
    if(+rows[i].getAttribute('data-si')===si && +rows[i].getAttribute('data-ii')===ii) break; }
  S._ptFrzRows=Math.min(n,12); closePop(); renderPhanTho();
  toast('Đã cố định '+S._ptFrzRows+' hàng đầu — cuộn xuống vẫn thấy');
}
function ptUnfreezeRows(){ S._ptFrzRows=0; closePop(); renderPhanTho(); toast('Đã bỏ cố định hàng'); }
function ptFreezeRows_(){
  var t=document.querySelector('#ptWrap table.pt'); if(!t) return;
  t.querySelectorAll('tr.frzrow').forEach(function(tr){ tr.classList.remove('frzrow');
    tr.querySelectorAll('td').forEach(function(td){ td.style.position=''; td.style.top=''; td.style.zIndex=''; }); });
  var n=Math.min(Number(S._ptFrzRows)||0,12); if(!n) return;
  var head=t.tHead, off=(head?head.offsetHeight:0)||40;
  var rows=t.querySelectorAll('tr.pt-row');
  for(var i=0;i<n && i<rows.length;i++){
    var tr=rows[i]; tr.classList.add('frzrow');
    (function(top){ tr.querySelectorAll('td').forEach(function(td){
      td.style.position='sticky'; td.style.top=top+'px'; td.style.zIndex='3'; }); })(off);
    off+=tr.offsetHeight;
  }
}
function ptRowKey_(si,ii){ return si+'|'+ii; }
function ptSelIds_(){ var o=S._ptSel||{}; return Object.keys(o).filter(function(k){ return o[k]; }); }
function ptSelHas_(si,ii){ return !!(S._ptSel && S._ptSel[ptRowKey_(si,ii)]); }
function ptRowKeysOnScreen_(){
  return Array.prototype.map.call(document.querySelectorAll('#ptWrap tr.pt-row'), function(tr){
    return ptRowKey_(tr.getAttribute('data-si'), tr.getAttribute('data-ii')); });
}
function ptSelClick_(e,si,ii){
  if(e&&e.stopPropagation) e.stopPropagation();
  S._ptSel=S._ptSel||{};
  var k=ptRowKey_(si,ii), ids=ptRowKeysOnScreen_(), i=ids.indexOf(k);
  if(e&&e.shiftKey && S._ptAnchor!=null){                  // Shift = chọn cả vùng từ dòng neo
    var a=ids.indexOf(S._ptAnchor); if(a<0) a=i;
    for(var x=Math.min(a,i);x<=Math.max(a,i);x++) S._ptSel[ids[x]]=1;
  } else {
    if(S._ptSel[k]) delete S._ptSel[k]; else S._ptSel[k]=1;
    S._ptAnchor=k;
  }
  renderPhanTho();
}
function ptSelAllVisible_(){ S._ptSel=S._ptSel||{}; ptRowKeysOnScreen_().forEach(function(k){ S._ptSel[k]=1; }); renderPhanTho(); }
function ptClearSel_(){ S._ptSel={}; S._ptAnchor=null; renderPhanTho(); }
function ptSelPrune_(){                                     // bỏ khoá của dòng không còn trên bảng
  if(!S._ptSel) return; var con={}; ptRowKeysOnScreen_().forEach(function(k){ con[k]=1; });
  Object.keys(S._ptSel).forEach(function(k){ if(!con[k]) delete S._ptSel[k]; });
}
function ptSelDel_(){
  var ids=ptSelIds_(); if(!ids.length) return;
  if(!confirm('Xoá '+ids.length+' dòng đã chọn?')) return;
  // xoá từ dưới lên để chỉ số không trượt
  ids.map(function(k){ var a=k.split('|'); return [+a[0],+a[1]]; })
     .sort(function(x,y){ return (y[0]-x[0])||(y[1]-x[1]); })
     .forEach(function(x){ var sec=(S.phanTho||[])[x[0]]; if(sec&&sec.items) sec.items.splice(x[1],1); });
  S._ptSel={}; S._ptAnchor=null; ptPersist(); renderPhanTho(); toast('Đã xoá '+ids.length+' dòng');
}
function ptSelBar_(){
  var w=document.getElementById('ptBulkWrap');
  if(!w){ w=document.createElement('div'); w.id='ptBulkWrap'; document.body.appendChild(w); }
  var ids=ptSelIds_(), n=ids.length;
  var hien=n && bocVisible_() && (document.getElementById('ptWrap')||{}).style.display!=='none';
  if(!hien){ w.innerHTML=''; return; }
  var tien=0;
  ids.forEach(function(k){ var a=k.split('|'), sec=(S.phanTho||[])[+a[0]];
    var it=sec&&sec.items&&sec.items[+a[1]]; if(it) tien+=ptN(it._tt); });
  w.innerHTML='<div class="bbar" id="ptBulkBar">'
    +'<div class="bb-count"><b>'+n+'</b><span>dòng đã chọn · '+money(tien)+' đ</span>'
      +'<button class="bb-x" title="Bỏ chọn" onclick="ptClearSel_()">✕</button></div>'
    +'<div class="bb-sep"></div>'
    +'<button class="bb-b" onclick="ptSelAllVisible_()" title="Chọn tất cả dòng đang hiện">'+icon('list',15)+' Chọn tất cả</button>'
    +'<button class="bb-b" onclick="ptSelDel_()" title="Xoá các dòng đã chọn">'+icon('trash',15)+' Xoá dòng</button>'
  +'</div>';
}
var PT_CELL_F={ noidung:'n', dvt:'dvt', dientich:'dt', heso:'hs', khoiluong:'kl',
                dgnt:'dgnt', margin:'lnPct', dg:'dg', ghichu:'gc' };
var PT_NUM_K={ dientich:1, heso:1, khoiluong:1, dgnt:1, ttnt:1, lnvnd:1, dg:1, tt:1, margin:1, markup:1 };
// Ô vừa bấm chuột phải: dòng nào, cột nào, đang mang giá trị gì
function ptCtxCell_(e){
  var td=e.target.closest('td'), tr=e.target.closest('tr.pt-row');
  if(!td||!tr) return null;
  var vis=ptVisCols_(), idx=Array.prototype.indexOf.call(tr.children, td);
  var col=vis[idx]; if(!col) return null;                 // cột nút thao tác ở cuối bảng
  var inp=td.querySelector('input,textarea');
  return { si:+tr.getAttribute('data-si'), ii:+tr.getAttribute('data-ii'), key:col[0],
           lbl:col[1], text: inp?String(inp.value||''):String(td.textContent||'').trim() };
}
function ptCellEditable_(si,key){
  var f=PT_CELL_F[key]; if(!f) return false;
  var sec=(S.phanTho||[])[si]; if(!sec) return false;
  if(key==='khoiluong'){ var it=sec.items&&sec.items[0]; }
  return true;
}
function ptCopyCell_(){ var c=S._ptCtxCell; closePop(); if(!c) return;
  ctxCopy_(String(c.text||'')); toast('Đã sao chép: '+String(c.text||'').slice(0,40)); }
function ptCopyRow_(){ var c=S._ptCtxCell; closePop(); if(!c) return;
  var tr=document.querySelector('#ptWrap tr.pt-row[data-si="'+c.si+'"][data-ii="'+c.ii+'"]'); if(!tr) return;
  var n=ptVisCols_().length, vals=[];
  Array.prototype.slice.call(tr.children,0,n).forEach(function(td){
    var i=td.querySelector('input,textarea'); vals.push(i?String(i.value||''):String(td.textContent||'').trim()); });
  ctxCopy_(vals.join('\t')); toast('Đã sao chép cả dòng — dán được thẳng vào Excel'); }
async function ptPasteCell_(){ var c=S._ptCtxCell; closePop(); if(!c) return;
  var f=PT_CELL_F[c.key];
  if(!f){ toast('Cột "'+c.lbl+'" là cột tự tính — không dán vào được'); return; }
  var txt='';
  try{ txt=await navigator.clipboard.readText(); }
  catch(e){ toast('Trình duyệt chặn đọc clipboard — bấm vào ô rồi nhấn Ctrl+V'); return; }
  if(!txt) return;
  ptEdit(c.si, c.ii, f, String(txt).split('\t')[0].split('\n')[0].trim()); toast('Đã dán vào ô'); }
function ptClearCell_(){ var c=S._ptCtxCell; closePop(); if(!c) return;
  var f=PT_CELL_F[c.key];
  if(!f){ toast('Cột "'+c.lbl+'" là cột tự tính — không có nội dung để xoá'); return; }
  ptEdit(c.si, c.ii, f, ''); toast('Đã xoá nội dung ô'); }
// Điền giá trị ô này xuống cả cột (mọi dòng của mọi hạng mục trong bảng)
function ptFillDown_(){ var c=S._ptCtxCell; closePop(); if(!c) return;
  var f=PT_CELL_F[c.key];
  if(!f){ toast('Cột "'+c.lbl+'" là cột tự tính — không điền xuống được'); return; }
  var dich=[];
  (S.phanTho||[]).forEach(function(sec,si){ (sec.items||[]).forEach(function(it,ii){
    if(si===c.si && ii===c.ii) return; dich.push([si,ii]); }); });
  if(!dich.length){ toast('Bảng chưa có dòng nào khác'); return; }
  if(!confirm('Điền "'+String(c.text||'').slice(0,30)+'" cho '+dich.length+' dòng còn lại trong cột "'+c.lbl+'"?')) return;
  dich.forEach(function(x){ ptEdit(x[0], x[1], f, c.text); });
  toast('Đã điền xuống '+dich.length+' dòng'); }
function ptSumCol_(k){ closePop();
  var tong=0, n=0;
  (S.phanTho||[]).forEach(function(sec){ (sec.items||[]).forEach(function(it){
    var v;
    if(k==='ttnt') v=it._ttnt; else if(k==='tt') v=it._tt;
    else if(k==='lnvnd') v=(ptN(it._tt)-ptN(it._ttnt));
    else v=ptCellVal_(sec,it,k);
    v=ptN(v); if(v){ tong+=v; n++; } }); });
  toast('Tổng cột "'+ptKeyLabel_(k)+'" ('+n+' dòng có số): '+money(tong)); }
/* ---- Tô màu điều kiện cho Phần thô (cùng 3 luật với bảng Bóc tách) ---- */
function ptCfRules_(){ S.ptCf=S.ptCf||{}; return S.ptCf; }
function ptCfToggle_(rule){ var r=ptCfRules_(); if(r[rule]) delete r[rule]; else r[rule]=1;
  try{ localStorage.setItem('qs_ptcf', JSON.stringify(r)); }catch(e){}
  closePop(); renderPhanTho(); }
function ptCfClass_(sec,it){
  var r=S.ptCf||{}, c='';
  if(sec.mode!=='item') return '';
  var tt=ptN(it._tt), ttnt=ptN(it._ttnt), dg=ptN(it.dg), kl=ptN(it._kl);
  if(r.ln0 && (tt-ttnt)<0) c+=' cf-red';
  if(r.noPrice && !dg) c+=' cf-yellow';
  if(r.kl0 && !kl) c+=' cf-grey';
  return c; }
function ptCtx(e){
  var th=e.target.closest('th.thk'); var tr=e.target.closest('tr.pt-row');
  var trs=tr?null:e.target.closest('tr.pt-sec,tr.pt-add');
  var cell=tr?ptCtxCell_(e):null; S._ptCtxCell=cell;
  var key = th ? th.getAttribute('data-k') : (cell?cell.key:'');
  e.preventDefault(); closePop();
  var si=tr?+tr.getAttribute('data-si'):-1, ii=tr?+tr.getAttribute('data-ii'):-1;
  var ssi=trs?+trs.getAttribute('data-si'):-1;
  var pop=document.createElement('div'); pop.className='fltpop ctxmenu'; pop.id='qs_pop';
  function mi(ic,label,fn,hint,cls){
    return '<div class="cmi '+(cls||'')+'" onclick="'+fn+'">'+icon(ic,14)+'<span>'+label+'</span>'
      +(hint?'<i class="cmi-k">'+hint+'</i>':'')+'</div>'; }
  function sec(t){ return '<div class="cmh">'+esc(t)+'</div>'; }
  var html='';
  if(cell){
    html+=sec('Ô đang chọn')
      +mi('copy','Sao chép ô','ptCopyCell_()','Ctrl+C')
      +mi('copy','Sao chép cả dòng','ptCopyRow_()')
      +mi('edit','Dán vào ô','ptPasteCell_()','Ctrl+V')
      +mi('trash','Xoá nội dung ô','ptClearCell_()','Del')
      +'<div class="cmsep"></div>';
  }
  if(tr && si>=0 && ii>=0){
    html+=sec('Dòng')
      +mi('check','Chọn dòng này','closePop();ptSelClick_(null,'+si+','+ii+')')
      +mi('list','Chọn tất cả dòng đang hiện','closePop();ptSelAllVisible_()')
      +mi('copy','Nhân bản dòng','closePop();ptDupItem('+si+','+ii+')')
      +mi('plus','Chèn dòng trống bên dưới','closePop();ptInsertItem('+si+','+ii+')')
      +mi('trash','Xoá dòng này','closePop();ptDelItem('+si+','+ii+')','','danger')
      +'<div class="cmsep"></div>';
  }
  if(trs && ssi>=0){
    html+=sec('Hạng mục: '+esc(String((S.phanTho[ssi]||{}).t||'').split('\n')[0]))
      +mi('edit','Đổi tên hạng mục','closePop();ptRenameSec('+ssi+')')
      +mi('plus','Thêm dòng vào hạng mục','closePop();ptAddItem('+ssi+')')
      +mi('trash','Xoá cả hạng mục','closePop();ptDelSection('+ssi+')','','danger')
      +'<div class="cmsep"></div>';
  }
  if(key){
    html+=sec('Cột: '+esc(ptKeyLabel_(key)))
      +mi('up','Sắp xếp tăng dần','closePop();ptSortSet_(\''+key+'\',\'asc\')')
      +mi('down','Sắp xếp giảm dần','closePop();ptSortSet_(\''+key+'\',\'desc\')')
      +(S._ptSort?mi('close','Bỏ sắp xếp','closePop();ptSortSet_(\'\')'):'')
      +((cell&&PT_CELL_F[key])?mi('down','Điền giá trị ô này xuống cả cột','ptFillDown_()'):'')
      +(PT_NUM_K[key]?mi('gauge','Tính tổng cột','ptSumCol_(\''+key+'\')'):'')
      +mi('lock','Cố định đến cột này','closePop();ptFreezeTo(\''+key+'\')')
      +((S._ptFreeze||0)>0?mi('close','Bỏ cố định cột','closePop();ptUnfreeze()'):'')
      +(tr?mi('lock','Cố định đến hàng này','ptFreezeRowTo('+si+','+ii+')'):'')
      +((S._ptFrzRows||0)>0?mi('close','Bỏ cố định hàng','ptUnfreezeRows()'):'')
      +mi('eye','Ẩn cột này','closePop();ptColToggle(\''+key+'\')')
      +mi('list','Hiện lại tất cả cột','closePop();ptShowAllCols_()')
      +'<div class="cmsep"></div>';
  }
  var cf=S.ptCf||{};
  html+=sec('Tô màu điều kiện')
    +'<div class="cmi cmck'+(cf.ln0?' on':'')+'" onclick="ptCfToggle_(\'ln0\')"><span class="bx">'+(cf.ln0?'✓':'')+'</span><span class="cfdot cf-red"></span><span>Lợi nhuận &lt; 0</span></div>'
    +'<div class="cmi cmck'+(cf.noPrice?' on':'')+'" onclick="ptCfToggle_(\'noPrice\')"><span class="bx">'+(cf.noPrice?'✓':'')+'</span><span class="cfdot cf-yellow"></span><span>Chưa có đơn giá</span></div>'
    +'<div class="cmi cmck'+(cf.kl0?' on':'')+'" onclick="ptCfToggle_(\'kl0\')"><span class="bx">'+(cf.kl0?'✓':'')+'</span><span class="cfdot cf-grey"></span><span>Khối lượng = 0</span></div>'
    +'<div class="cmsep"></div>'
    +sec('Bảng')
    +mi('search','Tìm & thay thế','closePop();openFindReplace()','Ctrl+F')
    +mi('download','Xuất bảng ra Excel','closePop();ptExportXlsx(false)')
    +mi('plus','Thêm hạng mục','closePop();ptAddSection()')
    +((S._ptFilter&&Object.keys(S._ptFilter).length)?mi('close','Bỏ mọi bộ lọc cột','ptClearFilter()'):'')
    +mi('trash','Xoá hết bảng','closePop();ptReset()','','danger');
  pop.innerHTML=html; document.body.appendChild(pop);
  var L=Math.min(e.clientX, window.innerWidth-pop.offsetWidth-12), T=Math.min(e.clientY, window.innerHeight-pop.offsetHeight-12);
  pop.style.left=Math.max(8,L)+'px'; pop.style.top=Math.max(8,T)+'px';
  setTimeout(function(){ document.addEventListener('mousedown',popOutside); },0);
}
function ptColPop_(e){
  if(e&&e.stopPropagation) e.stopPropagation();
  var old=document.getElementById('ptColPop');
  if(old){ old.remove(); document.removeEventListener('mousedown',ptColOutside_); return; }
  var pop=document.createElement('div'); pop.className='fltpop colpop'; pop.id='ptColPop';
  document.body.appendChild(pop); ptColPopRender_();
  var btn=document.getElementById('ptColBtn');
  if(btn){ var r=btn.getBoundingClientRect(), w=pop.offsetWidth||300;
    pop.style.top=(r.bottom+6)+'px'; pop.style.left=Math.max(8,Math.min(r.left, window.innerWidth-w-10))+'px'; }
  setTimeout(function(){ document.addEventListener('mousedown',ptColOutside_); },0);
}
function ptColOutside_(e){
  if(e.target.closest('#ptColPop')||e.target.closest('#ptColBtn')) return;
  var p=document.getElementById('ptColPop'); if(p) p.remove();
  document.removeEventListener('mousedown',ptColOutside_);
}
function ptColPopRender_(){
  var pop=document.getElementById('ptColPop'); if(!pop) return;
  var on=PT_COLS.filter(function(c){ return S._ptCols[c[0]]; }).length;
  pop.innerHTML='<div class="colpop-h"><b>Cột hiển thị</b><span class="colpop-n">'+on+'/'+PT_COLS.length+'</span>'
      +'<button class="colpop-x" onclick="ptColPop_()">✕</button></div>'
    +'<div class="colpop-b">'+PT_COLS.map(function(c){
        var lock=c[0]==='noidung';
        return '<label class="colpop-i'+(lock?' lock':'')+'"><input type="checkbox" '+(S._ptCols[c[0]]?'checked':'')
          +(lock?' disabled':'')+' onchange="ptColToggle(\''+c[0]+'\')"><span>'+esc(c[1])+'</span>'
          +(lock?'<i>luôn hiện</i>':'')+'</label>';
      }).join('')+'</div>'
    +'<div class="colpop-f"><button class="btn ghost xs" onclick="ptShowAllCols_()">Hiện tất cả</button></div>';
}
function ptSortSet_(k,dir){ S._ptSort=k||''; S._ptSortDir=dir||'asc'; renderPhanTho(); }
function ptShowAllCols_(){ S._ptCols={}; PT_COLS.forEach(function(c){ S._ptCols[c[0]]=true; }); renderPhanTho(); }
function ptHBarSync_(){ hbarSync_('#ptWrap .pt-scroll','ptHBar','ptHThumb'); }
function ptHBarInit_(){ hbarBind_('#ptWrap .pt-scroll','ptHBar','ptHThumb'); }
/* Ô chọn ở panel trái Phần thô: loại báo giá (nhóm Khái toán / Dự toán) · nhà thầu · dự án mẫu */
function ptMselPop_(e, kind){
  if(e&&e.stopPropagation) e.stopPropagation();
  var old=document.getElementById('qs_pop'); if(old){ var k0=old.getAttribute('data-k'); closePop(); if(k0===kind) return; }
  var lo=ptLoai_(), cur=S._ptContractor||'', html='';
  function it(on, js, nm, cn, sub){ return '<div class="bgt-i lvl2'+(on?' on':'')+'" onclick="'+js+'"><span class="nm">'+nm+(sub?'<i class="pt-isub">'+esc(sub)+'</i>':'')+'</span>'
    +'<span class="cn">'+(cn||'')+'</span><span class="rd'+(on?' on':'')+'"></span></div>'; }
  if(kind==='loai'){
    html='<div class="bgt-h"><b>Hạng mục sản phẩm</b></div><div class="bgt-b">'+PT_LOAI_NHOM.map(function(g){
      return '<div class="bgt-i lvl1 pt-ig"><span class="nm">'+esc(g[1]+'. '+g[2])+'</span></div>'+g[3].map(function(x){
        var n=ptLoaiCount_(x[0]);
        return it(lo===x[0],'closePop();ptSetLoai(\''+x[0]+'\');renderTable()',esc(x[1]+' '+x[2]),n?(n+' công tác'):'chưa có',x[3]); }).join('');
    }).join('')+'</div>';
  } else if(kind==='ncc'){
    html='<div class="bgt-h"><b>Tên nhà thầu</b></div><div class="bgt-b">'
      +it(!cur,'closePop();ptSetContractor(\'\');renderPTLibrary()','Tất cả nhà thầu','','')
      +PT_CONTRACTORS.map(function(c){ return it(cur===c,'closePop();ptSetContractor(\''+esc(c)+'\');renderPTLibrary()',esc(c),'',''); }).join('')+'</div>';
  } else {
    html='<div class="bgt-h"><b>Dự án mẫu</b></div><div class="bgt-b">'+PT_MAU.map(function(m){
      return it(false,'closePop();ptApplyMau(\''+esc(m.id)+'\')',esc(m.ten),'',m.mo||''); }).join('')
      +'<p class="ptlib-hint" style="padding:6px 12px">Chọn 1 mẫu để đưa cả bộ hạng mục vào bảng → ra đơn giá trọn gói; sửa diện tích · hệ số · đơn giá theo dự án đang làm.</p></div>';
  }
  var pop=document.createElement('div'); pop.className='fltpop bgtree'; pop.id='qs_pop'; pop.setAttribute('data-k',kind); pop.innerHTML=html;
  document.body.appendChild(pop);
  var b=e&&e.currentTarget; if(b&&b.getBoundingClientRect){ var r=b.getBoundingClientRect();
    pop.style.top=(r.bottom+6)+'px'; pop.style.left=Math.max(8,r.left)+'px'; pop.style.minWidth=Math.max(260,r.width)+'px'; }
  setTimeout(function(){ document.addEventListener('mousedown',popOutside); },0);
}
function ptSetContractor(v){ S._ptContractor=v||''; toast(v?('Đơn giá theo nhà thầu: '+v):'Bỏ chọn nhà thầu'); }
function ptLibToggle(si){ S._ptLibCol=S._ptLibCol||{}; S._ptLibCol[si]=!S._ptLibCol[si]; renderPTLibrary(); }
// nút + ĐỎ ở section = CHỌN TẤT CẢ: thêm toàn bộ công tác của nhóm vào bảng ước tính
// Hạng mục trong bảng được nhận diện theo TÊN + LOẠI báo giá: "CÔNG TÁC CHUẨN BỊ" của
// khái toán chi tiết và của khái toán sơ bộ là 2 hạng mục khác nhau, không được gộp chung.
function ptSecLoai_(x){ return (x&&x.loai)||'kt_chitiet'; }
function ptFindSec_(tsec){
  return (S.phanTho||[]).filter(function(s){ return s.t===tsec.t && ptSecLoai_(s)===ptSecLoai_(tsec); })[0];
}
function ptNewSec_(tsec){
  return {t:tsec.t,mode:tsec.mode,loai:ptSecLoai_(tsec),note:tsec.note||'',up:tsec.up||0,items:[]};
}
function ptAddToSec_(si,quiet){
  var tsec=PT_TEMPLATE[si]; if(!tsec) return;
  if(!S.cur){ toast('Chọn dự án trước khi thêm công tác vào bảng'); return; }
  ptEnsure();
  var sec=ptFindSec_(tsec);
  if(!sec){ sec=ptNewSec_(tsec); S.phanTho.push(sec); }
  var added=0;
  tsec.items.forEach(function(a){
    var ten=String(a[0]);
    if(sec.items.some(function(x){ return String(x.n||'')===ten; })) return;   // bỏ qua dòng đã có
    sec.items.push(ptMakeItem_(tsec,a)); added++;
  });
  if(quiet) return;                                  // gọi từ dtApply: gộp 1 lần vẽ + 1 toast cho cả bộ
  ptPersist(); renderPhanTho();
  toast(added?('Đã thêm '+added+' công tác của "'+String(tsec.t).split('\n')[0]+'"'):'Nhóm này đã có đủ trong bảng');
}
// Lấy nguyên 1 bộ báo giá mẫu (khái toán sơ bộ) vào bảng
function ptApplyMau(id){
  if(!id) return;
  var m=PT_MAU.filter(function(x){ return x.id===id; })[0]; if(!m) return;
  var secs=PT_TEMPLATE.filter(function(s){ return (s.loai||'')==='kt_sobo'; });
  if((S.phanTho||[]).length && !confirm('Đưa bộ "'+m.ten+'" vào bảng?\nCác hạng mục đang có vẫn giữ nguyên, hạng mục trùng tên sẽ được bổ sung dòng còn thiếu.')) return;
  ptEnsure();
  secs.forEach(function(sc){ ptAddToSec_(PT_TEMPLATE.indexOf(sc), true); });
  ptPersist(); renderPhanTho(); renderPTLibrary();
  var n=(S.phanTho||[]).reduce(function(a,x){ return a+((x.items||[]).length); },0);
  toast('Đã lấy bộ báo giá mẫu — bảng đang có '+n+' dòng');
}
function ptAddFromLib(si,ii,quiet,dich){
  var tsec=PT_TEMPLATE[si]; if(!tsec) return; var a=tsec.items[ii]; if(!a) return;
  if(!S.cur){ toast('Chọn dự án trước khi thêm công tác vào bảng'); return; }
  ptEnsure();
  var item=ptMakeItem_(tsec,a), sec, at, lechKieu=false;
  // Chỉ chèn vào hạng mục đích khi CÙNG KIỂU nhập (item / area): dòng dựng theo kiểu
  // của mẫu, thả vào hạng mục chạy kiểu khác thì các ô không khớp cột -> khối lượng,
  // thành tiền đều rỗng. Khác kiểu -> về đúng hạng mục theo mẫu và báo cho người dùng.
  if(dich && (S.phanTho||[])[dich.si] && String((S.phanTho[dich.si]||{}).mode||'')!==String(tsec.mode||'')){
    lechKieu=true; dich=null;
  }
  if(dich && (S.phanTho||[])[dich.si]){            // kéo thả: chèn vào đúng hạng mục + đúng vị trí
    sec=S.phanTho[dich.si];
    at=Math.max(0, Math.min((sec.items||[]).length, Number(dich.at)||0));
    sec.items.splice(at,0,item);
  } else {                                          // bấm ＋ ở thư viện: về đúng hạng mục theo mẫu
    sec=ptFindSec_(tsec);
    if(!sec){ sec=ptNewSec_(tsec); S.phanTho.push(sec); }
    sec.items.push(item); at=sec.items.length-1;
  }
  if(quiet) return;
  S._ptNew={si:S.phanTho.indexOf(sec), ii:at, t:Date.now()};   // cuộn tới + nháy như bảng đèn
  ptPersist(); renderPhanTho(); ptGotoNewRow_();
  toast(lechKieu
    ? ('Đã thêm vào "'+String(sec.t).split('\n')[0]+'" — hạng mục bạn thả vào nhập theo kiểu khác nên không chèn vào đó được')
    : ('Đã thêm: '+String(a[0]).split('\n')[0]));
}
/* Cuộn tới dòng vừa thêm ở bảng Phần thô + nháy nhẹ — dùng chung cách làm với bảng Bóc tách */
var PT_NEW_MS=1350;
function ptGotoNewRow_(){
  var n=S._ptNew; if(!n) return;
  if(Date.now()-(n.t||0)>PT_NEW_MS){ S._ptNew=null; return; }
  var tr=document.querySelector('#ptWrap tr.pt-row[data-si="'+n.si+'"][data-ii="'+n.ii+'"]'); if(!tr) return;
  tr.style.setProperty('--fdl','-'+(Date.now()-n.t)+'ms');
  tr.classList.add('rownew');
  var w=tr.closest('.pt-scroll'); if(!w) return;
  var wr=w.getBoundingClientRect(), rr=tr.getBoundingClientRect();
  var duoi=rr.bottom-(wr.bottom-10), tren=(wr.top+46)-rr.top;
  var d=(duoi>0)?duoi:((tren>0)?-tren:0);
  if(Math.abs(d)<2) return;
  w.scrollTo({top:Math.max(0, Math.min(w.scrollHeight-w.clientHeight, w.scrollTop+d)), behavior:tkSmooth_()});
}
/* ═══ THÔNG TIN CÔNG TÁC (Phần thô) — panel chi tiết giống thiết bị đèn ═══
   Bấm 1 công tác ở thư viện trái -> mở panel giữa: ảnh, thông tin chính, đơn giá,
   thông số kỹ thuật, phạm vi ứng dụng, tài liệu — đúng bố cục panel SP đèn.
   Nguồn dữ liệu:
     PT_INFO   : thông tin dựng sẵn trong code (khoá = tên công tác, chữ thường)
     localStorage 'qs_ptinfo' : phần người dùng tự nhập/sửa ngay trên panel (đè lên PT_INFO)
   Mỗi mục: {anh:'url\nurl', model:'', ts:'Tên: giá trị\n…', pv:'dòng\ndòng', tl:'link tài liệu'} */
var PT_INFO={};
function ptInfoKey_(ten){ return String(ten||'').split('\n')[0].trim().toLowerCase(); }
function ptInfoUser_(){
  if(!S._ptInfoU){ try{ S._ptInfoU=JSON.parse(localStorage.getItem('qs_ptinfo')||'{}')||{}; }catch(e){ S._ptInfoU={}; } }
  return S._ptInfoU;
}
function ptInfo_(ten){
  var k=ptInfoKey_(ten), a=PT_INFO[k]||{}, b=ptInfoUser_()[k]||{}, o={};
  ['anh','model','ts','gc','pv','tl'].forEach(function(f){ o[f]=(b[f]!=null&&b[f]!=='')?b[f]:(a[f]||''); });
  return o;
}
function ptInfoImgs_(inf){
  return String(inf.anh||'').split(/[\n,]/).map(function(s){return s.trim();}).filter(Boolean).map(function(v){ return imgUrlOf(v); });
}
// gallery dùng đúng markup/id của panel SP đèn -> nút ‹ › và dải ảnh nhỏ chạy sẵn
function ptMedia_(imgs){
  S._pdImgs=imgs; S._pdIdx=0;
  var nav = imgs.length>1
    ? '<button class="pd-nav prev" title="Ảnh trước (←)" onclick="event.stopPropagation();pdGoImg_(-1)">'+icon('left',18)+'</button>'
      +'<button class="pd-nav next" title="Ảnh sau (→)" onclick="event.stopPropagation();pdGoImg_(1)">'
      +'<svg class="ico" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18l6-6-6-6"/></svg></button>'
      +'<span class="pd-count" id="pdCount">1/'+imgs.length+'</span>'
    : '';
  var main = imgs[0]
    ? '<img id="pdMainImg" src="'+esc(imgs[0])+'" onclick="imgPop_(this.src)" title="Bấm để xem ảnh lớn" onerror="this.style.visibility=\'hidden\'">'
    : '<span class="pd-noimg">'+icon('image',26)+'<i>Chưa có ảnh</i></span>';
  var dl = imgs[0] ? '<a class="pd-imgdl" href="'+esc(imgs[0])+'" target="_blank" rel="noopener" title="Mở ảnh gốc">'+icon('download',14)+'</a>' : '';
  var thumbs = imgs.length>1
    ? '<div class="pd-thumbs" id="pdThumbs">'+imgs.map(function(v,i){
        return '<button class="pd-thumb'+(i===0?' on':'')+'" title="Ảnh '+(i+1)+'" onclick="pdSetImg_('+i+')"><img src="'+esc(v)+'" onerror="this.style.visibility=\'hidden\'"></button>';
      }).join('')+'</div>' : '';
  return '<div class="pd-gal"><div class="imgbox">'+main+nav+dl+'</div>'+thumbs+'</div>';
}
// Ghi chú viết thành từng khối chữ đọc được (không nhét vào dòng "tên: giá trị")
function ptKV_(k,v){
  if(v==null||v==='') return '';
  var dai=String(v).length>20 || String(k).length>14;
  return '<div class="spec'+(dai?' stack':'')+'"><span class="k">'+esc(k)+'</span><span class="v">'+esc(v)+'</span></div>';
}
function ptNotes_(text){
  var ls=String(text||'').split(/\r?\n/).map(function(x){return x.trim();}).filter(Boolean);
  if(!ls.length) return '';
  return '<div class="pd-notes">'+ls.map(function(l){ return '<div class="pd-note">'+esc(l)+'</div>'; }).join('')+'</div>';
}
function ptBullets_(text){
  var ls=String(text||'').split(/\r?\n/).map(function(x){return x.trim();}).filter(Boolean);
  if(!ls.length) return '';
  return '<ul class="pd-uls">'+ls.map(function(l){ return '<li>'+esc(l)+'</li>'; }).join('')+'</ul>';
}
// Thông số: dòng "Tên: giá trị" -> hàng 2 cột; dòng còn lại -> khối chữ
function ptSpecRows_(text){
  var ls=String(text||'').split(/\r?\n/).map(function(x){return x.trim();}).filter(Boolean);
  var out='', buf=[];
  function flushG(){ if(buf.length){ out+=ptNotes_(buf.join('\n')); buf=[]; } }
  function flush(){ if(buf.length){ out+=ptNotes_(buf.join('\n')); buf=[]; } }
  ls.forEach(function(l){
    var g=l.match(/^##\s*(.*)$/);
    if(g){ flushG(); out+='<div class="pd-grp">'+esc(g[1]||'Thông số kỹ thuật')+'</div>'; return; }
    var m=l.match(/^([^:：]{2,40})[:：]\s*(.+)$/);
    if(m){ flush(); out+=ptKV_(m[1].trim(),m[2].trim()); }
    else buf.push(l);
  });
  flush();
  return out;
}
/* Các mảnh nội dung của 1 công tác — dùng chung:
   panel bên (xếp dọc)  và  popup (2 cột giống popup Thông tin sản phẩm của đèn).  */
function ptDetailParts_(si,ii){
  var sec=PT_TEMPLATE[si], a=sec.items[ii];
  var ten=String(a[0]), dvt=ptVal_(sec,a,'dvt'), gc=ptVal_(sec,a,'gc');
  var dgBan=(sec.mode==='area')?(Number(sec.up)||0):ptVal_(sec,a,'dg'), dgNT=ptVal_(sec,a,'dgnt');
  var ctr=ctOf_(a);
  var inf= ctr ? {anh:ctr.hinhAnh||'', model:'', ts:ctr.thongSo||'', gc:'', pv:ctr.phamVi||'', tl:ctr.linkTaiLieu||''}
               : ptInfo_(ten);
  var imgs=ptInfoImgs_(inf);
  var gcGoc=gc; if(inf.gc) gc=inf.gc;
  var loai=PT_LOAI.filter(function(x){ return x[0]===ptLoaiGop_(sec.loai); })[0]||PT_LOAI[0];
  var ln=dgBan-dgNT, lnPct=dgBan?(ln/dgBan*100):0;
  var P={};
  P.coAnh = imgs.length>0;
  // Không có ảnh thì KHÔNG vẽ khung xám rỗng — chỉ hiện mã + tên
  P.media = (imgs.length?ptMedia_(imgs):'')
    +'<div class="pcode">'+esc(sec.r)+'.'+(ii+1)+' · '+esc(String(sec.t).split('\n')[0])+'</div>'
    +'<div class="pd-name">'+esc(ten)+'</div>';
  // Khối giá nổi bật: đơn giá bán là số to, giá vốn + lợi nhuận là 2 dòng nhỏ bên dưới
  P.hero = '<div class="pt-hero">'
      +'<div class="pt-hero-t">Đơn giá bán</div>'
      +'<div class="pt-hero-v">'+money(dgBan)+'<i>đ'+(dvt?(' / '+esc(dvt)):'')+'</i></div>'
      +((dgNT||ln)?('<div class="pt-hero-r">'
        +(dgNT?'<span><em>Giá nhà thầu</em><b>'+money(dgNT)+' đ</b></span>':'')
        +((dgBan&&dgNT)?'<span><em>Lợi nhuận</em><b class="'+(ln<0?'neg':'ok')+'">'+money(ln)+' đ · '+lnPct.toFixed(1)+'%</b></span>':'')
      +'</div>'):'')
    +'</div>';
  P.chinh = (function(){
      var rows=[['Tên / model', inf.model||''],['Hạng mục', String(sec.t).split('\n')[0]],
        ['Nhà thầu · nhà cung cấp', (ctr&&ctr.ncc)||''],
        ['Đơn vị tính', dvt],['Loại báo giá', loai[1]],['Nhà thầu đang chọn', S._ptContractor||'']]
        .map(function(r){ return ptKV_(r[0],r[1]); }).join('');
      return rows?'<div class="pd-block"><div class="pd-sec">Thông tin chính</div>'+rows+'</div>':'';
    })();
  P.gia = (dgBan||dgNT)
    ? '<div class="pd-block"><div class="pd-sec">Đơn giá <i>(theo bảng giá thư viện)</i></div>'
      +(dgNT?'<div class="spec"><span class="k">Đơn giá nhà thầu</span><span class="v">'+money(dgNT)+' đ/'+esc(dvt)+'</span></div>':'')
      +(dgBan?'<div class="spec hi"><span class="k">Đơn giá bán</span><span class="v">'+money(dgBan)+' đ/'+esc(dvt)+'</span></div>':'')
      +((dgBan&&dgNT)?'<div class="spec"><span class="k">Lợi nhuận</span><span class="v">'+money(ln)+' đ ('+lnPct.toFixed(1)+'%)</span></div>':'')
      +'</div>' : '';
  P.thongSo = inf.ts?'<div class="pd-block"><div class="pd-sec">Thông số kỹ thuật tham khảo</div>'+ptSpecRows_(inf.ts)+'</div>':'';
  P.ghiChu  = gc?'<div class="pd-block"><div class="pd-sec">Ghi chú · điều kiện áp dụng</div>'+ptNotes_(gc)
      +(inf.gc&&gcGoc&&inf.gc!==gcGoc?'<div class="pd-goc">Ghi chú gốc trong bảng giá: '+esc(gcGoc)+'</div>':'')+'</div>':'';
  P.phamVi  = inf.pv?'<div class="pd-block"><div class="pd-sec">Phạm vi ứng dụng</div>'+ptBullets_(inf.pv)+'</div>':'';
  P.thieu   = (function(){
      var t=[]; if(!imgs.length) t.push('ảnh'); if(!inf.ts) t.push('thông số kỹ thuật');
      if(!gc) t.push('ghi chú'); if(!inf.pv) t.push('phạm vi ứng dụng');
      if(t.length<2) return '';
      return '<div class="pt-thieu">Chưa có '+esc(t.join(' · '))+'</div>';
    })();
  P.foot = inf.tl
    ? ('<div class="pd-foot2">'
        +'<a class="pd-fbtn" href="'+esc(inf.tl)+'" target="_blank" rel="noopener">'+icon('doc',14)+' Tài liệu kỹ thuật</a>'
        +'<a class="pd-fbtn" href="'+esc(inf.tl)+'" download target="_blank" rel="noopener">'+icon('download',14)+' Tải về</a>'
      +'</div>')
    : '';
  P.ctr=ctr;
  return P;
}
function ptDetailHtml_(si,ii){
  var sec=PT_TEMPLATE[si], a=sec.items[ii];
  var ten=String(a[0]), dvt=ptVal_(sec,a,'dvt'), gc=ptVal_(sec,a,'gc');
  var dgBan=(sec.mode==='area')?(Number(sec.up)||0):ptVal_(sec,a,'dg'), dgNT=ptVal_(sec,a,'dgnt');
  var ctr=ctOf_(a);
  var inf= ctr ? {anh:ctr.hinhAnh||'', model:'', ts:ctr.thongSo||'', gc:'', pv:ctr.phamVi||'', tl:ctr.linkTaiLieu||''}
               : ptInfo_(ten);
  var imgs=ptInfoImgs_(inf);
  var gcGoc=gc; if(inf.gc) gc=inf.gc;                       // ghi chú người dùng sửa đè lên ghi chú gốc
  var loai=PT_LOAI.filter(function(x){ return x[0]===ptLoaiGop_(sec.loai); })[0]||PT_LOAI[0];
  var ln=dgBan-dgNT, lnPct=dgBan?(ln/dgBan*100):0;
  var html=ptMedia_(imgs)
    +'<div class="pcode">'+esc(sec.r)+'.'+(ii+1)+' · '+esc(String(sec.t).split('\n')[0])+'</div>'
    +'<div class="pd-name">'+esc(ten)+'</div>'
    +(function(){
        var rows=[['Tên / model', inf.model||''],['Hạng mục', String(sec.t).split('\n')[0]],
          ['Nhà thầu · nhà cung cấp', (ctr&&ctr.ncc)||''],
          ['Đơn vị tính', dvt],['Loại báo giá', loai[1]],['Nhà thầu đang chọn', S._ptContractor||'']]
          .map(function(r){ return ptKV_(r[0],r[1]); }).join('');
        return rows?'<div class="pd-block"><div class="pd-sec">Thông tin chính</div>'+rows+'</div>':'';
      })()
    +(dgBan||dgNT
      ? '<div class="pd-block"><div class="pd-sec">Đơn giá <i>(theo bảng giá thư viện)</i></div>'
        +(dgNT?'<div class="spec"><span class="k">Đơn giá nhà thầu</span><span class="v">'+money(dgNT)+' đ/'+esc(dvt)+'</span></div>':'')
        +(dgBan?'<div class="spec hi"><span class="k">Đơn giá bán</span><span class="v">'+money(dgBan)+' đ/'+esc(dvt)+'</span></div>':'')
        +((dgBan&&dgNT)?'<div class="spec"><span class="k">Lợi nhuận</span><span class="v">'+money(ln)+' đ ('+lnPct.toFixed(1)+'%)</span></div>':'')
        +'</div>'
      : '')
    +(inf.ts?'<div class="pd-block"><div class="pd-sec">Thông số kỹ thuật tham khảo</div>'+ptSpecRows_(inf.ts)+'</div>':'')
    +(gc?'<div class="pd-block"><div class="pd-sec">Ghi chú · điều kiện áp dụng</div>'+ptNotes_(gc)
        +(inf.gc&&gcGoc&&inf.gc!==gcGoc?'<div class="pd-goc">Ghi chú gốc trong bảng giá: '+esc(gcGoc)+'</div>':'')+'</div>':'')
    +(inf.pv?'<div class="pd-block"><div class="pd-sec">Phạm vi ứng dụng</div>'+ptBullets_(inf.pv)+'</div>':'')
    +(function(){
        var thieu=[]; if(!imgs.length) thieu.push('ảnh'); if(!inf.ts) thieu.push('thông số kỹ thuật');
        if(!gc) thieu.push('ghi chú'); if(!inf.pv) thieu.push('phạm vi ứng dụng');
        if(thieu.length<2) return '';
        return '<div class="pd-block ptinf-empty">'+icon('doc',18)
          +'<span>Công tác này chưa có <b>'+esc(thieu.join(', '))+'</b>. Bấm <b>Sửa thông tin</b> để bổ sung — nội dung được lưu lại cho những lần sau.</span></div>';
      })()
    +'<div class="pd-price"><span>Đơn giá</span><b>'+money(dgBan)+' đ</b></div>'
    +'<div class="pd-foot2">'
      +(inf.tl?'<a class="pd-fbtn" href="'+esc(inf.tl)+'" target="_blank" rel="noopener">'+icon('doc',14)+' Tài liệu kỹ thuật</a>'
             :'<span class="pd-fbtn dis" title="Chưa có link tài liệu cho công tác này">'+icon('doc',14)+' Tài liệu kỹ thuật</span>')
      +(inf.tl?'<a class="pd-fbtn" href="'+esc(inf.tl)+'" download target="_blank" rel="noopener">'+icon('download',14)+' Tải về</a>':'')
    +'</div>';
  return html;
}
function ptInfoForm_(si,ii){
  var sec=PT_TEMPLATE[si], a=sec.items[ii], inf=ptInfo_(String(a[0]));
  var gcGoc=(sec.mode==='none')?(a[2]||''):(a[4]||'');
  function fld(id,lbl,hint,val,rows,note){
    return '<div class="ptinf-f"><label>'+esc(lbl)+'</label>'
      +'<textarea id="'+id+'" rows="'+(rows||2)+'" placeholder="'+esc(hint)+'">'+esc(val||'')+'</textarea>'
      +(note?'<i class="ptinf-h">'+esc(note)+'</i>':'')+'</div>';
  }
  return '<div class="ptinf-form">'
    +'<div class="pd-sec">Sửa thông tin công tác</div>'
    +fld('ptInfModel','Tên / model','VD: Giàn tải, máy ép cọc Pmax 90T',inf.model,1)
    +fld('ptInfAnh','Ảnh (mỗi dòng 1 link)','https://… (dán link ảnh, mỗi dòng một ảnh)',inf.anh,2)
    +fld('ptInfTs','Thông số kỹ thuật (mỗi dòng "Tên: giá trị")','Lực ép tối đa (Pmax): 90 tấn\nLoại cọc phù hợp: vuông 250×250, tròn ly tâm D300',inf.ts,5)
    +fld('ptInfGc','Ghi chú · điều kiện áp dụng',gcGoc||'VD: Đơn giá cho trên 20m/tim cọc (tùy địa chất khu vực)',inf.gc,3,
         gcGoc?'Để trống = dùng ghi chú gốc trong bảng giá thư viện.':'Công tác này chưa có ghi chú gốc — nhập ở đây để hiện trên panel.')
    +fld('ptInfPv','Phạm vi ứng dụng (mỗi dòng 1 ý)','Nhà phố, biệt thự, công trình tải trung bình\nYêu cầu mặt bằng thi công',inf.pv,3)
    +fld('ptInfTl','Link tài liệu kỹ thuật','https://…',inf.tl,1)
    +'<div class="ptinf-act">'
      +'<button class="btn ghost sm" onclick="ptInfoEdit_('+si+','+ii+',0)">Huỷ</button>'
      +'<button class="btn blue sm" onclick="ptInfoSave_('+si+','+ii+')">'+icon('check',14)+' Lưu thông tin</button>'
    +'</div></div>';
}
function ptInfoEdit_(si,ii,on){ S._ptInfoEdit=!!on; ptShowDetail_(si,ii); }
function ptInfoSave_(si,ii){
  var a=PT_TEMPLATE[si].items[ii], k=ptInfoKey_(String(a[0]));
  function v(id){ var e=document.getElementById(id); return e?String(e.value||'').replace(/\s+$/,''):''; }
  var o={model:v('ptInfModel'),anh:v('ptInfAnh'),ts:v('ptInfTs'),gc:v('ptInfGc'),pv:v('ptInfPv'),tl:v('ptInfTl')};
  var U=ptInfoUser_();
  if(!o.model&&!o.anh&&!o.ts&&!o.gc&&!o.pv&&!o.tl) delete U[k]; else U[k]=o;
  try{ localStorage.setItem('qs_ptinfo',JSON.stringify(U)); }catch(e){ toast('Không lưu được (bộ nhớ trình duyệt đầy)'); }
  S._ptInfoEdit=false; ptShowDetail_(si,ii); toast('Đã lưu thông tin công tác');
}
function ptHideDetail_(){
  S._ptDetail=null; S._ptInfoEdit=false;
  var el=document.getElementById('pdPanel'); if(el){ el.style.display='none'; el.innerHTML=''; el.classList.remove('ptdetail'); }
  var g=document.getElementById('bocGrid'); if(g) g.classList.remove('detail');
  document.removeEventListener('keydown',pdPanelKey_);
  if(S.node==='3.1') renderPTLibrary();
}
function ptShowDetail_(si,ii){
  var sec=PT_TEMPLATE[si]; if(!sec||!sec.items[ii]) return;
  var el=document.getElementById('pdPanel'); if(!el) return;
  S._ptDetail={si:si,ii:ii};
  var g=document.getElementById('bocGrid'); if(g) g.classList.add('detail');
  el.style.display='block'; el.classList.add('ptdetail');
  var P=S._ptInfoEdit?null:ptDetailParts_(si,ii);
  var ctr0=ctOf_(sec.items[ii]);
  el.innerHTML='<div class="pd-head"><h3>Thông tin công tác</h3>'
      +(P?(ctr0?('<span class="spduyet'+(ctr0.daDuyet?' on':'')+'">'+(ctr0.daDuyet?'Đã duyệt':'Chưa duyệt')+'</span>')
                :'<span class="spduyet mau">Thư viện mẫu</span>'):'')
      +'<button class="pd-x" title="Đóng" onclick="ptHideDetail_()">✕</button></div>'
    +(S._ptInfoEdit?ptInfoForm_(si,ii)
       :(P.media+P.hero+P.chinh+P.thongSo+P.ghiChu+P.phamVi+P.thieu+P.foot))
    +(S._ptInfoEdit?''
      :'<div class="pd-actions">'
        +(ctOf_(sec.items[ii])
          ?'<button class="btn ghost sm" onclick="ctEditModal_(\''+ctOf_(sec.items[ii]).id+'\')">'+icon('edit',14)+' Sửa công tác</button>'
          :'<button class="btn ghost sm" onclick="ptInfoEdit_('+si+','+ii+',1)">'+icon('edit',14)+' Sửa thông tin</button>')
        +'<button class="btn blue sm" onclick="'+(S.node==='3.1'?'ptAddFromLib':'ctAddToBoc_')+'('+si+','+ii+')">'+icon('plus',14)+' Thêm vào bảng</button>'
      +'</div>');
  document.addEventListener('keydown',pdPanelKey_);
  el.scrollTop=0;
  if(S.node==='3.1') renderPTLibrary();
}
function ptCloneTemplate(){
  return PT_TEMPLATE.map(function(s){
    var mode=s.mode;
    var items=s.items.map(function(a){
      if(mode==='item') return {n:a[0],dvt:a[1],kl:a[2],dg:a[3],gc:a[4]||'',dgnt:a[5]||0};
      if(mode==='area'||mode==='area0') return {n:a[0],dvt:a[1],dt:a[2],hs:a[3],gc:a[4]||''};
      return {n:a[0],dvt:a[1],gc:a[2]||''};
    });
    return {t:s.t,mode:mode,note:s.note||'',up:s.up||0,items:items};
  });
}
function ptKey(){ return 'pt_'+((S.cur&&S.cur.maDA)||'x'); }
function ptEnsure(){
  var key=ptKey();
  if(S._ptKey===key && S.phanTho) return;
  S._ptKey=key;
  var saved=null; try{ saved=JSON.parse(localStorage.getItem(key)||'null'); }catch(e){}
  // Bắt đầu TRỐNG — user tự chọn hạng mục từ thư viện bên trái (chọn xong tự lưu)
  S.phanTho = Array.isArray(saved) ? saved : [];
  var v=null; try{ v=localStorage.getItem(key+'_vat'); }catch(e){}
  var nv=Number(v);
  S.ptVat = (v!=null&&v!==''&&isFinite(nv))?nv:8;
}
function ptPersist(){ try{ var k=ptKey(); var v=Number(S.ptVat); if(!isFinite(v)) v=8; S.ptVat=v;
  localStorage.setItem(k,JSON.stringify(S.phanTho)); localStorage.setItem(k+'_vat',String(v)); }catch(e){} }
// Dòng 'item' nhập được Diện tích + Hệ số: có diện tích là Khối lượng = DT × HS (khoá ô khối lượng).
// BỎ TRỐNG hệ số thì hiểu là 1 — gõ hẳn số 0 thì vẫn là 0.
function ptHs_(it){ var v=it&&it.hs; return (v===''||v==null)?1:ptN(v); }
function ptAutoKL_(it){ return ptN(it&&it.dt)>0; }
function ptSecTotals(sec){
  var sumKL=0, tt=0, ttnt=0;
  sec.items.forEach(function(it){
    var kl;
    if(sec.mode==='area'||sec.mode==='area0'){ kl=ptR2(ptN(it.dt)*ptHs_(it)); }
    else if(ptAutoKL_(it)){ kl=ptR2(ptN(it.dt)*ptHs_(it)); }    // dòng item: có diện tích -> khối lượng tự tính
    else { kl=ptN(it.kl); }
    it._kl=kl; sumKL+=kl;
    if(sec.mode==='item'){ it._tt=ptR0(kl*ptN(it.dg)); tt+=it._tt; it._ttnt=ptR0(kl*ptN(it.dgnt)); ttnt+=it._ttnt; }
    else { it._tt=null; it._ttnt=null; }
  });
  if(sec.mode==='area'){ tt=ptR0(sumKL*ptN(sec.up)); ttnt=0; }
  else if(sec.mode==='area0'||sec.mode==='none'){ tt=0; ttnt=0; }
  return {sumKL:sumKL,tt:tt,ttnt:ttnt};
}
function ptComputeAll(){
  var sections=[],grand=0,contractor=0;
  S.phanTho.forEach(function(sec){ var s=ptSecTotals(sec); sections.push(s); grand+=s.tt; contractor+=s.ttnt; });
  var profit=grand-contractor;
  var vatPct=ptN(S.ptVat);
  var vat=ptR0(grand*vatPct/100);
  return {sections:sections,grand:grand,contractor:contractor,profit:profit,
    vatPct:vatPct,vat:vat,afterTax:grand+vat,profitPct:grand?(profit/grand*100):0};
}
/* ô nhập */
// Ô tiền hiện có dấu chấm ("10.000.000") cho dễ đọc, gõ kiểu nào cũng nhận;
// các ô số khác (diện tích, hệ số, %) giữ nguyên ô number để còn nhập thập phân.
function ptMoneyN_(v){ if(typeof v==='number') return v; var x=parseInt(String(v==null?'':v).replace(/[^\d-]/g,''),10); return isNaN(x)?0:x; }
function ptInp(si,ii,f,v,cls,goiY){
  cls=cls||'';
  var isMoney=cls.indexOf('pt-money')>=0;
  if(isMoney){
    var t=(v===''||v==null||!Number(v))?'':money(v);
    return '<input class="pt-in '+cls+'" type="text" inputmode="numeric" value="'+esc(t)+'" onchange="ptEdit('+si+','+ii+',\''+f+'\',this.value)">';
  }
  return '<input class="pt-in '+cls+'" type="number" step="any" value="'+(v===''||v==null?'':v)+'"'
    +(goiY?' placeholder="'+esc(goiY)+'" title="Bỏ trống = '+esc(goiY)+'"':'')
    +' onchange="ptEdit('+si+','+ii+',\''+f+'\',this.value)">';
}
function ptTxt(si,ii,f,v){ return '<textarea class="pt-in pt-area" rows="1" oninput="autoGrow(this)" onchange="ptEdit('+si+','+ii+',\''+f+'\',this.value)">'+esc(v||'')+'</textarea>'; }
/* ═══ CÔNG THỨC GIÁ — lấy đúng theo file báo giá (sheet "mai coi công thức ở đây") ═══
   Khối lượng     I = G × H                  (diện tích × hệ số)
   TT nhà thầu    K = I × J                  (khối lượng × đơn giá nhà thầu)
   Đơn giá bán    O = MROUND(J/(1−M), 1000)  (M = %LN trên GIÁ BÁN, làm tròn nghìn)
   TT bán         P = I × O
   Lợi nhuận      L = P − K
   %LN/giá bán    M = L/P      ·   %LN/giá vốn  N = L/K
   Trong app: gõ %LN -> tự ra đơn giá bán; gõ đơn giá bán -> tự ra %LN (2 chiều). */
function ptMround_(v,b){ b=b||1000; return Math.round((Number(v)||0)/b)*b; }
function ptDgTuLn_(dgnt,lnPct){
  dgnt=ptN(dgnt); var m=ptN(lnPct)/100;
  if(!dgnt) return 0;
  if(m>=1) m=0.99;                       // chặn chia cho 0
  return ptMround_(dgnt/(1-m),1000);
}
function ptLnTuDg_(dgnt,dg){ dg=ptN(dg); return dg?((dg-ptN(dgnt))/dg*100):0; }
function ptEdit(si,ii,f,val){
  var sec=S.phanTho[si]; if(!sec) return;
  var numF={dt:1,hs:1,kl:1,dg:1,dgnt:1,up:1,lnPct:1}, moneyF={dg:1,dgnt:1,up:1};
  var v = moneyF[f]?ptMoneyN_(val):(numF[f]?ptN(val):val);
  if(ii<0){ sec[f]=v; }
  else {
    var it=sec.items[ii]; if(!it) return;
    it[f]=v;
    // dòng item có DT+HS -> khối lượng bám theo tích 2 ô (bỏ trống 1 ô là trả lại nhập tay)
    if((f==='dt'||f==='hs') && sec.mode==='item'){ if(ptAutoKL_(it)) it.kl=ptR2(ptN(it.dt)*ptHs_(it)); }
    // giữ 3 đại lượng luôn khớp nhau: giá vốn ↔ %LN ↔ giá bán
    if(f==='lnPct')      it.dg=ptDgTuLn_(it.dgnt,v);
    else if(f==='dg')    it.lnPct=ptR2(ptLnTuDg_(it.dgnt,v));
    else if(f==='dgnt'){ if(ptN(it.lnPct)) it.dg=ptDgTuLn_(v,it.lnPct); else it.lnPct=ptR2(ptLnTuDg_(v,it.dg)); }
  }
  ptPersist(); renderPhanTho();
}
function ptSetVat(val){ var n=ptN(val); S.ptVat=isFinite(n)?n:0; ptPersist(); renderPhanTho(); }
function ptAddItem(si){
  var sec=S.phanTho[si]; if(!sec) return;
  if(sec.mode==='item') sec.items.push({n:'',dvt:'',kl:1,dg:0,gc:'',dgnt:0});
  else if(sec.mode==='area'||sec.mode==='area0') sec.items.push({n:'',dvt:'m2',dt:0,hs:1,gc:''});
  else sec.items.push({n:'',dvt:'gói',gc:''});
  ptPersist(); renderPhanTho();
}
function ptBlankItem_(sec){
  if(sec.mode==='item') return {n:'',dvt:'',kl:1,dg:0,gc:'',dgnt:0};
  if(sec.mode==='area'||sec.mode==='area0') return {n:'',dvt:'m2',dt:0,hs:1,gc:''};
  return {n:'',dvt:'gói',gc:''};
}
// Nhân bản dòng (giữ nguyên mọi giá trị) — đặt ngay dưới dòng gốc
function ptDupItem(si,ii){
  var sec=S.phanTho[si]; if(!sec||!sec.items[ii]) return;
  var ban=JSON.parse(JSON.stringify(sec.items[ii]));
  ['_kl','_tt','_ttnt'].forEach(function(k){ delete ban[k]; });     // bỏ giá trị tính tạm
  sec.items.splice(ii+1,0,ban); ptPersist(); renderPhanTho();
  toast('Đã nhân bản dòng');
}
// Chèn 1 dòng trống ngay dưới dòng đang chọn
function ptInsertItem(si,ii){
  var sec=S.phanTho[si]; if(!sec) return;
  sec.items.splice(ii+1,0,ptBlankItem_(sec)); ptPersist(); renderPhanTho();
}
function ptDelItem(si,ii){ var sec=S.phanTho[si]; if(!sec) return; sec.items.splice(ii,1); ptPersist(); renderPhanTho(); }
function ptAddSection(){ S.phanTho.push({t:'HẠNG MỤC MỚI',mode:'item',note:'',up:0,items:[]}); ptPersist(); renderPhanTho(); }
function ptDelSection(si){ if(!confirm('Xoá cả hạng mục "'+((S.phanTho[si]||{}).t||'')+'" ?')) return; S.phanTho.splice(si,1); ptPersist(); renderPhanTho(); }
// Xoá hết bảng -> chỉ còn tên cột; user tự chọn lại hạng mục từ thư viện bên trái
function ptReset(){
  var n=(S.phanTho||[]).reduce(function(s,x){ return s+((x.items||[]).length); },0);
  if(n && !confirm('Xoá toàn bộ '+n+' dòng trong bảng? Bạn sẽ chọn lại hạng mục từ danh sách bên trái.')) return;
  S.phanTho=[]; ptPersist(); renderPhanTho(); renderCatalog();
  toast('Đã xoá bảng — chọn hạng mục từ danh sách bên trái');
}
/* Khối header giống Excel */
function ptHeaderHtml(){
  var p=S.cur||{};
  return '<div class="pt-doc-h">'
    +'<div class="pt-cty">'
      +'<div class="pt-cty-nm">DEZON DESIGN &amp; BUILD</div>'
      +'<div>ĐT: (08) 36200560 · Email: support@dezon.vn</div>'
      +'<div>Xưởng sản xuất: KCN Vĩnh Lộc, Quận Tân Phú, TPHCM</div>'
      +'<div>Website: dezon.vn</div>'
    +'</div>'
    +'<div class="pt-title"><h2>BẢNG ƯỚC TÍNH CHI PHÍ DỰ ÁN</h2><div class="pt-sub">HẠNG MỤC: XÂY DỰNG THÔ</div></div>'
    +'</div>'
    +'<div class="pt-info">'
      +ptInfo('Khách hàng',p.khachHang)+ptInfo('Hiện trạng','')
      +ptInfo('Tên dự án',p.ten)+ptInfo('Quy mô','')
      +ptInfo('Địa chỉ',p.diaChi)+ptInfo('Nhu cầu','')
      +ptInfo('Điện thoại',p.sdt)+ptInfo('Suất đầu tư dự kiến','')
    +'</div>';
}
function ptInfo(k,v){ return '<div class="pt-inf"><span class="k">'+esc(k)+'</span><span class="v">'+esc(v||'—')+'</span></div>'; }
// Cột bảng Phần thô: [key, nhãn, canh, rộng]
// Nhãn cột viết thường như bảng Bóc tách (trước đây viết hoa cứng nên nhìn khác hẳn)
var PT_COLS=[
  ['stt','STT','c',52],['noidung','Nội dung công việc','l',300],['dvt','ĐVT','c',74],
  ['dientich','Diện tích','n',92],['heso','Hệ số','n',72],['khoiluong','Khối lượng','n',104],
  ['dgnt','Đơn giá (nhà thầu)','n',136],['ttnt','Thành tiền (nhà thầu)','n',148],
  ['lnvnd','Lợi nhuận (VND)','n',124],['margin','Lợi nhuận/giá bán (%)','n',148],
  ['markup','Lợi nhuận/giá vốn (%)','n',148],['dg','Đơn giá','n',134],
  ['tt','Thành tiền','n',140],['ghichu','Ghi chú','l',210]
];
/* Cố định cột trái — bảng khái toán rất rộng (14 cột), cuộn ngang là mất cột
   Nội dung công việc. Dùng lại đúng cách làm của bảng Bóc tách (class frz + biến CSS). */
function ptFreezeTo(k){
  var vis=ptVisCols_(); var i=vis.map(function(c){return c[0];}).indexOf(k);
  S._ptFreeze = i>=0 ? i+1 : 0; renderPhanTho();
}
function ptUnfreeze(){ S._ptFreeze=0; renderPhanTho(); }
function ptColToggle(k){ S._ptCols=S._ptCols||{}; S._ptCols[k]=!S._ptCols[k]; renderPhanTho(); }
// ===== Chức năng bảng (giống Bóc tách): rộng cột · đổi vị trí cột · sắp xếp =====
function ptW_(c){ return (S._ptColW&&S._ptColW[c[0]])||c[3]; }
function ptVisCols_(){
  if(!S._ptOrder) S._ptOrder=PT_COLS.map(function(c){return c[0];});
  var by={}; PT_COLS.forEach(function(c){ by[c[0]]=c; });
  return S._ptOrder.map(function(k){ return by[k]; })
    .filter(function(c){ return c && (!S._ptCols || S._ptCols[c[0]]); });
}
function ptColDragStart(e,k){ if(e.target&&e.target.closest&&e.target.closest('.ptrsz')){ e.preventDefault(); return; }
  S._ptDragK=k; try{ e.dataTransfer.setData('text/plain',k); }catch(x){} }
function ptColDrop(e,k){ e.preventDefault(); var from=S._ptDragK; S._ptDragK=null; if(!from||from===k) return;
  var ord=(S._ptOrder||PT_COLS.map(function(c){return c[0];})).filter(function(x){ return x!==from; });
  var i=ord.indexOf(k); if(i<0) i=ord.length; ord.splice(i,0,from); S._ptOrder=ord; renderPhanTho(); }
// sắp xếp các dòng TRONG TỪNG hạng mục (giữ nguyên cấu trúc nhóm)
function ptToggleSort(k){
  if(S._ptSort!==k){ S._ptSort=k; S._ptSortDir='asc'; }
  else if(S._ptSortDir==='asc'){ S._ptSortDir='desc'; }
  else { S._ptSort=''; S._ptSortDir='asc'; }
  renderPhanTho();
}
var PT_SORTKEY={noidung:'n',dvt:'dvt',dientich:'dt',heso:'hs',khoiluong:'kl',dgnt:'dgnt',dg:'dg',ghichu:'gc'};
// trả [{it, oi}] — oi = index GỐC trong sec.items để sửa ô ghi đúng dòng dù đang sắp xếp
function ptSortItems_(items){
  var arr=items.map(function(it,i){ return {it:it, oi:i}; });
  if(!S._ptSort) return arr;
  var f=PT_SORTKEY[S._ptSort]; if(!f) return arr;             // cột tính toán -> bỏ qua
  var dir=S._ptSortDir==='desc'?-1:1, num=['dt','hs','kl','dgnt','dg'].indexOf(f)>=0;
  return arr.sort(function(a,b){
    var va=a.it[f], vb=b.it[f];
    if(num) return ((Number(va)||0)-(Number(vb)||0))*dir;
    return String(va||'').localeCompare(String(vb||''),'vi',{numeric:true})*dir;
  });
}
// kéo mép chỉnh rộng cột bảng Phần thô
document.addEventListener('mousedown',function(e){
  var rs=e.target.closest&&e.target.closest('.ptrsz'); if(!rs) return;
  e.preventDefault(); e.stopPropagation();
  var k=rs.dataset.k, sx=e.clientX;
  var col=PT_COLS.filter(function(c){return c[0]===k;})[0]; if(!col) return;
  var sw=ptW_(col);
  S._ptColW=S._ptColW||{};
  var tb=document.querySelector('#ptWrap table.pt');
  var ths=tb?[].slice.call(tb.querySelectorAll('thead th')):[];
  var idx=ths.map(function(t){return t.getAttribute('data-k');}).indexOf(k);
  var colEl=(tb&&idx>=0)?tb.querySelectorAll('colgroup col')[idx]:null;
  function mv(ev){ var w=Math.max(44, sw+(ev.clientX-sx)); S._ptColW[k]=w; if(colEl) colEl.style.width=w+'px'; }
  function up(){ document.removeEventListener('mousemove',mv); document.removeEventListener('mouseup',up); renderPhanTho(); }
  document.addEventListener('mousemove',mv); document.addEventListener('mouseup',up);
});
// ghép ô theo đúng danh sách cột đang hiện (ô nào không có -> ô trống)
function ptCells_(vis,map){ return vis.map(function(c){ return map[c[0]]||'<td class="'+(c[2]==='n'?'n':(c[2]==='c'?'c':''))+'"></td>'; }).join(''); }
// vị trí (1-based) của 1 cột trong danh sách đang hiện; 0 nếu đang ẩn
function ptIdx_(vis,key){ for(var i=0;i<vis.length;i++) if(vis[i][0]===key) return i+1; return 0; }
function renderPhanTho(){
  var pw=document.getElementById('ptWrap'); if(!pw) return;
  if(!S.cur){ pw.innerHTML='<div class="empty" style="padding:24px;text-align:center">Chưa chọn dự án.</div>'; return; }
  ptEnsure();
  if(!S._ptCols){ S._ptCols={}; PT_COLS.forEach(function(c){ S._ptCols[c[0]]=true; }); }
  var comp=ptComputeAll();
  // Thứ tự + tên cột ĐÚNG như hình mẫu Phần thô
  var COLS=PT_COLS.map(function(c){return c[1];});
  // thứ tự cột tuỳ biến (kéo th để đổi) + lọc theo chip đang bật
  PT_COLS.forEach(function(c){ if(S._ptOrder && S._ptOrder.indexOf(c[0])<0) S._ptOrder.push(c[0]); });
  var ptVis=ptVisCols_();          // dùng CHUNG với ptFreezeTo để chỉ số cột cố định không lệch
  function ptPct(v){ v=Number(v)||0; return v?(v.toFixed(1)+'%'):''; }
  var body='';
  if(!S.phanTho.length){
    var isDT=ptLoai_().indexOf('dt_')===0;
    body+='<tr class="pt-empty"><td colspan="'+(ptVis.length+1)+'">'
      +'<div class="pt-empty-b">'+icon('layers',30)
      +'<h4>Bảng đang trống</h4>'
      +(isDT
        ? '<p>Dự toán chạy theo <b>bộ</b>: nhập số liệu đầu vào ở panel bên trái, rồi bấm <b class="pe-t">Dùng bộ dự toán này</b> — hệ thống đưa cả nhân công · máy · vật tư vào bảng.<br>Sửa số liệu đầu vào lúc nào, bảng <b>tự tính lại</b> lúc đó.</p>'
        : '<p>Chọn hạng mục từ danh sách bên trái — bấm <b class="pe-b">＋</b> để thêm từng công tác, hoặc <b class="pe-r">＋</b> ở tên nhóm để thêm cả nhóm.<br>Mọi lựa chọn được <b>lưu tự động</b>.</p>')
      +'</div></td></tr>';
  }
  S.phanTho.forEach(function(sec,si){
    var st=comp.sections[si];
    var isSecArea = sec.mode==='area';
    var sumDG = sec.items.reduce(function(s,it){ return s+ptN(it.dg); },0);
    // cộng khối lượng chỉ có nghĩa khi cả nhóm dùng CHUNG 1 đơn vị tính (dự toán trộn công/ca/m thì bỏ trống)
    var dvtSet={}; sec.items.forEach(function(it){ dvtSet[String(it.dvt||'').trim()]=1; });
    var klCell = (st.sumKL && Object.keys(dvtSet).length<=1) ? ptQty(st.sumKL) : '';
    var oneDvt = Object.keys(dvtSet).length<=1;                 // cộng đơn giá cũng chỉ có nghĩa khi chung 1 ĐVT
    var upCell = isSecArea ? ptInp(si,-1,'up',sec.up,'pt-money') : ((sumDG&&oneDvt)?money(sumDG):'');
    // ---- dòng tiêu đề hạng mục (đơn giá + thành tiền ở 2 cột cuối) ----
    var secLn=st.tt-st.ttnt;                       // lợi nhuận cả nhóm  (L = P − K)
    var secMargin=st.tt?(secLn/st.tt*100):0;       // M = L/P
    var secMarkup=st.ttnt?(secLn/st.ttnt*100):0;   // N = L/K
    // đơn giá nhà thầu của nhóm: chỉ hiện khi cả nhóm dùng CHUNG 1 đơn giá (như sheet)
    var dgntSet={}; sec.items.forEach(function(it){ dgntSet[ptN(it.dgnt)]=1; });
    var dgntKeys=Object.keys(dgntSet);
    var secDgnt=(dgntKeys.length===1&&ptN(dgntKeys[0]))?ptN(dgntKeys[0]):0;
    var secCells={
      stt:'<td class="c">'+PT_ROMAN[si]+'</td>',
      noidung:'<td class="pt-secname"><textarea class="pt-secttl-in" rows="1" spellcheck="false" title="Bấm để sửa tên hạng mục" placeholder="Tên hạng mục" oninput="autoGrow(this)" onchange="ptEditSec_('+si+',\'t\',this.value)">'+esc(sec.t)+'</textarea>'+(sec.note?'<span class="pt-note">'+esc(sec.note)+'</span>':'')+'<span class="pt-secdel" title="Xoá hạng mục" onclick="ptDelSection('+si+')">'+icon('trash',13)+'</span></td>',
      khoiluong:'<td class="n">'+klCell+'</td>',
      dgnt:'<td class="n b">'+(secDgnt?money(secDgnt):'')+'</td>',
      ttnt:'<td class="n b">'+(st.ttnt?money(st.ttnt):'')+'</td>',
      lnvnd:'<td class="n b">'+(secLn?money(secLn):'')+'</td>',
      margin:'<td class="n b pt-pctc">'+(secMargin?ptPct(secMargin):'')+'</td>',
      markup:'<td class="n b pt-pctc">'+(secMarkup?ptPct(secMarkup):'')+'</td>',
      dg:'<td class="n pt-upcell b">'+upCell+'</td>',
      tt:'<td class="n b">'+(st.tt?money(st.tt):'-')+'</td>'
    };
    body+='<tr class="pt-sec" data-si="'+si+'">'+ptCells_(ptVis,secCells)+'<td></td></tr>';
    body+='<tr class="pt-spacer"><td colspan="'+(ptVis.length+1)+'"></td></tr>';
    // ---- các dòng chi tiết ----
    ptSortItems_(sec.items).filter(function(_r){ return ptRowPass_(sec,_r.it); }).forEach(function(_r,_pos){
      var it=_r.it, ii=_r.oi;          // ii = index GỐC (sửa ô đúng dòng), _pos = vị trí hiển thị
      var kl=it._kl, tt=it._tt, ttnt=it._ttnt;
      var isArea=(sec.mode==='area'||sec.mode==='area0'), isItem=sec.mode==='item';
      var lnVnd = isItem?(tt-ttnt):0;
      var margin = (isItem&&tt)?(lnVnd/tt*100):0;   // lợi nhuận / giá bán
      var markup = (isItem&&ttnt)?(lnVnd/ttnt*100):0; // lợi nhuận / giá vốn
      var rowCells={
        stt:'<td class="c pt-grip" title="Kéo để đổi chỗ dòng hoặc chuyển sang hạng mục khác">'
             +'<input type="checkbox" class="tkck" '+(ptSelHas_(si,ii)?'checked':'')
             +' onclick="ptSelClick_(event,'+si+','+ii+')" title="Chọn dòng (giữ Shift để chọn cả vùng)">'
             +'<span class="sttn">'+(_pos+1)+'</span></td>',
        noidung:'<td>'+ptTxt(si,ii,'n',it.n)+'</td>',
        dvt:'<td class="c dvt-cell">'+ptTxt(si,ii,'dvt',it.dvt)+'</td>',
        dientich:'<td class="n">'+((isArea||isItem)?ptInp(si,ii,'dt',it.dt):'')+'</td>',
        heso:'<td class="n">'+((isArea||isItem)?ptInp(si,ii,'hs',it.hs,'',(ptN(it.dt)>0?'1':'')):'')+'</td>',
        khoiluong:'<td class="n">'+(isArea?'<span class="pt-ro">'+ptQty(kl)+'</span>'
           :(isItem?(ptAutoKL_(it)?'<span class="pt-ro" title="Khối lượng = Diện tích × Hệ số">'+ptQty(kl)+'</span>':ptInp(si,ii,'kl',it.kl)):''))+'</td>',
        dgnt:'<td class="n">'+(isItem?ptInp(si,ii,'dgnt',it.dgnt,'pt-money'):'')+'</td>',
        ttnt:'<td class="n">'+(isItem?'<span class="pt-ro">'+money(ttnt)+'</span>':'')+'</td>',
        lnvnd:'<td class="n">'+(isItem?'<span class="pt-ro">'+money(lnVnd)+'</span>':'')+'</td>',
        margin:'<td class="n">'+(isItem?ptInp(si,ii,'lnPct',(it.lnPct!=null&&it.lnPct!=='')?it.lnPct:ptR2(margin),'pt-pct-in'):'')+'</td>',
        markup:'<td class="n">'+(isItem?'<span class="pt-ro pt-pctc">'+ptPct(markup)+'</span>':'')+'</td>',
        dg:'<td class="n">'+(isItem?ptInp(si,ii,'dg',it.dg,'pt-money'):'')+'</td>',
        tt:'<td class="n">'+(isItem?'<span class="pt-ro b">'+money(tt)+'</span>':'<span class="pt-dash">-</span>')+'</td>',
        ghichu:'<td class="pt-gc">'+ptTxt(si,ii,'gc',it.gc)+'</td>'
      };
      body+='<tr class="pt-row'+ptCfClass_(sec,it)+(ptSelHas_(si,ii)?' rowsel':'')+'" draggable="true" data-si="'+si+'" data-ii="'+ii+'">'+ptCells_(ptVis,rowCells)
        +'<td class="pt-del">'
          +'<button title="Nhân bản dòng" onclick="ptDupItem('+si+','+ii+')">'+icon('copy',13)+'</button>'
          +'<button title="Chèn dòng trống bên dưới" onclick="ptInsertItem('+si+','+ii+')">'+icon('plus',13)+'</button>'
          +'<button class="x" title="Xoá dòng" onclick="ptDelItem('+si+','+ii+')">'+icon('trash',13)+'</button>'
        +'</td></tr>';
    });
    body+='<tr class="pt-add" data-si="'+si+'"><td></td><td colspan="'+Math.max(1,ptVis.length-1)+'"><span onclick="ptAddItem('+si+')">＋ Thêm dòng</span></td><td></td></tr>';
    body+='<tr class="pt-spacer"><td colspan="'+(ptVis.length+1)+'"></td></tr>';
  });
  // ---- tổng cộng / VAT / sau thuế ----  (cột 8=TT nhà thầu, 9=lợi nhuận, 13=thành tiền)
  // các dòng tổng: colspan tính theo vị trí cột đang hiện
  var iTT=ptIdx_(ptVis,'tt')||ptVis.length;
  body+='<tr class="pt-spacer pt-spacer-tot"><td colspan="'+(ptVis.length+1)+'"></td></tr>';
  body+='<tr class="pt-total">'+ptCells_(ptVis,{
      stt:'<td class="c"></td>',
      noidung:'<td class="pt-tlbl">TỔNG CỘNG</td>',
      ttnt:'<td class="n b">'+money(comp.contractor)+'</td>',
      lnvnd:'<td class="n b">'+money(comp.profit)+' <span class="pt-pct">('+comp.profitPct.toFixed(1)+'%)</span></td>',
      tt:'<td class="n b">'+money(comp.grand)+'</td>'
    })+'<td></td></tr>';
  // (VAT + Thành tiền sau thuế đã hiển thị ở thanh tổng phía trên -> bỏ khỏi bảng cho gọn)

  // cố định tối đa 2 cột đầu (giống bảng Bóc tách)
  var frz=Math.min(S._ptFreeze||0, 2, ptVis.length);
  var frzVar=frz?(' style="--frz1w:'+ptW_(ptVis[0])+'px"'):'';
  var colg='<colgroup>'+ptVis.map(function(c){ return '<col style="width:'+ptW_(c)+'px">'; }).join('')+'<col style="width:74px"></colgroup>';
  // header: bấm nhãn = sắp xếp · kéo th = đổi vị trí cột · kéo mép = chỉnh rộng (giống bảng Bóc tách)
  var thead='<tr>'+ptVis.map(function(c){
      var cls=c[2]==='n'?'n':(c[2]==='c'?'c':'');
      var on=S._ptSort===c[0], ar=on?(S._ptSortDir==='desc'?' ▼':' ▲'):'';
      var loc=!!(S._ptFilter&&S._ptFilter[c[0]]);
      return '<th class="thk '+cls+(on?' sortOn':'')+(loc?' fltOn':'')+'" data-k="'+c[0]+'" draggable="true" title="Bấm nhãn để sắp xếp · kéo để đổi vị trí · kéo mép phải để chỉnh rộng"'
        +' ondragstart="ptColDragStart(event,\''+c[0]+'\')" ondragover="event.preventDefault()" ondrop="ptColDrop(event,\''+c[0]+'\')">'
        +'<span class="thl" onclick="ptToggleSort(\''+c[0]+'\')">'+esc(c[1])+ar+'</span>'
        +'<span class="thflt" title="Lọc cột" onclick="ptOpenFilter(event,\''+c[0]+'\')">▾</span>'
        +'<span class="ptrsz" data-k="'+c[0]+'"></span></th>';
    }).join('')+'<th></th></tr>';
  // hàng CHIP chọn cột (giống Bóc tách)
  var frzLbl=frz?('Bỏ cố định ('+frz+' cột)'):'Cố định cột';
  var soLoc=Object.keys(S._ptFilter||{}).length;
  var ptOn=PT_COLS.filter(function(c){ return S._ptCols[c[0]]; }).length;
  var ptChips='<div class="colchips pt-colchips">'
    +'<span class="cp-collbl">Cột hiển thị</span>'
    +'<button class="btn ghost sm'+(frz?' on':'')+'" title="Cố định cột trái khi cuộn ngang" onclick="'
      +(frz?'ptUnfreeze()':'ptFreezeTo(\''+(ptVis[1]?ptVis[1][0]:ptVis[0][0])+'\')')+'">'+icon('lock',14)+' '+esc(frzLbl)+'</button>'
    +(soLoc?'<button class="btn ghost sm on" title="Bỏ mọi bộ lọc cột" onclick="ptClearFilter()">Đang lọc '+soLoc+' cột ✕</button>':'')
    +PT_COLS.map(function(c){ return '<span class="chip'+(S._ptCols[c[0]]?' on':'')+'" onclick="ptColToggle(\''+c[0]+'\')">'+esc(c[1])+'</span>'; }).join('')
    +'</div>';

  // Thanh tổng dùng chung (giống các hạng mục SP khác) — hiện cho cả Phần thô
  var teP=document.getElementById('tkTotals');
  if(teP){ teP.innerHTML='<div class="tkt-bar">'
    +'<div class="tkt-seg"><span class="tkt-ic">'+icon('money',16)+'</span><span class="tkt-c"><span class="tkt-l">Tổng chưa VAT</span><span class="tkt-v">'+money(comp.grand)+' đ</span></span></div>'
    +'<div class="tkt-seg"><span class="tkt-ic">'+icon('gauge',16)+'</span><span class="tkt-c"><span class="tkt-l">Thuế VAT <input class="tkt-vat" type="number" step="any" min="0" value="'+comp.vatPct+'" onchange="ptSetVat(this.value)">%</span><span class="tkt-v">'+money(comp.vat)+' đ</span></span></div>'
    +'<div class="tkt-seg grand"><span class="tkt-ic">'+icon('cart',17)+'</span><span class="tkt-c"><span class="tkt-l">Tổng thành tiền</span><span class="tkt-v">'+money(comp.afterTax)+' đ</span></span></div>'
    +'</div>'; }
  var tcP=document.getElementById('tkCount'); if(tcP){ var nItems=(S.phanTho||[]).reduce(function(s,se){return s+((se.items||[]).length);},0); tcP.textContent='['+pad2(nItems)+']'; }
  // giữ nguyên vị trí đang cuộn (thêm/sửa dòng không được nhảy về đầu bảng)
  var _sc=pw.querySelector('.pt-scroll'), _sT=_sc?_sc.scrollTop:0, _sL=_sc?_sc.scrollLeft:0;
  var _winY=window.pageYOffset||document.documentElement.scrollTop||0;
  pw.innerHTML =
    '<div class="pt-toolbar">'
      + '<div class="pt-tt">Bảng ước tính chi phí — <b>Xây dựng thô</b></div>'
      + '<div class="sp"></div>'
      + '<button class="btn ghost sm" onclick="ptReset()">'+icon('trash',14)+' Xoá hết</button>'
      + '<button class="btn blue sm" onclick="ptAddSection()">'+icon('plus',14)+' Thêm hạng mục</button>'
    + '</div>'
    + ptChips
    + '<div class="pt-scroll"><table class="pt'+(frz?(' frz'+frz):'')+'"'+frzVar+' oncontextmenu="ptCtx(event)">'+colg+'<thead>'+thead+'</thead><tbody>'+body+'</tbody></table></div>'
    + '<div class="tk-hbar pt-hbar" id="ptHBar" style="display:none"><div class="tk-hthumb" id="ptHThumb"></div></div>';
  // giãn sẵn các ô chữ để hiện ĐỦ nội dung, không bị cắt (giống bảng Bóc tách)
  pw.querySelectorAll('textarea.pt-area').forEach(autoGrow);
  pw.querySelectorAll('textarea.pt-secttl-in').forEach(autoGrow);
  // trả lại đúng chỗ đang xem trước khi vẽ lại
  var _sc2=pw.querySelector('.pt-scroll');
  if(_sc2){ _sc2.scrollTop=_sT; _sc2.scrollLeft=_sL; }
  if(_winY) window.scrollTo(0,_winY);
  ptDragBind_(pw.querySelector('table.pt'));   // kéo dòng sang hạng mục khác
  markBlocks_('#ptWrap table.pt');             // kẻ dọc liền trong 1 hạng mục
  ptHBarInit_(); ptHBarSync_();          // thanh kéo ngang giống bảng Bóc tách
  ptSelPrune_(); ptSelBar_();            // vùng chọn dòng + thanh thao tác hàng loạt (như Bóc tách)
  ptFreezeRows_();                       // cố định N hàng đầu (như Excel)
  ptGotoNewRow_();                       // giữ vệt nháy dòng vừa thêm qua các lần vẽ lại
}

/* ===== Sửa tên hạng mục + KÉO DÒNG giữa các hạng mục (giống bảng Bóc tách) ===== */
function ptEditSec_(si,f,val){
  var sec=S.phanTho[si]; if(!sec) return;
  var v=String(val==null?'':val).replace(/\s+$/,'');
  if(f==='t' && !v.trim()){ toast('Tên hạng mục không được để trống'); renderPhanTho(); return; }
  if(sec[f]===v) return;
  sec[f]=v; ptPersist(); renderPhanTho();
}
function ptRenameSec(si){
  var sec=S.phanTho[si]; if(!sec) return;
  renderPhanTho();
  var ta=document.querySelector('#ptWrap tr.pt-sec[data-si="'+si+'"] .pt-secttl-in');
  if(ta){ ta.focus(); ta.select(); ta.scrollIntoView({block:'center'}); }
}
// chuyển 1 dòng sang vị trí khác (cùng hạng mục hoặc sang hạng mục khác)
function ptMoveItem_(fs,fi,ts,ti,before){
  var A=S.phanTho[fs], B=S.phanTho[ts]; if(!A||!B) return;
  var it=A.items[fi]; if(!it) return;
  if(fs===ts && (ti===fi || (before?ti:ti+1)===fi)) return;      // không đổi gì
  A.items.splice(fi,1);
  if(fs===ts && ti>fi) ti--;
  if(ti==null||ti<0||ti>B.items.length) ti=B.items.length;
  // sang hạng mục khác kiểu -> bù các trường còn thiếu để không mất ô nhập
  if(A.mode!==B.mode){ var d=ptBlankItem_(B); Object.keys(d).forEach(function(k){ if(it[k]==null||it[k]==='') it[k]=d[k]; }); }
  ['_kl','_tt','_ttnt'].forEach(function(k){ delete it[k]; });
  B.items.splice(before?ti:ti+1,0,it);
  ptPersist(); renderPhanTho();
  if(fs!==ts) toast('Đã chuyển sang "'+String(B.t||'').split('\n')[0]+'"');
}
// Kéo 1 công tác từ thư viện trái thả thẳng vào bảng khái toán (giống kéo SP đèn vào bảng bóc tách)
function ptLibDragStart_(e,si,ii){
  if(e.target.closest('button')){ e.preventDefault(); return; }
  S._ptLibDrag={si:si,ii:ii};
  var tsec=PT_TEMPLATE[si], a=tsec&&tsec.items[ii];
  try{
    e.dataTransfer.effectAllowed='copy'; e.dataTransfer.setData('text/plain','ptlib');
    // thẻ ma khi kéo — dùng CHUNG mẫu với bên Thiết bị đèn cho thống nhất
    if(a){
      var ten=String(a[0]).split('\n')[0], dvt=ptVal_(tsec,a,'dvt')||'', dg=ptN(ptLibDg_(tsec,a));
      var g=document.createElement('div'); g.className='drag-ghost';
      g.innerHTML='<span class="dg-img"></span><span class="dg-b"><span class="dg-nm">'+esc(ten)+'</span>'
        +'<span class="dg-pr">'+esc(dvt)+(dg?(' · '+money(dg)+' đ'):'')+'</span></span>'
        +'<span class="dg-add">'+icon('plus',14)+'Thả vào bảng</span>';
      document.body.appendChild(g); S._ptLibGhost=g;
      e.dataTransfer.setDragImage(g, 24, 28);
    }
  }catch(x){}
  var el=e.currentTarget; if(el) el.classList.add('dragging');
}
function ptLibDragEnd_(){
  S._ptLibDrag=null;
  if(S._ptLibGhost){ S._ptLibGhost.remove(); S._ptLibGhost=null; }
  document.querySelectorAll('#catList .ptlib-item.dragging').forEach(function(x){ x.classList.remove('dragging'); });
  document.querySelectorAll('#ptWrap .dropInto,#ptWrap .dropTop,#ptWrap .dropBot').forEach(function(x){ x.classList.remove('dropInto','dropTop','dropBot'); });
}
function ptDragBind_(tb){
  if(!tb || tb._ptdrag) return; tb._ptdrag=1;
  function clr(){ tb.querySelectorAll('.dropTop,.dropBot,.dropInto').forEach(function(x){ x.classList.remove('dropTop','dropBot','dropInto'); }); }
  // gõ trong ô nhập thì tắt kéo (để còn bôi đen chữ), bấm chỗ khác thì bật lại
  tb.addEventListener('mousedown',function(e){
    var tr=e.target.closest('tr.pt-row'); if(!tr) return;
    tr.draggable = !e.target.closest('input,textarea,button,select');
  });
  tb.addEventListener('dragstart',function(e){
    if(e.target.closest('th.thk')) return;                 // kéo cột: đã có ptColDragStart
    var tr=e.target.closest('tr.pt-row'); if(!tr) return;
    if(e.target.closest('input,textarea,button,select')){ e.preventDefault(); return; }
    S._ptDrag={si:+tr.getAttribute('data-si'), ii:+tr.getAttribute('data-ii')};
    tr.classList.add('dragging');
    try{ e.dataTransfer.effectAllowed='move'; e.dataTransfer.setData('text/plain','pt-row'); }catch(x){}
  });
  tb.addEventListener('dragend',function(){ S._ptDrag=null; tb.querySelectorAll('tr.dragging').forEach(function(x){x.classList.remove('dragging');}); clr(); });
  tb.addEventListener('dragover',function(e){
    if(S._ptLibDrag){                                   // đang kéo công tác từ thư viện
      e.preventDefault(); try{ e.dataTransfer.dropEffect='copy'; }catch(x){}
      clr();
      var rw=e.target.closest('tr.pt-row');
      if(rw){                                          // rê lên 1 dòng -> vạch chèn trên/dưới (giống bảng đèn)
        var rr=rw.getBoundingClientRect();
        rw.classList.add(e.clientY<rr.top+rr.height/2?'dropTop':'dropBot');
        return;
      }
      var t=e.target.closest('tr.pt-sec,tr.pt-add,tr.pt-empty');
      if(t) t.classList.add('dropInto');               // rê lên tên hạng mục -> thêm vào cuối hạng mục đó
      return;
    }
    if(!S._ptDrag) return; e.preventDefault();
    try{ e.dataTransfer.dropEffect='move'; }catch(x){}
    clr();
    var tr=e.target.closest('tr'); if(!tr) return;
    if(tr.classList.contains('pt-row')){
      var r=tr.getBoundingClientRect();
      tr.classList.add(e.clientY<r.top+r.height/2?'dropTop':'dropBot');
    } else if(tr.classList.contains('pt-sec')||tr.classList.contains('pt-add')) tr.classList.add('dropInto');
  });
  tb.addEventListener('drop',function(e){
    if(S._ptLibDrag){
      e.preventDefault();
      var d=S._ptLibDrag; S._ptLibDrag=null; ptLibDragEnd_();
      // thả ở đâu thì chèn vào ĐÚNG ĐÓ (trước đây luôn đẩy xuống cuối hạng mục theo mẫu)
      var dich=null, rw=e.target.closest('tr.pt-row');
      if(rw){
        var rr=rw.getBoundingClientRect(), ii=+rw.getAttribute('data-ii');
        dich={si:+rw.getAttribute('data-si'), at:(e.clientY<rr.top+rr.height/2?ii:ii+1)};
      } else {
        var sc=e.target.closest('tr.pt-sec,tr.pt-add');
        if(sc){ var s2=+sc.getAttribute('data-si');
          var sec2=(S.phanTho||[])[s2];
          if(sec2) dich={si:s2, at:(sec2.items||[]).length}; }
      }
      clr();
      ptAddFromLib(d.si,d.ii,false,dich);
      return;
    }
    if(!S._ptDrag) return; e.preventDefault();
    var d=S._ptDrag; S._ptDrag=null; clr();
    tb.querySelectorAll('tr.dragging').forEach(function(x){x.classList.remove('dragging');});
    var tr=e.target.closest('tr'); if(!tr) return;
    if(tr.classList.contains('pt-row')){
      var ts=+tr.getAttribute('data-si'), ti=+tr.getAttribute('data-ii');
      if(ts===d.si && S._ptSort){ toast('Đang sắp xếp theo cột — bỏ sắp xếp rồi mới đổi chỗ dòng'); return; }
      var r=tr.getBoundingClientRect();
      ptMoveItem_(d.si,d.ii,ts,ti,e.clientY<r.top+r.height/2);
    } else if(tr.classList.contains('pt-sec')||tr.classList.contains('pt-add')){
      var s2=+tr.getAttribute('data-si'); if(isNaN(s2)) return;
      ptMoveItem_(d.si,d.ii,s2,null,true);
    }
  });
}

/* ===================== AUTH & ADMIN ===================== */
async function authStart_(){
  var t=authToken();
  if(!t){ showLogin_(); return; }
  try{ var u=await api('me'); S.me=u; S.congTy=u.congTy||null; onAuthed_(); }
  catch(e){ setAuthToken(''); showLogin_(); }
}
function showLogin_(msg){
  var ls=document.getElementById('loginScreen'); if(ls) ls.style.display='flex';
  var m=document.getElementById('loginMsg'); if(m){ m.textContent=msg||''; m.style.display=msg?'block':'none'; }
  var u=document.getElementById('loginUser'); if(u) setTimeout(function(){u.focus();},60);
}
async function doLogin_(){
  var user=(document.getElementById('loginUser').value||'').trim();
  var pw=document.getElementById('loginPw').value||'';
  var btn=document.getElementById('loginBtn'), msg=document.getElementById('loginMsg');
  function err(t){ if(msg){ msg.style.display='block'; msg.textContent=t; } }
  if(!user||!pw){ err('Nhập tên đăng nhập và mật khẩu'); return; }
  btn.disabled=true; btn.textContent='Đang đăng nhập…';
  try{ var r=await api('login',user,pw); setAuthToken(r.token); S.me=r.user; S.congTy=r.congTy||null;
    document.getElementById('loginPw').value=''; onAuthed_(); }
  catch(e){ err(e.message||'Đăng nhập thất bại'); }
  btn.disabled=false; btn.textContent='Đăng nhập';
}
function loginTogglePw(){ var i=document.getElementById('loginPw'), e=document.querySelector('.login-eye'); if(!i)return; var show=i.type==='password'; i.type=show?'text':'password'; if(e) e.classList.toggle('on',show); i.focus(); }
function onAuthed_(){ var ls=document.getElementById('loginScreen'); if(ls) ls.style.display='none'; applyRoleUI_();
  try{ tkMyColsApply_(); }catch(e){}           // bật bộ cột "Của tôi" của tài khoản vừa đăng nhập
  boot();
  // Nếu tài khoản không có quyền vào tab đang mở -> chuyển tới tab đầu tiên hợp lệ
  var cur=document.querySelector('#nav a.active, .topnav .right a.active'); var t=cur?cur.getAttribute('data-tab'):'boc';
  if(!canTab(t)){ var f=firstAllowedTab_(); if(f) showTab(f); }
}
var PERM_TABS=[['dash','Bảng điều khiển'],['boc','Bóc tách'],
  ['chiphi','Chi phí'],['export','Xuất báo giá'],['muahang','Mua hàng'],
  ['duan','Dự án'],['sanpham','Danh sách sản phẩm'],['import','Nhập dữ liệu']];
// Tính năng công ty được cấp (super admin: không giới hạn)
function ctHasFeature_(tab){
  var me=S.me||{}; if(me.role==='super') return true;
  var ct=S.congTy; if(!ct) return true;                 // chưa gán công ty -> không chặn
  var f=ct.tinhNang||[]; if(!f.length) return true;      // gói trống = mở hết
  return f.indexOf(tab)>=0;
}
// 'super' (quản trị hệ thống) có mọi quyền của admin công ty
function isAdminRole_(){ var r=(S.me||{}).role; return r==='admin'||r==='super'; }
function canTab(tab){
  var me=S.me||{};
  if(tab==='congty') return me.role==='super';           // trang quản lý công ty: chỉ super
  if(tab==='admin') return me.role==='admin'||me.role==='super';
  if(!ctHasFeature_(tab)) return false;                  // công ty chưa mua tính năng này
  if(me.role==='admin'||me.role==='super') return true;
  return (me.perms||[]).indexOf(tab)>=0;
}
function firstAllowedTab_(){ var me=S.me||{}; if(isAdminRole_()) return 'boc';
  for(var i=0;i<PERM_TABS.length;i++){ if(canTab(PERM_TABS[i][0])) return PERM_TABS[i][0]; } return null; }
// Thương hiệu riêng của công ty: logo + màu
function applyBrand_(){
  var ct=S.congTy||{};
  var logo=document.querySelector('.topnav .logo');
  if(logo){
    if(ct.logoUrl){ logo.src=ct.logoUrl; logo.alt=ct.ten||'Logo'; logo.title=ct.ten||''; }
    else { logo.src='logo.svg'; logo.alt='Dezon Pro'; }
  }
  if(ct.mauChinh){ document.documentElement.style.setProperty('--blue', ct.mauChinh); }
  var t=(ct.ten? (ct.ten+' — ') : '')+'Dezon Pro';
  if(document.title!==t) document.title=t;
}
function applyRoleUI_(){
  var me=S.me||{}, nm=me.hoTen||me.username||'';
  var chip=document.getElementById('userChip'); if(chip) chip.style.display='';
  var byId=function(id){return document.getElementById(id);};
  if(byId('ucName')) byId('ucName').textContent=me.username||'';
  if(byId('ucAv')) byId('ucAv').textContent=(nm||'?').trim().charAt(0).toUpperCase();
  if(byId('ucFull')) byId('ucFull').textContent=nm;
  var roleLbl={super:'Quản trị hệ thống',admin:'Quản trị công ty',staff:'Nhân viên'};
  if(byId('ucRole')) byId('ucRole').textContent = roleLbl[me.role]||'Nhân viên';
  if(byId('ucCty')) byId('ucCty').textContent = (S.congTy&&S.congTy.ten)||(me.role==='super'?'Toàn hệ thống':'');
  var na=byId('navAdmin'); if(na) na.style.display = (me.role==='admin'||me.role==='super')?'':'none';
  var nc=byId('navCongTy'); if(nc) nc.style.display = me.role==='super'?'':'none';
  applyBrand_();
  // Ẩn các tab mà tài khoản không được cấp quyền
  document.querySelectorAll('#nav a[data-tab], .topnav .right a[data-tab]').forEach(function(a){
    var t=a.getAttribute('data-tab'); if(t==='admin') return;   // admin nav xử lý riêng ở trên
    a.style.display = canTab(t)?'':'none';
  });
  var bell=byId('notifBell'); if(bell) bell.style.display='';
  startNotifPoll_();
}
/* ===== Thông báo (chuông) ===== */
function toggleNotif(e){ e.stopPropagation(); var m=document.getElementById('nbMenu'); if(!m)return; var open=m.style.display!=='none'; m.style.display=open?'none':'block';
  if(!open){ renderNotif_(); setTimeout(function(){ document.addEventListener('mousedown',nbOut_); },0); } }
function nbOut_(e){ if(!e.target.closest('#notifBell')){ var m=document.getElementById('nbMenu'); if(m)m.style.display='none'; document.removeEventListener('mousedown',nbOut_); } }
async function renderNotif_(){
  var list=document.getElementById('nbList'); if(!list) return; list.innerHTML='<div class="nb-empty">Đang tải…</div>';
  try{ var ns=await api('notifList',30);
    if(!ns.length){ list.innerHTML='<div class="nb-empty">Chưa có thông báo</div>'; return; }
    list.innerHTML=ns.map(function(n){
      var k=n.kind||'';
      var cls=/_approved$/.test(k)?'ok':(/_rejected$/.test(k)?'no':'req');
      var ic=/^purchase_/.test(k)?'cart':(/^delete_/.test(k)?'trash':(/^sp_edit/.test(k)?'edit':'bell'));
      if(/_approved$/.test(k)) ic='check'; else if(/_rejected$/.test(k)) ic='x';
      return '<div class="nb-item'+(n.read?'':' unread')+'" title="Bấm để xem chi tiết" '
        +'onclick="notifClick('+n.id+',\''+esc(k)+'\',\''+esc(String(n.refId||''))+'\')">'
        +'<div class="nb-ic '+cls+'">'+icon(ic,15)+'</div>'
        +'<div class="nb-tx"><b>'+esc(n.title||'')+'</b><span>'+esc(n.body||'')+'</span><i>'+fmtDateTime_(n.at)+'</i></div>'
        +'<span class="nb-go">'+'<svg class="ico" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18l6-6-6-6"/></svg></span></div>';
    }).join('');
  }catch(e){ list.innerHTML='<div class="nb-empty">Lỗi: '+esc(e.message)+'</div>'; }
}
/* Bấm vào 1 thông báo -> mở thẳng chi tiết của đúng đối tượng đó */
function notifClick(id,kind,refId){
  api('notifRead',id).then(refreshNotifCount_).catch(function(){});
  var m=document.getElementById('nbMenu'); if(m) m.style.display='none';
  refId=refId?String(refId):'';
  var isAdmin=isAdminRole_();
  // ── Đơn mua hàng: mở luôn modal chi tiết đơn
  if(/^purchase_/.test(kind)){
    if(isAdmin && refId){ showTab('admin'); setTimeout(function(){ purDetail(refId); },320); }
    else { showTab('muahang'); toast(refId?('Đơn '+refId):'Mở tab Mua hàng'); }
    return;
  }
  // ── Yêu cầu xoá sản phẩm: sang Admin và làm nổi đúng thẻ yêu cầu
  if(/^delete_/.test(kind)){
    if(isAdmin){ showTab('admin'); setTimeout(function(){ notifHighlight_('drqCard','drq-'+refId); },350); }
    else { showTab('sanpham'); toast('Yêu cầu xoá sản phẩm '+(kind==='delete_approved'?'đã được duyệt':kind==='delete_rejected'?'bị từ chối':'đang chờ duyệt')); }
    return;
  }
  // ── Thay đổi sản phẩm (bản duyệt cũ): mở luôn sản phẩm trong Danh sách SP
  if(/^sp_edit/.test(kind)){ notifOpenSP_(refId); return; }
  renderNotif_();
}
// Mở tab Danh sách SP và bật modal chi tiết của sản phẩm theo mã
async function notifOpenSP_(ma){
  showTab('sanpham');
  await new Promise(function(r){ setTimeout(r,420); });
  if(!ma){ return; }
  var el=document.getElementById('spSearch'); if(el){ el.value=ma; spFilter(); }
  await new Promise(function(r){ setTimeout(r,260); });
  if((S._spList||[]).length) spModal(0);
  else toast('Không tìm thấy sản phẩm '+ma+' (có thể đã bị xoá)');
}
// Cuộn tới và nháy sáng phần tử mục tiêu cho dễ thấy
function notifHighlight_(cardId,itemId){
  var el=document.getElementById(itemId)||document.getElementById(cardId); if(!el) return;
  el.scrollIntoView({block:'center'});
  el.classList.add('nb-flash'); setTimeout(function(){ el.classList.remove('nb-flash'); },1800);
}
function notifMarkAll(e){ if(e)e.stopPropagation(); api('notifReadAll').then(function(){ refreshNotifCount_(); renderNotif_(); }).catch(function(){}); }
async function refreshNotifCount_(){ if(!S.me) return; try{ var c=await api('notifCount'); var b=document.getElementById('nbBadge'); if(!b)return;
  if(c && c.unread>0){ b.textContent=c.unread>99?'99+':c.unread; b.style.display=''; } else b.style.display='none'; }catch(e){} }
function startNotifPoll_(){ refreshNotifCount_(); if(S._notifTimer) clearInterval(S._notifTimer); S._notifTimer=setInterval(refreshNotifCount_,30000); }
function toggleUserMenu(e){ e.stopPropagation(); var m=document.getElementById('ucMenu'); if(!m)return; var open=m.style.display!=='none'; m.style.display=open?'none':'block'; if(!open) setTimeout(function(){ document.addEventListener('mousedown',ucOut_); },0); }
function ucOut_(e){ if(!e.target.closest('#userChip')){ var m=document.getElementById('ucMenu'); if(m)m.style.display='none'; document.removeEventListener('mousedown',ucOut_); } }
async function openChangePw(){ var m=document.getElementById('ucMenu'); if(m)m.style.display='none';
  var r=await askInput_({title:'Đổi mật khẩu', confirmText:'Đổi mật khẩu', fields:[
    {key:'old', label:'Mật khẩu hiện tại', type:'password'},
    {key:'np',  label:'Mật khẩu mới (≥4 ký tự)', type:'password'} ]});
  if(!r) return;
  if(String(r.np).length<4){ toast('Mật khẩu mới phải từ 4 ký tự'); return; }
  api('changePassword',r.old,r.np).then(function(){ toast('Đã đổi mật khẩu'); }).catch(function(e){ toast('Lỗi: '+e.message); });
}
function admActionLabel_(a){ var m={login:'Đăng nhập',logout:'Đăng xuất',login_fail:'ĐN lỗi',create_user:'Tạo TK',update_user:'Sửa TK',delete_user:'Xóa TK',reset_password:'Đặt lại MK',change_password:'Đổi MK',lock_user:'Khóa TK',unlock_user:'Mở khóa'}; return m[a]||a; }
async function renderAdmin(){
  var box=document.getElementById('v-admin'); if(!box) return;
  if(!isAdminRole_()){ box.innerHTML='<div class="sechd"><h2>Quản trị</h2></div><div class="empty">Bạn không có quyền truy cập.</div>'; return; }
  box.innerHTML='<div class="sechd"><h2>Quản trị — Tài khoản & phân quyền</h2></div><div id="admBody"><div class="empty">Đang tải…</div></div>';
  try{
    var users=await api('adminListUsers'); var reqs=await api('listDeleteRequests'); var purs=await api('listPurchaseRequests'); var logs=await api('getAuditLog',120); S._admUsers=users;
    var dxs=[]; try{ dxs=await api('listDeXuat')||[]; }catch(e){ dxs=[]; }
    if(isSuper_()){ try{ S._admCt=await api('listCongTy')||[]; }catch(e){ S._admCt=[]; } }
    document.getElementById('admBody').innerHTML=admStats_(users,reqs,purs,dxs)+admUsersCard_(users)+admReqCard_(reqs)+admPurCard_(purs)+admDxCard_(dxs)+admLogCard_(logs);
  }catch(e){ document.getElementById('admBody').innerHTML='<div class="empty">Lỗi tải: '+esc(e.message)+'</div>'; }
}
function admStats_(users,reqs,purs,dxs){
  var pendDel=(reqs||[]).filter(function(r){return r.status==='pending';}).length;
  var pendPur=(purs||[]).filter(function(r){return r.status==='Chờ duyệt';}).length;
  var pendDx=(dxs||[]).filter(function(r){return r.status==='Chờ duyệt';}).length;
  function tile(ic,val,label,warn){ return '<div class="astat'+(warn&&val?' warn':'')+'"><span class="astat-ic">'+ic+'</span><div><div class="astat-v">'+val+'</div><div class="astat-l">'+label+'</div></div></div>'; }
  return '<div class="astats">'
    +tile(icon('lock',18),(users||[]).length,'Tài khoản',false)
    +tile(icon('trash',18),pendDel,'Yêu cầu xóa chờ duyệt',true)
    +tile(icon('cart',18),pendPur,'Đơn mua hàng chờ duyệt',true)
    +tile(icon('gauge',18),pendDx,'Đề xuất chờ duyệt',true)+'</div>';
}
function rqItem_(opts){
  // opts: {cls, icon, title, meta, badgeCls, badgeText, actions, time}
  return '<div class="rq-item '+opts.cls+'"'+(opts.id?' id="'+opts.id+'"':'')+(opts.onclick?' onclick="'+opts.onclick+'"':'')+'><span class="rq-ic '+opts.cls+'">'+opts.icon+'</span>'
    +'<div class="rq-main"><div class="rq-title">'+opts.title+'</div>'+(opts.meta?'<div class="rq-meta">'+opts.meta+'</div>':'')+'</div>'
    +'<div class="rq-side"><span class="drq-badge '+opts.badgeCls+'">'+opts.badgeText+'</span>'
      +(opts.actions?'<div class="rq-act">'+opts.actions+'</div>':'')
      +'<span class="rq-time">'+opts.time+'</span></div></div>';
}
function isSuper_(){ return !!(S.me && S.me.role==='super'); }
function admCtTen_(id){ var c=(S._admCt||[]).filter(function(x){ return x.id===id; })[0]; return c?(c.ten||c.ma||id):'(công ty đã xoá)'; }
function admUsersCard_(users){
  var lbl={}; PERM_TABS.forEach(function(t){ lbl[t[0]]=t[1]; });
  function permCell(u){ if(u.role==='admin'||u.role==='super') return '<span class="muted">Toàn quyền</span>';
    var p=u.perms||[]; if(!p.length) return '<span class="st-lk">Chưa cấp</span>';
    return p.map(function(k){ return '<span class="permchip">'+esc(lbl[k]||k)+'</span>'; }).join(' '); }
  var rows=users.map(function(u){
    var av=(u.hoTen||u.username||'?').trim().charAt(0).toUpperCase();
    return '<tr class="'+(u.active?'':'locked')+'">'
      +'<td><span class="uav '+(u.role!=='staff'?'adm':'')+'">'+esc(av)+'</span><b>'+esc(u.username)+'</b>'+(u.email?'<span class="ct-ma">'+esc(u.email)+'</span>':'')+'</td><td>'+esc(u.hoTen||'')+'</td>'
      +'<td><span class="rolebadge '+(u.role==='super'?'sup':(u.role==='admin'?'adm':'stf'))+'">'
        +({super:'Quản trị hệ thống',admin:'Admin công ty',staff:'Nhân viên'}[u.role]||u.role)+'</span></td>'
      +'<td class="permcol">'+permCell(u)+'</td>'
      +(isSuper_()?('<td>'+(u.congTyId?esc(admCtTen_(u.congTyId)):'<span class="st-lk" title="Tài khoản không thuộc công ty nào — không đăng nhập được. Bấm Sửa để gán công ty.">⚠ Chưa gán công ty</span>')+'</td>'):'')
      +'<td>'+(u.active?'<span class="st-ok">● Hoạt động</span>':'<span class="st-lk">● Đã khóa</span>')+'</td>'
      +'<td class="muted">'+(u.lastLogin?fmtDateTime_(u.lastLogin):'—')+'</td>'
      +'<td class="admact"><button class="btn ghost xs" onclick="admEdit(\''+u.id+'\')">Sửa</button>'
        +'<button class="btn ghost xs" onclick="admResetPw(\''+u.id+'\')">Đặt MK</button>'
        +'<button class="btn ghost xs" onclick="admToggleActive(\''+u.id+'\','+(u.active?'false':'true')+')">'+(u.active?'Khóa':'Mở')+'</button>'
        +'<button class="btn ghost xs danger" onclick="admDelete(\''+u.id+'\')">Xóa</button></td></tr>';
  }).join('');
  var inner='<div style="margin-bottom:12px"><button class="btn blue sm" onclick="admCreate()">'+icon('plus',14)+' Thêm tài khoản</button></div>'
    +(isSuper_()&&users.filter(function(u){return !u.congTyId;}).length
      ? '<div class="adm-warn"><span class="adm-warn-ic">!</span><span>Có <b>'+users.filter(function(u){return !u.congTyId;}).length
        +'</b> tài khoản chưa gán công ty. Tài khoản kiểu này không đăng nhập được và không hiện trong danh sách của công ty nào — bấm <b>Sửa</b> để gán công ty hoặc xoá đi.</span></div>' : '')
    +'<div class="tbl-wrap"><table class="admtbl"><tr><th>Tên đăng nhập</th><th>Họ tên</th><th>Vai trò</th><th>Quyền truy cập</th>'
      +(isSuper_()?'<th>Công ty</th>':'')+'<th>Trạng thái</th><th>Đăng nhập gần nhất</th><th></th></tr>'+rows+'</table></div>';
  return dbCard_('Tài khoản ('+users.length+')','lock','Admin toàn quyền · Nhân viên không mở được trang này.',inner);
}
/* ===== Chi tiết đơn mua hàng (Admin bấm vào 1 đơn) ===== */
async function purDetail(maDon){
  var ov=document.createElement('div'); ov.className='sp-modal-ov'; ov.id='purOv';
  ov.onclick=function(e){ if(e.target===ov) purClose(); };
  ov.innerHTML='<div class="sp-modal pur-modal pd"><div class="pd-head"><h3>'+icon('cart',16)+' Chi tiết đơn mua hàng</h3>'
    +'<button class="pd-x" onclick="purClose()">✕</button></div><div class="pur-body"><div class="empty" style="padding:26px">Đang tải…</div></div></div>';
  document.body.appendChild(ov);
  try{
    var o=await api('getPurchaseOrder', maDon);
    ov.querySelector('.pur-body').innerHTML=purDetailHtml_(o);
  }catch(e){ ov.querySelector('.pur-body').innerHTML='<div class="empty" style="padding:26px">Lỗi tải đơn: '+esc(e.message)+'</div>'; }
}
function purClose(){ var o=document.getElementById('purOv'); if(o)o.remove(); }
function purDetailHtml_(o){
  var scls={'Đã duyệt':'approved','Từ chối':'rejected','Chờ duyệt':'pending','Đã gửi':'pending'}[o.status]||'pending';
  var rows=(o.items||[]).map(function(it,i){
    return '<tr><td class="c">'+(i+1)+'</td>'
      +'<td class="pur-th">'+(it.hinhAnh?'<img src="'+esc(imgSrc1_(it.hinhAnh))+'" onerror="this.style.visibility=\'hidden\'">':'<span class="pur-noimg"></span>')+'</td>'
      +'<td><b>'+esc(it.ten||'')+'</b>'+(it.ma?'<span class="pur-code">'+esc(it.ma)+'</span>':'')
        +(it.phong?'<span class="pur-room">'+icon('building',10)+' '+esc(it.phong)+'</span>':'')+'</td>'
      +'<td>'+esc(it.thuongHieu||'')+'</td>'
      +'<td class="c">'+esc(it.dvt||'')+'</td>'
      +'<td class="n">'+(it.sl||0)+'</td>'
      +'<td class="n">'+money(it.donGia)+'</td>'
      +'<td class="n b">'+money(it.thanhTien)+'</td></tr>';
  }).join('') || '<tr><td colspan="8" class="empty" style="padding:18px">Đơn không có sản phẩm.</td></tr>';
  var info=function(k,v){ return v?('<div class="pur-i"><span>'+esc(k)+'</span><b>'+esc(v)+'</b></div>'):''; };
  return '<div class="pur-head">'
      +'<div class="pur-ma">'+esc(o.maDon)+'<span class="drq-badge '+scls+'">'+esc(o.status||'')+'</span></div>'
      +'<div class="pur-grid">'
        +info('Nhà cung cấp',o.supplier)+info('Dự án',o.project)
        +info('Người gửi',o.requester)+info('Phòng ban',o.phongBan)
        +info('Hạng mục',o.hangMuc)+info('Ngày gửi',fmtDateTime_(o.at))
        +(o.nguoiDuyet?info('Người duyệt',o.nguoiDuyet):'')
        +(o.ngayDuyet?info('Ngày duyệt',fmtDateTime_(o.ngayDuyet)):'')
      +'</div>'+(o.ghiChu?'<div class="pur-note">'+icon('doc',12)+' '+esc(o.ghiChu)+'</div>':'')+'</div>'
    +'<div class="tbl-wrap pur-tblwrap"><table class="pur-tbl"><thead><tr>'
      +'<th class="c">STT</th><th>Ảnh</th><th>Sản phẩm</th><th>Thương hiệu</th><th class="c">ĐVT</th>'
      +'<th class="n">SL</th><th class="n">Đơn giá</th><th class="n">Thành tiền</th></tr></thead><tbody>'+rows+'</tbody></table></div>'
    +'<div class="pur-tot">'
      +'<div><span>Tạm tính ('+(o.soSp||0)+' SP)</span><b>'+money(o.tongTruocVat)+' đ</b></div>'
      +'<div><span>VAT '+(o.vatPct||0)+'%</span><b>'+money(o.vat)+' đ</b></div>'
      +'<div class="grand"><span>TỔNG THANH TOÁN</span><b>'+money(o.total)+' đ</b></div>'
    +'</div>'
    +(o.status==='Chờ duyệt'
      ? '<div class="pur-act"><button class="btn ghost sm danger" onclick="purResolve(\''+esc(o.maDon)+'\',false);purClose()">Từ chối</button>'
        +'<button class="btn blue" onclick="purResolve(\''+esc(o.maDon)+'\',true);purClose()">'+icon('check',15)+' Duyệt đơn</button></div>'
      : '');
}
function admPurCard_(purs){
  purs=purs||[]; var pending=purs.filter(function(r){return r.status==='Chờ duyệt';});
  var lbl={'Đã duyệt':'approved','Từ chối':'rejected','Chờ duyệt':'pending','Đã gửi':'pending'};
  var body= purs.length? purs.map(function(r){
    var scls=lbl[r.status]||'pending';
    return rqItem_({ cls:scls+' clickable', icon:icon('cart',16),
      onclick:'purDetail(\''+esc(r.maDon)+'\')',
      title:'<b>'+esc(r.maDon)+'</b> · '+esc(r.supplier||'—')+' · <span class="rq-amt">'+money(r.total)+'đ</span>'
        +'<span class="rq-view">'+icon('eye',12)+' Xem chi tiết</span>',
      meta:'Người gửi <b>'+esc(r.requester||'—')+'</b>'+(r.phongBan?(' · '+esc(r.phongBan)):'')+' · Dự án '+esc(r.project||'—')+' · '+(r.soSp||0)+' SP',
      badgeCls:scls, badgeText:esc(r.status||''),
      actions: scls==='pending'?'<button class="btn blue xs" onclick="event.stopPropagation();purResolve(\''+esc(r.maDon)+'\',true)">Duyệt</button><button class="btn ghost xs danger" onclick="event.stopPropagation();purResolve(\''+esc(r.maDon)+'\',false)">Từ chối</button>':'',
      time: fmtDateTime_(r.at) });
  }).join(''):'<div class="empty">Chưa có đơn mua hàng nào.</div>';
  return '<div class="dbcard" id="purCard"><div class="dbcard-h"><span class="dbcard-ic">'+icon('cart',18)+'</span><h3>Yêu cầu mua hàng</h3>'+(pending.length?'<span class="pend-badge">'+pending.length+' chờ duyệt</span>':'')+'</div><div class="dbcard-b rq-body">'+body+'</div></div>';
}
function purResolve(maDon,approve){
  if(!approve && !confirm('Từ chối đơn mua hàng '+maDon+'?')) return;
  api('resolvePurchaseRequest',maDon,approve).then(function(){ toast(approve?'Đã duyệt đơn '+maDon:'Đã từ chối đơn '+maDon); renderAdmin(); refreshNotifCount_(); }).catch(function(e){ toast('Lỗi: '+e.message); });
}
function admReqCard_(reqs){
  reqs=reqs||[]; var pending=reqs.filter(function(r){return r.status==='pending';});
  var lbl={pending:'Chờ duyệt',approved:'Đã duyệt',rejected:'Từ chối'};
  var body= reqs.length? reqs.map(function(r){
    var meta=r.items.map(function(it){return '<span class="it">'+esc(it.ten||it.maSP)+'</span>';}).join('')
      +(r.status!=='pending'&&r.resolver?'<span class="rq-by">Xử lý bởi '+esc(r.resolver)+'</span>':'');
    return rqItem_({ cls:r.status, id:'drq-'+r.id, icon:icon('trash',16),
      title:'<b>'+esc(r.requester||'')+'</b> yêu cầu xóa '+r.items.length+' sản phẩm',
      meta:meta, badgeCls:r.status, badgeText:(lbl[r.status]||r.status),
      actions: r.status==='pending'?'<button class="btn blue xs" onclick="drqResolve('+r.id+',true)">Duyệt &amp; xóa</button><button class="btn ghost xs danger" onclick="drqResolve('+r.id+',false)">Từ chối</button>':'',
      time: fmtDateTime_(r.at) });
  }).join(''):'<div class="empty">Chưa có yêu cầu xóa nào.</div>';
  return '<div class="dbcard" id="drqCard"><div class="dbcard-h"><span class="dbcard-ic">'+icon('trash',18)+'</span><h3>Yêu cầu xóa sản phẩm</h3>'+(pending.length?'<span class="pend-badge">'+pending.length+' chờ duyệt</span>':'')+'</div><div class="dbcard-b rq-body">'+body+'</div></div>';
}
function drqResolve(id,approve){
  if(!approve && !confirm('Từ chối yêu cầu xóa này?')) return;
  api('resolveDeleteRequest',id,approve).then(function(r){
    toast(approve?('Đã duyệt & xóa '+(r.deleted||0)+' sản phẩm'):'Đã từ chối yêu cầu');
    renderAdmin(); refreshNotifCount_();
    if(approve){ api('getProducts').then(function(ps){ if(ps) S.products=ps; }).catch(function(){}); }
  }).catch(function(e){ toast('Lỗi: '+e.message); });
}
function admLogCard_(logs){
  var rows=logs.map(function(l){ return '<tr><td class="muted">'+fmtDateTime_(l.at)+'</td><td><b>'+esc(l.username||'')+'</b></td><td>'+esc(admActionLabel_(l.action))+'</td><td class="muted">'+esc(l.detail||'')+'</td></tr>'; }).join('');
  return dbCard_('Nhật ký hoạt động','list','', '<div class="tbl-wrap"><table class="admtbl"><tr><th style="width:170px">Thời gian</th><th>Người dùng</th><th>Hành động</th><th>Chi tiết</th></tr>'+(rows||'<tr><td colspan="4" class="muted">Chưa có</td></tr>')+'</table></div>');
}
function admCreate(){ admUserModal(null); }
function admEdit(id){ var u=(S._admUsers||[]).filter(function(x){return x.id===id;})[0]; if(u) admUserModal(u); }
function admUserModal(user){
  var isEdit=!!user; user=user||{role:'staff',perms:[]};
  var perms=user.perms||[];
  var has=function(k){ return perms.indexOf(k)>=0; };
  var permHtml=PERM_TABS.map(function(t){
    return '<label class="admck"><input type="checkbox" value="'+t[0]+'"'+(has(t[0])?' checked':'')
      +' onchange="admSubSync_()">'+esc(t[1])+'</label>'; }).join('');
  // Quyền trong tab Danh sách SP: CHỌN MỘT — chỉ sửa, hoặc sửa và duyệt
  var lv = has('sp_duyet')?'sp_duyet':(has('sp_edit')?'sp_edit':'');
  var spSub='<div class="admsub" id="am_spsub">'
    +'<div class="admsub-h">Trong tab Danh sách sản phẩm</div>'
    +'<label class="admrd"><input type="radio" name="am_splv" value=""'+(lv?'':' checked')+'>'
      +'<span><b>Không giới hạn</b><i>Sửa thẳng, không cần duyệt (mặc định như trước)</i></span></label>'
    +'<label class="admrd"><input type="radio" name="am_splv" value="sp_edit"'+(lv==='sp_edit'?' checked':'')+'>'
      +'<span><b>Chỉ được sửa</b><i>Sửa xong sản phẩm chuyển về “Chưa duyệt”</i></span></label>'
    +'<label class="admrd"><input type="radio" name="am_splv" value="sp_duyet"'+(lv==='sp_duyet'?' checked':'')+'>'
      +'<span><b>Được sửa và duyệt</b><i>Sửa thẳng và đánh dấu “Đã duyệt”</i></span></label>'
    +'</div>';
  var m=document.createElement('div'); m.className='amodal-ov'; m.id='admModal'; m.onclick=function(e){ if(e.target===m) admModalClose(); };
  m.innerHTML='<div class="amodal amodal-user">'
    +'<div class="amodal-hd"><div><h3>'+(isEdit?'Sửa tài khoản':'Thêm tài khoản')+'</h3>'
      +'<p>'+(isEdit?'Đổi họ tên, vai trò và quyền truy cập':'Tạo tài khoản mới cho công ty của bạn')+'</p></div>'
      +'<span class="amodal-x" onclick="admModalClose()">✕</span></div>'
    +'<div class="amodal-bd">'
      +'<div class="asec"><div class="asec-h">Thông tin đăng nhập</div>'
        +'<div class="agrid2">'
          +'<div class="afield"><label>Tên đăng nhập'+(isEdit?'':' <em>*</em>')+'</label>'
            +'<input id="am_user" '+(isEdit?'disabled':'')+' value="'+esc(user.username||'')+'" placeholder="vd: nguyenvana" autocomplete="off"></div>'
          +'<div class="afield"><label>Họ tên</label><input id="am_ht" value="'+esc(user.hoTen||'')+'" placeholder="Nguyễn Văn A"></div>'
        +'</div>'
        +'<div class="agrid2">'
          +'<div class="afield"><label>Phòng ban</label><input id="am_pb" value="'+esc(user.phongBan||'')+'" placeholder="vd: Kinh doanh, Thiết kế, Mua hàng"></div>'
          +(isEdit?'<div class="afield"></div>':'<div class="afield"><label>Mật khẩu <em>*</em></label><input id="am_pw" type="text" placeholder="Tối thiểu 4 ký tự" autocomplete="new-password"></div>')
        +'</div>'
        +(isSuper_()?(function(){
            // mặc định = công ty đang làm việc; super chỉ đổi khi muốn tạo cho công ty khác
            var mac = user.congTyId || (S.congTy&&S.congTy.id) || (S.me&&S.me.congTyId) || '';
            return '<div class="agrid2"><div class="afield"><label>Công ty</label>'
              +'<select id="am_ct">'
                +(S._admCt||[]).map(function(c){ return '<option value="'+esc(c.id)+'"'+(mac===c.id?' selected':'')+'>'+esc(c.ten||c.ma)+'</option>'; }).join('')
                +(mac?'':'<option value="" selected>— Chọn công ty —</option>')
              +'</select>'
              +(isEdit&&!user.congTyId
                 ?'<i class="afield-warn">Tài khoản này chưa thuộc công ty nào nên không đăng nhập được — chọn công ty rồi Lưu.</i>'
                 :'<i class="afield-hint">Mặc định là công ty bạn đang làm việc. Đổi nếu muốn tạo cho công ty khác.</i>')
            +'</div><div class="afield"></div></div>';
          })():'')
      +'</div>'
      +'<div class="asec"><div class="asec-h">Vai trò</div>'
        +'<div class="aseg" id="am_seg">'
          +'<label class="aseg-i"><input type="radio" name="am_role" value="staff"'+(user.role!=='admin'?' checked':'')+' onchange="admModalRole()">'
            +'<span><b>Nhân viên</b><i>Chỉ vào được các mục được cấp</i></span></label>'
          +'<label class="aseg-i"><input type="radio" name="am_role" value="admin"'+(user.role==='admin'?' checked':'')+' onchange="admModalRole()">'
            +'<span><b>Quản trị công ty</b><i>Toàn quyền trong công ty</i></span></label>'
        +'</div></div>'
      +'<div class="asec" id="am_permwrap"><div class="asec-h">Quyền truy cập'
        +'<span class="asec-n" id="am_permn"></span>'
        +'<span class="asec-quick"><a onclick="admPermAll(1)">Chọn tất cả</a><a onclick="admPermAll(0)">Bỏ hết</a></span></div>'
        +'<div class="admperms">'+permHtml+'</div>'+spSub
      +'</div>'
    +'</div>'
    +'<div class="amodal-ft"><button class="btn ghost" onclick="admModalClose()">Huỷ</button>'
      +'<button class="btn blue" id="am_save" onclick="admModalSave('+(isEdit?'\''+user.id+'\'':'null')+')">'
      +(isEdit?icon('check',15)+' Lưu thay đổi':icon('plus',15)+' Tạo tài khoản')+'</button></div>'
    +'</div>';
  document.body.appendChild(m); admModalRole(); admSubSync_();
}
// Ẩn khối quyền khi chọn Quản trị công ty (đã toàn quyền)
function admModalRole(){
  var r=document.querySelector('#am_seg input:checked'); var pw=document.getElementById('am_permwrap');
  if(r&&pw) pw.style.display = r.value==='admin'?'none':'';
  document.querySelectorAll('#am_seg .aseg-i').forEach(function(l){ l.classList.toggle('on', l.querySelector('input').checked); });
}
// Khối quyền con chỉ hiện khi đã cấp tab Danh sách sản phẩm
function admSubSync_(){
  var sp=document.querySelector('#am_permwrap input[type=checkbox][value=sanpham]');
  var sub=document.getElementById('am_spsub'); if(sub) sub.style.display=(sp&&sp.checked)?'':'none';
  var n=document.querySelectorAll('#am_permwrap input[type=checkbox]:checked').length;
  var tot=document.querySelectorAll('#am_permwrap input[type=checkbox]').length;
  var lb=document.getElementById('am_permn'); if(lb) lb.textContent=n+'/'+tot;
  document.querySelectorAll('#am_permwrap .admck').forEach(function(l){ l.classList.toggle('on', l.querySelector('input').checked); });
  document.querySelectorAll('#am_spsub .admrd').forEach(function(l){ l.classList.toggle('on', l.querySelector('input').checked); });
}
function admPermAll(on){
  document.querySelectorAll('#am_permwrap input[type=checkbox]').forEach(function(c){ c.checked=!!on; });
  admSubSync_();
}
document.addEventListener('change',function(e){ if(e.target.name==='am_splv') admSubSync_(); });
function admModalClose(){ var m=document.getElementById('admModal'); if(m)m.remove(); }
function admModalSave(id){
  var role=(document.querySelector('#am_seg input:checked')||{}).value||'staff';
  // quyền = các tab được tích + mức quyền trong tab Danh sách SP (radio, có thể bỏ trống)
  var perms=[];
  if(role!=='admin'){
    perms=[].slice.call(document.querySelectorAll('#am_permwrap input[type=checkbox]:checked')).map(function(c){return c.value;});
    var lv=document.querySelector('#am_spsub input[name=am_splv]:checked');
    if(lv && lv.value && perms.indexOf('sanpham')>=0) perms.push(lv.value);
  }
  var hoTen=document.getElementById('am_ht').value;
  var phongBan=(document.getElementById('am_pb')||{}).value||'';   // dùng cho báo cáo nhập SP gửi Lark
  var btn=document.getElementById('am_save'); btn.disabled=true;
  var done=function(msg){ toast(msg); admModalClose(); renderAdmin(); };
  var fail=function(e){ toast('Lỗi: '+e.message); btn.disabled=false; };
  var ctEl=document.getElementById('am_ct'), ctId=ctEl?ctEl.value:'';
  if(id){ var patch={hoTen:hoTen,role:role,perms:perms,phongBan:phongBan};
    if(ctEl) patch.congTyId=ctId;
    api('adminUpdateUser',id,patch).then(function(){ done('Đã cập nhật'); }).catch(fail); }
  else { var username=document.getElementById('am_user').value; var pw=document.getElementById('am_pw').value;
    api('adminCreateUser',{username:username,hoTen:hoTen,role:role,password:pw,perms:perms,phongBan:phongBan,congTyId:ctId||undefined})
      .then(function(){ done('Đã tạo tài khoản'); }).catch(fail); }
}
async function admResetPw(id){
  var np=await askInput_({title:'Đặt lại mật khẩu', label:'Mật khẩu mới (≥4 ký tự)', type:'password', confirmText:'Đặt lại'});
  if(!np) return; if(String(np).length<4){ toast('Mật khẩu phải từ 4 ký tự'); return; }
  api('adminSetPassword',id,np).then(function(){ toast('Đã đặt lại mật khẩu'); }).catch(function(e){ toast('Lỗi: '+e.message); }); }
function admToggleActive(id,active){ api('adminSetActive',id,active).then(function(){ toast(active?'Đã mở khóa':'Đã khóa'); renderAdmin(); }).catch(function(e){ toast('Lỗi: '+e.message); }); }
function admDelete(id){ var u=(S._admUsers||[]).filter(function(x){return x.id===id;})[0]; if(!confirm('Xóa tài khoản "'+(u?u.username:'')+'"? Không thể hoàn tác.')) return; api('adminDeleteUser',id).then(function(){ toast('Đã xóa'); renderAdmin(); }).catch(function(e){ toast('Lỗi: '+e.message); }); }

/* ===== GO ===== */
initCols();
initTableInteractions();
catSplitInit_();
authStart_();

/* ═══════════════════════════════════════════════════════════════════════════
   BẢNG BÓC TÁCH / CHI PHÍ — thao tác kiểu Excel
   · chọn nhiều dòng (ô tích ở cột STT, giữ Shift để chọn cả vùng)
   · chọn vùng ô rồi Ctrl+C / Ctrl+V / Delete
   · cố định hàng (ngoài cố định cột đã có)
   · thu gọn khối đầu bảng để màn hình rộng hơn
   ═════════════════════════════════════════════════════════════════════════ */
function tdK_(html,k){ return html.replace('<td','<td data-k="'+k+'"'); }
function lineOf_(id){ return (S.lines||[]).filter(function(x){ return x.lineId===id; })[0]; }

/* ---------- chọn nhiều dòng ---------- */
function tkSelHas_(id){ return !!(S._tkSel && S._tkSel[id]); }
function tkSelIds_(){ return Object.keys(S._tkSel||{}); }
function tkSelLines_(){ return tkSelIds_().map(lineOf_).filter(Boolean); }
function tkRowIdsOnScreen_(){ return [].map.call(document.querySelectorAll('#tkTable tr.drow'),function(tr){ return tr.dataset.id; }); }
function tkSelPrune_(){
  if(!S._tkSel) return; var on={}; tkRowIdsOnScreen_().forEach(function(id){ on[id]=1; });
  Object.keys(S._tkSel).forEach(function(id){ if(!on[id]) delete S._tkSel[id]; });
}
function tkSelClick_(e,id){
  if(e&&e.stopPropagation) e.stopPropagation();
  S._tkSel=S._tkSel||{};
  var ids=tkRowIdsOnScreen_(), i=ids.indexOf(id);
  if(e&&e.shiftKey && S._tkAnchor!=null){                 // Shift = chọn cả vùng từ dòng neo
    var a=ids.indexOf(S._tkAnchor); if(a<0) a=i;
    var lo=Math.min(a,i), hi=Math.max(a,i);
    for(var x=lo;x<=hi;x++) S._tkSel[ids[x]]=1;
  } else {
    if(S._tkSel[id]) delete S._tkSel[id]; else S._tkSel[id]=1;
    S._tkAnchor=id;
  }
  renderTable();
}
function tkClearSel(){ S._tkSel={}; S._tkAnchor=null; renderTable(); }
function tkSelAllVisible_(){ S._tkSel=S._tkSel||{}; tkRowIdsOnScreen_().forEach(function(id){ S._tkSel[id]=1; }); renderTable(); }
function tkSelFloor_(g){ S._tkSel=S._tkSel||{};
  (S.lines||[]).forEach(function(l){ var t=(l.tang||'').trim()||'CHƯA PHÂN TẦNG';
    if(t===g && (l.nhom===S.node||String(l.nhom||'').indexOf(S.node+'.')===0)) S._tkSel[l.lineId]=1; });
  renderTable();
}

/* ---------- ghi giá trị vào 1 ô theo khoá cột ---------- */
function tkNum_(v){ var t=String(v==null?'':v).replace(/[^\d,.\-]/g,'');
  if(/,\d{1,2}$/.test(t)&&t.indexOf('.')>=0) t=t.replace(/\./g,'').replace(',','.');    // 1.234,5
  else if((t.match(/\./g)||[]).length>1) t=t.replace(/\./g,'');                          // 1.234.000
  else if(/\.\d{3}$/.test(t)) t=t.replace(/\./g,'');
  t=t.replace(',','.');
  var n=parseFloat(t); return isNaN(n)?0:n; }
var TK_RO_COL={stt:1,hinhAnh:1,nganh:1,giaDaiLy:1,donGiaCK:1,thanhTien:1};
// Trả về {fields} để cập nhật dòng l khi đặt giá trị raw vào cột k (null = cột chỉ đọc)
function tkFieldsFor_(l,k,raw){
  if(TK_RO_COL[k]) return null;
  if(k==='moTa'||k==='kichThuoc') { var o={}; o[k]=String(raw==null?'':raw); return o; }
  if(TXT_COL[k]){ var o2={}; o2[TXT_COL[k]]=String(raw==null?'':raw); return o2; }
  if(NUM_COL[k]){ var o3={}; o3[NUM_COL[k]]=tkNum_(raw); return o3; }
  if(k==='markup'||k==='margin'||k==='lnVnd'){
    var von=giaDaiLy_(l), sl=Number(l.soLuong)||0, ckK=(Number(l.ckKhach)||0)/100, v=tkNum_(raw);
    if(!von||ckK>=1) return null;
    var dgCK;
    if(k==='markup') dgCK=von*(1+v/100);
    else if(k==='margin'){ if(v>=100) return null; dgCK=von/(1-v/100); }
    else { if(!sl) return null; dgCK=von+v/sl; }
    return {donGiaBan:Math.max(0,Math.round(dgCK/(1-ckK)))};
  }
  return null;
}
// Áp 1 loạt thay đổi: cập nhật tại chỗ + vẽ lại 1 lần, rồi đồng bộ server theo lô
async function tkApplyEdits_(edits, nhan){
  var byId={}; edits.forEach(function(e){ if(!e||!e.fields) return; byId[e.id]=Object.assign(byId[e.id]||{},e.fields); });
  var ids=Object.keys(byId); if(!ids.length){ toast('Không có ô nào sửa được'); return 0; }
  // dán/điền vùng rất lớn: hỏi lại vì mỗi dòng là một lần ghi lên máy chủ
  if(ids.length>60 && !confirm('Thao tác này sửa '+ids.length+' dòng. Tiếp tục?')) return 0;
  ids.forEach(function(id){ var l=lineOf_(id); if(!l) return;
    Object.keys(byId[id]).forEach(function(k){ l[k]=byId[id][k]; }); recalcLine_(l,byId[id]); });
  renderTable(); renderCard();
  if(document.getElementById('v-chiphi').classList.contains('on')) renderChiphi();
  if(document.getElementById('v-duan').classList.contains('on')) renderDuAn();
  if(bgVis()) drawBaogia();
  var loi=0;
  for(var i=0;i<ids.length;i+=6){
    await Promise.all(ids.slice(i,i+6).map(function(id){
      return api('updateLine',id,byId[id]).catch(function(){ loi++; }); }));
  }
  toast((nhan||'Đã cập nhật')+' · '+ids.length+' dòng'+(loi?(' · '+loi+' dòng lỗi'):''));
  return ids.length;
}

/* ---------- thanh thao tác hàng loạt của bảng bóc tách ---------- */
function tkBulkWrap_(){ var w=document.getElementById('tkBulkWrap');
  if(!w){ w=document.createElement('div'); w.id='tkBulkWrap'; document.body.appendChild(w); } return w; }
function tkSelBar_(){
  var w=tkBulkWrap_(), n=tkSelIds_().length;
  if(!n || !bocVisible_()){ w.innerHTML=''; tkPopClose_(); return; }
  var tien=tkSelLines_().reduce(function(s,l){ return s+(Number(l.thanhTienBan)||0); },0);
  w.innerHTML='<div class="bbar" id="tkBulkBar">'
    +'<div class="bb-count"><b>'+n+'</b><span>dòng đã chọn · '+money(tien)+' đ</span>'
      +'<button class="bb-x" title="Bỏ chọn (Esc)" onclick="tkClearSel()">✕</button></div>'
    +'<div class="bb-sep"></div>'
    +'<button class="bb-b" id="tkbFloorBtn" onclick="tkBulkFloorPop_(event)" title="Chuyển các dòng đã chọn sang tầng khác">'
      +icon('layers',15)+' Chuyển tầng <i class="bb-car">▾</i></button>'
    +'<button class="bb-b" id="tkbLnBtn" onclick="tkBulkLnPop_(event)" title="Đặt nhanh % lợi nhuận">'
      +icon('gauge',15)+' Lợi nhuận <i class="bb-car">▾</i></button>'
    +'<button class="bb-b" id="tkbEditBtn" onclick="tkBulkEditPop_(event)" title="Đổi một cột cho mọi dòng đã chọn">'
      +icon('edit',15)+' Sửa hàng loạt <i class="bb-car">▾</i></button>'
    +'<div class="bb-sep"></div>'
    +'<button class="bb-ic" id="tkbMoreBtn" onclick="tkBulkMorePop_(event)" title="Thao tác khác">⋯</button>'
  +'</div>';
}
function tkPopClose_(){ ['tkbFloorPop','tkbLnPop','tkbEditPop','tkbMorePop'].forEach(function(id){
    var e=document.getElementById(id); if(e) e.remove(); });
  document.removeEventListener('mousedown',tkPopOutside_); }
function tkPopOutside_(e){
  if(e.target.closest('.bb-pop')||e.target.closest('#tkBulkBar')) return; tkPopClose_(); }
function tkPopPlace_(pop,btnId){
  var b=document.getElementById(btnId); if(!b) return;
  var r=b.getBoundingClientRect(), w=pop.offsetWidth||280;
  pop.style.left=Math.max(10,Math.min(r.left+r.width/2-w/2, window.innerWidth-w-10))+'px';
  pop.style.top=Math.max(10,r.top-pop.offsetHeight-10)+'px';
}
function tkPopOpen_(id,btnId,html,cls){
  if(document.getElementById(id)){ tkPopClose_(); return null; }
  tkPopClose_();
  var pop=document.createElement('div'); pop.className='bb-pop '+(cls||''); pop.id=id; pop.innerHTML=html;
  document.body.appendChild(pop); tkPopPlace_(pop,btnId);
  setTimeout(function(){ document.addEventListener('mousedown',tkPopOutside_); },0);
  return pop;
}
function tkBulkFloorPop_(e){ if(e&&e.stopPropagation) e.stopPropagation();
  var fl=floorsList().filter(function(f){ return f!=='CHƯA PHÂN TẦNG'; });
  var html='<div class="bb-pop-h">Chuyển sang tầng <span>'+tkSelIds_().length+' dòng</span></div>'
    +'<div class="bb-menu" style="max-height:260px;overflow:auto">'
    +(fl.length?fl.map(function(f){ return '<button onclick="tkBulkFloor_(\''+esc(f).replace(/'/g,"\\'")+'\')">'+icon('layers',15)+esc(f)+'</button>'; }).join('')
               :'<div style="padding:10px 12px;font-size:12px;color:var(--c3)">Chưa có tầng nào. Bấm “＋ Thêm tầng” ở cuối bảng.</div>')
    +'<div class="bb-menu-sep"></div><button onclick="tkBulkFloor_(\'\')">'+icon('close',15)+'Bỏ tầng (chưa phân tầng)</button></div>';
  tkPopOpen_('tkbFloorPop','tkbFloorBtn',html);
}
function tkBulkFloor_(tang){ tkPopClose_();
  tkApplyEdits_(tkSelLines_().map(function(l){ return {id:l.lineId, fields:{tang:tang}}; }),
    tang?('Đã chuyển sang '+tang):'Đã bỏ tầng'); }
var TK_LN_QUICK=[5,10,15,20,30,35,40,45];
function tkBulkLnPop_(e){ if(e&&e.stopPropagation) e.stopPropagation();
  var html='<div class="bb-pop-h">Đặt nhanh lợi nhuận <span>'+tkSelIds_().length+' dòng</span></div>'
    +'<div class="bb-pop-b"><label>% lợi nhuận trên giá vốn</label>'
      +'<div class="lnq">'+TK_LN_QUICK.map(function(v){ return '<button onclick="tkBulkLn_('+v+')">'+v+'%</button>'; }).join('')+'</div>'
      +'<label>Hoặc nhập % khác</label>'
      +'<input id="tkbLnVal" type="number" step="any" placeholder="VD: 27" onkeydown="if(event.key===\'Enter\')tkBulkLn_(this.value)">'
    +'</div>'
    +'<div class="bb-pop-f"><button class="btn ghost sm" onclick="tkPopClose_()">Huỷ</button>'
      +'<button class="btn blue sm" onclick="tkBulkLn_((document.getElementById(\'tkbLnVal\')||{}).value)">'+icon('check',14)+' Áp dụng</button></div>';
  tkPopOpen_('tkbLnPop','tkbLnBtn',html);
}
function tkBulkLn_(v){ v=Number(String(v==null?'':v).replace(',','.'));
  if(!isFinite(v)){ toast('Chưa nhập % lợi nhuận'); return; }
  tkPopClose_();
  tkApplyEdits_(tkSelLines_().map(function(l){ return {id:l.lineId, fields:{lnPct:v}}; }), 'Đã đặt lợi nhuận '+v+'%');
}
function tkBulkEditFields_(){
  return COLS.filter(function(c){ return !TK_RO_COL[c[0]]; }).map(function(c){ return [c[0],c[1]]; })
    .concat([['tang','Tầng / khu vực']]);
}
function tkBulkEditPop_(e){ if(e&&e.stopPropagation) e.stopPropagation();
  var F=tkBulkEditFields_();
  var html='<div class="bb-pop-h">Sửa hàng loạt <span>'+tkSelIds_().length+' dòng</span></div>'
    +'<div class="bb-pop-b"><label>Cột cần đổi</label>'
      +'<select id="tkbField">'+F.map(function(f){ return '<option value="'+esc(f[0])+'">'+esc(f[1])+'</option>'; }).join('')+'</select>'
      +'<label>Giá trị mới</label>'
      +'<input id="tkbValue" placeholder="Nhập giá trị…" onkeydown="if(event.key===\'Enter\')tkBulkEditRun_()">'
    +'</div>'
    +'<div class="bb-pop-f"><button class="btn ghost sm" onclick="tkPopClose_()">Huỷ</button>'
      +'<button class="btn blue sm" onclick="tkBulkEditRun_()">'+icon('check',14)+' Áp dụng</button></div>';
  var pop=tkPopOpen_('tkbEditPop','tkbEditBtn',html);
  if(pop) setTimeout(function(){ var v=document.getElementById('tkbValue'); if(v) v.focus(); },0);
}
function tkBulkEditRun_(){
  var f=document.getElementById('tkbField'), v=document.getElementById('tkbValue'); if(!f||!v) return;
  var k=f.value, val=v.value, nhan=f.options[f.selectedIndex].text;
  if(String(val).trim()===''&&k!=='ghiChu'&&k!=='tang'){ toast('Chưa nhập giá trị mới'); v.focus(); return; }
  tkPopClose_();
  var edits=tkSelLines_().map(function(l){
    if(k==='tang') return {id:l.lineId, fields:{tang:String(val)}};
    var fl=tkFieldsFor_(l,k,val); return fl?{id:l.lineId, fields:fl}:null; }).filter(Boolean);
  tkApplyEdits_(edits,'Đã đặt “'+nhan+'”');
}
function tkBulkMorePop_(e){ if(e&&e.stopPropagation) e.stopPropagation();
  var n=tkSelIds_().length;
  var html=(tkSheetCo_()
      ? '<button onclick="tkPopClose_();tkBulkSheet_(\'nc\')">'+icon('layers',15)+' Đưa vào sheet Nhân công</button>'
        +'<button onclick="tkPopClose_();tkBulkSheet_(\'vt\')">'+icon('layers',15)+' Đưa vào sheet Vật tư</button>'
        +'<button onclick="tkPopClose_();tkBulkSheet_(\'\')">'+icon('close',15)+' Bỏ khỏi sheet (để chung)</button>'
        +'<div class="bb-menu-sep"></div>'
      : '')
    +'<button onclick="tkPopClose_();tkBulkCopy_()">'+icon('copy',15)+' Sao chép '+n+' dòng (dán được vào Excel)</button>'
    +'<button onclick="tkPopClose_();tkBulkDup_()">'+icon('plus',15)+' Nhân bản '+n+' dòng</button>'
    +'<button onclick="tkPopClose_();tkSelAllVisible_()">'+icon('list',15)+' Chọn tất cả dòng đang hiện</button>'
    +'<div class="bb-menu-sep"></div>'
    +'<button class="danger" onclick="tkPopClose_();tkBulkDel_()">'+icon('trash',15)+' Xoá '+n+' dòng</button>';
  tkPopOpen_('tkbMorePop','tkbMoreBtn',html,'bb-menu');
}
function tkBulkCopy_(){
  var cols=visCols();
  var head=cols.map(function(c){ return c[1]; }).join('\t');
  var rows=tkSelLines_().map(function(l){ return cols.map(function(c){
    if(c[0]==='stt') return '';
    return String(colPlain(l,c[0])==null?'':colPlain(l,c[0])); }).join('\t'); });
  ctxCopy_([head].concat(rows).join('\n'));
  toast('Đã sao chép '+rows.length+' dòng');
}
async function tkBulkDup_(){
  var ls=tkSelLines_(); if(!ls.length||!S.cur) return;
  if(!confirm('Nhân bản '+ls.length+' dòng đã chọn?')) return;
  var loi=0;
  for(var i=0;i<ls.length;i++){
    var prod=Object.assign({},ls[i]); delete prod.lineId; delete prod.recordId;
    try{ var nl=await api('addLine', S.cur.maDA, prod, Number(ls[i].soLuong)||1); S.lines.push(nl); }
    catch(e){ loi++; }
  }
  tkClearSel(); renderTable(); renderCard();
  toast('Đã nhân bản '+(ls.length-loi)+' dòng'+(loi?(' · '+loi+' lỗi'):''));
}
async function tkBulkDel_(){
  var ids=tkSelIds_(); if(!ids.length) return;
  if(!confirm('Xoá '+ids.length+' dòng đã chọn? Không hoàn tác được.')) return;
  var loi=0;
  for(var i=0;i<ids.length;i+=5){
    await Promise.all(ids.slice(i,i+5).map(function(id){
      return api('deleteLine',id).catch(function(){ loi++; }); }));
  }
  S.lines=S.lines.filter(function(l){ return ids.indexOf(l.lineId)<0; });
  S._tkSel={}; renderTable(); renderCard(); renderActGutter&&renderActGutter();
  toast('Đã xoá '+(ids.length-loi)+' dòng'+(loi?(' · '+loi+' lỗi'):''));
}

/* ---------- cố định hàng (như Excel) ---------- */
function tkFreezeRowTo(lineId){
  var ids=tkRowIdsOnScreen_(), i=ids.indexOf(lineId);
  S.frzRows = i>=0 ? i+1 : 0; closePop(); renderTable();
  toast(S.frzRows?('Đã cố định '+S.frzRows+' hàng đầu'):'Đã bỏ cố định hàng');
}
function tkUnfreezeRows(){ S.frzRows=0; closePop(); renderTable(); toast('Đã bỏ cố định hàng'); }
function tkFreezeRows_(){
  var t=document.getElementById('tkTable'); if(!t) return;
  t.querySelectorAll('tr.frzrow').forEach(function(tr){ tr.classList.remove('frzrow');
    tr.querySelectorAll('td').forEach(function(td){ td.style.position=''; td.style.top=''; td.style.zIndex=''; }); });
  var n=Math.min(Number(S.frzRows)||0, 12); if(!n) return;
  var headH=(t.rows[0]||{}).offsetHeight||46, off=headH;
  var rows=t.querySelectorAll('tr.drow');
  for(var i=0;i<n && i<rows.length;i++){
    var tr=rows[i]; tr.classList.add('frzrow');
    var top=off;
    tr.querySelectorAll('td').forEach(function(td){
      td.style.position='sticky'; td.style.top=top+'px'; td.style.zIndex='3'; });
    off+=tr.offsetHeight;
  }
}

/* ---------- thu gọn khối đầu bảng ---------- */
function tkZenGet_(){ try{ return localStorage.getItem('qs_tkzen')==='1'; }catch(e){ return false; } }
function tkZenToggle(){ foldAll_(); }
/* ═══ THU GỌN TỪNG KHỐI ĐỂ MỞ RỘNG BẢNG ═══
   Khối nào phía trên bảng cũng gập được: băng dự án · tổng tiền · chip cột. Nhớ theo máy (qs_fold).
   Nút ⤢ "Mở rộng bảng" (thanh công cụ nhanh / đầu bảng) gập tất cả một lần; bấm lại mở lại như trước. */
var FOLD_KEYS=['pcard','totals','cols'];
function foldGet_(){ try{ var v=JSON.parse(localStorage.getItem('qs_fold')||'null'); if(v&&typeof v==='object') return v; }catch(e){}
  return {cols:true};                                    // mặc định: chip cột gọn 1 dòng (bấm mới bung)
}
function foldSet_(v){ try{ localStorage.setItem('qs_fold', JSON.stringify(v)); }catch(e){} foldApply_(); }
function foldToggle_(k){ var v=foldGet_(); v[k]=!v[k]; delete v._all; foldSet_(v); }
function foldAllOn_(){ var v=foldGet_(); return FOLD_KEYS.every(function(k){ return v[k]; }); }
function foldAll_(){
  var v=foldGet_();
  if(foldAllOn_()){ var truoc=v._truoc||{}; v={}; FOLD_KEYS.forEach(function(k){ v[k]=!!truoc[k]; }); if(!FOLD_KEYS.some(function(k){ return v[k]; })) v={cols:true}; }
  else { var tr={}; FOLD_KEYS.forEach(function(k){ tr[k]=!!v[k]; }); v={_truoc:tr}; FOLD_KEYS.forEach(function(k){ v[k]=true; }); }
  foldSet_(v);
  toast(foldAllOn_()?'Đã thu gọn đầu trang — bảng rộng hơn':'Đã mở lại các khối đầu trang');
}
function foldApply_(){
  var v=foldGet_(), b=document.body; if(!b) return;
  FOLD_KEYS.forEach(function(k){ b.classList.toggle('fold-'+k, !!v[k]); });
  var z=document.getElementById('tkZenBtn'), all=foldAllOn_();
  if(z){ z.classList.toggle('on',all); z.title=all?'Mở lại các khối đầu trang':'Thu gọn đầu trang cho bảng rộng hơn'; }
  if(typeof qbRightSync_==='function') qbRightSync_();
  setTimeout(function(){ try{ tkHBarSync_&&tkHBarSync_(); syncActGutter&&syncActGutter(); }catch(e){} },30);
}
function tkZenApply_(){
  foldApply_();                                          // cơ chế cũ (qs_tkzen) thay bằng gập từng khối
  var on=false, p=document.querySelector('.tk-panel'); if(!p) return;
  p.classList.toggle('zen',on);
  var b=document.getElementById('tkZenBtn');
  if(b){ b.classList.toggle('on',on); b.title=on?'Mở lại khối tổng tiền & chip cột':'Thu gọn khối đầu bảng cho màn hình rộng hơn'; }
  setTimeout(function(){ tkHBarSync_&&tkHBarSync_(); syncActGutter&&syncActGutter(); },30);
}

/* ---------- chọn vùng ô + Ctrl+C / Ctrl+V / Delete ---------- */
function rngTables_(){ return ['#tkTable','#v-chiphi table.cpflat','#v-duan table.cpflat']; }
function rngTblOf_(el){ if(!el||!el.closest) return null;
  return el.closest('#tkTable') || el.closest('#v-chiphi table.cpflat') || el.closest('#v-duan table.cpflat'); }
function rngRows_(tbl){ return [].slice.call(tbl.querySelectorAll('tr.drow')); }
function rngPos_(td){
  var tbl=rngTblOf_(td); if(!tbl) return null;
  var tr=td.parentNode; if(!tr||!tr.classList.contains('drow')) return null;
  var r=rngRows_(tbl).indexOf(tr), c=[].indexOf.call(tr.children,td);
  return (r<0||c<0)?null:{tbl:tbl,r:r,c:c};
}
function rngClear_(){
  document.querySelectorAll('td.rsel').forEach(function(td){ td.classList.remove('rsel','rsel-a'); });
  S._rng=null; rngBadge_();
}
function rngPaint_(){
  document.querySelectorAll('td.rsel').forEach(function(td){ td.classList.remove('rsel','rsel-a'); });
  var g=S._rng; if(!g||!g.tbl||!document.body.contains(g.tbl)){ rngBadge_(); return; }
  var rows=rngRows_(g.tbl), r1=Math.min(g.r1,g.r2), r2=Math.max(g.r1,g.r2),
      c1=Math.min(g.c1,g.c2), c2=Math.max(g.c1,g.c2);
  for(var r=r1;r<=r2;r++){ var tr=rows[r]; if(!tr) continue;
    for(var c=c1;c<=c2;c++){ var td=tr.children[c]; if(td){ td.classList.add('rsel');
      if(r===g.r1&&c===g.c1) td.classList.add('rsel-a'); } } }
  rngBadge_();
}
function rngCells_(){
  var g=S._rng; if(!g||!g.tbl||!document.body.contains(g.tbl)) return [];
  var rows=rngRows_(g.tbl), out=[];
  var r1=Math.min(g.r1,g.r2), r2=Math.max(g.r1,g.r2), c1=Math.min(g.c1,g.c2), c2=Math.max(g.c1,g.c2);
  for(var r=r1;r<=r2;r++){ var tr=rows[r]; if(!tr) continue; var line=[];
    for(var c=c1;c<=c2;c++){ var td=tr.children[c];
      line.push(td?{td:td, id:tr.dataset.id, k:td.getAttribute('data-k')||''}:null); }
    out.push(line); }
  return out;
}
function rngCount_(){ var g=S._rng; if(!g) return 0;
  return (Math.abs(g.r2-g.r1)+1)*(Math.abs(g.c2-g.c1)+1); }
function rngText_(td){
  var i=td.querySelector('input,textarea');
  if(i) return String(i.value==null?'':i.value);
  return String(td.textContent||'').trim();
}
function rngBadge_(){
  var b=document.getElementById('rngBadge'), n=rngCount_();
  if(n<2){ if(b) b.remove(); return; }
  if(!b){ b=document.createElement('div'); b.id='rngBadge'; b.className='rng-badge'; document.body.appendChild(b); }
  var cells=rngCells_(), sum=0, so=0;
  cells.forEach(function(row){ row.forEach(function(c){ if(!c) return; var v=tkNum_(rngText_(c.td));
    if(v){ sum+=v; so++; } }); });
  b.innerHTML='<b>'+n+'</b> ô đã chọn'+(so?('<i>Tổng '+money(sum)+' · TB '+money(sum/so)+'</i>'):'')
    +'<span>Ctrl+C sao chép · Ctrl+V dán · Delete xoá</span>';
}
function rngInit_(){
  if(S._rngInit) return; S._rngInit=1;
  document.addEventListener('mousedown',function(e){
    if(e.target.closest&&e.target.closest('input.tkck')) return;   // đang tick chọn dòng
    var td=e.target.closest?e.target.closest('td'):null;
    var pos=td?rngPos_(td):null;
    if(!pos){ if(!e.target.closest||!e.target.closest('.rng-badge')) rngClear_(); return; }
    if(e.shiftKey && S._rng && S._rng.tbl===pos.tbl){
      e.preventDefault();
      S._rng.r2=pos.r; S._rng.c2=pos.c; rngPaint_();
      var a=document.activeElement; if(a&&a.blur) a.blur();
      return;
    }
    S._rng={tbl:pos.tbl, r1:pos.r, c1:pos.c, r2:pos.r, c2:pos.c}; rngPaint_();
  });
  document.addEventListener('copy',function(e){
    if(rngCount_()<2) return;
    var a=document.activeElement; if(a&&(a.tagName==='INPUT'||a.tagName==='TEXTAREA')&&a.selectionStart!==a.selectionEnd) return;
    var txt=rngCells_().map(function(row){ return row.map(function(c){ return c?rngText_(c.td):''; }).join('\t'); }).join('\n');
    if(e.clipboardData){ e.clipboardData.setData('text/plain',txt); e.preventDefault(); toast('Đã sao chép '+rngCount_()+' ô'); }
  });
  document.addEventListener('paste',function(e){
    if(!S._rng) return;
    var a=document.activeElement;
    if(a&&(a.tagName==='INPUT'||a.tagName==='TEXTAREA')&&rngCount_()<2) return;   // 1 ô đang gõ -> để trình duyệt dán như thường
    var txt=(e.clipboardData||window.clipboardData).getData('text'); if(!txt) return;
    e.preventDefault(); rngPasteText_(txt);
  });
  document.addEventListener('keydown',function(e){
    if(e.key!=='Delete'&&e.key!=='Backspace') return;
    if(rngCount_()<2) return;
    var a=document.activeElement; if(a&&(a.tagName==='INPUT'||a.tagName==='TEXTAREA')) return;
    e.preventDefault(); rngFill_('');
  });
  document.addEventListener('keydown',function(e){
    if(e.key==='Escape'){ if(rngCount_()>1) rngClear_();
      else if(tkSelIds_().length && document.getElementById('tkBulkBar')){ tkPopClose_(); tkClearSel(); } }
  });
}
function rngPasteText_(txt){
  var grid=String(txt).replace(/\r/g,'').replace(/\n$/,'').split('\n').map(function(r){ return r.split('\t'); });
  var cells=rngCells_(); if(!cells.length) return;
  if(grid.length===1&&grid[0].length===1){ rngFill_(grid[0][0]); return; }
  var g=S._rng, rows=rngRows_(g.tbl);
  var r0=Math.min(g.r1,g.r2), c0=Math.min(g.c1,g.c2);
  var edits=[];
  grid.forEach(function(line,ri){ var tr=rows[r0+ri]; if(!tr) return; var l=lineOf_(tr.dataset.id); if(!l) return;
    line.forEach(function(v,ci){ var td=tr.children[c0+ci]; if(!td) return;
      var k=td.getAttribute('data-k'); if(!k) return;
      var f=tkFieldsFor_(l,k,v); if(f) edits.push({id:l.lineId, fields:f}); }); });
  if(!edits.length){ toast('Vùng dán không có ô nào sửa được'); return; }
  tkApplyEdits_(edits,'Đã dán '+edits.length+' ô vào');
}
function rngFill_(val){
  var cells=rngCells_(), edits=[];
  cells.forEach(function(row){ row.forEach(function(c){ if(!c||!c.k) return;
    var l=lineOf_(c.id); if(!l) return; var f=tkFieldsFor_(l,c.k,val); if(f) edits.push({id:l.lineId, fields:f}); }); });
  if(!edits.length){ toast('Vùng chọn không có ô nào sửa được'); return; }
  tkApplyEdits_(edits, val===''?'Đã xoá nội dung':'Đã điền “'+String(val).slice(0,24)+'”');
}

/* ===== Chi phí: chọn nhanh % lợi nhuận ===== */
// Chỉ hiện hàng đặt hàng loạt khi đang CHỌN nhiều dòng/ô — còn bình thường thì chọn ngay tại ô %
function cpLnBulkHien_(){
  var g=S._rng;
  if(g&&g.tbl&&document.body.contains(g.tbl)&&g.tbl.closest('#v-chiphi')&&(Math.abs(g.r2-g.r1)+1)>1) return true;
  return tkSelLines_().length>0;
}
function cpLnQuick_(){
  return '<div class="cp-lnq"><span class="lb">'+icon('gauge',13)+' Đặt nhanh lợi nhuận</span>'
    +'<div class="lnq">'+TK_LN_QUICK.map(function(v){
        return '<button onclick="cpQuickLn_('+v+')" title="Đặt lợi nhuận '+v+'% trên giá vốn">'+v+'%</button>'; }).join('')
      +'<button class="khac" onclick="cpQuickLnAsk_()" title="Nhập % khác">Khác…</button></div>'
    +'<span class="sc" id="cpLnScope">'+esc(cpLnScopeLbl_())+'</span></div>';
}
// Phạm vi áp dụng: vùng ô đang chọn > dòng đang tick ở Bóc tách > toàn bộ bảng
function cpLnRows_(){
  var g=S._rng;
  if(g&&g.tbl&&document.body.contains(g.tbl)&&g.tbl.closest('#v-chiphi')){
    var rows=rngRows_(g.tbl), r1=Math.min(g.r1,g.r2), r2=Math.max(g.r1,g.r2), out=[];
    for(var r=r1;r<=r2;r++){ var tr=rows[r]; if(tr){ var l=lineOf_(tr.dataset.id); if(l) out.push(l); } }
    if(out.length) return out;
  }
  var sel=tkSelLines_(); if(sel.length) return sel;
  return cpRows_();                                   // đang lọc/tìm thì chỉ áp cho các dòng đang hiện
}
function cpLnScopeLbl_(){
  var g=S._rng, n;
  if(g&&g.tbl&&document.body.contains(g.tbl)&&g.tbl.closest('#v-chiphi')) return 'áp cho '+(Math.abs(g.r2-g.r1)+1)+' dòng đang chọn';
  n=tkSelLines_().length; if(n) return 'áp cho '+n+' dòng đã tick bên Bóc tách';
  var r=cpRows_().length;
  return (S._cpQ||S._cpFlt) ? ('áp cho '+r+' dòng đang hiện') : ('áp cho tất cả '+r+' dòng — chọn vùng ô để thu hẹp');
}
function cpQuickLn_(v){
  var rows=cpLnRows_(); if(!rows.length){ toast('Chưa có dòng nào'); return; }
  if(rows.length>1 && !confirm('Đặt lợi nhuận '+v+'% cho '+rows.length+' dòng?')) return;
  tkApplyEdits_(rows.map(function(l){ return {id:l.lineId, fields:{lnPct:Number(v)}}; }), 'Đã đặt lợi nhuận '+v+'%');
}
function cpQuickLnAsk_(){
  var v=prompt('Nhập % lợi nhuận trên giá vốn:',''); if(v==null) return;
  v=Number(String(v).replace(',','.')); if(!isFinite(v)){ toast('% không hợp lệ'); return; }
  cpQuickLn_(v);
}

/* ===== Gom biến thể: cùng một sản phẩm, chỉ khác công suất / nhiệt độ / góc / màu =====
   Thẻ đầu tiên đại diện cả nhóm; bấm chip "Biến thể n" để bung các biến thể còn lại
   (thẻ con dùng đúng kiểu thẻ của combo cho quen mắt). */
function catVarGroups_(list){
  var out=[], seen={};
  list.forEach(function(p,i){
    var k=spVarKey_(p); if(!k){ out.push({i:i,key:'',kids:[]}); return; }
    if(seen[k]!=null){ out[seen[k]].kids.push(i); return; }
    seen[k]=out.length; out.push({i:i,key:k,kids:[]});
  });
  return out;
}
function catVarMo_(p){ return !!(S._catVarOpen && S._catVarOpen[catCbKey_(p)]); }
function catVarToggle_(i){
  var p=(S._filtered||[])[i]; if(!p) return;
  var k=catCbKey_(p); if(!k) return;
  S._catVarOpen=S._catVarOpen||{};
  if(S._catVarOpen[k]) delete S._catVarOpen[k]; else S._catVarOpen[k]=1;
  var sc=document.getElementById('catList'), top=sc?sc.scrollTop:0;
  renderCatalog(); if(sc) sc.scrollTop=top;
}
// nhãn ngắn cho biến thể: lấy phần thông số khác nhau
function catVarLbl_(x){
  return [x.congSuat,x.nhietDo,x.gocChieu,x.mauSac].map(function(v){ return String(v==null?'':v).trim(); })
    .filter(Boolean).join(' · ');
}
function catVarHtml_(list,G){
  var head=G.i+1;
  var rows=G.kids.map(function(ix,k){
    var x=list[ix];
    var lbl=catVarLbl_(x) || x.ten || '';
    var phu=[x.thuongHieu, (catVarLbl_(x)?'':ccSpecTxt_(x))].map(function(t){ return String(t||'').trim(); }).filter(Boolean).join(' · ');
    return ccRow_(head+'.'+(k+2), Object.assign({},x,{ten:lbl}), phu,
      'showDetail('+ix+')', 'addProduct('+ix+')',
      ' draggable="true" ondragstart="prodDragStart(event,'+ix+')" ondragend="prodDragEnd()"');
  }).join('');
  return ccBox_('Biến thể của sản phẩm', G.kids.length+1, rows, 'bt');
}


/* ═══ Sheet Nhân công / Vật tư trong một hạng mục ═══
   Lưu trên dòng ở extra.sheet ('nc' | 'vt' | rỗng = để chung) nên đi theo dòng, không đụng cấu trúc hạng mục. */
var TK_SHEETS=[['nc','Nhân công'],['vt','Vật tư']];
/* Nhân công / Vật tư CHỈ có ở: Phần thô · Thạch cao · Xây tô · Ốp lát.
   Các hạng mục khác (Thiết bị đèn…) không chia sheet. */
var TK_SHEET_NODES=['3.1','3.2.1','3.2.3','3.2.4'];
function tkSheetCo_(code){
  var c=String(code||S.node||'');
  return TK_SHEET_NODES.some(function(n){ return c===n || c.indexOf(n+'.')===0; });
}
function tkSheetOf_(l){ return String((l&&l.extra&&l.extra.sheet)||''); }
function tkSheetLbl_(v){ var x=TK_SHEETS.filter(function(t){ return t[0]===v; })[0]; return x?x[1]:''; }
function setSheet(v){
  S.sheet=(S.sheet===v)?'':(v||''); S._mmDT=null;   // bấm lại chip đang bật = xem tất cả
  try{ localStorage.setItem('qs_sheet', S.sheet||''); }catch(e){}
  S._tkSel={}; renderTable(); renderCard&&renderCard();
}
var PT_SHEET_LOAI={nc:'dt_nhancong', vt:'dt_vattu'};
function tkSheetChips_(lines){
  if(typeof renderMM_==='function') renderMM_();          // mind map bên trái luôn khớp sheet / loại báo giá
  var box=document.getElementById('tkSheets'); if(!box) return;
  if(!lines || !tkSheetCo_()){ box.innerHTML=''; return; }
  var code=S.node||'';
  // Phần thô: Nhân công / Vật tư chính là 2 "Loại báo giá" dự toán bên panel trái
  /* Cùng 1 cấu trúc cho Phần thô và Thạch cao / Xây tô / Ốp lát:
       Khái toán (Nhân công + Vật tư)  |  Dự toán · Nhân công  |  Dự toán · Vật tư        */
  function chip(on, js, so, ten, tip, n){ return '<button class="shchip'+(on?' on':'')+'" onclick="'+js+'" title="'+esc(tip)+'">'
    +'<span class="shc-c">'+esc(so)+'</span>'+ten+(n!=null?'<i class="shc-n">['+pad2(n)+']</i>':'')+'</button>'; }
  if(code==='3.1'){                  // Phần thô: 1. Khái toán (1.1 chi tiết · 1.2 sơ bộ) · 2. Dự toán (2.1 NC · 2.2 VT)
    var cur=ptLoai_();
    box.innerHTML=PT_LOAI_NHOM.map(function(g){
      return '<span class="shc-sep">'+esc(g[1]+'. '+g[2])+'</span>'+g[3].map(function(x){
        return chip(cur===x[0],'ptSheetPick_(\''+x[0]+'\')',x[1],esc(x[2].replace(/^Khái toán (\S)/,function(m,c){ return c.toUpperCase(); })),x[2]+' — '+x[3]); }).join('');
    }).join('');
    return;
  }
  // Thạch cao / Xây tô / Ốp lát: lọc dòng Nhân công / Vật tư (bấm lại = xem tất cả)
  var dem={nc:0,vt:0,'':0};
  (lines||[]).forEach(function(l){ dem[tkSheetOf_(l)]=(dem[tkSheetOf_(l)]||0)+1; });
  box.innerHTML=TK_SHEETS.map(function(t,i){
    return chip(S.sheet===t[0],'setSheet(\''+t[0]+'\')',(code?(code+'.'+(i+1)+'.'):''),t[1],'Chỉ hiện các dòng '+t[1]+' của hạng mục này',dem[t[0]]||0);
  }).join('')
  +(S.sheet?'<button class="shchip clr" onclick="setSheet(\''+S.sheet+'\')" title="Bỏ lọc, xem tất cả">✕ Tất cả</button>':'');
}
// Phần thô: bấm chip = đổi Loại báo giá; bấm lại chip đang bật = quay về khái toán trước đó
function ptSheetPick_(v){
  ptSetLoai(PT_SHEET_LOAI[v]||v||'kt_chitiet'); renderTable();   // nhận 'nc'/'vt' (cũ) hoặc mã loại báo giá
}
function tkBulkSheet_(v){
  var ls=tkSelLines_(); if(!ls.length) return;
  var edits=ls.map(function(l){
    var ex=Object.assign({}, l.extra||{});
    if(v) ex.sheet=v; else delete ex.sheet;
    return {id:l.lineId, fields:{extra:ex}};
  });
  tkApplyEdits_(edits, v?('Đã đưa vào sheet '+tkSheetLbl_(v)):'Đã bỏ khỏi sheet');
}

/* ═══════════ XUẤT BÁO GIÁ — chọn hạng mục cần xuất + chọn cột xuất + phân trang ═══════════ */
function bgSelSet_(){ S.bgNodes=S.bgNodes||{}; return S.bgNodes; }
function bgSelCodes_(){ var o=bgSelSet_(); return Object.keys(o).filter(function(k){ return o[k]; }); }
function bgNodeCnt_(code){
  return (S.lines||[]).filter(function(l){ return l.nhom===code||String(l.nhom||'').indexOf(code+'.')===0; }).length;
}
// Các dòng sẽ lên báo giá (không tích gì = lấy tất cả)
function bgLines_(){
  var sel=bgSelCodes_(); if(!sel.length) return (S.lines||[]).slice();
  return (S.lines||[]).filter(function(l){ var c=String(l.nhom||'');
    return sel.some(function(nd){ return c===nd || c.indexOf(nd+'.')===0; }); });
}
function bgNodeLabel_(){
  var sel=bgSelCodes_();
  if(!sel.length) return 'TỔNG HỢP CHI PHÍ';
  if(sel.length===1) return nodeName(sel[0])||sel[0];
  return sel.length+' HẠNG MỤC';
}
function bgNodeBtn_(id){
  var sel=bgSelCodes_(), n=bgLines_().length;
  var lbl=sel.length?(sel.length===1?((sel[0]+'.'+(nodeName(sel[0])||''))):(sel.length+' hạng mục')):'Tất cả hạng mục';
  return '<button class="btn ghost sm bg-nodebtn'+(sel.length?' on':'')+'" id="'+id+'" onclick="bgTreePop_(event,\''+id+'\')" '
    +'title="Tích chọn hạng mục sẽ đưa vào file báo giá">'+icon('layers',14)+' '+esc(lbl)+' <b class="tbn">['+pad2(n)+']</b> ▾</button>';
}
function bgTreeNodes_(){
  var out=TREE.filter(function(t){ return t[0]!=='X'; }).map(function(t){ return {code:t[0],name:t[1],lvl:t[2]}; });
  customGroups().forEach(function(nm){ out.push({code:nm,name:nm,lvl:1}); });
  return out;
}
function bgTreePop_(e,btnId){
  if(e&&e.stopPropagation) e.stopPropagation();
  var id='bgTreePop';
  if(document.getElementById(id)){ bgTreeClose_(); return; }
  var pop=document.createElement('div'); pop.className='fltpop bgtree'; pop.id=id;
  document.body.appendChild(pop); S._bgTreeBtn=btnId; bgTreeRender_();
  var b=document.getElementById(btnId);
  if(b){ var r=b.getBoundingClientRect(), w=pop.offsetWidth||330, h=pop.offsetHeight;
    var top=r.bottom+6; if(top+h>window.innerHeight-10) top=Math.max(10, r.top-h-6);
    pop.style.top=top+'px'; pop.style.left=Math.max(8,Math.min(r.left, window.innerWidth-w-10))+'px'; }
  setTimeout(function(){ document.addEventListener('mousedown',bgTreeOutside_); },0);
}
function bgTreeOutside_(e){
  if(e.target.closest('#bgTreePop')||e.target.closest('.bg-nodebtn')) return; bgTreeClose_(); }
function bgTreeClose_(){ var p=document.getElementById('bgTreePop'); if(p) p.remove();
  document.removeEventListener('mousedown',bgTreeOutside_); }
function bgTreeRender_(){
  var pop=document.getElementById('bgTreePop'); if(!pop) return;
  var sel=bgSelSet_(), nodes=bgTreeNodes_(), co=bgSelCodes_().length;
  var chiCo=!!S._bgOnlyUsed;
  var list=nodes.filter(function(t){ return !chiCo || bgNodeCnt_(t.code)>0; });
  pop.innerHTML='<div class="bgt-h"><b>Chọn hạng mục xuất báo giá</b>'
      +'<span>'+(co?co+' mục đã tích':'chưa tích = xuất tất cả')+'</span>'
      +'<button class="colpop-x" onclick="bgTreeClose_()">✕</button></div>'
    +'<div class="bgt-tools">'
      +'<label class="bgt-only"><input type="checkbox" '+(chiCo?'checked':'')+' onchange="bgOnlyUsed_(this.checked)"> Chỉ hạng mục đã có dòng</label>'
      +'<span style="flex:1"></span>'
      +'<button class="btn ghost xs" onclick="bgSelAll_(1)">Chọn tất cả</button>'
      +'<button class="btn ghost xs" onclick="bgSelAll_(0)">Bỏ chọn</button>'
    +'</div>'
    +'<div class="bgt-b">'+(list.length?list.map(function(t){
        var n=bgNodeCnt_(t.code), on=!!sel[t.code];
        return '<div class="bgt-i lvl'+t.lvl+(on?' on':'')+(n?'':' empty')+'" onclick="bgSelToggle_(\''+esc(t.code).replace(/'/g,"\\'")+'\')">'
          +'<span class="nm">'+esc(t.code+'.'+t.name)+'</span>'
          +'<span class="cn">['+pad2(n)+']</span>'
          +'<span class="rd'+(on?' on':'')+'"></span></div>';
      }).join(''):'<div class="colpop-empty">Không có hạng mục nào có dòng.</div>')+'</div>'
    +'<div class="bgt-f"><span class="hint">'+pad2(bgLines_().length)+' dòng sẽ lên báo giá</span>'
      +'<button class="btn blue sm" onclick="bgTreeClose_()">Xong</button></div>';
}
function bgOnlyUsed_(on){ S._bgOnlyUsed=!!on; bgTreeRender_(); }
function bgSelToggle_(code){
  var sel=bgSelSet_(); if(sel[code]) delete sel[code]; else sel[code]=1;
  S.bgDeMuc=bgSelCodes_().length===1?bgSelCodes_()[0]:'__all__';
  S.bgPage=1; bgTreeRender_(); drawBaogia();
  setTimeout(bgTreeRender_,0);
}
function bgSelAll_(on){
  S.bgNodes={};
  if(on) bgTreeNodes_().forEach(function(t){ if(bgNodeCnt_(t.code)) S.bgNodes[t.code]=1; });
  S.bgPage=1; bgTreeRender_(); drawBaogia(); setTimeout(bgTreeRender_,0);
}
/* --- mỗi hạng mục 1 trang --- */
function bgPerSec_(){ return S.bgPerSec!==false; }
function bgTogglePerSec_(){ S.bgPerSec=!bgPerSec_(); S.bgPage=1; drawBaogia(); }
/* --- chọn cột sẽ xuất (dùng chung S.cols với bảng Bóc tách) --- */
function bgColBtn_(){
  var on=COLS.filter(function(c){ return S.cols[c[0]]; }).length;
  return '<button class="btn ghost sm" id="bgColBtn" onclick="bgColPop_(event)" title="Chọn cột sẽ có trong file xuất">'
    +icon('list',14)+' Cột xuất <b class="tbn">'+on+'/'+COLS.length+'</b></button>';
}
function bgColPop_(e){ if(e&&e.stopPropagation) e.stopPropagation();
  colPopMake_('bgColPop','bgColBtn','Cột đưa vào file xuất',COLS.map(function(c){return c[0];}),
    function(k){ return !!S.cols[k]; },'toggleCol','tkColAll_'); }
function bgCtlBar_(){
  var pages=bgBuildPages().length;
  return '<div class="bgctl">'
    +bgNodeBtn_('bgNodeBtn1')
    +'<span class="bgctl-mau" title="Kiểu tờ bìa ở trang 1">'
      +'<label>Tờ bìa</label>'
      +'<button class="'+(S.coverMau==='m1'?'on':'')+'" onclick="setCoverMau(\'m1\')">Mẫu 1</button>'
      +'<button class="'+(S.coverMau==='m1'?'':'on')+'" onclick="setCoverMau(\'m2\')">Mẫu 2</button>'
    +'</span>'
    +'<button class="btn ghost sm'+(bgPerSec_()?' on':'')+'" onclick="bgTogglePerSec_()" '
      +'title="Mỗi hạng mục bắt đầu ở một trang mới">'+icon('doc',14)+' Mỗi phần 1 trang</button>'
    +'<span class="bgctl-n">'+icon('doc',13)+' Số trang <b>'+pages+'</b></span>'
    +'<span style="flex:1"></span>'
    +'<button class="btn green sm" onclick="doExport(\'xlsx\',this)">'+icon('download',15)+' Xuất Excel</button>'
    +'<button class="btn red sm" onclick="printDoc()">'+icon('download',15)+' Xuất PDF / In</button>'
  +'</div>'
  +'<div class="colchips bg-colchips"><span class="cp-collbl">Cột xuất</span>'
    +COLS.map(function(c){ return '<span class="chip'+(S.cols[c[0]]?' on':'')+'" onclick="toggleCol(\''+c[0]+'\')">'+esc(c[1])+'</span>'; }).join('')
  +'</div>';
}

/* ═══════════ MUA HÀNG — đề xuất giảm giá + đề xuất thanh toán theo đợt ═══════════ */
/* Đề xuất giảm giá từ phòng mua hàng: là con số ĐỀ NGHỊ với NCC, tách khỏi
   "Giảm giá NCC (%)" (mức NCC đã chốt). Lưu trên dòng ở extra.dxGiam. */
function mhDx_(l){ return Math.max(0,Math.min(100,Number(l&&l.extra&&l.extra.dxGiam)||0)); }
function mhDxSum_(items){ return (items||[]).reduce(function(a,l){ return a+mhDx_(l); },0); }
function mhSetDx(lineId,v){
  var l=(S.lines||[]).filter(function(x){ return x.lineId===lineId; })[0]; if(!l) return;
  var p=Math.max(0,Math.min(100,Number(v)||0));
  var ex=Object.assign({}, l.extra||{}); if(p) ex.dxGiam=p; else delete ex.dxGiam;
  l.extra=ex; renderMuahang();
  api('updateLine',lineId,{extra:ex}).catch(function(){ toast('Lưu đề xuất giảm giá lỗi'); });
}
function mhSetDxAll(gi,v){
  var g=(S._mhGroups||[])[gi]; if(!g) return;
  var p=Math.max(0,Math.min(100,Number(v)||0));
  g.items.forEach(function(l){
    var ex=Object.assign({}, l.extra||{}); if(p) ex.dxGiam=p; else delete ex.dxGiam;
    l.extra=ex; api('updateLine',l.lineId,{extra:ex}).catch(function(){});
  });
  renderMuahang();
}
// Đơn giá / thành tiền NẾU nhà cung cấp chấp nhận mức đề xuất
function mhPriceDx_(l){ return Math.round(mhPrice(l)*(1-mhDx_(l)/100)); }
function mhSendDx(gi,btn){
  var g=(S._mhGroups||[])[gi]; if(!g) return;
  if(!mhValidateInfo()) return;
  var vatPct=Number(S.cur&&S.cur.vat)||0;
  var sub=g.items.reduce(function(a,l){ return a+(Number(l.soLuong)||0)*mhPriceDx_(l); },0);
  var vat=Math.round(sub*vatPct/100);
  var goc=g.items.reduce(function(a,l){ return a+(Number(l.soLuong)||0)*mhPrice(l); },0);
  if(!confirm('Gửi đề xuất chiết khấu tới "'+g.ncc+'"?\n\nGiá gốc: '+money(goc)+' đ\nSau mức đề xuất: '+money(sub)+' đ\nGiảm: '+money(goc-sub)+' đ')) return;
  if(btn){ btn.disabled=true; btn.dataset.t=btn.innerHTML; btn.innerHTML='Đang gửi…'; }
  var dx=Object.assign(mhBase(), { loai:'ck', supplier:g.ncc, vatPct:vatPct,
    items:g.items.map(function(l){ return {ten:l.ten||'', ma:l.maSP||'', thuongHieu:l.thuongHieu||'',
      khuVuc:l.khuVuc||'', hinhAnh:String(l.hinhAnh||'').split('\n')[0], sl:Number(l.soLuong)||0,
      dvt:l.dvt||'Cái', donGia:mhPriceDx_(l), donGiaGoc:mhPrice(l), giamGiaPct:mhDx_(l)}; }) });
  api('sendDeXuat', dx)
    .then(function(r){ toast('✔ Đã gửi đề xuất chiết khấu '+((r&&r.ma)||'')+' tới "'+g.ncc+'"'); mhLoadDx_(); })
    .catch(function(e){ toast('Lỗi gửi: '+e.message); })
    .then(function(){ if(btn){ btn.disabled=false; btn.innerHTML=btn.dataset.t; } });
}

/* ---------- Đề xuất thanh toán mục tiêu (chia đợt) ---------- */
function mhPayKey_(){ return 'qs_mhtt_'+((S.cur&&S.cur.maDA)||''); }
function mhPayAll_(){
  if(S._mhPayDA!==((S.cur&&S.cur.maDA)||'')){
    var d={}; try{ d=JSON.parse(localStorage.getItem(mhPayKey_())||'{}')||{}; }catch(e){ d={}; }
    S._mhPay=d; S._mhPayDA=(S.cur&&S.cur.maDA)||'';
  }
  return S._mhPay=S._mhPay||{};
}
function mhPaySave_(){ try{ localStorage.setItem(mhPayKey_(), JSON.stringify(mhPayAll_())); }catch(e){} }
function mhPayOf_(ncc){ var a=mhPayAll_(); if(!a[ncc]) a[ncc]=[{pct:100,tien:0,ngay:'',gc:''}]; return a[ncc]; }
function mhPayOpen_(ncc){ return !!(S._mhPayOpen&&S._mhPayOpen[ncc]); }
function mhPayToggle(gi){
  var g=(S._mhGroups||[])[gi]; if(!g) return;
  S._mhPayOpen=S._mhPayOpen||{};
  if(S._mhPayOpen[g.ncc]) delete S._mhPayOpen[g.ncc]; else S._mhPayOpen[g.ncc]=1;
  renderMuahang();
}
function mhPaySet(gi,i,f,v){
  var g=(S._mhGroups||[])[gi]; if(!g) return;
  var arr=mhPayOf_(g.ncc), d=arr[i]; if(!d) return;
  var tot=mhTot_(g.items, Number(S.cur&&S.cur.vat)||0);
  if(f==='pct'){ d.pct=Math.max(0,Math.min(100,Number(String(v).replace(',','.'))||0)); d.tien=Math.round(tot*d.pct/100); }
  else if(f==='tien'){ d.tien=Math.max(0,tkNum_(v)); d.pct=tot?Math.round(d.tien/tot*1000)/10:0; }
  else d[f]=v;
  mhPaySave_(); renderMuahang();
}
function mhPayAdd(gi){
  var g=(S._mhGroups||[])[gi]; if(!g) return;
  var arr=mhPayOf_(g.ncc), tot=mhTot_(g.items, Number(S.cur&&S.cur.vat)||0);
  var da=arr.reduce(function(a,d){ return a+(Number(d.pct)||0); },0);
  var con=Math.max(0, 100-da);
  arr.push({pct:con, tien:Math.round(tot*con/100), ngay:'', gc:''});
  mhPaySave_(); renderMuahang();
}
function mhPayDel(gi,i){
  var g=(S._mhGroups||[])[gi]; if(!g) return;
  var arr=mhPayOf_(g.ncc); if(arr.length<=1){ toast('Cần ít nhất 1 đợt'); return; }
  arr.splice(i,1); mhPaySave_(); renderMuahang();
}
function mhPayChia(gi,n){
  var g=(S._mhGroups||[])[gi]; if(!g) return;
  var tot=mhTot_(g.items, Number(S.cur&&S.cur.vat)||0);
  var arr=[], moi=Math.floor(100/n*10)/10, con=tot;
  for(var i=0;i<n;i++){
    var pct=(i===n-1)?Math.round((100-moi*(n-1))*10)/10:moi;
    var tien=(i===n-1)?con:Math.round(tot*pct/100);   // đợt cuối gánh phần lẻ -> tổng khớp tuyệt đối
    con-=tien; arr.push({pct:pct, tien:tien, ngay:'', gc:''});
  }
  mhPayAll_()[g.ncc]=arr; mhPaySave_(); renderMuahang();
}
function mhPayHtml_(g,gi,tot){
  var mo=mhPayOpen_(g.ncc), arr=mhPayOf_(g.ncc);
  var sumTien=arr.reduce(function(a,d){ return a+(Number(d.tien)||0); },0);
  var sumPct=arr.reduce(function(a,d){ return a+(Number(d.pct)||0); },0);
  var du=Math.abs(sumTien-tot)<=Math.max(1000, tot*0.005);
  var hdr='<div class="mhtt-h" onclick="mhPayToggle('+gi+')">'
    +'<span class="mhtt-ic">'+icon('money',16)+'</span>'
    +'<b>Đề xuất thanh toán mục tiêu</b>'
    +'<span class="mhtt-sub">'+arr.length+' đợt · '+money(sumTien)+' đ</span>'
    +'<span style="flex:1"></span>'
    +'<span class="mhtt-car">'+(mo?'▾':'▸')+'</span></div>';
  if(!mo) return '<div class="mhtt">'+hdr+'</div>';
  var cards=arr.map(function(d,i){
    return '<div class="mhtt-c">'
      +'<div class="mhtt-c-h">Thanh toán đợt '+(i+1)
        +'<button class="mhtt-x" title="Xoá đợt" onclick="mhPayDel('+gi+','+i+')">✕</button></div>'
      +'<label class="mhtt-f"><span>%</span><input type="number" step="any" min="0" max="100" value="'+(d.pct||'')+'" placeholder="%" onchange="mhPaySet('+gi+','+i+',\'pct\',this.value)"></label>'
      +'<label class="mhtt-f"><span>Số tiền</span><input type="text" inputmode="numeric" value="'+(d.tien?money(d.tien):'')+'" placeholder="0" onchange="mhPaySet('+gi+','+i+',\'tien\',this.value)"></label>'
      +'<label class="mhtt-f"><span>Ngày</span><input type="date" value="'+esc(d.ngay||'')+'" onchange="mhPaySet('+gi+','+i+',\'ngay\',this.value)"></label>'
      +'<label class="mhtt-f gc"><span>Ghi chú</span><textarea rows="2" placeholder="VD: tạm ứng ký hợp đồng" onchange="mhPaySet('+gi+','+i+',\'gc\',this.value)">'+esc(d.gc||'')+'</textarea></label>'
    +'</div>';
  }).join('');
  return '<div class="mhtt open">'+hdr
    +'<div class="mhtt-b">'
      +'<div class="mhtt-tools"><span class="lb">Chia nhanh</span>'
        +[2,3,4].map(function(n){ return '<button onclick="mhPayChia('+gi+','+n+')">'+n+' đợt</button>'; }).join('')
        +'<span style="flex:1"></span>'
        +'<button class="add" onclick="mhPayAdd('+gi+')">'+icon('plus',13)+' Thêm đợt</button></div>'
      +'<div class="mhtt-grid">'+cards+'</div>'
      +'<div class="mhtt-sum'+(du?' ok':' warn')+'">'
        +'<span class="st">'+icon(du?'check':'gauge',14)+' '
          +(du?'Đã phân bổ đủ 100% giá trị đơn hàng'
              :(sumTien<tot?('Còn thiếu '+money(tot-sumTien)+' đ ('+Math.round((100-sumPct)*10)/10+'%)')
                           :('Vượt '+money(sumTien-tot)+' đ')))+'</span>'
        +'<span style="flex:1"></span>'
        +'<span class="tt">Tổng đề xuất: <b>'+money(sumTien)+' đ</b> / '+money(tot)+' đ</span>'
      +'</div>'
      +'<button class="btn navy sm mhtt-send" onclick="mhSendPay('+gi+',this)">'+icon('cart',15)+' Gửi đề xuất thanh toán</button>'
    +'</div></div>';
}
function mhSendPay(gi,btn){
  var g=(S._mhGroups||[])[gi]; if(!g) return;
  if(!mhValidateInfo()) return;
  var vatPct=Number(S.cur&&S.cur.vat)||0, tot=mhTot_(g.items,vatPct);
  var arr=mhPayOf_(g.ncc).filter(function(d){ return (Number(d.tien)||0)>0; });
  if(!arr.length){ toast('Chưa nhập đợt thanh toán nào'); return; }
  var sum=arr.reduce(function(a,d){ return a+(Number(d.tien)||0); },0);
  if(Math.abs(sum-tot)>Math.max(1000,tot*0.005)
     && !confirm('Tổng đề xuất ('+money(sum)+' đ) chưa khớp giá trị đơn ('+money(tot)+' đ). Vẫn gửi?')) return;
  if(btn){ btn.disabled=true; btn.dataset.t=btn.innerHTML; btn.innerHTML='Đang gửi…'; }
  var dx=Object.assign(mhBase(), { loai:'tt', supplier:g.ncc, vatPct:vatPct, tongDon:tot,
    dots:arr.map(function(d,i){
      return {dot:i+1, pct:Number(d.pct)||0, tien:Number(d.tien)||0, ngay:d.ngay||'', gc:d.gc||''}; }) });
  api('sendDeXuat', dx)
    .then(function(r){ toast('✔ Đã gửi đề xuất thanh toán '+arr.length+' đợt '+((r&&r.ma)||'')+' tới "'+g.ncc+'"'); mhLoadDx_(); })
    .catch(function(e){ toast('Lỗi gửi: '+e.message); })
    .then(function(){ if(btn){ btn.disabled=false; btn.innerHTML=btn.dataset.t; } });
}

/* Kéo thẻ con của combo (danh mục trái) và dòng "Sản phẩm đi kèm" (panel chi tiết)
   thả thẳng vào bảng bóc tách — giữ đúng số lượng đi kèm. */
function catChildDrag_(e,pk,k){
  var ds=(S._catCbIdx||{})[pk]||(S._catCb||{})[pk]||[];
  var x=ds[k]; if(!x){ e.preventDefault(); return; }
  return prodDragObj_(e,x,Number(x.comboSL)||1);
}
function pdComboDrag_(e,k){
  var x=(S._pdCombo||[])[k]; if(!x){ e.preventDefault(); return; }
  return prodDragObj_(e,x,Number(x.comboSL)||1);
}

/* ═══════════ ĐỀ XUẤT MUA HÀNG — phiếu riêng (chiết khấu / thanh toán) ═══════════ */
var DX_TEN_={ck:'Đề xuất chiết khấu', tt:'Đề xuất thanh toán'};
var DX_ICO_={ck:'gauge', tt:'money'};
function dxStatusCls_(st){ return {'Đã duyệt':'approved','Từ chối':'rejected','Chờ duyệt':'pending'}[st]||'pending'; }
/* --- Quản trị: danh sách + duyệt --- */
function admDxCard_(dxs){
  dxs=dxs||[]; var pending=dxs.filter(function(r){ return r.status==='Chờ duyệt'; });
  var body= dxs.length? dxs.map(function(r){
    var scls=dxStatusCls_(r.status);
    var tien = r.loai==='tt' ? ('Tổng đề xuất <span class="rq-amt">'+money(r.tongDeXuat)+'đ</span>')
             : ('Giảm <span class="rq-amt">'+money(r.tienGiam)+'đ</span> · còn '+money(r.tongDeXuat)+'đ');
    return rqItem_({ cls:scls+' clickable', icon:icon(DX_ICO_[r.loai]||'gauge',16),
      onclick:'dxDetail(\''+esc(r.ma)+'\')',
      title:'<b>'+esc(r.ma)+'</b> · '+esc(DX_TEN_[r.loai]||'Đề xuất')+' · '+esc(r.supplier||'—')
        +'<span class="rq-view">'+icon('eye',12)+' Xem chi tiết</span>',
      meta:'Người gửi <b>'+esc(r.requester||'—')+'</b>'+(r.phongBan?(' · '+esc(r.phongBan)):'')
        +' · Dự án '+esc(r.project||'—')+' · '+tien,
      badgeCls:scls, badgeText:esc(r.status||''),
      actions: scls==='pending'
        ? '<button class="btn blue xs" onclick="event.stopPropagation();dxResolve(\''+esc(r.ma)+'\',true)">Duyệt</button>'
          +'<button class="btn ghost xs danger" onclick="event.stopPropagation();dxResolve(\''+esc(r.ma)+'\',false)">Từ chối</button>'
        : '',
      time: fmtDateTime_(r.at) });
  }).join(''):'<div class="empty">Chưa có đề xuất nào.</div>';
  return '<div class="dbcard" id="dxCard"><div class="dbcard-h"><span class="dbcard-ic">'+icon('gauge',18)+'</span>'
    +'<h3>Đề xuất mua hàng</h3><span class="hint" style="margin-left:2px">chiết khấu · thanh toán — tách khỏi đơn mua hàng</span>'
    +(pending.length?'<span class="pend-badge">'+pending.length+' chờ duyệt</span>':'')
    +'</div><div class="dbcard-b rq-body">'+body+'</div></div>';
}
function dxResolve(ma,approve){
  if(!approve && !confirm('Từ chối phiếu '+ma+'?')) return;
  api('resolveDeXuat',ma,approve).then(function(){
    toast(approve?('Đã duyệt phiếu '+ma):('Đã từ chối phiếu '+ma));
    if(document.getElementById('v-admin').classList.contains('on')) renderAdmin();
    else mhLoadDx_();
    refreshNotifCount_&&refreshNotifCount_();
  }).catch(function(e){ toast('Lỗi: '+e.message); });
}
async function dxDetail(ma){
  var ov=document.createElement('div'); ov.className='sp-modal-ov'; ov.id='dxOv';
  ov.onclick=function(e){ if(e.target===ov) dxClose(); };
  ov.innerHTML='<div class="sp-modal pur-modal pd"><div class="pd-head"><h3>'+icon('gauge',16)+' Chi tiết đề xuất</h3>'
    +'<button class="pd-x" onclick="dxClose()">✕</button></div><div class="pur-body"><div class="empty" style="padding:26px">Đang tải…</div></div></div>';
  document.body.appendChild(ov);
  try{ var o=await api('getDeXuat', ma); ov.querySelector('.pur-body').innerHTML=dxDetailHtml_(o); }
  catch(e){ ov.querySelector('.pur-body').innerHTML='<div class="empty" style="padding:26px">Lỗi tải phiếu: '+esc(e.message)+'</div>'; }
}
function dxClose(){ var o=document.getElementById('dxOv'); if(o)o.remove(); }
function dxDetailHtml_(o){
  var scls=dxStatusCls_(o.status), isCK=(o.loai!=='tt');
  var info=function(k,v){ return v?('<div class="pur-i"><span>'+esc(k)+'</span><b>'+esc(v)+'</b></div>'):''; };
  var rows, head, tot;
  if(isCK){
    head='<tr><th class="c">STT</th><th>Sản phẩm</th><th class="c">ĐVT</th><th class="n">SL</th>'
      +'<th class="n">Đơn giá hiện tại</th><th class="c">Đề xuất giảm</th><th class="n">Đơn giá đề xuất</th><th class="n">Thành tiền</th></tr>';
    rows=(o.items||[]).map(function(it,i){
      return '<tr><td class="c">'+(i+1)+'</td>'
        +'<td><b>'+esc(it.ten||'')+'</b>'+(it.ma?'<span class="pur-code">'+esc(it.ma)+'</span>':'')+'</td>'
        +'<td class="c">'+esc(it.dvt||'')+'</td><td class="n">'+(it.sl||0)+'</td>'
        +'<td class="n">'+money(it.donGiaGoc)+'</td>'
        +'<td class="c"><b class="dx-pct">'+(it.pct||0)+'%</b></td>'
        +'<td class="n">'+money(it.donGia)+'</td>'
        +'<td class="n b">'+money(it.thanhTien)+'</td></tr>';
    }).join('')||'<tr><td colspan="8" class="empty" style="padding:18px">Phiếu không có dòng nào.</td></tr>';
    tot='<div><span>Giá hiện tại</span><b>'+money(o.tongGoc)+' đ</b></div>'
      +'<div><span>Sau đề xuất</span><b>'+money(o.tongDeXuat)+' đ</b></div>'
      +'<div class="grand"><span>TIẾT KIỆM</span><b>'+money(o.tienGiam)+' đ</b></div>';
  } else {
    head='<tr><th class="c">Đợt</th><th class="c">Tỷ lệ</th><th class="n">Số tiền</th><th class="c">Ngày dự kiến</th><th>Ghi chú</th></tr>';
    rows=(o.items||[]).map(function(it,i){
      return '<tr><td class="c b">'+esc(it.ten||('Đợt '+(i+1)))+'</td>'
        +'<td class="c"><b class="dx-pct">'+(it.pct||0)+'%</b></td>'
        +'<td class="n b">'+money(it.thanhTien)+'</td>'
        +'<td class="c">'+(it.ngay?fmtDate(it.ngay):'—')+'</td>'
        +'<td>'+esc(it.ghiChu||'')+'</td></tr>';
    }).join('')||'<tr><td colspan="5" class="empty" style="padding:18px">Phiếu không có đợt nào.</td></tr>';
    tot='<div><span>Giá trị đơn hàng</span><b>'+money(o.tongGoc)+' đ</b></div>'
      +'<div class="grand"><span>TỔNG ĐỀ XUẤT</span><b>'+money(o.tongDeXuat)+' đ</b></div>';
  }
  return '<div class="pur-head">'
      +'<div class="pur-ma">'+esc(o.ma)+'<span class="drq-badge '+scls+'">'+esc(o.status||'')+'</span>'
        +'<span class="dx-kind">'+esc(DX_TEN_[o.loai]||'Đề xuất')+'</span></div>'
      +'<div class="pur-grid">'
        +info('Nhà cung cấp',o.supplier)+info('Dự án',o.project)
        +info('Người gửi',o.requester)+info('Phòng ban',o.phongBan)
        +info('Hạng mục',o.hangMuc)+info('Ngày gửi',fmtDateTime_(o.at))
        +(o.nguoiDuyet?info('Người duyệt',o.nguoiDuyet):'')
        +(o.ngayDuyet?info('Ngày duyệt',fmtDateTime_(o.ngayDuyet)):'')
      +'</div>'+(o.ghiChu?'<div class="pur-note">'+icon('doc',12)+' '+esc(o.ghiChu)+'</div>':'')+'</div>'
    +'<div class="tbl-wrap pur-tblwrap"><table class="pur-tbl"><thead>'+head+'</thead><tbody>'+rows+'</tbody></table></div>'
    +'<div class="pur-tot">'+tot+'</div>'
    +(o.status==='Chờ duyệt'
      ? '<div class="pur-act"><button class="btn ghost sm danger" onclick="dxResolve(\''+esc(o.ma)+'\',false);dxClose()">Từ chối</button>'
        +'<button class="btn blue" onclick="dxResolve(\''+esc(o.ma)+'\',true);dxClose()">'+icon('check',15)+' Duyệt phiếu</button></div>'
      : '');
}
/* --- Tab Mua hàng: danh sách phiếu đề xuất của dự án đang mở --- */
async function mhLoadDx_(){
  if(!S.cur) return;
  try{ S._mhDx=await api('getDeXuatList', S.cur.maDA)||[]; }catch(e){ S._mhDx=[]; }
  S._mhDxDA=S.cur.maDA;
  var box=document.getElementById('mhDxBox'); if(box) box.innerHTML=mhDxInner_();
}
function mhDxInner_(){
  var list=S._mhDx||[];
  if(!list.length) return '<div class="empty" style="padding:16px 14px;font-size:12.5px">Chưa gửi đề xuất nào cho dự án này.</div>';
  return list.map(function(r){
    var scls=dxStatusCls_(r.status);
    return '<div class="mhdx-row '+scls+'" onclick="dxDetail(\''+esc(r.ma)+'\')" title="Xem chi tiết phiếu">'
      +'<span class="mhdx-ic">'+icon(DX_ICO_[r.loai]||'gauge',14)+'</span>'
      +'<div class="mhdx-m"><div class="mhdx-t">'+esc(DX_TEN_[r.loai]||'Đề xuất')+' · '+esc(r.supplier||'—')+'</div>'
        +'<div class="mhdx-s">'+esc(r.ma)+' · '+fmtDateTime_(r.at)+'</div></div>'
      +'<div class="mhdx-r"><b>'+money(r.loai==='tt'?r.tongDeXuat:r.tienGiam)+'</b>'
        +'<span class="drq-badge '+scls+'">'+esc(r.status||'')+'</span></div></div>';
  }).join('');
}
function mhDxPanel_(){
  var n=(S._mhDx||[]).length;
  return '<div class="imp-recent mhdx">'
    +'<div class="imp-recent-h">'+icon('gauge',15)+' Phiếu đề xuất đã gửi <span class="count">'+pad2(n)+'</span></div>'
    +'<div class="imp-recent-b" id="mhDxBox">'+mhDxInner_()+'</div></div>';
}

/* ═══ Thanh kéo DỌC tự vẽ cho bảng Bóc tách ═══
   Thanh cuộn gốc phải ẩn (nếu bật lại, Chrome mới bỏ qua ::-webkit-scrollbar và
   đẻ thêm một thanh NGANG 17px nằm chồng lên thanh kéo ngang tự vẽ). */
function tkVBarSync_(){
  var norm=document.getElementById('tkNormal'), bar=document.getElementById('tkVBar'), th=document.getElementById('tkVThumb');
  var wrap=norm&&norm.querySelector('.tbl-wrap');
  if(!norm||!bar||!th||!wrap) return;
  var sh=wrap.scrollHeight, ch=wrap.clientHeight;
  if(sh<=ch+1){ bar.style.display='none'; return; }
  var headH=(document.querySelector('#tkTable tr:first-child th')||{}).offsetHeight||46;
  var nb=norm.getBoundingClientRect(), wr=wrap.getBoundingClientRect();
  var hsb=wrap.offsetHeight-wrap.clientHeight;                    // chiều cao thanh cuộn ngang gốc (đang ẩn = 0)
  bar.style.display='';
  bar.style.top=(wr.top-nb.top+headH+2)+'px';
  // đặt ĐÈ vào mép phải vùng bảng (không lấn ra lề phải — chỗ đó là dãy nút xoá dòng)
  bar.style.left=(wr.left-nb.left+wrap.clientWidth-15)+'px';
  var H=Math.max(40, wr.height-headH-hsb-4);
  bar.style.height=H+'px';
  var tw=Math.max(48, Math.round(H*ch/sh));
  var maxTop=H-tw, maxScroll=sh-ch;
  th.style.height=tw+'px';
  th.style.top=Math.round(maxScroll?(wrap.scrollTop/maxScroll)*maxTop:0)+'px';
}
function tkVBarInit_(){
  var norm=document.getElementById('tkNormal'), bar=document.getElementById('tkVBar'), th=document.getElementById('tkVThumb');
  var wrap=norm&&norm.querySelector('.tbl-wrap');
  if(!norm||!bar||!th||!wrap) return;
  if(wrap.dataset.vb!=='1'){ wrap.dataset.vb='1'; wrap.addEventListener('scroll',tkVBarSync_,{passive:true}); }
  if(!S._vbarResize){ S._vbarResize=1; window.addEventListener('resize',tkVBarSync_); }
  if(th.dataset.vb!=='1'){
    th.dataset.vb='1';
    th.addEventListener('mousedown',function(e){
      e.preventDefault(); e.stopPropagation();
      var sy=e.clientY, st=wrap.scrollTop;
      var H=bar.clientHeight, tw=th.offsetHeight, maxTop=H-tw, maxScroll=wrap.scrollHeight-wrap.clientHeight;
      th.classList.add('dragging'); document.body.style.cursor='grabbing';
      function mv(ev){ var d=ev.clientY-sy; wrap.scrollTop = st + (maxTop? d*maxScroll/maxTop : 0); tkVBarSync_(); }
      function up(){ document.removeEventListener('mousemove',mv); document.removeEventListener('mouseup',up);
        th.classList.remove('dragging'); document.body.style.cursor=''; }
      document.addEventListener('mousemove',mv); document.addEventListener('mouseup',up);
    });
  }
  if(bar.dataset.vb!=='1'){
    bar.dataset.vb='1';
    bar.addEventListener('mousedown',function(e){
      if(e.target===th) return;
      var r=bar.getBoundingClientRect(), tw=th.offsetHeight;
      var pos=Math.min(Math.max(0,e.clientY-r.top-tw/2), r.height-tw);
      var maxScroll=wrap.scrollHeight-wrap.clientHeight, maxTop=r.height-tw;
      wrap.scrollTop = maxTop? pos*maxScroll/maxTop : 0; tkVBarSync_();
    });
  }
  tkVBarSync_();
}

/* ===== Mua hàng: bấm vào dòng sản phẩm để xem thông tin ===== */
function mhFindProd_(l){
  var ma=spNorm_(l.maSP||''), ten=spNorm_(l.ten||'');
  var p=null;
  if(ma) p=(S.products||[]).filter(function(x){ return spNorm_(x.ma||'')===ma; })[0];
  if(!p && ten) p=(S.products||[]).filter(function(x){ return spNorm_(x.ten||'')===ten; })[0];
  return p || { ten:l.ten, ma:l.maSP, thuongHieu:l.thuongHieu, ncc:l.ncc, moTa:l.moTa,
    kichThuoc:l.kichThuoc, hinhAnh:l.hinhAnh, dvt:l.dvt, donGiaBan:l.donGiaBan, donGiaVon:l.donGiaVon };
}
function mhProdModal_(lineId){
  var l=lineOf_(lineId); if(!l) return;
  var p=mhFindProd_(l);
  var sl=Number(l.soLuong)||0, dg=mhPrice(l), pctDx=mhDx_(l), pctCK=mhDisc_(l);
  var ov=document.createElement('div'); ov.className='sp-modal-ov'; ov.id='spModalOv';
  ov.onclick=function(e){ if(e.target===ov) spClose(); };
  function o(k,v,cls){ return '<div class="mhpm-i'+(cls?' '+cls:'')+'"><span>'+esc(k)+'</span><b>'+v+'</b></div>'; }
  ov.innerHTML='<div class="sp-modal sp-modal-wide pd"><div class="pd-head"><h3>Thông tin sản phẩm</h3>'
      +'<span class="mhpm-ncc">'+icon('building',13)+' '+esc(l.ncc||l.thuongHieu||'')+'</span>'
      +'<button class="pd-x" onclick="spClose()">✕</button></div>'
    +'<div class="pdm-grid">'
      +'<div class="pdm-left">'+pdMedia_(p)+'</div>'
      +'<div class="pdm-right">'+pdSpecs_(p)
        +'<div class="mhpm-box"><div class="pd-sec">Trong đơn mua hàng này</div>'
          +o('Số lượng', ptQty(sl)+' '+esc(l.dvt||'Cái'))
          +o('Đơn giá mua', money(dg)+' đ')
          +(pctDx?o('Đề xuất giảm', pctDx+'%','dx'):'')
          +(pctCK?o('Giảm giá NCC đã chốt', pctCK+'%'):'')
          +o('Thành tiền sau CK', money(sl*mhPriceCK_(l))+' đ','tot')
        +'</div>'
      +'</div>'
    +'</div>'
    +'<div id="pdComboModal"></div>'
    +'<div class="pd-actions">'
      +'<button class="btn ghost sm" onclick="spClose()">Đóng</button>'
      +'<button class="btn blue sm" onclick="spClose();showTab(\'boc\')">'+icon('layers',14)+' Mở bảng bóc tách</button>'
    +'</div></div>';
  document.body.appendChild(ov);
  document.addEventListener('keydown',spModalKey_);
  if(p.recordId||p.ma) pdLoadCombo_(p, null, 'bóc tách', 'pdComboModal');
}

/* ===== Chọn nhanh % lợi nhuận NGAY TẠI Ô (bảng nào cũng dùng) ===== */
function lnPickClose_(){ var p=document.getElementById('lnPickPop'); if(p) p.remove();
  document.removeEventListener('mousedown',lnPickOutside_); }
function lnPickOutside_(e){ if(e.target.closest&&(e.target.closest('#lnPickPop')||e.target.closest('.ln-pick'))) return; lnPickClose_(); }
function lnPickPop_(e,id){
  if(e&&e.stopPropagation) e.stopPropagation();
  if(document.getElementById('lnPickPop')){ lnPickClose_(); return; }
  lnPickClose_();
  var l=lineOf_(id); if(!l) return;
  var cur=Number(l.lnPct)||0;
  var pop=document.createElement('div'); pop.id='lnPickPop'; pop.className='lnpick';
  pop.innerHTML='<div class="lnpick-h">Lợi nhuận dự kiến</div>'
    +'<div class="lnpick-b">'+TK_LN_QUICK.map(function(v){
        return '<button class="'+(cur===v?'on':'')+'" onclick="lnPickSet_(\''+id+'\','+v+')">'+v+'%</button>'; }).join('')+'</div>'
    +'<div class="lnpick-f"><input id="lnPickV" type="number" step="any" placeholder="% khác" value="'+(TK_LN_QUICK.indexOf(cur)<0&&cur?cur:'')+'"'
      +' onkeydown="if(event.key===\'Enter\')lnPickSet_(\''+id+'\',this.value)">'
      +'<button class="btn blue xs" onclick="lnPickSet_(\''+id+'\',(document.getElementById(\'lnPickV\')||{}).value)">Áp dụng</button></div>';
  document.body.appendChild(pop);
  var b=e&&e.currentTarget?e.currentTarget:null;
  var r=b?b.getBoundingClientRect():{left:200,bottom:200,top:200};
  var w=pop.offsetWidth||208, h=pop.offsetHeight;
  var top=r.bottom+6; if(top+h>window.innerHeight-10) top=Math.max(10,r.top-h-6);
  pop.style.left=Math.max(8,Math.min(r.left-w+40, window.innerWidth-w-10))+'px';
  pop.style.top=top+'px';
  setTimeout(function(){ document.addEventListener('mousedown',lnPickOutside_); },0);
}
function lnPickSet_(id,v){
  v=Number(String(v==null?'':v).replace(',','.'));
  if(!isFinite(v)){ toast('Chưa nhập %'); return; }
  lnPickClose_(); editLine(id,{lnPct:v});
}

/* ═══ Đánh dấu ĐẦU / CUỐI mỗi khối dòng dữ liệu ═══
   Trong cùng một tầng (hoặc một hạng mục) kẻ dọc chạy LIỀN; chỉ hở ở đầu và
   cuối khối để tách khối này với khối kia. Chạy sau khi vẽ bảng, dùng chung
   cho mọi bảng nên không phải sửa từng hàm render. */
function markBlocks_(sel){
  document.querySelectorAll(sel||'table.tk, table.pt').forEach(function(tbl){
    tbl.querySelectorAll('tr.blk-first,tr.blk-last').forEach(function(tr){ tr.classList.remove('blk-first','blk-last'); });
    var truoc=null;
    [].forEach.call(tbl.rows, function(tr){
      var laDuLieu = tr.classList.contains('drow') || tr.classList.contains('pt-row');
      if(laDuLieu){ if(!truoc) tr.classList.add('blk-first'); truoc=tr; }
      else { if(truoc) truoc.classList.add('blk-last'); truoc=null; }
    });
    if(truoc) truoc.classList.add('blk-last');
  });
}

/* ═══════════════════════════════════════════════════════════════
   CHỌN NHIỀU DÒNG BẰNG CÁCH GIỮ CHUỘT TRÁI RỒI KÉO
   Bấm vào ô tích rồi rê qua các dòng khác — thả chuột là xong.
   Kéo qua dòng đã tích thì BỎ tích (theo trạng thái của dòng đầu tiên).
   Cập nhật tại chỗ, không vẽ lại cả bảng nên kéo không bị giật.
   ═══════════════════════════════════════════════════════════════ */
function dragSelInit_(){
  if(S._dselInit) return; S._dselInit=1;
  document.addEventListener('mousedown',function(e){
    if(e.button!==0) return;
    var ck=e.target.closest&&e.target.closest('input.spck,input.tkck');
    if(!ck || ck.id==='spCkAll') return;
    if(e.shiftKey) return;                       // giữ Shift vẫn là chọn cả vùng như cũ
    e.preventDefault();                          // tự xử lý, khỏi phụ thuộc cú click của trình duyệt
    var loai = ck.classList.contains('spck') ? 'sp' : 'tk';
    var d={ loai:loai, bat:!ck.checked, soDong:0 };
    S._dsel=d; S._dselChan=1;
    document.body.classList.add('dsel');
    var tr=ck.closest(loai==='sp'?'tr.sp-row':'tr.drow');
    if(tr) dragSelApply_(tr,d);                  // chọn luôn dòng đang bấm
  });
  // Nuốt cú click sau khi kéo, nếu không ô tích sẽ bị đảo trạng thái lần nữa
  document.addEventListener('click',function(e){
    if(!S._dselChan) return;
    S._dselChan=0;
    if(e.target.closest&&e.target.closest('input.spck,input.tkck')){ e.stopPropagation(); e.preventDefault(); }
  },true);
  document.addEventListener('mouseover',function(e){
    var d=S._dsel; if(!d) return;
    var tr=e.target.closest&&e.target.closest(d.loai==='sp'?'tr.sp-row':'#tkTable tr.drow');
    if(tr) dragSelApply_(tr,d);
  });
  document.addEventListener('mouseup',function(){
    var d=S._dsel; if(!d) return;
    S._dsel=null; document.body.classList.remove('dsel');
    if(d.loai==='sp'){ spBulkBar_&&spBulkBar_(); }
    else { tkSelBar_&&tkSelBar_(); }
    if(d.soDong>1) toast((d.bat?'Đã chọn thêm ':'Đã bỏ chọn ')+d.soDong+' dòng');
  });
}
function dragSelApply_(tr,d){
  var ck=tr.querySelector(d.loai==='sp'?'input.spck':'input.tkck'); if(!ck) return;
  if(!!ck.checked===!!d.bat) return;                  // dòng này đã đúng trạng thái rồi
  ck.checked=d.bat;
  if(d.loai==='sp'){
    var k=ck.getAttribute('data-k'); if(!k) return;
    S._spSel=S._spSel||{};
    if(d.bat) S._spSel[k]=1; else delete S._spSel[k];
    tr.classList.toggle('selrow',d.bat);
  } else {
    var id=tr.getAttribute('data-id'); if(!id) return;
    S._tkSel=S._tkSel||{};
    if(d.bat) S._tkSel[id]=1; else delete S._tkSel[id];
    tr.classList.toggle('rowsel',d.bat);
    S._tkAnchor=id;
  }
  d.soDong++;
}
// gắn ngay khi tải trang (không chờ đăng nhập) — chỉ là 3 listener trên document
if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',dragSelInit_);
else dragSelInit_();

/* ═══════════════════════════════════════════════════════════
   KÉO ĐỔI BỀ RỘNG PANEL TRÁI — nới rộng khung bảng bóc tách.
   Bề rộng lưu lại (qs_catW), bấm đúp tay kéo để về mặc định.
   ═══════════════════════════════════════════════════════════ */
var CAT_W_MIN=190, CAT_W_MAX=560;
function catWApply_(){
  var g=document.getElementById('bocGrid'); if(!g) return;
  var w=0; try{ w=parseInt(localStorage.getItem('qs_catW')||'',10)||0; }catch(e){}
  if(w) g.style.setProperty('--catW', Math.max(CAT_W_MIN,Math.min(CAT_W_MAX,w))+'px');
  else g.style.removeProperty('--catW');
}
function catResizeStart_(e){
  if(e.button!==0) return;
  e.preventDefault();
  var g=document.getElementById('bocGrid'), pn=document.getElementById('leftCat'), tay=document.getElementById('catResize');
  if(!g||!pn) return;
  var x0=e.clientX, w0=pn.getBoundingClientRect().width;
  document.body.classList.add('keo-ngang'); if(tay) tay.classList.add('dang-keo');
  function di(ev){
    var w=Math.round(Math.max(CAT_W_MIN,Math.min(CAT_W_MAX, w0+(ev.clientX-x0))));
    g.style.setProperty('--catW', w+'px');
  }
  function thoi(){
    document.removeEventListener('mousemove',di); document.removeEventListener('mouseup',thoi);
    document.body.classList.remove('keo-ngang'); if(tay) tay.classList.remove('dang-keo');
    try{ localStorage.setItem('qs_catW', String(Math.round(pn.getBoundingClientRect().width))); }catch(e2){}
    catSyncSauKeo_();
  }
  document.addEventListener('mousemove',di); document.addEventListener('mouseup',thoi);
}
function catResizeReset_(){
  try{ localStorage.removeItem('qs_catW'); }catch(e){}
  var g=document.getElementById('bocGrid'); if(g) g.style.removeProperty('--catW');
  catSyncSauKeo_(); toast('Đã trả bề rộng về mặc định');
}
// bảng và các thanh kéo phải đo lại sau khi đổi bề rộng
function catSyncSauKeo_(){
  try{ tkHBarSync_&&tkHBarSync_(); tkVBarSync_&&tkVBarSync_(); syncActGutter&&syncActGutter();
       ptHBarSync_&&ptHBarSync_(); }catch(e){}
}
if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',catWApply_);
else catWApply_();
