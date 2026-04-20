let map;
let satelliteData = [];
let userMarker = null;
let userLocation = null;
let coverageLines = [];
let selectedSatellite = null;
let satelliteRefreshTimer = null;
let timelinePlaybackTimer = null;
let timelineBaseTime = Date.now();
let selectedTimelineStep = 0;
let isLiveMode = true;
let selectedTimestamp = null;
let terrainMaskLayer = null;
let terrainAnalysisRequestId = 0;
let terrainRefreshDebounceTimer = null;
let terrainRequestCooldownUntil = 0;
let terrainProfilePromiseCache = new Map();
let tleRefreshPromise = null;
let terrainProfile = {
    status: 'idle',
    locationKey: null
};

const spareSatelliteNumbers = [
    '162', '161', '169', '170', '176', '124', '175', '115', '105',
    '178', '179', '177', '174'
];

const IRIDIUM_SV_MAP = {
    '100': { svId: '73', orbitalPlane: '4' },
    '102': { svId: '112', orbitalPlane: '6' },
    '103': { svId: '103', orbitalPlane: '6' },
    '104': { svId: '110', orbitalPlane: '6' },
    '105': { svId: null, orbitalPlane: '5', isSpare: true },
    '106': { svId: '114', orbitalPlane: '6' },
    '107': { svId: '115', orbitalPlane: '4' },
    '108': { svId: '2', orbitalPlane: '5' },
    '109': { svId: '4', orbitalPlane: '6' },
    '110': { svId: '9', orbitalPlane: '6' },
    '111': { svId: '16', orbitalPlane: '6' },
    '112': { svId: '17', orbitalPlane: '6' },
    '113': { svId: '107', orbitalPlane: '2' },
    '114': { svId: '26', orbitalPlane: '6' },
    '115': { svId: null, orbitalPlane: '2', isSpare: true },
    '116': { svId: '28', orbitalPlane: '2' },
    '117': { svId: '29', orbitalPlane: '3' },
    '118': { svId: '33', orbitalPlane: '3' },
    '119': { svId: '36', orbitalPlane: '4' },
    '120': { svId: '38', orbitalPlane: '2' },
    '121': { svId: '42', orbitalPlane: '3' },
    '122': { svId: '44', orbitalPlane: '4' },
    '123': { svId: '48', orbitalPlane: '3' },
    '124': { svId: null, orbitalPlane: '1', isSpare: true },
    '125': { svId: '69', orbitalPlane: '4' },
    '126': { svId: '71', orbitalPlane: '3' },
    '128': { svId: '78', orbitalPlane: '4' },
    '129': { svId: '79', orbitalPlane: '4' },
    '130': { svId: '85', orbitalPlane: '2' },
    '131': { svId: '87', orbitalPlane: '2' },
    '132': { svId: '88', orbitalPlane: '4' },
    '133': { svId: '89', orbitalPlane: '4' },
    '134': { svId: '92', orbitalPlane: '2' },
    '135': { svId: '93', orbitalPlane: '2' },
    '136': { svId: '99', orbitalPlane: '4' },
    '137': { svId: '104', orbitalPlane: '2' },
    '138': { svId: '109', orbitalPlane: '2' },
    '139': { svId: '57', orbitalPlane: '4' },
    '140': { svId: '39', orbitalPlane: '1' },
    '141': { svId: '51', orbitalPlane: '2' },
    '142': { svId: '82', orbitalPlane: '1' },
    '143': { svId: '43', orbitalPlane: '1' },
    '144': { svId: '74', orbitalPlane: '1' },
    '145': { svId: '7', orbitalPlane: '1' },
    '146': { svId: '24', orbitalPlane: '1' },
    '147': { svId: '5', orbitalPlane: '6' },
    '148': { svId: '77', orbitalPlane: '1' },
    '149': { svId: '30', orbitalPlane: '1' },
    '150': { svId: '40', orbitalPlane: '1' },
    '151': { svId: '111', orbitalPlane: '2' },
    '152': { svId: '22', orbitalPlane: '6' },
    '153': { svId: '8', orbitalPlane: '1' },
    '154': { svId: '94', orbitalPlane: '5' },
    '155': { svId: '25', orbitalPlane: '5' },
    '156': { svId: '46', orbitalPlane: '5' },
    '157': { svId: '6', orbitalPlane: '1' },
    '158': { svId: '18', orbitalPlane: '5' },
    '159': { svId: '49', orbitalPlane: '5' },
    '160': { svId: '90', orbitalPlane: '5' },
    '161': { svId: null, orbitalPlane: '6', isSpare: true },
    '162': { svId: null, orbitalPlane: '6', isSpare: true },
    '163': { svId: '3', orbitalPlane: '5' },
    '164': { svId: '13', orbitalPlane: '5' },
    '165': { svId: '23', orbitalPlane: '5' },
    '166': { svId: '96', orbitalPlane: '5' },
    '167': { svId: '67', orbitalPlane: '3' },
    '168': { svId: '68', orbitalPlane: '3' },
    '169': { svId: null, orbitalPlane: '4', isSpare: true },
    '170': { svId: null, orbitalPlane: '3', isSpare: true },
    '171': { svId: '81', orbitalPlane: '3' },
    '172': { svId: '72', orbitalPlane: '3' },
    '173': { svId: '65', orbitalPlane: '3' },
    '175': { svId: null, orbitalPlane: '3', isSpare: true },
    '176': { svId: null, orbitalPlane: '3', isSpare: true },
    '180': { svId: '50', orbitalPlane: '3' }
};

const TLE_CACHE_KEY = 'iridium_tle_data';
const TLE_CACHE_TIME_KEY = 'iridium_tle_time';
const TLE_CACHE_AGE_MS = 8 * 60 * 60 * 1000; // 8 hours
const TLE_BACKGROUND_REFRESH_AGE_MS = 60 * 60 * 1000; // 1 hour
const TLE_FETCH_TIMEOUT_MS = 15000;
const TLE_SOURCE_URL = 'https://celestrak.org/NORAD/elements/gp.php?GROUP=iridium-NEXT&FORMAT=tle';
const TIMELINE_STEP_SECONDS = 60;
const TIMELINE_STEP_MS = TIMELINE_STEP_SECONDS * 1000;
const TIMELINE_PAST_STEPS = 14 * 24 * 60;
const TIMELINE_FUTURE_STEPS = 7 * 24 * 60;
const PLAYBACK_TICK_MS = 1000;
const PLAYBACK_ADVANCE_MS = 1000;
const MAX_COVERAGE_DISTANCE_M = 2400000;
const TERRAIN_CACHE_KEY_PREFIX = 'terrain_horizon_profile:';
const TERRAIN_CACHE_AGE_MS = 30 * 24 * 60 * 60 * 1000;
const TERRAIN_AZIMUTH_STEP_DEG = 10;
const TERRAIN_SAMPLE_COUNT = 20;
const TERRAIN_MAX_DISTANCE_M = 80000;
const TERRAIN_MASK_RADIUS_M = 200000;
const TERRAIN_CHUNK_SIZE = 100;
const TERRAIN_MIN_MASK_ELEVATION_DEG = 5;
const TERRAIN_LOCATION_GRID_DEG = 0.02;
const TERRAIN_REFRESH_DEBOUNCE_MS = 250;
const TERRAIN_REQUEST_SPACING_MS = 175;
const TERRAIN_DEFAULT_RETRY_AFTER_MS = 60000;
const USER_ANTENNA_HEIGHT_M = 5;
const EARTH_RADIUS_M = 6371000;
const OPEN_METEO_ELEVATION_URL = 'https://api.open-meteo.com/v1/elevation';

