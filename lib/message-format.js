export function formatTradingPlan(stockCode, companyName, plan, date, time) {
  const bias = plan['Bias']?.value || '-';
  const biasKet = plan['Bias']?.keterangan || '';
  
  const entry1 = plan['Entry 1 (Starter)'] || plan['Entry 1'] || {};
  const entry2 = plan['Entry 2 (Main)'] || plan['Entry 2'] || {};
  const entry3 = plan['Entry 3 (Sniper)'] || plan['Entry 3'] || {};
  
  const avgEntry = plan['Average Entry']?.value || '-';
  
  const sl = plan['Stop Loss (SL)'] || plan['Stop Loss'] || {};
  
  const tp1 = plan['Take Profit 1'] || plan['TP 1'] || {};
  const tp2 = plan['Take Profit 2'] || plan['TP 2'] || {};
  const tp3 = plan['Take Profit 3'] || plan['TP 3'] || {};
  
  const risk = plan['Risk per Trade']?.value || plan['Risk']?.value || 'Maksimal 2%';

  const message = `📈 TRADING PLAN SAHAM TERUPDATE
📅 ${date} | ${time} WIB

━━━━━━━━━━━━━━━━━━━━
🔹 ${stockCode} (${companyName})
━━━━━━━━━━━━━━━━━━━━

📌 Bias: ${bias}
   └─ ${biasKet}

💰 ENTRY PLAN (Cicil 3 Kali):
   ├─ Entry 1 (Starter): ${entry1.value || '-'}
   │   └─ ${entry1.keterangan || '20% Modal'}
   ├─ Entry 2 (Main): ${entry2.value || '-'}
   │   └─ ${entry2.keterangan || '50% Modal'}
   └─ Entry 3 (Sniper): ${entry3.value || '-'}
       └─ ${entry3.keterangan || '30% Modal'}

📊 Average Entry: ${avgEntry}
   └─ Harga rata-rata tertimbang

🛑 STOP LOSS: ${sl.value || '-'}
   └─ ${sl.keterangan || 'Wajib Cut Loss'}

🎯 TAKE PROFIT:
   ├─ TP 1: ${tp1.value || '-'}
   │   └─ ${tp1.keterangan || 'Jual 30%'}
   ├─ TP 2: ${tp2.value || '-'}
   │   └─ ${tp2.keterangan || 'Jual 30%'}
   └─ TP 3: ${tp3.value || '-'}
       └─ ${tp3.keterangan || 'Jual 40%'}

⚠️ Risk per Trade: ${risk}
   └─ Dari total modal portofolio

━━━━━━━━━━━━━━━━━━━━
📊 Data diperbarui: ${time} WIB`;

  return message;
}

export function getDateTime() {
  const now = new Date();
  const date = now.toLocaleDateString('id-ID', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'Asia/Jakarta'
  });
  const time = now.toLocaleTimeString('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Jakarta'
  });
  return { date, time };
}