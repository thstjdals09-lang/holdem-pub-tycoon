// GameAssets — 홀덤펍 키우기 UI 에셋 라이브러리 (SVG)
//
// 포스터(키비주얼)의 아트 방향을 코드로 옮긴 것: 파스텔 핑크·크림·우드 + 골드 포인트,
// 진한 브라운 아웃라인, 그라데이션 없는 셀셰이딩(단색 면 + 하이라이트 도형).
// portraits.js와 같은 철학 — 외부 이미지 파일 없이 아이콘/프레임/트로피를 전부 코드로 그린다.
//
// 왜 그라데이션을 안 쓰나: <linearGradient>는 id가 필요한데 같은 화면에 인라인 SVG가
// 수십 개 깔리면 id가 충돌한다. 셀셰이딩은 원래 "단색 면 + 하이라이트 도형"이라
// 아트 방향과도 맞고, 마크업도 절반으로 줄어든다.
//
// 쓰는 법
//   GameAssets.icon("diamond", { size: 20 })   → <svg> 문자열 (innerHTML에 그대로)
//   GameAssets.dataUri("diamond")              → CSS background-image용 data URI
//   GameAssets.rarityFrame("legendary", { w: 108, h: 140 })
//   GameAssets.trophy("world", { size: 64 })
//   GameAssets.building(3, { size: 128 })
//   GameAssets.logo({ w: 320 })
const GameAssets = (() => {
  // ============================================================
  //  팔레트 — css/style.css의 :root와 톤을 맞춤
  // ============================================================
  const C = {
    ink: "#4a3038",
    inkSoft: "#6b4a52",
    white: "#ffffff",
    cream: "#fffaf5",
    cream2: "#ffeede",
    paper: "#fff2e6",

    pink: "#ff8fab",
    pinkL: "#ffc2d2",
    pinkD: "#ff5c8a",
    pinkDD: "#d13c68",

    gold: "#ffc85c",
    goldL: "#ffe8a8",
    goldD: "#e0a02f",
    goldDD: "#b97a18",

    cyan: "#62d0f0",
    cyanL: "#b6ecfa",
    cyanD: "#2d93b5",

    green: "#7bc67e",
    greenL: "#b6e3b8",
    greenD: "#4f9a54",
    felt: "#2f8f66",
    feltD: "#1f6b4b",

    purple: "#c86bff",
    purpleL: "#e3b6ff",
    purpleD: "#8d3cc4",

    blue: "#4fa3ff",
    blueL: "#a8d3ff",
    blueD: "#2c6fbf",

    gray: "#b9b2ae",
    grayL: "#ded8d4",
    grayD: "#8a817c",

    wood: "#b07a4e",
    woodL: "#d3a273",
    woodD: "#8a5c39",

    silver: "#d8dde6",
    silverD: "#98a3b4",
    bronze: "#d99a68",
    bronzeD: "#a86f45",
    navy: "#3c4a78",
    navyD: "#27305182",

    red: "#ff6b6b",
    redD: "#c74444",
  };

  // 공통 아웃라인 — 48 뷰박스 기준. 모든 아이콘이 같은 굵기를 쓰면 한 세트로 보인다.
  const SW = 2.6;
  const OUT = `fill="none" stroke="${C.ink}" stroke-width="${SW}" stroke-linecap="round" stroke-linejoin="round"`;
  // 채운 도형에 아웃라인까지 한 번에
  const F = (fill) =>
    `fill="${fill}" stroke="${C.ink}" stroke-width="${SW}" stroke-linejoin="round" stroke-linecap="round"`;
  // 아웃라인 없는 하이라이트/그림자 도형
  const P = (fill, op) => `fill="${fill}"${op != null ? ` opacity="${op}"` : ""}`;

  const glow = (fill, op = 0.45) => `fill="${fill}" opacity="${op}"`;

  // ============================================================
  //  아이콘 — 전부 48x48 뷰박스, 여백 3
  // ============================================================
  const ICONS = {
    // ---------- 재화 ----------
    // BB 칩: 골드 포커칩 + 엣지 노치 + 스페이드 각인
    bb: `
      <circle cx="24" cy="26" r="18" ${P(C.goldDD, 0.32)}/>
      <circle cx="24" cy="24" r="18" ${F(C.goldD)}/>
      ${[0, 90, 180, 270]
        .map(
          (a) =>
            `<rect x="20.8" y="5.4" width="6.4" height="6" rx="1.6" ${P(C.cream)} transform="rotate(${a} 24 24)"/>`
        )
        .join("")}
      <circle cx="24" cy="24" r="12.2" ${F(C.gold)}/>
      <circle cx="24" cy="24" r="12.2" fill="none" stroke="${C.goldL}" stroke-width="1.8"/>
      <path d="M24 17.6c3.6 3.5 5.9 5.2 5.9 7.8a3.1 3.1 0 0 1-5.9 1.5 3.1 3.1 0 0 1-5.9-1.5c0-2.6 2.3-4.3 5.9-7.8Z" ${F(C.pinkD)}/>
      <path d="M22.3 29.4h3.4l-.8 2.8h-1.8Z" ${P(C.pinkDD)}/>
      <path d="M12.5 17.5A14 14 0 0 1 22 11" stroke="${C.white}" stroke-width="2.8" stroke-linecap="round" fill="none" opacity="0.55"/>`,

    // 다이아: 시안 보석, 위 크라운 면 + 아래 파빌리온
    diamond: `
      <path d="M13 7h22l9 11-20 23L4 18Z" ${P(C.cyanD, 0.3)} transform="translate(0 2)"/>
      <path d="M13 7h22l9 11-20 23L4 18Z" ${F(C.cyan)}/>
      <path d="M13 7 9 18h30L35 7Z" ${P(C.cyanL, 0.95)}/>
      <path d="M4 18h40L24 41Z" ${P(C.cyanD, 0.25)}/>
      <path d="M24 7 19 18l5 23 5-23Z" ${P(C.white, 0.35)}/>
      <path d="M13 7h22l9 11-20 23L4 18Z" ${OUT}/>
      <path d="M4 18h40M13 7l6 11M35 7l-6 11M19 18l5 23 5-23" ${OUT} stroke-width="2.1"/>
      <path d="M12.5 9.6 10.8 14" stroke="${C.white}" stroke-width="2.4" stroke-linecap="round" opacity="0.75" fill="none"/>`,

    // 트로피: 골드 컵 + 손잡이 + 핑크 리본
    trophy: `
      <path d="M13 8h22v9a11 11 0 0 1-22 0Z" ${F(C.gold)}/>
      <path d="M13 11H9a5 5 0 0 0 5 8M35 11h4a5 5 0 0 1-5 8" ${OUT}/>
      <path d="M17.5 10.5v6.5a6.5 6.5 0 0 0 3 5.5" stroke="${C.goldL}" stroke-width="2.6" stroke-linecap="round" fill="none"/>
      <path d="M21 28h6v6h-6Z" ${F(C.goldD)}/>
      <path d="M14 40h20l-2-6H16Z" ${F(C.gold)}/>
      <path d="M11 40h26v4H11Z" ${F(C.goldD)}/>
      <path d="M24 17.5c2.2 2 3.6 3.1 3.6 4.6a2 2 0 0 1-3.6 1 2 2 0 0 1-3.6-1c0-1.5 1.4-2.6 3.6-4.6Z" ${P(C.pinkD)}/>`,

    // 뽑기권: 핑크 티켓 + 노치 + 별
    ticket: `
      <path d="M6 13h36v7a4 4 0 0 0 0 8v7H6v-7a4 4 0 0 0 0-8Z" ${F(C.pink)}/>
      <path d="M6 13h36v7a4 4 0 0 0 0 8v7H6v-7a4 4 0 0 0 0-8Z" ${P(C.pinkL, 0)}/>
      <path d="M6 13h18v22H6v-7a4 4 0 0 0 0-8Z" ${P(C.pinkL, 0.55)}/>
      <path d="M27 15v3M27 22v3M27 29v3" stroke="${C.cream}" stroke-width="2.4" stroke-linecap="round" fill="none"/>
      <path d="M15.5 17.5 17.7 22l5 .7-3.6 3.5.9 5-4.5-2.4-4.5 2.4.9-5L8.3 22.7l5-.7Z" ${F(C.goldL)}/>
      <path d="M6 13h36v7a4 4 0 0 0 0 8v7H6v-7a4 4 0 0 0 0-8Z" ${OUT}/>`,

    // ---------- 하단 네비 ----------
    // 업그레이드(BUILD): 망치 + 렌치 교차
    build: `
      <rect x="4" y="4" width="40" height="40" rx="12" ${F(C.pink)}/>
      <rect x="7.5" y="7.5" width="33" height="16" rx="8" ${glow(C.white, 0.22)}/>
      <g transform="rotate(38 24 24)">
        <rect x="20.5" y="19" width="7" height="21" rx="3.4" ${F(C.goldD)}/>
        <path d="M17 8.5a7.4 7.4 0 1 0 14 0l-4.4 4.6h-5.2Z" ${F(C.cream)}/>
        <path d="M17 8.5 21.4 13v9h-4.2a7.4 7.4 0 0 1-.2-13.5Z" ${P(C.grayL, 0.65)}/>
        <path d="M17 8.5a7.4 7.4 0 1 0 14 0l-4.4 4.6h-5.2Z" ${OUT}/>
        <path d="M20.5 19h7" ${OUT} stroke-width="2.2"/>
      </g>
      <path d="M38 12.5l1.6 3.6 3.6 1.6-3.6 1.6L38 23l-1.6-3.7-3.6-1.6 3.6-1.6Z" ${P(C.goldL)}/>`,

    // 운영진(CREW): 세 명의 치비 실루엣
    crew: `
      <rect x="4" y="4" width="40" height="40" rx="12" ${F(C.pink)}/>
      <rect x="7.5" y="7.5" width="33" height="16" rx="8" ${glow(C.white, 0.22)}/>
      <circle cx="14" cy="21" r="5" ${F(C.cream2)}/>
      <path d="M6.5 37c0-4.6 3.4-7.5 7.5-7.5s7.5 2.9 7.5 7.5Z" ${F(C.cream2)}/>
      <circle cx="34" cy="21" r="5" ${F(C.cream2)}/>
      <path d="M26.5 37c0-4.6 3.4-7.5 7.5-7.5s7.5 2.9 7.5 7.5Z" ${F(C.cream2)}/>
      <circle cx="24" cy="17.5" r="6.5" ${F(C.goldL)}/>
      <path d="M14.5 38c0-5.6 4.2-9.2 9.5-9.2s9.5 3.6 9.5 9.2Z" ${F(C.gold)}/>
      <path d="M20 12.2 24 9l4 3.2-1.4 1.6h-5.2Z" ${F(C.goldD)}/>`,

    // 대회(WIN): 트로피 + 광채
    tournament: `
      <rect x="4" y="4" width="40" height="40" rx="12" ${F(C.pink)}/>
      <rect x="7.5" y="7.5" width="33" height="16" rx="8" ${glow(C.white, 0.22)}/>
      <path d="M16 11h16v7.5a8 8 0 0 1-16 0Z" ${F(C.gold)}/>
      <path d="M16 13.5h-3a4 4 0 0 0 4 6.2M32 13.5h3a4 4 0 0 1-4 6.2" ${OUT} stroke-width="2.2"/>
      <path d="M21.5 26h5v5h-5Z" ${F(C.goldD)}/>
      <path d="M15.5 37h17l-2-6h-13Z" ${F(C.gold)}/>
      <path d="M19.5 13.5v5a4.6 4.6 0 0 0 2 3.8" stroke="${C.goldL}" stroke-width="2.2" stroke-linecap="round" fill="none"/>`,

    // 상점: 다이아 + 쇼핑백
    shop: `
      <rect x="4" y="4" width="40" height="40" rx="12" ${F(C.pink)}/>
      <rect x="7.5" y="7.5" width="33" height="16" rx="8" ${glow(C.white, 0.22)}/>
      <path d="M18 20v-4a6 6 0 0 1 12 0v4" ${OUT} stroke-width="3"/>
      <path d="M11.5 19.5h25a1.6 1.6 0 0 1 1.6 1.8l-2.2 17a2 2 0 0 1-2 1.7H14.1a2 2 0 0 1-2-1.7l-2.2-17a1.6 1.6 0 0 1 1.6-1.8Z" ${F(C.cream)}/>
      <path d="M11.5 19.5h7l-1 20.5h-3.4a2 2 0 0 1-2-1.7l-2.2-17a1.6 1.6 0 0 1 1.6-1.8Z" ${P(C.cream2, 0.9)}/>
      <path d="M11.5 19.5h25a1.6 1.6 0 0 1 1.6 1.8l-2.2 17a2 2 0 0 1-2 1.7H14.1a2 2 0 0 1-2-1.7l-2.2-17a1.6 1.6 0 0 1 1.6-1.8Z" ${OUT}/>
      <path d="M20.5 25.5h7l2.8 3.8L24 36.6l-6.3-7.3Z" ${F(C.cyan)}/>
      <path d="M20.5 25.5 17.7 29.3h12.6L27.5 25.5Z" ${P(C.cyanL, 0.95)}/>
      <path d="M20.5 25.5h7l2.8 3.8L24 36.6l-6.3-7.3Z" ${OUT} stroke-width="2"/>`,

    // ---------- 업그레이드 세부 탭 ----------
    // 테이블: 위에서 본 오벌 홀덤 테이블 + 카드 2장
    table: `
      <rect x="4" y="15" width="40" height="22" rx="11" ${F(C.woodD)}/>
      <rect x="4" y="12" width="40" height="22" rx="11" ${F(C.wood)}/>
      <rect x="7.5" y="15.5" width="33" height="15" rx="7.5" ${F(C.green)}/>
      <rect x="10.5" y="18.5" width="27" height="9" rx="4.5" fill="none" stroke="${C.greenL}" stroke-width="1.6" opacity="0.8"/>
      <g transform="rotate(-13 19 23)"><rect x="15.5" y="17.5" width="8" height="11.5" rx="2" ${F(C.cream)} stroke-width="2"/>
        <path d="M19.5 20.4c1.7 1.6 2.7 2.4 2.7 3.5a1.4 1.4 0 0 1-2.7.7 1.4 1.4 0 0 1-2.7-.7c0-1.1 1-1.9 2.7-3.5Z" ${P(C.ink)}/></g>
      <g transform="rotate(13 28 23)"><rect x="24.5" y="17.5" width="8" height="11.5" rx="2" ${F(C.cream)} stroke-width="2"/>
        <path d="M28.5 20.4c1.7 1.6 2.7 2.4 2.7 3.5a1.4 1.4 0 0 1-2.7.7 1.4 1.4 0 0 1-2.7-.7c0-1.1 1-1.9 2.7-3.5Z" ${P(C.pinkD)}/></g>
      <circle cx="12.5" cy="23" r="2.6" ${F(C.pinkD)}/>
      <circle cx="35.5" cy="23" r="2.6" ${F(C.gold)}/>`,

    // 시설: 바 카운터 + 술병 선반
    fixture: `
      <rect x="7" y="7" width="34" height="15" rx="3" ${F(C.cream)}/>
      <path d="M7 15h34" ${OUT} stroke-width="2.1"/>
      <rect x="11" y="8.6" width="4.6" height="5.4" rx="1.4" ${F(C.green)}/>
      <rect x="17.6" y="8.6" width="4.6" height="5.4" rx="1.4" ${F(C.pink)}/>
      <rect x="24.2" y="8.6" width="4.6" height="5.4" rx="1.4" ${F(C.gold)}/>
      <rect x="30.8" y="8.6" width="4.6" height="5.4" rx="1.4" ${F(C.cyan)}/>
      <rect x="12" y="16.6" width="4.6" height="4" rx="1.3" ${F(C.purple)}/>
      <rect x="19" y="16.6" width="4.6" height="4" rx="1.3" ${F(C.goldD)}/>
      <rect x="26" y="16.6" width="4.6" height="4" rx="1.3" ${F(C.blue)}/>
      <rect x="4" y="25" width="40" height="7" rx="3" ${F(C.woodL)}/>
      <rect x="8" y="32" width="32" height="10" rx="2.6" ${F(C.wood)}/>
      <path d="M15 32v10M24 32v10M33 32v10" ${OUT} stroke-width="2.1"/>`,

    // 직원: 앞치마 입은 사람 + 쟁반
    staff: `
      <circle cx="21" cy="14" r="7.5" ${F(C.cream2)}/>
      <path d="M13.8 11.2C15 6.6 19 5 22 5.6c3.8.8 5.6 3.4 5.8 6.2-2.6-1-4.6-2.4-5.8-4-1.4 1.8-4 3-8.2 3.4Z" ${F(C.ink)}/>
      <path d="M9 43v-8a12 12 0 0 1 24 0v8Z" ${F(C.pink)}/>
      <path d="M17 26h8v11a4 4 0 0 1-8 0Z" ${F(C.cream)}/>
      <path d="M17 26h8" ${OUT} stroke-width="2.1"/>
      <path d="M32 26h11" ${OUT}/>
      <ellipse cx="38.5" cy="24.5" rx="7" ry="2.6" ${F(C.silver)}/>
      <ellipse cx="38.5" cy="23.4" rx="7" ry="2.6" ${F(C.silverD)}/>
      <ellipse cx="38.5" cy="23" rx="7" ry="2.6" ${F(C.grayL)}/>
      <path d="M36 21.5h5" stroke="${C.white}" stroke-width="2" stroke-linecap="round" fill="none"/>`,

    // 인테리어: 소파 + 스탠드 조명
    interior: `
      <path d="M31 9a5 5 0 0 1 10 0l1.6 7H29.4Z" ${F(C.goldL)}/>
      <path d="M36 16v18" ${OUT}/>
      <path d="M30 40h12l-1.4-6H31.4Z" ${F(C.wood)}/>
      <rect x="3" y="20" width="9" height="16" rx="4.5" ${F(C.pinkD)}/>
      <rect x="4" y="20" width="24" height="16" rx="5" ${F(C.pink)}/>
      <rect x="6.5" y="24" width="19" height="9" rx="4" ${F(C.pinkL)}/>
      <rect x="2" y="33" width="27" height="7" rx="3.4" ${F(C.pinkD)}/>
      <path d="M7 40v3M24 40v3" ${OUT}/>`,

    // ---------- 시설 개별 ----------
    bar: `
      <path d="M9 10h30L26 26v11h6" ${OUT}/>
      <path d="M12.5 13.5h23L25.5 25.5h-3Z" ${F(C.pinkL)}/>
      <path d="M12.5 13.5h23l-3.4 4H15.9Z" ${P(C.pink, 0.9)}/>
      <path d="M20 37h12" ${OUT}/>
      <circle cx="31" cy="12.5" r="4" ${F(C.green)}/>
      <path d="M34 8.5c2 .5 3.4 2.2 3.4 4.2" stroke="${C.greenD}" stroke-width="2.2" stroke-linecap="round" fill="none"/>
      <circle cx="17" cy="20" r="2" ${glow(C.white, 0.7)}/>`,

    fridge: `
      <rect x="11" y="4" width="26" height="40" rx="5" ${F(C.silverD)}/>
      <rect x="11" y="4" width="26" height="40" rx="5" ${P(C.white, 0)}/>
      <rect x="12.8" y="5.8" width="10" height="36.4" rx="3.4" ${glow(C.white, 0.28)}/>
      <path d="M11 20h26" ${OUT}/>
      <path d="M31 10v6M31 25v6" stroke="${C.ink}" stroke-width="3" stroke-linecap="round" fill="none"/>
      <path d="M19 27.5v9M15 30l8 4M23 30l-8 4" stroke="${C.cyanD}" stroke-width="2.2" stroke-linecap="round" fill="none"/>`,

    // ---------- 직원 개별 ----------
    // 칵테일 셰이커 — 위가 넓고 아래로 좁아지는 몸통 + 뚜껑, 옆에 튀는 물방울
    bartender: `
      <path d="M16.5 4h15a2 2 0 0 1 2 2.4l-.7 3.6h-17.6l-.7-3.6A2 2 0 0 1 16.5 4Z" ${F(C.silverD)}/>
      <path d="M13.6 12.5a2.4 2.4 0 0 1 2.4-2.5h16a2.4 2.4 0 0 1 2.4 2.5l-2.8 27a4 4 0 0 1-4 3.5h-7.2a4 4 0 0 1-4-3.5Z" ${F(C.silver)}/>
      <path d="M17.6 10h4.4l-2.6 33a4 4 0 0 1-2.4-3.5Z" ${glow(C.white, 0.7)}/>
      <path d="M13.6 12.5a2.4 2.4 0 0 1 2.4-2.5h16a2.4 2.4 0 0 1 2.4 2.5l-2.8 27a4 4 0 0 1-4 3.5h-7.2a4 4 0 0 1-4-3.5Z" ${OUT}/>
      <path d="M14.2 18h19.6" ${OUT} stroke-width="2.2"/>
      <circle cx="40.5" cy="13" r="3.4" ${F(C.gold)}/>
      <circle cx="44" cy="22" r="2.2" ${F(C.pink)}/>
      <circle cx="7.5" cy="17" r="2.6" ${F(C.cyan)}/>`,

    // 클로슈(뚜껑) 덮은 접시를 손으로 받쳐 든 모습
    server: `
      <path d="M24 5v3.5" ${OUT} stroke-width="3"/>
      <circle cx="24" cy="4" r="2.6" ${F(C.pinkD)}/>
      <path d="M9 24a15 12 0 0 1 30 0Z" ${F(C.grayL)}/>
      <path d="M14 22a10 9 0 0 1 8-7.6" stroke="${C.white}" stroke-width="3" stroke-linecap="round" fill="none"/>
      <path d="M9 24a15 12 0 0 1 30 0Z" ${OUT}/>
      <rect x="4" y="24" width="40" height="5" rx="2.5" ${F(C.silver)}/>
      <path d="M24 29v5" ${OUT} stroke-width="3"/>
      <path d="M12 44c0-6 5.4-10 12-10s12 4 12 10Z" ${F(C.pink)}/>
      <path d="M17 41c1-3.4 3.6-5.4 7-5.8" stroke="${C.pinkL}" stroke-width="2.6" stroke-linecap="round" fill="none"/>`,

    marketer: `
      <path d="M8 19h7l17-10v30L15 29H8a3 3 0 0 1-3-3v-4a3 3 0 0 1 3-3Z" ${F(C.pink)}/>
      <path d="M15 19h5v10h-5Z" ${P(C.pinkD, 0.55)}/>
      <path d="M8 19h7l17-10v30L15 29H8a3 3 0 0 1-3-3v-4a3 3 0 0 1 3-3Z" ${OUT}/>
      <path d="M16 29h6v9a3 3 0 0 1-6 0Z" ${F(C.goldD)}/>
      <path d="M37 16.5c2.4 2 3.6 4.6 3.6 7.5s-1.2 5.5-3.6 7.5M41.5 11.5c3.6 3.2 5.5 7.6 5.5 12.5s-1.9 9.3-5.5 12.5" ${OUT} stroke-width="2.4"/>`,

    // ---------- 역할(배치 시너지 태그) ----------
    roleSales: `
      <rect x="4" y="6" width="40" height="36" rx="7" ${F(C.cream)}/>
      <path d="M10 33l8-8 6 5 12-13" ${OUT} stroke-width="3.2" stroke="${C.pinkD}"/>
      <path d="M28 17h9v9" ${OUT} stroke-width="3.2" stroke="${C.pinkD}"/>
      <circle cx="18" cy="25" r="2.8" ${F(C.gold)}/>
      <rect x="4" y="6" width="40" height="36" rx="7" ${OUT}/>`,

    roleService: `
      <path d="M9 32c0-8 4-13.5 10-15V14a5 5 0 0 1 10 0v3c6 1.5 10 7 10 15Z" ${F(C.gold)}/>
      <path d="M19 19.5c-4 2.4-6.4 6.6-6.8 11.5" stroke="${C.goldL}" stroke-width="2.6" stroke-linecap="round" fill="none"/>
      <path d="M6 32h36" ${OUT} stroke-width="3"/>
      <path d="M20 36h8a4 4 0 0 1-8 0Z" ${F(C.goldD)}/>
      <circle cx="24" cy="9" r="3" ${F(C.pinkD)}/>`,

    roleEvent: `
      <path d="M10 41 22 17l9 9Z" ${F(C.pink)}/>
      <path d="M10 41 22 17l4.5 4.5Z" ${P(C.pinkL, 0.75)}/>
      <path d="M10 41 22 17l9 9Z" ${OUT}/>
      <path d="M31 6v6M38 9l-4 4M41 18h-6" ${OUT} stroke="${C.goldD}" stroke-width="2.8"/>
      <circle cx="36" cy="26" r="2.6" ${F(C.cyan)}/>
      <circle cx="42" cy="32" r="2" ${F(C.green)}/>
      <circle cx="30" cy="34" r="2.2" ${F(C.gold)}/>`,

    roleNetwork: `
      <path d="M17 18 31 12M17 30l14 6M18 24h12" ${OUT} stroke-width="2.8"/>
      <circle cx="12" cy="24" r="7" ${F(C.pink)}/>
      <circle cx="36" cy="10" r="6" ${F(C.gold)}/>
      <circle cx="36" cy="38" r="6" ${F(C.cyan)}/>
      <circle cx="38" cy="23" r="5.4" ${F(C.green)}/>
      <circle cx="10" cy="21.5" r="2.4" ${glow(C.white, 0.6)}/>`,

    // ---------- 특성 시너지 6종 ----------
    traitDealing: `
      <g transform="rotate(-18 19 24)"><rect x="9" y="12" width="17" height="24" rx="3" ${F(C.cream)}/></g>
      <g transform="rotate(10 30 23)"><rect x="22" y="10" width="17" height="24" rx="3" ${F(C.cream)}/>
        <path d="M30.5 15.5c3 2.8 4.8 4.2 4.8 6.2a2.6 2.6 0 0 1-4.8 1.3 2.6 2.6 0 0 1-4.8-1.3c0-2 1.8-3.4 4.8-6.2Z" ${F(C.ink)}/></g>
      <path d="M6 42c2.5-4 6-6 10.5-6" ${OUT} stroke-width="3"/>`,

    traitSocial: `
      <path d="M5 12a4 4 0 0 1 4-4h18a4 4 0 0 1 4 4v10a4 4 0 0 1-4 4H16l-7 5v-5a4 4 0 0 1-4-4Z" ${F(C.pink)}/>
      <path d="M12 14h12M12 19h8" stroke="${C.cream}" stroke-width="2.6" stroke-linecap="round" fill="none"/>
      <path d="M5 12a4 4 0 0 1 4-4h18a4 4 0 0 1 4 4v10a4 4 0 0 1-4 4H16l-7 5v-5a4 4 0 0 1-4-4Z" ${OUT}/>
      <path d="M24 24h15a4 4 0 0 1 4 4v7a4 4 0 0 1-4 4h-3l-5 4v-4a4 4 0 0 1-4-4Z" ${F(C.gold)}/>
      <path d="M31 30h6" stroke="${C.ink}" stroke-width="2.4" stroke-linecap="round" fill="none"/>`,

    traitHospitality: `
      <path d="M24 41S8 31 8 20.5A8.5 8.5 0 0 1 24 16a8.5 8.5 0 0 1 16 4.5C40 31 24 41 24 41Z" ${F(C.pinkD)}/>
      <path d="M15 19.5a5.5 5.5 0 0 1 6-3.2" stroke="${C.pinkL}" stroke-width="3" stroke-linecap="round" fill="none"/>
      <path d="M24 41S8 31 8 20.5A8.5 8.5 0 0 1 24 16a8.5 8.5 0 0 1 16 4.5C40 31 24 41 24 41Z" ${OUT}/>
      <path d="M12 12l-3-4M24 9V4M36 12l3-4" ${OUT} stroke="${C.gold}" stroke-width="3"/>`,

    traitGambler: `
      <g transform="rotate(-12 17 28)"><rect x="6" y="17" width="22" height="22" rx="5" ${F(C.cream)}/>
        <circle cx="12.5" cy="23.5" r="2.4" ${P(C.pinkD)}/><circle cx="21.5" cy="32.5" r="2.4" ${P(C.pinkD)}/>
        <circle cx="17" cy="28" r="2.4" ${P(C.ink)}/></g>
      <g transform="rotate(14 33 20)"><rect x="23" y="9" width="20" height="20" rx="5" ${F(C.pinkD)}/>
        <circle cx="29" cy="15" r="2.2" ${P(C.cream)}/><circle cx="37" cy="15" r="2.2" ${P(C.cream)}/>
        <circle cx="29" cy="23" r="2.2" ${P(C.cream)}/><circle cx="37" cy="23" r="2.2" ${P(C.cream)}/></g>`,

    traitHype: `
      <path d="M20 34V11l18-4v23" ${OUT} stroke-width="3.2"/>
      <ellipse cx="14.5" cy="34" rx="6.5" ry="5.2" ${F(C.pinkD)}/>
      <ellipse cx="32.5" cy="30" rx="6" ry="4.8" ${F(C.pink)}/>
      <path d="M20 16.5 38 12.5" ${OUT} stroke-width="2.6"/>
      <path d="M8 12l2.5 5 5 .7-3.6 3.5.9 5L8 23.8 3.5 26.2l.9-5L.8 17.7l5-.7Z" ${F(C.gold)} transform="translate(2 -4) scale(0.8)"/>`,

    // 전구 + 톱니 — "두뇌"는 뇌 그림보다 아이디어/머리 굴리기 쪽이 작은 크기에서 훨씬 잘 읽힌다
    traitBrain: `
      <path d="M24 4a13 13 0 0 1 8 23.2V32H16v-4.8A13 13 0 0 1 24 4Z" ${F(C.goldL)}/>
      <path d="M19.5 22.5A8.5 8.5 0 0 1 21 9.5" stroke="${C.white}" stroke-width="3" stroke-linecap="round" fill="none"/>
      <path d="M24 4a13 13 0 0 1 8 23.2V32H16v-4.8A13 13 0 0 1 24 4Z" ${OUT}/>
      <rect x="16" y="32" width="16" height="4.6" rx="2.3" ${F(C.goldD)}/>
      <rect x="18" y="37.4" width="12" height="4.4" rx="2.2" ${F(C.goldD)}/>
      <path d="M21 43.5h6" ${OUT} stroke-width="3"/>
      <path d="M24 12.5c2.6 2.4 4.2 3.6 4.2 5.4a2.2 2.2 0 0 1-4.2 1.1 2.2 2.2 0 0 1-4.2-1.1c0-1.8 1.6-3 4.2-5.4Z" ${P(C.pinkD, 0.85)}/>
      <path d="M7 14l-3.4-1M9 6 6.6 3.4M41 14l3.4-1M39 6l2.4-2.6" ${OUT} stroke="${C.gold}" stroke-width="2.8"/>`,

    // ---------- 사이드 레일 ----------
    gift: `
      <rect x="5" y="17" width="38" height="8" rx="3" ${F(C.gold)}/>
      <rect x="8" y="25" width="32" height="17" rx="3.4" ${F(C.pink)}/>
      <rect x="8" y="25" width="32" height="5" rx="2" ${glow(C.white, 0.25)}/>
      <rect x="20" y="17" width="8" height="25" ${F(C.pinkD)}/>
      <path d="M24 17c-3-7-13-8-13-2 0 3.4 6 3.6 13 2Zm0 0c3-7 13-8 13-2 0 3.4-6 3.6-13 2Z" ${F(C.pinkD)}/>
      <rect x="5" y="17" width="38" height="8" rx="3" ${OUT}/>`,

    attendance: `
      <rect x="5" y="9" width="38" height="34" rx="6" ${F(C.cream)}/>
      <path d="M5 19h38" ${OUT}/>
      <rect x="5" y="9" width="38" height="10" rx="6" ${F(C.pinkD)}/>
      <path d="M14 5v8M34 5v8" ${OUT} stroke-width="3.4"/>
      <path d="M15 31.5l5.5 5.5L34 24" ${OUT} stroke="${C.green}" stroke-width="4.4"/>`,

    mission: `
      <rect x="8" y="7" width="32" height="37" rx="5" ${F(C.cream)}/>
      <rect x="17" y="3" width="14" height="8" rx="3" ${F(C.gold)}/>
      <path d="M15 19h10M15 27h14M15 35h8" ${OUT} stroke-width="2.6"/>
      <rect x="8" y="7" width="32" height="37" rx="5" ${OUT}/>
      <circle cx="35" cy="33" r="9" ${F(C.green)}/>
      <path d="M30.5 33.5l3 3 6-6.5" stroke="${C.white}" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>`,

    boost: `
      <circle cx="24" cy="24" r="19" ${F(C.gold)}/>
      <circle cx="24" cy="24" r="19" ${P(C.goldL, 0)}/>
      <path d="M10 18a19 19 0 0 1 20-8" stroke="${C.goldL}" stroke-width="3.4" stroke-linecap="round" fill="none"/>
      <path d="M26 6 12 27h9l-1 15 15-21h-9Z" ${F(C.pinkD)}/>`,

    // ---------- 트로피 상점 ----------
    moon: `
      <path d="M31 6a18 18 0 1 0 11 32A20 20 0 0 1 31 6Z" ${F(C.gold)}/>
      <path d="M31 6a18 18 0 1 0 11 32A20 20 0 0 1 31 6Z" ${OUT}/>
      <circle cx="17" cy="20" r="2.4" ${P(C.goldD, 0.55)}/>
      <circle cx="22" cy="31" r="1.8" ${P(C.goldD, 0.55)}/>
      <path d="M38 8l1.6 3.4 3.4 1.6-3.4 1.6L38 18l-1.6-3.4L33 13l3.4-1.6Z" ${F(C.cream)}/>`,

    target: `
      <circle cx="22" cy="26" r="18" ${F(C.cream)}/>
      <circle cx="22" cy="26" r="12.5" ${F(C.pink)}/>
      <circle cx="22" cy="26" r="7" ${F(C.cream)}/>
      <circle cx="22" cy="26" r="3" ${F(C.pinkD)}/>
      <path d="M26 22 44 4" ${OUT} stroke-width="3.2"/>
      <path d="M38 4h6v6" ${OUT} stroke-width="3.2" stroke="${C.goldD}"/>`,

    hall: `
      <path d="M24 4 44 15H4Z" ${F(C.gold)}/>
      <rect x="6" y="15" width="36" height="4" rx="1.6" ${F(C.goldL)}/>
      <rect x="10" y="19" width="5" height="17" ${F(C.cream)}/>
      <rect x="21.5" y="19" width="5" height="17" ${F(C.cream)}/>
      <rect x="33" y="19" width="5" height="17" ${F(C.cream)}/>
      <rect x="4" y="36" width="40" height="6" rx="2.4" ${F(C.goldD)}/>
      <path d="M24 4 44 15H4Z" ${OUT}/>`,

    shard: `
      <path d="M24 4 39 14l-5 26H14L9 14Z" ${F(C.purpleL)}/>
      <path d="M24 4 39 14l-5 26L24 4Z" ${P(C.purple, 0.85)}/>
      <path d="M9 14h30M24 4v36" ${OUT} stroke-width="2.1"/>
      <path d="M24 4 39 14l-5 26H14L9 14Z" ${OUT}/>
      <path d="M13.5 10.5 16 8" stroke="${C.white}" stroke-width="2.6" stroke-linecap="round" fill="none" opacity="0.8"/>`,

    // ---------- 공용 ----------
    crown: `
      <path d="M5 34 3 13l11 7 10-13 10 13 11-7-2 21Z" ${F(C.gold)}/>
      <path d="M5 34 3 13l11 7 10-13Z" ${P(C.goldL, 0.7)}/>
      <path d="M5 34 3 13l11 7 10-13 10 13 11-7-2 21Z" ${OUT}/>
      <rect x="5" y="34" width="38" height="7" rx="2.6" ${F(C.goldD)}/>
      <circle cx="24" cy="26" r="3" ${F(C.pinkD)}/>
      <circle cx="13" cy="28" r="2.2" ${F(C.cyan)}/>
      <circle cx="35" cy="28" r="2.2" ${F(C.cyan)}/>`,

    profile: `
      <circle cx="24" cy="24" r="19" ${F(C.cream)}/>
      <circle cx="24" cy="19.5" r="7.5" ${F(C.pink)}/>
      <path d="M10.5 38.5a14 14 0 0 1 27 0" ${F(C.pink)}/>
      <circle cx="24" cy="24" r="19" ${OUT}/>`,

    settings: `
      <path d="M20 4h8l1 5.4a15 15 0 0 1 4 2.3l5-2.2 4 7-4.2 3.5a15 15 0 0 1 0 4.6l4.2 3.5-4 7-5-2.2a15 15 0 0 1-4 2.3L28 44h-8l-1-5.4a15 15 0 0 1-4-2.3l-5 2.2-4-7 4.2-3.5a15 15 0 0 1 0-4.6L6 19.5l4-7 5 2.2a15 15 0 0 1 4-2.3Z" ${F(C.grayL)}/>
      <circle cx="24" cy="24" r="7" ${F(C.cream)}/>`,

    star: `
      <path d="M24 4.5 30.4 17.4 44.7 19.5 34.3 29.6 36.8 43.9 24 37.1 11.2 43.9 13.7 29.6 3.3 19.5 17.6 17.4Z" ${F(C.gold)}/>
      <path d="M24 4.5 30.4 17.4 44.7 19.5 34.3 29.6 24 24Z" ${P(C.goldL, 0.7)}/>
      <path d="M24 4.5 30.4 17.4 44.7 19.5 34.3 29.6 36.8 43.9 24 37.1 11.2 43.9 13.7 29.6 3.3 19.5 17.6 17.4Z" ${OUT}/>`,

    visitor: `
      <circle cx="11" cy="17" r="5" ${F(C.cream2)}/>
      <path d="M3 33c0-4.4 3.6-7 8-7s8 2.6 8 7Z" ${F(C.cream2)}/>
      <circle cx="37" cy="17" r="5" ${F(C.cream2)}/>
      <path d="M29 33c0-4.4 3.6-7 8-7s8 2.6 8 7Z" ${F(C.cream2)}/>
      <circle cx="24" cy="16" r="7" ${F(C.pink)}/>
      <path d="M12.5 40c0-6.4 5-10.5 11.5-10.5S35.5 33.6 35.5 40Z" ${F(C.pink)}/>`,

    income: `
      <circle cx="21" cy="27" r="16" ${F(C.gold)}/>
      <circle cx="21" cy="27" r="16" ${OUT}/>
      <circle cx="21" cy="27" r="10" ${F(C.goldL)}/>
      <path d="M21 21c2.8 2.6 4.6 4 4.6 6a2.4 2.4 0 0 1-4.6 1.2A2.4 2.4 0 0 1 16.4 27c0-2 1.8-3.4 4.6-6Z" ${F(C.pinkD)}/>
      <path d="M31 17l9-9" ${OUT} stroke="${C.green}" stroke-width="3.6"/>
      <path d="M33 6h8v8" ${OUT} stroke="${C.green}" stroke-width="3.6"/>`,

    lock: `
      <path d="M15 20v-5a9 9 0 0 1 18 0v5" ${OUT} stroke-width="3.4"/>
      <rect x="8" y="20" width="32" height="23" rx="6" ${F(C.gold)}/>
      <rect x="8" y="20" width="32" height="23" rx="6" ${OUT}/>
      <circle cx="24" cy="29" r="4" ${F(C.ink)}/>
      <path d="M24 31v6" ${OUT} stroke-width="3.4"/>`,

    plus: `
      <circle cx="24" cy="24" r="18" ${F(C.green)}/>
      <circle cx="24" cy="24" r="18" ${OUT}/>
      <path d="M24 14v20M14 24h20" stroke="${C.white}" stroke-width="5" stroke-linecap="round" fill="none"/>`,

    check: `
      <circle cx="24" cy="24" r="18" ${F(C.green)}/>
      <circle cx="24" cy="24" r="18" ${OUT}/>
      <path d="M14.5 24.5 21 31l13-13.5" stroke="${C.white}" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>`,
  };

  // 한국어 라벨 — 프리뷰 페이지와 툴팁에서 쓴다
  const LABELS = {
    bb: "BB(칩)", diamond: "다이아", trophy: "트로피", ticket: "뽑기권",
    build: "업그레이드", crew: "운영진", tournament: "대회", shop: "상점",
    table: "테이블", fixture: "시설", staff: "직원", interior: "인테리어",
    bar: "바 카운터", fridge: "냉장고",
    bartender: "바텐더", server: "서빙 직원", marketer: "마케터",
    roleSales: "영업", roleService: "서비스", roleEvent: "이벤트", roleNetwork: "인맥",
    traitDealing: "딜링", traitSocial: "처세", traitHospitality: "접객",
    traitGambler: "승부사", traitHype: "흥", traitBrain: "두뇌",
    gift: "선물", attendance: "출석", mission: "미션", boost: "부스트",
    moon: "영업시간 연장", target: "대회 훈련", hall: "명예의 전당", shard: "승급 조각",
    crown: "프레스티지", profile: "프로필", settings: "설정", star: "별",
    visitor: "방문객", income: "초당 수익", lock: "잠김", plus: "추가", check: "완료",
  };

  // 기존 이모지 → 아이콘 이름 (game.js를 한 번에 안 고치고 점진적으로 바꿀 때 쓴다)
  const EMOJI_MAP = {
    "💎": "diamond", "🏆": "trophy", "🎫": "ticket", "🏗": "build", "👥": "crew",
    "🎁": "gift", "📅": "attendance", "📋": "mission", "⚡": "boost", "⚙️": "settings",
    "👑": "crown", "🍸": "bar", "🧊": "fridge", "🍹": "bartender", "🍽️": "server",
    "📣": "marketer", "🌙": "moon", "🎯": "target", "🏛️": "hall", "⭐": "star",
  };

  // ============================================================
  //  등급 프레임 — 도감/가챠 카드
  // ============================================================
  // 포스터의 카드처럼 등급마다 테두리 색·광채·바탕 무늬가 달라진다.
  const RARITY = {
    common:    { short: "N",  name: "일반", a: "#a9a29c", b: "#d8d2cc", c: "#efe9e3", rays: 0 },
    uncommon:  { short: "U",  name: "고급", a: "#4f9a54", b: "#7bc67e", c: "#d8f0d9", rays: 0 },
    rare:      { short: "R",  name: "희귀", a: "#2c6fbf", b: "#4fa3ff", c: "#d4e8ff", rays: 6 },
    epic:      { short: "SR", name: "영웅", a: "#8d3cc4", b: "#c86bff", c: "#eddcff", rays: 10 },
    legendary: { short: "SSR", name: "전설", a: "#cf9522", b: "#ffc85c", c: "#fff0cd", rays: 16 },
    mythic:    { short: "MR", name: "신화", a: "#c21d90", b: "#ff5fd0", c: "#ffdcf3", rays: 20 },
  };

  // ============================================================
  //  대회 트로피 5단계 — data.js의 tournament.tiers와 id가 1:1로 맞는다
  // ============================================================
  const TROPHY_TIERS = {
    local:    { name: "동네 홀덤 대회", metal: C.bronze, metalD: C.bronzeD, metalL: "#f0c39c", ribbon: null,      wings: false, gems: 0, star: false },
    city:     { name: "시티 오픈",      metal: C.silver, metalD: C.silverD, metalL: "#f2f5f9", ribbon: null,      wings: false, gems: 0, star: false },
    national: { name: "코리아 챔피언십", metal: C.gold,  metalD: C.goldD,   metalL: C.goldL,   ribbon: C.pinkD,   wings: false, gems: 1, star: false },
    asia:     { name: "아시아 포커 투어", metal: C.gold, metalD: C.goldD,   metalL: C.goldL,   ribbon: C.purple,  wings: false, gems: 2, star: true },
    world:    { name: "월드 그랜드 파이널", metal: C.gold, metalD: C.goldD, metalL: C.goldL,   ribbon: C.pinkD,   wings: true,  gems: 3, star: true },
  };

  // ============================================================
  //  프레스티지 건물 4단계 (포스터의 로컬 펍 → 포커 제국)
  // ============================================================
  const BUILDINGS = [
    { id: "pub",     name: "로컬 펍",       wall: "#c9a077", wallD: "#a87f57", roof: "#a4614a", roofD: "#7f4636", trim: C.cream2, floors: 1, crown: false, carpet: false },
    { id: "club",    name: "인기 클럽",     wall: "#8fc9cf", wallD: "#63a2aa", roof: "#4f8f99", roofD: "#3a6d76", trim: C.cream,  floors: 2, crown: false, carpet: false },
    { id: "premium", name: "프리미엄 하우스", wall: "#4a5a8c", wallD: "#35426b", roof: "#2c3557", roofD: "#1f2640", trim: C.gold,   floors: 3, crown: false, carpet: true },
    { id: "empire",  name: "포커 제국",     wall: "#ff9dbb", wallD: "#e06d91", roof: "#d14d78", roofD: "#a83557", trim: C.gold,   floors: 3, crown: true,  carpet: true },
  ];

  // ============================================================
  //  빌더
  // ============================================================
  const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

  function svg(inner, { w, h, vb, size, cls = "", style = "", title = "" } = {}) {
    const width = w != null ? w : size != null ? size : 24;
    const height = h != null ? h : size != null ? size : width;
    const viewBox = vb || "0 0 48 48";
    return (
      `<svg class="ga${cls ? " " + cls : ""}" viewBox="${viewBox}" width="${width}" height="${height}" ` +
      `xmlns="http://www.w3.org/2000/svg" aria-hidden="${title ? "false" : "true"}"${style ? ` style="${style}"` : ""}>` +
      (title ? `<title>${esc(title)}</title>` : "") +
      inner +
      `</svg>`
    );
  }

  /** 아이콘 1개를 SVG 문자열로. name이 없으면 빈 문자열(렌더가 안 깨지게). */
  function icon(name, opts = {}) {
    const key = ICONS[name] ? name : EMOJI_MAP[name];
    const body = ICONS[key];
    if (!body) return "";
    return svg(body, { size: opts.size || 24, cls: `ga-ico ga-ico-${key}${opts.cls ? " " + opts.cls : ""}`, style: opts.style, title: opts.title });
  }

  /** CSS background-image에 넣을 data URI. */
  function dataUri(name, opts = {}) {
    const markup = icon(name, { ...opts, size: opts.size || 48 });
    if (!markup) return "";
    return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(markup);
  }

  /** 등급 배지(N/U/R/SR/SSR/MR 알약). */
  function rarityBadge(rarityId, opts = {}) {
    const r = RARITY[rarityId] || RARITY.common;
    const w = opts.w || 44;
    const h = Math.round(w * 0.5);
    const inner =
      `<rect x="1.5" y="1.5" width="85" height="41" rx="20" fill="${r.a}"/>` +
      `<rect x="1.5" y="1.5" width="85" height="35" rx="18" fill="${r.b}"/>` +
      `<rect x="6" y="5" width="76" height="13" rx="7" fill="${C.white}" opacity="0.32"/>` +
      `<text x="44" y="31" text-anchor="middle" font-family="Jua, 'Gowun Dodum', system-ui, sans-serif" ` +
      `font-size="${r.short.length > 2 ? 20 : 24}" fill="${C.white}" stroke="${r.a}" stroke-width="3" ` +
      `paint-order="stroke" letter-spacing="1">${r.short}</text>`;
    return svg(inner, { w, h, vb: "0 0 88 44", cls: `ga-rarity-badge ga-rarity-${rarityId}`, title: r.name });
  }

  /**
   * 등급 카드 프레임. 초상화(portraits.js)를 안에 얹어 쓰라고 만든 배경/테두리다.
   * opts.portrait: 가운데에 깔 <image> href (data URI도 됨)
   */
  function rarityFrame(rarityId, opts = {}) {
    const r = RARITY[rarityId] || RARITY.common;
    const w = opts.w || 108;
    const h = opts.h || Math.round(w * 1.3);
    const VW = 200;
    const VH = 260;

    // 등급이 높을수록 뒤에서 뻗는 광선이 많아진다 (포스터 SSR 카드의 선버스트)
    let rays = "";
    if (r.rays) {
      const parts = [];
      for (let i = 0; i < r.rays; i++) {
        const a = (360 / r.rays) * i;
        parts.push(`<path d="M100 106 L90 -80 L110 -80 Z" fill="${r.b}" opacity="0.55" transform="rotate(${a} 100 106)"/>`);
      }
      rays = `<g class="ga-rays">${parts.join("")}</g>`;
    }

    const portrait = opts.portrait
      ? `<image href="${esc(opts.portrait)}" x="26" y="26" width="148" height="160" preserveAspectRatio="xMidYMid slice" clip-path="url(#gaClip${rarityId})"/>`
      : `<g opacity="0.35" transform="translate(64 52) scale(1.5)">${ICONS.profile}</g>`;

    const crownTop = rarityId === "legendary" || rarityId === "mythic"
      ? `<g transform="translate(126 4) scale(0.52)">${ICONS.crown}</g>`
      : "";

    const inner =
      `<defs><clipPath id="gaClip${rarityId}"><rect x="26" y="26" width="148" height="160" rx="12"/></clipPath></defs>` +
      // 바깥 테두리(두껍게 → 안쪽 밝게: 셀셰이딩 입체 테두리)
      `<rect x="3" y="3" width="194" height="254" rx="22" fill="${r.a}"/>` +
      `<rect x="3" y="3" width="194" height="248" rx="22" fill="${r.b}"/>` +
      `<rect x="12" y="12" width="176" height="236" rx="16" fill="${r.c}"/>` +
      // 초상화 자리
      `<rect x="20" y="20" width="160" height="172" rx="14" fill="${r.b}"/>` +
      `<rect x="26" y="26" width="148" height="160" rx="12" fill="${C.cream}"/>` +
      `<g clip-path="url(#gaClip${rarityId})">${rays}</g>` +
      portrait +
      `<rect x="26" y="26" width="148" height="160" rx="12" fill="none" stroke="${r.a}" stroke-width="3"/>` +
      // 이름표
      `<rect x="20" y="200" width="160" height="40" rx="12" fill="${C.white}"/>` +
      `<rect x="20" y="200" width="160" height="40" rx="12" fill="${r.b}" opacity="0.28"/>` +
      (opts.name
        ? `<text x="100" y="228" text-anchor="middle" font-family="Jua, 'Gowun Dodum', system-ui, sans-serif" font-size="24" fill="${C.ink}">${esc(opts.name)}</text>`
        : "") +
      // 좌상단 등급 배지
      `<g transform="translate(14 14) scale(0.62)"><rect x="0" y="0" width="88" height="44" rx="20" fill="${r.a}"/>` +
      `<rect x="0" y="0" width="88" height="38" rx="18" fill="${r.b}"/>` +
      `<rect x="5" y="4" width="78" height="13" rx="7" fill="${C.white}" opacity="0.32"/>` +
      `<text x="44" y="31" text-anchor="middle" font-family="Jua, 'Gowun Dodum', system-ui, sans-serif" font-size="${r.short.length > 2 ? 21 : 26}" fill="${C.white}">${r.short}</text></g>` +
      `<rect x="3" y="3" width="194" height="254" rx="22" fill="none" stroke="${C.ink}" stroke-width="4"/>` +
      crownTop;

    return svg(inner, { w, h, vb: `0 0 ${VW} ${VH}`, cls: `ga-frame ga-frame-${rarityId}`, title: `${r.name} 카드` });
  }

  /** 대회 트로피. tierId = local | city | national | asia | world */
  function trophy(tierId, opts = {}) {
    const t = TROPHY_TIERS[tierId] || TROPHY_TIERS.local;
    const size = opts.size || 72;

    const wings = t.wings
      ? `<path d="M22 44c-9-5-16-4-20 2 5 1 8 3 9 6 5-3 8-5 11-8Z" ${F(C.goldL)}/>` +
        `<path d="M78 44c9-5 16-4 20 2-5 1-8 3-9 6-5-3-8-5-11-8Z" ${F(C.goldL)}/>`
      : "";

    const ribbon = t.ribbon
      ? `<path d="M36 78 24 104l13-4 7 11 6-24Z" ${F(t.ribbon)}/>` +
        `<path d="M64 78 76 104l-13-4-7 11-6-24Z" ${F(t.ribbon)}/>`
      : "";

    const gems = [];
    for (let i = 0; i < t.gems; i++) {
      const x = 50 + (i - (t.gems - 1) / 2) * 13;
      gems.push(`<circle cx="${x}" cy="52" r="4.6" ${F(i % 2 ? C.cyan : C.pinkD)}/>`);
    }

    const star = t.star
      ? `<path d="M50 6l4.4 9 9.9 1.4-7.2 7 1.7 9.8-8.8-4.7-8.8 4.7 1.7-9.8-7.2-7 9.9-1.4Z" ${F(C.goldL)}/>`
      : "";

    const inner =
      wings +
      star +
      // 컵 몸통
      `<path d="M28 ${t.star ? 32 : 24}h44v22a22 22 0 0 1-44 0Z" ${F(t.metal)}/>` +
      `<path d="M28 ${t.star ? 32 : 24}h14v22a22 22 0 0 0 5 12 22 22 0 0 1-19-12Z" ${P(t.metalL, 0.75)}/>` +
      `<path d="M28 ${t.star ? 32 : 24}h44v22a22 22 0 0 1-44 0Z" fill="none" stroke="${C.ink}" stroke-width="4" stroke-linejoin="round"/>` +
      // 손잡이
      `<path d="M28 ${t.star ? 36 : 28}h-9a10 10 0 0 0 10 15M72 ${t.star ? 36 : 28}h9a10 10 0 0 1-10 15" fill="none" stroke="${C.ink}" stroke-width="4" stroke-linecap="round"/>` +
      gems.join("") +
      ribbon +
      // 기둥 + 받침
      `<path d="M44 76h12v9H44Z" ${F(t.metalD)}/>` +
      `<path d="M34 96h32l-4-11H38Z" ${F(t.metal)}/>` +
      `<rect x="28" y="96" width="44" height="9" rx="4" ${F(t.metalD)}/>` +
      `<rect x="28" y="96" width="44" height="9" rx="4" fill="none" stroke="${C.ink}" stroke-width="4"/>`;

    return svg(inner, { w: size, h: size, vb: "0 0 100 112", cls: `ga-trophy ga-trophy-${tierId}`, title: t.name });
  }

  /** 프레스티지 건물. tier = 0..3 (로컬 펍 → 포커 제국) */
  function building(tier, opts = {}) {
    const b = BUILDINGS[Math.max(0, Math.min(BUILDINGS.length - 1, tier | 0))];
    const size = opts.size || 120;
    const floors = b.floors;
    const bodyH = 26 + floors * 16; // 층수만큼 높아진다
    const topY = 96 - bodyH;

    // 아이소메트릭 간이 표현: 정면 + 오른쪽 면(어두운 색) + 지붕 마름모
    const win = [];
    for (let f = 0; f < floors; f++) {
      const y = topY + 12 + f * 16;
      for (let i = 0; i < 3; i++) {
        win.push(`<rect x="${26 + i * 15}" y="${y}" width="10" height="10" rx="2.4" ${F(C.goldL)}/>`);
      }
      win.push(`<rect x="${74}" y="${y + 4}" width="8" height="10" rx="2.2" ${F(C.goldD)} opacity="0.9"/>`);
    }

    const crown = b.crown
      ? `<g transform="translate(36 ${topY - 30}) scale(0.58)">${ICONS.crown}</g>`
      : "";

    const carpet = b.carpet
      ? `<path d="M40 96h20l7 14H33Z" ${F(C.redD)}/><path d="M42 96h16l5 14H37Z" ${F("#e0484e")}/>`
      : "";

    const inner =
      // 그림자
      `<ellipse cx="55" cy="112" rx="42" ry="7" ${P(C.ink, 0.13)}/>` +
      carpet +
      // 오른쪽 측면
      `<path d="M72 ${topY + 6} 92 ${topY + 16}v${bodyH - 16}l-20 10Z" ${F(b.wallD)}/>` +
      // 정면
      `<rect x="20" y="${topY + 6}" width="52" height="${bodyH}" rx="2" ${F(b.wall)}/>` +
      // 지붕
      `<path d="M20 ${topY + 6} 46 ${topY - 6} 92 ${topY + 16} 72 ${topY + 6}Z" ${F(b.roof)}/>` +
      `<path d="M46 ${topY - 6} 92 ${topY + 16} 72 ${topY + 6}Z" ${F(b.roofD)}/>` +
      // 간판
      `<rect x="26" y="${topY + 12}" width="40" height="11" rx="4" ${F(b.trim)}/>` +
      `<rect x="30" y="${topY + 15}" width="${b.crown ? 32 : 24}" height="5" rx="2.5" ${P(C.ink, 0.22)}/>` +
      win.join("") +
      // 문
      `<rect x="40" y="76" width="20" height="20" rx="3" ${F(C.woodD)}/>` +
      `<rect x="43" y="79" width="14" height="17" rx="2.4" ${F(b.trim)} opacity="0.55"/>` +
      `<circle cx="55" cy="87" r="1.8" ${P(C.gold)}/>` +
      crown;

    return svg(inner, { w: size, h: Math.round(size * 1.05), vb: "0 0 110 120", cls: `ga-building ga-building-${b.id}`, title: `${b.name} (Lv.${tier + 1})` });
  }

  /**
   * 로고 워드마크. Jua 웹폰트(index.html에서 이미 불러옴)로 두툼한 글자를 만들고
   * 어두운 외곽선 → 골드 면 → 위쪽 하이라이트 3겹으로 포스터의 입체 골드 레터링을 흉내낸다.
   */
  function logo(opts = {}) {
    const w = opts.w || 320;
    const h = Math.round(w * 0.42);
    const sub = opts.sub !== false;
    const FF = `font-family="Jua, 'Gowun Dodum', system-ui, sans-serif"`;

    const word = (text, y, fs) =>
      // 1) 뒤에 깔리는 짙은 그림자
      `<text x="200" y="${y + 5}" text-anchor="middle" ${FF} font-size="${fs}" fill="${C.pinkDD}" stroke="${C.pinkDD}" stroke-width="13" paint-order="stroke" letter-spacing="1">${esc(text)}</text>` +
      // 2) 핑크 외곽선
      `<text x="200" y="${y}" text-anchor="middle" ${FF} font-size="${fs}" fill="${C.goldDD}" stroke="${C.pinkD}" stroke-width="11" paint-order="stroke" letter-spacing="1">${esc(text)}</text>` +
      // 3) 골드 면
      `<text x="200" y="${y}" text-anchor="middle" ${FF} font-size="${fs}" fill="${C.gold}" stroke="${C.goldDD}" stroke-width="3" paint-order="stroke" letter-spacing="1">${esc(text)}</text>` +
      // 4) 위쪽 하이라이트 (클립으로 윗절반만)
      `<g clip-path="url(#gaLogoTop${Math.round(y)})"><text x="200" y="${y}" text-anchor="middle" ${FF} font-size="${fs}" fill="${C.goldL}" letter-spacing="1">${esc(text)}</text></g>`;

    const inner =
      `<defs>` +
      `<clipPath id="gaLogoTop52"><rect x="0" y="0" width="400" height="40"/></clipPath>` +
      `<clipPath id="gaLogoTop104"><rect x="0" y="52" width="400" height="40"/></clipPath>` +
      `</defs>` +
      // 뒤 장식: 카드 2장 + 칩
      `<g transform="translate(300 6) rotate(16)"><rect x="0" y="0" width="34" height="46" rx="5" ${F(C.cream)}/>` +
      `<path d="M17 10c5 5 8 7 8 10.5a4 4 0 0 1-8 2 4 4 0 0 1-8-2C9 17 12 15 17 10Z" ${F(C.pinkD)}/></g>` +
      `<g transform="translate(66 10) rotate(-18)"><rect x="0" y="0" width="34" height="46" rx="5" ${F(C.cream)}/>` +
      `<path d="M17 10c5 5 8 7 8 10.5a4 4 0 0 1-8 2 4 4 0 0 1-8-2C9 17 12 15 17 10Z" ${F(C.ink)}/></g>` +
      `<g transform="translate(160 -22) scale(1.7)">${ICONS.crown}</g>` +
      word("HOLDEM", 52, 46) +
      word("PUB TYCOON", 104, 46) +
      (sub
        ? `<rect x="88" y="120" width="224" height="30" rx="15" ${F(C.pinkD)}/>` +
          `<text x="200" y="141" text-anchor="middle" ${FF} font-size="17" fill="${C.cream}">한 테이블에서 포커 제국까지</text>`
        : "");

    return svg(inner, { w, h, vb: "0 0 400 168", cls: "ga-logo", title: "HOLDEM PUB TYCOON" });
  }

  /** 앱 아이콘 (라운드 스퀘어). 파비콘/PWA 아이콘 겸용. */
  function appIcon(opts = {}) {
    const size = opts.size || 192;
    const inner =
      `<rect width="192" height="192" rx="42" fill="${C.pinkD}"/>` +
      `<rect width="192" height="150" rx="42" fill="${C.pink}"/>` +
      `<circle cx="96" cy="150" r="120" fill="${C.pinkL}" opacity="0.35"/>` +
      `<g transform="translate(112 34) rotate(18)"><rect x="0" y="0" width="46" height="62" rx="7" ${F(C.cream)}/></g>` +
      `<g transform="translate(34 34) rotate(-18)"><rect x="0" y="0" width="46" height="62" rx="7" ${F(C.cream)}/></g>` +
      `<g transform="translate(48 60) scale(2)">${ICONS.bb}</g>` +
      `<g transform="translate(60 -6) scale(1.5)">${ICONS.crown}</g>`;
    return svg(inner, { w: size, h: size, vb: "0 0 192 192", cls: "ga-appicon", title: "홀덤펍 키우기" });
  }

  return {
    C,
    icons: () => Object.keys(ICONS),
    labels: LABELS,
    rarities: RARITY,
    trophyTiers: TROPHY_TIERS,
    buildings: BUILDINGS,
    icon,
    dataUri,
    rarityBadge,
    rarityFrame,
    trophy,
    building,
    logo,
    appIcon,
  };
})();

if (typeof window !== "undefined") window.GameAssets = GameAssets;
