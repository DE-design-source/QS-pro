/* ═══ TAB DANH SÁCH SẢN PHẨM — bảng SP (cột, lọc, phân trang, sửa nhanh, hoàn tác), yêu thích, combo,
   biến thể, sửa / duyệt / xoá SP, chế độ xem Công tác trong trang SP, panel "SP trong dự án". ═══ */
'use strict';

/* ===== DANH SÁCH SẢN PHẨM ===== */
function renderSanpham(){
  var box=document.getElementById('v-sanpham');
  var searchIc='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>';
  // (bỏ hàng tiêu đề "Danh sách sản phẩm" — tab trên cùng đã ghi rõ, số SP có ở tab "Tất cả"; nhường chỗ cho bảng)
  box.innerHTML='<span id="spCount" hidden>0</span>'
    +'<div class="sp-workspace'+(spPanelHidden_()?' panel-hidden':'')+'" id="spWorkspace">'
      +'<button class="spp-show" id="sppShow" title="Hiện panel Sản phẩm trong dự án" onclick="spPanelToggle()">'
        +icon('layers',15)+'<span class="spp-show-n">'+((S.cur?S.lines:[])||[]).length+'</span></button>'
      +'<div class="sp-projpanel" id="spProjPanel" ondragover="spPanelDragOver(event)" ondragleave="spPanelDragLeave(event)" ondrop="spPanelDrop(event)"></div>'
      +'<div class="sp-main">'
        +'<div class="dbcard sp-card">'
          +'<div class="sp-toolbar">'
            +'<div class="sp-search-wrap">'+searchIc+'<input id="spSearch" placeholder="Tìm theo tên, mã hoặc thương hiệu…" oninput="S._spPage=1;spFilter()"></div>'
            +'<div class="spviewtabs" id="spViewTabs"></div>'      // tab trạng thái + ô hạng mục nằm CÙNG hàng với ô tìm (bớt 1 hàng)
            +'<span class="sp-flex"></span>'
            +'<div class="spbar" id="spBar"></div>'
            +'<button class="btn ghost sm sp-undobtn" id="spUndoBtn" onclick="spUndo_()" disabled title="Chưa có thao tác nào để hoàn tác">'
              +'<svg class="ico" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 14L4 9l5-5"/><path d="M4 9h11a5 5 0 0 1 0 10h-4"/></svg> Hoàn tác</button>'
            +'<button class="btn ghost sm sp-editbtn" id="spEditBtn" onclick="spEditToggle()" title="Sửa nhanh ngay trên bảng — hiện tất cả cột nhập liệu">'+icon('edit',14)+' Edit</button>'

            +'<button class="btn ghost sm" id="spBoLocBtn" onclick="spToggleBoLoc(event)">'+icon('sliders',14)+' Bộ lọc<span class="spflt-badge" id="spFltBadge"></span></button>'
            +'<button class="btn ghost sm" id="spXlsBtn" onclick="spXlsClick_()" title="Tải danh sách ra file Excel">'+icon('download',14)+' <span id="spXlsLbl">Tải Excel</span></button>'
            +'<button class="btn blue sm" onclick="showTab(\'import\')">'+icon('plus',14)+' Thêm sản phẩm</button>'
          +'</div>'
          +'<div class="pg-cols sp-colbox" id="spColBar"></div>'
          +'<div class="tbl-wrap"><table class="sp-table"><colgroup id="spColg"></colgroup><thead id="spHead"></thead>'
            +'<tbody id="spBody"></tbody></table></div>'
          // thanh kéo ngang nằm NGAY DƯỚI bảng, trên phân trang — đúng chỗ người dùng quen tìm
          +'<div class="tk-hbar sp-hbar" id="spHBar" style="display:none"><div class="tk-hthumb" id="spHThumb"></div></div>'
          +'<div id="spPager"></div>'
        +'</div><div id="spBulkWrap"></div>'
      +'</div>'
    +'</div>';
  S._spSel=S._spSel||{}; S._spFilters=S._spFilters||{};
  spColsSync_();          // bộ cột theo ngành hàng đang lọc (đèn / vệ sinh)
  S._spView=S._spView||'all';
  renderSpProjPanel_(); renderSpChips_(); spEditBtnSync_(); spUndoBtnSync_(); spColChips_(); spRenderHead_(); spFilter();
  spLoadPerm_().then(function(){ spEditBtnSync_(); spViewTabs_(); spFilter(); });
}
// LEFT: sản phẩm đã ghi danh vào dự án hiện tại (S.lines)
function renderSpProjPanel_(){
  var el=document.getElementById('spProjPanel'); if(!el) return;
  var head='<div class="spp-head"><span class="spp-ic">'+icon('layers',16)+'</span><h3>Sản phẩm trong dự án</h3>'
    +'<span class="spp-count">'+((S.cur?S.lines:[])||[]).length+'</span>'
    +(S.cur?dezonChip_(S.cur,'sm'):'')
    +'<button class="spp-hide" title="Thu gọn panel (mở rộng bảng)" onclick="spPanelToggle()">'+icon('left',14)+'</button></div>';
  // dropdown chọn/tạo dự án ngay trong panel (bám mockup)
  var projSel='<select class="spp-projsel" onchange="spSwitchProject(this.value)">'
    +'<option value="">— Chọn hoặc tạo dự án —</option>'
    +(S.projects||[]).map(function(p){ return '<option value="'+esc(p.maDA)+'"'+(S.cur&&S.cur.maDA===p.maDA?' selected':'')+'>'+esc(p.ten)+'</option>'; }).join('')
    +'<option value="__new__">＋ Tạo dự án mới…</option></select>';
  if(!S.cur){ el.innerHTML=head+projSel+'<div class="spp-empty">Chưa chọn dự án.<br>Chọn dự án ở trên để bắt đầu ghi danh sản phẩm.</div>'; return; }
  var lines=S.lines||[];
  var rows=lines.map(function(l){
    var im=imgSrc1_(l.hinhAnh);
    var sub=[l.kichThuoc,l.tang].map(function(x){return String(x||'').trim();}).filter(Boolean).join(' · ');
    return '<div class="spp-item">'
      +(im?'<img class="spp-img" src="'+esc(im)+'" onerror="this.style.visibility=\'hidden\'">':'<span class="spp-img"></span>')
      +'<div class="spp-info"><div class="spp-name" title="'+esc(l.ten||'')+'">'+esc(l.ten||'')+'</div>'+(sub?'<div class="spp-sub">'+esc(sub)+'</div>':'')+'</div>'
      +'<span class="spp-qty">×'+(Number(l.soLuong)||0)+'</span>'
      +'<button class="spp-del" title="Bỏ khỏi dự án" onclick="spRemoveFromProject(\''+l.lineId+'\')">✕</button>'
    +'</div>';
  }).join('')||'<div class="spp-empty">Chưa có sản phẩm.<br><b>Kéo sản phẩm</b> từ bảng bên phải thả vào đây,<br>hoặc bấm ＋ trên từng dòng.</div>';
  el.innerHTML=head+projSel+'<div class="spp-sub2">Danh sách sản phẩm tham gia dự án</div><div class="spp-list">'+rows+'</div>';
}
async function spSwitchProject(maDA){
  if(maDA==='__new__'){ if(typeof openCreate==='function') openCreate(); renderSpProjPanel_(); return; }
  if(!maDA){ return; }
  if(!await openProject_(maDA)) return;
  if(typeof renderProjSel==='function') renderProjSel();
  renderCard&&renderCard();
  try{ renderTree(); renderFloors(); renderTable(); }catch(e){}   // các tab khác lấy dữ liệu dự án mới
  renderSpProjPanel_(); renderSpChips_(); spFilter();
}
/* ===== Thu gọn / hiện panel "Sản phẩm trong dự án" ===== */
function spPanelHidden_(){ try{ return localStorage.getItem('qs_spPanelHide')==='1'; }catch(e){ return false; } }
function spPanelToggle(){
  var on=!spPanelHidden_();
  try{ localStorage.setItem('qs_spPanelHide', on?'1':'0'); }catch(e){}
  var ws=document.getElementById('spWorkspace');
  if(ws) ws.classList.toggle('panel-hidden', on);
  toast(on?'Đã thu gọn panel — bấm nút bên trái để hiện lại':'Đã hiện panel Sản phẩm trong dự án');
}

/* ===== Kéo–thả sản phẩm từ bảng vào panel "Sản phẩm trong dự án" ===== */
function spRowDragStart(e,i){
  var p=(S._spList||[])[i]; if(!p){ e.preventDefault(); return; }
  // Nếu dòng đang kéo NẰM TRONG nhóm đã tick -> kéo CẢ LÔ đã chọn
  var key=String(p.recordId||p.ma||''), sel=S._spSel||{};
  var list = sel[key] ? spSelProds_() : [p];
  if(!list.length) list=[p];
  S._spDragList=list; S._spDragProd=list[0];
  var many=list.length>1;
  try{
    e.dataTransfer.effectAllowed='copy';
    e.dataTransfer.setData('text/plain', many ? (list.length+' sản phẩm') : (p.ten||''));
    var img=p.hinhAnh?'<img src="'+esc(imgSrc1_(p.hinhAnh))+'" onerror="this.style.visibility=\'hidden\'">':'<span class="dg-img"></span>';
    var g=document.createElement('div'); g.className='drag-ghost'+(many?' multi':'');
    g.innerHTML=img
      +'<span class="dg-b"><span class="dg-nm">'+esc(many ? (list.length+' sản phẩm đã chọn') : (p.ten||''))+'</span>'
      +'<span class="dg-pr">'+(many ? ('Tổng '+money(list.reduce(function(a,x){return a+(Number(x.donGiaBan)||0);},0))+' đ') : (money(p.donGiaBan)+' đ'))+'</span></span>'
      +(many?'<span class="dg-badge">'+list.length+'</span>':'')
      +'<span class="dg-add">'+icon('plus',14)+'Thả vào dự án</span>';
    document.body.appendChild(g); S._spDragGhost=g;
    e.dataTransfer.setDragImage(g,24,28);
  }catch(x){}
  // mờ TẤT CẢ dòng đang kéo
  var keys={}; list.forEach(function(x){ keys[String(x.recordId||x.ma||'')]=1; });
  [].slice.call(document.querySelectorAll('#v-sanpham .sp-row')).forEach(function(tr,ri){
    var q=(S._spList||[])[ri]; if(q && keys[String(q.recordId||q.ma||'')]) tr.classList.add('dragging');
  });
  var panel=document.getElementById('spProjPanel'); if(panel) panel.classList.add('drop-ready');
}
function spRowDragEnd(){
  S._spDragProd=null; S._spDragList=null;
  if(S._spDragGhost){ try{ S._spDragGhost.remove(); }catch(x){} S._spDragGhost=null; }
  document.querySelectorAll('.sp-row.dragging').forEach(function(x){ x.classList.remove('dragging'); });
  var panel=document.getElementById('spProjPanel'); if(panel) panel.classList.remove('drop-ready','drop-over');
}
function spPanelDragOver(e){ if(!S._spDragProd) return; e.preventDefault();
  try{ e.dataTransfer.dropEffect='copy'; }catch(x){}
  var panel=document.getElementById('spProjPanel'); if(panel) panel.classList.add('drop-over'); }
function spPanelDragLeave(e){
  var panel=document.getElementById('spProjPanel');
  if(panel && (!e.relatedTarget || !panel.contains(e.relatedTarget))) panel.classList.remove('drop-over'); }
function spPanelDrop(e){
  e.preventDefault();
  var list=(S._spDragList&&S._spDragList.length)?S._spDragList.slice():(S._spDragProd?[S._spDragProd]:[]);
  spRowDragEnd();
  if(!list.length) return;
  if(!S.cur){ toast('Chưa chọn dự án — chọn dự án ở ô trên trước'); return; }
  spAddManyToProject_(list);
}
// Ghi danh NHIỀU sản phẩm vào dự án (dùng chung cho kéo-thả lô và nút trên thanh hàng loạt)
function spAddManyToProject_(list){
  if(!S.cur){ toast('Chưa chọn dự án'); return; }
  list.forEach(function(p){ addProdObj(p); });
  renderSpProjPanel_(); setTimeout(renderSpProjPanel_,800);
  toast(list.length>1 ? ('Đã thêm '+list.length+' sản phẩm vào "'+S.cur.ten+'"')
                      : ('Đã thêm "'+(list[0].ten||'')+'" vào dự án'));
}
// nút trên thanh hàng loạt
function spBulkToProject(){
  var list=spSelProds_(); if(!list.length) return;
  if(!S.cur){ toast('Chưa chọn dự án — chọn ở ô "Sản phẩm trong dự án" bên trái'); return; }
  spAddManyToProject_(list); S._spSel={}; spFilter();
}
async function spAddToProject(i){ var p=(S._spList||[])[i]; if(!p) return; if(!S.cur){ toast('Chưa chọn dự án'); return; }
  await addProdObj(p); renderSpProjPanel_(); setTimeout(renderSpProjPanel_,700); }
async function spRemoveFromProject(id){
  var l=(S.lines||[]).filter(function(x){ return x.lineId===id; })[0];
  if(!await xacNhan_('Bỏ "'+((l&&l.ten)||'sản phẩm này')+'" khỏi dự án '+((S.cur&&S.cur.ten)||'')+'? Dòng bóc tách của nó sẽ bị xoá.')) return;
  await delLine(id); renderSpProjPanel_(); }

// cột DB -> thuộc tính đã format sẵn trong object sản phẩm (hiển thị cho đẹp: "12W", "Ø100mm"…)
var COL2PROP={ thuong_hieu:'thuongHieu', nha_cung_cap:'ncc', hang_muc:'hangMuc', dong_sp:'dongSanPham',
  cong_suat_w:'congSuat', nhiet_do_mau_k:'nhietDo', goc_chieu_deg:'gocChieu', goc_nghieng_deg:'gocNghieng',
  mau_sac:'mauSac', chat_lieu:'chatLieu', chieu_cao_mm:'chieuCao', duong_kinh_mm:'duongKinh',
  cutout_mm:'loKhoet', chi_so_ip:'capBaoVe', cri:'cri', hieu_suat_lm_w:'hieuSuat', quang_thong_lm:'quangThong',
  ugr:'ugr', sdcm:'sdcm', coi:'coi', tuoi_tho:'tuoiTho', ten_chip_led:'tenChip', loai_chip_led:'chipLed',
  class_rating:'capBaoVeDien', lap_nguon_roi:'lapNguonRoi', ten_bo_nguon:'tenBoNguon', ma_bo_nguon:'maBoNguon',
  hang_bo_nguon:'hangBoNguon', vi_tri_lap_nguon:'viTriNguon', dieu_khien:'tuongThich', dong_ra_max_ma:'dongRa',
  bao_hanh_nam:'baoHanh', dvt:'dvt', link_datasheet:'linkDatasheet' };
var SP_NUMCOL={gia_ban_le:1, ck_dai_ly_pct:1, gia_ban_bo_nguon:1, quang_thong_lm:1, hieu_suat_lm_w:1, dong_ra_max_ma:1,
  bao_hanh_nam:1, chieu_cao_mm:1, duong_kinh_mm:1};
var SP_CTCOL={cong_suat_w:1, nhiet_do_mau_k:1, goc_chieu_deg:1, goc_nghieng_deg:1, cri:1, chi_so_ip:1,
  ugr:1, sdcm:1, coi:1, dvt:1, loai_chip_led:1, lap_nguon_roi:1, class_rating:1};
var SP_SFX={gia_ban_le:'đ', ck_dai_ly_pct:'%', gia_ban_bo_nguon:'đ'};      // đơn vị chỉ hiện cạnh ô, KHÔNG nằm trong giá trị
var SP_ALWAYS={gia_ban_le:1, ck_dai_ly_pct:1};       // 2 cột này sửa được cả khi CHƯA bật Edit
var SP_MONEY={gia_ban_le:1, gia_ban_bo_nguon:1};                         // ô tiền: hiện có dấu chấm 930.000, lưu số thuần
var SP_SKIP={'TÊN SẢN PHẨM':1,'MÃ SẢN PHẨM':1,'GIÁ ĐẠI LÝ':1,'ẢNH SẢN PHẨM':1};   // đã có cột đặc biệt lo
// Nhãn hiển thị RIÊNG trong bảng (form Nhập / modal Sửa vẫn giữ nhãn gốc)
var SP_COLLBL={trang_thai:'Trạng thái KD'};   // tránh trùng tên với cột "Trạng thái" (duyệt)

// giá trị HIỂN THỊ của 1 cột: ưu tiên bản đã format, không có thì lấy giá trị gốc
function spColVal_(p,col){
  var prop=COL2PROP[col];
  var v=(prop && p[prop]!=null && p[prop]!=='') ? p[prop] : (p.raw||{})[col];
  return v==null?'':String(v);
}
// giá trị đưa vào Ô NHẬP: ĐÚNG giá trị gốc trong DB (giống modal Sửa)
function spEditRaw_(p,col){ var r=p.raw||{}; return r[col]!=null?String(r[col]):spColVal_(p,col); }
function spDash_(v){ return v?esc(v):'<span class="muted">—</span>'; }

// Số SKU = số biến thể đang dùng CHUNG một mã sản phẩm (khác nhiệt độ màu / công suất / góc / màu)
var _skuMap=null;
function spSkuCount_(p){
  if(!_skuMap){ _skuMap={}; (S.products||[]).forEach(function(x){
    var k=String(x.ma||'').trim().toLowerCase(); if(k) _skuMap[k]=(_skuMap[k]||0)+1; }); }
  var k=String(p.ma||'').trim().toLowerCase();
  return k?(_skuMap[k]||1):1;
}
var _spColCache=null, _spColNganh=null;
/* Bảng Danh sách SP sinh cột từ bộ trường của NGÀNH đang xem:
   lọc hạng mục = Thiết bị vệ sinh -> cột của ngành vệ sinh; Thiết bị đèn -> cột đèn;
   chưa lọc -> gộp cả hai (cột của ngành kia vẫn tắt/rỗng, bật lại bằng chip cột). */
function spNganhCur_(){
  var nd=((S._spFilters||{}).node)||'';
  if(nd==='3.2.5') return 'vs';
  if(nd==='3.2.2') return 'son';
  if(nd==='3.2.6'||nd==='3.2.6.1') return 'den';
  return '';
}
function spColFlat_(){
  var ng=spNganhCur_();
  if(ng==='vs') return DB_FLAT_VS;
  if(ng==='son') return DB_FLAT_SON;
  if(ng==='den') return DB_FLAT;
  return DB_FLAT.concat(DB_FLAT_VS).concat(DB_FLAT_SON);
}
function spAllCols_(){
  if(spPTMode_()) return spPTCols_();
  var ng=spNganhCur_();
  if(_spColCache && _spColNganh===ng) return _spColCache;
  _spColNganh=ng;
  var head=[
    ['stt','STT','ct',function(p,i){
      var m=(S._rowMeta||[])[i];
      if(m&&m.no) return '<span class="sp-stt'+(m.k?' sub':'')+'">'+m.no+'</span>';   // con: 1.1 · 1.2…
      var per=spPerGet_(), tr=Math.max(1,S._spPage||1);
      return '<span class="sp-stt">'+((per?(tr-1)*per:0)+i+1)+'</span>'; }],
    ['thumb','Ảnh','thumbcol',function(p){ return p.hinhAnh?'<img class="sp-th" src="'+esc(imgSrc1_(p.hinhAnh))+'" onerror="this.style.visibility=\'hidden\'">':'<span class="sp-th"></span>'; }],
    ['ten','Sản phẩm','sp-name',function(p,i){ // mã 1 dòng riêng; nhãn Combo / Biến thể / màu nằm 1 hàng chip bên dưới (không chen vào dòng mã)
      var tags=(p.comboN?'<button class="sp-cbn sp-cbtog'+(spCbMo_(p)?' on':'')+'" title="Xem '+p.comboN+' sản phẩm đi kèm" onclick="event.stopPropagation();spComboToggle_('+i+')">'+icon('layers',11)+'Combo <b>'+p.comboN+'</b><span class="cbc">▸</span></button>':'')
        +spVarChip_(p)+spCbQty_(i);
      return '<b>'+esc(p.ten||'')+'</b><span class="sp-code">'+esc(p.ma||'')
        +(p.spChung?'<span class="sp-chung" title="Sản phẩm thuộc kho chung của Dezon — chỉ xem">Kho Dezon</span>':'')+'</span>'
        +(tags?'<span class="sp-tags">'+tags+'</span>':''); },
      {lark:'TÊN SẢN PHẨM', col:'ten_sp', sfx:''}],
    ['duyet','Trạng thái','ct',function(p){
      var on=!!p.daDuyet;
      return '<span class="spduyet'+(on?' on':'')+'" title="'+(on?'Duyệt bởi '+esc(p.nguoiDuyet||'?')+(p.ngayDuyet?' · '+fmtDateTime_(p.ngayDuyet):''):'Chưa được duyệt')+'">'
        +(on?'Đã duyệt':'Chưa duyệt')+'</span>'; }],
    ['sku','Số SKU','ct',function(p){ var n=spSkuCount_(p);
      return '<span class="sku-badge'+(n>1?' multi':'')+'" title="'+(n>1?n+' biến thể cùng mã '+esc(p.ma||''):'Chỉ 1 biến thể')+'">'+n+'</span>'; }]
  ];
  var tail=[
    ['giaDaiLy','Giá đại lý','num sp-price',function(p){ return money(p.donGiaBan)+'<span class="unit">đ</span>'; }],
    ['nguoiTao','Người tạo','',function(p){ return p.nguoiTao?'<span class="sp-who">'+esc(p.nguoiTao)+'</span>':'<span class="muted">—</span>'; }],
    ['ngayTao','Ngày tạo','ct',function(p){ return p.ngayTao?fmtDate(p.ngayTao):'<span class="muted">—</span>'; }],
    ['nguoiSua','Người sửa cuối','',function(p){
      return p.nguoiSua?'<span class="sp-who" title="Lúc '+esc(fmtDateTime_(p.ngayCapNhat))+'">'+esc(p.nguoiSua)+'</span>':'<span class="muted">—</span>'; }]
  ];
  var gen=[], daCo={};
  spColFlat_().forEach(function(f){
    if(daCo[f[0]]) return; daCo[f[0]]=1;
    var lark=f[0]; if(SP_SKIP[lark]) return;
    var col=DB_LABEL2COL_[lark]; if(!col) return;
    var e={lark:lark, col:col, sfx:SP_SFX[col]||'', num:!!SP_NUMCOL[col], money:!!SP_MONEY[col]};
    var cls=SP_NUMCOL[col]?'num':(SP_CTCOL[col]?'ct':'');
    gen.push([col, SP_COLLBL[col]||f[1], cls, function(p,i){
      if(SP_ALWAYS[col]) return spInp_(i,e,spEditRaw_(p,col),p);          // giá bán lẻ / chiết khấu: luôn sửa được
      var v=spColVal_(p,col);
      if(SP_MONEY[col]) return v===''?'<span class="muted">—</span>':(money(v)+'<span class="unit">đ</span>');
      if(col==='link_datasheet') return v?'<a href="'+esc(safeUrl_(v))+'" target="_blank" rel="noopener" onclick="event.stopPropagation()">Datasheet</a>':'<span class="muted">—</span>';
      return spDash_(v);
    }, e]);
  });
  _spColCache=head.concat(gen).concat(tail);
  return _spColCache;
}
/* ═══ CHẾ ĐỘ SỬA NHANH: bật nút Edit -> mọi cột nhập được thành ô input ═══ */
function spUnitRe_(u){ return new RegExp(u.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'$','i'); }
// "4000, 3000" -> "4000K, 3000K"  (chỉ dùng để cập nhật phần HIỂN THỊ sau khi lưu)
function spAddUnit_(v,u){ var t=String(v==null?'':v).trim(); if(!u||!t) return t; var re=spUnitRe_(u);
  return t.split(',').map(function(x){ x=x.trim(); return x?(re.test(x)?x:x+u):''; }).filter(Boolean).join(', '); }
// 1 ô nhập trong bảng
function spInp_(i,e,val,p){
  val=(val==null?'':String(val));
  if(e.money) val = val===''?'':money(val);        // 930000 -> 930.000
  if(p&&p.spChung) return '<span class="spin-wrap'+(e.num?'':' tx')+' ro" title="Sản phẩm kho chung — không sửa được">'
    +'<span class="spin-ro">'+esc(val)+'</span>'+(e.sfx?'<i>'+e.sfx+'</i>':'')+'</span>';
  return '<span class="spin-wrap'+(e.num?'':' tx')+'" onclick="event.stopPropagation()">'
    +'<input class="spin'+(e.num?'':' spin-tx')+'" value="'+esc(val)+'"'
    +' title="'+esc(val)+'" data-i="'+i+'" data-lark="'+esc(e.lark)+'" data-col="'+esc(e.col||'')+'" data-money="'+(e.money?1:0)+'" data-old="'+esc(val)+'"'
    +' onchange="spInlineSave(this)" onkeydown="if(event.key===\'Enter\')this.blur()">'
    +(e.sfx?'<i>'+e.sfx+'</i>':'')+'</span>';
}
// Cột "Sản phẩm" khi sửa = 2 ô: tên + mã
function spNameEdit_(p,i){
  return '<span class="spin-name" onclick="event.stopPropagation()">'
    +'<input class="spin spin-tx" title="'+esc(p.ten||'')+'" value="'+esc(p.ten||'')+'" data-i="'+i+'" data-lark="TÊN SẢN PHẨM" data-col="ten_sp" data-old="'+esc(p.ten||'')+'"'
    +' onchange="spInlineSave(this)" onkeydown="if(event.key===\'Enter\')this.blur()" placeholder="Tên sản phẩm">'
    +'<input class="spin spin-tx code" title="'+esc(p.ma||'')+'" value="'+esc(p.ma||'')+'" data-i="'+i+'" data-lark="MÃ SẢN PHẨM" data-col="ma_sp" data-old="'+esc(p.ma||'')+'"'
    +' onchange="spInlineSave(this)" onkeydown="if(event.key===\'Enter\')this.blur()" placeholder="Mã sản phẩm">'
    +'</span>';
}
// Ô của 1 cột khi ĐANG ở chế độ sửa (cột không nhập được thì vẽ như bình thường)
function spEditCell_(c,p,i){
  if(p&&p.spChung) return c[3](p,i);            // kho chung Dezon: chỉ xem
  if(c[0]==='ten') return spNameEdit_(p,i);
  var e=c[4]; if(!e) return c[3](p,i);          // Ảnh / Thông số / Giá đại lý: hiển thị
  return spInp_(i,e,spEditRaw_(p,e.col),p);
}
function spEditToggle(){
  S._spEdit=!S._spEdit;
  if(spPTMode_()){
    if(S._spEdit){ ptOrder2_(); S._ptColsOnBak=Object.assign({},S._ptColsOn||{});
      spPTCols_().forEach(function(c){ if(c[4]) S._ptColsOn[c[0]]=1; }); }
    else if(S._ptColsOnBak){ S._ptColsOn=S._ptColsOnBak; S._ptColsOnBak=null; }
    spEditBtnSync_(); spColChips_(); spRenderHead_(); spFilter();
    toast(S._spEdit?'Sửa nhanh: gõ đơn giá / thông số ngay trên bảng, rời ô là lưu (áp cho cả thư viện)':'Đã tắt chế độ sửa nhanh');
    return;
  }
  if(S._spEdit){
    S._spColsBak=Object.assign({},S._spCols||{});
    S._spCols=S._spCols||{}; S._spCols.thumb=1;
    spAllCols_().forEach(function(c){ if(c[4]) S._spCols[c[0]]=1; });   // hiện TẤT CẢ cột nhập được
  }else if(S._spColsBak){ S._spCols=S._spColsBak; S._spColsBak=null; }
  spEditBtnSync_(); spColChips_(); spRenderHead_(); spFilter();
  toast(S._spEdit?'Sửa nhanh: gõ thẳng vào ô, rời ô là tự lưu':'Đã tắt chế độ sửa nhanh');
}
/* ═══ QUYỀN SỬA / DUYỆT SẢN PHẨM ═══
   Trạng thái duyệt nằm TRÊN sản phẩm, không có bước "gửi duyệt":
   - Được sửa  -> sửa thẳng, sửa xong SP quay về Chưa duyệt
   - Được duyệt-> sửa thẳng + bấm Duyệt
   - Admin     -> cả hai                                                    */
