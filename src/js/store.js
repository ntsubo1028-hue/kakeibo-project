// src/js/store.js

export const DEFAULT_CATEGORIES = {
    assets: [
        { name: "現金", balance: 0, sub: [{ name: "手元現金", balance: 0 }, { name: "その他現金", balance: 0 }] },
        { name: "普通預金", balance: 0, sub: [{ name: "楽天銀行", balance: 0 }, { name: "JA福井県(福井北部)", balance: 0 }, { name: "福井銀行", balance: 0 }] }
    ],
    liabilities: [
        { name: "未払金", balance: 0, sub: [{ name: "楽天カード", balance: 0 }, { name: "JAカード", balance: 0 }, { name: "JA購買", balance: 0 }] },
        { name: "借入金", balance: 0, sub: [{ name: "住宅ローン", balance: 0 }] }
    ],
    netAssets: [
        { name: "資本金", balance: 0, sub: [{ name: "元入金", balance: 0 }] }
    ],
    income: [
        { name: "給与収入", balance: 0, sub: [{ name: "給与", balance: 0 }, { name: "賞与", balance: 0 }] },
        { name: "投資収入", balance: 0, sub: [{ name: "FX", balance: 0 }, { name: "投資信託", balance: 0 }, { name: "貯金利息", balance: 0 }] },
        { name: "その他収入", balance: 0, sub: [{ name: "雑収入", balance: 0 }, { name: "特別収入", balance: 0 }] }
    ],
    expenses: [
        { name: "食費", balance: 0, sub: [{ name: "食料品", balance: 0 }, { name: "外食", balance: 0 }, { name: "アルコール類", balance: 0 }] },
        { name: "住居費", balance: 0, sub: [{ name: "管理費", balance: 0 }, { name: "住居物品", balance: 0 }, { name: "修繕費", balance: 0 }] },
        { name: "光熱水道費", balance: 0, sub: [{ name: "灯油", balance: 0 }] },
        { name: "通信費", balance: 0, sub: [{ name: "携帯電話", balance: 0 }, { name: "インターネット", balance: 0 }] },
        { name: "娯楽費", balance: 0, sub: [{ name: "趣味", balance: 0 }, { name: "交際費", balance: 0 }] },
        { name: "その他費用", balance: 0, sub: [] },
        { name: "教育費", balance: 0, sub: [{ name: "学費", balance: 0 }, { name: "文具書籍", balance: 0 }, { name: "受験料", balance: 0 }, { name: "小遣い", balance: 0 }] },
        { name: "衛生費", balance: 0, sub: [{ name: "理容費", balance: 0 }, { name: "衛星用品", balance: 0 }] },
        { name: "医療費", balance: 0, sub: [{ name: "定期的治療", balance: 0 }, { name: "病気・ケガ", balance: 0 }, { name: "検診・予防接種", balance: 0 }] },
        { name: "車両費", balance: 0, sub: [{ name: "燃料", balance: 0 }, { name: "車検修繕費", balance: 0 }] },
        { name: "保険料", balance: 0, sub: [{ name: "子供共済", balance: 0 }, { name: "生命共済", balance: 0 }, { name: "建物共済", balance: 0 }, { name: "その他保険料", balance: 0 }] }
    ]
};

class Store {
    constructor() {
        this.appData = {
            householdName: "我が家の家計簿",
            fiscalYear: 2026,
            categories: JSON.parse(JSON.stringify(DEFAULT_CATEGORIES)),
            transactions: [],
            prevActuals: {},
            templates: [
                { id: 't1', name: '給与受取', category: 'A銀行', debitAcc: '普通預金', debitSub: '楽天銀行', creditAcc: '給与収入', creditSub: '給与', amount: 300000, memo: '給与振込' },
                { id: 't2', name: '食費 (現金)', category: '共通', debitAcc: '食費', debitSub: '食料品', creditAcc: '現金', creditSub: '手元現金', amount: 5000, memo: 'スーパー買い出し' }
            ]
        };
        this.undoStack = [];
        this.redoStack = [];
        this.maxHistory = 30;
        this.isDirty = false;
        this.fileHandle = null;
    }

    getState() {
        return JSON.parse(JSON.stringify(this.appData));
    }

    setState(newState, isUndoRedoAction = false) {
        if (!isUndoRedoAction) {
            this.undoStack.push(JSON.parse(JSON.stringify(this.appData)));
            if (this.undoStack.length > this.maxHistory) {
                this.undoStack.shift();
            }
            this.redoStack = [];
        }
        this.appData = JSON.parse(JSON.stringify(newState));
        this.setDirty(true);

        // ★ここで自動的に全体再描画イベントを発火！
        if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('kakeibo-data-loaded'));
        }
    }

    undo() {
        if (this.undoStack.length === 0) return false;
        this.redoStack.push(JSON.parse(JSON.stringify(this.appData)));
        this.appData = this.undoStack.pop();
        this.setDirty(true);

        // ★Undo時も自動発火
        if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('kakeibo-data-loaded'));
        }
        return true;
    }

    redo() {
        if (this.redoStack.length === 0) return false;
        this.undoStack.push(JSON.parse(JSON.stringify(this.appData)));
        this.appData = this.redoStack.pop();
        this.setDirty(true);

        // ★Redo時も自動発火
        if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('kakeibo-data-loaded'));
        }
        return true;
    }

    canUndo() {
        return this.undoStack.length > 0;
    }

    canRedo() {
        return this.redoStack.length > 0;
    }

    setDirty(status) {
        this.isDirty = status;
        const alertBox = document.getElementById('unsaved-alert');
        if (alertBox) {
            if (this.isDirty) alertBox.classList.remove('hidden');
            else alertBox.classList.add('hidden');
        }
    }

    getAllAccountNames() {
        let list = [];
        for (let type in this.appData.categories) {
            this.appData.categories[type].forEach(c => list.push(c.name));
        }
        return list;
    }

    getSubAccounts(accName) {
        let list = [];
        for (let type in this.appData.categories) {
            const found = this.appData.categories[type].find(c => c.name === accName);
            if (found && found.sub) {
                return found.sub.map(s => typeof s === 'string' ? s : s.name);
            }
        }
        return list;
    }
}

export const store = new Store();