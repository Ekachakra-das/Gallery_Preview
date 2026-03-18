import json
import urllib.request

req = urllib.request.Request("http://localhost:7788/api/folders")
with urllib.request.urlopen(req) as response:
    data = json.loads(response.read().decode())
    print([f for f in data["folders"] if f["path"] == ""])
