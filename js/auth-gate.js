// 로그인/회원가입 게이트 — 로그인 전에는 게임을 시작하지 않는다.
// game.js는 이 파일이 로그인 성공을 확인한 뒤 호출하는 window.HoldemGame.start()로만 시작된다.
(() => {
  const root = document.getElementById("auth-gate");
  let mode = "login"; // "login" | "signup"
  let error = "";
  let started = false;
  let submitting = false;

  function render() {
    const isLogin = mode === "login";
    root.innerHTML = `
      <div class="auth-card">
        <div class="auth-emoji">🍺🃏</div>
        <h1>홀덤펍 키우기</h1>
        <p class="auth-sub">아이디로 로그인하면 여러 기기에서 이어서 플레이할 수 있어요.</p>

        <div class="auth-mode-row">
          <button type="button" class="chip ${isLogin ? "active" : ""}" data-mode="login">로그인</button>
          <button type="button" class="chip ${!isLogin ? "active" : ""}" data-mode="signup">계정 만들기</button>
        </div>

        <form class="auth-form" id="auth-form">
          <input id="auth-username" type="text" placeholder="아이디" autocomplete="username" required />
          <input id="auth-password" type="password" placeholder="비밀번호 (6자 이상)" autocomplete="${isLogin ? "current-password" : "new-password"}" required />
          ${error ? `<p class="auth-error">${error}</p>` : ""}
          <button type="submit" class="btn btn-primary btn-wide" ${submitting ? "disabled" : ""}>
            ${submitting ? "확인 중..." : isLogin ? "로그인" : "계정 만들고 시작하기"}
          </button>
        </form>
      </div>
    `;

    root.querySelectorAll("[data-mode]").forEach((btn) => {
      btn.addEventListener("click", () => {
        mode = btn.dataset.mode;
        error = "";
        render();
      });
    });
    root.querySelector("#auth-form").addEventListener("submit", onSubmit);
  }

  async function onSubmit(e) {
    e.preventDefault();
    if (submitting) return;
    const username = document.getElementById("auth-username").value;
    const password = document.getElementById("auth-password").value;
    submitting = true;
    render();

    const result = mode === "login" ? await window.Account.login(username, password) : await window.Account.createAccount(username, password);
    submitting = false;
    if (!result.ok) {
      error = result.error ?? "오류가 발생했어요.";
      render();
      return;
    }
    // 성공하면 onAuthStateChanged가 게이트를 닫고 게임을 시작시킨다.
  }

  function showGate() {
    root.classList.remove("hidden");
    render();
  }

  function hideGate() {
    root.classList.add("hidden");
    root.innerHTML = "";
  }

  window.Account.onAuthStateChanged((user) => {
    if (user) {
      hideGate();
      if (!started) {
        started = true;
        window.HoldemGame.start();
      }
    } else {
      showGate();
    }
  });
})();
