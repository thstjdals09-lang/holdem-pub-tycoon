// 도트 에셋 스케일 기준표.
//
// 문제: 스타일 앵커를 레퍼런스로 물려도 생성 모델은 오브젝트마다 카메라 거리를 다르게 잡는다.
// 프리미엄 의자가 테이블만큼 커져서 나오는 식이다. 프롬프트로는 안 잡힌다.
// → 에셋마다 "화면에서 차지해야 할 최대 변(px)"을 여기서 정하고, 인제스트 때 리사이즈한다.
//
// 기준 격자: 아이소 타일 64×32.
//   - 2×2칸이 화면에서 차지하는 폭은 4 × (TW/2) = 128px 다(오른쪽 끝과 왼쪽 끝의 x 차이).
//     여기에 "여유"를 붙여 150으로 뒀더니 테이블끼리 겹치고 의자가 상판 위로 올라갔다.
//     발자국 폭을 넘기면 안 된다 — 넘기는 순간 격자 배치가 의미를 잃는다.
//   - 6인 포커 테이블 = 2×2칸 → 122 (128보다 살짝 작아야 의자 다리가 보인다)
//   - 8인 테이블은 원래 3×3이지만 배치는 2×2 + 여유로 하므로 152에서 끊는다
//   - 캐릭터 키 ≈ 60 (2.5~3등신, 테이블 옆에 섰을 때 자연스러운 크기)
//   - 의자 ≈ 56 (캐릭터가 앉을 수 있어 보이는 크기)
//   - 바 카운터 상판이 캐릭터 허리~가슴 → 높이 40 안팎, 길이는 칸 수만큼
//
// 숫자를 바꾸면 그 에셋만 다시 처리하면 된다(원본은 assets/pixel/raw에 그대로 있다).

