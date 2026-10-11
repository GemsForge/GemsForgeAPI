const state = {
  domains: [],
  pages: [],
  hues: [],
  selectedDomain: null,
  editingPage: null,
  selectedHue: null,
  hueImageURL: null,
  view: "pages"
};

const domainList = document.querySelector("#domain-list");
const pageList = document.querySelector("#page-list");
const notice = document.querySelector("#notice");
const dialog = document.querySelector("#edit-dialog");
const pagesHeading = document.querySelector("#pages-heading");
const hueView = document.querySelector("#hue-view");
const hueList = document.querySelector("#hue-list");
const hueDetail = document.querySelector("#hue-detail");
const importCard = document.querySelector("#import-card");
const hueCount = document.querySelector("#hue-count");

async function request(path, options = {}) {
  const response = await fetch(path, {
    headers: { "Content-Type": "application/json", ...options.headers },
    ...options
  });

  if (!response.ok) {
    const problem = await response.json().catch(() => ({}));
    throw new Error(problem.reason || `${response.status} ${response.statusText}`);
  }

  return response.status === 204 ? null : response.json();
}

function showNotice(message, kind = "error") {
  notice.textContent = message;
  notice.className = `notice ${kind}`;
  notice.hidden = false;
  window.setTimeout(() => { notice.hidden = true; }, 4500);
}

function renderDomains() {
  domainList.innerHTML = state.domains.map(domain => `
    <button class="domain-button ${state.selectedDomain?.id === domain.id ? "selected" : ""}" data-domain-id="${domain.id}">
      <span class="domain-mark">${domain.id.slice(0, 1)}</span>
      <span><strong>${domain.title}</strong><small>${domain.id}</small></span>
      <span class="arrow">›</span>
    </button>
  `).join("");

  domainList.querySelectorAll("[data-domain-id]").forEach(button => {
    button.addEventListener("click", () => selectDomain(button.dataset.domainId));
  });
}

function setView(view) {
  state.view = view;
  const showingHues = view === "hues";
  pagesHeading.hidden = showingHues;
  pageList.hidden = showingHues;
  importCard.hidden = showingHues;
  hueView.hidden = !showingHues;
  document.querySelector("#hues-button").classList.toggle("selected", showingHues);
  if (!showingHues) {
    state.selectedHue = null;
    hueDetail.hidden = true;
  }
}

function renderHues() {
  hueCount.textContent = `${state.hues.length} records`;
  if (!state.hues.length) {
    hueList.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">●</div>
        <h3>No Gem Hues found</h3>
        <p>The API returned an empty Gem Hues table.</p>
      </div>`;
    return;
  }

  hueList.innerHTML = state.hues.map(hue => `
    <button class="hue-card ${state.selectedHue?.id === hue.id ? "selected" : ""}" data-hue-id="${escapeHTML(hue.id)}" type="button">
      <span class="hue-swatch" style="--hue-color: ${escapeHTML(hue.hexCode)}"></span>
      <span class="hue-card-copy">
        <strong>${escapeHTML(hue.colorName)}</strong>
        <small>${escapeHTML(hue.hexCode)} · ${escapeHTML(hue.colorFamily || "Unclassified")}</small>
      </span>
      <span class="arrow">›</span>
    </button>
  `).join("");

  hueList.querySelectorAll("[data-hue-id]").forEach(button => {
    button.addEventListener("click", () => loadHueDetail(button.dataset.hueId));
  });
}

function renderHueDetail() {
  const hue = state.selectedHue;
  if (!hue) {
    hueDetail.hidden = true;
    return;
  }

  hueDetail.hidden = false;
  hueDetail.innerHTML = `
    <div class="hue-detail-swatch" style="--hue-color: ${escapeHTML(hue.hexCode)}">
      ${state.hueImageURL ? `<img src="${state.hueImageURL}" alt="${escapeHTML(hue.colorName)} reference image">` : ""}
    </div>
    <div class="hue-detail-copy">
      <p class="eyebrow">Gem Hue · Foundation reference data</p>
      <h3>${escapeHTML(hue.colorName)}</h3>
      <p class="hue-code">${escapeHTML(hue.id)} · ${escapeHTML(hue.hexCode)}</p>
      <dl class="hue-fields">
        <div><dt>Color family</dt><dd>${escapeHTML(hue.colorFamily || "Not specified")}</dd></div>
        <div><dt>Mood</dt><dd>${escapeHTML(hue.mood || "Not specified")}</dd></div>
        <div><dt>Palette</dt><dd>${escapeHTML(hue.palette || "Not specified")}</dd></div>
        <div><dt>Description</dt><dd>${escapeHTML(hue.description || "Not specified")}</dd></div>
        <div><dt>Notes</dt><dd>${escapeHTML(hue.notes || "Not specified")}</dd></div>
      </dl>
    </div>
  `;
}

function renderPages() {
  if (!state.pages.length) {
    pageList.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">⌁</div>
        <h3>No ForgeKeeper pages yet</h3>
        <p>This domain is ready for pages from your Notes import workflow.</p>
      </div>`;
    return;
  }

  pageList.innerHTML = state.pages.map(page => `
    <article class="page-card">
      <div class="page-card-main">
        <div class="page-meta"><span class="page-id">#${page.id}</span><span>${page.parentID ? "Child page" : "Root page"}</span></div>
        <h3>${escapeHTML(page.title)}</h3>
        <p>${escapeHTML(page.description || "No description")}</p>
      </div>
      <div class="page-actions">
        <button class="text-button" data-children-id="${page.id}">Children</button>
        <button class="primary-button small" data-edit-id="${page.id}">Edit</button>
      </div>
    </article>
  `).join("");

  pageList.querySelectorAll("[data-edit-id]").forEach(button => {
    button.addEventListener("click", () => openEditor(Number(button.dataset.editId)));
  });
  pageList.querySelectorAll("[data-children-id]").forEach(button => {
    button.addEventListener("click", () => loadChildren(Number(button.dataset.childrenId)));
  });
}

