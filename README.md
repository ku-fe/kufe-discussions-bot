# KUFE Discussions Bot

Discord 포럼 채널의 포스트와 댓글을 Supabase에 저장하는 봇입니다.

## 기능

- 디스코드 포럼 채널에서 포스트를 생성하면 Supabase에 자동으로 저장
- 디스코드 포럼 포스트에 댓글을 남기면 Supabase에 자동으로 저장

## 기술 스택

- Node.js, TypeScript
- Express.js
- Discord.js (디스코드 봇)
- Supabase (데이터 저장)

## 설치 및 설정

1. 저장소 클론:

   ```bash
   git clone https://github.com/your-username/kufe-discussions-bot.git
   cd kufe-discussions-bot
   ```

2. 의존성 설치:

   ```bash
   npm install
   ```

3. 환경 변수 설정:
   `.env.example` 파일을 `.env`로 복사하고 필요한 값을 입력합니다:

   ```bash
   cp .env.example .env
   ```

4. 애플리케이션 빌드:

   ```bash
   npm run build
   ```

5. 애플리케이션 실행:
   ```bash
   npm start
   ```

## 개발 모드 실행

```bash
npm run dev
```

## Supabase 설정

1. Supabase 프로젝트 생성
2. `thread_mappings` 테이블 생성:
   ```sql
   create table thread_mappings (
     id integer primary key generated always as identity,
     discord_thread_id text not null unique,
     created_at timestamptz default now()
   );
   ```
3. 환경 변수에 Supabase URL과 API 키 설정

## 테스트

1. 디스코드 포럼 채널에 새 포스트 생성
2. 포스트에 메시지 작성
3. Supabase에서 데이터가 저장되었는지 확인

## 라이센스

ISC
