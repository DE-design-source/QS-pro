/* ═══ TAB BÓC TÁCH — bảng khối lượng theo tầng: vẽ bảng, thêm SP, tầng, menu chuột phải, tìm & thay,
   tìm nhanh, chọn dòng / sửa hàng loạt, chọn vùng ô, chế độ xem. Dùng chung lõi ở app.js
   (S, api, editLine, công thức giá giaDaiLy_/donGiaCK_..., cellInput/cellVal, visCols, cây hạng mục).
   Lưu ý: tab Chi phí gọi tkSelLines_/tkApplyEdits_ ở đây. ═══ */
'use strict';

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
  var vals=visCols().map(function(col){ var v=cellSortVal_(l,col[0]); return v==null?'':String(v); });
  ctxCopy_(vals.join('\t')); toast('Đã sao chép cả dòng — dán được thẳng vào Excel'); }
async function ctxPasteCell(){ var c=S._ctxCell; closePop(); if(!c||!c.key) return;
  var txt='';
  try{ txt=await navigator.clipboard.readText(); }
  catch(e){ toast('Trình duyệt chặn đọc clipboard — bấm vào ô rồi nhấn Ctrl+V'); return; }
  if(!txt) return;
  if(ctxSet_(c.lineId, c.key, String(txt).split('\t')[0].split('\n')[0].trim())) toast('Đã dán vào ô'); }
function ctxClearCell(){ var c=S._ctxCell; closePop(); if(!c||!c.key) return;
  if(ctxSet_(c.lineId, c.key, '')) toast('Đã xoá nội dung ô'); }
// Ghi giá trị raw vào ô (lineId, cột) qua đúng trường của dòng. false = cột chỉ đọc
function ctxSet_(lineId,key,raw){
  var l=S.lines.filter(function(x){return x.lineId===lineId;})[0]; if(!l) return false;
  var d=tkFieldsFor_(l,key,raw);
  if(!d){ toast('Cột này tự tính — không sửa trực tiếp được'); return false; }
  editLine(lineId,d); return true; }
async function ctxDupRow(lineId){ closePop();
  var l=S.lines.filter(function(x){return x.lineId===lineId;})[0]; if(!l||!S.cur) return;
  var prod=Object.assign({},l,{ma:l.maSP}); delete prod.lineId; delete prod.recordId;   // server đọc product.ma
  try{ var nl=await api('addLine', S.cur.maDA, prod, Number(l.soLuong)||1);
    S.lines.push(nl); veLaiSauSua_(); renderActGutter&&renderActGutter(); toast('Đã nhân bản dòng'); }
  catch(e){ toast('Lỗi nhân bản: '+e.message); } }
async function ctxInsertRow(lineId){ closePop();
  if(!S.cur) return;
  var l=S.lines.filter(function(x){return x.lineId===lineId;})[0];
  var nd=(l&&l.nhom)||S.node;          // chèn từ Chi phí / Dự án: đúng hạng mục của dòng đang đứng (không phải đề mục đang mở ở Bóc tách)
  try{ var nl=await api('addLine', S.cur.maDA, {ten:'Hạng mục mới', dvt:'Cái', donGiaVon:0, donGiaBan:0, nhom:nd, loai:nodeName(nd),
      tang:l?(l.tang||''):'', extra:(S.sheet&&tkSheetCo_())?{sheet:S.sheet}:null}, 0);     // cùng sheet đang xem -> thấy được dòng vừa chèn
    S.lines.push(nl); veLaiSauSua_(); renderActGutter&&renderActGutter(); toast('Đã chèn dòng trống'); }
  catch(e){ toast('Lỗi chèn dòng: '+e.message); } }
async function ctxFillDown(){ var c=S._ctxCell; closePop(); if(!c||!c.key) return;
  var rows=tkRowIdsOnScreen_().map(lineOf_).filter(function(l){ return l && l.lineId!==c.lineId; });   // đúng các dòng đang thấy
  if(!rows.length){ toast('Không có dòng nào khác trong hạng mục này'); return; }
  if(!await xacNhan_('Điền "'+String(c.text||'').slice(0,30)+'" cho '+rows.length+' dòng còn lại trong cột này?')) return;
  if(!tkFieldsFor_(rows[0],c.key,c.text)){ toast('Cột này tự tính — không điền được'); return; }
  rows.forEach(function(l){ var d=tkFieldsFor_(l,c.key,c.text); if(d) editLine(l.lineId,d); });
  toast('Đã điền xuống '+rows.length+' dòng'); }
function ctxSumCol(key){ closePop();
  var rows=tkRowIdsOnScreen_().map(lineOf_).filter(Boolean);                        // đúng các dòng đang thấy
  var sum=rows.reduce(function(a,l){ return a+(Number(cellSortVal_(l,key))||0); },0);
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
/* Thanh Tìm & thay thế: một hàng gọn, đặt NGAY TRÊN bảng (canh mép phải bảng) thay vì
   khối 3 hàng nổi đè lên mấy dòng đầu — trước đây che mất dữ liệu đang cần xem để thay. */
function openFindReplace(){ var bk=typeof btDangXem_==='function'&&btDangXem_(); if(bk){ btFind_(bk); return; }   // đang xem dạng bảng tính
  var ex=document.getElementById('frPanel'); if(ex){ frClose(); return; }
  var p=document.createElement('div'); p.id='frPanel'; p.className='fr-panel';
  p.innerHTML='<span class="fr-ic">'+icon('search',14)+'</span>'
    +'<input id="frFind" placeholder="Tìm trong bảng…" oninput="frFind()">'
    +'<span class="fr-cnt" id="frCnt"></span>'
    +'<span class="fr-ar">→</span>'
    +'<input id="frRep" placeholder="Thay bằng…" onkeydown="if(event.key===\'Enter\')frReplaceAll()">'
    +'<button class="btn blue xs" onclick="frReplaceAll()">Thay tất cả</button>'
    +'<button class="fr-x" title="Đóng (Esc)" onclick="frClose()">✕</button>';
  document.body.appendChild(p);
  frPlace_();
  if(!S._frBind){ S._frBind=1; window.addEventListener('resize',frPlace_); window.addEventListener('scroll',frPlace_,{passive:true}); }
  document.getElementById('frFind').focus();
}
// đặt thanh ngay phía TRÊN bảng, canh mép phải bảng, không lọt ra ngoài màn hình
function frPlace_(){
  var p=document.getElementById('frPanel'); if(!p) return;
  var w=document.querySelector('#v-boc .tbl-wrap'); var r=w?w.getBoundingClientRect():null;
  var rong=p.offsetWidth||520, h=p.offsetHeight||44;
  var trai=r? (r.right-rong) : (window.innerWidth-rong-24);
  var tren=r? (r.top-h-6) : 90;
  if(tren<74) tren=r? (r.top+6) : 90;                  // bảng sát đỉnh -> đành nằm trong bảng
  p.style.left=Math.max(10, Math.min(trai, window.innerWidth-rong-10))+'px';
  p.style.top=Math.max(74, tren)+'px';
  p.style.right='auto';
}
document.addEventListener('keydown',function(e){ if(e.key==='Escape' && document.getElementById('frPanel')) frClose(); });
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
    if(typeof tkSheetDenTang_==='function') tkSheetDenTang_(name);      // bảng tính: cuộn tới + nháy dòng tầng mới
    refreshAddFloorPop_();
  }catch(e){ toast('Lỗi: '+e.message); }
}
function refreshAddFloorPop_(){ var pop=document.getElementById('qs_pop'); if(pop&&pop.classList.contains('addfloor-pop')){ pop.innerHTML=addFloorPopInner_(); var i=document.getElementById('aflInput'); if(i)i.focus(); } }
// giữ tương thích cũ
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
  if(typeof tkSheetDen_==='function' && tkSheetDen_(id)) return;      // đang xem dạng bảng tính
  setTimeout(function(){
    var tr=document.querySelector('#tkTable tr.drow[data-id="'+id+'"]'); if(!tr) return;
    try{ tr.scrollIntoView({block:'center',behavior:'smooth'}); }catch(e){}
    var inp=tr.querySelector('.td-ten input')||tr.querySelector('input.cin'); if(inp){ inp.focus(); inp.select&&inp.select(); }
    var old=tr.style.background; tr.style.transition='background .4s'; tr.style.background='#fff6c9';
    setTimeout(function(){ tr.style.background=old||''; },1300);
  },70);
}

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
  if(typeof tkSheetDen_==='function' && tkSheetDen_(id)) return;      // đang xem dạng bảng tính
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
/* ═══ ĐỀ MỤC ĐỂ GHI DANH 1 SẢN PHẨM ═══
   Ở tab Bóc tách, đề mục là do người dùng tự chọn trên cây (kể cả nhóm tự tạo) -> luôn tôn trọng.
   Ở các tab khác (Danh sách sản phẩm, combo ở panel chi tiết…) KHÔNG có ô chọn đề mục, nên phải
   lấy đề mục theo NGÀNH của chính sản phẩm: Thiết bị vệ sinh -> 3.2.5, Thiết bị đèn -> 3.2.6.1.
   Trước đây luôn dùng S.node: ghi danh SP vệ sinh trong khi Bóc tách còn đứng ở Thiết bị đèn thì
   dòng rơi vào đề mục đèn — vào tab Dự án / Chi phí lọc 3.2.5 lại thấy trống dù đã thêm. */
