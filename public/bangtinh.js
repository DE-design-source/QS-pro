/* ═══ CHẾ ĐỘ BẢNG TÍNH (Jspreadsheet CE, MIT) — giao diện kiểu Google Sheets cho bảng Phần thô ('pt')
   và bảng sản phẩm Bóc tách ('tk'). Chỉ là LỚP HIỂN THỊ: đọc dữ liệu đang có, ghi bằng đúng hàm sửa
   của bảng cũ (ptEdit / editLine / tkApplyEdits_), nên mọi quy tắc tính & lưu giữ nguyên.
   Bảng cũ vẫn còn (nút "Bảng cũ") để dự phòng. ═══ */
'use strict';

function btOn_(k){ try{ return localStorage.getItem('qs_bt_'+k)!=='0'; }catch(e){ return true; } }
function btSet_(k,on){ try{ localStorage.setItem('qs_bt_'+k,on?'1':'0'); }catch(e){} }
function btSan_(){ return typeof jspreadsheet==='function'; }            // thư viện nạp được chưa
function btVeLai_(k){ if(k==='pt') renderPhanTho(); else { btCtx_(k).ws=null; renderTable(); } }   // dựng lại hẳn lưới
function btToggle_(k){ btSet_(k,!btOn_(k)); btVeLai_(k); }
function ptSheetToggle_(){ btToggle_('pt'); }

// Số hiển thị trong ô: 1.234.567 (kiểu VN, như cả app) · % một số lẻ · trống khi 0
function btMoney_(v){ v=Math.round(Number(v)||0); return v?money(v):''; }
function btPct_(v){ v=Number(v)||0; return v?(v.toFixed(1).replace('.',',')+'%'):''; }
function btQty_(v){ v=Number(v)||0; return v?ptQty(v):''; }

/* Ngữ cảnh mỗi bảng: ws, cols, meta (dòng nào là nhóm / dòng dữ liệu), cột căn số, tuỳ chọn hiển thị */
function btCtx_(k){ S._bt=S._bt||{}; return S._bt[k]=S._bt[k]||{zoom:100, font:13, loc:false, frz:true}; }
function btSong_(k){ var B=btCtx_(k); return !!(B.ws && document.body.contains(B.ws.element)); }
// Dựng lưới chung: opt.columns + opt.data + opt.style + opt.frz (số cột cố định); ghi(x,y,val) ghi 1 ô vào dữ liệu
function btTao_(k, host, cols, meta, al, opt, ghi, ro, noiBo){
  var B=btCtx_(k); host.innerHTML='';
  B.cols=cols; B.meta=meta; B.al=al; B.ghi=ghi;
  var ws=jspreadsheet(host,{
    tabs:false, toolbar:false,
    worksheets:[{
      data:opt.data, style:opt.style, mergeCells:opt.merge||{}, wordWrap:true, tableOverflow:true, tableHeight:'calc(100vh - 290px)', tableWidth:'100%',
      freezeColumns:B.frz?Math.min(opt.frz,cols.length):0, allowInsertRow:false, allowInsertColumn:false, allowDeleteRow:false,
      allowDeleteColumn:false, allowRenameColumn:false, columnSorting:false, filters:!!B.loc,
      nestedHeaders:[cols.map(function(c,i){ return {title:btColLetter_(i)}; })],
      columns:opt.columns
    }],
    onchange:function(inst,cell,x,y,val,old){
      if(B.busy || String(val)===String(old)) return;
      ghi(+x,+y,val);
    },
    // Hoàn tác / làm lại: thư viện đổi ô nhưng không gọi onchange -> tự ghi giá trị cũ / mới vào dữ liệu
    onundo:function(inst,h){ ((h&&h.records)||[]).forEach(function(r){ ghi(r.x,r.y,r.oldValue); }); },
    onredo:function(inst,h){ ((h&&h.records)||[]).forEach(function(r){ ghi(r.x,r.y,r.value); }); },
    onselection:function(inst,x1,y1,x2,y2){ btSum_(k,inst,x1,y1,x2,y2); }
  })[0];
  B.ws=ws;
  ro.forEach(function(ten){ try{ ws.setReadOnly(ten,true); }catch(e){} });
  // cột nội bộ (giá vốn, lợi nhuận) tiêu đề xám đậm — tách khỏi cột báo khách (navy), như mẫu
  cols.forEach(function(c,x){ if(noiBo[c[0]] && ws.headers && ws.headers[x]) ws.headers[x].classList.add('gs-int'); });
  return ws;
}
// Ghi giá trị mới vào lưới (không dựng lại -> giữ ô đang chọn, vị trí cuộn). Ô tự tính KHÔNG vào lịch sử:
// Ctrl+Z chỉ lùi thao tác của người dùng (lùi ô gõ -> ghi lại -> tính lại)
function btGhiLuoi_(k, rows){
  var B=btCtx_(k), ws=B.ws; B.busy=true; var ih=ws.ignoreHistory; ws.ignoreHistory=true;
  try{ rows.forEach(function(r,y){ r.forEach(function(v,x){
    if(String(ws.getValueFromCoords(x,y))!==String(v)) ws.setValueFromCoords(x,y,v,true); }); }); }
  finally{ B.busy=false; ws.ignoreHistory=ih; }
}

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
var PT_NOI_BO={dgnt:1, ttnt:1, lnvnd:1, margin:1, markup:1};
function btColLetter_(i){ var s=''; i++; while(i>0){ var r=(i-1)%26; s=String.fromCharCode(65+r)+s; i=Math.floor((i-1)/26); } return s; }

