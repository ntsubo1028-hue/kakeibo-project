import { store } from '../store.js';
import { calculateAccountBalance, calculateSubAccountBalance, getPreviousYearValue } from '../accounting.js';

export async function initStatements() {
    await renderStatementsHtml();

    const viewModeElem = document.getElementById('statement-view-mode');
    if (viewModeElem) {
        viewModeElem.addEventListener('change', renderFinancialStatements);
    }

    const hideZeroElem = document.getElementById('hide-zero-accounts');
    if (hideZeroElem) {
        hideZeroElem.addEventListener('change', renderFinancialStatements);
    }
}

async function renderStatementsHtml() {
    const container = document.getElementById('tab-statements');
    if (!container) return;
    try {
        const res = await fetch('./src/views/statements.html');
        if (!res.ok) throw new Error('Failed to load statements.html');
        container.innerHTML = await res.text();
        if (window.lucide) lucide.createIcons();
    } catch (e) {
        console.error(e);
    }
    renderFinancialStatements();
}

function hasTransaction(transactions, accName, subName = '') {
    return transactions.some(t => {
        const debitMatch = t.debit.acc === accName && (!subName || t.debit.sub === subName);
        const creditMatch = t.credit.acc === accName && (!subName || t.credit.sub === subName);
        return debitMatch || creditMatch;
    });
}

// 前年対比の表示文字列を作成するヘルパー関数
function formatDiff(current, prev) {
    if (prev === null || prev === undefined) return '<span class="text-slate-400">-</span>';
    const diff = current - prev;
    if (diff === 0) return '<span class="text-slate-400">0</span>';
    
    // パーセント表示（前年が0でない場合）
    if (prev !== 0) {
        const ratio = ((diff / Math.abs(prev)) * 100).toFixed(0);
        const prefix = ratio > 0 ? '+' : '';
        const color = ratio > 0 ? 'text-emerald-600' : 'text-rose-600';
        return `<span class="${color} font-semibold">${prefix}${ratio}%</span>`;
    }
    
    // 前年が0の場合は金額差分のみ表示
    const prefix = diff > 0 ? '+' : '';
    const color = diff > 0 ? 'text-emerald-600' : 'text-rose-600';
    return `<span class="${color} font-semibold">${prefix}¥${diff.toLocaleString()}</span>`;
}

