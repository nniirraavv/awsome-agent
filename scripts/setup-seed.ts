/**
 * Seeds the local DynamoDB with a dev tenant record.
 * Run after setup:tables: npm run setup:seed
 */
import 'dotenv/config';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, GetCommand } from '@aws-sdk/lib-dynamodb';

const endpoint  = process.env.DYNAMODB_ENDPOINT ?? 'http://localhost:8000';
const region    = process.env.AWS_REGION        ?? 'us-east-1';
const tenantId  = process.env.LOCAL_DEV_TENANT_ID ?? 'local-tenant-001';
const roleArn   = process.env.LOCAL_DEV_ROLE_ARN  ?? '';
const accountId = process.env.AWS_ACCOUNT_ID      ?? '';

const isLocal = endpoint.includes('localhost') || endpoint.includes('127.0.0.1');
const client = DynamoDBDocumentClient.from(new DynamoDBClient({
  region,
  endpoint,
  ...(isLocal ? { credentials: { accessKeyId: 'local', secretAccessKey: 'local' } } : {}),
}));

async function main() {
  if (!roleArn)   { console.error('ERROR: Set LOCAL_DEV_ROLE_ARN in your .env file'); process.exit(1); }
  if (!accountId) { console.error('ERROR: Set AWS_ACCOUNT_ID in your .env file');     process.exit(1); }

  const existing = await client.send(
    new GetCommand({ TableName: 'chatbot-tenants', Key: { tenant_id: tenantId } })
  );
  if (existing.Item) {
    console.log(`Tenant "${tenantId}" already seeded — nothing to do.`);
    return;
  }

  await client.send(new PutCommand({
    TableName: 'chatbot-tenants',
    Item: {
      tenant_id:          tenantId,
      company_name:       'Local Dev',
      email:              'dev@local',
      aws_account_id:     accountId,
      external_id:        'local-external-id',
      role_arn:           roleArn,
      status:             'active',
      detected_services:  [],
      active_mcp_servers: [],
      created_at:         new Date().toISOString(),
      plan:               'free',
    },
  }));

  console.log(`✓ Seeded tenant "${tenantId}" → role ${roleArn}`);
}

main().catch(err => { console.error(err); process.exit(1); });
