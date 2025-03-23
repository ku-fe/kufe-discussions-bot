import { GitHubClient } from './client';

const githubClient = GitHubClient.getInstance();

interface DiscussionCategory {
  id: string;
  name: string;
  description: string | null;
  emoji: string | null;
}

async function main() {
  try {
    const categories = await githubClient.getDiscussionCategories();

    console.log('\nAvailable Discussion Categories:');
    console.log('================================');
    categories.forEach((category: DiscussionCategory) => {
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
