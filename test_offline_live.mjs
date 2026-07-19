// اختبارات ر١٠ — العدّ دون اتصال (م٢٤): طابور مزامنة محلي خلف علم features.offlineCount (معطّل افتراضيًا).
// يُمرَّر منطق الطابور عبر بديل localStorage (IndexedDB محجوب على file://). كل اختبار يمسح localStorage.
// يغطّي: العلم مطفأ (لا واجهة/طابور، كتابة مباشرة) — العلم مفعّل+دون اتصال (إدراج + انعكاس تفاؤلي، الخادم لم يستلم) —
// إعادة الاتصال/الدفع (تطبيق بترتيب seq + إفراغ + حدث/إشعار مزامنة) — حفظ الترتيب — عدم الفقد بإعادة القراءة —
// معرّف الجهاز حاضر وثابت — مسار الفشل الحرج — فئة «مزامنة» في المرشّحات وقابلية الإسكات — لا إشعارات مزامنة حين العلم مطفأ.
import { chromium } from 'playwright-core';
import { execSync } from 'node:child_process';
import path from 'node:path';
execSync('node build_harness.js', { cwd: process.cwd(), stdio: 'inherit' });
const EXE = process.env.CHROME_EXE || '/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell';
const HARNESS = 'file://' + path.resolve('harness.html');
const b64 = (o) => Buffer.from(JSON.stringify(o), 'utf8').toString('base64');
const now = Date.now();
const OWNER = { uid:'u_owner', email:'a2@dhtrd.com', name:'المالك', role:'مدير', active:true };
// جلسة مفتوحة مبدوءة مُكلَّف بها المالك، صنفان بلا عدّات مسبقة
const SESS = [{ id:'sr', name:'جرد دون اتصال', status:'open', started:true, assignedCounters:['u_owner'], location:'فرع أ', itemCount:2,
  __chunks:[[{code:'A1',name:'صنف أ',category:'ك',book:5,cost:1},{code:'B2',name:'صنف ب',category:'ك',book:3,cost:1}]] }];
const ON  = { features:{ offlineCount:true } };

const results=[]; const ok=(n,c,d='')=>results.push({n,pass:!!c,d});
const browser=await chromium.launch({ executablePath:EXE, args:['--no-sandbox'] });
const ctx=await browser.newContext({ viewport:{width:1100,height:1200} });
async function load(page,sc){ await page.addInitScript(()=>{ try{ localStorage.clear(); }catch(e){} });
  await page.goto(HARNESS+'?s='+encodeURIComponent(b64(sc))); await page.waitForFunction('window.__ready===true',{timeout:8000}); await page.waitForTimeout(250); }
async function openSr(page){ await page.evaluate(()=>window.__openSession('sr')); await page.waitForTimeout(450); }
const storeCount=(page,code)=>page.evaluate(c=>{ const d=window.__store['sessions/sr/counts/'+c]; return d?{qty:d.qty,entries:(d.entries||[]).map(e=>e.q)}:null; }, code);
const qlen=(page)=>page.evaluate(()=>window.__offline.queue().then(q=>q.length));
const queue=(page)=>page.evaluate(()=>window.__offline.queue());

// ===== O0 — بديل التخزين: على file:// يسقط إلى localStorage (IndexedDB محجوب) =====
{ const page=await ctx.newPage(); await load(page,{profile:OWNER,users:[OWNER],config:ON,sessions:SESS});
  const backend=await page.evaluate(()=>window.__offline.backend());
  ok('O0 offlineStore يستعمل بديل localStorage على file://', backend==='ls', 'backend='+backend);
  await page.close(); }

