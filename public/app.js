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
var S={ projects:[], products:[], cur:null, lines:[], node:'3.2.6.1', addTang:'',
  fWatt:{}, fKelvin:{}, fAngle:{}, fBrand:'', fNhom:'', cols:{} };

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
  var sel=document.getElementById('floorSel'); if(!sel) return;
  var fl=floorsList().filter(function(t){ return t!=='CHƯA PHÂN TẦNG'; });
  if((!S.addTang || fl.indexOf(S.addTang)<0) && fl.length) S.addTang=fl[0];
  sel.innerHTML = fl.length ? fl.map(function(t){ return '<option'+(S.addTang===t?' selected':'')+'>'+esc(t)+'</option>'; }).join('')
    : '<option value="">(chưa có tầng — bấm ＋ Tầng)</option>';
  sel.onchange=function(){ S.addTang=sel.value; };
}
async function addFloor(){
  if(!S.cur){ toast('Chưa chọn dự án'); return; }
  var name=prompt('Tên tầng mới (vd: TẦNG HẦM, TẦNG TRỆT, TẦNG 2):'); if(name==null) return;
  name=name.trim(); if(!name) return;
  var cur=(S.cur.tangTuTao?String(S.cur.tangTuTao).split('|'):[]).map(function(s){return s.trim();}).filter(Boolean);
  if(cur.indexOf(name)<0) cur.push(name);
  try{
    var p=await api('updateProject', S.cur.maDA, {tangTuTao:cur.join('|')}); S.cur=p;
    var i=S.projects.findIndex(function(x){return x.maDA===p.maDA;}); if(i>=0)S.projects[i]=p;
    S.addTang=name; renderFloors(); renderTable(); toast('Đã thêm tầng: '+name);
  }catch(e){ toast('Lỗi: '+e.message); }
}
async function addBlankItem(){ await addItemToFloor(S.addTang||''); }
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
    return '<div class="citem">'
      +'<div class="no">'+(i+1)+'</div>'+img
      +'<div class="info" onclick="showDetail('+i+')" style="cursor:pointer">'
        +'<div class="nm">'+esc(p.ten)+'</div>'
        +'<div class="sz">'+(p.kichThuoc?'Kích thước: '+esc(p.kichThuoc):esc(p.thuongHieu||''))+'</div></div>'
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
async function addProdObj(p){
  if(!S.cur){ toast('Chưa chọn dự án — bấm Tạo dự án +'); return; }
  try{
    var prod=Object.assign({},p,{ nhom:S.node, hangMuc:nodeName(S.node), loai:nodeName(S.node),
      tang:(S.addTang||''), extra:{nganh:p.nhom||''} });
    var l=await api('addLine', S.cur.maDA, prod, 1);
    S.lines.push(l); renderTree(); renderTable(); renderCard();
    toast('Đã thêm: '+p.ten);
  }catch(e){ toast('Lỗi thêm: '+e.message); }
}

