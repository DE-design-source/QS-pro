/* ═══ TAB CHI PHÍ — bảng giá vốn / lợi nhuận, lọc, sắp xếp, dòng sai ngành, chọn nhanh % lợi nhuận.
   Dùng tkSelLines_ / tkApplyEdits_ của boc.js. ═══ */
'use strict';

/* ===== CHI PHÍ (bảng linh hoạt + chip chọn cột) ===== */
function cpToggle(k){ S.cpCols=S.cpCols||{}; S.cpCols[k]=!S.cpCols[k]; renderChiphi(); }
function cpSigned_(v){ v=Math.round(Number(v)||0); return '<span class="'+(v<0?'cp-neg':(v>0?'cp-pos':''))+'">'+money(v)+'</span>'; }
/* Hàng đầu bảng giống Bóc tách: "Hạng mục đã bóc [n]" + ô chọn hạng mục (viên thuốc ⊕) + dòng số liệu gọn */
function pgHeadRow_(id, n, stats){
  var hm=hmGet_();
  return '<div class="pgh"><span class="pgh-lbl">Hạng mục đã bóc</span><span class="count">['+pad2(n)+']</span>'
    +'<button class="tree-btn hm-open pgh-pill'+(hm?' on':'')+'" id="'+id+'" onclick="hmPop_(event,\''+id+'\')" title="Chọn hạng mục">'
      +'<span class="hm-name">'+esc(hm?(hm+'.'+(nodeName(hm)||hm)):'Tất cả hạng mục')+'</span><span class="cnt">['+pad2(n)+']</span></button>'
    +'<span class="pgh-sp"></span>'
    +'<div class="tkt-row pgh-tot">'+stats+'</div>'+blkFold_('totals','dải tổng tiền')+'</div>';
}
/* Khung bảng + 2 thanh kéo (ngang · dọc) tự vẽ — dùng chung cho Chi phí và Dự án.
   Thanh cuộn gốc của trình duyệt bị ẩn toàn app, không có 2 thanh này là bảng rộng
   hơn màn hình không kéo sang phải được. */
function pgTblHost_(id, inner){
  return '<div class="pg-tblhost" id="'+id+'Host">'
    +'<div class="dbcard cp-card">'+inner+'</div>'
    +'<div class="tk-hbar cp-hbar" id="'+id+'HBar" style="display:none"><div class="tk-hthumb" id="'+id+'HThumb"></div></div>'
    +'<div class="tk-vbar" id="'+id+'VBar" style="display:none"><div class="tk-vthumb" id="'+id+'VThumb"></div></div>'
  +'</div>';
}
function pgBarsBind_(id){
  hbarBind_('#'+id+'Host .tbl-wrap', id+'HBar', id+'HThumb');
  vbarBind_('#'+id+'Host','.tbl-wrap', id+'VBar', id+'VThumb');
  foldChipsSync_();                 // nút thu gọn vừa được vẽ lại -> trả đúng trạng thái đang nhớ
}
function pgStat_(lb,val,cls){ return '<span class="tkt-i '+(cls||'')+'"><i>'+lb+'</i><b>'+val+'</b></span>'; }
function pgVat_(){ var v=Number(S.cur&&S.cur.vat)||0;
  return '<i>VAT <input class="tkt-vat" type="number" step="any" min="0" value="'+v+'" onchange="pgSetVat_(this.value)" title="Thuế VAT (%)">%</i>'; }
function pgSetVat_(v){ setVat(v); }                 // setVat đã vẽ lại tab đang mở
// Khung "Cột hiển thị" gập / mở (chung trạng thái với Bóc tách) + bật nhanh tất cả / cơ bản
/* Nút công cụ của bảng — Chi phí / Dự án dùng chung, giống khối "Công cụ bảng" bên Bóc tách */
/* id phải KHÁC NHAU giữa các tab: view của tab cũ không bị xoá khỏi DOM, để trùng id thì
   getElementById lấy nhầm nút của tab đang ẩn (popup nhảy ra góc màn hình).            */
function pgToolsHtml_(k){
  k=k||'pg';
  return '<div class="tk-toolrow"><span class="tk-tgrp">'
    +qbBtn_('pgHist_'+k,QB_IC.hist,'Vừa thêm vào bảng — xem lại / thêm lại','qbHistPop_(event)',false)
    +qbBtn_('pgGia_'+k,QB_IC.gia,giaSyncTitle_(),'giaSyncRun_()',false,giaLechN_())
    +'</span></div>';
}
/* Khối 2 của Chi phí / Dự án: hàng công cụ · hàng lọc-tìm riêng của tab (loc) · hàng chọn cột.
   Cả khối gập lại bằng nút tròn ở góc phải, y như bên Bóc tách.                        */
