import type { Request, Response, NextFunction } from 'express';
import { createRemoteJWKSet, jwtVerify } from 'jose';

let jwks: ReturnType<typeof createRemoteJWKSet> | null = null;

function getJWKS() {
  const region = process.env.COGNITO_REGION ?? process.env.AWS_REGION ?? 'us-east-1';
  const userPoolId = process.env.COGNITO_USER_POOL_ID ?? '';
  if (!jwks && userPoolId) {
    jwks = createRemoteJWKSet(new URL(`https://cognito-idp.${region}.amazonaws.com/${userPoolId}/.well-known/jwks.json`));
  }
  return jwks;
}

export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  if (process.env.LOCAL_DEV_BYPASS_AUTH === 'true') {
    req.tenantId = process.env.LOCAL_DEV_TENANT_ID ?? 'local-tenant-001';
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
    const region = process.env.COGNITO_REGION ?? process.env.AWS_REGION ?? 'us-east-1';
    const userPoolId = process.env.COGNITO_USER_POOL_ID ?? '';
    const keySet = getJWKS();
    if (!keySet) throw new Error('JWKS not configured');

    const { payload } = await jwtVerify(token, keySet, {
      issuer: `https://cognito-idp.${region}.amazonaws.com/${userPoolId}`,
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
