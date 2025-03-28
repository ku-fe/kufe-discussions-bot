import express, { Router } from 'express';
import { ForumHandler } from '../discord/forumHandler';
import { WebhookHandler } from '../github/webhookHandler';

export const router: Router = express.Router();

export function setupWebhookRoutes(forumHandler: ForumHandler): Router {
  const webhookHandler = WebhookHandler.getInstance(forumHandler);

  router.post('/github', express.json(), async (req, res) => {
    await webhookHandler.handleWebhook(req, res);
  });

  return router;
}
