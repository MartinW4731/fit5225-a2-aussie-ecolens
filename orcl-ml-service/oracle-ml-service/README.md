# Oracle ML Service (Skeleton)

This directory contains the Oracle skeleton ML service for FIT5225 Aussie EcoLens.
It implements the first-phase Oracle endpoint that AWS Lambda can call for connectivity testing.

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
  "source": "Oracle skeleton ML service"
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

## Notes

- Stage 1 is a skeleton service. It returns fake tags based on the file name.
- Stage 2 will replace the fake tag logic with real ML inference using `mdv5a.pt`, `model.pt`, and `labels.txt`.
