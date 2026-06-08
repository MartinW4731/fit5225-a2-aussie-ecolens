import base64
import json
from pathlib import Path


INPUT_PATH = Path(__file__).resolve().parent / "annotate_video_result.json"


def main() -> None:
    with open(INPUT_PATH, "r", encoding="utf-8") as handle:
        data = json.load(handle)

    frames = data.get("annotated_frames_base64")
    if not isinstance(frames, list):
        raise ValueError("annotated_frames_base64 is missing or is not a list")

    output_dir = INPUT_PATH.parent
    for index, frame_b64 in enumerate(frames):
        image_bytes = base64.b64decode(frame_b64)
        output_path = output_dir / f"annotated_frame_{index}.jpg"
        with open(output_path, "wb") as handle:
            handle.write(image_bytes)

    print(f"Saved {len(frames)} frame(s) to {output_dir}")


if __name__ == "__main__":
    main()
