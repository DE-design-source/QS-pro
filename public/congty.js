/* ═══ TAB CÔNG TY (chỉ super admin) — cấp / khoá / gia hạn công ty, tính năng, logo, tài khoản của công ty. ═══ */
'use strict';

/* ═══════════ QUẢN LÝ CÔNG TY (chỉ super admin) ═══════════ */
var CT_FEATURES=[['dash','Bảng điều khiển'],['boc','Bóc tách'],['chiphi','Chi phí'],
  ['export','Xuất báo giá'],['muahang','Mua hàng'],['duan','Dự án'],
  ['sanpham','Danh sách sản phẩm'],['import','Nhập dữ liệu']];
async function renderCongTy(){
  var box=document.getElementById('v-congty'); if(!box) return;
  box.innerHTML='<div class="sechd"><h2>Quản lý công ty</h2></div><div class="empty" style="padding:26px">Đang tải…</div>';
  var list=[];
  try{ list=await api('listCongTy')||[]; }
  catch(e){ box.innerHTML='<div class="sechd"><h2>Quản lý công ty</h2></div><div class="empty" style="padding:26px">'+esc(e.message)+'</div>'; return; }
  S._ctList=list;
  var today=new Date(new Date().toDateString());
  function ngayConLai(h){ if(!h) return null; return Math.round((new Date(h)-today)/86400000); }
  // ---- thống kê nhanh ----
  var tong=list.length, dangHD=0, sapHet=0, tongUser=0;
  list.forEach(function(c){
    var d=ngayConLai(c.hanDung);
    if(c.active && !(d!==null&&d<0)) dangHD++;
    if(d!==null && d>=0 && d<=30) sapHet++;
    tongUser+=c.soUser||0;
  });
  var stats='<div class="ct-stats">'
    +'<div class="ct-stat"><span class="ct-stat-ic">'+icon('building',17)+'</span><div><b>'+tong+'</b><i>Công ty</i></div></div>'
    +'<div class="ct-stat ok"><span class="ct-stat-ic">'+icon('check',17)+'</span><div><b>'+dangHD+'</b><i>Đang hoạt động</i></div></div>'
    +'<div class="ct-stat warn"><span class="ct-stat-ic">'+icon('clock',17)+'</span><div><b>'+sapHet+'</b><i>Sắp hết hạn (30 ngày)</i></div></div>'
    +'<div class="ct-stat"><span class="ct-stat-ic">'+icon('list',17)+'</span><div><b>'+tongUser+'</b><i>Tổng người dùng</i></div></div>'
    +'</div>';
  // ---- thẻ từng công ty ----
  var cards=list.map(function(c,i){
    var d=ngayConLai(c.hanDung), het=(d!==null&&d<0);
    var st = !c.active ? ['locked','Tạm khoá'] : (het ? ['expired','Hết hạn'] : ['ok','Đang hoạt động']);
    var pct = c.gioiHanUser>0 ? Math.min(100, Math.round((c.soUser||0)/c.gioiHanUser*100)) : 0;
    var fullUser = c.gioiHanUser>0 && (c.soUser||0)>=c.gioiHanUser;
    var fpct = Math.round((c.tinhNang.length/CT_FEATURES.length)*100);
    var lbl={}; CT_FEATURES.forEach(function(f){ lbl[f[0]]=f[1]; });
    var chips=CT_FEATURES.map(function(f){
      var on=c.tinhNang.indexOf(f[0])>=0;
      return '<span class="ct-fc'+(on?' on':'')+'" title="'+esc(f[1])+(on?' — đã bật':' — chưa bật')+'">'+esc(f[1])+'</span>';
    }).join('');
    var hanTxt = c.hanDung
      ? (het ? '<span class="ct-han expired">Hết hạn '+fmtDate(c.hanDung)+'</span>'
             : (d<=30 ? '<span class="ct-han warn">Còn '+d+' ngày · '+fmtDate(c.hanDung)+'</span>'
                      : '<span class="ct-han">Đến '+fmtDate(c.hanDung)+'</span>'))
      : '<span class="ct-han muted">Không giới hạn</span>';
    var shareBadge = c.dungSpDezon ? '<span class="ct-sharetag" title="Được dùng kho sản phẩm của Dezon">'+icon('layers',11)+' Kho SP Dezon</span>' : '';
    return '<div class="ct-card'+(c.active?'':' off')+'">'
      +'<div class="ct-card-h">'
        +(c.logoUrl?'<img class="ct-lg" src="'+esc(c.logoUrl)+'" onerror="this.outerHTML=\'<span class=&quot;ct-ini&quot;>'+esc((c.ten||'?').trim().charAt(0).toUpperCase())+'</span>\'">'
                   :'<span class="ct-ini">'+esc((c.ten||'?').trim().charAt(0).toUpperCase())+'</span>')
        +'<div class="ct-card-t"><div class="ct-nm">'+esc(c.ten)+'</div>'
          +'<div class="ct-sub">'+esc(c.ma)+(c.email?(' · '+esc(c.email)):'')+(c.sdt?(' · '+esc(c.sdt)):'')+'</div></div>'
        +'<span class="ct-badge '+st[0]+'">'+st[1]+'</span>'
      +'</div>'
      +(shareBadge?'<div class="ct-sharerow">'+shareBadge+'</div>':'')
      +'<div class="ct-card-b">'
        +'<div class="ct-metric"><div class="ct-mh"><span>Người dùng</span><b'+(fullUser?' class="full"':'')+'>'+(c.soUser||0)+' / '+(c.gioiHanUser||'∞')+'</b></div>'
          +'<div class="ct-bar"><i class="'+(fullUser?'full':'')+'" style="width:'+pct+'%"></i></div></div>'
        +'<div class="ct-metric"><div class="ct-mh"><span>Tính năng</span><b>'+c.tinhNang.length+' / '+CT_FEATURES.length+'</b></div>'
          +'<div class="ct-bar"><i style="width:'+fpct+'%"></i></div></div>'
        +'<div class="ct-metric"><div class="ct-mh"><span>Hạn dùng</span></div>'+hanTxt+'</div>'
      +'</div>'
      +'<div class="ct-chips">'+chips+'</div>'
      +'<div class="ct-card-f">'
        +'<button class="ct-b" onclick="ctViewAs(\''+escJs_(c.id)+'\')">'+icon('eye',14)+' Xem dữ liệu</button>'
        +'<button class="ct-b" onclick="ctEdit('+i+')">'+icon('edit',14)+' Phân quyền</button>'
        +'<span class="sp" style="flex:1"></span>'
        +'<button class="ct-b del" title="Xoá công ty và toàn bộ dữ liệu" onclick="ctDelete('+i+')">'+icon('trash',14)+'</button>'
      +'</div></div>';
  }).join('') || '<div class="empty" style="padding:40px;text-align:center">Chưa có công ty nào. Bấm <b>Tạo công ty</b> để bắt đầu.</div>';
  var viewing=S._viewAs?(list.filter(function(c){return String(c.id)===String(S._viewAs);})[0]||{}).ten:'';
  box.innerHTML='<div class="sechd"><h2>Quản lý công ty</h2><span class="count">'+list.length+'</span>'
      +'<span class="sp" style="flex:1"></span>'
      +'<button class="btn blue sm" onclick="ctCreate()">'+icon('plus',14)+' Tạo công ty</button></div>'
    +(viewing?'<div class="ct-viewbar">'+icon('eye',15)+' Đang xem dữ liệu của <b>'+esc(viewing)+'</b>'
      +'<button class="btn ghost xs" onclick="ctViewAs(\'\')">Thoát chế độ xem</button></div>':'')
    +stats+'<div class="ct-grid">'+cards+'</div>';
}
// Super admin "xem như" 1 công ty -> mọi API gắn header x-view-company
function ctViewAs(id){
  S._viewAs=id||'';
  try{ id?localStorage.setItem('qs_viewAs',id):localStorage.removeItem('qs_viewAs'); }catch(e){}
  toast(id?'Đang xem dữ liệu công ty đã chọn':'Đã thoát chế độ xem');
  boot().then(function(){ renderCongTy(); }, function(e){ toast('Lỗi tải dữ liệu công ty: '+e.message); });
}
function ctCreate(){ ctForm_(null); }
function ctEdit(i){ ctForm_((S._ctList||[])[i]||null); }
function ctForm_(c){
  var isNew=!c;
  c=c||{tinhNang:CT_FEATURES.map(function(f){return f[0];}), gioiHanUser:10, active:true};
  S._ctEditing=c;
  var ov=document.createElement('div'); ov.className='sp-modal-ov'; ov.id='ctOv';
  ov.onclick=function(e){ if(e.target===ov) ctClose(); };
  ov.innerHTML='<div class="sp-modal ct-modal pd"><div class="pd-head"><h3>'+icon('building',16)+' '
      +(isNew?'Tạo công ty mới':esc(c.ten))+'</h3><button class="pd-x" onclick="ctClose()">✕</button></div>'
    +'<div class="ct-tabs">'
      +'<button class="ct-tab on" data-t="info" onclick="ctTab_(\'info\')">Thông tin</button>'
      +'<button class="ct-tab" data-t="goi" onclick="ctTab_(\'goi\')">Gói &amp; tính năng</button>'
      +(isNew?'<button class="ct-tab" data-t="ad" onclick="ctTab_(\'ad\')">Tài khoản quản trị</button>'
             :'<button class="ct-tab" data-t="users" onclick="ctTab_(\'users\')">Người dùng</button>')
    +'</div>'
    // ---- Thông tin ----
    +'<div class="ct-pane on" data-p="info"><div class="ct-form">'
      +'<div class="spe-f"><label>Tên công ty *</label><input id="ctTen" value="'+esc(c.ten||'')+'" placeholder="VD: Nội thất An Phát"></div>'
      +'<div class="spe-f"><label>Mã công ty</label><input id="ctMa" value="'+esc(c.ma||'')+'" placeholder="tự tạo từ tên"'+(isNew?'':' readonly')+'></div>'
      +'<div class="spe-f"><label>Email liên hệ</label><input id="ctEmail" type="email" value="'+esc(c.email||'')+'" placeholder="ketoan@congty.vn"></div>'
      +'<div class="spe-f"><label>Điện thoại</label><input id="ctSdt" value="'+esc(c.sdt||'')+'" placeholder="09xx xxx xxx"></div>'
      +'<div class="spe-f wide"><label>Logo công ty</label>'
        +'<input type="hidden" id="ctLogo" value="'+esc(c.logoUrl||'')+'">'
        +'<div class="ctlogo-wrap" id="ctLogoWrap" onclick="ctLogoPick()" ondragover="ctLogoDrag(event,1)" ondragleave="ctLogoDrag(event,0)" ondrop="ctLogoDrop(event)">'+ctLogoInner_(c.logoUrl||'')+'</div>'
        +'<div class="upurl ctlogo-url"><span class="upurl-ic">'+icon('link',13)+'</span>'
          +'<input id="ctLogoUrl" placeholder="Hoặc dán link ảnh…" onkeydown="if(event.key===\'Enter\'){event.preventDefault();ctLogoAddUrl();}">'
          +'<button class="upurl-btn" onclick="ctLogoAddUrl()">Dùng link</button></div>'
      +'</div>'
    +'</div></div>'
    // ---- Gói & tính năng ----
    +'<div class="ct-pane" data-p="goi">'
      +'<div class="ct-form">'
        +'<div class="spe-f"><label>Số người dùng tối đa</label><input id="ctLimit" type="number" min="1" value="'+(c.gioiHanUser||10)+'"></div>'
        +'<div class="spe-f"><label>Hạn dùng <i class="ct-hint">(trống = không giới hạn)</i></label><input id="ctHan" type="date" value="'+esc(c.hanDung||'')+'"></div>'
        +'<div class="spe-f"><label>Trạng thái</label><select id="ctActive"><option value="1"'+(c.active!==false?' selected':'')+'>Đang hoạt động</option><option value="0"'+(c.active===false?' selected':'')+'>Tạm khoá</option></select></div>'
        +'<div class="spe-f"><label>Ghi chú</label><input id="ctGhiChu" value="'+esc(c.ghiChu||'')+'" placeholder="Gói/hợp đồng…"></div>'
      +'</div>'
      +'<div class="ct-share"><label class="ct-sw'+(c.dungSpDezon?' on':'')+'">'
        +'<input type="checkbox" id="ctShareSp"'+(c.dungSpDezon?' checked':'')+' onchange="this.closest(\'.ct-sw\').classList.toggle(\'on\',this.checked)">'
        +'<span class="ct-sw-b"></span>'
        +'<span class="ct-sw-t"><b>Cho dùng danh sách sản phẩm của Dezon</b>'
          +'<i>Công ty thấy thêm kho SP mẫu của Dezon (chỉ xem, không sửa/xoá được). Vẫn nhập được SP riêng.</i></span>'
      +'</label></div>'
      +'<div class="ct-feat"><div class="ct-feat-h">Tính năng được dùng'
        +'<button class="ct-all" onclick="ctToggleAll_(true)">Chọn hết</button>'
        +'<button class="ct-all" onclick="ctToggleAll_(false)">Bỏ hết</button></div><div class="ct-feat-b">'
        +CT_FEATURES.map(function(f){ var on=(c.tinhNang||[]).indexOf(f[0])>=0;
          return '<label class="ct-fchk'+(on?' on':'')+'"><input type="checkbox" data-f="'+f[0]+'"'+(on?' checked':'')
            +' onchange="this.parentNode.classList.toggle(\'on\',this.checked)"><span>'+esc(f[1])+'</span></label>';
        }).join('')+'</div></div>'
    +'</div>'
    // ---- Tài khoản quản trị (khi TẠO MỚI) ----
    +(isNew?'<div class="ct-pane" data-p="ad">'
      +'<p class="ct-note">Tạo sẵn tài khoản quản trị để bàn giao cho công ty. Họ đăng nhập được bằng <b>tên đăng nhập hoặc email</b>.</p>'
      +'<div class="ct-form">'
        +'<div class="spe-f"><label>Tên đăng nhập</label><input id="ctAdU" placeholder="vd: anphat.admin"></div>'
        +'<div class="spe-f"><label>Email đăng nhập</label><input id="ctAdE" type="email" placeholder="admin@congty.vn"></div>'
        +'<div class="spe-f"><label>Họ tên</label><input id="ctAdN" placeholder="Nguyễn Văn A"></div>'
        +'<div class="spe-f"><label>Mật khẩu</label><input id="ctAdP" type="password" placeholder="≥4 ký tự"></div>'
      +'</div></div>':'')
    // ---- Người dùng (khi SỬA) ----
    +(isNew?'':'<div class="ct-pane" data-p="users"><div id="ctUsers"><div class="empty" style="padding:20px">Đang tải…</div></div></div>')
    +'<div class="ct-f-btn"><button class="btn ghost sm" onclick="ctClose()">Huỷ</button>'
      +'<button class="btn blue" id="ctSaveBtn" onclick="ctSave(\''+escJs_(isNew?'':c.id)+'\')">'+icon('check',15)+' '+(isNew?'Tạo công ty':'Lưu thay đổi')+'</button></div></div>';
  document.body.appendChild(ov);
}
// ===== Logo công ty: tải ảnh lên (kéo/thả · bấm chọn · dán Ctrl+V · hoặc link) =====
function ctLogoInner_(url){
  if(url) return '<div class="ctlogo-box has"><img src="'+esc(imgUrlOf(url))+'" onerror="this.style.visibility=\'hidden\'">'
    +'<button class="ctlogo-x" title="Xoá logo" onclick="event.stopPropagation();ctLogoClear()">✕</button>'
    +'<span class="ctlogo-swap">'+icon('edit',12)+' Đổi logo</span></div>';
  return '<div class="ctlogo-box"><div class="ctlogo-ic">'+icon('camera',24)+'</div>'
    +'<div class="ctlogo-t">Kéo/thả hoặc bấm để tải logo</div>'
    +'<div class="ctlogo-s">PNG nền trong suốt · tối đa 5MB</div></div>';
}
function ctLogoRefresh_(){
  var w=document.getElementById('ctLogoWrap'), h=document.getElementById('ctLogo');
  if(w&&h) w.innerHTML=ctLogoInner_(h.value||'');
}
function ctLogoClear(){ var h=document.getElementById('ctLogo'); if(h) h.value=''; ctLogoRefresh_(); }
function ctLogoAddUrl(){
  var i=document.getElementById('ctLogoUrl'), h=document.getElementById('ctLogo');
  var v=i?String(i.value).trim():''; if(!v) return;
  h.value=v; i.value=''; ctLogoRefresh_(); toast('Đã dùng link ảnh làm logo');
}
function ctLogoPick(){
  var inp=document.createElement('input'); inp.type='file'; inp.accept='image/*';
  inp.onchange=function(){ var f=(inp.files||[])[0]; if(f) ctLogoUpload_(f); };
  inp.click();
}
async function ctLogoUpload_(file){
  var w=document.getElementById('ctLogoWrap'), h=document.getElementById('ctLogo');
  if(!w||!h) return;
  w.innerHTML='<div class="ctlogo-box loading"><div class="ctlogo-t">Đang tải logo lên…</div></div>';
  try{
    var dataUrl=await downscaleImage_(file, 512, 0.9);
    if(!dataUrl||dataUrl==='__DECODE_FAIL__'){ toast('Không đọc được ảnh — thử PNG/JPG khác'); ctLogoRefresh_(); return; }
    var tok=await uploadImg_(dataUrl, 'logo-'+Date.now()+'.png');
    h.value=tok; ctLogoRefresh_(); toast('Đã tải logo lên');
  }catch(e){ toast('Lỗi tải logo: '+e.message); ctLogoRefresh_(); }
}
function ctLogoDrag(e,on){ e.preventDefault();
  var b=document.querySelector('#ctLogoWrap .ctlogo-box'); if(b) b.classList.toggle('drag',!!on); }
