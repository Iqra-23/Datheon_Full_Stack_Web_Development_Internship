"use strict";

/* =========================================================
   Task Manager: CRUD + categories + due dates + filters
   Data is saved in the browser with localStorage.
   ========================================================= */
const STORAGE_KEY = "taskManager.tasks.v1";
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const $ = (selector, scope = document) => scope.querySelector(selector);
const $$ = (selector, scope = document) => [...scope.querySelectorAll(selector)];

const ICONS = {
  grip: '<svg viewBox="0 0 14 18" aria-hidden="true"><circle cx="4" cy="3" r="1.5"/><circle cx="10" cy="3" r="1.5"/><circle cx="4" cy="9" r="1.5"/><circle cx="10" cy="9" r="1.5"/><circle cx="4" cy="15" r="1.5"/><circle cx="10" cy="15" r="1.5"/></svg>',
  edit: '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>',
  trash: '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14M10 11v6M14 11v6"/></svg>',
  tick: '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
};

/* ---------- Date + id helpers ---------- */
const dateStr = (offsetDays = 0) => new Date(Date.now() + offsetDays * 864e5).toLocaleDateString("en-CA"); // YYYY-MM-DD
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2));

function dueInfo(task) {
  if (!task.due) return null;
  const day = new Date(task.due + "T00:00:00");
  const diff = Math.round((day - new Date(dateStr() + "T00:00:00")) / 864e5);
  const label = day.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
  if (task.done) return { text: label, cls: "" };
  if (diff < 0) return { text: `Overdue · ${label}`, cls: "overdue" };
  if (diff === 0) return { text: "Due today", cls: "soon" };
  if (diff === 1) return { text: "Due tomorrow", cls: "soon" };
  return { text: label, cls: "" };
}

/* ---------- localStorage ---------- */
function saveToLocalStorage() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks)); }
  catch (e) { console.warn("Could not save tasks:", e); }
}

function loadFromLocalStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === null) return sampleTasks();
    const data = JSON.parse(raw);
    return Array.isArray(data) ? data.filter((t) => t && typeof t.id === "string" && typeof t.title === "string") : [];
  } catch (e) { return []; }
}

// Shown only on the very first visit so the app does not look empty
function sampleTasks() {
  return [
    { id: uid(), title: "Finish internship Task 2", category: "Work", due: dateStr(1), done: false },
    { id: uid(), title: "Revise JavaScript array methods", category: "Study", due: dateStr(3), done: false },
    { id: uid(), title: "Go for a walk", category: "Personal", due: "", done: true },
  ];
}

/* ---------- State ---------- */
let tasks = loadFromLocalStorage();
let lastAddedId = null;
const state = { filter: "all", category: "all", query: "", editingId: null, dragId: null };

function visibleTasks() {
  const q = state.query.trim().toLowerCase();
  return tasks.filter((t) =>
    (state.filter === "all" || (state.filter === "completed" ? t.done : !t.done)) &&
    (state.category === "all" || t.category === state.category) &&
    (!q || t.title.toLowerCase().includes(q))
  );
}

/* ---------- Rendering (user text always set with textContent) ---------- */
function createItem(t) {
  const li = document.createElement("li");
  li.className = "task" + (t.done ? " done" : "") + (t.id === lastAddedId ? " enter" : "");
  li.dataset.id = t.id;
  li.draggable = true;
  li.innerHTML = `
    <span class="grip" aria-hidden="true">${ICONS.grip}</span>
    <label class="check"><input type="checkbox" ${t.done ? "checked" : ""}><span class="box">${ICONS.tick}</span></label>
    <div class="task-main"><p class="task-title"></p><div class="task-meta"><span class="tag"></span><span class="due"></span></div></div>
    <div class="task-actions">
      <button class="icon-btn" type="button" data-action="edit" aria-label="Edit task">${ICONS.edit}</button>
      <button class="icon-btn danger" type="button" data-action="delete" aria-label="Delete task">${ICONS.trash}</button>
    </div>`;
  $(".task-title", li).textContent = t.title;
  $("input", li).setAttribute("aria-label", `Mark "${t.title}" as complete`);
  const tag = $(".tag", li);
  tag.textContent = t.category;
  tag.dataset.cat = t.category;
  const due = dueInfo(t);
  const dueEl = $(".due", li);
  if (due) { dueEl.textContent = due.text; if (due.cls) dueEl.classList.add(due.cls); } else dueEl.remove();
  return li;
}

function renderList() {
  const items = visibleTasks();
  $("#taskList").replaceChildren(...items.map(createItem));
  lastAddedId = null;
  const empty = $("#emptyState");
  empty.hidden = items.length > 0;
  empty.textContent = tasks.length ? "No tasks match your filters." : "No tasks yet. Add your first task above.";
}

function renderStats() {
  const total = tasks.length;
  const done = tasks.filter((t) => t.done).length;
  const active = total - done;
  const pct = total ? Math.round((done / total) * 100) : 0;
  $("#progressText").textContent = total ? `${done} of ${total} ${total === 1 ? "task" : "tasks"} completed` : "No tasks yet";
  $("#progressPct").textContent = `${pct}%`;
  $("#progressFill").style.strokeDashoffset = 326.73 * (1 - pct / 100);
  $("#progressBar").setAttribute("aria-valuenow", pct);
  const overdue = tasks.filter((t) => !t.done && t.due && t.due < dateStr()).length;
  $("#statTotal").textContent = total;
  $("#statActive").textContent = active;
  $("#statDone").textContent = done;
  $("#statOverdue").textContent = overdue;
  $("#statOverdue").classList.toggle("has", overdue > 0);
  $("#countAll").textContent = total;
  $("#countActive").textContent = active;
  $("#countDone").textContent = done;
  $("#leftCount").textContent = `${active} ${active === 1 ? "task" : "tasks"} left`;
  $("#clearCompleted").disabled = done === 0;
}

