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
// Chuột phải trên bảng (như Excel): sắp xếp / cố định / tô màu điều kiện
function tkCtx(e){
  var th=e.target.closest('th.thk'); var td=e.target.closest('td'); var tr=e.target.closest('tr.drow');
  var key = th?th.getAttribute('data-k') : (td && tr ? colKeyOfCell_(td) : '');
  e.preventDefault(); closePop();
  var r=S.cfRules||{};
  var pop=document.createElement('div'); pop.className='fltpop ctxmenu'; pop.id='qs_pop'; pop.style.width='232px';
  var html='';
  if(tr){ var lineId=tr.getAttribute('data-id');
    html+='<div class="fpa danger" onclick="closePop();delLine(\''+lineId+'\')">🗑 Xoá hạng mục này</div><div class="fpsep"></div>';
  }
  if(key){ var lbl=(COLS.filter(function(c){return c[0]===key;})[0]||[key,key])[1];
    html+='<div class="fhdr">Cột: '+esc(lbl)+'</div>'
     +'<div class="fpa" onclick="colSort(\''+key+'\',\'asc\')">▲ Sắp xếp tăng dần</div>'
     +'<div class="fpa" onclick="colSort(\''+key+'\',\'desc\')">▼ Sắp xếp giảm dần</div>'
     +(S.sortKey?'<div class="fpa" onclick="resetSort();closePop()">✕ Bỏ sắp xếp</div>':'')
     +'<div class="fpa" onclick="colFreezeTo(\''+key+'\')">❄ Cố định đến cột này</div>'
     +((S.freezeN||0)>0?'<div class="fpa" onclick="colUnfreeze()">✕ Bỏ cố định cột</div>':'')
     +'<div class="fpsep"></div>';
  }
  html+='<div class="fhdr">Tô màu điều kiện</div>'
    +'<div class="fchk'+(r.ln0?' on':'')+'" onclick="cfToggle(\'ln0\')"><span class="bx">'+(r.ln0?'✓':'')+'</span><span class="cfdot cf-red"></span> Lợi nhuận &lt; 0</div>'
    +'<div class="fchk'+(r.noPrice?' on':'')+'" onclick="cfToggle(\'noPrice\')"><span class="bx">'+(r.noPrice?'✓':'')+'</span><span class="cfdot cf-yellow"></span> Chưa có giá bán</div>'
    +'<div class="fchk'+(r.sl0?' on':'')+'" onclick="cfToggle(\'sl0\')"><span class="bx">'+(r.sl0?'✓':'')+'</span><span class="cfdot cf-grey"></span> Số lượng = 0</div>'
    +'<div class="fpsep"></div><div class="fpa" onclick="closePop();openFindReplace()">🔍 Tìm &amp; thay thế (Ctrl+F)</div>';
  pop.innerHTML=html; document.body.appendChild(pop);
  var L=Math.min(e.clientX, window.innerWidth-244), T=Math.min(e.clientY, window.innerHeight-pop.offsetHeight-12);
  pop.style.left=Math.max(8,L)+'px'; pop.style.top=Math.max(8,T)+'px';
  setTimeout(function(){ document.addEventListener('mousedown',popOutside); },0);
}
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
function frClearHits_(){ document.querySelectorAll('#tkTable .fr-hit').forEach(function(e){ e.classList.remove('fr-hit','fr-hit-cur'); }); }
function frFind(){ frClearHits_(); var q=(document.getElementById('frFind')||{}).value||''; var cnt=document.getElementById('frCnt');
  if(!q){ if(cnt)cnt.textContent=''; return; }
  var ql=q.toLowerCase(), hits=[];
  document.querySelectorAll('#tkTable tr.drow td').forEach(function(td){ if((td.textContent||'').toLowerCase().indexOf(ql)>=0){ td.classList.add('fr-hit'); hits.push(td); } });
  if(cnt) cnt.textContent=hits.length?('★ '+hits.length):'0';
  if(hits.length){ hits[0].classList.add('fr-hit-cur'); hits[0].scrollIntoView({block:'center'}); } }
function frReplaceAll(){ var q=(document.getElementById('frFind')||{}).value||''; var rep=(document.getElementById('frRep')||{}).value||'';
  if(!q){ toast('Nhập từ cần tìm'); return; }
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
  // Chặn tab không được cấp quyền -> chuyển về tab đầu tiên hợp lệ
  if(S.me && !canTab(tab)){ var f=firstAllowedTab_(); if(!f){ toast('Tài khoản chưa được cấp quyền vào phần nào'); return; } if(f!==tab){ tab=f; } }
  document.querySelectorAll('#nav a, .topnav .right a').forEach(function(a){ a.classList.toggle('active',a.getAttribute('data-tab')===tab); });
  ['boc','project','dash','chiphi','export','import','sanpham','muahang','duan','admin'].forEach(function(v){
    var el=document.getElementById('v-'+v); if(el) el.classList.toggle('on',v===tab);
  });
  // Ẩn breadcrumb + banner dự án ở các trang KHÔNG thuộc 1 dự án cụ thể
  var noProj = (tab==='admin' || tab==='sanpham' || tab==='import');
  var crumb=document.querySelector('.crumb'); if(crumb) crumb.style.display = noProj?'none':'';
  var pcard=document.getElementById('pcard'); if(pcard) pcard.style.display = noProj?'none':'';
  if(tab==='project') renderProjects();
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
function applyFiltDrop(){
  var isPT=(S.node==='3.1');
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
  var searchIc='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>';
  box.innerHTML='<div class="sechd"><h2>Danh sách sản phẩm</h2><span class="count" id="spCount">0</span></div>'
    +'<div class="sp-workspace">'
      +'<div class="sp-projpanel" id="spProjPanel"></div>'
      +'<div class="sp-main">'
        +'<div class="dbcard sp-card">'
          +'<div class="sp-toolbar">'
            +'<div class="sp-search-wrap">'+searchIc+'<input id="spSearch" placeholder="Tìm theo tên, mã hoặc thương hiệu…" oninput="spFilter()"></div>'
            +'<span class="sp-flex"></span>'
            +'<button class="btn ghost sm" id="spBoLocBtn" onclick="spToggleBoLoc(event)">'+icon('sliders',14)+' Bộ lọc<span class="spflt-badge" id="spFltBadge"></span></button>'
            +'<button class="btn blue sm" onclick="showTab(\'import\')">'+icon('plus',14)+' Thêm sản phẩm</button>'
          +'</div>'
          +'<div class="spbar" id="spBar"></div>'
          +'<div class="colchips sp-colchips" id="spColBar"></div>'
          +'<div class="tbl-wrap"><table class="sp-table"><thead id="spHead"></thead>'
            +'<tbody id="spBody"></tbody></table></div>'
        +'</div><div id="spBulkWrap"></div>'
      +'</div>'
    +'</div>';
  S._spSel=S._spSel||{}; S._spFilters=S._spFilters||{};
  if(!S._spCols) S._spCols={thumb:1,ten:1,thuongHieu:1,hangMuc:1,specs:1,giaDaiLy:1};
  renderSpProjPanel_(); renderSpChips_(); spColChips_(); spRenderHead_(); spFilter();
}
// LEFT: sản phẩm đã ghi danh vào dự án hiện tại (S.lines)
function renderSpProjPanel_(){
  var el=document.getElementById('spProjPanel'); if(!el) return;
  var head='<div class="spp-head"><span class="spp-ic">'+icon('layers',16)+'</span><h3>Sản phẩm trong dự án</h3><span class="spp-count">'+((S.cur?S.lines:[])||[]).length+'</span></div>';
  if(!S.cur){ el.innerHTML=head+'<div class="spp-empty">Chưa chọn dự án.<br>Vào <b>Bảng điều khiển</b> để chọn/tạo dự án.</div>'; return; }
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
  }).join('')||'<div class="spp-empty">Chưa có sản phẩm.<br>Bấm ＋ ở danh mục bên phải để ghi danh vào dự án.</div>';
  el.innerHTML=head+'<div class="spp-proj">'+icon('building',13)+' '+esc(S.cur.ten||'')+'</div><div class="spp-list">'+rows+'</div>';
}
function spAddToProject(i){ var p=(S._spList||[])[i]; if(!p) return; if(!S.cur){ toast('Chưa chọn dự án'); return; }
  addProdObj(p); renderSpProjPanel_(); setTimeout(renderSpProjPanel_,700); }
