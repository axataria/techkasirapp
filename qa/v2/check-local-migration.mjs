// Verify a consistent copy of the local store; no writes to the source database.
import { DatabaseSync } from 'node:sqlite';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join,resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import assert from 'node:assert/strict';
const temp=mkdtempSync(join(tmpdir(),'techkasir-v2-copy-')),copy=join(temp,'store.db'),original=new DatabaseSync(resolve('data/store.db'),{readOnly:true});
original.exec("VACUUM INTO '"+copy.replaceAll("'","''")+"'");original.close();
const digest=db=>Object.fromEntries(db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE 'v2_%' ORDER BY name").all().map(({name})=>{
  if(!/^[a-z_]+$/.test(name))throw Error('Unexpected table name');
  const statement=db.prepare('SELECT * FROM '+name+' ORDER BY rowid');statement.setReadBigInts(true);
  return [name,createHash('sha256').update(JSON.stringify(statement.all(),(_,v)=>typeof v==='bigint'?v.toString():v)).digest('hex')];
}));
let db=new DatabaseSync(copy),before=digest(db);db.close();
const port=38000+Math.floor(Math.random()*1000),server=spawn(process.execPath,['scripts/api-test-server.mjs'],{env:{...process.env,PORT:String(port),TECHKASIR_DATA_DIR:temp},stdio:['ignore','pipe','pipe']});let stderr='';server.stderr.on('data',x=>stderr+=x);
try{
  let ready=false;for(let i=0;i<100;i++){try{await fetch(`http://127.0.0.1:${port}/api/bootstrap`);ready=true;break;}catch{if(server.exitCode!==null)throw Error(stderr);await new Promise(r=>setTimeout(r,50));}}assert(ready,'Server did not start');
  db=new DatabaseSync(copy);assert.deepEqual(digest(db),before,'Legacy business rows changed during migration');assert.equal(db.prepare('PRAGMA integrity_check').get().integrity_check,'ok');assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(),[]);db.close();
  console.log('Local store copy passed: all legacy table fingerprints unchanged; integrity and foreign keys valid. Source database untouched.');
}finally{if(server.exitCode===null){server.kill();await once(server,'exit');}}
