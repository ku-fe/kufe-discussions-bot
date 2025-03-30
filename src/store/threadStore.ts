/**
 * A simple in-memory store for mapping Discord thread IDs to GitHub discussion IDs
 */

interface ThreadMapping {
  discordThreadId: string;
  githubDiscussionId: string;
  githubDiscussionUrl: string;
}

// In-memory store - in a production environment, this would be a database
const threadMappings: Map<string, ThreadMapping> = new Map();

/**
 * Store mapping between Discord thread ID and GitHub discussion ID
 */
export function storeMapping(discordThreadId: string, githubDiscussionId: string, githubDiscussionUrl: string): void {
  threadMappings.set(discordThreadId, {
    discordThreadId,
    githubDiscussionId,
    githubDiscussionUrl
  });
  console.log(`Stored mapping: Discord thread ${discordThreadId} -> GitHub discussion ${githubDiscussionId}`);
}

/**
 * Get GitHub discussion ID by Discord thread ID
 */
export function getGithubDiscussionId(discordThreadId: string): string | null {
  const mapping = threadMappings.get(discordThreadId);
  return mapping ? mapping.githubDiscussionId : null;
}

/**
 * Get GitHub discussion URL by Discord thread ID
 */
export function getGithubDiscussionUrl(discordThreadId: string): string | null {
  const mapping = threadMappings.get(discordThreadId);
  return mapping ? mapping.githubDiscussionUrl : null;
}

/**
 * Get Discord thread ID by GitHub discussion ID
 */
export function getDiscordThreadId(githubDiscussionId: string): string | null {
  for (const [_, mapping] of threadMappings.entries()) {
    if (mapping.githubDiscussionId === githubDiscussionId) {
      return mapping.discordThreadId;
    }
  }
  return null;
}

/**
 * List all mappings (for debugging)
 */
export function listAllMappings(): ThreadMapping[] {
  return Array.from(threadMappings.values());
} 