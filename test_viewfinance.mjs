// اختبارات م٦ — حجب القيم المالية عن المطّلع + تقييد أسباب الطباعة/التصدير (قابلان للتخصيص دورًا وفردًا).
// م٦-١: صلاحية «القيم المالية في التقارير» (report.finance) — المطّلع افتراضيًّا كميات فقط في:
//   تقرير الفروقات (بلاطات/أعمدة/إجماليات) + الطباعة (أعمدة/شرائح/متغيّرات القوالب) + تصدير Excel + شاشة التقارير.
// م٦-٢: صلاحيات «مخرجات: <سبب>» (reason.*) — المطّلع افتراضيًّا «مراجعة الفرع» فقط، وبلا أي سبب يختفي الزرّان.
// طلب العميل الثابت: كميات المجرود لكل صنف (مثل 99916382) تبقى ظاهرة وقابلة للبحث دائمًا.
import { chromium } from 'playwright-core';
import { execSync } from 'node:child_process';
import path from 'node:path';
execSync('node build_harness.js', { cwd: process.cwd(), stdio: 'inherit' });
const EXE = process.env.CHROME_EXE || '/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell';
const HARNESS = 'file://' + path.resolve('harness.html');
const b64 = (o) => Buffer.from(JSON.stringify(o), 'utf8').toString('base64');
const OWNER={uid:'u_owner',email:'a2@dhtrd.com',name:'المالك',role:'مدير',active:true};
const VW={uid:'u_vw',email:'vw@dhtrd.com',name:'مطّلع الفرع',role:'مطّلع',active:true};
// جلسة معتمدة: 99916382 معدود 12 (زيادة +2)، A1 معدود 3 (عجز −2)، B1 غير معدود — بتكاليف لحساب القيم
const CH=[[{code:'99916382',name:'صنف المثال',category:'مواد',book:10,cost:4},
          {code:'A1',name:'صنف أ',category:'مواد',book:5,cost:2},
          {code:'B1',name:'صنف ب',category:'أدوات',book:2,cost:3}]];
const CN=[{code:'99916382',qty:12,entries:[{id:'e1',q:4,by:'u_ct',byName:'مجاهد الضيفي',at:1},{id:'e2',q:8,by:'u_ct',byName:'مجاهد الضيفي',at:2}]},
          {code:'A1',qty:3,entries:[{id:'e3',q:3,by:'u_ct',byName:'عدّاد آخر',at:3}]}];
const S1={id:'s1',name:'جرد الفرع',status:'approved',started:true,location:'فرع أ',itemCount:3,createdBy:'u_owner',__chunks:CH,__counts:CN};
const results=[]; const ok=(n,c,d='')=>results.push({n,pass:!!c,d});
const browser=await chromium.launch({ executablePath:EXE, args:['--no-sandbox'] });
const ctx=await browser.newContext({ viewport:{width:1100,height:1200} });
async function load(page,sc){ await page.addInitScript(()=>{ try{ localStorage.clear(); }catch(e){} window.print=()=>{}; });
  await page.goto(HARNESS+'?s='+encodeURIComponent(b64(sc))); await page.waitForFunction('window.__ready===true',{timeout:8000}); await page.waitForTimeout(200); }
async function openRep(page){ await page.evaluate(()=>window.__openReport('s1')); await page.waitForTimeout(450); }
async function openReports(page){ await page.evaluate(()=>window.__setTab('reports'));
  await page.waitForFunction('window.__repxReady&&window.__repxReady()===true',{timeout:9000}); await page.waitForTimeout(120); }
const ths=(page)=>page.evaluate(()=>[...document.querySelectorAll('#repTable thead th')].map(t=>t.textContent.replace(/[▲▼]/g,'').trim()));
const tilesTxt=(page)=>page.evaluate(()=>document.getElementById('repTiles').textContent);

