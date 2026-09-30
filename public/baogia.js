/* ═══ TAB XUẤT BÁO GIÁ — tờ bìa (Mẫu 1/2), bảng hệ số diện tích, xem trước tài liệu nhiều trang, in PDF,
   xuất Excel, chọn hạng mục / cột xuất. ═══ */
'use strict';

/* ===== XUẤT BÁO GIÁ + TỜ BÌA ===== */
/* Tổng của tab Xuất báo giá — cộng ĐÚNG phạm vi đang xuất (hạng mục đã tích) + phần thô.
   Trước đây luôn cộng cả dự án nên tích 1 hạng mục mà tổng vẫn ra tiền của hạng mục khác. */
function computeQuoteLocal(toanDuAn){
  var ds=toanDuAn?(S.lines||[]):(typeof bgLines_==='function'?bgLines_():(S.lines||[]));
  var sub=0; ds.forEach(function(l){ sub+=ttBan_(l); });
  if(!toanDuAn && typeof bgPTSecs_==='function'){
    try{ bgPTSecs_().forEach(function(x){ sub+=Number(x.tt)||0; }); }catch(e){}
  }
  var vatPct=Number(S.cur&&S.cur.vat)||0, vat=Math.round(sub*vatPct/100);
  return {subtotal:sub,vatPct:vatPct,vat:vat,total:sub+vat};
}
function coverDepth(s){ return String(s).split('.').length; }
function coverSortFn(a,b){ function k(s){return String(s).split('.').map(function(x){return parseInt(x,10)||0;});} var ka=k(a.stt),kb=k(b.stt),n=Math.max(ka.length,kb.length); for(var i=0;i<n;i++){var d=(ka[i]||0)-(kb[i]||0); if(d)return d;} return 0; }
function coverHasChild(stt){ return (S.cover||[]).some(function(c){ return c.stt!==stt && String(c.stt).indexOf(stt+'.')===0; }); }
function coverCosts(){
  var cover=S.cover||[], cost={};
  cover.forEach(function(c){
    if(coverHasChild(c.stt)){ var s=0; cover.forEach(function(d){ if(d.stt!==c.stt && String(d.stt).indexOf(c.stt+'.')===0 && !coverHasChild(d.stt)) s+=coverLeafVal_(d); }); cost[c.stt]=s; }
    else cost[c.stt]=coverLeafVal_(c);
  });
  var total=0; cover.forEach(function(c){ if(coverDepth(c.stt)===1 && !bgHidden(c.stt)) total+=cost[c.stt]; });
  return {cost:cost,total:total};
}
function bgHidden(stt){ var root=String(stt).split('.')[0]; return !!(S.bgHide && S.bgHide[root]); }
function bgToggle(stt){ S.bgHide=S.bgHide||{}; if(S.bgHide[stt]) delete S.bgHide[stt]; else S.bgHide[stt]=1; drawBaogia(); }
function setCoverMau(m){ S.coverMau=m; try{localStorage.setItem('qs_covermau',m);}catch(e){} drawBaogia(); }
function coverInfo(field,value){ if(!S.cur)return; var f={}; f[field]=value; api('updateProject',S.cur.maDA,f).then(syncProj).catch(function(e){toast('Lỗi: '+e.message);}); }
function ic(field){ var v=(S.cur&&S.cur[field])||''; return '<td><input class="cin" value="'+esc(v)+'" onchange="coverInfo(\''+field+'\',this.value)"></td>'; }
function coverEdit(i,field,value){ var c=S.cover[i]; if(!c)return;
  if(field==='chiPhi'){ c.chiPhi=tkNum_(value); coverTaySet_(c.stt,true);
    var ma=S.cur&&S.cur.maDA; if(ma) api('saveCover',ma,S.cover).catch(function(e){ toast('Lỗi lưu tờ bìa: '+e.message); }); }
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
  var d=(S._projData&&S._projData.area);                       // bản trên server (nạp khi mở dự án)
  if(!d||typeof d!=='object'){ try{ d=JSON.parse(localStorage.getItem('qs_area_'+S.cur.maDA)||'{}')||{}; }catch(e){ d={}; } }
  S.areaData=d; S._areaDA=S.cur.maDA; return d; }
function areaSave_(){ if(!S.cur) return;
  try{ localStorage.setItem('qs_area_'+S.cur.maDA, JSON.stringify(S.areaData||{})); }catch(e){}
  projDataSet_('area', S.areaData||{}); }
function areaSet_(k,field,val){ var d=areaLoad_(); d[k]=d[k]||{}; d[k][field]=tkNum_(val); areaSave_(); drawBaogia(); }
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
var ROMAN_=['I','II','III','IV','V','VI','VII','VIII','IX','X','XI','XII','XIII','XIV','XV'];
// Dựng danh sách trang: [trang tóm tắt] + [các trang chi tiết]
function bgBuildPages(){
  var p=S.cur||{}, comp=coverCosts();
  /* Mỗi trang giữ kèm SỐ DÒNG và TỔNG TIỀN của riêng trang đó để in xuống chân trang —
     xem trước hay xuất PDF đều đọc được ngay trang này có bao nhiêu record, bao nhiêu tiền. */
  var inners=[], metas=[];
  function themTrang(html, meta){ inners.push(html); metas.push(meta||{}); }
  var hangMuc = 'TỔNG HỢP CHI PHÍ';                // trang 1 luôn là tờ bìa của cả dự án
  var org=bgOrg_(), opt=bgOpt_(), ver=bgVerInfo_();
  var decoxHead='<div class="qx-head"><div class="qx-brandbox">'
      +(org.logo?'<img class="qx-logo" src="'+esc(safeUrl_(org.logo))+'" alt="">':'')
      +'<div class="qx-brand'+(org.logo?' sm':'')+'">'+esc(org.ten)+'</div>'
    +'<div class="qx-org">'+org.lines.map(esc).join('<br>')+'</div></div>'
    +'<div class="qx-titlebox"><div class="t1">BẢNG ƯỚC TÍNH CHI PHÍ DỰ ÁN</div><div class="t2">HẠNG MỤC: '+esc(String(hangMuc).toUpperCase())+'</div>'
      +'<div class="t3">Mã: <b>'+esc(ver.ma)+'</b> · '+esc(ver.nhan)+' · Ngày '+esc(fmtVN_(opt.ngay))+'</div></div></div>';
  function ip(k,v){ return '<td class="k">'+k+'</td><td class="v">'+esc(v||'')+'</td>'; }
  var infoBlock='<table class="qx-info">'
    +'<tr>'+ip('Khách hàng',p.khachHang)+ip('Hiện trạng',p.hienTrang)+'</tr>'
    +'<tr>'+ip('Tên dự án',p.ten)+ip('Quy mô',p.quyMo)+'</tr>'
    +'<tr>'+ip('DT sử dụng',p.tongDT?p.tongDT+' m²':'')+ip('Nhu cầu',p.nhuCau)+'</tr>'
    +'<tr>'+ip('Phong cách',p.phanKhuc)+ip('DT báo giá [nhân hệ số]',p.dtBaoGia?p.dtBaoGia+' m²':'')+'</tr>'
    +'</table>';
  // ===== TRANG 1 = TỜ BÌA (Mẫu 1 hoặc Mẫu 2) — luôn có, không phụ thuộc hạng mục đã chọn =====
  themTrang(decoxHead+infoBlock+bgCoverPage_(comp), {ten:'Tờ bìa'});
  // ===== Từ trang 2: bảng chi tiết các hạng mục đã bóc được chọn, THEO ĐÚNG CHIP CỘT đang bật =====
  var lines=bgLines_();
  var cols=bgDocCols_();
  var coAnh=cols.some(function(c){ return c[0]==='hinhAnh'; });
  var nCot=cols.length+1;                       // +1 cho cột STT
  var colg=bgColg_(cols,30), thead=bgTh_(cols);
  var tblCls='qx-tbl'+(cols.length>=15?' qx-dense':'')+(cols.length>=20?' qx-dense2':'');
  function rowHtml(l,ri){
    return '<tr><td class="ct">'+(ri+1)+'</td>'
      +cols.map(function(c){ return '<td class="'+bgDocAlign_(c[0])+'">'+bgDocCell_(l,c[0])+'</td>'; }).join('')+'</tr>';
  }
  function secRow(nhan, tien){ return bgSecRow_(cols, nhan, tien, 'thanhTien'); }
  var PER = bgPerRows_(coAnh);                  // số dòng mỗi trang (tự động: có ảnh 8, không ảnh 13)
  if(bgPerSec_()){
    var byNode={}, ordN=[];
    lines.forEach(function(l){ var c=(l.nhom||'').trim()||'__k'; if(!byNode[c]){ byNode[c]=[]; ordN.push(c); } byNode[c].push(l); });
    ordN.forEach(function(code){
      var its=byNode[code], ten=(code==='__k'?'KHÁC':(nodeName(code)||code));
      var secTt=its.reduce(function(a,l){ return a+ttBan_(l); },0);
      var flatN=[], metaN=[], byF={}, ordF=[];
      its.forEach(function(l){ var g=(l.tang||'').trim()||'HẠNG MỤC'; if(!byF[g]){byF[g]=[];ordF.push(g);} byF[g].push(l); });
      ordF.forEach(function(g,gi){
        var sub=byF[g].reduce(function(a,l){ return a+ttBan_(l); },0);
        flatN.push(secRow((ROMAN_[gi]||(gi+1))+'. '+esc(g), sub)); metaN.push(null);
        byF[g].forEach(function(l,ri){ flatN.push(rowHtml(l,ri)); metaN.push(ttBan_(l)); });
      });
      flatN.push(secRow('<b>TỔNG '+esc(String(ten).toUpperCase())+'</b>', secTt)); metaN.push(null);
      for(var q0=0;q0<flatN.length;q0+=PER){
        themTrang('<div class="qx-secttl">'+esc(String(ten).toUpperCase())+(q0?' (tiếp)':'')+'</div>'
          +'<table class="'+tblCls+'">'+colg+thead+flatN.slice(q0,q0+PER).join('')+'</table>',
          bgMetaTrang_(ten, metaN.slice(q0,q0+PER)));
      }
    });
  } else {
    var groups={},order=[]; lines.forEach(function(l){ var g=(l.tang||'').trim()||'HẠNG MỤC'; if(!groups[g]){groups[g]=[];order.push(g);} groups[g].push(l); });
    var flat=[], metaF=[];
    order.forEach(function(g,gi){
      var items=groups[g]||[], sec=items.reduce(function(a,l){return a+ttBan_(l);},0);
      flat.push(secRow((ROMAN_[gi]||(gi+1))+'. '+esc(g), sec)); metaF.push(null);
      items.forEach(function(l,ri){ flat.push(rowHtml(l,ri)); metaF.push(ttBan_(l)); });
    });
    if(flat.length){ for(var i=0;i<flat.length;i+=PER){
      themTrang((i===0?'<div class="qx-secttl">BẢNG BÁO GIÁ CHI TIẾT</div>':'')+'<table class="'+tblCls+'">'+colg+thead+flat.slice(i,i+PER).join('')+'</table>',
        bgMetaTrang_('Bảng báo giá chi tiết', metaF.slice(i,i+PER)));
    } }
  }
  // ===== PHẦN THÔ (3.1) — bảng ước tính riêng, không nằm trong S.lines =====
  var ptSecs=bgPTSecs_(), ptTong=0;
  if(ptSecs.length){
    var pcols=bgPTCols_(ptSecs);
    var pcolg=bgColg_(pcols,30), pthead=bgTh_(pcols,true), nP=pcols.length+1;
    function pSecRow(nhan,tien){ return bgSecRow_(pcols, nhan, tien, 'tt'); }
    var flatP=[], metaP=[];
    ptSecs.forEach(function(sec,gi){
      ptTong+=Number(sec.tt)||0;
      flatP.push(pSecRow((ROMAN_[gi]||(gi+1))+'. '+esc(String(sec.ten).toUpperCase()), sec.tt)); metaP.push(null);
      sec.items.forEach(function(it,ri){
        flatP.push('<tr><td class="ct">'+(ri+1)+'</td>'
          +pcols.map(function(c){ return '<td class="'+bgDocAlign_(c[0])+'">'+bgPTCell_(it,c[0])+'</td>'; }).join('')+'</tr>');
        metaP.push(Number(it.tt)||0);
      });
    });
    flatP.push(pSecRow('<b>TỔNG PHẦN THÔ</b>', ptTong)); metaP.push(null);
    for(var qp=0; qp<flatP.length; qp+=PER){
      themTrang('<div class="qx-secttl">PHẦN THÔ — ƯỚC TÍNH CHI PHÍ XÂY DỰNG'+(qp?' (tiếp)':'')+'</div>'
        +'<table class="qx-tbl">'+pcolg+pthead+flatP.slice(qp,qp+PER).join('')+'</table>',
        bgMetaTrang_('Phần thô', metaP.slice(qp,qp+PER)));
    }
  }
  // ===== Hộp tổng + ghi chú + ô ký =====
  // Tổng phải ĐÚNG phạm vi đang xuất: chỉ cộng các dòng đã lọc theo hạng mục + phần thô
  // (trước đây luôn cộng cả dự án nên chọn 1 hạng mục mà tổng vẫn ra tiền của hạng mục khác).
  var subBG=lines.reduce(function(a,l){ return a+ttBan_(l); },0)+ptTong;
  inners[inners.length-1]+=bgTongKetHTML_(bgTong_(subBG), org);
  var N=inners.length;
  return inners.map(function(inner,idx){
    var m=metas[idx]||{};
    // Chân trang ghi rõ: đơn vị — dự án · nội dung trang · SỐ DÒNG · tiền của trang · số trang
    var giua=[m.ten||'', m.dong?(m.dong+' dòng'):'', m.dong?(money(m.tien||0)+' đ'):''].filter(Boolean).join(' · ');
    var foot='<div class="qp-foot">'
      +'<span>'+esc(org.ten)+' — '+esc(p.ten||'')+'</span>'
      +'<span class="qp-mid">'+esc(giua)+'</span>'
      +'<span>Trang '+(idx+1)+' / '+N+'</span></div>';
    return {html:'<div class="qs-page qx-page">'+inner+foot+'</div>', meta:Object.assign({trang:idx+1}, m)};
  });
}
/* Gom số liệu của 1 trang: bao nhiêu dòng dữ liệu (bỏ dòng tiêu đề nhóm / dòng tổng) và
   tổng tiền của đúng những dòng đó. */
