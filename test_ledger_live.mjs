// اختبارات ر٨ — دفتر الحركات وهيكل المستودعات (م١٦) على البيانات الحيّة عبر الهيكل الاختباري.
// العلم (مطفأ ⇒ لا واجهة/شاشة المستودعات كما هي؛ مفعّل ⇒ شجرة + نموذج + دفتر + مؤشّرات).
// القاعدة الذهبية: لا رصيد مخزّن — الرصيد = طيّ الدفتر. نتحقّق مستقلًّا (كطيّ T7).
// الترقيم المتسلسل MV-0001… بلا فجوات؛ رفض السعة والرصيد؛ trf داخل مستودع/xfer بين مستودعين؛ المؤشّرات والبحث.
import { chromium } from 'playwright-core';
import { execSync } from 'node:child_process';
import path from 'node:path';
execSync('node build_harness.js', { cwd: process.cwd(), stdio: 'inherit' });
const EXE = process.env.CHROME_EXE || '/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell';
const HARNESS = 'file://' + path.resolve('harness.html');
const b64 = (o) => Buffer.from(JSON.stringify(o), 'utf8').toString('base64');
const OWNER = { uid:'u_owner', email:'a2@dhtrd.com', name:'المالك', role:'مدير', active:true };
const CT    = { uid:'u_ct', email:'ct@dhtrd.com', name:'عدّاد ١', role:'عدّاد', active:true };

// هيكل مكاني: مستودعان RY و JD، بصناديق بسعات معروفة
const TREE_RY=[{id:'A',name:'A',shelves:[
  {id:'R1',name:'R1',bins:[{id:'B1',cap:400},{id:'B2',cap:400}]},
  {id:'R2',name:'R2',bins:[{id:'B1',cap:50}]}]}];
const TREE_JD=[{id:'A',name:'A',shelves:[{id:'R1',name:'R1',bins:[{id:'B1',cap:400}]}]}];
const WH=[{id:'RY',name:'الرياض',code:'RY',tree:TREE_RY,deleted:false},{id:'JD',name:'جدة',code:'JD',tree:TREE_JD,deleted:false}];
const CFG_ON  = { features:{warehouseLedger:true}, warehouses:WH };
const CFG_OFF = { warehouses:[{id:'RY',name:'الرياض',deleted:false}] };
const SEP='§';

const results=[]; const ok=(n,c,d='')=>results.push({n,pass:!!c,d});
const browser=await chromium.launch({ executablePath:EXE, args:['--no-sandbox'] });
const ctx=await browser.newContext({ viewport:{width:1100,height:1200} });
async function load(page,sc){ await page.addInitScript(()=>{ try{ localStorage.clear(); }catch(e){} });
  await page.goto(HARNESS+'?s='+encodeURIComponent(b64(sc))); await page.waitForFunction('window.__ready===true',{timeout:8000}); await page.waitForTimeout(150); }
async function openWh(page,waitLed){ await page.evaluate(()=>window.__setTab('warehouses'));
  if(waitLed){ await page.waitForFunction('window.__ledReady&&window.__ledReady()===true',{timeout:9000}); } await page.waitForTimeout(120); }
const has=(page,id)=>page.evaluate(i=>window.__has(i), id);
// طيّ مستقلّ في الاختبار (نفس قاعدة التطبيق، مكتوب هنا استقلالًا)
function foldIndep(moves){ const map={}; const add=(loc,sku,q)=>{ if(!loc)return; const k=loc+SEP+sku; map[k]=(map[k]||0)+q; };
  moves.forEach(m=>{ const q=Number(m.qty)||0; if(m.type==='open'||m.type==='in')add(m.to,m.sku,q); else if(m.type==='out')add(m.from,m.sku,-q); else if(m.type==='trf'||m.type==='xfer'){ add(m.from,m.sku,-q); add(m.to,m.sku,q); } });
  return map; }

// ===== L1 — العلم مطفأ: شاشة المستودعات كما هي، لا واجهة دفتر =====
{ const page=await ctx.newPage(); await load(page,{profile:OWNER,users:[OWNER],config:CFG_OFF});
  await openWh(page,false);
  const flag=await page.evaluate(()=>window.__featuresLedgerOn());
  ok('L1 العلم مطفأ افتراضيًا', flag===false, 'flag='+flag);
  ok('L1 لا شجرة مواقع (ledTree غائب)', !(await has(page,'ledTree')));
  ok('L1 لا نموذج حركة (ledMoveForm غائب)، وشاشة المستودعات قائمة', !(await has(page,'ledMoveForm')) && (await has(page,'addWhBtn')));
  await page.close(); }

