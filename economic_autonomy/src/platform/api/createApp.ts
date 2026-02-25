import express from 'express';
import { createPlatformContext } from '../context/PlatformContext.js';
import { createBudgetRoutes } from './routes/budgetRoutes.js';
import { createPnlRoutes } from './routes/pnlRoutes.js';
import { createTreasuryRoutes } from './routes/treasuryRoutes.js';
import { createRecalibrationRoutes } from './routes/recalibrationRoutes.js';
import { createPredictiveRoutes } from './routes/predictiveRoutes.js';

export function createApp() {
  const app = express();
  const context = createPlatformContext();

  app.use(express.json());

  app.get('/health', (_req, res) => {
    res.json({
      status: 'ok',
      system: 'economic-autonomy-platform',
      architecture: 'modular-api',
      differentiators: [
        'predictive_synergy_metrics',
        'cooperative_intelligence_weighting',
        'roi_aware_allocation'
      ]
    });
  });

  app.use('/budget', createBudgetRoutes(context));
  app.use('/predictive', createPredictiveRoutes(context));
  app.use('/pnl', createPnlRoutes(context));
  app.use('/treasury', createTreasuryRoutes(context));
  app.use('/recalibration', createRecalibrationRoutes(context));

  return app;
}
