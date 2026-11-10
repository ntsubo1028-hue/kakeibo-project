import { store } from './store.js';
import { triggerFileInput, saveFileDirect, saveFileAs, triggerCsvImport, exportAllJournalCsv, handleFileSelect, handleCsvImport } from './db.js';
import { initDashboard, updateDashboard } from './views/dashboard.js';
import { initLedger, renderLedger, renderLedgerAccountDropdown } from './views/ledger.js';
import { initJournal, renderJournalTable } from './views/journal.js';
import { initStatements, renderFinancialStatements } from './views/statements.js';
import { initSettings, renderCategoryManagement } from './views/settings.js';

// DOM読み込み完了時の初期化処理
window.addEventListener('DOMContentLoaded', async () => {
    // Lucideアイコンの初期化
    if (window.lucide) lucide.createIcons();

    // 0. Firebase 認証の監視とUI切り替えの初期化
    store.initAuth(async (user) => {
        const loginBtn = document.getElementById('btn-google-login');
        const profileArea = document.getElementById('user-profile-area');
        const emailDisplay = document.getElementById('user-email-display');
        const localFileOnlyControls = document.getElementById('local-file-only-controls');
        const unsavedAlert = document.getElementById('unsaved-alert');
        const syncStatusText = document.getElementById('sync-status-text'); // ステータス表示要素

        if (user) {
            // ① Googleログイン中の場合
            if (loginBtn) loginBtn.classList.add('hidden');
            if (profileArea) {
                profileArea.classList.remove('hidden');
                profileArea.classList.add('flex');
            }
            if (emailDisplay) emailDisplay.textContent = user.email;
            
            // クラウド同期中は手動のファイル操作エリアおよび未保存アラートを非表示にする
            if (localFileOnlyControls) localFileOnlyControls.classList.add('hidden');
            if (unsavedAlert) unsavedAlert.classList.add('hidden');
            // ステータス表示をクラウド同期中に変更
            if (syncStatusText) {
                syncStatusText.textContent = "クラウド同期中";
                syncStatusText.className = "text-[10px] text-emerald-400 font-medium"; // 色を少し目立たせても綺麗です
            }
            showToast('クラウドデータベースと接続しました（自動保存中）。');
        } else {
            // ② 未ログイン（ローカル運用）の場合
            if (loginBtn) loginBtn.classList.remove('hidden');
            if (profileArea) profileArea.classList.add('hidden');
            if (emailDisplay) emailDisplay.textContent = '';
            
            // ローカル運用のときだけ手動のファイル操作エリアを表示する
            if (localFileOnlyControls) localFileOnlyControls.classList.remove('hidden');
            
            // ▼▼▼【ここに追加】ローカルファイルモード時も起動時は警告を隠す ▼▼▼
            if (unsavedAlert) unsavedAlert.classList.add('hidden');
            
            // ステータス表示をローカルファイルモードに変更
            if (syncStatusText) {
                syncStatusText.textContent = "ローカルファイルモード";
                syncStatusText.className = "text-[10px] text-slate-400";
            }
            showToast('ローカルファイルモードで動作しています。');
        }
        // 認証状態の変化やデータロードに合わせて年度プルダウンを更新
        await updateFiscalYearDropdown();
    });

    // ログイン・ログアウトボタンのクリックイベント配線
    document.getElementById('btn-google-login')?.addEventListener('click', () => {
        store.login();
    });

    document.getElementById('btn-logout')?.addEventListener('click', () => {
        if (confirm('ログアウトしますか？')) {
            store.logout();
            showToast('ログアウトしました。');
        }
    });

    // 会計年度セレクトボックスの変更イベント配線
    const fiscalYearSelect = document.getElementById('fiscal-year-select');
    if (fiscalYearSelect) {
        fiscalYearSelect.addEventListener('change', async (e) => {
            const newYear = Number(e.target.value);
            if (confirm(`${newYear}年度のデータに切り替えますか？`)) {
                showToast(`${newYear}年度のデータを読み込んでいます...`);
                await store.changeFiscalYear(newYear);
                showToast(`${newYear}年度のデータを読み込みました。`);
            } else {
                // キャンセルされた場合はセレクトボックスの表示を元に戻す
                fiscalYearSelect.value = store.getState().fiscalYear;
            }
        });
    }

    // 1. 各ビュー（ダッシュボード、元帳、仕訳帳、決算書、設定）の初期化
    initDashboard();
    initLedger();
    initJournal();
    initStatements();
    initSettings();

    // データベース上の存在年度に合わせてセレクトボックスを初期化
    await updateFiscalYearDropdown();

    // 2. 取引編集モーダルのイベント配線
    setupEditModalEvents();

    // 3. タブ切り替え機能の配線
    setupTabs();

    // 4. Undo / Redo ボタンおよびキーボードショートカットの配線
    setupUndoRedo();

    // 5. ヘッダーボタン・ファイル操作（JSON/CSV）のイベント配線
    document.getElementById('btn-open')?.addEventListener('click', triggerFileInput);
    document.getElementById('btn-save')?.addEventListener('click', saveFileDirect);
    document.getElementById('btn-save-as')?.addEventListener('click', saveFileAs);
    document.getElementById('btn-quick-save')?.addEventListener('click', saveFileDirect);
    document.getElementById('btn-csv-import')?.addEventListener('click', triggerCsvImport);
    document.getElementById('btn-csv-export')?.addEventListener('click', exportAllJournalCsv);
    document.getElementById('file-input')?.addEventListener('change', handleFileSelect);
    document.getElementById('csv-file-input')?.addEventListener('change', handleCsvImport);

    // データロード / 状態変更時の一括再描画イベントリスナー
    window.addEventListener('kakeibo-data-loaded', async () => {
        updateAppHeader();
        updateDashboard();
        renderLedgerAccountDropdown();
        renderLedger();
        renderJournalTable();
        renderFinancialStatements();
        renderCategoryManagement();
        updateUndoRedoButtonStates();
        
        // セレクトボックスの選択肢および状態も同期
        await updateFiscalYearDropdown();
    });

    updateAppHeader();
    updateUndoRedoButtonStates();
});

