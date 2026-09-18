// PixelPeople — 손으로 찍은 캐릭터 스프라이트.
//
// 14×22 격자에 한 점씩 직접 배치했다. 도형 조립(원통·박스)으로는 얼굴과 실루엣이 안 나온다 —
// 눈 한 점의 위치, 어깨 폭 1픽셀 차이가 인상을 바꾸기 때문이다.
//
// 몸통(BASE)과 머리(HAIR_*)를 나눠 겹친다. 머리만 갈아 끼우면 같은 몸으로 여러 사람이 되고,
// 뒷모습(HAIR_BACK)은 얼굴 없이 머리로 뒤통수를 덮는다.
//
// 글자 의미
//   .  투명      O  외곽선     h  머리    H  머리 그늘
//   s  피부      S  피부 그늘  e  눈
//   c  상의      C  상의 밝음  p  하의    b  신발
const PixelPeople = (() => {
  const W = 14;
  const H = 22;

  // 얼굴이 있는 몸통. 머리카락 자리는 비워 두고 HAIR_* 가 덮는다.
  const BASE_FRONT = [
    "..............",
    "....OOOOOO....",
    "...OssssssO...",
    "..OssssssssO..",
    "..OssssssssO..",
    "..OssssssssO..",
    "..OsessssesO..",
    "..OssssssssO..",
    "..OSssssssSO..",
    "...OSSSSSSO...",
    "....OSSSSO....",
    "...OccccccO...",
    "..OCccccccCO..",
    "..OCccccccCO..",
    "..OCccccccCO..",
    "..OCccccccCO..",
    "..OccccccccO..",
    "..OppppppppO..",
    "..OpppOOpppO..",
    "..OpppOOpppO..",
    "..ObbbOObbbO..",
    "...OOO..OOO...",
  ];

  // 단발
  const HAIR_SHORT = [
    "....OOOOOO....",
    "..OOhhhhhhOO..",
    ".OhhhhhhhhhhO.",
    "OhhhhhhhhhhhhO",
    "Ohh........hhO",
    ".H..........H.",
    "..............",
    "..............",
    "..............",
    "..............",
    "..............",
    "..............",
    "..............",
    "..............",
    "..............",
    "..............",
    "..............",
    "..............",
    "..............",
    "..............",
    "..............",
    "..............",
  ];

  // 긴 머리 — 어깨까지 내려온다
  const HAIR_LONG = [
    "....OOOOOO....",
    "..OOhhhhhhOO..",
    ".OhhhhhhhhhhO.",
    "OhhhhhhhhhhhhO",
    "Ohh........hhO",
    "Ohh........hhO",
    "Ohh........hhO",
    "OHh........hHO",
    ".Oh........hO.",
    ".OH........HO.",
    "..............",
    "..............",
    "..............",
    "..............",
    "..............",
    "..............",
    "..............",
    "..............",
    "..............",
    "..............",
    "..............",
    "..............",
  ];

  // 묶은 머리 — 정수리에 매듭
  const HAIR_BUN = [
    ".....OhhO.....",
    "....OhhhhO....",
    "..OOhhhhhhOO..",
    ".OhhhhhhhhhhO.",
    "Ohh........hhO",
    ".H..........H.",
    "..............",
    "..............",
    "..............",
    "..............",
    "..............",
    "..............",
    "..............",
    "..............",
    "..............",
    "..............",
    "..............",
    "..............",
    "..............",
    "..............",
    "..............",
    "..............",
  ];

  // 삐친 머리
  const HAIR_SPIKY = [
    "...OO.OO.OO...",
    "..OhhOhhOhhO..",
    ".OhhhhhhhhhhO.",
    "OhhhhhhhhhhhhO",
    "Ohh........hhO",
    ".H..........H.",
    "..............",
    "..............",
    "..............",
    "..............",
    "..............",
    "..............",
    "..............",
    "..............",
    "..............",
    "..............",
    "..............",
    "..............",
    "..............",
    "..............",
    "..............",
    "..............",
  ];

  // 뒷모습 — 얼굴을 머리로 덮는다. 테이블 안쪽에 앉은 손님에 쓴다.
  const HAIR_BACK = [
    "....OOOOOO....",
    "..OOhhhhhhOO..",
    ".OhhhhhhhhhhO.",
    "OhhhhhhhhhhhhO",
    "OhhhhhhhhhhhhO",
    "OhhhhhhhhhhhhO",
    "OhhhhhhhhhhhhO",
    "OhhhhhhhhhhhhO",
    ".OhhhhhhhhhhO.",
    ".OHHHHHHHHHHO.",
    "..............",
    "..............",
    "..............",
    "..............",
    "..............",
    "..............",
    "..............",
    "..............",
    "..............",
    "..............",
    "..............",
    "..............",
  ];

  const HAIRS = { short: HAIR_SHORT, long: HAIR_LONG, bun: HAIR_BUN, spiky: HAIR_SPIKY, back: HAIR_BACK };

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

  const dim = (hex, t) => PixelArt.shade(hex, -t);

  /**
   * 사람 하나. (ox, oy)는 발밑 중앙.
   * look = { skin, hair, cloth, pants, style }  style: short|long|bun|spiky|back
   * opt  = { visor, bowtie, apron, tray, mug }
   */
  function person(ctx, ox, oy, look, opt = {}) {
    const x0 = Math.round(ox - W / 2);
    const y0 = Math.round(oy - H);
    const outline = dim(look.hair || "#3b2b20", 0.45);
    const map = {
      ".": null,
      O: outline,
      h: look.hair,
      H: dim(look.hair, 0.22),
      s: look.skin,
      S: dim(look.skin, 0.14),
      e: "#3a2a30",
      c: look.cloth,
      C: PixelArt.shade(look.cloth, 0.16),
      p: look.pants,
      b: dim(look.pants, 0.32),
    };
    blit(ctx, x0, y0, BASE_FRONT, map);
    blit(ctx, x0, y0, HAIRS[look.style] || HAIR_SHORT, map);

    // 유니폼 — 몸 스프라이트는 그대로 두고 위에 얹는다
    if (opt.visor) {
      ctx.fillStyle = opt.visor;
      ctx.fillRect(x0 + 2, y0 + 5, 10, 2);
      ctx.fillStyle = dim(opt.visor, 0.3);
      ctx.fillRect(x0 + 1, y0 + 7, 12, 1);
    }
    if (opt.bowtie) {
      ctx.fillStyle = opt.bowtie;
      ctx.fillRect(x0 + 5, y0 + 11, 4, 2);
      ctx.fillStyle = dim(opt.bowtie, 0.25);
      ctx.fillRect(x0 + 6, y0 + 11, 2, 2);
    }
    if (opt.apron) {
      ctx.fillStyle = opt.apron;
      ctx.fillRect(x0 + 4, y0 + 13, 6, 5);
      ctx.fillStyle = PixelArt.shade(opt.apron, 0.2);
      ctx.fillRect(x0 + 4, y0 + 13, 6, 1);
    }
    // 소지품 — 서빙 직원이 들고 다니는 쟁반 / 손님이 든 잔
    if (opt.tray) {
      ctx.fillStyle = "#c9c4bb";
      ctx.fillRect(x0 + 10, y0 + 13, 6, 1);
      ctx.fillStyle = "#e8e3d8";
      ctx.fillRect(x0 + 11, y0 + 11, 4, 2);
      ctx.fillStyle = "#f7f2e4";
      ctx.fillRect(x0 + 12, y0 + 10, 2, 1);
    }
    if (opt.mug) {
      ctx.fillStyle = "#e0a84a";
      ctx.fillRect(x0 + 11, y0 + 13, 3, 4);
      ctx.fillStyle = "#fff4d8";
      ctx.fillRect(x0 + 11, y0 + 12, 3, 1);
    }
  }

  return { person, W, H, styles: Object.keys(HAIRS), BASE_FRONT, HAIRS };
})();

if (typeof window !== "undefined") window.PixelPeople = PixelPeople;
