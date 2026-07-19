// ر١١ — اختبارات تحسين حقول القوائم المنسدلة (select UX)
// يثبت: (1) تنسيق عام مصقول لكل <select>، (2) دعم الوضع الداكن، (3) عدم انحدار
// العنصر الأصيل بعد التحسين البحثي (permUser)، (4) بناء الطبقة البحثيّة مع RTL/داكن،
// (5) البحث يُرشّح، (6) النقر يختار ويُطلق change، (7) Escape يُغلق، (8) نمط المعطّل.
import { chromium } from 'playwright-core';
import { execSync } from 'node:child_process';
import path from 'node:path';

execSync('node build_harness.js', { cwd: process.cwd(), stdio: 'inherit' });

const EXE = process.env.CHROME_EXE || '/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell';
const HARNESS = 'file://' + path.resolve('harness.html');
const b64 = (o) => Buffer.from(JSON.stringify(o), 'utf8').toString('base64');

const USERS = [
  { uid:'u_owner', email:'a2@dhtrd.com', name:'المالك', role:'مدير', active:true },
  { uid:'u_wh', email:'wh@dhtrd.com', name:'أمين المخزن', role:'مدير مخزون', title:'أمين المستودع', active:true },
  { uid:'u_ct', email:'ct@dhtrd.com', name:'عدّاد ١', role:'عدّاد', active:true },
  { uid:'u_vw', email:'vw@dhtrd.com', name:'مطّلع ١', role:'مطّلع', active:true },
];
const prof = (uid) => USERS.find(u=>u.uid===uid);

const results = [];
const ok = (name, cond, detail='') => results.push({ name, pass: !!cond, detail });

const browser = await chromium.launch({ executablePath: EXE, args: ['--no-sandbox'] });
const ctx = await browser.newContext({ viewport: { width: 960, height: 1200 } });

async function load(page, sc) {
  await page.goto(HARNESS + '?s=' + encodeURIComponent(b64(sc)));
  await page.waitForFunction('window.__ready===true', { timeout: 8000 });
  await page.evaluate(()=>{ try{ localStorage.clear(); }catch(e){} }); // عزل الاختبارات
  await page.waitForTimeout(140);
}
const owner = () => ({ user:{uid:'u_owner',email:'a2@dhtrd.com'}, profile:prof('u_owner'), users:USERS });

