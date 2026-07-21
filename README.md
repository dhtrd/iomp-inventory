# نظام إدارة الجرد متعدد المستخدمين (IOMP) — شركة الضبيبي التجارية

تطبيق ويب بملف واحد (`index.html`) على Firebase (خطة Spark المجانية) — عربي RTL أولًا.

## التشغيل والاختبار
```bash
npm install
npx playwright-core install chromium
export CHROME_EXE=$(node -e "console.log(require('playwright-core').chromium.executablePath())")
npm test        # ٧٠٢ اختبارًا للتطبيق الحي (٤٠ ملفًا)
```
اختبارات قواعد الأمان (تحتاج Java):
```bash
npm i @firebase/rules-unit-testing firebase firebase-tools
npx firebase emulators:exec --only firestore --project demo-iomp "node firestore-rules.test.mjs"
```

## البنية
- `index.html` — التطبيق كاملًا (بلا إطار عمل)
- `firestore.rules` — قواعد الأمان (الفرض الخادمي للصلاحيات)
- `test_*.mjs` + `build_harness.js` — حزمة الاختبار (Playwright + محاكاة Firebase)
- `prototypes/` — نماذج مراحل التصميم م١١–م٢٥ باختباراتها (٢٨٢ اختبارًا إضافيًّا)
- `docs/` — وثائق المراحل والأدلة الثمانية ومعايير النظام

## CI/CD
كل دفع إلى `main`: اختبارات التطبيق (٧٠٢) + اختبارات القواعد بالمحاكي ← وعند الخضرة: نشر تلقائي إلى GitHub Pages.
