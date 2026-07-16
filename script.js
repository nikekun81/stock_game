const SHEET_CSV_BG = "https://docs.google.com/spreadsheets/d/e/2PACX-1vQOUL8LXx-wqY6UWQkyE7XGczoefIWQF8GCyY-GGZUV9GIXXgy07nyIUf9-0Xu7yfuQhcjt4rMl_-2p/pub?gid=545391956&single=true&output=csv";
const SHEET_CSV_KM = "https://docs.google.com/spreadsheets/d/e/2PACX-1vQOUL8LXx-wqY6UWQkyE7XGczoefIWQF8GCyY-GGZUV9GIXXgy07nyIUf9-0Xu7yfuQhcjt4rMl_-2p/pub?gid=337341507&single=true&output=csv";
const TARGET_STOCK = 1652145;

function toPercent(v) {
  const str = String(v).trim();
  const hasPercentSign = str.includes("%");
  const n = Number(str.replace(",", ".").replace("%", ""));
  if (isNaN(n)) return 0;
  if (hasPercentSign) return n;
  return n <= 1 ? n * 100 : n;
}

function parseCSV(text) {
  const rows = [];
  let row = [], field = "", inQuotes = false;
  const chars = text.trim();

  for (let i = 0; i < chars.length; i++) {
    const c = chars[i];
    if (inQuotes) {
      if (c === '"' && chars[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') { inQuotes = false; }
      else { field += c; }
    } else {
      if (c === '"') { inQuotes = true; }
      else if (c === ",") { row.push(field); field = ""; }
      else if (c === "\n" || c === "\r") {
        if (c === "\r" && chars[i + 1] === "\n") { i++; }
        row.push(field);
        rows.push(row);
        row = [];
        field = "";
      } else {
        field += c;
      }
    }
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  const headers = rows[0].map(h => h.trim());
  return rows.slice(1).filter(r => r.length > 1 || r[0] !== "").map(r => {
    const obj = {};
    headers.forEach((h, i) => {
      let val = (r[i] || "").trim();
      if (/^-?\d{1,3}(,\d{3})+$/.test(val)) {
        val = val.replace(/,/g, "");
      }
      obj[h] = val;
    });
    return obj;
  });
}

async function fetchCSV(url) {
  const res = await fetch(url + "&t=" + Date.now());
  const text = await res.text();
  return parseCSV(text);
}

function medalClass(i) {
  return i === 0 ? "gold" : i === 1 ? "silver" : i === 2 ? "bronze" : "";
}

function medalIcon(i) {
  return i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : "▫️";
}

// --- Ачивки ---

function getAchievementStore(key) {
  const raw = localStorage.getItem(key);
  return raw ? JSON.parse(raw) : {};
}

function saveAchievementStore(key, store) {
  localStorage.setItem(key, JSON.stringify(store));
}

function trackAchievements(sorted, nameField, groupField, storeKey) {
  const store = getAchievementStore(storeKey);
  const now = Date.now();

  sorted.forEach(row => {
    const name = row[nameField];
    const pct = Math.round(toPercent(row["Процент"]));
    if (pct >= 100 && !store[name]) {
      store[name] = { time: now, group: groupField ? row[groupField] : name };
    }
  });

  saveAchievementStore(storeKey, store);
  return store;
}

function getFirstInGroup(store, group) {
  const entries = Object.entries(store).filter(([, v]) => v.group === group);
  if (entries.length === 0) return null;
  return entries.reduce((a, b) => (a[1].time < b[1].time ? a : b))[0];
}

function getGlobalTop3(bgStore, kmStore) {
  const all = [
    ...Object.entries(bgStore).map(([name, v]) => ({ name, time: v.time })),
    ...Object.entries(kmStore).map(([name, v]) => ({ name, time: v.time }))
  ];
  return all.sort((a, b) => a.time - b.time).slice(0, 3).map(e => e.name);
}

function achievementIcons(name, group, store, globalTop3) {
  let icons = "";
  if (!(name in store)) return icons;

  const firstInGroup = getFirstInGroup(store, group);
  if (name === firstInGroup) icons += "👑";

  const rank = globalTop3.indexOf(name);
  if (rank === 0) icons += " 💎💎💎";
  else if (rank === 1) icons += " 💎💎";
  else if (rank === 2) icons += " 💎";

  return icons;
}

function getTopByField(data, field) {
  let top = null;
  let maxVal = -Infinity;
  data.forEach(row => {
    const val = Number(String(row[field]).replace(/,/g, "")) || 0;
    if (val > maxVal) {
      maxVal = val;
      top = row;
    }
  });
  return top;
}

// Столбец "ИНН" на листе Рейтинг_КМ хранит готовое количество продавцов на менеджера.
function countSellers(row, field) {
  const raw = String(row[field] || "").trim();
  if (raw === "") return 0;
  if (/^\d+$/.test(raw)) return Number(raw);
  return raw.split(/[,;\s]+/).filter(v => v.trim() !== "").length;
}

function getTopSellers(data, field) {
  let top = null;
  let maxVal = -Infinity;
  data.forEach(row => {
    const val = countSellers(row, field);
    if (val > maxVal) {
      maxVal = val;
      top = row;
    }
  });
  return top;
}

// --- Рендер ---

async function loadData() {
  try {
    const bgData = await fetchCSV(SHEET_CSV_BG);
    const kmData = await fetchCSV(SHEET_CSV_KM);

    renderProgress(bgData);

    const bgStorePreview = trackAchievements(bgData, "БГ", null, "achievements_BG");
    const kmStorePreview = trackAchievements(kmData, "КМ", "БГ", "achievements_KM");
    const globalTop3 = getGlobalTop3(bgStorePreview, kmStorePreview);

    renderRankedCards(bgData, "bg-cards", "БГ", null, "achievements_BG", globalTop3, "Закрыто_шт", null);
    renderRankedCards(kmData, "km-cards", "КМ", "БГ", "achievements_KM", globalTop3, "Закрыто_шт", "ИНН");

    document.getElementById("last-update").textContent = new Date().toLocaleTimeString("ru-RU");
  } catch (e) {
    console.error("Ошибка загрузки данных:", e);
  }
}

function renderProgress(bgData) {
  const totalClosed = bgData.reduce((sum, r) => sum + Number(r["Закрыто_шт"] || 0), 0);
  const percent = Math.min(100, Math.round((totalClosed / TARGET_STOCK) * 100));
  document.getElementById("progress-fill").style.width = percent + "%";
  document.getElementById("progress-percent").textContent = percent + "%";
  document.getElementById("progress-left").textContent = "Осталось: " + Math.max(0, TARGET_STOCK - totalClosed) + " шт.";
}

function renderRankedCards(data, containerId, nameField, groupField, storeKey, globalTop3, qtyField, sellersField) {
  const sorted = [...data].sort((a, b) => toPercent(b["Процент"]) - toPercent(a["Процент"]));
  const store = trackAchievements(sorted, nameField, groupField, storeKey);
  const container = document.getElementById(containerId);
  container.innerHTML = "";

  const topQty = qtyField ? getTopByField(data, qtyField) : null;
  const topSellers = sellersField ? getTopSellers(data, sellersField) : null;

  sorted.forEach((row, i) => {
    const pct = Math.round(toPercent(row["Процент"]));
    const group = groupField ? row[groupField] : row[nameField];
    let achievement = achievementIcons(row[nameField], group, store, globalTop3);

    if (topQty && row[nameField] === topQty[nameField]) achievement += " 🏋️";
    if (topSellers && row[nameField] === topSellers[nameField]) achievement += " 🐙";

    const div = document.createElement("div");
    div.className = "card " + medalClass(i);
    div.innerHTML = `
      <div class="card-name"><span class="card-medal">${medalIcon(i)}</span>${row[nameField]} <span class="card-achievement">${achievement}</span></div>
      <div class="card-percent">${pct}%</div>
    `;
    container.appendChild(div);
  });

  return sorted;
}

loadData();
setInterval(loadData, 60000);

const rulesBtn = document.getElementById("rules-btn");
const modalOverlay = document.getElementById("modal-overlay");
const modalClose = document.getElementById("modal-close");

rulesBtn.addEventListener("click", () => {
  modalOverlay.classList.add("active");
});

modalClose.addEventListener("click", () => {
  modalOverlay.classList.remove("active");
});

modalOverlay.addEventListener("click", (e) => {
  if (e.target === modalOverlay) {
    modalOverlay.classList.remove("active");
  }
});
