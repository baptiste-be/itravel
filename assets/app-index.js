const STORAGE_KEY = 'itravel_v3';

function loadState() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || { trips: [] };
  } catch {
    return { trips: [] };
  }
}

function saveState(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function createTripCard(trip) {
  const card = document.createElement('article');
  card.className = 'card-flat trip-item';

  const title = document.createElement('h3');
  title.textContent = trip.name;

  const meta = document.createElement('p');
  meta.textContent = `Créé le ${new Date(trip.createdAt).toLocaleString('fr-FR')}`;

  const open = document.createElement('a');
  open.className = 'btn';
  open.href = `trip.html?id=${encodeURIComponent(trip.id)}`;
  open.textContent = 'Ouvrir la page voyage';

  const remove = document.createElement('button');
  remove.className = 'btn';
  remove.textContent = 'Supprimer';
  remove.addEventListener('click', () => {
    const state = loadState();
    state.trips = state.trips.filter((t) => t.id !== trip.id);
    saveState(state);
    render();
  });

  card.append(title, meta, open, remove);
  return card;
}

function render() {
  const state = loadState();
  const list = document.getElementById('trip-list');
  const empty = document.getElementById('trip-empty');
  list.innerHTML = '';

  if (!state.trips.length) {
    empty.style.display = 'block';
    return;
  }

  empty.style.display = 'none';
  for (const trip of state.trips) list.appendChild(createTripCard(trip));
}

function setupCreation() {
  const input = document.getElementById('trip-name');
  const btn = document.getElementById('trip-create');

  const create = () => {
    const name = input.value.trim();
    if (!name) return;

    const state = loadState();
    state.trips.unshift({
      id: Date.now().toString(36),
      name,
      createdAt: new Date().toISOString(),
      data: {
        departureTime: '',
        departureLabel: '',
        arrivalLabel: '',
        departurePoint: null,
        arrivalPoint: null,
        profile: 'driving',
        itinerary: [],
      },
    });

    saveState(state);
    input.value = '';
    render();
  };

  btn.addEventListener('click', create);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') create();
  });
}

setupCreation();
render();
