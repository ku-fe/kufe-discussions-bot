import dotenv from 'dotenv';

// 환경 변수 로드를 가장 먼저 수행
dotenv.config();

// 환경 변수 로드 테스트
if (!process.env.GITHUB_TOKEN) {
  console.warn('WARNING: GITHUB_TOKEN is not set in environment variables!');
}

if (!process.env.GITHUB_REPOSITORY_ID) {
  console.warn('WARNING: GITHUB_REPOSITORY_ID is not set in environment variables!');
}

if (!process.env.GITHUB_DISCUSSION_CATEGORY_ID) {
  console.warn('WARNING: GITHUB_DISCUSSION_CATEGORY_ID is not set in environment variables!');
}

if (!process.env.SUPABASE_URL) {
  console.warn('WARNING: SUPABASE_URL is not set in environment variables!');
}

if (!process.env.SUPABASE_KEY) {
  console.warn('WARNING: SUPABASE_KEY is not set in environment variables!');
}

import cors from 'cors';
import express from 'express';
import { setupDiscordBot } from './discord/bot.js';
import { setupGithubWebhooks } from './github/webhooks.js';
import { testSupabaseConnection } from './lib/supabase.js';
import { listAllMappings } from './store/threadStore.js';

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.get('/', (req, res) => {
  res.send('KUFE Discussions Bot is running');
});

// Debug route to list all mappings
app.get('/debug/mappings', async (req, res) => {
  const mappings = await listAllMappings();
  res.json(mappings);
});

// Setup GitHub webhook routes
setupGithubWebhooks(app);

// Start the server
app.listen(PORT, async () => {
  console.log(`Server running on port ${PORT}`);
  
  // Test Supabase connection
  const connected = await testSupabaseConnection();
  if (!connected) {
    console.error('Failed to connect to Supabase! Check your credentials and network.');
    process.exit(1);
  }
  
  // Initialize Discord bot
  setupDiscordBot();
  
  // Log current mappings
  const mappings = await listAllMappings();
  console.log('Current thread mappings:', mappings);
  
  console.log('Application started successfully');
}); 