// @ts-check
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

/** @type {Record<string, string>} */
const MIME_TYPES = {
  '.html': 'text/html; charset=UTF-8',
  '.js': 'application/javascript; charset=UTF-8',
  '.mjs': 'application/javascript; charset=UTF-8',
  '.css': 'text/css; charset=UTF-8',
  '.json': 'application/json; charset=UTF-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=UTF-8',
};

/**
 * Creates and starts a lightweight static HTTP server with GitHub Pages 404 fallback.
 * @param {string} [root]
 * @param {number} [port]
 * @returns {Promise<{ server: import('node:http').Server, url: string, close: () => Promise<void> }>}
 */
export function createStaticServer(root = process.cwd(), port = 8696) {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const urlPath = (req.url || '/').split('?')[0].split('#')[0];
      let safePath = path.normalize(urlPath).replace(/^(\.\.[/\\])+/, '');
      let filePath = path.join(root, safePath);

      if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
        filePath = path.join(filePath, 'index.html');
      }

      if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
        const notFoundPath = path.join(root, '404.html');
        if (fs.existsSync(notFoundPath)) {
          res.writeHead(404, {
            'Content-Type': 'text/html; charset=UTF-8',
            'Access-Control-Allow-Origin': '*',
          });
          fs.createReadStream(notFoundPath).pipe(res);
          return;
        }
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=UTF-8' });
        res.end(`Not Found: ${urlPath}\n`);
        return;
      }

      const ext = path.extname(filePath).toLowerCase();
      const contentType = MIME_TYPES[ext] || 'application/octet-stream';

      res.writeHead(200, {
        'Content-Type': contentType,
        'Access-Control-Allow-Origin': '*',
      });
      fs.createReadStream(filePath).pipe(res);
    });

    server.listen(port, () => {
      const addr = server.address();
      const actualPort = typeof addr === 'object' && addr ? addr.port : port;
      const url = `http://127.0.0.1:${actualPort}`;
      resolve({
        server,
        url,
        close: () => new Promise((res, rej) => server.close((err) => (err ? rej(err) : res()))),
      });
    });

    server.on('error', reject);
  });
}

// If executed directly from CLI:
if (import.meta.url === `file://${process.argv[1]}`) {
  const port = Number(process.env.PORT) || 8696;
  createStaticServer(process.cwd(), port).then(({ url }) => {
    console.log(`Serving ${url}/devtools-protocol/`);
  });
}
