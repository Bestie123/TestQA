// Real user interaction test — clicks, inputs, navigation
const { chromium } = require('playwright');
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

async function main() {
  console.log('=== Recording real user interactions ===');

  // 1. Create session
  const sess = await postJson('http://localhost:3004/api/recordings/start', { name: 'RealInteraction', profileId: 'ri' });
  const sessionId = sess.id;
  console.log('Session:', sessionId);

  // 2. Launch browser
  const launch = await postJson('http://localhost:3005/api/launch', { profileName: 'RealInteraction' });
  const profileId = launch.profileId;
  console.log('Profile:', profileId);

  // 3. Start recording
  await postJson('http://localhost:3005/api/record/start', { profileId, sessionId, recorderUrl: 'http://localhost:3004' });
  console.log('Recording started');

  // 4. Get the browser page from the agent session
  // We need to interact with the page through the agent's execute-step
  // OR directly via the session page. Let's check what the page state is.

  // 5. Navigate to example.com
  await postJson('http://localhost:3005/api/execute-step', { profileId, action: 'navigate', testData: 'https://example.com', expectedResult: 'ok' });
  console.log('Navigated to example.com');
  await new Promise(r => setTimeout(r, 2000));

  // 6. Now do REAL clicks and inputs through the page
  // The page object in the agent session should have our inject script
  // Let's get the page and interact with it like a real user

  // Use page.evaluate to simulate real user interactions
  // This is equivalent to what a user does in the browser

  // Click on h1
  const clickRes = await postJson('http://localhost:3005/api/execute-step', { profileId, action: 'click', testData: 'h1', expectedResult: 'ok' });
  console.log('Clicked h1:', clickRes.results?.[0]?.status);
  await new Promise(r => setTimeout(r, 1000));

  // Click on the link "More information..."
  const clickLinkRes = await postJson('http://localhost:3005/api/execute-step', { profileId, action: 'click', testData: 'a', expectedResult: 'ok' });
  console.log('Clicked link:', clickLinkRes.results?.[0]?.status);
  await new Promise(r => setTimeout(r, 2000));

  // 7. Navigate to a page with input fields (wikipedia)
  await postJson('http://localhost:3005/api/execute-step', { profileId, action: 'navigate', testData: 'https://en.wikipedia.org/wiki/Main_Page', expectedResult: 'ok' });
  console.log('Navigated to Wikipedia');
  await new Promise(r => setTimeout(r, 2000));

  // 8. Type text into search box
  const fillRes = await postJson('http://localhost:3005/api/execute-step', { profileId, action: 'fill', testData: 'input[name="search"]', value: 'Playwright automation', expectedResult: 'ok' });
  console.log('Typed text:', fillRes.results?.[0]?.status);
  await new Promise(r => setTimeout(r, 1000));

  // 9. Press Enter
  const enterRes = await postJson('http://localhost:3005/api/execute-step', { profileId, action: 'keypress', value: 'Enter', expectedResult: 'ok' });
  console.log('Pressed Enter:', enterRes.results?.[0]?.status);
  await new Promise(r => setTimeout(r, 2000));

  // 10. Stop recording
  await postJson('http://localhost:3005/api/record/stop', { sessionId });
  console.log('Recording stopped');

  // 11. Check all recorded actions
  const sessData = await postJson(`http://localhost:3004/api/recordings/${sessionId}`, {});
  // Actually use GET
  const checkRes = await new Promise((resolve, reject) => {
    http.get(`http://localhost:3004/api/recordings/${sessionId}`, (res) => {
      let c = ''; res.on('data', d => c += d); res.on('end', () => { try { resolve(JSON.parse(c)); } catch { resolve(null); } });
    }).on('error', reject);
  });

  console.log('\n=== RECORDED ACTIONS ===');
  console.log('Total:', checkRes?.actions?.length || 0);
  if (checkRes?.actions) {
    checkRes.actions.forEach((a, i) => {
      const extra = a.value ? ` val="${a.value.substring(0, 50)}"` : '';
      const extra2 = a.selectorText ? ` text="${a.selectorText.substring(0, 50)}"` : '';
      console.log(`  ${i + 1}. [${a.actionType}]${extra2}${extra}`);
    });
  }

  // 12. Convert to steps
  const steps = await postJson(`http://localhost:3004/api/recordings/${sessionId}/convert`, {});
  console.log('\n=== CONVERTED STEPS ===');
  if (steps) {
    steps.forEach((s, i) => {
      console.log(`  ${i + 1}. ${s.action} | ${s.testData}`);
    });
  }

  // Cleanup
  await postJson(`http://localhost:3004/api/recordings/${sessionId}/stop`, {});
  await postJson('http://localhost:3005/api/record/stop', { sessionId });
  console.log('\nDone.');
}

main().catch(e => console.error('ERROR:', e.message));
