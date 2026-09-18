// 상점 결제 — PortOne(아임포트) V2 브라우저 SDK 사용.
//
// 🧪 테스트 모드: data.js의 payment.storeId/channelKey가 비어 있는 동안(=PG 가맹점 가입 전)은
// 결제창을 띄우는 대신 즉시 성공 처리해서 무료로 지급한다 — 전체 기능을 테스트해볼 수 있게 하기 위한
// 임시 조치(사용자 요청). storeId/channelKey를 채우면 이 분기는 자동으로 꺼지고 실제 결제로 전환된다.
// 실서비스 오픈 전에는 반드시 이 테스트 지급 분기를 지우거나 최소한 관리자만 쓰게 막아야 한다.
//
// ⚠️ 중요: 실 결제로 전환된 뒤에도, 지금은 서버(Cloud Function 등 검증 백엔드)가 없어서 결제 성공
// 응답을 클라이언트가 그대로 신뢰해 재화를 지급한다. 실제로 돈을 받기 시작하기 전에는 반드시 서버
// 측에서 PortOne 결제 검증(paymentId로 조회) 후 재화를 지급하도록 바꿔야 한다.
import { auth, db, doc, setDoc, serverTimestamp } from "./firebase-init.js?v=13";

function paymentReady() {
  const p = GAME_DATA.payment;
  return Boolean(p.storeId && p.channelKey);
}

// PortOne SDK(약 240KB)는 페이지 로드 때 받지 않고, 실제 결제를 처음 시도할 때만 불러온다.
let portOneLoading = null;
function loadPortOne() {
  if (window.PortOne) return Promise.resolve(window.PortOne);
  if (!portOneLoading) {
    portOneLoading = new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = "https://cdn.portone.io/v2/browser-sdk.js";
      s.onload = () => resolve(window.PortOne);
      s.onerror = () => {
        portOneLoading = null;
        reject(new Error("PortOne SDK load failed"));
      };
      document.head.appendChild(s);
    });
  }
  return portOneLoading;
}

async function checkout(item) {
  if (!paymentReady()) {
    console.warn(`[Shop] TEST MODE: granting "${item.name}" without real payment (PG not configured yet)`);
    return { ok: true, test: true };
  }
  const p = GAME_DATA.payment;
  const paymentId = `hpt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  let response;
  try {
    const PortOne = await loadPortOne();
    response = await PortOne.requestPayment({
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
