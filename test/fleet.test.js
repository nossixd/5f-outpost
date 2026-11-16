const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createServer } = require('../src/server');
const { createFleetStore, mapFleetRow, decodePolyline } = require('../src/fleet');

const now = Date.parse('2026-11-16T18:00:00.000Z');

function databaseRow(index, ageMs = 0) {
  const vehicleId = `VH-00${index + 1}`;
  const orderId = `TR-00${index + 1}`;
  return {
    vehicle_id: vehicleId,
    registration: `WX 000${index}`,
    model: 'Demo truck',
    street: 'Aleje Jerozolimskie',
    city: 'Warszawa',
    country: 'Polska',
    latitude: 52.2297 + index / 100,
    longitude: 21.0122 + index / 100,
    speed_kmh: 62.5 + index,
    location_updated_at: new Date(now - ageMs),
    route_id: `VR-00${index + 1}`,
    route_name: 'Warszawa → Kraków',
    route_coordinates: [{ lat: 52.2297, lng: 21.0122 }, { lat: 50.0647, lng: 19.945 }],
    order_id: orderId,
    order_route: 'Warszawa → Kraków',
    order_status: 'in_progress',
    planned_at: new Date(now),
    eta: new Date(now + 20 * 60_000),
    eta_reliable: true,
    decision: null,
    decision_at: null,
  };
}

async function listeningServer(t, options) {
  const server = createServer(options);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  return `http://127.0.0.1:${server.address().port}`;
}

test('FR-01 fleet: PostgreSQL adapter returns vehicle, route, order and ETA data', async t => {
  const rows = Array.from({ length: 5 }, (_, index) => databaseRow(index, index * 10_000));
  let queryText = '';
  const fleetStore = createFleetStore({
    pool: {
      async query(sql) {
        queryText = sql;
        return { rows };
      },
    },
    now: () => now,
  });
  const base = await listeningServer(t, { mode: 'postgres', fleetStore });
  const response = await fetch(`${base}/api/vehicles`);
  assert.equal(response.status, 200);
  const data = await response.json();
  assert.equal(data.vehicles.length, 5);
  assert.equal(data.staleAfterSeconds, 30);
  assert.equal(data.vehicles[0].speedKmh, 62.5);
  assert.equal(data.vehicles[0].location.street, 'Aleje Jerozolimskie');
  assert.equal(data.vehicles[0].location.city, 'Warszawa');
  assert.equal(data.vehicles[0].location.country, 'Polska');
  assert.equal(data.vehicles[0].location.latitude, 52.2297);
  assert.equal(data.vehicles[0].order.id, 'TR-001');
  assert.equal(data.vehicles[0].order.status, 'in_progress');
  assert.equal(data.vehicles[0].order.delayStatus, 'at_risk');
  assert.equal(data.vehicles[0].route.coordinates.length, 2);
  assert.equal(data.vehicles[3].location.stale, false);
  assert.equal(data.vehicles[4].location.stale, true);
  assert.match(queryText, /FROM vehicles/);
  assert.match(queryText, /vehicle_locations/);
  assert.match(queryText, /transport_orders/);
  assert.match(queryText, /vehicle_routes/);
  const config = await (await fetch(`${base}/api/config`)).json();
  assert.ok(Object.hasOwn(config, 'googleMapsApiKey'));
});

test('FR-01 fleet: próg świeżości jest ściśle większy niż 30 sekund', () => {
  const fresh = mapFleetRow(databaseRow(0, 30_000), now);
  const stale = mapFleetRow(databaseRow(1, 30_001), now);
  const missingTime = mapFleetRow({ ...databaseRow(2), location_updated_at: null }, now);
  assert.equal(fresh.location.stale, false);
  assert.equal(fresh.location.ageSeconds, 30);
  assert.equal(stale.location.stale, true);
  assert.equal(stale.location.ageSeconds, 31);
  assert.equal(missingTime.location.stale, true);
  assert.equal(missingTime.location.updatedAt, null);
});

test('FR-01 fleet: błąd bazy zwraca 503, tryb demo nie zastępuje danych z tablicy', async t => {
  const failedStore = { list: async () => { throw new Error('szczegóły połączenia'); } };
  const postgres = await listeningServer(t, { mode: 'postgres', fleetStore: failedStore });
  const failed = await fetch(`${postgres}/api/vehicles`);
  assert.equal(failed.status, 503);
  assert.equal((await failed.text()).includes('szczegóły połączenia'), false);

  const demo = await listeningServer(t, { mode: 'demo' });
  const unavailable = await fetch(`${demo}/api/vehicles`);
  assert.equal(unavailable.status, 503);
  assert.match((await unavailable.json()).error, /DATA_SOURCE=postgres/);
});

