import { supabase } from './supabaseClient';

let allDebts = [];
let activeFilter = 'all';
let editingId = null;
let currentUser = null;

// --- Auth (Supabase) ---
function showLogin() {
  document.getElementById('lock-screen').style.display = 'flex';
  document.getElementById('app').classList.add('app-hidden');
}

function showApp() {
  document.getElementById('lock-screen').style.display = 'none';
  document.getElementById('app').classList.remove('app-hidden');
  loadDebts();
}

async function setupAuth() {
  if (!supabase) {
    document.getElementById('lock-error').textContent =
      'Brak połączenia z Supabase. Dodaj zmienne środowiskowe VITE_SUPABASE_URL i VITE_SUPABASE_ANON_KEY.';
    return;
  }

  // Sprawdź istniejącą sesję
  const { data: { session } } = await supabase.auth.getSession();
  currentUser = session?.user || null;
  if (currentUser) showApp();
  else showLogin();

  // Reaguj na zmiany stanu logowania
  supabase.auth.onAuthStateChange((_event, session) => {
    currentUser = session?.user || null;
    if (currentUser) showApp();
    else showLogin();
  });

  // Formularz logowania
  const form = document.getElementById('lock-form');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;
    const err = document.getElementById('lock-error');
    const btn = document.getElementById('login-btn');

    err.textContent = '';
    btn.disabled = true;
    btn.textContent = 'Logowanie...';

    const { error } = await supabase.auth.signInWithPassword({ email, password });

    btn.disabled = false;
    btn.textContent = 'Zaloguj';

    if (error) {
      err.textContent = 'Błędny e-mail lub hasło.';
      document.getElementById('login-password').value = '';
    }
  });

  document.getElementById('login-email').focus();
}

document.getElementById('logout-btn').addEventListener('click', async (e) => {
  e.preventDefault();
  if (supabase) await supabase.auth.signOut();
});

// --- Data ---
async function loadDebts() {
  if (!supabase) {
    renderDebts([]);
    document.getElementById('debts-list').innerHTML =
      '<p class="empty-state">Brak połączenia z Supabase. Dodaj zmienne środowiskowe.</p>';
    return;
  }

  const { data, error } = await supabase
    .from('debts')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error(error);
    return;
  }

  allDebts = data || [];
  renderDebts(filterDebts());
  updateSummary();
}

function filterDebts() {
  if (activeFilter === 'all') return allDebts;
  if (activeFilter === 'subscription') return allDebts.filter((d) => isSubscription(d));
  // Filtry typów dotyczą tylko zadłużeń
  return allDebts.filter((d) => !isSubscription(d) && d.type === activeFilter);
}

function isPaid(d) {
  return d.status === 'oplacone';
}

function updateSummary() {
  const debts = allDebts.filter((d) => !isSubscription(d));
  const subs = allDebts.filter((d) => isSubscription(d) && d.active !== false);

  // Łączne zadłużenie — tylko nieopłacone długi
  const totalDebt = debts
    .filter((d) => !isPaid(d))
    .reduce((s, d) => s + (d.remaining_amount || 0), 0);

  // Miesięczne stałe opłaty (aktywne subskrypcje, rozłożone na miesiąc)
  const totalSubs = subs.reduce((s, d) => s + monthlyEquiv(d), 0);

  // Miesięczne obciążenie = raty długów + stałe opłaty
  const debtMonthly = debts
    .filter((d) => !isPaid(d))
    .reduce((s, d) => {
      if (d.monthly_payment) return s + d.monthly_payment;
      // Dla długów opartych na ratach: suma nieopłaconych rat / liczba pozostałych miesięcy
      const inst = getInstallments(d);
      if (inst.length > 0) {
        const unpaid = inst.filter((i) => !i.paid);
        if (unpaid.length === 0) return s;
        const datesWithDate = unpaid.filter((i) => i.due_date).map((i) => new Date(i.due_date));
        if (datesWithDate.length > 0) {
          const now = new Date();
          const last = new Date(Math.max(...datesWithDate));
          const months = Math.max(
            1,
            (last.getFullYear() - now.getFullYear()) * 12 + (last.getMonth() - now.getMonth()) + 1
          );
          const remaining = unpaid.reduce((r, i) => r + (Number(i.amount) || 0), 0);
          return s + remaining / months;
        }
        // Brak dat — podziel po liczbie nieopłaconych rat
        const remaining = unpaid.reduce((r, i) => r + (Number(i.amount) || 0), 0);
        return s + remaining / unpaid.length;
      }
      return s;
    }, 0);
  const totalMonthly = debtMonthly + totalSubs;

  document.getElementById('total-debt').textContent = formatPLN(totalDebt);
  document.getElementById('total-monthly').textContent = totalMonthly > 0 ? formatPLN(totalMonthly) : '— zł';
  document.getElementById('total-subs').textContent = totalSubs > 0 ? formatPLN(totalSubs) : '— zł';

  renderMonthlyBreakdown(totalMonthly);
}

