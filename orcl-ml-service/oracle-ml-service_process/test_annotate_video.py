#!/usr/bin/env python3
"""
Test script for /annotate video endpoint.
"""
import base64
import json
import requests
from pathlib import Path
import cv2
import numpy as np

# Create a simple test video
def create_test_video(filename="/tmp/test_video.mp4", duration_secs=2, fps=1):
    """Create a simple test video with colored frames."""
    width, height = 100, 100
    fourcc = cv2.VideoWriter_fourcc(*"mp4v")
    writer = cv2.VideoWriter(filename, fourcc, fps, (width, height))
    
    # Write frames with different colors
    colors = [(0, 0, 255), (0, 255, 0), (255, 0, 0)]  # BGR
    for i in range(duration_secs * fps):
        frame = np.ones((height, width, 3), dtype=np.uint8)
        frame[:] = colors[i % len(colors)]
        writer.write(frame)
    
    writer.release()
    return filename

# Convert video to base64
def video_to_base64(video_path):
    with open(video_path, "rb") as vid_file:
        return base64.b64encode(vid_file.read()).decode("utf-8")

# Test /annotate endpoint for video
def test_annotate_video():
    # Create test video
    video_path = create_test_video()
    video_b64 = video_to_base64(video_path)
    
    # Prepare request
    payload = {
        "file_name": "test.mp4",
        "file_type": "video",
        "video_base64": video_b64
    }
    
    # Send request
    response = requests.post(
        "http://localhost:8080/annotate",
        json=payload,
        headers={"Content-Type": "application/json"}
    )
    
    print(f"Status Code: {response.status_code}")
    result = response.json()
    
    # Save annotated frames if present
    if "annotated_frames_base64" in result:
        frames_b64_list = result["annotated_frames_base64"]
        for idx, frame_b64 in enumerate(frames_b64_list):
            frame_bytes = base64.b64decode(frame_b64)
            with open(f"/tmp/annotated_frame_{idx}.jpg", "wb") as f:
                f.write(frame_bytes)
        print(f"✓ {len(frames_b64_list)} annotated frames saved to /tmp/annotated_frame_*.jpg")
    
    print(f"Tags: {result.get('tags')}")
    print(f"Confidence: {result.get('confidence')}")
    print(f"Frames Processed: {result.get('frames_processed')}")
    print(f"Source: {result.get('source')}")

if __name__ == "__main__":
    test_annotate_video()