// ===== L2 — العلم مفعّل: الشجرة والنموذج يظهران =====
{ const page=await ctx.newPage(); await load(page,{profile:OWNER,users:[OWNER],config:CFG_ON});
  await openWh(page,true);
  const flag=await page.evaluate(()=>window.__featuresLedgerOn());
  const treeHtml=await page.evaluate(()=>document.getElementById('ledTree').innerHTML);
  ok('L2 العلم مفعّل', flag===true, 'flag='+flag);
  ok('L2 الشجرة تُعرض وتتضمّن معرّف صندوق قياسي RY/A/R1/B1', (await has(page,'ledTree')) && treeHtml.includes('RY/A/R1/B1'), treeHtml.slice(0,80));
  ok('L2 نموذج الحركة موجود', await has(page,'ledMoveForm'));
  await page.close(); }

// ===== L3..L9 — تسجيل تسلسل حركات ثم تحقّق مستقلّ من الطيّ والترقيم والرفض والمؤشّرات والبحث =====
{ const page=await ctx.newPage(); await load(page,{profile:OWNER,users:[OWNER],config:CFG_ON});
  await openWh(page,true);
  const SIX=[
    {type:'open', sku:'SKU1', qty:100, to:'RY/A/R1/B1'},
    {type:'in',   sku:'SKU1', qty:50,  to:'RY/A/R1/B1'},
    {type:'out',  sku:'SKU1', qty:30,  from:'RY/A/R1/B1'},
    {type:'trf',  sku:'SKU1', qty:40,  from:'RY/A/R1/B1', to:'RY/A/R1/B2'},
    {type:'xfer', sku:'SKU1', qty:20,  from:'RY/A/R1/B1', to:'JD/A/R1/B1'},
    {type:'open', sku:'SKU2', qty:25,  to:'RY/A/R2/B1'},
  ];
  const rec=await page.evaluate(async(moves)=>{ const out=[]; for(const m of moves){ out.push(await window.__ledMove(m)); } return out; }, SIX);
  ok('L3 كل الحركات الست سُجّلت (بما فيها trf داخل مستودع وxfer بين مستودعين)', rec.every(r=>r&&r.ok===true), JSON.stringify(rec));

  // الطيّ المستقلّ مقابل ما يحسبه التطبيق
  const moves=await page.evaluate(()=>window.__ledMoves());
  const appBal=await page.evaluate(()=>window.__ledBalances());
  const exp=foldIndep(moves);
  const keys=new Set([...Object.keys(exp),...Object.keys(appBal)]);
  let allMatch=true, mism=''; keys.forEach(k=>{ if((exp[k]||0)!==(appBal[k]||0)){ allMatch=false; mism+=k+':exp'+(exp[k]||0)+'≠dom'+(appBal[k]||0)+' '; } });
  ok('L4 الطيّ المستقلّ يطابق أرصدة التطبيق لكل (موقع،صنف)', allMatch, mism);
  const expected={['RY/A/R1/B1'+SEP+'SKU1']:60,['RY/A/R1/B2'+SEP+'SKU1']:40,['JD/A/R1/B1'+SEP+'SKU1']:20,['RY/A/R2/B1'+SEP+'SKU2']:25};
  let exact=Object.keys(expected).length===Object.keys(appBal).length; Object.keys(expected).forEach(k=>{ if((appBal[k]||0)!==expected[k])exact=false; });
  ok('L4 الأرصدة النهائية مطابقة للمتوقّع (60/40/20/25 بلا مفاتيح زائدة)', exact, JSON.stringify(appBal));
  // تحقّق نقطي عبر __ledBalance (trf نقل الرصيد فعلًا داخل RY)
  const b1=await page.evaluate(()=>window.__ledBalance('RY/A/R1/B1','SKU1'));
  const b2=await page.evaluate(()=>window.__ledBalance('RY/A/R1/B2','SKU1'));
  ok('L5 trf داخل نفس المستودع نقل الرصيد (B1=60، B2=40)', b1===60&&b2===40, `b1=${b1} b2=${b2}`);

  // الترقيم المتسلسل بلا فجوات
  const refs=moves.map(m=>m.ref).sort();
  const expRefs=['MV-0001','MV-0002','MV-0003','MV-0004','MV-0005','MV-0006'];
  ok('L6 مراجع متسلسلة MV-0001…MV-0006 بلا فجوات/تكرار', JSON.stringify(refs)===JSON.stringify(expRefs), JSON.stringify(refs));

  // الرفض: لا يُسجَّل ولا يستهلك مرجعًا
  const REJECT=[
    {type:'in',   sku:'SKU2', qty:30,  to:'RY/A/R2/B1'},                      // سعة صنف واحد: 25+30>50
    {type:'open', sku:'SKU3', qty:30,  to:'RY/A/R2/B1'},                      // سعة عبر أصناف الصندوق: 25+30>50
    {type:'out',  sku:'SKU1', qty:999, from:'RY/A/R1/B1'},                    // رصيد غير كافٍ (المتاح 60)
    {type:'xfer', sku:'SKU1', qty:5,   from:'RY/A/R1/B1', to:'RY/A/R1/B2'},   // xfer داخل نفس المستودع
    {type:'trf',  sku:'SKU1', qty:5,   from:'RY/A/R1/B1', to:'JD/A/R1/B1'},   // trf بين مستودعين
    {type:'in',   sku:'SKU1', qty:-5,  to:'RY/A/R1/B1'},                      // كمية غير موجبة
  ];
  const rej=await page.evaluate(async(moves)=>{ const out=[]; for(const m of moves){ out.push(await window.__ledMove(m)); } const a=window.__ledMoves(); return {out, count:a.length, refs:a.map(x=>x.ref)}; }, REJECT);
  ok('L7 رفض تجاوز سعة الصندوق (صنف واحد) مع رسالة، وعدم التسجيل', !!rej.out[0].err && /سعة/.test(rej.out[0].err), JSON.stringify(rej.out[0]));
  ok('L7 السعة محسوبة لكل صندوق عبر كل الأصناف (رُفض SKU3 لبلوغ الصندوق حدّه)', !!rej.out[1].err && /سعة/.test(rej.out[1].err), JSON.stringify(rej.out[1]));
  ok('L8 رفض الصرف بما يتجاوز الرصيد المتاح مع إظهاره', !!rej.out[2].err && /المتاح/.test(rej.out[2].err), JSON.stringify(rej.out[2]));
  ok('L9 xfer يتطلّب مستودعين مختلفين (رُفض داخل نفس المستودع)', !!rej.out[3].err, JSON.stringify(rej.out[3]));
  ok('L9 trf يتطلّب نفس المستودع (رُفض بين مستودعين)', !!rej.out[4].err, JSON.stringify(rej.out[4]));
  ok('L9 الكمية غير الموجبة مرفوضة', !!rej.out[5].err, JSON.stringify(rej.out[5]));
  ok('L9 المرفوضات لم تُسجَّل ولا فجوة في المراجع (٦ حركات فقط)', rej.count===6 && JSON.stringify(rej.refs.sort())===JSON.stringify(expRefs), `count=${rej.count} refs=${JSON.stringify(rej.refs)}`);

  // المؤشّرات
  const k=await page.evaluate(()=>window.__ledKpis());
  ok('L10 إجمالي الوحدات = مجموع الأرصدة (145) وحركات اليوم = 6', k.units===145 && k.today===6 && k.count===6, JSON.stringify(k));
  ok('L10 نسبة الإشغال = الوحدات/إجمالي السعة (145/1250=11.6٪)', k.totalCap===1250 && k.fillPct===11.6, JSON.stringify(k));
  const kv=await page.evaluate(()=>window.__ledKpis({SKU1:2,SKU2:10}));
  ok('L11 قيمة المخزون = Σ(الرصيد×تكلفة الكتالوج) = 120×2 + 25×10 = 490', kv.value===490, JSON.stringify(kv));

  // البحث بالمرجع/الصنف/الموقع
  const byRef=await page.evaluate(()=>window.__ledSearch('MV-0003').length);
  const bySku=await page.evaluate(()=>window.__ledSearch('SKU2').length);
  const byLoc=await page.evaluate(()=>window.__ledSearch('JD/A/R1/B1').length);
  const byLoc2=await page.evaluate(()=>window.__ledSearch('RY/A/R2/B1').length);
  ok('L12 البحث بالمرجع MV-0003 يُرجع حركة واحدة', byRef===1, 'n='+byRef);
  ok('L12 البحث بالصنف SKU2 يُرجع حركة واحدة', bySku===1, 'n='+bySku);
  ok('L12 البحث بالموقع JD/A/R1/B1 يُرجع الحركة العابرة إليه فقط', byLoc===1, 'n='+byLoc);
  ok('L12 البحث بالموقع RY/A/R2/B1 يُرجع حركة SKU2 فقط', byLoc2===1, 'n='+byLoc2);
  await page.close(); }

