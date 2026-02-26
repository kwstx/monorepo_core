import {
  FeedbackIntegrationLayer,
  DynamicBudgetEngine,
  OverrideLearningLayer,
  PnLTracker,
  TreasuryEngine
} from 'economic_autonomy';
import { InMemoryPlatformStore } from '../state/InMemoryPlatformStore.js';
import { BudgetService } from '../services/BudgetService.js';
import { PnLService } from '../services/PnLService.js';
import { TreasuryService } from '../services/TreasuryService.js';
import { RecalibrationService } from '../services/RecalibrationService.js';
import { PredictiveAllocationService } from '../services/PredictiveAllocationService.js';

export interface PlatformContext {
  store: InMemoryPlatformStore;
  pnlTracker: PnLTracker;
  overrideLearningLayer: OverrideLearningLayer;
  dynamicBudgetEngine: DynamicBudgetEngine;
  feedbackIntegrationLayer: FeedbackIntegrationLayer;
  treasuryEngine: TreasuryEngine;
  budgetService: BudgetService;
  pnlService: PnLService;
  treasuryService: TreasuryService;
  recalibrationService: RecalibrationService;
  predictiveAllocationService: PredictiveAllocationService;
}

export function createPlatformContext(): PlatformContext {
  const store = new InMemoryPlatformStore();
  const pnlTracker = new PnLTracker();
  const overrideLearningLayer = new OverrideLearningLayer();
  const dynamicBudgetEngine = new DynamicBudgetEngine({ overrideLayer: overrideLearningLayer });
  const feedbackIntegrationLayer = new FeedbackIntegrationLayer(pnlTracker, dynamicBudgetEngine);
  const treasuryEngine = new TreasuryEngine(pnlTracker);
  const budgetService = new BudgetService(store);
  const pnlService = new PnLService(pnlTracker, budgetService);
  const treasuryService = new TreasuryService(treasuryEngine, budgetService);
  const recalibrationService = new RecalibrationService(feedbackIntegrationLayer, budgetService);
  const predictiveAllocationService = new PredictiveAllocationService(budgetService);

  return {
    store,
    pnlTracker,
    overrideLearningLayer,
    dynamicBudgetEngine,
    feedbackIntegrationLayer,
    treasuryEngine,
    budgetService,
    pnlService,
    treasuryService,
    recalibrationService,
    predictiveAllocationService
  };
}
