from flask import Flask, request, jsonify
import os
from pathlib import Path

from ml_pipeline import DEFAULT_SOURCE, decode_base64_image, load_models, process_image_path

app = Flask(__name__)
API_KEY = os.environ.get("ORACLE_API_KEY", "")
PIPELINE = load_models()


def check_api_key(req):
    if not API_KEY:
        return True
    return req.headers.get("x-api-key") == API_KEY


@app.route("/", methods=["GET"])
def health_check():
    return jsonify({"status": "Oracle ML service is running"})


@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "Oracle ML service is running"})


@app.route("/detect", methods=["POST"])
def detect_species():
    if not check_api_key(request):
        return jsonify({"message": "Unauthorized"}), 401

    data = request.get_json(silent=True) or {}
    file_name = data.get("file_name", "")
    file_type = data.get("file_type", "image")
    image_base64 = data.get("image_base64")

    if not image_base64:
        return jsonify({"message": "image_base64 is required"}), 400

    temp_path = Path("/tmp/input.jpg")
    try:
        decode_base64_image(image_base64, temp_path)
        tags, confidence = process_image_path(temp_path, PIPELINE)
    except ValueError as exc:
        return jsonify({"message": str(exc)}), 400
    except Exception as exc:
        return jsonify({"message": f"Inference failed: {exc}"}), 500
    finally:
        try:
            if temp_path.exists():
                temp_path.unlink()
        except OSError:
            pass

    return jsonify({
        "tags": tags,
        "confidence": confidence,
        "source": DEFAULT_SOURCE,
    })


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", 8080)))
