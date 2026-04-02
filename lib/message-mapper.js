// ─────────────────────────────────────────────
//  message-mapper.js  –  Format pesan broadcast
// ─────────────────────────────────────────────

const MAX_PER_MSG = 3; // maks saham per pesan agar tidak terpotong Telegram

// ── Entry point utama ──────────────────────────────────────────────────────
export function formatBidikanMessages(apiData) {
  // ── Kondisi 5: Critical Error ──────────────────────────────────────────
  if (!apiData || typeof apiData !== 'object') {
    return [msgSystemError('Data tidak valid dari server')];
  }

  const { status, market_context, screening_summary, total_saham, data, date,
          mode, mode_warning, generated_at } = apiData;

  const tanggal  = formatDate(date || generated_at);
  const waktu    = extractTime(generated_at);

  // ── Kondisi 5: status ERROR ────────────────────────────────────────────
  if (mode === 'ERROR') {
    const errMsg = market_context?.warning || screening_summary?.error || 'Unknown error';
    return [msgSystemError(errMsg, tanggal, waktu)];
  }

  // ── Kondisi 4: Data Failure / empty_universe ───────────────────────────
  if (screening_summary?.error === 'empty_universe') {
    return [msgDataFailure(tanggal, waktu, mode, mode_warning)];
  }

  // ── Kondisi 3: Market Unsafe ───────────────────────────────────────────
  if (market_context?.market_safe === false && screening_summary?.stopped === 'market_unsafe') {
    return [msgMarketUnsafe(tanggal, waktu, market_context)];
  }

  // ── Header umum (dipakai kondisi 1 & 2) ───────────────────────────────
  const ihsg     = market_context?.ihsg_close   ? `${fmtNum(market_context.ihsg_close)}` : '-';
  const ihsgPct  = market_context?.ihsg_change_pct != null
    ? ` (${market_context.ihsg_change_pct >= 0 ? '+' : ''}${market_context.ihsg_change_pct.toFixed(2)}%)`
    : '';
  const ihsgTrend = getTrendLabel(market_context?.ihsg_trend);
  const mktWarning = market_context?.warning
    ? `\n⚠️ _${market_context.warning}_` : '';
  const modeWarn = mode_warning
    ? `\n${mode_warning}` : '';

  // Summary screening
  const ss = screening_summary || {};
  const universeRow  = ss.universe      ? `📋 Universe       : ${ss.universe} saham`   : null;
  const liquidRow    = ss.after_liquidity != null ? `💧 Likuiditas     : ${ss.after_liquidity} lolos` : null;
  const accumRow     = ss.after_accumulation != null ? `🏦 Akumulasi      : ${ss.after_accumulation} lolos` : null;
  const trendRow     = ss.after_trend   != null ? `📈 Trend          : ${ss.after_trend} lolos`   : null;
  const smcRow       = ss.after_smc     != null ? `🔷 SMC            : ${ss.after_smc} lolos`     : null;
  const entryRow     = ss.after_entry   != null ? `🎯 Entry Valid    : ${ss.after_entry} lolos`   : null;
  const finalRow     = `✅ Sinyal Final   : *${total_saham || 0} saham*`;

  const summaryLines = [universeRow, liquidRow, accumRow, trendRow, smcRow, entryRow, finalRow]
    .filter(Boolean).join('\n');

  const header =
`🎯 *BIDIKAN SAHAM HARIAN*
📅 ${tanggal}  |  ⏰ ${waktu}${modeWarn}

━━━━━━━━━━━━━━━━━━━━
📊 *KONDISI PASAR*
━━━━━━━━━━━━━━━━━━━━
IHSG  : *${ihsg}*${ihsgPct} ${ihsgTrend}${mktWarning}

━━━━━━━━━━━━━━━━━━━━
🔍 *HASIL SCREENING*
━━━━━━━━━━━━━━━━━━━━
${summaryLines}`;

  // ── Kondisi 2: No Signal (sistem OK, tapi 0 saham) ────────────────────
  if (!data || data.length === 0 || total_saham === 0) {
    return [msgNoSignal(header, tanggal)];
  }

  // ── Kondisi 1: Success — ada sinyal ───────────────────────────────────
  const messages = [];
  const chunks   = chunkArray(data, MAX_PER_MSG);

  chunks.forEach((chunk, idx) => {
    let body = idx === 0 ? header + '\n\n' : '';

    chunk.forEach((s) => {
      body += formatSaham(s) + '\n';
    });

    if (idx === chunks.length - 1) {
      body += disclaimer();
    } else {
      body += `\n⬇️ _Lanjut pesan berikutnya..._`;
    }

    messages.push(body);
  });

  return messages;
}

