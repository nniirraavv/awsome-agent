# AWS DevOps Assistant

A production-ready, multi-tenant SaaS chatbot that answers AWS questions and queries live customer accounts via read-only cross-account IAM roles. Powered by Amazon Bedrock (Claude 3.5 Sonnet) and dynamically-loaded MCP servers.

---

## Architecture

```
Browser ──WebSocket──> Express (ECS Fargate)
                           │
                    ┌──────┴──────┐
                    │             │
              Amazon Bedrock   MCP Servers (uvx)
              (Claude 3.5)    ↕ tenant AWS creds
                              │
                     Tenant AWS account
                     (cross-account IAM role)
```

- **Frontend**: React 18 + Vite + TailwindCSS (dark mode, streaming, markdown)
- **Backend**: Node.js 20 + Express + WebSocket
- **LLM**: Amazon Bedrock `anthropic.claude-3-5-sonnet-20241022-v2:0` (Converse API)
- **MCP**: awslabs open-source MCP servers, dynamically spawned per session via `uvx`
- **Auth**: AWS Cognito + per-tenant cross-account IAM roles
- **Database**: DynamoDB (tenants, chat history, sessions)
- **Infra**: AWS CDK — ECS Fargate, ALB, S3+CloudFront, Cognito

---

## Local Development

### Prerequisites

- Node.js 20+
- Java 17+ (for DynamoDB Local — `brew install openjdk@17` or download from adoptium.net)
- AWS credentials with Bedrock access in `~/.aws`
- A real IAM role in your AWS account for the local test tenant
- `uvx` installed (`curl -LsSf https://astral.sh/uv/install.sh | sh`)

No Docker needed.

### Setup

```bash
cd aws-devops-chatbot

# 1. Install all dependencies
npm install        # root (concurrently, dynamo-local, script deps)
npm install --prefix backend
npm install --prefix frontend

# 2. Configure environment
cp .env.example .env
# Edit .env — fill in:
#   AWS_ACCOUNT_ID=123456789012
#   LOCAL_DEV_ROLE_ARN=arn:aws:iam::123456789012:role/YourLocalTestRole
```

### First-time table setup (run once)

Open **three terminals**:

**Terminal 1 — DynamoDB Local**
```bash
npm run dynamo:start
# Starts DynamoDB Local on http://localhost:8000 (no Docker required)
```

**Terminal 2 — Create tables + seed tenant**
```bash
npm run setup:tables   # creates chatbot-tenants, chatbot-chat-history, chatbot-sessions
npm run setup:seed     # seeds the local-tenant-001 dev record
```

### Run

```bash
# From the project root — starts backend (port 3001) + frontend (port 5173) together
npm run dev
```

Or in separate terminals if you prefer:
```bash
npm run dev:backend    # http://localhost:3001
npm run dev:frontend   # http://localhost:5173
```

---

## Tenant Onboarding Flow

New tenants go through a 3-step wizard:

1. **Register** — provide company name, email, AWS Account ID
2. **Deploy IAM Role** — click "Launch Stack" to open CloudFormation in their AWS console; copy the Role ARN from Outputs
3. **Verify** — paste Role ARN; backend calls `sts:AssumeRole` with `ExternalId` to confirm access, then runs service discovery

The IAM role is read-only (`ReadOnlyAccess` managed policy) plus extra permissions for Cost Explorer, Resource Explorer, Trusted Advisor, and Security Hub.

### Why ExternalId?

Without ExternalId, an attacker who knows your chatbot's AWS account ID could register a fake tenant, give a victim's role ARN, and trick your backend into scanning the victim's account (confused deputy attack). ExternalId prevents this: each tenant's role requires their unique secret, which only they receive at registration.

---

## Dynamic MCP Server Loading

Three layers:

| Layer | Servers | When loaded |
|---|---|---|
| Always-on | docs, api, billing, iam, well-architected | Every session |
| Discovered | ecs, eks, lambda, rds, dynamodb, cloudwatch, etc. | If service detected in account |
| On-demand | Any remaining | Lazy-loaded if intent detected |

Each MCP server is spawned as a child process via `uvx {package}@latest` with the tenant's assumed AWS credentials in the environment. All servers for a session are torn down on WebSocket close.

---

## Deployment

### First deploy

```bash
cd infra
npm install
npm run build

# Bootstrap CDK (one-time per account/region)
npx cdk bootstrap

# Deploy everything
npx cdk deploy
```

### After frontend changes

```bash
cd frontend && npm run build
aws s3 sync dist/ s3://YOUR_FRONTEND_BUCKET --delete
aws cloudfront create-invalidation --distribution-id YOUR_DIST_ID --paths "/*"
```

### After backend changes

Push a new Docker image and update the ECS service, or use `cdk deploy` to redeploy.

---

## Environment Variables

See [`.env.example`](.env.example) for the full list. Key ones:

| Variable | Description |
|---|---|
| `AWS_ACCOUNT_ID` | Your chatbot's AWS account ID |
| `BEDROCK_MODEL_ID` | Bedrock model (default: Claude 3.5 Sonnet v2) |
| `CFN_TEMPLATE_BUCKET` | S3 bucket for CloudFormation templates |
| `COGNITO_USER_POOL_ID` | Cognito user pool (set after CDK deploy) |
| `LOCAL_DEV_BYPASS_AUTH` | `true` to skip Cognito in local dev |
| `LOCAL_DEV_ROLE_ARN` | IAM role to use for the local test tenant |

---

## Security Notes

- The backend never stores plaintext AWS credentials — only short-lived STS session tokens in memory
- Every `sts:AssumeRole` call includes `ExternalId` (confused deputy prevention)
- All DynamoDB queries are scoped to the authenticated tenant's ID — no cross-tenant access
- Chat history auto-expires after 90 days via DynamoDB TTL
- MCP server sessions are torn down immediately on WebSocket close (no zombie processes)
- IAM roles are read-only — the chatbot cannot modify any tenant resource

---

## Project Structure

```
aws-devops-chatbot/
├── frontend/           React 18 + Vite + TailwindCSS
│   └── src/
│       ├── components/ ChatWindow, MessageBubble, Sidebar, onboarding wizard
│       ├── hooks/      useChat (WebSocket), useTenantServices, useOnboarding
│       └── types/      Shared TypeScript types
├── backend/            Node.js 20 + Express + WebSocket
│   └── src/
│       ├── services/   bedrockService, mcpManager, tenantService, discoveryService, ...
│       ├── routes/     onboarding, tenant, chat, health
│       ├── middleware/ auth (Cognito JWT), tenantContext
│       ├── config/     mcpServiceMap, alwaysOnServers
│       └── templates/  chatbot-role.yaml (CloudFormation)
├── infra/              AWS CDK (ECS, DynamoDB, Cognito, CloudFront)
├── scripts/            setup-tables.ts, setup-seed.ts — one-time local dev setup
└── .env.example        All environment variables
```
