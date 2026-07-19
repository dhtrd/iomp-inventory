// اختبارات ر١١ — النسخ الاحتياطي التلقائي إلى Dropbox + مؤشّر المزامنة الموحّد، خلف علم features.dropboxBackup (معطّل افتراضيًا).
// كل HTTP نحو Dropbox يمرّ عبر بوابة dbxFetch الوحيدة، وتُعترض هنا بموك window.__dbxMock (يسجّل النداءات في window.__dbxCalls).
// يغطّي: العلم مطفأ (لا بطاقة/لا نداءات/التكة تتخطّى) — التفعيل من المفتاح — البطاقة وحفظ App Key — رابط التفويض PKCE —
// تبادل العودة (code+مُتحقِّق ⇒ refresh_token في localStorage وتنظيف العنوان ووميض «تم الربط») — تخزين رمز الوصول المؤقّت —
// النسخ اليدوي بنطاق كامل ومجموع تحقّقي — التكة التلقائية (مستحقّة/غير مستحقّة) — مسار الفشل الحرج — الاستعادة (إعدادات فقط) — الشريط الموحّد.
import { chromium } from 'playwright-core';
import { execSync } from 'node:child_process';
import path from 'node:path';
execSync('node build_harness.js', { cwd: process.cwd(), stdio: 'inherit' });
const EXE = process.env.CHROME_EXE || '/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell';
const HARNESS = 'file://' + path.resolve('harness.html');
const b64 = (o) => Buffer.from(JSON.stringify(o), 'utf8').toString('base64');
const now = Date.now(); const H = (h) => now - h * 3600e3;
const OWNER = { uid:'u_owner', email:'a2@dhtrd.com', name:'المالك', role:'مدير', active:true };
// نفس خوارزمية acChecksum في التطبيق (FNV-1a) — لبناء نسخ صالحة المجموع في الاختبار
const fnv = (str) => { let h=0x811c9dc5>>>0; for(let i=0;i<str.length;i++){ h^=str.charCodeAt(i); h=Math.imul(h,0x01000193)>>>0; } return 'FNV-'+(h>>>0).toString(16).padStart(8,'0').toUpperCase(); };
// بيانات حيّة كاملة النطاق: جلسة بلقطة وعدّات ونشاط + حركات + فرع + منتج بتاريخه
const SESS = [{ id:'sd', name:'جرد دروبوكس', status:'open', started:true, assignedCounters:['u_owner'], location:'فرع أ', itemCount:2,
  __chunks:[[{code:'A1',name:'صنف ألف',category:'ك',book:5,cost:2},{code:'B2',name:'صنف باء',category:'ك',book:3,cost:1}]],
  __counts:[{code:'A1',qty:4,entries:[{q:4,by:'u_owner',byName:'المالك',at:now}]}],
  __activity:[{type:'add',code:'A1',name:'صنف ألف',qty:4,by:'u_owner',byName:'المالك',at:{__ts:now}}] }];
const MOVES = [{ id:'m1', ref:'MV-0001', type:'in', sku:'A1', qty:2 }];
const BRANCHES = [{ id:'b1', name:'فرع أ', active:true, warehouses:['فرع أ'] }];
const PRODUCTS = [{ id:'p1', sku:'SKU-1', name:'منتج واحد', __history:[{type:'create',summary:'إنشاء',byName:'المالك',at:{__ts:now}}] }];
const TOKEN = { refresh_token:'rt_seed', appKey:'key123', account:{name:'حساب الشركة',email:'backup@dhtrd.com'}, linkedAt:now };
const ON = (dbx) => ({ features:{ dropboxBackup:true }, settings: dbx?{ dropbox:dbx }:{} });

