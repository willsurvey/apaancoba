import { Bot } from 'grammy';
import { getUsers, getGroups } from '../lib/kv-store.js';
import { parseExcel } from '../lib/excel-parser.js';
import { formatTradingPlan, getDateTime } from '../lib/message-format.js';

const bot = new Bot(process.env.BOT_TOKEN);

export async function POST(req) {
  try {
    const formData = await req.formData();
    const stockCode = formData.get('stockCode');
    const companyName = formData.get('companyName');
    const message = formData.get('message');
    const file = formData.get('excelFile');

    if (!stockCode || !companyName || !file) {
      return new Response(
        JSON.stringify({ error: 'Kode saham, nama perusahaan, dan file Excel wajib diisi!' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const planData = parseExcel(buffer);

    const { date, time } = getDateTime();
    const formattedMessage = formatTradingPlan(stockCode, companyName, planData, date, time);

    const finalMessage = message ? `${message}\n\n${formattedMessage}` : formattedMessage;

    const users = await getUsers();
    const groups = await getGroups();
    const allChats = [...users, ...groups];

    let successCount = 0;
    let failCount = 0;

    for (const chatId of allChats) {
      try {
        await bot.api.sendMessage(chatId, finalMessage, { parse_mode: 'Markdown' });
        successCount++;
      } catch (err) {
        console.error(`Gagal kirim ke ${chatId}:`, err.message);
        failCount++;
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `✅ Terkirim ke ${successCount} chat`,
        successCount,
        failCount,
        totalChats: allChats.length
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Upload error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

export async function GET() {
  const users = await getUsers();
  const groups = await getGroups();
  return new Response(
    JSON.stringify({ users: users.length, groups: groups.length }),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  );
}