import { store } from '../store.js';
import { calculateAccountBalance } from '../accounting.js';
import { showToast, updateAppHeader } from '../main.js';

let activeTemplateCategory = '共通';

export function initDashboard() {
    renderDashboardHtml();
    const txDateEl = document.getElementById('tx-date');
    if (txDateEl) txDateEl.valueAsDate = new Date();

    document.getElementById('transaction-form').addEventListener('submit', handleTransactionSubmit);
    document.getElementById('input-mode').addEventListener('change', toggleInputMode);
    document.getElementById('simple-type').addEventListener('change', updateSimpleOptions);
    document.getElementById('simple-cat1').addEventListener('change', updateSimpleSub1);
    document.getElementById('simple-cat2').addEventListener('change', updateSimpleSub2);
    document.getElementById('comp-debit-account').addEventListener('change', () => updateSubAccounts('debit'));
    document.getElementById('comp-credit-account').addEventListener('change', () => updateSubAccounts('credit'));

    // ★追加: テンプレート登録ボタンのイベント配線
    document.getElementById('btn-add-template')?.addEventListener('click', handleAddTemplate);

    updateDashboard();
}

function renderDashboardHtml() {
    const container = document.getElementById('tab-dashboard');
    container.innerHTML = `
        <div class="grid grid-cols-2 md:grid-cols-4 gap-2 no-print">
            <div class="bg-white p-2.5 rounded-lg shadow-sm border border-slate-200">
                <div class="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-0.5">総資産残高</div>
                <div class="text-xs sm:text-lg font-extrabold text-slate-900 truncate" id="summary-total-assets">¥0</div>
            </div>
            <div class="bg-white p-2.5 rounded-lg shadow-sm border border-slate-200">
                <div class="text-[10px] font-semibold text-rose-600 uppercase tracking-wider mb-0.5">負債合計</div>
                <div class="text-xs sm:text-lg font-extrabold text-rose-700 truncate" id="summary-total-liabilities">¥0</div>
            </div>
            <div class="bg-white p-2.5 rounded-lg shadow-sm border border-slate-200">
                <div class="text-[10px] font-semibold text-emerald-600 uppercase tracking-wider mb-0.5">当月収入</div>
                <div class="text-xs sm:text-lg font-extrabold text-emerald-700 truncate" id="summary-month-income">¥0</div>
            </div>
            <div class="bg-white p-2.5 rounded-lg shadow-sm border border-slate-200">
                <div class="text-[10px] font-semibold text-indigo-600 uppercase tracking-wider mb-0.5">当月支出</div>
                <div class="text-xs sm:text-lg font-extrabold text-indigo-700 truncate" id="summary-month-expense">¥0</div>
            </div>
        </div>

        <div class="bg-white rounded-lg shadow-sm border border-slate-200 p-2.5 sm:p-3">
            <div class="flex justify-between items-center mb-2 border-b pb-1.5">
                <h2 class="text-xs sm:text-sm font-bold text-slate-800 flex items-center gap-1.5">
                    <i data-lucide="plus-circle" class="w-4 h-4 text-emerald-600"></i> 新規取引の記帳 (複式仕訳)
                </h2>
                <div class="flex items-center gap-2 text-xs">
                    <span class="text-slate-500 font-medium">入力モード:</span>
                    <select id="input-mode" class="p-1 border rounded bg-slate-50 font-semibold text-slate-700 text-xs">
                        <option value="simple" selected>通常モード (簡単)</option>
                        <option value="compound">複式自由モード (借方/貸方指定)</option>
                    </select>
                </div>
            </div>

            <div class="mb-2.5 bg-slate-50 p-1.5 rounded-md border border-slate-200 space-y-2">
                <div class="flex flex-wrap items-center justify-between gap-1.5 border-b pb-1.5">
                    <span class="text-[11px] font-bold text-slate-600 flex items-center gap-1"><i data-lucide="bookmark" class="w-3 h-3"></i> よく使う仕訳:</span>
                    <div class="flex items-center gap-2">
                        <div id="template-category-tabs" class="flex flex-wrap gap-1"></div>
                        <button type="button" id="btn-add-template" class="px-2 py-0.5 bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-semibold rounded shadow-sm transition flex items-center gap-1">
                            <i data-lucide="plus" class="w-3 h-3"></i> 現在の内容を登録
                        </button>
                    </div>
                </div>
                <div id="template-buttons-container" class="flex flex-wrap gap-1 min-h-[28px] items-center"></div>
            </div>

            <form id="transaction-form" class="space-y-2.5">
                <div class="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <div>
                        <label class="block text-[11px] font-semibold text-slate-600 mb-0.5">日付</label>
                        <input type="date" id="tx-date" required class="w-full text-xs p-1.5 border border-slate-300 rounded">
                    </div>
                    <div class="sm:col-span-2">
                        <label class="block text-[11px] font-semibold text-slate-600 mb-0.5">摘要 / メモ</label>
                        <input type="text" id="tx-memo" placeholder="例: スーパーで食材購入" class="w-full text-xs p-1.5 border border-slate-300 rounded">
                    </div>
                </div>

                <div id="mode-simple-container" class="space-y-2 bg-emerald-50/40 p-2.5 rounded-md border border-emerald-100">
                    <div>
                        <label class="block text-[11px] font-semibold text-slate-700 mb-0.5">取引種別</label>
                        <select id="simple-type" class="w-full sm:w-1/3 text-xs p-1.5 border border-slate-300 rounded bg-white font-semibold">
                            <option value="expense">日常の支出 (費用発生)</option>
                            <option value="income">収入 (給与・売上等)</option>
                            <option value="transfer">口座振替・引き出し</option>
                            <option value="credit">クレジット利用 (未払金)</option>
                        </select>
                    </div>
                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-0.5">
                        <div class="bg-white p-2 rounded border border-emerald-200 space-y-1.5">
                            <div class="text-[11px] font-bold text-emerald-900" id="simple-group1-title">【1. 何に支払ったか (費用)】</div>
                            <div class="grid grid-cols-2 gap-2">
                                <div><label class="block text-[10px] font-semibold text-slate-600 mb-0.5" id="simple-cat1-label">科目</label><select id="simple-cat1" class="w-full text-xs p-1.5 border rounded"></select></div>
                                <div><label class="block text-[10px] font-semibold text-slate-600 mb-0.5">補助科目</label><select id="simple-sub1" class="w-full text-xs p-1.5 border rounded"><option value="">(補助なし)</option></select></div>
                            </div>
                        </div>
                        <div class="bg-white p-2 rounded border border-emerald-200 space-y-1.5">
                            <div class="text-[11px] font-bold text-emerald-900" id="simple-group2-title">【2. どこから支払ったか】</div>
                            <div class="grid grid-cols-2 gap-2">
                                <div><label class="block text-[10px] font-semibold text-slate-600 mb-0.5" id="simple-cat2-label">科目</label><select id="simple-cat2" class="w-full text-xs p-1.5 border rounded"></select></div>
                                <div><label class="block text-[10px] font-semibold text-slate-600 mb-0.5">補助科目</label><select id="simple-sub2" class="w-full text-xs p-1.5 border rounded"><option value="">(補助なし)</option></select></div>
                            </div>
                        </div>
                    </div>
                </div>

                <div id="mode-compound-container" class="hidden grid grid-cols-1 sm:grid-cols-2 gap-2.5 bg-indigo-50/40 p-2.5 rounded-md border border-indigo-100">
                    <div class="space-y-1.5 border-b sm:border-b-0 sm:border-r border-indigo-200 pb-2 sm:pb-0 sm:pr-2.5">
                        <h3 class="text-[11px] font-bold text-indigo-900 uppercase">【借方 (Debit)】</h3>
                        <div class="grid grid-cols-2 gap-2">
                            <div><label class="block text-[10px] font-semibold text-slate-600 mb-0.5">科目</label><select id="comp-debit-account" class="w-full text-xs p-1.5 border rounded"></select></div>
                            <div><label class="block text-[10px] font-semibold text-slate-600 mb-0.5">補助</label><select id="comp-debit-sub" class="w-full text-xs p-1.5 border rounded"><option value="">(補助なし)</option></select></div>
                        </div>
                    </div>
                    <div class="space-y-1.5">
                        <h3 class="text-[11px] font-bold text-indigo-900 uppercase">【貸方 (Credit)】</h3>
                        <div class="grid grid-cols-2 gap-2">
                            <div><label class="block text-[10px] font-semibold text-slate-600 mb-0.5">科目</label><select id="comp-credit-account" class="w-full text-xs p-1.5 border rounded"></select></div>
                            <div><label class="block text-[10px] font-semibold text-slate-600 mb-0.5">補助</label><select id="comp-credit-sub" class="w-full text-xs p-1.5 border rounded"><option value="">(補助なし)</option></select></div>
                        </div>
                    </div>
                </div>

                <div class="grid grid-cols-1 sm:grid-cols-3 gap-2 items-end pt-0.5">
                    <div>
                        <label class="block text-[11px] font-semibold text-slate-600 mb-0.5">金額 (円)</label>
                        <input type="number" id="tx-amount" min="1" required placeholder="5000" class="w-full text-xs p-1.5 border border-slate-300 rounded font-bold">
                    </div>
                    <div class="sm:col-span-2 flex justify-end gap-2 items-center">
                        <button type="submit" class="px-5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded shadow transition flex items-center gap-1">
                            <i data-lucide="check" class="w-3.5 h-3.5"></i> 仕訳を登録する
                        </button>
                    </div>
                </div>
            </form>
        </div>
    `;
    updateSimpleOptions();
    updateCompoundOptions();
    renderTemplateSection();
}

