// Movie sessions data - imported from year-specific folder
let sessions = [];

// Load sessions from JSON file
async function loadSessions() {
  try {
    const response = await fetch('./2025/movies.json');
    sessions = await response.json();
    return sessions;
  } catch (error) {
    console.error('Error loading sessions:', error);
    return [];
  }
}

// State management
let expandedIds = [];
let posterCache = {};
let selectedDay = 'all';
let showFilters = false;

// Initialize app
async function init() {
  // Load sessions from JSON file
  await loadSessions();
  
  // Load saved state from localStorage
  const savedExpanded = localStorage.getItem('expandedMovies');
  if (savedExpanded) {
    expandedIds = JSON.parse(savedExpanded);
  }
  
  // Initialize posterCache from posterURL in sessions data
  sessions.forEach(session => {
    if (session.posterURL && !posterCache[session.id]) {
      posterCache[session.id] = session.posterURL;
    }
  });
  
  // Load saved day filter
  const savedDay = localStorage.getItem('selectedDay');
  if (savedDay) {
    selectedDay = savedDay;
  }
  
  // Setup event listeners
  setupEventListeners();
  
  // Populate filters
  populateFilters();
  
  // Restore filter selection
  const dayFilter = document.getElementById('day-filter');
  if (dayFilter) {
    dayFilter.value = selectedDay;
  }
  
  // Render sessions
  renderSessions();
}

// Setup event listeners
function setupEventListeners() {
  const filterToggle = document.getElementById('filter-toggle');
  const dayFilter = document.getElementById('day-filter');
  
  filterToggle.addEventListener('click', toggleFilters);
  dayFilter.addEventListener('change', (e) => {
    selectedDay = e.target.value;
    localStorage.setItem('selectedDay', selectedDay);
    renderSessions();
  });
}

// Toggle filters visibility
function toggleFilters() {
  showFilters = !showFilters;
  const filtersDiv = document.getElementById('filters');
  const arrow = document.getElementById('filter-arrow');
  
  if (showFilters) {
    filtersDiv.classList.remove('hidden');
    filtersDiv.classList.add('filter-enter');
    arrow.textContent = '▲';
  } else {
    filtersDiv.classList.add('hidden');
    filtersDiv.classList.remove('filter-enter');
    arrow.textContent = '▼';
  }
}

// Populate filter options
function populateFilters() {
  const days = [...new Set(sessions.map(s => s.day))];
  
  const dayFilter = document.getElementById('day-filter');
  
  days.forEach(day => {
    const option = document.createElement('option');
    option.value = day;
    option.textContent = day;
    dayFilter.appendChild(option);
  });
}

// Filter sessions
function getFilteredSessions() {
  return sessions.filter(s => 
    (selectedDay === 'all' || s.day === selectedDay)
  );
}

// Group sessions by day
function groupSessionsByDay(sessions) {
  return sessions.reduce((acc, session) => {
    if (!acc[session.day]) {
      acc[session.day] = [];
    }
    acc[session.day].push(session);
    return acc;
  }, {});
}

// Calculate end time
function calculateEndTime(start, duration) {
  const [hours, minutes] = start.split(':').map(Number);
  const totalMinutes = hours * 60 + minutes + duration;
  const endHours = Math.floor(totalMinutes / 60) % 24;
  const endMinutes = totalMinutes % 60;
  return `${String(endHours).padStart(2, '0')}:${String(endMinutes).padStart(2, '0')}`;
}

// Toggle expand session
function toggleExpand(id) {
  const index = expandedIds.indexOf(id);
  if (index > -1) {
    expandedIds.splice(index, 1);
  } else {
    expandedIds.push(id);
  }
  localStorage.setItem('expandedMovies', JSON.stringify(expandedIds));
  
  // Find and update only the specific card instead of re-rendering everything
  const card = document.querySelector(`.movie-card[data-session-id="${id}"]`);
  if (card) {
    const session = sessions.find(s => s.id === id);
    if (session) {
      const newCard = createSessionCard(session);
      card.replaceWith(newCard);
    }
  }
}

