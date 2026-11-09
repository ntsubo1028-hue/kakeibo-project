import { store } from '../store.js';

// フィルター条件や選択状態を保持するキャッシュ
let ledgerCache = {
    type: 'assets',
    account: '',
    sub: 'ALL',
    keyword: '',
    startDate: '',
    endDate: '',
    min: '',
    max: '',
    sort: 'date-desc'
};

export async function initLedger() {
    const container = document.getElementById('tab-ledger');
    if (!container) return;
    
    // HTMLがまだ読み込まれていない場合のみfetchする
    if (!container.innerHTML.trim() || !document.getElementById('ledger-type-select')) {
        await renderLedgerHtml();
    } else {
        // 既にHTMLが存在する場合はキャッシュをDOMに反映して再描画
        restoreCacheToDOM();
        renderLedger();
    }
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
        return;
    }

    setupEventListeners();
    restoreCacheToDOM();
    renderLedgerAccountDropdown();
}

function setupEventListeners() {
    const safeAddEvent = (id, event, handler) => {
        const el = document.getElementById(id);
        if (el) el.addEventListener(event, handler);
    };

    safeAddEvent('ledger-type-select', 'change', (e) => {
        ledgerCache.type = e.target.value;
        onLedgerTypeChange();
    });
    safeAddEvent('ledger-account-select', 'change', (e) => {
        ledgerCache.account = e.target.value;
        onLedgerAccountChange();
    });
    safeAddEvent('ledger-sub-select', 'change', (e) => {
        ledgerCache.sub = e.target.value;
        renderLedger();
    });
    
    safeAddEvent('filter-ledger-start', 'change', (e) => {
        ledgerCache.startDate = e.target.value;
        renderLedger();
    });
    safeAddEvent('filter-ledger-end', 'change', (e) => {
        ledgerCache.endDate = e.target.value;
        renderLedger();
    });
    safeAddEvent('filter-ledger-min', 'input', (e) => {
        ledgerCache.min = e.target.value;
        renderLedger();
    });
    safeAddEvent('filter-ledger-max', 'input', (e) => {
        ledgerCache.max = e.target.value;
        renderLedger();
    });
    safeAddEvent('filter-ledger-keyword', 'input', (e) => {
        ledgerCache.keyword = e.target.value;
        renderLedger();
    });
    safeAddEvent('sort-ledger-order', 'change', (e) => {
        ledgerCache.sort = e.target.value;
        renderLedger();
    });

    safeAddEvent('btn-clear-ledger-filter', 'click', clearLedgerFilters);
}

// キャッシュされた状態をDOM（入力欄など）に復元する
function restoreCacheToDOM() {
    const typeEl = document.getElementById('ledger-type-select');
    const startEl = document.getElementById('filter-ledger-start');
    const endEl = document.getElementById('filter-ledger-end');
    const minEl = document.getElementById('filter-ledger-min');
    const maxEl = document.getElementById('filter-ledger-max');
    const keywordEl = document.getElementById('filter-ledger-keyword');
    const sortEl = document.getElementById('sort-ledger-order');

    if (typeEl && ledgerCache.type) typeEl.value = ledgerCache.type;
    if (startEl) startEl.value = ledgerCache.startDate;
    if (endEl) endEl.value = ledgerCache.endDate;
    if (minEl) minEl.value = ledgerCache.min;
    if (maxEl) maxEl.value = ledgerCache.max;
    if (keywordEl) keywordEl.value = ledgerCache.keyword;
    if (sortEl && ledgerCache.sort) sortEl.value = ledgerCache.sort;

    updateAccountDropdown(ledgerCache.account, ledgerCache.sub);
}

// 勘定科目ドロップダウンの構築（選択状態を維持）
function updateAccountDropdown(targetAccount = null, targetSub = null) {
    const typeSelect = document.getElementById('ledger-type-select');
    const accSelect = document.getElementById('ledger-account-select');
    if (!typeSelect || !accSelect) return;

    const catType = typeSelect.value;
    ledgerCache.type = catType;
    accSelect.innerHTML = '';

    const state = store.getState();
    const list = state.categories[catType] || [];
    list.forEach(c => {
        accSelect.appendChild(new Option(c.name, c.name));
    });

    if (list.length > 0) {
        const selectName = targetAccount || ledgerCache.account;
        if (selectName && list.some(c => c.name === selectName)) {
            accSelect.value = selectName;
        } else {
            accSelect.value = list[0].name;
        }
        ledgerCache.account = accSelect.value;
    } else {
        ledgerCache.account = '';
    }

    updateSubDropdown(targetSub);
}

// 補助科目ドロップダウンの構築（選択状態を維持）
function updateSubDropdown(targetSub = null) {
    const accNameElem = document.getElementById('ledger-account-select');
    const subSelect = document.getElementById('ledger-sub-select');
    if (!accNameElem || !subSelect) return;

    const accName = accNameElem.value;
    ledgerCache.account = accName;
    subSelect.innerHTML = '';
    
    subSelect.appendChild(new Option('(すべての補助)', 'ALL'));
    subSelect.appendChild(new Option('(補助科目なし)', 'NONE'));

    if (accName) {
        store.getSubAccounts(accName).forEach(s => {
            subSelect.appendChild(new Option(s, s));
        });
    }

    const selectSub = targetSub || ledgerCache.sub;
    if (selectSub && Array.from(subSelect.options).some(opt => opt.value === selectSub)) {
        subSelect.value = selectSub;
    } else {
        subSelect.value = 'ALL';
    }
    ledgerCache.sub = subSelect.value;
}

function onLedgerTypeChange() {
    updateAccountDropdown();
    renderLedger();
}

