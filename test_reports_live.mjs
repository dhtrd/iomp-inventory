// اختبارات ر٧ — شاشة التقارير الموحّدة (م١٩) على البيانات الحيّة.
// التبويب/الشاشة، مؤشّرات التنفيذي (data-v)، ABC (حدود 80/95)، الأعمار (مجموع الشرائح=الكل)،
// نطاق الدور (report.view.location)، تصدير CSV لكل النطاق (>300)، حفظ باسم في localStorage،
// علم الموردين (مقفل/ظاهر)، ترويسة الطباعة «الضبيبي»، التنقيب فئة←أصناف مع رجوع.
import { chromium } from 'playwright-core';
import { execSync } from 'node:child_process';
import path from 'node:path';
execSync('node build_harness.js', { cwd: process.cwd(), stdio: 'inherit' });
const EXE = process.env.CHROME_EXE || '/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell';
const HARNESS = 'file://' + path.resolve('harness.html');
const b64 = (o) => Buffer.from(JSON.stringify(o), 'utf8').toString('base64');
const OWNER = { uid:'u_owner', email:'a2@dhtrd.com', name:'المالك', role:'مدير', active:true };
const CT    = { uid:'u_ct', email:'ct@dhtrd.com', name:'عدّاد ١', role:'عدّاد', active:true };

const results=[]; const ok=(n,c,d='')=>results.push({n,pass:!!c,d});
const browser=await chromium.launch({ executablePath:EXE, args:['--no-sandbox'] });
const ctx=await browser.newContext({ viewport:{width:1100,height:1200} });
async function load(page,sc){ await page.addInitScript(()=>{ try{ localStorage.clear(); }catch(e){} });
  await page.goto(HARNESS+'?s='+encodeURIComponent(b64(sc))); await page.waitForFunction('window.__ready===true',{timeout:8000}); await page.waitForTimeout(200); }
async function openReports(page){ await page.evaluate(()=>window.__setTab('reports'));
  await page.waitForFunction('window.__repxReady&&window.__repxReady()===true',{timeout:9000}); await page.waitForTimeout(120); }
async function openCard(page,id){ await page.evaluate(i=>{ const b=document.querySelector('[data-repx="'+i+'"]'); if(b)b.click(); }, id); await page.waitForTimeout(150); }
const indVal=(page,label)=>page.evaluate(l=>{ const t=[...document.querySelectorAll('#repxInd .tile')].find(x=>x.querySelector('.k')&&x.querySelector('.k').textContent.trim()===l); const v=t&&t.querySelector('.v[data-v]'); return v?v.getAttribute('data-v'):null; }, label);

// ===== R1 — التبويب والشاشة: المالك يحصل عليهما، العدّاد لا =====
{ const page=await ctx.newPage(); await load(page,{profile:OWNER,users:[OWNER,CT]});
  const nav=await page.evaluate(()=>window.__nav());
  ok('R1 المالك: تبويب «التقارير» في الشريط', nav.html.includes('data-tab="reports"'), nav.html.slice(0,120));
  await openReports(page);
  const html=await page.evaluate(()=>window.__contentHtml());
  ok('R1 شاشة التقارير تُعرض (كتالوج مجمّع)', html.includes('التقارير')&&html.includes('المخزون والقيمة')&&html.includes('تُفعَّل مع دفتر الحركات'), '');
  await page.close(); }
{ const page=await ctx.newPage(); await load(page,{user:{uid:'u_ct',email:'ct@dhtrd.com'},profile:CT,users:[OWNER,CT]});
  const nav=await page.evaluate(()=>window.__nav());
  ok('R1 العدّاد: لا تبويب تقارير (لا صلاحية عرض)', !nav.html.includes('data-tab="reports"'), JSON.stringify(nav).slice(0,120));
  await page.close(); }

