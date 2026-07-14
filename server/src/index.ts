import './config/env';
import app from './app';
import database, { initializeDatabase } from './config/database';
import { env } from './config/env';

const startServer = async () => {
  try {
    console.log('Starting EmotionFlix...');
    await initializeDatabase();

    const server = app.listen(env.port, () => {
      console.log(`EmotionFlix is ready at http://localhost:${env.port}`);
    });

    const shutdown = () => {
      server.close(() => {
        void database.end().finally(() => process.exit(0));
      });
    };
    process.once('SIGINT', shutdown);
    process.once('SIGTERM', shutdown);
  } catch (error) {
    console.error('Failed to start EmotionFlix:', error);
    process.exit(1);
  }
};

void startServer();
