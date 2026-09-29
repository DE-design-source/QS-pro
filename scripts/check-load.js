// Kiểm tra THỨ TỰ NẠP các file giao diện (public/*.js theo thẻ <script> trong index.html):
// chạy từng file với DOM giả, code chạy ngay lúc nạp mà gọi tới hàm/biến của file nạp SAU -> báo lỗi.
// Cần khi tách app.js thành nhiều file theo tab.   Chạy: npm test
'use strict';
const fs = require('fs'), vm = require('vm'), path = require('path');
const PUB = path.join(__dirname, '..', 'public');
// Cắt file thành các khối top-level; biên mỗi khối kiểm bằng trình dịch JS.
const AF=Object.getPrototypeOf(async function(){}).constructor;
function segment(src){
  const L=src.split('\n'), items=[]; let i=0;
  const ok=t=>{ try{ new AF(t); return true; }catch(e){ return false; } };
  while(i<L.length){
    const l=L[i];
    if(/^\s*$/.test(l)){ items.push({s:i,e:i+1,kind:'blank'}); i++; continue; }
    if(/^\/\//.test(l)){ items.push({s:i,e:i+1,kind:'comment'}); i++; continue; }
    if(/^\/\*/.test(l)){ let e=i; while(e<L.length && L[e].indexOf('*/')<0) e++; items.push({s:i,e:e+1,kind:'comment'}); i=e+1; continue; }
    let e=i+1;
    for(;;){ while(e<=L.length && !ok(L.slice(i,e).join('\n'))) e++;
      // câu lệnh còn nối tiếp ở dòng sau (else / chuỗi .then / toán tử) -> kéo dài tiếp
      if(e<L.length && /^\s*(else\b|catch\b|finally\b|[.?:+\-*|&,)\]])/.test(L[e])){ e++; continue; } break; }
    if(e>L.length) throw new Error('không dịch được từ dòng '+(i+1));
    const m=l.match(/^(?:async )?function\s+([\w$]+)/);
    const decl=[...L.slice(i,e).join('\n').matchAll(/^(?:async )?function\s+([\w$]+)|^(?:var|let|const)\s+([\w$]+)/gm)].map(x=>x[1]||x[2]);
    items.push({s:i,e,kind:m?'fn':'stmt',name:m?m[1]:null,decl});
    i=e;
  }
  return {L,items};
}

// DOM/trình duyệt giả: mọi thuộc tính / lời gọi trả về chính nó; *-spec.js thay bằng bản rỗng
const stub=()=>{ const f=function(){ return P; }; const P=new Proxy(f,{ get:(t,k)=>k===Symbol.toPrimitive?(()=>''):(k==='readyState'?'complete':(k==='length'?0:P)),
  apply:()=>P, construct:()=>P, set:()=>true, has:()=>true }); return P; };
const S0=stub();
const ctx={ console, setTimeout:()=>0, clearTimeout(){}, setInterval:()=>0, Promise, JSON, Math, Date, Object, Array, String, Number, RegExp, Error,
  document:S0, localStorage:{getItem:()=>null,setItem(){},removeItem(){}}, sessionStorage:{getItem:()=>null,setItem(){}},
  navigator:S0, location:S0, fetch:()=>new Promise(()=>{}), requestAnimationFrame:()=>0, getComputedStyle:()=>S0,
  VS_SPEC:{METRIC:{}}, SON_SPEC:{METRIC:{}}, matchMedia:()=>S0, history:S0, URL, Blob:function(){}, FormData:function(){}, Image:function(){}, alert(){}, confirm:()=>false };
ctx.window=ctx; vm.createContext(ctx);
const files = [...fs.readFileSync(path.join(PUB, 'index.html'), 'utf8').matchAll(/<script src="([\w.-]+\.js)">/g)]
  .map(m => m[1]).filter(f => !/-spec\.js$/.test(f)).map(f => path.join(PUB, f));
let bad=0;
for(const f of files){
  const {L,items}=segment(fs.readFileSync(f,'utf8'));
  const code=x=>L.slice(x.s,x.e).join('\n');
  items.filter(x=>x.kind==='fn').forEach(x=>vm.runInContext(code(x),ctx));
  items.filter(x=>x.kind==='stmt').forEach(x=>(x.decl||[]).forEach(n=>{ if(/^\s*(var|let|const)\b/.test(L[x.s])) vm.runInContext('var '+n+';',ctx); }));
  items.filter(x=>x.kind==='stmt').forEach(x=>{ let c=code(x).replace(/^\s*(let|const)\s/,'var ');
    try{ vm.runInContext(c,ctx); }catch(e){ if(e instanceof ReferenceError || e.name==='ReferenceError'){ bad++; console.log('LỖI NẠP', path.basename(f)+':'+(x.s+1), e.message); } } });
}
if (bad) { console.log('check-load: ' + bad + ' lỗi thứ tự nạp'); process.exit(1); }
console.log('check-load: ' + files.map(f => path.basename(f)).join(' → ') + ' — nạp đúng thứ tự');
