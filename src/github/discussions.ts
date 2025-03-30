import { Octokit } from '@octokit/rest';
import { getGithubDiscussionId, storeMapping } from '../store/threadStore.js';
import { DiscordPostData } from '../types/discord.js';

// Repository details
const owner = process.env.GITHUB_OWNER || '';
const repo = process.env.GITHUB_REPO || '';

// 동시 처리 방지를 위한 글로벌 락
const threadCreationLocks = new Map<string, number>();

/**
 * Create a GitHub discussion from a Discord post
 */
export async function createDiscussionFromPost(
  postData: DiscordPostData,
): Promise<{ url: string }> {
  try {
    // 동일한 Discord 스레드에 대한 중복 생성 요청 방지
    const lockKey = `thread-${postData.threadId}`;
    if (threadCreationLocks.has(lockKey)) {
      const lockTime = threadCreationLocks.get(lockKey) || 0;
      // 60초 이내 락이 있으면 중복으로 간주
      if (Date.now() - lockTime < 60000) {
        console.log(
          `[createDiscussionFromPost] Duplicate request for thread ${postData.threadId}. Request is already in progress.`,
        );

        // 이미 처리 중이므로 기존 매핑을 확인
        const existingDiscussionId = await getGithubDiscussionId(
          postData.threadId,
        );
        if (existingDiscussionId) {
          console.log(
            `[createDiscussionFromPost] Found existing discussion for thread ${postData.threadId} during lock check.`,
          );
          const existingUrl = await getDiscussionUrl(existingDiscussionId);
          return { url: existingUrl || 'unknown' };
        }

        // 짧은 대기 후 재시도 (처리 중인 요청이 완료될 때까지)
        console.log(
          `[createDiscussionFromPost] Waiting for ongoing request to complete...`,
        );
        await new Promise((resolve) => setTimeout(resolve, 5000));

        // 다시 확인
        const discussionIdAfterWait = await getGithubDiscussionId(
          postData.threadId,
        );
        if (discussionIdAfterWait) {
          console.log(
            `[createDiscussionFromPost] Found discussion after waiting: ${discussionIdAfterWait}`,
          );
          const url = await getDiscussionUrl(discussionIdAfterWait);
          return { url: url || 'unknown' };
        }

        // 여전히 없으면 계속 진행 (이전 요청이 실패했을 수 있음)
      } else {
        // 오래된 락은 제거
        threadCreationLocks.delete(lockKey);
      }
    }

    // 새 락 설정
    threadCreationLocks.set(lockKey, Date.now());

    // 5분 후 자동 락 해제 설정
    setTimeout(
      () => {
        threadCreationLocks.delete(lockKey);
      },
      5 * 60 * 1000,
    );

    console.log(
      `[createDiscussionFromPost] Checking for existing GitHub discussion for Discord thread ${postData.threadId}`,
    );

    // 중복 생성 방지: threadId에 대한 매핑이 이미 존재하는지 확인
    const existingDiscussionId = await getGithubDiscussionId(postData.threadId);
    if (existingDiscussionId) {
      console.log(
        `[createDiscussionFromPost] Discussion already exists for thread ${postData.threadId}: ${existingDiscussionId}. Skipping creation.`,
      );
      const existingUrl = await getDiscussionUrl(existingDiscussionId);
      return { url: existingUrl || 'unknown' };
    }

    // 추가 중복 생성 방지 지연 (5초 대기로 증가)
    console.log(
      `[createDiscussionFromPost] Adding short delay to prevent race conditions...`,
    );
    await new Promise((resolve) => setTimeout(resolve, 5000));

    // 지연 후 다시 확인
    const discussionIdAfterDelay = await getGithubDiscussionId(
      postData.threadId,
    );
    if (discussionIdAfterDelay) {
      console.log(
        `[createDiscussionFromPost] Discussion was created during delay for thread ${postData.threadId}: ${discussionIdAfterDelay}. Skipping creation.`,
      );
      const existingUrl = await getDiscussionUrl(discussionIdAfterDelay);
      return { url: existingUrl || 'unknown' };
    }

    // 실행 시점에 토큰 가져오기
    const githubToken = process.env.GITHUB_TOKEN;
    const categoryId = process.env.GITHUB_DISCUSSION_CATEGORY_ID;
    const repositoryId = process.env.GITHUB_REPOSITORY_ID;

    // 필수 값 유효성 확인
    if (!githubToken) {
      console.error(
        '[createDiscussionFromPost] GitHub token is missing! Check your .env file',
      );
      throw new Error('GitHub token is missing');
    }

    if (!categoryId) {
      console.error(
        '[createDiscussionFromPost] GitHub discussion category ID is missing! Check your .env file',
      );
      throw new Error('GitHub discussion category ID is missing');
    }

    if (!repositoryId) {
      console.error(
        '[createDiscussionFromPost] GitHub repository ID is missing! Check your .env file',
      );
      throw new Error('GitHub repository ID is missing');
    }

    // 매번 새로운 Octokit 인스턴스 생성
    const octokit = new Octokit({
      auth: githubToken,
    });

    console.log(
      `[createDiscussionFromPost] Creating GitHub discussion from Discord post: ${postData.title} (Thread ID: ${postData.threadId})`,
    );
    console.log(
      `[createDiscussionFromPost] Using GitHub token: ${githubToken.substring(0, 4)}...${githubToken.substring(githubToken.length - 4)}`,
    );
    console.log(
      `[createDiscussionFromPost] Repository ID: ${repositoryId}, Category ID: ${categoryId}`,
    );

    // GraphQL 쿼리 방식
    const mutation = `
      mutation CreateDiscussion($repositoryId: ID!, $categoryId: ID!, $title: String!, $body: String!) {
        createDiscussion(input: {
          repositoryId: $repositoryId,
          categoryId: $categoryId,
          body: $body,
          title: $title
        }) {
          discussion {
            id
            url
          }
        }
      }
    `;

    const variables = {
      repositoryId: repositoryId,
      categoryId: categoryId,
      body: postData.body,
      title: postData.title,
    };

    console.log(
      '[createDiscussionFromPost] Sending GraphQL mutation with variables:',
      JSON.stringify(variables, null, 2),
    );

    const response = (await octokit.graphql(mutation, variables)) as {
      createDiscussion: { discussion: { id: string; url: string } };
    };

    console.log(
      '[createDiscussionFromPost] GitHub discussion created successfully',
      response,
    );

    // Store the mapping between Discord thread ID and GitHub discussion ID
    const discussionId = response.createDiscussion.discussion.id;
    const discussionUrl = response.createDiscussion.discussion.url;
    await storeMapping(postData.threadId, discussionId, discussionUrl);

    return { url: discussionUrl };
  } catch (error: any) {
    console.error(
      '[createDiscussionFromPost] Error creating GitHub discussion:',
    );
    if (error.message) console.error('Message:', error.message);
    if (error.status) console.error('Status:', error.status);
    if (error.response) {
      console.error('Response headers:', error.response.headers);
      console.error('Response data:', error.response.data);
    }

    // 오류 세부 정보 출력
    if (error.errors) {
      console.error('GraphQL Errors:', JSON.stringify(error.errors, null, 2));
    }

    throw error;
  }
}

