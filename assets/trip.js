const STORAGE_KEY = 'itravel_v3';
const TUTORIAL_KEY = 'itravel_tutorial_progress_v1';

const query = new URLSearchParams(window.location.search);
const tripId = query.get('id');

const refs = {
  root: document.getElementById('trip-root'),
  title: document.getElementById('trip-title'),
  departureTime: document.getElementById('departure-time'),
  departureLabel: document.getElementById('departure-label'),
  arrivalLabel: document.getElementById('arrival-label'),
  profile: document.getElementById('profile'),
  searchResults: document.getElementById('search-results'),
  usePosition: document.getElementById('use-position'),
  btnRoute: document.getElementById('btn-route'),
  btnPlan: document.getElementById('btn-plan'),
  kpiDistance: document.getElementById('kpi-distance'),
  kpiDuration: document.getElementById('kpi-duration'),
  kpiCost: document.getElementById('kpi-cost'),
  weather: document.getElementById('weather'),
  trainInfo: document.getElementById('train-info'),
  trafficInfo: document.getElementById('traffic-info'),
  messages: document.getElementById('assistant-messages'),
  assistantInput: document.getElementById('assistant-input'),
  assistantSend: document.getElementById('assistant-send'),
  itinerary: document.getElementById('itinerary'),
  activityInput: document.getElementById('activity-input'),
  activityAdd: document.getElementById('activity-add'),
  suggestions: document.getElementById('suggestions'),
  tutorialBox: document.getElementById('tutorial-box'),
  tutorialProgress: document.getElementById('tutorial-progress'),
};

const state = {
  trip: null,
  map: null,
  routeLine: null,
  markers: { depart: null, arrivee: null },
  activeSearchTarget: null,
  routeSeconds: null,
  routeMeters: null,
  suggestions: [],
};

const tutorialFlow = [
  {
    id: 0,
    selector: '#t-step-1',
    title: 'Étape 1',
    text: 'Entre la date et l’heure de départ pour construire ton planning réel.',
    done: () => Boolean(refs.departureTime.value),
  },
  {
    id: 1,
    selector: '#t-step-2',
    title: 'Étape 2',
    text: 'Saisis la ville de départ (ou prends ta position GPS).',
    done: () => Boolean(state.trip?.data?.departurePoint),
  },
  {
    id: 2,
    selector: '#t-step-3',
    title: 'Étape 3',
    text: 'Calcule la route pour obtenir distance, météo, train et trafic estimé.',
    done: () => Boolean(state.routeSeconds),
  },
  {
    id: 3,
    selector: '#t-step-4',
    title: 'Étape 4',
    text: 'Utilise l’assistant pour exécuter des actions en langage naturel.',
    done: () => localStorage.getItem('itravel_assistant_used') === '1',
  },
];

function loadStore() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || { trips: [] };
  } catch {
    return { trips: [] };
  }
}

function saveStore(store) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
}

function persistTrip() {
  const store = loadStore();
  store.trips = store.trips.map((t) => (t.id === state.trip.id ? state.trip : t));
  saveStore(store);
}

function findTrip() {
  const store = loadStore();
  return store.trips.find((t) => t.id === tripId) || null;
}

function ensureTripData(trip) {
  if (!trip.data) trip.data = {};
  if (!trip.data.itinerary) trip.data.itinerary = [];
  if (!trip.data.profile) trip.data.profile = 'driving';
}

function initPage() {
  if (!tripId) {
    window.location.href = 'index.html';
    return;
  }

  const trip = findTrip();
  if (!trip) {
    window.location.href = 'index.html';
    return;
  }

  ensureTripData(trip);
  state.trip = trip;

  refs.root.style.display = 'block';
  refs.title.textContent = trip.name;
  refs.departureTime.value = trip.data.departureTime || '';
  refs.departureLabel.value = trip.data.departureLabel || '';
  refs.arrivalLabel.value = trip.data.arrivalLabel || '';
  refs.profile.value = trip.data.profile || 'driving';

  initMap();
  restoreMarkers();
  renderItinerary();
  pushAssistant('Assistant prêt. Demande une action: calcule, planning, meteo, train.');
  registerEvents();
  updateTutorial();
}

