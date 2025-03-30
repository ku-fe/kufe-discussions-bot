# KUFE Discussions Bot

Discord와 GitHub Discussions를 연동하는 봇입니다.

## 기능

- 디스코드 포럼 채널에서 포스트를 생성하면 GitHub Discussion에 자동으로 등록
- 디스코드 포럼 포스트에 댓글을 남기면 GitHub Discussion에 자동으로 댓글 등록
- GitHub Discussion에 새 discussion이 생성되면 디스코드 포럼 채널에 자동으로 스레드 생성

## 기술 스택

- Node.js, TypeScript
- Express.js (웹훅 처리)
- Discord.js (디스코드 봇)
- Octokit (GitHub API)

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

## GitHub Webhook 설정

1. GitHub 저장소 설정으로 이동
2. Webhooks 섹션에서 "Add webhook" 클릭
3. Payload URL에 `https://your-server.com/webhooks/github` 입력
4. Content type을 `application/json`으로 설정
5. "discussions" 이벤트 선택
6. 웹훅 추가

## 라이센스

ISC 