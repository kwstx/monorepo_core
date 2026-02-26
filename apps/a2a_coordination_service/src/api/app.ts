
import express from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';
import routes from './routes.js';

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json());

// API versioning
app.use('/api/v1', routes);

// Health check
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'UP', service: 'A2A Coordination Layer' });
});

app.listen(port, () => {
    console.log(`A2A Coordination Service running on port ${port}`);
    console.log(`API endpoints available at http://localhost:${port}/api/v1`);
});

export default app;
