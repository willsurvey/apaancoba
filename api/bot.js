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
  const chatId = ctx.chat.id;
  const isGroup = ctx.chat.type === 'group' || ctx.chat.type === 'supergroup';

  try {
    if (isGroup) {
      await addGroup(chatId);
    } else {
      await addUser(chatId);
    }
  } catch (e) {
    console.error('Register error:', e);
  }

  const target = isGroup ? `Grup *${ctx.chat.title}*` : `*${ctx.from?.first_name || 'Anda'}*`;
  await ctx.reply(
    `👋 Halo, ${target}!\n\n` +
    `✅ Berhasil terdaftar untuk menerima *Bidikan Saham Harian*.\n\n` +
    `📌 ID: \`${chatId}\`\n\n` +
    `📢 Anda akan mendapat notifikasi otomatis setiap hari.\n` +
    `📊 Gunakan /bidikan untuk cek sinyal sekarang.`,
    { parse_mode: 'Markdown' }
  );
});

// ── /bidikan ───────────────────────────────────────────────────────────────
bot.command('bidikan', async (ctx) => {
  const loading = await ctx.reply('⏳ _Mengambil data screening..._', { parse_mode: 'Markdown' });

  try {
    const result = await fetchScreeningData();

    // Hapus pesan loading
    try { await ctx.api.deleteMessage(ctx.chat.id, loading.message_id); } catch (_) {}

    if (!result.success) {
      await ctx.reply(formatErrorMessage(), { parse_mode: 'Markdown' });
      return;
    }

    const messages = formatBidikanMessages(result.data);

    for (const msg of messages) {
      await ctx.reply(msg, { parse_mode: 'Markdown' });
      await sleep(400);
    }

  } catch (error) {
    console.error('/bidikan error:', error);
    try { await ctx.api.deleteMessage(ctx.chat.id, loading.message_id); } catch (_) {}
    await ctx.reply(formatErrorMessage(), { parse_mode: 'Markdown' });
  }
});

// ── /help ──────────────────────────────────────────────────────────────────
bot.command('help', async (ctx) => {
  await ctx.reply(
    `📖 *Panduan Bot Saham*\n\n` +
    `*Perintah tersedia:*\n` +
    `/start    — Daftar & aktifkan notifikasi\n` +
    `/bidikan  — Lihat sinyal saham hari ini\n` +
    `/help     — Tampilkan panduan ini\n\n` +
    `📢 *Notifikasi otomatis* akan dikirim setiap hari.\n\n` +
    `⚠️ _Bukan ajakan beli/jual. DYOR._`,
    { parse_mode: 'Markdown' }
  );
});

// ── Pesan biasa (auto-register) ────────────────────────────────────────────
bot.on('message', async (ctx) => {
  const chatId   = ctx.chat.id;
  const isGroup  = ctx.chat.type === 'group' || ctx.chat.type === 'supergroup';
  const hasCmd   = ctx.message.text?.startsWith('/');
  if (hasCmd) return; // sudah ditangani command handler

  try {
    if (isGroup) {
      await addGroup(chatId);
    } else {
      await addUser(chatId);
      await ctx.reply(
        `✅ Anda terdaftar!\n\n` +
        `Ketik /bidikan untuk melihat sinyal saham hari ini.\n` +
        `ID Anda: \`${chatId}\``,
        { parse_mode: 'Markdown' }
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
