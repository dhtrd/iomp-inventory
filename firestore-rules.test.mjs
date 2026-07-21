// اختبارات قواعد أمان Firestore — تُشغَّل بالمحاكي المحلي.
//   npm i -D @firebase/rules-unit-testing firebase
//   firebase emulators:exec --only firestore "node firestore-rules.test.mjs"
// (لا تعمل في بيئة السحابة هنا لأن تنزيل محرّك المحاكي محجوب — شغّلها على جهازك.)
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { doc, setDoc, updateDoc, getDoc, deleteDoc, getDocs, collection } from 'firebase/firestore';
import { readFileSync } from 'node:fs';

const testEnv = await initializeTestEnvironment({
  projectId: 'demo-iomp',
  firestore: { rules: readFileSync('firestore.rules', 'utf8') },
});
let pass = 0, fail = 0;
async function T(name, p) { try { await p; console.log('✓ ' + name); pass++; } catch (e) { console.log('✗ ' + name + '  << ' + (e.message||e)); fail++; } }
const db = (uid) => uid ? testEnv.authenticatedContext(uid).firestore() : testEnv.unauthenticatedContext().firestore();

// ---- بذور (بقواعد معطّلة) ----
await testEnv.withSecurityRulesDisabled(async (ctx) => {
  const d = ctx.firestore();
  await setDoc(doc(d, 'config/permissions'), {
    roles: { 'مطّلع': { 'report.view': false, 'report.view.location': true } },
    users: { u_asgn: { 'session.assign': true, count: false }, u_vw: { 'report.view': true }, u_fin: { 'session.approve.finance': true }, u_gm: { 'session.approve.gm': true }, u_bmgr: { 'branch.manage': true } }, // «تكليف» وحده + مطّلع + موقّعا سلسلة م١٤ (مالي/عام) + مدير فرع (م١٧)
    userLocations: { u_loc: ['فرع أ'], u_bmgr: ['مستودع الرياض'] },
    warehouses: [{ id: 'w1', name: 'فرع أ', deleted: false }],
  });
  await setDoc(doc(d, 'users/u_owner'), { email: 'a2@dhtrd.com', role: 'مدير', active: true });
  await setDoc(doc(d, 'users/u_wh'),    { email: 'wh@x.com', role: 'مدير مخزون', active: true });
  await setDoc(doc(d, 'users/u_ct'),    { email: 'ct@x.com', role: 'عدّاد', active: true });
  await setDoc(doc(d, 'users/u_vw'),    { email: 'vw@x.com', role: 'مطّلع', active: true });
  await setDoc(doc(d, 'users/u_loc'),   { email: 'loc@x.com', role: 'مطّلع', active: true });
  await setDoc(doc(d, 'users/u_off'),   { email: 'off@x.com', role: 'عدّاد', active: false });
  await setDoc(doc(d, 'users/u_asgn'),  { email: 'asgn@x.com', role: 'عدّاد', active: true });
  await setDoc(doc(d, 'users/u_fin'),   { email: 'fin@x.com', role: 'عدّاد', active: true });  // مدير مالي (بالاستثناء الفردي) — سلسلة م١٤
  await setDoc(doc(d, 'users/u_gm'),    { email: 'gm@x.com', role: 'عدّاد', active: true });   // مدير عام (بالاستثناء الفردي) — سلسلة م١٤
  await setDoc(doc(d, 'users/u_bmgr'),  { email: 'bmgr@x.com', role: 'مدير مخزون', active: true }); // مدير فرع (م١٧) — branch.manage بالاستثناء الفردي، مقيَّد بمستودعات فرعه
  // جلسات
  await setDoc(doc(d, 'sessions/s_open'),  { name:'مفتوحة', status:'open', started:true, assignedCounters:['u_ct'], location:'فرع أ', createdBy:'u_owner' });
  await setDoc(doc(d, 'sessions/s_setup'), { name:'تجهيز', status:'open', started:false, assignedCounters:[], location:'فرع ب', createdBy:'u_owner' });
  await setDoc(doc(d, 'sessions/s_rev'),   { name:'مراجعة', status:'review', started:true, assignedCounters:['u_ct'], location:'فرع ب', createdBy:'u_owner' });
  await setDoc(doc(d, 'sessions/s_appr'),  { name:'معتمدة', status:'approved', started:true, assignedCounters:['u_ct'], location:'فرع ب', createdBy:'u_owner' });
  await setDoc(doc(d, 'sessions/s_openB'), { name:'مفتوحة ب', status:'open', started:true, assignedCounters:['u_x'], location:'فرع ب', createdBy:'u_owner' });
  // سلسلة اعتماد م١٤ — جلسات بحالات السلسلة
  await setDoc(doc(d, 'sessions/s_reviewed'), { name:'تمت المراجعة', status:'reviewed', started:true, assignedCounters:['u_ct'], location:'فرع ب', createdBy:'u_owner' });
  await setDoc(doc(d, 'sessions/s_rev2'), { name:'مراجعة٢', status:'reviewed', started:true, assignedCounters:['u_ct'], location:'فرع ب', createdBy:'u_owner' }); // إصلاح-١: لاختبار منع مدير المخزون من السلسلة + الاعتماد الأحادي
  await setDoc(doc(d, 'sessions/s_finappr'),  { name:'اعتماد مالي', status:'fin_approved', started:true, assignedCounters:['u_ct'], location:'فرع ب', createdBy:'u_owner', finApprovedBy:'u_fin', finApprovedByName:'م', finSig:'SIG-DEADBEEF' });
  await setDoc(doc(d, 'sessions/s_finappr2'), { name:'اعتماد مالي ٢', status:'fin_approved', started:true, assignedCounters:['u_ct'], location:'فرع ب', createdBy:'u_owner', finApprovedBy:'u_fin', finApprovedByName:'م', finSig:'SIG-DEADBEEF' });
  await setDoc(doc(d, 'sessions/s_open/counts/c1'), { code:'A', qty:5 });
  await setDoc(doc(d, 'sessions/s_openB/counts/c1'), { code:'A', qty:5 });
  await setDoc(doc(d, 'sessions/s_open/activity/a1'), { type:'start', by:'u_owner', at:new Date() }); // سجل حركة لجلسة حيّة (غير محذوفة)
  // جلسة في السلة (محذوفة ناعماً) — لاختبار الحذف النهائي لسجلّ الحركة واللقطة
  await setDoc(doc(d, 'sessions/s_trash'), { name:'محذوفة', status:'open', started:false, deleted:true, assignedCounters:[], location:'فرع ب', createdBy:'u_owner' });
  await setDoc(doc(d, 'sessions/s_trash/activity/a1'), { type:'assign', by:'u_owner', at:new Date() });
  await setDoc(doc(d, 'sessions/s_trash/snapshot/chunk_0000'), { items:[{ code:'A' }] });
  // دفتر الحركات وعدّاد الترقيم (م١٦) — خلف علم warehouseLedger
  await setDoc(doc(d, 'counters/movements'), { seq:5 });
  await setDoc(doc(d, 'movements/m_exist'), { wh:'RY', ref:'MV-0001', type:'in', sku:'A', qty:1, from:'', to:'RY/A/R1/B1', by:'u_owner', at:new Date() });
  // الفروع (م١٧) — فرعان: الرياض يديره u_bmgr، جدة مركزيّ. كل بياناتهما جردية (مشتقّة من الجلسات في التطبيق).
  await setDoc(doc(d, 'branches/b_ry'), { name:'فرع الرياض', city:'الرياض', managerUid:'u_bmgr', managerName:'م', warehouses:['مستودع الرياض'], active:true, counters:[] });
  await setDoc(doc(d, 'branches/b_jd'), { name:'فرع جدة', city:'جدة', managerUid:'u_owner', managerName:'المالك', warehouses:['مستودع جدة'], active:true, counters:[] });
  await setDoc(doc(d, 'branches/b_ry/activity/a1'), { type:'enable', by:'u_owner', byName:'م', at:new Date() });
  // كتالوج المنتجات (م١٥) — خلف علم features.productCatalog. بطاقة قائمة + قيد تاريخ (ملحق-فقط).
  await setDoc(doc(d, 'products/PRD-1'), { sku:'PRD-1', barcode:'PRD-1', name:'منتج', status:'active', unit:'حبة', pack:12, createdBy:'u_owner' });
  await setDoc(doc(d, 'products/PRD-1/history/h1'), { type:'create', detail:'PRD-1', by:'u_owner', byName:'المالك', at:new Date() });
});

