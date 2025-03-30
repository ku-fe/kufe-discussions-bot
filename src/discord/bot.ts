import { ChannelType, Client, Events, GatewayIntentBits } from 'discord.js';
import { createDiscussionFromPost } from '../github/discussions.js';

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

  // Log in to Discord with the token
  client.login(process.env.DISCORD_TOKEN);
} 