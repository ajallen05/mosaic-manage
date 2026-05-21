import app from './app.js';
import config from './config/index.js';
import { initScheduler } from './publishing/scheduler.js';

const server = app.listen(config.port, () => {
  console.log(`[mosaic-manage] Backend running on http://localhost:${config.port}`);
  console.log(`[mosaic-manage] Together AI key: ${config.togetherAI.apiKey ? 'set' : 'MISSING — set TOGETHER_AI_API_KEY'}`);
  initScheduler();
});

export default server;