const TERRAIN_STATUS = {
    idle: 'idle',
    loading: 'loading',
    ready: 'ready',
    error: 'error'
};

function wrapLongitude(lon) {
    while (lon < -180) lon += 360;
    while (lon > 180) lon -= 360;
    return lon;
}

// Wrap longitude so that marker is always nearest to the given centerLon
function wrapToCenter(lon, centerLon) {
    while (lon - centerLon > 180) lon -= 360;
    while (lon - centerLon < -180) lon += 360;
    return lon;
}

function degToRad(value) {
    return value * Math.PI / 180;
}

function radToDeg(value) {
    return value * 180 / Math.PI;
}

function normalizeAzimuth(value) {
    return ((value % 360) + 360) % 360;
}

function formatDegrees(value, digits = 1) {
    return `${value.toFixed(digits)} deg`;
}

function quantizeCoordinate(value, step) {
    return Math.round(value / step) * step;
}

function buildTerrainLocationKey(location) {
    const quantizedLatitude = quantizeCoordinate(location.latitude, TERRAIN_LOCATION_GRID_DEG);
    const quantizedLongitude = quantizeCoordinate(location.longitude, TERRAIN_LOCATION_GRID_DEG);
    return `${quantizedLatitude.toFixed(2)},${quantizedLongitude.toFixed(2)}`;
}

function chunkArray(values, chunkSize) {
    const chunks = [];
    for (let index = 0; index < values.length; index += chunkSize) {
        chunks.push(values.slice(index, index + chunkSize));
    }
    return chunks;
}

function destinationPoint(latitude, longitude, azimuthDeg, distanceM) {
    const angularDistance = distanceM / EARTH_RADIUS_M;
    const bearing = degToRad(azimuthDeg);
    const startLat = degToRad(latitude);
    const startLon = degToRad(longitude);
    const sinStartLat = Math.sin(startLat);
    const cosStartLat = Math.cos(startLat);
    const sinAngularDistance = Math.sin(angularDistance);
    const cosAngularDistance = Math.cos(angularDistance);

    const lat = Math.asin(
        (sinStartLat * cosAngularDistance) +
        (cosStartLat * sinAngularDistance * Math.cos(bearing))
    );
    const lon = startLon + Math.atan2(
        Math.sin(bearing) * sinAngularDistance * cosStartLat,
        cosAngularDistance - (sinStartLat * Math.sin(lat))
    );

    return {
        latitude: radToDeg(lat),
        longitude: wrapLongitude(radToDeg(lon))
    };
}

function computeGreatCircleDistanceMeters(lat1, lon1, lat2, lon2) {
    const deltaLat = degToRad(lat2 - lat1);
    const deltaLon = degToRad(lon2 - lon1);
    const startLat = degToRad(lat1);
    const endLat = degToRad(lat2);
    const a = (
        Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
        Math.cos(startLat) * Math.cos(endLat) *
        Math.sin(deltaLon / 2) * Math.sin(deltaLon / 2)
    );

    return 2 * EARTH_RADIUS_M * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function delay(ms) {
    return new Promise(resolve => {
        setTimeout(resolve, ms);
    });
}

function initMap() {
    map = L.map('map', {
        center: [0, 0],
        zoom: 2,
        minZoom: 2,
        worldCopyJump: true  // Infinite horizontal panning
        // No maxBounds!
    });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
    }).addTo(map);
    terrainMaskLayer = L.layerGroup().addTo(map);

    map.on('click', (e) => {
        const location = {
            latitude: e.latlng.lat,
            longitude: e.latlng.lng
        };
        placeUserMarker(location);
        deselectSatellite();
    });

    document.getElementById('current-location-btn').addEventListener('click', useCurrentLocation);
    document.getElementById('toggle-coverage-checkbox').addEventListener('change', updateCoverageLines);
    document.getElementById('toggle-spares-checkbox').addEventListener('change', updateSatellitePositions);
    document.getElementById('toggle-coverage-circles-checkbox').addEventListener('change', updateSatellitePositions);
    document.getElementById('toggle-sv-id-checkbox').addEventListener('change', updateSatelliteMarkerIcons);
    document.getElementById('toggle-terrain-mask-checkbox').addEventListener('change', () => {
        renderTerrainMask();
        updateCoverageLines();
        if (selectedSatellite) displaySatelliteInfo(selectedSatellite);
    });
    initTimelineControls();
    updateTerrainStatus();

    // When map pans or zooms, reposition markers using current map center
    map.on('moveend', () => {
        updateUserMarker();
        renderTerrainMask();
        updateSatellitePositions();
    });


    loadSatellites();

    const savedLocation = localStorage.getItem('userLocation');
    if (savedLocation) {
        const userLoc = JSON.parse(savedLocation);
        map.setView([userLoc.latitude, userLoc.longitude], 6);
        placeUserMarker(userLoc);
    }
}
window.onload = initMap;

function initTimelineControls() {
    const timeSlider = document.getElementById('time-slider');
    const utcDateInput = document.getElementById('utc-date-input');
    const utcTimeInput = document.getElementById('utc-time-input');
    const playbackToggleButton = document.getElementById('playback-toggle-btn');
    const liveTimeButton = document.getElementById('live-time-btn');

    timeSlider.min = -TIMELINE_PAST_STEPS;
    timeSlider.max = TIMELINE_FUTURE_STEPS;
    timeSlider.step = 1;
    timeSlider.value = '0';

    timeSlider.addEventListener('input', (event) => {
        const nextStep = parseInt(event.target.value, 10) || 0;
        if (nextStep === 0) {
            returnToLive();
            return;
        }

        if (isLiveMode) {
            timelineBaseTime = Date.now();
        }

        stopTimelinePlayback();
        selectedTimelineStep = nextStep;
        isLiveMode = false;
        selectedTimestamp = clampTimestampToTimeline(
            timelineBaseTime + (selectedTimelineStep * TIMELINE_STEP_MS),
            timelineBaseTime
        );
        updateTimelineReadout();
        updateSatellitePositions();
    });

    const handleUtcInputChange = () => {
        const parsedDate = parseUtcInputDateTime(utcDateInput.value, utcTimeInput.value);
        if (!parsedDate) {
            return;
        }

        timelineBaseTime = Date.now();
        selectedTimestamp = clampTimestampToTimeline(parsedDate.getTime(), timelineBaseTime);
        selectedTimelineStep = Math.round((selectedTimestamp - timelineBaseTime) / TIMELINE_STEP_MS);
        selectedTimelineStep = Math.min(TIMELINE_FUTURE_STEPS, Math.max(-TIMELINE_PAST_STEPS, selectedTimelineStep));
        stopTimelinePlayback();
        isLiveMode = false;

        timeSlider.value = selectedTimelineStep.toString();
        updateTimelineReadout();
        updateSatellitePositions();
    };

    utcDateInput.addEventListener('change', handleUtcInputChange);
    utcTimeInput.addEventListener('change', handleUtcInputChange);

    playbackToggleButton.addEventListener('click', () => {
        toggleTimelinePlayback();
    });

    liveTimeButton.addEventListener('click', () => {
        returnToLive();
    });

    updateTimelineReadout();
}