function spCanEdit_(){ var p=S._spPerm; return p?!!p.edit:true; }
function spCanDuyet_(){ var p=S._spPerm; return p?!!p.duyet:true; }
async function spLoadPerm_(){
  try{ S._spPerm=await api('spMyPerms'); }catch(e){ S._spPerm={edit:true,duyet:true}; }
  spViewTabs_();
}
/* 3 khung nhìn = LỌC theo trạng thái duyệt của sản phẩm */
function spViewTabs_(){
  if(spPTMode_()) return spPTTabs_();
  var el=document.getElementById('spViewTabs'); if(!el) return;
  // Đếm trong ĐÚNG phạm vi hạng mục đang lọc — trước đây luôn đếm cả danh mục nên lọc
  // "Thiết bị vệ sinh" mà vẫn thấy "Chưa duyệt 688" của toàn bộ 691 SP.
  var cur=S._spView||'all', all=spScopeProducts_();
  var chua=all.filter(function(p){ return !p.daDuyet; }).length;
  var da=all.length-chua;
  var fav=all.filter(function(p){ return p.yeuThich; }).length;
  var hmLoc=(S._spFilters||{}).node;
  var tabs=[['all', hmLoc?('Tất cả · '+(nodeName(hmLoc)||hmLoc)):'Tất cả', all.length?String(all.length):''],
            ['chua','Chưa duyệt', chua?String(chua):''],
            ['da','Đã duyệt', da?String(da):''],
            ['fav','♥ Yêu thích', fav?String(fav):'']];
  el.innerHTML=tabs.map(function(t){
    return '<button class="spvt'+(cur===t[0]?' on':'')+(t[0]==='chua'?' warn':(t[0]==='fav'?' fav':''))+'" onclick="spSetView(\''+t[0]+'\')">'+esc(t[1])
      +(t[2]?'<span class="spvt-n">'+t[2]+'</span>':'')+'</button>';
  }).join('')
  +(spCanDuyet_()?'':'<span class="spvt-note">Bạn chỉ được sửa — sản phẩm sửa xong sẽ chờ người có quyền duyệt</span>');
}
/* ═══ SẢN PHẨM YÊU THÍCH ═══
   Kho SP hay dùng, giữ lại để lấy nhanh cho các dự án sau (yêu cầu slide Update QS).
   Dấu yêu thích thuộc về CÔNG TY, lưu ở bảng riêng sp_yeu_thich nên đánh dấu được
   cả sản phẩm trong kho chung của Dezon (những SP đó không sửa được). */
function spKey_(p){ return String((p&&(p.recordId||p.ma))||''); }
/* Nhóm API "làm hàng loạt" (duyệt · yêu thích · xoá công tác…) trả {ok, errors} chứ KHÔNG
   ném lỗi. Gọi xong mà không kiểm thì màn hình báo "đã xong" trong khi máy chủ không đổi
   được gì — hoặc ngược lại, coi "không có gì để đổi" là lỗi. Mọi nơi dùng chung hàm này. */
/* Lưu ngầm bị lỗi mà nuốt luôn thì người dùng tưởng đã lưu — mở lại mới biết mất.
   Báo gọn 1 lần cho mỗi đợt (sửa hàng loạt bắn nhiều request cùng lúc).          */
function luuLoi_(e, viec){
  var now=Date.now(); if(S._luuLoiAt && now-S._luuLoiAt<4000) return; S._luuLoiAt=now;
  try{ console.error('[lưu lỗi] '+viec, e); }catch(x){}
  toast('Chưa lưu được '+viec+': '+String((e&&e.message)||e||'').slice(0,80));
}
function batKq_(r, n, viec){
  if(r && r.errors && r.errors.length) throw new Error(String(r.errors[0].error||('Không '+viec+' được')));
  var ok=Number(r&&r.ok)||0, daDung=Number(r&&r.daDung)||0;
  if(n>0 && !ok && !daDung) throw new Error('Máy chủ không '+viec+' được dòng nào');
  return ok;
}
// server trả {ok, errors} chứ không ném lỗi -> phải tự kiểm để còn hoàn tác dấu sao
function spFavChk_(r){
  if(r && r.ok===0 && r.errors && r.errors.length) throw new Error(r.errors[0].error);
  return r;
}
function spFavSet_(keys,on){        // cập nhật ngay tại chỗ để bảng phản hồi tức thì
  var m={}; keys.forEach(function(k){ m[k]=1; });
  (S.products||[]).forEach(function(p){ if(m[spKey_(p)]) p.yeuThich=!!on; });
}
async function spFav(i,on){
  var p=(S._spList||[])[i]; if(!p) return;
  var k=spKey_(p); if(!k) return;
  spFavSet_([k],on); spViewTabs_(); spFilter();          // lạc quan: đổi trước, có lỗi thì trả lại
  try{ spFavChk_(await api('setYeuThich',[k],!!on)); }
  catch(e){ spFavSet_([k],!on); spViewTabs_(); spFilter(); toast(e.message); return; }
  toast(on?'Đã thêm vào sản phẩm yêu thích':'Đã bỏ khỏi sản phẩm yêu thích');
}
async function spFavBulk(on){
  var prods=spSelProds_(); if(!prods.length) return;
  var keys=prods.map(spKey_).filter(Boolean);
  spFavSet_(keys,on); spViewTabs_(); spFilter();
  try{ spFavChk_(await api('setYeuThich',keys,!!on)); }
  catch(e){ spFavSet_(keys,!on); spViewTabs_(); spFilter(); toast(e.message); return; }
  toast('Đã lưu '+keys.length+' sản phẩm vào Yêu thích');
}
/* ═══ MỞ COMBO NGAY TRÊN DÒNG (bảng Danh sách SP) ═══ dùng chung kho dữ liệu với thư viện Bóc tách */
function spCbMo_(p){ return !!(S._catCbOpen && S._catCbOpen[catCbKey_(p)]); }
async function spComboToggle_(i){
  var p=(S._spList||[])[i]; if(!p) return;
  var k=catCbKey_(p); if(!k) return;
  S._catCbOpen=S._catCbOpen||{}; S._catCb=S._catCb||{};
  var mo=!S._catCbOpen[k];
  if(mo) S._catCbOpen[k]=1; else delete S._catCbOpen[k];
  spFilter();
  if(mo && !S._catCb[k]){
    try{ S._catCb[k]=await api('getCombo',k)||[]; }catch(e){ S._catCb[k]=[]; }
    if(S._catCbOpen[k]) spFilter();
  }
}
/* Nút ★ cạnh Bộ lọc = LỌC ngay trong panel, chỉ hiện SP đã đánh sao.
   Bấm lần nữa để bỏ lọc. Dùng chung trạng thái với chip trong Bộ lọc. */
function favGoSync_(){
  var b=document.getElementById('favGoBtn'), n=document.getElementById('favGoN'); if(!b) return;
  var so=(S.products||[]).filter(function(p){ return p.yeuThich; }).length;
  if(n) n.textContent=so||'';
  b.classList.toggle('empty',!so);
  b.classList.toggle('on',!!S.fFav);
  b.title=S.fFav ? 'Đang lọc sản phẩm yêu thích — bấm để bỏ lọc'
        : (so?('Chỉ hiện '+so+' sản phẩm yêu thích'):'Chưa có sản phẩm yêu thích nào');
}
/* ═══ TẢI DANH SÁCH SẢN PHẨM RA EXCEL ═══
   Có tick dòng nào -> chỉ tải đúng những dòng đó; không tick -> tải toàn bộ
   (theo bộ lọc đang áp dụng, không phải chỉ trang đang xem).                 */
function spXlsSync_(){
  var l=document.getElementById('spXlsLbl'); if(!l) return;
  var n=Object.keys(S._spSel||{}).length;
  l.textContent = n ? ('Tải Excel ('+n+')') : 'Tải Excel';
  var b=document.getElementById('spXlsBtn');
  var dv=spPTMode_()?'công tác':'sản phẩm';
  if(b) b.title = n ? ('Tải '+n+' '+dv+' đã chọn ra Excel') : 'Tải toàn bộ danh sách đang lọc ra Excel';
}
async function spExportXlsx(){
  var btn=document.getElementById('spXlsBtn'), lbl=document.getElementById('spXlsLbl');
  var chon=Object.keys(S._spSel||{});
  var keys = chon.length ? chon : (S._spFull||[]).map(function(p){ return String(p.recordId||p.ma||''); }).filter(Boolean);
  if(!keys.length){ toast('Không có sản phẩm nào để tải'); return; }
  var cu=lbl?lbl.textContent:'';
  if(btn) btn.disabled=true; if(lbl) lbl.textContent='Đang tạo file…';
  try{
    var r=await fetch('/export/san-pham',{ method:'POST',
      headers:apiHeaders_(),
      body: JSON.stringify({ keys: keys }) });
    if(!r.ok){ var e=await r.json().catch(function(){return{};}); throw new Error(e.error||('HTTP '+r.status)); }
    var so=r.headers.get('X-Row-Count')||keys.length;
    var blob=await r.blob();
    var url=URL.createObjectURL(blob), a2=document.createElement('a');
    a2.href=url; a2.download='danh-sach-san-pham-'+new Date().toISOString().slice(0,10)+'.xlsx';
    document.body.appendChild(a2); a2.click(); a2.remove();
    setTimeout(function(){ URL.revokeObjectURL(url); },4000);
    toast('Đã tải '+so+' sản phẩm ra Excel');
  }catch(err){ toast('Lỗi tải Excel: '+err.message); }
  if(btn) btn.disabled=false; if(lbl) lbl.textContent=cu||'Tải Excel'; spXlsSync_();
}
function spSetView(v){ S._spView=v; S._spPage=1; spViewTabs_(); spFilter(); }
// Duyệt / bỏ duyệt 1 sản phẩm
/* Dòng đại diện của một NHÓM BIẾN THỂ (cùng mã, khác màu/kích thước) đứng cho cả nhóm:
   duyệt dòng đó phải duyệt CẢ NHÓM. Trước đây chỉ duyệt đúng 1 biến thể nên bảng vẫn hiện
   "Chưa duyệt" — bấm mấy lần cũng không thấy đổi. */
function spNhomBienThe_(p){
  var k=spVarKey_(p); if(!k) return [p];
  var ds=(S.products||[]).filter(function(x){ return spVarKey_(x)===k; });
  return ds.length?ds:[p];
}
async function spDuyet(i,approve){
  var p=(S._spList||[])[i]; if(!p) return;
  var nhom=spNhomBienThe_(p).filter(function(x){ return !x.spChung; });
  if(!nhom.length){ toast('Sản phẩm kho chung Dezon — không đổi được trạng thái duyệt'); return; }
  try{
    var r=await api('setSpDuyet', nhom.map(function(x){ return String(x.recordId||x.ma); }), !!approve);
    if(r && r.errors && r.errors.length){       // máy chủ nuốt lỗi từng dòng -> phải nói ra
      await baoLoi_({ title:'Không đổi được trạng thái duyệt', ok:'Đã hiểu',
        note:'Sản phẩm "'+(p.ten||p.ma)+'":\n'+String(r.errors[0].error||'').slice(0,160) });
      return;
    }
    if(!(r&&((Number(r.ok)||0)+(Number(r.daDung)||0)))){   // không lỗi mà cũng không đổi được dòng nào
      await baoLoi_({ title:'Không đổi được trạng thái duyệt', ok:'Đã hiểu',
        note:'Máy chủ không tìm thấy dòng nào để đổi cho sản phẩm "'+(p.ten||p.ma)+'". Thử tải lại trang rồi làm lại.' });
      return;
    }
    nhom.forEach(function(x){ x.daDuyet=!!approve; x.nguoiDuyet=approve?((S.me||{}).username||''):''; x.ngayDuyet=approve?new Date().toISOString():''; });
    spViewTabs_(); spFilter();
    toast((approve?'Đã duyệt "':'Đã bỏ duyệt "')+(p.ten||p.ma)+'"'+(nhom.length>1?(' · '+nhom.length+' biến thể'):''));
  }catch(e){ toast('Lỗi: '+e.message.slice(0,110)); }
}
// SP đã chọn, dòng đại diện của nhóm biến thể = cả nhóm (Duyệt + Sửa hàng loạt dùng chung)
function spSelNhom_(){ var ds=[], da={};
  spSelProds_().forEach(function(p){ spNhomBienThe_(p).forEach(function(x){
    var k=String(x.recordId||x.ma||''); if(k && !da[k]){ da[k]=1; ds.push(x); } }); });
  return ds; }
// Duyệt hàng loạt các sản phẩm đang chọn
async function spDuyetBulk(approve){
  var prods=spSelNhom_().filter(function(p){ return !p.spChung; });
  if(!prods.length){ toast('Chưa chọn sản phẩm nào'); return; }
  try{
    var r=await api('setSpDuyet',prods.map(function(p){ return String(p.recordId||p.ma); }),!!approve);
    prods.forEach(function(p){ p.daDuyet=!!approve; });
    S.products=await api('getProducts')||S.products;
    spViewTabs_(); spFilter();
    if(r && r.errors && r.errors.length){
      await baoLoi_({ title:(r.errors.length)+' sản phẩm không đổi được trạng thái', ok:'Đã hiểu',
        note:(approve?'Đã duyệt ':'Đã bỏ duyệt ')+(r.ok||0)+' sản phẩm. Các sản phẩm dưới đây thì không:',
        dong:r.errors.map(function(e){ return e.key+' — '+e.error; }) });
    } else toast((approve?'Đã duyệt ':'Đã bỏ duyệt ')+(r.ok||0)+' sản phẩm'
      +((r.ok===0)?' (các sản phẩm chọn đã ở đúng trạng thái)':''));
  }catch(e){ toast('Lỗi: '+e.message.slice(0,110)); }
}
function spEditBtnSync_(){
  var b=document.getElementById('spEditBtn'); if(!b) return;
  b.style.display = (spPTMode_()||spCanEdit_())?'':'none';
  b.classList.toggle('on',!!S._spEdit);
  b.innerHTML = S._spEdit ? (icon('check',14)+' Xong') : (icon('edit',14)+' Edit');
  b.title = S._spEdit ? 'Tắt chế độ sửa nhanh' : 'Sửa nhanh ngay trên bảng — hiện tất cả cột nhập liệu';
}
/* ═══ HOÀN TÁC (Ctrl+Z) ═══
   Mỗi thao tác SỬA đẩy 1 mục vào kho; 1 mục có thể gồm NHIỀU ô (sửa hàng loạt)
   nên bấm Ctrl+Z một lần là trả lại toàn bộ thao tác đó.
   Lưu ý: XOÁ sản phẩm KHÔNG hoàn tác được (đã có hộp xác nhận riêng).        */
function spUndoPush_(changes,label){
  if(!changes||!changes.length) return;
  S._undo=S._undo||[]; S._undo.push({items:changes,label:label||'sửa'});
  if(S._undo.length>50) S._undo.shift();
  spUndoBtnSync_();
}
function spUndoBtnSync_(){
  var b=document.getElementById('spUndoBtn'); if(!b) return;
  var n=(S._undo||[]).length;
  b.disabled=!n;
  b.title=n?('Hoàn tác: '+S._undo[n-1].label+' (Ctrl+Z) — còn '+n+' bước'):'Chưa có thao tác nào để hoàn tác';
}
async function spUndo_(){
  var st=S._undo||[];
  if(!st.length){ toast('Không còn thao tác nào để hoàn tác'); return; }
  var step=st.pop(); spUndoBtnSync_();
  var ok=0, err='';
  for(var i=0;i<step.items.length;i++){
    var it=step.items[i];
    try{
      var d={}; if(it.lark!=='MÃ SẢN PHẨM') d['MÃ SẢN PHẨM']=it.ma;
      d[it.lark]=it.old;
      await api('updateDbProductTracked', String(it.key), d);
      var p=(S.products||[]).filter(function(x){ return String(x.recordId||x.ma||'')===String(it.key); })[0];
      if(p) spPatchLocal_(p, it.lark, it.col, it.old);
      ok++;
    }catch(e){ if(!err) err=e.message; }
  }
  spFilter();
  if(ok && !err) toast('↶ Đã hoàn tác: '+step.label);
  else if(ok) toast('Hoàn tác '+ok+'/'+step.items.length+' — lỗi: '+err.slice(0,70));
  else { st.push(step); spUndoBtnSync_(); toast('Không hoàn tác được: '+err.slice(0,90)); }
}
// Ctrl+Z / Cmd+Z — chỉ bắt khi KHÔNG đang gõ trong ô nhập (để trình duyệt lo undo chữ)
document.addEventListener('keydown', function(e){
  if(!(e.key==='z'||e.key==='Z') || !(e.ctrlKey||e.metaKey) || e.shiftKey) return;
  var v=document.getElementById('v-sanpham'); if(!v||!v.classList.contains('on')) return;
  var a=document.activeElement, tag=a?a.tagName:'';
  if(tag==='INPUT'||tag==='TEXTAREA'||tag==='SELECT'||(a&&a.isContentEditable)) return;
  e.preventDefault(); spUndo_();
});
async function spInlineSave(el){
  var i=+el.getAttribute('data-i'), lark=el.getAttribute('data-lark'), col=el.getAttribute('data-col')||'';
  var p=(S._spList||[])[i]; if(!p) return;
  var isMoney=el.getAttribute('data-money')==='1';
  var v=String(el.value).trim();
  if(isMoney) v=v.replace(/[^\d]/g,'');                                  // "930.000 đ" -> "930000"
  var shown=isMoney?(v===''?'':money(v)):v;
  var old=el.getAttribute('data-old');
  if(old!=null && old===shown){ if(isMoney) el.value=shown; return; }     // không đổi thì khỏi gọi server
  var oldRaw=(col && p.raw && p.raw[col]!=null) ? String(p.raw[col]) : (isMoney?String(old||'').replace(/[^\d]/g,''):String(old||''));
  el.classList.remove('err','ok'); el.classList.add('saving');
  var d={};
  if(lark!=='MÃ SẢN PHẨM') d['MÃ SẢN PHẨM']=p.ma;                        // khoá tra cứu, trừ khi đang sửa chính nó
  d[lark]=v;                                                             // ghi ĐÚNG giá trị gốc người dùng gõ
  try{
    var res=await api('updateDbProductTracked', String(p.recordId||p.ma), d);
    el.classList.remove('saving');
    if(res && res.updated===false){            // máy chủ không ghi gì -> KHÔNG báo xanh như đã lưu
      el.classList.add('err');
      el.value=String(old==null?'':old);
      toast('Máy chủ báo không có gì thay đổi nên chưa lưu. Tải lại trang (Ctrl/⌘+Shift+R) rồi thử lại — nếu vẫn vậy, báo lại để kiểm tra bản ghi.');
      return;
    }
    el.classList.add('ok');

    spUndoPush_([{key:String(p.recordId||p.ma), ma:p.ma, lark:lark, col:col, old:oldRaw}],
      lark+' của "'+(p.ten||p.ma||'')+'"');
    el.setAttribute('data-old', shown); if(isMoney) el.value=shown;
    spPatchLocal_(p, lark, col, v);
    if(res && res.daDuyet===false && p.daDuyet){    // sửa nội dung -> phải duyệt lại
      p.daDuyet=false; p.nguoiDuyet=''; p.ngayDuyet='';
      spViewTabs_();
    }
    spSyncRow_(el, p);
    setTimeout(function(){ el.classList.remove('ok'); }, 1300);
  }catch(e){
    el.classList.remove('saving'); el.classList.add('err');
    toast('Lỗi lưu: '+e.message.slice(0,110));
  }
}
// Cập nhật object sản phẩm trong bộ nhớ (S._spList dùng CHUNG tham chiếu với S.products)
var SP_DISPUNIT={cong_suat_w:'W', nhiet_do_mau_k:'K', goc_chieu_deg:'°', goc_nghieng_deg:'°'};
function spPatchLocal_(p,lark,col,v){
  if(col){ p.raw=p.raw||{}; p.raw[col]=v; }
  var prop=COL2PROP[col];
  if(prop) p[prop]=SP_DISPUNIT[col]?spAddUnit_(v,SP_DISPUNIT[col]):v;
  if(col==='ten_sp') p.ten=v;
  else if(col==='ma_sp') p.ma=v;
  else if(col==='gia_ban_le') p.giaBanLe=tkNum_(v);
  else if(col==='ck_dai_ly_pct') p.ckDaiLy=tkNum_(v);
  // GIÁ ĐẠI LÝ là cột generated trong DB: round(giá bán lẻ × (1 − CK/100)) — tính lại y hệt để hiện ngay
  p.donGiaBan=Math.round((Number(p.giaBanLe)||0)*(1-(Number(p.ckDaiLy)||0)/100));
  p.donGiaVon=p.donGiaBan;
}
// Vẽ lại các ô CHỈ ĐỌC của đúng dòng vừa sửa — giữ nguyên con trỏ đang gõ
function spSyncRow_(el,p){
  var tr=el.closest('tr'); if(!tr) return;
  var i=+el.getAttribute('data-i');
  spVisCols_().forEach(function(c,k){
    if(c[0]!=='giaDaiLy' && c[0]!=='duyet') return;   // 2 cột này phụ thuộc ô vừa sửa
    var td=tr.children[k+1]; if(td) td.innerHTML=c[3](p,i);   // +1: bỏ qua cột chọn
  });
}
/* Đóng băng kiểu Excel: cột chọn + 2 cột đầu bám trái, hàng tiêu đề bám trên.
   Bề rộng cột thay đổi theo dữ liệu nên phải ĐO rồi gán left sau mỗi lần vẽ.  */
var SP_FRZ=3;                       // số CỘT DỮ LIỆU được cố định (chưa kể cột chọn) — STT · Ảnh · Sản phẩm
/* Bảng LUÔN vừa khít màn hình: đáy thẻ = đáy cửa sổ (bảng cuộn bên trong, trang không cuộn) — như Bóc tách */
function spCaoFit_(){
  var w=document.querySelector('#v-sanpham .sp-card .tbl-wrap'); if(!w||!w.offsetParent) return;
  if(window.innerWidth<=900){ w.style.height=''; return; }            // màn hẹp: để trang cuộn tự nhiên
  var zf=btZf_(w), card=w.closest('.sp-card'), duoi=0;
  if(!card._caoRO && window.ResizeObserver){ card._caoRO=1;          // bung / gập hàng chip cột, toolbar xuống dòng -> tính lại
    var ro=new ResizeObserver(function(){ clearTimeout(spCaoFit_._t); spCaoFit_._t=setTimeout(spCaoFit_,60); });
    [card.querySelector('.sp-toolbar'), document.getElementById('spColBar'), document.getElementById('spPager')].forEach(function(e){ if(e) ro.observe(e); }); }
  for(var e=w.nextElementSibling; e; e=e.nextElementSibling) duoi+=e.offsetHeight+(parseFloat(getComputedStyle(e).marginTop)||0)+(parseFloat(getComputedStyle(e).marginBottom)||0);
  var h=Math.max(220, Math.floor((window.innerHeight-w.getBoundingClientRect().top)/zf-duoi-10));
  w.style.height=h+'px'; w.style.maxHeight='none';
  var pn=document.getElementById('spProjPanel');
  if(pn&&pn.offsetParent&&card){ var hp=Math.floor((window.innerHeight-pn.getBoundingClientRect().top)/zf-10); pn.style.height=hp+'px'; pn.style.maxHeight='none'; }
}
function spFreeze_(){
  spCaoFit_();
  var head=document.getElementById('spHead'), body=document.getElementById('spBody');
  if(!head||!body) return;
  var hr=head.querySelector('tr'); if(!hr) return;
  var n=Math.min(SP_FRZ+1, hr.children.length);          // +1: cột chọn
  var left=0, offs=[];
  for(var k=0;k<n;k++){ offs.push(left); left+=hr.children[k].getBoundingClientRect().width; }
  var rows=[hr].concat([].slice.call(body.rows));
  rows.forEach(function(tr){
    if(tr.children.length<n) return;                     // dòng "không có sản phẩm" (colspan)
    for(var k=0;k<n;k++){
      var c=tr.children[k];
      c.classList.add('frz'); c.style.left=offs[k]+'px';
      c.classList.toggle('frz-last', k===n-1);
    }
  });
  var wrap=body.closest('.tbl-wrap');
  if(wrap && !wrap._frzBound){                            // đổ bóng khi đã cuộn ngang
    wrap._frzBound=1;
    wrap.addEventListener('scroll',function(){
      wrap.classList.toggle('xscroll', wrap.scrollLeft>0);      // đã cuộn ngang -> đổ bóng cột đóng băng
      wrap.classList.toggle('yscroll', wrap.scrollTop>0);       // đã cuộn dọc  -> đổ bóng dưới tiêu đề
    },{passive:true});
  }
  if(!spFreeze_._rs){                                     // bảng vẽ lại mỗi lần vào tab -> chỉ gắn resize MỘT lần
    spFreeze_._rs=1;
    window.addEventListener('resize',function(){ clearTimeout(spFreeze_._t); spFreeze_._t=setTimeout(spFreeze_,120); });
  }
}
/* ═══ PHÂN TRANG ═══ */
var SP_PER=[25,50,100,200,0];                       // 0 = xem tất cả
function spPerGet_(){
  if(S._spPer===undefined){ var v=null; try{ v=localStorage.getItem('qs_spPer'); }catch(e){}
    S._spPer = (v===null||v==='') ? 50 : Number(v); }
  return S._spPer;
}
function spSetPer(v){ S._spPer=Number(v); try{ localStorage.setItem('qs_spPer',String(S._spPer)); }catch(e){}
  S._spPage=1; spFilter(); }
function spGoPage(n){ S._spPage=n; spFilter();
  var w=document.querySelector('.sp-card .tbl-wrap'); if(w) w.scrollTop=0; }
function spPageNums_(cur,pages){
  var out=[], add=function(x){ if(out[out.length-1]!==x) out.push(x); };
  add(1);
  for(var i=cur-2;i<=cur+2;i++) if(i>1&&i<pages) { if(i>2&&out[out.length-1]===1&&i-1>1) add('…'); add(i); }
  if(pages>1){ if(out[out.length-1]!=='…' && out[out.length-1]<pages-1) add('…'); add(pages); }
  return out;
}
/* total = số DÒNG đại diện (mỗi nhóm biến thể chỉ 1 dòng) — phân trang đếm theo đây;
   totalSP = tổng số sản phẩm thật, để câu "…/ N sản phẩm" vẫn đúng.                    */
