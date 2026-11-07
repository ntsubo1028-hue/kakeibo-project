import { store } from './store.js';

export function calculateAccountBalance(accName) {
    const data = store.getState();
    let catObj = null;
    let catType = '';
    for (let type in data.categories) {
        const found = data.categories[type].find(c => c.name === accName);
        if (found) { catObj = found; catType = type; break; }
    }
    if (!catObj) return 0;

    let baseBal = 0;
    if (catType !== 'income' && catType !== 'expenses') {
        if (Array.isArray(catObj.sub) && catObj.sub.length > 0) {
            // サブ科目がある場合は、サブ科目のバランスを合算
            catObj.sub.forEach(s => {
                if (typeof s === 'object' && s !== null) {
                    baseBal += (s.balance || 0);
                }
            });
        } else {
            // サブ科目がない場合のみ親の balance を使用
            baseBal = catObj.balance || 0;
        }
    }

    let bal = baseBal;
    let normal = 'debit';
    if (catType === 'liabilities' || catType === 'netAssets' || catType === 'income') normal = 'credit';

    data.transactions.forEach(t => {
        const amt = Number(t.amount);
        if (normal === 'debit') {
            if (t.debit.acc === accName) bal += amt;
            if (t.credit.acc === accName) bal -= amt;
        } else {
            if (t.credit.acc === accName) bal += amt;
            if (t.debit.acc === accName) bal -= amt;
        }
    });
    return bal;
}

export function calculateSubAccountBalance(accName, subName) {
    const data = store.getState();
    let catObj = null;
    let catType = '';
    for (let type in data.categories) {
        const found = data.categories[type].find(c => c.name === accName);
        if (found) { catObj = found; catType = type; break; }
    }
    if (!catObj) return 0;

    let subObj = null;
    if (Array.isArray(catObj.sub)) {
        subObj = catObj.sub.find(s => (typeof s === 'string' ? s : s.name) === subName);
    }

    let baseBal = (catType === 'income' || catType === 'expenses') ? 0 : ((subObj && typeof subObj === 'object') ? (subObj.balance || 0) : 0);
    let bal = baseBal;
    let normal = 'debit';
    if (catType === 'liabilities' || catType === 'netAssets' || catType === 'income') normal = 'credit';

    data.transactions.forEach(t => {
        const amt = Number(t.amount);
        if (normal === 'debit') {
            if (t.debit.acc === accName && t.debit.sub === subName) bal += amt;
            if (t.credit.acc === accName && t.credit.sub === subName) bal -= amt;
        } else {
            if (t.credit.acc === accName && t.credit.sub === subName) bal += amt;
            if (t.debit.acc === accName && t.debit.sub === subName) bal -= amt;
        }
    });
    return bal;
}

export function getPreviousYearValue(accName, subName) {
    const data = store.getState();
    if (!data.prevActuals) return null;
    const key = subName ? `${accName}:${subName}` : accName;
    if (data.prevActuals[key] !== undefined) return data.prevActuals[key];
    if (!subName && data.prevActuals[accName] !== undefined) return data.prevActuals[accName];
    return null;
}