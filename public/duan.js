/* ═══ TAB DỰ ÁN — bảng phẳng mọi dòng của dự án, gom theo tầng. ═══ */
'use strict';

/* ===== DỰ ÁN — Sản phẩm trong dự án (gom theo tầng, y kiểu Bóc tách) ===== */
var DA_KEYS=['khuVuc','maBanVe','nganh','maSP','ten','thuongHieu','ncc','moTa','kichThuoc','hinhAnh','dvt','soLuong','giaNCC','chietKhau','giaDaiLy','lnPct','donGia','thanhTien'];
function daColToggle(k){ S._daCols=S._daCols||{}; S._daCols[k]=!S._daCols[k]; daColLuu_(); renderDuAn(); }
// cột đang bật + thứ tự cột: nhớ theo máy (trước chỉ trong bộ nhớ -> tải lại trang là mất)
function daColLuu_(){ try{ localStorage.setItem('qs_dacols', JSON.stringify({on:S._daCols, ord:S._daOrder})); }catch(e){} }
function daColDoc_(){ try{ var v=JSON.parse(localStorage.getItem('qs_dacols')||'null'); if(v&&v.on){ S._daCols=v.on; if(Array.isArray(v.ord)) S._daOrder=v.ord; } }catch(e){} }
// Tìm + sắp xếp (giống Chi phí): sắp trong TỪNG tầng, tầng giữ thứ tự của dự án
function daSetQ(v){ S._daQ=v; renderDuAn(); var i=document.getElementById('daQ'); if(i){ i.focus(); i.setSelectionRange(i.value.length,i.value.length); } }
function daSort(k,dir){ if(dir){ S._daSort=k; S._daSortDir=dir; }
  else if(S._daSort!==k){ S._daSort=k; S._daSortDir='asc'; } else if(S._daSortDir==='asc') S._daSortDir='desc'; else S._daSort='';
  renderDuAn(); }
function daSapXep_(list){ var k=S._daSort; if(!k) return list; var d=S._daSortDir==='desc'?-1:1;
  return list.slice().sort(function(a,b){ var x=cellSortVal_(a,k), y=cellSortVal_(b,k);
    if(typeof x!=='number'||typeof y!=='number'){ x=colPlain(a,k); y=colPlain(b,k); return String(x).localeCompare(String(y),'vi',{numeric:true})*d; }
    return (x-y)*d; }); }
