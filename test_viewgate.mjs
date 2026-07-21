// اختبارات: إعداد «الاطلاع بعد الإغلاق فقط» (viewersAfterClose) + تثبيت كلمة المرور من المدير.
import { chromium } from 'playwright-core';
import { execSync } from 'node:child_process';
import path from 'node:path';
execSync('node build_harness.js', { cwd: process.cwd(), stdio: 'inherit' });
const EXE = process.env.CHROME_EXE || '/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell';
const HARNESS = 'file://' + path.resolve('harness.html');
const b64 = (o) => Buffer.from(JSON.stringify(o), 'utf8').toString('base64');
const OWNER={uid:'u_owner',email:'a2@dhtrd.com',name:'المالك',role:'مدير',active:true};
const VW={uid:'u_vw',email:'vw@dhtrd.com',name:'مطّلع الفرع',role:'مطّلع',active:true};
const CT={uid:'u_ct',email:'ct@dhtrd.com',name:'عدّاد ١',role:'عدّاد',active:true,mustChangePassword:true};
const CH=[[{code:'A',name:'صنف أ',category:'ك',book:5,cost:1}]];
const S_OPEN={id:'s_open',name:'جرد مفتوح الآن',status:'open',started:true,startedAt:{__ts:Date.now()-3600000},assignedCounters:['u_ct'],location:'فرع أ',itemCount:1,createdBy:'u_owner',__chunks:CH,__counts:[{code:'A',qty:3}]};
const S_REV={id:'s_rev',name:'جرد مغلق للمراجعة',status:'review',started:true,closedAt:{__ts:Date.now()-1800000},assignedCounters:['u_ct'],location:'فرع أ',itemCount:1,createdBy:'u_owner',__chunks:CH,__counts:[{code:'A',qty:4}]};
const results=[]; const ok=(n,c,d='')=>results.push({n,pass:!!c,d});
const browser=await chromium.launch({ executablePath:EXE, args:['--no-sandbox'] });
const ctx=await browser.newContext({ viewport:{width:1100,height:1100} });
async function load(page,sc){ await page.addInitScript(()=>{ try{ localStorage.clear(); }catch(e){} }); await page.goto(HARNESS+'?s='+encodeURIComponent(b64(sc))); await page.waitForFunction('window.__ready===true',{timeout:8000}); await page.waitForTimeout(150); }

// ===== V1 — الإعداد مفعّل: المطّلع لا يرى الجلسة المفتوحة (تقريرًا وقائمةً وإشعارًا) =====
{ const page=await ctx.newPage(); await load(page,{profile:VW,users:[OWNER,VW,CT],config:{viewersAfterClose:true},sessions:[S_OPEN,S_REV]});
  await page.evaluate(()=>window.__openReport('s_open')); await page.waitForTimeout(400);
  const denied=await page.evaluate(()=>document.getElementById('appContent').textContent.includes('خارج نطاق اطّلاعك'));
  ok('V1 تقرير الجلسة المفتوحة محجوب عن المطّلع', denied===true);
  await page.evaluate(()=>window.__openReport('s_rev')); await page.waitForTimeout(450);
  const revOk=await page.evaluate(()=>!!document.getElementById('repTable')&&document.getElementById('appContent').textContent.includes('جرد مغلق للمراجعة'));
  ok('V1 وفور «الإغلاق للمراجعة» يظهر تقريره كاملًا', revOk===true);
  const created=await page.evaluate(()=>window.__deriveNotifsList([Object.assign({},{id:'s_open'},{name:'جرد مفتوح الآن',status:'open',started:true,createdAt:{__ts:Date.now()-3600000},createdBy:'u_owner',createdByName:'المالك',assignedCounters:['u_x']})]).length);
  ok('V1 حتى إشعار الإنشاء لا يصل المطّلع والجلسة مفتوحة', created===0, String(created));
  await page.close(); }

// ===== V2 — لوحة المطّلع: لا شيء عن المفتوحة، والمغلقة للمراجعة ظاهرة بزر تقريرها =====
{ const page=await ctx.newPage(); await load(page,{profile:VW,users:[OWNER,VW,CT],config:{viewersAfterClose:true},sessions:[S_OPEN,S_REV]});
  await page.waitForTimeout(500);
  const t=await page.evaluate(()=>document.getElementById('appContent').textContent);
  ok('V2 لوحته: المغلقة للمراجعة ظاهرة والمفتوحة غائبة تمامًا', t.includes('جرد مغلق للمراجعة')&&!t.includes('جرد مفتوح الآن'), t.slice(0,80));
  await page.close(); }