export function updateDashboard() {
    const state = store.getState();
    let totalAst = 0;
    state.categories.assets.forEach(c => totalAst += calculateAccountBalance(c.name));
    document.getElementById('summary-total-assets').textContent = `¥${totalAst.toLocaleString()}`;

    let totalLiab = 0;
    state.categories.liabilities.forEach(c => totalLiab += calculateAccountBalance(c.name));
    document.getElementById('summary-total-liabilities').textContent = `¥${totalLiab.toLocaleString()}`;
    
    updateAppHeader();
}

function toggleInputMode() {
    const mode = document.getElementById('input-mode').value;
    const simpleContainer = document.getElementById('mode-simple-container');
    const compoundContainer = document.getElementById('mode-compound-container');
    if (mode === 'simple') {
        simpleContainer.classList.remove('hidden');
        compoundContainer.classList.add('hidden');
    } else {
        simpleContainer.classList.add('hidden');
        compoundContainer.classList.remove('hidden');
        updateCompoundOptions();
    }
}

function updateSimpleOptions() {
    const type = document.getElementById('simple-type').value;
    const cat1Select = document.getElementById('simple-cat1');
    const cat2Select = document.getElementById('simple-cat2');
    cat1Select.innerHTML = ''; cat2Select.innerHTML = '';
    const state = store.getState();

    let list1 = [], list2 = [];
    if (type === 'expense') {
        list1 = state.categories.expenses;
        list2 = [...state.categories.assets, ...state.categories.liabilities];
    } else if (type === 'income') {
        list1 = state.categories.assets;
        list2 = state.categories.income;
    } else if (type === 'transfer') {
        list1 = state.categories.assets;
        list2 = state.categories.assets;
    } else if (type === 'credit') {
        list1 = state.categories.expenses;
        list2 = state.categories.liabilities;
    }

    list1.forEach(c => cat1Select.appendChild(new Option(c.name, c.name)));
    list2.forEach(c => cat2Select.appendChild(new Option(c.name, c.name)));
    updateSimpleSub1();
    updateSimpleSub2();
}

