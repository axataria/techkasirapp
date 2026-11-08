// Isolated API harness for regression checks and the local seed utility.
// The application itself has one entry point: ../server.mjs.
import http from 'node:http';
import { handleStoreRequest } from '../src/server/store.mjs';

const server = http.createServer(handleStoreRequest);
server.listen(Number(process.env.PORT || 0), process.env.HOST || '127.0.0.1', () => {
  console.log(`TechKasir API test server running at http://127.0.0.1:${server.address().port}`);
});
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.close(() => process.exit(0)));
