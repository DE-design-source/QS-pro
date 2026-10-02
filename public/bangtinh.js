/* ═══ CHẾ ĐỘ BẢNG TÍNH (Jspreadsheet CE, MIT) — giao diện kiểu Google Sheets cho Phần thô ('pt'), bảng sản phẩm
   Bóc tách ('tk'), Chi phí ('cp'), Dự án ('da'). Chỉ là LỚP HIỂN THỊ: đọc dữ liệu đang có, ghi bằng đúng hàm sửa
   của bảng cũ (ptEdit / editLine / tkApplyEdits_), nên mọi quy tắc tính & lưu giữ nguyên.
   Bảng cũ chỉ còn làm dự phòng khi lưới lỗi.
   Lưu ý: khung #{k}Sheet giữ nguyên qua các lần dựng lại lưới -> sự kiện gắn vào khung chỉ gắn 1 lần (cờ _btNghe/_tkKeo). ═══ */
'use strict';

/* 2 chế độ người dùng tự chọn (công tắc "Bảng tính | Bảng thường", nhớ theo máy, chung cho mọi bảng):
   bảng tính (mặc định) hoặc bảng thường (bảng cũ). Lưới lỗi thì tự về bảng thường tới lúc tải lại trang. */
function btCheDo_(){ try{ return localStorage.getItem('qs_bt_mode')==='cu'?'cu':'moi'; }catch(e){ return 'moi'; } }
function btOn_(k){ return !(S._btLoi && S._btLoi[k]) && btCheDo_()!=='cu'; }
function btCheDoNut_(){ var m=btCheDo_();
  return '<div class="bt-mode" title="Chọn kiểu bảng — máy sẽ nhớ">'
    +'<button class="'+(m==='moi'?'on':'')+'" onclick="btCheDoDat_(\'moi\')">'+btI_('freeze')+'Bảng tính</button>'
    +'<button class="'+(m==='cu'?'on':'')+'" onclick="btCheDoDat_(\'cu\')">'+icon('list',15)+'Bảng thường</button></div>'; }
function btCheDoDat_(v){
  try{ localStorage.setItem('qs_bt_mode',v); }catch(e){}
  S._btLoi={}; ['tk','cp','da','pt'].forEach(function(k){ var B=btCtx_(k); B.ws=null; B.frame=null; B.sig=''; });
  tkSheetGop_(false);                       // trả hàng nút "Công cụ bảng" về chỗ cũ TRƯỚC khi xoá khung (nó đang nằm trong khung)
  var tsw=document.getElementById('tkSheetWrap'); if(tsw) tsw.innerHTML='';
  renderTable(); if(typeof refreshActiveTab_==='function') refreshActiveTab_();
  toast(v==='cu'?'Đã chuyển sang Bảng thường':'Đã chuyển sang Bảng tính');
}
function btSet_(k,on){ S._btLoi=S._btLoi||{}; S._btLoi[k]=!on; }
function btSan_(){ return typeof jspreadsheet==='function'; }            // thư viện nạp được chưa
function btVeLai_(k){ var B=btCtx_(k); B.ws=null; if(k==='cp'||k==='da') B.frame=null; btVe_(k); }   // dựng lại hẳn lưới (+ khung)
function btVe_(k){ if(k==='pt') renderPhanTho(); else if(k==='cp') renderChiphi(); else if(k==='da') renderDuAn(); else renderTable(); }   // vẽ lại bình thường

// Số hiển thị trong ô: 1.234.567 (kiểu VN, như cả app) · % một số lẻ · trống khi 0
function btMoney_(v){ v=Math.round(Number(v)||0); return v?money(v):''; }
function btPct_(v){ v=Number(v)||0; return v?(v.toFixed(1).replace('.',',')+'%'):''; }
function btQty_(v){ v=Number(v)||0; return v?ptQty(v):''; }

/* Ngữ cảnh mỗi bảng: ws, cols, meta (dòng nào là nhóm / dòng dữ liệu), cột căn số, tuỳ chọn hiển thị */
function btCtx_(k){ S._bt=S._bt||{}; return S._bt[k]=S._bt[k]||{zoom:100, font:13, loc:false, frz:true, gon:btGonNho_()}; }
/* Gọn = mỗi dòng 1 hàng chữ (chữ dài cắt bằng …, rê chuột xem đủ) -> 1 màn thấy gấp 3 số dòng. Nhớ theo máy. */
function btGonNho_(){ try{ return localStorage.getItem('qs_bt_gon')!=='0'; }catch(e){ return true; } }
function btGon_(k){ var B=btCtx_(k); B.gon=!B.gon; try{ localStorage.setItem('qs_bt_gon',B.gon?'1':'0'); }catch(e){}
  var h=document.getElementById(k+'Sheet'); if(h) h.classList.toggle('gs-gon',B.gon);
  var bt=h&&h.parentNode.querySelector('.gs-gonb'); if(bt){ bt.classList.toggle('on',!B.gon); bt.innerHTML=btGonNhan_(B.gon); } }
function btGonNhan_(gon){ return btI_('wrap')+'<span>'+(gon?'Đủ chữ':'Gọn')+'</span>'; }
function btSong_(k){ var B=btCtx_(k); return !!(B.ws && document.body.contains(B.ws.element)); }
// Dựng lưới chung: opt.columns + opt.data + opt.style + opt.frz (số cột cố định); ghi(x,y,val) ghi 1 ô vào dữ liệu
function btTao_(k, host, cols, meta, al, opt, ghi, ro, noiBo){
  var B=btCtx_(k); host.innerHTML='';
  B.cols=cols; B.meta=meta; B.al=al; B.ghi=ghi;
  B.sel=B.selR=null;              // lưới mới chưa chọn ô nào — giữ vùng chọn cũ thì "Xoá dòng" xoá nhầm dòng ở vị trí cũ
  var ws=jspreadsheet(host,{
    tabs:false, toolbar:false,
    parseFormulas:false,          // app lưu chữ thô, không lưu công thức -> ô bắt đầu bằng "=" hiện đúng chữ, không ra #ERROR
    worksheets:[{
      data:opt.data, style:opt.style, mergeCells:opt.merge||{}, wordWrap:true, tableOverflow:true, tableHeight:opt.h||'calc(100vh - 290px)', tableWidth:'100%',
      freezeColumns:0, columnResize:false, allowInsertRow:false, allowInsertColumn:false, allowDeleteRow:false,
      allowDeleteColumn:false, allowRenameColumn:false, columnSorting:false, filters:!!B.loc,
      nestedHeaders:[cols.map(function(c,i){ return {title:btColLetter_(i)}; })],
      columns:opt.columns
    }],
    onchange:function(inst,cell,x,y,val,old){
      if(B.busy || String(val)===String(old)) return;
      ghi(+x,+y,val);
    },
    // Hoàn tác / làm lại: thư viện đổi ô nhưng không gọi onchange -> tự ghi giá trị cũ / mới vào dữ liệu
    onundo:function(inst,h){ ((h&&h.records)||[]).forEach(function(r){ ghi(r.x,r.y,r.oldValue); }); },
    onredo:function(inst,h){ ((h&&h.records)||[]).forEach(function(r){ ghi(r.x,r.y,r.value); }); },
    onselection:function(inst,x1,y1,x2,y2){ btSum_(k,inst,x1,y1,x2,y2);
      var m=B.meta[Math.min(y1,y2)];                 // bảng Bóc tách: bấm dòng tầng = chọn tầng để thêm hạng mục vào
      if(k==='tk' && m && m.k==='sec'){ S.selFloor=m.g==='CHƯA PHÂN TẦNG'?'':m.g; tkSheetFoot_(); } }
  })[0];
  B.ws=ws;
  // ít cột -> giãn đều cho kín bề ngang khung (khỏi khoảng trắng bên phải); đo THẬT sau khi dựng, cột STT giữ nguyên.
  // Người dùng đã tự kéo độ rộng cột của bảng này thì KHÔNG giãn (tôn trọng số đã kéo).
  var ct=host.querySelector('.jss_content'), tb=host.querySelector('table.jss_worksheet'), du=(ct&&tb&&!btDaKeoCot_(k,cols))?ct.clientWidth-tb.offsetWidth-2:0;
  if(du>4){ var tc=0; cols.forEach(function(c,i){ if(c[0]!=='stt') tc+=opt.columns[i].width||100; });
    cols.forEach(function(c,i){ if(c[0]==='stt') return; var w=opt.columns[i].width||100, d=Math.floor(w*du/tc);
      try{ ws.setWidth(i, w+d); }catch(e){} }); }
  B.frzN=Math.min(opt.frz,cols.length);
  if(B.frz) btCoDinh_(host, B.frzN);
  if(opt.menu) ws.options.contextMenu=function(){ return false; };      // tắt menu của thư viện, dùng menu của app
  B.menu=opt.menu;
  // Khung (host) giữ nguyên qua các lần dựng lại lưới -> chỉ gắn sự kiện 1 LẦN (gắn mỗi lần dựng = 1 cú bấm chạy 2-3 lần)
  if(!host._btNghe){ host._btNghe=1;
    // chế độ Gọn: ô bị cắt chữ -> rê chuột hiện đủ nội dung
    host.addEventListener('mouseover',function(e){ var td=e.target.closest&&e.target.closest('tbody td[data-x]');
      if(!td||!B.gon) return; td.title=(td.scrollWidth>td.clientWidth+1||td.scrollHeight>td.clientHeight+1)?td.innerText:''; });
    host.addEventListener('contextmenu',function(e){ var td=e.target.closest('td[data-x]'); if(!td||!B.menu) return;
      e.preventDefault(); e.stopPropagation(); B.menu(e, +td.dataset.x, td.dataset.y==null?-1:+td.dataset.y, td); }, true); }
  ro.forEach(function(ten){ try{ ws.setReadOnly(ten,true); }catch(e){} });
  btKeoCot_(k, host); btFmtAp_(k);
  return ws;
}
/* Cố định N cột đầu (+ cột số dòng) bằng position:sticky của trình duyệt. Không dùng freezeColumns của thư viện:
   nó dời từng ô bằng JS mỗi lần cuộn -> kéo ngang giật, và hàng chữ A/B/C không dính theo. */
