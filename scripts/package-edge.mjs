import { readFileSync, readdirSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
const functionRoot = 'supabase/functions/techkasir-api';
const files = ['index.ts','deno.json'].map(name => ({ name, content: readFileSync(join(functionRoot,name),'utf8') }));
for (const directory of ['src/server','shared']) {
  for (const name of readdirSync(directory).filter(name => name.endsWith('.mjs') && name !== 'database.mjs')) {
    files.push({ name: `${directory}/${name}`, content: readFileSync(join(directory,name),'utf8') });
  }
}
mkdirSync('.migration-work', { recursive: true });
for (const file of files.filter(file => file.name.startsWith('src/') || file.name.startsWith('shared/'))) {
  const path = join(functionRoot,file.name);
  mkdirSync(join(path,'..'),{recursive:true});
  writeFileSync(path,file.content);
}
writeFileSync('.migration-work/edge-files.json',JSON.stringify(files));
console.log(`Packaged ${files.length} shared backend files for Supabase`);
