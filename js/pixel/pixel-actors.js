// PixelActors — 월드에 서는 캐릭터. 서 있을 때 26×52.
//
// 1차(24×46)가 밋밋했던 이유를 짚고 다시 찍었다:
//   1) 몸통이 단색 한 덩어리 — 명암이 없어 종이 인형처럼 보였다.
//   2) 머리 모양이 사실상 두 종류 — 수십 명이 서 있으면 복제 인간이 된다.
//   3) 눈만 있고 눈썹·하이라이트가 없어 표정이 죽었다.
//   4) 옷이 전부 티셔츠 — 직원과 손님이 색만 다른 같은 사람이었다.
//
// 층을 나눠 조립한다:
//   후드 뒤판 → 머리 → 눈썹·눈빛 → 머리카락 → 안경 → 몸통 → 의상 디테일 → 다리 → 소지품
// 색은 전부 런타임 팔레트라 머리·피부·상의·하의·헤어·의상 조합으로 손님이 겹치지 않는다.
//
// 좌표 규칙 (중요)
//   모든 행 배열은 pad()로 W=26 폭에 가운데 정렬한 뒤 x0에 그대로 얹는다.
//   예전에는 몸통만 원래 폭(22)으로 x0에 얹어서 머리보다 2px 왼쪽으로 밀려 있었다.
//   전부 같은 폭으로 맞춰야 머리·몸통·다리·오버레이 좌표가 한 기준을 쓴다.
//   가운데 정렬 후 몸통 앞판은 7~18열, 눈은 8~10열과 15~17열에 온다.
//
// 명암: 빛은 왼쪽 위에서. 각 행의 왼쪽 첫 칸이 밝은 톤(u), 오른쪽 두 칸이 어두운 톤(V).
const PixelActors = (() => {
  const W = 26;

  const pad = (rows) =>
    rows.map((r) => {
      const left = Math.floor((W - r.length) / 2);
      return ".".repeat(Math.max(0, left)) + r + ".".repeat(Math.max(0, W - r.length - left));
    });

  // 가운데 정렬 후 고정 좌표
  const EYE_L = 8, EYE_R = 15;   // 눈 왼쪽 끝 열
  const EYE_ROW = 9, BROW_ROW = 7;
  const BODY_L = 7, BODY_R = 18; // 몸통 앞판 좌우 끝 열

  // ---- 머리 2~16행 + 목 17~18행. 머리카락이 위/옆을 덮으므로 여기엔 얼굴만 ----
  const HEAD = pad([
    "", "",
    "OOOOOOOOOOOO",
    "OOssssssssssssOO",
    "OssssssssssssssO",
    "OssssssssssssssO",
    "OssssssssssssssO",
    "OssssssssssssssO",
    "OssssssssssssssO",
    "OsseeesssseeessO",
    "OsseeesssseeessO",
    "OsssssssssssSSSO",
    "ObbssssssssssbbO",
    "OsssssmmmmsssssO",
    "OSssssssssssssSO",
    "OOSssssssssssSOO",
    "OOSSSSSSSSSSOO",
    "OSSSSSSSSO",
    "OSSSSSSSSO",
  ]);

  // 뒷모습 — 뒤통수. 뒤돌아 앉은 손님에 쓴다(머리카락 오버레이는 얹지 않는다).
  const HEAD_BACK = pad([
    "", "",
    "OOOOOOOOOOOO",
    "OOhhhhhhhhhhhhOO",
    "OhhhhhhhhhhhhhhO",
    "OhhhllllllllhhhO",
    "OhhllllllllllhhO",
    "OhhhhhhhhhhhhhhO",
    "OhhhhhhhhhhhhhhO",
    "OhhhhhhhhhhhhhhO",
    "OhhhhhhhhhhhhhhO",
    "OhhhhhhhhhhhHHHO",
    "OhhhhhhhhhhhHHHO",
    "OHHHHHHHHHHHHHHO",
    "OSssssssssssssSO",
    "OOSssssssssssSOO",
    "OOSSSSSSSSSSOO",
    "OSSSSSSSSO",
    "OSSSSSSSSO",
  ]);

  // ---- 머리 모양 (0행부터 얹는다). 가운데 '.'는 얼굴이 비쳐 보이는 자리 ----
  //
  // 한 배열 안에서는 알맹이 폭을 전부 짝수로 맞춘다.
  // pad()가 (26 - 폭)/2 를 내림하므로, 홀수 폭 행만 반 칸 왼쪽으로 내려앉아
  // 정수리(16칸)와 옆머리(17칸)가 1px 어긋나 있었다. 옆머리는 전부 18칸으로 통일.
  const HAIR = {
    short: pad([
      "OOOOOOOOOO",
      "OOhhhhhhhhhhOO",
      "OhhhhhhhhhhhhhhO",
      "OhhhllllllllllhhhO",
      "OhhllllllllllllhhO",
      "Ohh............hhO",
      "Ohh............hhO",
      "Oh..............hO",
    ]),
    buzz: pad([
      "OOOOOOOOOO",
      "OOhhhhhhhhhhOO",
      "OhhhhhhhhhhhhhhO",
      "OhhhllllllllllhhhO",
      "OHH............HHO",
      "OH..............HO",
    ]),
    long: pad([
      "OOOOOOOOOO",
      "OOhhhhhhhhhhOO",
      "OhhhhhhhhhhhhhhO",
      "OhhhllllllllllhhhO",
      "OhhllllllllllllhhO",
      "Ohh............hhO",
      "Ohh............hhO",
      "Ohh............hhO",
      "Ohh............hhO",
      "Ohh............hhO",
      "Ohh............hhO",
      "OhH............HhO",
      "OhH............HhO",
      "Ohh............hhO",
      "Ohh............hhO",
      "OHh............hHO",
      "OHh............hHO",
      "OOh............hOO",
      ".OO............OO.",
    ]),
    // 단발 — 옆머리가 턱선까지 내려오되 얼굴은 끝까지 열어 둔다.
    // (이전 판은 아래 두 줄이 가로로 닫혀서 입까지 덮어 헬멧이 됐다)
    bob: pad([
      "OOOOOOOOOO",
      "OOhhhhhhhhhhOO",
      "OhhhhhhhhhhhhhhO",
      "OhhhllllllllllhhhO",
      "OhhllllllllllllhhO",
      "Ohh............hhO",
      "Ohh............hhO",
      "Ohh............hhO",
      "Ohh............hhO",
      "Ohh............hhO",
      "Ohhh..........hhhO",
      "Ohhh..........hhhO",
      "OhhH..........HhhO",
      "OOhh..........hhOO",
      ".OO............OO.",
    ]),
    // 포니테일 — 좌우 비대칭이라 pad()에 맡기면 꼬리가 가운데로 끌려온다.
    // 26폭으로 직접 적어 pad()가 손대지 않게 한다.
    pony: [
      "........OOOOOOOOOO........",
      "......OOhhhhhhhhhhOO......",
      ".....OhhhhhhhhhhhhhhO.....",
      "....OhhhllllllllllhhhO....",
      "....OhhllllllllllllhhOhhh.",
      "....Ohh............hhOhhhO",
      "....Ohh............hhOhhhO",
      "....Oh..............hOhhhO",
      "......................OhhO",
      "......................OhhO",
      "......................OhhO",
      "......................OhHO",
      "......................OhHO",
      ".......................OHO",
      ".......................OOO",
    ],
    twin: pad([
      "OOOOOOOOOO",
      "OOhhhhhhhhhhOO",
      "OhhhhhhhhhhhhhhO",
      "OhhhllllllllllhhhO",
      "OhhllllllllllllhhO",
      "Ohhh..........hhhO",
      "Ohhh..........hhhO",
      "OhhO..........OhhO",
      "OhhO..........OhhO",
      "OhHO..........OhHO",
      "OhHO..........OhHO",
      "OOHO..........OHOO",
      ".OOO..........OOO.",
    ]),
    bun: pad([
      "...OOOOOO...",
      "..OhhhhhhO..",
      "..OhhllhhO..",
      "OOOhhhhhhOOO",
      "OOhhhhhhhhhhOO",
      "OhhhhhhhhhhhhhhO",
      "OhhhllllllllllhhhO",
      "OhhllllllllllllhhO",
      "Ohh............hhO",
      "Ohh............hhO",
      "Oh..............hO",
    ]),
    spiky: pad([
      "OO..OO..OO..OO",
      "OhhOOhhOOhhOOhhO",
      "OhhhhhhhhhhhhhhO",
      "OhhhllllllllllhhhO",
      "OhhllllllllllllhhO",
      "Ohh............hhO",
      "Oh..............hO",
    ]),
    curly: pad([
      "OOO..OOO",
      "OhhhOOhhhO",
      "OhhlhhhhhhlhhO",
      "OhhhhhhhhhhhhhhO",
      "OhhllllhhllllhhO",
      "OhhllllllllllllhhO",
      "Ohhh..........hhhO",
      "Ohh............hhO",
      "OhhO..........OhhO",
      "OOhh..........hhOO",
      ".OOO..........OOO.",
    ]),
    // 캡 — 챙이 앞으로 나와야 모자로 읽힌다
    cap: pad([
      "OOOOOOOO",
      "OccccccccO",
      "OccccCCccccccO",
      "OccccccccccccccO",
      "OccccccccccccccO",
      "OOOOOOOOOOOOOOOOOO",
      "OCCCCCCCCCCCCCCCCO",
      "OOOOOOOOOOOOOOOOOO",
      "Ohh............hhO",
      "Oh..............hO",
    ]),
    // 딜러 바이저 — 정수리가 뚫린 챙 모자
    visor: pad([
      "OOOOOOOOOO",
      "OOhhhhhhhhhhOO",
      "OhhhhhhhhhhhhhhO",
      "OhhhllllllllllhhhO",
      "OggggggggggggggO",
      "OOGGGGGGGGGGGGOO",
      "OOOOOOOOOOOOOOOOOO",
      "Oh..............hO",
    ]),
  };
  // pad()가 좌우를 맞추므로 비대칭 스타일은 검사에서 빼야 한다
  const ASYMMETRIC = ["pony"];

  // ---- 몸통 19~34행 (16행). 팔과 몸통 사이 외곽선이 있어야 팔이 살아난다 ----
  //  u = 왼쪽 밝은 면, v = 기본, V = 오른쪽 어두운 면
  const TORSO = pad([
    "OOwwwwwwwwwwwwwwwwOO",
    "OwwwwwwwwwwwwwwwwwwwwO",
    "OwwwOuvvvvvvvvvVVOwwwO",
    "OwwwOuvvvttttvvVVOwwwO",
    "OwwwOuvvvvttvvvVVOwwwO",
    "OwwwOuvvvttttvvVVOwwwO",
    "OwwwOuvvvvvvvvvVVOwwwO",
    "OwwwOuvvvvvvvvvVVOwwwO",
    "OwwwOuvvvvvvvvvVVOwwwO",
    "OwwwOuvvvvvvvvvVVOwwwO",
    "OwwwOuvvvvvvvvvVVOwwwO",
    "OWWWOuvvvvvvvvvVVOWWWO",
    "OsssOuvvvvvvvvvVVOsssO",
    "OsssOuvvvvvvvvvVVOsssO",
    "OSSSOuvvvvvvvvvVVOSSSO",
    "OOOOOBBBBBBBBBBBBOOOOO",
  ]);

  // 팔을 앞으로 모은 상반신 — 딜링, 쟁반 들기, 잔 받기
  const TORSO_FRONT = pad([
    "OOwwwwwwwwwwwwwwwwOO",
    "OwwwwwwwwwwwwwwwwwwwwO",
    "OwwwOuvvvvvvvvvVVOwwwO",
    "OwwwOuvvvttttvvVVOwwwO",
    "OwwwOuvvvvttvvVVVOwwwO",
    "OwwwOuvvvttttvvVVOwwwO",
    "OwwwOuvvvvvvvvvVVOwwwO",
    "OOwwOuvvvvvvvvvVVOwwOO",
    ".OwwOuvvvvvvvvvVVOwwO.",
    "..OwwOvvvvvvvvvVOwwO..",
    "...OwwOvvvvvvvvOwwO...",
    ".....OwwsvvvvswwO.....",
    ".....OsssvvvvsssO.....",
    ".....OssssssssssO.....",
    ".....OSssssssssSO.....",
    "OOOOOBBBBBBBBBBBBOOOOO",
  ]);

  // ---- 다리 35~46행 + 신발 47~51행 ----
  const LEGS_STAND = pad([
    "OppppppppppppO",
    "OppppppppppppO",
    "OpppppOOpppppO",
    "OpppppOOpppppO",
    "OpppppOOpppppO",
    "OpppppOOpppppO",
    "OpppppOOpppppO",
    "OpppppOOpppppO",
    "OpppppOOpppppO",
    "OPPPPPOOPPPPPO",
    "OPPPPPOOPPPPPO",
    "OPPPPPOOPPPPPO",
    "OkkkkkOOkkkkkO",
    "OkkkkkkOOkkkkkkO",
    "OkkkkkkkOOkkkkkkkO",
    "OKKKKKKKOOKKKKKKKO",
    "OOOOOOOOOOOOOOOOOO",
  ]);

  // 걷기 — 발끝만 앞뒤로 바꾸고 몸 전체를 1px 흔든다.
  // 이 크기에서 다리를 크게 벌리면 덩어리로 뭉개져 오히려 안 걷는 것처럼 보인다.
  const legsWalk = (forward) => {
    const r = LEGS_STAND.slice();
    const toes = forward
      ? ["OkkkkkOOkkkkkkkO", "OkkkkkkOOkkkkkkkkO", "OKKKKKKOOKKKKKKKKO"]
      : ["OkkkkkkkOOkkkkkO", "OkkkkkkkkOOkkkkkkO", "OKKKKKKKKOOKKKKKKO"];
    const p = pad(toes);
    r[13] = p[0]; r[14] = p[1]; r[15] = p[2];
    return r;
  };
  const LEGS_WALK_A = legsWalk(false);
  const LEGS_WALK_B = legsWalk(true);

  // 앉은 자세 — 허벅지가 앞으로 나오고 키가 10px 낮아진다
  const LEGS_SIT = pad([
    "OppppppppppppppO",
    "OppppppppppppppO",
    "OppppppppppppppO",
    "OppppppppppppppO",
    "OPPPPPPPPPPPPPPO",
    "OkkkkOOOOOOkkkkO",
    "OOOOOOOOOOOOOOOO",
  ]);

  // 치마 — 아래로 퍼지고 맨다리가 드러난다
  const LEGS_SKIRT = pad([
    "OppppppppppppO",
    "OppppppppppppppO",
    "OppppppppppppppO",
    "OppppppppppppppppO",
    "OppppppppppppppppO",
    "OPPPPPPPPPPPPPPPPO",
    "OOOOOOOOOOOOOOOOOO",
    "OsssssOOOOsssssO",
    "OsssssOOOOsssssO",
    "OSSSSSOOOOSSSSSO",
    "OSSSSSOOOOSSSSSO",
    "OkkkkkOOOOkkkkkO",
    "OkkkkkkOOOOkkkkkkO",
    "OKKKKKKOOOOKKKKKKO",
    "OOOOOOOOOOOOOOOOOO",
  ]);
  const LEGS_SKIRT_SIT = pad([
    "OppppppppppppppO",
    "OppppppppppppppppO",
    "OppppppppppppppppO",
    "OPPPPPPPPPPPPPPPPO",
    "OOOOOOOOOOOOOOOOOO",
    "OsssssOOOOsssssO",
    "OkkkkkOOOOkkkkkO",
    "OOOOOOOOOOOOOOOO",
  ]);

  const POSES = {
    stand: { torso: TORSO, legs: LEGS_STAND, skirt: LEGS_SKIRT, dx: 0, dy: 0 },
    walk0: { torso: TORSO, legs: LEGS_WALK_A, skirt: LEGS_SKIRT, dx: -1, dy: -1 },
    walk1: { torso: TORSO, legs: LEGS_WALK_B, skirt: LEGS_SKIRT, dx: 1, dy: 0 },
    sit: { torso: TORSO, legs: LEGS_SIT, skirt: LEGS_SKIRT_SIT, dx: 0, dy: 0 },
    deal: { torso: TORSO_FRONT, legs: LEGS_SIT, skirt: LEGS_SKIRT_SIT, dx: 0, dy: 0 },
    serve: { torso: TORSO_FRONT, legs: LEGS_STAND, skirt: LEGS_SKIRT, dx: 0, dy: 0 },
    drink: { torso: TORSO_FRONT, legs: LEGS_SIT, skirt: LEGS_SKIRT_SIT, dx: 0, dy: 0 },
  };

  const HEAD_ROWS = 19; // 머리 + 목
  function heightOf(pose, skirt) {
    const P = POSES[pose] || POSES.stand;
    return HEAD_ROWS + P.torso.length + (skirt ? P.skirt : P.legs).length;
  }
  const HEIGHT = {};
  for (const k of Object.keys(POSES)) HEIGHT[k] = heightOf(k, false);

  // 앞치마 — 가슴받이는 좁고 아래로 퍼진다. 직원 표시.
  const APRON = [
    ".........OaaaaaaO.........",
    ".........OaaaaaaO.........",
    "........OaaaaaaaaO........",
    ".......OaaaaaaaaaaO.......",
    ".......OaaaaaaaaaaO.......",
    ".......OaaaaaaaaaaO.......",
    ".......OaaaaaaaaaaO.......",
    ".......OaaaaaaaaaaO.......",
    ".......OAAAAAAAAAAO.......",
    ".......OOOOOOOOOOOO.......",
  ];

  function blit(ctx, x0, y0, rows, map) {
    for (let y = 0; y < rows.length; y++) {
      const row = rows[y];
      let x = 0;
      while (x < row.length) {
        const ch = row[x];
        let run = 1;
        while (x + run < row.length && row[x + run] === ch) run++;
        const col = map[ch];
        if (col) { ctx.fillStyle = col; ctx.fillRect(x0 + x, y0 + y, run, 1); }
        x += run;
      }
    }
  }

  const dk = (c, t) => PixelArt.shade(c, -t);
  const lt = (c, t) => PixelArt.shade(c, t);
  const R = (ctx, x, y, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(x, y, w, h); };

  // ---- 의상 디테일 ----
  // 몸통 행 배열로 전부 표현하면 조합 폭발이라, 공통 몸통 위에 덧그린다.
  // 좌표는 가운데 정렬된 26폭 기준: 앞판이 BODY_L(7)~BODY_R(18)열.
  const OUTFIT = {
    tee() {},
    vest(ctx, x0, y0, c) {
      R(ctx, x0 + BODY_L, y0 + 2, 1, 13, c.vestEdge);
      R(ctx, x0 + BODY_R, y0 + 2, 1, 13, c.vestEdge);
      R(ctx, x0 + 12, y0 + 7, 2, 2, c.button);
      R(ctx, x0 + 12, y0 + 11, 2, 2, c.button);
    },
    hoodie(ctx, x0, y0, c) {
      R(ctx, x0 + 9, y0 + 9, 8, 5, c.pocket);
      R(ctx, x0 + 9, y0 + 9, 8, 1, c.pocketTop);
      R(ctx, x0 + 10, y0 + 2, 1, 6, c.string);
      R(ctx, x0 + 15, y0 + 2, 1, 6, c.string);
      R(ctx, x0 + 10, y0 + 8, 2, 2, c.string);
      R(ctx, x0 + 15, y0 + 8, 2, 2, c.string);
    },
    jacket(ctx, x0, y0, c) {
      // 열린 앞섶 — 깃이 안쪽 셔츠를 드러낸다
      R(ctx, x0 + BODY_L, y0 + 1, 5, 14, c.jacket);
      R(ctx, x0 + 14, y0 + 1, 5, 14, c.jacketD);
      PixelArt.poly(ctx, [[x0 + 12, y0 + 1], [x0 + 9, y0 + 9], [x0 + 12, y0 + 9]], c.lapel);
      PixelArt.poly(ctx, [[x0 + 14, y0 + 1], [x0 + 17, y0 + 9], [x0 + 14, y0 + 9]], c.lapel);
    },
    suit(ctx, x0, y0, c) {
      R(ctx, x0 + BODY_L, y0 + 1, 5, 15, c.jacket);
      R(ctx, x0 + 14, y0 + 1, 5, 15, c.jacketD);
      PixelArt.poly(ctx, [[x0 + 12, y0 + 1], [x0 + 8, y0 + 11], [x0 + 12, y0 + 11]], c.lapel);
      PixelArt.poly(ctx, [[x0 + 14, y0 + 1], [x0 + 18, y0 + 11], [x0 + 14, y0 + 11]], c.lapel);
      R(ctx, x0 + 12, y0 + 4, 2, 11, c.button);
    },
  };

  /**
   * 캐릭터 한 명. (ox, oy) = 발밑 중앙.
   * look = { hair, skin, top, accent, bottom, tie, shoe, capColor, style, outfit,
   *          skirt, glasses, apron }
   * opt  = { pose, back, tray, mug, cards, shadow }
   */
  function draw(ctx, ox, oy, look, opt) {
    look = look || {};
    opt = opt || {};
    const pose = POSES[opt.pose] ? opt.pose : "stand";
    const P = POSES[pose];
    const skirt = !!look.skirt;
    const outfit = OUTFIT[look.outfit] ? look.outfit : "tee";

    const hair = look.hair || "#3b2b20";
    const skin = look.skin || "#f2c9a0";
    const top = look.top || "#4a6fa5";
    const bottom = look.bottom || "#2f3550";
    const accent = look.accent || (outfit === "tee" || outfit === "hoodie" ? top : dk(top, 0.14));
    const shoe = look.shoe || "#4a352a";
    const cap = look.capColor || "#b8413f";
    const apronC = look.apron || "#8a5c3a";

    const h = heightOf(pose, skirt);
    const bx = Math.round(ox) + P.dx;
    const by = Math.round(oy) + P.dy;
    const x0 = bx - (W >> 1);
    const y0 = by - h;

    const map = {
      ".": null,
      O: "#2a1f1a",
      h: hair, H: dk(hair, 0.3), l: lt(hair, 0.26),
      s: skin, S: dk(skin, 0.17),
      e: "#3a2a26", b: "#eda394", m: "#b4574f",
      w: top, W: dk(top, 0.17),
      u: lt(accent, 0.13), v: accent, V: dk(accent, 0.16),
      t: look.tie || accent,
      B: dk(bottom, 0.45),
      p: bottom, P: dk(bottom, 0.2),
      k: shoe, K: dk(shoe, 0.3),
      c: cap, C: lt(cap, 0.22),
      g: "#6fbf7a", G: "#3f8a55",   // 바이저 챙
      a: apronC, A: dk(apronC, 0.25),
    };

    // 접지 그림자 — 없으면 인물이 바닥에서 떠 보인다
    if (opt.shadow !== false) {
      ctx.fillStyle = "rgba(58,38,24,0.20)";
      for (let i = -9; i <= 9; i++) {
        const hh = Math.round(Math.sqrt(Math.max(0, 1 - (i / 10) * (i / 10))) * 3);
        if (hh > 0) ctx.fillRect(Math.round(ox) + i, Math.round(oy) - hh, 1, hh * 2);
      }
    }

    // 후드 뒤판 — 머리보다 먼저
    if (outfit === "hoodie" && !opt.back) {
      PixelSprites.ellipse(ctx, bx, y0 + 18, 13, 7, "#2a1f1a");
      PixelSprites.ellipse(ctx, bx, y0 + 18, 12, 6, dk(top, 0.22));
    }

    blit(ctx, x0, y0, opt.back ? HEAD_BACK : HEAD, map);

    if (!opt.back) {
      // 눈썹과 눈빛 — 이 두 줄이 없으면 표정이 죽는다
      const brow = dk(hair, 0.12);
      R(ctx, x0 + EYE_L, y0 + BROW_ROW, 3, 1, brow);
      R(ctx, x0 + EYE_R, y0 + BROW_ROW, 3, 1, brow);
      R(ctx, x0 + EYE_L, y0 + EYE_ROW, 1, 1, "#fffdf6");
      R(ctx, x0 + EYE_R, y0 + EYE_ROW, 1, 1, "#fffdf6");
      blit(ctx, x0, y0, HAIR[look.style] || HAIR.short, map);
      if (look.glasses) {
        const gc = look.glasses === true ? "#3a3a44" : look.glasses;
        R(ctx, x0 + EYE_L - 1, y0 + EYE_ROW - 1, 5, 4, gc);
        R(ctx, x0 + EYE_L, y0 + EYE_ROW, 3, 2, "#bcd6e4");
        R(ctx, x0 + EYE_R - 1, y0 + EYE_ROW - 1, 5, 4, gc);
        R(ctx, x0 + EYE_R, y0 + EYE_ROW, 3, 2, "#bcd6e4");
        R(ctx, x0 + EYE_L + 4, y0 + EYE_ROW, 2, 1, gc);
      }
    }

    const ty = y0 + HEAD_ROWS;
    blit(ctx, x0, ty, P.torso, map);
    OUTFIT[outfit](ctx, x0, ty, {
      vestEdge: dk(accent, 0.34), button: look.tie || "#e8c86a",
      pocket: dk(top, 0.13), pocketTop: dk(top, 0.3), string: "#f2e4c0",
      jacket: top, jacketD: dk(top, 0.16), lapel: dk(top, 0.3),
    });
    if (look.apron) blit(ctx, x0, ty + 4, APRON, map);

    const ly = ty + P.torso.length;
    blit(ctx, x0, ly, skirt ? P.skirt : P.legs, map);

    if (opt.tray) tray(ctx, bx, ly - 6);
    if (opt.mug) mug(ctx, bx + 9, ly - 8);
    if (opt.cards) cards(ctx, bx, ly - 4);
    return h;
  }

  function tray(ctx, cx, y) {
    const D = (x, w, yy, hh, c) => R(ctx, cx + x, y + yy, w, hh, c);
    D(-14, 28, 4, 1, "#3d2616");
    D(-13, 26, 2, 2, "#8a5c3a");
    D(-12, 24, 1, 1, "#a87249");
    for (let i = 0; i < 3; i++) {
      const gx = -10 + i * 8;
      D(gx, 6, -6, 6, "#cfe6ee");
      D(gx, 6, -3, 3, "#e0a84a");
      D(gx, 6, -6, 2, "#fff8e8");
      D(gx + 5, 1, -5, 5, "#9dbecd");
    }
  }
  function mug(ctx, cx, y) {
    R(ctx, cx - 1, y - 1, 8, 11, "#2a1f1a");
    R(ctx, cx, y, 6, 9, "#cfe6ee");
    R(ctx, cx, y + 3, 6, 6, "#e0a84a");
    R(ctx, cx, y, 6, 3, "#fff8e8");
    R(ctx, cx + 6, y + 3, 1, 4, "#9dbecd");
  }
  function cards(ctx, cx, y) {
    R(ctx, cx - 9, y, 8, 10, "#2a1f1a");
    R(ctx, cx + 1, y, 8, 10, "#2a1f1a");
    R(ctx, cx - 8, y + 1, 6, 8, "#f4f0e4");
    R(ctx, cx + 2, y + 1, 6, 8, "#f4f0e4");
    R(ctx, cx - 7, y + 2, 3, 4, "#b8413f");
    R(ctx, cx + 3, y + 2, 3, 4, "#2a2a3a");
  }

  return {
    draw, W, HEIGHT, heightOf, POSES, HAIR, HEAD, HEAD_BACK, TORSO, TORSO_FRONT, ASYMMETRIC,
    styles: Object.keys(HAIR), outfits: Object.keys(OUTFIT),
  };
})();

if (typeof window !== "undefined") window.PixelActors = PixelActors;
