import {
  Client,
  Events,
  ForumChannel,
  GuildBasedChannel,
  Message,
  PermissionsBitField,
  ThreadChannel,
} from 'discord.js';
import { config } from '../config/env';
import { GitHubClient } from '../github/client';
import { MappingService } from '../services/MappingService';

export class ForumHandler {
  private static instance: ForumHandler;
  private readonly client: Client;
  private readonly github: GitHubClient;
  private readonly mappingService: MappingService;

  private constructor(client: Client) {
    this.client = client;
    this.github = GitHubClient.getInstance();
    this.mappingService = MappingService.getInstance();
  }

  public static getInstance(client: Client): ForumHandler {
    if (!ForumHandler.instance) {
      ForumHandler.instance = new ForumHandler(client);
    }
    return ForumHandler.instance;
  }

  private async checkChannelPermissions(
    channel: ForumChannel,
  ): Promise<boolean> {
    if (!this.client.user) {
      console.error('Client user is not available');
      return false;
    }

    const permissions = channel.permissionsFor(this.client.user);
    if (!permissions) {
      console.error('Could not fetch permissions for the bot in this channel');
      return false;
    }

    const requiredPermissions = {
      viewChannel: permissions.has(PermissionsBitField.Flags.ViewChannel),
      sendMessages: permissions.has(PermissionsBitField.Flags.SendMessages),
      createPublicThreads: permissions.has(
        PermissionsBitField.Flags.CreatePublicThreads,
      ),
      sendMessagesInThreads: permissions.has(
        PermissionsBitField.Flags.SendMessagesInThreads,
      ),
      readMessageHistory: permissions.has(
        PermissionsBitField.Flags.ReadMessageHistory,
      ),
    };

    const missingPermissions = Object.entries(requiredPermissions)
      .filter(([_, hasPermission]) => !hasPermission)
      .map(([permission]) => permission);

    if (missingPermissions.length > 0) {
      console.error('Missing required permissions:', missingPermissions);
      return false;
    }

    console.log('Bot has all required permissions in forum channel');
    return true;
  }

  private async handleThreadCreate(thread: ThreadChannel): Promise<void> {
    console.log('Thread created event triggered:', {
      threadId: thread.id,
      threadName: thread.name,
      parentId: thread.parentId,
      parentType: thread.parent?.type,
    });

    try {
      // 지정된 포럼 채널의 스레드인지 확인
      if (!(thread.parent instanceof ForumChannel)) {
        console.log('Skipping: Parent is not a forum channel');
        return;
      }

      if (thread.parentId !== config.discord.forumChannelId) {
        console.log('Skipping: Wrong forum channel');
        return;
      }

      // 스레드의 첫 메시지 가져오기
      const firstMessage = await thread.fetchStarterMessage();
      if (!firstMessage) {
        console.error('Could not fetch starter message for thread:', thread.id);
        return;
      }

      // GitHub Discussion 생성
      const discussion = await this.github.createDiscussion(
        thread.name,
        firstMessage.content,
      );

      // 매핑 정보 저장
      this.mappingService.addMapping(thread.id, discussion.id, discussion.url);

      // 성공 메시지를 Discord 스레드에 보내기
      await thread.send({
        content: `✅ GitHub Discussion이 생성되었습니다!\n${discussion.url}`,
      });
    } catch (error) {
      console.error('Error handling forum thread creation:', error);
      await thread.send({
        content: `❌ GitHub Discussion 생성 중 오류가 발생했습니다.\n\`\`\`\n${error}\n\`\`\``,
      });
    }
  }

  private async handleMessageCreate(message: Message): Promise<void> {
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
      const discussionId = await this.mappingService.getDiscussionId(thread.id);
      if (!discussionId) {
        console.log('No discussion ID found for thread:', thread.id);
        return;
      }

      // GitHub Discussion에 댓글 추가
      const comment = await this.github.addComment(
        discussionId,
        message.content,
      );
      console.log('Successfully created GitHub comment:', comment);
    } catch (error) {
      console.error('Error handling message creation:', error);
    }
  }

  public async initialize(): Promise<void> {
    console.log(
      'Forum handler setup with channel ID:',
      config.discord.forumChannelId,
    );

    // 봇이 시작될 때 포럼 채널 권한 확인
    this.client.once(Events.ClientReady, async () => {
      try {
        const channel = (await this.client.channels.fetch(
          config.discord.forumChannelId,
        )) as GuildBasedChannel;

        if (!channel || !(channel instanceof ForumChannel)) {
          console.error(
            'Could not find forum channel or channel is not a forum channel. Check the channel ID.',
          );
          return;
        }

        await this.checkChannelPermissions(channel);
      } catch (error) {
        console.error('Error checking forum channel permissions:', error);
      }
    });

    // 이벤트 핸들러 등록
    this.client.on(Events.ThreadCreate, this.handleThreadCreate.bind(this));
    this.client.on(Events.MessageCreate, this.handleMessageCreate.bind(this));
  }
}
