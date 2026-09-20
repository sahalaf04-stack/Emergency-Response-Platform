import os
import math
import requests
from pymongo import MongoClient
from dotenv import load_dotenv

load_dotenv()

MONGO_URI = os.getenv("MONGO_URI")

if not MONGO_URI:
    raise Exception("MONGO_URI is missing in .env")

client = MongoClient(MONGO_URI)

db = client["emergency_response"]
services_collection = db["emergency_services"]


# Areas to keep updated
AREAS = [
    {
        "name": "Mangalore",
        "lat": 12.9141,
        "lng": 74.8560
    },
    {
        "name": "Madikeri",
        "lat": 12.4244,
        "lng": 75.7382
    }
]


def update_area(area):

    lat = area["lat"]
    lng = area["lng"]

    radius = 50000

    print(
        f"Updating emergency services near {area['name']}..."
    )

    query = f"""
    [out:json][timeout:60];

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

    servers = [
        "https://overpass-api.de/api/interpreter",
        "https://overpass.private.coffee/api/interpreter",
        "https://overpass.kumi.systems/api/interpreter"
    ]

    for server in servers:

        try:

            print(f"Trying {server}")

            response = requests.post(
                server,
                data={"data": query},
                timeout=90,
                headers={
                    "User-Agent":
                    "EmergencyResponsePlatform/1.0"
                }
            )

            if response.status_code != 200:
                print(
                    f"Server returned {response.status_code}"
                )
                continue

            data = response.json()

            elements = data.get(
                "elements",
                []
            )

            print(
                f"Received {len(elements)} elements"
            )

            services = []

            for element in elements:

                tags = element.get(
                    "tags",
                    {}
                )

                if element.get("type") == "node":

                    service_lat = element.get(
                        "lat"
                    )

                    service_lng = element.get(
                        "lon"
                    )

                else:

                    center = element.get(
                        "center",
                        {}
                    )

                    service_lat = center.get(
                        "lat"
                    )

                    service_lng = center.get(
                        "lon"
                    )

                if (
                    service_lat is None
                    or service_lng is None
                ):
                    continue

                name = (
                    tags.get("name")
                    or tags.get("official_name")
                    or tags.get("short_name")
                )

                # Ignore unnamed locations
                if not name:
                    continue

                # Determine service type
                if (
                    tags.get("amenity") == "hospital"
                    or
                    tags.get("healthcare") == "hospital"
                    or
                    tags.get("healthcare") == "clinic"
                ):
                    service_type = "hospital"

                elif tags.get("amenity") == "police":

                    service_type = "police"

                elif tags.get("amenity") == "fire_station":

                    service_type = "fire_station"

                elif (
                    tags.get("amenity") == "shelter"
                    or
                    tags.get("social_facility") == "shelter"
                ):
                    service_type = "shelter"

                else:
                    continue

                phone = (
                    tags.get("phone")
                    or
                    tags.get("contact:phone")
                    or
                    tags.get("telephone")
                )

                service = {
                    "name": str(name).strip(),
                    "type": service_type,
                    "latitude": float(service_lat),
                    "longitude": float(service_lng),
                    "phone": phone,
                    "source": "OpenStreetMap",
                    "area": area["name"]
                }

                services.append(service)

            # Remove duplicates
            unique = {}

            for service in services:

                key = (
                    service["name"].lower(),
                    round(
                        service["latitude"],
                        5
                    ),
                    round(
                        service["longitude"],
                        5
                    )
                )

                unique[key] = service

            services = list(
                unique.values()
            )

            print(
                f"Found {len(services)} named services "
                f"for {area['name']}"
            )

            # Remove old data for this area
            services_collection.delete_many(
                {
                    "area": area["name"]
                }
            )

            # Insert new data
            if services:

                services_collection.insert_many(
                    services
                )

            print(
                f"MongoDB updated for "
                f"{area['name']}"
            )

            return True

        except Exception as error:

            print(
                f"Error using {server}: {error}"
            )

    print(
        f"Could not update {area['name']}"
    )

    return False


def main():

    print(
        "Starting emergency service update..."
    )

    success_count = 0

    for area in AREAS:

        if update_area(area):

            success_count += 1

    print(
        f"Update finished. "
        f"{success_count}/{len(AREAS)} areas updated."
    )


if __name__ == "__main__":
    main()