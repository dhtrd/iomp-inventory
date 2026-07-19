// اختبارات ر٦ — مركز الإشعارات (م٢٠): جرس بعدّاد، درج مجمّع، تبويب/فلترة، فعلٌ يُقرئ، تمييز الكل، تفضيلات، نطاق الدور، توافق السلسلة، حالة فارغة.
// النموذج مشتقّ من الجلسات المرئية؛ التفضيلات/القراءة في localStorage (تُمسح لكل اختبار).
import { chromium } from 'playwright-core';
import { execSync } from 'node:child_process';
import path from 'node:path';
execSync('node build_harness.js', { cwd: process.cwd(), stdio: 'inherit' });
const EXE = process.env.CHROME_EXE || '/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell';
const HARNESS = 'file://' + path.resolve('harness.html');
const b64 = (o) => Buffer.from(JSON.stringify(o), 'utf8').toString('base64');
const now = Date.now(); const H = (h) => ({ __ts: now - h * 3600000 });
const OWNER = { uid:'u_owner', email:'a2@dhtrd.com', name:'المالك', role:'مدير', active:true };
const CT    = { uid:'u_ct', email:'ct@dhtrd.com', name:'عدّاد ١', role:'عدّاد', active:true };
// جلسات المالك: مراجعة + اعتماد + مقفلة (ثلاثة إشعارات بثلاث فئات)
const OWN_SESS = [
  { id:'s_rev',  name:'جرد المراجعة', status:'review',   started:true, closedAt:H(2),    assignedCounters:['u_ct'], location:'فرع أ', createdBy:'u_owner' },
  { id:'s_apr',  name:'جرد الاعتماد', status:'reviewed', started:true, reviewedAt:H(1),  assignedCounters:['u_ct'], location:'فرع ب', createdBy:'u_owner' },
  { id:'s_lock', name:'جرد المقفل',   status:'approved', started:true, approvedAt:H(30), approvedByName:'المالك', assignedCounters:['u_ct'], location:'فرع ج', createdBy:'u_owner' },
];

const results=[]; const ok=(n,c,d='')=>results.push({n,pass:!!c,d});
const browser=await chromium.launch({ executablePath:EXE, args:['--no-sandbox'] });
const ctx=await browser.newContext({ viewport:{width:1000,height:1000} });
async function load(page,sc){ await page.addInitScript(()=>{ try{ localStorage.clear(); }catch(e){} }); await page.goto(HARNESS+'?s='+encodeURIComponent(b64(sc))); await page.waitForFunction('window.__ready===true',{timeout:8000}); await page.waitForTimeout(500); }
const badge=(page)=>page.evaluate(()=>{ const b=document.getElementById('notifBadge'); return {text:b?b.textContent:null, shown:b?(b.style.display!=='none'):false}; });
async function openBell(page){ await page.evaluate(()=>document.getElementById('notifBell').click()); await page.waitForTimeout(350); }
const nItems=(page)=>page.evaluate(()=>document.querySelectorAll('#notifList .nitem').length);
const drawerOpen=(page)=>page.evaluate(()=>document.getElementById('notifDrawer').classList.contains('open'));
const lsPrefs=(page,uid)=>page.evaluate((u)=>{ try{ return JSON.parse(localStorage.getItem('iomp-notif-'+u)||'{}'); }catch(e){ return {}; } }, uid);

// ===== N1 — الجرس والشارة: المالك لديه ٣ إشعارات غير مقروءة =====
{ const page=await ctx.newPage(); await load(page,{profile:OWNER,users:[OWNER,CT],sessions:OWN_SESS});
  const has=await page.evaluate(()=>!!document.getElementById('notifBell'));
  const bg=await badge(page);
  ok('N1 زر الجرس موجود في الشريط العلوي', has);
  ok('N1 الشارة تُظهر عدد غير المقروء (٣)', bg.shown&&bg.text==='3', JSON.stringify(bg));
  await page.close(); }

// ===== N2 — فتح الدرج: حوار بعنوان + بنود مجمّعة =====
{ const page=await ctx.newPage(); await load(page,{profile:OWNER,users:[OWNER,CT],sessions:OWN_SESS});
  await openBell(page);
  const open=await drawerOpen(page);
  const dialog=await page.evaluate(()=>!!document.querySelector('#notifDrawer .npanel[role="dialog"]'));
  const groups=await page.evaluate(()=>document.querySelectorAll('#notifList .ngrp').length);
  ok('N2 النقر يفتح الدرج (role=dialog)', open&&dialog);
  ok('N2 ٣ بنود معروضة', (await nItems(page))===3, String(await nItems(page)));
  ok('N2 تجميع زمني ظاهر (اليوم/أقدم)', groups>=2, String(groups));
  await page.close(); }