function renderPTSheet_(host, cols, comp){
  var g=ptSheetGrid_(cols, comp);
  var st={}, ro=[];
  g.meta.forEach(function(m,y){
    cols.forEach(function(c,x){
      var ten=btColLetter_(x)+(y+1);
      if(m.k==='sec') st[ten]='background-color:#e8eaed;font-weight:700;';
      else if(c[0]==='dvt'||c[0]==='ghichu') st[ten]='font-style:italic;';      // như mẫu: ĐVT, Ghi chú in nghiêng
      if(!ptSheetSua_(m,c[0])) ro.push(ten);
    });
  });
  var ws=btTao_('pt', host, cols, g.meta, cols.map(function(c){ return c[2]==='n'?'n':(c[2]==='c'?'c':''); }), {
    data:g.rows, style:st,
    frz:2, columns:cols.map(function(c){ return {title:c[1], width:c[3]||100, type:'text',
      align:c[2]==='n'?'right':(c[2]==='c'?'center':'left'), wordWrap:c[0]==='noidung'||c[0]==='ghichu'}; })
  }, ptSheetGhi_, ro, PT_NOI_BO);
  return ws;
}
// Ghi 1 ô người dùng sửa vào S.phanTho (đúng hàm của bảng cũ), gom nhiều ô liền nhau -> tính + lưu + vẽ lại 1 lần
function ptSheetGhi_(x,y,val){
  var B=S._bt.pt, m=B.meta[y], col=B.cols[x], f=m&&col&&ptSheetSua_(m,col[0]); if(!f) return;
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
  var B=btCtx_('pt'); if(!btSong_('pt')){ renderPhanTho(); return; }
  var comp=ptComputeAll(), g=ptSheetGrid_(B.cols, comp);
  if(g.rows.length!==B.meta.length){ renderPhanTho(); return; }     // thêm/bớt dòng -> vẽ lại cả bảng
  btGhiLuoi_('pt', g.rows); B.meta=g.meta; ptTotalsBar_(comp);
}

/* ═══ BẢNG SẢN PHẨM BÓC TÁCH ('tk') ═══
   Dòng nhóm = tầng/phòng (I. TẦNG 1 … tổng tầng ở cột Thành tiền), dòng dữ liệu = 1 dòng S.lines. */
