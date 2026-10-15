const nums=[0,-0,1,-1,1.5,123456789,1e21,1e-7,1.5e-7,123456789012345680000,1e20,0.000001,0.1+0.2,5e-324,1.7976931348623157e308,NaN,Infinity,-Infinity,100,1234.5678,-1234.5,2**53,1e300,0.00001234,123e-20,4.35,1.005];
console.log("STR",JSON.stringify(nums.map(String)));
console.log("JSON",JSON.stringify(nums));
const tn=["","  12  ","0x1F","1e3","-1.5e-2",".5","5.","abc","12px","Infinity","-Infinity","+Infinity","infinity","0b101","0o17","1_000","\n\t 7  ","+.5e1","-","+","0x","1e","--1","﻿3","1,5","0X10","-0x10","00012","1e1000","-0"];
console.log("NUM",JSON.stringify(tn.map(x=>String(Number(x)))));
console.log("PF",JSON.stringify(tn.map(x=>String(parseFloat(x)))));
console.log("PI",JSON.stringify(tn.map(x=>String(parseInt(x,10)))));
console.log("PI0",JSON.stringify(tn.map(x=>String(parseInt(x)))));
const r=[0.5,-0.5,1.5,2.5,-1.5,-2.5,0.49999999999999994,-0.49999999999999994,1e20+0.5,2.4999,-2.5001,4503599627370497.5,-0.2];
console.log("RND",JSON.stringify(r.map(x=>String(Math.round(x))+(Object.is(Math.round(x),-0)?"N":""))));
const tf=[[0.5,0],[1.5,0],[2.5,0],[1.005,2],[1.045,2],[-1.5,0],[-0.0001,2],[1e21,2],[123.456,1],[0,2],[-0,2],[0.000001,7],[1234.5678,2],[8.345,2],[10.235,2],[NaN,2],[1.45,1],[-2.5,0],[0.5,1],[999.995,2],[5e-7,6]];
console.log("TF",JSON.stringify(tf.map(a=>a[0].toFixed(a[1]))));
const vn=[0,1,-1,1234,1234567,1234.5,1234.5678,0.1235,0.0005,0.00049,-1234567.891,1e21,1.0005,2.0015,1.0015,1.0025,999.9995,NaN,Infinity,-Infinity,-0,0.5,1e15,123456789012345680,1.2345,1.2355,1e-7, 12345.6789,0.125,0.375,2.5,3.5,-0.0004,1.005,8.345];
console.log("VN",JSON.stringify(vn.map(x=>x.toLocaleString("vi-VN"))));
console.log("VN2",JSON.stringify(vn.map(x=>x.toLocaleString("vi-VN",{minimumFractionDigits:2,maximumFractionDigits:2}))));
console.log("VN0",JSON.stringify(vn.map(x=>x.toLocaleString("vi-VN",{maximumFractionDigits:0}))));
console.log("VN12",JSON.stringify(vn.map(x=>x.toLocaleString("vi-VN",{minimumFractionDigits:1,maximumFractionDigits:2}))));
console.log("ENC",JSON.stringify(["a b&c=d/é?#","-_.!~*'()","Tiếng Việt 100%","\u{1F600}+",null,undefined,12.5,true].map(encodeURIComponent)));
console.log("SJ",JSON.stringify(["a\"b\\c\n\r\t\b\f\u0001\u001f\u007f  <>&é\u{1F600}","/"]));
console.log("OBJ",JSON.stringify({b:1,"2":2,a:3,"1":4,"01":5,"-1":6,"4294967294":7,"4294967295":8,"1.5":9,u:undefined,arr:[undefined,null,NaN,()=>1]}));
console.log("STRV",JSON.stringify([String([1,[2,3],null,undefined,"a"]),String({}),String(null),String(undefined),String(true),String([]),Number([]),Number([5]),Number(["7"]),Number([1,2])+"",Number({})+"",Number(null),Number(undefined)+"",Number(true),Number(false)]));
console.log("LE",JSON.stringify([null==undefined,null==0,""==0,"1"==1,"a"==NaN,true==1,"true"==true,"0"==false,undefined==0,null==false,"1.0"==1," 1 "==1]));
console.log("TRIM",JSON.stringify([" ﻿ 　  x ​ ".trim()]));
console.log("SLICE",JSON.stringify(["a\u{1F600}b".length,"a\u{1F600}b".slice(0,2),"abcdef".slice(-3),"abcdef".slice(2,-1),"abcdef".slice(4,2),"abcdef".substring(4,2)]));
console.log("ISO",new Date(1760000000123).toISOString(), new Date(0).toISOString());