function getSelectedDate() {
    if (isLiveMode) {
        return new Date();
    }
    return new Date(selectedTimestamp ?? (timelineBaseTime + (selectedTimelineStep * TIMELINE_STEP_MS)));
}

function getTimelineBounds(referenceTime = Date.now()) {
    return {
        min: referenceTime - (TIMELINE_PAST_STEPS * TIMELINE_STEP_MS),
        max: referenceTime + (TIMELINE_FUTURE_STEPS * TIMELINE_STEP_MS)
    };
}

function clampTimestampToTimeline(timestamp, referenceTime = Date.now()) {
    const bounds = getTimelineBounds(referenceTime);
    return Math.min(bounds.max, Math.max(bounds.min, timestamp));
}

function parseUtcInputDateTime(dateValue, timeValue) {
    if (!dateValue || !timeValue) {
        return null;
    }

    const dateParts = dateValue.split('-').map(Number);
    const timeParts = timeValue.split(':').map(Number);

    if (dateParts.length !== 3 || timeParts.length < 2) {
        return null;
    }

    const [year, month, day] = dateParts;
    const [hours, minutes, seconds = 0] = timeParts;
    const utcTimestamp = Date.UTC(year, month - 1, day, hours, minutes, seconds);

    if (Number.isNaN(utcTimestamp)) {
        return null;
    }

    return new Date(utcTimestamp);
}

function formatUtcDateValue(date) {
    return [
        date.getUTCFullYear(),
        String(date.getUTCMonth() + 1).padStart(2, '0'),
        String(date.getUTCDate()).padStart(2, '0')
    ].join('-');
}

function formatUtcTimeValue(date) {
    return [
        String(date.getUTCHours()).padStart(2, '0'),
        String(date.getUTCMinutes()).padStart(2, '0'),
        String(date.getUTCSeconds()).padStart(2, '0')
    ].join(':');
}

function formatUtcDateTime(date) {
    return new Intl.DateTimeFormat(undefined, {
        timeZone: 'UTC',
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
    }).format(date);
}

function syncTimelineInputs(selectedDate) {
    const utcDateInput = document.getElementById('utc-date-input');
    const utcTimeInput = document.getElementById('utc-time-input');

    utcDateInput.value = formatUtcDateValue(selectedDate);
    utcTimeInput.value = formatUtcTimeValue(selectedDate);
}

function syncTimelineSlider() {
    const sliderStep = Math.round((getSelectedDate().getTime() - timelineBaseTime) / TIMELINE_STEP_MS);
    selectedTimelineStep = Math.min(TIMELINE_FUTURE_STEPS, Math.max(-TIMELINE_PAST_STEPS, sliderStep));
    document.getElementById('time-slider').value = selectedTimelineStep.toString();
}

function updatePlaybackControls() {
    const playbackToggleButton = document.getElementById('playback-toggle-btn');
    const atPlaybackLimit = !isLiveMode && getSelectedDate().getTime() >= getTimelineBounds(timelineBaseTime).max;

    playbackToggleButton.textContent = timelinePlaybackTimer ? 'Pause' : 'Play';
    playbackToggleButton.disabled = isLiveMode || atPlaybackLimit;
}

function stopTimelinePlayback() {
    if (!timelinePlaybackTimer) {
        updatePlaybackControls();
        return;
    }

    clearInterval(timelinePlaybackTimer);
    timelinePlaybackTimer = null;
    updatePlaybackControls();
}

function stepTimelinePlayback() {
    if (isLiveMode) {
        stopTimelinePlayback();
        return;
    }

    const currentTimestamp = getSelectedDate().getTime();
    const nextTimestamp = clampTimestampToTimeline(currentTimestamp + PLAYBACK_ADVANCE_MS, timelineBaseTime);
    const didAdvance = nextTimestamp !== currentTimestamp;

    selectedTimestamp = nextTimestamp;
    syncTimelineSlider();
    updateSatellitePositions();

    if (!didAdvance || nextTimestamp >= getTimelineBounds(timelineBaseTime).max) {
        stopTimelinePlayback();
    }
}

function startTimelinePlayback() {
    if (isLiveMode || timelinePlaybackTimer || selectedTimelineStep >= TIMELINE_FUTURE_STEPS) {
        updatePlaybackControls();
        return;
    }

    timelinePlaybackTimer = setInterval(() => {
        stepTimelinePlayback();
    }, PLAYBACK_TICK_MS);
    updatePlaybackControls();
}

function toggleTimelinePlayback() {
    if (timelinePlaybackTimer) {
        stopTimelinePlayback();
        return;
    }

    startTimelinePlayback();
}

function returnToLive() {
    stopTimelinePlayback();
    timelineBaseTime = Date.now();
    selectedTimelineStep = 0;
    selectedTimestamp = null;
    isLiveMode = true;
    document.getElementById('time-slider').value = '0';
    updateTimelineReadout();
    updateSatellitePositions();
}

function formatTimelineOffset(offsetMs) {
    if (Math.abs(offsetMs) < 1000) {
        return 'Live';
    }

    let remainingSeconds = Math.round(Math.abs(offsetMs) / 1000);
    const days = Math.floor(remainingSeconds / 86400);
    remainingSeconds -= days * 86400;
    const hours = Math.floor(remainingSeconds / 3600);
    remainingSeconds -= hours * 3600;
    const minutes = Math.floor(remainingSeconds / 60);
    remainingSeconds -= minutes * 60;
    const parts = [];

    if (days) parts.push(`${days}d`);
    if (hours) parts.push(`${hours}h`);
    if (minutes) parts.push(`${minutes}m`);
    if (remainingSeconds || parts.length === 0) parts.push(`${remainingSeconds}s`);

    return `${parts.join(' ')} ${offsetMs < 0 ? 'before' : 'after'} live`;
}

