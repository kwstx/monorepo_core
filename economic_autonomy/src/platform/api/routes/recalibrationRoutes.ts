import { Router, type Request, type Response } from 'express';
import type { PlatformContext } from '../../context/PlatformContext.js';

export function createRecalibrationRoutes(context: PlatformContext): Router {
  const router = Router();

  router.post('/:agentId', (req: Request, res: Response) => {
    const agentId = String(req.params['agentId']);

    try {
      const result = context.recalibrationService.recalibrateAgent(agentId);
      return res.json({ status: 'success', data: result });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown recalibration error.';
      return res.status(400).json({ status: 'error', message });
    }
  });

  return router;
}