export function renderFinancialStatements() {
    const viewModeElem = document.getElementById('statement-view-mode');
    const hideZeroElem = document.getElementById('hide-zero-accounts');
    if (!viewModeElem) return;

    const viewMode = viewModeElem.value;
    const hideZero = hideZeroElem ? hideZeroElem.checked : false;
    const state = store.getState();
    const transactions = state.transactions || [];

    const renderAccountSection = (categories, listContainerId, totalContainerId, isIncomeOrExpense = false) => {
        const listElem = document.getElementById(listContainerId);
        if (!listElem) return 0;
        listElem.innerHTML = '';
        let sectionTotal = 0;

        categories.forEach(c => {
            const bal = calculateAccountBalance(c.name);
            const prev = getPreviousYearValue(c.name, '');
            const hasTx = hasTransaction(transactions, c.name);

            const isAccountZero = (prev === null || prev === 0) && !hasTx && bal === 0;

            if (viewMode === 'detailed' && c.sub && c.sub.length > 0) {
                let subHtml = '';
                let visibleSubCount = 0;

                c.sub.forEach(sub => {
                    const subName = typeof sub === 'string' ? sub : sub.name;
                    const subBal = calculateSubAccountBalance(c.name, subName);
                    const subPrev = getPreviousYearValue(c.name, subName);
                    const hasSubTx = hasTransaction(transactions, c.name, subName);
                    const isSubZero = (subPrev === null || subPrev === 0) && !hasSubTx && subBal === 0;

                    if (hideZero && isSubZero) return;

                    visibleSubCount++;
                    const diffHtml = formatDiff(subBal, subPrev);

                    subHtml += `<div class="grid grid-cols-12 gap-1 items-center py-0.5 text-[11px] text-slate-600 pl-2">
                        <span class="col-span-4 truncate">- ${subName}</span>
                        <span class="col-span-3 text-right text-slate-400 text-[10px]">${subPrev !== null ? '¥' + subPrev.toLocaleString() : '-'}</span>
                        <span class="col-span-3 text-right font-semibold">¥${subBal.toLocaleString()}</span>
                        <span class="col-span-2 text-right text-[10px]">${diffHtml}</span>
                    </div>`;
                });

                if (hideZero && isAccountZero && visibleSubCount === 0) return;

                sectionTotal += bal;
                const parentDiffHtml = formatDiff(bal, prev);

                listElem.innerHTML += `
                    <div class="border-t border-slate-100 pt-1 mt-1">
                        <div class="grid grid-cols-12 gap-1 items-center font-bold text-slate-800 text-xs py-0.5">
                            <span class="col-span-4 truncate">${c.name}</span>
                            <span class="col-span-3 text-right text-slate-400 text-[10px] font-normal">${prev !== null ? '¥' + prev.toLocaleString() : '-'}</span>
                            <span class="col-span-3 text-right text-slate-900">¥${bal.toLocaleString()}</span>
                            <span class="col-span-2 text-right text-[10px] font-normal">${parentDiffHtml}</span>
                        </div>
                        ${subHtml}
                    </div>`;

            } else {
                if (hideZero && isAccountZero) return;

                sectionTotal += bal;
                const diffHtml = formatDiff(bal, prev);

                listElem.innerHTML += `
                    <div class="grid grid-cols-12 gap-1 items-center py-1 border-b border-slate-50 text-xs">
                        <span class="col-span-4 font-medium text-slate-800 truncate">${c.name}</span>
                        <span class="col-span-3 text-right text-slate-400 text-[10px]">${prev !== null ? '¥' + prev.toLocaleString() : '-'}</span>
                        <span class="col-span-3 text-right font-bold text-slate-900">¥${bal.toLocaleString()}</span>
                        <span class="col-span-2 text-right text-[10px]">${diffHtml}</span>
                    </div>`;
            }
        });

        const totalElem = document.getElementById(totalContainerId);
        if (totalElem) totalElem.textContent = `¥${sectionTotal.toLocaleString()}`;
        return sectionTotal;
    };

    const totalInc = renderAccountSection(state.categories.income, 'pl-income-list', 'pl-income-total', true);
    const totalExp = renderAccountSection(state.categories.expenses, 'pl-expense-list', 'pl-expense-total', true);

    const netIncome = totalInc - totalExp;
    const netIncomeElem = document.getElementById('pl-net-income');
    if (netIncomeElem) {
        netIncomeElem.textContent = `¥${netIncome.toLocaleString()}`;
        netIncomeElem.className = `text-sm font-bold ${netIncome >= 0 ? 'text-emerald-700' : 'text-rose-700'}`;
    }

    renderAccountSection(state.categories.assets, 'bs-asset-list', 'bs-asset-total');
    renderAccountSection(state.categories.liabilities, 'bs-liability-list', 'bs-liability-total');

    let totalNet = 0;
    const netList = document.getElementById('bs-net-asset-list');
    if (netList) {
        netList.innerHTML = '';
        state.categories.netAssets.forEach(c => {
            const bal = calculateAccountBalance(c.name);
            const prev = getPreviousYearValue(c.name, '');
            const hasTx = hasTransaction(transactions, c.name);
            const isAccountZero = (prev === null || prev === 0) && !hasTx && bal === 0;

            if (viewMode === 'detailed' && c.sub && c.sub.length > 0) {
                let subHtml = '';
                let visibleSubCount = 0;
                c.sub.forEach(sub => {
                    const subName = typeof sub === 'string' ? sub : sub.name;
                    const subBal = calculateSubAccountBalance(c.name, subName);
                    const subPrev = getPreviousYearValue(c.name, subName);
                    const hasSubTx = hasTransaction(transactions, c.name, subName);
                    const isSubZero = (subPrev === null || subPrev === 0) && !hasSubTx && subBal === 0;

                    if (hideZero && isSubZero) return;
                    visibleSubCount++;
                    const diffHtml = formatDiff(subBal, subPrev);

                    subHtml += `<div class="grid grid-cols-12 gap-1 items-center py-0.5 text-[11px] text-slate-600 pl-2">
                        <span class="col-span-4 truncate">- ${subName}</span>
                        <span class="col-span-3 text-right text-slate-400 text-[10px]">${subPrev !== null ? '¥' + subPrev.toLocaleString() : '-'}</span>
                        <span class="col-span-3 text-right font-semibold">¥${subBal.toLocaleString()}</span>
                        <span class="col-span-2 text-right text-[10px]">${diffHtml}</span>
                    </div>`;
                });

                if (hideZero && isAccountZero && visibleSubCount === 0) return;

                totalNet += bal;
                const parentDiffHtml = formatDiff(bal, prev);
                netList.innerHTML += `
                    <div class="border-t border-slate-100 pt-1 mt-1">
                        <div class="grid grid-cols-12 gap-1 items-center font-bold text-slate-800 text-xs py-0.5">
                            <span class="col-span-4 truncate">${c.name}</span>
                            <span class="col-span-3 text-right text-slate-400 text-[10px] font-normal">${prev !== null ? '¥' + prev.toLocaleString() : '-'}</span>
                            <span class="col-span-3 text-right text-slate-900">¥${bal.toLocaleString()}</span>
                            <span class="col-span-2 text-right text-[10px] font-normal">${parentDiffHtml}</span>
                        </div>
                        ${subHtml}
                    </div>`;
            } else {
                if (hideZero && isAccountZero) return;
                totalNet += bal;
                const diffHtml = formatDiff(bal, prev);
                netList.innerHTML += `
                    <div class="grid grid-cols-12 gap-1 items-center py-1 border-b border-slate-50 text-xs">
                        <span class="col-span-4 font-medium text-slate-800 truncate">${c.name}</span>
                        <span class="col-span-3 text-right text-slate-400 text-[10px]">${prev !== null ? '¥' + prev.toLocaleString() : '-'}</span>
                        <span class="col-span-3 text-right font-bold text-slate-900">¥${bal.toLocaleString()}</span>
                        <span class="col-span-2 text-right text-[10px]">${diffHtml}</span>
                    </div>`;
            }
        });

        totalNet += netIncome;
        netList.innerHTML += `<div class="flex justify-between text-emerald-700 font-semibold pt-1.5 border-t mt-1"><span>当期未処分利益</span><span>¥${netIncome.toLocaleString()}</span></div>`;
        const netTotalElem = document.getElementById('bs-net-asset-total');
        if (netTotalElem) netTotalElem.textContent = `¥${totalNet.toLocaleString()}`;
    }

    if (window.lucide) lucide.createIcons();
}