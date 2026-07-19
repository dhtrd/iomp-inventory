// اختبارات ر٨-ب — إدارة الفروع (م١٧) على البيانات الحيّة عبر الهيكل الاختباري.
// العلم (مطفأ ⇒ لا تبويب/شاشة فروع، التطبيق كما هو؛ مفعّل ⇒ تبويب «الفروع» + بطاقات + مقارنة مركزية).
// المبدأ المُلزِم: كل مؤشّر مشتقٌّ من جلسات الجرد (مصدرٌ وحيد) — الدقّة = المطابق ÷ المعدود، الإكمال = المعدود ÷ الأصناف.
// نتحقّق مستقلًّا من الدقّة/الإكمال/الفروقات بإعادة حساب في الاختبار، ومن «أفضل فرع بالدقّة»، وأن المؤشّر يتبع تغيّر الجلسة.
// النطاق: مدير الفرع (branch.manage عبر استثناء فردي + userLocations = مستودعات فرعه) يرى فرعه فقط بلا مقارنة ولا زر تعطيل.
// التحكّم المركزي: تعطيل الفرع يمنع الجلسات الجديدة (حارس) مع بقاء القائمة، وهو قيد إلحاقيّ (append-only).
import { chromium } from 'playwright-core';
import { execSync } from 'node:child_process';
import path from 'node:path';
execSync('node build_harness.js', { cwd: process.cwd(), stdio: 'inherit' });
const EXE = process.env.CHROME_EXE || '/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell';
const HARNESS = 'file://' + path.resolve('harness.html');
const b64 = (o) => Buffer.from(JSON.stringify(o), 'utf8').toString('base64');

const OWNER = { uid:'u_owner', email:'a2@dhtrd.com', name:'المالك', role:'مدير', active:true };
const BM    = { uid:'u_bm', email:'bm@dhtrd.com', name:'مدير الرياض', role:'مدير مخزون', active:true };

// أصناف وعدّات مبذورة — تُحسب منها الدقّة/الإكمال/الفروقات
const ITEMS_A = [
  {code:'A1',name:'أ١',category:'ك',book:10,cost:1},
  {code:'A2',name:'أ٢',category:'ك',book:20,cost:1},
  {code:'A3',name:'أ٣',category:'ك',book:30,cost:1},
  {code:'A4',name:'أ٤',category:'ك',book:40,cost:1}];
const COUNTS_A = [{code:'A1',qty:10},{code:'A2',qty:20},{code:'A3',qty:30},{code:'A4',qty:35}]; // 3 مطابق + 1 عجز
const ITEMS_B = [
  {code:'B1',name:'ب١',category:'ك',book:5,cost:1},
  {code:'B2',name:'ب٢',category:'ك',book:5,cost:1},
  {code:'B3',name:'ب٣',category:'ك',book:5,cost:1},
  {code:'B4',name:'ب٤',category:'ك',book:5,cost:1}];
const COUNTS_B = [{code:'B1',qty:5},{code:'B2',qty:5}]; // معدود 2 (كلاهما مطابق)، 2 غير معدود

const WH_RY='مستودع الرياض', WH_JD='مستودع جدة';
const BR_A = {id:'bA', name:'فرع الرياض', city:'الرياض', managerUid:'u_bm', managerName:'مدير الرياض', warehouses:[WH_RY], active:true, counters:['u_c1']};
const BR_B = {id:'bB', name:'فرع جدة',   city:'جدة',    managerUid:'u_owner', managerName:'المالك', warehouses:[WH_JD], active:true, counters:['u_c1','u_c2']};
const SESS = [
  {id:'sA', name:'جرد الرياض', status:'reviewed', location:WH_RY, itemCount:4, assignedCounters:['u_c1'],        __chunks:[ITEMS_A], __counts:COUNTS_A},
  {id:'sB', name:'جرد جدة',    status:'open',     location:WH_JD, itemCount:4, assignedCounters:['u_c1','u_c2'], __chunks:[ITEMS_B], __counts:COUNTS_B}];