function onLedgerAccountChange() {
    updateSubDropdown();
    renderLedger();
}

export function renderLedgerAccountDropdown() {
    updateAccountDropdown();
}

// フィルター条件をすべてリセットする関数（クリアボタン用）
function clearLedgerFilters() {
    ledgerCache.keyword = '';
    ledgerCache.startDate = '';
    ledgerCache.endDate = '';
    ledgerCache.min = '';
    ledgerCache.max = '';
    ledgerCache.sort = 'date-desc';
    ledgerCache.sub = 'ALL';

    const startEl = document.getElementById('filter-ledger-start');
    const endEl = document.getElementById('filter-ledger-end');
    const minEl = document.getElementById('filter-ledger-min');
    const maxEl = document.getElementById('filter-ledger-max');
    const keywordEl = document.getElementById('filter-ledger-keyword');
    const sortEl = document.getElementById('sort-ledger-order');
    const subSelect = document.getElementById('ledger-sub-select');

    if (startEl) startEl.value = '';
    if (endEl) endEl.value = '';
    if (minEl) minEl.value = '';
    if (maxEl) maxEl.value = '';
    if (keywordEl) keywordEl.value = '';
    if (sortEl) sortEl.value = 'date-desc';
    if (subSelect) subSelect.value = 'ALL';

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
    
    // 1. 勘定科目および補助科目の基本フィルタリング
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

    // 2. 各種フィルター値の取得（DOMまたはキャッシュから）
    const startDate = ledgerCache.startDate;
    const endDate = ledgerCache.endDate;
    const minVal = ledgerCache.min;
    const maxVal = ledgerCache.max;
    const keyword = ledgerCache.keyword.trim().toLowerCase();
    const sortOrder = ledgerCache.sort;

    // 日付範囲フィルターの適用
    if (startDate) {
        matchedTxs = matchedTxs.filter(t => t.date >= startDate);
    }
    if (endDate) {
        matchedTxs = matchedTxs.filter(t => t.date <= endDate);
    }

    // 金額範囲フィルターの適用
    const minAmt = minVal !== '' ? Number(minVal) : null;
    const maxAmt = maxVal !== '' ? Number(maxVal) : null;
    if (minAmt !== null) {
        matchedTxs = matchedTxs.filter(t => Number(t.amount) >= minAmt);
    }
    if (maxAmt !== null) {
        matchedTxs = matchedTxs.filter(t => Number(t.amount) <= maxAmt);
    }

    // キーワードフィルターの適用
    if (keyword) {
        matchedTxs = matchedTxs.filter(t => {
            const memo = (t.memo || '').toLowerCase();
            const debitAcc = (t.debit.acc || '').toLowerCase();
            const debitSub = (t.debit.sub || '').toLowerCase();
            const creditAcc = (t.credit.acc || '').toLowerCase();
            const creditSub = (t.credit.sub || '').toLowerCase();
            const dateStr = (t.date || '').toLowerCase();
            const amountStr = String(t.amount || '');

            return memo.includes(keyword) ||
                   debitAcc.includes(keyword) ||
                   debitSub.includes(keyword) ||
                   creditAcc.includes(keyword) ||
                   creditSub.includes(keyword) ||
                   dateStr.includes(keyword) ||
                   amountStr.includes(keyword);
        });
    }

    // 3. 表示順（ソート）の適用
    if (sortOrder) {
        matchedTxs.sort((a, b) => {
            if (sortOrder === 'date-desc') {
                return b.date.localeCompare(a.date) || b.id.localeCompare(a.id);
            } else if (sortOrder === 'date-asc') {
                return a.date.localeCompare(b.date) || a.id.localeCompare(b.id);
            } else if (sortOrder === 'amount-desc') {
                return Number(b.amount) - Number(a.amount);
            } else if (sortOrder === 'amount-asc') {
                return Number(a.amount) - Number(b.amount);
            }
            return 0;
        });
    }

    if (matchedTxs.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="p-6 text-center text-xs text-slate-400">条件に一致する仕訳データはありません。</td></tr>`;
        return;
    }

    // 4. 残高表示の判定（日付範囲以外のフィルター使用時は残高非表示）
    const hasOtherFilter = (minVal !== '' || maxVal !== '' || keyword !== '');

    let normalSide = (catType === 'liabilities' || catType === 'netAssets' || catType === 'income') ? 'credit' : 'debit';

    let baseBal = 0;
    if (!hasOtherFilter && catType !== 'income' && catType !== 'expenses') {
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
        
        if (!hasOtherFilter) {
            if (normalSide === 'debit') {
                if (isDebit) runningBalance += amt;
                if (isCredit) runningBalance -= amt;
            } else {
                if (isCredit) runningBalance += amt;
                if (isDebit) runningBalance -= amt;
            }
        }

        const tr = document.createElement('tr');
        tr.className = "hover:bg-slate-50";
        tr.innerHTML = `
            <td class="p-2 whitespace-nowrap">${t.date}</td>
            <td class="p-2 font-medium">${isDebit ? t.credit.acc + (t.credit.sub ? ' ('+t.credit.sub+')' : '') : t.debit.acc + (t.debit.sub ? ' ('+t.debit.sub+')' : '')} <span class="text-slate-400 text-[10px]">(${t.memo || '-'})</span></td>
            <td class="p-2 text-right font-semibold text-emerald-700">${isDebit ? '¥' + amt.toLocaleString() : '-'}</td>
            <td class="p-2 text-right font-semibold text-rose-700">${isCredit ? '¥' + amt.toLocaleString() : '-'}</td>
            <td class="p-2 text-right font-bold text-slate-900">${hasOtherFilter ? '-' : '¥' + runningBalance.toLocaleString()}</td>
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