test('FR-01 opcjonalna Routes API: żądanie jest jawne, lokalne i nie ujawnia klucza', async t => {
  let calledWith = null;
  let callCount = 0;
  const fleetStore = {
    roadRoute: async id => {
      calledWith = id;
      callCount++;
      return { coordinates: [{ lat: 1, lng: 2 }, { lat: 3, lng: 4 }] };
    },
  };
  const base = await listeningServer(t, { mode: 'postgres', fleetStore, roadRoutesEnabled: true });
  const config = await (await fetch(`${base}/api/config`)).json();
  assert.equal(config.roadRoutesEnabled, true);
  assert.equal(Object.hasOwn(config, 'googleRoutesApiKey'), false);

  const response = await fetch(`${base}/api/vehicles/VH-001/road-route`, { method: 'POST' });
  assert.equal(response.status, 200);
  assert.equal(calledWith, 'VH-001');
  assert.equal((await response.json()).route.coordinates.length, 2);
  const crossOrigin = await fetch(`${base}/api/vehicles/VH-001/road-route`, {
    method: 'POST',
    headers: { Origin: 'https://attacker.example' },
  });
  assert.equal(crossOrigin.status, 403);
  assert.equal(callCount, 1);

  const disabled = await listeningServer(t, {
    mode: 'postgres',
    fleetStore: { roadRoute: async () => { throw new Error('Nie może wywołać usługi.'); } },
    roadRoutesEnabled: false,
  });
  assert.equal((await fetch(`${disabled}/api/vehicles/VH-001/road-route`, { method: 'POST' })).status, 503);
});

test('FR-01 opcjonalna Routes API: używa tylko aktywnej geometrii PostgreSQL i dekoduje polyline', async () => {
  let query = '';
  let queryValues;
  let request;
  const store = createFleetStore({
    pool: {
      async query(sql, values) {
        query = sql;
        queryValues = values;
        return { rows: [{ name: 'Warszawa → Kraków', coordinates: [{ lat: 52.22, lng: 21.01 }, { lat: 50.06, lng: 19.94 }] }] };
      },
    },
    routesApiKey: 'server-only-key',
    fetchImpl: async (url, options) => {
      request = { url, options };
      return {
        ok: true,
        json: async () => ({ routes: [{
          distanceMeters: 300_000,
          duration: '15000s',
          polyline: { encodedPolyline: '_p~iF~ps|U_ulLnnqC_mqNvxq`@' },
        }] }),
      };
    },
  });
  const route = await store.roadRoute('VH-001');
  assert.deepEqual(queryValues, ['VH-001']);
  assert.match(query, /vehicle_routes/);
  assert.match(query, /v\.active = true/);
  assert.match(request.url, /routes\.googleapis\.com/);
  assert.equal(request.options.headers['X-Goog-Api-Key'], 'server-only-key');
  assert.match(request.options.headers['X-Goog-FieldMask'], /routes\.polyline\.encodedPolyline/);
  assert.equal(JSON.parse(request.options.body).travelMode, 'DRIVE');
  assert.deepEqual(route.coordinates[0], { lat: 38.5, lng: -120.2 });
  assert.deepEqual(route.coordinates[2], { lat: 43.252, lng: -126.453 });
  assert.equal(route.distanceMeters, 300_000);
  assert.throws(() => decodePolyline('bad'), /geometrię trasy/);
});

function browserElement() {
  return {
    children: [],
    listeners: {},
    textContent: '',
    className: '',
    hidden: false,
    disabled: false,
    attributes: {},
    classList: {
      values: new Set(),
      toggle(name, enabled) { if (enabled) this.values.add(name); else this.values.delete(name); },
      add(name) { this.values.add(name); },
    },
    append(...children) { this.children.push(...children); },
    replaceChildren(...children) { this.children = children; },
    addEventListener(event, callback) { this.listeners[event] = callback; },
    setAttribute(name, value) { this.attributes[name] = value; },
    removeAttribute(name) { delete this.attributes[name]; },
  };
}

