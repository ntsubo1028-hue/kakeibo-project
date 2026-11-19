import { store } from '../store.js';

let expensePieChartInstance = null;
let monthlyTrendChartInstance = null;

// 棒グラフの各棒の上に実績値（金額）を描画するプラグイン
const barValueLabelsPlugin = {
    id: 'barValueLabels',
    afterDatasetsDraw(chart) {
        const { ctx, data } = chart;
        const meta = chart.getDatasetMeta(0);
        if (!meta || !meta.data) return;

        ctx.save();
        ctx.font = 'bold 10px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillStyle = '#334155';

        meta.data.forEach((barElement, index) => {
            const rawVal = Number(data.datasets[0]?.data?.[index]);
            if (Number.isNaN(rawVal)) return;

            const labelText = `¥${rawVal.toLocaleString()}`;
            const x = barElement.x;
            const y = rawVal < 0 ? barElement.y + 12 : barElement.y - 3;

            ctx.textBaseline = rawVal < 0 ? 'top' : 'bottom';
            ctx.fillText(labelText, x, y);
        });

        ctx.restore();
    }
};

// 円グラフ（ドーナツ）の各セグメント上に金額を描画するプラグイン
const pieValueLabelsPlugin = {
    id: 'pieValueLabels',
    afterDatasetsDraw(chart) {
        const { ctx, data } = chart;
        const meta = chart.getDatasetMeta(0);
        if (!meta || !meta.data) return;

        const labels = data.labels || [];
        if (labels.length === 1 && labels[0] === 'データなし') return;

        ctx.save();
        ctx.font = 'bold 10px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#ffffff';
        ctx.shadowColor = 'rgba(15, 23, 42, 0.55)';
        ctx.shadowBlur = 3;

        meta.data.forEach((arcElement, index) => {
            const rawVal = Number(data.datasets[0]?.data?.[index]);
            if (!rawVal) return;

            // セグメントの角度と半径から中心座標を算出
            const angle = (arcElement.startAngle + arcElement.endAngle) / 2;
            const arcAngle = arcElement.endAngle - arcElement.startAngle;
            const radius = (arcElement.innerRadius + arcElement.outerRadius) / 2;

            // 狭すぎる扇形では文字が重なりやすいためスキップ
            const arcLength = arcAngle * radius;
            const labelText = `¥${rawVal.toLocaleString()}`;
            if (arcLength < 28) return;

            const x = arcElement.x + Math.cos(angle) * radius;
            const y = arcElement.y + Math.sin(angle) * radius;
            ctx.fillText(labelText, x, y);
        });

        ctx.restore();
    }
};

export async function initCharts() {
    const container = document.getElementById('tab-charts');
    if (!container) return;

    if (!container.innerHTML.trim() || !document.getElementById('expense-pie-chart')) {
        await renderChartsHtml();
    } else {
        renderCharts();
    }
}

async function renderChartsHtml() {
    const container = document.getElementById('tab-charts');
    if (!container) return;
    try {
        const res = await fetch('./src/views/charts.html');
        if (!res.ok) throw new Error('Failed to load charts.html');
        container.innerHTML = await res.text();
        if (window.lucide) lucide.createIcons();
    } catch (e) {
        console.error(e);
        return;
    }

    setupChartEventListeners();
    updateBarAccountDropdown();
    renderCharts();
}

function setupChartEventListeners() {
    document.getElementById('pie-type-select')?.addEventListener('change', renderCharts);
    document.getElementById('pie-period-select')?.addEventListener('change', renderCharts);
    
    document.getElementById('bar-type-select')?.addEventListener('change', () => {
        updateBarAccountDropdown();
        renderCharts();
    });
    document.getElementById('bar-account-select')?.addEventListener('change', () => {
        updateBarSubDropdown();
        renderCharts();
    });
    document.getElementById('bar-sub-select')?.addEventListener('change', renderCharts);
}

function getCategoriesByType(type, state) {
    if (!state.categories) return [];
    switch (type) {
        case 'expense': return state.categories.expenses || [];
        case 'income': return state.categories.income || [];
        case 'assets': return state.categories.assets || [];
        case 'liabilities': return state.categories.liabilities || [];
        case 'netAssets': return state.categories.netAssets || [];
        default: return [];
    }
}

