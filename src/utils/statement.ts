import type { ApiStatement } from '../api';

/**
 * Generates an official printable/PDF statement for an Oak Haven Yield account.
 */
export function generateStatementHtml(statement: ApiStatement): string {
  const { client, period, figures, trades, transactions, issuedAt, notes } = statement;

  const fmtDate = (iso?: string | null) =>
    iso ? new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : '—';
  const fmtUsd = (n?: number | null) =>
    `$${Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const periodText = period.from || period.to
    ? `${fmtDate(period.from)} – ${fmtDate(period.to)}`
    : 'All-time to date';

  const tradesRows = trades.map(t => `
    <tr>
      <td style="padding:8px 12px;border-bottom:1px solid #E4DECB;font-weight:600;color:#1C412C;">${t.symbol}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #E4DECB;">
        <span style="display:inline-block;padding:2px 8px;border-radius:4px;font-size:10px;font-weight:bold;background:${t.side === 'LONG' ? '#dcfce7;color:#15803d' : '#fee2e2;color:#b91c1c'};">${t.side}</span>
      </td>
      <td style="padding:8px 12px;border-bottom:1px solid #E4DECB;font-family:monospace;">${t.units ? t.units.toFixed(4) : '—'}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #E4DECB;">${fmtUsd(t.entryPrice)}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #E4DECB;">${t.exitPrice ? fmtUsd(t.exitPrice) : '—'}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #E4DECB;font-weight:bold;color:${t.pnl >= 0 ? '#15803d' : '#b91c1c'};">${t.pnl >= 0 ? '+' : ''}${fmtUsd(t.pnl)}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #E4DECB;font-size:11px;color:#526661;">${fmtDate(t.openedAt)}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #E4DECB;font-size:11px;color:#526661;">${t.closedAt ? fmtDate(t.closedAt) : 'OPEN'}</td>
    </tr>
  `).join('');

  const txRows = transactions.map(tx => `
    <tr>
      <td style="padding:8px 12px;border-bottom:1px solid #E4DECB;font-size:11px;color:#526661;">${fmtDate(tx.createdAt)}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #E4DECB;text-transform:capitalize;font-weight:600;">${tx.type}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #E4DECB;font-size:11px;">${tx.method}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #E4DECB;font-weight:bold;color:${tx.type === 'deposit' ? '#15803d' : '#b91c1c'};">${tx.type === 'deposit' ? '+' : '-'}${fmtUsd(tx.amount)}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #E4DECB;font-size:10px;text-transform:uppercase;font-weight:bold;">${tx.status}</td>
    </tr>
  `).join('');

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Account Statement — ${client.name} — Oak Haven Yield</title>
  <style>
    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .no-print { display: none; }
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      color: #213532;
      background: #FFFFFF;
      margin: 0;
      padding: 32px;
      line-height: 1.5;
    }
  </style>
</head>
<body>
  <div class="no-print" style="margin-bottom:24px;padding:12px 16px;background:#F5F2E9;border:1px solid #E4DECB;border-radius:10px;display:flex;justify-content:between;align-items:center;">
    <span style="font-size:13px;color:#1C412C;font-weight:600;">Oak Haven Yield Official Account Statement</span>
    <button onclick="window.print()" style="background:#1C412C;color:#F5F2E9;border:none;padding:8px 18px;border-radius:8px;font-weight:bold;cursor:pointer;font-size:13px;">Print / Save as PDF</button>
  </div>

  <div style="max-width:900px;margin:0 auto;border:1px solid #E4DECB;border-radius:16px;padding:36px;background:#FFFFFF;">
    <!-- Header -->
    <div style="display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #1C412C;padding-bottom:20px;">
      <div>
        <div style="font-family:Georgia, serif;font-size:24px;font-weight:bold;color:#1C412C;letter-spacing:1px;">
          OAK HAVEN <span style="color:#B08B48;font-style:italic;">YIELD</span>
        </div>
        <div style="font-size:11px;color:#526661;font-weight:bold;letter-spacing:1px;text-transform:uppercase;margin-top:2px;">
          Investment Advisory & Trading Platform
        </div>
        <div style="font-size:11px;color:#7a8a82;margin-top:6px;">
          Regulated Financial Markets · support@oakhavenyield.com
        </div>
      </div>
      <div style="text-align:right;">
        <div style="font-size:18px;font-weight:bold;color:#1C412C;">ACCOUNT STATEMENT</div>
        <div style="font-size:12px;color:#526661;margin-top:4px;"><strong>Statement Period:</strong> ${periodText}</div>
        <div style="font-size:11px;color:#7a8a82;margin-top:2px;">Issued: ${fmtDate(issuedAt)}</div>
      </div>
    </div>

    <!-- Client & Account Details -->
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-top:24px;padding:16px;background:#F5F2E9;border:1px solid #E4DECB;border-radius:12px;">
      <div>
        <div style="font-size:10px;text-transform:uppercase;font-weight:bold;color:#526661;letter-spacing:1px;">Client Information</div>
        <div style="font-size:15px;font-weight:bold;color:#1C412C;margin-top:4px;">${client.name}</div>
        <div style="font-size:12px;color:#526661;margin-top:2px;">${client.email}</div>
      </div>
      <div>
        <div style="font-size:10px;text-transform:uppercase;font-weight:bold;color:#526661;letter-spacing:1px;">Account Details</div>
        <div style="font-size:13px;color:#1C412C;margin-top:4px;"><strong>Account ID:</strong> OHY-${String(client.id).padStart(6, '0')}</div>
        <div style="font-size:13px;color:#1C412C;margin-top:2px;"><strong>Base Currency:</strong> USD ($)</div>
      </div>
    </div>

    <!-- Financial Performance Summary -->
    <div style="margin-top:28px;">
      <div style="font-size:13px;font-weight:bold;text-transform:uppercase;color:#1C412C;letter-spacing:1px;margin-bottom:12px;">Performance & Balance Summary</div>
      <div style="display:grid;grid-template-columns:repeat(4, 1fr);gap:12px;">
        <div style="padding:14px;background:#FFFFFF;border:1px solid #E4DECB;border-radius:10px;">
          <div style="font-size:11px;color:#526661;">Current Balance</div>
          <div style="font-size:18px;font-weight:bold;color:#1C412C;margin-top:4px;">${fmtUsd(figures.balance)}</div>
        </div>
        <div style="padding:14px;background:#FFFFFF;border:1px solid #E4DECB;border-radius:10px;">
          <div style="font-size:11px;color:#526661;">Realised P/L</div>
          <div style="font-size:18px;font-weight:bold;color:${(figures.realisedPnl || 0) >= 0 ? '#15803d' : '#b91c1c'};margin-top:4px;">
            ${(figures.realisedPnl || 0) >= 0 ? '+' : ''}${fmtUsd(figures.realisedPnl)}
          </div>
        </div>
        <div style="padding:14px;background:#FFFFFF;border:1px solid #E4DECB;border-radius:10px;">
          <div style="font-size:11px;color:#526661;">Total Volume</div>
          <div style="font-size:18px;font-weight:bold;color:#1C412C;margin-top:4px;">${fmtUsd(figures.volume)}</div>
        </div>
        <div style="padding:14px;background:#FFFFFF;border:1px solid #E4DECB;border-radius:10px;">
          <div style="font-size:11px;color:#526661;">Win Rate</div>
          <div style="font-size:18px;font-weight:bold;color:#B08B48;margin-top:4px;">${figures.winRate ?? 0}%</div>
        </div>
      </div>

      <div style="display:grid;grid-template-columns:repeat(3, 1fr);gap:12px;margin-top:12px;">
        <div style="padding:12px;background:#F5F2E9;border:1px solid #E4DECB;border-radius:8px;font-size:12px;">
          <span style="color:#526661;">Total Deposits:</span> <strong style="color:#15803d;">${fmtUsd(figures.deposits)}</strong>
        </div>
        <div style="padding:12px;background:#F5F2E9;border:1px solid #E4DECB;border-radius:8px;font-size:12px;">
          <span style="color:#526661;">Total Withdrawals:</span> <strong style="color:#b91c1c;">${fmtUsd(figures.withdrawals)}</strong>
        </div>
        <div style="padding:12px;background:#F5F2E9;border:1px solid #E4DECB;border-radius:8px;font-size:12px;">
          <span style="color:#526661;">Closed / Total Trades:</span> <strong style="color:#1C412C;">${figures.closedCount ?? 0} / ${figures.tradeCount ?? 0}</strong>
        </div>
      </div>
    </div>

    ${notes ? `
    <div style="margin-top:20px;padding:12px 16px;background:#F5F2E9;border-left:4px solid #B08B48;border-radius:4px;font-size:12px;color:#213532;">
      <strong>Advisor Notes:</strong> ${notes}
    </div>` : ''}

    <!-- Trading Activity -->
    <div style="margin-top:32px;">
      <div style="font-size:13px;font-weight:bold;text-transform:uppercase;color:#1C412C;letter-spacing:1px;margin-bottom:10px;">Trading Activity (${trades.length} positions)</div>
      <table style="width:100%;border-collapse:collapse;font-size:12px;text-align:left;">
        <thead>
          <tr style="background:#1C412C;color:#F5F2E9;">
            <th style="padding:8px 12px;font-weight:600;">Symbol</th>
            <th style="padding:8px 12px;font-weight:600;">Side</th>
            <th style="padding:8px 12px;font-weight:600;">Units</th>
            <th style="padding:8px 12px;font-weight:600;">Entry Price</th>
            <th style="padding:8px 12px;font-weight:600;">Exit Price</th>
            <th style="padding:8px 12px;font-weight:600;">Profit / Loss</th>
            <th style="padding:8px 12px;font-weight:600;">Opened</th>
            <th style="padding:8px 12px;font-weight:600;">Closed</th>
          </tr>
        </thead>
        <tbody>
          ${tradesRows || '<tr><td colspan="8" style="padding:16px;text-align:center;color:#7a8a82;">No trades in this period</td></tr>'}
        </tbody>
      </table>
    </div>

    <!-- Cashflow Transactions -->
    ${transactions.length ? `
    <div style="margin-top:28px;">
      <div style="font-size:13px;font-weight:bold;text-transform:uppercase;color:#1C412C;letter-spacing:1px;margin-bottom:10px;">Account Transactions</div>
      <table style="width:100%;border-collapse:collapse;font-size:12px;text-align:left;">
        <thead>
          <tr style="background:#F5F2E9;color:#1C412C;border-bottom:2px solid #E4DECB;">
            <th style="padding:8px 12px;">Date</th>
            <th style="padding:8px 12px;">Type</th>
            <th style="padding:8px 12px;">Method</th>
            <th style="padding:8px 12px;">Amount</th>
            <th style="padding:8px 12px;">Status</th>
          </tr>
        </thead>
        <tbody>
          ${txRows}
        </tbody>
      </table>
    </div>` : ''}

    <!-- Disclaimer & Signature Footer -->
    <div style="margin-top:40px;padding-top:20px;border-top:1px solid #E4DECB;font-size:10px;color:#7a8a82;line-height:1.6;">
      <p style="margin:0 0 8px;">
        <strong>Disclaimer:</strong> This statement is generated electronically by Oak Haven Yield and is verified by compliance.
        Trading leveraged products involves substantial risk. Past performance does not guarantee future results.
      </p>
      <div style="display:flex;justify-content:space-between;align-items:center;margin-top:16px;">
        <span>© 2026 Oak Haven Yield. All Rights Reserved.</span>
        <span style="font-family:monospace;">Document Hash: ${Math.random().toString(36).substring(2, 15).toUpperCase()}</span>
      </div>
    </div>
  </div>
</body>
</html>
`;
}

/** Open the printable statement in a new browser tab */
export function openStatementWindow(statement: ApiStatement) {
  const html = generateStatementHtml(statement);
  const win = window.open('', '_blank');
  if (win) {
    win.document.write(html);
    win.document.close();
  }
}
