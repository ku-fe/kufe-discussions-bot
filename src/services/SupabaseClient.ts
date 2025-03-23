import { createClient } from '@supabase/supabase-js';
import { config } from '../config/env';
import { Database, ThreadDiscussion } from '../types/supabase';

export class SupabaseClient {
  private static instance: SupabaseClient;
  private client;

  private constructor() {
    this.client = createClient<Database>(
      config.supabase.url,
      config.supabase.key,
    );
  }

  public static getInstance(): SupabaseClient {
    if (!SupabaseClient.instance) {
      SupabaseClient.instance = new SupabaseClient();
    }
    return SupabaseClient.instance;
  }

  public async createMapping(
    threadId: string,
    discussionId: string,
    discussionUrl: string,
    metadata: ThreadDiscussion['metadata'] = {},
  ): Promise<ThreadDiscussion | null> {
    const { data, error } = await this.client
      .from('thread_discussions')
      .insert({
        thread_id: threadId,
        discussion_id: discussionId,
        discussion_url: discussionUrl,
        metadata,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating mapping:', error);
      return null;
    }

    return data;
  }

  public async getMappingByThreadId(
    threadId: string,
  ): Promise<ThreadDiscussion | null> {
    const { data, error } = await this.client
      .from('thread_discussions')
      .select()
      .eq('thread_id', threadId)
      .single();

    if (error) {
      console.error('Error getting mapping by thread ID:', error);
      return null;
    }

    return data;
  }

  public async getMappingByDiscussionId(
    discussionId: string,
  ): Promise<ThreadDiscussion | null> {
    const { data, error } = await this.client
      .from('thread_discussions')
      .select()
      .eq('discussion_id', discussionId)
      .single();

    if (error) {
      console.error('Error getting mapping by discussion ID:', error);
      return null;
    }

    return data;
  }

  public async updateMapping(
    threadId: string,
    updates: Partial<Omit<ThreadDiscussion, 'id' | 'thread_id'>>,
  ): Promise<ThreadDiscussion | null> {
    const { data, error } = await this.client
      .from('thread_discussions')
      .update(updates)
      .eq('thread_id', threadId)
      .select()
      .single();

    if (error) {
      console.error('Error updating mapping:', error);
      return null;
    }

    return data;
  }

  public async initialize(): Promise<void> {
    try {
      const { error } = await this.client
        .from('thread_discussions')
        .select()
        .limit(1);

      if (error) {
        throw error;
      }

      console.log('Successfully connected to Supabase');
    } catch (error) {
      console.error('Failed to initialize Supabase client:', error);
      throw error;
    }
  }
}
