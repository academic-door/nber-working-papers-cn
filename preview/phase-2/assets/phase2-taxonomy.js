(() => {
  const PAGE_SIZE = 40;
  const FILTER_PARAMS = ["program", "jel", "collection"];
  const $ = (id) => document.getElementById(id);

  const state = {
    manifest: null,
    programs: null,
    jels: null,
    topics: null,
    collections: null,
    year: "",
    filter: null,
    page: 1,
    taxonomyYearCache: new Map(),
    searchYearCache: new Map(),
  };

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  }

  async function loadJson(path) {
    const response = await fetch(path, { cache: "default" });
    if (!response.ok) throw new Error(`加载失败：${path} (${response.status})`);
    return response.json();
  }

  function countForYear(item, year) {
    return Number((item.years || {})[year] || 0);
  }

  function numberText(value) {
    return Number(value || 0).toLocaleString("en-US");
  }

  function filterTypeLabel(type) {
    if (type === "program") return "NBER 研究项目";
    if (type === "jel") return "JEL 分类";
    return "学术传送门专题";
  }

  function filterExists(filter) {
    if (!filter) return false;
    if (filter.type === "program") return (state.programs.items || []).some((row) => row.code === filter.key);
    if (filter.type === "jel") return (state.jels.items || []).some((row) => row.code === filter.key);
    if (filter.type === "collection") return (state.collections.items || []).some((row) => row.id === filter.key);
    return false;
  }

  function filterLabel(filter) {
    if (filter.type === "program") {
      const item = (state.programs.items || []).find((row) => row.code === filter.key);
      return { title: item?.name || filter.key, code: item?.code || filter.key };
    }
    if (filter.type === "jel") {
      const item = (state.jels.items || []).find((row) => row.code === filter.key);
      return { title: item ? `${item.code} · ${item.name}` : filter.key, code: item?.code || filter.key };
    }
    const item = (state.collections.items || []).find((row) => row.id === filter.key);
    return { title: item?.name || filter.key, code: item?.id || filter.key };
  }

  function cardButton({ type, key, title, subtitle, total, current }) {
    const active = state.filter?.type === type && state.filter?.key === key;
    return `<button type="button" class="taxonomy-card${active ? " active" : ""}" data-type="${escapeHtml(type)}" data-key="${escapeHtml(key)}" aria-pressed="${active ? "true" : "false"}">
      <strong>${escapeHtml(title)}</strong>
      ${subtitle ? `<small>${escapeHtml(subtitle)}</small>` : ""}
      <div class="taxonomy-card-counts"><b>${escapeHtml(state.year)} · ${numberText(current)}</b><span>全库 ${numberText(total)}</span></div>
    </button>`;
  }

  function renderPrograms() {
    $("programGrid").innerHTML = (state.programs.items || []).map((item) => cardButton({
      type: "program",
      key: item.code,
      title: item.name,
      subtitle: item.code,
      total: item.papers,
      current: countForYear(item, state.year),
    })).join("");
  }

  function renderJels() {
    $("jelGrid").innerHTML = (state.jels.items || []).map((item) => cardButton({
      type: "jel",
      key: item.code,
      title: `${item.code} · ${item.name}`,
      subtitle: "",
      total: item.papers,
      current: countForYear(item, state.year),
    })).join("");
  }

  function renderCollections() {
    $("collectionGrid").innerHTML = (state.collections.items || []).map((item) => cardButton({
      type: "collection",
      key: item.id,
      title: item.name,
      subtitle: "",
      total: item.papers,
      current: countForYear(item, state.year),
    })).join("");
  }

  function renderTopics() {
    $("topicsGrid").innerHTML = (state.topics.items || []).map((item) => `<details class="topic-reference-card">
      <summary>${escapeHtml(item.name)}<span>${(item.children || []).length} 个子类</span></summary>
      <div>${(item.children || []).map((child) => `<span>${escapeHtml(child)}</span>`).join("")}</div>
    </details>`).join("");
  }

  function renderAllCards() {
    renderPrograms();
    renderJels();
    renderCollections();
    bindCardClicks();
  }

  function renderCounts() {
    $("corpusCount").textContent = numberText(state.manifest.canonical_unique);
  }

  async function loadTaxonomyYear(year) {
    if (!state.taxonomyYearCache.has(year)) {
      state.taxonomyYearCache.set(year, loadJson(`data/taxonomy/papers/${year}.json`));
    }
    return state.taxonomyYearCache.get(year);
  }

  async function loadSearchYear(year) {
    if (!state.searchYearCache.has(year)) {
      state.searchYearCache.set(year, loadJson(`data/search/weekly/${year}.json`));
    }
    return state.searchYearCache.get(year);
  }

  function matches(row, filter) {
    if (filter.type === "program") return (row.program_codes || []).includes(filter.key);
    if (filter.type === "jel") return (row.jel_families || []).includes(filter.key);
    if (filter.type === "collection") return (row.collections || []).includes(filter.key);
    return false;
  }

  function researchReturnUrl() {
    const params = new URLSearchParams();
    params.set("year", state.year);
    if (state.filter) params.set(state.filter.type, state.filter.key);
    if (state.page > 1) params.set("page", String(state.page));
    return `../research.html?${params.toString()}`;
  }

  function paperCard(paper, taxonomy) {
    const programs = (taxonomy.program_codes || []).map((code) => {
      const item = (state.programs.items || []).find((row) => row.code === code);
      return item?.name || code;
    });
    const jels = taxonomy.jel_codes || [];
    const detailBase = paper.detail_url || `papers/w${encodeURIComponent(paper.number)}.html`;
    const separator = detailBase.includes("?") ? "&" : "?";
    const detailUrl = `${detailBase}${separator}return=${encodeURIComponent(researchReturnUrl())}`;
    return `<article class="paper-card taxonomy-paper">
      <div class="taxonomy-paper-top"><span>${escapeHtml(paper.week_date || "")}</span><a href="${escapeHtml(paper.url || "")}" target="_blank" rel="noopener">NBER w${escapeHtml(paper.number)}</a></div>
      <h3><a href="${escapeHtml(detailUrl)}">${escapeHtml(paper.title)}</a></h3>
      ${paper.zh_title ? `<p class="taxonomy-zh-title">${escapeHtml(paper.zh_title)}</p>` : ""}
      <p class="taxonomy-authors">${escapeHtml(paper.authors || "")}</p>
      <div class="taxonomy-tags">
        ${programs.map((name) => `<span class="program-tag">${escapeHtml(name)}</span>`).join("")}
        ${jels.map((code) => `<span class="jel-tag">${escapeHtml(code)}</span>`).join("")}
        ${(taxonomy.collections || []).includes("china") ? '<span class="collection-tag">中国相关</span>' : ""}
      </div>
      ${paper.zh_abstract_excerpt ? `<p class="taxonomy-excerpt">${escapeHtml(paper.zh_abstract_excerpt)}</p>` : ""}
    </article>`;
  }

  function readLocationState() {
    const params = new URLSearchParams(window.location.search);
    const validYears = new Set((state.manifest.years || []).map((item) => String(item.year)));
    const requestedYear = params.get("year");
    state.year = requestedYear && validYears.has(requestedYear)
      ? requestedYear
      : String((state.manifest.years || []).map((item) => String(item.year)).sort((a, b) => Number(b) - Number(a))[0] || "");

    let nextFilter = null;
    for (const type of FILTER_PARAMS) {
      const key = params.get(type);
      if (key) {
        nextFilter = { type, key };
        break;
      }
    }
    state.filter = filterExists(nextFilter) ? nextFilter : null;

    const requestedPage = Number(params.get("page") || "1");
    state.page = Number.isInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  }

  function writeLocationState(mode = "push") {
    const url = new URL(window.location.href);
    url.search = "";
    if (state.year) url.searchParams.set("year", state.year);
    if (state.filter) url.searchParams.set(state.filter.type, state.filter.key);
    if (state.filter && state.page > 1) url.searchParams.set("page", String(state.page));
    window.history[mode === "replace" ? "replaceState" : "pushState"]({}, "", url);
  }

  function prefersReducedMotion() {
    return window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  function moveToResults() {
    const section = $("taxonomyResultsSection");
    $("resultTitle").focus({ preventScroll: true });
    section.scrollIntoView({ behavior: prefersReducedMotion() ? "auto" : "smooth", block: "start" });
  }

  function moveToActiveFilter() {
    const active = document.querySelector(".taxonomy-card.active");
    if (!active) return;
    active.focus({ preventScroll: true });
    active.scrollIntoView({ behavior: prefersReducedMotion() ? "auto" : "smooth", block: "center" });
  }

  function updateActiveCards() {
    document.querySelectorAll(".taxonomy-card[data-type]").forEach((node) => {
      const active = state.filter?.type === node.dataset.type && state.filter?.key === node.dataset.key;
      node.classList.toggle("active", Boolean(active));
      node.setAttribute("aria-pressed", active ? "true" : "false");
    });
  }

  function setResultError(error) {
    $("taxonomyResultErrorMessage").textContent = error?.message || String(error);
    $("taxonomyResultError").hidden = false;
    $("taxonomyPaperList").innerHTML = "";
    $("taxonomyPagination").hidden = true;
    $("taxonomyStatus").textContent = "论文列表加载失败。";
  }

  function clearResultError() {
    $("taxonomyResultError").hidden = true;
    $("taxonomyResultErrorMessage").textContent = "";
  }

  async function renderResults({ focus = false, scroll = false } = {}) {
    if (!state.filter) {
      $("taxonomyResultsSection").hidden = true;
      $("taxonomyStatus").textContent = "";
      return;
    }

    const section = $("taxonomyResultsSection");
    section.hidden = false;
    clearResultError();
    $("taxonomyPaperList").innerHTML = '<p class="taxonomy-loading">正在加载论文…</p>';
    $("taxonomyPagination").hidden = true;
    $("taxonomyStatus").textContent = "正在加载论文…";

    try {
      const [taxonomyRows, searchRows] = await Promise.all([
        loadTaxonomyYear(state.year),
        loadSearchYear(state.year),
      ]);
      const taxByNumber = new Map(taxonomyRows.map((row) => [String(row.number), row]));
      const matchedTax = taxonomyRows.filter((row) => matches(row, state.filter));
      const allowed = new Set(matchedTax.map((row) => String(row.number)));
      const papers = searchRows
        .filter((row) => allowed.has(String(row.number)))
        .sort((a, b) => String(b.week_date || "").localeCompare(String(a.week_date || "")) || Number(a.index || 0) - Number(b.index || 0));

      const totalPages = Math.max(1, Math.ceil(papers.length / PAGE_SIZE));
      state.page = Math.min(Math.max(1, state.page), totalPages);
      writeLocationState("replace");

      const start = (state.page - 1) * PAGE_SIZE;
      const visible = papers.slice(start, start + PAGE_SIZE);
      const label = filterLabel(state.filter);

      $("resultContext").textContent = `${filterTypeLabel(state.filter.type)} · ${state.year} 年`;
      $("resultTitle").textContent = label.title;
      $("resultMeta").textContent = papers.length
        ? `${numberText(papers.length)} 篇 · 第 ${state.page} / ${totalPages} 页`
        : "当前年份没有匹配论文。";

      $("taxonomyPaperList").innerHTML = visible.length
        ? visible.map((paper) => paperCard(paper, taxByNumber.get(String(paper.number)) || {})).join("")
        : '<p class="taxonomy-empty">当前年份没有匹配论文。</p>';

      $("taxonomyPagination").hidden = papers.length <= PAGE_SIZE;
      $("taxonomyPrevPage").disabled = state.page <= 1;
      $("taxonomyNextPage").disabled = state.page >= totalPages;
      $("taxonomyPageInfo").textContent = `第 ${state.page} / ${totalPages} 页`;
      $("taxonomyStatus").textContent = `${label.title}：${state.year} 年共 ${numberText(papers.length)} 篇论文。`;

      if (focus || scroll) moveToResults();
    } catch (error) {
      setResultError(error);
      if (focus || scroll) moveToResults();
    }
  }

  async function updateJelEraNote() {
    try {
      const rows = await loadTaxonomyYear(state.year);
      $("jelHistoricalNote").hidden = !rows.some((row) => row.jel_scheme === "legacy_numeric" || row.jel_scheme === "mixed");
    } catch {
      $("jelHistoricalNote").hidden = true;
    }
  }

  function bindCardClicks() {
    document.querySelectorAll(".taxonomy-card[data-type]").forEach((node) => {
      node.addEventListener("click", () => {
        state.filter = { type: node.dataset.type, key: node.dataset.key };
        state.page = 1;
        updateActiveCards();
        writeLocationState("push");
        renderResults({ focus: true, scroll: true });
      });
    });
  }

  function showFatal(error) {
    $("taxonomyFatalMessage").textContent = error?.message
      ? `${error.message}。请稍后重试，或使用站内搜索继续查找论文。`
      : "请稍后重试，或使用站内搜索继续查找论文。";
    $("taxonomyFatal").hidden = false;
    $("taxonomyStatus").textContent = "";
  }

  function prefetchLatest() {
    const task = () => Promise.allSettled([loadTaxonomyYear(state.year), loadSearchYear(state.year)]);
    if ("requestIdleCallback" in window) window.requestIdleCallback(task, { timeout: 1800 });
    else window.setTimeout(task, 900);
  }

  async function init() {
    $("taxonomyFatal").hidden = true;
    [state.manifest, state.programs, state.jels, state.topics, state.collections] = await Promise.all([
      loadJson("data/taxonomy/manifest.json"),
      loadJson("data/taxonomy/programs.json"),
      loadJson("data/taxonomy/jel_families.json"),
      loadJson("data/taxonomy/nber_topics_reference.json"),
      loadJson("data/taxonomy/collections.json"),
    ]);

    const years = (state.manifest.years || [])
      .map((item) => String(item.year))
      .filter((year) => /^\d{4}$/.test(year))
      .sort((a, b) => Number(b) - Number(a));

    $("taxonomyYear").innerHTML = years.map((year) => `<option value="${year}">${year}</option>`).join("");
    readLocationState();
    $("taxonomyYear").value = state.year;

    renderCounts();
    renderTopics();
    renderAllCards();
    await updateJelEraNote();

    $("taxonomyYear").addEventListener("change", async () => {
      state.year = $("taxonomyYear").value;
      state.page = 1;
      renderAllCards();
      writeLocationState("push");
      await updateJelEraNote();
      if (state.filter) await renderResults({ focus: true, scroll: true });
    });

    $("clearTaxonomyFilter").addEventListener("click", () => {
      state.filter = null;
      state.page = 1;
      updateActiveCards();
      writeLocationState("push");
      $("taxonomyResultsSection").hidden = true;
      $("taxonomyStatus").textContent = "已清除分类筛选。";
    });

    $("changeTaxonomyFilter").addEventListener("click", moveToActiveFilter);
    $("retryTaxonomy").addEventListener("click", () => window.location.reload());
    $("retryTaxonomyResults").addEventListener("click", () => renderResults({ focus: true, scroll: false }));

    $("taxonomyPrevPage").addEventListener("click", () => {
      if (state.page <= 1) return;
      state.page -= 1;
      writeLocationState("push");
      renderResults({ focus: true, scroll: true });
    });

    $("taxonomyNextPage").addEventListener("click", () => {
      state.page += 1;
      writeLocationState("push");
      renderResults({ focus: true, scroll: true });
    });

    window.addEventListener("popstate", async () => {
      readLocationState();
      $("taxonomyYear").value = state.year;
      renderAllCards();
      await updateJelEraNote();
      await renderResults({ focus: false, scroll: false });
    });

    if (state.filter) await renderResults({ focus: false, scroll: false });
    else writeLocationState("replace");

    prefetchLatest();
  }

  init().catch(showFatal);
})();
