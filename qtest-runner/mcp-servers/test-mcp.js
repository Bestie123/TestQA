#!/usr/bin/env node
/**
 * MCP Server Test Script
 * Tests MCP servers by sending JSON-RPC messages via stdio
 *
 * Usage:
 *   node test-mcp.js browser-devtools    # Test browser MCP
 *   node test-mcp.js zephyr-scale        # Test Zephyr MCP
 *   node test-mcp.js all                 # Test all
 */

const { spawn } = require('child_process');
const path = require('path');

const SERVERS = {
  'browser-devtools': {
    script: path.join(__dirname, 'browser-devtools', 'server.js'),
    cwd: path.join(__dirname, 'browser-devtools'),
    tests: [
      { method: 'tools/list', check: (r) => r.tools && r.tools.length > 0 },
      { method: 'tools/call', params: { name: 'browser_list_tabs', arguments: {} }, check: (r) => Array.isArray(r.content) },
    ],
  },
  'zephyr-scale': {
    script: path.join(__dirname, 'zephyr-scale', 'server.js'),
    cwd: path.join(__dirname, 'zephyr-scale'),
    tests: [
      { method: 'tools/list', check: (r) => r.tools && r.tools.length > 0 },
      { method: 'tools/call', params: { name: 'zephyr_list_projects', arguments: {} }, check: (r) => r.content },
    ],
  },
};

function testServer(name, config) {
  return new Promise((resolve) => {
    console.log(`\n═══ Testing: ${name} ═══`);

    const child = spawn('node', [config.script], {
      cwd: config.cwd,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';
    let responses = [];
    let testIndex = 0;

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
      const lines = stdout.split('\n');
      stdout = lines.pop();
      for (const line of lines) {
        if (line.trim()) {
          try {
            const msg = JSON.parse(line);
            responses.push(msg);
          } catch {}
        }
      }
    });

    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    function sendNext() {
      if (testIndex >= config.tests.length) {
        child.kill();
        resolve({ name, success: true, responses, stderr });
        return;
      }

      const test = config.tests[testIndex];
      const msg = { jsonrpc: '2.0', id: testIndex + 1, method: test.method };
      if (test.params) {
        msg.params = test.params;
      }

      console.log(`  → ${test.method}`);
      child.stdin.write(JSON.stringify(msg) + '\n');

      // Wait for response
      setTimeout(() => {
        const resp = responses.find(r => r.id === testIndex + 1);
        if (resp && resp.result) {
          const passed = test.check(resp.result);
          console.log(`  ${passed ? '✅' : '❌'} ${test.method}: ${passed ? 'PASS' : 'FAIL'}`);
          if (!passed) console.log(`    Response: ${JSON.stringify(resp.result).substring(0, 200)}`);
        } else {
          console.log(`  ❌ ${test.method}: NO RESPONSE`);
          if (stderr) console.log(`    stderr: ${stderr.substring(0, 200)}`);
        }
        testIndex++;
        sendNext();
      }, 2000);
    }

    // Start with initialize
    child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id: 0, method: 'initialize', params: {} }) + '\n');
    setTimeout(() => {
      child.stdin.write(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }) + '\n');
      sendNext();
    }, 1000);
  });
}

async function main() {
  const target = process.argv[2] || 'all';
  const results = [];

  if (target === 'all' || target === 'browser-devtools') {
    results.push(await testServer('browser-devtools', SERVERS['browser-devtools']));
  }
  if (target === 'all' || target === 'zephyr-scale') {
    results.push(await testServer('zephyr-scale', SERVERS['zephyr-scale']));
  }

  console.log('\n═══ Summary ═══');
  for (const r of results) {
    console.log(`  ${r.success ? '✅' : '❌'} ${r.name}`);
  }
}

main().catch(console.error);
