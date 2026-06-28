'use strict';

// Builds the doctor report as a real PDF (pdfkit), reusing the same insights
// endpoints the on-screen report uses, so the two always match. Used for direct
// download and for sending to Google Drive.
const PDFDocument = require('pdfkit');

const PORT = parseInt(process.env.PORT, 10) || 3001;
const BASE = `http://127.0.0.1:${PORT}/api`;

async function fetchJson(path) {
  const r = await fetch(BASE + path);
  if (!r.ok) throw new Error(`${path} -> ${r.status}`);
  return r.json();
}

function fmtDate(iso) {
  if (!iso) return '';
  const d = new Date(iso.slice(0, 10) + 'T00:00:00');
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

async function buildReportData(from, to) {
  const [overview, activities, symptoms, therapyLogs, trackerSummary, therapies] = await Promise.all([
    fetchJson(`/insights/overview?from=${from}&to=${to}`),
    fetchJson(`/insights/activities?from=${from}&to=${to}`),
    fetchJson(`/insights/symptoms?from=${from}&to=${to}`),
    fetchJson(`/therapy-logs?from=${from}&to=${to}`),
    fetchJson(`/insights/tracker-summary?from=${from}&to=${to}`),
    fetchJson(`/therapies`),
  ]);
  const therapyCounts = {};
  (therapyLogs || []).forEach((r) => { therapyCounts[r.therapy_id] = (therapyCounts[r.therapy_id] || 0) + 1; });
  return {
    overview,
    activities: (activities.activities || []).filter((a) => a.expected > 0),
    symptoms: symptoms.metrics || [],
    trackers: trackerSummary.trackers || [],
    therapies,
    therapyCounts,
  };
}

const X = 40;
const W = 515;
const PALETTE = ['#4d8a6e', '#e16a6a', '#5b8def', '#e6b853', '#9b6dd6', '#46b1a8'];

function heading(doc, text) {
  if (doc.y > 740) doc.addPage();
  doc.moveDown(0.8);
  doc.font('Helvetica-Bold').fontSize(13).fillColor('#111827').text(text, X);
  doc.moveDown(0.3);
}

function tableRow(doc, cells, layout, bold) {
  if (doc.y > 770) doc.addPage();
  const y = doc.y;
  let h = 0;
  layout.forEach((col, i) => {
    doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(9).fillColor(bold ? '#6b7280' : '#111827');
    const text = cells[i] == null ? '' : String(cells[i]);
    h = Math.max(h, doc.heightOfString(text, { width: col.w }));
    doc.text(text, col.x, y, { width: col.w, align: col.align || 'left' });
  });
  doc.y = y + h + 5;
  doc.strokeColor('#eef0f2').lineWidth(0.5).moveTo(X, doc.y - 2).lineTo(X + W, doc.y - 2).stroke();
}

function drawChart(doc, symptoms) {
  const dates = [...new Set(symptoms.flatMap((m) => (m.series || []).map((s) => s.date)))].sort();
  if (dates.length < 2) {
    doc.font('Helvetica').fontSize(9).fillColor('#9ca3af').text('Not enough symptom data to chart yet.', X);
    return;
  }
  const x0 = X + 18, w = W - 18, h = 140, y0 = doc.y;
  const xFor = (d) => x0 + (dates.indexOf(d) / (dates.length - 1)) * w;
  const yFor = (v) => y0 + h - (v / 10) * h;
  [0, 5, 10].forEach((v) => {
    doc.strokeColor('#eef0f2').lineWidth(0.5).moveTo(x0, yFor(v)).lineTo(x0 + w, yFor(v)).stroke();
    doc.font('Helvetica').fontSize(7).fillColor('#9ca3af').text(String(v), X, yFor(v) - 4, { width: 14, align: 'right' });
  });
  symptoms.forEach((m, mi) => {
    const pts = (m.series || []).filter((s) => s.value != null);
    if (pts.length < 2) return;
    doc.strokeColor(PALETTE[mi % PALETTE.length]).lineWidth(1);
    pts.forEach((s, i) => { const px = xFor(s.date), py = yFor(s.value); i === 0 ? doc.moveTo(px, py) : doc.lineTo(px, py); });
    doc.stroke();
  });
  doc.y = y0 + h + 8;
  // legend
  const ly = doc.y;
  let lx = X;
  symptoms.forEach((m, mi) => {
    if (!(m.series || []).some((s) => s.value != null)) return;
    doc.rect(lx, ly + 1, 8, 8).fill(PALETTE[mi % PALETTE.length]);
    doc.font('Helvetica').fontSize(8).fillColor('#374151').text(m.name, lx + 11, ly, { lineBreak: false });
    lx += 11 + doc.widthOfString(m.name) + 16;
  });
  doc.y = ly + 16;
}

function renderReport(doc, d, from, to) {
  doc.font('Helvetica-Bold').fontSize(20).fillColor('#3c6f59').text('WellNest — Health Summary', X, 40);
  doc.font('Helvetica').fontSize(10).fillColor('#6b7280')
    .text(`${fmtDate(from)} – ${fmtDate(to)}  ·  generated ${fmtDate(new Date().toISOString())}`);
  doc.moveDown(0.4);
  doc.strokeColor('#e5e7eb').lineWidth(1).moveTo(X, doc.y).lineTo(X + W, doc.y).stroke();

  // Overview
  heading(doc, 'Overview');
  const ov = d.overview || {};
  doc.font('Helvetica').fontSize(10).fillColor('#111827').text(
    `Days logged: ${ov.daysLogged ?? '–'}        ` +
    `Avg. routine completion: ${ov.avgCompletion != null ? ov.avgCompletion + '%' : '–'}        ` +
    `Activities tracked: ${d.activities.length}`, X);

  // Symptom averages
  heading(doc, 'Symptom averages (1–10)');
  const symLayout = [
    { x: X, w: 200 }, { x: X + 200, w: 105, align: 'center' },
    { x: X + 305, w: 105, align: 'center' }, { x: X + 410, w: 105, align: 'center' },
  ];
  tableRow(doc, ['Symptom', 'Average', 'Range', 'Days'], symLayout, true);
  d.symptoms.forEach((m) => {
    tableRow(doc, [
      `${m.name} (${m.good_direction === 'low' ? 'lower better' : 'higher better'})`,
      m.average ?? '–',
      m.min != null ? `${m.min}–${m.max}` : '–',
      m.daysLogged,
    ], symLayout);
  });

  // Trend chart
  heading(doc, 'Symptom trends');
  drawChart(doc, d.symptoms);

  // Routine adherence
  heading(doc, 'Routine adherence');
  const actLayout = [
    { x: X, w: 235 }, { x: X + 235, w: 70, align: 'center' }, { x: X + 305, w: 70, align: 'center' },
    { x: X + 375, w: 70, align: 'center' }, { x: X + 445, w: 70, align: 'center' },
  ];
  tableRow(doc, ['Activity', 'Done', 'Tired', 'Missed', '%'], actLayout, true);
  d.activities.forEach((a) => {
    tableRow(doc, [a.name, a.done, a.tired, a.forgot, a.completionPct ?? '–'], actLayout);
  });

  // Food & lifestyle + Mood & body
  const foodT = d.trackers.filter((t) => t.section === 'food' && t.options.length);
  const feelT = d.trackers.filter((t) => t.section === 'feeling' && t.options.length);
  const renderTrackers = (title, list) => {
    if (!list.length) return;
    heading(doc, title);
    list.forEach((t) => {
      if (doc.y > 760) doc.addPage();
      doc.font('Helvetica-Bold').fontSize(10).fillColor('#374151').text(`${t.name}  `, X, doc.y, { continued: true });
      doc.font('Helvetica').fontSize(9).fillColor('#6b7280').text(`(${t.daysLogged} days)`);
      doc.font('Helvetica').fontSize(9).fillColor('#111827')
        .text(t.options.map((o) => `${o.label} · ${o.days}`).join('   ·   '), X, doc.y, { width: W });
      doc.moveDown(0.4);
    });
  };
  renderTrackers('Food & lifestyle', foodT);
  renderTrackers('Mood & body', feelT);

  // Therapies
  if ((d.therapies || []).length) {
    heading(doc, 'Therapies completed');
    d.therapies.forEach((t) => {
      doc.font('Helvetica').fontSize(10).fillColor('#111827')
        .text(`${t.name}: ${d.therapyCounts[t.id] || 0}×`, X);
    });
  }

  doc.moveDown(1);
  doc.strokeColor('#e5e7eb').lineWidth(0.5).moveTo(X, doc.y).lineTo(X + W, doc.y).stroke();
  doc.moveDown(0.4);
  doc.font('Helvetica').fontSize(8).fillColor('#9ca3af').text(
    'Generated by WellNest. Symptom values are self-reported on a 1–10 scale and averaged per day. ' +
    'Any associations shown elsewhere in the app are observational, not medical conclusions.', X, doc.y, { width: W });
}

function generateReportPDF(from, to) {
  return buildReportData(from, to).then(
    (d) =>
      new Promise((resolve, reject) => {
        const doc = new PDFDocument({ margin: 40, size: 'A4' });
        const chunks = [];
        doc.on('data', (c) => chunks.push(c));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);
        try { renderReport(doc, d, from, to); doc.end(); } catch (e) { reject(e); }
      })
  );
}

module.exports = { generateReportPDF };
