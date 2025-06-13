const express = require('express');
const cors = require('cors');
const path = require('path');
const cron = require('node-cron');
const { 
    initializeDatabase,
    registerDemoAccount,
    updateAccountStats,
    getAllDemoAccounts,
    createSignal,
    updateSignal,
    getTopPerformingSignals,
    copySignalToMaster,
    getMasterTrades
} = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Initialize database
initializeDatabase().catch(console.error);

// Routes
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// === DEMO ACCOUNT ENDPOINTS ===

// Register/Update demo account
app.post('/api/accounts/register', async (req, res) => {
    try {
        const account = await registerDemoAccount(req.body);
        res.json({ success: true, account });
    } catch (error) {
        console.error('Error registering account:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// Update account statistics
app.put('/api/accounts/:accountId/stats', async (req, res) => {
    try {
        const { accountId } = req.params;
        await updateAccountStats(accountId, req.body);
        res.json({ success: true, message: 'Account stats updated' });
    } catch (error) {
        console.error('Error updating account stats:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// Get all demo accounts with performance
app.get('/api/accounts', async (req, res) => {
    try {
        const accounts = await getAllDemoAccounts();
        res.json({ success: true, accounts });
    } catch (error) {
        console.error('Error fetching accounts:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// === SIGNAL ENDPOINTS ===

// Receive new signal from demo account
app.post('/api/signals', async (req, res) => {
    try {
        const signal = await createSignal(req.body);
        res.json({ success: true, signal });
    } catch (error) {
        console.error('Error creating signal:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// Update existing signal (price, P&L, status)
app.put('/api/signals/:id', async (req, res) => {
    try {
        const { id } = req.params;
        await updateSignal(id, req.body);
        res.json({ success: true, message: 'Signal updated' });
    } catch (error) {
        console.error('Error updating signal:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// Get top performing signals for dashboard
app.get('/api/signals/top', async (req, res) => {
    try {
        const limit = req.query.limit || 50;
        const signals = await getTopPerformingSignals(limit);
        res.json({ success: true, signals });
    } catch (error) {
        console.error('Error fetching top signals:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// === COPY TRADING ENDPOINTS ===

// Copy signal to master account
app.post('/api/copy/:signalId', async (req, res) => {
    try {
        const { signalId } = req.params;
        const { volume_multiplier = 1 } = req.body;
        
        const result = await copySignalToMaster(signalId, volume_multiplier);
        res.json({ success: true, result });
    } catch (error) {
        console.error('Error copying signal:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// Get master account trades
app.get('/api/master/trades', async (req, res) => {
    try {
        const trades = await getMasterTrades();
        res.json({ success: true, trades });
    } catch (error) {
        console.error('Error fetching master trades:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// === WEBHOOK ENDPOINT FOR MT4/MT5 ===
app.post('/api/webhook/trade', async (req, res) => {
    try {
        const { 
            account_id, 
            symbol, 
            action, 
            volume, 
            entry_price, 
            current_price,
            stop_loss, 
            take_profit, 
            profit_loss,
            status = 'open',
            trade_id 
        } = req.body;

        // If trade_id exists, update existing signal
        if (trade_id) {
            await updateSignal(trade_id, {
                current_price,
                profit_loss,
                status,
                close_time: status === 'closed' ? new Date().toISOString() : null
            });
        } else {
            // Create new signal
            await createSignal({
                account_id,
                symbol,
                action,
                volume,
                entry_price,
                stop_loss,
                take_profit
            });
        }

        res.json({ success: true, message: 'Trade data received' });
    } catch (error) {
        console.error('Webhook error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// Health check
app.get('/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        timestamp: new Date().toISOString(),
        service: 'Copy Trading Signal Hub'
    });
});

// Auto-cleanup old signals (run daily at 2 AM)
cron.schedule('0 2 * * *', () => {
    console.log('🧹 Running daily cleanup...');
    // Add cleanup logic here if needed
});

// Start server
app.listen(PORT, () => {
    console.log(`🚀 Copy Trading Signal Hub running on port ${PORT}`);
    console.log(`📊 Dashboard: http://localhost:${PORT}`);
    console.log(`🔗 API: http://localhost:${PORT}/api`);
    console.log(`📡 Webhook: http://localhost:${PORT}/api/webhook/trade`);
});
