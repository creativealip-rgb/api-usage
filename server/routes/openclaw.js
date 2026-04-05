import { Router } from 'express';
import { execFile } from 'child_process';

export const openclawRouter = Router();

function runOpenclawStatusUsage() {
  return new Promise((resolve, reject) => {
    execFile('openclaw', ['status', '--json', '--usage'], { timeout: 20000 }, (err, stdout, stderr) => {
      if (err) {
        return reject(new Error(stderr?.trim() || err.message));
      }
      try {
        resolve(JSON.parse(stdout));
      } catch (e) {
        reject(new Error('Failed to parse openclaw status JSON'));
      }
    });
  });
}

openclawRouter.get('/usage', async (req, res) => {
  try {
    const data = await runOpenclawStatusUsage();
    res.json(data);
  } catch (err) {
    res.status(502).json({ error: err.message || 'Failed to fetch OpenClaw usage' });
  }
});
