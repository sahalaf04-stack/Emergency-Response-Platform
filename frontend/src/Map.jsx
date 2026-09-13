
import React, { useEffect, useState } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
} from "react-leaflet";

import L from "leaflet";
import "leaflet/dist/leaflet.css";

import axios from "axios";

// Fix Leaflet default marker icons
delete L.Icon.Default.prototype._getIconUrl;

L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",

  iconUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",

  shadowUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

const API = "http://localhost:8000/api";

// ------------------------------------------------
// CUSTOM ICONS
// ------------------------------------------------

const userIcon = L.divIcon({
  className: "custom-map-icon",
  html: `<div class="map-pin user-pin">📍</div>`,
  iconSize: [40, 40],
  iconAnchor: [20, 40],
});

const sosIcon = L.divIcon({
  className: "custom-map-icon",
  html: `<div class="map-pin sos-pin">🆘</div>`,
  iconSize: [45, 45],
  iconAnchor: [22, 45],
});

const criticalIcon = L.divIcon({
  className: "custom-map-icon",
  html: `<div class="map-pin critical-pin">🔴</div>`,
  iconSize: [40, 40],
  iconAnchor: [20, 40],
});

const highIcon = L.divIcon({
  className: "custom-map-icon",
  html: `<div class="map-pin high-pin">🟠</div>`,
  iconSize: [40, 40],
  iconAnchor: [20, 40],
});

const mediumIcon = L.divIcon({
  className: "custom-map-icon",
  html: `<div class="map-pin medium-pin">🟡</div>`,
  iconSize: [40, 40],
  iconAnchor: [20, 40],
});

// ------------------------------------------------
// SERVICE ICON
// ------------------------------------------------

const getServiceIcon = (type) => {
  let emoji = "📍";

  if (type === "hospital") {
    emoji = "🏥";
  } else if (type === "police") {
    emoji = "👮";
  } else if (type === "fire_station") {
    emoji = "🚒";
  } else if (type === "shelter") {
    emoji = "🏠";
  }

  return L.divIcon({
    className: "custom-map-icon",
    html: `<div class="map-pin service-pin">${emoji}</div>`,
    iconSize: [40, 40],
    iconAnchor: [20, 40],
  });
};

// ------------------------------------------------
// MAIN MAP
// ------------------------------------------------

function Map({ location, incidents = [] }) {

  if (!location) {
    return (
      <div className="map-message">
        📍 Getting your location...
      </div>
    );
  }

  return (
    <MapContent
      location={location}
      incidents={incidents}
    />
  );
}

// ------------------------------------------------
// MAP CONTENT
// ------------------------------------------------

