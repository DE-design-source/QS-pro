/* DECOX QS Pro — logic giao diện mới, nối backend /api/:fn */
'use strict';

/* ===== API ===== */
function api(fn){
  var args = Array.prototype.slice.call(arguments,1);
  return fetch('/api/'+encodeURIComponent(fn),{method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({args:args})})
    .then(function(r){ return r.json().catch(function(){ return {error:'HTTP '+r.status}; }); })
    .then(function(d){ if(d&&d.error) throw new Error(d.error); return d?d.result:null; });
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
var COLS=[
  ['stt','STT',1],['khuVuc','Phòng',1],['maBanVe','Mã số bản vẽ',0],['nganh','Dòng sản phẩm',0],
  ['maSP','Mã sản phẩm',0],['ten','Tên sản phẩm',1],['thuongHieu','Thương hiệu',1],['ncc','Nhà cung cấp',0],
  ['moTa','Thông tin chính',1],['kichThuoc','Thông số thiết kế',1],['hinhAnh','Hình ảnh',1],['dvt','Đơn vị tính',1],
  ['soLuong','Số lượng',1],['giaNCC','Giá bán lẻ',0],['chietKhau','Chiết khấu của đại lý (%)',0],
  ['giaDaiLy','Giá đại lý',0],['lnPct','Lợi nhuận (%)',0],['donGia','Giá bán',1],
  ['ckKhach','Chiết khấu cho khách hàng (%)',0],['donGiaCK','Đơn giá',1],
  ['markup','Lợi nhuận/giá vốn — Markup (%)',0],['margin','Lợi nhuận/giá bán — Margin (%)',0],['lnVnd','Lợi nhuận (VND)',0],
  ['thanhTien','Thành tiền',0],['trangThai','Trạng thái',0],['ghiChu','Ghi chú',0]
];
COLS.forEach(function(c){ S.cols[c[0]]=!!c[2]; });
// Theo Figma: mở sẵn Công suất/Nhiệt độ/Góc chiếu; thu gọn IP/CRI/Điện áp
['ip','cri','volt'].forEach(function(k){ if(S.fsecOpen[k]===undefined) S.fsecOpen[k]=false; });

/* ===== Bộ icon SVG line đồng nhất (kiểu Lucide, theo màu chữ) ===== */
var ICONS={
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
  copy:'<rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>'
};
function icon(name,size){ size=size||16; var p=ICONS[name]; if(!p) return ''; return '<svg class="ico" width="'+size+'" height="'+size+'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+p+'</svg>'; }
// Độ rộng mặc định + cấu hình cột (thứ tự, rộng, lọc) lưu localStorage
var DEFW={stt:66,khuVuc:120,maBanVe:92,nganh:120,maSP:110,ten:190,thuongHieu:110,ncc:120,moTa:186,kichThuoc:150,hinhAnh:104,dvt:84,soLuong:84,giaNCC:104,chietKhau:120,giaDaiLy:104,lnPct:96,donGia:104,ckKhach:130,donGiaCK:104,markup:130,margin:130,lnVnd:120,thanhTien:112,trangThai:104,ghiChu:150};
S.colOrder=null; S.colW={}; S.colFilter={}; S.collapsed={};
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
    renderAll();
  }catch(e){ toast('Lỗi tải: '+e.message); }
}
function renderAll(){ renderProjSel(); renderCard(); renderFilters(); renderCatalog(); renderTree(); renderColChips(); renderFloors(); renderTable(); }

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
function addFloorPopInner_(){
  var existing=floorsList().filter(function(f){return f!=='CHƯA PHÂN TẦNG';});
  var chips=FLOOR_PRESETS.map(function(nm){ var on=existing.indexOf(nm)>=0;
    return '<span class="afl-chip'+(on?' on':'')+'" onclick="addFloorName(this.dataset.n)" data-n="'+esc(nm)+'">'+icon(on?'check':'plus',13)+esc(nm)+'</span>'; }).join('');
  return '<div class="fhdr">Thêm tầng</div>'
    +'<div class="afl-chips">'+chips+'</div>'
    +'<div class="afl-cust"><input id="aflInput" placeholder="Tên tầng khác…" autocomplete="off" onkeydown="if(event.key===\'Enter\'){event.preventDefault();addFloorCustom();}"><button class="btn blue sm" onclick="addFloorCustom()">'+icon('plus',14)+'Thêm</button></div>'
    +'<div class="afl-hint">Bấm chip để thêm nhanh · thêm được nhiều tầng liên tiếp</div>';
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
      nhom:S.node, hangMuc:nodeName(S.node), loai:nodeName(S.node), tang:tang}, 1);
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
function showTab(tab){
  document.querySelectorAll('#nav a, .topnav .right a').forEach(function(a){ a.classList.toggle('active',a.getAttribute('data-tab')===tab); });
  ['boc','project','dash','chiphi','export','import','sanpham','muahang'].forEach(function(v){
    var el=document.getElementById('v-'+v); if(el) el.classList.toggle('on',v===tab);
  });
  if(tab==='project') renderProjects();
  if(tab==='dash') renderDash();
  if(tab==='chiphi') renderChiphi();
  if(tab==='export') renderExport();
  if(tab==='import') renderImport();
  if(tab==='sanpham') renderSanpham();
  if(tab==='muahang') renderMuahang();
}

