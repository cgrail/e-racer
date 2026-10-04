#!/usr/bin/env node
// Online race server: serves the built game (dist/) and runs the online session (lobby.js, session.js) on a
// WebSocket at /ws, on one port.
//   npm install && npm start   ->  http://localhost:8090   (npm start builds dist/ first)
//   npm run server             the same without building; next to `npm run dev`, Vite passes /ws through to it
// Settings are optional environment variables:
//   PORT              listen port (default 8090, so it can run beside a game on 8080)
//   HOST              listen address (default all interfaces; 127.0.0.1 behind a reverse proxy on the same box)
//   TRUST_PROXY=1     behind a TLS-terminating reverse proxy: client addresses come from X-Forwarded-For
//   ALLOWED_ORIGINS   page origins besides the server's own that may open the WebSocket, comma-separated
//   MAX_CLIENTS       WebSocket connections in total (default 200)
//   MAX_CONNS_PER_IP  connections from one address (default 16)
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { WebSocketServer } from 'ws';
import { Lobby } from './lobby.js';

const DIST = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'dist');
const PORT = Number(process.env.PORT) || 8090;
const HOST = process.env.HOST || undefined;
const TRUST_PROXY = /^(1|true|yes)$/i.test(process.env.TRUST_PROXY || '');
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim().toLowerCase().replace(/\/$/, '')).filter(Boolean);
const MAX_CLIENTS = Number(process.env.MAX_CLIENTS) || 200;
const MAX_CONNS_PER_IP = Number(process.env.MAX_CONNS_PER_IP) || 16;
const RATE_BURST = 120, RATE_PER_SEC = 60, MAX_DROPPED = 600; // a racing browser sends about 20 messages a second
const MAX_BUFFERED = 1 << 20; // a browser that stops reading is cut off rather than buffered for

// ---------------------------------------------------------------- the game's files
const app = express();
app.disable('x-powered-by');
if (TRUST_PROXY) app.set('trust proxy', true);
const index = path.join(DIST, 'index.html');
const built = fs.existsSync(index);
// Everything the game loads is its own, apart from the Google pixel font. Inline scripts, if a build has any, go by hash.
const inline = built ? [...fs.readFileSync(index, 'utf8').matchAll(/<script(?![^>]*\bsrc)[^>]*>([\s\S]*?)<\/script>/gi)]
  .map(([, body]) => ` 'sha256-${crypto.createHash('sha256').update(body).digest('base64')}'`).join('') : '';
const CSP = [`default-src 'self'`, `script-src 'self'${inline}`, `style-src 'self' https://fonts.googleapis.com`,
  `font-src 'self' https://fonts.gstatic.com`, `img-src 'self' data:`, `connect-src 'self' ws: wss:`,
  `object-src 'none'`, `base-uri 'self'`, `form-action 'none'`, `frame-ancestors 'none'`].join('; ');
app.use((req, res, next) => {
  res.setHeader('Content-Security-Policy', CSP);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'same-origin');
  if (req.secure) res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  if (req.method !== 'GET' && req.method !== 'HEAD') return res.set('Allow', 'GET, HEAD').status(405).end();
  next();
});
if (built) {
  app.use(express.static(DIST, {
    setHeaders(res, file) {
      if (file.endsWith('.html')) res.setHeader('Cache-Control', 'no-cache'); // a deploy shows on reload
      else if (/-[\w-]{8,}\.(js|css)$/.test(file)) res.setHeader('Cache-Control', 'public, max-age=31536000, immutable'); // Vite hashes these
    },
  }));
} else console.warn('dist/ is missing, so only the WebSocket is served: run "npm run build", or use "npm start"');

// ---------------------------------------------------------------- the WebSocket
const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws', maxPayload: 4096 });
wss.on('error', err => console.error('wss error:', err.message));
const ipConns = new Map();

function clientIp(req) {
  if (TRUST_PROXY) { // the proxy appends the real client last; earlier entries can be forged
    const last = String(req.headers['x-forwarded-for'] || '').split(',').pop().trim();
    if (last) return last;
  }
  return req.socket.remoteAddress || 'unknown';
}
// Browsers always send Origin on a WebSocket upgrade. It has to be this server's own page (or an allowed origin),
// so other sites can't drive the lobby from their visitors' browsers.
function originAllowed(req) {
  const origin = String(req.headers.origin || '').toLowerCase().replace(/\/$/, '');
  if (!origin) return false;
  if (ALLOWED_ORIGINS.includes(origin)) return true;
  try { return new URL(origin).host === String(req.headers.host || '').toLowerCase(); } catch { return false; }
}

wss.on('connection', (ws, req) => {
  ws.on('error', () => ws.terminate()); // an unhandled 'error' would take the process down
  if (!originAllowed(req)) { ws.close(1008, 'origin not allowed'); return; }
  if (wss.clients.size > MAX_CLIENTS) { ws.close(1013, 'server full'); return; }
  const ip = clientIp(req), conns = (ipConns.get(ip) || 0) + 1;
  if (conns > MAX_CONNS_PER_IP) { ws.close(1013, 'too many connections'); return; }
  ipConns.set(ip, conns);
  ws.isAlive = true; ws.bucket = RATE_BURST; ws.stamp = Date.now(); ws.dropped = 0;
  ws.on('pong', () => { ws.isAlive = true; });

  const cl = Lobby.connect(o => {
    if (ws.readyState !== 1) return;
    if (ws.bufferedAmount > MAX_BUFFERED) { ws.terminate(); return; }
    ws.send(JSON.stringify(o));
  });
  ws.on('message', raw => {
    const now = Date.now();
    ws.bucket = Math.min(RATE_BURST, ws.bucket + (now - ws.stamp) * (RATE_PER_SEC / 1000));
    ws.stamp = now;
    if (ws.bucket < 1) { if (++ws.dropped > MAX_DROPPED) ws.terminate(); return; }
    ws.bucket -= 1;
    let msg;
    try { msg = JSON.parse(raw); } catch { return; }
    if (!msg || typeof msg !== 'object' || typeof msg.type !== 'string') return;
    try { Lobby.message(cl, msg); } catch (err) { Lobby.abort(err); }
  });
  ws.once('close', () => {
    const n = (ipConns.get(ip) || 1) - 1;
    if (n <= 0) ipConns.delete(ip); else ipConns.set(ip, n);
    try { Lobby.close(cl); } catch (err) { Lobby.abort(err); }
  });
});

// the session's clock: the race runs here whether or not anyone's browser is drawing it
let last = performance.now();
setInterval(() => {
  const now = performance.now();
  try { Lobby.tick(Math.min(0.25, (now - last) / 1000)); } catch (err) { Lobby.abort(err); }
  last = now;
}, 1000 / 60);
// heartbeat: drop connections that stopped answering
setInterval(() => {
  for (const ws of wss.clients) {
    if (!ws.isAlive) { ws.terminate(); continue; }
    ws.isAlive = false;
    ws.ping();
  }
}, 30000);

for (const sig of ['SIGINT', 'SIGTERM']) {
  process.once(sig, () => {
    console.log(`${sig}: shutting down`);
    server.close(() => process.exit(0));
    server.closeIdleConnections();
    for (const ws of wss.clients) ws.close(1001, 'server shutting down');
    setTimeout(() => process.exit(0), 2000).unref();
  });
}

server.listen(PORT, HOST, () => {
  console.log(`Electro Car Racer server: http://${HOST || 'localhost'}:${PORT}  (online races on /ws)`);
});
