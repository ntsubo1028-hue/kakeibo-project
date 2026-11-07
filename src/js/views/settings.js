import { store } from '../store.js';
import { calculateAccountBalance, calculateSubAccountBalance } from '../accounting.js';
import { showToast, updateAppHeader } from '../main.js';

export function initSettings() {
    renderSettingsHtml();
}

function renderSettingsHtml() {
    const container = document.getElementById('tab-settings');
    if (!container) return;
    container.innerHTML = `
        <div class="bg-white rounded-lg shadow-sm border border-slate-200 p-3 sm:p-4 space-y-4">
            <div class="border-b pb-2 flex justify-between items-center">
                <h2 class="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                    <i data-lucide="settings" class="w-4 h-4 text-slate-600"></i> 基本情報・年度繰越・勘定科目の管理
                </h2>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-3 pb-3 border-b text-xs">
                <div>
                    <label class="block font-semibold text-slate-600 mb-0.5">家計簿名・タイトル</label>
                    <input type="text" id="setting-household-name" class="w-full p-1.5 border rounded">
                </div>
                <div>
                    <label class="block font-semibold text-slate-600 mb-0.5">会計年度 (西暦)</label>
                    <input type="number" id="setting-fiscal-year" class="w-full p-1.5 border rounded">
                </div>
                <div class="md:col-span-2 flex items-center justify-between">
                    <button id="btn-save-basic" class="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded">基本情報を保存</button>
                    <button id="btn-execute-rollover" class="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded flex items-center gap-1 shadow">
                        <i data-lucide="calendar-arrow-right" class="w-4 h-4"></i> 年度繰越 (前年実績保存 & 翌年度へ)
                    </button>
                </div>
            </div>

            <div class="space-y-4 pt-1">
                <h3 class="font-bold text-xs text-slate-800 flex items-center gap-1.5">
                    <i data-lucide="layers" class="w-3.5 h-3.5 text-emerald-600"></i> 勘定科目と補助科目の編集・追加
                </h3>
                <p class="text-[11px] text-slate-500">
                    ※資産・負債・純資産科目では期首残高を設定できます。収益・費用科目には期首残高の概念はありません。
                </p>

                <div class="grid grid-cols-1 md:grid-cols-3 gap-3" id="category-management-container"></div>
            </div>
        </div>
    `;

    const state = store.getState();
    document.getElementById('setting-household-name').value = state.householdName || "我が家の家計簿";
    document.getElementById('setting-fiscal-year').value = state.fiscalYear || new Date().getFullYear();

    document.getElementById('btn-save-basic').addEventListener('click', saveBasicSettings);
    document.getElementById('btn-execute-rollover').addEventListener('click', executeRollover);

    renderCategoryManagement();
}

function saveBasicSettings() {
    const state = store.getState();
    state.householdName = document.getElementById('setting-household-name').value || "我が家の家計簿";
    state.fiscalYear = Number(document.getElementById('setting-fiscal-year').value) || new Date().getFullYear();
    store.setState(state);
    updateAppHeader();
    showToast('基本情報を保存しました。');
}

function executeRollover() {
    const state = store.getState();
    if (!confirm(`今年度(${state.fiscalYear}年度)の決算実績を「前年度実績」として保存し、\n資産・負債・純資産の期末残高を翌年度の期首残高に繰り越しますか？\n\n（※実行すると仕訳履歴がクリアされ、会計年度が1年進みます）`)) return;

    state.prevActuals = {};
    const recordActual = (accName, subName, val) => {
        const key = subName ? `${accName}:${subName}` : accName;
        state.prevActuals[key] = val;
    };

    ['assets', 'liabilities', 'netAssets', 'income', 'expenses'].forEach(type => {
        state.categories[type].forEach(cat => {
            const totalVal = calculateAccountBalance(cat.name);
            recordActual(cat.name, '', totalVal);

            if (type === 'assets' || type === 'liabilities' || type === 'netAssets') {
                cat.balance = calculateAccountBalance(cat.name);
            }

            if (Array.isArray(cat.sub)) {
                cat.sub.forEach((sub, sIdx) => {
                    const subName = typeof sub === 'string' ? sub : sub.name;
                    const subVal = calculateSubAccountBalance(cat.name, subName);
                    recordActual(cat.name, subName, subVal);

                    if (type === 'assets' || type === 'liabilities' || type === 'netAssets') {
                        if (typeof sub === 'object' && sub !== null) {
                            sub.balance = subVal;
                        } else {
                            cat.sub[sIdx] = { name: sub, balance: subVal };
                        }
                    }
                });
            }
        });
    });

    state.fiscalYear = Number(state.fiscalYear) + 1;
    state.transactions = [];

    store.setState(state);
    renderSettingsHtml();
    updateAppHeader();
    showToast(`翌年度 (${state.fiscalYear}年度) へ繰越処理を行いました。`);
}

