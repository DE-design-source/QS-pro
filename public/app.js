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
function toast(m){ var t=document.getElementById('toast'); t.textContent=m; t.classList.add('on'); clearTimeout(t._t); t._t=setTimeout(function(){t.classList.remove('on');},2200); }

/* ===== STATE ===== */
var S={ projects:[], products:[], cur:null, lines:[], node:'3.2.6.1', selFloor:'', _dragProd:null,
  fWatt:{}, fKelvin:{}, fAngle:{}, fBrand:'', fNhom:'', cols:{}, _drag:null,
  rowH:(function(){ try{ return JSON.parse(localStorage.getItem('qs_rowh')||'{}')||{}; }catch(e){ return {}; } })() };

/* cây hạng mục (mã, tên, cấp) */
var TREE=[
  ['1','TƯ VẤN DỰ ÁN',1],['1.1','TƯ VẤN QUẢN LÝ DỰ ÁN',2],
  ['2','TƯ VẤN THIẾT KẾ',1],['2.1','TƯ VẤN THIẾT KẾ KIẾN TRÚC',2],['2.2','TƯ VẤN THIẾT KẾ NỘI THẤT',2],
  ['2.3','TƯ VẤN THIẾT KẾ KẾT CẤU',2],['2.4','TƯ VẤN THIẾT KẾ MEP',2],
  ['3','XÂY DỰNG',1],['3.1','PHẦN THÔ',2],['3.2','PHẦN HOÀN THIỆN CƠ BẢN',2],
  ['3.2.1','THẠCH CAO',3],['3.2.2','SƠN NƯỚC',3],['3.2.3','XÂY TÔ',3],['3.2.4','ỐP LÁT',3],
  ['3.2.5','THIẾT BỊ VỆ SINH',3],['3.2.6','THIẾT BỊ ĐIỆN',3],['3.2.6.1','THIẾT BỊ ĐÈN',4],
  ['3.2.6.2','CÔNG TẮC - Ổ CẮM',4],['3.2.7','ĐIỆN LẠNH',3],['3.2.8','CỬA',3],
  ['3.2.8.1','CỬA NGOẠI THẤT',4],['3.2.8.2','CỬA NỘI THẤT',4],
  ['4','HOÀN THIỆN NỘI THẤT',1],['4.1','NỘI THẤT LIỀN TƯỜNG',2],['4.2','NỘI THẤT RỜI',2],
  ['4.3','RÈM CỬA',2],['4.4','ĐỒ TRANG TRÍ',2],['5','BẢO DƯỠNG',1],['X','THÊM HẠNG MỤC',1]
];
function nodeName(code){ for(var i=0;i<TREE.length;i++) if(TREE[i][0]===code) return TREE[i][1]; return code; }

/* cột bảng bóc: key,label,default */
var COLS=[
  ['stt','STT',1],['khuVuc','PHÒNG',1],['maBanVe','MÃ SỐ BẢN VẼ',0],['nganh','NGÀNH HÀNG',0],
  ['maSP','MÃ SẢN PHẨM',0],['ten','TÊN SẢN PHẨM',1],['thuongHieu','THƯƠNG HIỆU',1],['ncc','NHÀ CUNG CẤP',0],
  ['moTa','MÔ TẢ',1],['kichThuoc','KÍCH THƯỚC',1],['hinhAnh','HÌNH ẢNH',1],['dvt','ĐVT',1],
  ['soLuong','SỐ LƯỢNG',1],['giaNCC','GIÁ BÁN LẺ NCC',0],['chietKhau','CHIẾT KHẤU ĐẠI LÝ',0],
  ['giaDaiLy','GIÁ ĐẠI LÝ',0],['lnPct','LỢI NHUẬN',0],['donGia','ĐƠN GIÁ',1],['thanhTien','THÀNH TIỀN',0],
  ['trangThai','TRẠNG THÁI',0],['ghiChu','GHI CHÚ',0]
];
COLS.forEach(function(c){ S.cols[c[0]]=!!c[2]; });
// Độ rộng mặc định + cấu hình cột (thứ tự, rộng, lọc) lưu localStorage
var DEFW={stt:66,khuVuc:120,maBanVe:92,nganh:110,maSP:110,ten:190,thuongHieu:110,ncc:120,moTa:240,kichThuoc:120,hinhAnh:72,dvt:64,soLuong:72,giaNCC:104,chietKhau:96,giaDaiLy:104,lnPct:72,donGia:104,thanhTien:112,trangThai:104,ghiChu:150};
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
function selectFloor(g){ S.selFloor = (g==='CHƯA PHÂN TẦNG'?'':g); renderFloors(); renderTable(); }
async function addFloor(){
  if(!S.cur){ toast('Chưa chọn dự án'); return; }
  var name=prompt('Tên tầng mới (vd: TẦNG HẦM, TẦNG TRỆT, TẦNG 2):'); if(name==null) return;
  name=name.trim(); if(!name) return;
  var cur=(S.cur.tangTuTao?String(S.cur.tangTuTao).split('|'):[]).map(function(s){return s.trim();}).filter(Boolean);
  if(cur.indexOf(name)<0) cur.push(name);
  try{
    var p=await api('updateProject', S.cur.maDA, {tangTuTao:cur.join('|')}); S.cur=p;
    var i=S.projects.findIndex(function(x){return x.maDA===p.maDA;}); if(i>=0)S.projects[i]=p;
    S.selFloor=name; renderFloors(); renderTable(); toast('Đã thêm tầng: '+name);
  }catch(e){ toast('Lỗi: '+e.message); }
}
async function addBlankItem(){ await addItemToFloor(S.selFloor||''); }
async function addItemToFloor(tang){
  if(!S.cur){ toast('Chưa chọn dự án'); return; }
  if(tang==='CHƯA PHÂN TẦNG') tang='';
  try{
    var l=await api('addLine', S.cur.maDA, {ten:'Hạng mục mới', dvt:'Cái', donGiaVon:0, donGiaBan:0,
      nhom:S.node, hangMuc:nodeName(S.node), loai:nodeName(S.node), tang:tang}, 1);
    S.lines.push(l); renderTree(); renderFloors(); renderTable();
    toast('Đã thêm hạng mục'+(tang?' vào '+tang:''));
  }catch(e){ toast('Lỗi: '+e.message); }
}