function browserHarness(vehicles, apiKey) {
  const ids = ['fleet-tab', 'delays-tab', 'delays-view', 'fleet-view', 'page-title',
    'fleet-refresh', 'fleet-error', 'fleet-map-status', 'fleet-map', 'fleet-count',
    'fleet-vehicles', 'fleet-details', 'fleet-details-content', 'fleet-road-route',
    'fleet-road-status', 'fleet-show-all'];
  const elements = Object.fromEntries(ids.map(id => [id, browserElement()]));
  const markers = [];
  const polylines = [];
  const mapCalls = { opened: false, fitBounds: 0, panTo: false, mapsCreated: 0, mapOptions: null };
  const mapsApi = {
    Map: class {
      constructor(element, options) { mapCalls.mapsCreated++; mapCalls.mapOptions = options; }
      panTo() { mapCalls.panTo = true; }
      fitBounds(bounds, padding) { mapCalls.fitBounds++; mapCalls.lastBounds = bounds; this.padding = padding; }
    },
    Polyline: class {
      constructor(options) { this.options = options; polylines.push(this); }
      setMap(map) { this.map = map; }
      setPath(path) { this.options.path = path; }
    },
    PinElement: class {
      constructor(options) { this.options = options; }
    },
    AdvancedMarkerElement: class {
      constructor(options) { this.options = options; this.title = options.title; this.listeners = {}; this.children = []; this.position = options.position; markers.push(this); }
      addEventListener(event, callback) { this.listeners[event] = callback; }
      append(child) { this.children.push(child); }
      replaceChildren(...children) { this.children = children; }
    },
    LatLngBounds: class {
      constructor() { this.points = []; }
      extend(point) { this.points.push(point); }
    },
    InfoWindow: class {
      setContent(content) { this.content = content; }
      setPosition(position) { this.position = position; }
      open() { mapCalls.opened = true; }
      close() {}
    },
  };
  const prompts = [];
  const window = {
    confirm: message => { prompts.push(message); return true; },
    google: { maps: { importLibrary: async () => mapsApi } },
  };
  const document = {
    title: '',
    head: {
      appendChild() {},
    },
    getElementById: id => elements[id],
    createElement: browserElement,
  };
  const requests = [];
  let currentVehicles = vehicles;
  let roadResponse = { route: { coordinates: [{ lat: 52, lng: 21 }, { lat: 50, lng: 20 }], distanceMeters: 200_000, durationSeconds: 10_000 } };
  const fetch = async url => {
    requests.push(url);
    if (url === '/api/vehicles') return { ok: true, json: async () => ({ vehicles: currentVehicles, staleAfterSeconds: 30 }) };
    if (url === '/api/config') return { ok: true, json: async () => ({ googleMapsApiKey: apiKey, googleMapsMapId: 'test-map', roadRoutesEnabled: true }) };
    if (url.endsWith('/road-route')) return { ok: !roadResponse.error, json: async () => roadResponse };
    throw new Error(`Nieoczekiwany URL: ${url}`);
  };
  return {
    document, elements, fetch, window, markers, polylines, mapCalls, mapsApi, requests, prompts,
    setVehicles(vehicles) { currentVehicles = vehicles; },
    setRoadResponse(response) { roadResponse = response; },
  };
}

test('interfejs floty: tworzy Advanced Markers, pokazuje wszystkie pojazdy i trasę po kliknięciu', async () => {
  const vehicles = Array.from({ length: 5 }, (_, index) => mapFleetRow(databaseRow(index), now));
  const harness = browserHarness(vehicles, 'restricted-browser-key');
  const vm = require('node:vm');
  const { readFileSync } = require('node:fs');
  vm.runInNewContext(readFileSync('public/fleet.js', 'utf8'), harness);
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(harness.requests, ['/api/vehicles', '/api/config']);
  assert.equal(harness.elements['fleet-vehicles'].children.length, 5);
  assert.equal(harness.markers.length, 5);
  assert.ok(harness.markers.every(marker => marker.options.gmpClickable));
  assert.equal(harness.markers[0].children[0].options.glyphText, '🚚');
  assert.match(harness.markers[0].title, /Demo truck.*TR-001/);
  assert.equal(harness.mapCalls.mapsCreated, 1);
  assert.equal(harness.mapCalls.mapOptions.mapId, 'test-map');
  assert.equal(harness.mapCalls.fitBounds, 1);
  assert.equal(harness.mapCalls.lastBounds.points.length, 5);
  assert.equal(harness.polylines.length, 5);

  const firstVehicle = harness.elements['fleet-vehicles'].children[0];
  assert.equal(firstVehicle.children[3].textContent, 'Pokaż trasę');
  harness.markers[0].listeners.pointerenter();
  assert.equal(harness.mapCalls.opened, true);
  harness.markers[0].listeners.pointerleave();
  firstVehicle.listeners.pointerenter();
  assert.equal(harness.polylines.at(-1).options.strokeColor, '#3b82f6');
  firstVehicle.listeners.pointerleave();
  firstVehicle.listeners.click();
  assert.equal(harness.polylines.at(-1).options.path.length, 2);
  assert.equal(harness.mapCalls.opened, true);
  assert.ok(harness.mapCalls.fitBounds >= 2);
  assert.equal(harness.elements['fleet-details'].hidden, false);
  assert.match(harness.elements['fleet-details-content'].children[0].children.map(item => item.textContent).join(' '), /Warszawa/);

  const firstActiveRoute = harness.polylines.at(-1);
  harness.markers[1].listeners['gmp-click']();
  assert.equal(firstActiveRoute.map, null);
  assert.match(harness.elements['fleet-map-status'].textContent, /TR-002/);

  harness.elements['fleet-show-all'].listeners.click();
  assert.equal(harness.elements['fleet-details'].hidden, true);
  assert.equal(harness.mapCalls.fitBounds, 4);
});