// ===== V3 — الإعداد مطفأ (الافتراضي): سلوك اليوم كما هو =====
{ const page=await ctx.newPage(); await load(page,{profile:VW,users:[OWNER,VW,CT],sessions:[S_OPEN]});
  await page.evaluate(()=>window.__openReport('s_open')); await page.waitForTimeout(450);
  const okOpen=await page.evaluate(()=>!!document.getElementById('repTable'));
  ok('V3 دون الإعداد: المطّلع يفتح تقرير المفتوحة (لا تغيّر في السلوك)', okOpen===true);
  await page.close(); }

// ===== V4 — العدّاد المكلَّف والمدير لا يتأثران بالإعداد =====
{ const page=await ctx.newPage(); await load(page,{profile:CT,users:[OWNER,VW,CT],config:{viewersAfterClose:true},sessions:[S_OPEN]});
  await page.evaluate(()=>window.__openSession('s_open')); await page.waitForTimeout(600);
  const ctOk=await page.evaluate(()=>!!document.getElementById('clist')&&!!document.getElementById('csearch'));
  ok('V4 العدّاد المكلَّف يفتح جلسته المفتوحة للعدّ رغم الإعداد', ctOk===true);
  await page.close(); }
{ const page=await ctx.newPage(); await load(page,{profile:OWNER,users:[OWNER,VW,CT],config:{viewersAfterClose:true},sessions:[S_OPEN]});
  await page.evaluate(()=>window.__openReport('s_open')); await page.waitForTimeout(450);
  const mgOk=await page.evaluate(()=>!!document.getElementById('repTable'));
  ok('V4 المدير (حوكمة) يرى المفتوحة رغم الإعداد', mgOk===true);
  await page.close(); }

// ===== V5 — مفتاح الإعداد في بطاقة الحوكمة يُحفظ في config/permissions =====
{ const page=await ctx.newPage(); await load(page,{profile:OWNER,users:[OWNER]});
  await page.evaluate(()=>window.__setTab('settings')); await page.waitForTimeout(500);
  const has=await page.evaluate(()=>!!document.getElementById('viewersAfterCloseToggle'));
  await page.evaluate(()=>{ const c=document.getElementById('viewersAfterCloseToggle'); c.checked=true; document.getElementById('saveApprovalChain').click(); }); await page.waitForTimeout(300);
  const saved=await page.evaluate(()=>{ const c=window.__store['config/permissions']; return c&&c.viewersAfterClose===true; });
  ok('V5 مفتاح «بعد الإغلاق فقط» موجود ويُحفظ', has&&saved===true, JSON.stringify({has,saved}));
  await page.close(); }

// ===== P — تثبيت كلمة المرور: خيار عند الإنشاء + مفتاح في تعديل المستخدم =====
{ const page=await ctx.newPage(); await load(page,{profile:OWNER,users:[OWNER,CT]});
  await page.evaluate(()=>window.__setTab('users')); await page.waitForTimeout(400);
  const hasNew=await page.evaluate(()=>!!document.getElementById('nu_fixedpw'));
  ok('P1 خيار «كلمة مرور ثابتة» في نموذج مستخدم جديد', hasNew===true);
  await page.evaluate(()=>window.__editUser('u_ct')); await page.waitForTimeout(400);
  const st0=await page.evaluate(()=>{ const c=document.getElementById('ue_forcepw'); return { has:!!c, checked:c?c.checked:null }; });
  ok('P2 تعديل المستخدم: مفتاح «طلب تغيير كلمة المرور» يعكس حالته (مطلوب)', st0.has&&st0.checked===true, JSON.stringify(st0));
  await page.evaluate(()=>{ document.getElementById('ue_forcepw').checked=false; document.getElementById('ueSaveProfile').click(); }); await page.waitForTimeout(350);
  const saved=await page.evaluate(()=>window.__store['users/u_ct']&&window.__store['users/u_ct'].mustChangePassword===false);
  ok('P3 إلغاء الطلب يثبّت كلمة المرور (mustChangePassword=false)', saved===true);
  await page.close(); }

await browser.close();
let pass=0; for(const r of results){ console.log((r.pass?'✓':'✗')+' '+r.n+(r.d&&!r.pass?('  << '+r.d):'')); if(r.pass)pass++; }
console.log(`\nRECON ${pass}/${results.length} ${pass===results.length?'passed':'FAILED'}`);
process.exit(pass===results.length?0:1);
