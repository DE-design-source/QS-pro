/* ═══ CHẾ ĐỘ BẢNG TÍNH (Jspreadsheet CE, MIT) — giao diện kiểu Google Sheets cho bảng Phần thô.
   Chỉ là LỚP HIỂN THỊ: đọc S.phanTho, tính bằng ptComputeAll(), ghi bằng ptEdit / ptEditSec_ đang có,
   nên mọi quy tắc tính & lưu giữ nguyên. Bảng cũ vẫn còn (nút "Bảng cũ") để dự phòng. ═══ */
'use strict';

function btOn_(k){ try{ return localStorage.getItem('qs_bt_'+k)!=='0'; }catch(e){ return true; } }
function btSet_(k,on){ try{ localStorage.setItem('qs_bt_'+k,on?'1':'0'); }catch(e){} }
function btSan_(){ return typeof jspreadsheet==='function'; }            // thư viện nạp được chưa
function ptSheetToggle_(){ btSet_('pt',!btOn_('pt')); renderPhanTho(); }

// Số hiển thị trong ô: 1.234.567 (kiểu VN, như cả app) · % một số lẻ · trống khi 0
function btMoney_(v){ v=Math.round(Number(v)||0); return v?money(v):''; }
function btPct_(v){ v=Number(v)||0; return v?(v.toFixed(1).replace('.',',')+'%'):''; }
function btQty_(v){ v=Number(v)||0; return v?ptQty(v):''; }

/* Dựng lưới cho bảng Phần thô: mỗi dòng mang meta {k:'sec'|'it', si, ii} để biết ô sửa thuộc đâu */
function ptSheetGrid_(cols, comp){
  var rows=[], meta=[];
  (S.phanTho||[]).forEach(function(sec,si){
    var st=comp.sections[si];
    var ln=st.tt-st.ttnt, dvtSet={};
    sec.items.forEach(function(it){ dvtSet[String(it.dvt||'').trim()]=1; });
    var mot=Object.keys(dvtSet).length<=1;
    var sumDG=sec.items.reduce(function(s,it){ return s+ptN(it.dg); },0);
    var dgntSet={}; sec.items.forEach(function(it){ dgntSet[ptN(it.dgnt)]=1; });
    var dk=Object.keys(dgntSet), secDgnt=(dk.length===1&&ptN(dk[0]))?ptN(dk[0]):0;
    var sv={ stt:PT_ROMAN[si], noidung:String(sec.t||''), khoiluong:(st.sumKL&&mot)?btQty_(st.sumKL):'',
      dgnt:btMoney_(secDgnt), ttnt:btMoney_(st.ttnt), lnvnd:btMoney_(ln),
      margin:st.tt?btPct_(ln/st.tt*100):'', markup:st.ttnt?btPct_(ln/st.ttnt*100):'',
      dg:sec.mode==='area'?btMoney_(sec.up):((sumDG&&mot)?btMoney_(sumDG):''), tt:btMoney_(st.tt) };
    rows.push(cols.map(function(c){ return sv[c[0]]==null?'':sv[c[0]]; })); meta.push({k:'sec', si:si});
    ptSortItems_(sec.items).filter(function(r){ return ptRowPass_(sec,r.it); }).forEach(function(r,pos){
      var it=r.it, isItem=sec.mode==='item', tt=it._tt, ttnt=it._ttnt, l=isItem?(tt-ttnt):0;
      var v={ stt:String(pos+1), noidung:String(it.n||''), dvt:String(it.dvt||''),
        dientich:it.dt==null||it.dt===''?'':btQty_(ptN(it.dt)), heso:it.hs==null||it.hs===''?'':String(it.hs).replace('.',','),
        khoiluong:btQty_(it._kl), dgnt:btMoney_(it.dgnt), ttnt:isItem?btMoney_(ttnt):'', lnvnd:isItem?btMoney_(l):'',
        margin:(isItem&&tt)?btPct_(l/tt*100):'', markup:(isItem&&ttnt)?btPct_(l/ttnt*100):'',
        dg:btMoney_(it.dg), tt:isItem?btMoney_(tt):'', ghichu:String(it.gc||'') };
      rows.push(cols.map(function(c){ return v[c[0]]==null?'':v[c[0]]; })); meta.push({k:'it', si:si, ii:r.oi});
    });
  });
  return {rows:rows, meta:meta};
}
// Ô này sửa được không (cùng quy tắc bảng cũ: ptCanEditF_ theo chế độ nhóm)
function ptSheetSua_(m,key){
  var sec=(S.phanTho||[])[m.si]; if(!sec) return null;
  if(m.k==='sec'){ if(key==='noidung') return 't'; if(key==='dg'&&sec.mode==='area') return 'up'; return null; }
  var f=PT_CELL_F[key]; if(!f) return null;
  if(f==='n') return f;
  if(f==='lnPct') return sec.mode==='item'?f:null;
  return ptCanEditF_(sec,f)?f:null;
}
function btColLetter_(i){ var s=''; i++; while(i>0){ var r=(i-1)%26; s=String.fromCharCode(65+r)+s; i=Math.floor((i-1)/26); } return s; }

