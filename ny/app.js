const mobileSheetQuery = window.matchMedia("(max-width: 768px)");
const list = document.getElementById("list");
const map = L.map("map", { zoomControl: false }).setView([40.73, -73.98], 12);
const markerLayer = L.markerClusterGroup({
  showCoverageOnHover: false,
  maxClusterRadius: 40
});

const handleViewportChange = () => {
  requestAnimationFrame(() => map.invalidateSize());
};

L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  attribution: "&copy; OpenStreetMap contributors"
}).addTo(map);

map.addLayer(markerLayer);
mobileSheetQuery.addEventListener("change", handleViewportChange);
handleViewportChange();

fetch("ny.json")
  .then((res) => {
    if (!res.ok) {
      throw new Error(`Failed to load ny.json: ${res.status}`);
    }

    return res.json();
  })
  .then((data) => {
    const fragment = document.createDocumentFragment();
    const bounds = [];

    data.forEach((place) => {
      const lat = place.latitude;
      const lng = place.longitude;

      bounds.push([lat, lng]);

      const marker = L.marker([lat, lng]).bindPopup(
        `<strong>${place.name}</strong><br/>Check-ins: ${place.checkins}`
      );

      markerLayer.addLayer(marker);

      const button = document.createElement("button");
      button.className = "place";
      button.type = "button";

      const rank = document.createElement("span");
      rank.className = "rank";
      rank.textContent = `${place.rank}.`;

      const name = document.createTextNode(` ${place.name}`);

      const checkins = document.createElement("div");
      checkins.className = "checkins";
      checkins.textContent = `${place.checkins} check-ins`;

      button.append(rank, name, checkins);
      button.addEventListener("click", () => {
        markerLayer.zoomToShowLayer(marker, () => {
          map.setView([lat, lng], 16);
          marker.openPopup();
        });
      });

      fragment.appendChild(button);
    });

    list.appendChild(fragment);

    if (bounds.length > 0) {
      const fitBoundsOptions = mobileSheetQuery.matches
        ? { paddingTopLeft: [24, 24], paddingBottomRight: [24, 220] }
        : { padding: [24, 24] };
      map.fitBounds(bounds, fitBoundsOptions);
    }
  })
  .catch((error) => {
    list.textContent = "Unable to load places.";
    console.error(error);
  });
