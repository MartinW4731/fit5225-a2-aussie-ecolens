#!/usr/bin/env python3
"""
Test script for /annotate image endpoint.
"""
import base64
import json
import requests
from pathlib import Path
from PIL import Image
import io

# Create a test image (simple 100x100 RGB image)
def create_test_image(filename="/tmp/test_image.jpg"):
    img = Image.new("RGB", (100, 100), color="red")
    img.save(filename)
    return filename

# Convert image to base64
def image_to_base64(image_path):
    with open(image_path, "rb") as img_file:
        return base64.b64encode(img_file.read()).decode("utf-8")

# Test /annotate endpoint
def test_annotate_image():
    # Create test image
    image_path = create_test_image()
    image_b64 = image_to_base64(image_path)
    
    # Prepare request
    payload = {
        "file_name": "test.jpg",
        "file_type": "image",
        "image_base64": image_b64
    }
    
    # Send request
    response = requests.post(
        "http://localhost:8080/annotate",
        json=payload,
        headers={"Content-Type": "application/json"}
    )
    
    print(f"Status Code: {response.status_code}")
    result = response.json()
    
    # Save annotated image if present
    if "annotated_image_base64" in result:
        annotated_img_b64 = result["annotated_image_base64"]
        annotated_img_bytes = base64.b64decode(annotated_img_b64)
        with open("/tmp/annotated_image.jpg", "wb") as f:
            f.write(annotated_img_bytes)
        print("✓ Annotated image saved to /tmp/annotated_image.jpg")
    
    print(f"Tags: {result.get('tags')}")
    print(f"Confidence: {result.get('confidence')}")
    print(f"Source: {result.get('source')}")

if __name__ == "__main__":
    test_annotate_image()