function renderMonthlyBreakdown(totalMonthly) {
  const el = document.getElementById('monthly-breakdown');
  if (!el) return;

  // Grupuj miesięczne obciążenie wg typu
  const groups = {};
  for (const d of allDebts) {
    const amount = monthlyAmount(d);
    if (amount <= 0) continue;
    const key = d.type || 'inne';
    groups[key] = (groups[key] || 0) + amount;
  }

  const entries = Object.entries(groups)
    .map(([type, amount]) => ({ type, amount, label: TYPE_LABELS[type] || type, color: TYPE_COLORS[type] || '#8e8e93' }))
    .sort((a, b) => b.amount - a.amount);

  if (entries.length === 0 || totalMonthly <= 0) { el.style.display = 'none'; return; }
  el.style.display = '';

  const stackedSegments = entries
    .map((e) => `<div class="breakdown-seg" style="width:${((e.amount / totalMonthly) * 100).toFixed(1)}%;background:${e.color}" title="${e.label}: ${formatPLN(e.amount)}"></div>`)
    .join('');

  const rows = entries
    .map((e) => {
      const pct = Math.round((e.amount / totalMonthly) * 100);
      return `
        <div class="breakdown-row">
          <span class="breakdown-dot" style="background:${e.color}"></span>
          <span class="breakdown-label">${e.label}</span>
          <div class="breakdown-bar-wrap"><div class="breakdown-bar" style="width:${pct}%;background:${e.color}"></div></div>
          <span class="breakdown-amount">${formatPLN(e.amount)}/mies.</span>
          <span class="breakdown-pct">${pct}%</span>
        </div>`;
    })
    .join('');

  el.innerHTML = `
    <div class="breakdown-header">
      <span class="breakdown-title">Miesięczne obciążenie — z czego wynika</span>
      <span class="breakdown-total">${formatPLN(totalMonthly)}/mies.</span>
    </div>
    <div class="breakdown-stacked">${stackedSegments}</div>
    <div class="breakdown-rows">${rows}</div>
  `;
}

// Miesięczny wkład danej pozycji w obciążenie
function monthlyAmount(d) {
  if (isSubscription(d)) return d.active !== false ? monthlyEquiv(d) : 0;
  if (isPaid(d)) return 0;
  if (d.monthly_payment) return d.monthly_payment;
  const inst = getInstallments(d);
  if (inst.length === 0) return 0;
  const unpaid = inst.filter((i) => !i.paid);
  if (unpaid.length === 0) return 0;
  const datesWithDate = unpaid.filter((i) => i.due_date).map((i) => new Date(i.due_date));
  const remaining = unpaid.reduce((r, i) => r + (Number(i.amount) || 0), 0);
  if (datesWithDate.length > 0) {
    const now = new Date();
    const last = new Date(Math.max(...datesWithDate));
    const months = Math.max(1, (last.getFullYear() - now.getFullYear()) * 12 + (last.getMonth() - now.getMonth()) + 1);
    return remaining / months;
  }
  return remaining / unpaid.length;
}