function spPager_(total,cur,pages,per,totalSP){
  var el=document.getElementById('spPager'); if(!el) return;
  var from=total?((cur-1)*(per||total)+1):0, to=per?Math.min(total,cur*per):total;
  var sel='<select class="sppg-per" onchange="spSetPer(this.value)">'+SP_PER.map(function(v){
    return '<option value="'+v+'"'+(v===per?' selected':'')+'>'+(v?v+' SP/trang':'Tất cả')+'</option>'; }).join('')+'</select>';
  var nav='';
  if(pages>1){
    nav='<button class="sppg-b" '+(cur<=1?'disabled':'')+' onclick="spGoPage('+(cur-1)+')" title="Trang trước">'+icon('left',14)+'</button>'
      + spPageNums_(cur,pages).map(function(n){
          return n==='…' ? '<span class="sppg-dots">…</span>'
            : '<button class="sppg-n'+(n===cur?' on':'')+'" onclick="spGoPage('+n+')">'+n+'</button>'; }).join('')
      + '<button class="sppg-b" '+(cur>=pages?'disabled':'')+' onclick="spGoPage('+(cur+1)+')" title="Trang sau">'
        +'<svg class="ico" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18l6-6-6-6"/></svg></button>';
  }
  var nSP=(totalSP==null?total:totalSP);
  var info=(nSP===total)?(total+' sản phẩm'):(total+' dòng · '+nSP+' sản phẩm');
  el.innerHTML='<div class="sppg"><span class="sppg-info">'+(total?('Hiện <b>'+from+'–'+to+'</b> / '+info):'Không có sản phẩm')+'</span>'
    +'<span class="sppg-nav">'+nav+'</span>'+sel+'</div>';
}
/* ═══ THỨ TỰ + ĐỘ RỘNG CỘT (kéo giãn, kéo đổi chỗ — giống bảng Bóc tách) ═══ */
var SP_DEFW={stt:52,thumb:56,ten:215,duyet:124,sku:78,giaDaiLy:122,nguoiTao:126,ngayTao:104,nguoiSua:130,gia_ban_bo_nguon:130,
  thuong_hieu:126,nha_cung_cap:170,hang_muc:130,dong_sp:130,nhom_sp:130,
  gia_ban_le:118,ck_dai_ly_pct:106,cong_suat_w:96,nhiet_do_mau_k:112,goc_chieu_deg:96,
  goc_nghieng_deg:106,mau_sac:106,chat_lieu:126,chieu_cao_mm:98,duong_kinh_mm:104,
  quang_thong_lm:110,chi_so_ip:98,cri:88,hieu_suat_lm_w:126,ugr:80,sdcm:80,coi:80,
  tuoi_tho:104,ten_chip_led:126,loai_chip_led:110,lap_nguon_roi:108,ten_bo_nguon:134,
  ma_bo_nguon:120,hang_bo_nguon:134,vi_tri_lap_nguon:134,dieu_khien:140,
  dong_ra_max_ma:116,cutout_mm:134,class_rating:116,bao_hanh_nam:104,dvt:88,
  trang_thai:126,link_datasheet:112,ghi_chu:170};
function spColW_(k){ if(spPTMode_()) return (S._ptW2&&S._ptW2[k])||PT_SPDEFW[k]||124;
  return (S._spW&&S._spW[k])||SP_DEFW[k]||124; }
/* Bộ cột hiện mặc định theo NGÀNH: đèn thì công suất/nhiệt độ/CRI/góc chiếu,
   vệ sinh thì kích thước/hệ thống xả/lượng nước xả/màu — và nhớ riêng cho từng ngành. */
function spColsDefault_(ng){
  var b={thumb:1,ten:1,duyet:1,sku:1,thuong_hieu:1,hang_muc:1,giaDaiLy:1};
  if(ng==='vs'){ b.kich_thuoc=1; b.mau_sac=1; b.kieu_lap_dat=1; b.he_thong_xa=1; return b; }
  if(ng==='son'){ b.mau_sac=1; b.be_mat=1; b.do_phu=1; b.kich_thuoc=1; return b; }      // sơn nước: không có công suất / K / CRI
  b.cong_suat_w=1; b.nhiet_do_mau_k=1; b.cri=1; b.goc_chieu_deg=1; return b;
}
function spColsSync_(){
  if(spPTMode_()) return;
  var ng=spNganhCur_(); if(ng!=='vs'&&ng!=='son') ng='den';     // mỗi ngành 1 bộ cột riêng
  if(S._spColsNganh===ng && S._spCols) return;
  S._spColsNganh=ng;
  var luu=null;
  try{ var j=JSON.parse(localStorage.getItem('qs_spcolcfg')||'{}'); luu=(ng==='vs')?j.onVs:(ng==='son'?j.onSon:j.on); }catch(e){}
  S._spCols=(luu&&Object.keys(luu).length)?luu:spColsDefault_(ng);
}
function spOrder_(){
  if(spPTMode_()) return ptOrder2_();
  spColsSync_();
  var all=spAllCols_().map(function(c){ return c[0]; });
  if(!S._spOrder){
    try{ var j=JSON.parse(localStorage.getItem('qs_spcolcfg')||'{}'); S._spOrder=j.order||null; S._spW=j.w||{}; }
    catch(e){ S._spW={}; }
    if(!S._spOrder) S._spOrder=all.slice();
  }
  var co={}; S._spOrder.forEach(function(k){ co[k]=1; });
  // Cột mới nối vào cuối, RIÊNG stt phải nằm đầu bảng — người dùng đã lưu thứ tự cột
  // từ trước (chưa có stt) nên nếu cứ nối đuôi thì số thứ tự rơi ra tận cột cuối.
  all.forEach(function(k){ if(!co[k]){ if(k==='stt') S._spOrder.unshift(k); else S._spOrder.push(k); } });
  S._spOrder=S._spOrder.filter(function(k){ return all.indexOf(k)>=0; }); // bỏ cột đã xoá
  return S._spOrder;
}
function spSaveCols_(){
  try{
    if(spPTMode_()) localStorage.setItem('qs_ptcolcfg',JSON.stringify({order:S._ptOrder2,w:S._ptW2||{},on:(S._spEdit&&S._ptColsOnBak)||S._ptColsOn||{}}));
    else {
      var j={}; try{ j=JSON.parse(localStorage.getItem('qs_spcolcfg')||'{}')||{}; }catch(e2){}
      j.order=S._spOrder; j.w=S._spW||{};
      var on=(S._spEdit&&S._spColsBak)||S._spCols||{};   // đang Edit (bật hết cột) -> lưu bộ cột thật của người dùng
      if(S._spColsNganh==='vs') j.onVs=on; else if(S._spColsNganh==='son') j.onSon=on; else j.on=on;
      localStorage.setItem('qs_spcolcfg',JSON.stringify(j));
    }
  }catch(e){}
}
// thứ tự + độ rộng + cột hiện của BẢNG CÔNG TÁC (lưu riêng, không đụng cấu hình cột SP)
function ptOrder2_(){
  var all=spPTCols_().map(function(c){ return c[0]; });
  if(!S._ptOrder2){
    var j=null; try{ j=JSON.parse(localStorage.getItem('qs_ptcolcfg')||'null'); }catch(e){}
    S._ptOrder2=(j&&j.order)||null; S._ptW2=(j&&j.w)||{}; S._ptColsOn=(j&&j.on)||null;
    if(!S._ptOrder2) S._ptOrder2=all.slice();
    if(!S._ptColsOn){ S._ptColsOn={}; ['thumb','duyet','loai','nhom','dvt','kl','dgnt','dg','gc'].forEach(function(k){ S._ptColsOn[k]=1; }); }
  }
  var co={}; S._ptOrder2.forEach(function(k){ co[k]=1; });
  all.forEach(function(k){ if(!co[k]){ if(k==='stt') S._ptOrder2.unshift(k); else S._ptOrder2.push(k); } });
  S._ptOrder2=S._ptOrder2.filter(function(k){ return all.indexOf(k)>=0; });
  return S._ptOrder2;
}
function spResetCols_(){
  if(spPTMode_()){ S._ptOrder2=null; S._ptW2={}; S._ptColsOn=null; try{ localStorage.removeItem('qs_ptcolcfg'); }catch(e){}
    ptOrder2_(); spColChips_(); spRenderHead_(); spFilter(); toast('Đã đặt lại cột bảng công tác'); return; }
  S._spOrder=null; S._spW={}; S._spCols=null; S._spColsNganh=null;
  try{ localStorage.removeItem('qs_spcolcfg'); }catch(e){}
  spColsSync_();
  spOrder_(); spColChips_(); spRenderHead_(); spFilter(); toast('Đã đặt lại cột bảng sản phẩm'); }
/* Nội dung dài hơn bề rộng cột -> khi bấm vào ô, ô tự nới rộng đè lên cột bên cạnh
   để đọc và sửa trọn vẹn; rời ô là thu lại như cũ.                              */
function spInpFocus_(e){
  var el=e.target; if(!el.classList||!el.classList.contains('spin')) return;
  if(el.scrollWidth<=el.clientWidth+2) return;              // nội dung đã vừa ô
  var td=el.closest('td'); if(!td) return;
  td._ovf=td.style.overflow; td._pos=td.style.position; td._z=td.style.zIndex;
  td.style.overflow='visible'; td.style.position='relative'; td.style.zIndex='12';
  el.classList.add('spin-wide');
  el.style.width=Math.min(el.scrollWidth+28, 460)+'px';
}
function spInpBlur_(e){
  var el=e.target; if(!el.classList||!el.classList.contains('spin')) return;
  el.classList.remove('spin-wide'); el.style.width='';
  var td=el.closest('td'); if(!td) return;
  td.style.overflow=td._ovf||''; td.style.position=td._pos||''; td.style.zIndex=td._z||'';
}
function spMoveCol_(from,to,before){
  var o=spOrder_().slice(), fi=o.indexOf(from); if(fi<0) return;
  o.splice(fi,1); var ti=o.indexOf(to); if(ti<0) ti=o.length;
  o.splice(before?ti:ti+1,0,from);
  if(spPTMode_()) S._ptOrder2=o; else S._spOrder=o;
  spSaveCols_(); spColChips_(); spRenderHead_(); spFilter();
}
// gắn 1 lần: kéo tiêu đề để đổi chỗ, kéo mép phải để giãn cột
function spInitCols_(){
  var t=document.querySelector('.sp-card .sp-table'); if(!t||t._colInit) return; t._colInit=1;
  t.addEventListener('focusin',spInpFocus_); t.addEventListener('focusout',spInpBlur_);
  var clr=function(){ t.querySelectorAll('.dropL,.dropR').forEach(function(x){ x.classList.remove('dropL','dropR'); }); };
  t.addEventListener('dragstart',function(e){
    var th=e.target.closest('th.spth'); if(!th) return;
    if(e.target.closest('.spthrsz')){ e.preventDefault(); return; }
    S._spDragCol=th.dataset.k; th.classList.add('dragging');
    try{ e.dataTransfer.setData('text/plain',th.dataset.k); }catch(x){}
  });
  t.addEventListener('dragend',function(){ t.querySelectorAll('.dragging').forEach(function(x){ x.classList.remove('dragging'); }); clr(); S._spDragCol=null; });
  t.addEventListener('dragover',function(e){
    if(!S._spDragCol) return;
    var th=e.target.closest('th.spth'); if(!th) return;
    e.preventDefault(); clr();
    var r=th.getBoundingClientRect(); th.classList.add(e.clientX<r.left+r.width/2?'dropL':'dropR');
  });
  t.addEventListener('drop',function(e){
    if(!S._spDragCol) return; e.preventDefault();
    var th=e.target.closest('th.spth');
    if(th && th.dataset.k!==S._spDragCol){ var r=th.getBoundingClientRect(); spMoveCol_(S._spDragCol,th.dataset.k,e.clientX<r.left+r.width/2); }
    S._spDragCol=null; clr();
  });
  t.addEventListener('mousedown',function(e){
    var rs=e.target.closest('.spthrsz'); if(!rs) return;
    e.preventDefault(); e.stopPropagation();
    var k=rs.dataset.k, sx=e.clientX, sw=spColW_(k);
    document.body.classList.add('col-resizing');
    function mv(ev){ var w=Math.max(56, sw+(ev.clientX-sx));
      if(spPTMode_()){ S._ptW2=S._ptW2||{}; S._ptW2[k]=w; } else { S._spW=S._spW||{}; S._spW[k]=w; }
      spRenderHead_(); spFreeze_(); }
    function up(){ document.removeEventListener('mousemove',mv); document.removeEventListener('mouseup',up);
      document.body.classList.remove('col-resizing'); spSaveCols_(); }
    document.addEventListener('mousemove',mv); document.addEventListener('mouseup',up);
  });
}
function spColOn_(k){
  if(k==='ten'||k==='stt') return true;
  if(spPTMode_()){ ptOrder2_(); return !!(S._ptColsOn&&S._ptColsOn[k]); }
  return !!(S._spCols&&S._spCols[k]);
}
function spThCls_(c){ var cl=c[2]||''; if(cl.indexOf('num')>=0)return 'num'; if(cl.indexOf('ct')>=0)return 'ct'; if(cl.indexOf('thumbcol')>=0)return 'thumbcol'; return ''; }
function spVisCols_(){
  var by={}; spAllCols_().forEach(function(c){ by[c[0]]=c; });
  return spOrder_().map(function(k){ return by[k]; }).filter(function(c){ return c && spColOn_(c[0]); });
}
function spColToggle(k){
  if(k==='ten'||k==='stt') return;
  if(spPTMode_()){ ptOrder2_(); S._ptColsOn[k]=!S._ptColsOn[k]; }
  else { S._spCols=S._spCols||{}; S._spCols[k]=!S._spCols[k]; }
  spSaveCols_();                       // cả 2 hạng mục đều nhớ cột đang bật/tắt
  spColChips_(); spRenderHead_(); spFilter();
}
/* Chọn cột: gom vào 1 nút + bảng chọn thả xuống (trước đây trải 3 hàng chip
   chiếm gần hết phần đầu bảng và át cả dữ liệu).                            */
function spColList_(){
  var by={}; spAllCols_().forEach(function(c){ by[c[0]]=c; });
  return spOrder_().map(function(k){ return by[k]; }).filter(Boolean);
}
function spColChips_(){
  var cols=spColList_(), on=cols.filter(function(c){ return spColOn_(c[0]); }).length;
  var bar=document.getElementById('spColBar');
  // cùng kiểu Chi phí / Dự án: Cột hiển thị n/N (thu gọn) · Chọn nhanh / Của tôi ▾ · Hiện tất cả · Cột cơ bản
  if(bar) bar.innerHTML='<div class="tk-frame-hr">'
      +'<button class="tk-frame-h fold-h" onclick="foldToggle_(\'cols\')" title="Ẩn / hiện các chip cột">Cột hiển thị <b>'+on+'/'+cols.length+'</b><i class="fold-ic"></i></button>'
      +csQuickBtn_('sp','spPresetBtn')
      +'<button class="pg-q" onclick="spColAll_(1)">Hiện tất cả</button><button class="pg-q" onclick="spColCoBan_()">Cột cơ bản</button></div>'
    +'<div class="colchips sp-colchips">'+cols.filter(function(c){ return c[0]!=='stt'&&c[0]!=='ten'; })
    .map(function(c){ return '<span class="chip'+(spColOn_(c[0])?' on':'')+'" onclick="spColToggle(\''+c[0]+'\')">'+esc(c[1])+'</span>'; }).join('')+'</div>';
  var n=document.getElementById('spColN'); if(n) n.textContent=on+'/'+cols.length;
  if(document.getElementById('spColPop')) spColPopRender_();
}
function spColPop_(e){
  if(e&&e.stopPropagation) e.stopPropagation();
  var old=document.getElementById('spColPop');
  if(old){ old.remove(); document.removeEventListener('mousedown',spColOutside_); return; }
  var pop=document.createElement('div'); pop.className='fltpop colpop'; pop.id='spColPop';
  document.body.appendChild(pop); spColPopRender_();
  var btn=document.getElementById('spColBtn');
  if(btn){ var r=btn.getBoundingClientRect(), w=pop.offsetWidth||300;
    pop.style.top=(r.bottom+6)+'px';
    pop.style.left=Math.max(8,Math.min(r.left, window.innerWidth-w-10))+'px'; }
  setTimeout(function(){ document.addEventListener('mousedown',spColOutside_); },0);
  var q=document.getElementById('spColQ'); if(q) q.focus();
}
function spColOutside_(e){
  if(e.target.closest('#spColPop')||e.target.closest('#spColBtn')) return;
  var p=document.getElementById('spColPop'); if(p) p.remove();
  document.removeEventListener('mousedown',spColOutside_);
}
function spColPopRender_(){
  var pop=document.getElementById('spColPop'); if(!pop) return;
  var q=spNorm_((document.getElementById('spColQ')||{}).value||'');
  var cols=spColList_(), on=cols.filter(function(c){ return spColOn_(c[0]); }).length;
  var list=cols.filter(function(c){ return !q || spNorm_(c[1]).indexOf(q)>=0; });
  pop.innerHTML='<div class="colpop-h"><b>Cột hiển thị</b><span class="colpop-n">'+on+'/'+cols.length+'</span>'
      +'<button class="colpop-x" onclick="spColPop_()">✕</button></div>'
    +'<div class="colpop-s"><input id="spColQ" placeholder="Tìm cột…" value="'+esc((document.getElementById('spColQ')||{}).value||'')+'" oninput="spColPopRender_()"></div>'
    +'<div class="colpop-b">'+(list.length?list.map(function(c){
        var lock=c[0]==='ten'||c[0]==='stt', act=spColOn_(c[0]);
        return '<label class="colpop-i'+(lock?' lock':'')+'">'
          +'<input type="checkbox" '+(act?'checked':'')+(lock?' disabled':'')+' onchange="spColToggle(\''+c[0]+'\')">'
          +'<span>'+esc(c[1])+'</span>'+(lock?'<i>Luôn hiện</i>':'')+'</label>';
      }).join(''):'<div class="colpop-empty">Không có cột nào khớp</div>')+'</div>'
    +'<div class="colpop-f"><button class="btn ghost xs" onclick="spResetCols_()">Đặt lại thứ tự & độ rộng</button>'
      +'<button class="btn ghost xs" onclick="spColAll_(1)">Hiện tất cả</button>'
      +'<button class="btn ghost xs" onclick="spColAll_(0)">Ẩn bớt</button></div>';
  var i=document.getElementById('spColQ'); if(i&&document.activeElement!==i) i.value=(q?i.value:i.value);
}
var SP_COL_CB=['thumb','duyet','thuong_hieu','giaDaiLy'];   // "Cột cơ bản": ảnh · trạng thái · thương hiệu · giá
function spColCoBan_(){ var m={}; (spPTMode_()?COLSET.sp.keys().slice(0,4):SP_COL_CB).forEach(function(k){ m[k]=1; }); COLSET.sp.set(m); COLSET.sp.ve(); }
function spColAll_(on){
  spColList_().forEach(function(c){
    if(c[0]==='ten'||c[0]==='stt') return;
    if(spPTMode_()){ ptOrder2_(); S._ptColsOn[c[0]]=!!on; }
    else { S._spCols=S._spCols||{}; S._spCols[c[0]]=!!on; }
  });
  spSaveCols_(); spColChips_(); spRenderHead_(); spFilter();
}
/* Đặt lại cột: xoá luôn phần đã lưu để lần sau mở trang về đúng mặc định */
function spRenderHead_(){
  var head=document.getElementById('spHead'); if(!head) return;
  var vis=spVisCols_(), SEL=38;
  // Cột thao tác: đủ chỗ cho cả 7 nút (♡ ⊕ ✓ sửa · copy · xem · xoá — trước 150px nên bị cắt thành "…"),
  // và nhận phần bề ngang còn dư để bảng vừa khít khung (tiêu đề + dòng cùng 1 bề rộng, không lệch)
  var wrapEl=document.querySelector('#v-sanpham .tbl-wrap'), daCot=SEL; vis.forEach(function(c){ daCot+=spColW_(c[0]); });
  var ACT=Math.max(240, ((wrapEl&&wrapEl.clientWidth)||0)-daCot-2);
  var cg=document.getElementById('spColg');
  if(cg) cg.innerHTML='<col style="width:'+SEL+'px">'
    +vis.map(function(c){ return '<col style="width:'+spColW_(c[0])+'px">'; }).join('')
    +'<col style="width:'+ACT+'px">';
  head.innerHTML='<tr><th class="selcol"><input type="checkbox" class="spck" id="spCkAll" onclick="spSelAll(this.checked)"></th>'
    +vis.map(function(c){
      var on=!spPTMode_()&&S._spSort===c[0];
      return '<th class="'+spThCls_(c)+' spth'+(on?' sortOn':'')+'" data-k="'+esc(c[0])+'" draggable="true" title="Bấm để sắp xếp · kéo để đổi chỗ cột · kéo mép phải để giãn">'
        +'<span class="thl" onclick="spSort(\''+esc(c[0])+'\')">'+esc(c[1])+(on?(S._spSortDir==='desc'?' ▼':' ▲'):'')+'</span><span class="spthrsz" data-k="'+esc(c[0])+'"></span></th>'; }).join('')
    +'<th class="act-sp"></th></tr>';
  var tb=head.closest('table');
  if(tb){ var total=SEL+ACT; vis.forEach(function(c){ total+=spColW_(c[0]); });
    tb.style.tableLayout='fixed'; tb.style.width=total+'px'; tb.style.minWidth=''; }
  spInitCols_();
}
// Thanh chip "Hạng mục đã bóc" = nhóm/dòng SP (giống bộ chọn hạng mục bên Bóc tách)
// chuẩn hoá tên (gộp trùng hoa/thường + khoảng trắng)
function spNorm_(s){ return String(s||'').trim().toLowerCase().replace(/\s+/g,' '); }
// map sản phẩm -> node cây đề mục qua "muc" (vd "Thiết bị đèn" -> 3.2.6.1)
function spNodeCodeOf_(p){ var muc=(p&&p.muc)||''; for(var i=0;i<TREE.length;i++){ if(TREE[i][1]===muc) return TREE[i][0]; } return ''; }
function spNodeCount_(code){ if(!code) return (S.products||[]).length;
  if(code==='3.1') return spPTAll_().length;           // Phần thô đếm theo thư viện công tác

  return (S.products||[]).filter(function(p){ var c=spNodeCodeOf_(p); return c===code || c.indexOf(code+'.')===0; }).length; }
function renderSpChips_(){
  if(spPTMode_()) return spPTChips_();
  var bar=document.getElementById('spBar'); if(!bar) return; var f=S._spFilters||{};
  var total=(S.products||[]).length;
  var label = f.node ? (f.node+'.'+nodeName(f.node)) : 'Tất cả hạng mục';
  var cnt = f.node ? spNodeCount_(f.node) : total;
  var scope=spScopeProducts_();
  // options trong phạm vi hạng mục đang chọn (gộp trùng hoa/thường)
  function optList(field){ var m={}; scope.forEach(function(p){ if(p[field]) m[spNorm_(p[field])]=p[field]; });
    return Object.keys(m).sort(function(a,b){ return m[a].localeCompare(m[b],'vi'); }).map(function(k){ return m[k]; }); }
  function fsel(key,lb,field,ph){ var opts=optList(field), cur=f[key]||'';
    return '<div class="sp-fcol"><label>'+lb+'</label><select class="sp-fsel" onchange="spSelFilter(\''+key+'\',this.value)">'
      +'<option value="">'+ph+'</option>'
      +opts.map(function(v){ return '<option value="'+esc(v)+'"'+(spNorm_(cur)===spNorm_(v)?' selected':'')+'>'+esc(v)+'</option>'; }).join('')+'</select></div>'; }
  // hàng lọc: cây Hạng mục + 3 dropdown (Thương hiệu / Hạng mục SP / Dòng SP)  — bám mockup
  // Hàng lọc chỉ giữ thứ quyết định phạm vi (đề mục) + các bộ lọc ĐANG bật.
  // Ba dropdown thương hiệu / hạng mục SP / dòng SP nằm trong nút "Bộ lọc" cho gọn.
  function fchip(key,lb,val){
    return '<span class="fltag" title="'+esc(lb)+'"><i>'+esc(lb)+'</i>'+esc(val)
      +'<b onclick="spSelFilter(\''+key+'\',\'\')" title="Bỏ lọc này">✕</b></span>';
  }
  var tags='';
  if(f.brand)   tags+=fchip('brand','Thương hiệu',f.brand);
  if(f.hangMuc) tags+=fchip('hangMuc','Hạng mục SP',f.hangMuc);
  if(f.dong)    tags+=fchip('dong','Dòng SP',f.dong);
  var treeCol='<div class="sp-scope"><button class="tree-btn sp-catbtn" id="spCatBtn" onclick="spCatToggle(event)">'
      +'<span class="sp-catlbl">'+esc(label)+'</span><span class="cnt">'+cnt+'</span><span class="sp-caret">▾</span></button>'
      +'<div class="tree-pop" id="spCatPop" style="display:none"></div></div>';
  bar.innerHTML='<div class="sp-filtrow">'+treeCol
    +(tags?('<div class="fltags">'+tags+'</div>'):'')
    +(spAnyFilter_()?'<button class="btn ghost xs sp-clrflt" onclick="spClearFilters()">Xoá lọc</button>':'')
    +'</div>';
  S._spFselHtml=fsel('brand','Thương hiệu','thuongHieu','Tất cả thương hiệu')
    +fsel('hangMuc','Hạng mục sản phẩm','hangMuc','Tất cả hạng mục SP')
    +fsel('dong','Dòng sản phẩm','nhom','Tất cả dòng SP');
  var badge=document.getElementById('spFltBadge'); var n=spFltCount_();
  if(badge){ badge.textContent=n||''; badge.style.display=n?'inline-flex':'none'; }
  var btn=document.getElementById('spBoLocBtn'); if(btn) btn.classList.toggle('on', n>0);
}
function spSelFilter(key,val){
  S._spFilters=S._spFilters||{}; if(!val) delete S._spFilters[key]; else S._spFilters[key]=val;
  S._spPage=1; renderSpChips_(); spFilter();
  if(document.getElementById('spFltPop')) spBoLocPop_();     // popover đang mở thì cập nhật theo
}
// chip "Dòng SP" — gộp nhom (đã chuẩn hoá) trong phạm vi hạng mục đang chọn
function spCatToggle(e){ if(e&&e.stopPropagation)e.stopPropagation();
  var pop=document.getElementById('spCatPop'); if(!pop) return;
  if(pop.style.display==='block'){ pop.style.display='none'; document.removeEventListener('mousedown',spCatOutside); return; }
  var f=S._spFilters||{}, total=(S.products||[]).length;
  var html='<div class="tnode lvl1'+(!f.node?' on':'')+'" onclick="spCatPickNode(\'\')"><span class="nm">Tất cả hạng mục</span><span class="cn">['+pad2(total)+']</span><span class="rd"></span></div>'
    +TREE.filter(function(t){return t[0]!=='X';}).map(function(t){ var c=spNodeCount_(t[0]);
      return '<div class="tnode lvl'+t[2]+(f.node===t[0]?' on':'')+'" onclick="spCatPickNode(\''+t[0]+'\')"><span class="nm">'+esc(t[0]+'.'+t[1])+'</span><span class="cn">['+pad2(c)+']</span><span class="rd"></span></div>'; }).join('');
  pop.innerHTML=html; pop.style.display='block';
  setTimeout(function(){ document.addEventListener('mousedown',spCatOutside); },0);
}
function spCatOutside(e){ if(!e.target.closest('#spCatPop') && !e.target.closest('#spCatBtn')){ var p=document.getElementById('spCatPop'); if(p)p.style.display='none'; document.removeEventListener('mousedown',spCatOutside); } }
function spCatPickNode(code){
  // đổi hạng mục -> reset bộ lọc nâng cao cho tương ứng phạm vi hạng mục mới
  S._spFilters={watt:{},kelvin:{},angle:{},cri:{}}; if(code) S._spFilters.node=code;
  var p=document.getElementById('spCatPop'); if(p)p.style.display='none'; document.removeEventListener('mousedown',spCatOutside);
  S._spPage=1; S._spSel={};
  hmSet_(code,'sp');                                    // đồng bộ sang các tab khác
  renderSpChips_(); spViewTabs_(); spFilter();          // Phần thô đổi cả tab lọc lẫn bảng
  if(document.getElementById('spFltPop')) spBoLocPop_();
}
// Sắp xếp theo cột (bấm tiêu đề): tăng -> giảm -> bỏ. Giá trị lấy từ cột DB của ô (raw), không thì thuộc tính SP.
function spSort(k){ if(spPTMode_()) return;
  if(S._spSort!==k){ S._spSort=k; S._spSortDir='asc'; } else if(S._spSortDir==='asc') S._spSortDir='desc'; else S._spSort='';
  S._spPage=1; spRenderHead_(); spFilter(); }