// ---- غير موثَّق ----
await T('غير موثَّق: يُمنع قراءة الجلسات', assertFails(getDoc(doc(db(), 'sessions/s_open'))));
await T('غير موثَّق: يُمنع قراءة الإعدادات', assertFails(getDoc(doc(db(), 'config/permissions'))));

// ---- الحساب المعطّل ----
await T('حساب معطّل: يُمنع من العدّ', assertFails(setDoc(doc(db('u_off'), 'sessions/s_open/counts/c2'), { code:'B', qty:1 })));

// ---- الإعدادات/الصلاحيات ----
await T('المالك: يعدّل الإعدادات', assertSucceeds(updateDoc(doc(db('u_owner'), 'config/permissions'), { note: 'x' })));
await T('العدّاد: يُمنع من تعديل الإعدادات', assertFails(updateDoc(doc(db('u_ct'), 'config/permissions'), { note: 'x' })));
await T('مدير مخزون: يعدّل المستودعات فقط', assertSucceeds(updateDoc(doc(db('u_wh'), 'config/permissions'), { warehouses: [{id:'w2',name:'فرع ب'}], updatedBy:'u_wh' })));
await T('مدير مخزون: يُمنع من تعديل الأدوار', assertFails(updateDoc(doc(db('u_wh'), 'config/permissions'), { roles: { 'عدّاد': { 'perms.manage': true } } })));

