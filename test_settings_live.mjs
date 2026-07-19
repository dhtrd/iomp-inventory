// اختبارات م١٨ — مركز الإدارة الموحّد + بقية ر٣ على البيانات الحيّة.
// الشاشة (ظهور/إخفاء بحسب perms.manage)، حفظ إعدادات الجرد في config/permissions.settings وإعادة تحميلها،
// بناء نسخة احتياطية JSON واستعادتها، فحص السلامة (فجوة مراجع/جلسة يتيمة)، تنبيه الفروقات في ر٦،
// الوضع الأعمى الافتراضي عند الإنشاء، وإلزام سبب التسوية عند التصفير.
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

const results=[]; const ok=(n,c,d='')=>results.push({n,pass:!!c,d});
const browser=await chromium.launch({ executablePath:EXE, args:['--no-sandbox'] });
const ctx=await browser.newContext({ viewport:{width:1100,height:1200} });
async function load(page,sc){ await page.addInitScript(()=>{ try{ localStorage.clear(); }catch(e){} });
  await page.goto(HARNESS+'?s='+encodeURIComponent(b64(sc))); await page.waitForFunction('window.__ready===true',{timeout:8000}); await page.waitForTimeout(250); }
const content=(page)=>page.evaluate(()=>window.__contentHtml());
const nav=(page)=>page.evaluate(()=>window.__nav());
async function openAdmin(page){ await page.evaluate(()=>window.__setTab('admin')); await page.waitForTimeout(200); }
async function openBell(page){ await page.evaluate(()=>document.getElementById('notifBell').click()); await page.waitForTimeout(400); }

// ===== A1 — الشاشة: المالك يرى التبويب والشاشة =====
{ const page=await ctx.newPage(); await load(page,{profile:OWNER,users:[OWNER,CT]});
  const n=await nav(page);
  ok('A1 المالك: تبويب «مركز الإدارة» في الشريط', n.html.includes('data-tab="admin"'), n.html.slice(0,160));
  await openAdmin(page); const h=await content(page);
  ok('A1 شاشة مركز الإدارة تُعرض بأقسامها', h.includes('مركز الإدارة')&&h.includes('إعدادات الجرد')&&h.includes('النسخ الاحتياطي')&&h.includes('فحص السلامة')&&h.includes('السجل الموحّد'), h.slice(0,120));
  await page.close(); }

// ===== A2 — الإخفاء: العدّاد لا يرى التبويب ولا الشاشة =====
{ const page=await ctx.newPage(); await load(page,{user:{uid:'u_ct',email:'ct@dhtrd.com'},profile:CT,users:[OWNER,CT]});
  const n=await nav(page);
  ok('A2 العدّاد: لا تبويب «مركز الإدارة»', !n.html.includes('data-tab="admin"'), JSON.stringify(n).slice(0,120));
  await page.evaluate(()=>window.__setTab('admin')); await page.waitForTimeout(150); const h=await content(page);
  ok('A2 العدّاد: لا تُعرض شاشة الإعدادات', !h.includes('إعدادات الجرد'), h.slice(0,100));
  await page.close(); }

// ===== A3 — حفظ إعدادات الجرد إلى config/permissions.settings.* ثم إعادة التحميل مؤشَّرة =====
{ const page=await ctx.newPage(); await load(page,{profile:OWNER,users:[OWNER]});
  await openAdmin(page);
  await page.evaluate(()=>{ document.getElementById('acBlindDefault').checked=true; document.getElementById('acVarThreshold').value='7'; document.getElementById('acReasonReq').checked=true; document.getElementById('acSaveCounting').click(); });
  await page.waitForTimeout(250);
  const stored=await page.evaluate(()=>window.__store['config/permissions'].settings);
  ok('A3 الإعدادات مُخزّنة في config/permissions.settings', stored&&stored.blindDefault===true&&Number(stored.varianceThreshold)===7&&stored.adjustmentReasonRequired===true, JSON.stringify(stored));
  const app=await page.evaluate(()=>window.__appSettings());
  ok('A3 appSettings() يعكس القيم المحفوظة', app.blindDefault===true&&Number(app.varianceThreshold)===7&&app.adjustmentReasonRequired===true, JSON.stringify(app));
  await openAdmin(page); // إعادة تحميل الشاشة
  const reload=await page.evaluate(()=>({b:document.getElementById('acBlindDefault').checked,v:document.getElementById('acVarThreshold').value,r:document.getElementById('acReasonReq').checked}));
  ok('A3 إعادة تحميل الشاشة تعرض القيم مؤشَّرة', reload.b===true&&reload.v==='7'&&reload.r===true, JSON.stringify(reload));
  await page.close(); }

