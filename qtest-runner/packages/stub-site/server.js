const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3006;
const PUBLIC = path.join(__dirname, 'public');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
};

const server = http.createServer((req, res) => {
  let url = req.url.split('?')[0];
  if (url === '/') url = '/index.html';

  const filePath = path.join(PUBLIC, url);
  const ext = path.extname(filePath);

  if (ext && fs.existsSync(filePath)) {
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'text/plain' });
    fs.createReadStream(filePath).pipe(res);
  } else {
    // SPA fallback — serve index.html for all routes
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    fs.createReadStream(path.join(PUBLIC, 'index.html')).pipe(res);
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`stub-site running on http://localhost:${PORT}`);
});
