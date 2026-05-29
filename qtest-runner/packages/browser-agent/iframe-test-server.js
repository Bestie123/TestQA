const http = require('http');
const fs = require('fs');
const path = require('path');
const server = http.createServer((req, res) => {
  let filePath = path.join(__dirname, 'test-pages', req.url === '/' ? 'index.html' : req.url);
  fs.readFile(filePath, (err, data) => {
    if (err) { res.writeHead(404); res.end('Not found'); return; }
    const ext = path.extname(filePath);
    const mime = ext === '.html' ? 'text/html' : 'text/plain';
    res.writeHead(200, {'Content-Type': mime});
    res.end(data);
  });
});
server.listen(9090, () => console.log('Test server on http://localhost:9090'));
