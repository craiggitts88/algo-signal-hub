let selectedSignalId = null;
let accounts = [];
let signals = [];
let masterTrades = [];

// Initialize dashboard
document.addEventListener('DOMContentLoaded', function() {
    loadDashboard();
    
    // Auto-refresh every 30 seconds
    setInterval(loadDashboard, 30000);
});

async function loadDashboard() {
    try {
        await Promise.all([
            loadAccounts(),
            loadSignals(),
            loadMasterTrades()
        ]);
        updateStats();
    } catch (error) {
        console.error('Error loading dashboard:', error);
    }
}

async function loadAccounts() {
    try {
        const response = await fetch('/api/accounts');
        const data = await response.json();
        
        if (data.success) {
            accounts = data.accounts;
            displayAccounts(accounts);
        }
    } catch (error) {
        console.error('Error loading accounts:', error);
    }
}

async function loadSignals() {
    try {
        const response = await fetch('/api/signals/top?limit=50');
        const data = await response.json();
        
        if (data.success) {
            signals = data.signals;
            displaySignals(signals);
        }
    } catch (error) {
        console.error('Error loading signals:', error);
    }
}

async function loadMasterTrades() {
    try {
        const response = await fetch('/api/master/trades');
        const data = await response.json();
        
        if (data.success) {
            masterTrades = data.trades;
            displayMasterTrades(masterTrades);
        }
    } catch (error) {
        console.error('Error loading master trades:', error);
    }
}

