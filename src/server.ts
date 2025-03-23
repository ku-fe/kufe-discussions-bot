import { initializeDiscordClient } from './discord/client.js';
import { setupForumHandler } from './discord/forumHandler.js';
import { initializeGitHubClient } from './github/client.js';

async function main() {
  try {
    // Discord 클라이언트 초기화
    await initializeDiscordClient();

    // GitHub 클라이언트 초기화
    await initializeGitHubClient();

    // 포럼 핸들러 설정
    setupForumHandler();

    console.log('Bot is ready!');
  } catch (error) {
    console.error('Failed to start the application:', error);
    process.exit(1);
  }
}

main();