function btCoDinh_(host, n){
  var t=host.querySelector('table.jss_worksheet'); if(!t||!n) return;
  var hd=t.tHead.rows, ten=hd[hd.length-1], lefts=[0], x=0;
  for(var i=0;i<=n;i++){ x+=ten.cells[i]?ten.cells[i].offsetWidth:0; lefts.push(x); }   // cells[0] = cột số dòng
  function gan(td,i){ if(!td) return; td.classList.add('gs-frz'); td.style.left=lefts[i]+'px'; if(i===n) td.classList.add('gs-frz-cuoi'); }
  [].forEach.call(hd,function(tr){ for(var i=0;i<=n;i++) gan(tr.cells[i],i); });
  [].forEach.call(t.tBodies[0].rows,function(tr){ gan(tr.cells[0],0);
    for(var i=1;i<=n;i++) gan(tr.querySelector('td[data-x="'+(i-1)+'"]'),i); });
}
/* Kéo đổi độ rộng cột như Excel: rê tới MÉP PHẢI ô tiêu đề (hàng A/B/C hoặc hàng tên cột) -> con trỏ ↔ -> kéo.
   Tự làm thay cho của thư viện: thư viện chỉ bắt ở hàng tên cột và tính sai mép khi trang có zoom (.wrap zoom .9).
   Lưu: bảng Bóc tách / Chi phí / Dự án vào S.colW (dùng chung bảng thường, nhớ qua lần mở sau); Phần thô: trong phiên. */
function btDaKeoCot_(k,cols){ if(k==='pt') return !!(btCtx_('pt').wTay&&Object.keys(btCtx_('pt').wTay).length);
  return cols.some(function(c){ return S.colW && S.colW[c[0]]!=null; }); }
function btKeoCot_(k, host){
  if(host._btKeoCot) return; host._btKeoCot=1;          // gắn 1 lần cho khung (khung giữ nguyên qua các lần dựng lại)
  function mepCua(e){ var td=e.target.closest&&e.target.closest('thead td'); if(!td || td.cellIndex<1) return null;
    var r=td.getBoundingClientRect(); return (r.right-e.clientX)<=7 ? td : null; }
  host.addEventListener('mousemove',function(e){ if(document.body.classList.contains('gs-rsz')) return;
    host.querySelectorAll('thead td.gs-rsz-on').forEach(function(t){ t.classList.remove('gs-rsz-on'); });
    var td=mepCua(e); if(td) td.classList.add('gs-rsz-on'); });
  host.addEventListener('mousedown',function(e){
    var td=mepCua(e); if(!td||e.button!==0) return;
    e.preventDefault(); e.stopPropagation();
    var B=btCtx_(k), ws=B.ws, x=td.cellIndex-1, col=B.cols[x]; if(!ws||!col) return;
    var zf=btZf_(td), x0=e.clientX, w0=td.getBoundingClientRect().width/zf, w=w0;
    document.body.classList.add('gs-rsz');
    function mv(ev){ w=Math.max(40, Math.round(w0+(ev.clientX-x0)/zf)); try{ ws.setWidth(x, w); }catch(er){} }
    function up(){ document.removeEventListener('mousemove',mv,true); document.removeEventListener('mouseup',up,true);
      document.body.classList.remove('gs-rsz');
      if(k==='pt'){ B.wTay=B.wTay||{}; B.wTay[col[0]]=w; }
      else { S.colW=S.colW||{}; S.colW[col[0]]=w; if(typeof saveCols==='function') saveCols(); }
      if(B.frz) btCoDinh_(host, B.frzN||2);             // cột cố định: tính lại vị trí dính
    }
    document.addEventListener('mousemove',mv,true); document.addEventListener('mouseup',up,true);
  },true);
}
/* ═══ CÔNG CỤ KIỂU EXCEL trên thanh bảng tính ═══ */
function btChep_(t){ try{ navigator.clipboard.writeText(String(t)); toast('Đã chép: '+t); }catch(e){} }
// vùng đang chọn -> danh sách ô {x,y}
function btVung_(B){ var r=B.selR, c=B.selX; if(!r||!c) return []; var o=[];
  for(var y=r[0];y<=r[1];y++) for(var x=c[0];x<=c[1];x++) o.push({x:x,y:y}); return o; }
/* --- Định dạng ô: chỉ để đánh dấu khi làm việc trên bảng tính (KHÔNG in ra báo giá / Excel). Lưu theo dự án (btFmt),
   khoá theo DÒNG (lineId — cùng 1 dòng ở Bóc tách / Chi phí / Dự án dùng chung) + CỘT, nên sắp xếp / thêm dòng không lệch. --- */
function btFmtAll_(){ return (S._projData&&S._projData.btFmt)||{}; }
function btFmtKey_(k,m){ return (!m||m.k!=='it')?'':(k==='pt'?('pt:'+m.si+':'+m.ii):String(m.id)); }
var BT_FMT_CLS={b:'f-b', i:'f-i', u:'f-u', wrap:'f-wrap'};
function btFmtAp_(k){
  var B=btCtx_(k), ws=B.ws; if(!ws) return; var all=btFmtAll_();
  B.meta.forEach(function(m,y){ var key=btFmtKey_(k,m); if(!key) return; var f=all[key]||{};
    B.cols.forEach(function(c,x){ var td=ws.getCellFromCoords(x,y); if(!td) return; var o=f[c[0]]||{};
      Object.keys(BT_FMT_CLS).forEach(function(p){ td.classList.toggle(BT_FMT_CLS[p], !!o[p]); });
      ['l','c','r'].forEach(function(a){ td.classList.toggle('f-al-'+a, o.al===a); });
      td.classList.toggle('f-c', !!o.c); if(o.c) td.style.setProperty('--fc',o.c);
      td.classList.toggle('f-bg', !!o.bg); if(o.bg) td.style.setProperty('--fbg',o.bg); }); });
}
// p = b|i|u|wrap (bật/tắt) · c|bg (màu, '' = bỏ) · al (l|c|r) · '*' = xoá hết định dạng vùng chọn
function btFmtSet_(k,p,v){
  var B=btCtx_(k); if(!B.ws) return; var o=btVung_(B).filter(function(q){ return btFmtKey_(k,B.meta[q.y]); });
  if(!o.length){ toast('Chọn ô ở dòng sản phẩm / công tác trước'); return; }
  var all=JSON.parse(JSON.stringify(btFmtAll_()));
  var bat=(p in BT_FMT_CLS) ? !o.every(function(q){ var f=all[btFmtKey_(k,B.meta[q.y])]; return f&&f[B.cols[q.x][0]]&&f[B.cols[q.x][0]][p]; }) : null;
  o.forEach(function(q){ var key=btFmtKey_(k,B.meta[q.y]), ck=B.cols[q.x][0];
    var f=all[key]=all[key]||{}, c=f[ck]=f[ck]||{};
    if(p==='*') delete f[ck]; else if(bat!==null){ if(bat) c[p]=1; else delete c[p]; } else if(v) c[p]=v; else delete c[p];
    if(f[ck]&&!Object.keys(f[ck]).length) delete f[ck]; if(!Object.keys(f).length) delete all[key]; });
  projDataSet_('btFmt', all); btFmtAp_(k);
}
/* --- Thao tác dòng --- */
function btDongChon_(B){ var r=B.selR, ids=[]; if(!r) return ids;
  for(var y=r[0];y<=r[1];y++){ var m=B.meta[y]; if(m&&m.k==='it'&&m.id) ids.push(m.id); } return ids; }
async function btChenDong_(k){ var ids=btDongChon_(btCtx_(k)); if(!ids.length){ toast('Chọn 1 ô ở dòng sản phẩm trước'); return; } await ctxInsertRow(ids[ids.length-1]); }
async function btNhanBan_(k){ var ids=btDongChon_(btCtx_(k)); if(!ids.length){ toast('Chọn ô ở các dòng cần nhân bản'); return; }
  for(var i=0;i<ids.length;i++) await ctxDupRow(ids[i]); }
function btSapXep_(k,dir){
  var B=btCtx_(k), x=B.selX?B.selX[0]:-1, c=B.cols[x]; if(!c||c[0]==='stt'){ toast('Chọn 1 ô ở cột cần sắp xếp'); return; }
  if(k==='tk') colSort(c[0],dir); else if(k==='cp'){ S._cpSort=c[0]; S._cpSortDir=dir; renderChiphi(); }
  else if(k==='da') daSort(c[0],dir); else toast('Bảng Phần thô sắp xếp ở bảng thường');
  toast('Sắp xếp '+(dir==='asc'?'A → Z':'Z → A')+' theo "'+c[1]+'"'); }
// Điền xuống (Ctrl+D): ô ĐẦU của từng cột trong vùng chọn -> các ô bên dưới (chỉ ô sửa được)
function btDienVung_(k){
  var B=btCtx_(k), ws=B.ws, r=B.selR, c=B.selX; if(!ws||!r||!c||r[1]<=r[0]){ toast('Chọn vùng từ ô nguồn kéo xuống các ô cần điền'); return; }
  var n=0; for(var x=c[0];x<=c[1];x++){ var v=ws.getValueFromCoords(x,r[0]);
    for(var y=r[0]+1;y<=r[1];y++){ if(ws.isReadOnly(x,y)) continue; B.ghi(x,y,v); n++; } }
  toast(n?('Đã điền xuống '+n+' ô'):'Vùng chọn không có ô sửa được'); }
/* --- Sao chép / Cắt / Dán (cùng định dạng Excel: tab giữa cột, xuống dòng giữa hàng) --- */
function btCopy_(k,cat){ var B=btCtx_(k), ws=B.ws; if(!ws||!B.selR){ toast('Chọn vùng ô trước'); return; }
  try{ ws.copy(true); }catch(e){}
  if(cat){ btVung_(B).forEach(function(q){ if(!ws.isReadOnly(q.x,q.y)) B.ghi(q.x,q.y,''); }); }
  toast(cat?'Đã cắt vùng chọn':'Đã sao chép vùng chọn'); }
async function btPaste_(k){ var B=btCtx_(k), ws=B.ws; if(!ws||!B.sel){ toast('Chọn ô bắt đầu dán'); return; }
  var t=''; try{ t=await navigator.clipboard.readText(); }catch(e){ toast('Trình duyệt chặn đọc bộ nhớ tạm — dùng Ctrl+V'); return; }
  if(!t){ toast('Bộ nhớ tạm trống'); return; } ws.paste(B.sel[0],B.sel[1],t); }
/* --- Thanh công thức: địa chỉ ô (C5) + nội dung ô đang chọn; sửa rồi Enter = ghi vào ô --- */
function btFxSync_(k){
  var B=btCtx_(k), a=document.getElementById(k+'FxAddr'), i=document.getElementById(k+'FxIn'); if(!a||!i||!B.ws||!B.sel) return;
  var x=B.sel[0], y=B.sel[1], c=B.cols[x];
  a.textContent=btColLetter_(x)+(y+1)+(B.selR&&(B.selR[1]>B.selR[0]||B.selX[1]>B.selX[0])?(':'+btColLetter_(B.selX[1])+(B.selR[1]+1)):'');
  i.value=btChu_(B.ws.getValueFromCoords(x,y)); i.disabled=B.ws.isReadOnly(x,y); i.title=c?c[1]:''; }
