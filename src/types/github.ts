/**
 * Interface for GitHub webhook events
 */

export interface GitHubUser {
  login: string;
  id: number;
  avatar_url: string;
  html_url: string;
}

export interface GitHubDiscussion {
  id: number;
  node_id: string;
  title: string;
  body: string;
  html_url: string;
  user: GitHubUser;
  created_at: string;
  updated_at: string;
}

export interface GitHubComment {
  id: number;
  node_id: string;
  html_url: string;
  body: string;
  user: GitHubUser;
  created_at: string;
  updated_at: string;
}

export interface DiscussionCreatedEvent {
  action: 'created';
  discussion: GitHubDiscussion;
}

export interface DiscussionEditedEvent {
  action: 'edited';
  discussion: GitHubDiscussion;
  changes: {
    title?: { from: string };
    body?: { from: string };
  };
}

export interface CommentCreatedEvent {
  action: 'created';
  discussion: GitHubDiscussion;
  comment: GitHubComment;
}

export type GitHubDiscussionEvent = DiscussionCreatedEvent | DiscussionEditedEvent;
export type GitHubDiscussionCommentEvent = CommentCreatedEvent; 