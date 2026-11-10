import { store } from '../store.js';
import { calculateAccountBalance, calculateSubAccountBalance } from '../accounting.js';
import { showToast, updateAppHeader } from '../main.js';

// 現在選択中の勘定科目分類（デフォルトは資産 'assets'）
let activeAccountType = 'assets';

const ACCOUNT_TYPES = [
    { key: 'assets', label: '資産の部' },
    { key: 'liabilities', label: '負債の部' },
    { key: 'netAssets', label: '純資産の部' },
    { key: 'income', label: '収益の部 (P/L)' },
    { key: 'expenses', label: '費用の部 (P/L)' }
];

export async function initSettings() {
    await renderSettingsHtml();
}

async function renderSettingsHtml() {
    const container = document.getElementById('tab-settings');
    if (!container) return;
    try {
        const res = await fetch('./src/views/settings.html');
        if (!res.ok) throw new Error('Failed to load settings.html');
        container.innerHTML = await res.text();
        if (window.lucide) lucide.createIcons();
    } catch (e) {
        console.error(e);
    }

    const state = store.getState();
    const nameEl = document.getElementById('setting-household-name');
    const yearEl = document.getElementById('setting-fiscal-year');
    if (nameEl) nameEl.value = state.householdName || "我が家の家計簿";
    if (yearEl) yearEl.value = state.fiscalYear || new Date().getFullYear();

    document.getElementById('btn-save-basic')?.addEventListener('click', saveBasicSettings);
    document.getElementById('btn-execute-rollover')?.addEventListener('click', executeRollover);

    renderCategoryManagement();
}

