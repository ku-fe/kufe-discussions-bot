import { ChannelType, Client, Events, GatewayIntentBits } from 'discord.js';
import { postExists, storeComment, storePost } from '../store/forumStore.js';

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

// 메시지 중복 방지를 위한 최근 처리된 메시지 ID 세트
const processedMessages = new Set<string>();
// 5분 후 자동으로 메시지 ID를 제거하는 타이머 맵
const messageTimers = new Map<string, NodeJS.Timeout>();

// 메시지 ID를 처리된 목록에 추가하는 함수
function addProcessedMessage(messageId: string): void {
  processedMessages.add(messageId);

  // 이전 타이머가 있다면 제거
  if (messageTimers.has(messageId)) {
    clearTimeout(messageTimers.get(messageId));
  }

  // 5분 후 메시지 ID를 세트에서 제거하는 타이머 설정
  const timer = setTimeout(
    () => {
      processedMessages.delete(messageId);
      messageTimers.delete(messageId);
    },
    5 * 60 * 1000,
  ); // 5분

  messageTimers.set(messageId, timer);
}

// 글로벌 동기화 락 객체 - 동시 처리 방지
const syncLocks = {
  // 스레드 생성 중인 제목 추적
  threadsByTitle: new Map<string, { timestamp: number; threadId: string }>(),
  // 최근 처리된 Discord 스레드-메시지 매핑 (스레드ID-메시지ID 형식)
  recentlyProcessed: new Map<string, Set<string>>(),

  // 스레드 잠금 획득 시도
  lockThread(title: string, threadId: string): boolean {
    const normalizedTitle = title.toLowerCase().trim();

    // 이미 락이 존재하는지 확인
    const existingLock = this.threadsByTitle.get(normalizedTitle);

    if (existingLock) {
      // 60초 이상 지난 락은 만료된 것으로 간주
      if (Date.now() - existingLock.timestamp > 60000) {
        console.log(
          `Lock for thread "${normalizedTitle}" has expired. Removing old lock.`,
        );
        this.threadsByTitle.delete(normalizedTitle);
      } else if (existingLock.threadId !== threadId) {
        // 다른 스레드가 이미 처리 중
        console.log(
          `Another thread with title "${normalizedTitle}" is already being processed (${existingLock.threadId}). Skipping.`,
        );
        return false;
      } else {
        // 같은 스레드 ID에 대한 중복 요청 - 이미 처리 중
        console.log(
          `Thread "${threadId}" is already being processed. Skipping duplicate request.`,
        );
        return false;
      }
    }

    // 새 락 설정
    this.threadsByTitle.set(normalizedTitle, {
      timestamp: Date.now(),
      threadId,
    });
    console.log(
      `Created lock for thread "${threadId}" with title "${normalizedTitle}"`,
    );
    return true;
  },

  // 스레드 잠금 해제
  unlockThread(title: string): void {
    const normalizedTitle = title.toLowerCase().trim();
    this.threadsByTitle.delete(normalizedTitle);
    console.log(`Released lock for thread with title "${normalizedTitle}"`);
  },

  // 최근 처리된 메시지 추가 (스레드별 관리)
  addProcessedMessage(threadId: string, messageId: string): void {
    if (!this.recentlyProcessed.has(threadId)) {
      this.recentlyProcessed.set(threadId, new Set());
    }
    this.recentlyProcessed.get(threadId)?.add(messageId);

    // 30분 후 자동 제거
    setTimeout(
      () => {
        const messages = this.recentlyProcessed.get(threadId);
        if (messages) {
          messages.delete(messageId);
          if (messages.size === 0) {
            this.recentlyProcessed.delete(threadId);
          }
        }
      },
      30 * 60 * 1000,
    ); // 30분
  },

  // 해당 스레드에서 메시지가 이미 처리되었는지 확인
  isMessageProcessed(threadId: string, messageId: string): boolean {
    return !!this.recentlyProcessed.get(threadId)?.has(messageId);
  },
};

