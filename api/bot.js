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
import { addUser, addGroup, getUsersDetails, getGroupsDetails, saveUsers, saveGroups } from '../lib/kv-store.js';

// HTML escape helper
function esc(val) {
  if (val == null) return '-';
  return String(val).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

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

// ── Middleware: Registered & Block Check ───────────────────────────────────
bot.use(async (ctx, next) => {
  const chatId = String(ctx.chat?.id);
  if (!chatId || chatId === 'undefined') return await next();

  const isGroup = ctx.chat?.type === 'group' || ctx.chat?.type === 'supergroup';
  const text = ctx.message?.text || '';
  const fromUser = ctx.from;

  // Wajib memiliki username untuk user pribadi
  if (!isGroup && !fromUser?.username) {
    if (text.startsWith('/')) {
      await ctx.reply('⚠️ <b>Akses Ditolak</b>\n\nAkun Telegram Anda tidak memiliki <b>Username</b>.\nSilakan buat Username terlebih dahulu di menu <b>Pengaturan Telegram</b>, lalu ketik /start kembali.', { parse_mode: 'HTML' });
    }
    return; // Hentikan proses, tidak bisa menggunakan bot
  }

  let isRegistered = false;
  let isBlocked = false;
  
  if (isGroup) {
    const groups = await getGroupsDetails();
    const group = groups.find(g => String(g.id) === chatId);
    if (group) {
      isRegistered = true;
      isBlocked = group.blocked;
      
      // Auto-update judul grup jika berubah
      if (group.title !== (ctx.chat?.title || '-')) {
        addGroup(ctx.chat).catch(e => console.error('Auto-update group error:', e));
      }
    }
  } else {
    const users = await getUsersDetails();
    const user = users.find(u => String(u.id) === chatId);
    if (user) {
      isRegistered = true;
      isBlocked = user.blocked;
      
      // Auto-update username/nama jika berubah
      if (user.username !== fromUser.username || user.name !== (fromUser.first_name || '-')) {
        addUser(fromUser).catch(e => console.error('Auto-update user error:', e));
      }
    }
  }

  // Izinkan command /start agar user bisa mendaftar (setelah cek username lolos)
  if (text.startsWith('/start')) {
    return await next();
  }

  // Jika diblokir, abaikan sepenuhnya
  if (isBlocked) return;

  // Jika belum terdaftar dan mencoba menggunakan command
  if (!isRegistered && text.startsWith('/')) {
    await ctx.reply('⚠️ <b>Akses Ditolak</b>\n\nAnda belum terdaftar di sistem kami. Silakan ketik /start terlebih dahulu untuk mendaftar dan menggunakan fitur bot ini.', { parse_mode: 'HTML' });
    return; // Hentikan eksekusi, jangan lanjut ke handler command
  }

  // Jika belum terdaftar dan mengirim chat biasa, abaikan
  if (!isRegistered) return;

  await next();
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

// ── Admin helper: hanya izinkan owner bot ────────────────────────────────
const ADMIN_IDS = (process.env.ADMIN_TELEGRAM_IDS || '').split(',').map(s => s.trim()).filter(Boolean);
function isAdmin(ctx) {
  return ADMIN_IDS.includes(String(ctx.from?.id));
}

// ── Commands ───────────────────────────────────────────────────────────────
bot.command('start', async (ctx) => {
  const isGroup = ctx.chat.type === 'group' || ctx.chat.type === 'supergroup';

  try {
    isGroup ? await addGroup(ctx.chat) : await addUser(ctx.from);
  } catch (e) {
    console.error('Register error:', e);
  }

  const chatId = ctx.chat.id;
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

// ── Admin Commands (hanya untuk pemilik bot) ───────────────────────────────
bot.command('users', async (ctx) => {
  if (!isAdmin(ctx)) return;
  try {
    const users = await getUsersDetails();
    const groups = await getGroupsDetails();
    const activeU = users.filter(u => !u.blocked).length;
    const activeG = groups.filter(g => !g.blocked).length;

    let msg = `👥 <b>DAFTAR SUBSCRIBER</b>\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    msg += `📊 User: <b>${activeU} aktif</b> / ${users.length} total\n`;
    msg += `📊 Grup: <b>${activeG} aktif</b> / ${groups.length} total\n\n`;

    if (users.length > 0) {
      msg += `<b>👤 USER:</b>\n`;
      users.forEach((u, i) => {
        const status = u.blocked ? '⛔' : '✅';
        msg += `${status} ${i+1}. <b>${esc(u.name)}</b> (@${esc(u.username)})\n   ID: <code>${u.id}</code>\n`;
      });
    }
    if (groups.length > 0) {
      msg += `\n<b>👥 GRUP:</b>\n`;
      groups.forEach((g, i) => {
        const status = g.blocked ? '⛔' : '✅';
        msg += `${status} ${i+1}. <b>${esc(g.title)}</b>\n   ID: <code>${g.id}</code>\n`;
      });
    }
    msg += `\n💡 <i>/blokir [ID] — blokir user/grup\n/unblokir [ID] — buka blokir</i>`;
    await ctx.reply(msg, { parse_mode: 'HTML' });
  } catch (e) {
    await ctx.reply('❌ Error: ' + e.message);
  }
});

bot.command('blokir', async (ctx) => {
  if (!isAdmin(ctx)) return;
  const targetId = ctx.message.text.split(' ')[1]?.trim();
  if (!targetId) return ctx.reply('⚠️ Format: /blokir [chat_id]');

  try {
    let done = false;

    const users = await getUsersDetails();
    const user = users.find(u => String(u.id) === targetId);
    if (user) { user.blocked = true; await saveUsers(users); done = true; }

    if (!done) {
      const groups = await getGroupsDetails();
      const group = groups.find(g => String(g.id) === targetId);
      if (group) { group.blocked = true; await saveGroups(groups); done = true; }
    }

    await ctx.reply(done ? `⛔ ID <code>${targetId}</code> berhasil diblokir.` : `⚠️ ID tidak ditemukan.`, { parse_mode: 'HTML' });
  } catch (e) {
    await ctx.reply('❌ Error: ' + e.message);
  }
});

bot.command('unblokir', async (ctx) => {
  if (!isAdmin(ctx)) return;
  const targetId = ctx.message.text.split(' ')[1]?.trim();
  if (!targetId) return ctx.reply('⚠️ Format: /unblokir [chat_id]');

  try {
    let done = false;

    const users = await getUsersDetails();
    const user = users.find(u => String(u.id) === targetId);
    if (user) { user.blocked = false; await saveUsers(users); done = true; }

    if (!done) {
      const groups = await getGroupsDetails();
      const group = groups.find(g => String(g.id) === targetId);
      if (group) { group.blocked = false; await saveGroups(groups); done = true; }
    }

    await ctx.reply(done ? `✅ ID <code>${targetId}</code> berhasil dibuka blokir.` : `⚠️ ID tidak ditemukan.`, { parse_mode: 'HTML' });
  } catch (e) {
    await ctx.reply('❌ Error: ' + e.message);
  }
});

// (Auto-register pada chat biasa telah dihapus agar user wajib menggunakan /start)

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