// اختبارات ر٩ — كتالوج المنتجات (م١٥) على البيانات الحيّة عبر الهيكل الاختباري.
// العلم (مطفأ ⇒ لا تبويب/شاشة منتجات، التطبيق كما هو؛ مفعّل ⇒ تبويب «المنتجات» + كتالوج + بطاقة).
// المبدأ المُلزِم (P11): بطاقة واحدة لكل منتج = مصدر الحقيقة؛ ولقطة الجلسة مجمّدة — تعديل البطاقة لا يمسّها.
// ABC/XYZ يُحسبان آليًّا من دفتر الحركات (out=استهلاك) ونتحقّق منهما بإعادة حساب مستقلّة (كطيّ T7/B3).
import { chromium } from 'playwright-core';
import { execSync } from 'node:child_process';
import path from 'node:path';
execSync('node build_harness.js', { cwd: process.cwd(), stdio: 'inherit' });
const EXE = process.env.CHROME_EXE || '/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell';
const HARNESS = 'file://' + path.resolve('harness.html');
const b64 = (o) => Buffer.from(JSON.stringify(o), 'utf8').toString('base64');

const OWNER = { uid:'u_owner', email:'a2@dhtrd.com', name:'المالك', role:'مدير', active:true };
const CFG_ON  = { features:{ productCatalog:true } };
const CFG_ON_SUP = { features:{ productCatalog:true, suppliers:true } };

// حركات مبذورة لتصنيف ABC/XYZ — طوابع شهرية بتوقيت UTC (استقرار عبر المناطق الزمنية)
const M = (mo) => Date.UTC(2026, mo, 15, 12, 0, 0);
const MOVES = [
  // A: أربعة أشهر ثابتة ٢٠٠ ⇒ استهلاك ٨٠٠، CV=٠ ⇒ X
  {type:'out',sku:'A',qty:200,at:{__ts:M(0)}},{type:'out',sku:'A',qty:200,at:{__ts:M(1)}},{type:'out',sku:'A',qty:200,at:{__ts:M(2)}},{type:'out',sku:'A',qty:200,at:{__ts:M(3)}},
  // B: ١٤٠ ثم ١٠ ⇒ استهلاك ١٥٠، صناديق [140,10] ⇒ CV≈٠٫٨٧ ⇒ Y
  {type:'out',sku:'B',qty:140,at:{__ts:M(0)}},{type:'out',sku:'B',qty:10,at:{__ts:M(1)}},
  // C: ٤٠ (ش٠) ثم ١٠ (ش٣) ⇒ استهلاك ٥٠، صناديق [40,0,0,10] ⇒ CV≈١٫٣١ ⇒ Z
  {type:'out',sku:'C',qty:40,at:{__ts:M(0)}},{type:'out',sku:'C',qty:10,at:{__ts:M(3)}},
  // إدخال (in) لا يُحتسب استهلاكًا — يجب ألا يؤثّر
  {type:'in',sku:'A',qty:999,at:{__ts:M(0)}},
];
// إعادة حساب مستقلّة (بنفس قاعدة التطبيق، مكتوبة هنا استقلالًا) — تكلفة=١ ⇒ القيمة=الكمية
function indepClassify(skus, moves){
  const cons={}; moves.forEach(m=>{ if(m.type==='out'){ cons[m.sku]=(cons[m.sku]||0)+m.qty; } });
  const withData=skus.filter(s=>(cons[s]||0)>0).map(s=>({sku:s,val:cons[s]||0})).sort((a,b)=> (b.val-a.val)||(a.sku<b.sku?-1:1));
  const total=withData.reduce((x,v)=>x+v.val,0); let cum=0; const cls={};
  withData.forEach(v=>{ cum+=v.val; const pct=total>0?cum/total:1; cls[v.sku]={abc: pct<=0.8+1e-9?'A':(pct<=0.95+1e-9?'B':'C')}; });
  skus.forEach(s=>{ if(!cls[s])cls[s]={abc:'—'};
    if(!(cons[s]>0)){ cls[s].xyz='—'; return; }
    const mm={}; moves.forEach(m=>{ if(m.type==='out'&&m.sku===s){ const d=new Date(m.at.__ts); const i=d.getUTCFullYear()*12+d.getUTCMonth(); mm[i]=(mm[i]||0)+m.qty; } });
    const idxs=Object.keys(mm).map(Number); const lo=Math.min.apply(null,idxs), hi=Math.max.apply(null,idxs); const arr=[]; for(let i=lo;i<=hi;i++)arr.push(mm[i]||0);
    const n=arr.length, mean=arr.reduce((x,y)=>x+y,0)/n; if(mean===0){ cls[s].xyz='—'; return; }
    const varc=arr.reduce((x,y)=>x+(y-mean)*(y-mean),0)/n; const cv=Math.sqrt(varc)/mean;
    cls[s].xyz = cv<0.5?'X':(cv<1?'Y':'Z');
  });
  return cls;
}
const EXP = indepClassify(['A','B','C','D'], MOVES);