// ---- وصلة Dropbox المركزية ----
await T('وصلة Dropbox المركزية: المدير يكتبها ويقرؤها', assertSucceeds(setDoc(doc(db('u_owner'), 'config/dropbox'), { link:{rt:'x'} })));
await T('وصلة Dropbox المركزية: العدّاد ممنوع من قراءتها', assertFails(getDoc(doc(db('u_ct'), 'config/dropbox'))));

// ---- المستخدمون ----
await T('مدير المستخدمين (المالك): ينشئ مستخدماً', assertSucceeds(setDoc(doc(db('u_owner'), 'users/u_new'), { email:'n@x.com', role:'عدّاد', active:true })));
await T('العدّاد: يُمنع من إنشاء مستخدم', assertFails(setDoc(doc(db('u_ct'), 'users/u_new2'), { email:'n2@x.com', role:'عدّاد', active:true })));
await T('المالك محميّ: يُمنع تعديل حساب المالك', assertFails(updateDoc(doc(db('u_owner'), 'users/u_owner'), { role:'عدّاد' })));
await T('هوية المالك: تعديل الاسم/المسمى فقط مسموح', assertSucceeds(updateDoc(doc(db('u_owner'), 'users/u_owner'), { name:'أحمد الضبيبي', title:'المدير العام' })));
await T('هوية المالك: الاسم مع الدور معًا مرفوض', assertFails(updateDoc(doc(db('u_owner'), 'users/u_owner'), { name:'س', role:'عدّاد' })));
await T('هوية المالك: تعطيل حالة المالك مرفوض', assertFails(updateDoc(doc(db('u_owner'), 'users/u_owner'), { active:false })));
await T('هوية المالك: العدّاد يُمنع من تعديل اسم المالك', assertFails(updateDoc(doc(db('u_ct'), 'users/u_owner'), { name:'س' })));
await T('المستخدم: يحدّث حقل تغيير كلمة المرور لنفسه', assertSucceeds(updateDoc(doc(db('u_ct'), 'users/u_ct'), { mustChangePassword:false })));
await T('المستخدم: يُمنع من ترقية دوره لنفسه', assertFails(updateDoc(doc(db('u_ct'), 'users/u_ct'), { role:'مدير' })));

// ---- العدّ ----
await T('العدّاد المكلَّف: يعدّ في جلسة مفتوحة مبدوءة', assertSucceeds(setDoc(doc(db('u_ct'), 'sessions/s_open/counts/c2'), { code:'B', qty:1 })));
await T('العدّاد غير المكلَّف: يُمنع من العدّ', assertFails(setDoc(doc(db('u_ct'), 'sessions/s_openB/counts/c2'), { code:'B', qty:1 })));
await T('العدّ في جلسة قيد المراجعة: مُنع', assertFails(setDoc(doc(db('u_ct'), 'sessions/s_rev/counts/c2'), { code:'B', qty:1 })));

