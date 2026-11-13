import {readFile,writeFile} from 'node:fs/promises';
const id=process.argv[2];
if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id||'') || id==='00000000-0000-4000-8000-000000000000') throw new Error('Informe o UUID real do D1 criado na sua conta.');
const file=new URL('../wrangler.independent.json',import.meta.url);
const config=JSON.parse(await readFile(file,'utf8'));
config.d1_databases[0].database_id=id;
await writeFile(file,JSON.stringify(config,null,2)+'\n');
console.log('D1 configurado. Execute as migrações remotas antes de publicar.');
