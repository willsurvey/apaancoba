import { Bot } from 'grammy';
import { fetchScreeningData } from '../lib/api-fetcher.js';
import { formatBidikanMessages, formatErrorMessage } from '../lib/message-mapper.js';
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

// ── /start ─────────────────────────────────────────────────────────────────
bot.command('start', async (ctx) => {
  const chatId  = ctx.chat.id;
  const isGroup = ctx.chat.type === 'group' || ctx.chat.type === 'supergroup';

  try {
    isGroup ? await addGroup(chatId) : await addUser(chatId);
  } catch (e) {
    console.error('Register error:', e);
  }

  const target = isGroup
    ? `Grup <b>${ctx.chat.title}</b>`
    : `<b>${ctx.from?.first_name || 'Anda'}</b>`;

  await ctx.reply(
    `👋 Halo, ${target}!\n\n` +
    `✅ Berhasil terdaftar untuk menerima <b>Bidikan Saham Harian</b>.\n\n` +
    `📌 ID: <code>${chatId}</code>\n\n` +
    `📢 Anda akan mendapat notifikasi otomatis setiap hari.\n` +
    `📊 Gunakan /bidikan untuk cek sinyal sekarang.`,
    { parse_mode: 'HTML' }
  );
});

// ── /bidikan ───────────────────────────────────────────────────────────────
bot.command('bidikan', async (ctx) => {
  const loading = await ctx.reply('⏳ <i>Mengambil data screening...</i>', { parse_mode: 'HTML' });

  try {
    const result = await fetchScreeningData();

    try { await ctx.api.deleteMessage(ctx.chat.id, loading.message_id); } catch (_) {}

    if (!result.success) {
      await ctx.reply(formatErrorMessage(), { parse_mode: 'HTML' });
      return;
    }

    const messages = formatBidikanMessages(result.data);
    for (const msg of messages) {
      await ctx.reply(msg, { parse_mode: 'HTML' });
      await sleep(400);
    }

  } catch (error) {
    console.error('/bidikan error:', error);
    try { await ctx.api.deleteMessage(ctx.chat.id, loading.message_id); } catch (_) {}
    await ctx.reply(formatErrorMessage(), { parse_mode: 'HTML' });
  }
});

// ── /help ──────────────────────────────────────────────────────────────────
bot.command('help', async (ctx) => {
  await ctx.reply(
    `📖 <b>Panduan Bot Saham</b>\n\n` +
    `<b>Perintah tersedia:</b>\n` +
    `/start    — Daftar &amp; aktifkan notifikasi\n` +
    `/bidikan  — Lihat sinyal saham hari ini\n` +
    `/help     — Tampilkan panduan ini\n\n` +
    `📢 <b>Notifikasi otomatis</b> akan dikirim setiap hari.\n\n` +
    `⚠️ <i>Bukan ajakan beli/jual. DYOR.</i>`,
    { parse_mode: 'HTML' }
  );
});

// ── Pesan biasa (auto-register) ────────────────────────────────────────────
bot.on('message', async (ctx) => {
  const chatId  = ctx.chat.id;
  const isGroup = ctx.chat.type === 'group' || ctx.chat.type === 'supergroup';
  if (ctx.message.text?.startsWith('/')) return;

  try {
    if (isGroup) {
      await addGroup(chatId);
    } else {
      await addUser(chatId);
      await ctx.reply(
        `✅ Anda terdaftar!\n\n` +
        `Ketik /bidikan untuk melihat sinyal saham hari ini.\n` +
        `ID Anda: <code>${chatId}</code>`,
        { parse_mode: 'HTML' }
      );
    }
  } catch (error) {
    console.error('Message handler error:', error);
  }
});

// ── Vercel Serverless Handler ──────────────────────────────────────────────
export async function POST(req) {
  try {
    const body = await req.json();
    await bot.handleUpdate(body);
    return new Response('OK', { status: 200 });
  } catch (error) {
    console.error('Webhook error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

export async function GET() {
  return new Response(
    JSON.stringify({ status: 'Bot is running! 🤖', tokenSet: !!process.env.BOT_TOKEN }),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  );
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}