/* ===== NAV / TABS ===== */
document.getElementById('nav').addEventListener('click',function(e){
  var a=e.target.closest('a[data-tab]'); if(!a) return; e.preventDefault(); showTab(a.getAttribute('data-tab'));
});
document.querySelector('.topnav .right').addEventListener('click',function(e){
  var a=e.target.closest('a[data-tab]'); if(a){ e.preventDefault(); showTab('import'); }
});
function showTab(tab){
  document.querySelectorAll('#nav a').forEach(function(a){ a.classList.toggle('active',a.getAttribute('data-tab')===tab); });
  ['boc','project','dash','chiphi','export','import'].forEach(function(v){
    document.getElementById('v-'+v).classList.toggle('on',v===tab);
  });
  if(tab==='project') renderProjects();
  if(tab==='dash') renderDash();
  if(tab==='chiphi') renderChiphi();
  if(tab==='export') renderExport();
  if(tab==='import') renderImport();
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
  document.getElementById('cbStatus').textContent=(p.trangThai||'BẢN NHÁP').toUpperCase();
  document.getElementById('pcCode').textContent=p.maDA||'—';
  document.getElementById('pcName').textContent=(p.ten||'CHƯA CHỌN DỰ ÁN').toUpperCase();
  document.getElementById('pcKH').textContent=p.khachHang||'—';
  document.getElementById('pcSDT').textContent=p.sdt||'—';
  document.getElementById('pcAddr').textContent=p.diaChi||'—';
  document.getElementById('pcDate').textContent=p.ngayTao||'—';
  document.getElementById('pcStatus').textContent=p.trangThai||'Bản nháp';
  var pct=Math.max(0,Math.min(100,Number(p.tienDo)||0));
  document.getElementById('pcPct').textContent=pct+'%';
  document.getElementById('pcBar').style.width=pct+'%';
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
    await boot(); toast('Đã tạo dự án');
  }catch(e){ toast('Lỗi: '+e.message); }
}

/* ===== FILTERS (trái) ===== */
function parseWatt(nm){ var m=/(\d+(?:\.\d+)?)\s*w\b/i.exec(nm||''); return m?m[1]+'W':''; }
function parseKelvin(nm){ var m=/(\d{4})\s*k\b/i.exec(nm||''); return m?m[1]+'K':''; }
function renderFilters(){
  // nhóm (ngành hàng)
  var nhoms={}; S.products.forEach(function(p){ if(p.nhom) nhoms[p.nhom]=1; });
  var fn=document.getElementById('fNhom');
  fn.innerHTML='<option value="">Tất cả hạng mục</option>'+Object.keys(nhoms).map(function(n){return '<option>'+esc(n)+'</option>';}).join('');
  fn.value=S.fNhom; fn.onchange=function(){ S.fNhom=fn.value; renderCatalog(); };
  // brand
  var br={}; S.products.forEach(function(p){ if(p.thuongHieu) br[p.thuongHieu]=1; });
  var fb=document.getElementById('fBrand');
  fb.innerHTML='<option value="">Tất cả thương hiệu</option>'+Object.keys(br).sort().map(function(n){return '<option>'+esc(n)+'</option>';}).join('');
  fb.value=S.fBrand; fb.onchange=function(){ S.fBrand=fb.value; renderCatalog(); };
  // watt
  document.getElementById('fWatt').innerHTML=WATTS.map(function(w){return '<span class="chip wide'+(S.fWatt[w]?' on':'')+'" data-w="'+w+'">'+w+'</span>';}).join('');
  // kelvin
  document.getElementById('fKelvin').innerHTML=KELVINS.map(function(k){return '<span class="chip'+(S.fKelvin[k[0]]?' on':'')+'" data-k="'+k[0]+'"><span class="dot" style="background:'+k[1]+'"></span>'+k[0]+'</span>';}).join('');
  // angle
  document.getElementById('fAngle').innerHTML=ANGLES.map(function(a){return '<span class="chip'+(S.fAngle[a]?' on':'')+'" data-a="'+esc(a)+'">'+esc(a)+'</span>';}).join('');
  document.getElementById('fWatt').onclick=function(e){ var c=e.target.closest('[data-w]'); if(!c)return; var w=c.getAttribute('data-w'); S.fWatt[w]=!S.fWatt[w]; renderFilters(); renderCatalog(); };
  document.getElementById('fKelvin').onclick=function(e){ var c=e.target.closest('[data-k]'); if(!c)return; var k=c.getAttribute('data-k'); S.fKelvin[k]=!S.fKelvin[k]; renderFilters(); renderCatalog(); };
  document.getElementById('fAngle').onclick=function(e){ var c=e.target.closest('[data-a]'); if(!c)return; var a=c.getAttribute('data-a'); S.fAngle[a]=!S.fAngle[a]; renderFilters(); renderCatalog(); };
  document.getElementById('fMin').oninput=renderCatalog;
  document.getElementById('fMax').oninput=renderCatalog;
  document.getElementById('fSearch').oninput=renderCatalog;
}
function filteredProducts(){
  var q=(document.getElementById('fSearch').value||'').toLowerCase();
  var mn=Number(document.getElementById('fMin').value)||0, mx=Number(document.getElementById('fMax').value)||0;
  var watts=Object.keys(S.fWatt).filter(function(k){return S.fWatt[k];});
  var kels=Object.keys(S.fKelvin).filter(function(k){return S.fKelvin[k];});
  return S.products.filter(function(p){
    if(S.fNhom && p.nhom!==S.fNhom) return false;
    if(S.fBrand && p.thuongHieu!==S.fBrand) return false;
    if(q && (p.ten+' '+p.ma+' '+p.thuongHieu).toLowerCase().indexOf(q)<0) return false;
    var pr=Number(p.donGiaBan)||0; if(mn&&pr<mn) return false; if(mx&&pr>mx) return false;
    if(watts.length){ var w=parseWatt(p.ten); if(watts.indexOf(w)<0) return false; }
    if(kels.length){ var k=parseKelvin(p.ten); if(kels.indexOf(k)<0) return false; }
    return true;
  });
}
function renderCatalog(){
  var list=filteredProducts();
  var el=document.getElementById('catList');
  if(!list.length){ el.innerHTML='<div class="empty">Không có sản phẩm khớp lọc.</div>'; return; }
  el.innerHTML=list.slice(0,300).map(function(p,i){
    var img=p.hinhAnh?'<img class="thumb" src="'+esc(p.hinhAnh)+'" onerror="this.style.visibility=\'hidden\'">':'<div class="thumb"></div>';
    return '<div class="citem" draggable="true" ondragstart="prodDragStart(event,'+i+')" ondragend="prodDragEnd()">'
      +'<div class="no">'+(i+1)+'</div>'+img
      +'<div class="nm" onclick="showDetail('+i+')">'+esc(p.ten)+'</div>'
      +'<div class="sz">'+(p.kichThuoc?'Kích thước: '+esc(p.kichThuoc):esc(p.thuongHieu||''))+'</div>'
      +'<div class="pr">'+money(p.donGiaBan)+'</div>'
      +'<button class="add" title="Thêm vào bóc tách" onclick="addProduct('+i+')">+</button></div>';
  }).join('');
  S._filtered=list;
}
function showDetail(i){
  var p=(S._filtered||[])[i]; if(!p) return;
  var el=document.getElementById('pdPanel');
  document.getElementById('bocGrid').classList.add('detail');
  el.style.display='block';
  el.innerHTML='<div style="display:flex;justify-content:space-between;align-items:center"><h3>Thông tin sản phẩm</h3>'
    +'<button class="btn ghost sm" onclick="hideDetail()">✕</button></div>'
    +'<div class="imgbox">'+(p.hinhAnh?'<img src="'+esc(p.hinhAnh)+'">':'<span style="color:#9aa">Không có ảnh</span>')+'</div>'
    +'<div class="pcode">'+esc(p.ma||p.ten)+'</div>'
    +'<div class="spec"><span class="k">Tên sản phẩm</span><span class="v">'+esc(p.ten)+'</span></div>'
    +'<div class="spec"><span class="k">Thương hiệu</span><span class="v">'+esc(p.thuongHieu||'—')+'</span></div>'
    +'<div class="spec"><span class="k">Nhà cung cấp</span><span class="v">'+esc(p.ncc||'—')+'</span></div>'
    +'<div class="spec"><span class="k">Kích thước</span><span class="v">'+esc(p.kichThuoc||'—')+'</span></div>'
    +'<div class="spec"><span class="k">ĐVT</span><span class="v">'+esc(p.dvt||'Cái')+'</span></div>'
    +'<div class="spec"><span class="k">Đơn giá</span><span class="v">'+money(p.donGiaBan)+'</span></div>'
    +(p.moTa?'<div class="sechead">Mô tả</div><div style="color:#3a4753;font-size:13px">'+esc(p.moTa)+'</div>':'')
    +'<div class="sechead">Thông số kỹ thuật</div><div style="color:#9aa;font-size:12px">Lumens · CRI · IP · Driver… — sẽ hiện khi danh mục có các trường này.</div>'
    +'<button class="btn blue" style="width:100%;margin-top:14px" onclick="addProductObj('+JSON.stringify(i)+')">＋ Thêm vào bóc tách</button>';
}
function hideDetail(){ document.getElementById('pdPanel').style.display='none'; document.getElementById('bocGrid').classList.remove('detail'); }

