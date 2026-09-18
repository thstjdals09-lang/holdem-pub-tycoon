// Master Actor System v1 — 규격서.
//
// 승인된 액터 시트(2026-09-18)를 그대로 옮긴 것이다. 여기 적힌 값은 고치지 않는다.
// 스프라이트를 추가하려면 이 표에 행을 더하고, 프롬프트는 DESC를 그대로 쓴다.
//
// 캔버스   64 × 96 (모든 에셋 동일)
// 앵커     바닥 중앙 — 발끝이 캔버스 하단에서 2px 위. 이걸 맞춰야 월드에서
//          키가 제각각으로 튀지 않고, blit(cx, groundY) 한 줄로 배치가 끝난다.
// 파일명   <category>_<action>.png   (예: mc_standing.png, pd_dealing_cards.png)
// 폴더     assets/actors/<category_full>/
//
// 의상은 시트에 확정돼 있다. 재생성할 때 이 문장을 그대로 쓰지 않으면 스타일이 흐른다.
export const CANVAS = { w: 64, h: 96, footMargin: 2 };

export const CATEGORIES = {
  mc: {
    folder: "male_customer",
    label: "MALE CUSTOMER",
    look:
      "adult male pub customer, warm brown corduroy jacket over a cream shirt, " +
      "dark navy jeans, brown shoes, short tousled brown hair, light skin",
  },
  fc: {
    folder: "female_customer",
    label: "FEMALE CUSTOMER",
    look:
      "adult female pub customer, deep red knit top under a brown jacket, " +
      "brown skirt, dark tights, shoulder-length wavy auburn hair, light skin",
  },
  pd: {
    folder: "poker_dealer",
    label: "POKER DEALER",
    look:
      "poker dealer, crisp white dress shirt with rolled sleeves, black waistcoat, " +
      "black bow tie, black trousers, short dark brown hair, light skin",
  },
  sv: {
    folder: "server",
    label: "SERVER",
    look:
      "pub server, white shirt, black waistcoat, long white apron tied at the waist, " +
      "black trousers, brown hair tied back, light skin",
  },
};

/** action → 시트의 라벨 + 그 포즈를 설명하는 한 문장 */
export const ACTIONS = {
  standing: ["STANDING", "standing upright and relaxed, arms at the sides, facing the viewer"],
  walking_1: ["WALKING 1", "walking, left leg forward mid-stride, arms swinging slightly"],
  walking_2: ["WALKING 2", "walking, right leg forward mid-stride, arms swinging the other way"],
  seated: ["SEATED", "seated upright on an invisible chair, knees bent toward the viewer, both feet on the ground"],
  back_view: ["BACK VIEW", "seen strictly from behind, back of the head only, no face visible"],
  checking_cards: ["CHECKING CARDS", "holding two playing cards up close to the chest and peeking at them"],
  placing_chips: ["PLACING CHIPS", "leaning slightly forward, one hand pushing a small stack of poker chips away"],
  watching_table: ["WATCHING TABLE", "standing with arms crossed, head tilted, watching the table"],
  happy_reaction: ["HAPPY REACTION", "grinning with one arm raised holding a full beer mug in celebration"],
  waiting_idle: ["WAITING / IDLE", "standing idle with hands clasped in front, patient expression"],

  dealing_cards: ["DEALING CARDS", "mid-deal, one arm extended forward flicking a card across the table"],
  handling_chips: ["HANDLING CHIPS", "both hands over a stack of poker chips, sorting them"],
  presenting_action: ["PRESENTING ACTION", "one open palm extended forward presenting the table to a player"],
  classic_deal: ["CLASSIC DEAL (ALL PLAYERS)", "standing behind a row of five face-up community cards laid out in front"],
  collecting_pots: ["COLLECTING POTS", "both arms sweeping a pile of chips toward the chest"],
  shuffling_cards: ["SHUFFLING CARDS", "riffle shuffling a deck between both hands at chest height"],

  walking_with_tray_1: ["WALKING WITH TRAY 1", "walking with a round tray of beer mugs held on one raised hand, left leg forward"],
  walking_with_tray_2: ["WALKING WITH TRAY 2", "walking with a round tray of beer mugs held on one raised hand, right leg forward"],
  carrying_tray: ["CARRYING TRAY", "standing, holding a round tray of three beer mugs level with both hands"],
  serving_drink: ["SERVING DRINK", "leaning forward, setting a single beer mug down with one hand"],
  taking_order: ["TAKING ORDER", "standing, small notepad in one hand and pencil in the other, looking down at it"],
};

// 포즈별 높이 계수.
//
// 생성 모델은 스프라이트마다 프레임 안 크기를 제멋대로 잡는다. 그래서 카테고리 하나의
// standing 배율을 전체에 그대로 곱하면, 원본이 작게 잡힌 포즈만 혼자 작아진다(실제로 그랬다).
// 대신 스프라이트마다 자기 높이를 88 × 계수로 맞춘다. 계수는 "그 포즈가 선 키 대비 몇인가"다.
//   앉은 자세는 0.78, 팔을 든 자세는 머리 위로 더 솟으니 1.12.
// 손님의 back_view는 시트에서 앉은 뒷모습이고, 딜러·서버의 back_view는 서 있는 뒷모습이다.
export const HEIGHT_FACTOR = {
  seated: 0.78,
  checking_cards: 0.78,
  placing_chips: 0.86,
  happy_reaction: 1.12,
  classic_deal: 1.06,
  collecting_pots: 0.94,
};
export const BACK_VIEW_FACTOR = { mc: 0.78, fc: 0.78, pd: 1.0, sv: 1.0 };

export function heightFactor(cat, action) {
  if (action === "back_view") return BACK_VIEW_FACTOR[cat] ?? 1.0;
  return HEIGHT_FACTOR[action] ?? 1.0;
}

/** 카테고리별 액션 목록 — 시트의 행 순서 그대로 */
export const SHEET = {
  mc: ["standing", "walking_1", "walking_2", "seated", "back_view",
       "checking_cards", "placing_chips", "watching_table", "happy_reaction", "waiting_idle"],
  fc: ["standing", "walking_1", "walking_2", "seated", "back_view",
       "checking_cards", "placing_chips", "watching_table", "happy_reaction", "waiting_idle"],
  pd: ["standing", "dealing_cards", "handling_chips", "presenting_action", "back_view",
       "checking_cards", "classic_deal", "collecting_pots", "shuffling_cards", "waiting_idle"],
  sv: ["standing", "walking_with_tray_1", "walking_with_tray_2", "carrying_tray",
       "serving_drink", "taking_order", "back_view", "waiting_idle"],
};

/** 전체 목록을 [{ cat, action, file, folder, label, prompt }] 로 펼친다. */
export function allSprites() {
  const out = [];
  for (const [cat, actions] of Object.entries(SHEET)) {
    for (const action of actions) {
      const [label, pose] = ACTIONS[action];
      out.push({
        cat,
        action,
        file: `${cat}_${action}.png`,
        folder: CATEGORIES[cat].folder,
        label: `${CATEGORIES[cat].label} · ${label}`,
        look: CATEGORIES[cat].look,
        pose,
        factor: heightFactor(cat, action),
      });
    }
  }
  return out;
}

export default { CANVAS, CATEGORIES, ACTIONS, SHEET, allSprites };
