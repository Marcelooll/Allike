import {fileURLToPath} from 'node:url';
import {configureToolEnvironment} from './tool-environment.mjs';
const [command,...args] = process.argv.slice(2);
if (!['dev','build'].includes(command)) throw new Error('Use dev ou build.');
process.env.ALLIKE_TARGET = 'independent';
configureToolEnvironment(fileURLToPath(new URL('../',import.meta.url)));
const cli = new URL('../node_modules/vinext/dist/cli.js',import.meta.url);
process.argv = [process.execPath,fileURLToPath(cli),command,...(command==='dev'?['--port','5174']:[]),...args];
await import(cli.href);
