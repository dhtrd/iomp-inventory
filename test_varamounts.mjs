// اختبارات م٦-٣: مبالغ الزيادة/العجز مع كمّياتها في تقرير الفروقات (طباعة + بلاطات + متغيّرات الصيغة) — «مبلغ الزيادة − مبلغ العجز = صافي الفرق»
import { chromium } from 'playwright-core';
import { execSync } from 'node:child_process';
import path from 'node:path';
execSync('node build_harness.js', { cwd: process.cwd(), stdio: 'inherit' });
const EXE = process.env.CHROME_EXE || '/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell';
const HARNESS = 'file://' + path.resolve('harness.html');
const b64 = (o) => Buffer.from(JSON.stringify(o), 'utf8').toString('base64');
const OWNER = { uid:'u_owner', email:'a2@dhtrd.com', name:'المالك', role:'مدير', active:true };
// أ: زيادة (+3، قيمة +30) — ب: عجز (-4، قيمة -80) — ج: دفتري سالب (-3) معدود 9 (زيادة +12، قيمة +328.8، السلوك الحالي كما اعتمده العميل)
const ITEMS=[[{code:'A',name:'صنف أ',category:'ك',book:5,cost:10},{code:'B',name:'صنف ب',category:'ك',book:10,cost:20},{code:'C',name:'كرسي افراح',category:'اثاث',book:-3,cost:27.4}]];
const COUNTS=[{code:'A',qty:8},{code:'B',qty:6},{code:'C',qty:9}];
const SIG=[{title:'مدير الجرد',name:'صالح'}];
const sess=(extra)=>[Object.assign({id:'sx',name:'جرد',location:'مستودع',itemCount:3,__chunks:ITEMS,__counts:COUNTS},extra)];
const results=[]; const ok=(n,c,d='')=>results.push({n,pass:!!c,d});
const browser=await chromium.launch({ executablePath:EXE, args:['--no-sandbox'] });
const ctx=await browser.newContext({ viewport:{width:1200,height:1600} });
async function load(page,sc){ await page.goto(HARNESS+'?s='+encodeURIComponent(b64(sc))); await page.waitForFunction('window.__ready===true',{timeout:9000}); await page.waitForTimeout(140); }
function chip(html,k){ const m=html.match(new RegExp(k.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+':\\s*<b>([^<]+)<\\/b>')); return m?m[1]:'(missing)'; }

// ===== V1 — الطباعة: مبلغ الزيادة/العجز/الصافي مع الكميات =====
{ const page=await ctx.newPage(); await load(page,{profile:OWNER,users:[OWNER],sessions:sess({status:'approved',signatories:SIG,approvedByName:'المالك'})});
  await page.evaluate(()=>window.__openReport('sx')); await page.waitForTimeout(450);
  const html=await page.evaluate(()=>window.__buildReasonPrint('committee'));
  ok('V1 مبلغ الزيادة = 358.8 (+15 وحدة)', chip(html,'مبلغ الزيادة')==='358.8 (+15 وحدة)', chip(html,'مبلغ الزيادة'));
  ok('V1 مبلغ العجز = 80 (−4 وحدة)', chip(html,'مبلغ العجز')==='80 (−4 وحدة)', chip(html,'مبلغ العجز'));
  ok('V1 صافي الفرق = 278.8 (+11 وحدة)', chip(html,'صافي الفرق')==='278.8 (+11 وحدة)', chip(html,'صافي الفرق'));
  // المطابقة: زيادة − عجز = صافي
  const sv=parseFloat(chip(html,'مبلغ الزيادة')), dv=parseFloat(chip(html,'مبلغ العجز')), nv=parseFloat(chip(html,'صافي الفرق'));
  ok('V1 المطابقة: مبلغ الزيادة − مبلغ العجز = صافي الفرق', Math.round((sv-dv-nv)*100)/100===0, sv+'-'+dv+'='+(sv-dv)+' vs '+nv);
  ok('V1 «منها خارج الدفتر» (لا خانة مكرّرة مستقلّة)', html.includes('منها خارج الدفتر') && !/[^ا]خارج الدفتر:/.test(html.replace('منها خارج الدفتر','')), '');
  await page.close(); }