// ===== F1 — المطّلع افتراضيًّا: تقرير كميات فقط، والبحث بكود الصنف يُظهر المجرود =====
{ const page=await ctx.newPage(); await load(page,{profile:VW,users:[OWNER,VW],sessions:[S1]});
  await openRep(page);
  const h=await ths(page);
  ok('F1 رؤوس الجدول كمّية بلا أي عمود مالي (+«من أضاف» الافتراضي للمطّلع)', h.length===8&&!h.includes('التكلفة')&&!h.includes('القيمة الدفترية')&&!h.includes('قيمة الفرق')&&h.includes('من أضاف'), JSON.stringify(h));
  ok('F1 أعمدة الكميات باقية (الدفتري/المعدود/الفرق)', h.includes('الدفتري')&&h.includes('المعدود')&&h.includes('الفرق'));
  const t=await tilesTxt(page);
  ok('F1 بلاطات القيم المالية محجوبة كليًّا', !t.includes('إجمالي القيمة الدفترية')&&!t.includes('إجمالي القيمة الفعلية')&&!t.includes('صافي قيمة الفروقات'), t.slice(0,120));
  ok('F1 بلاطات الكميات باقية (المعدود/عجز/زيادة)', t.includes('المعدود')&&t.includes('عجز')&&t.includes('زيادة'));
  const sr=await page.evaluate(()=>{ const s=document.getElementById('repSearch'); s.value='99916382'; s.oninput();
    const tr=document.querySelectorAll('#repTable tbody tr'); return {n:tr.length, counted:tr.length?tr[0].cells[4].textContent.trim():''}; });
  ok('F1 البحث بكود 99916382 يعرض المجرود له (12)', sr.n===1&&sr.counted==='12', JSON.stringify(sr));
  const tf=await page.evaluate(()=>{ const s=document.getElementById('repSearch'); s.value=''; s.oninput();
    const tds=document.querySelectorAll('#repTable tfoot td'); return {n:tds.length, txt:document.querySelector('#repTable tfoot').textContent}; });
  ok('F1 صفّ الإجماليات بلا خلايا قيم مالية (٦ خلايا مع «من أضاف») ولا يتضمن 56', tf.n===6&&!tf.txt.includes('56'), JSON.stringify(tf.n)+' '+tf.txt.slice(0,80));
  await page.close(); }

// ===== F12 — العدّات الفردية للمراجعة (طلب العميل): تفصيل كل عدّة في «من أضاف»، مفعّل افتراضيًّا للمطّلع =====
{ const page=await ctx.newPage(); await load(page,{profile:VW,users:[OWNER,VW],sessions:[S1]});
  await openRep(page);
  ok('F12 «من أضاف» مفعّل افتراضيًّا للمطّلع (لا يدخل شاشة العد)', await page.evaluate(()=>document.getElementById('repWho').checked===true));
  const row=await page.evaluate(()=>{ const s=document.getElementById('repSearch'); s.value='99916382'; s.oninput();
    const tr=document.querySelector('#repTable tbody tr'); return tr?tr.textContent:''; });
  ok('F12 عدّات الصنف 99916382 مفصّلة: مجاهد الضيفي: 12 (4 + 8)', row.includes('مجاهد الضيفي: 12')&&row.includes('(4 + 8)'), row.slice(-120));
  await page.close(); }
{ const page=await ctx.newPage(); await load(page,{profile:OWNER,users:[OWNER,VW],sessions:[S1]});
  await openRep(page);
  ok('F12 المدير: «من أضاف» يبقى غير مفعّل افتراضيًّا (لا تغيير عليه)', await page.evaluate(()=>document.getElementById('repWho').checked===false));
  const row=await page.evaluate(()=>{ const c=document.getElementById('repWho'); c.checked=true; c.onchange();
    const s=document.getElementById('repSearch'); s.value='99916382'; s.oninput();
    return document.querySelector('#repTable tbody tr').textContent; });
  ok('F12 وبتفعيله يرى التفصيل نفسه', row.includes('مجاهد الضيفي: 12')&&row.includes('(4 + 8)'), row.slice(-120));
  await page.close(); }
{ const page=await ctx.newPage(); await load(page,{profile:VW,users:[OWNER,VW],
    config:{users:{u_vw:{'reason.detailed':true}}},sessions:[S1]});
  await openRep(page);
  const a=await page.evaluate(()=>window.__detailedAoa());
  ok('F12 التصدير المفصّل يحمل تفصيل العدّات في «من أضاف»', a.detail[1][8].includes('مجاهد الضيفي: 12 (4 + 8)'), JSON.stringify(a.detail[1][8]));
  await page.close(); }

// ===== F2 — المالك: كل الأعمدة والبلاطات المالية كما هي (لا انحدار) =====
{ const page=await ctx.newPage(); await load(page,{profile:OWNER,users:[OWNER,VW],sessions:[S1]});
  await openRep(page);
  const h=await ths(page);
  ok('F2 المالك: ١١ عمودًا بينها التكلفة وقيمة الفرق', h.length===11&&h.includes('التكلفة')&&h.includes('قيمة الفرق'), JSON.stringify(h));
  const t=await tilesTxt(page);
  ok('F2 المالك: بلاطات القيم ظاهرة', t.includes('إجمالي القيمة الدفترية')&&t.includes('صافي قيمة الفروقات'));
  const tf=await page.evaluate(()=>document.querySelector('#repTable tfoot').textContent);
  ok('F2 المالك: إجمالي القيمة الدفترية (56) في صفّ الإجماليات', tf.includes('56'), tf.slice(0,120));
  await page.close(); }