function btFxGhi_(k,v){ var B=btCtx_(k); if(!B.ws||!B.sel) return; var x=B.sel[0], y=B.sel[1];
  if(B.ws.isReadOnly(x,y)) return; if(String(B.ws.getValueFromCoords(x,y))===String(v)) return; B.ws.setValueFromCoords(x,y,v); }
/* --- Phím tắt khi đang ở bảng tính (không đang gõ trong ô): Ctrl+B/I/U, Ctrl+D, Ctrl+Shift+L --- */
document.addEventListener('keydown',function(e){
  if(!(e.ctrlKey||e.metaKey)) return; var k=btDangXem_(); if(!k) return;
  var t=e.target, B=btCtx_(k); if(t&&/INPUT|TEXTAREA|SELECT/.test(t.tagName)) return;    // đang gõ (ô sửa / ô tìm…) -> để mặc định
  if(!B.sel) return; var ph=e.key.toLowerCase();
  if(e.shiftKey && ph==='l'){ e.preventDefault(); btFilter_(k); return; }
  if(e.shiftKey) return;
  if(ph==='b'||ph==='i'||ph==='u'){ e.preventDefault(); btFmtSet_(k,ph); }
  else if(ph==='d'){ e.preventDefault(); btDienVung_(k); }
},true);
// Ghi giá trị mới vào lưới (không dựng lại -> giữ ô đang chọn, vị trí cuộn). Ô tự tính KHÔNG vào lịch sử:
// Ctrl+Z chỉ lùi thao tác của người dùng (lùi ô gõ -> ghi lại -> tính lại)
function btGhiLuoi_(k, rows){
  var B=btCtx_(k), ws=B.ws; B.busy=true; var ih=ws.ignoreHistory; ws.ignoreHistory=true;
  try{ rows.forEach(function(r,y){ r.forEach(function(v,x){
    if(String(ws.getValueFromCoords(x,y))!==String(v)) ws.setValueFromCoords(x,y,v,true); }); }); }
  finally{ B.busy=false; ws.ignoreHistory=ih; }
  btFxSync_(k);
}

/* Dựng lưới cho bảng Phần thô: mỗi dòng mang meta {k:'sec'|'it', si, ii} để biết ô sửa thuộc đâu */
function ptSheetGrid_(cols, comp){
  var rows=[], meta=[];
  (S.phanTho||[]).forEach(function(sec,si){
    var st=comp.sections[si];
    var ln=st.tt-st.ttnt, dvtSet={};
    sec.items.forEach(function(it){ dvtSet[String(it.dvt||'').trim()]=1; });
    var mot=Object.keys(dvtSet).length<=1;
    var sumDG=sec.items.reduce(function(s,it){ return s+ptN(it.dg); },0);
    var dgntSet={}; sec.items.forEach(function(it){ dgntSet[ptN(it.dgnt)]=1; });
    var dk=Object.keys(dgntSet), secDgnt=(dk.length===1&&ptN(dk[0]))?ptN(dk[0]):0;
    var sv={ stt:PT_ROMAN[si], noidung:String(sec.t||''), khoiluong:(st.sumKL&&mot)?btQty_(st.sumKL):'',
      dgnt:btMoney_(secDgnt), ttnt:btMoney_(st.ttnt), lnvnd:btMoney_(ln),
      margin:st.tt?btPct_(ln/st.tt*100):'', markup:st.ttnt?btPct_(ln/st.ttnt*100):'',
      dg:sec.mode==='area'?btMoney_(sec.up):((sumDG&&mot)?btMoney_(sumDG):''), tt:btMoney_(st.tt) };
    rows.push(cols.map(function(c){ return sv[c[0]]==null?'':sv[c[0]]; })); meta.push({k:'sec', si:si});
    ptSortItems_(sec.items).filter(function(r){ return ptRowPass_(sec,r.it); }).forEach(function(r,pos){
      var it=r.it, isItem=sec.mode==='item', tt=it._tt, ttnt=it._ttnt, l=isItem?(tt-ttnt):0;
      var v={ stt:String(pos+1), noidung:String(it.n||''), dvt:String(it.dvt||''),
        dientich:it.dt==null||it.dt===''?'':btQty_(ptN(it.dt)), heso:it.hs==null||it.hs===''?'':String(it.hs).replace('.',','),
        khoiluong:btQty_(it._kl), dgnt:btMoney_(it.dgnt), ttnt:isItem?btMoney_(ttnt):'', lnvnd:isItem?btMoney_(l):'',
        margin:(isItem&&tt)?btPct_(l/tt*100):'', markup:(isItem&&ttnt)?btPct_(l/ttnt*100):'',
        dg:btMoney_(it.dg), tt:isItem?btMoney_(tt):'', ghichu:String(it.gc||'') };
      rows.push(cols.map(function(c){ return v[c[0]]==null?'':v[c[0]]; })); meta.push({k:'it', si:si, ii:r.oi});
    });
  });
  return {rows:rows, meta:meta};
}
// Ô này sửa được không (cùng quy tắc bảng cũ: ptCanEditF_ theo chế độ nhóm)
function ptSheetSua_(m,key){
  var sec=(S.phanTho||[])[m.si]; if(!sec) return null;
  if(m.k==='sec'){ if(key==='noidung') return 't'; if(key==='dg'&&sec.mode==='area') return 'up'; return null; }
  var f=PT_CELL_F[key]; if(!f) return null;
  if(f==='n') return f;
  if(f==='lnPct') return sec.mode==='item'?f:null;
  return ptCanEditF_(sec,f)?f:null;
}
var PT_NOI_BO={dgnt:1, ttnt:1, lnvnd:1, margin:1, markup:1};
function btColLetter_(i){ var s=''; i++; while(i>0){ var r=(i-1)%26; s=String.fromCharCode(65+r)+s; i=Math.floor((i-1)/26); } return s; }

function renderPTSheet_(host, cols, comp){
  var g=ptSheetGrid_(cols, comp);
  var st={}, ro=[];
  g.meta.forEach(function(m,y){
    cols.forEach(function(c,x){
      var ten=btColLetter_(x)+(y+1);
      if(m.k==='sec') st[ten]='background-color:#e8eaed;font-weight:700;';
      else if(c[0]==='dvt'||c[0]==='ghichu') st[ten]='font-style:italic;';      // như mẫu: ĐVT, Ghi chú in nghiêng
      if(!ptSheetSua_(m,c[0])) ro.push(ten);
    });
  });
  var ws=btTao_('pt', host, cols, g.meta, cols.map(function(c){ return c[2]==='n'?'n':(c[2]==='c'?'c':''); }), {
    data:g.rows, style:st,
    frz:2, columns:cols.map(function(c){ return {title:c[1], width:(btCtx_('pt').wTay||{})[c[0]]||c[3]||100, type:'text',
      align:c[2]==='n'?'right':(c[2]==='c'?'center':'left'), wordWrap:c[0]==='noidung'||c[0]==='ghichu'}; })
  }, ptSheetGhi_, ro, PT_NOI_BO);
  return ws;
}
// Ghi 1 ô người dùng sửa vào S.phanTho (đúng hàm của bảng cũ), gom nhiều ô liền nhau -> tính + lưu + vẽ lại 1 lần
function ptSheetGhi_(x,y,val){
  var B=S._bt.pt, m=B.meta[y], col=B.cols[x], f=m&&col&&ptSheetSua_(m,col[0]); if(!f) return;
  clearTimeout(S._ptSheetT);
  if(m.k==='sec' && f==='t'){                     // tên nhóm: ghi thẳng (ptEditSec_ vẽ lại cả bảng -> mất ô chọn + lịch sử)
    var v=String(val==null?'':val).trim(); if(!v){ toast('Tên hạng mục không được để trống'); ptSheetRefresh_(); return; }
    S.phanTho[m.si].t=v; }
  else if(m.k==='sec') ptEdit(m.si,-1,f,val,true);
  else ptEdit(m.si,m.ii,f,val,true);
  S._ptSheetT=setTimeout(function(){ ptPersist(); ptSheetRefresh_(); },60);
}
// Sau khi sửa: tính lại, ghi giá trị mới vào lưới (không dựng lại -> giữ ô đang chọn, vị trí cuộn)
function ptSheetRefresh_(){
  var B=btCtx_('pt'); if(!btSong_('pt')){ renderPhanTho(); return; }
  var comp=ptComputeAll(), g=ptSheetGrid_(B.cols, comp);
  if(g.rows.length!==B.meta.length){ renderPhanTho(); return; }     // thêm/bớt dòng -> vẽ lại cả bảng
  btGhiLuoi_('pt', g.rows); B.meta=g.meta; ptTotalsBar_(comp);
}

/* ═══ BẢNG SẢN PHẨM BÓC TÁCH ('tk') ═══
   Dòng nhóm = tầng/phòng (I. TẦNG 1 … tổng tầng ở cột Thành tiền), dòng dữ liệu = 1 dòng S.lines. */