// إعادة حساب مستقلّة (بنفس منطق التطبيق، مكتوبة هنا استقلالًا)
function calcBranch(items, countsArr){
  const cm={}; countsArr.forEach(c=>cm[String(c.code)]=Number(c.qty));
  let counted=0, matched=0, netVar=0;
  items.forEach(it=>{ const has=Object.prototype.hasOwnProperty.call(cm,String(it.code)); const book=Number(it.book), cost=Number(it.cost);
    if(has){ counted++; const diff=cm[String(it.code)]-book; if(Math.abs(diff)<1e-9)matched++; netVar+=diff*cost; }
    else { netVar+=(-book)*cost; } });
  const n=items.length;
  return { items:n, counted, matched,
    completion: n?Math.round(counted/n*10000)/100:0, accuracy: counted?Math.round(matched/counted*10000)/100:0,
    netVar: Math.round(netVar*100)/100 };
}
const EA=calcBranch(ITEMS_A,COUNTS_A), EB=calcBranch(ITEMS_B,COUNTS_B);

const CFG_CENTRAL = { features:{branches:true} };
const CFG_BM = { features:{branches:true}, users:{ 'u_bm':{ 'branch.manage':true, 'report.view.location':true } }, userLocations:{ 'u_bm':[WH_RY] } };

const results=[]; const ok=(n,c,d='')=>results.push({n,pass:!!c,d});
const browser=await chromium.launch({ executablePath:EXE, args:['--no-sandbox'] });
const ctx=await browser.newContext({ viewport:{width:1100,height:1200} });
async function load(page,sc){ await page.addInitScript(()=>{ try{ localStorage.clear(); }catch(e){} });
  await page.goto(HARNESS+'?s='+encodeURIComponent(b64(sc))); await page.waitForFunction('window.__ready===true',{timeout:8000}); await page.waitForTimeout(180); }
async function openBranches(page){ await page.evaluate(()=>window.__setTab('branches'));
  await page.waitForFunction('window.__brxReady&&window.__brxReady()===true',{timeout:9000}); await page.waitForTimeout(120); }
const has=(page,id)=>page.evaluate(i=>window.__has(i), id);

// ===== B1 — العلم مطفأ افتراضيًا: لا تبويب/شاشة فروع، التطبيق كما هو =====
{ const page=await ctx.newPage(); await load(page,{profile:OWNER,users:[OWNER],branches:[BR_A,BR_B],sessions:SESS});
  const flag=await page.evaluate(()=>window.__featuresBranchesOn());
  const nav=await page.evaluate(()=>window.__nav());
  ok('B1 العلم مطفأ افتراضيًا', flag===false, 'flag='+flag);
  ok('B1 لا تبويب «الفروع» في الشريط', !nav.html.includes('data-tab="branches"'), nav.html.slice(0,140));
  await page.evaluate(()=>window.__setTab('branches')); await page.waitForTimeout(150);
  ok('B1 لا شاشة فروع ولو فُرض التبويب (brxScreen غائب)', !(await has(page,'brxScreen')));
  await page.close(); }

// ===== B2 — العلم مفعّل (مركزي): التبويب والبطاقات والمقارنة تظهر =====
{ const page=await ctx.newPage(); await load(page,{profile:OWNER,users:[OWNER],config:CFG_CENTRAL,branches:[BR_A,BR_B],sessions:SESS});
  const flag=await page.evaluate(()=>window.__featuresBranchesOn());
  const nav=await page.evaluate(()=>window.__nav());
  ok('B2 العلم مفعّل', flag===true, 'flag='+flag);
  ok('B2 المركزي: تبويب «الفروع» في الشريط', nav.html.includes('data-tab="branches"'), nav.html.slice(0,140));
  await openBranches(page);
  const cards=await page.evaluate(()=>document.querySelectorAll('[data-brxcard]').length);
  ok('B2 المركزي: الشاشة والبطاقتان تُعرضان', (await has(page,'brxScreen')) && cards===2, 'cards='+cards);
  ok('B2 المركزي: جدول المقارنة (brxCompare) ظاهر', await has(page,'brxCompare'));
  await page.close(); }

