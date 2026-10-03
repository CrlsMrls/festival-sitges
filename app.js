// Movie sessions data - imported from year-specific folder
let sessions = [];

// Years with a movies.json available, newest first. Add a new entry here
// each time a new year's folder gets added to the repo (see README).
const AVAILABLE_YEARS = [
  { year: '2026', label: '2026' },
  { year: '2025', label: '2025' },
];
let currentYear = AVAILABLE_YEARS[0].year;

// ---------------------------------------------------------------------
// Diagnostic log, permanent. There's no way to see console.log on a phone
// without plugging it into a computer, so when something actually goes
// wrong loading the sessions (network failure, timeout, empty data), a
// small panel surfaces the trail of what happened directly on screen.
// On a normal successful load it stays completely invisible — only the
// failure path ever calls showDiagnostics().
// ---------------------------------------------------------------------
const debugLog = [];
function debug(label, data) {
  const line = `[${new Date().toTimeString().slice(0, 8)}] ${label}` + (data !== undefined ? ': ' + JSON.stringify(data) : '');
  debugLog.push(line);
  console.log(line);
}
function showDiagnostics(reason) {
  let el = document.getElementById('debug-panel');
  if (!el) {
    el = document.createElement('div');
    el.id = 'debug-panel';
    el.style.cssText = 'position:fixed;bottom:0;left:0;right:0;max-height:35vh;overflow-y:auto;background:rgba(20,0,0,0.97);color:#ff6b6b;font:10px monospace;padding:10px;z-index:99999;border-top:2px solid #FF0042;white-space:pre-wrap;';
    el.onclick = () => { el.style.maxHeight = el.style.maxHeight === '35vh' ? '90vh' : '35vh'; };
    document.body.appendChild(el);
  }
  el.textContent = `⚠️ No se pudo cargar la lista (${reason}). Detalle (toca para ver más):\n` + debugLog.join('\n');
}

// Load sessions from JSON file
//
// This does NOT rely solely on the Service Worker's cache. iOS Safari has
// known reliability issues with Service Workers for home-screen-installed
// apps (they don't always stay active/controlling across relaunches), so a
// Cache-API-only fallback can silently fail offline even though everything
// else (HTML/CSS, which the OS caches separately) still loads fine — exactly
// the symptom reported. localStorage is a much more dependable offline store
// on iOS, so it's used here as an independent second safety net: every
// successful online load refreshes it, and any failed fetch (no connection,
// or the Service Worker not kicking in) falls back to it instead of to an
// empty list.
async function loadSessions(year) {
  year = year || currentYear;
  const storageKey = `cachedSessions_${year}`;
  debug('loadSessions: start', { year });
  try {
    // fetch() doesn't always fail fast when there's no connectivity — on
    // some networks/devices it just hangs waiting for a connection instead
    // of rejecting immediately. Without a timeout, that hang would block
    // init() forever and the localStorage fallback below would never get a
    // chance to run. 4s is generous for a same-origin JSON file when there
    // IS a connection, and short enough to not feel broken when there isn't.
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);
    const t0 = Date.now();
    const response = await fetch(`./${year}/movies.json`, { signal: controller.signal });
    clearTimeout(timeoutId);
    debug('fetch responded', { ms: Date.now() - t0, status: response.status, ok: response.ok });
    if (!response.ok) throw new Error('HTTP ' + response.status);
    sessions = await response.json();
    sessions.sort(sortByStart);
    debug('fetch parsed OK', { count: sessions.length });
    try {
      localStorage.setItem(storageKey, JSON.stringify(sessions));
      debug('saved to localStorage', { count: sessions.length });
    } catch (storageErr) {
      debug('localStorage SAVE failed', String(storageErr));
    }
    return sessions;
  } catch (error) {
    debug('fetch FAILED', { name: error.name, message: error.message });
    try {
      const cached = localStorage.getItem(storageKey);
      debug('localStorage read', { hasData: !!cached, rawLength: cached ? cached.length : 0 });
      if (cached) {
        sessions = JSON.parse(cached);
        sessions.sort(sortByStart);
        debug('using localStorage fallback', { count: sessions.length });
        return sessions;
      }
    } catch (fallbackErr) {
      debug('localStorage fallback FAILED', String(fallbackErr));
    }
    sessions = [];
    debug('no data available anywhere, sessions = []');
    // Only surface the panel when we truly have nothing to show — a
    // successful localStorage fallback is the app working as designed and
    // shouldn't alarm anyone, this is the genuine failure case.
    showDiagnostics('sin datos de red ni de localStorage');
    return sessions;
  }
}

