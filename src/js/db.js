import { store, DEFAULT_CATEGORIES } from './store.js';
import { showToast } from './main.js';

let fileHandle = null;

// ファイル選択ダイアログ（開く）
export function triggerFileInput() {
    if (window.showOpenFilePicker) {
        (async () => {
            try {
                const [handle] = await window.showOpenFilePicker({ 
                    types: [{ description: 'JSON Files', accept: { 'application/json': ['.json'] } }] 
                });
                fileHandle = handle;
                const file = await fileHandle.getFile();
                loadJSONData(await file.text(), file.name);
            } catch(e) {
                // ユーザーがキャンセルした場合などは何もしない
            }
        })();
    } else {
        document.getElementById('file-input').click();
    }
}

export function handleFileSelect(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => loadJSONData(ev.target.result, file.name);
    reader.readAsText(file);
    e.target.value = '';
}

// JSONデータの読み込み・マイグレーション
export function loadJSONData(jsonStr, fileName) {
    try {
        const parsed = JSON.parse(jsonStr);
        if (!parsed || typeof parsed !== 'object' || !parsed.categories || !Array.isArray(parsed.transactions)) {
            alert('ファイルの構造が正しくありません。');
            return;
        }

        // データの補正・マイグレーション
        parsed.categories = migrateCategories(parsed.categories);
        if (!parsed.prevActuals) parsed.prevActuals = {};
        if (!parsed.templates) parsed.templates = [];

        store.setState(parsed);
        store.setDirty(false);
        updateFileStatusTag(fileName);
        
        // アプリ全体の再描画トリガー
        window.dispatchEvent(new CustomEvent('kakeibo-data-loaded'));
        showToast('データを正常に読み込みました。');
    } catch(e) {
        alert('ファイルの解析に失敗しました。');
    }
}

// 上書き保存
export async function saveFileDirect() {
    const state = store.getState();
    const jsonStr = JSON.stringify(state, null, 2);
    if (fileHandle) {
        try {
            const writable = await fileHandle.createWritable();
            await writable.write(jsonStr);
            await writable.close();
            store.setDirty(false);
            showToast('上書き保存しました。');
            return;
        } catch(e) {}
    }
    await saveFileAs();
}

