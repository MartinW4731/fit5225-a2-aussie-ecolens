# Oracle ML Service

This folder contains the final Oracle ML service submission for FIT5225 Aussie EcoLens.
It packages the provided detection/classification models into a runnable API service for image and video animal recognition.

## Included Files

This submission keeps the following core files:

- `app.py`
  Flask API entry point. Defines the HTTP endpoints and request/response handling.
- `ml_pipeline.py`
  Core inference pipeline. Loads models, runs MegaDetector, classifies species, handles video frame processing, and generates annotation outputs.
- `Dockerfile`
  Container build file for running the service in Docker.
- `requirements.txt`
  Python dependency list required by the service.
- `batch.py`
  Local batch-processing helper script for running the model pipeline outside the API.
- `labels.txt`
  Species label mapping used by `model.pt`.
- `mdv5a.pt`
  MegaDetector model used for animal detection.
- `model.pt`
  Species classification model used after animal crops are extracted.
- `config.yaml`
  Runtime configuration file, including detection/snipping parameters.

## What The Service Does

The pipeline works in two stages:

1. MegaDetector detects animal bounding boxes in an image or sampled video frame.
2. Each detected animal crop is passed into the species classifier to produce:
   - `tags`: predicted species counts
   - `confidence`: highest confidence score per species

For videos, the service samples approximately 1 frame per second and aggregates the final tag count using the maximum count observed in any extracted frame.

## API Endpoints

### `GET /`

Health check endpoint.

Example response:

```json
{
  "status": "Oracle ML service is running"
}
```

### `GET /health`

Alias for the health check endpoint.

### `POST /detect`

Supports both image and video input.

Example image request:

```json
{
  "file_name": "test.jpg",
  "file_type": "image",
  "image_base64": "..."
}
```

Example video request:

```json
{
  "file_name": "test.mp4",
  "file_type": "video",
  "video_base64": "..."
}
```

Example image response:

```json
{
  "tags": {
    "canis_familiaris": 1
  },
  "confidence": {
    "canis_familiaris": 0.91
  },
  "source": "Oracle ML detection"
}
```

Example video response:

```json
{
  "tags": {
    "sus_scrofa": 2
  },
  "confidence": {
    "sus_scrofa": 0.99
  },
  "source": "Oracle ML detection",
  "frames_processed": 3
}
```

If no valid species prediction remains after filtering, the service returns:

```json
{
  "tags": {
    "no_animal_detected": 0
  },
  "confidence": {
    "no_animal_detected": 0.0
  },
  "source": "Oracle ML detection"
}
```

### `POST /detect-video`

Video-only endpoint. Returns the same structure as the video branch of `/detect`.

### `POST /annotate`

Supports both image and video input and returns annotated outputs.

Image response adds:

```json
{
  "annotated_image_base64": "..."
}
```

Video response adds:

```json
{
  "annotated_frames_base64": ["...", "..."],
  "frames_processed": 3
}
```

## Runtime Behavior

### Species Confidence Threshold

The classifier output is filtered before aggregation.
Only predictions with confidence greater than or equal to the configured species threshold are included in `tags` and `confidence`.

### Video Aggregation Rule

For video processing:

- the service samples frames at roughly 1 frame per second
- species counts are aggregated by taking the maximum count seen in any extracted frame
- confidence values are aggregated by taking the maximum confidence seen across frames

## Local Run

```bash
cd oracle-ml-service
python3 -m pip install -r requirements.txt
python3 app.py
```

Default port:

```text
8080
```

## Docker Run

Build:

```bash
docker build -t oracle-ml-service:latest .
```

Run:

```bash
docker run --rm -p 8080:8080 oracle-ml-service:latest
```

## Optional API Key

If the environment variable `ORACLE_API_KEY` is set, requests must include:

```text
x-api-key: your-secret-key
```

## Notes

- `labels.txt` determines the species names returned in `tags`.
- `config.yaml` does not change the API format; it only affects runtime inference behavior.
- `app.py` is the service entry point.
- `ml_pipeline.py` contains the main logic and is the most important file for understanding the implementation.
