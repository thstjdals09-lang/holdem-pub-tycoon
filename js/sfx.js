// Sfx: 게임 효과음. 외부 오디오 파일 없이 WebAudio로 직접 소리를 만든다(다운로드 용량 0).
// - 브라우저 정책상 AudioContext는 "사용자가 화면을 한 번 건드린 뒤"에야 소리를 낼 수 있어서,
//   첫 터치/클릭 때 만들고 resume한다.
// - 음량은 game.js가 setVolume()으로 넘겨준다(설정 탭 슬라이더, state.settings.sfxVolume).
(() => {
  let ctx = null;
  let master = null;
  let volume = 0.6;
  let unlocked = false;

  function ensureContext() {
    if (ctx) return ctx;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = volume;
    master.connect(ctx.destination);
    return ctx;
  }

  function unlock() {
    const c = ensureContext();
    if (!c) return;
    if (c.state === "suspended") c.resume();
    unlocked = true;
  }

  // 톤 하나 — type/주파수/길이/음량을 받아 짧게 울린다
  function tone({ freq = 440, type = "sine", start = 0, dur = 0.12, gain = 0.3, slideTo = null }) {
    const c = ensureContext();
    if (!c || volume <= 0) return;
    const t0 = c.currentTime + start;
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
    // 딸깍거리지 않게 짧은 페이드 인/아웃
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g);
    g.connect(master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  // 화음/멜로디 — [주파수, 시작시간] 목록
  const melody = (notes, opts = {}) => notes.forEach(([freq, start]) => tone({ freq, start, ...opts }));

  const SOUNDS = {
    tap: () => tone({ freq: 620, type: "triangle", dur: 0.06, gain: 0.18 }),
    buy: () => melody([[740, 0], [988, 0.05]], { type: "triangle", dur: 0.09, gain: 0.22 }),
    coin: () => melody([[1180, 0], [1560, 0.04]], { type: "square", dur: 0.06, gain: 0.12 }),
    gem: () => melody([[1046, 0], [1318, 0.05], [1568, 0.1]], { type: "sine", dur: 0.12, gain: 0.2 }),
    reward: () => melody([[784, 0], [988, 0.08], [1175, 0.16]], { type: "triangle", dur: 0.16, gain: 0.22 }),
    star: () => melody([[880, 0], [1108, 0.06], [1318, 0.12], [1760, 0.18]], { type: "sine", dur: 0.16, gain: 0.2 }),
    boost: () => tone({ freq: 220, type: "sawtooth", dur: 0.35, gain: 0.16, slideTo: 880 }),
    lose: () => melody([[330, 0], [247, 0.12]], { type: "triangle", dur: 0.2, gain: 0.18 }),
    win: () => melody([[523, 0], [659, 0.1], [784, 0.2], [1046, 0.3]], { type: "triangle", dur: 0.24, gain: 0.24 }),
    // 가챠 — 등급(0~5)이 높을수록 길고 화려하게
    gacha: (rank = 0) => {
      const base = [523, 587, 659, 784, 988, 1175][Math.min(rank, 5)];
      const notes = [[base, 0], [base * 1.26, 0.07]];
      if (rank >= 2) notes.push([base * 1.5, 0.14]);
      if (rank >= 3) notes.push([base * 2, 0.21]);
      if (rank >= 4) notes.push([base * 2.5, 0.28], [base * 3, 0.34]);
      melody(notes, { type: rank >= 3 ? "triangle" : "sine", dur: 0.18, gain: 0.22 });
    },
  };

  function play(name, arg) {
    if (!unlocked || volume <= 0) return;
    const fn = SOUNDS[name];
    if (!fn) return;
    try {
      fn(arg);
    } catch (err) {
      console.error("[Sfx] play failed", err);
    }
  }

  function setVolume(v) {
    volume = Math.max(0, Math.min(1, Number(v) || 0));
    if (master) master.gain.value = volume;
  }

  // 첫 입력에서 오디오를 깨운다(모바일 필수)
  ["pointerdown", "keydown", "touchend"].forEach((ev) =>
    window.addEventListener(ev, unlock, { once: true, passive: true })
  );

  window.Sfx = { play, setVolume, unlock };
})();
