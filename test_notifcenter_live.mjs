// اختبارات ر٦ — مركز الإشعارات (م٢٠): جرس بعدّاد، درج مجمّع، تبويب/فلترة، فعلٌ يُقرئ، تمييز الكل، تفضيلات، نطاق الدور، توافق السلسلة، حالة فارغة.
// + حزمة الإشعارات المعتمدة: إشعار إنشاء الجلسة بنمط OriginUI (فاعل+فعل+هدف)، بحث فوري، تثبيت، نقر الصف يُقرئ.
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

// ===== N13 — تصميم الدرج: لوحة مصمتة (لا شفافة) بترويسة مصمتة — يمنع عودة تسرّب المحتوى خلف الدرج =====
{ const page=await ctx.newPage(); await page.setViewportSize({width:412,height:915});
  await load(page,{profile:OWNER,users:[OWNER],sessions:[
    { id:'s1', name:'جرد مؤقت', status:'review', started:true, closedAt:H(1), location:'مستودع', createdBy:'u_owner' },
  ]});
  await openBell(page);
  const st2=await page.evaluate(()=>{ const p=document.querySelector('#notifDrawer .npanel'), h=document.querySelector('#notifDrawer .nhead');
    const pb=getComputedStyle(p).backgroundColor, hb=getComputedStyle(h).backgroundColor;
    const opaque=c=>!!c && c!=='transparent' && !/rgba\([^)]*,\s*0\)$/.test(c);
    return { pb, hb, pOk:opaque(pb), hOk:opaque(hb) }; });
  ok('N13 لوحة الدرج مصمتة الخلفية (لا rgba(0,0,0,0))', st2.pOk, JSON.stringify(st2));
  ok('N13 ترويسة الدرج مصمتة فوق أي محتوى', st2.hOk, JSON.stringify(st2));
  await page.close(); }

// ===== N14 — إشعار إنشاء الجلسة: يصدر لغير المنشئ بصيغة OriginUI (فاعل بارز + وقت نسبي + نقطة) =====
{ const page=await ctx.newPage(); await load(page,{profile:OWNER,users:[OWNER,CT],sessions:[
    { id:'s_new', name:'جرد جديد', status:'open', started:false, createdAt:H(1), createdBy:'u_other', createdByName:'أحمد الفهد', location:'فرع د' },
  ]});
  const bg=await badge(page); await openBell(page);
  const row=await page.evaluate(()=>{ const t=document.querySelector('#notifList .ntitle'); const b=t?t.querySelector('b'):null; const tm=document.querySelector('#notifList .ntime'); const av=document.querySelector('#notifList .nico.nava');
    return { txt:t?t.textContent:'', bold:b?b.textContent:'', time:tm?tm.textContent:'', ava:av?av.textContent.trim():'', dot:!!document.querySelector('#notifList .ndot') }; });
  ok('N14 إنشاء جلسة يولّد إشعارًا (شارة ١)', bg.shown&&bg.text==='1', JSON.stringify(bg));
  ok('N14 صيغة OriginUI: فاعل بارز + «أنشأ» + اسم الجلسة', row.txt.includes('أحمد الفهد')&&row.txt.includes('أنشأ')&&row.txt.includes('جرد جديد')&&row.bold==='أحمد الفهد', JSON.stringify(row));
  ok('N14 حرف الفاعل في كتلة الصورة + وقت نسبي + نقطة غير مقروء', row.ava==='أ'&&row.time.indexOf('منذ')===0&&row.dot, JSON.stringify(row));
  await page.close(); }
{ const page=await ctx.newPage(); await load(page,{profile:OWNER,users:[OWNER],sessions:[
    { id:'s_own', name:'جردي أنا', status:'open', started:false, createdAt:H(1), createdBy:'u_owner', createdByName:'المالك' } ]});
  const n=await page.evaluate(()=>window.__deriveNotifs().length);
  ok('N14 لا يُشعَر المنشئ بإنشائه هو', n===0, String(n));
  await page.close(); }