function updateSimpleSub1() {
    const accName = document.getElementById('simple-cat1').value;
    const subSelect = document.getElementById('simple-sub1');
    subSelect.innerHTML = '<option value="">(補助なし)</option>';
    store.getSubAccounts(accName).forEach(s => subSelect.appendChild(new Option(s, s)));
}

function updateSimpleSub2() {
    const accName = document.getElementById('simple-cat2').value;
    const subSelect = document.getElementById('simple-sub2');
    subSelect.innerHTML = '<option value="">(補助なし)</option>';
    store.getSubAccounts(accName).forEach(s => subSelect.appendChild(new Option(s, s)));
}

function updateCompoundOptions() {
    const debitAcc = document.getElementById('comp-debit-account');
    const creditAcc = document.getElementById('comp-credit-account');
    debitAcc.innerHTML = ''; creditAcc.innerHTML = '';
    const allAccs = store.getAllAccountNames();
    allAccs.forEach(acc => {
        debitAcc.appendChild(new Option(acc, acc));
        creditAcc.appendChild(new Option(acc, acc));
    });
    updateSubAccounts('debit');
    updateSubAccounts('credit');
}

function updateSubAccounts(side) {
    const accName = document.getElementById(`comp-${side}-account`).value;
    const subSelect = document.getElementById(`comp-${side}-sub`);
    subSelect.innerHTML = '<option value="">(補助なし)</option>';
    store.getSubAccounts(accName).forEach(s => subSelect.appendChild(new Option(s, s)));
}

