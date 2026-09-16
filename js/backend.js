// GameBackend: 게임 저장/불러오기를 담당하는 어댑터 레이어.
// 지금은 브라우저 localStorage를 사용하지만, 실제 서버 API(REST/Firebase 등)로
// 교체하더라도 game.js는 이 모듈의 함수 시그니처만 알면 되도록 분리했다.
// 실제 백엔드로 전환 시 이 파일 내부만 fetch() 호출로 바꾸면 된다.
const GameBackend = (() => {
  const STORAGE_KEY = "holdemPubTycoon.save.v1";

  async function saveState(state) {
    try {
      const payload = JSON.stringify({ ...state, savedAt: Date.now() });
      window.localStorage.setItem(STORAGE_KEY, payload);
      return { ok: true };
    } catch (err) {
      console.error("[GameBackend] save failed", err);
      return { ok: false, error: String(err) };
    }
  }

  async function loadState() {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return { ok: true, state: null };
      return { ok: true, state: JSON.parse(raw) };
    } catch (err) {
      console.error("[GameBackend] load failed", err);
      return { ok: false, error: String(err) };
    }
  }

  async function resetState() {
    try {
      window.localStorage.removeItem(STORAGE_KEY);
      return { ok: true };
    } catch (err) {
      return { ok: false, error: String(err) };
    }
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

  return { saveState, loadState, resetState, exportState, importState };
})();
