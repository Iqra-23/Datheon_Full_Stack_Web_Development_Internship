"use strict";

const IMAGE_DIR = "assets/images/";

const projects = [
  {
    title: "SEO Intrusion Detector",
    initials: "SI",
    image: "seo-intrusion-detector",
    color: "linear-gradient(135deg, #1f3a8a, #4f7be8)",
    meta: "Web platform · 09/2025 – 07/2026",
    summary: "A web-based security platform for real-time intrusion detection.",
    description:
      "A full-stack security monitoring platform that detects and manages threats for websites in real time. I co-developed it from 09/2025 to 07/2026.",
    features: [
      "Dashboard with live traffic, security alerts and threat trends",
      "Vulnerability scanner for outdated software, weak passwords and SSL/TLS issues",
      "Firewall simulation that blocks SQL injection, XSS and path traversal",
      "IP blacklisting, rate limiting and anomaly detection",
      "Automated incident response with daily, weekly and monthly reports",
    ],
    tags: ["Full-stack", "Cybersecurity", "Dashboard"],
    live: "",
    repo: "",
  },
  {
    title: "Hospital Management System",
    initials: "HM",
    image: "hospital-management",
    color: "linear-gradient(135deg, #0f766e, #34b3a6)",
    meta: "Networking project · 02/2025 – 03/2025",
    summary: "A network-based system for patients, appointments and doctors.",
    description:
      "A hospital system built around core networking concepts. It simulates real-time communication between modules over a network.",
    features: [
      "Patient registration module",
      "Appointment scheduling",
      "Doctor management",
      "Client-server architecture with socket programming",
    ],
    tags: ["Networking", "Socket programming", "Client-server"],
    live: "",
    repo: "",
  },
  {
    title: "Tic Tac Toe Game",
    initials: "TT",
    image: "tic-tac-toe",
    color: "linear-gradient(135deg, #7c3aed, #a78bfa)",
    meta: "Web game",
    summary: "A two-player game with win and draw detection.",
    description:
      "A fully working Tic Tac Toe game with a clean, responsive interface where two players take turns. It strengthened my DOM manipulation and event handling skills.",
    features: [
      "Turn management for two players",
      "Win and draw detection",
      "Responsive layout with animations",
    ],
    tags: ["HTML5", "CSS3", "JavaScript"],
    live: "",
    repo: "",
  },
  {
    title: "Counter App",
    initials: "CA",
    image: "counter-app",
    color: "linear-gradient(135deg, #b45309, #f59e0b)",
    meta: "Android app",
    summary: "A native Android app built with Kotlin.",
    description:
      "A simple native Android app made while learning mobile development. It updates the interface in real time and follows basic Android architecture practices.",
    features: [
      "Increment, decrement and reset the counter",
      "Real-time UI updates",
      "Uses TextView, Button and click listeners",
    ],
    tags: ["Kotlin", "Android Studio"],
    live: "",
    repo: "",
  },
];

/* ---------- Helpers ---------- */
const $ = (selector, scope = document) => scope.querySelector(selector);
const $$ = (selector, scope = document) => [...scope.querySelectorAll(selector)];

/* ---------- Theme toggle ---------- */
const root = document.documentElement;
const themeBtn = $("#themeToggle");

function applyTheme(theme) {
  root.setAttribute("data-theme", theme);
  themeBtn.setAttribute("aria-label", theme === "dark" ? "Switch to light theme" : "Switch to dark theme");
  try { localStorage.setItem("theme", theme); } catch (e) { /* storage blocked */ }
}
applyTheme(root.getAttribute("data-theme") || "light");
themeBtn.addEventListener("click", () => {
  applyTheme(root.getAttribute("data-theme") === "dark" ? "light" : "dark");
});

/* ---------- Mobile menu ---------- */
const menuBtn = $("#menuToggle");
const nav = $("#nav");

function setMenu(open) {
  nav.classList.toggle("open", open);
  menuBtn.setAttribute("aria-expanded", String(open));
  menuBtn.setAttribute("aria-label", open ? "Close menu" : "Open menu");
}
menuBtn.addEventListener("click", () => setMenu(!nav.classList.contains("open")));
$$(".nav-link").forEach((link) => link.addEventListener("click", () => setMenu(false)));
document.addEventListener("keydown", (e) => { if (e.key === "Escape") setMenu(false); });
window.matchMedia("(min-width: 900px)").addEventListener("change", (e) => { if (e.matches) setMenu(false); });

/* ---------- Active nav link ---------- */
const navLinks = $$(".nav-link");
const spy = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      navLinks.forEach((link) => {
        const on = link.getAttribute("href") === `#${entry.target.id}`;
        link.classList.toggle("active", on);
        if (on) link.setAttribute("aria-current", "true"); else link.removeAttribute("aria-current");
      });
    });
  },
  { rootMargin: "-45% 0px -50% 0px" }
);
$$("main section[id]").forEach((section) => spy.observe(section));

/* ---------- Scroll progress bar ---------- */
const progress = $("#progress");
let ticking = false;
function updateProgress() {
  const max = document.documentElement.scrollHeight - window.innerHeight;
  progress.style.transform = `scaleX(${max > 0 ? Math.min(window.scrollY / max, 1) : 0})`;
  ticking = false;
}
window.addEventListener("scroll", () => {
  if (!ticking) { ticking = true; requestAnimationFrame(updateProgress); }
}, { passive: true });
updateProgress();