const results=[]; const ok=(n,c,d='')=>results.push({n,pass:!!c,d});
const browser=await chromium.launch({ executablePath:EXE, args:['--no-sandbox'] });
const ctx=await browser.newContext({ viewport:{width:1100,height:1400} });
async function load(page,sc,opts){ opts=opts||{};
  await page.addInitScript((o)=>{ try{ localStorage.clear(); }catch(e){}
    window.__dbxCalls=[];
    window.__dbxMock=async(url,opt)=>{
      window.__dbxCalls.push({url:String(url),method:(opt&&opt.method)||'GET',headers:(opt&&opt.headers)||{},body:(opt&&typeof opt.body==='string')?opt.body:null});
      const J=(x)=>({ok:true,status:200,json:async()=>x,text:async()=>JSON.stringify(x)});
      if(window.__dbxFail && url.indexOf('files/upload')>=0) return {ok:false,status:500,json:async()=>({error_summary:'server'}),text:async()=>'err'};
      if(url.indexOf('oauth2/token')>=0) return J({access_token:'at_test',refresh_token:'rt_test',expires_in:14400,account_id:'dbid:xyz'});
      if(url.indexOf('get_current_account')>=0) return J({name:{display_name:'شركة التجربة'},email:'backup@dhtrd.com'});
      if(url.indexOf('files/upload')>=0) return J({name:'up.json',path_lower:'/iomp-backups/up.json',size:(opt&&opt.body?String(opt.body).length:0)});
      if(url.indexOf('list_folder')>=0) return J({entries:(window.__dbxEntries||[])});
      if(url.indexOf('files/download')>=0) return {ok:true,status:200,json:async()=>JSON.parse(window.__dbxDl||'{}'),text:async()=>String(window.__dbxDl||'')};
      if(url.indexOf('token/revoke')>=0) return J({});
      return J({});
    };
    if(o&&o.token){ try{ localStorage.setItem('iomp-dbx', JSON.stringify(o.token)); }catch(e){} }
    if(o&&o.rec){ try{ localStorage.setItem('iomp-dbx-rec', JSON.stringify(o.rec)); }catch(e){} }
    if(o&&o.pkce){ try{ sessionStorage.setItem('iomp-dbx-pkce', o.pkce); }catch(e){} }
    if(o&&o.entries) window.__dbxEntries=o.entries;
    if(o&&o.dl) window.__dbxDl=o.dl;
    if(o&&o.fail) window.__dbxFail=true;
  }, opts);
  await page.goto(HARNESS+'?s='+encodeURIComponent(b64(sc))+(opts.extraQuery||''));
  await page.waitForFunction('window.__ready===true',{timeout:8000}); await page.waitForTimeout(450); }
async function openAdmin(page){ await page.evaluate(()=>window.__setTab('admin')); await page.waitForTimeout(300); }
const calls=(page,frag)=>page.evaluate(f=>window.__dbxCalls.filter(c=>c.url.indexOf(f)>=0), frag);
const dbxSettingsStore=(page)=>page.evaluate(()=>{ const c=window.__store['config/permissions']; return (c&&c.settings&&c.settings.dropbox)||null; });

// ===== X1 — العلم مطفأ: لا بطاقة، لا نداءات HTTP، التكة تتخطّى، ورابط التفويض عديم الأثر =====
{ const page=await ctx.newPage(); await load(page,{profile:OWNER,users:[OWNER],sessions:SESS}); // بلا علم
  await openAdmin(page);
  const hasCard=await page.evaluate(()=>window.__has('dbxCard'));
  const strip=await page.evaluate(()=>{ const e=document.getElementById('syncStrip'); return e?e.textContent:''; });
  ok('X1 العلم مطفأ افتراضيًا: لا بطاقة Dropbox في مركز الإدارة', hasCard===false, 'card='+hasCard);
  ok('X1 الشريط الموحّد حاضر وخانة Dropbox «لم تُفعَّل»', /لم تُفعَّل/.test(strip)&&/الاتصال/.test(strip), strip.slice(0,120));
  const tick=await page.evaluate(()=>window.__dbxTick());
  const authUrl=await page.evaluate(()=>window.__dbxAuthUrl());
  const nCalls=await page.evaluate(()=>window.__dbxCalls.length);
  ok('X1 التكة التلقائية تتخطّى حين العلم مطفأ', tick&&tick.skip==='flag', JSON.stringify(tick));
  ok('X1 صفر نداءات HTTP نحو Dropbox ورابط التفويض null', nCalls===0&&authUrl===null, 'calls='+nCalls+' url='+authUrl);
  // التفعيل من مفتاح الأعلام (نفس نمط بقية الأعلام) ثم إعادة الفتح تُظهر البطاقة
  const hasToggle=await page.evaluate(()=>window.__has('featDropboxToggle'));
  ok('X1 مفتاح «النسخ إلى Dropbox» موجود في قسم الأعلام', hasToggle===true, 'toggle='+hasToggle);
  await page.evaluate(()=>{ document.getElementById('featDropboxToggle').checked=true; document.getElementById('saveFeatDropbox').click(); });
  await page.waitForTimeout(300);
  const flag=await page.evaluate(()=>{ const c=window.__store['config/permissions']; return c&&c.features?c.features.dropboxBackup:null; });
  await openAdmin(page);
  const cardAfter=await page.evaluate(()=>window.__has('dbxCard'));
  ok('X1 الحفظ يكتب features.dropboxBackup=true وتظهر البطاقة بعدها', flag===true&&cardAfter===true, 'flag='+flag+' card='+cardAfter);
  await page.close(); }

