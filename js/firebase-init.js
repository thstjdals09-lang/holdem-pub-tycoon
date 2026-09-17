// Firebase 초기화. casino-tycoon(다른 프로젝트)과 같은 Firebase 프로젝트를 재사용한다 —
// 새 프로젝트를 만들 필요 없이 바로 쓸 수 있고, 아이디는 내부 이메일 접미사(@holdem-pub-tycoon.local)로
// 구분되므로 두 게임의 계정/데이터가 같은 프로젝트 안에서도 섞이지 않는다(컬렉션도 holdemPub_ 접두사로 분리).
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  updatePassword,
  deleteUser,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
// Firestore는 Lite판을 쓴다(정식판 440KB → Lite 118KB). 우리는 문서 읽기/쓰기/삭제만 하고
// 실시간 구독(onSnapshot)이나 오프라인 캐시는 안 쓰기 때문에 기능 차이가 없다(오프라인 대비는 backend.js의 localStorage가 담당).
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore-lite.js";

const firebaseConfig = {
  apiKey: "AIzaSyBfjtsVhLb99meZGNWX5zV3wIiQPP-oyhU",
  authDomain: "jinojino-6aba2.firebaseapp.com",
  projectId: "jinojino-6aba2",
  storageBucket: "jinojino-6aba2.firebasestorage.app",
  messagingSenderId: "835849328394",
  appId: "1:835849328394:web:5f17797c3461560bd2ccf3",
};

export const firebaseApp = initializeApp(firebaseConfig, "holdemPubTycoon");
export const auth = getAuth(firebaseApp);
export const db = getFirestore(firebaseApp);

export {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  updatePassword,
  deleteUser,
  onAuthStateChanged,
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  serverTimestamp,
};