function bgMetaTrang_(ten, tienDs){
  var n=0, t=0;
  (tienDs||[]).forEach(function(v){ if(v==null) return; n++; t+=Number(v)||0; });
  return {ten:ten, dong:n, tien:t};
}
/* ---- Tờ bìa cho TRANG 1 (bản chỉ đọc, theo Mẫu 1 / Mẫu 2) ---- */
function bgCoverPage_(comp){
  var cost=comp.cost, total=comp.total;
  var rows=(S.cover||[]).filter(function(c){ return !bgHidden(c.stt); }).slice().sort(coverSortFn);
  if(!rows.length) return '<div class="qx-secttl">CHI TIẾT CÁC HẠNG MỤC</div>'
    +'<div class="qsum-card"><table class="qsum"><tr><td class="nm" style="color:#94a3b8;padding:16px 0">Chưa có tờ bìa — sang chế độ <b>Chỉnh sửa</b> bấm “↻ Nạp mẫu”.</td></tr></table></div>';
  var m1 = (S.coverMau==='m1');
  var body;
  if(m1){
    // Mẫu 1: gộp theo mục lớn (một ô HẠNG MỤC dùng chung cho các dòng con)
    var secs=rows.filter(function(c){ return coverDepth(c.stt)===1; });
    body=secs.map(function(sec){
      var kids=rows.filter(function(c){ return c.stt!==sec.stt && String(c.stt).indexOf(sec.stt+'.')===0; });
      if(!kids.length) kids=[sec];
      return kids.map(function(c,ki){
        var val=cost[c.stt]||0, pct=total>0?(val/total*100):0;
        var lead = ki===0 ? '<td class="ct" rowspan="'+kids.length+'">'+esc(sec.stt)+'</td>'
            +'<td class="hm" rowspan="'+kids.length+'">'+esc(sec.hangMuc||'')+'</td>' : '';
        return '<tr>'+lead+'<td>'+esc(c===sec?'':(c.hangMuc||''))+'</td>'
          +'<td class="num">'+money(val)+'</td><td class="num">'+pct.toFixed(2)+'%</td>'
          +'<td class="it">'+esc(c.moTa||'')+'</td></tr>';
      }).join('');
    }).join('');
    return '<div class="qx-secttl">CHI TIẾT CÁC HẠNG MỤC</div>'
      +'<table class="qx-tbl qx-cover"><tr class="qx-h"><th class="ct">NO</th><th>HẠNG MỤC</th><th>NỘI DUNG</th>'
      +'<th class="num">CHI PHÍ DỰ KIẾN</th><th class="num">TỶ TRỌNG</th><th>MÔ TẢ</th></tr>'
      +body+'<tr class="sec"><td colspan="3" style="text-align:right"><b>TỔNG CHI PHÍ DỰ KIẾN</b></td>'
      +'<td class="num"><b>'+money(total)+'</b></td><td class="num"><b>100%</b></td><td></td></tr></table>';
  }
  // Mẫu 2: danh sách phẳng phân cấp
  body=rows.map(function(c){
    var lvl=coverDepth(c.stt), val=cost[c.stt]||0, pct=total>0?(val/total*100):0;
    return '<tr class="lv'+lvl+'"><td class="ct">'+esc(c.stt)+'</td>'
      +'<td>'+esc(c.hangMuc||'')+'</td>'
      +'<td class="num">'+money(val)+'</td><td class="num">'+pct.toFixed(2)+'%</td>'
      +'<td class="it">'+esc(c.moTa||'')+'</td></tr>';
  }).join('');
  return '<div class="qx-secttl">CHI TIẾT CÁC HẠNG MỤC</div>'
    +'<table class="qx-tbl qx-cover"><tr class="qx-h"><th class="ct">NO</th><th>HẠNG MỤC</th>'
    +'<th class="num">CHI PHÍ DỰ KIẾN</th><th class="num">TỶ TRỌNG</th><th>MÔ TẢ</th></tr>'
    +body+'<tr class="sec"><td colspan="2" style="text-align:right"><b>TỔNG CHI PHÍ DỰ KIẾN</b></td>'
    +'<td class="num"><b>'+money(total)+'</b></td><td class="num"><b>100%</b></td><td></td></tr></table>';
}
/* ---- Cột của bảng chi tiết trong tài liệu = đúng các chip cột đang bật ---- */
function bgDocCols_(){
  var vis=visCols().filter(function(c){ return c[0]!=='stt' && c[0]!=='taiLieu'; });
  if(!vis.length) vis=[['ten','Tên sản phẩm'],['soLuong','Số lượng'],['donGiaCK','Đơn giá'],['thanhTien','Thành tiền']];
  var ord=S.bgColOrder||[];
  if(ord.length){                                  // thứ tự do người dùng kéo trên trang xem trước
    var by={}; vis.forEach(function(c){ by[c[0]]=c; });
    var out=[]; ord.forEach(function(k){ if(by[k]){ out.push(by[k]); delete by[k]; } });
    vis.forEach(function(c){ if(by[c[0]]) out.push(c); });
    vis=out;
  }
  return vis;
}
/* Rộng cột trên tài liệu là TRỌNG SỐ, không phải px cứng: khi dựng bảng, tất cả quy về %
   nên tổng luôn đúng 100% — bật bao nhiêu cột bảng cũng nằm gọn trong trang giấy
   (trước đây cộng px vượt bề ngang trang nên các cột cuối tràn ra ngoài khung).       */
var BG_DOC_W={ khuVuc:64, maBanVe:56, nganh:70, maSP:66, ten:150, thuongHieu:64,
  ncc:64, moTa:150, kichThuoc:82, hinhAnh:52, dvt:34, soLuong:40, giaNCC:66,
  chietKhau:44, giaDaiLy:66, lnPct:44, donGia:70, ckKhach:44, donGiaCK:70,
  markup:46, margin:46, lnVnd:66, thanhTien:84, trangThai:60, ghiChu:70,
  n:200, kl:56, dg:76, tt:88, dgnt:76, ttnt:88, gc:110 };   // cột bảng Phần thô
function bgDocW_(k){ return Math.max(22, Number((S.bgColW||{})[k])||BG_DOC_W[k]||64); }
function bgDocTongW_(cols,sttW){ return (sttW||0)+cols.reduce(function(a,c){ return a+bgDocW_(c[0]); },0); }
function bgColg_(cols,sttW){
  sttW=(sttW==null?30:sttW);
  var tong=bgDocTongW_(cols,sttW), pc=function(w){ return (w/tong*100).toFixed(3)+'%'; };
  return '<colgroup>'+(sttW?'<col style="width:'+pc(sttW)+'">':'')
    +cols.map(function(c){ return '<col style="width:'+pc(bgDocW_(c[0]))+'">'; }).join('')+'</colgroup>';
}
/* Đầu cột trên trang xem trước: kéo để đổi vị trí · kéo mép phải để chỉnh rộng.
   Tay kéo .qxrsz bị ẩn khi in / xuất PDF nên không lọt vào file.                      */
