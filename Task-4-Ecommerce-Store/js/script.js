"use strict";


const API_URL = "https://fakestoreapi.com/products";
const TAX_RATE = 0.08;          
const SHIPPING_FLAT = 5.99;      
const FREE_SHIPPING_OVER = 50;   
const MAX_QTY = 10;
const KEYS = { cart: "velora.cart", wishlist: "velora.wishlist" };
const CATEGORIES = ["All", "Electronics", "Jewelry", "Clothing", "Saved"];
const GROUPS = { electronics: "Electronics", jewelery: "Jewelry", "men's clothing": "Clothing", "women's clothing": "Clothing" };

const $ = (selector, scope = document) => scope.querySelector(selector);
const read = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch (e) { return fallback; } };
const write = (key, value) => { try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* storage blocked */ } };
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const money = (n) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
const round2 = (n) => Math.round(n * 100) / 100;

const state = {
  products: [],
  status: "loading", // loading | ready | error
  category: "All",
  query: "",
  sort: "featured",
  cart: read(KEYS.cart, []).filter((i) => i && Number.isFinite(i.id) && Number.isFinite(i.price) && i.qty > 0),
  wishlist: read(KEYS.wishlist, []),
};

const ICON_HEART = '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s-8-5-8-11a4.5 4.5 0 0 1 8-2.8A4.5 4.5 0 0 1 20 10c0 6-8 11-8 11z"/></svg>';

function normalize(p) {
  const onSale = p.id % 4 === 0; 
  return {
    id: p.id,
    title: p.title,
    description: p.description,
    image: p.image,
    group: GROUPS[p.category] || "Other",
    rate: p.rating?.rate ?? 0,
    count: p.rating?.count ?? 0,
    price: onSale ? round2(p.price * 0.85) : p.price,
    oldPrice: onSale ? p.price : null,
  };
}

function badgesFor(p) {
  const list = [];
  if (p.oldPrice) list.push({ text: "Sale -15%", cls: "sale" });
  if (p.rate >= 4.5) list.push({ text: "Top rated", cls: "top" });
  if (p.count >= 400) list.push({ text: "Bestseller", cls: "" });
  return list;
}

