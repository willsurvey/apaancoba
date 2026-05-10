import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.KV_REST_API_URL,
  token: process.env.KV_REST_API_TOKEN,
});

export async function getUsersDetails() {
  const users = await redis.get('telegram_users');
  if (!users) return [];
  return users.map(u => typeof u === 'string' ? { id: u, username: '-', name: '-', blocked: false } : u);
}

export async function saveUsers(users) {
  await redis.set('telegram_users', users);
}

export async function addUser(ctxUser) {
  const users = await getUsersDetails();
  const existing = users.find(u => String(u.id) === String(ctxUser.id));
  
  if (!existing) {
    users.push({
      id: String(ctxUser.id),
      username: ctxUser.username || '-',
      name: ctxUser.first_name || '-',
      blocked: false
    });
    await saveUsers(users);
  } else {
    let changed = false;
    if (existing.username !== (ctxUser.username || '-') || existing.name !== (ctxUser.first_name || '-')) {
      existing.username = ctxUser.username || '-';
      existing.name = ctxUser.first_name || '-';
      changed = true;
    }
    if (typeof existing.blocked === 'undefined') {
      existing.blocked = false;
      changed = true;
    }
    if (changed) await saveUsers(users);
  }
}

export async function getActiveUserIds() {
  const users = await getUsersDetails();
  return users.filter(u => !u.blocked).map(u => String(u.id));
}

export async function getGroupsDetails() {
  const groups = await redis.get('telegram_groups');
  if (!groups) return [];
  return groups.map(g => typeof g === 'string' ? { id: g, title: '-', blocked: false } : g);
}

export async function saveGroups(groups) {
  await redis.set('telegram_groups', groups);
}

export async function addGroup(ctxGroup) {
  const groups = await getGroupsDetails();
  const existing = groups.find(g => String(g.id) === String(ctxGroup.id));
  
  if (!existing) {
    groups.push({
      id: String(ctxGroup.id),
      title: ctxGroup.title || '-',
      blocked: false
    });
    await saveGroups(groups);
  } else {
    let changed = false;
    if (existing.title !== (ctxGroup.title || '-')) {
      existing.title = ctxGroup.title || '-';
      changed = true;
    }
    if (typeof existing.blocked === 'undefined') {
      existing.blocked = false;
      changed = true;
    }
    if (changed) await saveGroups(groups);
  }
}

export async function getActiveGroupIds() {
  const groups = await getGroupsDetails();
  return groups.filter(g => !g.blocked).map(g => String(g.id));
}