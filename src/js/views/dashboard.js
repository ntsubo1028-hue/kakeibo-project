import { store } from '../store.js';
import { calculateAccountBalance } from '../accounting.js';
import { showToast, updateAppHeader } from '../main.js';

let activeTemplateCategory = '共通';
let isTemplateEditMode = false; // 編集モードの状態（ON/OFF）

export async function initDashboard() {
    await renderDashboardHtml();
    const txDateEl = document.getElementById('tx-date');
    if (txDateEl) txDateEl.valueAsDate = new Date();

    document.getElementById('transaction-form')?.addEventListener('submit', handleTransactionSubmit);
    document.getElementById('input-mode')?.addEventListener('change', toggleInputMode);
    document.getElementById('simple-type')?.addEventListener('change', updateSimpleOptions);
    document.getElementById('simple-cat1')?.addEventListener('change', () => updateSubAccountOptions(document.getElementById('simple-cat1')?.value, 'simple-sub1'));
    document.getElementById('simple-cat2')?.addEventListener('change', () => updateSubAccountOptions(document.getElementById('simple-cat2')?.value, 'simple-sub2'));
    document.getElementById('comp-debit-account')?.addEventListener('change', () => updateSubAccountOptions(document.getElementById('comp-debit-account')?.value, 'comp-debit-sub'));
    document.getElementById('comp-credit-account')?.addEventListener('change', () => updateSubAccountOptions(document.getElementById('comp-credit-account')?.value, 'comp-credit-sub'));

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
    
    // ★ ログイン後やデータ読み込み時に、最新のデータベース（ストア）から科目リストを必ず再構築する
    updateSimpleOptions();
    updateCompoundOptions();
    renderTemplateSection();
    
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

// サブ勘定更新の共通ヘルパー
function updateSubAccountOptions(accName, subSelectId) {
    const subSelect = document.getElementById(subSelectId);
    if (!subSelect) return;
    subSelect.innerHTML = '<option value="">(補助なし)</option>';
    if (accName) {
        store.getSubAccounts(accName).forEach(s => {
            subSelect.appendChild(new Option(s, s));
        });
    }
}

// データベース（ストア）の最新カテゴリから通常モードの選択肢を動的に生成する
function updateSimpleOptions() {
    const type = document.getElementById('simple-type')?.value;
    const cat1Select = document.getElementById('simple-cat1');
    const cat2Select = document.getElementById('simple-cat2');
    if (!cat1Select || !cat2Select) return;
    
    // 現在選択されている値を保持（可能であれば維持するため）
    const currentVal1 = cat1Select.value;
    const currentVal2 = cat2Select.value;

    cat1Select.innerHTML = ''; 
    cat2Select.innerHTML = '';
    const state = store.getState();

    let list1 = [], list2 = [];
    const allAssetsAndLiabilities = [...state.categories.assets, ...state.categories.liabilities];

    if (type === 'expense') {
        list1 = state.categories.expenses;
        list2 = allAssetsAndLiabilities;
    } else if (type === 'income') {
        list1 = allAssetsAndLiabilities;
        list2 = state.categories.income;
    } else if (type === 'transfer') {
        list1 = allAssetsAndLiabilities;
        list2 = allAssetsAndLiabilities;
    } else if (type === 'credit') {
        list1 = state.categories.expenses;
        list2 = state.categories.liabilities;
    }

    list1.forEach(c => cat1Select.appendChild(new Option(c.name, c.name)));
    list2.forEach(c => cat2Select.appendChild(new Option(c.name, c.name)));

    // 可能なら元の選択状態を復元、なければ先頭
    if (currentVal1) cat1Select.value = currentVal1;
    if (currentVal2) cat2Select.value = currentVal2;

    updateSubAccountOptions(cat1Select.value, 'simple-sub1');
    updateSubAccountOptions(cat2Select.value, 'simple-sub2');
}

function updateCompoundOptions() {
    const debitAcc = document.getElementById('comp-debit-account');
    const creditAcc = document.getElementById('comp-credit-account');
    if (!debitAcc || !creditAcc) return;
    
    const currentDebit = debitAcc.value;
    const currentCredit = creditAcc.value;

    debitAcc.innerHTML = ''; 
    creditAcc.innerHTML = '';
    const allAccs = store.getAllAccountNames();
    allAccs.forEach(acc => {
        debitAcc.appendChild(new Option(acc, acc));
        creditAcc.appendChild(new Option(acc, acc));
    });

    if (currentDebit) debitAcc.value = currentDebit;
    if (currentCredit) creditAcc.value = currentCredit;

    updateSubAccountOptions(debitAcc.value, 'comp-debit-sub');
    updateSubAccountOptions(creditAcc.value, 'comp-credit-sub');
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

        if (type === 'expense' || type === 'credit') {
            debit = { acc: cat1, sub: sub1 };
            credit = { acc: cat2, sub: sub2 };
        } else if (type === 'income') {
            debit = { acc: cat2, sub: sub2 };
            credit = { acc: cat1, sub: sub1 };
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

    const categoryInput = prompt('カテゴリを入力してください (例: 共通, 固定費, 収入):', activeTemplateCategory || '共通');
    if (categoryInput === null) return;
    const category = categoryInput.trim() || '共通';

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

        if (type === 'expense' || type === 'credit') {
            debitAcc = cat1; debitSub = sub1;
            creditAcc = cat2; creditSub = sub2;
        } else if (type === 'income') {
            debitAcc = cat2; debitSub = sub2;
            creditAcc = cat1; creditSub = sub1;
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
        category,
        debitAcc,
        debitSub,
        creditAcc,
        creditSub,
        amount,
        memo
    };

    state.templates.push(newTpl);
    activeTemplateCategory = category;
    store.setState(state);
    renderTemplateSection();
    showToast(`テンプレート「${newTpl.name}」を登録しました。`);
}

function renderTemplateSection() {
    const tabsContainer = document.getElementById('template-category-tabs');
    const extraControlsContainer = document.getElementById('template-extra-controls');
    const buttonsContainer = document.getElementById('template-buttons-container');
    if (!tabsContainer || !extraControlsContainer || !buttonsContainer) return;

    tabsContainer.innerHTML = ''; 
    extraControlsContainer.innerHTML = ''; 
    buttonsContainer.innerHTML = '';

    const state = store.getState();
    if (!state.templates) state.templates = [];

    if (state.templates.length === 0) {
        buttonsContainer.innerHTML = '<span class="text-[11px] text-slate-400">よく使う仕訳はありません。「現在の内容を登録」から追加できます。</span>';
        return;
    }

    const categories = [...new Set(state.templates.map(t => t.category || '共通'))];
    if (!categories.includes(activeTemplateCategory)) {
        activeTemplateCategory = categories.length > 0 ? categories[0] : '共通';
    }

    renderTemplateCategories(tabsContainer, extraControlsContainer, categories);
    renderTemplateButtons(buttonsContainer, state.templates);

    if (window.lucide) lucide.createIcons();
}

// カテゴリタブと操作ボタンの描画
function renderTemplateCategories(tabsContainer, extraControlsContainer, categories) {
    categories.forEach(cat => {
        const isSelected = (cat === activeTemplateCategory);
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = `h-7 px-2.5 text-xs font-bold rounded-lg inline-flex items-center justify-center transition ${isSelected ? 'bg-emerald-600 text-white shadow-sm' : 'bg-slate-200 hover:bg-slate-300 text-slate-700'}`;
        btn.textContent = cat;
        btn.onclick = () => { activeTemplateCategory = cat; renderTemplateSection(); };
        tabsContainer.appendChild(btn);
    });

    const editModeToggleBtn = document.createElement('button');
    editModeToggleBtn.type = 'button';
    editModeToggleBtn.className = `h-7 px-2.5 text-xs rounded-lg inline-flex items-center justify-center gap-1.5 transition font-medium ${isTemplateEditMode ? 'bg-amber-500 text-white shadow-sm' : 'bg-slate-100 hover:bg-slate-200 text-slate-600 border border-slate-300'}`;
    editModeToggleBtn.innerHTML = `<i data-lucide="${isTemplateEditMode ? 'check' : 'settings'}" class="w-3.5 h-3.5"></i><span>${isTemplateEditMode ? '完了' : '編集モード'}</span>`;
    editModeToggleBtn.onclick = () => {
        isTemplateEditMode = !isTemplateEditMode;
        renderTemplateSection();
    };
    extraControlsContainer.appendChild(editModeToggleBtn);

    if (isTemplateEditMode) {
        const renameCatBtn = document.createElement('button');
        renameCatBtn.type = 'button';
        renameCatBtn.className = "h-7 w-7 text-slate-600 hover:text-blue-600 bg-slate-100 hover:bg-slate-200 rounded-lg inline-flex items-center justify-center transition border border-slate-300";
        renameCatBtn.title = `カテゴリ「${activeTemplateCategory}」の名前を変更`;
        renameCatBtn.innerHTML = '<i data-lucide="edit-2" class="w-3.5 h-3.5"></i>';
        renameCatBtn.onclick = handleRenameCategory;
        extraControlsContainer.appendChild(renameCatBtn);

        const deleteCatBtn = document.createElement('button');
        deleteCatBtn.type = 'button';
        deleteCatBtn.className = "h-7 w-7 text-slate-600 hover:text-rose-600 bg-slate-100 hover:bg-slate-200 rounded-lg inline-flex items-center justify-center transition border border-slate-300";
        deleteCatBtn.title = `カテゴリ「${activeTemplateCategory}」を削除`;
        deleteCatBtn.innerHTML = '<i data-lucide="trash-2" class="w-3.5 h-3.5"></i>';
        deleteCatBtn.onclick = handleDeleteCategory;
        extraControlsContainer.appendChild(deleteCatBtn);
    }
}

// 仕訳ボタンの描画
function renderTemplateButtons(buttonsContainer, templates) {
    const currentCatTemplates = templates.filter(t => (t.category || '共通') === activeTemplateCategory);

    if (currentCatTemplates.length === 0) {
        buttonsContainer.innerHTML = '<span class="text-[11px] text-slate-400">このカテゴリにはよく使う仕訳がありません。</span>';
        return;
    }

    const listWrapper = document.createElement('div');
    listWrapper.className = "flex flex-wrap gap-1.5 items-center";

    currentCatTemplates.forEach((tpl, idx) => {
        const wrapper = document.createElement('div');
        wrapper.className = "inline-flex items-center bg-white border border-slate-200 hover:border-emerald-500 rounded-md shadow-2xs text-xs overflow-hidden h-7";

        const btn = document.createElement('button');
        btn.type = 'button';
        const maxWidthClass = isTemplateEditMode ? 'max-w-[100px] sm:max-w-[130px]' : 'max-w-[150px] sm:max-w-[180px]';
        btn.className = `h-7 px-2.5 font-medium text-slate-700 hover:text-emerald-700 inline-flex items-center transition text-left truncate ${maxWidthClass}`;
        btn.textContent = tpl.name;
        btn.title = tpl.name;
        btn.onclick = () => {
            if (!isTemplateEditMode) {
                applyTemplate(tpl);
            }
        };

        wrapper.appendChild(btn);

        if (isTemplateEditMode) {
            const actionsDiv = document.createElement('div');
            actionsDiv.className = "flex items-center h-full border-l border-slate-200 bg-slate-50 shrink-0";

            const moveLeftBtn = document.createElement('button');
            moveLeftBtn.type = 'button';
            moveLeftBtn.className = `h-7 w-6 inline-flex items-center justify-center text-slate-400 hover:text-slate-700 transition ${idx === 0 ? 'opacity-25 cursor-not-allowed' : ''}`;
            moveLeftBtn.title = "左へ移動";
            moveLeftBtn.innerHTML = '<i data-lucide="chevron-left" class="w-3 h-3"></i>';
            moveLeftBtn.onclick = (e) => {
                e.stopPropagation();
                if (idx > 0) handleMoveTemplate(tpl.id, -1);
            };

            const moveRightBtn = document.createElement('button');
            moveRightBtn.type = 'button';
            moveRightBtn.className = `h-7 w-6 inline-flex items-center justify-center text-slate-400 hover:text-slate-700 transition ${idx === currentCatTemplates.length - 1 ? 'opacity-25 cursor-not-allowed' : ''}`;
            moveRightBtn.title = "右へ移動";
            moveRightBtn.innerHTML = '<i data-lucide="chevron-right" class="w-3 h-3"></i>';
            moveRightBtn.onclick = (e) => {
                e.stopPropagation();
                if (idx < currentCatTemplates.length - 1) handleMoveTemplate(tpl.id, 1);
            };

            const editBtn = document.createElement('button');
            editBtn.type = 'button';
            editBtn.className = "h-7 w-6 inline-flex items-center justify-center text-slate-400 hover:text-blue-600 transition";
            editBtn.title = "編集";
            editBtn.innerHTML = '<i data-lucide="edit-2" class="w-3 h-3"></i>';
            editBtn.onclick = (e) => {
                e.stopPropagation();
                handleEditTemplate(tpl.id);
            };

            const delBtn = document.createElement('button');
            delBtn.type = 'button';
            delBtn.className = "h-7 w-6 inline-flex items-center justify-center text-slate-400 hover:text-rose-600 transition";
            delBtn.title = "削除";
            delBtn.innerHTML = '<i data-lucide="trash-2" class="w-3 h-3"></i>';
            delBtn.onclick = (e) => {
                e.stopPropagation();
                handleDeleteTemplate(tpl.id);
            };

            actionsDiv.appendChild(moveLeftBtn);
            actionsDiv.appendChild(moveRightBtn);
            actionsDiv.appendChild(editBtn);
            actionsDiv.appendChild(delBtn);

            wrapper.appendChild(actionsDiv);
        }

        listWrapper.appendChild(wrapper);
    });

    buttonsContainer.appendChild(listWrapper);
}

function handleMoveTemplate(id, direction) {
    const state = store.getState();
    const templates = state.templates;
    const catTemplates = templates.filter(t => (t.category || '共通') === activeTemplateCategory);
    const indexInCat = catTemplates.findIndex(t => t.id === id);
    if (indexInCat === -1) return;

    const targetIndexInCat = indexInCat + direction;
    if (targetIndexInCat < 0 || targetIndexInCat >= catTemplates.length) return;

    const t1 = catTemplates[indexInCat];
    const t2 = catTemplates[targetIndexInCat];
    const idx1 = templates.findIndex(t => t.id === t1.id);
    const idx2 = templates.findIndex(t => t.id === t2.id);

    templates[idx1] = t2;
    templates[idx2] = t1;

    store.setState(state);
    renderTemplateSection();
}

function handleRenameCategory() {
    const oldCat = activeTemplateCategory;
    const newCatInput = prompt(`「${oldCat}」カテゴリの新しい名前を入力してください:`, oldCat);
    if (newCatInput === null) return;
    const newCat = newCatInput.trim();
    if (!newCat) return;

    const state = store.getState();
    state.templates.forEach(t => {
        if ((t.category || '共通') === oldCat) {
            t.category = newCat;
        }
    });
    activeTemplateCategory = newCat;
    store.setState(state);
    renderTemplateSection();
    showToast(`カテゴリ名を「${newCat}」に変更しました。`);
}

function handleDeleteCategory() {
    const catToDelete = activeTemplateCategory;
    if (!confirm(`カテゴリ「${catToDelete}」および属するすべてのテンプレートを削除してもよろしいですか？`)) return;

    const state = store.getState();
    state.templates = state.templates.filter(t => (t.category || '共通') !== catToDelete);
    activeTemplateCategory = '共通';
    store.setState(state);
    renderTemplateSection();
    showToast(`カテゴリ「${catToDelete}」を削除しました。`);
}

function handleEditTemplate(id) {
    const state = store.getState();
    const tpl = state.templates.find(t => t.id === id);
    if (!tpl) return;

    const newName = prompt('テンプレート名を変更:', tpl.name);
    if (newName === null) return;
    const newCat = prompt('カテゴリを変更:', tpl.category || '共通');
    if (newCat === null) return;

    tpl.name = newName.trim() || tpl.name;
    tpl.category = newCat.trim() || '共通';
    activeTemplateCategory = tpl.category;

    store.setState(state);
    renderTemplateSection();
    showToast('テンプレートを更新しました。');
}

function handleDeleteTemplate(id) {
    if (!confirm('このよく使う仕訳（テンプレート）を削除してもよろしいですか？')) return;
    const state = store.getState();
    state.templates = state.templates.filter(t => t.id !== id);
    store.setState(state);
    renderTemplateSection();
    showToast('テンプレートを削除しました。');
}

function applyTemplate(tpl) {
    const modeEl = document.getElementById('input-mode');
    if (modeEl) modeEl.value = 'compound';
    toggleInputMode();
    const debitAccEl = document.getElementById('comp-debit-account');
    if (debitAccEl) debitAccEl.value = tpl.debitAcc;
    updateSubAccountOptions(tpl.debitAcc, 'comp-debit-sub');
    const debitSubEl = document.getElementById('comp-debit-sub');
    if (debitSubEl) debitSubEl.value = tpl.debitSub || '';
    const creditAccEl = document.getElementById('comp-credit-account');
    if (creditAccEl) creditAccEl.value = tpl.creditAcc;
    updateSubAccountOptions(tpl.creditAcc, 'comp-credit-sub');
    const creditSubEl = document.getElementById('comp-credit-sub');
    if (creditSubEl) creditSubEl.value = tpl.creditSub || '';
    const amtEl = document.getElementById('tx-amount');
    if (amtEl) amtEl.value = tpl.amount;
    const memoEl = document.getElementById('tx-memo');
    if (memoEl) memoEl.value = tpl.memo;
    showToast(`テンプレート「${tpl.name}」を適用しました。`);
}