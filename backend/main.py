
from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

from pydantic import BaseModel, EmailStr
from pymongo import MongoClient
from bson import ObjectId

from jose import jwt, JWTError
from datetime import datetime, timedelta, timezone

import bcrypt
import requests
import math
import os

from dotenv import load_dotenv


# ============================================================
# LOAD ENVIRONMENT VARIABLES
# ============================================================

load_dotenv()

MONGO_URI = os.getenv(
    "MONGO_URI",
    "mongodb://localhost:27017"
)

SECRET_KEY = os.getenv(
    "SECRET_KEY",
    "SahalaEmergencyApp_2026_X7k92Lm"
)

ALGORITHM = "HS256"

ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24


# ============================================================
# FASTAPI APP
# ============================================================

app = FastAPI(
    title="Emergency Response API",
    version="2.0"
)


# ============================================================
# CORS
# ============================================================

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "https://emergency-response-platform-two.vercel.app",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ============================================================
# MONGODB
# ============================================================

try:

    client = MongoClient(
        MONGO_URI,
        serverSelectionTimeoutMS=5000
    )

    db = client["emergency_response"]

    users_collection = db["users"]
    incidents_collection = db["incidents"]

    client.admin.command("ping")

    print("MongoDB connected successfully.")

except Exception as error:

    print(
        "MongoDB connection failed:",
        error
    )

    client = None
    db = None
    users_collection = None
    incidents_collection = None


# ============================================================
# PYDANTIC MODELS
# ============================================================

class RegisterUser(BaseModel):

    name: str
    email: EmailStr
    password: str


class LoginUser(BaseModel):

    email: EmailStr
    password: str


class Incident(BaseModel):

    name: str
    phone: str = ""
    emergency_type: str
    description: str
    latitude: float
    longitude: float


class SOSRequest(BaseModel):

    name: str
    phone: str = ""
    latitude: float
    longitude: float


# ============================================================
# DATABASE CHECK
# ============================================================

def check_database():

    if (
        users_collection is None
        or incidents_collection is None
    ):

        raise HTTPException(
            status_code=500,
            detail="MongoDB is not connected."
        )


# ============================================================
# PASSWORD FUNCTIONS
# ============================================================

def hash_password(password: str) -> str:

    password_bytes = password.encode("utf-8")

    if len(password_bytes) > 72:

        raise HTTPException(
            status_code=400,
            detail="Password cannot be longer than 72 bytes."
        )

    hashed = bcrypt.hashpw(
        password_bytes,
        bcrypt.gensalt()
    )

    return hashed.decode("utf-8")


def verify_password(
    password: str,
    hashed_password: str
) -> bool:

    try:

        password_bytes = password.encode("utf-8")
        hashed_bytes = hashed_password.encode("utf-8")

        return bcrypt.checkpw(
            password_bytes,
            hashed_bytes
        )

    except Exception:

        return False


# ============================================================
# JWT FUNCTIONS
# ============================================================

def create_access_token(data: dict):

    to_encode = data.copy()

    expire = (
        datetime.now(timezone.utc)
        + timedelta(
            minutes=ACCESS_TOKEN_EXPIRE_MINUTES
        )
    )

    to_encode.update({
        "exp": expire
    })

    token = jwt.encode(
        to_encode,
        SECRET_KEY,
        algorithm=ALGORITHM
    )

    return token


# ============================================================
# TOKEN AUTHENTICATION
# ============================================================

security = HTTPBearer()


def authenticate_user(
    credentials: HTTPAuthorizationCredentials = Depends(
        security
    )
):

    token = credentials.credentials

    try:

        payload = jwt.decode(
            token,
            SECRET_KEY,
            algorithms=[ALGORITHM]
        )

        user_id = payload.get("user_id")

        if user_id is None:

            raise HTTPException(
                status_code=401,
                detail="Invalid authentication token."
            )

        check_database()

        user = users_collection.find_one({
            "_id": ObjectId(user_id)
        })

        if user is None:

            raise HTTPException(
                status_code=401,
                detail="User not found."
            )

        return user

    except JWTError:

        raise HTTPException(
            status_code=401,
            detail="Invalid or expired token."
        )

    except HTTPException:

        raise

    except Exception:

        raise HTTPException(
            status_code=401,
            detail="Invalid authentication token."
        )