// ===== O1 — العلم مطفأ: لا واجهة أوفلاين، والعدّ يُكتب إلى الخادم مباشرةً (سلوك اليوم) =====
{ const page=await ctx.newPage(); await load(page,{profile:OWNER,users:[OWNER],sessions:SESS}); // بلا علم
  const flag=await page.evaluate(()=>window.__featuresOfflineOn());
  await openSr(page);
  const hasChip=await page.evaluate(()=>window.__has('offlineChip'));
  ok('O1 العلم مطفأ افتراضيًا', flag===false, 'flag='+flag);
  ok('O1 لا شريحة حالة أوفلاين في قشرة العدّ', hasChip===false, 'chip='+hasChip);
  await page.evaluate(()=>window.__addEntry('A1',3)); await page.waitForTimeout(300);
  const c=await storeCount(page,'A1'); const ql=await qlen(page);
  ok('O1 العدّ كُتب مباشرةً إلى الخادم (qty=3)', c&&c.qty===3, JSON.stringify(c));
  ok('O1 لا طابور مزامنة (فارغ)', ql===0, 'qlen='+ql);
  await page.close(); }

// ===== O2 — العلم مفعّل + دون اتصال: العدّ يُدرَج بالطابور ويظهر تفاؤليًّا، والخادم لم يستلمه =====
{ const page=await ctx.newPage(); await load(page,{profile:OWNER,users:[OWNER],config:ON,sessions:SESS});
  await openSr(page);
  const hasChip=await page.evaluate(()=>window.__has('offlineChip'));
  ok('O2 شريحة حالة أوفلاين ظاهرة حين العلم مفعّل', hasChip===true, 'chip='+hasChip);
  await page.evaluate(()=>window.__offline.setOnline(false)); await page.waitForTimeout(120);
  await page.evaluate(()=>window.__addEntry('A1',3)); await page.waitForTimeout(300);
  const ql=await qlen(page); const q=await queue(page);
  const inCur=await page.evaluate(()=>window.__curCounts().includes('A1'));
  const inStore=await page.evaluate(()=>!!window.__store['sessions/sr/counts/A1']);
  ok('O2 العملية أُدرِجت بالطابور (الطول ١)', ql===1, 'qlen='+ql);
  ok('O2 العدّ ظاهر تفاؤليًّا في الواجهة (curCounts فيه A1)', inCur===true, 'inCur='+inCur);
  ok('O2 الخادم لم يستلم العدّ بعد (لا وثيقة عدّة)', inStore===false, 'inStore='+inStore);
  const e0=q[0]||{};
  ok('O2 العملية موصوفة (op/code/val)', e0.op==='add'&&e0.code==='A1'&&e0.val===3, JSON.stringify(e0));
  const chipTxt=await page.evaluate(()=>document.getElementById('offlineChip').textContent);
  ok('O2 الشريحة تدلّ على انقطاع الاتصال', /دون اتصال|بانتظار المزامنة/.test(chipTxt), chipTxt);
  await page.close(); }

// ===== O3 — إعادة الاتصال/الدفع: يُطبَّق على الخادم، يُفرَغ الطابور، ويظهر حدث/إشعار «مزامنة» =====
{ const page=await ctx.newPage(); await load(page,{profile:OWNER,users:[OWNER],config:ON,sessions:SESS});
  await openSr(page);
  await page.evaluate(()=>window.__offline.setOnline(false)); await page.waitForTimeout(100);
  await page.evaluate(()=>window.__addEntry('A1',3)); await page.waitForTimeout(200);
  await page.evaluate(()=>window.__addEntry('B2',2)); await page.waitForTimeout(200);
  const before=await qlen(page);
  await page.evaluate(()=>window.__offline.setOnline(true)); await page.waitForTimeout(500); // العودة تُطلِق الدفع
  const after=await qlen(page); const cA=await storeCount(page,'A1'); const cB=await storeCount(page,'B2');
  ok('O3 كان بالطابور عمليتان قبل العودة', before===2, 'before='+before);
  ok('O3 الطابور فرغ بعد المزامنة', after===0, 'after='+after);
  ok('O3 العمليات طُبِّقت على الخادم (A1=3، B2=2)', cA&&cA.qty===3&&cB&&cB.qty===2, JSON.stringify({cA,cB}));
  const hasSyncAct=await page.evaluate(()=>{ const s=window.__store; for(const k in s){ if(k.indexOf('sessions/sr/activity/')===0&&s[k]&&s[k].type==='sync')return true; } return false; });
  ok('O3 سُجّل حدث «مزامنة» في سجل الجلسة', hasSyncAct, 'act='+hasSyncAct);
  const ss=await page.evaluate(()=>window.__offline.syncStatus());
  ok('O3 حالة المزامنة = done مع عدد مدفوع', ss&&ss.state==='done'&&ss.flushed===2, JSON.stringify(ss));
  const notifs=await page.evaluate(()=>window.__deriveNotifs());
  ok('O3 إشعار «مزامنة» (اكتملت) يظهر في المركز', notifs.some(n=>n.cat==='sync'&&/اكتملت/.test(n.title)), JSON.stringify(notifs.map(n=>n.cat)));
  await page.close(); }

