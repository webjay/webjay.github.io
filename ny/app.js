const mobileSheetQuery = window.matchMedia("(max-width: 768px)");
const list = document.getElementById("list");
const summary = document.getElementById("summary");
const sidebar = document.getElementById("sidebar");
const map = L.map("map", { zoomControl: false }).setView([40.73, -73.98], 12);
const markerLayer = L.markerClusterGroup({
  showCoverageOnHover: false,
  maxClusterRadius: 40
});
const canLocate = Boolean(navigator.geolocation);
let userLocationMarker;
let userLocationAccuracy;
let isLocating = false;
let activePlaceButton = null;

const dateFormatter = new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium"
});

const reactionLabels = {
  like: "Liked",
  okay: "Okay",
  dislike: "Disliked"
};

const escapeHtml = (value = "") =>
  value.replace(/[&<>"']/g, (match) => {
    const entities = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    };

    return entities[match];
  });

const formatDate = (value) => {
  const date = value ? new Date(value.replace(" ", "T")) : null;
  return date && !Number.isNaN(date.valueOf()) ? dateFormatter.format(date) : null;
};

const formatVisitSpan = (place) => {
  const start = formatDate(place.first_checkin);
  const end = formatDate(place.last_checkin);

  if (!start || !end) {
    return null;
  }

  if (start === end) {
    return `Visited ${start}`;
  }

  return `${start} to ${end}`;
};

const formatActivity = (place) => {
  const parts = [`${place.checkins} check-ins`];
  if (Number.isFinite(place.visit_span_days)) {
    parts.push(`across ${place.visit_span_days} days`);
  }
  return parts.join(" ");
};

const createTag = (text, extraClass = "") => {
  const tag = document.createElement("span");
  tag.className = extraClass ? `tag ${extraClass}` : "tag";
  tag.textContent = text;
  return tag;
};

const buildPopupHtml = (place) => {
  const details = [];
  const visitSpan = formatVisitSpan(place);

  details.push(`<div class="popup-line">${escapeHtml(formatActivity(place))}</div>`);

  if (visitSpan) {
    details.push(`<div class="popup-line">${escapeHtml(visitSpan)}</div>`);
  }

  if (place.reaction) {
    details.push(`<div class="popup-line">Reaction: ${escapeHtml(reactionLabels[place.reaction])}</div>`);
  }

  if (place.lists?.length) {
    details.push(`<div class="popup-line">Lists: ${escapeHtml(place.lists.join(", "))}</div>`);
  }

  if (place.latest_tip?.text) {
    const tipDate = formatDate(place.latest_tip.created_at);
    const label = tipDate ? `Tip · ${tipDate}` : "Tip";
    details.push(
      `<div class="popup-callout"><strong>${escapeHtml(label)}</strong><br>${escapeHtml(place.latest_tip.text)}</div>`
    );
  }

  if (place.latest_note?.text) {
    const noteDate = formatDate(place.latest_note.created_at);
    const label = noteDate ? `Note · ${noteDate}` : "Note";
    details.push(
      `<div class="popup-callout"><strong>${escapeHtml(label)}</strong><br>${escapeHtml(place.latest_note.text)}</div>`
    );
  }

  if (place.latest_photo?.url) {
    details.push(
      `<img class="popup-photo" src="${escapeHtml(place.latest_photo.url)}" alt="Recent photo of ${escapeHtml(place.name)}" loading="lazy">`
    );
  }

  if (place.foursquare_url) {
    details.push(
      `<a class="popup-link" href="${escapeHtml(place.foursquare_url)}" target="_blank" rel="noreferrer">Open in Foursquare</a>`
    );
  }

  return `<div class="popup"><strong>${escapeHtml(place.name)}</strong>${details.join("")}</div>`;
};

const setActivePlaceButton = (button) => {
  if (activePlaceButton) {
    activePlaceButton.classList.remove("is-active");
    activePlaceButton.removeAttribute("aria-current");
  }

  activePlaceButton = button;

  if (activePlaceButton) {
    activePlaceButton.classList.add("is-active");
    activePlaceButton.setAttribute("aria-current", "true");
  }
};

const getViewportPadding = () =>
  mobileSheetQuery.matches
    ? {
        paddingTopLeft: [24, 24],
        paddingBottomRight: [24, Math.max(24, Math.round((sidebar?.offsetHeight || 0) + 24))]
      }
    : {
        padding: [24, 24]
      };

const handleViewportChange = () => {
  requestAnimationFrame(() =>
    map.invalidateSize({
      pan: false,
      debounceMoveend: true
    })
  );
};

const setLocateButtonState = (button) => {
  button.classList.toggle("is-locating", isLocating);
  button.disabled = !canLocate || isLocating;
  button.setAttribute("aria-busy", String(isLocating));
  button.title = !canLocate
    ? "Geolocation is not available in this browser"
    : isLocating
      ? "Finding your location..."
      : "Locate me";
};

