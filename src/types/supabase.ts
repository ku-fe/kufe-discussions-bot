export interface ThreadDiscussion {
  id: string;
  thread_id: string;
  discussion_id: string;
  discussion_url: string;
  created_at: string;
  updated_at: string;
  metadata: {
    thread_name?: string;
    discussion_title?: string;
    last_synced?: string;
  };
}

export type Database = {
  public: {
    Tables: {
      thread_discussions: {
        Row: ThreadDiscussion;
        Insert: Omit<ThreadDiscussion, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<ThreadDiscussion, 'id'>>;
      };
    };
  };
};