function formatPLN(amount) {
  return new Intl.NumberFormat('pl-PL', { style: 'currency', currency: 'PLN' }).format(amount);
}

function formatDate(s) {
  return new Date(s).toLocaleDateString('pl-PL', { day: 'numeric', month: 'short', year: 'numeric' });
}

// Wylicz wartości z listy rat
function deriveFromInstallments(inst) {
  const total = inst.reduce((s, i) => s + (Number(i.amount) || 0), 0);
  const remaining = inst.filter((i) => !i.paid).reduce((s, i) => s + (Number(i.amount) || 0), 0);
  const allPaid = inst.length > 0 && inst.every((i) => i.paid);
  return { total, remaining, allPaid };
}

function getInstallments(d) {
  return Array.isArray(d.installments) ? d.installments : [];
}

const TYPE_LABELS = {
  kredyt: 'Kredyt',
  paypo: 'PayPo / BNPL',
  studia: 'Studia',
  inne: 'Inne',
  komorka: 'Sieć komórkowa',
  internet: 'Internet',
  streaming: 'Streaming',
  sub_inne: 'Stała opłata',
};

const TYPE_COLORS = {
  kredyt: '#007aff',
  paypo: '#ff9500',
  studia: '#34c759',
  inne: '#8e8e93',
  komorka: '#af52de',
  internet: '#5856d6',
  streaming: '#ff2d55',
  sub_inne: '#8e8e93',
};

function isSubscription(d) {
  return d.kind === 'subscription';
}

// Miesięczny koszt subskrypcji (rozłożenie rocznych na 12)
function monthlyEquiv(d) {
  const amount = Number(d.monthly_payment) || 0;
  return d.billing_cycle === 'yearly' ? amount / 12 : amount;
}

function renderSubscriptionCard(d) {
  const color = TYPE_COLORS[d.type] || '#8e8e93';
  const active = d.active !== false;
  const cycleLabel = d.billing_cycle === 'yearly' ? '/rok' : '/mies.';
  const amount = Number(d.monthly_payment) || 0;
  const dayStr = d.payment_day ? `${d.payment_day}. dnia miesiąca` : null;

  return `
    <div class="debt-card glass ${active ? '' : 'is-paid'}" data-id="${d.id}">
      <div class="debt-card-top">
        <div class="debt-info">
          <div class="debt-badges">
            <span class="debt-type-badge" style="background:${color}22;color:${color}">${TYPE_LABELS[d.type] || 'Stała opłata'}</span>
            <span class="status-badge ${active ? 'status-paid' : 'status-due'}">${active ? 'Aktywna' : 'Wstrzymana'}</span>
          </div>
          <h3 class="debt-name">${d.name}</h3>
          ${d.notes ? `<p class="debt-notes">${d.notes}</p>` : ''}
        </div>
        <div class="debt-amount-block">
          <span class="debt-remaining">${formatPLN(amount)}</span>
          <span class="debt-total">${cycleLabel}</span>
        </div>
      </div>
      <div class="debt-card-bottom">
        <div class="debt-meta">
          <span class="meta-item">🔁 Stała opłata</span>
          ${dayStr ? `<span class="meta-item">📅 ${dayStr}</span>` : ''}
          ${d.billing_cycle === 'yearly' ? `<span class="meta-item">≈ ${formatPLN(monthlyEquiv(d))}/mies.</span>` : ''}
        </div>
        <div class="debt-actions">
          <button class="icon-btn toggle-active-btn" data-id="${d.id}" title="${active ? 'Wstrzymaj' : 'Wznów'}">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${active ? '<rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/>' : '<polygon points="5 3 19 12 5 21 5 3"/>'}</svg>
          </button>
          <button class="icon-btn edit-debt-btn" data-id="${d.id}" title="Edytuj">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
          </button>
          <button class="icon-btn delete-debt-btn" data-id="${d.id}" title="Usuń">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
          </button>
        </div>
      </div>
    </div>
  `;
}

