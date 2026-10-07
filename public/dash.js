/* ═══ TAB BẢNG ĐIỀU KHIỂN — KPI, nhóm dự án + bản nháp, nhân bản / xoá dự án, link bài dezon.vn. ═══ */
'use strict';

/* ===== DASHBOARD ===== */
function card(t,n){ return '<div class="scard"><div class="n">'+n+'</div><div class="t">'+t+'</div></div>'; }
function dezonHost_(u){ try{ return new URL(u).hostname; }catch(e){ return ''; } }
function dezonUrl_(u){ u=String(u||'').trim(); return /^https?:\/\//i.test(u)?u:('https://'+u); }
/* ═══ CHIP LINK BÀI DỰ ÁN TRÊN DEZON.VN — dùng chung mọi nơi có dự án ═══
   LUÔN hiện để biết dự án này có chỗ gắn link: đã gắn -> chip xanh, bấm mở bài;
   chưa gắn -> chip nhạt nét đứt, bấm để dán link (lưu thẳng vào dự án).            */
function dezonChip_(p, them){
  p=p||{}; var u=String(p.linkDezon||'').trim(), ma=esc(String(p.maDA||'')), cls='dz-chip'+(them?' '+them:'');
  if(u) return '<a class="'+cls+' on" href="'+esc(dezonUrl_(u))+'" target="_blank" rel="noopener"'
    +' title="Mở bài dự án trên dezon.vn — '+esc(dezonUrl_(u))+'" onclick="event.stopPropagation()">'
    +icon('link',12)+'<span>Dezon</span></a>';
  return '<button class="'+cls+'" title="Chưa gắn link bài dự án trên dezon.vn — bấm để dán link"'
    +' onclick="event.stopPropagation();dezonSet_(\''+ma+'\')">'+icon('link',12)+'<span>Gắn link</span></button>';
}
async function dezonSet_(maDA){
  maDA=String(maDA||'');
  var p=(S.projects||[]).filter(function(x){ return x.maDA===maDA; })[0] || ((S.cur&&S.cur.maDA===maDA)?S.cur:null);
  if(!p){ toast('Không tìm thấy dự án'); return; }
  var v=await askInput_({ title:'Link bài dự án trên dezon.vn', label:'Dán link (để trống = bỏ link)', required:false,
    value:p.linkDezon||'https://dezon.vn/', placeholder:'https://dezon.vn/du-an/…', ok:'Lưu link' });
  if(v==null) return;
  v=String(v&&v.v!=null?v.v:v).trim();
  if(v && !/^https?:\/\//i.test(v)) v='https://'+v;
  if(v && !/(^|\.)dezon\.vn$/i.test(dezonHost_(v)) && !await xacNhan_('Link này không thuộc dezon.vn:\n'+v+'\n\nVẫn lưu?')) return;
  try{
    var r=await api('updateProject', maDA, {linkDezon:v});
    var i=(S.projects||[]).map(function(x){ return x.maDA; }).indexOf(maDA);
    if(i>=0) S.projects[i]=r||Object.assign(S.projects[i],{linkDezon:v});
    if(S.cur&&S.cur.maDA===maDA){ if(r) syncProj(r); else S.cur.linkDezon=v; }
    renderCard&&renderCard(); renderSpProjPanel_&&renderSpProjPanel_();
    if(viewOn_('v-dash')) renderDash&&renderDash();
    toast(v?'Đã gắn link Dezon cho dự án':'Đã bỏ link Dezon');
  }catch(e){ toast('Lỗi lưu link: '+e.message); }
}
// Gom bản nháp theo Dự án (cùng tên dự án = cùng 1 dự án)
function projectGroups(){
  var groups={}, order=[];
  (S.projects||[]).forEach(function(p){
    var key=String(p.ten||'(Chưa đặt tên)').trim().toLowerCase();
    if(!groups[key]){ groups[key]={name:p.ten||'(Chưa đặt tên)', khachHang:p.khachHang, diaChi:p.diaChi, sdt:p.sdt, drafts:[]}; order.push(key); }
    var g=groups[key]; g.drafts.push(p);
    if(p.khachHang) g.khachHang=p.khachHang; if(p.diaChi) g.diaChi=p.diaChi; if(p.sdt) g.sdt=p.sdt;
    if(p.linkDezon) g.linkDezon=p.linkDezon;
  });
  order.forEach(function(k){ groups[k].drafts.sort(function(a,b){ return String(a.ngayTao||'').localeCompare(String(b.ngayTao||'')); }); });
  return order.map(function(k){ return groups[k]; });
}
// Dự án (nhiều) -> mỗi dự án có nhiều bản nháp (phương án báo giá riêng)
/* Tìm dự án (nhóm bản nháp) theo MÃ của một bản nháp bất kỳ trong nhóm.
   Trước đây các nút trên trang Dự án / Bảng điều khiển gọi theo CHỈ SỐ trong
   S._projGroups — mà mảng này bị cả hai trang ghi đè, nên bấm "Thêm bản nháp"
   ở thẻ này lại rơi vào dự án khác. Khoá theo mã thì không bao giờ lệch.        */
/* Tải lại NHẸ sau khi thêm/xoá bản nháp: chỉ lấy danh sách dự án + dòng của bản
   đang mở. Trước đây gọi boot() -> kéo lại toàn bộ danh mục sản phẩm nên bấm phát
   nào cũng phải chờ. */
async function projReload_(){
  try{ S.projects=await api('getProjects')||[]; }catch(e){ toast('Lỗi tải danh sách dự án: '+e.message); }
  if(S.cur){ var f=(S.projects||[]).filter(function(p){ return p.maDA===S.cur.maDA; })[0]; S.cur=f||S.projects[0]||null; }
  else S.cur=(S.projects||[])[0]||null;
  try{ S.lines = S.cur ? (await api('getLines', S.cur.maDA)||[]) : []; }catch(e){ S.lines=[]; }
  // S.cur có thể đã ĐỔI (thêm bản nháp / xoá bản đang mở): nạp lại dữ liệu dự án, nếu không Phần thô, lịch sử báo giá,
  // kế hoạch thanh toán của dự án CŨ sẽ hiện ở dự án mới và bị lưu sang đó ở lần sửa kế tiếp.
  if((S.cur?S.cur.maDA:null)!==(S._pdOk||null)){ S._coverDA=null; await projDataLoad_(S.cur?S.cur.maDA:null); }
  if(typeof renderAll==='function') renderAll();
}
function projGroupOf_(key){
  key=String(key||''); if(!key) return null;
  var gs=projectGroups();
  for(var i=0;i<gs.length;i++){
    for(var j=0;j<gs[i].drafts.length;j++) if(String(gs[i].drafts[j].maDA)===key) return gs[i];
  }
  return null;
}
// Vẽ lại MỌI trang có danh sách dự án (trước đây chỉ vẽ 1 trang -> trang kia còn nút cũ, bấm ra dự án sai)
function projRefreshAll_(){
  try{ if(viewOn_('v-dash') && typeof renderDash==='function') renderDash(); }catch(e){}
  try{ if(viewOn_('v-project') && typeof renderProjects==='function') renderProjects(); }catch(e){}
  try{ if(typeof renderProjSel==='function') renderProjSel(); if(typeof renderCard==='function') renderCard(); }catch(e){}
}
// Thêm 1 bản nháp (phương án báo giá mới) cho dự án đang có
async function addDraft(key){
  var g=projGroupOf_(key);
  if(!g){ toast('Không tìm thấy dự án này — bấm F5 tải lại trang'); return; }
  try{
    var p=await api('createProject',{ten:g.name, khachHang:g.khachHang, sdt:g.sdt, diaChi:g.diaChi, vat:0});
    S.cur=p; S.lines=[]; await projReload_(); projRefreshAll_();
    toast('Đã thêm bản nháp mới cho "'+g.name+'"');
  }catch(e){ toast('Lỗi thêm bản nháp: '+e.message); }
}
/* Xoá NHANH cả dự án (mọi bản nháp của nó) — nút ✕ ở góc thẻ dự án */
async function removeProjectGroup(key, ev){
  if(ev&&ev.stopPropagation) ev.stopPropagation();
  var g=projGroupOf_(key);
  if(!g){ toast('Không tìm thấy dự án này — bấm F5 tải lại trang'); return; }
  var n=g.drafts.length;
  if(!await xacNhan_('Xoá cả dự án "'+g.name+'" cùng '+n+' bản nháp?\n\nToàn bộ hạng mục đã bóc trong các bản nháp này sẽ mất và KHÔNG khôi phục được.')) return;
  var loi=[];
  for(var i=0;i<g.drafts.length;i++){
    try{ await api('deleteProject', g.drafts[i].maDA); }
    catch(e){ loi.push(g.drafts[i].maDA+': '+e.message); }
  }
  if(S.cur && g.drafts.some(function(d){ return d.maDA===S.cur.maDA; })) S.cur=null;
  try{ projModalClose&&projModalClose(); }catch(e){}
  await projReload_(); projRefreshAll_();
  toast(loi.length?('Xoá xong '+(n-loi.length)+'/'+n+' bản — lỗi: '+loi[0]):('Đã xoá dự án "'+g.name+'" ('+n+' bản nháp)'));
}
// Nhân bản 1 bản nháp (copy toàn bộ hạng mục + tờ bìa sang bản nháp mới)
// Nhân bản: popup chọn phần cần sao chép
function duplicateDraft(maDA){
  var hasPT=false; try{ hasPT=!!localStorage.getItem('pt_'+maDA); }catch(e){}
  var ov=document.createElement('div'); ov.className='sp-modal-ov'; ov.id='dupOv';
  ov.onclick=function(e){ if(e.target===ov) dupClose_(); };
  ov.innerHTML='<div class="sp-modal dup-modal pd"><div class="pd-head"><h3>'+icon('copy',15)+' Nhân bản bản nháp</h3><button class="pd-x" onclick="dupClose_()">✕</button></div>'
    +'<p class="dup-hint">Chọn phần cần sao chép sang bản nháp mới (Thông tin dự án luôn được copy):</p>'
    +'<div class="dup-list">'
      +'<label class="dup-ck"><input type="checkbox" id="dupBoc" checked><span><b>Bóc tách</b> — sản phẩm đã bóc (Chi phí · Mua hàng đi theo phần này)</span></label>'
      +'<label class="dup-ck"><input type="checkbox" id="dupCover" checked><span><b>Xuất báo giá</b> — tờ bìa / ước tính chi phí</span></label>'
      +'<label class="dup-ck"><input type="checkbox" id="dupPT" checked><span><b>Phần thô</b> — bảng ước tính xây thô</span></label>'
    +'</div>'
    +'<div class="dup-f"><button class="btn ghost sm" onclick="dupClose_()">Huỷ</button><button class="btn blue" onclick="dupDo_(\''+escJs_(maDA)+'\',this)">'+icon('copy',14)+' Nhân bản</button></div></div>';
  document.body.appendChild(ov);
}
function dupClose_(){ var o=document.getElementById('dupOv'); if(o)o.remove(); }
async function dupDo_(maDA, btn){
  var g=function(id){var e=document.getElementById(id);return e?e.checked:false;};
  var cpPT=g('dupPT'), opts={boc:g('dupBoc'), cover:g('dupCover'), pt:cpPT};
  if(btn){ btn.disabled=true; btn.textContent='Đang nhân bản…'; }
  try{
    var p=await api('duplicateProject',maDA,opts);
    if(cpPT){ try{ var v=localStorage.getItem('pt_'+maDA); if(v) localStorage.setItem('pt_'+p.maDA, v);
      var vv=localStorage.getItem('pt_'+maDA+'_vat'); if(vv) localStorage.setItem('pt_'+p.maDA+'_vat', vv); }catch(e){} }
    S.cur=p; S._coverDA=null; S._ptKey=null;
    await boot(); renderDash(); dupClose_(); projModalClose&&projModalClose();
    toast('Đã nhân bản ('+ ((S.lines||[]).length) +' hạng mục)');
  }catch(e){ toast('Lỗi nhân bản: '+e.message); if(btn){ btn.disabled=false; btn.innerHTML=icon('copy',14)+' Nhân bản'; } }
}
function kpi(ic,label,val,accent){ return '<div class="kpi"><div class="kpi-ic '+(accent||'')+'">'+ic+'</div><div class="kpi-b"><div class="kpi-n">'+val+'</div><div class="kpi-t">'+esc(label)+'</div></div></div>'; }
function dhKpi_(ic,label,val,sub,accent){ return '<div class="dh-kpi '+(accent||'')+'"><div class="dh-kpi-ic">'+icon(ic,18)+'</div><div class="dh-kpi-b"><div class="dh-kpi-v">'+val+'</div><div class="dh-kpi-l">'+esc(label)+(sub?' · <span class="dh-kpi-sub">'+esc(sub)+'</span>':'')+'</div></div></div>'; }
function renderDash(){
  var el=document.getElementById('v-dash');
  var header='<div class="sechd"><h2>Bảng điều khiển</h2></div>';
  if(!S.cur){
    el.innerHTML=header+'<div class="dash-empty">'+icon('layers',40)+'<h3>Chưa chọn bản nháp</h3><p>Chọn một bản nháp bên dưới để xem tổng quan — hoặc tạo dự án mới.</p></div>'
      +'<div class="dh-grid"><div class="dh-main">'+dashProjSection_()+'</div><div class="dh-side">'+dashQuick_()+'</div></div>';
    return;
  }
  // Số TOÀN DỰ ÁN (không theo bộ lọc hạng mục của các tab khác) — nhãn ghi rõ để khỏi lệch với Chi phí / Dự án.
  // Nhóm biểu đồ gom về cấp 3 (VD 3.2.6.1 + 3.2.6.2 -> 3.2.6) cho khỏi vụn thành nhiều cột lẻ.
  var von=0,ban=0,groups={}; S.lines.forEach(function(l){ von+=ttVon_(l);ban+=ttBan_(l);
    var k=String(l.nhom||'').split('.').slice(0,3).join('.')||'Khác'; (groups[k]=groups[k]||{ban:0}).ban+=ttBan_(l); });
  var vatPct=Number(S.cur.vat)||0, vat=Math.round(ban*vatPct/100);
  var lnT=ban-von, bien=ban>0?(lnT/ban*100):0, gr=currentGroup();
  // ---- HERO ----
  var hero='<div class="dh-hero"><div class="dh-hero-l">'
    +'<div class="dh-eyebrow"><span class="dh-dot"></span> ĐANG LÀM VIỆC</div>'
    +'<div class="dh-title">'+icon('building',20)+'<span class="dh-pn">'+esc(S.cur.ten)+'</span><b class="dh-sep">›</b>'+esc(draftName_(S.cur, gr?gr.idx:0))+'</div>'
    +'<div class="dh-sub">'+esc(S.cur.maDA)+'　·　Tạo '+fmtDate(S.cur.ngayTao)+'　·　<span class="dh-status">'+esc(S.cur.trangThai||'Bản nháp')+'</span></div>'
    +'</div><div class="dh-hero-r">'
      +'<button class="dh-act primary" onclick="showTab(\'boc\')">'+icon('layers',15)+' Mở bóc tách</button>'
      +'<button class="dh-act" onclick="showTab(\'chiphi\')">'+icon('money',15)+' Chi phí</button>'
      +'<button class="dh-act" onclick="showTab(\'export\')">'+icon('doc',15)+' Xuất báo giá</button>'
      +'<button class="dh-act" onclick="projInfoModal(S.cur.maDA)">'+icon('sliders',15)+' Thông tin</button>'
    +'</div></div>';
  // ---- KPI ----
  var kpis='<div class="dh-kpis">'
    +dhKpi_('list','Dòng sản phẩm',S.lines.length,'toàn dự án','blue')
    +dhKpi_('lock','Giá vốn',money(von)+' đ','toàn dự án','slate')
    +dhKpi_('money','Giá bán',money(ban)+' đ','chưa VAT','blue')
    +dhKpi_('doc','Tổng thanh toán',money(ban+vat)+' đ','gồm VAT '+vatPct+'%','slate')
    +dhKpi_('gauge','Lợi nhuận',money(lnT)+' đ',bien.toFixed(1)+'% biên',lnT<0?'red':'green')+'</div>';
  // ---- Side: chart nhóm + thao tác nhanh ----
  var byG=Object.keys(groups).map(function(k){return {k:k,ban:groups[k].ban};}).sort(function(a,b){return b.ban-a.ban;});
  var max=byG.reduce(function(m,g){return Math.max(m,g.ban);},1);
  var bars=byG.map(function(g){ var pct=Math.round(g.ban/max*100);
    return '<div class="dh-bar"><div class="dh-bar-t"><span>'+esc(nodeName(g.k))+'</span><b>'+money(g.ban)+' đ</b></div><div class="dh-bar-track"><i style="width:'+pct+'%"></i></div></div>'; }).join('')
    ||'<div class="dh-empty2">Chưa có hạng mục nào trong bản nháp này.</div>';
  var side='<div class="dh-card"><div class="dh-card-h">'+icon('gauge',16)+' Giá trị theo nhóm</div><div class="dh-card-b">'+bars+'</div></div>'+dashQuick_();
  el.innerHTML=header+hero+kpis+'<div class="dh-grid"><div class="dh-main">'+dashProjSection_()+'</div><div class="dh-side">'+side+'</div></div>';
}
function dashQuick_(){
  return '<div class="dh-card"><div class="dh-card-h">'+icon('sliders',16)+' Thao tác nhanh</div><div class="dh-card-b dh-quick">'
    +'<button onclick="showTab(\'muahang\')">'+icon('cart',18)+'<span>Mua hàng</span></button>'
    +'<button onclick="showTab(\'duan\')">'+icon('list',18)+'<span>SP trong dự án</span></button>'
    +'<button onclick="showTab(\'import\')">'+icon('download',18)+'<span>Nhập dữ liệu</span></button>'
    +'<button onclick="showTab(\'sanpham\')">'+icon('tag',18)+'<span>Danh sách SP</span></button>'
    +'</div></div>';
}
// Danh sách dự án (có tìm kiếm) — render chỉ lại grid khi tìm để mượt
function dashProjSection_(){
  var groups=projectGroups(); S._projGroups=groups;
  var searchIc='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>';
  return '<div class="dh-card"><div class="dh-card-h">'+icon('home',16)+' Danh sách dự án <span class="dh-count">'+groups.length+'</span>'
    +'<span class="sp" style="flex:1"></span>'
    +'<div class="dh-search">'+searchIc+'<input placeholder="Tìm dự án, khách hàng…" value="'+esc(S._dashSearch||'')+'" oninput="dashSearch_(this.value)"></div>'
    +'<button class="dh-newbtn" onclick="openCreate()">'+icon('plus',14)+' Tạo dự án</button></div>'
    +'<div class="dh-card-b"><div class="dh-projgrid" id="dhProjGrid">'+dashProjCards_(groups)+'</div></div></div>';
}
function dashProjCards_(groups){
  var q=(S._dashSearch||'').toLowerCase().trim();
  var filt=q?groups.filter(function(g){ return (g.name+' '+(g.khachHang||'')+' '+(g.sdt||'')).toLowerCase().indexOf(q)>=0; }):groups;
  if(!filt.length) return '<div class="dh-empty2" style="padding:30px">'+(q?'Không tìm thấy dự án khớp "'+esc(q)+'".':'Chưa có dự án. Bấm <b>Tạo dự án</b> để bắt đầu.')+'</div>';
  return filt.map(dashProjCard_).join('');
}
function dashProjCard_(g){
  var gi=(S._projGroups||[]).indexOf(g);
  var drafts=g.drafts.map(function(p,i){ var on=S.cur&&S.cur.maDA===p.maDA;
    return '<div class="dh-draft'+(on?' on':'')+'">'
      +'<div class="dh-draft-i">'
        +'<b class="dh-draft-n" title="Bấm để đổi tên bản nháp" onclick="draftNameEdit_(event,\''+escJs_(p.maDA)+'\')">'+esc(draftName_(p,i))+'</b>'
        +'<span onclick="projInfoModal(\''+escJs_(p.maDA)+'\')" title="Xem / sửa thông tin">'+esc(p.maDA)+' · '+fmtDate(p.ngayTao)+'</span></div>'
      +'<div class="dh-draft-a">'
      +(on?'<span class="dh-badge">'+icon('check',12)+' Đang dùng</span>':'<button class="dh-use" title="Mở bóc tách bản này" onclick="pickProject(\''+escJs_(p.maDA)+'\')">Dùng</button>')
      +'<button class="dh-ic" title="Sửa tên bản nháp" onclick="renameDraft(\''+escJs_(p.maDA)+'\')">'+icon('edit',13)+'</button>'
      +'<button class="dh-ic" title="Nhân bản bản nháp" onclick="duplicateDraft(\''+escJs_(p.maDA)+'\')">'+icon('copy',13)+'</button>'
      +'<button class="dh-ic del" title="Xoá bản nháp" onclick="removeProject(\''+escJs_(p.maDA)+'\',event)">'+icon('trash',13)+'</button>'
      +'</div></div>';
  }).join('');
  return '<div class="dh-proj">'
    +'<div class="dh-proj-h" onclick="projInfoModal(\''+escJs_(g.drafts[0].maDA)+'\')" title="Xem thông tin dự án"><span class="dh-proj-ic">'+icon('building',16)+'</span>'
      +'<div class="dh-proj-t"><div class="dh-proj-n">'+esc(g.name)+'</div><div class="dh-proj-m">'+esc(g.khachHang||'Chưa có khách hàng')+(g.sdt?' · '+esc(g.sdt):'')+'</div></div>'
      +dezonChip_({linkDezon:g.linkDezon, maDA:g.drafts[0].maDA}, 'dh-dezon')
      +'<span class="dh-proj-c">'+g.drafts.length+' bản</span></div>'
    +'<button class="proj-del" title="Xoá cả dự án này (mọi bản nháp)" onclick="removeProjectGroup(\''+escJs_(g.drafts[0].maDA)+'\',event)">'+icon('trash',13)+'</button>'
    +'<div class="dh-drafts">'+drafts+'</div>'
    +'<button class="dh-adddraft" onclick="addDraft(\''+escJs_(g.drafts[0].maDA)+'\')">'+icon('plus',13)+' Thêm bản nháp</button></div>';
}
/* Chọn cột — dùng chung mẫu nút + bảng chọn cho tab Chi phí và tab Dự án */
function cpColBar_(loc){
  var on=CP_KEYS.filter(function(k){ return S.cpCols[k]; }).length;
  return pgColFrame_(on, CP_KEYS.length, '<div class="colchips cp-colchips">'
    +CP_KEYS.map(function(k){ return '<span class="chip'+(S.cpCols[k]?' on':'')+'" onclick="cpToggle(\''+k+'\')">'+esc(cpLabel_(k))+'</span>'; }).join('')+'</div>', 'cpColAll_', 'cp', 'cpPresetBtn', loc);
}
var CP_COL_CB=['ten','soLuong','giaDaiLy','donGia','thanhTien','lnVnd'];
function cpColAll_(on){ CP_KEYS.forEach(function(k){ S.cpCols[k]= on?true:(CP_COL_CB.indexOf(k)>=0); }); renderChiphi(); }
function daColBar_(loc){
  var on=DA_KEYS.filter(function(k){ return S._daCols[k]; }).length;
  return pgColFrame_(on, DA_KEYS.length, '<div class="colchips cp-colchips">'
    +DA_KEYS.map(function(k){ return '<span class="chip'+(S._daCols[k]?' on':'')+'" onclick="daColToggle(\''+k+'\')">'+esc(cpLabel_(k))+'</span>'; }).join('')+'</div>', 'daColAll_', 'da', 'daPresetBtn', loc);
}
var DA_COL_CB=['ten','soLuong','giaDaiLy','donGia','thanhTien','hinhAnh'];
function daColAll_(on){ S._daCols=S._daCols||{}; DA_KEYS.forEach(function(k){ S._daCols[k]= on?true:(DA_COL_CB.indexOf(k)>=0); }); daColLuu_(); renderDuAn(); }
function dashSearch_(v){ S._dashSearch=v; var grid=document.getElementById('dhProjGrid'); if(grid) grid.innerHTML=dashProjCards_(S._projGroups||projectGroups()); }