// ===== X2 — العلم مفعّل: البطاقة تُعرض، وحفظ App Key/الفاصل يكتب إلى settings.dropbox =====
{ const page=await ctx.newPage(); await load(page,{profile:OWNER,users:[OWNER],config:ON()});
  await openAdmin(page);
  const parts=await page.evaluate(()=>({card:window.__has('dbxCard'),key:window.__has('dbxAppKey'),link:window.__has('dbxLinkBtn'),nowb:window.__has('dbxBackupNow'),list:window.__has('dbxBackList'),iv:window.__has('dbxInterval'),auto:window.__has('dbxAuto'),linkDisabled:document.getElementById('dbxLinkBtn').disabled,backupDisabled:document.getElementById('dbxBackupNow').disabled}));
  ok('X2 البطاقة تُعرض بعناصرها (ربط/نسخ الآن/قائمة/فاصل/تلقائي) والربط معطّل بلا App Key', parts.card&&parts.key&&parts.link&&parts.nowb&&parts.list&&parts.iv&&parts.auto&&parts.linkDisabled===true&&parts.backupDisabled===true, JSON.stringify(parts));
  await page.evaluate(()=>{ document.getElementById('dbxAppKey').value='key999'; document.getElementById('dbxInterval').value='12'; document.getElementById('dbxAuto').checked=true; document.getElementById('dbxSaveCfg').click(); });
  await page.waitForTimeout(300);
  const ds=await dbxSettingsStore(page);
  const linkEnabled=await page.evaluate(()=>!document.getElementById('dbxLinkBtn').disabled);
  ok('X2 الحفظ يكتب settings.dropbox {appKey,intervalHours,auto} ويُفعّل زرّ الربط', ds&&ds.appKey==='key999'&&Number(ds.intervalHours)===12&&ds.auto===true&&linkEnabled, JSON.stringify(ds));
  await page.close(); }

// ===== X3 — رابط تفويض OAuth PKCE صحيح + الضغط لا يتنقّل في بيئة الاختبار =====
{ const page=await ctx.newPage(); await load(page,{profile:OWNER,users:[OWNER],config:ON({appKey:'key123'})});
  const u=await page.evaluate(()=>window.__dbxAuthUrl());
  const okUrl=typeof u==='string'&&u.indexOf('https://www.dropbox.com/oauth2/authorize')===0&&u.indexOf('client_id=key123')>=0&&u.indexOf('response_type=code')>=0&&u.indexOf('code_challenge=')>=0&&u.indexOf('code_challenge_method=S256')>=0&&u.indexOf('token_access_type=offline')>=0&&u.indexOf('redirect_uri=')>=0;
  ok('X3 رابط التفويض يحوي client_id/code_challenge/S256/token_access_type=offline/redirect_uri', okUrl, String(u).slice(0,180));
  const pk=await page.evaluate(()=>{ try{ const o=JSON.parse(sessionStorage.getItem('iomp-dbx-pkce')||'null'); return o&&o.v?{len:o.v.length,k:o.k}:null; }catch(e){ return null; } });
  ok('X3 مُتحقِّق PKCE (٦٤ حرفًا) والمفتاح محفوظان في sessionStorage', pk&&pk.len===64&&pk.k==='key123', JSON.stringify(pk));
  await openAdmin(page);
  await page.evaluate(()=>document.getElementById('dbxLinkBtn').click()); await page.waitForTimeout(300);
  const lastUrl=await page.evaluate(()=>window.__dbxAuthUrlLast||null);
  const stillHarness=page.url().indexOf('file://')===0&&page.url().indexOf('harness.html')>=0;
  ok('X3 الضغط على «ربط» يبني الرابط دون تنقّل (في وجود الموك)', typeof lastUrl==='string'&&lastUrl.indexOf('https://www.dropbox.com/oauth2/authorize')===0&&stillHarness, 'nav='+page.url().slice(0,40));
  await page.close(); }

