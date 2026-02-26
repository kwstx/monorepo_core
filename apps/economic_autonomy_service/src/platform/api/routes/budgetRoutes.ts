import { Router, type Request, type Response } from 'express';
import type { PlatformContext } from '../../context/PlatformContext.js';
import type { ProposedAgentAction } from 'economic_autonomy';

export function createBudgetRoutes(context: PlatformContext): Router {
  const router = Router();

  router.get('/:agentId', (req: Request, res: Response) => {
    const agentId = String(req.params['agentId']);
    const budget = context.budgetService.getOrCreateBudget(agentId);
    res.json({ status: 'success', data: budget });
  });

  router.post('/allocate', (req: Request, res: Response) => {
    const body = req.body as { agentId?: string; action?: ProposedAgentAction };
    if (!body.agentId || !body.action) {
      return res.status(400).json({ status: 'error', message: 'Missing agentId or action.' });
    }

    const { budget, evaluation } = context.budgetService.reserveForAction(body.agentId, body.action);
    if (evaluation.decision === 'block') {
      return res.status(403).json({ status: 'blocked', data: { evaluation, budget } });
    }

    return res.json({ status: 'success', data: { evaluation, budget } });
  });

  router.post('/simulate', (req: Request, res: Response) => {
    const action = req.body as ProposedAgentAction;
    if (!action || !action.agentId) {
      return res.status(400).json({ status: 'error', message: 'Missing action or action.agentId.' });
    }

    const evaluation = context.budgetService.evaluateAction(action.agentId, action);
    return res.json({
      status: 'success',
      data: {
        evaluation,
        recommendation:
          evaluation.decision === 'allow'
            ? 'Safe to execute.'
            : evaluation.decision === 'flag'
              ? 'Execute with caution.'
              : 'Do not execute.'
      }
    });
  });

  return router;
}
