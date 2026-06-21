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
  return allDebts.filter((d) => d.type === activeFilter);
}

function updateSummary() {
  const totalDebt = allDebts.reduce((s, d) => s + (d.remaining_amount || 0), 0);
  const totalMonthly = allDebts.reduce((s, d) => s + (d.monthly_payment || 0), 0);

  document.getElementById('total-debt').textContent = formatPLN(totalDebt);
  document.getElementById('total-monthly').textContent = totalMonthly > 0 ? formatPLN(totalMonthly) : '— zł';
  document.getElementById('total-count').textContent = allDebts.length;
}

function formatPLN(amount) {
  return new Intl.NumberFormat('pl-PL', { style: 'currency', currency: 'PLN' }).format(amount);
}

const TYPE_LABELS = {
  kredyt: 'Kredyt',
  paypo: 'PayPo / BNPL',
  studia: 'Studia',
  inne: 'Inne',
};

const TYPE_COLORS = {
  kredyt: '#007aff',
  paypo: '#ff9500',
  studia: '#34c759',
  inne: '#8e8e93',
};

function renderDebts(debts) {
  const list = document.getElementById('debts-list');

  if (debts.length === 0) {
    list.innerHTML = '<p class="empty-state">Brak pozycji. Kliknij "+ Dodaj", aby dodać zadłużenie.</p>';
    return;
  }

  list.innerHTML = debts
    .map((d) => {
      const progress =
        d.total_amount && d.remaining_amount
          ? Math.round(((d.total_amount - d.remaining_amount) / d.total_amount) * 100)
          : null;

      const dueStr = d.due_date
        ? new Date(d.due_date).toLocaleDateString('pl-PL', { day: 'numeric', month: 'long', year: 'numeric' })
        : null;

      const color = TYPE_COLORS[d.type] || '#8e8e93';

      return `
        <div class="debt-card glass" data-id="${d.id}">
          <div class="debt-card-top">
            <div class="debt-info">
              <span class="debt-type-badge" style="background:${color}22;color:${color}">${TYPE_LABELS[d.type] || d.type}</span>
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
          <div class="debt-card-bottom">
            <div class="debt-meta">
              ${d.monthly_payment ? `<span class="meta-item">📅 ${formatPLN(d.monthly_payment)}/mies.</span>` : ''}
              ${dueStr ? `<span class="meta-item">⏰ ${dueStr}</span>` : ''}
            </div>
            <div class="debt-actions">
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

  list.querySelectorAll('.edit-debt-btn').forEach((btn) => {
    btn.addEventListener('click', () => openEditModal(btn.dataset.id));
  });

  list.querySelectorAll('.delete-debt-btn').forEach((btn) => {
    btn.addEventListener('click', () => deleteDebt(btn.dataset.id));
  });
}

async function deleteDebt(id) {
  if (!confirm('Na pewno usunąć tę pozycję?')) return;
  const { error } = await supabase.from('debts').delete().eq('id', id);
  if (error) { alert('Błąd usuwania: ' + error.message); return; }
  loadDebts();
}

// --- Modal ---
function openAddModal() {
  editingId = null;
  document.getElementById('modal-title').textContent = 'Dodaj zadłużenie';
  document.getElementById('debt-form').reset();
  document.getElementById('debt-id').value = '';
  document.getElementById('debt-submit-btn').textContent = 'Zapisz';
  showModal();
}

function openEditModal(id) {
  const debt = allDebts.find((d) => String(d.id) === String(id));
  if (!debt) return;
  editingId = id;

  document.getElementById('modal-title').textContent = 'Edytuj zadłużenie';
  document.getElementById('debt-id').value = debt.id;
  document.getElementById('debt-name').value = debt.name || '';
  document.getElementById('debt-type').value = debt.type || 'inne';
  document.getElementById('debt-remaining').value = debt.remaining_amount || '';
  document.getElementById('debt-total').value = debt.total_amount || '';
  document.getElementById('debt-monthly').value = debt.monthly_payment || '';
  document.getElementById('debt-due').value = debt.due_date || '';
  document.getElementById('debt-notes').value = debt.notes || '';
  document.getElementById('debt-submit-btn').textContent = 'Zaktualizuj';

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

  const payload = {
    name: document.getElementById('debt-name').value.trim(),
    type: document.getElementById('debt-type').value,
    remaining_amount: parseFloat(document.getElementById('debt-remaining').value) || 0,
    total_amount: parseFloat(document.getElementById('debt-total').value) || null,
    monthly_payment: parseFloat(document.getElementById('debt-monthly').value) || null,
    due_date: document.getElementById('debt-due').value || null,
    notes: document.getElementById('debt-notes').value.trim() || null,
  };

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