function MapContent({
  location,
  incidents = [],
}) {

  const [places, setPlaces] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // ----------------------------------------------
  // GET NEARBY SERVICES
  // ----------------------------------------------

  useEffect(() => {

    const getNearbyServices = async () => {

      try {

        setLoading(true);
        setError("");

        const response = await axios.get(
          `${API}/nearby`,
          {
            params: {
              lat: location.lat,
              lng: location.lng,
            },
          }
        );

        console.log(
          "Nearby services:",
          response.data
        );

        setPlaces(
          Array.isArray(response.data)
            ? response.data
            : []
        );

      } catch (err) {

        console.error(
          "Nearby services error:",
          err
        );

        setError(
          "Unable to load nearby emergency services."
        );

        setPlaces([]);

      } finally {

        setLoading(false);

      }
    };

    getNearbyServices();

  }, [location.lat, location.lng]);

  // ----------------------------------------------
  // DIRECTIONS
  // ----------------------------------------------

  const getDirections = (lat, lng) => {

    const url =
      `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;

    window.open(
      url,
      "_blank",
      "noopener,noreferrer"
    );
  };

  // ----------------------------------------------
  // CALL SERVICE
  // ----------------------------------------------

  const callService = (phone) => {

    if (!phone) {
      alert(
        "Phone number is not available for this service."
      );
      return;
    }

    window.location.href = `tel:${phone}`;
  };

  // ----------------------------------------------
  // INCIDENT ICON
  // ----------------------------------------------

  const getIncidentIcon = (incident) => {

    if (
      incident.is_sos === true ||
      incident.priority === "Critical"
    ) {
      return sosIcon;
    }

    if (incident.priority === "High") {
      return highIcon;
    }

    if (incident.priority === "Medium") {
      return mediumIcon;
    }

    return criticalIcon;
  };

  // ----------------------------------------------
  // VALID INCIDENTS
  // ----------------------------------------------

  const validIncidents = incidents.filter(
    (incident) =>
      typeof incident.latitude === "number" &&
      typeof incident.longitude === "number"
  );

  return (
    <div className="map-wrapper">

      {/* ================= MAP ================= */}

      <MapContainer
        center={[
          location.lat,
          location.lng,
        ]}
        zoom={13}
        scrollWheelZoom={true}
        className="leaflet-map"
      >

        <TileLayer
          attribution='&copy; OpenStreetMap contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {/* USER LOCATION */}

        <Marker
          position={[
            location.lat,
            location.lng,
          ]}
          icon={userIcon}
        >

          <Popup>

            <strong>
              📍 Your Location
            </strong>

            <br />

            Latitude:{" "}
            {location.lat.toFixed(6)}

            <br />

            Longitude:{" "}
            {location.lng.toFixed(6)}

          </Popup>

        </Marker>

        {/* ================= INCIDENTS ================= */}

        {validIncidents.map(
          (incident) => (

            <Marker
              key={incident.id}
              position={[
                incident.latitude,
                incident.longitude,
              ]}
              icon={getIncidentIcon(
                incident
              )}
            >

              <Popup>

                <div className="popup-content">

                  <h3>

                    {incident.is_sos
                      ? "🆘 SOS ALERT"
                      : "🚨 Emergency"}

                  </h3>

                  <p>
                    <strong>
                      Type:
                    </strong>{" "}
                    {incident.emergency_type}
                  </p>

                  <p>
                    <strong>
                      Priority:
                    </strong>{" "}
                    {incident.priority}
                  </p>

                  <p>
                    <strong>
                      Status:
                    </strong>{" "}
                    {incident.status}
                  </p>

                  {incident.description && (

                    <p>
                      <strong>
                        Details:
                      </strong>{" "}
                      {incident.description}
                    </p>

                  )}

                  <button
                    className="direction-btn"
                    onClick={() =>
                      getDirections(
                        incident.latitude,
                        incident.longitude
                      )
                    }
                  >
                    🧭 Directions
                  </button>

                </div>

              </Popup>

            </Marker>

          )
        )}

        {/* ================= NEARBY SERVICES ================= */}

        {places.map(
          (place, index) => {

            if (
              typeof place.latitude !==
                "number" ||
              typeof place.longitude !==
                "number"
            ) {
              return null;
            }

            return (

              <Marker
                key={`${place.name}-${index}`}
                position={[
                  place.latitude,
                  place.longitude,
                ]}
                icon={getServiceIcon(
                  place.type
                )}
              >

                <Popup>

                  <div className="popup-content">

                    <h3>
                      {place.name ||
                        "Emergency Service"}
                    </h3>

                    <p>
                      <strong>
                        Type:
                      </strong>{" "}
                      {place.type}
                    </p>

                    {place.distance !==
                      undefined && (

                      <p>
                        <strong>
                          Distance:
                        </strong>{" "}
                        {Number(
                          place.distance
                        ).toFixed(2)}{" "}
                        km
                      </p>

                    )}

                    {place.phone && (

                      <button
                        className="call-btn"
                        onClick={() =>
                          callService(
                            place.phone
                          )
                        }
                      >
                        📞 Call
                      </button>

                    )}

                    <button
                      className="direction-btn"
                      onClick={() =>
                        getDirections(
                          place.latitude,
                          place.longitude
                        )
                      }
                    >
                      🧭 Directions
                    </button>

                  </div>

                </Popup>

              </Marker>

            );
          }
        )}

      </MapContainer>

      {/* ================= LEGEND ================= */}

      <div className="map-legend">

        <h4>
          Map Legend
        </h4>

        <div>
          📍 Your Location
        </div>

        <div>
          🆘 SOS / Critical
        </div>

        <div>
          🟠 High Priority
        </div>

        <div>
          🟡 Medium Priority
        </div>

        <div>
          🏥 Hospital
        </div>

        <div>
          👮 Police
        </div>

        <div>
          🚒 Fire Station
        </div>

        <div>
          🏠 Shelter
        </div>

      </div>

      {/* ================= NEARBY LIST ================= */}

      <div className="nearby-section">

        <h3>
          📍 Nearby Emergency Services
        </h3>

        {loading && (
          <p>
            Searching for nearby services...
          </p>
        )}

        {error && (
          <p className="error-text">
            {error}
          </p>
        )}

        {!loading &&
          !error &&
          places.length === 0 && (

            <p>
              No nearby emergency services
              found.
            </p>

          )}

        <div className="nearby-list">

          {places.map(
            (place, index) => (

              <div
                className="nearby-card"
                key={`${place.name}-${index}`}
              >

                <div className="nearby-info">

                  <h4>
                    {place.type ===
                    "hospital"
                      ? "🏥"
                      : place.type ===
                        "police"
                      ? "👮"
                      : place.type ===
                        "fire_station"
                      ? "🚒"
                      : place.type ===
                        "shelter"
                      ? "🏠"
                      : "📍"}{" "}
                    {place.name ||
                      "Emergency Service"}
                  </h4>

                  <span>
                    {place.type}
                  </span>

                  {place.distance !==
                    undefined && (

                    <strong>
                      📏{" "}
                      {Number(
                        place.distance
                      ).toFixed(2)}{" "}
                      km away
                    </strong>

                  )}

                </div>

                <div className="nearby-actions">

                  {place.phone && (

                    <button
                      className="call-btn"
                      onClick={() =>
                        callService(
                          place.phone
                        )
                      }
                    >
                      📞 Call
                    </button>

                  )}

                  <button
                    className="direction-btn"
                    onClick={() =>
                      getDirections(
                        place.latitude,
                        place.longitude
                      )
                    }
                  >
                    🧭 Directions
                  </button>

                </div>

              </div>

            )
          )}

        </div>

      </div>

    </div>
  );
}

export default Map;
