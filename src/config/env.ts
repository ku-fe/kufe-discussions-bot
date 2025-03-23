import 'dotenv/config';

export interface Config {
  discord: {
    token: string;
    forumChannelId: string;
  };
  github: {
    token: string;
    owner: string;
    repo: string;
    discussionCategoryId: string;
    webhookSecret: string;
  };
  supabase: {
    url: string;
    key: string;
  };
  server: {
    port: number;
    nodeEnv: string;
  };
}

export function validateEnv(): Config {
  const requiredEnvVars = {
    // Discord
    DISCORD_TOKEN: process.env.DISCORD_TOKEN,
    DISCORD_FORUM_CHANNEL_ID: process.env.DISCORD_FORUM_CHANNEL_ID,
    // GitHub
    GITHUB_TOKEN: process.env.GITHUB_TOKEN,
    GITHUB_OWNER: process.env.GITHUB_OWNER,
    GITHUB_REPO: process.env.GITHUB_REPO,
    GITHUB_DISCUSSION_CATEGORY_ID: process.env.GITHUB_DISCUSSION_CATEGORY_ID,
    GITHUB_WEBHOOK_SECRET: process.env.GITHUB_WEBHOOK_SECRET,
    // Supabase
    SUPABASE_URL: process.env.SUPABASE_URL,
    SUPABASE_KEY: process.env.SUPABASE_KEY,
  };

  const missingEnvVars = Object.entries(requiredEnvVars)
    .filter(([_, value]) => !value)
    .map(([key]) => key);

  if (missingEnvVars.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missingEnvVars.join(', ')}`,
    );
  }

  return {
    discord: {
      token: requiredEnvVars.DISCORD_TOKEN!,
      forumChannelId: requiredEnvVars.DISCORD_FORUM_CHANNEL_ID!,
    },
    github: {
      token: requiredEnvVars.GITHUB_TOKEN!,
      owner: requiredEnvVars.GITHUB_OWNER!,
      repo: requiredEnvVars.GITHUB_REPO!,
      discussionCategoryId: requiredEnvVars.GITHUB_DISCUSSION_CATEGORY_ID!,
      webhookSecret: requiredEnvVars.GITHUB_WEBHOOK_SECRET!,
    },
    supabase: {
      url: requiredEnvVars.SUPABASE_URL!,
      key: requiredEnvVars.SUPABASE_KEY!,
    },
    server: {
      port: process.env.PORT ? parseInt(process.env.PORT, 10) : 3000,
      nodeEnv: process.env.NODE_ENV || 'development',
    },
  };
}

export const config = validateEnv();
