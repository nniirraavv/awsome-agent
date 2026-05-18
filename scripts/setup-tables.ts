/**
 * Creates the three DynamoDB tables needed for local development.
 * Run once: npm run setup:tables
 *
 * Targets DynamoDB Local by default (DYNAMODB_ENDPOINT=http://localhost:8000).
 * Remove that env var to create tables in real AWS.
 */
import 'dotenv/config';
import { DynamoDBClient, CreateTableCommand, ListTablesCommand } from '@aws-sdk/client-dynamodb';

const endpoint = process.env.DYNAMODB_ENDPOINT ?? 'http://localhost:8000';
const region   = process.env.AWS_REGION ?? 'us-east-1';

// DynamoDB Local ignores credentials — pass dummies so the SDK doesn't error
const isLocal = endpoint.includes('localhost') || endpoint.includes('127.0.0.1');
const client = new DynamoDBClient({
  region,
  endpoint,
  ...(isLocal ? { credentials: { accessKeyId: 'local', secretAccessKey: 'local' } } : {}),
});

async function existingTables(): Promise<string[]> {
  const r = await client.send(new ListTablesCommand({}));
  return r.TableNames ?? [];
}

async function createIfMissing(name: string, create: () => Promise<void>) {
  const tables = await existingTables();
  if (tables.includes(name)) {
    console.log(`  ✓ ${name} already exists`);
    return;
  }
  await create();
  console.log(`  + ${name} created`);
}

async function main() {
  console.log(`Setting up DynamoDB tables at ${endpoint}\n`);

  await createIfMissing('chatbot-tenants', () =>
    client.send(new CreateTableCommand({
      TableName: 'chatbot-tenants',
      AttributeDefinitions: [{ AttributeName: 'tenant_id', AttributeType: 'S' }],
      KeySchema: [{ AttributeName: 'tenant_id', KeyType: 'HASH' }],
      BillingMode: 'PAY_PER_REQUEST',
    })).then(() => {})
  );

  await createIfMissing('chatbot-chat-history', () =>
    client.send(new CreateTableCommand({
      TableName: 'chatbot-chat-history',
      AttributeDefinitions: [
        { AttributeName: 'tenant_id', AttributeType: 'S' },
        { AttributeName: 'sk',        AttributeType: 'S' },
      ],
      KeySchema: [
        { AttributeName: 'tenant_id', KeyType: 'HASH'  },
        { AttributeName: 'sk',        KeyType: 'RANGE' },
      ],
      BillingMode: 'PAY_PER_REQUEST',
    })).then(() => {})
  );

  await createIfMissing('chatbot-sessions', () =>
    client.send(new CreateTableCommand({
      TableName: 'chatbot-sessions',
      AttributeDefinitions: [{ AttributeName: 'session_id', AttributeType: 'S' }],
      KeySchema: [{ AttributeName: 'session_id', KeyType: 'HASH' }],
      BillingMode: 'PAY_PER_REQUEST',
    })).then(() => {})
  );

  console.log('\nDone. Seed the local tenant with:\n');
  console.log(`  npm run setup:seed\n`);
}

main().catch(err => { console.error(err); process.exit(1); });