function updateTimelineReadout() {
    const timelineReadout = document.getElementById('timeline-readout');
    const liveTimeButton = document.getElementById('live-time-btn');
    const selectedDate = getSelectedDate();
    const offsetMs = selectedDate.getTime() - timelineBaseTime;

    syncTimelineInputs(selectedDate);
    timelineReadout.textContent = isLiveMode
        ? `Live UTC - ${formatUtcDateTime(selectedDate)} UTC`
        : `${formatUtcDateTime(selectedDate)} UTC (${formatTimelineOffset(offsetMs)})`;

    liveTimeButton.disabled = isLiveMode;
    updatePlaybackControls();
}

function scheduleSatelliteRefresh() {
    if (satelliteRefreshTimer) {
        clearTimeout(satelliteRefreshTimer);
    }

    if (!isLiveMode) {
        satelliteRefreshTimer = null;
        return;
    }

    satelliteRefreshTimer = setTimeout(updateSatellitePositions, 1000);
}

function scheduleTerrainProfileRefresh(force = false) {
    if (terrainRefreshDebounceTimer) {
        clearTimeout(terrainRefreshDebounceTimer);
    }

    terrainRefreshDebounceTimer = setTimeout(() => {
        terrainRefreshDebounceTimer = null;
        refreshTerrainProfile(force);
    }, TERRAIN_REFRESH_DEBOUNCE_MS);
}

function getTerrainCacheStorageKey(locationKey) {
    return `${TERRAIN_CACHE_KEY_PREFIX}${locationKey}`;
}

function loadTerrainProfileFromCache(locationKey) {
    try {
        const cached = localStorage.getItem(getTerrainCacheStorageKey(locationKey));
        if (!cached) {
            return null;
        }

        const parsed = JSON.parse(cached);
        if (!parsed.cachedAt || (Date.now() - parsed.cachedAt > TERRAIN_CACHE_AGE_MS)) {
            localStorage.removeItem(getTerrainCacheStorageKey(locationKey));
            return null;
        }

        return parsed.profile || null;
    } catch (error) {
        console.warn('Ignoring invalid terrain cache entry:', error);
        return null;
    }
}

function saveTerrainProfileToCache(locationKey, profile) {
    try {
        localStorage.setItem(
            getTerrainCacheStorageKey(locationKey),
            JSON.stringify({
                cachedAt: Date.now(),
                profile
            })
        );
    } catch (error) {
        console.warn('Failed to cache terrain profile:', error);
    }
}

function updateTerrainStatus() {
    const terrainStatusElement = document.getElementById('terrain-status');
    if (!terrainStatusElement) {
        return;
    }

    terrainStatusElement.dataset.state = terrainProfile.status;

    if (!userLocation) {
        terrainStatusElement.textContent = 'Terrain LOS: place a point on the map to sample the local horizon.';
        return;
    }

    if (terrainProfile.status === TERRAIN_STATUS.loading) {
        terrainStatusElement.textContent = 'Terrain LOS: sampling elevation data around the selected point...';
        return;
    }

    if (terrainProfile.status === TERRAIN_STATUS.ready) {
        terrainStatusElement.textContent =
            `Terrain LOS: ${terrainProfile.groundElevationM.toFixed(0)} m ASL, ` +
            `${terrainProfile.blockedSectorCount} blocked sectors from DEM horizon sampling.`;
        return;
    }

    if (terrainProfile.status === TERRAIN_STATUS.error) {
        terrainStatusElement.textContent =
            `Terrain LOS: terrain data unavailable (${terrainProfile.errorMessage}). Using geometric horizon only.`;
        return;
    }

    terrainStatusElement.textContent = 'Terrain LOS: waiting for the selected point.';
}

function isTerrainProfileReadyForUserLocation() {
    return Boolean(
        userLocation &&
        terrainProfile.status === TERRAIN_STATUS.ready &&
        terrainProfile.locationKey === buildTerrainLocationKey(userLocation)
    );
}

function getObserverTerrainHeightMeters() {
    if (!isTerrainProfileReadyForUserLocation()) {
        return USER_ANTENNA_HEIGHT_M;
    }

    return terrainProfile.groundElevationM + USER_ANTENNA_HEIGHT_M;
}

function getObserverLookAngleContext() {
    if (!userLocation) {
        return null;
    }

    return {
        geodetic: {
            latitude: degToRad(userLocation.latitude),
            longitude: degToRad(userLocation.longitude),
            height: getObserverTerrainHeightMeters() / 1000
        }
    };
}

function computeCurvatureDropMeters(distanceM) {
    return (distanceM * distanceM) / (2 * EARTH_RADIUS_M);
}

function buildTerrainSampleGrid(location) {
    const points = [{
        latitude: location.latitude,
        longitude: location.longitude
    }];
    const rays = [];
    const sampleStepDistanceM = TERRAIN_MAX_DISTANCE_M / TERRAIN_SAMPLE_COUNT;

    for (let azimuthDeg = 0; azimuthDeg < 360; azimuthDeg += TERRAIN_AZIMUTH_STEP_DEG) {
        const ray = {
            azimuthDeg,
            sampleDistancesM: []
        };

        for (let sampleIndex = 1; sampleIndex <= TERRAIN_SAMPLE_COUNT; sampleIndex += 1) {
            const distanceM = sampleIndex * sampleStepDistanceM;
            const point = destinationPoint(location.latitude, location.longitude, azimuthDeg, distanceM);

            points.push(point);
            ray.sampleDistancesM.push(distanceM);
        }

        rays.push(ray);
    }

    return { points, rays };
}

async function fetchElevationChunk(points) {
    const latitudes = points.map(point => point.latitude.toFixed(5)).join(',');
    const longitudes = points.map(point => point.longitude.toFixed(5)).join(',');
    const sourceUrl = `${OPEN_METEO_ELEVATION_URL}?latitude=${latitudes}&longitude=${longitudes}`;
    const response = await fetch(`https://corsproxy.io/?${encodeURIComponent(sourceUrl)}`);

    if (!response.ok) {
        const retryAfterHeader = response.headers.get('Retry-After');
        const retryAfterSeconds = retryAfterHeader ? parseInt(retryAfterHeader, 10) : NaN;
        const retryAfterMs = Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0
            ? retryAfterSeconds * 1000
            : TERRAIN_DEFAULT_RETRY_AFTER_MS;
        const error = new Error(`elevation request failed (${response.status})`);

        error.status = response.status;
        error.retryAfterMs = retryAfterMs;
        throw error;
    }

    const data = await response.json();
    if (!Array.isArray(data.elevation) || data.elevation.length !== points.length) {
        throw new Error('unexpected elevation response');
    }

    return data.elevation;
}