var TK_NOI_BO={giaNCC:1, chietKhau:1, giaDaiLy:1, lnPct:1, markup:1, margin:1, lnVnd:1};
var TK_SO={soLuong:1, giaNCC:1, giaDaiLy:1, donGia:1, donGiaCK:1, lnVnd:1, thanhTien:1, chietKhau:1, lnPct:1, ckKhach:1, markup:1, margin:1};
var TK_GIUA={stt:1, hinhAnh:1, dvt:1, taiLieu:1, nganh:1};
function tkSheetSua_(k){ return !TK_RO_COL[k] && k!=='taiLieu' && !!(k==='moTa'||k==='kichThuoc'||TXT_COL[k]||NUM_COL[k]||k==='markup'||k==='margin'||k==='lnVnd'); }
function btSl_(v){ v=Number(v)||0; return v.toLocaleString('vi-VN',{maximumFractionDigits:3}); }
function tkSheetO_(l,k,stt){
  switch(k){
    case 'stt': return stt;
    case 'nganh': return String((l.extra&&l.extra.nganh)||'');
    case 'hinhAnh': return l.hinhAnh?'<img class="gs-img" src="'+esc(imgSrc1_(l.hinhAnh))+'" onclick="imgPop_(this.src)" onerror="this.style.visibility=\'hidden\'">':'';
    case 'taiLieu': { var n=lineDocs_(l).length; return n?('<button class="tl-badge" onclick="event.stopPropagation();tlPop_(event,\''+escJs_(l.lineId)+'\')">'+icon('doc',13)+' '+n+'</button>'):''; }
    case 'soLuong': return btSl_(l.soLuong);
    case 'giaNCC': return btMoney_(l.donGiaVon);
    case 'donGia': return btMoney_(l.donGiaBan);
    case 'giaDaiLy': return btMoney_(giaDaiLy_(l));
    case 'donGiaCK': return btMoney_(donGiaCK_(l));
    case 'thanhTien': return btMoney_(ttBan_(l));
    case 'lnVnd': return btMoney_((donGiaCK_(l)-giaDaiLy_(l))*(Number(l.soLuong)||0));
    case 'chietKhau': case 'lnPct': case 'ckKhach': return (Number(l[k])||0)+'%';
    case 'markup': { var dl=giaDaiLy_(l),dg=donGiaCK_(l); return dl>0?Math.round((dg-dl)/dl*100)+'%':''; }
    case 'margin': { var dl2=giaDaiLy_(l),dg2=donGiaCK_(l); return dg2>0?Math.round((dg2-dl2)/dg2*100)+'%':''; }
  }
  var f=TXT_COL[k]||k; return String(l[f]==null?'':l[f]);
}
function tkSheetGrid_(cols, order, groups){
  var rows=[], meta=[], iTT=-1;
  cols.forEach(function(c,i){ if(c[0]==='thanhTien') iTT=i; });
  order.forEach(function(g,gi){
    var list=groups[g]||[], r=cols.map(function(){ return ''; });
    var dong=S.collapsed&&S.collapsed[g];
    r[0]=(dong?'▸ ':'▾ ')+(PT_ROMAN[gi]||String(gi+1)); if(cols.length>1) r[1]=g+(dong?'  ·  '+list.length+' dòng (đang thu gọn)':'');
    if(iTT>1) r[iTT]=btMoney_(list.reduce(function(s,l){ return s+ttBan_(l); },0));
    rows.push(r); meta.push({k:'sec', g:g});
    if(dong) return;
    sortLines_(list).forEach(function(l,ri){
      rows.push(cols.map(function(c){ return tkSheetO_(l,c[0],(gi+1)+'.'+(ri+1)); })); meta.push({k:'it', id:l.lineId});
    });
  });
  return {rows:rows, meta:meta, iTT:iTT};
}
// Gọi từ renderTable(): cùng cột + cùng dòng -> chỉ ghi số mới (giữ ô chọn, cuộn, Ctrl+Z); khác -> dựng lại
function tkSheetVe_(host, cols, order, groups){
  var B=btCtx_('tk'), g=tkSheetGrid_(cols, order, groups);
  tkSheetGop_(true);
  tkSheetFoot_(); tkSheetNhanTha_(); setTimeout(tkSheetCao_,0);
  var cb=document.getElementById('tkColBtn'); if(cb) cb.innerHTML=icon('sliders',15)+' Cột '+cols.length+'/'+COLS.length;
  var sig=cols.map(function(c){ return c[0]; }).join()+'|'+g.meta.map(function(m){ return m.k==='sec'?('#'+m.g):m.id; }).join();
  if(btSong_('tk') && B.sig===sig && host.contains(B.ws.element)){ btGhiLuoi_('tk', g.rows); return; }
  B.sig=sig;
  // Cố định tới cột Tên sản phẩm nếu phần cố định không quá 40% bề ngang khung, không thì chỉ STT + cột kế
  var iTen=-1; cols.forEach(function(c,i){ if(c[0]==='ten') iTen=i; });
  var rong=(host.clientWidth||1000)*0.4, cw=0, frz=2;
  if(iTen>=1){ for(var i=0;i<=iTen;i++) cw+=Math.max(colW(cols[i][0]),TK_MINW_[cols[i][0]]||60); if(cw<=rong) frz=iTen+1; }
  // Tên tầng gộp ô: khi cố định cột chỉ gộp TRONG phần cố định (ô gộp dính trái mà dài quá phần cố định
  // làm bảng rộng thêm -> dư khoảng trắng khi cuộn ngang); không cố định thì trải tới trước cột Thành tiền
  var st={}, ro=[], merge={}, het=B.frz?Math.min(frz,cols.length):(g.iTT>1?g.iTT:cols.length);
  g.meta.forEach(function(m,y){
    if(m.k==='sec' && het>2) merge[btColLetter_(1)+(y+1)]=[het-1,1];
    cols.forEach(function(c,x){
      var ten=btColLetter_(x)+(y+1);
      if(m.k==='sec') st[ten]='background-color:#e8eaed;font-weight:700;'+(x===0?'cursor:pointer;':'');
      else if(c[0]==='dvt'||c[0]==='ghiChu') st[ten]='font-style:italic;';
      if(m.k==='sec' || !tkSheetSua_(c[0])) ro.push(ten);
    });
  });
  btTao_('tk', host, cols, g.meta, cols.map(function(c){ return TK_SO[c[0]]?'n':(TK_GIUA[c[0]]?'c':''); }), {
    data:g.rows, style:st, merge:merge, frz:frz, h:'calc(100vh - 140px)', menu:tkSheetMenu_,
    columns:cols.map(function(c){ var k=c[0];
      return {title:c[1], width:Math.max(colW(k),TK_MINW_[k]||60), type:(k==='hinhAnh'||k==='taiLieu')?'html':'text',
        align:TK_SO[k]?'right':(TK_GIUA[k]?'center':'left'), wordWrap:k==='moTa'||k==='kichThuoc'||k==='ten'||k==='ghiChu'}; })
  }, btLineGhi_('tk'), ro, TK_NOI_BO);
  tkSheetKeo_(host); tkSheetCao_();
}
/* Bảng vừa khít màn hình: đáy khung bảng = đáy cửa sổ (bằng panel trái), nhiều dòng thì cuộn TRONG bảng,
   trang không dài ra. Tính lại khi đổi cỡ cửa sổ / khối phía trên đổi cao (gập chip, gập thẻ dự án…). */
function btZf_(el){ var f=1; for(var e=el; e&&e.nodeType===1; e=e.parentElement){ var z=parseFloat(getComputedStyle(e).zoom); if(z>0) f*=z; } return f; }
function tkSheetCao_(){
  var c=document.querySelector('#tkSheet .jss_content'); if(!c || !c.offsetParent) return;
  // đáy mục tiêu = đáy cửa sổ; panel danh mục bên trái kéo dài tới đúng đáy đó -> 2 cột bằng nhau, trang không cuộn
  var y0=window.pageYOffset||0, grid=document.getElementById('bocGrid'), left=document.getElementById('leftCat');
  var gTop=grid?grid.getBoundingClientRect().top+y0:0, day=Math.max(gTop+420, window.innerHeight-14);
  // số đo màn hình (getBoundingClientRect) đã nhân zoom của app (.wrap zoom .9 …), còn CSS height chưa -> chia lại
  if(left){ var lh=Math.round((day-(left.getBoundingClientRect().top+y0))/btZf_(left))+'px';
    if(left.style.height!==lh){ left.style.height=lh; left.style.maxHeight=lh; } }
  var gs=c.closest('.gs'), h=parseFloat(c.style.height)||c.offsetHeight;
  h=Math.max(260, Math.floor(h+(day-(gs.getBoundingClientRect().bottom+y0))/btZf_(c)));   // dời đúng phần chênh của đáy khung
  if(c.style.height!==h+'px'){ c.style.height=h+'px'; c.style.maxHeight=h+'px'; }
  if(!S._tkCaoObs && window.ResizeObserver){                  // khối phía trên đổi cao -> tính lại (1 lần / khung hình)
    var hen=0; S._tkCaoObs=new ResizeObserver(function(){ if(!hen) hen=requestAnimationFrame(function(){ hen=0; tkSheetCao_(); }); });
    S._tkCaoObs.observe(document.body);
    window.addEventListener('resize',function(){ tkSheetCao_(); });
  }
}
/* Kéo ô số thứ tự dòng (cột xám bên trái) để đổi chỗ dòng / chuyển sang tầng khác — lưu bằng tkMoveLine_ như bảng cũ */
function tkSheetKeo_(host){
  var B=btCtx_('tk'), tb0=host.querySelector('tbody'); if(!tb0) return;
  [].forEach.call(tb0.rows,function(tr,y){ var m=B.meta[y], td=tr.cells[0];
    if(m && m.k==='it'){ td.classList.add('gs-drag'); td.title='Kéo để đổi chỗ dòng · bấm để chọn cả dòng'; } });
  if(host._tkKeo) return; host._tkKeo=1;                  // sự kiện gắn 1 lần cho khung; tbody lấy lại mỗi lần dùng (lưới dựng lại thì tbody mới)
  var tb={ querySelectorAll:function(q){ var t=host.querySelector('tbody'); return t?t.querySelectorAll(q):[]; } };
  function clr(){ tb.querySelectorAll('.gs-dz-t,.gs-dz-b,.gs-dragging').forEach(function(r){ r.classList.remove('gs-dz-t','gs-dz-b','gs-dragging'); }); }
  function dich(e){ var el=document.elementFromPoint(e.clientX,e.clientY), tr=el&&el.closest&&el.closest('tr');
    if(!tr||tr.parentNode!==host.querySelector('tbody')) return null; var r=tr.getBoundingClientRect(); return {tr:tr, tren:(e.clientY-r.top)<r.height/2}; }
  // bắt chuột ở pha capture: thư viện không nhận cú bấm này (không kéo vùng chọn theo); bấm không kéo = chọn cả dòng
  // bấm ô ▾/▸ đầu dòng tầng = thu gọn / mở tầng (như bảng cũ)
  host.addEventListener('click',function(e){ var td=e.target.closest&&e.target.closest('tbody td[data-x="0"]'); if(!td) return;
    var m=B.meta[+td.dataset.y]; if(m&&m.k==='sec') toggleFloor(m.g); });
  host.addEventListener('mousedown',function(e){
    var td=e.target.closest&&e.target.closest('td.gs-drag'); if(!td||e.button!==0) return;
    e.stopPropagation(); e.preventDefault();
    var tr=td.parentNode, y=tr.sectionRowIndex, m=B.meta[y], x0=e.clientX, y0=e.clientY, keo=false;
    function mv(ev){
      if(!keo){ if(Math.abs(ev.clientX-x0)+Math.abs(ev.clientY-y0)<5) return;
        if(S.sortKey){ toast('Đang sắp xếp theo cột — bỏ sắp xếp (chuột phải → Bỏ sắp xếp) rồi kéo'); return up(null); }
        keo=true; document.body.classList.add('gs-keo'); }
      tb.querySelectorAll('.gs-dz-t,.gs-dz-b').forEach(function(r){ r.classList.remove('gs-dz-t','gs-dz-b'); });
      tr.classList.add('gs-dragging'); var d=dich(ev); if(d) d.tr.classList.add(d.tren?'gs-dz-t':'gs-dz-b');
    }
    function up(ev){
      document.removeEventListener('mousemove',mv,true); document.removeEventListener('mouseup',up,true);
      document.body.classList.remove('gs-keo'); clr(); if(!ev) return;
      if(!keo){ B.ws.updateSelectionFromCoords(0,y,B.cols.length-1,y); return; }
      var d=dich(ev); if(!d) return; var t=B.meta[d.tr.sectionRowIndex]; if(!t) return;
      if(t.k==='sec') tkMoveLine_(m.id, t.g, null, false);                                // thả lên dòng tầng -> cuối tầng đó
      else if(t.id!==m.id){ var l=lineOf_(t.id); tkMoveLine_(m.id, (l&&l.tang)||'', t.id, d.tren); }
    }
    document.addEventListener('mousemove',mv,true); document.addEventListener('mouseup',up,true);
  },true);
}
/* Gộp khối "Công cụ bảng" + "Cột hiển thị" vào hàng công cụ của bảng tính (cùng nút, cùng hàm) -> bảng cao thêm.
   Tắt bảng tính thì trả các nút về chỗ cũ. */