function renderDebts(debts) {
  const list = document.getElementById('debts-list');

  if (debts.length === 0) {
    list.innerHTML = '<p class="empty-state">Brak pozycji. Kliknij "+ Dodaj", aby dodać zadłużenie.</p>';
    return;
  }

  list.innerHTML = debts
    .map((d) => {
      if (isSubscription(d)) return renderSubscriptionCard(d);

      const inst = [...getInstallments(d)].sort((a, b) => {
        if (!a.due_date) return 1;
        if (!b.due_date) return -1;
        return new Date(a.due_date) - new Date(b.due_date);
      });
      const hasInst = inst.length > 0;
      const paidCount = inst.filter((i) => i.paid).length;

      let progress = null;
      if (hasInst) {
        const { total, remaining } = deriveFromInstallments(inst);
        if (total > 0) progress = Math.round(((total - remaining) / total) * 100);
      } else if (d.total_amount && d.remaining_amount) {
        progress = Math.round(((d.total_amount - d.remaining_amount) / d.total_amount) * 100);
      }

      const dueStr = d.due_date ? formatDate(d.due_date) : null;
      const color = TYPE_COLORS[d.type] || '#8e8e93';
      const paid = isPaid(d);

      const installmentsHtml = hasInst
        ? `
          <button class="installments-toggle" data-id="${d.id}">Raty: ${paidCount}/${inst.length} ▾</button>
          <div class="installments-sublist hidden" id="inst-${d.id}">
            ${inst
              .map(
                (i, idx) => `
              <div class="inst-row ${i.paid ? 'inst-paid' : ''}">
                <span class="inst-date">${i.due_date ? formatDate(i.due_date) : '—'}</span>
                <span class="inst-amount">${formatPLN(Number(i.amount) || 0)}</span>
                <button class="inst-toggle-btn" data-id="${d.id}" data-idx="${idx}">${i.paid ? '✓ Opłacona' : 'Opłać'}</button>
              </div>`
              )
              .join('')}
          </div>`
        : '';

      return `
        <div class="debt-card glass ${paid ? 'is-paid' : ''}" data-id="${d.id}">
          <div class="debt-card-top">
            <div class="debt-info">
              <div class="debt-badges">
                <span class="debt-type-badge" style="background:${color}22;color:${color}">${TYPE_LABELS[d.type] || d.type}</span>
                <span class="status-badge ${paid ? 'status-paid' : 'status-due'}">${paid ? 'Opłacone' : 'Do zapłaty'}</span>
              </div>
              <h3 class="debt-name">${d.name}</h3>
              ${d.notes ? `<p class="debt-notes">${d.notes}</p>` : ''}
            </div>
            <div class="debt-amount-block">
              <span class="debt-remaining">${formatPLN(d.remaining_amount)}</span>
              ${d.total_amount ? `<span class="debt-total">z ${formatPLN(d.total_amount)}</span>` : ''}
            </div>
          </div>
          ${
            progress !== null
              ? `<div class="progress-bar-wrap">
              <div class="progress-bar" style="width:${progress}%;background:${color}"></div>
            </div>
            <span class="progress-label">${progress}% spłacone</span>`
              : ''
          }
          ${installmentsHtml}
          <div class="debt-card-bottom">
            <div class="debt-meta">
              ${!hasInst && d.monthly_payment ? `<span class="meta-item">📅 ${formatPLN(d.monthly_payment)}/mies.</span>` : ''}
              ${!hasInst && dueStr ? `<span class="meta-item">⏰ ${dueStr}</span>` : ''}
            </div>
            <div class="debt-actions">
              ${
                !hasInst
                  ? `<button class="icon-btn toggle-paid-btn" data-id="${d.id}" title="${paid ? 'Oznacz jako do zapłaty' : 'Oznacz jako opłacone'}">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
              </button>`
                  : ''
              }
              <button class="icon-btn edit-debt-btn" data-id="${d.id}" title="Edytuj">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
              </button>
              <button class="icon-btn delete-debt-btn" data-id="${d.id}" title="Usuń">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
              </button>
            </div>
          </div>
        </div>
      `;
    })
    .join('');

  list.querySelectorAll('.toggle-paid-btn').forEach((btn) => {
    btn.addEventListener('click', () => togglePaid(btn.dataset.id));
  });

  list.querySelectorAll('.toggle-active-btn').forEach((btn) => {
    btn.addEventListener('click', () => toggleActive(btn.dataset.id));
  });

  list.querySelectorAll('.installments-toggle').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.getElementById(`inst-${btn.dataset.id}`).classList.toggle('hidden');
    });
  });

  list.querySelectorAll('.inst-toggle-btn').forEach((btn) => {
    btn.addEventListener('click', () => toggleInstallmentPaid(btn.dataset.id, Number(btn.dataset.idx)));
  });

  list.querySelectorAll('.edit-debt-btn').forEach((btn) => {
    btn.addEventListener('click', () => openEditModal(btn.dataset.id));
  });

  list.querySelectorAll('.delete-debt-btn').forEach((btn) => {
    btn.addEventListener('click', () => deleteDebt(btn.dataset.id));
  });
}

