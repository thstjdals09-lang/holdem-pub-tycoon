// pack-spec — 에셋 크기 기준표. 이 파일 하나가 모든 에셋의 크기를 정한다.
//
// 지금까지의 문제: 에셋마다 "긴 변 몇 px"로 크기를 줬다. 그러면 가구가 몇 칸을
// 차지하는지와 그림 크기가 따로 놀아서, 배치할 때 겹치거나 뜨거나 한다.
// 그래서 기준을 바꾼다 — **가구는 바닥 발자국(칸 수)으로, 사람은 키(px)로** 정한다.
//
//   타일 32×16 (화면에는 ×2)
//   발자국 gw×gd 인 물건의 화면 폭 = (gw + gd) × 16
//   즉 2×2칸 = 64px, 3×1칸 = 64px, 1×1칸 = 32px
//
// 이 규칙을 지키면 배치 좌표만 맞으면 그림이 저절로 맞는다. 사람 키는 28px
// (2등신, 타일 높이 16의 1.75배)로 고정하고, 앉은 포즈는 그 0.72배.

export const TILE = { w: 32, h: 16 };
export const ACTOR = { stand: 28, sit: 20 };

/** 가구: [발자국 가로칸, 발자국 세로칸]. 화면 폭 = (gw+gd)*16 로 굽는다. */
export const PROPS = {
  // ── 홀 ──
  table_6:      [2.0, 2.0],   // 6인 포커 테이블 — 64px, 사람 28의 2.3배
  table_8:      [2.6, 2.0],   // 8인 — 74px
  chair:        [0.7, 0.7],   // 22px
  dealer_chair: [0.8, 0.8],   // 26px
  stool:        [0.55, 0.55], // 18px
  sofa:         [2.2, 0.9],   // 50px
  armchair:     [1.0, 0.9],   // 30px
  lounge_table: [0.9, 0.9],   // 29px
  rug_rect:     [3.0, 2.4],   // 86px — 테이블 한 대를 덮는다
  rug_round:    [2.6, 2.6],   // 83px
  side_table:   [0.7, 0.7],
  partition:    [1.8, 0.3],   // 칸막이 — 얇고 길다
  // ── 바 ──
  bar_straight: [2.0, 0.8],   // 45px — 이어 붙이는 모듈
  bar_corner:   [1.4, 1.4],
  back_bar:     [1.6, 0.5],
  beer_tap:     [0.5, 0.4],
  fridge:       [0.8, 0.7],
  sink:         [0.8, 0.7],
  cart:         [0.9, 0.7],
  coffee:       [0.6, 0.5],
  bottle_cabinet: [1.1, 0.5],
  tray:         [0.6, 0.5],
  snack:        [0.45, 0.4],
  safe:         [0.7, 0.6],
  // ── 장식 (벽에 거는 것은 발자국이 없으니 폭을 직접 준다) ──
  pendant:      [0.7, 0.7],
  chandelier:   [1.1, 1.1],
  sconce:       [0.5, 0.3],
  art_large:    [1.0, 0.0],   // gd=0 → 폭 = gw*16, 벽면 전용
  art_small:    [0.6, 0.0],
  menu_board:   [0.9, 0.0],
  neon:         [1.0, 0.0],
  dartboard:    [0.7, 0.0],
  jukebox:      [0.9, 0.7],
  clock:        [0.5, 0.0],
  trophy_case:  [1.2, 0.6],
  palm:         [1.0, 1.0],
  // ── 입구·바깥 ──
  door:         [1.6, 0.4],
  board:        [0.7, 0.6],
  stanchion:    [0.8, 0.4],
  coat_rack:    [0.7, 0.7],
  host_desk:    [1.8, 0.8],
  street_lamp:  [0.6, 0.6],
  tree:         [1.6, 1.6],
  bush:         [0.8, 0.8],
  bench:        [1.4, 0.6],
  flower_bed:   [1.3, 0.7],
  trash_bin:    [0.6, 0.6],
  taxi:         [2.6, 1.2],
};

/** 화면 폭(px). 벽에 거는 것(gd=0)은 gw만 본다. */
export function widthOf(name) {
  const f = PROPS[name];
  if (!f) return null;
  return Math.max(8, Math.round((f[0] + f[1]) * (TILE.w / 2)));
}


/** 높이 상한(px). 발자국 폭으로만 맞추면 세로로 긴 그림이 사람보다 커진다.
 *  사람 키 28 기준의 현실적인 높이 — 의자 등받이는 사람 어깨 아래, 나무는 사람 두 배 같은 식. */
export const HMAX = {
  chair: 17, dealer_chair: 21, stool: 14, sofa: 30, armchair: 27, lounge_table: 22, side_table: 20,
  partition: 34, rug_rect: 40, rug_round: 40,
  bar_straight: 34, bar_corner: 34, back_bar: 34, beer_tap: 20, fridge: 30, sink: 24,
  cart: 26, coffee: 20, bottle_cabinet: 34, tray: 14, snack: 12, safe: 22,
  pendant: 20, chandelier: 28, sconce: 14, jukebox: 30, trophy_case: 32, palm: 40,
  door: 40, board: 22, stanchion: 20, coat_rack: 30, host_desk: 30,
  street_lamp: 44, tree: 48, bush: 16, bench: 22, flower_bed: 16, trash_bin: 18, taxi: 34,
};

/** 캐릭터 24칸 — 시트 읽는 순서 그대로.
 *  걷기는 4프레임 사이클(접지-통과내림-접지-통과올림)을 앞/뒤 두 방향으로 들고 있다.
 *  아이소 4방향은 이 둘을 좌우반전해서 만든다:
 *    남동(오른쪽 아래) = 앞모습 원본 / 남서(왼쪽 아래) = 앞모습 반전
 *    북서(왼쪽 위)   = 뒷모습 원본 / 북동(오른쪽 위)  = 뒷모습 반전
 */
export const CAST = [
  ["a_walk_f1", "stand"], ["a_walk_f2", "stand"], ["a_walk_f3", "stand"], ["a_walk_f4", "stand"],
  ["a_walk_b1", "stand"], ["a_walk_b2", "stand"], ["a_walk_b3", "stand"], ["a_walk_b4", "stand"],
  ["a_stand_f", "stand"], ["a_sit_f", "sit"], ["a_stand_b", "stand"], ["a_sit_b", "sit"],
  ["b_stand_f", "stand"], ["b_sit_f", "sit"], ["b_stand_b", "stand"], ["b_sit_b", "sit"],
  ["c_stand_f", "stand"], ["c_sit_f", "sit"], ["c_stand_b", "stand"], ["c_sit_b", "sit"],
  ["pd_stand", "stand"], ["pd_deal", "stand"], ["sv_stand", "stand"], ["sv_tray", "stand"],
];

export const THEMES = ["classic", "princess", "neon", "european", "japanese"];