var TK_NOI_BO={giaNCC:1, chietKhau:1, giaDaiLy:1, lnPct:1, markup:1, margin:1, lnVnd:1};
var TK_SO={soLuong:1, giaNCC:1, giaDaiLy:1, donGia:1, donGiaCK:1, lnVnd:1, thanhTien:1, chietKhau:1, lnPct:1, ckKhach:1, markup:1, margin:1};
var TK_GIUA={stt:1, hinhAnh:1, dvt:1, taiLieu:1, nganh:1};
function tkSheetSua_(k){ return !TK_RO_COL[k] && k!=='taiLieu' && !!(k==='moTa'||k==='kichThuoc'||TXT_COL[k]||NUM_COL[k]||k==='markup'||k==='margin'||k==='lnVnd'); }
function btSl_(v){ v=Number(v)||0; return v.toLocaleString('vi-VN',{maximumFractionDigits:3}); }
function tkSheetO_(l,k,stt){
  switch(k){
    case 'stt': return stt;
    case 'nganh': return String((l.extra&&l.extra.nganh)||'');
    case 'hinhAnh': return l.hinhAnh?'<img class="gs-img" src="'+esc(imgSrc1_(l.hinhAnh))+'" onclick="imgPop_(this.src)" onerror="this.style.visibility=\'hidden\'">':'';
    case 'taiLieu': { var n=lineDocs_(l).length; return n?('<button class="tl-badge" onclick="event.stopPropagation();tlPop_(event,\''+escJs_(l.lineId)+'\')">'+icon('doc',13)+' '+n+'</button>'):''; }
    case 'soLuong': return btSl_(l.soLuong);
    case 'giaNCC': return btMoney_(l.donGiaVon);
    case 'donGia': return btMoney_(l.donGiaBan);
    case 'giaDaiLy': return btMoney_(giaDaiLy_(l));
    case 'donGiaCK': return btMoney_(donGiaCK_(l));
    case 'thanhTien': return btMoney_(l.thanhTienBan);
    case 'lnVnd': return btMoney_((donGiaCK_(l)-giaDaiLy_(l))*(Number(l.soLuong)||0));
    case 'chietKhau': case 'lnPct': case 'ckKhach': return (Number(l[k])||0)+'%';
    case 'markup': { var dl=giaDaiLy_(l),dg=donGiaCK_(l); return dl>0?Math.round((dg-dl)/dl*100)+'%':''; }
    case 'margin': { var dl2=giaDaiLy_(l),dg2=donGiaCK_(l); return dg2>0?Math.round((dg2-dl2)/dg2*100)+'%':''; }
  }
  var f=TXT_COL[k]||k; return String(l[f]==null?'':l[f]);
}
function tkSheetGrid_(cols, order, groups){
  var rows=[], meta=[], iTT=-1;
  cols.forEach(function(c,i){ if(c[0]==='thanhTien') iTT=i; });
  order.forEach(function(g,gi){
    var list=groups[g]||[], r=cols.map(function(){ return ''; });
    r[0]=PT_ROMAN[gi]||String(gi+1); if(cols.length>1) r[1]=g;
    if(iTT>1) r[iTT]=btMoney_(list.reduce(function(s,l){ return s+(Number(l.thanhTienBan)||0); },0));
    rows.push(r); meta.push({k:'sec', g:g});
    sortLines_(list).forEach(function(l,ri){
      rows.push(cols.map(function(c){ return tkSheetO_(l,c[0],(gi+1)+'.'+(ri+1)); })); meta.push({k:'it', id:l.lineId});
    });
  });
  return {rows:rows, meta:meta, iTT:iTT};
}
// Gọi từ renderTable(): cùng cột + cùng dòng -> chỉ ghi số mới (giữ ô chọn, cuộn, Ctrl+Z); khác -> dựng lại
function tkSheetVe_(host, cols, order, groups){
  var B=btCtx_('tk'), g=tkSheetGrid_(cols, order, groups);
  var sig=cols.map(function(c){ return c[0]; }).join()+'|'+g.meta.map(function(m){ return m.k==='sec'?('#'+m.g):m.id; }).join();
  if(btSong_('tk') && B.sig===sig && host.contains(B.ws.element)){ btGhiLuoi_('tk', g.rows); return; }
  B.sig=sig;
  var st={}, ro=[], merge={}, het=g.iTT>1?g.iTT:cols.length;
  g.meta.forEach(function(m,y){
    if(m.k==='sec' && het>2) merge[btColLetter_(1)+(y+1)]=[het-1,1];   // tên tầng trải ngang tới trước cột Thành tiền
    cols.forEach(function(c,x){
      var ten=btColLetter_(x)+(y+1);
      if(m.k==='sec') st[ten]='background-color:#e8eaed;font-weight:700;';
      else if(c[0]==='dvt'||c[0]==='ghiChu') st[ten]='font-style:italic;';
      if(m.k==='sec' || !tkSheetSua_(c[0])) ro.push(ten);
    });
  });
  var iTen=-1; cols.forEach(function(c,i){ if(c[0]==='ten') iTen=i; });
  btTao_('tk', host, cols, g.meta, cols.map(function(c){ return TK_SO[c[0]]?'n':(TK_GIUA[c[0]]?'c':''); }), {
    data:g.rows, style:st, merge:merge, frz:(iTen>=0&&iTen<4)?iTen+1:2,
    columns:cols.map(function(c){ var k=c[0];
      return {title:c[1], width:Math.max(colW(k),TK_MINW_[k]||60), type:(k==='hinhAnh'||k==='taiLieu')?'html':'text',
        align:TK_SO[k]?'right':(TK_GIUA[k]?'center':'left'), wordWrap:k==='moTa'||k==='kichThuoc'||k==='ten'||k==='ghiChu'}; })
  }, tkSheetGhi_, ro, TK_NOI_BO);
}
// Xoá các dòng sản phẩm nằm trong vùng đang chọn (dùng đúng luồng xoá hàng loạt của bảng cũ, có hỏi lại)
function tkSheetDel_(){
  var B=btCtx_('tk'), r=B.selR; if(!r){ toast('Chọn ô ở các dòng cần xoá trước'); return; }
  S._tkSel={}; for(var y=r[0]; y<=r[1]; y++){ var m=B.meta[y]; if(m&&m.k==='it') S._tkSel[m.id]=1; }
  if(!Object.keys(S._tkSel).length){ toast('Vùng chọn không có dòng sản phẩm'); return; }
  tkBulkDel_();
}
// Ô người dùng sửa -> đúng quy tắc bảng cũ (tkFieldsFor_). Dán nhiều ô: gom lại, ghi 1 lô (tkApplyEdits_)
function tkSheetGhi_(x,y,val){
  var B=btCtx_('tk'), m=B.meta[y], c=B.cols[x]; if(!m||m.k!=='it'||!c) return;
  var l=lineOf_(m.id), f=l&&tkFieldsFor_(l,c[0],val);
  B.q=B.q||[]; if(f) B.q.push({id:m.id, fields:f});
  clearTimeout(B.t);
  B.t=setTimeout(function(){
    var q=B.q; B.q=[];
    if(!q.length){ renderTable(); return; }               // ô không nhận giá trị này -> trả số cũ
    if(q.length===1) editLine(q[0].id,q[0].fields); else tkApplyEdits_(q,'Đã sửa');
  },0);
}

