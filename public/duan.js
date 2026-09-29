/* ═══ TAB DỰ ÁN — bảng phẳng mọi dòng của dự án, gom theo tầng. ═══ */
'use strict';

/* ===== DỰ ÁN — Sản phẩm trong dự án (gom theo tầng, y kiểu Bóc tách) ===== */
var DA_KEYS=['khuVuc','maBanVe','nganh','maSP','ten','thuongHieu','ncc','moTa','kichThuoc','hinhAnh','dvt','soLuong','giaNCC','chietKhau','giaDaiLy','lnPct','donGia','thanhTien'];
function daColToggle(k){ S._daCols=S._daCols||{}; S._daCols[k]=!S._daCols[k]; renderDuAn(); }
// kéo đổi vị trí cột (tab Dự án)
function daColDragStart(e,k){ if(e.target&&e.target.closest&&e.target.closest('.thrsz')){ e.preventDefault(); return; } S._daDragK=k; try{ e.dataTransfer.setData('text/plain',k); }catch(x){} }
function daColDrop(e,k){ e.preventDefault(); var from=S._daDragK; S._daDragK=null; if(!from||from===k) return;
  var ord=(S._daOrder||DA_KEYS.slice()).filter(function(x){ return x!==from; });
  var idx=ord.indexOf(k); if(idx<0) idx=ord.length; ord.splice(idx,0,from); S._daOrder=ord; renderDuAn(); }
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
  if(!S._daCols) S._daCols={khuVuc:1,ten:1,thuongHieu:1,moTa:1,kichThuoc:1,hinhAnh:1,dvt:1,soLuong:1,donGia:1,thanhTien:1};
  if(!S._daOrder) S._daOrder=DA_KEYS.slice();
  DA_KEYS.forEach(function(k){ if(S._daOrder.indexOf(k)<0) S._daOrder.push(k); });   // đồng bộ nếu DA_KEYS thêm cột mới
  var keys=S._daOrder.filter(function(k){ return S._daCols[k]; });
  // Lọc theo HẠNG MỤC đang chọn (dùng chung với các tab khác) — KPI, bảng, dòng tổng đều theo đây
  var hmNow=hmGet_();
  var daLines_=hmNow?(S.lines||[]).filter(function(l){ var c=String(l.nhom||'');
      return c===hmNow || c.indexOf(hmNow+'.')===0; }):(S.lines||[]);
  var numK=['soLuong','giaNCC','giaDaiLy','donGia','donGiaCK','lnVnd','thanhTien'], ctK=['maBanVe','nganh','hinhAnh','dvt','chietKhau','lnPct','ckKhach','markup','margin'];
  function alignCls(k){ return numK.indexOf(k)>=0?'num':(ctK.indexOf(k)>=0?'ct':''); }
  var ban=0; daLines_.forEach(function(l){ ban+=ttBan_(l); });
  var vat=Math.round(ban*(Number(S.cur.vat)||0)/100);
  // KPI
  var stat=pgHeadRow_('daHmBtn', daLines_.length,
      pgStat_('Sản phẩm',daLines_.length)+pgStat_('Số lượng',daLines_.reduce(function(s,l){return s+(Number(l.soLuong)||0);},0))
     +pgStat_('Chưa VAT',money(ban)+' đ')+'<span class="tkt-i">'+pgVat_()+'<b>'+money(vat)+' đ</b></span>'
     +pgStat_('Tổng',money(ban+vat)+' đ','grand'));
  // chip chọn cột (hiện sẵn)
  var colbar=daColBar_();
  // bảng
  var ncol=keys.length+1;
  var totalW=64+keys.reduce(function(s,k){ return s+colW(k); },0);
  var colg='<colgroup><col style="width:64px">'+keys.map(function(k){ return '<col style="width:'+colW(k)+'px">'; }).join('')+'</colgroup>';
  var head='<tr><th class="ct">STT</th>'+keys.map(function(k){
      return '<th class="thk '+alignCls(k)+'" data-k="'+k+'" draggable="true" title="Kéo để đổi vị trí cột · kéo mép phải để chỉnh rộng"'
        +' ondragstart="daColDragStart(event,\''+k+'\')" ondragover="event.preventDefault()" ondrop="daColDrop(event,\''+k+'\')">'
        +'<span class="thl">'+esc(cpLabel_(k))+'</span><span class="thrsz" data-k="'+k+'"></span></th>'; }).join('')+'</tr>';
  var groups={}; daLines_.forEach(function(l){ var g=(l.tang||'').trim()||'CHƯA PHÂN TẦNG'; (groups[g]=groups[g]||[]).push(l); });
  var order=floorsList().slice(); Object.keys(groups).forEach(function(g){ if(order.indexOf(g)<0) order.push(g); });
  order=order.filter(function(g){ return groups[g]&&groups[g].length; });
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
  var foot='';
  if(daLines_.length){ foot='<tr class="cp-foot"><td class="ct"></td>'+keys.map(function(k,ki){
      if(ki===0) return '<td class="'+alignCls(k)+'"><b>TỔNG · '+daLines_.length+' SP</b></td>';
      if(k==='thanhTien') return '<td class="num"><b class="cp-strong">'+money(ban)+'</b></td>';
      if(k==='soLuong') return '<td class="num"><b>'+daLines_.reduce(function(s,l){return s+(Number(l.soLuong)||0);},0)+'</b></td>';
      return '<td class="'+alignCls(k)+'"></td>';
    }).join('')+'</tr>'; }
  box.innerHTML='<div class="sechd"><h2>Sản phẩm trong dự án</h2><span class="count">'+daLines_.length+'</span><span class="sp" style="flex:1"></span>'
      +'<span class="cp-hint">'+icon('building',13)+' '+esc(S.cur.ten||'')+' — bấm ô để sửa</span></div>'
    +stat+hmPTNote_()+hmSaiNote_()+hmLacNote_(daLines_.length)+colbar
    +pgTblHost_('da','<div class="tbl-wrap"><table class="tk cpflat" style="min-width:'+totalW+'px;width:100%">'+colg+head+body+foot+'</table></div>');
  markBlocks_('#v-duan table.cpflat');
  pgBarsBind_('da'); tkSelBar_();
}
