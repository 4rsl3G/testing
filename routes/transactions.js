// ============================================
// FILE: routes/transactions.js
// ============================================
const express = require(‘express’);
const router = express.Router();
const gobizService = require(’../services/GoBizService’);
const { asyncHandler } = require(’../middleware/errorHandler’);
const { authenticateUser } = require(’../middleware/auth’);

// GET /api/transactions/today
router.get(’/today’, authenticateUser, asyncHandler(async (req, res) => {
const { userId, merchantId } = req.query;

if (!merchantId) {
return res.status(400).json({
success: false,
message: ‘merchantId diperlukan’
});
}

const today = new Date();
const startOfDay = new Date(today.setHours(0, 0, 0, 0)).toISOString();
const endOfDay = new Date(today.setHours(23, 59, 59, 999)).toISOString();

const result = await gobizService.searchJournals(
userId,
merchantId,
startOfDay,
endOfDay
);

// Hitung total amount
const totalAmount = result.results?.reduce((sum, transaction) => {
return sum + (transaction.metadata?.transaction?.gross_amount || 0);
}, 0) || 0;

res.json({
success: true,
message: ‘Data transaksi hari ini berhasil diambil’,
data: {
total: result.total || 0,
totalAmount: totalAmount,
transactions: result.results || []
}
});
}));

// GET /api/transactions/search
router.get(’/search’, authenticateUser, asyncHandler(async (req, res) => {
const { userId, merchantId, startDate, endDate, page = 1, limit = 20 } = req.query;

if (!merchantId || !startDate || !endDate) {
return res.status(400).json({
success: false,
message: ‘merchantId, startDate, dan endDate diperlukan’
});
}

const fromDate = new Date(startDate).toISOString();
const toDate = new Date(endDate).toISOString();
const from = (parseInt(page) - 1) * parseInt(limit);

const result = await gobizService.searchJournals(
userId,
merchantId,
fromDate,
toDate,
{
from: from,
size: parseInt(limit)
}
);

const totalAmount = result.results?.reduce((sum, transaction) => {
return sum + (transaction.metadata?.transaction?.gross_amount || 0);
}, 0) || 0;

res.json({
success: true,
message: ‘Data transaksi berhasil diambil’,
data: {
total: result.total || 0,
totalAmount: totalAmount,
page: parseInt(page),
limit: parseInt(limit),
totalPages: Math.ceil((result.total || 0) / parseInt(limit)),
transactions: result.results || []
}
});
}));

// GET /api/transactions/summary
router.get(’/summary’, authenticateUser, asyncHandler(async (req, res) => {
const { userId, merchantId, startDate, endDate } = req.query;

if (!merchantId || !startDate || !endDate) {
return res.status(400).json({
success: false,
message: ‘merchantId, startDate, dan endDate diperlukan’
});
}

const fromDate = new Date(startDate).toISOString();
const toDate = new Date(endDate).toISOString();

// Ambil semua transaksi dengan pagination
let allTransactions = [];
let page = 0;
const limit = 100;
let total = 0;

do {
const result = await gobizService.searchJournals(
userId,
merchantId,
fromDate,
toDate,
{
from: page * limit,
size: limit
}
);


allTransactions = allTransactions.concat(result.results || []);
total = result.total || 0;
page++;

} while (allTransactions.length < total);

// Hitung summary
const summary = {
totalTransactions: total,
totalAmount: 0,
byPaymentType: {},
byStatus: {},
transactions: allTransactions
};

allTransactions.forEach(transaction => {
const metadata = transaction.metadata?.transaction;
if (!metadata) return;


const amount = metadata.gross_amount || 0;
const paymentType = metadata.payment_type || 'unknown';
const status = metadata.status || 'unknown';

summary.totalAmount += amount;

if (!summary.byPaymentType[paymentType]) {
  summary.byPaymentType[paymentType] = { count: 0, amount: 0 };
}
summary.byPaymentType[paymentType].count++;
summary.byPaymentType[paymentType].amount += amount;

if (!summary.byStatus[status]) {
  summary.byStatus[status] = { count: 0, amount: 0 };
}
summary.byStatus[status].count++;
summary.byStatus[status].amount += amount;


});

res.json({
success: true,
message: ‘Summary transaksi berhasil diambil’,
data: summary
});
}));

module.exports = router;
