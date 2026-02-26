import { Router, type Request, type Response } from 'express';
import type { PlatformContext } from '../../context/PlatformContext.js';
import type { ResourceType, JointProject } from 'economic_autonomy';

export function createTreasuryRoutes(context: PlatformContext): Router {
  const router = Router();

  router.post('/pools', (req: Request, res: Response) => {
    const body = req.body as { name?: string; resourceType?: ResourceType; unit?: string };
    if (!body.name || !body.resourceType) {
      return res.status(400).json({ status: 'error', message: 'Missing name or resourceType.' });
    }

    const poolId = `pool-${Date.now()}`;
    const pool = context.treasuryService.createPool(poolId, body.name, body.resourceType, body.unit ?? 'USD');
    return res.json({ status: 'success', data: pool });
  });

  router.post('/pools/:poolId/contribute', (req: Request, res: Response) => {
    const poolId = String(req.params['poolId']);
    const body = req.body as { agentIds?: string[]; contributionPercentage?: number };
    if (!Array.isArray(body.agentIds) || body.agentIds.length === 0) {
      return res.status(400).json({ status: 'error', message: 'Missing agentIds.' });
    }

    const contributions = context.treasuryService.contributeAgents(
      poolId,
      body.agentIds,
      body.contributionPercentage ?? 0.1
    );

    return res.json({
      status: 'success',
      data: {
        pool: context.treasuryService.getPool(poolId),
        contributions
      }
    });
  });

  router.post('/projects', (req: Request, res: Response) => {
    const project = req.body as JointProject;
    if (!project || !project.id) {
      return res.status(400).json({ status: 'error', message: 'Missing project.id.' });
    }

    context.treasuryService.proposeProject(project);
    return res.json({ status: 'success', data: project });
  });

  router.post('/pools/:poolId/allocate', (req: Request, res: Response) => {
    const poolId = String(req.params['poolId']);
    const fundedProjects = context.treasuryService.allocatePool(poolId);
    return res.json({
      status: 'success',
      data: {
        fundedProjects,
        pool: context.treasuryService.getPool(poolId)
      }
    });
  });

  router.post('/projects/:projectId/reconcile', (req: Request, res: Response) => {
    const projectId = String(req.params['projectId']);
    const body = req.body as { realizedGain?: number };
    if (typeof body.realizedGain !== 'number') {
      return res.status(400).json({ status: 'error', message: 'Missing realizedGain.' });
    }

    context.treasuryService.reconcileProject(projectId, body.realizedGain);
    return res.json({ status: 'success', data: { projectId, realizedGain: body.realizedGain } });
  });

  return router;
}
