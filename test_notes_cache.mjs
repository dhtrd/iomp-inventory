// اختبارات: ملاحظات العدّ (checkbox لكل صنف → تسجيل → تقرير/طباعة) + كاش لقطة الأصناف (حل الاتصال الضعيف).
import { chromium } from 'playwright-core';
import { execSync } from 'node:child_process';
import path from 'node:path';
execSync('node build_harness.js', { cwd: process.cwd(), stdio: 'inherit' });
const EXE = process.env.CHROME_EXE || '/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell';
const HARNESS = 'file://' + path.resolve('harness.html');
const b64 = (o) => Buffer.from(JSON.stringify(o), 'utf8').toString('base64');
const OWNER = { uid:'u_owner', email:'a2@dhtrd.com', name:'المالك', role:'مدير', active:true };
const CHUNKS=[[{code:'A1',name:'صنف أول',category:'ك',book:5,cost:2},{code:'B2',name:'صنف ثانٍ',category:'ك',book:3,cost:1}]];
const OPEN=(extra)=>Object.assign({id:'sx',name:'جرد الملاحظات',status:'open',started:true,startedAt:{__ts:Date.now()-3600000},assignedCounters:['u_owner'],assignedNames:['المالك'],location:'فرع أ',itemCount:2,createdBy:'u_owner',__chunks:CHUNKS},extra);
const results=[]; const ok=(n,c,d='')=>results.push({n,pass:!!c,d});
const browser=await chromium.launch({ executablePath:EXE, args:['--no-sandbox'] });
const ctx=await browser.newContext({ viewport:{width:1200,height:1500} });
async function load(page,sc){ await page.addInitScript(()=>{ try{ localStorage.clear(); }catch(e){} }); await page.goto(HARNESS+'?s='+encodeURIComponent(b64(sc))); await page.waitForFunction('window.__ready===true',{timeout:8000}); await page.waitForTimeout(150); }

// ===== CN1 — شاشة العد: checkbox «ملاحظة» يفتح المحرّر، والحفظ يكتب الملاحظة وتظهر فورًا =====
{ const page=await ctx.newPage(); await load(page,{profile:OWNER,users:[OWNER],sessions:[OPEN()]});
  await page.evaluate(()=>window.__openSession('sx')); await page.waitForTimeout(500);
  const hasCb=await page.evaluate(()=>document.querySelectorAll('#clist .cnotecb').length);
  await page.evaluate(()=>{ const cb=document.querySelector('#clist .cnotecb[data-code="A1"]'); cb.checked=true; cb.onchange(); }); await page.waitForTimeout(150);
  const editor=await page.evaluate(()=>!!document.querySelector('#clist .cnotetxt[data-code="A1"]'));
  await page.evaluate(()=>{ window.__noteDraftSet('A1','٥ عبوات تالفة'); return window.__noteSave('A1'); }); await page.waitForTimeout(300);
  const st=await page.evaluate(()=>window.__store['sessions/sx/itemNotes/A1']);
  const chip=await page.evaluate(()=>document.getElementById('clist').innerHTML.includes('٥ عبوات تالفة'));
  ok('CN1 لكل صنف مربّع «ملاحظة»', hasCb===2, String(hasCb));
  ok('CN1 تفعيل المربّع يفتح محرّر الملاحظة', editor===true);
  ok('CN1 الحفظ يكتب الملاحظة باسم كاتبها', st&&Array.isArray(st.notes)&&st.notes.length===1&&st.notes[0].text==='٥ عبوات تالفة'&&st.notes[0].byName==='المالك', JSON.stringify(st));
  ok('CN1 الملاحظة تظهر فورًا تحت الصنف', chip===true);
  const act=await page.evaluate(()=>{ const st2=window.__store; for(const k in st2){ if(k.indexOf('sessions/sx/activity/')===0&&st2[k]&&st2[k].type==='note')return st2[k]; } return null; });
  ok('CN1 تُسجَّل في سجل الحركة (note)', act&&String(act.name||'').includes('تالفة'), JSON.stringify(act));
  await page.close(); }