// ===== X4 — العودة من Dropbox: code + مُتحقِّق ⇒ تبادل، refresh_token في localStorage، تنظيف العنوان، ووميض «تم الربط» =====
{ const page=await ctx.newPage();
  await load(page,{profile:OWNER,users:[OWNER],config:ON({appKey:'appkey1'})},
    { pkce:JSON.stringify({v:'v'.repeat(64),k:'appkey1'}), extraQuery:'&code=TESTCODE' });
  const stored=await page.evaluate(()=>{ try{ return JSON.parse(localStorage.getItem('iomp-dbx')||'null'); }catch(e){ return null; } });
  ok('X4 refresh_token مخزّن في localStorage (على مستوى الجهاز)', stored&&stored.refresh_token==='rt_test', JSON.stringify(stored&&{rt:stored.refresh_token,k:stored.appKey}));
  const ex=(await calls(page,'oauth2/token'))[0]||{};
  const exOk=ex.body&&ex.body.indexOf('code=TESTCODE')>=0&&ex.body.indexOf('grant_type=authorization_code')>=0&&ex.body.indexOf('client_id=appkey1')>=0&&ex.body.indexOf('code_verifier=')>=0&&ex.body.indexOf('redirect_uri=')>=0;
  ok('X4 نداء التبادل form-encoded بحقوله الخمسة', exOk, String(ex.body).slice(0,160));
  const search=await page.evaluate(()=>location.search);
  ok('X4 العنوان نُظّف من code= (وبقي مُعامل السيناريو)', search.indexOf('code=TESTCODE')<0&&search.indexOf('s=')>=0, search.slice(0,60));
  await openAdmin(page); await page.waitForTimeout(400);
  const flash=await page.evaluate(()=>({st:document.getElementById('dbxStatus').textContent,conn:document.getElementById('dbxConnInfo').textContent}));
  ok('X4 البطاقة تعرض وميض «تم الربط ✓» وحالة «مرتبط» بمعلومات الحساب', /تم الربط/.test(flash.st)&&/مرتبط/.test(flash.conn), JSON.stringify(flash));
  await page.close(); }

// ===== X5 — رمز الوصول: تبادل refresh→access عبر الموك، ومخزّن مؤقّتًا (نداء ثانٍ بلا HTTP إضافي) =====
{ const page=await ctx.newPage(); await load(page,{profile:OWNER,users:[OWNER],config:ON({appKey:'key123'})},{token:TOKEN});
  const t1=await page.evaluate(()=>window.__dbx.token());
  const n1=(await calls(page,'oauth2/token')).length;
  const t2=await page.evaluate(()=>window.__dbx.token());
  const n2=(await calls(page,'oauth2/token')).length;
  ok('X5 التبادل يعيد access_token عبر الموك (grant_type=refresh_token)', t1==='at_test'&&n1===1, 't='+t1+' n='+n1);
  ok('X5 النداء الثاني من الذاكرة المؤقّتة — لا HTTP إضافي', t2==='at_test'&&n2===1, 'n2='+n2);
  await page.close(); }