/* ===== ADD to takeoff ===== */
async function addProduct(i){ var p=(S._filtered||[])[i]; if(p) await addProdObj(p); }
async function addProductObj(i){ var p=(S._filtered||[])[i]; if(p) await addProdObj(p); }
async function addProdObj(p,floor){
  if(!S.cur){ toast('Chưa chọn dự án — bấm Tạo dự án +'); return; }
  if(floor==null) floor=S.selFloor||'';
  if(floor==='CHƯA PHÂN TẦNG') floor='';
  // cộng dồn SL nếu đã có cùng SP trong cùng hạng mục + tầng
  var same=S.lines.filter(function(l){ return l.nhom===S.node && (l.tang||'')===floor && ((p.ma&&l.maSP&&l.maSP===p.ma)||l.ten===p.ten); })[0];
  if(same){ await editLine(same.lineId,{soLuong:(Number(same.soLuong)||0)+1}); toast('+1 số lượng: '+p.ten); return; }
  try{
    var prod=Object.assign({},p,{ nhom:S.node, hangMuc:nodeName(S.node), loai:nodeName(S.node),
      tang:floor, extra:{nganh:p.nhom||''} });
    var l=await api('addLine', S.cur.maDA, prod, 1);
    S.lines.push(l); renderTree(); renderFloors(); renderTable(); renderCard();
    toast('Đã thêm: '+p.ten);
  }catch(e){ toast('Lỗi thêm: '+e.message); }
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
function pickNode(code){ S.node=code; document.getElementById('treePop').style.display='none'; renderTree(); renderTable(); }
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
function toggleCol(k){ S.cols[k]=!S.cols[k]; renderColChips(); renderTable(); }

/* ===== TAKEOFF TABLE ===== */
function visCols(){ var byK={}; COLS.forEach(function(c){ byK[c[0]]=c; });
  return (S.colOrder||COLS.map(function(c){return c[0];})).map(function(k){ return byK[k]; }).filter(function(c){ return c && S.cols[c[0]]; }); }
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
    case 'hinhAnh': return l.hinhAnh?'<img class="pimg" src="'+esc(l.hinhAnh)+'" onerror="this.style.visibility=\'hidden\'">':'';
    case 'dvt': return esc(l.dvt||'');
    case 'giaNCC': return money(l.donGiaVon);
    case 'chietKhau': return (Number(l.chietKhau)||0)+'%';
    case 'giaDaiLy': return money((Number(l.donGiaVon)||0)*(1-(Number(l.chietKhau)||0)/100));
    case 'lnPct': return (Number(l.lnPct)||0)+'%';
    case 'thanhTien': return money(l.thanhTienBan);
    case 'trangThai': return esc(l.trangThai||'');
    case 'ghiChu': return esc(l.ghiChu||'');
  }
  return '';
}
// Ô sửa được (như bảng Excel cũ). Cột chỉ-đọc: stt, hình ảnh, ngành, giá đại lý, thành tiền.
var TXT_COL={ khuVuc:'khuVuc', maBanVe:'maBanVe', ncc:'ncc', maSP:'maSP', thuongHieu:'thuongHieu',
  dvt:'dvt', trangThai:'trangThai', ghiChu:'ghiChu', kichThuoc:'kichThuoc', ten:'ten' };
