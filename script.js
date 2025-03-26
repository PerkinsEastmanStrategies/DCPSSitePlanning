// Include the required libraries in your HTML file: 
// Mapbox GL JS, Turf.js, SunCalc

mapboxgl.accessToken = 'pk.eyJ1IjoicGF0d2QwNSIsImEiOiJjbTZ2bGVhajIwMTlvMnFwc2owa3BxZHRoIn0.moDNfqMUolnHphdwsIF87w';

const map = new mapboxgl.Map({
    container: 'map',
    style: 'mapbox://styles/mapbox/satellite-v9',
    center: [-77.0369, 38.9072],
    zoom: 12
});

let draw = new MapboxDraw({
    displayControlsDefault: false,
    controls: {},
    defaultMode: 'simple_select'
});
map.addControl(draw);

let buildings = [];
let playAreas = [];
let sunCalcEnabled = false;
let drawingBuilding = false;
let parkingAreas = [];
let drawingParking = false; 
let drawingplayspace = false; // New flag for parking mode
let selectedSchoolType = 'ES';
const sqftPerStudent = { ES: 150, MS: 170, HS: 190 };

function updateTargetSqFt() {
    const enrollment = parseInt(document.getElementById('targetEnrollment').value) || 0;
    const targetSqFt = enrollment * sqftPerStudent[selectedSchoolType];

    let targetSqFtElement = document.getElementById('targetSqFt');
    if (targetSqFtElement) {
        targetSqFtElement.textContent = targetSqFt.toLocaleString(); // Display correctly
    } else {
        console.error("Element with id 'targetSqFt' not found.");
    }
}





document.getElementById('targetEnrollment').addEventListener('input', updateTargetSqFt);

function updateTargetSqFt() {
    const enrollment = parseInt(document.getElementById('targetEnrollment').value) || 0;
    const targetSqFt = enrollment * sqftPerStudent[selectedSchoolType];
    document.getElementById('targetSqFt').textContent = targetSqFt.toLocaleString(); // Format number
}

document.getElementById('floorInput').addEventListener('input', updateBuildings);
document.getElementById('targetEnrollment').addEventListener('input', updateBuildings);

function selectSchoolType(type) {
    selectedSchoolType = type;
    updateTargetSqFt(); // Updates the target sqft when changing selection

    console.log("Selected type:", type); // Debugging: Check if function runs

    // Remove "selected-button" class from all school type buttons
    document.querySelectorAll('.school-button').forEach(button => {
        button.classList.remove('selected-button');
    });

    // Add "selected-button" class to the clicked button
    let selectedButton = document.getElementById(type + "Button");

    if (selectedButton) {
        selectedButton.classList.add('selected-button');
        console.log("Class added to:", selectedButton.id); // Debugging
    } else {
        console.error("Button not found:", type + "Button"); // Debugging
    }
}
 // ✅ Add Map Controls
 map.addControl(new mapboxgl.NavigationControl(), 'top-right');
 map.addControl(new mapboxgl.FullscreenControl());
 map.addControl(new mapboxgl.GeolocateControl({
     positionOptions: { enableHighAccuracy: true },
     trackUserLocation: true,
     showUserHeading: true
 }));
 
function startBuildingDraw() {
    resetButtonSelection();
    document.getElementById('BuildingButton').classList.add('selected-button');
    drawingBuilding = true;
    draw.changeMode('draw_polygon');
}

function startPlaySpaceDraw() {
    resetButtonSelection();
    document.getElementById('playSpaceButton').classList.add('selected-button');
    drawingPlaySpace = true;
    draw.changeMode('draw_polygon');
}

function startParkingDraw() {
    resetButtonSelection();
    document.getElementById('ParkingButton').classList.add('selected-button');
    drawingParking = true;
    draw.changeMode('draw_polygon');
}

function resetButtonSelection() {
    document.querySelectorAll('.draw-button').forEach(button => {
        button.classList.remove('selected-button');
    });
}



