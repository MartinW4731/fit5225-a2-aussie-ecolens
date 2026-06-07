import base64
import io
import os
from pathlib import Path
from typing import Dict, List, Tuple

import numpy as np
import torch
import torchvision.transforms as transforms
import yaml
import cv2
from PIL import Image
from megadetector.detection import run_detector_batch


SERVICE_DIR = Path(__file__).resolve().parent
CONFIG_PATH = SERVICE_DIR / "config.yaml"
LABELS_PATH = SERVICE_DIR / "labels.txt"
DETECTOR_PATH = SERVICE_DIR / "mdv5a.pt"
MODEL_PATH = SERVICE_DIR / "model.pt"
DEFAULT_SOURCE = "Oracle ML detection"


def load_yaml(path: Path) -> Dict:
    if not path.exists():
        return {}
    with open(path, "r", encoding="utf-8") as handle:
        return yaml.safe_load(handle) or {}


def load_labels(path: Path) -> List[str]:
    labels = []
    if not path.exists():
        return labels

    with open(path, "r", encoding="utf-8") as handle:
        for line in handle:
            line = line.strip()
            if not line:
                continue
            parts = [part.strip() for part in line.split(";")]
            if len(parts) < 6:
                continue
            genus = parts[4]
            species = parts[5]
            if genus and species:
                labels.append(f"{genus}_{species}")
            elif genus:
                labels.append(genus)
    return labels


def load_models() -> Dict:
    config = load_yaml(CONFIG_PATH)

    device = "cuda" if torch.cuda.is_available() else "mps" if torch.backends.mps.is_available() else "cpu"
    model = torch.load(MODEL_PATH, map_location=device, weights_only=False)
    model.to(device)
    model.eval()

    labels = load_labels(LABELS_PATH)
    if not labels:
        raise ValueError("labels.txt is missing or empty")

    transform = transforms.Compose([
        transforms.Resize((480, 480)),
        transforms.ToTensor(),
    ])

    return {
        "config": config,
        "device": device,
        "model": model,
        "labels": labels,
        "transform": transform,
    }


def normalize_base64(image_base64: str) -> str:
    if not isinstance(image_base64, str):
        raise ValueError("image_base64 must be a base64-encoded string")
    if image_base64.startswith("data:"):
        image_base64 = image_base64.split(",", 1)[1]
    return image_base64.strip()


def decode_base64_image(image_base64: str, output_path: Path) -> Path:
    image_base64 = normalize_base64(image_base64)
    try:
        image_bytes = base64.b64decode(image_base64)
    except Exception as exc:
        raise ValueError("image_base64 is not valid base64") from exc

    output_path.parent.mkdir(parents=True, exist_ok=True)
    with open(output_path, "wb") as handle:
        handle.write(image_bytes)
    return output_path


def is_animal_detection(detection: Dict) -> bool:
    category = detection.get("category")
    try:
        return int(category) == 1
    except Exception:
        return False


def run_megadetector(image_path: Path) -> List[Dict]:
    results = run_detector_batch.load_and_run_detector_batch(
        image_file_names=[str(image_path)],
        model_file=str(DETECTOR_PATH),
    )
    if not results:
        return []
    return results[0].get("detections", [])


def crop_detections(image: Image.Image, detections: List[Dict], threshold: float) -> List[Image.Image]:
    crops: List[Image.Image] = []
    width, height = image.size

    for detection in detections:
        if not is_animal_detection(detection):
            continue

        confidence = float(detection.get("conf", 0.0))
        if confidence < threshold:
            continue

        bbox = detection.get("bbox")
        if not bbox or len(bbox) != 4:
            continue

        x, y, w, h = bbox
        left = max(0, int(x * width))
        top = max(0, int(y * height))
        right = min(width, int((x + w) * width))
        bottom = min(height, int((y + h) * height))

        if right <= left or bottom <= top:
            continue

        crop = image.crop((left, top, right, bottom)).convert("RGB")
        crops.append(crop)

    return crops


def classify_crop(
    crop_image: Image.Image,
    species_model: torch.nn.Module,
    labels: List[str],
    transform: transforms.Compose,
    device: str,
) -> Tuple[str, float]:
    tensor = transform(crop_image)
    tensor = tensor.unsqueeze(0).permute(0, 2, 3, 1)
    tensor = tensor.to(device)

    with torch.no_grad():
        logits = species_model(tensor)
        probs = torch.softmax(logits, dim=1)[0]

    best_index = int(torch.argmax(probs).item())
    if best_index < 0 or best_index >= len(labels):
        raise ValueError("Model output index is outside label range")

    return labels[best_index], float(probs[best_index].item())


def aggregate_predictions(predictions: List[Tuple[str, float]]) -> Tuple[Dict[str, int], Dict[str, float]]:
    if not predictions:
        return {"no_animal_detected": 0}, {"no_animal_detected": 0.0}

    tags: Dict[str, int] = {}
    confidence: Dict[str, float] = {}
    for species, score in predictions:
        tags[species] = tags.get(species, 0) + 1
        confidence[species] = max(confidence.get(species, 0.0), score)

    return tags, confidence


