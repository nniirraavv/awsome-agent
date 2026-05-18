import type { Request, Response, NextFunction } from 'express';
import { createRemoteJWKSet, jwtVerify } from 'jose';

const REGION = process.env.COGNITO_REGION ?? process.env.AWS_REGION ?? 'us-east-1';
const USER_POOL_ID = process.env.COGNITO_USER_POOL_ID ?? '';
const LOCAL_DEV = process.env.LOCAL_DEV_BYPASS_AUTH === 'true';
const LOCAL_TENANT_ID = process.env.LOCAL_DEV_TENANT_ID ?? 'local-tenant-001';

const jwksUrl = `https://cognito-idp.${REGION}.amazonaws.com/${USER_POOL_ID}/.well-known/jwks.json`;
let jwks: ReturnType<typeof createRemoteJWKSet> | null = null;

function getJWKS() {
  if (!jwks && USER_POOL_ID) {
    jwks = createRemoteJWKSet(new URL(jwksUrl));
  }
  return jwks;
}

export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  if (LOCAL_DEV) {
    req.tenantId = LOCAL_TENANT_ID;
    req.userId = 'local-user';
    next();
    return;
  }

  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    res.status(401).json({ error: 'Missing authorization token' });
    return;
  }

  try {
    const keySet = getJWKS();
    if (!keySet) throw new Error('JWKS not configured');

    const { payload } = await jwtVerify(token, keySet, {
      issuer: `https://cognito-idp.${REGION}.amazonaws.com/${USER_POOL_ID}`,
    });

    req.tenantId = payload['custom:tenant_id'] as string;
    req.userId = payload['sub'] as string;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}

export function extractTokenFromQuery(query: Record<string, unknown>): string | null {
  return typeof query['token'] === 'string' ? query['token'] : null;
}
