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
  ok('P3 {date} = «اسم اليوم 20/07/2024» (بدء الجرد لا اليوم)', /^(الأحد|الاثنين|الثلاثاء|الأربعاء|الخميس|الجمعة|السبت) 20\/07\/2024$/.test(ctxv['{date}']), ctxv['{date}']);
  ok('P3 {dayName} اسم يوم بدء الجرد', /^(الأحد|الاثنين|الثلاثاء|الأربعاء|الخميس|الجمعة|السبت)$/.test(ctxv['{dayName}']), ctxv['{dayName}']);
  await page.close(); }

// ===== P7 — المحاضر الملخّصة بكتلة إجماليات عمودية (تصميم النموذج)؛ التقرير المفصّل بشرائح =====
{ const page=await ctx.newPage(); await load(page,{profile:OWNER,users:[OWNER],sessions:sess({status:'approved',signatories:SIG,approvedByName:'المالك'})}); await openR(page);
  const committee=await page.evaluate(()=>window.__buildReasonPrint('committee'));
  const handover=await page.evaluate(()=>window.__buildReasonPrint('handover'));
  const detailed=await page.evaluate(()=>window.__buildReasonPrint('detailed'));
  ok('P7 محضر الجرد: كتلة عمودية (#F3F6FC) لا شرائح', committee.includes('#F3F6FC')&&committee.includes('صافي قيمة الفروقات (الفارق)'), '');
  ok('P7 محضر الاستلام: كتلة عمودية', handover.includes('#F3F6FC'), '');
  ok('P7 التقرير المفصّل يبقى بالشرائح (لا كتلة عمودية)', !detailed.includes('#F3F6FC'), '');
  await page.close(); }

// ===== P8 — محرّر أعضاء اللجنة من شاشة التقرير (إدارة): حذف عضو ينعكس فورًا =====
{ const page=await ctx.newPage(); await load(page,{profile:OWNER,users:[OWNER],sessions:sess({status:'approved',signatories:SIG,approvedByName:'المالك'})}); await openR(page);
  const hasBtn=await page.evaluate(()=>window.__has('repSigBtn')&&window.__has('repSigPanel'));
  ok('P8 زر ولوحة أعضاء اللجنة على شاشة التقرير', hasBtn===true, '');
  await page.evaluate(()=>{ document.getElementById('repSigBtn').click(); }); await page.waitForTimeout(60);
  const rows0=await page.evaluate(()=>document.querySelectorAll('#repSigRows [data-i]').length);
  await page.evaluate(()=>{ const b=document.querySelector('#repSigRows .sigedit-x'); if(b)b.click(); }); await page.waitForTimeout(60);
  const rows1=await page.evaluate(()=>document.querySelectorAll('#repSigRows [data-i]').length);
  const printCells=await page.evaluate(()=>{ const h=window.__buildReasonPrint('committee'); return (h.match(/التوقيع:/g)||[]).length; });
  ok('P8 حذف عضو من الشاشة ينقص القائمة', rows0>=3&&rows1===rows0-1, rows0+'→'+rows1);
  ok('P8 وينعكس على المحضر فورًا', printCells===rows1+1/*+مسؤول الموقع*/, 'cells='+printCells+' rows='+rows1);
  await page.close(); }

// ===== P4 — محرّر أعضاء اللجنة: الحذف ينعكس على المحضر فورًا =====
{ const page=await ctx.newPage(); await load(page,{profile:OWNER,users:[OWNER],sessions:sess({status:'approved',signatories:SIG,approvedByName:'المالك'})}); await openR(page);
  const before=await page.evaluate(()=>{ const h=window.__buildReasonPrint('committee'); return (h.match(/التوقيع:/g)||[]).length; });
  const n0=await page.evaluate(()=>window.__repSigList().length);
  await page.evaluate(()=>{ window.__repSigList().splice(0,1); }); // حذف عضو واحد
  const after=await page.evaluate(()=>{ const h=window.__buildReasonPrint('committee'); return (h.match(/التوقيع:/g)||[]).length; });
  const n1=await page.evaluate(()=>window.__repSigList().length);
  ok('P4 قائمة الأعضاء 3 ثم 2 بعد الحذف', n0===3&&n1===2, n0+'→'+n1);
  ok('P4 خانات التوقيع تنقص فورًا في المحضر (حذف عضو = −1)', after===before-1&&before>=3, before+'→'+after);
  await page.close(); }

// ===== P5 — محضر الجرد يتضمن «مسؤول الفرع/المستودع» بمسمّى يتبع تسمية الموقع =====
{ const page=await ctx.newPage(); await load(page,{profile:OWNER,users:[OWNER],sessions:sess({status:'approved',signatories:SIG,approvedByName:'المالك',location:'مستودع الاثاث',responsible:{name:'ناصر'}})}); await openR(page);
  const h=await page.evaluate(()=>window.__buildReasonPrint('committee'));
  ok('P5 مستودع ⇒ «مسؤول المستودع» باسم المسؤول', h.includes('مسؤول المستودع')&&h.includes('ناصر'), '');
  await page.close(); }
{ const page=await ctx.newPage(); await load(page,{profile:OWNER,users:[OWNER],sessions:sess({status:'approved',signatories:SIG,approvedByName:'المالك',location:'فرع الرياض',custodyNext:{name:'سعد'}})}); await openR(page);
  const h=await page.evaluate(()=>window.__buildReasonPrint('committee'));
  ok('P5 فرع ⇒ «مسؤول الفرع» (يقبل السابق/الجديد اسمًا)', h.includes('مسؤول الفرع')&&h.includes('سعد'), '');
  const hc=await page.evaluate(()=>window.__buildReasonPrint('custody'));
  ok('P5 كتلة المسؤول خاصّة بمحضر الجرد فقط (لا العهدة)', !hc.includes('مسؤول الفرع / المستودع')&&!/مسؤول المستودع|مسؤول الفرع(?! )/.test(hc), '');
  await page.close(); }

// ===== P6 — محضر الجرد (بديل محضر الفروقات) لا يُفعَّل إلا بعد اعتماد الجرد =====
{ const page=await ctx.newPage(); await load(page,{profile:OWNER,users:[OWNER],sessions:sess({status:'review',signatories:SIG})}); // غير معتمدة
  await openR(page);
  const disB=await page.evaluate(()=>{ window.__reasonAvail('pr'); const e=document.getElementById('prCommittee'); return e?e.disabled:null; });
  ok('P6 قبل الاعتماد: زر محضر الجرد معطَّل', disB===true, 'disabled='+disB);
  await page.close(); }
{ const page=await ctx.newPage(); await load(page,{profile:OWNER,users:[OWNER],sessions:sess({status:'approved',approvedByName:'المالك',signatories:SIG})});
  await openR(page);
  const disA=await page.evaluate(()=>{ window.__reasonAvail('pr'); const e=document.getElementById('prCommittee'); return e?e.disabled:null; });
  ok('P6 بعد الاعتماد: زر محضر الجرد مُفعَّل', disA===false, 'disabled='+disA);
  await page.close(); }

await browser.close();
let pass=0; for(const r of results){ console.log((r.pass?'✓':'✗')+' '+r.n+(r.d&&!r.pass?('  << '+r.d):'')); if(r.pass)pass++; }
console.log(`\nRECON ${pass}/${results.length} ${pass===results.length?'passed':'FAILED'}`);
process.exit(pass===results.length?0:1);
