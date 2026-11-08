import { store } from '../store.js';
import { calculateAccountBalance } from '../accounting.js';
import { showToast, updateAppHeader } from '../main.js';

let activeTemplateCategory = '共通';

export async function initDashboard() {
    await renderDashboardHtml();
    const txDateEl = document.getElementById('tx-date');
    if (txDateEl) txDateEl.valueAsDate = new Date();

    document.getElementById('transaction-form')?.addEventListener('submit', handleTransactionSubmit);
    document.getElementById('input-mode')?.addEventListener('change', toggleInputMode);
    document.getElementById('simple-type')?.addEventListener('change', updateSimpleOptions);
    document.getElementById('simple-cat1')?.addEventListener('change', updateSimpleSub1);
    document.getElementById('simple-cat2')?.addEventListener('change', updateSimpleSub2);
    document.getElementById('comp-debit-account')?.addEventListener('change', () => updateSubAccounts('debit'));
    document.getElementById('comp-credit-account')?.addEventListener('change', () => updateSubAccounts('credit'));

    document.getElementById('btn-add-template')?.addEventListener('click', handleAddTemplate);

    updateDashboard();
}

async function renderDashboardHtml() {
    const container = document.getElementById('tab-dashboard');
    if (!container) return;
    try {
        const res = await fetch('./src/views/dashboard.html');
        if (!res.ok) throw new Error('Failed to load dashboard.html');
        container.innerHTML = await res.text();
        if (window.lucide) lucide.createIcons();
    } catch (e) {
        console.error(e);
    }
    updateSimpleOptions();
    updateCompoundOptions();
    renderTemplateSection();
}

export function updateDashboard() {
    const state = store.getState();
    let totalAst = 0;
    state.categories.assets.forEach(c => totalAst += calculateAccountBalance(c.name));
    const assetEl = document.getElementById('summary-total-assets');
    if (assetEl) assetEl.textContent = `¥${totalAst.toLocaleString()}`;

    let totalLiab = 0;
    state.categories.liabilities.forEach(c => totalLiab += calculateAccountBalance(c.name));
    const liabEl = document.getElementById('summary-total-liabilities');
    if (liabEl) liabEl.textContent = `¥${totalLiab.toLocaleString()}`;
    
    updateAppHeader();
}

function toggleInputMode() {
    const mode = document.getElementById('input-mode')?.value;
    const simpleContainer = document.getElementById('mode-simple-container');
    const compoundContainer = document.getElementById('mode-compound-container');
    if (!simpleContainer || !compoundContainer) return;

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
    const type = document.getElementById('simple-type')?.value;
    const cat1Select = document.getElementById('simple-cat1');
    const cat2Select = document.getElementById('simple-cat2');
    if (!cat1Select || !cat2Select) return;
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
    const accName = document.getElementById('simple-cat1')?.value;
    const subSelect = document.getElementById('simple-sub1');
    if (!subSelect) return;
    subSelect.innerHTML = '<option value="">(補助なし)</option>';
    if (accName) store.getSubAccounts(accName).forEach(s => subSelect.appendChild(new Option(s, s)));
}

function updateSimpleSub2() {
    const accName = document.getElementById('simple-cat2')?.value;
    const subSelect = document.getElementById('simple-sub2');
    if (!subSelect) return;
    subSelect.innerHTML = '<option value="">(補助なし)</option>';
    if (accName) store.getSubAccounts(accName).forEach(s => subSelect.appendChild(new Option(s, s)));
}

function updateCompoundOptions() {
    const debitAcc = document.getElementById('comp-debit-account');
    const creditAcc = document.getElementById('comp-credit-account');
    if (!debitAcc || !creditAcc) return;
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
    const accName = document.getElementById(`comp-${side}-account`)?.value;
    const subSelect = document.getElementById(`comp-${side}-sub`);
    if (!subSelect) return;
    subSelect.innerHTML = '<option value="">(補助なし)</option>';
    if (accName) store.getSubAccounts(accName).forEach(s => subSelect.appendChild(new Option(s, s)));
}

