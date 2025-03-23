// GitHub API 응답 타입
export interface GitHubDiscussionResponse {
  createDiscussion: {
    discussion: {
      id: string;
      url: string;
    };
  };
}

export interface GitHubCommentResponse {
  addDiscussionComment: {
    comment: {
      id: string;
      url: string;
    };
  };
}

export interface GitHubRepositoryResponse {
  repository: {
    id: string;
  };
}

// 매핑 저장소 인터페이스
export interface DiscussionMapping {
  threadId: string;
  discussionId: string;
  url: string;
}
