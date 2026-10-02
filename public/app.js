/* DECOX QS Pro — logic giao diện mới, nối backend /api/:fn */
'use strict';

/* ===== AUTH token ===== */
function authToken(){ try{ return localStorage.getItem('qs_token')||''; }catch(e){ return ''; } }
function setAuthToken(t){ try{ if(t) localStorage.setItem('qs_token',t); else localStorage.removeItem('qs_token'); }catch(e){} }
// Báo server trước rồi mới xoá phiên -> nhật ký hệ thống có dòng "Đăng xuất" (trước đây không)
function authLogout_(){
  var xong=function(){ setAuthToken(''); try{ localStorage.removeItem('qs_user'); }catch(e){} location.reload(); };
  try{ Promise.resolve(api('logout')).then(xong, xong); }catch(e){ xong(); }
}

/* ===== API ===== */
/* Lỗi JS chưa được bắt trên máy người dùng -> gửi về nhật ký hệ thống (tab Admin) để sửa được lỗi vặt.
   Bỏ trùng theo nội dung, tối đa 20 lỗi / phiên; chưa đăng nhập thì thôi. */
(function(){
  var gui={}, n=0;
  function bao(msg, src){
    msg=String(msg||'').slice(0,300); if(!msg || gui[msg] || n>=20 || !authToken()) return;
    gui[msg]=1; n++;
    var tab=(document.querySelector('.nav a.active')||{}).textContent||'';
    try{ api('logClientError',{msg:msg, src:src||'', tab:String(tab).trim()}).catch(function(){}); }catch(e){}
  }
  window.addEventListener('error',function(e){ bao(e.message, e.filename?(e.filename+':'+e.lineno):''); });
  window.addEventListener('unhandledrejection',function(e){ var r=e.reason;
    if(r && /Chưa đăng nhập/.test(r.message||'')) return;
    bao('Promise: '+((r&&r.message)||r), (r&&r.stack||'').split('\n')[1]||''); });
})();
/* Server vừa deploy bản mới trong lúc trang đang mở -> nhắc tải lại (trang cũ gọi API đã đổi sẽ lỗi vặt) */
function banMoi_(v){
  if(!v) return;
  if(!S._appVer){ S._appVer=v; return; }
  if(v===S._appVer || document.getElementById('banMoi')) return;
  var d=document.createElement('div'); d.id='banMoi'; d.className='banmoi';
  d.innerHTML='<span>Đã có bản cập nhật mới của Dezon Pro.</span><button onclick="location.reload()">Tải lại</button>'
    +'<button class="x" onclick="this.parentNode.remove()" title="Để sau">✕</button>';
  document.body.appendChild(d);
}
// Header chung cho MỌI request lên server (api + tải file xuất Excel)
function apiHeaders_(){
  var h={'Content-Type':'application/json'}; var t=authToken(); if(t) h['Authorization']='Bearer '+t;
  // Super admin đang "xem như" 1 công ty -> server lọc dữ liệu theo công ty đó
  if(S._viewAs===undefined){ try{ S._viewAs=localStorage.getItem('qs_viewAs')||''; }catch(e){ S._viewAs=''; } }
  if(S._viewAs) h['x-view-company']=S._viewAs;
  return h;
}
// POST body lên 1 route xuất file (/export/...) rồi tải file về máy
async function taiFile_(url, body, ten){
  var r=await fetch(url,{ method:'POST', headers:apiHeaders_(), body:JSON.stringify(body||{}) });
  if(!r.ok){ var e=await r.json().catch(function(){ return {}; }); throw new Error(e.error||('HTTP '+r.status)); }
  var blob=await r.blob(), u=URL.createObjectURL(blob), a=document.createElement('a');
  a.href=u; a.download=ten; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(function(){ URL.revokeObjectURL(u); },4000);
}
function api(fn){
  var args = Array.prototype.slice.call(arguments,1);
  var h=apiHeaders_();
  return fetch('/api/'+encodeURIComponent(fn),{method:'POST',headers:h, body:JSON.stringify({args:args})})
    .then(function(r){ banMoi_(r.headers.get('x-app-ver')); return r.json().catch(function(){ return {error:'HTTP '+r.status}; }).then(function(d){ d=d||{}; d._status=r.status; return d; }); })
    .then(function(d){ if(d && d.code==='NOAUTH'){ setAuthToken(''); if(typeof showLogin_==='function') showLogin_('Phiên đã hết, mời đăng nhập lại.'); throw new Error('Chưa đăng nhập'); }
      if(d&&d.error) throw new Error(d.error); return d?d.result:null; });
}
function money(n){ return (Math.round(Number(n)||0)).toLocaleString('vi-VN'); }
/* Chèn giá trị vào onclick="...(\'...\')": esc() chỉ escape HTML, KHÔNG escape dấu nháy
   đơn — hạng mục tự đặt tên kiểu "Nhà 3' x 4'" là vỡ handler. Dùng escJs_ cho mọi chỗ
   nhét dữ liệu người dùng vào thuộc tính sự kiện. */
