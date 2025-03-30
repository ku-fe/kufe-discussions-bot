import crypto from 'crypto';
import {
  ChannelType,
  Client,
  DMChannel,
  ForumChannel,
  NewsChannel,
  TextChannel,
  ThreadChannel,
} from 'discord.js';
import { Express, Request, Response } from 'express';
import { getDiscordThreadId } from '../store/threadStore.js';
import {
  GitHubComment,
  GitHubDiscussion,
  GitHubDiscussionCommentEvent,
  GitHubDiscussionEvent,
} from '../types/github.js';

// Client reference - will be set via setDiscordClient
let discordClient: Client | null = null;

// Discussion ID가 처리 중인지 추적하는 Set
const processingDiscussions = new Set<string>();

// 최근 처리된 GitHub 댓글 ID 기록 (중복 방지)
const processedComments = new Map<string, number>();

// 동시에 처리 중인 댓글을 추적하기 위한 락
const commentProcessingLocks = new Set<string>();

/**
 * Set Discord client reference for use in webhooks
 */
export function setDiscordClient(client: Client): void {
  discordClient = client;
}

/**
 * Verify GitHub webhook signature
 */
function verifyGitHubWebhook(req: Request): boolean {
  const signature = req.headers['x-hub-signature-256'] as string;
  const secret = process.env.GITHUB_WEBHOOK_SECRET;
  const payload = JSON.stringify(req.body);

  if (!signature) {
    console.error('No signature found in GitHub webhook request');
    return false;
  }

  if (!secret) {
    console.error('GITHUB_WEBHOOK_SECRET not set in environment variables');
    return false;
  }

  // Create HMAC
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(payload);
  const calculatedSignature = 'sha256=' + hmac.digest('hex');

  // Constant-time comparison to prevent timing attacks
  const equal = crypto.timingSafeEqual(
    Buffer.from(calculatedSignature),
    Buffer.from(signature),
  );

  if (!equal) {
    console.error('GitHub webhook signature verification failed');
    return false;
  }

  return true;
}

/**
 * Set up GitHub webhook routes
 */
export function setupGithubWebhooks(app: Express): void {
  // Handle discussion created event
  app.post('/webhooks/github', async (req: Request, res: Response) => {
    try {
      // Detailed logging of the request
      console.log(`Received GitHub webhook request:`, {
        headers: {
          event: req.headers['x-github-event'],
          delivery: req.headers['x-github-delivery'],
          signature: req.headers['x-hub-signature-256']
            ? '[Present]'
            : '[Missing]',
        },
      });

      // Skip verification in development mode for testing
      if (process.env.NODE_ENV !== 'development') {
        if (!verifyGitHubWebhook(req)) {
          console.error('GitHub webhook verification failed');
          return res.status(401).send('Unauthorized');
        }
      } else {
        console.log('Skipping webhook verification in development mode');
      }

      const event = req.headers['x-github-event'] as string;
      const payload = req.body;

      console.log(
        `Processing GitHub webhook event: ${event}, action: ${payload.action}`,
      );

      // Check if this is a discussion event
      if (event === 'discussion') {
        const discussionPayload = payload as GitHubDiscussionEvent;

        // Handle discussion created event
        if (discussionPayload.action === 'created') {
          await handleDiscussionCreated(discussionPayload.discussion);
        }
        // Handle other discussion events as needed
        else if (discussionPayload.action === 'edited') {
          await handleDiscussionEdited(discussionPayload.discussion);
        }
      }
      // Handle discussion comment events
      else if (event === 'discussion_comment') {
        const commentPayload = payload as GitHubDiscussionCommentEvent;
        if (commentPayload.action === 'created') {
          await handleDiscussionCommentCreated(
            commentPayload.discussion,
            commentPayload.comment,
          );
        }
      }

      res.status(200).send('Webhook received');
    } catch (error) {
      console.error('Error processing GitHub webhook:', error);
      res.status(500).send('Error processing webhook');
    }
  });
}

/**
 * Handle discussion created event
 */