function tkSheetGop_(on){
  document.body.classList.toggle('bt-tk', !!on);
  var row=document.getElementById('tkToolRow'), slot=document.getElementById('tkSheetTools'), home=document.querySelector('#tkToolBox .tk-toolhr');
  if(!row) return;
  if(on && slot && row.parentNode!==slot) slot.appendChild(row);
  else if(!on && home && row.parentNode!==home) home.insertBefore(row, document.getElementById('foldToolsBtn'));
  var left=document.getElementById('leftCat'); if(!on && left && left.style.height){ left.style.height=''; left.style.maxHeight=''; }   // trả panel trái về cỡ CSS
}
// Bảng tính nào đang hiện (để Ctrl+F / Tìm & thay chạy trên lưới thay vì bảng cũ đang ẩn)
function btDangXem_(){
  return ['tk','cp','da','pt'].filter(function(k){ return btSong_(k) && btCtx_(k).ws.element.offsetParent; })[0]||'';
}
/* Chuột phải trên lưới — menu kiểu Excel, gọi đúng các hàm của bảng cũ */
function tkSheetMenu_(e, x, y, td){
  var B=btCtx_('tk'), m=y>=0?B.meta[y]:null, c=B.cols[x], k=c&&c[0]; closePop();
  if(y>=0 && !(B.selR && y>=B.selR[0] && y<=B.selR[1])) B.ws.updateSelectionFromCoords(x,y,x,y);   // chuột phải ngoài vùng chọn -> chọn ô đó
  S._btEv={target:td, currentTarget:td, stopPropagation:function(){}};
  function mi(ic,label,fn,hint,cls){ return '<div class="cmi '+(cls||'')+'" onclick="'+fn+'">'+icon(ic,14)+'<span>'+label+'</span>'+(hint?'<i class="cmi-k">'+hint+'</i>':'')+'</div>'; }
  function sec(t){ return '<div class="cmh">'+esc(t)+'</div>'; }
  var sep='<div class="cmsep"></div>', h='';
  if(m && m.k==='it'){ var id=escJs_(m.id);
    h+=sec('Dòng')
      +mi('search','Đổi sản phẩm từ danh mục…','closePop();openPick(\''+id+'\',S._btEv)')
      +mi('copy','Nhân bản dòng','ctxDupRow(\''+id+'\')')
      +mi('plus','Chèn dòng trống bên dưới','ctxInsertRow(\''+id+'\')')
      +mi('trash','Xoá các dòng đang chọn','closePop();tkSheetDel_()','','danger')+sep; }
  if(m && m.k==='sec'){ var g=escJs_(m.g), gv=m.g==='CHƯA PHÂN TẦNG'?'':g;
    h+=sec('Tầng / phòng: '+m.g)
      +mi('plus','Thêm hạng mục trống vào tầng này','closePop();addItemToFloor(\''+gv+'\')')
      +(m.g!=='CHƯA PHÂN TẦNG'?mi('edit','Đổi tên tầng','closePop();renameFloor(\''+g+'\')'):'')+sep; }
  if(k){ h+=sec('Cột: '+c[1])
      +mi('up','Sắp xếp tăng dần','colSort(\''+k+'\',\'asc\')')
      +mi('down','Sắp xếp giảm dần','colSort(\''+k+'\',\'desc\')')
      +(S.sortKey?mi('close','Bỏ sắp xếp','resetSort();closePop()'):'')
      +(m&&m.k==='it'&&tkSheetSua_(k)?mi('down','Điền giá trị ô này xuống cả cột','closePop();btDien_(\'tk\','+x+','+y+')'):'')
      +(k!=='ten'?mi('eye','Ẩn cột này','ctxHideCol(\''+k+'\')'):'')
      +mi('sliders','Chọn cột hiển thị…','closePop();tkColPop_()')+sep; }
  h+=mi('plus','Thêm tầng / phòng','closePop();openAddFloor(S._btEv)')
    +mi('search','Tìm & thay thế','closePop();btFind_(\'tk\')','Ctrl+F');
  var pop=document.createElement('div'); pop.className='fltpop ctxmenu'; pop.id='qs_pop'; pop.innerHTML=h; document.body.appendChild(pop);
  pop.style.left=Math.max(8,Math.min(e.clientX, window.innerWidth-pop.offsetWidth-12))+'px';
  pop.style.top=Math.max(8,Math.min(e.clientY, window.innerHeight-pop.offsetHeight-12))+'px';
  setTimeout(function(){ document.addEventListener('mousedown',popOutside); },0);
}
// Điền giá trị 1 ô xuống mọi dòng sản phẩm của cột (có hỏi lại) — ghi 1 lô
async function btDien_(k0,x,y){
  var B=btCtx_(k0), v=B.ws.getValueFromCoords(x,y), k=B.cols[x][0];
  var ids=B.meta.filter(function(m,i){ return m.k==='it' && i!==y; }).map(function(m){ return m.id; });
  if(!ids.length) return;
  if(!await xacNhan_('Điền "'+String(v).slice(0,30)+'" cho '+ids.length+' dòng còn lại trong cột "'+B.cols[x][1]+'"?')) return;
  tkApplyEdits_(ids.map(function(id){ var l=lineOf_(id); return {id:id, fields:l&&tkFieldsFor_(l,k,v)}; }),'Đã điền xuống');
}
// Nút thêm tầng / hạng mục ngay dưới lưới (như bảng cũ). Hạng mục mới vào tầng đang chọn (bấm 1 ô của dòng tầng để chọn)
function tkSheetFoot_(){
  var el=document.getElementById('tkSheetFoot'); if(!el) return;
  var f=(S.selFloor||'').trim();
  el.innerHTML='<button class="addbtn floor" onclick="openAddFloor(event)">'+icon('plus',15)+'Thêm tầng / phòng</button>'
    +'<button class="addbtn item" onclick="addBlankItem()" title="Thêm 1 hạng mục trống vào tầng đang chọn">'+icon('plus',15)+'Thêm hạng mục'
      +(f?'<span class="addbtn-sub">vào '+esc(f)+'</span>':'')+'</button>';
}
/* Kéo SẢN PHẨM từ danh mục bên trái thả vào lưới (cùng luồng addProdObj của bảng cũ):
   thả lên dòng SP -> vào tầng của dòng đó · lên dòng tầng -> vào tầng đó · chỗ khác -> tầng đang chọn */
function tkSheetNhanTha_(){
  var w=document.getElementById('tkSheetWrap'); if(!w || w._nhanTha) return; w._nhanTha=1;
  function dich(e){ var B=btCtx_('tk'), tr=e.target.closest&&e.target.closest('#tkSheet tbody tr'), m=tr&&B.meta[tr.sectionRowIndex];
    var g=(S.selFloor||'').trim();
    if(m&&m.k==='sec') g=m.g==='CHƯA PHÂN TẦNG'?'':m.g; else if(m&&m.k==='it'){ var l=lineOf_(m.id); g=(l&&l.tang)||''; }
    return {tr:tr, g:g}; }
  function clr(){ w.classList.remove('gs-tha'); w.querySelectorAll('.gs-dz-b').forEach(function(r){ r.classList.remove('gs-dz-b'); }); }
  w.addEventListener('dragover',function(e){ if(!S._dragProd) return; e.preventDefault(); try{ e.dataTransfer.dropEffect='copy'; }catch(x){}
    var d=dich(e); w.querySelectorAll('.gs-dz-b').forEach(function(r){ if(r!==d.tr) r.classList.remove('gs-dz-b'); });
    if(d.tr) d.tr.classList.add('gs-dz-b');
    w.classList.add('gs-tha'); w.setAttribute('data-tha','Thả để thêm vào '+(d.g||'CHƯA PHÂN TẦNG')); });
  w.addEventListener('dragleave',function(e){ if(!w.contains(e.relatedTarget)) clr(); });
  w.addEventListener('drop',function(e){ if(!S._dragProd) return; e.preventDefault();
    var p=S._dragProd, d=dich(e), sl=S._dragSL||1; S._dragProd=null; S._dragSL=1; clr();
    if(d.g) S.selFloor=d.g; addProdObj(p, d.g, sl); });
  document.addEventListener('dragend',clr);
}
// Nhảy tới dòng TẦNG trên lưới (vừa thêm tầng): cuộn tới, chọn ô tên tầng, nháy vàng
function tkSheetDenTang_(g){
  if(!btSong_('tk') || !btCtx_('tk').ws.element.offsetParent) return false;
  var B=btCtx_('tk'), y=B.meta.findIndex(function(m){ return m.k==='sec' && m.g===g; }); if(y<0) return false;
  return btDenO_(B, Math.min(1,B.cols.length-1), y);
}
function btDenO_(B,x,y){
  B.ws.updateSelectionFromCoords(x,y,x,y);
  var td=B.ws.getCellFromCoords(x,y), tr=td&&td.parentNode;
  if(td) try{ td.scrollIntoView({block:'nearest', inline:'nearest'}); }catch(e){}
  if(tr){ tr.classList.remove('gs-moi'); void tr.offsetWidth; tr.classList.add('gs-moi'); setTimeout(function(){ tr.classList.remove('gs-moi'); },1600); }
  return true;
}
/* Nhảy tới 1 dòng trên lưới (dòng vừa thêm / vừa tìm): bung tầng nếu đang thu gọn, cuộn tới, chọn ô Tên
   (gõ là sửa luôn), nháy vàng. Trả false khi không đang xem bảng tính -> người gọi dùng cách của bảng cũ. */
