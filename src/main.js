import './style.css';

// Dane plakatów (mock data - w przyszłości można pobierać z API)
const posters = [
  {
    id: 1,
    artist: "Electric Velocity",
    date: "19 Października 2024",
    venue: "The Vulcan Arcade, Downtown",
    image: "https://www.fashiontime.ru/upload/articles-v3/5adef19751e8fw719.jpg"
  },
  {
    id: 2,
    artist: "Synthwave Neon Nights",
    date: "12 Lipca 2024",
    venue: "The Chrome Dome, LA",
    image: "/poster2.png"
  },
  {
    id: 3,
    artist: "Acoustic Sunset",
    date: "5 Września 2024",
    venue: "Park Centralny",
    image: "/poster3.png"
  }
];

// Funkcja do renderowania plakatów
function renderGallery() {
  const galleryGrid = document.getElementById('gallery-grid');
  
  if (!galleryGrid) return;
  
  posters.forEach((poster, index) => {
    // Stworzenie kontenera dla plakatu
    const card = document.createElement('div');
    card.className = 'poster-card';
    card.style.animationDelay = `${index * 0.15}s`;
    
    // Ustawiamy opacity na 0 dla efektu scroll, włączymy przez IntersectionObserver
    card.style.opacity = '0';
    card.style.transform = 'translateY(30px)';
    card.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
    
    card.innerHTML = `
      <img src="${poster.image}" alt="Plakat koncertu ${poster.artist}" class="poster-img" onerror="this.src='https://images.unsplash.com/photo-1459749411175-04bf5292ceea?q=80&w=800&auto=format&fit=crop';">
      <div class="poster-overlay">
        <h3 class="poster-artist">${poster.artist}</h3>
        <p class="poster-date">📅 ${poster.date}</p>
        <p class="poster-venue">📍 ${poster.venue}</p>
      </div>
    `;
    
    galleryGrid.appendChild(card);
  });

  // Dodanie efektu pojawiania się przy scrollowaniu (Intersection Observer)
  const cards = document.querySelectorAll('.poster-card');
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.style.opacity = '1';
        entry.target.style.transform = 'translateY(0)';
        
        // Czekamy chwile, a po pojawieniu zdejmujemy stałe transform żeby efekty hover działały poprawnie
        setTimeout(() => {
          entry.target.style.transition = 'transform 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275), box-shadow 0.4s ease';
        }, 600);
        
        observer.unobserve(entry.target);
      }
    });
  }, {
    threshold: 0.1,
    rootMargin: "0px 0px -50px 0px"
  });

  cards.forEach(card => observer.observe(card));
}

// Inicjalizacja po załadowaniu DOM
document.addEventListener('DOMContentLoaded', () => {
  renderGallery();
});