/* ---------- Projects + modal ---------- */
const grid = $("#projectsGrid");
const modal = $("#projectModal");
let current = 0;

// Image sits on top of the gradient + initials; if the file is missing it removes itself
// Image file names are written WITHOUT an extension in the projects list.
// The page tries each extension below until it finds your file.
const IMAGE_EXTS = ["png", "jpg", "jpeg", "webp", "svg", "PNG", "JPG", "JPEG"];

function nextImg(img) {
  const i = Number(img.dataset.i) + 1;
  if (i >= IMAGE_EXTS.length) {
    console.warn("Image not found:", IMAGE_DIR + img.dataset.name + ".(png/jpg/webp/svg)");
    img.remove();
    return;
  }
  img.dataset.i = i;
  img.src = `${IMAGE_DIR}${img.dataset.name}.${IMAGE_EXTS[i]}`;
}

function thumbImg(p) {
  if (!p.image) return "";
  return `<img src="${IMAGE_DIR}${p.image}.${IMAGE_EXTS[0]}" data-name="${p.image}" data-i="0" alt="" loading="lazy" onerror="nextImg(this)">`;
}

function renderProjects() {
  grid.innerHTML = projects
    .map(
      (p, i) => `
      <button class="project-card" type="button" data-index="${i}" aria-haspopup="dialog">
        <div class="project-thumb" style="background:${p.color}" aria-hidden="true">${p.initials}${thumbImg(p)}</div>
        <div class="project-body">
          <span class="project-meta">${p.meta}</span>
          <h3>${p.title}</h3>
          <p>${p.summary}</p>
          <ul class="chips">${p.tags.map((t) => `<li>${t}</li>`).join("")}</ul>
          <span class="project-more">View details</span>
        </div>
      </button>`
    )
    .join("");
}

function setLink(el, url) {
  if (url) { el.href = url; el.hidden = false; }
  else { el.removeAttribute("href"); el.hidden = true; }
}

function fillModal(index) {
  current = index;
  const p = projects[index];
  $("#modalThumb").style.background = p.color;
  $("#modalThumb").innerHTML = p.initials + thumbImg(p);
  $("#modalMeta").textContent = p.meta;
  $("#modalTitle").textContent = p.title;
  $("#modalDesc").textContent = p.description;
  $("#modalFeatures").innerHTML = p.features.map((f) => `<li>${f}</li>`).join("");
  $("#modalTags").innerHTML = p.tags.map((t) => `<li>${t}</li>`).join("");
  setLink($("#modalLive"), p.live);
  setLink($("#modalRepo"), p.repo);
  modal.scrollTop = 0;
}

function openModal(index) {
  fillModal(index);
  modal.showModal();
  document.body.style.overflow = "hidden";
}

renderProjects();
grid.addEventListener("click", (e) => {
  const card = e.target.closest(".project-card");
  if (card) openModal(Number(card.dataset.index));
});
$("#modalNext").addEventListener("click", () => fillModal((current + 1) % projects.length));
$("#modalClose").addEventListener("click", () => modal.close());
modal.addEventListener("click", (e) => { if (e.target === modal) modal.close(); });
modal.addEventListener("close", () => { document.body.style.overflow = ""; });

/* ---------- Copy email ---------- */
const copyBtn = $("#copyEmail");
copyBtn.addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText("iqrasyyab53@gmail.com");
    copyBtn.textContent = "Copied";
  } catch (e) {
    copyBtn.textContent = "Copy failed";
  }
  setTimeout(() => { copyBtn.textContent = "Copy"; }, 1800);
});

/* ---------- Contact form ---------- */
const form = $("#contactForm");
const note = $("#formNote");

function setError(fieldId, message) {
  const input = $(`#${fieldId}`);
  input.closest(".field").classList.toggle("invalid", Boolean(message));
  $(`#${fieldId}Error`).textContent = message;
  input.setAttribute("aria-invalid", message ? "true" : "false");
}

function getValues() {
  return {
    name: $("#name").value.trim(),
    email: $("#email").value.trim(),
    message: $("#message").value.trim(),
  };
}

function validate() {
  const { name, email, message } = getValues();
  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  setError("name", name.length < 2 ? "Enter your name (at least 2 characters)." : "");
  setError("email", emailOk ? "" : "Enter a valid email address, like name@example.com.");
  setError("message", message.length < 10 ? "Write at least 10 characters so I know how to help." : "");
  const firstInvalid = $(".field.invalid input, .field.invalid textarea");
  if (firstInvalid) firstInvalid.focus();
  return !firstInvalid;
}

form.addEventListener("submit", (e) => {
  e.preventDefault();
  note.textContent = "";
  if (!validate()) return;

  const { name, email, message } = getValues();
  const subject = encodeURIComponent(`Portfolio message from ${name}`);
  const body = encodeURIComponent(`${message}\n\nFrom: ${name} (${email})`);
  window.location.href = `mailto:iqrasyyab53@gmail.com?subject=${subject}&body=${body}`;

  note.textContent = "Thanks! Your email app should open with the message ready to send.";
  form.reset();
  updateCount();
});

const counter = $("#msgCount");
const updateCount = () => { counter.textContent = `${$("#message").value.length} / 1000`; };

["name", "email", "message"].forEach((id) => {
  $(`#${id}`).addEventListener("input", () => { setError(id, ""); updateCount(); });
});

/* ---------- Footer year ---------- */
$("#year").textContent = new Date().getFullYear();