// ===== N3 — الإتاحة: Esc يغلق الدرج =====
{ const page=await ctx.newPage(); await load(page,{profile:OWNER,users:[OWNER,CT],sessions:OWN_SESS});
  await openBell(page); await page.keyboard.press('Escape'); await page.waitForTimeout(200);
  ok('N3 Esc يغلق مركز الإشعارات', !(await drawerOpen(page)));
  await page.close(); }

// ===== N4 — فعل الإشعار: «فتح» يقود للجلسة ويُقرئ البند (الشارة تنقص) =====
{ const page=await ctx.newPage(); await load(page,{profile:OWNER,users:[OWNER,CT],sessions:OWN_SESS});
  await openBell(page);
  await page.evaluate(()=>{ const b=document.querySelector('#notifList [data-nopen]'); if(b)b.click(); }); await page.waitForTimeout(500);
  const closed=!(await drawerOpen(page));
  const opened=await page.evaluate(()=>window.__contentHtml().includes('جرد الاعتماد'));
  const bg=await badge(page);
  ok('N4 «فتح» يغلق الدرج ويفتح الجلسة في سياقها', closed&&opened, `closed=${closed} opened=${opened}`);
  ok('N4 البند صار مقروءًا (الشارة ٢)', bg.text==='2', JSON.stringify(bg));
  await page.close(); }

// ===== N5 — تمييز الكل مقروءًا: الشارة تختفي والحالة تُحفظ =====
{ const page=await ctx.newPage(); await load(page,{profile:OWNER,users:[OWNER,CT],sessions:OWN_SESS});
  await openBell(page);
  await page.evaluate(()=>document.getElementById('notifMarkAll').click()); await page.waitForTimeout(250);
  const bg=await badge(page); const pr=await lsPrefs(page,'u_owner');
  ok('N5 الشارة تختفي بعد «تمييز الكل مقروءًا»', !bg.shown, JSON.stringify(bg));
  ok('N5 حالة القراءة محفوظة لكل مستخدم', (pr.seenAt||0)>0, JSON.stringify(pr));
  await page.close(); }

// ===== N6 — التبويب: الكل/غير المقروء =====
{ const page=await ctx.newPage(); await load(page,{profile:OWNER,users:[OWNER,CT],sessions:OWN_SESS});
  await openBell(page);
  await page.evaluate(()=>document.querySelector('#notifTabs [data-ntab="unread"]').click()); await page.waitForTimeout(150);
  const unreadAll=await nItems(page);
  await page.evaluate(()=>document.getElementById('notifMarkAll').click()); await page.waitForTimeout(200);
  const unreadAfter=await nItems(page);
  await page.evaluate(()=>document.querySelector('#notifTabs [data-ntab="all"]').click()); await page.waitForTimeout(150);
  const allAfter=await nItems(page);
  ok('N6 تبويب «غير المقروء» يُظهر الكل ابتداءً (٣)', unreadAll===3, String(unreadAll));
  ok('N6 بعد التمييز: «غير المقروء» فارغ و«الكل» يبقى ٣', unreadAfter===0&&allAfter===3, `unread=${unreadAfter} all=${allAfter}`);
  await page.close(); }

// ===== N7 — مرشّح الفئة =====
{ const page=await ctx.newPage(); await load(page,{profile:OWNER,users:[OWNER,CT],sessions:OWN_SESS});
  await openBell(page);
  await page.evaluate(()=>document.querySelector('#notifFilters [data-cat="review"]').click()); await page.waitForTimeout(150);
  const rev=await nItems(page);
  await page.evaluate(()=>document.querySelector('#notifFilters [data-cat="approve"]').click()); await page.waitForTimeout(150);
  const appr=await nItems(page);
  await page.evaluate(()=>document.querySelector('#notifFilters [data-cat="all"]').click()); await page.waitForTimeout(150);
  const all=await nItems(page);
  ok('N7 مرشّح «مراجعة» يُظهر بندًا واحدًا', rev===1, String(rev));
  ok('N7 مرشّح «اعتماد» يُظهر بندين', appr===2, String(appr));
  ok('N7 «كل الفئات» يعيد الثلاثة', all===3, String(all));
  await page.close(); }

