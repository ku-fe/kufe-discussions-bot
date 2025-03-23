import 'dotenv/config';

interface Config {
  discord: {
    token: string;
    forumChannelId: string;
  };
  github: {
    token: string;
    owner: string;
    repo: string;
    discussionCategoryId: string;
  };
  server: {
    port: number;
    nodeEnv: string;
  };
}

function validateEnv(): Config {
  if (!process.env.DISCORD_TOKEN) {
    throw new Error('DISCORD_TOKEN is required');
  }
  if (!process.env.DISCORD_FORUM_CHANNEL_ID) {
    throw new Error('DISCORD_FORUM_CHANNEL_ID is required');
  }
  if (!process.env.GITHUB_TOKEN) {
    throw new Error('GITHUB_TOKEN is required');
  }
  if (!process.env.GITHUB_OWNER) {
    throw new Error('GITHUB_OWNER is required');
  }
  if (!process.env.GITHUB_REPO) {
    throw new Error('GITHUB_REPO is required');
  }
  if (!process.env.GITHUB_DISCUSSION_CATEGORY_ID) {
    throw new Error('GITHUB_DISCUSSION_CATEGORY_ID is required');
  }

  return {
    discord: {
      token: process.env.DISCORD_TOKEN,
      forumChannelId: process.env.DISCORD_FORUM_CHANNEL_ID,
    },
    github: {
      token: process.env.GITHUB_TOKEN,
      owner: process.env.GITHUB_OWNER,
      repo: process.env.GITHUB_REPO,
      discussionCategoryId: process.env.GITHUB_DISCUSSION_CATEGORY_ID,
    },
    server: {
      port: process.env.PORT ? parseInt(process.env.PORT, 10) : 3000,
      nodeEnv: process.env.NODE_ENV || 'development',
    },
  };
}

export const config = validateEnv();