function calculateSunExposure() {
    if (buildings.length === 0) return;

    let exposureData = [];
    let table = document.getElementById('sunExposureTable');

    // If the table doesn't exist yet, create it
    if (!table) {
        table = document.createElement('table');
        table.id = 'sunExposureTable';
        table.style.marginTop = '10px';

        let headerRow = document.createElement('tr');
        headerRow.innerHTML = `
            <th>Wall Direction</th>
            <th>Direct Sun (hrs)</th>
            <th>Indirect Sun (hrs)</th>
            <th>Shaded (hrs)</th>
        `;
        table.appendChild(headerRow);
        document.getElementById('panel').appendChild(table);
    } else {
        // Clear existing table rows except the header
        table.innerHTML = `
            <tr>
                <th>Wall Direction</th>
                <th>Direct Sun (hrs)</th>
                <th>Indirect Sun (hrs)</th>
                <th>Shaded (hrs)</th>
            </tr>
        `;
    }

    buildings.forEach(b => {
        let coordinates = b.geometry.coordinates[0];

        for (let i = 0; i < coordinates.length - 1; i++) {
            let angle = Math.atan2(coordinates[i + 1][1] - coordinates[i][1], coordinates[i + 1][0] - coordinates[i][0]) * (180 / Math.PI);
            angle = (angle + 360) % 360;
            let wallDirection = getWallDirection(angle);

            let directSunHours = 0;
            let indirectSunHours = 0;
            let shadedHours = 0;

            for (let hour = 0; hour < 24; hour++) {
                let now = new Date();
                let centralOffset = getCentralTimeOffset();
                now.setUTCHours(hour + centralOffset, 0, 0, 0);

                let sunPos = SunCalc.getPosition(now, coordinates[i][1], coordinates[i][0]);
                let azimuth = sunPos.azimuth * (180 / Math.PI);

                let diff = Math.abs(angle - azimuth);

                if (diff < 30) {
                    directSunHours++;
                } else if (diff < 90) {
                    indirectSunHours++;
                } else {
                    shadedHours++;
                }
            }

            exposureData.push({ wallDirection, directSunHours, indirectSunHours, shadedHours });

            // Add row to table
            let row = document.createElement('tr');
            row.innerHTML = `
                <td>${wallDirection}</td>
                <td>${directSunHours}</td>
                <td>${indirectSunHours}</td>
                <td>${shadedHours}</td>
            `;
            table.appendChild(row);
        }
    });

    console.log("Sun Exposure Data:", exposureData);
}

function getWallDirection(angle) {
    const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW', 'N'];
    return directions[Math.round(angle / 45)];
}


function triggerSunCalc() {
    sunCalcEnabled = true;
    document.getElementById('timeSlider').disabled = false;
    updateSunlight(document.getElementById('timeSlider').value);
    calculateSunExposure(); // 🔥 Now calculates sun exposure when sun angle is triggered
    let elevationThreshold = 10; // Ignore sun positions where the sun is very low
if (sunPos.altitude * (180 / Math.PI) < elevationThreshold) {
    shadedHours++;
} else if (diff < 30) {
    directSunHours++;
} else if (diff < 90) {
    indirectSunHours++;
} else {
    shadedHours++;
}
}

// Load and add the DCPS.Geojson point file to the map
fetch('DCPS.Geojson')
    .then(response => response.json())
    .then(dcpsGeojson => {
        if (!dcpsGeojson || !dcpsGeojson.features) {
            console.error("Invalid DCPS GeoJSON data");
            return;
        }

        // ✅ Add DCPS Schools Source
        map.addSource('dcps-schools', {
            type: 'geojson',
            data: dcpsGeojson
        });

        // ✅ Add DCPS Schools Layer (Points)
        map.addLayer({
            id: 'dcps-schools-layer',
            type: 'circle',
            source: 'dcps-schools',
            paint: {
                'circle-radius': 6, // Adjust size
                'circle-color': '#FF5733', // Orange color
                'circle-stroke-width': 1,
                'circle-stroke-color': '#FFFFFF' // White stroke for visibility
            }
        });

        console.log("DCPS.Geojson loaded successfully.");
    })
    .catch(error => console.error('Error loading DCPS.Geojson:', error));

    // ✅ Display School Name on Hover
let schoolPopup = new mapboxgl.Popup({ closeButton: false, closeOnClick: false });