// ===== F3 — نافذتا السبب للمطّلع: «مراجعة الفرع» فقط (والزرّان ظاهران) =====
{ const page=await ctx.newPage(); await load(page,{profile:VW,users:[OWNER,VW],sessions:[S1]});
  await openRep(page);
  ok('F3 زرا الطباعة والتصدير ظاهران (سبب واحد مسموح)', await page.evaluate(()=>window.__has('repPrint')&&window.__has('repXlsx')));
  const pv=await page.evaluate(()=>{ window.__openPrintDialog();
    return [...document.querySelectorAll('#printReasonModal [data-reason]')].filter(b=>b.style.display!=='none').map(b=>b.getAttribute('data-reason')); });
  ok('F3 الطباعة: «مراجعة الفرع» وحدها ظاهرة', pv.length===1&&pv[0]==='branch', JSON.stringify(pv));
  const xv=await page.evaluate(()=>{ window.__openExportDialog();
    return [...document.querySelectorAll('#exportReasonModal [data-xreason]')].filter(b=>b.style.display!=='none').map(b=>b.getAttribute('data-xreason')); });
  ok('F3 التصدير: «مراجعة الفرع» وحدها ظاهرة (رفع الجرد محجوب)', xv.length===1&&xv[0]==='branch'&&!xv.includes('upload'), JSON.stringify(xv));
  const ra=await page.evaluate(()=>({d:window.__reasonAllowed('detailed'),b:window.__reasonAllowed('branch'),list:window.__printReasonsAllowed()}));
  ok('F3 الصلاحيات: reason.branch مسموح وreason.detailed ممنوع', ra.b===true&&ra.d===false&&ra.list.length===1&&ra.list[0]==='branch', JSON.stringify(ra));
  await page.close(); }

// ===== F4 — مطبوعة المطّلع وحارس السبب الممنوع وأعمدة تصدير مرشّحة =====
{ const page=await ctx.newPage(); await load(page,{profile:VW,users:[OWNER,VW],sessions:[S1]});
  await openRep(page);
  const html=await page.evaluate(()=>window.__buildReasonPrint('branch'));
  ok('F4 مطبوعة «مراجعة الفرع»: كميات (12) بلا تكلفة ولا قيم', html.includes('الكمية الفعلية')&&html.includes('12')&&!html.includes('التكلفة')&&!html.includes('القيمة الدفترية'));
  const guard=await page.evaluate(()=>{ document.getElementById('repPrintArea').innerHTML='';
    window.__openPrintDialog(); const b=document.querySelector('#printReasonModal [data-reason="detailed"]'); if(b)b.click();
    return document.getElementById('repPrintArea').innerHTML.length; });
  ok('F4 حارس doPrint: سبب ممنوع لا يبني مطبوعة ولو نُقر برمجيًّا', guard===0, String(guard));
  const aoa=await page.evaluate(()=>window.__exportAoa('mgmt'));
  ok('F4 __exportAoa يرشّح الأعمدة المالية (كما مسار الإنتاج)', Array.isArray(aoa)&&!aoa[0].includes('القيمة الدفترية')&&!aoa[0].includes('قيمة الفرق')&&aoa[0].includes('المعدود'), JSON.stringify(aoa&&aoa[0]));
  await page.close(); }

// ===== F5 — التخصيص الفردي: منح المطّلع «القيم المالية» يعيد كل شيء =====
{ const page=await ctx.newPage(); await load(page,{profile:VW,users:[OWNER,VW],config:{users:{u_vw:{'report.finance':true}}},sessions:[S1]});
  await openRep(page);
  ok('F5 الاستثناء الفردي يفعّل canSeeFinance', await page.evaluate(()=>window.__canSeeFinance()===true));
  const h=await ths(page);
  ok('F5 الأعمدة المالية عادت كاملة (+«من أضاف» الافتراضي له)', h.length===12&&h.includes('التكلفة')&&h.includes('من أضاف'), JSON.stringify(h));
  ok('F5 بلاطات القيم عادت', (await tilesTxt(page)).includes('إجمالي القيمة الدفترية'));
  await page.close(); }

