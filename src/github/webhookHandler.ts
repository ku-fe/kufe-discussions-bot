import crypto from 'crypto';
import { Request, Response } from 'express';
import { config } from '../config/env.js';
import { ForumHandler } from '../discord/forumHandler.js';
import { MappingService } from '../services/MappingService.js';

interface WebhookPayload {
  action: string;
  discussion: {
    id: string;
    title: string;
    body: string;
    html_url: string;
    number: number;
  };
  comment?: {
    id: string;
    body: string;
    html_url: string;
  };
}

export class WebhookHandler {
  private static instance: WebhookHandler;
  private readonly mappingService: MappingService;
  private readonly forumHandler: ForumHandler;

  private constructor(forumHandler: ForumHandler) {
    this.mappingService = MappingService.getInstance();
    this.forumHandler = forumHandler;
  }

  public static getInstance(forumHandler: ForumHandler): WebhookHandler {
    if (!WebhookHandler.instance) {
      WebhookHandler.instance = new WebhookHandler(forumHandler);
    }
    return WebhookHandler.instance;
  }

  private verifySignature(req: Request): boolean {
    const signature = req.headers['x-hub-signature-256'];
    if (!signature || typeof signature !== 'string') {
      console.error('Missing signature');
      return false;
    }

    const hmac = crypto.createHmac('sha256', config.github.webhookSecret);
    const digest =
      'sha256=' + hmac.update(JSON.stringify(req.body)).digest('hex');

    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(digest));
  }

  public async handleWebhook(req: Request, res: Response): Promise<void> {
    try {
      // 시그니처 검증
      if (!this.verifySignature(req)) {
        res.status(401).json({ error: 'Invalid signature' });
        return;
      }

      const payload = req.body as WebhookPayload;
      console.log('Received webhook:', {
        action: payload.action,
        discussionId: payload.discussion.id,
        commentId: payload.comment?.id,
      });

      switch (payload.action) {
        case 'created':
          await this.handleDiscussionCreated(payload);
          break;
        case 'edited':
          await this.handleDiscussionEdited(payload);
          break;
        case 'deleted':
          await this.handleDiscussionDeleted(payload);
          break;
        case 'comment_created':
          await this.handleCommentCreated(payload);
          break;
        default:
          console.log('Unhandled action:', payload.action);
      }

      res.status(200).json({ message: 'Webhook processed successfully' });
    } catch (error) {
      console.error('Error processing webhook:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  private async handleDiscussionCreated(
    payload: WebhookPayload,
  ): Promise<void> {
    // TODO: Discord 포럼에 스레드 생성
    console.log('Discussion created:', payload.discussion.title);
  }

  private async handleDiscussionEdited(payload: WebhookPayload): Promise<void> {
    // TODO: Discord 스레드 제목/내용 수정
    console.log('Discussion edited:', payload.discussion.title);
  }

  private async handleDiscussionDeleted(
    payload: WebhookPayload,
  ): Promise<void> {
    // TODO: Discord 스레드 삭제 또는 보관
    console.log('Discussion deleted:', payload.discussion.id);
  }

  private async handleCommentCreated(payload: WebhookPayload): Promise<void> {
    // TODO: Discord 스레드에 메시지 추가
    if (!payload.comment) return;
    console.log('Comment created:', payload.comment.body);
  }
}