map.on('mouseenter', 'dcps-schools-layer', (e) => {
    map.getCanvas().style.cursor = 'pointer';
    const coordinates = e.features[0].geometry.coordinates.slice();
    const schoolName = e.features[0].properties['NAME'] || "Unknown School";

    schoolPopup.setLngLat(coordinates).setHTML(`<strong>${schoolName}</strong>`).addTo(map);
});

map.on('mouseleave', 'dcps-schools-layer', () => {
    map.getCanvas().style.cursor = '';
    schoolPopup.remove();
});

function createWallLayer(id, coordinates, height, color) {
    if (map.getLayer(id)) {
        map.removeLayer(id);
        map.removeSource(id);
    }
    
    map.addLayer({
        id: id,
        type: 'fill-extrusion',
        source: {
            type: 'geojson',
            data: {
                type: 'Feature',
                geometry: {
                    type: 'Polygon',
                    coordinates: [coordinates]
                }
            }
        },
        paint: {
            'fill-extrusion-color': color,
            'fill-extrusion-height': height,
            'fill-extrusion-base': 0,
            'fill-extrusion-opacity': 0.8
        }
    });
}

map.on('draw.create', function(e) {
    let feature = e.features[0];
    let area = turf.area(feature); // Ground-level area in square meters
    let areaSqFt = area * 10.764; // Convert to square feet

    if (drawingBuilding) {
        feature.properties = { area: areaSqFt, floors: 1, height: 14 };
        buildings.push(feature);
        updateBuildings();
    } else if (drawingParking) {
    feature.properties = { area: areaSqFt };
    parkingAreas.push(feature);
    updateMapFeature(feature, 'black', `parking-${feature.id}`);
} else if (drawingPlaySpace) {
    feature.properties = { area: areaSqFt };
    playAreas.push(feature);
    updateMapFeature(feature, 'green', `play-${feature.id}`);
}

    // Reset drawing mode after creating a shape
    drawingBuilding = false;
    drawingParking = false;

    updateTable();
});


function updateMapFeature(feature, color, id) {
    if (map.getLayer(id)) {
        map.removeLayer(id);
        map.removeSource(id);
    }
    map.addLayer({
        id: id,
        type: 'fill',
        source: { type: 'geojson', data: feature },
        paint: {
            'fill-color': color,
            'fill-opacity': 0.5
        }
    });
}

function updateTable() {
    let container = document.getElementById('spaceSummaryContainer');
    container.innerHTML = ''; // Clear existing content

    let allSpaces = [...buildings, ...playAreas, ...parkingAreas]; // Combine all space types

    if (allSpaces.length === 0) {
        container.innerHTML = '<p>No spaces drawn yet.</p>';
        return;
    }

    allSpaces.forEach(space => {
        let type = space.properties.type || (playAreas.includes(space) ? "Play Space" : parkingAreas.includes(space) ? "Parking" : "Building");
        let area = Number(space.properties.area.toFixed(2)).toLocaleString();
        let diff = space.properties.difference !== undefined 
            ? Number(space.properties.difference.toFixed(2)).toLocaleString() 
            : '-';

        let diffClass = space.properties.difference < 0 ? 'negative' : '';

        let card = document.createElement('div');
        card.className = 'summary-card';
        card.innerHTML = `
            <h5>${type}</h5>
            <p><strong>Area:</strong> ${area} sq ft</p>
            <p class="${diffClass}"><strong>Difference:</strong> ${diff} sq ft</p>
        `;

        container.appendChild(card);
    });
}

