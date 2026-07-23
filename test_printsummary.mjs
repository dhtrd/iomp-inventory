// اختبارات م٦-٣: المحاضر الملخّصة (بلا جدول) + العهدة/المفصّل بجدول + متغيّرات الإجماليات على كامل الجرد + محرّر أعضاء اللجنة + {date}=بدء العد
import { chromium } from 'playwright-core';
import { execSync } from 'node:child_process';
import path from 'node:path';
execSync('node build_harness.js', { cwd: process.cwd(), stdio: 'inherit' });
const EXE = process.env.CHROME_EXE || '/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell';
const HARNESS = 'file://' + path.resolve('harness.html');
const b64 = (o) => Buffer.from(JSON.stringify(o), 'utf8').toString('base64');
const OWNER = { uid:'u_owner', email:'a2@dhtrd.com', name:'المالك', role:'مدير', active:true };
// أ,ب معدودان؛ ج غير معدود بقيمة دفترية 100 — لاختبار أن {totalCost} يشمل غير المعدود حتى في الاستلام (countedOnly سابقًا)
const ITEMS=[[{code:'A',name:'صنف أ',category:'ك',book:10,cost:10},{code:'B',name:'صنف ب',category:'ك',book:5,cost:20},{code:'C',name:'ج غير معدود',category:'ك',book:10,cost:10}]];
const COUNTS=[{code:'A',qty:12},{code:'B',qty:4}];
const SIG=[{title:'رئيس اللجنة',name:'صالح'},{title:'عضو اللجنة',name:'خالد'},{title:'عضو اللجنة',name:'ماجد'}];
const sess=(extra)=>[Object.assign({id:'sx',name:'جرد',location:'مستودع',itemCount:3,startedAt:{__ts:1721433600000},__chunks:ITEMS,__counts:COUNTS},extra)];
const results=[]; const ok=(n,c,d='')=>results.push({n,pass:!!c,d});
const browser=await chromium.launch({ executablePath:EXE, args:['--no-sandbox'] });
const ctx=await browser.newContext({ viewport:{width:1200,height:1600} });
async function load(page,sc){ await page.goto(HARNESS+'?s='+encodeURIComponent(b64(sc))); await page.waitForFunction('window.__ready===true',{timeout:9000}); await page.waitForTimeout(140); }
const openR=async(page)=>{ await page.evaluate(()=>window.__openReport('sx')); await page.waitForTimeout(450); };

// ===== P1 — المحاضر الملخّصة بلا جدول؛ العهدة/المفصّل بجدول =====
{ const page=await ctx.newPage(); await load(page,{profile:OWNER,users:[OWNER],sessions:sess({status:'approved',signatories:SIG,approvedByName:'المالك'})}); await openR(page);
  const H=async k=>page.evaluate(x=>window.__buildReasonPrint(x),k);
  const committee=await H('committee'), handover=await H('handover'), vsum=await H('varianceSummary'), custody=await H('custody'), detailed=await H('detailed');
  ok('P1 محضر لجنة الجرد بلا جدول', !committee.includes('<table'), '');
  ok('P1 محضر الاستلام بلا جدول', !handover.includes('<table'), '');
  ok('P1 محضر ملخّص الفروقات بلا جدول', !vsum.includes('<table'), '');
  ok('P1 محضر العهدة بجدول', custody.includes('<table'), '');
  ok('P1 التقرير المفصّل بجدول', detailed.includes('<table'), '');
  ok('P1 المحاضر الملخّصة تحتفظ بالإجماليات (مبلغ الزيادة) والتواقيع', committee.includes('مبلغ الزيادة')&&committee.includes('التوقيع'), '');
  await page.close(); }

// ===== P2 — الإجماليات على كامل الجرد: {totalCost} يشمل غير المعدود حتى في الاستلام =====
{ const page=await ctx.newPage(); await load(page,{profile:OWNER,users:[OWNER],
    config:{settings:{docTemplates:{handover:{intro:'الدفتري {totalCost} | الفعلي {totalActual}'}}}},
    sessions:sess({status:'approved',signatories:SIG,approvedByName:'المالك',custodyPrev:{name:'سعد'},custodyNext:{name:'فهد'}})}); await openR(page);
  const hand=await page.evaluate(()=>window.__buildReasonPrint('handover'));
  // bookVal الكامل = 10*10+5*20+10*10 = 300 (يشمل الصنف غير المعدود ج) ؛ countedVal = 12*10+4*20 = 200
  ok('P2 {totalCost} = 300 (كامل الجرد يشمل غير المعدود)', hand.includes('الدفتري 300'), (hand.match(/الدفتري[^|]*/)||[])[0]);
  ok('P2 {totalActual} = 200', hand.includes('الفعلي 200'), '');
  const ctxv=await page.evaluate(()=>window.__docVarCtx('handover'));
  ok('P2 {totalActual} token يعمل (ليس {totalAcq})', ctxv['{totalActual}']==='200', JSON.stringify(ctxv['{totalActual}']));
  ok('P2 مرادف {actualValue} يعمل', ctxv['{actualValue}']==='200', '');
  await page.close(); }

// ===== P3 — {date} = تاريخ بدء العد الفعلي =====
{ const page=await ctx.newPage(); await load(page,{profile:OWNER,users:[OWNER],sessions:sess({status:'approved',signatories:SIG,approvedByName:'المالك'})}); await openR(page);
  const ctxv=await page.evaluate(()=>window.__docVarCtx('committee'));
  ok('P3 {date} = 20/07/2024 (بدء العد، لا اليوم)', ctxv['{date}']==='20/07/2024', ctxv['{date}']);
  await page.close(); }

// ===== P4 — محرّر أعضاء اللجنة: الحذف ينعكس على المحضر فورًا =====
{ const page=await ctx.newPage(); await load(page,{profile:OWNER,users:[OWNER],sessions:sess({status:'approved',signatories:SIG,approvedByName:'المالك'})}); await openR(page);
  const before=await page.evaluate(()=>{ const h=window.__buildReasonPrint('committee'); return (h.match(/التوقيع:/g)||[]).length; });
  const n0=await page.evaluate(()=>window.__repSigList().length);
  await page.evaluate(()=>{ window.__repSigList().splice(0,1); }); // حذف عضو واحد
  const after=await page.evaluate(()=>{ const h=window.__buildReasonPrint('committee'); return (h.match(/التوقيع:/g)||[]).length; });
  const n1=await page.evaluate(()=>window.__repSigList().length);
  ok('P4 قائمة الأعضاء 3 ثم 2 بعد الحذف', n0===3&&n1===2, n0+'→'+n1);
  ok('P4 خانات التوقيع تنقص فورًا في المحضر (3→2)', before===3&&after===2, before+'→'+after);
  await page.close(); }

await browser.close();
let pass=0; for(const r of results){ console.log((r.pass?'✓':'✗')+' '+r.n+(r.d&&!r.pass?('  << '+r.d):'')); if(r.pass)pass++; }
console.log(`\nRECON ${pass}/${results.length} ${pass===results.length?'passed':'FAILED'}`);
process.exit(pass===results.length?0:1);
