import { store } from '../store.js';

export function initJournal() {
    renderJournalHtml();
    
    // フィルターやソートの変更時にテーブルを再描画
    const triggerRedraw = () => renderJournalTable();
    ['filter-keyword', 'filter-date-from', 'filter-date-to', 'filter-amount-min', 'filter-amount-max', 'filter-sort'].forEach(id => {
        document.getElementById(id)?.addEventListener('input', triggerRedraw);
        document.getElementById(id)?.addEventListener('change', triggerRedraw);
    });

    document.getElementById('btn-reset-filter')?.addEventListener('click', () => {
        ['filter-keyword', 'filter-date-from', 'filter-date-to', 'filter-amount-min', 'filter-amount-max'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.value = '';
        });
        const sortEl = document.getElementById('filter-sort');
        if (sortEl) sortEl.value = 'date-desc';
        renderJournalTable();
    });
}

function renderJournalHtml() {
    const container = document.getElementById('tab-journal');
    if (!container) return;
    container.innerHTML = `
        <div class="bg-white rounded-lg shadow-sm border border-slate-200 p-3 space-y-2.5 text-xs">
            <div class="flex justify-between items-center border-b pb-2">
                <h2 class="text-xs sm:text-sm font-bold text-slate-800 flex items-center gap-1.5">
                    <i data-lucide="list-todo" class="w-4 h-4 text-emerald-600"></i> 仕訳帳履歴一覧
                </h2>
                <div class="text-slate-500" id="journal-count-label">全 0 件</div>
            </div>

            <!-- 検索・フィルター・ソートエリア -->
            <div class="bg-slate-50 p-2 rounded-md border space-y-2">
                <div class="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <input type="text" id="filter-keyword" placeholder="キーワード (科目・摘要)..." class="p-1.5 border rounded bg-white">
                    <div class="flex items-center gap-1">
                        <input type="date" id="filter-date-from" class="w-full p-1.5 border rounded bg-white">
                        <span class="text-slate-400">～</span>
                        <input type="date" id="filter-date-to" class="w-full p-1.5 border rounded bg-white">
                    </div>
                    <div class="flex items-center gap-1">
                        <input type="number" id="filter-amount-min" placeholder="下限金額" class="w-full p-1.5 border rounded bg-white">
                        <span class="text-slate-400">～</span>
                        <input type="number" id="filter-amount-max" placeholder="上限金額" class="w-full p-1.5 border rounded bg-white">
                    </div>
                </div>
                <div class="flex justify-between items-center pt-1 border-t">
                    <div class="flex items-center gap-1.5">
                        <span class="font-semibold text-slate-600">並び順:</span>
                        <select id="filter-sort" class="p-1 border rounded bg-white font-medium">
                            <option value="date-desc" selected>日付の新しい順</option>
                            <option value="date-asc">日付の古い順</option>
                            <option value="input-desc">入力順 (新しい順)</option>
                            <option value="input-asc">入力順 (古い順)</option>
                        </select>
                    </div>
                    <button type="button" id="btn-reset-filter" class="px-2.5 py-1 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded font-medium">条件クリア</button>
                </div>
            </div>

            <!-- テーブル -->
            <div class="overflow-x-auto max-h-[50vh] overflow-y-auto border rounded-lg">
                <table class="w-full text-left border-collapse min-w-[700px]">
                    <thead class="sticky top-0 bg-slate-100 text-slate-700 z-10">
                        <tr>
                            <th class="p-2">日付</th>
                            <th class="p-2">借方科目</th>
                            <th class="p-2">貸方科目</th>
                            <th class="p-2 text-right">金額</th>
                            <th class="p-2">摘要</th>
                            <th class="p-2 text-center no-print w-24">操作</th>
                        </tr>
                    </thead>
                    <tbody id="journal-tbody" class="divide-y divide-slate-100"></tbody>
                </table>
            </div>
        </div>
    `;
    if (window.lucide) lucide.createIcons();
}

