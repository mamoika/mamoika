// Uruchom: node seed_paypo.js
// Wymagane zmienne środowiskowe: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_EMAIL, SUPABASE_PASSWORD
//
// Przykład:
//   SUPABASE_URL=https://xxx.supabase.co \
//   SUPABASE_ANON_KEY=eyJ... \
//   SUPABASE_EMAIL=twoj@email.com \
//   SUPABASE_PASSWORD=haslo \
//   node seed_paypo.js

import { createClient } from '@supabase/supabase-js';

const url   = process.env.SUPABASE_URL;
const key   = process.env.SUPABASE_ANON_KEY;
const email = process.env.SUPABASE_EMAIL;
const pass  = process.env.SUPABASE_PASSWORD;

if (!url || !key || !email || !pass) {
  console.error('Brak zmiennych środowiskowych. Ustaw SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_EMAIL, SUPABASE_PASSWORD.');
  process.exit(1);
}

const supabase = createClient(url, key);

// -------------------------------------------------------
// Dane z PayPo — edytuj / uzupełnij według potrzeb
// -------------------------------------------------------
const paypoItems = [
  {
    name: 'Empik S.A.',
    type: 'paypo',
    notes: 'Pożyczka nr 2602074120485',
    installments: [
      { amount: 210.49, due_date: '2026-03-10', paid: true  },
      { amount: 210.49, due_date: '2026-04-09', paid: true  },
      { amount: 210.49, due_date: '2026-05-09', paid: true  },
      { amount: 210.49, due_date: '2026-06-08', paid: true  },
      { amount: 210.49, due_date: '2026-07-08', paid: true  },
      { amount: 210.46, due_date: '2026-08-06', paid: false },
    ],
  },
  {
    name: 'Alipay',
    type: 'paypo',
    notes: 'SmartPlan nr 2604273738973',
    installments: [
      { amount: 65.59, due_date: '2026-05-28', paid: true  },
      { amount: 65.59, due_date: '2026-06-27', paid: true  },
      { amount: 65.60, due_date: '2026-07-26', paid: false },
    ],
  },
  {
    name: 'Pyszne.pl',
    type: 'paypo',
    notes: 'SmartPlan nr 2606155046789',
    installments: [
      { amount: 70.99, due_date: '2026-07-15', paid: false },
    ],
  },
  {
    name: 'Helios',
    type: 'paypo',
    notes: 'Pożyczka nr 2606198578438',
    installments: [
      { amount: 68.80, due_date: '2026-07-19', paid: false },
    ],
  },
  {
    name: 'Pyszne.pl (2)',
    type: 'paypo',
    notes: 'SmartPlan nr 2606209876593',
    installments: [
      { amount: 40.75, due_date: '2026-07-20', paid: false },
    ],
  },
  {
    name: 'Pyszne.pl (3)',
    type: 'paypo',
    notes: 'SmartPlan nr 2606212910444',
    installments: [
      { amount: 39.00, due_date: '2026-07-21', paid: false },
    ],
  },
];

// -------------------------------------------------------
function deriveFromInstallments(inst) {
  const total     = inst.reduce((s, i) => s + i.amount, 0);
  const remaining = inst.filter((i) => !i.paid).reduce((s, i) => s + i.amount, 0);
  const allPaid   = inst.length > 0 && inst.every((i) => i.paid);
  return { total, remaining, allPaid };
}

async function main() {
  // Logowanie
  const { error: authErr } = await supabase.auth.signInWithPassword({ email, password: pass });
  if (authErr) { console.error('Błąd logowania:', authErr.message); process.exit(1); }
  console.log('Zalogowano.');

  for (const item of paypoItems) {
    const { total, remaining, allPaid } = deriveFromInstallments(item.installments);
    const payload = {
      kind:             'debt',
      name:             item.name,
      type:             item.type,
      notes:            item.notes || null,
      status:           allPaid ? 'oplacone' : 'do_zaplaty',
      installments:     item.installments,
      total_amount:     total,
      remaining_amount: remaining,
      monthly_payment:  null,
      due_date:         null,
      billing_cycle:    null,
      active:           true,
    };

    const { error } = await supabase.from('debts').insert([payload]);
    if (error) {
      console.error(`❌ Błąd przy "${item.name}":`, error.message);
    } else {
      console.log(`✓ Dodano: ${item.name} (pozostało: ${remaining.toFixed(2)} zł)`);
    }
  }

  console.log('Gotowe.');
}

main();
