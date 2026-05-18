import * as cdk from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as ecsPatterns from 'aws-cdk-lib/aws-ecs-patterns';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as lambdaNode from 'aws-cdk-lib/aws-lambda-nodejs';
import * as triggers from 'aws-cdk-lib/triggers';
import { Construct } from 'constructs';

export class ChatbotStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // ─── S3: CloudFormation templates ──────────────────────────────────────
    const cfnTemplateBucket = new s3.Bucket(this, 'CfnTemplatesBucket', {
      versioned: true,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ACLS,
      publicReadAccess: true,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    // ─── S3: Frontend static assets ────────────────────────────────────────
    const frontendBucket = new s3.Bucket(this, 'FrontendBucket', {
      versioned: false,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    const distribution = new cloudfront.Distribution(this, 'FrontendDistribution', {
      defaultBehavior: {
        origin: origins.S3BucketOrigin.withOriginAccessControl(frontendBucket),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
      },
      defaultRootObject: 'index.html',
      errorResponses: [
        { httpStatus: 404, responseHttpStatus: 200, responsePagePath: '/index.html' },
      ],
    });

    // ─── DynamoDB tables ────────────────────────────────────────────────────
    const tenantsTable = new dynamodb.Table(this, 'TenantsTable', {
      tableName: 'chatbot-tenants',
      partitionKey: { name: 'tenant_id', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    const chatHistoryTable = new dynamodb.Table(this, 'ChatHistoryTable', {
      tableName: 'chatbot-chat-history',
      partitionKey: { name: 'tenant_id', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'sk', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      timeToLiveAttribute: 'ttl',
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    const sessionsTable = new dynamodb.Table(this, 'SessionsTable', {
      tableName: 'chatbot-sessions',
      partitionKey: { name: 'session_id', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      timeToLiveAttribute: 'ttl',
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // ─── Cognito ────────────────────────────────────────────────────────────
    const userPool = new cognito.UserPool(this, 'UserPool', {
      selfSignUpEnabled: true,
      signInAliases: { email: true },
      autoVerify: { email: true },
      customAttributes: {
        tenant_id: new cognito.StringAttribute({ mutable: false }),
      },
      passwordPolicy: {
        minLength: 12,
        requireSymbols: true,
      },
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    userPool.addClient('WebClient', {
      authFlows: {
        userSrp: true,
      },
      generateSecret: false,
    });

    // ─── VPC + ECS ──────────────────────────────────────────────────────────
    const vpc = new ec2.Vpc(this, 'Vpc', {
      maxAzs: 2,
      natGateways: 1,
    });

    const cluster = new ecs.Cluster(this, 'Cluster', { vpc });

    const taskRole = new iam.Role(this, 'TaskRole', {
      assumedBy: new iam.ServicePrincipal('ecs-tasks.amazonaws.com'),
    });

    taskRole.addToPolicy(new iam.PolicyStatement({
      actions: [
        'bedrock:InvokeModel',
        'bedrock:InvokeModelWithResponseStream',
        'bedrock:Converse',
        'bedrock:ConverseStream',
      ],
      resources: ['*'],
    }));

    taskRole.addToPolicy(new iam.PolicyStatement({
      actions: [
        'dynamodb:GetItem', 'dynamodb:PutItem', 'dynamodb:UpdateItem',
        'dynamodb:Query', 'dynamodb:Scan', 'dynamodb:DeleteItem',
      ],
      resources: [
        tenantsTable.tableArn,
        chatHistoryTable.tableArn,
        sessionsTable.tableArn,
      ],
    }));

    taskRole.addToPolicy(new iam.PolicyStatement({
      actions: ['sts:AssumeRole'],
      resources: ['*'],
    }));

    taskRole.addToPolicy(new iam.PolicyStatement({
      actions: ['s3:GetObject', 's3:PutObject'],
      resources: [`${cfnTemplateBucket.bucketArn}/*`],
    }));

    const service = new ecsPatterns.ApplicationLoadBalancedFargateService(this, 'BackendService', {
      cluster,
      cpu: 1024,
      memoryLimitMiB: 2048,
      desiredCount: 1,
      taskImageOptions: {
        image: ecs.ContainerImage.fromAsset('../backend'),
        containerPort: 3001,
        taskRole,
        environment: {
          AWS_REGION: this.region,
          AWS_ACCOUNT_ID: this.account,
          DYNAMODB_TABLE_TENANTS: tenantsTable.tableName,
          DYNAMODB_TABLE_CHAT_HISTORY: chatHistoryTable.tableName,
          DYNAMODB_TABLE_SESSIONS: sessionsTable.tableName,
          CFN_TEMPLATE_BUCKET: cfnTemplateBucket.bucketName,
          BEDROCK_MODEL_ID: 'anthropic.claude-3-5-sonnet-20241022-v2:0',
          COGNITO_USER_POOL_ID: userPool.userPoolId,
          COGNITO_REGION: this.region,
          PORT: '3001',
          NODE_ENV: 'production',
        },
      },
    });

    // Extend ALB idle timeout for WebSockets
    service.loadBalancer.setAttribute('idle_timeout.timeout_seconds', '3600');

    // Auto-scaling
    const scaling = service.service.autoScaleTaskCount({ maxCapacity: 10 });
    scaling.scaleOnCpuUtilization('CpuScaling', {
      targetUtilizationPercent: 70,
    });

    // ─── Outputs ────────────────────────────────────────────────────────────
    new cdk.CfnOutput(this, 'FrontendUrl', { value: `https://${distribution.distributionDomainName}` });
    new cdk.CfnOutput(this, 'BackendUrl', { value: service.loadBalancer.loadBalancerDnsName });
    new cdk.CfnOutput(this, 'CfnTemplateBucket', { value: cfnTemplateBucket.bucketName });
    new cdk.CfnOutput(this, 'UserPoolId', { value: userPool.userPoolId });
  }
}
