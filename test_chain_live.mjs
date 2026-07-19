// اختبارات ر٥ — سلسلة اعتماد م١٤ خلف إعداد approvalChain (ترقية بلا كسر)
// الأهمّ: «العلم معطّل = سلوك اليوم حرفياً» (C1/C2)، ثم السلسلة الكاملة ومنع القفزات والفصل بين الموقّعَين.
import { chromium } from 'playwright-core';
import { execSync } from 'node:child_process';
import path from 'node:path';
execSync('node build_harness.js', { cwd: process.cwd(), stdio: 'inherit' });
const EXE = process.env.CHROME_EXE || '/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell';
const HARNESS = 'file://' + path.resolve('harness.html');
const b64 = (o) => Buffer.from(JSON.stringify(o), 'utf8').toString('base64');

const OWNER = { uid:'u_owner', email:'a2@dhtrd.com', name:'المالك', role:'مدير', active:true };
const FIN   = { uid:'u_fin', email:'fin@dhtrd.com', name:'محاسب الشركة', role:'عدّاد', active:true, title:'المدير المالي' };
const GM    = { uid:'u_gm',  email:'gm@dhtrd.com',  name:'مدير عام',    role:'عدّاد', active:true, title:'المدير العام' };
const IT = [[{code:'A',name:'صنف أ',book:5,cost:2},{code:'B',name:'صنف ب',book:3,cost:1}]];
const revSess  = (over={})=>Object.assign({ id:'s_rev', name:'جرد قيد الاعتماد', status:'reviewed', started:true, assignedCounters:['u_ct'], itemCount:2, location:'فرع أ', createdBy:'u_owner', __chunks:IT, __counts:[] }, over);
const finSess  = (over={})=>Object.assign({ id:'s_fin', name:'جرد بعد المالي', status:'fin_approved', started:true, assignedCounters:['u_ct'], itemCount:2, location:'فرع أ', createdBy:'u_owner', finApprovedByName:'محاسب سابق', finApprovedByTitle:'المدير المالي', finSig:'SIG-DEADBEEF', __chunks:IT, __counts:[] }, over);
const apprSess = (over={})=>Object.assign({ id:'s_ap', name:'جرد مقفل', status:'approved', started:true, assignedCounters:['u_ct'], itemCount:2, location:'فرع أ', createdBy:'u_owner', approvedByName:'المالك', approvedByTitle:'مدير', gmSig:'SIG-11223344', __chunks:IT, __counts:[] }, over);

const results=[]; const ok=(n,c,d='')=>results.push({n,pass:!!c,d});
const browser=await chromium.launch({ executablePath:EXE, args:['--no-sandbox'] });
const ctx=await browser.newContext({ viewport:{width:1000,height:1100} });
async function load(page,sc){ await page.goto(HARNESS+'?s='+encodeURIComponent(b64(sc))); await page.waitForFunction('window.__ready===true',{timeout:8000}); await page.waitForTimeout(200); }
async function openSess(page,sid){ await page.evaluate((s)=>window.__openSession(s), sid); await page.waitForTimeout(400); }
const store=(page,p)=>page.evaluate((x)=>window.__store[x], p);
const has=(page,id)=>page.evaluate((i)=>window.__has(i), id);
async function clickWait(page,id,ms=350){ const r=await page.evaluate((i)=>window.__click(i), id); await page.waitForTimeout(ms); return r; }

// ===== C1 — العلم معطّل: الجلسة «تمت المراجعة» تُظهر «اعتماد وقفل» الواحد (لا أزرار سلسلة) =====
{ const page=await ctx.newPage(); await load(page,{profile:OWNER,users:[OWNER],sessions:[revSess()]});
  await openSess(page,'s_rev');
  const single=await has(page,'approveBtn'), fin=await has(page,'finApproveBtn'), gm=await has(page,'gmApproveBtn');
  ok('C1 معطّل: زر «اعتماد وقفل» الواحد ظاهر', single);
  ok('C1 معطّل: لا أزرار سلسلة (مالي/عام)', !fin&&!gm, `fin=${fin} gm=${gm}`);
  await page.close(); }

// ===== C2 — العلم معطّل: الاعتماد الواحد يكتب approved (سلوك اليوم حرفياً) =====
{ const page=await ctx.newPage(); await load(page,{profile:OWNER,users:[OWNER],sessions:[revSess()]});
  await openSess(page,'s_rev');
  await clickWait(page,'approveBtn'); await clickWait(page,'govApproveConfirm',450);
  const s=await store(page,'sessions/s_rev');
  ok('C2 معطّل: الحالة صارت approved مباشرة', s&&s.status==='approved', JSON.stringify(s&&s.status));
  ok('C2 معطّل: سُجّل المعتمِد ولا توقيع سلسلة', s&&s.approvedByName==='المالك'&&!s.finSig&&!s.gmSig, JSON.stringify(s&&{a:s.approvedByName,f:s.finSig,g:s.gmSig}));
  await page.close(); }

