import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import os from 'os';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ACCOUNTS_FILE = join(__dirname, '..', 'data', 'accounts.json');

export const accountsRouter = Router();

// Helper to extract tokens from Codex auth.json (handles nested and flat format)
function extractCodexTokens(data) {
  // Nested format: { tokens: { access_token, refresh_token, account_id } }
  if (data.tokens && data.tokens.access_token) {
    return {
      accessToken: data.tokens.access_token,
      refreshToken: data.tokens.refresh_token || '',
      accountId: data.tokens.account_id || '',
    };
  }
  // Flat format: { access_token, refresh_token, expires_at }
  if (data.access_token) {
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token || '',
      accountId: '',
    };
  }
  return null;
}

// Decode JWT to get expiry (without verification)
function getJwtExpiry(token) {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString());
    if (payload.exp) {
      return new Date(payload.exp * 1000).toISOString();
    }
    return null;
  } catch {
    return null;
  }
}

function readAccounts() {
  try {
    const data = fs.readFileSync(ACCOUNTS_FILE, 'utf-8');
    return JSON.parse(data);
  } catch {
    return [];
  }
}

function writeAccounts(accounts) {
  fs.writeFileSync(ACCOUNTS_FILE, JSON.stringify(accounts, null, 2));
}

// Get the effective token for an account (handles both apiKey and oauth types)
export function getAccountToken(account) {
  if (account.authType === 'oauth') {
    // Check if token is expired
    if (account.expiresAt) {
      const expiresAt = new Date(account.expiresAt).getTime();
      if (Date.now() >= expiresAt) {
        return null; // Token expired
      }
    }
    return account.accessToken;
  }
  return account.apiKey;
}

// GET /api/accounts - List all accounts (without exposing secrets)
accountsRouter.get('/', (req, res) => {
  const accounts = readAccounts();
  const safeAccounts = accounts.map(({ apiKey, accessToken, refreshToken, ...rest }) => {
    const safe = { ...rest };
    if (rest.authType === 'oauth') {
      safe.tokenPreview = accessToken ? `${accessToken.slice(0, 12)}...${accessToken.slice(-4)}` : '';
      // Check if expired
      if (rest.expiresAt) {
        safe.isExpired = Date.now() >= new Date(rest.expiresAt).getTime();
      }
    } else {
      safe.keyPreview = apiKey ? `${apiKey.slice(0, 8)}...${apiKey.slice(-4)}` : '';
    }
    return safe;
  });
  res.json(safeAccounts);
});

// POST /api/accounts - Add new account
accountsRouter.post('/', (req, res) => {
  const { label, apiKey, orgId, authType, accessToken, refreshToken, expiresAt } = req.body;

  if (!label) {
    return res.status(400).json({ error: 'Label is required' });
  }

  const isOAuth = authType === 'oauth';

  if (isOAuth && !accessToken) {
    return res.status(400).json({ error: 'OAuth access token is required' });
  }

  if (!isOAuth && !apiKey) {
    return res.status(400).json({ error: 'API key is required' });
  }

  const accounts = readAccounts();
  const newAccount = {
    id: uuidv4(),
    label,
    authType: isOAuth ? 'oauth' : 'apiKey',
    orgId: orgId || '',
    createdAt: new Date().toISOString(),
    status: 'pending',
  };

  if (isOAuth) {
    newAccount.accessToken = accessToken;
    newAccount.refreshToken = refreshToken || '';
    newAccount.expiresAt = expiresAt || '';
  } else {
    newAccount.apiKey = apiKey;
  }

  accounts.push(newAccount);
  writeAccounts(accounts);

  // Return safe version
  const { apiKey: _, accessToken: _at, refreshToken: _rt, ...safeAccount } = newAccount;
  if (isOAuth) {
    safeAccount.tokenPreview = accessToken ? `${accessToken.slice(0, 12)}...${accessToken.slice(-4)}` : '';
  } else {
    safeAccount.keyPreview = apiKey ? `${apiKey.slice(0, 8)}...${apiKey.slice(-4)}` : '';
  }
  res.status(201).json(safeAccount);
});