async function handleDiscussionCreated(
  discussion: GitHubDiscussion,
): Promise<void> {
  try {
    console.log(`New GitHub discussion created: ${discussion.title}`);

    if (!discordClient) {
      console.error('Discord client not available');
      return;
    }

    // Get forum channel ID from environment
    const forumChannelId = process.env.DISCORD_FORUM_CHANNEL_ID;
    if (!forumChannelId) {
      console.error(
        'Discord forum channel ID not set in environment variables',
      );
      return;
    }

    // 중복 생성 방지: 이미 해당 GitHub discussion ID에 대한 Discord thread 매핑이 있는지 확인
    const { getDiscordThreadId } = await import('../store/threadStore.js');
    const existingThreadId = await getDiscordThreadId(discussion.node_id);
    if (existingThreadId) {
      console.log(
        `Skipping GitHub discussion ${discussion.node_id} - Discord thread already exists: ${existingThreadId}`,
      );
      return;
    }

    // 추가 중복 방지: 동일한 discussion node_id로 10초 내에 다시 호출되었는지 확인
    const discussionIdKey = `processing-${discussion.node_id}`;
    if (processingDiscussions.has(discussionIdKey)) {
      console.log(
        `Skipping GitHub discussion ${discussion.node_id} - Already being processed`,
      );
      return;
    }

    // 처리 중 표시
    processingDiscussions.add(discussionIdKey);

    // 10초 후에 처리 중 표시 제거
    setTimeout(() => {
      processingDiscussions.delete(discussionIdKey);
    }, 10000);

    // 제목으로 유사한 스레드가 최근에 생성되었는지 확인 (중복 방지 추가 로직)
    const forumChannel = await discordClient.channels.fetch(forumChannelId);
    if (!forumChannel || forumChannel.type !== ChannelType.GuildForum) {
      console.error(
        `Forum channel with ID ${forumChannelId} not found or is not a forum channel`,
      );
      return;
    }

    // 최근 스레드 조회 (최대 10개)
    const recentThreads = await (
      forumChannel as ForumChannel
    ).threads.fetchActive();

    // 제목이 동일한 스레드가 이미 있는지 확인
    const similarThread = recentThreads.threads.find(
      (t) =>
        t.name.toLowerCase() === discussion.title.toLowerCase() &&
        t.createdTimestamp &&
        t.createdTimestamp > Date.now() - 1000 * 60 * 5, // 5분 이내 생성된 스레드만 확인
    );

    if (similarThread) {
      console.log(
        `Found similar thread with title "${discussion.title}" - ID: ${similarThread.id}, created at ${new Date(similarThread.createdTimestamp || Date.now())}`,
      );
      console.log(
        `Storing mapping for existing similar thread instead of creating a new one`,
      );

      // 유사한 스레드와 GitHub discussion을 매핑
      const { storeMapping } = await import('../store/threadStore.js');
      storeMapping(similarThread.id, discussion.node_id, discussion.html_url);

      // 스레드에 GitHub 링크 메시지 추가
      await similarThread.send(
        `✅ GitHub Discussion 링크: ${discussion.html_url}`,
      );
      return;
    }

    // Create new thread in forum
    const thread = await (forumChannel as ForumChannel).threads.create({
      name: discussion.title,
      message: { content: '' },
      // message: {
      //   content: `**${discussion.user.login}**:\n\n${discussion.body}\n\n[View on GitHub](${discussion.html_url})`,
      // },
    });

    console.log(
      `Created Discord thread ${thread.id} for GitHub discussion ${discussion.id}`,
    );

    // Store mapping between GitHub discussion ID and Discord thread ID
    const { storeMapping } = await import('../store/threadStore.js');
    storeMapping(thread.id, discussion.node_id, discussion.html_url);
  } catch (error) {
    console.error('Error handling discussion created:', error);
    throw error;
  }
}

/**
 * Handle discussion edited event
 */
async function handleDiscussionEdited(
  discussion: GitHubDiscussion,
): Promise<void> {
  // Optional: Implement if you want to sync edits
  console.log(`GitHub discussion edited: ${discussion.title}`);
}