function initMap() {
  state.map = L.map('map').setView([46.7, 2.4], 6);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap',
  }).addTo(state.map);
}

function restoreMarkers() {
  const { departurePoint, arrivalPoint } = state.trip.data;
  if (departurePoint) setMarker('depart', departurePoint.lat, departurePoint.lon, 'Départ');
  if (arrivalPoint) setMarker('arrivee', arrivalPoint.lat, arrivalPoint.lon, 'Arrivée');
}

function setMarker(type, lat, lon, popupText) {
  if (state.markers[type]) state.map.removeLayer(state.markers[type]);
  state.markers[type] = L.marker([lat, lon]).addTo(state.map).bindPopup(popupText);
}

async function searchPlaces(target, value) {
  state.activeSearchTarget = target;
  if (!value || value.length < 3) {
    refs.searchResults.innerHTML = '';
    return;
  }

  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(value)}`);
    const data = await res.json();
    renderSearchResults(data.slice(0, 5));
  } catch {
    refs.searchResults.innerHTML = '';
  }
}

function renderSearchResults(items) {
  refs.searchResults.innerHTML = '';
  for (const item of items) {
    const btn = document.createElement('button');
    btn.className = 'result-btn';
    btn.textContent = item.display_name;
    btn.addEventListener('click', () => selectPlace(item));
    refs.searchResults.appendChild(btn);
  }
}

function selectPlace(item) {
  const lat = Number(item.lat);
  const lon = Number(item.lon);
  const target = state.activeSearchTarget;
  if (!target) return;

  if (target === 'depart') {
    refs.departureLabel.value = item.display_name;
    state.trip.data.departureLabel = item.display_name;
    state.trip.data.departurePoint = { lat, lon };
    setMarker('depart', lat, lon, 'Départ');
  }

  if (target === 'arrivee') {
    refs.arrivalLabel.value = item.display_name;
    state.trip.data.arrivalLabel = item.display_name;
    state.trip.data.arrivalPoint = { lat, lon };
    setMarker('arrivee', lat, lon, 'Arrivée');
  }

  refs.searchResults.innerHTML = '';
  state.map.flyTo([lat, lon], 10);
  persistTrip();
  updateTutorial();
}

function registerEvents() {
  refs.departureTime.addEventListener('change', () => {
    state.trip.data.departureTime = refs.departureTime.value;
    persistTrip();
    updateTutorial();
  });

  refs.departureLabel.addEventListener('input', () => searchPlaces('depart', refs.departureLabel.value));
  refs.arrivalLabel.addEventListener('input', () => searchPlaces('arrivee', refs.arrivalLabel.value));

  refs.profile.addEventListener('change', () => {
    state.trip.data.profile = refs.profile.value;
    persistTrip();
  });

  refs.usePosition.addEventListener('click', useMyPositionAsDepart);
  refs.btnRoute.addEventListener('click', computeRouteBundle);
  refs.btnPlan.addEventListener('click', generateRealPlan);

  refs.assistantSend.addEventListener('click', runAssistant);
  refs.assistantInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') runAssistant();
  });

  refs.activityAdd.addEventListener('click', addManualActivity);
}

async function useMyPositionAsDepart() {
  if (!navigator.geolocation) return pushAssistant('Géolocalisation non disponible.');
  navigator.geolocation.getCurrentPosition(async (position) => {
    const lat = position.coords.latitude;
    const lon = position.coords.longitude;

    state.trip.data.departurePoint = { lat, lon };
    state.trip.data.departureLabel = 'Ma position actuelle';
    refs.departureLabel.value = 'Ma position actuelle';
    setMarker('depart', lat, lon, 'Départ (GPS)');
    state.map.flyTo([lat, lon], 11);
    persistTrip();
    pushAssistant('Départ mis à jour avec ta position GPS.');
    updateTutorial();
  });
}

async function computeRouteBundle() {
  const route = await computeMainRoute();
  if (!route) return;
  await Promise.all([fetchWeather(), fetchTrainConnections(), fetchSuggestions()]);
  updateTrafficEstimate(route);
  updateTutorial();
}

async function computeMainRoute() {
  const dep = state.trip.data.departurePoint;
  const arr = state.trip.data.arrivalPoint;
  if (!dep || !arr) {
    pushAssistant('Ajoute départ et arrivée avant de calculer.');
    return null;
  }

  const profile = state.trip.data.profile || 'driving';
  const coords = `${dep.lon},${dep.lat};${arr.lon},${arr.lat}`;

  try {
    const res = await fetch(`https://router.project-osrm.org/route/v1/${profile}/${coords}?overview=full&geometries=geojson`);
    const data = await res.json();
    const route = data?.routes?.[0];
    if (!route) throw new Error('route empty');

    const km = route.distance / 1000;
    const minutes = Math.round(route.duration / 60);

    state.routeMeters = route.distance;
    state.routeSeconds = route.duration;

    refs.kpiDistance.textContent = `${km.toFixed(1)} km`;
    refs.kpiDuration.textContent = `${minutes} min`;

    const fuel = profile === 'driving' ? (km * 0.11).toFixed(2) : (km * 0.03).toFixed(2);
    refs.kpiCost.textContent = `${fuel} €`;

    drawRoute(route.geometry.coordinates);
    persistTrip();
    pushAssistant(`Route ${profile} calculée: ${km.toFixed(1)} km en ${minutes} min.`);
    maybeScheduleDepartureNotification();
    return route;
  } catch {
    pushAssistant('Calcul route indisponible pour le moment.');
    return null;
  }
}