// PUT /api/accounts/:id - Update account
accountsRouter.put('/:id', (req, res) => {
  const { id } = req.params;
  const { label, apiKey, orgId, accessToken, refreshToken, expiresAt } = req.body;
  const accounts = readAccounts();
  const index = accounts.findIndex((a) => a.id === id);

  if (index === -1) {
    return res.status(404).json({ error: 'Account not found' });
  }

  if (label) accounts[index].label = label;
  if (orgId !== undefined) accounts[index].orgId = orgId;

  if (accounts[index].authType === 'oauth') {
    if (accessToken) accounts[index].accessToken = accessToken;
    if (refreshToken) accounts[index].refreshToken = refreshToken;
    if (expiresAt) accounts[index].expiresAt = expiresAt;
  } else {
    if (apiKey) accounts[index].apiKey = apiKey;
  }

  writeAccounts(accounts);

  const { apiKey: _, accessToken: _at, refreshToken: _rt, ...safeAccount } = accounts[index];
  if (accounts[index].authType === 'oauth') {
    safeAccount.tokenPreview = accounts[index].accessToken
      ? `${accounts[index].accessToken.slice(0, 12)}...${accounts[index].accessToken.slice(-4)}`
      : '';
  } else {
    safeAccount.keyPreview = accounts[index].apiKey
      ? `${accounts[index].apiKey.slice(0, 8)}...${accounts[index].apiKey.slice(-4)}`
      : '';
  }
  res.json(safeAccount);
});

// DELETE /api/accounts/:id - Remove account
accountsRouter.delete('/:id', (req, res) => {
  const { id } = req.params;
  const accounts = readAccounts();
  const filtered = accounts.filter((a) => a.id !== id);

  if (filtered.length === accounts.length) {
    return res.status(404).json({ error: 'Account not found' });
  }

  writeAccounts(filtered);
  res.json({ success: true });
});

// POST /api/accounts/:id/test - Test connection
accountsRouter.post('/:id/test', async (req, res) => {
  const { id } = req.params;
  const accounts = readAccounts();
  const account = accounts.find((a) => a.id === id);

  if (!account) {
    return res.status(404).json({ error: 'Account not found' });
  }

  const token = getAccountToken(account);
  if (!token) {
    const idx = accounts.findIndex((a) => a.id === id);
    accounts[idx].status = 'expired';
    writeAccounts(accounts);
    return res.json({ success: false, status: 'expired', message: 'Token has expired. Please update the token.' });
  }

  const idx = accounts.findIndex((a) => a.id === id);

  try {
    if (account.authType === 'oauth') {
      // OAuth tokens: test via /v1/me (the only endpoint that works)
      const response = await fetch('https://api.openai.com/v1/me', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const profile = await response.json();
        accounts[idx].status = 'active';
        // Store useful profile info
        accounts[idx].profile = {
          name: profile.name || '',
          email: profile.email || '',
          userId: profile.id || '',
          plan: profile.orgs?.data?.[0]?.description || '',
          orgId: profile.orgs?.data?.[0]?.id || '',
          orgTitle: profile.orgs?.data?.[0]?.title || '',
        };
        // Extract plan info from JWT if present
        try {
          const parts = token.split('.');
          const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString());
          const authInfo = payload['https://api.openai.com/auth'] || {};
          accounts[idx].profile.plan = authInfo.chatgpt_plan_type || accounts[idx].profile.plan || 'unknown';
        } catch {}
        
        if (!accounts[idx].orgId && accounts[idx].profile.orgId) {
          accounts[idx].orgId = accounts[idx].profile.orgId;
        }
        writeAccounts(accounts);
        res.json({
          success: true,
          status: 'active',
          profile: accounts[idx].profile,
          note: 'OAuth token connected. Note: Usage/cost data requires an Admin API Key. OAuth can show account info only.',
        });
      } else {
        const error = await response.json().catch(() => ({}));
        accounts[idx].status = 'error';
        writeAccounts(accounts);
        res.json({
          success: false,
          status: 'error',
          message: error.error?.message || error.error || `HTTP ${response.status}`,
        });
      }
    } else {
      // API Key accounts: test via /v1/organization/costs
      const now = Math.floor(Date.now() / 1000);
      const startTime = now - 86400;

      const response = await fetch(
        `https://api.openai.com/v1/organization/costs?start_time=${startTime}&limit=1`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (response.ok) {
        accounts[idx].status = 'active';
        writeAccounts(accounts);
        res.json({ success: true, status: 'active' });
      } else {
        const error = await response.json().catch(() => ({}));
        accounts[idx].status = 'error';
        writeAccounts(accounts);
        res.json({
          success: false,
          status: 'error',
          message: error.error?.message || `HTTP ${response.status}`,
        });
      }
    }
  } catch (err) {
    accounts[idx].status = 'error';
    writeAccounts(accounts);
    res.json({ success: false, status: 'error', message: err.message });
  }
});