function handleTransactionSubmit(e) {
    e.preventDefault();
    const state = store.getState();
    const date = document.getElementById('tx-date').value;
    const amount = Number(document.getElementById('tx-amount').value);
    const memo = document.getElementById('tx-memo').value;
    const mode = document.getElementById('input-mode').value;

    let debit = { acc: '', sub: '' };
    let credit = { acc: '', sub: '' };

    if (mode === 'simple') {
        const type = document.getElementById('simple-type').value;
        const cat1 = document.getElementById('simple-cat1').value;
        const sub1 = document.getElementById('simple-sub1').value;
        const cat2 = document.getElementById('simple-cat2').value;
        const sub2 = document.getElementById('simple-sub2').value;

        if (type === 'expense' || type === 'income' || type === 'credit') {
            debit = { acc: cat1, sub: sub1 };
            credit = { acc: cat2, sub: sub2 };
        } else if (type === 'transfer') {
            debit = { acc: cat2, sub: sub2 };
            credit = { acc: cat1, sub: sub1 };
        }
    } else {
        debit = { acc: document.getElementById('comp-debit-account').value, sub: document.getElementById('comp-debit-sub').value };
        credit = { acc: document.getElementById('comp-credit-account').value, sub: document.getElementById('comp-credit-sub').value };
    }

    const newTx = { id: Date.now().toString(), date, debit, credit, amount, memo };
    state.transactions.unshift(newTx);
    store.setState(state);
    updateDashboard();
    showToast('仕訳を登録しました。');
    document.getElementById('tx-amount').value = '';
    document.getElementById('tx-memo').value = '';
}

