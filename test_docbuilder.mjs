// اختبارات المحطّة ٤ (مُنشئ المستندات الرسمية) — قوالب المحاضر القابلة للتحرير بمتغيّرات نائبة.
import { chromium } from 'playwright-core';
import { execSync } from 'node:child_process';
import path from 'node:path';
execSync('node build_harness.js', { cwd: process.cwd(), stdio: 'inherit' });
const EXE = process.env.CHROME_EXE || '/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell';
const HARNESS = 'file://' + path.resolve('harness.html');
const b64 = (o) => Buffer.from(JSON.stringify(o), 'utf8').toString('base64');
const OWNER = { uid:'u_owner', email:'a2@dhtrd.com', name:'المالك', role:'مدير', active:true };
const EXI=[[{code:'A',name:'صنف أ',category:'ك',book:10,cost:2},{code:'B',name:'صنف ب',category:'ك',book:5,cost:1}]];
const EXC=[{code:'A',qty:12}];
const results=[]; const ok=(n,c,d='')=>results.push({n,pass:!!c,d});
const browser=await chromium.launch({ executablePath:EXE, args:['--no-sandbox'] });
const ctx=await browser.newContext({ viewport:{width:1200,height:1500} });
async function load(page,sc){ await page.goto(HARNESS+'?s='+encodeURIComponent(b64(sc))); await page.waitForFunction('window.__ready===true',{timeout:8000}); await page.waitForTimeout(120); }

// ===== DB1 — استبدال المتغيّرات والقالب الافتراضي =====
{ const page=await ctx.newPage(); await load(page,{profile:OWNER,users:[OWNER]});
  const sub=await page.evaluate(()=>window.__docSubst('من {company} — مستند {document}','committee'));
  ok('DB1 docSubst يستبدل {company} و{document}', sub.indexOf('شركة الضبيبي التجارية')>=0 && sub.indexOf('محضر لجنة الجرد')>=0, sub);
  const t=await page.evaluate(()=>window.__docTemplate('committee'));
  ok('DB1 القالب الافتراضي فارغ (بلا تخصيص ⇒ سلوك اليوم)', t && !t.title && !t.intro, JSON.stringify(t));
  await page.close(); }

// ===== DB2 — حفظ قالب من الواجهة يُثبِّت في settings.docTemplates =====
{ const page=await ctx.newPage(); await load(page,{profile:OWNER,users:[OWNER]});
  await page.evaluate(()=>window.__setTab('admin')); await page.waitForTimeout(200);
  const has=await page.evaluate(()=>window.__has('dtReason')&&window.__has('dtIntro')&&window.__has('acSaveDocTpl'));
  await page.evaluate(()=>{ document.getElementById('dtReason').value='detailed'; document.getElementById('dtTitle').value='تقرير مفصّل — {session}'; document.getElementById('dtIntro').value='بتاريخ {date}.'; document.getElementById('dtClauses').value='بند أول\nبند ثانٍ'; });
  await page.evaluate(()=>window.__acSaveDocTpl()); await page.waitForTimeout(200);
  const saved=await page.evaluate(()=>{ const s=window.__store['config/permissions'].settings; return s.docTemplates&&s.docTemplates.detailed; });
  ok('DB2 بطاقة مُنشئ المستندات ظاهرة', has===true);
  ok('DB2 القالب حُفظ (عنوان/تمهيد/فقرتان)', saved && saved.title==='تقرير مفصّل — {session}' && saved.intro==='بتاريخ {date}.' && Array.isArray(saved.clauses) && saved.clauses.length===2, JSON.stringify(saved));
  await page.close(); }

// ===== DB3 — الطباعة تُظهر عنوان/تمهيد/فقرات القالب بمتغيّرات مُستبدَلة =====
{ const page=await ctx.newPage(); await load(page,{profile:OWNER,users:[OWNER],
    config:{settings:{docTemplates:{committee:{title:'محضر جرد — {session}', intro:'في يوم {date} جُرد {location}.', clauses:['المعدود: {counted}.','صافي الفروقات: {netVar}.']}}}},
    sessions:[{id:'sx',name:'جرد اللجنة',status:'approved',location:'فرع أ',itemCount:2,approvedByName:'المالك',__chunks:EXI,__counts:EXC}]});
  await page.evaluate(()=>window.__openReport('sx')); await page.waitForTimeout(450);
  const html=await page.evaluate(()=>{ try{ return window.__buildReasonPrint('committee'); }catch(e){ return 'ERR:'+e.message; } });
  ok('DB3 عنوان القالب مُستبدَل ({session})', html.indexOf('محضر جرد — جرد اللجنة')>=0, html.slice(0,140));
  ok('DB3 التمهيد والفقرات مُستبدَلة وظاهرة (قائمة مرقّمة)', html.indexOf('جُرد فرع أ')>=0 && html.indexOf('المعدود: 1')>=0 && html.indexOf('<ol')>=0, 'intro/clauses');
  await page.close(); }

