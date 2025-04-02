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

// 글로벌 동기화 락 객체 - 동시 처리 방지
const syncLocks = {
  // 스레드 생성 중인 제목 추적
  threadsByTitle: new Map<string, { timestamp: number; threadId: string }>(),
  // GitHub에 댓글 전송 중인 Discord 메시지 ID 추적
  messageInProgress: new Set<string>(),
  // 최근 처리된 Discord 스레드-메시지 매핑 (스레드ID-메시지ID 형식)
  recentlyProcessed: new Map<string, Set<string>>(),
  // GitHub에 이미 전송된 메시지 ID 추적 (중복 전송 방지)
  sentToGitHub: new Set<string>(),

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

  // 메시지 처리 시작
  lockMessage(messageId: string): boolean {
    if (this.messageInProgress.has(messageId)) {
      console.log(`Message ${messageId} is already being processed. Skipping.`);
      return false;
    }
    this.messageInProgress.add(messageId);
    console.log(`Created lock for message "${messageId}"`);
    return true;
  },

  // 메시지 처리 완료
  unlockMessage(messageId: string): void {
    this.messageInProgress.delete(messageId);
    console.log(`Released lock for message ${messageId}`);
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

  // GitHub에 보낸 메시지로 표시
  markSentToGitHub(messageId: string): void {
    this.sentToGitHub.add(messageId);

    // 6시간 후 자동 제거 - 장기간 메모리 사용량 제한
    setTimeout(
      () => {
        this.sentToGitHub.delete(messageId);
      },
      6 * 60 * 60 * 1000,
    ); // 6시간
  },

  // 메시지가 이미 GitHub에 전송되었는지 확인
  isAlreadySentToGitHub(messageId: string): boolean {
    return this.sentToGitHub.has(messageId);
  },
};

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
      // 처리 지연으로 중복 생성 방지 (GitHub webhook이 먼저 처리되도록 기다림)
      console.log(
        `New forum post detected: ${thread.name} (ID: ${thread.id}). Waiting briefly to check if it was created via webhook...`,
      );
      await new Promise((resolve) => setTimeout(resolve, 5000)); // 5초 지연

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

      console.log(`New forum post created: ${thread.name} (ID: ${thread.id})`);

      // Get the initial message content
      const messages = await thread.messages.fetch({ limit: 1 });
      const initialMessage = messages.first();

      if (initialMessage) {
        // 메시지 처리 중 표시
        syncLocks.addProcessedMessage(thread.id, initialMessage.id);

        // Create a GitHub discussion from this post
        const result = await createDiscussionFromPost({
          title: thread.name,
          body: initialMessage.content,
          authorName: initialMessage.author.username,
          threadId: thread.id,
        });

        // Send a confirmation message to the Discord thread - 더 깔끔한 형식으로
        await thread.send(`GitHub 링크: <${result.url}>`);
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
    } finally {
      // 항상 락을 해제
      syncLocks.unlockThread(thread.name);
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

    // Check if the message is in the specific discussion forum channel
    const forumChannelId = process.env.DISCORD_FORUM_CHANNEL_ID;
    if (!forumChannelId || message.channel.parent.id !== forumChannelId) {
      console.log(
        `Skipping message ${message.id} - not in the discussion forum channel`,
      );
      return;
    }

    // Ignore the initial message (already handled by ThreadCreate event)
    if (message.id === message.channel.id) return;

    // GitHub에서 온 댓글은 무시 (순환 참조 방지) - 문제가 해결되었으므로 여기서 더 이상 필요하지 않음
    // 하지만 안전을 위해 유지
    if (message.content.includes('[github-comment]')) {
      console.log(
        `[MessageCreate] Skipping message from GitHub: ${message.id}`,
      );
      return;
    }

    const threadId = message.channel.id;
    const messageId = message.id;

    // 즉시 처리된 메시지로 표시 (중복 방지를 위해 먼저 표시)
    addProcessedMessage(messageId);
    syncLocks.addProcessedMessage(threadId, messageId);

    // 강화된 중복 방지 체크 (모든 조건을 검사)
    if (
      // 1. 이미 처리된 메시지인지 확인
      processedMessages.has(messageId) ||
      // 2. 스레드별 최근 처리 메시지 확인
      syncLocks.isMessageProcessed(threadId, messageId) ||
      // 3. 이미 GitHub에 전송된 메시지인지 확인 (새로 추가)
      syncLocks.isAlreadySentToGitHub(messageId)
    ) {
      console.log(
        `[MessageCreate] Skipping already processed message: ${messageId}`,
      );
      return;
    }

    // 메시지 처리 락 획득 시도
    if (!syncLocks.lockMessage(messageId)) {
      console.log(
        `[MessageCreate] Message ${messageId} is locked by another process. Skipping.`,
      );
      return; // 이미 처리 중인 메시지
    }

    try {
      // 중복 체크를 여기서 다시 한번 수행 (여러 인스턴스 실행 시 경쟁 상태 방지)
      if (syncLocks.isAlreadySentToGitHub(messageId)) {
        console.log(
          `[MessageCreate] Message ${messageId} was already marked as sent to GitHub. Skipping.`,
        );
        return;
      }

      // 미리 GitHub 전송 표시 - 다른 인스턴스/이벤트에서 중복 처리 방지
      syncLocks.markSentToGitHub(messageId);

      // Check if we have a mapping for this thread
      const discussionId = await getGithubDiscussionId(threadId);

      if (discussionId) {
        console.log(
          `[MessageCreate] Message in thread ${threadId}, syncing to GitHub discussion ${discussionId}`,
        );

        // Add the comment to the GitHub discussion with improved error handling
        try {
          const result = await addCommentToDiscussion(
            discussionId,
            message.content,
            message.author.username,
          );

          // 댓글이 정상적으로 추가되었으면 체크 이모지 추가 (중복 방지 정책 성공)
          if (result.url !== 'duplicate-prevented') {
            await message.react('✅');
            console.log(
              `[MessageCreate] Comment synced to GitHub: ${result.url}`,
            );
          } else {
            // 중복 방지 메커니즘에 의해 처리된 경우
            console.log(
              `[MessageCreate] Duplicate comment prevented by comment lock mechanism`,
            );
            await message.react('🔄'); // 다른 이모지로 중복 방지를 표시
          }
        } catch (commentError) {
          console.error(
            '[MessageCreate] Error adding comment to GitHub:',
            commentError,
          );
          await message.react('❌');
        }
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
    } finally {
      // 항상 락을 해제
      syncLocks.unlockMessage(messageId);
    }
  });

  // Log in to Discord with the token
  client.login(process.env.DISCORD_TOKEN);
}