async function loadProducts() {
  state.status = "loading";
  renderProducts();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  try {
    const res = await fetch(API_URL, { signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const list = await res.json();
    if (!Array.isArray(list)) throw new Error("Unexpected response");
    state.products = list.map(normalize);
    state.status = "ready";
  } catch (err) {
    console.error("Could not load products:", err);
    state.status = "error";
  } finally {
    clearTimeout(timer);
  }
  renderChips();
  renderProducts();
  renderHero();
}

function visibleProducts() {
  const q = state.query.trim().toLowerCase();
  const list = state.products.filter(
    (p) =>
      (state.category === "All" || (state.category === "Saved" ? state.wishlist.includes(p.id) : p.group === state.category)) &&
      (!q || p.title.toLowerCase().includes(q) || p.description.toLowerCase().includes(q))
  );
  const sorts = {
    price_asc: (a, b) => a.price - b.price,
    price_desc: (a, b) => b.price - a.price,
    rating: (a, b) => b.rate - a.rate || b.count - a.count,
  };
  return sorts[state.sort] ? [...list].sort(sorts[state.sort]) : list;
}


const saveCart = () => write(KEYS.cart, state.cart);

function addToCart(id, qty = 1) {
  const product = state.products.find((p) => p.id === id);
  if (!product) return;
  const item = state.cart.find((i) => i.id === id);
  if (item) item.qty = Math.min(item.qty + qty, MAX_QTY);
  else state.cart.push({ id, title: product.title, price: product.price, image: product.image, qty });
  saveCart();
  renderCart();
  bumpBadge();
  toast(`Added to cart: ${product.title.length > 34 ? product.title.slice(0, 34) + "…" : product.title}`);
}

function removeFromCart(id) {
  state.cart = state.cart.filter((i) => i.id !== id);
  saveCart();
  renderCart();
}

function updateQuantity(id, qty) {
  const item = state.cart.find((i) => i.id === id);
  if (!item) return;
  if (qty <= 0) return removeFromCart(id);
  item.qty = Math.min(qty, MAX_QTY);
  saveCart();
  renderCart();
}

function calculateTotal() {
  const count = state.cart.reduce((sum, i) => sum + i.qty, 0);
  const subtotal = round2(state.cart.reduce((sum, i) => sum + i.price * i.qty, 0));
  const shipping = subtotal === 0 || subtotal >= FREE_SHIPPING_OVER ? 0 : SHIPPING_FLAT;
  const tax = round2(subtotal * TAX_RATE);
  return { count, subtotal, shipping, tax, total: round2(subtotal + shipping + tax) };
}


const starsHTML = (rate) => `<span class="stars" style="--r:${((rate / 5) * 100).toFixed(0)}%" aria-hidden="true"></span>`;

function renderChips() {
  const counts = { All: state.products.length, Saved: state.wishlist.length };
  state.products.forEach((p) => { counts[p.group] = (counts[p.group] || 0) + 1; });
  $("#chips").innerHTML = CATEGORIES.map(
    (c) => `<button class="chip" type="button" data-cat="${c}" aria-pressed="${c === state.category}">${c}<span>${counts[c] || 0}</span></button>`
  ).join("");
}

function productCard(p, index) {
  const wished = state.wishlist.includes(p.id);
  return `<article class="product" data-id="${p.id}" style="animation-delay:${Math.min(index, 12) * 40}ms">
    <div class="product-media">
      <div class="badges">${badgesFor(p).map((b) => `<span class="badge ${b.cls}">${b.text}</span>`).join("")}</div>
      <button class="wish ${wished ? "on" : ""}" type="button" data-action="wish" aria-pressed="${wished}" aria-label="${wished ? "Remove from" : "Save to"} favourites">${ICON_HEART}</button>
      <button class="media-btn" type="button" data-action="view" aria-label="View details: ${esc(p.title)}"><img src="${esc(p.image)}" alt="" loading="lazy" /></button>
    </div>
    <div class="product-body">
      <span class="product-cat">${p.group}</span>
      <h3 class="product-title"><button type="button" data-action="view">${esc(p.title)}</button></h3>
      <div class="rating">${starsHTML(p.rate)}<span>${p.rate.toFixed(1)} (${p.count})</span></div>
      <div class="price-row"><strong>${money(p.price)}</strong>${p.oldPrice ? `<s>${money(p.oldPrice)}</s>` : ""}</div>
      <button class="btn btn-add" type="button" data-action="add">Add to cart</button>
    </div>
  </article>`;
}

function renderProducts() {
  const grid = $("#productGrid");
  const count = $("#resultCount");
  if (state.status === "loading") {
    grid.innerHTML = Array.from({ length: 8 }, () => '<div class="skeleton"><i></i><i></i><i></i><i></i></div>').join("");
    count.textContent = "Loading products…";
    return;
  }
  if (state.status === "error") {
    grid.innerHTML = '<div class="state"><h3>We couldn\'t load the products</h3><p>Check your internet connection, then try again. The product service may also be busy.</p><button class="btn btn-brand" type="button" data-action="retry">Try again</button></div>';
    count.textContent = "";
    return;
  }
  const list = visibleProducts();
  count.textContent = `${list.length} ${list.length === 1 ? "product" : "products"}`;
  grid.innerHTML = list.length
    ? list.map(productCard).join("")
    : `<div class="state"><h3>${state.category === "Saved" && !state.query ? "No saved items yet" : "No products found"}</h3><p>${state.category === "Saved" && !state.query ? "Tap the heart on a product to save it here." : "Try a different search or category."}</p></div>`;
}

function renderHero() {
  const top = [...state.products].sort((a, b) => b.rate - a.rate || b.count - a.count).slice(0, 3);
  $("#heroPics").innerHTML = top.map((p) => `<div><img src="${esc(p.image)}" alt="" /></div>`).join("");
}

function renderCart() {
  const t = calculateTotal();
  const countEl = $("#cartCount");
  countEl.textContent = t.count;
  $("#cartBtn").setAttribute("aria-label", `Open cart, ${t.count} ${t.count === 1 ? "item" : "items"}`);
  $("#cartTitleCount").textContent = t.count ? `(${t.count})` : "";

  const empty = state.cart.length === 0;
  $("#cartEmpty").hidden = !empty;
  $("#cartFoot").hidden = empty;
  $("#cartItems").hidden = empty;
  $("#shipMeter").hidden = empty;

  $("#cartItems").innerHTML = state.cart
    .map(
      (i) => `<li class="line" data-id="${i.id}">
        <img src="${esc(i.image)}" alt="" />
        <div><p class="line-title">${esc(i.title)}</p><p class="line-price">${money(i.price)}</p>
          <div class="qty"><button type="button" data-action="dec" aria-label="Decrease quantity">&minus;</button><span aria-live="polite">${i.qty}</span><button type="button" data-action="inc" aria-label="Increase quantity" ${i.qty >= MAX_QTY ? "disabled" : ""}>+</button></div>
        </div>
        <div class="line-side"><strong>${money(i.price * i.qty)}</strong><button class="link" type="button" data-action="remove" aria-label="Remove ${esc(i.title)}">Remove</button></div>
      </li>`
    )
    .join("");

  if (empty) return;
  const left = FREE_SHIPPING_OVER - t.subtotal;
  $("#shipText").innerHTML = left > 0 ? `Add <strong>${money(left)}</strong> more for free shipping` : "<strong>You've unlocked free shipping!</strong>";
  $("#shipBar").style.width = `${Math.min((t.subtotal / FREE_SHIPPING_OVER) * 100, 100)}%`;
  $("#cartSummary").innerHTML = `
    <div><dt>Subtotal</dt><dd>${money(t.subtotal)}</dd></div>
    <div><dt>Shipping</dt><dd class="${t.shipping === 0 ? "free" : ""}">${t.shipping === 0 ? "Free" : money(t.shipping)}</dd></div>
    <div><dt>Tax (${TAX_RATE * 100}%)</dt><dd>${money(t.tax)}</dd></div>
    <div class="grand"><dt>Total</dt><dd>${money(t.total)}</dd></div>`;
}

function bumpBadge() {
  const el = $("#cartCount");
  el.classList.remove("bump");
  void el.offsetWidth; // restart the animation
  el.classList.add("bump");
}

function toast(message) {
  const el = document.createElement("div");
  el.className = "toast";
  el.textContent = message;
  $("#toasts").append(el);
  setTimeout(() => el.classList.add("out"), 2200);
  setTimeout(() => el.remove(), 2600);
}


$("#productGrid").addEventListener("click", (e) => {
  const btn = e.target.closest("[data-action]");
  if (!btn) return;
  if (btn.dataset.action === "retry") return loadProducts();
  const id = Number(btn.closest(".product")?.dataset.id);
  if (btn.dataset.action === "view") openProduct(id);
  if (btn.dataset.action === "wish") toggleWish(id);
  if (btn.dataset.action === "add") {
    addToCart(id);
    btn.textContent = "Added ✓";
    btn.classList.add("added");
    setTimeout(() => { btn.textContent = "Add to cart"; btn.classList.remove("added"); }, 1200);
  }
});

function toggleWish(id) {
  state.wishlist = state.wishlist.includes(id) ? state.wishlist.filter((x) => x !== id) : [...state.wishlist, id];
  write(KEYS.wishlist, state.wishlist);
  renderChips();
  renderProducts();
}

$("#chips").addEventListener("click", (e) => {
  const chip = e.target.closest("[data-cat]");
  if (!chip) return;
  state.category = chip.dataset.cat;
  renderChips();
  renderProducts();
});
$("#sort").addEventListener("change", (e) => { state.sort = e.target.value; renderProducts(); });

let searchTimer;
$("#search").addEventListener("input", (e) => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => { state.query = e.target.value; renderProducts(); }, 150);
});