function spSapXep_(list){ var k=S._spSort; if(!k) return list;
  var def=spAllCols_().filter(function(c){ return c[0]===k; })[0], col=def&&def[4]&&def[4].col, d=S._spSortDir==='desc'?-1:1;
  function v(p){ var x=(col&&p.raw&&p.raw[col]!=null)?p.raw[col]:p[k]; if(k==='giaDaiLy') x=p.giaDaiLy!=null?p.giaDaiLy:p.donGiaBan;
    if(typeof x==='number') return x; var n=String(x==null?'':x).trim(); return /^-?[\d.,]+$/.test(n)?tkNum_(n):n; }
  return list.slice().sort(function(a,b){ var x=v(a), y=v(b);
    if(typeof x==='number'&&typeof y==='number') return (x-y)*d;
    if(x==='') return 1; if(y==='') return -1;                       // ô trống luôn nằm cuối
    return String(x).localeCompare(String(y),'vi',{numeric:true})*d; }); }
function spClearFilters(){
  var node=(S._spFilters||{}).node;
  S._spFilters={watt:{},kelvin:{},angle:{},cri:{},brands:{},nccs:{}}; if(node) S._spFilters.node=node; S._spPage=1;
  renderSpChips_(); spFilter(); if(document.getElementById('spFltPop')) spBoLocPop_();
}
// đếm số điều kiện "bộ lọc nâng cao" đang bật (không tính chip Hạng mục hiển thị sẵn)
function actKeys_(o){ return Object.keys(o||{}).filter(function(k){ return o[k]; }); }
function spFltCount_(){ if(spPTMode_()) return ptFltCount_();
  var f=S._spFilters||{}; var n=0; if(f.min)n++; if(f.max)n++;
  ['watt','kelvin','angle','cri','brands','nccs'].forEach(function(g){ n+=actKeys_(f[g]).length; }); return n; }   // tính cả lọc thương hiệu / NCC
function spAnyFilter_(){ var f=S._spFilters||{}; return !!(f.brand||f.hangMuc||f.dong||spFltCount_()); }
// ==== Popover "Bộ lọc" cho Danh sách SP (công suất / nhiệt độ / góc / CRI / thương hiệu / giá) ====
// phạm vi bộ lọc = sản phẩm thuộc hạng mục (node) đang chọn — để option lọc tương ứng hạng mục
function spScopeProducts_(){ var f=S._spFilters||{}; if(!f.node) return S.products||[];
  return (S.products||[]).filter(function(p){ var c=spNodeCodeOf_(p); return c===f.node || c.indexOf(f.node+'.')===0; }); }
function spSingleVals_(field){ var m={}; spScopeProducts_().forEach(function(p){ if(p[field]) m[p[field]]=(m[p[field]]||0)+1; }); return m; }
function spSpecOpts_(field){ var m={}; spScopeProducts_().forEach(function(p){ splitVals(p[field]).forEach(function(v){ m[v]=(m[v]||0)+1; }); }); return m; }
function spToggleBoLoc(e){ if(e&&e.stopPropagation) e.stopPropagation();
  if(document.getElementById('spFltPop')){ document.getElementById('spFltPop').remove(); document.removeEventListener('mousedown',spFltOutside); return; }
  spBoLocPop_(); }
function spFltOutside(e){ var p=document.getElementById('spFltPop'), b=document.getElementById('spBoLocBtn');
  if(p && !p.contains(e.target) && b && !b.contains(e.target)){ p.remove(); document.removeEventListener('mousedown',spFltOutside); } }
function spBoLocPop_(){
  if(spPTMode_()) return ptFltPop_();
  var f=S._spFilters=S._spFilters||{}; f.watt=f.watt||{}; f.kelvin=f.kelvin||{}; f.angle=f.angle||{}; f.cri=f.cri||{};
  f.brands=f.brands||{}; f.nccs=f.nccs||{};
  var old=document.getElementById('spFltPop'); if(old) old.remove();
  function single(title,key,field){ var m=spSingleVals_(field||key); var keys=Object.keys(m); if(keys.length<2) return '';
    keys.sort(function(a,b){ return a.localeCompare(b,'vi'); });
    return '<div class="fgrp"><div class="fgt">'+title+'</div><div class="fchips">'
      +'<span class="spchip sm'+(!f[key]?' on':'')+'" onclick="spFltSet(\''+key+'\',\'\')">Tất cả</span>'
      +keys.map(function(v){ return '<span class="spchip sm'+(f[key]===v?' on':'')+'" onclick="spFltSet(\''+key+'\',\''+escJs_(v)+'\')">'+esc(v)+'</span>'; }).join('')
      +'</div></div>'; }
  function multi(title,field,fkey,opt){ opt=opt||{}; var m=spSpecOpts_(field); var keys=Object.keys(m); if(!keys.length) return '';
    keys.sort(function(a,b){ var na=parseFloat(a),nb=parseFloat(b); if(!isNaN(na)&&!isNaN(nb)&&na!==nb) return na-nb; return a.localeCompare(b); });
    return '<div class="fgrp"><div class="fgt">'+title+'</div><div class="fchips">'
      +keys.map(function(k){ var on=!!f[fkey][k]; var dot=opt.dot?'<i class="cdot" style="background:'+opt.dot(k)+'"></i>':'';
        return '<span class="spchip sm'+(on?' on':'')+'" onclick="spFltSpec(\''+fkey+'\',\''+escJs_(k)+'\')">'+dot+esc(k)+'</span>'; }).join('')
      +'</div></div>'; }
  /* Chọn NHIỀU thương hiệu / NHIỀU nhà cung cấp cùng lúc, có ô gõ để lọc nhanh khi danh
     sách dài (trước đây thương hiệu chỉ chọn được 1, nhà cung cấp thì không lọc được). */
  function nhieu(title,field,fkey,ph){
    var m=spSingleVals_(field), keys=Object.keys(m); if(!keys.length) return '';
    keys.sort(function(a,b){ return a.localeCompare(b,'vi'); });
    var o=f[fkey]||{}, daChon=keys.filter(function(k){ return o[k]; }).length;
    return '<div class="fgrp"><div class="fgt">'+title
        +(daChon?('<span class="fgt-n">'+daChon+' đã chọn</span>'
          +'<button class="fgt-x" onclick="spFltNhieuXoa_(\''+fkey+'\')">Bỏ chọn</button>'):'')+'</div>'
      +(keys.length>8?('<input class="fsearch" id="fs_'+fkey+'" placeholder="'+esc(ph||'Gõ để tìm…')+'"'
          +' value="'+esc((S._fltQ||{})[fkey]||'')+'" oninput="spFltTim_(\''+fkey+'\',this.value)">'):'')
      +'<div class="fchips">'
      +keys.filter(function(k){ var q=spNorm_((S._fltQ||{})[fkey]||''); return !q || spNorm_(k).indexOf(q)>=0; })
        .slice(0,60)
        .map(function(k){ return '<span class="spchip sm'+(o[k]?' on':'')+'" onclick="spFltSpec(\''+fkey+'\',\''+escJs_(k)+'\')">'
          +esc(k)+'<i>'+m[k]+'</i></span>'; }).join('')
      +'</div></div>';
  }
  var pop=document.createElement('div'); pop.className='fltpop spfltpop'; pop.id='spFltPop';
  pop.innerHTML='<div class="fhdr">Bộ lọc</div>'
    +'<div class="fgrp fgrp-sel">'+(S._spFselHtml||'')+'</div>'
    +nhieu('Thương hiệu','thuongHieu','brands','Gõ tên thương hiệu…')
    +nhieu('Nhà cung cấp / nhà phân phối','ncc','nccs','Gõ tên nhà cung cấp…')
    +multi('Công suất','congSuat','watt')
    +multi('Nhiệt độ màu','nhietDo','kelvin',{dot:ctColor})
    +multi('Góc chiếu','gocChieu','angle')
    +multi('CRI','cri','cri')
    +'<div class="fgrp"><div class="fgt">Khoảng giá (đ)</div><div class="fprice">'
      +'<input type="number" id="spFMin" placeholder="Từ" value="'+(f.min||'')+'" oninput="spFltPrice()">'
      +'<span>–</span><input type="number" id="spFMax" placeholder="Đến" value="'+(f.max||'')+'" oninput="spFltPrice()"></div></div>'
    +'<div class="fftr"><button class="btn ghost sm" onclick="spFltReset()">Xóa lọc</button>'
      +'<button class="btn blue sm" onclick="spToggleBoLoc()">Xong</button></div>';
  document.body.appendChild(pop);
  var btn=document.getElementById('spBoLocBtn'); var w=pop.offsetWidth||340;
  if(btn){ var r=btn.getBoundingClientRect(); pop.style.top=(r.bottom+6)+'px'; pop.style.left=Math.max(8,Math.min(r.right-w,window.innerWidth-w-8))+'px'; }
  setTimeout(function(){ document.addEventListener('mousedown',spFltOutside); },0);
}
function spAfterFlt_(){ S._spPage=1; renderSpChips_(); spFilter(); }
function spFltSet(key,val){ S._spFilters=S._spFilters||{}; if(!val) delete S._spFilters[key]; else S._spFilters[key]=val; spAfterFlt_(); spBoLocPop_(); }
function spFltSpec(fkey,val){ S._spFilters=S._spFilters||{}; var o=S._spFilters[fkey]=S._spFilters[fkey]||{}; if(o[val]) delete o[val]; else o[val]=1; spAfterFlt_(); spBoLocPop_(); }
function spFltPrice(){ var f=S._spFilters=S._spFilters||{}; var mn=document.getElementById('spFMin'), mx=document.getElementById('spFMax');
  f.min=mn?(Number(mn.value)||0):0; f.max=mx?(Number(mx.value)||0):0; spAfterFlt_(); }
function spFltReset(){ S._spFilters={watt:{},kelvin:{},angle:{},cri:{},brands:{},nccs:{}}; S._fltQ={}; spAfterFlt_(); spBoLocPop_(); }
function spFltNhieuXoa_(fkey){ S._spFilters=S._spFilters||{}; S._spFilters[fkey]={}; spAfterFlt_(); spBoLocPop_(); }
function spFltTim_(fkey,v){
  S._fltQ=S._fltQ||{}; S._fltQ[fkey]=v;
  spBoLocPop_();
  var e=document.getElementById('fs_'+fkey); if(e){ e.focus(); e.setSelectionRange(e.value.length,e.value.length); }
}
function spSpecs_(p){ var out=[];
  if(nganhCuaSP_(p)==='vs'){                       // thiết bị vệ sinh: chip theo thông số của ngành
    vsChip_(p).forEach(function(x,k){ out.push('<span class="spec'+(k===2?' k':'')+'">'+esc(x[1])+'</span>'); });
    return out.join('')||'<span class="muted">—</span>';
  }
  if(p.congSuat) out.push('<span class="spec">'+esc(p.congSuat)+'</span>');
  if(p.nhietDo) out.push('<span class="spec k">'+esc(p.nhietDo)+'</span>');
  if(p.cri) out.push('<span class="spec">CRI '+esc(p.cri)+'</span>');
  if(p.gocChieu) out.push('<span class="spec">'+esc(p.gocChieu)+'</span>');
  return out.join('')||'<span class="muted">—</span>'; }
/* ═══ PHẦN THÔ TRONG TRANG DANH SÁCH SẢN PHẨM ═══
   Chọn hạng mục "3.1 Phần thô" ở ô Danh sách sản phẩm -> bảng đổi sang liệt kê THƯ VIỆN
   CÔNG TÁC xây dựng (khái toán chi tiết · khái toán sơ bộ · dự toán) thay cho sản phẩm đèn.
   Vẫn dùng chung khung bảng, ô tìm kiếm, phân trang và thanh kéo ngang của trang SP.       */
var SP_PTCOLS=[['stt','STT',58,'c'],['loai','LOẠI BÁO GIÁ',126,'l'],['nhom','HẠNG MỤC',196,'l'],
  ['ten','NỘI DUNG CÔNG VIỆC',330,'l'],['dvt','ĐVT',62,'c'],['dg','ĐƠN GIÁ',124,'n'],['gc','GHI CHÚ',280,'l']];
/* ═══ CỘT CỦA BẢNG CÔNG TÁC — dùng chung bộ máy cột của bảng sản phẩm ═══
   Cùng dạng [khoá, nhãn, class, hàm vẽ, thông tin ô sửa] nên chip chọn cột, kéo đổi chỗ,
   kéo giãn, cố định cột, phân trang, sửa nhanh… chạy y như bảng sản phẩm.               */
var PT_SPDEFW={stt:52,thumb:56,duyet:120,ten:300,loai:126,nhom:180,dvt:70,kl:116,dt:112,hs:80,dgnt:156,dg:140,gc:260};
var _ptColCache=null;
function ptRowVal_(r,f){ return ptVal_(r.sec,r.a,f); }
function ptAnh_(r){
  var c=ctOf_(r.a); if(c) return String(c.hinhAnh||'');
  return String((ptInfo_(r.ten)||{}).anh||'');
}
function ptAnh1_(r){
  var v=String(ptAnh_(r)||'').split(/[\n,]/).map(function(x){return x.trim();}).filter(Boolean)[0];
  return v?imgUrlOf(v):'';
}
function ptNumCell_(r,f,money_){
  if(!ptCanEditF_(r.sec,f)) return '<span class="muted">—</span>';
  var v=ptRowVal_(r,f);
  if(!v) return '<span class="muted">—</span>';
  return money_?(money(v)+'<span class="unit">đ</span>'):ptQty(v);
}
function spPTCols_(){
  if(_ptColCache) return _ptColCache;
  _ptColCache=[
    ['stt','STT','ct',function(r,i){ var per=spPerGet_(), tr=Math.max(1,S._spPage||1);
      return '<span class="sp-stt">'+((per?(tr-1)*per:0)+i+1)+'</span>'; }],
    ['thumb','Ảnh','thumbcol',function(r){
      var im=ptAnh1_(r);
      return im?'<img class="sp-th" src="'+esc(im)+'" onerror="this.style.visibility=\'hidden\'">':'<span class="sp-th"></span>'; }],
    ['duyet','Trạng thái','ct',function(r){
      var c=ctOf_(r.a);
      if(!c) return '<span class="spduyet mau" title="Công tác mẫu dựng sẵn trong ứng dụng — nạp vào cơ sở dữ liệu để duyệt / sửa ảnh">Thư viện mẫu</span>';
      return '<span class="spduyet'+(c.daDuyet?' on':'')+'" title="'+(c.daDuyet?('Duyệt bởi '+esc(c.nguoiDuyet||'?')):'Chưa được duyệt')+'">'
        +(c.daDuyet?'Đã duyệt':'Chưa duyệt')+'</span>'; }],
    ['ten','Nội dung công việc','sp-name',function(r){
      var da=ptDaCo_(r.sec,r.a);
      return '<b>'+esc(r.ten)+'</b>'+(da?'<span class="ptl-da" title="Đã có trong bảng khái toán của dự án đang chọn">✓ đã thêm</span>':'')
        +'<span class="sp-code">'+esc((r.r?r.r+'. ':'')+r.nhom)+(r.daSua?'<span class="ptl-sua" title="Đơn giá / thông số đã được sửa lại">Đã sửa</span>':'')+'</span>'; }],
    ['loai','Loại báo giá','ct',function(r){
      return '<span class="ptl-tag '+esc(r.loai)+'" title="'+esc(ptLoaiLabel_(r.loai))+'">'+esc(ptLoaiNgan_(r.loai))+'</span>'; }],
    ['nhom','Hạng mục','',function(r){
      return '<span class="ptl-nhom" title="Bấm để chỉ xem hạng mục này" onclick="event.stopPropagation();spSelFilter(\'ptNhom\',\''+escJs_(r.nhom)+'\')">'+esc(r.nhom)+'</span>'; }],
    ['dvt','ĐVT','ct',function(r){ return spDash_(ptRowVal_(r,'dvt')); },{f:'dvt'}],
    ['kl','Khối lượng mẫu','num',function(r){ return ptNumCell_(r,'kl'); },{f:'kl',num:1}],
    ['dt','Diện tích mẫu','num',function(r){ return ptNumCell_(r,'dt'); },{f:'dt',num:1}],
    ['hs','Hệ số','num',function(r){ return ptNumCell_(r,'hs'); },{f:'hs',num:1}],
    ['dgnt','Đơn giá (nhà thầu)','num sp-price',function(r){ return ptNumCell_(r,'dgnt',1); },{f:'dgnt',num:1,money:1}],
    ['dg','Đơn giá','num sp-price',function(r){
      if(r.sec.mode==='area') return '<span title="Đơn giá chung của cả hạng mục">'+money(r.dg)+'<span class="unit">đ</span></span>';
      return ptNumCell_(r,'dg',1); },{f:'dg',num:1,money:1}],
    ['gc','Ghi chú','',function(r){ return '<span class="ptl-gc">'+esc(ptRowVal_(r,'gc'))+'</span>'; },{f:'gc'}]
  ];
  return _ptColCache;
}
function ptEditCell_(c,r,i){
  var e=c[4]; if(!e || !ptCanEditF_(r.sec,e.f)) return c[3](r,i);
  var v=ptRowVal_(r,e.f);
  if(e.money) v=v?money(v):'';
  else if(e.num) v=(v||v===0)?String(v):'';
  return '<span class="spin-wrap'+(e.num?'':' tx')+'" onclick="event.stopPropagation()">'
    +'<input class="spin'+(e.num?'':' spin-tx')+'" value="'+esc(v)+'" title="'+esc(v)+'"'
    +' data-si="'+r.si+'" data-ii="'+r.ii+'" data-f="'+esc(e.f)+'" data-money="'+(e.money?1:0)+'" data-old="'+esc(v)+'"'
    +' onchange="ptOvrSave(this)" onkeydown="if(event.key===\'Enter\')this.blur()"></span>';
}
async function ptOvrSave(inp){
  var si=+inp.dataset.si, ii=+inp.dataset.ii, f=inp.dataset.f;
  var sec=PT_TEMPLATE[si]; if(!sec) return; var a=sec.items[ii]; if(!a) return;
  var raw=String(inp.value||'').trim();
  var v = (+inp.dataset.money) ? (raw===''?'':ptMoneyN_(raw)) : (['kl','dt','hs'].indexOf(f)>=0 ? (raw===''?'':ptN(raw)) : raw);
  var c=ctOf_(a);
  if(c){                                                        // công tác trong CSDL -> lưu thẳng
    var patch=ctPatchOf_(c); patch[f]=v;
    try{ var out=await api('ctUpdate', c.id, patch); Object.assign(c,out); }
    catch(e){ toast('Lỗi lưu: '+e.message); inp.value=inp.dataset.old||''; return; }
    ctSyncTemplate_(); spFilter(); if(S.node==='3.1') renderPTLibrary();
    toast('Đã lưu vào cơ sở dữ liệu');
    return;
  }
  var base=ptBase_(sec,a,f);
  if(v===''||String(v)===String(base)) ptOvrSet_(sec,a,f,'');    // trùng giá gốc -> bỏ phần sửa
  else ptOvrSet_(sec,a,f,v);
  spFilter(); if(S.node==='3.1') renderPTLibrary();
  toast('Đã lưu — giá này dùng cho cả thư viện và khi thêm vào bảng');
}
// gói dữ liệu 1 công tác để gửi lên server (giữ nguyên các trường không sửa)
function ctPatchOf_(c){
  return {loai:c.loai, mode:c.mode, maNhom:c.maNhom, hangMuc:c.hangMuc, ten:c.ten, dvt:c.dvt,
    kl:c.kl, dt:c.dt, hs:c.hs, dgnt:c.dgnt, dg:c.dg, gc:c.gc, hinhAnh:c.hinhAnh,
    thongSo:c.thongSo, phamVi:c.phamVi, linkTaiLieu:c.linkTaiLieu};
}
async function ptResetOvr_(){
  var n=Object.keys(ptOvrAll_()).length;
  if(!n){ toast('Chưa có công tác nào bị sửa'); return; }
  if(!await xacNhan_('Trả '+n+' công tác đã sửa về đúng bảng giá gốc?')) return;
  S._ptOvr={}; try{ localStorage.removeItem('qs_ptovr'); }catch(e){}
  spFilter(); if(S.node==='3.1') renderPTLibrary(); toast('Đã trả về bảng giá gốc');
}
/* --- chọn dòng + hành động hàng loạt --- */
function ptSelKey_(r){ return 'pt|'+r.si+'|'+r.ii; }
function ptSelRows_(){
  var sel=S._spSel||{}; return spPTAll_().filter(function(r){ return sel[ptSelKey_(r)]; });
}
function ptBulkAdd_(){
  var rows=ptSelRows_(); if(!rows.length) return;
  if(!S.cur){ toast('Chọn dự án trước khi thêm công tác vào bảng'); return; }
  rows.forEach(function(r){ ptAddFromLib(r.si,r.ii,true); });
  ptPersist(); renderPhanTho();
  S._spSel={}; spFilter();
  toast('Đã thêm '+rows.length+' công tác vào bảng khái toán');
}
/* --- bộ lọc nâng cao --- */
function ptFltPop_(){
  var f=S._spFilters=S._spFilters||{};
  var old=document.getElementById('spFltPop'); if(old) old.remove();
  var all=spPTAll_();
  function chips(title,key,vals){
    return '<div class="fgrp"><div class="fgt">'+title+'</div><div class="fchips">'
      +'<span class="spchip sm'+(!f[key]?' on':'')+'" onclick="spFltSet(\''+key+'\',\'\')">Tất cả</span>'
      +vals.map(function(v){ return '<span class="spchip sm'+(f[key]===v[0]?' on':'')+'" onclick="spFltSet(\''+key+'\',\''+escJs_(v[0])+'\')">'+esc(v[1])+'</span>'; }).join('')
      +'</div></div>';
  }
  var dvt={}; all.forEach(function(r){ if(r.dvt) dvt[r.dvt]=(dvt[r.dvt]||0)+1; });
  var dvtVals=Object.keys(dvt).sort(function(a,b){ return dvt[b]-dvt[a]; }).slice(0,14).map(function(v){ return [v,v+' ('+dvt[v]+')']; });
  var nhom={}; all.forEach(function(r){ nhom[r.nhom]=(nhom[r.nhom]||0)+1; });
  var nhomVals=Object.keys(nhom).map(function(v){ return [v,v]; });
  var pop=document.createElement('div'); pop.className='fltpop spfltpop'; pop.id='spFltPop';
  pop.innerHTML='<div class="fhdr">Bộ lọc công tác</div>'
    +chips('Loại báo giá','ptLoai',PT_LOAI.map(function(x){ return [x[0],x[1]]; }))
    +chips('Đơn vị tính','ptDvt',dvtVals)
    +'<div class="fgrp"><div class="fgt">Hạng mục</div><select class="sp-fsel" onchange="spFltSet(\'ptNhom\',this.value)">'
      +'<option value="">Tất cả hạng mục</option>'
      +nhomVals.map(function(v){ return '<option value="'+esc(v[0])+'"'+(f.ptNhom===v[0]?' selected':'')+'>'+esc(v[1])+'</option>'; }).join('')
    +'</select></div>'
    +'<div class="fgrp"><div class="fgt">Khoảng đơn giá (đ)</div><div class="fprice">'
      +'<input type="number" id="spFMin" placeholder="Từ" value="'+(f.min||'')+'" oninput="spFltPrice()">'
      +'<span>–</span><input type="number" id="spFMax" placeholder="Đến" value="'+(f.max||'')+'" oninput="spFltPrice()"></div></div>'
    +'<div class="fgrp"><div class="fgt">Trạng thái</div><div class="fchips">'
      +'<span class="spchip sm'+(!f.ptDa?' on':'')+'" onclick="spFltSet(\'ptDa\',\'\')">Tất cả</span>'
      +'<span class="spchip sm'+(f.ptDa==='1'?' on':'')+'" onclick="spFltSet(\'ptDa\',\'1\')">Đã có trong bảng</span>'
      +'<span class="spchip sm'+(f.ptDa==='0'?' on':'')+'" onclick="spFltSet(\'ptDa\',\'0\')">Chưa thêm</span>'
      +'<span class="spchip sm'+(f.ptSua==='1'?' on':'')+'" onclick="spFltSet(\'ptSua\',\''+(f.ptSua==='1'?'':'1')+'\')">Đã sửa giá</span>'
    +'</div></div>'
    +'<div class="fftr"><button class="btn ghost sm" onclick="ptFltReset_()">Xóa lọc</button>'
      +'<button class="btn blue sm" onclick="spToggleBoLoc()">Xong</button></div>';
  document.body.appendChild(pop);
  var btn=document.getElementById('spBoLocBtn'); var w=pop.offsetWidth||340;
  if(btn){ var r=btn.getBoundingClientRect(); pop.style.top=(r.bottom+6)+'px'; pop.style.left=Math.max(8,Math.min(r.right-w,window.innerWidth-w-8))+'px'; }
}
function ptFltReset_(){
  var f=S._spFilters||{}; ['ptLoai','ptDvt','ptNhom','ptDa','ptSua','min','max'].forEach(function(k){ delete f[k]; });
  renderSpChips_(); spFilter(); ptFltPop_();
}
function ptFltCount_(){ var f=S._spFilters||{}; var n=0;
  ['ptLoai','ptDvt','ptNhom','ptDa','ptSua','min','max'].forEach(function(k){ if(f[k]) n++; }); return n; }
/* --- tải Excel --- */
function ptXlsRows_(chiChon){
  var rows=chiChon?ptSelRows_():spPTList_();
  return rows.map(function(r,i){
    return {stt:i+1, loai:ptLoaiLabel_(r.loai), hangMuc:(r.r?r.r+'. ':'')+r.nhom, noiDung:r.ten,
      dvt:r.dvt, khoiLuong:(r.mode==='item'?r.kl:''), dienTich:(r.mode!=='item'&&r.mode!=='none'?r.dt:''),
      heSo:(r.mode!=='item'&&r.mode!=='none'?r.hs:''), dgnt:(r.mode==='item'?r.dgnt:''), dg:r.dg, ghiChu:r.gc};
  });
}
async function ptBulkXlsx_(){ return ptExportXlsx(true); }
async function ptExportXlsx(chiChon){
  var rows=ptXlsRows_(chiChon);
  if(!rows.length){ toast('Không có công tác nào để tải'); return; }
  var btn=document.getElementById('spXlsBtn'); if(btn) btn.disabled=true;
  try{
    var res=await fetch('/export/cong-tac',{method:'POST',headers:apiHeaders_(),body:JSON.stringify({rows:rows})});
    if(!res.ok) throw new Error('Lỗi '+res.status);
    var blob=await res.blob();
    var url=URL.createObjectURL(blob), a=document.createElement('a');
    a.href=url; a.download='cong-tac-xay-dung.xlsx'; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function(){ URL.revokeObjectURL(url); },1500);
    toast('Đã tải '+rows.length+' công tác ra Excel');
  }catch(e){ toast('Không tải được Excel: '+e.message); }
  if(btn) btn.disabled=false;
}
function spXlsClick_(){ return spPTMode_()?ptExportXlsx(Object.keys(S._spSel||{}).length>0):spExportXlsx(); }
function spPTMode_(){ return String((S._spFilters||{}).node||'')==='3.1'; }
function ptLoaiLabel_(v){ var m=PT_LOAI.filter(function(x){ return x[0]===ptLoaiGop_(v); })[0]; return m?m[1]:v; }
var PT_LOAI_NGAN={kt_chitiet:'KT chi tiết',kt_sobo:'KT sơ bộ',dt_nhancong:'DT · Nhân công',dt_vattu:'DT · Vật tư'};
function ptLoaiNgan_(v){ return PT_LOAI_NGAN[v]||ptLoaiLabel_(v); }
/* Loại báo giá Phần thô (theo sơ đồ nghiệp vụ):
     KHÁI TOÁN CHI TIẾT → chọn nhà thầu → báo giá theo m2 / md / cái
     KHÁI TOÁN SƠ BỘ    → chọn nhà thầu → chọn dự án mẫu → đơn giá trọn gói
     DỰ TOÁN → NHÂN CÔNG (báo giá theo m2 / md / cái) · VẬT TƯ (báo giá vật tư)
   ptLoaiGop_ giữ lại làm chuẩn hoá (rỗng -> kt_chitiet); 4 loại KHÔNG gộp nhau.            */
