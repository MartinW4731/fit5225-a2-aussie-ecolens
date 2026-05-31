from flask import Flask, request, jsonify
import os

app = Flask(__name__)
API_KEY = os.environ.get("ORACLE_API_KEY", "")


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

    lower_name = file_name.lower()
    if "casuarius" in lower_name:
        tags = {"Casuarius_casuarius": 1}
        confidence = {"Casuarius_casuarius": 0.99}
    elif "bos" in lower_name or "taurus" in lower_name:
        tags = {"Bos_taurus": 1}
        confidence = {"Bos_taurus": 0.99}
    elif "macropus" in lower_name:
        tags = {"Macropus_giganteus": 1}
        confidence = {"Macropus_giganteus": 0.99}
    else:
        tags = {"unknown_species": 1}
        confidence = {"unknown_species": 0.50}

    return jsonify({
        "tags": tags,
        "confidence": confidence,
        "source": "Oracle skeleton ML service"
    })


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", 8080)))
