// اختبارات «إدارة ما نُسي» — إضافة عدّادين وموقّعين بعد بدء الجرد (للمدير) بأثر فوري
import { chromium } from 'playwright-core';
import { execSync } from 'node:child_process';
import path from 'node:path';
execSync('node build_harness.js',{stdio:'inherit'});
const EXE=process.env.CHROME_EXE||'/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell';
const HARNESS='file://'+path.resolve('harness.html');
const b64=o=>Buffer.from(JSON.stringify(o),'utf8').toString('base64');
const OWNER={uid:'u_owner',email:'a2@dhtrd.com',name:'المالك',role:'مدير',active:true};
const CT={uid:'u_ct',email:'ct@dhtrd.com',name:'عدّاد أول',role:'عدّاد',active:true};
const CT2={uid:'u_ct2',email:'ct2@dhtrd.com',name:'عدّاد ثانٍ',role:'عدّاد',active:true};
const EXI=[[{code:'A',name:'صنف',category:'ك',book:10,cost:2}]];
const SEED={id:'s1',name:'جرد جارٍ',status:'open',started:true,location:'الرئيسي',itemCount:1,assignedCounters:['u_ct'],assignedNames:['عدّاد أول'],__chunks:EXI,__counts:[]};
const results=[]; const ok=(n,c,d='')=>results.push({n,pass:!!c,d});
const browser=await chromium.launch({executablePath:EXE,args:['--no-sandbox']});
const ctx=await browser.newContext({viewport:{width:1100,height:1200}});
async function load(page,sc){ await page.goto(HARNESS+'?s='+encodeURIComponent(b64(sc))); await page.waitForFunction('window.__ready===true',{timeout:8000}); await page.waitForTimeout(150); }

// L1 — الزر يظهر للمدير في جلسة جارية، والصندوق يُبنى بعدّادين وموقّعين
{ const page=await ctx.newPage(); await load(page,{profile:OWNER,users:[OWNER,CT,CT2],sessions:[SEED]});
  await page.evaluate(()=>window.__openSession('s1')); await page.waitForTimeout(400);
  const btn=await page.evaluate(()=>window.__has('lateAmendBtn'));
  await page.evaluate(()=>document.getElementById('lateAmendBtn').click()); await page.waitForTimeout(300);
  const box=await page.evaluate(()=>({cbs:document.querySelectorAll('.lasg').length, sigT:document.querySelectorAll('.laT').length, save:window.__has('laSave')}));
  ok('L1 زر «إدارة ما نُسي» ظاهر والصندوق يُبنى (المؤهّلون + صف موقّع)', btn&&box.cbs>=2&&box.sigT>=1&&box.save, JSON.stringify(box));
  // L2 — إضافة عدّاد ثانٍ وموقّع ثم الحفظ
  await page.evaluate(()=>{ document.querySelectorAll('.lasg').forEach(c=>{ if(c.value==='u_ct2')c.checked=true; });
    document.querySelector('#laSigs .laT').value='رئيس اللجنة'; document.querySelector('#laSigs .laN').value='خالد العتيبي'; });
  await page.evaluate(()=>document.getElementById('laSave').click()); await page.waitForTimeout(300);
  const s=await page.evaluate(()=>window.__store['sessions/s1']);
  ok('L2 الحفظ يضيف العدّاد الثاني ويبقي الأول', s.assignedCounters.includes('u_ct')&&s.assignedCounters.includes('u_ct2'), JSON.stringify(s.assignedCounters));
  ok('L2 الموقّع المنسي أُضيف (مسمى+اسم) وبقيت الحالة كما هي', s.signatories&&s.signatories[0].name==='خالد العتيبي'&&s.started===true&&s.status==='open', JSON.stringify(s.signatories));
  await page.close(); }

// L3 — العدّاد لا يرى الزر
{ const page=await ctx.newPage(); await load(page,{profile:CT,users:[OWNER,CT],sessions:[SEED]});
  await page.evaluate(()=>window.__openSession('s1')); await page.waitForTimeout(400);
  const btn=await page.evaluate(()=>window.__has('lateAmendBtn'));
  ok('L3 بلا صلاحية التكليف ⇒ لا زر إدارة ما نُسي', !btn);
  await page.close(); }

await browser.close();
let pass=0; for(const r of results){ console.log((r.pass?'✓':'✗')+' '+r.n+(r.d&&!r.pass?('  << '+r.d):'')); if(r.pass)pass++; }
console.log(`\nRECON ${pass}/${results.length} ${pass===results.length?'passed':'FAILED'}`);
process.exit(pass===results.length?0:1);
