import base64
import json
from pathlib import Path

VIDEO_FILE = "test.mp4"

OUTPUT_JSON = "video_test.json"

video_path = Path(VIDEO_FILE)

if not video_path.exists():
    raise FileNotFoundError(f"Video file not found: {VIDEO_FILE}")

with video_path.open("rb") as f:
    video_base64 = base64.b64encode(f.read()).decode("utf-8")

payload = {
    "file_name": video_path.name,
    "file_type": "video",
    "video_base64": video_base64
}

with open(OUTPUT_JSON, "w", encoding="utf-8") as f:
    json.dump(payload, f)

print(f"Created {OUTPUT_JSON}")
print(f"Video file: {VIDEO_FILE}")
print(f"Base64 length: {len(video_base64)}")