function ctLogoDrop(e){ e.preventDefault(); ctLogoDrag(e,0);
  var f=[].slice.call((e.dataTransfer&&e.dataTransfer.files)||[]).filter(function(x){ return !x.type||/^image\//.test(x.type); })[0];
  if(f) ctLogoUpload_(f);
}
function ctTab_(t){
  var ov=document.getElementById('ctOv'); if(!ov) return;
  ov.querySelectorAll('.ct-tab').forEach(function(b){ b.classList.toggle('on', b.getAttribute('data-t')===t); });
  ov.querySelectorAll('.ct-pane').forEach(function(p){ p.classList.toggle('on', p.getAttribute('data-p')===t); });
  if(t==='users') ctLoadUsers_();
}
function ctToggleAll_(on){
  var ov=document.getElementById('ctOv'); if(!ov) return;
  ov.querySelectorAll('[data-f]').forEach(function(e){ e.checked=on; e.parentNode.classList.toggle('on',on); });
}
async function ctLoadUsers_(){
  var box=document.getElementById('ctUsers'); var c=S._ctEditing; if(!box||!c) return;
  try{
    var us=await api('listCongTyUsers', c.id);
    var lbl={}; CT_FEATURES.forEach(function(f){ lbl[f[0]]=f[1]; });
    var rows=us.map(function(u){
      var role={super:'Quản trị hệ thống',admin:'Quản trị công ty',staff:'Nhân viên'}[u.role]||u.role;
      var q = u.role==='staff' ? ((u.perms||[]).map(function(k){return '<span class="permchip">'+esc(lbl[k]||k)+'</span>';}).join(' ')||'<span class="st-lk">Chưa cấp</span>') : '<span class="muted">Toàn quyền</span>';
      return '<tr><td><b>'+esc(u.username)+'</b>'+(u.email?'<span class="ct-ma">'+esc(u.email)+'</span>':'')+'</td>'
        +'<td>'+esc(u.hoTen||'')+'</td><td>'+esc(role)+'</td><td>'+q+'</td>'
        +'<td class="c"><span class="ct-badge '+(u.active?'ok':'locked')+'">'+(u.active?'Hoạt động':'Khoá')+'</span></td></tr>';
    }).join('') || '<tr><td colspan="5" class="empty" style="padding:18px">Công ty chưa có tài khoản nào.</td></tr>';
    box.innerHTML='<div class="ct-uhead"><span>'+us.length+' / '+(c.gioiHanUser||'∞')+' tài khoản</span>'
        +'<button class="btn blue xs" onclick="ctAddUser_()">'+icon('plus',13)+' Thêm tài khoản</button></div>'
      +'<div class="tbl-wrap"><table class="sp-table"><thead><tr><th>Đăng nhập</th><th>Họ tên</th><th>Vai trò</th><th>Quyền</th><th class="ct">Trạng thái</th></tr></thead><tbody>'+rows+'</tbody></table></div>';
  }catch(e){ box.innerHTML='<div class="empty" style="padding:20px">Lỗi: '+esc(e.message)+'</div>'; }
}
async function ctAddUser_(){
  var c=S._ctEditing; if(!c) return;
  var r=await askInput_({title:'Thêm tài khoản cho '+c.ten, confirmText:'Tạo tài khoản', fields:[
    {key:'u', label:'Tên đăng nhập'}, {key:'e', label:'Email (đăng nhập được)'},
    {key:'n', label:'Họ tên'}, {key:'p', label:'Mật khẩu (≥4 ký tự)', type:'password'} ], required:false});
  if(!r) return;
  if(!r.u || String(r.p).length<4){ toast('Cần tên đăng nhập và mật khẩu ≥4 ký tự'); return; }
  try{ await api('createCongTyUser', c.id, {username:r.u, email:r.e, hoTen:r.n, password:r.p, role:'staff', perms:[]});
    toast('Đã tạo tài khoản '+r.u); ctLoadUsers_(); renderCongTy(); }
  catch(e){ toast('Lỗi: '+e.message); }
}
function ctClose(){ var o=document.getElementById('ctOv'); if(o)o.remove(); S._ctEditing=null; }
async function ctSave(id){
  var ov=document.getElementById('ctOv'); if(!ov) return;
  function v(i){ var e=document.getElementById(i); return e?String(e.value).trim():''; }
  var feats=[].slice.call(ov.querySelectorAll('[data-f]')).filter(function(e){return e.checked;}).map(function(e){return e.getAttribute('data-f');});
  var d={ ten:v('ctTen'), logoUrl:v('ctLogo'), email:v('ctEmail'), sdt:v('ctSdt'), tinhNang:feats,
          gioiHanUser:Number(v('ctLimit'))||0, hanDung:v('ctHan')||null,
          active:v('ctActive')==='1', ghiChu:v('ctGhiChu'),
          dungSpDezon: !!(document.getElementById('ctShareSp')||{}).checked };
  if(!d.ten){ toast('Chưa nhập tên công ty'); ctTab_('info'); return; }
  if(!feats.length){ toast('Chọn ít nhất 1 tính năng cho công ty'); ctTab_('goi'); return; }
  var btn=document.getElementById('ctSaveBtn'); if(btn){ btn.disabled=true; btn.textContent='Đang lưu…'; }
  try{
    if(id){ await api('updateCongTy', id, d); toast('Đã cập nhật công ty'); }
    else{
      d.ma=v('ctMa'); d.adminUser=v('ctAdU'); d.adminEmail=v('ctAdE'); d.adminHoTen=v('ctAdN'); d.adminPass=v('ctAdP');
      if(d.adminUser && String(d.adminPass).length<4){ toast('Mật khẩu quản trị tối thiểu 4 ký tự'); ctTab_('ad');
        if(btn){btn.disabled=false;btn.textContent='Tạo công ty';} return; }
      var c=await api('createCongTy', d);
      toast('Đã tạo "'+c.ten+'"'+(d.adminUser?(' — đăng nhập: '+d.adminUser):''));
    }
    ctClose(); renderCongTy();
  }catch(e){ toast('Lỗi: '+e.message); if(btn){ btn.disabled=false; btn.textContent=id?'Lưu thay đổi':'Tạo công ty'; } }
}

async function ctDelete(i){
  var c=(S._ctList||[])[i]; if(!c) return;
  var ok=await askInput_({title:'Xoá công ty', note:'Xoá VĨNH VIỄN công ty "'+c.ten+'" và TOÀN BỘ dữ liệu (dự án, sản phẩm, đơn hàng, tài khoản). Không thể hoàn tác.',
    label:'Gõ đúng mã công ty để xác nhận: '+c.ma, placeholder:c.ma, confirmText:'Xoá vĩnh viễn'});
  if(ok==null) return;
  if(String(ok).trim()!==c.ma){ toast('Mã xác nhận không đúng — đã huỷ'); return; }
  try{ var r=await api('deleteCongTy', c.id); toast('Đã xoá công ty "'+r.ten+'"'); renderCongTy(); }
  catch(e){ toast('Lỗi: '+e.message); }
}
