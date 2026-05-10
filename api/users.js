import { getUsersDetails, getGroupsDetails, saveUsers, saveGroups } from '../lib/kv-store.js';

export async function GET() {
  try {
    const users = await getUsersDetails();
    const groups = await getGroupsDetails();
    return new Response(JSON.stringify({ users, groups }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { 
      status: 500, 
      headers: { 'Content-Type': 'application/json' } 
    });
  }
}

export async function POST(req) {
  try {
    const body = await req.json();
    const { action, id, type } = body; // action: 'block' or 'unblock', type: 'user' or 'group'
    
    if (type === 'user') {
      const users = await getUsersDetails();
      const user = users.find(u => String(u.id) === String(id));
      if (user) {
        user.blocked = action === 'block';
        await saveUsers(users);
      }
    } else if (type === 'group') {
      const groups = await getGroupsDetails();
      const group = groups.find(g => String(g.id) === String(id));
      if (group) {
        group.blocked = action === 'block';
        await saveGroups(groups);
      }
    }
    
    return new Response(JSON.stringify({ success: true }), { 
      status: 200, 
      headers: { 'Content-Type': 'application/json' } 
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { 
      status: 500, 
      headers: { 'Content-Type': 'application/json' } 
    });
  }
}
