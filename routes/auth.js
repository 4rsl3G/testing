// ============================================
// FILE: routes/auth.js
// ============================================
const express = require(‘express’);
const router = express.Router();
const gobizService = require(’../services/GoBizService’);
const { asyncHandler } = require(’../middleware/errorHandler’);
const { validateLogin } = require(’../middleware/validation’);

// POST /api/auth/login
router.post(’/login’, validateLogin, asyncHandler(async (req, res) => {
const { email, password, merchantId } = req.body;

// Generate userId dari email (bisa diganti dengan system session Anda)
const userId = Buffer.from(email).toString(‘base64’);

const result = await gobizService.login(userId, email, password);

// Simpan merchantId ke session jika disediakan
const session = gobizService.getSession(userId);
if (merchantId) {
session.merchantId = merchantId;
}

res.json({
success: true,
message: ‘Login berhasil’,
data: {
userId: userId,
accessToken: result.accessToken,
refreshToken: result.refreshToken,
expiresIn: result.expiresIn,
merchantId: merchantId || null
}
});
}));

// POST /api/auth/refresh
router.post(’/refresh’, asyncHandler(async (req, res) => {
const { userId } = req.body;

if (!userId) {
return res.status(400).json({
success: false,
message: ‘userId diperlukan’
});
}

const result = await gobizService.refreshAccessToken(userId);

res.json({
success: true,
message: ‘Token berhasil direfresh’,
data: result
});
}));

// POST /api/auth/logout
router.post(’/logout’, asyncHandler(async (req, res) => {
const { userId } = req.body;

if (userId) {
gobizService.deleteSession(userId);
}

res.json({
success: true,
message: ‘Logout berhasil’
});
}));

module.exports = router;
