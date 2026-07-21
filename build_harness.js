// Builds harness.html from index.html by replacing Firebase CDN imports with an
// in-memory stub, and exposing introspection hooks. Scenario is passed via ?s=<b64 json>.
const fs = require('fs');
const src = fs.readFileSync('index.html', 'utf8');

// Strip the three `import ... from "https://www.gstatic.com/firebasejs/..."` statements.
const importRe = /import\s*\{[\s\S]*?\}\s*\r?\n?\s*from\s*"https:\/\/www\.gstatic\.com\/firebasejs\/[^"]+";/g;
const withoutImports = src.replace(importRe, '');
if (withoutImports === src) { console.error('ERR: imports not matched'); process.exit(2); }

const STUB = `
/* ===== in-memory Firebase stub (test harness) ===== */
const __params = new URLSearchParams(location.search);
let __SC = {};
try { __SC = JSON.parse(decodeURIComponent(escape(atob(__params.get('s')||'')))||'{}'); } catch(e){ __SC={}; }
window.__SC = __SC;
const __store = {};            // path -> data | null
const __listeners = [];        // {kind:'doc'|'col', path, cb}
let __uidSeq = 1;
function __clone(x){ return x==null?x:JSON.parse(JSON.stringify(x)); }
function __seed(){
  const p = __SC.profile || {uid:(__SC.user&&__SC.user.uid)||'u_owner', email:(__SC.user&&__SC.user.email)||'a2@dhtrd.com', name:'المالك', role:'مدير', active:true, mustChangePassword:false};
  __store['users/'+p.uid] = __clone(p);
  (__SC.users||[]).forEach(u=>{ __store['users/'+u.uid] = __clone(u); });
  if (__SC.config) __store['config/permissions'] = __clone(__SC.config);
  (__SC.sessions||[]).forEach(s=>{ const id=s.id||('s'+(__uidSeq++)); __store['sessions/'+id]=__clone(Object.assign({},s)); delete __store['sessions/'+id].__chunks;
    (s.__chunks||[]).forEach((ch,i)=>{ __store['sessions/'+id+'/snapshot/chunk_'+String(i).padStart(4,'0')]={items:ch}; });
    (s.__counts||[]).forEach(cn=>{ __store['sessions/'+id+'/counts/'+(cn.code)]=cn; });
    (s.__extras||[]).forEach(x=>{ __store['sessions/'+id+'/extraItems/'+(x.code)]=x; }); // الأصناف اليدوية
    (s.__notes||[]).forEach(n=>{ __store['sessions/'+id+'/itemNotes/'+(n.code)]={code:n.code,notes:n.notes||[]}; }); // ملاحظات العدّ
    (s.__activity||[]).forEach((a,i)=>{ __store['sessions/'+id+'/activity/act_'+String(i).padStart(4,'0')]=__clone(a); });
  });
  (__SC.branches||[]).forEach(b=>{ const id=b.id||('b'+(__uidSeq++)); __store['branches/'+id]=__clone(Object.assign({},b)); }); // ر٨-ب: بذر الفروع (م١٧)
  (__SC.products||[]).forEach(p=>{ const id=p.id||('p'+(__uidSeq++)); __store['products/'+id]=__clone(Object.assign({},p)); delete __store['products/'+id].__history; // ر٩: بذر الكتالوج (م١٥)
    (p.__history||[]).forEach((h,i)=>{ __store['products/'+id+'/history/hist_'+String(i).padStart(4,'0')]=__clone(h); }); });
  (__SC.movements||[]).forEach((mv)=>{ const id=mv.id||('mv'+(__uidSeq++)); __store['movements/'+id]=__clone(mv); }); // ر٩: بذر الحركات لتصنيف ABC/XYZ
}
function __fireDoc(path){ __listeners.filter(l=>l.kind==='doc'&&l.path===path).forEach(l=>{ try{ l.cb(__docSnap(path)); }catch(e){} }); }
function __fireCol(path){ // path is a written doc path; fire col listeners whose col is its direct parent
  const parent = path.slice(0, path.lastIndexOf('/'));
  __listeners.filter(l=>l.kind==='col'&&l.path===parent).forEach(l=>{ try{ l.cb(__colSnap(l.path)); }catch(e){} });
}
function __afterWrite(path){ __fireDoc(path); __fireCol(path); }
function __docSnap(path){ const d=__store[path]; const id=path.slice(path.lastIndexOf('/')+1); return {exists:()=>d!=null, data:()=>__clone(d), id}; }
function __colDocs(path){ const out=[]; const pre=path+'/'; for(const k in __store){ if(k.indexOf(pre)===0 && k.slice(pre.length).indexOf('/')<0 && __store[k]!=null){ out.push(__docSnap(k)); } } return out; }
function __colSnap(path){ const docs=__colDocs(path); return {forEach:cb=>docs.forEach(cb), docs, size:docs.length, empty:docs.length===0}; }

// --- API surface ---
const initializeApp=()=>({}), deleteApp=()=>Promise.resolve();
const getFirestore=()=>({}), getAuth=()=>__auth;
const __user = __SC.user || {uid:(__SC.profile&&__SC.profile.uid)||'u_owner', email:(__SC.profile&&__SC.profile.email)||'a2@dhtrd.com'};
const __auth = { currentUser: {uid:__user.uid, email:__user.email} };
function onAuthStateChanged(a, cb){ setTimeout(()=>cb(__auth.currentUser), 0); return ()=>{}; }
function signInWithEmailAndPassword(a,e,p){ return Promise.resolve({user:{uid:__user.uid}}); }
function createUserWithEmailAndPassword(a,e,p){ const uid='u'+(__uidSeq++); return Promise.resolve({user:{uid}}); }
function signOut(){ return Promise.resolve(); }
function updatePassword(){ return Promise.resolve(); }
function sendPasswordResetEmail(){ return Promise.resolve(); }
function serverTimestamp(){ return {__ts:Date.now()}; }
function doc(db, ...segs){ const path=segs.join('/'); return {__doc:true, path, id:segs[segs.length-1]}; }
function collection(db, ...segs){ const path=segs.join('/'); return {__col:true, path}; }
function query(col, ...cs){ return {__query:true, col, cs}; }
function orderBy(f,d){ return {__ob:f,d}; }
function where(f,op,v){ return {__where:f,op,v}; } // إصلاح-٣ (بند ٢ب): دعم where في المحاكي (يُطبَّق فعليًّا في getDocs)
function limit(n){ return {__limit:n}; }
function __refPath(r){ return r.__query? r.col.path : r.path; }
function getDoc(ref){ return Promise.resolve(__docSnap(ref.path)); }
function getDocs(ref){ let docs=__colSnap(__refPath(ref)).docs;
  if(ref&&ref.__query&&Array.isArray(ref.cs)){ ref.cs.forEach(c=>{ if(c&&c.__where){ docs=docs.filter(d=>{ const v=(d.data()||{})[c.__where]; if(c.op==='==')return v===c.v; if(c.op==='in')return Array.isArray(c.v)&&c.v.indexOf(v)>=0; if(c.op==='!=')return v!==c.v; return true; }); } }); }
  return Promise.resolve({forEach:cb=>docs.forEach(cb), docs, size:docs.length, empty:docs.length===0}); }
function __deepMerge(t,s){ for(const k in s){ const v=s[k]; if(v&&typeof v==='object'&&!Array.isArray(v)&&!v.__ts){ if(!t[k]||typeof t[k]!=='object')t[k]={}; __deepMerge(t[k],v);} else t[k]=v; } return t; }
function setDoc(ref, data, opts){ const path=ref.path; if(opts&&opts.merge){ const cur=__store[path]||{}; __store[path]=__deepMerge(__clone(cur), __clone(data)); } else { __store[path]=__clone(data); } __afterWrite(path); return Promise.resolve(); }
function updateDoc(ref, data){ const path=ref.path; if(__store[path]==null) return Promise.reject({code:'not-found'}); const cur=__store[path];
  for(const key in data){ const val=data[key]; if(key.indexOf('.')>=0){ const parts=key.split('.'); let o=cur; for(let i=0;i<parts.length-1;i++){ if(!o[parts[i]]||typeof o[parts[i]]!=='object')o[parts[i]]={}; o=o[parts[i]]; } o[parts[parts.length-1]]=__clone(val); } else { cur[key]=__clone(val); } }
  __afterWrite(path); return Promise.resolve(); }
function addDoc(colRef, data){ const id='d'+(__uidSeq++); const path=colRef.path+'/'+id; __store[path]=__clone(data); __afterWrite(path); return Promise.resolve({id, path}); }
function deleteDoc(ref){ const path=ref.path; __store[path]=null; delete __store[path]; __afterWrite(path); return Promise.resolve(); }
function onSnapshot(ref, cb, errCb){ const isDoc=!!ref.__doc; const path=__refPath(ref); const kind=isDoc?'doc':'col'; const l={kind,path,cb}; __listeners.push(l);
  setTimeout(()=>{ try{ cb(isDoc?__docSnap(path):__colSnap(path)); }catch(e){ if(errCb)errCb(e); } },0);
  return ()=>{ const i=__listeners.indexOf(l); if(i>=0)__listeners.splice(i,1); }; }
function runTransaction(db, fn){ const tx={ get:ref=>Promise.resolve(__docSnap(ref.path)), set:(ref,data)=>{__store[ref.path]=__clone(data);__afterWrite(ref.path);}, update:(ref,data)=>updateDoc(ref,data), delete:ref=>deleteDoc(ref) }; return Promise.resolve(fn(tx)); }
function writeBatch(db){ const ops=[]; return { set:(r,d,o)=>ops.push(()=>setDoc(r,d,o)), update:(r,d)=>ops.push(()=>updateDoc(r,d)), delete:r=>ops.push(()=>deleteDoc(r)), commit:async()=>{ for(const op of ops) await op(); } }; }
__seed();
/* ===== end stub ===== */
`;