// タブ切り替え制御
function setupTabs() {
    const tabButtons = document.querySelectorAll('.tab-btn');
    tabButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const targetId = btn.getAttribute('data-tab');

            // 全てのタブコンテンツを非表示にし、ボタンのアクティブスタイルを解除
            document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
            document.querySelectorAll('.tab-btn').forEach(el => {
                el.classList.remove('text-emerald-400', 'border-emerald-400');
                el.classList.add('text-slate-300', 'border-transparent');
            });

            // 選択されたタブを表示し、アクティブスタイルを適用
            document.getElementById(targetId)?.classList.add('active');
            btn.classList.remove('text-slate-300', 'border-transparent');
            btn.classList.add('text-emerald-400', 'border-emerald-400');

            // タブごとの遅延レンダリング
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

    // キーボードショートカット (Ctrl+Z / Ctrl+Y / Ctrl+Shift+Z)
    window.addEventListener('keydown', (e) => {
        if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName)) return;

        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
            e.preventDefault();
            if (e.shiftKey) {
                if (store.redo()) {
                    window.dispatchEvent(new CustomEvent('kakeibo-data-loaded'));
                    showToast('操作をやり直しました。');
                }
            } else {
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

// ヘッダーの家計簿名などの更新
export function updateAppHeader() {
    const state = store.getState();
    const nameEl = document.getElementById('display-household-name');
    if (nameEl) nameEl.textContent = state.householdName;
}

// トースト通知の表示
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

// Firestore上のデータ存在状況をスキャンして、存在する年度だけを選択肢に並べる関数
async function updateFiscalYearDropdown() {
    const select = document.getElementById('fiscal-year-select');
    if (!select) return;

    // ストアから実際にデータが存在する年度リストを取得
    const availableYears = await store.getAvailableYears();

    select.innerHTML = '';
    availableYears.forEach(year => {
        const option = document.createElement('option');
        option.value = year;
        option.textContent = `${year}年度`;
        select.appendChild(option);
    });

    // 現在選択中の年度を反映
    select.value = store.getState().fiscalYear;
}