// ★追加: 現在の入力内容をテンプレートとして保存する処理
function handleAddTemplate() {
    const name = prompt('登録するテンプレート名を入力してください (例: 昼食代、スマホ料金):');
    if (!name || !name.trim()) return;

    const category = prompt('カテゴリを入力してください (例: 共通, 固定費, 収入):', activeTemplateCategory || '共通') || '共通';

    const mode = document.getElementById('input-mode').value;
    let debitAcc = '', debitSub = '', creditAcc = '', creditSub = '';
    const amount = Number(document.getElementById('tx-amount').value) || 0;
    const memo = document.getElementById('tx-memo').value || '';

    if (mode === 'simple') {
        const type = document.getElementById('simple-type').value;
        const cat1 = document.getElementById('simple-cat1').value;
        const sub1 = document.getElementById('simple-sub1').value;
        const cat2 = document.getElementById('simple-cat2').value;
        const sub2 = document.getElementById('simple-sub2').value;

        if (type === 'expense' || type === 'income' || type === 'credit') {
            debitAcc = cat1; debitSub = sub1;
            creditAcc = cat2; creditSub = sub2;
        } else if (type === 'transfer') {
            debitAcc = cat2; debitSub = sub2;
            creditAcc = cat1; creditSub = sub1;
        }
    } else {
        debitAcc = document.getElementById('comp-debit-account').value;
        debitSub = document.getElementById('comp-debit-sub').value;
        creditAcc = document.getElementById('comp-credit-account').value;
        creditSub = document.getElementById('comp-credit-sub').value;
    }

    if (!debitAcc || !creditAcc) {
        alert('借方・貸方の勘定科目が正しく選択されていません。');
        return;
    }

    const state = store.getState();
    if (!state.templates) state.templates = [];

    const newTpl = {
        id: Date.now().toString(),
        name: name.trim(),
        category: category.trim(),
        debitAcc,
        debitSub,
        creditAcc,
        creditSub,
        amount,
        memo
    };

    state.templates.push(newTpl);
    store.setState(state);
    renderTemplateSection();
    showToast(`テンプレート「${newTpl.name}」を登録しました。`);
}

function renderTemplateSection() {
    const tabsContainer = document.getElementById('template-category-tabs');
    const buttonsContainer = document.getElementById('template-buttons-container');
    if (!tabsContainer || !buttonsContainer) return;
    tabsContainer.innerHTML = ''; buttonsContainer.innerHTML = '';
    const state = store.getState();

    if (!state.templates || state.templates.length === 0) {
        buttonsContainer.innerHTML = '<span class="text-[11px] text-slate-400">テンプレートはありません。</span>';
        return;
    }

    const categories = [...new Set(state.templates.map(t => t.category || '共通'))];
    if (!categories.includes(activeTemplateCategory)) activeTemplateCategory = categories[0];

    categories.forEach(cat => {
        const isSelected = (cat === activeTemplateCategory);
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = `px-2 py-0.5 text-[11px] font-bold rounded transition ${isSelected ? 'bg-emerald-600 text-white shadow-sm' : 'bg-slate-200 hover:bg-slate-300 text-slate-700'}`;
        btn.textContent = cat;
        btn.onclick = () => { activeTemplateCategory = cat; renderTemplateSection(); };
        tabsContainer.appendChild(btn);
    });

    state.templates.filter(t => (t.category || '共通') === activeTemplateCategory).forEach(tpl => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = "px-2 py-0.5 bg-white border border-slate-300 hover:border-emerald-500 rounded text-[11px] font-medium text-slate-700 shadow-sm transition";
        btn.textContent = tpl.name;
        btn.onclick = () => applyTemplate(tpl);
        buttonsContainer.appendChild(btn);
    });
}

function applyTemplate(tpl) {
    document.getElementById('input-mode').value = 'compound';
    toggleInputMode();
    document.getElementById('comp-debit-account').value = tpl.debitAcc;
    updateSubAccounts('debit');
    document.getElementById('comp-debit-sub').value = tpl.debitSub || '';
    document.getElementById('comp-credit-account').value = tpl.creditAcc;
    updateSubAccounts('credit');
    document.getElementById('comp-credit-sub').value = tpl.creditSub || '';
    document.getElementById('tx-amount').value = tpl.amount;
    document.getElementById('tx-memo').value = tpl.memo;
    showToast(`テンプレート「${tpl.name}」を適用しました。`);
}