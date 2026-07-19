// النسخ الاحتياطي السحابي التلقائي — يعمل في GitHub Actions مجدولًا (بلا جهاز، بلا فتح التطبيق)
// يقرأ Firestore كاملًا بحساب خدمة، ويرفع JSON موقّتًا إلى Dropbox عبر refresh token دائم.
// الأسرار المطلوبة (Settings → Secrets → Actions): FIREBASE_SERVICE_ACCOUNT، DROPBOX_APP_KEY، DROPBOX_APP_SECRET، DROPBOX_REFRESH_TOKEN
import admin from 'firebase-admin';

const sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || '{}');
if (!sa.project_id) { console.error('سرّ FIREBASE_SERVICE_ACCOUNT مفقود/غير صالح'); process.exit(1); }
admin.initializeApp({ credential: admin.credential.cert(sa) });
const db = admin.firestore();

// تفريغ متكرر: كل مجموعة عليا + مجموعاتها الفرعية (counts/snapshot/extraItems/activity/history…)
async function dumpDoc(ref) {
  const snap = await ref.get(); const out = { _id: ref.id, ...(snap.exists ? snap.data() : {}) };
  for (const col of await ref.listCollections()) {
    out['__' + col.id] = [];
    for (const d of await col.listDocuments()) out['__' + col.id].push(await dumpDoc(d));
  }
  return out;
}
const backup = { at: new Date().toISOString(), project: sa.project_id, collections: {} };
for (const col of await db.listCollections()) {
  backup.collections[col.id] = [];
  for (const d of await col.listDocuments()) backup.collections[col.id].push(await dumpDoc(d));
  console.log('✓', col.id, backup.collections[col.id].length, 'وثيقة');
}
const body = JSON.stringify(backup);
console.log('الحجم:', Math.round(body.length / 1024), 'KB');

// رمز وصول جديد من refresh token (لا ينتهي)
const tok = await fetch('https://api.dropbox.com/oauth2/token', {
  method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: process.env.DROPBOX_REFRESH_TOKEN,
    client_id: process.env.DROPBOX_APP_KEY, client_secret: process.env.DROPBOX_APP_SECRET })
}).then(r => r.json());
if (!tok.access_token) { console.error('فشل تجديد رمز Dropbox:', JSON.stringify(tok)); process.exit(1); }

const name = '/IOMP-Backups/iomp-cloud-backup-' + new Date().toISOString().slice(0, 10) + '.json';
const up = await fetch('https://content.dropboxapi.com/2/files/upload', {
  method: 'POST',
  headers: { Authorization: 'Bearer ' + tok.access_token, 'Content-Type': 'application/octet-stream',
    'Dropbox-API-Arg': JSON.stringify({ path: name, mode: 'overwrite', mute: true }) },
  body
});
if (!up.ok) { console.error('فشل الرفع:', up.status, await up.text()); process.exit(1); }
console.log('☁ رُفعت النسخة السحابية:', name);
