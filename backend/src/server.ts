import dotenv from 'dotenv';
import { resolve } from 'path';
// Load .env from backend dir first, then fall back to project root
dotenv.config({ path: resolve(process.cwd(), '.env') });
dotenv.config({ path: resolve(process.cwd(), '../.env') });
import express from 'express';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import healthRouter from './routes/health.js';
import onboardingRouter from './routes/onboarding.js';
import tenantRouter from './routes/tenant.js';
import { handleChatWebSocket } from './routes/chat.js';

const app = express();
app.use(express.json());

// CORS for local dev
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  if (req.method === 'OPTIONS') { res.sendStatus(204); return; }
  next();
});

app.use('/', healthRouter);
app.use('/onboarding', onboardingRouter);
app.use('/tenant', tenantRouter);

const server = createServer(app);

const wss = new WebSocketServer({ server, path: '/chat/stream' });
wss.on('connection', handleChatWebSocket);

const PORT = Number(process.env.PORT) || 3001;
server.listen(PORT, () => {
  console.log(`[server] Listening on port ${PORT}`);
  console.log(`[server] WebSocket endpoint: ws://localhost:${PORT}/chat/stream`);
  if (process.env.LOCAL_DEV_BYPASS_AUTH === 'true') {
    console.log('[server] LOCAL DEV MODE — Cognito auth bypassed');
  }
});

export default server;
