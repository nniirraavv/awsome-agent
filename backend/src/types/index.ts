export type TenantStatus = 'pending_role_setup' | 'active' | 'suspended';
export type TenantPlan = 'free' | 'pro' | 'enterprise';

export interface Tenant {
  tenantId: string;
  companyName: string;
  email: string;
  awsAccountId: string;
  externalId: string;
  userId?: string;
  roleArn?: string;
  status: TenantStatus;
  detectedServices: string[];
  activeMcpServers: string[];
  lastDiscoveryAt?: string;
  verifiedAt?: string;
  createdAt: string;
  plan: TenantPlan;
}

export interface TenantSession {
  sessionId: string;
  tenantId: string;
  userId: string;
  activeMcpServers: string[];
  assumedCredentialsExpiry: string;
  createdAt: string;
  ttl: number;
}

export interface ChatHistoryEntry {
  tenantId: string;
  sk: string; // session_id#timestamp
  userId: string;
  role: 'user' | 'assistant';
  content: string;
  mcpToolsUsed: string[];
  ttl: number;
}

// WebSocket message types
export type ClientMessage = {
  type: 'chat';
  sessionId: string;
  content: string;
};

export type ServerEvent =
  | { type: 'text_delta'; delta: string }
  | { type: 'tool_start'; toolName: string; mcpServer: string }
  | { type: 'tool_end'; toolName: string }
  | { type: 'message_end' }
  | { type: 'error'; message: string };

// Bedrock message types (Converse API)
export interface BedrockTextContent {
  text: string;
}

export interface BedrockToolUseContent {
  toolUse: {
    toolUseId: string;
    name: string;
    input: Record<string, unknown>;
  };
}

export interface BedrockToolResultContent {
  toolResult: {
    toolUseId: string;
    content: Array<{ text: string }>;
    status?: 'success' | 'error';
  };
}

export type BedrockMessageContent =
  | BedrockTextContent
  | BedrockToolUseContent
  | BedrockToolResultContent;

export interface BedrockMessage {
  role: 'user' | 'assistant';
  content: BedrockMessageContent[];
}

export interface AssumedCredentials {
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken: string;
  expiration: Date;
}

// Extend Express request with tenant context
declare global {
  namespace Express {
    interface Request {
      tenantId?: string;
      tenant?: Tenant;
      userId?: string;
    }
  }
}