const productModal = $("#productModal");
let openId = null;

function openProduct(id) {
  const p = state.products.find((x) => x.id === id);
  if (!p) return;
  openId = id;
  $("#pmImage").src = p.image;
  $("#pmImage").alt = p.title;
  $("#pmCat").textContent = p.group;
  $("#pmTitle").textContent = p.title;
  $("#pmDesc").textContent = p.description;
  $("#pmRating").innerHTML = `${starsHTML(p.rate)}<span>${p.rate.toFixed(1)} (${p.count} reviews)</span>`;
  $("#pmPrice").innerHTML = `<strong>${money(p.price)}</strong>${p.oldPrice ? `<s>${money(p.oldPrice)}</s>` : ""}`;
  productModal.showModal();
}
$("#pmAdd").addEventListener("click", () => addToCart(openId));
$("#pmClose").addEventListener("click", () => productModal.close());
productModal.addEventListener("click", (e) => { if (e.target === productModal) productModal.close(); });


const drawer = $("#cartDrawer");
const overlay = $("#overlay");
let lastFocus = null;

function openCart() {
  lastFocus = document.activeElement;
  drawer.classList.add("open");
  overlay.classList.add("open");
  drawer.setAttribute("aria-hidden", "false");
  document.body.classList.add("locked");
  $("#cartClose").focus();
}
function closeCart() {
  drawer.classList.remove("open");
  overlay.classList.remove("open");
  drawer.setAttribute("aria-hidden", "true");
  document.body.classList.remove("locked");
  lastFocus?.focus();
}