// ---- ملاحظات العدّ (itemNotes) — نفس نطاق العدّ ----
await T('الملاحظات: العدّاد المكلَّف يسجّل ملاحظة في جلسته المفتوحة', assertSucceeds(setDoc(doc(db('u_ct'), 'sessions/s_open/itemNotes/A'), { code:'A', notes:[{id:'n1',text:'تالف',by:'u_ct',byName:'عدّاد',at:1}] })));
await T('الملاحظات: غير المكلَّف يُمنع من التسجيل', assertFails(setDoc(doc(db('u_ct'), 'sessions/s_openB/itemNotes/A'), { code:'A', notes:[] })));
await T('الملاحظات: ممنوعة والجلسة قيد المراجعة', assertFails(setDoc(doc(db('u_ct'), 'sessions/s_rev/itemNotes/A'), { code:'A', notes:[] })));
await T('الملاحظات: المطّلع «الكل» يقرؤها', assertSucceeds(getDocs(collection(db('u_vw'), 'sessions/s_open/itemNotes'))));

// ---- إدارة ما نُسي (بعد البدء) ----
await T('ما نُسي: المدير يضيف عدّادين وموقّعين بعد البدء', assertSucceeds(updateDoc(doc(db('u_owner'), 'sessions/s_open'), { assignedCounters:['u_ct','u_x2'], assignedNames:['عدّاد','إضافي'], signatories:[{title:'رئيس اللجنة',name:'خالد'}] })));
await T('ما نُسي: العدّاد ممنوع من التعديل', assertFails(updateDoc(doc(db('u_ct'), 'sessions/s_open'), { signatories:[{title:'س',name:'ص'}] })));
await T('ما نُسي: دمج تغيير الحالة معها مرفوض', assertFails(updateDoc(doc(db('u_owner'), 'sessions/s_open'), { signatories:[], started:false })));

// ---- تحوّلات الجلسة ----
await T('إغلاق للمراجعة: المالك', assertSucceeds(updateDoc(doc(db('u_owner'), 'sessions/s_open'), { status:'review', closedBy:'u_owner', closedByName:'م', closedAt:new Date() })));
await T('إغلاق للمراجعة: العدّاد مُنع', assertFails(updateDoc(doc(db('u_ct'), 'sessions/s_openB'), { status:'review', closedBy:'u_ct' })));
await T('الاعتماد: من جلسة «تمت المراجعة» فقط', assertFails(updateDoc(doc(db('u_owner'), 'sessions/s_open'), { status:'approved', approvedBy:'u_owner' })));

// ---- سلسلة اعتماد م١٤ (الرفوضات أولاً — غير مُغيِّرة للحالة — ثم النجاحات) ----
await T('سلسلة (لا قفز): المالي لا يقفز من «تمت المراجعة» إلى «معتمدة»', assertFails(updateDoc(doc(db('u_fin'), 'sessions/s_reviewed'), { status:'approved', approvedBy:'u_fin', approvedByName:'م', approvedByTitle:'مالي', approvedChairman:'', approvedAt:new Date(), gmSig:'SIG-11112222' })));
await T('سلسلة (لا قفز): العام لا يعتمد قبل المالي (من «تمت المراجعة»)', assertFails(updateDoc(doc(db('u_gm'), 'sessions/s_reviewed'), { status:'approved', approvedBy:'u_gm', approvedByName:'م', approvedByTitle:'عام', approvedChairman:'', approvedAt:new Date(), gmSig:'SIG-33334444' })));
await T('سلسلة (فصل): المالي لا يملك خطوة القفل العام (من «اعتماد مالي»)', assertFails(updateDoc(doc(db('u_fin'), 'sessions/s_finappr'), { status:'approved', approvedBy:'u_fin', approvedByName:'م', approvedByTitle:'مالي', approvedChairman:'', approvedAt:new Date(), gmSig:'SIG-77778888' })));
await T('سلسلة: المدير المالي يعتمد «تمت المراجعة» → «اعتماد مالي» (بتوقيع)', assertSucceeds(updateDoc(doc(db('u_fin'), 'sessions/s_reviewed'), { status:'fin_approved', finApprovedBy:'u_fin', finApprovedByName:'م', finApprovedByTitle:'مالي', finApprovedAt:new Date(), finSig:'SIG-AABBCCDD' })));
await T('سلسلة: المدير العام يقفل «اعتماد مالي» → «معتمدة» (بتوقيع ثانٍ)', assertSucceeds(updateDoc(doc(db('u_gm'), 'sessions/s_finappr'), { status:'approved', approvedBy:'u_gm', approvedByName:'م', approvedByTitle:'عام', approvedChairman:'', approvedAt:new Date(), gmSig:'SIG-55556666' })));
await T('سلسلة: المالي يرفض ويعيد «اعتماد مالي» → «تمت المراجعة»', assertSucceeds(updateDoc(doc(db('u_fin'), 'sessions/s_finappr2'), { status:'reviewed' })));
// إصلاح-٤ (الكفاءة): كتابة ملخّص الجلسة المشتقّ (حقل summary فقط) — لِمن يملك الحوكمة فقط، ولا تهريب حالة عبره
await T('إصلاح-٤: صاحب الحوكمة (المالك) يكتب ملخّص الجلسة (summary فقط)', assertSucceeds(updateDoc(doc(db('u_owner'), 'sessions/s_appr'), { summary:{ v:1, itemCount:3, counted:2, netVar:-16, varPct:6.67 } })));
await T('إصلاح-٤: العدّاد يُمنع من كتابة ملخّص الجلسة', assertFails(updateDoc(doc(db('u_ct'), 'sessions/s_appr'), { summary:{ v:1, itemCount:3 } })));
await T('إصلاح-٤: المطّلع (بلا حوكمة) يُمنع من كتابة الملخّص', assertFails(updateDoc(doc(db('u_vw'), 'sessions/s_appr'), { summary:{ v:1 } })));
await T('إصلاح-٤: لا تهريب حالة عبر الملخّص (summary+status ⇒ رفض)', assertFails(updateDoc(doc(db('u_owner'), 'sessions/s_appr'), { summary:{ v:1 }, status:'open' })));