async function fetchElevationProfile(points) {
    const batches = chunkArray(points, TERRAIN_CHUNK_SIZE);
    const elevationChunks = [];

    for (let batchIndex = 0; batchIndex < batches.length; batchIndex += 1) {
        if (terrainRequestCooldownUntil > Date.now()) {
            const waitSeconds = Math.ceil((terrainRequestCooldownUntil - Date.now()) / 1000);
            const error = new Error(`rate limited, retry in ${waitSeconds}s`);

            error.status = 429;
            error.retryAfterMs = terrainRequestCooldownUntil - Date.now();
            throw error;
        }

        const elevationChunk = await fetchElevationChunk(batches[batchIndex]);
        elevationChunks.push(elevationChunk);

        if (batchIndex < batches.length - 1) {
            await delay(TERRAIN_REQUEST_SPACING_MS);
        }
    }

    return elevationChunks.flat();
}

function buildTerrainProfile(sampleGrid, elevations, locationKey) {
    const groundElevationM = Number.isFinite(elevations[0]) ? elevations[0] : 0;
    const observerElevationM = groundElevationM + USER_ANTENNA_HEIGHT_M;
    const horizonElevationsDeg = [];
    let blockedSectorCount = 0;
    let maxHorizonElevationDeg = 0;
    let cursor = 1;

    sampleGrid.rays.forEach(ray => {
        let rayHorizonElevationDeg = 0;

        ray.sampleDistancesM.forEach(distanceM => {
            const sampleElevationM = elevations[cursor];
            cursor += 1;

            if (!Number.isFinite(sampleElevationM)) {
                return;
            }

            const apparentElevationDeg = radToDeg(
                Math.atan2(
                    sampleElevationM - observerElevationM - computeCurvatureDropMeters(distanceM),
                    distanceM
                )
            );

            if (apparentElevationDeg > rayHorizonElevationDeg) {
                rayHorizonElevationDeg = apparentElevationDeg;
            }
        });

        const clampedHorizonElevationDeg = Math.max(0, rayHorizonElevationDeg);
        if (clampedHorizonElevationDeg >= TERRAIN_MIN_MASK_ELEVATION_DEG) {
            blockedSectorCount += 1;
        }

        maxHorizonElevationDeg = Math.max(maxHorizonElevationDeg, clampedHorizonElevationDeg);
        horizonElevationsDeg.push(clampedHorizonElevationDeg);
    });

    return {
        status: TERRAIN_STATUS.ready,
        locationKey,
        azimuthStepDeg: TERRAIN_AZIMUTH_STEP_DEG,
        maxDistanceM: TERRAIN_MAX_DISTANCE_M,
        groundElevationM,
        observerElevationM,
        horizonElevationsDeg,
        blockedSectorCount,
        maxHorizonElevationDeg,
        generatedAt: Date.now()
    };
}

async function computeTerrainProfileForLocation(location, locationKey) {
    const sampleGrid = buildTerrainSampleGrid(location);
    const elevations = await fetchElevationProfile(sampleGrid.points);
    return buildTerrainProfile(sampleGrid, elevations, locationKey);
}

async function refreshTerrainProfile(force = false) {
    if (!userLocation) {
        terrainProfile = {
            status: TERRAIN_STATUS.idle,
            locationKey: null
        };
        clearTerrainMask();
        updateTerrainStatus();
        return;
    }

    const locationKey = buildTerrainLocationKey(userLocation);
    if (!force) {
        const cachedProfile = loadTerrainProfileFromCache(locationKey);
        if (cachedProfile) {
            terrainProfile = cachedProfile;
            updateTerrainStatus();
            renderTerrainMask();
            updateCoverageLines();
            if (selectedSatellite) displaySatelliteInfo(selectedSatellite);
            return;
        }
    }

    if (terrainRequestCooldownUntil > Date.now()) {
        const waitSeconds = Math.ceil((terrainRequestCooldownUntil - Date.now()) / 1000);
        terrainProfile = {
            status: TERRAIN_STATUS.error,
            locationKey,
            errorMessage: `rate limit active, retry in ${waitSeconds}s`
        };
        updateTerrainStatus();
        clearTerrainMask();
        updateCoverageLines();
        if (selectedSatellite) displaySatelliteInfo(selectedSatellite);
        return;
    }

    const requestId = ++terrainAnalysisRequestId;
    terrainProfile = {
        status: TERRAIN_STATUS.loading,
        locationKey
    };
    updateTerrainStatus();
    clearTerrainMask();

    try {
        let pendingProfilePromise = terrainProfilePromiseCache.get(locationKey);
        if (!pendingProfilePromise) {
            pendingProfilePromise = computeTerrainProfileForLocation(userLocation, locationKey)
                .finally(() => {
                    terrainProfilePromiseCache.delete(locationKey);
                });
            terrainProfilePromiseCache.set(locationKey, pendingProfilePromise);
        }

        const profile = await pendingProfilePromise;
        if (requestId !== terrainAnalysisRequestId) {
            return;
        }

        terrainProfile = profile;
        saveTerrainProfileToCache(locationKey, profile);
    } catch (error) {
        if (requestId !== terrainAnalysisRequestId) {
            return;
        }

        if (error.status === 429) {
            terrainRequestCooldownUntil = Date.now() + (error.retryAfterMs || TERRAIN_DEFAULT_RETRY_AFTER_MS);
        }

        console.warn('Failed to compute terrain horizon profile:', error);
        terrainProfile = {
            status: TERRAIN_STATUS.error,
            locationKey,
            errorMessage: error.message || 'unknown error'
        };
    }

    updateTerrainStatus();
    renderTerrainMask();
    updateCoverageLines();
    if (selectedSatellite) displaySatelliteInfo(selectedSatellite);
}

function getTerrainHorizonElevationDeg(azimuthDeg) {
    if (!isTerrainProfileReadyForUserLocation() || !terrainProfile.horizonElevationsDeg.length) {
        return 0;
    }

    const wrappedAzimuthDeg = normalizeAzimuth(azimuthDeg);
    const scaledIndex = wrappedAzimuthDeg / terrainProfile.azimuthStepDeg;
    const lowerIndex = Math.floor(scaledIndex) % terrainProfile.horizonElevationsDeg.length;
    const upperIndex = (lowerIndex + 1) % terrainProfile.horizonElevationsDeg.length;
    const blend = scaledIndex - Math.floor(scaledIndex);

    return (
        terrainProfile.horizonElevationsDeg[lowerIndex] +
        (terrainProfile.horizonElevationsDeg[upperIndex] - terrainProfile.horizonElevationsDeg[lowerIndex]) * blend
    );
}

function clearTerrainMask() {
    if (terrainMaskLayer) {
        terrainMaskLayer.clearLayers();
    }
}