def process_video_path(video_path: Path, pipeline: Dict) -> Tuple[Dict[str, int], Dict[str, float], int]:
    if not video_path.exists():
        raise ValueError("video file does not exist")

    capture = cv2.VideoCapture(str(video_path))
    if not capture.isOpened():
        capture.release()
        raise ValueError("video cannot be opened")

    fps = capture.get(cv2.CAP_PROP_FPS) or 0.0
    frame_interval = int(fps) if fps and fps > 0 else 1
    if frame_interval < 1:
        frame_interval = 1

    frame_number = 0
    processed_frames = 0
    aggregate_tags: Dict[str, int] = {}
    aggregate_confidence: Dict[str, float] = {}

    try:
        while True:
            ret, frame = capture.read()
            if not ret:
                break

            if frame_number % frame_interval == 0:
                frame_path = Path(f"/tmp/frame_{processed_frames}.jpg")
                image = Image.fromarray(cv2.cvtColor(frame, cv2.COLOR_BGR2RGB))
                image.save(frame_path)
                try:
                    tags, confidence = process_image_path(frame_path, pipeline)
                finally:
                    try:
                        if frame_path.exists():
                            frame_path.unlink()
                    except OSError:
                        pass

                if not (tags == {"no_animal_detected": 0} and confidence == {"no_animal_detected": 0.0}):
                    for species, count in tags.items():
                        aggregate_tags[species] = aggregate_tags.get(species, 0) + count
                    for species, score in confidence.items():
                        aggregate_confidence[species] = max(aggregate_confidence.get(species, 0.0), score)

                processed_frames += 1

            frame_number += 1
    finally:
        capture.release()

    if processed_frames == 0:
        return {"no_frame_processed": 0}, {"no_frame_processed": 0.0}, 0
    if not aggregate_tags:
        return {"no_animal_detected": 0}, {"no_animal_detected": 0.0}, processed_frames

    return aggregate_tags, aggregate_confidence, processed_frames


def process_image_path(image_path: Path, pipeline: Dict) -> Tuple[Dict[str, int], Dict[str, float]]:
    config = pipeline.get("config", {})
    detections = run_megadetector(image_path)
    if not detections:
        return {"no_animal_detected": 0}, {"no_animal_detected": 0.0}

    image = Image.open(image_path).convert("RGB")
    try:
        lower_conf = float(config.get("LOWER_CONF", 0.05))
        crops = crop_detections(image, detections, threshold=lower_conf)
    finally:
        image.close()

    if not crops:
        return {"no_animal_detected": 0}, {"no_animal_detected": 0.0}

    predictions: List[Tuple[str, float]] = []
    for crop in crops:
        species, score = classify_crop(
            crop,
            pipeline["model"],
            pipeline["labels"],
            pipeline["transform"],
            pipeline["device"],
        )
        predictions.append((species, score))

    return aggregate_predictions(predictions)


def get_detections_with_boxes(
    image_path: Path, pipeline: Dict
) -> Tuple[Dict[str, int], Dict[str, float], List[Tuple[int, int, int, int, str, float]]]:
    """
    Run detection and return boxes along with species labels.
    Returns (tags, confidence, boxes_list) where boxes_list is [(x1, y1, x2, y2, species, confidence), ...]
    """
    config = pipeline.get("config", {})
    detections = run_megadetector(image_path)

    image = Image.open(image_path).convert("RGB")
    width, height = image.size

    boxes_with_species: List[Tuple[int, int, int, int, str, float]] = []
    crops_for_classification: List[Tuple[Image.Image, int, int, int, int]] = []

    try:
        lower_conf = float(config.get("LOWER_CONF", 0.05))

        for detection in detections:
            if not is_animal_detection(detection):
                continue

            confidence = float(detection.get("conf", 0.0))
            if confidence < lower_conf:
                continue

            bbox = detection.get("bbox")
            if not bbox or len(bbox) != 4:
                continue

            x, y, w, h = bbox
            left = max(0, int(x * width))
            top = max(0, int(y * height))
            right = min(width, int((x + w) * width))
            bottom = min(height, int((y + h) * height))

            if right <= left or bottom <= top:
                continue

            crop = image.crop((left, top, right, bottom)).convert("RGB")
            crops_for_classification.append((crop, left, top, right, bottom))
    finally:
        image.close()

    if not crops_for_classification:
        return {"no_animal_detected": 0}, {"no_animal_detected": 0.0}, []

    predictions: List[Tuple[str, float]] = []
    for crop, left, top, right, bottom in crops_for_classification:
        species, score = classify_crop(
            crop,
            pipeline["model"],
            pipeline["labels"],
            pipeline["transform"],
            pipeline["device"],
        )
        predictions.append((species, score))
        boxes_with_species.append((left, top, right, bottom, species, score))

    tags, confidence = aggregate_predictions(predictions)
    return tags, confidence, boxes_with_species


