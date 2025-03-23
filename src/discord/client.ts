import { Client, Events, GatewayIntentBits } from 'discord.js';
import { config } from '../config/env.js';

// Discord 클라이언트 인스턴스 생성
export const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildModeration,
  ],
});

// 클라이언트가 준비되었을 때의 이벤트 핸들러
client.once(Events.ClientReady, (c) => {
  console.log(`Ready! Logged in as ${c.user.tag}`);
});

// 에러 핸들링
client.on(Events.Error, (error) => {
  console.error('Discord client error:', error);
});

// Discord 클라이언트 로그인
export async function initializeDiscordClient(): Promise<void> {
  try {
    await client.login(config.discord.token);
  } catch (error) {
    console.error('Failed to initialize Discord client:', error);
    throw error;
  }
}