// ===== F6 — تخصيص الأسباب دورًا: أرى له السبب الذي أريد (مثلاً «تقرير للإدارة» بدل «مراجعة الفرع») =====
{ const page=await ctx.newPage(); await load(page,{profile:VW,users:[OWNER,VW],
    config:{roles:{'مطّلع':{'reason.branch':false,'reason.mgmt':true}}},sessions:[S1]});
  await openRep(page);
  const pv=await page.evaluate(()=>{ window.__openPrintDialog();
    return [...document.querySelectorAll('#printReasonModal [data-reason]')].filter(b=>b.style.display!=='none').map(b=>b.getAttribute('data-reason')); });
  ok('F6 تخصيص الدور: «تقرير للإدارة» وحده ظاهر في الطباعة', pv.length===1&&pv[0]==='mgmt', JSON.stringify(pv));
  const xv=await page.evaluate(()=>{ window.__openExportDialog();
    return [...document.querySelectorAll('#exportReasonModal [data-xreason]')].filter(b=>b.style.display!=='none').map(b=>b.getAttribute('data-xreason')); });
  ok('F6 وفي التصدير كذلك', xv.length===1&&xv[0]==='mgmt', JSON.stringify(xv));
  const html=await page.evaluate(()=>window.__buildReasonPrint('mgmt'));
  ok('F6 مطبوعة سبب فيه قيم + بلا صلاحية مالية ⇒ تُرشَّح أعمدته وشرائحه المالية', html.includes('المعدود')&&!html.includes('القيمة الدفترية')&&!html.includes('صافي الفرق'), '');
  await page.close(); }

// ===== F7 — بلا أي سبب مسموح: الزرّان يختفيان تمامًا =====
{ const page=await ctx.newPage(); await load(page,{profile:VW,users:[OWNER,VW],
    config:{users:{u_vw:{'reason.branch':false}}},sessions:[S1]});
  await openRep(page);
  ok('F7 لا زرّ طباعة ولا تصدير حين لا سبب مسموحًا', await page.evaluate(()=>!window.__has('repPrint')&&!window.__has('repXlsx')));
  ok('F7 printReasonsAllowed فارغة', await page.evaluate(()=>window.__printReasonsAllowed().length===0&&window.__exportReasonsAllowed().length===0));
  await page.close(); }

// ===== F8 — متغيّرات القوالب المالية تُستبدل بـ«—» للمحجوب عنه =====
{ const page=await ctx.newPage(); await load(page,{profile:VW,users:[OWNER,VW],sessions:[S1]});
  await openRep(page);
  const v=await page.evaluate(()=>window.__docSubst('{netVar}|{totalCost}|{totalActual}|{onHand}','committee'));
  ok('F8 المطّلع: {netVar}/{totalCost}/{totalActual}=— و{onHand} كمية تبقى', /^—\|—\|—\|\d/.test(v), v);
  await page.close(); }
{ const page=await ctx.newPage(); await load(page,{profile:OWNER,users:[OWNER,VW],sessions:[S1]});
  await openRep(page);
  const v=await page.evaluate(()=>window.__docSubst('{netVar}|{totalCost}','committee'));
  ok('F8 المالك: المتغيّرات المالية أرقام لا «—»', v.split('|').every(x=>x!=='—'&&x!==''), v);
  await page.close(); }

// ===== F9 — التصدير المفصّل (ورقتان): بلا مالية تُحذف أعمدة القيم من الورقتين =====
{ const page=await ctx.newPage(); await load(page,{profile:VW,users:[OWNER,VW],
    config:{users:{u_vw:{'reason.detailed':true}}},sessions:[S1]});
  await openRep(page);
  const a=await page.evaluate(()=>window.__detailedAoa());
  ok('F9 ورقة التفاصيل ١٠ أعمدة بلا تكلفة/قيم', a.detail[0].length===10&&!a.detail[0].includes('التكلفة')&&!a.detail[0].includes('قيمة الفرق'), JSON.stringify(a.detail[0]));
  ok('F9 ورقة الملخّص ٣ أعمدة عددية فقط', a.summary[0].length===3&&a.summary[0][0]==='الفئة'&&!JSON.stringify(a.summary[0]).includes('قيمة'), JSON.stringify(a.summary[0]));
  ok('F9 صفّ الإجماليات كميات صحيحة (دفتري 17) دون خلايا قيم', a.detail[a.detail.length-1][4]===17&&a.detail[a.detail.length-1].length===10, JSON.stringify(a.detail[a.detail.length-1]));
  await page.close(); }
{ const page=await ctx.newPage(); await load(page,{profile:OWNER,users:[OWNER,VW],sessions:[S1]});
  await openRep(page);
  const a=await page.evaluate(()=>window.__detailedAoa());
  ok('F9 المالك: ١٤ عمودًا كما كانت (لا انحدار)', a.detail[0].length===14&&a.detail[0].includes('التكلفة')&&a.summary[0].length===6, JSON.stringify(a.detail[0]).slice(0,120));
  await page.close(); }