function tkSheetDen_(id){
  if(!btSong_('tk') || !btCtx_('tk').ws.element.offsetParent) return false;
  var l=lineOf_(id), g=l&&((l.tang||'').trim()||'CHƯA PHÂN TẦNG');
  if(g && S.collapsed && S.collapsed[g]){ S.collapsed[g]=false; renderTable(); }
  var B=btCtx_('tk'), y=B.meta.findIndex(function(m){ return m.k==='it' && m.id===id; }); if(y<0) return true;
  return btDenO_(B, Math.max(0, B.cols.findIndex(function(c){ return c[0]==='ten'; })), y);
}
// Hạng mục chưa có dòng nào: vẫn giữ khung bảng tính (không nhảy về bảng thường) + hướng dẫn + nút thêm ở dưới
function tkSheetTrong_(){
  var host=document.getElementById('tkSheet'), B=btCtx_('tk'); if(!host) return;
  B.ws=null; B.sig=''; B.meta=[];
  host.innerHTML='<div class="gs-trong">'+icon('layers',30)+'<b>Hạng mục này chưa có sản phẩm</b>'
    +'<span>Kéo sản phẩm ở danh mục bên trái thả vào đây, bấm ＋ trên thẻ sản phẩm, hoặc bấm <b>Thêm hạng mục</b> bên dưới.</span></div>';
  tkSheetGop_(true); tkSheetFoot_(); tkSheetNhanTha_();
}
// Xoá các dòng sản phẩm nằm trong vùng đang chọn (dùng đúng luồng xoá hàng loạt của bảng cũ, có hỏi lại)
function tkSheetDel_(){
  var B=btCtx_('tk'), r=B.selR; if(!r){ toast('Chọn ô ở các dòng cần xoá trước'); return; }
  S._tkSel={}; for(var y=r[0]; y<=r[1]; y++){ var m=B.meta[y]; if(m&&m.k==='it') S._tkSel[m.id]=1; }
  if(!Object.keys(S._tkSel).length){ toast('Vùng chọn không có dòng sản phẩm'); return; }
  tkBulkDel_();
}
// Ô người dùng sửa -> đúng quy tắc bảng cũ (tkFieldsFor_). Dán nhiều ô: gom lại, ghi 1 lô (tkApplyEdits_). Dùng cho 'tk' + 'cp'
function btLineGhi_(k){ return function(x,y,val){ btLineGhiO_(k,x,y,val); }; }
function btLineGhiO_(k,x,y,val){
  var B=btCtx_(k), m=B.meta[y], c=B.cols[x]; if(!m||m.k!=='it'||!c) return;
  var l=lineOf_(m.id), f=l&&tkFieldsFor_(l,c[0],val);
  B.q=B.q||[]; if(f) B.q.push({id:m.id, fields:f});
  clearTimeout(B.t);
  B.t=setTimeout(function(){
    var q=B.q; B.q=[];
    if(!q.length){ btVe_(k); return; }                    // ô không nhận giá trị này -> trả số cũ
    if(q.length===1) editLine(q[0].id,q[0].fields); else tkApplyEdits_(q,'Đã sửa');
  },0);
}

/* ═══ BẢNG CHI PHÍ ('cp') ═══
   Cùng dòng S.lines + cùng ô sửa với Bóc tách; nhóm theo Gom theo (hạng mục / tầng / NCC), dòng nhóm mang vốn · LN · bán,
   dòng TỔNG ở cuối. renderChiphi() vẽ lại cả trang mỗi lần sửa -> giữ nguyên khung lưới (chuyển sang chỗ mới), chỉ ghi số mới. */
var CP_TO={lo:'#fdecea', thap:'#fff4dc'};
function cpSheetGrid_(cols, rows){
  var out=[], meta=[], by=cpBy_();
  function tongRow(nhan,t){ return cols.map(function(c,i){ var k=c[0];
    if(i===1) return nhan; if(k==='giaDaiLy') return btMoney_(t.von); if(k==='lnVnd') return btMoney_(t.ln);
    if(k==='thanhTien') return btMoney_(t.ban); if(k==='soLuong') return btSl_(t.sl); return ''; }); }
  function them(list,pre){ list.forEach(function(l,i){
    out.push(cols.map(function(c){ return tkSheetO_(l,c[0],pre+(i+1)); })); meta.push({k:'it', id:l.lineId, w:cpWarn_(l)}); }); }
  if(by) cpGroupsOf_(rows,by).forEach(function(g,gi){
      var r=tongRow(g.ten+'  ·  '+g.list.length+' dòng', g.t); r[0]=PT_ROMAN[gi]||String(gi+1);
      out.push(r); meta.push({k:'sec', g:g.k}); them(g.list,(gi+1)+'.'); });
  else them(rows,'');
  var T=cpTotOf_(rows); out.push(tongRow('TỔNG · '+T.n+' hạng mục',T)); meta.push({k:'tot'});
  return {rows:out, meta:meta};
}
// Gọi từ renderChiphi() sau khi trang vừa vẽ lại: gắn lại khung cũ vào #cpSheetSlot (hoặc tạo mới) rồi vẽ lưới
function cpSheetGan_(keys, rows){
  var cols=[['stt','STT']].concat(keys.map(function(k){ return [k,cpLabel_(k)]; }));
  btGan_('cp', cols, function(){ return cpSheetGrid_(cols, rows); }, keys.join()+'|'+cpBy_(), cpSheetMenu_);
}
/* Gắn lưới vào #{k}SheetSlot cho tab vẽ lại cả trang mỗi lần sửa (Chi phí 'cp', Dự án 'da'):
   giữ nguyên khung cũ (chuyển sang chỗ mới, giữ vị trí cuộn), cùng cột + cùng dòng -> chỉ ghi số mới. */
function btGan_(k, cols, lamLuoi, sigX, menu){
  var B=btCtx_(k), slot=document.getElementById(k+'SheetSlot'); if(!slot) return;
  if(B.frame){ var c=B.frame.querySelector('.jss_content'), sT=c?c.scrollTop:0, sL=c?c.scrollLeft:0;
    slot.parentNode.replaceChild(B.frame, slot); if(c){ c.scrollTop=sT; c.scrollLeft=sL; } }
  else { slot.outerHTML=btFrame_(k); B.frame=document.getElementById(k+'Sheet').parentNode; B.ws=null; }
  var g=lamLuoi(), host=document.getElementById(k+'Sheet');
  var sig=sigX+'|'+g.meta.map(function(m){ return m.k==='it'?(m.id+(m.w||'')):(m.k+(m.g||'')); }).join();
  if(btSong_(k) && B.sig===sig){ btGhiLuoi_(k, g.rows); return; }
  B.sig=sig;
  var st={}, ro=[], merge={}, iTen=-1; cols.forEach(function(c,i){ if(c[0]==='ten') iTen=i; });
  var frz=(iTen>0&&iTen<4)?iTen+1:2;
  g.meta.forEach(function(m,y){
    // tên nhóm gộp ô tới trước ô có số đầu tiên; đang cố định cột thì chỉ gộp trong phần cố định (lý do: xem tkSheetVe_)
    if(m.k!=='it'){ var het=cols.length; for(var i=2;i<cols.length;i++) if(g.rows[y][i]!==''){ het=i; break; }
      if(B.frz) het=Math.min(het,frz); if(het>2) merge[btColLetter_(1)+(y+1)]=[het-1,1]; }
    cols.forEach(function(c,x){ var ten=btColLetter_(x)+(y+1);
      if(m.k==='sec') st[ten]='background-color:#e8eaed;font-weight:700;';
      else if(m.k==='tot') st[ten]='background-color:#e8f0fe;font-weight:700;border-top:2px solid #1f3a5f;';
      else if(CP_TO[m.w]) st[ten]='background-color:'+CP_TO[m.w]+';';
      else if(c[0]==='dvt') st[ten]='font-style:italic;';
      if(m.k!=='it' || c[0]==='stt' || !tkSheetSua_(c[0])) ro.push(ten);
    });
  });
  btTao_(k, host, cols, g.meta, cols.map(function(c){ return TK_SO[c[0]]?'n':(TK_GIUA[c[0]]?'c':''); }), {
    data:g.rows, style:st, merge:merge, frz:frz, h:'calc(100vh - 140px)', menu:menu,
    columns:cols.map(function(c){ var kk=c[0];
      return {title:c[1], width:kk==='stt'?58:Math.max(colW(kk),TK_MINW_[kk]||60), type:(kk==='hinhAnh'||kk==='taiLieu')?'html':'text',
        align:TK_SO[kk]?'right':(TK_GIUA[kk]?'center':'left'), wordWrap:kk==='ten'||kk==='moTa'||kk==='kichThuoc'}; })
  }, btLineGhi_(k), ro, TK_NOI_BO);
}
/* ═══ TAB DỰ ÁN ('da') — mọi dòng của dự án gom theo tầng, dòng tầng mang tổng tầng, dòng TỔNG cuối ═══ */
function daSheetGrid_(cols, order, groups, lines){
  var out=[], meta=[], iTT=-1;
  cols.forEach(function(c,i){ if(c[0]==='thanhTien') iTT=i; });
  order.forEach(function(g,gi){
    var r=cols.map(function(){ return ''; }); r[0]=PT_ROMAN[gi]||String(gi+1); if(cols.length>1) r[1]=g;
    if(iTT>1) r[iTT]=btMoney_(groups[g].reduce(function(s,l){ return s+ttBan_(l); },0));
    out.push(r); meta.push({k:'sec', g:g});
    groups[g].forEach(function(l,ri){ out.push(cols.map(function(c){ return tkSheetO_(l,c[0],(gi+1)+'.'+(ri+1)); })); meta.push({k:'it', id:l.lineId}); });
  });
  var t=cols.map(function(c,i){ if(i===1) return 'TỔNG · '+lines.length+' SP';
    if(c[0]==='thanhTien') return btMoney_(lines.reduce(function(s,l){ return s+ttBan_(l); },0));
    if(c[0]==='soLuong') return btSl_(lines.reduce(function(s,l){ return s+(Number(l.soLuong)||0); },0)); return ''; });
  out.push(t); meta.push({k:'tot'});
  return {rows:out, meta:meta};
}
function daSheetGan_(keys, order, groups, lines){
  var cols=[['stt','STT']].concat(keys.map(function(k){ return [k,cpLabel_(k)]; }));
  btGan_('da', cols, function(){ return daSheetGrid_(cols, order, groups, lines); }, keys.join(), daSheetMenu_);
}
function daSheetMenu_(e, x, y, td){
  var B=btCtx_('da'), m=y>=0?B.meta[y]:null, c=B.cols[x], k=c&&c[0]; closePop();
  if(y>=0 && !(B.selR && y>=B.selR[0] && y<=B.selR[1])) B.ws.updateSelectionFromCoords(x,y,x,y);
  function mi(ic,label,fn,hint){ return '<div class="cmi" onclick="'+fn+'">'+icon(ic,14)+'<span>'+label+'</span>'+(hint?'<i class="cmi-k">'+hint+'</i>':'')+'</div>'; }
  var h='';
  if(k && k!=='stt'){ h+='<div class="cmh">Cột: '+esc(c[1])+'</div>'
      +mi('up','Sắp xếp tăng dần','closePop();daSort(\''+k+'\',\'asc\')')
      +mi('down','Sắp xếp giảm dần','closePop();daSort(\''+k+'\',\'desc\')')
      +(S._daSort?mi('close','Bỏ sắp xếp','closePop();S._daSort=\'\';renderDuAn()'):'')
      +(m&&m.k==='it'&&tkSheetSua_(k)?mi('down','Điền giá trị ô này xuống cả cột','closePop();btDien_(\'da\','+x+','+y+')'):'')
      +(k!=='ten'?mi('eye','Ẩn cột này','closePop();daColToggle(\''+k+'\')'):'')
      +'<div class="cmsep"></div>'; }
  h+=mi('search','Tìm & thay thế','closePop();btFind_(\'da\')','Ctrl+F');
  var pop=document.createElement('div'); pop.className='fltpop ctxmenu'; pop.id='qs_pop'; pop.innerHTML=h; document.body.appendChild(pop);
  pop.style.left=Math.max(8,Math.min(e.clientX, window.innerWidth-pop.offsetWidth-12))+'px';
  pop.style.top=Math.max(8,Math.min(e.clientY, window.innerHeight-pop.offsetHeight-12))+'px';
  setTimeout(function(){ document.addEventListener('mousedown',popOutside); },0);
}
function cpSheetMenu_(e, x, y, td){
  var B=btCtx_('cp'), m=y>=0?B.meta[y]:null, c=B.cols[x], k=c&&c[0]; closePop();
  if(y>=0 && !(B.selR && y>=B.selR[0] && y<=B.selR[1])) B.ws.updateSelectionFromCoords(x,y,x,y);
  function mi(ic,label,fn,hint){ return '<div class="cmi" onclick="'+fn+'">'+icon(ic,14)+'<span>'+label+'</span>'+(hint?'<i class="cmi-k">'+hint+'</i>':'')+'</div>'; }
  var h='';
  if(k && k!=='stt'){ h+='<div class="cmh">Cột: '+esc(c[1])+'</div>'
      +mi('up','Sắp xếp tăng dần','closePop();S._cpSort=\''+k+'\';S._cpSortDir=\'asc\';renderChiphi()')
      +mi('down','Sắp xếp giảm dần','closePop();S._cpSort=\''+k+'\';S._cpSortDir=\'desc\';renderChiphi()')
      +(S._cpSort?mi('close','Bỏ sắp xếp','closePop();S._cpSort=\'\';renderChiphi()'):'')
      +(m&&m.k==='it'&&tkSheetSua_(k)?mi('down','Điền giá trị ô này xuống cả cột','closePop();btDien_(\'cp\','+x+','+y+')'):'')
      +(k!=='ten'?mi('eye','Ẩn cột này','closePop();cpToggle(\''+k+'\')'):'')
      +'<div class="cmsep"></div>'; }
  h+=mi('search','Tìm & thay thế','closePop();btFind_(\'cp\')','Ctrl+F');
  var pop=document.createElement('div'); pop.className='fltpop ctxmenu'; pop.id='qs_pop'; pop.innerHTML=h; document.body.appendChild(pop);
  pop.style.left=Math.max(8,Math.min(e.clientX, window.innerWidth-pop.offsetWidth-12))+'px';
  pop.style.top=Math.max(8,Math.min(e.clientY, window.innerHeight-pop.offsetHeight-12))+'px';
  setTimeout(function(){ document.addEventListener('mousedown',popOutside); },0);
}