// ---- U1/U2: تنسيق عام مصقول + أمان الوضع الداكن على select أصيل غير مُحسَّن (ue_role) ----
{
  const page = await ctx.newPage();
  await load(page, owner());
  await page.evaluate(()=>window.__editUser('u_ct'));
  await page.waitForTimeout(250);
  const info = await page.evaluate(()=>{
    const s=document.getElementById('ue_role'); if(!s) return null;
    const cs=getComputedStyle(s);
    return { ap:(cs.appearance||cs.webkitAppearance||''), bg:cs.backgroundImage, pl:parseFloat(cs.paddingLeft)||0, tag:s.tagName };
  });
  ok('U1 تنسيق عام: appearance:none + سهم SVG على اليسار + مساحة تمنع التداخل',
     !!info && info.ap==='none' && /svg/i.test(info.bg) && info.pl>=30,
     JSON.stringify(info && {ap:info.ap, hasSvg:/svg/i.test(info.bg), pl:info.pl}));
  // الوضع الداكن
  await page.evaluate(()=>document.documentElement.setAttribute('data-theme','dark'));
  await page.waitForTimeout(40);
  const dk = await page.evaluate(()=>{ const s=document.getElementById('ue_role'); const cs=getComputedStyle(s);
    return { scheme:cs.colorScheme, bg:cs.backgroundColor }; });
  ok('U2 داكن آمن: color-scheme=dark وخلفية القائمة داكنة (ليست بيضاء)',
     /dark/.test(dk.scheme) && dk.bg!=='rgb(255, 255, 255)', JSON.stringify(dk));
  await page.close();
}
// ---- U3: عدم انحدار — permUser.value + onchange() برمجيًا لا يزال يحدّث الحالة (يحاكي S9) ----
{
  const page = await ctx.newPage();
  await load(page, owner());
  await page.evaluate(()=>window.__setTab('settings'));
  await page.waitForTimeout(280);
  const sel = await page.evaluate(()=>{ const s=document.getElementById('permUser'); if(!s)return 'no-sel';
    s.value='u_ct'; s.onchange(); return 'ok'; });
  await page.waitForTimeout(130);
  const box = await page.evaluate(()=>window.__has('saveUserOvr'));
  ok('U3 برمجيًا: ضبط value + استدعاء onchange() يفتح المحرّر (لا انحدار)', sel==='ok'&&box, `sel=${sel} box=${box}`);
  await page.evaluate(()=>{ const s=document.querySelector('.ucap[data-cap="session.approve"]'); if(s)s.value='on'; });
  await page.evaluate(()=>window.__click('saveUserOvr'));
  await page.waitForTimeout(220);
  const saved = await page.evaluate(()=>{ const c=window.__store['config/permissions']; return c&&c.users&&c.users['u_ct']?c.users['u_ct']['session.approve']:null; });
  ok('U3 الحفظ عبر العنصر الأصيل يعمل: u_ct.session.approve=true', saved===true, `saved=${saved}`);
  await page.close();
}
// ---- U4: الطبقة البحثيّة مبنيّة + العنصر الأصيل محفوظ + RTL + داكن آمن ----
{
  const page = await ctx.newPage();
  await load(page, owner());
  await page.evaluate(()=>window.__setTab('settings'));
  await page.waitForTimeout(280);
  const built = await page.evaluate(()=>{
    const nat=document.querySelector('.selx .selx-native#permUser');
    const btn=document.querySelector('.selx .selx-btn');
    const pop=document.querySelector('.selx-pop');
    const dir=document.documentElement.getAttribute('dir');
    const btnAlign = btn?getComputedStyle(btn).textAlign:'';
    document.documentElement.setAttribute('data-theme','dark');
    const popBgDark = pop?getComputedStyle(pop).backgroundColor:'';
    document.documentElement.setAttribute('data-theme','light');
    return { nat:!!nat, btn:!!btn, pop:!!pop, opts:nat?nat.options.length:0, id:nat?nat.id:'', dir, btnAlign, popBgDark };
  });
  ok('U4 الطبقة مبنيّة وpermUser الأصيل محفوظ (id+خيارات)، RTL، وداكن آمن',
     built.nat&&built.btn&&built.pop&&built.id==='permUser'&&built.opts>1&&built.dir==='rtl'
       &&(built.btnAlign==='start'||built.btnAlign==='right')&&built.popBgDark!=='rgb(255, 255, 255)',
     JSON.stringify(built));
  await page.close();
}
// ---- U5: الكتابة في البحث تُرشّح الخيارات الظاهرة ----
{
  const page = await ctx.newPage();
  await load(page, owner());
  await page.evaluate(()=>window.__setTab('settings'));
  await page.waitForTimeout(280);
  await page.evaluate(()=>{ const b=document.querySelector('.selx .selx-btn'); if(b)b.click(); });
  await page.waitForTimeout(70);
  const res = await page.evaluate(()=>{
    const all=document.querySelectorAll('.selx-opt').length;
    const s=document.querySelector('.selx-search'); s.value='عدّاد'; s.dispatchEvent(new Event('input',{bubbles:true}));
    const opts=[...document.querySelectorAll('.selx-opt')].map(o=>o.textContent);
    return { all, count:opts.length, match:opts.some(t=>t.includes('عدّاد')) };
  });
  ok('U5 البحث يُرشّح: عدد الخيارات ينقص ويبقى المطابق', res.all>res.count && res.count>=1 && res.match,
     `all=${res.all} filtered=${res.count} match=${res.match}`);
  await page.close();
}
// ---- U6: النقر على خيار يضبط قيمة العنصر الأصيل ويُطلق change ثم يُغلق ----
{
  const page = await ctx.newPage();
  await load(page, owner());
  await page.evaluate(()=>window.__setTab('settings'));
  await page.waitForTimeout(280);
  await page.evaluate(()=>{ const b=document.querySelector('.selx .selx-btn'); if(b)b.click(); });
  await page.waitForTimeout(70);
  const clicked = await page.evaluate(()=>{
    const opt=[...document.querySelectorAll('.selx-opt')].find(o=>o.textContent.includes('عدّاد ١'));
    if(!opt)return 'no-opt'; opt.click(); return 'ok';
  });
  await page.waitForTimeout(160);
  const after = await page.evaluate(()=>{
    const pop=document.querySelector('.selx-pop');
    return { val:document.getElementById('permUser').value, box:window.__has('saveUserOvr'),
      closed: !!pop && (pop.hidden===true || getComputedStyle(pop).display==='none') };
  });
  ok('U6 النقر يختار: يضبط permUser.value + يُطلق change (يفتح المحرّر) + يُغلق القائمة',
     clicked==='ok'&&after.val==='u_ct'&&after.box&&after.closed, JSON.stringify(after));
  await page.close();
}
// ---- U7: Escape يُغلق القائمة ----
{
  const page = await ctx.newPage();
  await load(page, owner());
  await page.evaluate(()=>window.__setTab('settings'));
  await page.waitForTimeout(280);
  await page.evaluate(()=>{ const b=document.querySelector('.selx .selx-btn'); if(b)b.click(); });
  await page.waitForTimeout(70);
  const openState = await page.evaluate(()=>document.querySelector('.selx-pop').hidden===false);
  await page.evaluate(()=>{ const s=document.querySelector('.selx-search'); s.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true})); });
  await page.waitForTimeout(60);
  const closedState = await page.evaluate(()=>document.querySelector('.selx-pop').hidden===true);
  ok('U7 Escape يُغلق القائمة المنسدلة', openState&&closedState, `open=${openState} closed=${closedState}`);
  await page.close();
}
// ---- U8: القائمة المعطّلة تُظهر نمط المعطّل ولا يمكن تغييرها من المستخدم ----
{
  const page = await ctx.newPage();
  await load(page, owner());
  const dis = await page.evaluate(()=>{
    const s=document.createElement('select'); s.disabled=true; s.innerHTML='<option>أ</option><option>ب</option>';
    document.body.appendChild(s);
    const cs=getComputedStyle(s);
    const r={ disabled:s.disabled, cursor:cs.cursor, opacity:parseFloat(cs.opacity), ap:(cs.appearance||cs.webkitAppearance||'') };
    s.remove(); return r;
  });
  ok('U8 المعطّل: disabled=true + cursor:not-allowed + شفافية<1 + appearance:none',
     dis.disabled===true && dis.cursor==='not-allowed' && dis.opacity<1 && dis.ap==='none', JSON.stringify(dis));
  await page.close();
}

await browser.close();

let pass=0, fail=0;
for (const r of results){ console.log(`${r.pass?'✓':'✗'} ${r.name}${r.pass?'':'  << '+r.detail}`); r.pass?pass++:fail++; }
console.log(`\nRECON ${pass}/${pass+fail} passed`);
process.exit(fail?1:0);