const SIZES = {
  // ---- core_poker ----
  "01_table_basic_6player": 122,
  "02_table_standard_6player": 122,
  "03_table_premium_6player": 122,
  "04_table_basic_8player": 152,
  "05_table_premium_8player": 152,
  "06_table_tournament": 140,
  "07_table_final_table": 148,
  "08_dealer_chair": 56,
  "09_player_chair_basic": 52,
  "10_player_chair_premium": 58,
  "11_chip_tray": 46,
  "12_chip_stack_small": 16,
  "13_chip_stack_medium": 22,
  "14_chip_stack_large": 28,
  "15_card_deck": 20,
  "16_dealer_button": 12,
  "17_card_shuffler": 36,
  "18_poker_supply_cart": 64,

  // ---- bar_food ----
  "19_bar_counter_small": 130,
  "20_bar_counter_medium": 172,
  "21_bar_counter_large": 214,
  "22_back_bar_shelf": 140,
  "23_bar_stool_basic": 44,
  "24_bar_stool_premium": 48,
  "25_drink_fridge": 72,
  "26_bottle_display": 64,
  "27_coffee_machine": 40,
  "28_snack_counter": 110,
  "29_food_service_cart": 62,
  "30_drink_tray": 30,
  "31_food_plate": 22,

  // ---- architecture ----
  "32_wall_module_plain": 84,
  "33_wall_module_window": 84,
  "34_wall_module_decorative": 84,
  "35_corner_wall_module": 84,
  "36_entrance_basic": 120,
  "37_entrance_premium": 140,
  "38_double_door": 96,
  "39_interior_door": 76,
  "40_floor_tile_basic": 64,
  "41_floor_tile_premium": 64,
  "42_floor_border": 64,
  "43_small_stair": 80,
  "44_partition_wall": 80,
  "45_roof_edge_module": 96,

  // ---- lighting ----
  "46_ceiling_light_basic": 44,
  "47_chandelier_small": 58,
  "48_chandelier_large": 82,
  "49_wall_lamp": 32,
  "50_floor_lamp": 66,
  "51_table_lamp": 28,
  "52_lantern_hanging": 40,
  "53_lantern_floor": 52,
  "54_entrance_light": 36,

  // ---- decorations ----
  "55_potted_plant_small": 40,
  "56_potted_plant_large": 74,
  "57_flower_arrangement_small": 30,
  "58_flower_arrangement_large": 56,
  "59_wall_frame_small": 34,
  "60_wall_frame_large": 56,
  "61_blank_sign_small": 44,
  "62_blank_sign_large": 86,
  "63_poker_wall_art": 48,
  "64_trophy_case": 90,
  "65_trophy_small": 26,
  "66_trophy_large": 44,
  "67_display_cabinet": 88,
  "68_small_statue": 42,
  "69_large_statue": 76,
  "70_side_table": 44,
  "71_sofa_small": 96,
  "72_sofa_large": 130,
  "73_lounge_chair": 58,
  "74_coat_rack": 62,
  "75_trash_bin": 30,

  // ---- 캐릭터 (staff / customers) : 전부 같은 키 ----
  __character: 60,
  // ---- 이모트 ----
  __emote: 26,

  // ---- exterior ----
  "115_exterior_sign": 96,
  "116_sidewalk_tile": 64,
  "117_street_lamp": 78,
  "118_outdoor_planter": 46,
  "119_fence_module": 64,
  "120_gate_module": 72,
  "121_tree_small": 84,
  "122_tree_large": 130,
  "123_flower_bed": 52,
  "124_outdoor_bench": 66,
  "125_expansion_marker": 56,

  // ---- tournament ----
  "173_tournament_registration_desk": 110,
  "174_tournament_feature_table": 148,
  "175_final_table_premium": 152,
  "176_tournament_rope_barrier": 60,
  "177_tournament_trophy_small": 30,
  "178_tournament_trophy_large": 50,
  "179_championship_trophy": 62,
  "180_winner_podium": 74,
  "181_tournament_banner_blank": 92,
  "182_photo_wall_blank": 110,

  // ---- props (작은 소품) ----
  __prop: 24,

  // ---- env_v1 : Master Actor System v1 스케일 전용 환경 에셋 ----
  //
  // 타일 64×32 기준이다. 한때 96×48로 올렸다가 되돌렸다 —
  // 그 크기에서는 테이블 4개를 놓으려면 방이 768px이 되어 640 화면에서 128px이 잘렸다.
  // 액터는 64×96 원본을 월드에서 50%로 찍는다(정확한 2:1 축소라 도트가 안 뭉개진다).
  // 그러면 액터가 화면에서 40px, 테이블 128px → 비율 3.2:1 로 레퍼런스(3.7)에 붙는다.
  // 발자국 폭:
  //   2×2칸 = 4 × (96/2) = 192px,  3×3칸 = 288px,  1칸 = 96px.
  //
  // 테이블 크기는 발자국 칸수로 잡는다. 한때 레퍼런스의 비율(테이블:액터 = 3.7~4.1)에
  // 맞춰 288로 키웠다가 되돌렸다 — 그 비율은 레퍼런스의 캐릭터가 격자 대비 작아서
  // 성립하는 것이고, 액터 키 88px에서 테이블을 288로 하면 640 폭에 두 개밖에 안 들어간다.
  // 2×2(192)여야 가로 240 간격으로 두 개씩, 여러 줄을 깔 수 있다.
  //   테이블 중심 간격 Δgx=5 → 화면 x 240px, 테이블 192 → 48px 여유.
  //   앞뒤 줄은 Δgy=4 → 화면 y 96px, 테이블 높이 ~150 → 앞줄이 뒷줄을 조금 가린다(정상).
  // 의자는 "앉은 액터보다 등받이가 높게" 잡는다. 시트 액터는 앉은 포즈도 80px라
  // 의자를 78로 두면 사람이 의자를 통째로 가려 버리고, 104면 의자가 옥좌처럼 커진다. 86이 어깨 높이다.
  "201_table_6seat": 128,
  "202_table_8seat": 160,
  "203_chair": 57,
  "204_chair_premium": 60,
  "205_bar_counter": 192,
  "206_back_bar_shelf": 160,
  "207_bar_stool": 47,
  "208_rug_round": 155,
  "209_rug_runner": 140,
  "210_wall_panel": 93,
  "211_wall_lamp": 37,
  "212_pendant_lamp": 64,

  // env_v1 2차 — 환경 아트 패스.
  // 레퍼런스의 정보량은 "가구 몇 개"가 아니라 벽면·구석·입구를 빈틈없이 채우는 소품 수에서 나온다.
  // 크기는 전부 액터 키 80px 기준이다: 큰 화분은 사람보다 두 배(164),
  // 큰 액자는 사람 상반신만 하고(112), 벽시계·작은 액자는 머리통만 하다(58~66).
  "213_drink_fridge": 100,
  "214_plant_tall": 75,
  "215_plant_small": 47,
  "216_plant_hanging": 39,
  "217_framed_art_large": 59,
  "218_framed_art_small": 44,
  "219_dartboard": 53,
  "220_wall_clock": 39,
  "221_hanging_lantern": 61,
  "222_sign_wood_slat": 67,
  "223_sign_bulb_frame": 83,
  "224_neon_beer": 69,
  "225_chalkboard_spade": 68,
  "226_entrance_marquee": 133,
  "227_entrance_door": 103,
  "228_sandwich_board": 69,
  "229_street_lamp": 100,
  "230_lounge_sofa": 93,
  "231_lounge_table_round": 75,
  "232_service_cart": 83,
  "233_safe_cabinet": 81,
  "234_trophy_stand": 83,
  "235_coat_rack": 88,
  "236_beer_tap_station": 63,

  // ---- env_k : 카이로소프트형 타일 32×16 전용 ----
  //
  // env_v1(타일 64)과 계열이 다르다. 여기서는 오브젝트가 작고 단순한 대신 개수가 3~4배 많다.
  //   2×2칸 = 4 × (32/2) = 64px,  3×3칸 = 96px,  1칸 = 32px.
  // 액터는 64×96 원본을 1/3로 구운 21×32(assets/actors_world)를 쓴다.
  // 테이블 96 : 액터 27 = 3.5 : 1 로 레퍼런스(3.7)에 맞춘다.
  "301_table": 64,
  "302_chair": 20,
  // 이 둘은 maxSide(가로)만으로는 안 맞는다. 생성기가 박스를 사람보다 높게 그려서,
  // 받은 뒤 tools/shorten-iso-box.mjs 로 수직면 행을 잘라 키를 낮춰 쓴다(바닥 크기는 그대로).
  //   303: 89 → 76 (13행), 304: 72 → 50 (22행). 다시 뽑으면 이 작업을 또 해야 한다.
  "303_bar_counter": 96,
  "304_back_bar": 72,
  "305_stool": 20,
  "306_fridge": 44,
  "307_plant_big": 40,
  "308_plant_small": 26,
  "309_rug": 72,
  "310_wall_art": 22,
  "311_sign": 40,
  "312_lamp": 24,
  "313_tree": 56,
  "314_fence": 36,
  "315_street_lamp": 56,
  "316_bush": 28,
  "317_bench": 40,
  "318_entrance_door": 72,
  "319_sandwich_board": 30,
  "320_flower_bed": 34,
  // 목표 이미지(zeval.png)에 있는데 우리에게 없던 것 — Higgsfield로 같은 시점·톤으로 추가 생성
  "321_entrance_doors": 78,
  "322_planter_box": 40,
  "323_booth_sofa": 62,
};