test('interfejs floty: odświeżenie aktualizuje markery bez ponownego tworzenia mapy', async () => {
  const initial = Array.from({ length: 5 }, (_, index) => mapFleetRow(databaseRow(index), now));
  const harness = browserHarness(initial, 'restricted-browser-key');
  const vm = require('node:vm');
  const { readFileSync } = require('node:fs');
  vm.runInNewContext(readFileSync('public/fleet.js', 'utf8'), harness);
  await new Promise(resolve => setImmediate(resolve));
  const firstMarker = harness.markers[0];
  const refreshed = initial.map(vehicle => ({ ...vehicle, location: { ...vehicle.location } }));
  refreshed[0].location.latitude += 0.1;
  harness.setVehicles(refreshed);
  await harness.elements['fleet-refresh'].listeners.click();
  assert.equal(harness.mapCalls.mapsCreated, 1);
  assert.equal(harness.markers.length, 5);
  assert.equal(harness.markers[0], firstMarker);
  assert.equal(firstMarker.position.lat, refreshed[0].location.latitude);
});

test('interfejs floty: brak klucza Google Maps nie blokuje listy pojazdów', async () => {
  const vehicle = mapFleetRow(databaseRow(0), now);
  const harness = browserHarness([vehicle], null);
  const vm = require('node:vm');
  const { readFileSync } = require('node:fs');
  vm.runInNewContext(readFileSync('public/fleet.js', 'utf8'), harness);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(harness.elements['fleet-vehicles'].children.length, 1);
  assert.match(harness.elements['fleet-map-status'].textContent, /GOOGLE_MAPS_API_KEY/);
  harness.elements['fleet-vehicles'].children[0].listeners.click();
  assert.equal(harness.elements['fleet-details'].hidden, false);
  harness.elements['fleet-show-all'].listeners.click();
  assert.equal(harness.elements['fleet-details'].hidden, true);
});

test('interfejs floty: trasa drogowa wymaga potwierdzenia i pokazuje błąd API', async () => {
  const vehicle = mapFleetRow(databaseRow(0), now);
  const harness = browserHarness([vehicle], 'restricted-browser-key');
  const vm = require('node:vm');
  const { readFileSync } = require('node:fs');
  vm.runInNewContext(readFileSync('public/fleet.js', 'utf8'), harness);
  await new Promise(resolve => setImmediate(resolve));
  harness.elements['fleet-vehicles'].children[0].listeners.click();
  await harness.elements['fleet-road-route'].listeners.click();
  assert.ok(harness.requests.includes('/api/vehicles/VH-001/road-route'));
  assert.match(harness.elements['fleet-road-status'].textContent, /ciężarówek/);
  assert.match(harness.prompts[0], /może naliczyć opłatę/);
  assert.match(harness.elements['fleet-details-content'].children[0].children.map(item => item.textContent).join(' '), /Google Routes API/);

  harness.setRoadResponse({ error: 'Nie udało się uzyskać trasy.' });
  await harness.elements['fleet-road-route'].listeners.click();
  assert.equal(harness.elements['fleet-road-status'].textContent, 'Nie udało się uzyskać trasy.');
});


test('monitoring floty: osobny dokument HTML w folderze strona, bez duplikatu w index.html', async () => {
  const { readFileSync } = require('node:fs');
  const page = readFileSync('strona/monitoring-floty.html', 'utf8');
  const index = readFileSync('public/index.html', 'utf8');
  assert.match(page, /id="fleet-map"/);
  assert.match(page, /id="fleet-vehicles"/);
  assert.match(page, /src="\/fleet.js"/);
  assert.doesNotMatch(index, /id="fleet-view"/);
  assert.match(index, /href="\/monitoring-floty.html"/);
  const server = createServer({ mode: 'demo' });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/monitoring-floty.html`);
    assert.equal(response.status, 200);
    assert.match(await response.text(), /id="fleet-map"/);
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
});
