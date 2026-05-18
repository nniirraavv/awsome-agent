import { ALWAYS_ON_MCP_SERVERS } from './alwaysOnServers.js';

export const MCP_SERVICE_MAP: Record<string, string> = {
  ecs:           'awslabs.ecs-mcp-server',
  eks:           'awslabs.eks-mcp-server',
  lambda:        'awslabs.aws-serverless-mcp-server',
  rds:           'awslabs.postgres-mcp-server',
  dynamodb:      'awslabs.dynamodb-mcp-server',
  cloudwatch:    'awslabs.cloudwatch-mcp-server',
  cloudtrail:    'awslabs.cloudtrail-mcp-server',
  sns:           'awslabs.amazon-sns-sqs-mcp-server',
  sqs:           'awslabs.amazon-sns-sqs-mcp-server',
  redshift:      'awslabs.redshift-mcp-server',
  stepfunctions: 'awslabs.stepfunctions-tool-mcp-server',
  neptune:       'awslabs.amazon-neptune-mcp-server',
  elasticache:   'awslabs.elasticache-mcp-server',
  appsync:       'awslabs.aws-appsync-mcp-server',
  sagemaker:     'awslabs.sagemaker-ai-mcp-server',
  glue:          'awslabs.aws-dataprocessing-mcp-server',
  athena:        'awslabs.aws-dataprocessing-mcp-server',
  emr:           'awslabs.aws-dataprocessing-mcp-server',
  network:       'awslabs.aws-network-mcp-server',
  vpc:           'awslabs.aws-network-mcp-server',
};

export function getMCPServersForTenant(detectedServices: string[]): string[] {
  const dynamic = detectedServices
    .map(s => MCP_SERVICE_MAP[s.toLowerCase()])
    .filter((s): s is string => Boolean(s));
  return [...new Set([...ALWAYS_ON_MCP_SERVERS, ...dynamic])];
}