var NUM_COL={ soLuong:'soLuong', giaNCC:'donGiaVon', lnPct:'lnPct', chietKhau:'chietKhau', donGia:'donGiaBan' };
function cellInput(l,key){
  if(key==='moTa') return '<td class="wrap"><textarea class="cin" onchange="editLine(\''+l.lineId+'\',{moTa:this.value})">'+esc(l.moTa||'')+'</textarea></td>';
  if(key==='ten') return '<td class="td-ten"><div style="display:flex;gap:2px;align-items:center"><input class="cin" value="'+esc(l.ten||'')+'" onchange="editLine(\''+l.lineId+'\',{ten:this.value})"><button class="pick" title="Chọn sản phẩm từ danh mục" onclick="openPick(\''+l.lineId+'\',event)">⌕</button></div></td>';
  if(TXT_COL[key]){ var f=TXT_COL[key];
    return '<td><input class="cin"'+(key==='khuVuc'?' placeholder="Phòng…" list="phongList"':'')+' value="'+esc(l[f]||'')+'" onchange="editLine(\''+l.lineId+'\',{'+f+':this.value})"></td>'; }
  if(NUM_COL[key]){ var f2=NUM_COL[key];
    return '<td class="num"><input class="cin num" type="number" value="'+(Number(l[f2])||0)+'" onchange="editLine(\''+l.lineId+'\',{'+f2+':this.value})"></td>'; }
  var cls=(['giaDaiLy','thanhTien'].indexOf(key)>=0)?'num':(['hinhAnh','nganh'].indexOf(key)>=0?'ct':'');
  return '<td class="'+cls+'">'+cellVal(l,key)+'</td>';
}
function renderTable(){
  var code=S.node;
  var lines=S.lines.filter(function(l){ return l.nhom===code || String(l.nhom||'').indexOf(code+'.')===0; });
  document.getElementById('tkCount').textContent='['+pad2(lines.length)+']';
  var t=document.getElementById('tkTable');
  if(!S.cur){ t.style.width=''; t.innerHTML='<tr><td class="empty">Chưa chọn dự án.</td></tr>'; return; }
  var flt=S.colFilter||{};
  Object.keys(flt).forEach(function(k){ lines=lines.filter(function(l){ return colPlain(l,k)===flt[k]; }); });
  var cols=visCols();
  var numK=['soLuong','giaNCC','giaDaiLy','donGia','thanhTien'], ctK=['stt','hinhAnh','dvt','chietKhau','lnPct'];
  var groups={};
  lines.forEach(function(l){ var g=(l.tang||'').trim()||'CHƯA PHÂN TẦNG'; (groups[g]=groups[g]||[]).push(l); });
  var order=floorsList().slice();
  Object.keys(groups).forEach(function(g){ if(order.indexOf(g)<0) order.push(g); });
  var totalW=cols.reduce(function(s,c){ return s+colW(c[0]); },0)+44;
  var colg='<colgroup>'+cols.map(function(c){ return '<col style="width:'+colW(c[0])+'px">'; }).join('')+'<col style="width:44px"></colgroup>';
  var head='<tr>'+cols.map(function(c){ var cls=numK.indexOf(c[0])>=0?'num':(ctK.indexOf(c[0])>=0?'ct':'');
    var lbl=c[0]==='donGia'?'ĐƠN GIÁ':c[0]==='dvt'?'ĐƠN VỊ TÍNH':c[1];
    return '<th class="thk '+cls+(flt[c[0]]?' fltOn':'')+'" data-k="'+c[0]+'" draggable="true"><span class="thl">'+esc(lbl)+'</span>'
      +'<span class="thflt" title="Lọc cột" onclick="openFilter(event,\''+c[0]+'\')">▾</span><span class="thrsz" data-k="'+c[0]+'"></span></th>'; }).join('')+'<th></th></tr>';
  var body='';
  if(!order.length){ body='<tr><td class="empty" colspan="'+(cols.length+1)+'">Chưa có tầng/hạng mục. Bấm “＋ Tầng”, rồi “＋ Hạng mục” — hoặc thêm sản phẩm từ danh mục bên trái.</td></tr>'; }
  order.forEach(function(g,gi){
    var roman=['I','II','III','IV','V','VI','VII','VIII','IX','X'][gi]||(gi+1);
    var col=S.collapsed[g]?'▸':'▾';
    var gval=(g==='CHƯA PHÂN TẦNG'?'':g), isSel=((S.selFloor||'')===gval);
    body+='<tr class="grp'+(isSel?' selFloor':'')+'" draggable="true" data-g="'+esc(g)+'"><td colspan="'+(cols.length+1)+'" data-f="'+esc(g)+'">'
      +'<span class="gcol" onclick="event.stopPropagation();toggleFloor(this.closest(\'td\').dataset.f)">'+col+'</span> '
      +'<span class="gname" onclick="selectFloor(this.closest(\'td\').dataset.f)" ondblclick="renameFloor(this.closest(\'td\').dataset.f)" title="Bấm để chọn tầng · bấm đúp đổi tên" style="cursor:pointer">'+roman+'.'+esc(g)+'</span>'
      +'<span class="gsel" onclick="selectFloor(this.closest(\'td\').dataset.f)">'+(isSel?'✓ đang thêm':'chọn')+'</span>'
      +'<button class="addrow" onclick="addItemToFloor(this.closest(\'td\').dataset.f)">＋ hạng mục</button></td></tr>';
    if(S.collapsed[g]) return;
    (groups[g]||[]).forEach(function(l,ri){
      var hs=S.rowH[l.lineId]?' style="height:'+S.rowH[l.lineId]+'px"':'';
      body+='<tr class="drow" draggable="true" data-id="'+l.lineId+'" data-tang="'+esc(l.tang||'')+'"'+hs+'>'+cols.map(function(c){
        var k=c[0];
        if(k==='stt') return '<td class="ct dragH" title="Kéo để di chuyển dòng"><span class="grip">⠿</span> '+(gi+1)+'.'+(ri+1)+'</td>';
        return cellInput(l,k);
      }).join('')+'<td class="ct actcell"><button class="del" title="Xoá dòng" onclick="delLine(\''+l.lineId+'\')">✕</button><div class="rgrip" data-id="'+l.lineId+'" title="Kéo để chỉnh chiều cao dòng">⇕</div></td></tr>';
    });
  });
  body+='<tr><td colspan="'+(cols.length+1)+'" style="background:#fff;padding:10px 12px"><span class="addfloorbtn" onclick="addFloor()">＋ Thêm tầng</span></td></tr>';
  t.style.width=totalW+'px';
  t.innerHTML=colg+head+body;
}
async function editLine(id,fields){
  try{
    await api('updateLine',id,fields); S.lines=await api('getLines',S.cur.maDA)||[];
    renderTable(); renderCard();
    if(document.getElementById('v-chiphi').classList.contains('on')) renderChiphi();
    if(document.getElementById('v-dash').classList.contains('on')) renderDash();
  }catch(e){ toast('Lỗi sửa: '+e.message); }
}