// --- Real-time "now / next" helpers ---------------------------------------
//
// Older years (e.g. 2025) were saved without an ISO `date` field, only a
// display label like "Mar 14" — there's no way to build a real Date from
// that, and there's no need to: a past festival has nothing "live" or
// "next" anyway. getSessionStart returns null for those, and every function
// below treats null as "not a real, comparable time" instead of crashing.

// Build a real Date object from a session's date + start time, or null if
// this session doesn't have enough info to compute one (older years).
function getSessionStart(session) {
  if (!session.date) return null;
  const d = new Date(`${session.date}T${session.start}:00`);
  return isNaN(d) ? null : d;
}

// Session end = start + real session duration (handles midnight rollover)
function getSessionEnd(session) {
  const start = getSessionStart(session);
  return start ? new Date(start.getTime() + session.sitgesDuration * 60000) : null;
}

// Stable sort comparator: sessions without a real date keep their original
// (already sensible, hand-curated) order instead of getting shuffled.
function sortByStart(a, b) {
  const sa = getSessionStart(a);
  const sb = getSessionStart(b);
  if (!sa || !sb) return 0;
  return sa - sb;
}

// One of: 'live' (happening right now), 'next' (closest upcoming), 'past', 'upcoming'
function getSessionStatus(session, now, nextId) {
  const start = getSessionStart(session);
  if (!start) return 'upcoming';
  const end = getSessionEnd(session);
  if (now >= start && now < end) return 'live';
  if (session.id === nextId) return 'next';
  if (now >= end) return 'past';
  return 'upcoming';
}

// Find the id of the closest session that hasn't started yet
function findNextSessionId(now) {
  let best = null;
  for (const s of sessions) {
    const start = getSessionStart(s);
    if (start && start > now && (!best || start < getSessionStart(best))) {
      best = s;
    }
  }
  return best ? best.id : null;
}

// State management
let expandedIds = [];
let collapsedDays = [];
let posterCache = {};
let liveInterval = null;

// Initialize app
async function init() {
  // Load sessions from JSON file
  await loadSessions(currentYear);
  afterSessionsLoaded();

  renderYearSwitcher();

  // Scroll straight to the live/next session so it's the first thing you see
  scrollToCurrentSession();

  // Keep the "ahora / siguiente" banner and card highlighting live while the
  // app stays open during the festival, without re-rendering everything.
  liveInterval = setInterval(updateNowNext, 30000);
}

// Every day collapsed except the one with the live/next session (if any —
// an archive year with nothing live or upcoming just collapses everything).
function defaultCollapsedDays() {
  const now = new Date();
  const nextId = findNextSessionId(now);
  const highlighted = sessions.find(s => {
    const status = getSessionStatus(s, now, nextId);
    return status === 'live' || status === 'next';
  });
  const allDays = [...new Set(sessions.map(s => s.day))];
  return allDays.filter(day => !highlighted || day !== highlighted.day);
}

// Everything that needs to happen after `sessions` has new data, whether
// from the initial load or from switching years.
function afterSessionsLoaded() {
  // Load saved state from localStorage
  const savedExpanded = localStorage.getItem('expandedMovies');
  expandedIds = savedExpanded ? JSON.parse(savedExpanded) : [];

  // Collapsed-days state is per year, since which days exist (and what they
  // mean) differs between editions. The very first time (nothing saved yet)
  // everything starts collapsed, except whichever day holds the live/next
  // session — otherwise the "siguiente" banner and the auto-scroll-to-it on
  // load would be pointing at a day that's hidden by default.
  const savedCollapsed = localStorage.getItem(`collapsedDays_${currentYear}`);
  collapsedDays = savedCollapsed ? JSON.parse(savedCollapsed) : defaultCollapsedDays();

  // Initialize posterCache from posterURL in sessions data
  posterCache = {};
  sessions.forEach(session => {
    if (session.posterURL) {
      posterCache[session.id] = session.posterURL;
    }
  });

  renderSessions();
}

