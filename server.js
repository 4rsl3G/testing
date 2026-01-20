// ============================================
// FILE: server.js
// ============================================
const express = require(‘express’);
const cors = require(‘cors’);
const helmet = require(‘helmet’);
const rateLimit = require(‘express-rate-limit’);
require(‘dotenv’).config();

const authRoutes = require(’./routes/auth’);
const transactionRoutes = require(’./routes/transactions’);
const { errorHandler } = require(’./middleware/errorHandler’);

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(helmet());
app.use(cors({
origin: process.env.FRONTEND_URL || ‘http://localhost:3000’,
credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Rate limiting
const limiter = rateLimit({
windowMs: 15 * 60 * 1000, // 15 menit
max: 100, // limit 100 request per windowMs
message: ‘Terlalu banyak request dari IP ini, coba lagi nanti.’
});
app.use(limiter);

// Routes
app.use(’/api/auth’, authRoutes);
app.use(’/api/transactions’, transactionRoutes);

// Health check
app.get(’/health’, (req, res) => {
res.json({ status: ‘OK’, timestamp: new Date().toISOString() });
});

// Error handler
app.use(errorHandler);

// 404 handler
app.use((req, res) => {
res.status(404).json({
success: false,
message: ‘Endpoint tidak ditemukan’
});
});

app.listen(PORT, () => {
console.log(`🚀 Server berjalan di port ${PORT}`);
console.log(`📡 Environment: ${process.env.NODE_ENV || 'development'}`);
});
