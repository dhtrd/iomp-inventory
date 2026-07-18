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
    users: { u_asgn: { 'session.assign': true, count: false }, u_vw: { 'report.view': true } }, // «تكليف» وحده + مطّلع بالاطّلاع الكامل — لاختبار نطاق القراءة
    userLocations: { u_loc: ['فرع أ'] },
    warehouses: [{ id: 'w1', name: 'فرع أ', deleted: false }],
  });
  await setDoc(doc(d, 'users/u_owner'), { email: 'a2@dhtrd.com', role: 'مدير', active: true });
  await setDoc(doc(d, 'users/u_wh'),    { email: 'wh@x.com', role: 'مدير مخزون', active: true });
  await setDoc(doc(d, 'users/u_ct'),    { email: 'ct@x.com', role: 'عدّاد', active: true });
  await setDoc(doc(d, 'users/u_vw'),    { email: 'vw@x.com', role: 'مطّلع', active: true });
  await setDoc(doc(d, 'users/u_loc'),   { email: 'loc@x.com', role: 'مطّلع', active: true });
  await setDoc(doc(d, 'users/u_off'),   { email: 'off@x.com', role: 'عدّاد', active: false });
  await setDoc(doc(d, 'users/u_asgn'),  { email: 'asgn@x.com', role: 'عدّاد', active: true });
  // جلسات
  await setDoc(doc(d, 'sessions/s_open'),  { name:'مفتوحة', status:'open', started:true, assignedCounters:['u_ct'], location:'فرع أ', createdBy:'u_owner' });
  await setDoc(doc(d, 'sessions/s_setup'), { name:'تجهيز', status:'open', started:false, assignedCounters:[], location:'فرع ب', createdBy:'u_owner' });
  await setDoc(doc(d, 'sessions/s_rev'),   { name:'مراجعة', status:'review', started:true, assignedCounters:['u_ct'], location:'فرع ب', createdBy:'u_owner' });
  await setDoc(doc(d, 'sessions/s_appr'),  { name:'معتمدة', status:'approved', started:true, assignedCounters:['u_ct'], location:'فرع ب', createdBy:'u_owner' });
  await setDoc(doc(d, 'sessions/s_openB'), { name:'مفتوحة ب', status:'open', started:true, assignedCounters:['u_x'], location:'فرع ب', createdBy:'u_owner' });
  await setDoc(doc(d, 'sessions/s_open/counts/c1'), { code:'A', qty:5 });
  await setDoc(doc(d, 'sessions/s_openB/counts/c1'), { code:'A', qty:5 });
  await setDoc(doc(d, 'sessions/s_open/activity/a1'), { type:'start', by:'u_owner', at:new Date() }); // سجل حركة لجلسة حيّة (غير محذوفة)
  // جلسة في السلة (محذوفة ناعماً) — لاختبار الحذف النهائي لسجلّ الحركة واللقطة
  await setDoc(doc(d, 'sessions/s_trash'), { name:'محذوفة', status:'open', started:false, deleted:true, assignedCounters:[], location:'فرع ب', createdBy:'u_owner' });
  await setDoc(doc(d, 'sessions/s_trash/activity/a1'), { type:'assign', by:'u_owner', at:new Date() });
  await setDoc(doc(d, 'sessions/s_trash/snapshot/chunk_0000'), { items:[{ code:'A' }] });
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

// ---- المستخدمون ----
await T('مدير المستخدمين (المالك): ينشئ مستخدماً', assertSucceeds(setDoc(doc(db('u_owner'), 'users/u_new'), { email:'n@x.com', role:'عدّاد', active:true })));
await T('العدّاد: يُمنع من إنشاء مستخدم', assertFails(setDoc(doc(db('u_ct'), 'users/u_new2'), { email:'n2@x.com', role:'عدّاد', active:true })));
await T('المالك محميّ: يُمنع تعديل حساب المالك', assertFails(updateDoc(doc(db('u_owner'), 'users/u_owner'), { role:'عدّاد' })));
await T('المستخدم: يحدّث حقل تغيير كلمة المرور لنفسه', assertSucceeds(updateDoc(doc(db('u_ct'), 'users/u_ct'), { mustChangePassword:false })));
await T('المستخدم: يُمنع من ترقية دوره لنفسه', assertFails(updateDoc(doc(db('u_ct'), 'users/u_ct'), { role:'مدير' })));

// ---- العدّ ----
await T('العدّاد المكلَّف: يعدّ في جلسة مفتوحة مبدوءة', assertSucceeds(setDoc(doc(db('u_ct'), 'sessions/s_open/counts/c2'), { code:'B', qty:1 })));
await T('العدّاد غير المكلَّف: يُمنع من العدّ', assertFails(setDoc(doc(db('u_ct'), 'sessions/s_openB/counts/c2'), { code:'B', qty:1 })));
await T('العدّ في جلسة قيد المراجعة: مُنع', assertFails(setDoc(doc(db('u_ct'), 'sessions/s_rev/counts/c2'), { code:'B', qty:1 })));

// ---- تحوّلات الجلسة ----
await T('إغلاق للمراجعة: المالك', assertSucceeds(updateDoc(doc(db('u_owner'), 'sessions/s_open'), { status:'review', closedBy:'u_owner', closedByName:'م', closedAt:new Date() })));
await T('إغلاق للمراجعة: العدّاد مُنع', assertFails(updateDoc(doc(db('u_ct'), 'sessions/s_openB'), { status:'review', closedBy:'u_ct' })));
await T('الاعتماد: من جلسة «تمت المراجعة» فقط', assertFails(updateDoc(doc(db('u_owner'), 'sessions/s_open'), { status:'approved', approvedBy:'u_owner' })));

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

await testEnv.cleanup();
console.log(`\nRECON ${pass}/${pass + fail} passed`);
process.exit(fail ? 1 : 0);