/* ===== CATEGORY TREE ===== */
function nodeCount(code){
  return S.lines.filter(function(l){ return l.nhom===code || String(l.nhom||'').indexOf(code+'.')===0; }).length;
}
function pad2(n){ return (n<10?'0':'')+n; }
function renderTree(){
  var pop=document.getElementById('treePop');
  pop.innerHTML=TREE.map(function(t){
    var code=t[0],name=t[1],lvl=t[2],cnt=nodeCount(code);
    var label=(code==='X'?'X.':code+'.')+name;
    return '<div class="tnode lvl'+lvl+(S.node===code?' on':'')+'" onclick="pickNode(\''+code+'\')">'
      +'<span class="nm">'+esc(label)+'</span><span class="cn">['+pad2(cnt)+']</span><span class="rd"></span></div>';
  }).join('');
  var sel=TREE.filter(function(t){return t[0]===S.node;})[0];
  document.getElementById('treeLabel').textContent=sel?(sel[0]+'.'+sel[1]):'Chọn hạng mục';
  document.getElementById('treeCnt').textContent='['+pad2(nodeCount(S.node))+']';
}
function toggleTree(){ var p=document.getElementById('treePop'); p.style.display=p.style.display==='none'?'block':'none'; }
function pickNode(code){ S.node=code; document.getElementById('treePop').style.display='none'; renderTree(); renderTable(); }
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
function visCols(){ return COLS.filter(function(c){ return S.cols[c[0]]; }); }
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
function renderTable(){
  var code=S.node;
  var lines=S.lines.filter(function(l){ return l.nhom===code || String(l.nhom||'').indexOf(code+'.')===0; });
  document.getElementById('tkCount').textContent='['+pad2(lines.length)+']';
  var cols=visCols();
  var t=document.getElementById('tkTable');
  if(!S.cur){ t.innerHTML='<tr><td class="empty">Chưa chọn dự án.</td></tr>'; return; }
  var numK=['soLuong','giaNCC','giaDaiLy','donGia','thanhTien'], ctK=['stt','hinhAnh','dvt','chietKhau','lnPct'];
  // gom theo tầng — hiện cả tầng rỗng để thêm hạng mục vào
  var groups={};
  lines.forEach(function(l){ var g=(l.tang||'').trim()||'CHƯA PHÂN TẦNG'; (groups[g]=groups[g]||[]).push(l); });
  var order=floorsList().slice();
  Object.keys(groups).forEach(function(g){ if(order.indexOf(g)<0) order.push(g); });
  var head='<tr>'+cols.map(function(c){ var cls=numK.indexOf(c[0])>=0?'num':(ctK.indexOf(c[0])>=0?'ct':''); return '<th class="'+cls+'">'+esc(c[0]==='donGia'?'ĐƠN GIÁ':c[0]==='dvt'?'ĐƠN VỊ TÍNH':c[1])+'</th>'; }).join('')+'<th></th></tr>';
  var body='';
  if(!order.length){ body='<tr><td class="empty" colspan="'+(cols.length+1)+'">Chưa có tầng/hạng mục. Bấm “＋ Tầng”, rồi “＋ Hạng mục” — hoặc thêm sản phẩm từ danh mục bên trái.</td></tr>'; }
  order.forEach(function(g,gi){
    var roman=['I','II','III','IV','V','VI','VII','VIII','IX','X'][gi]||(gi+1);
    body+='<tr class="grp"><td colspan="'+(cols.length+1)+'" data-f="'+esc(g)+'">'+roman+'.'+esc(g)
      +'<button class="addrow" onclick="addItemToFloor(this.closest(\'td\').dataset.f)">＋ hạng mục</button></td></tr>';
    (groups[g]||[]).forEach(function(l,ri){
      body+='<tr>'+cols.map(function(c){
        var k=c[0];
        if(k==='stt') return '<td class="ct">'+(gi+1)+'.'+(ri+1)+'</td>';
        if(k==='khuVuc') return '<td><input class="qty" style="width:120px;text-align:left" placeholder="Phòng…" value="'+esc(l.khuVuc||'')+'" onchange="editLine(\''+l.lineId+'\',{khuVuc:this.value})"></td>';
        if(k==='soLuong') return '<td class="num"><input class="qty" type="number" value="'+(l.soLuong||0)+'" onchange="editLine(\''+l.lineId+'\',{soLuong:this.value})"></td>';
        if(k==='donGia') return '<td class="num"><input class="price" type="number" value="'+(l.donGiaBan||0)+'" onchange="editLine(\''+l.lineId+'\',{donGiaBan:this.value})"></td>';
        var cls=numK.indexOf(k)>=0?'num':(ctK.indexOf(k)>=0?'ct':(k==='ten'?'td-ten':(k==='moTa'||k==='kichThuoc'?'wrap':'')));
        return '<td class="'+cls+'">'+cellVal(l,k)+'</td>';
      }).join('')+'<td class="ct"><button class="del" title="Xoá dòng" onclick="delLine(\''+l.lineId+'\')">✕</button></td></tr>';
    });
  });
  t.innerHTML=head+body;
}
async function editLine(id,fields){
  try{ await api('updateLine',id,fields); S.lines=await api('getLines',S.cur.maDA)||[]; renderTable(); renderCard(); }
  catch(e){ toast('Lỗi sửa: '+e.message); }
}
async function delLine(id){
  try{ await api('deleteLine',id); S.lines=S.lines.filter(function(l){return l.lineId!==id;}); renderTree(); renderTable(); toast('Đã xoá'); }
  catch(e){ toast('Lỗi xoá: '+e.message); }
}

