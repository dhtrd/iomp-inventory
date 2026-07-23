// اختبارات: الموقّعون في بداية الجلسة (مسمى+اسم) + المحاضر الجديدة (ملخّص الفروقات/استلام مخزون/عهدة) + تصدير إكسل مُرشَّح.
import { chromium } from 'playwright-core';
import { execSync } from 'node:child_process';
import path from 'node:path';
execSync('node build_harness.js', { cwd: process.cwd(), stdio: 'inherit' });
const EXE = process.env.CHROME_EXE || '/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell';
const HARNESS = 'file://' + path.resolve('harness.html');
const b64 = (o) => Buffer.from(JSON.stringify(o), 'utf8').toString('base64');
const OWNER = { uid:'u_owner', email:'a2@dhtrd.com', name:'المالك', role:'مدير', active:true };
const EXI=[[{code:'A',name:'صنف أ',category:'ك',book:10,cost:2},{code:'B',name:'صنف ب',category:'ك',book:5,cost:1},{code:'C',name:'صنف ج',category:'ك',book:8,cost:1}]];
const EXC=[{code:'A',qty:12},{code:'B',qty:5}]; // أ: فرق +٢ ومعدود، ب: معدود بلا فرق، ج: غير معدود
const SIG=[{title:'مدير الجرد',name:'أحمد'},{title:'مدير المستودع',name:'خالد'}];
const sess=(extra)=>[Object.assign({id:'sx',name:'جرد اللجنة',location:'فرع أ',itemCount:3,__chunks:EXI,__counts:EXC},extra)];
const results=[]; const ok=(n,c,d='')=>results.push({n,pass:!!c,d});
const browser=await chromium.launch({ executablePath:EXE, args:['--no-sandbox'] });
const ctx=await browser.newContext({ viewport:{width:1200,height:1600} });
async function load(page,sc){ await page.goto(HARNESS+'?s='+encodeURIComponent(b64(sc))); await page.waitForFunction('window.__ready===true',{timeout:8000}); await page.waitForTimeout(120); }

// ===== M1 — sessSigCollect يُسقط الصفوف الفارغة =====
{ const page=await ctx.newPage(); await load(page,{profile:OWNER,users:[OWNER]});
  const r=await page.evaluate(()=>{ window.__setSessSig([{title:'أ',name:''},{title:'',name:''},{title:'',name:'ب'}]); return window.__sessSigCollect(); });
  ok('M1 يُسقِط الصفوف الفارغة (يبقى ذو المسمى أو الاسم)', Array.isArray(r)&&r.length===2&&r[0].title==='أ'&&r[1].name==='ب', JSON.stringify(r));
  await page.close(); }

// ===== M2 — sigRoster من المسمّيات الافتراضية / لجنة الافتراض =====
{ const page=await ctx.newPage(); await load(page,{profile:OWNER,users:[OWNER],config:{settings:{signatoryDefaults:[{title:'مدير الجرد'},{title:'المدير المالي'}]}}});
  const r=await page.evaluate(()=>window.__sigRoster());
  ok('M2 sigRoster يعكس المسمّيات الافتراضية (بأسماء فارغة)', r.length===2&&r[0].title==='مدير الجرد'&&r[0].name==='', JSON.stringify(r));
  await page.close(); }
{ const page=await ctx.newPage(); await load(page,{profile:OWNER,users:[OWNER]});
  const r=await page.evaluate(()=>window.__sigRoster());
  ok('M2 دون إعداد ⇒ لجنة ثلاثية افتراضية', r.length===3&&r[0].title==='رئيس اللجنة', JSON.stringify(r));
  await page.close(); }