$("#cartBtn").addEventListener("click", openCart);
$("#cartClose").addEventListener("click", closeCart);
$("#keepShopping").addEventListener("click", closeCart);
overlay.addEventListener("click", closeCart);
document.addEventListener("keydown", (e) => { if (e.key === "Escape" && drawer.classList.contains("open")) closeCart(); });
$("#clearCart").addEventListener("click", () => { state.cart = []; saveCart(); renderCart(); });

$("#cartItems").addEventListener("click", (e) => {
  const btn = e.target.closest("[data-action]");
  if (!btn) return;
  const id = Number(btn.closest(".line").dataset.id);
  const item = state.cart.find((i) => i.id === id);
  if (btn.dataset.action === "remove") return removeFromCart(id);
  updateQuantity(id, item.qty + (btn.dataset.action === "inc" ? 1 : -1));
  $(`.line[data-id="${id}"] [data-action="${btn.dataset.action}"]`)?.focus(); // keep keyboard focus
});


const checkout = $("#checkoutModal");
const coForm = $("#coForm");
const coDone = $("#coDone");

$("#checkoutBtn").addEventListener("click", () => {
  const t = calculateTotal();
  $("#coSummary").textContent = `${t.count} ${t.count === 1 ? "item" : "items"} · Total ${money(t.total)}`;
  closeCart();
  checkout.showModal();
});
$("#coClose").addEventListener("click", () => checkout.close());
$("#coContinue").addEventListener("click", () => checkout.close());
checkout.addEventListener("close", () => { coForm.hidden = false; coDone.hidden = true; coForm.reset(); });

function fieldError(id, message) {
  $(`#${id}`).closest(".field").classList.toggle("invalid", Boolean(message));
  $(`#${id}Error`).textContent = message;
}

coForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const name = $("#coName").value.trim();
  const email = $("#coEmail").value.trim();
  const address = $("#coAddress").value.trim();
  fieldError("coName", name.length < 2 ? "Please enter your full name." : "");
  fieldError("coEmail", /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? "" : "Enter a valid email address.");
  fieldError("coAddress", address.length < 6 ? "Please enter your shipping address." : "");
  if (coForm.querySelector(".invalid")) return coForm.querySelector(".invalid input").focus();

  const submit = $("#coSubmit");
  submit.disabled = true;
  submit.textContent = "Processing…";
  setTimeout(() => {
    const t = calculateTotal();
    const orderId = "VEL-" + Math.random().toString(36).slice(2, 8).toUpperCase();
    const eta = new Date(Date.now() + 4 * 864e5).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
    $("#coDoneText").textContent = `Thank you, ${name.split(" ")[0]}! A confirmation would be sent to ${email}.`;
    $("#coMeta").innerHTML = `
      <div><dt>Order number</dt><dd>${orderId}</dd></div>
      <div><dt>Items</dt><dd>${t.count}</dd></div>
      <div><dt>Total paid</dt><dd>${money(t.total)}</dd></div>
      <div><dt>Estimated delivery</dt><dd>${eta}</dd></div>`;
    state.cart = [];
    saveCart();
    renderCart();
    coForm.hidden = true;
    coDone.hidden = false;
    submit.disabled = false;
    submit.textContent = "Place order";
  }, 900);
});
["coName", "coEmail", "coAddress"].forEach((id) => $(`#${id}`).addEventListener("input", () => fieldError(id, "")));



$("#year").textContent = new Date().getFullYear();
renderChips();
renderCart();
loadProducts();