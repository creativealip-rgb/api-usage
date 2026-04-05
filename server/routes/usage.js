import { Router } from 'express';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { getAccountToken } from './accounts.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ACCOUNTS_FILE = join(__dirname, '..', 'data', 'accounts.json');

export const usageRouter = Router();

function readAccounts() {
  try {
    const data = fs.readFileSync(ACCOUNTS_FILE, 'utf-8');
    return JSON.parse(data);
  } catch {
    return [];
  }
}

async function fetchOpenAI(token, endpoint, params = {}) {
  const url = new URL(`https://api.openai.com/v1/organization/${endpoint}`);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      if (Array.isArray(value)) {
        value.forEach((v) => url.searchParams.append(key, v));
      } else {
        url.searchParams.set(key, value);
      }
    }
  });

  const response = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error?.message || `HTTP ${response.status}`);
  }

  return response.json();
}

// GET /api/usage/:accountId/costs
usageRouter.get('/:accountId/costs', async (req, res) => {
  const { accountId } = req.params;
  const { start_time, end_time, bucket_width, group_by, limit, page } = req.query;

  const accounts = readAccounts();
  const account = accounts.find((a) => a.id === accountId);

  if (!account) {
    return res.status(404).json({ error: 'Account not found' });
  }

  const token = getAccountToken(account);
  if (!token) {
    return res.status(401).json({ error: 'Token expired or missing' });
  }

  try {
    const data = await fetchOpenAI(token, 'costs', {
      start_time,
      end_time,
      bucket_width: bucket_width || '1d',
      group_by,
      limit: limit || 30,
      page,
    });
    res.json(data);
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

// GET /api/usage/:accountId/completions
usageRouter.get('/:accountId/completions', async (req, res) => {
  const { accountId } = req.params;
  const { start_time, end_time, bucket_width, group_by, limit, page } = req.query;

  const accounts = readAccounts();
  const account = accounts.find((a) => a.id === accountId);

  if (!account) {
    return res.status(404).json({ error: 'Account not found' });
  }

  const token = getAccountToken(account);
  if (!token) {
    return res.status(401).json({ error: 'Token expired or missing' });
  }

  try {
    const data = await fetchOpenAI(token, 'usage/completions', {
      start_time,
      end_time,
      bucket_width: bucket_width || '1d',
      group_by,
      limit: limit || 30,
      page,
    });
    res.json(data);
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

// GET /api/usage/all/costs - Fetch costs for all accounts
usageRouter.get('/all/costs', async (req, res) => {
  const { start_time, end_time, bucket_width, group_by, limit } = req.query;
  const accounts = readAccounts();

  const results = await Promise.allSettled(
    accounts.map(async (account) => {
      const token = getAccountToken(account);
      if (!token) {
        return { accountId: account.id, label: account.label, error: 'Token expired' };
      }
      try {
        const data = await fetchOpenAI(token, 'costs', {
          start_time,
          end_time,
          bucket_width: bucket_width || '1d',
          group_by,
          limit: limit || 30,
        });
        return { accountId: account.id, label: account.label, data };
      } catch (err) {
        return { accountId: account.id, label: account.label, error: err.message };
      }
    })
  );

  res.json(
    results.map((r) => (r.status === 'fulfilled' ? r.value : r.reason))
  );
});

// GET /api/usage/all/completions - Fetch completions for all accounts
usageRouter.get('/all/completions', async (req, res) => {
  const { start_time, end_time, bucket_width, group_by, limit } = req.query;
  const accounts = readAccounts();

  const results = await Promise.allSettled(
    accounts.map(async (account) => {
      const token = getAccountToken(account);
      if (!token) {
        return { accountId: account.id, label: account.label, error: 'Token expired' };
      }
      try {
        const data = await fetchOpenAI(token, 'usage/completions', {
          start_time,
          end_time,
          bucket_width: bucket_width || '1d',
          group_by,
          limit: limit || 30,
        });
        return { accountId: account.id, label: account.label, data };
      } catch (err) {
        return { accountId: account.id, label: account.label, error: err.message };
      }
    })
  );

  res.json(
    results.map((r) => (r.status === 'fulfilled' ? r.value : r.reason))
  );
});
