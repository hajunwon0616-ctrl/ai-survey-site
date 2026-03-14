function renderAuthPanel(elements, session, locale = "ko") {
  if (!elements.authSummary || !elements.authActions) {
    return;
  }

  const user = session?.user;
  const profile = session?.profile;

  elements.authSummary.innerHTML = "";
  elements.authActions.querySelectorAll("[data-auth-provider]").forEach((button) => {
    button.hidden = Boolean(user);
  });

  if (!user) {
    elements.authSummary.textContent = locale === "en"
      ? "Guest mode is enabled. Sign in to keep a personal analysis history."
      : "게스트 모드입니다. 로그인하면 개인 분석 기록을 저장하고 다시 볼 수 있습니다.";
    if (elements.signOutBtn) {
      elements.signOutBtn.hidden = true;
    }
    if (elements.adminLink) {
      elements.adminLink.hidden = true;
    }
    if (elements.userHistorySection) {
      elements.userHistorySection.hidden = true;
    }
    return;
  }

  const strong = document.createElement("strong");
  strong.textContent = profile?.displayName || user.displayName || user.email || "사용자";
  const details = document.createElement("span");
  details.textContent = locale === "en"
    ? `Signed in as ${profile?.email || user.email || "user"}`
    : `${profile?.email || user.email || "계정"}으로 로그인됨`;
  elements.authSummary.append(strong, details);

  if (elements.signOutBtn) {
    elements.signOutBtn.hidden = false;
  }
  if (elements.adminLink) {
    elements.adminLink.hidden = profile?.role !== "admin";
  }
  if (elements.userHistorySection) {
    elements.userHistorySection.hidden = false;
  }
}

function renderUserHistory(elements, reports = [], locale = "ko") {
  if (!elements.userHistoryList) {
    return;
  }

  elements.userHistoryList.innerHTML = "";

  if (!reports.length) {
    const empty = document.createElement("div");
    empty.className = "history-empty";
    empty.textContent = locale === "en"
      ? "There are no saved reports yet."
      : "저장된 개인 리포트가 아직 없습니다.";
    elements.userHistoryList.appendChild(empty);
    return;
  }

  reports.forEach((item) => {
    const card = document.createElement("article");
    card.className = "history-card";
    card.innerHTML = `
      <div class="history-card-head">
        <strong>${item.testLabel || item.providerName || "분석 기록"}</strong>
        <span>${formatDate(item.createdAt)}</span>
      </div>
      <p class="history-card-meta">${item.providerName || "Unknown"} · ${item.modelName || "Unknown model"} · ${item.surveyVersion || "-"}</p>
      <p class="history-card-summary">${item.summary || ""}</p>
      <div class="history-card-actions">
        <button type="button" class="secondary-btn" data-history-open="${item.id}">${locale === "en" ? "Open report" : "리포트 열기"}</button>
      </div>
    `;
    elements.userHistoryList.appendChild(card);
  });
}

function formatDate(value) {
  if (!value) {
    return "-";
  }

  const dateValue = typeof value?.toDate === "function" ? value.toDate() : new Date(value);
  return Number.isNaN(dateValue.getTime()) ? String(value) : dateValue.toLocaleString();
}

export {
  renderAuthPanel,
  renderUserHistory
};
