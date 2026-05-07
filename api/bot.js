import { Bot } from 'grammy';
import { fetchScreeningData } from '../lib/api-fetcher.js';
import {
  formatMarketOverview,
  formatIntradayMessage,
  formatAraMessage,
  formatBsjpMessage,
  formatBpjsMessage,
  formatSwingMessage,
  formatHelpMessage,
} from '../lib/message-mapper.js';
import { addUser, addGroup } from '../lib/kv-store.js';

const bot = new Bot(process.env.BOT_TOKEN, {
  botInfo: {
    id: 0,
    is_bot: true,
    first_name: 'Bot Saham',
    username: 'bcbywill_bot',
    can_join_groups: true,
    can_read_all_group_messages: false,
    supports_inline_queries: false,
  },
});

// ── Helpers ────────────────────────────────────────────────────────────────
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function handleStrategyCommand(ctx, formatterFn) {
  const loading = await ctx.reply('⏳ <i>Mengambil data screening...</i>', { parse_mode: 'HTML' });
  try {
    const result = await fetchScreeningData();
    try { await ctx.api.deleteMessage(ctx.chat.id, loading.message_id); } catch (_) {}
    
    if (!result.success) {
      await ctx.reply('⚠️ <b>GAGAL MENGAMBIL DATA</b>\nServer tidak merespons.', { parse_mode: 'HTML' });
      return;
    }
    
    const messages = formatterFn(result.data);
    for (const msg of messages) {
      await ctx.reply(msg, { parse_mode: 'HTML' });
      await sleep(400);
    }
  } catch (error) {
    console.error('Command error:', error);
    try { await ctx.api.deleteMessage(ctx.chat.id, loading.message_id); } catch (_) {}
    await ctx.reply('⚠️ Terjadi kesalahan sistem.', { parse_mode: 'HTML' });
  }
}

// ── Commands ───────────────────────────────────────────────────────────────
bot.command('start', async (ctx) => {
  const chatId  = ctx.chat.id;
  const isGroup = ctx.chat.type === 'group' || ctx.chat.type === 'supergroup';

  try {
    isGroup ? await addGroup(chatId) : await addUser(chatId);
  } catch (e) {
    console.error('Register error:', e);
  }

  const target = isGroup ? `Grup <b>${ctx.chat.title}</b>` : `<b>${ctx.from?.first_name || 'Anda'}</b>`;

  await ctx.reply(
    `🤖 <b>BC TRADER BOT</b> — Screening Otomatis Saham IHSG\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
    `Halo, ${target}! 👋\n✅ Terdaftar sebagai subscriber aktif.\n📌 ID: <code>${chatId}</code>\n\n` +
    `⚡ <b>5 PIPELINE AKTIF</b>\n🔵 /bidikan — Intraday SMC\n🔴 /ara — Calon ARA\n🟡 /bsjp — Beli Sore, Jual Pagi\n` +
    `🟠 /bpjs — Beli Pagi, Jual Sore\n🟢 /swing — VCP Stage 2\n\n` +
    `Ketik /help untuk panduan lengkap.`,
    { parse_mode: 'HTML' }
  );
});

bot.command('help', async (ctx) => {
  await ctx.reply(formatHelpMessage(), { parse_mode: 'HTML' });
});

bot.command('market', async (ctx) => {
  const loading = await ctx.reply('⏳ <i>Memuat market overview...</i>', { parse_mode: 'HTML' });
  try {
    const result = await fetchScreeningData();
    try { await ctx.api.deleteMessage(ctx.chat.id, loading.message_id); } catch (_) {}
    if (!result.success) {
      await ctx.reply('⚠️ Gagal mengambil data.', { parse_mode: 'HTML' });
      return;
    }
    await ctx.reply(formatMarketOverview(result.data), { parse_mode: 'HTML' });
  } catch (error) {
    console.error(error);
  }
});

bot.command('update', async (ctx) => {
  const loading = await ctx.reply('⏳ <i>Cek status...</i>', { parse_mode: 'HTML' });
  try {
    const result = await fetchScreeningData();
    try { await ctx.api.deleteMessage(ctx.chat.id, loading.message_id); } catch (_) {}
    if (!result.success || !result.data?.meta) {
      await ctx.reply('⚠️ Data tidak tersedia.', { parse_mode: 'HTML' });
      return;
    }
    const meta = result.data.meta;
    await ctx.reply(`🔄 <b>STATUS UPDATE SCREENER</b>\n📅 ${meta.date}\nUpdate terakhir: <b>${meta.generated_at}</b>\nMode: ✅ ${meta.mode}`, { parse_mode: 'HTML' });
  } catch (error) {
    console.error(error);
  }
});

bot.command('bidikan', (ctx) => handleStrategyCommand(ctx, formatIntradayMessage));
bot.command('ara', (ctx) => handleStrategyCommand(ctx, formatAraMessage));
bot.command('bsjp', (ctx) => handleStrategyCommand(ctx, formatBsjpMessage));
bot.command('bpjs', (ctx) => handleStrategyCommand(ctx, formatBpjsMessage));
bot.command('swing', (ctx) => handleStrategyCommand(ctx, formatSwingMessage));

// ── Auto-register on normal messages ───────────────────────────────────────
bot.on('message', async (ctx) => {
  const chatId  = ctx.chat.id;
  const isGroup = ctx.chat.type === 'group' || ctx.chat.type === 'supergroup';
  if (ctx.message.text?.startsWith('/')) return;

  try {
    if (isGroup) {
      await addGroup(chatId);
    } else {
      await addUser(chatId);
    }
  } catch (error) {
    console.error('Message handler error:', error);
  }
});

// ── Serverless Handlers ────────────────────────────────────────────────────
export async function POST(req) {
  try {
    const body = await req.json();
    await bot.handleUpdate(body);
    return new Response('OK', { status: 200 });
  } catch (error) {
    console.error('Webhook error:', error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}

export async function GET() {
  return new Response(JSON.stringify({ status: 'Bot is running! 🤖', tokenSet: !!process.env.BOT_TOKEN }), { status: 200, headers: { 'Content-Type': 'application/json' } });
}