// Introspection hooks appended at the very end of the module (before </script>).
const HOOKS = `
;window.__can = can; window.__roleCapVal = roleCapVal; window.__canManageSessions = canManageSessions; window.__isOwner = isOwner;
window.__nav = ()=>{ const n=document.getElementById('appNav'); return {display:n.style.display, html:n.innerHTML}; };
window.__contentHtml = ()=>document.getElementById('appContent').innerHTML;
window.__has = id=>!!document.getElementById(id);
window.__click = id=>{ const e=document.getElementById(id); if(e){e.click();return true;} return false; };
window.__store = __store;
window.__setTab = t=>{ adminTab=t; renderNav(); route(); };
window.__openSession = sid=>openSession(sid);
window.__del = sid=>deleteSession(sid);
window.__editUser = uid=>renderUserEdit(uid);
window.__openReport = sid=>openVarianceReport(sid,'home');
// ر٧: خطاطيف شاشة التقارير الموحّدة (م١٩)
window.__repxReady = ()=>_repxReady;
window.__repxModel = name=>repxModel(name);
window.__repxCsv = name=>repxBuildCsv(name);
window.__repxPrintHtml = name=>{ repxBuildPrint(name); return document.getElementById('repPrintArea').innerHTML; };
window.__repxSessIds = ()=>repxScopedSessions().map(s=>s.id);
window.__repxActive = ()=>repxActive;
// ر٨: خطاطيف دفتر الحركات وهيكل المستودعات (م١٦) — إضافية بجانب __repx*
window.__featuresLedgerOn = ()=>featuresLedgerOn();
window.__ledReady = ()=>_ledReady;
window.__ledMoves = ()=>ledMoves.map(x=>Object.assign({},x));
window.__ledSeed = arr=>{ ledMoves=(arr||[]).map(x=>Object.assign({},x)); _ledReady=true; };
window.__ledLoad = ()=>ledLoad().then(a=>{ ledMoves=a; return a; });
window.__ledFold = moves=>ledFold(moves||ledMoves);
window.__ledBalances = ()=>ledFold(ledMoves);
window.__ledBalance = (loc,sku)=>ledBalance(ledMoves,loc,sku);
window.__ledMove = m=>ledRecordMove(m);
window.__ledValidate = m=>ledValidate(m, ledActiveBins(), ledFold(ledMoves));
window.__ledNextRef = ()=>ledNextRef();
window.__ledKpis = cat=>ledKpis(ledMoves, ledActiveBins(), cat||ledCatalog);
window.__ledSearch = q=>ledSearch(ledMoves,q);
window.__ledBins = ()=>ledActiveBins();
window.__ledTop = n=>ledTopLocations(ledMoves,ledActiveBins(),n);
window.__ledRender = ()=>{ try{ ledRenderAll(); }catch(e){} };
window.__ledSep = ()=>LED_SEP;
// محرّر الهيكل (يتخطّى prompt في الاختبار)
window.__ledSetWhCode = (w,c)=>ledSetWhCode(w,c);
window.__ledAddZone = (w,i,n)=>ledAddZone(w,i,n);
window.__ledAddShelf = (w,z,i,n)=>ledAddShelf(w,z,i,n);
window.__ledAddBin = (w,z,s,i,cap)=>ledAddBin(w,z,s,i,cap);
window.__ledSetCap = (w,z,s,b,cap)=>ledSetCap(w,z,s,b,cap);
window.__ledRemoveBin = (w,z,s,b)=>ledRemoveBin(w,z,s,b);
// ر٨-ب: خطاطيف إدارة الفروع (م١٧) — إضافية بجانب __led*
window.__featuresBranchesOn = ()=>featuresBranchesOn();
window.__brxReady = ()=>_brxReady;
window.__brxLoad = ()=>brxLoad().then(()=>true);
window.__brxIsCentral = ()=>brxIsCentral();
window.__brxModels = ()=>brxAllModels();
window.__brxBranchModel = bid=>{ const b=brxBranches.find(x=>x.id===bid); return b?brxBranchModel(b):null; };
window.__brxVisible = ()=>brxVisibleBranches().map(b=>b.id);
window.__brxBest = ()=>brxBestByAccuracy();
window.__brxStats = ()=>brxStats();
window.__brxActive = bid=>brxBranchActive(bid);
window.__brxSetActive = (bid,a)=>brxSetActive(bid,a);
window.__brxCanCreate = bid=>brxCanCreateInBranch(bid);
window.__brxSessSum = ()=>brxSessSum.map(x=>Object.assign({},x));
// إصلاح-٣ (بند ٢): خطّافات إنشاء/تحرير الفرع + حارس الفرع المعطّل + قائمة المستخدمين
window.__brxCreate = (d)=>brxCreateBranch(d);
window.__brxUpdate = (id,d)=>brxUpdateBranch(id,d);
window.__brxUsers = ()=>brxUsers.map(u=>Object.assign({},u));
window.__locDisabled = (loc)=>locationInDisabledBranch(loc);
window.__createSession = ()=>createSession();
// ر٩: خطاطيف كتالوج المنتجات (م١٥) — إضافية بجانب __brx*
window.__featuresProductCatalogOn = ()=>featuresProductCatalogOn();
window.__pxReady = ()=>_pxReady;
window.__pxLoad = ()=>pxLoad().then(()=>true);
window.__pxProducts = ()=>pxProducts.map(p=>Object.assign({},p));
window.__pxGet = sku=>{ const p=pxFind(sku); return p?Object.assign({},p):null; };
window.__pxCreate = card=>pxCreateCard(card);
window.__pxSave = (sku,patch)=>pxSaveCard(sku,patch);
window.__pxSetStatus = (sku,status)=>pxSetStatus(sku,status);
window.__pxAddVariant = (sku,name)=>pxAddVariant(sku,name);
window.__pxAddAttr = (sku,k,v)=>pxAddAttr(sku,k,v);
window.__pxAddImage = (sku,url)=>pxAddImage(sku,url);
window.__pxMigrate = item=>pxMigrateManualItem(item);
window.__pxHistory = sku=>pxHistoryOf(sku);
window.__pxEligible = ()=>pxNewSessionEligible().map(p=>p.sku);
window.__pxSeedMoves = arr=>{ pxMoves=(arr||[]).map(x=>Object.assign({},x)); };
window.__pxClassify = ()=>pxClassifyAll();
window.__pxCardClass = sku=>pxCardClass(sku);
window.__pxPackToBase = (pack,packs)=>pxPackToBase(pack,packs);
window.__pxBaseToPack = (pack,base)=>pxBaseToPack(pack,base);
window.__pxBarcodeSvg = code=>pxBarcodeSvg(code);
window.__pxQrSvg = sku=>pxQrSvg(sku);
window.__pxPid = sku=>pxPid(sku);
window.__pxRender = ()=>{ try{ pxRenderAll(); }catch(e){} };
// م١٨: خطاطيف مركز الإدارة والإعدادات والنسخ/السلامة وتسوية العدّ
window.__appSettings = ()=>appSettings();
window.__printCfg = ()=>printCfg(); // المحطّة ٢: إعدادات المخرجات المركزية
window.__exportCfg = ()=>exportCfg();
window.__reportCfg = ()=>reportCfg();
window.__acSaveOutput = ()=>acSaveOutput();
window.__docSignatories = ()=>docSignatories(); // المحطّة ٥
window.__docColumns = ()=>docColumns(); // المحطّة ٣
window.__docTemplate = (k)=>docTemplate(k); // المحطّة ٤
window.__docSubst = (t,rk)=>docSubst(t, docVarCtx(rk||'committee', [])); // المحطّة ٤
window.__acSaveDocTpl = ()=>acSaveDocTemplate();
window.__sysDefaults = ()=>sysDefaults(); // المحطّة ٦
window.__acSavePersonalize = ()=>acSavePersonalize();
// مهلة السكون: خطاطيف الاختبار — إظهار التنبيه فورًا دون انتظار المهلة
window.__idleCfg = ()=>idleCfg();
window.__idleLastSet = (ms)=>{ _idleLast=Number(ms)||Date.now(); try{ localStorage.setItem(idleKey(),String(_idleLast)); }catch(e){} };
window.__idleCheck = ()=>idleElapsedCheck();
window.__curNotes = ()=>curNotes; // ملاحظات العدّ الحيّة
window.__countsMap = ()=>curCounts; // الخريطة الكاملة (لا تلمس __curCounts القديم — يعيد المفاتيح فقط)
window.__addEntry = (c,v)=>addEntry(c,v);
window.__pendingAdds = ()=>_pendingAdds;
window.__noteSave = (c)=>noteSave(c);
window.__noteDraftSet = (c,t)=>{ _noteDraft[String(c)]=t; };
window.__snapCacheGet = (sid)=>snapCacheGet(sid);
window.__snapCacheSet = (sid,items)=>snapCacheSet(sid,items);
window.__idleWarnNow = ()=>idleWarn();
window.__idleActive = ()=>!!document.getElementById('idleWarn');
window.__idleReset = ()=>idleReset();
// الهوية والشعار: خطاطيف اختبار الشعار (افتراضي/مخصّص) والترويسة والحفظ والطبع على العلامات
window.__brandingCfg = ()=>brandingCfg();
window.__brandMarkHtml = ()=>brandMarkHtml();
window.__printLogoHtml = ()=>printLogoHtml();
window.__defaultLogoSvg = (s,px)=>defaultLogoSvg(s,px);
window.__applyBrandMarks = ()=>{ try{ applyBrandMarks(); }catch(e){} };
window.__setBrandingLogo = (v)=>{ _brandingLogoData=v; };
window.__acSaveBranding = ()=>acSaveBranding();
window.__acClearLogo = ()=>acClearLogo();
window.__fmtDateTimeAr = (v)=>fmtDateTimeAr(v); // إصلاح خلل «:٦٠»: تنسيق وقت حتمي
// الموقّعون في بداية الجلسة + المحاضر الجديدة + تصدير إكسل
window.__sigRoster = ()=>sigRoster();
window.__setSessSig = (a)=>{ _sessSig=a; };
window.__sessSigCollect = ()=>sessSigCollect();
window.__createSession = ()=>createSession();
window.__handoverReady = ()=>handoverReady();
window.__exportAoa = (reason)=>{ const R=EXPORT_REASONS[reason]; return R&&R.cols?excelSheetFromCols(exportRowsFor(R),R.cols):null; };
window.__repxXlsxAoa = (name)=>repxXlsxAoa(name);
window.__openPrintDialog = ()=>{ try{ openPrintDialog(); }catch(e){} };
window.__openExportDialog = ()=>{ try{ openExportDialog(); }catch(e){} };
window.__disp = (id)=>{ const e=document.getElementById(id); return e?getComputedStyle(e).display:'ABSENT'; };
window.__buildReasonPrint = (k)=>{ buildPrintReport(k); return document.getElementById('repPrintArea').innerHTML; };
window.__acBuildBackup = ()=>acBuildBackup();
window.__acChecksum = (s)=>acChecksum(s); // إصلاح-٥ (بند ١١): بناء بصمة صحيحة في الاختبار
window.__safeId = (c)=>safeId(c); // إصلاح-٥ (بند ٨)
window.__repxCsvEsc = (v)=>repxCsvEsc(v); // إصلاح-٥ (بند ١٠)
window.__acIntegrity2 = ()=>acRunIntegrity(); // إصلاح-٥ (بند ١٨)
window.__acRestore = j=>acRestoreBackup(j);
window.__acIntegrity = ()=>acRunIntegrity();
window.__acLoadActivity = ()=>acLoadActivity(100);
window.__deriveNotifs = ()=>deriveNotifs(_notifCache);
window.__deriveNotifsList = (list)=>deriveNotifs(list); // إصلاح-٥ (بند ٧)
window.__resetItem = code=>resetItem(code);
window.__removeEntry = (code,i)=>removeEntry(code,i);
window.__addEntry = (code,v)=>addEntry(code,v);
window.__curCounts = ()=>Object.keys(curCounts||{});
// ر١٠ (م٢٤): خطاطيف العدّ دون اتصال — تُمرَّر تجربة الطابور/المزامنة عبر بديل localStorage (IndexedDB محجوب على file://)
window.__featuresOfflineOn = ()=>featuresOfflineOn();
window.__offline = {
  setOnline:(b)=>{ _forcedOnline = (b===null? null : !!b); offlineUpdateChip(); return (b? (featuresOfflineOn()? offlineFlush(false) : Promise.resolve()) : Promise.resolve()); },
  isOnline:()=>netOnline(),
  queue:()=>offlineQueueGet(),
  len:()=>offlineQueueGet().then(q=>q.length),
  flush:()=>offlineFlush(true),
  deviceId:()=>offlineDeviceId(),
  enqueue:(op)=>offlineEnqueueAndReflect(op),
  syncStatus:()=>offlineGetSyncStatus(),
  setSyncStatus:(s)=>offlineSetSyncStatus(s),
  failNext:(b)=>{ _offlineForceFail = !!b; },
  rejectNext:(b)=>{ _offlineForceReject = !!b; }, // إصلاح-٢ (بند ٣أ): محاكاة رفض صلاحية/قاعدة
  rejected:()=>offlineStore.get(OFFLINE_REJECTED_KEY),
  clearRejected:()=>offlineStore.set(OFFLINE_REJECTED_KEY,[]),
  setOnlineNoFlush:(b)=>{ _forcedOnline=(b===null?null:!!b); offlineUpdateChip(); }, // إصلاح-٢ (بند ٣ب): اتصال بلا مزامنة تلقائية — لاختبار السباق
  backend:()=>offlineStore.backend(),
  refreshLen:()=>offlineRefreshLen()
};
window.__ppShown = ()=>{ const o=document.getElementById('ppOverlay'); return !!(o && o.style.display==='flex'); };
// ر١١: خطاطيف النسخ الاحتياطي إلى Dropbox — إضافية بجانب __offline (كل HTTP يمرّ عبر dbxFetch الذي تعترضه window.__dbxMock)
window.__featuresDropboxOn = ()=>featuresDropboxOn();
window.__dbxTick = ()=>dbxAutoTick(true); // force: يتخطّى كابح المحاولة فقط — الشروط والاستحقاق كما هي
window.__dbxAuthUrl = ()=>dbxAuthStart(); // يعيد الرابط الذي سيُنتقَل إليه (null بلا App Key)
window.__dbx = {
  connected:()=>dbxConnected(),
  stored:()=>dbxStored(),
  token:()=>dbxAccessToken(),
  backup:()=>dbxRunBackup('manual'),
  buildFull:()=>dbxBuildFullBackup(),
  list:()=>dbxListBackups(),
  restore:(p)=>dbxRestoreConfig(p),
  status:()=>dbxGetStatus(),
  account:()=>dbxAccount(),
  disconnect:()=>dbxDisconnect(),
  handleRedirect:()=>dbxHandleRedirect()
};
window.__syncStrip = ()=>{ try{ syncStripRefresh(); return true; }catch(e){ return false; } };
// إصلاح-٤: خطاطيف ملخّص الجلسة والكفاءة (بند ٤ + بند ٦)
window.__featuresSessionSummaryOn = ()=>featuresSessionSummaryOn();
window.__computeSessionSummary = (items,counts)=>computeSessionSummary(items,counts);
window.__sessWriteSummary = (sid,items,counts)=>sessWriteSummary(sid,items,counts);
window.__notifEnrichVariance = (list)=>notifEnrichVariance(list);
window.__sessVariancePct = (items,counts)=>sessVariancePct(items,counts);
window.__ledLoadCatalog = ()=>ledLoadCatalog();
window.__ledCatalog = ()=>Object.assign({},ledCatalog);
window.__ledSetCatalog = (c)=>{ ledCatalog=c||{}; };
window.__ready = true;
`;

let out = withoutImports.replace(/<script type="module">/, '<script type="module">' + STUB);
// insert hooks before the final </script> of the module (last </script> in file)
const lastClose = out.lastIndexOf('</script>');
out = out.slice(0, lastClose) + HOOKS + out.slice(lastClose);

fs.writeFileSync('harness.html', out);
console.log('harness.html written', out.length, 'bytes');
