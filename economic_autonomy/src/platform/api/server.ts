import { createApp } from './createApp.js';

const app = createApp();
const port = Number(process.env['PORT'] ?? 3000);

app.listen(port, () => {
  console.log(`Economic Autonomy API listening on http://localhost:${port}`);
  console.log('Routes:');
  console.log(' - GET  /health');
  console.log(' - GET  /budget/:agentId');
  console.log(' - POST /budget/allocate');
  console.log(' - POST /budget/simulate');
  console.log(' - POST /predictive/score');
  console.log(' - POST /pnl/report');
  console.log(' - GET  /pnl/ledger');
  console.log(' - GET  /pnl/verify');
  console.log(' - POST /treasury/pools');
  console.log(' - POST /treasury/pools/:poolId/contribute');
  console.log(' - POST /treasury/projects');
  console.log(' - POST /treasury/pools/:poolId/allocate');
  console.log(' - POST /treasury/projects/:projectId/reconcile');
  console.log(' - POST /recalibration/:agentId');
});
