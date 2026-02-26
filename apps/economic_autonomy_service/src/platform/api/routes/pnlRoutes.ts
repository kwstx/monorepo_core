import { Router, type Request, type Response } from 'express';
import type { PlatformContext } from '../../context/PlatformContext.js';
import type { ActionPnLInput } from 'economic_autonomy';

export function createPnlRoutes(context: PlatformContext): Router {
  const router = Router();

  router.post('/report', (req: Request, res: Response) => {
    const body = req.body as { agentId?: string; actionPnL?: ActionPnLInput };
    if (!body.agentId || !body.actionPnL) {
      return res.status(400).json({ status: 'error', message: 'Missing agentId or actionPnL.' });
    }

    const result = context.pnlService.report(body.agentId, body.actionPnL);
    return res.json({ status: 'success', data: result });
  });

  router.get('/ledger', (_req: Request, res: Response) => {
    res.json({ status: 'success', data: context.pnlService.getLedger() });
  });

  router.get('/verify', (_req: Request, res: Response) => {
    res.json({ status: 'success', data: context.pnlService.verifyLedger() });
  });

  return router;
}
