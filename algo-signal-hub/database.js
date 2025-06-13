const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'signals.db');
const db = new sqlite3.Database(dbPath);

function initializeDatabase() {
    return new Promise((resolve, reject) => {
        db.serialize(() => {
            // Demo accounts table
            db.run(`
                CREATE TABLE IF NOT EXISTS demo_accounts (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    account_id TEXT UNIQUE NOT NULL,
                    account_name TEXT NOT NULL,
                    broker TEXT,
                    balance REAL DEFAULT 10000,
                    equity REAL DEFAULT 10000,
                    profit_loss REAL DEFAULT 0,
                    win_rate REAL DEFAULT 0,
                    total_trades INTEGER DEFAULT 0,
                    winning_trades INTEGER DEFAULT 0,
                    is_active BOOLEAN DEFAULT 1,
                    performance_score REAL DEFAULT 0,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            `);

            // Signals/Trades table
            db.run(`
                CREATE TABLE IF NOT EXISTS signals (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    account_id TEXT NOT NULL,
                    symbol TEXT NOT NULL,
                    action TEXT NOT NULL CHECK(action IN ('BUY', 'SELL')),
                    volume REAL NOT NULL,
                    entry_price REAL,
                    current_price REAL,
                    stop_loss REAL,
                    take_profit REAL,
                    profit_loss REAL DEFAULT 0,
                    status TEXT DEFAULT 'open' CHECK(status IN ('open', 'closed', 'pending')),
                    open_time DATETIME DEFAULT CURRENT_TIMESTAMP,
                    close_time DATETIME,
                    duration_minutes INTEGER,
                    is_copied BOOLEAN DEFAULT 0,
                    copy_time DATETIME,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (account_id) REFERENCES demo_accounts (account_id)
                )
            `);

            // Master account trades (copied trades)
            db.run(`
                CREATE TABLE IF NOT EXISTS master_trades (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    original_signal_id INTEGER,
                    symbol TEXT NOT NULL,
                    action TEXT NOT NULL,
                    volume REAL NOT NULL,
                    entry_price REAL,
                    current_price REAL,
                    stop_loss REAL,
                    take_profit REAL,
                    profit_loss REAL DEFAULT 0,
                    status TEXT DEFAULT 'open',
                    copied_from_account TEXT,
                    open_time DATETIME DEFAULT CURRENT_TIMESTAMP,
                    close_time DATETIME,
                    FOREIGN KEY (original_signal_id) REFERENCES signals (id)
                )
            `, (err) => {
                if (err) {
                    console.error('Error creating tables:', err);
                    reject(err);
                } else {
                    console.log('✅ Database initialized successfully');
                    resolve();
                }
            });
        });
    });
}

// Demo account functions
function registerDemoAccount(accountData) {
    return new Promise((resolve, reject) => {
        const { account_id, account_name, broker } = accountData;
        const sql = `
            INSERT OR REPLACE INTO demo_accounts (account_id, account_name, broker, updated_at)
            VALUES (?, ?, ?, CURRENT_TIMESTAMP)
        `;
        
        db.run(sql, [account_id, account_name, broker], function(err) {
            if (err) reject(err);
            else resolve({ id: this.lastID, account_id, account_name, broker });
        });
    });
}

function updateAccountStats(account_id, stats) {
    return new Promise((resolve, reject) => {
        const { balance, equity, profit_loss, win_rate, total_trades, winning_trades } = stats;
        const performance_score = calculatePerformanceScore(stats);
        
        const sql = `
            UPDATE demo_accounts 
            SET balance = ?, equity = ?, profit_loss = ?, win_rate = ?, 
                total_trades = ?, winning_trades = ?, performance_score = ?, updated_at = CURRENT_TIMESTAMP
            WHERE account_id = ?
        `;
        
        db.run(sql, [balance, equity, profit_loss, win_rate, total_trades, winning_trades, performance_score, account_id], function(err) {
            if (err) reject(err);
            else resolve({ changes: this.changes });
        });
    });
}