function displayAccounts(accounts) {
    const container = document.getElementById('accountsContainer');
    
    if (!accounts.length) {
        container.innerHTML = `
            <div class="text-center py-8">
                <i class="fas fa-user-plus text-4xl text-gray-300 mb-4"></i>
                <p class="text-gray-500">No demo accounts registered yet</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = accounts.map((account, index) => `
        <div class="flex items-center justify-between p-4 bg-gray-50 rounded-lg border-l-4 ${getPerformanceBorderColor(account.performance_score)}">
            <div class="flex items-center space-x-4">
                <div class="flex items-center justify-center w-10 h-10 rounded-full ${getPerformanceBgColor(account.performance_score)} text-white font-bold">
                    ${index + 1}
                </div>
                <div>
                                       <h3 class="font-semibold text-lg">${account.account_name}</h3>
                    <p class="text-sm text-gray-600">${account.broker} • ID: ${account.account_id}</p>
                </div>
            </div>
            <div class="flex items-center space-x-6">
                <div class="text-center">
                    <p class="text-xs text-gray-500">Balance</p>
                    <p class="font-semibold">$${formatNumber(account.balance)}</p>
                </div>
                <div class="text-center">
                    <p class="text-xs text-gray-500">P&L</p>
                    <p class="font-semibold ${account.profit_loss >= 0 ? 'text-green-600' : 'text-red-600'}">
                        ${account.profit_loss >= 0 ? '+' : ''}$${formatNumber(account.profit_loss)}
                    </p>
                </div>
                <div class="text-center">
                    <p class="text-xs text-gray-500">Win Rate</p>
                    <p class="font-semibold">${account.win_rate.toFixed(1)}%</p>
                </div>
                <div class="text-center">
                    <p class="text-xs text-gray-500">Trades</p>
                    <p class="font-semibold">${account.total_trades}</p>
                </div>
                <div class="text-center">
                    <p class="text-xs text-gray-500">Score</p>
                    <div class="flex items-center">
                        <div class="w-16 bg-gray-200 rounded-full h-2 mr-2">
                            <div class="h-2 rounded-full ${getPerformanceBgColor(account.performance_score)}" 
                                 style="width: ${account.performance_score}%"></div>
                        </div>
                        <span class="text-sm font-semibold">${account.performance_score.toFixed(0)}</span>
                    </div>
                </div>
                <div class="text-center">
                    <p class="text-xs text-gray-500">Recent Signals</p>
                    <p class="font-semibold">${account.recent_signals || 0}</p>
                </div>
            </div>
        </div>
    `).join('');
}

function displaySignals(signals) {
    const container = document.getElementById('signalsContainer');
    
    if (!signals.length) {
        container.innerHTML = `
            <div class="text-center py-8">
                <i class="fas fa-chart-line text-4xl text-gray-300 mb-4"></i>
                <p class="text-gray-500">No signals available yet</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = signals.map(signal => `
        <div class="flex items-center justify-between p-4 bg-gray-50 rounded-lg border-l-4 ${signal.action === 'BUY' ? 'border-green-500' : 'border-red-500'} hover:shadow-md transition-shadow">
            <div class="flex items-center space-x-4">
                <div class="flex items-center">
                    <input type="checkbox" class="signal-checkbox mr-3" data-signal-id="${signal.id}" 
                           ${signal.is_copied ? 'disabled checked' : ''}>
                    <div class="text-center">
                        <div class="w-12 h-12 rounded-full ${signal.action === 'BUY' ? 'bg-green-100' : 'bg-red-100'} flex items-center justify-center">
                            <i class="fas ${signal.action === 'BUY' ? 'fa-arrow-up text-green-600' : 'fa-arrow-down text-red-600'}"></i>
                        </div>
                        <p class="text-xs mt-1 font-medium">${signal.action}</p>
                    </div>
                </div>
                <div>
                    <h3 class="font-semibold text-lg">${signal.symbol}</h3>
                    <p class="text-sm text-gray-600">From: ${signal.account_name}</p>
                    <p class="text-xs text-gray-500">
                        ${signal.status === 'open' ? 'Open' : 'Closed'} • 
                        ${formatDuration(signal.current_duration)} ago
                    </p>
                </div>
            </div>
            <div class="flex items-center space-x-6">
                <div class="text-center">
                    <p class="text-xs text-gray-500">Volume</p>
                    <p class="font-semibold">${signal.volume}</p>
                </div>
                <div class="text-center">
                    <p class="text-xs text-gray-500">Entry</p>
                    <p class="font-semibold">${signal.entry_price ? signal.entry_price.toFixed(5) : 'Market'}</p>
                </div>
                <div class="text-center">
                    <p class="text-xs text-gray-500">Current</p>
                    <p class="font-semibold">${signal.current_price ? signal.current_price.toFixed(5) : '-'}</p>
                </div>
                <div class="text-center">
                    <p class="text-xs text-gray-500">P&L</p>
                    <p class="font-semibold ${signal.profit_loss >= 0 ? 'text-green-600' : 'text-red-600'}">
                        ${signal.profit_loss >= 0 ? '+' : ''}$${formatNumber(signal.profit_loss)}
                    </p>
                </div>
                <div class="text-center">
                    <p class="text-xs text-gray-500">Account Score</p>
                    <p class="font-semibold">${signal.performance_score.toFixed(0)}</p>
                </div>
                <div class="flex space-x-2">
                    ${signal.is_copied ? 
                        '<span class="px-3 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">Copied</span>' :
                        `<button onclick="copySignal(${signal.id})" class="bg-green-500 text-white px-3 py-1 rounded text-xs hover:bg-green-600 transition">
                            <i class="fas fa-copy mr-1"></i>Copy
                        </button>`
                    }
                </div>
            </div>
        </div>
    `).join('');
}

function displayMasterTrades(trades) {
    const container = document.getElementById('masterTradesContainer');
    
    if (!trades.length) {
        container.innerHTML = `
            <div class="text-center py-8">
                <i class="fas fa-crown text-4xl text-gray-300 mb-4"></i>
                <p class="text-gray-500">No copied trades yet</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = trades.map(trade => `
        <div class="flex items-center justify-between p-4 bg-gradient-to-r from-yellow-50 to-orange-50 rounded-lg border-l-4 border-yellow-500">
            <div class="flex items-center space-x-4">
                <div class="text-center">
                    <div class="w-12 h-12 rounded-full ${trade.action === 'BUY' ? 'bg-green-100' : 'bg-red-100'} flex items-center justify-center">
                        <i class="fas ${trade.action === 'BUY' ? 'fa-arrow-up text-green-600' : 'fa-arrow-down text-red-600'}"></i>
                    </div>
                    <p class="text-xs mt-1 font-medium">${trade.action}</p>
                </div>
                <div>
                    <h3 class="font-semibold text-lg">${trade.symbol}</h3>
                    <p class="text-sm text-gray-600">Copied from: ${trade.copied_from_account}</p>
                    <p class="text-xs text-gray-500">
                        ${trade.status === 'open' ? 'Open' : 'Closed'} • 
                        ${formatDateTime(trade.open_time)}
                    </p>
                </div>
            </div>
            <div class="flex items-center space-x-6">
                <div class="text-center">
                    <p class="text-xs text-gray-500">Volume</p>
                    <p class="font-semibold">${trade.volume}</p>
                </div>
                <div class="text-center">
                    <p class="text-xs text-gray-500">Entry</p>
                    <p class="font-semibold">${trade.entry_price ? trade.entry_price.toFixed(5) : 'Market'}</p>
                </div>
                <div class="text-center">
                    <p class="text-xs text-gray-500">Current</p>
                    <p class="font-semibold">${trade.current_price ? trade.current_price.toFixed(5) : '-'}</p>
                </div>
                <div class="text-center">
                    <p class="text-xs text-gray-500">P&L</p>
                    <p class="font-semibold ${trade.profit_loss >= 0 ? 'text-green-600' : 'text-red-600'}">
                        ${trade.profit_loss >= 0 ? '+' : ''}$${formatNumber(trade.profit_loss)}
                    </p>
                </div>
                <div class="flex space-x-2">
                    <span class="px-3 py-1 bg-yellow-100 text-yellow-800 text-xs rounded-full">
                        <i class="fas fa-crown mr-1"></i>Master
                    </span>
                </div>
            </div>
        </div>
    `).join('');
}

function updateStats() {
    // Update account stats
    document.getElementById('totalAccounts').textContent = accounts.length;
    
    // Update signal stats
    const openSignals = signals.filter(s => s.status === 'open').length;
    document.getElementById('liveSignals').textContent = openSignals;
    
    // Update copied trades stats
    const copiedCount = signals.filter(s => s.is_copied).length;
    document.getElementById('copiedTrades').textContent = copiedCount;
    
    // Update average performance
    const avgPerformance = accounts.length > 0 
        ? accounts.reduce((sum, acc) => sum + acc.performance_score, 0) / accounts.length 
        : 0;
    document.getElementById('avgPerformance').textContent = avgPerformance.toFixed(1) + '%';
}

function copySignal(signalId) {
    selectedSignalId = signalId;
    document.getElementById('copyModal').classList.remove('hidden');
    document.getElementById('copyModal').classList.add('flex');
}

function closeCopyModal() {
    document.getElementById('copyModal').classList.add('hidden');
    document.getElementById('copyModal').classList.remove('flex');
    selectedSignalId = null;
}

async function confirmCopy() {
    if (!selectedSignalId) return;
    
    const volumeMultiplier = parseFloat(document.getElementById('volumeMultiplier').value);
    
    if (volumeMultiplier <= 0 || volumeMultiplier > 10) {
        alert('Volume multiplier must be between 0.1 and 10');
        return;
    }
    
    try {
        const response = await fetch(`/api/copy/${selectedSignalId}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ volume_multiplier: volumeMultiplier })
        });
        
        const data = await response.json();
        
        if (data.success) {
            alert('Signal copied to master account successfully!');
            closeCopyModal();
            loadDashboard(); // Refresh data
        } else {
            alert('Error copying signal: ' + data.message);
        }
    } catch (error) {
        console.error('Error copying signal:', error);
        alert('Error copying signal. Please try again.');
    }
}

