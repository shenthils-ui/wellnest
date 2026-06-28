'use strict';

// Doctor report as a PDF: direct download, or upload to Google Drive.
const express = require('express');
const { isValidDate, todayStr, addDays } = require('../helpers');
const { generateReportPDF } = require('../report');
const drive = require('./drive');

const router = express.Router();

function range(req) {
  const to = isValidDate(req.query.to) ? req.query.to : todayStr();
  const from = isValidDate(req.query.from) ? req.query.from : addDays(to, -29);
  return { from, to };
}

// GET /api/report/pdf?from=&to=  -> download the PDF
router.get('/report/pdf', async (req, res) => {
  const { from, to } = range(req);
  try {
    const buf = await generateReportPDF(from, to);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="wellnest-report-${to}.pdf"`);
    res.send(buf);
  } catch (e) {
    res.status(500).json({ error: 'Could not build the report: ' + e.message });
  }
});

// POST /api/report/drive?from=&to=  -> generate the PDF and upload to Drive
router.post('/report/drive', async (req, res) => {
  const { from, to } = range(req);
  if (!drive.isDriveConnected()) return res.status(400).json({ error: 'not connected' });
  try {
    const buf = await generateReportPDF(from, to);
    const j = await drive.uploadFileToDrive(`wellnest-report-${to}.pdf`, 'application/pdf', buf);
    res.json({ ok: true, name: j.name, link: j.webViewLink });
  } catch (e) {
    res.status(502).json({ error: e.message });
  }
});

module.exports = router;
