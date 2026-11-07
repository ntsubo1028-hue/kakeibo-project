import { store } from './store.js';
import { triggerFileInput, saveFileDirect, saveFileAs, triggerCsvImport, exportAllJournalCsv, handleFileSelect, handleCsvImport } from './db.js';
import { initDashboard, updateDashboard } from './views/dashboard.js';
import { initLedger, renderLedger, renderLedgerAccountDropdown } from './views/ledger.js';
import { initJournal, renderJournalTable } from './views/journal.js';
import { initStatements, renderFinancialStatements } from './views/statements.js';
import { initSettings, renderCategoryManagement } from './views/settings.js';

window.addEventListener('DOMContentLoaded', () => {
    if (window.lucide) lucide.createIcons();

    // 1. 各ビューの初期化
    initDashboard();
    initLedger();
    initJournal();
    initStatements();
    initSettings();

    // 2. 編集モーダルのイベント配線
    setupEditModalEvents();

    // 3. タブ切り替えの配線
    setupTabs();

    // 4. Undo / Redo ボタンおよびキーボードショートカットの配線
    setupUndoRedo();

    // 5. ヘッダーボタン・ファイル操作の配線
    document.getElementById('btn-open')?.addEventListener('click', triggerFileInput);
    document.getElementById('btn-save')?.addEventListener('click', saveFileDirect);
    document.getElementById('btn-save-as')?.addEventListener('click', saveFileAs);
    document.getElementById('btn-quick-save')?.addEventListener('click', saveFileDirect);
    document.getElementById('btn-csv-import')?.addEventListener('click', triggerCsvImport);
    document.getElementById('btn-csv-export')?.addEventListener('click', exportAllJournalCsv);
    document.getElementById('file-input')?.addEventListener('change', handleFileSelect);
    document.getElementById('csv-file-input')?.addEventListener('change', handleCsvImport);

    // データロード / 状態変更時の一括再描画イベント
    window.addEventListener('kakeibo-data-loaded', () => {
        updateAppHeader();
        updateDashboard();
        renderLedgerAccountDropdown();
        renderLedger();
        renderJournalTable();
        renderFinancialStatements();
        renderCategoryManagement();
        updateUndoRedoButtonStates();
    });

    updateAppHeader();
    updateUndoRedoButtonStates();
});

function setupTabs() {
    const tabButtons = document.querySelectorAll('.tab-btn');
    tabButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const targetId = btn.getAttribute('data-tab');

            document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
            document.querySelectorAll('.tab-btn').forEach(el => {
                el.classList.remove('text-emerald-400', 'border-emerald-400');
                el.classList.add('text-slate-300', 'border-transparent');
            });

            document.getElementById(targetId)?.classList.add('active');
            btn.classList.remove('text-slate-300', 'border-transparent');
            btn.classList.add('text-emerald-400', 'border-emerald-400');

            if (targetId === 'tab-ledger') renderLedger();
            if (targetId === 'tab-journal') renderJournalTable();
            if (targetId === 'tab-statements') renderFinancialStatements();
            if (targetId === 'tab-settings') renderCategoryManagement();
            
            if (window.lucide) lucide.createIcons();
        });
    });
}

// --- Undo / Redo の配線と状態更新 ---
function setupUndoRedo() {
    const undoBtn = document.getElementById('btn-undo');
    const redoBtn = document.getElementById('btn-redo');

    undoBtn?.addEventListener('click', () => {
        if (store.undo()) {
            window.dispatchEvent(new CustomEvent('kakeibo-data-loaded'));
            showToast('操作を元に戻しました。');
        }
    });

    redoBtn?.addEventListener('click', () => {
        if (store.redo()) {
            window.dispatchEvent(new CustomEvent('kakeibo-data-loaded'));
            showToast('操作をやり直しました。');
        }
    });

    // キーボードショートカット (Ctrl+Z / Ctrl+Y)
    window.addEventListener('keydown', (e) => {
        // 入力フォームやテキストエリアにフォーカスがある場合はショートカットを無効化
        if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName)) return;

        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
            e.preventDefault();
            if (e.shiftKey) {
                // Ctrl+Shift+Z は Redo
                if (store.redo()) {
                    window.dispatchEvent(new CustomEvent('kakeibo-data-loaded'));
                    showToast('操作をやり直しました。');
                }
            } else {
                // Ctrl+Z は Undo
                if (store.undo()) {
                    window.dispatchEvent(new CustomEvent('kakeibo-data-loaded'));
                    showToast('操作を元に戻しました。');
                }
            }
        } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
            e.preventDefault();
            if (store.redo()) {
                window.dispatchEvent(new CustomEvent('kakeibo-data-loaded'));
                showToast('操作をやり直しました。');
            }
        }
    });
}

function updateUndoRedoButtonStates() {
    const undoBtn = document.getElementById('btn-undo');
    const redoBtn = document.getElementById('btn-redo');
    if (undoBtn) undoBtn.disabled = !store.canUndo();
    if (redoBtn) redoBtn.disabled = !store.canRedo();
}

export function updateAppHeader() {
    const state = store.getState();
    const nameEl = document.getElementById('display-household-name');
    const yearEl = document.getElementById('display-fiscal-year');
    if (nameEl) nameEl.textContent = state.householdName;
    if (yearEl) yearEl.textContent = `会計年度: ${state.fiscalYear} 年度`;
}