function escJs_(v){ return esc(String(v==null?'':v)).replace(/\\/g,'\\\\').replace(/'/g,"\\'").replace(/\r?\n/g,'\\n'); }
// URL đưa vào href: http(s), đường dẫn nội bộ/tương đối, ảnh data/blob — chặn javascript: (esc không chặn)
function safeUrl_(u){ u=String(u==null?'':u).trim(); return /^(https?:|\/|data:image\/|blob:)/i.test(u)||(u&&!/^[a-z][a-z0-9+.-]*:/i.test(u))?u:'#'; }
function esc(s){ return String(s==null?'':s).replace(/[&<>"]/g,function(m){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[m];}); }
// Ngày tạo -> dd/mm/yyyy (không lệch ngày do múi giờ)
function fmtDate(v){
  if(!v) return '—';
  var s=String(v).trim();
  if(/^\d{4}-\d{2}-\d{2}T/.test(s)){ var d=new Date(s); if(!isNaN(d)) return ('0'+d.getDate()).slice(-2)+'/'+('0'+(d.getMonth()+1)).slice(-2)+'/'+d.getFullYear(); }
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
  ['moTa','Thông tin chính',1],['kichThuoc','Thông số thiết kế',1],['hinhAnh','Hình ảnh',1],['taiLieu','Tài liệu',1],['dvt','Đơn vị tính',1],
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
/* Sàn bề rộng khi bật "Vừa 1 màn hình" — hẹp hơn mức này chữ vỡ thành từng ký tự */
var TK_MINW_={stt:54,khuVuc:88,maBanVe:74,maSP:88,ten:150,thuongHieu:92,ncc:92,moTa:130,kichThuoc:120,
  hinhAnh:70,taiLieu:70,dvt:58,soLuong:62,trangThai:86,ghiChu:110};
var DEFW={taiLieu:92,stt:66,khuVuc:120,maBanVe:92,nganh:120,maSP:110,ten:190,thuongHieu:110,ncc:120,moTa:186,kichThuoc:150,hinhAnh:104,dvt:84,soLuong:84,giaNCC:104,chietKhau:120,giaDaiLy:104,lnPct:96,donGia:104,ckKhach:130,donGiaCK:104,markup:130,margin:130,lnVnd:120,thanhTien:112,trangThai:104,ghiChu:150};
S.colOrder=null; S.colW={}; S.colFilter={}; S.collapsed={};
// Công cụ kiểu bảng tính cho Bóc tách: sắp xếp / cố định cột / tô màu điều kiện
S.sortKey=''; S.sortDir='asc'; S.freezeN=0; S.cfRules={};
var NUMSORT={stt:1,soLuong:1,giaNCC:1,giaDaiLy:1,donGia:1,donGiaCK:1,lnVnd:1,thanhTien:1,lnPct:1,chietKhau:1,ckKhach:1,markup:1,margin:1};
var FR_FIELDS=['ten','thuongHieu','ncc','moTa','kichThuoc','maSP','khuVuc','maBanVe','ghiChu','trangThai','dvt'];
function cellSortVal_(l,k){ switch(k){
  case 'soLuong': return Number(l.soLuong)||0;
  case 'giaNCC': return Number(l.donGiaVon)||0;
  case 'giaDaiLy': return giaDaiLy_(l);
  case 'donGia': return Number(l.donGiaBan)||0;
  case 'donGiaCK': return donGiaCK_(l);
  case 'thanhTien': return ttBan_(l);
  case 'lnVnd': return lnVnd_(l);
  case 'markup': return markup_(l);
  case 'margin': return margin_(l);
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
  var sl=Number(l.soLuong)||0, ban=Number(l.donGiaBan)||0;
  if(r.ln0 && lnVnd_(l)<0) c+=' cf-red';          // cùng công thức server (tính cả CK khách)
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
    splashStep_('Đang tải dự án & danh mục sản phẩm…');
    var b=await api('bootstrap', S.cur?S.cur.maDA:null);
    S.projects=b.projects||[]; S.products=b.products||[];
    if(!S.cur && S.projects.length) S.cur=S.projects[0];
    if(S.cur){ var f=S.projects.filter(function(p){return p.maDA===S.cur.maDA;})[0]; if(f) S.cur=f; }
    if(S.cur) splashStep_('Đang tải bảng bóc tách “'+(S.cur.ten||S.cur.maDA)+'”…');
    S.lines = S.cur ? (await api('getLines',S.cur.maDA)||[]) : [];
    if(S.cur) await projDataLoad_(S.cur.maDA);      // bảng phần thô · diện tích · thông tin công tác (server)
    splashStep_('Đang dựng giao diện…');
    renderAll(); bocBoot_(); hmInit_(); sideApply_(); tkViewInit_();   // hạng mục dùng chung + chế độ xem bảng (vừa màn hình / toàn màn hình)
    splashDone_();
    ctLoad_(true).then(function(){ if(S.node==='3.1'||spPTMode_()) ctReload_(); });
  }catch(e){ splashDone_(); toast('Lỗi tải: '+e.message); }
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
  // Ẩn banner dự án ở các trang KHÔNG thuộc 1 dự án cụ thể
  var noProj = (tab==='admin' || tab==='sanpham' || tab==='import' || tab==='congty');
  // Dashboard đã có banner "Đang làm việc" + KPI riêng -> ẩn banner #pcard để khỏi TRÙNG LẶP
  var pcard=document.getElementById('pcard'); if(pcard) pcard.style.display = (noProj||tab==='dash')?'none':'';
  // Bóc tách không có hàm render riêng trong showTab nên trước đây đổi dự án ở tab khác
  // (Danh sách sản phẩm) rồi quay lại thì bảng vẫn là dòng của dự án cũ.
  if(tab==='boc'){ try{ renderTree(); renderFloors(); renderTable(); }catch(e){} }
  if(tab==='project') renderProjects();
  if(tab==='congty') renderCongTy();
  if(tab==='dash') renderDash();
  if(tab==='chiphi') renderChiphi();
  if(tab==='export') renderExport();
  // Nhập dữ liệu: đã dựng rồi thì GIỮ form đang nhập dở (ảnh, combo…), chỉ làm mới danh sách bên dưới
  if(tab==='import'){ var vImp=document.getElementById('v-import');
    if(!vImp || !vImp.childElementCount) renderImport(); else if(typeof impRecentRefresh_==='function') impRecentRefresh_(); }
  if(tab==='sanpham') renderSanpham();
  if(tab==='muahang') renderMuahang();
  if(tab==='duan') renderDuAn();
  if(tab==='admin') renderAdmin();
  qbMount_(tab);
}
/* Thanh công cụ nhanh DÙNG CHUNG cho Bóc tách · Chi phí · Dự án: chỉ có 1 thanh (#qbar), đặt ngay TRÊN
   tab đang mở (không nằm trong tab vì renderChiphi / renderDuAn vẽ lại cả nội dung). Chức năng đổi theo tab. */
var QB_TABS=['boc','chiphi','duan','muahang'];
function qbTab_(){ return S._qbTab||'boc'; }
function qbMount_(tab){
  var qb=document.getElementById('qbar'), v=document.getElementById('v-'+tab); if(!qb) return;
  if(QB_TABS.indexOf(tab)<0 || !v){ qb.style.display='none'; return; }
  S._qbTab=tab; if(qb.nextElementSibling!==v) v.parentNode.insertBefore(qb, v);
  qb.style.display=''; qbRender_();
}

/* ===== PROJECT ===== */
// Render lại tab đang mở (dùng sau khi đổi dự án/bản nháp -> UI cập nhật tức thì, không cần bấm lại tab)
/* Sau khi DỮ LIỆU DÒNG thay đổi: vẽ lại bảng bóc tách + đúng tab đang mở.
   Trước đây mỗi chỗ sửa tự nhớ vài tab (chỗ thì Chi phí + Bảng điều khiển, chỗ thì
   Chi phí + Dự án) nên đứng ở tab Dự án / Mua hàng sửa hoặc xoá dòng thì bảng đang
   xem vẫn giữ số cũ cho tới khi đổi tab. Nay mọi chỗ gọi chung một hàm.            */
function veLaiSauSua_(){ giuO_(function(){
  try{ renderTable(); renderCard(); }catch(e){}
  if(typeof bgVis==='function' && bgVis()){ drawBaogia(); return; }   // tab Xuất báo giá: vẽ lại tài liệu là đủ
  refreshActiveTab_();
}); }
/* Server trả lời lần sửa trước -> bảng vẽ lại TRONG LÚC người dùng đang gõ ô khác: trước đây mất chữ đang gõ
   + mất con trỏ. Giữ lại đúng ô (theo dòng + thứ tự ô trong dòng), giá trị đang gõ và vị trí con trỏ. */
function giuO_(ve){
  var a=document.activeElement, tr=a&&a.closest&&a.closest('tr[data-id]'), k=null;
  if(tr && (a.tagName==='TEXTAREA' || (a.tagName==='INPUT' && !/checkbox|radio|file/.test(a.type)))){
    k={id:tr.getAttribute('data-id'), i:[].indexOf.call(tr.querySelectorAll('input,textarea'),a), v:a.value, s:a.selectionStart, e:a.selectionEnd, view:a.closest('.view')}; }
  ve();
  if(!k||k.i<0||document.activeElement===a) return;
  var tr2=[].filter.call((k.view||document).querySelectorAll('tr[data-id]'),function(t){ return t.getAttribute('data-id')===k.id; })[0];
  var b=tr2&&tr2.querySelectorAll('input,textarea')[k.i]; if(!b) return;
  b.value=k.v; b.focus(); try{ b.setSelectionRange(k.s,k.e); }catch(x){}
}
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
async function renderProjSel(){
  var s=document.getElementById('projSel'); if(!s) return;
  s.innerHTML = S.projects.length ? S.projects.map(function(p){
    return '<option value="'+esc(p.maDA)+'"'+(S.cur&&S.cur.maDA===p.maDA?' selected':'')+'>'+esc(p.ten)+'</option>';
  }).join('') : '<option>— Chưa có dự án —</option>';
  s.onchange=async function(){
    if(!await openProject_(s.value)) return;
    renderAll(); refreshActiveTab_();   // render lại ĐÚNG tab đang mở -> cập nhật tức thì
  };
}
function renderCard(){
  var p=S.cur||{};
  document.getElementById('pcCode').textContent=p.maDA||'—';
  document.getElementById('pcName').textContent=(p.ten||'Chưa chọn dự án');
  var dz=document.getElementById('pcDezon');
  if(dz) dz.innerHTML=S.cur?dezonChip_(S.cur):'';      // link bài dự án trên dezon.vn
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
    var von=0,ban=0; (S.lines||[]).forEach(function(l){ von+=ttVon_(l); ban+=ttBan_(l); });   // cùng công thức tab Chi phí
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
  if(b){ b.classList.toggle('on', off); b.title=off?'Hiện lại panel sản phẩm bên trái':'Thu gọn panel sản phẩm — bảng rộng hơn'; }
  if(typeof qbRightSync_==='function') qbRightSync_();   // panel ẩn -> hàng công cụ thêm nút Bộ lọc / Yêu thích
  tkBarsSync_();                      // bề ngang bảng vừa đổi -> kéo thanh & nút xoá về đúng mép
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
function prodHmuc_(p){ var h=(p&&p.hangMuc)||'';                     // vệ sinh / sơn: chuẩn hoá tên ("bồn cầu" = "Bồn cầu")
  var ng=nganhCuaSP_(p);
  return (h && (ng==='vs'||ng==='son') && specNganh_(ng).chuanHM(h)) || h; }
function hmucOptions(){ var s={}, ngF=vsFltNganh_();   // đề mục có spec riêng: chỉ liệt kê hạng mục của ngành đó
  S.products.forEach(function(p){ if(ngF&&nganhCuaSP_(p)!==ngF) return; var n=prodHmuc_(p); if(n) s[n]=(s[n]||0)+1; }); return s; }
/* ═══ BỘ LỌC THIẾT BỊ VỆ SINH (panel trái tab Bóc tách, đề mục 3.2.5) ═══
   Sinh từ CÙNG bộ thông số với form Nhập & file mẫu (public/vs-spec.js):
     · "Hạng mục" = chip các hạng mục vệ sinh (đồng bộ 2 chiều với ô "Hạng mục sản phẩm")
     · Chọn đúng 1 hạng mục -> hiện các thông số dạng CHỌN của hạng mục đó (VD Bồn cầu: Kiểu lắp đặt,
       Hệ thống xả, Loại nắp…; Sen tắm: Loại sen…); chưa chọn / nhiều hạng mục -> Màu sắc + Kiểu lắp đặt.
     · Giá trị chip = giá trị THẬT có trong dữ liệu, kèm số SP. Trạng thái: S.fVs = {cột DB: {giá trị: 1}}. */
/* Đề mục nào có bộ thông số riêng thì panel trái dùng bộ lọc sinh từ spec của ngành đó:
   3.2.5 -> thiết bị vệ sinh (vs-spec) · 3.2.2 -> sơn nước (son-spec).                  */
var VS_FLT_NODE={'3.2.5':'vs','3.2.2':'son'};
function vsFltNganh_(){ return VS_FLT_NODE[S.node]||''; }
function vsFltOn_(){ return !!vsFltNganh_(); }
function vsFltSpec_(){ return specNganh_(vsFltNganh_()||'vs'); }
function vsFltHM_(){   // hạng mục đang lọc (chỉ khi chọn đúng 1)
  var sel=Object.keys(S.fNhomSet||{}).filter(function(k){ return S.fNhomSet[k]; });
  return sel.length===1?vsFltSpec_().chuanHM(sel[0]):'';
}
function vsFltKeys_(){
  var SP=vsFltSpec_(), hm=vsFltHM_();
  if(!hm) return (vsFltNganh_()==='son')?['BỀ MẶT HOÀN THIỆN','KÍCH THƯỚC']:['MÀU SẮC','KIỂU LẮP ĐẶT'];
  return SP.labelsOf(hm).filter(function(lb){ return SP.METRIC[lb][2]==='sel'; });
}
function vsProds_(){ var ng=vsFltNganh_()||'vs'; return (S.products||[]).filter(function(p){ return nganhCuaSP_(p)===ng; }); }
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
  var ng=vsFltNganh_()||'den';
  if(S._fltNg && S._fltNg!==ng){ S.fNhomSet={}; S.fVs={}; S._fltNg=ng; renderFilters(); }
  S._fltNg=ng;
  if(!vsFltOn_()){ box.style.display='none'; box.innerHTML=''; return; }
  box.style.display='';
  S.fVs=S.fVs||{};
  // bỏ lọc của thông số không còn áp dụng cho hạng mục đang chọn
  var SPEC=vsFltSpec_();
  var keys=vsFltKeys_(), cols=keys.map(function(lb){ return SPEC.METRIC[lb][0]; });
  Object.keys(S.fVs).forEach(function(c){ if(cols.indexOf(c)<0) delete S.fVs[c]; });
  var ps=vsProds_(), hmSel=Object.keys(S.fNhomSet||{}).filter(function(k){ return S.fNhomSet[k]; });
  var trongHM=hmSel.length?ps.filter(function(p){ return hmSel.indexOf(prodHmuc_(p))>=0; }):ps;
  function sec(key, title, chips, n){
    if(!fltHien_('vs_'+key)) return '';                     // đang tắt trong bảng Bộ lọc
    var open=(S.fsecOpen['vs_'+key]!==false);
    return '<div class="fsec'+(open?' open':'')+'"><div class="fsec-h" onclick="vsFltFold_(\''+escJs_(key)+'\')">'
      +'<span class="fsec-t">'+esc(title)+'</span>'+(n?'<span class="fsec-n">'+n+' đã chọn</span>':'')+'<span class="fsec-c">▾</span></div>'
      +'<div class="chips">'+(chips||'<span style="color:#9aa;font-size:12px">—</span>')+'</div></div>';
  }
  function chip(col,v,cnt,on){ return '<span class="chip'+(on?' on':'')+'" data-c="'+esc(col)+'" data-v="'+esc(v)+'" onclick="vsFltPick_(this)">'
    +esc(v)+'<i>'+cnt+'</i></span>'; }
  // Hạng mục: đếm theo dữ liệu, xếp theo thứ tự khai báo
  var demHM={}; ps.forEach(function(p){ var h=prodHmuc_(p); if(h) demHM[h]=(demHM[h]||0)+1; });
  var hmList=SPEC.HANG_MUC.filter(function(h){ return demHM[h]; })
    .concat(Object.keys(demHM).filter(function(h){ return SPEC.HANG_MUC.indexOf(h)<0; }));
  var html=sec('hm','Hạng mục', hmList.map(function(h){ return chip('__hm',h,demHM[h],!!(S.fNhomSet||{})[h]); }).join(''), hmSel.length);
  keys.forEach(function(lb){
    var col=SPEC.METRIC[lb][0], dem={};
    trongHM.forEach(function(p){ splitVals((p.raw||{})[col]).forEach(function(v){ dem[v]=(dem[v]||0)+1; }); });
    var thuTu=SPEC.optsOf(vsFltHM_(),lb);
    var vals=Object.keys(dem).sort(function(a,b){ var ia=thuTu.indexOf(a), ib=thuTu.indexOf(b);
      return ((ia<0?999:ia)-(ib<0?999:ib)) || a.localeCompare(b,'vi'); });
    if(!vals.length) return;                                    // thông số chưa có dữ liệu -> không hiện khối rỗng
    var o=S.fVs[col]||{};
    html+=sec(col, SPEC.METRIC[lb][1], vals.map(function(v){ return chip(col,v,dem[v],!!o[v]); }).join(''),
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
/* Gõ tìm trong danh mục bên trái — ô #catQ. (#fSearch là ô ẩn đời cũ, giữ để không vỡ
   những chỗ còn đọc nó.) */
function catTim_(v){
  var e=document.getElementById('catQ'); if(e && e.value!==v) e.value=v;
  var x=document.getElementById('catQX'); if(x) x.style.display=String(v||'').trim()?'':'none';
  var h=document.getElementById('fSearch'); if(h) h.value=v||'';
  renderCatalog();
  if(v===''){ var e2=document.getElementById('catQ'); if(e2) e2.focus(); }
}
function filteredProducts(){
  var qe=document.getElementById('catQ')||document.getElementById('fSearch');
  var q=((qe&&qe.value)||'').toLowerCase().trim();
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
    if(q && (p.ten+' '+p.ma+' '+p.thuongHieu+' '+(p.ncc||'')+' '+(p.nhom||'')).toLowerCase().indexOf(q)<0) return false;
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
    +(S.projects||[]).map(function(p){ return '<div class="demuc-opt'+(cur===p.maDA?' on':'')+'" data-t="'+esc(String(p.ten||'').toLowerCase())+'" onclick="pickInProj(\''+escJs_(p.maDA)+'\')"><span>'+esc(p.ten||p.maDA)+'</span></div>'; }).join('')
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
      return '<div class="demuc-opt l'+t.lvl+(S.demucCode===t.code?' on':'')+'" onclick="pickDemuc(\''+escJs_(t.code)+'\')"><span>'+esc(t.code+'.'+t.name)+'</span><span class="dc">['+pad2(cnt)+']</span></div>'; }).join('');
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
  if(S._inProjMa){ var pp=(S.projects||[]).filter(function(x){ return x.maDA===S._inProjMa; })[0];
    tag('Trong dự án', pp?(pp.ten||pp.maDA):S._inProjMa, 'catClearF_(\'inproj\')'); }
  if(vsFltOn_()){
    Object.keys(S.fVs||{}).forEach(function(col){ var v=Object.keys(S.fVs[col]).filter(function(x){ return S.fVs[col][x]; });
      var m=vsFltSpec_().METRIC[SP_COL2LABEL_[col]]||VS_SPEC.METRIC[SP_COL2LABEL_[col]];
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
  else if(k==='inproj'){ pickInProj(''); return; }
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
/* Ngành có spec riêng (vệ sinh / sơn): các khối lọc là ĐỘNG theo hạng mục nên không nằm
   trong FLT_REG — liệt kê ra đây để bảng "Bộ lọc" bật/tắt được y như khối cố định. */
function vsFltSecs_(){
  if(!vsFltOn_()) return [];
  var SP=vsFltSpec_(), out=[['vs_hm','Hạng mục']];
  vsFltKeys_().forEach(function(lb){ var m=SP.METRIC[lb]; if(m) out.push(['vs_'+m[0], m[1]]); });
  return out;
}
/* ═══ MỘT CÁCH HIỂN THỊ DUY NHẤT CHO MỌI KHỐI LỌC ═══
   Trước đây khối cố định (Công suất, Thương hiệu…) chạy theo danh sách "pin" còn khối
   theo ngành (vệ sinh / sơn) chạy theo danh sách "tắt" -> cùng một bảng mà hai kiểu mặc
   định, panel và bảng Bộ lọc không khớp nhau. Nay tất cả dùng chung:
     · fltSecs_()  : đúng những khối ÁP DỤNG cho ngành đang chọn (thứ tự = thứ tự trên panel)
     · fltHien_(k) : khối đó có hiện trên panel không — nhớ chung ở qs_fltshow
   Mặc định: khối thông số của ngành đang chọn = HIỆN, 4 khối chung = ẩn (bật khi cần).      */
var FLT_DEN=[['watt','Công suất'],['kelvin','Nhiệt độ màu'],['angle','Góc chiếu sáng']];
var FLT_CHUNG=[['yeuthich','Yêu thích'],['combo','Combo'],['brand','Thương hiệu'],['price','Khoảng giá']];
function fltSecs_(){ return (vsFltOn_()?vsFltSecs_():FLT_DEN).concat(FLT_CHUNG); }
function fltDefShow_(k){ return (k==='watt'||k==='kelvin'||String(k).indexOf('vs_')===0); }
function fltShowMap_(){
  if(S._fltShow) return S._fltShow;
  var m=null; try{ m=JSON.parse(localStorage.getItem('qs_fltshow')||'null'); }catch(e){}
  if(!m||typeof m!=='object'){                       // lần đầu: lấy lại cài đặt của cách cũ
    m={};
    var pin=null; try{ pin=JSON.parse(localStorage.getItem('qs_pinflt')||'null'); }catch(e){}
    if(Array.isArray(pin)) FLT_REG.forEach(function(f){ m[f[0]]=pin.indexOf(f[0])>=0; });
    var off=null; try{ off=JSON.parse(localStorage.getItem('qs_fltoff')||'null'); }catch(e){}
    if(Array.isArray(off)) off.forEach(function(k){ m[k]=false; });
  }
  S._fltShow=m; return m;
}
function fltHien_(k){ var m=fltShowMap_(); return (k in m)?!!m[k]:fltDefShow_(k); }
function fltToggle_(k){
  var m=fltShowMap_(); m[k]=!fltHien_(k);
  try{ localStorage.setItem('qs_fltshow', JSON.stringify(m)); }catch(e){}
  fltApplyPins_(); if(typeof renderVsFilters_==='function') renderVsFilters_(); fltNamesRender_();
  if(S._filtOpen && typeof positionFiltPop_==='function') positionFiltPop_();
}
function fltApplyPins_(){
  var box=document.getElementById('pinFilters'), store=document.getElementById('filtStore');
  if(!box||!store) return;
  var denOnly={watt:1,kelvin:1,angle:1}, laDen=!vsFltOn_();
  FLT_REG.forEach(function(f){                        // theo đúng thứ tự khai báo -> panel xếp như bảng Bộ lọc
    var el=document.getElementById('sec_'+f[0]); if(!el) return;
    var hien=(denOnly[f[0]]&&!laDen) ? false : fltHien_(f[0]);   // khối của đèn không áp dụng cho ngành khác
    var dich=hien?box:store;
    if(el.parentNode!==dich) dich.appendChild(el);
    else if(hien) box.appendChild(el);
  });
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
  var f=S.fVs||{};
  el.innerHTML=fltSecs_().map(function(x){
    var k=x[0], on=fltHien_(k), n;
    if(k==='vs_hm') n=Object.keys(S.fNhomSet||{}).filter(function(v){ return S.fNhomSet[v]; }).length;
    else if(k.indexOf('vs_')===0){ var col=k.slice(3); n=Object.keys(f[col]||{}).filter(function(v){ return f[col][v]; }).length; }
    else n=fltActiveN_(k);
    return '<button class="fn-row'+(on?' on':'')+'" onclick="fltToggle_(\''+escJs_(k)+'\')"'
      +' title="'+(on?'Đang hiện trên panel — bấm để ẩn':'Bấm để hiện trên panel')+'">'
      +'<span class="fn-t">'+esc(x[1])+'</span>'+(n?'<span class="fn-n">'+n+'</span>':'')
      +'<span class="fn-sw"></span></button>';
  }).join('');
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
  var dl = imgs[0] ? '<a class="pd-imgdl" href="'+esc(safeUrl_(imgs[0]))+'" target="_blank" rel="noopener" title="Mở ảnh gốc">'+icon('download',14)+'</a>' : '';
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
/* Vệ sinh / sơn nước: nhóm thông số theo HẠNG MỤC của SP — cùng bộ với form Nhập & file mẫu */
function spSpec_(p){ return specNganh_(nganhCuaSP_(p)); }
function vsVal_(p,lb){ var m=spSpec_(p).METRIC[lb]; var v=m&&p.raw?p.raw[m[0]]:''; return (v==null?'':String(v)).trim(); }
function vsNhom_(p){
  var SP=spSpec_(p), h=SP.hmOf(p.hangMuc);
  if(h) return {chinh:h.chinh, tk:h.tk};
  return {chinh:SP.CHINH_ALL, tk:SP.TK_ALL};     // hạng mục lạ: cùng cách chia với server (dòng trống tự ẩn)
}
function pdSpecsVS_(p){
  var VS_SPEC=spSpec_(p);
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
  var docs=prodDocs_(p);
  return '<div class="pd-block pd-docblk"><div class="pd-sec">Tài liệu <i>('+docs.length+' file)</i></div>'
      +(docs.length?'<div class="tl-body">'+docRowsHtml_(docs)+'</div>':'<div class="tl-empty">Sản phẩm chưa có tài liệu — thêm ở Nhập dữ liệu hoặc Sửa sản phẩm.</div>')
    +'</div>'
    +'<div class="pd-price"><span>Đơn giá</span><b>'+money(p.donGiaBan)+' đ</b></div>';
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

// ==== Cột bảng SP có thể ẩn/hiện (giữa cột chọn và cột thao tác) ====
/* ═══ CỘT BẢNG DANH SÁCH SP = ĐÚNG BỘ TRƯỜNG CỦA FORM NHẬP ═══
   Ngoài 4 cột đặc biệt (Ảnh · Sản phẩm · Thông số · Giá đại lý), MỌI trường trong
   DB_GROUPS đều tự sinh ra 1 chip cột + 1 cột sửa được -> form nhập có bao nhiêu
   trường thì bảng có bấy nhiêu chip, thêm trường mới không phải sửa chỗ này.   */

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
  pop.classList.remove('mm-pop');
  pop.innerHTML=mmHtml_(true);
  tnScroll_(pop);
  var sel=nodes.filter(function(t){return t.code===S.node;})[0];
  document.getElementById('treeLabel').textContent=sel?(sel.code+'.'+sel.name):'Chọn hạng mục';
  document.getElementById('treeCnt').textContent='['+pad2(nodeCount(S.node))+']';
}
function toggleTree(){ var p=document.getElementById('treePop'); var mo=(p.style.display==='none');
  if(mo){ S._mmBrowse=null; p.innerHTML=mmHtml_(true); }
  p.style.display=mo?'block':'none';
  if(mo) tnScroll_(p); }
/* mở ra là thấy ngay hạng mục đang chọn, khỏi cuộn tìm */
function tnScroll_(box){
  if(!box) return; var on=box.querySelector('.tnode.on'); if(!on) return;
  var sc=box.querySelector('.tn-list');                       // panel trái cuộn ở .tn-list, ô trên bảng cuộn ở chính popup
  if(sc && sc.scrollHeight>sc.clientHeight+2) box=sc;
  var d=on.getBoundingClientRect().top-box.getBoundingClientRect().top;
  box.scrollTop=Math.max(0, box.scrollTop+d-Math.round(box.clientHeight/2));
}
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
  S.hmNode=code; if(code) qbRecentPush_(code);
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
        return '<div class="bgt-i lvl'+t[2]+(on?' on':'')+'" onclick="hmPick_(\''+escJs_(t[0])+'\')">'
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
function mmCode_(code){ var n=mmNode_(code); return (n&&!n.custom)?n.c:''; }
function mmName_(code){ var n=mmNode_(code); return n?n.t:code; }
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
  var el=document.getElementById('mmNav'); if(el){ el.innerHTML=mmHtml_(false); if(S._mmUI) tnScroll_(el); }
  var tp=document.getElementById('treePop'); if(tp && tp.style.display!=='none') tp.innerHTML=mmHtml_(true);   // ô Hạng mục trên bảng
}
/* Ô chọn hạng mục — DANH SÁCH PHẲNG như bản cũ: xổ ra thấy hết mọi hạng mục,
   thụt lề theo cấp, bấm 1 lần là chọn xong (không phải bấm lần lượt từng cấp).
   Dùng cho ô đề mục panel trái (forTree=false) và ô Hạng mục đầu bảng (true).
   Bản trên bảng có thêm nút thêm / xoá hạng mục tự tạo.                          */
function mmHtml_(forTree){
  var cur=S.node||'', ns=mmNodes_(), st=[];
  st.push('<div class="tn-list">'+ns.map(function(n,i){
    var cnt=(typeof nodeCount==='function')?nodeCount(n.c):0;
    return '<div class="tnode lvl'+n.l+(n.c===cur?' on':'')+'" onclick="mmPick_(\''+escJs_(n.c)+'\')">'
      +'<span class="rd"></span>'
      +'<span class="nm">'+esc(n.custom?n.t:(n.c+'. '+n.t))+'</span>'
      +'<span class="cn">['+pad2(cnt)+']</span>'
      +((n.custom&&forTree)?('<b class="tn-x" title="Xoá hạng mục tự tạo" onclick="event.stopPropagation();delCustomGroup('+i+')">✕</b>'):'')
      +'</div>';
  }).join('')+'</div>');
  // cấp phụ của đề mục đang chọn (loại báo giá của Phần thô, Nhân công / Vật tư)
  if(S.node==='3.1'){
    var lo=ptLoai_(), nhom=(lo.indexOf('dt_')===0)?'dt':'kt';
    st.push(mmPick2_('Loại báo giá',PT_LOAI_NHOM.map(function(g){ return [g[0],g[1],g[2]]; }),nhom,'mmLoai_'));
    var g=PT_LOAI_NHOM.filter(function(x){ return x[0]===nhom; })[0];
    st.push(mmPick2_(g[2],g[3].map(function(x){ return [x[0],x[1],x[2].replace(/^Khái toán (\S)/,function(m,c){ return c.toUpperCase(); })]; }),lo,'mmLoai_'));
  } else if(typeof tkSheetCo_==='function' && tkSheetCo_(S.node)){
    st.push(mmPick2_('Phân loại',[['','','Tất cả'],['nc','1','Nhân công'],['vt','2','Vật tư']],S.sheet||'','mmSheet_'));
  }
  return st.join('')+(forTree?'<button class="mm-add" onclick="addCustomGroup()">＋ Thêm hạng mục</button>':'');
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
  var tuTren=mmTreeOpen_();                      // đang chọn từ ô Hạng mục đầu bảng
  S._mmBrowse=null; pickNode(code);
  var coPhu=(code==='3.1')||(typeof tkSheetCo_==='function'&&tkSheetCo_(code));
  if(!coPhu) S._mmUI=false;                      // đề mục không có cấp phụ -> chọn xong thu gọn
  if(tuTren && coPhu){ var tp=document.getElementById('treePop'); if(tp) tp.style.display='block'; }   // giữ mở để chọn cấp phụ
  renderMM_();
}
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
/* ═══ NÚT TRÒN THU GỌN Ở GÓC PHẢI TỪNG KHỐI ═══
   Khối Hạng mục gập dải tổng tiền, khối Công cụ gập cả hàng nút + chọn cột.
   Nhớ theo máy (qs_fold) như các khối gập khác.                                  */
function blkFold_(key, ten, id){
  return '<button class="blk-fold" data-fold="'+key+'" data-ten="'+esc(ten)+'"'+(id?(' id="'+id+'"'):'')
    +' onclick="foldToggle_(\''+key+'\')" title="Thu gọn '+esc(ten)+'">'
    +'<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg></button>';
}
function foldChipsSync_(){
  var v=foldGet_();
  document.querySelectorAll('.blk-fold[data-fold]').forEach(function(el){
    var gap=!!v[el.dataset.fold];
    el.classList.toggle('on', gap);
    el.title=(gap?'Mở lại ':'Thu gọn ')+(el.dataset.ten||'khối này');
  });
}
function qbGoNode_(code){
  if(qbTab_()==='boc'){ if(code!==S.node) pickNode(code); return; }
  if(code===hmGet_()) return; hmSet_(code); qbRecentSync_();          // Chi phí / Dự án: đổi hạng mục dùng chung
}
// Chi phí / Dự án: nhảy tới 1 dòng trong bảng của tab đang mở và nháy sáng
function qbGotoRow_(id){
  var tab=qbTab_(), l=(S.lines||[]).filter(function(x){ return String(x.lineId)===String(id); })[0];
  if(tab==='boc'){ if(l && l.nhom!==S.node) pickNode(l.nhom); setTimeout(function(){ tkGotoNewRow_(id); },60); return; }
  var hm=hmGet_(); if(l && hm && !(l.nhom===hm || String(l.nhom||'').indexOf(hm+'.')===0)) hmSet_('');   // dòng ngoài hạng mục đang xem -> xem tất cả
  setTimeout(function(){
    var tr=document.querySelector('#v-'+tab+' tr[data-id="'+String(id).replace(/"/g,'')+'"]'); if(!tr) return;
    tr.scrollIntoView({behavior:'smooth',block:'center'});
    tr.classList.remove('qb-flash'); void tr.offsetWidth; tr.classList.add('qb-flash');
    setTimeout(function(){ tr.classList.remove('qb-flash'); },1800);
  },80);
}
function qbFilter_(e){
  if(e&&e.stopPropagation) e.stopPropagation();
  if(typeof sideGet_==='function' && sideGet_()) sideToggle_();      // bộ lọc nằm ở panel trái -> mở panel nếu đang ẩn
  toggleFiltDrop(); qbRightSync_();
}
function pickNode(code){
  S.node=code; qbRecentPush_(code);
  var tp=document.getElementById('treePop'); if(tp) tp.style.display='none';
  renderTree(); renderTable(); setDemucFilter(code);      // ô lọc trái luôn khớp đề mục đang bóc
  hmSet_(code,'boc');                                     // đồng bộ sang các tab khác
}
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
  if(!await xacNhan_('Xoá hạng mục "'+t.name+'"?')) return;
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
/* ═══ BỘ CỘT DÙNG CHUNG CHO NHIỀU BẢNG ═══
   Bóc tách, Chi phí, Dự án, Xuất báo giá đều dùng CHUNG một nút "Chọn nhanh" + một bảng
   thả xuống: bộ "Của tôi" (lưu theo tài khoản qua users.ui_prefs) đứng đầu, rồi các bộ
   dựng sẵn ở TK_PRESETS. Mỗi bảng chỉ khai báo ở đây: danh sách cột, bộ mặc định, cách
   bật/tắt và cách vẽ lại — thêm bảng mới không phải viết lại bảng chọn.
   Bóc tách và Xuất báo giá dùng chung S.cols nên chung luôn bộ cột 'tk'.                */
var COLSET={
  tk:{ ten:'Bóc tách', pref:'tkCols', luon:'ten',
    keys:function(){ return COLS.map(function(c){ return c[0]; }); },
    macdinh:function(){ return COLS.filter(function(c){ return c[2]; }).map(function(c){ return c[0]; }); },
    on:function(k){ return !!(S.cols||{})[k]; },
    set:function(m){ S.cols=S.cols||{}; COLS.forEach(function(c){ S.cols[c[0]]=!!m[c[0]]; }); },
    ve:function(){ try{ renderColChips(); renderTable(); }catch(e){} try{ if(bgVis()) drawBaogia(); }catch(e){} } },
  cp:{ ten:'Chi phí', pref:'cpCols', luon:'ten',
    keys:function(){ return CP_KEYS.slice(); },
    macdinh:function(){ return ['ten','dvt','soLuong','giaNCC','chietKhau','giaDaiLy','lnPct','donGia','thanhTien','lnVnd']; },
    on:function(k){ return !!(S.cpCols||{})[k]; },
    set:function(m){ S.cpCols=S.cpCols||{}; CP_KEYS.forEach(function(k){ S.cpCols[k]=!!m[k]; }); },
    ve:function(){ try{ renderChiphi(); }catch(e){} } },
  da:{ ten:'Dự án', pref:'daCols', luon:'ten',
    keys:function(){ return DA_KEYS.slice(); },
    macdinh:function(){ return ['khuVuc','ten','thuongHieu','moTa','kichThuoc','hinhAnh','dvt','soLuong','donGia','thanhTien']; },
    on:function(k){ return !!(S._daCols||{})[k]; },
    set:function(m){ S._daCols=S._daCols||{}; DA_KEYS.forEach(function(k){ S._daCols[k]=!!m[k]; }); if(typeof daColLuu_==='function') daColLuu_(); },
    ve:function(){ try{ renderDuAn(); }catch(e){} } },
  // Danh sách SP: cột theo ngành đang xem (đèn / vệ sinh / sơn) hoặc bảng công tác Phần thô
  sp:{ ten:'Danh sách SP', pref:'spCols', luon:'ten',
    keys:function(){ return spColList_().map(function(c){ return c[0]; }).filter(function(k){ return k!=='stt'&&k!=='ten'; }); },
    macdinh:function(){ return spPTMode_()?COLSET.sp.keys():Object.keys(spColsDefault_(spNganhCur_())).filter(function(k){ return k!=='ten'; }); },
    on:function(k){ return spColOn_(k); },
    set:function(m){ var pt=spPTMode_(); if(pt) ptOrder2_(); else S._spCols=S._spCols||{};
      COLSET.sp.keys().forEach(function(k){ if(pt) S._ptColsOn[k]=!!m[k]; else S._spCols[k]=!!m[k]; }); spSaveCols_(); },
    ve:function(){ try{ spColChips_(); spRenderHead_(); spFilter(); }catch(e){} } }
};
function csTab_(t){ return COLSET[t]||COLSET.tk; }
function csKeys_(t){ return csTab_(t).keys(); }
function csOn_(t,k){ return csTab_(t).on(k); }
function csDangBat_(t){ return csKeys_(t).filter(function(k){ return csOn_(t,k); }); }
/* Bộ dựng sẵn viết theo key cột của Bóc tách; bảng khác chỉ lấy phần key mình có. */
function csPresetKeys_(t,ps){
  var ks=csKeys_(t);
  if(ps[2]===null) return ks.slice();
  var ds=(ps[2]==='default')?csTab_(t).macdinh():ps[2];
  return ds.filter(function(k){ return ks.indexOf(k)>=0; });
}
function csWant_(t,list){
  var m={}; list.forEach(function(k){ m[k]=1; });
  var l=csTab_(t).luon; if(l) m[l]=1;                 // cột Tên sản phẩm luôn phải có
  return m;
}
function csPresetOn_(t,ps){                          // bộ nào đang khớp đúng với cột đang bật
  var want=csWant_(t,csPresetKeys_(t,ps));
  return csKeys_(t).every(function(k){ return !!csOn_(t,k)===!!want[k]; });
}
function csPresetApply_(t,id){
  var ps=TK_PRESETS.filter(function(x){ return x[0]===id; })[0]; if(!ps) return;
  csTab_(t).set(csWant_(t,csPresetKeys_(t,ps)));
  csPresetClose_(); csTab_(t).ve();
  toast('Đã bật bộ cột: '+ps[1]);
}
/* ═══ BỘ CỘT "CỦA TÔI" — lưu theo TÀI KHOẢN ═══
   Bấm "Lưu cột đang hiện…" -> ghi vào users.ui_prefs.<pref> trên server (đăng nhập máy
   khác vẫn còn), kèm bản dự phòng localStorage theo tên tài khoản. Mỗi lần đăng nhập tự
   bật lại đúng bộ này cho TỪNG bảng.                                                   */
function csMyKey_(t){ var u=String((S.me&&S.me.username)||'').toLowerCase();
  return t==='tk' ? ('qs_tkcols_'+u) : ('qs_cols_'+t+'_'+u); }   // 'tk' giữ khoá cũ để không mất bộ đã lưu
function csMyCols_(t){
  var v=S.me&&S.me.uiPrefs&&S.me.uiPrefs[csTab_(t).pref];
  if(!Array.isArray(v)){ try{ v=JSON.parse(localStorage.getItem(csMyKey_(t))||'null'); }catch(e){ v=null; } }
  if(!Array.isArray(v)) return null;
  var ks=csKeys_(t); v=v.filter(function(k){ return ks.indexOf(k)>=0; });
  return v.length?v:null;
}
function csMyOn_(t){ var v=csMyCols_(t); if(!v) return false;
  var want=csWant_(t,v);
  return csKeys_(t).every(function(k){ return !!csOn_(t,k)===!!want[k]; }); }
// Đăng nhập xong: bật bộ cột của tài khoản (chưa lưu thì về Mặc định — không mang bộ của tài khoản trước)
function csMyApply_(t){ var v=csMyCols_(t); csTab_(t).set(csWant_(t, v||csTab_(t).macdinh())); }
function csMyApplyAll_(){ Object.keys(COLSET).forEach(function(t){ try{ csMyApply_(t); }catch(e){} }); }
function csMyUse_(t){
  if(!csMyCols_(t)) return; csMyApply_(t);
  csPresetClose_(); csTab_(t).ve(); toast('Đã bật bộ cột của tôi');
}
async function csMySave_(t){
  var keys=csDangBat_(t);
  try{ localStorage.setItem(csMyKey_(t), JSON.stringify(keys)); }catch(e){}
  try{
    var r=await api('setMyPref',csTab_(t).pref,keys);
    if(S.me){ var up={}; up[csTab_(t).pref]=keys; S.me.uiPrefs=(r&&r.uiPrefs)||Object.assign({},S.me.uiPrefs,up); }
    toast('Đã lưu '+keys.length+' cột làm mặc định của tài khoản '+((S.me&&S.me.username)||''));
  }catch(e){ toast('Đã lưu trên máy này. Lưu theo tài khoản lỗi: '+e.message); }
  csPresetClose_(); csTab_(t).ve();
}
async function csMyClear_(t){
  if(!await xacNhan_('Xoá bộ cột "Của tôi" của bảng '+csTab_(t).ten+'? Lần sau đăng nhập sẽ dùng bộ Mặc định.')) return;
  try{ localStorage.removeItem(csMyKey_(t)); }catch(e){}
  try{ var r=await api('setMyPref',csTab_(t).pref,null); if(S.me) S.me.uiPrefs=(r&&r.uiPrefs)||{}; }
  catch(e){ if(S.me&&S.me.uiPrefs) delete S.me.uiPrefs[csTab_(t).pref]; }
  csPresetClose_(); csTab_(t).ve(); toast('Đã xoá bộ cột của tôi');
}
/* Nút "Chọn nhanh" — nhãn là tên bộ đang khớp (hoặc "Của tôi") + số cột đang bật */
function csQuickBtn_(t,btnId){
  var ks=csKeys_(t), on=csDangBat_(t).length;
  var cur=TK_PRESETS.filter(function(ps){ return csPresetOn_(t,ps); })[0];
  var nhan=csMyOn_(t)?'Của tôi':(cur?cur[1]:'Chọn nhanh');
  return '<button class="chip-quick" id="'+btnId+'" onclick="csPresetPop_(event,\''+t+'\',\''+btnId+'\')"'
    +' title="Bật cả một bộ cột theo mục đích / bộ cột của tôi">'
    +icon('sliders',13)+'<span>'+esc(nhan)+'</span><b>'+on+'/'+ks.length+'</b><i>▾</i></button>';
}
// Bảng ít cột hơn Bóc tách có thể khiến 2 bộ ra CÙNG một danh sách -> chỉ giữ bộ đầu tiên
function csPresetList_(t){ var da={};
  return TK_PRESETS.filter(function(ps){
    if(ps[2]!==null && ps[2]!=='default' && csPresetKeys_(t,ps).length<2) return false;   // bộ viết cho Bóc tách, bảng này gần như không có cột nào khớp
    var sig=csPresetKeys_(t,ps).slice().sort().join('|');
    if(da[sig]) return false; da[sig]=1; return true; }); }
function csPresetPop_(e,t,btnId){
  if(e&&e.stopPropagation) e.stopPropagation();
  t=t||'tk'; btnId=btnId||'tkPresetBtn';
  if(document.getElementById('tkPresetPop')){ csPresetClose_(); return; }
  var pop=document.createElement('div'); pop.className='fltpop bgtree'; pop.id='tkPresetPop';
  var mine=csMyCols_(t), mineOn=csMyOn_(t), dem=csDangBat_(t).length;
  pop.innerHTML='<div class="bgt-h"><b>Chọn nhanh cột</b><button class="colpop-x" onclick="csPresetClose_()">✕</button></div>'
    +'<div class="bgt-b">'
      // bộ cột RIÊNG của tài khoản — luôn đứng đầu
      +(mine?('<div class="bgt-i lvl1 tkmine'+(mineOn?' on':'')+'" onclick="csMyUse_(\''+t+'\')">'
          +'<span class="nm">'+icon('check',13)+' Của tôi <i class="tkmine-u">'+esc((S.me&&S.me.username)||'')+'</i></span><span class="cn">'+mine.length+' cột</span>'
          +'<span class="rd'+(mineOn?' on':'')+'"></span></div>'):'')
      // Bảng ít cột hơn Bóc tách (Dự án, Chi phí) có thể khiến 2 bộ ra CÙNG một danh sách
      // (vd "Mặc định" và "Báo giá cho khách") -> chỉ giữ bộ đầu tiên, tránh 2 dòng y hệt nhau.
      +(function(){
        return csPresetList_(t).map(function(ps){
          var on=csPresetOn_(t,ps), n=csPresetKeys_(t,ps).length;
          return '<div class="bgt-i lvl1'+(on?' on':'')+'" onclick="csPresetApply_(\''+t+'\',\''+ps[0]+'\')">'
            +'<span class="nm">'+esc(ps[1])+'</span><span class="cn">'+n+' cột</span>'
            +'<span class="rd'+(on?' on':'')+'"></span></div>';
        }).join('');
      })()+'</div>'
    +'<div class="tkmine-f">'
      +'<button class="btn blue sm" onclick="csMySave_(\''+t+'\')"'+(mineOn?' disabled title="Bộ cột đang hiện đã là bộ của bạn"':'')+'>'+icon('check',13)
        +' Lưu '+dem+' cột đang hiện làm mặc định của tôi</button>'
      +(mine?'<button class="btn ghost sm" onclick="csMyClear_(\''+t+'\')">Xoá bộ của tôi</button>':'')
      +'<div class="tkmine-n">Lưu theo tài khoản — lần sau đăng nhập (kể cả máy khác) tự hiện đúng các cột này.</div>'
    +'</div>';
  document.body.appendChild(pop);
  var b=document.getElementById(btnId);
  if(b){ var r=b.getBoundingClientRect(), w=pop.offsetWidth||300, h=pop.offsetHeight;
    var top=r.bottom+6; if(top+h>window.innerHeight-10) top=Math.max(10, r.top-h-6);
    pop.style.top=top+'px'; pop.style.left=Math.max(8,Math.min(r.left, window.innerWidth-w-10))+'px'; }
  S._csBtn=btnId;
  setTimeout(function(){ document.addEventListener('mousedown',tkPresetOutside_); },0);
}
function csPresetClose_(){ tkPresetClose_(); }
/* --- tên cũ vẫn dùng ở Bóc tách --- */
function tkMyColsApply_(){ csMyApplyAll_(); }
function tkPresetOutside_(e){
  if(e.target.closest('#tkPresetPop')) return;
  if(S._csBtn && e.target.closest('#'+S._csBtn)) return;
  tkPresetClose_(); }
function tkPresetClose_(){ var p=document.getElementById('tkPresetPop'); if(p) p.remove(); document.removeEventListener('mousedown',tkPresetOutside_); }
function renderColChips(){
  var el=document.getElementById('colChips'); if(!el) return;
  var on=COLS.filter(function(c){ return S.cols[c[0]]; }).length;
  var nut=csQuickBtn_('tk','tkPresetBtn');
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
/* Giá SP trong danh mục -> giá trên DÒNG bóc tách, đúng mô hình giá của dòng (recalcLine_ / calc_ ở server):
     Giá bán lẻ (donGiaVon) = GIÁ NIÊM YẾT · CK đại lý (chietKhau) = CK của SP  -> giá đại lý = niêm yết × (1 − CK)
     Giá bán mặc định = giá niêm yết (LN 0%).
   Trước đây lấy GIÁ ĐẠI LÝ đặt vào cột "Giá bán lẻ" + CK 0%. SP chưa nhập giá niêm yết thì giữ cách cũ. */
function giaDongTuSP_(p){
  var q=p;
  if(!(Number(p.giaBanLe)>0) && p.recordId!=null){      // đối tượng rút gọn (vd SP đi kèm combo) -> tra SP đầy đủ
    q=(S.products||[]).filter(function(x){ return String(x.recordId)===String(p.recordId); })[0]||p; }
  var le=Number(q.giaBanLe)||0;
  if(le>0) return {donGiaVon:le, chietKhau:Number(q.ckDaiLy)||0, donGiaBan:le};
  var v=Number(p.donGiaVon)||0; return {donGiaVon:v, chietKhau:0, donGiaBan:Number(p.donGiaBan)||v};
}
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
    case 'taiLieu': { var dl=lineDocs_(l); return dl.length
        ? '<button class="tl-badge" onclick="event.stopPropagation();tlPop_(event,\''+escJs_(l.lineId)+'\')" title="Xem '+dl.length+' tài liệu">'+icon('doc',13)+' '+dl.length+'</button>'
        : '<span class="tl-none" title="Sản phẩm chưa có tài liệu">—</span>'; }
    case 'dvt': return esc(l.dvt||'');
    case 'giaNCC': return money(l.donGiaVon);
    case 'chietKhau': return (Number(l.chietKhau)||0)+'%';
    case 'giaDaiLy': return money(giaDaiLy_(l));
    case 'lnPct': return (Number(l.lnPct)||0)+'%';
    case 'donGiaCK': return money(donGiaCK_(l));
    case 'markup': { var dl=giaDaiLy_(l),dg=donGiaCK_(l); return dl>0?Math.round((dg-dl)/dl*100)+'%':'—'; }
    case 'margin': { var dl2=giaDaiLy_(l),dg2=donGiaCK_(l); return dg2>0?Math.round((dg2-dl2)/dg2*100)+'%':'—'; }
    case 'lnVnd': return money((donGiaCK_(l)-giaDaiLy_(l))*(Number(l.soLuong)||0));
    case 'thanhTien': return money(ttBan_(l));
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
  if(key==='ten') return '<td class="td-ten"><div style="display:flex;gap:2px;align-items:center"><input class="cin" value="'+esc(l.ten||'')+'" onchange="editLine(\''+l.lineId+'\',{ten:this.value})">'
    +lnDiffChip_(l)
    +'<button class="pick" title="Chọn sản phẩm từ danh mục" onclick="openPick(\''+l.lineId+'\',event)">⌕</button></div></td>';
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
    return '<td class="num"><input class="cin num ln-in" '+(key==='lnVnd'?'inputmode="numeric"':'type="number" step="any"')+' title="'+ttl+'"'
      +' value="'+(key==='lnVnd'?money(cur):cur)+'" onchange="editProfit_(\''+l.lineId+'\',\''+key+'\',this.value)">'
      +(key==='lnVnd'?'':'<i class="ln-pc">%</i>')+'</td>';
  }
  var cls=(['giaDaiLy','donGiaCK','thanhTien'].indexOf(key)>=0)?'num':(['hinhAnh','nganh','taiLieu'].indexOf(key)>=0?'ct':'');
  return '<td class="'+cls+'">'+cellVal(l,key)+'</td>';
}
function setVat(v){
  v=Number(v)||0; if(!S.cur) return;
  S.cur.vat=v; veLaiSauSua_();
  api('updateProject', S.cur.maDA, {vat:v}).then(function(p){ if(p){ p.vat=v; syncProj(p); } })
    .catch(function(e){ luuLoi_(e,'VAT của dự án'); });
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
  if(String(val==null?'':val).trim()===''){ renderTable(); return; }   // xoá trắng để gõ lại: KHÔNG đặt giá bán = giá vốn
  var v=tkNum_(val);
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
    veLaiSauSua_();
  }
  // Dòng vừa thêm, server chưa trả id thật -> gom thay đổi lại, addProdObj gửi sau khi có id (trước đây gửi 'tmp_..' -> mất)
  if(String(id).indexOf('tmp_')===0){ if(l) l._q=Object.assign(l._q||{},fields); return Promise.resolve(); }
  // Sửa 2 ô cùng dòng thật nhanh: chỉ phản hồi của lần sửa MỚI NHẤT được ghi đè dòng (không nhảy ngược số)
  S._editSeq=S._editSeq||{}; var seq=S._editSeq[id]=(S._editSeq[id]||0)+1;
  return api('updateLine',id,fields).then(function(u){
    if(u){ if(S._editSeq[id]!==seq) return;
      var i=S.lines.findIndex(function(x){return x.lineId===id;}); if(i>=0) S.lines[i]=u; veLaiSauSua_(); }
    else {
      // Server không tìm thấy dòng (đã bị xoá ở nơi khác) -> trước đây mất im lặng, nay báo + đồng bộ lại
      S.lines=S.lines.filter(function(x){ return x.lineId!==id; });
      veLaiSauSua_(); renderActGutter&&renderActGutter();
      toast('Dòng này không còn tồn tại (đã bị xoá) — đã cập nhật lại bảng');
    }
  }).catch(function(e){ toast('Lỗi sửa: '+e.message+' — đã nạp lại số đang lưu');
    var ma=S.cur&&S.cur.maDA; if(ma) api('getLines',ma).then(function(ls){ if(ls&&S.cur&&S.cur.maDA===ma){ S.lines=ls; veLaiSauSua_(); } }).catch(function(){}); });
}

function filterPop(q){ q=(q||'').toLowerCase().trim(); document.querySelectorAll('#fpItems .fi').forEach(function(el){ if(el.classList.contains('all')) return; el.style.display=(!q||(el.dataset.t||'').indexOf(q)>=0)?'':'none'; }); }
function popOutside(e){ if(!e.target.closest('#qs_pop')) closePop(); }
function closePop(){ var p=document.getElementById('qs_pop'); if(p)p.remove(); document.removeEventListener('mousedown',popOutside);
  setMselIcon('fDemuc',false); setMselIcon('fNhom',false); }
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
function spHBarSync_(){ hbarSync_('.sp-card .tbl-wrap','spHBar','spHThumb'); }
function spHBarInit_(){ hbarBind_('.sp-card .tbl-wrap','spHBar','spHThumb'); }

/* ===== THÔNG TIN DỰ ÁN ===== */
/* Cập nhật 1 dự án vừa lưu. CHỈ thay S.cur khi đó đúng là dự án đang mở — trước đây luôn gán
   S.cur=p nên lưu thông tin cho nhóm nhiều bản nháp / đổi tên bản nháp khác làm S.cur nhảy sang
   bản nháp khác trong khi S.lines vẫn của bản cũ. */
function syncProj(p){ if(!p)return; if(S.cur&&S.cur.maDA===p.maDA) S.cur=p; var i=S.projects.findIndex(function(x){return x.maDA===p.maDA;}); if(i>=0)S.projects[i]=p; renderProjSel(); }
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
    return '<button class="draft-tab'+(on?' on':'')+'" onclick="openDraft(\''+escJs_(d.maDA)+'\')">'+icon('doc',12)+' '+esc(draftName_(d,i))+'</button>'; }).join('');
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
    +(gr.drafts.length>1?'<button class="btn ghost sm" onclick="removeProject(\''+escJs_(p.maDA)+'\')">'+icon('trash',13)+' Xoá bản nháp</button>':'')+'</div>'
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
  if(!await openProject_(maDA)) return;
  var p=S.cur;
  renderCard&&renderCard(); renderProjSel&&renderProjSel(); renderDash&&renderDash();
  var ov=document.getElementById('projModalOv');
  if(!ov){ ov=document.createElement('div'); ov.className='sp-modal-ov'; ov.id='projModalOv';
    ov.onclick=function(e){ if(e.target===ov) projModalClose(); }; document.body.appendChild(ov); }
  ov.innerHTML='<div class="sp-modal proj-modal pd"><div class="pd-head"><h3>'+icon('building',16)+' Thông tin dự án</h3><button class="pd-x" onclick="projModalClose()">✕</button></div><div class="proj-modal-b" id="projModalBody">'+projInfoInner_(S.cur, currentGroup())+'</div></div>';
}
function projModalClose(){ var o=document.getElementById('projModalOv'); if(o)o.remove(); }
function projModalRefresh_(){ var b=document.getElementById('projModalBody'); if(b && S.cur){ b.innerHTML=projInfoInner_(S.cur, currentGroup()); } }
// đổi tên bản nháp (modal — không dùng prompt vì 1 số trình duyệt chặn)

/* ═══ HỘP XÁC NHẬN DÙNG CHUNG — THAY confirm() / alert() của trình duyệt ═══
   confirm() hiện tên miền "qs-pro-....onrender.com says", cắt danh sách dài, không tô
   được chỗ nguy hiểm và trên vài trình duyệt còn bị chặn. Hộp này cùng bộ mặt với app.
   Dùng:  if(!await xacNhan_({title:'Xoá dòng?', note:'...', ok:'Xoá', nguyHiem:true})) return;
          await baoLoi_({title:'...', dong:[...]})                                     */
function xacNhan_(o){
  o=(typeof o==='string')?{title:o}:(o||{});
  if(xacNhan_._done) xacNhan_._done(false);
  return new Promise(function(resolve){
    var ov=document.createElement('div'); ov.className='sp-modal-ov'; ov.id='xnOv';
    function done(v){ if(xacNhan_._done===done) xacNhan_._done=null; try{ ov.remove(); }catch(e){} document.removeEventListener('keydown',key); resolve(v); }
    xacNhan_._done=done;
    function key(e){ if(e.key==='Escape') done(false); if(e.key==='Enter') done(true); }
    document.addEventListener('keydown',key);
    ov.onclick=function(e){ if(e.target===ov) done(false); };
    var ds=(o.dong||[]).slice(0,200);
    ov.innerHTML='<div class="sp-modal xn'+(o.nguyHiem?' xn-red':'')+'">'
      +'<div class="xn-h">'+icon(o.nguyHiem?'trash':'bell',18)+'<h3>'+esc(o.title||'Xác nhận')+'</h3></div>'
      +(o.note?'<div class="xn-note">'+esc(o.note).replace(/\n/g,'<br>')+'</div>':'')
      +(ds.length?'<div class="xn-b">'+ds.map(function(t){ return '<div class="xn-i">'+esc(String(t))+'</div>'; }).join('')
          +((o.dong||[]).length>ds.length?'<div class="xn-i more">… và '+((o.dong||[]).length-ds.length)+' dòng nữa</div>':'')+'</div>':'')
      +'<div class="xn-f">'+(o.chiBao?'':'<button class="btn ghost sm" data-x="0">'+esc(o.huy||'Huỷ')+'</button>')
        +'<button class="btn '+(o.nguyHiem?'red':'blue')+'" data-x="1">'+esc(o.ok||(o.chiBao?'Đã hiểu':'Đồng ý'))+'</button></div></div>';
    ov.querySelectorAll('[data-x]').forEach(function(b){ b.onclick=function(){ done(b.getAttribute('data-x')==='1'); }; });
    document.body.appendChild(ov);
    var f=ov.querySelector('[data-x="1"]'); if(f) f.focus();
  });
}
function baoLoi_(o){ o=o||{}; return xacNhan_(Object.assign({}, o, {chiBao:true, nguyHiem:o.nguyHiem!==false})); }
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
      +'<button class="btn blue" data-ask="ok">'+esc(o.confirmText||o.ok||'Xác nhận')+'</button></div></div>';
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
    +'<input class="rn-in" id="rnInput" value="'+esc(cur)+'" placeholder="Tên bản nháp" onkeydown="if(event.key===\'Enter\')rnSave_(\''+escJs_(maDA)+'\')">'
    +'<div class="rn-f"><button class="btn ghost sm" onclick="rnClose_()">Huỷ</button><button class="btn blue" onclick="rnSave_(\''+escJs_(maDA)+'\')">'+icon('check',14)+' Lưu</button></div></div>';
  document.body.appendChild(ov);
  setTimeout(function(){ var el=document.getElementById('rnInput'); if(el){ el.focus(); el.select(); } },40);
}
/* Sửa tên bản nháp NGAY TRÊN CHỮ — người dùng bấm vào tên là muốn đổi tên,
   không phải đi tìm nút bút chì lẫn trong dãy icon. Enter/rời ô = lưu, Esc = huỷ. */
async function draftNameEdit_(ev, maDA){
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
  if(!await openProject_(maDA)) return;
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
     && !await xacNhan_('Link này không thuộc dezon.vn:\n'+shared.linkDezon+'\n\nVẫn lưu?')) return;
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
/* MỞ 1 DỰ ÁN — đường duy nhất để đổi S.cur. Tải dòng xong mới gán S.cur + S.lines cùng lúc,
   và chỉ lần bấm CUỐI được áp: bấm A rồi B nhanh, phản hồi A về sau không đè lên B.
   Trả về true nếu dự án đã được mở (false: không thấy / lỗi / đã bị lần bấm sau thay). */
async function openProject_(maDA){
  var p=(S.projects||[]).filter(function(x){return x.maDA===maDA;})[0]; if(!p) return false;
  var seq=S._openSeq=(S._openSeq||0)+1, lines;
  try{ lines=await api('getLines',maDA)||[]; }
  catch(e){ if(seq===S._openSeq) toast('Không tải được dự án: '+e.message); return false; }
  if(seq!==S._openSeq) return false;
  S.cur=p; S.lines=lines; S._coverDA=null; S.colFilter={};   // lọc cột của dự án trước không áp sang (trước làm bảng trống bí ẩn)
  await projDataLoad_(maDA);
  return seq===S._openSeq;
}
async function pickProject(maDA){ if(!await openProject_(maDA)) return; renderAll(); renderProjSel&&renderProjSel(); showTab('boc'); }
async function removeProject(maDA, ev){
  if(ev&&ev.stopPropagation) ev.stopPropagation();
  if(!await xacNhan_('Xoá bản nháp này?')) return;
  try{ await api('deleteProject',maDA); }
  catch(e){ toast('Lỗi xoá bản nháp: '+e.message); return; }      // trước đây lỗi API rơi im lặng
  if(S.cur&&S.cur.maDA===maDA) S.cur=null;
  try{ projModalClose(); }catch(e){}
  await projReload_(); projRefreshAll_(); toast('Đã xoá bản nháp');
}

/* ── Nhập hàng loạt công tác từ Excel/CSV ── */

/* ═══ DỮ LIỆU RỜI CỦA DỰ ÁN LƯU TRÊN SERVER (du_an_data) ═══
   Bảng phần thô · bảng diện tích · thông tin công tác tự nhập trước đây chỉ nằm trong
   localStorage của MỘT máy: người khác mở cùng dự án thấy trống, xoá cache là mất sạch.
   Nay nạp từ server khi mở dự án và ghi lên server (gộp 1,2 giây để không spam API).   */
// Khoá dùng chung cả công ty (server tách theo công ty đang đăng nhập); còn lại lưu theo dự án
var PD_CTY_KEYS={ptInfo:1, bgOrg:1};
function projDataSet_(khoa, val){
  S._projData=S._projData||{}; S._projData[khoa]=val;
  if(!S.cur||!S.cur.maDA) return;
  // Nhớ dự án + giá trị NGAY LÚC SỬA: đổi dự án trong 1.2s trước đây làm flush ghi undefined vào dự án mới
  S._pdQueue=S._pdQueue||{}; S._pdQueue[khoa]={ma:PD_CTY_KEYS[khoa]?'__cty':S.cur.maDA, val:val};
  clearTimeout(S._pdTimer);
  S._pdTimer=setTimeout(projDataFlush_, 1200);
}
/* Lỗi từ Supabase trả về nguyên cục JSON, cắt ngang 90 ký tự thì ra chuỗi khó hiểu.
   Dịch vài mã hay gặp thành câu ngắn, chi tiết đầy đủ vẫn ghi ở console.        */
function loiServer_(e){
  var m=String((e&&e.message)||e||'');
  if(/42501|permission denied|row-level security/i.test(m)) return 'Bảng du_an_data trên Supabase chưa được cấp quyền ghi (chạy lại db/du_an_data.sql)';
  if(/42P01/.test(m)) return 'Chưa có bảng du_an_data trên Supabase (chạy db/du_an_data.sql)';
  if(/PGRST(20[0-9]|116)/.test(m)) return 'Máy chủ chưa nhận ra bảng du_an_data (chạy lại db/du_an_data.sql)';
  if(/\b401\b|JWT|apikey/i.test(m)) return 'Máy chủ từ chối quyền ghi (401)';
  if(/Failed to fetch|NetworkError|timeout/i.test(m)) return 'Mất kết nối tới máy chủ';
  m=m.replace(/\s+/g,' ').trim();
  return 'Chưa lưu được lên máy chủ: '+(m.length>70?m.slice(0,70)+'…':m);
}
async function projDataFlush_(){
  clearTimeout(S._pdTimer);
  var q=S._pdQueue||{}, ds=Object.keys(q); S._pdQueue={};
  for(var i=0;i<ds.length;i++){
    var k=ds[i];
    try{ await api('setProjData', q[k].ma, k, q[k].val); S._pdLoi=0; }
    catch(e){ if(!S._pdLoi){ S._pdLoi=1; try{ console.error('setProjData',k,e); }catch(x){}
      toast(loiServer_(e)+' — dữ liệu vẫn còn trên máy này'); } }
  }
}
async function projDataLoad_(maDA){
  projDataFlush_();   // đẩy nốt thay đổi đang chờ của dự án cũ (đã nhớ đúng dự án)
  S._projData={}; S._ptKey=null; S._areaDA=null; S._ptInfoU=null; S._dtIn=null;   // buộc nạp lại theo dự án mới
  // Mua hàng: kế hoạch thanh toán / NCC đang chọn / đang mở là của DỰ ÁN CŨ -> bỏ. Không bỏ thì lần lưu kế tiếp
  // ghi bản rỗng (dựng trước khi getProjData về) đè lên kế hoạch thật trên server.
  S._mhPayDA=null; S._mhPay=null; S._mhSel={}; S._mhPayOpen={};
  if(!maDA) return;
  try{
    var d=await api('getProjData', maDA)||{};
    if(!S.cur||S.cur.maDA!==maDA) return;             // đã đổi sang dự án khác trong lúc chờ
    S._projData=d; S._ptKey=null; S._areaDA=null; S._ptInfoU=null;   // bỏ bản đã dựng tạm trong lúc chờ (kể cả thông tin công tác dùng chung)
    S._mhPayDA=null; S._mhPay=null;                                       // kế hoạch thanh toán: đọc lại từ dữ liệu server vừa về
    // Lần đầu chuyển từ localStorage lên server: máy nào còn dữ liệu cũ thì đẩy lên.
    // Đẩy CẢ 4 khoá (trước chỉ đẩy bảng phần thô) -> diện tích, VAT phần thô và thông tin
    // công tác tự nhập cũng hết cảnh chỉ có trên một máy.
    function doc_(k){ try{ return JSON.parse(localStorage.getItem(k)||'null'); }catch(e){ return null; } }
    var day=[];
    var loc=doc_('pt_'+maDA);
    if(!Array.isArray(d.phanTho) && Array.isArray(loc) && loc.length){
      S._projData.phanTho=loc; projDataSet_('phanTho', loc); day.push('bảng phần thô');
    }
    var vat=Number(localStorage.getItem('pt_'+maDA+'_vat'));
    if(d.ptVat==null && isFinite(vat) && vat){ S._projData.ptVat=vat; projDataSet_('ptVat', vat); }
    var ar=doc_('qs_area_'+maDA);
    if((d.area==null) && ar && typeof ar==='object' && Object.keys(ar).length){
      S._projData.area=ar; projDataSet_('area', ar); day.push('bảng diện tích');
    }
    var inf=doc_('qs_ptinfo');
    if((d.ptInfo==null) && inf && typeof inf==='object' && Object.keys(inf).length){
      S._projData.ptInfo=inf; projDataSet_('ptInfo', inf); day.push('thông tin công tác');
    }
    if(day.length) toast('Đã đưa '+day.join(' · ')+' lên máy chủ — từ giờ máy khác cũng xem được');
  }catch(e){ /* chưa chạy db/du_an_data.sql -> dùng bản trong máy như cũ */ }
}

/* ═══ MÀN HÌNH CHỜ (#splash trong index.html) ═══
   Hiện ngay khi mở trang, báo đúng bước đang làm; mờ dần khi đã vẽ xong dữ liệu hoặc khi cần đăng nhập.
   Máy chủ Render ngủ -> lần đầu có thể lâu: sau 6 giây hiện lời nhắc; quá 45 giây thì tự ẩn để không kẹt. */
var SPLASH_T0=Date.now();
function splashStep_(t){ var m=document.getElementById('splashMsg'); if(m) m.textContent=t; }
setTimeout(function(){ var h=document.getElementById('splashHint'), s=document.getElementById('splash');
  if(h && s && !s.classList.contains('hide')) h.textContent='Máy chủ đang khởi động — lần đầu có thể mất 20–30 giây.'; },6000);
setTimeout(function(){ splashDone_(); },45000);
function splashDone_(){
  var s=document.getElementById('splash'); if(!s || s.classList.contains('hide')) return;
  var cho=Math.max(0, 650-(Date.now()-SPLASH_T0));            // hiện tối thiểu ~0.65s cho khỏi chớp
  setTimeout(function(){ s.classList.add('hide'); setTimeout(function(){ if(s.parentNode) s.parentNode.removeChild(s); },600); }, cho);
}
/* ===================== AUTH & ADMIN ===================== */
async function authStart_(){
  var t=authToken();
  if(!t){ showLogin_(); return; }
  splashStep_('Đang xác thực tài khoản…');
  try{ var u=await api('me'); S.me=u; S.congTy=u.congTy||null; onAuthed_(); }
  catch(e){ setAuthToken(''); showLogin_(); }
}
function showLogin_(msg){
  splashDone_();
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
        +'onclick="notifClick('+n.id+',\''+escJs_(k)+'\',\''+escJs_(String(n.refId||''))+'\')">'
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

/* ═══════════════════════════════════════════════════════════════════════════
   BẢNG BÓC TÁCH / CHI PHÍ — thao tác kiểu Excel
   · chọn nhiều dòng (ô tích ở cột STT, giữ Shift để chọn cả vùng)
   · chọn vùng ô rồi Ctrl+C / Ctrl+V / Delete
   · cố định hàng (ngoài cố định cột đã có)
   · thu gọn khối đầu bảng để màn hình rộng hơn
   ═════════════════════════════════════════════════════════════════════════ */
function tdK_(html,k){ return html.replace('<td','<td data-k="'+k+'"'); }
function lineOf_(id){ return (S.lines||[]).filter(function(x){ return x.lineId===id; })[0]; }

/* ---------- ghi giá trị vào 1 ô theo khoá cột ---------- */
function tkNum_(v){ var t=String(v==null?'':v).replace(/[^\d,.\-]/g,'');
  if(/,\d{1,2}$/.test(t)&&t.indexOf('.')>=0) t=t.replace(/\./g,'').replace(',','.');    // 1.234,5
  else if((t.match(/\./g)||[]).length>1) t=t.replace(/\./g,'');                          // 1.234.000
  else if(/\.\d{3}$/.test(t)) t=t.replace(/\./g,'');
  t=t.replace(',','.');
  var n=parseFloat(t); return isNaN(n)?0:n; }

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

/* ═══ Thanh kéo DỌC tự vẽ cho bảng Bóc tách ═══
   Thanh cuộn gốc phải ẩn (nếu bật lại, Chrome mới bỏ qua ::-webkit-scrollbar và
   đẻ thêm một thanh NGANG 17px nằm chồng lên thanh kéo ngang tự vẽ). */
/* ═══ THANH KÉO DỌC TỰ VẼ — DÙNG CHUNG ═══
   Thanh cuộn gốc của trình duyệt bị ẩn (để không đẻ ra 2 thanh chồng nhau), nên mỗi bảng
   cuộn trong khung phải có thanh tự vẽ. Trước chỉ bảng Bóc tách có; nay Chi phí và Dự án
   dùng chung đúng hàm này, chỉ khác id của khung / thanh.                              */
function vbarSync_(hostSel, wrapSel, barId, thId){
  var host=document.querySelector(hostSel), bar=document.getElementById(barId), th=document.getElementById(thId);
  var wrap=host&&host.querySelector(wrapSel);
  if(!host||!bar||!th||!wrap) return;
  var sh=wrap.scrollHeight, ch=wrap.clientHeight;
  // chừa chỗ cho thanh dọc (thanh nằm ĐÈ mép phải) để không che mất cột cuối
  if(wrap.classList.contains('pad-vb')!==(sh>ch+1)) wrap.classList.toggle('pad-vb', sh>ch+1);
  if(sh<=ch+1){ bar.style.display='none'; return; }
  var headH=(wrap.querySelector('tr:first-child th')||{}).offsetHeight||46;
  var nb=host.getBoundingClientRect(), wr=wrap.getBoundingClientRect();
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
function vbarBind_(hostSel, wrapSel, barId, thId){
  var host=document.querySelector(hostSel), bar=document.getElementById(barId), th=document.getElementById(thId);
  var wrap=host&&host.querySelector(wrapSel);
  if(!host||!bar||!th||!wrap) return;
  var sync=function(){ vbarSync_(hostSel,wrapSel,barId,thId); };
  if(wrap.dataset.vb!=='1'){ wrap.dataset.vb='1'; wrap.addEventListener('scroll',sync,{passive:true}); }
  S._vbarResize=S._vbarResize||{};
  if(!S._vbarResize[barId]){ S._vbarResize[barId]=1; window.addEventListener('resize',function(){ vbarSync_(hostSel,wrapSel,barId,thId); }); }
  if(th.dataset.vb!=='1'){
    th.dataset.vb='1';
    th.addEventListener('mousedown',function(e){
      e.preventDefault(); e.stopPropagation();
      var sy=e.clientY, st=wrap.scrollTop;
      var H=bar.clientHeight, tw=th.offsetHeight, maxTop=H-tw, maxScroll=wrap.scrollHeight-wrap.clientHeight;
      th.classList.add('dragging'); document.body.style.cursor='grabbing';
      function mv(ev){ var d=ev.clientY-sy; wrap.scrollTop = st + (maxTop? d*maxScroll/maxTop : 0); sync(); }
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
      wrap.scrollTop = maxTop? pos*maxScroll/maxTop : 0; sync();
    });
  }
  sync();
}
function tkVBarSync_(){ vbarSync_('#tkNormal','.tbl-wrap','tkVBar','tkVThumb'); }
function tkVBarInit_(){ vbarBind_('#tkNormal','.tbl-wrap','tkVBar','tkVThumb'); }

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
// Ô nhập %: trống / không phải số -> null (trước đây ô trống thành 0% và áp luôn)
function pctIn_(v){ var t=String(v==null?'':v).trim().replace(',','.'); if(t==='') return null; var n=Number(t); return isFinite(n)?n:null; }
function lnPickSet_(id,v){
  v=pctIn_(v);
  if(v==null){ toast('Chưa nhập %'); return; }
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