// ===== R2 — التنفيذي: مؤشّرات قيمة المخزون وأصناف مشمولة (إعادة حساب مستقلة ومقارنة data-v) =====
{ const EXI=[[
    {code:'A1',name:'صنف أ١',category:'أ',book:10,cost:5},
    {code:'A2',name:'صنف أ٢',category:'أ',book:4,cost:5},
    {code:'B1',name:'صنف ب١',category:'ب',book:3,cost:10}]];
  const EXC=[{code:'A1',qty:10},{code:'A2',qty:4},{code:'B1',qty:3}];
  // إعادة الحساب المستقلة: القيمة = المعدود × التكلفة
  const expVal=10*5+4*5+3*10, expItems=3;
  const page=await ctx.newPage(); await load(page,{profile:OWNER,users:[OWNER],sessions:[
    {id:'sx',name:'جرد تنفيذي',status:'approved',location:'فرع أ',itemCount:3,__chunks:EXI,__counts:EXC}]});
  await openReports(page); await openCard(page,'executive');
  const vVal=await indVal(page,'قيمة المخزون'); const vItems=await indVal(page,'أصناف مشمولة');
  ok('R2 قيمة المخزون (data-v) تطابق الحساب المستقل', Number(vVal)===expVal, `dom=${vVal} exp=${expVal}`);
  ok('R2 أصناف مشمولة (data-v) = عدد الأصناف', Number(vItems)===expItems, `dom=${vItems}`);
  const m=await page.evaluate(()=>window.__repxModel('executive'));
  ok('R2 النموذج: مجموع فئتين والقيمة الكلّية', m.cats.length===2&&m.value===expVal, JSON.stringify(m.cats));
  await page.close(); }

// ===== R3 — ABC: تقسيم A/B/C وحدّا 80٪/95٪ (تحقّق مستقل) =====
{ const V=[50,20,15,10,5]; // متراكم: 50,70,85,95,100 → A,A,B,B,C
  const ABI=[V.map((v,i)=>({code:'V'+i,name:'صنف '+i,category:'ك',book:v,cost:1}))];
  const page=await ctx.newPage(); await load(page,{profile:OWNER,users:[OWNER],sessions:[
    {id:'sa',name:'جرد ABC',status:'approved',location:'فرع أ',itemCount:V.length,__chunks:ABI}]});
  await openReports(page); const m=await page.evaluate(()=>window.__repxModel('abc'));
  // تحقّق مستقل من الحدّ
  const total=V.reduce((a,b)=>a+b,0); let run=0; const cls=V.slice().sort((a,b)=>b-a).map(v=>{run+=v; const c=run/total*100; return c<=80?'A':(c<=95?'B':'C');});
  const eA=cls.filter(x=>x==='A').length,eB=cls.filter(x=>x==='B').length,eC=cls.filter(x=>x==='C').length;
  ok('R3 تقسيم ABC مطابق للتحقّق المستقل (A/B/C)', m.A===eA&&m.B===eB&&m.C===eC&&eA===2&&eB===2&&eC===1, `dom=${m.A}/${m.B}/${m.C} exp=${eA}/${eB}/${eC}`);
  ok('R3 الصنف عند تراكم ٨٥٪ = B لا A (حدّ ٨٠٪)', m.rows[2].cls==='B'&&m.rows[2].cum===85, JSON.stringify(m.rows[2]));
  await page.close(); }

// ===== R4 — الأعمار: الشرائح الأربع تجمع إلى الكل (تحقّق مستقل) =====
{ const D=86400000; const now=Date.now();
  const mk=(id,ageDays,n)=>({id,name:'جرد '+id,status:'approved',location:'فرع أ',itemCount:n,uploadedAt:{__ts:now-ageDays*D},
    __chunks:[Array.from({length:n},(_,i)=>({code:id+i,name:'ص'+i,category:'ك',book:2,cost:1}))]});
  const page=await ctx.newPage(); await load(page,{profile:OWNER,users:[OWNER],sessions:[mk('N',1,2),mk('M',100,3),mk('O',300,1)]});
  await openReports(page); const m=await page.evaluate(()=>window.__repxModel('aging'));
  const sum=m.buckets.reduce((a,b)=>a+b.items,0);
  ok('R4 مجموع شرائح الأعمار = إجمالي الأصناف', sum===m.total&&m.total===6, `sum=${sum} total=${m.total}`);
  ok('R4 توزيع الشرائح صحيح (2/0/3/1)', m.buckets[0].items===2&&m.buckets[1].items===0&&m.buckets[2].items===3&&m.buckets[3].items===1, JSON.stringify(m.buckets.map(b=>b.items)));
  await page.close(); }

