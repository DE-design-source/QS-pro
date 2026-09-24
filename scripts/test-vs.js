'use strict';
/* Test hồi quy THIẾT BỊ VỆ SINH (không gọi Supabase thật — server/supa được thay bằng DB giả trong bộ nhớ).
   Chạy: npm run test:vs   (từ thư mục gốc dự án). Thoát mã 1 nếu có lỗi.
   Phủ: vs-spec nhất quán + khớp migration, file mẫu -> đọc -> lưu, tự nhận ngành theo hạng mục,
   lọc cột theo hạng mục, lỗi trả về theo chỉ số dòng, prodToObj, khoá biến thể. */
const path=require('path'), R=p=>path.join(__dirname,'..',p);
let db=[], hist=[], fail=0, pass=0;
const ok=(c,m)=>{ if(c){pass++;} else {fail++; console.log('  ✗ FAIL:',m);} };
const fake={ eq:(c,v)=>c+'=eq.'+encodeURIComponent(v),
  select:async(t,o)=>{ if(t!=='db_san_pham') return []; if(o&&o.filter&&/ma_sp=eq/.test(o.filter)){ return db.filter(r=>o.filter.indexOf('ma_sp=eq.'+encodeURIComponent(r.ma_sp))>=0 && ['mau_sac','kich_thuoc'].every(c=>{const v=r[c]; return (v==null||v==='')? o.filter.indexOf(c+'=is.null')>=0 : o.filter.indexOf(c+'=eq.'+encodeURIComponent(v))>=0;})).slice(0,1); } return db.map(r=>Object.assign({},r)); },
  insert:async(t,r)=>{ if(t==='db_san_pham'){ const row=Object.assign({id:db.length+1},r); db.push(row); return [row]; } if(t==='db_san_pham_history') hist.push(r); return [{}]; },
  update:async(t,f,p)=>{ if(t==='db_san_pham'){ const id=+String(f).split('eq.')[1]; const r=db.find(x=>x.id===id); Object.assign(r,p); return [r]; } return [{}]; },
  remove:async()=>{} };
