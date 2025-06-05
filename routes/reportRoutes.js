const express = require('express');
const router = express.Router();
const {
  getReportSummary,
  exportReportsToCSV
} = require('../controllers/reportController');

router.get('/', getReportSummary);
router.post('/export', exportReportsToCSV);

module.exports = router;