function buildTerrainSectorPolygon(location, startAzimuthDeg, endAzimuthDeg, radiusM, mapCenterLng) {
    const points = [[location.latitude, wrapToCenter(location.longitude, mapCenterLng)]];
    const arcStepCount = Math.max(2, Math.ceil((endAzimuthDeg - startAzimuthDeg) / 2));

    for (let stepIndex = 0; stepIndex <= arcStepCount; stepIndex += 1) {
        const azimuthDeg = startAzimuthDeg + ((endAzimuthDeg - startAzimuthDeg) * (stepIndex / arcStepCount));
        const point = destinationPoint(location.latitude, location.longitude, azimuthDeg, radiusM);
        points.push([point.latitude, wrapToCenter(point.longitude, mapCenterLng)]);
    }

    return points;
}

function renderTerrainMask() {
    clearTerrainMask();

    if (
        !terrainMaskLayer ||
        !userLocation ||
        !document.getElementById('toggle-terrain-mask-checkbox').checked ||
        !isTerrainProfileReadyForUserLocation()
    ) {
        return;
    }

    const mapCenterLng = map.getCenter().lng;
    const intensityScale = Math.max(terrainProfile.maxHorizonElevationDeg, 1);

    terrainProfile.horizonElevationsDeg.forEach((horizonElevationDeg, sectorIndex) => {
        if (horizonElevationDeg < TERRAIN_MIN_MASK_ELEVATION_DEG) {
            return;
        }

        const startAzimuthDeg = sectorIndex * terrainProfile.azimuthStepDeg;
        const endAzimuthDeg = startAzimuthDeg + terrainProfile.azimuthStepDeg;
        const polygon = buildTerrainSectorPolygon(
            userLocation,
            startAzimuthDeg,
            endAzimuthDeg,
            Math.min(terrainProfile.maxDistanceM, TERRAIN_MASK_RADIUS_M),
            mapCenterLng
        );
        const fillOpacity = 0.08 + Math.min(0.34, (horizonElevationDeg / intensityScale) * 0.34);

        L.polygon(polygon, {
            interactive: false,
            color: '#7f1d1d',
            weight: 1,
            opacity: 0.35,
            fillColor: '#b91c1c',
            fillOpacity
        }).addTo(terrainMaskLayer);
    });
}

function describeSatelliteVisibility(sat) {
    if (!sat.lookAngles) {
        return 'No observer point selected';
    }

    if (sat.lookAngles.elevationDeg <= 0) {
        return 'Below geometric horizon';
    }

    if (sat.lookAngles.terrainBlocked) {
        return 'Blocked by terrain';
    }

    if (isTerrainProfileReadyForUserLocation()) {
        return 'Line of sight clear';
    }

    return 'Geometric horizon clear';
}

function cacheTLEData(tleData, timestamp = Date.now()) {
    localStorage.setItem(TLE_CACHE_KEY, tleData);
    localStorage.setItem(TLE_CACHE_TIME_KEY, timestamp.toString());
}

async function fetchTLEFromSource() {
    const abortController = new AbortController();
    const timeoutId = setTimeout(() => {
        abortController.abort();
    }, TLE_FETCH_TIMEOUT_MS);

    try {
        const response = await fetch(TLE_SOURCE_URL, {
            signal: abortController.signal
        });

        if (!response.ok) {
            throw new Error(`Network response was not ok (${response.status} ${response.statusText})`);
        }

        const data = await response.text();
        if (!data || !data.includes('\n1 ') || !data.includes('\n2 ')) {
            throw new Error('TLE response format was invalid');
        }

        cacheTLEData(data);
        console.log('Fetched and cached new TLE data from CelesTrak.');
        return data;
    } finally {
        clearTimeout(timeoutId);
    }
}

async function fetchTLEData() {
    const cachedTLE = localStorage.getItem(TLE_CACHE_KEY);
    const cachedTime = parseInt(localStorage.getItem(TLE_CACHE_TIME_KEY) || '0', 10);
    const now = Date.now();
    const cacheAgeMs = now - cachedTime;

    try {
        if (cachedTLE && cacheAgeMs < TLE_BACKGROUND_REFRESH_AGE_MS) {
            console.log('Loaded TLE data from fresh cache.');
            return cachedTLE;
        }

        if (cachedTLE && cacheAgeMs < TLE_CACHE_AGE_MS) {
            if (!tleRefreshPromise) {
                tleRefreshPromise = fetchTLEFromSource()
                    .catch(error => {
                        console.warn('Background TLE refresh failed, keeping cached TLE data:', error);
                        return cachedTLE;
                    })
                    .finally(() => {
                        tleRefreshPromise = null;
                    });
            }

            console.log('Loaded TLE data from cache and started background refresh.');
            return cachedTLE;
        }

        return await fetchTLEFromSource();
    } catch (error) {
        if (cachedTLE) {
            console.warn('Error fetching TLE data, using possibly stale cache:', error);
            return cachedTLE;
        }
        console.error('Failed to fetch and no cache available:', error);
        alert('Error fetching TLE data and no cached copy available.');
        return null;
    }
}

function parseTLEData(tleData) {
    const lines = tleData.split('\n').filter(line => line.trim().length > 0);
    const satellites = [];
    for (let i = 0; i < lines.length; i += 3) {
        if (lines[i] && lines[i + 1] && lines[i + 2]) {
            let name = lines[i].trim();
            const tleLine1 = lines[i + 1].trim();
            const tleLine2 = lines[i + 2].trim();

            const satelliteNumberMatch = name.match(/IRIDIUM\s+(\d+)/i);
            const satelliteNumber = satelliteNumberMatch ? satelliteNumberMatch[1] : 'Unknown';
            name = satelliteNumberMatch ? `Iridium ${satelliteNumber}` : name;

            try {
                const satrec = satellite.twoline2satrec(tleLine1, tleLine2);
                satellites.push({
                    name,
                    number: satelliteNumber,
                    tleLine1,
                    tleLine2,
                    satrec,
                    marker: null,
                    circle: null,
                    prevPosition: null,
                    currentPosition: null,
                    geodeticPosition: null,
                    prevTimestamp: null,
                    currentTimestamp: null,
                    lookAngles: null
                });
            } catch (error) {
                console.error(`Error parsing TLE for ${name}:`, error);
            }
        }
    }
    return satellites;
}

async function loadSatellites() {
    const tleData = await fetchTLEData();
    if (!tleData) {
        console.error('No TLE data available. Satellites cannot be loaded.');
        return;
    }
    satelliteData = parseTLEData(tleData);
    if (satelliteData.length === 0) {
        console.error('No satellites were parsed. Check the TLE data format.');
        return;
    }
    updateSatellitePositions();
}

function removeSatelliteCoverageHighlight(sat) {
    if (sat.circle) {
        sat.circle.setStyle({
            fillColor: '#00FF00',
            color: '#AAAAAA',
            fillOpacity: 0.05,
            weight: 0.3
        });
    }
}

function highlightSatelliteCoverage(sat) {
    if (selectedSatellite && selectedSatellite !== sat) {
        removeSatelliteCoverageHighlight(selectedSatellite);
    }
    selectedSatellite = sat;
    if (sat.circle) {
        sat.circle.setStyle({
            fillColor: '#ADD8E6',
            color: '#0000FF',
            fillOpacity: 0.2,
            weight: 2
        });
    }
}

