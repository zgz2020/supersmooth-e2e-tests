import console from 'node:console';
import http from 'node:http';
import process from 'node:process';
import { URL } from 'node:url';

const PORT = Number(process.env.PORT) || 3000;

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);

  if (url.pathname === '/api/compliance/geo') {
    if (req.method !== 'GET') {
      res.writeHead(405, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Method Not Allowed' }));
      return;
    }

    const rawCountry = req.headers['cf-ipcountry'];
    const country =
      typeof rawCountry === 'string' && rawCountry.trim() !== '' ? rawCountry.toUpperCase() : 'ES';

    let blockedSurfaces = [];
    if (['RU', 'CU', 'IR', 'KP', 'SY'].includes(country)) {
      blockedSurfaces = ['ALL'];
    } else if (country === 'US') {
      blockedSurfaces = ['PERP_TRADING', 'SWAP'];
    }

    const responseBody = {
      country,
      region: null,
      blockedSurfaces,
    };

    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    });
    res.end(JSON.stringify(responseBody));
    return;
  }

  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not Found' }));
});

server.listen(PORT, () => {
  console.log(`Mock Compliance Geo server running at http://localhost:${PORT}`);
});

const shutdown = () => {
  server.close(() => {
    process.exit(0);
  });
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