// Render sessions
function renderSessions() {
  const container = document.getElementById('sessions-container');
  const filteredSessions = getFilteredSessions();
  const groupedByDay = groupSessionsByDay(filteredSessions);
  
  // Update movie count
  const movieCount = document.getElementById('movie-count');
  movieCount.textContent = `${filteredSessions.length} película${filteredSessions.length !== 1 ? 's' : ''}`;
  
  // Clear container
  container.innerHTML = '';
  
  // Render each day
  Object.entries(groupedByDay).forEach(([day, daySessions]) => {
    const daySection = document.createElement('div');
    daySection.className = 'space-y-4';
    
    const dayHeader = document.createElement('div');
    dayHeader.className = 'flex items-center gap-3 mb-4 pb-3 border-b-2 border-sitges-pink/50';
    dayHeader.innerHTML = `
      <div class="flex items-center justify-center w-10 h-10 bg-gradient-to-br from-sitges-red to-sitges-pink rounded-lg shadow-lg">
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-white">
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
          <line x1="16" y1="2" x2="16" y2="6"></line>
          <line x1="8" y1="2" x2="8" y2="6"></line>
          <line x1="3" y1="10" x2="21" y2="10"></line>
        </svg>
      </div>
      <div class="flex-1">
        <h2 class="text-2xl font-bold gradient-text">${day}</h2>
      </div>
      <span class="px-3 py-1 bg-sitges-red/20 text-sitges-red text-sm font-bold rounded-full border border-sitges-red/50">${daySessions.length} ${daySessions.length === 1 ? 'película' : 'películas'}</span>
    `;
    daySection.appendChild(dayHeader);
    
    const sessionsContainer = document.createElement('div');
    sessionsContainer.className = 'space-y-3';
    
    daySessions.forEach(session => {
      const sessionCard = createSessionCard(session);
      sessionsContainer.appendChild(sessionCard);
    });
    
    daySection.appendChild(sessionsContainer);
    container.appendChild(daySection);
  });
}

