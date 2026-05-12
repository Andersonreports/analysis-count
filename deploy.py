import requests
import base64
import os
import json

TOKEN = os.environ.get("GITHUB_TOKEN")
REPO_NAME = "analysis-count"
FILES = ["index.html", "data.json", "extract_data.py", "read_excel.py"]

if not TOKEN:
    raise RuntimeError("Set GITHUB_TOKEN before running deploy.py")

headers = {
    "Authorization": f"token {TOKEN}",
    "Accept": "application/vnd.github.v3+json"
}

def get_user():
    r = requests.get("https://api.github.com/user", headers=headers)
    r.raise_for_status()
    return r.json()["login"]

def create_repo():
    print(f"Creating repository {REPO_NAME}...")
    r = requests.post("https://api.github.com/user/repos", headers=headers, json={
        "name": REPO_NAME,
        "description": "Sample Analysis Count Dashboard",
        "auto_init": True
    })
    if r.status_code == 201:
        print("Repository created successfully.")
    elif r.status_code == 422:
        print("Repository already exists.")
    else:
        r.raise_for_status()

def upload_file(user, filename):
    print(f"Uploading {filename}...")
    with open(filename, "rb") as f:
        content = base64.b64encode(f.read()).decode("utf-8")
    
    # Check if file exists to get SHA
    url = f"https://api.github.com/repos/{user}/{REPO_NAME}/contents/{filename}"
    r = requests.get(url, headers=headers)
    sha = None
    if r.status_code == 200:
        sha = r.json()["sha"]
    
    data = {
        "message": f"Upload {filename}",
        "content": content
    }
    if sha:
        data["sha"] = sha
        
    r = requests.put(url, headers=headers, json=data)
    r.raise_for_status()
    print(f"{filename} uploaded successfully.")

def enable_pages(user):
    print("Enabling GitHub Pages...")
    url = f"https://api.github.com/repos/{user}/{REPO_NAME}/pages"
    r = requests.post(url, headers=headers, json={
        "source": {
            "branch": "main",
            "path": "/"
        }
    })
    if r.status_code == 201:
        print("GitHub Pages enabled.")
    elif r.status_code == 409:
        print("GitHub Pages already enabled or conflict.")
    else:
        print(f"Pages status: {r.status_code} - {r.text}")

try:
    user = get_user()
    print(f"Logged in as: {user}")
    create_repo()
    for f in FILES:
        if os.path.exists(f):
            upload_file(user, f)
        else:
            print(f"Skipping {f} (file not found)")
    enable_pages(user)
    print(f"Deployment complete! Your site will be live at: https://{user}.github.io/{REPO_NAME}/")
except Exception as e:
    print(f"Error: {e}")
