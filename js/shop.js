// 상점 결제 — PortOne(아임포트) V2 브라우저 SDK 사용.
// data.js의 payment.storeId/channelKey가 비어 있는 동안은 "결제 준비중"으로 막아둔다
// (아직 PG 가맹점 가입 전 — 가입 후 그 두 값만 채우면 실 결제로 바로 전환됨).
//
// ⚠️ 중요: 지금은 서버(Cloud Function 등 검증 백엔드)가 없어서, 결제 성공 응답을 클라이언트가
// 그대로 신뢰해 재화를 지급한다. 즉 마음만 먹으면 브라우저 콘솔에서 재화를 위조할 수 있는 상태.
// 실제로 돈을 받기 시작하기 전에는 반드시 서버 측에서 PortOne 결제 검증(paymentId로 조회) 후
// 재화를 지급하도록 바꿔야 한다(Firebase면 Cloud Functions로 처리하는 게 자연스러움).
import { auth, db, doc, setDoc, serverTimestamp } from "./firebase-init.js";

function paymentReady() {
  const p = GAME_DATA.payment;
  return Boolean(p.storeId && p.channelKey && window.PortOne);
}

async function checkout(item) {
  if (!paymentReady()) {
    return { ok: false, notReady: true, error: "결제 연동 준비 중이에요. 오픈되면 알려드릴게요!" };
  }
  const p = GAME_DATA.payment;
  const paymentId = `hpt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  let response;
  try {
    response = await window.PortOne.requestPayment({
      storeId: p.storeId,
      channelKey: p.channelKey,
      paymentId,
      orderName: item.name,
      totalAmount: item.amountKRW,
      currency: "CURRENCY_KRW",
      payMethod: "CARD",
      customer: auth.currentUser ? { customerId: auth.currentUser.uid } : undefined,
    });
  } catch (err) {
    console.error("[Shop] payment request failed", err);
    return { ok: false, error: "결제 창을 여는 데 실패했어요." };
  }
  if (!response || response.code) {
    return { ok: false, error: response?.message || "결제가 취소됐어요." };
  }

  const uid = auth.currentUser?.uid;
  if (uid) {
    try {
      await setDoc(doc(db, "holdemPub_purchases", paymentId), {
        uid,
        itemId: item.id,
        amountKRW: item.amountKRW,
        createdAt: serverTimestamp(),
        verified: false, // 서버 검증 붙이기 전까지는 항상 false — 나중에 검증 함수가 true로 바꿔야 함
      });
    } catch (err) {
      console.error("[Shop] purchase log failed", err);
    }
  }
  return { ok: true, paymentId };
}

window.Shop = { checkout, paymentReady };