// ===== CN2 — التقرير: عمود «الملاحظات» تلقائي، الصنف غير المعدود يبقى غير معدود، والبحث يلتقط نص الملاحظة =====
{ const page=await ctx.newPage(); await load(page,{profile:OWNER,users:[OWNER],sessions:[OPEN({status:'approved',approvedByName:'المالك',
    __counts:[{code:'A1',qty:5}], __notes:[{code:'B2',notes:[{id:'n1',text:'موجود في المستودع الآخر',by:'u_x',byName:'مجاهد',at:1}]}]})]});
  await page.evaluate(()=>window.__openReport('sx')); await page.waitForTimeout(500);
  const t=await page.evaluate(()=>document.getElementById('repTable').innerHTML);
  ok('CN2 عمود «الملاحظات» يظهر تلقائيًّا', t.includes('الملاحظات')&&t.includes('موجود في المستودع الآخر')&&t.includes('مجاهد'), '');
  const uncounted=await page.evaluate(()=>{ const rows=[...document.querySelectorAll('#repTable tbody tr')]; const r=rows.find(x=>x.textContent.includes('صنف ثانٍ')); return r?r.textContent:''; });
  ok('CN2 الملاحظة لا تجعل الصنف «معدودًا»', uncounted.includes('غير معدود'), uncounted.slice(0,60));
  await page.evaluate(()=>{ const i=document.getElementById('repSearch'); i.value='المستودع الآخر'; i.dispatchEvent(new Event('input')); }); await page.waitForTimeout(200);
  const only=await page.evaluate(()=>document.querySelectorAll('#repTable tbody tr').length);
  const hit=await page.evaluate(()=>document.getElementById('repTable').textContent.includes('صنف ثانٍ'));
  ok('CN2 البحث في التقرير يلتقط نص الملاحظة', only===1&&hit, String(only));
  await page.close(); }

// ===== CN3 — الطباعة: الملاحظات تدخل المحضر تلقائيًّا =====
{ const page=await ctx.newPage(); await load(page,{profile:OWNER,users:[OWNER],sessions:[OPEN({status:'approved',approvedByName:'المالك',
    __counts:[{code:'A1',qty:7}], __notes:[{code:'A1',notes:[{id:'n1',text:'زيادة من مرتجعات',by:'u_x',byName:'سعد',at:1}]}]})]});
  await page.evaluate(()=>window.__openReport('sx')); await page.waitForTimeout(500);
  const pr=await page.evaluate(()=>{ try{ return window.__buildReasonPrint('detailed'); }catch(e){ return 'ERR:'+e.message; } });
  ok('CN3 التقرير المفصّل المطبوع يتضمن عمود الملاحظات ونصّها وكاتبها', pr.includes('الملاحظات')&&pr.includes('زيادة من مرتجعات')&&pr.includes('سعد'), pr.slice(0,80));
  await page.close(); }

