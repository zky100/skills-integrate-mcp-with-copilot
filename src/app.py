"""
High School Management System API

A super simple FastAPI application that allows students to view and sign up
for extracurricular activities at Mergington High School.

New Features:
- Admin mode with teacher authentication
- Activities and teachers stored in JSON files
- Permission-based access control
- Filtering, sorting, and searching capabilities
"""

from fastapi import FastAPI, HTTPException, Query
from fastapi.staticfiles import StaticFiles
from fastapi.responses import RedirectResponse
from pydantic import BaseModel
import os
import json
from pathlib import Path

app = FastAPI(title="Mergington High School API",
              description="API for viewing and signing up for extracurricular activities")

# Mount the static files directory
current_dir = Path(__file__).parent
app.mount("/static", StaticFiles(directory=os.path.join(Path(__file__).parent,
          "static")), name="static")

# File paths
ACTIVITIES_FILE = os.path.join(Path(__file__).parent, "activities.json")
TEACHERS_FILE = os.path.join(Path(__file__).parent, "teachers.json")

# Global variables
activities = {}
teachers = {}

def load_activities():
    """Load activities from JSON file"""
    global activities
    try:
        with open(ACTIVITIES_FILE, 'r') as f:
            data = json.load(f)
            activities = {act["name"]: act for act in data["activities"]}
    except Exception as e:
        print(f"Error loading activities: {e}")
        activities = {}

def load_teachers():
    """Load teachers from JSON file"""
    global teachers
    try:
        with open(TEACHERS_FILE, 'r') as f:
            data = json.load(f)
            teachers = {t["username"]: t["password"] for t in data["teachers"]}
    except Exception as e:
        print(f"Error loading teachers: {e}")
        teachers = {}

def save_activities():
    """Save activities to JSON file"""
    try:
        activities_list = list(activities.values())
        with open(ACTIVITIES_FILE, 'w') as f:
            json.dump({"activities": activities_list}, f, indent=2)
    except Exception as e:
        print(f"Error saving activities: {e}")

# Load data on startup
load_activities()
load_teachers()

# Pydantic models
class LoginRequest(BaseModel):
    username: str
    password: str

class SignupRequest(BaseModel):
    email: str
    is_admin: bool = False
    admin_username: str = None
    admin_password: str = None

class AddActivityRequest(BaseModel):
    name: str
    description: str
    schedule: str
    max_participants: int
    category: str

@app.get("/")
def root():
    return RedirectResponse(url="/static/index.html")

@app.post("/login")
def login(request: LoginRequest):
    """Teacher login endpoint"""
    if request.username in teachers and teachers[request.username] == request.password:
        return {
            "success": True,
            "message": f"Welcome, {request.username}!",
            "username": request.username
        }
    raise HTTPException(status_code=401, detail="Invalid credentials")

def verify_admin(admin_username: str, admin_password: str):
    """Verify admin credentials"""
    if admin_username not in teachers or teachers[admin_username] != admin_password:
        raise HTTPException(status_code=401, detail="Invalid admin credentials")

@app.get("/activities")
def get_activities(category: str = Query(None), search: str = Query(None), sort_by: str = Query("name")):
    """Get activities with optional filtering and sorting"""
    result = list(activities.values())
    
    # Filter by category
    if category and category != "":
        result = [a for a in result if a.get("category") == category]
    
    # Search by name
    if search and search != "":
        search_lower = search.lower()
        result = [a for a in result if search_lower in a["name"].lower() or 
                  search_lower in a["description"].lower()]
    
    # Sort
    if sort_by == "name":
        result = sorted(result, key=lambda x: x["name"])
    elif sort_by == "time":
        result = sorted(result, key=lambda x: x["schedule"])
    
    return result

@app.get("/activities/categories")
def get_categories():
    """Get list of all activity categories"""
    categories = set()
    for activity in activities.values():
        if "category" in activity:
            categories.add(activity["category"])
    return {"categories": sorted(list(categories))}

@app.post("/activities/{activity_name}/signup")
def signup_for_activity(activity_name: str, request: SignupRequest):
    """Sign up a student for an activity (teacher only)"""
    # Verify admin credentials
    if not request.is_admin:
        raise HTTPException(status_code=403, detail="Only teachers can modify registrations")
    
    verify_admin(request.admin_username, request.admin_password)
    
    # Validate activity exists
    if activity_name not in activities:
        raise HTTPException(status_code=404, detail="Activity not found")

    # Get the specific activity
    activity = activities[activity_name]

    # Validate student is not already signed up
    if request.email in activity["participants"]:
        raise HTTPException(
            status_code=400,
            detail="Student is already signed up"
        )
    
    # Check max participants
    if len(activity["participants"]) >= activity["max_participants"]:
        raise HTTPException(
            status_code=400,
            detail=f"Activity is full (max {activity['max_participants']} participants)"
        )

    # Add student
    activity["participants"].append(request.email)
    save_activities()
    return {"message": f"Signed up {request.email} for {activity_name}"}

@app.delete("/activities/{activity_name}/unregister")
def unregister_from_activity(activity_name: str, email: str, admin_username: str = None, admin_password: str = None):
    """Unregister a student from an activity (teacher only)"""
    # Verify admin credentials
    if not admin_username or not admin_password:
        raise HTTPException(status_code=403, detail="Only teachers can modify registrations")
    
    verify_admin(admin_username, admin_password)
    
    # Validate activity exists
    if activity_name not in activities:
        raise HTTPException(status_code=404, detail="Activity not found")

    # Get the specific activity
    activity = activities[activity_name]

    # Validate student is signed up
    if email not in activity["participants"]:
        raise HTTPException(
            status_code=400,
            detail="Student is not signed up for this activity"
        )

    # Remove student
    activity["participants"].remove(email)
    save_activities()
    return {"message": f"Unregistered {email} from {activity_name}"}

@app.post("/activities/add")
def add_activity(request: AddActivityRequest, admin_username: str, admin_password: str):
    """Add a new activity (teacher only)"""
    # Verify admin credentials
    verify_admin(admin_username, admin_password)
    
    # Check if activity already exists
    if request.name in activities:
        raise HTTPException(status_code=400, detail="Activity already exists")
    
    # Create new activity
    new_activity = {
        "name": request.name,
        "description": request.description,
        "schedule": request.schedule,
        "max_participants": request.max_participants,
        "category": request.category,
        "participants": []
    }
    
    activities[request.name] = new_activity
    save_activities()
    return {"message": f"Activity '{request.name}' added successfully", "activity": new_activity}

@app.delete("/activities/delete/{activity_name}")
def delete_activity(activity_name: str, admin_username: str, admin_password: str):
    """Delete an activity (teacher only)"""
    # Verify admin credentials
    verify_admin(admin_username, admin_password)
    
    # Check if activity exists
    if activity_name not in activities:
        raise HTTPException(status_code=404, detail="Activity not found")
    
    del activities[activity_name]
    save_activities()
    return {"message": f"Activity '{activity_name}' deleted successfully"}
