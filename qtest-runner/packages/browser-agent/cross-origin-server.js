const http = require('http');
const fs = require('fs');
const path = require('path');
const server = http.createServer((req, res) => {
  let filePath = path.join(__dirname, 'test-pages', req.url === '/' ? 'cross-iframe-content.html' : req.url);
  fs.readFile(filePath, (err, data) => {
    if (err) { res.writeHead(404); res.end('Not found'); return; }
    const mime = path.extname(filePath) === '.html' ? 'text/html' : 'text/plain';
    res.writeHead(200, {'Content-Type': mime, 'Access-Control-Allow-Origin': '*'});
    res.end(data);
  });
});
server.listen(9091, () => console.log('Cross-origin server on http://localhost:9091'));
