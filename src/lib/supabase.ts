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
export type ThreadMapping = {
  id?: number;
  discord_thread_id: string;
  github_discussion_id: string;
  github_discussion_url: string;
  created_at?: string;
}

// Supabase 클라이언트 생성
export const supabase = createClient(supabaseUrl, supabaseKey);

// 데이터베이스 연결 테스트
export async function testSupabaseConnection(): Promise<boolean> {
  try {
    // 테이블 존재 여부 확인
    const { error: checkError } = await supabase.from('thread_mappings').select('count').limit(1);
    
    // 테이블이 존재하지 않는 경우 Supabase 대시보드에서 테이블을 생성하도록 안내
    if (checkError && checkError.code === '42P01') {
      console.error('thread_mappings 테이블이 존재하지 않습니다.');
      console.error('Supabase 대시보드에서 다음 구조로 테이블을 생성해주세요:');
      console.error(`
        테이블 이름: thread_mappings
        컬럼:
          - id: integer (primary key, auto-increment)
          - discord_thread_id: text (not null, unique)
          - github_discussion_id: text (not null, unique)
          - github_discussion_url: text (not null)
          - created_at: timestamptz (default: now())
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