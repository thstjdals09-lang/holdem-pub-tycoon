// GameBackend: 게임 저장/불러오기를 담당하는 어댑터 레이어.
// 로그인된 계정이 있으면 Firestore(holdemPub_saves/{uid})를 우선 사용하고,
// localStorage는 오프라인 캐시 + 내보내기/가져오기 코드 생성용으로 계속 쓴다.
// game.js는 이 모듈의 함수 시그니처만 알면 되므로, 백엔드를 바꿔도 game.js는 그대로 둘 수 있다.
import { auth, db, doc, getDoc, setDoc } from "./firebase-init.js?v=7";

const STORAGE_KEY = "holdemPubTycoon.save.v1";
const OWNER_KEY = "holdemPubTycoon.save.v1.owner"; // 로컬 캐시가 어느 계정 것인지
const COLLECTION = "holdemPub_saves";

// 휴대폰 네트워크에서 클라우드 응답이 멈추면 게임 시작(첫 매장 렌더)까지 같이 멈춰서
// "매장이 전혀 안 보이는" 문제가 있었다 → 클라우드 요청은 최대 이 시간까지만 기다린다.
const CLOUD_TIMEOUT_MS = 6000;
const withTimeout = (promise, ms) =>
  Promise.race([promise, new Promise((_, reject) => setTimeout(() => reject(new Error("cloud timeout")), ms))]);

// 이번 세션에 클라우드를 제대로 읽었는지. 못 읽고 로컬 캐시로 시작했다면, 저장하기 전에
// 클라우드에 더 최신 데이터(다른 기기의 진행)가 있는지 확인해서 덮어쓰지 않는다.
let cloudVerified = false;
let startedFromSavedAt = 0;

function localSaveRaw(payload) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    const uid = auth.currentUser?.uid;
    if (uid) window.localStorage.setItem(OWNER_KEY, uid);
  } catch (err) {
    console.error("[GameBackend] local save failed", err);
  }
}

const localOwner = () => {
  try {
    return window.localStorage.getItem(OWNER_KEY);
  } catch {
    return null;
  }
};

function localLoadRaw() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return { ok: true, state: raw ? JSON.parse(raw) : null };
  } catch (err) {
    console.error("[GameBackend] local load failed", err);
    return { ok: false, error: String(err) };
  }
}

async function saveState(state) {
  const payload = { ...state, savedAt: Date.now() };
  localSaveRaw(payload); // 항상 로컬 캐시는 남겨서, 오프라인/로그아웃 상태에서도 진행 유실이 없게 한다
  const uid = auth.currentUser?.uid;
  if (!uid) return { ok: true };
  try {
    if (!cloudVerified) {
      const snap = await withTimeout(getDoc(doc(db, COLLECTION, uid)), CLOUD_TIMEOUT_MS);
      const cloudAt = snap.exists() ? snap.data().savedAt || 0 : 0;
      if (cloudAt > startedFromSavedAt) {
        console.warn("[GameBackend] cloud has newer progress from another device — not overwriting it");
        return { ok: false, error: "cloud has newer data" };
      }
      cloudVerified = true;
    }
    await withTimeout(setDoc(doc(db, COLLECTION, uid), payload), CLOUD_TIMEOUT_MS);
  } catch (err) {
    console.error("[GameBackend] cloud save failed", err);
    return { ok: false, error: String(err) };
  }
  return { ok: true };
}

// 로그인된 계정의 클라우드 세이브를 불러온다. 계정이 없으면(=신규 계정) null을 돌려줘서
// 이 기기의 로컬 잔여 데이터를 물려받지 않고 새 세이브로 시작하게 한다.
async function loadState() {
  const uid = auth.currentUser?.uid;
  if (!uid) return localLoadRaw();
  try {
    const snap = await withTimeout(getDoc(doc(db, COLLECTION, uid)), CLOUD_TIMEOUT_MS);
    cloudVerified = true;
    if (snap.exists() && Object.keys(snap.data()).length > 0) {
      const state = snap.data();
      localSaveRaw(state); // 다음 오프라인 실행을 위해 캐시도 갱신
      return { ok: true, state };
    }
    return { ok: true, state: null };
  } catch (err) {
    console.error("[GameBackend] cloud load failed or timed out, falling back to local cache", err);
    const res = localLoadRaw();
    // 이 기기에 다른 계정이 남긴 로컬 데이터는 물려받지 않는다(소유자 기록이 없는 예전 캐시는 본인 것으로 간주)
    const owner = localOwner();
    if (res.state && owner && owner !== uid) return { ok: true, state: null };
    startedFromSavedAt = res.state?.savedAt || 0;
    return res;
  }
}

async function resetState() {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch (err) {
    return { ok: false, error: String(err) };
  }
  const uid = auth.currentUser?.uid;
  if (uid) {
    try {
      await setDoc(doc(db, COLLECTION, uid), {});
    } catch (err) {
      console.error("[GameBackend] cloud reset failed", err);
    }
  }
  return { ok: true };
}

async function exportState() {
  const { state } = await loadState();
  return state ? btoa(unescape(encodeURIComponent(JSON.stringify(state)))) : "";
}

async function importState(code) {
  try {
    const json = decodeURIComponent(escape(atob(code.trim())));
    const state = JSON.parse(json);
    await saveState(state);
    return { ok: true, state };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}

window.GameBackend = { saveState, loadState, resetState, exportState, importState };