function capturePolygonAsImage(feature) {
    if (!feature) return;

    // Create a canvas element
    let canvas = document.createElement("canvas");
    let ctx = canvas.getContext("2d");

    canvas.width = 200;  // Set canvas size (adjust as needed)
    canvas.height = 200;

    // Draw background
    ctx.fillStyle = "#f8f8f8";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Get polygon coordinates
    let coordinates = feature.geometry.coordinates[0];

    // Scale and center polygon
    let minX = Math.min(...coordinates.map(coord => coord[0]));
    let minY = Math.min(...coordinates.map(coord => coord[1]));
    let maxX = Math.max(...coordinates.map(coord => coord[0]));
    let maxY = Math.max(...coordinates.map(coord => coord[1]));

    let scaleX = canvas.width / (maxX - minX);
    let scaleY = canvas.height / (maxY - minY);
    let scale = Math.min(scaleX, scaleY) * 0.8; // Scale down slightly for padding

    let offsetX = (canvas.width - (maxX - minX) * scale) / 2;
    let offsetY = (canvas.height - (maxY - minY) * scale) / 2;

    // Draw the polygon
    ctx.beginPath();
    ctx.strokeStyle = "#004aad"; // Blue outline
    ctx.fillStyle = "rgba(0, 74, 173, 0.2)"; // Light blue fill
    ctx.lineWidth = 2;

    coordinates.forEach((coord, index) => {
        let x = (coord[0] - minX) * scale + offsetX;
        let y = (coord[1] - minY) * scale + offsetY;
        if (index === 0) {
            ctx.moveTo(x, y);
        } else {
            ctx.lineTo(x, y);
        }
    });

    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Convert canvas to image
    let imageURL = canvas.toDataURL();

    // Display in the left panel
    let imageContainer = document.getElementById("polygonImageContainer");
    imageContainer.innerHTML = `<img src="${imageURL}" alt="Polygon Preview" class="polygon-preview">
                                <p><strong>Area:</strong> ${feature.properties.area.toLocaleString()} sq ft</p>`;
}



// Function to determine Central Time offset (CST/CDT automatically)
function getCentralTimeOffset() {
    let now = new Date();
    let jan = new Date(now.getFullYear(), 0, 1);
    let jul = new Date(now.getFullYear(), 6, 1);
    let stdOffset = Math.max(jan.getTimezoneOffset(), jul.getTimezoneOffset()); // Standard time offset (in minutes)
    return stdOffset / -60; // Convert to hours (negative to positive)
}

function updateSunlight(time) {
    if (!sunCalcEnabled || buildings.length === 0) return;

    let center = turf.center(buildings[0]);
    let now = new Date();
    let centralOffset = getCentralTimeOffset(); // Dynamically detect CST/CDT
    now.setUTCHours(parseInt(time) + centralOffset, 0, 0, 0);

    let sunPos = SunCalc.getPosition(now, center.geometry.coordinates[1], center.geometry.coordinates[0]);
    let azimuth = sunPos.azimuth * (180 / Math.PI);

    console.log(`Time (Central): ${time}:00, Sun Azimuth: ${azimuth}`);
    
    // Update wall colors based on sun azimuth
    buildings.forEach(b => {
        let coordinates = b.geometry.coordinates[0];
        for (let i = 0; i < coordinates.length - 1; i++) {
            let wallId = `wall-${b.id}-${i}`;
            let angle = Math.atan2(coordinates[i + 1][1] - coordinates[i][1], coordinates[i + 1][0] - coordinates[i][0]) * (180 / Math.PI);
            angle = (angle + 360) % 360;

            let diff = Math.abs(angle - azimuth);
            let wallColor = diff < 30 ? '#FFD700' : diff < 60 ? '#FF8C00' : diff < 90 ? '#B22222' : 'white';

            if (map.getLayer(wallId)) {
                map.setPaintProperty(wallId, 'fill-extrusion-color', wallColor);
            }
        }
    });
}
function updateBuildings() {
    let floors = parseInt(document.getElementById('floorInput').value) || 1; // Get user input floors
    let targetEnrollment = parseInt(document.getElementById('targetEnrollment').value) || 0;
    let targetSqFt = targetEnrollment * sqftPerStudent[selectedSchoolType]; // Target size calculation

    buildings.forEach(b => {
        let baseArea = b.properties.baseArea || b.properties.area; // Store the original single-floor area
        b.properties.baseArea = baseArea; // Ensure it is stored
        let totalAreaSqFt = baseArea * floors; // Multiply by floors

        b.properties.area = totalAreaSqFt;
        b.properties.floors = floors;
        b.properties.height = floors * 14; // Adjust height accordingly
        b.properties.difference = totalAreaSqFt - targetSqFt; // Recalculate difference

        updateMapBuilding(b);
    });

    updateTable();
}

