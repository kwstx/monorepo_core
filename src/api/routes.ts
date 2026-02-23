
import express, { Request, Response } from 'express';
import { CoordinationService } from './service/CoordinationService';
import { AgentCoordinationMessage } from '../schema/MessageSchema';

const service = new CoordinationService();
const router = express.Router();

// --- Negotiation Endpoints ---

router.post('/negotiate', async (req: Request, res: Response) => {
    try {
        const { message, sessionId } = req.body as { message: AgentCoordinationMessage, sessionId?: string };
        const result = await service.negotiate(message, sessionId);
        res.status(200).json(result);
    } catch (error: any) {
        res.status(400).json({ error: error.message });
    }
});

router.get('/negotiate/:sessionId', (req: Request, res: Response) => {
    const session = service.getSession(req.params.sessionId as string);
    if (!session) {
        return res.status(404).json({ error: 'Session not found' });
    }
    res.status(200).json(session);
});

// --- Contract Endpoints ---

router.post('/contracts', async (req: Request, res: Response) => {
    try {
        const { sessionId } = req.body as { sessionId: string };
        const contract = await service.createContract(sessionId);
        res.status(201).json(contract);
    } catch (error: any) {
        res.status(400).json({ error: error.message });
    }
});

router.get('/contracts/:contractId', (req: Request, res: Response) => {
    const contract = service.getContract(req.params.contractId as string);
    if (!contract) {
        return res.status(404).json({ error: 'Contract not found' });
    }
    res.status(200).json(contract);
});

// --- Validation Endpoints ---

router.post('/validate', async (req: Request, res: Response) => {
    try {
        const message = req.body as AgentCoordinationMessage;
        const validation = await service.validateMessage(message);
        res.status(200).json(validation);
    } catch (error: any) {
        res.status(400).json({ error: error.message });
    }
});

// --- Execution & Settlement Endpoints ---

router.post('/execute/confirm', async (req: Request, res: Response) => {
    try {
        const { contractId, outcomes } = req.body;
        const report = await service.confirmExecution(contractId, outcomes);
        res.status(200).json(report);
    } catch (error: any) {
        res.status(400).json({ error: error.message });
    }
});

// --- Dispute Resolution Endpoints ---

router.post('/disputes', async (req: Request, res: Response) => {
    try {
        const { sessionId, message } = req.body;
        const result = await service.resolveDispute(sessionId, message);
        res.status(200).json(result);
    } catch (error: any) {
        res.status(400).json({ error: error.message });
    }
});

export default router;