// ===== M3 — createSession يُخزّن الموقّعين والمسؤول السابق/الجديد على الجلسة =====
{ const page=await ctx.newPage(); await load(page,{profile:OWNER,users:[OWNER]});
  await page.evaluate(()=>window.__setTab('sessions')); await page.waitForTimeout(250);
  const hasUI=await page.evaluate(()=>window.__has('sessSigRows')&&window.__has('s_custPrev')&&window.__has('s_custNext'));
  await page.evaluate(()=>{ const t=document.querySelectorAll('#sessSigRows .ssig-t'), n=document.querySelectorAll('#sessSigRows .ssig-n');
    if(t[0]){t[0].value='مدير الجرد'; t[0].dispatchEvent(new Event('input'));} if(n[0]){n[0].value='أحمد'; n[0].dispatchEvent(new Event('input'));}
    document.getElementById('s_name').value='جلسة اختبار'; document.getElementById('s_custPrev').value='سعد'; document.getElementById('s_custNext').value='فهد'; });
  await page.evaluate(()=>{ const h=document.getElementById('s_ho'); if(h)h.checked=true; }); await page.evaluate(()=>window.__createSession()); await page.waitForTimeout(300);
  const created=await page.evaluate(()=>{ const st=window.__store; for(const k in st){ if(k.indexOf('sessions/')===0 && st[k] && st[k].name==='جلسة اختبار') return st[k]; } return null; });
  ok('M3 نموذج الموقّعين وحقلا المسؤول ظاهرة في بدء الجلسة', hasUI===true);
  ok('M3 الجلسة تُخزّن الموقّع (مدير الجرد/أحمد)', created&&Array.isArray(created.signatories)&&created.signatories.some(s=>s.title==='مدير الجرد'&&s.name==='أحمد'), JSON.stringify(created&&created.signatories));
  ok('M3 الجلسة تُخزّن المُسلِّم/المُستلِم', created&&created.custodyPrev&&created.custodyPrev.name==='سعد'&&created.custodyNext&&created.custodyNext.name==='فهد', JSON.stringify(created&&{p:created.custodyPrev,n:created.custodyNext}));
  await page.close(); }

// ===== M4 — docSignatories يُفضّل موقّعي الجلسة (مسمى+اسم) =====
{ const page=await ctx.newPage(); await load(page,{profile:OWNER,users:[OWNER],sessions:sess({status:'approved',signatories:SIG,approvedByName:'المالك'})});
  await page.evaluate(()=>window.__openReport('sx')); await page.waitForTimeout(450);
  const s=await page.evaluate(()=>window.__docSignatories());
  ok('M4 التواقيع من الجلسة (مسمى+اسم)', s.length===2&&s[0].label==='مدير الجرد'&&s[0].name==='أحمد'&&s[1].name==='خالد', JSON.stringify(s));
  await page.close(); }

// ===== M5 — محضر ملخّص الفروقات: صفوف الفرق فقط + أسماء موقّعي الجلسة =====
{ const page=await ctx.newPage(); await load(page,{profile:OWNER,users:[OWNER],sessions:sess({status:'approved',signatories:SIG,approvedByName:'المالك'})});
  await page.evaluate(()=>window.__openReport('sx')); await page.waitForTimeout(450);
  const html=await page.evaluate(()=>{ try{ return window.__buildReasonPrint('varianceSummary'); }catch(e){ return 'ERR:'+e.message; } });
  ok('M5 ملخّص الفروقات: محضر ملخّص كتابي بلا جدول أصناف', !html.includes('<table') && html.includes('صافي'), (html||'').slice(0,50));
  ok('M5 يتضمّن أسماء ومسمّيات موقّعي الجلسة', html.includes('أحمد')&&html.includes('خالد')&&html.includes('مدير الجرد'), 'sigs');
  await page.close(); }

// ===== M6 — محضر استلام مخزون: المعدود فقط + كتلتا المُسلِّم/المُستلِم =====
{ const page=await ctx.newPage(); await load(page,{profile:OWNER,users:[OWNER],sessions:sess({status:'approved',signatories:SIG,custodyPrev:{name:'سعد'},custodyNext:{name:'فهد'}})});
  await page.evaluate(()=>window.__openReport('sx')); await page.waitForTimeout(450);
  const html=await page.evaluate(()=>{ try{ return window.__buildReasonPrint('handover'); }catch(e){ return 'ERR:'+e.message; } });
  ok('M6 الاستلام: محضر ملخّص كتابي بلا جدول أصناف', !html.includes('<table'), (html||'').slice(0,50));
  ok('M6 كتلتا المُسلِّم/المُستلِم بالأسماء', html.includes('المُسلِّم')&&html.includes('سعد')&&html.includes('المُستلِم')&&html.includes('فهد'), 'custody');
  await page.close(); }