function handleTransactionSubmit(e) {
    e.preventDefault();
    const state = store.getState();
    const date = document.getElementById('tx-date')?.value;
    const amount = Number(document.getElementById('tx-amount')?.value);
    const memo = document.getElementById('tx-memo')?.value;
    const mode = document.getElementById('input-mode')?.value;

    let debit = { acc: '', sub: '' };
    let credit = { acc: '', sub: '' };

    if (mode === 'simple') {
        const type = document.getElementById('simple-type')?.value;
        const cat1 = document.getElementById('simple-cat1')?.value;
        const sub1 = document.getElementById('simple-sub1')?.value;
        const cat2 = document.getElementById('simple-cat2')?.value;
        const sub2 = document.getElementById('simple-sub2')?.value;

        if (type === 'expense' || type === 'income' || type === 'credit') {
            debit = { acc: cat1, sub: sub1 };
            credit = { acc: cat2, sub: sub2 };
        } else if (type === 'transfer') {
            debit = { acc: cat2, sub: sub2 };
            credit = { acc: cat1, sub: sub1 };
        }
    } else {
        debit = { acc: document.getElementById('comp-debit-account')?.value, sub: document.getElementById('comp-debit-sub')?.value };
        credit = { acc: document.getElementById('comp-credit-account')?.value, sub: document.getElementById('comp-credit-sub')?.value };
    }

    const newTx = { id: Date.now().toString(), date, debit, credit, amount, memo };
    state.transactions.unshift(newTx);
    store.setState(state);
    updateDashboard();
    showToast('仕訳を登録しました。');
    const amtEl = document.getElementById('tx-amount');
    const memoEl = document.getElementById('tx-memo');
    if (amtEl) amtEl.value = '';
    if (memoEl) memoEl.value = '';
}

function handleAddTemplate() {
    const name = prompt('登録するテンプレート名を入力してください (例: 昼食代、スマホ料金):');
    if (!name || !name.trim()) return;

    const category = prompt('カテゴリを入力してください (例: 共通, 固定費, 収入):', activeTemplateCategory || '共通') || '共通';

    const mode = document.getElementById('input-mode')?.value;
    let debitAcc = '', debitSub = '', creditAcc = '', creditSub = '';
    const amount = Number(document.getElementById('tx-amount')?.value) || 0;
    const memo = document.getElementById('tx-memo')?.value || '';

    if (mode === 'simple') {
        const type = document.getElementById('simple-type')?.value;
        const cat1 = document.getElementById('simple-cat1')?.value;
        const sub1 = document.getElementById('simple-sub1')?.value;
        const cat2 = document.getElementById('simple-cat2')?.value;
        const sub2 = document.getElementById('simple-sub2')?.value;

        if (type === 'expense' || type === 'income' || type === 'credit') {
            debitAcc = cat1; debitSub = sub1;
            creditAcc = cat2; creditSub = sub2;
        } else if (type === 'transfer') {
            debitAcc = cat2; debitSub = sub2;
            creditAcc = cat1; creditSub = sub1;
        }
    } else {
        debitAcc = document.getElementById('comp-debit-account')?.value;
        debitSub = document.getElementById('comp-debit-sub')?.value;
        creditAcc = document.getElementById('comp-credit-account')?.value;
        creditSub = document.getElementById('comp-credit-sub')?.value;
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
    const modeEl = document.getElementById('input-mode');
    if (modeEl) modeEl.value = 'compound';
    toggleInputMode();
    const debitAccEl = document.getElementById('comp-debit-account');
    if (debitAccEl) debitAccEl.value = tpl.debitAcc;
    updateSubAccounts('debit');
    const debitSubEl = document.getElementById('comp-debit-sub');
    if (debitSubEl) debitSubEl.value = tpl.debitSub || '';
    const creditAccEl = document.getElementById('comp-credit-account');
    if (creditAccEl) creditAccEl.value = tpl.creditAcc;
    updateSubAccounts('credit');
    const creditSubEl = document.getElementById('comp-credit-sub');
    if (creditSubEl) creditSubEl.value = tpl.creditSub || '';
    const amtEl = document.getElementById('tx-amount');
    if (amtEl) amtEl.value = tpl.amount;
    const memoEl = document.getElementById('tx-memo');
    if (memoEl) memoEl.value = tpl.memo;
    showToast(`テンプレート「${tpl.name}」を適用しました。`);
}