// Create session card
function createSessionCard(session) {
  const isExpanded = expandedIds.includes(session.id);
  const endTime = calculateEndTime(session.start, session.sitgesDuration);
  
  const card = document.createElement('div');
  card.className = `movie-card bg-gradient-to-br from-gray-900/90 to-gray-900/70 backdrop-blur rounded-xl overflow-hidden border border-sitges-red/30 shadow-lg transition-all ${isExpanded ? 'expanded' : ''}`;
  card.dataset.sessionId = session.id;
  
  // Card header
  const header = document.createElement('div');
  header.className = 'p-4 cursor-pointer';
  header.onclick = () => toggleExpand(session.id);
  
  header.innerHTML = `
    <div class="flex gap-4">
      <!-- Poster -->
      <div class="flex-shrink-0 w-20 h-28 bg-gradient-to-br from-gray-800 to-gray-900 rounded-lg overflow-hidden border border-sitges-red/30 shadow-md">
        ${posterCache[session.id] ? 
          `<img src="${posterCache[session.id]}" alt="${session.title}" class="poster-img w-full h-full object-cover" loading="lazy" />` :
          `<div class="w-full h-full flex items-center justify-center text-4xl">🎬</div>`
        }
      </div>
      
      <!-- Info -->
      <div class="flex-1 min-w-0">
        <div class="flex items-start justify-between gap-2 mb-2">
          <h3 class="font-bold text-lg leading-tight line-clamp-2 text-white">
            ${session.title}
          </h3>
          <div class="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-full ${isExpanded ? 'bg-sitges-red' : 'bg-sitges-red/30'} transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="text-white">
              <polyline points="${isExpanded ? '18 15 12 9 6 15' : '6 9 12 15 18 9'}"></polyline>
            </svg>
          </div>
        </div>
        
        <div class="flex flex-wrap gap-x-4 gap-y-2 text-sm text-gray-300">
          <span class="flex items-center gap-1.5 font-medium text-sitges-red">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="10"></circle>
              <polyline points="12 6 12 12 16 14"></polyline>
            </svg>
            ${session.start} - ${endTime}
          </span>
          <span class="flex items-center gap-1.5">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-sitges-pink">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
              <circle cx="12" cy="10" r="3"></circle>
            </svg>
            ${session.sala}
          </span>
          ${session.imdbScore ? `
            <span class="flex items-center gap-1.5 font-semibold">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-yellow-400">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
              </svg>
              <span class="text-yellow-400">${session.imdbScore}</span>
            </span>
          ` : ''}
          <span class="text-gray-400">
            ⏱️ ${session.sitgesDuration} min
          </span>
        </div>
        
        ${session.tag ? `
          <div class="mt-3">
            <span class="tag-badge inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full ${
              session.tag.includes('Presencia') ? 'bg-sitges-red/80 text-white ring-2 ring-sitges-red/50' :
              session.tag.includes('Premio') ? 'bg-yellow-600/80 text-white ring-2 ring-yellow-500/50' :
              'bg-gray-700/80 text-gray-200'
            }">
              ${session.tag.includes('Presencia') ? '🎬' : ''}
              ${session.tag.includes('Premio') ? '🏆' : ''}
              ${session.tag}
            </span>
          </div>
        ` : ''}
      </div>
    </div>
  `;
  
  card.appendChild(header);
  
  // Expanded content
  if (isExpanded) {
    const expandedContent = document.createElement('div');
    expandedContent.className = 'border-t border-sitges-red/30 p-5 space-y-5 bg-gradient-to-b from-black/50 to-black/70';
    
    expandedContent.innerHTML = `
      <!-- Larger Poster for Expanded View -->
      ${posterCache[session.id] ? `
        <div class="w-full max-w-sm mx-auto rounded-xl overflow-hidden shadow-2xl border border-sitges-red/30">
          <img src="${posterCache[session.id]}" alt="${session.title}" class="w-full h-auto object-cover" loading="lazy" />
        </div>
      ` : ''}
      
      <!-- Time Details -->
      <div class="flex items-center gap-3 px-4 py-3 bg-sitges-red/20 rounded-lg border border-sitges-red/30">
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-sitges-red">
          <circle cx="12" cy="12" r="10"></circle>
          <polyline points="12 6 12 12 16 14"></polyline>
        </svg>
        <div>
          <p class="text-xs text-gray-400 mb-0.5">Horario</p>
          <p class="font-bold text-sitges-red">${session.start} - ${endTime}</p>
        </div>
        <span class="text-gray-600 mx-2">|</span>
        <div>
          <p class="text-xs text-gray-400 mb-0.5">Duración</p>
          <p class="font-semibold text-gray-300">${session.sitgesDuration} min</p>
        </div>
      </div>
      
      <!-- Description -->
      <div class="bg-gray-900/50 rounded-lg p-4 border border-sitges-red/20">
        <h4 class="text-xs font-bold text-sitges-red uppercase tracking-wider mb-2">Sinopsis</h4>
        <p class="text-sm text-gray-300 leading-relaxed">
          ${session.description}
        </p>
        ${session.audience ? `
          <div class="mt-3 pt-3 border-t border-sitges-red/20">
            <p class="text-xs text-gray-400 italic flex items-center gap-2">
              <span>💭</span>
              <span>${session.audience}</span>
            </p>
          </div>
        ` : ''}
      </div>
      
      <!-- Presences -->
      ${session.presences && session.presences.length > 0 ? `
        <div class="bg-sitges-red/20 rounded-lg p-4 border border-sitges-red/30">
          <div class="flex items-start gap-3">
            <span class="text-2xl">🎬</span>
            <div class="flex-1">
              <p class="text-xs font-bold text-sitges-red uppercase tracking-wider mb-2">Presencias</p>
              <p class="text-sm text-gray-200 leading-relaxed">${session.presences.join(', ')}</p>
            </div>
          </div>
        </div>
      ` : ''}
      
      <!-- Awards -->
      ${session.awards && session.awards.length > 0 ? `
        <div class="bg-yellow-950/20 rounded-lg p-4 border border-yellow-900/30">
          <div class="flex items-start gap-3">
            <span class="text-2xl">🏆</span>
            <div class="flex-1">
              <p class="text-xs font-bold text-yellow-400 uppercase tracking-wider mb-2">Premios</p>
              <p class="text-sm text-gray-200 leading-relaxed">${session.awards.join(', ')}</p>
            </div>
          </div>
        </div>
      ` : ''}
      
      <!-- Links -->
      <div class="flex gap-3 pt-2">
        <a
          href="${session.sitgesURL}"
          target="_blank"
          rel="noopener noreferrer"
          class="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-sitges-red text-white font-semibold rounded-lg transition-all shadow-lg"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
            <polyline points="15 3 21 3 21 9"></polyline>
            <line x1="10" y1="14" x2="21" y2="3"></line>
          </svg>
          Sitges
        </a>
        <a
          href="${session.imdbURL}"
          target="_blank"
          rel="noopener noreferrer"
          class="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-yellow-600 text-white font-semibold rounded-lg transition-all shadow-lg"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
            <polyline points="15 3 21 3 21 9"></polyline>
            <line x1="10" y1="14" x2="21" y2="3"></line>
          </svg>
          IMDb
        </a>
      </div>
    `;
    
    card.appendChild(expandedContent);
  }
  
  return card;
}

