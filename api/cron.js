import { Bot } from 'grammy';
import { getUsers, getGroups } from '../lib/kv-store.js';
import { fetchScreeningData } from '../lib/api-fetcher.js';
import { formatBidikanMessages, formatErrorMessage } from '../lib/message-mapper.js';

const bot = new Bot(process.env.BOT_TOKEN);

export async function GET() {
  console.log('Cron job started:', new Date().toISOString());

  try {
    const result = await fetchScreeningData();

    if (!result.success) {
      console.error('API fetch failed:', result.error);
      await broadcast([formatErrorMessage()]);
      return new Response(
        JSON.stringify({ success: false, error: result.error }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const messages = formatBidikanMessages(result.data);
    console.log(`Formatted into ${messages.length} message(s)`);

    await broadcast(messages);

    console.log('Cron job completed.');
    return new Response(
      JSON.stringify({ success: true, messageCount: messages.length }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Cron job error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

async function broadcast(messages) {
  const users  = await getUsers();
  const groups = await getGroups();
  const chats  = [...users, ...groups];

  console.log(`Broadcasting to ${chats.length} chat(s)`);

  for (const chatId of chats) {
    try {
      for (const msg of messages) {
        await bot.api.sendMessage(chatId, msg, { parse_mode: 'Markdown' });
        await sleep(350);
      }
      console.log(`✅ Sent to ${chatId}`);
    } catch (err) {
      console.error(`❌ Failed to send to ${chatId}:`, err.message);
    }
  }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
