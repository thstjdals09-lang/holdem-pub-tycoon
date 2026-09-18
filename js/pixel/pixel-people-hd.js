// PixelPeopleHD — 고밀도 캐릭터 스프라이트(약 28×36).
//
// 기존 인게임 캐릭터(14×22)는 화면에 수십 명이 동시에 서 있어야 해서 작게 잡았다.
// 이건 그 4~5배 정보량으로, 머리 3톤·피부 2톤·조끼 2톤·볼터치·소지품까지 넣는다.
// 쓰임새: 운영진 도감/가챠 카드 같은 "한 명을 크게 보여주는" 자리.
// 인게임 씬에 그대로 쓰려면 타일(32×16)과 테이블까지 같이 키워야 비율이 맞는다.
//
// 행 길이를 일일이 세지 않도록 pad()가 가운데 정렬로 폭을 맞춘다.
// (점을 손으로 찍는 건 그대로고, 여백 계산만 코드에 맡긴다 — 오타로 한 줄이 밀리는 사고를 막는다)
const PixelPeopleHD = (() => {
  const W = 28;

  const pad = (rows, w) =>
    rows.map((r) => {
      const left = Math.floor((w - r.length) / 2);
      return ".".repeat(Math.max(0, left)) + r + ".".repeat(Math.max(0, w - r.length - left));
    });

  // 바텐더 — 조끼 + 보타이 + 쟁반
  const BARTENDER = pad([
    "OOOOOOOO",
    "OOhhhhhhhhOO",
    "OhhhhhhhhhhhhO",
    "OhhhllllllhhhhO",
    "OhhllllllllhhhO",
    "OhhllllllllhhhO",
    "OhhhhllllhhhhhO",
    "OhssssssssssshO",
    "OhssssssssssshO",
    "OhseOsssssOeshO",
    "OhssssssssssshO",
    "OhbssssssssbshO",
    "OhsssssmmssssshO",
    "OhssssssssssshO",
    "OSsssssssssssSO",
    "OSSSSSSSSSSSSO",
    "OOSSSSSSSSSSOO",
    "OwwwwwwwwwwwwO",
    "OwwvvvvvvvvvwwO",
    "OwwvvvvttvvvvwwO",
    "OwvvvvvvvvvvvvwO",
    "OwvvvVvvvvVvvvwO",
    "OwvvvvvvvvvvvvwO",
    "OwvvvvvvvvvvvvwO",
    "OwwvvvvvvvvvvwwO",
    "OWwvvvvvvvvvvwWO",
    "OsswvvvvvvvvwssO",
    "OssWvvvvvvvvWssO",
    "OSsOvvvvvvvvOsSO",
    "OOOOvvvvvvvvOOOO",
    "...OppppppppO...",
    "...OppppppppO...",
    "...OppppppppO...",
    "...OpppOOpppO...",
    "...OpppOOpppO...",
    "...OpppOOpppO...",
    "...ObbbOObbbO...",
    "....OOO..OOO....",
  ], W);

  const H = BARTENDER.length;

  function blit(ctx, x0, y0, rows, map) {
    for (let y = 0; y < rows.length; y++) {
      const row = rows[y];
      let x = 0;
      while (x < row.length) {
        const ch = row[x];
        const col = map[ch];
        if (!col) { x++; continue; }
        let run = 1;
        while (x + run < row.length && row[x + run] === ch) run++;
        ctx.fillStyle = col;
        ctx.fillRect(x0 + x, y0 + y, run, 1);
        x += run;
      }
    }
  }

  const dk = (hex, t) => PixelArt.shade(hex, -t);
  const lt = (hex, t) => PixelArt.shade(hex, t);

  /** 쟁반 + 맥주 3잔 — 손에 든 소지품. 몸 스프라이트와 따로 얹는다. */
  function tray(ctx, x0, y0, topY) {
    const R = (x, y, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(x0 + x, y0 + y, w, h); };
    // 쟁반 — 배 높이(손이 닿는 자리)에 오도록 topY 기준으로 놓는다
    const ty = topY;
    R(4, ty + 8, 20, 1, "#5e3b24");
    R(3, ty + 6, 22, 2, "#8a5c3a");
    R(4, ty + 5, 20, 1, "#a87249");
    // 잔 3개 (거품 + 맥주)
    for (let i = 0; i < 3; i++) {
      const gx = 7 + i * 5;
      R(gx, ty, 4, 5, "#cfe6ee");
      R(gx, ty + 2, 4, 3, "#e0a84a");
      R(gx, ty, 4, 2, "#fff8e8");
      R(gx, ty - 1, 4, 1, "#ffffff");
      R(gx + 3, ty + 1, 1, 4, "#9dbecd");
    }
  }

  /**
   * 고밀도 캐릭터. (ox, oy)는 발밑 중앙.
   * look = { hair, hairLight, skin, vest, shirt, pants, tie }
   */
  function draw(ctx, ox, oy, look = {}, opt = {}) {
    const hair = look.hair || "#6b4632";
    const skin = look.skin || "#f2c9a0";
    const vest = look.vest || "#3a3a4a";
    const shirt = look.shirt || "#f7f4ee";
    const pants = look.pants || "#2f2f38";
    const x0 = Math.round(ox - W / 2);
    const y0 = Math.round(oy - H);
    const map = {
      ".": null,
      O: dk(hair, 0.5),
      h: hair,
      H: dk(hair, 0.22),
      l: look.hairLight || lt(hair, 0.22),
      s: skin,
      S: dk(skin, 0.16),
      e: "#3a2a26",
      b: "#f0a898",
      m: "#c25a5a",
      w: shirt,
      W: dk(shirt, 0.12),
      v: vest,
      V: lt(vest, 0.18),
      t: look.tie || "#8a2f3a",
      p: pants,
      b2: dk(pants, 0.3),
    };
    map.b = "#f0a898";
    blit(ctx, x0, y0, BARTENDER, map);
    if (opt.tray !== false) tray(ctx, x0, y0, H - 18); // 배 높이
  }

  return { draw, W, H, BARTENDER };
})();

if (typeof window !== "undefined") window.PixelPeopleHD = PixelPeopleHD;
