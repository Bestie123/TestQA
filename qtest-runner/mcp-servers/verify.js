#!/usr/bin/env node
/**
 * Quick MCP Verification Script
 * Run this to check if MCP servers are ready
 */

const { spawn } = require('child_process');
const path = require('path');

const SERVERS = {
  'browser-devtools': path.join(__dirname, 'browser-devtools', 'server.js'),
  'zephyr-scale': path.join(__dirname, 'zephyr-scale', 'server.js'),
};

async function testServer(name, scriptPath) {
  return new Promise((resolve) => {
    const child = spawn('node', [scriptPath], { stdio: ['pipe', 'pipe', 'pipe'] });
    let output = '';
    
    child.stdout.on('data', (chunk) => { output += chunk.toString(); });
    child.stderr.on('data', () => {});
    
    // Send initialize
    child.stdin.write(JSON.stringify({jsonrpc:'2.0',id:1,method:'initialize',params:{}}) + '\n');
    
    setTimeout(() => {
      child.stdin.write(JSON.stringify({jsonrpc:'2.0',id:2,method:'tools/list'}) + '\n');
      
      setTimeout(() => {
        child.kill();
        try {
          const responses = output.split('\n').filter(l => l.trim()).map(l => JSON.parse(l));
          const initResp = responses.find(r => r.id === 1);
          const listResp = responses.find(r => r.id === 2);
          
          if (initResp?.result && listResp?.result?.tools) {
            resolve({ name, status: 'OK', tools: listResp.result.tools.length });
          } else {
            resolve({ name, status: 'ERROR', message: 'Invalid response' });
          }
        } catch (e) {
          resolve({ name, status: 'ERROR', message: e.message });
        }
      }, 1000);
    }, 500);
  });
}

async function main() {
  console.log('═══ MCP Server Verification ═══\n');
  
  for (const [name, script] of Object.entries(SERVERS)) {
    const result = await testServer(name, script);
    const icon = result.status === 'OK' ? '✅' : '❌';
    console.log(`${icon} ${name}: ${result.status}${result.tools ? ` (${result.tools} tools)` : ''}`);
    if (result.message) console.log(`   ${result.message}`);
  }
  
  console.log('\n═══ Done ═══');
}

main().catch(console.error);