async function togglePaid(id) {
  const debt = allDebts.find((d) => String(d.id) === String(id));
  if (!debt) return;
  const newStatus = isPaid(debt) ? 'do_zaplaty' : 'oplacone';
  const { error } = await supabase.from('debts').update({ status: newStatus }).eq('id', id);
  if (error) { alert('Błąd zmiany statusu: ' + error.message); return; }
  loadDebts();
}

// Wstrzymaj / wznów subskrypcję
async function toggleActive(id) {
  const debt = allDebts.find((d) => String(d.id) === String(id));
  if (!debt) return;
  const { error } = await supabase.from('debts').update({ active: debt.active === false }).eq('id', id);
  if (error) { alert('Błąd zmiany statusu: ' + error.message); return; }
  loadDebts();
}

// Przełącz status pojedynczej raty i przelicz pozycję
async function toggleInstallmentPaid(id, idx) {
  const debt = allDebts.find((d) => String(d.id) === String(id));
  if (!debt) return;
  const inst = getInstallments(debt).map((i) => ({ ...i }));
  if (!inst[idx]) return;
  inst[idx].paid = !inst[idx].paid;

  const { total, remaining, allPaid } = deriveFromInstallments(inst);
  const { error } = await supabase
    .from('debts')
    .update({
      installments: inst,
      total_amount: total,
      remaining_amount: remaining,
      status: allPaid ? 'oplacone' : 'do_zaplaty',
    })
    .eq('id', id);
  if (error) { alert('Błąd zmiany statusu raty: ' + error.message); return; }
  loadDebts();
}

async function deleteDebt(id) {
  if (!confirm('Na pewno usunąć tę pozycję?')) return;
  const { error } = await supabase.from('debts').delete().eq('id', id);
  if (error) { alert('Błąd usuwania: ' + error.message); return; }
  loadDebts();
}

// --- Edytor rat w modalu ---
let editorInstallments = [];

function renderInstallmentsEditor() {
  const wrap = document.getElementById('installments-list');
  wrap.innerHTML = editorInstallments
    .map(
      (i, idx) => `
      <div class="rata-edit-row" data-idx="${idx}">
        <input type="number" class="rata-amount" placeholder="kwota" min="0" step="0.01" value="${i.amount ?? ''}" />
        <input type="date" class="rata-date" value="${i.due_date || ''}" />
        <label class="rata-paid"><input type="checkbox" class="rata-paid-check" ${i.paid ? 'checked' : ''} /> opł.</label>
        <button type="button" class="rata-remove" data-idx="${idx}" title="Usuń ratę">✕</button>
      </div>`
    )
    .join('');

  // Wiązanie zdarzeń: synchronizacja stanu i usuwanie
  wrap.querySelectorAll('.rata-edit-row').forEach((row) => {
    const idx = Number(row.dataset.idx);
    row.querySelector('.rata-amount').addEventListener('input', (e) => {
      editorInstallments[idx].amount = e.target.value;
    });
    row.querySelector('.rata-date').addEventListener('input', (e) => {
      editorInstallments[idx].due_date = e.target.value || null;
    });
    row.querySelector('.rata-paid-check').addEventListener('change', (e) => {
      editorInstallments[idx].paid = e.target.checked;
    });
  });
  wrap.querySelectorAll('.rata-remove').forEach((btn) => {
    btn.addEventListener('click', () => {
      editorInstallments.splice(Number(btn.dataset.idx), 1);
      renderInstallmentsEditor();
      updateInstallmentsHint();
    });
  });

  updateSingleFieldsVisibility();
}