export function renderJournalTable() {
    const tbody = document.getElementById('journal-tbody');
    const countLabel = document.getElementById('journal-count-label');
    if (!tbody) return;

    const state = store.getState();
    const keyword = (document.getElementById('filter-keyword')?.value || '').toLowerCase();
    const dateFrom = document.getElementById('filter-date-from')?.value || '';
    const dateTo = document.getElementById('filter-date-to')?.value || '';
    const amtMin = document.getElementById('filter-amount-min')?.value;
    const amtMax = document.getElementById('filter-amount-max')?.value;
    const sortOrder = document.getElementById('filter-sort')?.value || 'date-desc';

    // 1. フィルター適用
    let txs = (state.transactions || []).filter(t => {
        if (keyword) {
            const text = `${t.date} ${t.debit.acc} ${t.debit.sub || ''} ${t.credit.acc} ${t.credit.sub || ''} ${t.memo || ''}`.toLowerCase();
            if (!text.includes(keyword)) return false;
        }
        if (dateFrom && t.date < dateFrom) return false;
        if (dateTo && t.date > dateTo) return false;
        if (amtMin !== '' && amtMin != null && t.amount < Number(amtMin)) return false;
        if (amtMax !== '' && amtMax != null && t.amount > Number(amtMax)) return false;
        return true;
    });

    // 2. ソート適用
    txs.sort((a, b) => {
        if (sortOrder === 'date-desc') return b.date.localeCompare(a.date) || Number(b.id) - Number(a.id);
        if (sortOrder === 'date-asc') return a.date.localeCompare(b.date) || Number(b.id) - Number(a.id);
        if (sortOrder === 'input-desc') return Number(b.id) - Number(a.id);
        if (sortOrder === 'input-asc') return Number(a.id) - Number(b.id);
        return 0;
    });

    if (countLabel) {
        countLabel.textContent = `該当件数: ${txs.length} 件 (全 ${(state.transactions || []).length} 件)`;
    }

    if (txs.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="p-6 text-center text-slate-400">条件に一致する仕訳はありません。</td></tr>';
        return;
    }

    // 3. 描画
    tbody.innerHTML = '';
    txs.forEach(t => {
        const tr = document.createElement('tr');
        tr.className = "hover:bg-slate-50";
        tr.innerHTML = `
            <td class="p-2 whitespace-nowrap">${t.date}</td>
            <td class="p-2 font-medium">${t.debit.acc} <span class="text-[11px] text-slate-500">${t.debit.sub ? '('+t.debit.sub+')' : ''}</span></td>
            <td class="p-2 font-medium">${t.credit.acc} <span class="text-[11px] text-slate-500">${t.credit.sub ? '('+t.credit.sub+')' : ''}</span></td>
            <td class="p-2 text-right font-bold">¥${Number(t.amount).toLocaleString()}</td>
            <td class="p-2 text-slate-600">${t.memo || '-'}</td>
            <td class="p-2 text-center no-print whitespace-nowrap">
                <div class="flex items-center justify-center gap-1">
                    <button type="button" onclick="window.openTxEditModal('${t.id}')" class="text-blue-600 hover:text-blue-800 p-1" title="編集"><i data-lucide="edit-3" class="w-3.5 h-3.5"></i></button>
                    <button type="button" onclick="window.copyTransaction('${t.id}')" class="text-emerald-600 hover:text-emerald-800 p-1" title="コピー"><i data-lucide="copy" class="w-3.5 h-3.5"></i></button>
                    <button type="button" onclick="window.deleteTransaction('${t.id}')" class="text-rose-500 hover:text-rose-700 p-1" title="削除"><i data-lucide="trash-2" class="w-3.5 h-3.5"></i></button>
                </div>
            </td>
        `;
        tbody.appendChild(tr);
    });

    if (window.lucide) lucide.createIcons();
}