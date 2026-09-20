
import os
import certifi
from pymongo import MongoClient
from dotenv import load_dotenv

load_dotenv()

uri = os.getenv("MONGO_URI")

print("MongoDB URI loaded:", bool(uri))

try:
    client = MongoClient(
        uri,
        tls=True,
        tlsCAFile=certifi.where(),
        serverSelectionTimeoutMS=10000
    )

    client.admin.command("ping")

    print("✅ MongoDB connection successful!")

except Exception as e:
    print("❌ MongoDB connection failed:")
    print(e)