function updateSingleFieldsVisibility() {
  // Gdy są raty, ukrywamy ręczne pola kwot (są wyliczane z rat)
  document.getElementById('single-amount-fields').style.display =
    editorInstallments.length > 0 ? 'none' : '';
}

function updateInstallmentsHint() {
  const hint = document.getElementById('installments-hint');
  if (editorInstallments.length === 0) {
    hint.textContent = '';
    return;
  }
  const norm = editorInstallments.map((i) => ({ amount: i.amount, paid: i.paid }));
  const { total, remaining } = deriveFromInstallments(norm);
  hint.textContent = `Razem: ${formatPLN(total)} • Zostało: ${formatPLN(remaining)}`;
}

document.getElementById('add-installment-btn').addEventListener('click', () => {
  editorInstallments.push({ amount: '', due_date: null, paid: false });
  renderInstallmentsEditor();
  updateInstallmentsHint();
});

// --- Modal ---
let currentKind = 'debt';

function setKind(kind) {
  currentKind = kind;
  document.querySelectorAll('.kind-btn').forEach((b) => {
    b.classList.toggle('active', b.dataset.kind === kind);
  });
  const isSub = kind === 'subscription';
  document.getElementById('debt-fields').style.display = isSub ? 'none' : '';
  document.getElementById('subscription-fields').style.display = isSub ? '' : 'none';
  document.getElementById('debt-name').placeholder = isSub
    ? 'np. Sieć komórkowa Play'
    : 'np. Kredyt gotówkowy PKO';
}

document.querySelectorAll('.kind-btn').forEach((btn) => {
  btn.addEventListener('click', () => setKind(btn.dataset.kind));
});

function openAddModal() {
  editingId = null;
  editorInstallments = [];
  document.getElementById('modal-title').textContent = 'Dodaj pozycję';
  document.getElementById('debt-form').reset();
  document.getElementById('debt-id').value = '';
  document.getElementById('debt-status').value = 'do_zaplaty';
  document.getElementById('sub-active').checked = true;
  document.getElementById('debt-submit-btn').textContent = 'Zapisz';
  setKind('debt');
  renderInstallmentsEditor();
  updateInstallmentsHint();
  showModal();
}

function openEditModal(id) {
  const debt = allDebts.find((d) => String(d.id) === String(id));
  if (!debt) return;
  editingId = id;
  editorInstallments = getInstallments(debt).map((i) => ({ ...i }));

  document.getElementById('modal-title').textContent = 'Edytuj pozycję';
  document.getElementById('debt-id').value = debt.id;
  document.getElementById('debt-name').value = debt.name || '';
  document.getElementById('debt-notes').value = debt.notes || '';
  document.getElementById('debt-submit-btn').textContent = 'Zaktualizuj';

  if (isSubscription(debt)) {
    setKind('subscription');
    document.getElementById('sub-category').value = debt.type || 'sub_inne';
    document.getElementById('sub-amount').value = debt.monthly_payment || '';
    document.getElementById('sub-cycle').value = debt.billing_cycle || 'monthly';
    document.getElementById('sub-day').value = debt.payment_day || '';
    document.getElementById('sub-active').checked = debt.active !== false;
  } else {
    setKind('debt');
    document.getElementById('debt-type').value = debt.type || 'inne';
    document.getElementById('debt-status').value = debt.status || 'do_zaplaty';
    document.getElementById('debt-remaining').value = debt.remaining_amount || '';
    document.getElementById('debt-total').value = debt.total_amount || '';
    document.getElementById('debt-monthly').value = debt.monthly_payment || '';
    document.getElementById('debt-due').value = debt.due_date || '';
  }

  renderInstallmentsEditor();
  updateInstallmentsHint();
  showModal();
}