map.on('draw.update', function(e) {
    let updatedFeature = e.features[0]; // Get updated shape
    let updatedArea = turf.area(updatedFeature); // Calculate new area
    let updatedAreaSqFt = updatedArea * 10.764; // Convert to square feet

    let updated = false; // Track if an update happens

    // Update Buildings
    buildings.forEach(b => {
        if (b.id === updatedFeature.id) {
            b.geometry = updatedFeature.geometry; // Update the geometry
            b.properties.baseArea = updatedAreaSqFt; // Update base area
            let floors = parseInt(document.getElementById('floorInput').value) || 1;
            b.properties.area = updatedAreaSqFt * floors; // Recalculate total area
            b.properties.difference = b.properties.area - (parseInt(document.getElementById('targetEnrollment').value) || 0) * sqftPerStudent[selectedSchoolType];
            updateMapBuilding(b);
            updated = true;
        }
    });

    // Update Play Spaces
    playAreas.forEach(p => {
        if (p.id === updatedFeature.id) {
            p.geometry = updatedFeature.geometry; // Update geometry
            p.properties.area = updatedAreaSqFt; // Update area
            updateMapFeature(p, 'green', `play-${p.id}`);
            updated = true;
        }
    });

    // Update Parking Areas
    parkingAreas.forEach(p => {
        if (p.id === updatedFeature.id) {
            p.geometry = updatedFeature.geometry; // Update geometry
            p.properties.area = updatedAreaSqFt; // Update area
            updateMapFeature(p, 'black', `parking-${p.id}`);
            updated = true;
        }
    });

    if (updated) {
        updateTable(); // Refresh the summary table
    }
});


function updateMapBuilding(building) {
    let id = `building-${building.id}`;
    if (map.getLayer(id)) {
        map.removeLayer(id);
        map.removeSource(id);
    }
    map.addLayer({
        id: id,
        type: 'fill-extrusion',
        source: { type: 'geojson', data: building },
        paint: {
            'fill-extrusion-color': '#888',
            'fill-extrusion-height': building.properties.height,
            'fill-extrusion-opacity': 0.6
        }
    });
}

function loadDallasBuildings() {
    fetch('DallasBuildings.geojson')
        .then(response => response.json())
        .then(data => {
            if (map.getLayer('dallas-buildings')) {
                map.removeLayer('dallas-buildings');
                map.removeSource('dallas-buildings');
            }

            map.addSource('dallas-buildings', {
                type: 'geojson',
                data: data
            });

            map.addLayer({
                id: 'dallas-buildings',
                type: 'fill-extrusion',
                source: 'dallas-buildings',
                paint: {
                    'fill-extrusion-color': 'yellow',
                    'fill-extrusion-height': ['get', 'MeanHeight'],
                    'fill-extrusion-base': 0,
                    'fill-extrusion-opacity': 0.8
                }
            });

            console.log("Dallas buildings loaded.");
        })
        .catch(error => console.error('Error loading DallasBuildings.geojson:', error));
}
// Add the Mapbox Geocoder (search bar on the map)
let geocoder = new MapboxGeocoder({
    accessToken: mapboxgl.accessToken,
    mapboxgl: mapboxgl,
    placeholder: "Search for an address...",
    proximity: { longitude: -96.7970, latitude: 32.7767 }, // Default to Dallas, TX
    marker: false, // Do not add default marker
});

// Add search bar to the top-left of the map
map.addControl(geocoder, "top-left");

// Move the map to the selected location when an address is chosen
geocoder.on('result', function (e) {
    let coordinates = e.result.geometry.coordinates;
    map.flyTo({ center: coordinates, zoom: 15 });

    // Optional: Add a marker at the searched location
    new mapboxgl.Marker()
        .setLngLat(coordinates)
        .setPopup(new mapboxgl.Popup().setText(e.result.place_name)) // Show address in popup
        .addTo(map);
});
// Ensure time slider updates sunlight dynamically
document.getElementById('timeSlider').addEventListener('input', (e) => {
    updateSunlight(e.target.value);

    
});

