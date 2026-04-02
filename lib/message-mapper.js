// ─────────────────────────────────────────────────────────────────
//  message-mapper.js  –  Format pesan broadcast (HTML parse mode)
//  Menggunakan HTML agar karakter dari API tidak merusak formatting
// ─────────────────────────────────────────────────────────────────

const MAX_PER_MSG = 3;

// Escape karakter HTML dari nilai API agar tidak merusak tag
function esc(val) {
  if (val == null) return '-';
  return String(val)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// ── Entry point utama ──────────────────────────────────────────────────────
export function formatBidikanMessages(apiData) {
  if (!apiData || typeof apiData !== 'object') {
    return [msgSystemError('Data tidak valid dari server')];
  }

  const {
    status, market_context, screening_summary, total_saham,
    data, date, mode, mode_warning, generated_at
  } = apiData;

  const tanggal = formatDate(date || generated_at);
  const waktu   = extractTime(generated_at);

  // Kondisi 5: Critical Error
  if (mode === 'ERROR') {
    const errMsg = market_context?.warning || screening_summary?.error || 'Unknown error';
    return [msgSystemError(errMsg, tanggal, waktu)];
  }

  // Kondisi 4: Data Failure
  if (screening_summary?.error === 'empty_universe') {
    return [msgDataFailure(tanggal, waktu, mode, mode_warning)];
  }

  // Kondisi 3: Market Unsafe
  if (market_context?.market_safe === false && screening_summary?.stopped === 'market_unsafe') {
    return [msgMarketUnsafe(tanggal, waktu, market_context)];
  }

  // Header umum
  const ihsg = market_context?.ihsg_close ? fmtNum(market_context.ihsg_close) : '-';
  const ihsgPct = market_context?.ihsg_change_pct != null
    ? ` (${market_context.ihsg_change_pct >= 0 ? '+' : ''}${market_context.ihsg_change_pct.toFixed(2)}%)`
    : '';
  const ihsgTrend = getTrendLabel(market_context?.ihsg_trend);
  const mktWarning = market_context?.warning
    ? `\n⚠️ <i>${esc(market_context.warning)}</i>` : '';
  const modeWarn = mode_warning
    ? `\n${esc(mode_warning)}` : '';

  const ss = screening_summary || {};
  const summaryRows = [
    ss.universe           != null ? `📋 Universe     : ${ss.universe} saham`            : null,
    ss.after_liquidity    != null ? `💧 Likuiditas   : ${ss.after_liquidity} lolos`      : null,
    ss.after_accumulation != null ? `🏦 Akumulasi    : ${ss.after_accumulation} lolos`   : null,
    ss.after_trend        != null ? `📈 Trend        : ${ss.after_trend} lolos`          : null,
    ss.after_smc          != null ? `🔷 SMC          : ${ss.after_smc} lolos`            : null,
    ss.after_entry        != null ? `🎯 Entry Valid  : ${ss.after_entry} lolos`          : null,
    `✅ Sinyal Final : <b>${total_saham || 0} saham</b>`,
  ].filter(Boolean).join('\n');

  const header =
`🎯 <b>BIDIKAN SAHAM HARIAN</b>
📅 ${esc(tanggal)}  |  ⏰ ${esc(waktu)}${modeWarn}

━━━━━━━━━━━━━━━━━━━━
📊 <b>KONDISI PASAR</b>
━━━━━━━━━━━━━━━━━━━━
IHSG  : <b>${esc(ihsg)}</b>${esc(ihsgPct)} ${ihsgTrend}${mktWarning}

━━━━━━━━━━━━━━━━━━━━
🔍 <b>HASIL SCREENING</b>
━━━━━━━━━━━━━━━━━━━━
${summaryRows}`;

  // Kondisi 2: No Signal
  if (!data || data.length === 0 || total_saham === 0) {
    return [msgNoSignal(header)];
  }

  // Kondisi 1: Success
  const messages = [];
  const chunks   = chunkArray(data, MAX_PER_MSG);

  chunks.forEach((chunk, idx) => {
    let body = idx === 0 ? header + '\n\n' : '';
    chunk.forEach(s => { body += formatSaham(s) + '\n'; });

    if (idx === chunks.length - 1) {
      body += disclaimer();
    } else {
      body += '\n⬇️ <i>Lanjut pesan berikutnya...</i>';
    }
    messages.push(body);
  });

  return messages;
}

// ── Format satu saham ──────────────────────────────────────────────────────
function formatSaham(s) {
  const ep    = s.entry_plan  || s;
  const acc   = s.accumulation || {};
  const score = s.scoring || s.ranking || {};

  const ticker  = esc(s.ticker  || s.Emiten        || '???');
  const company = esc(s.company || s.Company_Name  || s.company_name || '-');
  const rank    = esc(s.rank    || s.Rank           || '-');

  const tier       = esc(score.tier || '-');
  const confidence = score.confidence_score ?? score.score ?? '-';
  const tierEmoji  = getTierEmoji(score.tier);

  const e1  = ep.entry_1  ?? ep.Entry_Details?.Entry_1  ?? ep.Entry ?? '-';
  const e2  = ep.entry_2  ?? ep.Entry_Details?.Entry_2  ?? '-';
  const e3  = ep.entry_3  ?? ep.Entry_Details?.Entry_3  ?? '-';
  const pct1 = ep.Entry_Details?.Pct_1 ?? 20;
  const pct2 = ep.Entry_Details?.Pct_2 ?? 50;
  const pct3 = ep.Entry_Details?.Pct_3 ?? 30;
  const sl  = ep.sl  ?? ep.SL  ?? '-';
  const tp1 = ep.tp1 ?? ep.TP_1 ?? '-';
  const tp2 = ep.tp2 ?? ep.TP_2 ?? '-';
  const tp3 = ep.tp3 ?? ep.TP_3 ?? '-';
  const rr  = esc(ep.rr_ratio ?? ep.RR ?? ep.RR_Value ?? '-');

  const dir     = ep.entry_direction_label || ep.Entry_Zone || '';
  const dirLine = dir ? `\n📍 <i>${esc(dir)}</i>` : '';

  const netForeign = acc.net_foreign_today
    ? fmtRupiah(acc.net_foreign_today)
    : esc(s.foreign_flow?.net_foreign_1d_formatted ?? '-');
  const brokerSig = esc(acc.broker_signal || '-');
  const accScore  = acc.acc_score ?? '-';

  const ob  = s.SMC_Details?.OB_Count  ?? '-';
  const fvg = s.SMC_Details?.FVG_Count ?? '-';

  const warns = Array.isArray(s.warnings) && s.warnings.length > 0
    ? `\n⚠️ ${esc(s.warnings.join(' | '))}` : '';

  return (
`━━━━━━━━━━━━━━━━━━━━
🏆 #${rank}  <b>${ticker}</b>  —  ${company}
━━━━━━━━━━━━━━━━━━━━
${tierEmoji} <b>${tier}</b>  |  Skor: <b>${confidence}/100</b>  |  RR: <b>${rr}</b>

💰 <b>ENTRY PLAN</b>${dirLine}
   E1 : <b>${fmtNum(e1)}</b>  (${pct1}% modal)
   E2 : <b>${fmtNum(e2)}</b>  (${pct2}% modal)
   E3 : <b>${fmtNum(e3)}</b>  (${pct3}% modal)

🎯 <b>TAKE PROFIT</b>
   TP1: <b>${fmtNum(tp1)}</b>  → jual 30%
   TP2: <b>${fmtNum(tp2)}</b>  → jual 30%
   TP3: <b>${fmtNum(tp3)}</b>  → jual 40%

🛑 <b>STOP LOSS</b> : <b>${fmtNum(sl)}</b>
⚖️ <b>Risk/Reward</b>: ${rr}

🏦 <b>AKUMULASI</b>
   Broker : ${brokerSig}
   Asing  : ${netForeign}
   Skor   : ${accScore}

🔷 <b>SMC</b>  —  OB: ${ob}  |  FVG: ${fvg}${warns}
`);
}

// ── Template pesan khusus ──────────────────────────────────────────────────
function msgNoSignal(header) {
  return (
`${header}

━━━━━━━━━━━━━━━━━━━━
😴 <b>TIDAK ADA SINYAL HARI INI</b>
━━━━━━━━━━━━━━━━━━━━
Tidak ada saham yang memenuhi semua kriteria seleksi ketat hari ini.

💡 <b>Apa artinya?</b>
Ini bukan kegagalan sistem — ini <b>perlindungan modal</b>.
Lebih baik tidak trading daripada masuk di setup yang lemah.

📌 <b>Saran:</b>
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
  const warning = esc(mkt?.warning || 'IHSG dalam kondisi berbahaya');

  return (
`🚨 <b>MARKET TIDAK AMAN — STOP TRADING</b>
📅 ${esc(tanggal)}  |  ⏰ ${esc(waktu)}

━━━━━━━━━━━━━━━━━━━━
📉 IHSG : <b>${esc(ihsg)}</b> ${esc(pct)}
⚠️ ${warning}
━━━━━━━━━━━━━━━━━━━━

🛑 <b>Sistem otomatis menghentikan screening.</b>
   Risiko sistemik terlalu tinggi untuk entry baru.

💡 <b>Yang harus dilakukan:</b>
• Jangan buka posisi baru hari ini
• Perketat Stop Loss posisi aktif
• Tunggu konfirmasi pemulihan IHSG

━━━━━━━━━━━━━━━━━━━━
💰 <b>Prioritas utama: Lindungi Modal</b>
━━━━━━━━━━━━━━━━━━━━
${disclaimer()}`
  );
}

function msgDataFailure(tanggal, waktu, mode, modeWarning) {
  return (
`⚙️ <b>DATA TIDAK TERSEDIA</b>
📅 ${esc(tanggal)}  |  ⏰ ${esc(waktu)}

━━━━━━━━━━━━━━━━━━━━
${esc(modeWarning || `Mode: ${mode || 'UNKNOWN'} — data tidak lengkap`)}
━━━━━━━━━━━━━━━━━━━━

❌ Sistem tidak berhasil mengambil data screening lengkap.
   (Broker Accumulation &amp; Foreign Flow tidak tersedia)

📌 <b>Jangan trading</b> berdasarkan kondisi ini.
   Data tidak cukup untuk keputusan yang valid.

🔧 Admin sedang memeriksa koneksi data.
   Coba lagi pada sesi berikutnya.

${disclaimer()}`
  );
}

function msgSystemError(errMsg, tanggal = '-', waktu = '-') {
  return (
`🔴 <b>SISTEM ERROR</b>
📅 ${esc(tanggal)}  |  ⏰ ${esc(waktu)}

━━━━━━━━━━━━━━━━━━━━
❌ Terjadi kesalahan teknis:
<code>${esc(errMsg)}</code>
━━━━━━━━━━━━━━━━━━━━

🚫 <b>Abaikan output ini untuk trading.</b>
   Data tidak dapat dipercaya.

🔧 Error telah dicatat. Admin akan segera memeriksa.

${disclaimer()}`
  );
}

export function formatErrorMessage() {
  return (
`⚠️ <b>GAGAL MENGAMBIL DATA</b>

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
⚠️ <b>DISCLAIMER</b>
📌 Hasil screening <b>OTOMATIS</b> — bukan rekomendasi investasi
🔍 Owner akan analisa ulang secara manual
📝 Entry area dapat berubah setelah review manual
⏳ Tunggu konfirmasi final dari Owner sebelum eksekusi

💡 <i>Do Your Own Research (DYOR)</i>
💡 <i>Gunakan money management yang baik</i>
💡 <i>Maksimal risiko 2% per trade dari total modal</i>
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
  if (isNaN(n)) return String(val);
  return n.toLocaleString('id-ID');
}

function fmtRupiah(val) {
  if (!val) return '-';
  const abs    = Math.abs(val);
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
  } catch { return String(rawDate); }
}

function extractTime(generatedAt) {
  if (!generatedAt) return '-';
  const match = String(generatedAt).match(/(\d{2}:\d{2})(?::\d{2})?\s*(WIB)?/);
  return match ? `${match[1]} ${match[2] || 'WIB'}`.trim() : String(generatedAt);
}

function getTierEmoji(tier) {
  if (!tier) return '⚪';
  switch (String(tier).toUpperCase()) {
    case 'HIGH':     return '🟢';
    case 'MODERATE': return '🟡';
    case 'LOW':      return '🔴';
    default:         return '⚪';
  }
}

function getTrendLabel(trend) {
  if (!trend) return '';
  switch (String(trend).toUpperCase()) {
    case 'BULLISH': return '📈 Bullish';
    case 'BEARISH': return '📉 Bearish';
    case 'NEUTRAL': return '➡️ Neutral';
    default:        return esc(trend);
  }
}