// ===== B3 — المقارنة: دقّة/إكمال/فروقات كل فرع تطابق إعادة الحساب المستقلة =====
{ const page=await ctx.newPage(); await load(page,{profile:OWNER,users:[OWNER],config:CFG_CENTRAL,branches:[BR_A,BR_B],sessions:SESS});
  await page.evaluate(()=>window.__brxLoad());
  const mA=await page.evaluate(()=>window.__brxBranchModel('bA'));
  const mB=await page.evaluate(()=>window.__brxBranchModel('bB'));
  ok('B3 فرع الرياض: إكمال ١٠٠٪ ودقّة ٧٥٪ وفروقات −٥ (مطابقة مستقلة)',
    mA.completionPct===EA.completion && mA.accuracyPct===EA.accuracy && mA.varianceValue===EA.netVar && mA.counted===EA.counted && mA.matched===EA.matched,
    `dom=${mA.completionPct}/${mA.accuracyPct}/${mA.varianceValue} exp=${EA.completion}/${EA.accuracy}/${EA.netVar}`);
  ok('B3 فرع جدة: إكمال ٥٠٪ ودقّة ١٠٠٪ وفروقات −١٠ (مطابقة مستقلة)',
    mB.completionPct===EB.completion && mB.accuracyPct===EB.accuracy && mB.varianceValue===EB.netVar && mB.counted===EB.counted && mB.matched===EB.matched,
    `dom=${mB.completionPct}/${mB.accuracyPct}/${mB.varianceValue} exp=${EB.completion}/${EB.accuracy}/${EB.netVar}`);
  const stats=await page.evaluate(()=>window.__brxStats());
  ok('B3 الإحصاءات التشغيلية مشتقّة: جلستان، عدّادان، أصناف قيد العدّ = ٢',
    stats.sessions===2 && stats.counters===2 && stats.underCount===2 && stats.items===8 && stats.counted===6,
    JSON.stringify(stats));
  await page.close(); }

// ===== B4 — أفضل فرع بالدقّة = جدة (١٠٠٪ > ٧٥٪) =====
{ const page=await ctx.newPage(); await load(page,{profile:OWNER,users:[OWNER],config:CFG_CENTRAL,branches:[BR_A,BR_B],sessions:SESS});
  await page.evaluate(()=>window.__brxLoad());
  const best=await page.evaluate(()=>window.__brxBest());
  ok('B4 أفضل فرع بالدقّة هو «فرع جدة»', best && best.id==='bB' && best.accuracyPct===100, JSON.stringify(best&&{id:best.id,acc:best.accuracyPct}));
  await page.close(); }

// ===== B5 — المؤشّرات تتبع الجلسة: إضافة عدّ مطابق لصنف غير معدود يرفع المعدود والإكمال =====
{ const page=await ctx.newPage(); await load(page,{profile:OWNER,users:[OWNER],config:CFG_CENTRAL,branches:[BR_A,BR_B],sessions:SESS});
  await page.evaluate(()=>window.__brxLoad());
  const before=await page.evaluate(()=>window.__brxBranchModel('bB'));
  // غيّر الجلسة في المتجر ثم أعِد التحميل
  await page.evaluate(()=>{ window.__store['sessions/sB/counts/B3']={code:'B3',qty:5}; });
  await page.evaluate(()=>window.__brxLoad());
  const after=await page.evaluate(()=>window.__brxBranchModel('bB'));
  ok('B5 قبل التغيير: معدود جدة = ٢ وإكمال ٥٠٪', before.counted===2 && before.completionPct===50, JSON.stringify({c:before.counted,p:before.completionPct}));
  ok('B5 بعد إضافة عدّ مطابق: معدود = ٣، مطابق = ٣، إكمال ٧٥٪ (KPI يتبع الجلسة)',
    after.counted===3 && after.matched===3 && after.completionPct===75 && after.accuracyPct===100,
    JSON.stringify({c:after.counted,m:after.matched,p:after.completionPct,a:after.accuracyPct}));
  await page.close(); }

