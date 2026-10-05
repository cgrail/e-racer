// Headless checks of the deploy hook (server/update.js), run from smoke.js: on a real HTTP server, GET /update writes
// the file that update.sh's systemd path unit waits for, and calls closer together than the cooldown wait for it.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import express from 'express';

const { updateHook } = await import('../server/update.js');
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ecr-update-')), file = path.join(dir, 'update');
const COOL = 300;
const app = express();
app.get('/update', updateHook(file, COOL));
const server = app.listen(0, '127.0.0.1');
await new Promise(ok => server.once('listening', ok));
const url = `http://127.0.0.1:${server.address().port}/update`;
const sleep = ms => new Promise(ok => setTimeout(ok, ms));
const there = () => fs.existsSync(file);
const get = async () => { const res = await fetch(url); await res.text(); return res.status; };

try {
  if ((await get()) !== 202) throw new Error('update: GET /update did not answer 202');
  await sleep(50);
  if (!there()) throw new Error('update: GET /update did not ask for a deploy');
  fs.rmSync(file); // update.sh takes the request
  for (let i = 0; i < 5; i++) await get(); // a burst inside the cooldown
  await sleep(50);
  if (there()) throw new Error('update: a call inside the cooldown asked for a deploy at once');
  await sleep(COOL);
  if (!there()) throw new Error('update: a call inside the cooldown was dropped, not held');
  fs.rmSync(file);
  await sleep(COOL + 50);
  if (there()) throw new Error('update: a burst asked for more than one deploy');
  console.log('update: GET /update asks for a deploy, a burst inside the cooldown for one more after it OK');
} finally {
  server.close();
  fs.rmSync(dir, { recursive: true, force: true });
}
