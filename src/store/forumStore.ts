import { ForumComment, ForumPost, supabase } from '../lib/supabase.js';

/**
 * Store a forum post
 */
export async function storePost(
  discordThreadId: string,
  title: string,
  content: string,
  authorId: string,
  authorName: string,
): Promise<void> {
  try {
    console.log(
      `Attempting to store forum post: ${title} (Thread ID: ${discordThreadId})`,
    );

    // Check for existing post
    const { data: existingPost, error: postError } = await supabase
      .from('forum_posts')
      .select('*')
      .eq('discord_thread_id', discordThreadId)
      .maybeSingle();

    if (postError && postError.code !== 'PGRST116') {
      console.error('Error checking post:', postError);
      throw postError;
    }

    if (existingPost) {
      console.log(`Post already exists for thread: ${discordThreadId}`);
      return;
    }

    // Add new post
    const { error: insertError } = await supabase.from('forum_posts').insert({
      discord_thread_id: discordThreadId,
      title,
      content,
      author_id: authorId,
      author_name: authorName,
    });

    if (insertError) {
      console.error('Error storing post:', insertError);
      throw insertError;
    }

    console.log(
      `Successfully stored post: ${title} (Thread ID: ${discordThreadId})`,
    );
  } catch (error) {
    console.error('Failed to store post:', error);
    throw error;
  }
}

/**
 * Store a forum comment
 */
export async function storeComment(
  discordMessageId: string,
  discordThreadId: string,
  content: string,
  authorId: string,
  authorName: string,
): Promise<void> {
  try {
    console.log(
      `Attempting to store comment: ${discordMessageId} (Thread ID: ${discordThreadId})`,
    );
    console.log(`Comment content: ${content}`);
    console.log(`Author: ${authorName} (${authorId})`);

    // Check for existing comment
    const { data: existingComment, error: commentError } = await supabase
      .from('forum_comments')
      .select('*')
      .eq('discord_message_id', discordMessageId)
      .maybeSingle();

    if (commentError && commentError.code !== 'PGRST116') {
      console.error('Error checking comment:', commentError);
      throw commentError;
    }

    if (existingComment) {
      console.log(`Comment already exists: ${discordMessageId}`);
      return;
    }

    // Add new comment
    const { error: insertError } = await supabase
      .from('forum_comments')
      .insert({
        discord_message_id: discordMessageId,
        discord_thread_id: discordThreadId,
        content,
        author_id: authorId,
        author_name: authorName,
      });

    if (insertError) {
      console.error('Error storing comment:', insertError);
      throw insertError;
    }

    console.log(
      `Successfully stored comment: ${discordMessageId} (Thread ID: ${discordThreadId})`,
    );
  } catch (error) {
    console.error('Failed to store comment:', error);
    throw error;
  }
}

/**
 * Check if post exists
 */
export async function postExists(discordThreadId: string): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('forum_posts')
      .select('discord_thread_id')
      .eq('discord_thread_id', discordThreadId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return false;
      }
      console.error('Error checking post:', error);
      throw error;
    }

    return !!data;
  } catch (error) {
    console.error('Failed to check post:', error);
    return false;
  }
}

/**
 * List all posts (for debugging)
 */
export async function listAllPosts(): Promise<ForumPost[]> {
  try {
    const { data, error } = await supabase
      .from('forum_posts')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error listing posts:', error);
      throw error;
    }

    return data || [];
  } catch (error) {
    console.error('Failed to list posts:', error);
    return [];
  }
}

/**
 * List all comments (for debugging)
 */
export async function listAllComments(): Promise<ForumComment[]> {
  try {
    const { data, error } = await supabase
      .from('forum_comments')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error listing comments:', error);
      throw error;
    }

    return data || [];
  } catch (error) {
    console.error('Failed to list comments:', error);
    return [];
  }
}