// ===== N15 — البحث الفوري داخل المركز =====
{ const page=await ctx.newPage(); await load(page,{profile:OWNER,users:[OWNER,CT],sessions:OWN_SESS});
  await openBell(page);
  await page.evaluate(()=>{ const i=document.getElementById('notifSearch'); i.value='المقفل'; i.dispatchEvent(new Event('input')); }); await page.waitForTimeout(150);
  const one=await nItems(page);
  const hit=await page.evaluate(()=>document.querySelector('#notifList .ntitle').textContent.includes('جرد المقفل'));
  await page.evaluate(()=>document.getElementById('notifSearchClear').click()); await page.waitForTimeout(150);
  const all=await nItems(page); const cleared=await page.evaluate(()=>document.getElementById('notifSearch').value==='');
  ok('N15 البحث يرشّح فوريًّا إلى البند المطابق', one===1&&hit, `n=${one}`);
  ok('N15 زر المسح يعيد الكل ويفرغ الحقل', all===3&&cleared, `n=${all} cleared=${cleared}`);
  await page.evaluate(()=>{ const i=document.getElementById('notifSearch'); i.value='قسطنطينية'; i.dispatchEvent(new Event('input')); }); await page.waitForTimeout(120);
  const empty=await page.evaluate(()=>document.getElementById('notifList').textContent.includes('لا نتائج'));
  ok('N15 لا نتائج ⇒ رسالة إرشادية', empty);
  await page.close(); }

// ===== N16 — التثبيت: يطفو في قسم «مثبّت» ويُحفظ لكل مستخدم =====
{ const page=await ctx.newPage(); await load(page,{profile:OWNER,users:[OWNER,CT],sessions:OWN_SESS});
  await openBell(page);
  await page.evaluate(()=>{ const ps=document.querySelectorAll('#notifList [data-npin]'); ps[ps.length-1].click(); }); await page.waitForTimeout(250);
  const st=await page.evaluate(()=>{ const g=document.querySelector('#notifList .ngrp'); const first=document.querySelector('#notifList .nitem');
    return { grp:g?g.textContent:'', pinnedFirst:first?first.classList.contains('pinned'):false, on:!!document.querySelector('#notifList .npin.on') }; });
  const pr=await lsPrefs(page,'u_owner');
  ok('N16 التثبيت: قسم «مثبّت» أولًا والبند المثبَّت يعلو القائمة', st.grp.includes('مثبّت')&&st.pinnedFirst&&st.on, JSON.stringify(st));
  ok('N16 التثبيت محفوظ في تفضيلات المستخدم', pr.pins&&Object.keys(pr.pins).length===1, JSON.stringify(pr.pins));
  await page.evaluate(()=>document.querySelector('#notifList .npin.on').click()); await page.waitForTimeout(250);
  const after=await page.evaluate(()=>({ grp:(document.querySelector('#notifList .ngrp')||{}).textContent||'', pins:document.querySelectorAll('#notifList .npin.on').length }));
  ok('N16 إلغاء التثبيت يعيد الترتيب الزمني', !after.grp.includes('مثبّت')&&after.pins===0, JSON.stringify(after));
  await page.close(); }

// ===== N17 — نقر الصف كاملًا يُقرئ البند (سلوك OriginUI) =====
{ const page=await ctx.newPage(); await load(page,{profile:OWNER,users:[OWNER,CT],sessions:OWN_SESS});
  await openBell(page);
  await page.evaluate(()=>document.querySelector('#notifList .nitem').click()); await page.waitForTimeout(250);
  const bg=await badge(page);
  const dots=await page.evaluate(()=>document.querySelectorAll('#notifList .ndot').length);
  ok('N17 نقر الصف يُقرئ (الشارة ٢ ونقطتان متبقيتان)', bg.text==='2'&&dots===2, JSON.stringify({b:bg.text,dots}));
  await page.close(); }

