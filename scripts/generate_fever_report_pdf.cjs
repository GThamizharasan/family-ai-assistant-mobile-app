const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const moments = [
  { formatted: '01/06/2026, 01:59', episode: 'Ungrouped', tempF: 101.2, tempC: 38.4, site: 'Forehead', sev: 'Moderate', symptoms: 'None', meds: '—', notes: '—' },
  { formatted: '01/09/2026, 01:41', episode: 'TOM Fever Episode Sep26', tempF: 102.3, tempC: 39.1, site: 'Forehead', sev: 'High', symptoms: 'None', meds: '—', notes: '—' },
  { formatted: '02/09/2026, 01:42', episode: 'TOM Fever Episode Sep26', tempF: 102.0, tempC: 38.9, site: 'Forehead', sev: 'Moderate', symptoms: 'None', meds: '—', notes: '—' },
  { formatted: '03/09/2026, 01:42', episode: 'TOM Fever Episode Sep26', tempF: 101.6, tempC: 38.7, site: 'Forehead', sev: 'Moderate', symptoms: 'None', meds: '—', notes: '—' },
  { formatted: '04/09/2026, 01:42', episode: 'TOM Fever Episode Sep26', tempF: 101.3, tempC: 38.5, site: 'Forehead', sev: 'Moderate', symptoms: 'None', meds: '—', notes: '—' },
  { formatted: '11/09/2026, 01:43', episode: 'TOM Fever Episode Sep26', tempF: 100.9, tempC: 38.3, site: 'Forehead', sev: 'Moderate', symptoms: 'None', meds: '—', notes: '—' },
  { formatted: '23/09/2026, 01:43', episode: 'TOM Fever Episode Sep26', tempF: 97.8, tempC: 36.6, site: 'Forehead', sev: 'Normal', symptoms: 'None', meds: '—', notes: '—' },
  { formatted: '19/10/2026, 22:30', episode: 'Maaran Fever October', tempF: 102.0, tempC: 38.9, site: 'Forehead', sev: 'Moderate', symptoms: 'None', meds: 'Calpol Given (10ml)', notes: '—' },
  { formatted: '20/10/2026, 00:33', episode: 'Maaran Fever October', tempF: 99.1, tempC: 37.3, site: 'Forehead', sev: 'Low', symptoms: 'None', meds: '—', notes: '—' },
  { formatted: '21/10/2026, 20:34', episode: 'Maaran Fever October', tempF: 99.0, tempC: 37.2, site: 'Forehead', sev: 'Normal', symptoms: 'None', meds: '—', notes: '—' },
  { formatted: '22/10/2026, 14:35', episode: 'Maaran Fever October', tempF: 97.2, tempC: 36.2, site: 'Forehead', sev: 'Normal', symptoms: 'None', meds: '—', notes: '—' },
  { formatted: '04/11/2026, 19:08', episode: 'Ungrouped', tempF: 98.4, tempC: 36.9, site: 'Forehead', sev: 'Normal', symptoms: 'None', meds: '—', notes: 'Post-workout cooldown check.' },
  { formatted: '05/11/2026, 01:55', episode: 'Ungrouped', tempF: 100.4, tempC: 38.0, site: 'Forehead', sev: 'Low', symptoms: 'None', meds: '—', notes: '—' }
];

// Generate SVG thermal trend chart
const width = 720;
const height = 155;
const margin = { top: 16, right: 50, bottom: 32, left: 50 };
const innerW = width - margin.left - margin.right;
const innerH = height - margin.top - margin.bottom;

// Time range: June 1 to Nov 5, 2026
const t0 = new Date('2026-06-01T00:00:00').getTime();
const t1 = new Date('2026-11-06T00:00:00').getTime();
function getX(iso) {
  const d = new Date(iso).getTime();
  return margin.left + ((d - t0) / (t1 - t0)) * innerW;
}

const minF = 96.5;
const maxF = 104.0;
function getY(f) {
  return margin.top + innerH - ((f - minF) / (maxF - minF)) * innerH;
}

