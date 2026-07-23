// مشغّل حزمة اختبارات التطبيق الحي — يفشل عند أول ملف أحمر
import { execSync } from 'node:child_process';
const FILES=['test_account.mjs','test_assign.mjs','test_locdel.mjs','test_perms.mjs','test_rolelabels.mjs','test_roles.mjs','test_scope.mjs','test_shell.mjs','test_toast.mjs','test_dialogs_live.mjs','test_r3_lazy_prompt.mjs','test_r4_search_sort.mjs','test_trash.mjs','test_useredit.mjs','test_chain_live.mjs','test_notifcenter_live.mjs','test_reports_live.mjs','test_ledger_live.mjs','test_branches_live.mjs','test_products_live.mjs','test_settings_live.mjs','test_offline_live.mjs','test_select_ux.mjs','test_dropbox_live.mjs','test_summary_live.mjs','test_offline_fix2.mjs','test_branches_fix.mjs','test_medium_fix.mjs','test_settings_center.mjs','test_docbuilder.mjs','test_personalize.mjs','test_branding.mjs','test_timefmt.mjs','test_minutes.mjs','test_pwa.mjs','test_idle.mjs','test_lateamend.mjs','test_notes_cache.mjs','test_viewgate.mjs','test_viewfinance.mjs','test_printfit.mjs','test_navpick.mjs','test_loginpick.mjs','test_pagetheme.mjs','test_varamounts.mjs','test_printsummary.mjs'];
let total=0, passed=0, failed=[];
for(const f of FILES){
  try{
    const out=execSync(`node ${f}`,{encoding:'utf8',stdio:['ignore','pipe','pipe']});
    const m=out.match(/RECON (\d+)\/(\d+)/);
    if(m){ passed+=+m[1]; total+=+m[2]; console.log(`✓ ${f}: ${m[1]}/${m[2]}`); }
    else { failed.push(f); console.log(`✗ ${f}: لا RECON`); }
  }catch(e){
    const out=(e.stdout||'')+(e.stderr||'');
    const m=String(out).match(/RECON (\d+)\/(\d+)/);
    console.log(`✗ ${f}${m?`: ${m[1]}/${m[2]}`:''}`);
    console.log(String(out).split('\n').filter(l=>l.includes('✗')).join('\n'));
    failed.push(f);
  }
}
console.log(`\n===== TOTAL: ${passed}/${total} — ${failed.length?('FAILED: '+failed.join(', ')):'ALL GREEN ✓'} =====`);
process.exit(failed.length?1:0);