async function spRemoveFromProject(id){ await delLine(id); renderSpProjPanel_(); }
// ==== Cột bảng SP có thể ẩn/hiện (giữa cột chọn và cột thao tác) ====
var SP_COLS=[
  ['thumb','Ảnh','thumbcol',function(p){ return p.hinhAnh?'<img class="sp-th" src="'+esc(imgSrc1_(p.hinhAnh))+'" onerror="this.style.visibility=\'hidden\'">':'<span class="sp-th"></span>'; }],
  ['ten','Sản phẩm','sp-name',function(p){ return '<b>'+esc(p.ten||'')+'</b><span class="sp-code">'+esc(p.ma||'')+'</span>'; }],
  ['thuongHieu','Thương hiệu','',function(p){ return p.thuongHieu?'<span class="tag-brand">'+esc(p.thuongHieu)+'</span>':''; }],
  ['hangMuc','Loại đèn','',function(p){ return p.hangMuc?'<span class="tag-cat">'+esc(p.hangMuc)+'</span>':''; }],
  ['ncc','Nhà cung cấp','',function(p){ return esc(p.ncc||''); }],
  ['specs','Thông số','sp-specs',function(p){ return spSpecs_(p); }],
  ['congSuat','Công suất','ct',function(p){ return p.congSuat?'<span class="spec">'+esc(p.congSuat)+'</span>':'—'; }],
  ['nhietDo','Nhiệt độ màu','ct',function(p){ return p.nhietDo?'<span class="spec k">'+esc(p.nhietDo)+'</span>':'—'; }],
  ['gocChieu','Góc chiếu','ct',function(p){ return p.gocChieu?esc(p.gocChieu):'—'; }],
  ['cri','CRI','ct',function(p){ return p.cri?'CRI '+esc(p.cri):'—'; }],
  ['giaDaiLy','Giá đại lý','num sp-price',function(p){ return money(p.donGiaBan)+'<span class="unit">đ</span>'; }]
];
function spColOn_(k){ return k==='ten' ? true : !!(S._spCols&&S._spCols[k]); }
function spThCls_(c){ var cl=c[2]||''; if(cl.indexOf('num')>=0)return 'num'; if(cl.indexOf('ct')>=0)return 'ct'; if(cl.indexOf('thumbcol')>=0)return 'thumbcol'; return ''; }
function spVisCols_(){ return SP_COLS.filter(function(c){ return spColOn_(c[0]); }); }
function spColToggle(k){ if(k==='ten') return; S._spCols=S._spCols||{}; S._spCols[k]=!S._spCols[k]; spColChips_(); spRenderHead_(); spFilter(); }
function spColChips_(){
  var bar=document.getElementById('spColBar'); if(!bar) return;
  bar.innerHTML='<span class="cp-collbl">Cột hiển thị</span>'+SP_COLS.map(function(c){
    var lock=c[0]==='ten', on=spColOn_(c[0]);
    return '<span class="chip'+(on?' on':'')+(lock?' lock':'')+'"'+(lock?'':' onclick="spColToggle(\''+c[0]+'\')"')+'>'+esc(c[1])+'</span>';
  }).join('');
}
function spRenderHead_(){
  var head=document.getElementById('spHead'); if(!head) return;
  head.innerHTML='<tr><th class="selcol"><input type="checkbox" class="spck" id="spCkAll" onclick="spSelAll(this.checked)"></th>'
    +spVisCols_().map(function(c){ return '<th class="'+spThCls_(c)+'">'+esc(c[1])+'</th>'; }).join('')
    +'<th class="act-sp"></th></tr>';
}
// Thanh chip "Hạng mục đã bóc" = nhóm/dòng SP (giống bộ chọn hạng mục bên Bóc tách)
// chuẩn hoá tên (gộp trùng hoa/thường + khoảng trắng)
function spNorm_(s){ return String(s||'').trim().toLowerCase().replace(/\s+/g,' '); }
// map sản phẩm -> node cây đề mục qua "muc" (vd "Thiết bị đèn" -> 3.2.6.1)
function spNodeCodeOf_(p){ var muc=(p&&p.muc)||''; for(var i=0;i<TREE.length;i++){ if(TREE[i][1]===muc) return TREE[i][0]; } return ''; }
function spNodeCount_(code){ if(!code) return (S.products||[]).length;
  return (S.products||[]).filter(function(p){ var c=spNodeCodeOf_(p); return c===code || c.indexOf(code+'.')===0; }).length; }
function renderSpChips_(){
  var bar=document.getElementById('spBar'); if(!bar) return; var f=S._spFilters||{};
  var total=(S.products||[]).length;
  var label = f.node ? (f.node+'.'+nodeName(f.node)) : 'Tất cả hạng mục';
  var cnt = f.node ? spNodeCount_(f.node) : total;
  // hàng 1: chọn hạng mục dạng cây (TREE) giống Bóc tách
  var catRow='<div class="sp-catrow"><span class="lb">Hạng mục</span>'
    +'<div class="sp-catwrap"><button class="tree-btn sp-catbtn" id="spCatBtn" onclick="spCatToggle(event)"><span class="sp-catlbl">'+esc(label)+'</span><span class="cnt">['+pad2(cnt)+']</span><span class="sp-caret">▾</span></button>'
      +'<div class="tree-pop" id="spCatPop" style="display:none"></div></div>'
    +(spFltCount_()?'<span class="spchip clr" onclick="spClearFilters()">✕ Xóa bộ lọc</span>':'')+'</div>';
  bar.innerHTML=catRow;
  var badge=document.getElementById('spFltBadge'); var n=spFltCount_();
  if(badge){ badge.textContent=n||''; badge.style.display=n?'inline-flex':'none'; }
  var btn=document.getElementById('spBoLocBtn'); if(btn) btn.classList.toggle('on', n>0);
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
  renderSpChips_(); spFilter();
  if(document.getElementById('spFltPop')) spBoLocPop_();
}
function spSetFilter(key,val){ S._spFilters=S._spFilters||{}; if(!val) delete S._spFilters[key]; else if(S._spFilters[key]===val) delete S._spFilters[key]; else S._spFilters[key]=val; renderSpChips_(); spFilter(); }
function spClearFilters(){ S._spFilters={watt:{},kelvin:{},angle:{},cri:{}}; renderSpChips_(); spFilter(); if(document.getElementById('spFltPop')) spBoLocPop_(); }
// đếm số điều kiện "bộ lọc nâng cao" đang bật (không tính chip Hạng mục hiển thị sẵn)
function actKeys_(o){ return Object.keys(o||{}).filter(function(k){ return o[k]; }); }
function spFltCount_(){ var f=S._spFilters||{}; var n=0; if(f.brand)n++; if(f.hangMuc)n++; if(f.min)n++; if(f.max)n++;
  ['watt','kelvin','angle','cri'].forEach(function(g){ n+=actKeys_(f[g]).length; }); return n; }
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
  pop.innerHTML='<div class="fhdr">Bộ lọc nâng cao</div>'
    +single('Thương hiệu','brand','thuongHieu')
    +single('Loại đèn','hangMuc','hangMuc')
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
function spAfterFlt_(){ renderSpChips_(); spFilter(); }
function spFltSet(key,val){ S._spFilters=S._spFilters||{}; if(!val) delete S._spFilters[key]; else S._spFilters[key]=val; spAfterFlt_(); spBoLocPop_(); }
function spFltSpec(fkey,val){ S._spFilters=S._spFilters||{}; var o=S._spFilters[fkey]=S._spFilters[fkey]||{}; if(o[val]) delete o[val]; else o[val]=1; spAfterFlt_(); spBoLocPop_(); }
function spFltPrice(){ var f=S._spFilters=S._spFilters||{}; var mn=document.getElementById('spFMin'), mx=document.getElementById('spFMax');
  f.min=mn?(Number(mn.value)||0):0; f.max=mx?(Number(mx.value)||0):0; spAfterFlt_(); }
function spFltReset(){ S._spFilters={watt:{},kelvin:{},angle:{},cri:{}}; spAfterFlt_(); spBoLocPop_(); }
function spSpecs_(p){ var out=[];
  if(p.congSuat) out.push('<span class="spec">'+esc(p.congSuat)+'</span>');
  if(p.nhietDo) out.push('<span class="spec k">'+esc(p.nhietDo)+'</span>');
  if(p.cri) out.push('<span class="spec">CRI '+esc(p.cri)+'</span>');
  if(p.gocChieu) out.push('<span class="spec">'+esc(p.gocChieu)+'</span>');
  return out.join('')||'<span class="muted">—</span>'; }