// ===== C3 — العلم مفعّل: «تمت المراجعة» تُظهر «اعتماد مالي» (لا الزر الواحد) =====
{ const page=await ctx.newPage(); await load(page,{profile:OWNER,users:[OWNER],config:{approvalChain:true},sessions:[revSess()]});
  await openSess(page,'s_rev');
  const single=await has(page,'approveBtn'), fin=await has(page,'finApproveBtn'), gm=await has(page,'gmApproveBtn');
  ok('C3 مفعّل: زر «اعتماد مالي» ظاهر', fin);
  ok('C3 مفعّل: لا زر واحد ولا زر عام في هذه الخطوة', !single&&!gm, `single=${single} gm=${gm}`);
  await page.close(); }

// ===== C4 — العلم مفعّل: الاعتماد المالي reviewed→fin_approved بتوقيع SIG =====
{ const page=await ctx.newPage(); await load(page,{profile:OWNER,users:[OWNER],config:{approvalChain:true},sessions:[revSess()]});
  await openSess(page,'s_rev');
  await clickWait(page,'finApproveBtn'); await clickWait(page,'govFinConfirm',500);
  const s=await store(page,'sessions/s_rev');
  ok('C4 المالي: الحالة صارت fin_approved', s&&s.status==='fin_approved', JSON.stringify(s&&s.status));
  ok('C4 المالي: توقيع SIG صحيح الصيغة', s&&/^SIG-[0-9A-F]{8}$/.test(s.finSig||''), JSON.stringify(s&&s.finSig));
  ok('C4 المالي: سُجّل اسم الموقّع، ولم تُقفل بعد (لا gmSig)', s&&s.finApprovedByName==='المالك'&&!s.gmSig&&s.status!=='approved', JSON.stringify(s&&{f:s.finApprovedByName,g:s.gmSig}));
  await page.close(); }

// ===== C5 — العلم مفعّل: الاعتماد العام fin_approved→approved بتوقيع ثانٍ (توافق حقول approved*) =====
{ const page=await ctx.newPage(); await load(page,{profile:OWNER,users:[OWNER],config:{approvalChain:true},sessions:[finSess()]});
  await openSess(page,'s_fin');
  const gmBtn=await has(page,'gmApproveBtn'), finBtn=await has(page,'finApproveBtn');
  ok('C5 عام: زر «اعتماد عام وقفل» ظاهر، ولا زر مالي (تمّ)', gmBtn&&!finBtn, `gm=${gmBtn} fin=${finBtn}`);
  await clickWait(page,'gmApproveBtn'); await clickWait(page,'govGmConfirm',500);
  const s=await store(page,'sessions/s_fin');
  ok('C5 عام: الحالة صارت approved (مقفلة)', s&&s.status==='approved', JSON.stringify(s&&s.status));
  ok('C5 عام: توقيع gmSig صحيح + حقول approved* للتوافق مع التقرير/المحضر', s&&/^SIG-[0-9A-F]{8}$/.test(s.gmSig||'')&&s.approvedByName==='المالك', JSON.stringify(s&&{g:s.gmSig,a:s.approvedByName}));
  ok('C5 عام: التوقيع المالي السابق محفوظ (سلسلة كاملة)', s&&s.finSig==='SIG-DEADBEEF', JSON.stringify(s&&s.finSig));
  await page.close(); }

// ===== C6 — منع القفزات: العام لا يظهر على «تمت المراجعة» (قبل المالي) =====
{ const page=await ctx.newPage(); await load(page,{profile:OWNER,users:[OWNER],config:{approvalChain:true},sessions:[revSess()]});
  await openSess(page,'s_rev');
  ok('C6 لا قفز: لا زر «اعتماد عام» قبل المالي', !(await has(page,'gmApproveBtn')));
  await page.close(); }

