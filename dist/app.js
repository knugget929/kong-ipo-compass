(() => {
  "use strict";

  const STORAGE_KEY = "kong-ipo-compass:model:v1";
  const DATA_ROOT = "https://raw.githubusercontent.com/knugget929/kong-ipo-compass/main/data";
  const REQUEST_TIMEOUT_MS = 6000;
  const FALLBACK = {
    asOf: "2026-09-03",
    verdict: { direction: "Constructive", confidence: "Low–medium", score: 67, summary: "Kong has a credible path to public-market scale, with important financial and IPO details still unconfirmed.", ipoStatus: "No confirmed filing" },
    model: {
      defaults: { arr: 300, multiple: 15, netCash: 60, dilutedShares: 195, ipoDiscount: 12.5, ownedShares: 0, costBasis: 0 },
      references: { latestSecondaryPrice: 10, latestSecondaryLabel: "user-reported secondary" },
      presets: {
        bear: { label: "Bear", arr: 225, multiple: 8, netCash: 30, dilutedShares: 205, ipoDiscount: 20 },
        base: { label: "Base", arr: 300, multiple: 15, netCash: 60, dilutedShares: 195, ipoDiscount: 12.5 },
        bull: { label: "Bull", arr: 350, multiple: 20, netCash: 100, dilutedShares: 190, ipoDiscount: 5 }
      }
    },
    scorecard: [], catalysts: [], milestones: [], upgradeRules: [], knownUnknowns: [], sources: [], changeLog: []
  };

  const FALLBACK_NEWS = {
    schemaVersion: 1,
    revision: 1,
    lastCheckedAt: "2026-09-03T21:00:00+03:00",
    status: "NO_MATERIAL_CHANGE",
    thesisDecision: "MAINTAIN",
    summary: "No confirmed IPO filing is in the current evidence set. The latest material developments support the platform story but do not resolve the financial disclosure gap.",
    items: []
  };

  const numericFields = ["arr", "multiple", "netCash", "dilutedShares", "ipoDiscount", "ownedShares", "costBasis"];
  let data = FALLBACK;
  let news = FALLBACK_NEWS;
  let dataSource = "snapshot";
  let state = { ...FALLBACK.model.defaults };

  const byId = (id) => document.getElementById(id);
  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
  const escapeHtml = (value) => String(value ?? "").replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[char]));
  const isFiniteNumber = (value) => typeof value === "number" && Number.isFinite(value);
  const isValidDate = (value) => typeof value === "string" && /^\d{4}-\d{2}-\d{2}(?:T.*)?$/.test(value) && !Number.isNaN(new Date(value.length === 10 ? `${value}T12:00:00Z` : value).getTime());
  const isHttpsUrl = (value) => {
    try { return new URL(value).protocol === "https:"; } catch (_) { return false; }
  };
  const safeHttpsUrl = (value) => isHttpsUrl(value) ? new URL(value).href : "#";
  const currency0 = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
  const number0 = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });

  function formatDate(dateString) {
    const normalized = typeof dateString === "string" && dateString.length === 10 ? `${dateString}T12:00:00Z` : dateString;
    const date = new Date(normalized);
    if (Number.isNaN(date.getTime())) return "Date unavailable";
    return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }).format(date);
  }

  function formatDateTime(dateString) {
    const date = new Date(dateString);
    if (Number.isNaN(date.getTime())) return "Check time unavailable";
    return `Checked ${new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit", timeZoneName: "short" }).format(date)}`;
  }

  function isValidThesis(value) {
    if (!value || typeof value !== "object" || value.schemaVersion !== 1 || !isValidDate(value.asOf)) return false;
    if (!value.verdict || !isFiniteNumber(value.verdict.score) || typeof value.verdict.direction !== "string") return false;
    const arrays = ["scorecard", "catalysts", "milestones", "upgradeRules", "knownUnknowns", "sources", "changeLog"];
    if (!arrays.every((key) => Array.isArray(value[key]))) return false;
    const defaults = value.model?.defaults;
    const presets = value.model?.presets;
    if (!defaults || !presets || !["bear", "base", "bull"].every((key) => presets[key])) return false;
    const valuationFields = ["arr", "multiple", "netCash", "dilutedShares", "ipoDiscount"];
    if (![...valuationFields, "ownedShares", "costBasis"].every((key) => isFiniteNumber(defaults[key]))) return false;
    if (!["bear", "base", "bull"].every((name) => valuationFields.every((key) => isFiniteNumber(presets[name][key])))) return false;
    if (!value.sources.every((source) => source && typeof source.label === "string" && isHttpsUrl(source.url))) return false;
    return value.changeLog.every((entry) => entry && isValidDate(entry.date) && ["UPGRADE", "MAINTAIN", "DOWNGRADE"].includes(entry.verdict));
  }

  function isValidNews(value) {
    const decisions = ["UPGRADE", "MAINTAIN", "DOWNGRADE"];
    if (!value || typeof value !== "object" || value.schemaVersion !== 1 || !isValidDate(value.lastCheckedAt) || !decisions.includes(value.thesisDecision) || !Array.isArray(value.items)) return false;
    return value.items.every((item) => item && typeof item.id === "string" && isValidDate(item.publishedAt) && typeof item.title === "string" && typeof item.summary === "string" && ["positive", "neutral", "negative"].includes(item.impact) && decisions.includes(item.thesisDecision) && isFiniteNumber(item.scoreDelta) && Array.isArray(item.confirmed) && Array.isArray(item.uncertain) && Array.isArray(item.sources) && item.sources.length > 0 && item.sources.every((source) => source && typeof source.label === "string" && isHttpsUrl(source.url)));
  }

  async function fetchJson(url) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const separator = url.includes("?") ? "&" : "?";
      const response = await fetch(`${url}${separator}v=${Date.now()}`, { cache: "no-store", signal: controller.signal });
      if (!response.ok) throw new Error(`Data request failed: ${response.status}`);
      return await response.json();
    } finally {
      clearTimeout(timeout);
    }
  }

  async function loadDataFile(filename, validator, fallback) {
    try {
      const remote = await fetchJson(`${DATA_ROOT}/${filename}`);
      if (!validator(remote)) throw new Error(`Invalid remote ${filename}`);
      return { value: remote, source: "live" };
    } catch (_) {
      try {
        const local = await fetchJson(`./data/${filename}`);
        if (!validator(local)) throw new Error(`Invalid local ${filename}`);
        return { value: local, source: "snapshot" };
      } catch (_) {
        return { value: fallback, source: "embedded" };
      }
    }
  }

  function formatValue(millions) {
    const absolute = Math.abs(millions);
    const sign = millions < 0 ? "−" : "";
    if (absolute >= 1000) return `${sign}$${(absolute / 1000).toFixed(2)}B`;
    return `${sign}$${absolute.toFixed(0)}M`;
  }

  function calculate(values) {
    const enterpriseValue = values.arr * values.multiple;
    const preDiscountEquity = enterpriseValue + values.netCash;
    const modeledEquity = preDiscountEquity * (1 - values.ipoDiscount / 100);
    const price = values.dilutedShares > 0 ? modeledEquity / values.dilutedShares : 0;
    const preDiscountPrice = values.dilutedShares > 0 ? preDiscountEquity / values.dilutedShares : 0;
    const holdingValue = price * values.ownedShares;
    const totalCost = values.costBasis * values.ownedShares;
    const gain = holdingValue - totalCost;
    const gainMultiple = totalCost > 0 ? holdingValue / totalCost : null;
    return { enterpriseValue, preDiscountEquity, modeledEquity, price, preDiscountPrice, holdingValue, totalCost, gain, gainMultiple };
  }

  function scenarioPrice(name) {
    const preset = data.model.presets[name];
    return calculate({ ...state, ...preset }).price;
  }

  function matchPreset() {
    const keys = ["arr", "multiple", "netCash", "dilutedShares", "ipoDiscount"];
    for (const [name, preset] of Object.entries(data.model.presets)) {
      if (keys.every((key) => Math.abs(state[key] - preset[key]) < 0.0001)) return name;
    }
    return null;
  }

  function setText(id, value) {
    const element = byId(id);
    if (element) element.textContent = value;
  }

  function syncInputs() {
    numericFields.forEach((field) => {
      const numberInput = document.querySelector(`[data-field="${field}"]`);
      const rangeInput = document.querySelector(`[data-range="${field}"]`);
      if (numberInput && document.activeElement !== numberInput) numberInput.value = state[field];
      if (rangeInput) {
        rangeInput.value = state[field];
        const min = Number(rangeInput.min);
        const max = Number(rangeInput.max);
        const fill = max > min ? ((state[field] - min) / (max - min)) * 100 : 0;
        rangeInput.style.setProperty("--fill", `${clamp(fill, 0, 100)}%`);
      }
    });
  }

  function saveState() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (_) { /* Device storage may be unavailable. */ }
  }

  function updateModel({ save = true } = {}) {
    const result = calculate(state);
    const bear = scenarioPrice("bear");
    const bull = scenarioPrice("bull");
    const min = Math.min(bear, bull);
    const max = Math.max(bear, bull);
    const needle = max > min ? clamp(((result.price - min) / (max - min)) * 100, 0, 100) : 50;
    const activePreset = matchPreset();

    setText("sharePrice", Math.max(0, result.price).toFixed(2));
    setText("holdingValue", currency0.format(result.holdingValue));
    setText("equityValue", formatValue(result.modeledEquity));
    setText("modeledGain", `${result.gain >= 0 ? "+" : "−"}${currency0.format(Math.abs(result.gain))}`);
    setText("totalCost", currency0.format(result.totalCost));
    const secondaryReference = Number(data.model.references?.latestSecondaryPrice) || 10;
    const secondaryReferenceLabel = data.model.references?.latestSecondaryLabel || "user-reported secondary";
    const secondaryDelta = secondaryReference > 0 ? ((result.price / secondaryReference) - 1) * 100 : 0;
    setText("secondaryLabel", `Vs. ${secondaryReferenceLabel} ~$${secondaryReference.toFixed(secondaryReference % 1 ? 2 : 0)}`);
    setText("secondaryDelta", `${secondaryDelta >= 0 ? "+" : "−"}${Math.abs(secondaryDelta).toFixed(1)}%`);
    setText("gainMultiple", result.gainMultiple === null ? "—" : `${result.gainMultiple.toFixed(1)}×`);
    setText("bearPrice", `$${bear.toFixed(2)} bear`);
    setText("bullPrice", `$${bull.toFixed(2)} bull`);
    setText("formulaArr", `$${number0.format(state.arr)}M`);
    setText("formulaMultiple", `${state.multiple}×`);
    setText("activeCaseLabel", activePreset ? `${data.model.presets[activePreset].label} case` : "Custom case");

    const needleElement = byId("rangeNeedle");
    if (needleElement) needleElement.style.left = `${needle}%`;
    const gainPill = byId("gainPill");
    if (gainPill) {
      gainPill.classList.toggle("positive", result.gain >= 0);
      gainPill.classList.toggle("negative", result.gain < 0);
    }

    document.querySelectorAll("[data-preset]").forEach((button) => button.classList.toggle("is-active", button.dataset.preset === activePreset));
    syncInputs();
    renderSensitivity();
    if (save) saveState();
  }

  function renderSensitivity() {
    const table = byId("sensitivityTable");
    if (!table) return;
    const arrValues = [200, 250, 300, 350, 400];
    const multiples = [8, 12, 15, 20, 24];
    let html = "<thead><tr><th scope=\"col\">ARR ↓ / Multiple →</th>";
    html += multiples.map((multiple) => `<th scope="col">${multiple}×</th>`).join("");
    html += "</tr></thead><tbody>";
    arrValues.forEach((arr) => {
      html += `<tr><th scope="row">$${arr}M</th>`;
      multiples.forEach((multiple) => {
        const price = calculate({ ...state, arr, multiple }).price;
        const current = Math.abs(state.arr - arr) < 0.01 && Math.abs(state.multiple - multiple) < 0.01;
        html += `<td><button type="button" class="${current ? "is-current" : ""}" data-sensitivity-arr="${arr}" data-sensitivity-multiple="${multiple}" aria-label="Use ${arr} million ARR and ${multiple} times multiple">$${price.toFixed(2)}</button></td>`;
      });
      html += "</tr>";
    });
    table.innerHTML = `${html}</tbody>`;
  }

  function renderEvidence() {
    setText("headerVerdict", data.verdict.direction);
    setText("headerDate", `As of ${formatDate(data.asOf)}`);
    setText("thesisSummary", data.verdict.summary);
    setText("thesisScore", data.verdict.score);
    setText("verdictText", data.verdict.direction);
    setText("confidenceText", data.verdict.confidence);
    setText("ipoStatusText", data.verdict.ipoStatus);
    setText("sourceDate", `Accessed ${formatDate(data.asOf)}`);

    const orbit = document.querySelector(".score-orbit");
    if (orbit) orbit.style.background = `radial-gradient(circle at center, #0e211b 56%, transparent 58%), conic-gradient(var(--mint) 0 ${clamp(data.verdict.score, 0, 100)}%, rgba(115,242,191,.11) ${clamp(data.verdict.score, 0, 100)}% 100%)`;

    const scorecard = byId("scorecardList");
    if (scorecard) scorecard.innerHTML = data.scorecard.map((item) => `
      <div class="score-row ${escapeHtml(item.state)}">
        <span>${escapeHtml(item.label)}</span>
        <div class="score-bar" aria-hidden="true"><i style="width:${clamp((item.score / item.max) * 100, 0, 100)}%"></i></div>
        <b>${escapeHtml(item.score)}/${escapeHtml(item.max)}</b>
        <details><summary>Why</summary><p>${escapeHtml(item.note)}</p></details>
      </div>`).join("");

    const catalysts = byId("catalystList");
    if (catalysts) catalysts.innerHTML = data.catalysts.map((item) => `
      <details class="catalyst-item ${escapeHtml(item.state)}">
        <summary><i class="state-light" aria-hidden="true"></i><span>${escapeHtml(item.name)}</span><small class="catalyst-weight">${escapeHtml(item.weight)}</small></summary>
        <p>${escapeHtml(item.why)}</p>
      </details>`).join("");

    const rules = byId("upgradeRules");
    if (rules) rules.innerHTML = data.upgradeRules.map((item) => `
      <div class="rule-row"><span>${escapeHtml(item.signal)}</span><b class="${String(item.effect).trim().startsWith("−") ? "negative" : ""}">${escapeHtml(item.effect)}</b><p>${escapeHtml(item.detail)}</p></div>`).join("");

    const unknowns = byId("unknownList");
    if (unknowns) unknowns.innerHTML = data.knownUnknowns.map((item) => `<li>${escapeHtml(item)}</li>`).join("");
    setText("unknownCount", data.knownUnknowns.length);

    const timeline = byId("timeline");
    if (timeline) timeline.innerHTML = data.milestones.map((item) => `
      <div class="timeline-item ${escapeHtml(item.kind)}"><time>${escapeHtml(item.date)}</time><h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.detail)}</p></div>`).join("");

    const sources = byId("sourceList");
    if (sources) sources.innerHTML = data.sources.map((source) => `
      <a class="source-link" href="${escapeHtml(safeHttpsUrl(source.url))}" target="_blank" rel="noreferrer"><strong>${escapeHtml(source.label)}</strong><i aria-hidden="true">↗</i><small>${escapeHtml(source.date)}</small><span>${escapeHtml(source.supports)}</span></a>`).join("");

    const latest = data.changeLog[0];
    if (latest) {
      setText("latestVerdict", latest.verdict);
      const log = byId("changeLog");
      if (log) log.innerHTML = `<div class="change-entry"><time>${escapeHtml(formatDate(latest.date))}</time><div><h3>${escapeHtml(latest.headline)}</h3><p>${escapeHtml(latest.detail)}</p></div><b>${escapeHtml(latest.score)}</b></div>`;
    }
  }

  function renderNews() {
    const live = dataSource === "live";
    const checked = formatDateTime(news.lastCheckedAt);
    setText("dataSourceBadge", live ? "Live · GitHub" : "Snapshot · GitHub unavailable");
    setText("latestNewsLabel", `${news.thesisDecision || "MAINTAIN"} · ${checked.replace(/^Checked /, "")}`);
    setText("latestNewsSummary", news.summary || "No material thesis change in the latest check.");
    setText("newsStatus", String(news.status || "NO_MATERIAL_CHANGE").replaceAll("_", " "));
    setText("newsDecision", news.thesisDecision || "MAINTAIN");
    setText("newsCheckedAt", `${checked}${live ? " · Live data" : " · Fallback snapshot"}`);
    setText("newsSummary", news.summary || "No material thesis change in the latest check.");

    const list = byId("newsList");
    if (!list) return;
    if (!news.items.length) {
      list.innerHTML = `<article class="news-empty"><span class="status-dot"></span><div><h2>No new material development</h2><p>The latest check did not find evidence strong enough to change the thesis. This state is still refreshed by the nightly task.</p></div></article>`;
      return;
    }

    list.innerHTML = news.items.map((item) => {
      const sources = Array.isArray(item.sources) ? item.sources : [];
      const confirmed = Array.isArray(item.confirmed) ? item.confirmed : [];
      const uncertain = Array.isArray(item.uncertain) ? item.uncertain : [];
      const scoreDelta = Number(item.scoreDelta) || 0;
      return `<article class="news-card ${escapeHtml(item.impact || "neutral")}">
        <div class="news-card-top"><time>${escapeHtml(formatDate(item.publishedAt))}</time><span>${escapeHtml(item.significance || "noted")}</span>${scoreDelta !== 0 ? `<span class="news-score-impact ${scoreDelta > 0 ? "positive" : "negative"}">${scoreDelta > 0 ? "+" : ""}${escapeHtml(scoreDelta)} pts</span>` : ""}<b>${escapeHtml(item.thesisDecision || "MAINTAIN")}</b></div>
        <h2>${escapeHtml(item.title)}</h2>
        <p>${escapeHtml(item.summary)}</p>
        <div class="news-evidence">
          ${confirmed.length ? `<details><summary>What is confirmed</summary><ul>${confirmed.map((fact) => `<li>${escapeHtml(fact)}</li>`).join("")}</ul></details>` : ""}
          ${uncertain.length ? `<details><summary>What remains uncertain</summary><ul>${uncertain.map((fact) => `<li>${escapeHtml(fact)}</li>`).join("")}</ul></details>` : ""}
        </div>
        ${sources.length ? `<div class="news-sources">${sources.map((source) => `<a href="${escapeHtml(safeHttpsUrl(source.url))}" target="_blank" rel="noreferrer">${escapeHtml(source.label)} <span aria-hidden="true">↗</span></a>`).join("")}</div>` : ""}
      </article>`;
    }).join("");
  }

  function setTab(name, { updateHash = true } = {}) {
    const allowed = ["model", "thesis", "news", "signals", "method"];
    const selected = allowed.includes(name) ? name : "model";
    document.querySelectorAll("[data-view]").forEach((view) => {
      const active = view.dataset.view === selected;
      view.hidden = !active;
      view.classList.toggle("is-active", active);
    });
    document.querySelectorAll("[data-tab]").forEach((button) => {
      const active = button.dataset.tab === selected;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-current", active ? "page" : "false");
    });
    if (updateHash) history.replaceState(null, "", `#${selected}`);
    window.scrollTo({ top: 0, behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  }

  function bindEvents() {
    document.querySelectorAll("[data-field]").forEach((input) => {
      input.addEventListener("input", () => {
        if (input.value === "" || !Number.isFinite(Number(input.value))) return;
        state[input.dataset.field] = Number(input.value);
        updateModel();
      });
      input.addEventListener("change", () => {
        const min = Number(input.min);
        const max = Number(input.max);
        if (Number.isFinite(min) && Number.isFinite(max)) state[input.dataset.field] = clamp(Number(input.value), min, max);
        updateModel();
      });
    });

    document.querySelectorAll("[data-range]").forEach((input) => input.addEventListener("input", () => {
      state[input.dataset.range] = Number(input.value);
      updateModel();
    }));

    document.querySelectorAll("[data-preset]").forEach((button) => button.addEventListener("click", () => {
      const preset = data.model.presets[button.dataset.preset];
      if (!preset) return;
      state = { ...state, ...preset };
      updateModel();
    }));

    byId("resetButton")?.addEventListener("click", () => {
      state = { ...data.model.defaults };
      updateModel();
    });

    byId("sensitivityTable")?.addEventListener("click", (event) => {
      const button = event.target.closest("[data-sensitivity-arr]");
      if (!button) return;
      state.arr = Number(button.dataset.sensitivityArr);
      state.multiple = Number(button.dataset.sensitivityMultiple);
      updateModel();
      document.querySelector(".control-panel")?.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
    });

    document.querySelectorAll("[data-open-news]").forEach((button) => button.addEventListener("click", () => setTab("news")));

    document.querySelectorAll("[data-tab]").forEach((button) => button.addEventListener("click", () => setTab(button.dataset.tab)));
    document.querySelectorAll("nav").forEach((nav) => nav.addEventListener("keydown", (event) => {
      if (!['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
      const buttons = [...nav.querySelectorAll("[data-tab]")];
      const index = buttons.indexOf(document.activeElement);
      if (index < 0) return;
      event.preventDefault();
      const next = event.key === 'ArrowRight' ? (index + 1) % buttons.length : (index - 1 + buttons.length) % buttons.length;
      buttons[next].focus();
      setTab(buttons[next].dataset.tab);
    }));
    window.addEventListener("hashchange", () => setTab(location.hash.slice(1), { updateHash: false }));
  }

  async function init() {
    const [thesisResult, newsResult] = await Promise.all([
      loadDataFile("thesis.json", isValidThesis, FALLBACK),
      loadDataFile("news.json", isValidNews, FALLBACK_NEWS)
    ]);
    data = thesisResult.value;
    news = newsResult.value;
    dataSource = thesisResult.source === "live" && newsResult.source === "live" ? "live" : "snapshot";

    state = { ...data.model.defaults };
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (saved && typeof saved === "object") {
        numericFields.forEach((field) => {
          if (Number.isFinite(Number(saved[field]))) state[field] = Number(saved[field]);
        });
      }
    } catch (_) { /* Ignore stale or blocked browser storage. */ }

    renderEvidence();
    renderNews();
    bindEvents();
    updateModel({ save: false });
    setTab(location.hash.slice(1) || "model", { updateHash: false });
  }

  init();
})();