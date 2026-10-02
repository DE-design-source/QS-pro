/* ═══ TAB NHẬP DỮ LIỆU — form SP (đèn / vệ sinh / sơn), tài liệu SP, ảnh (upload dùng chung),
   nhập file Excel, danh sách chờ lưu (SP + công tác), sinh biến thể. ═══ */
'use strict';

/* ==== Nhập dữ liệu -> bảng DB_SẢN PHẨM (Lark). Trường khoá theo ĐÚNG tên cột Lark. ==== */
var DB_GROUPS=[
  {g:'Thông tin cơ bản', f:[
    ['THƯƠNG HIỆU','Thương hiệu','text',1],['NHÀ CUNG CẤP','Nhà cung cấp','text',1],
    ['HẠNG MỤC','Hạng mục','sel',1,['Đèn nội thất','Đèn ngoại thất','Đèn kỹ thuật']],
    ['DÒNG SẢN PHẨM','Dòng sản phẩm','text',1],['NHÓM SẢN PHẨM','Nhóm sản phẩm','text',0,null,'Để trống = lấy theo Dòng sản phẩm'],
    ['TÊN SẢN PHẨM','Tên sản phẩm','text',1],['MÃ SẢN PHẨM','Mã sản phẩm','text',1] ]},
  {g:'Thông tin giá bán', note:'Giá đại lý tự tính = Giá bán lẻ × (1 − %Chiết khấu).', f:[
    ['GIÁ BÁN LẺ','Giá bán lẻ','num',1],['CHIẾT KHẤU ĐẠI LÝ (%)','%Chiết khấu','num',1],['GIÁ ĐẠI LÝ','Giá đại lý','calc',1] ]},
  {g:'Key Product Info (Thông tin chính)', f:[
    ['CÔNG SUẤT (W)','Công suất','text',1,null,'VD: 7  ·  2×5  ·  9/18'],['NHIỆT ĐỘ MÀU (K)','Nhiệt độ màu','sel',1,['2700','3000','4000','5000','6500']],
    ['GÓC CHIẾU (°)','Góc chiếu','text',1],['MÀU SẮC','Màu sắc','text',1],['CHẤT LIỆU','Chất liệu','text',1] ]},
  {g:'Thông số thiết kế', f:[
    ['GÓC NGHIÊNG (°)','Góc nghiêng','text',0],['CHIỀU CAO (mm)','Chiều cao','num',0],['ĐƯỜNG KÍNH (mm)','Đường kính','num',1] ]},
  {g:'Performance Specifications (Thông số hiệu suất)', f:[
    ['QUANG THÔNG (lm)','Quang thông','num',1],['CHỈ SỐ IP','Chỉ số IP (Chống bụi, nước)','sel',1,['IP20','IP44','IP54','IP65']],['CRI','CRI','text',1],
    ['HIỆU SUẤT PHÁT QUANG (lm/W)','Hiệu suất phát quang (lm/W)','num',0],['UGR','UGR','text',0],['SDCM','SDCM','text',0],
    ['COI','COI','text',0],['TUỔI THỌ','Tuổi thọ','text',0],
    ['TÊN CHIP LED','Tên chip LED','sel',0,['Bridgelux','Citizen','Cree','Osram','Samsung','Lumileds','Nichia','Seoul Semiconductor','Epistar','San An'],'Hãng / model chip, VD: Samsung LM301B'],
    ['LOẠI CHIP LED','Loại chip LED','sel',0,['COB','SMD','SMD 2835','SMD 3030','SMD 5730','Modul']] ]},
  {g:'Driver (Nguồn LED / Chấn lưu)', f:[
    ['LẮP NGUỒN RỜI','Lắp nguồn rời','sel',0,['Có','Không']],['TÊN BỘ NGUỒN','Tên bộ nguồn','text',0],['MÃ BỘ NGUỒN','Mã bộ nguồn','text',0],
    ['HÃNG BỘ NGUỒN','Hãng bộ nguồn','text',0],['GIÁ BÁN BỘ NGUỒN','Giá bán bộ nguồn','num',0,null,'VNĐ — giá bán rời của bộ nguồn'],
    ['VỊ TRÍ LẮP NGUỒN','Vị trí lắp nguồn','sel',0,['Lắp rời','Tích hợp trong thân đèn']],
    ['TƯƠNG THÍCH ĐIỀU KHIỂN','Tương thích điều khiển','sel',0,['DALI','0-10V','Triac','On-Off']],['DÒNG RA TỐI ĐA (mA)','Dòng ra tối đa (mA)','num',0] ]},
  {g:'Installation Specifications (Thông số lắp đặt)', f:[
    ['LỖ KHOÉT TRẦN (mm)','Lỗ khoét trần (Cutout)','text',1,null,'VD: Ø75  ·  Ø40×78  ·  60×60'],
    ['CẤP BẢO VỆ ĐIỆN','Cấp bảo vệ điện','sel',0,['Class I','Class II','Class III']] ]},
  {g:'Thương mại', f:[
    ['BẢO HÀNH (năm)','Bảo hành (năm)','num',0],['ĐƠN VỊ TÍNH','Đơn vị tính','sel',1,['Cái','Bộ','Mét']],
    ['TRẠNG THÁI','Trạng thái','sel',0,['Đang kinh doanh','Ngưng kinh doanh','Đặt hàng']],
    ['GHI CHÚ','Ghi chú','area',0] ]},
  {g:'Tài liệu', note:'Tải file lên (PDF, ảnh, bản vẽ DWG/DXF, ZIP…) hoặc dán link — hiện thành nút mở trong Thông tin sản phẩm.', f:[
    ['LINK DATASHEET','Tài liệu kỹ thuật / Catalogue','doc',0],['THÔNG SỐ KỸ THUẬT','Thông số kỹ thuật','doc',0],
    ['HƯỚNG DẪN CÀI ĐẶT','Hướng dẫn cài đặt','doc',0],['FILE BẢN VẼ','File bản vẽ','doc',0] ]},
];
var DB_FLAT=[]; DB_GROUPS.forEach(function(gr){ gr.f.forEach(function(f){ DB_FLAT.push(f); }); });

/* ═══ NGÀNH THIẾT BỊ VỆ SINH (hạng mục 3.2.5) ═══
   MỖI HẠNG MỤC có bộ thông số riêng — định nghĩa DUY NHẤT ở public/vs-spec.js (VS_SPEC),
   dùng chung với file mẫu nhập hàng loạt và server:
     · Key Product Info  (chinh) -> cột "Thông tin chính" của bảng bóc tách
     · Thông số thiết kế (tk)    -> cột "Thông số thiết kế"
   Hai nhóm dưới đây là HỢP của mọi hạng mục (để bảng Danh sách SP có đủ cột); form Nhập /
   modal Sửa chỉ HIỆN thông số của hạng mục đang chọn (vsApplyHM_).                       */
function vsGomNhom_(k){ return k==='chinh'?VS_SPEC.CHINH_ALL:VS_SPEC.TK_ALL; }
function vsField_(lb){ var m=VS_SPEC.METRIC[lb]; return [lb, m[1], m[2], 0, [], m[3]||'', 'vs']; }
var DB_GROUPS_VS=[
  {g:'Thông tin cơ bản', f:[
    ['THƯƠNG HIỆU','Thương hiệu','text',1],['NHÀ CUNG CẤP','Nhà cung cấp','text',1],
    ['HẠNG MỤC','Hạng mục','hm',1,VS_SPEC.HANG_MUC],
    ['DÒNG SẢN PHẨM','Dòng sản phẩm','text',1,null,'VD: Bồn cầu treo tường'],
    ['NHÓM SẢN PHẨM','Nhóm sản phẩm','text',0,null,'Để trống = lấy theo Dòng sản phẩm'],
    ['TÊN SẢN PHẨM','Tên sản phẩm','text',1],['MÃ SẢN PHẨM','Mã sản phẩm','text',1] ]},
  {g:'Thông tin giá bán', note:'Giá đại lý tự tính = Giá bán lẻ × (1 − %Chiết khấu).', f:[
    ['GIÁ BÁN LẺ','Giá bán lẻ','num',1],['CHIẾT KHẤU ĐẠI LÝ (%)','%Chiết khấu','num',1],['GIÁ ĐẠI LÝ','Giá đại lý','calc',0] ]},
  {g:'Key Product Info (Thông tin chính)', vs:1, note:'Thông số theo hạng mục đã chọn — lên cột "Thông tin chính" của bảng bóc tách.',
    f:vsGomNhom_('chinh').map(vsField_)},
  {g:'Thông số thiết kế', vs:1, note:'Thông số theo hạng mục đã chọn — lên cột "Thông số thiết kế" của bảng bóc tách.',
    f:vsGomNhom_('tk').map(vsField_)},
  {g:'Tính năng', note:'Mỗi dòng một tính năng — hiện ở phần Thông tin sản phẩm (mở rộng).', f:[
    ['TÍNH NĂNG','Tính năng','area',0,null,'• Men sứ chống dính CEFIONTECT\n• Hệ thống xả Tornado siêu êm'] ]},
  {g:'Thương mại', f:[
    ['BẢO HÀNH (năm)','Bảo hành (năm)','num',0],
    ['ĐƠN VỊ TÍNH','Đơn vị tính','sel',1,['Cái','Bộ','Chiếc']],
    ['TRẠNG THÁI','Trạng thái','sel',0,['Đang kinh doanh','Ngưng kinh doanh','Đặt hàng']],
    ['GHI CHÚ','Ghi chú','area',0] ]},
  {g:'Tài liệu', note:'Tải file lên (PDF, ảnh, bản vẽ DWG/DXF, ZIP…) hoặc dán link — hiện thành nút mở trong Thông tin sản phẩm.', f:[
    ['LINK DATASHEET','Tài liệu kỹ thuật / Catalogue','doc',0],['THÔNG SỐ KỸ THUẬT','Thông số kỹ thuật','doc',0],
    ['HƯỚNG DẪN CÀI ĐẶT','Hướng dẫn cài đặt','doc',0],['FILE BẢN VẼ','File bản vẽ','doc',0] ]},
];
var DB_FLAT_VS=[]; DB_GROUPS_VS.forEach(function(gr){ gr.f.forEach(function(f){ DB_FLAT_VS.push(f); }); });
/* ═══ SƠN NƯỚC (đề mục 3.2.2) — cùng cách làm với thiết bị vệ sinh ═══
   Thông số khai báo DUY NHẤT ở public/son-spec.js (SON_SPEC); form Nhập / modal Sửa chỉ hiện
   thông số của hạng mục đang chọn, file mẫu và server đọc cùng nguồn đó.                  */
function sonField_(lb){ var m=SON_SPEC.METRIC[lb]; return [lb, m[1], m[2], 0, [], m[3]||'', 'vs']; }
var DB_GROUPS_SON=[
  {g:'Thông tin cơ bản', f:[
    ['THƯƠNG HIỆU','Thương hiệu','text',1],['NHÀ CUNG CẤP','Nhà cung cấp','text',1],
    ['HẠNG MỤC','Hạng mục','hm',1,SON_SPEC.HANG_MUC],
    ['DÒNG SẢN PHẨM','Dòng sản phẩm','text',1,null,'VD: Sơn ngoại thất'],
    ['NHÓM SẢN PHẨM','Nhóm sản phẩm','text',0,null,'Để trống = lấy theo Dòng sản phẩm'],
    ['TÊN SẢN PHẨM','Tên sản phẩm','text',1],['MÃ SẢN PHẨM','Mã sản phẩm','text',1] ]},
  {g:'Thông tin giá bán', note:'Giá đại lý tự tính = Giá bán lẻ × (1 − %Chiết khấu).', f:[
    ['GIÁ BÁN LẺ','Giá bán lẻ','num',1],['CHIẾT KHẤU ĐẠI LÝ (%)','%Chiết khấu','num',1],['GIÁ ĐẠI LÝ','Giá đại lý','calc',0] ]},
  {g:'Key Product Info (Thông tin chính)', vs:1, note:'Thông số theo hạng mục đã chọn — lên cột "Thông tin chính" của bảng bóc tách.',
    f:SON_SPEC.CHINH_ALL.map(sonField_)},
  {g:'Tính chất vật lý & hoá học', vs:1, note:'Theo mục IX của bảng dữ liệu an toàn — lên cột "Thông số thiết kế" của bảng bóc tách.',
    f:SON_SPEC.TK_ALL.map(sonField_)},
  {g:'Tính năng', note:'Mỗi dòng một tính năng — hiện ở phần Thông tin sản phẩm (mở rộng).', f:[
    ['TÍNH NĂNG','Tính năng','area',0,null,'• Chống nấm mốc\n• Chống bám bụi\n• Sắc màu bền đẹp'] ]},
  {g:'Thương mại', f:[
    ['BẢO HÀNH (năm)','Bảo hành (năm)','num',0],
    ['ĐƠN VỊ TÍNH','Đơn vị tính','sel',1,['Thùng','Lon','Bao','Bộ','Lít','Kg']],
    ['TRẠNG THÁI','Trạng thái','sel',0,['Đang kinh doanh','Ngưng kinh doanh','Đặt hàng']],
    ['GHI CHÚ','Ghi chú','area',0] ]},
  {g:'Tài liệu', note:'Tải file lên (PDF, ảnh, bảng dữ liệu an toàn, ZIP…) hoặc dán link — hiện thành nút mở trong Thông tin sản phẩm.', f:[
    ['LINK DATASHEET','Tài liệu kỹ thuật / Catalogue','doc',0],['THÔNG SỐ KỸ THUẬT','Thông số kỹ thuật','doc',0],
    ['HƯỚNG DẪN CÀI ĐẶT','Hướng dẫn thi công','doc',0],['FILE BẢN VẼ','Bảng màu / File bản vẽ','doc',0] ]},
];
var DB_FLAT_SON=[]; DB_GROUPS_SON.forEach(function(gr){ gr.f.forEach(function(f){ DB_FLAT_SON.push(f); }); });
/* Ngành hàng đang chọn ở trang Nhập dữ liệu -> bộ trường / bộ nhóm tương ứng */
function impGroups_(){ var l=impLoai_(); return l==='son'?DB_GROUPS_SON:(l==='vs'?DB_GROUPS_VS:DB_GROUPS); }
function impFlat_(){ var l=impLoai_(); return l==='son'?DB_FLAT_SON:(l==='vs'?DB_FLAT_VS:DB_FLAT); }
/* Bộ thông số theo ngành — mọi chỗ cần "hạng mục nào có thông số gì" đều đi qua đây */
function specNganh_(ng){ return ng==='son'?SON_SPEC:VS_SPEC; }
function nganhCuaSP_(p){
  if(!p) return 'den';
  var n=String(p.nganh||'').trim(); if(n==='son'||n==='vs') return n;
  if(!n && SON_SPEC.chuanHM(p.hangMuc)) return 'son';
  return VS_SPEC.nganhOf(p.nganh,p.hangMuc)==='vs'?'vs':'den';
}
function groupsCuaSP_(p){ var ng=nganhCuaSP_(p); return ng==='son'?DB_GROUPS_SON:(ng==='vs'?DB_GROUPS_VS:DB_GROUPS); }
function dbInput(f){
  var i=impFlat_().indexOf(f), lark=f[0], label=f[1], type=f[2], req=f[3], opts=f[4]||[];
  var ph=f[5]||label;                       // gợi ý nhập riêng (nếu có)
  var id='dbf_'+i, star=req?' <span style="color:#c33">*</span>':'', inner;
  var trg=(lark==='GIÁ BÁN LẺ'||lark==='CHIẾT KHẤU ĐẠI LÝ (%)')?' oninput="dbCalcDaiLy()"':'';
  if(type==='calc') inner='<input id="'+id+'" class="calc" type="number" placeholder="Tự tính từ giá bán & %CK" readonly>';
  else if(type==='area') inner='<textarea id="'+id+'" placeholder="'+esc(label)+'" style="min-height:54px"></textarea>';
  else if(type==='doc') inner=docInput_('id="'+id+'"','');
  else if(type==='hm') inner='<select id="'+id+'" onchange="vsApplyHM_(document.getElementById(\'v-import\'),this.value);sonTplSync_()"><option value="">— Chọn hạng mục —</option>'
      +opts.map(function(o){return '<option value="'+esc(o)+'">'+esc(o)+'</option>';}).join('')+'</select>';
  else if(type==='sel') inner='<input id="'+id+'" list="dl_'+i+'" placeholder="'+esc(f[6]==='vs'?(ph||label):label)+'"><datalist id="dl_'+i+'">'+opts.map(function(o){return '<option value="'+esc(o)+'">';}).join('')+'</datalist>';
  else inner='<input id="'+id+'"'+(type==='num'?' type="number"':'')+trg+' placeholder="'+esc(ph)+'">';
  return '<div class="field'+(type==='doc'?' docfield':'')+'"'+(f[6]==='vs'?' data-vs="'+esc(lark)+'"':'')+'><label>'+esc(label)+star+'</label>'+inner+'</div>';
}
/* ═══ TÀI LIỆU SẢN PHẨM — mỗi trường chứa NHIỀU file (mỗi dòng 1 link: file tải lên kho hoặc link dán) ═══ */
var DOC_GROUPS=[['link_datasheet','linkDatasheet','Tài liệu kỹ thuật'],['thong_so_file','thongSoFile','Thông số kỹ thuật'],
  ['huong_dan_lap_dat','huongDanLapDat','Hướng dẫn cài đặt'],['file_ban_ve','fileBanVe','File bản vẽ']];
