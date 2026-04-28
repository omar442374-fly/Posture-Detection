#!/usr/bin/env python3
"""
download_dataset.py
────────────────────
Downloads the posture recognition dataset from Kaggle using kagglehub.
Falls back to a curated alternative dataset if the primary one is unavailable.

Primary dataset  : sahasradityathyadi/posture-recognition
  - Contains labelled images of good and bad sitting posture.
  - Classes: good_posture, bad_posture (slouching, forward-head, etc.)

Alternative      : UCF-101 skeleton crops are NOT used here because
                   they do not include sitting-posture labels.
                   Instead we document manual download instructions below.

Usage:
    python download_dataset.py [--output ./data]
"""

import argparse
import os
import shutil
import sys
from pathlib import Path


def download_kaggle(dataset_slug: str, output_dir: Path) -> bool:
    """Return True if download succeeded."""
    try:
        import kagglehub
        path = kagglehub.dataset_download(dataset_slug)
        src = Path(path)
        if not src.exists():
            return False
        if output_dir.exists():
            shutil.rmtree(output_dir)
        shutil.copytree(src, output_dir)
        print(f"[download] Dataset saved to: {output_dir}")
        return True
    except Exception as exc:
        print(f"[download] kagglehub failed: {exc}")
        return False


def print_manual_instructions(output_dir: Path) -> None:
    print("""
──────────────────────────────────────────────────────────────────
MANUAL DATASET DOWNLOAD INSTRUCTIONS
──────────────────────────────────────────────────────────────────

Primary (Kaggle — requires account):
  1. Visit https://www.kaggle.com/datasets/sahasradityathyadi/posture-recognition
  2. Download the ZIP and extract to:
       {output_dir}

  Expected structure:
       {output_dir}/
           good_posture/
               img001.jpg ...
           bad_posture/
               img001.jpg ...

Alternative — OfficePosture dataset (no login required):
  We recommend the MPII Human Pose images filtered for seated
  subjects. Download instructions:
    https://datasets.d2.mpi-inf.mpg.de/andriluka14cvpr/mpii_human_pose_v1.tar.gz
  (≈ 12 GB — filter for seated poses manually or use the label JSON)

  Alternatively, use a synthetic dataset generator:
    https://github.com/CMU-Perceptual-Computing-Lab/openpose
──────────────────────────────────────────────────────────────────
""".format(output_dir=output_dir))


def main():
    parser = argparse.ArgumentParser(description="Download posture dataset")
    parser.add_argument("--output", default="data",
                        help="Directory to save dataset (default: ./data)")
    args = parser.parse_args()

    output_dir = Path(args.output).resolve()
    output_dir.mkdir(parents=True, exist_ok=True)

    primary_slug = "sahasradityathyadi/posture-recognition"
    print(f"[download] Attempting to download: {primary_slug}")

    ok = download_kaggle(primary_slug, output_dir)
    if not ok:
        print("[download] Primary dataset unavailable. Trying fallback…")
        fallback_slug = "nitishabharathi/chair-posture-dataset"
        ok = download_kaggle(fallback_slug, output_dir)

    if not ok:
        print("[download] Automatic download failed.")
        print_manual_instructions(output_dir)
        sys.exit(1)

    # Summarise what we got
    classes = [d.name for d in output_dir.iterdir() if d.is_dir()]
    total_imgs = sum(
        len(list(d.glob("**/*.jpg"))) + len(list(d.glob("**/*.png")))
        for d in output_dir.iterdir() if d.is_dir()
    )
    print(f"[download] Classes found: {classes}")
    print(f"[download] Total images : {total_imgs}")
    print("[download] Done ✓")


if __name__ == "__main__":
    main()
