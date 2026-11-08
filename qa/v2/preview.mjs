// Isolated visual preview; never opens the user's data/store.db.
import { spawn } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const data=mkdtempSync(join(tmpdir(),'techkasir-v2-preview-')),port=Number(process.env.PREVIEW_PORT||3002);
const server=spawn(process.execPath,['scripts/api-test-server.mjs'],{env:{...process.env,PORT:String(port),TECHKASIR_DATA_DIR:data},stdio:'inherit'});
process.on('SIGINT',()=>{server.kill();process.exit();});process.on('SIGTERM',()=>{server.kill();process.exit();});
let cookie='';const base=`http://127.0.0.1:${port}`;
async function req(path,body){const res=await fetch(base+'/api'+path,{method:body?'POST':'GET',headers:{'Content-Type':'application/json',Cookie:cookie},body:body?JSON.stringify(body):undefined});if(res.headers.get('set-cookie'))cookie=res.headers.get('set-cookie').split(';')[0];const result=await res.json();if(!res.ok)throw Error(JSON.stringify(result));return result;}
for(let i=0;i<80;i++){try{await req('/bootstrap');break;}catch{await new Promise(r=>setTimeout(r,50));}}
await req('/setup',{storeName:'TechKasir · Preview v2',name:'Pemilik demo',username:'preview',password:'preview-v2-only-2026',openingDate:'2026-11-01',openingAmount:10000000});
await req('/login',{username:'preview',password:'preview-v2-only-2026'});
await req('/v2/policy',{days:30,terms:'Garansi fungsi utama; tidak termasuk kerusakan cairan.'});
const customer=await req('/customers',{name:'Dina Putri (demo)',phone:'081234567890'});
const supplier=await req('/v2/suppliers',{name:'Mitra Laptop (demo)',phone:'081234000000'});
const models=[['ASUS VivoBook 14','RAM 16 GB · SSD 512 GB',7000000],['ThinkPad T14 Gen 2','RAM 16 GB · SSD 512 GB',8900000],['HP EliteBook 840','RAM 8 GB · SSD 256 GB',6500000],['MacBook Air M1','RAM 8 GB · SSD 256 GB',11500000],['Acer Nitro 5','RAM 16 GB · SSD 512 GB',14970000],['Samsung Galaxy S23','RAM 8 GB · 256 GB',7200000]];
for(const [i,[model,specs,price]]of models.entries()){
  const r=await req('/v2/receiving',{supplierId:supplier.id,receivedOn:'2026-11-01',items:[{code:'DEMO-'+(i+1),category:i===5?'HP':'Laptop',model,specs,purchaseAmount:price-1200000,targetAmount:price}]});
  await req('/v2/receiving/'+r.id+'/finalize',{});const unit=(await req('/units')).find(u=>u.code==='DEMO-'+(i+1));
  if(i!==3)await req('/v2/qc',{unitId:unit.id,checkedOn:'2026-11-02',result:'Lulus',checklist:Object.fromEntries(['Identitas','Fisik','Layar','Baterai','Input','Port','Konektivitas','Audio/kamera','Aksesori','Fungsi utama'].map(x=>[x,'Lulus']))});
  if(i>=4)await req('/sales',{code:'ORD-DEMO-'+i,unitId:unit.id,customerId:customer.id,soldOn:'2026-11-03',price,initialPayment:i===4?1000000:price,method:'Transfer',channel:i===4?'Toko':'Marketplace'});
}
console.log(`Isolated preview: ${base} · username preview · password preview-v2-only-2026`);
