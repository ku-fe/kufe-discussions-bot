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
        await createDiscussionFromPost({
          title: thread.name,
          body: initialMessage.content,
          authorName: initialMessage.author.username,
          threadId: thread.id
        });
      }
    } catch (error) {
      console.error('Error handling forum post creation:', error);
    }
  });

  // Log in to Discord with the token
  client.login(process.env.DISCORD_TOKEN);
} 