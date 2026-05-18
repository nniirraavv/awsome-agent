import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  PutCommand,
  QueryCommand,
} from '@aws-sdk/lib-dynamodb';
import type { Message } from '@aws-sdk/client-bedrock-runtime';

const TABLE = process.env.DYNAMODB_TABLE_CHAT_HISTORY ?? 'chatbot-chat-history';
const TTL_SECONDS = 90 * 24 * 60 * 60; // 90 days

const dynamo = DynamoDBDocumentClient.from(
  new DynamoDBClient({
    region: process.env.AWS_REGION ?? 'us-east-1',
    ...(process.env.DYNAMODB_ENDPOINT ? { endpoint: process.env.DYNAMODB_ENDPOINT } : {}),
  })
);

export async function saveMessages(
  tenantId: string,
  sessionId: string,
  userId: string,
  messages: Message[],
  mcpToolsUsed: string[]
): Promise<void> {
  const ttl = Math.floor(Date.now() / 1000) + TTL_SECONDS;

  await Promise.all(
    messages.map((msg, i) => {
      const timestamp = `${new Date().toISOString()}#${i}`;
      return dynamo.send(
        new PutCommand({
          TableName: TABLE,
          Item: {
            sessionId,
            timestamp,
            tenantId,
            userId,
            role: msg.role,
            content: JSON.stringify(msg.content),
            mcpToolsUsed,
            ttl,
          },
        })
      );
    })
  );
}

export async function loadHistory(
  tenantId: string,
  sessionId: string
): Promise<Message[]> {
  const result = await dynamo.send(
    new QueryCommand({
      TableName: TABLE,
      KeyConditionExpression: 'sessionId = :sid',
      ExpressionAttributeValues: { ':sid': sessionId },
      ScanIndexForward: true,
    })
  );

  return (result.Items ?? []).map(item => ({
    role: item['role'] as 'user' | 'assistant',
    content: JSON.parse(item['content'] as string),
  }));
}

export async function listSessions(tenantId: string): Promise<string[]> {
  const result = await dynamo.send(
    new QueryCommand({
      TableName: TABLE,
      IndexName: 'tenantId-index',
      KeyConditionExpression: 'tenantId = :tid',
      ExpressionAttributeValues: { ':tid': tenantId },
      ProjectionExpression: 'sessionId',
    })
  );

  const sessionIds = new Set<string>();
  for (const item of result.Items ?? []) {
    sessionIds.add(item['sessionId'] as string);
  }
  return [...sessionIds];
}
