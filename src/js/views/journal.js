import { store } from '../store.js';
import { exportJournalCsv } from '../db.js';

// 現在画面に表示されている絞り込み済みの仕訳データを保持
let currentMatchedTransactions = [];

export async function initJournal() {
    await renderJournalHtml();
    
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

    // ジャーナル画面のCSV出力ボタンのイベント紐付け
    document.getElementById('btn-export-journal-csv')?.addEventListener('click', () => {
        const state = store.getState();
        const fileName = `journal_filtered_${state.fiscalYear}.csv`;
        exportJournalCsv(currentMatchedTransactions, fileName);
    });
}

async function renderJournalHtml() {
    const container = document.getElementById('tab-journal');
    if (!container) return;
    try {
        const res = await fetch('./src/views/journal.html');
        if (!res.ok) throw new Error('Failed to load journal.html');
        container.innerHTML = await res.text();
        if (window.lucide) lucide.createIcons();
    } catch (e) {
        console.error(e);
    }
    renderJournalTable();
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

    txs.sort((a, b) => {
        if (sortOrder === 'date-desc') return b.date.localeCompare(a.date) || Number(b.id) - Number(a.id);
        if (sortOrder === 'date-asc') return a.date.localeCompare(b.date) || Number(b.id) - Number(a.id);
        if (sortOrder === 'input-desc') return Number(b.id) - Number(a.id);
        if (sortOrder === 'input-asc') return Number(a.id) - Number(b.id);
        return 0;
    });

    // 絞り込み結果をキャッシュに格納（CSV出力用）
    currentMatchedTransactions = txs;

    if (countLabel) {
        countLabel.textContent = `該当件数: ${txs.length} 件 (全 ${(state.transactions || []).length} 件)`;
    }

    if (txs.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="p-6 text-center text-slate-400">条件に一致する仕訳はありません。</td></tr>';
        return;
    }

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