function bgTh_(cols, khongDoiChoCot){
  return '<tr class="qx-h"><th class="ct">STT</th>'
    +cols.map(function(c){
      var keo = khongDoiChoCot ? '' : (' draggable="true"'
        +' ondragstart="bgColDragStart(event,\''+c[0]+'\')" ondragover="event.preventDefault()" ondrop="bgColDrop(event,\''+c[0]+'\')"');
      return '<th class="'+bgDocAlign_(c[0])+'" data-k="'+esc(c[0])+'"'+keo
        +' title="'+(khongDoiChoCot?'Kéo mép phải để chỉnh rộng':'Kéo để đổi vị trí cột · kéo mép phải để chỉnh rộng')+'">'
        +'<span class="qxth">'+esc(String(c[1]).toUpperCase())+'</span>'
        +'<span class="qxrsz" data-k="'+esc(c[0])+'"></span></th>'; }).join('')+'</tr>';
}
function bgColDragStart(e,k){
  if(e.target&&e.target.closest&&e.target.closest('.qxrsz')){ e.preventDefault(); return; }
  S._bgDragK=k; try{ e.dataTransfer.setData('text/plain',k); }catch(x){}
}
function bgColDrop(e,k){
  e.preventDefault(); var from=S._bgDragK; S._bgDragK=null; if(!from||from===k) return;
  var ord=bgDocCols_().map(function(c){ return c[0]; }).filter(function(x){ return x!==from; });
  var i=ord.indexOf(k); if(i<0) i=ord.length; ord.splice(i,0,from);
  S.bgColOrder=ord; bgCfgSave_(); drawBaogia();
}
// khoá cột của 1 bảng đang hiện (bỏ cột STT đầu tiên); rỗng nếu không phải bảng chi tiết
function bgThKeys_(t){
  if(!t) return [];
  var ths=[].slice.call(t.querySelectorAll('th')); if(ths.length<2) return [];
  var ks=ths.slice(1).map(function(th){ return th.getAttribute('data-k'); });
  return ks.every(Boolean)?ks:[];
}
function bgColReset_(){ S.bgColW={}; S.bgColOrder=null; bgCfgSave_(); drawBaogia(); toast('Đã trả cột về mặc định'); }
function bgColTuyBien_(){ return !!(S.bgColOrder&&S.bgColOrder.length) || Object.keys(S.bgColW||{}).length>0; }
// kéo mép chỉnh rộng cột ngay trên trang xem trước
document.addEventListener('mousedown',function(e){
  var rs=e.target.closest&&e.target.closest('.qxrsz'); if(!rs) return;
  e.preventDefault(); e.stopPropagation();
  var k=rs.dataset.k, sx=e.clientX, sw=bgDocW_(k);
  var tb=rs.closest('table'), rong=tb?tb.getBoundingClientRect().width:900;
  var ksTb=bgThKeys_(tb), heSo=(rong&&ksTb.length)?((30+ksTb.reduce(function(a,x){return a+bgDocW_(x);},0))/rong):1;
  S.bgColW=S.bgColW||{};
  // vẽ lại bề rộng cho MỌI bảng đang hiện (bảng sản phẩm và bảng phần thô có bộ cột khác nhau)
  function ve(){
    document.querySelectorAll('#qsDoc table.qx-tbl').forEach(function(t){
      var ks=bgThKeys_(t); if(!ks.length) return;
      var co=t.querySelectorAll('colgroup col'); if(co.length!==ks.length+1) return;
      var tong=30+ks.reduce(function(a,x){ return a+bgDocW_(x); },0);
      co[0].style.width=(30/tong*100).toFixed(3)+'%';
      ks.forEach(function(x,i){ co[i+1].style.width=(bgDocW_(x)/tong*100).toFixed(3)+'%'; });
    });
  }
  function mv(ev){ S.bgColW[k]=Math.max(22, Math.round(sw+(ev.clientX-sx)*heSo)); ve(); }
  function up(){ document.removeEventListener('mousemove',mv); document.removeEventListener('mouseup',up); bgCfgSave_(); drawBaogia(); }
  document.addEventListener('mousemove',mv); document.addEventListener('mouseup',up);
});
/* Số dòng mỗi trang · phóng to thu nhỏ · rộng/thứ tự cột — nhớ theo máy */
function bgCfgSave_(){ try{ localStorage.setItem('qs_bgdoc', JSON.stringify({
    per:Number(S.bgPer)||0, zoom:S.bgZoom||'fit', w:S.bgColW||{}, ord:S.bgColOrder||null })); }catch(e){} }
function bgCfgLoad_(){
  if(S._bgCfg) return; S._bgCfg=1;
  var o=null; try{ o=JSON.parse(localStorage.getItem('qs_bgdoc')||'null'); }catch(e){}
  if(!o) return;
  if(o.per!=null) S.bgPer=Number(o.per)||0;
  if(o.zoom) S.bgZoom=o.zoom;
  if(o.w&&typeof o.w==='object') S.bgColW=o.w;
  if(Array.isArray(o.ord)&&o.ord.length) S.bgColOrder=o.ord;
}
function bgPerRows_(coAnh){ var v=Number(S.bgPer)||0; return v>0?v:(coAnh?8:13); }
function bgSetPer_(v){ S.bgPer=Number(v)||0; S.bgPage=1; bgCfgSave_(); drawBaogia(); }
function bgSetZoom_(v){ S.bgZoom=v; bgCfgSave_(); drawBaogia(); }
// Áp mức phóng sau khi chèn HTML (fit = vừa bề ngang khung xem)
function bgZoomApply_(){
  var doc=document.getElementById('qsDoc'); if(!doc) return;
  var z=S.bgZoom||'fit', v;
  if(z==='fit'){ var box=document.getElementById('bgViewport')||document.getElementById('v-export');
    var rong=(box?box.clientWidth:0)-18; v=rong>0?Math.min(1, rong/1123):1; }
  else v=(Number(z)||100)/100;
  doc.style.zoom=v;
}
function bgDocAlign_(k){
  if(['soLuong','giaNCC','giaDaiLy','donGia','donGiaCK','lnVnd','thanhTien','kl','dg','tt','dgnt','ttnt'].indexOf(k)>=0) return 'num';
  if(['hinhAnh','dvt','chietKhau','lnPct','ckKhach','markup','margin','maBanVe','nganh'].indexOf(k)>=0) return 'ct';
  return '';
}
function bgDocCell_(l,k){
  switch(k){
    case 'hinhAnh': return l.hinhAnh?('<img class="qx-img" src="'+esc(imgSrc1_(l.hinhAnh))+'" onerror="this.style.display=\'none\'">'):'';
    case 'ten': return '<b>'+esc(l.ten||'')+'</b>'+(l.maSP?'<span class="qx-ma">'+esc(l.maSP)+'</span>':'');
    case 'moTa': return '<span class="qx-desc">'+esc(l.moTa||'')+'</span>';
    case 'kichThuoc': return '<span class="qx-desc">'+esc(l.kichThuoc||'')+'</span>';
    case 'giaNCC': return money(l.donGiaVon);
    case 'giaDaiLy': return money(giaDaiLy_(l));
    case 'donGia': return l.donGiaBan?money(l.donGiaBan):'';
    case 'donGiaCK': return money(donGiaCK_(l));
    case 'lnVnd': return money(lnVnd_(l));
    case 'thanhTien': return ttBan_(l)?money(ttBan_(l)):'-';
    case 'markup': return markup_(l)+'%';
    case 'margin': return margin_(l)+'%';
    case 'chietKhau': return (Number(l.chietKhau)||0)+'%';
    case 'lnPct': return (Number(l.lnPct)||0)+'%';
    case 'ckKhach': return (Number(l.ckKhach)||0)+'%';
    case 'soLuong': return String(Number(l.soLuong)||0);
    case 'nganh': return esc((l.extra&&l.extra.nganh)||'');
    default: return esc(l[k]==null?'':String(l[k]));
  }
}
/* ═══ PHẦN THÔ (đề mục 3.1) TRÊN FILE BÁO GIÁ ═══
   Phần thô có bảng ước tính riêng (S.phanTho, lưu theo dự án) chứ KHÔNG nằm trong
   S.lines như sản phẩm, nên trước đây tích hạng mục Phần thô là tài liệu trắng trơn.
   Nay dựng bảng riêng cho phần thô với đúng bộ cột của nó và cộng vào tổng cuối.   */
/* Dòng tiêu đề nhóm: số tiền đặt vào ĐÚNG cột Thành tiền (trước đây luôn rơi vào cột
   cuối cùng — bật thêm cột Trạng thái / Ghi chú là tiền nhảy sang cột đó).            */
function bgSecRow_(cols, nhan, tien, keyTT){
  var ks=cols.map(function(c){ return c[0]; });
  var iTT=ks.indexOf(keyTT); if(iTT<0) iTT=ks.length-1;
  var truoc=Math.max(1,iTT), sau=ks.length-truoc-1;
  return '<tr class="sec"><td class="ct"></td><td colspan="'+truoc+'">'+nhan+'</td>'
    +'<td class="num">'+(tien?money(tien):'-')+'</td>'
    +(sau>0?'<td colspan="'+sau+'"></td>':'')+'</tr>';
}
function bgPTOn_(){
  var sel=bgSelCodes_();
  if(!sel.length) return true;                       // không tích gì = xuất tất cả
  return sel.some(function(c){ return c==='3.1' || String(c).indexOf('3.1.')===0; });
}
function bgPTSecs_(){
  if(!bgPTOn_()||!S.cur) return [];
  try{ ptEnsure(); }catch(e){ return []; }
  return (S.phanTho||[]).map(function(sec){
    var st=ptSecTotals(sec);                          // gán it._kl / _tt / _ttnt
    return { ten:String(sec.t||'Hạng mục').split('\n')[0], tt:st.tt,
      items:(sec.items||[]).map(function(it){
        return { n:String(it.n||'').split('\n')[0]||String(it.n||''), dvt:it.dvt||'', kl:it._kl,
          dg:ptN(it.dg), tt:it._tt, dgnt:ptN(it.dgnt), ttnt:it._ttnt, gc:it.gc||'' };
      }) };
  }).filter(function(x){ return x.items.length; });
}
function bgPTRows_(){ return bgPTSecs_().reduce(function(a,s){ return a+s.items.length; },0); }
/* Cột bảng phần thô đi theo chip cột đang bật (cột nào của SP không có nghĩa thì bỏ):
   Nội dung ↔ Tên sản phẩm · ĐVT · Khối lượng ↔ Số lượng · Đơn giá · Thành tiền · Ghi chú.
   Giá nhà thầu chỉ hiện khi chip "Giá đại lý / Giá bán lẻ" đang bật (bản nội bộ).      */