// ===== N18 — تصميم الفيديو: بطاقات مدوّرة بحدود، صورة دائرية، وقت بأيقونة ساعة، سطر ملخّص، وزر «تمييز الكل» عريض أسفل اللوحة =====
{ const page=await ctx.newPage(); await load(page,{profile:OWNER,users:[OWNER,CT],sessions:OWN_SESS});
  await openBell(page);
  const st=await page.evaluate(()=>{ const it=document.querySelector('#notifList .nitem'); const ic=document.querySelector('#notifList .nico'); const cs=getComputedStyle(it), ci=getComputedStyle(ic);
    const ma=document.getElementById('notifMarkAll'); const foot=ma&&ma.closest('.nfootbar'); const sub=document.getElementById('notifSub');
    return { radius:cs.borderRadius, borderW:cs.borderTopWidth, icoRad:ci.borderRadius, clock:!!document.querySelector('#notifList .ntime svg'),
      footerBtn:!!foot, btnW:ma?ma.getBoundingClientRect().width:0, panelW:document.querySelector('#notifDrawer .npanel').getBoundingClientRect().width,
      sub:sub?sub.textContent:'', headHasBtn:!!document.querySelector('#notifDrawer .nhead #notifMarkAll') }; });
  ok('N18 البطاقة مدوّرة (≥12px) وبحد ظاهر', parseFloat(st.radius)>=12&&st.borderW==='1px', JSON.stringify({r:st.radius,b:st.borderW}));
  ok('N18 الصورة الرمزية دائرية + وقت بأيقونة ساعة', (parseFloat(st.icoRad)>=18||st.icoRad==='50%')&&st.clock, JSON.stringify({i:st.icoRad,c:st.clock}));
  ok('N18 زر «تمييز الكل» عريض أسفل اللوحة (لا في الترويسة)', st.footerBtn&&!st.headHasBtn&&st.btnW>st.panelW*0.8, JSON.stringify({w:Math.round(st.btnW),p:Math.round(st.panelW)}));
  ok('N18 سطر الملخّص يعرض عدد غير المقروء', st.sub.includes('3'), st.sub);
  await page.evaluate(()=>document.getElementById('notifMarkAll').click()); await page.waitForTimeout(250);
  const sub2=await page.evaluate(()=>document.getElementById('notifSub').textContent);
  ok('N18 بعد التمييز يتحول الملخّص إلى «كل إشعاراتك مقروءة»', sub2.includes('مقروءة'), sub2);
  await page.close(); }

// ===== N19 — زر البحث الشامل على الجوال: أيقونة مربّعة تفتح لوحة Ctrl+K =====
{ const page=await ctx.newPage(); await page.setViewportSize({width:412,height:915});
  await load(page,{profile:OWNER,users:[OWNER],sessions:[]});
  const m=await page.evaluate(()=>{ const b=document.getElementById('ckBtn'); const r=b.getBoundingClientRect(); const cs=getComputedStyle(b);
    return { w:Math.round(r.width), h:Math.round(r.height), tHidden:getComputedStyle(b.querySelector('.ts-t')).display==='none', kHidden:getComputedStyle(b.querySelector('.kbd')).display==='none' }; });
  ok('N19 على الجوال: زر أيقونة مربّع (~40px) بلا نص ولا Ctrl K', m.w>=38&&m.w<=46&&m.h>=38&&m.tHidden&&m.kHidden, JSON.stringify(m));
  await page.evaluate(()=>document.getElementById('ckBtn').click()); await page.waitForTimeout(250);
  const open=await page.evaluate(()=>{ const p=document.getElementById('ckPanel'); return !!(p&&(p.classList.contains('open')||getComputedStyle(p).display!=='none')); });
  ok('N19 نقرة الزر تفتح البحث الشامل', open===true);
  await page.close(); }

// ===== N20 — زر × بإطار، والانسحاب عكس الدخول (طور closing ثم إخفاء تام) =====
{ const page=await ctx.newPage(); await load(page,{profile:OWNER,users:[OWNER,CT],sessions:OWN_SESS});
  await openBell(page);
  const b=await page.evaluate(()=>{ const c=document.getElementById('notifClose'); const cs=getComputedStyle(c); const r=c.getBoundingClientRect(); return { bw:cs.borderTopWidth, br:cs.borderRadius, w:Math.round(r.width) }; });
  ok('N20 زر × للإشعارات بإطار ومقاس زرّ حقيقي', b.bw==='1px'&&b.w>=34, JSON.stringify(b));
  await page.evaluate(()=>document.getElementById('notifClose').click());
  const mid=await page.evaluate(()=>{ const d=document.getElementById('notifDrawer'); return { open:d.classList.contains('open'), closing:d.classList.contains('closing'), disp:getComputedStyle(d).display }; });
  ok('N20 عند الإغلاق: حركة انسحاب عكسية (closing ظاهر مؤقتًا)', !mid.open&&mid.closing&&mid.disp==='block', JSON.stringify(mid));
  await page.waitForTimeout(550);
  const end=await page.evaluate(()=>{ const d=document.getElementById('notifDrawer'); return { closing:d.classList.contains('closing'), disp:getComputedStyle(d).display }; });
  ok('N20 بعد الانسحاب يختفي الدرج تمامًا', !end.closing&&end.disp==='none', JSON.stringify(end));
  await page.close(); }

