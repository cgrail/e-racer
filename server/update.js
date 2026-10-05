import fs from 'node:fs';

// GET /update asks for a deploy: the Deploy workflow (.github/workflows/deploy.yml) calls it on every push to main, so
// a merge goes live at once rather than on update.sh's next 5-minute tick. It takes nothing (no parameters, no body,
// nothing is read), so all a call can do is have update.sh look for a new commit on main sooner. The server runs
// unprivileged in a read-only sandbox and can't deploy itself: it writes an empty file (UPDATE_FILE), and install.sh's
// systemd path unit runs update.sh while the file is there. Requests are at least COOLDOWN apart: one that comes sooner
// is held until then, never dropped, so a flood of calls can't run update.sh back to back.
export const COOLDOWN = 10000;

export function updateHook(file, cooldown = COOLDOWN) {
  let last = -Infinity, held = null;
  const request = () => {
    held = null;
    last = Date.now();
    fs.writeFile(file, '', err => (err ? console.error(`update: can't write ${file}: ${err.message}`) : console.log('update: deploy requested')));
  };
  return (req, res) => {
    held ||= setTimeout(request, Math.max(0, last + cooldown - Date.now()));
    res.status(202).set('Cache-Control', 'no-store').type('text').send('deploy requested');
  };
}
