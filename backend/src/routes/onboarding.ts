import { Router } from 'express';
import { z } from 'zod';
import {
  registerTenant,
  generateCloudFormationTemplate,
  verifyAndActivateTenant,
} from '../services/onboardingService.js';
import { getTenant, assumeTenantRole } from '../services/tenantService.js';
import { runServiceDiscovery } from '../services/discoveryService.js';
import { requireAuth } from '../middleware/auth.js';
import { attachTenantContext, requireActiveTenant } from '../middleware/tenantContext.js';

const router = Router();

const registerSchema = z.object({
  companyName: z.string().min(1),
  email: z.string().email(),
  awsAccountId: z.string().regex(/^\d{12}$/, 'Must be a 12-digit AWS account ID'),
});

const verifySchema = z.object({
  tenantId: z.string().uuid(),
  roleArn: z.string().regex(/^arn:aws:iam::\d{12}:role\/.+$/),
});

router.post('/register', requireAuth, async (req, res) => {
  const parse = registerSchema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: parse.error.flatten() });
    return;
  }

  try {
    const result = await registerTenant({ ...parse.data, userId: req.userId });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

router.get('/template/:tenantId', async (req, res) => {
  try {
    const tenant = await getTenant(req.params['tenantId']!);
    const template = generateCloudFormationTemplate(tenant.externalId);
    res.setHeader('Content-Type', 'text/yaml');
    res.send(template);
  } catch (err) {
    res.status(404).json({ error: String(err) });
  }
});

router.post('/verify-role', async (req, res) => {
  const parse = verifySchema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: parse.error.flatten() });
    return;
  }

  try {
    const result = await verifyAndActivateTenant(parse.data.tenantId, parse.data.roleArn);
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(400).json({ success: false, error: String(err) });
  }
});

router.post(
  '/rescan',
  requireAuth,
  attachTenantContext,
  requireActiveTenant,
  async (req, res) => {
    try {
      const tenant = req.tenant!;
      const creds = await assumeTenantRole(tenant);
      const result = await runServiceDiscovery(tenant.tenantId, creds);
      res.json({ ...result, lastDiscoveryAt: new Date().toISOString() });
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  }
);

export default router;