export function renderCategoryManagement() {
    const container = document.getElementById('category-management-container');
    if (!container) return;
    container.innerHTML = '';
    const state = store.getState();

    const typeNames = {
        assets: '資産の部',
        liabilities: '負債の部',
        netAssets: '純資産の部',
        income: '収益の部 (P/L)',
        expenses: '費用の部 (P/L)'
    };

    for (let type in state.categories) {
        const isBS = (type === 'assets' || type === 'liabilities' || type === 'netAssets');
        const div = document.createElement('div');
        div.className = "border rounded-lg p-3 bg-slate-50 space-y-2.5 text-xs";
        
        let html = `<h4 class="font-bold text-slate-800 border-b pb-1 flex justify-between items-center">
            <span>${typeNames[type]}</span>
            <button onclick="window.kakeiboAddAccount('${type}')" class="text-[10px] bg-emerald-600 text-white px-2 py-0.5 rounded">＋科目追加</button>
        </h4><div class="space-y-2">`;

        state.categories[type].forEach((cat, cIdx) => {
            const isProtected = (cat.name === "資本金");
            const hasData = state.transactions.some(t => t.debit.acc === cat.name || t.credit.acc === cat.name);
            const catBalance = isBS ? (cat.balance || 0) : 0;

            html += `<div class="bg-white p-2 rounded border space-y-1 shadow-sm">
                <div class="flex justify-between items-center">
                    <span class="font-bold text-slate-800 flex items-center gap-1">
                        ${cat.name} 
                        ${isBS ? `<span class="text-[10px] text-slate-500 font-normal">(残高: ¥${catBalance.toLocaleString()})</span>` : ''}
                        ${isProtected ? '<span class="text-[10px] text-amber-600">(保護)</span>' : ''}
                    </span>
                    <div class="flex gap-1 items-center">
                        <button onclick="window.kakeiboRenameAccount('${type}', ${cIdx})" class="text-blue-600 hover:underline text-[10px] ml-1">${isBS ? '名称・残高変更' : '名称変更'}</button>
                        ${!hasData && !isProtected ? `<button onclick="window.kakeiboDeleteAccount('${type}', ${cIdx})" class="text-rose-600 hover:underline text-[10px] ml-1">削除</button>` : ''}
                    </div>
                </div>
                <div class="pl-2 border-l-2 border-slate-200 space-y-1">
                    <div class="text-[10px] text-slate-500 font-semibold">補助科目:</div>
                    <div class="flex flex-wrap gap-1">`;
            
            cat.sub.forEach((sub, sIdx) => {
                const subName = typeof sub === 'string' ? sub : sub.name;
                const subBal = (isBS && typeof sub === 'object' && sub !== null) ? (sub.balance || 0) : 0;

                html += `<span class="bg-slate-100 px-1.5 py-0.5 rounded flex items-center gap-1 text-[11px]">
                    ${subName} ${isBS ? `<span class="text-slate-500 text-[10px]">(¥${subBal.toLocaleString()})</span>` : ''}
                    <button onclick="window.kakeiboRenameSub('${type}', ${cIdx}, ${sIdx})" class="text-blue-500 hover:text-blue-700 ml-0.5" title="編集"><i data-lucide="edit-2" class="w-3 h-3 inline"></i></button>
                    <button onclick="window.kakeiboDeleteSub('${type}', ${cIdx}, ${sIdx})" class="text-rose-500 hover:text-rose-700" title="削除"><i data-lucide="x" class="w-3 h-3 inline"></i></button>
                </span>`;
            });

            html += `</div>
                    <button onclick="window.kakeiboAddSub('${type}', ${cIdx})" class="text-[10px] text-emerald-600 font-semibold mt-1 block">＋補助追加</button>
                </div>
            </div>`;
        });

        html += `</div>`;
        div.innerHTML = html;
        container.appendChild(div);
    }
    if (window.lucide) lucide.createIcons();
}

// グローバル関数登録
window.kakeiboAddAccount = function(type) {
    const isBS = (type === 'assets' || type === 'liabilities' || type === 'netAssets');
    const name = prompt('新しい勘定科目名を入力してください:');
    if (!name || name.trim() === "") return;
    const state = store.getState();
    if (store.getAllAccountNames().includes(name.trim())) { alert('既に存在する科目名です。'); return; }

    let balance = 0;
    if (isBS) {
        const balStr = prompt(`「${name.trim()}」の補助科目なし期首残高（円）を入力してください:`, "0");
        if (balStr === null) return;
        balance = Number(balStr) || 0;
    }

    state.categories[type].push({ name: name.trim(), balance, sub: [] });
    store.setState(state);
    renderCategoryManagement();
    showToast('勘定科目を追加しました。');
};