require.cache[require.resolve(R('server/supa'))]={id:'x',filename:'x',loaded:true,exports:new Proxy(fake,{get:(o,k)=>o[k]||(async()=>[])})};
const VS=require(R('public/vs-spec.js')), st=require(R('server/store_supa')), store=require(R('server/store')), tpl=require(R('server/vs-template'));
(async()=>{
  console.log('1. vs-spec nhất quán');
  const cols=Object.values(VS.METRIC).map(m=>m[0]); ok(new Set(cols).size===cols.length,'trùng cột DB trong METRIC');
  for(const hm of VS.HANG_MUC){ const h=VS.HM[hm];
    [...h.chinh,...h.tk,...h.req,...Object.keys(h.opt)].forEach(lb=>ok(VS.METRIC[lb],hm+': nhãn lạ '+lb));
    h.req.forEach(lb=>ok(h.chinh.concat(h.tk).includes(lb),hm+': req không nằm trong chinh/tk '+lb));
    (h.kem||[]).forEach(k=>ok(VS.HM[k],hm+': kem lạ '+k));
    ok(h.chinh.concat(h.tk).filter((x,i,a)=>a.indexOf(x)!==i).length===0, hm+': thông số lặp');
    const thieu=h.req.filter(lb=>!h.mau[lb]); ok(!thieu.length, hm+': dòng mẫu thiếu bắt buộc '+thieu); }
  ok(VS.chuanHM('bon cau')==='Bồn cầu' && VS.chuanHM('  LAVABO ')==='Lavabo' && VS.chuanHM('Đèn nội thất')==='','chuanHM');
  const sql=require('fs').readFileSync(R('db/thiet_bi_ve_sinh_v2.sql'),'utf8')+require('fs').readFileSync(R('db/thiet_bi_ve_sinh.sql'),'utf8')+require('fs').readFileSync(R('db/schema.sql'),'utf8');
  cols.forEach(c=>ok(new RegExp('\\b'+c+'\\b').test(sql),'cột '+c+' không có trong migration'));

  console.log('2. File mẫu -> đọc lại -> lưu');
  const buf=Buffer.from(await tpl.buildVsTemplate());
  let r=await store.importParse(buf.toString('base64'),'xlsx','vs'); ok(r.count===0,'dòng ví dụ phải tự bỏ qua, thực tế '+r.count);
  ok(!r.mapped.hinhAnh,'cột BẢO HÀNH bị nhận nhầm là ảnh: '+r.mapped.hinhAnh);
  ok(r.mapped.ma==='MÃ SẢN PHẨM' && r.mapped.ten==='TÊN SẢN PHẨM' && r.mapped.gia==='GIÁ BÁN LẺ','map cột cơ bản '+JSON.stringify(r.mapped));
  // bỏ tiền tố ví dụ -> 3 dòng thật
  const ExcelJS=require(R('node_modules/exceljs')); const wb=new ExcelJS.Workbook(); await wb.xlsx.load(buf); const ws=wb.getWorksheet('San pham');
  const ci=ws.getRow(1).values.indexOf('TÊN SẢN PHẨM'); for(let k=2;k<=4;k++){ const c=ws.getRow(k).getCell(ci); c.value=String(c.value).replace(VS.VD+' ',''); }
  r=await store.importParse(Buffer.from(await wb.xlsx.writeBuffer()).toString('base64'),'xlsx','vs'); ok(r.count===3,'3 dòng thật, thực tế '+r.count);
  ok(r.products.every(p=>!p.hinhAnh),'hinhAnh phải rỗng');
  r.products.forEach(p=>p._nganh='vs');
  let c=await st.importCommit(null,r.products); ok(c.inserted===3 && !c.errors,'commit mẫu '+JSON.stringify(c));
  ok(db.every(x=>x.nganh==='vs'),'đóng dấu nganh vs');
  ok(!db.find(x=>x.hang_muc==='Sen tắm').he_thong_xa,'sen tắm không được có hệ thống xả');
  // file đèn không bị ảnh hưởng
  const den=require('fs').readFileSync(R('public/mau-nhap-hang-loat.xlsx')); r=await store.importParse(den.toString('base64'),'xlsx'); ok(r.count>0,'file đèn vẫn đọc được');

  console.log('3. Nhập file vệ sinh nhưng quên chọn ngành (không _nganh)');
  db=[]; c=await st.importCommit(null,[{ten:'Lavabo X',_raw:{'TÊN SẢN PHẨM':'Lavabo X','MÃ SẢN PHẨM':'LX','HẠNG MỤC':'lavabo','MÀU SẮC':'Trắng','KIỂU LẮP ĐẶT':'Đặt bàn','KÍCH THƯỚC':'500','CÔNG SUẤT (W)':'12'}}]);
  ok(c.inserted===1 && db[0].nganh==='vs' && !db[0].cong_suat_w,'tự nhận vs + bỏ cột đèn '+JSON.stringify(db[0]));
  c=await st.importCommit(null,[{ten:'Đèn A',_raw:{'TÊN SẢN PHẨM':'Đèn A','MÃ SẢN PHẨM':'DA','HẠNG MỤC':'Đèn nội thất','CÔNG SUẤT (W)':'12'}}]);
  ok(db[1].nganh!=='vs' && db[1].cong_suat_w==='12','đèn giữ nguyên '+JSON.stringify(db[1]));

  console.log('4. Lỗi bắt buộc / hạng mục sai / 2 dòng cùng tên');
  c=await st.importCommit(null,[{ten:'S',_nganh:'vs',_raw:{'TÊN SẢN PHẨM':'S','HẠNG MỤC':'Sen tắm'}},{ten:'M',_nganh:'vs',_raw:{'TÊN SẢN PHẨM':'M','HẠNG MỤC':'Máy giặt'}}]);
  ok(c.errors&&c.errors.length===2&&c.errors[0].i===0&&c.errors[1].i===1,'2 lỗi kèm chỉ số '+JSON.stringify(c));
  // 2 biến thể cùng tên: chỉ dòng lỗi mang chỉ số của nó
  db=[]; c=await st.importCommit(null,[{ten:'X',_nganh:'vs',_raw:{'TÊN SẢN PHẨM':'X','MÃ SẢN PHẨM':'X','HẠNG MỤC':'Lavabo','MÀU SẮC':'Trắng','KIỂU LẮP ĐẶT':'Đặt bàn','KÍCH THƯỚC':'1'}},{ten:'X',_nganh:'vs',_raw:{'TÊN SẢN PHẨM':'X','MÃ SẢN PHẨM':'X','HẠNG MỤC':'Lavabo','MÀU SẮC':'Đen'}}]);
  ok(c.inserted===1&&c.errors.length===1&&c.errors[0].i===1,'lỗi đúng dòng biến thể '+JSON.stringify(c));

  console.log('5. prodToObj');
  db=[{id:9,ma_sp:'B',ten_sp:'Bồn',nganh:null,hang_muc:'Bồn cầu',mau_sac:'Trắng',kich_thuoc:'L1',so_ho:'x'}];
  const ps=await st.getProducts(); const p=ps[0];
  ok(p.nganh==='vs'&&p.muc==='Thiết bị vệ sinh','nganh fallback'); ok(!/Số hố/.test(p.moTa+p.kichThuoc),'không in thông số hạng mục khác');
  ok(p.raw && 'kieu_lap_dat' in p.raw,'raw có cột mới');

  console.log('6. saveDbProduct / biến thể');
  db=[]; await st.saveDbProduct(null,{'TÊN SẢN PHẨM':'B','MÃ SẢN PHẨM':'B1','HẠNG MỤC':'Bồn cầu','MÀU SẮC':'Trắng','KÍCH THƯỚC':'A'});
  await st.saveDbProduct(null,{'TÊN SẢN PHẨM':'B','MÃ SẢN PHẨM':'B1','HẠNG MỤC':'Bồn cầu','MÀU SẮC':'Đen','KÍCH THƯỚC':'A'});
  const u=await st.saveDbProduct(null,{'TÊN SẢN PHẨM':'B2','MÃ SẢN PHẨM':'B1','HẠNG MỤC':'Bồn cầu','MÀU SẮC':'Trắng','KÍCH THƯỚC':'A'});
  ok(db.length===2 && u.updated && db.every(x=>x.nganh==='vs'),'biến thể theo màu, cập nhật khi trùng '+db.length);

  console.log('7. Sơn nước (public/son-spec.js)');
  const SON=require(R('public/son-spec.js')), tplS=require(R('server/son-template'));
  const cS=Object.values(SON.METRIC).map(m=>m[0]); ok(new Set(cS).size===cS.length,'trùng cột DB trong METRIC sơn');
  for(const hm of SON.HANG_MUC){ const h=SON.HM[hm];
    [...h.chinh,...h.tk,...h.req,...Object.keys(h.opt)].forEach(lb=>ok(SON.METRIC[lb],hm+': nhãn lạ '+lb));
    h.req.forEach(lb=>ok(h.chinh.concat(h.tk).includes(lb),hm+': req không nằm trong chinh/tk '+lb));
    const thieu=h.req.filter(lb=>!h.mau[lb]); ok(!thieu.length, hm+': dòng mẫu thiếu bắt buộc '+thieu); }
  ok(SON.chuanHM('son ngoai that')==='Sơn ngoại thất' && SON.chuanHM('Bồn cầu')==='','chuanHM sơn');
  // nhãn trùng vs-spec phải trỏ CÙNG một cột DB (nhãn là khoá duy nhất toàn hệ thống)
  Object.keys(SON.METRIC).forEach(lb=>{ if(VS.METRIC[lb]) ok(VS.METRIC[lb][0]===SON.METRIC[lb][0],'nhãn "'+lb+'" trỏ 2 cột khác nhau'); });
  const sqlS=require('fs').readFileSync(R('db/son_nuoc.sql'),'utf8')+require('fs').readFileSync(R('db/thiet_bi_ve_sinh_v2.sql'),'utf8')
    +require('fs').readFileSync(R('db/thiet_bi_ve_sinh.sql'),'utf8')+require('fs').readFileSync(R('db/schema.sql'),'utf8');
  cS.forEach(c=>ok(new RegExp('\\b'+c+'\\b').test(sqlS),'cột sơn '+c+' không có trong migration'));
  // file mẫu -> đọc lại: dòng ví dụ tự bỏ qua
  const bufS=Buffer.from(await tplS.buildSonTemplate());
  let rS=await store.importParse(bufS.toString('base64'),'xlsx','son'); ok(rS.count===0,'dòng ví dụ sơn phải tự bỏ qua, thực tế '+rS.count);
  ok(rS.mapped.ten==='TÊN SẢN PHẨM' && rS.mapped.gia==='GIÁ BÁN LẺ','map cột cơ bản sơn '+JSON.stringify(rS.mapped));
  // nhập thật: đóng dấu ngành son, bỏ cột của ngành khác, chặn thiếu bắt buộc
  db=[]; let cS2=await st.importCommit(null,[
    {ten:'Sơn NT',_nganh:'son',_raw:{'TÊN SẢN PHẨM':'Sơn NT','MÃ SẢN PHẨM':'WS1','HẠNG MỤC':'sơn ngoại thất','MÀU SẮC':'Màu trắng','ĐỘ PHỦ':'13 m²/lít','KÍCH THƯỚC':'18L','CÔNG SUẤT (W)':'12','HỆ THỐNG XẢ':'Tornado'}},
    {ten:'Thiếu',_nganh:'son',_raw:{'TÊN SẢN PHẨM':'Thiếu','MÃ SẢN PHẨM':'SL1','HẠNG MỤC':'Sơn lót'}}]);
  ok(cS2.inserted===1 && cS2.errors && cS2.errors.length===1 && cS2.errors[0].i===1,'commit sơn '+JSON.stringify(cS2));
  ok(db[0].nganh==='son' && db[0].hang_muc==='Sơn ngoại thất','đóng dấu ngành + chuẩn hoá hạng mục '+JSON.stringify(db[0]));
  ok(!db[0].cong_suat_w && !db[0].he_thong_xa,'bỏ cột của ngành khác');
  // quên chọn ngành -> tự nhận theo hạng mục sơn
  db=[]; await st.importCommit(null,[{ten:'Sơn lót A',_raw:{'TÊN SẢN PHẨM':'Sơn lót A','MÃ SẢN PHẨM':'SLA','HẠNG MỤC':'sơn lót','MÀU SẮC':'Trắng','ĐỘ PHỦ':'12','KÍCH THƯỚC':'18L'}}]);
  ok(db.length===1 && db[0].nganh==='son','tự nhận ngành sơn theo hạng mục '+JSON.stringify(db[0]));
  // prodToObj: về đề mục Sơn nước, chỉ in thông số của hạng mục
  db=[{id:7,ma_sp:'S',ten_sp:'Sơn',nganh:null,hang_muc:'Sơn ngoại thất',mau_sac:'Màu trắng',do_phu:'13 m²/lít',kich_thuoc:'18L',do_ph:'9'}];
  const pS=(await st.getProducts())[0];
  ok(pS.nganh==='son' && pS.muc==='Sơn nước','prodToObj sơn '+pS.nganh+'/'+pS.muc);
  ok(/Độ phủ: 13/.test(pS.moTa) && /Độ pH: 9/.test(pS.kichThuoc),'ghép cột hiển thị sơn '+pS.moTa+' | '+pS.kichThuoc);

  console.log('\nKẾT QUẢ: '+pass+' đạt, '+fail+' lỗi'); if(fail) process.exitCode=1;
})().catch(e=>{console.error('CRASH',e);process.exit(1);});