// ===== F10 — شاشة التقارير للمطّلع: كميات بلا قيم، وبطاقة الصنف تُظهر المجرود =====
{ const page=await ctx.newPage(); await load(page,{profile:VW,users:[OWNER,VW],sessions:[S1]});
  await openReports(page);
  const td=await page.evaluate(()=>({e:window.__repxTableData('executive').head, s:window.__repxTableData('sessions').head, a:window.__repxTableData('abc').head}));
  ok('F10 بيانات التنفيذي بلا «القيمة/٪»', td.e.length===2&&td.e[0]==='الفئة'&&!td.e.includes('القيمة'), JSON.stringify(td.e));
  ok('F10 تقرير الجلسات بلا «صافي الفروقات» وABC بلا قيم', !td.s.includes('صافي الفروقات')&&!td.a.includes('القيمة')&&td.a.includes('التصنيف'), JSON.stringify(td.s)+JSON.stringify(td.a));
  const csv=await page.evaluate(()=>window.__repxCsv('executive').split('\r\n')[0]);
  ok('F10 CSV التنفيذي بلا عمود القيمة', !csv.includes('القيمة'), csv);
  await page.evaluate(()=>{ const b=document.querySelector('[data-repx="executive"]'); if(b)b.click(); }); await page.waitForTimeout(200);
  const ind=await page.evaluate(()=>document.getElementById('repxInd').textContent);
  ok('F10 مؤشّرات التنفيذي بلا «قيمة المخزون»', !ind.includes('قيمة المخزون')&&ind.includes('أصناف مشمولة'), ind.slice(0,80));
  const card=await page.evaluate(async()=>{ const c=document.querySelector('[data-repxcat]'); if(c)c.click();
    await new Promise(r=>setTimeout(r,150)); const it=document.querySelector('[data-repxitem="99916382"]'); if(it)it.click();
    await new Promise(r=>setTimeout(r,150)); return document.getElementById('repxContent').textContent; });
  ok('F10 بطاقة الصنف 99916382: «المعدود 12» ظاهر والتكلفة والقيمة محجوبتان', card.includes('المعدود')&&card.includes('12')&&!card.includes('التكلفة')&&!card.includes('القيمة'), card.slice(0,140));
  await page.close(); }
{ const page=await ctx.newPage(); await load(page,{profile:OWNER,users:[OWNER,VW],sessions:[S1]});
  await openReports(page);
  const td=await page.evaluate(()=>window.__repxTableData('executive').head);
  ok('F10 المالك: بيانات التنفيذي كاملة (٤ أعمدة)', td.length===4&&td.includes('القيمة'), JSON.stringify(td));
  await page.evaluate(()=>{ const b=document.querySelector('[data-repx="executive"]'); if(b)b.click(); }); await page.waitForTimeout(200);
  ok('F10 المالك: «قيمة المخزون» ظاهرة', await page.evaluate(()=>document.getElementById('repxInd').textContent.includes('قيمة المخزون')));
  await page.close(); }

// ===== F11 — لوحة الصلاحيات: الافتراضيات الجديدة ظاهرة قابلة للتخصيص =====
{ const page=await ctx.newPage(); await load(page,{profile:OWNER,users:[OWNER,VW]});
  await page.evaluate(()=>window.__setTab('settings')); await page.waitForTimeout(500);
  const m=await page.evaluate(()=>{ const g=(r,c)=>{ const x=document.querySelector('.rcap[data-role="'+r+'"][data-cap="'+c+'"]'); return x?x.checked:null; };
    return { vf:g('مطّلع','report.finance'), vb:g('مطّلع','reason.branch'), vd:g('مطّلع','reason.detailed'), mf:g('مدير','report.finance'), wf:g('مدير مخزون','report.finance'), wu:g('مدير مخزون','reason.upload') }; });
  ok('F11 المصفوفة: مطّلع بلا مالية ومعه «مراجعة الفرع» فقط', m.vf===false&&m.vb===true&&m.vd===false, JSON.stringify(m));
  ok('F11 المدير ومدير المخزون: مالية وكل الأسباب', m.mf===true&&m.wf===true&&m.wu===true, JSON.stringify(m));
  await page.close(); }

await browser.close();
let pass=0; for(const r of results){ console.log((r.pass?'✓':'✗')+' '+r.n+(r.d&&!r.pass?('  << '+r.d):'')); if(r.pass)pass++; }
console.log(`\nRECON ${pass}/${results.length} ${pass===results.length?'passed':'FAILED'}`);
process.exit(pass===results.length?0:1);
