import http from 'node:http';
import next from 'next';
import { handleStoreRequest } from './src/server/store.mjs';

const dev = process.argv.includes('--dev');
const hostname = process.env.HOST || '127.0.0.1';
const port = Number(process.env.PORT || 3100);
const app = next({ dev, hostname, port });
await app.prepare();
const handleNextRequest = app.getRequestHandler();
const server = http.createServer(async (req, res) => {
  try {
    const path = new URL(req.url, `http://${req.headers.host || hostname}`).pathname;
    // API and printable documents share the browser origin and existing session.
    if (path.startsWith('/api/') || path === '/document') return await handleStoreRequest(req, res);
    await handleNextRequest(req, res);
  } catch (error) {
    console.error(error);
    if (!res.headersSent) res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Aplikasi belum dapat memproses permintaan.');
  }
});
server.on('error', error => { console.error(error); void app.close().finally(() => process.exit(1)); });
server.listen(port, hostname, () => console.log(`TechKasir Next.js running at http://${hostname}:${server.address().port}`));
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => { server.close(); void app.close().finally(() => process.exit(0)); });