function pgColFrame_(on,total,chips,fnAll,csKey,btnId,loc){
  return '<div class="pg-cols pg-tools">'
    +'<div class="tk-frame-hr tk-toolhr"><span class="tk-frame-h">Công cụ bảng</span>'+pgToolsHtml_(csKey||'pg')+blkFold_('tools','khối công cụ')+'</div>'
    +(loc||'')
    +'<div class="tk-frame-hr">'
      +'<button class="tk-frame-h fold-h" onclick="foldToggle_(\'cols\')" title="Ẩn / hiện các chip cột">Cột hiển thị <b>'+on+'/'+total+'</b><i class="fold-ic"></i></button>'
      +(csKey?csQuickBtn_(csKey,btnId):'')
      +'<button class="pg-q" onclick="'+fnAll+'(1)">Hiện tất cả</button><button class="pg-q" onclick="'+fnAll+'(0)">Cột cơ bản</button></div>'
    +chips+'</div>';
}
// Bảng Chi phí dùng ĐÚNG key cột + cellInput của Bóc tách -> giao diện/hành vi ô y hệt
var CP_KEYS=['ten','dvt','soLuong','giaNCC','chietKhau','giaDaiLy','lnPct','donGia','ckKhach','donGiaCK','markup','margin','lnVnd','thanhTien'];
function cpLabel_(k){ var c=COLS.filter(function(x){return x[0]===k;})[0]; return c?c[1]:k; }
// Ô tab Chi phí: giống cellInput của Bóc tách, RIÊNG cột Tên bỏ nút ⌕ chọn/tạo SP
/* Ô chọn dòng ở cột STT của bảng Chi phí / Dự án — dùng CHUNG bộ chọn với Bóc tách
   nên thanh "Sửa hàng loạt" chạy được ở cả ba tab. */
