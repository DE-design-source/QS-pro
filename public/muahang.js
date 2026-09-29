/* ═══ TAB MUA HÀNG — gom theo nhà cung cấp, gửi yêu cầu mua, đề xuất giảm giá / thanh toán theo đợt,
   phiếu đề xuất (kể cả khối duyệt đề xuất dùng ở tab Admin). ═══ */
'use strict';

/* ===== MUA HÀNG (gom theo Nhà cung cấp) ===== */
function mhPrice(l){ return giaDaiLy_(l)||Number(l.donGiaVon)||Number(l.donGiaBan)||0; }
// Giảm giá từ NCC (%) theo dòng -> lưu TRÊN DÒNG (giamGiaNcc) nên copy theo khi nhân bản
function mhDisc_(l){ return Math.max(0,Math.min(100,Number(l.giamGiaNcc)||0)); }
function mhPriceCK_(l){ return Math.round(mhPrice(l)*(1-mhDisc_(l)/100)); }
function mhSub_(items){ return items.reduce(function(a,l){ return a+(Number(l.soLuong)||0)*mhPriceCK_(l); },0); }  // tổng = giá SAU chiết khấu
function mhTot_(items,vatPct){ var s=mhSub_(items); return s+Math.round(s*vatPct/100); }
function mhSetDisc(lineId,v){ var l=(S.lines||[]).filter(function(x){return x.lineId===lineId;})[0]; if(!l) return;
  var p=Math.max(0,Math.min(100,Number(v)||0)); l.giamGiaNcc=p; renderMuahang();
  api('updateLine',lineId,{giamGiaNcc:p}).catch(function(e){ luuLoi_(e,'giảm giá NCC'); }); }
function mhSetDiscAll(gi,v){ var g=(S._mhGroups||[])[gi]; if(!g) return; var p=Math.max(0,Math.min(100,Number(v)||0));
  g.items.forEach(function(l){ l.giamGiaNcc=p; api('updateLine',l.lineId,{giamGiaNcc:p}).catch(function(e){ luuLoi_(e,'giảm giá NCC'); }); }); renderMuahang(); }