// ===== A4 — النسخ الاحتياطي: بناء JSON يحوي الإعدادات/الأعلام مع مجموع تحقّقي =====
{ const page=await ctx.newPage(); await load(page,{profile:OWNER,users:[OWNER],
    config:{ settings:{varianceThreshold:5,blindDefault:true}, features:{suppliers:true}, approvalChain:true, warehouses:[{name:'فرع أ'}] }});
  const json=await page.evaluate(()=>window.__acBuildBackup());
  const okStr = json.includes('varianceThreshold')&&json.includes('suppliers')&&json.includes('checksum')&&json.includes('فرع أ');
  ok('A4 نصّ النسخة يحوي الإعدادات/الأعلام/المستودعات/المجموع', okStr, json.slice(0,120));
  const parsed=JSON.parse(json);
  ok('A4 الحمولة قابلة للتحليل ومطابقة', parsed.data.settings.varianceThreshold===5&&parsed.data.features.suppliers===true&&parsed.data.approvalChain===true&&!!parsed.checksum, JSON.stringify(parsed.data.settings));
  await page.close(); }

// ===== A5 — الاستعادة: تحليل JSON وكتابة الإعدادات إلى config/permissions =====
{ const page=await ctx.newPage(); await load(page,{profile:OWNER,users:[OWNER]});
  const restoreJson=JSON.stringify({ app:'IOMP', kind:'config-backup', data:{ settings:{varianceThreshold:9,blindDefault:true}, features:{branches:true} } });
  const res=await page.evaluate((j)=>window.__acRestore(j), restoreJson);
  ok('A5 الاستعادة تنجح وتُبلِغ عدد الحقول', res&&res.ok===true&&res.count>=2, JSON.stringify(res));
  const st=await page.evaluate(()=>window.__store['config/permissions']);
  ok('A5 القيم كُتبت إلى config/permissions', st&&st.settings.varianceThreshold===9&&st.settings.blindDefault===true&&st.features.branches===true, JSON.stringify(st&&st.settings));
  const app=await page.evaluate(()=>window.__appSettings());
  ok('A5 appSettings() بعد الاستعادة', Number(app.varianceThreshold)===9, JSON.stringify(app));
  await page.close(); }

// ===== A6 — الاستعادة: دورة كاملة (تصدير ← استعادة) تنجح، ومجموع تحقّقي معطوب يُرفض =====
{ const page=await ctx.newPage(); await load(page,{profile:OWNER,users:[OWNER],config:{settings:{varianceThreshold:3},features:{warehouseLedger:true}}});
  const round=await page.evaluate(()=>window.__acRestore(window.__acBuildBackup()));
  ok('A6 دورة تصدير→استعادة تنجح (مجموع مطابق)', round&&round.ok===true, JSON.stringify(round));
  const bad=await page.evaluate(()=>{ const o=JSON.parse(window.__acBuildBackup()); o.checksum='FNV-DEADBEEF'; return window.__acRestore(JSON.stringify(o)); });
  ok('A6 مجموع تحقّقي معطوب يُرفض', bad&&!!bad.err&&/المجموع|تالف/.test(bad.err), JSON.stringify(bad));
  await page.close(); }

// ===== A7 — فحص السلامة: فجوة في مراجع الحركات تفشل، بلا فجوة تنجح =====
{ const page=await ctx.newPage(); await load(page,{profile:OWNER,users:[OWNER],
    config:{features:{warehouseLedger:true},warehouses:[{name:'فرع أ'}]},
    movements:[{ref:'MV-0001',type:'in',sku:'X',qty:1},{ref:'MV-0002',type:'in',sku:'X',qty:1},{ref:'MV-0004',type:'in',sku:'X',qty:1}]});
  const checks=await page.evaluate(()=>window.__acIntegrity());
  const gapC=checks.find(x=>x.k.includes('تسلسل مراجع'));
  ok('A7 فجوة المراجع تُكشف (فشل عند MV-0003)', gapC&&gapC.ok===false&&gapC.info.includes('MV-0003'), JSON.stringify(gapC));
  await page.close(); }
{ const page=await ctx.newPage(); await load(page,{profile:OWNER,users:[OWNER],
    config:{features:{warehouseLedger:true},warehouses:[{name:'فرع أ'}]},
    movements:[{ref:'MV-0001',type:'in',sku:'X',qty:1},{ref:'MV-0002',type:'in',sku:'X',qty:1},{ref:'MV-0003',type:'in',sku:'X',qty:1}]});
  const checks=await page.evaluate(()=>window.__acIntegrity());
  const gapC=checks.find(x=>x.k.includes('تسلسل مراجع'));
  ok('A7 تسلسل بلا فجوات ينجح', gapC&&gapC.ok===true, JSON.stringify(gapC));
  await page.close(); }

