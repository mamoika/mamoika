import './style.css';
import { supabase } from './supabaseClient';

let posters = [];
let editModeId = null;

// Ukryty tryb administratora
function setupHiddenAdmin() {
  const logo = document.querySelector('.nav-logo');
  if (!logo) return;
  
  // Sprawdź, czy sesja istnieje
  if (sessionStorage.getItem('isAdmin') === 'true') {
    document.body.classList.add('admin-mode');
  }

  // Dwa szybkie kliknięcia w logo
  logo.addEventListener('dblclick', (e) => {
    e.preventDefault();
    if (document.body.classList.contains('admin-mode')) {
      // Wyloguj
      if (confirm('Wylogować z trybu admina?')) {
        sessionStorage.removeItem('isAdmin');
        document.body.classList.remove('admin-mode');
      }
      return;
    }
    
    // Zaloguj
    const pwd = prompt('Wpisz hasło administratora:');
    if (pwd === 'admin123') { // Domyślne proste hasło
      sessionStorage.setItem('isAdmin', 'true');
      document.body.classList.add('admin-mode');
      alert('Zalogowano! Panel dodawania jest teraz widoczny na dole.');
    } else if (pwd !== null) {
      alert('Złe hasło!');
    }
  });
}

// Fetch posters from Supabase
async function fetchPosters() {
  if (!supabase) {
    const grid = document.getElementById('gallery-grid');
    if (grid) {
      grid.innerHTML = `
        <div style="grid-column: 1/-1; text-align: center; padding: 2rem; background: #fff; border-radius: 12px; border: 1px solid #ffcc00;">
          <h3>⚠️ Supabase Not Connected</h3>
          <p>Brak zmiennych środowiskowych VITE_SUPABASE_URL oraz VITE_SUPABASE_ANON_KEY. Dodaj je, aby połączyć się z bazą!</p>
        </div>
      `;
    }
    return;
  }

  const { data, error } = await supabase
    .from('posters')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching posters:', error);
    return;
  }
  
  posters = data || [];
  renderGallery();
}

// Function to render posters
function renderGallery() {
  const galleryGrid = document.getElementById('gallery-grid');
  if (!galleryGrid) return;
  
  galleryGrid.innerHTML = ''; // Clear before rendering
  
  posters.forEach((poster, index) => {
    const card = document.createElement('div');
    card.className = 'poster-card';
    card.dataset.id = poster.id;
    
    card.style.opacity = '0';
    card.style.transform = 'translateY(20px)';
    card.style.transition = 'opacity 0.8s ease, transform 0.8s cubic-bezier(0.16, 1, 0.3, 1)';
    card.style.transitionDelay = `${(index % 5) * 0.1}s`;
    
    card.innerHTML = `
      <div class="admin-controls">
        <button class="edit-btn" aria-label="Edit Poster">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>
        </button>
        <button class="delete-btn" aria-label="Delete Poster">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
        </button>
      </div>
      <div class="poster-img-container">
        <img src="${poster.image}" alt="${poster.artist} Poster" class="poster-img" onerror="this.src='https://images.unsplash.com/photo-1459749411175-04bf5292ceea?q=80&w=800&auto=format&fit=crop';">
      </div>
      <div class="poster-info">
        <h3 class="poster-artist">${poster.artist}</h3>
        <div class="poster-details">
          <span class="poster-date">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
            ${poster.date}
          </span>
          <span class="poster-venue">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
            ${poster.venue}
          </span>
        </div>
      </div>
    `;
    
    // Add delete event listener
    const deleteBtn = card.querySelector('.delete-btn');
    deleteBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (confirm('Na pewno chcesz usunąć ten plakat?')) {
        deletePoster(poster.id);
      }
    });

    // Add edit event listener
    const editBtn = card.querySelector('.edit-btn');
    editBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      startEditing(poster);
    });
    
    galleryGrid.appendChild(card);
  });

  // Prosta animacja pojawiania się
  setTimeout(() => {
    const cards = document.querySelectorAll('.poster-card');
    cards.forEach(card => {
      card.style.opacity = '1';
      card.style.transform = 'translateY(0)';
      
      // Przywróć normalne transition po wejściu
      setTimeout(() => {
        card.style.transitionDelay = '0s';
        card.style.transition = 'transform 0.3s ease, box-shadow 0.3s ease';
      }, 1000);
    });
  }, 50);
}

// Rozpoczęcie edycji
function startEditing(poster) {
  editModeId = poster.id;
  document.getElementById('poster-url').value = poster.image;
  document.getElementById('poster-artist').value = poster.artist;
  document.getElementById('poster-date').value = poster.date;
  document.getElementById('poster-venue').value = poster.venue;
  
  const formBtn = document.querySelector('#poster-form button');
  formBtn.innerText = "Update Poster";
  
  // Przeskroluj gładko do formularza
  document.querySelector('.admin-section').scrollIntoView({ behavior: 'smooth' });
}

// Function to delete poster from Supabase
async function deletePoster(id) {
  if (!supabase) return;
  
  const { error } = await supabase
    .from('posters')
    .delete()
    .eq('id', id);
    
  if (error) {
    alert("Error deleting poster!");
    console.error(error);
    return;
  }
  
  fetchPosters();
}

// Function to add or update poster
function setupAdminForm() {
  const form = document.getElementById('poster-form');
  if (!form) return;
  
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!supabase) {
      alert("Connect Supabase first by adding environment variables.");
      return;
    }
    
    const posterData = {
      image: document.getElementById('poster-url').value,
      artist: document.getElementById('poster-artist').value,
      date: document.getElementById('poster-date').value,
      venue: document.getElementById('poster-venue').value,
    };
    
    // UI Loading state
    const btn = form.querySelector('button');
    const originalText = btn.innerText;
    btn.innerText = "Zapisywanie...";
    btn.disabled = true;
    
    let dbError;
    
    if (editModeId) {
      // Aktualizacja
      const { error } = await supabase
        .from('posters')
        .update(posterData)
        .eq('id', editModeId);
      dbError = error;
    } else {
      // Dodawanie nowego
      const { error } = await supabase
        .from('posters')
        .insert([posterData]);
      dbError = error;
    }
      
    btn.innerText = "Add Poster";
    btn.disabled = false;
    
    if (dbError) {
      alert("Error saving poster: " + dbError.message);
      console.error(dbError);
      return;
    }
    
    // Zresetuj formularz i stan edycji
    form.reset();
    editModeId = null;
    
    fetchPosters();
  });
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  setupHiddenAdmin();
  setupAdminForm();
  fetchPosters();
});
