const CONFIG = {
  gformUrl: "https://forms.gle/replace-with-your-live-form-link",
};

const batchSchedule = [
  {
    id: "batch1",
    label: "Batch 1",
    submissionPeriod: "30 Apr - 4 May 2026",
    evaluationDate: "5 May 2026",
    announcementDate: "6 May 2026",
    state: "published",
  },
  {
    id: "batch2",
    label: "Batch 2",
    submissionPeriod: "7 - 11 May 2026",
    evaluationDate: "12 May 2026",
    announcementDate: "13 May 2026",
    state: "evaluating",
  },
  {
    id: "batch3",
    label: "Batch 3",
    submissionPeriod: "14 - 18 May 2026",
    evaluationDate: "19 May 2026",
    announcementDate: "20 May 2026",
    state: "upcoming",
  },
];

const leaderboardData = {
  batch1: {
    miniGames: [
      {
        creatorName: "Lina Hartono",
        awardName: "Best Game Mechanics",
        contentType: "Mini Games",
        contentUrl: "https://onemore.example.com/ugc/mini-b1-01",
      },
      {
        creatorName: "Rafi Nugroho",
        awardName: "Most Addictive Experience",
        contentType: "Mini Games",
        contentUrl: "https://onemore.example.com/ugc/mini-b1-02",
      },
    ],
    interactiveContent: [
      {
        creatorName: "Tasya Lim",
        awardName: "Best Interactive Story",
        contentType: "Interactive Content",
        contentUrl: "https://onemore.example.com/ugc/interactive-b1-01",
      },
      {
        creatorName: "Evan Pratama",
        awardName: "Best Interactive Experience",
        contentType: "Interactive Content",
        contentUrl: "https://onemore.example.com/ugc/interactive-b1-02",
      },
    ],
  },
};

const batchStateText = {
  upcoming: (batch) => `Opens on ${batch.submissionPeriod}`,
  active: () => "Submissions open",
  evaluating: (batch) => `Winners announced on ${batch.announcementDate}`,
  published: () => "Winners published",
};

function initNav() {
  const links = document.querySelectorAll(".nav-link");
  const panels = document.querySelectorAll(".panel");

  links.forEach((link) => {
    link.addEventListener("click", (e) => {
      e.preventDefault();
      activateSection(link.dataset.section, links, panels);
    });
  });

  document.querySelector('[data-section-jump="winners"]')?.addEventListener("click", (e) => {
    e.preventDefault();
    const target = document.querySelector('.nav-link[data-section="winners"]');
    target?.click();
  });

  if (window.location.hash === "#winners") {
    document.querySelector('.nav-link[data-section="winners"]')?.click();
  }
}

function activateSection(section, links, panels) {
  links.forEach((l) => l.classList.toggle("active", l.dataset.section === section));
  panels.forEach((p) => p.classList.toggle("section-active", p.id === section));
  history.replaceState(null, "", `#${section}`);
}

function renderSchedule() {
  const container = document.getElementById("scheduleGrid");
  if (!container) return;

  container.innerHTML = batchSchedule
    .map(
      (batch) => `
      <article class="schedule-item">
        <h4>${escapeHtml(batch.label)}</h4>
        <p><strong>Submission</strong>: ${escapeHtml(batch.submissionPeriod)}</p>
        <p><strong>Evaluation</strong>: ${escapeHtml(batch.evaluationDate)}</p>
        <p><strong>Announcement</strong>: ${escapeHtml(batch.announcementDate)}</p>
        <span class="state-pill state-${escapeHtml(batch.state)}">${escapeHtml(titleCase(batch.state))}</span>
      </article>
    `
    )
    .join("");
}

function renderBatchTabs() {
  const container = document.querySelector(".week-picker");
  if (!container) return;

  container.innerHTML = batchSchedule
    .map(
      (batch, idx) => `
      <button
        type="button"
        class="week-btn"
        role="tab"
        aria-selected="${idx === 0 ? "true" : "false"}"
        data-batch="${escapeHtml(batch.id)}"
      >
        ${escapeHtml(batch.label)}
      </button>
    `
    )
    .join("");

  const buttons = container.querySelectorAll(".week-btn");
  buttons.forEach((btn) => {
    btn.addEventListener("click", () => {
      buttons.forEach((b) => b.setAttribute("aria-selected", "false"));
      btn.setAttribute("aria-selected", "true");
      renderBatch(btn.dataset.batch);
    });
  });

  const firstBatch = batchSchedule[0];
  if (firstBatch) renderBatch(firstBatch.id);
}

function renderBatch(batchId) {
  const batch = batchSchedule.find((b) => b.id === batchId);
  if (!batch) return;

  const stateEl = document.getElementById("batchState");
  const stateTextBuilder = batchStateText[batch.state] || (() => "State unavailable");
  stateEl.textContent = `${batch.label}: ${stateTextBuilder(batch)}`;

  const content = document.getElementById("leaderboardContent");

  if (batch.state !== "published") {
    content.innerHTML = `
      <div class="card leaderboard-empty">
        <h3 class="card-title"><span class="title-icon">?</span> Results are not public yet</h3>
        <p class="hero-lead">This batch is currently <strong>${escapeHtml(batch.state)}</strong>. Winners will be shown on ${escapeHtml(batch.announcementDate)} after admin publish.</p>
      </div>
    `;
    return;
  }

  const data = leaderboardData[batchId];
  if (!data) {
    content.innerHTML = `
      <div class="card leaderboard-empty">
        <h3 class="card-title"><span class="title-icon">?</span> No published records</h3>
        <p class="hero-lead">Published state is active, but winner entries are not configured yet.</p>
      </div>
    `;
    return;
  }

  content.innerHTML = `
    <div class="winner-grid">
      ${renderTypeSection("Mini Games", data.miniGames)}
      ${renderTypeSection("Interactive Content", data.interactiveContent)}
    </div>
  `;
}

function renderTypeSection(typeLabel, winners) {
  return `
    <section class="card type-section">
      <h3 class="card-title"><span class="title-icon">?</span> ${escapeHtml(typeLabel)}</h3>
      <div class="winner-list">
        ${winners.map(renderWinnerCard).join("")}
      </div>
    </section>
  `;
}

function renderWinnerCard(item) {
  return `
    <article class="winner-item">
      <p class="winner-item-name">${escapeHtml(item.creatorName)}</p>
      <p class="winner-item-award">${escapeHtml(item.awardName)}</p>
      <p class="winner-item-type">${escapeHtml(item.contentType)}</p>
      <a class="winner-item-link" href="${escapeHtml(item.contentUrl)}" target="_blank" rel="noopener">View UGC</a>
    </article>
  `;
}

function applyConfig() {
  const cta = document.getElementById("submissionCta");
  if (!cta) return;
  cta.href = CONFIG.gformUrl;
}

function titleCase(text) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = String(text);
  return div.innerHTML;
}

document.addEventListener("DOMContentLoaded", () => {
  initNav();
  applyConfig();
  renderSchedule();
  renderBatchTabs();
});