function bgPTCols_(secs){
  var on={}; visCols().forEach(function(c){ on[c[0]]=1; });
  var coGC=(secs||[]).some(function(s){ return s.items.some(function(it){ return String(it.gc||'').trim(); }); });
  var cols=[['n','Nội dung công việc']];
  cols.push(['dvt','ĐVT']);
  cols.push(['kl','Khối lượng']);
  if(on.giaNCC||on.giaDaiLy) cols.push(['dgnt','Đơn giá (nhà thầu)']);
  if(on.giaNCC||on.giaDaiLy) cols.push(['ttnt','Thành tiền (nhà thầu)']);
  cols.push(['dg','Đơn giá']);
  cols.push(['tt','Thành tiền']);
  if(coGC) cols.push(['gc','Ghi chú']);
  return cols;
}
function bgPTCell_(it,k){
  switch(k){
    case 'n': return '<b>'+esc(it.n||'')+'</b>';
    case 'kl': return it.kl?ptQty(it.kl):'';
    case 'dg': return it.dg?money(it.dg):'';
    case 'tt': return it.tt?money(it.tt):'-';
    case 'dgnt': return it.dgnt?money(it.dgnt):'';
    case 'ttnt': return it.ttnt?money(it.ttnt):'';
    case 'gc': return '<span class="qx-desc">'+esc(it.gc||'')+'</span>';
    default: return esc(it[k]==null?'':String(it[k]));
  }
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
  var pg=pages[S.bgPage-1], m=(pg&&pg.meta)||{};
  /* Khung xem KÉO ĐƯỢC: thanh công cụ đứng yên, chỉ vùng trang giấy cuộn bên trong.
     Kéo mép dưới để chỉnh chiều cao khung, nhớ theo máy (qs_bgH).                    */
  return '<div class="bgvp-hd">'
      +'<span class="bgvp-t">'+esc(m.ten||'Trang '+S.bgPage)+'</span>'
      +(m.dong?('<span class="bgvp-n">'+m.dong+' dòng</span><span class="bgvp-tien">'+money(m.tien||0)+' đ</span>'):'')
      +'<span style="flex:1"></span>'
      +'<span class="bgvp-p">Trang '+S.bgPage+' / '+pages.length+'</span>'
    +'</div>'
    +'<div class="bgvp" id="bgViewport"><div class="qs-doc" id="qsDoc">'+pg.html+'</div>'
      +'<div class="bgvp-grip" id="bgVpGrip" title="Kéo để chỉnh chiều cao khung xem"></div></div>'
    +bgPager(pages.length,S.bgPage);
}
/* kéo mép dưới khung xem để chỉnh chiều cao */
function bgVpApply_(){
  var v=document.getElementById('bgViewport'); if(!v) return;
  var h=Number(S.bgVpH||0); if(!h){ try{ h=Number(localStorage.getItem('qs_bgH'))||0; }catch(e){} }
  if(!h) h=Math.max(420, Math.round(window.innerHeight*0.66));
  S.bgVpH=h; v.style.height=h+'px';
}
function bgVpBind_(){
  var g=document.getElementById('bgVpGrip'), v=document.getElementById('bgViewport');
  if(!g||!v||g.dataset.b==='1') return;
  g.dataset.b='1';
  g.addEventListener('mousedown',function(e){
    e.preventDefault();
    var y0=e.clientY, h0=v.getBoundingClientRect().height;
    document.body.style.cursor='ns-resize';
    function mv(ev){ var h=Math.max(260, Math.min(window.innerHeight*2, h0+(ev.clientY-y0)));
      S.bgVpH=Math.round(h); v.style.height=S.bgVpH+'px'; }
    function up(){ document.removeEventListener('mousemove',mv); document.removeEventListener('mouseup',up);
      document.body.style.cursor='';
      try{ localStorage.setItem('qs_bgH', String(S.bgVpH||'')); }catch(e){}
      bgZoomApply_(); }
    document.addEventListener('mousemove',mv); document.addEventListener('mouseup',up);
  });
  g.addEventListener('dblclick',function(){       // bấm đúp = trả về chiều cao mặc định
    S.bgVpH=Math.max(420, Math.round(window.innerHeight*0.66)); v.style.height=S.bgVpH+'px';
    try{ localStorage.setItem('qs_bgH', String(S.bgVpH)); }catch(e){}
    bgZoomApply_(); toast('Đã trả khung xem về chiều cao mặc định');
  });
}
var QS_DOC_CSS=''
+'.qs-doc{display:flex;justify-content:center;margin:16px 0 4px;overflow-x:auto;padding-bottom:6px}'
+'.qs-page{width:1123px;min-height:794px;background:#fff;border:1px solid #e6e9ee;border-radius:10px;box-shadow:0 8px 30px rgba(20,40,80,.10);padding:54px 60px 48px;box-sizing:border-box;position:relative;font-family:Arial,Helvetica,sans-serif;color:#1f2937}'
+'.qp-head{display:flex;justify-content:space-between;align-items:center;font-size:11px;color:#9aa4b2;border-bottom:1px solid #eef1f4;padding-bottom:9px;margin-bottom:28px}'
+'.qp-proj{font-weight:700;color:#334155;text-transform:uppercase;letter-spacing:.4px}'
+'.qp-foot{position:absolute;left:60px;right:60px;bottom:22px;display:flex;justify-content:space-between;align-items:baseline;gap:12px;font-size:10px;color:#aab3c0;border-top:1px solid #eef1f4;padding-top:8px}'
+'.qp-foot .qp-mid{flex:1;text-align:center;color:#6b7280;font-weight:600;letter-spacing:.02em}'
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
+'.qx-img{width:100%;height:auto;max-height:240px;object-fit:contain;display:block;margin:0 auto;background:#fff}'
+'.qx-ma{display:block;font-size:8px;color:#9aa3af;font-weight:400;margin-top:1px}'
+'.qx-cover td.hm{font-weight:700}'
+'.qx-cover tr.lv1 td{font-weight:700;background:#fafbfc}'
+'.qx-cover tr.lv3 td:first-child{padding-left:14px}'
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
+'.qx-page{padding:34px 38px 42px}'
+'.qx-head{display:flex;justify-content:space-between;align-items:flex-start;gap:20px;margin-bottom:4px}'
+'.qx-brand{font-size:26px;font-weight:700;letter-spacing:.16em;color:#0f2942;line-height:1}'
+'.qx-org{font-size:9.5px;color:#5b6b7b;line-height:1.65;margin-top:8px;letter-spacing:.01em}'
+'.qx-titlebox{background:#12314f;color:#fff;text-align:center;padding:13px 22px;min-width:280px}'
+'.qx-titlebox .t1{font-size:12.5px;font-weight:600;letter-spacing:.09em;text-transform:uppercase}'
+'.qx-titlebox .t2{font-size:11px;font-weight:500;margin-top:5px;letter-spacing:.04em;color:#c7d6e6}'
+'.qx-info{width:100%;border-collapse:collapse;margin:20px 0 0;table-layout:fixed;border-top:1px solid #dbe1e9;border-bottom:1px solid #dbe1e9}'
+'.qx-info td{padding:8px 12px;font-size:10.5px;vertical-align:top;border-bottom:1px solid #eef1f5}'+'.qx-info tr:last-child td{border-bottom:none}'
+'.qx-info td.k{font-weight:600;color:#8a96a5;width:16%;font-size:9px;letter-spacing:.06em;text-transform:uppercase;padding-top:10px}'
+'.qx-info td.v{color:#1f2937;width:34%;font-weight:500}'
+'.qx-secttl{font-size:10.5px;font-weight:600;color:#12233a;letter-spacing:.12em;text-transform:uppercase;margin:22px 0 8px;padding-bottom:6px;border-bottom:1px solid #dbe1e9}'
+'.qx-tbl{width:100%;border-collapse:collapse;font-size:10.5px}'
+'.qx-tbl th{background:#12314f;color:#fff;font-weight:600;padding:9px 8px;text-align:left;font-size:9px;vertical-align:middle;border-right:1px solid #ffffff1f;text-transform:uppercase;letter-spacing:.05em;line-height:1.25}'
+'.qx-tbl th.num{text-align:right}.qx-tbl th.ct{text-align:center}'
+'.qx-tbl th:last-child{border-right:none}'
+'.qx-tbl td{padding:8px;border-right:1px solid #e6eaef;border-bottom:1px solid #eef1f5;vertical-align:top;line-height:1.45}'
+'.qx-tbl td:last-child{border-right:none}'
+'.qx-tbl td.num{text-align:right;font-variant-numeric:tabular-nums}'
+'.qx-tbl td.ct{text-align:center}'
+'.qx-tbl td.it{font-style:italic;color:#4b5563}'
+'.qx-tbl tr.sec td{background:#eef1f5;font-weight:600;color:#12233a;letter-spacing:.02em;border-top:1px solid #d5dce4;border-bottom:1px solid #d5dce4}'
+'.qx-desc{color:#6b7280;font-size:9.5px;line-height:1.35;margin-top:2px}'
+'.qx-totbox{margin-top:0}'
+'.qx-totbox td{background:#12314f;color:#fff;padding:9px 12px;font-size:11.5px;font-weight:600;border-right:none;border-bottom:1px solid #ffffff1a;font-variant-numeric:tabular-nums}'+'.qx-totbox tr:last-child td{background:#0e2740;font-size:12.5px;font-weight:700}'
+'.qx-totbox td.lbl{text-align:right;letter-spacing:.06em;text-transform:uppercase;font-size:10px;font-weight:500;color:#c7d6e6}'
+'.qx-notes{background:#f7f9fb;border:1px solid #e6eaef;padding:12px 16px;margin-top:18px;font-size:10px;color:#4b5563;line-height:1.6}'
+'.qx-notes .h{font-weight:600;margin-bottom:5px;color:#12233a;letter-spacing:.05em;text-transform:uppercase;font-size:9px}'
+'.qx-notes ol{margin:0;padding-left:20px}.qx-notes li{margin:3px 0}'
+'.qx-sign{display:flex;margin-top:18px;border:1px solid #e6eaef}'
/* Bảng chi tiết: chia cột theo % + table-layout:fixed -> bật bao nhiêu cột cũng nằm gọn trong trang */
+'.qx-tbl{table-layout:fixed}'
+'.qx-tbl th,.qx-tbl td{overflow-wrap:anywhere;word-break:break-word}'
+'.qx-tbl th{position:relative}'
+'.qx-tbl.qx-dense{font-size:9.5px}.qx-tbl.qx-dense th{font-size:8px;padding:7px 5px}.qx-tbl.qx-dense td{padding:6px 5px}'
+'.qx-tbl.qx-dense2{font-size:8.5px}.qx-tbl.qx-dense2 th{font-size:7.5px;padding:6px 3px;letter-spacing:0}.qx-tbl.qx-dense2 td{padding:5px 3px}'
+'.qx-tbl th[draggable]{cursor:grab}.qx-tbl th[draggable]:active{cursor:grabbing}'
+'.qxrsz{position:absolute;top:0;right:-3px;width:7px;height:100%;cursor:col-resize;z-index:2}'
+'.qxrsz:hover{background:#ffffff55}'
+'@media print{.qxrsz{display:none}}'
+'.qx-sign .col{flex:1}.qx-sign .col:first-child{border-right:1px solid #d9dee5}'
+'.qx-sign .hd{background:#f7f9fb;font-weight:600;font-size:10px;padding:9px;color:#12233a;text-align:center;letter-spacing:.06em;text-transform:uppercase;border-bottom:1px solid #e6eaef}'
+'.qx-sign .sp{height:90px}'
+'.qx-sign .nm{text-align:center;font-size:10.5px;font-weight:600;color:#12233a;padding:0 8px 10px;min-height:22px}'
+'.qx-logo{max-height:46px;max-width:190px;object-fit:contain;display:block;margin-bottom:6px}'
+'.qx-brand.sm{font-size:15px;letter-spacing:.06em}'
+'.qx-titlebox .t3{font-size:10px;margin-top:7px;color:#c7d6e6;letter-spacing:.02em}.qx-titlebox .t3 b{color:#fff}'
+'.qx-totbox tr.grand td{background:#0b2438;font-size:12.5px;font-weight:700}.qx-totbox tr.grand td.lbl{color:#fff;font-size:10.5px}'
+'.qx-bangchu{border:1px solid #e6eaef;border-top:none;padding:8px 12px;font-size:10.5px;color:#12233a;background:#fbfcfd}'
+'.qx-bangchu i{color:#6b7785}'
+'.qx-dot{margin-top:14px;border:1px solid #e6eaef}'
+'.qx-dot .h{background:#f7f9fb;padding:7px 12px;font-size:9px;font-weight:600;letter-spacing:.05em;text-transform:uppercase;color:#12233a}'
+'.qx-dot table{width:100%;border-collapse:collapse;font-size:10.5px}'
+'.qx-dot th{font-size:9px;font-weight:600;color:#6b7785;text-align:left;padding:6px 12px;border-top:1px solid #eef1f4}'
+'.qx-dot td{padding:6px 12px;border-top:1px solid #eef1f4;color:#1f2d3d}'
+'.qx-dot .num{text-align:right;font-variant-numeric:tabular-nums}';
function ensureDocCss_(){ if(document.getElementById('qsDocCss')) return; var s=document.createElement('style'); s.id='qsDocCss'; s.textContent=QS_DOC_CSS; document.head.appendChild(s); }
function printDoc(pages){
  if(!S.cur){ toast('Chưa chọn dự án'); return; }
  if(!Array.isArray(pages)){ bgChot_('pdf'); drawBaogia(); pages=bgBuildPages(); }   // mỗi lần in nội dung mới = 1 phiên bản
  var p=S.cur||{};
  var html=pages.map(function(pg){return pg.html;}).join('');
  var pcss=QS_DOC_CSS
    +'@page{size:A4 landscape;margin:0}'
    +'body{margin:0;background:#fff}'
    +'.qs-doc{margin:0;display:block}'
    +'.qs-page{border:none;border-radius:0;box-shadow:none;margin:0 auto;page-break-after:always;width:297mm;min-height:209mm;padding:16mm 15mm 18mm}'
    +'.qs-page:last-child{page-break-after:auto}'
    +'.qp-foot{left:15mm;right:15mm;bottom:8mm}'
    +'.qxrsz{display:none}';     // tay kéo chỉnh cột chỉ có trên màn hình
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
    var price=leaf?'<td class="num"><input class="cin num" value="'+money(val)+'" onchange="coverEdit('+i+',\'chiPhi\',this.value)">'+coverTag_(c)+'</td>':'<td class="num">'+money(val)+'</td>';
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
      var price=leaf?'<td class="num"><input class="cin num" value="'+money(val)+'" onchange="coverEdit('+i+',\'chiPhi\',this.value)">'+coverTag_(c)+'</td>':'<td class="num">'+money(val)+'</td>';
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
  var lines=bgLines_();
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
    var gsum=(groups[g]||[]).reduce(function(s,l){ return s+ttBan_(l); },0);
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
  if(S._coverDA!==S.cur.maDA){
    var ma=S.cur.maDA, cv;
    box.innerHTML='<div class="empty">Đang tải tờ bìa…</div>';
    try{ cv=await api('getCoverOrInit',ma)||[]; }
    catch(e){ box.innerHTML='<div class="empty">Lỗi tải tờ bìa: '+esc(e.message)+'</div>'; return; }
    if(!S.cur||S.cur.maDA!==ma) return;          // đã đổi dự án trong lúc chờ
    S.cover=cv; S._coverDA=ma;
  }
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
    bgCfgLoad_();
    box.innerHTML=sechd
      +bgCtlBar_()
      +bgTkPanel_()
      +bgDocHTML();
    bgVpApply_(); bgVpBind_(); bgZoomApply_(); foldChipsSync_();   // nút thu gọn vừa vẽ lại -> trả đúng trạng thái
    return;
  }
  var comp=coverCosts(), p=S.cur||{}, q0=bgTong_(computeQuoteLocal().subtotal), q={subtotal:q0.sub, vatPct:q0.vatPct, vat:q0.vat, total:q0.total, ck:q0.ck};
  var secs=(S.cover||[]).filter(function(c){return coverDepth(c.stt)===1;}).sort(coverSortFn);
  var chips=secs.map(function(s){ return '<span class="bgchip'+(S.bgHide[s.stt]?' off':'')+'" onclick="bgToggle(\''+s.stt+'\')">'+esc(s.hangMuc||s.stt)+'</span>'; }).join('')||'<span class="hint" style="color:#889">Chưa có mục. Bấm ↻ Nạp lại mẫu.</span>';
  var covTable=S.coverMau==='m1'?coverTableM1(comp):coverTableM2(comp);
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
    +'<button class="btn ghost sm" onclick="coverAutoFill(this)" title="Mục có dòng bóc tách tự cộng tiền; bấm để bỏ các số đã sửa tay">'+icon('download',14)+' Lấy lại số từ bóc tách</button>'
    +'<button class="btn green sm" onclick="coverSave(this)">'+icon('check',15)+' Lưu tờ bìa</button></div>'
    +'<div class="dbcard-b">'+coverInner+'</div></div>';
  // ---- Card 4: bảng báo giá chi tiết ----
  var card4='<div class="dbcard"><div class="dbcard-h"><span class="dbcard-ic">'+icon('list',18)+'</span><h3>Bảng báo giá chi tiết</h3>'
    +'<span class="hint" style="margin-left:2px">Đồng bộ Bóc tách</span><span style="flex:1"></span>'
    +bgNodeBtn_('bgNodeBtn2')
    +'<button class="btn green sm" onclick="doExport(\'xlsx\',this)">'+icon('download',14)+' Excel</button>'
    +'<button class="btn red sm" onclick="printDoc()">'+icon('download',14)+' PDF / In</button></div>'
    +'<div class="dbcard-b"><div class="colchips">'+colChips+'</div>'+bgDetailHTML()
    +'<div class="totbar"><div class="b"><div class="tt">TẠM TÍNH</div><div class="tv">'+money(q.subtotal)+' đ</div></div>'
      +(q.ck?'<div class="b"><div class="tt">CHIẾT KHẤU</div><div class="tv">−'+money(q.ck)+' đ</div></div>':'')
      +'<div class="b"><div class="tt">VAT '+q.vatPct+'%</div><div class="tv">'+money(q.vat)+' đ</div></div>'
      +'<div class="b grand"><div class="tt">TỔNG CỘNG</div><div class="tv">'+money(q.total)+' đ</div></div></div></div></div>';
  box.innerHTML=sechd+card1+card2+bgAreaHTML()+card4;
  markBlocks_('#v-export table.tk');
}
// Feature 2: tự điền chi phí tờ bìa từ dữ liệu bóc tách (map theo mã nhóm)
// Bỏ mọi số sửa tay: mục nào có dòng bóc tách thì lấy lại đúng số của bóc tách
function coverAutoFill(btn){
  if(!S.cover||!S.cover.length){ toast('Chưa có tờ bìa. Bấm ↻ Nạp mẫu trước.'); return; }
  var n=Object.keys(bgOpt_().tay).length;
  bgOptSet_('tay',{});
  toast(n?('Đã bỏ '+n+' số sửa tay — tờ bìa lấy lại số từ bóc tách'):'Tờ bìa đang lấy đúng số từ bóc tách');
}
// Cột đưa vào file xuất = đúng các chip cột đang bật của bảng Bóc tách
var BG_KEYMAP={donGia:'donGia', donGiaCK:'donGiaCK', thanhTien:'thanhTien', giaNCC:'giaNCC'};
function bgExportCols_(){
  var vis=visCols();
  var cols=vis.map(function(c){ return {key:c[0], label:String(c[1]).toUpperCase()}; })
    .filter(function(c){ return c.key!=='stt' && c.key!=='taiLieu'; });
  cols.unshift({key:'stt',label:'STT'});
  if(!cols.some(function(c){ return c.key==='ten'; })) cols.splice(1,0,{key:'ten',label:'TÊN SẢN PHẨM'});
  return cols;
}
async function doExport(fmt,btn){
  if(!S.cur){ toast('Chưa chọn dự án'); return; }
  /* File xuất lấy giá ĐANG LƯU TRÊN DÒNG (bản chụp lúc thêm). Nếu danh mục đã đổi giá mà
     dòng chưa cập nhật thì file ra giá cũ — hỏi trước thay vì để người dùng gửi nhầm. */
  var lech=(typeof giaLechList_==='function')?giaLechList_():[];
  if(lech.length){
    var tl=await xacNhan_({ title:lech.length+' dòng đang dùng giá cũ', ok:'Vẫn xuất', huy:'Để tôi cập nhật trước',
      note:'Danh mục sản phẩm đã đổi giá nhưng các dòng dưới đây trong dự án vẫn giữ giá lúc thêm. Xuất bây giờ thì file ra GIÁ CŨ.',
      dong:lech.slice(0,30).map(function(x){ return (x.l.ten||'')+': '+money(x.cu)+' → '+money(x.von); }) });
    if(!tl){ giaSyncRun_(); return; }
  }
  var cols=bgExportCols_(), nodes=bgSelCodes_();
  var o=btn.textContent; btn.disabled=true; btn.textContent='Đang xuất…';
  try{
    // PDF dùng CHUNG bản tài liệu với "Xem trước & Xuất" (printDoc): đúng tờ bìa, đúng bộ
    // cột đang chọn, đúng khổ ngang. Bản in cũ chỉ có 7 cột cứng, khác hẳn
    // bản xem trước nên in ra là sai bố cục.
    if(fmt==='pdf'){ toast('Đang mở bản in…'); printDoc(); }
    else{
      // Phần thô nằm ở máy người dùng (không có trong DB) -> gửi kèm để file Excel có sheet "3.1 Phần thô"
      var pt=bgPTSecs_();
      // file Excel đọc tờ bìa ĐÃ LƯU -> lưu đúng số đang hiện (kể cả số tự cộng từ bóc tách) trước khi xuất
      var cc=coverCosts();
      if((S.cover||[]).length){
        S.cover.forEach(function(c){ if(!coverHasChild(c.stt)) c.chiPhi=cc.cost[c.stt]; });
        S.cover=await api('saveCover',S.cur.maDA,S.cover)||S.cover;
      }
      bgChot_('excel'); drawBaogia();
      var an=Object.keys(S.bgHide||{}).filter(function(k){ return S.bgHide[k]; });   // mục đã ẩn khỏi tờ bìa
      var r=await api('exportBaoGia',S.cur.maDA,cols,'xlsx',nodes,pt,an);
      dl(r); toast('Đã xuất Excel · '+cols.length+' cột'+(nodes.length?(' · '+nodes.length+' hạng mục'):'')+(pt.length?(' · kèm phần thô'):''));
    }
  }catch(e){ toast('Lỗi: '+e.message); } btn.disabled=false; btn.textContent=o;
}
function dl(res){ var b=atob(res.base64),a=new Uint8Array(b.length); for(var i=0;i<b.length;i++)a[i]=b.charCodeAt(i);
  var u=URL.createObjectURL(new Blob([a],{type:res.mimeType})); var el=document.createElement('a'); el.href=u; el.download=res.name; el.click(); setTimeout(function(){URL.revokeObjectURL(u);},1500); }

