
import React, { useEffect, useRef, useState } from "react";
import axios from "axios";
import Map from "./Map";
import Login from "./Login";
import "./index.css";
import Analytics from "./Analytics";

const API = import.meta.env.VITE_API_URL;
function App() {
  const [user, setUser] = useState(null);
  const [incidents, setIncidents] = useState([]);
  const [location, setLocation] = useState(null);

  const [submitting, setSubmitting] = useState(false);
  const [sosLoading, setSosLoading] = useState(false);
  const [locationLoading, setLocationLoading] = useState(false);

  const [form, setForm] = useState({
    name: "",
    phone: "",
    emergency_type: "Medical",
    description: "",
  });

  const [newSOS, setNewSOS] = useState(null);
  const [currentPath, setCurrentPath] = useState(
  window.location.pathname
);
useEffect(() => {
  const handlePopState = () => {
    setCurrentPath(window.location.pathname);
  };

  window.addEventListener("popstate", handlePopState);

  return () => {
    window.removeEventListener("popstate", handlePopState);
  };
}, []);

  // Stores SOS IDs that have already triggered an alert.
  const alertedSOSIds = useRef(new Set());

  // Used to know when the first incident request has completed.
  const firstLoad = useRef(true);

  // ------------------------------------------------
  // LOGIN
  // ------------------------------------------------

  useEffect(() => {
    const savedUser = localStorage.getItem("user");

    if (savedUser) {
      try {
        setUser(JSON.parse(savedUser));
      } catch {
        localStorage.removeItem("user");
      }
    }
  }, []);

  // ------------------------------------------------
  // USER INITIALIZATION
  // ------------------------------------------------

  useEffect(() => {
    if (!user) return;

    getLocation();
    getIncidents();

    const interval = setInterval(() => {
      getIncidents();
    }, 5000);

    return () => clearInterval(interval);
  }, [user]);

  // ------------------------------------------------
  // LOCATION
  // ------------------------------------------------

  
    const getLocation = () => {
  if (!navigator.geolocation) {
    alert("Geolocation is not supported by this browser.");
    return;
  }

  setLocationLoading(true);

  navigator.geolocation.getCurrentPosition(
    (position) => {
      console.log("GPS LOCATION:", position.coords);

      setLocation({
        lat: position.coords.latitude,
        lng: position.coords.longitude,
      });

      setLocationLoading(false);
    },
    (error) => {
      console.error("GPS ERROR:", error);

      setLocationLoading(false);

      let message = "Unable to get your location.";

      switch (error.code) {
        case error.PERMISSION_DENIED:
          message =
            "Location permission was denied.\n\n" +
            "Please allow location permission for this website in your browser settings and try again.";
          break;

        case error.POSITION_UNAVAILABLE:
          message =
            "Your location is currently unavailable.\n\n" +
            "Please turn on GPS/location services and try again.";
          break;

        case error.TIMEOUT:
          message =
            "Location request timed out.\n\n" +
            "Please make sure GPS is enabled and try again.";
          break;

        default:
          message =
            "Unable to get your location. Please try again.";
      }

      alert(message);
    },
    {
      enableHighAccuracy: false,
      timeout: 20000,
      maximumAge: 60000,
    }
  );
};

  // ------------------------------------------------
  // HEADERS
  // ------------------------------------------------

  const getHeaders = () => {
    const token = localStorage.getItem("token");

    return {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    };
  };

  // ------------------------------------------------
  // SOS SOUND
  // ------------------------------------------------

  const playSOSSound = () => {
    try {
      const AudioContext =
        window.AudioContext ||
        window.webkitAudioContext;

      if (!AudioContext) return;

      const audioContext = new AudioContext();

      const oscillator =
        audioContext.createOscillator();

      const gainNode =
        audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      oscillator.type = "sine";
      oscillator.frequency.value = 900;

      gainNode.gain.setValueAtTime(
        0.0001,
        audioContext.currentTime
      );

      gainNode.gain.exponentialRampToValueAtTime(
        0.3,
        audioContext.currentTime + 0.05
      );

      gainNode.gain.exponentialRampToValueAtTime(
        0.0001,
        audioContext.currentTime + 0.5
      );

      oscillator.start();

      oscillator.stop(
        audioContext.currentTime + 0.5
      );
    } catch (error) {
      console.log("Could not play alert sound.");
    }
  };

  // ------------------------------------------------
  // BROWSER NOTIFICATION
  // ------------------------------------------------

  const showBrowserNotification = (incident) => {
    if (!("Notification" in window)) return;

    if (Notification.permission === "granted") {
      new Notification("🚨 NEW SOS ALERT", {
        body: `${incident.name || "User"} has activated an emergency SOS.`,
      });
    }
  };

  // ------------------------------------------------
  // REQUEST NOTIFICATION PERMISSION
  // ------------------------------------------------

  const requestNotificationPermission = async () => {
    if (!("Notification" in window)) return;

    if (Notification.permission === "default") {
      try {
        await Notification.requestPermission();
      } catch (error) {
        console.log("Notification permission error.");
      }
    }
  };

  // ------------------------------------------------
  // INCIDENTS
  // ------------------------------------------------

  const getIncidents = async () => {
    try {
      const response = await axios.get(
        `${API}/incidents`,
        getHeaders()
      );

      const data = response.data || [];

      setIncidents(data);

      // Do not alert existing incidents when
      // the dashboard is opened for the first time.
      if (firstLoad.current) {
        data
          .filter(
            (incident) =>
              incident.is_sos === true &&
              incident.status !== "Resolved"
          )
          .forEach((incident) => {
            alertedSOSIds.current.add(incident.id);
          });

        firstLoad.current = false;
        return;
      }

      // Detect new SOS incidents.
      if (user?.role === "admin") {
        const latestSOS = data.find(
          (incident) =>
            incident.is_sos === true &&
            incident.status !== "Resolved" &&
            !alertedSOSIds.current.has(incident.id)
        );

        if (latestSOS) {
          alertedSOSIds.current.add(latestSOS.id);

          setNewSOS(latestSOS);

          playSOSSound();
          showBrowserNotification(latestSOS);
        }
      }
    } catch (error) {
      console.error(
        "Error fetching incidents:",
        error
      );

      if (error.response?.status === 401) {
        logout();
      }
    }
  };

  // ------------------------------------------------
  // FORM
  // ------------------------------------------------

  const handleChange = (e) => {
    setForm({
      ...form,
      [e.target.name]: e.target.value,
    });
  };

  // ------------------------------------------------
  // NORMAL REPORT
  // ------------------------------------------------

  const reportEmergency = async (e) => {
    e.preventDefault();

    if (!location) {
      alert("Please get your location first.");
      return;
    }

    if (!form.description.trim()) {
      alert("Please describe the emergency.");
      return;
    }

    try {
      setSubmitting(true);

      const response = await axios.post(
        `${API}/incidents`,
        {
          name: form.name || user.name,
          phone: form.phone,
          emergency_type: form.emergency_type,
          description: form.description,
          latitude: location.lat,
          longitude: location.lng,
        },
        getHeaders()
      );

      alert(
        `Emergency reported successfully!\nPriority: ${
          response.data.priority || "Assigned"
        }`
      );

      setForm({
        name: user.name || "",
        phone: "",
        emergency_type: "Medical",
        description: "",
      });

      getIncidents();
    } catch (error) {
      console.error("Report error:", error);

      alert(
        error.response?.data?.detail ||
          "Failed to report emergency."
      );
    } finally {
      setSubmitting(false);
    }
  };

  // ------------------------------------------------
  // SOS
  // ------------------------------------------------

  const activateSOS = async () => {
    if (!location) {
      alert(
        "Your location is not available yet."
      );

      getLocation();

      return;
    }

    const confirmed = window.confirm(
      "🚨 ACTIVATE SOS?\n\n" +
        "Your current location will be shared with the emergency dashboard.\n\n" +
        "Are you sure?"
    );

    if (!confirmed) return;

    try {
      setSosLoading(true);

      await requestNotificationPermission();

      const response = await axios.post(
        `${API}/incidents/sos`,
        {
          name: user.name,
          phone: form.phone || "",
          latitude: location.lat,
          longitude: location.lng,
        },
        getHeaders()
      );

      console.log(
        "SOS RESPONSE:",
        response.data
      );

      alert(
        "🆘 SOS ACTIVATED!\n\n" +
          "Your emergency has been marked as CRITICAL.\n" +
          "Your location has been sent to the emergency dashboard."
      );

      await getIncidents();
    } catch (error) {
      console.error("SOS ERROR:", error);

      if (error.response?.status === 401) {
        alert(
          "Your session has expired. Please login again."
        );

        logout();
      } else {
        alert(
          error.response?.data?.detail ||
            "Unable to activate SOS."
        );
      }
    } finally {
      setSosLoading(false);
    }
  };

  // ------------------------------------------------
  // CLOSE SOS ALERT
  // ------------------------------------------------

  const closeSOSAlert = () => {
    setNewSOS(null);
  };

  // ------------------------------------------------
  // ADMIN STATUS
  // ------------------------------------------------

  const updateStatus = async (
    incidentId,
    status
  ) => {
    try {
      await axios.put(
        `${API}/incidents/${incidentId}?status=${encodeURIComponent(
          status
        )}`,
        {},
        getHeaders()
      );

      getIncidents();
    } catch (error) {
      console.error(
        "Status update error:",
        error
      );

      alert(
        error.response?.data?.detail ||
          "Unable to update status."
      );
    }
  };

  // ------------------------------------------------
  // LOGOUT
  // ------------------------------------------------

  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");

    setUser(null);
    setLocation(null);
    setIncidents([]);
    setNewSOS(null);

    alertedSOSIds.current.clear();
    firstLoad.current = true;
  };

  // ------------------------------------------------
  // LOGIN
  // ------------------------------------------------

  if (!user) {
    return <Login onLogin={setUser} />;
  }
  if (
  user &&
  user.role === "admin" &&
  currentPath === "/analytics"
) {
  return (
    <div className="app">

      <header className="header">

        <div>
          <h1>
            🚨 Emergency Response
          </h1>

          <p>
            Smart Emergency Assistance Platform
          </p>
        </div>

        <div className="user-section">

          <span>
            👤 {user.name}
          </span>

          <span className="role-badge">
            {user.role}
          </span>

          <button
            className="analytics-btn"
            onClick={() => {
  window.history.pushState({}, "", "/");
  window.dispatchEvent(new PopStateEvent("popstate"));
}}
          >
            ← Dashboard
          </button>

          <button
            className="logout-btn"
            onClick={logout}
          >
            Logout
          </button>

        </div>

      </header>

      <Analytics />

    </div>
  );
}

  // ------------------------------------------------
  // STATS
  // ------------------------------------------------

  const total = incidents.length;

  const active = incidents.filter(
    (item) => item.status !== "Resolved"
  ).length;

  const resolved = incidents.filter(
    (item) => item.status === "Resolved"
  ).length;

  const critical = incidents.filter(
    (item) =>
      item.priority === "Critical" ||
      item.is_sos === true
  ).length;

  return (
    <div className="app">

      {/* =========================================
          LIVE SOS ALERT
      ========================================= */}

      {newSOS && user.role === "admin" && (

        <div className="live-sos-overlay">

          <div className="live-sos-alert">

            <div className="live-sos-header">

              <span className="live-sos-icon">
                🆘
              </span>

              <div>

                <h2>
                  NEW SOS ALERT
                </h2>

                <p>
                  Immediate attention required
                </p>

              </div>

            </div>

            <div className="live-sos-body">

              <p>
                <strong>
                  👤 Person:
                </strong>{" "}
                {newSOS.name}
              </p>

              {newSOS.phone && (
                <p>
                  <strong>
                    📞 Phone:
                  </strong>{" "}
                  {newSOS.phone}
                </p>
              )}

              <p>
                <strong>
                  🚨 Priority:
                </strong>{" "}
                CRITICAL
              </p>

              <p>
                <strong>
                  📍 Location:
                </strong>{" "}
                {Number(
                  newSOS.latitude
                ).toFixed(5)}
                ,{" "}
                {Number(
                  newSOS.longitude
                ).toFixed(5)}
              </p>

              <div className="sos-alert-actions">

                <button
                  onClick={() => {
                    window.open(
                      `https://www.google.com/maps/dir/?api=1&destination=${newSOS.latitude},${newSOS.longitude}`,
                      "_blank",
                      "noopener,noreferrer"
                    );
                  }}
                >
                  🧭 View Location
                </button>

                {newSOS.phone && (
                  <button
                    onClick={() => {
                      window.location.href =
                        `tel:${newSOS.phone}`;
                    }}
                  >
                    📞 Call
                  </button>
                )}

                <button
                  className="dismiss-alert"
                  onClick={closeSOSAlert}
                >
                  Dismiss
                </button>

              </div>

            </div>

          </div>

        </div>

      )}

      {/* =========================================
          HEADER
      ========================================= */}

      <header className="header">

        <div>

          <h1>
            🚨 Emergency Response
          </h1>

          <p>
            Smart Emergency Assistance Platform
          </p>

        </div>

        <div className="user-section">

  <span>
    👤 {user.name}
  </span>

  <span className="role-badge">
    {user.role}
  </span>

  {user.role === "admin" && (
  <button
    className="analytics-btn"
    onClick={() => {
      window.history.pushState({}, "", "/analytics");
      window.dispatchEvent(new PopStateEvent("popstate"));
    }}
  >
    📊 Analytics
  </button>
)}

  <button
    className="logout-btn"
    onClick={logout}
  >
    Logout
  </button>

</div>

      </header>

      {/* =========================================
          MAIN
      ========================================= */}

      <main className="container">

        {/* SOS */}

        <section className="sos-card">

          <div className="sos-content">

            <div className="sos-icon">
              🆘
            </div>

            <div>

              <h2>
                Emergency SOS
              </h2>

              <p>
                Use this button if you are facing
                an immediate emergency.
              </p>

              <small>
                Your GPS location will be sent
                with the alert.
              </small>

            </div>

          </div>

          <button
            className="sos-button"
            onClick={activateSOS}
            disabled={sosLoading}
          >
            {sosLoading
              ? "🚨 SENDING SOS..."
              : "🆘 ACTIVATE SOS"}
          </button>

        </section>

        {/* LOCATION */}

        <section className="location-card">

          <div>

            <h3>
              📍 Your Current Location
            </h3>

            {location ? (

              <p>

                Latitude:{" "}
                <strong>
                  {location.lat.toFixed(6)}
                </strong>

                <br />

                Longitude:{" "}
                <strong>
                  {location.lng.toFixed(6)}
                </strong>

              </p>

            ) : (

              <p>
                Location not available
              </p>

            )}

          </div>

          <button
            onClick={getLocation}
            disabled={locationLoading}
            className="location-btn"
          >
            {locationLoading
              ? "Getting Location..."
              : "📍 Refresh Location"}
          </button>

        </section>

        {/* REPORT */}

        <section className="report-card">

          <h2>
            🚨 Report an Emergency
          </h2>

          <p>
            Provide details about the emergency.
          </p>

          <form onSubmit={reportEmergency}>

            <div className="form-grid">

              <div className="form-group">

                <label>
                  Name
                </label>

                <input
                  type="text"
                  name="name"
                  value={form.name}
                  onChange={handleChange}
                  placeholder={user.name}
                />

              </div>

              <div className="form-group">

                <label>
                  Phone
                </label>

                <input
                  type="tel"
                  name="phone"
                  value={form.phone}
                  onChange={handleChange}
                  placeholder="Enter phone number"
                />

              </div>

              <div className="form-group">

                <label>
                  Emergency Type
                </label>

                <select
                  name="emergency_type"
                  value={form.emergency_type}
                  onChange={handleChange}
                >

                  <option value="Medical">
                    🏥 Medical
                  </option>

                  <option value="Police">
                    👮 Police
                  </option>

                  <option value="Fire">
                    🚒 Fire
                  </option>

                  <option value="Accident">
                    🚗 Accident
                  </option>

                  <option value="Other">
                    ⚠️ Other
                  </option>

                </select>

              </div>

              <div className="form-group">

                <label>
                  Description
                </label>

                <textarea
                  name="description"
                  value={form.description}
                  onChange={handleChange}
                  placeholder="Describe what happened..."
                  rows="4"
                />

              </div>

            </div>

            <button
              type="submit"
              className="report-button"
              disabled={submitting}
            >
              {submitting
                ? "Submitting..."
                : "🚨 Report Emergency"}
            </button>

          </form>

        </section>

        {/* MAP */}

        <section className="map-card">

          <div className="section-heading">

            <div>

              <h2>
                🗺️ Emergency & Nearby Services
              </h2>

              <p>
                View emergencies and nearby
                emergency services.
              </p>

            </div>

          </div>

          {location ? (

            <Map
              location={location}
              incidents={incidents}
            />

          ) : (

            <div className="map-message">

              📍 Waiting for your location...

              <br />

              <button
                onClick={getLocation}
                className="location-btn"
              >
                Get My Location
              </button>

            </div>

          )}

        </section>
        {/* =====================================
    MY EMERGENCY REPORTS
===================================== */}

{user.role !== "admin" && (

  <section className="my-reports-card">

    <div className="section-heading">

      <div>

        <h2>
          📋 My Emergency Reports
        </h2>

        <p>
          Track the status of your reported emergencies.
        </p>

      </div>

    </div>

    {incidents.filter(
      (incident) =>
        incident.name === user.name
    ).length === 0 ? (

      <div className="empty-message">
        You have not reported any emergencies yet.
      </div>

    ) : (

      <div className="my-reports-list">

        {incidents
          .filter(
            (incident) =>
              incident.name === user.name
          )
          .map((incident) => (

            <div
              className={`my-report-card ${
                incident.is_sos
                  ? "my-report-sos"
                  : ""
              }`}
              key={incident.id}
            >

              <div className="my-report-header">

                <div>

                  <h3>
                    {incident.is_sos
                      ? "🆘 SOS Emergency"
                      : `🚨 ${incident.emergency_type}`}
                  </h3>

                  <p>
                    {incident.description ||
                      "SOS emergency activated."}
                  </p>

                </div>

                <span
                  className={`status-badge status-${incident.status
                    ?.toLowerCase()
                    .replace(/\s+/g, "-")}`}
                >
                  {incident.status}
                </span>

              </div>

              <div className="my-report-details">

                <span>
                  <strong>Priority:</strong>{" "}
                  {incident.priority}
                </span>

                <span>
                  <strong>Location:</strong>{" "}
                  {Number(incident.latitude).toFixed(5)},
                  {" "}
                  {Number(incident.longitude).toFixed(5)}
                </span>

              </div>

              <div className="status-progress">

                <div
                  className={
                    incident.status === "Reported" ||
                    incident.status === "Assigned" ||
                    incident.status === "In Progress" ||
                    incident.status === "Resolved"
                      ? "progress-step completed"
                      : "progress-step"
                  }
                >
                  <span>1</span>
                  <small>Reported</small>
                </div>

                <div
                  className={
                    incident.status === "Assigned" ||
                    incident.status === "In Progress" ||
                    incident.status === "Resolved"
                      ? "progress-step completed"
                      : "progress-step"
                  }
                >
                  <span>2</span>
                  <small>Assigned</small>
                </div>

                <div
                  className={
                    incident.status === "In Progress" ||
                    incident.status === "Resolved"
                      ? "progress-step completed"
                      : "progress-step"
                  }
                >
                  <span>3</span>
                  <small>Responding</small>
                </div>

                <div
                  className={
                    incident.status === "Resolved"
                      ? "progress-step completed"
                      : "progress-step"
                  }
                >
                  <span>4</span>
                  <small>Resolved</small>
                </div>

              </div>

              <button
                className="view-location-btn"
                onClick={() => {
                  window.open(
                    `https://www.google.com/maps/dir/?api=1&destination=${incident.latitude},${incident.longitude}`,
                    "_blank"
                  );
                }}
              >
                📍 View Location
              </button>

            </div>

          ))}

      </div>

    )}

  </section>

)}

        {/* =====================================
            ADMIN DASHBOARD
        ===================================== */}

        {user.role === "admin" && (

          <section className="admin-card">

            <div className="admin-title-row">

              <div>

                <h2>
                  👨‍💼 Admin Dashboard
                </h2>

                <span className="live-indicator">
                  <span></span>
                  LIVE MONITORING
                </span>

              </div>

            </div>

            {/* STATS */}

            <div className="stats-grid">

              <div className="stat-box">
                <span>📋</span>
                <strong>{total}</strong>
                <p>Total</p>
              </div>

              <div className="stat-box">
                <span>🚨</span>
                <strong>{active}</strong>
                <p>Active</p>
              </div>

              <div className="stat-box critical-stat">
                <span>🆘</span>
                <strong>{critical}</strong>
                <p>Critical</p>
              </div>

              <div className="stat-box">
                <span>✅</span>
                <strong>{resolved}</strong>
                <p>Resolved</p>
              </div>

            </div>

            {/* INCIDENTS */}

            <div className="admin-incidents">

              <h3>
                Emergency Reports
              </h3>

              {incidents.length === 0 ? (

                <p className="empty-message">
                  No emergency reports.
                </p>

              ) : (

                incidents.map(
                  (incident) => (

                    <div
                      className={`incident-card ${
                        incident.priority ===
                          "Critical" ||
                        incident.is_sos
                          ? "critical-incident"
                          : ""
                      }`}
                      key={incident.id}
                    >

                      <div className="incident-header">

                        <div>

                          <h3>

                            {incident.is_sos
                              ? "🆘 SOS ALERT"
                              : "🚨 Emergency"}

                          </h3>

                          <span>
                            {incident.emergency_type}
                          </span>

                        </div>

                        <span className="priority-badge">
                          {incident.priority}
                        </span>

                      </div>

                      <p>
                        <strong>
                          Name:
                        </strong>{" "}
                        {incident.name}
                      </p>

                      {incident.phone && (

                        <p>
                          <strong>
                            Phone:
                          </strong>{" "}
                          {incident.phone}
                        </p>

                      )}

                      <p>
                        <strong>
                          Description:
                        </strong>{" "}
                        {incident.description ||
                          "SOS emergency"}
                      </p>

                      <p>
                        <strong>
                          Status:
                        </strong>{" "}
                        {incident.status}
                      </p>

                      <div className="status-actions">

                        <select
                          value={incident.status}
                          onChange={(e) =>
                            updateStatus(
                              incident.id,
                              e.target.value
                            )
                          }
                        >

                          <option value="Reported">
                            Reported
                          </option>

                          <option value="Assigned">
                            Assigned
                          </option>

                          <option value="In Progress">
                            In Progress
                          </option>

                          <option value="Resolved">
                            Resolved
                          </option>

                        </select>

                      </div>

                    </div>

                  )
                )

              )}

            </div>

          </section>

        )}

      </main>

      <footer className="footer">

        <p>
          Emergency Response & Help Platform
        </p>

        <p>
          For demonstration purposes. In a real
          emergency, contact your local emergency
          services.
        </p>

      </footer>

    </div>
  );
}

export default App;
