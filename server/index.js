import express from 'express';
import cors from 'cors';
import { accountsRouter } from './routes/accounts.js';
import { usageRouter } from './routes/usage.js';
import { openclawRouter } from './routes/openclaw.js';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = 3456;

// Ensure data directory exists
const dataDir = join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const accountsFile = join(dataDir, 'accounts.json');
if (!fs.existsSync(accountsFile)) {
  fs.writeFileSync(accountsFile, JSON.stringify([], null, 2));
}

app.use(cors());
app.use(express.json());

// Routes
app.use('/api/accounts', accountsRouter);
app.use('/api/usage', usageRouter);
app.use('/api/openclaw', openclawRouter);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});

app.listen(PORT, () => {
  console.log(`🚀 API Monitoring Server running on http://localhost:${PORT}`);
});
