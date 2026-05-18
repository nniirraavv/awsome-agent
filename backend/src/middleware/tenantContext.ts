import type { Request, Response, NextFunction } from 'express';
import { getTenant } from '../services/tenantService.js';

export async function attachTenantContext(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  if (!req.tenantId) {
    res.status(401).json({ error: 'No tenant context' });
    return;
  }

  try {
    const tenant = await getTenant(req.tenantId);

    if (tenant.status === 'suspended') {
      res.status(403).json({ error: 'Account suspended' });
      return;
    }

    req.tenant = tenant;
    next();
  } catch {
    res.status(404).json({ error: 'Tenant not found' });
  }
}

export async function requireActiveTenant(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  if (!req.tenant) {
    res.status(401).json({ error: 'No tenant context' });
    return;
  }

  if (req.tenant.status !== 'active') {
    res.status(403).json({ error: 'Account setup incomplete', status: req.tenant.status });
    return;
  }

  next();
}
