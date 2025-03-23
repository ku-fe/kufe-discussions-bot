import { config } from '../config/env.js';
import { octokit } from './client.js';

const GET_DISCUSSION_CATEGORIES = `
  query GetDiscussionCategories($owner: String!, $name: String!) {
    repository(owner: $owner, name: $name) {
      discussionCategories(first: 10) {
        nodes {
          id
          name
          description
          emoji
        }
      }
    }
  }
`;

async function main() {
  try {
    const response = await octokit.graphql(GET_DISCUSSION_CATEGORIES, {
      owner: config.github.owner,
      name: config.github.repo,
    });

    const categories = (response as any).repository.discussionCategories.nodes;

    console.log('\nAvailable Discussion Categories:');
    console.log('================================');
    categories.forEach((category: any) => {
      console.log(`Name: ${category.name}`);
      console.log(`ID: ${category.id}`);
      console.log(`Description: ${category.description || 'No description'}`);
      console.log(`Emoji: ${category.emoji || 'No emoji'}`);
      console.log('--------------------------------');
    });
  } catch (error) {
    console.error('Error fetching discussion categories:', error);
  }
}

main();
