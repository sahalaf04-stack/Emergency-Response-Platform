# Emergency Response & Help Platform

A smart web-based emergency assistance platform designed to help users report emergencies, send SOS alerts, locate nearby emergency services, and allow administrators to monitor and manage incidents in real time.

## Features

### User Features

* User registration and login
* JWT-based authentication
* One-click SOS emergency alert
* Report different types of emergencies
* Share current GPS location
* View submitted emergency reports
* Track emergency report status
* View incidents on an interactive map
* Find nearby hospitals, police stations, fire stations, and shelters
* Get directions to emergency services
* Call available emergency services directly

### Admin Features

* Admin authentication
* Real-time emergency incident monitoring
* SOS alert notifications
* Emergency priority classification
* View critical, high, and medium priority incidents
* Update incident status
* Monitor emergency statistics
* Interactive analytics dashboard
* Incident map visualization

### Smart Features

* Automatic emergency priority calculation
* GPS-based nearby service detection
* Interactive Leaflet map
* Browser emergency notifications
* SOS alert sound
* Distance calculation for nearby services
* Fallback emergency service data when map-service APIs are unavailable

## Tech Stack

### Frontend

* React.js
* Vite
* Axios
* React Leaflet
* Leaflet
* CSS

### Backend

* Python
* FastAPI
* JWT Authentication
* Bcrypt
* Requests

### Database

* MongoDB
* MongoDB Atlas

### Maps & Location

* Leaflet
* OpenStreetMap
* Overpass API
* Browser Geolocation API

## Project Structure

```text
emergency-response/
│
├── backend/
│   ├── main.py
│   ├── requirements.txt
│   └── .env
│
├── frontend/
│   ├── src/
│   │   ├── App.jsx
│   │   ├── Login.jsx
│   │   ├── Map.jsx
│   │   ├── Analytics.jsx
│   │   ├── AnalyticsTest.jsx
│   │   ├── index.css
│   │   └── main.jsx
│   │
│   ├── public/
│   ├── package.json
│   └── vite.config.js
│
├── .gitignore
└── README.md
```

## How It Works

```text
User
  │
  ├── Register / Login
  │
  ├── Report Emergency
  │
  └── Send SOS
          │
          ▼
     React Frontend
          │
          ▼
      FastAPI Backend
          │
     ┌────┴────┐
     ▼         ▼
  MongoDB    Maps APIs
     │         │
     ▼         ▼
 Incidents   Nearby Services
     │
     ▼
 Admin Dashboard
```

## Installation

### 1. Clone the Repository

```bash
git clone https://github.com/sahalaf04-stack/Emergency-Response-Platform.git
```

```bash
cd Emergency-Response-Platform
```

### 2. Backend Setup

Open a terminal inside the project folder:

```bash
cd backend
```

Create a virtual environment:

```bash
python -m venv venv
```

Activate it on Windows:

```powershell
.\venv\Scripts\Activate.ps1
```

Install dependencies:

```bash
pip install -r requirements.txt
```

### 3. Configure Environment Variables

Create a `.env` file inside the `backend` folder:

```env
MONGO_URI=your_mongodb_connection_string
SECRET_KEY=your_secret_key
```

Do not upload the `.env` file to GitHub.

### 4. Start the Backend

From the `backend` folder:

```bash
uvicorn main:app --reload
```

The backend will run at:

```text
http://localhost:8000
```

API documentation is available at:

```text
http://localhost:8000/docs
```

### 5. Frontend Setup

Open another terminal:

```bash
cd frontend
```

Install dependencies:

```bash
npm install
```

Start the development server:

```bash
npm run dev
```

The frontend will normally run at:

```text
http://localhost:5173
```

## API Endpoints

| Method | Endpoint        | Purpose                      |
| ------ | --------------- | ---------------------------- |
| GET    | `/`             | API information              |
| GET    | `/api/health`   | Check API and MongoDB status |
| POST   | `/api/register` | Register a new user          |
| POST   | `/api/login`    | User login                   |
| GET    | `/api/me`       | Get current user             |
| POST   | `/api/inciden   |                              |