/* ===== KÉO DI CHUYỂN DÒNG + KÉO CHỈNH CAO DÒNG ===== */
function initTableInteractions(){
  var tk=document.getElementById('tkTable'); if(!tk || tk._init) return; tk._init=1;
  function clr(){ tk.querySelectorAll('.dropTop,.dropBot,.dropInto,.dropL,.dropR').forEach(function(x){ x.classList.remove('dropTop','dropBot','dropInto','dropL','dropR'); }); }
  tk.addEventListener('dragstart',function(e){
    var th=e.target.closest('th.thk');
    if(th){ if(e.target.closest('.thrsz')){ e.preventDefault(); return; } S._dragCol=th.dataset.k; S._drag=S._dragGrp=null; th.classList.add('dragging'); try{e.dataTransfer.setData('text/plain',th.dataset.k);}catch(x){} return; }
    var grp=e.target.closest('tr.grp');
    if(grp){ if(e.target.closest('button,.gcol,.gname,input')){ e.preventDefault(); return; } S._dragGrp=grp.dataset.g; S._drag=S._dragCol=null; grp.classList.add('dragging'); try{e.dataTransfer.setData('text/plain',grp.dataset.g);}catch(x){} return; }
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
  var vals={}; lines.forEach(function(l){ var v=colPlain(l,key); if(v!=='') vals[v]=(vals[v]||0)+1; });
  var keys=Object.keys(vals).sort();
  var pop=document.createElement('div'); pop.className='fltpop'; pop.id='qs_pop';
  pop.innerHTML='<div class="fi all" onclick="setFilter(\''+key+'\',null)">▸ Tất cả ('+lines.length+')</div>'
    +keys.map(function(v){ return '<div class="fi'+(S.colFilter[key]===v?' on':'')+'" data-v="'+esc(v)+'" onclick="setFilter(\''+key+'\',this.dataset.v)">'+esc(v)+' ('+vals[v]+')</div>'; }).join('');
  document.body.appendChild(pop);
  var r=e.target.getBoundingClientRect(); pop.style.left=Math.max(8,Math.min(r.left, window.innerWidth-pop.offsetWidth-10))+'px'; pop.style.top=(r.bottom+4)+'px';
  setTimeout(function(){ document.addEventListener('mousedown',popOutside); },0);
}
function popOutside(e){ if(!e.target.closest('#qs_pop')) closePop(); }
function closePop(){ var p=document.getElementById('qs_pop'); if(p)p.remove(); document.removeEventListener('mousedown',popOutside); }
function setFilter(key,v){ if(v==null||v==='__all__') delete S.colFilter[key]; else S.colFilter[key]=v; closePop(); renderTable(); }
/* popup chọn sản phẩm cho cột Tên */
function openPick(lineId,e){
  if(e)e.stopPropagation(); closePop();
  var pop=document.createElement('div'); pop.className='fltpop'; pop.id='qs_pop'; pop.style.width='380px'; pop.style.maxHeight='440px';
  pop.innerHTML='<input class="cin" id="pickq" placeholder="Tìm sản phẩm…" style="width:100%;border:1px solid var(--line);padding:8px;margin-bottom:6px"><div id="picklist"></div>';
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
function prodDragStart(e,i){ var p=(S._filtered||[])[i]; if(!p){ e.preventDefault(); return; } S._dragProd=p; try{e.dataTransfer.effectAllowed='copy'; e.dataTransfer.setData('text/plain',p.ten||'');}catch(x){} var c=e.target.closest('.citem'); if(c)c.classList.add('dragging'); }
function prodDragEnd(){ S._dragProd=null; document.querySelectorAll('.citem.dragging').forEach(function(x){x.classList.remove('dragging');}); var tk=document.getElementById('tkTable'); if(tk) tk.querySelectorAll('.prodDrop,.dropBot').forEach(function(x){x.classList.remove('prodDrop','dropBot');}); }
async function pickProduct(lineId,pi){
  var p=S.products[pi]; if(!p)return; closePop();
  await editLine(lineId,{ten:p.ten,thuongHieu:p.thuongHieu,ncc:p.ncc,maSP:p.ma,kichThuoc:p.kichThuoc,moTa:p.moTa,dvt:p.dvt||'Cái',donGiaVon:p.donGiaVon,donGiaBan:p.donGiaBan,hinhAnh:p.hinhAnh,loai:p.hangMuc});
  toast('Đã chọn: '+p.ten);
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
  try{ await api('deleteLine',id); S.lines=S.lines.filter(function(l){return l.lineId!==id;}); renderTree(); renderTable(); toast('Đã xoá'); }
  catch(e){ toast('Lỗi xoá: '+e.message); }
}

/* ===== THÔNG TIN DỰ ÁN ===== */
function syncProj(p){ if(!p)return; S.cur=p; var i=S.projects.findIndex(function(x){return x.maDA===p.maDA;}); if(i>=0)S.projects[i]=p; renderProjSel(); }
function pf_(label,id,val,type){ return '<div class="field"><label>'+esc(label)+'</label><input id="'+id+'" type="'+(type||'text')+'" class="cin" style="width:100%;border:1px solid var(--line);padding:9px" value="'+esc(val==null?'':val)+'"></div>'; }
function renderProjects(){
  var el=document.getElementById('v-project');
  var list=(S.projects.length?S.projects:[]).map(function(p){
    var on=S.cur&&S.cur.maDA===p.maDA;
    return '<div class="pcell"'+(on?' style="border-color:var(--blue)"':'')+'><h4>'+esc(p.ten)+'</h4>'
      +'<div class="meta">'+esc(p.maDA)+' · '+esc(p.khachHang||'—')+'<br>'+esc(p.diaChi||'')+'</div>'
      +'<div class="row"><button class="btn blue sm" onclick="pickProject(\''+esc(p.maDA)+'\')">'+(on?'Đang mở':'Mở bóc tách')+'</button>'
      +'<button class="btn ghost sm" onclick="removeProject(\''+esc(p.maDA)+'\')">Xoá</button></div></div>';
  }).join('') || '<div class="empty">Chưa có dự án. Bấm “Tạo dự án +”.</div>';
  var form='';
  if(S.cur){ var p=S.cur;
    form='<div class="panel" style="margin-top:16px"><div class="toolbar"><h3>Hồ sơ dự án — '+esc(p.ten)+'</h3></div>'
      +'<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px">'
      +pf_('Tên dự án','pf_ten',p.ten)+pf_('Khách hàng','pf_kh',p.khachHang)+pf_('Số điện thoại','pf_sdt',p.sdt)
      +pf_('Địa chỉ','pf_addr',p.diaChi)
      +'<div class="field"><label>Trạng thái</label><select id="pf_tt" class="cin" style="width:100%;border:1px solid var(--line);padding:9px">'+['Bản nháp','Đang thực hiện','Hoàn thành'].map(function(s){return '<option'+(p.trangThai===s?' selected':'')+'>'+s+'</option>';}).join('')+'</select></div>'
      +pf_('VAT (%)','pf_vat',p.vat,'number')
      +pf_('Quy mô','pf_qm',p.quyMo)+pf_('Tổng DT XD (m²)','pf_tdt',p.tongDT)+pf_('DT báo giá (m²)','pf_dtbg',p.dtBaoGia)
      +pf_('Nhu cầu','pf_nc',p.nhuCau)+pf_('Phân khúc','pf_pk',p.phanKhuc)+pf_('Mã báo giá','pf_mbg',p.maBaoGia)
      +'</div>'
      +'<div style="margin-top:8px"><textarea id="pf_gc" class="cin" placeholder="Ghi chú" style="width:100%;border:1px solid var(--line);padding:9px;min-height:56px">'+esc(p.ghiChu||'')+'</textarea></div>'
      +'<div style="margin-top:12px;display:flex;gap:10px;align-items:center;flex-wrap:wrap"><button class="btn blue" onclick="saveProjectInfo(this)">💾 Lưu thông tin</button>'
      +'<span style="flex:1"></span><label style="color:var(--muted)">Tiến độ</label>'
      +'<input id="pf_prog" type="range" min="0" max="100" value="'+(Number(p.tienDo)||0)+'" oninput="document.getElementById(\'pf_pv\').textContent=this.value+\'%\'">'
      +'<b id="pf_pv">'+(Number(p.tienDo)||0)+'%</b><button class="btn ghost sm" onclick="saveProgress(this)">Cập nhật</button></div></div>';
  }
  el.innerHTML='<div class="plist">'+list+'</div>'+form;
}
async function saveProjectInfo(btn){
  var g=function(id){var e=document.getElementById(id);return e?e.value:'';};
  var data={ten:g('pf_ten'),khachHang:g('pf_kh'),sdt:g('pf_sdt'),diaChi:g('pf_addr'),trangThai:g('pf_tt'),vat:Number(g('pf_vat'))||0,ghiChu:g('pf_gc'),quyMo:g('pf_qm'),tongDT:g('pf_tdt'),dtBaoGia:g('pf_dtbg'),nhuCau:g('pf_nc'),phanKhuc:g('pf_pk'),maBaoGia:g('pf_mbg')};
  btn.disabled=true; try{ var p=await api('updateProject',S.cur.maDA,data); syncProj(p); renderCard(); renderProjects(); toast('Đã lưu thông tin'); }catch(e){ toast('Lỗi: '+e.message); } btn.disabled=false;
}
async function saveProgress(btn){ var v=Number(document.getElementById('pf_prog').value)||0;
  try{ var p=await api('updateProject',S.cur.maDA,{tienDo:v}); syncProj(p); renderCard(); toast('Đã cập nhật tiến độ '+v+'%'); }catch(e){ toast('Lỗi: '+e.message); } }
async function pickProject(maDA){ S.cur=S.projects.filter(function(p){return p.maDA===maDA;})[0]; S.lines=await api('getLines',maDA)||[]; S._coverDA=null; renderAll(); showTab('boc'); }
async function removeProject(maDA){ if(!confirm('Xoá dự án này?'))return; await api('deleteProject',maDA); if(S.cur&&S.cur.maDA===maDA)S.cur=null; await boot(); renderProjects(); }

/* ===== DASHBOARD ===== */
function card(t,n){ return '<div class="scard"><div class="n">'+n+'</div><div class="t">'+t+'</div></div>'; }
function renderDash(){
  var el=document.getElementById('v-dash');
  if(!S.cur){ el.innerHTML='<div class="empty">Chưa chọn dự án.</div>'; return; }
  var von=0,ban=0,kl=0,groups={}; S.lines.forEach(function(l){ von+=l.thanhTienVon;ban+=l.thanhTienBan;kl+=l.soLuong; var k=l.nhom||'Khác'; (groups[k]=groups[k]||{ban:0}).ban+=l.thanhTienBan; });
  var byG=Object.keys(groups).map(function(k){return {k:k,ban:groups[k].ban};}).sort(function(a,b){return b.ban-a.ban;});
  var max=byG.reduce(function(m,g){return Math.max(m,g.ban);},1);
  var bars=byG.map(function(g){ return '<div style="margin:10px 0"><div style="display:flex;justify-content:space-between;font-size:13px"><span>'+esc(nodeName(g.k))+'</span><b>'+money(g.ban)+' đ</b></div><div style="height:10px;background:#eef2f6;border-radius:6px;overflow:hidden;margin-top:4px"><i style="display:block;height:100%;width:'+(g.ban/max*100)+'%;background:var(--blue)"></i></div></div>'; }).join('')||'<div class="empty">Chưa có dữ liệu.</div>';
  el.innerHTML='<div class="stat">'+card('Số hạng mục',S.lines.length)+card('Tổng khối lượng',kl)+card('Giá trị vốn',money(von)+' đ')+card('Tổng giá bán',money(ban)+' đ')+card('Lợi nhuận',money(ban-von)+' đ')+'</div>'
    +'<div class="panel"><h3>Giá trị theo nhóm (giá bán)</h3>'+bars+'</div>';
}

/* ===== CHI PHÍ ===== */
function renderChiphi(){
  var box=document.getElementById('chiphiBox');
  if(!S.cur){ box.innerHTML='<div class="empty">Chưa chọn dự án.</div>'; return; }
  var von=0,ban=0; S.lines.forEach(function(l){ von+=Number(l.thanhTienVon)||0; ban+=Number(l.thanhTienBan)||0; });
  var ln=ban-von, bien=ban>0?(ln/ban*100):0;
  var rows=S.lines.map(function(l){
    return '<tr><td class="td-ten">'+esc(l.ten||'')+'</td><td class="ct">'+esc(l.dvt||'')+'</td><td class="num">'+(l.soLuong||0)+'</td>'
      +'<td class="num"><input class="cin num" type="number" value="'+(Number(l.donGiaVon)||0)+'" onchange="editLine(\''+l.lineId+'\',{donGiaVon:this.value})"></td>'
      +'<td class="num"><input class="cin num" type="number" style="width:64px" value="'+(Number(l.lnPct)||0)+'" onchange="editLine(\''+l.lineId+'\',{lnPct:this.value})"></td>'
      +'<td class="num"><input class="cin num" type="number" value="'+(Number(l.donGiaBan)||0)+'" onchange="editLine(\''+l.lineId+'\',{donGiaBan:this.value})"></td>'
      +'<td class="num">'+money(l.thanhTienVon)+'</td><td class="num">'+money(l.thanhTienBan)+'</td></tr>';
  }).join('');
  box.innerHTML='<div class="stat">'+card('Giá trị vốn',money(von)+' đ')+card('Tổng giá bán',money(ban)+' đ')+card('Lợi nhuận',money(ln)+' đ')+card('Biên LN',bien.toFixed(1)+'%')+'</div>'
    +'<div class="tbl-wrap" style="margin-top:14px"><table class="tk"><tr><th>TÊN SẢN PHẨM</th><th class="ct">ĐVT</th><th class="num">SL</th><th class="num">ĐƠN GIÁ VỐN</th><th class="num">% LN</th><th class="num">ĐƠN GIÁ BÁN</th><th class="num">TT VỐN</th><th class="num">TT BÁN</th></tr>'
    +(S.lines.length?rows:'<tr><td class="empty" colspan="8">Chưa có hạng mục.</td></tr>')+'</table></div>';
}

/* ===== XUẤT BÁO GIÁ + TỜ BÌA ===== */
function computeQuoteLocal(){ var sub=0; S.lines.forEach(function(l){ sub+=Number(l.thanhTienBan)||0; }); var vatPct=Number(S.cur&&S.cur.vat)||0; var vat=Math.round(sub*vatPct/100); return {subtotal:sub,vatPct:vatPct,vat:vat,total:sub+vat}; }
function coverDepth(s){ return String(s).split('.').length; }
function coverComp(){ var cost={},total=0; (S.cover||[]).forEach(function(c){ cost[c.stt]=Number(c.chiPhi)||0; }); (S.cover||[]).forEach(function(c){ if(coverDepth(c.stt)===1) total+=cost[c.stt]; }); return {cost:cost,total:total}; }
function coverSortFn(a,b){ function k(s){return String(s).split('.').map(function(x){return parseInt(x,10)||0;});} var ka=k(a.stt),kb=k(b.stt),n=Math.max(ka.length,kb.length); for(var i=0;i<n;i++){var d=(ka[i]||0)-(kb[i]||0); if(d)return d;} return 0; }
async function renderExport(){
  var box=document.getElementById('exportBox');
  if(!S.cur){ box.innerHTML='<div class="empty">Chưa chọn dự án.</div>'; return; }
  if(S._coverDA!==S.cur.maDA){ box.innerHTML='<div class="empty">Đang tải tờ bìa…</div>'; try{ S.cover=await api('getCoverOrInit',S.cur.maDA)||[]; }catch(e){ S.cover=[]; } S._coverDA=S.cur.maDA; }
  drawCover();
}
function drawCover(){
  var box=document.getElementById('exportBox'); var comp=coverComp(), total=comp.total, cost=comp.cost;
  var rows=(S.cover||[]).slice().sort(coverSortFn);
  var body=rows.map(function(c){
    var i=S.cover.indexOf(c), lvl=coverDepth(c.stt), val=cost[c.stt]||0, pct=total>0?(val/total*100):0;
    var cls=lvl===1?'lv1':(lvl===2?'lv2':'');
    return '<tr class="'+cls+'">'
      +'<td class="ct"><input class="cin" style="width:52px;text-align:center" value="'+esc(c.stt)+'" onchange="coverEdit('+i+',\'stt\',this.value)"></td>'
      +'<td><input class="cin" value="'+esc(c.hangMuc||'')+'" onchange="coverEdit('+i+',\'hangMuc\',this.value)"><input class="cin" style="font-size:12px;color:#667" placeholder="mô tả…" value="'+esc(c.moTa||'')+'" onchange="coverEdit('+i+',\'moTa\',this.value)"></td>'
      +'<td class="num"><input class="cin num" style="width:120px" value="'+money(val)+'" onchange="coverEdit('+i+',\'chiPhi\',this.value)"></td>'
      +'<td class="num">'+pct.toFixed(1)+'%</td>'
      +'<td class="ct"><button class="del" onclick="coverDel('+i+')">✕</button></td></tr>';
  }).join('');
  var q=computeQuoteLocal();
  box.innerHTML='<div class="toolbar"><h3>Tờ bìa — Bảng ước tính chi phí</h3></div>'
    +'<div class="floorbar"><button class="btn ghost sm" onclick="coverAdd()">＋ Mục</button>'
    +'<button class="btn ghost sm" onclick="coverReload(this)">↻ Nạp lại mẫu + tự cộng</button>'
    +'<button class="btn blue sm" onclick="coverSave(this)">💾 Lưu tờ bìa</button><span style="flex:1"></span>'
    +'<button class="btn blue sm" onclick="doExport(\'xlsx\',this)">⬇ Excel</button>'
    +'<button class="btn ghost sm" onclick="doExport(\'pdf\',this)">⬇ PDF (in)</button></div>'
    +'<div class="tbl-wrap"><table class="tk"><tr><th class="ct">NO</th><th>HẠNG MỤC</th><th class="num">CHI PHÍ DỰ KIẾN</th><th class="num">TỶ TRỌNG</th><th></th></tr>'
    +(body||'<tr><td class="empty" colspan="5">Chưa có dòng. Bấm ↻ để nạp mẫu.</td></tr>')
    +'<tr class="lv1"><td colspan="2" style="text-align:right">TỔNG CHI PHÍ DỰ KIẾN (VNĐ)</td><td class="num">'+money(total)+'</td><td></td><td></td></tr></table></div>'
    +'<div style="margin-top:14px;padding:16px;background:#fff;border:1px solid var(--line);border-radius:12px;max-width:460px">'
    +'<div style="display:flex;justify-content:space-between"><span>Tạm tính (Σ thành tiền bán):</span><b>'+money(q.subtotal)+' đ</b></div>'
    +'<div style="display:flex;justify-content:space-between;margin-top:4px"><span>VAT ('+q.vatPct+'%):</span><b>'+money(q.vat)+' đ</b></div>'
    +'<div style="display:flex;justify-content:space-between;margin-top:6px;font-size:16px;color:var(--navy)"><b>TỔNG CỘNG:</b><b>'+money(q.total)+' đ</b></div></div>';
}
function coverEdit(i,field,value){ var c=S.cover[i]; if(!c)return;
  if(field==='chiPhi') c.chiPhi=Number(String(value).replace(/[^\d.-]/g,''))||0;
  else if(field==='stt') c.stt=String(value).replace(/[^\d.]/g,'');
  else c[field]=value; drawCover(); }
function coverDel(i){ S.cover.splice(i,1); drawCover(); }
function coverAdd(){ S.cover.push({stt:String((S.cover||[]).length+1),hangMuc:'Mục mới',moTa:'',chiPhi:0}); drawCover(); }
async function coverReload(btn){ if(btn)btn.disabled=true; try{ S.cover=await api('buildCoverFromTemplate',S.cur.maDA)||[]; S._coverDA=S.cur.maDA; drawCover(); toast('Đã nạp mẫu + tự cộng chi phí'); }catch(e){ toast('Lỗi: '+e.message); } if(btn)btn.disabled=false; }
async function coverSave(btn){ btn.disabled=true; try{ S.cover=await api('saveCover',S.cur.maDA,S.cover)||S.cover; toast('Đã lưu tờ bìa'); drawCover(); }catch(e){ toast('Lỗi: '+e.message); } btn.disabled=false; }
async function doExport(fmt,btn){
  if(!S.cur){ toast('Chưa chọn dự án'); return; }
  var cols=[{key:'khuVuc',label:'PHÒNG'},{key:'ten',label:'TÊN SẢN PHẨM'},{key:'thuongHieu',label:'THƯƠNG HIỆU'},
    {key:'moTa',label:'MÔ TẢ'},{key:'kichThuoc',label:'KÍCH THƯỚC'},{key:'dvt',label:'ĐVT'},
    {key:'soLuong',label:'SL',num:true},{key:'donGiaBan',label:'ĐƠN GIÁ',num:true},{key:'thanhTienBan',label:'THÀNH TIỀN',num:true}];
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
    +'<table><tr><th>STT</th><th>PHÒNG</th><th>TÊN SẢN PHẨM</th><th>THƯƠNG HIỆU</th><th>SL</th><th>ĐƠN GIÁ</th><th>THÀNH TIỀN</th></tr>'+rows+'</table>');
  w.document.close(); setTimeout(function(){w.focus();w.print();},500);
}
function tdInput(label,id,val,type){ return '<div class="field"><label>'+esc(label)+'</label><input id="'+id+'" type="'+(type||'text')+'" class="cin" style="width:100%;border:1px solid var(--line);padding:9px" value="'+esc(val||'')+'"></div>'; }
function renderImport(){
  var box=document.getElementById('importBox');
  var nhoms={}; S.products.forEach(function(p){ if(p.nhom)nhoms[p.nhom]=1; });
  var opts='<option value=""></option>'+Object.keys(nhoms).map(function(n){return '<option>'+esc(n)+'</option>';}).join('');
  box.innerHTML='<div class="toolbar"><h3>Thêm sản phẩm vào danh mục</h3></div>'
    +'<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;max-width:900px">'
    +'<div class="field"><label>Nhóm</label><select id="td_nhom" class="cin" style="width:100%;border:1px solid var(--line);padding:9px">'+opts+'</select></div>'
    +tdInput('Hạng mục','td_hm')+tdInput('Tên sản phẩm *','td_ten')
    +tdInput('Thương hiệu','td_th')+tdInput('Nhà cung cấp','td_ncc')+tdInput('Mã SP','td_ma')
    +tdInput('Kích thước','td_kt')+tdInput('ĐVT','td_dvt','Cái')+tdInput('Đơn giá','td_gia','','number')
    +tdInput('Link ảnh (URL)','td_img')+'</div>'
    +'<div style="margin-top:8px;max-width:900px"><textarea id="td_mota" class="cin" placeholder="Mô tả" style="width:100%;border:1px solid var(--line);padding:9px;min-height:60px"></textarea></div>'
    +'<div style="margin-top:12px;display:flex;gap:10px"><button class="btn blue" onclick="tdSave(this)">＋ Thêm vào danh mục</button><button class="btn ghost" onclick="renderImport()">Xoá form</button></div>'
    +'<p style="color:var(--muted);margin-top:10px">Danh mục hiện có '+S.products.length+' mặt hàng (Lark Base).</p>';
}
async function tdSave(btn){
  var g=function(id){var e=document.getElementById(id);return e?e.value:'';};
  var ten=(g('td_ten')||'').trim(); if(!ten){ toast('Nhập Tên sản phẩm'); return; }
  var p={ nhom:g('td_nhom'), hangMuc:g('td_hm'), ten:ten, thuongHieu:g('td_th'), ncc:g('td_ncc'), ma:g('td_ma'),
    kichThuoc:g('td_kt'), dvt:g('td_dvt'), gia:g('td_gia'), hinhAnh:g('td_img'), moTa:g('td_mota') };
  btn.disabled=true;
  try{ await api('saveLineAsProduct',p); S.products=await api('getProducts')||S.products; toast('Đã thêm vào danh mục'); renderImport(); renderFilters(); renderCatalog(); }
  catch(e){ toast('Lỗi: '+e.message); } btn.disabled=false;
}

/* ===== GO ===== */
initCols();
initTableInteractions();
boot();
