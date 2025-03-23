import { Events, ForumChannel, ThreadChannel } from 'discord.js';
import { config } from '../config/env.js';
import {
  CREATE_DISCUSSION_MUTATION,
  getRepositoryId,
  octokit,
} from '../github/client.js';
import { client } from './client.js';

// 포럼 스레드 생성 이벤트 핸들러
export function setupForumHandler(): void {
  client.on(Events.ThreadCreate, async (thread: ThreadChannel) => {
    try {
      // 지정된 포럼 채널의 스레드인지 확인
      if (
        !(thread.parent instanceof ForumChannel) ||
        thread.parentId !== config.discord.forumChannelId
      ) {
        return;
      }

      // 스레드의 첫 메시지 가져오기
      const firstMessage = await thread.fetchStarterMessage();
      if (!firstMessage) {
        console.error('Could not fetch starter message for thread:', thread.id);
        return;
      }

      // 레포지토리 ID 가져오기
      const repositoryId = await getRepositoryId();

      // GitHub Discussion 생성
      const response = await octokit.graphql(CREATE_DISCUSSION_MUTATION, {
        repositoryId,
        categoryId: config.github.discussionCategoryId,
        title: thread.name,
        body: firstMessage.content,
      });

      console.log('Successfully created GitHub discussion:', response);

      // 성공 메시지를 Discord 스레드에 보내기
      await thread.send({
        content: `✅ GitHub Discussion이 생성되었습니다!\n${(response as any).createDiscussion.discussion.url}`,
      });
    } catch (error) {
      console.error('Error handling forum thread creation:', error);

      // 에러 메시지를 Discord 스레드에 보내기
      await thread.send({
        content: '❌ GitHub Discussion 생성 중 오류가 발생했습니다.',
      });
    }
  });
}