// 테마 변형은 원본과 같은 점유 면적을 써야 하므로 대응하는 기본 에셋의 크기를 따라간다.
const THEME_ALIAS = {
  table_6player: "01_table_basic_6player",
  table_8player: "04_table_basic_8player",
  bar_counter: "20_bar_counter_medium",
  bar_stool: "23_bar_stool_basic",
  player_chair: "09_player_chair_basic",
  wall_module: "32_wall_module_plain",
  floor_tile: "40_floor_tile_basic",
  entrance: "36_entrance_basic",
  chandelier: "48_chandelier_large",
  wall_lamp: "49_wall_lamp",
  sofa: "71_sofa_small",
  flower_arrangement: "58_flower_arrangement_large",
  statue: "68_small_statue",
  blank_sign: "62_blank_sign_large",
  trophy_case: "64_trophy_case",
  hanging_lantern: "52_lantern_hanging",
  floor_lantern: "53_lantern_floor",
  partition: "44_partition_wall",
  bamboo_plant: "56_potted_plant_large",
  cherry_blossom_decor: "56_potted_plant_large",
  garden_lantern: "53_lantern_floor",
  small_pond: "123_flower_bed",
  noren: "62_blank_sign_large",
  potted_plant: "55_potted_plant_small",
  poker_wall_art: "63_poker_wall_art",
  bottle_shelf: "22_back_bar_shelf",
  lounge_table: "70_side_table",
};

// 파일명 → 폴더
function folderOf(base) {
  const n = Number(base.split("_")[0]);
  if (base.startsWith("princess_") || /^1(2[6-9]|3[0-9]|40)_/.test(base)) return "theme_princess";
  if (base.startsWith("japanese_") || /^1(4[1-9]|5[0-7])_/.test(base)) return "theme_japanese";
  if (base.startsWith("classic_") || /^1(5[89]|6[0-9]|7[0-2])_/.test(base)) return "theme_classic";
  if (n >= 1 && n <= 18) return "core_poker";
  if (n >= 19 && n <= 31) return "bar_food";
  if (n >= 32 && n <= 45) return "architecture";
  if (n >= 46 && n <= 54) return "lighting";
  if (n >= 55 && n <= 75) return "decorations";
  if (n >= 76 && n <= 86) return "staff";
  if (n >= 87 && n <= 104) return "customers";
  if (n >= 105 && n <= 114) return "emotes";
  if (n >= 115 && n <= 125) return "exterior";
  if (n >= 173 && n <= 182) return "tournament";
  if (n >= 183 && n <= 200) return "props";
  if (n >= 201 && n <= 240) return "env_v1";   // 타일 64 계열
  if (n >= 301 && n <= 340) return "env_k";    // 타일 32 계열(카이로소프트형)
  return "misc";
}

/** 파일명(확장자 제외) → { folder, maxSide } */
export function specFor(base) {
  const folder = folderOf(base);
  let maxSide = SIZES[base];
  if (maxSide == null) {
    if (folder === "staff" || folder === "customers") maxSide = SIZES.__character;
    else if (folder === "emotes") maxSide = SIZES.__emote;
    else if (folder === "props") maxSide = SIZES.__prop;
    else {
      // 테마 변형: 126_princess_table_6player → table_6player 로 매칭
      const key = Object.keys(THEME_ALIAS).find((k) => base.endsWith(k));
      maxSide = key ? SIZES[THEME_ALIAS[key]] : 64;
    }
  }
  return { folder, maxSide };
}

export default { specFor };
