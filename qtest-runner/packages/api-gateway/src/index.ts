import http from 'http';

const PORT = parseInt(process.env.PORT || '3000', 10);

const routes: { prefix: string; host: string; port: number; stripPrefix?: boolean }[] = [
  { prefix: '/api/testcases', host: 'localhost', port: 3001 },
  { prefix: '/api/folders', host: 'localhost', port: 3001 },
  { prefix: '/api/import', host: 'localhost', port: 3001 },
  { prefix: '/api/zephyr', host: 'localhost', port: 3001 },
  { prefix: '/api/diff', host: 'localhost', port: 3001 },
  { prefix: '/api/coverage', host: 'localhost', port: 3001 },
  { prefix: '/api/steps', host: 'localhost', port: 3002 },
  { prefix: '/api/categories', host: 'localhost', port: 3002 },
  { prefix: '/api/executions', host: 'localhost', port: 3003 },
  { prefix: '/api/reports', host: 'localhost', port: 3003 },
  { prefix: '/api/recordings', host: 'localhost', port: 3004 },
  { prefix: '/api/composite-steps', host: 'localhost', port: 3002 },
  { prefix: '/api/user-switch', host: 'localhost', port: 3004 },
  { prefix: '/api/record', host: 'localhost', port: 3005 },
  { prefix: '/api/launch', host: 'localhost', port: 3005 },
  { prefix: '/api/profiles', host: 'localhost', port: 3005 },
  { prefix: '/api/agent', host: 'localhost', port: 3005, stripPrefix: true },
];

function getTarget(url: string): { host: string; port: number; path: string } | null {
  for (const r of routes) {
    if (url.startsWith(r.prefix)) {
      const path = r.stripPrefix ? url.replace(r.prefix, '') : url;
      return { host: r.host, port: r.port, path };
    }
  }
  return null;
}

function cleanHeaders(headers: http.IncomingHttpHeaders): http.OutgoingHttpHeaders {
  const cleaned: http.OutgoingHttpHeaders = {};
  const skip = ['host', 'connection', 'keep-alive', 'transfer-encoding'];
  for (const [k, v] of Object.entries(headers)) {
    if (!skip.includes(k.toLowerCase())) cleaned[k] = v;
  }
  return cleaned;
}

const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.url === '/health') {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', service: 'api-gateway' }));
    return;
  }

  const target = getTarget(req.url || '');
  if (!target) {
    res.writeHead(404, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found' }));
    return;
  }

  const proxyReq = http.request({
    hostname: target.host,
    port: target.port,
    path: target.path,
    method: req.method,
    headers: cleanHeaders(req.headers),
  }, (proxyRes) => {
    const cleanedResp: http.OutgoingHttpHeaders = {};
    for (const [k, v] of Object.entries(proxyRes.headers)) {
      if (k.toLowerCase() !== 'transfer-encoding') cleanedResp[k] = v;
    }
    res.writeHead(proxyRes.statusCode || 200, cleanedResp);
    proxyRes.pipe(res);
  });

  proxyReq.on('error', (err) => {
    res.writeHead(502, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ error: `Service unavailable: ${err.message}` }));
  });

  req.pipe(proxyReq);
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`api-gateway running on port ${PORT}`);
});