function ptLoaiGop_(v){ return String(v||'kt_chitiet'); }
// "Khái toán chi tiết" -> "Chi tiết" khi đã nằm dưới nhóm Khái toán
var PT_LOAI_NHOM=[
  ['kt','1','Khái toán',[['kt_chitiet','1.1','Khái toán chi tiết','Chọn nhà thầu → báo giá theo m2 / md / cái'],
                         ['kt_sobo','1.2','Khái toán sơ bộ','Chọn nhà thầu → chọn dự án mẫu → đơn giá trọn gói']]],
  ['dt','2','Dự toán',[['dt_nhancong','2.1','Nhân công','Báo giá theo m2 / md / cái'],
                       ['dt_vattu','2.2','Vật tư','Báo giá vật tư']]]
];
function spPTAll_(){
  var out=[];
  PT_TEMPLATE.forEach(function(sec,si){
    if(sec.an) return;                       // bản dựng sẵn đã được thay bằng dữ liệu CSDL
    (sec.items||[]).forEach(function(a,ii){
      out.push({si:si,ii:ii,sec:sec,a:a,loai:sec.loai||'kt_chitiet',r:sec.r||'',mode:sec.mode,
        nhom:String(sec.t).split('\n')[0],ten:String(a[0]),
        dvt:ptVal_(sec,a,'dvt'),dg:ptLibDg_(sec,a),dgnt:ptVal_(sec,a,'dgnt'),
        kl:ptVal_(sec,a,'kl'),dt:ptVal_(sec,a,'dt'),hs:ptVal_(sec,a,'hs'),gc:ptVal_(sec,a,'gc'),
        daSua:ptOvrDaSua_(sec,a)});
    });
  });
  return out;
}
function spPTList_(){
  var f=S._spFilters||{}, el=document.getElementById('spSearch');
  var q=spNorm_((el&&el.value)||''), view=S._ptView||'all';
  var mn=Number(f.min)||0, mx=Number(f.max)||0;
  return spPTAll_().filter(function(r){
    if(view==='__chua'){ var c1=ctOf_(r.a); if(!c1||c1.daDuyet) return false; }
    else if(view==='__da'){ var c2=ctOf_(r.a); if(!c2||!c2.daDuyet) return false; }
    else if(view==='__fav'){ var c3=ctOf_(r.a); if(!c3||!c3.yeuThich) return false; }
    if(f.ptLoai && ptLoaiGop_(r.loai)!==ptLoaiGop_(f.ptLoai)) return false;
    if(f.ptNhom && r.nhom!==f.ptNhom) return false;
    if(f.ptDvt && r.dvt!==f.ptDvt) return false;
    if(f.ptSua==='1' && !r.daSua) return false;
    if(f.ptDa==='1' && !ptDaCo_(r.sec,r.a)) return false;
    if(f.ptDa==='0' && ptDaCo_(r.sec,r.a)) return false;
    if(mn && r.dg<mn) return false;
    if(mx && r.dg>mx) return false;
    if(q && spNorm_(r.ten+' '+r.nhom+' '+r.gc+' '+r.dvt).indexOf(q)<0) return false;
    return true;
  });
}
function spPTSetView(v){ S._ptView=v; S._spPage=1; spViewTabs_(); spFilter(); }
function spPTTabs_(){
  var el=document.getElementById('spViewTabs'); if(!el) return;
  // ĐÚNG bộ chip như Thiết bị đèn: chỉ 4 trạng thái, cùng kiểu màu.
  // Lọc theo "loại báo giá" đã nằm trong nút Bộ lọc (và hiện thành thẻ khi đang bật).
  var all=spPTAll_(), cur=S._ptView||'all';
  var db=all.filter(function(r){ return ctOf_(r.a); });
  var chua=db.filter(function(r){ return !ctOf_(r.a).daDuyet; }).length;
  var da=db.filter(function(r){ return ctOf_(r.a).daDuyet; }).length;
  var fav=db.filter(function(r){ return ctOf_(r.a).yeuThich; }).length;
  var tabs=[['all','Tất cả',all.length],['__chua','Chưa duyệt',chua],
            ['__da','Đã duyệt',da],['__fav','♥ Yêu thích',fav]];
  el.innerHTML=tabs.map(function(t){
    return '<button class="spvt'+(cur===t[0]?' on':'')
      +(t[0]==='__chua'?' warn':(t[0]==='__fav'?' fav':''))+'" onclick="spPTSetView(\''+t[0]+'\')">'+esc(t[1])
      +(t[2]?'<span class="spvt-n">'+t[2]+'</span>':'')+'</button>'; }).join('');
}
function spPTChips_(){
  var bar=document.getElementById('spBar'); if(!bar) return;
  var f=S._spFilters||{}, all=spPTAll_();
  // Hàng lọc giống hệt Thiết bị đèn: chỉ ô ĐỀ MỤC + các bộ lọc ĐANG bật (dạng thẻ có ✕).
  // Mọi bộ lọc khác (loại báo giá · hạng mục công tác · ĐVT · khoảng giá · trạng thái)
  // nằm trong nút "Bộ lọc", không bày inline nữa.
  function fchip(key,lb,val){
    return '<span class="fltag" title="'+esc(lb)+'"><i>'+esc(lb)+'</i>'+esc(val)
      +'<b onclick="spSelFilter(\'' + key + '\',\'\')" title="Bỏ lọc này">✕</b></span>';
  }
  var tags='';
  if(f.ptLoai) tags+=fchip('ptLoai','Loại báo giá',ptLoaiNgan_(f.ptLoai));
  if(f.ptNhom) tags+=fchip('ptNhom','Hạng mục',f.ptNhom);
  if(f.ptDvt)  tags+=fchip('ptDvt','ĐVT',f.ptDvt);
  if(f.ptDa==='1') tags+=fchip('ptDa','Trạng thái','Đã có trong bảng');
  if(f.ptDa==='0') tags+=fchip('ptDa','Trạng thái','Chưa thêm');
  if(f.ptSua==='1') tags+=fchip('ptSua','Lọc','Đã sửa giá');
  if(f.min||f.max) tags+='<span class="fltag"><i>Khoảng giá</i>'
      +(f.min?money(f.min):'0')+' – '+(f.max?money(f.max):'∞')
      +'<b onclick="spFltSet(\'min\',\'\');spFltSet(\'max\',\'\')" title="Bỏ lọc này">✕</b></span>';
  var treeCol='<div class="sp-scope"><button class="tree-btn sp-catbtn" id="spCatBtn" onclick="spCatToggle(event)">'
      +'<span class="sp-catlbl">3.1.Phần thô</span><span class="cnt">'+all.length+'</span><span class="sp-caret">▾</span></button>'
      +'<div class="tree-pop" id="spCatPop" style="display:none"></div></div>';
  var nS=Object.keys(ptOvrAll_()).length;
  bar.innerHTML='<div class="sp-filtrow">'+treeCol
    +(tags?('<div class="fltags">'+tags+'</div>'):'')
    +(nS?'<button class="btn ghost xs sua" title="Trả các công tác đã sửa về đúng bảng giá gốc" onclick="ptResetOvr_()">'+nS+' công tác đã sửa giá ✕</button>':'')
    +(ptFltCount_()?'<button class="btn ghost xs sp-clrflt" onclick="ptFltReset_()">Xoá lọc</button>':'')
    +'</div>';
  var badge=document.getElementById('spFltBadge'); var n=ptFltCount_();
  if(badge){ badge.textContent=n||''; badge.style.display=n?'inline-flex':'none'; }
  var btn=document.getElementById('spBoLocBtn'); if(btn) btn.classList.toggle('on', n>0);
}
// Thông tin công tác dạng popup (trang Danh sách SP không có panel bên như tab Bóc tách)
function ptModal_(si,ii){
  var sec=PT_TEMPLATE[si]; if(!sec||!sec.items[ii]) return;
  var ctr=ctOf_(sec.items[ii]);
  spClose();
  var ov=document.createElement('div'); ov.className='sp-modal-ov'; ov.id='spModalOv';
  ov.onclick=function(e){ if(e.target===ov) spClose(); };
  var P=ptDetailParts_(si,ii);
  var duyet = ctr ? ('<span class="spduyet'+(ctr.daDuyet?' on':'')+'">'+(ctr.daDuyet?'Đã duyệt':'Chưa duyệt')+'</span>')
                  : '<span class="spduyet mau">Thư viện mẫu</span>';
  ov.innerHTML='<div class="sp-modal sp-modal-wide pd ptdetail"><div class="pd-head"><h3>Thông tin công tác</h3>'
      +duyet+'<span class="pd-loai">'+esc(ptLoaiLabel_(sec.loai||'kt_chitiet'))+'</span>'
      +'<button class="pd-x" onclick="spClose()">✕</button></div>'
    +'<div class="pdm-grid">'
      +'<div class="pdm-left">'+P.media+P.hero+P.foot+'</div>'
      +'<div class="pdm-right">'+P.chinh+P.thongSo+P.ghiChu+P.phamVi+P.thieu+'</div>'
    +'</div>'
    +'<div class="pd-actions">'
      +'<button class="btn ghost sm" onclick="spClose()">Đóng</button>'
      +(ctr?'<button class="btn ghost sm" onclick="ctEditModal_(\''+ctr.id+'\')">'+icon('edit',14)+' Sửa công tác</button>'
           :'<button class="btn ghost sm" onclick="ptInfoEditModal_('+si+','+ii+')">'+icon('edit',14)+' Sửa thông tin</button>')
      +'<button class="btn blue" onclick="ptAddFromLib('+si+','+ii+');spClose()">'+icon('plus',15)+' Thêm vào bảng khái toán</button>'
    +'</div></div>';
  document.body.appendChild(ov);
  document.addEventListener('keydown',spModalKey_);
}
function ptInfoEditModal_(si,ii){
  var box=document.querySelector('#spModalOv .sp-modal'); if(!box) return;
  box.innerHTML='<div class="pd-head"><h3>Sửa thông tin công tác</h3><button class="pd-x" onclick="spClose()">✕</button></div>'
    +ptInfoForm_(si,ii);
  var huy=box.querySelector('.ptinf-act .btn.ghost');
  if(huy) huy.setAttribute('onclick','ptModal_('+si+','+ii+')');
  var luu=box.querySelector('.ptinf-act .btn.blue');
  if(luu) luu.setAttribute('onclick','ptInfoSaveModal_('+si+','+ii+')');
}
function ptInfoSaveModal_(si,ii){
  var a=PT_TEMPLATE[si].items[ii], k=ptInfoKey_(String(a[0]));
  function v(id){ var e=document.getElementById(id); return e?String(e.value||'').replace(/\s+$/,''):''; }
  var o={model:v('ptInfModel'),anh:v('ptInfAnh'),ts:v('ptInfTs'),gc:v('ptInfGc'),pv:v('ptInfPv'),tl:v('ptInfTl')};
  var U=ptInfoUser_();
  if(!o.model&&!o.anh&&!o.ts&&!o.gc&&!o.pv&&!o.tl) delete U[k]; else U[k]=o;
  try{ localStorage.setItem('qs_ptinfo',JSON.stringify(U)); }catch(e){}
  projDataSet_('ptInfo', U);
  toast('Đã lưu thông tin công tác'); ptModal_(si,ii);
  if(spPTMode_()) spFilter();
}
/* ═══════════ MỘT BỘ KHUNG BẢNG DÙNG CHUNG CHO MỌI HẠNG MỤC ═══════════
   Bảng "Danh sách sản phẩm" vẽ bằng ĐÚNG một hàm cho cả Thiết bị đèn và Phần thô:
   cùng ô tích chọn, cùng chế độ sửa nhanh, cùng hàng nút thao tác, cùng phân trang,
   cùng thanh chọn nhiều. Chỉ 3 thứ đổi theo hạng mục: NGUỒN DỮ LIỆU · BỘ CỘT · BỘ LỌC. */
function spKeyOf_(p){ return spPTMode_() ? ptSelKey_(p) : String(p.recordId||p.ma||''); }
function spOpen_(i){
  var p=(S._spList||[])[i]; if(!p) return;
  if(spPTMode_()) ptModal_(p.si,p.ii); else spModal(i);
}
function spEditCellAny_(c,p,i){ return spPTMode_()?ptEditCell_(c,p,i):spEditCell_(c,p,i); }
function spCellEditable_(c,p){
  if(!c[4]) return false;
  return spPTMode_() ? ptCanEditF_(p.sec,c[4].f) : !p.spChung;
}
/* Hàng nút thao tác — cùng thứ tự, cùng biểu tượng ở mọi hạng mục:
   ★ yêu thích · ⊕ đưa vào dự án · ✓ duyệt · ✎ sửa · 👁 xem · 🗑 xoá            */
function spRowActions_(p,i){
  var isAdmin=isAdminRole_();
  if(spPTMode_()){
    var c=ctOf_(p.a), da=ptDaCo_(p.sec,p.a);
    return (c?'<button class="sp-act fav'+(c.yeuThich?' on':'')+'" title="'+(c.yeuThich?'Bỏ khỏi công tác yêu thích':'Thêm vào công tác yêu thích')+'" onclick="ctFav_(\''+c.id+'\','+(c.yeuThich?0:1)+')">'+icon('heart',16)+'</button>':'')
      +'<button class="sp-act add" title="'+(da?'Đã có trong bảng — bấm để thêm 1 dòng nữa':'Thêm vào bảng khái toán của dự án đang chọn')+'" onclick="ptAddFromLib('+p.si+','+p.ii+');spFilter()">'+icon('pluscircle',18)+'</button>'
      +((c&&spCanDuyet_())?'<button class="sp-act '+(c.daDuyet?'undo':'ok')+'" title="'+(c.daDuyet?'Bỏ duyệt':'Duyệt công tác này')+'" onclick="ctDuyet_(\''+c.id+'\','+(c.daDuyet?0:1)+')">'+icon('check',16)+'</button>':'')
      +(c?'<button class="sp-act edit" title="Cập nhật công tác" onclick="ctEditModal_(\''+c.id+'\')">'+icon('edit',16)+'</button>':'')
      +'<button class="sp-act" title="Xem chi tiết" onclick="spOpen_('+i+')">'+icon('eye',16)+'</button>'
      +((c&&isAdmin)?'<button class="sp-act del" title="Xoá công tác" onclick="ctDelete_(\''+c.id+'\',\''+escJs_(p.ten)+'\')">'+icon('trash',16)+'</button>':'');
  }
  return '<button class="sp-act fav'+(p.yeuThich?' on':'')+'" title="'+(p.yeuThich?'Bỏ khỏi sản phẩm yêu thích':'Thêm vào sản phẩm yêu thích')+'" onclick="spFav('+i+','+(p.yeuThich?0:1)+')">'+icon('heart',16)+'</button>'
    +'<button class="sp-act add" title="Ghi danh vào dự án" onclick="spAddToProject('+i+')">'+icon('pluscircle',18)+'</button>'
    +((spCanDuyet_()&&!p.spChung)?'<button class="sp-act '+(p.daDuyet?'undo':'ok')+'" title="'+(p.daDuyet?'Bỏ duyệt':'Duyệt sản phẩm này')+'" onclick="spDuyet('+i+','+(p.daDuyet?0:1)+')">'+icon('check',16)+'</button>':'')
    +(p.spChung?'':'<button class="sp-act edit" title="Cập nhật sản phẩm" onclick="spEditModal('+i+')">'+icon('edit',16)+'</button>')
    +((!p.ma||!spCanEdit_()||p.spChung)?'':'<button class="sp-act copy" title="Sao chép: tạo sản phẩm mới / biến thể / nhiều màu" onclick="spCopyMenu_(event,'+i+')">'+icon('copy',16)+'</button>')
    +'<button class="sp-act" title="Xem chi tiết" onclick="spOpen_('+i+')">'+icon('eye',16)+'</button>'
    +((isAdmin&&!p.spChung)?'<button class="sp-act del" title="Xoá" onclick="spDelete('+i+')">'+icon('trash',16)+'</button>':'');
}
// Nguồn dữ liệu theo hạng mục (chỉ chỗ này khác nhau)
function spDataList_(){
  if(spPTMode_()){ if(S.cur) ptEnsure(); return spPTList_(); }
  _skuMap=null;
  var el=document.getElementById('spSearch'); var q=(el&&el.value||'').toLowerCase().trim(); var f=S._spFilters||{};
  var watts=actKeys_(f.watt), kels=actKeys_(f.kelvin), angs=actKeys_(f.angle), cris=actKeys_(f.cri);
  var mn=Number(f.min)||0, mx=Number(f.max)||0;
  var list=(S.products||[]).filter(function(p){
    if(q && (p.ten+' '+p.ma+' '+p.thuongHieu+' '+p.ncc).toLowerCase().indexOf(q)<0) return false;
    if(f.node){ var c=spNodeCodeOf_(p); if(!(c===f.node || c.indexOf(f.node+'.')===0)) return false; }
    if(f.dong && spNorm_(p.nhom)!==spNorm_(f.dong)) return false;
    if(S._spView==='fav' && !p.yeuThich) return false;
    if(S._spView==='chua' && p.daDuyet) return false;
    if(S._spView==='da' && !p.daDuyet) return false;
    if(f.brand && spNorm_(p.thuongHieu)!==spNorm_(f.brand)) return false;              // lọc 1 thương hiệu (chip cũ ở thanh trên)
    var bs=f.brands||{}, bk=Object.keys(bs).filter(function(k){ return bs[k]; });
    if(bk.length && bk.indexOf(String(p.thuongHieu||''))<0) return false;
    var ns=f.nccs||{}, nk=Object.keys(ns).filter(function(k){ return ns[k]; });
    if(nk.length && nk.indexOf(String(p.ncc||''))<0) return false;
    if(f.hangMuc && spNorm_(p.hangMuc)!==spNorm_(f.hangMuc)) return false;
    var pr=Number(p.donGiaBan)||0; if(mn&&pr<mn) return false; if(mx&&pr>mx) return false;
    if(watts.length){ var pw=splitVals(p.congSuat); if(!pw.some(function(x){return watts.indexOf(x)>=0;})) return false; }
    if(kels.length){ var pk=splitVals(p.nhietDo); if(!pk.some(function(x){return kels.indexOf(x)>=0;})) return false; }
    if(angs.length){ var pa=splitVals(p.gocChieu); if(!pa.some(function(x){return angs.indexOf(x)>=0;})) return false; }
    if(cris.length){ var pc=splitVals(p.cri); if(!pc.some(function(x){return cris.indexOf(x)>=0;})) return false; }
    return true;
  });
  return spGroupVariants_(spSapXep_(list));          // biến thể cùng mã SP nằm liền nhau
}
/* ═══ GOM BIẾN THỂ TRONG BẢNG DANH SÁCH SP ═══
   Trước đây mỗi biến thể là 1 dòng phẳng, chỉ nằm cạnh nhau -> bảng dài, khó nhìn,
   lại khác hẳn cách combo hiển thị (chip bung ra). Nay đồng bộ: mỗi nhóm biến thể
   chỉ hiện 1 DÒNG ĐẠI DIỆN + chip "Biến thể N"; bấm chip mới bung các dòng còn lại.
   Dòng con vẫn là dòng thật (chọn / sửa / mở chi tiết bình thường), chỉ thụt vào. */
function spCbQty_(i){
  var m=(S._rowMeta||[])[i]; if(!m||m.k!=='cb') return '';
  return '<span class="sp-cbq2" title="Số lượng đi kèm cho mỗi sản phẩm chính">×'+ptQty(m.sl)+'</span>';
}
function spVarChip_(p){
  var m=(S._btMap||{})[spKeyOf_(p)]; if(!m) return '';
  var k=m.key||'';
  return '<button class="sp-cbn sp-btchip'+(m.mo?' on':'')+'" title="'+(m.mo?'Thu gọn':'Xem')+' '+m.n+' biến thể của sản phẩm này"'
    +' onclick="event.stopPropagation();spVarToggle_(\''+escJs_(k)+'\')">'+icon('copy',11)+'Biến thể <b>'+m.n+'</b><span class="cbc">▸</span></button>'+spMauDots_(m.mau);
}
function spVarGroups2_(list){
  var out=[], at={};
  (list||[]).forEach(function(p){
    var k=spVarKey_(p);
    if(k && at[k]!=null){ out[at[k]].kids.push(p); return; }
    if(k) at[k]=out.length;
    out.push({key:k, head:p, kids:[]});
  });
  return out;
}
function spVarOpen_(k){ return !!(S._spBtOpen && S._spBtOpen[k]); }
function spVarToggle_(k){
  S._spBtOpen=S._spBtOpen||{};
  if(S._spBtOpen[k]) delete S._spBtOpen[k]; else S._spBtOpen[k]=1;
  var w=document.querySelector('.sp-card .tbl-wrap'), t=w?w.scrollTop:0;
  spFilter(); if(w) w.scrollTop=t;                 // giữ nguyên chỗ đang xem
}
function spFilter(){
  var PT=spPTMode_();
  if(!PT){ var _ngTruoc=S._spColsNganh; spColsSync_(); if(_ngTruoc!==S._spColsNganh){ _spColCache=null; S._spOrder=null; } }
  var card=document.querySelector('.sp-card');
  if(card){
    if(PT) card.classList.add('ptmode');
    else if(card.classList.contains('ptmode')){ card.classList.remove('ptmode'); spColChips_(); spRenderHead_(); }
  }
  var se=document.getElementById('spSearch');
  if(se) se.placeholder = PT ? 'Tìm công tác, hạng mục hoặc ghi chú…' : 'Tìm theo tên, mã hoặc thương hiệu…';

  var full=spDataList_();
  S._spFull=full; S._spSel=S._spSel||{};
  // Chọn dòng rồi lọc/tìm làm dòng đó khuất: bỏ chọn luôn -> thanh hàng loạt, "Tải Excel (n)" và thao tác
  // cùng 1 tập (trước: đếm cả dòng khuất nhưng chỉ thao tác dòng đang thấy)
  var conThay={}; (full||[]).map(spKeyOf_).forEach(function(k){ conThay[k]=1; });
  Object.keys(S._spSel).forEach(function(k){ if(!conThay[k]) delete S._spSel[k]; });
  // Gom biến thể: đếm trang theo NHÓM (1 nhóm = 1 dòng), bung ra mới thêm dòng con
  var groups = PT ? (full||[]).map(function(x){ return {key:'', head:x, kids:[]}; }) : spVarGroups2_(full);
  var per=spPerGet_(), pages=per?Math.max(1,Math.ceil(groups.length/per)):1;
  var cur=Math.min(Math.max(1, S._spPage||1), pages); S._spPage=cur;
  var pageG=per?groups.slice((cur-1)*per, cur*per):groups;
  var base=[], bno=[], no0=per?(cur-1)*per:0; S._btMap={}; S._btKid={};
  pageG.forEach(function(g,gi){
    var n=g.kids.length+1, mo=spVarOpen_(g.key), so=String(no0+gi+1);
    if(!PT && n>1) S._btMap[spKeyOf_(g.head)]={key:g.key, n:n, mo:mo, mau:spMauNhom_([g.head].concat(g.kids))};
    base.push(g.head); bno.push(so);
    if(mo) g.kids.forEach(function(x,ki){ S._btKid[spKeyOf_(x)]=1; base.push(x); bno.push(so+'.'+(ki+1)); });
  });
  // Combo đang mở -> chèn SP đi kèm thành DÒNG THẬT ngay dưới (đúng cột, giống biến thể),
  // thay cho khối gộp 1 ô trước đây. S._rowMeta chạy song song với S._spList để biết
  // dòng nào là SP đi kèm (có ×SL), dòng nào là dòng tổng / dòng báo trạng thái.
  var list=[], meta=[];
  base.forEach(function(p,bi){
    var so=bno[bi];
    list.push(p); meta.push({k:'', no:PT?'':so});
    if(PT || !spCbMo_(p)) return;
    var ds=(S._catCb||{})[catCbKey_(p)];
    if(!ds){ list.push(p); meta.push({k:'note', t:'Đang tải sản phẩm đi kèm…'}); return; }
    if(!ds.length){ list.push(p); meta.push({k:'note', t:'Không có sản phẩm đi kèm.'}); return; }
    var tong=0;
    ds.forEach(function(x,ci){ var sl=Number(x.comboSL)||1;
      tong+=(Number(x.donGiaBan)||0)*sl; list.push(x); meta.push({k:'cb', sl:sl, no:so+'.'+(ci+1)}); });
    list.push(p); meta.push({k:'sum', n:ds.length, tong:tong});
  });
  S._spList=list; S._rowMeta=meta;
  if(PT) S._ptRows=list;

  var cnt=document.getElementById('spCount');
  if(cnt) cnt.textContent = full.length+(PT?' công việc':' SP');
  spColChips_(); spRenderHead_();

  var vis=spVisCols_(), ncol=vis.length+2, edit=!!S._spEdit;
  document.getElementById('spBody').innerHTML = list.length ? list.map(function(p,i){
    var m=(S._rowMeta||[])[i];
    if(m&&m.k==='note') return '<tr class="sp-cbrow"><td colspan="'+ncol+'"><div class="sp-cbnote">'+esc(m.t)+'</div></td></tr>';
    if(m&&m.k==='sum') return '<tr class="sp-cbsum"><td colspan="'+ncol+'">'
      +'<span class="sp-cbsl">Tổng combo · '+m.n+' sản phẩm đi kèm</span><b>'+money(m.tong)+' đ</b></td></tr>';
    var key=spKeyOf_(p), sel=!!S._spSel[key];
    var daCo = PT && ptDaCo_(p.sec,p.a);
    var drag = (!PT && !edit) ? ' draggable="true" ondragstart="spRowDragStart(event,'+i+')" ondragend="spRowDragEnd()"' : '';
    return '<tr class="sp-row'+(PT?' ptrow':'')+(daCo?' da':'')+(sel?' selrow':'')+(edit?' editrow':'')
        +((m&&m.k==='cb')?' sp-cbkid':((S._btKid&&S._btKid[key])?' sp-btkid':''))+'"'+drag
        +(edit?'':' onclick="spOpen_('+i+')"')+'>'
      +'<td class="selcol" onclick="event.stopPropagation()"><input type="checkbox" class="spck" data-k="'+esc(key)+'" '+(sel?'checked':'')
        +' onclick="spSelToggle(\''+escJs_(key)+'\',this.checked)"></td>'
      +vis.map(function(c){
          return '<td class="'+c[2]+((edit&&spCellEditable_(c,p))?' edt':'')+'">'
            +(edit?spEditCellAny_(c,p,i):c[3](p,i))+'</td>'; }).join('')
      +'<td class="act-sp" onclick="event.stopPropagation()">'+spRowActions_(p,i)+'</td>'
    +'</tr>';
  }).join('') : ('<tr><td colspan="'+ncol+'"><div class="empty" style="margin:10px">'
      +(PT?'Không có công tác nào khớp bộ lọc.':'Không có sản phẩm khớp bộ lọc.')+'</div></td></tr>');

  var all=document.getElementById('spCkAll');
  if(all) all.checked = list.length>0 && list.every(function(p){ return S._spSel[spKeyOf_(p)]; });
  spPager_(groups.length, cur, pages, per, full.length);
  spFreeze_(); spBulkBar_(); spEditBtnSync_();
  spHBarInit_(); spHBarSync_(); spXlsSync_();
}
function spSelToggle(k,on){ S._spSel=S._spSel||{}; if(on) S._spSel[k]=1; else delete S._spSel[k]; spFilter(); }
function spSelAll(on){
  S._spSel={};
  if(on){
    if(spPTMode_()) (S._ptRows||[]).forEach(function(r){ S._spSel[ptSelKey_(r)]=1; });
    else (S._spList||[]).forEach(function(p,i){ var m=(S._rowMeta||[])[i]; if(m&&m.k==='cb') return;   // dòng đi kèm của combo đang mở
      var k=String(p.recordId||p.ma||''); if(k) S._spSel[k]=1; });
  }
  spFilter();
}
// đổi khoá đã chọn -> danh sách sản phẩm tương ứng
// SP đã tick VÀ đang khớp bộ lọc/tìm kiếm: tick 5 dòng rồi tìm còn 2 dòng -> thao tác chỉ áp 2 dòng đang thấy
// (trước đây gộp cả S.products nên xoá / sửa luôn dòng đã bị lọc khuất)
function spSelProds_(){ var sel=S._spSel||{};
  return (S._spList||[]).concat(S._spFull||[]).filter(function(p,i,arr){
    var k=String(p.recordId||p.ma||''); if(!sel[k]) return false;
    return arr.findIndex(function(q){return String(q.recordId||q.ma||'')===k;})===i;   // bỏ trùng
  }); }
