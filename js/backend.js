// GameBackend: 게임 저장/불러오기를 담당하는 어댑터 레이어.
// 로그인된 계정이 있으면 Firestore(holdemPub_saves/{uid})를 우선 사용하고,
// localStorage는 오프라인 캐시 + 내보내기/가져오기 코드 생성용으로 계속 쓴다.
// game.js는 이 모듈의 함수 시그니처만 알면 되므로, 백엔드를 바꿔도 game.js는 그대로 둘 수 있다.
import { auth, db, doc, getDoc, setDoc } from "./firebase-init.js?v=14";

const STORAGE_KEY = "holdemPubTycoon.save.v1";
const OWNER_KEY = "holdemPubTycoon.save.v1.owner"; // 로컬 캐시가 어느 계정 것인지
const BACKUP_KEY = "holdemPubTycoon.save.v1.backup"; // 진행이 줄어드는 저장이 감지되면 직전 상태를 여기에 보관
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
// 이번 기기에서 확인한 "진행이 들어 있는 마지막 세이브". 불러오기가 어긋나 새 게임으로 시작해버렸을 때
// 그 빈 상태가 진짜 세이브를 덮어쓰지 못하게 막는 안전장치로 쓴다.
let lastKnownState = null;

// 새로 시작한 것과 다름없는 상태인지 (이걸로 진행된 세이브를 덮어쓰면 안 된다)
function isFreshState(s) {
  if (!s) return true;
  return (
    (s.tables || 0) <= 1 &&
    (s.lifetimeEarned || 0) <= 0 &&
    (s.prestige?.points || 0) === 0 &&
    Object.keys(s.dealers || {}).length === 0
  );
}
const hasProgress = (s) => Boolean(s) && !isFreshState(s);

function localSaveRaw(payload) {
  try {
    // 누적 수익은 절대 줄어들지 않는다. 줄어든 채로 저장되려 하면(불러오기 사고 등) 직전 상태를 백업해 둔다.
    const prevRaw = window.localStorage.getItem(STORAGE_KEY);
    if (prevRaw) {
      const prev = JSON.parse(prevRaw);
      if ((prev.lifetimeEarned || 0) > (payload.lifetimeEarned || 0)) {
        window.localStorage.setItem(BACKUP_KEY, prevRaw);
      }
    }
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    const uid = auth.currentUser?.uid;
    if (uid) window.localStorage.setItem(OWNER_KEY, uid);
  } catch (err) {
    console.error("[GameBackend] local save failed", err);
  }
}

// 설정 화면에서 "백업 복구"에 쓴다 — 백업이 지금 진행보다 나을 때만 보여준다
function getBackup() {
  try {
    const raw = window.localStorage.getItem(BACKUP_KEY);
    if (!raw) return null;
    const state = JSON.parse(raw);
    const uid = auth.currentUser?.uid;
    const owner = localOwner();
    if (uid && owner && owner !== uid) return null;
    return state;
  } catch {
    return null;
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

// options.allowReset: 초기화·가져오기·패치 초기화처럼 "일부러 새 상태로 덮어쓰는" 경우에만 true
async function saveState(state, options = {}) {
  const payload = { ...state, savedAt: Date.now() };
  // 안전장치: 불러오기가 어긋나 새 게임으로 시작해버렸다면, 그 빈 상태로 진행된 세이브를 덮어쓰지 않는다
  if (!options.allowReset && isFreshState(payload) && hasProgress(lastKnownState)) {
    console.warn("[GameBackend] refusing to overwrite an existing save with a fresh state");
    return { ok: false, error: "fresh state would overwrite progress" };
  }
  localSaveRaw(payload); // 항상 로컬 캐시는 남겨서, 오프라인/로그아웃 상태에서도 진행 유실이 없게 한다
  if (hasProgress(payload) || options.allowReset) lastKnownState = payload;
  const uid = auth.currentUser?.uid;
  if (!uid) return { ok: true };
  try {
    if (!cloudVerified) {
      const snap = await withTimeout(getDoc(doc(db, COLLECTION, uid)), CLOUD_TIMEOUT_MS);
      const cloudAt = snap.exists() ? snap.data().savedAt || 0 : 0;
      // 다른 기기의 더 최신 진행은 덮어쓰지 않는다. 단, 이번 세션이 그보다 최신 세이브에서 출발했으면 올린다.
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

// 클라우드와 이 기기의 로컬 캐시 중 더 최신(savedAt) 세이브로 시작한다.
// 예전에는 "클라우드에 문서가 없으면 무조건 새 게임"이었는데, 클라우드가 잠깐 비어 보이면
// 멀쩡한 로컬 진행이 통째로 날아가서(그 뒤 자동 저장이 빈 상태로 덮어씀) 그 구조를 없앴다.
async function loadState() {
  const uid = auth.currentUser?.uid;
  // 이 기기에 다른 계정이 남긴 로컬 데이터는 물려받지 않는다(소유자 기록이 없는 예전 캐시는 본인 것으로 간주)
  const owner = localOwner();
  const localRes = localLoadRaw();
  const local = localRes.state && (!uid || !owner || owner === uid) ? localRes.state : null;
  if (!uid) {
    lastKnownState = local;
    startedFromSavedAt = local?.savedAt || 0;
    return { ok: true, state: local };
  }

  let cloud = null;
  try {
    const snap = await withTimeout(getDoc(doc(db, COLLECTION, uid)), CLOUD_TIMEOUT_MS);
    cloudVerified = true;
    if (snap.exists() && Object.keys(snap.data()).length > 0) cloud = snap.data();
  } catch (err) {
    console.error("[GameBackend] cloud load failed or timed out, falling back to local cache", err);
    cloudVerified = false;
  }

  // 둘 다 있으면 "더 많이 진행된 쪽"을 고른다. 누적 수익(lifetimeEarned)은 리뉴얼해도 줄지 않아서
  // 진행도의 기준이 되고, 같으면 더 최근 저장을 쓴다. (다른 기기에서 더 진행했으면 그쪽이 선택된다)
  const progressOf = (s) => (s ? s.lifetimeEarned || 0 : -1);
  const state = !cloud
    ? local
    : !local
    ? cloud
    : progressOf(local) > progressOf(cloud) || (progressOf(local) === progressOf(cloud) && (local.savedAt || 0) > (cloud.savedAt || 0))
    ? local
    : cloud;
  if (state) {
    localSaveRaw(state); // 다음 오프라인 실행을 위해 캐시도 갱신
    lastKnownState = state;
  }
  startedFromSavedAt = state?.savedAt || 0;
  return { ok: true, state: state || null };
}

async function resetState() {
  lastKnownState = null; // 일부러 지운 것이므로 "빈 상태 덮어쓰기 방지" 안전장치를 풀어준다
  startedFromSavedAt = Date.now();
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
    await saveState(state, { allowReset: true }); // 사용자가 일부러 넣은 코드라 덮어쓰기를 허용
    return { ok: true, state };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}

window.GameBackend = { saveState, loadState, resetState, exportState, importState, getBackup };
