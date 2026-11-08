// src/js/store.js
import { 
    auth, 
    db, 
    googleProvider, 
    signInWithPopup, 
    signInWithRedirect, 
    getRedirectResult, 
    signOut, 
    onAuthStateChanged, 
    doc, 
    getDoc, 
    setDoc, 
    collection, 
    getDocs 
} from './firebase.js';

// デフォルトの勘定科目・初期カテゴリ構造の定義
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
        // アプリケーションの基本データ構造
        this.appData = {
            householdName: "我が家の家計簿",
            fiscalYear: 2026, // 基準となる会計年度
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

        // Firebase 認証・クラウド同期用プロパティ
        this.currentUser = null;
        this.isLoaded = false;
    }

    // ==========================================
    // 🌐 Firebase 認証 & クラウド同期メソッド
    // ==========================================

    // ユーザーIDと現在の会計年度からFirestoreのドキュメント参照（パス）を動的に生成
    getDocRef() {
        if (!this.currentUser) return null;
        const year = this.appData.fiscalYear || new Date().getFullYear();
        // パス構造: users/{uid}/kakeibo/{fiscalYear}
        return doc(db, "users", this.currentUser.uid, "kakeibo", String(year));
    }

    // クラウド上に存在する年度のリスト（ドキュメントID一覧）をFirestoreから動的に取得
    async getAvailableYears() {
        if (!this.currentUser) {
            return [String(this.appData.fiscalYear || new Date().getFullYear())];
        }
        try {
            const kakeiboRef = collection(db, "users", this.currentUser.uid, "kakeibo");
            const querySnapshot = await getDocs(kakeiboRef);
            const years = [];
            querySnapshot.forEach((docSnap) => {
                years.push(docSnap.id);
            });
            years.sort(); // 昇順に並び替え

            if (years.length === 0) {
                years.push(String(this.appData.fiscalYear || new Date().getFullYear()));
            }
            return years;
        } catch (error) {
            console.error("年度リスト取得エラー:", error);
            return [String(this.appData.fiscalYear || new Date().getFullYear())];
        }
    }

    // 認証状態の監視およびスマートフォン向けリダイレクト結果の受け取り処理
    async initAuth(onAuthChangedCallback) {
        // ① リダイレクト認証からの復帰時に結果を受信
        try {
            const result = await getRedirectResult(auth);
            if (result && result.user) {
                this.currentUser = result.user;
                await this.loadFromFirestore();
            }
        } catch (error) {
            console.error("リダイレクトログインエラー:", error);
        }

        // ② 通常の認証状態監視
        onAuthStateChanged(auth, async (user) => {
            this.currentUser = user;
            if (user) {
                await this.loadFromFirestore();
            } else {
                // ログアウト時は初期状態にリセット
                this.appData = {
                    householdName: "我が家の家計簿",
                    fiscalYear: 2026,
                    categories: JSON.parse(JSON.stringify(DEFAULT_CATEGORIES)),
                    transactions: [],
                    prevActuals: {},
                    templates: []
                };
                this.isLoaded = false;
                this.notifyListeners();
            }
            if (typeof onAuthChangedCallback === 'function') {
                onAuthChangedCallback(user);
            }
        });
    }

    // ログイン処理（PCはポップアップ、スマホ等のモバイルはリダイレクト認証に自動切り替え）
    async login() {
        try {
            const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

            if (isMobile) {
                await signInWithRedirect(auth, googleProvider);
            } else {
                await signInWithPopup(auth, googleProvider);
            }
        } catch (error) {
            console.error("ログインエラー:", error);
            alert("ログインに失敗しました: " + error.message);
        }
    }

    // ログアウトを実行
    async logout() {
        try {
            await signOut(auth);
        } catch (error) {
            console.error("ログアウトエラー:", error);
        }
    }

    // 現在選択されている年度のドキュメントからデータをロード
    async loadFromFirestore() {
        if (!this.currentUser) return;
        try {
            const docRef = this.getDocRef();
            const docSnap = await getDoc(docRef);

            if (docSnap.exists()) {
                this.appData = docSnap.data();
            } else {
                // データがまだない場合は新規作成として初期保存
                this.appData.transactions = [];
                this.appData.prevActuals = {};
                await this.saveToFirestore();
            }
            this.isLoaded = true;
            this.notifyListeners();
        } catch (error) {
            console.error("データ読み込みエラー:", error);
        }
    }

    // 現在選択されている年度のドキュメントにデータを保存
    async saveToFirestore() {
        if (!this.currentUser) return;
        try {
            const docRef = this.getDocRef();
            await setDoc(docRef, this.appData);
        } catch (error) {
            console.error("データ保存エラー:", error);
        }
    }

    // 会計年度を切り替えて、該当年度のクラウドデータを取得し直す
    async changeFiscalYear(newYear) {
        this.appData.fiscalYear = Number(newYear);
        await this.loadFromFirestore();
    }

    // ==========================================
    // 🔄 状態管理 & 自動再描画イベント
    // ==========================================

    notifyListeners() {
        if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('kakeibo-data-loaded'));
        }
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

        // データ変更時は自動でクラウドに保存 ＆ 再描画
        this.saveToFirestore();
        this.notifyListeners();
    }

    undo() {
        if (this.undoStack.length === 0) return false;
        this.redoStack.push(JSON.parse(JSON.stringify(this.appData)));
        this.appData = this.undoStack.pop();
        this.setDirty(true);

        this.saveToFirestore();
        this.notifyListeners();
        return true;
    }

    redo() {
        if (this.redoStack.length === 0) return false;
        this.undoStack.push(JSON.parse(JSON.stringify(this.appData)));
        this.appData = this.redoStack.pop();
        this.setDirty(true);

        this.saveToFirestore();
        this.notifyListeners();
        return true;
    }

    canUndo() {
        return this.undoStack.length > 0;
    }

    canRedo() {
        return this.redoStack.length > 0;
    }

    // Googleログイン中（クラウド同期中）は未保存アラートを常に非表示にする
    setDirty(status) {
        this.isDirty = status;
        const alertBox = document.getElementById('unsaved-alert');
        if (alertBox) {
            if (this.currentUser || !this.isDirty) {
                alertBox.classList.add('hidden');
            } else {
                alertBox.classList.remove('hidden');
            }
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