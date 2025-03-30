import { ChannelType, Client, DMChannel, ForumChannel, NewsChannel, TextChannel, ThreadChannel } from 'discord.js';
import { Express } from 'express';
import { getDiscordThreadId } from '../store/threadStore.js';
import {
    GitHubComment,
    GitHubDiscussion,
    GitHubDiscussionCommentEvent,
    GitHubDiscussionEvent
} from '../types/github.js';

// Client reference - will be set via setDiscordClient
let discordClient: Client | null = null;

/**
 * Set Discord client reference for use in webhooks
 */
export function setDiscordClient(client: Client): void {
  discordClient = client;
}

/**
 * Set up GitHub webhook routes
 */
export function setupGithubWebhooks(app: Express): void {
  // Handle discussion created event
  app.post('/webhooks/github', async (req, res) => {
    try {
      const event = req.headers['x-github-event'] as string;
      const payload = req.body;
      
      console.log(`Received GitHub webhook event: ${event}, action: ${payload.action}`);
      
      // Check if this is a discussion event
      if (event === 'discussion') {
        const discussionPayload = payload as GitHubDiscussionEvent;
        
        // Handle discussion created event
        if (discussionPayload.action === 'created') {
          await handleDiscussionCreated(discussionPayload.discussion);
        }
        // Handle other discussion events as needed
        else if (discussionPayload.action === 'edited') {
          await handleDiscussionEdited(discussionPayload.discussion);
        }
      }
      // Handle discussion comment events
      else if (event === 'discussion_comment') {
        const commentPayload = payload as GitHubDiscussionCommentEvent;
        if (commentPayload.action === 'created') {
          await handleDiscussionCommentCreated(commentPayload.discussion, commentPayload.comment);
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
async function handleDiscussionCreated(discussion: GitHubDiscussion): Promise<void> {
  try {
    console.log(`New GitHub discussion created: ${discussion.title}`);
    
    if (!discordClient) {
      console.error('Discord client not available');
      return;
    }
    
    // Get forum channel ID from environment
    const forumChannelId = process.env.DISCORD_FORUM_CHANNEL_ID;
    if (!forumChannelId) {
      console.error('Discord forum channel ID not set in environment variables');
      return;
    }
    
    // 중복 생성 방지: 이미 해당 GitHub discussion ID에 대한 Discord thread 매핑이 있는지 확인
    const { getDiscordThreadId } = await import('../store/threadStore.js');
    const existingThreadId = await getDiscordThreadId(discussion.node_id);
    if (existingThreadId) {
      console.log(`Skipping GitHub discussion ${discussion.node_id} - Discord thread already exists: ${existingThreadId}`);
      return;
    }
    
    // Get the forum channel
    const forumChannel = await discordClient.channels.fetch(forumChannelId);
    if (!forumChannel || forumChannel.type !== ChannelType.GuildForum) {
      console.error(`Forum channel with ID ${forumChannelId} not found or is not a forum channel`);
      return;
    }
    
    // Create new thread in forum
    const thread = await (forumChannel as ForumChannel).threads.create({
      name: discussion.title,
      message: {
        content: `**${discussion.user.login}**:\n\n${discussion.body}\n\n[View on GitHub](${discussion.html_url})`
      }
    });
    
    console.log(`Created Discord thread ${thread.id} for GitHub discussion ${discussion.id}`);
    
    // Store mapping between GitHub discussion ID and Discord thread ID
    const { storeMapping } = await import('../store/threadStore.js');
    storeMapping(thread.id, discussion.node_id, discussion.html_url);
    
  } catch (error) {
    console.error('Error handling discussion created:', error);
    throw error;
  }
}

/**
 * Handle discussion edited event
 */
async function handleDiscussionEdited(discussion: GitHubDiscussion): Promise<void> {
  // Optional: Implement if you want to sync edits
  console.log(`GitHub discussion edited: ${discussion.title}`);
}

/**
 * Handle discussion comment created event
 */
async function handleDiscussionCommentCreated(discussion: GitHubDiscussion, comment: GitHubComment): Promise<void> {
  try {
    console.log(`New comment on GitHub discussion: ${discussion.title}`);
    
    if (!discordClient) {
      console.error('Discord client not available');
      return;
    }
    
    // Get Discord thread ID for this discussion
    const discordThreadId = await getDiscordThreadId(discussion.node_id);
    
    if (!discordThreadId) {
      console.log(`No Discord thread mapping found for GitHub discussion ${discussion.node_id}`);
      return;
    }
    
    // Get the Discord thread
    try {
      const thread = await discordClient.channels.fetch(discordThreadId);
      
      if (!thread) {
        console.error(`Thread with ID ${discordThreadId} not found`);
        return;
      }
      
      // Check if it's a channel type that supports sending messages
      if (thread instanceof TextChannel || 
          thread instanceof ThreadChannel || 
          thread instanceof DMChannel || 
          thread instanceof NewsChannel) {
        // Send the comment to Discord
        await thread.send(`**${comment.user.login}**:\n\n${comment.body}\n\n[View on GitHub](${comment.html_url})`);
        console.log(`Comment synced to Discord thread ${discordThreadId}`);
      } else {
        console.error(`Channel with ID ${discordThreadId} is not a sendable channel type`);
      }
    } catch (error) {
      console.error(`Error fetching Discord thread ${discordThreadId}:`, error);
    }
  } catch (error) {
    console.error('Error handling discussion comment created:', error);
    throw error;
  }
} 