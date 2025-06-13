const express = require('express');
const cors = require('cors');
const { 
  createTables, 
  getPendingSignals, 
  addSignal, 
  updateSignalStatus, 
  getAllSignals 
} = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Initialize database on startup
createTables();

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    version: '2.0.0'
  });
});

// Get pending signals (for MT5)
app.get('/api/signals/pending', async (req, res) => {
  try {
    const signals = await getPendingSignals();
    res.json({
      success: true,
      signals: signals,
      message: signals.length > 0 
        ? `${signals.length} pending signal(s) found` 
        : "No pending signals (ready for MT5 connection)"
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      signals: [],
      message: "Error retrieving signals",
      error: error.message
    });
  }
});

// Add new signal
app.post('/api/signals', async (req, res) => {
  try {
    const { symbol, action, volume, price, stop_loss, take_profit } = req.body;
    
    // Validation
    if (!symbol || !action || !volume) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields: symbol, action, volume"
      });
    }

    if (!['BUY', 'SELL'].includes(action.toUpperCase())) {
      return res.status(400).json({
        success: false,
        message: "Action must be 'BUY' or 'SELL'"
      });
    }

    const signal = {
      symbol: symbol.toUpperCase(),
      action: action.toUpperCase(),
      volume: parseFloat(volume),
      price: price ? parseFloat(price) : null,
      stop_loss: stop_loss ? parseFloat(stop_loss) : null,
      take_profit: take_profit ? parseFloat(take_profit) : null
    };

    const newSignal = await addSignal(signal);
    
    res.status(201).json({
      success: true,
      signal: newSignal,
      message: `${action.toUpperCase()} signal created for ${symbol.toUpperCase()}`
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error creating signal",
      error: error.message
    });
  }
});

// Update signal status (for MT5 to mark as executed)
app.patch('/api/signals/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!['pending', 'executed', 'cancelled'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Status must be 'pending', 'executed', or 'cancelled'"
      });
    }

    const updatedSignal = await updateSignalStatus(parseInt(id), status);
    
    if (!updatedSignal) {
      return res.status(404).json({
        success: false,
        message: "Signal not found"
      });
    }

    res.json({
      success: true,
      signal: updatedSignal,
      message: `Signal ${id} marked as ${status}`
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error updating signal",
      error: error.message
    });
  }
});

// Get all signals (for dashboard)
app.get('/api/signals', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const offset = parseInt(req.query.offset) || 0;
    
    const signals = await getAllSignals(limit, offset);
    
    res.json({
      success: true,
      signals: signals,
      count: signals.length,
      message: `Retrieved ${signals.length} signals`
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      signals: [],
      message: "Error retrieving signals",
      error: error.message
    });
  }
});

// Get signal statistics
app.get('/api/signals/stats', async (req, res) => {
  try {
    const { pool } = require('./database');
    
    const result = await pool.query(`
      SELECT 
        COUNT(*) as total_signals,
        COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_signals,
        COUNT(CASE WHEN status = 'executed' THEN 1 END) as executed_signals,
        COUNT(CASE WHEN status = 'cancelled' THEN 1 END) as cancelled_signals,
        COUNT(CASE WHEN action = 'BUY' THEN 1 END) as buy_signals,
        COUNT(CASE WHEN action = 'SELL' THEN 1 END) as sell_signals
      FROM signals
    `);
    
    res.json({
      success: true,
      stats: result.rows[0],
      message: "Statistics retrieved successfully"
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error retrieving statistics",
      error: error.message
    });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Trading Signals API running on port ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
  console.log(`📡 Pending signals: http://localhost:${PORT}/api/signals/pending`);
});