function deselectSatellite() {
    if (selectedSatellite) {
        removeSatelliteCoverageHighlight(selectedSatellite);
    }
    selectedSatellite = null;
    document.getElementById('satellite-info').innerHTML = '';
}

function updateSatellitePositions() {
    const showSpares = document.getElementById('toggle-spares-checkbox').checked;
    const showCoverageCircles = document.getElementById('toggle-coverage-circles-checkbox').checked;
    const selectedDate = getSelectedDate();
    const selectedTimestamp = selectedDate.getTime();
    const mapCenterLng = map.getCenter().lng;
    const observerLookAngleContext = getObserverLookAngleContext();

    satelliteData.forEach(sat => {
        sat.prevPosition = sat.currentPosition || null;
        sat.prevTimestamp = sat.currentTimestamp || selectedTimestamp;

        const pv = satellite.propagate(sat.satrec, selectedDate);
        if (!pv.position || !pv.velocity) {
            sat.lookAngles = null;
            return;
        }

        const gmst = satellite.gstime(selectedDate);
        const satelliteEcf = satellite.eciToEcf(pv.position, gmst);
        const posGd = satellite.eciToGeodetic(pv.position, gmst);

        const latitude = satellite.degreesLat(posGd.latitude);
        const geodeticLongitude = satellite.degreesLong(posGd.longitude);
        const longitude = wrapToCenter(geodeticLongitude, mapCenterLng);
        const altitude = posGd.height;

        const newPosition = { lat: latitude, lng: longitude };
        sat.currentPosition = newPosition;
        sat.geodeticPosition = { lat: latitude, lng: geodeticLongitude };
        sat.currentTimestamp = selectedTimestamp;
        sat.altitude = altitude;
        sat.velocity = Math.sqrt(
            pv.velocity.x * pv.velocity.x +
            pv.velocity.y * pv.velocity.y +
            pv.velocity.z * pv.velocity.z
        );

        if (observerLookAngleContext) {
            const lookAngles = satellite.ecfToLookAngles(observerLookAngleContext.geodetic, satelliteEcf);
            const azimuthDeg = normalizeAzimuth(radToDeg(lookAngles.azimuth));
            const elevationDeg = radToDeg(lookAngles.elevation);
            const horizonElevationDeg = getTerrainHorizonElevationDeg(azimuthDeg);
            const terrainBlocked = (
                isTerrainProfileReadyForUserLocation() &&
                elevationDeg > 0 &&
                elevationDeg <= horizonElevationDeg
            );

            sat.lookAngles = {
                azimuthDeg,
                elevationDeg,
                rangeKm: lookAngles.rangeSat,
                horizonElevationDeg,
                clearanceDeg: elevationDeg - horizonElevationDeg,
                terrainBlocked,
                visible: elevationDeg > 0 && !terrainBlocked
            };
        } else {
            sat.lookAngles = null;
        }

        const isSpare = spareSatelliteNumbers.includes(sat.number);
        const show = (!isSpare || (isSpare && showSpares));
        const showCircle = show && showCoverageCircles;

        // --- Marker
        if (!sat.marker) {
            const icon = L.icon({
                iconUrl: createSatelliteIcon(getSatelliteDisplayLabel(sat)),
                iconSize: [30, 30],
                iconAnchor: [15, 15],
                popupAnchor: [0, -10]
            });
            sat.marker = L.marker(newPosition, {
                icon: icon,
                title: sat.name,
                opacity: show ? 1 : 0
            }).addTo(map);

            sat.marker.on('click', () => {
                if (selectedSatellite === sat) {
                    deselectSatellite();
                } else {
                    highlightSatelliteCoverage(sat);
                    displaySatelliteInfo(sat);
                }
            });
        } else {
            sat.marker.setLatLng(newPosition);
            sat.marker.setOpacity(show ? 1 : 0);
        }

        // --- Coverage circle
        if (!sat.circle) {
            sat.circle = L.circle(newPosition, {
                radius: MAX_COVERAGE_DISTANCE_M,
                color: '#AAAAAA',
                weight: 0.3,
                fillColor: '#00FF00',
                fillOpacity: 0.05,
                interactive: false
            });
            if (showCircle) sat.circle.addTo(map);
        } else {
            sat.circle.setLatLng(newPosition);
            if (showCircle) {
                if (!map.hasLayer(sat.circle)) sat.circle.addTo(map);
            } else {
                if (map.hasLayer(sat.circle)) map.removeLayer(sat.circle);
            }
        }
    });

    updateTimelineReadout();
    if (userLocation) updateCoverageLines();
    if (selectedSatellite) displaySatelliteInfo(selectedSatellite);

    scheduleSatelliteRefresh();
}

function placeUserMarker(location) {
    userLocation = location;
    localStorage.setItem('userLocation', JSON.stringify(userLocation));
    updateUserMarker();
    scheduleTerrainProfileRefresh();
    updateCoverageLines();
}


function updateUserMarker() {
    if (!userLocation) return;
    const mapCenterLng = map.getCenter().lng;
    const wrappedLng = wrapToCenter(userLocation.longitude, mapCenterLng);
    const wrappedLocation = [userLocation.latitude, wrappedLng];

    if (userMarker) {
        userMarker.setLatLng(wrappedLocation);
    } else {
        userMarker = L.marker(wrappedLocation, {
            title: 'Your Location',
            icon: L.divIcon({
                className: '',
                html: `<svg width="16" height="16"><circle cx="8" cy="8" r="7" fill="#F00" stroke="#FFF" stroke-width="2"/></svg>`,
                iconSize: [16, 16],
                iconAnchor: [8, 8]
            })
        }).addTo(map);
    }
}