/* ===== PROJECT ===== */
function renderProjSel(){
  var s=document.getElementById('projSel');
  s.innerHTML = S.projects.length ? S.projects.map(function(p){
    return '<option value="'+esc(p.maDA)+'"'+(S.cur&&S.cur.maDA===p.maDA?' selected':'')+'>'+esc(p.ten)+'</option>';
  }).join('') : '<option>— Chưa có dự án —</option>';
  s.onchange=async function(){ S.cur=S.projects.filter(function(p){return p.maDA===s.value;})[0];
    S.lines=await api('getLines',S.cur.maDA)||[]; renderAll(); };
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
  var all=distinctSpec(field).sort(cmpNum);
  var selN=all.filter(function(v){return stateMap[v];}).length;
  var badge=document.getElementById(badgeId);
  if(badge) badge.textContent = selN ? ('· '+selN+' đã chọn') : (all.length ? ('· '+all.length) : '');
  var html;
  if(!all.length){ html='<span style="color:#9aa;font-size:12px">—</span>'; }
  else{
    html=all.map(function(v){
      var dot=opts.dot?'<span class="dot" style="background:'+opts.dot(v)+'"></span>':'';
      return '<span class="chip'+(opts.wide?' wide':'')+(stateMap[v]?' on':'')+'" '+dataAttr+'="'+esc(v)+'">'+dot+esc(v)+'</span>';
    }).join('');
  }
  el.innerHTML=html;
  el.onclick=function(e){
    var c=e.target.closest('['+dataAttr+']'); if(!c)return; var v=c.getAttribute(dataAttr);
    stateMap[v]=!stateMap[v]; renderFilters(); renderCatalog();
  };
}
// gập/mở 1 nhóm lọc (mặc định MỞ; nhớ trạng thái ở localStorage)
function toggleFsec(key){
  var open=(S.fsecOpen[key]!==false);
  S.fsecOpen[key]=!open;
  try{ localStorage.setItem('qs_fsec', JSON.stringify(S.fsecOpen)); }catch(e){}
  applyFsec();
}
function applyFsec(){
  ['watt','kelvin','angle','ip','cri','volt'].forEach(function(k){
    var s=document.getElementById('sec_'+k); if(s) s.classList.toggle('open', S.fsecOpen[k]!==false);
  });
}
// Nhóm của SP: dùng field Nhóm, nếu rỗng thì lấy "Danh mục: X" trong mô tả
function prodNhom_(p){ if(p&&p.nhom) return p.nhom; var m=/Danh m[uụ]c\s*[:：]\s*([^\n]+)/i.exec((p&&p.moTa)||''); return m?m[1].trim():''; }
function nhomOptions(){ var s={}; S.products.forEach(function(p){ var n=prodNhom_(p); if(n) s[n]=(s[n]||0)+1; }); return s; }
// Lọc "Hạng mục sản phẩm" -> dùng cột "Hạng mục" của Lark (Đèn nội thất / ngoại thất)
function prodHmuc_(p){ return (p&&p.hangMuc)||''; }
function hmucOptions(){ var s={}; S.products.forEach(function(p){ var n=prodHmuc_(p); if(n) s[n]=(s[n]||0)+1; }); return s; }
function renderFilters(){
  // nhóm (multi-select)
  var sel=Object.keys(S.fNhomSet||{}).filter(function(k){return S.fNhomSet[k];});
  var fn=document.getElementById('fNhom');
  if(fn){ var lb=fn.querySelector('.mlabel'); if(lb) lb.textContent = sel.length? (sel.length===1?sel[0]:sel.length+' hạng mục đã chọn') : 'Tất cả hạng mục'; fn.classList.toggle('active',sel.length>0); }
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
  chipGroup('volt','fVolt','nVolt','dienAp',S.fVolt,'data-v',{});
  applyFsec();
  updateInProj_();
  document.getElementById('fMin').oninput=renderCatalog;
  document.getElementById('fMax').oninput=renderCatalog;
  document.getElementById('fSearch').oninput=renderCatalog;
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
  var usedKeys=null;
  if(S.onlyProject){ usedKeys={}; (S.lines||[]).forEach(function(l){ var k=String(l.maSP||l.ten||'').toLowerCase().trim(); if(k) usedKeys[k]=1; }); }
  return S.products.filter(function(p){
    if(hmucSel.length && hmucSel.indexOf(prodHmuc_(p))<0) return false;
    if(usedKeys){ var uk=String(p.ma||p.ten||'').toLowerCase().trim(); if(!usedKeys[uk]) return false; }
    if(S.fBrand && p.thuongHieu!==S.fBrand) return false;
    if(q && (p.ten+' '+p.ma+' '+p.thuongHieu).toLowerCase().indexOf(q)<0) return false;
    if(dk){ var muc=String(p.muc||'').toLowerCase().trim(); if(muc.indexOf(dk)<0) return false; }   // lọc theo cột "Mục" của Lark
    var pr=Number(p.donGiaBan)||0; if(mn&&pr<mn) return false; if(mx&&pr>mx) return false;
    if(watts.length){ var pw=splitVals(p.congSuat); if(!pw.some(function(x){return watts.indexOf(x)>=0;})) return false; }
    if(kels.length){ var pk=splitVals(p.nhietDo); if(!pk.some(function(x){return kels.indexOf(x)>=0;})) return false; }
    if(angs.length){ var pa=splitVals(p.gocChieu); if(!pa.some(function(x){return angs.indexOf(x)>=0;})) return false; }
    if(ips.length){ var pi=splitVals(p.capBaoVe); if(!pi.some(function(x){return ips.indexOf(x)>=0;})) return false; }
    if(cris.length){ var pc=splitVals(p.cri); if(!pc.some(function(x){return cris.indexOf(x)>=0;})) return false; }
    if(volts.length){ var pvv=splitVals(p.dienAp); if(!pvv.some(function(x){return volts.indexOf(x)>=0;})) return false; }
    return true;
  });
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
function toggleInProj(){ S.onlyProject=!S.onlyProject; updateInProj_(); renderCatalog(); }
function updateInProj_(){
  var box=document.getElementById('fInProj'), lb=document.getElementById('fInProjLabel'); if(!lb) return;
  lb.textContent = S.onlyProject ? 'Chỉ đèn trong dự án' : 'Tất cả sản phẩm';
  if(box) box.classList.toggle('active', S.onlyProject);
  setMselIcon('fInProj', S.onlyProject);
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
  var n=0;
  ['fWatt','fKelvin','fAngle','fIP','fCRI','fVolt'].forEach(function(k){
    var m=S[k]||{}; if(Object.keys(m).some(function(x){return m[x];})) n++;
  });
  if(S.fBrand) n++;
  var mn=document.getElementById('fMin'), mx=document.getElementById('fMax');
  if((mn&&+mn.value)||(mx&&+mx.value)) n++;
  return n;
}
function updateCatUI(){
  var n=activeFilterCount();
  var b=document.getElementById('advBadge'); if(b){ b.textContent=n||''; b.style.display=n?'inline-flex':'none'; }
  var c=document.getElementById('advClear'); if(c) c.style.display=n?'inline-block':'none';
}
function clearAllFilters(){
  S.fWatt={}; S.fKelvin={}; S.fAngle={}; S.fIP={}; S.fCRI={}; S.fVolt={}; S.fBrand='';
  var mn=document.getElementById('fMin'); if(mn) mn.value='';
  var mx=document.getElementById('fMax'); if(mx) mx.value='';
  renderFilters(); renderCatalog();
}
// ==== Dropdown "bộ lọc": gập/mở khối lọc (Hạng mục SP, Đèn trong DA, Công suất, Nhiệt độ, Góc chiếu, Thương hiệu, giá) ====
function activeFiltCount_(){
  var n=0;
  ['fWatt','fKelvin','fAngle','fIP','fCRI','fVolt'].forEach(function(k){ if(Object.keys(S[k]||{}).some(function(x){return S[k][x];})) n++; });
  if(S.fBrand) n++;
  var mn=document.getElementById('fMin'), mx=document.getElementById('fMax');
  if((mn&&mn.value)||(mx&&mx.value)) n++;
  if(Object.keys(S.fNhomSet||{}).some(function(k){return S.fNhomSet[k];})) n++;
  if(S.onlyProject) n++;
  return n;
}
function applyFiltDrop(){
  var isPT=(S.node==='3.1');
  var lf=document.getElementById('lightFilters');
  var se=document.getElementById('selExtra');
  var btn=document.getElementById('filtBtn');
  var open=!!S._filtOpen && !isPT;
  if(se) se.style.display=isPT?'none':'';
  if(btn) btn.style.display=isPT?'none':'';
  if(btn) btn.classList.toggle('open',open);
  if(lf){
    lf.style.display=open?'block':'none';
    if(open){
      var pr=document.getElementById('leftCat').getBoundingClientRect();
      var br=btn.getBoundingClientRect();
      lf.style.position='fixed';
      lf.style.top=(br.bottom+6)+'px';
      lf.style.left=(pr.left+12)+'px';
      lf.style.width=Math.max(240,pr.width-24)+'px';
    }
  }
  var bd=document.getElementById('filtBadge');
  if(bd){ var c=activeFiltCount_(); bd.textContent=c?c:''; bd.style.display=c?'':'none'; }
}
function filtOutside_(e){ var t=e.target; if(t&&t.closest&&(t.closest('#lightFilters')||t.closest('#filtBtn'))) return; toggleFiltDrop(); }
function toggleFiltDrop(){
  S._filtOpen=!S._filtOpen; applyFiltDrop();
  document.removeEventListener('mousedown',filtOutside_);
  if(S._filtOpen) setTimeout(function(){ document.addEventListener('mousedown',filtOutside_); },0);
}
function renderCatalog(){
  var isPT=(S.node==='3.1');
  applyFiltDrop();   // ẩn/hiện khối bộ lọc theo trạng thái gập/mở (và ẩn hẳn khi Phần thô)
  var hd=document.querySelector('#leftCat .cat-hd h3'); if(hd) hd.textContent=isPT?'Nội dung công việc':'Hạng mục';
  if(isPT){ renderPTLibrary(); return; }   // Phần thô: hiện thư viện nội dung công việc
  var list=filteredProducts();
  var el=document.getElementById('catList');
  var cc=document.getElementById('catCount'); if(cc) cc.textContent=list.length+' SP';
  updateCatUI();
  if(!list.length){ el.innerHTML='<div class="empty">Không có sản phẩm khớp lọc.</div>'; S._filtered=list; return; }
  el.innerHTML=list.slice(0,300).map(function(p,i){
    var img=p.hinhAnh?'<img class="thumb" src="'+esc(imgSrc1_(p.hinhAnh))+'" onerror="this.style.visibility=\'hidden\'">':'<div class="thumb"></div>';
    var im2=p.hinhAnh?'<img class="thumb" src="'+esc(imgSrc1_(p.hinhAnh))+'" onclick="showDetail('+i+')" style="cursor:pointer" onerror="this.style.visibility=\'hidden\'">':'<div class="thumb" onclick="showDetail('+i+')" style="cursor:pointer"></div>';
    var brand=esc(p.thuongHieu||'');
    return '<div class="citem" draggable="true" ondragstart="prodDragStart(event,'+i+')" ondragend="prodDragEnd()">'
      +'<div class="no">'+(i+1)+'</div>'+im2
      +'<div class="cmid" onclick="showDetail('+i+')" title="Xem chi tiết sản phẩm">'
        +'<div class="nm">'+esc(p.ten)+'</div>'
        +'<div class="meta"><span class="pr">'+money(p.donGiaBan)+' đ</span>'+(brand?'<span class="sz brand">'+brand+'</span>':'')+'</div>'
      +'</div>'
      +'<button class="add" title="Thêm vào bóc tách" onclick="addProduct('+i+')">+</button></div>';
  }).join('');
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
function pdSection_(title, rows){
  var body=rows.filter(function(r){return r[1]!=null && r[1]!=='';}).map(function(r){
    return '<div class="spec"><span class="k">'+esc(r[0])+'</span><span class="v">'+esc(r[1])+'</span></div>';
  }).join('');
  return body?'<div class="pd-block"><div class="pd-sec">'+esc(title)+'</div>'+body+'</div>':'';
}
// Ảnh + mã + tên + Key Product Info
function pdMedia_(p){
  var cong=p.congSuat||parseWatt(p.ten), nd=p.nhietDo||parseKelvin(p.ten);
  var keyItems=[
    ['power', cong + (p.dongRa?(' ('+p.dongRa+(/mA/i.test(p.dongRa)?'':'mA')+')'):'')],
    ['temp', nd + (p.quangThong?(' ('+p.quangThong+(/lm/i.test(p.quangThong)?'':'lm')+')'):'')],
    ['color', p.mauSac],
    ['angle', p.gocChieu]
  ].filter(function(x){ return x[1] && String(x[1]).trim(); });
  // Key Product Info (Thông tin chính) = Công suất, Nhiệt độ màu, Góc chiếu, Màu sắc (icon) + Chất liệu
  var kpiRows=[['Chất liệu',p.chatLieu]].filter(function(r){ return r[1] && String(r[1]).trim(); });
  var keyHtml='';
  if(keyItems.length||kpiRows.length){
    keyHtml='<div class="pd-block"><div class="pd-sec">Key Product Info (Thông tin chính)</div>';
    if(keyItems.length) keyHtml+='<div class="pd-keys">'+keyItems.map(function(x){ return '<div class="pd-key"><span class="ic">'+icon(x[0],16)+'</span><span>'+esc(x[1])+'</span></div>'; }).join('')+'</div>';
    keyHtml+=kpiRows.map(function(r){ return '<div class="spec"><span class="k">'+esc(r[0])+'</span><span class="v">'+esc(r[1])+'</span></div>'; }).join('')+'</div>';
  }
  var img=p.hinhAnh?'<div class="imgbox"><img src="'+esc(imgSrc1_(p.hinhAnh))+'" onerror="this.parentNode.innerHTML=\'<span style=&quot;color:#9aa&quot;>Không tải được ảnh</span>\'"></div>'
    :'<div class="imgbox"><span style="color:#9aa">Không có ảnh</span></div>';
  return img
    +'<div class="pcode">'+esc(p.ma||p.ten)+'</div>'
    +(p.ten?'<div class="pd-name">'+esc(p.ten)+'</div>':'')
    +keyHtml;
}
// Các nhóm thông số — phân nhóm ĐÚNG theo từ điển trường (Google Sheet)
function pdSpecs_(p){
  return pdSection_('Thông số thiết kế',[
      ['Góc nghiêng (°)',p.gocNghieng],['Chiều cao (mm)',p.chieuCao],['Đường kính (mm)',p.duongKinh]])
    +pdSection_('Performance Specifications (Thông số hiệu suất)',[
      ['Quang thông (lm)',p.quangThong],['Chỉ số IP (Chống bụi, nước)',p.capBaoVe],['CRI',p.cri],
      ['Hiệu suất phát quang (lm/W)',p.hieuSuat],['UGR',p.ugr],['SDCM',p.sdcm],['COI',p.coi],
      ['Tuổi thọ',p.tuoiTho],['Loại chip LED',p.chipLed]])
    +pdSection_('Driver (Nguồn LED / Chấn lưu)',[
      ['Lắp nguồn rời',p.lapNguonRoi],['Tên bộ nguồn',p.tenBoNguon],['Mã bộ nguồn',p.maBoNguon],
      ['Hãng bộ nguồn',p.hangBoNguon],['Vị trí lắp nguồn',p.viTriNguon],
      ['Tương thích điều khiển',p.tuongThich],['Dòng ra tối đa (mA)',p.dongRa]])
    +pdSection_('Installation Specifications (Thông số lắp đặt)',[
      ['Lỗ khoét trần (mm)',p.loKhoet],['Cấp bảo vệ điện',p.capBaoVeDien]])
    +(p.moTa && !p.chatLieu && !p.quangThong ? '<div class="pd-block"><div class="pd-sec">Thông số kỹ thuật (mô tả)</div>'+specRows_(p.moTa)+'</div>' : '');
}
function pdPriceFoot_(p){
  return '<div class="pd-price"><span>Đơn giá</span><b>'+money(p.donGiaBan)+' đ</b></div>'
    +(p.linkDatasheet?'<div class="pd-foot"><a href="'+esc(p.linkDatasheet)+'" target="_blank" rel="noopener">'+icon('doc',15)+' Tài liệu kỹ thuật</a></div>':'');
}
// Nội dung chi tiết SP xếp dọc (panel Bóc tách)
function pdContent_(p){ return pdMedia_(p)+pdSpecs_(p)+pdPriceFoot_(p); }
function showDetail(i){
  var p=(S._filtered||[])[i]; if(!p) return;
  S._detailIdx=i;
  var el=document.getElementById('pdPanel');
  document.getElementById('bocGrid').classList.add('detail');
  el.style.display='block';
  el.innerHTML='<div class="pd-head"><h3>Thông tin sản phẩm</h3><button class="pd-x" title="Đóng" onclick="hideDetail()">✕</button></div>'
    +pdContent_(p)
    +'<div class="pd-actions"><button class="btn blue sm" onclick="addProduct('+i+')">'+icon('plus',14)+' Thêm vào bóc tách</button></div>';
}
/* ===== DANH SÁCH SẢN PHẨM ===== */
function renderSanpham(){
  var box=document.getElementById('v-sanpham');
  box.innerHTML='<div class="sechd"><h2>Danh sách sản phẩm</h2><span class="count" id="spCount">[00]</span><span class="sp"></span>'
    +'<input id="spSearch" class="sp-search" placeholder="Tìm tên / mã / thương hiệu…" oninput="spFilter()">'
    +'<button class="btn blue sm" onclick="showTab(\'import\')">＋ Thêm sản phẩm</button></div>'
    +'<div class="panel" style="padding:0;overflow:hidden;max-width:100%"><div class="tbl-wrap"><table class="sp-table">'
    +'<thead><tr><th style="width:64px">Ảnh</th><th>Mã SP</th><th>Tên sản phẩm</th><th>Thương hiệu</th><th>Hạng mục</th><th class="ct">Công suất</th><th class="ct">Nhiệt độ</th><th class="ct">CRI</th><th class="num">Giá đại lý</th><th style="width:84px"></th></tr></thead>'
    +'<tbody id="spBody"></tbody></table></div></div>';
  spFilter();
}
function spFilter(){
  var el=document.getElementById('spSearch'); var q=(el&&el.value||'').toLowerCase().trim();
  var list=(S.products||[]).filter(function(p){ return !q || (p.ten+' '+p.ma+' '+p.thuongHieu+' '+p.ncc).toLowerCase().indexOf(q)>=0; });
  S._spList=list;
  document.getElementById('spCount').textContent='['+pad2(list.length)+']';
  document.getElementById('spBody').innerHTML=list.length?list.map(function(p,i){
    return '<tr class="sp-row" onclick="spModal('+i+')">'
      +'<td class="ct">'+(p.hinhAnh?'<img class="sp-th" src="'+esc(imgSrc1_(p.hinhAnh))+'" onerror="this.style.visibility=\'hidden\'">':'<span class="sp-th"></span>')+'</td>'
      +'<td class="mono">'+esc(p.ma||'')+'</td>'
      +'<td><b>'+esc(p.ten||'')+'</b></td>'
      +'<td>'+esc(p.thuongHieu||'')+'</td>'
      +'<td>'+esc(p.hangMuc||'')+'</td>'
      +'<td class="ct">'+esc(p.congSuat||'')+'</td>'
      +'<td class="ct">'+esc(p.nhietDo||'')+'</td>'
      +'<td class="ct">'+esc(p.cri||'')+'</td>'
      +'<td class="num">'+money(p.donGiaBan)+'</td>'
      +'<td class="ct" onclick="event.stopPropagation()"><button class="sp-act" title="Xem chi tiết" onclick="spModal('+i+')">'+icon('eye',16)+'</button><button class="sp-act del" title="Xoá" onclick="spDelete('+i+')">'+icon('trash',16)+'</button></td>'
    +'</tr>';
  }).join(''):'<tr><td colspan="10" class="empty">Chưa có sản phẩm. Bấm ＋ Thêm sản phẩm.</td></tr>';
}
function spModal(i){
  var p=(S._spList||[])[i]; if(!p) return;
  var ov=document.createElement('div'); ov.className='sp-modal-ov'; ov.id='spModalOv';
  ov.onclick=function(e){ if(e.target===ov) spClose(); };
  ov.innerHTML='<div class="sp-modal sp-modal-wide pd"><div class="pd-head"><h3>Thông tin sản phẩm</h3><button class="pd-x" onclick="spClose()">✕</button></div>'
    +'<div class="pdm-grid">'
      +'<div class="pdm-left">'+pdMedia_(p)+pdPriceFoot_(p)+'</div>'
      +'<div class="pdm-right">'+pdSpecs_(p)+'</div>'
    +'</div></div>';
  document.body.appendChild(ov);
}
function spClose(){ var o=document.getElementById('spModalOv'); if(o)o.remove(); }
async function spDelete(i){
  var p=(S._spList||[])[i]; if(!p) return;
  if(!confirm('Xoá sản phẩm "'+p.ten+'" khỏi danh mục?')) return;
  try{ await api('deleteDbProduct', p.ma||String(p.recordId)); S.products=await api('getProducts')||S.products;
    toast('Đã xoá: '+p.ten); spFilter(); renderFilters&&renderFilters(); renderCatalog&&renderCatalog(); }
  catch(e){ toast('Lỗi xoá: '+e.message); }
}
function hideDetail(){ S._detailIdx=null; document.getElementById('pdPanel').style.display='none'; document.getElementById('bocGrid').classList.remove('detail'); }

/* ===== ADD to takeoff ===== */
async function addProduct(i){ var p=(S._filtered||[])[i]; if(p) await addProdObj(p); }
async function addProductObj(i){ var p=(S._filtered||[])[i]; if(p) await addProdObj(p); }
async function addProdObj(p,floor){
  if(!S.cur){ toast('Chưa chọn dự án — bấm Tạo dự án +'); return; }
  if(floor==null) floor=S.selFloor||'';
  if(floor==='CHƯA PHÂN TẦNG') floor='';
  // cộng dồn SL nếu đã có cùng SP trong cùng hạng mục + tầng
  var same=S.lines.filter(function(l){ return l.nhom===S.node && (l.tang||'')===floor && ((p.ma&&l.maSP&&l.maSP===p.ma)||l.ten===p.ten); })[0];
  if(same){ editLine(same.lineId,{soLuong:(Number(same.soLuong)||0)+1}); toast('+1 số lượng: '+p.ten); return; }
  var prod=Object.assign({},p,{ nhom:S.node, hangMuc:nodeName(S.node), loai:nodeName(S.node), tang:floor, extra:{nganh:p.nhom||''} });
  // ---- Optimistic: hiện dòng NGAY, đồng bộ server chạy nền ----
  var dgVon=Number(p.donGiaVon)||0, dgBan=Number(p.donGiaBan)||0;
  var temp={ lineId:'tmp_'+(S._tmpN=(S._tmpN||0)+1), _pending:true,
    khuVuc:'', maBanVe:'', maSP:p.ma||'', ten:p.ten||'', thuongHieu:p.thuongHieu||'', ncc:p.ncc||'',
    moTa:p.moTa||'', kichThuoc:p.kichThuoc||p.size||'', dvt:p.dvt||'Cái', hinhAnh:p.hinhAnh||'',
    soLuong:1, donGiaVon:dgVon, donGiaBan:dgBan, thanhTienVon:dgVon, thanhTienBan:dgBan, lnPct:0,
    nhom:S.node, hangMuc:nodeName(S.node), tang:floor };
  S.lines.push(temp); renderTree(); renderFloors(); renderTable(); renderCard();
  toast('Đã thêm: '+p.ten);
  api('addLine', S.cur.maDA, prod, 1).then(function(l){
    var i=S.lines.indexOf(temp); if(i>=0) S.lines[i]=l; else S.lines.push(l);
    renderTree(); renderTable(); renderCard();
    if(document.getElementById('v-dash').classList.contains('on')) renderDash();
    if(bgVis()) drawBaogia();
  }).catch(function(e){
    var i=S.lines.indexOf(temp); if(i>=0) S.lines.splice(i,1);
    renderTree(); renderFloors(); renderTable(); renderCard(); toast('Lỗi thêm: '+e.message);
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
  pop.innerHTML=nodes.map(function(t,i){
    var cnt=nodeCount(t.code);
    var del=t.custom?' <b onclick="event.stopPropagation();delCustomGroup('+i+')" style="color:#c33;cursor:pointer">✕</b>':'';
    return '<div class="tnode lvl'+t.lvl+(S.node===t.code?' on':'')+'" onclick="pickNodeIdx('+i+')">'
      +'<span class="nm">'+esc(t.code+'.'+t.name)+'</span><span class="cn">['+pad2(cnt)+']'+del+'</span><span class="rd"></span></div>';
  }).join('')
  +'<div class="tnode lvl1" style="color:var(--blue);font-weight:700" onclick="addCustomGroup()">＋ X. THÊM HẠNG MỤC</div>';
  var sel=nodes.filter(function(t){return t.code===S.node;})[0];
  document.getElementById('treeLabel').textContent=sel?(sel.code+'.'+sel.name):'Chọn hạng mục';
  document.getElementById('treeCnt').textContent='['+pad2(nodeCount(S.node))+']';
}
function toggleTree(){ var p=document.getElementById('treePop'); p.style.display=p.style.display==='none'?'block':'none'; }
function pickNode(code){ S.node=code; document.getElementById('treePop').style.display='none'; renderTree(); renderTable(); setDemucFilter(code); }
function pickNodeIdx(i){ var t=(S._tree||[])[i]; if(t) pickNode(t.code); }
async function addCustomGroup(){
  if(!S.cur){ toast('Chưa chọn dự án'); return; }
  var name=prompt('Tên hạng mục/nhóm mới:'); if(name==null) return; name=name.trim(); if(!name) return;
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
  if(!e.target.closest('#treePop') && !e.target.closest('#treeBtn')){ var p=document.getElementById('treePop'); if(p) p.style.display='none'; }
});

/* ===== COLUMN CHIPS ===== */
function renderColChips(){
  document.getElementById('colChips').innerHTML=COLS.map(function(c){
    return '<span class="chip'+(S.cols[c[0]]?' on':'')+'" onclick="toggleCol(\''+c[0]+'\')">'+esc(c[1])+'</span>';
  }).join('');
}
function bgVis(){ var e=document.getElementById('v-export'); return e && e.classList.contains('on'); }
function toggleCol(k){ S.cols[k]=!S.cols[k]; renderColChips(); renderTable(); if(bgVis()) drawBaogia(); }

/* ===== TAKEOFF TABLE ===== */
function visCols(){ var byK={}; COLS.forEach(function(c){ byK[c[0]]=c; });
  return (S.colOrder||COLS.map(function(c){return c[0];})).map(function(k){ return byK[k]; }).filter(function(c){ return c && S.cols[c[0]]; }); }
// giá đại lý = giá bán lẻ (giá vốn NCC) sau chiết khấu đại lý  |  đơn giá = giá bán sau chiết khấu khách
function giaDaiLy_(l){ return Math.round((Number(l.donGiaVon)||0)*(1-(Number(l.chietKhau)||0)/100)); }
function donGiaCK_(l){ return Math.round((Number(l.donGiaBan)||0)*(1-(Number(l.ckKhach)||0)/100)); }
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
function cellInput(l,key){
  if(key==='moTa') return '<td class="wrap"><textarea class="cin" rows="1" oninput="autoGrow(this)" onchange="editLine(\''+l.lineId+'\',{moTa:this.value})">'+esc(l.moTa||'')+'</textarea></td>';
  if(key==='kichThuoc') return '<td class="wrap"><textarea class="cin" rows="1" oninput="autoGrow(this)" onchange="editLine(\''+l.lineId+'\',{kichThuoc:this.value})">'+esc(l.kichThuoc||'')+'</textarea></td>';
  if(key==='ten') return '<td class="td-ten"><div style="display:flex;gap:2px;align-items:center"><input class="cin" value="'+esc(l.ten||'')+'" onchange="editLine(\''+l.lineId+'\',{ten:this.value})"><button class="pick" title="Chọn sản phẩm từ danh mục" onclick="openPick(\''+l.lineId+'\',event)">⌕</button></div></td>';
  if(TXT_COL[key]){ var f=TXT_COL[key];
    return '<td'+(key==='dvt'?' class="ct"':'')+'><input class="cin'+(key==='dvt'?' dvt-in':'')+'"'+(key==='khuVuc'?' placeholder="Phòng…" list="phongList"':'')+' value="'+esc(l[f]||'')+'" onchange="editLine(\''+l.lineId+'\',{'+f+':this.value})"></td>'; }
  if(NUM_COL[key]){ var f2=NUM_COL[key];
    return '<td class="num"><input class="cin num" type="number" value="'+(Number(l[f2])||0)+'" onchange="editLine(\''+l.lineId+'\',{'+f2+':this.value})"></td>'; }
  var cls=(['giaDaiLy','donGiaCK','lnVnd','thanhTien'].indexOf(key)>=0)?'num':(['hinhAnh','nganh','markup','margin'].indexOf(key)>=0?'ct':'');
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
  if(isPT){ renderPhanTho(); return; }
  var lines=S.lines.filter(function(l){ return l.nhom===code || String(l.nhom||'').indexOf(code+'.')===0; });
  document.getElementById('tkCount').textContent='['+pad2(lines.length)+']';
  var t=document.getElementById('tkTable');
  if(!S.cur){ t.style.width=''; t.innerHTML='<tr><td class="empty">Chưa chọn dự án.</td></tr>'; return; }
  var flt=S.colFilter||{};
  Object.keys(flt).forEach(function(k){ lines=lines.filter(function(l){ return colPlain(l,k)===flt[k]; }); });
  var cols=visCols();
  var numK=['soLuong','giaNCC','giaDaiLy','donGia','donGiaCK','lnVnd','thanhTien'], ctK=['stt','hinhAnh','dvt','chietKhau','lnPct','ckKhach','markup','margin'];
  var groups={};
  lines.forEach(function(l){ var g=(l.tang||'').trim()||'CHƯA PHÂN TẦNG'; (groups[g]=groups[g]||[]).push(l); });
  var order=floorsList().slice();
  Object.keys(groups).forEach(function(g){ if(order.indexOf(g)<0) order.push(g); });
  var totalW=cols.reduce(function(s,c){ return s+colW(c[0]); },0)+44;
  var colg='<colgroup>'+cols.map(function(c){ return '<col style="width:'+colW(c[0])+'px">'; }).join('')+'<col style="width:44px"></colgroup>';
  var head='<tr>'+cols.map(function(c){ var cls=numK.indexOf(c[0])>=0?'num':(ctK.indexOf(c[0])>=0?'ct':'');
    var lbl=c[1];
    return '<th class="thk '+cls+(flt[c[0]]?' fltOn':'')+'" data-k="'+c[0]+'" draggable="true"><span class="thl">'+esc(lbl)+'</span>'
      +'<span class="thflt" title="Lọc cột" onclick="openFilter(event,\''+c[0]+'\')">▾</span><span class="thrsz" data-k="'+c[0]+'"></span></th>'; }).join('')+'<th></th></tr>';
  var body='';
  if(!order.length){ body='<tr><td class="empty" colspan="'+(cols.length+1)+'">Chưa có tầng/hạng mục. Bấm “＋ Tầng”, rồi “＋ Hạng mục” — hoặc thêm sản phẩm từ danh mục bên trái.</td></tr>'; }
  order.forEach(function(g,gi){
    var roman=['I','II','III','IV','V','VI','VII','VIII','IX','X'][gi]||(gi+1);
    var col=S.collapsed[g]?'▸':'▾';
    var gval=(g==='CHƯA PHÂN TẦNG'?'':g), isSel=((S.selFloor||'')===gval);
    var gsum=(groups[g]||[]).reduce(function(s,l){ return s+(Number(l.thanhTienBan)||0); },0);
    body+='<tr class="grp'+(isSel?' selFloor':'')+'" draggable="true" data-g="'+esc(g)+'"><td colspan="'+(cols.length+1)+'" data-f="'+esc(g)+'">'
      +'<span class="gcol" onclick="event.stopPropagation();toggleFloor(this.closest(\'td\').dataset.f)">'+col+'</span> '
      +'<span class="gname" onclick="selectFloor(this.closest(\'td\').dataset.f)" ondblclick="renameFloor(this.closest(\'td\').dataset.f)" title="Bấm để chọn tầng · bấm đúp đổi tên" style="cursor:pointer">'+roman+'. '+esc(g)+'</span>'
      +'<span class="gsel" onclick="selectFloor(this.closest(\'td\').dataset.f)">'+(isSel?'✓ đang thêm':'chọn')+'</span>'
      +'<span class="gsum">Tổng tầng: <b>'+money(gsum)+' đ</b></span></td></tr>';
    if(S.collapsed[g]) return;
    var tkSpacer='<tr class="tk-spacer"><td colspan="'+(cols.length+1)+'"></td></tr>';   // khoảng trắng: 1 ô, KHÔNG kẻ dọc
    body+=tkSpacer;   // dòng khoảng trắng sau header tầng (như PDF)
    (groups[g]||[]).forEach(function(l,ri){
      var hs=S.rowH[l.lineId]?' style="height:'+S.rowH[l.lineId]+'px"':'';
      body+='<tr class="drow'+(ri%2===0?' alt':'')+'" draggable="true" data-id="'+l.lineId+'" data-tang="'+esc(l.tang||'')+'"'+hs+'>'+cols.map(function(c){
        var k=c[0];
        if(k==='stt') return '<td class="ct dragH" title="Kéo để di chuyển dòng"><span class="grip">⠿</span> '+(gi+1)+'.'+(ri+1)+'</td>';
        return cellInput(l,k);
      }).join('')+'<td class="ct actcell"><button class="del" title="Xoá dòng" onclick="delLine(\''+l.lineId+'\')">✕</button><div class="rgrip" data-id="'+l.lineId+'" title="Kéo để chỉnh chiều cao dòng">⇕</div></td></tr>';
    });
    body+=tkSpacer;   // dòng khoảng trắng trước tầng kế (như PDF)
  });
  var selF=(S.selFloor||'').trim();
  body+='<tr class="addrow"><td colspan="'+(cols.length+1)+'">'
    +'<button class="addbtn floor" onclick="openAddFloor(event)">'+icon('plus',15)+'Thêm tầng</button>'
    +'<button class="addbtn item" onclick="addBlankItem()" title="Thêm 1 hạng mục trống vào tầng đang chọn">'+icon('plus',15)+'Thêm hạng mục'
      +(selF?'<span class="addbtn-sub">vào '+esc(selF)+'</span>':'')+'</button>'
    +'</td></tr>';
  t.style.width=totalW+'px';
  t.innerHTML=colg+head+body;
  t.querySelectorAll('td.wrap textarea').forEach(autoGrow);   // ô "Thông tin chính" tự giãn hết dòng
  if(t.rows[0]) t.style.setProperty('--thH', t.rows[0].offsetHeight+'px');  // để dòng tầng dính ngay dưới header
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
     +'</div>';
  }
}
function setVat(v){
  v=Number(v)||0; if(!S.cur) return;
  S.cur.vat=v; renderTable();
  api('updateProject', S.cur.maDA, {vat:v}).then(function(p){ if(p){ p.vat=v; S.cur=p; var i=S.projects.findIndex(function(x){return x.maDA===p.maDA;}); if(i>=0)S.projects[i]=p; } }).catch(function(){});
}
// textarea tự cao theo nội dung (xuống dòng hiện đủ, không cắt)
function autoGrow(t){ if(!t) return; t.style.height='auto'; t.style.height=(t.scrollHeight+2)+'px'; t.style.overflowY='hidden'; }
function editLine(id,fields){
  // ---- Optimistic: cập nhật + render NGAY, đồng bộ server chạy nền ----
  var l=S.lines.filter(function(x){return x.lineId===id;})[0];
  if(l){
    Object.keys(fields).forEach(function(k){ l[k]=fields[k]; });
    var sl=Number(l.soLuong)||0;
    l.thanhTienBan=Math.round(sl*(Number(l.donGiaBan)||0));
    l.thanhTienVon=Math.round(sl*(Number(l.donGiaVon)||0));
    renderTable(); renderCard();
    if(document.getElementById('v-chiphi').classList.contains('on')) renderChiphi();
  }
  api('updateLine',id,fields).then(function(u){
    if(u){ var i=S.lines.findIndex(function(x){return x.lineId===id;}); if(i>=0) S.lines[i]=u; renderTable(); renderCard(); }
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
      addProdObj(p, floor); return; }
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
      function cmv(ev){ S.colW[k]=Math.max(50, sw+(ev.clientX-sx)); renderWidths(); }
      function cup(){ document.removeEventListener('mousemove',cmv); document.removeEventListener('mouseup',cup); saveCols(); }
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
  var name=prompt('Đổi tên tầng:', g); if(name==null)return; name=name.trim(); if(!name||name===g)return;
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
  pop.innerHTML='<div class="fhdr">Lọc: '+esc(lbl)+'</div>'
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
  S._dragProd=p;
  try{
    e.dataTransfer.effectAllowed='copy'; e.dataTransfer.setData('text/plain',p.ten||'');
    var img=p.hinhAnh?'<img src="'+esc(imgSrc1_(p.hinhAnh))+'" onerror="this.style.visibility=\'hidden\'">':'<span class="dg-img"></span>';
    var g=document.createElement('div'); g.className='drag-ghost';
    g.innerHTML=img+'<span class="dg-b"><span class="dg-nm">'+esc(p.ten||'')+'</span><span class="dg-pr">'+money(p.donGiaBan)+' đ</span></span>'
      +'<span class="dg-add">'+icon('plus',14)+'Thả vào bảng</span>';
    document.body.appendChild(g); S._dragGhost=g;
    e.dataTransfer.setDragImage(g, 24, 28);
  }catch(x){}
  var c=e.target.closest('.citem'); if(c)c.classList.add('dragging');
}
function prodDragEnd(){
  S._dragProd=null;
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
function renderProjects(){
  var el=document.getElementById('v-project');
  var head='<div class="sechd"><h2>Thông tin dự án</h2><span class="sp" style="flex:1"></span>'
    +'<button class="btn ghost sm" onclick="showTab(\'dash\')">'+icon('list',14)+' Danh sách dự án</button></div>';
  if(!S.cur){ el.innerHTML=head+'<div class="dash-empty">'+icon('building',40)+'<h3>Chưa chọn dự án</h3><p>Vào <b>Bảng điều khiển</b> để tạo hoặc chọn một bản nháp.</p></div>'; return; }
  var p=S.cur, gr=currentGroup();
  // Header dự án + thanh chuyển bản nháp
  var tabs=gr.drafts.map(function(d,i){ var on=d.maDA===p.maDA;
    return '<button class="draft-tab'+(on?' on':'')+'" onclick="openDraft(\''+esc(d.maDA)+'\')">'+icon('doc',12)+' Bản nháp '+(i+1)+'</button>'; }).join('');
  var switcher='<div class="proj-switch2">'
    +'<div class="ps2-l"><span class="ps2-ic">'+icon('building',20)+'</span>'
      +'<div><div class="ps2-name">'+esc(gr.name)+'</div><div class="ps2-sub">'+esc(p.khachHang||'Chưa có khách hàng')+(p.sdt?' · '+esc(p.sdt):'')+' · '+gr.drafts.length+' bản nháp</div></div></div>'
    +'<div class="ps2-tabs">'+tabs+'<button class="draft-tab add" onclick="addDraftForCur()">'+icon('plus',13)+' Thêm bản nháp</button></div></div>';
  // Thẻ 1 — Thông tin dự án (dùng chung)
  var shared=dbCard_('Thông tin dự án','building','Áp dụng cho tất cả bản nháp của dự án này.',
    '<div class="dbgrid">'+pf_('Tên dự án','pf_ten',p.ten)+pf_('Khách hàng','pf_kh',p.khachHang)+pf_('Số điện thoại','pf_sdt',p.sdt)
    +pf_('Địa chỉ','pf_addr',p.diaChi)+'</div>'
    +'<div class="pf-save"><button class="btn blue" onclick="saveProjectShared(this)">'+icon('check',15)+' Lưu thông tin dự án</button></div>');
  // Thẻ 2 — Thông tin bản nháp này (card tùy biến để có badge mã + nút xoá)
  var draftInner='<div class="dbgrid">'
    +'<div class="field"><label>Trạng thái</label><select id="pf_tt">'+['Bản nháp','Đang thực hiện','Hoàn thành'].map(function(s){return '<option'+(p.trangThai===s?' selected':'')+'>'+s+'</option>';}).join('')+'</select></div>'
    +pf_('VAT (%)','pf_vat',p.vat,'number')+pf_('Mã báo giá','pf_mbg',p.maBaoGia)
    +pf_('Quy mô','pf_qm',p.quyMo)+pf_('Tổng DT XD (m²)','pf_tdt',p.tongDT)+pf_('DT báo giá (m²)','pf_dtbg',p.dtBaoGia)
    +pf_('Nhu cầu','pf_nc',p.nhuCau)+pf_('Phân khúc','pf_pk',p.phanKhuc)+'</div>'
    +'<div class="field" style="margin-top:2px"><label>Ghi chú</label><textarea id="pf_gc" placeholder="Ghi chú cho bản nháp này" style="min-height:56px">'+esc(p.ghiChu||'')+'</textarea></div>'
    +'<div class="pf-prog"><label>Tiến độ</label>'
    +'<input id="pf_prog" type="range" min="0" max="100" value="'+(Number(p.tienDo)||0)+'" oninput="document.getElementById(\'pf_pv\').textContent=this.value+\'%\'">'
    +'<b id="pf_pv">'+(Number(p.tienDo)||0)+'%</b><button class="btn ghost sm" onclick="saveProgress(this)">Cập nhật</button></div>'
    +'<div class="pf-save"><button class="btn blue" onclick="saveDraftInfo(this)">'+icon('check',15)+' Lưu bản nháp</button></div>';
  var draft='<div class="dbcard"><div class="dbcard-h"><span class="dbcard-ic">'+icon('doc',18)+'</span><h3>Thông tin bản nháp — Bản nháp '+(gr.idx+1)+'</h3>'
    +'<span class="ps2-badge">'+esc(p.maDA)+'</span><span class="sp" style="flex:1"></span>'
    +(gr.drafts.length>1?'<button class="btn ghost sm" onclick="removeProject(\''+esc(p.maDA)+'\')">'+icon('trash',13)+' Xoá bản nháp</button>':'')+'</div>'
    +'<div class="dbcard-b">'+draftInner+'</div></div>';
  el.innerHTML=head+switcher+shared+draft;
}
// Mở 1 bản nháp (ở lại trang Thông tin dự án)
async function openDraft(maDA){
  var p=(S.projects||[]).filter(function(x){return x.maDA===maDA;})[0]; if(!p) return;
  S.cur=p; S.lines=await api('getLines',maDA)||[]; S._coverDA=null;
  renderCard(); renderProjects(); renderDash();
  if(document.getElementById('v-boc').classList.contains('on')) renderAll();
}
// Thêm bản nháp cho dự án đang mở
async function addDraftForCur(){
  var gr=currentGroup(); if(!gr) return;
  try{ var p=await api('createProject',{ten:gr.name,khachHang:S.cur.khachHang,sdt:S.cur.sdt,diaChi:S.cur.diaChi,vat:Number(S.cur.vat)||0});
    S.cur=p; S.lines=[]; await boot(); renderProjects(); renderDash(); toast('Đã thêm bản nháp mới'); }catch(e){ toast('Lỗi: '+e.message); }
}
// Lưu thông tin dự án -> áp dụng cho MỌI bản nháp (giữ nhóm nhất quán)
async function saveProjectShared(btn){
  var g=function(id){var e=document.getElementById(id);return e?e.value:'';};
  var shared={ten:g('pf_ten'),khachHang:g('pf_kh'),sdt:g('pf_sdt'),diaChi:g('pf_addr')};
  var gr=currentGroup(); if(!gr) return; btn.disabled=true;
  try{
    for(var i=0;i<gr.drafts.length;i++){ var pp=await api('updateProject',gr.drafts[i].maDA,shared); syncProj(pp); }
    renderCard(); renderProjects(); renderDash(); toast('Đã lưu thông tin dự án ('+gr.drafts.length+' bản nháp)');
  }catch(e){ toast('Lỗi: '+e.message); } btn.disabled=false;
}
// Lưu thông tin của riêng bản nháp đang mở
async function saveDraftInfo(btn){
  var g=function(id){var e=document.getElementById(id);return e?e.value:'';};
  var data={trangThai:g('pf_tt'),vat:Number(g('pf_vat'))||0,maBaoGia:g('pf_mbg'),quyMo:g('pf_qm'),tongDT:g('pf_tdt'),dtBaoGia:g('pf_dtbg'),nhuCau:g('pf_nc'),phanKhuc:g('pf_pk'),ghiChu:g('pf_gc')};
  btn.disabled=true; try{ var p=await api('updateProject',S.cur.maDA,data); syncProj(p); renderCard(); renderProjects(); toast('Đã lưu bản nháp'); }catch(e){ toast('Lỗi: '+e.message); } btn.disabled=false;
}
async function saveProgress(btn){ var v=Number(document.getElementById('pf_prog').value)||0;
  try{ var p=await api('updateProject',S.cur.maDA,{tienDo:v}); syncProj(p); renderCard(); toast('Đã cập nhật tiến độ '+v+'%'); }catch(e){ toast('Lỗi: '+e.message); } }
async function pickProject(maDA){ S.cur=S.projects.filter(function(p){return p.maDA===maDA;})[0]; S.lines=await api('getLines',maDA)||[]; S._coverDA=null; renderAll(); showTab('boc'); }
async function removeProject(maDA){ if(!confirm('Xoá bản nháp này?'))return; await api('deleteProject',maDA); if(S.cur&&S.cur.maDA===maDA)S.cur=null; await boot(); renderDash(); renderProjects(); }

/* ===== DASHBOARD ===== */
function card(t,n){ return '<div class="scard"><div class="n">'+n+'</div><div class="t">'+t+'</div></div>'; }
// Gom bản nháp theo Dự án (cùng tên dự án = cùng 1 dự án)
function projectGroups(){
  var groups={}, order=[];
  (S.projects||[]).forEach(function(p){
    var key=String(p.ten||'(Chưa đặt tên)').trim().toLowerCase();
    if(!groups[key]){ groups[key]={name:p.ten||'(Chưa đặt tên)', khachHang:p.khachHang, diaChi:p.diaChi, sdt:p.sdt, drafts:[]}; order.push(key); }
    var g=groups[key]; g.drafts.push(p);
    if(p.khachHang) g.khachHang=p.khachHang; if(p.diaChi) g.diaChi=p.diaChi; if(p.sdt) g.sdt=p.sdt;
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
        +'<div class="draft-info"><b>Bản nháp '+(i+1)+'</b><span class="draft-code">'+esc(p.maDA)+' · '+fmtDate(p.ngayTao)+'</span></div>'
        +'<div class="draft-act">'
        +(on?'<span class="draft-badge">'+icon('check',12)+' Đang dùng</span>'
            :'<button class="btn blue xs" onclick="pickProject(\''+esc(p.maDA)+'\')">Dùng</button>')
        +'<button class="btn ghost xs iconbtn" title="Nhân bản bản nháp" onclick="duplicateDraft(\''+esc(p.maDA)+'\')">'+icon('copy',12)+'</button>'
        +'<button class="btn ghost xs iconbtn" title="Xoá bản nháp" onclick="removeProject(\''+esc(p.maDA)+'\')">'+icon('trash',12)+'</button></div></div>';
    }).join('');
    return '<div class="proj-card2">'
      +'<div class="proj-head2"><span class="proj-ic">'+icon('building',17)+'</span>'
        +'<div class="proj-ht"><div class="proj-name">'+esc(g.name)+'</div>'
          +'<div class="proj-meta">'+esc(g.khachHang||'Chưa có khách hàng')+(g.sdt?' · '+esc(g.sdt):'')+'</div></div>'
        +'<span class="proj-count">'+g.drafts.length+' bản nháp</span></div>'
      +'<div class="draft-list">'+drafts+'</div>'
      +'<button class="btn ghost sm proj-add" onclick="addDraft('+gi+')">'+icon('plus',13)+' Thêm bản nháp</button></div>';
  }).join('') || '<div class="empty" style="padding:26px;text-align:center;color:var(--muted)">Chưa có dự án. Bấm <b>"Tạo dự án"</b> để bắt đầu.</div>';
  return '<div class="dbcard"><div class="dbcard-h"><span class="dbcard-ic">'+icon('home',18)+'</span><h3>Danh sách dự án</h3>'
    +'<span class="ps2-badge">'+pad2(groups.length)+'</span><span class="sp" style="flex:1"></span>'
    +'<button class="btn blue sm" onclick="openCreate()">'+icon('plus',14)+' Tạo dự án</button></div>'
    +'<div class="dbcard-b"><div class="proj-grid">'+cards+'</div></div></div>';
}
// Thêm 1 bản nháp (phương án báo giá mới) cho dự án đang có
async function addDraft(gi){
  var g=(S._projGroups||[])[gi]; if(!g) return;
  try{
    var p=await api('createProject',{ten:g.name, khachHang:g.khachHang, sdt:g.sdt, diaChi:g.diaChi, vat:0});
    S.cur=p; S.lines=[]; await boot(); renderDash(); renderProjects();
    toast('Đã thêm bản nháp mới cho "'+g.name+'"');
  }catch(e){ toast('Lỗi: '+e.message); }
}
// Nhân bản 1 bản nháp (copy toàn bộ hạng mục + tờ bìa sang bản nháp mới)
async function duplicateDraft(maDA){
  try{
    toast('Đang nhân bản…');
    var p=await api('duplicateProject',maDA);
    S.cur=p; S._coverDA=null;
    await boot(); renderDash(); renderProjects();
    toast('Đã nhân bản ('+ ((S.lines||[]).length) +' hạng mục)');
  }catch(e){ toast('Lỗi nhân bản: '+e.message); }
}
function kpi(ic,label,val,accent){ return '<div class="kpi"><div class="kpi-ic '+(accent||'')+'">'+ic+'</div><div class="kpi-b"><div class="kpi-n">'+val+'</div><div class="kpi-t">'+esc(label)+'</div></div></div>'; }
function renderDash(){
  var el=document.getElementById('v-dash');
  var drafts=draftListHtml();
  var header='<div class="sechd"><h2>Bảng điều khiển</h2><span class="sp" style="flex:1"></span>'
    +'<button class="btn blue sm" onclick="openCreate()">'+icon('plus',14)+' Tạo dự án</button></div>';
  if(!S.cur){
    el.innerHTML=header
      +'<div class="dash-empty">'+icon('layers',40)+'<h3>Chưa chọn bản nháp</h3><p>Chọn một bản nháp trong dự án bên dưới để xem tổng quan — hoặc tạo dự án mới.</p></div>'
      +drafts;
    return;
  }
  var von=0,ban=0,kl=0,groups={}; S.lines.forEach(function(l){ von+=l.thanhTienVon;ban+=l.thanhTienBan;kl+=l.soLuong; var k=l.nhom||'Khác'; (groups[k]=groups[k]||{ban:0}).ban+=l.thanhTienBan; });
  var gr=currentGroup();
  var byG=Object.keys(groups).map(function(k){return {k:k,ban:groups[k].ban};}).sort(function(a,b){return b.ban-a.ban;});
  var max=byG.reduce(function(m,g){return Math.max(m,g.ban);},1);
  var bars=byG.map(function(g){ return '<div style="margin:11px 0"><div style="display:flex;justify-content:space-between;font-size:13px"><span>'+esc(nodeName(g.k))+'</span><b>'+money(g.ban)+' đ</b></div><div style="height:10px;background:#eef2f6;border-radius:6px;overflow:hidden;margin-top:5px"><i style="display:block;height:100%;width:'+(g.ban/max*100)+'%;background:var(--blue);border-radius:6px"></i></div></div>'; }).join('')||'<div class="empty">Chưa có hạng mục nào trong bản nháp này.</div>';
  var banner='<div class="dash-banner"><div class="db-l"><div class="db-eyebrow">Đang làm việc</div>'
    +'<div class="db-title">'+icon('building',18)+esc(S.cur.ten)+'<span class="db-sep">›</span>Bản nháp '+((gr?gr.idx:0)+1)+'</div>'
    +'<div class="db-code">'+esc(S.cur.maDA)+' · Tạo '+fmtDate(S.cur.ngayTao)+'</div></div>'
    +'<div class="db-r"><button class="btn light sm" onclick="showTab(\'project\')">'+icon('doc',14)+' Thông tin</button>'
    +'<button class="btn white sm" onclick="showTab(\'boc\')">'+icon('layers',14)+' Mở bóc tách</button></div></div>';
  var kpis='<div class="kpis">'
    +kpi(icon('list',18),'Số hạng mục',S.lines.length,'blue')
    +kpi(icon('layers',18),'Tổng khối lượng',kl,'blue')
    +kpi(icon('lock',18),'Giá trị vốn',money(von)+' đ','')
    +kpi(icon('money',18),'Tổng giá bán',money(ban)+' đ','')
    +kpi(icon('gauge',18),'Lợi nhuận',money(ban-von)+' đ','green')+'</div>';
  el.innerHTML=header+banner+kpis
    +dbCard_('Giá trị theo nhóm (giá bán)','gauge','', '<div class="dash-bars">'+bars+'</div>')
    +drafts;
}

/* ===== CHI PHÍ (bảng linh hoạt + chip chọn cột) ===== */
function cpIn(l,field,w){ return '<input class="cin num" type="number"'+(w?' style="width:'+w+'px"':'')+' value="'+(Number(l[field])||0)+'" onchange="editLine(\''+l.lineId+'\',{'+field+':this.value})">'; }
function cpToggle(k){ S.cpCols=S.cpCols||{}; S.cpCols[k]=!S.cpCols[k]; renderChiphi(); }
var CP_COLS=[
  ['ten','Tên sản phẩm','l',function(l){return '<b>'+esc(l.ten||'')+'</b>';}],
  ['dvt','ĐVT','c',function(l){return esc(l.dvt||'');}],
  ['soLuong','SL','n',function(l){return l.soLuong||0;}],
  ['giaNCC','Giá bán lẻ NCC','n',function(l){return money(l.donGiaVon);}],
  ['chietKhau','CK đại lý %','n',function(l){return (Number(l.chietKhau)||0);}],
  ['giaDaiLy','Giá đại lý','n',function(l){return money(giaDaiLy_(l));}],
  ['donGiaVon','Đơn giá vốn','n',function(l){return cpIn(l,'donGiaVon');}],
  ['lnPct','% LN','n',function(l){return cpIn(l,'lnPct',66);}],
  ['donGiaBan','Đơn giá bán','n',function(l){return cpIn(l,'donGiaBan');}],
  ['ckKhach','CK khách %','n',function(l){return (Number(l.ckKhach)||0);}],
  ['donGiaCK','Đơn giá (báo khách)','n',function(l){return money(donGiaCK_(l));}],
  ['markup','Markup %','n',function(l){return (Number(l.markup)||0);}],
  ['margin','Margin %','n',function(l){return (Number(l.margin)||0);}],
  ['lnVnd','Lợi nhuận (VND)','n',function(l){return money(l.lnVnd);}],
  ['thanhTienVon','TT vốn','n',function(l){return money(l.thanhTienVon);}],
  ['thanhTien','TT bán','n',function(l){return money(l.thanhTienBan);}]
];
function renderChiphi(){
  var box=document.getElementById('v-chiphi');
  if(!S.cur){ box.innerHTML='<div class="empty" style="padding:26px;text-align:center">Chưa chọn dự án.</div>'; return; }
  if(!S.cpCols) S.cpCols={ten:1,dvt:1,soLuong:1,donGiaVon:1,lnPct:1,donGiaBan:1,thanhTienVon:1,thanhTien:1};
  var vis=CP_COLS.filter(function(c){ return S.cpCols[c[0]]; });
  var von=0,ban=0; S.lines.forEach(function(l){ von+=Number(l.thanhTienVon)||0; ban+=Number(l.thanhTienBan)||0; });
  var lnT=ban-von, bien=ban>0?(lnT/ban*100):0;
  var chips=CP_COLS.map(function(c){ return '<span class="chip'+(S.cpCols[c[0]]?' on':'')+'" onclick="cpToggle(\''+c[0]+'\')">'+esc(c[1])+'</span>'; }).join('');
  var head='<tr>'+vis.map(function(c){ return '<th class="'+(c[2]==='n'?'num':(c[2]==='c'?'ct':''))+'">'+esc(c[1])+'</th>'; }).join('')+'</tr>';
  var rows=S.lines.map(function(l){ return '<tr>'+vis.map(function(c){ return '<td class="'+(c[2]==='n'?'num':(c[2]==='c'?'ct':(c[0]==='ten'?'td-ten':'')))+'">'+c[3](l)+'</td>'; }).join('')+'</tr>'; }).join('');
  box.innerHTML='<div class="sechd"><h2>Chi phí</h2><span class="sp"></span><span style="color:var(--muted);font-size:13px">Sửa giá vốn · % LN · giá bán · bấm chip để hiện/ẩn cột</span></div>'
    +'<div class="stat">'+card('Giá trị vốn',money(von)+' đ')+card('Tổng giá bán',money(ban)+' đ')+card('Lợi nhuận',money(lnT)+' đ')+card('Biên LN',bien.toFixed(1)+'%')+'</div>'
    +'<div class="colchips" style="max-height:none">'+chips+'</div>'
    +'<div class="tbl-wrap"><table class="tk">'+head
    +(S.lines.length?rows:'<tr><td class="empty" colspan="'+vis.length+'">Chưa có hạng mục.</td></tr>')+'</table></div>';
}

/* ===== MUA HÀNG (gom theo Nhà cung cấp) ===== */
function mhPrice(l){ return giaDaiLy_(l)||Number(l.donGiaVon)||Number(l.donGiaBan)||0; }
function mhSub_(items){ return items.reduce(function(a,l){ return a+(Number(l.soLuong)||0)*mhPrice(l); },0); }
function mhTot_(items,vatPct){ var s=mhSub_(items); return s+Math.round(s*vatPct/100); }
function mhOn_(ncc){ return !(S._mhSel&&S._mhSel[ncc]===false); }
/* Thẻ NCC — dùng lại frontend thẻ của trang Nhập dữ liệu (.dbcard + icon chip) */
function muahangCard(g, gi, vatPct){
  var ncc=g.ncc, items=g.items, sub=0;
  var rows=items.map(function(l,i){
    var dg=mhPrice(l), sl=Number(l.soLuong)||0, tt=sl*dg; sub+=tt;
    var im=String(l.hinhAnh||'').split('\n')[0];
    var img=im?'<img class="mhp-img" src="'+esc(imgUrlOf(im))+'" onerror="this.style.visibility=\'hidden\'">':'<span class="mhp-img ph"></span>';
    var spec=[l.moTa,l.kichThuoc].map(function(x){return String(x||'').trim();}).filter(Boolean).join(' · ');
    var sub2=[l.khuVuc,l.thuongHieu].map(function(x){return String(x||'').trim();}).filter(Boolean).join(' · ');
    return '<tr>'
      +'<td class="c mut">'+(gi+1)+'.'+(i+1)+'</td>'
      +'<td class="c">'+img+'</td>'
      +'<td><div class="mhp-name">'+esc(l.ten||'')+'</div>'
        +(sub2?'<div class="mhp-sub">'+esc(sub2)+'</div>':'')
        +(spec?'<div class="mhp-spec">'+esc(spec).replace(/\n/g,' ')+'</div>':'')+'</td>'
      +'<td class="c">'+esc(l.dvt||'Cái')+'</td>'
      +'<td class="c b">'+sl+'</td>'
      +'<td class="n">'+money(dg)+'</td>'
      +'<td class="n b">'+money(tt)+'</td></tr>';
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
        +'<thead><tr><th class="c">#</th><th class="c">Ảnh</th><th>Sản phẩm</th><th class="c">ĐVT</th><th class="c">SL</th><th class="n">Đơn giá</th><th class="n">Thành tiền</th></tr></thead>'
        +'<tbody>'+(rows||'<tr><td colspan="7" class="empty">—</td></tr>')+'</tbody>'
        +'<tfoot><tr class="mhf-vat"><td colspan="5"></td><td class="n">VAT '+vatPct+'%</td><td class="n">'+money(vat)+'</td></tr>'
        +'<tr class="mhf-tot"><td colspan="5"></td><td class="n">TỔNG</td><td class="n">'+money(tot)+'</td></tr></tfoot>'
      +'</table></div>'
      +'<div class="mhc-f"><button class="btn navy sm" onclick="mhSend('+gi+',this)">'+icon('cart',15)+' Gửi mua hàng NCC này</button></div>'
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
  var code=S.node;
  var lines=S.lines.filter(function(l){ return l.nhom===code || String(l.nhom||'').indexOf(code+'.')===0; });
  var vatPct=Number(S.cur.vat)||0;
  var groups={}, order=[];
  lines.forEach(function(l){ var s=String(l.ncc||l.thuongHieu||'Khác').trim()||'Khác'; if(!groups[s]){groups[s]=[];order.push(s);} groups[s].push(l); });
  S._mhGroups=order.map(function(k){ return {ncc:k, items:groups[k]}; });
  var grand=order.reduce(function(sum,k){ return sum+mhTot_(groups[k],vatPct); },0);
  function stat(v,l){ return '<div class="imp-stat"><div class="imp-stat-v">'+v+'</div><div class="imp-stat-l">'+l+'</div></div>'; }
  var statbar='<div class="imp-statbar">'
    +'<div class="imp-nganh"><label>Hạng mục</label><div class="msel" style="min-width:210px"><span class="mlabel">'+icon('layers',15)+' '+esc(nodeName(code))+'</span><span class="mplus">▾</span></div></div>'
    +stat(pad2(order.length),'Nhà cung cấp')+stat(pad2(lines.length),'Sản phẩm')
    +stat('<span style="color:var(--blue)">'+money(grand)+'</span>','Tổng tiền (VAT)')+'</div>';
  var cards=S._mhGroups.map(function(g,gi){ return muahangCard(g, gi, vatPct); }).join('')
    || '<div class="empty" style="padding:34px;text-align:center;background:#fff;border:1px solid var(--line);border-radius:14px">Chưa có sản phẩm trong hạng mục này.<br>Vào tab <b>Bóc tách</b> thêm sản phẩm trước.</div>';
  box.innerHTML=statbar+'<div class="imp-layout"><div class="mhcol">'+cards+'</div>'+mhSummary(S._mhGroups,vatPct,grand)+'</div>';
}
function mhToggle(gi){ var g=(S._mhGroups||[])[gi]; if(!g) return; S._mhSel=S._mhSel||{}; S._mhSel[g.ncc]=!(S._mhSel[g.ncc]!==false); renderMuahang(); }
function mhOrderOf(g){
  var vatPct=Number(S.cur&&S.cur.vat)||0;
  var sub=g.items.reduce(function(s,l){ return s+(Number(l.soLuong)||0)*mhPrice(l); },0);
  var vat=Math.round(sub*vatPct/100);
  return { supplier:g.ncc, vatPct:vatPct, vat:vat, total:sub+vat,
    items:g.items.map(function(l){ return {ten:l.ten||'', ma:l.maSP||'', thuongHieu:l.thuongHieu||'', khuVuc:l.khuVuc||'', hinhAnh:String(l.hinhAnh||'').split('\n')[0], sl:Number(l.soLuong)||0, dvt:l.dvt||'Cái', donGia:mhPrice(l)}; }) };
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
function coverAddSmall(){ S.cover.push({stt:'',hangMuc:'Mục nhỏ',moTa:'',chiPhi:0}); drawBaogia(); }
async function coverReload(btn){ if(btn)btn.disabled=true; try{ S.cover=await api('buildCoverFromTemplate',S.cur.maDA)||[]; S._coverDA=S.cur.maDA; drawBaogia(); toast('Đã nạp mẫu + tự cộng chi phí'); }catch(e){ toast('Lỗi: '+e.message); } if(btn)btn.disabled=false; }
async function coverSave(btn){ btn.disabled=true; try{ S.cover=await api('saveCover',S.cur.maDA,S.cover)||S.cover; toast('Đã lưu tờ bìa'); drawBaogia(); }catch(e){ toast('Lỗi: '+e.message); } btn.disabled=false; }

/* --- bảng tờ bìa: Mẫu 2 (phân cấp phẳng) --- */
function coverTableM2(comp){
  var cost=comp.cost, total=comp.total;
  var rows=(S.cover||[]).filter(function(c){ return !bgHidden(c.stt); }).slice().sort(coverSortFn);
  var body=rows.map(function(c){
    var i=S.cover.indexOf(c), lvl=coverDepth(c.stt), val=cost[c.stt]||0, pct=total>0?(val/total*100):0, leaf=!coverHasChild(c.stt);
    var cls=lvl===1?'lv1':(lvl===2?'lv2':'');
    var price=leaf?'<td class="num"><input class="cin num" value="'+money(val)+'" onchange="coverEdit('+i+',\'chiPhi\',this.value)"></td>':'<td class="num">'+money(val)+'</td>';
    return '<tr class="'+cls+'"><td class="ct"><input class="cin ct" style="width:52px" value="'+esc(c.stt)+'" onchange="coverEdit('+i+',\'stt\',this.value)"></td>'
      +'<td style="padding-left:'+((lvl-1)*16+9)+'px"><input class="cin" style="font-weight:'+(lvl<=1?700:600)+'" value="'+esc(c.hangMuc||'')+'" onchange="coverEdit('+i+',\'hangMuc\',this.value)">'
        +'<div><input class="cin desc2" placeholder="mô tả…" value="'+esc(c.moTa||'')+'" onchange="coverEdit('+i+',\'moTa\',this.value)"></div></td>'
      +price+'<td class="num">'+pct.toFixed(2)+'%</td>'
      +'<td class="ct"><button class="del" onclick="coverDel('+i+')">✕</button></td></tr>';
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
function bgDetailHTML(){
  var cols=visCols();
  var lines=(S.bgDeMuc && S.bgDeMuc!=='__all__') ? S.lines.filter(function(l){return l.nhom===S.bgDeMuc||String(l.nhom||'').indexOf(S.bgDeMuc+'.')===0;}) : S.lines.slice();
  var numK=['soLuong','giaNCC','giaDaiLy','donGia','donGiaCK','lnVnd','thanhTien'], ctK=['stt','hinhAnh','dvt','chietKhau','lnPct','ckKhach','markup','margin'];
  var groups={},order=[]; lines.forEach(function(l){ var g=(l.tang||'').trim()||'CHƯA PHÂN TẦNG'; if(!groups[g]){groups[g]=[];order.push(g);} groups[g].push(l); });
  var head='<tr>'+cols.map(function(c){ var cls=numK.indexOf(c[0])>=0?'num':(ctK.indexOf(c[0])>=0?'ct':''); return '<th class="'+cls+'">'+esc(c[1])+'</th>'; }).join('')+'<th></th></tr>';
  var body='';
  order.forEach(function(g,gi){ var roman=['I','II','III','IV','V','VI','VII','VIII','IX','X'][gi]||(gi+1);
    body+='<tr class="grp"><td colspan="'+(cols.length+1)+'">'+roman+'.'+esc(g)+'</td></tr>';
    groups[g].forEach(function(l,ri){ body+='<tr>'+cols.map(function(c){ if(c[0]==='stt') return '<td class="ct">'+(gi+1)+'.'+(ri+1)+'</td>'; return cellInput(l,c[0]); }).join('')+'<td class="ct"><button class="del" onclick="delLine(\''+l.lineId+'\')">✕</button></td></tr>'; });
  });
  if(!lines.length) body='<tr><td class="empty" colspan="'+(cols.length+1)+'">Chưa có hạng mục.</td></tr>';
  var colg='<colgroup>'+cols.map(function(c){return '<col style="width:'+colW(c[0])+'px">';}).join('')+'<col style="width:44px"></colgroup>';
  var totalW=cols.reduce(function(s,c){return s+colW(c[0]);},0)+44;
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
  var comp=coverCosts(), p=S.cur||{}, q=computeQuoteLocal();
  var secs=(S.cover||[]).filter(function(c){return coverDepth(c.stt)===1;}).sort(coverSortFn);
  var chips=secs.map(function(s){ return '<span class="bgchip'+(S.bgHide[s.stt]?' off':'')+'" onclick="bgToggle(\''+s.stt+'\')">'+esc(s.hangMuc||s.stt)+'</span>'; }).join('')||'<span class="hint" style="color:#889">Chưa có mục. Bấm ↻ Nạp lại mẫu.</span>';
  var covTable=S.coverMau==='m1'?coverTableM1(comp):coverTableM2(comp);
  var deSeen={}, deOpts=[{c:'__all__',n:'Tất cả'}];
  S.lines.forEach(function(l){ if(l.nhom && !deSeen[l.nhom]){ deSeen[l.nhom]=1; deOpts.push({c:l.nhom,n:nodeName(l.nhom)}); } });
  function cnt(code){ return code==='__all__'?S.lines.length:S.lines.filter(function(l){return l.nhom===code||String(l.nhom||'').indexOf(code+'.')===0;}).length; }
  var deSel='<select class="select" onchange="setDeMuc(this.value)">'+deOpts.map(function(o){return '<option value="'+esc(o.c)+'"'+(S.bgDeMuc===o.c?' selected':'')+'>'+esc(o.n)+' ['+cnt(o.c)+']</option>';}).join('')+'</select>';
  var colChips=COLS.map(function(c){return '<span class="chip'+(S.cols[c[0]]?' on':'')+'" onclick="toggleCol(\''+c[0]+'\')">'+esc(c[1])+'</span>';}).join('');

  box.innerHTML='<div class="sechd"><h2>Xuất báo giá</h2></div>'
    +'<div class="panel"><div style="font-size:12px;color:var(--muted);margin-bottom:2px">CHỌN MỤC HIỆN TRÊN TỜ BÌA — bỏ chọn mục nào thì mục đó ẩn khỏi tờ bìa</div><div class="bgchips">'+chips+'</div></div>'
    +'<div class="cvbar"><h3>Tờ bìa — Ước tính chi phí dự án</h3><span class="hint">— bấm thẳng vào ô để sửa</span><span style="flex:1"></span>'
      +'<div class="mau"><button class="'+(S.coverMau==='m1'?'on':'')+'" onclick="setCoverMau(\'m1\')">Mẫu 1</button><button class="'+(S.coverMau==='m2'?'on':'')+'" onclick="setCoverMau(\'m2\')">Mẫu 2</button></div>'
      +'<button class="btn ghost sm" onclick="coverReload(this)">↻ Nạp lại mẫu + tự cộng</button>'
      +'<button class="btn green sm" onclick="coverSave(this)">'+icon('check',15)+' Lưu tờ bìa</button></div>'
    +'<div class="cvcard"><div class="cvbanner"><div class="t">BẢNG ƯỚC TÍNH CHI PHÍ DỰ ÁN</div><div class="s">[Tư vấn thiết kế, thi công chuyên nghiệp]</div>'
      +'<div class="s" style="margin-top:4px">Mã báo giá số : <input class="cin" value="'+esc(p.maBaoGia||'')+'" onchange="coverInfo(\'maBaoGia\',this.value)"></div></div>'
      +'<table class="cvinfo"><tr><td class="lb">Khách hàng</td>'+ic('khachHang')+'<td class="lb">Quy mô</td>'+ic('quyMo')+'</tr>'
      +'<tr><td class="lb">Tổng diện tích XD (m²)</td>'+ic('tongDT')+'<td class="lb">Nhu cầu</td>'+ic('nhuCau')+'</tr>'
      +'<tr><td class="lb">DT báo giá [đã nhân hệ số] (m²)</td>'+ic('dtBaoGia')+'<td class="lb">Phân khúc</td>'+ic('phanKhuc')+'</tr></table>'
      +'<div style="overflow-x:auto">'+covTable+'</div></div>'
    +'<div style="margin-top:10px;display:flex;gap:10px;align-items:center;flex-wrap:wrap"><button class="btn ghost sm" onclick="coverAddBig()">＋ Thêm mục lớn</button><button class="btn ghost sm" onclick="coverAddSmall()">＋ Thêm mục nhỏ</button><span class="hint" style="color:var(--muted);font-size:12px">Sửa số ở ô No (vd gõ 1.4) — dòng tự về đúng thứ tự.</span></div>'
    +'<div class="cvbar" style="margin-top:26px"><h3>Bảng báo giá chi tiết</h3><span class="hint">— cùng dữ liệu &amp; thao tác như Bóc tách, sửa ở đâu cũng đồng bộ</span><span style="flex:1"></span>'
      +'<button class="btn green sm" onclick="doExport(\'xlsx\',this)">⬇ Xuất Excel (bìa + chi tiết)</button>'
      +'<button class="btn red sm" onclick="doExport(\'pdf\',this)">⬇ Xuất PDF (bìa + chi tiết)</button></div>'
    +'<div style="margin:8px 0;display:flex;align-items:center;gap:10px"><span class="lbl" style="margin:0">ĐỀ MỤC — chọn nhóm</span>'+deSel+'</div>'
    +'<div class="colchips">'+colChips+'</div>'
    +bgDetailHTML()
    +'<div class="totbar"><div class="b"><div class="tt">TẠM TÍNH</div><div class="tv">'+money(q.subtotal)+' đ</div></div>'
      +'<div class="b"><div class="tt">VAT '+q.vatPct+'%</div><div class="tv">'+money(q.vat)+' đ</div></div>'
      +'<div class="b grand"><div class="tt">TỔNG CỘNG</div><div class="tv">'+money(q.total)+' đ</div></div></div>';
}
async function doExport(fmt,btn){
  if(!S.cur){ toast('Chưa chọn dự án'); return; }
  var cols=[{key:'khuVuc',label:'PHÒNG'},{key:'ten',label:'TÊN SẢN PHẨM'},{key:'thuongHieu',label:'THƯƠNG HIỆU'},
    {key:'moTa',label:'MÔ TẢ'},{key:'kichThuoc',label:'KÍCH THƯỚC'},{key:'dvt',label:'ĐVT'},
    {key:'soLuong',label:'SL',num:true},{key:'donGiaBan',label:'Đơn giá',num:true},{key:'thanhTienBan',label:'Thành tiền',num:true}];
  var o=btn.textContent; btn.disabled=true; btn.textContent='Đang xuất…';
  try{
    if(fmt==='pdf'){ toast('Đang mở bản in…'); await printQuote(cols); }
    else{ var r=await api('exportBaoGia',S.cur.maDA,cols,'xlsx'); dl(r); toast('Đã xuất Excel'); }
  }catch(e){ toast('Lỗi: '+e.message); } btn.disabled=false; btn.textContent=o;
}
function dl(res){ var b=atob(res.base64),a=new Uint8Array(b.length); for(var i=0;i<b.length;i++)a[i]=b.charCodeAt(i);
  var u=URL.createObjectURL(new Blob([a],{type:res.mimeType})); var el=document.createElement('a'); el.href=u; el.download=res.name; el.click(); setTimeout(function(){URL.revokeObjectURL(u);},1500); }
async function printQuote(cols){
  var q=await api('getQuote',S.cur.maDA)||{lines:[]}; var p=q.project||{};
  var rows=(q.lines||[]).map(function(l,i){ return '<tr><td>'+(i+1)+'</td><td>'+esc(l.khuVuc||'')+'</td><td>'+esc(l.ten||'')+'</td><td>'+esc(l.thuongHieu||'')+'</td><td style="text-align:right">'+l.soLuong+'</td><td style="text-align:right">'+money(l.donGiaBan)+'</td><td style="text-align:right">'+money(l.thanhTienBan)+'</td></tr>'; }).join('');
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
    ['DÒNG SẢN PHẨM','Dòng sản phẩm','text',1],['TÊN SẢN PHẨM','Tên sản phẩm','text',1],['MÃ SẢN PHẨM','Mã sản phẩm','text',1] ]},
  {g:'Thông tin giá bán', note:'Giá đại lý tự tính = Giá bán lẻ × (1 − %Chiết khấu).', f:[
    ['GIÁ BÁN LẺ','Giá bán lẻ','num',1],['CHIẾT KHẤU ĐẠI LÝ (%)','%Chiết khấu','num',1],['GIÁ ĐẠI LÝ','Giá đại lý','calc',1] ]},
  {g:'Key Product Info (Thông tin chính)', f:[
    ['CÔNG SUẤT (W)','Công suất','num',1],['NHIỆT ĐỘ MÀU (K)','Nhiệt độ màu','sel',1,['2700','3000','4000','5000','6500']],
    ['GÓC CHIẾU (°)','Góc chiếu','num',1],['MÀU SẮC','Màu sắc','text',1],['CHẤT LIỆU','Chất liệu','text',1] ]},
  {g:'Thông số thiết kế', f:[
    ['GÓC NGHIÊNG (°)','Góc nghiêng','num',0],['CHIỀU CAO (mm)','Chiều cao','num',0],['ĐƯỜNG KÍNH (mm)','Đường kính','num',1] ]},
  {g:'Performance Specifications (Thông số hiệu suất)', f:[
    ['QUANG THÔNG (lm)','Quang thông','num',1],['CHỈ SỐ IP','Chỉ số IP (Chống bụi, nước)','sel',1,['IP20','IP44','IP54','IP65']],['CRI','CRI','text',1],
    ['HIỆU SUẤT PHÁT QUANG (lm/W)','Hiệu suất phát quang (lm/W)','num',0],['UGR','UGR','text',0],['SDCM','SDCM','text',0],
    ['COI','COI','text',0],['TUỔI THỌ','Tuổi thọ','text',0],['LOẠI CHIP LED','Loại chip LED','sel',0,['COB','SMD','Modul']] ]},
  {g:'Driver (Nguồn LED / Chấn lưu)', f:[
    ['LẮP NGUỒN RỜI','Lắp nguồn rời','sel',0,['Có','Không']],['TÊN BỘ NGUỒN','Tên bộ nguồn','text',0],['MÃ BỘ NGUỒN','Mã bộ nguồn','text',0],
    ['HÃNG BỘ NGUỒN','Hãng bộ nguồn','text',0],['VỊ TRÍ LẮP NGUỒN','Vị trí lắp nguồn','sel',0,['Lắp rời','Tích hợp trong thân đèn']],
    ['TƯƠNG THÍCH ĐIỀU KHIỂN','Tương thích điều khiển','sel',0,['DALI','0-10V','Triac','On-Off']],['DÒNG RA TỐI ĐA (mA)','Dòng ra tối đa (mA)','num',0] ]},
  {g:'Installation Specifications (Thông số lắp đặt)', f:[
    ['LỖ KHOÉT TRẦN (mm)','Lỗ khoét trần (mm)','num',1],
    ['CẤP BẢO VỆ ĐIỆN','Cấp bảo vệ điện','sel',0,['Class I','Class II','Class III']] ]},
  {g:'Thương mại', f:[
    ['BẢO HÀNH (năm)','Bảo hành (năm)','num',0],['ĐƠN VỊ TÍNH','Đơn vị tính','sel',1,['Cái','Bộ','Mét']] ]}
];
var DB_FLAT=[]; DB_GROUPS.forEach(function(gr){ gr.f.forEach(function(f){ DB_FLAT.push(f); }); });
function dbInput(f){
  var i=DB_FLAT.indexOf(f), lark=f[0], label=f[1], type=f[2], req=f[3], opts=f[4]||[];
  var id='dbf_'+i, star=req?' <span style="color:#c33">*</span>':'', inner;
  var trg=(lark==='GIÁ BÁN LẺ'||lark==='CHIẾT KHẤU ĐẠI LÝ (%)')?' oninput="dbCalcDaiLy()"':'';
  if(type==='calc') inner='<input id="'+id+'" class="calc" type="number" placeholder="Tự tính từ giá bán & %CK" readonly>';
  else if(type==='area') inner='<textarea id="'+id+'" placeholder="'+esc(label)+'" style="min-height:54px"></textarea>';
  else if(type==='sel') inner='<input id="'+id+'" list="dl_'+i+'" placeholder="'+esc(label)+'"><datalist id="dl_'+i+'">'+opts.map(function(o){return '<option value="'+esc(o)+'">';}).join('')+'</datalist>';
  else inner='<input id="'+id+'"'+(type==='num'?' type="number"':'')+trg+' placeholder="'+esc(label)+'">';
  return '<div class="field"><label>'+esc(label)+star+'</label>'+inner+'</div>';
}
function dbIdOf(label){ for(var i=0;i<DB_FLAT.length;i++) if(DB_FLAT[i][0]===label) return 'dbf_'+i; return ''; }
function dbCalcDaiLy(){
  var ge=document.getElementById(dbIdOf('GIÁ BÁN LẺ')), ce=document.getElementById(dbIdOf('CHIẾT KHẤU ĐẠI LÝ (%)')), oe=document.getElementById(dbIdOf('GIÁ ĐẠI LÝ'));
  if(!oe) return; var g=Number(ge&&ge.value)||0, ck=Number(ce&&ce.value)||0;
  oe.value = g ? Math.round(g*(1-ck/100)) : '';
}
function imgUrlOf(v){ v=String(v||''); return v.indexOf('http')===0?v:(v?('/media?token='+encodeURIComponent(v)):''); }
function imgPop_(src){ if(!src)return; var o=document.getElementById('imgPop'); if(!o){ o=document.createElement('div'); o.id='imgPop'; o.className='imgpop'; o.onclick=function(){ o.style.display='none'; }; o.innerHTML='<img><span class="imgpop-x">✕</span>'; document.body.appendChild(o); } o.querySelector('img').src=src; o.style.display='flex'; }
// Ảnh đầu tiên (nhiều ảnh nối bằng xuống dòng) -> URL hợp lệ cho <img src>
function imgSrc1_(v){ return imgUrlOf(String(v||'').split('\n')[0].trim()); }
function upMainInner(){
  return S._imgMain
    ? '<img src="'+esc(imgUrlOf(S._imgMain))+'" onerror="this.replaceWith(document.createTextNode(\'ảnh lỗi\'))"><button class="upx" title="Xoá" onclick="event.stopPropagation();upRemove(\'main\')">✕</button>'
    : '<div class="upic">'+icon('camera',28)+'</div>Kéo/thả hoặc bấm để chọn <b>hình đại diện</b>';
}
function upGridInner(){
  return (S._imgList||[]).map(function(v,i){ return '<div class="upthumb"><img src="'+esc(imgUrlOf(v))+'"><button class="upx" onclick="upRemove(\'more\','+i+')">✕</button></div>'; }).join('')
    || '<span style="color:#9aa;font-size:12px">Chưa có ảnh chi tiết.</span>';
}
function upRefresh(){ var a=document.getElementById('upMain'); if(a)a.innerHTML=upMainInner(); var b=document.getElementById('upGrid'); if(b)b.innerHTML=upGridInner(); }
function imgSection(){
  return '<div class="dbcard"><div class="dbcard-h"><span class="dbcard-ic">'+icon('camera',18)+'</span><h3>Ảnh sản phẩm</h3></div><div class="dbcard-b">'
    +'<div class="imgup">'
      +'<div><div class="uplabel">Hình đại diện</div>'
        +'<div class="upzone upmain" id="upMain" onclick="upPick(\'main\')" ondragover="upDrag(event,1)" ondragleave="upDrag(event,0)" ondrop="upDrop(event,\'main\')">'+upMainInner()+'</div>'
        +'<div class="upurl"><input id="upMainUrl" placeholder="Hoặc dán URL ảnh…."><button class="btn blue sm" onclick="upAddUrl(\'main\')">Thêm</button></div>'
      +'</div>'
      +'<div><div class="uplabel">Hình chi tiết sản phẩm</div>'
        +'<div class="upzone" id="upMore" onclick="upPick(\'more\')" ondragover="upDrag(event,1)" ondragleave="upDrag(event,0)" ondrop="upDrop(event,\'more\')"><div class="upic">'+icon('camera',28)+'</div>Kéo/thả hoặc bấm để chọn <b>hình chi tiết sản phẩm</b></div>'
        +'<div class="upgrid" id="upGrid">'+upGridInner()+'</div>'
        +'<div class="upurl"><input id="upMoreUrl" placeholder="Hoặc dán URL ảnh…."><button class="btn blue sm" onclick="upAddUrl(\'more\')">Thêm</button></div>'
      +'</div>'
    +'</div></div></div>';
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
    +'<div class="imp-nganh"><label>Ngành hàng</label><div class="msel" style="min-width:190px"><span class="mlabel">Thiết bị đèn</span><span class="mplus">▾</span></div></div>'
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
  var rows=ps.map(function(p,i){
    var im=String(p.hinhAnh||'').split('\n')[0];
    var img=im?'<img class="imp-rth" src="'+esc(imgSrc1_(p.hinhAnh))+'" onerror="this.style.visibility=\'hidden\'">':'<span class="imp-rth"></span>';
    return '<tr><td class="c">'+(i+1)+'</td><td class="imp-rname">'+esc(p.ten||'')+'</td><td class="c">'+img+'</td>'
      +'<td>'+esc(p.thuongHieu||'—')+'</td><td class="imp-rdate">'+(impDateTime_(p.capNhat)||'—')+'</td></tr>';
  }).join('') || '<tr><td colspan="5" class="empty" style="padding:24px 12px;font-size:12.5px;line-height:1.5">Chưa nhập sản phẩm nào trong phiên này.<br>Sản phẩm bạn <b>thêm / nhập file</b> ở phiên này sẽ hiện ở đây.</td></tr>';
  return '<div class="imp-recent"><div class="imp-recent-h">Sản phẩm vừa nhập (phiên này) <span class="count">'+pad2(ps.length)+'</span></div>'
    +'<div class="imp-recent-b"><table class="imp-rtbl"><thead><tr><th class="c">STT</th><th>Tên sản phẩm</th><th class="c">Hình ảnh</th><th>Thương hiệu</th><th>Ngày cập nhật</th></tr></thead><tbody>'+rows+'</tbody></table></div></div>';
}
function sessionAdd_(o){ S._sessionAdded=S._sessionAdded||[]; S._sessionAdded.unshift({ten:o.ten||'',thuongHieu:o.thuongHieu||'',ncc:o.ncc||'',hinhAnh:o.hinhAnh||'',capNhat:o.capNhat||nowIsoClient_()}); }
function nowIsoClient_(){ try{ return new Date().toISOString(); }catch(e){ return ''; } }
function renderImport(){
  S._imgMain=''; S._imgList=[];
  var box=document.getElementById('v-import');
  var form='<div class="dbwrap">'
    +'<div class="dbhead"><div><h2>Nhập dữ liệu</h2><p>Thêm sản phẩm vào danh mục <span style="color:#c33">* bắt buộc</span></p></div></div>'
    +imgSection()
    +DB_GROUPS.map(function(gr){
      return dbCard_(gr.g, DB_GICON[gr.g]||'doc', gr.note, '<div class="dbgrid">'+gr.f.map(dbInput).join('')+'</div>');
    }).join('')
    +'<div class="savebar"><button class="btn blue block" onclick="tdSave(this)">Thêm sản phẩm vào Database</button><button class="btn ghost sm" onclick="renderImport()" style="margin-top:8px">Xoá form</button></div>'
    +dbCard_('Nhập hàng loạt từ file', 'download', 'Tải file mẫu → điền dữ liệu → chọn file lên. Hệ thống tự dò cột theo tiêu đề; sau đó tải ảnh cho từng SP rồi lưu vào DB_Sản phẩm.',
      '<div class="imp-file-row"><a class="btn ghost sm" href="/mau-nhap-hang-loat.xlsx" download="Mau-nhap-hang-loat-DezonQS.xlsx">'+icon('download',14)+' Tải file mẫu</a>'
      +'<span class="imp-file-sep"></span><input type="file" id="impFile" accept=".xlsx,.xls,.csv" onchange="impPick(this)" style="font:inherit"></div>'
      +'<div id="impPreview" style="margin-top:12px"></div>')
    +'</div>';
  box.innerHTML=impStatBar()+'<div class="imp-layout">'+form+impRecentList()+'</div>';
}
/* ==== Upload ảnh ==== */
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
    try{ var b64=String(reader.result).split(',')[1]; var res=await api('importParse',b64,ext); impShow(res); }
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
function impRow_(p,i){
  var heads=S._impHeaders||[];
  return '<tr><td class="iiimgtd" id="impimg_'+i+'">'+impImgCell2_(p,i)+'</td>'
    +heads.map(function(h){ return '<td class="iied" contenteditable="true" spellcheck="false" data-i="'+i+'" data-h="'+esc(h)+'" oninput="impEdit(this)">'+esc(impCellVal_(p,h))+'</td>'; }).join('')+'</tr>';
}
function impEdit(el){
  var i=+el.getAttribute('data-i'), h=el.getAttribute('data-h'), p=S._impProducts[i]; if(!p) return;
  if(!p._raw) p._raw={}; p._raw[h]=el.textContent;
  // đồng bộ vài trường cơ bản để danh sách "vừa nhập" hiển thị đúng
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
    +'<div class="imp-pv-sub">'+icon('image',15)+' Tải <b>ảnh chính</b> và <b>ảnh chi tiết</b> cho từng SP ở cột đầu — <b id="impImgCount">0</b>/'+res.count+' đã có ảnh</div></div>'
    +'<div class="imp-pv-wrap"><table class="imp-pvtbl"><thead><tr><th class="iiimgth">Ảnh (chính + chi tiết)</th>'
      +heads.map(function(h){return '<th>'+esc(h)+'</th>';}).join('')+'</tr></thead><tbody id="impBody">'+rows+'</tbody></table></div>'
    +'<div class="imp-pv-foot"><button class="btn blue" onclick="impCommit(this)">'+icon('check',15)+' Nhập '+res.count+' sản phẩm vào danh mục</button>'
      +'<span class="imp-pv-note">Cột nhận diện & map DB: '+recog+'</span></div>';
  impUpdateCounter();
}
async function impCommit(btn){
  if(!S._impProducts||!S._impProducts.length){ toast('Chưa có dữ liệu'); return; }
  if((S._imgUploading||0)>0){ toast('Đang tải ảnh lên, đợi chút…'); if(btn){ btn.disabled=true; var ot=btn.textContent; btn.textContent='⏳ Đợi tải ảnh…'; } await waitUploads_(20000); if(btn){ btn.disabled=false; btn.textContent=ot; } }
  var missing=S._impProducts.filter(function(p){return !p.hinhAnh;}).length;
  if(missing>0 && !confirm('Còn '+missing+' sản phẩm CHƯA có ảnh.\nBạn nên bấm ô ＋ ở cột Ảnh để tải hình cho từng SP.\n\nVẫn nhập bây giờ?')) return;
  btn.disabled=true; var o=btn.textContent; btn.textContent='Đang nhập…';
  try{ var items=S._impProducts.slice();
    var r=await api('importCommit', S._impProducts); S.products=await api('getProducts')||S.products;
    items.forEach(function(p){ sessionAdd_({ten:p.ten, thuongHieu:p.thuongHieu, ncc:p.ncc, hinhAnh:p.hinhAnh}); });
    toast('Đã nhập '+r.inserted+' sản phẩm vào danh mục'); renderImport(); renderFilters(); renderCatalog(); }
  catch(e){ toast('Lỗi nhập: '+e.message); btn.disabled=false; btn.textContent=o; }
}
async function tdSave(btn){
  var data={};
  DB_FLAT.forEach(function(f,i){ var e=document.getElementById('dbf_'+i); if(e){ var v=(e.value||'').trim(); if(v) data[f[0]]=v; } });
  var ten=String(data['TÊN SẢN PHẨM']||'').trim(); if(!ten){ toast('Nhập Tên sản phẩm'); return; }
  delete data['GIÁ ĐẠI LÝ']; // cột tự tính (generated) — không ghi
  if(!data['ĐƠN VỊ TÍNH']) data['ĐƠN VỊ TÍNH']='Cái';
  if(!data['TRẠNG THÁI']) data['TRẠNG THÁI']='Đang kinh doanh';
  btn.disabled=true; var o=btn.textContent;
  if((S._imgUploading||0)>0){ btn.textContent='⏳ Đợi tải ảnh…'; await waitUploads_(15000); } // đợi ảnh tải xong để lưu đủ ảnh
  var imgs=[S._imgMain].concat(S._imgList||[]).filter(Boolean).filter(function(v){return v.indexOf('data:')!==0;}); // bỏ preview base64 chưa upload xong
  if(imgs.length) data['ẢNH SẢN PHẨM']=imgs.join('\n');
  btn.textContent='⏳ Đang lưu…';
  try{ var r=await api('saveDbProduct',data);
    sessionAdd_({ten:ten, thuongHieu:data['THƯƠNG HIỆU']||'', ncc:data['NHÀ CUNG CẤP']||'', hinhAnh:data['ẢNH SẢN PHẨM']||''});
    toast((r.updated?'Đã cập nhật':'Đã thêm')+' "'+ten+'" vào DB_Sản phẩm'); renderImport(); }
  catch(e){ toast('Lỗi: '+e.message); btn.disabled=false; btn.textContent=o; }
}

/* ===================================================================
 * PHẦN THÔ — Bảng ước tính chi phí xây dựng thô (theo mẫu Excel)
 * mode: 'item'  -> đơn giá theo dòng, TT = KL × ĐG
 *       'area'  -> đơn giá theo cả mục (up); KL = DT × HS; TT mục = ΣKL × up
 *       'area0' -> KL = DT × HS nhưng "Chưa bao gồm" (TT = 0)
 *       'none'  -> gói, "Chưa bao gồm" (TT = 0)
 * =================================================================== */
var PT_TEMPLATE=[
  {r:'I',t:'CÔNG TÁC CHUẨN BỊ',mode:'none',items:[
    ['Xin phép xây dựng','gói','Chưa bao gồm'],
    ['Đập phá, tháo dỡ nhà hiện trạng','gói','Chưa bao gồm'],
    ['Khoan khảo sát địa chất','gói','Chưa bao gồm'],
    ['Cắm mốc định vị ranh xây dựng','gói','Chưa bao gồm'],
    ['Xin cấp đồng hồ điện, nước','gói','Chưa bao gồm']
  ]},
  {r:'II',t:'CÔNG TÁC ÉP CỌC',mode:'item',items:[
    ['Giàn tải, máy ép cọc Pmax 90T','Gói',1,28000000,'',0],
    ['Nhân công ép cọc PHC D300 lực ép P(max) - 90 tấn (số tim cọc tạm tính)','tim',56,2250000,'',1500000],
    ['Cọc ly tâm D300 PHC lực ép P(max) 90 tấn\n56 tim x 20m / tim (số tim, số m tạm tính)','md',1120,414000,'',355000]
  ]},
  {r:'III',t:'BIỆN PHÁP THI CÔNG HẦM',mode:'item',items:[
    ['Ép cừ C200 chu vi hầm, cừ C dài 4,5m','md',62,4436000,'',2800000],
    ['Hệ Shoring','hệ',1,30000000,'',0],
    ['Đào đất, vận chuyển đi đổ','m3',388.65,185000,'',0]
  ]},
  {r:'IV',t:'THI CÔNG XÂY THÔ\n( Không bao gồm nhân công hoàn thiện, MEP âm tường, bể PCCC)',mode:'area',up:4200000,items:[
    ['Móng (diện tích bao ngoài toàn bộ móng, dầm móng)','m2',278.00,0.50,''],
    ['Hầm + ram dốc','m2',178.56,1.70,''],
    ['Tầng 1','m2',156.00,1.00,''],
    ['Sân vườn ngoài trời','m2',104.39,0.50,''],
    ['Tầng 2 (bao gồm ban công)','m2',60.00,1.00,''],
    ['Tầng 3 (bao gồm ban công)','m2',60.00,1.00,''],
    ['Tầng 4 (bao gồm ban công)','m2',60.00,1.00,''],
    ['Tầng 5 (bao gồm ban công)','m2',185.92,1.00,''],
    ['Tầng thượng có mái che','m2',50.63,1.00,''],
    ['Tầng thượng không mái che','m2',82.37,0.50,''],
    ['Mái bê tông cốt thép','m2',50.63,0.50,''],
    ['Tum thang máy','m2',5.17,0.50,'']
  ]},
  {r:'V',t:'HỆ THỐNG MEP\n(Điện - cấp thoát nước - data)\n(Không bao gồm nhân công lắp đặt + thiết bị đầu cuối)',mode:'area',up:750000,items:[
    ['Hầm','m2',178.56,1.00,''],
    ['Tầng 1 (bao gồm diện tích sân vườn)','m2',260.39,1.00,''],
    ['Tầng 2','m2',60.00,1.00,''],
    ['Tầng 3','m2',60.00,1.00,''],
    ['Tầng 4','m2',60.00,1.00,''],
    ['Tầng 5','m2',185.92,1.00,''],
    ['Sân thượng','m2',133.00,1.00,''],
    ['Mái','m2',50.63,0.50,'']
  ]},
  {r:'VI',t:'CHỐNG THẤM',mode:'area0',note:'Chưa bao gồm',items:[
    ['Hầm (sàn + vách hầm + hố pit)','m2',250.01,1.00,''],
    ['Nhà vệ sinh','m2',83.97,1.00,''],
    ['Ban công tầng 2','m2',39.00,1.00,''],
    ['Ban công tầng 3','m2',39.00,1.00,''],
    ['Ban công tầng 4','m2',39.00,1.00,''],
    ['Ban công tầng 5','m2',39.00,1.00,''],
    ['Sân thượng ngoài trời','m2',121.85,1.00,''],
    ['Mái','m2',70.75,1.00,'']
  ]},
  {r:'VII',t:'HỆ THỐNG PCCC',mode:'none',note:'Chưa bao gồm',items:[
    ['Bể chứa nước PCCC theo quy định','gói','Chưa bao gồm'],
    ['Hệ thống báo cháy','gói','Chưa bao gồm'],
    ['Hệ thống chữa cháy','gói','Chưa bao gồm'],
    ['Hệ thống thoát hiểm và hỗ trợ','gói','Chưa bao gồm']
  ]},
  {r:'VIII',t:'CHI PHÍ KHÁC',mode:'item',items:[
    ['Dọn dẹp mặt bằng','gói',1,30000000,'Phát quang cây cỏ, thu gom xà bần, rác thải hiện trạng, san đất tạo mặt bằng',20000000],
    ['Phun thuốc chống mối','gói',1,63690000,'Cho tầng hầm và tầng 1',35116000],
    ['Bao che công trình (giàn giáo, lưới, bạt,…)','gói',1,140000000,'',120000000],
    ['Hàng rào bao quanh công trình, cổng công trình','gói',1,75000000,'',60000000],
    ['Camera quan sát công trình','cái',3,1200000,'',1000000],
    ['Mạng internet trong quá trình thi công','tháng',6,350000,'',300000],
    ['Nhà vệ sinh di động','cái',1,20000000,'',18000000],
    ['Thùng rác','cái',1,900000,'',700000],
    ['Thiết bị PCCC (bình chữa cháy 4kg)','cái',8,600000,'',500000],
    ['Vệ sinh công trình hằng ngày (xây dựng thô)','gói',1,45000000,'',27000000],
    ['Vận chuyển xà bần, rác thải trong quá trình thi công','tháng',6,7500000,'',6000000],
    ['Văn phòng tạm tại công trình trong quá trình thi công','tháng',6,8000000,'',6500000],
    ['Công tác an toàn lao động (nội quy, biển báo, đồ bảo hộ, lan can chắn, lưới hứng các khu vực mép sàn)','gói',1,28000000,'',21000000],
    ['Chi phí thẩm tra biện pháp thi công hầm (theo quy định)','gói',1,20000000,'',15000000],
    ['Chi phí thanh tra xây dựng kiểm tra trong quá trình thi công phần thô','gói',5,5000000,'',4000000],
    ['Chi phí trắc đạc','tầng',8,7000000,'',6000000],
    ['Chi phí điện nước thi công 6 tháng (phần thô)','gói',6,3500000,'',3000000],
    ['Chi phí thang vận','gói',1,0,'Chưa bao gồm',0],
    ['Đấu nối hệ thống thoát nước thải vào cống chung','gói',1,0,'Chưa bao gồm',0]
  ]}
];
var PT_ROMAN=['I','II','III','IV','V','VI','VII','VIII','IX','X','XI','XII','XIII','XIV','XV','XVI'];
function ptN(v){ if(typeof v==='number') return v; var x=parseFloat(String(v==null?'':v).replace(/[^\d.\-]/g,'')); return isNaN(x)?0:x; }
function ptR0(x){ return Math.round(x||0); }
function ptR2(x){ return Math.round((x||0)*100)/100; }
function ptQty(x){ x=Number(x)||0; return x.toLocaleString('vi-VN',{maximumFractionDigits:2}); }
// Thư viện nội dung công việc (Phần thô) — hiện ở panel trái, bấm + để thêm vào bảng ước tính
function renderPTLibrary(){
  var el=document.getElementById('catList'); if(!el) return;
  var cc=document.getElementById('catCount'); if(cc) cc.textContent=PT_TEMPLATE.reduce(function(s,se){return s+se.items.length;},0)+' công việc';
  el.innerHTML='<div class="ptlib">'+PT_TEMPLATE.map(function(sec,si){
    return '<div class="ptlib-sec"><div class="ptlib-h">'+esc(sec.r)+'. '+esc(String(sec.t).split('\n')[0])+'</div>'
      +sec.items.map(function(a,ii){
        return '<div class="ptlib-item"><div class="ptlib-nm" title="'+esc(String(a[0]).replace(/\n/g,' '))+'">'+esc(String(a[0]).split('\n')[0])+'</div>'
          +'<button class="ptlib-add" title="Thêm vào bảng ước tính" onclick="ptAddFromLib('+si+','+ii+')">+</button></div>';
      }).join('')+'</div>';
  }).join('')+'</div>';
}
function ptAddFromLib(si,ii){
  var tsec=PT_TEMPLATE[si]; if(!tsec) return; var a=tsec.items[ii]; if(!a) return;
  ptEnsure();
  var mode=tsec.mode, item;
  if(mode==='item') item={n:a[0],dvt:a[1],kl:a[2],dg:a[3],gc:a[4]||'',dgnt:a[5]||0};
  else if(mode==='area'||mode==='area0') item={n:a[0],dvt:a[1],dt:a[2],hs:a[3],gc:a[4]||''};
  else item={n:a[0],dvt:a[1],gc:a[2]||''};
  var sec=(S.phanTho||[]).filter(function(s){ return s.t===tsec.t; })[0];
  if(!sec){ sec={t:tsec.t,mode:mode,note:tsec.note||'',up:tsec.up||0,items:[]}; S.phanTho.push(sec); }
  sec.items.push(item);
  ptPersist(); renderPhanTho();
  toast('Đã thêm: '+String(a[0]).split('\n')[0]);
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
  S.phanTho = (saved&&saved.length)?saved:ptCloneTemplate();
  var v=null; try{ v=localStorage.getItem(key+'_vat'); }catch(e){}
  S.ptVat = (v!=null&&v!=='')?+v:8;
}
function ptPersist(){ try{ var k=ptKey(); localStorage.setItem(k,JSON.stringify(S.phanTho)); localStorage.setItem(k+'_vat',String(S.ptVat)); }catch(e){} }
function ptSecTotals(sec){
  var sumKL=0, tt=0, ttnt=0;
  sec.items.forEach(function(it){
    var kl;
    if(sec.mode==='area'||sec.mode==='area0'){ kl=ptR2(ptN(it.dt)*ptN(it.hs)); }
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
function ptInp(si,ii,f,v,cls){ return '<input class="pt-in '+(cls||'')+'" type="number" step="any" value="'+(v===''||v==null?'':v)+'" onchange="ptEdit('+si+','+ii+',\''+f+'\',this.value)">'; }
function ptTxt(si,ii,f,v){ return '<textarea class="pt-in pt-area" rows="1" oninput="autoGrow(this)" onchange="ptEdit('+si+','+ii+',\''+f+'\',this.value)">'+esc(v||'')+'</textarea>'; }
function ptEdit(si,ii,f,val){
  var sec=S.phanTho[si]; if(!sec) return;
  var numF={dt:1,hs:1,kl:1,dg:1,dgnt:1,up:1};
  var v = numF[f]?ptN(val):val;
  if(ii<0){ sec[f]=v; } else { var it=sec.items[ii]; if(!it) return; it[f]=v; }
  ptPersist(); renderPhanTho();
}
function ptSetVat(val){ S.ptVat=ptN(val); ptPersist(); renderPhanTho(); }
function ptAddItem(si){
  var sec=S.phanTho[si]; if(!sec) return;
  if(sec.mode==='item') sec.items.push({n:'',dvt:'',kl:1,dg:0,gc:'',dgnt:0});
  else if(sec.mode==='area'||sec.mode==='area0') sec.items.push({n:'',dvt:'m2',dt:0,hs:1,gc:''});
  else sec.items.push({n:'',dvt:'gói',gc:''});
  ptPersist(); renderPhanTho();
}
function ptDelItem(si,ii){ var sec=S.phanTho[si]; if(!sec) return; sec.items.splice(ii,1); ptPersist(); renderPhanTho(); }
function ptAddSection(){ S.phanTho.push({t:'HẠNG MỤC MỚI',mode:'item',note:'',up:0,items:[]}); ptPersist(); renderPhanTho(); }
function ptDelSection(si){ if(!confirm('Xoá cả hạng mục "'+((S.phanTho[si]||{}).t||'')+'" ?')) return; S.phanTho.splice(si,1); ptPersist(); renderPhanTho(); }
function ptReset(){ if(!confirm('Khôi phục lại bảng theo mẫu gốc? Mọi chỉnh sửa hiện tại sẽ mất.')) return; S.phanTho=ptCloneTemplate(); S.ptVat=8; ptPersist(); renderPhanTho(); }
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
function renderPhanTho(){
  var pw=document.getElementById('ptWrap'); if(!pw) return;
  if(!S.cur){ pw.innerHTML='<div class="empty" style="padding:24px;text-align:center">Chưa chọn dự án.</div>'; return; }
  ptEnsure();
  var comp=ptComputeAll();
  var COLS=['STT','NỘI DUNG CÔNG VIỆC','ĐVT','DIỆN TÍCH','HỆ SỐ','KHỐI LƯỢNG','ĐƠN GIÁ','THÀNH TIỀN','GHI CHÚ','ĐƠN GIÁ (NHÀ THẦU)','THÀNH TIỀN (NHÀ THẦU)','LỢI NHUẬN','ĐƠN GIÁ (BÁO KHÁCH)','THÀNH TIỀN (BÁO KHÁCH)'];
  var body='';
  S.phanTho.forEach(function(sec,si){
    var st=comp.sections[si];
    // ---- dòng tiêu đề hạng mục ----
    var upCell = sec.mode==='area' ? ptInp(si,-1,'up',sec.up,'pt-money') : '';
    var klCell = (sec.mode==='area'||sec.mode==='area0') ? ptQty(st.sumKL) : '';
    body+='<tr class="pt-sec">'
      +'<td class="c">'+PT_ROMAN[si]+'</td>'
      +'<td class="pt-secname"><div class="pt-secttl">'+esc(sec.t).replace(/\n/g,'<br>')+'</div>'+(sec.note?'<span class="pt-note">'+esc(sec.note)+'</span>':'')+'<span class="pt-secdel" title="Xoá hạng mục" onclick="ptDelSection('+si+')">'+icon('trash',13)+'</span></td>'
      +'<td></td><td></td><td></td><td class="n">'+klCell+'</td>'
      +'<td class="n pt-upcell">'+upCell+'</td>'
      +'<td class="n b">'+(st.tt?money(st.tt):'-')+'</td>'
      +'<td></td><td></td>'
      +'<td class="n">'+(st.ttnt?money(st.ttnt):'')+'</td>'
      +'<td class="n">'+((st.tt-st.ttnt)?money(st.tt-st.ttnt):'')+'</td>'
      +'<td></td><td class="n">'+(st.tt?money(st.tt):'')+'</td></tr>';
    body+='<tr class="pt-spacer"><td colspan="15"></td></tr>';   // dòng khoảng trắng sau header nhóm (như PDF)
    // ---- các dòng chi tiết ----
    sec.items.forEach(function(it,ii){
      var kl=it._kl, tt=it._tt, ttnt=it._ttnt;
      var isNone=sec.mode==='none', isArea=(sec.mode==='area'||sec.mode==='area0'), isItem=sec.mode==='item';
      body+='<tr class="pt-row">'
        +'<td class="c">'+(ii+1)+'</td>'
        +'<td>'+ptTxt(si,ii,'n',it.n)+'</td>'
        +'<td class="c dvt-cell">'+ptTxt(si,ii,'dvt',it.dvt)+'</td>'
        +'<td class="n">'+(isArea?ptInp(si,ii,'dt',it.dt):'')+'</td>'
        +'<td class="n">'+(isArea?ptInp(si,ii,'hs',it.hs):'')+'</td>'
        +'<td class="n">'+(isArea?'<span class="pt-ro">'+ptQty(kl)+'</span>':(isItem?ptInp(si,ii,'kl',it.kl):''))+'</td>'
        +'<td class="n">'+(isItem?ptInp(si,ii,'dg',it.dg,'pt-money'):'')+'</td>'
        +'<td class="n">'+(isItem?'<span class="pt-ro b">'+money(tt)+'</span>':'<span class="pt-dash">-</span>')+'</td>'
        +'<td>'+ptTxt(si,ii,'gc',it.gc)+'</td>'
        +'<td class="n">'+(isItem?ptInp(si,ii,'dgnt',it.dgnt,'pt-money'):'')+'</td>'
        +'<td class="n">'+(isItem?'<span class="pt-ro">'+money(ttnt)+'</span>':'')+'</td>'
        +'<td class="n">'+(isItem?'<span class="pt-ro">'+money(tt-ttnt)+'</span>':'')+'</td>'
        +'<td class="n">'+(isItem?'<span class="pt-ro">'+money(it.dg)+'</span>':'')+'</td>'
        +'<td class="n">'+(isItem?'<span class="pt-ro">'+money(tt)+'</span>':'')+'</td>'
        +'<td class="pt-del"><button title="Xoá dòng" onclick="ptDelItem('+si+','+ii+')">'+icon('trash',13)+'</button></td></tr>';
    });
    body+='<tr class="pt-add"><td></td><td colspan="13"><span onclick="ptAddItem('+si+')">＋ Thêm dòng</span></td><td></td></tr>';
    body+='<tr class="pt-spacer"><td colspan="15"></td></tr>';   // dòng khoảng trắng trước nhóm kế (như PDF)
  });
  // ---- tổng cộng / VAT / sau thuế ----
  body+='<tr class="pt-total"><td class="c" colspan="7">TỔNG CỘNG</td>'
    +'<td class="n b">'+money(comp.grand)+'</td><td></td><td></td>'
    +'<td class="n">'+money(comp.contractor)+'</td>'
    +'<td class="n b">'+money(comp.profit)+' <span class="pt-pct">('+comp.profitPct.toFixed(2)+'%)</span></td>'
    +'<td></td><td class="n b">'+money(comp.grand)+'</td><td></td></tr>';
  body+='<tr class="pt-total2"><td class="c" colspan="6">VAT</td>'
    +'<td class="n"><input class="pt-in pt-vat" type="number" step="any" value="'+comp.vatPct+'" onchange="ptSetVat(this.value)">%</td>'
    +'<td class="n b">'+money(comp.vat)+'</td><td colspan="7"></td></tr>';
  body+='<tr class="pt-grand"><td class="c" colspan="7">THÀNH TIỀN SAU THUẾ</td>'
    +'<td class="n b">'+money(comp.afterTax)+'</td><td colspan="7"></td></tr>';

  var colg='<colgroup>'
    +'<col style="width:38px"><col style="width:300px"><col style="width:54px"><col style="width:76px"><col style="width:56px"><col style="width:86px">'
    +'<col style="width:104px"><col style="width:126px"><col style="width:190px"><col style="width:112px"><col style="width:128px"><col style="width:120px"><col style="width:112px"><col style="width:128px"><col style="width:34px"></colgroup>';
  var thead='<tr>'+COLS.map(function(c,i){ var cls=(i>=3?'n':(i===0?'c':'')); return '<th class="'+cls+'">'+esc(c)+'</th>'; }).join('')+'<th></th></tr>';

  // Thanh tổng dùng chung (giống các hạng mục SP khác) — hiện cho cả Phần thô
  var teP=document.getElementById('tkTotals');
  if(teP){ teP.innerHTML='<div class="tkt-bar">'
    +'<div class="tkt-seg"><span class="tkt-ic">'+icon('money',16)+'</span><span class="tkt-c"><span class="tkt-l">Tổng chưa VAT</span><span class="tkt-v">'+money(comp.grand)+' đ</span></span></div>'
    +'<div class="tkt-seg"><span class="tkt-ic">'+icon('gauge',16)+'</span><span class="tkt-c"><span class="tkt-l">Thuế VAT <input class="tkt-vat" type="number" step="any" min="0" value="'+comp.vatPct+'" onchange="ptSetVat(this.value)">%</span><span class="tkt-v">'+money(comp.vat)+' đ</span></span></div>'
    +'<div class="tkt-seg grand"><span class="tkt-ic">'+icon('cart',17)+'</span><span class="tkt-c"><span class="tkt-l">Tổng thành tiền</span><span class="tkt-v">'+money(comp.afterTax)+' đ</span></span></div>'
    +'</div>'; }
  var tcP=document.getElementById('tkCount'); if(tcP){ var nItems=(S.phanTho||[]).reduce(function(s,se){return s+((se.items||[]).length);},0); tcP.textContent='['+pad2(nItems)+']'; }
  pw.innerHTML =
    '<div class="pt-toolbar">'
      + '<div class="pt-tt">Bảng ước tính chi phí — <b>Xây dựng thô</b></div>'
      + '<div class="sp"></div>'
      + '<button class="btn ghost sm" onclick="ptReset()">Khôi phục mẫu</button>'
      + '<button class="btn blue sm" onclick="ptAddSection()">'+icon('plus',14)+' Thêm hạng mục</button>'
    + '</div>'
    + '<div class="pt-scroll"><table class="pt">'+colg+'<thead>'+thead+'</thead><tbody>'+body+'</tbody></table></div>'
    + '<div class="pt-foot">'
      + '<div class="pt-notes"><b>Ghi chú:</b>'
        + '<ol><li>Khối lượng trên là tạm tính, khối lượng quyết toán theo diện tích xây dựng thực tế.</li>'
        + '<li>Giá trên chưa bao gồm nhân công hoàn thiện.</li>'
        + '<li>Giá trên đã bao gồm thuế VAT.</li></ol></div>'
      + '<div class="pt-sign"><div><div class="pt-sign-t">KHÁCH HÀNG / CUSTOMER</div></div>'
        + '<div><div class="pt-sign-t">ĐƠN VỊ THI CÔNG / CONSTRUCTION UNIT</div></div></div>'
    + '</div>';
}

/* ===== GO ===== */
initCols();
initTableInteractions();
boot();
