# Batch processing of camera-trap images using MegaDetector and fine-tuned SpeciesNet.

# This script demonstrates how to use MegaDetector to detect animals in a batch of camera-trap images,
# and then apply a fine-tuned SpeciesNet model to classify the detected animals.
# The script is structured as follows:
# 1. Load and run MegaDetector on a batch of images.
# 2. Extract the detected bounding boxes and save cropped images of the detected animals.
# 3. Load a fine-tuned SpeciesNet model and classify the cropped images.

from pathlib import Path
from megadetector.detection import run_detector_batch
import os
import json
import warnings
warnings.filterwarnings('ignore')
from PIL import Image
import yaml
import torch
import torchvision.transforms as transforms
import numpy as np

BASE_DIR = Path(__file__).resolve().parent
CONFIG_PATH = BASE_DIR / "config.yaml"
MD_MODEL_PATH = BASE_DIR / "mdv5a.pt"
MODEL_PT_PATH = BASE_DIR / "model.pt"
LABELS_PATH = BASE_DIR / "labels.txt"

DETECTOR_MODEL = None
CLASSIFIER_MODEL = None
CLASS_NAMES = None
DEVICE = None


def read_yaml(path):
    with open(path, "r") as f:
        return yaml.safe_load(f)


def load_config():
    config = {
        "INPUT_DIR": "./images",
        "MD_FILE": "mg_detections.json",
        "SNIP_DIR": "cropped_images",
        "LOWER_CONF": 0.05,
        "SNIP_SIZE": 600,
    }
    if CONFIG_PATH.exists():
        loaded = read_yaml(CONFIG_PATH)
        if isinstance(loaded, dict):
            config.update(loaded)
    for k in config:
        if k in os.environ:
            config[k] = os.environ[k]
    config["LOWER_CONF"] = float(config["LOWER_CONF"])
    config["SNIP_SIZE"] = int(config["SNIP_SIZE"])
    return config


def get_device():
    global DEVICE
    if DEVICE is not None:
        return DEVICE
    if torch.cuda.is_available():
        DEVICE = "cuda"
    elif hasattr(torch.backends, "mps") and torch.backends.mps.is_available():
        DEVICE = "mps"
    else:
        DEVICE = "cpu"
    return DEVICE


def load_classifier_classes():
    global CLASS_NAMES
    if CLASS_NAMES is not None:
        return CLASS_NAMES
    CLASS_NAMES = []
    if LABELS_PATH.exists():
        with open(LABELS_PATH, "r") as f:
            for line in f:
                parts = line.strip().split(";")
                if len(parts) >= 5:
                    genus = parts[4]
                    species = parts[5] if len(parts) > 5 else ""
                    CLASS_NAMES.append(f"{genus}_{species}" if species else genus)
    if not CLASS_NAMES:
        CLASS_NAMES = [
            'Alectura_lathami', 'Antechinus_agilis', 'Bos_taurus', 'Burhinus_grallarius',
            'Canis_familiaris', 'Chalcophaps_longirostris', 'Colluricincla_harmonica',
            'Corcorax_melanorhamphos', 'Dacelo_novaeguineae', 'Dama_dama', 'Eopsaltria_australis',
            'Felis_catus', 'Geopelia_humeralis', 'Gymnorhina_tibicen', 'Homo_sapiens',
            'Isoodon_macrourus', 'Lepus_europaeus', 'Macropus_giganteus', 'Menura_novaehollandiae',
            'Mus_musculus', 'Oryctolagus_cuniculus', 'Perameles_nasuta', 'Pitta_versicolor',
            'Rattus', 'Rattus_fuscipes', 'Rattus_rattus', 'Strepera_graculina', 'Sus_scrofa',
            'Tachyglossus_aculeatus', 'Thylogale_stigmatica', 'Trichosurus_caninus',
            'Trichosurus_cunninghami', 'Trichosurus_vulpecula', 'Varanus_varius', 'Vombatus_ursinus',
            'Vulpes_vulpes', 'Wallabia_bicolor', 'Canis_dingo', 'Capra_hircus', 'Casuarius_casuarius',
            'Heteromyias_cinereifrons', 'Hypsiprymnodon_moschatus', 'Megapodius_reinwardt',
            'Notamacropus_rufogriseus', 'Orthonyx_spaldingii', 'Uromys_caudimaculatus'
        ]
    return CLASS_NAMES