// ===== X6 — النسخ اليدوي: «نسخ الآن» يرفع نسخة كاملة النطاق باسم ومسار صحيحين ومجموع تحقّقي ويكتب lastManualAt =====
{ const page=await ctx.newPage(); await load(page,{profile:OWNER,users:[OWNER],config:ON({appKey:'key123'}),sessions:SESS,movements:MOVES,branches:BRANCHES,products:PRODUCTS},{token:TOKEN});
  await openAdmin(page);
  await page.evaluate(()=>document.getElementById('dbxBackupNow').click()); await page.waitForTimeout(800);
  const ups=await calls(page,'files/upload');
  const arg=ups.length?JSON.parse(ups[0].headers['Dropbox-API-Arg']||'{}'):{};
  ok('X6 رفع واحد إلى /IOMP-Backups باسم iomp-backup-YYYY-MM-DD-HHmm.json (mode:add)', ups.length===1&&/^\/IOMP-Backups\/iomp-backup-\d{4}-\d{2}-\d{2}-\d{4}\.json$/.test(arg.path||'')&&arg.mode==='add', JSON.stringify(arg));
  const body=ups.length?String(ups[0].body):'';
  const scope=body.indexOf('"kind":"full-backup"')>=0&&body.indexOf('صنف ألف')>=0&&body.indexOf('"qty":4')>=0&&body.indexOf('MV-0001')>=0&&body.indexOf('SKU-1')>=0&&body.indexOf('"branches"')>=0&&body.indexOf('"counters"')>=0&&body.indexOf('"extraItems"')>=0&&body.indexOf('"users"')>=0;
  ok('X6 النطاق كامل: اللقطة والعدّات والنشاط والحركات والفروع والمنتجات والمستخدمون في الحمولة', scope, body.slice(0,120));
  const parsed=(()=>{ try{ return JSON.parse(body); }catch(e){ return null; } })();
  const sumOk=parsed&&parsed.checksum&&fnv(JSON.stringify(parsed.data))===parsed.checksum;
  ok('X6 المجموع التحقّقي حاضر ومطابق (FNV-1a على الحمولة)', !!sumOk, parsed?parsed.checksum:'no-parse');
  const ds=await dbxSettingsStore(page);
  const prog=await page.evaluate(()=>({cls:document.getElementById('dbxProg').className,txt:document.getElementById('dbxProg').textContent}));
  ok('X6 نجاح: settings.dropbox.lastManualAt/Name كُتبا والحالة خضراء', ds&&typeof ds.lastManualAt==='number'&&/iomp-backup-/.test(ds.lastManualName||'')&&/ok/.test(prog.cls)&&/✓/.test(prog.txt), JSON.stringify({ds,prog:prog.txt.slice(0,60)}));
  await page.close(); }

// ===== X7 — التكة التلقائية مستحقّة: lastAutoAt قبل ٢٥ ساعة ⇒ رفع واحد + تحديث lastAutoAt + إشعار «مزامنة» =====
{ const page=await ctx.newPage(); await load(page,{profile:OWNER,users:[OWNER],config:ON({appKey:'key123',auto:true,intervalHours:24,lastAutoAt:H(25)}),sessions:SESS},{token:TOKEN});
  const res=await page.evaluate(()=>window.__dbxTick());
  await page.waitForTimeout(300);
  const ups=await calls(page,'files/upload');
  ok('X7 التكة المستحقّة تنفّذ رفعًا واحدًا وتعيد ok', res&&res.ok===true&&ups.length===1, JSON.stringify(res)+' ups='+ups.length);
  const ds=await dbxSettingsStore(page);
  ok('X7 lastAutoAt تحدّث في الوثيقة المشتركة (مع lastAutoName)', ds&&Number(ds.lastAutoAt)>H(1)&&/iomp-backup-/.test(ds.lastAutoName||''), JSON.stringify(ds));
  const notifs=await page.evaluate(()=>window.__deriveNotifs());
  const item=notifs.find(n=>n.cat==='sync'&&/Dropbox/.test(n.title)&&/نُسخ/.test(n.title));
  ok('X7 إشعار «نُسخ احتياطيًّا إلى Dropbox ✓» بفئة مزامنة في المركز', !!item&&!item.critical, JSON.stringify(notifs.map(n=>n.title)));
  await page.close(); }

