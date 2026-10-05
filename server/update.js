import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import express from 'express';

// POST /update, for a GitHub webhook on push: a push to main (a merged pull request) has update.sh deploy it at once,
// rather than on its timer's next tick. The server runs unprivileged in a read-only sandbox and can't deploy itself,
// so it only writes a file (UPDATE_FILE), and install.sh's systemd path unit starts update.sh when the file appears.
// Only deliveries signed with the webhook's secret (X-Hub-Signature-256) count; others get 401 before the body is read.
const BRANCH = 'refs/heads/main'; // what update.sh deploys

// One delivery, answered: { status, text }, plus the pushed commit when it asks for a deploy.
export function answer(secret, headers, body) {
  const sig = Buffer.from(String(headers['x-hub-signature-256'] || ''));
  const want = Buffer.from('sha256=' + crypto.createHmac('sha256', secret).update(body).digest('hex'));
  if (sig.length !== want.length || !crypto.timingSafeEqual(sig, want)) return { status: 401, text: 'bad signature' };
  const event = headers['x-github-event'];
  if (event === 'ping') return { status: 200, text: 'pong' }; // GitHub's test when the webhook is added
  let push;
  try { push = JSON.parse(body.toString()); } catch { return { status: 400, text: 'not JSON: set the content type to application/json' }; }
  if (event !== 'push' || push?.ref !== BRANCH) return { status: 200, text: 'ignored: only pushes to main deploy' };
  return { status: 202, text: 'deploying', commit: /^[0-9a-f]{40,64}$/.test(push.after) ? push.after : 'main' };
}

// The route's handlers: the signature header's shape, the body (raw, as GitHub signed it), then the answer.
export function updateHook(secret, file) {
  return [
    (req, res, next) => (/^sha256=[0-9a-f]{64}$/.test(req.get('x-hub-signature-256') || '') ? next() : res.status(401).type('text').send('bad signature')),
    express.raw({ type: () => true, limit: '1mb', inflate: false }),
    async (req, res) => {
      const a = answer(secret, req.headers, Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0));
      if (a.commit) {
        try { await fs.writeFile(file, a.commit + '\n'); } catch (err) {
          console.error(`update: can't write ${file}: ${err.message}`);
          return res.status(500).type('text').send("can't start a deploy");
        }
        console.log(`update: ${a.commit} pushed to main, deploying`);
      }
      res.status(a.status).type('text').send(a.text);
    },
    (err, req, res, _next) => res.status(err.status || 400).type('text').send(err.expose ? err.message : 'bad request'), // a body too large, cut off, …
  ];
}
