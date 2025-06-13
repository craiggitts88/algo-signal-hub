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

// === NEW MT5 ENDPOINTS (FIXES FOR YOUR EA) ===

// Receive trades from MT5 (what your EA expects)
app.post('/api/trades', async (req, res) => {
    try {
        console.log('📈 Received trade data from MT5:', req.body);
        
        // Convert MT5 trade format to signal format
        const signalData = {
            account_id: req.body.account_id || req.body.accountId || 'MT5_Account',
            symbol: req.body.symbol || 'UNKNOWN',
            action: req.body.action || req.body.type || 'buy',
            volume: req.body.volume || req.body.lots || 0.01,
            entry_price: req.body.entry_price || req.body.openPrice || 0,
            current_price: req.body.current_price || req.body.currentPrice || req.body.entry_price || 0,
            stop_loss: req.body.stop_loss || req.body.sl || 0,
            take_profit: req.body.take_profit || req.body.tp || 0,
            profit_loss: req.body.profit_loss || req.body.profit || 0,
            status: req.body.status || 'open',
            strategy: req.body.strategy || 'MT5_Strategy',
            trade_id: req.body.trade_id || req.body.ticket,
            comment: req.body.comment || ''
        };

        // Store as signal in your existing database
        const signal = await createSignal(signalData);
        
        res.json({ 
            success: true, 
            message: 'Trade data received and stored',
            signal_id: signal.id,
            data_received: req.body
        });
    } catch (error) {
        console.error('❌ Error processing trade:', error);
        res.status(500).json({ 
            success: false, 
            message: error.message,
            error_details: error.toString()
        });
    }
});

// Receive account data from MT5 (what your EA expects)
app.post('/api/accounts', async (req, res) => {
    try {
        console.log('💰 Received account data from MT5:', req.body);
        
        // Format account data for your existing system
        const accountData = {
            account_id: req.body.account_id || req.body.accountId || 'MT5_Account',
            account_name: req.body.account_name || req.body.name || 'MT5 Trading Account',
            balance: req.body.balance || 0,
            equity: req.body.equity || req.body.balance || 0,
            margin: req.body.margin || 0,
            free_margin: req.body.free_margin || req.body.freeMargin || 0,
            margin_level: req.body.margin_level || req.body.marginLevel || 0,
            profit: req.body.profit || 0,
            server: req.body.server || 'MT5-Server',
            currency: req.body.currency || 'USD',
            leverage: req.body.leverage || 100,
            company: req.body.company || 'MT5 Broker'
        };

        // Use existing register endpoint logic
        const account = await registerDemoAccount(accountData);
        
        res.json({ 
            success: true, 
            message: 'Account data received and registered',
            account,
            data_received: req.body
        });
    } catch (error) {
        console.error('❌ Error processing account:', error);
        res.status(500).json({ 
            success: false, 
            message: error.message,
            error_details: error.toString()
        });
    }
});

// Get trades for dashboard (frontend needs this)
app.get('/api/trades', async (req, res) => {
    try {
        console.log('📊 Dashboard requesting trades data...');
        
        // Get all signals from database
        const signals = await getTopPerformingSignals(1000); // Get all signals
        
        // Convert signals to trade format for dashboard
        const trades = signals.map(signal => ({
            id: signal.id,
            account_id: signal.account_id,
            symbol: signal.symbol,
            action: signal.action,
            volume: signal.volume,
            entry_price: signal.entry_price,
            current_price: signal.current_price,
            profit_loss: signal.profit_loss,
            status: signal.status,
            strategy: signal.strategy || 'Unknown',
            open_time: signal.created_at,
            close_time: signal.close_time,
            stop_loss: signal.stop_loss,
            take_profit: signal.take_profit,
            trade_id: signal.trade_id,
            comment: signal.comment || ''
        }));
        
        console.log(`📈 Returning ${trades.length} trades to dashboard`);
        
        res.json({ 
            success: true, 
            trades,
            total: trades.length,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('❌ Error fetching trades for dashboard:', error);
        res.status(500).json({ 
            success: false, 
            message: error.message,
            error_details: error.toString()
        });
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

// === WEBHOOK ENDPOINT FOR MT4/MT5 (Alternative endpoint) ===
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

        res.json({ success: true, message: 'Trade data received via webhook' });
    } catch (error) {
        console.error('Webhook error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// === DEBUG & HEALTH ENDPOINTS ===

// Debug endpoint to see what data is being sent
app.post('/api/debug', (req, res) => {
    console.log('🔍 DEBUG - Received data:', JSON.stringify(req.body, null, 2));
    console.log('🔍 DEBUG - Headers:', req.headers);
    res.json({ 
        success: true, 
        message: 'Debug data logged',
        received_data: req.body,
        headers: req.headers,
        timestamp: new Date().toISOString()
    });
});

// Health check
app.get('/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        timestamp: new Date().toISOString(),
        service: 'Copy Trading Signal Hub',
        endpoints: {
            'POST /api/trades': 'Receive MT5 trades',
            'GET /api/trades': 'Get trades for dashboard',
            'POST /api/accounts': 'Receive MT5 account data',
            'GET /api/accounts': 'Get all accounts',
            'POST /api/signals': 'Create signals',
            'GET /api/signals/top': 'Get top signals',
            'POST /api/webhook/trade': 'Webhook for trades',
            'POST /api/debug': 'Debug endpoint'
        }
    });
});

// Catch-all for undefined routes
app.use('*', (req, res) => {
    console.log(`❌ 404 - Route not found: ${req.method} ${req.originalUrl}`);
    res.status(404).json({
        success: false,
        message: 'Route not found',
        method: req.method,
        url: req.originalUrl,
        available_endpoints: [
            'GET /',
            'GET /health',
            'POST /api/trades',
            'GET /api/trades',
            'POST /api/accounts',
            'GET /api/accounts',
            'POST /api/signals',
            'GET /api/signals/top',
            'POST /api/webhook/trade',
            'POST /api/debug'
        ]
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
    console.log(`🔍 Debug: http://localhost:${PORT}/api/debug`);
    console.log(`💚 Health: http://localhost:${PORT}/health`);
    console.log('');
    console.log('📋 Available MT5 Endpoints:');
    console.log('   POST /api/trades     - Receive trade data from MT5');
    console.log('   POST /api/accounts   - Receive account data from MT5');
    console.log('   GET  /api/trades     - Dashboard gets trade data');
    console.log('   POST /api/debug      - Debug any data issues');
});