// 別名保存
export async function saveFileAs() {
    const state = store.getState();
    const jsonStr = JSON.stringify(state, null, 2);
    const defaultName = `kakeibo_data_${state.fiscalYear}.json`;
    
    if (window.showSaveFilePicker) {
        try {
            const handle = await window.showSaveFilePicker({
                suggestedName: defaultName,
                types: [{ description: 'JSON Files', accept: { 'application/json': ['.json'] } }]
            });
            fileHandle = handle;
            const writable = await fileHandle.createWritable();
            await writable.write(jsonStr);
            await writable.close();
            store.setDirty(false);
            updateFileStatusTag(handle.name);
            showToast('ファイルを保存しました。');
        } catch(e) {}
    } else {
        const blob = new Blob([jsonStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = defaultName; a.click();
        URL.revokeObjectURL(url);
        store.setDirty(false);
        showToast('ファイルを保存しました。');
    }
}

function updateFileStatusTag(name) {
    const tag = document.getElementById('file-status-tag');
    if (tag) {
        tag.className = "text-[10px] px-1.5 py-0.5 rounded bg-emerald-900/60 text-emerald-300 border border-emerald-700/50 flex items-center gap-1 ml-1 whitespace-nowrap";
        tag.innerHTML = `<i data-lucide="file-check" class="w-3 h-3"></i> ${name}`;
        if (window.lucide) lucide.createIcons();
    }
}

function migrateCategories(categories) {
    for (let type in categories) {
        if (!Array.isArray(categories[type])) continue;
        const isBS = (type === 'assets' || type === 'liabilities' || type === 'netAssets');
        categories[type] = categories[type].map(cat => {
            if (typeof cat === 'string') return { name: cat, balance: 0, sub: [] };
            return {
                name: cat.name || '未命名',
                balance: (isBS && typeof cat.balance === 'number') ? cat.balance : 0,
                sub: Array.isArray(cat.sub) ? cat.sub.map(s => {
                    if (typeof s === 'string') return { name: s, balance: 0 };
                    return { name: s.name || '未命名', balance: (isBS && typeof s.balance === 'number') ? s.balance : 0 };
                }) : []
            };
        });
    }
    return categories;
}

// CSVエクスポート・インポート関連関数もここに集約
export function exportAllJournalCsv() {
    const state = store.getState();
    if (!state.transactions || state.transactions.length === 0) {
        alert('出力するデータがありません。');
        return;
    }
    downloadCsvFile(generateCsvString(state.transactions), `journal_all_${state.fiscalYear}.csv`);
    showToast('全仕訳をCSV出力しました。');
}

function generateCsvString(txList) {
    const headers = ["日付", "借方科目", "借方補助科目", "貸方科目", "貸方補助科目", "金額", "摘要"];
    const escapeCsv = (str) => `"${String(str || '').replace(/"/g, '""')}"`;
    const rows = [headers.map(escapeCsv).join(",")];
    txList.forEach(t => {
        rows.push([t.date, t.debit.acc, t.debit.sub || "", t.credit.acc, t.credit.sub || "", t.amount, t.memo || ""].map(escapeCsv).join(","));
    });
    return "\uFEFF" + rows.join("\r\n");
}

function downloadCsvFile(csvContent, fileName) {
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = fileName; a.click();
    URL.revokeObjectURL(url);
}

// --- CSVインポート処理 ---
export function triggerCsvImport() {
    const input = document.getElementById('csv-file-input');
    if (input) input.click();
}

export function handleCsvImport(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
        const text = ev.target.result;
        parseAndImportCsv(text);
    };
    reader.readAsText(file, 'UTF-8');
    e.target.value = ''; // 連続で同じファイルを読み込めるようにリセット
}

function parseAndImportCsv(csvText) {
    try {
        // 改行コードの正規化とBOMの除去
        const cleanText = csvText.replace(/^\uFEFF/, '');
        const lines = cleanText.split(/\r\n|\n/).filter(line => line.trim() !== '');
        
        if (lines.length < 2) {
            alert('CSVファイルに有効なデータ行が見つかりません。');
            return;
        }

        // CSVのパース（ダブルクォーテーションやカンマ区切りの簡易解析）
        const parseCsvLine = (line) => {
            const result = [];
            let current = '';
            let inQuotes = false;
            for (let i = 0; i < line.length; i++) {
                const char = line[i];
                if (char === '"') {
                    if (inQuotes && line[i + '"'] === '"') { current += '"'; i++; }
                    else { inQuotes = !inQuotes; }
                } else if (char === ',' && !inQuotes) {
                    result.push(current.trim());
                    current = '';
                } else {
                    current += char;
                }
            }
            result.push(current.trim());
            return result.map(s => s.replace(/^"|"$/g, ''));
        };

        // ヘッダー行をスキップしてデータ行を処理
        const newTxs = [];
        for (let i = 1; i < lines.length; i++) {
            const cols = parseCsvLine(lines[i]);
            if (cols.length < 6) continue;

            const [date, debitAcc, debitSub, creditAcc, creditSub, amount, memo] = cols;
            if (!date || !debitAcc || !creditAcc || !amount) continue;

            newTxs.push({
                id: (Date.now() + i).toString(),
                date: date,
                debit: { acc: debitAcc, sub: debitSub || '' },
                credit: { acc: creditAcc, sub: creditSub || '' },
                amount: Number(amount) || 0,
                memo: memo || ''
            });
        }

        if (newTxs.length === 0) {
            alert('インポートできる有効な仕訳データが見つかりませんでした。');
            return;
        }

        const state = store.getState();
        // 既存の先頭または末尾に追加
        state.transactions = [...newTxs, ...state.transactions];
        store.setState(state);

        window.dispatchEvent(new CustomEvent('kakeibo-data-loaded'));
        showToast(`${newTxs.length}件の仕訳データをCSVからインポートしました。`);
    } catch (err) {
        console.error(err);
        alert('CSVファイルの解析中にエラーが発生しました。');
    }
}