function drawRoute(coords) {
  const latlngs = coords.map((c) => [c[1], c[0]]);
  if (state.routeLine) state.map.removeLayer(state.routeLine);
  state.routeLine = L.polyline(latlngs, { weight: 5, color: '#111827', opacity: 0.85 }).addTo(state.map);
  state.map.fitBounds(state.routeLine.getBounds(), { padding: [30, 30] });
}

async function fetchWeather() {
  const arr = state.trip.data.arrivalPoint;
  if (!arr) return;

  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${arr.lat}&longitude=${arr.lon}&current=temperature_2m,weather_code,wind_speed_10m`;
    const res = await fetch(url);
    const data = await res.json();
    const c = data.current;
    refs.weather.textContent = `${Math.round(c.temperature_2m)}°C · vent ${Math.round(c.wind_speed_10m)} km/h · code météo ${c.weather_code}`;
  } catch {
    refs.weather.textContent = 'Météo indisponible.';
  }
}

async function fetchTrainConnections() {
  const from = state.trip.data.departureLabel;
  const to = state.trip.data.arrivalLabel;
  if (!from || !to) return;

  try {
    const url = `https://transport.opendata.ch/v1/connections?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&limit=3`;
    const res = await fetch(url);
    const data = await res.json();
    const first = data.connections?.[0];
    if (!first) {
      refs.trainInfo.textContent = 'Aucune connexion train trouvée sur cette API.';
      return;
    }

    const dep = new Date(first.from.departure).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    const arr = new Date(first.to.arrival).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    refs.trainInfo.textContent = `Prochain train: départ ${dep}, arrivée ${arr}, ${first.transfers} correspondance(s).`;
  } catch {
    refs.trainInfo.textContent = 'Infos train indisponibles (API externe).';
  }
}