// GET /api/accounts/detect-codex - Auto-detect Codex CLI auth files
accountsRouter.get('/detect-codex', (req, res) => {
  const homeDir = os.homedir();
  const possiblePaths = [
    join(homeDir, '.codex', 'auth.json'),
    join(homeDir, '.config', 'codex', 'auth.json'),
  ];

  const results = [];

  for (const authPath of possiblePaths) {
    try {
      if (fs.existsSync(authPath)) {
        const data = JSON.parse(fs.readFileSync(authPath, 'utf-8'));
        const tokens = extractCodexTokens(data);
        if (tokens) {
          const expiresAt = data.expires_at || getJwtExpiry(tokens.accessToken);
          results.push({
            path: authPath,
            hasAccessToken: true,
            hasRefreshToken: !!tokens.refreshToken,
            expiresAt: expiresAt,
            isExpired: expiresAt ? Date.now() >= new Date(expiresAt).getTime() : false,
            tokenPreview: `${tokens.accessToken.slice(0, 12)}...${tokens.accessToken.slice(-4)}`,
            authMode: data.auth_mode || 'unknown',
          });
        }
      }
    } catch {
      // Skip unreadable files
    }
  }

  res.json({ found: results.length > 0, results });
});

// POST /api/accounts/import-codex - Import a Codex CLI auth file as account
accountsRouter.post('/import-codex', (req, res) => {
  const { path: authPath, label } = req.body;
  const homeDir = os.homedir();

  // Validate the path is within known Codex locations
  const allowedPaths = [
    join(homeDir, '.codex', 'auth.json'),
    join(homeDir, '.config', 'codex', 'auth.json'),
  ];

  if (!allowedPaths.includes(authPath)) {
    return res.status(400).json({ error: 'Invalid auth file path' });
  }

  try {
    const data = JSON.parse(fs.readFileSync(authPath, 'utf-8'));
    const tokens = extractCodexTokens(data);
    if (!tokens) {
      return res.status(400).json({ error: 'No access_token found in auth file' });
    }

    const expiresAt = data.expires_at || getJwtExpiry(tokens.accessToken) || '';

    const accounts = readAccounts();
    const newAccount = {
      id: uuidv4(),
      label: label || 'Codex CLI Account',
      authType: 'oauth',
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresAt,
      orgId: '',
      createdAt: new Date().toISOString(),
      status: 'pending',
      source: 'codex-cli',
      sourcePath: authPath,
    };

    accounts.push(newAccount);
    writeAccounts(accounts);

    const { accessToken: _, refreshToken: _rt, ...safeAccount } = newAccount;
    safeAccount.tokenPreview = `${tokens.accessToken.slice(0, 12)}...${tokens.accessToken.slice(-4)}`;
    res.status(201).json(safeAccount);
  } catch (err) {
    res.status(500).json({ error: `Failed to read auth file: ${err.message}` });
  }
});

// POST /api/accounts/:id/refresh-token - Re-import token from Codex CLI
accountsRouter.post('/:id/refresh-token', (req, res) => {
  const { id } = req.params;
  const accounts = readAccounts();
  const account = accounts.find((a) => a.id === id);

  if (!account) {
    return res.status(404).json({ error: 'Account not found' });
  }

  if (account.source !== 'codex-cli' || !account.sourcePath) {
    return res.status(400).json({ error: 'Account is not linked to a Codex CLI auth file' });
  }

  try {
    const data = JSON.parse(fs.readFileSync(account.sourcePath, 'utf-8'));
    const tokens = extractCodexTokens(data);
    if (!tokens) {
      return res.status(400).json({ error: 'No access_token found in auth file' });
    }

    const expiresAt = data.expires_at || getJwtExpiry(tokens.accessToken) || '';

    const idx = accounts.findIndex((a) => a.id === id);
    accounts[idx].accessToken = tokens.accessToken;
    accounts[idx].refreshToken = tokens.refreshToken;
    accounts[idx].expiresAt = expiresAt;
    accounts[idx].status = 'pending';
    writeAccounts(accounts);

    res.json({ success: true, message: 'Token refreshed from Codex CLI' });
  } catch (err) {
    res.status(500).json({ error: `Failed to refresh: ${err.message}` });
  }
});