// ===== C7 — الفصل: مستخدم «مالي فقط» يُوقّع مالياً ولا يملك العام =====
{ const page=await ctx.newPage(); await load(page,{user:{uid:'u_fin',email:'fin@dhtrd.com'},profile:FIN,users:[OWNER,FIN],config:{approvalChain:true,users:{u_fin:{'session.approve.finance':true}}},sessions:[revSess()]});
  await openSess(page,'s_rev');
  ok('C7 مالي فقط: يرى زر الاعتماد المالي على «تمت المراجعة»', await has(page,'finApproveBtn'));
  // وعلى جلسة بعد المالي: لا يملك زر العام
  await load(page,{user:{uid:'u_fin',email:'fin@dhtrd.com'},profile:FIN,users:[OWNER,FIN],config:{approvalChain:true,users:{u_fin:{'session.approve.finance':true}}},sessions:[finSess()]});
  await openSess(page,'s_fin');
  ok('C7 مالي فقط: لا يملك زر الاعتماد العام (فصل الأدوار)', !(await has(page,'gmApproveBtn')));
  await page.close(); }

// ===== C8 — الفصل: مستخدم «عام فقط» يوقّع العام ولا يبدأ السلسلة =====
{ const page=await ctx.newPage(); await load(page,{user:{uid:'u_gm',email:'gm@dhtrd.com'},profile:GM,users:[OWNER,GM],config:{approvalChain:true,users:{u_gm:{'session.approve.gm':true}}},sessions:[finSess()]});
  await openSess(page,'s_fin');
  ok('C8 عام فقط: يرى زر الاعتماد العام على جلسة «اعتماد مالي»', await has(page,'gmApproveBtn'));
  await load(page,{user:{uid:'u_gm',email:'gm@dhtrd.com'},profile:GM,users:[OWNER,GM],config:{approvalChain:true,users:{u_gm:{'session.approve.gm':true}}},sessions:[revSess()]});
  await openSess(page,'s_rev');
  ok('C8 عام فقط: لا يملك بدء السلسلة (لا زر مالي على «تمت المراجعة»)', !(await has(page,'finApproveBtn')));
  await page.close(); }

// ===== C9 — الرفض المالي: fin_approved→reviewed (يعيد للخطوة السابقة) =====
{ const page=await ctx.newPage(); await load(page,{profile:OWNER,users:[OWNER],config:{approvalChain:true},sessions:[finSess()]});
  await openSess(page,'s_fin');
  await clickWait(page,'finRejectBtn'); await clickWait(page,'cfGo',450); // حوار التأكيد المخصّص
  const s=await store(page,'sessions/s_fin');
  ok('C9 رفض مالي: عادت إلى «تمت المراجعة»', s&&s.status==='reviewed', JSON.stringify(s&&s.status));
  await page.close(); }

// ===== C10 — الإعداد: مفتاح التفعيل يُحفظ في وثيقة الصلاحيات (approvalChain=true) =====
{ const page=await ctx.newPage(); await load(page,{profile:OWNER,users:[OWNER]});
  await page.evaluate(()=>window.__setTab('settings')); await page.waitForTimeout(250);
  const hasCard=await page.evaluate(()=>window.__contentHtml().includes('سلسلة الاعتماد'));
  ok('C10 بطاقة «سلسلة الاعتماد» ظاهرة في الإعدادات', hasCard);
  await page.evaluate(()=>{ const t=document.getElementById('approvalChainToggle'); if(t&&!t.checked)t.checked=true; });
  await clickWait(page,'saveApprovalChain',300);
  const c=await store(page,'config/permissions');
  ok('C10 حُفظ approvalChain=true في المخزن', c&&c.approvalChain===true, JSON.stringify(c&&c.approvalChain));
  await page.close(); }

// ===== C11 — التوافق: الجلسة المقفلة (بعد العام) تعرض «معتمدة ومقفلة» ويبقى التقرير سليماً =====
{ const page=await ctx.newPage(); await load(page,{profile:OWNER,users:[OWNER],config:{approvalChain:true},sessions:[apprSess()]});
  await openSess(page,'s_ap');
  const html=await page.evaluate(()=>window.__contentHtml());
  ok('C11 مقفلة: تظهر «معتمدة ومقفلة» وتُنسب للمعتمِد', html.includes('معتمدة ومقفلة')&&html.includes('المالك'));
  ok('C11 مقفلة: لا أزرار اعتماد (لا واحد ولا سلسلة)', !(await has(page,'approveBtn'))&&!(await has(page,'finApproveBtn'))&&!(await has(page,'gmApproveBtn')));
  await page.close(); }

await browser.close();
let pass=0, fail=0;
for (const r of results){ console.log(`${r.pass?'✓':'✗'} ${r.n}${r.pass?'':'  << '+r.d}`); r.pass?pass++:fail++; }
console.log(`\nRECON ${pass}/${pass+fail} passed`);
process.exit(fail?1:0);