function updateTrafficEstimate(route) {
  const km = route.distance / 1000;
  const realHours = route.duration / 3600;
  const avgSpeed = km / Math.max(realHours, 0.01);
  const freeFlow = 95;
  const ratio = avgSpeed / freeFlow;

  if (ratio >= 0.85) {
    refs.trafficInfo.textContent = `Fluide (${avgSpeed.toFixed(0)} km/h moyen).`;
  } else if (ratio >= 0.55) {
    refs.trafficInfo.textContent = `Dense (${avgSpeed.toFixed(0)} km/h moyen).`;
  } else {
    refs.trafficInfo.textContent = `Très chargé (${avgSpeed.toFixed(0)} km/h moyen).`;
  }
}

async function fetchSuggestions() {
  const arr = state.trip.data.arrivalPoint;
  if (!arr) return;

  const query = `[out:json][timeout:20];(node(around:2200,${arr.lat},${arr.lon})[amenity=restaurant];node(around:2200,${arr.lat},${arr.lon})[tourism=hotel];);out body 10;`;
  try {
    const res = await fetch('https://overpass-api.de/api/interpreter', {
      method: 'POST',
      body: query,
    });
    const data = await res.json();
    state.suggestions = (data.elements || []).slice(0, 8).map((el) => {
      const name = el.tags?.name || 'Lieu sans nom';
      if (el.tags?.amenity === 'restaurant') return `🍽️ ${name}`;
      if (el.tags?.tourism === 'hotel') return `🏨 ${name}`;
      return name;
    });
    renderSuggestions();
  } catch {
    state.suggestions = ['Suggestions indisponibles.'];
    renderSuggestions();
  }
}

function renderSuggestions() {
  refs.suggestions.innerHTML = '';
  for (const s of state.suggestions) {
    const el = document.createElement('div');
    el.className = 'list-item';
    el.textContent = s;
    refs.suggestions.appendChild(el);
  }
}

function generateRealPlan() {
  const depDate = state.trip.data.departureTime ? new Date(state.trip.data.departureTime) : new Date();
  const out = [];
  out.push({ time: toHHMM(depDate), task: `Départ: ${state.trip.data.departureLabel || 'non défini'}` });

  if (state.routeSeconds) {
    const mid = new Date(depDate.getTime() + (state.routeSeconds * 1000) / 2);
    const end = new Date(depDate.getTime() + state.routeSeconds * 1000);
    out.push({ time: toHHMM(mid), task: 'Pause recommandée + vérification trafic' });
    out.push({ time: toHHMM(end), task: `Arrivée: ${state.trip.data.arrivalLabel || 'destination'}` });
  }

  if (state.suggestions[0]) out.push({ time: 'Après arrivée', task: `Option: ${state.suggestions[0]}` });

  state.trip.data.itinerary = out;
  persistTrip();
  renderItinerary();
  pushAssistant('Planning réel généré à partir des données actuelles.');
}

function addManualActivity() {
  const raw = refs.activityInput.value.trim();
  const match = raw.match(/^(\d{1,2}:\d{2})\s+(.+)$/);
  if (!match) {
    pushAssistant('Format attendu: 15:30 visite musée');
    return;
  }

  state.trip.data.itinerary.push({ time: match[1], task: match[2] });
  refs.activityInput.value = '';
  persistTrip();
  renderItinerary();
}

function renderItinerary() {
  refs.itinerary.innerHTML = '';
  const list = state.trip.data.itinerary || [];
  if (!list.length) {
    const empty = document.createElement('div');
    empty.className = 'list-item muted';
    empty.textContent = 'Aucun événement pour le moment.';
    refs.itinerary.appendChild(empty);
    return;
  }

  for (const ev of list) {
    const row = document.createElement('div');
    row.className = 'list-item';
    row.innerHTML = `<strong>${ev.time}</strong><div class="muted" style="margin-top:4px;">${ev.task}</div>`;
    refs.itinerary.appendChild(row);
  }
}

