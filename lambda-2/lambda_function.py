import json
import urllib.parse
from datetime import datetime, timezone
from decimal import Decimal

import boto3


rekognition = boto3.client("rekognition")
dynamodb = boto3.resource("dynamodb")

table = dynamodb.Table("ImageLabelResults")

SUPPORTED_EXTENSIONS = (".jpg", ".jpeg", ".png")


def to_decimal(value):
    """
    DynamoDB does not support Python float directly.
    This converts Rekognition float values into Decimal safely.
    """
    if isinstance(value, float):
        return Decimal(str(value))

    if isinstance(value, list):
        return [to_decimal(item) for item in value]

    if isinstance(value, dict):
        return {key: to_decimal(val) for key, val in value.items()}

    return value


def build_s3_url(bucket, key):
    encoded_key = urllib.parse.quote(key)
    return f"https://{bucket}.s3.amazonaws.com/{encoded_key}"


def lambda_handler(event, context):
    print("Received event:")
    print(json.dumps(event))

    processed_images = []

    for record in event.get("Records", []):
        bucket = record["s3"]["bucket"]["name"]
        key = urllib.parse.unquote_plus(record["s3"]["object"]["key"])

        print(f"Processing image: s3://{bucket}/{key}")

        if not key.lower().endswith(SUPPORTED_EXTENSIONS):
            print(f"Skipping unsupported file type: {key}")
            continue

        image_id = key.split("/")[-1]
        image_url = build_s3_url(bucket, key)

        label_response = rekognition.detect_labels(
            Image={
                "S3Object": {
                    "Bucket": bucket,
                    "Name": key,
                }
            },
            MaxLabels=20,
            MinConfidence=70,
        )

        face_response = rekognition.detect_faces(
            Image={
                "S3Object": {
                    "Bucket": bucket,
                    "Name": key,
                }
            },
            Attributes=["DEFAULT"],
        )

        labels = []

        print("Detected labels:")
        for label in label_response.get("Labels", []):
            instances = []

            for instance in label.get("Instances", []):
                bounding_box = instance.get("BoundingBox")

                if bounding_box:
                    instances.append(
                        {
                            "confidence": round(instance.get("Confidence", 0), 2),
                            "boundingBox": {
                                "left": bounding_box.get("Left", 0),
                                "top": bounding_box.get("Top", 0),
                                "width": bounding_box.get("Width", 0),
                                "height": bounding_box.get("Height", 0),
                            },
                        }
                    )

            parents = [
                parent.get("Name")
                for parent in label.get("Parents", [])
                if parent.get("Name")
            ]

            aliases = [
                alias.get("Name")
                for alias in label.get("Aliases", [])
                if alias.get("Name")
            ]

            categories = [
                category.get("Name")
                for category in label.get("Categories", [])
                if category.get("Name")
            ]

            label_item = {
                "name": label.get("Name"),
                "confidence": round(label.get("Confidence", 0), 2),
                "parents": parents,
                "aliases": aliases,
                "categories": categories,
                "instances": instances,
            }

            labels.append(label_item)

            print(
                f"- {label_item['name']}: {label_item['confidence']}% "
                f"boxes={len(instances)}"
            )

        faces = []

        print("Detected faces:")
        for index, face in enumerate(face_response.get("FaceDetails", []), start=1):
            bounding_box = face.get("BoundingBox", {})

            face_item = {
                "name": f"Face {index}",
                "confidence": round(face.get("Confidence", 0), 2),
                "boundingBox": {
                    "left": bounding_box.get("Left", 0),
                    "top": bounding_box.get("Top", 0),
                    "width": bounding_box.get("Width", 0),
                    "height": bounding_box.get("Height", 0),
                },
            }

            faces.append(face_item)

            print(f"- {face_item['name']}: {face_item['confidence']}%")

        item = {
            "imageId": image_id,
            "bucket": bucket,
            "objectKey": key,
            "imageUrl": image_url,
            "status": "COMPLETED",
            "labels": labels,
            "faces": faces,
            "createdAt": datetime.now(timezone.utc).isoformat(),
        }

        dynamodb_item = to_decimal(item)

        table.put_item(Item=dynamodb_item)

        processed_images.append(
            {
                "imageId": image_id,
                "objectKey": key,
                "labelsCount": len(labels),
                "facesCount": len(faces),
            }
        )

        print("Saved result to DynamoDB:")
        print(json.dumps(item))

    return {
        "statusCode": 200,
        "body": json.dumps(
            {
                "message": "Image processed and saved successfully",
                "processedImages": processed_images,
            }
        ),
    }