function spClearSel(){ S._spSel={}; spFilter(); }
/* ═══════════ THANH CHỌN NHIỀU — một thiết kế cho cả 2 hạng mục ═══════════
   Thanh nổi cố định ở đáy màn hình:
     [số đã chọn ✕] | hành động chính | Sửa hàng loạt ▾ | ⋯
   "Sửa hàng loạt" và các thao tác phụ nằm trong bảng thả xuống nên thanh luôn gọn,
   không bị chen chúc / đè lên nhau như trước.                                      */
/* Trường hay sửa hàng loạt nhất — cho lên đầu danh sách; phía sau là MỌI trường còn lại
   của ngành đang xem (trước đây chỉ cố định 9 trường, muốn sửa thông số phải mở từng SP). */
var SP_BULK_TOP=['CHIẾT KHẤU ĐẠI LÝ (%)','GIÁ BÁN LẺ','THƯƠNG HIỆU','NHÀ CUNG CẤP','HẠNG MỤC',
  'DÒNG SẢN PHẨM','BẢO HÀNH (năm)','TRẠNG THÁI','ĐƠN VỊ TÍNH'];
var SP_BULK_BO={'TÊN SẢN PHẨM':1,'MÃ SẢN PHẨM':1,'GIÁ ĐẠI LÝ':1,'ẢNH SẢN PHẨM':1};   // khoá tra cứu / cột tự tính
function spBulkFields_(){
  if(spPTMode_()) return CT_BULK_F.map(function(x){ return [x[0],x[1]]; });
  var nhan={}; spColFlat_().forEach(function(f){ if(!nhan[f[0]]) nhan[f[0]]=f[1]; });
  var out=[];
  SP_BULK_TOP.forEach(function(lb){ if(!SP_BULK_BO[lb]) out.push([lb, nhan[lb]||lb]); });
  Object.keys(nhan).forEach(function(lb){
    if(SP_BULK_BO[lb] || SP_BULK_TOP.indexOf(lb)>=0) return;
    if(!DB_LABEL2COL_[lb]) return;                              // không có cột DB thì không sửa được
    out.push([lb, nhan[lb]]);
  });
  return out;
}
function spBulkBar_(){
  var wrap=document.getElementById('spBulkWrap'); if(!wrap) return;
  var n=Object.keys(S._spSel||{}).length;
  if(!n){ wrap.innerHTML=''; spBulkPopClose_(); return; }
  var PT=spPTMode_(), isAdmin=isAdminRole_();
  var dv = PT?'công tác':'sản phẩm';
  var chinh = PT
    ? '<button class="bb-b primary" onclick="ptBulkAdd_()">'+icon('plus',15)+' Thêm vào bảng khái toán</button>'
    : '<button class="bb-b primary" onclick="spBulkToProject()">'+icon('plus',15)+' Thêm vào dự án</button>';
  var fav = PT ? 'ctFavBulk_(1)' : 'spFavBulk(1)';
  var duyet = PT ? 'ctDuyetBulk_(1)' : 'spDuyetBulk(1)';
  wrap.innerHTML='<div class="bbar" id="spBulkBar">'
    +'<div class="bb-count"><b>'+n+'</b><span>'+dv+' đã chọn</span>'
      +'<button class="bb-x" title="Bỏ chọn (Esc)" onclick="spClearSel()">✕</button></div>'
    +'<div class="bb-sep"></div>'
    +chinh
    +'<button class="bb-b" onclick="'+fav+'" title="Lưu vào danh sách yêu thích">'+icon('heart',15)+' Yêu thích</button>'
    +(spCanDuyet_()?'<button class="bb-b" onclick="'+duyet+'" title="Đánh dấu Đã duyệt">'+icon('check',15)+' Duyệt</button>':'')
    +'<button class="bb-b" id="bbEditBtn" onclick="spBulkEditPop_(event)" title="Đổi một trường cho tất cả dòng đã chọn">'
      +icon('edit',15)+' Sửa hàng loạt <i class="bb-car">▾</i></button>'
    +'<div class="bb-sep"></div>'
    +'<button class="bb-ic" id="bbMoreBtn" onclick="spBulkMorePop_(event)" title="Thao tác khác">⋯</button>'
  +'</div>';
}
function spBulkPopClose_(){
  ['bbEditPop','bbMorePop'].forEach(function(id){ var e=document.getElementById(id); if(e) e.remove(); });
  document.removeEventListener('mousedown',spBulkPopOutside_);
}
function spBulkPopOutside_(e){
  if(e.target.closest('#bbEditPop')||e.target.closest('#bbMorePop')
    ||e.target.closest('#bbEditBtn')||e.target.closest('#bbMoreBtn')) return;
  spBulkPopClose_();
}
function spBulkPopPlace_(pop,btnId){
  var b=document.getElementById(btnId); if(!b) return;
  var r=b.getBoundingClientRect(), w=pop.offsetWidth||280;
  pop.style.left=Math.max(10,Math.min(r.left+r.width/2-w/2, window.innerWidth-w-10))+'px';
  pop.style.top=Math.max(10,r.top-pop.offsetHeight-10)+'px';
}
function spBulkEditPop_(e){
  if(e&&e.stopPropagation) e.stopPropagation();
  if(document.getElementById('bbEditPop')){ spBulkPopClose_(); return; }
  spBulkPopClose_();
  var F=spBulkFields_();
  var pop=document.createElement('div'); pop.className='bb-pop'; pop.id='bbEditPop';
  pop.innerHTML='<div class="bb-pop-h">Sửa hàng loạt <span>'+Object.keys(S._spSel||{}).length+' dòng</span></div>'
    +'<div class="bb-pop-b">'
      +'<label>Trường cần đổi</label>'
      +'<select id="spbField">'+F.map(function(f){ return '<option value="'+esc(f[0])+'">'+esc(f[1])+'</option>'; }).join('')+'</select>'
      +'<label>Giá trị mới</label>'
      +'<input id="spbValue" placeholder="Nhập giá trị…" onkeydown="if(event.key===\'Enter\')spBulkApplyAny_()">'
    +'</div>'
    +'<div class="bb-pop-f"><button class="btn ghost sm" onclick="spBulkPopClose_()">Huỷ</button>'
      +'<button class="btn blue sm" id="spbApplyBtn" onclick="spBulkApplyAny_()">'+icon('check',14)+' Áp dụng</button></div>';
  document.body.appendChild(pop); spBulkPopPlace_(pop,'bbEditBtn');
  setTimeout(function(){ document.addEventListener('mousedown',spBulkPopOutside_);
    var v=document.getElementById('spbValue'); if(v) v.focus(); },0);
}
function spBulkApplyAny_(){
  var f=document.getElementById('spbField'), v=document.getElementById('spbValue');
  if(!f||!v) return;
  var fld=f.value, val=v.value, nhan=f.options.length?f.options[f.selectedIndex].text:fld;
  if(String(val).trim()===''){ toast('Chưa nhập giá trị mới'); v.focus(); return; }
  spBulkPopClose_();
  return spPTMode_() ? ctBulkEditRun_(fld,val) : spBulkApply(fld,val,nhan);
}
function spBulkMorePop_(e){
  if(e&&e.stopPropagation) e.stopPropagation();
  if(document.getElementById('bbMorePop')){ spBulkPopClose_(); return; }
  spBulkPopClose_();
  var PT=spPTMode_(), isAdmin=isAdminRole_(), n=Object.keys(S._spSel||{}).length;
  var pop=document.createElement('div'); pop.className='bb-pop bb-menu'; pop.id='bbMorePop';
  pop.innerHTML=
     '<button onclick="spBulkPopClose_();'+(PT?'ptBulkXlsx_()':'spExportXlsx()')+'">'+icon('download',15)+' Tải Excel '+n+' dòng</button>'
    +(spCanDuyet_()?'<button onclick="spBulkPopClose_();'+(PT?'ctDuyetBulk_(0)':'spDuyetBulk(0)')+'">'+icon('close',15)+' Bỏ duyệt</button>':'')
    +'<button onclick="spBulkPopClose_();'+(PT?'ctFavBulk_(0)':'spFavBulk(0)')+'">'+icon('heart',15)+' Bỏ yêu thích</button>'
    +'<div class="bb-menu-sep"></div>'
    +'<button class="danger" onclick="spBulkPopClose_();'
      +(PT?'ctDeleteBulk_()':(isAdmin?'spBulkDelete()':'spBulkRequest()'))+'">'+icon('trash',15)+' '
      +(PT?'Xoá công tác':(isAdmin?'Xoá sản phẩm':'Gửi yêu cầu xoá'))+'</button>';
  document.body.appendChild(pop); spBulkPopPlace_(pop,'bbMoreBtn');
  setTimeout(function(){ document.addEventListener('mousedown',spBulkPopOutside_); },0);
}
// Esc: bỏ chọn nhanh
document.addEventListener('keydown',function(e){
  if(e.key!=='Escape') return;
  if(document.getElementById('bbEditPop')||document.getElementById('bbMorePop')){ spBulkPopClose_(); return; }
  if(Object.keys(S._spSel||{}).length && document.getElementById('spBulkBar')) spClearSel();
});
// SỬA HÀNG LOẠT: đặt 1 giá trị cho tất cả SP đang chọn
async function spBulkApply(larkIn, valIn, labelIn){
  var f=document.getElementById('spbField'), v=document.getElementById('spbValue'), btn=document.getElementById('spbApplyBtn');
  var lark = larkIn!=null?larkIn:(f?f.value:'');
  var val  = String(valIn!=null?valIn:(v?v.value:'')).trim();
  var label= labelIn || (f&&f.options.length?f.options[f.selectedIndex].text:lark);
  if(!lark) return;
  if(val===''){ toast('Chưa nhập giá trị mới'); if(v) v.focus(); return; }
  var all=spSelNhom_(); if(!all.length) return;          // dòng "biến thể n" = sửa cả n biến thể
  var prods=all.filter(function(p){return !p.spChung;}), bo=all.length-prods.length;
  if(!prods.length){ toast('Các sản phẩm đã chọn đều thuộc kho chung của Dezon — không sửa được'); return; }
  if(!await xacNhan_('Đặt "'+label+'" = "'+val+'" cho '+prods.length+' sản phẩm đã chọn?'
    +(bo?'\n(Bỏ qua '+bo+' sản phẩm kho chung Dezon)':''))) return;
  if(btn){ btn.disabled=true; }
  var ok=0, errs=[], undo=[];
  var col=(typeof DB_LABEL2COL_!=='undefined')?DB_LABEL2COL_[lark]:'';
  for(var i=0;i<prods.length;i++){
    if(btn) btn.textContent='⏳ '+(i+1)+'/'+prods.length+'…';
    var d={}; d['MÃ SẢN PHẨM']=prods[i].ma; d[lark]=val;
    var truoc=(col && prods[i].raw && prods[i].raw[col]!=null) ? String(prods[i].raw[col]) : '';
    try{ await api('updateDbProductTracked', String(prods[i].recordId||prods[i].ma), d); ok++;
      undo.push({key:String(prods[i].recordId||prods[i].ma), ma:prods[i].ma, lark:lark, col:col, old:truoc}); }
    catch(e){ if(errs.length<3) errs.push((prods[i].ma||'?')+': '+e.message.slice(0,60)); }
  }
  spUndoPush_(undo, 'sửa hàng loạt '+label+' cho '+ok+' SP');
  S.products=await api('getProducts')||S.products;
  spFilter(); renderFilters&&renderFilters(); renderCatalog&&renderCatalog();
  if(errs.length) toast('Cập nhật '+ok+'/'+prods.length+' — lỗi: '+errs.join(' | '));
  else toast('Đã đặt '+label+' = "'+val+'" cho '+ok+' sản phẩm');
}
async function spBulkDelete(){
  var prods=spSelProds_().filter(function(p){return !p.spChung;});
  var keys=prods.map(function(p){return String(p.recordId||p.ma||'');}).filter(Boolean);
  if(!keys.length){ toast('Không có sản phẩm nào xoá được (kho chung Dezon chỉ xem)'); return; }
  var bo=Object.keys(S._spSel||{}).length-keys.length;
  if(!await xacNhan_('Xóa '+keys.length+' sản phẩm khỏi danh mục? Không thể hoàn tác.'
    +(bo?'\n(Bỏ qua '+bo+' sản phẩm kho chung Dezon)':''))) return;
  var ok=0; for(var i=0;i<keys.length;i++){ try{ await api('deleteDbProduct', keys[i]); ok++; }catch(e){} }
  S._spSel={}; S.products=await api('getProducts')||S.products; spFilter(); renderFilters&&renderFilters(); renderCatalog&&renderCatalog();
  toast('Đã xóa '+ok+' sản phẩm');
}
async function spBulkRequest(){
  // khoá chọn = spKey_ (recordId hoặc mã) -> tra lại đúng sản phẩm để gửi MÃ + tên cho Admin
  var sel=S._spSel||{}; var byKey={}; (S.products||[]).forEach(function(p){ byKey[spKey_(p)]=p; });
  var items=Object.keys(sel).filter(function(k){ return sel[k]; }).map(function(k){ var p=byKey[k]||{}; return {maSP:p.ma||k, id:p.recordId||'', ten:p.ten||''}; });
  if(!items.length) return;
  try{ var r=await api('requestDeleteProducts', items); S._spSel={}; spFilter(); refreshNotifCount_(); toast('Đã gửi yêu cầu xóa '+r.count+' sản phẩm tới Admin'); }
  catch(e){ toast('Lỗi: '+e.message); }
}
function spModal(i){
  var p=(S._spList||[])[i]; if(!p) return;
  var ov=document.createElement('div'); ov.className='sp-modal-ov'; ov.id='spModalOv';
  ov.onclick=function(e){ if(e.target===ov) spClose(); };
  var duyet=p.daDuyet?'<span class="spduyet on">Đã duyệt</span>':'<span class="spduyet">Chưa duyệt</span>';
  ov.innerHTML='<div class="sp-modal sp-modal-wide pd"><div class="pd-head"><h3>Thông tin sản phẩm</h3>'
      +duyet+'<button class="pd-x" onclick="spClose()">✕</button></div>'
    +'<div class="pdm-grid">'
      +'<div class="pdm-left">'+pdMedia_(p)+pdPriceFoot_(p)+'</div>'
      +'<div class="pdm-right">'+pdSpecs_(p)+'</div>'
    +'</div>'
    +'<div id="pdComboModal"></div>'
    +'<div class="pd-actions">'
      +'<button class="btn ghost sm" onclick="spClose()">Đóng</button>'
      +((spCanEdit_()&&!p.spChung)?'<button class="btn ghost sm" onclick="spClose();spEditModal('+i+')">'+icon('edit',14)+' Cập nhật</button>':'')
      +'<button class="btn blue" onclick="spAddToProject('+i+')">'+icon('plus',15)+' Thêm vào dự án</button>'
    +'</div></div>';
  document.body.appendChild(ov);
  document.addEventListener('keydown',spModalKey_);
  pdLoadCombo_(p, i, 'dự án', 'pdComboModal');
}
/* Nạp & hiện danh sách sản phẩm đi kèm trong modal chi tiết */
async function pdLoadCombo_(p, idx, dich, boxId, them){
  var box=document.getElementById(boxId||'pdCombo'); if(!box) return;
  var list=[], seq=S._pdComboSeq=(S._pdComboSeq||0)+1;
  try{ list=await api('getCombo', String(p.recordId||p.ma))||[]; }catch(e){ list=[]; }
  if(seq!==S._pdComboSeq) return;                  // đã mở sản phẩm khác trong lúc chờ
  S._pdCombo=list; S._pdComboBox={idx:idx, dich:dich, boxId:boxId||'pdCombo', p:(idx!=null||them)?p:null};   // p = SP chính để "Thêm combo"
  if(S._catCb) S._catCb[catCbKey_(p)]=list;      // thẻ danh mục dùng lại đúng bản mới nhất
  S._pdComboBo=1;                       // mỗi lần mở sản phẩm khác thì số bộ về 1
  pdComboVe_();
}
/* Khối "Sản phẩm đi kèm" — bố cục C:
   · Danh sách ở trên để trống trải, không khung lồng khung.
   · SỐ BỘ nằm ngay cạnh nút "Thêm combo" — chỉnh xong bấm liền tay.
   · SL kèm mỗi dòng vẫn sửa được: ô không viền, nhìn như chữ, bấm vào là gõ. */
function pdComboVe_(){
  var o=S._pdComboBox||{}, list=S._pdCombo||[];
  var box=document.getElementById(o.boxId||'pdCombo'); if(!box) return;
  if(!list.length){ box.innerHTML=''; return; }
  var bo=pdCbBo_();
  var tong=list.reduce(function(a,x){ return a+(Number(x.donGiaBan)||0)*(Number(x.comboSL)||1)*bo; },0);
  /* Khối "Sản phẩm đi kèm" (kiểu bảng gọn, cùng tông trắng / navy với panel):
     tiêu đề + tổng · danh sách (ảnh · tên · mã · đơn giá | SL mỗi bộ · thành tiền) · chân: số bộ + Thêm combo */
  var rows=list.map(function(x,k){
    var sl=Number(x.comboSL)||1, dg=Number(x.donGiaBan)||0, slTong=sl*bo;
    return '<div class="pcb-r" draggable="true" ondragstart="pdComboDrag_(event,'+k+')" ondragend="prodDragEnd()"'
        +(x.comboNguoc?' title="Liên kết đặt từ phía sản phẩm kia — đi kèm 2 chiều"':'')+'>'
      +(x.hinhAnh?'<img class="pcb-th" src="'+esc(imgSrc1_(x.hinhAnh))+'" onerror="this.style.visibility=\'hidden\'">':'<span class="pcb-th"></span>')
      +'<div class="pcb-m"><b>'+esc(x.ten||'')+(x.comboNguoc?' <span class="pcb-rev">↔</span>':'')+'</b>'
        +'<span>'+esc(x.ma||'')+(x.ma?' · ':'')+money(dg)+' đ</span></div>'
      +'<div class="pcb-p"><b>'+money(dg*slTong)+' đ</b>'
        +'<label class="pcb-q" title="Số lượng đi kèm cho MỖI bộ">SL <input type="number" min="1" step="1" value="'+sl+'"'
          +' onclick="event.stopPropagation()" onchange="pdCbSL_('+k+',null,this.value)">'
          +(bo>1?'<em>× '+bo+' = '+slTong+'</em>':'')+'</label></div>'
    +'</div>';
  }).join('');
  box.innerHTML='<div class="pd-block pcb">'
    +'<div class="pcb-h"><span class="pcb-t">'+icon('layers',14)+' Sản phẩm đi kèm</span><span class="pcb-n">'+list.length+'</span></div>'
    +'<div class="pcb-list">'+rows+'</div>'
    +'<div class="pcb-tot"><span>Tổng '+(bo>1?bo+' bộ':'combo')+'</span><b>'+money(tong)+' đ</b></div>'
    +(!o.p?''
      :('<div class="pcb-ft">'
        +'<span class="pcb-bo" title="Số bộ combo cần thêm"><label>Số bộ</label>'
          +'<button onclick="event.stopPropagation();pdCbBoSet_(-1)" aria-label="Bớt 1 bộ">−</button>'
          +'<input type="number" min="1" step="1" value="'+bo+'" onclick="event.stopPropagation()" onchange="pdCbBoSet_(null,this.value)">'
          +'<button onclick="event.stopPropagation();pdCbBoSet_(1)" aria-label="Thêm 1 bộ">+</button></span>'
        +'<button class="btn blue sm pcb-add" title="Thêm sản phẩm chính và toàn bộ sản phẩm đi kèm vào '+esc(o.dich||'bóc tách')+'" onclick="pdAddCombo_()">'
          +icon('plus',14)+' Thêm '+(bo>1?(bo+' bộ'):'combo')+'</button>'
      +'</div>'))
  +'</div>';
}
/* Số BỘ combo — số lượng mỗi dòng nhân với số này */
function pdCbBo_(){ return Math.max(1, Math.min(999, Number(S._pdComboBo)||1)); }
function pdCbBoSet_(d, giaTri){
  var bo = (giaTri!=null&&giaTri!=='') ? Math.round(Number(String(giaTri).replace(',','.'))||0)
                                       : pdCbBo_()+(Number(d)||0);
  S._pdComboBo = Math.max(1, Math.min(999, bo||1));
  pdComboVe_();
}
/* Đổi số lượng 1 dòng combo: d=+1/-1 hoặc nhập thẳng số */
function pdCbSL_(k, d, giaTri){
  var x=(S._pdCombo||[])[k]; if(!x) return;
  var sl = (giaTri!=null&&giaTri!=='') ? Math.round(Number(String(giaTri).replace(',','.'))||0)
                                       : (Number(x.comboSL)||1)+(Number(d)||0);
  x.comboSL = Math.max(1, Math.min(9999, sl||1));
  pdComboVe_();
}
// Thêm sản phẩm chính + toàn bộ sản phẩm đi kèm vào dự án / bóc tách
async function pdAddCombo_(idx){
  var list=S._pdCombo||[], bo=pdCbBo_();
  var okTab=document.getElementById('v-sanpham').classList.contains('on');
  var chinh=(S._pdComboBox||{}).p; if(!chinh) return;      // SP đang mở (kể cả biến thể / SP con — không phụ thuộc vị trí trong danh sách)
  if(okTab){
    if(!S.cur){ toast('Chưa chọn dự án'); return; }
    await addProdObj(chinh, undefined, bo); renderSpProjPanel_(); setTimeout(renderSpProjPanel_,700);
  } else await addProdObj(chinh, S.selFloor||'', bo);
  for(var k=0;k<list.length;k++){
    var x=list[k];
    await addProdObj(x, S.selFloor||'', (Number(x.comboSL)||1)*bo);   // 1 dòng, đúng số lượng × số bộ
  }
  toast('Đã thêm '+(bo>1?(bo+' bộ combo'):'combo')+': sản phẩm chính + '+list.length+' sản phẩm đi kèm');
}
// ←/→ lật ảnh ngay trong modal chi tiết, Esc để đóng
function spModalKey_(e){
  if(!document.getElementById('spModalOv')) return;
  if(document.getElementById('imgPop') && document.getElementById('imgPop').style.display==='flex') return;
  if(e.key==='Escape'){ spClose(); }
  else if(e.key==='ArrowLeft'){ e.preventDefault(); pdGoImg_(-1); }
  else if(e.key==='ArrowRight'){ e.preventDefault(); pdGoImg_(1); }
}
function spClose(){ var o=document.getElementById('spModalOv'); if(o)o.remove(); document.removeEventListener('keydown',spModalKey_); }
// ===== Cập nhật sản phẩm + lịch sử =====
// Nhãn (Lark) -> cột DB. Modal SỬA dùng CHUNG DB_GROUPS với form NHẬP -> 2 bên luôn giống nhau.
var DB_LABEL2COL_={
  'MÃ SẢN PHẨM':'ma_sp','TÊN SẢN PHẨM':'ten_sp','DÒNG SẢN PHẨM':'dong_sp','HẠNG MỤC':'hang_muc','NHÓM SẢN PHẨM':'nhom_sp',
  'THƯƠNG HIỆU':'thuong_hieu','NHÀ CUNG CẤP':'nha_cung_cap','CÔNG SUẤT (W)':'cong_suat_w','NHIỆT ĐỘ MÀU (K)':'nhiet_do_mau_k',
  'QUANG THÔNG (lm)':'quang_thong_lm','GÓC CHIẾU (°)':'goc_chieu_deg','GÓC NGHIÊNG (°)':'goc_nghieng_deg','MÀU SẮC':'mau_sac',
  'CHẤT LIỆU':'chat_lieu','CHIỀU CAO (mm)':'chieu_cao_mm','ĐƯỜNG KÍNH (mm)':'duong_kinh_mm','LỖ KHOÉT TRẦN (mm)':'cutout_mm',
  'CHỈ SỐ IP':'chi_so_ip','CRI':'cri','HIỆU SUẤT PHÁT QUANG (lm/W)':'hieu_suat_lm_w','UGR':'ugr','SDCM':'sdcm','COI':'coi',
  'TUỔI THỌ':'tuoi_tho','TÊN CHIP LED':'ten_chip_led','LOẠI CHIP LED':'loai_chip_led','CẤP BẢO VỆ ĐIỆN':'class_rating','LẮP NGUỒN RỜI':'lap_nguon_roi',
  'TÊN BỘ NGUỒN':'ten_bo_nguon','MÃ BỘ NGUỒN':'ma_bo_nguon','HÃNG BỘ NGUỒN':'hang_bo_nguon','GIÁ BÁN BỘ NGUỒN':'gia_ban_bo_nguon','VỊ TRÍ LẮP NGUỒN':'vi_tri_lap_nguon',
  'TƯƠNG THÍCH ĐIỀU KHIỂN':'dieu_khien','DÒNG RA TỐI ĐA (mA)':'dong_ra_max_ma','BẢO HÀNH (năm)':'bao_hanh_nam','ĐƠN VỊ TÍNH':'dvt',
  'GIÁ BÁN LẺ':'gia_ban_le','CHIẾT KHẤU ĐẠI LÝ (%)':'ck_dai_ly_pct','ẢNH SẢN PHẨM':'anh_sp','LINK DATASHEET':'link_datasheet',
  'TRẠNG THÁI':'trang_thai','GHI CHÚ':'ghi_chu',
  // ---- Ngành THIẾT BỊ VỆ SINH (db/thiet_bi_ve_sinh.sql) ----
  'NGÀNH HÀNG':'nganh','KÍCH THƯỚC':'kich_thuoc','HỆ THỐNG XẢ':'he_thong_xa',
  'LƯỢNG NƯỚC XẢ':'luong_nuoc_xa','THIẾT KẾ':'thiet_ke','TÂM XẢ':'tam_xa',
  'ÁP LỰC NƯỚC':'ap_luc_nuoc','LƯU Ý':'luu_y','TÍNH NĂNG':'tinh_nang',
  'GIÁ ĐẠI LÝ':'gia_dai_ly'   // chỉ HIỂN THỊ: cột tự tính, server bỏ qua khi lưu
};
Object.keys(VS_SPEC.METRIC).forEach(function(lb){ if(!DB_LABEL2COL_[lb]) DB_LABEL2COL_[lb]=VS_SPEC.METRIC[lb][0]; });
Object.keys(SON_SPEC.METRIC).forEach(function(lb){ if(!DB_LABEL2COL_[lb]) DB_LABEL2COL_[lb]=SON_SPEC.METRIC[lb][0]; });
Object.assign(DB_LABEL2COL_,{'THÔNG SỐ KỸ THUẬT':'thong_so_file','HƯỚNG DẪN CÀI ĐẶT':'huong_dan_lap_dat','FILE BẢN VẼ':'file_ban_ve'});   // db/tai_lieu_sp.sql
var SP_COL2LABEL_={}; Object.keys(DB_LABEL2COL_).forEach(function(k){ SP_COL2LABEL_[DB_LABEL2COL_[k]]=k; });
// Dựng 1 ô nhập trong modal Sửa theo ĐÚNG định nghĩa của form Nhập (nhãn, kiểu, gợi ý, danh sách chọn)
function speField_(f, raw){
  var lark=f[0], label=f[1], type=f[2], req=f[3], opts=f[4]||[], ph=f[5]||label;
  var col=DB_LABEL2COL_[lark]; if(!col) return '';
  var val=raw[col]==null?'':String(raw[col]);
  if(lark==='LẮP NGUỒN RỜI') val=(val===true||val==='true')?'Có':((val===false||val==='false')?'Không':(val?'Có':''));
  var star=req?' <span class="spe-req">*</span>':'';
  var inner;
  if(type==='doc') return '<div class="spe-f wide docfield"><label>'+esc(label)+'</label>'+docInput_('data-col="'+col+'"',val)+'</div>';
  if(type==='hm'){
    var hmC=VS_SPEC.chuanHM(val)||val;
    inner='<select data-col="'+col+'" onchange="vsApplyHM_(document.getElementById(\'spEditOv\'),this.value,1)"><option value="">— Chọn hạng mục —</option>'
      +opts.concat(hmC&&opts.indexOf(hmC)<0?[hmC]:[]).map(function(o){ return '<option value="'+esc(o)+'"'+(o===hmC?' selected':'')+'>'+esc(o)+'</option>'; }).join('')+'</select>';
    return '<div class="spe-f"><label>'+esc(label)+star+'</label>'+inner+'</div>';
  }
  if(type==='area') inner='<textarea data-col="'+col+'" placeholder="'+esc(ph)+'">'+esc(val)+'</textarea>';
  else if(type==='calc') inner='<input data-col="'+col+'" class="calc" value="'+esc(val)+'" readonly placeholder="Tự tính từ giá bán & %CK">';
  else if(type==='sel') inner='<input data-col="'+col+'" list="spe_dl_'+col+'" value="'+esc(val)+'" placeholder="'+esc(ph)+'">'
      +'<datalist id="spe_dl_'+col+'">'+opts.map(function(o){return '<option value="'+esc(o)+'">';}).join('')+'</datalist>';
  else {
    var trg=(lark==='GIÁ BÁN LẺ'||lark==='CHIẾT KHẤU ĐẠI LÝ (%)')?' oninput="speCalcDaiLy_()"':'';
    inner='<input type="'+(type==='num'?'number':'text')+'" data-col="'+col+'" value="'+esc(val)+'" placeholder="'+esc(ph)+'"'+trg+(lark==='MÃ SẢN PHẨM'?' readonly':'')+'>';
  }
  return '<div class="spe-f'+(type==='area'?' wide':'')+'"'+(f[6]==='vs'?' data-vs="'+esc(lark)+'"':'')+'><label>'+esc(label)+star+'</label>'+inner+'</div>';
}
function fmtDateTime_(v){
  if(v==null||v==='') return '—';
  var d=new Date(v); if(isNaN(d.getTime())) return String(v);
  var z=function(n){ return (n<10?'0':'')+n; };
  return z(d.getDate())+'/'+z(d.getMonth()+1)+'/'+d.getFullYear()+' '+z(d.getHours())+':'+z(d.getMinutes());
}
/* ═══ COMBO: chọn sản phẩm đi kèm ═══
   Dùng trong modal Sửa (quản lý danh sách) và modal Chi tiết (xem + thêm cả combo).
   S._combo = [{id, ma, ten, hinhAnh, donGiaBan, comboSL}]                        */