/**
 * Handle discussion comment created event
 */
async function handleDiscussionCommentCreated(
  discussion: GitHubDiscussion,
  comment: GitHubComment,
): Promise<void> {
  try {
    console.log(`New comment on GitHub discussion: ${discussion.title}`);

    if (!discordClient) {
      console.error('Discord client not available');
      return;
    }

    // Check if this comment originated from Discord
    // Discord 봇이 GitHub에 작성한 댓글인지 확인 (댓글 본문에 특정 표시가 있는지 검사)
    if (
      comment.body.includes('[via-discord]') ||
      comment.body.includes('<!-- [via-discord] -->')
    ) {
      console.log(
        'Skipping comment that originated from Discord to prevent loop',
      );
      return;
    }

    // 이미 처리한 댓글인지 확인 (1시간 이내)
    const commentId = comment.id.toString();
    const now = Date.now();
    if (processedComments.has(commentId)) {
      const processedTime = processedComments.get(commentId) || 0;
      // 1시간 이내에 처리된 댓글은 건너뛰기
      if (now - processedTime < 60 * 60 * 1000) {
        console.log(
          `Comment ${commentId} was already processed recently. Skipping.`,
        );
        return;
      }
      // 오래된 기록은 삭제
      processedComments.delete(commentId);
    }

    // 동일 댓글에 대한 동시 처리 방지 (락 획득)
    const commentLockKey = `comment-processing-${commentId}`;
    if (commentProcessingLocks.has(commentLockKey)) {
      console.log(
        `Comment ${commentId} is currently being processed. Skipping duplicate request.`,
      );
      return;
    }

    // 락 설정
    commentProcessingLocks.add(commentLockKey);

    try {
      // 중복 댓글 처리 방지 (댓글 ID 기반)
      const commentKey = `comment-${comment.id}`;
      if (processingDiscussions.has(commentKey)) {
        console.log(
          `Comment ${comment.id} is already being processed. Skipping.`,
        );
        return;
      }

      // 처리 중 표시
      processingDiscussions.add(commentKey);

      // 10초 후에 처리 중 표시 제거
      setTimeout(() => {
        processingDiscussions.delete(commentKey);
      }, 10000);

      // Get Discord thread ID for this discussion
      const discordThreadId = await getDiscordThreadId(discussion.node_id);

      if (!discordThreadId) {
        console.log(
          `No Discord thread mapping found for GitHub discussion ${discussion.node_id}`,
        );
        return;
      }

      // Get the Discord thread
      try {
        const thread = await discordClient.channels.fetch(discordThreadId);

        if (!thread) {
          console.error(`Thread with ID ${discordThreadId} not found`);
          return;
        }

        // Check if it's a channel type that supports sending messages
        if (
          thread instanceof TextChannel ||
          thread instanceof ThreadChannel ||
          thread instanceof DMChannel ||
          thread instanceof NewsChannel
        ) {
          // Send the comment to Discord
          await thread.send(
            `**${comment.user.login}**:\n\n${comment.body}\n\n<${comment.html_url}> [github-comment]`,
          );
          console.log(`Comment synced to Discord thread ${discordThreadId}`);

          // 처리 완료된 댓글로 기록
          processedComments.set(commentId, now);

          // 오래된 댓글 기록 정리 (메모리 관리)
          if (processedComments.size > 1000) {
            // 가장 오래된 100개 항목 제거
            const entries = Array.from(processedComments.entries());
            entries.sort((a, b) => a[1] - b[1]);
            for (let i = 0; i < 100 && i < entries.length; i++) {
              processedComments.delete(entries[i][0]);
            }
          }
        } else {
          console.error(
            `Channel with ID ${discordThreadId} is not a sendable channel type`,
          );
        }
      } catch (error) {
        console.error(
          `Error fetching Discord thread ${discordThreadId}:`,
          error,
        );
      }
    } finally {
      // 락 해제
      commentProcessingLocks.delete(commentLockKey);
    }
  } catch (error) {
    console.error('Error handling discussion comment created:', error);
    throw error;
  }
}