// Switch to a different year's programme (triggered from the year dropdown)
async function switchYear(year) {
  if (year === currentYear) return;
  currentYear = year;
  document.getElementById('header-year').textContent = year;
  document.title = `Festival de Sitges ${year}`;
  document.getElementById('sessions-container').innerHTML =
    '<div class="flex flex-col items-center justify-center gap-4 py-20 text-gray-400"><div class="spinner"></div><p class="text-sm">Cargando programación…</p></div>';
  await loadSessions(year);
  afterSessionsLoaded();
  scrollToCurrentSession();
}

// Small dropdown, placed at the very bottom of the page, to browse other
// years' programmes. Only rendered once; later years are just options.
function renderYearSwitcher() {
  const el = document.getElementById('year-switcher');
  if (!el || el.dataset.rendered) return;
  el.dataset.rendered = '1';
  const select = document.createElement('select');
  select.id = 'year-select';
  select.className = 'bg-gray-900 border-2 border-sitges-red/50 rounded-lg px-4 py-2 text-sm font-medium text-white focus:outline-none focus:ring-2 focus:ring-sitges-red';
  AVAILABLE_YEARS.forEach(({ year, label }) => {
    const opt = document.createElement('option');
    opt.value = year;
    opt.textContent = label;
    if (year === currentYear) opt.selected = true;
    select.appendChild(opt);
  });
  select.addEventListener('change', (e) => switchYear(e.target.value));
  el.innerHTML = '<label class="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 text-center">Ver otra edición</label>';
  el.appendChild(select);
}

// Scroll the live or next session card into view (once, on load)
function scrollToCurrentSession() {
  const now = new Date();
  const nextId = findNextSessionId(now);
  const targetId = sessions.find(s => getSessionStatus(s, now, nextId) === 'live')?.id || nextId;
  if (!targetId) return;
  const card = document.querySelector(`.movie-card[data-session-id="${targetId}"]`);
  if (card) {
    setTimeout(() => card.scrollIntoView({ behavior: 'smooth', block: 'center' }), 300);
  }
}

// Refresh only the "ahora / siguiente" banner and status badges, cheaply,
// without losing scroll position or expanded/collapsed state.
function updateNowNext() {
  renderNowNextBanner();
  const now = new Date();
  const nextId = findNextSessionId(now);
  document.querySelectorAll('.movie-card').forEach(card => {
    const session = sessions.find(s => s.id === card.dataset.sessionId);
    if (!session) return;
    const status = getSessionStatus(session, now, nextId);
    card.dataset.status = status;
    const badge = card.querySelector('.status-badge');
    if (badge) {
      if (status === 'live') {
        badge.textContent = '▶ AHORA';
        badge.className = 'status-badge inline-block text-xs font-black px-2 py-0.5 rounded-full bg-green-500 text-black animate-pulse';
      } else if (status === 'next') {
        badge.textContent = '⏭ SIGUIENTE';
        badge.className = 'status-badge inline-block text-xs font-black px-2 py-0.5 rounded-full bg-yellow-400 text-black';
      } else {
        badge.remove();
      }
    }
    card.classList.toggle('opacity-50', status === 'past');
  });
}

// Sticky banner at the top telling you exactly what's on now and what's next
function renderNowNextBanner() {
  const el = document.getElementById('now-next-banner');
  if (!el) return;
  const now = new Date();
  const live = sessions.find(s => getSessionStart(s) && now >= getSessionStart(s) && now < getSessionEnd(s));
  const nextId = findNextSessionId(now);
  const next = sessions.find(s => s.id === nextId);

  if (!live && !next) {
    el.classList.add('hidden');
    return;
  }
  el.classList.remove('hidden');

  const parts = [];
  if (live) {
    const end = getSessionEnd(live);
    parts.push(`<button onclick="scrollToSession('${live.id}')" class="flex-1 text-left">
      <span class="text-[10px] font-black text-green-400 uppercase tracking-wider">▶ Ahora en ${live.sala}</span>
      <div class="font-bold text-white leading-tight">${live.title}</div>
      <span class="text-xs text-gray-400">hasta las ${end.toTimeString().slice(0,5)}</span>
    </button>`);
  }
  if (next) {
    parts.push(`<button onclick="scrollToSession('${next.id}')" class="flex-1 text-left ${live ? 'border-l border-sitges-red/30 pl-3' : ''}">
      <span class="text-[10px] font-black text-yellow-400 uppercase tracking-wider">⏭ Siguiente</span>
      <div class="font-bold text-white leading-tight">${next.title}</div>
      <span class="text-xs text-gray-400">${next.start} · ${next.sala}</span>
    </button>`);
  }
  el.innerHTML = `<div class="flex gap-3">${parts.join('')}</div>`;
}