/**
 * Get discussion URL by ID using GitHub API
 */
async function getDiscussionUrl(discussionId: string): Promise<string | null> {
  try {
    const githubToken = process.env.GITHUB_TOKEN;

    if (!githubToken) {
      console.error(
        '[getDiscussionUrl] GitHub token is missing! Check your .env file',
      );
      return null;
    }

    // Create a new Octokit instance
    const octokit = new Octokit({
      auth: githubToken,
    });

    // Query to get discussion URL by ID
    const query = `
      query GetDiscussion($id: ID!) {
        node(id: $id) {
          ... on Discussion {
            url
          }
        }
      }
    `;

    const variables = { id: discussionId };

    const response = (await octokit.graphql(query, variables)) as {
      node: { url: string };
    };
    return response.node.url;
  } catch (error) {
    console.error(
      `[getDiscussionUrl] Error getting discussion URL for ID ${discussionId}:`,
      error,
    );
    return null;
  }
}

/**
 * Add a comment to an existing GitHub discussion
 */
export async function addCommentToDiscussion(
  discussionId: string,
  body: string,
  authorName: string,
): Promise<{ url: string }> {
  try {
    const githubToken = process.env.GITHUB_TOKEN;
    const repositoryId = process.env.GITHUB_REPOSITORY_ID;

    if (!githubToken) {
      console.error('GitHub token is missing! Check your .env file');
      throw new Error('GitHub token is missing');
    }

    if (!repositoryId) {
      console.error('GitHub repository ID is missing! Check your .env file');
      throw new Error('GitHub repository ID is missing');
    }

    // Create a new Octokit instance
    const octokit = new Octokit({
      auth: githubToken,
    });

    // Add author attribution and a special marker to identify this comment came from Discord
    // [via-discord] 마커는 웹훅 핸들러에서 댓글 출처를 식별하는 데 사용됩니다
    const commentBody = `**${authorName}**:\n\n${body}\n\n<!-- [via-discord] -->`;

    console.log(`Adding comment to GitHub discussion ${discussionId}`);

    // Use GraphQL to add a comment to the discussion
    const mutation = `
      mutation AddDiscussionComment($discussionId: ID!, $body: String!) {
        addDiscussionComment(input: {
          discussionId: $discussionId,
          body: $body
        }) {
          comment {
            id
            url
          }
        }
      }
    `;

    const variables = {
      discussionId: discussionId,
      body: commentBody,
    };

    const response = (await octokit.graphql(mutation, variables)) as {
      addDiscussionComment: { comment: { id: string; url: string } };
    };

    console.log('Comment added successfully', response);

    return { url: response.addDiscussionComment.comment.url };
  } catch (error: any) {
    console.error('Error adding comment to GitHub discussion:');
    if (error.message) console.error('Message:', error.message);
    if (error.status) console.error('Status:', error.status);
    if (error.response) {
      console.error('Response headers:', error.response.headers);
      console.error('Response data:', error.response.data);
    }

    if (error.errors) {
      console.error('GraphQL Errors:', JSON.stringify(error.errors, null, 2));
    }

    throw error;
  }
}

/**
 * Escape quotes and newlines for GraphQL string
 * Not needed with the variables approach
 */
function escapeString(str: string): string {
  return str.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n');
}
