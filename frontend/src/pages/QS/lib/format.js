/* Định dạng / đọc số - port nguyên văn từ bản QS gốc (public/*.js). Không React, không fetch.
   Nguồn: money app.js:63 · esc 70 · safeUrl_ 69 · fmtDate 72-80 · pad2 1326 · tkNum_ 2622-2628 · pctIn_ 2770
   ptN/ptR0/ptR2/ptQty phantho.js:290-293 · ptR4_ 420 · ptMoneyN_ 1986 · spNorm_ sanpham.js:958 · qbNorm_ boc.js:343 */

export function money(n){ return (Math.round(Number(n)||0)).toLocaleString('vi-VN'); }
export function esc(s){ return String(s==null?'':s).replace(/[&<>"]/g,function(m){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[m];}); }
// URL đưa vào href: http(s), đường dẫn nội bộ/tương đối, ảnh data/blob - chặn javascript:
export function safeUrl_(u){ u=String(u==null?'':u).trim(); return /^(https?:|\/|data:image\/|blob:)/i.test(u)||(u&&!/^[a-z][a-z0-9+.-]*:/i.test(u))?u:'#'; }
// Ngày tạo -> dd/mm/yyyy (không lệch ngày do múi giờ)
export function fmtDate(v){
  if(!v) return '—';
  var s=String(v).trim();
  if(/^\d{4}-\d{2}-\d{2}T/.test(s)){ var d=new Date(s); if(!isNaN(d)) return ('0'+d.getDate()).slice(-2)+'/'+('0'+(d.getMonth()+1)).slice(-2)+'/'+d.getFullYear(); }
  var m=s.match(/^(\d{4})-(\d{2})-(\d{2})/); if(m) return m[3]+'/'+m[2]+'/'+m[1];
  m=s.match(/^(\d{2})\/(\d{2})\/(\d{4})/); if(m) return s.slice(0,10);
  var d2=new Date(s); if(!isNaN(d2.getTime())) return ('0'+d2.getDate()).slice(-2)+'/'+('0'+(d2.getMonth()+1)).slice(-2)+'/'+d2.getFullYear();
  return s;
}
export function pad2(n){ return (n<10?'0':'')+n; }

/* Đọc số kiểu VN / kiểu Anh: 1.234.567 · 1,234,567 · 1.234,5 · 12,5 */
export function tkNum_(v){ var t=String(v==null?'':v).replace(/[^\d,.\-]/g,'');
  if((t.match(/,/g)||[]).length>1&&t.indexOf('.')<0) t=t.replace(/,/g,'');                 // 1,234,567 (kiểu Anh)
  else if(/,\d{1,3}$/.test(t)&&t.indexOf('.')>=0) t=t.replace(/\./g,'').replace(',','.');    // 1.234,5 · 1.234,567
  else if((t.match(/\./g)||[]).length>1) t=t.replace(/\./g,'');                          // 1.234.000
  else if(/\.\d{3}$/.test(t)) t=t.replace(/\./g,'');
  t=t.replace(',','.');
  var n=parseFloat(t); return isNaN(n)?0:n; }
// Ô nhập %: trống / không phải số -> null
export function pctIn_(v){ var t=String(v==null?'':v).trim().replace(',','.'); if(t==='') return null; var n=Number(t); return isFinite(n)?n:null; }

export function ptN(v){ return typeof v==='number' ? v : tkNum_(v); }
export function ptR0(x){ return Math.round(x||0); }
export function ptR2(x){ return Math.round((x||0)*100)/100; }
export function ptR4_(x){ return Math.round((x||0)*10000)/10000; }
export function ptQty(x){ x=Number(x)||0; return x.toLocaleString('vi-VN',{maximumFractionDigits:2}); }
// Ô tiền "10.000.000" -> số nguyên
export function ptMoneyN_(v){ if(typeof v==='number') return v; var x=parseInt(String(v==null?'':v).replace(/[^\d-]/g,''),10); return isNaN(x)?0:x; }

// chuẩn hoá tên (gộp trùng hoa/thường + khoảng trắng)
export function spNorm_(s){ return String(s||'').trim().toLowerCase().replace(/\s+/g,' '); }
// bỏ dấu tiếng Việt để tìm nhanh
export function qbNorm_(s){ return String(s||'').normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/đ/g,'d').replace(/Đ/g,'D').toLowerCase(); }
