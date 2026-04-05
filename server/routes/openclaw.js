import { Router } from 'express';
import { execFile } from 'child_process';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

export const openclawRouter = Router();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const DATA_FILE = join(__dirname, '..', 'data', 'usage-history.json');

function ensureStore() {
  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify({ snapshots: [] }, null, 2));
  }
}

function readStore() {
  ensureStore();
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
  } catch {
    return { snapshots: [] };
  }
}

function writeStore(store) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(store, null, 2));
}

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

function summarizeSnapshot(data) {
  const recent = data?.sessions?.recent || [];
  const fresh = recent.filter((s) => s.totalTokensFresh && typeof s.totalTokens === 'number');

  return {
    ts: Date.now(),
    sessionCount: fresh.length,
    inputTokens: fresh.reduce((sum, s) => sum + (s.inputTokens || 0), 0),
    outputTokens: fresh.reduce((sum, s) => sum + (s.outputTokens || 0), 0),
    totalTokens: fresh.reduce((sum, s) => sum + (s.totalTokens || 0), 0),
  };
}

async function collectOnce() {
  const data = await runOpenclawStatusUsage();
  const snap = summarizeSnapshot(data);

  const store = readStore();
  store.snapshots.push(snap);

  // Keep ~45 days of 15-minute snapshots (45*24*4 = 4320)
  const maxRows = 4500;
  if (store.snapshots.length > maxRows) {
    store.snapshots = store.snapshots.slice(-maxRows);
  }

  writeStore(store);
  return { data, snap };
}

// boot collector: one immediate + every 15 minutes
ensureStore();
collectOnce().catch(() => {});
setInterval(() => {
  collectOnce().catch(() => {});
}, 15 * 60 * 1000);

openclawRouter.get('/usage', async (req, res) => {
  try {
    const data = await runOpenclawStatusUsage();
    res.json(data);
  } catch (err) {
    res.status(502).json({ error: err.message || 'Failed to fetch OpenClaw usage' });
  }
});

openclawRouter.post('/collect', async (req, res) => {
  try {
    const { snap } = await collectOnce();
    res.json({ ok: true, snapshot: snap });
  } catch (err) {
    res.status(502).json({ error: err.message || 'Failed to collect OpenClaw snapshot' });
  }
});

openclawRouter.get('/history', (req, res) => {
  const range = String(req.query.range || '7d');
  const now = Date.now();
  const days = range === '30d' ? 30 : range === '90d' ? 90 : 7;
  const fromTs = now - days * 24 * 60 * 60 * 1000;

  const store = readStore();
  const rows = (store.snapshots || []).filter((s) => s.ts >= fromTs);

  const byDay = new Map();
  for (const r of rows) {
    const d = new Date(r.ts);
    const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
    const prev = byDay.get(key) || { day: key, inputTokens: 0, outputTokens: 0, totalTokens: 0, samples: 0 };
    prev.inputTokens += r.inputTokens || 0;
    prev.outputTokens += r.outputTokens || 0;
    prev.totalTokens += r.totalTokens || 0;
    prev.samples += 1;
    byDay.set(key, prev);
  }

  const daily = [...byDay.values()].sort((a, b) => a.day.localeCompare(b.day));
  res.json({ range, days, daily, snapshots: rows.length });
});
