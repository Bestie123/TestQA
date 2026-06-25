#!/usr/bin/env node
/**
 * MCP Debugging Toolkit
 * Инструменты для отладки MCP серверов
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Проверка Chrome CDP
async function checkChromeCDP() {
  return new Promise((resolve) => {
    const req = http.get('http://127.0.0.1:9222/json/version', (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve({ running: true, ...JSON.parse(data) }); }
        catch { resolve({ running: false }); }
      });
    });
    req.on('error', () => resolve({ running: false }));
    req.setTimeout(3000, () => { req.destroy(); resolve({ running: false }); });
  });
}

// Проверка opencode.json
function checkOpenCodeConfig() {
  // Ищем opencode.json в TestQA директории
  const configPath = path.join(process.cwd(), '..', '..', 'opencode.json');
  try {
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    const hasMcp = !!config.mcp;
    const hasMcpServers = !!config.mcpServers;
    const correctFormat = hasMcp && !hasMcpServers;
    
    return {
      exists: true,
      correctFormat,
      hasMcp,
      hasMcpServers,
      servers: hasMcp ? Object.keys(config.mcp) : [],
    };
  } catch (e) {
    return { exists: false, error: e.message };
  }
}

// Проверка MCP серверов
function checkMCPServers() {
  const servers = [
    { name: 'browser-devtools', path: path.join(__dirname, 'browser-devtools', 'server.js'), type: 'commonjs' },
    { name: 'zephyr-scale', path: path.join(__dirname, 'zephyr-scale', 'server.js'), type: 'commonjs' },
    { name: 'mcp-playwright-browser', path: 'Q:\\User_Data\\Desktop\\aws-toolkit-vscode-master\\docs\\mcp-playwright\\mcp-playwright-v2\\server-browser.js', type: 'esm' },
    { name: 'mcp-playwright-tools', path: 'Q:\\User_Data\\Desktop\\aws-toolkit-vscode-master\\docs\\mcp-playwright\\mcp-playwright-v2\\server-tools.js', type: 'esm' },
    { name: 'mcp-playwright-heavy', path: 'Q:\\User_Data\\Desktop\\aws-toolkit-vscode-master\\docs\\mcp-playwright\\mcp-playwright-v2\\server-heavy.js', type: 'esm' },
  ];
  
  return servers.map(server => ({
    name: server.name,
    exists: fs.existsSync(server.path),
    path: server.path,
    type: server.type,
  }));
}

// Проверка зависимостей
function checkDependencies() {
  const deps = [
    { name: 'ws', path: path.join(__dirname, 'browser-devtools', 'node_modules', 'ws') },
  ];
  
  return deps.map(dep => ({
    name: dep.name,
    installed: fs.existsSync(dep.path),
    path: dep.path,
  }));
}

// Запуск отладки
async function debug() {
  console.log('═══ MCP Debugging Toolkit ═══\n');
  
  // Проверка Chrome CDP
  console.log('1. Проверка Chrome CDP...');
  const chrome = await checkChromeCDP();
  if (chrome.running) {
    console.log('   ✅ Chrome CDP запущен');
    console.log(`   Browser: ${chrome.Browser}`);
    console.log(`   Protocol: ${chrome['Protocol-Version']}`);
  } else {
    console.log('   ❌ Chrome CDP не запущен');
    console.log('   Решение: node chrome-launcher.js');
  }
  
  // Проверка opencode.json
  console.log('\n2. Проверка opencode.json...');
  const config = checkOpenCodeConfig();
  if (config.exists) {
    if (config.correctFormat) {
      console.log('   ✅ opencode.json в правильном формате');
      console.log(`   Серверы: ${config.servers.join(', ')}`);
    } else {
      console.log('   ❌ opencode.json в неправильном формате');
      console.log('   Решение: использовать формат "mcp", не "mcpServers"');
    }
  } else {
    console.log('   ❌ opencode.json не найден');
    console.log('   Ошибка:', config.error);
  }
  
  // Проверка MCP серверов
  console.log('\n3. Проверка MCP серверов...');
  const servers = checkMCPServers();
  servers.forEach(server => {
    if (server.exists) {
      console.log(`   ✅ ${server.name} найден`);
    } else {
      console.log(`   ❌ ${server.name} не найден`);
    }
  });
  
  // Проверка зависимостей
  console.log('\n4. Проверка зависимостей...');
  const deps = checkDependencies();
  deps.forEach(dep => {
    if (dep.installed) {
      console.log(`   ✅ ${dep.name} установлен`);
    } else {
      console.log(`   ❌ ${dep.name} не установлен`);
      console.log(`   Решение: cd mcp-servers/browser-devtools && npm install`);
    }
  });
  
  // Рекомендации
  console.log('\n═══ Рекомендации ═══');
  const recommendations = [];
  
  if (!chrome.running) {
    recommendations.push('1. Запусти Chrome: node chrome-launcher.js');
  }
  if (!config.correctFormat) {
    recommendations.push('2. Исправь opencode.json: используй формат "mcp"');
  }
  if (servers.some(s => !s.exists)) {
    recommendations.push('3. Проверь пути к MCP серверам');
  }
  if (deps.some(d => !d.installed)) {
    recommendations.push('4. Установи зависимости: cd mcp-servers/browser-devtools && npm install');
  }
  
  // Проверка Playwright MCP
  const playwrightServers = servers.filter(s => s.type === 'esm');
  if (playwrightServers.some(s => !s.exists)) {
    recommendations.push('5. Playwright MCP серверы не найдены');
  } else {
    recommendations.push('5. Playwright MCP: используй --input-type=module для ES modules');
  }
  
  if (recommendations.length === 0) {
    console.log('   Все проверки пройдены!');
  } else {
    recommendations.forEach(r => console.log(`   ${r}`));
  }
  
  return {
    chrome,
    config,
    servers,
    deps,
    recommendations,
  };
}

// Запуск
if (require.main === module) {
  debug().catch(console.error);
}

module.exports = { checkChromeCDP, checkOpenCodeConfig, checkMCPServers, checkDependencies };