function spFilter(){
  var el=document.getElementById('spSearch'); var q=(el&&el.value||'').toLowerCase().trim(); var f=S._spFilters||{};
  var watts=actKeys_(f.watt), kels=actKeys_(f.kelvin), angs=actKeys_(f.angle), cris=actKeys_(f.cri);
  var mn=Number(f.min)||0, mx=Number(f.max)||0;
  var list=(S.products||[]).filter(function(p){
    if(q && (p.ten+' '+p.ma+' '+p.thuongHieu+' '+p.ncc).toLowerCase().indexOf(q)<0) return false;
    if(f.node){ var c=spNodeCodeOf_(p); if(!(c===f.node || c.indexOf(f.node+'.')===0)) return false; }
    if(f.dong && spNorm_(p.nhom)!==spNorm_(f.dong)) return false;
    if(f.brand && p.thuongHieu!==f.brand) return false;
    if(f.hangMuc && p.hangMuc!==f.hangMuc) return false;
    var pr=Number(p.donGiaBan)||0; if(mn&&pr<mn) return false; if(mx&&pr>mx) return false;
    if(watts.length){ var pw=splitVals(p.congSuat); if(!pw.some(function(x){return watts.indexOf(x)>=0;})) return false; }
    if(kels.length){ var pk=splitVals(p.nhietDo); if(!pk.some(function(x){return kels.indexOf(x)>=0;})) return false; }
    if(angs.length){ var pa=splitVals(p.gocChieu); if(!pa.some(function(x){return angs.indexOf(x)>=0;})) return false; }
    if(cris.length){ var pc=splitVals(p.cri); if(!pc.some(function(x){return cris.indexOf(x)>=0;})) return false; }
    return true;
  });
  S._spList=list; S._spSel=S._spSel||{};
  var cnt=document.getElementById('spCount'); if(cnt) cnt.textContent=list.length+' SP';
  var isAdmin=S.me&&S.me.role==='admin';
  var vis=spVisCols_(), ncol=vis.length+2;
  document.getElementById('spBody').innerHTML=list.length?list.map(function(p,i){
    var sel=!!S._spSel[p.ma];
    return '<tr class="sp-row'+(sel?' selrow':'')+'" onclick="spModal('+i+')">'
      +'<td class="selcol" onclick="event.stopPropagation()"><input type="checkbox" class="spck" '+(sel?'checked':'')+' onclick="spSelToggle(\''+esc(p.ma)+'\',this.checked)"></td>'
      +vis.map(function(c){ return '<td class="'+c[2]+'">'+c[3](p)+'</td>'; }).join('')
      +'<td class="act-sp" onclick="event.stopPropagation()">'
        +'<button class="sp-act add" title="Ghi danh vào dự án" onclick="spAddToProject('+i+')">'+icon('pluscircle',18)+'</button>'
        +'<button class="sp-act" title="Xem chi tiết" onclick="spModal('+i+')">'+icon('eye',16)+'</button>'
        +(isAdmin?'<button class="sp-act del" title="Xoá" onclick="spDelete('+i+')">'+icon('trash',16)+'</button>':'')+'</td>'
    +'</tr>';
  }).join(''):'<tr><td colspan="'+ncol+'"><div class="empty" style="margin:10px">Không có sản phẩm khớp bộ lọc.</div></td></tr>';
  var all=document.getElementById('spCkAll'); if(all) all.checked = list.length>0 && list.every(function(p){return S._spSel[p.ma];});
  spBulkBar_();
}
function spSelToggle(ma,on){ S._spSel=S._spSel||{}; if(on) S._spSel[ma]=1; else delete S._spSel[ma]; spFilter(); }
function spSelAll(on){ S._spSel={}; if(on)(S._spList||[]).forEach(function(p){ if(p.ma) S._spSel[p.ma]=1; }); spFilter(); }
function spClearSel(){ S._spSel={}; spFilter(); }
function spBulkBar_(){
  var wrap=document.getElementById('spBulkWrap'); if(!wrap) return;
  var n=Object.keys(S._spSel||{}).length; if(!n){ wrap.innerHTML=''; return; }
  var isAdmin=S.me&&S.me.role==='admin';
  wrap.innerHTML='<div class="spbulk"><span class="n">Đã chọn '+n+' sản phẩm</span><span class="sp"></span>'
    +'<button class="clr" onclick="spClearSel()">Bỏ chọn</button>'
    +(isAdmin?'<button class="go red" onclick="spBulkDelete()">Xóa '+n+' sản phẩm</button>'
             :'<button class="go" onclick="spBulkRequest()">Gửi yêu cầu xóa ('+n+')</button>')+'</div>';
}
async function spBulkDelete(){
  var mas=Object.keys(S._spSel||{}); if(!mas.length) return;
  if(!confirm('Xóa '+mas.length+' sản phẩm khỏi danh mục? Không thể hoàn tác.')) return;
  var ok=0; for(var i=0;i<mas.length;i++){ try{ await api('deleteDbProduct', mas[i]); ok++; }catch(e){} }
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
      body+='<tr class="drow'+(ri%2===0?' alt':'')+cfClass_(l)+'" draggable="true" data-id="'+l.lineId+'" data-tang="'+esc(l.tang||'')+'"'+hs+'>'+cols.map(function(c){
        var k=c[0];
        if(k==='stt') return '<td class="ct dragH" title="Kéo để di chuyển dòng · chuột phải để xoá"><span class="grip">⠿</span> '+(gi+1)+'.'+(ri+1)+'</td>';
        return cellInput(l,k);
      }).join('')+'</tr>';
    });
    body+=tkSpacer;   // dòng khoảng trắng trước tầng kế (như PDF)
  });
  var selF=(S.selFloor||'').trim();
  body+='<tr class="addrow"><td colspan="'+cols.length+'">'
    +'<button class="addbtn floor" onclick="openAddFloor(event)">'+icon('plus',15)+'Thêm tầng</button>'
    +'<button class="addbtn item" onclick="addBlankItem()" title="Thêm 1 hạng mục trống vào tầng đang chọn">'+icon('plus',15)+'Thêm hạng mục'
      +(selF?'<span class="addbtn-sub">vào '+esc(selF)+'</span>':'')+'</button>'
    +'</td></tr>';
  t.style.width=totalW+'px';
  var frzN=Math.min(S.freezeN||0,cols.length);
  t.className='tk'+(frzN?(' frz'+frzN):'');
  t.style.setProperty('--frz1w', colW(cols[0][0])+'px');
  t.innerHTML=colg+head+body;
  t.querySelectorAll('td.wrap textarea').forEach(autoGrow);   // ô "Thông tin chính" tự giãn hết dòng
  if(t.rows[0]) t.style.setProperty('--thH', t.rows[0].offsetHeight+'px');  // để dòng tầng dính ngay dưới header
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
    recalcLine_(l, fields);   // mirror calc_() ở server -> optimistic khớp, không nhảy số / không lag
    renderTable(); renderCard();
    if(document.getElementById('v-chiphi').classList.contains('on')) renderChiphi();
    if(bgVis()) drawBaogia();
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
// Nút xoá đặt NGOÀI bảng (gutter bên phải), đồng bộ vị trí theo cuộn dọc/ngang
function renderActGutter(){
  var inner=document.getElementById('actGutterInner'); if(!inner) return;
  var rows=document.querySelectorAll('#tkTable tr.drow');
  inner.innerHTML=[].map.call(rows,function(tr){ var id=tr.getAttribute('data-id');
    return '<button class="agx" data-id="'+id+'" title="Xoá hạng mục này" onclick="delLine(\''+id+'\')">✕</button>'; }).join('');
  if(!S._agBound){ var wrap=document.querySelector('#v-boc .tbl-wrap'); if(wrap){ wrap.addEventListener('scroll',syncActGutter,{passive:true}); window.addEventListener('resize',syncActGutter); S._agBound=1; } }
  syncActGutter();
}
function syncActGutter(){
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
    b.style.top=(mid - (wr.top+headH) - 9.5)+'px';
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
async function pickProject(maDA){ S.cur=S.projects.filter(function(p){return p.maDA===maDA;})[0]; S.lines=await api('getLines',maDA)||[]; S._coverDA=null; renderAll(); renderProjects(); showTab('project'); }
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
  var von=0,ban=0,kl=0,groups={}; S.lines.forEach(function(l){ von+=ttVon_(l);ban+=ttBan_(l);kl+=Number(l.soLuong)||0; var k=l.nhom||'Khác'; (groups[k]=groups[k]||{ban:0}).ban+=ttBan_(l); });
  var gr=currentGroup();
  var byG=Object.keys(groups).map(function(k){return {k:k,ban:groups[k].ban};}).sort(function(a,b){return b.ban-a.ban;});
  var max=byG.reduce(function(m,g){return Math.max(m,g.ban);},1);
  var bars=byG.map(function(g){ return '<div style="margin:11px 0"><div style="display:flex;justify-content:space-between;font-size:13px"><span>'+esc(nodeName(g.k))+'</span><b>'+money(g.ban)+' đ</b></div><div style="height:10px;background:#eef2f6;border-radius:6px;overflow:hidden;margin-top:5px"><i style="display:block;height:100%;width:'+(g.ban/max*100)+'%;background:var(--blue);border-radius:6px"></i></div></div>'; }).join('')||'<div class="empty">Chưa có hạng mục nào trong bản nháp này.</div>';
  var banner='<div class="dash-banner"><div class="db-l"><div class="db-eyebrow">Đang làm việc</div>'
    +'<div class="db-title">'+icon('building',18)+esc(S.cur.ten)+'<span class="db-sep">›</span>Bản nháp '+((gr?gr.idx:0)+1)+'</div>'
    +'<div class="db-code">'+esc(S.cur.maDA)+' · Tạo '+fmtDate(S.cur.ngayTao)+'</div></div>'
    +'<div class="db-r"><button class="btn light sm" onclick="showTab(\'project\')">'+icon('doc',14)+' Thông tin</button>'
    +'<button class="btn white sm" onclick="showTab(\'boc\')">'+icon('layers',14)+' Mở bóc tách</button></div></div>';
  var lnT=ban-von;
  var kpis='<div class="kpis">'
    +kpi(icon('list',18),'Số hạng mục',S.lines.length,'blue')
    +kpi(icon('layers',18),'Tổng khối lượng',kl,'blue')
    +kpi(icon('lock',18),'Giá trị vốn',money(von)+' đ','')
    +kpi(icon('money',18),'Tổng giá bán',money(ban)+' đ','blue')
    +kpi(icon('gauge',18),'Lợi nhuận',money(lnT)+' đ',lnT<0?'red':'green')+'</div>';
  el.innerHTML=header+banner+kpis
    +dbCard_('Giá trị theo nhóm (giá bán)','gauge','', '<div class="dash-bars">'+bars+'</div>')
    +drafts;
}

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
  if(k==='ten') return '<td class="td-ten"><input class="cin" value="'+esc(l.ten||'')+'" onchange="editLine(\''+l.lineId+'\',{ten:this.value})"></td>';
  return cellInput(l,k);
}
function renderChiphi(){
  var box=document.getElementById('v-chiphi');
  if(!S.cur){ box.innerHTML='<div class="empty" style="padding:26px;text-align:center">Chưa chọn dự án.</div>'; return; }
  if(!S.cpCols) S.cpCols={ten:1,dvt:1,soLuong:1,giaNCC:1,chietKhau:1,giaDaiLy:1,lnPct:1,donGia:1,thanhTien:1,lnVnd:1};
  var keys=CP_KEYS.filter(function(k){ return S.cpCols[k]; });
  var numK=['soLuong','giaNCC','giaDaiLy','donGia','donGiaCK','lnVnd','thanhTien'], ctK=['dvt','chietKhau','lnPct','ckKhach','markup','margin'];
  function alignCls(k){ return numK.indexOf(k)>=0?'num':(ctK.indexOf(k)>=0?'ct':''); }
  // ---- KPI tổng ----
  var von=0,ban=0; S.lines.forEach(function(l){ von+=ttVon_(l); ban+=ttBan_(l); });
  var lnT=ban-von, bien=ban>0?(lnT/ban*100):0, lnCls=lnT<0?'red':'green';
  var stat='<div class="cp-kpis">'
    +cpKpi_(icon('lock',17),'Giá trị vốn',money(von)+' đ','')
    +cpKpi_(icon('money',17),'Tổng giá bán',money(ban)+' đ','blue')
    +cpKpi_(icon('gauge',17),'Lợi nhuận',money(lnT)+' đ',lnCls)
    +cpKpi_(icon('gauge',17),'Biên lợi nhuận',bien.toFixed(1)+'%',lnCls)+'</div>';
  // hàng chip cột hiện sẵn (giống .colchips bên Bóc tách)
  var colbar='<div class="colchips cp-colchips"><span class="cp-collbl">Cột hiển thị</span>'
    +CP_KEYS.map(function(k){ return '<span class="chip'+(S.cpCols[k]?' on':'')+'" onclick="cpToggle(\''+k+'\')">'+esc(cpLabel_(k))+'</span>'; }).join('')+'</div>';
  // ---- Bảng y hệt Bóc tách: colgroup + header navy + nhóm theo tầng + spacer + drow alt ----
  var ncol=keys.length+1;
  var totalW=64+keys.reduce(function(s,k){ return s+colW(k); },0);
  var colg='<colgroup><col style="width:64px">'+keys.map(function(k){ return '<col style="width:'+colW(k)+'px">'; }).join('')+'</colgroup>';
  var head='<tr><th class="ct">STT</th>'+keys.map(function(k){ return '<th class="thk '+alignCls(k)+'">'+esc(cpLabel_(k))+'</th>'; }).join('')+'</tr>';
  var body='';
  if(!S.lines.length){ body='<tr><td class="empty" colspan="'+ncol+'">Chưa có hạng mục. Vào tab <b>Bóc tách</b> để thêm sản phẩm.</td></tr>'; }
  S.lines.forEach(function(l,ri){
    body+='<tr class="drow'+(ri%2===0?' alt':'')+'" data-id="'+l.lineId+'"><td class="ct">'+(ri+1)+'</td>'
      +keys.map(function(k){ return cpCell_(l,k); }).join('')+'</tr>';
  });
  var foot='';
  if(S.lines.length){ foot='<tr class="cp-foot"><td class="ct"></td>'+keys.map(function(k){
      if(k==='ten') return '<td><b>TỔNG · '+S.lines.length+' hạng mục</b></td>';
      if(k==='thanhTien') return '<td class="num"><b class="cp-strong">'+money(ban)+'</b></td>';
      if(k==='lnVnd') return '<td class="num">'+cpSigned_(lnT)+'</td>';
      if(k==='giaDaiLy') return '<td class="num"><b>'+money(von)+'</b></td>';
      return '<td class="'+alignCls(k)+'"></td>';
    }).join('')+'</tr>'; }
  box.innerHTML='<div class="sechd"><h2>Chi phí</h2><span class="count">'+S.lines.length+'</span><span class="sp" style="flex:1"></span><span class="cp-hint">'+icon('sliders',13)+' Bảng giống Bóc tách — bấm ô để sửa giá NCC · CK · %LN · giá bán, số tính lại ngay</span></div>'
    +stat+colbar
    +'<div class="dbcard cp-card"><div class="tbl-wrap"><table class="tk cpflat" style="width:'+totalW+'px">'+colg+head+body+foot+'</table></div></div>';
}