// Khung kiểu GOOGLE SHEETS (theo mẫu): 1 hàng công cụ gọn · lưới. Chỉ đặt nút CHẠY THẬT.
var BT_SVG={
  undo:'<path d="M9 14 4 9l5-5"/><path d="M4 9h11a5 5 0 0 1 0 10h-3"/>',
  redo:'<path d="m15 14 5-5-5-5"/><path d="M20 9H9a5 5 0 0 0 0 10h3"/>',
  print:'<path d="M6 9V3h12v6"/><rect x="4" y="9" width="16" height="8" rx="1"/><path d="M7 14h10v7H7z"/>',
  filter:'<path d="M3 4h18l-7 8.5V19l-4 2v-8.5z"/>',
  freeze:'<rect x="3" y="3" width="18" height="18" rx="1"/><path d="M9 3v18M3 9h18"/>',
  sum:'<path d="M18 4H6l6 8-6 8h12"/>'
};
function btI_(k){ return '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">'+BT_SVG[k]+'</svg>'; }
function btFrame_(k){
  var B=btCtx_(k), z=B.zoom, fs=B.font;
  function b(html,tip,fn,on){ return '<button class="gs-b'+(on?' on':'')+'" title="'+tip+'" onclick="'+fn+'">'+html+'</button>'; }
  var sep='<span class="gs-sep"></span>', w='S._bt.'+k+'.ws';
  return '<div class="gs">'
    +'<div class="gs-bar">'
      +b(icon('search',17),'Tìm trong bảng','btFind_(\''+k+'\')')
      +b(btI_('undo'),'Hoàn tác (Ctrl+Z)',w+'&&'+w+'.undo()')+b(btI_('redo'),'Làm lại (Ctrl+Y)',w+'&&'+w+'.redo()')
      +b(btI_('print'),'In bảng','btPrint_(\''+k+'\')')
      +'<select class="gs-zoom" title="Thu phóng" onchange="btZoom_(\''+k+'\',this.value)">'
        +[50,75,90,100,125,150,200].map(function(v){ return '<option value="'+v+'"'+(v===z?' selected':'')+'>'+v+'%</option>'; }).join('')+'</select>'
      +sep+'<span class="gs-font">Montserrat</span>'+sep
      +b('−','Giảm cỡ chữ','btFont_(\''+k+'\',-1)')+'<span class="gs-fs">'+fs+'</span>'+b('+','Tăng cỡ chữ','btFont_(\''+k+'\',1)')
      +sep+b(btI_('filter'),'Bật / tắt ô lọc cột','btFilter_(\''+k+'\')',B.loc)
      +b(btI_('freeze'),'Cố định cột đầu khi cuộn ngang','btFreeze_(\''+k+'\')',B.frz)
      +b(icon('download',17),'Xuất Excel',k==='pt'?'ptExportXlsx()':'btXlsx_(\''+k+'\')')
      +(k==='tk'?b(icon('trash',17),'Xoá các dòng đang chọn','tkSheetDel_()'):'')
      +sep+'<span class="gs-sumic" title="Chọn nhiều ô để xem tổng">'+btI_('sum')+'</span><span class="gs-sum" id="'+k+'SheetSum"></span>'
      +'<span style="flex:1"></span>'
      +'<button class="btn ghost sm" onclick="btToggle_(\''+k+'\')" title="Quay lại bảng cũ">Bảng cũ</button>'
    +'</div>'
    +'<div id="'+k+'Sheet" class="gs-grid" style="--gsfs:'+fs+'px'+(z!==100?';zoom:'+(z/100):'')+'"></div>'
  +'</div>';
}
function ptSheetFrame_(){ return btFrame_('pt'); }
// Chọn vùng ô: Σ Tổng · TB · Đếm ngay trên hàng công cụ
function btSum_(k,inst,x1,y1,x2,y2){
  var B=btCtx_(k); B.sel=[Math.min(x1,x2),Math.min(y1,y2)]; B.selR=[Math.min(y1,y2),Math.max(y1,y2)];
  var el=document.getElementById(k+'SheetSum'); if(!el) return;
  var s=0, n=0, so=0;
  for(var y=Math.min(y1,y2); y<=Math.max(y1,y2); y++) for(var x=Math.min(x1,x2); x<=Math.max(x1,x2); x++){
    var v=String(inst.getValueFromCoords(x,y)||'').trim(); if(!v) continue; n++;
    if(/^-?[\d.,]+%?$/.test(v)){ s+=tkNum_(v); so++; } }
  function f(v){ return v.toLocaleString('vi-VN',{maximumFractionDigits:2}); }   // giữ số lẻ (khối lượng 3,5)
  el.innerHTML = n<2 ? '' : ((so?('<span>Tổng: <b>'+f(s)+'</b></span><span>TB: <b>'+f(s/so)+'</b></span>'):'')+'<span>Đếm: <b>'+n+'</b></span>');
}
function btFreeze_(k){ var B=btCtx_(k); B.frz=!B.frz; btVeLai_(k); }
function btZoom_(k,v){ var B=btCtx_(k); B.zoom=Number(v)||100;
  var h=document.getElementById(k+'Sheet'); if(h) h.style.zoom=(B.zoom/100); }
