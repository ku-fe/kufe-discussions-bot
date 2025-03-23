import { Client, GatewayIntentBits } from 'discord.js';
import { config } from './config/env.js';
import { ForumHandler } from './discord/forumHandler.js';
import { GitHubClient } from './github/client.js';

async function main() {
  try {
    // Discord 클라이언트 초기화
    const client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildModeration,
      ],
    });

    // GitHub 클라이언트 초기화
    await GitHubClient.getInstance().initialize();

    // 포럼 핸들러 초기화
    const forumHandler = ForumHandler.getInstance(client);
    await forumHandler.initialize();

    // Discord 로그인
    console.log('Attempting to login to Discord...');
    await client.login(config.discord.token);
    console.log('Successfully logged in to Discord');
  } catch (error) {
    console.error('Failed to start the application:', error);
    process.exit(1);
  }
}

main();