/* ===== DỰ ÁN — Sản phẩm trong dự án (gom theo tầng, y kiểu Bóc tách) ===== */
var DA_KEYS=['khuVuc','maBanVe','nganh','maSP','ten','thuongHieu','ncc','moTa','kichThuoc','hinhAnh','dvt','soLuong','giaNCC','chietKhau','giaDaiLy','lnPct','donGia','thanhTien'];
function daColToggle(k){ S._daCols=S._daCols||{}; S._daCols[k]=!S._daCols[k]; renderDuAn(); }
function renderDuAn(){
  var box=document.getElementById('v-duan'); if(!box) return;
  if(!S.cur){ box.innerHTML='<div class="sechd"><h2>Sản phẩm trong dự án</h2></div>'
    +'<div class="empty" style="padding:30px;text-align:center;background:#fff;border:1px solid var(--line);border-radius:14px">Chưa chọn dự án. Vào <b>Bảng điều khiển</b> để chọn/tạo dự án.</div>'; return; }
  if(!S._daCols) S._daCols={khuVuc:1,ten:1,thuongHieu:1,moTa:1,kichThuoc:1,hinhAnh:1,dvt:1,soLuong:1,donGia:1,thanhTien:1};
  var keys=DA_KEYS.filter(function(k){ return S._daCols[k]; });
  var numK=['soLuong','giaNCC','giaDaiLy','donGia','donGiaCK','lnVnd','thanhTien'], ctK=['maBanVe','nganh','hinhAnh','dvt','chietKhau','lnPct','ckKhach','markup','margin'];
  function alignCls(k){ return numK.indexOf(k)>=0?'num':(ctK.indexOf(k)>=0?'ct':''); }
  var ban=0; S.lines.forEach(function(l){ ban+=ttBan_(l); });
  var vat=Math.round(ban*(Number(S.cur.vat)||0)/100);
  // KPI
  var stat='<div class="cp-kpis">'
    +cpKpi_(icon('list',17),'Số sản phẩm',S.lines.length,'blue')
    +cpKpi_(icon('layers',17),'Tổng số lượng',S.lines.reduce(function(s,l){return s+(Number(l.soLuong)||0);},0),'')
    +cpKpi_(icon('money',17),'Tổng giá bán',money(ban)+' đ','blue')
    +cpKpi_(icon('gauge',17),'Tổng gồm VAT',money(ban+vat)+' đ','green')+'</div>';
  // chip chọn cột (hiện sẵn)
  var colbar='<div class="colchips cp-colchips"><span class="cp-collbl">Cột hiển thị</span>'
    +DA_KEYS.map(function(k){ return '<span class="chip'+(S._daCols[k]?' on':'')+'" onclick="daColToggle(\''+k+'\')">'+esc(cpLabel_(k))+'</span>'; }).join('')+'</div>';
  // bảng
  var ncol=keys.length+1;
  var totalW=64+keys.reduce(function(s,k){ return s+colW(k); },0);
  var colg='<colgroup><col style="width:64px">'+keys.map(function(k){ return '<col style="width:'+colW(k)+'px">'; }).join('')+'</colgroup>';
  var head='<tr><th class="ct">STT</th>'+keys.map(function(k){ return '<th class="thk '+alignCls(k)+'">'+esc(cpLabel_(k))+'</th>'; }).join('')+'</tr>';
  var groups={}; S.lines.forEach(function(l){ var g=(l.tang||'').trim()||'CHƯA PHÂN TẦNG'; (groups[g]=groups[g]||[]).push(l); });
  var order=floorsList().slice(); Object.keys(groups).forEach(function(g){ if(order.indexOf(g)<0) order.push(g); });
  order=order.filter(function(g){ return groups[g]&&groups[g].length; });
  var spacer='<tr class="tk-spacer"><td colspan="'+ncol+'"></td></tr>';
  var body='';
  if(!S.lines.length){ body='<tr><td class="empty" colspan="'+ncol+'">Chưa có sản phẩm. Vào <b>Danh sách sản phẩm</b> bấm ＋ để ghi danh, hoặc <b>Bóc tách</b> để thêm.</td></tr>'; }
  order.forEach(function(g,gi){
    var roman=['I','II','III','IV','V','VI','VII','VIII','IX','X'][gi]||(gi+1);
    var gsum=(groups[g]||[]).reduce(function(s,l){ return s+ttBan_(l); },0);
    body+='<tr class="grp"><td colspan="'+ncol+'"><span class="gname">'+roman+'. '+esc(g)+'</span><span class="gsum">Tổng tầng: <b>'+money(gsum)+' đ</b></span></td></tr>'+spacer;
    (groups[g]||[]).forEach(function(l,ri){
      body+='<tr class="drow'+(ri%2===0?' alt':'')+'" data-id="'+l.lineId+'"><td class="ct">'+(gi+1)+'.'+(ri+1)+'</td>'
        +keys.map(function(k){ return cellInput(l,k); }).join('')+'</tr>';
    });
    body+=spacer;
  });
  var foot='';
  if(S.lines.length){ foot='<tr class="cp-foot"><td class="ct"></td>'+keys.map(function(k,ki){
      if(ki===0) return '<td class="'+alignCls(k)+'"><b>TỔNG · '+S.lines.length+' SP</b></td>';
      if(k==='thanhTien') return '<td class="num"><b class="cp-strong">'+money(ban)+'</b></td>';
      if(k==='soLuong') return '<td class="num"><b>'+S.lines.reduce(function(s,l){return s+(Number(l.soLuong)||0);},0)+'</b></td>';
      return '<td class="'+alignCls(k)+'"></td>';
    }).join('')+'</tr>'; }
  box.innerHTML='<div class="sechd"><h2>Sản phẩm trong dự án</h2><span class="count">'+S.lines.length+'</span><span class="sp" style="flex:1"></span>'
      +'<span class="cp-hint">'+icon('building',13)+' '+esc(S.cur.ten||'')+' — bấm ô để sửa</span></div>'
    +stat+colbar
    +'<div class="dbcard cp-card"><div class="tbl-wrap"><table class="tk cpflat" style="width:'+totalW+'px">'+colg+head+body+foot+'</table></div></div>';
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
  var p=S.cur||{}, comp=coverCosts(), total=comp.total, cost=comp.cost;
  var inners=[];
  // ===== Header thương hiệu (Decox) =====
  var hangMuc = (S.bgDeMuc && S.bgDeMuc!=='__all__') ? (nodeName(S.bgDeMuc)||S.bgDeMuc) : 'TỔNG HỢP CHI PHÍ';
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
  // ===== Trang 1: header + info + TÓM TẮT (CHI TIẾT CÁC HẠNG MỤC + tỷ trọng) =====
  var srows, sumTotal=total;
  if(total>0){
    var rows=(S.cover||[]).filter(function(c){ return !bgHidden(c.stt) && coverDepth(c.stt)<=2; }).slice().sort(coverSortFn);
    srows=rows.map(function(c){ var lvl=coverDepth(c.stt), val=cost[c.stt]||0, pct=total>0?val/total*100:0;
      return '<tr class="lv'+lvl+'"><td class="nm">'+esc((c.stt?c.stt+'. ':'')+(c.hangMuc||''))+'</td><td class="amt">'+moneyShort(val)+'</td><td class="pct">'+pctFmt(pct)+'</td></tr>'; }).join('');
  } else {
    var gt=computeQuoteLocal().subtotal, by={}, ord=[];
    S.lines.forEach(function(l){ var code=(l.nhom||'').trim()||'__k'; if(!by[code]){ by[code]={sum:0,floors:{},forder:[]}; ord.push(code); }
      by[code].sum+=Number(l.thanhTienBan)||0; var fl=(l.tang||'').trim()||'Khác';
      if(!by[code].floors[fl]){ by[code].floors[fl]=0; by[code].forder.push(fl); } by[code].floors[fl]+=Number(l.thanhTienBan)||0; });
    srows=ord.map(function(code,i){ var g=by[code], pct=gt>0?g.sum/gt*100:0;
      var out='<tr class="lv1"><td class="nm">'+(i+1)+'. '+esc(code==='__k'?'Khác':(nodeName(code)||code))+'</td><td class="amt">'+moneyShort(g.sum)+'</td><td class="pct">'+pctFmt(pct)+'</td></tr>';
      if(g.forder.length>1) out+=g.forder.map(function(fl,j){ var v=g.floors[fl], p2=gt>0?v/gt*100:0;
        return '<tr class="lv2"><td class="nm">'+(i+1)+'.'+(j+1)+'. '+esc(fl)+'</td><td class="amt">'+moneyShort(v)+'</td><td class="pct">'+pctFmt(p2)+'</td></tr>'; }).join('');
      return out; }).join('');
    sumTotal=gt;
  }
  inners.push(decoxHead+infoBlock
    +'<div class="qx-secttl">CHI TIẾT CÁC HẠNG MỤC</div>'
    +'<div class="qsum-card"><table class="qsum">'+(srows||'<tr><td class="nm" style="color:#94a3b8;padding:16px 0">Chưa có hạng mục.</td></tr>')
    +'<tr class="qsum-tot"><td class="nm">TỔNG CHI PHÍ DỰ KIẾN</td><td class="amt">'+moneyShort(sumTotal)+'</td><td class="pct">100%</td></tr></table></div>');
  // ===== Bảng chi tiết kiểu XÂY THÔ (STT/NỘI DUNG/ĐVT/DIỆN TÍCH/HỆ SỐ/KHỐI LƯỢNG/ĐƠN GIÁ/THÀNH TIỀN/GHI CHÚ) =====
  var lines=(S.bgDeMuc && S.bgDeMuc!=='__all__') ? S.lines.filter(function(l){return l.nhom===S.bgDeMuc||String(l.nhom||'').indexOf(S.bgDeMuc+'.')===0;}) : S.lines.slice();
  var groups={},order=[]; lines.forEach(function(l){ var g=(l.tang||'').trim()||'HẠNG MỤC'; if(!groups[g]){groups[g]=[];order.push(g);} groups[g].push(l); });
  var xcolg='<colgroup><col style="width:32px"><col><col style="width:38px"><col style="width:52px"><col style="width:42px"><col style="width:66px"><col style="width:84px"><col style="width:96px"><col style="width:86px"></colgroup>';
  var xthead='<tr class="qx-h"><th class="ct">STT</th><th>NỘI DUNG CÔNG VIỆC</th><th class="ct">ĐVT</th><th class="num">DIỆN TÍCH</th><th class="ct">HỆ SỐ</th><th class="num">KHỐI LƯỢNG</th><th class="num">ĐƠN GIÁ</th><th class="num">THÀNH TIỀN</th><th>GHI CHÚ</th></tr>';
  var flat=[];
  order.forEach(function(g,gi){
    var items=groups[g]||[], sec=items.reduce(function(s,l){return s+(Number(l.thanhTienBan)||0);},0);
    flat.push('<tr class="sec"><td class="ct">'+(ROMAN_[gi]||(gi+1))+'</td><td colspan="6">'+esc(g)+'</td><td class="num">'+(sec?money(sec):'-')+'</td><td></td></tr>');
    items.forEach(function(l,ri){
      flat.push('<tr><td class="ct">'+(ri+1)+'</td>'
        +'<td><b>'+esc(l.ten||'')+'</b>'+(l.thuongHieu?' — '+esc(l.thuongHieu):'')+(l.moTa?'<div class="qx-desc">'+esc(l.moTa)+'</div>':'')+'</td>'
        +'<td class="ct it">'+esc(l.dvt||'')+'</td>'
        +'<td class="num">'+(l.dienTich!=null&&l.dienTich!==''?esc(l.dienTich):'')+'</td>'
        +'<td class="ct">'+(l.heSo!=null&&l.heSo!==''?esc(l.heSo):'')+'</td>'
        +'<td class="num">'+(Number(l.soLuong)||0)+'</td>'
        +'<td class="num">'+(l.donGiaBan?money(l.donGiaBan):'')+'</td>'
        +'<td class="num">'+(l.thanhTienBan?money(l.thanhTienBan):'-')+'</td>'
        +'<td class="it">'+esc(l.ghiChu||'')+'</td></tr>');
    });
  });
  var PER=22;
  if(flat.length){ for(var i=0;i<flat.length;i+=PER){
    inners.push((i===0?'<div class="qx-secttl">BẢNG BÁO GIÁ CHI TIẾT</div>':'')+'<table class="qx-tbl">'+xcolg+xthead+flat.slice(i,i+PER).join('')+'</table>');
  } }
  // ===== Hộp tổng + ghi chú + ô ký (đính cuối trang cuối) =====
  var q=computeQuoteLocal();
  var totbox='<table class="qx-tbl qx-totbox">'+xcolg
    +'<tr><td colspan="7" class="lbl">TỔNG CỘNG:</td><td class="num">'+money(q.subtotal)+'</td><td></td></tr>'
    +'<tr><td colspan="7" class="lbl">VAT '+q.vatPct+'%</td><td class="num">'+money(q.vat)+'</td><td></td></tr>'
    +'<tr><td colspan="7" class="lbl">THÀNH TIỀN SAU THUẾ:</td><td class="num">'+money(q.total)+'</td><td></td></tr></table>';
  var notes='<div class="qx-notes"><div class="h">Ghi chú:</div><ol>'
    +'<li>Khối lượng trên là tạm tính, khối lượng quyết toán theo diện tích xây dựng thực tế.</li>'
    +'<li>Giá trên chưa bao gồm nhân công hoàn thiện.</li>'
    +'<li>Giá trên đã bao gồm thuế VAT.</li></ol></div>';
  var sign='<div class="qx-sign"><div class="col"><div class="hd">KHÁCH HÀNG / CUSTOMER</div><div class="sp"></div></div>'
    +'<div class="col"><div class="hd">ĐƠN VỊ THI CÔNG / CONSTRUCTION UNIT</div><div class="sp"></div></div></div>';
  inners[inners.length-1]+=totbox+notes+sign;
  // Bọc từng trang A4 + footer số trang
  var N=inners.length;
  return inners.map(function(inner,idx){
    var foot='<div class="qp-foot"><span>'+esc(QUOTE_ORG.brand)+' — '+esc(p.ten||'')+'</span><span>Trang '+(idx+1)+' / '+N+'</span></div>';
    return {html:'<div class="qs-page qx-page">'+inner+foot+'</div>'};
  });
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
+'.qs-page{width:794px;min-height:1123px;background:#fff;border:1px solid #e6e9ee;border-radius:10px;box-shadow:0 8px 30px rgba(20,40,80,.10);padding:54px 60px 48px;box-sizing:border-box;position:relative;font-family:Arial,Helvetica,sans-serif;color:#1f2937}'
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
+'.qx-page{padding:38px 42px 46px}'
+'.qx-head{display:flex;justify-content:space-between;align-items:flex-start;gap:20px;margin-bottom:4px}'
+'.qx-brand{font-size:30px;font-weight:900;letter-spacing:2px;color:#12233a}'
+'.qx-org{font-size:10px;color:#4b5563;line-height:1.55;margin-top:5px}'
+'.qx-titlebox{background:#12314f;color:#fff;text-align:center;padding:14px 24px;min-width:290px}'
+'.qx-titlebox .t1{font-size:15px;font-weight:800;letter-spacing:.4px}'
+'.qx-titlebox .t2{font-size:12.5px;font-weight:700;margin-top:4px}'
+'.qx-info{width:100%;border-collapse:collapse;background:#eceff2;margin:16px 0 0;table-layout:fixed}'
+'.qx-info td{padding:9px 14px;font-size:11px;vertical-align:top}'
+'.qx-info td.k{font-weight:700;color:#1f2937;width:16%}'
+'.qx-info td.v{color:#374151;width:34%}'
+'.qx-secttl{font-size:13px;font-weight:800;color:#12233a;letter-spacing:.4px;margin:18px 0 8px}'
+'.qx-tbl{width:100%;border-collapse:collapse;font-size:10.5px}'
+'.qx-tbl th{background:#12314f;color:#fff;font-weight:700;padding:10px 8px;text-align:left;font-size:10px;vertical-align:middle;border-right:1px solid #ffffff22;text-transform:uppercase;line-height:1.2}'
+'.qx-tbl th.num{text-align:right}.qx-tbl th.ct{text-align:center}'
+'.qx-tbl th:last-child{border-right:none}'
+'.qx-tbl td{padding:9px 8px;border-right:1px solid #d9dee5;border-bottom:none;vertical-align:top}'
+'.qx-tbl td:last-child{border-right:none}'
+'.qx-tbl td.num{text-align:right;font-variant-numeric:tabular-nums}'
+'.qx-tbl td.ct{text-align:center}'
+'.qx-tbl td.it{font-style:italic;color:#4b5563}'
+'.qx-tbl tr.sec td{background:#e6e9ee;font-weight:800;color:#12233a;border-top:1px solid #cfd5dd;border-bottom:1px solid #cfd5dd}'
+'.qx-desc{color:#6b7280;font-size:9.5px;line-height:1.35;margin-top:2px}'
+'.qx-totbox{margin-top:0}'
+'.qx-totbox td{background:#12314f;color:#fff;padding:10px 12px;font-size:12px;font-weight:800;border-right:none;border-bottom:1px solid #ffffff1a}'
+'.qx-totbox td.lbl{text-align:right;letter-spacing:.3px}'
+'.qx-notes{background:#eceff2;padding:12px 16px;margin-top:16px;font-size:10.5px;color:#374151}'
+'.qx-notes .h{font-weight:700;margin-bottom:4px}'
+'.qx-notes ol{margin:0;padding-left:20px}.qx-notes li{margin:3px 0}'
+'.qx-sign{display:flex;margin-top:16px;border:1px solid #d9dee5}'
+'.qx-sign .col{flex:1}.qx-sign .col:first-child{border-right:1px solid #d9dee5}'
+'.qx-sign .hd{background:#eceff2;font-weight:700;font-size:11px;padding:9px;color:#1f2937;text-align:center}'
+'.qx-sign .sp{height:110px}';
function ensureDocCss_(){ if(document.getElementById('qsDocCss')) return; var s=document.createElement('style'); s.id='qsDocCss'; s.textContent=QS_DOC_CSS; document.head.appendChild(s); }
function printDoc(){
  if(!S.cur){ toast('Chưa chọn dự án'); return; }
  var pages=bgBuildPages(); var p=S.cur||{};
  var html=pages.map(function(pg){return pg.html;}).join('');
  var pcss=QS_DOC_CSS
    +'@page{size:A4;margin:0}'
    +'body{margin:0;background:#fff}'
    +'.qs-doc{margin:0;display:block}'
    +'.qs-page{border:none;border-radius:0;box-shadow:none;margin:0 auto;page-break-after:always;width:210mm;min-height:296mm;padding:16mm 15mm 18mm}'
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
  var lines=(S.bgDeMuc && S.bgDeMuc!=='__all__') ? S.lines.filter(function(l){return l.nhom===S.bgDeMuc||String(l.nhom||'').indexOf(S.bgDeMuc+'.')===0;}) : S.lines.slice();
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
      +'<div class="cvbar" style="margin:2px 0 6px"><span class="hint">Tài liệu A4 nhiều trang — trang 1 tóm tắt hạng mục, các trang sau chi tiết. Nội dung lấy từ “Chỉnh sửa”.</span><span style="flex:1"></span>'
      +'<button class="btn green sm" onclick="doExport(\'xlsx\',this)">'+icon('download',15)+' Xuất Excel</button>'
      +'<button class="btn red sm" onclick="printDoc()">'+icon('download',15)+' Xuất PDF / In</button></div>'
      +bgDocHTML();
    return;
  }
  var comp=coverCosts(), p=S.cur||{}, q=computeQuoteLocal();
  var secs=(S.cover||[]).filter(function(c){return coverDepth(c.stt)===1;}).sort(coverSortFn);
  var chips=secs.map(function(s){ return '<span class="bgchip'+(S.bgHide[s.stt]?' off':'')+'" onclick="bgToggle(\''+s.stt+'\')">'+esc(s.hangMuc||s.stt)+'</span>'; }).join('')||'<span class="hint" style="color:#889">Chưa có mục. Bấm ↻ Nạp lại mẫu.</span>';
  var covTable=S.coverMau==='m1'?coverTableM1(comp):coverTableM2(comp);
  var deSeen={}, deOpts=[{c:'__all__',n:'Tất cả'}];
  S.lines.forEach(function(l){ if(l.nhom && !deSeen[l.nhom]){ deSeen[l.nhom]=1; deOpts.push({c:l.nhom,n:nodeName(l.nhom)}); } });
  function cnt(code){ return code==='__all__'?S.lines.length:S.lines.filter(function(l){return l.nhom===code||String(l.nhom||'').indexOf(code+'.')===0;}).length; }
  var deSel='<select class="select" onchange="setDeMuc(this.value)">'+deOpts.map(function(o){return '<option value="'+esc(o.c)+'"'+(S.bgDeMuc===o.c?' selected':'')+'>'+esc(o.n)+' ['+cnt(o.c)+']</option>';}).join('')+'</select>';
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
    +'<span class="lbl" style="margin:0;font-size:12px">Đề mục</span>'+deSel
    +'<button class="btn green sm" onclick="doExport(\'xlsx\',this)">'+icon('download',14)+' Excel</button>'
    +'<button class="btn red sm" onclick="printDoc()">'+icon('download',14)+' PDF / In</button></div>'
    +'<div class="dbcard-b"><div class="colchips">'+colChips+'</div>'+bgDetailHTML()
    +'<div class="totbar"><div class="b"><div class="tt">TẠM TÍNH</div><div class="tv">'+money(q.subtotal)+' đ</div></div>'
      +'<div class="b"><div class="tt">VAT '+q.vatPct+'%</div><div class="tv">'+money(q.vat)+' đ</div></div>'
      +'<div class="b grand"><div class="tt">TỔNG CỘNG</div><div class="tv">'+money(q.total)+' đ</div></div></div></div></div>';
  box.innerHTML=sechd+card1+card2+bgAreaHTML()+card4;
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

/* ===================== AUTH & ADMIN ===================== */
async function authStart_(){
  var t=authToken();
  if(!t){ showLogin_(); return; }
  try{ var u=await api('me'); S.me=u; onAuthed_(); }
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
  try{ var r=await api('login',user,pw); setAuthToken(r.token); S.me=r.user;
    document.getElementById('loginPw').value=''; onAuthed_(); }
  catch(e){ err(e.message||'Đăng nhập thất bại'); }
  btn.disabled=false; btn.textContent='Đăng nhập';
}
function loginTogglePw(){ var i=document.getElementById('loginPw'), e=document.querySelector('.login-eye'); if(!i)return; var show=i.type==='password'; i.type=show?'text':'password'; if(e) e.classList.toggle('on',show); i.focus(); }
function onAuthed_(){ var ls=document.getElementById('loginScreen'); if(ls) ls.style.display='none'; applyRoleUI_(); boot();
  // Nếu tài khoản không có quyền vào tab đang mở -> chuyển tới tab đầu tiên hợp lệ
  var cur=document.querySelector('#nav a.active, .topnav .right a.active'); var t=cur?cur.getAttribute('data-tab'):'boc';
  if(!canTab(t)){ var f=firstAllowedTab_(); if(f) showTab(f); }
}
var PERM_TABS=[['dash','Bảng điều khiển'],['project','Thông tin dự án'],['boc','Bóc tách'],
  ['chiphi','Chi phí'],['export','Xuất báo giá'],['muahang','Mua hàng'],
  ['duan','Dự án'],['sanpham','Danh sách sản phẩm'],['import','Nhập dữ liệu']];
function canTab(tab){ var me=S.me||{}; if(me.role==='admin') return true; if(tab==='admin') return false;
  return (me.perms||[]).indexOf(tab)>=0; }
function firstAllowedTab_(){ var me=S.me||{}; if(me.role==='admin') return 'boc';
  for(var i=0;i<PERM_TABS.length;i++){ if(canTab(PERM_TABS[i][0])) return PERM_TABS[i][0]; } return null; }
function applyRoleUI_(){
  var me=S.me||{}, nm=me.hoTen||me.username||'';
  var chip=document.getElementById('userChip'); if(chip) chip.style.display='';
  var byId=function(id){return document.getElementById(id);};
  if(byId('ucName')) byId('ucName').textContent=me.username||'';
  if(byId('ucAv')) byId('ucAv').textContent=(nm||'?').trim().charAt(0).toUpperCase();
  if(byId('ucFull')) byId('ucFull').textContent=nm;
  if(byId('ucRole')) byId('ucRole').textContent = me.role==='admin'?'Quản trị viên':'Nhân viên';
  var na=byId('navAdmin'); if(na) na.style.display = me.role==='admin'?'':'none';
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
      var cls=n.kind==='delete_approved'?'ok':(n.kind==='delete_rejected'?'no':'req');
      var em=n.kind==='delete_approved'?'✓':(n.kind==='delete_rejected'?'✕':'🗑');
      return '<div class="nb-item'+(n.read?'':' unread')+'" onclick="notifClick('+n.id+',\''+n.kind+'\')"><div class="nb-ic '+cls+'">'+em+'</div>'
        +'<div class="nb-tx"><b>'+esc(n.title||'')+'</b><span>'+esc(n.body||'')+'</span><i>'+fmtDateTime_(n.at)+'</i></div></div>';
    }).join('');
  }catch(e){ list.innerHTML='<div class="nb-empty">Lỗi: '+esc(e.message)+'</div>'; }
}
function notifClick(id,kind){ api('notifRead',id).then(refreshNotifCount_).catch(function(){});
  var isAdmin=S.me&&S.me.role==='admin';
  if(isAdmin && (kind==='delete_request'||kind==='purchase_request')){ var m=document.getElementById('nbMenu'); if(m)m.style.display='none'; showTab('admin');
    var target = kind==='purchase_request'?'purCard':'drqCard';
    setTimeout(function(){ var el=document.getElementById(target); if(el) el.scrollIntoView({block:'center'}); },350); }
  else renderNotif_();
}
function notifMarkAll(e){ if(e)e.stopPropagation(); api('notifReadAll').then(function(){ refreshNotifCount_(); renderNotif_(); }).catch(function(){}); }
async function refreshNotifCount_(){ if(!S.me) return; try{ var c=await api('notifCount'); var b=document.getElementById('nbBadge'); if(!b)return;
  if(c && c.unread>0){ b.textContent=c.unread>99?'99+':c.unread; b.style.display=''; } else b.style.display='none'; }catch(e){} }