// ===== A8 — فحص السلامة: جلسة يتيمة (موقعها خارج المستودعات) تُعلَّم =====
{ const page=await ctx.newPage(); await load(page,{profile:OWNER,users:[OWNER],
    config:{warehouses:[{name:'فرع أ'}]},
    sessions:[{id:'so',name:'جرد يتيم',status:'approved',location:'فرع مجهول',itemCount:0},{id:'sg',name:'جرد سليم',status:'approved',location:'فرع أ',itemCount:0}]});
  const checks=await page.evaluate(()=>window.__acIntegrity());
  const orphC=checks.find(x=>x.k.includes('جلسات دون مستودع'));
  ok('A8 الجلسة اليتيمة تُعلَّم بالاسم', orphC&&orphC.ok===false&&orphC.info.includes('جرد يتيم'), JSON.stringify(orphC));
  await page.close(); }
{ const page=await ctx.newPage(); await load(page,{profile:OWNER,users:[OWNER],
    config:{warehouses:[{name:'فرع أ'}]},
    sessions:[{id:'sg',name:'جرد سليم',status:'approved',location:'فرع أ',itemCount:0}]});
  const checks=await page.evaluate(()=>window.__acIntegrity());
  const orphC=checks.find(x=>x.k.includes('جلسات دون مستودع'));
  ok('A8 لا جلسات يتيمة ⇒ نجاح', orphC&&orphC.ok===true, JSON.stringify(orphC));
  await page.close(); }

// ===== A9 — تنبيه الفروقات في ر٦: عتبة مضبوطة وفرق يتجاوزها ⇒ بند فئة «فروقات» =====
{ const VARSESS=[{id:'sv',name:'جرد الفرق',status:'approved',approvedAt:H(1),location:'فرع أ',itemCount:1,
    __chunks:[[{code:'A1',name:'صنف',category:'ك',book:10,cost:1}]],__counts:[{code:'A1',qty:13}]}];
  const page=await ctx.newPage(); await load(page,{profile:OWNER,users:[OWNER],config:{settings:{varianceThreshold:5}},sessions:VARSESS});
  await openBell(page);
  const varItem=await page.evaluate(()=>!!document.querySelector('#notifList .nico.variance'));
  const title=await page.evaluate(()=>{ const t=[...document.querySelectorAll('#notifList .ntitle')].map(x=>x.textContent); return t.join(' | '); });
  ok('A9 يظهر بند بفئة «فروقات» عند تجاوز العتبة', varItem&&/تجاوز العتبة/.test(title), title);
  await page.evaluate(()=>document.querySelector('#notifFilters [data-cat="variance"]').click()); await page.waitForTimeout(150);
  const cnt=await page.evaluate(()=>document.querySelectorAll('#notifList .nitem').length);
  ok('A9 مرشّح «فروقات» يُظهر البند (١)', cnt===1, String(cnt));
  await page.close(); }

// ===== A10 — بلا عتبة ⇒ لا إشعار فروقات (توافق مع اختبارات ر٦ القائمة) =====
{ const VARSESS=[{id:'sv',name:'جرد الفرق',status:'approved',approvedAt:H(1),location:'فرع أ',itemCount:1,
    __chunks:[[{code:'A1',name:'صنف',category:'ك',book:10,cost:1}]],__counts:[{code:'A1',qty:13}]}];
  const page=await ctx.newPage(); await load(page,{profile:OWNER,users:[OWNER],sessions:VARSESS}); // لا settings ⇒ لا عتبة
  await openBell(page);
  const varItem=await page.evaluate(()=>!!document.querySelector('#notifList .nico.variance'));
  const anyItem=await page.evaluate(()=>document.querySelectorAll('#notifList .nitem').length);
  ok('A10 بلا عتبة: لا بند فروقات', !varItem, 'varItem='+varItem);
  ok('A10 بلا عتبة: يبقى إشعار الاعتماد فقط (البنية سليمة)', anyItem===1, String(anyItem));
  await page.close(); }

// ===== A11 — الوضع الأعمى الافتراضي: مُفعّل ⇒ الجلسة الجديدة عمياء =====
{ const page=await ctx.newPage(); await load(page,{profile:OWNER,users:[OWNER],config:{settings:{blindDefault:true},warehouses:[{name:'فرع أ'}]}});
  await page.evaluate(()=>window.__setTab('sessions')); await page.waitForTimeout(250);
  const preChecked=await page.evaluate(()=>document.getElementById('s_blind').checked);
  ok('A11 مربّع «الوضع الأعمى» مُفعّل مسبقًا عند الإنشاء', preChecked===true, 'checked='+preChecked);
  await page.evaluate(()=>{ document.getElementById('s_name').value='جرد أعمى'; document.getElementById('createSessBtn').click(); });
  await page.waitForTimeout(300);
  const sess=await page.evaluate(()=>{ const s=window.__store; for(const k in s){ if(k.indexOf('sessions/')===0&&k.slice(9).indexOf('/')<0){ const d=s[k]; if(d&&d.name==='جرد أعمى')return d; } } return null; });
  ok('A11 الجلسة المُنشأة عمياء (blind===true)', sess&&sess.blind===true, JSON.stringify(sess&&{name:sess.name,blind:sess.blind}));
  await page.close(); }

