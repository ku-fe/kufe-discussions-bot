import {
  Events,
  ForumChannel,
  GuildBasedChannel,
  Message,
  PermissionsBitField,
  ThreadChannel,
} from 'discord.js';
import { config } from '../config/env.js';
import {
  ADD_DISCUSSION_COMMENT_MUTATION,
  CREATE_DISCUSSION_MUTATION,
  getRepositoryId,
  octokit,
} from '../github/client.js';
import { client } from './client.js';

// Discussion ID와 Thread ID를 매핑하는 Map
const threadToDiscussionMap = new Map<string, string>();

// 포럼 스레드 생성 이벤트 핸들러
export function setupForumHandler(): void {
  console.log(
    'Forum handler setup with channel ID:',
    config.discord.forumChannelId,
  );

  // 봇이 시작될 때 포럼 채널 권한 확인
  client.once(Events.ClientReady, async () => {
    try {
      const channel = (await client.channels.fetch(
        config.discord.forumChannelId,
      )) as GuildBasedChannel;
      if (!channel || !(channel instanceof ForumChannel)) {
        console.error(
          'Could not find forum channel or channel is not a forum channel. Check the channel ID.',
        );
        return;
      }

      if (!client.user) {
        console.error('Client user is not available');
        return;
      }

      const permissions = channel.permissionsFor(client.user);
      console.log('Bot permissions in forum channel:', {
        viewChannel: permissions?.has(PermissionsBitField.Flags.ViewChannel),
        sendMessages: permissions?.has(PermissionsBitField.Flags.SendMessages),
        createPublicThreads: permissions?.has(
          PermissionsBitField.Flags.CreatePublicThreads,
        ),
        sendMessagesInThreads: permissions?.has(
          PermissionsBitField.Flags.SendMessagesInThreads,
        ),
        readMessageHistory: permissions?.has(
          PermissionsBitField.Flags.ReadMessageHistory,
        ),
      });
    } catch (error) {
      console.error('Error checking forum channel permissions:', error);
    }
  });

  client.on(Events.ThreadCreate, async (thread: ThreadChannel) => {
    console.log('Thread created event triggered:', {
      threadId: thread.id,
      threadName: thread.name,
      parentId: thread.parentId,
      parentType: thread.parent?.type,
      expectedChannelId: config.discord.forumChannelId,
    });

    try {
      // 지정된 포럼 채널의 스레드인지 확인
      if (!(thread.parent instanceof ForumChannel)) {
        console.log('Skipping: Parent is not a forum channel');
        return;
      }

      if (thread.parentId !== config.discord.forumChannelId) {
        console.log('Skipping: Wrong forum channel', {
          actual: thread.parentId,
          expected: config.discord.forumChannelId,
        });
        return;
      }

      // 스레드의 첫 메시지 가져오기
      console.log('Fetching starter message...');
      const firstMessage = await thread.fetchStarterMessage();
      if (!firstMessage) {
        console.error('Could not fetch starter message for thread:', thread.id);
        return;
      }

      console.log('Fetching repository ID...');
      const repositoryId = await getRepositoryId();
      console.log('Repository ID:', repositoryId);

      console.log('Creating GitHub discussion with:', {
        title: thread.name,
        contentPreview: firstMessage.content.substring(0, 100) + '...',
        repositoryId,
        categoryId: config.github.discussionCategoryId,
      });

      // GitHub Discussion 생성
      const response = await octokit.graphql(CREATE_DISCUSSION_MUTATION, {
        repositoryId,
        categoryId: config.github.discussionCategoryId,
        title: thread.name,
        body: firstMessage.content,
      });

      // Discussion ID를 저장
      const discussionId = (response as any).createDiscussion.discussion.id;
      threadToDiscussionMap.set(thread.id, discussionId);

      console.log('Successfully created GitHub discussion:', response);

      // 성공 메시지를 Discord 스레드에 보내기
      await thread.send({
        content: `✅ GitHub Discussion이 생성되었습니다!\n${(response as any).createDiscussion.discussion.url}`,
      });
    } catch (error) {
      console.error('Error handling forum thread creation:', error);

      // 에러 메시지를 Discord 스레드에 보내기
      await thread.send({
        content: `❌ GitHub Discussion 생성 중 오류가 발생했습니다.\n\`\`\`\n${error}\n\`\`\``,
      });
    }
  });

  // 메시지 생성 이벤트 핸들러
  client.on(Events.MessageCreate, async (message: Message) => {
    try {
      // 봇 메시지는 무시
      if (message.author.bot) return;

      // 스레드 메시지가 아니면 무시
      if (!message.channel.isThread()) return;

      const thread = message.channel as ThreadChannel;

      // 포럼 채널의 스레드가 아니면 무시
      if (!(thread.parent instanceof ForumChannel)) return;
      if (thread.parentId !== config.discord.forumChannelId) return;

      // 첫 메시지(포스트 내용)는 무시
      const firstMessage = await thread.fetchStarterMessage();
      if (message.id === firstMessage?.id) return;

      // Discussion ID 가져오기
      const discussionId = threadToDiscussionMap.get(thread.id);
      if (!discussionId) {
        console.log('No discussion ID found for thread:', thread.id);
        return;
      }

      console.log('Creating comment on GitHub discussion:', {
        discussionId,
        content: message.content,
      });

      // GitHub Discussion에 댓글 추가
      const response = await octokit.graphql(ADD_DISCUSSION_COMMENT_MUTATION, {
        discussionId,
        body: message.content,
      });

      console.log('Successfully created GitHub comment:', response);
    } catch (error) {
      console.error('Error handling message creation:', error);
    }
  });
}