window.kakeiboRenameAccount = function(type, cIdx) {
    const state = store.getState();
    const cat = state.categories[type][cIdx];
    const isBS = (type === 'assets' || type === 'liabilities' || type === 'netAssets');

    const newName = prompt(`新しい勘定科目名を入力してください:`, cat.name);
    if (!newName || newName.trim() === "") return;
    if (newName.trim() !== cat.name && store.getAllAccountNames().includes(newName.trim())) {
        alert('既に存在する科目名です。'); return;
    }

    let newBal = cat.balance || 0;
    if (isBS) {
        const newBalStr = prompt(`「${newName.trim()}」の補助科目なし期首残高（円）を入力してください:`, cat.balance || 0);
        if (newBalStr === null) return;
        newBal = Number(newBalStr) || 0;
    }

    const trimmed = newName.trim();
    if (trimmed !== cat.name) {
        state.transactions.forEach(t => {
            if (t.debit.acc === cat.name) t.debit.acc = trimmed;
            if (t.credit.acc === cat.name) t.credit.acc = trimmed;
        });
    }

    cat.name = trimmed;
    if (isBS) cat.balance = newBal;
    store.setState(state);
    renderCategoryManagement();
    showToast('勘定科目を更新しました。');
};

window.kakeiboDeleteAccount = function(type, cIdx) {
    const state = store.getState();
    const cat = state.categories[type][cIdx];
    if (confirm(`勘定科目「${cat.name}」を削除しますか？`)) {
        state.categories[type].splice(cIdx, 1);
        store.setState(state);
        renderCategoryManagement();
        showToast('勘定科目を削除しました。');
    }
};

window.kakeiboAddSub = function(type, cIdx) {
    const isBS = (type === 'assets' || type === 'liabilities' || type === 'netAssets');
    const sub = prompt('新しい補助科目名を入力してください:');
    if (!sub || sub.trim() === "") return;
    const state = store.getState();
    const cat = state.categories[type][cIdx];
    const existingNames = cat.sub.map(s => typeof s === 'string' ? s : s.name);
    if (existingNames.includes(sub.trim())) { alert('既に存在する補助名です。'); return; }

    let balance = 0;
    if (isBS) {
        const balStr = prompt(`「${sub.trim()}」の期首残高（円）を入力してください:`, "0");
        if (balStr === null) return;
        balance = Number(balStr) || 0;
    }

    cat.sub.push({ name: sub.trim(), balance });
    store.setState(state);
    renderCategoryManagement();
    showToast('補助科目を追加しました。');
};

window.kakeiboRenameSub = function(type, cIdx, sIdx) {
    const state = store.getState();
    const cat = state.categories[type][cIdx];
    const isBS = (type === 'assets' || type === 'liabilities' || type === 'netAssets');
    const oldSub = cat.sub[sIdx];
    const oldSubName = typeof oldSub === 'string' ? oldSub : oldSub.name;
    const oldSubBal = typeof oldSub === 'string' ? 0 : (oldSub.balance || 0);

    const newSubName = prompt(`新しい補助科目名を入力してください:`, oldSubName);
    if (!newSubName || newSubName.trim() === "") return;

    let newSubBal = oldSubBal;
    if (isBS) {
        const newSubBalStr = prompt(`「${newSubName.trim()}」の期首残高（円）を入力してください:`, oldSubBal);
        if (newSubBalStr === null) return;
        newSubBal = Number(newSubBalStr) || 0;
    }

    const trimmedSub = newSubName.trim();
    const existingNames = cat.sub.map(s => typeof s === 'string' ? s : s.name);
    if (trimmedSub !== oldSubName && existingNames.includes(trimmedSub)) {
        alert('同じ科目内に既に存在する補助名です。'); return;
    }

    if (trimmedSub !== oldSubName) {
        state.transactions.forEach(t => {
            if (t.debit.acc === cat.name && t.debit.sub === oldSubName) t.debit.sub = trimmedSub;
            if (t.credit.acc === cat.name && t.credit.sub === oldSubName) t.credit.sub = trimmedSub;
        });
    }

    cat.sub[sIdx] = { name: trimmedSub, balance: newSubBal };
    store.setState(state);
    renderCategoryManagement();
    showToast('補助科目を更新しました。');
};

window.kakeiboDeleteSub = function(type, cIdx, sIdx) {
    const state = store.getState();
    const cat = state.categories[type][cIdx];
    const subObj = cat.sub[sIdx];
    const subName = typeof subObj === 'string' ? subObj : subObj.name;
    if (confirm(`補助科目「${subName}」を削除しますか？\n※既存の仕訳は「補助科目なし」に変更されます。`)) {
        state.transactions.forEach(t => {
            if (t.debit.acc === cat.name && t.debit.sub === subName) t.debit.sub = '';
            if (t.credit.acc === cat.name && t.credit.sub === subName) t.credit.sub = '';
        });
        cat.sub.splice(sIdx, 1);
        store.setState(state);
        renderCategoryManagement();
        showToast(`補助科目「${subName}」を削除しました。`);
    }
};