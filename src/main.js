import './style.css';

// Mock data translated to English
const posters = [
  {
    id: 1,
    artist: "Electric Velocity",
    date: "October 19, 2024",
    venue: "The Vulcan Arcade, Downtown",
    image: "https://www.fashiontime.ru/upload/articles-v3/5adef19751e8fw719.jpg"
  },
  {
    id: 2,
    artist: "Synthwave Neon Nights",
    date: "July 12, 2024",
    venue: "The Chrome Dome, LA",
    image: "/poster2.png"
  },
  {
    id: 3,
    artist: "Acoustic Sunset",
    date: "September 5, 2024",
    venue: "Central Park",
    image: "/poster3.png"
  }
];

// Function to render posters in Apple-style cards
function renderGallery() {
  const galleryGrid = document.getElementById('gallery-grid');
  
  if (!galleryGrid) return;
  
  posters.forEach((poster, index) => {
    const card = document.createElement('div');
    card.className = 'poster-card';
    
    // Initial state for scroll animation
    card.style.opacity = '0';
    card.style.transform = 'translateY(20px)';
    card.style.transition = 'opacity 0.8s ease, transform 0.8s cubic-bezier(0.16, 1, 0.3, 1)';
    card.style.transitionDelay = `${index * 0.1}s`;
    
    card.innerHTML = `
      <div class="poster-img-container">
        <img src="${poster.image}" alt="${poster.artist} Concert Poster" class="poster-img" onerror="this.src='https://images.unsplash.com/photo-1459749411175-04bf5292ceea?q=80&w=800&auto=format&fit=crop';">
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
    
    galleryGrid.appendChild(card);
  });

  // Intersection Observer for smooth fade-in animations
  const cards = document.querySelectorAll('.poster-card');
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.style.opacity = '1';
        entry.target.style.transform = 'translateY(0)';
        
        // Remove transition delay after animation completes to not affect hover state
        setTimeout(() => {
          entry.target.style.transitionDelay = '0s';
          // Ensure hover transition stays smooth
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

// Initialize on DOM load
document.addEventListener('DOMContentLoaded', () => {
  renderGallery();
});
