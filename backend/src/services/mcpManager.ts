import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import type { ChildProcess } from 'child_process';
import type { AssumedCredentials } from '../types/index.js';

const SPAWN_TIMEOUT = Number(process.env.MCP_SPAWN_TIMEOUT_MS) || 15000;
const MAX_SERVERS = Number(process.env.MCP_MAX_SERVERS_PER_SESSION) || 15;

interface MCPServerEntry {
  client: Client;
  transport: StdioClientTransport;
  packageName: string;
}

export interface MCPSession {
  tenantId: string;
  servers: Map<string, MCPServerEntry>;
  tools: Tool[];
  toolServerMap: Map<string, string>; // toolName → packageName
  credentials: AssumedCredentials;
}

export async function createMCPSession(
  tenantId: string,
  serverPackages: string[],
  credentials: AssumedCredentials
): Promise<MCPSession> {
  const session: MCPSession = {
    tenantId,
    servers: new Map(),
    tools: [],
    toolServerMap: new Map(),
    credentials,
  };

  const toLoad = serverPackages.slice(0, MAX_SERVERS);

  await Promise.allSettled(
    toLoad.map(pkg => spawnMCPServer(session, pkg, credentials))
  );

  return session;
}

async function spawnMCPServer(
  session: MCPSession,
  packageName: string,
  credentials: AssumedCredentials
): Promise<void> {
  const env: Record<string, string> = {
    ...process.env as Record<string, string>,
    AWS_ACCESS_KEY_ID: credentials.accessKeyId,
    AWS_SECRET_ACCESS_KEY: credentials.secretAccessKey,
    AWS_SESSION_TOKEN: credentials.sessionToken,
    AWS_REGION: process.env.AWS_REGION ?? 'us-east-1',
  };

  const transport = new StdioClientTransport({
    command: 'uvx',
    args: [`${packageName}@latest`],
    env,
  });

  const client = new Client({ name: 'aws-devops-chatbot', version: '1.0.0' });

  const connectPromise = client.connect(transport);
  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error(`MCP server ${packageName} timed out`)), SPAWN_TIMEOUT)
  );

  try {
    await Promise.race([connectPromise, timeoutPromise]);
  } catch (err) {
    console.error(`[mcpManager] Failed to spawn ${packageName}:`, err);
    try { await transport.close(); } catch { /* ignore */ }
    return;
  }

  let tools: Tool[] = [];
  try {
    const result = await client.listTools();
    tools = result.tools;
  } catch (err) {
    console.error(`[mcpManager] Failed to list tools for ${packageName}:`, err);
    try { await client.close(); } catch { /* ignore */ }
    return;
  }

  session.servers.set(packageName, { client, transport, packageName });
  for (const tool of tools) {
    session.tools.push(tool);
    session.toolServerMap.set(tool.name, packageName);
  }
}

export async function callMCPTool(
  session: MCPSession,
  toolName: string,
  toolInput: Record<string, unknown>
): Promise<string> {
  const packageName = session.toolServerMap.get(toolName);
  if (!packageName) throw new Error(`No MCP server found for tool: ${toolName}`);

  const entry = session.servers.get(packageName);
  if (!entry) throw new Error(`MCP server ${packageName} not in session`);

  const result = await entry.client.callTool({ name: toolName, arguments: toolInput });

  // Flatten content to string
  const content = result.content as Array<{ type: string; text?: string }>;
  return content
    .filter(c => c.type === 'text' && c.text)
    .map(c => c.text!)
    .join('\n');
}

export async function lazyLoadServer(
  session: MCPSession,
  packageName: string
): Promise<void> {
  if (session.servers.has(packageName)) return;
  await spawnMCPServer(session, packageName, session.credentials);
}

export async function refreshSessionCredentials(
  session: MCPSession,
  newCredentials: AssumedCredentials
): Promise<void> {
  // Kill and respawn all servers with refreshed credentials
  await destroyMCPSession(session);
  const packages = [...session.servers.keys()];
  session.servers.clear();
  session.tools = [];
  session.toolServerMap.clear();
  session.credentials = newCredentials;
  await Promise.allSettled(
    packages.map(pkg => spawnMCPServer(session, pkg, newCredentials))
  );
}

export async function destroyMCPSession(session: MCPSession): Promise<void> {
  await Promise.allSettled(
    [...session.servers.values()].map(async ({ client, transport }) => {
      try { await client.close(); } catch { /* ignore */ }
      try { await transport.close(); } catch { /* ignore */ }
    })
  );
  session.servers.clear();
}