// ===== X8 — التكة غير مستحقّة: lastAutoAt قبل ساعة ⇒ لا رفع =====
{ const page=await ctx.newPage(); await load(page,{profile:OWNER,users:[OWNER],config:ON({appKey:'key123',auto:true,intervalHours:24,lastAutoAt:H(1)})},{token:TOKEN});
  const res=await page.evaluate(()=>window.__dbxTick());
  const ups=await calls(page,'files/upload');
  ok('X8 غير مستحقّة ⇒ تتخطّى بلا أي رفع', res&&res.skip==='not-due'&&ups.length===0, JSON.stringify(res)+' ups='+ups.length);
  await page.close(); }
// والتعطيل الصريح auto:false يتخطّى حتى لو استُحقّت
{ const page=await ctx.newPage(); await load(page,{profile:OWNER,users:[OWNER],config:ON({appKey:'key123',auto:false,lastAutoAt:0})},{token:TOKEN});
  const res2=await page.evaluate(()=>window.__dbxTick());
  const ups2=await calls(page,'files/upload');
  ok('X8 settings.dropbox.auto=false يعطّل التلقائي', res2&&res2.skip==='off'&&ups2.length===0, JSON.stringify(res2));
  await page.close(); }

// ===== X9 — مسار الفشل: رفع 500 ⇒ إشعار حرج (persistent) + لا تحديث للطوابع + حالة خطأ في البطاقة =====
{ const page=await ctx.newPage(); await load(page,{profile:OWNER,users:[OWNER],config:ON({appKey:'key123'}),sessions:SESS},{token:TOKEN,fail:true});
  await openAdmin(page);
  await page.evaluate(()=>document.getElementById('dbxBackupNow').click()); await page.waitForTimeout(800);
  const st=await page.evaluate(()=>window.__dbx.status());
  const prog=await page.evaluate(()=>({cls:document.getElementById('dbxProg').className,txt:document.getElementById('dbxProg').textContent}));
  ok('X9 الحالة failed والبطاقة تعرض الخطأ', st&&st.state==='failed'&&/err/.test(prog.cls)&&/تعذّر/.test(prog.txt), JSON.stringify({st,prog:prog.txt.slice(0,60)}));
  const ds=await dbxSettingsStore(page);
  ok('X9 لا كتابة لطوابع النجاح عند الفشل', !(ds&&(ds.lastManualAt||ds.lastAutoAt)), JSON.stringify(ds));
  const notifs=await page.evaluate(()=>window.__deriveNotifs());
  const crit=notifs.find(n=>n.cat==='sync'&&n.critical===true&&/Dropbox/.test(n.title));
  ok('X9 إشعار مزامنة حرج (critical) عن فشل النسخ', !!crit, JSON.stringify(notifs.map(n=>({t:n.title,c:n.critical}))));
  await page.evaluate(()=>document.getElementById('notifBell').click()); await page.waitForTimeout(350);
  const domCrit=await page.evaluate(()=>!!document.querySelector('#notifList .nitem.critical .nico.sync'));
  ok('X9 البند الحرج بارز في مركز الإشعارات', domCrit===true, 'domCrit='+domCrit);
  await page.close(); }

