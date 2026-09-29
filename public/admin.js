/* ═══ TAB ADMIN — tài khoản trong công ty, phân quyền, duyệt yêu cầu xoá SP / đơn mua hàng, nhật ký. ═══ */
'use strict';

function admActionLabel_(a){ var m={loi_giao_dien:'Lỗi giao diện',login:'Đăng nhập',logout:'Đăng xuất',login_fail:'ĐN lỗi',create_user:'Tạo TK',update_user:'Sửa TK',delete_user:'Xóa TK',reset_password:'Đặt lại MK',change_password:'Đổi MK',lock_user:'Khóa TK',unlock_user:'Mở khóa'}; return m[a]||a; }
async function renderAdmin(){
  var box=document.getElementById('v-admin'); if(!box) return;
  if(!isAdminRole_()){ box.innerHTML='<div class="sechd"><h2>Quản trị</h2></div><div class="empty">Bạn không có quyền truy cập.</div>'; return; }
  box.innerHTML='<div class="sechd"><h2>Quản trị — Tài khoản & phân quyền</h2></div><div id="admBody"><div class="empty">Đang tải…</div></div>';
  try{
    var users=await api('adminListUsers'); var reqs=await api('listDeleteRequests'); var purs=await api('listPurchaseRequests'); var logs=await api('getAuditLog',120); S._admUsers=users;
    var dxs=[]; try{ dxs=await api('listDeXuat')||[]; }catch(e){ dxs=[]; }
    if(isSuper_()){ try{ S._admCt=await api('listCongTy')||[]; }catch(e){ S._admCt=[]; } }
    document.getElementById('admBody').innerHTML=admStats_(users,reqs,purs,dxs)+admUsersCard_(users)+admReqCard_(reqs)+admPurCard_(purs)+admDxCard_(dxs)+admLogCard_(logs);
  }catch(e){ document.getElementById('admBody').innerHTML='<div class="empty">Lỗi tải: '+esc(e.message)+'</div>'; }
}
function admStats_(users,reqs,purs,dxs){
  var pendDel=(reqs||[]).filter(function(r){return r.status==='pending';}).length;
  var pendPur=(purs||[]).filter(function(r){return r.status==='Chờ duyệt';}).length;
  var pendDx=(dxs||[]).filter(function(r){return r.status==='Chờ duyệt';}).length;
  function tile(ic,val,label,warn){ return '<div class="astat'+(warn&&val?' warn':'')+'"><span class="astat-ic">'+ic+'</span><div><div class="astat-v">'+val+'</div><div class="astat-l">'+label+'</div></div></div>'; }
  return '<div class="astats">'
    +tile(icon('lock',18),(users||[]).length,'Tài khoản',false)
    +tile(icon('trash',18),pendDel,'Yêu cầu xóa chờ duyệt',true)
    +tile(icon('cart',18),pendPur,'Đơn mua hàng chờ duyệt',true)
    +tile(icon('gauge',18),pendDx,'Đề xuất chờ duyệt',true)+'</div>';
}
function rqItem_(opts){
  // opts: {cls, icon, title, meta, badgeCls, badgeText, actions, time}
  return '<div class="rq-item '+opts.cls+'"'+(opts.id?' id="'+opts.id+'"':'')+(opts.onclick?' onclick="'+opts.onclick+'"':'')+'><span class="rq-ic '+opts.cls+'">'+opts.icon+'</span>'
    +'<div class="rq-main"><div class="rq-title">'+opts.title+'</div>'+(opts.meta?'<div class="rq-meta">'+opts.meta+'</div>':'')+'</div>'
    +'<div class="rq-side"><span class="drq-badge '+opts.badgeCls+'">'+opts.badgeText+'</span>'
      +(opts.actions?'<div class="rq-act">'+opts.actions+'</div>':'')
      +'<span class="rq-time">'+opts.time+'</span></div></div>';
}
function isSuper_(){ return !!(S.me && S.me.role==='super'); }
function admCtTen_(id){ var c=(S._admCt||[]).filter(function(x){ return x.id===id; })[0]; return c?(c.ten||c.ma||id):'(công ty đã xoá)'; }
function admUsersCard_(users){
  var lbl={}; PERM_TABS.forEach(function(t){ lbl[t[0]]=t[1]; });
  function permCell(u){ if(u.role==='admin'||u.role==='super') return '<span class="muted">Toàn quyền</span>';
    var p=u.perms||[]; if(!p.length) return '<span class="st-lk">Chưa cấp</span>';
    return p.map(function(k){ return '<span class="permchip">'+esc(lbl[k]||k)+'</span>'; }).join(' '); }
  var rows=users.map(function(u){
    var av=(u.hoTen||u.username||'?').trim().charAt(0).toUpperCase();
    return '<tr class="'+(u.active?'':'locked')+'">'
      +'<td><span class="uav '+(u.role!=='staff'?'adm':'')+'">'+esc(av)+'</span><b>'+esc(u.username)+'</b>'+(u.email?'<span class="ct-ma">'+esc(u.email)+'</span>':'')+'</td><td>'+esc(u.hoTen||'')+'</td>'
      +'<td><span class="rolebadge '+(u.role==='super'?'sup':(u.role==='admin'?'adm':'stf'))+'">'
        +({super:'Quản trị hệ thống',admin:'Admin công ty',staff:'Nhân viên'}[u.role]||u.role)+'</span></td>'
      +'<td class="permcol">'+permCell(u)+'</td>'
      +(isSuper_()?('<td>'+(u.congTyId?esc(admCtTen_(u.congTyId)):'<span class="st-lk" title="Tài khoản không thuộc công ty nào — không đăng nhập được. Bấm Sửa để gán công ty.">⚠ Chưa gán công ty</span>')+'</td>'):'')
      +'<td>'+(u.active?'<span class="st-ok">● Hoạt động</span>':'<span class="st-lk">● Đã khóa</span>')+'</td>'
      +'<td class="muted">'+(u.lastLogin?fmtDateTime_(u.lastLogin):'—')+'</td>'
      +'<td class="admact"><button class="btn ghost xs" onclick="admEdit(\''+u.id+'\')">Sửa</button>'
        +'<button class="btn ghost xs" onclick="admResetPw(\''+u.id+'\')">Đặt MK</button>'
        +'<button class="btn ghost xs" onclick="admToggleActive(\''+u.id+'\','+(u.active?'false':'true')+')">'+(u.active?'Khóa':'Mở')+'</button>'
        +'<button class="btn ghost xs danger" onclick="admDelete(\''+u.id+'\')">Xóa</button></td></tr>';
  }).join('');
  var inner='<div style="margin-bottom:12px"><button class="btn blue sm" onclick="admCreate()">'+icon('plus',14)+' Thêm tài khoản</button></div>'
    +(isSuper_()&&users.filter(function(u){return !u.congTyId;}).length
      ? '<div class="adm-warn"><span class="adm-warn-ic">!</span><span>Có <b>'+users.filter(function(u){return !u.congTyId;}).length
        +'</b> tài khoản chưa gán công ty. Tài khoản kiểu này không đăng nhập được và không hiện trong danh sách của công ty nào — bấm <b>Sửa</b> để gán công ty hoặc xoá đi.</span></div>' : '')
    +'<div class="tbl-wrap"><table class="admtbl"><tr><th>Tên đăng nhập</th><th>Họ tên</th><th>Vai trò</th><th>Quyền truy cập</th>'
      +(isSuper_()?'<th>Công ty</th>':'')+'<th>Trạng thái</th><th>Đăng nhập gần nhất</th><th></th></tr>'+rows+'</table></div>';
  return dbCard_('Tài khoản ('+users.length+')','lock','Admin toàn quyền · Nhân viên không mở được trang này.',inner);
}
/* ===== Chi tiết đơn mua hàng (Admin bấm vào 1 đơn) ===== */
async function purDetail(maDon){
  var ov=document.createElement('div'); ov.className='sp-modal-ov'; ov.id='purOv';
  ov.onclick=function(e){ if(e.target===ov) purClose(); };
  ov.innerHTML='<div class="sp-modal pur-modal pd"><div class="pd-head"><h3>'+icon('cart',16)+' Chi tiết đơn mua hàng</h3>'
    +'<button class="pd-x" onclick="purClose()">✕</button></div><div class="pur-body"><div class="empty" style="padding:26px">Đang tải…</div></div></div>';
  document.body.appendChild(ov);
  try{
    var o=await api('getPurchaseOrder', maDon);
    ov.querySelector('.pur-body').innerHTML=purDetailHtml_(o);
  }catch(e){ ov.querySelector('.pur-body').innerHTML='<div class="empty" style="padding:26px">Lỗi tải đơn: '+esc(e.message)+'</div>'; }
}
function purClose(){ var o=document.getElementById('purOv'); if(o)o.remove(); }
function purDetailHtml_(o){
  var scls={'Đã duyệt':'approved','Từ chối':'rejected','Chờ duyệt':'pending','Đã gửi':'pending'}[o.status]||'pending';
  var rows=(o.items||[]).map(function(it,i){
    return '<tr><td class="c">'+(i+1)+'</td>'
      +'<td class="pur-th">'+(it.hinhAnh?'<img src="'+esc(imgSrc1_(it.hinhAnh))+'" onerror="this.style.visibility=\'hidden\'">':'<span class="pur-noimg"></span>')+'</td>'
      +'<td><b>'+esc(it.ten||'')+'</b>'+(it.ma?'<span class="pur-code">'+esc(it.ma)+'</span>':'')
        +(it.phong?'<span class="pur-room">'+icon('building',10)+' '+esc(it.phong)+'</span>':'')+'</td>'
      +'<td>'+esc(it.thuongHieu||'')+'</td>'
      +'<td class="c">'+esc(it.dvt||'')+'</td>'
      +'<td class="n">'+(it.sl||0)+'</td>'
      +'<td class="n">'+money(it.donGia)+'</td>'
      +'<td class="n b">'+money(it.thanhTien)+'</td></tr>';
  }).join('') || '<tr><td colspan="8" class="empty" style="padding:18px">Đơn không có sản phẩm.</td></tr>';
  var info=function(k,v){ return v?('<div class="pur-i"><span>'+esc(k)+'</span><b>'+esc(v)+'</b></div>'):''; };
  return '<div class="pur-head">'
      +'<div class="pur-ma">'+esc(o.maDon)+'<span class="drq-badge '+scls+'">'+esc(o.status||'')+'</span></div>'
      +'<div class="pur-grid">'
        +info('Nhà cung cấp',o.supplier)+info('Dự án',o.project)
        +info('Người gửi',o.requester)+info('Phòng ban',o.phongBan)
        +info('Hạng mục',o.hangMuc)+info('Ngày gửi',fmtDateTime_(o.at))
        +(o.nguoiDuyet?info('Người duyệt',o.nguoiDuyet):'')
        +(o.ngayDuyet?info('Ngày duyệt',fmtDateTime_(o.ngayDuyet)):'')
      +'</div>'+(o.ghiChu?'<div class="pur-note">'+icon('doc',12)+' '+esc(o.ghiChu)+'</div>':'')+'</div>'
    +'<div class="tbl-wrap pur-tblwrap"><table class="pur-tbl"><thead><tr>'
      +'<th class="c">STT</th><th>Ảnh</th><th>Sản phẩm</th><th>Thương hiệu</th><th class="c">ĐVT</th>'
      +'<th class="n">SL</th><th class="n">Đơn giá</th><th class="n">Thành tiền</th></tr></thead><tbody>'+rows+'</tbody></table></div>'
    +'<div class="pur-tot">'
      +'<div><span>Tạm tính ('+(o.soSp||0)+' SP)</span><b>'+money(o.tongTruocVat)+' đ</b></div>'
      +'<div><span>VAT '+(o.vatPct||0)+'%</span><b>'+money(o.vat)+' đ</b></div>'
      +'<div class="grand"><span>TỔNG THANH TOÁN</span><b>'+money(o.total)+' đ</b></div>'
    +'</div>'
    +(o.status==='Chờ duyệt'
      ? '<div class="pur-act"><button class="btn ghost sm danger" onclick="purResolve(\''+escJs_(o.maDon)+'\',false);purClose()">Từ chối</button>'
        +'<button class="btn blue" onclick="purResolve(\''+escJs_(o.maDon)+'\',true);purClose()">'+icon('check',15)+' Duyệt đơn</button></div>'
      : '');
}
function admPurCard_(purs){
  purs=purs||[]; var pending=purs.filter(function(r){return r.status==='Chờ duyệt';});
  var lbl={'Đã duyệt':'approved','Từ chối':'rejected','Chờ duyệt':'pending','Đã gửi':'pending'};
  var body= purs.length? purs.map(function(r){
    var scls=lbl[r.status]||'pending';
    return rqItem_({ cls:scls+' clickable', icon:icon('cart',16),
      onclick:'purDetail(\''+escJs_(r.maDon)+'\')',
      title:'<b>'+esc(r.maDon)+'</b> · '+esc(r.supplier||'—')+' · <span class="rq-amt">'+money(r.total)+'đ</span>'
        +'<span class="rq-view">'+icon('eye',12)+' Xem chi tiết</span>',
      meta:'Người gửi <b>'+esc(r.requester||'—')+'</b>'+(r.phongBan?(' · '+esc(r.phongBan)):'')+' · Dự án '+esc(r.project||'—')+' · '+(r.soSp||0)+' SP',
      badgeCls:scls, badgeText:esc(r.status||''),
      actions: scls==='pending'?'<button class="btn blue xs" onclick="event.stopPropagation();purResolve(\''+escJs_(r.maDon)+'\',true)">Duyệt</button><button class="btn ghost xs danger" onclick="event.stopPropagation();purResolve(\''+escJs_(r.maDon)+'\',false)">Từ chối</button>':'',
      time: fmtDateTime_(r.at) });
  }).join(''):'<div class="empty">Chưa có đơn mua hàng nào.</div>';
  return '<div class="dbcard" id="purCard"><div class="dbcard-h"><span class="dbcard-ic">'+icon('cart',18)+'</span><h3>Yêu cầu mua hàng</h3>'+(pending.length?'<span class="pend-badge">'+pending.length+' chờ duyệt</span>':'')+'</div><div class="dbcard-b rq-body">'+body+'</div></div>';
}
async function purResolve(maDon,approve){
  if(!approve && !await xacNhan_('Từ chối đơn mua hàng '+maDon+'?')) return;
  api('resolvePurchaseRequest',maDon,approve).then(function(){ toast(approve?'Đã duyệt đơn '+maDon:'Đã từ chối đơn '+maDon); renderAdmin(); refreshNotifCount_(); }).catch(function(e){ toast('Lỗi: '+e.message); });
}
function admReqCard_(reqs){
  reqs=reqs||[]; var pending=reqs.filter(function(r){return r.status==='pending';});
  var lbl={pending:'Chờ duyệt',approved:'Đã duyệt',rejected:'Từ chối'};
  var body= reqs.length? reqs.map(function(r){
    var meta=r.items.map(function(it){return '<span class="it">'+esc(it.ten||it.maSP)+'</span>';}).join('')
      +(r.status!=='pending'&&r.resolver?'<span class="rq-by">Xử lý bởi '+esc(r.resolver)+'</span>':'');
    return rqItem_({ cls:r.status, id:'drq-'+r.id, icon:icon('trash',16),
      title:'<b>'+esc(r.requester||'')+'</b> yêu cầu xóa '+r.items.length+' sản phẩm',
      meta:meta, badgeCls:r.status, badgeText:(lbl[r.status]||r.status),
      actions: r.status==='pending'?'<button class="btn blue xs" onclick="drqResolve('+r.id+',true)">Duyệt &amp; xóa</button><button class="btn ghost xs danger" onclick="drqResolve('+r.id+',false)">Từ chối</button>':'',
      time: fmtDateTime_(r.at) });
  }).join(''):'<div class="empty">Chưa có yêu cầu xóa nào.</div>';
  return '<div class="dbcard" id="drqCard"><div class="dbcard-h"><span class="dbcard-ic">'+icon('trash',18)+'</span><h3>Yêu cầu xóa sản phẩm</h3>'+(pending.length?'<span class="pend-badge">'+pending.length+' chờ duyệt</span>':'')+'</div><div class="dbcard-b rq-body">'+body+'</div></div>';
}
async function drqResolve(id,approve){
  if(!approve && !await xacNhan_('Từ chối yêu cầu xóa này?')) return;
  api('resolveDeleteRequest',id,approve).then(function(r){
    toast(approve?('Đã duyệt & xóa '+(r.deleted||0)+' sản phẩm'):'Đã từ chối yêu cầu');
    renderAdmin(); refreshNotifCount_();
    if(approve){ api('getProducts').then(function(ps){ if(ps) S.products=ps; }).catch(function(){}); }
  }).catch(function(e){ toast('Lỗi: '+e.message); });
}
function admLogCard_(logs){
  var rows=logs.map(function(l){ return '<tr><td class="muted">'+fmtDateTime_(l.at)+'</td><td><b>'+esc(l.username||'')+'</b></td><td>'+esc(admActionLabel_(l.action))+'</td><td class="muted">'+esc(l.detail||'')+'</td></tr>'; }).join('');
  return dbCard_('Nhật ký hoạt động','list','', '<div class="tbl-wrap"><table class="admtbl"><tr><th style="width:170px">Thời gian</th><th>Người dùng</th><th>Hành động</th><th>Chi tiết</th></tr>'+(rows||'<tr><td colspan="4" class="muted">Chưa có</td></tr>')+'</table></div>');
}
function admCreate(){ admUserModal(null); }
function admEdit(id){ var u=(S._admUsers||[]).filter(function(x){return x.id===id;})[0]; if(u) admUserModal(u); }
function admUserModal(user){
  var isEdit=!!user; user=user||{role:'staff',perms:[]};
  var perms=user.perms||[];
  var has=function(k){ return perms.indexOf(k)>=0; };
  var permHtml=PERM_TABS.map(function(t){
    return '<label class="admck"><input type="checkbox" value="'+t[0]+'"'+(has(t[0])?' checked':'')
      +' onchange="admSubSync_()">'+esc(t[1])+'</label>'; }).join('');
  // Quyền trong tab Danh sách SP: CHỌN MỘT — chỉ sửa, hoặc sửa và duyệt
  var lv = has('sp_duyet')?'sp_duyet':(has('sp_edit')?'sp_edit':'');
  var spSub='<div class="admsub" id="am_spsub">'
    +'<div class="admsub-h">Trong tab Danh sách sản phẩm</div>'
    +'<label class="admrd"><input type="radio" name="am_splv" value=""'+(lv?'':' checked')+'>'
      +'<span><b>Không giới hạn</b><i>Sửa thẳng, không cần duyệt (mặc định như trước)</i></span></label>'
    +'<label class="admrd"><input type="radio" name="am_splv" value="sp_edit"'+(lv==='sp_edit'?' checked':'')+'>'
      +'<span><b>Chỉ được sửa</b><i>Sửa xong sản phẩm chuyển về “Chưa duyệt”</i></span></label>'
    +'<label class="admrd"><input type="radio" name="am_splv" value="sp_duyet"'+(lv==='sp_duyet'?' checked':'')+'>'
      +'<span><b>Được sửa và duyệt</b><i>Sửa thẳng và đánh dấu “Đã duyệt”</i></span></label>'
    +'</div>';
  var m=document.createElement('div'); m.className='amodal-ov'; m.id='admModal'; m.onclick=function(e){ if(e.target===m) admModalClose(); };
  m.innerHTML='<div class="amodal amodal-user">'
    +'<div class="amodal-hd"><div><h3>'+(isEdit?'Sửa tài khoản':'Thêm tài khoản')+'</h3>'
      +'<p>'+(isEdit?'Đổi họ tên, vai trò và quyền truy cập':'Tạo tài khoản mới cho công ty của bạn')+'</p></div>'
      +'<span class="amodal-x" onclick="admModalClose()">✕</span></div>'
    +'<div class="amodal-bd">'
      +'<div class="asec"><div class="asec-h">Thông tin đăng nhập</div>'
        +'<div class="agrid2">'
          +'<div class="afield"><label>Tên đăng nhập'+(isEdit?'':' <em>*</em>')+'</label>'
            +'<input id="am_user" '+(isEdit?'disabled':'')+' value="'+esc(user.username||'')+'" placeholder="vd: nguyenvana" autocomplete="off"></div>'
          +'<div class="afield"><label>Họ tên</label><input id="am_ht" value="'+esc(user.hoTen||'')+'" placeholder="Nguyễn Văn A"></div>'
        +'</div>'
        +'<div class="agrid2">'
          +'<div class="afield"><label>Phòng ban</label><input id="am_pb" value="'+esc(user.phongBan||'')+'" placeholder="vd: Kinh doanh, Thiết kế, Mua hàng"></div>'
          +(isEdit?'<div class="afield"></div>':'<div class="afield"><label>Mật khẩu <em>*</em></label><input id="am_pw" type="text" placeholder="Tối thiểu 4 ký tự" autocomplete="new-password"></div>')
        +'</div>'
        +(isSuper_()?(function(){
            // mặc định = công ty đang làm việc; super chỉ đổi khi muốn tạo cho công ty khác
            var mac = user.congTyId || (S.congTy&&S.congTy.id) || (S.me&&S.me.congTyId) || '';
            return '<div class="agrid2"><div class="afield"><label>Công ty</label>'
              +'<select id="am_ct">'
                +(S._admCt||[]).map(function(c){ return '<option value="'+esc(c.id)+'"'+(mac===c.id?' selected':'')+'>'+esc(c.ten||c.ma)+'</option>'; }).join('')
                +(mac?'':'<option value="" selected>— Chọn công ty —</option>')
              +'</select>'
              +(isEdit&&!user.congTyId
                 ?'<i class="afield-warn">Tài khoản này chưa thuộc công ty nào nên không đăng nhập được — chọn công ty rồi Lưu.</i>'
                 :'<i class="afield-hint">Mặc định là công ty bạn đang làm việc. Đổi nếu muốn tạo cho công ty khác.</i>')
            +'</div><div class="afield"></div></div>';
          })():'')
      +'</div>'
      +'<div class="asec"><div class="asec-h">Vai trò</div>'
        +'<div class="aseg" id="am_seg">'
          +'<label class="aseg-i"><input type="radio" name="am_role" value="staff"'+(user.role!=='admin'?' checked':'')+' onchange="admModalRole()">'
            +'<span><b>Nhân viên</b><i>Chỉ vào được các mục được cấp</i></span></label>'
          +'<label class="aseg-i"><input type="radio" name="am_role" value="admin"'+(user.role==='admin'?' checked':'')+' onchange="admModalRole()">'
            +'<span><b>Quản trị công ty</b><i>Toàn quyền trong công ty</i></span></label>'
        +'</div></div>'
      +'<div class="asec" id="am_permwrap"><div class="asec-h">Quyền truy cập'
        +'<span class="asec-n" id="am_permn"></span>'
        +'<span class="asec-quick"><a onclick="admPermAll(1)">Chọn tất cả</a><a onclick="admPermAll(0)">Bỏ hết</a></span></div>'
        +'<div class="admperms">'+permHtml+'</div>'+spSub
      +'</div>'
    +'</div>'
    +'<div class="amodal-ft"><button class="btn ghost" onclick="admModalClose()">Huỷ</button>'
      +'<button class="btn blue" id="am_save" onclick="admModalSave('+(isEdit?'\''+user.id+'\'':'null')+')">'
      +(isEdit?icon('check',15)+' Lưu thay đổi':icon('plus',15)+' Tạo tài khoản')+'</button></div>'
    +'</div>';
  document.body.appendChild(m); admModalRole(); admSubSync_();
}
// Ẩn khối quyền khi chọn Quản trị công ty (đã toàn quyền)
function admModalRole(){
  var r=document.querySelector('#am_seg input:checked'); var pw=document.getElementById('am_permwrap');
  if(r&&pw) pw.style.display = r.value==='admin'?'none':'';
  document.querySelectorAll('#am_seg .aseg-i').forEach(function(l){ l.classList.toggle('on', l.querySelector('input').checked); });
}
// Khối quyền con chỉ hiện khi đã cấp tab Danh sách sản phẩm
function admSubSync_(){
  var sp=document.querySelector('#am_permwrap input[type=checkbox][value=sanpham]');
  var sub=document.getElementById('am_spsub'); if(sub) sub.style.display=(sp&&sp.checked)?'':'none';
  var n=document.querySelectorAll('#am_permwrap input[type=checkbox]:checked').length;
  var tot=document.querySelectorAll('#am_permwrap input[type=checkbox]').length;
  var lb=document.getElementById('am_permn'); if(lb) lb.textContent=n+'/'+tot;
  document.querySelectorAll('#am_permwrap .admck').forEach(function(l){ l.classList.toggle('on', l.querySelector('input').checked); });
  document.querySelectorAll('#am_spsub .admrd').forEach(function(l){ l.classList.toggle('on', l.querySelector('input').checked); });
}
function admPermAll(on){
  document.querySelectorAll('#am_permwrap input[type=checkbox]').forEach(function(c){ c.checked=!!on; });
  admSubSync_();
}
document.addEventListener('change',function(e){ if(e.target.name==='am_splv') admSubSync_(); });
function admModalClose(){ var m=document.getElementById('admModal'); if(m)m.remove(); }
function admModalSave(id){
  var role=(document.querySelector('#am_seg input:checked')||{}).value||'staff';
  // quyền = các tab được tích + mức quyền trong tab Danh sách SP (radio, có thể bỏ trống)
  var perms=[];
  if(role!=='admin'){
    perms=[].slice.call(document.querySelectorAll('#am_permwrap input[type=checkbox]:checked')).map(function(c){return c.value;});
    var lv=document.querySelector('#am_spsub input[name=am_splv]:checked');
    if(lv && lv.value && perms.indexOf('sanpham')>=0) perms.push(lv.value);
  }
  var hoTen=document.getElementById('am_ht').value;
  var phongBan=(document.getElementById('am_pb')||{}).value||'';   // dùng cho báo cáo nhập SP gửi Lark
  var btn=document.getElementById('am_save'); btn.disabled=true;
  var done=function(msg){ toast(msg); admModalClose(); renderAdmin(); };
  var fail=function(e){ toast('Lỗi: '+e.message); btn.disabled=false; };
  var ctEl=document.getElementById('am_ct'), ctId=ctEl?ctEl.value:'';
  if(id){ var patch={hoTen:hoTen,role:role,perms:perms,phongBan:phongBan};
    if(ctEl) patch.congTyId=ctId;
    api('adminUpdateUser',id,patch).then(function(){ done('Đã cập nhật'); }).catch(fail); }
  else { var username=document.getElementById('am_user').value; var pw=document.getElementById('am_pw').value;
    api('adminCreateUser',{username:username,hoTen:hoTen,role:role,password:pw,perms:perms,phongBan:phongBan,congTyId:ctId||undefined})
      .then(function(){ done('Đã tạo tài khoản'); }).catch(fail); }
}
async function admResetPw(id){
  var np=await askInput_({title:'Đặt lại mật khẩu', label:'Mật khẩu mới (≥4 ký tự)', type:'password', confirmText:'Đặt lại'});
  if(!np) return; if(String(np).length<4){ toast('Mật khẩu phải từ 4 ký tự'); return; }
  api('adminSetPassword',id,np).then(function(){ toast('Đã đặt lại mật khẩu'); }).catch(function(e){ toast('Lỗi: '+e.message); }); }
function admToggleActive(id,active){ api('adminSetActive',id,active).then(function(){ toast(active?'Đã mở khóa':'Đã khóa'); renderAdmin(); }).catch(function(e){ toast('Lỗi: '+e.message); }); }
async function admDelete(id){ var u=(S._admUsers||[]).filter(function(x){return x.id===id;})[0]; if(!await xacNhan_('Xóa tài khoản "'+(u?u.username:'')+'"? Không thể hoàn tác.')) return; api('adminDeleteUser',id).then(function(){ toast('Đã xóa'); renderAdmin(); }).catch(function(e){ toast('Lỗi: '+e.message); }); }