/* ===== OTHER TABS ===== */
function renderProjects(){
  var el=document.getElementById('projList');
  el.innerHTML=(S.projects.length?S.projects:[]).map(function(p){
    return '<div class="pcell"><h4>'+esc(p.ten)+'</h4>'
      +'<div class="meta">'+esc(p.maDA)+' · '+esc(p.khachHang||'—')+'<br>'+esc(p.diaChi||'')+'</div>'
      +'<div class="row"><button class="btn blue sm" onclick="pickProject(\''+esc(p.maDA)+'\')">Mở bóc tách</button>'
      +'<button class="btn ghost sm" onclick="removeProject(\''+esc(p.maDA)+'\')">Xoá</button></div></div>';
  }).join('') || '<div class="empty">Chưa có dự án. Bấm “Tạo dự án +”.</div>';
}
async function pickProject(maDA){ S.cur=S.projects.filter(function(p){return p.maDA===maDA;})[0]; S.lines=await api('getLines',maDA)||[]; renderAll(); showTab('boc'); }
async function removeProject(maDA){ if(!confirm('Xoá dự án này?'))return; await api('deleteProject',maDA); if(S.cur&&S.cur.maDA===maDA)S.cur=null; await boot(); renderProjects(); }
function renderDash(){
  var von=0,ban=0,kl=0; S.lines.forEach(function(l){von+=l.thanhTienVon;ban+=l.thanhTienBan;kl+=l.soLuong;});
  document.getElementById('dashStat').innerHTML=
    card('Số hạng mục',S.lines.length)+card('Tổng khối lượng',kl)+card('Giá trị vốn',money(von)+' đ')
    +card('Tổng giá bán',money(ban)+' đ')+card('Lợi nhuận',money(ban-von)+' đ');
}
function card(t,n){ return '<div class="scard"><div class="n">'+n+'</div><div class="t">'+t+'</div></div>'; }
function renderChiphi(){ document.getElementById('chiphiBox').innerHTML='<h3>Chi phí</h3><p style="color:var(--muted)">Chỉnh đơn giá vốn / % lợi nhuận trực tiếp ở bảng Bóc tách (cột GIÁ BÁN LẺ NCC, LỢI NHUẬN, ĐƠN GIÁ). Bản dựng theo mockup đang tập trung màn Bóc tách; màn này sẽ chi tiết ở bước sau.</p>'; }
function renderExport(){
  document.getElementById('exportBox').innerHTML='<h3>Xuất báo giá</h3>'
    +'<div style="display:flex;gap:10px;margin-top:10px">'
    +'<button class="btn blue" onclick="doExport(\'xlsx\',this)">⬇ Xuất Excel</button>'
    +'<button class="btn ghost" onclick="doExport(\'pdf\',this)">⬇ Xuất PDF (in)</button></div>';
}
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
function renderImport(){ document.getElementById('importBox').innerHTML='<h3>Nhập dữ liệu</h3><p style="color:var(--muted)">Danh mục sản phẩm ('+S.products.length+' mặt hàng) nạp từ Lark Base. Thêm/sửa sản phẩm & đơn giá trực tiếp trên Lark (bảng “Danh mục sản phẩm”).</p>'; }

/* ===== GO ===== */
boot();