export function showToast(msg) {
    const toast = document.getElementById('toast-notification');
    const msgEl = document.getElementById('toast-message');
    if (!toast || !msgEl) return;
    msgEl.textContent = msg;
    toast.classList.remove('translate-y-20', 'opacity-0');
    toast.classList.add('translate-y-0', 'opacity-100');
    setTimeout(() => {
        toast.classList.remove('translate-y-0', 'opacity-100');
        toast.classList.add('translate-y-20', 'opacity-0');
    }, 3000);
}

// --- 取引の編集・コピー・削除・モーダル制御 ---

export function closeTxEditModal() {
    const modal = document.getElementById('tx-edit-modal');
    if (modal) modal.classList.add('hidden');
}

window.openTxEditModal = function(id) {
    const state = store.getState();
    const t = state.transactions.find(item => item.id === id);
    if (!t) return;

    document.getElementById('edit-tx-id').value = t.id;
    document.getElementById('edit-tx-date').value = t.date;
    document.getElementById('edit-tx-amount').value = t.amount;
    document.getElementById('edit-tx-memo').value = t.memo || '';

    const debitAccSelect = document.getElementById('edit-debit-account');
    const creditAccSelect = document.getElementById('edit-credit-account');
    if (!debitAccSelect || !creditAccSelect) return;

    debitAccSelect.innerHTML = '';
    creditAccSelect.innerHTML = '';

    store.getAllAccountNames().forEach(acc => {
        debitAccSelect.appendChild(new Option(acc, acc));
        creditAccSelect.appendChild(new Option(acc, acc));
    });

    debitAccSelect.value = t.debit.acc;
    updateEditSubAccounts('debit');
    document.getElementById('edit-debit-sub').value = t.debit.sub || '';

    creditAccSelect.value = t.credit.acc;
    updateEditSubAccounts('credit');
    document.getElementById('edit-credit-sub').value = t.credit.sub || '';

    const modal = document.getElementById('tx-edit-modal');
    if (modal) modal.classList.remove('hidden');
    if (window.lucide) lucide.createIcons();
};

function updateEditSubAccounts(side) {
    const accName = document.getElementById(`edit-${side}-account`)?.value;
    const subSelect = document.getElementById(`edit-${side}-sub`);
    if (!subSelect) return;
    subSelect.innerHTML = '<option value="">(補助なし)</option>';
    if (accName) {
        store.getSubAccounts(accName).forEach(s => {
            subSelect.appendChild(new Option(s, s));
        });
    }
}

export function setupEditModalEvents() {
    const editForm = document.getElementById('tx-edit-form');
    const debitAccSelect = document.getElementById('edit-debit-account');
    const creditAccSelect = document.getElementById('edit-credit-account');

    // ★追加: 勘定科目が変更されたら、対応する補助科目の選択肢を動的に更新する
    if (debitAccSelect) {
        debitAccSelect.onchange = () => updateEditSubAccounts('debit');
    }
    if (creditAccSelect) {
        creditAccSelect.onchange = () => updateEditSubAccounts('credit');
    }

    if (editForm) {
        editForm.onsubmit = (e) => {
            e.preventDefault();
            const id = document.getElementById('edit-tx-id').value;
            const state = store.getState();
            const idx = state.transactions.findIndex(item => item.id === id);
            
            if (idx !== -1) {
                state.transactions[idx] = {
                    id,
                    date: document.getElementById('edit-tx-date').value,
                    debit: {
                        acc: debitAccSelect.value,
                        sub: document.getElementById('edit-debit-sub').value
                    },
                    credit: {
                        acc: creditAccSelect.value,
                        sub: document.getElementById('edit-credit-sub').value
                    },
                    amount: Number(document.getElementById('edit-tx-amount').value),
                    memo: document.getElementById('edit-tx-memo').value
                };

                store.setState(state);
                closeTxEditModal();
                
                window.dispatchEvent(new CustomEvent('kakeibo-data-loaded'));
                showToast('取引データを更新しました。');
            }
        };
    }

    const closeBtn = document.getElementById('btn-close-edit-modal');
    if (closeBtn) closeBtn.onclick = closeTxEditModal;

    const cancelBtn = document.getElementById('btn-cancel-edit');
    if (cancelBtn) cancelBtn.onclick = closeTxEditModal;
}

window.copyTransaction = function(id) {
    const state = store.getState();
    const t = state.transactions.find(item => item.id === id);
    if (!t) return;

    const copied = {
        id: Date.now().toString(),
        date: t.date,
        debit: { acc: t.debit.acc, sub: t.debit.sub },
        credit: { acc: t.credit.acc, sub: t.credit.sub },
        amount: t.amount,
        memo: t.memo
    };

    state.transactions.unshift(copied);
    store.setState(state);
    window.dispatchEvent(new CustomEvent('kakeibo-data-loaded'));
    showToast('取引をコピーして履歴に追加しました。');
};

window.deleteTransaction = function(id) {
    if (confirm('この仕訳データを削除しますか？')) {
        const state = store.getState();
        state.transactions = state.transactions.filter(item => item.id !== id);
        store.setState(state);
        window.dispatchEvent(new CustomEvent('kakeibo-data-loaded'));
        showToast('仕訳データを削除しました。');
    }
};