// ===== CN4 — كاش اللقطة: يُكتب بعد أول تحميل، والدخول التالي فوري من الجهاز مع تحديث خلفي يصحّح =====
{ const page=await ctx.newPage(); await load(page,{profile:OWNER,users:[OWNER],sessions:[OPEN(),
    Object.assign({},OPEN(),{id:'sy',name:'جرد ثانٍ',__chunks:[[{code:'X1',name:'صنف خادم ١',category:'ك',book:1},{code:'X2',name:'صنف خادم ٢',category:'ك',book:1},{code:'X3',name:'صنف خادم ٣',category:'ك',book:1}]]})]});
  await page.evaluate(()=>window.__openSession('sx')); await page.waitForTimeout(400);
  const c1=await page.evaluate(()=>{ const v=window.__snapCacheGet('sx'); return v?v.length:0; });
  ok('CN4 بعد أول تحميل تُحفَظ اللقطة على الجهاز', c1===2, String(c1));
  // كاش قديم/ناقص لجلسة أخرى ⇒ عرض فوري ثم التحديث الخلفي يستبدله بالحقيقة ويحدّث الكاش
  await page.evaluate(()=>{ window.__snapCacheSet('sy',[{code:'ZZ',name:'علامة كاش قديمة',category:'ك',book:1}]); });
  await page.evaluate(()=>window.__openSession('sy')); await page.waitForTimeout(500);
  const after=await page.evaluate(()=>({ n:(window.__snapCacheGet('sy')||[]).length, html:document.getElementById('clist').innerHTML }));
  ok('CN4 التحديث الخلفي يستبدل الكاش القديم بحقيقة الخادم', after.n===3&&after.html.includes('صنف خادم ١')&&!after.html.includes('علامة كاش قديمة'), 'n='+after.n);
  await page.close(); }

// ===== CN5 — تقليم الكاش: يُحتفَظ بأحدث ٣ جلسات فقط =====
{ const page=await ctx.newPage(); await load(page,{profile:OWNER,users:[OWNER],sessions:[]});
  const n=await page.evaluate(()=>{ ['a','b','c','d','e'].forEach(x=>window.__snapCacheSet(x,[{code:'1',name:'ص'}]));
    let cnt=0; for(let i=0;i<localStorage.length;i++){ if((localStorage.key(i)||'').indexOf('iomp-snap-')===0)cnt++; } return cnt; });
  ok('CN5 لا يتضخم التخزين: أحدث ٣ لقطات فقط', n===3, String(n));
  await page.close(); }

// ===== CN6 — حذف ملاحظتي: زر × يظهر لكاتبها فقط =====
{ const page=await ctx.newPage(); await load(page,{profile:OWNER,users:[OWNER],sessions:[OPEN({
    __notes:[{code:'A1',notes:[{id:'n1',text:'ملاحظتي أنا',by:'u_owner',byName:'المالك',at:1},{id:'n2',text:'ملاحظة زميل',by:'u_x',byName:'مجاهد',at:2}]}]})]});
  await page.evaluate(()=>window.__openSession('sx')); await page.waitForTimeout(500);
  const d=await page.evaluate(()=>({ mine:!!document.querySelector('#clist [data-ndeli="n1"]'), other:!!document.querySelector('#clist [data-ndeli="n2"]'),
    both:document.getElementById('clist').textContent.includes('ملاحظتي أنا')&&document.getElementById('clist').textContent.includes('ملاحظة زميل') }));
  ok('CN6 ملاحظات الجميع ظاهرة، والحذف لملاحظتي فقط', d.both&&d.mine&&!d.other, JSON.stringify(d));
  await page.close(); }

// ===== CN7 — انعكاس فوري للكمية: تظهر قبل ردّ الخادم بوسم ⏳ ثم يثبتها التأكيد =====
{ const page=await ctx.newPage(); await load(page,{profile:OWNER,users:[OWNER],sessions:[OPEN()]});
  await page.evaluate(()=>window.__openSession('sx')); await page.waitForTimeout(500);
  const im=await page.evaluate(()=>{ window.__addEntry('A1',3); // بلا انتظار — نقرأ في نفس اللحظة
    const cc=window.__countsMap()['A1']; return { qty:cc?cc.qty:null, pend:!!(cc&&cc.entries&&cc.entries[0]&&cc.entries[0].pending), badge:document.getElementById('clist').innerHTML.includes('⏳') }; });
  ok('CN7 الكمية تظهر لحظيًّا قبل أي ردّ من الخادم (⏳)', im.qty===3&&im.pend&&im.badge, JSON.stringify(im));
  await page.waitForTimeout(300);
  const fin=await page.evaluate(()=>{ const st=window.__store['sessions/sx/counts/A1']; const cc=window.__countsMap()['A1'];
    return { server:st&&st.qty===3, pendLeft:Object.keys(window.__pendingAdds()).length, stillPend:!!(cc&&cc.entries&&cc.entries[0]&&cc.entries[0].pending), badge:document.getElementById('clist').innerHTML.includes('⏳') }; });
  ok('CN7 تأكيد الخادم يزيل ⏳ ويثبّت الكمية', fin.server&&fin.pendLeft===0&&!fin.stillPend&&!fin.badge, JSON.stringify(fin));
  await page.close(); }

