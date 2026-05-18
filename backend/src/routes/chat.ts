import type { IncomingMessage } from 'http';
import type { WebSocket } from 'ws';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import { getTenant } from '../services/tenantService.js';
import { assumeTenantRole, shouldRefreshCredentials } from '../services/tenantService.js';
import {
  createMCPSession,
  destroyMCPSession,
  refreshSessionCredentials,
  type MCPSession,
} from '../services/mcpManager.js';
import { streamChat } from '../services/bedrockService.js';
import { saveMessages, loadHistory } from '../services/chatHistoryService.js';
import type { ClientMessage } from '../types/index.js';

const REGION = process.env.COGNITO_REGION ?? process.env.AWS_REGION ?? 'us-east-1';
const USER_POOL_ID = process.env.COGNITO_USER_POOL_ID ?? '';
const LOCAL_DEV = process.env.LOCAL_DEV_BYPASS_AUTH === 'true';
const LOCAL_TENANT_ID = process.env.LOCAL_DEV_TENANT_ID ?? 'local-tenant-001';
const LOCAL_ROLE_ARN = process.env.LOCAL_DEV_ROLE_ARN ?? '';

let jwks: ReturnType<typeof createRemoteJWKSet> | null = null;
function getJWKS() {
  if (!jwks && USER_POOL_ID) {
    jwks = createRemoteJWKSet(
      new URL(`https://cognito-idp.${REGION}.amazonaws.com/${USER_POOL_ID}/.well-known/jwks.json`)
    );
  }
  return jwks;
}

async function authenticate(req: IncomingMessage): Promise<{ tenantId: string; userId: string } | null> {
  if (LOCAL_DEV) return { tenantId: LOCAL_TENANT_ID, userId: 'local-user' };

  const url = new URL(req.url ?? '/', `http://${req.headers.host}`);
  const token = url.searchParams.get('token') ??
    req.headers.authorization?.replace('Bearer ', '');

  if (!token) return null;

  try {
    const keySet = getJWKS();
    if (!keySet) return null;
    const { payload } = await jwtVerify(token, keySet, {
      issuer: `https://cognito-idp.${REGION}.amazonaws.com/${USER_POOL_ID}`,
    });
    return {
      tenantId: payload['custom:tenant_id'] as string,
      userId: payload['sub'] as string,
    };
  } catch {
    return null;
  }
}

function sendEvent(ws: WebSocket, event: object): void {
  if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(event));
}

export async function handleChatWebSocket(
  ws: WebSocket,
  req: IncomingMessage
): Promise<void> {
  const auth = await authenticate(req);
  if (!auth) {
    sendEvent(ws, { type: 'error', message: 'Unauthorized' });
    ws.close(1008, 'Unauthorized');
    return;
  }

  const { tenantId, userId } = auth;

  let tenant;
  try {
    tenant = await getTenant(tenantId);
  } catch {
    sendEvent(ws, { type: 'error', message: 'Tenant not found' });
    ws.close(1008, 'Tenant not found');
    return;
  }

  if (tenant.status !== 'active') {
    sendEvent(ws, { type: 'error', message: 'Account setup incomplete' });
    ws.close(1008, 'Setup incomplete');
    return;
  }

  let creds = await assumeTenantRole(tenant);
  let mcpSession: MCPSession | null = null;

  try {
    mcpSession = await createMCPSession(tenantId, tenant.activeMcpServers, creds);
  } catch (err) {
    sendEvent(ws, { type: 'error', message: `Failed to initialize MCP session: ${err}` });
    ws.close(1011, 'MCP init failed');
    return;
  }

  // Credential refresh interval
  const refreshInterval = setInterval(async () => {
    if (shouldRefreshCredentials(creds) && mcpSession) {
      try {
        creds = await assumeTenantRole(tenant);
        await refreshSessionCredentials(mcpSession, creds);
      } catch (err) {
        console.error('[chat] Credential refresh failed:', err);
      }
    }
  }, 5 * 60 * 1000);

  ws.on('message', async (raw) => {
    let msg: ClientMessage;
    try {
      msg = JSON.parse(raw.toString()) as ClientMessage;
    } catch {
      sendEvent(ws, { type: 'error', message: 'Invalid message format' });
      return;
    }

    if (msg.type !== 'chat') return;

    try {
      const history = await loadHistory(tenantId, msg.sessionId);
      const updatedMessages = await streamChat(ws, tenant, mcpSession!, history, msg.content);

      const mcpToolsUsed = [...mcpSession!.toolServerMap.keys()];
      await saveMessages(tenantId, msg.sessionId, userId, updatedMessages, mcpToolsUsed);
    } catch (err) {
      sendEvent(ws, { type: 'error', message: String(err) });
    }
  });

  ws.on('close', async () => {
    clearInterval(refreshInterval);
    if (mcpSession) await destroyMCPSession(mcpSession);
  });

  ws.on('error', async () => {
    clearInterval(refreshInterval);
    if (mcpSession) await destroyMCPSession(mcpSession).catch(() => { /* ignore */ });
  });
}