// ===== R5 — النطاق: مستخدم report.view.location يرى جلسات موقعه فقط في تقرير الجلسات =====
{ const IT=[[{code:'A',name:'ص',book:5,cost:2}]];
  const page=await ctx.newPage();
  await load(page,{user:{uid:'u_vw',email:'vw@dhtrd.com'},profile:{uid:'u_vw',email:'vw@dhtrd.com',name:'مطّلع',role:'مطّلع',active:true},users:[OWNER],
    config:{ roles:{ 'مطّلع':{ 'report.view':false, 'report.view.location':true } }, userLocations:{ 'u_vw':['فرع أ'] } },
    sessions:[{id:'A',name:'جرد أ',status:'approved',itemCount:1,location:'فرع أ',__chunks:IT},{id:'B',name:'جرد ب',status:'approved',itemCount:1,location:'فرع ب',__chunks:IT}]});
  await openReports(page); const m=await page.evaluate(()=>window.__repxModel('sessions'));
  ok('R5 نطاق الموقع: جلسة الفرع فقط في تقرير الجلسات', m.rows.length===1&&m.rows[0].name==='جرد أ', JSON.stringify(m.rows.map(r=>r.name)));
  await page.close(); }

// ===== R6 — تصدير CSV: يشمل كل صفوف النطاق (>300) مع صفّ ترويسة =====
{ const N=305; const big=Array.from({length:N},(_,i)=>({code:'C'+i,name:'صنف '+i,category:'ك',book:(i%50)+1,cost:1}));
  const page=await ctx.newPage(); await load(page,{profile:OWNER,users:[OWNER],sessions:[
    {id:'sbig',name:'جرد كبير',status:'approved',location:'فرع أ',itemCount:N,__chunks:[big]}]});
  await openReports(page); await openCard(page,'abc');
  const csv=await page.evaluate(()=>window.__repxCsv('abc'));
  const lines=csv.split('\r\n');
  ok('R6 CSV يشمل كل الصفوف (٣٠٥ + ترويسة)', lines.length===N+1, `lines=${lines.length}`);
  ok('R6 صفّ الترويسة موجود', lines[0].includes('الكود')&&lines[0].includes('التصنيف'), lines[0]);
  const shownRows=await page.evaluate(()=>document.querySelectorAll('#repxContent tbody tr').length);
  ok('R6 العرض محدود بـ٣٠٠ صفّ والتصدير للكل', shownRows===300, `shown=${shownRows}`);
  await page.close(); }

// ===== R7 — حفظ باسم: يُكتب في localStorage['iomp-reports-<uid>'] ويُستعاد =====
{ const page=await ctx.newPage(); await load(page,{profile:OWNER,users:[OWNER],sessions:[
    {id:'sx',name:'جرد',status:'approved',location:'فرع أ',itemCount:1,__chunks:[[{code:'A',name:'ص',category:'ك',book:2,cost:1}]]}]});
  await openReports(page); await openCard(page,'executive');
  await page.evaluate(()=>{ const i=document.getElementById('repxViewName'); i.value='عرضي التنفيذي'; document.getElementById('repxSaveView').click(); });
  await page.waitForTimeout(120);
  const stored=await page.evaluate(()=>{ try{ return JSON.parse(localStorage.getItem('iomp-reports-u_owner')||'{}'); }catch(e){ return {}; } });
  ok('R7 العرض محفوظ في localStorage باسمه وتقريره', stored&&stored['عرضي التنفيذي']&&stored['عرضي التنفيذي'].report==='executive', JSON.stringify(stored));
  // ارجع للكتالوج ثم استعِد العرض المحفوظ
  await page.evaluate(()=>{ const b=document.getElementById('repxBackCat'); if(b)b.click(); }); await page.waitForTimeout(100);
  await page.evaluate(()=>{ const s=document.getElementById('repxViewsSel'); s.value='عرضي التنفيذي'; s.onchange(); }); await page.waitForTimeout(120);
  const act=await page.evaluate(()=>window.__repxActive());
  ok('R7 اختيار العرض المحفوظ يستعيد التقرير', act==='executive', `active=${act}`);
  await page.close(); }

