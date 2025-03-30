/**
 * A simple in-memory store for mapping Discord thread IDs to GitHub discussion IDs
 */

import { supabase, ThreadMapping } from '../lib/supabase.js';

// In-memory store - in a production environment, this would be a database
const threadMappings: Map<string, ThreadMapping> = new Map();

/**
 * Store mapping between Discord thread ID and GitHub discussion ID
 */
export async function storeMapping(
  discordThreadId: string,
  githubDiscussionId: string,
  githubDiscussionUrl: string,
): Promise<void> {
  try {
    // 매핑 저장 전에 로그 추가
    console.log(
      `Attempting to store mapping: Discord thread ${discordThreadId} -> GitHub discussion ${githubDiscussionId}`,
    );

    // 1. Discord 스레드 ID로 중복 매핑 확인
    const { data: existingByThread, error: threadError } = await supabase
      .from('thread_mappings')
      .select('*')
      .eq('discord_thread_id', discordThreadId)
      .maybeSingle();

    if (threadError && threadError.code !== 'PGRST116') {
      console.error('Error checking thread mapping:', threadError);
      throw threadError;
    }

    if (existingByThread) {
      console.log(
        `Mapping already exists for Discord thread: ${discordThreadId} -> GitHub discussion ${existingByThread.github_discussion_id}`,
      );

      // 만약 이미 존재하는 매핑이 다른 GitHub Discussion ID를 가리키고 있다면 로그 기록
      if (existingByThread.github_discussion_id !== githubDiscussionId) {
        console.warn(
          `WARNING: Thread ${discordThreadId} is already mapped to a different GitHub discussion: ${existingByThread.github_discussion_id}, but trying to map to ${githubDiscussionId}`,
        );
      }

      return;
    }

    // 2. GitHub 디스커션 ID로 중복 매핑 확인
    const { data: existingByDiscussion, error: discussionError } =
      await supabase
        .from('thread_mappings')
        .select('*')
        .eq('github_discussion_id', githubDiscussionId)
        .maybeSingle();

    if (discussionError && discussionError.code !== 'PGRST116') {
      console.error('Error checking discussion mapping:', discussionError);
      throw discussionError;
    }

    if (existingByDiscussion) {
      console.log(
        `Mapping already exists for GitHub discussion: ${githubDiscussionId} -> Discord thread ${existingByDiscussion.discord_thread_id}`,
      );

      // 만약 이미 존재하는 매핑이 다른 Discord Thread ID를 가리키고 있다면 로그 기록
      if (existingByDiscussion.discord_thread_id !== discordThreadId) {
        console.warn(
          `WARNING: GitHub discussion ${githubDiscussionId} is already mapped to a different Discord thread: ${existingByDiscussion.discord_thread_id}, but trying to map to ${discordThreadId}`,
        );
      }

      return;
    }

    // 새 매핑 추가
    const { error: insertError } = await supabase
      .from('thread_mappings')
      .insert({
        discord_thread_id: discordThreadId,
        github_discussion_id: githubDiscussionId,
        github_discussion_url: githubDiscussionUrl,
      });

    if (insertError) {
      console.error('Error storing mapping:', insertError);
      throw insertError;
    }

    console.log(
      `Successfully stored mapping: Discord thread ${discordThreadId} -> GitHub discussion ${githubDiscussionId}`,
    );
  } catch (error) {
    console.error('Failed to store mapping:', error);
    throw error;
  }
}

/**
 * Get GitHub discussion ID by Discord thread ID
 */
export async function getGithubDiscussionId(
  discordThreadId: string,
): Promise<string | null> {
  try {
    const { data, error } = await supabase
      .from('thread_mappings')
      .select('github_discussion_id')
      .eq('discord_thread_id', discordThreadId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // No record found (code PGRST116 from PostgREST)
        return null;
      }
      console.error('Error getting GitHub discussion ID:', error);
      throw error;
    }

    return data?.github_discussion_id || null;
  } catch (error) {
    console.error('Failed to get GitHub discussion ID:', error);
    return null;
  }
}

/**
 * Get GitHub discussion URL by Discord thread ID
 */
export async function getGithubDiscussionUrl(
  discordThreadId: string,
): Promise<string | null> {
  try {
    const { data, error } = await supabase
      .from('thread_mappings')
      .select('github_discussion_url')
      .eq('discord_thread_id', discordThreadId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      console.error('Error getting GitHub discussion URL:', error);
      throw error;
    }

    return data?.github_discussion_url || null;
  } catch (error) {
    console.error('Failed to get GitHub discussion URL:', error);
    return null;
  }
}

/**
 * Get Discord thread ID by GitHub discussion ID
 */
export async function getDiscordThreadId(
  githubDiscussionId: string,
): Promise<string | null> {
  try {
    const { data, error } = await supabase
      .from('thread_mappings')
      .select('discord_thread_id')
      .eq('github_discussion_id', githubDiscussionId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      console.error('Error getting Discord thread ID:', error);
      throw error;
    }

    return data?.discord_thread_id || null;
  } catch (error) {
    console.error('Failed to get Discord thread ID:', error);
    return null;
  }
}

/**
 * List all mappings (for debugging)
 */
export async function listAllMappings(): Promise<ThreadMapping[]> {
  try {
    const { data, error } = await supabase
      .from('thread_mappings')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error listing mappings:', error);
      throw error;
    }

    return data || [];
  } catch (error) {
    console.error('Failed to list mappings:', error);
    return [];
  }
}