function getAllDemoAccounts() {
    return new Promise((resolve, reject) => {
        db.all(`
            SELECT da.*, 
                   COUNT(s.id) as recent_signals,
                   AVG(s.profit_loss) as avg_profit_per_trade
            FROM demo_accounts da
            LEFT JOIN signals s ON da.account_id = s.account_id 
                AND s.created_at > datetime('now', '-24 hours')
            WHERE da.is_active = 1
            GROUP BY da.id
            ORDER BY da.performance_score DESC
        `, (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });
}

// Signal functions
function createSignal(signalData) {
    return new Promise((resolve, reject) => {
        const { account_id, symbol, action, volume, entry_price, stop_loss, take_profit } = signalData;
        
        const sql = `
            INSERT INTO signals (account_id, symbol, action, volume, entry_price, stop_loss, take_profit)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `;
        
        db.run(sql, [account_id, symbol, action, volume, entry_price, stop_loss, take_profit], function(err) {
            if (err) reject(err);
            else resolve({ id: this.lastID, ...signalData });
        });
    });
}

function updateSignal(id, updateData) {
    return new Promise((resolve, reject) => {
        const { current_price, profit_loss, status, close_time } = updateData;
        
        let sql = 'UPDATE signals SET current_price = ?, profit_loss = ?, updated_at = CURRENT_TIMESTAMP';
        let params = [current_price, profit_loss];
        
        if (status) {
            sql += ', status = ?';
            params.push(status);
        }
        
        if (close_time) {
            sql += ', close_time = ?, duration_minutes = (julianday(?) - julianday(open_time)) * 1440';
            params.push(close_time, close_time);
        }
        
        sql += ' WHERE id = ?';
        params.push(id);
        
        db.run(sql, params, function(err) {
            if (err) reject(err);
            else resolve({ changes: this.changes });
        });
    });
}

function getTopPerformingSignals(limit = 20) {
    return new Promise((resolve, reject) => {
        db.all(`
            SELECT s.*, da.account_name, da.performance_score,
                   CASE WHEN s.status = 'open' THEN 
                        (julianday('now') - julianday(s.open_time)) * 1440 
                   ELSE s.duration_minutes END as current_duration
            FROM signals s
            JOIN demo_accounts da ON s.account_id = da.account_id
            WHERE da.is_active = 1 AND s.status IN ('open', 'closed')
            ORDER BY da.performance_score DESC, s.profit_loss DESC, s.created_at DESC
            LIMIT ?
        `, [limit], (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });
}

function copySignalToMaster(signal_id, volume_multiplier = 1) {
    return new Promise((resolve, reject) => {
        // First get the signal
        db.get('SELECT * FROM signals WHERE id = ?', [signal_id], (err, signal) => {
            if (err) {
                reject(err);
                return;
            }
            
            if (!signal) {
                reject(new Error('Signal not found'));
                return;
            }
            
            // Insert into master trades
            const sql = `
                INSERT INTO master_trades 
                (original_signal_id, symbol, action, volume, entry_price, stop_loss, take_profit, copied_from_account)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `;
            
            const adjustedVolume = signal.volume * volume_multiplier;
            
            db.run(sql, [
                signal_id, signal.symbol, signal.action, adjustedVolume, 
                signal.entry_price, signal.stop_loss, signal.take_profit, signal.account_id
            ], function(err) {
                if (err) {
                    reject(err);
                } else {
                    // Mark original signal as copied
                    db.run('UPDATE signals SET is_copied = 1, copy_time = CURRENT_TIMESTAMP WHERE id = ?', 
                        [signal_id], (updateErr) => {
                            if (updateErr) console.error('Error marking signal as copied:', updateErr);
                        });
                    
                    resolve({ 
                        master_trade_id: this.lastID, 
                        original_signal_id: signal_id,
                        volume: adjustedVolume
                    });
                }
            });
        });
    });
}

function getMasterTrades() {
    return new Promise((resolve, reject) => {
        db.all(`
            SELECT mt.*, s.account_id as source_account
            FROM master_trades mt
            LEFT JOIN signals s ON mt.original_signal_id = s.id
            ORDER BY mt.open_time DESC
        `, (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });
}

// Helper function to calculate performance score
function calculatePerformanceScore(stats) {
    const { profit_loss, win_rate, total_trades } = stats;
    
    if (total_trades < 5) return 0; // Not enough data
    
    // Weighted score: 40% profit, 30% win rate, 30% trade volume
    const profitScore = Math.max(0, Math.min(100, (profit_loss / 1000) * 50 + 50));
    const winRateScore = win_rate;
    const volumeScore = Math.min(100, (total_trades / 50) * 100);
    
    return (profitScore * 0.4) + (winRateScore * 0.3) + (volumeScore * 0.3);
}

module.exports = {
    initializeDatabase,
    registerDemoAccount,
    updateAccountStats,
    getAllDemoAccounts,
    createSignal,
    updateSignal,
    getTopPerformingSignals,
    copySignalToMaster,
    getMasterTrades
};
