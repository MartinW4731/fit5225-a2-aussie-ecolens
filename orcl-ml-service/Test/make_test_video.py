import cv2
from pathlib import Path

IMAGE_PATH = "test.JPG"

OUTPUT_VIDEO = "test.mp4"

FPS = 1
DURATION_SECONDS = 5

img_path = Path(IMAGE_PATH)

if not img_path.exists():
    raise FileNotFoundError(f"Image not found: {IMAGE_PATH}")

image = cv2.imread(str(img_path))

if image is None:
    raise ValueError(f"Cannot read image: {IMAGE_PATH}")

height, width, _ = image.shape

fourcc = cv2.VideoWriter_fourcc(*"mp4v")
writer = cv2.VideoWriter(OUTPUT_VIDEO, fourcc, FPS, (width, height))

for _ in range(FPS * DURATION_SECONDS):
    writer.write(image)

writer.release()

print(f"Created video: {OUTPUT_VIDEO}")