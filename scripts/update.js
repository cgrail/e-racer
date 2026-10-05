// Headless checks of the deploy webhook (server/update.js), run from smoke.js: on a real HTTP server, only GitHub's
// signed push to main writes the file that update.sh's systemd path unit waits for.
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import express from 'express';

const { updateHook } = await import('../server/update.js');
const secret = 'test-secret-0123456789', dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ecr-update-'));
const file = path.join(dir, 'update');
const app = express();
app.post('/update', updateHook(secret, file));
const server = app.listen(0, '127.0.0.1');
await new Promise(ok => server.once('listening', ok));
const url = `http://127.0.0.1:${server.address().port}/update`;
const sign = (body, key = secret) => 'sha256=' + crypto.createHmac('sha256', key).update(body).digest('hex');
const sha = 'a'.repeat(40);

async function post(event, payload, { sig, body = JSON.stringify(payload) } = {}) {
  fs.rmSync(file, { force: true });
  const headers = { 'content-type': 'application/json', 'x-github-event': event, 'x-hub-signature-256': sig ?? sign(body) };
  const res = await fetch(url, { method: 'POST', headers, body });
  return { status: res.status, wrote: fs.existsSync(file) && fs.readFileSync(file, 'utf8') };
}
const expect = (what, r, status, wrote = false) => {
  if (r.status !== status || r.wrote !== wrote) throw new Error(`update: ${what}: ${r.status} ${JSON.stringify(r.wrote)}, wanted ${status} ${JSON.stringify(wrote)}`);
};
try {
  const push = { ref: 'refs/heads/main', after: sha };
  expect('a signed push to main', await post('push', push), 202, sha + '\n');
  expect('a push to another branch', await post('push', { ref: 'refs/heads/feature', after: sha }), 200);
  expect('a signed ping', await post('ping', { zen: 'hi' }), 200);
  expect('another event', await post('pull_request', push), 200);
  expect('no signature', await post('push', push, { sig: '' }), 401);
  expect('the wrong secret', await post('push', push, { sig: sign(JSON.stringify(push), 'guess') }), 401);
  expect('a body changed after signing', await post('push', push, { sig: sign('{}') }), 401);
  const big = JSON.stringify({ ...push, pad: 'x'.repeat(2 << 20) });
  expect('a body over the limit', await post('push', null, { body: big }), 413);
  expect('a signed body that is not JSON', await post('push', null, { body: 'payload=%7B%7D' }), 400);
  console.log('update: only a signed push to main asks for a deploy OK');
} finally {
  server.close();
  fs.rmSync(dir, { recursive: true, force: true });
}
