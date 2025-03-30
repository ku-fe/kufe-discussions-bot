import { Express } from 'express';

/**
 * Set up GitHub webhook routes
 */
export function setupGithubWebhooks(app: Express): void {
  // Handle discussion created event
  app.post('/webhooks/github', async (req, res) => {
    try {
      const event = req.headers['x-github-event'];
      const payload = req.body;
      
      // Check if this is a discussion event
      if (event === 'discussion') {
        console.log(`Received GitHub discussion event: ${payload.action}`);
        
        // Handle discussion created event
        if (payload.action === 'created') {
          await handleDiscussionCreated(payload.discussion);
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
async function handleDiscussionCreated(discussion: any): Promise<void> {
  try {
    console.log(`New GitHub discussion created: ${discussion.title}`);
    
    // Here you would:
    // 1. Get the Discord client
    // 2. Find the appropriate Discord forum channel
    // 3. Create a new thread in that forum channel
    // 4. Store the mapping between GitHub discussion ID and Discord thread ID
    
    console.log('Discord thread would be created here');
    
  } catch (error) {
    console.error('Error handling discussion created:', error);
    throw error;
  }
} 