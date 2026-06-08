import json
from pathlib import Path


INPUT_PATH = Path(__file__).resolve().parent / "annotate_video_result.json"


def main() -> None:
    with open(INPUT_PATH, "r", encoding="utf-8") as handle:
        data = json.load(handle)

    tags = data.get("tags")
    confidence = data.get("confidence")
    frames_processed = data.get("frames_processed")
    annotated_frames = data.get("annotated_frames_base64", [])

    print("Overall Result")
    print(f"tags: {tags}")
    print(f"confidence: {confidence}")
    print(f"frames_processed: {frames_processed}")
    print(f"annotated_frames_base64 length: {len(annotated_frames) if isinstance(annotated_frames, list) else 'N/A'}")
    print()

    frame_results = data.get("frame_results")
    if not isinstance(frame_results, list):
        print("Per-frame Analysis")
        print("Current JSON does not contain per-frame label details.")
        print("It only contains the overall aggregated tags/confidence plus annotated_frames_base64.")
        print("So we cannot determine from this JSON alone which frame produced canis_familiaris or dacelo_novaeguineae.")
        print()
        print("Suggested next step")
        print("Update annotate_video_path(...) to also return frame_results, for example:")
        print(
            'frame_results = [{"frame_index": 0, "tags": {...}, "confidence": {...}}]'
        )
        return

    print("Per-frame Analysis")
    dog_frames = []
    kookaburra_frames = []

    for frame in frame_results:
        frame_index = frame.get("frame_index")
        frame_tags = frame.get("tags")
        frame_confidence = frame.get("confidence")

        print(f"frame_index: {frame_index}")
        print(f"  tags: {frame_tags}")
        print(f"  confidence: {frame_confidence}")

        if isinstance(frame_tags, dict) and "canis_familiaris" in frame_tags:
            dog_frames.append(frame_index)
            print("  contains canis_familiaris")
        if isinstance(frame_tags, dict) and "dacelo_novaeguineae" in frame_tags:
            kookaburra_frames.append(frame_index)
            print("  contains dacelo_novaeguineae")

        print()

    print(f"Frames containing canis_familiaris: {dog_frames}")
    print(f"Frames containing dacelo_novaeguineae: {kookaburra_frames}")


if __name__ == "__main__":
    main()