/* ═══════════ XUẤT BÁO GIÁ — chọn hạng mục cần xuất + chọn cột xuất + phân trang ═══════════ */
function bgSelSet_(){ S.bgNodes=S.bgNodes||{}; return S.bgNodes; }
// chỉ tính hạng mục ĐÃ BÓC của dự án đang mở (mục tích ở dự án khác mà dự án này không có -> bỏ qua)
function bgSelCodes_(){ var o=bgSelSet_(); return Object.keys(o).filter(function(k){ return o[k] && bgNodeCnt_(k)>0; }); }
function bgNodeCnt_(code){
  // Phần thô đếm theo bảng ước tính riêng của nó (không nằm trong S.lines)
  if(code==='3.1'){ try{ ptEnsure(); }catch(e){ return 0; }
    return (S.phanTho||[]).reduce(function(a,se){ return a+((se.items||[]).length); },0); }
  return (S.lines||[]).filter(function(l){ return l.nhom===code||String(l.nhom||'').indexOf(code+'.')===0; }).length;
}
// Các dòng sẽ lên báo giá (không tích gì = lấy tất cả)
function bgLines_(){
  var sel=bgSelCodes_(); if(!sel.length) return (S.lines||[]).slice();
  return (S.lines||[]).filter(function(l){ var c=String(l.nhom||'');
    return sel.some(function(nd){ return c===nd || c.indexOf(nd+'.')===0; }); });
}
function bgNodeLabel_(){
  var sel=bgSelCodes_();
  if(!sel.length) return 'TỔNG HỢP CHI PHÍ';
  if(sel.length===1) return nodeName(sel[0])||sel[0];
  return sel.length+' HẠNG MỤC';
}
function bgNodeBtn_(id){
  var sel=bgSelCodes_(), n=bgLines_().length+bgPTRows_();   // kèm số dòng phần thô sẽ xuất
  var lbl=sel.length?(sel.length===1?((sel[0]+'.'+(nodeName(sel[0])||''))):(sel.length+' hạng mục')):'Tất cả hạng mục đã bóc';
  return '<button class="btn ghost sm bg-nodebtn'+(sel.length?' on':'')+'" id="'+id+'" onclick="bgTreePop_(event,\''+id+'\')" '
    +'title="Chọn hạng mục đã bóc sẽ in từ trang 2 (tờ bìa trang 1 luôn có)">'+icon('layers',14)+' '+esc(lbl)+' <b class="tbn">['+pad2(n)+']</b> ▾</button>';
}
function bgTreeNodes_(){
  var out=TREE.filter(function(t){ return t[0]!=='X'; }).map(function(t){ return {code:t[0],name:t[1],lvl:t[2]}; });
  customGroups().forEach(function(nm){ out.push({code:nm,name:nm,lvl:1}); });
  return out;
}
function bgTreePop_(e,btnId){
  if(e&&e.stopPropagation) e.stopPropagation();
  var id='bgTreePop';
  if(document.getElementById(id)){ bgTreeClose_(); return; }
  var pop=document.createElement('div'); pop.className='fltpop bgtree'; pop.id=id;
  document.body.appendChild(pop); S._bgTreeBtn=btnId; bgTreeRender_();
  var b=document.getElementById(btnId);
  if(b){ var r=b.getBoundingClientRect(), w=pop.offsetWidth||330, h=pop.offsetHeight;
    var top=r.bottom+6; if(top+h>window.innerHeight-10) top=Math.max(10, r.top-h-6);
    pop.style.top=top+'px'; pop.style.left=Math.max(8,Math.min(r.left, window.innerWidth-w-10))+'px'; }
  setTimeout(function(){ document.addEventListener('mousedown',bgTreeOutside_); },0);
}
function bgTreeOutside_(e){
  if(e.target.closest('#bgTreePop')||e.target.closest('.bg-nodebtn')) return; bgTreeClose_(); }
