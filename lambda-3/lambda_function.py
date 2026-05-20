import json
from decimal import Decimal

import boto3


dynamodb = boto3.resource("dynamodb")
s3 = boto3.client("s3")

table = dynamodb.Table("ImageLabelResults")


class DecimalEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, Decimal):
            return float(obj)
        return super(DecimalEncoder, self).default(obj)


def response(status_code, body):
    return {
        "statusCode": status_code,
        "headers": {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Headers": "Content-Type",
            "Access-Control-Allow-Methods": "GET,OPTIONS",
            "Content-Type": "application/json",
        },
        "body": json.dumps(body, cls=DecimalEncoder),
    }


def add_presigned_image_url(item):
    bucket = item.get("bucket")
    object_key = item.get("objectKey")

    if not bucket or not object_key:
        return item

    try:
        presigned_url = s3.generate_presigned_url(
            "get_object",
            Params={
                "Bucket": bucket,
                "Key": object_key,
            },
            ExpiresIn=3600,
        )

        item["imageUrl"] = presigned_url
        item["presignedImageUrl"] = presigned_url

    except Exception as error:
        print(f"Failed to create presigned URL: {str(error)}")

    return item


def lambda_handler(event, context):
    print("Received event:")
    print(json.dumps(event))

    try:
        http_method = (
            event.get("requestContext", {})
            .get("http", {})
            .get("method", event.get("httpMethod", "GET"))
        )

        if http_method == "OPTIONS":
            return response(200, {"message": "CORS OK"})

        path_parameters = event.get("pathParameters") or {}
        image_id = path_parameters.get("imageId")

        if image_id:
            result = table.get_item(Key={"imageId": image_id})

            item = result.get("Item")

            if not item:
                return response(
                    404,
                    {
                        "message": "Result not found",
                        "imageId": image_id,
                    },
                )

            item = add_presigned_image_url(item)

            return response(200, {"item": item})

        scan_result = table.scan()
        items = scan_result.get("Items", [])

        while "LastEvaluatedKey" in scan_result:
            scan_result = table.scan(
                ExclusiveStartKey=scan_result["LastEvaluatedKey"]
            )
            items.extend(scan_result.get("Items", []))

        completed_items = [
            add_presigned_image_url(item)
            for item in items
            if item.get("status") == "COMPLETED"
        ]

        completed_items.sort(
            key=lambda item: item.get("createdAt", ""),
            reverse=True,
        )

        return response(
            200,
            {
                "items": completed_items,
                "count": len(completed_items),
            },
        )

    except Exception as error:
        print("Error:")
        print(str(error))

        return response(
            500,
            {
                "message": "Failed to fetch result from DynamoDB",
                "error": str(error),
            },
        )