// ===== DB4 — المتغيّرات الجديدة: اللجنة/المسؤولان/الإجماليات تُستبدَل ولا يبقى نائب خام =====
{ const page=await ctx.newPage(); await load(page,{profile:OWNER,users:[OWNER],
    config:{settings:{signatories:[{key:'inv_mgr',label:'مدير الجرد'},{key:'gm',label:'المدير العام'}]}},
    sessions:[{id:'sh',name:'جرد تسليم',status:'approved',location:'فرع أ',itemCount:2,approvedByName:'المالك',
      custodyPrev:{name:'سالم',title:'أمين سابق'},custodyNext:{name:'ماجد',title:'أمين جديد'},__chunks:EXI,__counts:EXC}]});
  await page.evaluate(()=>window.__openReport('sh')); await page.waitForTimeout(450);
  const sub=await page.evaluate(()=>window.__docSubst('لجنة: {committee} | جديد: {newResp} | سابق: {oldResp} | تكلفة: {totalCost} | فعلي: {totalActual} | يد: {onHand} | فرع: {branchMgr}','committee'));
  ok('DB4 اللجنة من الموقّعين المعتمدين', sub.includes('مدير الجرد، المدير العام'), sub);
  ok('DB4 المسؤولان الجديد/السابق بالاسم والمسمى', sub.includes('ماجد — أمين جديد')&&sub.includes('سالم — أمين سابق'), sub);
  ok('DB4 لا نائب خام متبقٍّ + الإجماليات أرقام', !/\{[a-zA-Z]+\}/.test(sub), sub);
  await page.close(); }

// ===== DB5 — المحضران الملخّصان منفصلان وبموقّعي الجلسة المسجّلين (مسمى+اسم) =====
{ const page=await ctx.newPage(); await load(page,{profile:OWNER,users:[OWNER],
    sessions:[{id:'sv',name:'جرد التسليم',status:'approved',location:'فرع أ',itemCount:2,approvedByName:'المالك',
      signatories:[{title:'رئيس لجنة الجرد',name:'خالد العتيبي'},{title:'عضو اللجنة',name:'نورة السالم'}],
      custodyPrev:{name:'سالم',title:'أمين سابق'},custodyNext:{name:'ماجد',title:'أمين جديد'},__chunks:EXI,__counts:EXC}]});
  await page.evaluate(()=>window.__openReport('sv')); await page.waitForTimeout(450);
  const v=await page.evaluate(()=>window.__buildReasonPrint('varianceSummary'));
  const h=await page.evaluate(()=>window.__buildReasonPrint('handover'));
  ok('DB5 محضر ملخّص الفروقات مستقل وبعنوانه', v.includes('محضر ملخّص الفروقات')&&!v.includes('محضر استلام مخزون'), '');
  ok('DB5 محضر الاستلام مستقل وفيه المسلِّم/المستلِم', h.includes('محضر استلام مخزون')&&h.includes('سالم')&&h.includes('ماجد'), '');
  ok('DB5 كلاهما يوقَّع بموقّعي الجلسة المسجّلين (اسم+مسمى)', v.includes('خالد العتيبي')&&v.includes('رئيس لجنة الجرد')&&h.includes('نورة السالم'), '');
  const c=await page.evaluate(()=>window.__docSubst('{committee}','committee'));
  ok('DB5 متغيّر {committee} يعرض المسجّلين بالجلسة (مسمى: اسم)', c.includes('رئيس لجنة الجرد: خالد العتيبي'), c);
  await page.close(); }

// ===== DB6 — {branchMgr} = مسؤول الموقع المسجَّل إلزاميًّا بالجلسة (رأي العميل — بلا قسم الفروع) =====
{ const page=await ctx.newPage(); await load(page,{profile:OWNER,users:[OWNER],
    sessions:[{id:'sb',name:'جرد الموقع',status:'approved',location:'فرع أ',itemCount:2,approvedByName:'المالك',
      responsible:{name:'ماجد الدوسري'},__chunks:EXI,__counts:EXC}]});
  await page.evaluate(()=>window.__openReport('sb')); await page.waitForTimeout(450);
  const sub=await page.evaluate(()=>window.__docSubst('مسؤول الموقع: {branchMgr}','committee'));
  ok('DB6 {branchMgr} يطبع مسؤول الفرع/المستودع المسجَّل بالجلسة', sub.includes('ماجد الدوسري'), sub);
  await page.close(); }

// ===== DB7 — الأصناف اليدوية تدخل التقرير: بلاطة «خارج الدفتر»، حالة، محضر (طلب العميل) =====
{ const page=await ctx.newPage(); await load(page,{profile:OWNER,users:[OWNER],
    sessions:[{id:'sx7',name:'جرد بيدوي',status:'approved',location:'فرع أ',itemCount:1,approvedByName:'المالك',
      __chunks:[[{code:'A1',name:'صنف دفتري',category:'ك',book:5,cost:2}]],
      __counts:[{code:'A1',qty:5},{code:'MX1',qty:2,entries:[{by:'مجاهد',qty:2}]}],
      __extras:[{code:'MX1',name:'رف يدوي',category:'ك',cost:5}]}]});
  await page.evaluate(()=>window.__openReport('sx7')); await page.waitForTimeout(500);
  const html=await page.evaluate(()=>window.__contentHtml());
  ok('DB7 الصنف اليدوي ظاهر في صفوف التقرير', html.includes('رف يدوي')&&html.includes('زيادة خارج الدفتر'), '');
  ok('DB7 بلاطة «خارج الدفتر» تعدّ اليدوي', /خارج الدفتر/.test(html), '');
  const pr=await page.evaluate(()=>{ try{ return window.__buildReasonPrint('committee'); }catch(e){ return 'ERR:'+e.message; } });
  ok('DB7 المحضر المطبوع يتضمن اليدوي وشريحة خارج الدفتر', pr.includes('رف يدوي')&&pr.includes('خارج الدفتر'), pr.slice(0,80));
  await page.close(); }

await browser.close();
let pass=0; for(const r of results){ console.log((r.pass?'✓':'✗')+' '+r.n+(r.d&&!r.pass?('  << '+r.d):'')); if(r.pass)pass++; }
console.log(`\nRECON ${pass}/${results.length} ${pass===results.length?'passed':'FAILED'}`);
process.exit(pass===results.length?0:1);
