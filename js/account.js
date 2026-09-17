// 계정(회원가입/로그인/계정설정) — Firebase Authentication 사용.
// 아이디만 입력받아 내부적으로 "아이디@holdem-pub-tycoon.local" 가짜 이메일로 변환한다(화면엔 항상 아이디만 노출).
// casino-tycoon 프로젝트에서 이미 검증한 것과 같은 패턴.
import {
  auth,
  db,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  updatePassword,
  deleteUser,
  onAuthStateChanged,
  doc,
  deleteDoc,
} from "./firebase-init.js?v=8";

const EMAIL_SUFFIX = "@holdem-pub-tycoon.local";
const toEmail = (username) => `${username.trim().toLowerCase()}${EMAIL_SUFFIX}`;

function mapFirebaseError(code) {
  switch (code) {
    case "auth/email-already-in-use":
      return "이미 존재하는 아이디예요.";
    case "auth/invalid-email":
      return "아이디에 사용할 수 없는 문자가 있어요.";
    case "auth/weak-password":
      return "비밀번호는 6자 이상이어야 해요.";
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found":
      return "아이디 또는 비밀번호가 일치하지 않아요.";
    case "auth/too-many-requests":
      return "시도가 너무 많아요. 잠시 후 다시 시도해주세요.";
    case "auth/requires-recent-login":
      return "보안을 위해 다시 로그인한 뒤 시도해주세요.";
    default:
      return "오류가 발생했어요. 잠시 후 다시 시도해주세요.";
  }
}

async function createAccount(username, password) {
  const id = username.trim();
  if (id.length < 2) return { ok: false, error: "아이디는 2자 이상 입력해주세요." };
  if (password.length < 6) return { ok: false, error: "비밀번호는 6자 이상 입력해주세요." };
  try {
    const cred = await createUserWithEmailAndPassword(auth, toEmail(id), password);
    await updateProfile(cred.user, { displayName: id });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: mapFirebaseError(e?.code ?? "") };
  }
}

async function login(username, password) {
  try {
    await signInWithEmailAndPassword(auth, toEmail(username.trim()), password);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: mapFirebaseError(e?.code ?? "") };
  }
}

async function logout() {
  await signOut(auth);
}

async function changePassword(newPassword) {
  if (newPassword.length < 6) return { ok: false, error: "비밀번호는 6자 이상 입력해주세요." };
  try {
    await updatePassword(auth.currentUser, newPassword);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: mapFirebaseError(e?.code ?? "") };
  }
}

// 계정 + 클라우드 세이브를 완전히 삭제한다(되돌릴 수 없음).
async function deleteAccount() {
  const uid = auth.currentUser?.uid;
  try {
    if (uid) {
      await deleteDoc(doc(db, "holdemPub_saves", uid)).catch(() => {});
    }
    await deleteUser(auth.currentUser);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: mapFirebaseError(e?.code ?? "") };
  }
}

const getCurrentUsername = () => auth.currentUser?.displayName ?? null;
const getCurrentUid = () => auth.currentUser?.uid ?? null;

function waitForAuthReady() {
  return new Promise((resolve) => {
    const unsub = onAuthStateChanged(auth, (user) => {
      unsub();
      resolve(user);
    });
  });
}

window.Account = {
  createAccount,
  login,
  logout,
  changePassword,
  deleteAccount,
  getCurrentUsername,
  getCurrentUid,
  waitForAuthReady,
  onAuthStateChanged: (cb) => onAuthStateChanged(auth, cb),
};
