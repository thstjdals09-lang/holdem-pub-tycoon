// 리워드 광고 — 실제 광고 SDK(애드센스 H5/애드몹 등)는 아직 연동 전.
//
// 🧪 테스트 모드: data.js의 ads.network가 비어 있는 동안은 광고를 실제로 보여주는 대신 즉시 보상을
// 지급한다 — 전체 기능을 테스트해볼 수 있게 하기 위한 임시 조치(사용자 요청). network 값을 채우면
// 이 분기는 자동으로 꺼지고 실제 광고 SDK 호출로 전환해야 한다(아래 TODO 참고).
function adsReady() {
  return Boolean(GAME_DATA.ads.network);
}

// 성공하면 { ok: true }를 돌려준다. 실 SDK 연동 후에는 광고를 끝까지 안 봤을 때 { ok: false } 를 돌려주게 될 것.
async function requestRewardedAd() {
  if (!adsReady()) {
    console.warn("[Ads] TEST MODE: granting reward without watching an ad (ad network not configured yet)");
    return { ok: true, test: true };
  }
  // TODO: 실제 SDK의 "보상형 광고 시청 완료" 콜백과 연결
  return { ok: false, notReady: true, error: "광고 연동 준비 중이에요. 오픈되면 알려드릴게요!" };
}

window.Ads = { adsReady, requestRewardedAd };