// ── Format satu saham ──────────────────────────────────────────────────────
function formatSaham(s) {
  const ep    = s.entry_plan  || s;          // support struktur lama & baru
  const acc   = s.accumulation || {};
  const score = s.scoring || s.ranking || {};

  const ticker  = s.ticker || s.Emiten  || '???';
  const company = s.company || s.Company_Name || s.company_name || '-';
  const rank    = s.rank || s.Rank || s.Rank || '-';

  // Confidence
  const tier       = score.tier        || '-';
  const confidence = score.confidence_score ?? score.score ?? '-';
  const tierEmoji  = getTierEmoji(tier);

  // Entry
  const e1  = ep.entry_1  ?? ep.Entry_Details?.Entry_1  ?? ep.Entry ?? '-';
  const e2  = ep.entry_2  ?? ep.Entry_Details?.Entry_2  ?? '-';
  const e3  = ep.entry_3  ?? ep.Entry_Details?.Entry_3  ?? '-';
  const pct1 = ep.Entry_Details?.Pct_1 ?? 20;
  const pct2 = ep.Entry_Details?.Pct_2 ?? 50;
  const pct3 = ep.Entry_Details?.Pct_3 ?? 30;
  const sl  = ep.sl       ?? ep.SL    ?? '-';
  const tp1 = ep.tp1      ?? ep.TP_1  ?? '-';
  const tp2 = ep.tp2      ?? ep.TP_2  ?? '-';
  const tp3 = ep.tp3      ?? ep.TP_3  ?? '-';
  const rr  = ep.rr_ratio ?? ep.RR    ?? ep.RR_Value ?? '-';

  // Direction
  const dir      = ep.entry_direction_label || ep.Entry_Zone || '';
  const dirLine  = dir ? `\n📍 _${dir}_` : '';

  // Akumulasi
  const netForeign = acc.net_foreign_today
    ? fmtRupiah(acc.net_foreign_today) : (s.foreign_flow?.net_foreign_1d_formatted ?? '-');
  const brokerSig  = acc.broker_signal || '-';
  const accScore   = acc.acc_score ?? '-';

  // SMC
  const ob  = s.SMC_Details?.OB_Count  ?? '-';
  const fvg = s.SMC_Details?.FVG_Count ?? '-';

  // Warnings
  const warns = Array.isArray(s.warnings) && s.warnings.length > 0
    ? `\n⚠️ ${s.warnings.join(' | ')}` : '';

  return (
`━━━━━━━━━━━━━━━━━━━━
🏆 #${rank}  *${ticker}*  —  ${company}
━━━━━━━━━━━━━━━━━━━━
${tierEmoji} *${tier}*  |  Skor: *${confidence}/100*  |  RR: *${rr}*

💰 *ENTRY PLAN*${dirLine}
   E1 : *${fmtNum(e1)}*  (${pct1}% modal)
   E2 : *${fmtNum(e2)}*  (${pct2}% modal)
   E3 : *${fmtNum(e3)}*  (${pct3}% modal)

🎯 *TAKE PROFIT*
   TP1: *${fmtNum(tp1)}*  → jual 30%
   TP2: *${fmtNum(tp2)}*  → jual 30%
   TP3: *${fmtNum(tp3)}*  → jual 40%

🛑 *STOP LOSS* : *${fmtNum(sl)}*
⚖️ *Risk/Reward*: ${rr}

🏦 *AKUMULASI*
   Broker : ${brokerSig}
   Asing  : ${netForeign}
   Skor   : ${accScore}

🔷 *SMC*  —  OB: ${ob}  |  FVG: ${fvg}${warns}
`);
}

// ── Template pesan khusus ──────────────────────────────────────────────────

function msgNoSignal(header, tanggal) {
  return (
`${header}

━━━━━━━━━━━━━━━━━━━━
😴 *TIDAK ADA SINYAL HARI INI*
━━━━━━━━━━━━━━━━━━━━
Tidak ada saham yang memenuhi semua kriteria seleksi ketat hari ini.

💡 *Apa artinya?*
Ini bukan kegagalan sistem — ini *perlindungan modal*.
Lebih baik tidak trading daripada masuk di setup yang lemah.

📌 *Saran:*
• Stay cash, tunggu setup berikutnya
• Review posisi aktif yang sudah ada
• Pelajari saham watchlist manual Anda

${disclaimer()}`
  );
}

function msgMarketUnsafe(tanggal, waktu, mkt) {
  const ihsg    = mkt?.ihsg_close ? fmtNum(mkt.ihsg_close) : '-';
  const pct     = mkt?.ihsg_change_pct != null
    ? `(${mkt.ihsg_change_pct.toFixed(2)}%)` : '';
  const warning = mkt?.warning || 'IHSG dalam kondisi berbahaya';

  return (
`🚨 *MARKET TIDAK AMAN — STOP TRADING*
📅 ${tanggal}  |  ⏰ ${waktu}

━━━━━━━━━━━━━━━━━━━━
📉 IHSG : *${ihsg}* ${pct}
⚠️ ${warning}
━━━━━━━━━━━━━━━━━━━━

🛑 *Sistem otomatis menghentikan screening.*
   Risiko sistemik terlalu tinggi untuk entry baru.

💡 *Yang harus dilakukan:*
• Jangan buka posisi baru hari ini
• Perketat Stop Loss posisi aktif
• Tunggu konfirmasi pemulihan IHSG

━━━━━━━━━━━━━━━━━━━━
💰 *Prioritas utama: Lindungi Modal*
━━━━━━━━━━━━━━━━━━━━
${disclaimer()}`
  );
}

