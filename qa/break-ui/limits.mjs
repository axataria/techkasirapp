import { DatabaseSync } from 'node:sqlite';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

const results = [];
let cookie = '';
async function request(path, method = 'GET', body) {
  const response = await fetch('http://127.0.0.1:3102/api' + path, {
    method, headers:{'Content-Type':'application/json',Cookie:cookie},
    body:body === undefined ? undefined : JSON.stringify(body),
  });
  if (response.headers.has('set-cookie')) cookie = response.headers.get('set-cookie').split(';')[0];
  return {status:response.status,body:await response.json()};
}
await request('/login','POST',{username:'audit',password:'Audit-local-only-2026'});
const unit = {
  code:'QA-LIMIT-ONLY',category:'Laptop',model:'Workstation audit batas angka',
  intakeDate:'2026-11-07',purchaseAmount:9007199254740991,
  repairAmount:0,extraAmount:0,targetAmount:0,status:'Siap dijual',
};
try {
  results.push({name:'Above safe integer rejected',result:await request('/units','POST',{...unit,code:'QA-OVER-LIMIT',purchaseAmount:9007199254740992})});
  results.push({name:'Negative input rejected',result:await request('/units','POST',{...unit,code:'QA-NEGATIVE',purchaseAmount:-1})});
  results.push({name:'Invalid leap date rejected',result:await request('/units','POST',{...unit,code:'QA-INVALID-DATE',purchaseAmount:0,intakeDate:'2026-02-30'})});
  results.push({name:'Single input at advertised safe limit',result:await request('/units','POST',unit)});
  results.push({name:'Unit list after maximum accepted amount',result:await request('/units')});
  results.push({name:'Dashboard after maximum accepted amount',result:await request('/dashboard')});
  results.push({name:'Historical report year 1970',result:await request('/reports?year=1970')});
} finally {
  // Remove only this audit record from the explicitly isolated database.
  const db = new DatabaseSync(join(import.meta.dirname,'isolated-data','store.db'));
  db.prepare("DELETE FROM units WHERE code='QA-LIMIT-ONLY'").run();
  db.close();
}
results.push({name:'1970 date accepted by transaction validation',result:await request('/units','POST',{
  ...unit,code:'QA-HISTORICAL',purchaseAmount:0,intakeDate:'1970-01-01',
})});
writeFileSync(join(import.meta.dirname,'limits.json'),JSON.stringify(results,null,2));
console.log(JSON.stringify(results.map(row=>({name:row.name,status:row.result.status,error:row.result.body?.error})),null,2));