def load_classifier_model():
    global CLASSIFIER_MODEL
    if CLASSIFIER_MODEL is not None:
        return CLASSIFIER_MODEL
    device = get_device()
    CLASSIFIER_MODEL = torch.load(str(MODEL_PT_PATH), map_location=device, weights_only=False)
    CLASSIFIER_MODEL.eval()
    CLASSIFIER_MODEL.to(device)
    return CLASSIFIER_MODEL


def detect_image_path(image_path):
    results = run_detector_batch.load_and_run_detector_batch(
        image_file_names=[str(image_path)],
        model_file=str(MD_MODEL_PATH)
    )
    if not results:
        return []
    return results[0].get("detections", [])


def crop_image(image_path, bbox, snip_size):
    try:
        img = Image.open(image_path).convert("RGB")
        width, height = img.size
        x, y, w, h = bbox
        left = int(x * width)
        top = int(y * height)
        right = int((x + w) * width)
        bottom = int((y + h) * height)
        left = max(0, min(left, width))
        top = max(0, min(top, height))
        right = max(left, min(right, width))
        bottom = max(top, min(bottom, height))
        crop = img.crop((left, top, right, bottom))
        return crop.resize((snip_size, snip_size), Image.BILINEAR)
    except Exception:
        return None


def classify_crop(crop):
    classifier = load_classifier_model()
    classes = load_classifier_classes()
    transform = transforms.Compose([
        transforms.Resize((480, 480)),
        transforms.ToTensor(),
    ])
    img_tensor = transform(crop)
    img_tensor = img_tensor.unsqueeze(0).permute(0, 2, 3, 1)
    img_tensor = img_tensor.to(get_device())

    with torch.no_grad():
        logits = classifier(img_tensor)
        probs = torch.softmax(logits, dim=1)[0].cpu().numpy()

    best_idx = int(np.argmax(probs))
    best_species = classes[best_idx] if best_idx < len(classes) else "unknown_species"
    best_confidence = float(probs[best_idx])
    return best_species, best_confidence


def detect_single_image(image_path):
    config = load_config()
    detections = detect_image_path(image_path)

    if not detections:
        return {"unknown_species": 1}, {"unknown_species": 0.5}

    species_confidences = {}
    for detection in detections:
        if str(detection.get("category")) != "1":
            continue
        conf = float(detection.get("conf", 0.0))
        if conf < config["LOWER_CONF"]:
            continue
        bbox = detection.get("bbox")
        if not bbox:
            continue
        crop = crop_image(image_path, bbox, config["SNIP_SIZE"])
        if crop is None:
            continue
        species, confidence = classify_crop(crop)
        if not species:
            continue
        species_confidences.setdefault(species, []).append(confidence)

    if not species_confidences:
        return {"unknown_species": 1}, {"unknown_species": 0.5}

    tags = {species: len(conf_list) for species, conf_list in species_confidences.items()}
    confidence = {species: max(conf_list) for species, conf_list in species_confidences.items()}
    return tags, confidence


def main():
    config = load_config()
    input_dir = BASE_DIR / config["INPUT_DIR"]
    output_file = BASE_DIR / config["MD_FILE"]
    files = []
    for file_name in os.listdir(input_dir):
        if not (file_name.startswith(".") or file_name.startswith("..")):
            files.append(str(input_dir / file_name))

    print(f"Running MegaDetector on {len(files)} images...")
    data = run_detector_batch.load_and_run_detector_batch(image_file_names=files, model_file=str(MD_MODEL_PATH))
    with open(output_file, "w") as f:
        json.dump(data, f)

    print(f"Processing {len(data)} images.")
    output_dir = BASE_DIR / config["SNIP_DIR"]
    output_dir.mkdir(parents=True, exist_ok=True)

    for entry in data:
        img_path = entry.get("file")
        if not img_path or not Path(img_path).exists():
            continue
        detections = entry.get("detections", [])
        for crop_num, detection in enumerate(detections):
            if str(detection.get("category")) != "1":
                continue
            conf = float(detection.get("conf", 0.0))
            if conf < config["LOWER_CONF"]:
                continue
            crop = crop_image(img_path, detection.get("bbox"), config["SNIP_SIZE"])
            if crop is None:
                continue
            out_name = f"{Path(img_path).stem}-{crop_num}{Path(img_path).suffix}"
            crop.save(output_dir / out_name)
            print("Saved the cropped image at", output_dir / out_name)

    print(torch.__version__)
    print("Loaded fine-tuned model")


if __name__ == "__main__":
    main()
