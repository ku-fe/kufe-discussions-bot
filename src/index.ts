import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';
import { setupDiscordBot } from './discord/bot';
import { setupGithubWebhooks } from './github/webhooks';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.get('/', (req, res) => {
  res.send('KUFE Discussions Bot is running');
});

// Setup GitHub webhook routes
setupGithubWebhooks(app);

// Start the server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  
  // Initialize Discord bot
  setupDiscordBot();
  
  console.log('Application started successfully');
}); 