function updateCoverageLines() {
    const showCoverage = document.getElementById('toggle-coverage-checkbox').checked;
    coverageLines.forEach(line => map.removeLayer(line));
    coverageLines = [];
    document.getElementById('satellite-list').innerHTML = '';

    if (!userLocation || !showCoverage) return;

    const mapCenterLng = map.getCenter().lng;
    const wrappedUserLng = wrapToCenter(userLocation.longitude, mapCenterLng);
    const userLatLng = [userLocation.latitude, wrappedUserLng];
    const coverageEntries = [];

    satelliteData.forEach(sat => {
        if (spareSatelliteNumbers.includes(sat.number)) {
            if (!document.getElementById('toggle-spares-checkbox').checked) return;
        }

        if (!sat.currentPosition || !sat.geodeticPosition || !sat.lookAngles) {
            return;
        }

        const dist = computeGreatCircleDistanceMeters(
            userLocation.latitude,
            userLocation.longitude,
            sat.geodeticPosition.lat,
            sat.geodeticPosition.lng
        );

        if (dist > MAX_COVERAGE_DISTANCE_M || sat.lookAngles.elevationDeg <= 0) {
            return;
        }

        coverageEntries.push({
            sat,
            satLatLng: [sat.currentPosition.lat, sat.currentPosition.lng],
            elevationDeg: sat.lookAngles.elevationDeg,
            horizonElevationDeg: sat.lookAngles.horizonElevationDeg,
            terrainBlocked: sat.lookAngles.terrainBlocked
        });
    });

    coverageEntries.sort((left, right) => {
        if (left.terrainBlocked !== right.terrainBlocked) {
            return left.terrainBlocked ? 1 : -1;
        }
        return right.elevationDeg - left.elevationDeg;
    });

    coverageEntries.forEach(entry => {
        const line = L.polyline([entry.satLatLng, userLatLng], {
            color: entry.terrainBlocked ? '#b45309' : '#166534',
            weight: entry.terrainBlocked ? 2 : 3,
            opacity: entry.terrainBlocked ? 0.65 : 0.9,
            dashArray: entry.terrainBlocked ? '8 6' : null
        }).addTo(map);
        coverageLines.push(line);
    });

    updateSatelliteList(coverageEntries);
}


function createSatelliteListSection(title, entries, includeHorizon) {
    const section = document.createElement('div');
    section.className = 'satellite-section';

    const heading = document.createElement('h4');
    heading.textContent = title;
    section.appendChild(heading);

    const list = document.createElement('ul');
    entries.forEach(entry => {
        const li = document.createElement('li');
        li.textContent = includeHorizon
            ? `${entry.sat.name} (${formatDegrees(entry.elevationDeg)}, horizon ${formatDegrees(entry.horizonElevationDeg)})`
            : `${entry.sat.name} (${formatDegrees(entry.elevationDeg)})`;
        list.appendChild(li);
    });
    section.appendChild(list);

    return section;
}

function getSatelliteSvMapping(sat) {
    return IRIDIUM_SV_MAP[sat.number] || null;
}

function getSatelliteDisplayLabel(sat) {
    const mapping = getSatelliteSvMapping(sat);

    if (document.getElementById('toggle-sv-id-checkbox').checked) {
        return mapping && mapping.svId
            ? `${mapping.svId}`
            : sat.number;
    }

    return sat.number;
}

function updateSatelliteMarkerIcons() {
    satelliteData.forEach(sat => {
        if (!sat.marker) {
            return;
        }

        const icon = L.icon({
            iconUrl: createSatelliteIcon(getSatelliteDisplayLabel(sat)),
            iconSize: [30, 30],
            iconAnchor: [15, 15],
            popupAnchor: [0, -10]
        });

        sat.marker.setIcon(icon);
    });
}

function updateSatelliteList(coverageEntries) {
    const div = document.getElementById('satellite-list');
    div.innerHTML = '';

    if (coverageEntries.length === 0) {
        div.textContent = isTerrainProfileReadyForUserLocation()
            ? 'No satellites are visible inside the coverage footprint above the terrain mask.'
            : 'No satellites cover this location above the geometric horizon.';
        return;
    }

    const visibleEntries = coverageEntries.filter(entry => !entry.terrainBlocked);
    const blockedEntries = coverageEntries.filter(entry => entry.terrainBlocked);

    if (visibleEntries.length) {
        div.appendChild(createSatelliteListSection('Visible', visibleEntries, false));
    }

    if (blockedEntries.length) {
        div.appendChild(createSatelliteListSection('Terrain Blocked', blockedEntries, true));
    }
}

function displaySatelliteInfo(sat) {
    const div = document.getElementById('satellite-info');
    div.innerHTML = '';
    if (!sat.currentPosition || !sat.geodeticPosition) {
        div.textContent = 'Satellite position unavailable.';
        return;
    }
    const svMapping = getSatelliteSvMapping(sat);
    const title = document.createElement('h3');
    title.textContent = `${sat.name}`;
    div.appendChild(title);
    const infoList = document.createElement('ul');
    const shownAt = sat.currentTimestamp ? new Date(sat.currentTimestamp) : getSelectedDate();
    const infoItems = [
        { label: 'Latitude', value: `${sat.currentPosition.lat.toFixed(4)}°` },
        { label: 'Longitude', value: `${sat.currentPosition.lng.toFixed(4)}°` },
        { label: 'Altitude', value: `${sat.altitude.toFixed(2)} km` },
        { label: 'Velocity', value: `${(sat.velocity * 3600).toFixed(2)} km/h` },
        { label: 'Satellite Number', value: sat.number },
        { label: 'SV ID', value: svMapping && svMapping.svId ? svMapping.svId : 'Spare / Unassigned' },
        { label: 'Orbital Plane', value: svMapping && svMapping.orbitalPlane ? svMapping.orbitalPlane : 'Unknown' },
        {
            label: 'Shown At (UTC)',
            value: `${formatUtcDateTime(shownAt)} UTC`
        }
    ];

    infoItems[0].value = formatDegrees(sat.geodeticPosition.lat, 4);
    infoItems[1].value = formatDegrees(sat.geodeticPosition.lng, 4);

    if (sat.lookAngles) {
        infoItems.push(
            { label: 'Azimuth', value: formatDegrees(sat.lookAngles.azimuthDeg, 1) },
            { label: 'Elevation', value: formatDegrees(sat.lookAngles.elevationDeg, 1) },
            { label: 'Range', value: `${sat.lookAngles.rangeKm.toFixed(0)} km` },
            { label: 'Visibility', value: describeSatelliteVisibility(sat) }
        );

        if (isTerrainProfileReadyForUserLocation()) {
            infoItems.push(
                { label: 'Terrain Horizon', value: formatDegrees(sat.lookAngles.horizonElevationDeg, 1) },
                { label: 'LOS Clearance', value: formatDegrees(sat.lookAngles.clearanceDeg, 1) }
            );
        }
    }

    infoItems.forEach(item => {
        const li = document.createElement('li');
        li.textContent = `${item.label}: ${item.value}`;
        infoList.appendChild(li);
    });
    div.appendChild(infoList);
}

function useCurrentLocation() {
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(pos => {
            const userLoc = {
                latitude: pos.coords.latitude,
                longitude: pos.coords.longitude
            };
            map.setView([userLoc.latitude, userLoc.longitude], 6);
            placeUserMarker(userLoc);
        }, () => {
            alert('Unable to retrieve your location.');
        });
    } else {
        alert('Geolocation not supported.');
    }
}

function createSatelliteIcon(satelliteNumber) {
    const svgContent = `
    <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40">
        <circle cx="20" cy="20" r="18" fill="#0000FF" fill-opacity="0.7" />
        <text x="20" y="25" font-size="18" fill="#FFF" text-anchor="middle" font-weight="bold">${satelliteNumber}</text>
    </svg>`;
    return "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(svgContent);
}