// ===== A12 — الوضع الأعمى الافتراضي: مُطفأ ⇒ الجلسة الجديدة غير عمياء =====
{ const page=await ctx.newPage(); await load(page,{profile:OWNER,users:[OWNER],config:{warehouses:[{name:'فرع أ'}]}});
  await page.evaluate(()=>window.__setTab('sessions')); await page.waitForTimeout(250);
  const preChecked=await page.evaluate(()=>document.getElementById('s_blind').checked);
  ok('A12 مربّع «الوضع الأعمى» غير مُفعّل افتراضيًا', preChecked===false, 'checked='+preChecked);
  await page.evaluate(()=>{ document.getElementById('s_name').value='جرد عادي'; document.getElementById('createSessBtn').click(); });
  await page.waitForTimeout(300);
  const sess=await page.evaluate(()=>{ const s=window.__store; for(const k in s){ if(k.indexOf('sessions/')===0&&k.slice(9).indexOf('/')<0){ const d=s[k]; if(d&&d.name==='جرد عادي')return d; } } return null; });
  ok('A12 الجلسة المُنشأة غير عمياء (blind falsy)', sess&&!sess.blind, JSON.stringify(sess&&{name:sess.name,blind:sess.blind}));
  await page.close(); }

// ===== A13 — إلزام سبب التسوية: مُفعّل ⇒ التصفير يطلب سببًا (يظهر حوار الإدخال) =====
{ const RSESS=[{id:'sr',name:'جرد تسوية',status:'open',started:true,assignedCounters:['u_owner'],location:'فرع أ',itemCount:1,
    __chunks:[[{code:'A1',name:'صنف',category:'ك',book:5,cost:1}]],__counts:[{code:'A1',qty:5,entries:[{q:5,by:'u_owner',byName:'المالك',at:now}]}]}];
  const page=await ctx.newPage(); await load(page,{profile:OWNER,users:[OWNER],config:{settings:{adjustmentReasonRequired:true}},sessions:RSESS});
  await page.evaluate(()=>window.__openSession('sr')); await page.waitForTimeout(500);
  const hasCount=await page.evaluate(()=>window.__curCounts().includes('A1'));
  ok('A13 الجلسة مفتوحة والصنف معدود', hasCount, JSON.stringify(await page.evaluate(()=>window.__curCounts())));
  await page.evaluate(()=>{ window.__resetItem('A1'); }); await page.waitForTimeout(250);
  const shown=await page.evaluate(()=>window.__ppShown());
  ok('A13 التصفير يطلب سبب التسوية (حوار الإدخال ظاهر)', shown===true, 'ppShown='+shown);
  await page.keyboard.press('Escape'); await page.waitForTimeout(120);
  await page.close(); }

// ===== A14 — إلزام سبب التسوية: مُطفأ ⇒ التصفير يمرّ بلا سؤال ويحذف العدّة =====
{ const RSESS=[{id:'sr',name:'جرد تسوية',status:'open',started:true,assignedCounters:['u_owner'],location:'فرع أ',itemCount:1,
    __chunks:[[{code:'A1',name:'صنف',category:'ك',book:5,cost:1}]],__counts:[{code:'A1',qty:5,entries:[{q:5,by:'u_owner',byName:'المالك',at:now}]}]}];
  const page=await ctx.newPage(); await load(page,{profile:OWNER,users:[OWNER],sessions:RSESS}); // لا إعداد ⇒ لا سؤال
  await page.evaluate(()=>window.__openSession('sr')); await page.waitForTimeout(500);
  await page.evaluate(()=>{ window.__resetItem('A1'); }); await page.waitForTimeout(300);
  const shown=await page.evaluate(()=>window.__ppShown());
  const gone=await page.evaluate(()=>!window.__curCounts().includes('A1'));
  ok('A14 التصفير لا يطلب سببًا حين الإعداد مطفأ', shown===false, 'ppShown='+shown);
  ok('A14 التصفير أُنجز (العدّة حُذفت)', gone, 'stillCounts='+JSON.stringify(await page.evaluate(()=>window.__curCounts())));
  await page.close(); }

await browser.close();
let pass=0, fail=0;
for (const r of results){ console.log(`${r.pass?'✓':'✗'} ${r.n}${r.pass?'':'  << '+r.d}`); r.pass?pass++:fail++; }
console.log(`\nRECON ${pass}/${pass+fail} passed`);
process.exit(fail ? 1 : 0);
