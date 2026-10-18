"""
config.py
Centralized configuration for CellTriage Backend.
Loads environment variables from .env file via python-dotenv.
"""

import os
from dotenv import load_dotenv

# Load .env file from the backend directory (parent of app/)
load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), "..", ".env"))


class Settings:
    SUPABASE_URL: str = os.getenv("SUPABASE_URL", "https://yaedtyjcoaubletjpxrt.supabase.co")
    SUPABASE_ANON_KEY: str = os.getenv("SUPABASE_ANON_KEY", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlhZWR0eWpjb2F1YmxldGpweHJ0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTExODU5MjQsImV4cCI6MjEwNjc2MTkyNH0.sjcjxvDUehsrvS8NlGNO-G0yv9VPmmxOfX6Egdwe65c")
    GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY", "")
    GEMINI_MODEL: str = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")


settings = Settings()