function cpSttCell_(l, so){
  return '<td class="ct" data-k="stt"><input type="checkbox" class="tkck" '+(tkSelHas_(l.lineId)?'checked':'')
    +' onclick="tkSelClick_(event,\''+escJs_(l.lineId)+'\')" title="Chọn dòng (giữ Shift để chọn cả vùng)">'
    +'<span class="sttn">'+so+'</span></td>';
}
function cpCell_(l,k){
  if(k==='ten') return '<td class="td-ten" data-k="ten"><div style="display:flex;gap:4px;align-items:center">'
    +'<input class="cin" value="'+esc(l.ten||'')+'" onchange="editLine(\''+l.lineId+'\',{ten:this.value})">'+lnDiffChip_(l)+'</div></td>';
  return tdK_(cellInput(l,k),k);
}
function renderChiphi(){
  var box=document.getElementById('v-chiphi'); if(!box) return;
  if(!S.cur){ box.innerHTML='<div class="sechd"><h2>Chi phí</h2></div>'
    +'<div class="cp-empty">'+icon('money',30)+'<b>Chưa chọn dự án</b>'
    +'<span>Vào <b>Bảng điều khiển</b> chọn hoặc tạo một dự án để xem bảng chi phí.</span></div>'; return; }
  if(!S.cpCols) S.cpCols={ten:1,dvt:1,soLuong:1,giaNCC:1,chietKhau:1,giaDaiLy:1,lnPct:1,donGia:1,thanhTien:1,lnVnd:1};
  if(S._cpOvHide===undefined){ try{ S._cpOvHide=localStorage.getItem('qs_cpOvHide')==='1'; }catch(e){ S._cpOvHide=false; } }
  var keys=CP_KEYS.filter(function(k){ return S.cpCols[k]; });
  var rows=cpRows_();
  var cpBt=btSan_() && btOn_('cp') && rows.length>0;      // chế độ bảng tính (bangtinh.js); không có dòng -> bảng cũ (có lời nhắc)

  /* ---- số liệu tổng: tính trên ĐÚNG HẠNG MỤC đang chọn (phạm vi của cả trang),
     không phụ thuộc ô tìm kiếm / chip lọc trạng thái (những cái đó chỉ là lọc tạm). ---- */
  var hmNow=hmGet_();
  var scope=hmNow?(S.lines||[]).filter(function(l){ var c=String(l.nhom||'');
      return c===hmNow || c.indexOf(hmNow+'.')===0; }):(S.lines||[]);
  var von=0,ban=0; scope.forEach(function(l){ von+=ttVon_(l); ban+=ttBan_(l); });
  var lnT=ban-von, bien=ban>0?(lnT/ban*100):0, lnCls=lnT<0?'red':(lnT>0?'green':'');
  var vatPct=Number(S.cur.vat)||0, vat=Math.round(ban*vatPct/100);
  var stat=pgHeadRow_('cpHmBtn', scope.length,
      pgStat_('Vốn',money(von)+' đ')+pgStat_('Giá bán',money(ban)+' đ')
     +pgStat_('Lợi nhuận',money(lnT)+' đ','ln '+lnCls)+pgStat_('Biên',bien.toFixed(1)+'%','ln '+lnCls)
     +'<span class="tkt-i">'+pgVat_()+'<b>'+money(vat)+' đ</b></span>'
     +pgStat_('Tổng',money(ban+vat)+' đ','grand'));

  box.innerHTML='<div class="sechd"><h2>Chi phí</h2><span class="count">'+scope.length+'</span>'+(btSan_()?btCheDoNut_():'')
      +'<span class="sp" style="flex:1"></span>'
      +'<span class="cp-hint">'+icon('sliders',13)+' Bấm thẳng vào ô để sửa giá NCC · CK · %LN · giá bán — số tính lại ngay</span></div>'
    +stat+hmPTNote_()+hmLacNote_(scope.length)
    +cpOverview_(scope)
    +cpToolbar_(rows, scope)
    +(cpBt?'<div id="cpSheetSlot"></div>':pgTblHost_('cp', cpTableHtml_(keys,rows)));
  if(cpBt){ try{ cpSheetGan_(keys,rows); }
    catch(e){ console.error(e); btSet_('cp',false); btCtx_('cp').frame=null; toast('Bảng tính lỗi — chuyển về bảng cũ'); return renderChiphi(); } }
  markBlocks_('#v-chiphi table.cpflat');
  pgBarsBind_('cp'); tkSelBar_();
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
    if(f==='lo'  && cpWarn_(l)!=='lo') return false;     // chưa có giá bán không tính là lỗ (có chip riêng)
    if(f==='thap' && cpWarn_(l)!=='thap') return false;
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
    case 'thanhTien': return ttBan_(l);
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
// Gom bảng theo: 'hm' hạng mục · 'tang' tầng · 'ncc' nhà cung cấp · '' không gom
function cpBy_(){ if(S._cpBy===undefined){ try{ var v=localStorage.getItem('qs_cpBy'); S._cpBy=(v==null?'hm':v); }catch(e){ S._cpBy='hm'; } } return S._cpBy; }
function cpSetBy(v){ S._cpBy=v; try{ localStorage.setItem('qs_cpBy',v); }catch(e){} renderChiphi(); }
/* ---------- thanh công cụ ---------- */
/* Phần thô (3.1) có bảng riêng, số liệu nằm ở tab Bóc tách chứ không nằm trong
   danh sách dòng của dự án -> các trang đọc S.lines sẽ trống. Báo rõ cho người dùng
   thay vì để bảng rỗng không lời giải thích. */
/* ═══ DÒNG NẰM SAI NGÀNH — sửa lại một lượt ═══
   Bản cũ ghi danh từ form Nhập luôn đóng dấu 3.2.6.1 (Thiết bị đèn), nên sản phẩm vệ sinh
   ghi danh xong nằm ở đề mục đèn: vào Dự án lọc 3.2.5 thấy trống. Chỉ xét các đề mục ngành
   hàng chuẩn -> nhóm tự tạo / đề mục người dùng cố ý chọn ở Bóc tách không bị đụng tới. */
var NGANH_NODES=['3.2.5','3.2.6','3.2.6.1'];
function spByMa_(){ var m={}; (S.products||[]).forEach(function(p){
    var k=String(p.ma||'').trim().toLowerCase(); if(k&&!m[k]) m[k]=p; }); return m; }
function hmSaiNganh_(){
  if(!(S.products||[]).length) return [];
  var byMa=spByMa_();
  return (S.lines||[]).filter(function(l){
    if(NGANH_NODES.indexOf(String(l.nhom||''))<0) return false;
    var p=byMa[String(l.maSP||'').trim().toLowerCase()]; if(!p) return false;
    var nd=spNodeCodeOf_(p); return !!nd && nd!==String(l.nhom||'');
  });
}
function hmSaiNote_(){
  var ds=hmSaiNganh_(); if(!ds.length) return '';
  return '<div class="hm-note">'+icon('layers',15)
    +'<span><b>'+ds.length+' dòng</b> đang nằm ở hạng mục không đúng ngành hàng của sản phẩm '
    +'(ghi danh bằng bản cũ) nên lọc theo hạng mục sẽ không thấy.</span>'
    +'<button class="btn ghost xs" onclick="hmSaiFix_(this)">Chuyển '+ds.length+' dòng về đúng hạng mục</button></div>';
}
async function hmSaiFix_(btn){
  var ds=hmSaiNganh_(); if(!ds.length) return;
  if(!await xacNhan_('Chuyển '+ds.length+' dòng về đúng hạng mục theo ngành hàng của sản phẩm?')) return;
  var byMa=spByMa_(), ok=0, loi='';
  if(btn){ btn.disabled=true; btn.textContent='Đang chuyển…'; }
  for(var i=0;i<ds.length;i++){
    var l=ds[i], p=byMa[String(l.maSP||'').trim().toLowerCase()], nd=p?spNodeCodeOf_(p):'';
    if(!nd) continue;
    try{
      var r=await api('updateLine', l.lineId, { nhom:nd, loai:nodeName(nd) });
      var j=S.lines.indexOf(l);
      if(r&&j>=0) S.lines[j]=r; else { l.nhom=nd; l.loai=nodeName(nd); }
      ok++;
    }catch(e){ loi=loi||e.message; }
  }
  toast(ok?('Đã chuyển '+ok+' dòng về đúng hạng mục'):('Không chuyển được dòng nào'+(loi?(': '+loi):'')));
  refreshActiveTab_();
}
/* Đang lọc 1 hạng mục mà bảng trống TRONG KHI dự án vẫn có sản phẩm ở hạng mục khác
   -> nói thẳng ra và cho bỏ lọc / nhảy tới hạng mục đang có dòng. Trước đây chỉ hiện
   "Chưa có sản phẩm", người dùng ghi danh xong vào xem tưởng là không lưu được.        */
function hmLacNote_(soHien){
  var hm=hmGet_(); if(!hm || soHien || hm==='3.1') return '';
  var all=(S.lines||[]); if(!all.length) return '';
  var dem={}; all.forEach(function(l){ var c=String(l.nhom||'')||'(chưa rõ)'; dem[c]=(dem[c]||0)+1; });
  var ds=Object.keys(dem).sort(function(a,b){ return dem[b]-dem[a]; });
  var ten=function(c){ return nodeName(c)||c; };
  return '<div class="hm-note">'+icon('layers',15)
    +'<span>Dự án đang có <b>'+all.length+' sản phẩm</b> nhưng không dòng nào thuộc <b>'+esc(hm+'.'+ten(hm))+'</b>. '
    +'Sản phẩm đang nằm ở: '+ds.slice(0,4).map(function(c){ return '<b>'+esc(ten(c))+'</b> ('+dem[c]+')'; }).join(' · ')+'.</span>'
    +ds.slice(0,2).map(function(c){ return '<button class="btn ghost xs" onclick="hmSet_(\''+escJs_(c)+'\')">Xem '+esc(ten(c))+'</button>'; }).join('')
    +'<button class="btn ghost xs" onclick="hmSet_(\'\')">Tất cả hạng mục</button></div>';
}
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
  var soLo=scope.filter(function(l){ return cpWarn_(l)==='lo'; }).length;
  var soChuaGia=scope.filter(function(l){ return !(Number(l.donGiaBan)>0); }).length;
  var soChuaVon=scope.filter(function(l){ return !(Number(l.donGiaVon)>0); }).length;
  var soThap=scope.filter(function(l){ return cpWarn_(l)==='thap'; }).length;
  function chip(k,nhan,n,cls){
    if(!n && k) return '';
    return '<button class="cpchip'+(S._cpFlt===k?' on':'')+(cls?' '+cls:'')+'" onclick="cpSetFlt(\'' +k+ '\')">'
      +esc(nhan)+(n!=null?'<i>'+n+'</i>':'')+'</button>';
  }
  var loc='<div class="cp-flt">'
    +'<button class="cpchip'+(!S._cpFlt?' on':'')+'" onclick="cpSetFlt(\'\')">Tất cả<i>'+scope.length+'</i></button>'
    +chip('lo','Đang lỗ',soLo,'warn')
    +chip('thap','Biên < '+cpMinBien_()+'%',soThap,'warn')
    +chip('chuaGia','Chưa có giá bán',soChuaGia)
    +chip('chuaVon','Chưa có giá vốn',soChuaVon)
    +'</div>';
  var tim='<div class="cp-search">'+icon('search',14)
    +'<input id="cpQ" value="'+esc(S._cpQ||'')+'" placeholder="Tìm tên · mã · thương hiệu · phòng…" oninput="if(!event.isComposing)cpSetQ(this.value)" oncompositionend="cpSetQ(this.value)">'
    +((S._cpQ||'')?'<button class="cp-x" title="Xoá tìm kiếm" onclick="cpSetQ(\'\')">✕</button>':'')+'</div>';
  var ket=(S._cpQ||S._cpFlt)?('<span class="cp-found">'+rows.length+' / '+scope.length+' dòng</span>'):'';
  // hàng tìm / lọc nằm GỌN TRONG khối "Công cụ bảng" -> tab chỉ còn 3 khối rõ ràng
  var bar='<div class="cp-bar">'+tim+loc+ket+'<span style="flex:1"></span>'
    +'<div class="cp-seg" title="Gom các dòng và cộng tổng từng nhóm"><span>Gom theo</span>'
      +[['hm','Hạng mục'],['tang','Tầng'],['ncc','NCC'],['','Không gom']].map(function(x){
        return '<button class="'+(cpBy_()===x[0]?'on':'')+'" onclick="cpSetBy(\''+x[0]+'\')">'+x[1]+'</button>'; }).join('')+'</div>'
    +'</div>'
    +'<div class="cp-bar cp-acts">'
      +'<button class="btn ghost sm" onclick="cpBienMucTieu_()" title="Tính lại giá bán để đạt biên lợi nhuận mong muốn">'+icon('gauge',14)+' Biên mục tiêu…</button>'
      +(cpSoNhap_()>1?'<button class="btn ghost sm" onclick="cpSoSanh_()" title="So tổng tiền các bản nháp của dự án này">'+icon('layers',14)+' So sánh '+cpSoNhap_()+' bản nháp</button>':'')
      +'<span style="flex:1"></span>'
      +'<button class="btn ghost sm" id="cpXlsBtn" onclick="cpXuatExcel_(this)" title="Bảng đang xem (đúng cột, lọc, cách gom) ra file Excel">'+icon('download',14)+' Xuất Excel</button>'
    +'</div>';
  return cpColBar_(bar)+(cpLnBulkHien_()?cpLnQuick_():'');
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
  } else if(cpBy_()){
    var gs=cpGroupsOf_(rows,cpBy_()), ord=gs;
    gs.forEach(function(g,gi){
      var list=g.list, t=g.t, ten=g.ten;
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
  var cls=(ln<0?' cp-rowneg':'')+(Number(l.donGiaBan)>0?'':' cp-rownogia')+(cpWarn_(l)==='thap'?' cp-rowlow':'');
  return '<tr class="drow'+cls+(tkSelHas_(l.lineId)?' rowsel':'')+'" data-id="'+l.lineId+'">'+cpSttCell_(l,stt)
    +keys.map(function(k){ return cpCell_(l,k); }).join('')+'</tr>';
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
async function cpQuickLn_(v){
  var rows=cpLnRows_(); if(!rows.length){ toast('Chưa có dòng nào'); return; }
  if(rows.length>1 && !await xacNhan_('Đặt lợi nhuận '+v+'% cho '+rows.length+' dòng?')) return;
  tkApplyEdits_(rows.map(function(l){ return {id:l.lineId, fields:{lnPct:Number(v)}}; }), 'Đã đặt lợi nhuận '+v+'%');
}
async function cpQuickLnAsk_(){
  var v=await askInput_({ title:'Đặt % lợi nhuận', label:'% lợi nhuận trên giá vốn', value:'', placeholder:'VD: 20', ok:'Áp dụng' });
  if(v==null) return; v=(v&&v.v!=null)?v.v:v;
  v=pctIn_(v); if(v==null){ toast('% không hợp lệ'); return; }
  cpQuickLn_(v);
}

/* ═══ TỔNG QUAN + CẢNH BÁO + GOM NHÓM ═══
   Cài đặt theo dự án (lưu du_an_data 'cpCfg'): minBien = biên tối thiểu (%), bienMT = biên mục tiêu dùng gần nhất. */
function cpCfg_(){ return (S._projData&&S._projData.cpCfg)||{}; }
function cpCfgSet_(k,v){ var c=Object.assign({},cpCfg_()); c[k]=v; projDataSet_('cpCfg',c); }
function cpMinBien_(){ var v=cpCfg_().minBien; return (v==null||!isFinite(Number(v)))?15:Number(v); }
function cpSetMinBien(v){
  v=pctIn_(v); if(v==null||v<0||v>=100){ toast('Biên tối thiểu phải từ 0 đến dưới 100%'); renderChiphi(); return; }
  cpCfgSet_('minBien',v); renderChiphi(); }
// Cảnh báo của 1 dòng: 'chuaGia' · 'chuaVon' · 'lo' (lợi nhuận âm) · 'thap' (biên trên giá bán < mức tối thiểu) · ''
function cpWarn_(l){
  if(!(Number(l.donGiaBan)>0)) return 'chuaGia';
  if(!(Number(l.donGiaVon)>0)) return 'chuaVon';
  if(lnVnd_(l)<0) return 'lo';
  var d=donGiaCK_(l), bien=d>0?(d-giaDaiLy_(l))/d*100:0;    // so số CHÍNH XÁC (margin_ đã làm tròn: 14,6% thành 15% -> không bị báo)
  return bien<cpMinBien_() ? 'thap' : '';
}
function cpKeyOf_(l,by){ var v=String((by==='tang'?l.tang:(by==='ncc'?l.ncc:l.nhom))||'').trim(); return v||'__k'; }
function cpKeyName_(k,by){
  if(k==='__k') return by==='ncc'?'Chưa có nhà cung cấp':(by==='tang'?'Chưa phân tầng':'Chưa xếp hạng mục');
  return by==='hm'?(nodeName(k)||k):k; }
// Gom dòng theo hạng mục / tầng / NCC, giữ thứ tự xuất hiện; mỗi nhóm kèm tổng
function cpGroupsOf_(list,by){
  var m={}, ord=[];
  list.forEach(function(l){ var k=cpKeyOf_(l,by); if(!m[k]){ m[k]=[]; ord.push(k); } m[k].push(l); });
  return ord.map(function(k){ return {k:k, ten:cpKeyName_(k,by), list:m[k], t:cpTotOf_(m[k])}; });
}
function cpOvToggle_(){ S._cpOvHide=!S._cpOvHide; try{ localStorage.setItem('qs_cpOvHide',S._cpOvHide?'1':''); }catch(e){} renderChiphi(); }
function cpOverview_(scope){
  if(S._cpOvHide) return '<div class="cpov-min"><button class="btn ghost sm" onclick="cpOvToggle_()">'+icon('gauge',14)+' Hiện tổng quan chi phí</button></div>';
  var T=cpTotOf_(scope), vatPct=Number(S.cur.vat)||0, vat=Math.round(T.ban*vatPct/100), bien=T.ban>0?T.ln/T.ban*100:0, min=cpMinBien_();
  var w={lo:0,thap:0,chuaGia:0,chuaVon:0}; scope.forEach(function(l){ var k=cpWarn_(l); if(k) w[k]++; });
  function card(lb,val,sub,cls){ return '<div class="cpk'+(cls?' '+cls:'')+'"><span class="cpk-l">'+lb+'</span><b class="cpk-v">'+val+'</b>'+(sub?'<span class="cpk-s">'+sub+'</span>':'')+'</div>'; }
  var ws=[['lo','đang lỗ'],['thap','biên dưới '+min+'%'],['chuaGia','chưa có giá bán'],['chuaVon','chưa có giá vốn']].filter(function(x){ return w[x[0]]; });
  var kpis=card('Giá vốn',money(T.von)+' đ',T.n+' dòng')
    +card('Giá bán',money(T.ban)+' đ','chưa gồm VAT')
    +card('Lợi nhuận',money(T.ln)+' đ','biên '+bien.toFixed(1)+'% trên giá bán',T.ln<0?'neg':(bien<min?'low':'pos'))
    +card('VAT '+vatPct+'%',money(vat)+' đ')
    +card('Tổng thanh toán',money(T.ban+vat)+' đ','','grand')
    +'<div class="cpk cpk-warn'+(ws.length?'':' ok')+'"><span class="cpk-l">Cảnh báo</span>'
      +(ws.length ? ws.map(function(x){ return '<button class="cpk-w" onclick="cpSetFlt(\''+x[0]+'\')" title="Lọc các dòng này"><b>'+w[x[0]]+'</b> '+x[1]+'</button>'; }).join('')
                  : '<b class="cpk-v sm">Không có dòng nào cần xem lại</b>')
      +'<label class="cpk-min" title="Dòng có biên lợi nhuận (trên giá bán) thấp hơn mức này bị tô vàng">Biên tối thiểu'
        +'<input type="number" min="0" max="99" step="any" value="'+min+'" onchange="cpSetMinBien(this.value)">%</label></div>';
  if(!scope.length) return '<div class="dbcard cpov">'+cpOvHead_()+'<div class="cpk-row">'+kpis+'</div></div>';
  // biểu đồ theo hạng mục: thanh sáng = giá bán, thanh đậm = giá vốn -> phần lộ ra là lợi nhuận
  var gs=cpGroupsOf_(scope,'hm').sort(function(a,b){ return b.t.ban-a.t.ban; });
  var max=Math.max.apply(null,[1].concat(gs.map(function(g){ return Math.max(g.t.ban,g.t.von); })));
  var bars=gs.slice(0,8).map(function(g){
    var b=g.t.ban>0?g.t.ln/g.t.ban*100:0, cls=g.t.ln<0?' neg':(b<min?' low':'');
    return '<div class="cpb" onclick="hmSet_(\''+escJs_(g.k==='__k'?'':g.k)+'\')" title="'+esc(g.ten)+' — vốn '+money(g.t.von)+' · bán '+money(g.t.ban)+' · bấm để xem riêng">'
      +'<span class="cpb-n">'+esc(g.ten)+'</span>'
      +'<span class="cpb-bar"><i class="b" style="width:'+(g.t.ban/max*100).toFixed(1)+'%"></i><i class="v" style="width:'+(g.t.von/max*100).toFixed(1)+'%"></i></span>'
      +'<span class="cpb-val">'+money(g.t.ban)+'</span><span class="cpb-pct'+cls+'">'+b.toFixed(1)+'%</span></div>'; }).join('')
    +(gs.length>8?'<div class="cpn more">+ '+(gs.length-8)+' hạng mục khác</div>':'');
  var ns=cpGroupsOf_(scope,'ncc').sort(function(a,b){ return b.t.von-a.t.von; }), tv=T.von||1;
  var ncc=ns.slice(0,6).map(function(g){ var p=g.t.von/tv*100;
      return '<div class="cpn" title="'+esc(g.ten)+': '+money(g.t.von)+' đ giá vốn"><span class="cpn-n">'+esc(g.ten)+'</span>'
        +'<span class="cpn-bar"><i style="width:'+p.toFixed(1)+'%"></i></span><span class="cpn-p">'+p.toFixed(1)+'%</span></div>'; }).join('')
    +(ns.length>6?'<div class="cpn more">+ '+(ns.length-6)+' nhà cung cấp khác</div>':'');
  return '<div class="dbcard cpov">'+cpOvHead_()
    +'<div class="cpk-row">'+kpis+'</div>'
    +'<div class="cpov-g">'
      +'<div class="cpov-c"><div class="cpov-t">Theo hạng mục <small><i class="lg b"></i>giá bán <i class="lg v"></i>giá vốn · % = biên</small></div>'+bars+'</div>'
      +'<div class="cpov-c"><div class="cpov-t">Tỷ trọng giá vốn theo nhà cung cấp</div>'+ncc+'</div>'
    +'</div></div>';
}
function cpOvHead_(){ return '<div class="cpov-h"><span class="tk-frame-h">Tổng quan chi phí</span><span style="flex:1"></span>'
  +'<button class="pg-q" onclick="cpOvToggle_()">Thu gọn</button></div>'; }

/* ═══ BIÊN MỤC TIÊU · SO SÁNH BẢN NHÁP · XUẤT EXCEL ═══ */
// Tính lại giá bán các dòng đang áp (vùng chọn > dòng tick > dòng đang hiện) để biên trên giá bán = v%
async function cpBienMucTieu_(){
  var rows=cpLnRows_(), co=rows.filter(function(l){ return giaDaiLy_(l)>0; });
  if(!co.length){ toast('Các dòng đang chọn chưa có giá vốn — nhập giá vốn trước'); return; }
  var v=await askInput_({ title:'Biên lợi nhuận mục tiêu', label:'Biên % trên giá bán — '+cpLnScopeLbl_(),
    value:String(cpCfg_().bienMT==null?'':cpCfg_().bienMT), placeholder:'VD: 25', ok:'Tính giá bán' });
  if(v==null) return; v=(v&&v.v!=null)?v.v:v; v=pctIn_(v);
  if(v==null||v<0||v>=100){ toast('Biên phải từ 0 đến dưới 100%'); return; }
  cpCfgSet_('bienMT',v);
  var edits=co.map(function(l){ return {id:l.lineId, fields:tkFieldsFor_(l,'margin',v)}; }).filter(function(e){ return e.fields; });
  if(!edits.length){ toast('Không tính được giá bán cho dòng nào'); return; }
  if(edits.length>1 && !await xacNhan_({ title:'Đặt biên '+v+'% cho '+edits.length+' dòng?',
      note:'Giá bán từng dòng được tính lại để lợi nhuận bằng '+v+'% giá bán (sau chiết khấu khách).'
        +(rows.length>co.length?'\n'+(rows.length-co.length)+' dòng chưa có giá vốn được bỏ qua.':'') })) return;
  tkApplyEdits_(edits,'Đã đặt biên '+v+'%');
}
function cpSoNhap_(){ var g=currentGroup(); return g?g.drafts.length:0; }
async function cpSoSanh_(){
  var gr=currentGroup(); if(!gr||gr.drafts.length<2){ toast('Dự án này mới có 1 bản nháp'); return; }
  var ov=document.createElement('div'); ov.className='sp-modal-ov'; ov.id='cpCmpOv';
  var dong=function(){ ov.remove(); };
  ov.onclick=function(e){ if(e.target===ov) dong(); };
  ov.innerHTML='<div class="sp-modal cpcmp pd"><div class="pd-head"><h3>'+icon('layers',16)+' So sánh bản nháp — '+esc(gr.name)+'</h3>'
    +'<button class="pd-x" onclick="document.getElementById(\'cpCmpOv\').remove()">✕</button></div>'
    +'<div class="cpcmp-b"><div class="empty" style="padding:24px">Đang tải các bản nháp…</div></div></div>';
  document.body.appendChild(ov);
  var ma=S.cur.maDA;
  var ds=await Promise.all(gr.drafts.map(function(d){
    return d.maDA===ma ? Promise.resolve(S.lines) : api('getLines',d.maDA).catch(function(){ return null; }); }));
  if(!ov.isConnected) return;
  var R=gr.drafts.map(function(d,i){
    if(!ds[i]) return {d:d,i:i,loi:1};
    var t=cpTotOf_(ds[i]), vat=Math.round(t.ban*(Number(d.vat)||0)/100);
    return {d:d,i:i,t:t,tong:t.ban+vat,bien:t.ban>0?t.ln/t.ban*100:0}; });
  var ok=R.filter(function(r){ return !r.loi; });
  var minT=Math.min.apply(null,ok.map(function(r){ return r.tong; })), maxB=Math.max.apply(null,ok.map(function(r){ return r.bien; }));
  var nhieu=ok.length>1;
  ov.querySelector('.cpcmp-b').innerHTML='<table class="cpcmp-t"><tr><th>Bản nháp</th><th class="num">Số dòng</th><th class="num">Giá vốn</th>'
      +'<th class="num">Giá bán</th><th class="num">Lợi nhuận</th><th class="num">Biên</th><th class="num">Tổng gồm VAT</th><th></th></tr>'
    +R.map(function(r){ var cur=r.d.maDA===ma;
      if(r.loi) return '<tr><td>'+esc(draftName_(r.d,r.i))+'</td><td colspan="7" class="muted">Không tải được bản nháp này</td></tr>';
      return '<tr class="'+(cur?'on':'')+'"><td><b>'+esc(draftName_(r.d,r.i))+'</b>'+(cur?' <span class="cpcmp-cur">đang mở</span>':'')+'</td>'
        +'<td class="num">'+r.t.n+'</td><td class="num">'+money(r.t.von)+'</td><td class="num">'+money(r.t.ban)+'</td>'
        +'<td class="num">'+cpSigned_(r.t.ln)+'</td><td class="num'+(nhieu&&r.bien===maxB?' best':'')+'">'+r.bien.toFixed(1)+'%</td>'
        +'<td class="num'+(nhieu&&r.tong===minT?' best':'')+'"><b>'+money(r.tong)+'</b></td>'
        +'<td>'+(cur?'':'<button class="btn ghost xs" onclick="document.getElementById(\'cpCmpOv\').remove();openDraft(\''+escJs_(r.d.maDA)+'\')">Mở</button>')+'</td></tr>'; }).join('')
    +'</table><div class="cpcmp-note">Tô xanh: tổng thấp nhất và biên cao nhất giữa các bản nháp.</div>';
}
// Xuất đúng bảng đang xem: cột đang bật, bộ lọc/tìm kiếm, cách gom
async function cpXuatExcel_(btn){
  if(!S.cur) return;
  var keys=CP_KEYS.filter(function(k){ return S.cpCols[k]; }), rows=cpRows_(), by=cpBy_();
  if(!rows.length){ toast('Không có dòng nào để xuất'); return; }
  var cols=[{label:'STT'}].concat(keys.map(function(k){ return {label:cpLabel_(k), num:cpAlign_(k)==='num'||cpAlign_(k)==='ct'&&k!=='dvt'}; }));
  function val(l,k){ if(k==='ten'||k==='dvt') return String(l[k]||''); var v=cellSortVal_(l,k); return typeof v==='number'?v:(Number(v)||0); }
  var out=[];
  function them(list,pre){ list.forEach(function(l,i){ out.push({cells:[pre+(i+1)].concat(keys.map(function(k){ return val(l,k); }))}); }); }
  if(by) cpGroupsOf_(rows,by).forEach(function(g,gi){
      out.push({group:(ROMAN_[gi]||(gi+1))+'. '+g.ten+'   —   vốn '+money(g.t.von)+' · bán '+money(g.t.ban)+' · lợi nhuận '+money(g.t.ln)});
      them(g.list,(gi+1)+'.'); });
  else them(rows,'');
  var T=cpTotOf_(rows), vp=Number(S.cur.vat)||0, vat=Math.round(T.ban*vp/100);
  if(btn){ btn.disabled=true; }
  try{
    await taiFile_('/export/bang',{ ten:'BẢNG CHI PHÍ — '+(S.cur.ten||S.cur.maDA)+(hmGet_()?(' · '+nodeName(hmGet_())):''), sheet:'Chi phi', cols:cols, rows:out,
      tong:[['Tổng giá vốn',T.von],['Tổng giá bán',T.ban],['Lợi nhuận',T.ln],['VAT '+vp+'%',vat],['Tổng thanh toán',T.ban+vat]] },
      'chi-phi-'+S.cur.maDA+'.xlsx');
    toast('Đã xuất '+rows.length+' dòng ra Excel');
  }catch(e){ toast('Lỗi xuất Excel: '+e.message); }
  if(btn){ btn.disabled=false; }
}