const render = () => { renderList(); renderStats(); };

/* ---------- Create / Update ---------- */
const form = $("#taskForm");
const titleInput = $("#taskTitle");

function showError(message) { $("#formError").textContent = message; }

function startEdit(id) {
  const t = tasks.find((x) => x.id === id);
  if (!t) return;
  state.editingId = id;
  titleInput.value = t.title;
  $("#taskCategory").value = t.category;
  $("#taskDue").value = t.due || "";
  $("#submitBtn").textContent = "Save changes";
  $("#cancelEdit").hidden = false;
  form.classList.add("editing");
  form.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "center" });
  titleInput.focus();
}

function stopEditing() {
  state.editingId = null;
  form.reset();
  showError("");
  $("#submitBtn").textContent = "Add task";
  $("#cancelEdit").hidden = true;
  form.classList.remove("editing");
}

form.addEventListener("submit", (e) => {
  e.preventDefault();
  const title = titleInput.value.trim();
  if (title.length < 2) { showError("Please enter a task (at least 2 characters)."); titleInput.focus(); return; }
  showError("");
  const data = { title, category: $("#taskCategory").value, due: $("#taskDue").value };

  if (state.editingId) {
    Object.assign(tasks.find((t) => t.id === state.editingId), data);
    stopEditing();
  } else {
    const task = { id: uid(), done: false, ...data };
    tasks.unshift(task);
    lastAddedId = task.id;
    form.reset();
  }
  saveToLocalStorage();
  render();
  titleInput.focus();
});

$("#cancelEdit").addEventListener("click", stopEditing);
form.addEventListener("keydown", (e) => { if (e.key === "Escape" && state.editingId) stopEditing(); });
titleInput.addEventListener("input", () => showError(""));

/* ---------- Complete / Delete ---------- */
function toggleTask(id, done) {
  const t = tasks.find((x) => x.id === id);
  if (!t) return;
  t.done = done;
  $(`.task[data-id="${id}"]`)?.classList.toggle("done", done); // plays the CSS transition
  saveToLocalStorage();
  renderStats();
  // Re-render after the animation so the item can leave the Active/Completed view
  setTimeout(renderList, reduceMotion ? 0 : 380);
}

function deleteTask(id, li) {
  li.classList.add("removing");
  setTimeout(() => {
    tasks = tasks.filter((t) => t.id !== id);
    if (state.editingId === id) stopEditing();
    saveToLocalStorage();
    render();
  }, reduceMotion ? 0 : 220);
}

const list = $("#taskList");
list.addEventListener("change", (e) => {
  if (e.target.matches('input[type="checkbox"]')) toggleTask(e.target.closest(".task").dataset.id, e.target.checked);
});
list.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-action]");
  if (!btn) return;
  const li = btn.closest(".task");
  if (btn.dataset.action === "edit") startEdit(li.dataset.id);
  else deleteTask(li.dataset.id, li);
});

/* ---------- Drag and drop reordering ---------- */
list.addEventListener("dragstart", (e) => {
  const li = e.target.closest(".task");
  if (!li) return;
  state.dragId = li.dataset.id;
  li.classList.add("dragging");
  e.dataTransfer.effectAllowed = "move";
  e.dataTransfer.setData("text/plain", state.dragId);
});
list.addEventListener("dragover", (e) => {
  const li = e.target.closest(".task");
  if (!li || !state.dragId) return;
  e.preventDefault();
  $$(".drag-over", list).forEach((x) => x.classList.remove("drag-over"));
  if (li.dataset.id !== state.dragId) li.classList.add("drag-over");
});
list.addEventListener("drop", (e) => {
  e.preventDefault();
  const li = e.target.closest(".task");
  if (!li || !state.dragId || li.dataset.id === state.dragId) return;
  const to = tasks.findIndex((t) => t.id === li.dataset.id);
  const from = tasks.findIndex((t) => t.id === state.dragId);
  const [moved] = tasks.splice(from, 1);
  tasks.splice(to, 0, moved);
  saveToLocalStorage();
  render();
});
list.addEventListener("dragend", () => {
  state.dragId = null;
  $$(".dragging, .drag-over", list).forEach((x) => x.classList.remove("dragging", "drag-over"));
});

/* ---------- Filters, search, clear completed ---------- */
$$(".tab").forEach((tab) =>
  tab.addEventListener("click", () => {
    state.filter = tab.dataset.filter;
    $$(".tab").forEach((t) => t.setAttribute("aria-pressed", String(t === tab)));
    renderList();
  })
);
$("#search").addEventListener("input", (e) => { state.query = e.target.value; renderList(); });
$("#categoryFilter").addEventListener("change", (e) => { state.category = e.target.value; renderList(); });
$("#clearCompleted").addEventListener("click", () => {
  tasks = tasks.filter((t) => !t.done);
  saveToLocalStorage();
  render();
});

/* ---------- Theme toggle ---------- */
const root = document.documentElement;
const themeBtn = $("#themeToggle");
function applyTheme(theme) {
  root.setAttribute("data-theme", theme);
  themeBtn.setAttribute("aria-label", theme === "dark" ? "Switch to light theme" : "Switch to dark theme");
  try { localStorage.setItem("theme", theme); } catch (e) { /* storage blocked */ }
}
applyTheme(root.getAttribute("data-theme") || "light");
themeBtn.addEventListener("click", () => applyTheme(root.getAttribute("data-theme") === "dark" ? "light" : "dark"));

$("#year").textContent = new Date().getFullYear();
$("#todayLabel").textContent = new Date().toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" });
render();