const results=[]; const ok=(n,c,d='')=>results.push({n,pass:!!c,d});
const browser=await chromium.launch({ executablePath:EXE, args:['--no-sandbox'] });
const ctx=await browser.newContext({ viewport:{width:1200,height:1400} });
async function load(page,sc){ await page.addInitScript(()=>{ try{ localStorage.clear(); }catch(e){} });
  await page.goto(HARNESS+'?s='+encodeURIComponent(b64(sc))); await page.waitForFunction('window.__ready===true',{timeout:8000}); await page.waitForTimeout(160); }
async function openProducts(page){ await page.evaluate(()=>window.__setTab('products'));
  await page.waitForFunction('window.__pxReady&&window.__pxReady()===true',{timeout:9000}); await page.waitForTimeout(120); }
const has=(page,id)=>page.evaluate(i=>window.__has(i), id);

// ===== P1 — العلم مطفأ افتراضيًا: لا تبويب/شاشة منتجات، التطبيق كما هو =====
{ const page=await ctx.newPage(); await load(page,{profile:OWNER,users:[OWNER]});
  const flag=await page.evaluate(()=>window.__featuresProductCatalogOn());
  const nav=await page.evaluate(()=>window.__nav());
  ok('P1 العلم مطفأ افتراضيًا', flag===false, 'flag='+flag);
  ok('P1 لا تبويب «المنتجات» في الشريط', !nav.html.includes('data-tab="products"'), nav.html.slice(0,160));
  await page.evaluate(()=>window.__setTab('products')); await page.waitForTimeout(150);
  ok('P1 لا شاشة منتجات ولو فُرض التبويب (pxScreen غائب)', !(await has(page,'pxScreen')));
  await page.close(); }

// ===== P2 — العلم مفعّل: التبويب والكتالوج والبطاقة تظهر =====
{ const page=await ctx.newPage(); await load(page,{profile:OWNER,users:[OWNER],config:CFG_ON,products:[{id:'PRD-1',sku:'PRD-1',name:'منتج تجريبي',status:'active',unit:'حبة',pack:12}]});
  const flag=await page.evaluate(()=>window.__featuresProductCatalogOn());
  const nav=await page.evaluate(()=>window.__nav());
  ok('P2 العلم مفعّل', flag===true, 'flag='+flag);
  ok('P2 تبويب «المنتجات» في الشريط', nav.html.includes('data-tab="products"'), nav.html.slice(0,160));
  await openProducts(page);
  ok('P2 الشاشة والكتالوج يُعرضان', (await has(page,'pxScreen')) && (await has(page,'pxList')));
  ok('P2 بطاقة المنتج تُعرض للمنتج المبذور', await has(page,'pxCard'));
  await page.close(); }

// ===== P3 — الإنشاء يتطلّب SKU فريدًا؛ التكرار والفراغ مرفوضان =====
{ const page=await ctx.newPage(); await load(page,{profile:OWNER,users:[OWNER],config:CFG_ON});
  const r1=await page.evaluate(()=>window.__pxCreate({sku:'U1',name:'الأول'}));
  const r2=await page.evaluate(()=>window.__pxCreate({sku:'U1',name:'مكرر'}));
  const r3=await page.evaluate(()=>window.__pxCreate({sku:'',name:'بلا رمز'}));
  const r4=await page.evaluate(()=>window.__pxCreate({sku:'   ',name:'فراغات'}));
  ok('P3 إنشاء بـ SKU فريد ينجح', r1&&r1.ok===true, JSON.stringify(r1));
  ok('P3 SKU مكرر مرفوض برسالة', !!(r2&&r2.err)&&/مكرر/.test(r2.err), JSON.stringify(r2));
  ok('P3 لا منتج بلا SKU (فارغ مرفوض)', !!(r3&&r3.err), JSON.stringify(r3));
  ok('P3 SKU فراغات فقط مرفوض', !!(r4&&r4.err), JSON.stringify(r4));
  await page.close(); }

