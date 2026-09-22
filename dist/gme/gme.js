(() => {
  "use strict";

  const REMOTE_ROOT = "https://raw.githubusercontent.com/knugget929/kong-ipo-compass/main/data/gme";
  const LOCAL_ROOT = "/data/gme";
  const REQUEST_TIMEOUT_MS = 6500;
  const LEVELS = ["DORMANT", "ATTENTION", "PRESSURE", "REFLEXIVE", "SQUEEZE", "DISLOCATION"];
  const byId = (id) => document.getElementById(id);
  const esc = (value) => String(value ?? "").replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[character]));

  const safeUrl = (value) => {
    try {
      const url = new URL(value);
      return url.protocol === "https:" ? url.href : "#";
    } catch (_) {
      return "#";
    }
  };

  const safeFormatter = (options) => {
    const formatter = new Intl.NumberFormat("en-US", options);
    return { format: (value) => Number.isFinite(value) ? formatter.format(value) : "Unavailable" };
  };

  const number = safeFormatter({ maximumFractionDigits: 2 });
  const whole = safeFormatter({ maximumFractionDigits: 0 });
  const compact = safeFormatter({ notation: "compact", maximumFractionDigits: 1 });
  const money = safeFormatter({ style: "currency", currency: "USD", maximumFractionDigits: 2 });

  function formatDateTime(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "Time unavailable";
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      timeZoneName: "short",
    }).format(date);
  }

  function formatDate(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "Date unavailable";
    return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }).format(date);
  }

  async function fetchJson(url) {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const response = await fetch(url, { cache: "no-store", signal: controller.signal });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.json();
    } finally {
      window.clearTimeout(timeout);
    }
  }

  function isValidSnapshot(value) {
    return Boolean(
      value &&
      value.schemaVersion === 1 &&
      value.symbol === "GME" &&
      LEVELS.includes(value.state?.key) &&
      Number.isInteger(value.state?.level) &&
      value.state.level === LEVELS.indexOf(value.state.key) &&
      Array.isArray(value.engines) &&
      value.engines.length === 6 &&
      Array.isArray(value.theses) &&
      value.theses.length === 3 &&
      Array.isArray(value.sources) &&
      typeof value.interpretation === "string" &&
      typeof value.thesisDirection === "string" &&
      value.state.confidence && typeof value.state.confidence.label === "string" &&
      value.market && value.supplyPressure &&
      value.engines.every((item) => item && typeof item.key === "string" && Array.isArray(item.sourceIds)) &&
      value.theses.every((item) => item && Array.isArray(item.supports) && Array.isArray(item.contradictions)) &&
      value.sources.every((item) => item && typeof item.freshness === "string" && safeUrl(item.url) !== "#") &&
      Array.isArray(value.relationships) && value.relationships.every((item) => item && typeof item.label === "string") &&
      ["strengthening", "weakening", "unchanged", "unknown"].every((key) => Array.isArray(value.whatChanged?.[key])) &&
      typeof value.next?.forwardState === "string" && typeof value.next?.backwardState === "string" &&
      Array.isArray(value.next.forward) && value.next.forward.length > 0 &&
      Array.isArray(value.next.backward) && value.next.backward.length > 0 &&
      Array.isArray(value.falsifiers) &&
      Array.isArray(value.optionsPressure?.concentrations) &&
      value.optionsPressure.concentrations.every((item) => item && typeof item.expiration === "string") &&
      Array.isArray(value.upcomingCatalysts) &&
      value.upcomingCatalysts.every((item) => item && typeof item.certainty === "string") &&
      typeof value.historicalComparison?.warning === "string"
    );
  }

  async function loadData() {
    const loadBundle = async (root, source) => {
      const [current, history, health, events] = await Promise.all([
        fetchJson(`${root}/current.json`),
        fetchJson(`${root}/history/index.json`),
        fetchJson(`${root}/health.json`),
        fetchJson(`${root}/events/index.json`),
      ]);
      if (!isValidSnapshot(current)) throw new Error(`Invalid ${source} snapshot`);
      if (!Array.isArray(history.entries) || !history.entries.length || !Array.isArray(history.retrospectiveRegimes) ||
          !Array.isArray(events.items) || !health || typeof health.status !== "string") throw new Error("Invalid evidence bundle");
      if (events.items.some((item) => !item || typeof item.occurredAt !== "string" || typeof item.category !== "string")) throw new Error("Invalid event index");
      const snapshotEntries = await Promise.all((history.entries ?? []).map(async (entry) => [
        entry.snapshot,
        await fetchJson(`${root}/history/${entry.snapshot}`),
      ]));
      const eventEntries = await Promise.all((events.items ?? []).map(async (entry) => [
        entry.id,
        await fetchJson(`${root}/events/${entry.path}`),
      ]));
      if (snapshotEntries.some(([, snapshot]) => !isValidSnapshot(snapshot)) ||
          eventEntries.some(([, event]) => !event || typeof event.type !== "string" || !Array.isArray(event.observations))) throw new Error("Invalid preserved evidence");
      return {
        current,
        history,
        health,
        events,
        snapshots: new Map(snapshotEntries),
        eventItems: new Map(eventEntries),
        source,
      };
    };
    try {
      return await loadBundle(REMOTE_ROOT, "canonical");
    } catch (_) {
      return loadBundle(LOCAL_ROOT, "snapshot");
    }
  }

  function ageHours(value) {
    const time = new Date(value).getTime();
    return Number.isFinite(time) ? Math.max(0, (Date.now() - time) / 3_600_000) : null;
  }

  function renderHeader(data, health, source) {
    const realtimeAge = Math.min(
      ...data.sources.filter((item) => ["market", "options"].includes(item.kind)).map((item) => ageHours(item.observedAt)).filter(Number.isFinite),
    );
    const failed = health?.status === "FAILED";
    const stale = Number.isFinite(realtimeAge) && realtimeAge > 96;
    const degraded = health?.status === "DEGRADED";
    byId("dataCondition").textContent = failed
      ? "Update failed · last snapshot"
      : stale
        ? "Evidence aged · inspect timestamps"
        : source !== "canonical"
          ? "Site snapshot fallback"
          : degraded
            ? "Canonical · known gaps"
            : "Canonical evidence";
    byId("observedAt").textContent = `Observed ${formatDateTime(data.observedAt)}`;
    const pip = document.querySelector(".live-pip");
    if (failed) pip.style.background = "var(--red)";
    else if (stale || degraded) pip.style.background = "var(--amber)";
    else if (source !== "canonical") pip.style.background = "var(--electric)";
  }

  function renderState(data) {
    byId("heroAnswer").textContent = data.interpretation;
    byId("stateLevel").textContent = `LEVEL ${data.state.level} · ${data.state.key}`;
    byId("stateLabel").textContent = data.state.label;
    byId("stateSummary").textContent = data.state.summary;
    byId("fieldState").textContent = data.state.label;
    byId("confidenceChip").textContent = `${data.state.confidence.label} confidence`;
    byId("notProof").textContent = data.state.key === "SQUEEZE" || data.state.key === "DISLOCATION"
      ? "Direct covering evidence is part of this classification; inspect its provenance below."
      : "Forced covering and dealer hedging are not established.";
    byId("stateMetrics").innerHTML = [
      ["Last", money.format(data.market.last)],
      ["Day", Number.isFinite(data.market.dayChangePct) ? `${data.market.dayChangePct > 0 ? "+" : ""}${number.format(data.market.dayChangePct)}%` : "Unavailable"],
      ["Rel. volume", Number.isFinite(data.market.relativeVolume) ? `${number.format(data.market.relativeVolume)}×` : "Unavailable"],
    ].map(([label, value]) => `<div><small>${esc(label)}</small><b>${esc(value)}</b></div>`).join("");

    for (const engine of data.engines) {
      const node = byId(`node-${engine.key}`);
      if (node) node.textContent = engine.condition;
    }

    const currentIndex = data.state.level;
    document.querySelectorAll("#stateLadder li").forEach((item, index) => {
      item.classList.toggle("is-past", index < currentIndex);
      item.classList.toggle("is-current", index === currentIndex);
      if (index === currentIndex) item.setAttribute("aria-current", "step");
    });
    byId("ladderForward").textContent = data.next.forward[0];
    byId("ladderBackward").textContent = data.next.backward[0];
  }

  function renderRelationships(data) {
    const relationshipByEdge = new Map(data.relationships.map((item) => [`${item.from}-${item.to}`, item]));
    const classByStatus = {
      SUPPORTED: "observed",
      INFERRED: "inferred",
      UNCONFIRMED: "unknown",
      OPPOSING: "opposing",
    };
    document.querySelectorAll("[data-edge]").forEach((path) => {
      const relationship = relationshipByEdge.get(path.dataset.edge);
      path.setAttribute("class", `line ${classByStatus[relationship?.status] ?? "unknown"}`);
      path.setAttribute("aria-label", relationship?.label ?? "Relationship unavailable");
    });
    const summary = data.relationships.map((item) => `${item.from} to ${item.to}: ${item.label}`).join(". ");
    byId("fieldDesc").textContent = summary;
  }

  function renderChanges(data) {
    const labels = {
      strengthening: "Strengthening",
      weakening: "Weakening",
      unchanged: "Unchanged",
      unknown: "Unknown / stale",
    };
    byId("directionChip").textContent = data.thesisDirection === "INITIAL_BASELINE" ? "Initial baseline" : data.thesisDirection.replaceAll("_", " ");
    byId("changeGroups").innerHTML = Object.entries(labels).map(([key, label]) => {
      const values = data.whatChanged[key] ?? [];
      if (!values.length) return "";
      return `<div class="change-group ${esc(key)}"><h3>${esc(label)}</h3><p>${esc(values[0])}</p></div>`;
    }).join("");
    byId("changeInterpretation").textContent = data.state.previous
      ? data.interpretation
      : "This is the first canonical live snapshot. Changes above are differences in the underlying observations, not a fabricated prior model state.";
  }

  function directionClass(engine) {
    if (engine.direction === "WEAKENING") return "weakening";
    if (engine.direction === "UNKNOWN") return "unknown";
    return "";
  }

  function renderEngines(data) {
    const sourceById = new Map(data.sources.map((source) => [source.id, source]));
    byId("engineGrid").innerHTML = data.engines.map((engine, index) => {
      const sources = engine.sourceIds.map((id) => sourceById.get(id)).filter(Boolean);
      const sourceLinks = sources.length
        ? sources.map((source) => `<a href="${esc(safeUrl(source.url))}" target="_blank" rel="noopener noreferrer">${esc(source.name)}</a>`).join(" · ")
        : "No reliable current provider in the evidence set.";
      const statusClass = directionClass(engine);
      return `<article class="engine-card ${engine.key === "supply" ? "is-opposing" : ""}" id="engine-${esc(engine.key)}" data-number="0${index + 1}">
        <div class="engine-card-head"><span class="engine-index">ENGINE 0${index + 1}</span><span class="condition ${statusClass}">${esc(engine.condition)}</span></div>
        <h3>${esc(engine.label)}</h3>
        <p class="engine-headline">${esc(engine.headline)}</p>
        <p class="engine-interpretation">${esc(engine.interpretation)}</p>
        <details class="engine-evidence"><summary>Trace evidence</summary><p>${sourceLinks}</p></details>
      </article>`;
    }).join("");
  }

  function renderTheses(data) {
    byId("thesisGrid").innerHTML = data.theses.map((thesis, index) => `
      <article class="thesis-card ${thesis.assessment === "BEST_CURRENT_FIT" ? "is-leading" : ""}">
        <div class="thesis-top"><span>0${index + 1} · explanation</span><span class="fit-chip">${esc(thesis.fit)} fit</span></div>
        <h3>${esc(thesis.label)}</h3>
        <p>${esc(thesis.summary)}</p>
        <div class="thesis-columns">
          <div><span>Supports</span><ul>${thesis.supports.map((item) => `<li>${esc(item)}</li>`).join("")}</ul></div>
          <div><span>Contradicts</span><ul>${thesis.contradictions.map((item) => `<li>${esc(item)}</li>`).join("")}</ul></div>
        </div>
      </article>
    `).join("");
  }

  function renderNext(data) {
    byId("forwardHeading").textContent = `Toward ${data.next.forwardState.toLowerCase()}`;
    byId("backwardHeading").textContent = `Back toward ${data.next.backwardState.toLowerCase()}`;
    byId("forwardList").innerHTML = data.next.forward.map((item) => `<li>${esc(item)}</li>`).join("");
    byId("backwardList").innerHTML = data.next.backward.map((item) => `<li>${esc(item)}</li>`).join("");
    byId("falsifierList").innerHTML = data.falsifiers.map((item) => `<li>${esc(item)}</li>`).join("");
  }

  function renderOptions(data) {
    const options = data.optionsPressure;
    byId("optionsNote").textContent = `${compact.format(options.selectedCallVolume)} calls versus ${compact.format(options.selectedPutVolume)} puts across selected expirations through ${formatDate(options.selectedExpirationsThrough)}. Open interest is not same-day positioning.`;
    const maxVolume = Math.max(...options.concentrations.map((item) => item.volume));
    const underlying = options.underlying;
    byId("strikeMap").innerHTML = `
      <div class="price-marker"><span>Price ${money.format(underlying)}</span><i></i><span>spot</span></div>
      ${options.concentrations.map((item) => {
        const near = Number.isFinite(underlying) && Number.isFinite(item.strike) && Math.abs(item.strike - underlying) <= 1.25;
        return `<div class="strike-row ${near ? "is-near" : ""}">
          <span class="strike-label"><b>${money.format(item.strike)} C</b><small>${esc(item.expiration.slice(5))} expiry</small></span>
          <span class="strike-track"><i class="strike-fill" style="width:${(Number.isFinite(item.volume) && maxVolume > 0 ? Math.max(2, item.volume / maxVolume * 100) : 0).toFixed(1)}%"></i></span>
          <span class="strike-values"><b>${compact.format(item.volume)} vol</b><small>${compact.format(item.openInterest)} OI</small></span>
        </div>`;
      }).join("")}`;
  }

  function renderCapital(data) {
    const supply = data.supplyPressure;
    const items = [
      ["Shares outstanding", compact.format(supply.sharesOutstanding), `Effective ${formatDate(supply.sharesEffectiveAt)}`, false],
      ["Recent note-exchange issuance", `+${compact.format(supply.recentNoteExchangeShares)}`, "Immediate supply already issued", true],
      ["Warrants", `Up to ${compact.format(supply.warrantSharesPotential)}`, `${money.format(supply.warrantStrike)} strike · expires ${formatDate(supply.warrantExpiry)}`, true],
      ["Convertible principal", compact.format(supply.remainingConvertiblePrincipal).replace("B", "B") + " USD", "Conversion and hedging effects are conditional", true],
      ["Authorized common shares", compact.format(supply.authorizedShares), "Authorization is capacity, not issued supply", true],
      ["Unused repurchase authorization", compact.format(supply.repurchaseAuthorization).replace("B", "B") + " USD", "Potential sink; no repurchases reported", false],
    ];
    byId("capitalStack").innerHTML = items.map(([label, value, note, risk]) => `<div class="capital-item ${risk ? "is-risk" : ""}"><span>${esc(label)}</span><b>${esc(value)}</b><small>${esc(note)}</small></div>`).join("");
    byId("capitalNote").textContent = supply.note;
  }

  function renderEvents(data) {
    byId("eventGrid").innerHTML = data.upcomingCatalysts.map((event) => `<article class="event-item">
      <time>${event.date ? esc(formatDate(event.date)) : "Date verified at run time"}</time>
      <h4>${esc(event.title)}</h4>
      <p>${esc(event.whyItMatters)}</p>
      <small>${esc(event.certainty.replaceAll("_", " "))}</small>
    </article>`).join("");
  }

  function computedFreshness(source) {
    if (source.freshness === "HISTORICAL") return { label: "Historical", className: "historical" };
    const basis = source.kind === "short_interest" ? source.effectiveAt : source.observedAt;
    const hours = ageHours(basis);
    if (!Number.isFinite(hours)) return { label: "Unknown", className: "stale" };
    if (["market", "options"].includes(source.kind)) {
      if (hours > 96) return { label: `${Math.floor(hours / 24)}d old · stale`, className: "stale" };
      if (hours > 36) return { label: `${Math.floor(hours / 24)}d old · aging`, className: "aging" };
      return { label: `${Math.max(0, Math.floor(hours))}h old · recent`, className: "" };
    }
    if (source.kind === "short_interest") {
      return { label: `${Math.floor(hours / 24)}d effective lag`, className: hours > 15 * 24 ? "stale" : "aging" };
    }
    return { label: source.freshness.replaceAll("_", " "), className: source.freshness === "STALE" ? "stale" : "" };
  }

  function renderSources(data) {
    const kindLabels = {
      market: "Market",
      options: "Options",
      short_interest: "Short interest",
      catalyst: "Catalyst",
      company: "Company",
      capital_structure: "Capital structure",
      historical_context: "Historical context",
    };
    byId("sourceLedger").innerHTML = data.sources.map((source, index) => {
      const freshness = computedFreshness(source);
      return `<div class="ledger-row ${index >= 6 ? "is-hidden" : ""}" data-extra-source>
          <span><b>${esc(kindLabels[source.kind] ?? source.kind)}</b><small>${esc(source.id)}</small></span>
          <span>${esc(source.name)}<small>${esc(source.limitations)}</small></span>
          <span>${esc(formatDateTime(source.effectiveAt))}</span>
          <span class="freshness ${freshness.className}">${esc(freshness.label)}</span>
          <span><a href="${esc(safeUrl(source.url))}" target="_blank" rel="noopener noreferrer">Tier ${source.tier} source ↗</a><small>Observed ${esc(formatDateTime(source.observedAt))}</small></span>
        </div>`;
    }).join("");
  }

  function renderHistory(data, history, events, snapshots, eventItems) {
    const items = [
      ...(history.entries ?? []).map((entry) => ({
        id: `live-${entry.date}`,
        date: entry.date,
        state: entry.state,
        title: entry.title,
        subtitle: "Canonical live snapshot",
        kind: "LIVE",
        snapshot: snapshots.get(entry.snapshot),
        importantEventIds: entry.importantEventIds ?? [],
      })),
      ...(events.items ?? []).map((entry) => ({
        id: `event-${entry.id}`,
        date: entry.occurredAt.slice(0, 10),
        state: eventItems.get(entry.id)?.stateAfter ?? "UNRECORDED",
        title: entry.title,
        subtitle: `${entry.category.replaceAll("_", " ")} · material thesis event`,
        kind: "EVENT",
        event: eventItems.get(entry.id),
      })),
      ...(history.retrospectiveRegimes ?? []).map((entry) => ({
        id: `retro-${entry.period}`,
        date: entry.period,
        state: entry.state,
        title: entry.label,
        subtitle: entry.warning,
        kind: "RETROSPECTIVE",
      })),
    ];
    byId("historyRail").innerHTML = items.map((item, index) => `<button class="history-event ${index === 0 ? "is-active" : ""}" type="button" role="listitem" data-history="${esc(item.id)}"><time>${esc(item.date)}</time><span><b>${esc(item.state)} · ${esc(item.title)}</b><small>${esc(item.subtitle)}</small></span></button>`).join("");

    const show = (id) => {
      const item = items.find((candidate) => candidate.id === id) ?? items[0];
      document.querySelectorAll("[data-history]").forEach((button) => button.classList.toggle("is-active", button.dataset.history === item.id));
      if (item.kind === "LIVE") {
        const snapshot = item.snapshot;
        byId("historyDetail").innerHTML = snapshot
          ? `<span class="history-badge">Canonical · immutable snapshot</span><h3>${esc(snapshot.state.label)}</h3><p>${esc(snapshot.interpretation)}</p><div class="history-facts"><div><span>What changed</span><b>${esc(snapshot.whatChanged.strengthening[0])}</b></div><div><span>Primary limit</span><b>${esc(snapshot.whatChanged.unknown[0])}</b></div><div><span>Next gate</span><b>${esc(snapshot.next.forward[0])}</b></div></div>`
          : `<span class="history-badge">Snapshot unavailable</span><h3>${esc(item.title)}</h3><p>This immutable observation could not be loaded, so the Watch will not reconstruct it from current data.</p>`;
      } else if (item.kind === "EVENT") {
        const event = item.event;
        const sourceById = new Map(data.sources.map((source) => [source.id, source]));
        const sources = (event?.sourceIds ?? []).map((id) => sourceById.get(id)).filter(Boolean);
        byId("historyDetail").innerHTML = event
          ? `<span class="history-badge">${esc(event.type.replaceAll("_", " "))}</span><h3>${esc(event.title)}</h3><p>${esc(event.mechanism)} ${esc(event.stateEffect)}</p><div class="history-facts"><div><span>State before → after</span><b>${esc(event.stateBefore)} → ${esc(event.stateAfter)}</b></div><div><span>Observed then</span><b>${esc(event.observations[0])}</b></div><div><span>Source</span><b>${sources.length ? sources.map((source) => `<a href="${esc(safeUrl(source.url))}" target="_blank" rel="noopener noreferrer">${esc(source.name)} ↗</a>`).join(" · ") : "Source unavailable"}</b></div></div>`
          : `<span class="history-badge">Event unavailable</span><h3>${esc(item.title)}</h3><p>The preserved event record could not be loaded.</p>`;
      } else {
        const is2021 = item.date === "2021-01";
        byId("historyDetail").innerHTML = `<span class="history-badge">Retrospective context · not a live reconstruction</span><h3>${esc(item.title)}</h3><p>${esc(item.subtitle)} ${is2021 ? esc(data.historicalComparison.warning) : "The current Watch will not backfill a state as though it had observed unavailable data at the time."}</p><div class="history-facts"><div><span>Regime label</span><b>${esc(item.state)}</b></div><div><span>Use</span><b>Mechanism benchmark</b></div><div><span>Prediction value</span><b>None asserted</b></div></div>`;
      }
    };
    document.querySelectorAll("[data-history]").forEach((button) => button.addEventListener("click", () => show(button.dataset.history)));
    show(items[0]?.id);
  }

  function bindInteractions() {
    document.querySelectorAll("[data-engine-target]").forEach((button) => {
      button.addEventListener("click", () => byId(`engine-${button.dataset.engineTarget}`)?.scrollIntoView({ behavior: "smooth", block: "center" }));
    });
    byId("toggleSources").addEventListener("click", (event) => {
      const button = event.currentTarget;
      const expanded = button.getAttribute("aria-expanded") === "true";
      button.setAttribute("aria-expanded", String(!expanded));
      button.textContent = expanded ? "Show every source" : "Show fewer sources";
      document.querySelectorAll("[data-extra-source]").forEach((row, index) => {
        if (index >= 6) row.classList.toggle("is-hidden", expanded);
      });
    });
  }

  function showFailure(error) {
    byId("dataCondition").textContent = "Evidence unavailable";
    byId("observedAt").textContent = "The Watch failed closed";
    byId("heroAnswer").textContent = "The current evidence contract could not be loaded. No state is being inferred from missing data.";
    byId("stateLevel").textContent = "STATE UNKNOWN";
    byId("stateLabel").textContent = "Unavailable";
    byId("stateSummary").textContent = "A provider or snapshot failure reduced confidence to zero. Retry later or inspect the canonical data source.";
    byId("confidenceChip").textContent = "Confidence unavailable";
    byId("fieldState").textContent = "Unavailable";
    byId("stateMetrics").replaceChildren();
    document.querySelectorAll(".pressure-field, .change-panel, .ladder, .section").forEach((element) => { element.hidden = true; });
    console.error("GME Watch data failure", error);
  }

  async function init() {
    try {
      const { current, history, health, events, snapshots, eventItems, source } = await loadData();
      renderHeader(current, health, source);
      renderState(current);
      renderRelationships(current);
      renderChanges(current);
      renderEngines(current);
      renderTheses(current);
      renderNext(current);
      renderOptions(current);
      renderCapital(current);
      renderEvents(current);
      renderSources(current);
      renderHistory(current, history, events, snapshots, eventItems);
      bindInteractions();
    } catch (error) {
      showFailure(error);
    }
  }

  init();
})();