function updateBarAccountDropdown() {
    const typeSelect = document.getElementById('bar-type-select');
    const accSelect = document.getElementById('bar-account-select');
    if (!typeSelect || !accSelect) return;

    const type = typeSelect.value;
    const state = store.getState();
    const categories = getCategoriesByType(type, state);

    const currentVal = accSelect.value;
    accSelect.innerHTML = '<option value="ALL">(全体の合計)</option>';
    categories.forEach(c => {
        accSelect.appendChild(new Option(c.name, c.name));
    });

    if (currentVal && Array.from(accSelect.options).some(opt => opt.value === currentVal)) {
        accSelect.value = currentVal;
    } else {
        accSelect.value = 'ALL';
    }

    updateBarSubDropdown();
}

function updateBarSubDropdown() {
    const accSelect = document.getElementById('bar-account-select');
    const subSelect = document.getElementById('bar-sub-select');
    if (!accSelect || !subSelect) return;

    const accName = accSelect.value;
    subSelect.innerHTML = '<option value="ALL">(すべての補助)</option>';

    if (accName === 'ALL') {
        subSelect.classList.add('hidden');
        return;
    }

    const subAccounts = store.getSubAccounts(accName);
    if (subAccounts && subAccounts.length > 0) {
        subAccounts.forEach(s => {
            subSelect.appendChild(new Option(s, s));
        });
        subSelect.classList.remove('hidden');
    } else {
        subSelect.classList.add('hidden');
    }
}

// subNameが指定されていない（すべての補助）場合はサブ科目の期首残高も合算する
function calculateBalanceAtDate(accName, subName, targetDateStr, state) {
    const type = getAccountType(accName, state);
    let balance = 0;

    const categories = getCategoriesByType(type, state);
    const catObj = categories.find(c => c.name === accName);
    if (catObj) {
        if (subName) {
            const subObj = catObj.sub.find(s => s.name === subName);
            if (subObj) balance += (Number(subObj.balance) || 0);
        } else {
            balance += (Number(catObj.balance) || 0);
            if (catObj.sub && Array.isArray(catObj.sub)) {
                catObj.sub.forEach(s => {
                    balance += (Number(s.balance) || 0);
                });
            }
        }
    }

    (state.transactions || []).forEach(t => {
        if (!t.date || t.date > targetDateStr) return;
        const amt = Number(t.amount) || 0;

        const isDebit = (t.debit.acc === accName && (!subName || t.debit.sub === subName));
        const isCredit = (t.credit.acc === accName && (!subName || t.credit.sub === subName));

        if (type === 'assets') {
            if (isDebit) balance += amt;
            if (isCredit) balance -= amt;
        } else if (type === 'liabilities' || type === 'netAssets') {
            if (isCredit) balance += amt;
            if (isDebit) balance -= amt;
        }
    });

    return balance;
}

function getAccountType(accName, state) {
    if ((state.categories.assets || []).some(c => c.name === accName)) return 'assets';
    if ((state.categories.liabilities || []).some(c => c.name === accName)) return 'liabilities';
    if ((state.categories.netAssets || []).some(c => c.name === accName)) return 'netAssets';
    if ((state.categories.income || []).some(c => c.name === accName)) return 'income';
    if ((state.categories.expenses || []).some(c => c.name === accName)) return 'expenses';
    return 'expense';
}

function getLastDayOfMonth(year, monthStr) {
    const m = Number(monthStr);
    const d = new Date(year, m, 0);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
}

// 未来月の選択肢を非活性化するヘルパー
function updatePiePeriodDropdown(fiscalYear) {
    const periodSelect = document.getElementById('pie-period-select');
    if (!periodSelect) return;

    const now = new Date();
    const currentY = now.getFullYear();
    const currentM = now.getMonth() + 1;
    const targetY = Number(fiscalYear);

    Array.from(periodSelect.options).forEach(opt => {
        const val = opt.value;
        if (/^\d{2}$/.test(val)) {
            const m = Number(val);
            const isFuture = (targetY > currentY) || (targetY === currentY && m > currentM);
            opt.disabled = isFuture;
            if (isFuture && opt.selected) {
                periodSelect.value = 'current';
            }
        }
    });
}