# ============================================================
# PRIORITY CALCULATION
# ============================================================

def calculate_priority(
    emergency_type: str,
    description: str
):

    emergency_type = emergency_type.lower()
    description = description.lower()

    critical_types = [
        "medical",
        "fire",
        "accident",
        "crime",
        "sos"
    ]

    high_keywords = [
        "bleeding",
        "unconscious",
        "heart attack",
        "stroke",
        "fire",
        "accident",
        "trapped",
        "danger",
        "attack",
        "injured",
        "critical"
    ]

    if emergency_type == "sos":

        return "Critical"

    if emergency_type in critical_types:

        return "Critical"

    for keyword in high_keywords:

        if keyword in description:

            return "High"

    return "Medium"


# ============================================================
# DISTANCE CALCULATION
# ============================================================

def calculate_distance(
    lat1: float,
    lon1: float,
    lat2: float,
    lon2: float
):

    R = 6371.0

    lat1_rad = math.radians(lat1)
    lat2_rad = math.radians(lat2)

    difference_lat = math.radians(
        lat2 - lat1
    )

    difference_lon = math.radians(
        lon2 - lon1
    )

    a = (
        math.sin(difference_lat / 2) ** 2
        +
        math.cos(lat1_rad)
        *
        math.cos(lat2_rad)
        *
        math.sin(difference_lon / 2) ** 2
    )

    c = 2 * math.atan2(
        math.sqrt(a),
        math.sqrt(1 - a)
    )

    return R * c


# ============================================================
# ROOT
# ============================================================

@app.get("/")
def root():

    return {
        "message": "Emergency Response API is running",
        "version": "2.0"
    }


# ============================================================
# HEALTH CHECK
# ============================================================

@app.get("/api/health")
def health_check():

    mongo_status = "Disconnected"

    if client is not None:

        try:

            client.admin.command("ping")

            mongo_status = "Connected"

        except Exception:

            mongo_status = "Disconnected"

    return {
        "api": "Running",
        "mongodb": mongo_status
    }


# ============================================================
# REGISTER
# ============================================================

@app.post("/api/register")
def register_user(
    user: RegisterUser
):

    check_database()

    existing_user = users_collection.find_one({
        "email": user.email.lower()
    })

    if existing_user:

        raise HTTPException(
            status_code=400,
            detail="Email already registered."
        )

    hashed_password = hash_password(
        user.password
    )

    new_user = {

        "name": user.name,

        "email": user.email.lower(),

        "password": hashed_password,

        "role": "user",

        "created_at": datetime.now(
            timezone.utc
        )
    }

    result = users_collection.insert_one(
        new_user
    )

    return {

        "message": "Registration successful",

        "user": {

            "id": str(
                result.inserted_id
            ),

            "name": user.name,

            "email": user.email.lower(),

            "role": "user"
        }
    }


# ============================================================
# LOGIN
# ============================================================

@app.post("/api/login")
def login_user(
    user: LoginUser
):

    check_database()

    existing_user = users_collection.find_one({
        "email": user.email.lower()
    })

    if not existing_user:

        raise HTTPException(
            status_code=401,
            detail="Invalid email or password."
        )

    password_valid = verify_password(
        user.password,
        existing_user["password"]
    )

    if not password_valid:

        raise HTTPException(
            status_code=401,
            detail="Invalid email or password."
        )

    token = create_access_token({

        "user_id": str(
            existing_user["_id"]
        ),

        "email": existing_user["email"],

        "role": existing_user.get(
            "role",
            "user"
        )
    })

    return {

        "message": "Login successful",

        "token": token,

        "user": {

            "id": str(
                existing_user["_id"]
            ),

            "name": existing_user["name"],

            "email": existing_user["email"],

            "role": existing_user.get(
                "role",
                "user"
            )
        }
    }


# ============================================================
# CURRENT USER
# ============================================================

@app.get("/api/me")
def get_me(
    current_user=Depends(authenticate_user)
):

    return {

        "id": str(
            current_user["_id"]
        ),

        "name": current_user["name"],

        "email": current_user["email"],

        "role": current_user.get(
            "role",
            "user"
        )
    }


# ============================================================
# REPORT EMERGENCY
# ============================================================