// ===== O4 — حفظ الترتيب: العمليات تُطبَّق بترتيب seq (تأكيد على كتابات الخادم) =====
{ const page=await ctx.newPage(); await load(page,{profile:OWNER,users:[OWNER],config:ON,sessions:SESS});
  await openSr(page);
  await page.evaluate(()=>window.__offline.setOnline(false)); await page.waitForTimeout(100);
  await page.evaluate(()=>window.__addEntry('A1',1)); await page.waitForTimeout(120);
  await page.evaluate(()=>window.__addEntry('A1',2)); await page.waitForTimeout(120);
  await page.evaluate(()=>window.__addEntry('A1',5)); await page.waitForTimeout(120);
  const q=await queue(page); const seqs=q.map(x=>x.seq);
  const inc=seqs.length===3&&seqs[0]<seqs[1]&&seqs[1]<seqs[2];
  ok('O4 أرقام العمليات تصاعدية بترتيب الإدراج', inc, JSON.stringify(seqs));
  await page.evaluate(()=>window.__offline.setOnline(true)); await page.waitForTimeout(500);
  const c=await storeCount(page,'A1');
  ok('O4 الكتابات طُبِّقت بترتيب seq (الإضافات 1→2→5)', c&&JSON.stringify(c.entries)===JSON.stringify([1,2,5])&&c.qty===8, JSON.stringify(c));
  await page.close(); }

// ===== O5 — لا فقد: أدرِج عدّة عمليات، أعِد قراءة الطابور من التخزين ⇒ باقٍ حتى الدفع =====
{ const page=await ctx.newPage(); await load(page,{profile:OWNER,users:[OWNER],config:ON,sessions:SESS});
  await openSr(page);
  await page.evaluate(()=>window.__offline.setOnline(false)); await page.waitForTimeout(100);
  await page.evaluate(()=>window.__addEntry('A1',1)); await page.waitForTimeout(100);
  await page.evaluate(()=>window.__addEntry('B2',1)); await page.waitForTimeout(100);
  await page.evaluate(()=>window.__addEntry('A1',1)); await page.waitForTimeout(100);
  const raw=await page.evaluate(()=>localStorage.getItem('iomp-offline-queue')); // قراءة مباشرة من التخزين (لا من الذاكرة)
  let parsed=[]; try{ parsed=JSON.parse(raw||'[]'); }catch(e){}
  ok('O5 الطابور محفوظ في التخزين (٣ عمليات) لا في الذاكرة فقط', parsed.length===3, 'stored='+parsed.length);
  const reread=await qlen(page);
  ok('O5 إعادة قراءة الطابور من التخزين تُظهر الثلاثة', reread===3, 'reread='+reread);
  await page.evaluate(()=>window.__offline.setOnline(true)); await page.waitForTimeout(500);
  const rawAfter=await page.evaluate(()=>localStorage.getItem('iomp-offline-queue'));
  let pAfter=[]; try{ pAfter=JSON.parse(rawAfter||'[]'); }catch(e){}
  ok('O5 بعد الدفع: التخزين خالٍ (لا فقد ولا تكرار)', pAfter.length===0, 'after='+pAfter.length);
  await page.close(); }

