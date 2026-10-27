"use strict";


const API_BASE = "https://api.openweathermap.org/data/2.5";
const STORE = { unit: "skycast.unit", recent: "skycast.recent", last: "skycast.last" };
const TIMEOUT_MS = 10000;

const $ = (selector, scope = document) => scope.querySelector(selector);
const read = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch (e) { return fallback; } };
const write = (key, value) => { try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* storage blocked */ } };
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

let units = read(STORE.unit, "metric");
let data = null;                      
let requestId = 0;                    


const CLOUD = '<path d="M17.5 19H7a5 5 0 1 1 1.1-9.9A6 6 0 0 1 19.6 12 3.5 3.5 0 0 1 17.5 19z"/>';
const CLOUD_UP = '<path d="M17.5 14H7a5 5 0 1 1 1.1-9.9A6 6 0 0 1 19.6 7 3.5 3.5 0 0 1 17.5 14z"/>';
const PATHS = {
  sun: '<circle cx="12" cy="12" r="4.5"/><path d="M12 2v2.5M12 19.5V22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M2 12h2.5M19.5 12H22M4.9 19.1l1.8-1.8M17.3 6.7l1.8-1.8"/>',
  moon: '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>',
  cloud: CLOUD,
  "partly-day": '<circle cx="8" cy="8" r="3"/><path d="M8 1.5V3M2.2 4l1.1 1.1M1.5 9H3M13.8 4l-1.1 1.1"/><path d="M17.5 21H9a4 4 0 1 1 .9-7.9A5 5 0 0 1 19.4 15 3 3 0 0 1 17.5 21z"/>',
  "partly-night": '<path d="M10 3.5a5 5 0 1 0 6.5 6.5A4 4 0 0 1 10 3.5z"/><path d="M17.5 21H9a4 4 0 1 1 .9-7.9A5 5 0 0 1 19.4 15 3 3 0 0 1 17.5 21z"/>',
  rain: CLOUD_UP + '<path d="M8 17l-1 3M12 17l-1 3M16 17l-1 3"/>',
  drizzle: CLOUD_UP + '<path d="M8 18v.01M12 18v.01M16 18v.01M10 21v.01M14 21v.01"/>',
  thunder: CLOUD_UP + '<path d="M12.5 13l-2.5 4h4l-2.5 4"/>',
  snow: CLOUD_UP + '<path d="M8 17h.01M12 19h.01M16 17h.01M10 21h.01M14 21h.01"/>',
  mist: '<path d="M4 8h16M3 12h14M6 16h15M9 20h9"/>',
  alert: '<circle cx="12" cy="12" r="9"/><path d="M12 8v5M12 16h.01"/>',
};
const UI = {
  thermo: '<path d="M14 14.76V3.5a2.5 2.5 0 0 0-5 0v11.26a4.5 4.5 0 1 0 5 0z"/>',
  drop: '<path d="M12 2.7s7 6.3 7 11.3a7 7 0 0 1-14 0c0-5 7-11.3 7-11.3z"/>',
  wind: '<path d="M9.6 4.6A2 2 0 1 1 11 8H2M12.6 19.4A2 2 0 1 0 14 16H2M17.7 7.7A2.5 2.5 0 1 1 19.5 12H2"/>',
  gauge: '<circle cx="12" cy="12" r="9"/><path d="M12 12l3.5-3.5M8 17h8"/>',
  eye: '<path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z"/><circle cx="12" cy="12" r="3"/>',
  sunrise: '<path d="M17 18a5 5 0 0 0-10 0M12 2v7M4.2 10.2l1.4 1.4M1 18h2M21 18h2M18.4 11.6l1.4-1.4M23 22H1M8 6l4-4 4 4"/>',
};
const wx = (name) => `<svg class="wx ico-${name}" viewBox="0 0 24 24" aria-hidden="true">${PATHS[name]}</svg>`;
const ui = (name) => `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true">${UI[name]}</svg>`;

// Maps an OpenWeatherMap condition id to an icon and a background "sky"
function describe(id, isDay) {
  if (id >= 200 && id < 300) return { icon: "thunder", sky: "thunder" };
  if (id >= 300 && id < 400) return { icon: "drizzle", sky: "rain" };
  if (id >= 500 && id < 600) return { icon: "rain", sky: "rain" };
  if (id >= 600 && id < 700) return { icon: "snow", sky: "snow" };
  if (id >= 700 && id < 800) return { icon: "mist", sky: "mist" };
  if (id === 800) return isDay ? { icon: "sun", sky: "clear" } : { icon: "moon", sky: "night" };
  if (id <= 802) return { icon: isDay ? "partly-day" : "partly-night", sky: isDay ? "clear" : "night" };
  return { icon: "cloud", sky: isDay ? "clouds" : "night" };
}

