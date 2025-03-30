/**
 * Test script for syncing Discord comments to GitHub
 * 
 * This is a manual test script to verify that the comment syncing functionality works correctly.
 * You can run this script with:
 * 
 * npx tsx src/test/syncComments.ts
 */

import dotenv from 'dotenv';
import { getGithubDiscussionId, storeMapping } from '../store/threadStore.js';

// Load environment variables
dotenv.config();

async function testSyncComments() {
  try {
    // Test data - replace with actual values for testing
    const testDiscordThreadId = 'test-discord-thread-123';
    const testGithubDiscussionId = 'test-github-discussion-123';
    const testGithubDiscussionUrl = 'https://github.com/owner/repo/discussions/123';
    
    // Store a test mapping
    console.log('Storing test mapping...');
    storeMapping(testDiscordThreadId, testGithubDiscussionId, testGithubDiscussionUrl);
    
    // Verify the mapping was stored
    const discussionId = await getGithubDiscussionId(testDiscordThreadId);
    console.log(`Retrieved GitHub discussion ID: ${discussionId}`);
    
    if (discussionId !== testGithubDiscussionId) {
      throw new Error('Mapping retrieval failed, expected ID does not match.');
    }
    
    // To test actual GitHub API calls, uncomment the following code and provide real IDs
    /*
    // This requires a real GitHub discussion ID and valid token
    const realDiscussionId = 'D_12345'; // Replace with a real GitHub discussion ID
    
    console.log('Adding test comment to GitHub discussion...');
    const result = await addCommentToDiscussion(
      realDiscussionId,
      'This is a test comment from the syncing test script.',
      'TestUser'
    );
    
    console.log(`Comment added successfully: ${result.url}`);
    */
    
    console.log('Test completed successfully.');
  } catch (error) {
    console.error('Test failed:');
    console.error(error);
  }
}

// Run the test
testSyncComments(); 