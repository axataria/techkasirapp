import { spawnSync } from 'node:child_process';
const checks=['test.mjs','dashboard.test.mjs','search.test.mjs','components.test.mjs','data-table.test.mjs','domain.test.mjs','v2.test.mjs','v2-migration.test.mjs','recovery.test.mjs'];
for(const check of checks){const result=spawnSync(process.execPath,[check],{stdio:'inherit'});if(result.status!==0)process.exit(result.status||1);}
console.log(`All ${checks.length} checks passed.`);