function bgTreeClose_(){ var p=document.getElementById('bgTreePop'); if(p) p.remove();
  document.removeEventListener('mousedown',bgTreeOutside_); }
function bgTreeRender_(){
  var pop=document.getElementById('bgTreePop'); if(!pop) return;
  var sel=bgSelSet_(), nodes=bgTreeNodes_(), co=bgSelCodes_().length;
  var list=nodes.filter(function(t){ return bgNodeCnt_(t.code)>0; });   // chỉ hạng mục đã bóc
  pop.innerHTML='<div class="bgt-h"><b>Trang 2 trở đi: hạng mục đã bóc</b>'
      +'<span>'+(co?co+' mục đã tích':'chưa tích = in tất cả')+'</span>'
      +'<button class="colpop-x" onclick="bgTreeClose_()">✕</button></div>'
    +'<div class="bgt-tools"><span class="hint">Trang 1 luôn là tờ bìa (Mẫu 1 / Mẫu 2)</span>'
      +'<span style="flex:1"></span>'
      +'<button class="btn ghost xs" onclick="bgSelAll_(1)">Chọn tất cả</button>'
      +'<button class="btn ghost xs" onclick="bgSelAll_(0)">Bỏ chọn</button>'
    +'</div>'
    +'<div class="bgt-b">'+(list.length?list.map(function(t){
        var n=bgNodeCnt_(t.code), on=!!sel[t.code];
        return '<div class="bgt-i lvl'+t.lvl+(on?' on':'')+(n?'':' empty')+'" onclick="bgSelToggle_(\''+escJs_(t.code)+'\')">'
          +'<span class="nm">'+esc(t.code+'.'+t.name)+'</span>'
          +'<span class="cn">['+pad2(n)+']</span>'
          +'<span class="rd'+(on?' on':'')+'"></span></div>';
      }).join(''):'<div class="colpop-empty">Chưa bóc hạng mục nào — báo giá chỉ có tờ bìa.</div>')+'</div>'
    +'<div class="bgt-f"><span class="hint">'+pad2(bgLines_().length)+' dòng sẽ lên báo giá</span>'
      +'<button class="btn blue sm" onclick="bgTreeClose_()">Xong</button></div>';
}
function bgSelToggle_(code){
  var sel=bgSelSet_(); if(sel[code]) delete sel[code]; else sel[code]=1;
  S.bgDeMuc=bgSelCodes_().length===1?bgSelCodes_()[0]:'__all__';
  S.bgPage=1; bgTreeRender_(); drawBaogia();
  setTimeout(bgTreeRender_,0);
}
function bgSelAll_(on){
  S.bgNodes={};
  if(on) bgTreeNodes_().forEach(function(t){ if(bgNodeCnt_(t.code)) S.bgNodes[t.code]=1; });
  S.bgPage=1; bgTreeRender_(); drawBaogia(); setTimeout(bgTreeRender_,0);
}
/* --- mỗi hạng mục 1 trang --- */
function bgPerSec_(){ return S.bgPerSec!==false; }
function bgTogglePerSec_(){ S.bgPerSec=!bgPerSec_(); S.bgPage=1; drawBaogia(); }
/* --- chọn cột sẽ xuất (dùng chung S.cols với bảng Bóc tách) --- */
function bgCtlBar_(){
  var pages=bgBuildPages().length;
  return '<div class="bgctl">'
    +'<span class="bgctl-mau" title="Trang 1 luôn là tờ bìa — chọn kiểu">'
      +'<label>Trang 1 · Tờ bìa</label>'
      +'<button class="'+(S.coverMau==='m1'?'on':'')+'" onclick="setCoverMau(\'m1\')">Mẫu 1</button>'
      +'<button class="'+(S.coverMau==='m1'?'':'on')+'" onclick="setCoverMau(\'m2\')">Mẫu 2</button>'
    +'</span>'
    +'<span class="bgctl-lbl">Trang 2+</span>'+bgNodeBtn_('bgNodeBtn1')
    +'<button class="btn ghost sm'+(bgPerSec_()?' on':'')+'" onclick="bgTogglePerSec_()" '
      +'title="Mỗi hạng mục bắt đầu ở một trang mới">'+icon('doc',14)+' Mỗi phần 1 trang</button>'
    +'<span class="bgctl-sel" title="Số dòng tối đa trên mỗi trang giấy"><label>Dòng/trang</label>'
      +'<select onchange="bgSetPer_(this.value)">'
      +[['0','Tự động'],['8','8'],['10','10'],['12','12'],['15','15'],['18','18'],['20','20'],['25','25'],['30','30']].map(function(o){
          return '<option value="'+o[0]+'"'+((Number(S.bgPer)||0)===Number(o[0])?' selected':'')+'>'+o[1]+'</option>'; }).join('')
      +'</select></span>'
    +'<span class="bgctl-sel" title="Phóng to / thu nhỏ trang xem trước (không ảnh hưởng file xuất)"><label>Phóng</label>'
      +'<select onchange="bgSetZoom_(this.value)">'
      +[['fit','Vừa khung'],['60','60%'],['75','75%'],['100','100%'],['125','125%'],['150','150%']].map(function(o){
          return '<option value="'+o[0]+'"'+(String(S.bgZoom||'fit')===o[0]?' selected':'')+'>'+o[1]+'</option>'; }).join('')
      +'</select></span>'
    +(bgColTuyBien_()?'<button class="btn ghost sm" onclick="bgColReset_()" title="Trả rộng và thứ tự cột về mặc định">'+icon('close',13)+' Đặt lại cột</button>':'')
    +'<span class="bgctl-n">'+icon('doc',13)+' Số trang <b>'+pages+'</b></span>'
    +'<span style="flex:1"></span>'
    +bgVerBar_()
    +'<span class="bgctl-xuat">'
      +'<button class="btn green sm" onclick="doExport(\'xlsx\',this)">'+icon('download',15)+' Xuất Excel</button>'
      +'<button class="btn red sm" onclick="printDoc()">'+icon('download',15)+' Xuất PDF / In</button></span>'
  +'</div>'
  // khối "Cột xuất" đóng khung giống Bóc tách / Chi phí / Dự án cho cả app đồng bộ
  +'<div class="pg-cols bg-cols">'
    +'<div class="tk-frame-hr"><span class="tk-frame-h">Cột xuất <b>'+COLS.filter(function(c){ return S.cols[c[0]]; }).length+'/'+COLS.length+'</b></span>'
      +csQuickBtn_('tk','bgPresetBtn')+'</div>'
    +'<div class="colchips bg-colchips">'
      +COLS.map(function(c){ return '<span class="chip'+(S.cols[c[0]]?' on':'')+'" onclick="toggleCol(\''+c[0]+'\')">'+esc(c[1])+'</span>'; }).join('')
    +'</div>'
  +'</div>';
}

/* ═══════════ THƯƠNG HIỆU · TỔNG KẾT & ĐIỀU KHOẢN · TỜ BÌA TỰ ĐIỀN · PHIÊN BẢN ═══════════
   Lưu trong du_an_data:
     bgOrg  (theo CÔNG TY)  tên / logo / địa chỉ / ĐT / email / website hiện trên báo giá
     bgCfg  (theo dự án)    ck, ckKieu 'pct'|'vnd', ngay, hieuLuc (ngày), dot [[tên,%]], ghiChu, tay {stt:1}
     bgHist (theo dự án)    các phiên bản đã chốt / đã xuất (tối đa 20)                        */
function bgOrg_(){
  var ct=S.congTy||{}, o=(S._projData&&S._projData.bgOrg)||{};
  var sdt=o.sdt||ct.sdt||'', email=o.email||ct.email||'';
  var lienHe=[sdt?('ĐT: '+sdt):'', email?('Email: '+email):''].filter(Boolean).join('   ');
  return { ten:o.ten||ct.ten||'Công ty', logo:o.logo||ct.logoUrl||'',
    lines:[o.diaChi, lienHe, o.xuong, o.web?('Website: '+o.web):''].filter(function(x){ return String(x||'').trim(); }) };
}
var BG_DOT_MAC=[['Tạm ứng khi ký hợp đồng',50],['Khi giao hàng / thi công',40],['Nghiệm thu, bàn giao',10]];
function bgOpt_(){
  var c=(S._projData&&S._projData.bgCfg)||{};
  return { ck:Math.max(0,Number(c.ck)||0), ckKieu:c.ckKieu==='vnd'?'vnd':'pct',
    ngay:c.ngay||new Date().toLocaleDateString('sv-SE'),     // YYYY-MM-DD theo giờ máy (VN), không phải UTC hieuLuc:c.hieuLuc==null?30:Math.max(0,Number(c.hieuLuc)||0),
    dot:Array.isArray(c.dot)?c.dot:BG_DOT_MAC, ghiChu:c.ghiChu==null?null:String(c.ghiChu), tay:c.tay||{} };
}
function bgOptSet_(k,v){ var c=Object.assign({},(S._projData&&S._projData.bgCfg)||{}); c[k]=v; projDataSet_('bgCfg',c); drawBaogia(); }
// Giá trị 1 mục LÁ của tờ bìa: có dòng bóc tách thuộc mục -> tự cộng; đã sửa tay hoặc không có dòng -> số đang ghi
function coverAutoOf_(stt){ var n=0, t=0;
  (S.lines||[]).forEach(function(l){ var c=String(l.nhom||'').trim(); if(c===stt||c.indexOf(stt+'.')===0){ n++; t+=ttBan_(l); } });
  // Phần thô (3.1) nằm ở bảng ước tính riêng -> trước đây tờ bìa ghi 0 trong khi hộp tổng cuối vẫn cộng
  if(stt==='3.1'||stt==='3'){ try{ ptEnsure(); var g=ptComputeAll().grand; if(g){ n++; t+=g; } }catch(e){} }
  return {n:n, tien:Math.round(t)}; }