// ===== R8 — تحليل الموردين: مقفل عند إطفاء العلم، ظاهر عند تفعيله =====
{ const page=await ctx.newPage(); await load(page,{profile:OWNER,users:[OWNER],sessions:[
    {id:'sx',name:'جرد',status:'approved',location:'فرع أ',itemCount:1,__chunks:[[{code:'A',name:'ص',category:'ك',book:2,cost:1,supplier:'مورّد س'}]]}]});
  await openReports(page); const html=await page.evaluate(()=>window.__contentHtml());
  ok('R8 العلم مطفأ: بطاقة مقفلة ولا زر موردين قابل للفتح', html.includes('مُعطَّل بقرار الشركة')&&!html.includes('data-repx="suppliers"'), '');
  await page.close(); }
{ const page=await ctx.newPage(); await load(page,{profile:OWNER,users:[OWNER],config:{features:{suppliers:true}},sessions:[
    {id:'sx',name:'جرد',status:'approved',location:'فرع أ',itemCount:1,__chunks:[[{code:'A',name:'ص',category:'ك',book:2,cost:3,supplier:'مورّد س'}]]}]});
  await openReports(page);
  const hasBtn=await page.evaluate(()=>!!document.querySelector('[data-repx="suppliers"]'));
  await openCard(page,'suppliers');
  const m=await page.evaluate(()=>window.__repxModel('suppliers'));
  const shown=await page.evaluate(()=>window.__contentHtml().includes('مورّد س'));
  ok('R8 العلم مفعّل: بطاقة الموردين قابلة للفتح', hasBtn);
  ok('R8 تقرير الموردين يعرض المورّد المُدخل', m.suppliers.some(x=>x.supplier==='مورّد س')&&shown, JSON.stringify(m.suppliers));
  await page.close(); }

// ===== R9 — الطباعة: تُعيد استعمال الترويسة الموحّدة بترويسة الشركة «الضبيبي» =====
{ const page=await ctx.newPage(); await load(page,{profile:OWNER,users:[OWNER],sessions:[
    {id:'sx',name:'جرد',status:'approved',location:'فرع أ',itemCount:1,__chunks:[[{code:'A',name:'ص',category:'ك',book:2,cost:1}]]}]});
  await openReports(page); await openCard(page,'executive');
  const ph=await page.evaluate(()=>window.__repxPrintHtml('executive'));
  ok('R9 ترويسة الطباعة تتضمّن اسم الشركة «الضبيبي»', ph.includes('شركة الضبيبي التجارية')&&ph.includes('التنفيذي للجرد'), ph.slice(0,80));
  await page.close(); }

// ===== R10 — التنقيب: نقر الفئة يُظهر أصنافها مع عنصر رجوع، ثم بطاقة الصنف =====
{ const DR=[[
    {code:'A1',name:'صنف أ١',category:'أ',book:10,cost:5},
    {code:'B1',name:'صنف ب١',category:'ب',book:3,cost:10}]];
  const page=await ctx.newPage(); await load(page,{profile:OWNER,users:[OWNER],sessions:[
    {id:'sx',name:'جرد تنقيب',status:'approved',location:'فرع أ',itemCount:2,__chunks:DR,__counts:[{code:'A1',qty:10},{code:'B1',qty:3}]}]});
  await openReports(page); await openCard(page,'executive');
  await page.evaluate(()=>{ const r=document.querySelector('[data-repxcat]'); if(r)r.click(); }); await page.waitForTimeout(120);
  const drill=await page.evaluate(()=>({items:document.querySelectorAll('#repxContent [data-repxitem]').length,back:!!document.getElementById('repxCatBack')}));
  ok('R10 التنقيب فئة←أصناف مع زر رجوع', drill.items>=1&&drill.back, JSON.stringify(drill));
  await page.evaluate(()=>{ const it=document.querySelector('#repxContent [data-repxitem]'); if(it)it.click(); }); await page.waitForTimeout(120);
  const card=await page.evaluate(()=>({card:window.__contentHtml().includes('بطاقة الصنف'),back:!!document.getElementById('repxItemBack')}));
  ok('R10 التنقيب الصنف←بطاقة مع زر رجوع', card.card&&card.back, JSON.stringify(card));
  await page.close(); }

await browser.close();
let pass=0, fail=0;
for (const r of results){ console.log(`${r.pass?'✓':'✗'} ${r.n}${r.pass?'':'  << '+r.d}`); r.pass?pass++:fail++; }
console.log(`\nRECON ${pass}/${pass+fail} passed`);
process.exit(fail?1:0);