function docList_(v){ return String(v||'').split(/\r?\n|\s*;\s*/).map(function(x){ return x.trim(); }).filter(Boolean); }
// Toàn bộ file của 1 sản phẩm: [{g:'Hướng dẫn cài đặt', url}]
function prodDocs_(p){ var raw=(p&&p.raw)||{}, out=[];
  DOC_GROUPS.forEach(function(d){ docList_(raw[d[0]]||(p&&p[d[1]])).forEach(function(u){ out.push({g:d[2], url:u}); }); });
  return out; }
// Dòng bóc tách -> sản phẩm gốc trong danh mục (theo mã SP, dự phòng theo tên) -> tài liệu
function lineProd_(l){ var ma=String(l.maSP||'').trim().toLowerCase(), ten=String(l.ten||'').trim().toLowerCase(), ds=S.products||[], p=null;
  if(ma) p=ds.filter(function(x){ return String(x.ma||'').trim().toLowerCase()===ma && prodDocs_(x).length; })[0]||ds.filter(function(x){ return String(x.ma||'').trim().toLowerCase()===ma; })[0];
  if(!p && ten) p=ds.filter(function(x){ return String(x.ten||'').trim().toLowerCase()===ten; })[0];
  return p||null; }
function lineDocs_(l){ var p=lineProd_(l); return p?prodDocs_(p):[]; }
function docExt_(u){ var m=/\.([a-z0-9]{2,4})(?:$|[?#])/i.exec(String(u||'').split('?')[0]); return m?m[1].toLowerCase():'link'; }
// Danh sách file (dùng chung panel chi tiết SP và popup ở cột Tài liệu)
function docRowsHtml_(docs){
  var g='';
  return docs.map(function(d){
    var h=(d.g!==g)?'<div class="tl-g">'+esc(d.g)+'</div>':''; g=d.g; var ext=docExt_(d.url);
    return h+'<div class="tl-row"><span class="tl-ext e-'+esc(ext)+'">'+esc(ext==='link'?'LINK':ext.toUpperCase())+'</span>'
      +'<a class="tl-nm" href="'+esc(safeUrl_(d.url))+'" target="_blank" rel="noopener" title="Mở '+esc(docName_(d.url))+'">'+esc(docName_(d.url))+'</a>'
      +'<a class="tl-act" href="'+esc(safeUrl_(d.url))+'" target="_blank" rel="noopener" download title="Tải về">'+icon('download',13)+'</a></div>';
  }).join('');
}
function tlPop_(e,lineId){
  closePop();
  var l=(S.lines||[]).filter(function(x){ return String(x.lineId)===String(lineId); })[0]; if(!l) return;
  var docs=lineDocs_(l);
  var pop=document.createElement('div'); pop.className='fltpop tl-pop'; pop.id='qs_pop';
  pop.innerHTML='<div class="bgt-h"><b>Tài liệu · '+esc(l.ten||'')+'</b><button class="colpop-x" onclick="closePop()">✕</button></div>'
    +'<div class="tl-body">'+(docs.length?docRowsHtml_(docs):'<div class="tl-empty">Sản phẩm chưa có tài liệu.</div>')+'</div>';
  document.body.appendChild(pop);
  var r=e.currentTarget.getBoundingClientRect(), w=pop.offsetWidth||340, h=pop.offsetHeight;
  var top=r.bottom+6; if(top+h>window.innerHeight-10) top=Math.max(10,r.top-h-6);
  pop.style.top=top+'px'; pop.style.left=Math.max(8,Math.min(r.left,window.innerWidth-w-10))+'px';
  setTimeout(function(){ document.addEventListener('mousedown',popOutside); },0);
}
/* ═══ Ô TÀI LIỆU: tải file lên kho (/upload/file) HOẶC dán link — dùng ở form Nhập & modal Sửa ═══ */
function docName_(u){ u=String(u||'').trim(); if(!u) return '';
  var t=u.split('?')[0].split('/').pop()||u; try{ t=decodeURIComponent(t); }catch(e){}
  return t.replace(/^\d{10,}-/,''); }                    // bỏ tiền tố thời gian của file đã tải lên
// Ô tài liệu nhiều file: input ẩn (giữ giá trị, mỗi dòng 1 link) + danh sách file (xoá từng file) + dán link / tải file
function docInput_(attr,val){
  return '<div class="docf"><input type="hidden" class="docf-v" '+attr+' value="'+esc(val||'')+'">'
    +'<div class="docf-list"></div>'
    +'<div class="docf-add"><input class="docf-url" placeholder="Dán link rồi Enter" onkeydown="if(event.key===\'Enter\'){event.preventDefault();docAddUrl_(this)}">'
      +'<button type="button" class="docf-b" onclick="docAddUrl_(this.previousElementSibling)" title="Thêm link đã dán">Thêm link</button>'
      +'<button type="button" class="docf-b up" onclick="docPick_(this)" title="Tải 1 hoặc nhiều file lên (PDF, ảnh, DWG/DXF, ZIP…, mỗi file tối đa 20MB)">'+icon('download',14)+' Tải file</button></div>'
    +'</div>';
}
function docWrap_(el){ return el&&el.closest?el.closest('.docf'):null; }
function docRender_(w){
  if(!w) return; var v=w.querySelector('.docf-v'), ds=docList_(v&&v.value), box=w.querySelector('.docf-list');
  if(box) box.innerHTML=ds.map(function(u,i){ var ext=docExt_(u);
    return '<div class="docf-it"><span class="tl-ext e-'+esc(ext)+'">'+esc(ext==='link'?'LINK':ext.toUpperCase())+'</span>'
      +'<a href="'+esc(safeUrl_(u))+'" target="_blank" rel="noopener" title="Mở: '+esc(docName_(u))+'">'+esc(docName_(u))+'</a>'
      +'<button type="button" title="Bỏ file này" onclick="docDel_(this,'+i+')">✕</button></div>'; }).join('');
}
function docSet_(w,ds){ var v=w.querySelector('.docf-v'); if(!v) return; v.value=ds.join('\n'); docRender_(w);
  try{ v.dispatchEvent(new Event('input',{bubbles:true})); }catch(e){} }
function docDel_(btn,i){ var w=docWrap_(btn), ds=docList_(w.querySelector('.docf-v').value); ds.splice(i,1); docSet_(w,ds); }
function docAddUrl_(inp){ var w=docWrap_(inp), u=String(inp.value||'').trim(); if(!u) return;
  if(!/^https?:\/\//i.test(u)) u='https://'+u;
  var ds=docList_(w.querySelector('.docf-v').value); if(ds.indexOf(u)<0) ds.push(u); inp.value=''; docSet_(w,ds); }
/* Tải 1 file tài liệu lên kho: gửi NGUYÊN FILE (nhị phân) tới /upload/file — trước đây đọc thành base64
   trong JSON, file lớn phình thêm 33% và bị chặn ở 20MB. */
var DOC_MAX_MB=50;
async function upDoc_(file){
  var h=apiHeaders_(); h['Content-Type']=file.type||'application/octet-stream';
  var r=await fetch('/upload/file?name='+encodeURIComponent(file.name),{ method:'POST', headers:h, body:file });
  var d=await r.json().catch(function(){ return {}; });
  if(!r.ok||d.error) throw new Error(d.error||('HTTP '+r.status+' ('+(file.size/1048576).toFixed(1)+'MB)'));
  return d;
}
async function docPick_(btn){
  var w=docWrap_(btn), f=document.createElement('input'); f.type='file'; f.multiple=true;
  f.accept='.pdf,.png,.jpg,.jpeg,.webp,.dwg,.dxf,.skp,.zip,.rar,.7z,.doc,.docx,.xls,.xlsx,.ppt,.pptx';
  f.onchange=async function(){
    var fs=Array.prototype.slice.call(f.files||[]); if(!fs.length) return;
    var goc=btn.innerHTML; btn.disabled=true; upBusy_(1);                 // Lưu sẽ đợi file tải xong
    try{
      for(var k=0;k<fs.length;k++){
        var file=fs[k]; btn.textContent='Đang tải '+(k+1)+'/'+fs.length+'…';
        if(file.size>DOC_MAX_MB*1024*1024){ toast('"'+file.name+'" nặng '+(file.size/1048576).toFixed(1)+'MB — quá giới hạn '+DOC_MAX_MB+'MB, hãy dán link'); continue; }
        try{ var r=await upDoc_(file);
          if(r&&r.url){ var ds=docList_(w.querySelector('.docf-v').value); ds.push(r.url); docSet_(w,ds); } }
        catch(e){ toast('Tải "'+file.name+'" lỗi: '+e.message); }
      }
      toast('Đã tải lên '+fs.length+' file — bấm "Lưu cập nhật" để gắn vào sản phẩm');
    } finally { btn.disabled=false; btn.innerHTML=goc; upBusy_(-1); }
  };
  f.click();
}
/* THIẾT BỊ VỆ SINH: chỉ hiện thông số của hạng mục đang chọn (form Nhập & modal Sửa dùng chung).
   Ô thuộc hạng mục khác bị ẩn; dấu * và danh sách chọn đổi theo hạng mục (VS_SPEC).          */
function vsApplyHM_(box, hmRaw, hienHetKhiTrong, ng){
  if(!box) return;
  // Hạng mục quyết định luôn bộ thông số: tên thuộc sơn nước -> SON_SPEC, còn lại -> VS_SPEC
  var VS_SPEC=SON_SPEC.chuanHM(hmRaw) ? SON_SPEC : specNganh_(ng||impLoai_());
  var hm=VS_SPEC.chuanHM(hmRaw), cho=hm?VS_SPEC.labelsOf(hm):(hienHetKhiTrong?VS_SPEC.ALL:[]);
  box.querySelectorAll('[data-vs]').forEach(function(w){
    var lb=w.getAttribute('data-vs'), on=cho.indexOf(lb)>=0;
    w.style.display=on?'':'none'; w.classList.toggle('vs-off',!on);
    w.style.order=on?String(cho.indexOf(lb)):'';          // xếp đúng thứ tự khai báo của hạng mục
    var la=w.querySelector('label'), m=VS_SPEC.METRIC[lb];
    var sao=w.classList.contains('spe-f')?' <span class="spe-req">*</span>':' <span style="color:#c33">*</span>';   // modal Sửa / form Nhập
    if(la) la.innerHTML=esc(m[1])+(on&&VS_SPEC.isReq(hm,lb)?sao:'');
    var dl=w.querySelector('datalist');
    if(dl) dl.innerHTML=VS_SPEC.optsOf(hm,lb).map(function(o){ return '<option value="'+esc(o)+'">'; }).join('');
  });
  // Thẻ nhóm không còn ô nào -> báo chọn hạng mục thay vì để trống trơn
  box.querySelectorAll('.vs-empty').forEach(function(e){ e.style.display=hm?'none':''; });
}
function dbIdOf(label){ var fl=impFlat_(); for(var i=0;i<fl.length;i++) if(fl[i][0]===label) return 'dbf_'+i; return ''; }
function dbCalcDaiLy(){
  var ge=document.getElementById(dbIdOf('GIÁ BÁN LẺ')), ce=document.getElementById(dbIdOf('CHIẾT KHẤU ĐẠI LÝ (%)')), oe=document.getElementById(dbIdOf('GIÁ ĐẠI LÝ'));
  if(!oe) return; var g=Number(ge&&ge.value)||0, ck=Number(ce&&ce.value)||0;
  oe.value = g ? Math.round(g*(1-ck/100)) : '';
}
function imgUrlOf(v){
  v=String(v||'').trim(); if(!v) return '';
  // data:/blob: là ảnh XEM TRƯỚC lúc đang tải lên -> dùng THẲNG.
  // (Trước đây bị bọc thành /media?token=data:... -> 404 -> luôn hiện "ảnh lỗi")
  if(/^(data:|blob:)/i.test(v)) return v;
  if(v.indexOf('http')===0) return v;
  return '/media?token='+encodeURIComponent(v);
}
/* Xem ảnh cỡ lớn: lật ‹ › bằng chuột hoặc phím ←/→, Esc để đóng, có số đếm */
function imgPop_(src){
  if(!src) return;
  /* Ảnh bấm từ BẢNG (hoặc bất kỳ đâu ngoài panel chi tiết) không nằm trong S._pdImgs.
     Trước đây khung xem ảnh chỉ lấy src từ S._pdImgs -> bấm ảnh trong bảng thì khung
     mở ra TRỐNG, mà nếu trước đó từng mở panel SP khác thì lại hiện nhầm ảnh SP cũ.
     Nay: chỉ dùng gallery khi đúng ảnh vừa bấm nằm trong gallery đó.                 */
  var gal=(S._pdImgs&&S._pdImgs.length)?S._pdImgs:[];
  var i=gal.indexOf(src);
  S._popList=(i>=0)?gal:[src];
  S._popIdx=(i>=0)?i:0;
  var o=document.getElementById('imgPop');
  if(!o){
    o=document.createElement('div'); o.id='imgPop'; o.className='imgpop';
    o.innerHTML='<button class="imgpop-nav prev" title="Ảnh trước (←)">‹</button>'
      +'<img alt="">'
      +'<button class="imgpop-nav next" title="Ảnh sau (→)">›</button>'
      +'<span class="imgpop-n"></span><span class="imgpop-x" title="Đóng (Esc)">✕</span>';
    o.addEventListener('click',function(e){
      var b=e.target.closest('.imgpop-nav');
      if(b){ e.stopPropagation(); imgPopGo_(b.classList.contains('prev')?-1:1); return; }
      if(e.target.tagName!=='IMG') imgPopClose_();          // bấm ra ngoài ảnh = đóng
    });
    document.body.appendChild(o);
  }
  imgPopShow_();
  o.style.display='flex';
  document.addEventListener('keydown',imgPopKey_);
}
function imgPopShow_(){
  var o=document.getElementById('imgPop'); if(!o) return;
  var imgs=S._popList||[];
  var i=S._popIdx||0;
  if(imgs[i]) o.querySelector('img').src=imgs[i];
  var many=imgs.length>1;
  o.querySelectorAll('.imgpop-nav').forEach(function(b){ b.style.display=many?'':'none'; });
  var n=o.querySelector('.imgpop-n');
  n.textContent=many?((i+1)+' / '+imgs.length):''; n.style.display=many?'':'none';
}
function imgPopGo_(d){
  var imgs=S._popList||[]; if(imgs.length<2) return;
  S._popIdx=(((S._popIdx||0)+d)%imgs.length+imgs.length)%imgs.length;
  imgPopShow_();
  // chỉ đồng bộ gallery khi đang xem đúng bộ ảnh của panel chi tiết
  if(imgs===S._pdImgs && pdEl_('pdMainImg')) pdSetImg_(S._popIdx);
}
function imgPopClose_(){
  var o=document.getElementById('imgPop'); if(o) o.style.display='none';
  document.removeEventListener('keydown',imgPopKey_);
}
function imgPopKey_(e){
  var o=document.getElementById('imgPop'); if(!o||o.style.display==='none') return;
  if(e.key==='Escape'){ imgPopClose_(); }
  else if(e.key==='ArrowLeft'){ e.preventDefault(); imgPopGo_(-1); }
  else if(e.key==='ArrowRight'){ e.preventDefault(); imgPopGo_(1); }
}
// Ảnh đầu tiên (nhiều ảnh nối bằng xuống dòng) -> URL hợp lệ cho <img src>
function imgSrc1_(v){ return imgUrlOf(String(v||'').split('\n')[0].trim()); }
// Ảnh lỗi: giữ nguyên thẻ img, chỉ báo nhẹ trên khung + cho bấm thử lại (không phá huỷ như trước)
function upImgErr_(img){
  var box=img.closest('.upzone,.upthumb'); if(!box) return;
  if(box.querySelector('.up-err')) return;
  box.classList.add('has-err');
  var d=document.createElement('span'); d.className='up-err';
  d.innerHTML='<b>Không tải được ảnh</b><i onclick="event.stopPropagation();upImgRetry_(this)">Thử lại</i>';
  box.appendChild(d);
}
function upImgOk_(img){
  var box=img.closest('.upzone,.upthumb'); if(!box) return;
  box.classList.remove('has-err');
  var e=box.querySelector('.up-err'); if(e) e.remove();
}
function upImgRetry_(el){
  var box=el.closest('.upzone,.upthumb'); if(!box) return;
  var img=box.querySelector('img'); if(!img) return;
  var e=box.querySelector('.up-err'); if(e) e.remove();
  box.classList.remove('has-err');
  var src=img.getAttribute('src'); img.setAttribute('src','');
  setTimeout(function(){ img.setAttribute('src', src+(src.indexOf('?')>=0?'&':'?')+'r='+Date.now()); },40);
}
// Vùng thả LUÔN giữ nguyên (không bị ảnh chiếm chỗ) -> 2 cột giống hệt nhau
function upMainInner(){
  return '<div class="upic">'+icon('camera',26)+'</div>'
    +'<div class="up-t">'+(S._imgMain?'Kéo/thả hoặc bấm để ĐỔI ảnh':'Kéo/thả hoặc bấm để chọn')+'</div>'
    +'<div class="up-s">ảnh chính hiện trong bảng &amp; báo giá — <b>chỉ 1 ảnh</b></div>'
    +'<div class="up-paste">'+icon('copy',11)+' hoặc dán ảnh bằng Ctrl+V</div>';
}
// Ảnh đại diện hiện thành THUMBNAIL Ở GÓC — cùng kiểu, cùng vị trí với ảnh chi tiết
/* Ảnh VỪA TẢI LÊN cũng bấm xem lớn được (khung xem ảnh đã có sẵn, trước chỉ dùng ở bảng
   bóc tách và panel chi tiết) — tải xong là kiểm tra lại được ngay, lật qua lại các ảnh. */
function upXemAnh_(k){
  var ds=[S._imgMain].concat(S._imgList||[]).filter(Boolean).map(imgUrlOf);
  if(!ds.length) return;
  S._pdImgs=ds; imgPop_(ds[Math.max(0,Math.min(ds.length-1, Number(k)||0))]);
}
function upMainGridInner_(){
  if(!S._imgMain) return '';
  return '<div class="upthumb is-main"><img src="'+esc(imgUrlOf(S._imgMain))+'" onerror="upImgErr_(this)" onload="upImgOk_(this)">'
    +'<button class="upzoom" title="Xem ảnh lớn" onclick="event.stopPropagation();upXemAnh_(0)">'+icon('search',12)+'</button>'
    +'<button class="upx" title="Xoá ảnh" onclick="event.stopPropagation();upRemove(\'main\')">✕</button>'
    +'<span class="upnum main">'+icon('star',10)+'</span></div>';
}
function upGridInner(){
  var coMain=S._imgMain?1:0;
  return (S._imgList||[]).map(function(v,i){
    return '<div class="upthumb"><img src="'+esc(imgUrlOf(v))+'" onerror="this.style.visibility=\'hidden\'">'
      +'<button class="upzoom" title="Xem ảnh lớn" onclick="event.stopPropagation();upXemAnh_('+(i+coMain)+')">'+icon('search',12)+'</button>'
      +'<button class="upx" title="Xoá" onclick="event.stopPropagation();upRemove(\'more\','+i+')">✕</button>'
      +'<button class="upstar" title="Đặt làm hình đại diện" onclick="event.stopPropagation();upMakeMain_('+i+')">'+icon('star',11)+'</button>'
      +'<span class="upnum">'+(i+1)+'</span></div>';
  }).join('') || '';
}
// đặt 1 ảnh chi tiết thành ảnh đại diện (đổi chỗ)
function upMakeMain_(i){
  var list=S._imgList||[]; if(i<0||i>=list.length) return;
  var old=S._imgMain; S._imgMain=list[i];
  if(old) list[i]=old; else list.splice(i,1);
  upRefresh(); toast('Đã đặt làm hình đại diện');
}
/* Khối ảnh có ở 2 nơi cùng id: form Nhập (tab vẫn nằm trong DOM khi ẩn) và modal Sửa SP.
   Modal đang mở -> chỉ làm việc trong modal (trước đây getElementById trúng form Nhập đang ẩn). */
function upRoot_(){ return document.getElementById('spEditOv')||document; }
function upEl_(id){ return upRoot_().querySelector('#'+id); }
function upRefresh(){
  var a=upEl_('upMain'); if(a)a.innerHTML=upMainInner();
  var g=upEl_('upMainGrid'); if(g)g.innerHTML=upMainGridInner_();
  var b=upEl_('upGrid'); if(b)b.innerHTML=upGridInner();
  var bs=upRoot_().querySelectorAll('.imgup .upbadge');
  if(bs[0]) bs[0].textContent=S._imgMain?'1 ảnh':(impLoai_()==='pt'?'tuỳ chọn':'bắt buộc');
  if(bs[1]) bs[1].textContent=(S._imgList||[]).length?((S._imgList||[]).length+' ảnh'):'tuỳ chọn';
}
function imgSection(){ return '<div class="dbcard"><div class="dbcard-h"><span class="dbcard-ic">'+icon('camera',18)+'</span><h3>Ảnh sản phẩm</h3>'
    +'<span class="sp" style="flex:1"></span><span class="up-hint2">'+icon('image',13)+' JPG · PNG · WEBP · tối đa 5MB</span></div>'
    +'<div class="dbcard-b">'+imgUpBlock_()+'</div></div>'; }
// Khối upload ảnh — dùng CHUNG cho trang Nhập dữ liệu và modal Sửa sản phẩm
function imgUpBlock_(cls){
  return '<div class="imgup '+(cls||'')+'">'
    +'<div class="upcol">'
      +'<div class="uphead"><span class="uplabel">Hình đại diện</span><span class="upbadge">'+(S._imgMain?'1 ảnh':'bắt buộc')+'</span></div>'
      +'<div class="upzone upmain" id="upMain" tabindex="0" onclick="upPick(\'main\')" ondragover="upDrag(event,1)" ondragleave="upDrag(event,0)" ondrop="upDrop(event,\'main\')">'+upMainInner()+'</div>'
      +'<div class="upgrid" id="upMainGrid">'+upMainGridInner_()+'</div>'
      +upUrlRow_('main')
    +'</div>'
    +'<div class="upcol">'
      +'<div class="uphead"><span class="uplabel">Hình chi tiết sản phẩm</span><span class="upbadge">'+((S._imgList||[]).length?((S._imgList||[]).length+' ảnh'):'tuỳ chọn')+'</span></div>'
      +'<div class="upzone upmore" id="upMore" tabindex="0" onclick="upPick(\'more\')" ondragover="upDrag(event,1)" ondragleave="upDrag(event,0)" ondrop="upDrop(event,\'more\')">'+upMoreInner_()+'</div>'
      +'<div class="upgrid" id="upGrid">'+upGridInner()+'</div>'
      +upUrlRow_('more')
    +'</div></div>';
}
function upUrlRow_(k){
  var id=(k==='main'?'upMainUrl':'upMoreUrl');
  return '<div class="upurl"><span class="upurl-ic">'+icon('link',13)+'</span>'
    +'<input id="'+id+'" placeholder="Dán link ảnh…" onkeydown="if(event.key===\'Enter\'){event.preventDefault();upAddUrl(\''+k+'\');}">'
    +'<button class="upurl-btn" onclick="upAddUrl(\''+k+'\')">Thêm</button></div>';
}
function upMoreInner_(){
  return '<div class="upic">'+icon('camera',26)+'</div>'
    +'<div class="up-t">Kéo/thả hoặc bấm để chọn</div>'
    +'<div class="up-s">chọn được <b>nhiều ảnh</b> cùng lúc</div>'
    +'<div class="up-paste">'+icon('copy',11)+' hoặc dán ảnh bằng Ctrl+V</div>';
}
var DB_GICON={'Tài liệu':'doc','Thông tin cơ bản':'tag','Thông tin giá bán':'money','Key Product Info (Thông tin chính)':'bulb','Thông số thiết kế':'ruler','Performance Specifications (Thông số hiệu suất)':'gauge','Driver (Nguồn LED / Chấn lưu)':'plug','Installation Specifications (Thông số lắp đặt)':'wrench','Thương mại':'sliders'};
function dbCard_(title, ic, note, inner){
  return '<div class="dbcard"><div class="dbcard-h"><span class="dbcard-ic">'+(icon(ic,18)||esc(ic))+'</span><h3>'+esc(title)+'</h3></div>'
    +'<div class="dbcard-b">'+(note?'<p class="dbnote">'+esc(note)+'</p>':'')+inner+'</div></div>';
}
function impStatBar(){
  var ps=S._sessionAdded||[];  // đếm theo SP nhập trong PHIÊN NÀY (khớp danh sách bên phải)
  var brands={}, nccs={}; ps.forEach(function(p){ if(p.thuongHieu)brands[p.thuongHieu]=1; if(p.ncc)nccs[p.ncc]=1; });
  function stat(label,val){ return '<div class="imp-stat"><div class="imp-stat-v">'+val+'</div><div class="imp-stat-l">'+esc(label)+'</div></div>'; }
  return '<div class="imp-statbar">'
    +impNganhSel_()
    +stat('Số lượng SKU đã nhập',ps.length)
    +stat('Số lượng Brand',Object.keys(brands).length)
    +stat('Số lượng nhà cung cấp',Object.keys(nccs).length)
    +'</div>';
}
function impDateTime_(iso){
  try{ var d=new Date(iso); if(isNaN(d)) return ''; var p=function(n){return (n<10?'0':'')+n;};
    var h=d.getHours(), ap=h<12?'AM':'PM', h12=h%12||12;
    return p(h12)+':'+p(d.getMinutes())+' '+ap+'<br>'+p(d.getDate())+'/'+p(d.getMonth()+1)+'/'+d.getFullYear();
  }catch(e){ return ''; }
}
function impRecentList(){
  var ps=(S._sessionAdded||[]);  // CHỈ SP thêm/nhập trong PHIÊN hiện tại
  var pd=(S._pending||[]);        // chờ lưu: chưa vào Database cho tới khi bấm "Thêm sản phẩm"
  // Thẻ chờ lưu: ảnh · tên (2 dòng) · mã/biến thể · thương hiệu · trạng thái + 2 nút rõ ràng Sửa / Xoá
  var pCards=pd.map(function(p,i){
    var img=p.hinhAnh?'<img class="pc-th" src="'+esc(imgSrc1_(p.hinhAnh))+'" onerror="this.style.visibility=\'hidden\'">':'<span class="pc-th pc-noimg">'+icon('image',14)+'</span>';
    var dangSua=(S._pendEdit===p.uid);
    var phu=[p.ma, p.thuongHieu].filter(Boolean).join(' · ');
    return '<div class="pc'+(p.loi?' err':'')+(dangSua?' editing':'')+'">'+img
      +'<div class="pc-mid"><div class="pc-name" title="'+esc(p.ten||'')+'">'+esc(p.ten||'')+'</div>'
        +(p.bienThe?'<div class="pc-bt" title="Biến thể">'+esc(p.bienThe)+'</div>':'')      // biến thể dòng riêng để phân biệt thẻ
        +(phu?'<div class="pc-sub" title="'+esc(phu)+'">'+esc(phu)+'</div>':'')
        +(p.loi?'<div class="pc-loi">'+esc(p.loi)+'</div>':'')
        +'<span class="pc-tag">'+(dangSua?'Đang sửa':(p.loi?'Lỗi — sửa lại':'Chờ lưu'))+'</span>'
        +((p.combo&&p.combo.length)?'<span class="pc-tag kt">+ combo '+p.combo.length+'</span>':'')
        +(p.ghi?'<span class="pc-tag kt" title="Ghi danh vào dự án sau khi lưu">→ dự án ×'+(p.ghi.qty||1)+'</span>':'')+'</div>'
      +'<div class="pc-act">'
        +'<button class="pc-btn" title="Sửa — mở lại trong form" onclick="pendingEdit_('+i+')">'+icon('edit',14)+'</button>'
        +'<button class="pc-btn del" title="Xoá khỏi danh sách chờ" onclick="pendingDel_('+i+')">'+icon('trash',14)+'</button>'
      +'</div></div>';
  }).join('');
  var rows=ps.map(function(p,i){
    var im=String(p.hinhAnh||'').split('\n')[0];
    var img=im?'<img class="imp-rth" src="'+esc(imgSrc1_(p.hinhAnh))+'" onerror="this.style.visibility=\'hidden\'">':'<span class="imp-rth"></span>';
    var sua = p.ma
      ? '<button class="imp-redit" title="'+(p.nhieuBienThe?'Sửa biến thể đầu tiên của mã '+esc(p.ma):'Sửa lại sản phẩm này')+'" onclick="impEditSession_('+i+')">'+icon('edit',13)+'</button>'
      : '<span class="imp-redit dis" title="Không rõ mã sản phẩm — mở Danh sách sản phẩm để sửa">'+icon('edit',13)+'</span>';
    return '<tr><td class="c imp-ract">'+sua+'</td><td class="c">'+(i+1)+'</td>'
      +'<td class="imp-rname">'+esc(p.ten||'')
      +(p.ma?'<i class="imp-rma">'+esc(p.ma)+'</i>':'')+'</td><td class="c">'+img+'</td>'
      +'<td>'+esc(p.thuongHieu||'—')+'</td><td class="imp-rdate">'+(impDateTime_(p.capNhat)||'—')+'</td></tr>';
  }).join('');
  if(!pCards && !rows) rows='<tr><td colspan="6" class="empty" style="padding:24px 12px;font-size:12.5px;line-height:1.5">Chưa nhập sản phẩm nào trong phiên này.<br>Sản phẩm bạn <b>thêm / nhập file</b> sẽ hiện ở đây — bấm <b>Thêm sản phẩm</b> để lưu vào Database.</td></tr>';
  var choHtml=pd.length?('<div class="pc-hd">Chờ lưu <span>'+pd.length+'</span><i>Chưa vào Database</i></div><div class="pc-list">'+pCards+'</div>'):'';
  var daHd=(pd.length&&ps.length)?'<div class="pc-hd done">Đã lưu vào Database <span>'+ps.length+'</span></div>':'';
  var nut='<div class="imp-rfoot">'
    +(pd.length?'<div class="imp-rfoot-note"><b>'+pd.length+'</b> sản phẩm đang chờ — <b>chưa</b> lưu vào Database</div>':'')
    +'<button class="btn blue block" id="pendBtn" onclick="pendingCommit_(this)"'+((pd.length&&!S._committing)?'':' disabled')+'>'
    +(S._committing?'⏳ Đang lưu vào Database…':(icon('plus',15)+' Thêm sản phẩm'+(pd.length?' ('+pd.length+')':'')))+'</button></div>';
  return '<div class="imp-recent-h">Sản phẩm vừa nhập (phiên này) <span class="count">'+pad2(pd.length+ps.length)+'</span></div>'
    +'<div class="imp-recent-note">Danh sách này chỉ ghi lại thao tác của <b>phiên đang mở</b> — tải lại trang sẽ trống. '
    +'Sản phẩm đã lưu <b>vẫn nằm trong Database</b>: <a onclick="showTab(\'sanpham\')">xem Danh sách sản phẩm →</a></div>'
    +'<div class="imp-recent-b">'+choHtml+daHd
      +(rows?'<table class="imp-rtbl"><thead><tr><th class="c">Sửa</th><th class="c">STT</th><th>Tên sản phẩm</th><th class="c">Hình ảnh</th><th>Thương hiệu</th><th>Ngày cập nhật</th></tr></thead><tbody>'+rows+'</tbody></table>':'')+'</div>'
    +nut;
}
/* ═══ DANH SÁCH CHỜ LƯU ═══
   Form Nhập / file Excel chỉ đưa SP vào S._pending (hiện ở panel phải, nhãn "Chờ lưu").
   Bấm "Thêm sản phẩm" mới ghi vào Database: SP từ form -> saveDbProduct từng cái,
   SP từ file -> importCommit cả lô (server kiểm tra hạng mục / thông số bắt buộc).
   Lưu được -> chuyển sang danh sách "đã nhập"; lỗi -> ở lại, hiện lý do.          */
var _pendSeq=0;
function pendUid_(){ return 'p'+(++_pendSeq); }
function pendingAdd_(items){ (items||[]).forEach(function(x){ if(!x.uid) x.uid=pendUid_(); });
  S._pending=(items||[]).concat(S._pending||[]); impRecentRefresh_(); }
async function pendingDel_(i){
  var it=(S._pending||[])[i]; if(!it) return;
  if(!await xacNhan_('Xoá "'+it.ten+'" khỏi danh sách chờ?\n(Sản phẩm chưa được lưu vào Database nên sẽ mất hẳn.)')) return;
  var j=S._pending.indexOf(it); if(j<0) return; S._pending.splice(j,1);
  if(S._pendEdit===it.uid){ S._pendEdit=null; renderImport(); } else impRecentRefresh_();
}
/* SỬA 1 dòng chờ: nạp lại vào đúng form (đúng ngành, hạng mục, thông số, ảnh) để chỉnh,
   bấm "Cập nhật vào danh sách chờ" thì thay đúng dòng đó. Dòng từ file Excel cũng sửa được như vậy. */
function pendItemData_(it){
  if(it.kind==='form') return Object.assign({}, it.data);
  var d=Object.assign({}, (it.prod&&it.prod._raw)||{}), p=it.prod||{};
  var fill=function(k,v){ if(!String(d[k]||'').trim() && v) d[k]=v; };
  fill('TÊN SẢN PHẨM',p.ten); fill('MÃ SẢN PHẨM',p.ma); fill('THƯƠNG HIỆU',p.thuongHieu); fill('NHÀ CUNG CẤP',p.ncc);
  fill('HẠNG MỤC',p.hangMuc); fill('GIÁ BÁN LẺ',p.gia?String(p.gia):''); fill('ĐƠN VỊ TÍNH',p.dvt);
  if(p.hinhAnh) d['ẢNH SẢN PHẨM']=p.hinhAnh;
  return d;
}
function pendNganhLoai_(it){ var n=it.nganh||pendItemData_(it)['NGÀNH HÀNG']; return (n==='vs'||n==='son')?n:'sp'; }
async function pendingEdit_(i){
  var it=(S._pending||[])[i]; if(!it) return;
  if(S._committing){ toast('Đang lưu vào Database — đợi xong rồi sửa'); return; }
  if(S._pendEdit && S._pendEdit!==it.uid && !await xacNhan_('Đang sửa một sản phẩm khác — bỏ các thay đổi chưa cập nhật?')) return;
  S._pendEdit=it.uid;
  S._impLoai=pendNganhLoai_(it);
  renderImport();                             // renderImport tự nạp dữ liệu dòng đang sửa vào form
  var f0=document.querySelector('#v-import .dbwrap'); if(f0&&f0.scrollIntoView) f0.scrollIntoView({behavior:'smooth',block:'start'});
  toast('Đã mở "'+it.ten+'" trong form — sửa xong bấm "Cập nhật vào danh sách chờ"');
}
function pendFillForm_(it){
  var d=pendItemData_(it);
  var box=document.getElementById('v-import');
  impFlat_().forEach(function(f){
    var el=document.getElementById(dbIdOf(f[0])); if(!el) return;
    var v=d[f[0]]; if(f[0]==='HẠNG MỤC' && S._impLoai==='vs') v=VS_SPEC.chuanHM(v)||v;
    if(v!=null && v!=='' && f[2]==='num') v=tkNum_(v);   // "1.200.000" / "12,5" -> ô kiểu số nhận được
    if(v!=null && v!=='') el.value=String(v);
  });
  if(S._impLoai==='vs'||S._impLoai==='son') vsApplyHM_(box, d['HẠNG MỤC'], 0, S._impLoai);
  dbCalcDaiLy();
  document.querySelectorAll('#v-import .docf').forEach(docRender_);           // hiện danh sách file tài liệu
  S._impCombo=(it.combo||[]).map(function(x){ return Object.assign({},x); }); impCbRender_();
  var imgs=String(d['ẢNH SẢN PHẨM']||it.hinhAnh||'').split('\n').map(function(x){ return x.trim(); }).filter(Boolean);
  S._imgMain=imgs[0]||''; S._imgList=imgs.slice(1); upRefresh();
  // ghi danh dự án đã chọn trước đó
  if(it.ghi){ var gd=document.getElementById('impGhiDanh'), ps=document.getElementById('impProjSel'), sl=document.getElementById('impGhiSL');
    if(gd) gd.checked=true; if(ps) ps.value=it.ghi.maDA; if(sl) sl.value=it.ghi.qty; }
}
function pendingEditCancel_(){ S._pendEdit=null; renderImport(); }
function impRecentRefresh_(){
  var box=document.getElementById('impRecentBox'); if(box) box.innerHTML=impRecentList();
  var sb=document.querySelector('#v-import .imp-statbar'); if(sb && impLoai_()!=='pt') sb.outerHTML=impStatBar();
}
window.addEventListener('beforeunload',function(e){
  if((S._pending||[]).length||(S._ctPending||[]).length){ e.preventDefault(); e.returnValue='Còn dữ liệu chưa lưu vào Database'; return e.returnValue; }
});
async function pendingCommit_(btn){
  if(S._committing) return;                          // đang lưu -> bỏ qua lần bấm thứ 2
  var ds=(S._pending||[]).slice(); if(!ds.length){ toast('Chưa có sản phẩm nào chờ lưu'); return; }
  if(S._pendEdit && !await xacNhan_('Bạn đang sửa 1 sản phẩm trong form nhưng chưa bấm "Cập nhật".\nLưu luôn bản CŨ của sản phẩm đó?')) return;
  if(S._pendEdit){ S._pendEdit=null; renderImport(); }
  S._committing=true; impRecentRefresh_(); btn=document.getElementById('pendBtn');
  try{ await pendingCommitRun_(ds, btn); }
  finally{ S._committing=false; impRecentRefresh_(); }
}
async function pendingCommitRun_(ds, btn){
  if(btn){ btn.disabled=true; btn.textContent='⏳ Đang lưu 0/'+ds.length+'…'; }
  var ok=0, loi=0, conLai=[], ghiN=0, ghiDs=[];
  var form=ds.filter(function(x){ return x.kind==='form'; }), file=ds.filter(function(x){ return x.kind==='file'; });
  for(var k=0;k<form.length;k++){
    var it=form[k];
    try{
      var rs=await api('saveDbProduct', it.data); ok++;
      if(it.combo && it.combo.length && rs && rs.id){
        try{ await api('setCombo', String(rs.id), it.combo.map(function(x){ return {id:x.recordId, soLuong:Number(x.comboSL)||1}; })); }
        catch(e4){ toast('Lưu "'+it.ten+'" OK nhưng combo lỗi: '+e4.message); } }
      sessionAdd_({ten:it.ten+(it.bienThe?' ('+it.bienThe+')':''), ma:it.ma, thuongHieu:it.thuongHieu, ncc:it.ncc, hinhAnh:it.hinhAnh});
      // ghi danh vào dự án: để DÀNH LẠI, chạy sau khi tải lại danh mục (lấy đúng SP vừa lưu)
      if(it.ghi) ghiDs.push({ ghi:it.ghi, rid:(rs&&rs.id!=null)?String(rs.id):'', ten:it.ten });
    }catch(e){ loi++; it.loi=e.message.slice(0,160); conLai.push(it); }
    if(btn) btn.textContent='⏳ Đang lưu '+(k+1)+'/'+ds.length+'…';
  }
  if(file.length){
    try{
      var r=await api('importCommit', file.map(function(x){ return x.prod; }));
      // Lỗi trả về theo CHỈ SỐ dòng (i) — 2 biến thể cùng tên không bị báo lỗi lẫn nhau
      var bad={}; (r.errors||[]).forEach(function(e){ if(e.i!=null) bad[e.i]=e.error; });
      file.forEach(function(it,fi){
        if(bad[fi]!=null){ loi++; it.loi=String(bad[fi]).slice(0,160); conLai.push(it); }
        else { ok++; sessionAdd_({ten:it.ten, ma:it.ma, thuongHieu:it.thuongHieu, ncc:it.ncc, hinhAnh:it.hinhAnh}); }
      });
    }catch(e){ file.forEach(function(it){ loi++; it.loi=e.message.slice(0,160); conLai.push(it); }); }
  }
  // Chỉ bỏ những dòng đã lưu xong — dòng thêm/sửa TRONG LÚC đang lưu vẫn được giữ lại
  var xong={}; ds.forEach(function(x){ if(conLai.indexOf(x)<0) xong[x.uid]=1; });
  S._pending=(S._pending||[]).filter(function(x){ return !xong[x.uid]; });
  try{ S.products=await api('getProducts')||S.products; }catch(e){}
  /* Ghi danh vào dự án — làm SAU khi danh mục đã tải lại: lấy đúng sản phẩm vừa lưu nên dòng
     trong dự án có đủ Thông tin chính / Thông số thiết kế / ảnh, thay vì bản rút gọn từ form. */
  for(var gi=0; gi<ghiDs.length; gi++){
    var g=ghiDs[gi], pr=g.ghi.prod, nd=String(pr.nhom||'3.2.6.1');
    var real=g.rid?(S.products||[]).filter(function(x){ return String(x.recordId||'')===g.rid; })[0]:null;
    if(real) pr=Object.assign({}, real, { nhom:nd, hangMuc:nodeName(nd), loai:nodeName(nd), tang:'', extra:{nganh:real.nhom||''} });
    try{ await api('addLine', g.ghi.maDA, pr, g.ghi.qty); ghiN++;
      if(S.cur&&S.cur.maDA===g.ghi.maDA){ S.lines=await api('getLines',g.ghi.maDA)||S.lines; } }
    catch(e3){ toast('Lưu "'+g.ten+'" OK nhưng ghi danh dự án lỗi: '+e3.message); }
  }
  impRecentRefresh_();
  try{ renderFilters(); renderCatalog(); }catch(e){}     // làm mới panel Bóc tách (nếu đang dựng)
  if(ghiN && typeof veLaiSauSua_==='function') veLaiSauSua_();   // vừa ghi danh vào dự án đang mở -> Bóc tách / tổng tiền vẽ lại
  var msg='Đã lưu '+ok+' sản phẩm vào Database'+(ghiN?(' · ghi danh '+ghiN+' vào dự án'):'');
  if(loi) await baoLoi_({ title:loi+' sản phẩm chưa lưu được', ok:'Đã hiểu',
    note:msg+'.\nCác dòng dưới đây vẫn nằm trong danh sách chờ (nhãn "Lỗi") — sửa rồi bấm Thêm sản phẩm lại.',
    dong:conLai.map(function(x){ return (x.ten||'(không tên)')+' — '+x.loi; }) });
  else toast(msg);
}
/* ═══ SỬA LẠI SẢN PHẨM NGAY Ở PANEL "SP VỪA NHẬP" ═══
   Mở đúng modal Cập nhật sản phẩm đang dùng ở Danh sách SP, nên mọi trường,
   lịch sử sửa và sản phẩm đi kèm đều y hệt — không phải dựng form thứ hai. */
async function impEditSession_(i){
  var s=(S._sessionAdded||[])[i]; if(!s||!s.ma) return;
  if(!(S.products||[]).length){ try{ S.products=await api('getProducts')||[]; }catch(e){} }
  var ma=String(s.ma).trim().toLowerCase();
  var p=(S.products||[]).filter(function(x){ return String(x.ma||'').trim().toLowerCase()===ma; })[0];
  if(!p){ toast('Không tìm thấy "'+s.ma+'" trong danh mục — có thể đã bị xoá'); return; }
  spEditModal(p);
}
/* Sau khi lưu ở modal: cập nhật lại dòng trong panel phiên cho khớp dữ liệu mới */
function impSyncSession_(key){
  var ds=S._sessionAdded||[]; if(!ds.length||!key) return;
  var k=String(key).trim().toLowerCase();
  var p=(S.products||[]).filter(function(x){
    return String(x.ma||'').trim().toLowerCase()===k || String(x.recordId||'')===String(key); })[0];
  if(!p) return;
  var pm=String(p.ma||'').trim().toLowerCase();
  ds.forEach(function(s){
    if(String(s.ma||'').trim().toLowerCase()!==pm) return;
    if(!s.nhieuBienThe) s.ten=p.ten||s.ten;         // dòng gộp biến thể giữ nguyên nhãn "(N biến thể)"
    s.thuongHieu=p.thuongHieu||s.thuongHieu;
    s.hinhAnh=p.hinhAnh||s.hinhAnh;
    s.capNhat=nowIsoClient_();
  });
  var box=document.getElementById('impRecentBox');
  if(box) box.innerHTML=impRecentList();
}
function sessionAdd_(o){ S._sessionAdded=S._sessionAdded||[];
  S._sessionAdded.unshift({ten:o.ten||'',ma:o.ma||'',thuongHieu:o.thuongHieu||'',ncc:o.ncc||'',
    hinhAnh:o.hinhAnh||'',capNhat:o.capNhat||nowIsoClient_(), nhieuBienThe:!!o.nhieuBienThe}); }
function nowIsoClient_(){ try{ return new Date().toISOString(); }catch(e){ return ''; } }
// Tab Nhập dữ liệu có 2 hạng mục: Sản phẩm (đèn) và Phần thô (công tác xây dựng)
/* ═══ FILE MẪU SƠN NƯỚC THEO ĐÚNG HẠNG MỤC ĐANG CHỌN ═══
   Mỗi hạng mục sơn có bộ thông số riêng; file gộp cả 8 hạng mục thì bảng 39 cột, điền
   nhầm cột của hạng mục khác là dòng đó bị bỏ. Nay phải CHỌN HẠNG MỤC trước (form hiện
   đúng bộ thông số) rồi mới tải được file mẫu — file chỉ có cột của hạng mục đó.      */
function sonHmDangChon_(){
  var e=document.getElementById(dbIdOf('HẠNG MỤC'));
  return e?(SON_SPEC.chuanHM(e.value)||''):'';
}
function sonTplBtn_(){
  var hm=sonHmDangChon_();
  if(!hm) return '<button class="btn ghost sm" disabled title="Chọn Hạng mục ở khối Thông tin cơ bản trước — file mẫu sẽ đúng bộ thông số của hạng mục đó">'
    +icon('download',14)+' Tải file mẫu — chọn hạng mục trước</button>';
  return '<a class="btn ghost sm" href="/mau-nhap-son-nuoc.xlsx?hm='+encodeURIComponent(hm)+'"'
    +' title="File mẫu chỉ gồm thông số của hạng mục '+esc(hm)+'">'+icon('download',14)+' Tải file mẫu · '+esc(hm)+'</a>';
}
// đổi hạng mục -> nút tải file mẫu đổi theo (không vẽ lại cả form cho khỏi mất dữ liệu đang gõ)
function sonTplSync_(){
  var box=document.getElementById('impFileRow'); if(!box || impLoai_()!=='son') return;
  var cu=box.querySelector('.btn.ghost.sm'); if(!cu) return;
  var tmp=document.createElement('div'); tmp.innerHTML=sonTplBtn_();
  cu.replaceWith(tmp.firstChild);
}
function impLoai_(){ return S._impLoai||'sp'; }
function impSetLoai(v){ S._impLoai=v; renderImport(); }
// Chọn hạng mục để nhập — gộp thẳng vào ô "Ngành hàng" (trước đây là 1 hàng tab riêng)
var IMP_LOAI=[['sp','Thiết bị đèn · sản phẩm'],['vs','Thiết bị vệ sinh · sản phẩm'],
  ['son','Sơn nước · sản phẩm'],['pt','Xây dựng · công tác phần thô']];
/* Ô chọn NGÀNH HÀNG ở trang Nhập dữ liệu — dựng đúng dáng ô chọn hạng mục
   (nhãn + ô viền tròn kèm số đếm) để cả web chỉ còn một kiểu ô chọn. */
function impNganhDem_(v){
  if(v==='pt') return (typeof spPTAll_==='function')?spPTAll_().length:0;   // thư viện công tác
  var ng=(v==='vs'||v==='son')?v:'den';
  return (S.products||[]).filter(function(p){ return nganhCuaSP_(p)===ng; }).length;
}
function impNganhSel_(){
  var cur=impLoai_(), ten=(IMP_LOAI.filter(function(x){ return x[0]===cur; })[0]||['',''])[1];
  return '<div class="hm-wrap"><span class="hm-lbl">Ngành hàng</span>'
    +'<span class="count">['+pad2(impNganhDem_(cur))+']</span>'
    +'<button class="tree-btn hm-open on" id="ngBtn" onclick="ngPop_(event)" title="Chọn ngành hàng">'
      +'<span class="hm-name">'+esc(ten)+'</span>'
      +'<span class="cnt">['+pad2(impNganhDem_(cur))+']</span>'
    +'</button></div>';
}
function ngPop_(e){
  if(e&&e.stopPropagation) e.stopPropagation();
  var id='ngPop'; if(document.getElementById(id)){ ngPopClose_(); return; }
  var cur=impLoai_(), pop=document.createElement('div');
  pop.className='fltpop bgtree'; pop.id=id;
  pop.innerHTML='<div class="bgt-h"><b>Chọn ngành hàng</b>'
      +'<button class="colpop-x" onclick="ngPopClose_()">✕</button></div>'
    +'<div class="bgt-b">'+IMP_LOAI.map(function(x){
        var on=(cur===x[0]);
        return '<div class="bgt-i lvl1'+(on?' on':'')+'" onclick="ngPick_(\''+x[0]+'\')">'
          +'<span class="nm">'+esc(x[1])+'</span>'
          +'<span class="cn">['+pad2(impNganhDem_(x[0]))+']</span>'
          +'<span class="rd'+(on?' on':'')+'"></span></div>';
      }).join('')+'</div>';
  document.body.appendChild(pop);
  var b=document.getElementById('ngBtn');
  if(b){ var r=b.getBoundingClientRect(), w=pop.offsetWidth||330, h=pop.offsetHeight;
    var top=r.bottom+6; if(top+h>window.innerHeight-10) top=Math.max(10, r.top-h-6);
    pop.style.top=top+'px'; pop.style.left=Math.max(8,Math.min(r.left, window.innerWidth-w-10))+'px'; }
  setTimeout(function(){ document.addEventListener('mousedown',ngOutside_); },0);
}
function ngOutside_(e){ if(e.target.closest('#ngPop')||e.target.closest('#ngBtn')) return; ngPopClose_(); }
function ngPopClose_(){ var p=document.getElementById('ngPop'); if(p) p.remove(); document.removeEventListener('mousedown',ngOutside_); }
function ngPick_(v){ ngPopClose_(); impSetLoai(v); }
function impLoaiTabs_(){ return ''; }
/* Combo chọn ngay trong form Nhập: S._impCombo = [{recordId, ma, ten, hinhAnh, donGiaBan, comboSL}] */
function impCbRender_(){
  var box=document.getElementById('impCbList'); if(!box) return;
  var ds=S._impCombo||[];
  box.innerHTML=ds.length?ds.map(function(x,i){
    return '<div class="cb-item">'+(x.hinhAnh?'<img class="cb-img" src="'+esc(imgSrc1_(x.hinhAnh))+'" onerror="this.style.visibility=\'hidden\'">':'<span class="cb-img"></span>')
      +'<div class="cb-info"><div class="cb-nm" title="'+esc(x.ten||'')+'">'+esc(x.ten||'')+'</div><div class="cb-sub">'+esc(x.ma||'')+(x.donGiaBan?' · '+money(x.donGiaBan)+'đ':'')+'</div></div>'
      +'<label class="cb-sl" title="Số lượng đi kèm cho mỗi sản phẩm chính">×<input type="number" min="1" step="1" value="'+(Number(x.comboSL)||1)+'" oninput="impCbSL_('+i+',this.value)"></label>'
      +'<button class="cb-del" title="Bỏ khỏi combo" onclick="impCbDel_('+i+')">'+icon('x',14)+'</button></div>';
  }).join(''):'<div class="cb-empty">Chưa chọn sản phẩm đi kèm — gõ tên / mã ở ô trên'+(impLoai_()==='vs'?', hoặc bấm vào ô để xem gợi ý theo hạng mục':'')+'.</div>';
}
function impCbSL_(i,v){ var x=(S._impCombo||[])[i]; if(x) x.comboSL=Math.max(1,Number(v)||1); }
function impCbDel_(i){ (S._impCombo||[]).splice(i,1); impCbRender_(); }
function impCbAdd_(rid){
  var p=(S.products||[]).filter(function(x){ return String(x.recordId)===String(rid); })[0]; if(!p) return;
  S._impCombo=S._impCombo||[];
  if(S._impCombo.some(function(x){ return String(x.recordId)===String(rid); })){ toast('Sản phẩm này đã có trong combo'); return; }
  S._impCombo.push({recordId:p.recordId, ma:p.ma, ten:p.ten, hinhAnh:p.hinhAnh, donGiaBan:p.donGiaBan, comboSL:1});
  var q=document.getElementById('impCbQ'); if(q) q.value='';
  impCbRender_(); impCbSearch_('');
}
function impCbSearch_(q){
  var box=document.getElementById('impCbSug'); if(!box) return;
  q=String(q||'').trim().toLowerCase();
  var l1=impLoai_(), ng=(l1==='vs'||l1==='son')?l1:'den', chon={}; (S._impCombo||[]).forEach(function(x){ chon[String(x.recordId)]=1; });
  var hit, tieuDe='';
  if(!q){
    var hmEl=document.getElementById(dbIdOf('HẠNG MỤC')), h=(ng==='vs'&&hmEl)?VS_SPEC.hmOf(hmEl.value):null;
    if(!h||!h.kem.length){ box.style.display='none'; return; }
    hit=(S.products||[]).filter(function(p){ return !chon[String(p.recordId)] && nganhCuaSP_(p)==='vs' && h.kem.indexOf(VS_SPEC.chuanHM(p.hangMuc))>=0; }).slice(0,8);
    tieuDe='<div class="cb-sug-h">Gợi ý đi kèm: '+esc(h.kem.join(', '))+'</div>';
  } else {
    hit=(S.products||[]).filter(function(p){ return !chon[String(p.recordId)] && ((p.ten||'')+' '+(p.ma||'')+' '+(p.thuongHieu||'')).toLowerCase().indexOf(q)>=0; });
    hit.sort(function(a,b){ return (nganhCuaSP_(a)===ng?0:1)-(nganhCuaSP_(b)===ng?0:1); }); hit=hit.slice(0,8);
  }
  box.innerHTML=hit.length?tieuDe+hit.map(function(p){ var lbl=cbLbl_(p);
    return '<button class="cb-sug" onmousedown="event.preventDefault()" onclick="impCbAdd_(\''+escJs_(String(p.recordId))+'\')">'
      +(p.hinhAnh?'<img src="'+esc(imgSrc1_(p.hinhAnh))+'" onerror="this.style.visibility=\'hidden\'">':'<span class="cb-img"></span>')
      +'<span class="cb-sug-nm">'+esc(p.ten||'')+'<i>'+esc(p.ma||'')+(lbl?' · '+esc(lbl):'')+(p.donGiaBan?' · '+money(p.donGiaBan)+'đ':'')+'</i></span></button>';
  }).join(''):'<div class="cb-empty">Không tìm thấy sản phẩm khớp.</div>';
  box.style.display='block';
}
function renderImport(){
  if(impLoai_()==='pt') return renderImportPT_();
  S._impCombo=[];                                   // form mới: combo trống (đang sửa dòng chờ thì pendFillForm_ nạp lại)
  // Đang sửa 1 dòng chờ: chỉ giữ chế độ sửa nếu dòng còn tồn tại và ĐÚNG ngành đang xem (đổi ngành = huỷ sửa)
  var suaIt=S._pendEdit?(S._pending||[]).filter(function(x){ return x.uid===S._pendEdit; })[0]:null;
  if(S._pendEdit && (!suaIt || pendNganhLoai_(suaIt)!==impLoai_())){ S._pendEdit=null; suaIt=null; }
  S._imgMain=''; S._imgList=[];
  var box=document.getElementById('v-import');
  var form='<div class="dbwrap">'
    +imgSection()
    +impGroups_().map(function(gr){
      return dbCard_(gr.g, DB_GICON[gr.g]||'doc', gr.note,
        (gr.vs?'<div class="vs-empty dbnote">Chọn <b>Hạng mục</b> ở phần Thông tin cơ bản để hiện đúng thông số của hạng mục đó.</div>':'')
        +'<div class="dbgrid">'+gr.f.map(dbInput).join('')+'</div>');
    }).join('')
    +dbCard_('Sản phẩm đi kèm (combo)','layers','Chọn các sản phẩm luôn bán / lắp cùng sản phẩm này (VD bồn cầu + nắp rửa + vòi xịt). Lưu cùng lúc khi bấm Thêm sản phẩm.',
      '<div class="cb-find"><input id="impCbQ" placeholder="Tìm theo tên, mã hoặc thương hiệu…" autocomplete="off"'
        +' oninput="impCbSearch_(this.value)" onfocus="impCbSearch_(this.value)" onblur="setTimeout(function(){ var b=document.getElementById(\'impCbSug\'); if(b) b.style.display=\'none\'; },150)">'
        +'<div class="cb-sug-box" id="impCbSug"></div></div><div class="cb-list" id="impCbList"></div>')
    +dbCard_('Nhập biến thể (tuỳ chọn)','sliders','Nhập nhiều giá trị cách nhau bằng dấu phẩy — hệ thống tạo 1 sản phẩm cho MỖI tổ hợp (cùng mã SP, khác thông số).',
      '<div class="dbgrid">'
      // Ba trục dưới chỉ có nghĩa với ĐÈN — ngành vệ sinh chỉ tách biến thể theo MÀU
      +((impLoai_()==='son')
        ?'<div class="field"><label>Quy cách (dung tích)</label><input id="varSize" placeholder="VD: 1L, 5L, 18L" oninput="varPreview_()"></div>'
        :(impLoai_()==='vs')
        ?'<div class="field"><label>Kích thước</label><input id="varSize" placeholder="VD: L580 x W380, L620 x W390" oninput="varPreview_()"></div>'
        :('<div class="field"><label>Nhiệt độ màu (K)</label><input id="varKelvin" placeholder="VD: 3000, 4000, 6500" oninput="varPreview_()"></div>'
         +'<div class="field"><label>Công suất (W)</label><input id="varWatt" placeholder="VD: 7, 9, 12" oninput="varPreview_()"></div>'
         +'<div class="field"><label>Góc chiếu (°)</label><input id="varAngle" placeholder="VD: 24, 36, 60" oninput="varPreview_()"></div>'))
      +'<div class="field"><label>Màu sắc</label><input id="varColor" placeholder="VD: Đen, Trắng, Vàng" oninput="varPreview_()"></div>'
      +'</div><div class="var-note" id="varNote">Bỏ trống = chỉ tạo 1 sản phẩm theo thông số đã nhập ở trên.</div>')
    +dbCard_('Ghi danh vào dự án','building','Tuỳ chọn — đưa sản phẩm này vào một dự án ngay sau khi lưu vào Database.',
      '<div class="dbgrid">'
      +'<div class="field"><label>Dự án</label><select id="impProjSel"><option value="">— Không ghi danh —</option>'
        +(S.projects||[]).map(function(p){ return '<option value="'+esc(p.maDA)+'"'+(S.cur&&S.cur.maDA===p.maDA?' selected':'')+'>'+esc(p.ten)+'</option>'; }).join('')+'</select></div>'
      +'<div class="field"><label>Số lượng</label><input type="number" id="impGhiSL" min="1" value="1"></div>'
      +'</div><label class="imp-ghck"><input type="checkbox" id="impGhiDanh"> Thêm sản phẩm này vào dự án đã chọn sau khi lưu</label>')
    +(S._pendEdit
      ?'<div class="savebar"><div class="pe-note">'+icon('edit',14)+' Đang sửa 1 sản phẩm trong danh sách chờ — chỉnh xong bấm <b>Cập nhật</b></div>'
        +'<button class="btn blue block" onclick="tdSave(this)">'+icon('check',15)+' Cập nhật vào danh sách chờ</button>'
        +'<button class="btn ghost sm" onclick="pendingEditCancel_()" style="margin-top:8px">Huỷ sửa</button></div>'
      :'<div class="savebar"><button class="btn blue block" onclick="tdSave(this)">Đưa vào danh sách chờ</button><button class="btn ghost sm" onclick="renderImport()" style="margin-top:8px">Xoá form</button></div>')
    +dbCard_('Nhập hàng loạt từ file', 'download', 'Tải file mẫu → điền dữ liệu → chọn file lên. Hệ thống tự dò cột theo tiêu đề; tải ảnh cho từng SP rồi đưa vào danh sách chờ — bấm Thêm sản phẩm để lưu.',
      '<div class="imp-file-row" id="impFileRow">'
      +((impLoai_()==='vs')
        ?'<a class="btn ghost sm" href="/mau-nhap-thiet-bi-ve-sinh.xlsx" download="Mau-nhap-thiet-bi-ve-sinh-DezonQS.xlsx">'+icon('download',14)+' Tải file mẫu thiết bị vệ sinh</a>'
        :(impLoai_()==='son'
          ? sonTplBtn_()
          :'<a class="btn ghost sm" href="/mau-nhap-hang-loat.xlsx" download="Mau-nhap-hang-loat-DezonQS.xlsx">'+icon('download',14)+' Tải file mẫu</a>'))
      +'<span class="imp-file-sep"></span><input type="file" id="impFile" accept=".xlsx,.xls,.csv" onchange="impPick(this)" style="font:inherit"></div>'
      +'<div id="impPreview" style="margin-top:12px"></div>')
    +'</div>';
  box.innerHTML='<div class="sechd imp-sechd"><h2>Nhập dữ liệu</h2>'
      +'<span class="imp-sub">Thêm sản phẩm vào danh mục · <b>*</b> bắt buộc</span></div>'
    +impLoaiTabs_()+impStatBar()
    +'<div class="imp-layout">'+form+'<div class="imp-recent" id="impRecentBox">'+impRecentList()+'</div></div>';
  if(impLoai_()==='vs'||impLoai_()==='son') vsApplyHM_(box,'',0,impLoai_());
  impCbRender_(); box.querySelectorAll('.docf').forEach(docRender_);
  if(suaIt) pendFillForm_(suaIt);            // nạp lại dữ liệu dòng đang sửa (sau đổi tab / vẽ lại)
}
/* Nhập dữ liệu — hạng mục PHẦN THÔ: thêm công tác xây dựng vào cơ sở dữ liệu */
function renderImportPT_(){
  var box=document.getElementById('v-import'); if(!box) return;
  var n=(S.congTac||[]).length;
  var chuaDuyet=(S.congTac||[]).filter(function(c){ return !c.daDuyet; }).length;
  var sua=ctPendItem_(S._ctPendEdit);                 // đang sửa 1 công tác trong danh sách chờ
  if(S._ctPendEdit && !sua) S._ctPendEdit=null;
  // Ảnh: dùng CHUNG khối "Ảnh sản phẩm" của form SP (ảnh đại diện + ảnh chi tiết, kéo-thả / dán)
  var anh=String((sua&&sua.d.hinhAnh)||'').split('\n').map(function(x){ return x.trim(); }).filter(Boolean);
  S._imgMain=anh[0]||''; S._imgList=anh.slice(1);
  var form='<div class="dbwrap ctimp">'
    +imgSection().replace('<h3>Ảnh sản phẩm</h3>','<h3>Ảnh công tác</h3>')
        .replace('Hình chi tiết sản phẩm','Hình chi tiết công tác')
        .replace('>bắt buộc<','>tuỳ chọn<')               // công tác không bắt buộc ảnh
    +ctFormHtml2_(sua?sua.d:{},'imp')
    +'<div class="savebar">'
      +(sua?'<div class="pe-note">'+icon('edit',14)+' Đang sửa 1 công tác trong danh sách chờ — chỉnh xong bấm <b>Cập nhật</b></div>':'')
      +'<label class="imp-ghck"><input type="checkbox" id="impCtGhi"'+((sua?sua.ghi:S._ctGhi)?' checked':'')+' onchange="S._ctGhi=this.checked">'
        +' Thêm luôn vào bảng khái toán của dự án đang chọn'+(S.cur?(' — '+esc(S.cur.ten)):' (chưa chọn dự án)')+'</label>'
      +(sua
        ?'<button class="btn blue block" onclick="ctImpSave(this)">'+icon('check',15)+' Cập nhật vào danh sách chờ</button>'
          +'<button class="btn ghost sm" onclick="S._ctPendEdit=null;renderImportPT_()" style="margin-top:8px">Huỷ sửa</button>'
        :'<button class="btn blue block" onclick="ctImpSave(this)">Đưa vào danh sách chờ</button>'
          +'<button class="btn ghost sm" onclick="renderImport()" style="margin-top:8px">Xoá form</button>')
    +'</div></div>';
  var recent='<div class="imp-recent" id="impRecentBox">'+ctRecentList_()+'</div>';
  function stat(label,val){ return '<div class="imp-stat"><div class="imp-stat-v">'+val+'</div><div class="imp-stat-l">'+esc(label)+'</div></div>'; }
  box.innerHTML='<div class="sechd imp-sechd"><h2>Nhập dữ liệu</h2>'
      +'<span class="imp-sub">Thêm công tác xây dựng vào thư viện Phần thô · <b>*</b> bắt buộc</span></div>'
    +impLoaiTabs_()
    +'<div class="imp-statbar">'
      +impNganhSel_()
      +stat('Công tác trong CSDL',n)+stat('Chờ duyệt',chuaDuyet)+stat('Hạng mục',ctHangMucList_().length)
    +'</div>'
    +'<div class="imp-layout">'+form+recent+'</div>';
  S._ctGrp={}; ctFormInit_('imp');
}
/* ═══ CÔNG TÁC: DANH SÁCH CHỜ LƯU (giống sản phẩm) ═══
   Form chỉ đưa công tác vào S._ctPending (panel phải, thẻ có Sửa / Xoá);
   bấm "Thêm công tác" mới ghi vào Database (ctSave từng công tác, lỗi thì ở lại kèm lý do). */
var _ctPendSeq=0;
function ctPendItem_(uid){ return uid?(S._ctPending||[]).filter(function(x){ return x.uid===uid; })[0]:null; }
function ctRecentList_(){
  var ps=(S._ctSessionAdded||[]);   // đã lưu trong PHIÊN này
  var pd=(S._ctPending||[]);        // chờ lưu
  var cards=pd.map(function(x,i){
    var c=x.d, im=String(c.hinhAnh||'').split('\n')[0], dangSua=(S._ctPendEdit===x.uid);
    var img=im?'<img class="pc-th" src="'+esc(imgUrlOf(im))+'" onerror="this.style.visibility=\'hidden\'">':'<span class="pc-th pc-noimg">'+icon('image',14)+'</span>';
    var dmC=ctDeMucCua_(c);
    var phu=[c.hangMuc, dmC?(dmC+' '+nodeName(dmC)):'', c.dg?(money(c.dg)+' đ'+(c.dvt?'/'+c.dvt:'')):'', ptLoaiNgan_(c.loai)].filter(Boolean).join(' · ');
    return '<div class="pc'+(x.loi?' err':'')+(dangSua?' editing':'')+'">'+img
      +'<div class="pc-mid"><div class="pc-name" title="'+esc(c.ten||'')+'">'+esc(c.ten||'')+'</div>'
        +(phu?'<div class="pc-sub" title="'+esc(phu)+'">'+esc(phu)+'</div>':'')
        +(x.loi?'<div class="pc-loi">'+esc(x.loi)+'</div>':'')
        +'<span class="pc-tag">'+(dangSua?'Đang sửa':(x.loi?'Lỗi — sửa lại':'Chờ lưu'))+'</span>'
        +(x.ghi?'<span class="pc-tag kt">+ khái toán</span>':'')+'</div>'
      +'<div class="pc-act">'
        +'<button class="pc-btn" title="Sửa — mở lại trong form" onclick="ctPendEdit_('+i+')">'+icon('edit',14)+'</button>'
        +'<button class="pc-btn del" title="Xoá khỏi danh sách chờ" onclick="ctPendDel_('+i+')">'+icon('trash',14)+'</button>'
      +'</div></div>';
  }).join('');
  var rows=ps.map(function(c,i){
    var im=String(c.hinhAnh||'').split('\n')[0];
    var img=im?'<img class="imp-rth" src="'+esc(imgUrlOf(im))+'" onerror="this.style.visibility=\'hidden\'">':'<span class="imp-rth"></span>';
    var sua=c.id
      ? '<button class="imp-redit" title="Sửa lại công tác này" onclick="ctEditModal_(\''+c.id+'\')">'+icon('edit',13)+'</button>'
      : '<span class="imp-redit dis" title="Không rõ bản ghi — mở Danh sách sản phẩm để sửa">'+icon('edit',13)+'</span>';
    return '<tr><td class="c imp-ract">'+sua+'</td><td class="c">'+(i+1)+'</td>'
      +'<td class="imp-rname">'+esc(c.ten||'')
      +(c.hangMuc?'<i class="imp-rma">'+esc(c.hangMuc)+'</i>':'')+'</td><td class="c">'+img+'</td>'
      +'<td>'+esc(ptLoaiNgan_(c.loai))+'</td>'
      +'<td class="imp-rdate">'+(c.dg?money(c.dg)+' đ':'—')+'</td></tr>';
  }).join('');
  if(!cards && !rows) rows='<tr><td colspan="6" class="empty" style="padding:24px 12px;font-size:12.5px;line-height:1.5">Chưa nhập công tác nào trong phiên này.<br>Công tác bạn nhập sẽ hiện ở đây — bấm <b>Thêm công tác</b> để lưu vào Database.</td></tr>';
  return '<div class="imp-recent-h">Công tác vừa nhập (phiên này) <span class="count">'+pad2(pd.length+ps.length)+'</span></div>'
    +'<div class="imp-recent-note">Danh sách này chỉ ghi lại thao tác của <b>phiên đang mở</b> — tải lại trang sẽ trống. '
    +'Công tác đã lưu <b>vẫn nằm trong Database</b>: <a onclick="showTab(\'sanpham\');setTimeout(function(){spCatPickNode(\'3.1\');},300)">xem Danh sách sản phẩm →</a></div>'
    +'<div class="imp-recent-b">'
      +(pd.length?'<div class="pc-hd">Chờ lưu <span>'+pd.length+'</span><i>Chưa vào Database</i></div><div class="pc-list">'+cards+'</div>':'')
      +((pd.length&&ps.length)?'<div class="pc-hd done">Đã lưu vào Database <span>'+ps.length+'</span></div>':'')
      +(rows?'<table class="imp-rtbl"><thead><tr><th class="c">Sửa</th><th class="c">STT</th><th>Nội dung công việc</th><th class="c">Hình ảnh</th><th>Loại báo giá</th><th>Đơn giá</th></tr></thead><tbody>'+rows+'</tbody></table>':'')
    +'</div>'
    +'<div class="imp-rfoot">'
      +(pd.length?'<div class="imp-rfoot-note"><b>'+pd.length+'</b> công tác đang chờ — <b>chưa</b> lưu vào Database</div>':'')
      +'<button class="btn blue block" id="ctPendBtn" onclick="ctPendCommit_(this)"'+((pd.length&&!S._committing)?'':' disabled')+'>'
      +(S._committing?'⏳ Đang lưu vào Database…':(icon('plus',15)+' Thêm công tác'+(pd.length?' ('+pd.length+')':'')))+'</button></div>';
}
function ctRecentRefresh_(){ var b=document.getElementById('impRecentBox'); if(b && impLoai_()==='pt') b.innerHTML=ctRecentList_(); }
// Bấm nút dưới form: đưa vào danh sách chờ (hoặc cập nhật đúng dòng đang sửa) — CHƯA ghi Database
async function ctImpSave(btn){
  if((S._imgUploading||0)>0){ if(btn){ var bt=btn.textContent; btn.disabled=true; btn.textContent='⏳ Đợi tải ảnh…'; } await waitUploads_(15000); if(btn){ btn.disabled=false; btn.textContent=bt; } }
  var d=ctFormRead_('imp');
  if(!d.ten){ toast('Nhập tên hạng mục / nội dung công việc'); return; }
  if(!d.hangMuc){ toast('Nhập hạng mục'); return; }
  var ghiEl=document.getElementById('impCtGhi'), ghi=!!(ghiEl&&ghiEl.checked);
  S._ctPending=S._ctPending||[];
  var sua=ctPendItem_(S._ctPendEdit);
  if(sua){ sua.d=d; sua.ghi=ghi; delete sua.loi; toast('Đã cập nhật "'+d.ten+'" trong danh sách chờ'); }
  else { S._ctPending.unshift({uid:'c'+(++_ctPendSeq), d:d, ghi:ghi});
    toast('Đã đưa "'+d.ten+'" vào danh sách chờ — bấm "Thêm công tác" để lưu vào Database'); }
  S._ctPendEdit=null;
  renderImportPT_();
}
async function ctPendEdit_(i){
  var x=(S._ctPending||[])[i]; if(!x) return;
  if(S._committing){ toast('Đang lưu vào Database — đợi xong rồi sửa'); return; }
  if(S._ctPendEdit && S._ctPendEdit!==x.uid && !await xacNhan_('Đang sửa một công tác khác — bỏ các thay đổi chưa cập nhật?')) return;
  S._ctPendEdit=x.uid; renderImportPT_();
  var f=document.querySelector('#v-import .dbwrap'); if(f&&f.scrollIntoView) f.scrollIntoView({behavior:'smooth',block:'start'});
  toast('Đã mở "'+x.d.ten+'" trong form — sửa xong bấm "Cập nhật vào danh sách chờ"');
}
async function ctPendDel_(i){
  var x=(S._ctPending||[])[i]; if(!x) return;
  if(!await xacNhan_('Xoá "'+x.d.ten+'" khỏi danh sách chờ?\n(Công tác chưa được lưu vào Database nên sẽ mất hẳn.)')) return;
  var j=S._ctPending.indexOf(x); if(j<0) return; S._ctPending.splice(j,1);
  if(S._ctPendEdit===x.uid){ S._ctPendEdit=null; renderImportPT_(); } else ctRecentRefresh_();
}
async function ctPendCommit_(btn){
  if(S._committing) return;
  var ds=(S._ctPending||[]).slice(); if(!ds.length){ toast('Chưa có công tác nào chờ lưu'); return; }
  if(S._ctPendEdit && !await xacNhan_('Bạn đang sửa 1 công tác trong form nhưng chưa bấm "Cập nhật".\nLưu luôn bản CŨ của công tác đó?')) return;
  S._committing=true; ctRecentRefresh_(); btn=document.getElementById('ctPendBtn');
  try{ await ctPendCommitRun_(ds, btn); }
  finally{ S._committing=false; ctRecentRefresh_(); }
}
async function ctPendCommitRun_(ds, btn){
  if(btn){ btn.disabled=true; btn.textContent='⏳ Đang lưu 0/'+ds.length+'…'; }
  var ok=0, conLai=[], daLuu=[];
  for(var k=0;k<ds.length;k++){
    var x=ds[k];
    try{ var kq=await api('ctSave', x.d); ok++; daLuu.push(x);
      S._ctSessionAdded=S._ctSessionAdded||[]; S._ctSessionAdded.unshift((kq&&kq.rows&&kq.rows[0])||x.d); }
    catch(e){ x.loi=String(e.message||e).slice(0,160); conLai.push(x); }
    if(btn) btn.textContent='⏳ Đang lưu '+(k+1)+'/'+ds.length+'…';
  }
  var xong={}; daLuu.forEach(function(x){ xong[x.uid]=1; });
  S._ctPending=(S._ctPending||[]).filter(function(x){ return !xong[x.uid]; });   // giữ dòng thêm trong lúc lưu
  if(S._ctPendEdit && xong[S._ctPendEdit]) S._ctPendEdit=null;
  try{ await ctLoad_(true); }catch(e){}
  // Thêm vào bảng khái toán của dự án đang mở (những công tác đã tick)
  var them=0;
  if(S.cur) daLuu.filter(function(x){ return x.ghi; }).forEach(function(x){
    var d=x.d, si=PT_TEMPLATE.findIndex(function(t){ return t.db && t.t===d.hangMuc && ptLoaiGop_(ptSecLoai_(t))===ptLoaiGop_(d.loai); });
    var ii=si>=0?PT_TEMPLATE[si].items.findIndex(function(a){ var c=ctOf_(a); return c && c.ten===d.ten; }):-1;
    if(si>=0 && ii>=0){ ptAddFromLib(si,ii,true); them++; }
  });
  if(them){ ptPersist(); try{ renderPhanTho(); }catch(e){} }
  renderImportPT_();
  var msg='Đã lưu '+ok+' công tác vào Database'+(them?(' · thêm '+them+' vào bảng khái toán'):'');
  if(conLai.length) await baoLoi_({ title:conLai.length+' công tác chưa lưu được', ok:'Đã hiểu',
    note:msg+'.\nCác dòng dưới đây vẫn nằm trong danh sách chờ (nhãn "Lỗi") — sửa rồi bấm Thêm công tác lại.',
    dong:conLai.map(function(x){ return (x.d.ten||'(không tên)')+' — '+x.loi; }) });
  else toast(msg);
}

/* ==== Upload ảnh ==== */
// Dán ảnh trực tiếp bằng Ctrl+V — vào ô đang focus, mặc định là "hình chi tiết"
(function pasteImage_(){
  document.addEventListener('paste', function(e){
    var zones=document.querySelectorAll('.upzone'); if(!zones.length) return;
    var items=(e.clipboardData&&e.clipboardData.items)||[];
    var files=[];
    for(var i=0;i<items.length;i++){ if(items[i].type&&/^image\//.test(items[i].type)){ var f=items[i].getAsFile(); if(f) files.push(f); } }
    if(!files.length) return;
    if(document.activeElement && /INPUT|TEXTAREA/.test(document.activeElement.tagName)
       && !document.activeElement.closest('.upzone')) return;   // đang gõ chữ -> bỏ qua
    e.preventDefault();
    var main=upEl_('upMain');
    var zone = (main && main.classList.contains('focus')) ? 'main'
             : (!S._imgMain ? 'main' : 'more');                  // chưa có ảnh đại diện -> ưu tiên
    upFilesSeq_(zone, files);
    toast('Đã dán '+files.length+' ảnh vào '+(zone==='main'?'hình đại diện':'hình chi tiết'));
  });
  // đánh dấu vùng đang chọn để dán đúng chỗ
  document.addEventListener('focusin', function(e){
    var z=e.target.closest&&e.target.closest('.upzone');
    document.querySelectorAll('.upzone.focus').forEach(function(x){x.classList.remove('focus');});
    if(z) z.classList.add('focus');
  });
})();

// Chặn trình duyệt MỞ FILE khi thả trượt ra ngoài vùng upload (nếu không, cả trang bị điều hướng
// -> người dùng tưởng "không kéo thả được"). Đồng thời sáng vùng thả gần nhất khi đang kéo file.
(function guardFileDrop_(){
  function hasFiles(e){ var d=e.dataTransfer; return d && d.types && [].indexOf.call(d.types,'Files')>=0; }
  document.addEventListener('dragover',function(e){ if(hasFiles(e)) e.preventDefault(); });
  document.addEventListener('drop',function(e){
    if(!hasFiles(e)) return;
    if(e.target.closest && e.target.closest('.upzone')) return;   // để vùng upload tự xử lý
    e.preventDefault();
    var zones=document.querySelectorAll('.upzone');
    if(zones.length) toast('Thả ảnh vào đúng khung "Hình đại diện" hoặc "Hình chi tiết" nhé');
  });
})();

function upDrag(e,on){ e.preventDefault(); e.currentTarget.classList.toggle('drag',!!on); }
async function upFilesSeq_(zone,fs){
  if(zone==='main'){ if(fs.length>1) toast('Hình đại diện chỉ 1 ảnh — lấy ảnh đầu.'); fs=fs.slice(0,1); }  // RULE: đại diện chỉ 1 ảnh
  for(var i=0;i<fs.length;i++){ try{ await upFile(zone,fs[i]); }catch(e){} }  // tải TUẦN TỰ như nhập file
}
function upPick(zone){
  var inp=document.createElement('input'); inp.type='file'; inp.accept='image/*'; if(zone==='more') inp.multiple=true;
  inp.onchange=function(){ upFilesSeq_(zone, Array.prototype.slice.call(inp.files||[])); };
  inp.click();
}
function upDrop(e,zone){ e.preventDefault(); e.currentTarget.classList.remove('drag');
  // nhận ảnh; nếu type rỗng (vd HEIC) vẫn thử (downscale sẽ báo nếu không đọc được)
  var fs=Array.prototype.slice.call((e.dataTransfer&&e.dataTransfer.files)||[]).filter(function(f){ return !f.type || /^image\//.test(f.type); });
  upFilesSeq_(zone, fs);
}
/* Nén + thu nhỏ ảnh ở client trước khi upload (tránh payload quá lớn -> "Failed to fetch") */
function downscaleImage_(file, maxDim, quality){
  return new Promise(function(resolve){
    try{
      if(!file || !/^image\//.test(file.type||'')){ return readB64_(file).then(resolve,function(){resolve('');}); }
      var url=URL.createObjectURL(file), img=new Image();
      img.onload=function(){
        try{
          var w=img.naturalWidth||img.width, h=img.naturalHeight||img.height;
          var scale=Math.min(1,(maxDim||1600)/Math.max(w,h||1));
          var nw=Math.max(1,Math.round(w*scale)), nh=Math.max(1,Math.round(h*scale));
          var c=document.createElement('canvas'); c.width=nw; c.height=nh;
          c.getContext('2d').drawImage(img,0,0,nw,nh);
          URL.revokeObjectURL(url);
          var out=c.toDataURL('image/jpeg', quality||0.82);
          // nếu vì lý do nào đó vẫn > ~4MB thì nén mạnh hơn
          if(out.length>5.5e6){ out=c.toDataURL('image/jpeg',0.6); }
          resolve(out);
        }catch(e){ URL.revokeObjectURL(url); readB64_(file).then(resolve,function(){resolve('');}); }
      };
      img.onerror=function(){ URL.revokeObjectURL(url); resolve('__DECODE_FAIL__'); }; // trình duyệt không giải mã được (vd HEIC iPhone)
      img.src=url;
    }catch(e){ resolve('__DECODE_FAIL__'); }
  });
}
// Gọi uploadImage có thử lại nhiều lần, backoff tăng dần (chịu được rớt mạng / Render cold-start / redeploy)
async function uploadImg_(dataUrl, name){
  var backoff=[1000,2500,5000,8000], lastErr;
  for(var k=0;k<=backoff.length;k++){
    try{ var r=await api('uploadImage', dataUrl, name||'image.jpg'); var tok=r&&(r.token||r.url); if(tok) return tok; throw new Error('Không nhận được ảnh'); }
    catch(e){ lastErr=e; if(k<backoff.length) await new Promise(function(res){ setTimeout(res,backoff[k]); }); }
  }
  throw lastErr;
}
function upBusy_(d){ S._imgUploading=Math.max(0,(S._imgUploading||0)+d); }
// Đợi mọi ảnh đang tải xong (tối đa timeout ms) trước khi lưu — tránh lưu thiếu ảnh
async function waitUploads_(timeout){ var t0=Date.now(); while((S._imgUploading||0)>0 && Date.now()-t0<(timeout||15000)){ await new Promise(function(r){ setTimeout(r,250); }); } }
async function upFile(zone,file){
  upBusy_(1);   // đánh dấu có ảnh đang xử lý ngay từ đầu
  return downscaleImage_(file,1600,0.82).then(async function(dataUrl){
    try{
      if(dataUrl==='__DECODE_FAIL__'){ toast('Không đọc được ảnh — có thể ảnh iPhone (.HEIC). Hãy đổi sang JPG/PNG hoặc dán URL ảnh.'); return; }
      if(!dataUrl){ toast('Không đọc được ảnh — hãy thử ảnh khác hoặc dán URL.'); return; }
      // preview tạm bằng dataURL (dùng chính dataURL làm khoá để chống race khi tải nhiều ảnh cùng lúc)
      if(zone==='main'){ S._imgMain=dataUrl; } else { S._imgList.push(dataUrl); }
      upRefresh(); toast('Đang tải ảnh lên…');
      try{
        var tok=await uploadImg_(dataUrl, file.name);   // có thử lại nếu rớt mạng
        if(zone==='main'){ if(S._imgMain===dataUrl) S._imgMain=tok; }
        else { var ix=S._imgList.indexOf(dataUrl); if(ix>=0) S._imgList[ix]=tok; }   // thay đúng ô của ảnh này (nếu chưa bị xoá)
        upRefresh(); toast('Đã tải ảnh lên');
      }catch(e){
        // upload lỗi -> gỡ đúng preview tạm của ảnh này, gợi ý dán URL
        if(zone==='main'){ if(S._imgMain===dataUrl) S._imgMain=''; } else { var ie=S._imgList.indexOf(dataUrl); if(ie>=0) S._imgList.splice(ie,1); }
        upRefresh(); toast('Tải ảnh lỗi: '+(/fetch/i.test(e.message)?'mất kết nối, thử lại':e.message)+' — hoặc dán URL ảnh.');
      }
    } finally { upBusy_(-1); }
  });
}
function upAddUrl(zone){
  var id=zone==='main'?'upMainUrl':'upMoreUrl'; var el=upEl_(id); var u=(el&&el.value||'').trim();
  if(!u){ toast('Nhập URL ảnh'); return; }
  if(zone==='main') S._imgMain=u; else S._imgList.push(u);
  if(el)el.value=''; upRefresh();
}
function upRemove(zone,i){ if(zone==='main') S._imgMain=''; else S._imgList.splice(i,1); upRefresh(); }
async function impPick(input){
  var f=input.files&&input.files[0]; if(!f) return;
  var ext=(f.name.split('.').pop()||'').toLowerCase();
  var pv=document.getElementById('impPreview'); pv.innerHTML='<div style="color:var(--muted)">Đang đọc file "'+esc(f.name)+'"…</div>';
  var reader=new FileReader();
  reader.onload=async function(){
    try{ var b64=String(reader.result).split(',')[1];
      var l0=impLoai_(); S._impNganh=(l0==='vs'||l0==='son')?l0:'';
      var res=await api('importParse',b64,ext,S._impNganh);
      // File vệ sinh / sơn nước mà ô Ngành hàng đang để Thiết bị đèn -> tự nhận theo cột HẠNG MỤC
      if(!S._impNganh){
        var ps=res.products||[], hmRaw=function(p){ return (p._raw||{})['HẠNG MỤC']||p.hangMuc; };
        var doan=[['vs',VS_SPEC,'THIẾT BỊ VỆ SINH','Thiết bị vệ sinh'],['son',SON_SPEC,'SƠN NƯỚC','Sơn nước']].filter(function(x){
          return ps.length && ps.filter(function(p){ return x[1].chuanHM(hmRaw(p)); }).length*2>=ps.length; })[0];
        if(doan){ S._impNganh=doan[0]; ps.forEach(function(p){ p._nganh=doan[0]; });
          S._impLoai=doan[0]; renderImport(); pv=document.getElementById('impPreview');
          toast('File là '+doan[2]+' (theo cột Hạng mục) — đã tự chuyển ngành hàng sang '+doan[3]); } }
      impShow(res); }
    catch(e){ pv.innerHTML='<div style="color:#c33">Lỗi đọc file: '+esc(e.message)+'</div>'; }
  };
  reader.onerror=function(){ pv.innerHTML='<div style="color:#c33">Không đọc được file.</div>'; };
  reader.readAsDataURL(f);
}
function impImgs_(p){ return String(p.hinhAnh||'').split('\n').map(function(s){return s.trim();}).filter(Boolean); }
function impMain_(p){ return impImgs_(p)[0]||''; }
function impMore_(p){ return impImgs_(p).slice(1); }
/* Ô ảnh trong bảng xem trước: 1 ảnh chính + nhiều ảnh chi tiết */
function impImgCell2_(p,i){
  var main=impMain_(p), more=impMore_(p);
  var mainHtml = main
    ? '<div class="iithumb"><img src="'+esc(imgUrlOf(main))+'" onerror="this.style.visibility=\'hidden\'"><button class="iix" title="Xoá" onclick="impDelImg('+i+',0)">✕</button></div>'
    : '<button class="iiadd" onclick="impPickMain('+i+')" title="Tải ảnh chính">'+icon('camera',16)+'</button>';
  var moreHtml = more.map(function(u,k){ return '<div class="iithumb sm"><img src="'+esc(imgUrlOf(u))+'" onerror="this.style.visibility=\'hidden\'"><button class="iix" onclick="impDelImg('+i+','+(k+1)+')">✕</button></div>'; }).join('')
    + '<button class="iiadd sm" onclick="impPickMore('+i+')" title="Thêm ảnh chi tiết">＋</button>';
  return '<div class="iicell">'
    +'<div class="iislot"><span class="iilb">Ảnh chính</span>'+mainHtml+'</div>'
    +'<div class="iislot"><span class="iilb">Ảnh chi tiết</span><div class="iimore">'+moreHtml+'</div></div>'
    +'</div>';
}
function impCellVal_(p,h){ var v=(p._raw&&p._raw[h]); return v==null?'':String(v); }
/* Thiết bị vệ sinh: kiểm tra 1 dòng theo hạng mục của nó -> {hm, loi:[...], na:{nhãn:1}, thieu:{nhãn:1}} */
function impSpec_(){ return specNganh_(S._impNganh==='son'?'son':'vs'); }
function impVsCheck_(p){
  var VS_SPEC=impSpec_();
  var raw=p._raw||{}, hm=VS_SPEC.chuanHM(raw['HẠNG MỤC']), out={hm:hm, loi:[], na:{}, thieu:{}};
  if(!hm){ out.loi.push(raw['HẠNG MỤC']?('Hạng mục "'+raw['HẠNG MỤC']+'" không hợp lệ'):'Chưa có hạng mục'); return out; }
  var cho=VS_SPEC.labelsOf(hm);
  Object.keys(VS_SPEC.METRIC).forEach(function(lb){ if(cho.indexOf(lb)<0) out.na[lb]=1; });
  VS_SPEC.HM[hm].req.forEach(function(lb){ if(!String(raw[lb]||'').trim()){ out.thieu[lb]=1; out.loi.push('thiếu '+VS_SPEC.METRIC[lb][1]); } });
  return out;
}
function impRow_(p,i){
  var heads=S._impHeaders||[], vs=(S._impNganh==='vs'||S._impNganh==='son'), ck=vs?impVsCheck_(p):null;
  return '<tr'+(ck&&ck.loi.length?' class="iierr" title="'+esc((ck.hm||'')+(ck.hm?': ':'')+ck.loi.join(', '))+'"':'')+'><td class="iisttd">'+(i+1)
      +(ck&&ck.loi.length?'<span class="iiwarn" title="'+esc(ck.loi.join(', '))+'">!</span>':'')+'</td><td class="iiimgtd" id="impimg_'+i+'">'+impImgCell2_(p,i)+'</td>'
    +heads.map(function(h){
      // Cột thông số không thuộc hạng mục của dòng này -> khoá lại, không nhập
      if(ck && ck.na[h]) return '<td class="iina" title="Không áp dụng cho '+esc(ck.hm)+'">—</td>';
      return '<td class="iied'+(ck&&(ck.thieu[h]||(h==='HẠNG MỤC'&&!ck.hm))?' iimiss':'')+'" contenteditable="true" spellcheck="false" data-i="'+i+'" data-h="'+esc(h)+'" oninput="impEdit(this)"'
        +(h==='HẠNG MỤC'&&vs?' onblur="impRerow_('+i+')"':'')+'>'+esc(impCellVal_(p,h))+'</td>'; }).join('')+'</tr>';
}
// Sửa HẠNG MỤC / ô bắt buộc trong bảng xem trước -> vẽ lại dòng để cập nhật cột áp dụng & cảnh báo
function impRerow_(i){
  var tb=document.getElementById('impBody'), p=(S._impProducts||[])[i]; if(!tb||!p) return;
  var tr=tb.children[i]; if(!tr) return;
  var t=document.createElement('tbody'); t.innerHTML=impRow_(p,i); tb.replaceChild(t.firstChild,tr);
  impVsSummary_();
}
function impVsSummary_(){
  var el=document.getElementById('impVsSum'); if(!el||!(S._impNganh==='vs'||S._impNganh==='son')) return;
  var loi=(S._impProducts||[]).filter(function(p){ return impVsCheck_(p).loi.length; }).length;
  el.innerHTML=loi?('<b style="color:#c33">'+loi+'</b> dòng thiếu thông số bắt buộc / sai hạng mục (ô viền đỏ) — sẽ KHÔNG được nhập nếu chưa sửa')
    :'<span style="color:#1a7f37">Mọi dòng đủ thông số bắt buộc theo hạng mục</span>';
}
function impEdit(el){
  var i=+el.getAttribute('data-i'), h=el.getAttribute('data-h'), p=S._impProducts[i]; if(!p) return;
  if(!p._raw) p._raw={}; p._raw[h]=el.textContent;
  // đồng bộ vài trường cơ bản để danh sách "vừa nhập" hiển thị đúng
  if((S._impNganh==='vs'||S._impNganh==='son') && impSpec_().METRIC[h]){ el.classList.toggle('iimiss', !el.textContent.trim() && impVsCheck_(p).thieu[h]===1); impVsSummary_(); }
  if(h==='TÊN SẢN PHẨM') p.ten=el.textContent;
  else if(h==='THƯƠNG HIỆU') p.thuongHieu=el.textContent;
  else if(h==='MÃ SẢN PHẨM') p.ma=el.textContent;
}
function impRefreshRow(i){ var c=document.getElementById('impimg_'+i); if(c) c.innerHTML=impImgCell2_(S._impProducts[i],i); }
function impUpdateCounter(){ var n=(S._impProducts||[]).filter(function(p){return p.hinhAnh;}).length; var el=document.getElementById('impImgCount'); if(el){ el.textContent=n; el.style.color=(n<(S._impProducts||[]).length)?'#c9820a':'#1a7f37'; } }
function readB64_(f){ return new Promise(function(res,rej){ var r=new FileReader(); r.onload=function(){res(String(r.result));}; r.onerror=rej; r.readAsDataURL(f); }); }
async function impUploadFiles_(fs){
  upBusy_(1);
  try{
    var toks=[]; for(var k=0;k<fs.length;k++){ try{ var b=await downscaleImage_(fs[k],1600,0.82);
      if(b==='__DECODE_FAIL__'){ toast('Ảnh "'+(fs[k].name||'')+'" không đọc được (có thể .HEIC) — đổi JPG/PNG.'); continue; }
      if(!b) continue;
      var tok=await uploadImg_(b, fs[k].name); if(tok) toks.push(tok);
    }catch(e){ toast('Tải ảnh lỗi: '+(/fetch/i.test(e.message)?'mất kết nối':e.message)); } } return toks;
  } finally { upBusy_(-1); }
}
function impSetImgs_(i,arr){ S._impProducts[i].hinhAnh=arr.filter(Boolean).join('\n'); impRefreshRow(i); impUpdateCounter(); }
async function impPickMain(i){
  var inp=document.createElement('input'); inp.type='file'; inp.accept='image/*';
  inp.onchange=async function(){ var fs=Array.prototype.slice.call(inp.files||[]); if(!fs.length) return;
    var cell=document.getElementById('impimg_'+i); if(cell)cell.innerHTML='<span class="iiwait">⏳ Đang tải…</span>';
    var toks=await impUploadFiles_(fs.slice(0,1)); var cur=impImgs_(S._impProducts[i]);
    if(toks.length){ if(cur.length) cur[0]=toks[0]; else cur=[toks[0]]; }
    impSetImgs_(i,cur);
  }; inp.click();
}
async function impPickMore(i){
  var inp=document.createElement('input'); inp.type='file'; inp.accept='image/*'; inp.multiple=true;
  inp.onchange=async function(){ var fs=Array.prototype.slice.call(inp.files||[]); if(!fs.length) return;
    var cell=document.getElementById('impimg_'+i); if(cell)cell.innerHTML='<span class="iiwait">⏳ Đang tải…</span>';
    var toks=await impUploadFiles_(fs); var cur=impImgs_(S._impProducts[i]).concat(toks);
    impSetImgs_(i,cur);
  }; inp.click();
}
function impDelImg(i,idx){ var cur=impImgs_(S._impProducts[i]); cur.splice(idx,1); impSetImgs_(i,cur); }
function impShow(res){
  S._impProducts=res.products||[];
  // Ảnh KHÔNG lấy từ file — người dùng tự tải ảnh chính/chi tiết cho từng SP sau khi import
  S._impProducts.forEach(function(p){ p.hinhAnh=''; });
  S._impHeaders=res.headers||[];
  var pv=document.getElementById('impPreview');
  if(!res.count){ pv.innerHTML='<div style="color:#c33">Không đọc được sản phẩm nào (kiểm tra cột Tên sản phẩm).</div>'; return; }
  var heads=S._impHeaders;
  var rows=S._impProducts.map(function(p,i){ return impRow_(p,i); }).join('');
  var recog=Object.keys(res.mapped||{}).map(function(k){return esc(res.mapped[k]);}).join(' · ');
  pv.innerHTML=
    '<div class="imp-pv-info"><div class="imp-pv-h">Đọc được <b>'+res.count+'</b> sản phẩm · <b>'+heads.length+'</b> cột từ file</div>'
    +'<div class="imp-pv-sub">'+icon('image',15)+' Tải <b>ảnh chính</b> và <b>ảnh chi tiết</b> cho từng SP ở cột đầu — <b id="impImgCount">0</b>/'+res.count+' đã có ảnh</div>'
    +((S._impNganh==='vs'||S._impNganh==='son')?'<div class="imp-pv-sub" id="impVsSum"></div>':'')+'</div>'
    +'<div class="imp-pv-wrap"><table class="imp-pvtbl"><thead><tr><th class="iistth">STT</th><th class="iiimgth">Ảnh (chính + chi tiết)</th>'
      +heads.map(function(h){return '<th>'+esc(h)+'</th>';}).join('')+'</tr></thead><tbody id="impBody">'+rows+'</tbody></table></div>'
    +'<div class="imp-pv-foot"><button class="btn blue" onclick="impCommit(this)">'+icon('check',15)+' Đưa '+res.count+' sản phẩm vào danh sách chờ</button>'
      +'<span class="imp-pv-note">Cột nhận diện & map DB: '+recog+'</span></div>';
  impUpdateCounter(); impVsSummary_();
}
async function impCommit(btn){
  if(!S._impProducts||!S._impProducts.length){ toast('Chưa có dữ liệu'); return; }
  if((S._imgUploading||0)>0){ toast('Đang tải ảnh lên, đợi chút…'); if(btn){ btn.disabled=true; var ot=btn.textContent; btn.textContent='⏳ Đợi tải ảnh…'; } await waitUploads_(20000); if(btn){ btn.disabled=false; btn.textContent=ot; } }
  var missing=S._impProducts.filter(function(p){return !p.hinhAnh;}).length;
  if(missing>0 && !await xacNhan_('Còn '+missing+' sản phẩm CHƯA có ảnh.\nBạn nên bấm ô ＋ ở cột Ảnh để tải hình cho từng SP.\n\nVẫn tiếp tục?')) return;
  // KHÔNG lưu ngay: đưa cả lô vào danh sách CHỜ LƯU — bấm "Thêm sản phẩm" ở panel phải mới ghi vào Database
  var ng=(S._impNganh==='vs'||S._impNganh==='son')?S._impNganh:'';
  pendingAdd_(S._impProducts.map(function(p){
    if(ng) p._nganh=ng;   // server đóng dấu ngành + lọc thông số theo hạng mục
    return {kind:'file', prod:p, ten:p.ten, ma:p.ma, thuongHieu:p.thuongHieu, ncc:p.ncc, hinhAnh:p.hinhAnh, nganh:ng||'den'};
  }));
  toast('Đã đưa '+S._impProducts.length+' sản phẩm vào danh sách chờ — bấm "Thêm sản phẩm" để lưu vào Database');
  S._impProducts=[]; var pv=document.getElementById('impPreview'); if(pv) pv.innerHTML='';
  var f=document.getElementById('impFile'); if(f) f.value='';
}
/* ===== BIẾN THỂ: sinh tổ hợp nhiệt độ màu × công suất × góc chiếu ===== */
function varList_(id){ var e=document.getElementById(id); if(!e) return [];
  return String(e.value||'').split(',').map(function(x){return x.trim();}).filter(Boolean); }
function varCombos_(){
  var K=varList_('varKelvin'), W=varList_('varWatt'), A=varList_('varAngle'), C=varList_('varColor'), Z=varList_('varSize');
  if(!K.length && !W.length && !A.length && !C.length && !Z.length) return [];   // không dùng biến thể
  var out=[];
  (K.length?K:[null]).forEach(function(k){
    (W.length?W:[null]).forEach(function(w){
      (A.length?A:[null]).forEach(function(a){
        (C.length?C:[null]).forEach(function(c){
          (Z.length?Z:[null]).forEach(function(z){ out.push({k:k,w:w,a:a,c:c,z:z}); });
        });
      });
    });
  });
  return out;
}
function varPreview_(){
  var el=document.getElementById('varNote'); if(!el) return;
  var K=varList_('varKelvin'), W=varList_('varWatt'), A=varList_('varAngle'), C=varList_('varColor'), Z=varList_('varSize');
  var c=varCombos_();
  if(!c.length){ el.className='var-note'; el.textContent='Bỏ trống = chỉ tạo 1 sản phẩm theo thông số đã nhập ở trên.'; return; }
  // Ghi RÕ phép nhân để không hiểu nhầm số lượng (VD 2 nhiệt độ × 2 góc = 4, KHÔNG phải 12)
  var parts=[];
  if(K.length) parts.push(K.length+' nhiệt độ');
  if(W.length) parts.push(W.length+' công suất');
  if(A.length) parts.push(A.length+' góc');
  if(C.length) parts.push(C.length+' màu');
  if(Z.length) parts.push(Z.length+' kích thước');
  el.className='var-note on';
  el.innerHTML='<div class="var-math">'+parts.join(' <b>×</b> ')+' <b>=</b> <span class="var-total">'+c.length+' sản phẩm</span></div>'
    +'<div class="var-list">'+c.slice(0,8).map(function(x){ return '<span class="var-chip">'+[x.w?x.w+'W':'',x.k?x.k+'K':'',x.a?x.a+'°':'',x.c||'',x.z||''].filter(Boolean).join(' · ')+'</span>'; }).join('')
    +(c.length>8?' <i>… +'+(c.length-8)+' nữa</i>':'')+'</div>';
}
async function tdSave(btn){
  var data={};
  // Ngành có bộ thông số theo hạng mục: vệ sinh (VS_SPEC) và sơn nước (SON_SPEC)
  var ngIn=impLoai_(), laVS=(ngIn==='vs'||ngIn==='son'), SPEC=specNganh_(ngIn);
  var hmVS=laVS?SPEC.chuanHM((document.getElementById(dbIdOf('HẠNG MỤC'))||{}).value):'';
  impFlat_().forEach(function(f,i){ var e=document.getElementById('dbf_'+i); if(!e) return;
    if(laVS && f[6]==='vs' && SPEC.labelsOf(hmVS).indexOf(f[0])<0) return;   // thông số của hạng mục khác
    var v=(e.value||'').trim(); if(v) data[f[0]]=v; });
  data['NGÀNH HÀNG']=laVS?ngIn:'den';        // đóng dấu ngành -> SP về đúng đề mục trên cây
  var ten=String(data['TÊN SẢN PHẨM']||'').trim(); if(!ten){ toast('Nhập Tên sản phẩm'); return; }
  if(laVS){
    if(!hmVS){ toast('Chọn Hạng mục '+(ngIn==='son'?'sơn nước':'thiết bị vệ sinh')); return; }
    var thieu=SPEC.HM[hmVS].req.filter(function(lb){ return !data[lb]; });
    // biến thể theo màu / kích thước điền ở khối Biến thể thì không tính là thiếu
    if(varList_('varColor').length) thieu=thieu.filter(function(lb){ return lb!=='MÀU SẮC'; });
    if(varList_('varSize').length) thieu=thieu.filter(function(lb){ return lb!=='KÍCH THƯỚC'; });
    if(thieu.length){ toast(hmVS+' cần nhập: '+thieu.map(function(lb){ return SPEC.METRIC[lb][1]; }).join(', ')); return; }
  }
  delete data['GIÁ ĐẠI LÝ']; // cột tự tính (generated) — không ghi
  if(!data['ĐƠN VỊ TÍNH']) data['ĐƠN VỊ TÍNH']=(ngIn==='son'?'Thùng':'Cái');
  if(!data['TRẠNG THÁI']) data['TRẠNG THÁI']='Đang kinh doanh';
  btn.disabled=true; var o=btn.textContent;
  if((S._imgUploading||0)>0){ btn.textContent='⏳ Đợi tải ảnh…'; await waitUploads_(15000); } // đợi ảnh tải xong để lưu đủ ảnh
  var imgs=[S._imgMain].concat(S._imgList||[]).filter(Boolean).filter(function(v){return v.indexOf('data:')!==0;}); // bỏ preview base64 chưa upload xong
  if(imgs.length) data['ẢNH SẢN PHẨM']=imgs.join('\n');
  /* KHÔNG lưu ngay: đưa vào danh sách CHỜ LƯU ở panel bên phải — bấm "Thêm sản phẩm" mới ghi vào Database */
  var meta={thuongHieu:data['THƯƠNG HIỆU']||'', ncc:data['NHÀ CUNG CẤP']||'', hinhAnh:data['ẢNH SẢN PHẨM']||'', nganh:data['NGÀNH HÀNG']};
  var combos=varCombos_(), items=[];
  if(combos.length){
    // BIẾN THỂ: 1 sản phẩm cho mỗi tổ hợp (cùng mã SP, khác nhiệt độ/công suất/góc/màu/kích thước)
    combos.forEach(function(c){
      var d2=Object.assign({},data);
      if(c.k) d2['NHIỆT ĐỘ MÀU (K)']=c.k;
      if(c.w) d2['CÔNG SUẤT (W)']=c.w;
      if(c.a) d2['GÓC CHIẾU (°)']=c.a;
      if(c.c) d2['MÀU SẮC']=c.c;
      if(c.z) d2['KÍCH THƯỚC']=c.z;
      var bt=[c.w?c.w+'W':'',c.k?c.k+'K':'',c.a?c.a+'°':'',c.c||'',c.z||''].filter(Boolean).join(' · ');
      items.push(Object.assign({kind:'form', data:d2, ten:ten, bienThe:bt, ma:data['MÃ SẢN PHẨM']||''}, meta));
    });
  } else items.push(Object.assign({kind:'form', data:data, ten:ten, ma:data['MÃ SẢN PHẨM']||''}, meta));
  var cbo=(S._impCombo||[]).map(function(x){ return Object.assign({},x); });
  if(cbo.length) items.forEach(function(x){ x.combo=cbo; });          // mỗi biến thể cùng bộ đi kèm
  // Ghi danh vào dự án (tuỳ chọn) — thực hiện SAU khi lưu thành công, gắn vào dòng đầu của lượt này
  var gd=document.getElementById('impGhiDanh'), ps=document.getElementById('impProjSel'), sl=document.getElementById('impGhiSL');
  // Tick ghi danh mà chưa chọn dự án -> báo ngay, đừng để lưu xong mới thấy dự án trống
  if(gd&&gd.checked&&ps&&!ps.value){ btn.disabled=false; btn.textContent=o||btn.textContent;
    toast('Đã tick "Thêm vào dự án" nhưng chưa chọn dự án — chọn dự án ở ô bên cạnh'); ps.focus(); return; }
  if(gd&&gd.checked&&ps&&ps.value){
    var gia=Number(data['GIÁ BÁN LẺ'])||0, qty=Math.max(1,Number(sl&&sl.value)||1);
    // Đề mục theo NGÀNH đang nhập: vệ sinh -> 3.2.5, đèn -> 3.2.6.1 (trước đây luôn ghi vào
    // 3.2.6.1 nên SP vệ sinh ghi danh xong vào tab Dự án lọc 3.2.5 lại không thấy).
    var ndGhi=(impLoai_()==='son')?'3.2.2':((impLoai_()==='vs')?'3.2.5':'3.2.6.1');
    items[0].ghi={ maDA:ps.value, qty:qty, prod:{ ten:ten, ma:data['MÃ SẢN PHẨM']||'', thuongHieu:data['THƯƠNG HIỆU']||'', ncc:data['NHÀ CUNG CẤP']||'',
      moTa:data['MÔ TẢ']||'', kichThuoc:data['KÍCH THƯỚC']||'', dvt:data['ĐƠN VỊ TÍNH']||'Cái', hinhAnh:data['ẢNH SẢN PHẨM']||'',
      donGiaVon:gia, donGiaBan:gia, nhom:ndGhi, hangMuc:nodeName(ndGhi), loai:nodeName(ndGhi), tang:'', extra:{nganh:data['DÒNG SẢN PHẨM']||''} } };
  }
  var dangSua=S._pendEdit, viTri=(S._pending||[]).map(function(x){ return x.uid; }).indexOf(dangSua);
  S._pendEdit=null;
  if(dangSua && viTri>=0){
    // SỬA: thay đúng dòng đang sửa (giữ vị trí), không tạo dòng mới
    items.forEach(function(x){ x.uid=pendUid_(); });
    S._pending.splice.apply(S._pending,[viTri,1].concat(items));
    toast('Đã cập nhật "'+ten+'" trong danh sách chờ');
  } else {
    pendingAdd_(items);
    toast('Đã đưa '+(items.length>1?(items.length+' biến thể của '):'')+'"'+ten+'" vào danh sách chờ — bấm "Thêm sản phẩm" để lưu vào Database');
  }
  renderImport();
}