const LocateControl = L.Control.extend({
  options: {
    position: "topright"
  },

  onAdd() {
    const button = L.DomUtil.create("button", "locate-control");
    button.type = "button";
    button.textContent = "◎";
    button.setAttribute(
      "aria-label",
      canLocate ? "Locate me" : "Geolocation is not available"
    );
    setLocateButtonState(button);

    L.DomEvent.disableClickPropagation(button);
    L.DomEvent.on(button, "click", () => {
      if (!canLocate || isLocating) {
        return;
      }

      isLocating = true;
      setLocateButtonState(button);
      map.locate({
        enableHighAccuracy: true,
        setView: false
      });
    });

    map.on("locationfound locationerror", () => {
      isLocating = false;
      setLocateButtonState(button);
    });

    return button;
  }
});

L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  attribution: "&copy; OpenStreetMap contributors"
}).addTo(map);

map.addLayer(markerLayer);
map.addControl(new LocateControl());
mobileSheetQuery.addEventListener("change", handleViewportChange);
handleViewportChange();

map.on("locationfound", (event) => {
  if (userLocationMarker) {
    userLocationMarker.setLatLng(event.latlng);
  } else {
    userLocationMarker = L.marker(event.latlng).addTo(map);
  }

  if (userLocationAccuracy) {
    userLocationAccuracy.setLatLng(event.latlng);
    userLocationAccuracy.setRadius(event.accuracy);
  } else {
    userLocationAccuracy = L.circle(event.latlng, {
      radius: event.accuracy,
      weight: 1,
      color: "#2563eb",
      fillColor: "#60a5fa",
      fillOpacity: 0.18
    }).addTo(map);
  }

  map.stop();
  map.flyTo(event.latlng, Math.max(map.getZoom(), 15), {
    duration: 0.8
  });
  map.once("moveend", () => {
    map.panInside(event.latlng, getViewportPadding());
  });
});

map.on("locationerror", (event) => {
  window.alert(event.message || "Unable to determine your location.");
});

fetch("ny.json")
  .then((res) => {
    if (!res.ok) {
      throw new Error(`Failed to load ny.json: ${res.status}`);
    }

    return res.json();
  })
  .then((data) => {
    const fragment = document.createDocumentFragment();
    const bounds = L.latLngBounds();
    let hasBounds = false;

    if (summary) {
      summary.textContent = `${data.length} spots with visits, notes, tips, lists, and photos from the Foursquare export.`;
    }

    data.forEach((place) => {
      const lat = place.latitude;
      const lng = place.longitude;

      bounds.extend([lat, lng]);
      hasBounds = true;

      const marker = L.marker([lat, lng]).bindPopup(buildPopupHtml(place), {
        maxWidth: 280
      });

      markerLayer.addLayer(marker);

      const button = document.createElement("button");
      button.className = "place";
      button.type = "button";

      const title = document.createElement("div");
      title.className = "place-title";

      const rank = document.createElement("span");
      rank.className = "rank";
      rank.textContent = `${place.rank}.`;

      const name = document.createElement("span");
      name.className = "place-name";
      name.textContent = place.name;

      title.append(rank, name);

      const activity = document.createElement("div");
      activity.className = "place-meta";
      activity.textContent = formatActivity(place);

      const visitSpan = formatVisitSpan(place);
      const timeline = document.createElement("div");
      timeline.className = "place-meta";
      timeline.textContent = visitSpan || "Visit dates unavailable";

      const tagRow = document.createElement("div");
      tagRow.className = "tag-row";

      if (place.reaction) {
        tagRow.appendChild(createTag(reactionLabels[place.reaction], `tag-${place.reaction}`));
      }

      if (place.tip_count) {
        tagRow.appendChild(createTag(`${place.tip_count} tip${place.tip_count === 1 ? "" : "s"}`));
      }

      if (place.photo_count) {
        tagRow.appendChild(createTag(`${place.photo_count} photo${place.photo_count === 1 ? "" : "s"}`));
      }

      if (place.lists?.length) {
        tagRow.appendChild(createTag(place.lists.join(", ")));
      }

      const detail = document.createElement("div");
      detail.className = "place-detail";
      detail.textContent = place.latest_tip?.text || place.latest_note?.text || "";

      button.append(title, activity, timeline);

      if (tagRow.childElementCount > 0) {
        button.appendChild(tagRow);
      }

      if (detail.textContent) {
        button.appendChild(detail);
      }

      const focusPlace = () => {
        setActivePlaceButton(button);
        button.scrollIntoView({
          block: "nearest",
          behavior: "smooth"
        });
      };

      marker.on("click", focusPlace);

      button.addEventListener("click", () => {
        markerLayer.zoomToShowLayer(marker, () => {
          map.stop();
          map.setView([lat, lng], 16);
          map.panInside([lat, lng], getViewportPadding());
          marker.openPopup();
          focusPlace();
        });
      });

      fragment.appendChild(button);
    });

    list.appendChild(fragment);

    if (hasBounds) {
      map.fitBounds(bounds, getViewportPadding());
    }
  })
  .catch((error) => {
    list.textContent = "Unable to load places.";
    console.error(error);
  });
