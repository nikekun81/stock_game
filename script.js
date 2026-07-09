const SHEET_CSV_BG = "https://docs.google.com/spreadsheets/d/e/2PACX-1vQOUL8LXx-wqY6UWQkyE7XGczoefIWQF8GCyY-GGZUV9GIXXgy07nyIUf9-0Xu7yfuQhcjt4rMl_-2p/pub?gid=545391956&single=true&output=csv";
const SHEET_CSV_KM = "https://docs.google.com/spreadsheets/d/e/2PACX-1vQOUL8LXx-wqY6UWQkyE7XGczoefIWQF8GCyY-GGZUV9GIXXgy07nyIUf9-0Xu7yfuQhcjt4rMl_-2p/pub?gid=337341507&single=true&output=csv";
const TARGET_STOCK = 1652145;

const ACHIEVEMENTS_MILESTONE = [
  { id: "m25", icon: "🥉", title: "Первый на 25%", dateField: "Дата_25" },
  { id: "m50", icon: "🥈", title: "Первый на 50%", dateField: "Дата_50" },
  { id: "m100", icon: "🥇", title: "Первый на 100%", dateField: "Дата_100" },
];

function parseCSV(text) {
  const lines = text.trim().split("\n").map(l => l.split(","));
  const headers = lines[0].map(h => h.trim());
  return lines.slice(1).map(row => {
    const obj = {};
    headers.forEach((h, i) => obj[h] = (row[i] || "").trim());
    return obj;
  });
}

async function fetchCSV(url) {
  const res = await fetch(url + "&t=" + Date.now());
  const text = await res.text();
  return parseCSV(text);
}

function medal(i) {
  return i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : "▫️";
}

function medalClass(i) {
  return i === 0 ? "gold" : i === 1 ? "silver" : i === 2 ? "bronze" : "";
}

async function loadData() {
  try {
    const bgData = await fetchCSV(SHEET_CSV_BG);
    const kmData = await fetchCSV(SHEET_CSV_KM);
    renderProgress(bgData);
    renderBGCards(bgData);
    renderKMTable(kmData);
    renderAchievements(kmData);
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

function renderBGCards(bgData) {
  const sorted = [...bgData].sort((a, b) => Number(b["Процент"] || 0) - Number(a["Процент"] || 0));
  const container = document.getElementById("bg-cards");
  container.innerHTML = "";
  sorted.forEach((row, i) => {
    const div = document.createElement("div");
    div.className = "card " + medalClass(i);
    div.innerHTML = `
      <div><span class="card-medal">${medal(i)}</span><span class="card-name">${row["БГ"]}</span></div>
      <div class="card-percent">${row["Процент"]}%</div>
    `;
    container.appendChild(div);
  });
}

function renderKMTable(kmData) {
  const sorted = [...kmData].sort((a, b) => Number(b["Очки"] || 0) - Number(a["Очки"] || 0));
  const tbody = document.getElementById("km-table-body");
  tbody.innerHTML = "";
  sorted.forEach((row, i) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td>${medal(i)}</td><td>${row["КМ"]}</td><td>${row["БГ"]}</td><td>${row["Очки"]}</td><td>${row["Штук"]}</td>`;
    tbody.appendChild(tr);
  });
}

function findFirstMilestone(kmData, dateField) {
  const withDates = kmData.filter(km => km[dateField]);
  if (!withDates.length) return null;
  return withDates.reduce((earliest, km) =>
    new Date(km[dateField]) < new Date(earliest[dateField]) ? km : earliest
  );
}

function renderAchievements(kmData) {
  const container = document.getElementById("achievements");
  container.innerHTML = "";

  ACHIEVEMENTS_MILESTONE.forEach(a => {
    const winner = findFirstMilestone(kmData, a.dateField);
    const div = document.createElement("div");
    div.className = "achievement" + (winner ? " unlocked" : "");
    div.innerHTML = `${a.icon}<span class="title">${a.title}</span>${winner ? `<span class="holder">${winner["КМ"]}</span>` : ""}`;
    container.appendChild(div);
  });
}

loadData();
setInterval(loadData, 60000);
