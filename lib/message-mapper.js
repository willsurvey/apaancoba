// ─────────────────────────────────────────────────────────────────
//  message-mapper.js  –  Format pesan broadcast (HTML parse mode)
//  Menangani 5 pipeline: Intraday, ARA, BSJP, BPJS, Swing
// ─────────────────────────────────────────────────────────────────

const MAX_PER_MSG = 3;

// Escape karakter HTML
function esc(val) {
  if (val == null) return '-';
  return String(val)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function fmtNum(val) {
  if (val == null || val === '-') return '-';
  const n = Number(val);
  if (isNaN(n)) return String(val);
  return n.toLocaleString('id-ID');
}

function fmtRupiah(val) {
  if (!val) return '-';
  const abs = Math.abs(val);
  const prefix = val < 0 ? '-' : '+';
  if (abs >= 1_000_000_000_000) return `${prefix}${(abs / 1_000_000_000_000).toFixed(1)}T`;
  if (abs >= 1_000_000_000) return `${prefix}${(abs / 1_000_000_000).toFixed(1)}M`;
  if (abs >= 1_000_000) return `${prefix}${(abs / 1_000_000).toFixed(0)}jt`;
  return `${prefix}${fmtNum(abs)}`;
}

function chunkArray(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function disclaimer() {
  return (
`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚠️ <b>DISCLAIMER WAJIB BACA</b>
Semua sinyal adalah output screening OTOMATIS.
Bukan rekomendasi investasi. DYOR.
Gunakan money management yang baik.`
  );
}

// ── MARKET OVERVIEW ───────────────────────────────────────────────────────
export function formatMarketOverview(apiData) {
  if (!apiData || !apiData.meta) return '⚠️ Data tidak valid.';
  
  const mkt = apiData.market_context || {};
  const ss = apiData.screening_summary || {};
  const meta = apiData.meta;
  
  const ihsg = mkt.ihsg_close ? fmtNum(mkt.ihsg_close) : '-';
  const ihsgPct = mkt.ihsg_change_pct != null ? `(${mkt.ihsg_change_pct > 0 ? '+' : ''}${mkt.ihsg_change_pct.toFixed(2)}%)` : '';
  const trend = mkt.ihsg_trend === 'BEARISH' ? '📉 BEARISH (di bawah MA50)' : 
                mkt.ihsg_trend === 'BULLISH' ? '📈 BULLISH' : '➡️ NEUTRAL';
                
  return `📊 <b>MARKET OVERVIEW</b>
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📅 ${esc(meta.date)}  |  🔄 Update: <b>${esc(meta.generated_at)}</b>

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🇮🇩 <b>IHSG</b>
Harga   : <b>${esc(ihsg)}</b> ${esc(ihsgPct)}
Trend   : ${trend}
MA50    : ${fmtNum(mkt.ihsg_ma50)}  |  MA200: ${fmtNum(mkt.ihsg_ma200)}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔍 <b>SCREENING FUNNEL HARI INI</b>
Universe        : ${ss.universe ?? '-'} saham
✅ Likuiditas   : ${ss.after_liquidity ?? '-'}
✅ Akumulasi    : ${ss.after_accumulation ?? '-'}
✅ Trend        : ${ss.after_trend ?? '-'}
✅ SMC          : ${ss.after_smc ?? '-'}
🎯 Sinyal Final : <b>${meta.intraday_count ?? 0} saham</b>

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📡 <b>STATUS PIPELINE SAAT INI</b>
🔵 Intraday  : ✅ ${meta.intraday_count ?? 0} sinyal
🔴 ARA       : ✅ ${meta.ara_count ?? 0} kandidat
🟡 BSJP      : ✅ ${meta.bsjp_count ?? 0} kandidat
🟠 BPJS      : ✅ ${meta.bpjs_count ?? 0} watchlist
🟢 Swing     : ${mkt.ihsg_close < mkt.ihsg_ma200 ? '⛔ OFF (IHSG &lt; MA200)' : `✅ ${meta.swing_count ?? 0} kandidat`}

💡 <i>Ketik /help untuk detail cara penggunaan tiap strategi.</i>`;
}

// ── INTRADAY ─────────────────────────────────────────────────────────────
export function formatIntradayMessage(apiData) {
  const data = apiData?.logika_lama_intraday || [];
  if (data.length === 0) return ['😴 <b>Tidak ada sinyal Intraday hari ini.</b>\n\n' + disclaimer()];

  const header = `🔵 <b>SINYAL INTRADAY — SMC + BANDARMOLOGI</b>
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📅 ${esc(apiData.meta.date)}  |  🔄 Update: ${esc(apiData.meta.generated_at)}
Mode: ${esc(apiData.meta.mode)} ✅

Ditemukan <b>${data.length} sinyal</b> hari ini.`;

  const chunks = chunkArray(data, MAX_PER_MSG);
  return chunks.map((chunk, idx) => {
    let msg = idx === 0 ? header + '\n\n' : '';
    chunk.forEach(s => {
      const ep = s.entry_plan || {};
      const acc = s.accumulation || {};
      const score = s.scoring || {};
      const tier = score.tier || '-';
      const rr = ep.rr_ratio || '-';
      const fvg = s.smc?.fvg_zone || '-';
      
      msg += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🏆 #${esc(s.rank)}  <b>${esc(s.ticker)}</b>  —  ${esc(s.company)}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⭐ <b>${esc(tier.toUpperCase())}</b>  |  Skor: <b>${esc(score.confidence_score)}/100</b>

💰 <b>ENTRY PLAN</b>
  E1:  <b>${fmtNum(ep.entry_1)}</b>
  E2:  <b>${fmtNum(ep.entry_2)}</b>
  E3:  <b>${fmtNum(ep.entry_3)}</b>

🎯 <b>TAKE PROFIT</b>
  TP1: <b>${fmtNum(ep.tp1)}</b>
  TP2: <b>${fmtNum(ep.tp2)}</b>
  TP3: <b>${fmtNum(ep.tp3)}</b>

🛑 <b>STOP LOSS</b> : <b>${fmtNum(ep.sl)}</b>
⚖️ Risk/Reward: <b>${esc(rr)}</b>

🏦 <b>AKUMULASI & FLOW</b>
Broker : <b>${esc(acc.broker_signal)}</b>
Asing  : <b>${fmtRupiah(acc.net_foreign_today)}</b>

🔷 <b>SMC STRUCTURE</b>
FVG Zone : ${esc(fvg)}
Swing    : ${esc(s.smc?.swing_bias)}
\n`;
    });
    if (idx === chunks.length - 1) msg += disclaimer();
    return msg;
  });
}

// ── ARA ──────────────────────────────────────────────────────────────────
export function formatAraMessage(apiData) {
  const data = apiData?.logika_baru_calon_ara || [];
  if (data.length === 0) return ['😴 <b>Tidak ada kandidat ARA hari ini.</b>'];

  const header = `🔴 <b>WATCHLIST CALON ARA</b>
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📅 ${esc(apiData.meta.date)}  |  🔄 Update: ${esc(apiData.meta.generated_at)}

⚠️ <b>PENTING:</b> False signal rate ~85-90%.
Ini adalah <b>WATCHLIST</b>.
⏰ Limit Order: Malam ini (19:00 WIB)
⏰ Exit: Besok pagi 09:00-09:30 WIB (WAJIB)

Ditemukan <b>${data.length} kandidat</b>.`;

  const chunks = chunkArray(data, MAX_PER_MSG);
  return chunks.map((chunk, idx) => {
    let msg = idx === 0 ? header + '\n\n' : '';
    chunk.forEach(s => {
      msg += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔴 #1  <b>${esc(s.ticker)}</b>  —  ${esc(s.company)}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⭐ <b>${esc(s.score_tier)}</b>  |  Skor: <b>${s.score}/100</b>
Tipe: ${esc(s.pattern_type)}

💡 <b>INFO:</b> <i>${esc(s.reason_beginner_friendly)}</i>

🕐 <b>ENTRY MALAM INI (19:00 WIB)</b>
Zona  : <b>${esc(s.entry_range)}</b>
Ref ARA: ~${fmtNum(s.ara_price_ref)}

🎯 <b>TARGET EXIT (BESOK 09:00-09:30)</b>
Konservatif : <b>${fmtNum(s.target_morning_exit)}</b> (~+${s.target_morning_exit_pct}%)
Moderat     : <b>${fmtNum(s.target_base)}</b> (~+${s.target_base_pct}%)
Optimistis  : <b>${fmtNum(s.target_optimistic)}</b> (~+${s.target_optimistic_pct}%)

🏦 Broker: <b>${esc(s.broker_signal)}</b>

⚠️ <i>${esc(s.risk_warning)}</i>
\n`;
    });
    if (idx === chunks.length - 1) msg += disclaimer();
    return msg;
  });
}

// ── BSJP ─────────────────────────────────────────────────────────────────
export function formatBsjpMessage(apiData) {
  const data = apiData?.bsjp_beli_sore_jual_pagi || [];
  if (data.length === 0) return ['😴 <b>Tidak ada kandidat BSJP hari ini.</b>'];

  const header = `🟡 <b>BSJP — BELI SORE JUAL PAGI</b>
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📅 ${esc(apiData.meta.date)}  |  🔄 Update: ${esc(apiData.meta.generated_at)}

⏰ <b>WINDOW AKTIF: 14:30 – 15:45 WIB</b>
Beli di sesi penutupan hari ini.
Jual besok pagi pre-opening atau awal sesi.

Ditemukan <b>${data.length} kandidat</b>.`;

  const chunks = chunkArray(data, MAX_PER_MSG);
  return chunks.map((chunk, idx) => {
    let msg = idx === 0 ? header + '\n\n' : '';
    chunk.forEach(s => {
      const tp = s.trading_plan || {};
      msg += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⭐ #${s.rank}  <b>${esc(s.ticker)}</b>  —  ${esc(s.company)}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🥇 <b>TIER ${esc(s.tier)}</b>  |  Skor: <b>${s.score}/100</b>

📈 <b>DATA HARI INI</b>
Harga  : <b>${fmtNum(s.market_data?.close)}</b> (${s.market_data?.change_pct}%)
Asing  : <b>${fmtRupiah(s.market_data?.net_foreign)}</b>

🕐 <b>ENTRY (14:30-15:45 WIB)</b>
Range : <b>${esc(tp.entry_range)}</b>

🎯 <b>EXIT BESOK PAGI</b>
Target: <b>+2% s/d +8%</b>
Stop  : <b>${fmtNum(tp.stop_loss)}</b>

✅ <b>SINYAL POSITIF</b>
${s.signals_positive?.map(x => '• ' + esc(x)).join('\n') || '-'}
\n`;
    });
    if (idx === chunks.length - 1) msg += disclaimer();
    return msg;
  });
}

// ── BPJS ─────────────────────────────────────────────────────────────────
export function formatBpjsMessage(apiData) {
  const data = apiData?.bpjs_beli_pagi_jual_sore || [];
  if (data.length === 0) return ['😴 <b>Tidak ada watchlist BPJS hari ini.</b>'];

  const header = `🟠 <b>WATCHLIST BPJS — BELI PAGI JUAL SORE</b>
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📅 ${esc(apiData.meta.date)}  |  🔄 Update: ${esc(apiData.meta.generated_at)}

⚠️ <b>INI WATCHLIST — BUKAN SINYAL BELI</b>
Konfirmasi real-time WAJIB besok pagi 09:00 WIB.

Ditemukan <b>${data.length} watchlist</b>.`;

  const chunks = chunkArray(data, MAX_PER_MSG);
  return chunks.map((chunk, idx) => {
    let msg = idx === 0 ? header + '\n\n' : '';
    chunk.forEach(s => {
      const tp = s.trading_plan || {};
      msg += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🟠 #${s.rank}  <b>${esc(s.ticker)}</b>  —  ${esc(s.company)}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Formula: <b>${esc(s.formula)}</b>  |  Skor: <b>${s.score}</b>

🕐 <b>ENTRY BESOK (09:15-09:30 WIB)</b>
Range : <b>${esc(tp.entry_range)}</b>
Stop  : <b>${fmtNum(tp.stop_loss)}</b>

❗ <b>MORNING CONFIRMATION</b>
${s.morning_confirmation_criteria?.map(x => esc(x)).join('\n') || '-'}
\n`;
    });
    if (idx === chunks.length - 1) msg += disclaimer();
    return msg;
  });
}

// ── SWING ────────────────────────────────────────────────────────────────
export function formatSwingMessage(apiData) {
  const mkt = apiData?.market_context || {};
  const isKillSwitch = mkt.ihsg_close < mkt.ihsg_ma200;
  
  if (isKillSwitch) {
    return [`🟢 <b>SWING TRADING — VCP STAGE 2</b>
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔍 <b>STATUS KILL SWITCH</b>
IHSG    : ${fmtNum(mkt.ihsg_close)}
MA200   : ${fmtNum(mkt.ihsg_ma200)}
Status  : ⛔ <b>AKTIF — IHSG DI BAWAH MA200</b>

Pipeline Swing dinonaktifkan otomatis.
Setup VCP terbukti GAGAL di bear market.
Tunggu IHSG kembali di atas MA200.`];
  }

  const data = apiData?.swing_trading || [];
  if (data.length === 0) return ['😴 <b>Tidak ada kandidat Swing hari ini.</b>'];

  const header = `🟢 <b>SWING TRADING — VCP STAGE 2</b>
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📅 ${esc(apiData.meta.date)}  |  🔄 Update: ${esc(apiData.meta.generated_at)}
Ditemukan <b>${data.length} kandidat</b>.`;

  const chunks = chunkArray(data, MAX_PER_MSG);
  return chunks.map((chunk, idx) => {
    let msg = idx === 0 ? header + '\n\n' : '';
    chunk.forEach(s => {
      const tp = s.trading_plan || {};
      const tech = s.technical || {};
      msg += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🟢 #${s.rank}  <b>${esc(s.ticker)}</b>  —  ${esc(s.company)}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Skor: <b>${s.score}/100</b>  |  Stage 2 Uptrend ✅

📊 <b>TEKNIKAL VCP</b>
Posisi vs MA20: ${esc(tech.dist_ma20)}
Squeeze 5d/20d: ${esc(tech.squeeze)}
Volume 5d     : ${esc(tech.vol_ratio)}
RSI           : ${tech.rsi}

💰 <b>TRADING PLAN</b>
Entry    : <b>${fmtNum(tp.entry)}</b>
Target   : <b>${fmtNum(tp.target)}</b> (${esc(tp.target_pct)})
Stop Loss: <b>${fmtNum(tp.stop_loss)}</b> (${esc(tp.stop_loss_pct)})
Max Hold : <b>${tp.max_hold_days} hari</b>
\n`;
    });
    if (idx === chunks.length - 1) msg += disclaimer();
    return msg;
  });
}

// ── HELP ─────────────────────────────────────────────────────────────────
export function formatHelpMessage() {
  return `📖 <b>PANDUAN PENGGUNAAN BOT</b>
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Bot ini adalah asisten trading berbasis data yang melakukan screening otomatis setiap jam.

📌 **PERINTAH UTAMA**
• /bidikan — Sinyal Intraday (SMC + Akumulasi)
• /ara — Watchlist Calon ARA
• /bsjp — Sinyal Beli Sore, Jual Pagi
• /bpjs — Watchlist Beli Pagi, Jual Sore
• /swing — Setup Swing Trading
• /market — Cek Kondisi IHSG & Sektoral
• /update — Cek waktu update terakhir
• /help — Menampilkan panduan ini

⏰ <b>TIMELINE TRADING HARIAN</b>
• <b>08:45:</b> Pasang order untuk /bidikan & /bpjs.
• <b>09:00:</b> Pantau konfirmasi /bpjs & Jual hasil /ara / /bsjp.
• <b>14:30:</b> Waktu belanja utama untuk /bsjp.
• <b>19:00:</b> Pasang limit order untuk /ara besok.

⚠️ <b>MANAJEMEN RISIKO</b>
Maksimal risiko 2% per transaksi. Selalu gunakan SL. DYOR!`;
}

// ── CRON BROADCAST SUMMARY ───────────────────────────────────────────────
export function formatCronBroadcast(apiData) {
  const meta = apiData?.meta || {};
  const mkt = apiData?.market_context || {};
  const trend = mkt.ihsg_trend === 'BEARISH' ? '📉 Bearish' : '📈 Bullish';

  return `🤖 <b>BC TRADER — SINYAL HARIAN</b>
📅 ${esc(meta.date)}  |  ⏰ ${esc(meta.generated_at)}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📊 <b>KONDISI PASAR</b>
IHSG: <b>${fmtNum(mkt.ihsg_close)}</b>  ${trend}
⚠️ ${mkt.ihsg_close < mkt.ihsg_ma50 ? 'IHSG di bawah MA50. Hati-hati dalam entry.' : 'IHSG terpantau baik.'}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📡 <b>RINGKASAN SINYAL HARI INI</b>

🔵 Intraday (SMC) : <b>${meta.intraday_count ?? 0} sinyal</b>  → /bidikan
🔴 Calon ARA      : <b>${meta.ara_count ?? 0} kandidat</b> → /ara
🟡 BSJP Overnight : <b>${meta.bsjp_count ?? 0} kandidat</b> → /bsjp
🟠 BPJS Watchlist : <b>${meta.bpjs_count ?? 0} watchlist</b> → /bpjs
🟢 Swing Trading  : <b>${mkt.ihsg_close < mkt.ihsg_ma200 ? '⛔ OFF' : (meta.swing_count ?? 0) + ' kandidat'}</b> → /swing

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Ketik perintah di atas untuk detail strategi.
⚠️ <i>Screening otomatis. Bukan rekomendasi investasi. DYOR.</i>`;
}