// PWA Install functionality
let deferredPrompt;
let installable = false;

window.addEventListener('beforeinstallprompt', (e) => {
  // Prevent the mini-infobar from appearing on mobile
  e.preventDefault();
  // Stash the event so it can be triggered later
  deferredPrompt = e;
  installable = true;
  console.log('PWA install prompt ready');
  
  // Update button appearance
  const installBtn = document.getElementById('pwa-install-btn');
  if (installBtn) {
    installBtn.innerHTML = '⬇️ Instalar aplicación';
    installBtn.classList.remove('opacity-50', 'cursor-not-allowed');
    installBtn.disabled = false;
  }
});

// Handle install button click
function setupPWAInstall() {
  const installBtn = document.getElementById('pwa-install-btn');
  if (installBtn) {
    installBtn.addEventListener('click', async () => {
      if (!deferredPrompt) {
        // Show instructions based on browser/platform
        const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
        const isAndroid = /Android/.test(navigator.userAgent);
        
        if (isIOS) {
          alert('Para instalar en iOS:\n1. Toca el botón "Compartir" (□ con flecha)\n2. Desplázate y selecciona "Añadir a pantalla de inicio"\n3. Toca "Añadir"');
        } else if (isAndroid) {
          alert('Para instalar en Android:\n1. Toca el menú (⋮) del navegador\n2. Selecciona "Añadir a pantalla de inicio" o "Instalar app"\n3. Confirma la instalación');
        } else {
          alert('Para instalar:\n1. Busca el icono de instalación en la barra de direcciones\n2. O usa el menú del navegador > "Instalar app"\n\nNota: Asegúrate de estar usando HTTPS');
        }
        return;
      }
      
      // Show the install prompt
      deferredPrompt.prompt();
      
      // Wait for the user to respond to the prompt
      const { outcome } = await deferredPrompt.userChoice;
      console.log(`User response to the install prompt: ${outcome}`);
      
      if (outcome === 'accepted') {
        // Change button text after successful install
        installBtn.innerHTML = '✓ Instalada';
        installBtn.disabled = true;
        installBtn.classList.add('opacity-50', 'cursor-not-allowed');
      }
      
      // Clear the deferredPrompt so it can only be used once
      deferredPrompt = null;
      installable = false;
    });
  }
}

// Listen for successful installation
window.addEventListener('appinstalled', () => {
  console.log('PWA was installed successfully');
  const installBtn = document.getElementById('pwa-install-btn');
  if (installBtn) {
    installBtn.innerHTML = '✓ Instalada correctamente';
    installBtn.disabled = true;
    installBtn.classList.add('opacity-50', 'cursor-not-allowed');
  }
  deferredPrompt = null;
});

// Check if already installed and update button
window.addEventListener('DOMContentLoaded', () => {
  const installBtn = document.getElementById('pwa-install-btn');
  
  // Check if already in standalone mode (installed)
  if (window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true) {
    if (installBtn) {
      installBtn.innerHTML = '✓ Ya instalada';
      installBtn.disabled = true;
      installBtn.classList.add('opacity-50', 'cursor-not-allowed');
    }
  } else if (installBtn && !installable) {
    // Not installed and no install prompt available yet
    installBtn.innerHTML = '💾 Instalar aplicación';
  }
});

// Initialize on DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    init();
    setupPWAInstall();
  });
} else {
  init();
  setupPWAInstall();
}
