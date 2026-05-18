// Client → Backend
export type ClientMessage = {
  type: 'chat';
  sessionId: string;
  content: string;
};

// Backend → Client (streamed events)
export type ServerEvent =
  | { type: 'text_delta'; delta: string }
  | { type: 'tool_start'; toolName: string; mcpServer: string }
  | { type: 'tool_end'; toolName: string }
  | { type: 'message_end' }
  | { type: 'error'; message: string };

export type TenantStatus = 'pending_role_setup' | 'active' | 'suspended';

export type Tenant = {
  tenantId: string;
  companyName: string;
  email: string;
  awsAccountId: string;
  status: TenantStatus;
  detectedServices: string[];
  activeMcpServers: string[];
  lastDiscoveryAt: string;
  createdAt: string;
};

export type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  mcpToolsUsed?: string[];
};

export type ChatSession = {
  sessionId: string;
  messages: ChatMessage[];
  createdAt: string;
};

export type ActiveTool = {
  toolName: string;
  mcpServer: string;
};

export type OnboardingState = {
  step: 1 | 2 | 3;
  tenantId?: string;
  externalId?: string;
  cloudFormationUrl?: string;
  roleArn?: string;
};

export type RegisterResponse = {
  tenantId: string;
  externalId: string;
  cloudFormationUrl: string;
};

export type VerifyRoleResponse = {
  success: true;
  detectedServices: string[];
  activeMcpServers: string[];
} | {
  success: false;
  error: string;
};
