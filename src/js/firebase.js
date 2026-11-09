// Firebase公式CDN（ES Modules版）から必要な機能をインポート
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, updateDoc, collection, getDocs } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// あなたのFirebaseプロジェクト設定情報
const firebaseConfig = {
    apiKey: "AIzaSyBz_hSfULAAgT7anZ68q1wb8LUD5TLHPQY",
    authDomain: "my-kakeibo-app-67a81.firebaseapp.com",
    projectId: "my-kakeibo-app-67a81",
    storageBucket: "my-kakeibo-app-67a81.firebasestorage.app",
    messagingSenderId: "537901406264",
    appId: "1:537901406264:web:f1c18271607cce1af66ecd"
};

// Firebaseの初期化
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();

// 認証・データベース操作に必要な関数をエクスポート
export { 
    signInWithPopup, 
    signOut, 
    onAuthStateChanged, 
    doc, 
    getDoc, 
    setDoc, 
    updateDoc, 
    collection, 
    getDocs 
};