// ===== L13..L15 — محرّر الهيكل: رمز + منطقة/رف/صندوق يُحفظ ويصير موقعًا صالحًا للحركة =====
{ const page=await ctx.newPage();
  await load(page,{profile:OWNER,users:[OWNER],config:{features:{warehouseLedger:true},warehouses:[{id:'w_new',name:'مستودع جديد',deleted:false}]}});
  await openWh(page,true);
  const r1=await page.evaluate(()=>window.__ledSetWhCode('w_new','NW'));
  const r2=await page.evaluate(()=>window.__ledAddZone('w_new','Z','منطقة Z'));
  const r3=await page.evaluate(()=>window.__ledAddShelf('w_new','Z','S','رف S'));
  const r4=await page.evaluate(()=>window.__ledAddBin('w_new','Z','S','B',100));
  ok('L13 تحرير الهيكل (رمز/منطقة/رف/صندوق) نجح', [r1,r2,r3,r4].every(x=>x&&x.ok===true), JSON.stringify([r1,r2,r3,r4]));
  const bins=await page.evaluate(()=>window.__ledBins());
  const nb=bins.find(b=>b.loc==='NW/Z/S/B');
  ok('L13 الصندوق الجديد صار موقعًا قياسيًا NW/Z/S/B بسعة 100', !!nb && nb.cap===100, JSON.stringify(bins.map(b=>b.loc)));
  const stored=await page.evaluate(()=>{ const w=window.__store['config/permissions'].warehouses[0]; return {code:w.code, cap:w.tree[0].shelves[0].bins[0].cap}; });
  ok('L13 الهيكل محفوظ في config/permissions.warehouses[] (رمز+سعة)', stored.code==='NW' && stored.cap===100, JSON.stringify(stored));
  const mv1=await page.evaluate(()=>window.__ledMove({type:'open',sku:'X',qty:60,to:'NW/Z/S/B'}));
  ok('L14 حركة إلى الصندوق الجديد تُسجَّل (رصيد 60)', mv1&&mv1.ok===true, JSON.stringify(mv1));
  const mv2=await page.evaluate(()=>window.__ledMove({type:'in',sku:'X',qty:50,to:'NW/Z/S/B'}));
  ok('L14 السعة الجديدة تُفرَض (60+50>100 مرفوض)', !!mv2.err, JSON.stringify(mv2));
  const rc=await page.evaluate(()=>window.__ledSetCap('w_new','Z','S','B',200));
  const mv3=await page.evaluate(()=>window.__ledMove({type:'in',sku:'X',qty:50,to:'NW/Z/S/B'}));
  const cap2=await page.evaluate(()=>window.__store['config/permissions'].warehouses[0].tree[0].shelves[0].bins[0].cap);
  ok('L15 رفع السعة إلى 200 يُحفظ ويسمح بالحركة التي رُفضت (رصيد 110)', rc&&rc.ok===true && mv3&&mv3.ok===true && cap2===200, JSON.stringify({rc,mv3,cap2}));
  const bal=await page.evaluate(()=>window.__ledBalance('NW/Z/S/B','X'));
  ok('L15 الرصيد النهائي في الصندوق = 110', bal===110, 'bal='+bal);
  await page.close(); }

await browser.close();
let pass=0, fail=0;
for (const r of results){ console.log(`${r.pass?'✓':'✗'} ${r.n}${r.pass?'':'  << '+r.d}`); r.pass?pass++:fail++; }
console.log(`\nRECON ${pass}/${pass+fail} passed`);
process.exit(fail?1:0);
