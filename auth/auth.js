import { auth, db } from "../firebase-config.js";
import {
  FacebookAuthProvider,
  GithubAuthProvider,
  GoogleAuthProvider,
  onAuthStateChanged,
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

  const result = await signInWithPopup(auth, providerFactory());
  const profile = await ensureUserProfile(result.user);

  return {
    user: result.user,
    profile
  };
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
          role: "authenticated"
        }
      });
    }
  });
}

async function ensureUserProfile(user) {
  const profileRef = doc(db, "userProfiles", user.uid);
  const profileSnapshot = await getDoc(profileRef);
  const baseProfile = {
    uid: user.uid,
    displayName: user.displayName || "",
    email: user.email || "",
    photoURL: user.photoURL || "",
    providerIds: user.providerData.map((item) => item.providerId),
    role: profileSnapshot.exists() ? profileSnapshot.data().role || "authenticated" : "authenticated",
    lastLoginAt: serverTimestamp()
  };

  if (!profileSnapshot.exists()) {
    await setDoc(profileRef, {
      ...baseProfile,
      createdAt: serverTimestamp()
    });
  } else {
    await setDoc(profileRef, {
      ...profileSnapshot.data(),
      ...baseProfile
    });
  }

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
  isAdminProfile,
  observeAuthSession,
  signInWithProvider,
  signOutCurrentUser
};