const deg = (c) => Math.round(units === "metric" ? c : c * 1.8 + 32);
const windText = (ms) => (units === "metric" ? `${Math.round(ms * 3.6)} km/h` : `${Math.round(ms * 2.237)} mph`);
const visText = (m) => (m == null ? "N/A" : units === "metric" ? `${(m / 1000).toFixed(1)} km` : `${(m / 1609.34).toFixed(1)} mi`);
const compass = (d) => ["N", "NE", "E", "SE", "S", "SW", "W", "NW"][Math.round(d / 45) % 8];
// The API gives UTC seconds and the city's offset, so we show the city's local time
const localTime = (unix, tz) => new Date((unix + tz) * 1000).toLocaleTimeString("en-GB", { timeZone: "UTC", hour: "2-digit", minute: "2-digit" });
const localDate = (unix, tz) => new Date((unix + tz) * 1000).toLocaleDateString("en-GB", { timeZone: "UTC", weekday: "long", day: "numeric", month: "long" });

/* ---------- Fetch with error handling ---------- */
class WeatherError extends Error {
  constructor(code) { super(code); this.code = code; }
}

async function fetchJSON(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) {
      throw new WeatherError(res.status === 404 ? "notfound" : res.status === 401 ? "key" : res.status === 429 ? "limit" : "server");
    }
    return await res.json();
  } catch (err) {
    if (err instanceof WeatherError) throw err;
    throw new WeatherError(err.name === "AbortError" ? "timeout" : "network");
  } finally {
    clearTimeout(timer);
  }
}

const MESSAGES = {
  notfound: ["City not found", "We couldn't find that city. Check the spelling, or add the country, like “Paris, FR”."],
  key: ["API key problem", "The API key is missing, wrong or not active yet. New OpenWeatherMap keys can take up to 2 hours to start working."],
  limit: ["Too many requests", "The free plan limit was reached. Please wait a minute and try again."],
  network: ["No connection", "Check your internet connection and try again."],
  timeout: ["Request timed out", "The weather service took too long to answer. Please try again."],
  server: ["Something went wrong", "The weather service had a problem. Please try again in a moment."],
  geo: ["Location unavailable", "Location access was blocked. Allow it in your browser, or search for a city instead."],
  nokey: ["Add your API key", "Open js/config.js and paste your free OpenWeatherMap API key, then reload this page."],
};

function setStatus(type, title = "", text = "") {
  const box = $("#status");
  $("#weather").hidden = Boolean(type);
  box.hidden = !type;
  if (!type) return;
  box.innerHTML = type === "loading"
    ? '<div class="spinner" role="status" aria-label="Loading"></div><p class="status-title"></p>'
    : `${wx("alert")}<h2 class="status-title"></h2><p class="status-text"></p>`;
  $(".status-title", box).textContent = title;
  if (text) $(".status-text", box).textContent = text;
}

const showError = (code) => { const [title, text] = MESSAGES[code] || MESSAGES.server; setStatus("error", title, text); };


async function loadWeather(query) {
  const id = ++requestId;
  setStatus("loading", "Fetching the latest weather…");
  try {
    const key = encodeURIComponent(CONFIG.API_KEY);
    // Both requests run at the same time
    const [now, forecast] = await Promise.all([
      fetchJSON(`${API_BASE}/weather?${query}&units=metric&appid=${key}`),
      fetchJSON(`${API_BASE}/forecast?${query}&units=metric&appid=${key}`),
    ]);
    if (id !== requestId) return;
    data = { now, forecast };
    setStatus(null);
    render();
    remember(now.name);
  } catch (err) {
    if (id !== requestId) return;
    if (!(err instanceof WeatherError)) console.error(err);
    showError(err.code);
  }
}


function dailyForecast(list, tz) {
  const days = new Map();
  list.forEach((item) => {
    const key = new Date((item.dt + tz) * 1000).toISOString().slice(0, 10);
    if (!days.has(key)) days.set(key, []);
    days.get(key).push(item);
  });
  const hourOf = (item) => new Date((item.dt + tz) * 1000).getUTCHours();
  return [...days.entries()].slice(0, 5).map(([key, items]) => {
    const noon = items.reduce((best, i) => (Math.abs(hourOf(i) - 12) < Math.abs(hourOf(best) - 12) ? i : best));
    return {
      key,
      min: Math.min(...items.map((i) => i.main.temp_min)),
      max: Math.max(...items.map((i) => i.main.temp_max)),
      id: noon.weather[0].id,
      desc: noon.weather[0].description,
      rain: Math.round(Math.max(...items.map((i) => i.pop || 0)) * 100),
    };
  });
}

