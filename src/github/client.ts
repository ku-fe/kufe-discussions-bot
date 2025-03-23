import { Octokit } from '@octokit/rest';
import { config } from '../config/env.js';
import {
  GitHubCommentResponse,
  GitHubDiscussionResponse,
  GitHubRepositoryResponse,
} from '../types/github.js';

interface DiscussionCategory {
  id: string;
  name: string;
  description: string | null;
  emoji: string | null;
}

interface GitHubDiscussionCategoriesResponse {
  repository: {
    discussionCategories: {
      nodes: DiscussionCategory[];
    };
  };
}

export class GitHubClient {
  private static instance: GitHubClient;
  private octokit: Octokit;
  private repositoryId: string | null = null;

  private constructor() {
    this.octokit = new Octokit({
      auth: config.github.token,
    });
  }

  public static getInstance(): GitHubClient {
    if (!GitHubClient.instance) {
      GitHubClient.instance = new GitHubClient();
    }
    return GitHubClient.instance;
  }

  private async getRepositoryId(): Promise<string> {
    if (this.repositoryId) return this.repositoryId;

    const response = await this.octokit.graphql<GitHubRepositoryResponse>(
      `
      query GetRepositoryId($owner: String!, $name: String!) {
        repository(owner: $owner, name: $name) {
          id
        }
      }
    `,
      {
        owner: config.github.owner,
        name: config.github.repo,
      },
    );

    this.repositoryId = response.repository.id;
    return this.repositoryId;
  }

  public async createDiscussion(
    title: string,
    body: string,
  ): Promise<{ id: string; url: string }> {
    const repositoryId = await this.getRepositoryId();

    const response = await this.octokit.graphql<GitHubDiscussionResponse>(
      `
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
    `,
      {
        repositoryId,
        categoryId: config.github.discussionCategoryId,
        title,
        body,
      },
    );

    return response.createDiscussion.discussion;
  }

  public async addComment(
    discussionId: string,
    body: string,
  ): Promise<{ id: string; url: string }> {
    const response = await this.octokit.graphql<GitHubCommentResponse>(
      `
      mutation AddDiscussionComment($discussionId: ID!, $body: String!) {
        addDiscussionComment(input: {
          discussionId: $discussionId
          body: $body
        }) {
          comment {
            id
            url
          }
        }
      }
    `,
      {
        discussionId,
        body,
      },
    );

    return response.addDiscussionComment.comment;
  }

  public async initialize(): Promise<void> {
    try {
      const { data } = await this.octokit.rest.users.getAuthenticated();
      console.log('GitHub client initialized successfully as:', data.login);

      const repoId = await this.getRepositoryId();
      console.log('Successfully connected to repository:', repoId);
    } catch (error) {
      console.error('Failed to initialize GitHub client:', error);
      throw error;
    }
  }

  public async getDiscussionCategories(): Promise<DiscussionCategory[]> {
    const response =
      await this.octokit.graphql<GitHubDiscussionCategoriesResponse>(
        `
      query GetDiscussionCategories($owner: String!, $name: String!) {
        repository(owner: $owner, name: $name) {
          discussionCategories(first: 10) {
            nodes {
              id
              name
              description
              emoji
            }
          }
        }
      }
    `,
        {
          owner: config.github.owner,
          name: config.github.repo,
        },
      );

    return response.repository.discussionCategories.nodes;
  }
}