def annotate_image_path(image_path: Path, pipeline: Dict) -> Tuple[Dict[str, int], Dict[str, float], str]:
    """
    Run detection and return annotated image as base64.
    Returns (tags, confidence, annotated_image_base64)
    """
    tags, confidence, boxes_with_species = get_detections_with_boxes(image_path, pipeline)

    image = Image.open(image_path).convert("RGB")
    image_cv = np.array(image)

    if boxes_with_species:
        h, w = image_cv.shape[:2]

        for left, top, right, bottom, species, score in boxes_with_species:
            left, top, right, bottom = int(left), int(top), int(right), int(bottom)
            left = max(0, left)
            top = max(0, top)
            right = min(w, right)
            bottom = min(h, bottom)

            cv2.rectangle(image_cv, (left, top), (right, bottom), (0, 255, 0), 2)
            label = f"{species} ({score:.2f})"
            font = cv2.FONT_HERSHEY_SIMPLEX
            font_scale = 0.5
            thickness = 1
            text_size = cv2.getTextSize(label, font, font_scale, thickness)[0]
            text_x = left
            text_y = max(top - 5, text_size[1])
            cv2.rectangle(image_cv, (text_x, text_y - text_size[1] - 5), (text_x + text_size[0], text_y + 5), (0, 255, 0), -1)
            cv2.putText(image_cv, label, (text_x, text_y), font, font_scale, (0, 0, 0), thickness)

    image_annotated = Image.fromarray(image_cv)
    image_bytes = io.BytesIO()
    image_annotated.save(image_bytes, format="JPEG")
    image_base64 = base64.b64encode(image_bytes.getvalue()).decode("utf-8")

    return tags, confidence, image_base64


def annotate_video_path(video_path: Path, pipeline: Dict) -> Tuple[Dict[str, int], Dict[str, float], List[str], int]:
    """
    Run video detection and return list of annotated frames as base64.
    Returns (tags, confidence, annotated_frames_base64_list, frames_processed)
    """
    if not video_path.exists():
        raise ValueError("video file does not exist")

    capture = cv2.VideoCapture(str(video_path))
    if not capture.isOpened():
        capture.release()
        raise ValueError("video cannot be opened")

    fps = capture.get(cv2.CAP_PROP_FPS) or 0.0
    frame_interval = int(fps) if fps and fps > 0 else 1
    if frame_interval < 1:
        frame_interval = 1

    frame_number = 0
    processed_frames = 0
    aggregate_tags: Dict[str, int] = {}
    aggregate_confidence: Dict[str, float] = {}
    annotated_frames_b64: List[str] = []

    try:
        while True:
            ret, frame = capture.read()
            if not ret:
                break

            if frame_number % frame_interval == 0:
                frame_path = Path(f"/tmp/frame_{processed_frames}.jpg")
                frame_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                image_pil = Image.fromarray(frame_rgb)
                image_pil.save(frame_path)

                try:
                    tags, confidence, boxes_with_species = get_detections_with_boxes(frame_path, pipeline)

                    if boxes_with_species:
                        frame_annotated = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                        h, w = frame_annotated.shape[:2]

                        for left, top, right, bottom, species, score in boxes_with_species:
                            left, top, right, bottom = int(left), int(top), int(right), int(bottom)
                            left = max(0, left)
                            top = max(0, top)
                            right = min(w, right)
                            bottom = min(h, bottom)

                            cv2.rectangle(frame_annotated, (left, top), (right, bottom), (0, 255, 0), 2)
                            label = f"{species} ({score:.2f})"
                            font = cv2.FONT_HERSHEY_SIMPLEX
                            font_scale = 0.5
                            thickness = 1
                            text_size = cv2.getTextSize(label, font, font_scale, thickness)[0]
                            text_x = left
                            text_y = max(top - 5, text_size[1])
                            cv2.rectangle(frame_annotated, (text_x, text_y - text_size[1] - 5), (text_x + text_size[0], text_y + 5), (0, 255, 0), -1)
                            cv2.putText(frame_annotated, label, (text_x, text_y), font, font_scale, (0, 0, 0), thickness)
                    else:
                        frame_annotated = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)

                    image_pil_annotated = Image.fromarray(frame_annotated)
                    img_bytes = io.BytesIO()
                    image_pil_annotated.save(img_bytes, format="JPEG")
                    frame_b64 = base64.b64encode(img_bytes.getvalue()).decode("utf-8")
                    annotated_frames_b64.append(frame_b64)

                    if not (tags == {"no_animal_detected": 0} and confidence == {"no_animal_detected": 0.0}):
                        for species, count in tags.items():
                            aggregate_tags[species] = aggregate_tags.get(species, 0) + count
                        for species, score in confidence.items():
                            aggregate_confidence[species] = max(aggregate_confidence.get(species, 0.0), score)

                finally:
                    try:
                        if frame_path.exists():
                            frame_path.unlink()
                    except OSError:
                        pass

                processed_frames += 1

            frame_number += 1
    finally:
        capture.release()

    if processed_frames == 0:
        return {"no_frame_processed": 0}, {"no_frame_processed": 0.0}, [], 0
    if not aggregate_tags:
        return {"no_animal_detected": 0}, {"no_animal_detected": 0.0}, annotated_frames_b64, processed_frames

    return aggregate_tags, aggregate_confidence, annotated_frames_b64, processed_frames