export function renderCharts() {
    const state = store.getState();
    const transactions = state.transactions || [];
    const fiscalYear = Number(state.fiscalYear) || new Date().getFullYear();

    updatePiePeriodDropdown(fiscalYear);

    // --- 1. 円グラフ（科目別内訳分析） ---
    const pieType = document.getElementById('pie-type-select')?.value || 'expense'; 
    const piePeriod = document.getElementById('pie-period-select')?.value || 'current'; 

    const targetCats = getCategoriesByType(pieType, state);
    const catMap = {};
    targetCats.forEach(c => { catMap[c.name] = 0; });

    const now = new Date();
    const currentYearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    const isBS = (pieType === 'assets' || pieType === 'liabilities' || pieType === 'netAssets');

    if (isBS) {
        let targetDate = `${fiscalYear}-12-31`;
        if (piePeriod === 'current') {
            const [y, m] = currentYearMonth.split('-');
            targetDate = getLastDayOfMonth(y, m);
        } else if (piePeriod === 'total') {
            targetDate = `${fiscalYear}-12-31`;
        } else {
            targetDate = getLastDayOfMonth(fiscalYear, piePeriod);
        }

        // 未来日の制限ガード（当月末日より未来にならないようにする）
        const maxAllowedDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()).padStart(2, '0')}`;
        if (Number(fiscalYear) === now.getFullYear() && targetDate > maxAllowedDate) {
            targetDate = maxAllowedDate;
        }

        targetCats.forEach(c => {
            catMap[c.name] = calculateBalanceAtDate(c.name, null, targetDate, state);
        });
    } else {
        transactions.forEach(t => {
            if (!t.date) return;
            const [y, m] = t.date.split('-');
            
            let matchPeriod = false;
            if (Number(y) === fiscalYear) {
                if (piePeriod === 'current') {
                    if (t.date.startsWith(currentYearMonth)) matchPeriod = true;
                } else if (piePeriod === 'total') {
                    matchPeriod = true;
                } else {
                    if (m === piePeriod) matchPeriod = true;
                }
            }

            if (matchPeriod) {
                const amt = Number(t.amount) || 0;
                if (pieType === 'expense') {
                    if (catMap[t.debit.acc] !== undefined) catMap[t.debit.acc] += amt;
                    if (catMap[t.credit.acc] !== undefined) catMap[t.credit.acc] -= amt;
                } else if (pieType === 'income') {
                    if (catMap[t.credit.acc] !== undefined) catMap[t.credit.acc] += amt;
                    if (catMap[t.debit.acc] !== undefined) catMap[t.debit.acc] -= amt;
                }
            }
        });
    }

    const pieLabels = [];
    const pieData = [];
    Object.entries(catMap).forEach(([acc, val]) => {
        if (val !== 0) {
            pieLabels.push(acc);
            pieData.push(Math.abs(val));
        }
    });

    renderPieChart(pieLabels, pieData);

    // --- 2. 棒グラフ（月別推移） ---
    const barType = document.getElementById('bar-type-select')?.value || 'expense';
    const barAccount = document.getElementById('bar-account-select')?.value || 'ALL';
    const barSub = document.getElementById('bar-sub-select')?.value || 'ALL';

    const allMonths = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'];
    
    // 未来月（当月以降の月）は表示対象から除外する
    const currentY = now.getFullYear();
    const currentM = now.getMonth() + 1;
    let maxMonthIdx = 11;
    if (fiscalYear > currentY) {
        maxMonthIdx = -1;
    } else if (fiscalYear === currentY) {
        maxMonthIdx = currentM - 1;
    }

    const activeMonths = allMonths.slice(0, maxMonthIdx + 1);
    const monthlyData = new Array(activeMonths.length).fill(0);

    const isBarBS = (barType === 'assets' || barType === 'liabilities' || barType === 'netAssets');
    const barTargetCats = getCategoriesByType(barType, state);

    if (isBarBS) {
        activeMonths.forEach((m, idx) => {
            const monthEndDate = getLastDayOfMonth(fiscalYear, m);
            if (barAccount === 'ALL') {
                let totalVal = 0;
                barTargetCats.forEach(c => {
                    totalVal += calculateBalanceAtDate(c.name, null, monthEndDate, state);
                });
                monthlyData[idx] = totalVal;
            } else {
                monthlyData[idx] = calculateBalanceAtDate(barAccount, barSub === 'ALL' ? null : barSub, monthEndDate, state);
            }
        });
    } else {
        transactions.forEach(t => {
            if (!t.date) return;
            const [y, m] = t.date.split('-');
            if (Number(y) === fiscalYear) {
                const monthIdx = allMonths.indexOf(m);
                if (monthIdx !== -1 && monthIdx <= maxMonthIdx) {
                    const amt = Number(t.amount) || 0;

                    if (barAccount === 'ALL') {
                        if (barType === 'expense') {
                            if (getCategoriesByType('expense', state).some(c => c.name === t.debit.acc)) monthlyData[monthIdx] += amt;
                            if (getCategoriesByType('expense', state).some(c => c.name === t.credit.acc)) monthlyData[monthIdx] -= amt;
                        } else if (barType === 'income') {
                            if (getCategoriesByType('income', state).some(c => c.name === t.credit.acc)) monthlyData[monthIdx] += amt;
                            if (getCategoriesByType('income', state).some(c => c.name === t.debit.acc)) monthlyData[monthIdx] -= amt;
                        }
                    } else {
                        const isDebitTarget = (t.debit.acc === barAccount && (barSub === 'ALL' || t.debit.sub === barSub));
                        const isCreditTarget = (t.credit.acc === barAccount && (barSub === 'ALL' || t.credit.sub === barSub));

                        if (barType === 'expense') {
                            if (isDebitTarget) monthlyData[monthIdx] += amt;
                            if (isCreditTarget) monthlyData[monthIdx] -= amt;
                        } else if (barType === 'income') {
                            if (isCreditTarget) monthlyData[monthIdx] += amt;
                            if (isDebitTarget) monthlyData[monthIdx] -= amt;
                        }
                    }
                }
            }
        });
    }

    const typeNames = { expense: '費用', income: '収益', assets: '資産', liabilities: '負債', netAssets: '純資産' };
    const barLabel = barAccount === 'ALL' 
        ? `${typeNames[barType] || '合計'} (全体合計)` 
        : `${barAccount}${barSub !== 'ALL' ? ' (' + barSub + ')' : ''}`;
    
    const colorMap = {
        expense: '#6366f1',
        income: '#10b981',
        assets: '#3b82f6',
        liabilities: '#ef4444',
        netAssets: '#f59e0b'
    };

    renderTrendChart(activeMonths.map(m => `${Number(m)}月`), monthlyData, barLabel, colorMap[barType] || '#6366f1');
}

function renderPieChart(labels, data) {
    const ctx = document.getElementById('expense-pie-chart')?.getContext('2d');
    if (!ctx) return;

    if (expensePieChartInstance) {
        expensePieChartInstance.destroy();
    }

    const hasData = labels.length > 0 && data.length > 0;
    const totalSum = hasData ? data.reduce((sum, v) => sum + Number(v || 0), 0) : 0;

    const backgroundColors = [
        '#10b981', '#6366f1', '#f59e0b', '#ef4444', '#3b82f6', 
        '#ec4899', '#8b5cf6', '#14b8a6', '#f97316', '#64748b'
    ];

    expensePieChartInstance = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: hasData ? labels : ['データなし'],
            datasets: [{
                data: hasData ? data : [1],
                backgroundColor: hasData ? backgroundColors.slice(0, labels.length) : ['#e2e8f0']
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'bottom', labels: { boxWidth: 12, font: { size: 11 } } },
                tooltip: {
                    callbacks: {
                        label: (context) => {
                            if (!hasData) return 'データなし';
                            const val = Number(context.raw) || 0;
                            const pct = totalSum > 0 ? ((val / totalSum) * 100).toFixed(1) : '0.0';
                            return `${context.label}: ¥${val.toLocaleString()} (${pct}%)`;
                        }
                    }
                }
            }
        },
        plugins: [pieValueLabelsPlugin]
    });
}

function renderTrendChart(labels, datasetData, labelName, color) {
    const ctx = document.getElementById('monthly-trend-chart')?.getContext('2d');
    if (!ctx) return;

    if (monthlyTrendChartInstance) {
        monthlyTrendChartInstance.destroy();
    }

    const maxVal = datasetData.length > 0 ? Math.max(...datasetData.map(v => Number(v) || 0), 0) : 0;
    const minVal = datasetData.length > 0 ? Math.min(...datasetData.map(v => Number(v) || 0), 0) : 0;
    const yPadding = Math.max(Math.abs(maxVal), Math.abs(minVal)) * 0.15;

    monthlyTrendChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [
                {
                    label: labelName,
                    data: datasetData,
                    backgroundColor: color,
                    borderRadius: 4
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            layout: {
                padding: {
                    top: 14
                }
            },
            scales: {
                y: {
                    suggestedMax: maxVal > 0 ? maxVal + yPadding : undefined,
                    suggestedMin: minVal < 0 ? minVal - yPadding : undefined,
                    ticks: {
                        font: { size: 10 },
                        callback: (value) => `¥${Number(value).toLocaleString()}`
                    },
                    grid: { color: '#f1f5f9' }
                },
                x: { ticks: { font: { size: 10 } }, grid: { display: false } }
            },
            plugins: {
                legend: { position: 'bottom', labels: { boxWidth: 12, font: { size: 11 } } },
                tooltip: {
                    callbacks: {
                        label: (context) => {
                            const val = Number(context.raw) || 0;
                            return `${context.dataset.label}: ¥${val.toLocaleString()}`;
                        }
                    }
                }
            }
        },
        plugins: [barValueLabelsPlugin]
    });
}