// ===== P4 — الحفظ يُثبت الحقول في products/<sku> والتعديل يُحدّثها =====
{ const page=await ctx.newPage(); await load(page,{profile:OWNER,users:[OWNER],config:CFG_ON});
  await page.evaluate(()=>window.__pxCreate({sku:'S1',name:'قديم',brand:'ب١',cost:4,pack:6}));
  const pid=await page.evaluate(()=>window.__pxPid('S1'));
  const stored=await page.evaluate((p)=>{ const d=window.__store['products/'+p]; return d?{sku:d.sku,name:d.name,pack:d.pack}:null; }, pid);
  ok('P4 البطاقة محفوظة في products/<sku> بالحقول', !!stored && stored.sku==='S1' && stored.name==='قديم' && stored.pack===6, JSON.stringify(stored));
  const sv=await page.evaluate(()=>window.__pxSave('S1',{name:'جديد',brand:'ب٢'}));
  const after=await page.evaluate((p)=>{ const d=window.__store['products/'+p]; return {name:d.name,brand:d.brand}; }, pid);
  ok('P4 التعديل يُحدّث المتجر', sv&&sv.ok===true && after.name==='جديد' && after.brand==='ب٢', JSON.stringify({sv,after}));
  await page.close(); }

// ===== P5 — اللقطة المجمّدة (P11): تعديل البطاقة بعد اللقطة لا يغيّر لقطة الجلسة =====
{ const page=await ctx.newPage();
  await load(page,{profile:OWNER,users:[OWNER],config:CFG_ON,sessions:[{id:'s1',name:'جلسة',location:'م',status:'open',__chunks:[[{code:'FS-1',name:'الاسم القديم',book:10,cost:5}]]}]});
  const snapBefore=await page.evaluate(()=>window.__store['sessions/s1/snapshot/chunk_0000'].items[0].name);
  await page.evaluate(()=>window.__pxCreate({sku:'FS-1',name:'الاسم القديم'}));
  await page.evaluate(()=>window.__pxSave('FS-1',{name:'الاسم الجديد'}));
  const cardName=await page.evaluate(()=>{ const p=window.__pxGet('FS-1'); return p&&p.name; });
  const snapAfter=await page.evaluate(()=>window.__store['sessions/s1/snapshot/chunk_0000'].items[0].name);
  ok('P5 لقطة الجلسة قبل التعديل = «الاسم القديم»', snapBefore==='الاسم القديم', 'before='+snapBefore);
  ok('P5 البطاقة صارت «الاسم الجديد» بعد التعديل', cardName==='الاسم الجديد', 'card='+cardName);
  ok('P5 لقطة الجلسة لم تتغيّر (مجمّدة) رغم تعديل البطاقة', snapAfter==='الاسم القديم', 'after='+snapAfter);
  await page.close(); }

// ===== P6 — دورة الحياة: مسودة→نشط→موقوف يُسجَّل ويُستبعد الموقوف من الأهلية للجلسات الجديدة =====
{ const page=await ctx.newPage(); await load(page,{profile:OWNER,users:[OWNER],config:CFG_ON});
  await page.evaluate(()=>window.__pxCreate({sku:'LC',name:'دورة'}));
  await page.evaluate(()=>window.__pxCreate({sku:'LC2',name:'باقٍ نشط'}));
  await page.evaluate(()=>window.__pxSetStatus('LC','active'));
  await page.evaluate(()=>window.__pxSetStatus('LC2','active'));
  const eligBefore=await page.evaluate(()=>window.__pxEligible());
  const r=await page.evaluate(()=>window.__pxSetStatus('LC','suspended'));
  const status=await page.evaluate(()=>window.__pxGet('LC').status);
  const eligAfter=await page.evaluate(()=>window.__pxEligible());
  const hist=await page.evaluate(()=>window.__pxHistory('LC'));
  const stTypes=hist.filter(h=>h.type==='status').length;
  ok('P6 قبل الإيقاف: LC ضمن الأهلية', eligBefore.indexOf('LC')>=0, JSON.stringify(eligBefore));
  ok('P6 الإيقاف نجح والحالة = موقوف', r&&r.ok===true && status==='suspended', JSON.stringify({r,status}));
  ok('P6 الموقوف مُستبعَد من الجلسات الجديدة، والنشط باقٍ', eligAfter.indexOf('LC')<0 && eligAfter.indexOf('LC2')>=0, JSON.stringify(eligAfter));
  ok('P6 انتقالات الحالة مُسجَّلة في التاريخ (قيدان status)', stTypes===2, 'status entries='+stTypes);
  await page.close(); }

