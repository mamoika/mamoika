import './style.css';

// Default initial poster (only the real one)
const defaultPosters = [
  {
    id: 1,
    artist: "Fashion Time Event",
    date: "October 19, 2024",
    venue: "Main Stage",
    image: "https://www.fashiontime.ru/upload/articles-v3/5adef19751e8fw719.jpg"
  }
];

// Load from localStorage or use default
let posters = JSON.parse(localStorage.getItem('myPosters')) || defaultPosters;

// Save to localStorage
function savePosters() {
  localStorage.setItem('myPosters', JSON.stringify(posters));
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
      <button class="delete-btn" aria-label="Delete Poster">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
      </button>
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
      deletePoster(poster.id);
    });
    
    galleryGrid.appendChild(card);
  });

  // Intersection Observer for animations
  const cards = document.querySelectorAll('.poster-card');
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.style.opacity = '1';
        entry.target.style.transform = 'translateY(0)';
        
        setTimeout(() => {
          entry.target.style.transitionDelay = '0s';
          entry.target.style.transition = 'transform 0.3s ease, box-shadow 0.3s ease';
        }, 800 + (parseInt(entry.target.style.transitionDelay || '0') * 1000));
        
        observer.unobserve(entry.target);
      }
    });
  }, {
    threshold: 0.1,
    rootMargin: "0px 0px -50px 0px"
  });

  cards.forEach(card => observer.observe(card));
}

// Function to delete poster
function deletePoster(id) {
  posters = posters.filter(p => p.id !== id);
  savePosters();
  renderGallery();
}

// Function to add new poster
function setupAdminForm() {
  const form = document.getElementById('poster-form');
  if (!form) return;
  
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    
    const newPoster = {
      id: Date.now(), // Generate unique ID based on timestamp
      image: document.getElementById('poster-url').value,
      artist: document.getElementById('poster-artist').value,
      date: document.getElementById('poster-date').value,
      venue: document.getElementById('poster-venue').value,
    };
    
    posters.push(newPoster);
    savePosters();
    renderGallery();
    
    form.reset(); // Clear the form
  });
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  renderGallery();
  setupAdminForm();
});