function render() {
  if (!data) return;
  const { now, forecast } = data;
  const tz = now.timezone;
  const isDay = now.dt >= now.sys.sunrise && now.dt < now.sys.sunset;
  const look = describe(now.weather[0].id, isDay);
  const todayKey = new Date((now.dt + tz) * 1000).toISOString().slice(0, 10);
  const days = dailyForecast(forecast.list, tz);
  const today = days.find((d) => d.key === todayKey) || days[0];

  document.body.dataset.sky = look.sky; // changes the background gradient
  document.title = `${deg(now.main.temp)}° ${now.name} | Skycast`;
  $("#cityName").textContent = now.name;
  $("#countryName").textContent = now.sys.country ? `, ${now.sys.country}` : "";
  $("#localTime").textContent = `${localDate(now.dt, tz)} · ${localTime(now.dt, tz)}`;
  $("#temp").textContent = deg(now.main.temp);
  $("#tempUnit").textContent = units === "metric" ? "°C" : "°F";
  $("#condition").textContent = now.weather[0].description;
  $("#hiLo").textContent = `High ${deg(today.max)}° · Low ${deg(today.min)}°`;
  $("#currentIcon").innerHTML = wx(look.icon);

  const metrics = [
    { label: "Feels like", icon: "thermo", value: `${deg(now.main.feels_like)}°` },
    { label: "Humidity", icon: "drop", value: `${now.main.humidity}%` },
    { label: "Wind", icon: "wind", value: windText(now.wind.speed), sub: now.wind.deg != null ? `From ${compass(now.wind.deg)}` : "" },
    { label: "Pressure", icon: "gauge", value: `${now.main.pressure} hPa` },
    { label: "Visibility", icon: "eye", value: visText(now.visibility) },
    { label: "Sunrise", icon: "sunrise", value: localTime(now.sys.sunrise, tz), sub: `Sunset ${localTime(now.sys.sunset, tz)}` },
  ];
  $("#metrics").innerHTML = metrics
    .map((m) => `<div class="metric glass"><span class="metric-label">${ui(m.icon)}${m.label}</span><strong>${m.value}</strong>${m.sub ? `<small>${m.sub}</small>` : ""}</div>`)
    .join("");

  $("#forecastList").innerHTML = days
    .map((d, i) => {
      const date = new Date(d.key + "T00:00:00Z");
      const name = i === 0 && d.key === todayKey ? "Today" : date.toLocaleDateString("en-GB", { weekday: "short", timeZone: "UTC" });
      const shortDate = date.toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
      return `<article class="day glass">
        <span class="day-name">${name}</span><span class="day-date">${shortDate}</span>
        <div class="day-icon">${wx(describe(d.id, true).icon)}</div>
        <span class="day-desc">${esc(d.desc)}</span>
        <span class="day-temps">${deg(d.max)}° <span>/ ${deg(d.min)}°</span></span>
        <span class="day-rain">${d.rain > 0 ? `${d.rain}% rain` : ""}</span>
      </article>`;
    })
    .join("");
}


const form = $("#searchForm");
const input = $("#cityInput");
const formError = $("#formError");

form.addEventListener("submit", (e) => {
  e.preventDefault();
  const city = input.value.trim();
  if (!/^[\p{L}\p{M}\s,.'-]{2,60}$/u.test(city)) {
    formError.textContent = "Enter a valid city name (letters only, at least 2 characters).";
    input.focus();
    return;
  }
  formError.textContent = "";
  loadWeather(`q=${encodeURIComponent(city)}`);
});
input.addEventListener("input", () => { formError.textContent = ""; });

function remember(city) {
  const list = [city, ...read(STORE.recent, []).filter((c) => c.toLowerCase() !== city.toLowerCase())].slice(0, 5);
  write(STORE.recent, list);
  write(STORE.last, city);
  renderRecent();
}

function renderRecent() {
  const list = read(STORE.recent, []);
  const box = $("#recent");
  box.hidden = list.length === 0;
  box.innerHTML = list.map((c) => `<button type="button" data-city="${esc(c)}">${esc(c)}</button>`).join("");
}

$("#recent").addEventListener("click", (e) => {
  const btn = e.target.closest("[data-city]");
  if (!btn) return;
  input.value = btn.dataset.city;
  loadWeather(`q=${encodeURIComponent(btn.dataset.city)}`);
});

$("#locateBtn").addEventListener("click", () => {
  if (!navigator.geolocation) return showError("geo");
  setStatus("loading", "Finding your location…");
  navigator.geolocation.getCurrentPosition(
    (pos) => loadWeather(`lat=${pos.coords.latitude}&lon=${pos.coords.longitude}`),
    () => showError("geo"),
    { timeout: 8000 }
  );
});

function setUnits(next) {
  units = next;
  write(STORE.unit, units);
  document.querySelectorAll(".unit-toggle button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.unit === units)));
  render();
}
document.querySelectorAll(".unit-toggle button").forEach((b) => b.addEventListener("click", () => setUnits(b.dataset.unit)));


setUnits(units);
renderRecent();
if (!CONFIG.API_KEY || CONFIG.API_KEY.includes("PASTE_YOUR")) {
  showError("nokey");
} else {
  const start = read(STORE.last, CONFIG.DEFAULT_CITY);
  input.value = start;
  loadWeather(`q=${encodeURIComponent(start)}`);
}