// Khung kiểu GOOGLE SHEETS (theo mẫu): 1 hàng công cụ gọn · lưới. Chỉ đặt nút CHẠY THẬT.
var BT_SVG={
  undo:'<path d="M9 14 4 9l5-5"/><path d="M4 9h11a5 5 0 0 1 0 10h-3"/>',
  redo:'<path d="m15 14 5-5-5-5"/><path d="M20 9H9a5 5 0 0 0 0 10h3"/>',
  print:'<path d="M6 9V3h12v6"/><rect x="4" y="9" width="16" height="8" rx="1"/><path d="M7 14h10v7H7z"/>',
  filter:'<path d="M3 4h18l-7 8.5V19l-4 2v-8.5z"/>',
  freeze:'<rect x="3" y="3" width="18" height="18" rx="1"/><path d="M9 3v18M3 9h18"/>',
  sum:'<path d="M18 4H6l6 8-6 8h12"/>',
  wrap:'<path d="M3 6h18M3 12h15a3 3 0 0 1 0 6h-4"/><path d="m16 16-2 2 2 2"/><path d="M3 18h7"/>',
  cut:'<circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M20 4 8.12 15.88M14.47 14.48 20 20M8.12 8.12 12 12"/>',
  copy:'<rect x="8" y="8" width="13" height="13" rx="2"/><path d="M4 16V5a1 1 0 0 1 1-1h11"/>',
  paste:'<rect x="8" y="2" width="8" height="4" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/>',
  al:'<path d="M4 6h16M4 10h10M4 14h16M4 18h10"/>', ac:'<path d="M4 6h16M7 10h10M4 14h16M7 18h10"/>', ar:'<path d="M4 6h16M10 10h10M4 14h16M10 18h10"/>',
  xoaf:'<path d="m7 21-4-4 10-10 6 6-8 8H7z"/><path d="M14 21h7"/>',
  chen:'<path d="M3 5h18M3 19h18"/><path d="M12 9v6M9 12h6"/>',
  nhan:'<rect x="3" y="3" width="13" height="8" rx="1"/><rect x="8" y="13" width="13" height="8" rx="1"/>',
  az:'<path d="M3 16l4 4 4-4M7 20V4"/><path d="M14 4h6l-6 7h6M14 20l3-7 3 7M15 18h4"/>',
  za:'<path d="M3 8l4-4 4 4M7 4v16"/><path d="M14 4h6l-6 7h6M14 20l3-7 3 7M15 18h4"/>',
  dien:'<path d="M12 3v14M6 11l6 6 6-6"/><path d="M4 21h16"/>'
};
function btI_(k){ return '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">'+BT_SVG[k]+'</svg>'; }
function btFrame_(k){
  var B=btCtx_(k), z=B.zoom, fs=B.font;
  function b(html,tip,fn,on){ return '<button class="gs-b'+(on?' on':'')+'" title="'+tip+'" onclick="'+fn+'">'+html+'</button>'; }
  var sep='<span class="gs-sep"></span>', w='S._bt.'+k+'.ws';
  var q='\''+k+'\'', dong=(k!=='pt');        // Phần thô: thao tác dòng làm ở bảng thường (công tác theo nhóm)
  return '<div class="gs">'
    // Hàng 1 — "Trang đầu": hoàn tác · bộ nhớ tạm · chữ · định dạng ô · thống kê
    +'<div class="gs-bar">'
      +b(btI_('undo'),'Hoàn tác (Ctrl+Z)',w+'&&'+w+'.undo()')+b(btI_('redo'),'Làm lại (Ctrl+Y)',w+'&&'+w+'.redo()')
      +sep+b(btI_('cut'),'Cắt (Ctrl+X)','btCopy_('+q+',1)')+b(btI_('copy'),'Sao chép (Ctrl+C)','btCopy_('+q+')')+b(btI_('paste'),'Dán (Ctrl+V)','btPaste_('+q+')')
      +sep+b('−','Giảm cỡ chữ','btFont_('+q+',-1)')+'<span class="gs-fs">'+fs+'</span>'+b('+','Tăng cỡ chữ','btFont_('+q+',1)')
      +sep+b('<b>B</b>','Đậm (Ctrl+B) — chỉ đánh dấu trên bảng tính, không in ra báo giá','btFmtSet_('+q+',\'b\')')
      +b('<i style="font-family:Georgia,serif">I</i>','Nghiêng (Ctrl+I)','btFmtSet_('+q+',\'i\')')
      +b('<u>U</u>','Gạch chân (Ctrl+U)','btFmtSet_('+q+',\'u\')')
      +'<label class="gs-b gs-clr" title="Màu chữ"><b>A</b><i class="gs-clr-bar" style="background:#d93025"></i><input type="color" value="#d93025" onchange="btFmtSet_('+q+',\'c\',this.value);this.previousElementSibling.style.background=this.value"></label>'
      +'<label class="gs-b gs-clr" title="Màu nền ô">'+icon('color',15)+'<i class="gs-clr-bar" style="background:#fff59d"></i><input type="color" value="#fff59d" onchange="btFmtSet_('+q+',\'bg\',this.value);this.previousElementSibling.style.background=this.value"></label>'
      +sep+b(btI_('al'),'Căn trái','btFmtSet_('+q+',\'al\',\'l\')')+b(btI_('ac'),'Căn giữa','btFmtSet_('+q+',\'al\',\'c\')')+b(btI_('ar'),'Căn phải','btFmtSet_('+q+',\'al\',\'r\')')
      +b(btI_('wrap'),'Xuống dòng trong ô','btFmtSet_('+q+',\'wrap\')')
      +b(btI_('xoaf'),'Xoá định dạng vùng chọn','btFmtSet_('+q+',\'*\')')
      +sep+'<span class="gs-sumic" title="Chọn nhiều ô để xem tổng · bấm số để chép">'+btI_('sum')+'</span><span class="gs-sum" id="'+k+'SheetSum"></span>'
    +'</div>'
    // Hàng 2 — "Dữ liệu": tìm · dòng · sắp xếp · điền · lọc · hiển thị · xuất
    +'<div class="gs-bar gs-bar2">'
      +b(icon('search',17),'Tìm & thay (Ctrl+F)','btFind_('+q+')')
      +(dong?sep+b(btI_('chen'),'Chèn dòng trống','btChenDong_('+q+')')+b(btI_('nhan'),'Nhân bản dòng đang chọn','btNhanBan_('+q+')'):'')
      +(k==='tk'?b(icon('trash',17),'Xoá các dòng đang chọn','tkSheetDel_()'):'')
      +(dong?sep+b(btI_('az'),'Sắp xếp A → Z theo cột đang chọn','btSapXep_('+q+',\'asc\')')+b(btI_('za'),'Sắp xếp Z → A theo cột đang chọn','btSapXep_('+q+',\'desc\')'):'')
      +b(btI_('dien'),'Điền xuống (Ctrl+D): ô đầu vùng chọn chép xuống các ô dưới','btDienVung_('+q+')')
      +sep+b(btI_('filter'),'Bật / tắt ô lọc cột (Ctrl+Shift+L)','btFilter_('+q+')',B.loc)
      +b(btI_('freeze'),'Cố định cột đầu khi cuộn ngang','btFreeze_(\''+k+'\')',B.frz)
      +'<button class="gs-b gs-txt gs-gonb'+(B.gon?'':' on')+'" title="Gọn: mỗi dòng 1 hàng chữ (rê chuột xem đủ) · Đủ chữ: hiện hết nội dung ô" onclick="btGon_(\''+k+'\')">'+btGonNhan_(B.gon)+'</button>'
      +'<select class="gs-zoom" title="Thu phóng" onchange="btZoom_('+q+',this.value)">'
        +[50,75,90,100,125,150,200].map(function(v){ return '<option value="'+v+'"'+(v===z?' selected':'')+'>'+v+'%</option>'; }).join('')+'</select>'
      +sep+b(btI_('print'),'In bảng','btPrint_('+q+')')
      +b(icon('download',17),'Xuất Excel',k==='pt'?'ptExportXlsx()':(k==='cp'?'cpXuatExcel_(this)':(k==='da'?'daXuatExcel_(this)':'btXlsx_('+q+')')))
      +'<span style="flex:1"></span>'
      +(k==='tk'?'<button class="gs-b gs-txt" id="tkColBtn" onclick="tkColPop_(event)" title="Chọn cột hiển thị"></button><span class="gs-tools" id="tkSheetTools"></span>':'')
      +((k==='cp'||k==='da')?'<span class="gs-tools">'+pgToolsHtml_(k)+'</span>':'')
    +'</div>'
    // Thanh công thức: địa chỉ ô + nội dung ô đang chọn (sửa rồi Enter)
    +'<div class="gs-fx"><span class="gs-fx-addr" id="'+k+'FxAddr">A1</span><span class="gs-fx-ic">fx</span>'
      +'<input id="'+k+'FxIn" placeholder="Chọn 1 ô để xem / sửa nội dung" onkeydown="if(event.key===\'Enter\'){btFxGhi_('+q+',this.value);this.blur();}else if(event.key===\'Escape\'){btFxSync_('+q+');this.blur();}" onchange="btFxGhi_('+q+',this.value)"></div>'
    +'<div id="'+k+'Sheet" class="gs-grid'+(B.gon?' gs-gon':'')+'" style="--gsfs:'+fs+'px'+(z!==100?';zoom:'+(z/100):'')+'"></div>'
    +(k==='tk'?'<div class="gs-foot" id="tkSheetFoot"></div>':'')
  +'</div>';
}
function ptSheetFrame_(){ return btFrame_('pt'); }
// Chọn vùng ô: Σ Tổng · TB · Đếm ngay trên hàng công cụ
function btSum_(k,inst,x1,y1,x2,y2){
  var B=btCtx_(k); B.sel=[Math.min(x1,x2),Math.min(y1,y2)]; B.selR=[Math.min(y1,y2),Math.max(y1,y2)]; B.selX=[Math.min(x1,x2),Math.max(x1,x2)];
  btFxSync_(k);
  var el=document.getElementById(k+'SheetSum'); if(!el) return;
  var s=0, n=0, so=0, mn=Infinity, mx=-Infinity;
  for(var y=Math.min(y1,y2); y<=Math.max(y1,y2); y++) for(var x=Math.min(x1,x2); x<=Math.max(x1,x2); x++){
    var v=btChu_(inst.getValueFromCoords(x,y)).trim(); if(!v) continue; n++;
    if(/^-?[\d.,]+%?$/.test(v)){ var so1=tkNum_(v); s+=so1; so++; if(so1<mn) mn=so1; if(so1>mx) mx=so1; } }
  function f(v){ return v.toLocaleString('vi-VN',{maximumFractionDigits:2}); }   // giữ số lẻ (khối lượng 3,5)
  function o(nhan,v){ return '<span class="gs-st" title="Bấm để chép số này" onclick="btChep_(\''+f(v)+'\')">'+nhan+': <b>'+f(v)+'</b></span>'; }
  el.innerHTML = n<2 ? '' : ((so?(o('Tổng',s)+o('TB',s/so)+o('Min',mn)+o('Max',mx)):'')+'<span>Đếm: <b>'+n+'</b></span>');
}
function btFreeze_(k){ var B=btCtx_(k); B.frz=!B.frz; btVeLai_(k); }
function btZoom_(k,v){ var B=btCtx_(k); B.zoom=Number(v)||100;
  var h=document.getElementById(k+'Sheet'); if(h) h.style.zoom=(B.zoom/100); }