// ---- الحذف والسلة ----
await T('حذف ناعم لجلسة غير مبدوءة: مسموح', assertSucceeds(updateDoc(doc(db('u_owner'), 'sessions/s_setup'), { deleted:true, deletedBy:'u_owner', deletedByName:'م', deletedAt:new Date() })));
await T('حذف ناعم لجلسة مبدوءة: مُنع', assertFails(updateDoc(doc(db('u_owner'), 'sessions/s_open'), { deleted:true, deletedBy:'u_owner', deletedByName:'م', deletedAt:new Date() })));
await T('الحذف النهائي: العدّاد مُنع', assertFails(deleteDoc(doc(db('u_ct'), 'sessions/s_setup'))));

// ---- نطاق الاطّلاع (البيانات الحسّاسة) ----
await T('مطّلع «الكل»: يقرأ عدّات أي جلسة', assertSucceeds(getDocs(collection(db('u_vw'), 'sessions/s_openB/counts'))));
await T('مطّلع بنطاق الموقع: يقرأ عدّات فرعه (فرع أ)', assertSucceeds(getDocs(collection(db('u_loc'), 'sessions/s_open/counts'))));
await T('مطّلع بنطاق الموقع: يُمنع من عدّات فرع آخر (فرع ب)', assertFails(getDocs(collection(db('u_loc'), 'sessions/s_openB/counts'))));

// ---- «التكليف» وحده لا يمنح قراءة البيانات الحسّاسة (إصلاح ثغرة المُكلِّف) ----
await T('«تكليف» وحده: يُمنع من قراءة عدّات جلسة غير مُسندة إليه', assertFails(getDocs(collection(db('u_asgn'), 'sessions/s_openB/counts'))));

// ---- صلاحيتا كلمة المرور القابلتان للضبط ----
await T('مطّلع (له pw.request): يرفع «طلب إعادة التعيين» لنفسه', assertSucceeds(updateDoc(doc(db('u_vw'), 'users/u_vw'), { pwResetRequested:true, pwResetRequestedAt:new Date() })));
await T('عدّاد (بلا pw.request): يُمنع من رفع الطلب', assertFails(updateDoc(doc(db('u_ct'), 'users/u_ct'), { pwResetRequested:true, pwResetRequestedAt:new Date() })));

// ---- الحذف النهائي من السلة (يشمل سجل الحركة واللقطة، وبشرط أن تكون في السلة) ----
await T('حماية سجل الحركة: يُمنع محو حركة جلسة حيّة (غير محذوفة)', assertFails(deleteDoc(doc(db('u_owner'), 'sessions/s_open/activity/a1'))));
await T('الحذف النهائي: يحذف سجل الحركة (من السلة)', assertSucceeds(deleteDoc(doc(db('u_owner'), 'sessions/s_trash/activity/a1'))));
await T('الحذف النهائي: يحذف اللقطة', assertSucceeds(deleteDoc(doc(db('u_owner'), 'sessions/s_trash/snapshot/chunk_0000'))));
await T('الحذف النهائي: يُمنع لجلسة ليست في السلة', assertFails(deleteDoc(doc(db('u_owner'), 'sessions/s_openB'))));
await T('الحذف النهائي: يحذف مستند الجلسة المحذوفة', assertSucceeds(deleteDoc(doc(db('u_owner'), 'sessions/s_trash'))));

