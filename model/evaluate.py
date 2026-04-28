#!/usr/bin/env python3
"""
evaluate.py
───────────
Quick evaluation of a trained model against a held-out test set.

Usage:
    python evaluate.py [--data ./data] [--model ./posture_model.keras]
"""
import argparse
import json
from pathlib import Path

import numpy as np


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--data",  default="data")
    parser.add_argument("--model", default="posture_model.keras")
    args = parser.parse_args()

    import tensorflow as tf
    model = tf.keras.models.load_model(args.model)

    data_dir = Path(args.data)
    class_names_file = Path("class_names.json")
    if class_names_file.exists():
        class_names = json.loads(class_names_file.read_text())
    else:
        class_names = sorted([d.name for d in data_dir.iterdir() if d.is_dir()])

    test_ds = tf.keras.utils.image_dataset_from_directory(
        data_dir,
        validation_split=0.1,
        subset="validation",
        seed=123,
        image_size=(224, 224),
        batch_size=32,
        label_mode="categorical"
    )

    norm = tf.keras.layers.Rescaling(1.0 / 255)
    test_ds = test_ds.map(lambda x, y: (norm(x), y)).prefetch(tf.data.AUTOTUNE)

    loss, acc = model.evaluate(test_ds, verbose=1)
    print(f"\nTest accuracy : {acc:.4f}")
    print(f"Test loss     : {loss:.4f}")


if __name__ == "__main__":
    main()
