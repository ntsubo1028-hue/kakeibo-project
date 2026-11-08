import { store } from '../store.js';

export async function initLedger() {
    await renderLedgerHtml();

    const safeAddEvent = (id, event, handler) => {
        const el = document.getElementById(id);
        if (el) el.addEventListener(event, handler);
    };

    safeAddEvent('ledger-type-select', 'change', onLedgerTypeChange);
    safeAddEvent('ledger-account-select', 'change', onLedgerAccountChange);
    safeAddEvent('ledger-sub-select', 'change', renderLedger);
    
    safeAddEvent('filter-ledger-start', 'change', renderLedger);
    safeAddEvent('filter-ledger-end', 'change', renderLedger);
    safeAddEvent('filter-ledger-min', 'input', renderLedger);
    safeAddEvent('filter-ledger-max', 'input', renderLedger);
    safeAddEvent('sort-ledger-order', 'change', renderLedger);
}

async function renderLedgerHtml() {
    const container = document.getElementById('tab-ledger');
    if (!container) return;
    
    try {
        const res = await fetch('./src/views/ledger.html');
        if (!res.ok) throw new Error('Failed to load ledger.html');
        container.innerHTML = await res.text();
        if (window.lucide) lucide.createIcons();
    } catch (e) {
        console.error(e);
    }
    renderLedgerAccountDropdown();
}

function onLedgerTypeChange() {
    const catType = document.getElementById('ledger-type-select')?.value;
    const accSelect = document.getElementById('ledger-account-select');
    if (!accSelect || !catType) return;
    accSelect.innerHTML = '';

    const state = store.getState();
    const list = state.categories[catType] || [];
    list.forEach(c => {
        accSelect.appendChild(new Option(c.name, c.name));
    });

    if (list.length > 0) {
        accSelect.value = list[0].name;
    }
    onLedgerAccountChange();
}

export function renderLedgerAccountDropdown() {
    onLedgerTypeChange();
}

function onLedgerAccountChange() {
    const accNameElem = document.getElementById('ledger-account-select');
    if (!accNameElem) return;
    const accName = accNameElem.value;
    const subSelect = document.getElementById('ledger-sub-select');
    if (!subSelect) return;
    subSelect.innerHTML = '';
    
    subSelect.appendChild(new Option('(すべての補助)', 'ALL'));
    subSelect.appendChild(new Option('(補助科目なし)', 'NONE'));

    if (accName) {
        store.getSubAccounts(accName).forEach(s => {
            subSelect.appendChild(new Option(s, s));
        });
    }
    renderLedger();
}

export function renderLedger() {
    const typeSelect = document.getElementById('ledger-type-select');
    const accSelect = document.getElementById('ledger-account-select');
    const subSelect = document.getElementById('ledger-sub-select');
    if (!typeSelect || !accSelect || !subSelect) return;

    const catType = typeSelect.value;
    const accName = accSelect.value;
    const subMode = subSelect.value;
    const tbody = document.getElementById('ledger-tbody');
    if (!tbody) return;
    tbody.innerHTML = '';

    const state = store.getState();
    let matchedTxs = state.transactions.filter(t => {
        let matchDebit = (t.debit.acc === accName);
        let matchCredit = (t.credit.acc === accName);

        if (subMode === 'NONE') {
            if (matchDebit && t.debit.sub) matchDebit = false;
            if (matchCredit && t.credit.sub) matchCredit = false;
        } else if (subMode !== 'ALL') {
            if (matchDebit && t.debit.sub !== subMode) matchDebit = false;
            if (matchCredit && t.credit.sub !== subMode) matchCredit = false;
        }
        return matchDebit || matchCredit;
    });

    if (matchedTxs.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="p-6 text-center text-xs text-slate-400">条件に一致する仕訳データはありません。</td></tr>`;
        return;
    }

    let normalSide = (catType === 'liabilities' || catType === 'netAssets' || catType === 'income') ? 'credit' : 'debit';

    let baseBal = 0;
    if (catType !== 'income' && catType !== 'expenses') {
        const catObj = state.categories[catType]?.find(c => c.name === accName);
        if (catObj) {
            if (subMode !== 'ALL' && subMode !== 'NONE' && Array.isArray(catObj.sub)) {
                const subObj = catObj.sub.find(s => (typeof s === 'string' ? s : s.name) === subMode);
                baseBal = (subObj && typeof subObj === 'object') ? (subObj.balance || 0) : 0;
            } else if (Array.isArray(catObj.sub) && catObj.sub.length > 0) {
                catObj.sub.forEach(s => {
                    if (typeof s === 'object' && s !== null) baseBal += (s.balance || 0);
                });
            } else {
                baseBal = catObj.balance || 0;
            }
        }
    }
    let runningBalance = baseBal;

    matchedTxs.forEach(t => {
        let isDebit = (t.debit.acc === accName);
        let isCredit = (t.credit.acc === accName);
        const amt = Number(t.amount);
        if (normalSide === 'debit') {
            if (isDebit) runningBalance += amt;
            if (isCredit) runningBalance -= amt;
        } else {
            if (isCredit) runningBalance += amt;
            if (isDebit) runningBalance -= amt;
        }

        const tr = document.createElement('tr');
        tr.className = "hover:bg-slate-50";
        tr.innerHTML = `
            <td class="p-2 whitespace-nowrap">${t.date}</td>
            <td class="p-2 font-medium">${isDebit ? t.credit.acc + (t.credit.sub ? ' ('+t.credit.sub+')' : '') : t.debit.acc + (t.debit.sub ? ' ('+t.debit.sub+')' : '')} <span class="text-slate-400 text-[10px]">(${t.memo || '-'})</span></td>
            <td class="p-2 text-right font-semibold text-emerald-700">${isDebit ? '¥' + amt.toLocaleString() : '-'}</td>
            <td class="p-2 text-right font-semibold text-rose-700">${isCredit ? '¥' + amt.toLocaleString() : '-'}</td>
            <td class="p-2 text-right font-bold text-slate-900">¥${runningBalance.toLocaleString()}</td>
            <td class="p-2 text-center no-print whitespace-nowrap">
                <div class="flex items-center justify-center gap-1">
                    <button onclick="window.openTxEditModal('${t.id}')" class="text-blue-600 hover:text-blue-800 p-1" title="編集"><i data-lucide="edit-3" class="w-3.5 h-3.5"></i></button>
                    <button onclick="window.copyTransaction('${t.id}')" class="text-emerald-600 hover:text-emerald-800 p-1" title="コピー"><i data-lucide="copy" class="w-3.5 h-3.5"></i></button>
                    <button onclick="window.deleteTransaction('${t.id}')" class="text-rose-500 hover:text-rose-700 p-1" title="削除"><i data-lucide="trash-2" class="w-3.5 h-3.5"></i></button>
                </div>
            </td>
        `;
        tbody.appendChild(tr);
    });
    if (window.lucide) lucide.createIcons();
}