@app.post("/api/incidents")
def create_incident(
    incident: Incident,
    current_user=Depends(authenticate_user)
):

    check_database()

    priority = calculate_priority(
        incident.emergency_type,
        incident.description
    )

    new_incident = {

        "user_id": str(
            current_user["_id"]
        ),

        "name": incident.name,

        "phone": incident.phone,

        "emergency_type": incident.emergency_type,

        "description": incident.description,

        "latitude": incident.latitude,

        "longitude": incident.longitude,

        "priority": priority,

        "status": "Reported",

        "is_sos": False,

        "created_at": datetime.now(
            timezone.utc
        )
    }

    result = incidents_collection.insert_one(
        new_incident
    )

    return {

        "message":
            "Emergency reported successfully",

        "incident": {

            "id": str(
                result.inserted_id
            ),

            "name": incident.name,

            "emergency_type":
                incident.emergency_type,

            "priority": priority,

            "status": "Reported",

            "latitude":
                incident.latitude,

            "longitude":
                incident.longitude
        }
    }


# ============================================================
# SOS
# ============================================================

@app.post("/api/incidents/sos")
def activate_sos(
    sos: SOSRequest,
    current_user=Depends(authenticate_user)
):

    check_database()

    new_sos = {

        "user_id": str(
            current_user["_id"]
        ),

        "name": sos.name,

        "phone": sos.phone,

        "emergency_type": "SOS",

        "description":
            "Emergency SOS activated",

        "latitude": sos.latitude,

        "longitude": sos.longitude,

        "priority": "Critical",

        "status": "Reported",

        "is_sos": True,

        "created_at": datetime.now(
            timezone.utc
        )
    }

    result = incidents_collection.insert_one(
        new_sos
    )

    return {

        "message":
            "SOS activated successfully",

        "incident": {

            "id": str(
                result.inserted_id
            ),

            "name": sos.name,

            "phone": sos.phone,

            "emergency_type": "SOS",

            "priority": "Critical",

            "status": "Reported",

            "latitude": sos.latitude,

            "longitude": sos.longitude,

            "is_sos": True
        }
    }


# ============================================================
# GET INCIDENTS
# ============================================================

@app.get("/api/incidents")
def get_incidents(
    current_user=Depends(authenticate_user)
):

    check_database()

    user_role = current_user.get(
        "role",
        "user"
    )

    if user_role == "admin":

        incidents = list(
            incidents_collection
            .find()
            .sort(
                "created_at",
                -1
            )
        )

    else:

        incidents = list(
            incidents_collection
            .find({
                "user_id": str(
                    current_user["_id"]
                )
            })
            .sort(
                "created_at",
                -1
            )
        )

    result = []

    for incident in incidents:

        result.append({

            "id": str(
                incident["_id"]
            ),

            "user_id": incident.get(
                "user_id"
            ),

            "name": incident.get(
                "name",
                ""
            ),

            "phone": incident.get(
                "phone",
                ""
            ),

            "emergency_type":
                incident.get(
                    "emergency_type",
                    ""
                ),

            "description":
                incident.get(
                    "description",
                    ""
                ),

            "latitude":
                incident.get(
                    "latitude"
                ),

            "longitude":
                incident.get(
                    "longitude"
                ),

            "priority":
                incident.get(
                    "priority",
                    "Medium"
                ),

            "status":
                incident.get(
                    "status",
                    "Reported"
                ),

            "is_sos":
                incident.get(
                    "is_sos",
                    False
                ),

            "created_at":
                incident.get(
                    "created_at"
                )
        })

    return result


# ============================================================
# UPDATE INCIDENT STATUS
# ADMIN ONLY
# ============================================================

@app.put("/api/incidents/{incident_id}")
def update_incident_status(
    incident_id: str,
    status: str,
    current_user=Depends(authenticate_user)
):

    check_database()

    if current_user.get("role") != "admin":

        raise HTTPException(
            status_code=403,
            detail="Admin access required."
        )

    allowed_statuses = [
        "Reported",
        "Assigned",
        "In Progress",
        "Resolved"
    ]

    if status not in allowed_statuses:

        raise HTTPException(
            status_code=400,
            detail="Invalid status."
        )

    try:

        result = incidents_collection.update_one(

            {
                "_id": ObjectId(
                    incident_id
                )
            },

            {
                "$set": {

                    "status": status,

                    "updated_at":
                        datetime.now(
                            timezone.utc
                        )
                }
            }
        )

    except Exception:

        raise HTTPException(
            status_code=400,
            detail="Invalid incident ID."
        )

    if result.matched_count == 0:

        raise HTTPException(
            status_code=404,
            detail="Incident not found."
        )

    return {

        "message":
            "Incident status updated",

        "status": status
    }