// Scroll to any session card by id (used by the banner buttons)
function scrollToSession(id) {
  const card = document.querySelector(`.movie-card[data-session-id="${id}"]`);
  if (card) card.scrollIntoView({ behavior: 'smooth', block: 'center' });
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

// Toggle a whole day's session list open/closed, mirroring how individual
// movie cards expand/collapse.
function toggleDayCollapse(day) {
  const index = collapsedDays.indexOf(day);
  const nowCollapsed = index === -1;
  if (nowCollapsed) {
    collapsedDays.push(day);
  } else {
    collapsedDays.splice(index, 1);
  }
  localStorage.setItem(`collapsedDays_${currentYear}`, JSON.stringify(collapsedDays));

  const sessionsContainer = document.querySelector(`[data-day="${CSS.escape(day)}"]`);
  if (!sessionsContainer) return;
  sessionsContainer.classList.toggle('hidden', nowCollapsed);

  const chevron = sessionsContainer.previousElementSibling?.querySelector('polyline');
  if (chevron) {
    chevron.setAttribute('points', nowCollapsed ? '6 9 12 15 18 9' : '18 15 12 9 6 15');
  }
}

// Render sessions
function renderSessions() {
  const container = document.getElementById('sessions-container');
  const groupedByDay = groupSessionsByDay(sessions);

  renderNowNextBanner();

  // Update movie count
  const movieCount = document.getElementById('movie-count');
  movieCount.textContent = `${sessions.length} película${sessions.length !== 1 ? 's' : ''}`;

  // Clear container
  container.innerHTML = '';
  
  // Render each day
  Object.entries(groupedByDay).forEach(([day, daySessions]) => {
    const isCollapsed = collapsedDays.includes(day);

    const daySection = document.createElement('div');
    daySection.className = 'space-y-4';

    const dayHeader = document.createElement('div');
    dayHeader.className = 'flex items-center gap-3 mb-4 pb-3 border-b-2 border-sitges-pink/50 cursor-pointer select-none';
    dayHeader.onclick = () => toggleDayCollapse(day);
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
      <div class="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-full bg-sitges-red/30">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="text-white">
          <polyline points="${isCollapsed ? '6 9 12 15 18 9' : '18 15 12 9 6 15'}"></polyline>
        </svg>
      </div>
    `;
    daySection.appendChild(dayHeader);

    const sessionsContainer = document.createElement('div');
    sessionsContainer.className = 'space-y-3' + (isCollapsed ? ' hidden' : '');
    sessionsContainer.dataset.day = day;

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
  const now = new Date();
  const status = getSessionStatus(session, now, findNextSessionId(now));

  const card = document.createElement('div');
  card.className = `movie-card bg-gradient-to-br from-gray-900/90 to-gray-900/70 backdrop-blur rounded-xl overflow-hidden border shadow-lg transition-all ${isExpanded ? 'expanded' : ''} ${status === 'live' ? 'border-green-400 ring-2 ring-green-400/50' : status === 'next' ? 'border-yellow-400 ring-2 ring-yellow-400/40' : 'border-sitges-red/30'} ${status === 'past' ? 'opacity-50' : ''}`;
  card.dataset.sessionId = session.id;
  card.dataset.status = status;

  const statusBadge = status === 'live'
    ? '<span class="status-badge inline-block text-xs font-black px-2 py-0.5 rounded-full bg-green-500 text-black animate-pulse mb-2">▶ AHORA</span>'
    : status === 'next'
    ? '<span class="status-badge inline-block text-xs font-black px-2 py-0.5 rounded-full bg-yellow-400 text-black mb-2">⏭ SIGUIENTE</span>'
    : '';

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
        ${statusBadge ? `<div>${statusBadge}</div>` : ''}
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
        ${session.imdbURL ? `
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
        ` : `
        <div class="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-gray-800 text-gray-500 font-semibold rounded-lg border border-gray-700">
          Sin ficha en IMDb
        </div>
        `}
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

// Check if already installed — if so, there's nothing useful the button can
// offer, so just hide it instead of showing a disabled "✓ Ya instalada".
window.addEventListener('DOMContentLoaded', () => {
  const installBtn = document.getElementById('pwa-install-btn');
  if (!installBtn) return;

  if (window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true) {
    installBtn.style.display = 'none';
  } else if (!installable) {
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