function startNotifPoll_(){ refreshNotifCount_(); if(S._notifTimer) clearInterval(S._notifTimer); S._notifTimer=setInterval(refreshNotifCount_,30000); }
function toggleUserMenu(e){ e.stopPropagation(); var m=document.getElementById('ucMenu'); if(!m)return; var open=m.style.display!=='none'; m.style.display=open?'none':'block'; if(!open) setTimeout(function(){ document.addEventListener('mousedown',ucOut_); },0); }
function ucOut_(e){ if(!e.target.closest('#userChip')){ var m=document.getElementById('ucMenu'); if(m)m.style.display='none'; document.removeEventListener('mousedown',ucOut_); } }
function openChangePw(){ var m=document.getElementById('ucMenu'); if(m)m.style.display='none';
  var oldp=prompt('Mật khẩu hiện tại:'); if(oldp===null) return;
  var np=prompt('Mật khẩu mới (≥4 ký tự):'); if(np===null) return;
  api('changePassword',oldp,np).then(function(){ toast('Đã đổi mật khẩu'); }).catch(function(e){ toast('Lỗi: '+e.message); });
}
function fmtDateTime_(s){ if(!s)return'—'; try{ return new Date(s).toLocaleString('vi-VN'); }catch(e){ return String(s); } }
function admActionLabel_(a){ var m={login:'Đăng nhập',logout:'Đăng xuất',login_fail:'ĐN lỗi',create_user:'Tạo TK',update_user:'Sửa TK',delete_user:'Xóa TK',reset_password:'Đặt lại MK',change_password:'Đổi MK',lock_user:'Khóa TK',unlock_user:'Mở khóa'}; return m[a]||a; }
async function renderAdmin(){
  var box=document.getElementById('v-admin'); if(!box) return;
  if(!S.me||S.me.role!=='admin'){ box.innerHTML='<div class="sechd"><h2>Quản trị</h2></div><div class="empty">Bạn không có quyền truy cập.</div>'; return; }
  box.innerHTML='<div class="sechd"><h2>Quản trị — Tài khoản & phân quyền</h2></div><div id="admBody"><div class="empty">Đang tải…</div></div>';
  try{
    var users=await api('adminListUsers'); var reqs=await api('listDeleteRequests'); var purs=await api('listPurchaseRequests'); var logs=await api('getAuditLog',120); S._admUsers=users;
    document.getElementById('admBody').innerHTML=admStats_(users,reqs,purs)+admUsersCard_(users)+admReqCard_(reqs)+admPurCard_(purs)+admLogCard_(logs);
  }catch(e){ document.getElementById('admBody').innerHTML='<div class="empty">Lỗi tải: '+esc(e.message)+'</div>'; }
}
function admStats_(users,reqs,purs){
  var pendDel=(reqs||[]).filter(function(r){return r.status==='pending';}).length;
  var pendPur=(purs||[]).filter(function(r){return r.status==='Chờ duyệt';}).length;
  function tile(ic,val,label,warn){ return '<div class="astat'+(warn&&val?' warn':'')+'"><span class="astat-ic">'+ic+'</span><div><div class="astat-v">'+val+'</div><div class="astat-l">'+label+'</div></div></div>'; }
  return '<div class="astats">'
    +tile(icon('lock',18),(users||[]).length,'Tài khoản',false)
    +tile(icon('trash',18),pendDel,'Yêu cầu xóa chờ duyệt',true)
    +tile(icon('cart',18),pendPur,'Đơn mua hàng chờ duyệt',true)+'</div>';
}
function rqItem_(opts){
  // opts: {cls, icon, title, meta, badgeCls, badgeText, actions, time}
  return '<div class="rq-item '+opts.cls+'"><span class="rq-ic '+opts.cls+'">'+opts.icon+'</span>'
    +'<div class="rq-main"><div class="rq-title">'+opts.title+'</div>'+(opts.meta?'<div class="rq-meta">'+opts.meta+'</div>':'')+'</div>'
    +'<div class="rq-side"><span class="drq-badge '+opts.badgeCls+'">'+opts.badgeText+'</span>'
      +(opts.actions?'<div class="rq-act">'+opts.actions+'</div>':'')
      +'<span class="rq-time">'+opts.time+'</span></div></div>';
}
function admUsersCard_(users){
  var lbl={}; PERM_TABS.forEach(function(t){ lbl[t[0]]=t[1]; });
  function permCell(u){ if(u.role==='admin') return '<span class="muted">Toàn quyền</span>';
    var p=u.perms||[]; if(!p.length) return '<span class="st-lk">Chưa cấp</span>';
    return p.map(function(k){ return '<span class="permchip">'+esc(lbl[k]||k)+'</span>'; }).join(' '); }
  var rows=users.map(function(u){
    var av=(u.hoTen||u.username||'?').trim().charAt(0).toUpperCase();
    return '<tr class="'+(u.active?'':'locked')+'">'
      +'<td><span class="uav '+(u.role==='admin'?'adm':'')+'">'+esc(av)+'</span><b>'+esc(u.username)+'</b></td><td>'+esc(u.hoTen||'')+'</td>'
      +'<td><span class="rolebadge '+(u.role==='admin'?'adm':'stf')+'">'+(u.role==='admin'?'Admin':'Nhân viên')+'</span></td>'
      +'<td class="permcol">'+permCell(u)+'</td>'
      +'<td>'+(u.active?'<span class="st-ok">● Hoạt động</span>':'<span class="st-lk">● Đã khóa</span>')+'</td>'
      +'<td class="muted">'+(u.lastLogin?fmtDateTime_(u.lastLogin):'—')+'</td>'
      +'<td class="admact"><button class="btn ghost xs" onclick="admEdit(\''+u.id+'\')">Sửa</button>'
        +'<button class="btn ghost xs" onclick="admResetPw(\''+u.id+'\')">Đặt MK</button>'
        +'<button class="btn ghost xs" onclick="admToggleActive(\''+u.id+'\','+(u.active?'false':'true')+')">'+(u.active?'Khóa':'Mở')+'</button>'
        +'<button class="btn ghost xs danger" onclick="admDelete(\''+u.id+'\')">Xóa</button></td></tr>';
  }).join('');
  var inner='<div style="margin-bottom:12px"><button class="btn blue sm" onclick="admCreate()">'+icon('plus',14)+' Thêm tài khoản</button></div>'
    +'<div class="tbl-wrap"><table class="admtbl"><tr><th>Tên đăng nhập</th><th>Họ tên</th><th>Vai trò</th><th>Quyền truy cập</th><th>Trạng thái</th><th>Đăng nhập gần nhất</th><th></th></tr>'+rows+'</table></div>';
  return dbCard_('Tài khoản ('+users.length+')','lock','Admin toàn quyền · Nhân viên không mở được trang này.',inner);
}
function admPurCard_(purs){
  purs=purs||[]; var pending=purs.filter(function(r){return r.status==='Chờ duyệt';});
  var lbl={'Đã duyệt':'approved','Từ chối':'rejected','Chờ duyệt':'pending','Đã gửi':'pending'};
  var body= purs.length? purs.map(function(r){
    var scls=lbl[r.status]||'pending';
    return rqItem_({ cls:scls, icon:icon('cart',16),
      title:'<b>'+esc(r.maDon)+'</b> · '+esc(r.supplier||'—')+' · <span class="rq-amt">'+money(r.total)+'đ</span>',
      meta:'Người gửi <b>'+esc(r.requester||'—')+'</b>'+(r.phongBan?(' · '+esc(r.phongBan)):'')+' · Dự án '+esc(r.project||'—')+' · '+(r.soSp||0)+' SP',
      badgeCls:scls, badgeText:esc(r.status||''),
      actions: scls==='pending'?'<button class="btn blue xs" onclick="purResolve(\''+esc(r.maDon)+'\',true)">Duyệt</button><button class="btn ghost xs danger" onclick="purResolve(\''+esc(r.maDon)+'\',false)">Từ chối</button>':'',
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
    return rqItem_({ cls:r.status, icon:icon('trash',16),
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
  var permHtml=PERM_TABS.map(function(t){ return '<label class="admck"><input type="checkbox" value="'+t[0]+'"'+(perms.indexOf(t[0])>=0?' checked':'')+'>'+esc(t[1])+'</label>'; }).join('');
  var m=document.createElement('div'); m.className='amodal-ov'; m.id='admModal'; m.onclick=function(e){ if(e.target===m) admModalClose(); };
  m.innerHTML='<div class="amodal">'
    +'<div class="amodal-hd">'+(isEdit?'Sửa tài khoản':'Thêm tài khoản')+'<span class="amodal-x" onclick="admModalClose()">✕</span></div>'
    +'<div class="amodal-bd">'
      +'<div class="afield"><label>Tên đăng nhập</label><input id="am_user" '+(isEdit?'disabled':'')+' value="'+esc(user.username||'')+'" placeholder="vd: nguyenvana" autocomplete="off"></div>'
      +'<div class="afield"><label>Họ tên</label><input id="am_ht" value="'+esc(user.hoTen||'')+'" placeholder="Nguyễn Văn A"></div>'
      +(isEdit?'':'<div class="afield"><label>Mật khẩu</label><input id="am_pw" type="text" placeholder="≥4 ký tự" autocomplete="new-password"></div>')
      +'<div class="afield"><label>Vai trò</label><select id="am_role" onchange="admModalRole()"><option value="staff"'+(user.role!=='admin'?' selected':'')+'>Nhân viên</option><option value="admin"'+(user.role==='admin'?' selected':'')+'>Admin (toàn quyền)</option></select></div>'
      +'<div class="afield" id="am_permwrap"><label>Quyền truy cập</label><div class="admperms">'+permHtml+'</div>'
        +'<div class="admperm-quick"><a onclick="admPermAll(1)">Chọn tất cả</a> · <a onclick="admPermAll(0)">Bỏ hết</a></div></div>'
    +'</div>'
    +'<div class="amodal-ft"><button class="btn ghost" onclick="admModalClose()">Hủy</button><button class="btn blue" id="am_save" onclick="admModalSave('+(isEdit?'\''+user.id+'\'':'null')+')">'+(isEdit?'Lưu':'Tạo tài khoản')+'</button></div>'
    +'</div>';
  document.body.appendChild(m); admModalRole();
}
function admModalRole(){ var r=document.getElementById('am_role'); var pw=document.getElementById('am_permwrap'); if(r&&pw) pw.style.display = r.value==='admin'?'none':''; }
function admPermAll(on){ document.querySelectorAll('#am_permwrap input[type=checkbox]').forEach(function(c){ c.checked=!!on; }); }
function admModalClose(){ var m=document.getElementById('admModal'); if(m)m.remove(); }
function admModalSave(id){
  var role=document.getElementById('am_role').value;
  var perms = role==='admin'?[]:[].slice.call(document.querySelectorAll('#am_permwrap input:checked')).map(function(c){return c.value;});
  var hoTen=document.getElementById('am_ht').value;
  var btn=document.getElementById('am_save'); btn.disabled=true;
  var done=function(msg){ toast(msg); admModalClose(); renderAdmin(); };
  var fail=function(e){ toast('Lỗi: '+e.message); btn.disabled=false; };
  if(id){ api('adminUpdateUser',id,{hoTen:hoTen,role:role,perms:perms}).then(function(){ done('Đã cập nhật'); }).catch(fail); }
  else { var username=document.getElementById('am_user').value; var pw=document.getElementById('am_pw').value;
    api('adminCreateUser',{username:username,hoTen:hoTen,role:role,password:pw,perms:perms}).then(function(){ done('Đã tạo tài khoản'); }).catch(fail); }
}
function admResetPw(id){ var np=prompt('Mật khẩu mới (≥4 ký tự):'); if(!np) return; api('adminSetPassword',id,np).then(function(){ toast('Đã đặt lại mật khẩu'); }).catch(function(e){ toast('Lỗi: '+e.message); }); }
function admToggleActive(id,active){ api('adminSetActive',id,active).then(function(){ toast(active?'Đã mở khóa':'Đã khóa'); renderAdmin(); }).catch(function(e){ toast('Lỗi: '+e.message); }); }
function admDelete(id){ var u=(S._admUsers||[]).filter(function(x){return x.id===id;})[0]; if(!confirm('Xóa tài khoản "'+(u?u.username:'')+'"? Không thể hoàn tác.')) return; api('adminDeleteUser',id).then(function(){ toast('Đã xóa'); renderAdmin(); }).catch(function(e){ toast('Lỗi: '+e.message); }); }

/* ===== GO ===== */
initCols();
initTableInteractions();
authStart_();