// ---- دفتر الحركات وعدّاد الترقيم (م١٦) — الرفوضات (غير المُغيِّرة) أولًا ثم النجاحات ----
await T('العدّاد: يُمنع من قيد حركة (لا يملك stock.move)', assertFails(setDoc(doc(db('u_ct'), 'movements/m_ct'), { wh:'RY', ref:'MV-9001', type:'in', sku:'A', qty:1, from:'', to:'RY/A/R1/B1', by:'u_ct', at:new Date() })));
await T('مدير مخزون: يُمنع القيد بفاعلٍ ليس هو (by ≠ uid)', assertFails(setDoc(doc(db('u_wh'), 'movements/m_spoof'), { wh:'RY', ref:'MV-9002', type:'in', sku:'A', qty:1, from:'', to:'RY/A/R1/B1', by:'u_owner', at:new Date() })));
await T('الدفتر append-only: يُمنع تعديل حركة قائمة', assertFails(updateDoc(doc(db('u_owner'), 'movements/m_exist'), { qty:99 })));
await T('الدفتر: يُمنع حذف حركة لمن لا يملك trash.purge (مدير مخزون)', assertFails(deleteDoc(doc(db('u_wh'), 'movements/m_exist'))));
await T('العدّاد: يُمنع من زيادة عدّاد الترقيم', assertFails(setDoc(doc(db('u_ct'), 'counters/movements'), { seq:99 })));
await T('مطّلع (report.view): يقرأ الدفتر ضمن نطاق الاطّلاع', assertSucceeds(getDoc(doc(db('u_vw'), 'movements/m_exist'))));
await T('مدير مخزون: يقيّد حركة بـ by == uid', assertSucceeds(setDoc(doc(db('u_wh'), 'movements/m_wh'), { wh:'RY', ref:'MV-9003', type:'in', sku:'A', qty:2, from:'', to:'RY/A/R1/B1', by:'u_wh', at:new Date() })));
await T('مدير مخزون: يزيد عدّاد الترقيم (لخدمة المعاملة)', assertSucceeds(setDoc(doc(db('u_wh'), 'counters/movements'), { seq:6 })));

// ---- الفروع (م١٧) — الرفوضات (غير المُغيِّرة) أولًا ثم النجاحات ----
// قراءة: عدّاد بلا نطاق يُمنع؛ مدير الفرع يقرأ فرعه.
await T('الفروع: عدّاد بلا نطاق يُمنع من قراءة فرع', assertFails(getDoc(doc(db('u_ct'), 'branches/b_ry'))));
await T('الفروع: مدير الفرع يقرأ فرعه', assertSucceeds(getDoc(doc(db('u_bmgr'), 'branches/b_ry'))));
// تحديث: مدير الفرع لا يعطّل (active مركزيّ)، ولا يعيد تعيين المدير، وغير المركزي لا يُنشئ، والعدّاد لا يحذف.
await T('الفروع: مدير الفرع يُمنع من التعطيل (active مركزيّ)', assertFails(updateDoc(doc(db('u_bmgr'), 'branches/b_ry'), { active:false, updatedBy:'u_bmgr' })));
await T('الفروع: مدير الفرع يُمنع من إعادة تعيين المدير', assertFails(updateDoc(doc(db('u_bmgr'), 'branches/b_ry'), { managerUid:'u_ct', updatedBy:'u_bmgr' })));
await T('الفروع: مدير مخزون (غير مركزي، ليس المدير) يُمنع من إنشاء فرع', assertFails(setDoc(doc(db('u_wh'), 'branches/b_new'), { name:'فرع دخيل', managerUid:'u_wh', warehouses:['x'], active:true, counters:[] })));
await T('الفروع: مدير فرع «الرياض» يُمنع من تحديث فرع «جدة» (ليس مديره)', assertFails(updateDoc(doc(db('u_bmgr'), 'branches/b_jd'), { counters:['u_ct'], updatedBy:'u_bmgr' })));
await T('الفروع: العدّاد يُمنع من حذف فرع (لا trash.purge)', assertFails(deleteDoc(doc(db('u_ct'), 'branches/b_ry'))));
await T('سجل الفرع append-only: يُمنع تعديل قيد قائم', assertFails(updateDoc(doc(db('u_owner'), 'branches/b_ry/activity/a1'), { type:'x' })));
// النجاحات (المُغيِّرة) أخيرًا
await T('الفروع: المركزي (المالك) يُنشئ فرعًا', assertSucceeds(setDoc(doc(db('u_owner'), 'branches/b_new'), { name:'فرع جديد', managerUid:'u_bmgr', managerName:'م', warehouses:['مستودع الدمام'], active:true, counters:[] })));
await T('الفروع: المركزي يعطّل فرع «جدة» (active=false) — يمنع الجديد لا القائم', assertSucceeds(updateDoc(doc(db('u_owner'), 'branches/b_jd'), { active:false, updatedBy:'u_owner', updatedByName:'م', updatedAt:new Date() })));
await T('الفروع: مدير الفرع يحدّث «العدّادين» في فرعه (حقل مسموح)', assertSucceeds(updateDoc(doc(db('u_bmgr'), 'branches/b_ry'), { counters:['u_ct'], updatedBy:'u_bmgr', updatedByName:'م', updatedAt:new Date() })));
await T('الفروع: المركزي يقيّد قيد تحكّم إلحاقيًّا في سجل الفرع', assertSucceeds(setDoc(doc(db('u_owner'), 'branches/b_ry/activity/a2'), { type:'disable', by:'u_owner', byName:'م', at:new Date() })));

