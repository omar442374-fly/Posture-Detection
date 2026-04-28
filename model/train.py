#!/usr/bin/env python3
"""
train.py
────────
Trains a binary posture classification model (good_posture / bad_posture)
using MobileNetV2 as the backbone (transfer learning).

Dataset layout expected (created by download_dataset.py):
    data/
        good_posture/   *.jpg  *.png
        bad_posture/    *.jpg  *.png

Usage:
    python train.py [--data ./data] [--epochs 20] [--output ./posture_model.keras]

The trained model is saved in Keras format and also exported as a TFLite
flatbuffer (posture_model.tflite) for lightweight inference.
"""

import argparse
import os
import shutil
from pathlib import Path

import numpy as np


def build_model(num_classes: int = 2, img_size: int = 224):
    import tensorflow as tf
    from tensorflow.keras import layers, models

    base = tf.keras.applications.MobileNetV2(
        input_shape=(img_size, img_size, 3),
        include_top=False,
        weights="imagenet"
    )
    # Freeze the base to speed up initial training
    base.trainable = False

    model = models.Sequential([
        base,
        layers.GlobalAveragePooling2D(),
        layers.Dropout(0.3),
        layers.Dense(128, activation="relu"),
        layers.Dropout(0.2),
        layers.Dense(num_classes, activation="softmax")
    ])
    return model


def load_dataset(data_dir: Path, img_size: int, batch_size: int, val_split: float = 0.2):
    import tensorflow as tf

    train_ds = tf.keras.utils.image_dataset_from_directory(
        data_dir,
        validation_split=val_split,
        subset="training",
        seed=42,
        image_size=(img_size, img_size),
        batch_size=batch_size,
        label_mode="categorical"
    )
    val_ds = tf.keras.utils.image_dataset_from_directory(
        data_dir,
        validation_split=val_split,
        subset="validation",
        seed=42,
        image_size=(img_size, img_size),
        batch_size=batch_size,
        label_mode="categorical"
    )
    return train_ds, val_ds, train_ds.class_names


def preprocess_dataset(ds, augment: bool = False):
    import tensorflow as tf

    normalization = tf.keras.layers.Rescaling(1.0 / 255)

    augmentation = tf.keras.Sequential([
        tf.keras.layers.RandomFlip("horizontal"),
        tf.keras.layers.RandomRotation(0.1),
        tf.keras.layers.RandomZoom(0.1),
        tf.keras.layers.RandomBrightness(0.1),
        tf.keras.layers.RandomContrast(0.1),
    ])

    def preprocess(x, y):
        x = normalization(x)
        if augment:
            x = augmentation(x, training=True)
        return x, y

    return ds.map(preprocess, num_parallel_calls=tf.data.AUTOTUNE).prefetch(tf.data.AUTOTUNE)


def export_tflite(model_path: Path, tflite_path: Path) -> None:
    import tensorflow as tf
    converter = tf.lite.TFLiteConverter.from_saved_model(str(model_path.with_suffix('')))
    converter.optimizations = [tf.lite.Optimize.DEFAULT]
    tflite_model = converter.convert()
    tflite_path.write_bytes(tflite_model)
    print(f"[train] TFLite model saved to: {tflite_path}")


def save_class_names(class_names: list, output_dir: Path) -> None:
    import json
    mapping_path = output_dir / "class_names.json"
    with open(mapping_path, "w") as f:
        json.dump(class_names, f, indent=2)
    print(f"[train] Class names saved to: {mapping_path}")


def main():
    parser = argparse.ArgumentParser(description="Train posture detection model")
    parser.add_argument("--data",    default="data",               help="Dataset directory")
    parser.add_argument("--epochs",  type=int, default=20,         help="Training epochs")
    parser.add_argument("--fine-tune-epochs", type=int, default=10, help="Fine-tune epochs")
    parser.add_argument("--batch",   type=int, default=32,         help="Batch size")
    parser.add_argument("--img-size",type=int, default=224,        help="Image size")
    parser.add_argument("--output",  default="posture_model.keras",help="Output model path")
    args = parser.parse_args()

    data_dir = Path(args.data).resolve()
    output_path = Path(args.output).resolve()
    output_dir = output_path.parent

    if not data_dir.exists():
        print(f"[train] ERROR: Data directory not found: {data_dir}")
        print("[train] Run `python download_dataset.py` first.")
        raise SystemExit(1)

    # Delay TF import to speed up help messages
    import tensorflow as tf
    print(f"[train] TensorFlow {tf.__version__}")
    print(f"[train] GPU available: {bool(tf.config.list_physical_devices('GPU'))}")

    train_ds_raw, val_ds_raw, class_names = load_dataset(
        data_dir, args.img_size, args.batch
    )
    print(f"[train] Classes: {class_names}")

    train_ds = preprocess_dataset(train_ds_raw, augment=True)
    val_ds   = preprocess_dataset(val_ds_raw,   augment=False)

    num_classes = len(class_names)
    model = build_model(num_classes=num_classes, img_size=args.img_size)

    model.compile(
        optimizer=tf.keras.optimizers.Adam(1e-3),
        loss="categorical_crossentropy",
        metrics=["accuracy"]
    )
    model.summary()

    # ── Phase 1: Train classification head ───────────────────────────────
    print("[train] Phase 1 — training head (backbone frozen)…")
    callbacks = [
        tf.keras.callbacks.ModelCheckpoint(
            str(output_path), save_best_only=True, monitor="val_accuracy", verbose=1
        ),
        tf.keras.callbacks.EarlyStopping(
            patience=8, monitor="val_accuracy", verbose=1
        ),
        tf.keras.callbacks.ReduceLROnPlateau(
            factor=0.5, patience=3, min_lr=1e-6, verbose=1
        )
    ]
    history1 = model.fit(
        train_ds, validation_data=val_ds,
        epochs=args.epochs, callbacks=callbacks, verbose=1
    )

    # ── Phase 2: Fine-tune top layers of backbone ─────────────────────────
    print("[train] Phase 2 — fine-tuning top layers of backbone…")
    # Unfreeze last 30 layers of MobileNetV2
    base = model.layers[0]
    base.trainable = True
    for layer in base.layers[:-30]:
        layer.trainable = False

    model.compile(
        optimizer=tf.keras.optimizers.Adam(1e-5),
        loss="categorical_crossentropy",
        metrics=["accuracy"]
    )
    history2 = model.fit(
        train_ds, validation_data=val_ds,
        epochs=args.fine_tune_epochs, callbacks=callbacks, verbose=1
    )

    print(f"[train] Model saved to: {output_path}")

    # Save class names next to the model
    save_class_names(class_names, output_dir)

    # Export TFLite
    tflite_path = output_path.with_suffix(".tflite")
    try:
        model.export(str(output_path.with_suffix('')))
        export_tflite(output_path, tflite_path)
    except Exception as exc:
        print(f"[train] TFLite export skipped: {exc}")

    # Print final metrics
    val_loss, val_acc = model.evaluate(val_ds, verbose=0)
    print(f"[train] Final val accuracy : {val_acc:.4f}")
    print(f"[train] Final val loss     : {val_loss:.4f}")
    print("[train] Done ✓")


if __name__ == "__main__":
    main()
