let map;
let satelliteData = [];
let userMarker = null;
let userLocation = null;
let coverageLines = [];
let selectedSatellite = null;

const spareSatelliteNumbers = [
    '162', '161', '169', '170', '176', '124', '175', '115', '105',
    '178', '179', '177', '174'
];

const TLE_CACHE_KEY = 'iridium_tle_data';
const TLE_CACHE_TIME_KEY = 'iridium_tle_time';
const TLE_CACHE_AGE_MS = 8 * 60 * 60 * 1000; // 8 hours

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

    // When map pans or zooms, reposition markers using current map center
    map.on('moveend', () => {
        updateUserMarker();
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

async function fetchTLEData() {
    try {
        const cachedTLE = localStorage.getItem(TLE_CACHE_KEY);
        const cachedTime = parseInt(localStorage.getItem(TLE_CACHE_TIME_KEY) || "0", 10);
        const now = Date.now();
        if (cachedTLE && (now - cachedTime < TLE_CACHE_AGE_MS)) {
            console.log("Loaded TLE data from cache.");
            return cachedTLE;
        }
        const response = await fetch(
            'https://corsproxy.io/?https://celestrak.org/NORAD/elements/gp.php?GROUP=iridium-NEXT&FORMAT=tle'
        );
        if (!response.ok) throw new Error(`Network response was not ok (${response.statusText})`);
        const data = await response.text();
        localStorage.setItem(TLE_CACHE_KEY, data);
        localStorage.setItem(TLE_CACHE_TIME_KEY, now.toString());
        console.log('Fetched and cached new TLE data.');
        return data;
    } catch (error) {
        const cachedTLE = localStorage.getItem(TLE_CACHE_KEY);
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
                    prevTimestamp: null,
                    currentTimestamp: null
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
    const now = Date.now();
    const showSpares = document.getElementById('toggle-spares-checkbox').checked;
    const showCoverageCircles = document.getElementById('toggle-coverage-circles-checkbox').checked;

    const mapCenterLng = map.getCenter().lng;

    satelliteData.forEach(sat => {
        sat.prevPosition = sat.currentPosition || null;
        sat.prevTimestamp = sat.currentTimestamp || now;

        const date = new Date();
        const pv = satellite.propagate(sat.satrec, date);
        if (!pv.position || !pv.velocity) return;

        const gmst = satellite.gstime(date);
        const posGd = satellite.eciToGeodetic(pv.position, gmst);

        const latitude = satellite.degreesLat(posGd.latitude);
        let longitude = satellite.degreesLong(posGd.longitude);
        longitude = wrapToCenter(longitude, mapCenterLng);
        const altitude = posGd.height;

        const newPosition = { lat: latitude, lng: longitude };
        sat.currentPosition = newPosition;
        sat.currentTimestamp = now + 3600;
        sat.altitude = altitude;
        sat.velocity = Math.sqrt(
            pv.velocity.x * pv.velocity.x +
            pv.velocity.y * pv.velocity.y +
            pv.velocity.z * pv.velocity.z
        );

        const isSpare = spareSatelliteNumbers.includes(sat.number);
        const show = (!isSpare || (isSpare && showSpares));
        const showCircle = show && showCoverageCircles;

        // --- Marker
        if (!sat.marker) {
            const icon = L.icon({
                iconUrl: createSatelliteIcon(sat.number),
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
                radius: 2400000,
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

    if (userLocation) updateCoverageLines();

    setTimeout(updateSatellitePositions, 1000);
}

function placeUserMarker(location) {
    userLocation = location;
    localStorage.setItem('userLocation', JSON.stringify(userLocation));
    updateUserMarker();
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


    // Use a Map to deduplicate satellites by sat.number
    const coveringSatMap = new Map();

    satelliteData.forEach(sat => {
        if (spareSatelliteNumbers.includes(sat.number)) {
            if (!document.getElementById('toggle-spares-checkbox').checked) return;
        }
        if (sat.currentPosition) {
            const satLatLng = [sat.currentPosition.lat, sat.currentPosition.lng];
            const dist = map.distance(userLatLng, satLatLng);
            if (dist <= 2400000) {
                coveringSatMap.set(sat.number, {sat, satLatLng});
            }
        }
    });

    // Draw coverage lines to unique sats
    coveringSatMap.forEach(({sat, satLatLng}) => {
        const line = L.polyline([satLatLng, userLatLng], {
            color: '#FF0000',
            weight: 2,
            opacity: 1
        }).addTo(map);
        coverageLines.push(line);
    });

    // Only show each satellite once in the list
    updateSatelliteList(Array.from(coveringSatMap.values()).map(entry => entry.sat));
}


function updateSatelliteList(coveringSatellites) {
    const div = document.getElementById('satellite-list');
    div.innerHTML = '';
    if (coveringSatellites.length > 0) {
        const list = document.createElement('ul');
        coveringSatellites.forEach(sat => {
            const li = document.createElement('li');
            li.textContent = sat.name;
            list.appendChild(li);
        });
        div.appendChild(list);
    } else {
        div.textContent = 'No satellites cover this location.';
    }
}

function displaySatelliteInfo(sat) {
    const div = document.getElementById('satellite-info');
    div.innerHTML = '';
    const title = document.createElement('h3');
    title.textContent = `${sat.name}`;
    div.appendChild(title);
    const infoList = document.createElement('ul');
    [
        { label: 'Latitude', value: `${sat.currentPosition.lat.toFixed(4)}°` },
        { label: 'Longitude', value: `${sat.currentPosition.lng.toFixed(4)}°` },
        { label: 'Altitude', value: `${sat.altitude.toFixed(2)} km` },
        { label: 'Velocity', value: `${(sat.velocity * 3600).toFixed(2)} km/h` },
        { label: 'Satellite Number', value: sat.number }
    ].forEach(item => {
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
