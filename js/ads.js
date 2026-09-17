// 리워드 광고 — 실제 광고 SDK(애드센스 H5/애드몹 등)는 아직 연동 전.
// data.js의 ads.network가 비어 있는 동안은 상점 결제와 동일한 패턴으로 "광고 준비중"으로 막아둔다.
// 나중에 실제 SDK를 붙일 때는 requestRewardedAd() 내부만 그 SDK 호출로 바꾸면 된다(game.js는 그대로 둬도 됨).
function adsReady() {
  return Boolean(GAME_DATA.ads.network);
}

// 성공하면 { ok: true }를, 광고 시청을 끝까지 마치지 않았거나 아직 준비 전이면 { ok: false, notReady? } 를 돌려준다.
async function requestRewardedAd() {
  if (!adsReady()) {
    return { ok: false, notReady: true, error: "광고 연동 준비 중이에요. 오픈되면 알려드릴게요!" };
  }
  // TODO: 실제 SDK의 "보상형 광고 시청 완료" 콜백과 연결
  return { ok: false, notReady: true, error: "광고 연동 준비 중이에요. 오픈되면 알려드릴게요!" };
}

window.Ads = { adsReady, requestRewardedAd };
