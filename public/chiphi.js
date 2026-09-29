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
  var stat=pgHeadRow_('cpHmBtn', scope.length,
      pgStat_('Vốn',money(von)+' đ')+pgStat_('Giá bán',money(ban)+' đ')
     +pgStat_('Lợi nhuận',money(lnT)+' đ','ln '+lnCls)+pgStat_('Biên',bien.toFixed(1)+'%','ln '+lnCls)
     +'<span class="tkt-i">'+pgVat_()+'<b>'+money(vat)+' đ</b></span>'
     +pgStat_('Tổng',money(ban+vat)+' đ','grand'));

  box.innerHTML='<div class="sechd"><h2>Chi phí</h2><span class="count">'+scope.length+'</span>'
      +'<span class="sp" style="flex:1"></span>'
      +'<span class="cp-hint">'+icon('sliders',13)+' Bấm thẳng vào ô để sửa giá NCC · CK · %LN · giá bán — số tính lại ngay</span></div>'
    +stat+hmPTNote_()+hmLacNote_(scope.length)
    +cpToolbar_(rows, scope)
    +pgTblHost_('cp', cpTableHtml_(keys,rows));
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
  // hàng tìm / lọc nằm GỌN TRONG khối "Công cụ bảng" -> tab chỉ còn 3 khối rõ ràng
  var bar='<div class="cp-bar">'+tim+loc+ket+'<span style="flex:1"></span>'
    +'<button class="btn ghost sm'+(S._cpGroup?' on':'')+'" onclick="cpToggleGroup()" title="Gom các dòng theo hạng mục và cộng tổng từng nhóm">'
      +icon('layers',14)+' Gom theo hạng mục</button>'
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