// ===== CN8 — بلاطة «زيادة» الشاملة: زيادة + خارج الدفتر + دفتري سالب، ووسم «زيادة» أمام اليدوي وقت العد =====
{ const page=await ctx.newPage(); await load(page,{profile:OWNER,users:[OWNER],sessions:[OPEN({id:'sz',name:'جرد الزيادات',status:'approved',approvedByName:'المالك',
    __chunks:[[{code:'P1',name:'صنف زائد',category:'ك',book:10,cost:1},{code:'N1',name:'صنف دفتري سالب',category:'ك',book:-5,cost:1},{code:'M1',name:'صنف مطابق',category:'ك',book:4,cost:1}]],
    __counts:[{code:'P1',qty:12},{code:'M1',qty:4},{code:'MX9',qty:2,entries:[{by:'مجاهد',qty:2}]}],
    __extras:[{code:'MX9',name:'صنف يدوي زائد',category:'ك',cost:3}]})]});
  await page.evaluate(()=>window.__openReport('sz')); await page.waitForTimeout(500);
  const tile=await page.evaluate(()=>{ const t=[...document.querySelectorAll('#repTiles .tile')].find(x=>x.textContent.includes('زيادة')&&!x.textContent.includes('خارج')); return t?{v:t.querySelector('.v').textContent.trim(),f:t.getAttribute('data-f')}:null; });
  ok('CN8 بلاطة «زيادة» = زيادة + خارج الدفتر + دفتري سالب (٣)', tile&&tile.v==='3'&&tile.f==='surplus', JSON.stringify(tile));
  await page.evaluate(()=>{ document.getElementById('repStatus').value='surplus'; document.getElementById('repStatus').onchange(); }); await page.waitForTimeout(200);
  const rows=await page.evaluate(()=>[...document.querySelectorAll('#repTable tbody tr')].map(r=>r.textContent));
  ok('CN8 مرشّح «الزيادات» نفسه يعرض الثلاثة (وهذا هو المطلوب الضروري)', rows.length===3&&rows.some(r=>r.includes('صنف زائد'))&&rows.some(r=>r.includes('دفتري سالب'))&&rows.some(r=>r.includes('يدوي زائد')), String(rows.length));
  const negTag=await page.evaluate(()=>document.getElementById('repTable').textContent.includes('دفتري سالب'));
  ok('CN8 وسم «دفتري سالب» ظاهر في عمود الحالة', negTag===true);
  const pr=await page.evaluate(()=>{ try{ return window.__buildReasonPrint('detailed'); }catch(e){ return 'ERR:'+e.message; } });
  ok('CN8 شريحة «زيادة» في الطباعة شاملة أيضًا', pr.includes('زيادة: <b>3</b>')||/زيادة: <b>3<\/b>/.test(pr), pr.slice(0,60));
  await page.close(); }
{ const page=await ctx.newPage(); await load(page,{profile:OWNER,users:[OWNER],sessions:[OPEN({
    __counts:[{code:'MX9',qty:2,entries:[{by:'المالك',qty:2}]}], __extras:[{code:'MX9',name:'رف يدوي',category:'ك',cost:3}]})]});
  await page.evaluate(()=>window.__openSession('sx')); await page.waitForTimeout(500);
  const chip=await page.evaluate(()=>{ const rows=[...document.querySelectorAll('#clist .sess')]; const r=rows.find(x=>x.textContent.includes('رف يدوي')); return r?r.textContent:''; });
  ok('CN8 اليدوي وقت العد يوسم «زيادة» نفس غيره', chip.includes('زيادة +2')&&chip.includes('خارج الدفتر'), chip.slice(0,80));
  await page.close(); }

