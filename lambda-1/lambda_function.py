import json
import os
import uuid

import boto3
from botocore.config import Config


BUCKET_NAME = os.environ["BUCKET_NAME"]
UPLOAD_PREFIX = os.environ.get("UPLOAD_PREFIX", "uploads/")

s3 = boto3.client("s3", config=Config(signature_version="s3v4"))

ALLOWED_TYPES = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
}


def response(status_code, body):
    return {
        "statusCode": status_code,
        "headers": {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Headers": "Content-Type",
            "Access-Control-Allow-Methods": "OPTIONS,POST",
        },
        "body": json.dumps(body),
    }


def lambda_handler(event, context):
    try:
        if event.get("requestContext", {}).get("http", {}).get("method") == "OPTIONS":
            return response(200, {"message": "OK"})

        body = json.loads(event.get("body") or "{}")

        content_type = body.get("contentType")

        if content_type not in ALLOWED_TYPES:
            return response(
                400,
                {"message": "Only JPG, PNG, and WEBP images are allowed"},
            )

        extension = ALLOWED_TYPES[content_type]
        image_id = f"{uuid.uuid4()}{extension}"
        object_key = f"{UPLOAD_PREFIX}{image_id}"

        upload_url = s3.generate_presigned_url(
            ClientMethod="put_object",
            Params={
                "Bucket": BUCKET_NAME,
                "Key": object_key,
                "ContentType": content_type,
            },
            ExpiresIn=300,
            HttpMethod="PUT",
        )

        return response(
            200,
            {
                "imageId": image_id,
                "objectKey": object_key,
                "uploadUrl": upload_url,
                "expiresIn": 300,
            },
        )

    except Exception as error:
        print("ERROR:", str(error))
        return response(500, {"message": "Could not generate upload URL"})
