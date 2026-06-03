import base64
import os
from pathlib import Path
from typing import Dict, List, Tuple

import torch
import torchvision.transforms as transforms
import yaml
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
