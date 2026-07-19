// اختبارات مهلة السكون — افتراضات ٣٠د/١٠ث، التنبيه بعدّه التنازلي، «متابعة الجلسة»، الخروج عند الصفر، والحفظ من الواجهة
import { chromium } from 'playwright-core';
import { execSync } from 'node:child_process';
import path from 'node:path';
execSync('node build_harness.js',{stdio:'inherit'});
const EXE=process.env.CHROME_EXE||'/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell';
const HARNESS='file://'+path.resolve('harness.html');
const b64=o=>Buffer.from(JSON.stringify(o),'utf8').toString('base64');
const OWNER={uid:'u_owner',email:'a2@dhtrd.com',name:'المالك',role:'مدير',active:true};
const results=[]; const ok=(n,c,d='')=>results.push({n,pass:!!c,d});
const browser=await chromium.launch({executablePath:EXE,args:['--no-sandbox']});
const ctx=await browser.newContext({viewport:{width:1100,height:900}});
async function load(page,sc){ await page.goto(HARNESS+'?s='+encodeURIComponent(b64(sc))); await page.waitForFunction('window.__ready===true',{timeout:8000}); await page.waitForTimeout(150); }

// I1 — الافتراضات والتخصيص
{ const page=await ctx.newPage(); await load(page,{profile:OWNER,users:[OWNER]});
  const d=await page.evaluate(()=>window.__idleCfg());
  ok('I1 افتراضي: ٣٠ دقيقة / تنبيه ١٠ ثوانٍ', d.minutes===30&&d.warnSeconds===10, JSON.stringify(d));
  await page.close(); }
{ const page=await ctx.newPage(); await load(page,{profile:OWNER,users:[OWNER],config:{settings:{idle:{minutes:0,warnSeconds:5}}}});
  const d=await page.evaluate(()=>window.__idleCfg());
  ok('I1 مخصّص: ٠=تعطيل وثواني تُقرأ (بحد أدنى ٣)', d.minutes===0&&d.warnSeconds===5, JSON.stringify(d));
  await page.close(); }

// I2 — التنبيه والعدّ والمتابعة والخروج
{ const page=await ctx.newPage(); await load(page,{profile:OWNER,users:[OWNER],config:{settings:{idle:{minutes:30,warnSeconds:3}}}});
  await page.evaluate(()=>window.__idleWarnNow());
  const shown=await page.evaluate(()=>({on:window.__idleActive(),n:(document.getElementById('idleCount')||{}).textContent,btn:!!document.getElementById('idleStay')}));
  ok('I2 التنبيه يظهر بعدّ تنازلي وزر متابعة', shown.on&&shown.n==='3'&&shown.btn, JSON.stringify(shown));
  await page.evaluate(()=>document.getElementById('idleStay').click()); await page.waitForTimeout(150);
  const after=await page.evaluate(()=>({on:window.__idleActive(),out:!!window.__idleOut}));
  ok('I2 «متابعة الجلسة» تُغلق التنبيه بلا خروج', !after.on&&!after.out, JSON.stringify(after));
  await page.evaluate(()=>window.__idleWarnNow()); await page.waitForTimeout(4200);
  const end=await page.evaluate(()=>({on:window.__idleActive(),out:!!window.__idleOut}));
  ok('I2 انقضاء العدّ ⇒ خروج تلقائي وإزالة التنبيه', !end.on&&end.out===true, JSON.stringify(end));
  await page.close(); }

// I3 — الحفظ من بطاقة التخصيص
{ const page=await ctx.newPage(); await load(page,{profile:OWNER,users:[OWNER]});
  await page.evaluate(()=>window.__setTab('admin')); await page.waitForTimeout(250);
  const has=await page.evaluate(()=>window.__has('pzIdleMin')&&window.__has('pzIdleWarn'));
  await page.evaluate(()=>{ document.getElementById('pzIdleMin').value='45'; document.getElementById('pzIdleWarn').value='15'; });
  await page.evaluate(()=>window.__acSavePersonalize()); await page.waitForTimeout(250);
  const saved=await page.evaluate(()=>window.__store['config/permissions'].settings.idle);
  ok('I3 حقلا السكون في «تخصيص النظام» والحفظ يثبّت ٤٥/١٥', has&&saved&&saved.minutes===45&&saved.warnSeconds===15, JSON.stringify(saved));
  await page.close(); }

await browser.close();
let pass=0; for(const r of results){ console.log((r.pass?'✓':'✗')+' '+r.n+(r.d&&!r.pass?('  << '+r.d):'')); if(r.pass)pass++; }
console.log(`\nRECON ${pass}/${results.length} ${pass===results.length?'passed':'FAILED'}`);
process.exit(pass===results.length?0:1);
