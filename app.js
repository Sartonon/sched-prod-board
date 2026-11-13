import { fetchIncidents, ack } from './api.js';

const REFRESH_MS = 2000; // R4

const list = document.querySelector('[data-testid="incident-list"]');
const loader = document.querySelector('[data-testid="loader"]');
const empty = document.querySelector('[data-testid="empty"]');
const status = document.querySelector('[data-role="status"]');

// R5: the viewer's own zone and the viewer's own date order (en-GB, de, fr … → dd/mm).
const fmt = new Intl.DateTimeFormat(navigator.languages?.[0] || navigator.language, {
  year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
});

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

const rows = new Map(); // id -> <li>, kept across refreshes so acked state and focus survive

function makeRow(i) {
  const li = document.createElement('li');
  li.className = `row ${esc(i.severity)}`;
  li.setAttribute('data-testid', 'incident-row');
  li.dataset.id = i.id;
  li.innerHTML = `
    <span class="id">${esc(i.id)}</span>
    <span class="sev">${esc(i.severity)}</span>
    <span class="what">${esc(i.service)} · ${esc(i.region)} · ${esc(i.summary)}</span>
    <time datetime="${esc(i.openedAt)}">${esc(fmt.format(new Date(i.openedAt)))}</time>
    <span class="act"><button type="button" data-testid="ack">Ack</button></span>`;
  li.querySelector('[data-testid="ack"]').addEventListener('click', (e) => askConfirm(i, e.currentTarget));
  return li;
}

// Product's decision (step 2): Ack asks to confirm, and the confirm names the incident id.
// The confirm is a fixed panel, so it holds still while new incidents arrive in the list behind it.
const confirmBox = document.querySelector('[data-testid="confirm"]');
const confirmText = confirmBox.querySelector('[data-role="confirm-text"]');
const confirmAck = confirmBox.querySelector('[data-testid="confirm-ack"]');
const confirmCancel = confirmBox.querySelector('[data-testid="confirm-cancel"]');
let pending = null; // { incident, button }

function askConfirm(incident, button) {
  pending = { incident, button };
  confirmText.textContent = `Ack ${incident.id}? ${incident.severity} · ${incident.service} · ${incident.region} · ${incident.summary}`;
  confirmAck.textContent = `Ack ${incident.id}`;
  confirmBox.hidden = false;
  confirmAck.focus();
}
function closeConfirm() {
  const p = pending;
  pending = null;
  confirmBox.hidden = true;
  p?.button.isConnected && !p.button.disabled && p.button.focus();
}
confirmCancel.addEventListener('click', closeConfirm);
confirmAck.addEventListener('click', () => {
  const p = pending;
  closeConfirm();
  if (p) sendAck(p.incident.id, p.button);
});
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && pending) closeConfirm(); });

async function sendAck(id, button) {
  button.disabled = true;
  button.textContent = 'Acking…';
  try {
    const reply = await ack(id);
    const cell = button.parentElement;
    cell.innerHTML = `<span data-testid="acked" class="acked" title="${esc(reply.ackedAt)}">✓ acked</span>`;
    rows.get(id)?.classList.add('is-acked');
  } catch (err) {
    console.error(err);
    button.disabled = false;
    button.textContent = 'Ack';
    status.textContent = 'ack failed, try again';
  }
}

// R1: newest first; new ids go in at the top, rows already on screen are kept as they are.
function render(incidents) {
  const seen = new Set();
  incidents.forEach((i, idx) => {
    seen.add(i.id);
    let li = rows.get(i.id);
    if (!li) { li = makeRow(i); rows.set(i.id, li); }
    if (list.children[idx] !== li) list.insertBefore(li, list.children[idx] || null);
  });
  for (const [id, li] of rows) if (!seen.has(id)) { li.remove(); rows.delete(id); }
  empty.hidden = incidents.length > 0;
  list.hidden = incidents.length === 0;
}

let loaded = false;
async function refresh() {
  try {
    const page = await fetchIncidents();
    render(page.incidents);
    status.textContent = `updated ${fmt.format(new Date(page.updatedAt || Date.now()))}`;
    if (!loaded) { loaded = true; loader.remove(); } // R3
  } catch (err) {
    console.error(err);
    status.textContent = 'offline, retrying';
  } finally {
    setTimeout(refresh, REFRESH_MS); // R4: no overlapping polls
  }
}

refresh();
