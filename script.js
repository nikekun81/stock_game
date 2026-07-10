const SHEET_CSV_BG = "https://docs.google.com/spreadsheets/d/e/2PACX-1vQOUL8LXx-wqY6UWQkyE7XGczoefIWQF8GCyY-GGZUV9GIXXgy07nyIUf9-0Xu7yfuQhcjt4rMl_-2p/pub?gid=545391956&single=true&output=csv";
const SHEET_CSV_KM = "https://docs.google.com/spreadsheets/d/e/2PACX-1vQOUL8LXx-wqY6UWQkyE7XGczoefIWQF8GCyY-GGZUV9GIXXgy07nyIUf9-0Xu7yfuQhcjt4rMl_-2p/pub?gid=337341507&single=true&output=csv";
const TARGET_STOCK = 1652145;

function toPercent(v) {
  const n = Number(String(v).replace(",", ".").replace("%", ""));
  if (isNaN(n)) return 0;
  return n <= 1 ? n * 100 : n;
}

const ACHIEVEMENTS = [
  { id: "killer", icon: "🎯", title: "Сток-киллер", check: (km) => toPercent(km["Процент"]) >= 100 },
  { id: "half", icon: "⚡", title: "На полпути", check: (km) => toPercent(km["Процент"]) >= 50 },
  { id: "starter", icon: "🚀", title: "Старт дан", check: (km) => toPercent(km["Процент"]) > 0 },
  { id: "clean", icon: "✨", title: "Почти финиш", check: (km) => toPercent(km["Процент"]) >= 90 },
  { id: "volume", icon: "📦", title: "Тяжеловес", check: (km) => Number(km["Закрыто_шт"] || 0) >= 50000 },
  { id: "workhorse", icon: "🐎", title: "Рабочая лошадка", check: (km) => Number(km["Всего_шт"] || 0) >= 100000 },
  { id: "lightload", icon: "🪶", title: "Лёгкий сток", check: (km) => (Number(km["Всего_шт"] || 0) - Number(km["Закрыто_шт"] || 0)) <= 5000 },
  { id: "guard", icon: "🛡️", title: "Хранитель БГ", check: (km) => km._isBgLeader },
  { id: "top3", icon: "🏅", title: "Топ-3 КМ", check: (km) => km._rank <= 3 },
  { id: "underdog", icon: "🐺", title: "Тёмная лошадка", check: (km) => km._rank > 3 && toPercent(km["Процент"]) >= 70 },
];

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

async function loadData() {
  try {
    const bgData = await fetchCSV(SHEET_CSV_BG);
    const kmData = await fetchCSV(SHEET_CSV_KM);

    renderProgress(bgData);
    const sortedBG = renderRankedCards(bgData, "bg-cards", "БГ");
    const sortedKM = renderRankedCards(kmData, "km-cards", "КМ");

    prepareAchievementContext(sortedKM);
    renderAchievements(sortedKM);

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

function renderRankedCards(data, containerId, nameField) {
  const sorted = [...data].sort((a, b) => toPercent(b["Процент"]) - toPercent(a["Процент"]));
  const container = document.getElementById(containerId);
  container.innerHTML = "";

  sorted.forEach((row, i) => {
    row._rank = i + 1;
    const pct = Math.round(toPercent(row["Процент"]));
    const div = document.createElement("div");
    div.className = "card " + medalClass(i);
    div.innerHTML = `
      <div class="card-name"><span class="card-medal">${medalIcon(i)}</span>${row[nameField]}</div>
      <div class="card-percent">${pct}%</div>
    `;
    container.appendChild(div);
  });

  return sorted;
}

function prepareAchievementContext(sortedKM) {
  const bgGroups = {};
  sortedKM.forEach(km => {
    const bg = km["БГ"];
    if (!bgGroups[bg]) bgGroups[bg] = [];
    bgGroups[bg].push(km);
  });

  const bgLeaderNames = new Set();
  Object.values(bgGroups).forEach(group => {
    const leader = group.reduce((a, b) => toPercent(b["Процент"]) > toPercent(a["Процент"]) ? b : a);
    bgLeaderNames.add(leader["КМ"]);
  });

  sortedKM.forEach(km => {
    km._isBgLeader = bgLeaderNames.has(km["КМ"]);
  });
}

function renderAchievements(kmData) {
  const container = document.getElementById("achievements");
  container.innerHTML = "";
  const unlockedIds = new Set();

  kmData.forEach(km => {
    ACHIEVEMENTS.forEach(a => {
      if (a.check(km)) unlockedIds.add(a.id);
    });
  });

  ACHIEVEMENTS.forEach(a => {
    const div = document.createElement("div");
    div.className = "achievement " + (unlockedIds.has(a.id) ? "unlocked" : "");
    div.innerHTML = `${a.icon}<span class="title">${a.title}</span>`;
    container.appendChild(div);
  });
}

loadData();
setInterval(loadData, 60000);
