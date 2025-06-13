const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Create signals table
const createTables = async () => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS signals (
        id SERIAL PRIMARY KEY,
        symbol VARCHAR(20) NOT NULL,
        action VARCHAR(10) NOT NULL CHECK (action IN ('BUY', 'SELL')),
        volume DECIMAL(10,2) NOT NULL,
        price DECIMAL(10,5),
        stop_loss DECIMAL(10,5),
        take_profit DECIMAL(10,5),
        status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'executed', 'cancelled')),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        executed_at TIMESTAMP
      )
    `);
    console.log('✅ Database tables created successfully');
  } catch (error) {
    console.error('❌ Database error:', error);
  }
};

// Get all pending signals
const getPendingSignals = async () => {
  try {
    const result = await pool.query(
      'SELECT * FROM signals WHERE status = $1 ORDER BY created_at DESC',
      ['pending']
    );
    return result.rows;
  } catch (error) {
    console.error('❌ Error getting pending signals:', error);
    return [];
  }
};

// Add new signal
const addSignal = async (signal) => {
  try {
    const result = await pool.query(
      `INSERT INTO signals (symbol, action, volume, price, stop_loss, take_profit) 
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [signal.symbol, signal.action, signal.volume, signal.price, signal.stop_loss, signal.take_profit]
    );
    return result.rows[0];
  } catch (error) {
    console.error('❌ Error adding signal:', error);
    throw error;
  }
};

// Update signal status
const updateSignalStatus = async (id, status) => {
  try {
    const result = await pool.query(
      'UPDATE signals SET status = $1, executed_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *',
      [status, id]
    );
    return result.rows[0];
  } catch (error) {
    console.error('❌ Error updating signal:', error);
    throw error;
  }
};

// Get all signals with pagination
const getAllSignals = async (limit = 50, offset = 0) => {
  try {
    const result = await pool.query(
      'SELECT * FROM signals ORDER BY created_at DESC LIMIT $1 OFFSET $2',
      [limit, offset]
    );
    return result.rows;
  } catch (error) {
    console.error('❌ Error getting all signals:', error);
    return [];
  }
};

module.exports = {
  pool,
  createTables,
  getPendingSignals,
  addSignal,
  updateSignalStatus,
  getAllSignals
};