function btFont_(k,d){ var B=btCtx_(k); B.font=Math.max(10,Math.min(20,B.font+d));
  var h=document.getElementById(k+'Sheet'); if(!h) return; h.style.setProperty('--gsfs',B.font+'px');
  var f=h.parentNode.querySelector('.gs-fs'); if(f) f.textContent=B.font; }
// Tìm: ô kế tiếp (sau ô đang chọn) có chứa chữ cần tìm -> chọn + cuộn tới
async function btFind_(k){
  var B=btCtx_(k), ws=B.ws; if(!ws) return;
  var q=await askInput_({ title:'Tìm trong bảng', label:'Chữ cần tìm', value:B.findQ||'', ok:'Tìm' }); if(q==null) return;
  q=String(q).trim(); B.findQ=q; if(!q) return;
  var d=ws.getData(), nx=(d[0]||[]).length, cur=B.sel?(B.sel[1]*nx+B.sel[0]):-1, kq=spNorm_(q);
  for(var i=1;i<=d.length*nx;i++){ var p=(cur+i)%(d.length*nx), y=Math.floor(p/nx), x=p%nx;
    if(spNorm_(btChu_(d[y][x])).indexOf(kq)>=0){ ws.updateSelectionFromCoords(x,y,x,y);
      var c=ws.getCellFromCoords(x,y); if(c&&c.scrollIntoView) c.scrollIntoView({block:'center',inline:'nearest'}); return; } }
  toast('Không thấy "'+q+'" trong bảng');
}
function btChu_(v){ v=String(v==null?'':v); return v.indexOf('<')>=0?v.replace(/<[^>]*>/g,'').trim():v; }   // ô html (ảnh, tài liệu) -> chữ
function btTen_(k){ return k==='pt'?'Phần thô':(nodeName(S.node)||'Bóc tách'); }
// In: dựng bảng HTML gọn từ đúng dữ liệu đang hiện (tên cột + nhóm + dòng); ảnh in ra ảnh
function btPrint_(k){
  var B=btCtx_(k), ws=B.ws; if(!ws) return;
  var d=ws.getData();
  var th='<tr>'+B.cols.map(function(c){ return '<th>'+esc(c[1])+'</th>'; }).join('')+'</tr>';
  var tb=d.map(function(r,y){ return '<tr'+(B.meta[y]&&B.meta[y].k==='sec'?' class="s"':'')+'>'+r.map(function(v,x){
      v=String(v==null?'':v);
      return '<td class="'+B.al[x]+'">'+(/^<img /.test(v)?v.replace(/ on\w+="[^"]*"/g,''):esc(btChu_(v)))+'</td>'; }).join('')+'</tr>'; }).join('');
  var w=window.open('','_blank'); if(!w){ toast('Cho phép popup để in'); return; }
  w.document.write('<!doctype html><title>'+esc(btTen_(k))+' — '+esc((S.cur&&S.cur.ten)||'')+'</title><style>@page{size:A4 landscape;margin:10mm}'
    +'body{font:11px Montserrat,Arial,sans-serif}table{border-collapse:collapse;width:100%}th{background:#1f3a5f;color:#fff;font-size:10px;padding:6px 4px;border:1px solid #2d4a6e}'
    +'td{padding:4px;border:1px solid #dadce0;vertical-align:top}td.n{text-align:right}td.c{text-align:center}tr.s td{background:#e8eaed;font-weight:700}img{max-width:60px;max-height:60px}</style>'
    +'<h3>'+esc((S.cur&&S.cur.ten)||'')+' — '+esc(btTen_(k))+'</h3><table>'+th+tb+'</table>');
  w.document.close(); setTimeout(function(){ w.focus(); w.print(); },600);
}
// Xuất Excel đúng bảng đang thấy (bỏ cột ảnh / tài liệu): dòng nhóm gộp ô, ô số giữ kiểu số
async function btXlsx_(k){
  var B=btCtx_(k), ws=B.ws; if(!ws||!S.cur) return;
  var giu=[]; B.cols.forEach(function(c,x){ if(c[0]!=='hinhAnh'&&c[0]!=='taiLieu') giu.push(x); });
  var d=ws.getData(), rows=d.map(function(r,y){
    if(B.meta[y].k==='sec') return {group:r[0]+'. '+btChu_(r[1])};
    return {cells:giu.map(function(x){ var v=btChu_(r[x]); return (B.al[x]==='n'&&v)?tkNum_(v):v; })}; });
  try{ await taiFile_('/export/bang',{ ten:'BÓC TÁCH — '+btTen_(k)+' — '+(S.cur.ten||S.cur.maDA), sheet:'Boc tach',
      cols:giu.map(function(x){ return {label:B.cols[x][1], num:B.al[x]==='n'}; }), rows:rows },
      'boc-tach-'+S.cur.maDA+'.xlsx'); }
  catch(e){ toast('Lỗi xuất Excel: '+e.message); }
}
// Bật/tắt hàng lọc dưới tiêu đề cột (dựng lại lưới; dữ liệu không đổi)
function btFilter_(k){ var B=btCtx_(k); B.loc=!B.loc; btVeLai_(k); if(B.loc) toast('Bấm vào ô dưới tên cột để lọc'); }