// ---- كتالوج المنتجات (م١٥) — الرفوضات (غير المُغيِّرة) أولًا ثم النجاحات ----
// الكتابة لحاملي warehouse.manage فقط؛ التاريخ ملحق-فقط (إنشاء بالفاعل نفسه، لا تعديل).
await T('الكتالوج: العدّاد يُمنع من إنشاء بطاقة (لا warehouse.manage)', assertFails(setDoc(doc(db('u_ct'), 'products/PRD-2'), { sku:'PRD-2', name:'x', status:'draft', createdBy:'u_ct' })));
await T('الكتالوج: مطّلع يُمنع من تعديل بطاقة (لا warehouse.manage)', assertFails(updateDoc(doc(db('u_vw'), 'products/PRD-1'), { name:'y' })));
await T('الكتالوج: التاريخ append-only — يُمنع تعديل قيد قائم', assertFails(updateDoc(doc(db('u_owner'), 'products/PRD-1/history/h1'), { type:'x' })));
await T('الكتالوج: يُمنع قيد تاريخ بفاعلٍ ليس هو (by ≠ uid)', assertFails(setDoc(doc(db('u_wh'), 'products/PRD-1/history/h_spoof'), { type:'edit', by:'u_owner', at:new Date() })));
await T('الكتالوج: العدّاد يُمنع من حذف بطاقة (لا trash.purge)', assertFails(deleteDoc(doc(db('u_ct'), 'products/PRD-1'))));
await T('الكتالوج: مطّلع (نشط) يقرأ بطاقة (مرجعية غير حسّاسة)', assertSucceeds(getDoc(doc(db('u_vw'), 'products/PRD-1'))));
// النجاحات (المُغيِّرة) أخيرًا
await T('الكتالوج: مدير مخزون (warehouse.manage) يُنشئ بطاقة', assertSucceeds(setDoc(doc(db('u_wh'), 'products/PRD-3'), { sku:'PRD-3', name:'z', status:'draft', unit:'حبة', pack:1, createdBy:'u_wh' })));
await T('الكتالوج: مدير مخزون يقيّد قيد تاريخ (by == uid)', assertSucceeds(setDoc(doc(db('u_wh'), 'products/PRD-1/history/h_wh'), { type:'edit', detail:'z', by:'u_wh', byName:'م', at:new Date() })));

