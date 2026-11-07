import { store } from '../store.js';
import { calculateAccountBalance, calculateSubAccountBalance, getPreviousYearValue } from '../accounting.js';

export function initStatements() {
    renderStatementsHtml();

    // 表示モード切り替え（補助科目あり/なし）のイベント配線
    const viewModeElem = document.getElementById('statement-view-mode');
    if (viewModeElem) {
        viewModeElem.addEventListener('change', renderFinancialStatements);
    }

    // 非表示チェックボックスのイベント配線
    const hideZeroElem = document.getElementById('hide-zero-accounts');
    if (hideZeroElem) {
        hideZeroElem.addEventListener('change', renderFinancialStatements);
    }
}

function renderStatementsHtml() {
    const container = document.getElementById('tab-statements');
    if (!container) return;
    container.innerHTML = `
        <div class="bg-white rounded-lg shadow-sm border border-slate-200 p-3 sm:p-4 space-y-4">
            <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b pb-2 gap-2">
                <div>
                    <h2 class="text-sm sm:text-base font-bold text-slate-900" id="statement-title">決算財務諸表</h2>
                    <p class="text-[11px] text-slate-500">貸借対照表 (B/S) および 損益計算書 (P/L) ※前年実績比較・補助科目切替対応</p>
                </div>
                <div class="flex items-center gap-3 no-print flex-wrap">
                    <label class="flex items-center gap-1.5 text-xs cursor-pointer select-none bg-slate-50 px-2 py-1 border rounded">
                        <input type="checkbox" id="hide-zero-accounts" class="rounded text-emerald-600 focus:ring-emerald-500">
                        <span class="font-medium text-slate-700">ゼロ・取引なしを非表示</span>
                    </label>
                    <div class="flex items-center gap-2">
                        <span class="text-slate-600 font-semibold text-xs">表示形式:</span>
                        <select id="statement-view-mode" class="p-1 border rounded text-xs font-semibold bg-white">
                            <option value="summary" selected>補助科目なし (科目単位)</option>
                            <option value="detailed">補助科目あり (詳細表示)</option>
                        </select>
                    </div>
                    <button onclick="window.print()" class="px-2.5 py-1 bg-slate-700 hover:bg-slate-800 text-white text-xs rounded font-medium flex items-center gap-1">
                        <i data-lucide="printer" class="w-3.5 h-3.5"></i> 印刷 / PDF
                    </button>
                </div>
            </div>

            <!-- 損益計算書 (P/L) -->
            <div>
                <h3 class="text-xs font-bold text-indigo-900 bg-indigo-50 px-2.5 py-1.5 rounded border-l-4 border-indigo-600 mb-2">
                    【損益計算書 (P/L) - 当期成績】
                </h3>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div class="border rounded-lg p-2.5">
                        <h4 class="font-bold text-xs text-emerald-700 mb-1.5 border-b pb-1">■ 収益の部</h4>
                        <div id="pl-income-list" class="space-y-1 text-xs"></div>
                        <div class="flex justify-between font-bold text-xs border-t pt-1.5 mt-1.5">
                            <span>収益合計</span><span id="pl-income-total" class="text-emerald-700">¥0</span>
                        </div>
                    </div>
                    <div class="border rounded-lg p-2.5">
                        <h4 class="font-bold text-xs text-rose-700 mb-1.5 border-b pb-1">■ 費用の部</h4>
                        <div id="pl-expense-list" class="space-y-1 text-xs"></div>
                        <div class="flex justify-between font-bold text-xs border-t pt-1.5 mt-1.5">
                            <span>費用合計</span><span id="pl-expense-total" class="text-rose-700">¥0</span>
                        </div>
                    </div>
                </div>
                <div class="mt-2.5 bg-slate-50 p-2.5 rounded-lg border flex justify-between items-center text-xs font-bold">
                    <span>当期純利益 (または損失)</span>
                    <span id="pl-net-income" class="text-sm">¥0</span>
                </div>
            </div>

            <!-- 貸借対照表 (B/S) -->
            <div>
                <h3 class="text-xs font-bold text-emerald-900 bg-emerald-50 px-2.5 py-1.5 rounded border-l-4 border-emerald-600 mb-2">
                    【貸借対照表 (B/S) - 財政状態】
                </h3>
                <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div class="border rounded-lg p-2.5">
                        <h4 class="font-bold text-xs text-blue-700 mb-1.5 border-b pb-1">■ 資産の部</h4>
                        <div id="bs-asset-list" class="space-y-1 text-xs"></div>
                        <div class="flex justify-between font-bold text-xs border-t pt-1.5 mt-1.5">
                            <span>資産合計</span><span id="bs-asset-total">¥0</span>
                        </div>
                    </div>
                    <div class="border rounded-lg p-2.5">
                        <h4 class="font-bold text-xs text-amber-700 mb-1.5 border-b pb-1">■ 負債の部</h4>
                        <div id="bs-liability-list" class="space-y-1 text-xs"></div>
                        <div class="flex justify-between font-bold text-xs border-t pt-1.5 mt-1.5">
                            <span>負債合計</span><span id="bs-liability-total">¥0</span>
                        </div>
                    </div>
                    <div class="border rounded-lg p-2.5">
                        <h4 class="font-bold text-xs text-purple-700 mb-1.5 border-b pb-1">■ 純資産の部</h4>
                        <div id="bs-net-asset-list" class="space-y-1 text-xs"></div>
                        <div class="flex justify-between font-bold text-xs border-t pt-1.5 mt-1.5">
                            <span>純資産合計</span><span id="bs-net-asset-total">¥0</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
    renderFinancialStatements();
}

// 当年度の取引（仕訳）でその科目・補助科目が使用されたかを判定するヘルパー
function hasTransaction(transactions, accName, subName = '') {
    return transactions.some(t => {
        const debitMatch = t.debit.acc === accName && (!subName || t.debit.sub === subName);
        const creditMatch = t.credit.acc === accName && (!subName || t.credit.sub === subName);
        return debitMatch || creditMatch;
    });
}

export function renderFinancialStatements() {
    const viewModeElem = document.getElementById('statement-view-mode');
    const hideZeroElem = document.getElementById('hide-zero-accounts');
    if (!viewModeElem) return;

    const viewMode = viewModeElem.value;
    const hideZero = hideZeroElem ? hideZeroElem.checked : false;
    const state = store.getState();
    const transactions = state.transactions || [];

    // 共通の描画・フィルタリング処理を行う内部関数
    const renderAccountSection = (categories, listContainerId, totalContainerId, isIncomeOrExpense = false) => {
        const listElem = document.getElementById(listContainerId);
        if (!listElem) return 0;
        listElem.innerHTML = '';
        let sectionTotal = 0;

        categories.forEach(c => {
            const bal = calculateAccountBalance(c.name);
            const prev = getPreviousYearValue(c.name, '');
            const hasTx = hasTransaction(transactions, c.name);

            // 非表示判定（前年残高が0または未設定、当年度取引なし、当年度末残高が0）
            const isAccountZero = (prev === null || prev === 0) && !hasTx && bal === 0;

            if (viewMode === 'detailed' && c.sub && c.sub.length > 0) {
                // 補助科目ありの場合の個別補助フィルタリング
                let subHtml = '';
                let visibleSubCount = 0;

                c.sub.forEach(sub => {
                    const subName = typeof sub === 'string' ? sub : sub.name;
                    const subBal = calculateSubAccountBalance(c.name, subName);
                    const subPrev = getPreviousYearValue(c.name, subName);
                    const hasSubTx = hasTransaction(transactions, c.name, subName);
                    const isSubZero = (subPrev === null || subPrev === 0) && !hasSubTx && subBal === 0;

                    if (hideZero && isSubZero) return; // ゼロの補助科目はスキップ

                    visibleSubCount++;
                    subHtml += `<div class="flex justify-between pl-3 text-slate-600 text-[11px]">
                        <span>- ${subName}</span>
                        <div class="flex gap-4">
                            <span class="text-slate-400 text-[10px]">前年: ${subPrev !== null ? '¥' + subPrev.toLocaleString() : '-'}</span>
                            <span class="font-semibold">¥${subBal.toLocaleString()}</span>
                        </div>
                    </div>`;
                });

                // 親科目自体が非表示条件に合致し、かつ配下の表示対象補助科目がない場合は科目ごと非表示にする
                if (hideZero && isAccountZero && visibleSubCount === 0) return;

                sectionTotal += bal;
                listElem.innerHTML += `<div class="font-bold text-slate-800 pt-1">${c.name}</div>`;
                listElem.innerHTML += subHtml;

            } else {
                // 補助科目なし（またはsummaryモード）
                if (hideZero && isAccountZero) return;

                sectionTotal += bal;
                listElem.innerHTML += `<div class="flex justify-between items-center py-0.5">
                    <span class="font-medium">${c.name}</span>
                    <div class="flex items-center gap-3">
                        <span class="text-slate-400 text-[10px]">前年: ${prev !== null ? '¥' + prev.toLocaleString() : '-'}</span>
                        <span class="font-bold">¥${bal.toLocaleString()}</span>
                    </div>
                </div>`;
            }
        });

        const totalElem = document.getElementById(totalContainerId);
        if (totalElem) totalElem.textContent = `¥${sectionTotal.toLocaleString()}`;
        return sectionTotal;
    };

    // 1. P/L 収益の部
    const totalInc = renderAccountSection(state.categories.income, 'pl-income-list', 'pl-income-total', true);

    // 2. P/L 費用の部
    const totalExp = renderAccountSection(state.categories.expenses, 'pl-expense-list', 'pl-expense-total', true);

    const netIncome = totalInc - totalExp;
    const netIncomeElem = document.getElementById('pl-net-income');
    if (netIncomeElem) {
        netIncomeElem.textContent = `¥${netIncome.toLocaleString()}`;
        netIncomeElem.className = `text-sm font-bold ${netIncome >= 0 ? 'text-emerald-700' : 'text-rose-700'}`;
    }

    // 3. B/S 資産の部
    renderAccountSection(state.categories.assets, 'bs-asset-list', 'bs-asset-total');

    // 4. B/S 負債の部
    renderAccountSection(state.categories.liabilities, 'bs-liability-list', 'bs-liability-total');

    // 5. B/S 純資産の部
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
                    subHtml += `<div class="flex justify-between pl-3 text-slate-600 text-[11px]">
                        <span>- ${subName}</span>
                        <div class="flex gap-4">
                            <span class="text-slate-400 text-[10px]">前年: ${subPrev !== null ? '¥' + subPrev.toLocaleString() : '-'}</span>
                            <span class="font-semibold">¥${subBal.toLocaleString()}</span>
                        </div>
                    </div>`;
                });

                if (hideZero && isAccountZero && visibleSubCount === 0) return;

                totalNet += bal;
                netList.innerHTML += `<div class="font-bold text-slate-800 pt-1">${c.name}</div>`;
                netList.innerHTML += subHtml;
            } else {
                if (hideZero && isAccountZero) return;
                totalNet += bal;
                netList.innerHTML += `<div class="flex justify-between items-center py-0.5">
                    <span class="font-medium">${c.name}</span>
                    <div class="flex items-center gap-3">
                        <span class="text-slate-400 text-[10px]">前年: ${prev !== null ? '¥' + prev.toLocaleString() : '-'}</span>
                        <span class="font-bold">¥${bal.toLocaleString()}</span>
                    </div>
                </div>`;
            }
        });

        totalNet += netIncome;
        netList.innerHTML += `<div class="flex justify-between text-emerald-700 font-semibold pt-1 border-t mt-1"><span>当期未処分利益</span><span>¥${netIncome.toLocaleString()}</span></div>`;
        const netTotalElem = document.getElementById('bs-net-asset-total');
        if (netTotalElem) netTotalElem.textContent = `¥${totalNet.toLocaleString()}`;
    }

    if (window.lucide) lucide.createIcons();
}