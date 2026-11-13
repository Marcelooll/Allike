import {spawnSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {configureToolEnvironment} from './tool-environment.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
configureToolEnvironment(root);
const command=process.argv[2];
if(!['migrate','deploy','dry-run'].includes(command)) throw new Error('Use migrate, deploy ou dry-run.');
const config=JSON.parse(readFileSync(new URL('../wrangler.independent.json',import.meta.url),'utf8'));
const db=config.d1_databases?.find(x=>x.binding==='DB');
if(command!=='dry-run' && (!db?.database_id || db.database_id==='00000000-0000-4000-8000-000000000000')) throw new Error('Configure o UUID real do banco: node scripts/configure-d1.mjs UUID');
function run(args){const r=spawnSync(process.execPath,args,{cwd:root,stdio:'inherit',env:process.env});if(r.error)throw r.error;if(r.status!==0)process.exit(r.status??1);}
const wrangler=fileURLToPath(new URL('../node_modules/wrangler/bin/wrangler.js',import.meta.url));
if(command==='migrate') run([wrangler,'d1','migrations','apply','DB','--remote','--config','wrangler.independent.json']);
else {
  run(['scripts/run-independent.mjs','build']);
  const built=JSON.parse(readFileSync(new URL('../dist/server/wrangler.json',import.meta.url),'utf8'));
  if(built.vars?.DEPLOYMENT_TARGET!=='independent' || built.d1_databases?.[0]?.database_id!==db.database_id) throw new Error('O build não corresponde ao banco independente.');
  run([wrangler,'deploy','--config','dist/server/wrangler.json',...(command==='dry-run'?['--dry-run']:[])]);
}
