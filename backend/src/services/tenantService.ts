import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  UpdateCommand,
  QueryCommand,
} from '@aws-sdk/lib-dynamodb';
import { STSClient, AssumeRoleCommand } from '@aws-sdk/client-sts';
import type { Tenant, AssumedCredentials } from '../types/index.js';

const TABLE = process.env.DYNAMODB_TABLE_TENANTS ?? 'chatbot-tenants';
const REGION = process.env.AWS_REGION ?? 'us-east-1';

const dynamo = DynamoDBDocumentClient.from(
  new DynamoDBClient({
    region: REGION,
    ...(process.env.DYNAMODB_ENDPOINT ? { endpoint: process.env.DYNAMODB_ENDPOINT } : {}),
  })
);

export async function getTenant(tenantId: string): Promise<Tenant> {
  const result = await dynamo.send(
    new GetCommand({ TableName: TABLE, Key: { tenantId } })
  );
  if (!result.Item) throw new Error(`Tenant not found: ${tenantId}`);
  return dynamoItemToTenant(result.Item);
}

export async function createTenant(
  data: Pick<Tenant, 'companyName' | 'email' | 'awsAccountId' | 'externalId' | 'tenantId'>
): Promise<Tenant> {
  const now = new Date().toISOString();
  const item = {
    tenantId: data.tenantId,
    companyName: data.companyName,
    email: data.email,
    awsAccountId: data.awsAccountId,
    externalId: data.externalId,
    status: 'pending_role_setup',
    detectedServices: [],
    activeMcpServers: [],
    createdAt: now,
    plan: 'free',
  };
  await dynamo.send(new PutCommand({ TableName: TABLE, Item: item }));
  return getTenant(data.tenantId);
}

export async function updateTenant(
  tenantId: string,
  updates: Partial<Omit<Tenant, 'tenantId'>>
): Promise<void> {
  const fieldMap: Record<string, string> = {
    companyName: 'companyName',
    email: 'email',
    awsAccountId: 'awsAccountId',
    externalId: 'externalId',
    roleArn: 'roleArn',
    status: 'status',
    detectedServices: 'detectedServices',
    activeMcpServers: 'activeMcpServers',
    lastDiscoveryAt: 'lastDiscoveryAt',
    verifiedAt: 'verifiedAt',
    plan: 'plan',
  };

  const expressions: string[] = [];
  const names: Record<string, string> = {};
  const values: Record<string, unknown> = {};

  for (const [key, val] of Object.entries(updates)) {
    const attr = fieldMap[key];
    if (!attr) continue;
    expressions.push(`#${key} = :${key}`);
    names[`#${key}`] = attr;
    values[`:${key}`] = val;
  }

  if (expressions.length === 0) return;

  await dynamo.send(
    new UpdateCommand({
      TableName: TABLE,
      Key: { tenantId },
      UpdateExpression: `SET ${expressions.join(', ')}`,
      ExpressionAttributeNames: names,
      ExpressionAttributeValues: values,
    })
  );
}

export async function assumeTenantRole(tenant: Tenant): Promise<AssumedCredentials> {
  const sts = new STSClient({ region: REGION });
  const result = await sts.send(
    new AssumeRoleCommand({
      RoleArn: tenant.roleArn!,
      RoleSessionName: `chatbot-${tenant.tenantId}-${Date.now()}`,
      ExternalId: tenant.externalId,
      DurationSeconds: 3600,
    })
  );

  const creds = result.Credentials!;
  return {
    accessKeyId: creds.AccessKeyId!,
    secretAccessKey: creds.SecretAccessKey!,
    sessionToken: creds.SessionToken!,
    expiration: creds.Expiration!,
  };
}

export function shouldRefreshCredentials(creds: AssumedCredentials): boolean {
  const thresholdMs = (Number(process.env.MCP_CREDENTIAL_REFRESH_THRESHOLD_MINUTES) || 15) * 60 * 1000;
  return creds.expiration.getTime() - Date.now() < thresholdMs;
}

function dynamoItemToTenant(item: Record<string, unknown>): Tenant {
  return {
    tenantId: item['tenantId'] as string,
    companyName: item['companyName'] as string,
    email: item['email'] as string,
    awsAccountId: item['awsAccountId'] as string,
    externalId: item['externalId'] as string,
    roleArn: item['roleArn'] as string | undefined,
    status: item['status'] as Tenant['status'],
    detectedServices: (item['detectedServices'] as string[]) ?? [],
    activeMcpServers: (item['activeMcpServers'] as string[]) ?? [],
    lastDiscoveryAt: item['lastDiscoveryAt'] as string | undefined,
    verifiedAt: item['verifiedAt'] as string | undefined,
    createdAt: item['createdAt'] as string,
    plan: (item['plan'] as Tenant['plan']) ?? 'free',
  };
}