function coverLeafVal_(c){ var a=coverAutoOf_(c.stt); return (a.n && !bgOpt_().tay[c.stt]) ? a.tien : (Number(c.chiPhi)||0); }
function coverTaySet_(stt,on){ var t=Object.assign({},bgOpt_().tay); if(on) t[stt]=1; else delete t[stt]; bgOptSet_('tay',t); }
function coverTag_(c){      // nhãn cạnh ô chi phí ở chế độ Chỉnh sửa
  var a=coverAutoOf_(c.stt); if(!a.n) return '';
  return bgOpt_().tay[c.stt]
    ? '<button class="cv-tag tay" onclick="coverTaySet_(\''+escJs_(c.stt)+'\',false)" title="Đang dùng số sửa tay — bấm để lấy lại '+money(a.tien)+' từ bóc tách">sửa tay ↺</button>'
    : '<span class="cv-tag auto" title="Tự cộng từ '+a.n+' dòng bóc tách">tự động</span>';
}
// Tổng: tạm tính -> chiết khấu tổng -> VAT
function bgTong_(sub){
  var o=bgOpt_(), ck=o.ckKieu==='vnd'?Math.min(sub,o.ck):Math.round(sub*Math.min(100,o.ck)/100);
  var sau=sub-ck, vp=Number(S.cur&&S.cur.vat)||0, vat=Math.round(sau*vp/100);
  return {sub:sub, ck:ck, ckPct:sub?ck/sub*100:0, sau:sau, vatPct:vp, vat:vat, total:sau+vat};
}
function fmtVN_(iso){ var d=new Date(iso); if(isNaN(d)) return String(iso||''); return ('0'+d.getDate()).slice(-2)+'/'+('0'+(d.getMonth()+1)).slice(-2)+'/'+d.getFullYear(); }
// Đọc số tiền thành chữ: 239769720 -> "Hai trăm ba mươi chín triệu bảy trăm sáu mươi chín nghìn bảy trăm hai mươi đồng"
function docSoVN_(n){
  n=Math.round(Math.abs(Number(n)||0)); if(!n) return 'Không đồng';
  var CS=['không','một','hai','ba','bốn','năm','sáu','bảy','tám','chín'], DV=['','nghìn','triệu','tỷ','nghìn tỷ','triệu tỷ'];
  function ba(x,du){ var tr=Math.floor(x/100), ch=Math.floor(x%100/10), d=x%10, o=[];
    if(du||tr) o.push(CS[tr]+' trăm');
    if(ch>1){ o.push(CS[ch]+' mươi'); if(d===1) o.push('mốt'); else if(d===5) o.push('lăm'); else if(d) o.push(CS[d]); }
    else if(ch===1){ o.push('mười'); if(d===5) o.push('lăm'); else if(d) o.push(CS[d]); }
    else if(d){ o.push((du||tr)?'lẻ '+CS[d]:CS[d]); }
    return o.join(' '); }
  var g=[]; while(n>0){ g.push(n%1000); n=Math.floor(n/1000); }
  var out=[];
  for(var i=g.length-1;i>=0;i--){ if(!g[i]) continue; out.push(ba(g[i], i<g.length-1)+(DV[i]?' '+DV[i]:'')); }
  var t=out.join(' ');
  return t.charAt(0).toUpperCase()+t.slice(1)+' đồng';
}
function bgGhiChu_(q){
  var o=bgOpt_();
  if(o.ghiChu!=null) return o.ghiChu.split('\n').map(function(x){ return x.trim(); }).filter(Boolean);
  return ['Khối lượng trên là tạm tính, khối lượng quyết toán theo thực tế thi công.',
    'Giá trên chưa bao gồm nhân công hoàn thiện.',
    q.vatPct?('Đơn giá chưa gồm VAT; thuế VAT '+q.vatPct+'% đã tính ở phần tổng.'):'Giá trên chưa bao gồm thuế VAT.'];
}
function bgTongKetHTML_(q, org){
  var o=bgOpt_();
  function row(nhan,tien,cls){ return '<tr'+(cls?' class="'+cls+'"':'')+'><td class="lbl">'+nhan+'</td><td class="num">'+money(tien)+' đ</td></tr>'; }
  var tot='<table class="qx-tbl qx-totbox"><colgroup><col style="width:74%"><col style="width:26%"></colgroup>'
    +row('TỔNG CỘNG:',q.sub)
    +(q.ck?row('CHIẾT KHẤU'+(o.ckKieu==='pct'?' '+o.ck+'%':'')+':',-q.ck)+row('SAU CHIẾT KHẤU:',q.sau):'')
    +row('VAT '+q.vatPct+'%:',q.vat)+row('THÀNH TIỀN SAU THUẾ:',q.total,'grand')+'</table>'
    +'<div class="qx-bangchu"><i>Bằng chữ:</i> <b>'+esc(docSoVN_(q.total))+'</b></div>';
  var dot=(o.dot||[]).filter(function(d){ return d&&String(d[0]||'').trim(); });
  var tt=dot.length?'<div class="qx-dot"><div class="h">Tiến độ thanh toán</div><table><tr><th>Đợt</th><th>Nội dung</th><th class="num">Tỷ lệ</th><th class="num">Số tiền</th></tr>'
    +dot.map(function(d,i){ var pct=Number(d[1])||0; return '<tr><td>'+(i+1)+'</td><td>'+esc(d[0])+'</td><td class="num">'+pct+'%</td><td class="num">'+money(Math.round(q.total*pct/100))+' đ</td></tr>'; }).join('')
    +'</table></div>':'';
  var het=new Date(o.ngay); het.setDate(het.getDate()+o.hieuLuc);
  var ghi=bgGhiChu_(q).concat(o.hieuLuc?['Báo giá có hiệu lực '+o.hieuLuc+' ngày kể từ ngày '+fmtVN_(o.ngay)+' (đến hết ngày '+fmtVN_(het)+').']:[]);
  var notes='<div class="qx-notes"><div class="h">Ghi chú & điều khoản:</div><ol>'+ghi.map(function(x){ return '<li>'+esc(x)+'</li>'; }).join('')+'</ol></div>';
  var nguoi=(S.me&&(S.me.hoTen||S.me.username))||'';
  var sign='<div class="qx-sign"><div class="col"><div class="hd">KHÁCH HÀNG / CUSTOMER</div><div class="sp"></div>'
      +'<div class="nm">'+esc((S.cur&&S.cur.khachHang)||'')+'</div></div>'
    +'<div class="col"><div class="hd">'+esc(String(org.ten).toUpperCase())+'</div><div class="sp"></div>'
      +'<div class="nm">'+(nguoi?'Người lập: '+esc(nguoi):'')+'</div></div></div>';
  return tot+tt+notes+sign;
}

/* ---- Khối cài đặt "Tổng kết & điều khoản" + "Thông tin công ty" trong chế độ Xem trước ---- */
function bgTkToggle_(){ S._bgTkOpen=!S._bgTkOpen; drawBaogia(); }
function bgDotSet_(i,j,v){ var d=bgOpt_().dot.map(function(x){ return x.slice(); }); if(!d[i]) return;
  d[i][j]=j===1?(pctIn_(v)||0):String(v||''); bgOptSet_('dot',d); }
function bgDotAdd_(){ var d=bgOpt_().dot.map(function(x){ return x.slice(); }); d.push(['Đợt '+(d.length+1),0]); bgOptSet_('dot',d); }
function bgDotDel_(i){ var d=bgOpt_().dot.map(function(x){ return x.slice(); }); d.splice(i,1); bgOptSet_('dot',d); }
function bgTkPanel_(){
  var q=bgTong_(computeQuoteLocal().subtotal), o=bgOpt_();
  var tomTat='<span class="bgtk-sum">Tạm tính <b>'+money(q.sub)+'</b>'+(q.ck?' · CK <b>−'+money(q.ck)+'</b>':'')
    +' · VAT <b>'+money(q.vat)+'</b> · Tổng <b class="g">'+money(q.total)+' đ</b></span>';
  var head='<div class="bgtk-h" onclick="bgTkToggle_()">'+icon('money',15)+'<b>Tổng kết & điều khoản</b>'+tomTat
    +'<span style="flex:1"></span>'
    +'<button class="btn ghost sm" onclick="event.stopPropagation();bgOrgEdit_()" title="Tên, logo, địa chỉ in trên báo giá">'+icon('building',14)+' Thông tin công ty</button>'
    +'<span class="bgtk-car">'+(S._bgTkOpen?'▴':'▾')+'</span></div>';
  if(!S._bgTkOpen) return '<div class="bgtk">'+head+'</div>';
  var tongDot=o.dot.reduce(function(a,d){ return a+(Number(d[1])||0); },0);
  var dot=o.dot.map(function(d,i){ return '<div class="bgtk-dot"><span class="n">'+(i+1)+'</span>'
      +'<input value="'+esc(d[0])+'" onchange="bgDotSet_('+i+',0,this.value)">'
      +'<input class="pc" type="number" min="0" max="100" step="any" value="'+(Number(d[1])||0)+'" onchange="bgDotSet_('+i+',1,this.value)"><i>%</i>'
      +'<span class="tien">'+money(Math.round(q.total*(Number(d[1])||0)/100))+' đ</span>'
      +'<button class="x" onclick="bgDotDel_('+i+')" title="Xoá đợt">✕</button></div>'; }).join('');
  var ghi=o.ghiChu!=null?o.ghiChu:bgGhiChu_(q).join('\n');
  return '<div class="bgtk on">'+head+'<div class="bgtk-b">'
    +'<div class="bgtk-c"><label>Chiết khấu tổng đơn</label><div class="bgtk-ck">'
      +'<input type="text" inputmode="decimal" value="'+(o.ckKieu==='vnd'?money(o.ck):o.ck)+'" onchange="bgOptSet_(\'ck\',tkNum_(this.value))">'
      +'<select onchange="bgOptSet_(\'ckKieu\',this.value)"><option value="pct"'+(o.ckKieu==='pct'?' selected':'')+'>%</option><option value="vnd"'+(o.ckKieu==='vnd'?' selected':'')+'>đ</option></select></div>'
      +'<label>Ngày báo giá</label><input type="date" value="'+esc(o.ngay)+'" onchange="bgOptSet_(\'ngay\',this.value)">'
      +'<label>Hiệu lực (ngày)</label><input type="number" min="0" value="'+o.hieuLuc+'" onchange="bgOptSet_(\'hieuLuc\',Number(this.value)||0)">'
      +'<div class="bgtk-chu">'+esc(docSoVN_(q.total))+'</div></div>'
    +'<div class="bgtk-c"><label>Tiến độ thanh toán <span class="'+(Math.round(tongDot)===100?'ok':'bad')+'">tổng '+tongDot+'%</span></label>'+dot
      +'<button class="btn ghost xs" onclick="bgDotAdd_()">＋ Thêm đợt</button></div>'
    +'<div class="bgtk-c"><label>Ghi chú & điều khoản <small>(mỗi dòng 1 ý — hiệu lực báo giá tự thêm)</small></label>'
      +'<textarea rows="6" onchange="bgOptSet_(\'ghiChu\',this.value)">'+esc(ghi)+'</textarea>'
      +(o.ghiChu!=null?'<button class="btn ghost xs" onclick="bgOptSet_(\'ghiChu\',null)">Dùng ghi chú mặc định</button>':'')+'</div>'
    +'</div></div>';
}
async function bgOrgEdit_(){
  if(!isAdminRole_()){ toast('Chỉ Admin sửa được thông tin công ty trên báo giá'); return; }
  var o=(S._projData&&S._projData.bgOrg)||{}, ct=S.congTy||{};
  var r=await askInput_({ title:'Thông tin công ty trên báo giá', ok:'Lưu', required:false,
    note:'Áp dụng cho mọi báo giá của công ty. Ô nào để trống thì không in.', fields:[
    {key:'ten',label:'Tên hiển thị',value:o.ten||ct.ten||''},
    {key:'logo',label:'Link logo (để trống = logo của công ty)',value:o.logo||'',placeholder:ct.logoUrl||'https://…'},
    {key:'diaChi',label:'Địa chỉ',value:o.diaChi||''},
    {key:'sdt',label:'Điện thoại',value:o.sdt||ct.sdt||''},
    {key:'email',label:'Email',value:o.email||ct.email||''},
    {key:'web',label:'Website',value:o.web||''},
    {key:'xuong',label:'Dòng thêm (xưởng, MST…)',value:o.xuong||''} ]});
  if(!r) return;
  var v={}; ['ten','logo','diaChi','sdt','email','web','xuong'].forEach(function(k){ var x=String(r[k]==null?'':r[k]).trim(); if(x) v[k]=x; });
  projDataSet_('bgOrg',v); drawBaogia(); toast('Đã lưu — áp dụng cho mọi báo giá của công ty');
}

