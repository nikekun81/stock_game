
const SHEET_CSV_BG = "PASTE_YOUR_PUBLISHED_CSV_LINK_FOR_РЕЙТИНГ_БГ_HERE";
const SHEET_CSV_KM = "PASTE_YOUR_PUBLISHED_CSV_LINK_FOR_РЕЙТИНГ_КМ_HERE";
const TARGET_STOCK = 1652145; // задайте общий необходимый сток в штуках

const ACHIEVEMENTS = [
  { id: "snowball", icon: "❄️", title: "Сноуболл-экзорцист", check: (km) => km.max_daily_pcs >= 500 },
  { id: "gonets", icon: "🏃", title: "Гонец утилизации", check: (km) => km.avg_days <= 1 },
  { id: "detective", icon: "🔍", title: "ЛК-детектив", check: (km) => km.hard_cases_closed >= 5 },
  { id: "dozvon", icon: "📞", title: "Мастер дозвона", check: (km) => km.no_contact_closed >= 5 },
  { id: "killer", icon: "🎯", title: "Сток-киллер", check: (km) => km.percent >= 100 },
  { id: "clean", icon: "✨", title: "Без пыли и шума", check: (km) => km.clean_finish >= 10 },
  { id: "guard", icon: "🛡️", title: "Хранитель БГ", check: (km) => km.is_bg_leader },
  { id: "antifreeze", icon: "🧊", title: "Антизависание", check: (km) => km.oldest_case_closed_days >= 14 },
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

function renderAchievements(kmData) {
  const container = document.getElementById("achievements");
  container.innerHTML = "";
  const totalUnlocked = {};
  ACHIEVEMENTS.forEach(a => {
    const unlockedByAnyone = kmData.some(km => {
      try { return a.check(normalizeKM(km)); } catch { return false; }
    });
    const div = document.createElement("div");
    div.className = "achievement" + (unlockedByAnyone ? " unlocked" : "");
    div.innerHTML = `${a.icon}<span class="title">${a.title}</span>`;
    container.appendChild(div);
  });
}

function normalizeKM(row) {
  return {
    max_daily_pcs: Number(row["Макс_шт_день"] || 0),
    avg_days: Number(row["Ср_дни"] || 999),
    hard_cases_closed: Number(row["Сложных_закрыто"] || 0),
    no_contact_closed: Number(row["НеВыходитНаСвязь_закрыто"] || 0),
    percent: Number(row["Процент"] || 0),
    clean_finish: Number(row["Чистых_закрытий"] || 0),
    is_bg_leader: row["Лидер_БГ"] === "TRUE" || row["Лидер_БГ"] === "1",
    oldest_case_closed_days: Number(row["Макс_дней_в_работе"] || 0),
  };
}

loadData();
setInterval(loadData, 60000); // автообновление каждую минуту
