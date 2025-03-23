import { Client, Events, GatewayIntentBits } from 'discord.js';
import { config } from '../config/env';

// Discord 클라이언트 인스턴스 생성
export const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildModeration,
    GatewayIntentBits.GuildMembers,
  ],
});

// 디버깅을 위한 추가 이벤트 핸들러
client.on('debug', (info) => {
  console.log('Debug:', info);
});

client.on('warn', (info) => {
  console.log('Warning:', info);
});

// 클라이언트가 준비되었을 때의 이벤트 핸들러
client.once(Events.ClientReady, (c) => {
  console.log(`Ready! Logged in as ${c.user.tag}`);
  console.log(
    'Available in servers:',
    c.guilds.cache.map((guild) => guild.name).join(', '),
  );
});

// 에러 핸들링
client.on(Events.Error, (error) => {
  console.error('Discord client error:', error);
});

// Discord 클라이언트 로그인
export async function initializeDiscordClient(): Promise<void> {
  try {
    console.log('Attempting to login to Discord...');
    await client.login(config.discord.token);
    console.log('Successfully logged in to Discord');
  } catch (error) {
    console.error('Failed to initialize Discord client:', error);
    throw error;
  }
}
