import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { attachTenantContext, requireActiveTenant } from '../middleware/tenantContext.js';
import { listSessions } from '../services/chatHistoryService.js';
import { listTenantsByUser, getTenant, deleteTenant } from '../services/tenantService.js';

const router = Router();

router.get(
  '/list',
  requireAuth,
  async (req, res) => {
    try {
      const tenants = await listTenantsByUser(req.userId!);
      res.json(tenants);
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  }
);

router.delete(
  '/:tenantId',
  requireAuth,
  async (req, res) => {
    try {
      const tenant = await getTenant(req.params['tenantId']!);
      if (tenant.userId !== req.userId) {
        res.status(403).json({ error: 'Not authorized to delete this account' });
        return;
      }
      await deleteTenant(req.params['tenantId']!);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  }
);

router.get(
  '/me',
  requireAuth,
  attachTenantContext,
  (req, res) => {
    res.json(req.tenant);
  }
);

router.get(
  '/services',
  requireAuth,
  attachTenantContext,
  requireActiveTenant,
  (req, res) => {
    const { detectedServices, activeMcpServers, lastDiscoveryAt } = req.tenant!;
    res.json({ detectedServices, activeMcpServers, lastDiscoveryAt });
  }
);

router.get(
  '/history',
  requireAuth,
  attachTenantContext,
  requireActiveTenant,
  async (req, res) => {
    try {
      const sessions = await listSessions(req.tenant!.tenantId);
      res.json({ sessions });
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  }
);

export default router;
