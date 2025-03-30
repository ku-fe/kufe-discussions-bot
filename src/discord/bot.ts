import { ChannelType, Client, Events, GatewayIntentBits } from 'discord.js';
import { addCommentToDiscussion, createDiscussionFromPost } from '../github/discussions.js';
import { setDiscordClient } from '../github/webhooks.js';
import { getGithubDiscussionId } from '../store/threadStore.js';

// Create a new client instance
const client = new Client({ 
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

export function setupDiscordBot(): void {
  // When the client is ready
  client.once(Events.ClientReady, (readyClient) => {
    console.log(`Discord bot logged in as ${readyClient.user.tag}`);
    
    // Set Discord client reference for webhook handler
    setDiscordClient(client);
  });

  // Handle forum post create events
  client.on(Events.ThreadCreate, async (thread) => {
    if (!thread.isThread() || thread.parent?.type !== ChannelType.GuildForum) return;
    
    try {
      console.log(`New forum post created: ${thread.name}`);
      
      // Get the initial message content
      const messages = await thread.messages.fetch({ limit: 1 });
      const initialMessage = messages.first();
      
      if (initialMessage) {
        // Create a GitHub discussion from this post
        const result = await createDiscussionFromPost({
          title: thread.name,
          body: initialMessage.content,
          authorName: initialMessage.author.username,
          threadId: thread.id
        });

        // Send a confirmation message to the Discord thread
        await thread.send(`✅ GitHub Discussion이 성공적으로 생성되었습니다: ${result.url}`);
      }
    } catch (error) {
      console.error('Error handling forum post creation:', error);
      
      // Send error notification
      try {
        await thread.send('❌ GitHub Discussion 생성 중 오류가 발생했습니다. 관리자에게 문의해주세요.');
      } catch (sendError) {
        console.error('Failed to send error message to Discord thread:', sendError);
      }
    }
  });

  // Handle new messages in forum threads
  client.on(Events.MessageCreate, async (message) => {
    // Ignore messages from bots to prevent feedback loops
    if (message.author.bot) return;
    
    // Check if the message is in a thread and the thread is in a forum channel
    if (!message.channel.isThread() || message.channel.parent?.type !== ChannelType.GuildForum) return;
    
    // Ignore the initial message (already handled by ThreadCreate event)
    if (message.id === message.channel.id) return;
    
    try {
      const threadId = message.channel.id;
      
      // Check if we have a mapping for this thread
      const discussionId = getGithubDiscussionId(threadId);
      
      if (discussionId) {
        console.log(`New message in thread ${threadId}, syncing to GitHub discussion ${discussionId}`);
        
        // Add the comment to the GitHub discussion
        const result = await addCommentToDiscussion(
          discussionId, 
          message.content, 
          message.author.username
        );
        
        // React to the message to indicate it was synced
        await message.react('✅');
        
        console.log(`Comment synced to GitHub: ${result.url}`);
      } else {
        console.log(`No GitHub discussion mapping found for thread ${threadId}`);
      }
    } catch (error) {
      console.error('Error handling new message in forum thread:', error);
      
      // React to the message to indicate error
      try {
        await message.react('❌');
      } catch (reactError) {
        console.error('Failed to add error reaction:', reactError);
      }
    }
  });

  // Log in to Discord with the token
  client.login(process.env.DISCORD_TOKEN);
} 