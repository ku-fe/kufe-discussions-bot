import { Octokit } from '@octokit/rest';
import { storeMapping } from '../store/threadStore.js';
import { DiscordPostData } from '../types/discord.js';

// Repository details
const owner = process.env.GITHUB_OWNER || '';
const repo = process.env.GITHUB_REPO || '';

/**
 * Create a GitHub discussion from a Discord post
 */
export async function createDiscussionFromPost(postData: DiscordPostData): Promise<{ url: string }> {
  try {
    // 실행 시점에 토큰 가져오기
    const githubToken = process.env.GITHUB_TOKEN;
    const categoryId = process.env.GITHUB_DISCUSSION_CATEGORY_ID;
    const repositoryId = process.env.GITHUB_REPOSITORY_ID;
    
    // 필수 값 유효성 확인
    if (!githubToken) {
      console.error('GitHub token is missing! Check your .env file');
      throw new Error('GitHub token is missing');
    }
    
    if (!categoryId) {
      console.error('GitHub discussion category ID is missing! Check your .env file');
      throw new Error('GitHub discussion category ID is missing');
    }
    
    if (!repositoryId) {
      console.error('GitHub repository ID is missing! Check your .env file');
      throw new Error('GitHub repository ID is missing');
    }
    
    // 매번 새로운 Octokit 인스턴스 생성
    const octokit = new Octokit({
      auth: githubToken
    });
    
    console.log(`Creating GitHub discussion from Discord post: ${postData.title}`);
    console.log(`Using GitHub token: ${githubToken.substring(0, 4)}...${githubToken.substring(githubToken.length - 4)}`);
    console.log(`Repository ID: ${repositoryId}, Category ID: ${categoryId}`);
    
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
      title: postData.title
    };
    
    console.log('Sending GraphQL mutation with variables:', JSON.stringify(variables, null, 2));
    
    const response = await octokit.graphql(mutation, variables) as { createDiscussion: { discussion: { id: string, url: string } } };
    
    console.log('GitHub discussion created successfully', response);
    
    // Store the mapping between Discord thread ID and GitHub discussion ID
    const discussionId = response.createDiscussion.discussion.id;
    const discussionUrl = response.createDiscussion.discussion.url;
    storeMapping(postData.threadId, discussionId, discussionUrl);
    
    return { url: discussionUrl };
    
  } catch (error: any) {
    console.error('Error creating GitHub discussion:');
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
 * Add a comment to an existing GitHub discussion
 */
export async function addCommentToDiscussion(discussionId: string, body: string, authorName: string): Promise<{ url: string }> {
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
      auth: githubToken
    });
    
    // Add author attribution
    const commentBody = `**${authorName}**:\n\n${body}`;
    
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
      body: commentBody
    };
    
    const response = await octokit.graphql(mutation, variables) as { addDiscussionComment: { comment: { id: string, url: string } } };
    
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
  return str
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n');
} 