function btFont_(k,d){ var B=btCtx_(k); B.font=Math.max(10,Math.min(20,B.font+d));
  var h=document.getElementById(k+'Sheet'); if(!h) return; h.style.setProperty('--gsfs',B.font+'px');
  var f=h.parentNode.querySelector('.gs-fs'); if(f) f.textContent=B.font; }
// Tìm: ô kế tiếp (sau ô đang chọn) có chứa chữ cần tìm -> chọn + cuộn tới
async function btFind_(k){
  var B=btCtx_(k), ws=B.ws; if(!ws) return;
  var r=await askInput_({ title:'Tìm & thay trong bảng', required:false, ok:'Tìm / Thay',
    fields:[{key:'q',label:'Tìm',value:B.findQ||''},{key:'rep',label:'Thay bằng (để trống = chỉ tìm ô kế tiếp)',value:''}] }); if(r==null) return;
  var q=String(r.q||'').trim(); B.findQ=q; if(!q) return;
  if(r.rep) return btThay_(k,q,r.rep);
  var d=ws.getData(), nx=(d[0]||[]).length, cur=B.sel?(B.sel[1]*nx+B.sel[0]):-1, kq=spNorm_(q);
  for(var i=1;i<=d.length*nx;i++){ var p=(cur+i)%(d.length*nx), y=Math.floor(p/nx), x=p%nx;
    if(spNorm_(btChu_(d[y][x])).indexOf(kq)>=0){ ws.updateSelectionFromCoords(x,y,x,y);
      var c=ws.getCellFromCoords(x,y); if(c&&c.scrollIntoView) c.scrollIntoView({block:'center',inline:'nearest'}); return; } }
  toast('Không thấy "'+q+'" trong bảng');
}
// Thay mọi chỗ khớp (không phân biệt hoa thường) trong các ô SỬA ĐƯỢC, ghi bằng đúng hàm ghi của bảng
function btThay_(k,q,rep){
  var B=btCtx_(k), ws=B.ws, d=ws.getData(), re=new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),'gi'), n=0;
  d.forEach(function(row,y){ row.forEach(function(v,x){ v=String(v==null?'':v);
    if(v.indexOf('<')<0 && re.test(v) && !ws.isReadOnly(x,y)){ re.lastIndex=0; B.ghi(x,y,v.replace(re,rep)); n++; } re.lastIndex=0; }); });
  toast(n?('Đã thay '+n+' ô'):('Không có ô sửa được nào chứa "'+q+'"'));
}
function btChu_(v){ v=String(v==null?'':v); return v.indexOf('<')>=0?v.replace(/<[^>]*>/g,'').trim():v; }   // ô html (ảnh, tài liệu) -> chữ
function btBoMui_(v){ return String(v==null?'':v).replace(/^[▾▸]\s*/,''); }   // bỏ ▾/▸ (nút thu gọn tầng) khi in / xuất
function btTen_(k){ return k==='pt'?'Phần thô':(k==='cp'?'Chi phí':(k==='da'?'Sản phẩm trong dự án':(nodeName(S.node)||'Bóc tách'))); }
// In: dựng bảng HTML gọn từ đúng dữ liệu đang hiện (tên cột + nhóm + dòng); ảnh in ra ảnh
function btPrint_(k){
  var B=btCtx_(k), ws=B.ws; if(!ws) return;
  var d=ws.getData();
  var th='<tr>'+B.cols.map(function(c){ return '<th>'+esc(c[1])+'</th>'; }).join('')+'</tr>';
  var tb=d.map(function(r,y){ return '<tr'+(B.meta[y]&&B.meta[y].k==='sec'?' class="s"':'')+'>'+r.map(function(v,x){
      v=String(v==null?'':v);
      return '<td class="'+B.al[x]+'">'+(/^<img /.test(v)?v.replace(/ on\w+="[^"]*"/g,''):esc(btBoMui_(btChu_(v))))+'</td>'; }).join('')+'</tr>'; }).join('');
  var w=window.open('','_blank'); if(!w){ toast('Cho phép popup để in'); return; }
  w.document.write('<!doctype html><title>'+esc(btTen_(k))+' — '+esc((S.cur&&S.cur.ten)||'')+'</title><style>@page{size:A4 landscape;margin:10mm}'
    +'body{font:11px Montserrat,Arial,sans-serif}table{border-collapse:collapse;width:100%}th{background:#1f3a5f;color:#fff;font-size:10px;padding:6px 4px;border:1px solid #2d4a6e}'
    +'td{padding:4px;border:1px solid #dadce0;vertical-align:top}td.n{text-align:right}td.c{text-align:center}tr.s td{background:#e8eaed;font-weight:700}img{max-width:60px;max-height:60px}</style>'
    +'<h3>'+esc((S.cur&&S.cur.ten)||'')+' — '+esc(btTen_(k))+'</h3><table>'+th+tb+'</table>');
  w.document.close(); setTimeout(function(){ w.focus(); w.print(); },600);
}
// Xuất Excel đúng bảng đang thấy (bỏ cột ảnh / tài liệu): dòng nhóm gộp ô, ô số giữ kiểu số
async function btXlsx_(k){
  var B=btCtx_(k), ws=B.ws; if(!ws||!S.cur) return;
  var giu=[]; B.cols.forEach(function(c,x){ if(c[0]!=='hinhAnh'&&c[0]!=='taiLieu') giu.push(x); });
  var d=ws.getData(), rows=d.map(function(r,y){
    if(B.meta[y].k==='sec') return {group:btBoMui_(r[0])+'. '+btChu_(r[1])};
    return {cells:giu.map(function(x){ var v=btChu_(r[x]); return (B.al[x]==='n'&&v)?tkNum_(v):v; })}; });
  var ten=(k==='tk'?'BÓC TÁCH — ':'')+btTen_(k).toUpperCase()+' — '+(S.cur.ten||S.cur.maDA);
  try{ await taiFile_('/export/bang',{ ten:ten, sheet:k==='da'?'Du an':'Boc tach',
      cols:giu.map(function(x){ return {label:B.cols[x][1], num:B.al[x]==='n'}; }), rows:rows },
      (k==='da'?'du-an-':'boc-tach-')+S.cur.maDA+'.xlsx'); }
  catch(e){ toast('Lỗi xuất Excel: '+e.message); }
}
// Bật/tắt hàng lọc dưới tiêu đề cột (dựng lại lưới; dữ liệu không đổi)
function btFilter_(k){ var B=btCtx_(k); B.loc=!B.loc; btVeLai_(k); if(B.loc) toast('Bấm vào ô dưới tên cột để lọc'); }
