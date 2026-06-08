# Oracle ML Service

This folder contains the Oracle-side machine learning work for the Aussie EcoLens project.

## Folder Overview

### `final_oracle_model/`

This is the main production-ready model service folder.

- It contains the final API service code used for model inference.
- The core runtime files are `app.py` and `ml_pipeline.py`.
- The model weight files such as `mdv5a.pt` and `model.pt` are also stored here.
- If you want to understand or run the final Oracle ML service, start from this folder.

### `oracle-ml-service_process/`

This folder contains intermediate development and process files.

- It keeps the earlier implementation process, experiments, and supporting scripts used while building the Oracle ML service.
- It is useful for tracing the development workflow and model integration steps.
- It is not the primary final submission folder.

### `Test/`

This folder stores test materials and output examples.

- It includes sample images, videos, JSON responses, annotated outputs, and local testing scripts.
- These files were used to verify image detection, video detection, and annotation behavior.
- This folder is mainly for demonstration, debugging, and validation.

## Which Folder Matters Most

If you only need the real model processing service, use:

```text
final_oracle_model/
```

That folder contains the actual final implementation of the Oracle ML inference service.

## Suggested Reading Order

1. `final_oracle_model/README.md`
2. `final_oracle_model/app.py`
3. `final_oracle_model/ml_pipeline.py`
4. `Test/` for sample inputs and outputs
5. `oracle-ml-service_process/` if you want to see the development process

## Summary

In short:

- `final_oracle_model` = final model service
- `oracle-ml-service_process` = process / development version
- `Test` = testing materials and example outputs
