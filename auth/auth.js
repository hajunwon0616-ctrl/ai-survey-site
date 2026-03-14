import { auth, db } from "../firebase-config.js";
import {
  FacebookAuthProvider,
  GithubAuthProvider,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithRedirect,
  signInWithPopup,
  signOut
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  doc,
  getDoc,
  serverTimestamp,
  setDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const PROVIDERS = {
  google: () => {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: "select_account" });
    return provider;
  },
  facebook: () => new FacebookAuthProvider(),
  github: () => new GithubAuthProvider()
};

async function signInWithProvider(providerKey) {
  const providerFactory = PROVIDERS[providerKey];
  if (!providerFactory) {
    throw new Error("지원하지 않는 로그인 방식입니다.");
  }

  const provider = providerFactory();

  try {
    const result = await signInWithPopup(auth, provider);
    const profile = await ensureUserProfile(result.user);

    return {
      user: result.user,
      profile,
      redirected: false
    };
  } catch (error) {
    if (error?.code === "auth/popup-blocked" || error?.code === "auth/cancelled-popup-request") {
      await signInWithRedirect(auth, provider);
      return {
        user: null,
        profile: null,
        redirected: true
      };
    }

    throw error;
  }
}

function getAuthErrorMessage(error, locale = "ko") {
  const code = error?.code || "";
  const messages = {
    ko: {
      "auth/operation-not-allowed": "Firebase Authentication에서 해당 로그인 제공자를 활성화해야 합니다.",
      "auth/unauthorized-domain": "Firebase Authentication 설정의 Authorized domains에 현재 사이트 도메인을 추가해야 합니다.",
      "auth/popup-blocked": "브라우저가 로그인 팝업을 차단했습니다. 팝업 허용 후 다시 시도하세요.",
      "auth/popup-closed-by-user": "로그인 팝업이 중간에 닫혔습니다.",
      "auth/network-request-failed": "네트워크 문제로 로그인 요청이 실패했습니다.",
      "auth/configuration-not-found": "Firebase Authentication 제공자 설정이 아직 완료되지 않았습니다.",
      default: `로그인 중 오류가 발생했습니다. ${error?.message || ""}`.trim()
    },
    en: {
      "auth/operation-not-allowed": "Enable this sign-in provider in Firebase Authentication first.",
      "auth/unauthorized-domain": "Add the current site domain to Authorized domains in Firebase Authentication.",
      "auth/popup-blocked": "The browser blocked the sign-in popup. Allow popups and try again.",
      "auth/popup-closed-by-user": "The sign-in popup was closed before completion.",
      "auth/network-request-failed": "The sign-in request failed due to a network issue.",
      "auth/configuration-not-found": "The Firebase Authentication provider is not configured yet.",
      default: `Sign-in failed. ${error?.message || ""}`.trim()
    }
  };

  return messages[locale]?.[code] || messages[locale]?.default || error?.message || "Authentication error";
}

function observeAuthSession(callback) {
  return onAuthStateChanged(auth, async (user) => {
    if (!user) {
      callback({ user: null, profile: null });
      return;
    }

    try {
      const profile = await ensureUserProfile(user);
      callback({ user, profile });
    } catch (error) {
      console.error("Auth profile sync error:", error);
      callback({
        user,
        profile: {
          uid: user.uid,
          displayName: user.displayName || "사용자",
          email: user.email || "",
          role: "user"
        }
      });
    }
  });
}

async function ensureUserProfile(user) {
  const profileRef = doc(db, "userProfiles", user.uid);
  const profileSnapshot = await getDoc(profileRef);
  const existingProfile = profileSnapshot.exists() ? profileSnapshot.data() : null;
  const baseProfile = {
    uid: user.uid,
    displayName: user.displayName || "",
    email: user.email || "",
    photoURL: user.photoURL || "",
    providerIds: user.providerData.map((item) => item.providerId),
    role: existingProfile?.role || "user",
    lastLoginAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  };

  await setDoc(profileRef, {
    ...(existingProfile || {}),
    ...baseProfile,
    createdAt: existingProfile?.createdAt || serverTimestamp()
  });

  const refreshed = await getDoc(profileRef);
  return refreshed.exists() ? refreshed.data() : baseProfile;
}

async function signOutCurrentUser() {
  await signOut(auth);
}

function isAdminProfile(profile) {
  return profile?.role === "admin";
}

export {
  auth,
  ensureUserProfile,
  getAuthErrorMessage,
  isAdminProfile,
  observeAuthSession,
  signInWithProvider,
  signOutCurrentUser
};