function cbRow_(x,i){
  return '<div class="cb-item">'
    +(x.hinhAnh?'<img class="cb-img" src="'+esc(imgSrc1_(x.hinhAnh))+'" onerror="this.style.visibility=\'hidden\'">':'<span class="cb-img"></span>')
    +'<div class="cb-info"><div class="cb-nm" title="'+esc(x.ten||'')+'">'+esc(x.ten||'')
        +(x.comboNguoc?'<span class="cb-rev" title="Liên kết được đặt từ phía sản phẩm này (bộ gồm 1 '+esc(x.ma||'')+' + '+(Number(x.comboBoSL)||1)+' sản phẩm đang mở). Bỏ ở đây thì bên kia cũng mất.">↔ hai chiều</span>':'')+'</div>'
      +'<div class="cb-sub">'+esc(x.ma||'')+(x.donGiaBan?' · '+money(x.donGiaBan)+'đ':'')+'</div></div>'
    +'<label class="cb-sl" title="Số lượng đi kèm cho mỗi sản phẩm chính">×'
      +'<input type="number" min="0" step="1" value="'+(Number(x.comboSL)||1)+'" oninput="cbSetSL_('+i+',this.value)"></label>'
    +'<button class="cb-del" title="Bỏ khỏi combo" onclick="cbRemove_('+i+')">'+icon('x',14)+'</button>'
  +'</div>';
}
function cbRender_(){
  var box=document.getElementById('cbList'); if(!box) return;
  var list=S._combo||[];
  box.innerHTML=list.length?list.map(cbRow_).join('')
    :'<div class="cb-empty">Chưa chọn sản phẩm nào đi kèm. Gõ tên/mã ở ô trên để tìm và thêm.</div>';
  var n=document.getElementById('cbCount'); if(n) n.textContent=list.length;
}
function cbSetSL_(i,v){ var x=(S._combo||[])[i]; if(x) x.comboSL=Math.max(0,Number(v)||0); }
function cbRemove_(i){ (S._combo||[]).splice(i,1); cbRender_(); }
function cbAdd_(recordId){
  var p=(S.products||[]).filter(function(x){ return String(x.recordId)===String(recordId); })[0];
  if(!p) return;
  S._combo=S._combo||[];
  if(String(p.recordId)===String(S._spEditRecId)){ toast('Không thể cho sản phẩm đi kèm chính nó'); return; }
  if(S._combo.some(function(x){ return String(x.recordId)===String(p.recordId); })){ toast('Sản phẩm này đã có trong combo'); return; }
  S._combo.push({recordId:p.recordId, ma:p.ma, ten:p.ten, hinhAnh:p.hinhAnh, donGiaBan:p.donGiaBan, comboSL:1});
  cbRender_(); cbSearch_('');
  var inp=document.getElementById('cbSearch'); if(inp){ inp.value=''; inp.focus(); }
}
/* SP đang sửa là thiết bị vệ sinh? -> chữ hướng dẫn, gợi ý & nhãn theo ngành vệ sinh */
function cbVS_(){ return nganhCuaSP_(S._spEditP)==='vs'; }
function cbLbl_(p){ var ng=nganhCuaSP_(p);
  return (ng==='vs'||ng==='son')
    ? [specNganh_(ng).chuanHM(p.hangMuc)||p.hangMuc, p.mauSac].filter(Boolean).join(' · ')
    : [p.congSuat, p.nhietDo].filter(Boolean).join(' · '); }
function cbSearch_(q){
  var box=document.getElementById('cbSug'); if(!box) return;
  q=String(q||'').trim().toLowerCase();
  var cur=String(S._spEditRecId||''), me=S._spEditP||{}, ng=nganhCuaSP_(me);
  var chon={}; (S._combo||[]).forEach(function(x){ chon[String(x.recordId)]=1; });
  var ok=function(p){ return String(p.recordId)!==cur && !chon[String(p.recordId)]; };
  var hit, tieuDe='';
  if(q.length<1){
    // Ô trống: thiết bị vệ sinh gợi ý SP thuộc các hạng mục hay đi kèm (bồn cầu -> nắp rửa, lavabo -> vòi…)
    var h=(ng==='vs')?VS_SPEC.hmOf(me.hangMuc):null;
    if(!h||!h.kem.length){ box.innerHTML=''; box.style.display='none'; return; }
    hit=(S.products||[]).filter(function(p){ return ok(p) && nganhCuaSP_(p)==='vs' && h.kem.indexOf(VS_SPEC.chuanHM(p.hangMuc))>=0; }).slice(0,8);
    if(!hit.length){ box.innerHTML=''; box.style.display='none'; return; }
    tieuDe='<div class="cb-sug-h">Gợi ý đi kèm: '+esc(h.kem.join(', '))+'</div>';
  } else {
    hit=(S.products||[]).filter(function(p){
      return ok(p) && ((p.ten||'')+' '+(p.ma||'')+' '+(p.thuongHieu||'')+' '+(p.hangMuc||'')).toLowerCase().indexOf(q)>=0;
    });
    // cùng ngành với SP đang sửa lên trước (vệ sinh đi với vệ sinh, đèn đi với đèn)
    hit.sort(function(a,b){ return (nganhCuaSP_(a)===ng?0:1)-(nganhCuaSP_(b)===ng?0:1); });
    hit=hit.slice(0,8);
  }
  box.innerHTML=hit.length?tieuDe+hit.map(function(p){
    var lbl=cbLbl_(p);
    return '<button class="cb-sug" onmousedown="event.preventDefault()" onclick="cbAdd_(\''+escJs_(String(p.recordId))+'\')">'
      +(p.hinhAnh?'<img src="'+esc(imgSrc1_(p.hinhAnh))+'" onerror="this.style.visibility=\'hidden\'">':'<span class="cb-img"></span>')
      +'<span class="cb-sug-nm">'+esc(p.ten||'')+'<i>'+esc(p.ma||'')+(lbl?' · '+esc(lbl):'')+(p.donGiaBan?' · '+money(p.donGiaBan)+'đ':'')+'</i></span></button>';
  }).join(''):'<div class="cb-empty">Không tìm thấy sản phẩm khớp.</div>';
  box.style.display='block';
}
/* ═══ BIẾN THỂ: nhóm sản phẩm cùng dòng, do người dùng tự gom ═══
   S._bt = [{recordId, ma, ten, hinhAnh, donGiaBan, ...}] — chỉ là danh sách SP,
   không có số lượng như combo (biến thể là CÙNG một sản phẩm, khác thông số). */
function btLbl_(x){
  if(x.nganh==='son') return [x.ma, x.mauSac, x.raw&&x.raw.be_mat, x.raw&&x.raw.kich_thuoc].map(function(v){ return String(v==null?'':v).trim(); }).filter(Boolean).join(' · ');   // sơn: khác nhau ở mã / màu / bề mặt / dung tích
  if(x.nganh==='vs') return [x.mauSac, x.raw&&x.raw.kich_thuoc].map(function(v){ return String(v==null?'':v).trim(); }).filter(Boolean).join(' · ');
  return [x.congSuat,x.nhietDo,x.gocChieu,x.mauSac].map(function(v){ return String(v==null?'':v).trim(); })
    .filter(Boolean).join(' · ');
}
function btRow_(x,i){
  var lbl=btLbl_(x);
  return '<div class="cb-item">'
    +(x.hinhAnh?'<img class="cb-img" src="'+esc(imgSrc1_(x.hinhAnh))+'" onerror="this.style.visibility=\'hidden\'">':'<span class="cb-img"></span>')
    +'<div class="cb-info"><div class="cb-nm" title="'+esc(x.ten||'')+'">'+esc(x.ten||'')+'</div>'
      +'<div class="cb-sub">'+esc(x.ma||'')+(lbl?' · '+esc(lbl):'')+(x.donGiaBan?' · '+money(x.donGiaBan)+'đ':'')+'</div></div>'
    +'<button class="cb-del" title="Bỏ khỏi nhóm biến thể" onclick="btRemove_('+i+')">'+icon('x',14)+'</button>'
  +'</div>';
}
function btRender_(){
  var box=document.getElementById('btList'); if(!box) return;
  var list=S._bt||[], p=S._spEditP||{};
  // biến thể TỰ ĐỘNG = cùng mã SP (vd các màu tạo bằng "Tạo nhanh nhiều màu") — chỉ hiện, không cần gom tay
  var gom={}; list.forEach(function(x){ gom[String(x.recordId)]=1; });
  var cungMa=p.ma?(S.products||[]).filter(function(x){ return x.ma===p.ma && String(x.recordId)!==String(p.recordId) && !gom[String(x.recordId)]; }):[];
  box.innerHTML=(list.length?list.map(btRow_).join('')
      :'<div class="cb-empty">Chưa gom tay sản phẩm khác mã nào — ô tìm ở trên dùng khi muốn gom cả sản phẩm khác mã.</div>')
    +(cungMa.length?'<div class="bt-auto"><b>Cùng mã '+esc(p.ma)+' — tự động là biến thể ('+cungMa.length+'):</b> '
      +cungMa.map(function(x){ var c=spMauCss_(x.mauSac); return '<span class="bt-auto-i"><i style="'+(c?'background:'+c:'')+'"'+(c?'':' class="sp-mau-x"')+'></i>'
        +esc(btLbl_(x)||x.ten||'')+(x.donGiaBan?' · '+money(x.donGiaBan)+'đ':'')+'</span>'; }).join('')+'</div>':'');
  var n=document.getElementById('btCount'); if(n) n.textContent=list.length+cungMa.length;
}
function btRemove_(i){ (S._bt||[]).splice(i,1); btRender_(); }
function btAdd_(recordId){
  var p=(S.products||[]).filter(function(x){ return String(x.recordId)===String(recordId); })[0];
  if(!p) return;
  S._bt=S._bt||[];
  if(String(p.recordId)===String(S._spEditRecId)){ toast('Không thể gom sản phẩm với chính nó'); return; }
  if(S._bt.some(function(x){ return String(x.recordId)===String(p.recordId); })){ toast('Sản phẩm này đã có trong nhóm biến thể'); return; }
  if(String(p.nhomBT||'').trim()) toast('Sản phẩm này đang ở nhóm biến thể khác — lưu xong sẽ chuyển sang nhóm này');
  S._bt.push({recordId:p.recordId, ma:p.ma, ten:p.ten, hinhAnh:p.hinhAnh, donGiaBan:p.donGiaBan,
              congSuat:p.congSuat, nhietDo:p.nhietDo, gocChieu:p.gocChieu, mauSac:p.mauSac, nganh:p.nganh, raw:p.raw});
  btRender_(); btSearch_('');
  var inp=document.getElementById('btSearch'); if(inp){ inp.value=''; inp.focus(); }
}
function btSearch_(q){
  var box=document.getElementById('btSug'); if(!box) return;
  q=String(q||'').trim().toLowerCase();
  if(q.length<1){ box.innerHTML=''; box.style.display='none'; return; }
  var cur=String(S._spEditRecId||'');
  var chon={}; (S._bt||[]).forEach(function(x){ chon[String(x.recordId)]=1; });
  var hit=(S.products||[]).filter(function(p){
    if(String(p.recordId)===cur || chon[String(p.recordId)] || p.spChung) return false;
    return ((p.ten||'')+' '+(p.ma||'')+' '+(p.thuongHieu||'')).toLowerCase().indexOf(q)>=0;
  }).slice(0,8);
  box.innerHTML=hit.length?hit.map(function(p){
    var lbl=btLbl_(p);
    return '<button class="cb-sug" onclick="btAdd_(\''+escJs_(String(p.recordId))+'\')">'
      +(p.hinhAnh?'<img src="'+esc(imgSrc1_(p.hinhAnh))+'" onerror="this.style.visibility=\'hidden\'">':'<span class="cb-img"></span>')
      +'<span class="cb-sug-nm">'+esc(p.ten||'')+'<i>'+esc(p.ma||'')+(lbl?' · '+esc(lbl):'')+'</i></span></button>';
  }).join(''):'<div class="cb-empty">Không tìm thấy sản phẩm khớp.</div>';
  box.style.display='block';
}
/* Chuyển tab Combo / Biến thể trong khối "Sản phẩm liên quan" */
function cbTab_(v){
  S._cbTab=(v==='bt')?'bt':'combo';
  ['combo','bt'].forEach(function(k){
    var t=document.getElementById(k==='bt'?'cbTabBT':'cbTabCombo');
    var pane=document.getElementById(k==='bt'?'btPane':'cbPane');
    if(t) t.classList.toggle('on', S._cbTab===k);
    if(pane) pane.style.display=(S._cbTab===k)?'':'none';
  });
}
function cbSection_(){
  return '<div class="cb-box">'
    +'<div class="cb-h">'+icon('layers',15)+' Sản phẩm liên quan'
      +'<div class="cb-tabs">'
        +'<button type="button" class="cb-tab on" id="cbTabCombo" onclick="cbTab_(\'combo\')">Đi kèm (combo)<span class="cb-n" id="cbCount">0</span></button>'
        +'<button type="button" class="cb-tab" id="cbTabBT" onclick="cbTab_(\'bt\')">Biến thể<span class="cb-n" id="btCount">0</span></button>'
      +'</div></div>'
    +'<div id="cbPane">'
      +'<p class="cb-note">'+(cbVS_()
          ?'Chọn các thiết bị luôn bán/lắp cùng sản phẩm này (VD bồn cầu + nắp rửa điện tử + vòi xịt, lavabo + vòi lavabo + bộ xả). '
          :'Chọn các sản phẩm luôn bán/lắp cùng sản phẩm này (bộ nguồn, thanh ray…). ')
        +'Khi thêm vào dự án có thể thêm cả combo một lượt.</p>'
      +'<div class="cb-find"><input id="cbSearch" placeholder="Tìm theo tên, mã hoặc thương hiệu…" autocomplete="off" oninput="cbSearch_(this.value)" onfocus="cbSearch_(this.value)">'
        +'<div class="cb-sug-box" id="cbSug"></div></div>'
      +'<div class="cb-list" id="cbList"></div>'
    +'</div>'
    +'<div id="btPane" style="display:none">'
      +'<p class="cb-note">Gom các sản phẩm là CÙNG một sản phẩm nhưng khác thông số ('+(cbVS_()?'màu sắc, kích thước':'công suất, nhiệt độ màu, góc chiếu, màu')+'). '
        +'Bảng Danh sách SP và thư viện Bóc tách sẽ gộp chúng thành một dòng, bung ra mới thấy từng biến thể.</p>'
      +(S._spEditP&&S._spEditP.ma&&!S._spEditP.spChung?'<button type="button" class="btn blue sm nbt-open" onclick="spNhieuBT_(S._spEditP)">'+icon('layers',14)+' Tạo nhanh biến thể</button>':'')
      +'<div class="cb-find"><input id="btSearch" placeholder="Tìm biến thể theo tên, mã hoặc thương hiệu…" autocomplete="off" oninput="btSearch_(this.value)">'
        +'<div class="cb-sug-box" id="btSug"></div></div>'
      +'<div class="cb-list" id="btList"></div>'
    +'</div></div>';
}
/* Nhân bản 1 sản phẩm thành BIẾN THỂ MỚI: mở đúng modal Sửa nhưng ở chế độ tạo dòng mới,
   giữ nguyên mã + toàn bộ thông tin, người dùng chỉ đổi phần khác (màu, kích thước…).  */
function spNhanBan_(i){ spEditModal(i, 1); }
// Nút copy trên dòng: chọn kiểu sao chép
function spCopyMenu_(e,i){
  e.stopPropagation(); closePop();
  var p=(S._spList||[])[i]; if(!p) return;
  function mi(ic,t,sub,fn){ return '<div class="cmi cmi2" onclick="closePop();'+fn+'">'+icon(ic,15)+'<span><b>'+t+'</b><i>'+sub+'</i></span></div>'; }
  var pop=document.createElement('div'); pop.className='fltpop ctxmenu'; pop.id='qs_pop';
  pop.innerHTML=mi('copy','Sao chép thành sản phẩm mới','Chép toàn bộ thông tin, ảnh, tài liệu — đổi mã & tên','spEditModal('+i+',\'copy\')')
    +mi('plus','Tạo biến thể','Giữ mã '+esc(p.ma)+', đổi màu / kích thước / công suất…','spNhanBan_('+i+')')
    +mi('layers','Tạo nhanh biến thể','Nhiều mã / màu / bề mặt một lần, giá riêng','spNhieuBT_('+i+')');
  document.body.appendChild(pop);
  var r=e.currentTarget.getBoundingClientRect();
  pop.style.left=Math.max(8,Math.min(r.right-pop.offsetWidth, window.innerWidth-pop.offsetWidth-8))+'px';
  pop.style.top=Math.min(r.bottom+4, window.innerHeight-pop.offsetHeight-8)+'px';
  setTimeout(function(){ document.addEventListener('mousedown',popOutside); },0);
}
/* ═══ BIẾN THỂ MÀU ═══
   Màu của 1 nhóm biến thể hiện thành chấm màu trên dòng đại diện; "Tạo nhanh nhiều biến thể" tạo 1 lần
   nhiều màu từ 1 SP gốc: CÙNG mã / hãng / thông số, mỗi màu 1 giá riêng. Máy chủ (saveDbProduct) coi
   cùng mã + khác MÀU SẮC (/ KÍCH THƯỚC) là sản phẩm riêng -> các màu tự thành 1 nhóm biến thể. */
var SP_MAU_CSS=[['trong suot','transparent'],['xanh duong','#1a73e8'],['xanh nuoc bien','#1a73e8'],['xanh la','#34a853'],['xanh luc','#34a853'],
  ['xanh ngoc','#26a69a'],['xanh reu','#5d7b4f'],['xanh','#4285f4'],['trang','#ffffff'],['den','#202124'],['xam','#9aa0a6'],['ghi','#9aa0a6'],
  ['bac','#c0c0c0'],['kem','#f3e5c0'],['be','#e8d5b0'],['vang dong','#d4af37'],['vang','#f2c200'],['cam','#f08a00'],['do','#d93025'],
  ['hong','#f48fb1'],['tim','#8e44ad'],['nau','#8d6e63'],['go','#a1887f'],['dong','#b87333'],['gold','#d4af37']];
function spMauCss_(ten){
  var t=String(ten||'').trim(), hex=t.match(/#[0-9a-f]{3,6}\b/i); if(hex) return hex[0];
  var k=' '+t.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/đ/g,'d').replace(/[^a-z0-9]+/g,' ')+' ';   // bỏ dấu; khớp NGUYÊN TỪ: "đồng" không nhầm "đỏ""
  for(var i=0;i<SP_MAU_CSS.length;i++) if(k.indexOf(' '+SP_MAU_CSS[i][0]+' ')>=0) return SP_MAU_CSS[i][1];
  return '';
}
function spMauNhom_(list){ var seen={}, out=[];
  list.forEach(function(p){ var m=String(p.mauSac||'').trim(); if(m && !seen[spNorm_(m)]){ seen[spNorm_(m)]=1; out.push(m); } }); return out; }
function spMauDots_(mau){
  if(!mau||mau.length<2) return '';
  return '<span class="sp-mau" title="'+esc(mau.length+' màu: '+mau.join(' · '))+'">'+mau.slice(0,6).map(function(m){ var c=spMauCss_(m);
      return '<i style="'+(c?('background:'+c):'')+'"'+(c?'':' class="sp-mau-x"')+'></i>'; }).join('')
    +(mau.length>6?'<b>+'+(mau.length-6)+'</b>':'')+'</span>';
}
/* Tạo nhanh nhiều biến thể: mỗi dòng 1 biến thể — khác MÃ (VD GJ8 / GJ8B), MÀU, BỀ MẶT (bóng / mờ…), DUNG TÍCH; giá riêng.
   Giữ nguyên hãng, thông số, ảnh của SP gốc. Máy chủ chặn trùng theo MÃ + MÀU + DUNG TÍCH (không tính bề mặt), nên 2 bề mặt
   khác nhau phải khác mã hoặc khác màu / dung tích (đúng như bảng giá: Mờ = GJ8, Bóng = GJ8B). Biến thể khác mã tự gom chung nhóm. */
var NBT_BM=['Bề mặt bóng','Bóng mờ','Mờ','Siêu mờ','Siêu bóng','Bán bóng'];
function spNhieuBT_(i){                        // i = chỉ số dòng trong bảng, hoặc chính sản phẩm (từ form Cập nhật)
  var p=(i&&typeof i==='object')?i:(S._spList||[])[i]; if(!p||!p.ma) return;
  var raw=p.raw||{};
  S._nbt={p:p, rows:[spNbtDong_({})]};
  var ov=document.createElement('div'); ov.className='sp-modal-ov'; ov.id='nbtOv';
  ov.onclick=function(e){ if(e.target===ov) spNhieuBTDong_(); };
  ov.innerHTML='<div class="sp-modal pd nbt-modal"><div class="pd-head"><h3>'+icon('layers',16)+' Tạo nhanh biến thể</h3>'
      +'<button class="pd-x" onclick="spNhieuBTDong_()">✕</button></div>'
    +'<div class="nbt-src">'+(p.hinhAnh?'<img src="'+esc(imgSrc1_(p.hinhAnh))+'" onerror="this.style.visibility=\'hidden\'">':'')
      +'<div><b>'+esc(p.ten||'')+'</b><span>Mã '+esc(p.ma)+(p.thuongHieu?' · '+esc(p.thuongHieu):'')+(p.mauSac?' · '+esc(p.mauSac):'')
        +(raw.be_mat?' · '+esc(raw.be_mat):'')+(raw.kich_thuoc?' · '+esc(raw.kich_thuoc):'')+'</span></div></div>'
    +'<p class="ask-note">Mỗi dòng là 1 biến thể — giữ nguyên hãng, thông số, ảnh của sản phẩm gốc; chỉ đổi phần khác nhau và nhập giá riêng. '
      +'Bề mặt khác nhau (Bóng / Mờ…) thường có <b>mã riêng</b> (VD Mờ GJ8 · Bóng GJ8B) — sửa ô Mã cho đúng bảng giá. '
      +'Dán từ Excel vào ô đầu: <i>Mã ⇥ Màu ⇥ Bề mặt ⇥ Dung tích ⇥ Giá</i> (hoặc chỉ Màu ⇥ Giá).</p>'
    +'<datalist id="nbtBmList">'+NBT_BM.map(function(x){ return '<option value="'+esc(x)+'">'; }).join('')+'</datalist>'
    +'<div class="nbt-tbl"><div class="nbt-h"><span>Mã SP</span><span>Màu sắc</span><span>Bề mặt</span><span>Dung tích</span><span>Giá bán lẻ (đ) *</span><span></span></div><div id="nbtRows"></div></div>'
    +'<button class="btn ghost sm" onclick="spNhieuBTThem_()">'+icon('plus',14)+' Thêm biến thể</button>'
    +'<div class="ask-err" id="nbtErr" style="display:none"></div>'
    +'<div class="ask-f-btn"><button class="btn ghost sm" onclick="spNhieuBTDong_()">Huỷ</button>'
      +'<button class="btn blue" id="nbtOk" onclick="spNhieuBTLuu_()">'+icon('check',15)+' Tạo biến thể</button></div></div>';
  document.body.appendChild(ov); spNhieuBTVe_();
  var f=ov.querySelector('.nbt-ma'); if(f) f.focus();
}
// dòng mới: lấy mặc định từ SP gốc (mã, bề mặt, dung tích) hoặc từ dòng trên cùng (a)
function spNbtDong_(a){ var p=S._nbt?S._nbt.p:{}, raw=(p&&p.raw)||{};
  return {ma:a.ma||p.ma||'', mau:'', bm:a.bm!=null?a.bm:String(raw.be_mat||''), kt:a.kt!=null?a.kt:String(raw.kich_thuoc||''), gia:''}; }