// ===== O6 — معرّف الجهاز حاضر وثابت على العمليات =====
{ const page=await ctx.newPage(); await load(page,{profile:OWNER,users:[OWNER],config:ON,sessions:SESS});
  await openSr(page);
  await page.evaluate(()=>window.__offline.setOnline(false)); await page.waitForTimeout(100);
  const dev=await page.evaluate(()=>window.__offline.deviceId());
  await page.evaluate(()=>window.__addEntry('A1',1)); await page.waitForTimeout(120);
  await page.evaluate(()=>window.__addEntry('B2',1)); await page.waitForTimeout(120);
  const q=await queue(page);
  const lsDev=await page.evaluate(()=>localStorage.getItem('iomp-device-id'));
  const allSame=q.length===2&&q.every(x=>x.deviceId===dev)&&dev===lsDev&&/^dev-/.test(dev||'');
  ok('O6 كل عملية تحمل معرّف الجهاز الثابت (مطابق للمحفوظ)', allSame, JSON.stringify({dev,lsDev,ids:q.map(x=>x.deviceId)}));
  const dev2=await page.evaluate(()=>window.__offline.deviceId());
  ok('O6 معرّف الجهاز ثابت عبر الاستدعاءات', dev2===dev, 'dev2='+dev2);
  await page.close(); }

// ===== O7 — مسار فشل الدفع يُطلِق إشعارًا حرجًا، ثم النجاح لاحقًا يُفرِغ الطابور =====
{ const page=await ctx.newPage(); await load(page,{profile:OWNER,users:[OWNER],config:ON,sessions:SESS});
  await openSr(page);
  await page.evaluate(()=>window.__offline.setOnline(false)); await page.waitForTimeout(100);
  await page.evaluate(()=>window.__addEntry('A1',1)); await page.waitForTimeout(120);
  await page.evaluate(()=>window.__addEntry('B2',1)); await page.waitForTimeout(120);
  await page.evaluate(()=>window.__offline.failNext(true)); // إفشال الدفع الآتي
  await page.evaluate(()=>window.__offline.setOnline(true)); await page.waitForTimeout(400);
  const remain=await qlen(page); const ss=await page.evaluate(()=>window.__offline.syncStatus());
  ok('O7 عند الفشل يبقى الطابور (لم يُفقَد شيء)', remain===2, 'remain='+remain);
  ok('O7 حالة المزامنة = failed', ss&&ss.state==='failed', JSON.stringify(ss));
  const notifs=await page.evaluate(()=>window.__deriveNotifs());
  const crit=notifs.find(n=>n.cat==='sync'&&n.critical===true);
  ok('O7 إشعار مزامنة حرج (critical) يظهر', !!crit, JSON.stringify(notifs.map(n=>({c:n.cat,cr:n.critical}))));
  await page.evaluate(()=>document.getElementById('notifBell').click()); await page.waitForTimeout(350);
  const domCrit=await page.evaluate(()=>!!document.querySelector('#notifList .nitem.critical .nico.sync'));
  ok('O7 البند الحرج بارز في مركز الإشعارات (nitem.critical + nico.sync)', domCrit, 'domCrit='+domCrit);
  await page.evaluate(()=>document.getElementById('notifBell').click()); await page.waitForTimeout(150); // إغلاق
  await page.evaluate(()=>window.__offline.failNext(false));
  await page.evaluate(()=>window.__offline.flush()); await page.waitForTimeout(400);
  const after=await qlen(page); const ss2=await page.evaluate(()=>window.__offline.syncStatus());
  ok('O7 إعادة المحاولة تنجح وتُفرِغ الطابور', after===0&&ss2&&ss2.state==='done', JSON.stringify({after,ss2}));
  await page.close(); }