/* ---- Mã báo giá + phiên bản ---- */
function bgHist_(){ var h=S._projData&&S._projData.bgHist; return Array.isArray(h)?h:[]; }
function bgMa_(){ var p=S.cur||{}; return String(p.maBaoGia||'').trim()||('BG-'+String(p.maDA||'').replace(/^DA-/,'')); }
// Bản chụp nội dung báo giá hiện tại (để lưu phiên bản / so sánh / xem lại)
var BG_SNAP_F=['lineId','nhom','tang','khuVuc','maBanVe','maSP','ten','thuongHieu','ncc','moTa','kichThuoc','hinhAnh','dvt',
  'soLuong','donGiaVon','chietKhau','lnPct','donGiaBan','ckKhach','trangThai','ghiChu','extra'];
function bgSnap_(){
  var cc=coverCosts();
  return { lines:(S.lines||[]).map(function(l){ var o={}; BG_SNAP_F.forEach(function(k){ if(l[k]!=null&&l[k]!=='') o[k]=l[k]; }); return o; }),
    cover:(S.cover||[]).map(function(c){ return {stt:c.stt, hangMuc:c.hangMuc, moTa:c.moTa, chiPhi:coverHasChild(c.stt)?0:cc.cost[c.stt]}; }),
    opt:Object.assign({ngay:bgOpt_().ngay},(S._projData&&S._projData.bgCfg)||{}), nodes:bgSelCodes_(),
    pt:(function(){ try{ ptEnsure(); return S.phanTho||[]; }catch(e){ return []; } })(),
    proj:{vat:S.cur.vat, khachHang:S.cur.khachHang, ten:S.cur.ten} };
}
function bgSnapKey_(sn){ return JSON.stringify([sn.lines,sn.cover,sn.opt,sn.nodes,sn.proj,sn.pt]); }
function bgVerInfo_(){
  if(S._bgVerXem) return {ma:S._bgVerXem.ma, ver:S._bgVerXem.ver, nhan:'v'+S._bgVerXem.ver+' (đã chốt)', trung:true};
  var h=bgHist_(), last=h[h.length-1], ma=bgMa_();
  if(last && last.key===bgSnapKey_(bgSnap_())) return {ma:ma, ver:last.ver, nhan:'v'+last.ver+' (đã chốt)', trung:true};
  return {ma:ma, ver:(last?last.ver:0)+1, nhan:'v'+((last?last.ver:0)+1)+(last?' (bản nháp)':''), trung:false};
}
// Chốt phiên bản: lưu bản chụp + tổng tiền. lyDo: 'chot' | 'pdf' | 'excel'. Trùng nội dung bản cuối thì không lưu thêm.
function bgChot_(lyDo){
  if(!S.cur) return null;
  var sn=bgSnap_(), key=bgSnapKey_(sn), h=bgHist_(), last=h[h.length-1];
  if(last && last.key===key){ if(lyDo==='chot') toast('Nội dung chưa đổi so với v'+last.ver+' — không cần chốt thêm'); return last; }
  var q=bgTong_(computeQuoteLocal().subtotal);
  var v={ ver:(last?last.ver:0)+1, ma:bgMa_(), at:new Date().toISOString(), by:(S.me&&(S.me.hoTen||S.me.username))||'', lyDo:lyDo||'chot',
    tong:q.total, sub:q.sub, n:sn.lines.length, key:key, snap:sn };
  // giữ 20 phiên bản; chỉ 10 bản mới nhất còn bản chụp đầy đủ (xem lại / so sánh), bản cũ hơn chỉ còn tóm tắt
  var moi=h.concat([v]).slice(-20).map(function(x,i,arr){ return i<arr.length-10 && x.snap ? Object.assign({},x,{snap:null}) : x; });
  projDataSet_('bgHist',moi);
  if(lyDo==='chot') toast('Đã chốt '+v.ma+' · v'+v.ver);
  return v;
}
function bgChotBtn_(){ bgChot_('chot'); drawBaogia(); }
var BG_LYDO={chot:'Chốt tay', pdf:'Xuất PDF / In', excel:'Xuất Excel'};
function bgHistOpen_(){
  var h=bgHist_().slice().reverse();
  var ov=document.createElement('div'); ov.className='sp-modal-ov'; ov.id='bgHistOv';
  ov.onclick=function(e){ if(e.target===ov) ov.remove(); };
  var cur=bgTong_(computeQuoteLocal().subtotal).total;
  ov.innerHTML='<div class="sp-modal bghist pd"><div class="pd-head"><h3>'+icon('doc',16)+' Lịch sử báo giá — '+esc(bgMa_())+'</h3>'
    +'<button class="pd-x" onclick="document.getElementById(\'bgHistOv\').remove()">✕</button></div><div class="bghist-b">'
    +(h.length?'<table class="cpcmp-t"><tr><th>Phiên bản</th><th>Thời điểm</th><th>Người lập</th><th>Lý do</th><th class="num">Số dòng</th><th class="num">Tổng</th><th class="num">So với hiện tại</th><th></th></tr>'
      +h.map(function(v){ var d=cur-v.tong;
        return '<tr><td><b>v'+v.ver+'</b></td><td>'+esc(fmtDateTime_(v.at))+'</td><td>'+esc(v.by||'')+'</td><td>'+esc(BG_LYDO[v.lyDo]||v.lyDo||'')+'</td>'
          +'<td class="num">'+(v.n||0)+'</td><td class="num"><b>'+money(v.tong)+'</b></td>'
          +'<td class="num">'+(d?cpSigned_(d):'<span class="muted">bằng nhau</span>')+'</td>'
          +'<td>'+(v.snap?'<button class="btn ghost xs" onclick="bgHistView_('+v.ver+')">Xem</button> <button class="btn ghost xs" onclick="bgHistDiff_('+v.ver+')">So sánh</button>':'<span class="muted" title="Chỉ 10 phiên bản gần nhất giữ nội dung đầy đủ">chỉ còn tóm tắt</span>')+'</td></tr>'; }).join('')+'</table>'
      :'<div class="empty" style="padding:24px">Chưa có phiên bản nào. Bấm <b>Chốt phiên bản</b>, hoặc xuất PDF / Excel — mỗi lần xuất nội dung mới được lưu tự động.</div>')
    +'</div></div>';
  var cu=document.getElementById('bgHistOv'); if(cu) cu.remove();
  document.body.appendChild(ov);
}
// Dựng trang tài liệu từ 1 bản chụp: tạm thay dữ liệu đang mở rồi trả lại nguyên trạng
function bgWithSnap_(sn, fn){
  var L=S.lines, C=S.cover, P=S.cur, D=S._projData, N=S.bgNodes, T=S.phanTho;
  S.lines=sn.lines; S.cover=sn.cover; S.cur=Object.assign({},P,sn.proj||{}); if(sn.pt) S.phanTho=sn.pt;
  S._projData=Object.assign({},D,{bgCfg:sn.opt||{}});
  S.bgNodes={}; (sn.nodes||[]).forEach(function(k){ S.bgNodes[k]=1; });
  try{ return fn(); } finally{ S.lines=L; S.cover=C; S.cur=P; S._projData=D; S.bgNodes=N; S.phanTho=T; }
}
function bgHistGet_(ver){ return bgHist_().filter(function(v){ return v.ver===ver; })[0]; }
function bgHistView_(ver){
  var v=bgHistGet_(ver); if(!v||!v.snap) return;
  S._bgVerXem=v;
  try{ var pages=bgWithSnap_(v.snap, function(){ return bgBuildPages(); }); } finally{ S._bgVerXem=null; }
  S._bgViewPages=pages;
  ensureDocCss_();
  var ov=document.createElement('div'); ov.className='sp-modal-ov'; ov.id='bgVerOv';
  ov.onclick=function(e){ if(e.target===ov) ov.remove(); };
  ov.innerHTML='<div class="sp-modal bgver pd"><div class="pd-head"><h3>'+icon('eye',16)+' '+esc(v.ma)+' · v'+v.ver+' — '+esc(fmtDateTime_(v.at))+'</h3>'
    +'<button class="btn red sm" onclick="printDoc(S._bgViewPages)">'+icon('download',14)+' In / PDF bản này</button>'
    +'<button class="pd-x" onclick="document.getElementById(\'bgVerOv\').remove()">✕</button></div>'
    +'<div class="bgver-b"><div class="qs-doc">'+pages.map(function(p){ return p.html; }).join('')+'</div></div></div>';
  document.body.appendChild(ov);
}
function bgHistDiff_(ver){
  var v=bgHistGet_(ver); if(!v||!v.snap) return;
  var cu=bgSnap_(), cq=bgTong_(computeQuoteLocal().subtotal);
  var key=function(l){ return l.lineId||((l.maSP||'')+'|'+(l.ten||'')+'|'+(l.tang||'')); };
  var A={}, B={}; v.snap.lines.forEach(function(l){ A[key(l)]=l; }); cu.lines.forEach(function(l){ B[key(l)]=l; });
  var them=[], bo=[], doi=[];
  Object.keys(B).forEach(function(k){ if(!A[k]) them.push(B[k]); else {
    var a=A[k], b=B[k], ds=[];
    if((Number(a.soLuong)||0)!==(Number(b.soLuong)||0)) ds.push('SL '+(a.soLuong||0)+' → '+(b.soLuong||0));
    if(donGiaCK_(a)!==donGiaCK_(b)) ds.push('đơn giá '+money(donGiaCK_(a))+' → '+money(donGiaCK_(b)));
    if(ds.length) doi.push({l:b, ds:ds, tien:ttBan_(b)-ttBan_(a)}); } });
  Object.keys(A).forEach(function(k){ if(!B[k]) bo.push(A[k]); });
  var dong=[].concat(
    them.map(function(l){ return '＋ '+(l.ten||'')+' — '+money(ttBan_(l))+' đ'; }),
    bo.map(function(l){ return '－ '+(l.ten||'')+' — '+money(ttBan_(l))+' đ'; }),
    doi.map(function(x){ return '± '+(x.l.ten||'')+': '+x.ds.join(', ')+' ('+(x.tien>0?'+':'')+money(x.tien)+' đ)'; }));
  var d=cq.total-v.tong;
  xacNhan_({ chiBao:true, nguyHiem:false, title:'v'+v.ver+' → hiện tại: '+(d>0?'+':'')+money(d)+' đ',
    note:'Tổng v'+v.ver+': '+money(v.tong)+' đ · hiện tại: '+money(cq.total)+' đ\n'
      +them.length+' dòng thêm · '+bo.length+' dòng bỏ · '+doi.length+' dòng đổi số lượng / giá'
      +(dong.length?'':'\nKhông khác nhau về dòng hàng (có thể khác tờ bìa / điều khoản).'),
    dong:dong });
}
function bgVerBar_(){
  var vi=bgVerInfo_(), n=bgHist_().length;
  return '<span class="bgver-chip" title="Mã báo giá · phiên bản. Sửa mã ở chế độ Chỉnh sửa (ô Mã báo giá số)">'+icon('doc',13)+' <b>'+esc(vi.ma)+'</b> · '+esc(vi.nhan)+'</span>'
    +(vi.trung?'':'<button class="btn ghost sm" onclick="bgChotBtn_()" title="Lưu lại nội dung báo giá hiện tại thành 1 phiên bản">'+icon('check',14)+' Chốt v'+vi.ver+'</button>')
    +'<button class="btn ghost sm" onclick="bgHistOpen_()" title="Xem lại / so sánh các phiên bản đã chốt hoặc đã xuất">'+icon('layers',14)+' Lịch sử'+(n?' ('+n+')':'')+'</button>';
}