function showModal() {
  document.getElementById('debt-modal').classList.remove('hidden');
}

function hideModal() {
  document.getElementById('debt-modal').classList.add('hidden');
}

document.getElementById('open-modal-btn').addEventListener('click', openAddModal);
document.getElementById('close-modal-btn').addEventListener('click', hideModal);
document.getElementById('cancel-modal-btn').addEventListener('click', hideModal);
document.getElementById('debt-modal').addEventListener('click', (e) => {
  if (e.target === document.getElementById('debt-modal')) hideModal();
});

document.getElementById('debt-form').addEventListener('submit', async (e) => {
  e.preventDefault();

  let payload;

  if (currentKind === 'subscription') {
    // Stała opłata / subskrypcja
    payload = {
      kind: 'subscription',
      name: document.getElementById('debt-name').value.trim(),
      type: document.getElementById('sub-category').value,
      monthly_payment: parseFloat(document.getElementById('sub-amount').value) || 0,
      billing_cycle: document.getElementById('sub-cycle').value,
      payment_day: parseInt(document.getElementById('sub-day').value, 10) || null,
      active: document.getElementById('sub-active').checked,
      notes: document.getElementById('debt-notes').value.trim() || null,
      // pola długu nieużywane
      status: 'do_zaplaty',
      remaining_amount: 0,
      total_amount: null,
      due_date: null,
      installments: null,
    };
  } else {
    // Zadłużenie
    payload = {
      kind: 'debt',
      name: document.getElementById('debt-name').value.trim(),
      type: document.getElementById('debt-type').value,
      status: document.getElementById('debt-status').value,
      remaining_amount: parseFloat(document.getElementById('debt-remaining').value) || 0,
      total_amount: parseFloat(document.getElementById('debt-total').value) || null,
      monthly_payment: parseFloat(document.getElementById('debt-monthly').value) || null,
      due_date: document.getElementById('debt-due').value || null,
      notes: document.getElementById('debt-notes').value.trim() || null,
      billing_cycle: null,
      active: true,
    };

    // Jeśli rozbito na raty — wylicz kwoty i status z listy rat
    const cleanInstallments = editorInstallments
      .filter((i) => i.amount !== '' && i.amount != null)
      .map((i) => ({ amount: Number(i.amount) || 0, due_date: i.due_date || null, paid: !!i.paid }));

    if (cleanInstallments.length > 0) {
      const { total, remaining, allPaid } = deriveFromInstallments(cleanInstallments);
      payload.installments = cleanInstallments;
      payload.total_amount = total;
      payload.remaining_amount = remaining;
      payload.monthly_payment = null;
      payload.due_date = null;
      payload.status = allPaid ? 'oplacone' : 'do_zaplaty';
    } else {
      payload.installments = null;
    }
  }

  // Przypisz właściciela przy dodawaniu nowej pozycji
  if (!editingId && currentUser) {
    payload.user_id = currentUser.id;
  }

  const btn = document.getElementById('debt-submit-btn');
  btn.disabled = true;
  btn.textContent = 'Zapisywanie...';

  let error;
  if (editingId) {
    ({ error } = await supabase.from('debts').update(payload).eq('id', editingId));
  } else {
    ({ error } = await supabase.from('debts').insert([payload]));
  }

  btn.disabled = false;
  btn.textContent = editingId ? 'Zaktualizuj' : 'Zapisz';

  if (error) { alert('Błąd zapisywania: ' + error.message); return; }

  hideModal();
  loadDebts();
});

// --- Filtry ---
document.querySelectorAll('.filter-tab').forEach((tab) => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.filter-tab').forEach((t) => t.classList.remove('active'));
    tab.classList.add('active');
    activeFilter = tab.dataset.type;
    renderDebts(filterDebts());
  });
});

// --- Init ---
document.addEventListener('DOMContentLoaded', () => {
  setupAuth();
});