function copySelectedSignals() {
    const checkboxes = document.querySelectorAll('.signal-checkbox:checked:not(:disabled)');
    
    if (checkboxes.length === 0) {
        alert('Please select at least one signal to copy');
        return;
    }
    
    if (confirm(`Copy ${checkboxes.length} selected signals to master account?`)) {
        checkboxes.forEach(async (checkbox) => {
            const signalId = checkbox.dataset.signalId;
            try {
                await fetch(`/api/copy/${signalId}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ volume_multiplier: 1 })
                });
            } catch (error) {
                console.error('Error copying signal:', signalId, error);
            }
        });
        
        setTimeout(() => {
            loadDashboard(); // Refresh after copying
        }, 1000);
    }
}

async function refreshSignals() {
    await loadDashboard();
}

// Utility functions
function formatNumber(num) {
    return Math.abs(num).toLocaleString('en-US', { 
        minimumFractionDigits: 2, 
        maximumFractionDigits: 2 
    });
}

function formatDateTime(dateString) {
    return new Date(dateString).toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function formatDuration(minutes) {
    if (minutes < 60) return `${Math.round(minutes)}m`;
    if (minutes < 1440) return `${Math.round(minutes / 60)}h`;
    return `${Math.round(minutes / 1440)}d`;
}

function getPerformanceBorderColor(score) {
    if (score >= 80) return 'border-green-500';
    if (score >= 60) return 'border-yellow-500';
    if (score >= 40) return 'border-orange-500';
    return 'border-red-500';
}

function getPerformanceBgColor(score) {
    if (score >= 80) return 'bg-green-500';
    if (score >= 60) return 'bg-yellow-500';
    if (score >= 40) return 'bg-orange-500';
    return 'bg-red-500';
}