function spNhieuBTDong_(){ var o=document.getElementById('nbtOv'); if(o) o.remove(); S._nbt=null; }
function spNhieuBTVe_(){
  var box=document.getElementById('nbtRows'); if(!box||!S._nbt) return;
  function o(k,f,v,ph,cls,them){ return '<input'+(cls?' class="'+cls+'"':'')+' value="'+esc(v)+'" placeholder="'+ph+'" oninput="spNhieuBTSua_('+k+',\''+f+'\',this.value)"'+(them||'')+'>'; }
  box.innerHTML=S._nbt.rows.map(function(r,k){ var c=spMauCss_(r.mau);
    return '<div class="nbt-r">'
      +o(k,'ma',r.ma,'Mã','nbt-ma',' onpaste="spNhieuBTDan_(event,'+k+')"')
      +'<label class="nbt-mauw"><i style="'+(c?'background:'+c:'')+'"'+(c?'':' class="sp-mau-x"')+'></i>'+o(k,'mau',r.mau,'VD: Trắng','nbt-mau')+'</label>'
      +o(k,'bm',r.bm,'VD: Bóng','',' list="nbtBmList"')
      +o(k,'kt',r.kt,'VD: 5L')
      +o(k,'gia',r.gia,'0','num',' inputmode="numeric" onkeydown="if(event.key===\'Enter\'){event.preventDefault();spNhieuBTThem_();}"')
      +'<button class="cb-del" title="Bỏ dòng" onclick="spNhieuBTBo_('+k+')">'+icon('x',14)+'</button></div>'; }).join('');
}
function spNhieuBTSua_(k,f,v){ var r=S._nbt&&S._nbt.rows[k]; if(!r) return; r[f]=v;
  if(f==='mau'){ var dot=document.querySelectorAll('#nbtRows .nbt-mauw i')[k], c=spMauCss_(v); if(dot){ dot.style.background=c||''; dot.className=c?'':'sp-mau-x'; } } }
function spNhieuBTThem_(){ if(!S._nbt) return; var a=S._nbt.rows[S._nbt.rows.length-1]||{};
  S._nbt.rows.push(spNbtDong_({ma:a.ma, bm:a.bm, kt:a.kt})); spNhieuBTVe_();
  var ins=document.querySelectorAll('#nbtRows .nbt-ma'); if(ins.length){ ins[ins.length-1].focus(); ins[ins.length-1].select(); } }
function spNhieuBTBo_(k){ if(!S._nbt) return; S._nbt.rows.splice(k,1); if(!S._nbt.rows.length) S._nbt.rows.push(spNbtDong_({})); spNhieuBTVe_(); }
// dán từ Excel vào ô Mã: 5 cột Mã ⇥ Màu ⇥ Bề mặt ⇥ Dung tích ⇥ Giá · 3 cột Màu ⇥ Dung tích ⇥ Giá · 2 cột Màu ⇥ Giá
function spNhieuBTDan_(e,k){
  var t=(e.clipboardData||window.clipboardData).getData('text')||''; if(t.indexOf('\n')<0 && t.indexOf('\t')<0) return;
  e.preventDefault();
  var d0=S._nbt.rows[k]||spNbtDong_({});
  var moi=t.split(/\r?\n/).map(function(d){ return d.split('\t').map(function(x){ return String(x||'').trim(); }); })
    .filter(function(c){ return c.some(Boolean); }).map(function(c){
      if(c.length>=5) return {ma:c[0]||d0.ma, mau:c[1], bm:c[2], kt:c[3]||d0.kt, gia:c[4]};
      if(c.length>=3) return {ma:d0.ma, mau:c[0], bm:d0.bm, kt:c[1]||d0.kt, gia:c[2]};
      return {ma:d0.ma, mau:c[0], bm:d0.bm, kt:d0.kt, gia:c[1]||''}; });
  S._nbt.rows.splice.apply(S._nbt.rows,[k,1].concat(moi)); spNhieuBTVe_();
}
async function spNhieuBTLuu_(){
  var N=S._nbt; if(!N) return; var p=N.p, err=document.getElementById('nbtErr');
  var rows=N.rows.filter(function(r){ return [r.mau,r.gia].some(function(v){ return String(v||'').trim(); }) || (String(r.ma||'').trim() && String(r.ma).trim()!==p.ma); });
  function bao(m){ err.textContent=m; err.style.display='block'; }
  if(!rows.length) return bao('Nhập ít nhất 1 biến thể.');
  var thieu=rows.filter(function(r){ return !String(r.ma||'').trim() || !(tkNum_(r.gia)>0); });
  if(thieu.length) return bao('Mỗi dòng cần Mã SP và Giá bán lẻ > 0 (còn '+thieu.length+' dòng thiếu).');
  // Khoá trùng GIỐNG máy chủ: mã + màu + dung tích. Đã có -> bỏ qua (không ghi đè SP cũ), kèm gợi ý đổi mã.
  function khoa(ma,m,kt){ return spNorm_(ma)+'|'+spNorm_(m)+'|'+spNorm_(kt); }
  var co={}; (S.products||[]).forEach(function(x){ co[khoa(x.ma, x.mauSac, x.raw&&x.raw.kich_thuoc)]=1; });
  var trongDs={}, tao=[], trung=[];
  rows.forEach(function(r){ var kk=khoa(r.ma,r.mau,r.kt), nh=[r.ma,r.mau,r.bm,r.kt].filter(function(x){ return String(x||'').trim(); }).join(' · ');
    if(co[kk]||trongDs[kk]) trung.push(nh); else { trongDs[kk]=1; tao.push(r); } });
  if(!tao.length) return bao('Đã có sản phẩm trùng mã + màu + dung tích: '+trung.join('; ')+'. Biến thể khác bề mặt cần mã riêng (VD GJ8B).');
  var goc={}; Object.keys(p.raw||{}).forEach(function(col){ var lb=SP_COL2LABEL_[col]; if(lb && col!=='gia_dai_ly') goc[lb]=p.raw[col]; });
  goc['TÊN SẢN PHẨM']=p.ten; goc['ẢNH SẢN PHẨM']=p.anhTatCa||p.hinhAnh||'';
  var btn=document.getElementById('nbtOk'); btn.disabled=true;
  var ok=0, loi=[], moiIds=[], khacMa=false;
  for(var j=0;j<tao.length;j++){ var r=tao[j]; btn.textContent='Đang tạo '+(j+1)+'/'+tao.length+'…';
    var d=Object.assign({}, goc, {'MÃ SẢN PHẨM':String(r.ma).trim(), 'MÀU SẮC':String(r.mau||'').trim(), 'KÍCH THƯỚC':String(r.kt||'').trim(), 'GIÁ BÁN LẺ':tkNum_(r.gia)});
    if(String(r.bm||'').trim()) d['BỀ MẶT HOÀN THIỆN']=String(r.bm).trim();
    if(d['MÃ SẢN PHẨM']!==p.ma) khacMa=true;
    try{ var rs=await api('saveDbProduct', d); ok++; if(rs&&rs.id!=null) moiIds.push(String(rs.id)); }
    catch(e){ loi.push((r.ma||r.mau)+': '+String(e.message||e).slice(0,60)); } }
  // Gom 1 NHÓM biến thể (nhom_bt): SP gốc đã có nhóm gom tay, hoặc có biến thể KHÁC MÃ (không tự gom theo mã được)
  try{ S.products=await api('getProducts')||S.products;
    if(String(p.nhomBT||'').trim() || khacMa){
      var ids=(S.products||[]).filter(function(x){ var id=String(x.recordId); return id!==String(p.recordId)
          && (x.ma===p.ma || (p.nhomBT && x.nhomBT===p.nhomBT) || moiIds.indexOf(id)>=0); }).map(function(x){ return {id:x.recordId}; });
      await api('setBienThe', String(p.recordId), ids); S.products=await api('getProducts')||S.products;
      var goc2=(S.products||[]).filter(function(x){ return String(x.recordId)===String(p.recordId); })[0], nh2=goc2&&goc2.nhomBT;
      // form Cập nhật SP đang mở: cập nhật danh sách nhóm trong form, nếu không bấm "Lưu cập nhật" sẽ ghi đè mất biến thể mới
      if(String(S._spEditRecId)===String(p.recordId) && typeof btRender_==='function' && nh2){
        if(S._spEditP) S._spEditP.nhomBT=nh2;
        S._bt=(S.products||[]).filter(function(x){ return x.nhomBT===nh2 && String(x.recordId)!==String(p.recordId); })
          .map(function(x){ return {recordId:x.recordId, ma:x.ma, ten:x.ten, hinhAnh:x.hinhAnh, donGiaBan:x.donGiaBan, mauSac:x.mauSac, nganh:x.nganh, raw:x.raw}; }); } } }
  catch(e){ loi.push('Gom nhóm biến thể: '+String(e.message||e).slice(0,60)); }
  if(String(S._spEditRecId)===String(p.recordId) && typeof btRender_==='function') btRender_();   // form đang mở: hiện ngay biến thể mới
  spNhieuBTDong_(); spViewTabs_&&spViewTabs_(); spFilter(); if(typeof renderCatalog==='function') renderCatalog();
  toast('Đã tạo '+ok+' biến thể cho '+p.ma+(trung.length?(' · bỏ qua '+trung.length+' dòng đã có'):'')+(loi.length?(' · lỗi: '+loi.join('; ')):''));
}
// Các trục phân biệt biến thể — phải khác ít nhất 1 cái, nếu không sẽ GHI ĐÈ dòng gốc
var BT_TRUC=[['nhiet_do_mau_k','Nhiệt độ màu'],['cong_suat_w','Công suất'],['goc_chieu_deg','Góc chiếu'],
  ['mau_sac','Màu sắc'],['kich_thuoc','Kích thước']];
async function spEditModal(i, nhanBan){
  // nhận cả chỉ số trong bảng lẫn object sản phẩm (dùng từ panel "SP vừa nhập")
  var p=(i&&typeof i==='object') ? i : (S._spList||[])[i];
  if(!p) return;
  if(!p.ma){ toast('Sản phẩm chưa có mã — không cập nhật được'); return; }
  S._speNew=!!nhanBan; S._speCopy=(nhanBan==='copy');     // 'copy' = sản phẩm MỚI (mã mới), còn lại = biến thể cùng mã
  var ov=document.createElement('div'); ov.className='sp-modal-ov'; ov.id='spEditOv';
  ov.onclick=function(e){ if(e.target===ov) spEditClose(); };
  ov.innerHTML='<div class="sp-modal sp-edit pd"><div class="pd-head"><h3>'+icon(nhanBan?'plus':'edit',16)+' '
      +(nhanBan==='copy'?'Sao chép — tạo sản phẩm mới':(nhanBan?'Nhân bản — tạo biến thể mới':'Cập nhật sản phẩm'))+'</h3><button class="pd-x" onclick="spEditClose()">✕</button></div>'
    +'<div class="spe-2col"><div class="spe-body"><div class="empty" style="padding:24px">Đang tải…</div></div><aside class="spe-side" id="speSide"></aside></div></div>';
  document.body.appendChild(ov);
  var editKey = (p.recordId!=null && p.recordId!=='') ? String(p.recordId) : p.ma;   // id dòng = đúng biến thể
  var none=function(){ return null; };
  var got=await Promise.all([ api('getDbProduct', editKey).catch(none), api('getProductHistory', p.ma).catch(none),
    api('getCombo', editKey).catch(none), api('getBienThe', editKey).catch(none) ]);
  // Đã đóng modal / mở sản phẩm khác trong lúc tải -> bỏ, không đè trạng thái của modal đang mở
  if(!ov.isConnected) return;
  var raw=got[0], hist=got[1]||[];
  S._spEditRecId=p.recordId; S._spEditP=p; S._cbTab='combo';
  S._combo=(got[2]||[]).map(function(x){
    return {recordId:x.recordId, ma:x.ma, ten:x.ten, hinhAnh:x.hinhAnh, donGiaBan:x.donGiaBan, comboSL:x.comboSL||1,
            comboNguoc:!!x.comboNguoc, comboBoSL:x.comboBoSL}; });
  S._bt=(got[3]||[]).map(function(x){
    return {recordId:x.recordId, ma:x.ma, ten:x.ten, hinhAnh:x.hinhAnh, donGiaBan:x.donGiaBan,
            congSuat:x.congSuat, nhietDo:x.nhietDo, gocChieu:x.gocChieu, mauSac:x.mauSac}; });
  if(!raw){ ov.querySelector('.spe-body').innerHTML='<div class="empty" style="padding:24px">Không tải được dữ liệu sản phẩm.</div>';
    ov.querySelector('#speSide').innerHTML=''; return; }
  S._spEditMa=editKey;
  // tách anh_sp: ảnh đầu = đại diện, còn lại = ảnh chi tiết/mô tả (dùng chung bộ upload với trang Nhập dữ liệu)
  var imgsRaw=String(raw.anh_sp||'').split('\n').map(function(s){return s.trim();}).filter(Boolean);
  if(!S._imgBak) S._imgBak=[S._imgMain,S._imgList];   // giữ ảnh đang nhập dở ở tab Nhập, đóng modal thì trả lại
  S._imgMain=imgsRaw[0]||''; S._imgList=imgsRaw.slice(1);
  // ĐẦY ĐỦ trường, chia nhóm y hệt form Nhập dữ liệu
  var fields=groupsCuaSP_(p).map(function(gr){
    var inner=gr.f.map(function(f){ return speField_(f, raw); }).join('');
    if(!inner) return '';
    return '<div class="spe-grp"><div class="spe-grp-h">'+esc(gr.g)+'</div><div class="spe-fields">'+inner+'</div></div>';
  }).join('');
  var histHtml=hist.length?hist.map(function(h){
    return '<div class="spe-h"><div class="spe-h-top"><b>'+esc(h.field)+'</b><span class="spe-h-by">'+icon('clock',11)+' '+esc(h.by||'?')+' · '+fmtDateTime_(h.at)+'</span></div>'
      +'<div class="spe-h-diff"><span class="old">'+esc(h.old||'—')+'</span><span class="arr">→</span><span class="new">'+esc(h.new||'—')+'</span></div></div>';
  }).join(''):'<div class="empty" style="padding:14px;font-size:12.5px">Chưa có lịch sử cập nhật.</div>';
  ov.querySelector('#speSide').innerHTML=
    '<div class="spe-who">'
      +'<span>'+icon('plus',13)+' Tạo bởi <b>'+esc(p.nguoiTao||'—')+'</b>'+(p.ngayTao?' · '+esc(fmtDate(p.ngayTao)):'')+'</span>'
      +'<span>'+icon('edit',13)+' Sửa cuối bởi <b>'+esc(p.nguoiSua||'—')+'</b>'+(p.ngayCapNhat?' · '+esc(fmtDateTime_(p.ngayCapNhat)):'')+'</span>'
      +(p.daDuyet?'<span class="ok">'+icon('check',13)+' Duyệt bởi <b>'+esc(p.nguoiDuyet||'—')+'</b>'+(p.ngayDuyet?' · '+esc(fmtDateTime_(p.ngayDuyet)):'')+'</span>'
                : '<span class="warn">'+icon('clock',13)+' Chưa duyệt</span>')
    +'</div>'
    +'<div class="spe-hist"><div class="spe-hist-h">'+icon('clock',15)+' Lịch sử cập nhật <span class="spe-hist-n">'+hist.length+'</span></div>'
    +'<div class="spe-hist-list">'+histHtml+'</div></div>';
  var moi=!!S._speNew;
  ov.querySelector('.spe-body').innerHTML=(S._speCopy?('<div class="spe-note-new">'+icon('bell',14)
        +' Đang tạo <b>sản phẩm mới</b> từ <b>'+esc(p.ma||'')+'</b> — nhập <b>Mã sản phẩm mới</b> (không trùng mã có sẵn), sửa tên / thông số rồi bấm Tạo sản phẩm.</div>')
      :moi?('<div class="spe-note-new">'+icon('bell',14)
        +' Đang tạo <b>biến thể mới</b> cho mã <b>'+esc(p.ma||'')+'</b> — đổi phần khác biệt ('
        +BT_TRUC.map(function(t){ return t[1]; }).join(' · ')+') rồi bấm Tạo biến thể.</div>'):'')
    +spEditImgSection_()
    +fields
    +(moi?'':cbSection_())
    +'<div class="spe-actions">'
      +'<button class="btn ghost sm" onclick="spEditClose()">Huỷ</button>'
      +((!moi&&spCanDuyet_())?'<button class="btn ghost sm" id="speDuyetBtn" onclick="spEditSave(1)" title="Lưu thay đổi rồi đánh dấu Đã duyệt">'+icon('check',14)+' Lưu &amp; duyệt</button>':'')
      +'<button class="btn blue" id="speSaveBtn" onclick="spEditSave()">'+icon('check',15)+' '+(S._speCopy?'Tạo sản phẩm':(moi?'Tạo biến thể':'Lưu cập nhật'))+'</button></div>';
  if(S._speCopy){ var maIn=ov.querySelector('[data-col="ma_sp"]');            // mã mới: mở khoá, để trống, đặt con trỏ vào
    if(maIn){ maIn.readOnly=false; maIn.value=''; maIn.placeholder='Mã mới, VD: '+(p.ma||'')+'-2'; setTimeout(function(){ maIn.focus(); },50); } }
  var ngSP=nganhCuaSP_(p);
  if(ngSP==='vs'||ngSP==='son'){ var hmSel=ov.querySelector('[data-col="hang_muc"]'); vsApplyHM_(ov, hmSel?hmSel.value:raw.hang_muc, 1, ngSP); }
  ov.querySelectorAll('.docf').forEach(docRender_);
  cbRender_(); btRender_(); cbTab_((S._bt||[]).length&&!(S._combo||[]).length?'bt':'combo');
  document.addEventListener('mousedown',cbOutside_);
  S._speSnap=speSnap_(ov);            // mốc so sánh -> đóng modal mà còn thay đổi thì hỏi lại
}
/* Toàn bộ nội dung đang nhập trong modal (ô nhập + ảnh + file + combo + biến thể).
   Dùng để biết người dùng có thay đổi gì chưa lưu hay không.                      */
function speSnap_(ov){
  if(!ov) return '';
  var v=[].map.call(ov.querySelectorAll('[data-col]'), function(e){ return e.getAttribute('data-col')+'='+(e.value||''); }).join('|');
  return v+'||img:'+(S._imgMain||'')+','+((S._imgList||[]).join(','))
         +'||cb:'+((S._combo||[]).map(function(x){ return x.recordId+'x'+(x.comboSL||1); }).join(','))
         +'||bt:'+((S._bt||[]).map(function(x){ return x.recordId; }).join(','));
}
// bấm ra ngoài thì đóng gợi ý tìm sản phẩm
function cbOutside_(e){
  if(e.target.closest('.cb-find')) return;
  ['cbSug','btSug'].forEach(function(id){ var b=document.getElementById(id); if(b) b.style.display='none'; });
}
// 2 vùng ảnh (đại diện + chi tiết) — DÙNG ĐÚNG layout .imgup của trang Nhập dữ liệu (2 cột đều, đồng nhất)
function spEditImgSection_(){ return imgUpBlock_('spe-imgup'); }
// Giá đại lý = Giá bán lẻ × (1 − CK%) — tính lại ngay trong modal Sửa (giống form Nhập)
function speCalcDaiLy_(){
  var ov=document.getElementById('spEditOv'); if(!ov) return;
  function v(c){ var e=ov.querySelector('[data-col="'+c+'"]'); return e?(Number(e.value)||0):0; }
  var out=ov.querySelector('[data-col="gia_dai_ly"]'); if(!out) return;
  var g=v('gia_ban_le'), ck=v('ck_dai_ly_pct');
  out.value = g? Math.round(g*(1-ck/100)) : '';
}
async function spEditClose(epBo){
  var o=document.getElementById('spEditOv');
  // Tải file / thêm ảnh xong mà đóng modal là MẤT — trước đây đóng lặng lẽ nên người dùng
  // tưởng file đã vào sản phẩm (toast chỉ báo "đã tải lên kho").
  if(o && !epBo && S._speSnap!=null && speSnap_(o)!==S._speSnap){
    if(!await xacNhan_({ title:'Thoát mà chưa lưu?',
      note:'Có thay đổi chưa lưu (kể cả ảnh / file vừa tải lên). Thoát bây giờ là mất những thay đổi đó.',
      ok:'Thoát, không lưu', huy:'Ở lại' })) return;
  }
  S._speSnap=null; document.removeEventListener('mousedown',cbOutside_);
  o=document.getElementById('spEditOv'); if(o)o.remove();
  if(S._imgBak){ S._imgMain=S._imgBak[0]; S._imgList=S._imgBak[1]||[]; S._imgBak=null; }
}
async function spEditSave(luuVaDuyet){
  var ov=document.getElementById('spEditOv'); if(!ov) return;
  var data={};
  ov.querySelectorAll('[data-col]').forEach(function(el){
    var col=el.getAttribute('data-col'); if(col==='gia_dai_ly') return;   // cột tự tính, không gửi
    var lbl=SP_COL2LABEL_[col]; if(!lbl) return;
    // Thiết bị vệ sinh: thông số KHÔNG thuộc hạng mục đang chọn -> xoá, giữ dữ liệu đúng bộ của hạng mục
    data[lbl]=(el.closest('.vs-off'))?'':el.value;
  });
  var btn=document.getElementById('speSaveBtn'); if(btn){ btn.disabled=true; btn.textContent='Đang lưu…'; }
  if((S._imgUploading||0)>0){ if(btn) btn.textContent='⏳ Đợi tải ảnh…'; await waitUploads_(15000); }
  // gộp ảnh: đại diện (đầu) + chi tiết; bỏ preview base64 chưa upload xong
  var imgs=[S._imgMain].concat(S._imgList||[]).filter(Boolean).filter(function(v){ return v.indexOf('data:')!==0; });
  data['ẢNH SẢN PHẨM']=imgs.join('\n');
  if(btn) btn.textContent='Đang lưu…';
  var lai=function(){ if(btn){ btn.disabled=false; btn.innerHTML=icon('check',15)+' '+(S._speCopy?'Tạo sản phẩm':(S._speNew?'Tạo biến thể':'Lưu cập nhật')); } };
  // ── SAO CHÉP thành SP MỚI: bắt buộc mã mới, không trùng (trùng mã = biến thể / ghi đè SP khác)
  if(S._speCopy){
    var maMoi=String(data['MÃ SẢN PHẨM']||'').trim();
    var trungMa=maMoi && (S.products||[]).some(function(x){ return spNorm_(x.ma)===spNorm_(maMoi); });
    if(!maMoi || trungMa){ lai();
      await baoLoi_({ title:maMoi?'Mã đã có':'Chưa nhập mã mới', ok:'Đã hiểu', nguyHiem:false,
        note:maMoi?('Mã "'+maMoi+'" đã có trong danh sách. Sản phẩm mới cần mã KHÁC; muốn thêm màu / kích thước cho mã này thì dùng "Tạo biến thể".')
                  :'Nhập Mã sản phẩm mới (khác mã gốc) rồi bấm Tạo sản phẩm.' });
      var mi_=ov.querySelector('[data-col="ma_sp"]'); if(mi_) mi_.focus(); return; }
    try{ await api('saveDbProduct', data);
      S.products=await api('getProducts')||S.products; spViewTabs_(); spFilter();
      if(typeof renderCatalog==='function') renderCatalog();
      spEditClose(1); toast('Đã tạo sản phẩm mới '+maMoi+' (chép từ '+((S._spEditP&&S._spEditP.ma)||'')+')');
    }catch(e){ toast('Lỗi tạo sản phẩm: '+String(e.message||e).slice(0,110)); lai(); }
    return;
  }
  // ── NHÂN BẢN: tạo DÒNG MỚI cùng mã. Phải khác ít nhất 1 trục biến thể, nếu không
  //    máy chủ coi là cùng một biến thể và GHI ĐÈ dòng gốc (mất dữ liệu cũ).
  if(S._speNew){
    var goc=(S._spEditP&&S._spEditP.raw)||{};
    var khac=BT_TRUC.filter(function(t){
      var e=ov.querySelector('[data-col="'+t[0]+'"]'); if(!e) return false;
      return String(e.value||'').trim()!==String(goc[t[0]]==null?'':goc[t[0]]).trim();
    });
    if(!khac.length){
      lai();
      await baoLoi_({ title:'Chưa khác gì so với bản gốc', ok:'Đã hiểu', nguyHiem:false,
        note:'Biến thể phải khác bản gốc ít nhất một trong các mục sau, nếu không sẽ ghi đè lên chính sản phẩm cũ:',
        dong:BT_TRUC.map(function(t){ return t[1]; }) });
      return;
    }
    try{
      var rn=await api('saveDbProduct', data);
      S.products=await api('getProducts')||S.products; spViewTabs_(); spFilter();
      if(typeof renderCatalog==='function') renderCatalog();
      spEditClose(1);
      toast(rn&&rn.created ? ('Đã tạo biến thể mới — khác ở: '+khac.map(function(t){ return t[1]; }).join(', '))
                           : 'Đã lưu (máy chủ nhận ra biến thể này đã có nên cập nhật lại)');
    }catch(e){ toast('Lỗi tạo biến thể: '+e.message.slice(0,110)); lai(); }
    return;
  }
  try{
    var r=await api('updateDbProductTracked', S._spEditMa, data);

    try{ await api('setCombo', S._spEditMa, (S._combo||[]).map(function(x){ return {id:x.recordId, soLuong:x.comboSL}; })); S._catCb={}; }   // bỏ bản combo đã nhớ -> Bóc tách hiện đúng bản vừa lưu
    catch(e){ toast('Lưu sản phẩm đi kèm lỗi: '+e.message.slice(0,90)); }
    try{ await api('setBienThe', S._spEditMa, (S._bt||[]).map(function(x){ return {id:x.recordId}; })); }
    catch(e){ toast('Lưu nhóm biến thể lỗi: '+e.message.slice(0,90)); }
    /* BẤM "Lưu và duyệt" thì PHẢI duyệt, kể cả khi không có trường nào đổi.
       Trước đây bước duyệt nằm trong nhánh r.updated: mở sản phẩm ra, không sửa gì (hoặc chỉ
       đổi combo / biến thể) rồi bấm Lưu và duyệt -> máy chủ trả updated:false -> nhảy sang
       nhánh "Đã lưu sản phẩm đi kèm" và KHÔNG duyệt. Bấm mấy lần cũng vậy. */
    var duyetLoi='';
    if(luuVaDuyet){
      try{
        var rd=await api('setSpDuyet',[String(S._spEditMa)],true);
        // ok=0 kèm daDung>0 nghĩa là SP đã ở trạng thái đã duyệt -> KHÔNG phải lỗi
        if(rd && rd.errors && rd.errors.length) duyetLoi=String(rd.errors[0].error||'').slice(0,120);
        else if(rd && !rd.ok && !rd.daDung) duyetLoi='Máy chủ không đổi được trạng thái duyệt';
      }catch(e){ duyetLoi=e.message.slice(0,120); }
    }
    if(duyetLoi) await baoLoi_({ title:'Chưa duyệt được sản phẩm', ok:'Đã hiểu',
      note:(r&&r.updated?('Đã lưu '+r.changes+' trường nhưng bước duyệt lỗi:\n'):'Không lưu được trạng thái duyệt:\n')+duyetLoi });
    else toast((r&&r.updated)
      ? ('Đã cập nhật '+r.changes+' trường'+(luuVaDuyet?' và duyệt':(r.daDuyet===false?' — sản phẩm chuyển về Chưa duyệt':'')))
      : (luuVaDuyet?'Đã duyệt sản phẩm':'Không có trường nào thay đổi'));
    S.products=await api('getProducts')||S.products; spViewTabs_(); spFilter();
    if(typeof renderCatalog==='function') renderCatalog();
    impSyncSession_(S._spEditMa); spEditClose(1);
  }catch(e){ toast('Lỗi lưu: '+e.message); lai(); }
}
async function spDelete(i){
  var p=(S._spList||[])[i]; if(!p) return;
  if(!await xacNhan_('Xoá sản phẩm "'+p.ten+'" khỏi danh mục?')) return;
  try{ await api('deleteDbProduct', String(p.recordId||p.ma)); S.products=await api('getProducts')||S.products;
    toast('Đã xoá: '+p.ten); spFilter(); renderFilters&&renderFilters(); renderCatalog&&renderCatalog(); }
  catch(e){ toast('Lỗi xoá: '+e.message); }
}
function hideDetail(){ S._detailIdx=null; document.getElementById('pdPanel').style.display='none'; document.getElementById('bocGrid').classList.remove('detail'); document.removeEventListener('keydown',pdPanelKey_); }
