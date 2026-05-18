import {
  ResourceExplorer2Client,
  SearchCommand,
} from '@aws-sdk/client-resource-explorer-2';
import {
  ConfigServiceClient,
  ListDiscoveredResourcesCommand,
} from '@aws-sdk/client-config-service';
import { updateTenant } from './tenantService.js';
import { getMCPServersForTenant } from '../config/mcpServiceMap.js';
import type { AssumedCredentials } from '../types/index.js';

const REGION = process.env.AWS_REGION ?? 'us-east-1';

export async function runServiceDiscovery(
  tenantId: string,
  creds: AssumedCredentials
): Promise<{ detectedServices: string[]; activeMcpServers: string[] }> {
  const awsCreds = {
    accessKeyId: creds.accessKeyId,
    secretAccessKey: creds.secretAccessKey,
    sessionToken: creds.sessionToken,
  };

  let detectedServices: string[] = [];

  try {
    detectedServices = await discoverViaResourceExplorer(awsCreds);
  } catch {
    // Resource Explorer may not be enabled — fall back to Config
    try {
      detectedServices = await discoverViaConfig(awsCreds);
    } catch {
      // Best-effort; proceed with empty list
      detectedServices = [];
    }
  }

  const activeMcpServers = getMCPServersForTenant(detectedServices);

  await updateTenant(tenantId, {
    detectedServices,
    activeMcpServers,
    lastDiscoveryAt: new Date().toISOString(),
  });

  return { detectedServices, activeMcpServers };
}

async function discoverViaResourceExplorer(
  creds: { accessKeyId: string; secretAccessKey: string; sessionToken: string }
): Promise<string[]> {
  const client = new ResourceExplorer2Client({ region: REGION, credentials: creds });

  const services = new Set<string>();
  let nextToken: string | undefined;

  do {
    const result = await client.send(
      new SearchCommand({
        QueryString: 'resourcetype:*',
        MaxResults: 1000,
        NextToken: nextToken,
      })
    );

    for (const resource of result.Resources ?? []) {
      const service = extractServiceFromResourceType(resource.ResourceType ?? '');
      if (service) services.add(service);
    }

    nextToken = result.NextToken;
  } while (nextToken);

  if (services.size === 0) throw new Error('No resources found via Resource Explorer');
  return [...services];
}

async function discoverViaConfig(
  creds: { accessKeyId: string; secretAccessKey: string; sessionToken: string }
): Promise<string[]> {
  const client = new ConfigServiceClient({ region: REGION, credentials: creds });
  const resourceTypes = [
    'AWS::EC2::Instance',
    'AWS::ECS::Cluster',
    'AWS::EKS::Cluster',
    'AWS::Lambda::Function',
    'AWS::RDS::DBInstance',
    'AWS::DynamoDB::Table',
    'AWS::CloudWatch::Alarm',
    'AWS::SNS::Topic',
    'AWS::SQS::Queue',
    'AWS::Redshift::Cluster',
    'AWS::StepFunctions::StateMachine',
    'AWS::ElastiCache::CacheCluster',
    'AWS::SageMaker::TrainingJob',
    'AWS::Glue::Job',
  ];

  const services = new Set<string>();

  await Promise.allSettled(
    resourceTypes.map(async (rt) => {
      try {
        const result = await client.send(
          new ListDiscoveredResourcesCommand({ resourceType: rt as never, limit: 1 })
        );
        if ((result.resourceIdentifiers?.length ?? 0) > 0) {
          const service = extractServiceFromResourceType(rt);
          if (service) services.add(service);
        }
      } catch {
        // Skip types that fail
      }
    })
  );

  return [...services];
}

function extractServiceFromResourceType(resourceType: string): string | null {
  // "AWS::DynamoDB::Table" → "dynamodb"
  const match = resourceType.match(/^AWS::(\w+)::/i);
  if (!match) return null;
  return match[1].toLowerCase();
}