function mhOn_(ncc){ return !(S._mhSel&&S._mhSel[ncc]===false); }
/* Thẻ NCC — dùng lại frontend thẻ của trang Nhập dữ liệu (.dbcard + icon chip) */
function muahangCard(g, gi, vatPct){
  var ncc=g.ncc, items=g.items, sub=0;
  var rows=items.map(function(l,i){
    var dg=mhPrice(l), sl=Number(l.soLuong)||0, ttGoc=sl*dg;
    var pct=mhDisc_(l), ttCK=sl*mhPriceCK_(l); sub+=ttCK;
    var im=String(l.hinhAnh||'').split('\n')[0];
    var img=im?'<img class="mhp-img" src="'+esc(imgUrlOf(im))+'" onerror="this.style.visibility=\'hidden\'">':'<span class="mhp-img ph"></span>';
    var mo=String(l.moTa||'').trim(), kt=String(l.kichThuoc||'').trim();
    // mô tả và kích thước hay lặp nhau -> chỉ nối phần thật sự mới
    var spec=(mo+(kt && spNorm_(mo).indexOf(spNorm_(kt))<0 ? (mo?' · ':'')+kt : '')).replace(/\s+/g,' ').trim();
    var sub2=[l.khuVuc,l.thuongHieu].map(function(x){return String(x||'').trim();}).filter(Boolean).join(' · ');
    return '<tr>'
      +'<td class="c mut">'+(gi+1)+'.'+(i+1)+'</td>'
      +'<td class="c">'+img+'</td>'
      +'<td class="mhp-cell" title="Bấm để xem thông tin sản phẩm" onclick="mhProdModal_(\''+l.lineId+'\')">'
        +'<div class="mhp-name">'+esc(l.ten||'')+icon('eye',12)+'</div>'
        +(sub2?'<div class="mhp-sub">'+esc(sub2)+'</div>':'')
        +(spec?'<div class="mhp-spec">'+esc(spec)+'</div>':'')+'</td>'
      +'<td class="c">'+esc(l.dvt||'Cái')+'</td>'
      +'<td class="c b">'+sl+'</td>'
      +'<td class="n">'+money(dg)+'</td>'
      +'<td class="n b">'+money(ttGoc)+'</td>'
      +'<td class="c"><span class="mh-discwrap dx"><input class="mh-disc" type="number" min="0" max="100" value="'+(mhDx_(l)||'')+'" placeholder="0" onchange="mhSetDx(\''+l.lineId+'\',this.value)" title="Mức giảm giá phòng mua hàng đề xuất với nhà cung cấp"><i>%</i></span></td>'
      +'<td class="c"><span class="mh-discwrap"><input class="mh-disc" type="number" min="0" max="100" value="'+(pct||'')+'" placeholder="0" onchange="mhSetDisc(\''+l.lineId+'\',this.value)"><i>%</i></span></td>'
      +'<td class="n b mh-ttck">'+money(ttCK)+'</td></tr>';
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
        +'<thead><tr><th class="c">#</th><th class="c">Ảnh</th><th>Sản phẩm</th><th class="c">ĐVT</th><th class="c">SL</th><th class="n">Đơn giá</th><th class="n">Thành tiền</th>'
          +'<th class="c mh-disc-th dx-th" title="Mức giảm giá phòng mua hàng đề xuất với nhà cung cấp">Đề xuất giảm (%)'
            +'<span class="mh-bulk"><input type="number" min="0" max="100" placeholder="%" onchange="mhSetDxAll('+gi+',this.value)" title="Đề xuất % cho tất cả dòng"></span></th>'
          +'<th class="c mh-disc-th" title="Mức giảm giá nhà cung cấp đã chốt">Giảm giá NCC (%)'
            +'<span class="mh-bulk"><input type="number" min="0" max="100" placeholder="%" onchange="mhSetDiscAll('+gi+',this.value)" title="Áp dụng % cho tất cả dòng"></span></th>'
          +'<th class="n">Thành tiền sau CK</th></tr></thead>'
        +'<tbody>'+(rows||'<tr><td colspan="10" class="empty">—</td></tr>')+'</tbody>'
        +'<tfoot><tr class="mhf-vat"><td colspan="8"></td><td class="n">VAT '+vatPct+'%</td><td class="n">'+money(vat)+'</td></tr>'
        +'<tr class="mhf-tot"><td colspan="8"></td><td class="n">TỔNG</td><td class="n">'+money(tot)+'</td></tr></tfoot>'
      +'</table></div>'
      +mhPayHtml_(g,gi,tot)
      +'<div class="mhc-f">'
        +(mhDxSum_(items)?'<button class="btn amber sm" onclick="mhSendDx('+gi+',this)" title="Gửi mức chiết khấu phòng mua hàng đề xuất cho nhà cung cấp">'+icon('gauge',15)+' Gửi yêu cầu chiết khấu đề xuất</button>':'')
        +'<span style="flex:1"></span>'
        +'<button class="btn navy sm" onclick="mhSend('+gi+',this)">'+icon('cart',15)+' Gửi mua hàng NCC này</button>'
      +'</div>'
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
  // Chạy theo HẠNG MỤC dùng chung (trước đây bám S.node nên chọn "Tất cả hạng mục"
  // mà trang vẫn chỉ hiện đúng đề mục đang bóc).
  var code=hmGet_();
  var lines=code?S.lines.filter(function(l){ var c=String(l.nhom||'');
      return c===code || c.indexOf(code+'.')===0; }):(S.lines||[]).slice();
  var vatPct=Number(S.cur.vat)||0;
  var groups={}, order=[];
  lines.forEach(function(l){ var s=String(l.ncc||l.thuongHieu||'Khác').trim()||'Khác'; if(!groups[s]){groups[s]=[];order.push(s);} groups[s].push(l); });
  S._mhGroups=order.map(function(k){ return {ncc:k, items:groups[k]}; });
  // Tổng cộng CHỈ tính các NCC đang được chọn (mhOn_) — khớp với "Gửi N đơn đã chọn"
  var grand=order.reduce(function(sum,k){ return mhOn_(k) ? sum+mhTot_(groups[k],vatPct) : sum; },0);
  // Hàng đầu bảng dùng CHUNG kiểu với Chi phí / Dự án (trước đây còn ô chọn hạng mục + KPI kiểu cũ)
  var chuaCK=lines.reduce(function(a,l){ return a+(Number(l.soLuong)||0)*mhPrice(l); },0);
  var sauCK=order.reduce(function(a,k){ return a+mhSub_(groups[k]); },0);
  var statbar=pgHeadRow_('mhHmBtn', lines.length,
      pgStat_('Nhà cung cấp',pad2(order.length))+pgStat_('Sản phẩm',pad2(lines.length))
     +pgStat_('Trước giảm',money(chuaCK)+' đ')+pgStat_('Sau giảm NCC',money(sauCK)+' đ')
     +'<span class="tkt-i">'+pgVat_()+'<b>'+money(Math.round(sauCK*vatPct/100))+' đ</b></span>'
     +pgStat_('Tổng',money(grand)+' đ','grand'));
  var cards=S._mhGroups.map(function(g,gi){ return muahangCard(g, gi, vatPct); }).join('')
    || '<div class="empty" style="padding:34px;text-align:center;background:#fff;border:1px solid var(--line);border-radius:14px">Chưa có sản phẩm trong hạng mục này.<br>Vào tab <b>Bóc tách</b> thêm sản phẩm trước.</div>';
  box.innerHTML=statbar+hmPTNote_()+hmLacNote_(lines.length)+'<div class="imp-layout"><div class="mhcol">'+cards+'</div>'
    +'<div class="mhside">'+mhSummary(S._mhGroups,vatPct,grand)+mhDxPanel_()+'</div></div>';
  if(S._mhDxDA!==S.cur.maDA) mhLoadDx_();
  foldChipsSync_();
}
function mhToggle(gi){ var g=(S._mhGroups||[])[gi]; if(!g) return; S._mhSel=S._mhSel||{}; S._mhSel[g.ncc]=!(S._mhSel[g.ncc]!==false); renderMuahang(); }
function mhOrderOf(g){
  var vatPct=Number(S.cur&&S.cur.vat)||0;
  var sub=g.items.reduce(function(s,l){ return s+(Number(l.soLuong)||0)*mhPriceCK_(l); },0);   // giá SAU chiết khấu
  var vat=Math.round(sub*vatPct/100);
  return { supplier:g.ncc, vatPct:vatPct, vat:vat, total:sub+vat,
    items:g.items.map(function(l){ return {ten:l.ten||'', ma:l.maSP||'', thuongHieu:l.thuongHieu||'', khuVuc:l.khuVuc||'', hinhAnh:String(l.hinhAnh||'').split('\n')[0], sl:Number(l.soLuong)||0, dvt:l.dvt||'Cái', donGia:mhPriceCK_(l), donGiaGoc:mhPrice(l), giamGiaPct:mhDisc_(l)}; }) };
}
function mhBase(){ var mi=S._mhInfo||{}; return { project:S.cur&&S.cur.ten, maDA:S.cur&&S.cur.maDA, khachHang:S.cur&&S.cur.khachHang, sdt:S.cur&&S.cur.sdt, node:hmGet_(), hangMuc:nodeName(hmGet_()), nguoiGui:mi.nguoiGui||'', phongBan:mi.phongBan||'', ghiChu:mi.ghiChu||'' }; }
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

/* ═══════════ MUA HÀNG — đề xuất giảm giá + đề xuất thanh toán theo đợt ═══════════ */
/* Đề xuất giảm giá từ phòng mua hàng: là con số ĐỀ NGHỊ với NCC, tách khỏi
   "Giảm giá NCC (%)" (mức NCC đã chốt). Lưu trên dòng ở extra.dxGiam. */
function mhDx_(l){ return Math.max(0,Math.min(100,Number(l&&l.extra&&l.extra.dxGiam)||0)); }
function mhDxSum_(items){ return (items||[]).reduce(function(a,l){ return a+mhDx_(l); },0); }
function mhSetDx(lineId,v){
  var l=(S.lines||[]).filter(function(x){ return x.lineId===lineId; })[0]; if(!l) return;
  var p=Math.max(0,Math.min(100,Number(v)||0));
  var ex=Object.assign({}, l.extra||{}); if(p) ex.dxGiam=p; else delete ex.dxGiam;
  l.extra=ex; renderMuahang();
  api('updateLine',lineId,{extra:ex}).catch(function(){ toast('Lưu đề xuất giảm giá lỗi'); });
}
function mhSetDxAll(gi,v){
  var g=(S._mhGroups||[])[gi]; if(!g) return;
  var p=Math.max(0,Math.min(100,Number(v)||0));
  g.items.forEach(function(l){
    var ex=Object.assign({}, l.extra||{}); if(p) ex.dxGiam=p; else delete ex.dxGiam;
    l.extra=ex; api('updateLine',l.lineId,{extra:ex}).catch(function(e){ luuLoi_(e,'đề xuất giảm giá'); });
  });
  renderMuahang();
}
// Đơn giá / thành tiền NẾU nhà cung cấp chấp nhận mức đề xuất
function mhPriceDx_(l){ return Math.round(mhPrice(l)*(1-mhDx_(l)/100)); }
async function mhSendDx(gi,btn){
  var g=(S._mhGroups||[])[gi]; if(!g) return;
  if(!mhValidateInfo()) return;
  var vatPct=Number(S.cur&&S.cur.vat)||0;
  var sub=g.items.reduce(function(a,l){ return a+(Number(l.soLuong)||0)*mhPriceDx_(l); },0);
  var vat=Math.round(sub*vatPct/100);
  var goc=g.items.reduce(function(a,l){ return a+(Number(l.soLuong)||0)*mhPrice(l); },0);
  if(!await xacNhan_('Gửi đề xuất chiết khấu tới "'+g.ncc+'"?\n\nGiá gốc: '+money(goc)+' đ\nSau mức đề xuất: '+money(sub)+' đ\nGiảm: '+money(goc-sub)+' đ')) return;
  if(btn){ btn.disabled=true; btn.dataset.t=btn.innerHTML; btn.innerHTML='Đang gửi…'; }
  var dx=Object.assign(mhBase(), { loai:'ck', supplier:g.ncc, vatPct:vatPct,
    items:g.items.map(function(l){ return {ten:l.ten||'', ma:l.maSP||'', thuongHieu:l.thuongHieu||'',
      khuVuc:l.khuVuc||'', hinhAnh:String(l.hinhAnh||'').split('\n')[0], sl:Number(l.soLuong)||0,
      dvt:l.dvt||'Cái', donGia:mhPriceDx_(l), donGiaGoc:mhPrice(l), giamGiaPct:mhDx_(l)}; }) });
  api('sendDeXuat', dx)
    .then(function(r){ toast('✔ Đã gửi đề xuất chiết khấu '+((r&&r.ma)||'')+' tới "'+g.ncc+'"'); mhLoadDx_(); })
    .catch(function(e){ toast('Lỗi gửi: '+e.message); })
    .then(function(){ if(btn){ btn.disabled=false; btn.innerHTML=btn.dataset.t; } });
}

/* ---------- Đề xuất thanh toán mục tiêu (chia đợt) ---------- */
function mhPayKey_(){ return 'qs_mhtt_'+((S.cur&&S.cur.maDA)||''); }
function mhPayAll_(){
  if(S._mhPayDA!==((S.cur&&S.cur.maDA)||'')){
    var d={}; try{ d=JSON.parse(localStorage.getItem(mhPayKey_())||'{}')||{}; }catch(e){ d={}; }
    S._mhPay=d; S._mhPayDA=(S.cur&&S.cur.maDA)||'';
  }
  return S._mhPay=S._mhPay||{};
}
function mhPaySave_(){ try{ localStorage.setItem(mhPayKey_(), JSON.stringify(mhPayAll_())); }catch(e){} }
function mhPayOf_(ncc){ var a=mhPayAll_(); if(!a[ncc]) a[ncc]=[{pct:100,tien:0,ngay:'',gc:''}]; return a[ncc]; }
function mhPayOpen_(ncc){ return !!(S._mhPayOpen&&S._mhPayOpen[ncc]); }
function mhPayToggle(gi){
  var g=(S._mhGroups||[])[gi]; if(!g) return;
  S._mhPayOpen=S._mhPayOpen||{};
  if(S._mhPayOpen[g.ncc]) delete S._mhPayOpen[g.ncc]; else S._mhPayOpen[g.ncc]=1;
  renderMuahang();
}
function mhPaySet(gi,i,f,v){
  var g=(S._mhGroups||[])[gi]; if(!g) return;
  var arr=mhPayOf_(g.ncc), d=arr[i]; if(!d) return;
  var tot=mhTot_(g.items, Number(S.cur&&S.cur.vat)||0);
  if(f==='pct'){ d.pct=Math.max(0,Math.min(100,Number(String(v).replace(',','.'))||0)); d.tien=Math.round(tot*d.pct/100); }
  else if(f==='tien'){ d.tien=Math.max(0,tkNum_(v)); d.pct=tot?Math.round(d.tien/tot*1000)/10:0; }
  else d[f]=v;
  mhPaySave_(); renderMuahang();
}
function mhPayAdd(gi){
  var g=(S._mhGroups||[])[gi]; if(!g) return;
  var arr=mhPayOf_(g.ncc), tot=mhTot_(g.items, Number(S.cur&&S.cur.vat)||0);
  var da=arr.reduce(function(a,d){ return a+(Number(d.pct)||0); },0);
  var con=Math.max(0, 100-da);
  arr.push({pct:con, tien:Math.round(tot*con/100), ngay:'', gc:''});
  mhPaySave_(); renderMuahang();
}
function mhPayDel(gi,i){
  var g=(S._mhGroups||[])[gi]; if(!g) return;
  var arr=mhPayOf_(g.ncc); if(arr.length<=1){ toast('Cần ít nhất 1 đợt'); return; }
  arr.splice(i,1); mhPaySave_(); renderMuahang();
}
function mhPayChia(gi,n){
  var g=(S._mhGroups||[])[gi]; if(!g) return;
  var tot=mhTot_(g.items, Number(S.cur&&S.cur.vat)||0);
  var arr=[], moi=Math.floor(100/n*10)/10, con=tot;
  for(var i=0;i<n;i++){
    var pct=(i===n-1)?Math.round((100-moi*(n-1))*10)/10:moi;
    var tien=(i===n-1)?con:Math.round(tot*pct/100);   // đợt cuối gánh phần lẻ -> tổng khớp tuyệt đối
    con-=tien; arr.push({pct:pct, tien:tien, ngay:'', gc:''});
  }
  mhPayAll_()[g.ncc]=arr; mhPaySave_(); renderMuahang();
}
function mhPayHtml_(g,gi,tot){
  var mo=mhPayOpen_(g.ncc), arr=mhPayOf_(g.ncc);
  var sumTien=arr.reduce(function(a,d){ return a+(Number(d.tien)||0); },0);
  var sumPct=arr.reduce(function(a,d){ return a+(Number(d.pct)||0); },0);
  var du=Math.abs(sumTien-tot)<=Math.max(1000, tot*0.005);
  var hdr='<div class="mhtt-h" onclick="mhPayToggle('+gi+')">'
    +'<span class="mhtt-ic">'+icon('money',16)+'</span>'
    +'<b>Đề xuất thanh toán mục tiêu</b>'
    +'<span class="mhtt-sub">'+arr.length+' đợt · '+money(sumTien)+' đ</span>'
    +'<span style="flex:1"></span>'
    +'<span class="mhtt-car">'+(mo?'▾':'▸')+'</span></div>';
  if(!mo) return '<div class="mhtt">'+hdr+'</div>';
  var cards=arr.map(function(d,i){
    return '<div class="mhtt-c">'
      +'<div class="mhtt-c-h">Thanh toán đợt '+(i+1)
        +'<button class="mhtt-x" title="Xoá đợt" onclick="mhPayDel('+gi+','+i+')">✕</button></div>'
      +'<label class="mhtt-f"><span>%</span><input type="number" step="any" min="0" max="100" value="'+(d.pct||'')+'" placeholder="%" onchange="mhPaySet('+gi+','+i+',\'pct\',this.value)"></label>'
      +'<label class="mhtt-f"><span>Số tiền</span><input type="text" inputmode="numeric" value="'+(d.tien?money(d.tien):'')+'" placeholder="0" onchange="mhPaySet('+gi+','+i+',\'tien\',this.value)"></label>'
      +'<label class="mhtt-f"><span>Ngày</span><input type="date" value="'+esc(d.ngay||'')+'" onchange="mhPaySet('+gi+','+i+',\'ngay\',this.value)"></label>'
      +'<label class="mhtt-f gc"><span>Ghi chú</span><textarea rows="2" placeholder="VD: tạm ứng ký hợp đồng" onchange="mhPaySet('+gi+','+i+',\'gc\',this.value)">'+esc(d.gc||'')+'</textarea></label>'
    +'</div>';
  }).join('');
  return '<div class="mhtt open">'+hdr
    +'<div class="mhtt-b">'
      +'<div class="mhtt-tools"><span class="lb">Chia nhanh</span>'
        +[2,3,4].map(function(n){ return '<button onclick="mhPayChia('+gi+','+n+')">'+n+' đợt</button>'; }).join('')
        +'<span style="flex:1"></span>'
        +'<button class="add" onclick="mhPayAdd('+gi+')">'+icon('plus',13)+' Thêm đợt</button></div>'
      +'<div class="mhtt-grid">'+cards+'</div>'
      +'<div class="mhtt-sum'+(du?' ok':' warn')+'">'
        +'<span class="st">'+icon(du?'check':'gauge',14)+' '
          +(du?'Đã phân bổ đủ 100% giá trị đơn hàng'
              :(sumTien<tot?('Còn thiếu '+money(tot-sumTien)+' đ ('+Math.round((100-sumPct)*10)/10+'%)')
                           :('Vượt '+money(sumTien-tot)+' đ')))+'</span>'
        +'<span style="flex:1"></span>'
        +'<span class="tt">Tổng đề xuất: <b>'+money(sumTien)+' đ</b> / '+money(tot)+' đ</span>'
      +'</div>'
      +'<button class="btn navy sm mhtt-send" onclick="mhSendPay('+gi+',this)">'+icon('cart',15)+' Gửi đề xuất thanh toán</button>'
    +'</div></div>';
}
async function mhSendPay(gi,btn){
  var g=(S._mhGroups||[])[gi]; if(!g) return;
  if(!mhValidateInfo()) return;
  var vatPct=Number(S.cur&&S.cur.vat)||0, tot=mhTot_(g.items,vatPct);
  var arr=mhPayOf_(g.ncc).filter(function(d){ return (Number(d.tien)||0)>0; });
  if(!arr.length){ toast('Chưa nhập đợt thanh toán nào'); return; }
  var sum=arr.reduce(function(a,d){ return a+(Number(d.tien)||0); },0);
  if(Math.abs(sum-tot)>Math.max(1000,tot*0.005)
     && !await xacNhan_('Tổng đề xuất ('+money(sum)+' đ) chưa khớp giá trị đơn ('+money(tot)+' đ). Vẫn gửi?')) return;
  if(btn){ btn.disabled=true; btn.dataset.t=btn.innerHTML; btn.innerHTML='Đang gửi…'; }
  var dx=Object.assign(mhBase(), { loai:'tt', supplier:g.ncc, vatPct:vatPct, tongDon:tot,
    dots:arr.map(function(d,i){
      return {dot:i+1, pct:Number(d.pct)||0, tien:Number(d.tien)||0, ngay:d.ngay||'', gc:d.gc||''}; }) });
  api('sendDeXuat', dx)
    .then(function(r){ toast('✔ Đã gửi đề xuất thanh toán '+arr.length+' đợt '+((r&&r.ma)||'')+' tới "'+g.ncc+'"'); mhLoadDx_(); })
    .catch(function(e){ toast('Lỗi gửi: '+e.message); })
    .then(function(){ if(btn){ btn.disabled=false; btn.innerHTML=btn.dataset.t; } });
}

/* Kéo thẻ con của combo (danh mục trái) và dòng "Sản phẩm đi kèm" (panel chi tiết)
   thả thẳng vào bảng bóc tách — giữ đúng số lượng đi kèm. */
function pdComboDrag_(e,k){
  var x=(S._pdCombo||[])[k]; if(!x){ e.preventDefault(); return; }
  return prodDragObj_(e,x,Number(x.comboSL)||1);
}

/* ═══════════ ĐỀ XUẤT MUA HÀNG — phiếu riêng (chiết khấu / thanh toán) ═══════════ */
var DX_TEN_={ck:'Đề xuất chiết khấu', tt:'Đề xuất thanh toán'};
var DX_ICO_={ck:'gauge', tt:'money'};
function dxStatusCls_(st){ return {'Đã duyệt':'approved','Từ chối':'rejected','Chờ duyệt':'pending'}[st]||'pending'; }
/* --- Quản trị: danh sách + duyệt --- */
function admDxCard_(dxs){
  dxs=dxs||[]; var pending=dxs.filter(function(r){ return r.status==='Chờ duyệt'; });
  var body= dxs.length? dxs.map(function(r){
    var scls=dxStatusCls_(r.status);
    var tien = r.loai==='tt' ? ('Tổng đề xuất <span class="rq-amt">'+money(r.tongDeXuat)+'đ</span>')
             : ('Giảm <span class="rq-amt">'+money(r.tienGiam)+'đ</span> · còn '+money(r.tongDeXuat)+'đ');
    return rqItem_({ cls:scls+' clickable', icon:icon(DX_ICO_[r.loai]||'gauge',16),
      onclick:'dxDetail(\''+escJs_(r.ma)+'\')',
      title:'<b>'+esc(r.ma)+'</b> · '+esc(DX_TEN_[r.loai]||'Đề xuất')+' · '+esc(r.supplier||'—')
        +'<span class="rq-view">'+icon('eye',12)+' Xem chi tiết</span>',
      meta:'Người gửi <b>'+esc(r.requester||'—')+'</b>'+(r.phongBan?(' · '+esc(r.phongBan)):'')
        +' · Dự án '+esc(r.project||'—')+' · '+tien,
      badgeCls:scls, badgeText:esc(r.status||''),
      actions: scls==='pending'
        ? '<button class="btn blue xs" onclick="event.stopPropagation();dxResolve(\''+escJs_(r.ma)+'\',true)">Duyệt</button>'
          +'<button class="btn ghost xs danger" onclick="event.stopPropagation();dxResolve(\''+escJs_(r.ma)+'\',false)">Từ chối</button>'
        : '',
      time: fmtDateTime_(r.at) });
  }).join(''):'<div class="empty">Chưa có đề xuất nào.</div>';
  return '<div class="dbcard" id="dxCard"><div class="dbcard-h"><span class="dbcard-ic">'+icon('gauge',18)+'</span>'
    +'<h3>Đề xuất mua hàng</h3><span class="hint" style="margin-left:2px">chiết khấu · thanh toán — tách khỏi đơn mua hàng</span>'
    +(pending.length?'<span class="pend-badge">'+pending.length+' chờ duyệt</span>':'')
    +'</div><div class="dbcard-b rq-body">'+body+'</div></div>';
}
async function dxResolve(ma,approve){
  if(!approve && !await xacNhan_('Từ chối phiếu '+ma+'?')) return;
  api('resolveDeXuat',ma,approve).then(function(){
    toast(approve?('Đã duyệt phiếu '+ma):('Đã từ chối phiếu '+ma));
    if(document.getElementById('v-admin').classList.contains('on')) renderAdmin();
    else mhLoadDx_();
    refreshNotifCount_&&refreshNotifCount_();
  }).catch(function(e){ toast('Lỗi: '+e.message); });
}
async function dxDetail(ma){
  var ov=document.createElement('div'); ov.className='sp-modal-ov'; ov.id='dxOv';
  ov.onclick=function(e){ if(e.target===ov) dxClose(); };
  ov.innerHTML='<div class="sp-modal pur-modal pd"><div class="pd-head"><h3>'+icon('gauge',16)+' Chi tiết đề xuất</h3>'
    +'<button class="pd-x" onclick="dxClose()">✕</button></div><div class="pur-body"><div class="empty" style="padding:26px">Đang tải…</div></div></div>';
  document.body.appendChild(ov);
  try{ var o=await api('getDeXuat', ma); ov.querySelector('.pur-body').innerHTML=dxDetailHtml_(o); }
  catch(e){ ov.querySelector('.pur-body').innerHTML='<div class="empty" style="padding:26px">Lỗi tải phiếu: '+esc(e.message)+'</div>'; }
}
function dxClose(){ var o=document.getElementById('dxOv'); if(o)o.remove(); }
function dxDetailHtml_(o){
  var scls=dxStatusCls_(o.status), isCK=(o.loai!=='tt');
  var info=function(k,v){ return v?('<div class="pur-i"><span>'+esc(k)+'</span><b>'+esc(v)+'</b></div>'):''; };
  var rows, head, tot;
  if(isCK){
    head='<tr><th class="c">STT</th><th>Sản phẩm</th><th class="c">ĐVT</th><th class="n">SL</th>'
      +'<th class="n">Đơn giá hiện tại</th><th class="c">Đề xuất giảm</th><th class="n">Đơn giá đề xuất</th><th class="n">Thành tiền</th></tr>';
    rows=(o.items||[]).map(function(it,i){
      return '<tr><td class="c">'+(i+1)+'</td>'
        +'<td><b>'+esc(it.ten||'')+'</b>'+(it.ma?'<span class="pur-code">'+esc(it.ma)+'</span>':'')+'</td>'
        +'<td class="c">'+esc(it.dvt||'')+'</td><td class="n">'+(it.sl||0)+'</td>'
        +'<td class="n">'+money(it.donGiaGoc)+'</td>'
        +'<td class="c"><b class="dx-pct">'+(it.pct||0)+'%</b></td>'
        +'<td class="n">'+money(it.donGia)+'</td>'
        +'<td class="n b">'+money(it.thanhTien)+'</td></tr>';
    }).join('')||'<tr><td colspan="8" class="empty" style="padding:18px">Phiếu không có dòng nào.</td></tr>';
    tot='<div><span>Giá hiện tại</span><b>'+money(o.tongGoc)+' đ</b></div>'
      +'<div><span>Sau đề xuất</span><b>'+money(o.tongDeXuat)+' đ</b></div>'
      +'<div class="grand"><span>TIẾT KIỆM</span><b>'+money(o.tienGiam)+' đ</b></div>';
  } else {
    head='<tr><th class="c">Đợt</th><th class="c">Tỷ lệ</th><th class="n">Số tiền</th><th class="c">Ngày dự kiến</th><th>Ghi chú</th></tr>';
    rows=(o.items||[]).map(function(it,i){
      return '<tr><td class="c b">'+esc(it.ten||('Đợt '+(i+1)))+'</td>'
        +'<td class="c"><b class="dx-pct">'+(it.pct||0)+'%</b></td>'
        +'<td class="n b">'+money(it.thanhTien)+'</td>'
        +'<td class="c">'+(it.ngay?fmtDate(it.ngay):'—')+'</td>'
        +'<td>'+esc(it.ghiChu||'')+'</td></tr>';
    }).join('')||'<tr><td colspan="5" class="empty" style="padding:18px">Phiếu không có đợt nào.</td></tr>';
    tot='<div><span>Giá trị đơn hàng</span><b>'+money(o.tongGoc)+' đ</b></div>'
      +'<div class="grand"><span>TỔNG ĐỀ XUẤT</span><b>'+money(o.tongDeXuat)+' đ</b></div>';
  }
  return '<div class="pur-head">'
      +'<div class="pur-ma">'+esc(o.ma)+'<span class="drq-badge '+scls+'">'+esc(o.status||'')+'</span>'
        +'<span class="dx-kind">'+esc(DX_TEN_[o.loai]||'Đề xuất')+'</span></div>'
      +'<div class="pur-grid">'
        +info('Nhà cung cấp',o.supplier)+info('Dự án',o.project)
        +info('Người gửi',o.requester)+info('Phòng ban',o.phongBan)
        +info('Hạng mục',o.hangMuc)+info('Ngày gửi',fmtDateTime_(o.at))
        +(o.nguoiDuyet?info('Người duyệt',o.nguoiDuyet):'')
        +(o.ngayDuyet?info('Ngày duyệt',fmtDateTime_(o.ngayDuyet)):'')
      +'</div>'+(o.ghiChu?'<div class="pur-note">'+icon('doc',12)+' '+esc(o.ghiChu)+'</div>':'')+'</div>'
    +'<div class="tbl-wrap pur-tblwrap"><table class="pur-tbl"><thead>'+head+'</thead><tbody>'+rows+'</tbody></table></div>'
    +'<div class="pur-tot">'+tot+'</div>'
    +(o.status==='Chờ duyệt'
      ? '<div class="pur-act"><button class="btn ghost sm danger" onclick="dxResolve(\''+escJs_(o.ma)+'\',false);dxClose()">Từ chối</button>'
        +'<button class="btn blue" onclick="dxResolve(\''+escJs_(o.ma)+'\',true);dxClose()">'+icon('check',15)+' Duyệt phiếu</button></div>'
      : '');
}
/* --- Tab Mua hàng: danh sách phiếu đề xuất của dự án đang mở --- */
async function mhLoadDx_(){
  if(!S.cur) return;
  var ma=S.cur.maDA, list;
  try{ list=await api('getDeXuatList', ma)||[]; }catch(e){ list=[]; }
  if(!S.cur||S.cur.maDA!==ma) return;               // đã đổi dự án trong lúc chờ
  S._mhDx=list; S._mhDxDA=ma;
  var box=document.getElementById('mhDxBox'); if(box) box.innerHTML=mhDxInner_();
}
function mhDxInner_(){
  var list=S._mhDx||[];
  if(!list.length) return '<div class="empty" style="padding:16px 14px;font-size:12.5px">Chưa gửi đề xuất nào cho dự án này.</div>';
  return list.map(function(r){
    var scls=dxStatusCls_(r.status);
    return '<div class="mhdx-row '+scls+'" onclick="dxDetail(\''+escJs_(r.ma)+'\')" title="Xem chi tiết phiếu">'
      +'<span class="mhdx-ic">'+icon(DX_ICO_[r.loai]||'gauge',14)+'</span>'
      +'<div class="mhdx-m"><div class="mhdx-t">'+esc(DX_TEN_[r.loai]||'Đề xuất')+' · '+esc(r.supplier||'—')+'</div>'
        +'<div class="mhdx-s">'+esc(r.ma)+' · '+fmtDateTime_(r.at)+'</div></div>'
      +'<div class="mhdx-r"><b>'+money(r.loai==='tt'?r.tongDeXuat:r.tienGiam)+'</b>'
        +'<span class="drq-badge '+scls+'">'+esc(r.status||'')+'</span></div></div>';
  }).join('');
}
function mhDxPanel_(){
  var n=(S._mhDx||[]).length;
  return '<div class="imp-recent mhdx">'
    +'<div class="imp-recent-h">'+icon('gauge',15)+' Phiếu đề xuất đã gửi <span class="count">'+pad2(n)+'</span></div>'
    +'<div class="imp-recent-b" id="mhDxBox">'+mhDxInner_()+'</div></div>';
}

/* ===== Mua hàng: bấm vào dòng sản phẩm để xem thông tin ===== */
function mhFindProd_(l){
  var ma=spNorm_(l.maSP||''), ten=spNorm_(l.ten||'');
  var p=null;
  if(ma) p=(S.products||[]).filter(function(x){ return spNorm_(x.ma||'')===ma; })[0];
  if(!p && ten) p=(S.products||[]).filter(function(x){ return spNorm_(x.ten||'')===ten; })[0];
  return p || { ten:l.ten, ma:l.maSP, thuongHieu:l.thuongHieu, ncc:l.ncc, moTa:l.moTa,
    kichThuoc:l.kichThuoc, hinhAnh:l.hinhAnh, dvt:l.dvt, donGiaBan:l.donGiaBan, donGiaVon:l.donGiaVon };
}
function mhProdModal_(lineId){
  var l=lineOf_(lineId); if(!l) return;
  var p=mhFindProd_(l);
  var sl=Number(l.soLuong)||0, dg=mhPrice(l), pctDx=mhDx_(l), pctCK=mhDisc_(l);
  var ov=document.createElement('div'); ov.className='sp-modal-ov'; ov.id='spModalOv';
  ov.onclick=function(e){ if(e.target===ov) spClose(); };
  function o(k,v,cls){ return '<div class="mhpm-i'+(cls?' '+cls:'')+'"><span>'+esc(k)+'</span><b>'+v+'</b></div>'; }
  ov.innerHTML='<div class="sp-modal sp-modal-wide pd"><div class="pd-head"><h3>Thông tin sản phẩm</h3>'
      +'<span class="mhpm-ncc">'+icon('building',13)+' '+esc(l.ncc||l.thuongHieu||'')+'</span>'
      +'<button class="pd-x" onclick="spClose()">✕</button></div>'
    +'<div class="pdm-grid">'
      +'<div class="pdm-left">'+pdMedia_(p)+'</div>'
      +'<div class="pdm-right">'+pdSpecs_(p)
        +'<div class="mhpm-box"><div class="pd-sec">Trong đơn mua hàng này</div>'
          +o('Số lượng', ptQty(sl)+' '+esc(l.dvt||'Cái'))
          +o('Đơn giá mua', money(dg)+' đ')
          +(pctDx?o('Đề xuất giảm', pctDx+'%','dx'):'')
          +(pctCK?o('Giảm giá NCC đã chốt', pctCK+'%'):'')
          +o('Thành tiền sau CK', money(sl*mhPriceCK_(l))+' đ','tot')
        +'</div>'
      +'</div>'
    +'</div>'
    +'<div id="pdComboModal"></div>'
    +'<div class="pd-actions">'
      +'<button class="btn ghost sm" onclick="spClose()">Đóng</button>'
      +'<button class="btn blue sm" onclick="spClose();showTab(\'boc\')">'+icon('layers',14)+' Mở bảng bóc tách</button>'
    +'</div></div>';
  document.body.appendChild(ov);
  document.addEventListener('keydown',spModalKey_);
  if(p.recordId||p.ma) pdLoadCombo_(p, null, 'bóc tách', 'pdComboModal');
}
