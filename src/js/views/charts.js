import { store } from '../store.js';

let expensePieChartInstance = null;
let monthlyTrendChartInstance = null;

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

function updateBarAccountDropdown() {
    const typeSelect = document.getElementById('bar-type-select');
    const accSelect = document.getElementById('bar-account-select');
    if (!typeSelect || !accSelect) return;

    const type = typeSelect.value; // 'expense' or 'income'
    const state = store.getState();
    const categories = type === 'expense' ? (state.categories.expenses || []) : (state.categories.income || []);

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

export function renderCharts() {
    const state = store.getState();
    const transactions = state.transactions || [];
    const expenseCategories = (state.categories.expenses || []).map(c => c.name);
    const incomeCategories = (state.categories.income || []).map(c => c.name);

    // --- 1. 円グラフの集計 ---
    const pieType = document.getElementById('pie-type-select')?.value || 'expense'; // 'expense' or 'income'
    const piePeriod = document.getElementById('pie-period-select')?.value || 'current'; // 'current', '01'~'12', 'total'

    const targetCategories = pieType === 'expense' ? expenseCategories : incomeCategories;
    const catMap = {};
    targetCategories.forEach(acc => { catMap[acc] = 0; });

    const now = new Date();
    const currentYearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const fiscalYear = state.fiscalYear || now.getFullYear();

    transactions.forEach(t => {
        if (!t.date) return;
        const [y, m] = t.date.split('-');
        
        let matchPeriod = false;
        if (Number(y) === Number(fiscalYear)) {
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
                if (expenseCategories.includes(t.debit.acc)) catMap[t.debit.acc] = (catMap[t.debit.acc] || 0) + amt;
                if (expenseCategories.includes(t.credit.acc)) catMap[t.credit.acc] = (catMap[t.credit.acc] || 0) - amt;
            } else {
                if (incomeCategories.includes(t.credit.acc)) catMap[t.credit.acc] = (catMap[t.credit.acc] || 0) + amt;
                if (incomeCategories.includes(t.debit.acc)) catMap[t.debit.acc] = (catMap[t.debit.acc] || 0) - amt;
            }
        }
    });

    const pieLabels = [];
    const pieData = [];
    Object.entries(catMap).forEach(([acc, amt]) => {
        if (amt > 0) {
            pieLabels.push(acc);
            pieData.push(amt);
        }
    });

    renderPieChart(pieLabels, pieData, pieType === 'expense' ? '費用内訳' : '収益内訳');

    // --- 2. 棒グラフ（月別推移）の集計 ---
    const barType = document.getElementById('bar-type-select')?.value || 'expense';
    const barAccount = document.getElementById('bar-account-select')?.value || 'ALL';
    const barSub = document.getElementById('bar-sub-select')?.value || 'ALL';

    const months = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'];
    const monthlyData = new Array(12).fill(0);

    transactions.forEach(t => {
        if (!t.date) return;
        const [y, m] = t.date.split('-');
        if (Number(y) === Number(fiscalYear)) {
            const monthIdx = months.indexOf(m);
            if (monthIdx !== -1) {
                const amt = Number(t.amount) || 0;

                if (barAccount === 'ALL') {
                    if (barType === 'expense') {
                        if (expenseCategories.includes(t.debit.acc)) monthlyData[monthIdx] += amt;
                        if (expenseCategories.includes(t.credit.acc)) monthlyData[monthIdx] -= amt;
                    } else {
                        if (incomeCategories.includes(t.credit.acc)) monthlyData[monthIdx] += amt;
                        if (incomeCategories.includes(t.debit.acc)) monthlyData[monthIdx] -= amt;
                    }
                } else {
                    const isDebitTarget = (t.debit.acc === barAccount && (barSub === 'ALL' || t.debit.sub === barSub));
                    const isCreditTarget = (t.credit.acc === barAccount && (barSub === 'ALL' || t.credit.sub === barSub));

                    if (barType === 'expense') {
                        if (isDebitTarget) monthlyData[monthIdx] += amt;
                        if (isCreditTarget) monthlyData[monthIdx] -= amt;
                    } else {
                        if (isCreditTarget) monthlyData[monthIdx] += amt;
                        if (isDebitTarget) monthlyData[monthIdx] -= amt;
                    }
                }
            }
        }
    });

    const barLabel = barAccount === 'ALL' 
        ? (barType === 'expense' ? '費用合計' : '収益合計') 
        : `${barAccount}${barSub !== 'ALL' ? ' (' + barSub + ')' : ''}`;
    const barColor = barType === 'expense' ? '#6366f1' : '#10b981';

    renderTrendChart(months.map(m => `${Number(m)}月`), monthlyData, barLabel, barColor);
}

function renderPieChart(labels, data) {
    const ctx = document.getElementById('expense-pie-chart')?.getContext('2d');
    if (!ctx) return;

    if (expensePieChartInstance) {
        expensePieChartInstance.destroy();
    }

    const backgroundColors = [
        '#10b981', '#6366f1', '#f59e0b', '#ef4444', '#3b82f6', 
        '#ec4899', '#8b5cf6', '#14b8a6', '#f97316', '#64748b'
    ];

    expensePieChartInstance = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels.length > 0 ? labels : ['データなし'],
            datasets: [{
                data: data.length > 0 ? data : [1],
                backgroundColor: labels.length > 0 ? backgroundColors.slice(0, labels.length) : ['#e2e8f0']
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'bottom', labels: { boxWidth: 12, font: { size: 11 } } }
            }
        }
    });
}

function renderTrendChart(labels, datasetData, labelName, color) {
    const ctx = document.getElementById('monthly-trend-chart')?.getContext('2d');
    if (!ctx) return;

    if (monthlyTrendChartInstance) {
        monthlyTrendChartInstance.destroy();
    }

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
            scales: {
                y: { ticks: { font: { size: 10 } }, grid: { color: '#f1f5f9' } },
                x: { ticks: { font: { size: 10 } }, grid: { display: false } }
            },
            plugins: {
                legend: { position: 'bottom', labels: { boxWidth: 12, font: { size: 11 } } }
            }
        }
    });
}