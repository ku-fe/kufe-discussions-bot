import { ChannelType, Client, Events, GatewayIntentBits } from 'discord.js';
import {
  addCommentToDiscussion,
  createDiscussionFromPost,
} from '../github/discussions.js';
import { setDiscordClient } from '../github/webhooks.js';
import {
  getGithubDiscussionId,
  listAllMappings,
} from '../store/threadStore.js';

// Create a new client instance
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

// Set to track processed thread IDs to prevent duplicate handling
const processedThreads = new Set<string>();

// 시작 시 기존 매핑 로드하여 processedThreads에 추가
async function loadExistingMappings(): Promise<void> {
  try {
    const mappings = await listAllMappings();
    for (const mapping of mappings) {
      processedThreads.add(mapping.discord_thread_id);
    }
    console.log(
      `Loaded ${processedThreads.size} existing thread mappings into memory cache.`,
    );
  } catch (error) {
    console.error('Error loading existing mappings:', error);
  }
}

export function setupDiscordBot(): void {
  // When the client is ready
  client.once(Events.ClientReady, async (readyClient) => {
    console.log(`Discord bot logged in as ${readyClient.user.tag}`);

    // Set Discord client reference for webhook handler
    setDiscordClient(client);

    // 기존 매핑 로드
    await loadExistingMappings();
  });

  // Handle forum post create events
  client.on(Events.ThreadCreate, async (thread) => {
    if (!thread.isThread() || thread.parent?.type !== ChannelType.GuildForum)
      return;

    // Skip if we've already processed this thread
    if (processedThreads.has(thread.id)) {
      console.log(`Skipping already processed thread: ${thread.id}`);
      return;
    }

    // 처리 지연으로 중복 생성 방지 (GitHub webhook이 먼저 처리되도록 기다림)
    console.log(
      `New forum post detected: ${thread.name} (ID: ${thread.id}). Waiting briefly to check if it was created via webhook...`,
    );
    await new Promise((resolve) => setTimeout(resolve, 3000)); // 3초 지연

    // 지연 후 다시 매핑 확인 (GitHub webhook이 이미 처리했을 수 있음)
    const discussionIdAfterDelay = await getGithubDiscussionId(thread.id);
    if (discussionIdAfterDelay) {
      console.log(
        `Skipping thread ${thread.id} - GitHub discussion was created via webhook: ${discussionIdAfterDelay}`,
      );
      processedThreads.add(thread.id);
      return;
    }

    // Add thread ID to processed set immediately to prevent double processing
    processedThreads.add(thread.id);

    try {
      console.log(`New forum post created: ${thread.name} (ID: ${thread.id})`);

      // Check if a GitHub discussion already exists for this thread
      const existingDiscussionId = await getGithubDiscussionId(thread.id);
      if (existingDiscussionId) {
        console.log(
          `Skipping thread ${thread.id} - GitHub discussion already exists: ${existingDiscussionId}`,
        );
        return;
      }

      // Get the initial message content
      const messages = await thread.messages.fetch({ limit: 1 });
      const initialMessage = messages.first();

      if (initialMessage) {
        // Create a GitHub discussion from this post
        const result = await createDiscussionFromPost({
          title: thread.name,
          body: initialMessage.content,
          authorName: initialMessage.author.username,
          threadId: thread.id,
        });

        // Send a confirmation message to the Discord thread
        await thread.send(
          `✅ GitHub Discussion이 성공적으로 생성되었습니다: ${result.url}`,
        );
      }
    } catch (error) {
      console.error('Error handling forum post creation:', error);

      // Send error notification
      try {
        await thread.send(
          '❌ GitHub Discussion 생성 중 오류가 발생했습니다. 관리자에게 문의해주세요.',
        );
      } catch (sendError) {
        console.error(
          'Failed to send error message to Discord thread:',
          sendError,
        );
      }
    }
  });

  // Handle new messages in forum threads
  client.on(Events.MessageCreate, async (message) => {
    // Ignore messages from bots to prevent feedback loops
    if (message.author.bot) return;

    // Check if the message is in a thread and the thread is in a forum channel
    if (
      !message.channel.isThread() ||
      message.channel.parent?.type !== ChannelType.GuildForum
    )
      return;

    // Ignore the initial message (already handled by ThreadCreate event)
    if (message.id === message.channel.id) return;

    try {
      const threadId = message.channel.id;

      // Check if we have a mapping for this thread
      const discussionId = await getGithubDiscussionId(threadId);

      if (discussionId) {
        console.log(
          `[MessageCreate] New message in thread ${threadId}, syncing to GitHub discussion ${discussionId}`,
        );

        // Add the comment to the GitHub discussion
        const result = await addCommentToDiscussion(
          discussionId,
          message.content,
          message.author.username,
        );

        // React to the message to indicate it was synced
        await message.react('✅');

        console.log(`[MessageCreate] Comment synced to GitHub: ${result.url}`);
      } else {
        console.log(
          `[MessageCreate] No GitHub discussion mapping found for thread ${threadId}. This message will not be synced.`,
        );
      }
    } catch (error) {
      console.error(
        '[MessageCreate] Error handling new message in forum thread:',
        error,
      );

      // React to the message to indicate error
      try {
        await message.react('❌');
      } catch (reactError) {
        console.error(
          '[MessageCreate] Failed to add error reaction:',
          reactError,
        );
      }
    }
  });

  // Log in to Discord with the token
  client.login(process.env.DISCORD_TOKEN);
}
