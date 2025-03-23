import cors from 'cors';
import dotenv from 'dotenv';
import express, { Express } from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import { Client, GatewayIntentBits } from 'discord.js';
import { config } from './config/env.js';
import { ForumHandler } from './discord/forumHandler.js';
import { GitHubClient } from './github/client.js';
import { SupabaseClient } from './services/SupabaseClient.js';

dotenv.config();

const app: Express = express();

// Middleware
app.use(helmet());
app.use(cors());
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Basic route
app.get('/', (req, res) => {
  res.json({ message: 'Welcome to Kufe Discussions Bot API' });
});

// Error handling middleware
app.use(
  (
    err: Error,
    req: express.Request,
    res: express.Response,
    next: express.NextFunction,
  ) => {
    console.error(err.stack);
    res.status(500).json({ message: 'Something went wrong!' });
  },
);

export default app;

export class App {
  private static instance: App;
  private readonly discordClient: Client;
  private readonly githubClient: GitHubClient;
  private readonly supabaseClient: SupabaseClient;
  private readonly forumHandler: ForumHandler;

  private constructor() {
    this.discordClient = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
      ],
    });
    this.githubClient = GitHubClient.getInstance();
    this.supabaseClient = SupabaseClient.getInstance();
    this.forumHandler = ForumHandler.getInstance(this.discordClient);
  }

  public static getInstance(): App {
    if (!App.instance) {
      App.instance = new App();
    }
    return App.instance;
  }

  private setupErrorHandlers(): void {
    process.on('unhandledRejection', (error) => {
      console.error('Unhandled promise rejection:', error);
    });

    process.on('uncaughtException', (error) => {
      console.error('Uncaught exception:', error);
      process.exit(1);
    });

    this.discordClient.on('error', (error) => {
      console.error('Discord client error:', error);
    });
  }

  public async start(): Promise<void> {
    try {
      console.log('Starting application...');

      // 1. Supabase 초기화
      console.log('Initializing Supabase...');
      await this.supabaseClient.initialize();
      console.log('Supabase initialized successfully');

      // 2. GitHub 클라이언트 초기화
      console.log('Initializing GitHub client...');
      await this.githubClient.initialize();
      console.log('GitHub client initialized successfully');

      // 3. Discord 클라이언트 초기화
      console.log('Initializing Discord client...');
      await this.discordClient.login(config.discord.token);
      console.log('Discord client initialized successfully');

      // 4. 포럼 핸들러 초기화
      console.log('Initializing forum handler...');
      await this.forumHandler.initialize();
      console.log('Forum handler initialized successfully');

      // 5. 에러 핸들러 설정
      this.setupErrorHandlers();
      console.log('Error handlers set up successfully');

      console.log('Application started successfully! 🚀');
    } catch (error) {
      console.error('Failed to start application:', error);
      process.exit(1);
    }
  }
}