function prodNode_(p){
  if(viewOn_('v-boc')) return S.node;                       // Bóc tách: theo đề mục đang chọn
  var nd=spNodeCodeOf_(p)||''; if(!nd) return S.node;        // không rõ ngành -> giữ nếp cũ
  var cur=String(S.node||'');
  return (cur===nd || cur.indexOf(nd+'.')===0) ? cur : nd;   // đang ở đúng ngành (hoặc đề mục con) -> giữ
}
async function addProdObj(p,floor,sl,node){
  if(!S.cur){ toast('Chưa chọn dự án — bấm Tạo dự án +'); return; }
  sl=Math.max(1, Math.round(Number(sl)||1));      // thêm nhiều đơn vị 1 lần (dùng cho combo)
  if(floor==null) floor=S.selFloor||'';
  if(floor==='CHƯA PHÂN TẦNG') floor='';
  var nd=String(node||prodNode_(p)||S.node||'');
  // cộng dồn SL nếu đã có cùng SP trong cùng hạng mục + tầng
  // Gộp SL chỉ khi TRÙNG CẢ THÔNG SỐ. Biến thể khác nhiệt độ/công suất/góc/màu tuy cùng mã+tên
  // vẫn là 2 DÒNG RIÊNG (trước đây gộp mất, kéo 4 biến thể chỉ vào 1 dòng).
  // Gộp SL chỉ khi: cùng hạng mục + tầng, TRÙNG CẢ THÔNG SỐ (biến thể khác = dòng riêng)
  // VÀ dòng đó CHƯA điền PHÒNG. Đã gán phòng -> thêm SP đó nữa nghĩa là cho PHÒNG KHÁC -> tạo DÒNG MỚI.
  var same=S.lines.filter(function(l){
    return !l._pending && l.nhom===nd && (l.tang||'')===floor
      && ((p.ma&&l.maSP&&l.maSP===p.ma)||l.ten===p.ten)
      && String(l.moTa||'').trim()===String(p.moTa||'').trim()
      && !String(l.khuVuc||'').trim()
      && tkSheetOf_(l)===((tkSheetCo_()&&S.sheet)||'');
  })[0];
  if(same){ editLine(same.lineId,{soLuong:(Number(same.soLuong)||0)+sl}); toast('+'+sl+' số lượng: '+p.ten);
    tkGotoNewRow_(same.lineId); return; }
  var gia=giaDongTuSP_(p);
  var prod=Object.assign({},p,gia,{ nhom:nd, hangMuc:nodeName(nd), loai:nodeName(nd), tang:floor,
    extra:Object.assign({nganh:p.nhom||''}, (S.sheet&&tkSheetCo_())?{sheet:S.sheet}:{}) });
  // ---- Optimistic: hiện dòng NGAY, đồng bộ server chạy nền ----
  var dgVon=gia.donGiaVon, dgBan=gia.donGiaBan;
  var temp={ lineId:'tmp_'+(S._tmpN=(S._tmpN||0)+1), _pending:true,
    khuVuc:'', maBanVe:'', maSP:p.ma||'', ten:p.ten||'', thuongHieu:p.thuongHieu||'', ncc:p.ncc||'',
    moTa:p.moTa||'', kichThuoc:p.kichThuoc||p.size||'', dvt:p.dvt||'Cái', hinhAnh:p.hinhAnh||'',
    soLuong:sl, donGiaVon:dgVon, chietKhau:gia.chietKhau, donGiaBan:dgBan, thanhTienVon:Math.round(dgVon*(1-gia.chietKhau/100))*sl, thanhTienBan:dgBan*sl, lnPct:0,
    nhom:nd, hangMuc:nodeName(nd), tang:floor };
  var gKey=floor||'CHƯA PHÂN TẦNG';
  if(S.collapsed[gKey]) S.collapsed[gKey]=false;      // tầng đang gập -> mở ra để thấy dòng vừa thêm
  S.lines.push(temp); renderTree(); renderFloors(); renderTable(); renderCard();
  tkGotoNewRow_(temp.lineId);                         // cuộn tới dòng mới + nháy nhẹ
  toast('Đã thêm: '+p.ten+(sl>1?(' ×'+sl):''));
  var maDA=S.cur.maDA;
  return api('addLine', maDA, prod, sl).then(function(l){
    if(temp._del){ api('deleteLine',l.lineId).catch(function(){}); return true; }   // bị xoá khi đang chờ server
    if(!S.cur||S.cur.maDA!==maDA){                      // đã đổi dự án: dòng đã lưu đúng dự án cũ, không chèn vào bảng mới
      if(temp._q) api('updateLine',l.lineId,temp._q).catch(function(){});
      return true; }
    var i=S.lines.indexOf(temp); if(i>=0) S.lines[i]=l; else S.lines.push(l);
    if(S._newLid===temp.lineId) S._newLid=l.lineId;   // dòng tạm -> dòng thật: nháy chạy tiếp, không giật
    if(temp._q) editLine(l.lineId, temp._q);            // sửa trong lúc chờ server -> gửi ngay khi có id thật
    renderTree(); veLaiSauSua_(); return true;
  }).catch(function(e){
    var i=S.lines.indexOf(temp); if(i>=0) S.lines.splice(i,1);
    renderTree(); renderFloors(); renderTable(); renderCard(); toast('Lỗi thêm: '+e.message); return false;
  });
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
  if(qbTab_()==='boc') (S.products||[]).forEach(function(p,i){ if(hit([p.ten,p.ma,p.thuongHieu,p.hangMuc].join(' ')))
    out.push({g:'Sản phẩm — thêm vào '+nodeName(S.node), t:p.ten, s:[p.ma,p.thuongHieu,p.donGiaBan?money(p.donGiaBan)+' đ':''].filter(Boolean).join(' · '), k:'prod', id:i, img:p.hinhAnh,
      cb:(Number(p.comboN)||0), ck:String(p.recordId||p.ma||'')}); });
  if(qbTab_()==='boc') PT_TEMPLATE.forEach(function(sec,si){ if(!sec.db) return; sec.items.forEach(function(a,ii){ if(hit(String(a[0])+' '+sec.t))
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
    // SP có sản phẩm đi kèm: thêm luôn nút combo (Shift+Enter cũng thêm cả combo)
    var cb=(r.k==='prod'&&r.cb>0)
      ?('<button class="qb-cbb" title="Thêm sản phẩm chính + '+r.cb+' sản phẩm đi kèm (Shift+Enter)"'
        +' onmousedown="event.preventDefault();event.stopPropagation();qbPickCombo_('+i+')">'+icon('layers',11)+' combo '+r.cb+'</button>'):'';
    return h+'<div class="qb-r'+(i===0?' on':'')+'" data-i="'+i+'" onmousedown="event.preventDefault();qbPick_('+i+')" onmousemove="qbMouse_(event,'+i+')">'
      +'<span class="qb-ri">'+ic+'</span><span class="qb-rt"><b>'+esc(r.t)+'</b><i>'+esc(r.s)+'</i></span>'
      +cb+'<span class="qb-ra">'+({line:'Tới dòng',node:'Chuyển',prod:'＋ Thêm',ct:'＋ Thêm'}[r.k])+'</span></div>';
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
  if(k==='Enter'){ e.preventDefault(); if(!rs.length) return;
    var j=S._qbI||0, r=rs[j];
    if(e.shiftKey && r && r.k==='prod' && r.cb>0) qbPickCombo_(j); else qbPick_(j); }
}
async function qbPick_(i){
  var r=(S._qbRs||[])[i]; if(!r) return;
  var inp=document.getElementById('qbQ');
  if(r.k==='line'){ qbClose_(); if(inp) inp.blur(); qbGotoRow_(r.id); return; }
  if(r.k==='node'){ qbClose_(); if(inp){ inp.value=''; inp.blur(); } qbGoNode_(r.id); return; }
  if(r.k==='prod'){ var p=(S.products||[])[r.id]; if(p) await addProdObj(p); }   // addProdObj tự báo thành công / lỗi
  if(r.k==='ct'){ var x=r.id.split(':'); if(S.node==='3.1') ptAddFromLib(+x[0],+x[1]); else ctAddToBoc_(+x[0],+x[1]); }
  if(inp) inp.focus();                               // thêm xong vẫn giữ ô tìm để thêm tiếp
}
// Thêm CẢ COMBO ngay từ ô tìm nhanh: sản phẩm chính + toàn bộ sản phẩm đi kèm
async function qbPickCombo_(i){
  var r=(S._qbRs||[])[i]; if(!r||r.k!=='prod') return;
  var p=(S.products||[])[r.id]; if(!p) return;
  if(!S.cur){ toast('Chưa chọn dự án'); return; }
  var btn=document.querySelector('#qbPop .qb-r[data-i="'+i+'"] .qb-cbb');
  if(btn){ if(btn.disabled) return; btn.disabled=true; btn.textContent='…'; }
  var list=[]; try{ list=await api('getCombo', String(p.recordId||p.ma))||[]; }catch(e){ list=[]; }
  await addProdObj(p, S.selFloor||'', 1);
  for(var k=0;k<list.length;k++) await addProdObj(list[k], S.selFloor||'', Number(list[k].comboSL)||1);
  toast(list.length ? ('Đã thêm combo "'+p.ten+'": sản phẩm chính + '+list.length+' sản phẩm đi kèm')
                    : ('Đã thêm "'+p.ten+'" — combo chưa khai báo sản phẩm đi kèm'));
  var inp=document.getElementById('qbQ');
  if(inp&&inp.value) qbSearch_(inp.value);           // vẽ lại để bỏ trạng thái "…" và cập nhật số dòng
  if(inp) inp.focus();
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
      return '<div class="qb-hr"><div class="qb-rt" onclick="qbHistGo_(\''+escJs_(l.lineId)+'\')" title="Tới dòng này"><b>'+esc(l.ten||'')+'</b>'
        +'<i>'+esc(l.nhom+'. '+nodeName(l.nhom))+(l.khuVuc?' · '+esc(l.khuVuc):'')+' · SL '+(l.soLuong||0)+'</i></div>'
        +'<button class="qb-plus" title="Thêm 1 số lượng" onclick="qbHistPlus_(\''+escJs_(l.lineId)+'\')">+1</button></div>';
    }).join(''):'<div class="qb-none">Bảng chưa có dòng nào.</div>');
  document.body.appendChild(pop);
  // neo vào ĐÚNG nút vừa bấm (thanh công cụ Bóc tách: #qbHist · Chi phí / Dự án: #pgHist)
  var b=(e&&e.currentTarget&&e.currentTarget.getBoundingClientRect)?e.currentTarget
        :(document.getElementById('qbHist')||document.querySelector('.view.on [id^="pgHist"]'));
  if(b){ var r=b.getBoundingClientRect(), w=pop.offsetWidth||320;
    pop.style.top=(r.bottom+6)+'px'; pop.style.left=Math.max(8,Math.min(r.right-w, window.innerWidth-w-10))+'px'; }
  setTimeout(function(){ document.addEventListener('mousedown',function h(ev){ if(ev.target.closest('#qbHistPop')||ev.target.closest('#qbHist')||ev.target.closest('[id^="pgHist"]')) return;
    var p=document.getElementById('qbHistPop'); if(p) p.remove(); document.removeEventListener('mousedown',h); }); },0);
}
function qbHistGo_(id){ var p=document.getElementById('qbHistPop'); if(p) p.remove(); qbGotoRow_(id); }
function qbHistPlus_(id){ var l=(S.lines||[]).filter(function(x){ return x.lineId===id; })[0]; if(!l) return;
  editLine(id,{soLuong:(Number(l.soLuong)||0)+1}); toast('+1 số lượng: '+l.ten);
  if(qbTab_()!=='boc') setTimeout(refreshActiveTab_,250);
  var p=document.getElementById('qbHistPop'); if(p){ p.remove(); qbHistPop_(); } }

function renderTable(){
  var code=S.node;
  // Đề mục "Phần thô" (3.1) -> bảng ước tính chi phí xây dựng thô (theo mẫu Excel)
  var isPT = (code==='3.1');
  var tkN=document.getElementById('tkNormal'), pw=document.getElementById('ptWrap'), tsw=document.getElementById('tkSheetWrap');
  var tkBt=!isPT && !!S.cur && btSan_() && btOn_('tk');      // chế độ bảng tính (bangtinh.js) thay cho bảng cũ
  var bms=document.getElementById('btModeSlot'); if(bms) bms.innerHTML=btSan_()?btCheDoNut_():'';   // công tắc Bảng tính | Bảng thường
  // Phần thô chỉ là 1 hạng mục: khi chọn thì hiện bảng của nó ở khu bên phải,
  // vẫn giữ nguyên khung chọn sản phẩm bên trái + bố cục 2 cột.
  if(tkN) tkN.style.display = (isPT||tkBt)?'none':'';
  if(tsw) tsw.style.display = tkBt?'':'none';
  if(!tkBt && typeof tkSheetGop_==='function') tkSheetGop_(false);     // trả khối "Công cụ bảng" về chỗ cũ
  if(pw) pw.style.display = isPT?'':'none';
  var tbx=document.getElementById('tkToolBox');
  if(tbx) tbx.classList.toggle('pt', isPT);      // Phần thô: vẫn giữ hàng công cụ, ẩn hàng chọn cột của bảng bóc tách
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
  // lọc cột: bảng thường = 1 giá trị (chuỗi) · bảng tính = nhiều giá trị tick kiểu Excel (mảng, xem tkLocPop_)
  Object.keys(flt).forEach(function(k){ lines=lines.filter(function(l){ return tkLocKhop_(flt[k],l,k); }); });
  var cols=visCols();
  var numK=['soLuong','giaNCC','giaDaiLy','donGia','donGiaCK','lnVnd','thanhTien'], ctK=['stt','hinhAnh','dvt','chietKhau','lnPct','ckKhach','markup','margin'];
  var groups={};
  lines.forEach(function(l){ var g=(l.tang||'').trim()||'CHƯA PHÂN TẦNG'; (groups[g]=groups[g]||[]).push(l); });
  var order=floorsList().slice();
  Object.keys(groups).forEach(function(g){ if(order.indexOf(g)<0) order.push(g); });
  if(!tkBt && typeof tkSheetGop_==='function') tkSheetGop_(false);   // bảng trống: dùng bảng cũ (có nút thêm tầng / hạng mục)
  if(tkBt){
    try{
      if(!document.getElementById('tkSheet')) tsw.innerHTML=btFrame_('tk');
      // ĐỒNG BỘ với bảng thường: cùng danh sách tầng `order` (kể cả tầng chưa có dòng — vừa thêm tầng là thấy ngay)
      if(!order.length){ tkSheetTrong_(); tkTongTien_(lines); return; }    // chưa có tầng lẫn dòng: khung trống + hướng dẫn
      tkSheetVe_(document.getElementById('tkSheet'), cols, order, groups);
      tkTongTien_(lines); return;
    }catch(e){ console.error(e); btSet_('tk',false); tkSheetGop_(false); tsw.innerHTML=''; toast('Bảng tính lỗi — chuyển về bảng cũ'); renderTable(); return; }
  }
  var totalW=cols.reduce(function(s,c){ return s+colW(c[0]); },0);
  /* "Vừa 1 màn hình": co cột theo tỉ lệ cho khít bề ngang khung -> hết kéo ngang, chỉ kéo dọc.
     Có SÀN bề rộng từng cột: bật quá nhiều cột thì co nữa chữ sẽ vỡ thành từng ký tự, nên
     khi tổng sàn vẫn vượt khung thì giữ px như cũ và nhắc người dùng ẩn bớt cột.        */
  var tkFit=(typeof tkFitOn_==='function') && tkFitOn_(), fitPc=null;
  if(tkFit){
    var wrapEl=document.querySelector('#tkNormal .tbl-wrap');
    var rong=(wrapEl?wrapEl.clientWidth:0)-2;
    if(rong>200){
      var san=cols.map(function(c){ return TK_MINW_[c[0]]||74; });
      var tongSan=san.reduce(function(a,b){ return a+b; },0);
      if(tongSan<=rong){                       // còn đủ chỗ cho mọi cột ở mức hẹp nhất
        var ty=rong/totalW;
        var w2=cols.map(function(c,i){ return Math.max(san[i], colW(c[0])*ty); });
        var t2=w2.reduce(function(a,b){ return a+b; },0);
        fitPc=w2.map(function(w){ return (w/t2*100).toFixed(3)+'%'; });   // chuẩn hoá -> luôn khít 100%
      } else { S._fitChat=cols.length; }        // quá nhiều cột -> báo 1 lần ở cuối hàm
    }
  }
  var colg='<colgroup>'+cols.map(function(c,i){
      return '<col style="width:'+(fitPc?fitPc[i]:(colW(c[0])+'px'))+'">'; }).join('')+'</colgroup>';
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
    var gsum=(groups[g]||[]).reduce(function(s,l){ return s+ttBan_(l); },0);   // cùng công thức Chi phí / Dự án / Báo giá
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
  t.style.width=fitPc?'100%':(totalW+'px');
  t.classList.toggle('tkfit-on', !!fitPc);
  S._fitOk=!!fitPc;
  if(tkFit && !fitPc && S._fitChat && S._fitChat!==S._fitChatBao){
    S._fitChatBao=S._fitChat;
    toast('Đang bật '+S._fitChat+' cột — nhiều quá nên chưa vừa 1 màn hình. Bấm "Cột hiển thị" tắt bớt cột (hoặc chọn bộ "Tối giản").');
  }
  if(fitPc) S._fitChatBao=null;
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
  tkTongTien_(lines);
}
// ----- Tổng tiền (chưa VAT / VAT / tổng thành tiền) -----
function tkTongTien_(lines){
  var sub=lines.reduce(function(s,l){ return s+ttBan_(l); },0);
  var vatPct=Number(S.cur&&S.cur.vat)||0;
  var vat=Math.round(sub*vatPct/100);
  var te=document.getElementById('tkTotals');
  if(te){
    // Tổng tiền = 1 dòng số liệu gọn ngay trên hàng Hạng mục đã bóc (không còn 3 hộp to)
    te.innerHTML='<div class="tkt-row">'
     +'<span class="tkt-i"><i>Chưa VAT</i><b>'+money(sub)+' đ</b></span>'
     +'<span class="tkt-i"><i>VAT <input class="tkt-vat" type="number" step="any" min="0" value="'+vatPct+'" onchange="setVat(this.value)" title="Thuế VAT (%)">%</i><b>'+money(vat)+' đ</b></span>'
     +'<span class="tkt-i grand"><i>Tổng</i><b>'+money(sub+vat)+' đ</b></span>'
     +'</div>';
  }
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
async function moveFloor(from,to,sau){          // sau=true: đặt SAU tầng đích (mặc định: trước)
  var fl=floorsList().filter(function(t){return t!=='CHƯA PHÂN TẦNG';}); var fi=fl.indexOf(from), ti=fl.indexOf(to); if(fi<0||ti<0||fi===ti)return;
  fl.splice(fi,1); ti=fl.indexOf(to); fl.splice(sau?ti+1:ti,0,from);
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
    if(S.selFloor===g) S.selFloor=name;
    if(S.collapsed&&S.collapsed[g]){ S.collapsed[name]=S.collapsed[g]; delete S.collapsed[g]; }
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

async function pickProduct(lineId,pi){
  var p=S.products[pi]; if(!p)return; closePop();
  await editLine(lineId,{ten:p.ten,thuongHieu:p.thuongHieu,ncc:p.ncc,maSP:p.ma,kichThuoc:p.kichThuoc,moTa:p.moTa,dvt:p.dvt||'Cái',donGiaVon:giaDongTuSP_(p).donGiaVon,donGiaBan:giaDongTuSP_(p).donGiaBan,hinhAnh:p.hinhAnh,loai:p.hangMuc,chietKhau:giaDongTuSP_(p).chietKhau});   // CK đại lý của SP mới — không giữ CK của SP cũ
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
  if(targetTr.classList.contains('grp')) return tkMoveLine_(dragId, targetTr.querySelector('td').dataset.f, null, before);
  return tkMoveLine_(dragId, targetTr.dataset.tang||'', targetTr.dataset.id, before);
}
// Chuyển 1 dòng tới trước/sau dòng targetId (hoặc cuối tầng floor khi targetId rỗng), lưu stt + tầng (bảng cũ & bảng tính dùng chung)
async function tkMoveLine_(dragId,floor,targetId,before){
  var di=S.lines.findIndex(function(l){return l.lineId===dragId;}); if(di<0) return;
  var dragged=S.lines[di];
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
  renderFloors(); veLaiSauSua_();          // vẽ lại cả tab đang mở (kéo dòng ở Dự án), không chỉ Bóc tách
  try{ await Promise.all(changed.map(function(l){ return api('updateLine', l.lineId, {stt:l.stt, tang:l.tang}); })); }
  catch(e){ toast('Lỗi lưu thứ tự: '+(e.message||e)); }
}
async function delLine(id){
  if(String(id).indexOf('tmp_')===0){             // dòng chưa lưu xong: đánh dấu, addProdObj xoá khi có id thật
    var t=lineOf_(id); if(t) t._del=1; S.lines=S.lines.filter(function(l){ return l.lineId!==id; });
    renderTree(); renderFloors(); veLaiSauSua_(); renderActGutter&&renderActGutter(); toast('Đã xoá'); return; }
  try{ await api('deleteLine',id); S.lines=S.lines.filter(function(l){return l.lineId!==id;}); renderTree(); renderFloors(); veLaiSauSua_(); renderActGutter&&renderActGutter(); toast('Đã xoá'); }
  catch(e){ toast('Lỗi xoá: '+e.message); }
}
// Nút xoá đặt NGOÀI bảng (gutter bên phải), đồng bộ vị trí theo cuộn dọc/ngang
function renderActGutter(){
  var inner=document.getElementById('actGutterInner'); if(!inner) return;
  var rows=document.querySelectorAll('#tkTable tr.drow');
  inner.innerHTML=[].map.call(rows,function(tr){ var id=tr.getAttribute('data-id');
    return '<button class="agx" data-id="'+id+'" title="Xoá dòng này" aria-label="Xoá dòng này" onclick="delLine(\''+id+'\')">'
      +'<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">'
      +'<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/></svg></button>'; }).join('');
  if(!S._agBound){ var wrap=document.querySelector('#tkNormal .tbl-wrap'); if(wrap){ wrap.addEventListener('scroll',syncActGutter,{passive:true}); window.addEventListener('resize',syncActGutter); S._agBound=1; } }
  bindActGutterHover_();
  syncActGutter();
  tkHBarInit_(); tkHBarSync_(); tkBarsWatch_(); tkBarsSync_();
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

function tkHBarSync_(){ hbarSync_('#tkNormal .tbl-wrap','tkHBar','tkHThumb'); }
/* ═══ ĐỒNG BỘ LẠI 3 THỨ BÁM MÉP BẢNG: thanh kéo ngang · thanh kéo dọc · nút xoá dòng ═══
   Ba thứ này định vị bằng JS theo bề ngang thật của bảng. Bề ngang đổi vì ĐỔI LỚP CSS
   (ẩn panel trái, gập khối đầu trang, vừa màn hình, toàn màn hình) thì trình duyệt KHÔNG
   bắn sự kiện resize -> trước đây chúng đứng nguyên chỗ cũ, thanh dọc nằm chình ình giữa
   bảng. Nay mọi thay đổi bố cục đều gọi hàm này, kèm ResizeObserver cho chắc.          */
function tkBarsSync_(){
  requestAnimationFrame(function(){
    try{ tkHBarSync_(); }catch(e){}
    try{ tkVBarSync_&&tkVBarSync_(); }catch(e){}
    try{ syncActGutter&&syncActGutter(); }catch(e){}
  });
}
function tkBarsWatch_(){
  if(S._barsRO || typeof ResizeObserver==='undefined') return;
  var w=document.querySelector('#tkNormal .tbl-wrap'), n=document.getElementById('tkNormal');
  if(!w||!n) return;
  S._barsRO=new ResizeObserver(function(){ tkBarsSync_(); });
  S._barsRO.observe(w); S._barsRO.observe(n);
}
function tkHBarInit_(){ hbarBind_('#tkNormal .tbl-wrap','tkHBar','tkHThumb'); tkVBarInit_&&tkVBarInit_(); }

function syncActGutter(){
  tkHBarSync_();   // đồng bộ luôn thanh kéo ngang (hàm này đã chạy mỗi khi cuộn bảng)
  tkVBarSync_&&tkVBarSync_();
  var norm=document.getElementById('tkNormal'), g=document.getElementById('actGutter'); if(!norm||!g) return;
  var wrap=norm.querySelector('.tbl-wrap'), t=document.getElementById('tkTable'); if(!wrap||!t) return;
  var nb=norm.getBoundingClientRect(), wr=wrap.getBoundingClientRect();
  var headH=(document.querySelector('#tkTable tr:first-child th')||{}).offsetHeight||46;
  var hsb = wrap.offsetHeight - wrap.clientHeight;   // chiều cao thanh cuộn ngang (đáy)
  /* Chỗ đứng của nút xoá:
     - bảng HẸP hơn khung  -> bám ngay mép phải của bảng (không hở một khoảng trống);
     - bảng RỘNG hơn khung -> ra hẳn NGOÀI khung (lề đã chừa sẵn), vì đứng ở mép trong
       là đè lên cột cuối cùng và chen với thanh cuộn dọc — chính chỗ nhìn rất xấu. */
  var tRight=t.getBoundingClientRect().right, trong=wr.left+wrap.clientWidth;
  var edge = (tRight <= trong-2) ? tRight : (wr.left + wrap.offsetWidth);
  // không để dãy nút tràn ra ngoài màn hình (màn hẹp: lề phải không đủ chỗ -> sinh thanh cuộn ngang cả trang)
  var gw=g.offsetWidth||30, xMax=window.innerWidth-gw-4;
  g.style.left=(Math.min(edge+2, xMax) - nb.left)+'px'; g.style.right='auto';
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

/* ---------- chọn nhiều dòng ---------- */
function tkSelHas_(id){ return !!(S._tkSel && S._tkSel[id]); }
function tkSelIds_(){ return Object.keys(S._tkSel||{}); }
function tkSelLines_(){ return tkSelIds_().map(lineOf_).filter(Boolean); }
function tkRowIdsOnScreen_(){
  var sel = bocVisible_() ? '#tkTable tr.drow'
    : (viewOn_('v-chiphi') ? '#v-chiphi table.cpflat tr.drow'
    : (viewOn_('v-duan') ? '#v-duan table.cpflat tr.drow' : '#tkTable tr.drow'));
  return [].map.call(document.querySelectorAll(sel),function(tr){ return tr.dataset.id; }).filter(Boolean);
}
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
  tkVeLaiBang_();
}
function tkClearSel(){ S._tkSel={}; S._tkAnchor=null; tkVeLaiBang_(); }
// Vẽ lại ĐÚNG bảng đang xem (Bóc tách / Chi phí / Dự án)
function tkVeLaiBang_(){
  if(bocVisible_()){ renderTable(); return; }
  if(viewOn_('v-chiphi')){ renderChiphi(); return; }
  if(viewOn_('v-duan')){ renderDuAn(); return; }
  renderTable();
}
function tkSelAllVisible_(){ S._tkSel=S._tkSel||{}; tkRowIdsOnScreen_().forEach(function(id){ S._tkSel[id]=1; }); tkVeLaiBang_(); }

var TK_RO_COL={stt:1,hinhAnh:1,nganh:1,giaDaiLy:1,donGiaCK:1,thanhTien:1};
// Trả về {fields} để cập nhật dòng l khi đặt giá trị raw vào cột k (null = cột chỉ đọc)
function tkFieldsFor_(l,k,raw){
  if(TK_RO_COL[k]) return null;
  if(k==='moTa'||k==='kichThuoc') { var o={}; o[k]=String(raw==null?'':raw); return o; }
  if(TXT_COL[k]){ var o2={}; o2[TXT_COL[k]]=String(raw==null?'':raw); return o2; }
  if(NUM_COL[k]){ var o3={}; o3[NUM_COL[k]]=tkNum_(raw); return o3; }
  if(k==='markup'||k==='margin'||k==='lnVnd'){
    if(String(raw==null?'':raw).trim()==='') return null;     // ô trống (xoá vùng / dán ô rỗng): không đặt giá bán = giá vốn
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
  if(ids.length>60 && !await xacNhan_('Thao tác này sửa '+ids.length+' dòng. Tiếp tục?')) return 0;
  ids.forEach(function(id){ var l=lineOf_(id); if(!l) return;
    Object.keys(byId[id]).forEach(function(k){ l[k]=byId[id][k]; }); recalcLine_(l,byId[id]); });
  veLaiSauSua_();
  var loi=0, maDA=S.cur&&S.cur.maDA;
  for(var i=0;i<ids.length;i+=6){
    await Promise.all(ids.slice(i,i+6).map(function(id){
      return api('updateLine',id,byId[id]).catch(function(){ loi++; }); }));
  }
  if(loi && S.cur && S.cur.maDA===maDA){ try{ S.lines=await api('getLines',maDA)||S.lines; veLaiSauSua_(); }catch(e){} }
  toast((nhan||'Đã cập nhật')+' · '+ids.length+' dòng'+(loi?(' · '+loi+' dòng lỗi'):''));
  return ids.length;
}

/* ---------- thanh thao tác hàng loạt của bảng bóc tách ---------- */
function tkBulkWrap_(){ var w=document.getElementById('tkBulkWrap');
  if(!w){ w=document.createElement('div'); w.id='tkBulkWrap'; document.body.appendChild(w); } return w; }
/* Bảng nào đang xem dòng của dự án thì thanh chọn dòng dùng được ở đó:
   Bóc tách · Chi phí · Dự án đều sửa chung S.lines nên dùng chung một thanh. */
function tkBangDong_(){ return bocVisible_() || viewOn_('v-chiphi') || viewOn_('v-duan'); }
function tkSelBar_(){
  var w=tkBulkWrap_(), n=tkSelIds_().length;
  if(!n || !tkBangDong_()){ w.innerHTML=''; tkPopClose_(); return; }
  var tien=tkSelLines_().reduce(function(s,l){ return s+ttBan_(l); },0);
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
    +(fl.length?fl.map(function(f){ return '<button onclick="tkBulkFloor_(\''+escJs_(f)+'\')">'+icon('layers',15)+esc(f)+'</button>'; }).join('')
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
function tkBulkLn_(v){ v=pctIn_(v);
  if(v==null){ toast('Chưa nhập % lợi nhuận'); return; }
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
    var v=cellSortVal_(l,c[0]); return v==null?'':String(v); }).join('\t'); });
  ctxCopy_([head].concat(rows).join('\n'));
  toast('Đã sao chép '+rows.length+' dòng');
}
async function tkBulkDup_(){
  var ls=tkSelLines_(); if(!ls.length||!S.cur) return;
  if(!await xacNhan_('Nhân bản '+ls.length+' dòng đã chọn?')) return;
  var loi=0;
  for(var i=0;i<ls.length;i++){
    var prod=Object.assign({},ls[i],{ma:ls[i].maSP}); delete prod.lineId; delete prod.recordId;   // server đọc product.ma
    try{ var nl=await api('addLine', S.cur.maDA, prod, Number(ls[i].soLuong)||1); S.lines.push(nl); }
    catch(e){ loi++; }
  }
  tkClearSel(); veLaiSauSua_();
  toast('Đã nhân bản '+(ls.length-loi)+' dòng'+(loi?(' · '+loi+' lỗi'):''));
}
async function tkBulkDel_(){
  var ids=tkSelIds_(); if(!ids.length) return;
  if(!await xacNhan_('Xoá '+ids.length+' dòng đã chọn? Không hoàn tác được.')) return;
  var loi=0, xong={};
  for(var i=0;i<ids.length;i+=5){
    await Promise.all(ids.slice(i,i+5).map(function(id){
      return api('deleteLine',id).then(function(){ xong[id]=1; }, function(){ loi++; }); }));
  }
  S.lines=S.lines.filter(function(l){ return !xong[l.lineId]; });
  S._tkSel={}; veLaiSauSua_(); renderActGutter&&renderActGutter();
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
/* ═══ TOÀN MÀN HÌNH · VỪA 1 MÀN HÌNH cho bảng bóc tách / dự toán ═══
   · Toàn màn hình: ẩn thanh trên · băng dự án · panel trái, bảng chiếm trọn màn hình.
     Dùng luôn Fullscreen API của trình duyệt nếu cho phép (ẩn cả thanh tab).
   · Vừa 1 màn hình: cột co theo tỉ lệ cho vừa bề ngang -> HẾT kéo ngang, chỉ kéo dọc.
   Cả hai nhớ theo máy.                                                              */
function tkFullOn_(){ return document.body.classList.contains('tkfull'); }
function tkFitOn_(){ return document.body.classList.contains('tkfit'); }
function tkFullToggle_(on){
  on=(on==null)?!tkFullOn_():!!on;
  document.body.classList.toggle('tkfull', on);
  try{ localStorage.setItem('qs_tkfull', on?'1':'0'); }catch(e){}
  if(on){ try{ if(document.documentElement.requestFullscreen) document.documentElement.requestFullscreen(); }catch(e){} }
  else { try{ if(document.fullscreenElement && document.exitFullscreen) document.exitFullscreen(); }catch(e){} }
  tkFullBtn_();
  try{ renderTable&&renderTable(); }catch(e){}
  tkBarsSync_(); setTimeout(tkBarsSync_,60);
  qbRightSync_&&qbRightSync_();
}
function tkFitToggle_(on){
  on=(on==null)?!tkFitOn_():!!on;
  document.body.classList.toggle('tkfit', on);
  try{ localStorage.setItem('qs_tkfit', on?'1':'0'); }catch(e){}
  try{ renderTable&&renderTable(); }catch(e){}
  tkBarsSync_(); setTimeout(tkBarsSync_,60);
  qbRightSync_&&qbRightSync_();
  // không vừa được (bật quá nhiều cột) thì renderTable đã tự nhắc ẩn bớt cột -> đừng báo nhầm là đã vừa
  if(!on) toast('Bảng trở lại bề rộng cột đã đặt');
  else if(S._fitOk) toast('Bảng co vừa bề ngang màn hình — chỉ còn kéo dọc');
}
// nút thoát nổi khi đang toàn màn hình
function tkFullBtn_(){
  var b=document.getElementById('tkFullX');
  if(!b){ b=document.createElement('button'); b.id='tkFullX'; b.className='tkfull-x';
    b.innerHTML=icon('close',14)+'<span>Thoát toàn màn hình (Esc)</span>';
    b.onclick=function(){ tkFullToggle_(false); }; document.body.appendChild(b); }
}
document.addEventListener('keydown',function(e){
  if(e.key==='Escape' && tkFullOn_() && !document.querySelector('.sp-modal-ov,.fltpop')) tkFullToggle_(false);
});
document.addEventListener('fullscreenchange',function(){    // thoát bằng F11 / nút của trình duyệt
  if(!document.fullscreenElement && tkFullOn_()) tkFullToggle_(false);
});
function tkViewInit_(){
  try{
    if(localStorage.getItem('qs_tkfit')==='1') document.body.classList.add('tkfit');
  }catch(e){}
  tkFullBtn_();
}
function tkZenToggle(){ foldAll_(); }
/* ═══ THU GỌN TỪNG KHỐI ĐỂ MỞ RỘNG BẢNG ═══
   Khối nào phía trên bảng cũng gập được: băng dự án · tổng tiền · chip cột. Nhớ theo máy (qs_fold).
   Nút ⤢ "Mở rộng bảng" (thanh công cụ nhanh / đầu bảng) gập tất cả một lần; bấm lại mở lại như trước. */
var FOLD_KEYS=['pcard','totals','tools','cols'];       // các khối bật/tắt được bằng chip ở hàng Hạng mục
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
  foldChipsSync_();
  tkBarsSync_(); setTimeout(tkBarsSync_,60);      // gập/mở khối đầu trang -> bảng đổi bề ngang & cao
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
    // bấm nút thao tác (đặt % lợi nhuận, biên mục tiêu, hộp thoại) thì GIỮ vùng đang chọn để thao tác áp đúng vùng
    if(!pos){ if(!e.target.closest||!e.target.closest('.rng-badge,.cp-lnq,.cp-acts,.sp-modal-ov')) rngClear_(); return; }
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
  repl:'<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="10" cy="10" r="6"/><path d="M20 20l-5.6-5.6M8 10h4"/></svg>',
  gia:'<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-2.6-6.4"/><path d="M21 3v5h-5"/><path d="M12 8v8M9.5 10.5h4a1.5 1.5 0 0 1 0 3h-3a1.5 1.5 0 0 0 0 3h4"/></svg>',
  fit:'<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7v10M20 7v10"/><path d="M8 12h8M8 12l2.5-2.5M8 12l2.5 2.5M16 12l-2.5-2.5M16 12l-2.5 2.5"/></svg>',
  full:'<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9V4h5M21 9V4h-5M3 15v5h5M21 15v5h-5"/></svg>'
};
function giaLechN_(){ try{ var n=giaLechList_().length; return n?String(n):''; }catch(e){ return ''; } }
function giaSyncTitle_(){
  var n=giaLechN_();
  return n?(n+' dòng đang lệch giá so với Danh sách sản phẩm — bấm để cập nhật')
          :'Cập nhật giá dòng theo Danh sách sản phẩm (đang khớp hết)';
}
/* ═══ DÒNG ĐANG DÙNG BẢN CŨ CỦA SẢN PHẨM ═══
   Dòng trong bảng là BẢN CHỤP lúc thêm (giá, tên, mô tả, ảnh…), sửa sản phẩm trong
   Danh sách SP không tự đổi dòng đã bóc — đúng ý đồ để báo giá đã chốt không tự nhảy số.
   Nhưng phải cho người dùng BIẾT và bấm cập nhật được: mỗi dòng lệch có dấu ⟳ ngay ở
   cột Tên sản phẩm, bấm vào ra bảng so sánh cũ → mới, tích trường nào thì cập nhật nấy. */
var _spMaMap=null, _spMaMapSrc=null;
function spMaMap_(){
  if(_spMaMap && _spMaMapSrc===S.products) return _spMaMap;
  var m={}; (S.products||[]).forEach(function(p){
    var k=String(p.ma||'').trim().toLowerCase(); if(!k) return;
    (m[k]=m[k]||[]).push(p);
  });
  _spMaMap=m; _spMaMapSrc=S.products; return m;
}
function spOfLine_(l){
  var ds=spMaMap_()[String((l&&l.maSP)||'').trim().toLowerCase()];
  if(!ds||!ds.length) return null;
  if(ds.length===1) return ds[0];
  var ten=spNorm_(l.ten||'');
  return ds.filter(function(p){ return spNorm_(p.ten||'')===ten; })[0] || ds[0];
}
/* Trường so sánh giữa dòng và sản phẩm trong danh mục: [khoá dòng, nhãn, lấy từ SP, kiểu] */
var LN_SYNC_F=[
  ['donGiaVon','Giá bán lẻ (niêm yết)', function(p){ return Math.round(giaDongTuSP_(p).donGiaVon); }, 'money'],
  ['chietKhau','CK đại lý (%)', function(p){ return giaDongTuSP_(p).chietKhau; }, 'pct'],
  ['ten','Tên sản phẩm', function(p){ return String(p.ten||''); }, 'text'],
  ['thuongHieu','Thương hiệu', function(p){ return String(p.thuongHieu||''); }, 'text'],
  ['ncc','Nhà cung cấp', function(p){ return String(p.ncc||''); }, 'text'],
  ['moTa','Thông tin chính', function(p){ return String(p.moTa||''); }, 'text'],
  ['kichThuoc','Thông số thiết kế', function(p){ return String(p.kichThuoc||''); }, 'text'],
  ['dvt','Đơn vị tính', function(p){ return String(p.dvt||''); }, 'text'],
  ['hinhAnh','Hình ảnh', function(p){ return String(p.hinhAnh||''); }, 'img']
];
function lnDiff_(l){
  var p=spOfLine_(l); if(!p) return null;
  var ds=[];
  LN_SYNC_F.forEach(function(f){
    var moi=f[2](p);
    var cu=(f[3]==='money')?Math.round(Number(l[f[0]])||0):(f[3]==='pct'?(Number(l[f[0]])||0):String(l[f[0]]==null?'':l[f[0]]));
    if(f[3]==='money'){ if(!moi || cu===moi) return; }
    else if(f[3]==='pct'){ if(cu===moi) return; }
    else { if(String(cu).trim()===String(moi).trim()) return; if(!String(moi).trim()) return; }  // SP để trống thì không ghi đè
    ds.push({k:f[0], lb:f[1], cu:cu, moi:moi, kieu:f[3]});
  });
  return ds.length?{p:p, ds:ds}:null;
}
function lnDiffChip_(l){
  var d=lnDiff_(l); if(!d) return '';
  var coGia=d.ds.some(function(x){ return x.k==='donGiaVon'; });
  // ĐỎ = giá vốn đã đổi (ảnh hưởng tiền) · VÀNG = chỉ đổi thông tin (tên, thông số, ảnh…)
  var tip=(coGia?'GIÁ VỐN đã đổi trong danh mục':'Thông tin sản phẩm đã đổi trong danh mục')
    +' ('+d.ds.map(function(x){ return x.lb; }).join(', ')+') — bấm để xem và cập nhật dòng này';
  return '<button class="ln-upd" title="'+esc(tip)+'"'    // một màu vàng cho mọi thay đổi; tooltip nói rõ có phải giá vốn không
    +' onclick="event.stopPropagation();lnUpdPop_(event,\''+l.lineId+'\')">'
    +'<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-2.6-6.4"/><path d="M21 3v5h-5"/></svg>'
    +'</button>';                                  // chỉ icon cho gọn — nội dung đã ghi đủ trong tooltip
}
function lnUpdClose_(){ var e=document.getElementById('lnUpdPop'); if(e) e.remove();
  document.removeEventListener('mousedown',lnUpdOutside_); }
function lnUpdOutside_(e){ if(e.target.closest&&e.target.closest('#lnUpdPop')) return; lnUpdClose_(); }
function lnUpdPop_(e, lineId){
  if(e&&e.stopPropagation) e.stopPropagation();
  if(document.getElementById('lnUpdPop')){ lnUpdClose_(); return; }
  var l=(S.lines||[]).filter(function(x){ return String(x.lineId)===String(lineId); })[0]; if(!l) return;
  var d=lnDiff_(l); if(!d){ toast('Dòng này đã khớp với danh mục'); return; }
  function ve(v,kieu){
    if(kieu==='money') return money(v)+' đ';
    if(kieu==='pct') return String(Number(v)||0).replace('.',',')+'%';
    if(kieu==='img') return v?('<img class="lnu-img" src="'+esc(imgSrc1_(v))+'" onerror="this.style.visibility=\'hidden\'">'):'<i>—</i>';
    var t=String(v||'').trim(); return t?esc(t).replace(/\n/g,'<br>'):'<i>—</i>';
  }
  var pop=document.createElement('div'); pop.className='fltpop lnupd'; pop.id='lnUpdPop';
  pop.innerHTML='<div class="bgt-h"><b>Sản phẩm đã được cập nhật</b>'
      +'<button class="colpop-x" onclick="lnUpdClose_()">✕</button></div>'
    +'<div class="lnu-sub">'+esc(d.p.ten||'')+(d.p.ma?(' · '+esc(d.p.ma)):'')+' — chọn phần muốn đưa vào dòng đang bóc</div>'
    +'<div class="lnu-b">'+d.ds.map(function(x,i){
        return '<label class="lnu-i"><input type="checkbox" checked data-k="'+esc(x.k)+'">'
          +'<div class="lnu-c"><div class="lnu-lb">'+esc(x.lb)+'</div>'
          +'<div class="lnu-v"><span class="cu">'+ve(x.cu,x.kieu)+'</span>'
          +'<span class="ar">→</span><span class="moi">'+ve(x.moi,x.kieu)+'</span></div></div></label>';
      }).join('')+'</div>'
    +'<div class="lnu-f"><button class="btn ghost sm" onclick="lnUpdClose_()">Giữ nguyên</button>'
      +'<button class="btn blue sm" onclick="lnUpdApply_(\''+escJs_(String(lineId))+'\')">'+icon('check',14)+' Cập nhật dòng này</button></div>';
  document.body.appendChild(pop);
  var b=e&&e.currentTarget;
  if(b&&b.getBoundingClientRect){ var r=b.getBoundingClientRect(), w=pop.offsetWidth||360, h=pop.offsetHeight;
    var top=r.bottom+6; if(top+h>window.innerHeight-10) top=Math.max(10, r.top-h-6);
    pop.style.top=top+'px'; pop.style.left=Math.max(8,Math.min(r.left, window.innerWidth-w-10))+'px'; }
  setTimeout(function(){ document.addEventListener('mousedown',lnUpdOutside_); },0);
}
async function lnUpdApply_(lineId){
  var pop=document.getElementById('lnUpdPop'); if(!pop) return;
  var l=(S.lines||[]).filter(function(x){ return String(x.lineId)===String(lineId); })[0]; if(!l) return;
  var d=lnDiff_(l); if(!d){ lnUpdClose_(); return; }
  var chon={}; pop.querySelectorAll('input[type=checkbox]').forEach(function(c){ if(c.checked) chon[c.getAttribute('data-k')]=1; });
  var patch={}; d.ds.forEach(function(x){ if(chon[x.k]) patch[x.k]=x.moi; });
  if(!Object.keys(patch).length){ toast('Chưa chọn phần nào để cập nhật'); return; }
  lnUpdClose_();
  try{
    var r=await api('updateLine', lineId, patch);
    var j=S.lines.indexOf(l);
    if(r&&j>=0) S.lines[j]=r; else Object.assign(l, patch);
    refreshActiveTab_();
    try{ renderTable&&renderTable(); renderCard&&renderCard(); }catch(e){}
    toast('Đã cập nhật '+Object.keys(patch).length+' mục cho dòng "'+(patch.ten||l.ten||'')+'"');
  }catch(e){ toast('Lỗi cập nhật: '+e.message); }
}
/* ═══ CẬP NHẬT GIÁ DÒNG THEO DANH MỤC ═══
   Dòng trong bảng bóc tách là BẢN CHỤP giá lúc thêm — sửa giá ở Danh sách SP không tự
   đổi dòng đã bóc (để báo giá đã chốt không tự nhảy số). Nút này đối chiếu theo mã SP
   rồi cập nhật những dòng lệch giá, giữ nguyên %lợi nhuận đang đặt của từng dòng.   */
function giaSpCuaDong_(l){
  var ma=String(l.maSP||'').trim().toLowerCase(); if(!ma) return null;
  var ds=(S.products||[]).filter(function(p){ return String(p.ma||'').trim().toLowerCase()===ma; });
  if(!ds.length) return null;
  if(ds.length>1){                                   // nhiều biến thể cùng mã -> khớp thêm theo tên
    var ten=spNorm_(l.ten||'');
    ds = ds.filter(function(p){ return spNorm_(p.ten||'')===ten; }).concat(ds);
  }
  var g=giaDongTuSP_(ds[0]), von=Math.round(g.donGiaVon);
  return von?{p:ds[0], von:von, ck:g.chietKhau}:null;
}
function giaLechList_(){
  return (S.lines||[]).map(function(l){
    var g=giaSpCuaDong_(l); if(!g) return null;
    if(Math.round(Number(l.donGiaVon)||0)===g.von && (Number(l.chietKhau)||0)===g.ck) return null;
    return {l:l, von:g.von, ck:g.ck, cu:Math.round(Number(l.donGiaVon)||0)};
  }).filter(Boolean);
}
/* Bảng xác nhận cập nhật giá — thay hộp thoại confirm() của trình duyệt: xem được ĐẦY ĐỦ
   danh sách dòng lệch, giá cũ → giá mới, bỏ tích dòng nào thì dòng đó giữ nguyên. */
function giaSyncRun_(){
  if(!S.cur){ toast('Chưa chọn dự án'); return; }
  if(document.getElementById('giaSyncOv')) return;
  var ds=giaLechList_();
  if(!ds.length){ toast('Mọi dòng trong dự án đã khớp giá danh mục'); return; }
  S._giaSyncDs=ds;
  var ov=document.createElement('div'); ov.className='sp-modal-ov'; ov.id='giaSyncOv';
  ov.onclick=function(e){ if(e.target===ov) giaSyncClose_(); };
  ov.innerHTML='<div class="sp-modal gsx">'
    +'<div class="pd-head"><h3>Cập nhật giá theo Danh sách sản phẩm</h3>'
      +'<span class="gsx-n">'+ds.length+' dòng lệch giá</span>'
      +'<button class="pd-x" onclick="giaSyncClose_()">✕</button></div>'
    +'<div class="gsx-note">'+icon('clock',14)+'<span>Dòng trong bảng là <b>bản chụp giá lúc thêm</b>. '
      +'Cập nhật sẽ lấy giá vốn mới từ danh mục, <b>giữ nguyên %lợi nhuận</b> của từng dòng nên giá bán tính lại theo đó.</span></div>'
    +'<div class="gsx-b">'+ds.map(function(x,i){
        var phu=[x.l.tang, x.l.khuVuc, x.l.maSP].map(function(t){ return String(t||'').trim(); }).filter(Boolean).join(' · ');
        return '<label class="gsx-i"><input type="checkbox" checked data-i="'+i+'" onchange="giaSyncSync_()">'
          +'<div class="gsx-c"><div class="gsx-nm">'+esc(x.l.ten||'(không tên)')+'</div>'
          +(phu?'<div class="gsx-sub">'+esc(phu)+'</div>':'')+'</div>'
          +'<div class="gsx-v"><span class="cu">'+money(x.cu)+'</span><span class="ar">→</span>'
          +'<span class="moi">'+money(x.von)+'</span></div></label>';
      }).join('')+'</div>'
    +'<div class="gsx-f">'
      +'<button class="btn ghost sm" onclick="giaSyncAll_(1)">Chọn tất cả</button>'
      +'<button class="btn ghost sm" onclick="giaSyncAll_(0)">Bỏ chọn</button>'
      +'<span style="flex:1"></span>'
      +'<button class="btn ghost sm" onclick="giaSyncClose_()">Giữ nguyên</button>'
      +'<button class="btn blue" id="gsxOk" onclick="giaSyncApply_(this)">'+icon('check',15)+' Cập nhật '+ds.length+' dòng</button>'
    +'</div></div>';
  document.body.appendChild(ov);
  document.addEventListener('keydown', giaSyncKey_);
}
function giaSyncClose_(){ var e=document.getElementById('giaSyncOv'); if(e) e.remove();
  S._giaSyncDs=null; document.removeEventListener('keydown', giaSyncKey_); }
function giaSyncKey_(e){ if(e.key==='Escape') giaSyncClose_(); }
function giaSyncChon_(){ return [].slice.call(document.querySelectorAll('#giaSyncOv input[type=checkbox]:checked'))
  .map(function(c){ return (S._giaSyncDs||[])[+c.getAttribute('data-i')]; }).filter(Boolean); }
function giaSyncSync_(){
  var n=giaSyncChon_().length, b=document.getElementById('gsxOk'); if(!b) return;
  b.disabled=!n; b.innerHTML=icon('check',15)+' Cập nhật '+n+' dòng';
}
function giaSyncAll_(on){
  document.querySelectorAll('#giaSyncOv input[type=checkbox]').forEach(function(c){ c.checked=!!on; });
  giaSyncSync_();
}
async function giaSyncApply_(btn){
  var ds=giaSyncChon_(); if(!ds.length){ toast('Chưa chọn dòng nào'); return; }
  if(btn){ btn.disabled=true; btn.textContent='Đang cập nhật 0/'+ds.length+'…'; }
  var ok=0, loi=0;
  for(var i=0;i<ds.length;i++){
    try{
      var r=await api('updateLine', ds[i].l.lineId, { donGiaVon: ds[i].von, chietKhau: ds[i].ck });
      var j=S.lines.indexOf(ds[i].l);
      if(r&&j>=0) S.lines[j]=r; else { ds[i].l.donGiaVon=ds[i].von; ds[i].l.chietKhau=ds[i].ck; }
      ok++;
    }catch(e){ loi++; }
    if(btn) btn.textContent='Đang cập nhật '+(i+1)+'/'+ds.length+'…';
  }
  giaSyncClose_();
  refreshActiveTab_();
  try{ renderTable&&renderTable(); renderCard&&renderCard(); }catch(e){}
  toast('Đã cập nhật giá '+ok+' dòng'+(loi?(' · '+loi+' dòng lỗi'):''));
}
function qbRender_(){
  var el=document.getElementById('qbar'); if(!el) return;
  if(document.activeElement && document.activeElement.id==='qbQ') { qbRightSync_(); qbRecentSync_(); return; }   // đang gõ: không vẽ lại ô tìm
  var find='<div class="qb-find">'+icon('search',15)
      +'<input id="qbQ" placeholder="Tìm sản phẩm, công tác, dòng trong bảng, hạng mục…" autocomplete="off" spellcheck="false"'
      +' oninput="qbSearch_(this.value)" onfocus="qbSearch_(this.value)" onkeydown="qbKey_(event)">'
      +'<kbd>'+(/Mac/i.test(navigator.platform||'')?'⌘':'Ctrl')+' K</kbd></div>';
  // Bóc tách: ô tìm nhanh nằm trên băng dự án, kế mã dự án (#pcFind); tab khác: trong thanh công cụ nhanh như cũ
  var pf=document.getElementById('pcFind'), tren=!!pf && qbTab_()==='boc';
  if(pf) pf.innerHTML=tren?find:'';
  el.innerHTML='<div class="qb-recent" id="qbRecent"></div>'
    +(tren?'':find)
    +'<div class="qb-right" id="qbRight"></div>';
  qbRecentSync_(); qbRightSync_();
}
function qbRecentSync_(){
  var box=document.getElementById('qbRecent'); if(!box) return;
  var v=qbRecent_().filter(function(c){ return TREE.some(function(t){ return t[0]===c; }) || customGroups().indexOf(c)>=0; });
  var cur=(qbTab_()==='boc')?S.node:hmGet_();
  if(cur && v.indexOf(cur)<0) v.unshift(cur);
  box.innerHTML='<span class="qb-lbl" title="Hạng mục gần đây — bấm để chuyển">'+icon('clock',14)+'</span>'
    +(v.length?v.slice(0,QB_RECENT_N).map(function(c){
      var on=(c===cur), n=(typeof nodeCount==='function')?nodeCount(c):0;
      return '<button class="qb-chip'+(on?' on':'')+'" title="'+esc(c+'. '+nodeName(c))+'" onclick="qbGoNode_(\''+escJs_(c)+'\')">'
        +'<span class="qb-cc">'+esc(c)+'</span>'+esc(nodeName(c))+(n?'<i>'+n+'</i>':'')+'</button>';
    }).join(''):'<span class="qb-empty">Chưa có hạng mục gần đây</span>');
}
function qbRightSync_(){
  var box=document.getElementById('qbRight'); if(!box) return;
  var nf=(typeof activeFiltCount_==='function')?activeFiltCount_():0;
  var side=(typeof sideGet_==='function')&&sideGet_(), zen=(typeof foldAllOn_==='function')&&foldAllOn_();
  if(qbTab_()!=='boc'){                 // Chi phí / Dự án / Mua hàng: nút công cụ đã nằm trong khối "Công cụ bảng"
    box.innerHTML='<button class="qb-exp" onclick="showTab(\'export\')" title="Sang tab Xuất báo giá">'+icon('download',14)+' Xuất báo giá</button>';
    foldChipsSync_();
    return;
  }
  // Bóc tách: các nút công cụ đã gom xuống khối "Công cụ bảng" ngay trên bảng -> thanh trên chỉ còn ô tìm + Xuất báo giá
  box.innerHTML='<button class="qb-exp" onclick="showTab(\'export\')" title="Sang tab Xuất báo giá">'+icon('download',14)+' Xuất báo giá</button>';
  tkToolsSync_();
}
/* ═══ KHỐI "CÔNG CỤ BẢNG" (tab Bóc tách) ═══
   Trước đây các nút lọc / tìm / hiển thị nằm rải trên thanh công cụ chung và trùng với
   nút bên panel trái. Nay gom vào 1 khối ngay trên bảng, chia 3 nhóm rõ ràng:
   LỌC SẢN PHẨM · SỬA BẢNG · HIỂN THỊ.                                            */
function tkToolsSync_(){
  var box=document.getElementById('tkToolRow'); if(!box) return;
  var nf=(typeof activeFiltCount_==='function')?activeFiltCount_():0;
  var side=(typeof sideGet_==='function')&&sideGet_(), zen=(typeof foldAllOn_==='function')&&foldAllOn_();
  // Yêu thích LUÔN có trên thanh công cụ (panel trái đang mở hay đã thu gọn đều bấm được); lọc bảng = nút ▾ ở tiêu đề cột
  var g1 = '<span class="tk-tgrp">'
      +qbBtn_('qbFav',icon('star',16),S.fFav?'Đang chỉ hiện sản phẩm yêu thích — bấm để bỏ':'Chỉ hiện sản phẩm yêu thích','catFavToggle();qbRightSync_()',!!S.fFav)
    +'</span><span class="tk-tsep"></span>';
  box.innerHTML=g1
    +'<span class="tk-tgrp">'                                  // nhóm 1: nội dung bảng
    +qbBtn_('qbHist',QB_IC.hist,'Vừa thêm vào bảng — xem lại / thêm lại','qbHistPop_(event)',false)
    +qbBtn_('qbRepl',QB_IC.repl,'Tìm & thay trong bảng (Ctrl+F)','openFindReplace()',false)
    +qbBtn_('qbGia',QB_IC.gia,giaSyncTitle_(),'giaSyncRun_()',false,giaLechN_())
    +'</span><span class="tk-tsep"></span><span class="tk-tgrp">'   // nhóm 2: cách hiển thị bảng
    +qbBtn_('qbFit',QB_IC.fit,tkFitOn_()?'Đang co cột vừa khung — bấm để trả về bề rộng đã đặt (có kéo ngang)':'Co cột cho vừa bề ngang khung, hết kéo ngang','tkFitToggle_()',tkFitOn_())
    +qbBtn_('qbFull',QB_IC.full,tkFullOn_()?'Thoát toàn màn hình (Esc)':'Chỉ còn bảng, chiếm cả màn hình','tkFullToggle_()',tkFullOn_())
    +'</span>';
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
