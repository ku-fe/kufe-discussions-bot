# KUFE Discussions Bot

Discord와 GitHub Discussions를 연동하는 봇입니다.

## 기능

- 디스코드 포럼 채널에서 포스트를 생성하면 GitHub Discussion에 자동으로 등록
- 디스코드 포럼 포스트에 댓글을 남기면 GitHub Discussion에 자동으로 댓글 등록
- GitHub Discussion에 새 discussion이 생성되면 디스코드 포럼 채널에 자동으로 스레드 생성
- GitHub Discussion에 새 댓글이 달리면 디스코드 포럼 스레드에 자동으로 댓글 등록

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
5. 다음 이벤트를 선택:
   - Discussions (모든 discussion 이벤트)
   - Discussion comments (discussion 댓글 이벤트)
6. Secret을 설정하고 .env 파일에 GITHUB_WEBHOOK_SECRET로 동일한 값 입력
7. 웹훅 추가

## 양방향 동기화 테스트

### Discord -> GitHub 테스트

1. 디스코드 포럼 채널에 새 포스트 생성
2. 포스트에 메시지 작성
3. GitHub Discussions에서 포스트가 생성되었는지 확인

### GitHub -> Discord 테스트

1. GitHub Discussions에 새 discussion 생성
2. 디스코드 포럼 채널에 새 스레드가 생성되었는지 확인
3. GitHub Discussion에 댓글 작성
4. 디스코드 스레드에 댓글이 동기화되었는지 확인

### 로컬 테스트 방법

로컬 환경에서 GitHub 웹훅을 테스트하려면 ngrok 등의 터널링 서비스를 사용할 수 있습니다:

1. ngrok 설치 및 실행:
   ```bash
   ngrok http 3000
   ```

2. 제공된 공개 URL을 GitHub 웹훅 URL로 설정
   (예: `https://a1b2c3d4.ngrok.io/webhooks/github`)

3. 웹훅 테스트를 위해 GitHub Discussion에 새 포스트 생성 또는 댓글 작성

## 라이센스

ISC 