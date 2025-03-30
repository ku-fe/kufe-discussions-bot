import { Octokit } from '@octokit/rest';
import { DiscordPostData } from '../types/discord';

// Initialize Octokit
const octokit = new Octokit({
  auth: process.env.GITHUB_TOKEN
});

// Repository details
const owner = process.env.GITHUB_OWNER || '';
const repo = process.env.GITHUB_REPO || '';
const categoryId = process.env.GITHUB_CATEGORY_ID || '';

/**
 * Create a GitHub discussion from a Discord post
 */
export async function createDiscussionFromPost(postData: DiscordPostData): Promise<void> {
  try {
    console.log(`Creating GitHub discussion from Discord post: ${postData.title}`);
    
    const response = await octokit.graphql(`
      mutation {
        createDiscussion(input: {
          repositoryId: "${process.env.GITHUB_REPOSITORY_ID}",
          categoryId: "${categoryId}",
          body: "${escapeString(postData.body)}",
          title: "${escapeString(postData.title)}"
        }) {
          discussion {
            id
            url
          }
        }
      }
    `);
    
    console.log('GitHub discussion created successfully', response);
    
    // Here you would also store the mapping between Discord thread ID and GitHub discussion ID
    // This would typically be done in a database
    
  } catch (error) {
    console.error('Error creating GitHub discussion:', error);
    throw error;
  }
}

/**
 * Escape quotes and newlines for GraphQL string
 */
function escapeString(str: string): string {
  return str
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n');
} 