// ===== X10 — الاستعادة: قائمة النسخ تُعرض، نسخة سليمة تستعيد الإعدادات/الصلاحيات فقط، ومجموع معطوب يُرفض =====
{ const entry={'.tag':'file',name:'iomp-backup-2026-07-18-0100.json',path_display:'/IOMP-Backups/iomp-backup-2026-07-18-0100.json',size:2048,server_modified:'2026-07-18T01:00:00Z'};
  const cfgData={ settings:{varianceThreshold:9,blindDefault:true}, features:{branches:true}, roles:{'عدّاد':{count:true}} };
  const goodFile=JSON.stringify({app:'IOMP',kind:'config-backup',version:'x',exportedAt:now,data:cfgData,checksum:fnv(JSON.stringify(cfgData))});
  const page=await ctx.newPage(); await load(page,{profile:OWNER,users:[OWNER],config:ON({appKey:'key123'})},{token:TOKEN,entries:[entry],dl:goodFile});
  await openAdmin(page);
  await page.evaluate(()=>document.getElementById('dbxListRefresh').click()); await page.waitForTimeout(500);
  const row=await page.evaluate(()=>{ const b=document.querySelector('#dbxBackList [data-dbxrestore]'); const box=document.getElementById('dbxBackList'); return {btn:!!b,path:b?b.getAttribute('data-dbxrestore'):null,txt:box?box.textContent:''}; });
  ok('X10 «آخر النسخ» تُعرض من list_folder بالاسم والحجم', row.btn&&row.path===entry.path_display&&row.txt.indexOf('iomp-backup-2026-07-18-0100.json')>=0&&/ك\.ب/.test(row.txt), JSON.stringify(row).slice(0,160));
  const r1=await page.evaluate((p)=>window.__dbx.restore(p), entry.path_display);
  const st1=await page.evaluate(()=>{ const c=window.__store['config/permissions']; return {vt:c&&c.settings?c.settings.varianceThreshold:null, br:c&&c.features?c.features.branches:null, role:c&&c.roles?c.roles['عدّاد']:null}; });
  ok('X10 الاستعادة تنجح وتكتب الإعدادات والأدوار إلى config/permissions', r1&&r1.ok===true&&st1.vt===9&&st1.br===true&&st1.role&&st1.role.count===true, JSON.stringify({r1,st1}));
  const bad=JSON.stringify({app:'IOMP',kind:'config-backup',data:cfgData,checksum:'FNV-DEADBEEF'});
  await page.evaluate((d)=>{ window.__dbxDl=d; }, bad);
  const r2=await page.evaluate((p)=>window.__dbx.restore(p), entry.path_display);
  ok('X10 مجموع تحقّقي معطوب يُرفض برسالة', r2&&!!r2.err&&/المجموع|تالف/.test(r2.err), JSON.stringify(r2));
  // نسخة كاملة: يُستعاد جزء config فقط — بيانات الجلسات داخل النسخة لا تُكتب إطلاقًا
  const fullData={ config:{ settings:{varianceThreshold:4} }, users:[{id:'u9',doc:{name:'x'}}], sessions:[{id:'zz',doc:{name:'جرد قديم'},counts:[],snapshot:[],extraItems:[],activity:[]}], movements:[], counters:{}, branches:[], products:[] };
  const fullFile=JSON.stringify({app:'IOMP',kind:'full-backup',version:'x',exportedAt:now,data:fullData,checksum:fnv(JSON.stringify(fullData))});
  await page.evaluate((d)=>{ window.__dbxDl=d; }, fullFile);
  const r3=await page.evaluate((p)=>window.__dbx.restore(p), entry.path_display);
  const st3=await page.evaluate(()=>({vt:window.__store['config/permissions'].settings.varianceThreshold, sess:!!window.__store['sessions/zz'], usr:!!window.__store['users/u9']}));
  ok('X10 النسخة الكاملة تستعيد config فقط — لا كتابة لجلسات/مستخدمين من النسخة', r3&&r3.ok===true&&st3.vt===4&&st3.sess===false&&st3.usr===false, JSON.stringify({r3,st3}));
  await page.close(); }

// ===== X11 — الشريط الموحّد: عدّاد الطابور ووقت آخر نسخة Dropbox والاتصال =====
{ const page=await ctx.newPage(); await load(page,{profile:OWNER,users:[OWNER],
    config:{features:{dropboxBackup:true,offlineCount:true},settings:{dropbox:{appKey:'key123',lastAutoAt:H(3)}}},sessions:SESS},{token:TOKEN});
  await openAdmin(page);
  const strip=await page.evaluate(()=>{ const e=document.getElementById('syncStrip'); return e?e.textContent:''; });
  ok('X11 الشريط يعرض الاتصال وطابور الأوفلاين وآخر نسخة Dropbox', /متصل/.test(strip)&&/معلّقة/.test(strip)&&/آخر نسخة Dropbox/.test(strip)&&/منذ 3 ساعة/.test(strip), strip.slice(0,200));
  ok('X11 عدّاد الطابور بأرقام fmt (0 معلّقة)', /0 معلّقة/.test(strip), strip.slice(0,200));
  await page.close(); }

await browser.close();
let pass=0, fail=0;
for (const r of results){ console.log(`${r.pass?'✓':'✗'} ${r.n}${r.pass?'':'  << '+r.d}`); r.pass?pass++:fail++; }
console.log(`\nRECON ${pass}/${pass+fail} passed`);
process.exit(fail ? 1 : 0);
