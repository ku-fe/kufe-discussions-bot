import { SupabaseClient } from './SupabaseClient.js';

export class MappingService {
  private static instance: MappingService;
  private readonly supabase: SupabaseClient;

  private constructor() {
    this.supabase = SupabaseClient.getInstance();
  }

  public static getInstance(): MappingService {
    if (!MappingService.instance) {
      MappingService.instance = new MappingService();
    }
    return MappingService.instance;
  }

  public async addMapping(
    threadId: string,
    discussionId: string,
    url: string,
  ): Promise<void> {
    await this.supabase.createMapping(threadId, discussionId, url, {
      last_synced: new Date().toISOString(),
    });
  }

  public async getDiscussionId(threadId: string): Promise<string | undefined> {
    const mapping = await this.supabase.getMappingByThreadId(threadId);
    return mapping?.discussion_id;
  }

  public async getUrl(threadId: string): Promise<string | undefined> {
    const mapping = await this.supabase.getMappingByThreadId(threadId);
    return mapping?.discussion_url;
  }

  public async updateLastSynced(threadId: string): Promise<void> {
    await this.supabase.updateMapping(threadId, {
      metadata: {
        last_synced: new Date().toISOString(),
      },
    });
  }
}