function msgDataFailure(tanggal, waktu, mode, modeWarning) {
  return (
`⚙️ *DATA TIDAK TERSEDIA*
📅 ${tanggal}  |  ⏰ ${waktu}

━━━━━━━━━━━━━━━━━━━━
${modeWarning || `⚠️ Mode: ${mode || 'UNKNOWN'} — data tidak lengkap`}
━━━━━━━━━━━━━━━━━━━━

❌ Sistem tidak berhasil mengambil data screening lengkap.
   (Broker Accumulation & Foreign Flow tidak tersedia)

📌 *Jangan trading* berdasarkan kondisi ini.
   Data tidak cukup untuk keputusan yang valid.

🔧 Admin sedang memeriksa koneksi data.
   Coba lagi pada sesi berikutnya.

${disclaimer()}`
  );
}

function msgSystemError(errMsg, tanggal = '-', waktu = '-') {
  return (
`🔴 *SISTEM ERROR*
📅 ${tanggal}  |  ⏰ ${waktu}

━━━━━━━━━━━━━━━━━━━━
❌ Terjadi kesalahan teknis:
\`${errMsg}\`
━━━━━━━━━━━━━━━━━━━━

🚫 *Abaikan output ini untuk trading.*
   Data tidak dapat dipercaya.

🔧 Error telah dicatat. Admin akan segera memeriksa.

${disclaimer()}`
  );
}

export function formatErrorMessage() {
  return (
`⚠️ *GAGAL MENGAMBIL DATA*

Server tidak merespons atau data tidak tersedia.
Admin sedang memperbaiki.

Silakan tunggu notifikasi berikutnya.

${disclaimer()}`
  );
}

// ── Disclaimer ────────────────────────────────────────────────────────────
function disclaimer() {
  return (
`━━━━━━━━━━━━━━━━━━━━
⚠️ *DISCLAIMER*
📌 Hasil screening *OTOMATIS* — bukan rekomendasi investasi
🔍 Owner akan analisa ulang secara manual
📝 Entry area dapat berubah setelah review manual
⏳ Tunggu konfirmasi final dari Owner sebelum eksekusi

💡 _Do Your Own Research (DYOR)_
💡 _Gunakan money management yang baik_
💡 _Maksimal risiko 2% per trade dari total modal_
━━━━━━━━━━━━━━━━━━━━`
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────
function chunkArray(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function fmtNum(val) {
  if (val == null || val === '-') return '-';
  const n = Number(val);
  if (isNaN(n)) return val;
  return n.toLocaleString('id-ID');
}

function fmtRupiah(val) {
  if (!val) return '-';
  const abs = Math.abs(val);
  const prefix = val < 0 ? '-' : '+';
  if (abs >= 1_000_000_000_000) return `${prefix}${(abs / 1_000_000_000_000).toFixed(1)}T`;
  if (abs >= 1_000_000_000)     return `${prefix}${(abs / 1_000_000_000).toFixed(1)}M`;
  if (abs >= 1_000_000)         return `${prefix}${(abs / 1_000_000).toFixed(0)}jt`;
  return `${prefix}${fmtNum(abs)}`;
}

function formatDate(rawDate) {
  if (!rawDate) return '-';
  try {
    const d = new Date(rawDate);
    return d.toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' });
  } catch { return rawDate; }
}

function extractTime(generatedAt) {
  if (!generatedAt) return '-';
  // "2023-10-27 18:05:30 WIB"  → "18:05 WIB"
  const match = generatedAt.match(/(\d{2}:\d{2})(?::\d{2})?\s*(WIB)?/);
  return match ? `${match[1]} ${match[2] || 'WIB'}`.trim() : generatedAt;
}

function getTierEmoji(tier) {
  if (!tier) return '⚪';
  switch (tier.toUpperCase()) {
    case 'HIGH':     return '🟢';
    case 'MODERATE': return '🟡';
    case 'LOW':      return '🔴';
    default:         return '⚪';
  }
}

function getTrendLabel(trend) {
  if (!trend) return '';
  switch (trend.toUpperCase()) {
    case 'BULLISH': return '📈 Bullish';
    case 'BEARISH': return '📉 Bearish';
    case 'NEUTRAL': return '➡️ Neutral';
    default:        return trend;
  }
}
