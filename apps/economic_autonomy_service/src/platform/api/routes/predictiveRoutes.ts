import { Router, type Request, type Response } from 'express';
import type { PlatformContext } from '../../context/PlatformContext.js';
import type { ProposedAgentAction } from 'economic_autonomy';

export function createPredictiveRoutes(context: PlatformContext): Router {
  const router = Router();

  router.post('/score', (req: Request, res: Response) => {
    const body = req.body as { agentId?: string; actions?: ProposedAgentAction[] };
    if (!body.agentId || !Array.isArray(body.actions) || body.actions.length === 0) {
      return res.status(400).json({ status: 'error', message: 'Missing agentId or actions.' });
    }

    const ranking = context.predictiveAllocationService.rankActions(body.agentId, body.actions);
    return res.json({
      status: 'success',
      differentiators: {
        predictiveSynergyMetrics: true,
        cooperativeIntelligenceWeighting: true,
        roiAwareAllocation: true
      },
      data: ranking
    });
  });

  return router;
}