// ===== P7 — المتغيرات: لاحقة SKU-Vn ولكلٍّ باركوده =====
{ const page=await ctx.newPage(); await load(page,{profile:OWNER,users:[OWNER],config:CFG_ON});
  await page.evaluate(()=>window.__pxCreate({sku:'V1P',name:'أساس'}));
  const v1=await page.evaluate(()=>window.__pxAddVariant('V1P','أحمر'));
  const v2=await page.evaluate(()=>window.__pxAddVariant('V1P','أزرق'));
  const vars=await page.evaluate(()=>window.__pxGet('V1P').variants);
  const bc1=await page.evaluate(()=>window.__pxBarcodeSvg('V1P-V1'));
  const bc2=await page.evaluate(()=>window.__pxBarcodeSvg('V1P-V2'));
  ok('P7 المتغير الأول بلاحقة V1P-V1', v1&&v1.sku==='V1P-V1', JSON.stringify(v1));
  ok('P7 المتغير الثاني بلاحقة V1P-V2', v2&&v2.sku==='V1P-V2', JSON.stringify(v2));
  ok('P7 المتغيرات محفوظة بباركود مستقلّ لكلٍّ', Array.isArray(vars)&&vars.length===2 && vars[0].barcode==='V1P-V1' && vars[1].barcode==='V1P-V2', JSON.stringify(vars));
  ok('P7 باركود كل متغير SVG مرسوم ومتمايز', /<rect/.test(bc1)&&/<rect/.test(bc2)&&bc1!==bc2);
  await page.close(); }

// ===== P8 — الوحدات: تحويل معامل العبوة يُحسب صحيحًا (تحقّق مستقلّ) =====
{ const page=await ctx.newPage(); await load(page,{profile:OWNER,users:[OWNER],config:CFG_ON});
  const toBase=await page.evaluate(()=>window.__pxPackToBase(12,3));
  const toPack=await page.evaluate(()=>window.__pxBaseToPack(12,36));
  ok('P8 ٣ كرتون × ١٢ = ٣٦ حبة', toBase===36, 'toBase='+toBase);
  ok('P8 ٣٦ حبة ÷ ١٢ = ٣ كرتون', toPack===3, 'toPack='+toPack);
  await page.close(); }

// ===== P9 — ABC/XYZ على حركات مبذورة: مطابقة مستقلة، و«—» بلا حركة =====
{ const page=await ctx.newPage(); await load(page,{profile:OWNER,users:[OWNER],config:CFG_ON});
  await page.evaluate(async()=>{ await window.__pxCreate({sku:'A',name:'أ'}); await window.__pxCreate({sku:'B',name:'ب'}); await window.__pxCreate({sku:'C',name:'ج'}); await window.__pxCreate({sku:'D',name:'د'}); });
  await page.evaluate((m)=>window.__pxSeedMoves(m), MOVES);
  const cls=await page.evaluate(()=>window.__pxClassify());
  const same=['A','B','C','D'].every(s=> cls[s] && cls[s].abc===EXP[s].abc && cls[s].xyz===EXP[s].xyz);
  ok('P9 ABC مطابق للحساب المستقلّ (A=A،B=B،C=C على ٨٠٪/٩٥٪)',
    cls.A.abc==='A'&&cls.B.abc==='B'&&cls.C.abc==='C', JSON.stringify({A:cls.A,B:cls.B,C:cls.C,exp:EXP}));
  ok('P9 XYZ مطابق للحساب المستقلّ (A=X ثابت، B=Y، C=Z)',
    cls.A.xyz==='X'&&cls.B.xyz==='Y'&&cls.C.xyz==='Z', JSON.stringify({A:cls.A,B:cls.B,C:cls.C}));
  ok('P9 بلا حركة ⇒ «—» لا تلفيق (المنتج D)', cls.D.abc==='—'&&cls.D.xyz==='—', JSON.stringify(cls.D));
  ok('P9 كامل التصنيف يطابق إعادة الحساب المستقلة', same, JSON.stringify({dom:cls,exp:EXP}));
  await page.close(); }

