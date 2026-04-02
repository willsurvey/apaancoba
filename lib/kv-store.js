import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.KV_REST_API_URL,
  token: process.env.KV_REST_API_TOKEN,
});

export async function addUser(chatId) {
  const users = await getUsers();
  if (!users.includes(String(chatId))) {
    users.push(String(chatId));
    await redis.set('telegram_users', users);
  }
  return users;
}

export async function getUsers() {
  const users = await redis.get('telegram_users');
  return users || [];
}

export async function addGroup(chatId) {
  const groups = await getGroups();
  if (!groups.includes(String(chatId))) {
    groups.push(String(chatId));
    await redis.set('telegram_groups', groups);
  }
  return groups;
}

export async function getGroups() {
  const groups = await redis.get('telegram_groups');
  return groups || [];
}