import serverless from 'serverless-http';
import express from 'express';
import cors from 'cors';
import { connectDB } from './config/database';
import authRoutes from './routes/auth';

const app = express();

// Manual CORS middleware
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type,Authorization,X-Amz-Date,X-Api-Key,X-Amz-Security-Token');
  
  if (req.method === 'OPTIONS') {
    res.status(200).send();
    return;
  }
  next();
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'EmotionFlix API is running on Lambda',
    timestamp: new Date().toISOString()
  });
});

app.use('/auth', authRoutes);

// Initialize database connection once
connectDB().catch(console.error);

export const handler = serverless(app);