function runAssistant() {
  const text = refs.assistantInput.value.trim();
  if (!text) return;
  refs.assistantInput.value = '';
  addMessage('user', text);

  const q = text.toLowerCase();
  localStorage.setItem('itravel_assistant_used', '1');

  if (q.includes('calcule') || q.includes('itinéraire') || q.includes('route')) {
    computeRouteBundle();
    return;
  }

  if (q.includes('planning')) {
    generateRealPlan();
    return;
  }

  if (q.includes('meteo') || q.includes('météo')) {
    fetchWeather().then(() => pushAssistant(`Météo mise à jour: ${refs.weather.textContent}`));
    return;
  }

  if (q.includes('train')) {
    fetchTrainConnections().then(() => pushAssistant(`Infos train: ${refs.trainInfo.textContent}`));
    return;
  }

  if (q.includes('position')) {
    useMyPositionAsDepart();
    return;
  }

  if (q.includes('ajoute')) {
    const cleaned = text.replace(/ajoute/i, '').trim();
    refs.activityInput.value = cleaned;
    addManualActivity();
    pushAssistant('Demande ajoutée au planning.');
    return;
  }

  pushAssistant('Action non reconnue. Essaye: calcule itinéraire, planning, meteo, train, ajoute 14:00 ...');
  updateTutorial();
}

function addMessage(role, content) {
  const div = document.createElement('div');
  div.className = `bubble ${role}`;
  div.textContent = content;
  refs.messages.appendChild(div);
  refs.messages.scrollTop = refs.messages.scrollHeight;
}

function pushAssistant(message) {
  addMessage('assistant', message);
  updateTutorial();
}

function toHHMM(d) {
  return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

function maybeScheduleDepartureNotification() {
  if (!state.trip.data.departureTime || typeof Notification === 'undefined') return;
  const ts = new Date(state.trip.data.departureTime).getTime();
  const diff = ts - Date.now();
  if (diff <= 0 || diff > 6 * 60 * 60 * 1000) return;

  if (Notification.permission === 'granted') {
    setTimeout(() => {
      new Notification('iTravel', { body: 'Départ maintenant 🚗' });
    }, diff);
  } else if (Notification.permission !== 'denied') {
    Notification.requestPermission();
  }
}

function getTutorialProgress() {
  const value = Number(localStorage.getItem(TUTORIAL_KEY) || '0');
  return Number.isNaN(value) ? 0 : value;
}

function setTutorialProgress(step) {
  localStorage.setItem(TUTORIAL_KEY, String(step));
}

function updateTutorial() {
  let progress = getTutorialProgress();

  while (progress < tutorialFlow.length && tutorialFlow[progress].done()) {
    progress += 1;
    setTutorialProgress(progress);
  }

  refs.tutorialProgress.style.width = `${(progress / tutorialFlow.length) * 100}%`;

  if (progress >= tutorialFlow.length) {
    refs.tutorialBox.style.display = 'none';
    return;
  }

  const step = tutorialFlow[progress];
  renderTutorial(step, progress + 1, tutorialFlow.length);
}

function renderTutorial(step, index, total) {
  const target = document.querySelector(step.selector);
  if (!target) return;

  const rect = target.getBoundingClientRect();
  const top = Math.max(12, window.scrollY + rect.bottom + 12);
  const left = Math.max(12, Math.min(window.innerWidth - 340, rect.left));

  refs.tutorialBox.style.top = `${top}px`;
  refs.tutorialBox.style.left = `${left}px`;
  refs.tutorialBox.style.display = 'block';
  refs.tutorialBox.innerHTML = `
    <div class="arrow"></div>
    <p class="tutorial-title">${step.title} (${index}/${total})</p>
    <p class="tutorial-text">${step.text}</p>
    <p class="muted" style="margin:0; font-size:12px;">Le tuto avance automatiquement quand l’étape est validée.</p>
  `;
}

window.addEventListener('resize', updateTutorial);
window.addEventListener('scroll', updateTutorial);

initPage();