// ===== N8 — إسكات فئة: يُسقط أحداثها من المركز والشارة =====
{ const page=await ctx.newPage(); await load(page,{profile:OWNER,users:[OWNER,CT],sessions:OWN_SESS});
  await openBell(page);
  await page.evaluate(()=>{ const c=document.querySelector('#notifDrawer .nmute[data-cat="review"]'); c.checked=true; c.onchange(); }); await page.waitForTimeout(200);
  const it=await nItems(page); const bg=await badge(page); const pr=await lsPrefs(page,'u_owner');
  ok('N8 إسكات «مراجعة» يُسقط بنده (٢ متبقية)', it===2, String(it));
  ok('N8 الشارة تعكس الإسكات (٢) والتفضيل محفوظ', bg.text==='2'&&pr.muted&&pr.muted.review===true, JSON.stringify({b:bg.text,m:pr.muted}));
  await page.close(); }

// ===== N9 — وضع الهدوء: تفضيل يُحفظ =====
{ const page=await ctx.newPage(); await load(page,{profile:OWNER,users:[OWNER,CT],sessions:OWN_SESS});
  await openBell(page);
  await page.evaluate(()=>{ const q=document.getElementById('notifQuiet'); q.checked=true; q.onchange(); }); await page.waitForTimeout(150);
  const pr=await lsPrefs(page,'u_owner');
  ok('N9 وضع الهدوء يُحفظ في التفضيلات', pr.quiet===true, JSON.stringify(pr));
  await page.close(); }

// ===== N10 — نطاق الدور: العدّاد يرى تكليفه فقط (لا إشعارات إدارية) =====
{ const page=await ctx.newPage(); await load(page,{user:{uid:'u_ct',email:'ct@dhtrd.com'},profile:CT,users:[OWNER,CT],sessions:[
    { id:'s_mine', name:'جردي', status:'open', started:true, startedAt:H(1), assignedCounters:['u_ct'], location:'فرع أ', createdBy:'u_owner' },
    { id:'s_rev',  name:'مراجعة غيري', status:'review', started:true, closedAt:H(2), assignedCounters:['u_x'], location:'فرع ب', createdBy:'u_owner' },
    { id:'s_lock', name:'مقفلة غيري', status:'approved', started:true, approvedAt:H(3), approvedByName:'م', assignedCounters:['u_x'], location:'فرع ج', createdBy:'u_owner' },
  ]});
  const bg=await badge(page); await openBell(page);
  const it=await nItems(page);
  const onlyAssign=await page.evaluate(()=>{ const t=[...document.querySelectorAll('#notifList .ntitle')].map(x=>x.textContent); return t.length===1&&t[0].includes('كُلّفت'); });
  ok('N10 العدّاد: الشارة ١ (تكليفه فقط)', bg.text==='1', JSON.stringify(bg));
  ok('N10 العدّاد: بند واحد «كُلّفت» ولا إشعارات مراجعة/اعتماد', it===1&&onlyAssign, `items=${it}`);
  await page.close(); }

// ===== N11 — توافق السلسلة: العلم مفعّل ⇒ إشعار «اعتماد مالي» للمخوّل =====
{ const page=await ctx.newPage(); await load(page,{profile:OWNER,users:[OWNER,CT],config:{approvalChain:true},sessions:[
    { id:'s_fin', name:'سلسلة الاعتماد', status:'reviewed', started:true, reviewedAt:H(1), assignedCounters:['u_ct'], location:'فرع أ', createdBy:'u_owner' },
  ]});
  await openBell(page);
  const finTitle=await page.evaluate(()=>{ const t=document.querySelector('#notifList .ntitle'); return t?t.textContent:''; });
  ok('N11 السلسلة مفعّلة: إشعار «اعتمادك المالي»', finTitle.includes('المالي'), finTitle);
  await page.close(); }

// ===== N12 — حالة فارغة مطمئنة =====
{ const page=await ctx.newPage(); await load(page,{profile:OWNER,users:[OWNER],sessions:[
    { id:'s0', name:'قيد التجهيز', status:'open', started:false, itemCount:0, location:'فرع أ', createdBy:'u_owner' },
  ]});
  const bg=await badge(page); await openBell(page);
  const empty=await page.evaluate(()=>window.__contentHtml?document.getElementById('notifList').textContent.includes('لا شيء بانتظارك'):false);
  ok('N12 بلا أحداث: الشارة مخفية', !bg.shown, JSON.stringify(bg));
  ok('N12 حالة فارغة مطمئنة في المركز', empty);
  await page.close(); }

await browser.close();
let pass=0, fail=0;
for (const r of results){ console.log(`${r.pass?'✓':'✗'} ${r.n}${r.pass?'':'  << '+r.d}`); r.pass?pass++:fail++; }
console.log(`\nRECON ${pass}/${pass + fail} passed`);
process.exit(fail ? 1 : 0);