// ===== V2 — البلاطات على الشاشة تعرض المبالغ مع الكميات =====
{ const page=await ctx.newPage(); await load(page,{profile:OWNER,users:[OWNER],sessions:sess({status:'approved',signatories:SIG,approvedByName:'المالك'})});
  await page.evaluate(()=>window.__openReport('sx')); await page.waitForTimeout(450);
  const t=await page.evaluate(()=>document.getElementById('repTiles').innerText);
  ok('V2 بلاطة «مبلغ الزيادة» بالكمية', t.includes('مبلغ الزيادة') && t.includes('358.8 (+15 وحدة)'), t.slice(0,400));
  ok('V2 بلاطة «مبلغ العجز» بالكمية', t.includes('مبلغ العجز') && t.includes('80 (−4 وحدة)'), '');
  ok('V2 «صافي قيمة الفروقات (الفارق)» بالكمية', t.includes('صافي قيمة الفروقات (الفارق)') && t.includes('278.8 (+11 وحدة)'), '');
  await page.close(); }

// ===== V3 — متغيّرات الصيغة الجديدة تُستبدل بالأرقام الصحيحة =====
{ const page=await ctx.newPage(); await load(page,{profile:OWNER,users:[OWNER],
    config:{settings:{docTemplates:{committee:{intro:'الزيادة {surplusVal} بكمية {surplusQty}؛ العجز {deficitVal} بكمية {deficitQty}؛ الصافي {netVar} بكمية {netQty}؛ المعدود كميًّا {countedQty}.'}}}},
    sessions:sess({status:'approved',signatories:SIG,approvedByName:'المالك'})});
  await page.evaluate(()=>window.__openReport('sx')); await page.waitForTimeout(450);
  const html=await page.evaluate(()=>window.__buildReasonPrint('committee'));
  ok('V3 {surplusVal}=358.8', html.includes('الزيادة 358.8 بكمية 15'), '');
  ok('V3 {deficitVal}=80 (قيمة مطلقة)', html.includes('العجز 80 بكمية 4'), '');
  ok('V3 {netVar}=278.8 و{netQty}=11', html.includes('الصافي 278.8 بكمية 11'), '');
  ok('V3 {countedQty} = مجموع الكميات المعدودة (8+6+9=23)', html.includes('المعدود كميًّا 23'), '');
  await page.close(); }

// ===== V4 — تنبيه النطاق عند الترشيح =====
{ const page=await ctx.newPage(); await load(page,{profile:OWNER,users:[OWNER],sessions:sess({status:'approved',signatories:SIG,approvedByName:'المالك'})});
  await page.evaluate(()=>window.__openReport('sx')); await page.waitForTimeout(450);
  // رشّح على «العجز» فقط ثم اطبع → يظهر تنبيه مُصفّى
  const html=await page.evaluate(()=>{ const rs=document.getElementById('repStatus'); if(rs){ rs.value='deficit'; if(rs._mselSync)rs._mselSync(); } return window.__buildReasonPrint('detailed'); });
  ok('V4 تنبيه «تقرير مُصفّى» يظهر عند الترشيح في التقرير المفصّل', html.includes('تقرير مُصفّى'), '');
  await page.close(); }

await browser.close();
let pass=0; for(const r of results){ console.log((r.pass?'✓':'✗')+' '+r.n+(r.d&&!r.pass?('  << '+r.d):'')); if(r.pass)pass++; }
console.log(`\nRECON ${pass}/${results.length} ${pass===results.length?'passed':'FAILED'}`);
process.exit(pass===results.length?0:1);