// Xuất Excel đúng bảng đang xem (cột · tìm · sắp xếp · gom tầng) — dùng được ở cả bảng thường lẫn bảng tính
async function daXuatExcel_(btn){
  var d=S._daXuat; if(!d||!S.cur) return; var ks=d.keys.filter(function(k){ return k!=='hinhAnh'&&k!=='taiLieu'; });
  var NUM={soLuong:1,giaNCC:1,giaDaiLy:1,donGia:1,donGiaCK:1,thanhTien:1,lnVnd:1,chietKhau:1,lnPct:1,ckKhach:1,markup:1,margin:1};
  var rows=[]; d.order.forEach(function(g,gi){ rows.push({group:(PT_ROMAN[gi]||(gi+1))+'. '+g});
    d.groups[g].forEach(function(l,ri){ rows.push({cells:[(gi+1)+'.'+(ri+1)].concat(ks.map(function(k){ return NUM[k]?cellSortVal_(l,k):String(tkSheetO_(l,k,'')); }))}); }); });
  var ban=d.lines.reduce(function(s,l){ return s+ttBan_(l); },0), vp=Number(S.cur.vat)||0, vat=Math.round(ban*vp/100);
  if(btn) btn.disabled=true;
  try{ await taiFile_('/export/bang',{ ten:'SẢN PHẨM TRONG DỰ ÁN — '+(S.cur.ten||S.cur.maDA), sheet:'Du an',
      cols:[{label:'STT'}].concat(ks.map(function(k){ return {label:cpLabel_(k), num:!!NUM[k]}; })), rows:rows,
      tong:[['Chưa VAT',ban],['VAT '+vp+'%',vat],['Tổng',ban+vat]] }, 'du-an-'+S.cur.maDA+'.xlsx');
    toast('Đã xuất '+d.lines.length+' dòng ra Excel'); }
  catch(e){ toast('Lỗi xuất Excel: '+e.message); }
  if(btn) btn.disabled=false;
}
// kéo đổi vị trí cột (tab Dự án)
function daColDragStart(e,k){ if(e.target&&e.target.closest&&e.target.closest('.thrsz')){ e.preventDefault(); return; } S._daDragK=k; try{ e.dataTransfer.setData('text/plain',k); }catch(x){} }
function daColDrop(e,k){ e.preventDefault(); var from=S._daDragK; S._daDragK=null; if(!from||from===k) return;
  var ord=(S._daOrder||DA_KEYS.slice()).filter(function(x){ return x!==from; });
  var idx=ord.indexOf(k); if(idx<0) idx=ord.length; ord.splice(idx,0,from); S._daOrder=ord; daColLuu_(); renderDuAn(); }
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
  if(!S._daCols) daColDoc_();
  if(!S._daCols) S._daCols={khuVuc:1,ten:1,thuongHieu:1,moTa:1,kichThuoc:1,hinhAnh:1,dvt:1,soLuong:1,donGia:1,thanhTien:1};
  if(!S._daOrder) S._daOrder=DA_KEYS.slice();
  DA_KEYS.forEach(function(k){ if(S._daOrder.indexOf(k)<0) S._daOrder.push(k); });   // đồng bộ nếu DA_KEYS thêm cột mới
  var keys=S._daOrder.filter(function(k){ return S._daCols[k]; });
  // Lọc theo HẠNG MỤC đang chọn (dùng chung với các tab khác) — KPI, bảng, dòng tổng đều theo đây
  var hmNow=hmGet_();
  var daTatCa=hmNow?(S.lines||[]).filter(function(l){ var c=String(l.nhom||'');
      return c===hmNow || c.indexOf(hmNow+'.')===0; }):(S.lines||[]);
  var dq=spNorm_(S._daQ||'');      // ô tìm chỉ lọc BẢNG; dải tổng phía trên vẫn là cả hạng mục (giống Chi phí)
  var daLines_=dq?daTatCa.filter(function(l){ return spNorm_([l.ten,l.maSP,l.thuongHieu,l.ncc,l.khuVuc].join(' ')).indexOf(dq)>=0; }):daTatCa;
  var numK=['soLuong','giaNCC','giaDaiLy','donGia','donGiaCK','lnVnd','thanhTien'], ctK=['maBanVe','nganh','hinhAnh','dvt','chietKhau','lnPct','ckKhach','markup','margin'];
  function alignCls(k){ return numK.indexOf(k)>=0?'num':(ctK.indexOf(k)>=0?'ct':''); }
  // dải tổng = cùng hàm với tab Chi phí (gồm Phần thô khi xem tất cả / hạng mục 3.1, trừ CK báo giá khi xem tất cả)
  var TT=cpTong_(daTatCa, hmNow||''), ban=TT.net, vat=TT.vat;
  var banLoc=daLines_.reduce(function(s,l){ return s+ttBan_(l); },0);      // chân bảng: đúng các dòng ĐANG HIỆN (kể cả khi đang tìm)
  // KPI
  var stat=pgHeadRow_('daHmBtn', daTatCa.length,
      pgStat_('Sản phẩm',daTatCa.length)+pgStat_('Số lượng',daTatCa.reduce(function(s,l){return s+(Number(l.soLuong)||0);},0))
     +pgStat_('Chưa VAT',money(ban)+' đ')+'<span class="tkt-i">'+pgVat_()+'<b>'+money(vat)+' đ</b></span>'
     +pgStat_('Tổng',money(ban+vat)+' đ','grand'));
  // chip chọn cột (hiện sẵn)
  var colbar=daColBar_('<div class="cp-bar"><div class="cp-search">'+icon('search',14)
      +'<input id="daQ" value="'+esc(S._daQ||'')+'" placeholder="Tìm tên · mã · thương hiệu · phòng…" oninput="if(!event.isComposing)daSetQ(this.value)" oncompositionend="daSetQ(this.value)">'
      +((S._daQ||'')?'<button class="cp-x" title="Xoá tìm kiếm" onclick="daSetQ(\'\')">✕</button>':'')+'</div>'
      +((S._daQ||'')?'<span class="cp-found">'+daLines_.length+' / '+daTatCa.length+' dòng</span>':'')
      +(S._daSort?'<button class="btn ghost sm" onclick="S._daSort=\'\';renderDuAn()" title="Bỏ sắp xếp">'+icon('close',13)+' Bỏ sắp xếp</button>':'')
      +'<span style="flex:1"></span><button class="btn ghost sm" onclick="daXuatExcel_(this)" title="Bảng đang xem (đúng cột, tìm, sắp xếp) ra file Excel">'+icon('download',14)+' Xuất Excel</button></div>');
  // bảng
  var ncol=keys.length+1;
  var totalW=64+keys.reduce(function(s,k){ return s+colW(k); },0);
  var colg='<colgroup><col style="width:64px">'+keys.map(function(k){ return '<col style="width:'+colW(k)+'px">'; }).join('')+'</colgroup>';
  var head='<tr><th class="ct">STT</th>'+keys.map(function(k){
      return '<th class="thk '+alignCls(k)+'" data-k="'+k+'" draggable="true" title="Kéo để đổi vị trí cột · kéo mép phải để chỉnh rộng"'
        +' ondragstart="daColDragStart(event,\''+k+'\')" ondragover="event.preventDefault()" ondrop="daColDrop(event,\''+k+'\')">'
        +'<span class="thl" onclick="daSort(\''+k+'\')" title="Bấm để sắp xếp">'+esc(cpLabel_(k))+(S._daSort===k?(S._daSortDir==='desc'?' ▼':' ▲'):'')+'</span><span class="thrsz" data-k="'+k+'"></span></th>'; }).join('')+'</tr>';
  var groups={}; daLines_.forEach(function(l){ var g=(l.tang||'').trim()||'CHƯA PHÂN TẦNG'; (groups[g]=groups[g]||[]).push(l); });
  var order=floorsList().slice(); Object.keys(groups).forEach(function(g){ if(order.indexOf(g)<0) order.push(g); });
  order=order.filter(function(g){ return groups[g]&&groups[g].length; });
  order.forEach(function(g){ groups[g]=daSapXep_(groups[g]); });
  S._daXuat={keys:keys, order:order, groups:groups, lines:daLines_};
  var spacer='<tr class="tk-spacer"><td colspan="'+ncol+'"></td></tr>';
  var body='';
  if(!daLines_.length){ body='<tr><td class="empty" colspan="'+ncol+'">Chưa có sản phẩm. Vào <b>Danh sách sản phẩm</b> bấm ＋ để ghi danh, hoặc <b>Bóc tách</b> để thêm.</td></tr>'; }
  order.forEach(function(g,gi){
    var roman=['I','II','III','IV','V','VI','VII','VIII','IX','X'][gi]||(gi+1);
    var gsum=(groups[g]||[]).reduce(function(s,l){ return s+ttBan_(l); },0);
    body+='<tr class="grp"><td colspan="'+ncol+'"><span class="gname">'+roman+'. '+esc(g)+'</span><span class="gsum">Tổng tầng: <b>'+money(gsum)+' đ</b></span></td></tr>'+spacer;
    (groups[g]||[]).forEach(function(l,ri){
      body+='<tr class="drow'+(ri%2===0?' alt':'')+(tkSelHas_(l.lineId)?' rowsel':'')+'" data-id="'+l.lineId+'">'
        +cpSttCell_(l,(gi+1)+'.'+(ri+1))
        +keys.map(function(k){ return cpCell_(l,k); }).join('')+'</tr>';
    });
    body+=spacer;
  });
  var daBt=btSan_() && btOn_('da') && daLines_.length>0;
  var foot='';
  if(daLines_.length){ foot='<tr class="cp-foot"><td class="ct"></td>'+keys.map(function(k,ki){
      if(ki===0) return '<td class="'+alignCls(k)+'"><b>TỔNG · '+daLines_.length+' SP</b></td>';
      if(k==='thanhTien') return '<td class="num"><b class="cp-strong">'+money(banLoc)+'</b></td>';
      if(k==='soLuong') return '<td class="num"><b>'+daLines_.reduce(function(s,l){return s+(Number(l.soLuong)||0);},0)+'</b></td>';
      return '<td class="'+alignCls(k)+'"></td>';
    }).join('')+'</tr>'; }
  box.innerHTML=stat+hmPTNote_()+hmSaiNote_()+hmLacNote_(daLines_.length)+colbar
    +(daBt?'<div id="daSheetSlot"></div>':pgTblHost_('da','<div class="tbl-wrap"><table class="tk cpflat" style="min-width:'+totalW+'px;width:100%">'+colg+head+body+foot+'</table></div>'));
  if(daBt){ try{ daSheetGan_(keys, order, groups, daLines_); }      // chế độ bảng tính (bangtinh.js)
    catch(e){ console.error(e); btSet_('da',false); btCtx_('da').frame=null; toast('Bảng tính lỗi — chuyển về bảng cũ'); return renderDuAn(); } }
  markBlocks_('#v-duan table.cpflat');
  pgBarsBind_('da'); tkSelBar_();
}