function saveBasicSettings() {
    const state = store.getState();
    state.householdName = document.getElementById('setting-household-name')?.value || "我が家の家計簿";
    state.fiscalYear = Number(document.getElementById('setting-fiscal-year')?.value) || new Date().getFullYear();
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

    const type = activeAccountType;
    const isBS = (type === 'assets' || type === 'liabilities' || type === 'netAssets');

    const card = document.createElement('div');
    card.className = "kakeibo-card space-y-3 text-xs";

    // 1. ヘッダー：スマートなセレクトボックス ＋ 科目追加ボタン
    const header = document.createElement('div');
    header.className = "flex items-center justify-between border-b border-slate-200 pb-2.5 gap-2";

    // 左側：分類切替用コンボボックス（セレクトボックス）
    const selectWrapper = document.createElement('div');
    selectWrapper.className = "flex items-center gap-2";
    
    const selectLabel = document.createElement('span');
    selectLabel.className = "text-xs font-bold text-slate-500 hidden sm:inline";
    selectLabel.textContent = "表示分類:";

    const select = document.createElement('select');
    select.className = "h-8 px-2.5 bg-slate-100 hover:bg-slate-200 border border-slate-300 font-bold text-slate-800 rounded-lg text-xs transition cursor-pointer focus:outline-hidden focus:ring-2 focus:ring-emerald-500";
    
    ACCOUNT_TYPES.forEach(t => {
        const opt = document.createElement('option');
        opt.value = t.key;
        opt.textContent = t.label;
        if (t.key === activeAccountType) opt.selected = true;
        select.appendChild(opt);
    });

    select.onchange = (e) => {
        activeAccountType = e.target.value;
        renderCategoryManagement();
    };

    selectWrapper.appendChild(selectLabel);
    selectWrapper.appendChild(select);

    // 右側：＋科目追加ボタン
    const addAccBtn = document.createElement('button');
    addAccBtn.type = 'button';
    addAccBtn.className = "h-8 px-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-lg shadow-2xs transition inline-flex items-center gap-1 shrink-0";
    addAccBtn.innerHTML = '<i data-lucide="plus" class="w-3.5 h-3.5"></i> 科目を追加';
    addAccBtn.onclick = () => window.kakeiboAddAccount(type);

    header.appendChild(selectWrapper);
    header.appendChild(addAccBtn);
    card.appendChild(header);

    // 2. 科目リスト本体（ドラッグ＆ドロップ対応）
    const listContainer = document.createElement('div');
    listContainer.className = "space-y-2.5";

    const categories = state.categories[type] || [];

    categories.forEach((cat, cIdx) => {
        const isProtected = (cat.name === "資本金");
        const hasData = state.transactions.some(t => t.debit.acc === cat.name || t.credit.acc === cat.name);
        const catBalance = isBS ? (cat.balance || 0) : 0;

        const row = document.createElement('div');
        row.className = "bg-white p-2.5 rounded-lg border border-slate-200 shadow-2xs space-y-2 transition-all hover:border-slate-300";
        row.draggable = true; // HTML5 ドラッグ対応

        // ドラッグイベント処理
        row.ondragstart = (e) => {
            e.dataTransfer.setData('text/plain', cIdx);
            row.classList.add('opacity-50', 'bg-slate-50');
        };
        row.ondragend = () => {
            row.classList.remove('opacity-50', 'bg-slate-50');
        };
        row.ondragover = (e) => e.preventDefault();
        row.ondrop = (e) => {
            e.preventDefault();
            const srcIdx = parseInt(e.dataTransfer.getData('text/plain'), 10);
            if (!isNaN(srcIdx) && srcIdx !== cIdx) {
                window.kakeiboReorderAccount(type, srcIdx, cIdx);
            }
        };

        const canUp = cIdx > 0;
        const canDown = cIdx < categories.length - 1;

        // 科目行のメイン部分
        const topRow = document.createElement('div');
        topRow.className = "flex items-center justify-between gap-2";

        topRow.innerHTML = `
            <div class="flex items-center gap-2">
                <!-- ドラッグハンドル ＋ 上下ボタン -->
                <div class="flex items-center gap-1 text-slate-400">
                    <span class="cursor-grab active:cursor-grabbing hover:text-slate-600 p-0.5" title="ドラッグして並び替え">
                        <i data-lucide="grip-vertical" class="w-4 h-4"></i>
                    </span>
                    <div class="flex flex-col gap-0.5">
                        <button type="button" onclick="window.kakeiboMoveAccount('${type}', ${cIdx}, -1)" ${!canUp ? 'disabled class="opacity-20 cursor-not-allowed"' : 'class="hover:text-slate-700"'} title="上へ移動"><i data-lucide="chevron-up" class="w-3 h-3"></i></button>
                        <button type="button" onclick="window.kakeiboMoveAccount('${type}', ${cIdx}, 1)" ${!canDown ? 'disabled class="opacity-20 cursor-not-allowed"' : 'class="hover:text-slate-700"'} title="下へ移動"><i data-lucide="chevron-down" class="w-3 h-3"></i></button>
                    </div>
                </div>
                <span class="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                    ${cat.name}
                    ${isBS ? `<span class="text-[11px] text-slate-500 font-normal">(期首残高: ¥${catBalance.toLocaleString()})</span>` : ''}
                    ${isProtected ? '<span class="text-[10px] text-amber-600 font-medium bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">保護</span>' : ''}
                </span>
            </div>
            <div class="flex gap-1.5 items-center">
                <button type="button" onclick="window.kakeiboRenameAccount('${type}', ${cIdx})" class="text-blue-600 hover:text-blue-800 hover:bg-blue-50 px-2 py-1 rounded text-xs transition">${isBS ? '名称・残高変更' : '名称変更'}</button>
                ${!hasData && !isProtected ? `<button type="button" onclick="window.kakeiboDeleteAccount('${type}', ${cIdx})" class="text-rose-600 hover:text-rose-800 hover:bg-rose-50 px-2 py-1 rounded text-xs transition">削除</button>` : ''}
            </div>
        `;
        row.appendChild(topRow);

        // 補助科目エリア
        const subSection = document.createElement('div');
        subSection.className = "pl-8 pt-2 border-t border-slate-100 space-y-1.5";
        
        let subHtml = `<div class="flex items-center justify-between text-[11px] font-semibold text-slate-500">
            <span>補助科目:</span>
            <button type="button" onclick="window.kakeiboAddSub('${type}', ${cIdx})" class="text-emerald-600 hover:underline font-bold inline-flex items-center gap-0.5"><i data-lucide="plus" class="w-3 h-3"></i> 補助追加</button>
        </div><div class="flex flex-wrap gap-1.5 items-center">`;

        cat.sub.forEach((sub, sIdx) => {
            const subName = typeof sub === 'string' ? sub : sub.name;
            const subBal = (isBS && typeof sub === 'object' && sub !== null) ? (sub.balance || 0) : 0;
            const canSubUp = sIdx > 0;
            const canSubDown = sIdx < cat.sub.length - 1;

            subHtml += `<span class="bg-slate-100 border border-slate-200 px-2 py-1 rounded-md flex items-center gap-1.5 text-xs text-slate-700">
                <span class="inline-flex flex-col gap-0.5">
                    <button type="button" onclick="window.kakeiboMoveSub('${type}', ${cIdx}, ${sIdx}, -1)" ${!canSubUp ? 'disabled class="opacity-20 cursor-not-allowed"' : 'class="text-slate-400 hover:text-slate-700"'} title="左へ移動"><i data-lucide="chevron-left" class="w-2.5 h-2.5"></i></button>
                    <button type="button" onclick="window.kakeiboMoveSub('${type}', ${cIdx}, ${sIdx}, 1)" ${!canSubDown ? 'disabled class="opacity-20 cursor-not-allowed"' : 'class="text-slate-400 hover:text-slate-700"'} title="右へ移動"><i data-lucide="chevron-right" class="w-2.5 h-2.5"></i></button>
                </span>
                <span class="font-medium">${subName}</span> ${isBS ? `<span class="text-slate-500 text-[10px]">(¥${subBal.toLocaleString()})</span>` : ''}
                <button type="button" onclick="window.kakeiboRenameSub('${type}', ${cIdx}, ${sIdx})" class="text-slate-400 hover:text-blue-600 ml-0.5" title="編集"><i data-lucide="edit-2" class="w-3 h-3"></i></button>
                <button type="button" onclick="window.kakeiboDeleteSub('${type}', ${cIdx}, ${sIdx})" class="text-slate-400 hover:text-rose-600" title="削除"><i data-lucide="x" class="w-3 h-3"></i></button>
            </span>`;
        });

        subHtml += `</div>`;
        subSection.innerHTML = subHtml;
        row.appendChild(subSection);

        listContainer.appendChild(row);
    });

    card.appendChild(listContainer);
    container.appendChild(card);

    if (window.lucide) lucide.createIcons();
}

