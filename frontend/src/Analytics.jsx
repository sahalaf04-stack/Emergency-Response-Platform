import React, { useEffect, useState } from "react";
import axios from "axios";

const API = import.meta.env.VITE_API_URL;

function Analytics() {
    const [incidents, setIncidents] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchIncidents();
    }, []);

    const fetchIncidents = async () => {
        try {
            const token = localStorage.getItem("token");

            const response = await axios.get(
                `${API}/incidents`,
                {
                    headers: {
                        Authorization: `Bearer ${token}`
                    }
                }
            );

            setIncidents(response.data || []);
        } catch (error) {
            console.error("Failed to load analytics:", error);
        } finally {
            setLoading(false);
        }
    };

    const total = incidents.length;

    const critical = incidents.filter(
        (incident) =>
            incident.priority?.toLowerCase() === "critical"
    ).length;

    const high = incidents.filter(
        (incident) =>
            incident.priority?.toLowerCase() === "high"
    ).length;

    const medium = incidents.filter(
        (incident) =>
            incident.priority?.toLowerCase() === "medium"
    ).length;

    const resolved = incidents.filter(
        (incident) =>
            incident.status?.toLowerCase() === "resolved"
    ).length;

    const active = total - resolved;

    const emergencyTypes = {};

    incidents.forEach((incident) => {
        const type = incident.emergency_type || "Other";

        emergencyTypes[type] =
            (emergencyTypes[type] || 0) + 1;
    });

    if (loading) {
        return (
            <div className="analytics-container">
                <h2>Loading Analytics...</h2>
            </div>
        );
    }

    return (
        <div className="analytics-container">

            <h1>Emergency Analytics</h1>

            <p className="analytics-subtitle">
                Overview of emergency incidents and response status
            </p>

            <div className="analytics-cards">

                <div className="analytics-card">
                    <h3>Total Incidents</h3>
                    <strong>{total}</strong>
                </div>

                <div className="analytics-card">
                    <h3>Critical</h3>
                    <strong>{critical}</strong>
                </div>

                <div className="analytics-card">
                    <h3>High Priority</h3>
                    <strong>{high}</strong>
                </div>

                <div className="analytics-card">
                    <h3>Active</h3>
                    <strong>{active}</strong>
                </div>

                <div className="analytics-card">
                    <h3>Resolved</h3>
                    <strong>{resolved}</strong>
                </div>

            </div>

            <div className="analytics-section">

                <h2>Priority Breakdown</h2>

                <div className="progress-item">
                    <span>Critical</span>

                    <div className="progress-bar">
                        <div
                            className="progress-fill"
                            style={{
                                width: total
                                    ? `${(critical / total) * 100}%`
                                    : "0%"
                            }}
                        />
                    </div>

                    <span>{critical}</span>
                </div>

                <div className="progress-item">
                    <span>High</span>

                    <div className="progress-bar">
                        <div
                            className="progress-fill"
                            style={{
                                width: total
                                    ? `${(high / total) * 100}%`
                                    : "0%"
                            }}
                        />
                    </div>

                    <span>{high}</span>
                </div>

                <div className="progress-item">
                    <span>Medium</span>

                    <div className="progress-bar">
                        <div
                            className="progress-fill"
                            style={{
                                width: total
                                    ? `${(medium / total) * 100}%`
                                    : "0%"
                            }}
                        />
                    </div>

                    <span>{medium}</span>
                </div>

            </div>

            <div className="analytics-section">

                <h2>Emergency Types</h2>

                {Object.keys(emergencyTypes).length === 0 ? (

                    <p>No emergency data available.</p>

                ) : (

                    <div className="type-list">

                        {Object.entries(emergencyTypes).map(
                            ([type, count]) => (

                                <div
                                    className="type-row"
                                    key={type}
                                >

                                    <span>{type}</span>

                                    <strong>{count}</strong>

                                </div>
                            )
                        )}

                    </div>
                )}

            </div>

        </div>
    );
}

export default Analytics;