function escapeHTML(value) {
  return String(value).replace(/[&<>'"]/g, character => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;"
  }[character]));
}

async function loadDomains() {
  state.domains = await request("/domains");
  renderDomains();
  if (state.selectedDomain) {
    await selectDomain(state.selectedDomain.id);
  }
}

async function loadHues() {
  state.hues = await request("/gemhues");
  renderHues();
  if (state.selectedHue) await loadHueDetail(state.selectedHue.id);
}

async function loadHueDetail(hueID) {
  state.selectedHue = await request(`/gemhues/${encodeURIComponent(hueID)}`);
  if (state.hueImageURL) URL.revokeObjectURL(state.hueImageURL);
  state.hueImageURL = null;

  const imageResponse = await fetch(`/gemhues/${encodeURIComponent(hueID)}/image`);
  if (imageResponse.ok) {
    state.hueImageURL = URL.createObjectURL(await imageResponse.blob());
  }

  renderHues();
  renderHueDetail();
}

async function selectDomain(domainID) {
  state.selectedDomain = state.domains.find(domain => domain.id === domainID);
  renderDomains();
  document.querySelector("#selected-domain-title").textContent = state.selectedDomain.title;
  document.querySelector("#selected-domain-description").textContent = state.selectedDomain.description;
  state.pages = await request(`/domains/${encodeURIComponent(domainID)}/forgekeeper`);
  renderPages();
}

async function loadRoots() {
  state.selectedDomain = null;
  renderDomains();
  document.querySelector("#selected-domain-title").textContent = "All root pages";
  document.querySelector("#selected-domain-description").textContent = "Pages without a parent in ForgeKeeper.";
  state.pages = await request("/forgekeeper/roots");
  renderPages();
}

async function loadChildren(parentID) {
  state.pages = await request(`/forgekeeper/${parentID}/children`);
  document.querySelector("#selected-domain-title").textContent = `Children of page #${parentID}`;
  document.querySelector("#selected-domain-description").textContent = "Immediate child pages only.";
  renderPages();
}

function openEditor(id) {
  const page = state.pages.find(item => item.id === id);
  if (!page) return;
  state.editingPage = page;
  document.querySelector("#edit-id").value = page.id;
  document.querySelector("#edit-title").value = page.title;
  document.querySelector("#edit-description").value = page.description || "";
  const parentSelect = document.querySelector("#edit-parent");
  parentSelect.innerHTML = '<option value="">Root page</option>' + state.pages
    .filter(item => item.id !== page.id)
    .map(item => `<option value="${item.id}" ${item.id === page.parentID ? "selected" : ""}>${escapeHTML(item.title)}</option>`)
    .join("");
  dialog.showModal();
}

document.querySelector("#edit-form").addEventListener("submit", async event => {
  event.preventDefault();
  const pageID = document.querySelector("#edit-id").value;
  const parentValue = document.querySelector("#edit-parent").value;
  const body = {
    title: document.querySelector("#edit-title").value,
    description: document.querySelector("#edit-description").value,
    parentID: parentValue === "" ? null : Number(parentValue)
  };

  try {
    await request(`/forgekeeper/${pageID}`, { method: "PATCH", body: JSON.stringify(body) });
    dialog.close();
    showNotice("Page metadata updated.", "success");
    if (state.selectedDomain) await selectDomain(state.selectedDomain.id);
    else await loadRoots();
  } catch (error) {
    showNotice(error.message);
  }
});

document.querySelector("#refresh-button").addEventListener("click", async () => {
  try {
    if (state.view === "hues") await loadHues();
    else await loadDomains();
    showNotice("Data refreshed.", "success");
  }
  catch (error) { showNotice(error.message); }
});

document.querySelector("#hues-button").addEventListener("click", async () => {
  try {
    setView("hues");
    await loadHues();
  } catch (error) {
    showNotice(`Could not load Gem Hues: ${error.message}`);
  }
});

document.querySelector("#roots-button").addEventListener("click", async () => {
  try { await loadRoots(); }
  catch (error) { showNotice(error.message); }
});

loadDomains().catch(error => showNotice(`Could not load the API: ${error.message}`));
