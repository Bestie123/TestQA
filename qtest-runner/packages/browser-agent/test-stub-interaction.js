// Full test: interact with stub site, verify all actions recorded
const http = require('http');

function postJson(url, data) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const body = JSON.stringify(data);
    const req = http.request({ hostname: u.hostname, port: u.port, path: u.pathname, method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
    }, (res) => { let c = ''; res.on('data', d => c += d); res.on('end', () => { try { resolve(JSON.parse(c)); } catch { resolve(null); } }); });
    req.on('error', reject); req.write(body); req.end();
  });
}

function getJson(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => { let c = ''; res.on('data', d => c += d); res.on('end', () => { try { resolve(JSON.parse(c)); } catch { resolve(null); } }); }).on('error', reject);
  });
}

const STUB = 'http://localhost:3006';
const AGENT = 'http://localhost:3005';
const REC = 'http://localhost:3004';

async function step(label, fn) {
  process.stdout.write(`  ${label}... `);
  try {
    await fn();
    console.log('OK');
  } catch (e) {
    console.log('FAIL: ' + e.message);
  }
}

async function main() {
  console.log('=== FULL STUB SITE INTERACTION TEST ===\n');

  // Setup
  const sess = await postJson(`${REC}/api/recordings/start`, { name: 'StubTest', profileId: 'st' });
  const sessionId = sess.id;
  console.log(`Session: ${sessionId}`);

  const launch = await postJson(`${AGENT}/api/launch`, { profileName: 'StubTest' });
  const profileId = launch.profileId;
  console.log(`Profile: ${profileId}`);

  // Start recording
  await postJson(`${AGENT}/api/record/start`, { profileId, sessionId, recorderUrl: REC });
  console.log('Recording started\n');

  // Helper: execute step via agent
  async function exec(action, data, value) {
    const body = { profileId, action, expectedResult: 'ok' };
    if (data) body.testData = data;
    if (value !== undefined) body.value = value;
    const r = await postJson(`${AGENT}/api/execute-step`, body);
    if (r && r.results && r.results[0] && r.results[0].status === 'failed') {
      throw new Error(r.results[0].error || 'step failed');
    }
    return r;
  }

  function wait(ms) { return new Promise(r => setTimeout(r, ms)); }

  // ===== 1. Navigate to stub site =====
  await step('Navigate to stub site', () => exec('navigate', STUB));
  await wait(1500);

  // ===== 2. Click Tab 2 =====
  await step('Click Tab 2', () => exec('click', 'text=Вкладка 2'));
  await wait(500);

  // ===== 3. Click Tab 3 =====
  await step('Click Tab 3', () => exec('click', 'text=Вкладка 3'));
  await wait(500);

  // ===== 4. Click Tab 1 back =====
  await step('Click Tab 1', () => exec('click', 'text=Вкладка 1'));
  await wait(500);

  // ===== 5. Navigate to Login page =====
  await step('Navigate to Login page', () => exec('click', 'text=Перейти к авторизации'));
  await wait(1000);

  // ===== 6. Fill username =====
  await step('Fill username', () => exec('fill', 'input[name=username]', 'admin'));
  await wait(500);

  // ===== 7. Fill password =====
  await step('Fill password', () => exec('fill', 'input[name=password]', 'secret123'));
  await wait(500);

  // ===== 8. Fill email =====
  await step('Fill email', () => exec('fill', 'input[name=email]', 'admin@test.com'));
  await wait(500);

  // ===== 8b. Press Tab to move to next field =====
  await step('Press Tab key', () => exec('keypress', null, 'Tab'));
  await wait(300);

  // ===== 9. Select role =====
  await step('Select role', () => exec('select', 'select[name=role]', 'admin'));
  await wait(500);

  // ===== 10. Check "Remember me" =====
  await step('Check remember me', () => exec('check', 'input[name=remember]'));
  await wait(300);

  // ===== 11. Check "Agree" =====
  await step('Check agree', () => exec('check', 'input[name=agree]'));
  await wait(300);

  // ===== 12. Submit login form =====
  await step('Submit login form', () => exec('click', 'button:has-text("Войти")'));
  await wait(1500);

  // ===== 13. Navigate to Form page =====
  await step('Navigate to Form page', () => exec('click', 'text=Форма'));
  await wait(1000);

  // ===== 14. Fill search =====
  await step('Fill search', () => exec('fill', 'input[name=search]', 'Playwright'));
  await wait(500);

  // ===== 15. Fill fullname =====
  await step('Fill fullname', () => exec('fill', 'input[name=fullname]', 'Иван Иванов'));
  await wait(500);

  // ===== 16. Fill comments =====
  await step('Fill comments', () => exec('fill', 'textarea[name=comments]', 'Тестовый комментарий'));
  await wait(500);

  // ===== 17. Select category =====
  await step('Select category', () => exec('select', 'select[name=category]', 'bug'));
  await wait(500);

  // ===== 18. Check radio priority =====
  await step('Check radio priority', () => exec('check', 'input[name=priority][value=high]'));
  await wait(300);

  // ===== 19. Fill date =====
  await step('Fill date', () => exec('fill', 'input[name=due-date]', '2026-12-31'));
  await wait(300);

  // ===== 20. Submit form =====
  await step('Submit form', () => exec('click', 'button:has-text("Отправить")'));
  await wait(1500);

  // ===== 21. Navigate to Drag & Drop =====
  await step('Navigate to Drag & Drop', () => exec('click', 'text=Drag & Drop'));
  await wait(1000);

  // ===== Stop recording =====
  console.log('\nStopping recording...');
  await postJson(`${AGENT}/api/record/stop`, { sessionId });
  await wait(2000);

  // ===== Check results =====
  const data = await getJson(`${REC}/api/recordings/${sessionId}`);
  const actions = data?.actions || [];

  console.log(`\n=== RECORDED ACTIONS: ${actions.length} ===\n`);

  const byType = {};
  actions.forEach(a => {
    byType[a.actionType] = (byType[a.actionType] || 0) + 1;
    const extra = a.value ? ` val="${String(a.value).substring(0, 40)}"` : '';
    const extra2 = a.selectorText ? ` text="${String(a.selectorText).substring(0, 40)}"` : '';
    console.log(`  [${a.actionType}]${extra2}${extra}`);
  });

  console.log('\n=== SUMMARY ===');
  for (const [type, count] of Object.entries(byType)) {
    console.log(`  ${type}: ${count}`);
  }

  // ===== Convert to steps =====
  const steps = await postJson(`${REC}/api/recordings/${sessionId}/convert`, {});
  console.log(`\n=== CONVERTED STEPS: ${steps?.length || 0} ===`);
  if (steps) {
    steps.forEach((s, i) => {
      console.log(`  ${i + 1}. ${s.action} | ${s.testData}`);
    });
  }

  // ===== Verify expected actions =====
  console.log('\n=== VERIFICATION ===');
  const expected = {
    click: 'at least 5 (tabs, buttons, nav)',
    fill: 'at least 5 (username, password, email, search, fullname, comments)',
    select: 'at least 2 (role, category)',
    check: 'at least 3 (remember, agree, radio)',
    navigate: 'at least 3 (stub, login, form, drag)',
    submit: 'at least 1 (form submit)',
    focus: 'at least 3 (field focus)',
    keypress: 'at least 1 (Enter)',
  };

  let passed = 0;
  let failed = 0;
  for (const [type, requirement] of Object.entries(expected)) {
    const count = byType[type] || 0;
    const minCount = parseInt(requirement.match(/\d+/)?.[0] || '1');
    if (count >= minCount) {
      console.log(`  PASS ${type}: ${count} >= ${minCount}`);
      passed++;
    } else {
      console.log(`  FAIL ${type}: ${count} < ${minCount} (${requirement})`);
      failed++;
    }
  }

  console.log(`\n=== RESULT: ${passed} passed, ${failed} failed ===`);
}

main().catch(e => console.error('FATAL:', e.message));
