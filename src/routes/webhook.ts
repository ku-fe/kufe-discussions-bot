import express from 'express';
import { ForumHandler } from '../discord/forumHandler.js';
import { WebhookHandler } from '../github/webhookHandler.js';

export const router = express.Router();

export function setupWebhookRoutes(forumHandler: ForumHandler): express.Router {
  const webhookHandler = WebhookHandler.getInstance(forumHandler);

  router.post('/github', express.json(), async (req, res) => {
    await webhookHandler.handleWebhook(req, res);
  });

  return router;
}
