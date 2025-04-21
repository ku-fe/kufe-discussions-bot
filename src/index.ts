import dotenv from 'dotenv';

// 환경 변수 로드를 가장 먼저 수행
dotenv.config();

// 환경 변수 로드 테스트
if (!process.env.SUPABASE_URL) {
  console.warn('WARNING: SUPABASE_URL is not set in environment variables!');
}

if (!process.env.SUPABASE_KEY) {
  console.warn('WARNING: SUPABASE_KEY is not set in environment variables!');
}

import cors from 'cors';
import express from 'express';
import { setupDiscordBot } from './discord/bot.js';
import { testSupabaseConnection } from './lib/supabase.js';
import healthRouter from './routes/health.js';
import { listAllPosts } from './store/forumStore.js';

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.get('/', (req, res) => {
  res.send('KUFE Discussions Bot is running');
});

// Health check route
app.use('/health', healthRouter);

// Debug route to list all posts
app.get('/debug/posts', async (req, res) => {
  const posts = await listAllPosts();
  res.json(posts);
});

// Start the server
app.listen(PORT, async () => {
  console.log(`Server running on port ${PORT}`);

  // Test Supabase connection
  const connected = await testSupabaseConnection();
  if (!connected) {
    console.error(
      'Failed to connect to Supabase! Check your credentials and network.',
    );
    process.exit(1);
  }

  // Initialize Discord bot
  setupDiscordBot();

  // Log current posts
  const posts = await listAllPosts();
  console.log('Current posts:', posts);

  console.log('Application started successfully');
});
