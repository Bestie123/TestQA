import { startWSServer } from './ws-server';

console.log('browser-agent starting...');
console.log('NOTE: If Chrome fails to launch, run: npx playwright install chromium');
startWSServer();
