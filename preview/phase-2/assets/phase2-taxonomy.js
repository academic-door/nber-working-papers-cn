(() => {
  const $ = (id) => document.getElementById(id);
  const state = {
    manifest: null,
    programs: null,
    jels: null,
    topics: null,
    collections: null,
    year: "",
    filter: null,
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

  function cardButton({ type, key, title, subtitle, total, current }) {
    return `<button type="button" class="taxonomy-card" data-type="${escapeHtml(type)}" data-key="${escapeHtml(key)}">
      <strong>${escapeHtml(title)}</strong>
      ${subtitle ? `<small>${escapeHtml(subtitle)}</small>` : ""}
      <div class="taxonomy-card-counts"><b>${escapeHtml(state.year)} · ${numberText(current)}</b><span>全部 ${numberText(total)}</span></div>
    </button>`;
  }

  function renderPrograms() {
    const rows = state.programs.items || [];
    $("programGrid").innerHTML = rows.map((item) => cardButton({
      type: "program",
      key: item.code,
      title: item.name,
      subtitle: item.code,
      total: item.papers,
      current: countForYear(item, state.year),
    })).join("");
  }

  function renderJels() {
    const rows = state.jels.items || [];
    $("jelGrid").innerHTML = rows.map((item) => cardButton({
      type: "jel",
      key: item.code,
      title: `${item.code} · ${item.name}`,
      subtitle: "",
      total: item.papers,
      current: countForYear(item, state.year),
    })).join("");
  }

  function renderCollections() {
    const rows = state.collections.items || [];
    $("collectionGrid").innerHTML = rows.map((item) => cardButton({
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

  function renderCounts() {
    $("corpusCount").textContent = numberText(state.manifest.canonical_unique);
    $("programCoverage").textContent = `${Number(state.manifest.coverage.program_pct).toFixed(2)}%`;
    $("jelCoverage").textContent = `${Number(state.manifest.coverage.jel_pct).toFixed(2)}%`;
  }

  function filterLabel(filter) {
    if (filter.type === "program") {
      const item = (state.programs.items || []).find((row) => row.code === filter.key);
      return { title: item?.name || filter.key };
    }
    if (filter.type === "jel") {
      const item = (state.jels.items || []).find((row) => row.code === filter.key);
      return { title: item ? `${item.code} · ${item.name}` : filter.key };
    }
    const item = (state.collections.items || []).find((row) => row.id === filter.key);
    return { title: item?.name || filter.key };
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

  function paperCard(paper, taxonomy) {
    const programs = (taxonomy.program_codes || []).map((code) => {
      const item = (state.programs.items || []).find((row) => row.code === code);
      return item?.name || code;
    });
    const jels = taxonomy.jel_codes || [];
    const detailUrl = paper.detail_url || `papers/w${encodeURIComponent(paper.number)}.html`;
    return `<article class="taxonomy-paper">
      <div class="taxonomy-paper-top"><span>${escapeHtml(paper.week_date || "")}</span><a href="${escapeHtml(paper.url || "")}" target="_blank" rel="noopener">NBER w${escapeHtml(paper.number)}</a></div>
      <h3><a href="${escapeHtml(detailUrl)}">${escapeHtml(paper.title)}</a></h3>
      ${paper.zh_title ? `<p class="taxonomy-zh-title">${escapeHtml(paper.zh_title)}</p>` : ""}
      <p class="taxonomy-authors">${escapeHtml(paper.authors || "")}</p>
      <div class="taxonomy-tags">
        ${programs.map((name) => `<span class="program-tag">${escapeHtml(name)}</span>`).join("")}
        ${jels.slice(0, 8).map((code) => `<span class="jel-tag">${escapeHtml(code)}</span>`).join("")}
        ${(taxonomy.collections || []).includes("china") ? '<span class="collection-tag">中国相关</span>' : ""}
      </div>
      ${paper.zh_abstract_excerpt ? `<p class="taxonomy-excerpt">${escapeHtml(paper.zh_abstract_excerpt)}</p>` : ""}
    </article>`;
  }

  async function renderResults() {
    if (!state.filter) {
      $("taxonomyResultsSection").hidden = true;
      return;
    }
    const section = $("taxonomyResultsSection");
    section.hidden = false;
    $("taxonomyPaperList").innerHTML = '<p class="taxonomy-loading">正在加载论文…</p>';
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

    const label = filterLabel(state.filter);
    $("resultTitle").textContent = label.title;
    $("resultMeta").textContent = `${state.year} 年 · ${numberText(papers.length)} 篇`;

    const visible = papers.slice(0, 80);
    $("taxonomyPaperList").innerHTML = visible.length
      ? visible.map((paper) => paperCard(paper, taxByNumber.get(String(paper.number)) || {})).join("")
      : '<p class="taxonomy-loading">当前年份没有匹配论文。</p>';
    $("taxonomyMoreNote").textContent = papers.length > visible.length
      ? `当前显示前 ${visible.length} 篇，共 ${papers.length} 篇。`
      : "";
    section.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function bindCardClicks() {
    document.querySelectorAll(".taxonomy-card[data-type]").forEach((node) => {
      node.addEventListener("click", () => {
        state.filter = { type: node.dataset.type, key: node.dataset.key };
        document.querySelectorAll(".taxonomy-card.active").forEach((item) => item.classList.remove("active"));
        node.classList.add("active");
        renderResults().catch(showError);
      });
    });
  }

  function renderAllCards() {
    renderPrograms();
    renderJels();
    renderCollections();
    bindCardClicks();
  }

  function showError(error) {
    $("taxonomyMoreNote").textContent = error?.message || String(error);
  }

  function prefetchLatest() {
    const task = () => Promise.allSettled([loadTaxonomyYear(state.year), loadSearchYear(state.year)]);
    if ("requestIdleCallback" in window) window.requestIdleCallback(task, { timeout: 1800 });
    else window.setTimeout(task, 900);
  }

  async function init() {
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
    state.year = years[0] || "";
    $("taxonomyYear").innerHTML = years.map((year) => `<option value="${year}">${year}</option>`).join("");
    $("taxonomyYear").value = state.year;
    $("taxonomyYear").addEventListener("change", () => {
      state.year = $("taxonomyYear").value;
      renderAllCards();
      if (state.filter) renderResults().catch(showError);
    });
    $("clearTaxonomyFilter").addEventListener("click", () => {
      state.filter = null;
      document.querySelectorAll(".taxonomy-card.active").forEach((item) => item.classList.remove("active"));
      $("taxonomyResultsSection").hidden = true;
    });
    renderCounts();
    renderTopics();
    renderAllCards();
    prefetchLatest();
  }

  init().catch(showError);
})();
