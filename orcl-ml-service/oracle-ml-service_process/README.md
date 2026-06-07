# Oracle ML Service (Phase 2)

This directory contains the Oracle ML API service for FIT5225 Aussie EcoLens.
It now performs real inference using MegaDetector and a species classification model.

## API

### GET /
Health check. Returns:

```json
{ "status": "Oracle ML service is running" }
```

### GET /health
Health check alias.

### POST /detect
Request JSON:

```json
{
  "file_name": "Casuarius_casuarius_1.JPG",
  "file_type": "image",
  "image_base64": "..."
}
```

Response JSON:

```json
{
  "tags": { "Casuarius_casuarius": 1 },
  "confidence": { "Casuarius_casuarius": 0.99 },
  "source": "Oracle ML detection"
}
```

If no animals are detected, the service returns:

```json
{
  "tags": { "no_animal_detected": 0 },
  "confidence": { "no_animal_detected": 0.0 },
  "source": "Oracle ML detection"
}
```

If `ORACLE_API_KEY` is set, include header `x-api-key: your-secret-key`.

## Local build

```bash
cd oracle-ml-service
python3 -m pip install -r requirements.txt
python3 app.py
```

## Docker build

```bash
docker build -t oracle-ml-service:latest .
```

## Docker run

```bash
docker run --rm -p 8080:8080 \
  -e ORACLE_API_KEY=your-secret-key \
  oracle-ml-service:latest
```

## Model files

- `mdv5a.pt`: MegaDetector detector
- `model.pt`: species classifier
- `labels.txt`: class label mapping for `model.pt`
- `config.yaml`: detection threshold and snip config used by the pipeline

## Notes

- The Flask app now loads models once at startup.
- The `/detect` endpoint decodes `image_base64`, runs MegaDetector, crops animal boxes, classifies species, and returns counts + confidence.
- If the model file paths are changed, update `ml_pipeline.py` or set up a wrapper to point to the new locations.