// ===== N21 — زر إغلاق البحث الشامل على الجوال (لا Esc على اللمس) =====
{ const page=await ctx.newPage(); await page.setViewportSize({width:412,height:915});
  await load(page,{profile:OWNER,users:[OWNER],sessions:[]});
  await page.evaluate(()=>document.getElementById('ckBtn').click()); await page.waitForTimeout(250);
  const v=await page.evaluate(()=>{ const c=document.getElementById('ckClose'); return { disp:c?getComputedStyle(c).display:'missing', kbd:getComputedStyle(document.querySelector('.ck-in .kbd')).display, open:document.getElementById('ckPanel').classList.contains('open') }; });
  ok('N21 على الجوال: زر إغلاق ظاهر بدل شارة Esc', v.open&&v.disp!=='none'&&v.disp!=='missing'&&v.kbd==='none', JSON.stringify(v));
  await page.evaluate(()=>document.getElementById('ckClose').click()); await page.waitForTimeout(200);
  const closed=await page.evaluate(()=>!document.getElementById('ckPanel').classList.contains('open'));
  ok('N21 نقرة الزر تغلق البحث', closed===true);
  await page.close(); }
{ const page=await ctx.newPage(); await load(page,{profile:OWNER,users:[OWNER],sessions:[]});
  await page.evaluate(()=>document.getElementById('ckBtn').click()); await page.waitForTimeout(200);
  const d=await page.evaluate(()=>getComputedStyle(document.getElementById('ckClose')).display);
  ok('N21 على المكتب: يبقى Esc ويُخفى الزر', d==='none', d);
  await page.close(); }

// ===== N22 — التفضيلات لوحة منبثقة من زر ⚙ بجانب × (وزر «تمييز الكل» باقٍ أسفل الدرج) =====
{ const page=await ctx.newPage(); await load(page,{profile:OWNER,users:[OWNER,CT],sessions:OWN_SESS});
  await openBell(page);
  const g=await page.evaluate(()=>{ const b=document.getElementById('notifPrefsBtn'); const cs=b?getComputedStyle(b):null; const pf=document.querySelector('#notifDrawer .nprefs');
    const head=document.querySelector('#notifDrawer .nhead'); return { has:!!b, inHead:!!(b&&head.contains(b)), framed:cs?cs.borderTopWidth==='1px':false,
      hidden:getComputedStyle(pf).display==='none', ma:getComputedStyle(document.getElementById('notifMarkAll')).display!=='none' }; });
  ok('N22 زر ⚙ مؤطّر بجانب × والتفضيلات مخفية ابتداءً و«تمييز الكل» باقٍ', g.has&&g.inHead&&g.framed&&g.hidden&&g.ma, JSON.stringify(g));
  await page.evaluate(()=>document.getElementById('notifPrefsBtn').click()); await page.waitForTimeout(300);
  const o=await page.evaluate(()=>{ const pf=document.querySelector('#notifDrawer .nprefs'); const cs=getComputedStyle(pf);
    return { open:pf.classList.contains('open'), disp:cs.display, pos:cs.position, quiet:!!document.getElementById('notifQuiet'), btnOn:document.getElementById('notifPrefsBtn').classList.contains('on') }; });
  ok('N22 ⚙ يفتح لوحة منبثقة (absolute) فيها التفضيلات وزرّه يتفعّل', o.open&&o.disp==='block'&&o.pos==='absolute'&&o.quiet&&o.btnOn, JSON.stringify(o));
  await page.keyboard.press('Escape'); await page.waitForTimeout(200);
  const e1=await page.evaluate(()=>({ pf:document.querySelector('#notifDrawer .nprefs').classList.contains('open'), dr:document.getElementById('notifDrawer').classList.contains('open') }));
  ok('N22 سلّم Esc: يغلق اللوحة أولًا والدرج يبقى', !e1.pf&&e1.dr, JSON.stringify(e1));
  await page.keyboard.press('Escape'); await page.waitForTimeout(200);
  const e2=await page.evaluate(()=>document.getElementById('notifDrawer').classList.contains('open'));
  ok('N22 وEsc الثانية تغلق الدرج', e2===false);
  await page.close(); }

await browser.close();
let pass=0, fail=0;
for (const r of results){ console.log(`${r.pass?'✓':'✗'} ${r.n}${r.pass?'':'  << '+r.d}`); r.pass?pass++:fail++; }
console.log(`\nRECON ${pass}/${pass + fail} passed`);
process.exit(fail ? 1 : 0);