// ===== P10 — حقل المورد يظهر/يختفي بعلم featuresSuppliersOn =====
{ const page=await ctx.newPage(); await load(page,{profile:OWNER,users:[OWNER],config:CFG_ON,products:[{id:'SP-1',sku:'SP-1',name:'بمورد',status:'active'}]});
  await openProducts(page);
  const supOff=await has(page,'px_supplier');
  ok('P10 المورد مخفيّ عند إطفاء تحليل الموردين', supOff===false);
  await page.close();
  const page2=await ctx.newPage(); await load(page2,{profile:OWNER,users:[OWNER],config:CFG_ON_SUP,products:[{id:'SP-1',sku:'SP-1',name:'بمورد',status:'active'}]});
  await openProducts(page2);
  const supOn=await has(page2,'px_supplier');
  ok('P10 المورد ظاهر عند تفعيل تحليل الموردين', supOn===true);
  await page2.close(); }

// ===== P11 — التاريخ ملحق-فقط: كل تغيير يضيف قيدًا بفاعل ووقت =====
{ const page=await ctx.newPage(); await load(page,{profile:OWNER,users:[OWNER],config:CFG_ON});
  await page.evaluate(()=>window.__pxCreate({sku:'H1',name:'تاريخ'}));
  const h1=await page.evaluate(()=>window.__pxHistory('H1'));
  await page.evaluate(()=>window.__pxSave('H1',{name:'تاريخ٢'}));
  await page.evaluate(()=>window.__pxAddVariant('H1','متغير'));
  await page.evaluate(()=>window.__pxAddAttr('H1','لون','أحمر'));
  const h2=await page.evaluate(()=>window.__pxHistory('H1'));
  const types=h2.map(h=>h.type);
  const allActor=h2.every(h=>h.by==='u_owner'&&!!h.at);
  ok('P11 الإنشاء يبدأ التاريخ بقيد create واحد', h1.length===1 && h1[0].type==='create', JSON.stringify(h1.map(h=>h.type)));
  ok('P11 كل تغيير يُلحق قيدًا (create+edit+variant+attr = ٤)', h2.length===4, JSON.stringify(types));
  ok('P11 التاريخ ملحق-فقط ويحوي أنواع التغييرات', types.indexOf('edit')>=0&&types.indexOf('variant')>=0&&types.indexOf('attr')>=0, JSON.stringify(types));
  ok('P11 كل قيد يحمل الفاعل والوقت', allActor, JSON.stringify(h2.map(h=>({t:h.type,by:h.by,at:!!h.at}))));
  await page.close(); }

// ===== P12 — الباركود/QR: عناصر SVG تُرسم للبطاقة (بلا مكتبة خارجية) =====
{ const page=await ctx.newPage(); await load(page,{profile:OWNER,users:[OWNER],config:CFG_ON,products:[{id:'QR-1',sku:'QR-1',name:'رموز',status:'active'}]});
  await openProducts(page);
  const codes=await page.evaluate(()=>{ const bar=document.querySelector('#pxBarcode svg'), qr=document.querySelector('#pxQr svg');
    return { barRects: bar?bar.querySelectorAll('rect').length:0, qrRects: qr?qr.querySelectorAll('rect').length:0, hasBar:!!bar, hasQr:!!qr }; });
  ok('P12 باركود البطاقة SVG مرسوم بمستطيلات', codes.hasBar && codes.barRects>0, JSON.stringify(codes));
  ok('P12 QR البطاقة SVG مرسوم بخلايا', codes.hasQr && codes.qrRects>0, JSON.stringify(codes));
  await page.close(); }

await browser.close();
let pass=0, fail=0;
for (const r of results){ console.log(`${r.pass?'✓':'✗'} ${r.n}${r.pass?'':'  << '+r.d}`); r.pass?pass++:fail++; }
console.log(`\nRECON ${pass}/${pass+fail} passed`);
process.exit(fail?1:0);