// ===== إصلاح-١ (التقوية الأمنية) =====
// بند ١: مدير المخزون لا يملك توقيعَي السلسلة افتراضًا؛ والاعتماد الأحادي يعمل حين السلسلة معطّلة
await T('إصلاح-١/١: مدير المخزون يُمنع من الاعتماد المالي (سلسلة)', assertFails(updateDoc(doc(db('u_wh'), 'sessions/s_rev2'), { status:'fin_approved', finApprovedBy:'u_wh', finApprovedByName:'م', finApprovedByTitle:'مخزون', finApprovedAt:new Date(), finSig:'SIG-WH00' })));
await T('إصلاح-١/١: الاعتماد الأحادي يعمل حين السلسلة معطّلة (المالك)', assertSucceeds(updateDoc(doc(db('u_owner'), 'sessions/s_rev2'), { status:'approved', approvedBy:'u_owner', approvedByName:'م', approvedByTitle:'مدير', approvedChairman:'', approvedAt:new Date() })));
// بند ٥: سماحا المظهر
await T('إصلاح-١/٥: المستخدم يزامن مظهره لنفسه', assertSucceeds(updateDoc(doc(db('u_ct'), 'users/u_ct'), { appearance:{ mode:'dark', density:'compact' } })));
await T('إصلاح-١/٥: يُمنع تعديل مظهر مستخدم آخر', assertFails(updateDoc(doc(db('u_ct'), 'users/u_vw'), { appearance:{ mode:'dark' } })));
await T('إصلاح-١/٥: config/appearance تُقرأ لأي نشط', assertSucceeds(getDoc(doc(db('u_ct'), 'config/appearance'))));
await T('إصلاح-١/٥: المالك (perms.manage) يكتب مظهر المؤسسة', assertSucceeds(setDoc(doc(db('u_owner'), 'config/appearance'), { appearance:{ mode:'dark' }, updatedBy:'u_owner', updatedAt:new Date() })));
await T('إصلاح-١/٥: العدّاد يُمنع من كتابة مظهر المؤسسة', assertFails(setDoc(doc(db('u_ct'), 'config/appearance'), { appearance:{ mode:'dark' } })));
// بند ١٥: منع حذف قيود الدفتر إطلاقًا (حتى لحامل trash.purge)
await T('إصلاح-١/١٥: حتى المالك (trash.purge) يُمنع من حذف قيد حركة', assertFails(deleteDoc(doc(db('u_owner'), 'movements/m_exist'))));
// بند ١٦: قراءة عدّاد الترقيم لمصادَق نشط فقط
await T('إصلاح-١/١٦: حساب معطّل يُمنع من قراءة عدّاد الترقيم', assertFails(getDoc(doc(db('u_off'), 'counters/movements'))));
// بند ١٧: قراءة الكتالوج (فيه التكلفة) للمخوّلين لا العدّادين
await T('إصلاح-١/١٧: العدّاد يُمنع من قراءة بطاقة المنتج (فيها التكلفة)', assertFails(getDoc(doc(db('u_ct'), 'products/PRD-1'))));
await T('إصلاح-١/١٧: مدير المخزون يقرأ بطاقة المنتج', assertSucceeds(getDoc(doc(db('u_wh'), 'products/PRD-1'))));

// ---- إعداد «الاطلاع بعد الإغلاق فقط» (viewersAfterClose) — يُفعَّل هنا ثم تُفحص بواباته ----
await testEnv.withSecurityRulesDisabled(async (ctx) => {
  const d = ctx.firestore();
  await setDoc(doc(d, 'config/permissions'), { viewersAfterClose: true }, { merge: true });
});
await T('بعد الإغلاق فقط: المطّلع يُمنع من عدّات جلسة مفتوحة', assertFails(getDocs(collection(db('u_vw'), 'sessions/s_open/counts'))));
await T('بعد الإغلاق فقط: المطّلع يقرأ عدّات جلسة قيد المراجعة', assertSucceeds(getDocs(collection(db('u_vw'), 'sessions/s_rev/counts'))));
await T('بعد الإغلاق فقط: العدّاد المكلَّف يظل يقرأ جلسته المفتوحة', assertSucceeds(getDocs(collection(db('u_ct'), 'sessions/s_open/counts'))));
await T('بعد الإغلاق فقط: المالك (حوكمة) يظل يقرأ المفتوحة', assertSucceeds(getDocs(collection(db('u_owner'), 'sessions/s_open/counts'))));
await testEnv.withSecurityRulesDisabled(async (ctx) => {
  const d = ctx.firestore();
  await setDoc(doc(d, 'config/permissions'), { viewersAfterClose: false }, { merge: true });
});
await T('إطفاء الإعداد يعيد السلوك: المطّلع يقرأ المفتوحة', assertSucceeds(getDocs(collection(db('u_vw'), 'sessions/s_open/counts'))));

await testEnv.cleanup();
console.log(`\nRECON ${pass}/${pass + fail} passed`);
process.exit(fail ? 1 : 0);