// ===== O8 — فئة «مزامنة» في مرشّحات المركز وقابلة للإسكات =====
{ const page=await ctx.newPage(); await load(page,{profile:OWNER,users:[OWNER],config:ON,sessions:SESS});
  await openSr(page);
  await page.evaluate(()=>window.__offline.setOnline(false)); await page.waitForTimeout(100);
  await page.evaluate(()=>window.__addEntry('A1',4)); await page.waitForTimeout(150);
  await page.evaluate(()=>window.__offline.setOnline(true)); await page.waitForTimeout(500); // ⇒ حالة done + إشعار مزامنة
  await page.evaluate(()=>document.getElementById('notifBell').click()); await page.waitForTimeout(400);
  const hasChip=await page.evaluate(()=>!!document.querySelector('#notifFilters [data-cat="sync"]'));
  ok('O8 مرشّح فئة «مزامنة» موجود في المركز', hasChip, 'chip='+hasChip);
  await page.evaluate(()=>document.querySelector('#notifFilters [data-cat="sync"]').click()); await page.waitForTimeout(150);
  const nSync=await page.evaluate(()=>document.querySelectorAll('#notifList .nitem').length);
  ok('O8 مرشّح «مزامنة» يُظهر بند المزامنة (١)', nSync===1, 'n='+nSync);
  await page.evaluate(()=>{ const c=document.querySelector('#notifDrawer .nmute[data-cat="sync"]'); c.checked=true; c.onchange(); }); await page.waitForTimeout(200);
  const nAfterMute=await page.evaluate(()=>document.querySelectorAll('#notifList .nitem').length);
  const prefMuted=await page.evaluate(()=>{ try{ return (JSON.parse(localStorage.getItem('iomp-notif-u_owner')||'{}').muted||{}).sync===true; }catch(e){ return false; } });
  ok('O8 إسكات «مزامنة» يُسقط بنده', nAfterMute===0, 'n='+nAfterMute);
  ok('O8 تفضيل الإسكات محفوظ', prefMuted===true, 'muted='+prefMuted);
  await page.close(); }

// ===== O9 — العلم مطفأ + بلا طابور: لا إشعارات مزامنة (حماية اختبارات ر٦ القائمة) =====
{ const page=await ctx.newPage(); await load(page,{profile:OWNER,users:[OWNER],sessions:SESS}); // بلا علم
  // حتى لو وُجدت حالة مزامنة محفوظة، يجب ألّا تظهر أي بنود مزامنة حين العلم مطفأ
  await page.evaluate(()=>window.__offline.setSyncStatus({state:'done',at:Date.now(),flushed:3}));
  const notifs=await page.evaluate(()=>window.__deriveNotifs());
  ok('O9 لا بنود مزامنة في deriveNotifs حين العلم مطفأ', notifs.every(n=>n.cat!=='sync'), JSON.stringify(notifs.map(n=>n.cat)));
  await page.evaluate(()=>document.getElementById('notifBell').click()); await page.waitForTimeout(350);
  const domSync=await page.evaluate(()=>!!document.querySelector('#notifList .nico.sync'));
  ok('O9 لا بند مزامنة في المركز حين العلم مطفأ', domSync===false, 'domSync='+domSync);
  await page.close(); }

// ===== O10 — حفظ العلم من مركز الإدارة (setDoc merge على features.offlineCount) =====
{ const page=await ctx.newPage(); await load(page,{profile:OWNER,users:[OWNER]});
  await page.evaluate(()=>window.__setTab('admin')); await page.waitForTimeout(250);
  const hasToggle=await page.evaluate(()=>window.__has('featOfflineToggle'));
  ok('O10 مفتاح «العدّ دون اتصال» في مركز الإدارة', hasToggle===true, 'toggle='+hasToggle);
  await page.evaluate(()=>{ document.getElementById('featOfflineToggle').checked=true; document.getElementById('saveFeatOffline').click(); });
  await page.waitForTimeout(300);
  const stored=await page.evaluate(()=>{ const c=window.__store['config/permissions']; return c&&c.features?c.features.offlineCount:null; });
  const on=await page.evaluate(()=>window.__featuresOfflineOn());
  ok('O10 الحفظ يكتب features.offlineCount=true', stored===true, 'stored='+stored);
  ok('O10 featuresOfflineOn() يعكس التفعيل', on===true, 'on='+on);
  await page.close(); }

await browser.close();
let pass=0, fail=0;
for (const r of results){ console.log(`${r.pass?'✓':'✗'} ${r.n}${r.pass?'':'  << '+r.d}`); r.pass?pass++:fail++; }
console.log(`\nRECON ${pass}/${pass+fail} passed`);
process.exit(fail ? 1 : 0);
