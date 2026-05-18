import { readFileSync } from 'fs';
import { join } from 'path';
import { STSClient, AssumeRoleCommand, GetCallerIdentityCommand, type Credentials } from '@aws-sdk/client-sts';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { v4 as uuidv4 } from 'uuid';
import {
  createTenant,
  getTenant,
  updateTenant,
} from './tenantService.js';
import { runServiceDiscovery } from './discoveryService.js';
import type { Tenant } from '../types/index.js';

const REGION = process.env.AWS_REGION ?? 'us-east-1';
const CHATBOT_ACCOUNT_ID = process.env.AWS_ACCOUNT_ID ?? '';
const CFN_TEMPLATE_BUCKET = process.env.CFN_TEMPLATE_BUCKET ?? '';
const CFN_TEMPLATE_S3_URL = process.env.CFN_TEMPLATE_S3_URL ?? '';

export async function registerTenant(data: {
  companyName: string;
  email: string;
  awsAccountId: string;
}): Promise<{ tenantId: string; externalId: string; cloudFormationUrl: string }> {
  const tenantId = uuidv4();
  const externalId = `tenant-${tenantId.slice(0, 8)}-${Math.random().toString(36).slice(2, 6)}`;

  await createTenant({
    tenantId,
    externalId,
    companyName: data.companyName,
    email: data.email,
    awsAccountId: data.awsAccountId,
  });

  const templateKey = `templates/${tenantId}/chatbot-role.yaml`;
  const template = generateCloudFormationTemplate(externalId);

  if (CFN_TEMPLATE_BUCKET) {
    await uploadTemplate(templateKey, template);
  }

  const cloudFormationUrl = buildLaunchStackUrl(externalId, templateKey);

  return { tenantId, externalId, cloudFormationUrl };
}

export function generateCloudFormationTemplate(externalId: string): string {
  const templatePath = join(process.cwd(), 'src/templates/chatbot-role.yaml');
  let template = readFileSync(templatePath, 'utf8');
  // Template uses CloudFormation Parameters, return as-is; externalId is passed via URL param
  return template;
}

function buildLaunchStackUrl(externalId: string, templateKey: string): string {
  const templateUrl = CFN_TEMPLATE_S3_URL ||
    `https://${CFN_TEMPLATE_BUCKET}.s3.amazonaws.com/${templateKey}`;
  const params = new URLSearchParams({
    templateURL: templateUrl,
    param_ExternalId: externalId,
    param_ChatbotAccountId: CHATBOT_ACCOUNT_ID,
    stackName: 'ChatbotReadOnlyAccess',
  });
  return `https://console.aws.amazon.com/cloudformation/home#/stacks/create/review?${params.toString()}`;
}

async function uploadTemplate(key: string, body: string): Promise<void> {
  const s3 = new S3Client({ region: REGION });
  await s3.send(
    new PutObjectCommand({
      Bucket: CFN_TEMPLATE_BUCKET,
      Key: key,
      Body: body,
      ContentType: 'text/yaml',
    })
  );
}

export async function verifyAndActivateTenant(
  tenantId: string,
  roleArn: string
): Promise<{ detectedServices: string[]; activeMcpServers: string[] }> {
  const tenant = await getTenant(tenantId);

  // 1. Validate Role ARN format
  const arnRegex = /^arn:aws:iam::\d{12}:role\/.+$/;
  if (!arnRegex.test(roleArn)) {
    throw new Error('Invalid Role ARN format');
  }

  // 2. Verify ARN account matches registered account
  const arnAccountId = roleArn.split(':')[4];
  if (arnAccountId !== tenant.awsAccountId) {
    throw new Error(
      `Role ARN account (${arnAccountId}) does not match registered account (${tenant.awsAccountId})`
    );
  }

  // 3. Attempt AssumeRole with externalId
  const sts = new STSClient({ region: REGION });
  let credentials: Credentials;

  try {
    const assumed = await sts.send(
      new AssumeRoleCommand({
        RoleArn: roleArn,
        RoleSessionName: `chatbot-verify-${tenantId}`,
        ExternalId: tenant.externalId,
        DurationSeconds: 900,
      })
    );
    credentials = assumed.Credentials!;
  } catch (err: unknown) {
    const error = err as { name?: string };
    if (error.name === 'AccessDenied') {
      throw new Error(
        'Could not assume role. Ensure the CloudFormation stack deployed successfully and the ExternalId matches.'
      );
    }
    throw err;
  }

  // 4. Confirm assumed identity is from the correct account
  const verifyClient = new STSClient({
    region: REGION,
    credentials: {
      accessKeyId: credentials.AccessKeyId!,
      secretAccessKey: credentials.SecretAccessKey!,
      sessionToken: credentials.SessionToken!,
    },
  });
  const identity = await verifyClient.send(new GetCallerIdentityCommand({}));
  if (identity.Account !== tenant.awsAccountId) {
    throw new Error('Role resolves to wrong AWS account');
  }

  // 5. Save verified role ARN, update status
  await updateTenant(tenantId, {
    roleArn,
    status: 'active',
    verifiedAt: new Date().toISOString(),
  });

  // 6. Run service discovery
  const assumedCreds = {
    accessKeyId: credentials.AccessKeyId!,
    secretAccessKey: credentials.SecretAccessKey!,
    sessionToken: credentials.SessionToken!,
    expiration: credentials.Expiration!,
  };
  const { detectedServices, activeMcpServers } = await runServiceDiscovery(
    tenantId,
    assumedCreds
  );

  return { detectedServices, activeMcpServers };
}
