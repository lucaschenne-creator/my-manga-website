const grid = document.getElementById("grid");
const yearEl = document.getElementById("year");

// 搜尋相關（如果 index.html 沒有這些元素，也不會炸）
const searchEl = document.getElementById("search");
const clearSearchBtn = document.getElementById("clearSearch");
const countEl = document.getElementById("count");

yearEl.textContent = new Date().getFullYear();

const DATA_URL = "data/comics.json";

// 原始資料 / 目前顯示資料
let ALL = [];
let CURRENT = [];
let debounceTimer = null;

function fallbackImgDataUrl() {
  return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" width="800" height="450">
      <rect width="100%" height="100%" fill="rgba(0,0,0,0.35)"/>
      <text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle"
        fill="rgba(255,255,255,0.75)" font-size="24" font-family="Arial">
        Image not found
      </text>
    </svg>
  `);
}

function normaliseTags(tags) {
  // 支援：["奇幻","冒險"] 或 "奇幻" 或 undefined
  if (Array.isArray(tags)) {
    return tags.map(t => String(t).trim()).filter(Boolean);
  }
  if (typeof tags === "string") {
    const t = tags.trim();
    return t ? [t] : [];
  }
  return [];
}

function renderEmptyState(messageHtml) {
  grid.innerHTML = `
    <div style="padding:16px;border:1px solid rgba(255,255,255,.12);border-radius:18px;background:rgba(255,255,255,.06);color:rgba(255,255,255,.72)">
      ${messageHtml}
    </div>
  `;
}

function setCount(shown, total) {
  if (!countEl) return;
  countEl.textContent = total ? `顯示 ${shown} / ${total}` : "";
}

function createTagWrap(tags) {
  const tagWrap = document.createElement("div");
  tagWrap.className = "tag-wrap";

  if (tags.length === 0) {
    tagWrap.style.display = "none";
    return tagWrap;
  }

  for (const t of tags) {
    const chip = document.createElement("span");
    chip.className = "tag";
    chip.textContent = t;
    tagWrap.appendChild(chip);
  }

  return tagWrap;
}

function createCard(item) {
  const titleText = item?.title ? String(item.title) : "(無標題)";
  const authorText = item?.author ? `作者：${String(item.author)}` : "作者：—";
  const url = item?.url ? String(item.url) : "#";
  const image = item?.image ? String(item.image) : fallbackImgDataUrl();
  const tags = normaliseTags(item?.tags);

  const card = document.createElement("div");
  card.className = "card";

  // clickable image
  const a = document.createElement("a");
  a.href = url;
  a.target = "_blank";
  a.rel = "noreferrer";
  a.title = "點圖片開漫畫網址";

  const img = document.createElement("img");
  img.className = "thumb";
  img.src = image;
  img.alt = titleText;
  img.onerror = () => {
    img.onerror = null;
    img.src = fallbackImgDataUrl();
  };

  a.appendChild(img);

  // card body
  const body = document.createElement("div");
  body.className = "body";

  const title = document.createElement("p");
  title.className = "title";
  title.textContent = titleText;

  const author = document.createElement("p");
  author.className = "author";
  author.textContent = authorText;

  const tagWrap = createTagWrap(tags);

  body.appendChild(title);
  body.appendChild(author);
  body.appendChild(tagWrap);

  card.appendChild(a);
  card.appendChild(body);

  return card;
}

function render(list, { emptyMsg } = {}) {
  grid.innerHTML = "";

  if (!Array.isArray(list) || list.length === 0) {
    renderEmptyState(emptyMsg || `目前沒有資料～去 <code>data/comics.json</code> 加幾筆就會出現 😆`);
    setCount(0, ALL.length);
    return;
  }

  // 確保有基本欄位才渲染（避免壞資料直接炸掉）
  const safeList = list.filter(x => x && typeof x === "object");

  if (safeList.length === 0) {
    renderEmptyState(`資料格式怪怪的耶 🤔 請確認 <code>data/comics.json</code> 是陣列，而且每筆是物件。`);
    setCount(0, ALL.length);
    return;
  }

  const frag = document.createDocumentFragment();
  for (const item of safeList) {
    frag.appendChild(createCard(item));
  }
  grid.appendChild(frag);

  setCount(safeList.length, ALL.length);
}

/* ---------------- 搜尋功能 ---------------- */

function buildSearchText(item) {
  const title = item?.title ? String(item.title) : "";
  const author = item?.author ? String(item.author) : "";
  const tags = normaliseTags(item?.tags).join(" ");
  return `${title} ${author} ${tags}`.toLowerCase();
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (m) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[m]));
}

function applySearch(query) {
  const q = (query || "").trim().toLowerCase();

  if (!q) {
    CURRENT = ALL;
    render(CURRENT);
    return;
  }

  const filtered = ALL.filter(item => buildSearchText(item).includes(q));
  CURRENT = filtered;

  render(CURRENT, {
    emptyMsg: `找不到符合 <b>${escapeHtml(query)}</b> 的結果 😭（可以試試作者或 tag）`
  });
}

function wireSearchUI() {
  // 如果頁面沒有搜尋欄，就不綁定（不報錯）
  if (!searchEl) return;

  searchEl.addEventListener("input", () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      applySearch(searchEl.value);
    }, 120);
  });

  if (clearSearchBtn) {
    clearSearchBtn.addEventListener("click", () => {
      searchEl.value = "";
      applySearch("");
      searchEl.focus();
    });
  }
}

/* ---------------- 資料載入 ---------------- */

async function loadData() {
  try {
    const res = await fetch(DATA_URL, { cache: "no-store" });
    if (!res.ok) throw new Error(`讀取失敗：HTTP ${res.status}`);

    const data = await res.json();

    ALL = Array.isArray(data) ? data : [];
    CURRENT = ALL;

    wireSearchUI();
    render(CURRENT);
  } catch (err) {
    console.error(err);

    ALL = [];
    CURRENT = [];

    render([], { emptyMsg: `目前沒有資料～去 <code>data/comics.json</code> 加幾筆就會出現 😆` });
    grid.insertAdjacentHTML("afterbegin", `
      <div style="margin-bottom:12px;color:#ffb4b4;font-size:13px;">
        無法讀取 <code>${DATA_URL}</code>。如果你是直接雙擊用 <code>file://</code> 開，瀏覽器通常會擋 fetch。
        請用 VSCode Live Server 或 GitHub Pages 開啟。
      </div>
    `);
  }
}

loadData();