// ===== M7 — إتاحة المحاضر المشروطة في نافذة الطباعة =====
{ const page=await ctx.newPage(); await load(page,{profile:OWNER,users:[OWNER],sessions:sess({status:'approved',signatories:SIG,custodyPrev:{name:'سعد'},custodyNext:{name:'فهد'}})});
  await page.evaluate(()=>window.__openReport('sx')); await page.waitForTimeout(450);
  await page.evaluate(()=>window.__openPrintDialog()); await page.waitForTimeout(120);
  const d=await page.evaluate(()=>({vs:window.__disp('prVarSum'),ho:window.__disp('prHandover')}));
  ok('M7 بعد الاعتماد ومع المُسلِّم/المُستلِم ⇒ الزرّان ظاهران', d.vs!=='none'&&d.ho!=='none', JSON.stringify(d));
  await page.close(); }
{ const page=await ctx.newPage(); await load(page,{profile:OWNER,users:[OWNER],sessions:sess({status:'open'})});
  await page.evaluate(()=>window.__openReport('sx')); await page.waitForTimeout(450);
  await page.evaluate(()=>window.__openPrintDialog()); await page.waitForTimeout(120);
  const d=await page.evaluate(()=>({vsD:document.getElementById('prVarSum').disabled,hoD:document.getElementById('prHandover').disabled,
    why:(document.getElementById('prVarSum').title||'')+(document.getElementById('prHandover').title||'')}));
  ok('M7 دون اعتماد ولا استلام ⇒ الزرّان ظاهران معطَّلين مع سبب واضح', d.vsD===true&&d.hoD===true&&d.why.includes('يتاح'), JSON.stringify(d));
  await page.close(); }

// ===== M8 — تصدير إكسل مُرشَّح حسب السبب =====
{ const page=await ctx.newPage(); await load(page,{profile:OWNER,users:[OWNER],sessions:sess({status:'approved',signatories:SIG,custodyPrev:{name:'سعد'},custodyNext:{name:'فهد'}})});
  await page.evaluate(()=>window.__openReport('sx')); await page.waitForTimeout(450);
  const va=await page.evaluate(()=>JSON.stringify(window.__exportAoa('varianceSummary')));
  const ha=await page.evaluate(()=>JSON.stringify(window.__exportAoa('handover')));
  ok('M8 تصدير ملخّص الفروقات: صفوف الفرق فقط', va.includes('صنف أ')&&!va.includes('صنف ب')&&!va.includes('صنف ج'), va.slice(0,60));
  ok('M8 تصدير الاستلام: المعدود فقط (أ،ب)', ha.includes('صنف أ')&&ha.includes('صنف ب')&&!ha.includes('صنف ج'), ha.slice(0,60));
  await page.close(); }

// ===== M9 — تصدير إكسل للتقارير (repx) يبني ترويسة+صفوفًا =====
{ const page=await ctx.newPage(); await load(page,{profile:OWNER,users:[OWNER]});
  const aoa=await page.evaluate(()=>{ try{ return window.__repxXlsxAoa('executive'); }catch(e){ return null; } });
  ok('M9 repx: مصفوفة إكسل بترويسة أعمدة', Array.isArray(aoa)&&aoa.length>=1&&Array.isArray(aoa[0])&&aoa[0].indexOf('الفئة')>=0, JSON.stringify(aoa&&aoa[0]));
  await page.close(); }

await browser.close();
let pass=0; for(const r of results){ console.log((r.pass?'✓':'✗')+' '+r.n+(r.d&&!r.pass?('  << '+r.d):'')); if(r.pass)pass++; }
console.log(`\nRECON ${pass}/${results.length} ${pass===results.length?'passed':'FAILED'}`);
process.exit(pass===results.length?0:1);