// ===== CN9 — بلاطة «عجز» الشاملة: عجز + ما لم يُعدّ بعد (مرآة الزيادات بالضبط) =====
{ const page=await ctx.newPage(); await load(page,{profile:OWNER,users:[OWNER],sessions:[OPEN({id:'sd',name:'جرد العجز',status:'approved',approvedByName:'المالك',
    __chunks:[[{code:'D1',name:'صنف ناقص',category:'ك',book:10,cost:1},{code:'U1',name:'صنف لم يُعد',category:'ك',book:8,cost:1},{code:'U0',name:'صنف صفري لم يُعد',category:'ك',book:0,cost:1},{code:'N1',name:'صنف دفتري سالب لم يُعد',category:'ك',book:-5,cost:1},{code:'M1',name:'صنف مطابق',category:'ك',book:4,cost:1}]],
    __counts:[{code:'D1',qty:6},{code:'M1',qty:4}]})]});
  await page.evaluate(()=>window.__openReport('sd')); await page.waitForTimeout(500);
  const tile=await page.evaluate(()=>{ const t=[...document.querySelectorAll('#repTiles .tile')].find(x=>x.textContent.includes('عجز')); return t?{v:t.querySelector('.v').textContent.trim(),f:t.getAttribute('data-f')}:null; });
  ok('CN9 بلاطة «عجز» = العجز المعدود + ما لم يُعدّ بعد (٢)', tile&&tile.v==='2'&&tile.f==='deficit', JSON.stringify(tile));
  await page.evaluate(()=>{ document.getElementById('repStatus').value='deficit'; document.getElementById('repStatus').onchange(); }); await page.waitForTimeout(200);
  const rows=await page.evaluate(()=>[...document.querySelectorAll('#repTable tbody tr')].map(r=>r.textContent));
  ok('CN9 مرشّح «العجز» يعرض الاثنين (الناقص + ما لم يُعدّ) وهذا هو الضروري', rows.length===2&&rows.some(r=>r.includes('صنف ناقص'))&&rows.some(r=>r.includes('صنف لم يُعد')), String(rows.length)+' '+rows.join('|').slice(0,60));
  ok('CN9 الدفتري السالب غير المعدود يبقى زيادةً لا عجزًا (والصفري خارجهما)', !rows.some(r=>r.includes('دفتري سالب'))&&!rows.some(r=>r.includes('صفري')), '');
  const tag=await page.evaluate(()=>{ document.getElementById('repStatus').value='all'; document.getElementById('repStatus').onchange(); return new Promise(res=>setTimeout(()=>res(document.getElementById('repTable').textContent),200)); });
  ok('CN9 وسم «يُحسب عجزًا» ظاهر في عمود الحالة لغير المعدود', tag.includes('يُحسب عجزًا'), '');
  const pr=await page.evaluate(()=>{ try{ return window.__buildReasonPrint('detailed'); }catch(e){ return 'ERR:'+e.message; } });
  ok('CN9 شريحة «عجز» في الطباعة شاملة أيضًا (٢) مع وسمها في الجدول', (pr.includes('عجز: <b>2</b>'))&&pr.includes('يُحسب عجزًا'), pr.slice(0,60));
  await page.close(); }

await browser.close();
let pass=0; for(const r of results){ console.log((r.pass?'✓':'✗')+' '+r.n+(r.d&&!r.pass?('  << '+r.d):'')); if(r.pass)pass++; }
console.log(`\nRECON ${pass}/${results.length} ${pass===results.length?'passed':'FAILED'}`);
process.exit(pass===results.length?0:1);