function renderPTSheet_(host, cols, comp){
  var g=ptSheetGrid_(cols, comp);
  var st={}, ro=[];
  g.meta.forEach(function(m,y){
    cols.forEach(function(c,x){
      var ten=btColLetter_(x)+(y+1);
      if(m.k==='sec') st[ten]='background-color:#e8eaed;font-weight:700;';
      if(!ptSheetSua_(m,c[0])) ro.push(ten);
    });
  });
  host.innerHTML='';
  S._ptSheetMeta=g.meta; S._ptSheetCols=cols;
  var ws=jspreadsheet(host,{
    tabs:false, toolbar:false,
    worksheets:[{
      data:g.rows, style:st, wordWrap:true, tableOverflow:true, tableHeight:'calc(100vh - 290px)', tableWidth:'100%',
      freezeColumns:Math.min(2,cols.length), allowInsertRow:false, allowInsertColumn:false, allowDeleteRow:false,
      allowDeleteColumn:false, allowRenameColumn:false, columnSorting:false, filters:!!S._ptSheetLoc,
      nestedHeaders:[cols.map(function(c,i){ return {title:btColLetter_(i)}; })],
      columns:cols.map(function(c){ return {title:c[1], width:c[3]||100, type:'text',
        align:c[2]==='n'?'right':(c[2]==='c'?'center':'left'), wordWrap:c[0]==='noidung'||c[0]==='ghichu'}; })
    }],
    onchange:function(inst,cell,x,y,val,old){
      if(S._ptSheetBusy || String(val)===String(old)) return;
      ptSheetGhi_(+x,+y,val);
    },
    // Hoàn tác / làm lại: thư viện đổi ô nhưng không gọi onchange -> tự ghi giá trị cũ / mới vào dữ liệu
    onundo:function(inst,h){ ((h&&h.records)||[]).forEach(function(r){ ptSheetGhi_(r.x,r.y,r.oldValue); }); },
    onredo:function(inst,h){ ((h&&h.records)||[]).forEach(function(r){ ptSheetGhi_(r.x,r.y,r.value); }); },
    onselection:function(inst,x1,y1,x2,y2){ ptSheetSum_(inst,x1,y1,x2,y2); }
  })[0];
  S._ptSheet=ws;
  ro.forEach(function(ten){ try{ ws.setReadOnly(ten,true); }catch(e){} });
  return ws;
}
// Ghi 1 ô người dùng sửa vào S.phanTho (đúng hàm của bảng cũ), gom nhiều ô liền nhau -> tính + lưu + vẽ lại 1 lần
function ptSheetGhi_(x,y,val){
  var m=S._ptSheetMeta[y], col=S._ptSheetCols[x], f=m&&col&&ptSheetSua_(m,col[0]); if(!f) return;
  clearTimeout(S._ptSheetT);
  if(m.k==='sec' && f==='t'){                     // tên nhóm: ghi thẳng (ptEditSec_ vẽ lại cả bảng -> mất ô chọn + lịch sử)
    var v=String(val==null?'':val).trim(); if(!v){ toast('Tên hạng mục không được để trống'); ptSheetRefresh_(); return; }
    S.phanTho[m.si].t=v; }
  else if(m.k==='sec') ptEdit(m.si,-1,f,val,true);
  else ptEdit(m.si,m.ii,f,val,true);
  S._ptSheetT=setTimeout(function(){ ptPersist(); ptSheetRefresh_(); },60);
}
// Sau khi sửa: tính lại, ghi giá trị mới vào lưới (không dựng lại -> giữ ô đang chọn, vị trí cuộn)
function ptSheetRefresh_(){
  var ws=S._ptSheet; if(!ws || !document.body.contains(ws.element)){ renderPhanTho(); return; }
  var comp=ptComputeAll(), g=ptSheetGrid_(S._ptSheetCols, comp);
  if(g.rows.length!==S._ptSheetMeta.length){ renderPhanTho(); return; }     // thêm/bớt dòng -> vẽ lại cả bảng
  // ghi ô tự tính KHÔNG vào lịch sử: Ctrl+Z chỉ lùi thao tác của người dùng (lùi ô gõ -> onchange -> tính lại)
  S._ptSheetBusy=true; var ih=ws.ignoreHistory; ws.ignoreHistory=true;
  try{ g.rows.forEach(function(r,y){ r.forEach(function(v,x){
    if(String(ws.getValueFromCoords(x,y))!==String(v)) ws.setValueFromCoords(x,y,v,true); }); }); }
  finally{ S._ptSheetBusy=false; ws.ignoreHistory=ih; }
  S._ptSheetMeta=g.meta; ptTotalsBar_(comp);
}
// Σ vùng đang chọn — như thanh trạng thái Google Sheets
function ptSheetSum_(inst,x1,y1,x2,y2){
  var el=document.getElementById('ptSheetSum'); if(!el) return;
  var s=0, n=0, so=0;
  for(var y=Math.min(y1,y2); y<=Math.max(y1,y2); y++) for(var x=Math.min(x1,x2); x<=Math.max(x1,x2); x++){
    var v=String(inst.getValueFromCoords(x,y)||'').trim(); if(!v) continue; n++;
    if(/^-?[\d.,]+%?$/.test(v)){ s+=tkNum_(v); so++; } }
  el.innerHTML = n<2 ? '' : ('<span>Đếm <b>'+n+'</b></span>'+(so?('<span>Tổng <b>'+money(s)+'</b></span><span>TB <b>'+money(s/so)+'</b></span>'):''));
}
// Thanh công cụ của chế độ bảng tính: hoàn tác · làm lại · phóng to · lọc · in · Excel · về bảng cũ
function ptSheetToolbar_(){
  var z=S._ptZoom||100;
  function b(ic,t,fn,ex){ return '<button class="bt-b'+(ex||'')+'" title="'+t+'" onclick="'+fn+'">'+ic+'</button>'; }
  return '<div class="bt-bar">'
    +b('↶','Hoàn tác (Ctrl+Z)','S._ptSheet&&S._ptSheet.undo()')+b('↷','Làm lại (Ctrl+Y)','S._ptSheet&&S._ptSheet.redo()')
    +'<span class="bt-sep"></span>'
    +b('−','Thu nhỏ','ptSheetZoom_(-10)')+'<span class="bt-z">'+z+'%</span>'+b('+','Phóng to','ptSheetZoom_(10)')
    +'<span class="bt-sep"></span>'
    +b(icon('filter',15),'Bật / tắt ô lọc cột','ptSheetFilter_()')
    +b(icon('download',15),'Xuất Excel','ptExportXlsx()')
    +'<span class="bt-sum" id="ptSheetSum"></span>'
    +'<span style="flex:1"></span>'
    +'<button class="btn ghost sm" onclick="ptSheetToggle_()" title="Quay lại bảng cũ">Bảng cũ</button>'
  +'</div>';
}
function ptSheetZoom_(d){ S._ptZoom=Math.max(50,Math.min(200,(S._ptZoom||100)+d)); var h=document.getElementById('ptSheet');
  if(h) h.style.zoom=(S._ptZoom/100); var z=document.querySelector('.bt-z'); if(z) z.textContent=S._ptZoom+'%'; }
// Bật/tắt hàng lọc dưới tiêu đề cột (dựng lại lưới; dữ liệu không đổi)
function ptSheetFilter_(){ S._ptSheetLoc=!S._ptSheetLoc; renderPhanTho(); if(S._ptSheetLoc) toast('Bấm vào ô dưới tên cột để lọc'); }
