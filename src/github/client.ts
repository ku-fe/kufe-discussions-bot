import { Octokit } from '@octokit/rest';
import { config } from '../config/env.js';

// GitHub API 클라이언트 인스턴스 생성
export const octokit: Octokit = new Octokit({
  auth: config.github.token,
});

// 레포지토리 ID를 가져오는 쿼리
const GET_REPOSITORY_ID = `
  query GetRepositoryId($owner: String!, $name: String!) {
    repository(owner: $owner, name: $name) {
      id
    }
  }
`;

// GitHub GraphQL API를 위한 mutation 쿼리
export const CREATE_DISCUSSION_MUTATION = `
  mutation CreateDiscussion($repositoryId: ID!, $categoryId: ID!, $title: String!, $body: String!) {
    createDiscussion(input: {
      repositoryId: $repositoryId
      categoryId: $categoryId
      title: $title
      body: $body
    }) {
      discussion {
        id
        url
      }
    }
  }
`;

// 레포지토리 ID 캐시
let repositoryId: string | null = null;

// 레포지토리 ID를 가져오는 함수
export async function getRepositoryId(): Promise<string> {
  if (repositoryId) return repositoryId;

  const response = await octokit.graphql(GET_REPOSITORY_ID, {
    owner: config.github.owner,
    name: config.github.repo,
  });

  repositoryId = (response as any).repository.id;
  return repositoryId as string;
}

// GitHub API 클라이언트 초기화 및 테스트
export async function initializeGitHubClient(): Promise<void> {
  try {
    // API 연결 테스트
    const { data } = await octokit.rest.users.getAuthenticated();
    console.log('GitHub client initialized successfully as:', data.login);

    // 레포지토리 ID 미리 가져오기
    const repoId = await getRepositoryId();
    console.log('Successfully connected to repository:', repoId);
  } catch (error) {
    console.error('Failed to initialize GitHub client:', error);
    throw error;
  }
}