# ============================================================
# MAP INCIDENTS
# ============================================================

@app.get("/api/map-incidents")
def get_map_incidents(
    current_user=Depends(authenticate_user)
):

    check_database()

    user_role = current_user.get(
        "role",
        "user"
    )

    query = {

        "status": {
            "$ne": "Resolved"
        }
    }

    if user_role != "admin":

        query["user_id"] = str(
            current_user["_id"]
        )

    incidents = list(
        incidents_collection.find(query)
    )

    result = []

    for incident in incidents:

        result.append({

            "id": str(
                incident["_id"]
            ),

            "name": incident.get(
                "name",
                ""
            ),

            "emergency_type":
                incident.get(
                    "emergency_type",
                    ""
                ),

            "priority":
                incident.get(
                    "priority",
                    "Medium"
                ),

            "status":
                incident.get(
                    "status",
                    "Reported"
                ),

            "latitude":
                incident.get(
                    "latitude"
                ),

            "longitude":
                incident.get(
                    "longitude"
                ),

            "is_sos":
                incident.get(
                    "is_sos",
                    False
                )
        })

    return result


# ============================================================
# NEARBY EMERGENCY SERVICES
# ============================================================

@app.get("/api/nearby")
def get_nearby_services(
    lat: float,
    lng: float
):

    print(
        f"Searching emergency services near "
        f"latitude={lat}, longitude={lng}"
    )

    # --------------------------------------------------------
    # Validate GPS coordinates
    # --------------------------------------------------------

    if not (
        -90 <= lat <= 90
        and
        -180 <= lng <= 180
    ):

        raise HTTPException(
            status_code=400,
            detail="Invalid latitude or longitude."
        )

    # --------------------------------------------------------
    # Search radius
    # --------------------------------------------------------

    radius = 15000

    # --------------------------------------------------------
    # OpenStreetMap / Overpass query
    #
    # Search for actual emergency services.
    # --------------------------------------------------------

    overpass_query = f"""
    [out:json][timeout:40];

    (
      nwr["amenity"="hospital"](around:{radius},{lat},{lng});
      nwr["healthcare"="hospital"](around:{radius},{lat},{lng});
      nwr["healthcare"="clinic"](around:{radius},{lat},{lng});

      nwr["amenity"="police"](around:{radius},{lat},{lng});

      nwr["amenity"="fire_station"](around:{radius},{lat},{lng});

      nwr["amenity"="shelter"](around:{radius},{lat},{lng});
      nwr["social_facility"="shelter"](around:{radius},{lat},{lng});
    );

    out center tags;
    """

    # --------------------------------------------------------
    # Multiple Overpass servers
    # --------------------------------------------------------

    servers = [

        "https://overpass.kumi.systems/api/interpreter",

        "https://overpass-api.de/api/interpreter",

        "https://overpass.private.coffee/api/interpreter"
    ]

    # --------------------------------------------------------
    # Try each server
    # --------------------------------------------------------

    for server in servers:

        try:

            print(
                f"Trying Overpass server: {server}"
            )

            response = requests.post(

                server,

                data={
                    "data": overpass_query
                },

                timeout=45,

                headers={
                    "User-Agent":
                        "EmergencyResponseApp/1.0"
                }
            )

            print(
                f"Overpass status: "
                f"{response.status_code}"
            )

            # Try next server if request failed
            if response.status_code != 200:

                print(
                    "Overpass response:",
                    response.text[:500]
                )

                continue

            data = response.json()

            elements = data.get(
                "elements",
                []
            )

            print(
                f"Elements received: "
                f"{len(elements)}"
            )

            places = []

            # ------------------------------------------------
            # Process OpenStreetMap elements
            # ------------------------------------------------

            for element in elements:

                tags = element.get(
                    "tags",
                    {}
                )

                # --------------------------------------------
                # Get coordinates
                # --------------------------------------------

                if element.get("type") == "node":

                    element_lat = element.get(
                        "lat"
                    )

                    element_lng = element.get(
                        "lon"
                    )

                else:

                    center = element.get(
                        "center",
                        {}
                    )

                    element_lat = center.get(
                        "lat"
                    )

                    element_lng = center.get(
                        "lon"
                    )

                # Skip if coordinates are missing
                if (
                    element_lat is None
                    or
                    element_lng is None
                ):

                    continue

                # --------------------------------------------
                # Get actual OSM name
                # --------------------------------------------

                name = (
                    tags.get("name")
                    or
                    tags.get("official_name")
                    or
                    tags.get("short_name")
                )

                # IMPORTANT:
                # Do not display fake names.
                # Skip unnamed places.
                if not name:

                    continue

                # --------------------------------------------
                # Determine service type
                # --------------------------------------------

                if (
                    tags.get("amenity")
                    == "hospital"
                    or
                    tags.get("healthcare")
                    == "hospital"
                    or
                    tags.get("healthcare")
                    == "clinic"
                ):

                    service_type = "hospital"

                elif tags.get("amenity") == "police":

                    service_type = "police"

                elif tags.get("amenity") == "fire_station":

                    service_type = "fire_station"

                elif (
                    tags.get("amenity")
                    == "shelter"
                    or
                    tags.get("social_facility")
                    == "shelter"
                ):

                    service_type = "shelter"

                else:

                    continue

                # --------------------------------------------
                # Phone number
                # --------------------------------------------

                phone = (
                    tags.get("phone")
                    or
                    tags.get("contact:phone")
                    or
                    tags.get("telephone")
                )

                # --------------------------------------------
                # Calculate distance
                # --------------------------------------------

                distance = calculate_distance(

                    lat,

                    lng,

                    float(element_lat),

                    float(element_lng)
                )

                places.append({

                    "name": str(name),

                    "type": service_type,

                    "latitude":
                        float(element_lat),

                    "longitude":
                        float(element_lng),

                    "distance":
                        round(
                            distance,
                            2
                        ),

                    "phone": phone
                })

            # ------------------------------------------------
            # Remove duplicate places
            # ------------------------------------------------

            unique_places = {}

            for place in places:

                key = (
                    place["name"].strip().lower(),
                    round(place["latitude"], 5),
                    round(place["longitude"], 5)
                )

                if key not in unique_places:

                    unique_places[key] = place

            places = list(
                unique_places.values()
            )

            # ------------------------------------------------
            # Sort by distance
            # ------------------------------------------------

            places.sort(
                key=lambda x: x["distance"]
            )

            print(
                f"Found "
                f"{len(places)} named emergency "
                f"services."
            )

            # ------------------------------------------------
            # Return real places only
            # ------------------------------------------------

            return places[:50]

        except requests.exceptions.Timeout:

            print(
                f"Timeout from Overpass server: "
                f"{server}"
            )

            continue

        except requests.exceptions.RequestException as error:

            print(
                f"Request error from "
                f"{server}: {error}"
            )

            continue

        except ValueError as error:

            print(
                f"Invalid JSON from "
                f"{server}: {error}"
            )

            continue

        except Exception as error:

            print(
                f"Overpass error from "
                f"{server}: {error}"
            )

            continue

    # --------------------------------------------------------
    # IMPORTANT:
    # Do NOT return fake emergency locations.
    # --------------------------------------------------------

    print(
        "All Overpass servers failed."
    )

    raise HTTPException(
        status_code=503,
        detail=(
            "Nearby emergency services are "
            "temporarily unavailable. "
            "Please try again."
        )
    )


# ============================================================
# STARTUP
# ============================================================

@app.on_event("startup")
def startup_event():

    print("----------------------------------------")
    print(" Emergency Response API")
    print(" FastAPI server starting...")
    print("----------------------------------------")

    if client is not None:

        try:

            client.admin.command("ping")

            print(
                "MongoDB connected successfully."
            )

        except Exception as error:

            print(
                "MongoDB connection error:",
                error
            )

    else:

        print(
            "MongoDB is not available."
        )

    print(
        "API running on "
        "http://127.0.0.1:8000"
    )

    print(
        "Swagger docs: "
        "http://127.0.0.1:8000/docs"
    )

    print("----------------------------------------")