const rawPoints = [
  { t: '2026-06-01T01:59:00', f: 101.2 },
  { t: '2026-09-01T01:41:00', f: 102.3 },
  { t: '2026-09-02T01:42:00', f: 102.0 },
  { t: '2026-09-03T01:42:00', f: 101.6 },
  { t: '2026-09-04T01:42:00', f: 101.3 },
  { t: '2026-09-11T01:43:00', f: 100.9 },
  { t: '2026-09-23T01:43:00', f: 97.8 },
  { t: '2026-10-19T22:30:00', f: 102.0, rx: true },
  { t: '2026-10-20T00:33:00', f: 99.1 },
  { t: '2026-10-21T20:34:00', f: 99.0 },
  { t: '2026-10-22T14:35:00', f: 97.2 },
  { t: '2026-11-04T19:08:00', f: 98.4 },
  { t: '2026-11-05T01:55:00', f: 100.4 }
];

const pathD = rawPoints.map((p, i) => `${i === 0 ? 'M' : 'L'} ${getX(p.t).toFixed(1)} ${getY(p.f).toFixed(1)}`).join(' ');

// Generate SVG markup
let svgContent = `
<svg viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg" style="width: 100%; height: 100%; font-family: -apple-system, sans-serif;">
  <!-- Zones -->
  <rect x="${margin.left}" y="${getY(104.0)}" width="${innerW}" height="${getY(102.0) - getY(104.0)}" fill="rgba(239, 68, 68, 0.08)" />
  <rect x="${margin.left}" y="${getY(102.0)}" width="${innerW}" height="${getY(100.4) - getY(102.0)}" fill="rgba(249, 115, 22, 0.06)" />
  <rect x="${margin.left}" y="${getY(100.4)}" width="${innerW}" height="${getY(99.0) - getY(100.4)}" fill="rgba(245, 158, 11, 0.05)" />
  <rect x="${margin.left}" y="${getY(99.0)}" width="${innerW}" height="${getY(97.0) - getY(99.0)}" fill="rgba(16, 185, 129, 0.05)" />

  <!-- 100.4F Threshold Line -->
  <line x1="${margin.left}" y1="${getY(100.4)}" x2="${margin.left + innerW}" y2="${getY(100.4)}" stroke="#e11d48" stroke-width="1.5" stroke-dasharray="4,4" />
  <text x="${margin.left + innerW - 8}" y="${getY(100.4) - 4}" fill="#e11d48" font-size="8.5" font-weight="bold" text-anchor="end">Fever Threshold: 100.4°F (38.0°C)</text>

  <!-- Left Y-Axis (F) -->
  ${[98, 100, 102, 104].map(val => `
    <line x1="${margin.left - 4}" y1="${getY(val)}" x2="${margin.left + innerW}" y2="${getY(val)}" stroke="#e2e8f0" stroke-width="0.8" />
    <text x="${margin.left - 6}" y="${getY(val) + 3}" fill="#64748b" font-size="8.5" text-anchor="end">${val}°F</text>
  `).join('')}
  <text transform="translate(14, ${margin.top + innerH / 2}) rotate(-90)" fill="#475569" font-size="9" font-weight="bold" text-anchor="middle">Temperature (°F)</text>

  <!-- Right Y-Axis (C) -->
  ${[36.0, 37.0, 38.0, 39.0, 40.0].map(c => {
    const f = (c * 9) / 5 + 32;
    return `
      <text x="${margin.left + innerW + 6}" y="${getY(f) + 3}" fill="#64748b" font-size="8.5" text-anchor="start">${c.toFixed(1)}°C</text>
    `;
  }).join('')}
  <text transform="translate(${width - 12}, ${margin.top + innerH / 2}) rotate(90)" fill="#475569" font-size="9" font-weight="bold" text-anchor="middle">Temperature (°C)</text>

  <!-- X-Axis Months -->
  ${['2026-06-01', '2026-07-01', '2026-08-01', '2026-09-01', '2026-10-01', '2026-11-01'].map(d => `
    <line x1="${getX(d)}" y1="${margin.top + innerH}" x2="${getX(d)}" y2="${margin.top + innerH + 4}" stroke="#94a3b8" />
    <text x="${getX(d)}" y="${margin.top + innerH + 14}" fill="#64748b" font-size="8" text-anchor="middle">${new Date(d).toLocaleDateString('en-US', { month: 'short', day: '2-digit' })}</text>
  `).join('')}
  <text x="${margin.left + innerW / 2}" y="${height - 2}" fill="#475569" font-size="9" font-weight="bold" text-anchor="middle">Observation Timeline (Date &amp; Time)</text>

  <!-- Trend Curve Line -->
  <path d="${pathD}" fill="none" stroke="#e11d48" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" />

  <!-- Data Points -->
  ${rawPoints.map(p => {
    const cx = getX(p.t);
    const cy = getY(p.f);
    const isHigh = p.f >= 100.4;
    return `
      <circle cx="${cx}" cy="${cy}" r="3.2" fill="${isHigh ? '#e11d48' : '#059669'}" stroke="#ffffff" stroke-width="1.5" />
      <text x="${cx}" y="${cy - 5}" fill="${isHigh ? '#be123c' : '#047857'}" font-size="7.5" font-weight="bold" text-anchor="middle">${p.f}°</text>
      ${p.rx ? `
        <rect x="${cx - 8}" y="${cy + 6}" width="16" height="12" rx="3" fill="#7c3aed" />
        <text x="${cx}" y="${cy + 15}" fill="#ffffff" font-size="7.5" font-weight="bold" text-anchor="middle">Rx</text>
      ` : ''}
    `;
  }).join('')}
</svg>
`;

