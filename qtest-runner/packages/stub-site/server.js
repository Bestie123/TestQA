const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3006;
const CROSS_ORIGIN_PORT = 9091;
const PUBLIC = path.join(__dirname, 'public');
const TEST_PAGES = path.join(__dirname, '..', 'browser-agent', 'test-pages');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
};

function serveStatic(req, res, root, spaFallback) {
  let url = req.url.split('?')[0];
  if (url === '/') url = '/index.html';

  const filePath = path.join(root, url);
  const ext = path.extname(filePath);

  if (ext && fs.existsSync(filePath)) {
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'text/plain', 'Access-Control-Allow-Origin': '*' });
    fs.createReadStream(filePath).pipe(res);
  } else if (spaFallback) {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    fs.createReadStream(path.join(root, 'index.html')).pipe(res);
  } else {
    res.writeHead(404);
    res.end('Not found');
  }
}

// Main stub-site (port 3006) — SPA with HTML5 history fallback
const server = http.createServer((req, res) => serveStatic(req, res, PUBLIC, true));

// Cross-origin test server (port 9091) — serves test-pages for cross-origin iframe testing
const crossServer = http.createServer((req, res) => serveStatic(req, res, TEST_PAGES, false));

server.listen(PORT, '0.0.0.0', () => {
  console.log(`stub-site running on http://localhost:${PORT}`);
});

crossServer.listen(CROSS_ORIGIN_PORT, '0.0.0.0', () => {
  console.log(`cross-origin test server running on http://localhost:${CROSS_ORIGIN_PORT}`);
});
