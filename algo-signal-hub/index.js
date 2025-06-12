const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.get('/', (req, res) => {
    res.json({ 
        message: '🚀 Algo Signal Hub is running!',
        status: 'healthy',
        timestamp: new Date().toISOString()
    });
});

app.get('/health', (req, res) => {
    res.json({ status: 'healthy' });
});

// API for MT5 - Get pending signals
app.get('/api/signals/pending', (req, res) => {
    res.json({
        success: true,
        signals: [],
        message: 'No pending signals (ready for MT5 connection)'
    });
});

// API for MT5 - Create new signal
app.post('/api/signals', (req, res) => {
    console.log('📈 Signal received from MT5:', req.body);
    res.json({
        success: true,
        message: 'Signal received successfully',
        data: req.body,
        timestamp: new Date().toISOString()
    });
});

// Start server
app.listen(PORT, () => {
    console.log(`🚀 Algo Signal Hub running on port ${PORT}`);
});