// ===== B6 — التحكّم المركزي: التعطيل يمنع الجلسة الجديدة (حارس) مع بقاء القائمة، وهو قيد إلحاقيّ =====
{ const page=await ctx.newPage(); await load(page,{profile:OWNER,users:[OWNER],config:CFG_CENTRAL,branches:[BR_A,BR_B],sessions:SESS});
  await page.evaluate(()=>window.__brxLoad());
  const canBefore=await page.evaluate(()=>window.__brxCanCreate('bA'));
  const r=await page.evaluate(()=>window.__brxSetActive('bA',false));
  const storeActive=await page.evaluate(()=>window.__store['branches/bA'].active);
  const canAfter=await page.evaluate(()=>window.__brxCanCreate('bA'));
  const sessStill=await page.evaluate(()=>!!window.__store['sessions/sA']);
  const act=await page.evaluate(()=>{ const ks=Object.keys(window.__store).filter(k=>k.indexOf('branches/bA/activity/')===0 && window.__store[k]!=null); return ks.map(k=>window.__store[k].type); });
  ok('B6 التعطيل يُحدِّث active=false في المتجر', r&&r.ok===true && storeActive===false, JSON.stringify({r,storeActive}));
  ok('B6 حارس الجلسة الجديدة: مسموح قبل التعطيل، ممنوع بعده', canBefore===true && canAfter===false, `before=${canBefore} after=${canAfter}`);
  ok('B6 الجلسة القائمة تبقى بعد التعطيل (لا مساس بالبيانات)', sessStill===true);
  ok('B6 التعطيل قيد إلحاقيّ (append-only) بنوع disable', act.length===1 && act[0]==='disable', JSON.stringify(act));
  // إعادة التفعيل مركزيًّا تُعيد السماح وتُلحق قيدًا ثانيًا
  const r2=await page.evaluate(()=>window.__brxSetActive('bA',true));
  const canReen=await page.evaluate(()=>window.__brxCanCreate('bA'));
  const act2=await page.evaluate(()=>Object.keys(window.__store).filter(k=>k.indexOf('branches/bA/activity/')===0 && window.__store[k]!=null).length);
  ok('B6 إعادة التفعيل تُعيد السماح وتُلحق قيدًا ثانيًا', r2&&r2.ok===true && canReen===true && act2===2, JSON.stringify({r2,canReen,act2}));
  await page.close(); }

// ===== B7 — مدير الفرع: يرى فرعه فقط، بلا مقارنة ولا زر تعطيل =====
{ const page=await ctx.newPage();
  await load(page,{user:{uid:'u_bm',email:'bm@dhtrd.com'},profile:BM,users:[OWNER,BM],config:CFG_BM,branches:[BR_A,BR_B],sessions:SESS});
  const central=await page.evaluate(()=>window.__brxIsCentral());
  await page.evaluate(()=>window.__brxLoad());
  const vis=await page.evaluate(()=>window.__brxVisible());
  ok('B7 مدير الفرع ليس مركزيًّا', central===false);
  ok('B7 يرى فرعه فقط (bA) لا كل الفروع', vis.length===1 && vis[0]==='bA', JSON.stringify(vis));
  await openBranches(page);
  const cards=await page.evaluate(()=>document.querySelectorAll('[data-brxcard]').length);
  const cmp=await has(page,'brxCompare');
  const toggle=await page.evaluate(()=>!!document.querySelector('[data-brxtoggle]'));
  ok('B7 بطاقة واحدة (فرعه) والمقارنة مخفيّة', cards===1 && cmp===false, `cards=${cards} cmp=${cmp}`);
  ok('B7 لا زر تعطيل فعّال (التعطيل مركزيّ) — [data-brxtoggle] غائب', toggle===false);
  // حتى لو استُدعي الحارس المركزي مباشرةً، يُرفض لغير المركزي
  const denied=await page.evaluate(()=>window.__brxSetActive('bA',false));
  ok('B7 محاولة التعطيل من غير المركزي مرفوضة', !!denied.err, JSON.stringify(denied));
  await page.close(); }

await browser.close();
let pass=0, fail=0;
for (const r of results){ console.log(`${r.pass?'✓':'✗'} ${r.n}${r.pass?'':'  << '+r.d}`); r.pass?pass++:fail++; }
console.log(`\nRECON ${pass}/${pass+fail} passed`);
process.exit(fail?1:0);
