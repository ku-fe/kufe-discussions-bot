import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// 환경 변수 로드
dotenv.config();

// Supabase 클라이언트 생성
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Supabase credentials are not set in environment variables');
}

// 타입 정의
export type ForumPost = {
  id?: number;
  discord_thread_id: string;
  title: string;
  content: string;
  author_id: string;
  author_name: string;
  created_at?: string;
};

export type ForumComment = {
  id?: number;
  discord_message_id: string;
  discord_thread_id: string;
  content: string;
  author_id: string;
  author_name: string;
  created_at?: string;
};

// Supabase 클라이언트 생성
export const supabase = createClient(supabaseUrl, supabaseKey);

// 데이터베이스 연결 테스트
export async function testSupabaseConnection(): Promise<boolean> {
  try {
    // 테이블 존재 여부 확인
    const { error: checkError } = await supabase
      .from('forum_posts')
      .select('count')
      .limit(1);

    // 테이블이 존재하지 않는 경우 Supabase 대시보드에서 테이블을 생성하도록 안내
    if (checkError && checkError.code === '42P01') {
      console.error('forum_posts 테이블이 존재하지 않습니다.');
      console.error('Supabase 대시보드에서 다음 구조로 테이블을 생성해주세요:');
      console.error(`
        -- 포스트(스레드) 테이블
        create table forum_posts (
          id integer primary key generated always as identity,
          discord_thread_id text not null unique,
          title text not null,
          content text not null,
          author_id text not null,
          author_name text not null,
          created_at timestamptz default now()
        );

        -- 댓글 테이블
        create table forum_comments (
          id integer primary key generated always as identity,
          discord_message_id text not null unique,
          discord_thread_id text not null,
          content text not null,
          author_id text not null,
          author_name text not null,
          created_at timestamptz default now(),
          foreign key (discord_thread_id) references forum_posts(discord_thread_id)
        );
      `);
      return false;
    }

    if (checkError) {
      console.error('Supabase connection error:', checkError);
      return false;
    }

    console.log('Supabase connection successful');
    return true;
  } catch (error) {
    console.error('Failed to connect to Supabase:', error);
    return false;
  }
}