// --- グローバル関数登録 ---

// ドラッグ＆ドロップによる位置の直接並び替え
window.kakeiboReorderAccount = function(type, srcIdx, destIdx) {
    const state = store.getState();
    const categories = state.categories[type];
    const [movedItem] = categories.splice(srcIdx, 1);
    categories.splice(destIdx, 0, movedItem);

    store.setState(state);
    renderCategoryManagement();
    showToast('科目の表示順を変更しました。');
};

// ボタン操作による科目の並び替え
window.kakeiboMoveAccount = function(type, cIdx, direction) {
    const state = store.getState();
    const categories = state.categories[type];
    const targetIdx = cIdx + direction;
    if (targetIdx < 0 || targetIdx >= categories.length) return;

    const temp = categories[cIdx];
    categories[cIdx] = categories[targetIdx];
    categories[targetIdx] = temp;

    store.setState(state);
    renderCategoryManagement();
    showToast('科目の並び順を更新しました。');
};

// 補助科目の並び替え
window.kakeiboMoveSub = function(type, cIdx, sIdx, direction) {
    const state = store.getState();
    const subAccounts = state.categories[type][cIdx].sub;
    const targetIdx = sIdx + direction;
    if (targetIdx < 0 || targetIdx >= subAccounts.length) return;

    const temp = subAccounts[sIdx];
    subAccounts[sIdx] = subAccounts[targetIdx];
    subAccounts[targetIdx] = temp;

    store.setState(state);
    renderCategoryManagement();
    showToast('補助科目の並び順を更新しました。');
};

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