const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Clinical Fever Report - Chinnathambi</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 8mm 10mm;
    }
    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    html, body {
      margin: 0;
      padding: 0;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      color: #0f172a;
      background: #ffffff;
      font-size: 10px;
      line-height: 1.35;
    }
    .report-header {
      border-bottom: 2px solid #0f172a;
      padding-bottom: 6px;
      margin-bottom: 8px;
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
    }
    .report-title {
      font-size: 15px;
      font-weight: 800;
      letter-spacing: -0.3px;
      margin: 0;
      color: #0f172a;
    }
    .report-subtitle {
      font-size: 9.5px;
      color: #64748b;
      margin: 2px 0 0 0;
    }
    .badge {
      display: inline-block;
      background: #0f172a;
      color: #ffffff;
      font-size: 8.5px;
      font-weight: 700;
      padding: 2px 6px;
      border-radius: 3px;
      text-transform: uppercase;
    }
    .print-date {
      font-size: 8.5px;
      color: #64748b;
      margin-top: 3px;
    }
    .demographics {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 8px;
      background: #f8fafc;
      border: 1px solid #cbd5e1;
      border-radius: 4px;
      padding: 6px 10px;
      margin-bottom: 8px;
    }
    .demo-label {
      font-size: 8px;
      text-transform: uppercase;
      font-weight: 700;
      color: #64748b;
      display: block;
    }
    .demo-val {
      font-size: 10.5px;
      font-weight: 700;
      color: #0f172a;
    }
    .allergies-val {
      color: #be123c;
    }
    .kpi-row {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 8px;
      margin-bottom: 8px;
      text-align: center;
    }
    .kpi-card {
      border: 1px solid #cbd5e1;
      border-radius: 4px;
      padding: 5px;
      background: #fafafa;
    }
    .kpi-title {
      font-size: 8px;
      font-weight: 700;
      text-transform: uppercase;
      color: #64748b;
    }
    .kpi-num {
      font-size: 13px;
      font-weight: 800;
      margin-top: 2px;
    }
    .kpi-peak { color: #e11d48; }
    .kpi-latest { color: #0f172a; }
    .kpi-count { color: #0f172a; }
    .kpi-rx { color: #7c3aed; }
    .chart-box {
      border: 1px solid #cbd5e1;
      border-radius: 4px;
      padding: 6px 8px;
      margin-bottom: 8px;
      background: #ffffff;
    }
    .chart-title-bar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 4px;
    }
    .chart-title {
      font-size: 9px;
      font-weight: 800;
      text-transform: uppercase;
      color: #334155;
      letter-spacing: 0.3px;
    }
    .chart-legend {
      font-size: 8px;
      color: #64748b;
    }
    .table-title {
      font-size: 9.5px;
      font-weight: 800;
      color: #0f172a;
      border-bottom: 1px solid #cbd5e1;
      padding-bottom: 3px;
      margin-bottom: 4px;
      text-transform: uppercase;
      letter-spacing: 0.2px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 8.5px;
      margin-bottom: 8px;
    }
    th, td {
      border: 1px solid #cbd5e1;
      padding: 3px 6px;
      text-align: left;
    }
    th {
      background: #f1f5f9;
      font-weight: 700;
      color: #1e293b;
    }
    td.temp-col {
      font-weight: 700;
      white-space: nowrap;
    }
    .temp-high { color: #e11d48; }
    .temp-normal { color: #059669; }
    .rx-text { color: #6b21a8; font-weight: 600; }
    .notes-text { color: #475569; }
    .doctor-box {
      border-top: 1px solid #94a3b8;
      padding-top: 6px;
      margin-top: 6px;
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
      font-size: 8.5px;
    }
    .doctor-line {
      height: 18px;
      border-bottom: 1px dashed #94a3b8;
      margin-top: 4px;
    }
  </style>
</head>
<body>
  <div class="report-header">
    <div>
      <h1 class="report-title">CLINICAL FEVER EPISODE &amp; TEMPERATURE REPORT</h1>
      <p class="report-subtitle">Family Circle Health Vault • Sovereign Health Record System</p>
    </div>
    <div style="text-align: right;">
      <span class="badge">CLINICAL REPORT</span>
      <div class="print-date">Printed: 09/11/2026, 04:38</div>
    </div>
  </div>

  <div class="demographics">
    <div><span class="demo-label">Patient Name</span><span class="demo-val">Chinnathambi</span></div>
    <div><span class="demo-label">Age / Gender</span><span class="demo-val">34 yrs • male</span></div>
    <div><span class="demo-label">Blood Group</span><span class="demo-val">O+</span></div>
    <div><span class="demo-label">Known Allergies</span><span class="demo-val allergies-val">Penicillin, Dust Mites</span></div>
  </div>

  <div class="kpi-row">
    <div class="kpi-card">
      <div class="kpi-title">Peak Recorded Temp</div>
      <div class="kpi-num kpi-peak">102.3°F / 39.1°C</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-title">Latest Reading</div>
      <div class="kpi-num kpi-latest">100.4°F / 38°C</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-title">Total Readings</div>
      <div class="kpi-num kpi-count">13</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-title">Medication Doses</div>
      <div class="kpi-num kpi-rx">1</div>
    </div>
  </div>

  <div class="chart-box">
    <div class="chart-title-bar">
      <span class="chart-title">Thermal Trend Curve &amp; Antipyretic Timeline</span>
      <span class="chart-legend">Red line = 100.4°F Fever Threshold • 'Rx' = Antipyretic Medication Administered</span>
    </div>
    <div style="width: 100%; height: 155px;">
      ${svgContent}
    </div>
  </div>

  <div class="table-title">Chronological Fever Log &amp; Antipyretic Administration</div>
  <table>
    <thead>
      <tr>
        <th>Date &amp; Time</th>
        <th>Fever Episode</th>
        <th>Temp (°F / °C)</th>
        <th>Site</th>
        <th>Classification</th>
        <th>Symptoms</th>
        <th>Antipyretic / Meds</th>
        <th>Caregiver Notes</th>
      </tr>
    </thead>
    <tbody>
      ${moments.map(m => `
        <tr>
          <td style="font-family: monospace; white-space: nowrap;">${m.formatted}</td>
          <td style="font-weight: 600; color: #334155;">${m.episode}</td>
          <td class="temp-col ${m.tempF >= 100.4 ? 'temp-high' : 'temp-normal'}">${m.tempF}°F (${m.tempC}°C)</td>
          <td style="text-transform: capitalize;">${m.site}</td>
          <td style="text-transform: capitalize; font-weight: 600;">${m.sev}</td>
          <td>${m.symptoms}</td>
          <td class="rx-text">${m.meds}</td>
          <td class="notes-text">${m.notes}</td>
        </tr>
      `).join('')}
    </tbody>
  </table>

  <div class="doctor-box">
    <div>
      <strong>Pediatrician / Physician Notes &amp; Assessment:</strong>
      <div class="doctor-line"></div>
    </div>
    <div style="text-align: right;">
      <strong>Consulting Physician Signature &amp; Stamp</strong>
      <div style="margin-top: 14px; color: #64748b;">Date: __________________________</div>
    </div>
  </div>
</body>
</html>`;

const tempHtml = path.join(__dirname, '..', 'public', 'Clinical_Fever_Report_Chinnathambi.html');
fs.writeFileSync(tempHtml, html, 'utf8');

const outputPdf1 = path.join(__dirname, '..', 'public', 'Clinical_Fever_Report_Chinnathambi.pdf');
const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

console.log('Rendering PDF with Microsoft Edge headless...');
execSync(`"${edgePath}" --headless=new --disable-gpu --no-pdf-header-footer --print-to-pdf="${outputPdf1}" "${tempHtml}"`, { stdio: 'inherit' });

console.log('PDF rendered successfully at:', outputPdf1);