export function setupDiscordBot(): void {
  // When the client is ready
  client.once(Events.ClientReady, async (readyClient) => {
    console.log(`Discord bot logged in as ${readyClient.user.tag}`);
  });

  // Handle forum post create events
  client.on(Events.ThreadCreate, async (thread) => {
    if (!thread.isThread() || thread.parent?.type !== ChannelType.GuildForum)
      return;

    // Check if the thread is in the specific discussion forum channel
    const forumChannelId = process.env.DISCORD_FORUM_CHANNEL_ID;
    if (!forumChannelId || thread.parent.id !== forumChannelId) {
      console.log(
        `Skipping thread ${thread.id} - not in the discussion forum channel`,
      );
      return;
    }

    // Skip if we've already processed this thread
    if (processedThreads.has(thread.id)) {
      console.log(`Skipping already processed thread: ${thread.id}`);
      return;
    }

    // 락 획득 시도 - 실패하면 종료 (중복 생성 방지)
    if (!syncLocks.lockThread(thread.name, thread.id)) {
      // 이미 처리 중인 제목의 스레드
      processedThreads.add(thread.id); // 향후 중복 처리 방지를 위해 추가
      return;
    }

    // 처리가 끝나면 락 해제
    try {
      // Add thread ID to processed set immediately to prevent double processing
      processedThreads.add(thread.id);

      console.log(`New forum post created: ${thread.name} (ID: ${thread.id})`);

      // Get the initial message content
      const messages = await thread.messages.fetch({ limit: 1 });
      const initialMessage = messages.first();

      if (!initialMessage) {
        console.log(`No initial message found for thread ${thread.id}`);
        return;
      }

      // Store post in Supabase
      await storePost(
        thread.id,
        thread.name,
        initialMessage.content,
        initialMessage.author.id,
        initialMessage.author.username,
      );

      // Add checkmark emoji to the initial message
      await initialMessage.react('✅');
      console.log(`Added checkmark emoji to post ${thread.id}`);
    } catch (error) {
      console.error('Error processing thread:', error);
    } finally {
      syncLocks.unlockThread(thread.name);
    }
  });

  // Handle message events
  client.on(Events.MessageCreate, async (message) => {
    console.log(
      `New message received: ${message.id} in channel ${message.channel.id}`,
    );

    // Skip if message is from a bot
    if (message.author.bot) {
      console.log(`Skipping bot message: ${message.id}`);
      return;
    }

    // Check if message is in a thread
    if (!message.channel.isThread()) {
      console.log(`Skipping non-thread message: ${message.id}`);
      return;
    }

    // Check if the thread is in the specific discussion forum channel
    const forumChannelId = process.env.DISCORD_FORUM_CHANNEL_ID;
    if (!forumChannelId) {
      console.error('DISCORD_FORUM_CHANNEL_ID is not set');
      return;
    }

    if (message.channel.parent?.id !== forumChannelId) {
      console.log(
        `Skipping message from non-forum channel: ${message.channel.parent?.id}`,
      );
      return;
    }

    // Skip if we've already processed this message
    if (processedMessages.has(message.id)) {
      console.log(`Skipping already processed message: ${message.id}`);
      return;
    }

    // Skip if this message is already being processed
    if (syncLocks.isMessageProcessed(message.channel.id, message.id)) {
      console.log(
        `Skipping message ${message.id} - already processed in thread ${message.channel.id}`,
      );
      return;
    }

    // Add message to processed set
    addProcessedMessage(message.id);
    syncLocks.addProcessedMessage(message.channel.id, message.id);

    try {
      console.log(`Checking if thread exists: ${message.channel.id}`);
      // Check if thread exists in Supabase
      const exists = await postExists(message.channel.id);
      if (!exists) {
        console.log(`Thread ${message.channel.id} not found in Supabase`);
        return;
      }

      console.log(
        `Storing comment for message ${message.id} in thread ${message.channel.id}`,
      );
      // Store comment in Supabase
      await storeComment(
        message.id,
        message.channel.id,
        message.content,
        message.author.id,
        message.author.username,
      );

      // Add checkmark emoji to the comment
      await message.react('✅');
      console.log(`Added checkmark emoji to comment ${message.id}`);

      console.log(`Successfully stored comment ${message.id} in Supabase`);
    } catch (error) {
      console.error('Error processing message:', error);
    }
  });

  // Login to Discord
  const token = process.env.DISCORD_TOKEN;
  if (!token) {
    console.error('DISCORD_TOKEN is not set in environment variables');
    return;
  }

  client.login(token);
}
