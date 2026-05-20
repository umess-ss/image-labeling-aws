# Image Labels Generator using AWS Rekognition

A serverless image label generator built with AWS services and a Next.js frontend. Users upload images from the browser, the app uploads them directly to Amazon S3 using presigned URLs, Amazon Rekognition detects visual labels, results are stored in DynamoDB, and the frontend displays the analyzed image, detected labels, bounding boxes, scene summaries, and past upload history.

## Features

- Direct browser-to-S3 upload using presigned URLs
- Serverless backend using AWS Lambda
- Amazon Rekognition DetectLabels integration
- Optional face detection support for face bounding boxes
- DynamoDB result storage
- Next.js frontend result viewer
- Past records feature from stored DynamoDB results
- API Gateway endpoints for upload URL generation and result fetching
- CloudWatch logging for Lambda debugging
- CORS configured for frontend upload and API access

## Architecture

```text
User
  -> Next.js Web App
  -> API Gateway POST /upload-url
  -> Lambda: generate-upload-url
  -> Presigned S3 Upload URL
  -> Browser uploads image directly to S3 uploads/
  -> S3 ObjectCreated event
  -> Lambda: process-image-labels
  -> Amazon Rekognition DetectLabels
  -> DynamoDB ImageLabelResults table
  -> API Gateway GET /results/{imageId}
  -> Lambda: get-label-result
  -> Next.js displays image and detected labels
```

The Past Uploads feature calls the configured results/list endpoint, fetches stored DynamoDB records, and displays previous analyzed images in the frontend.

## AWS Services Used

- Amazon S3
- Amazon API Gateway
- AWS Lambda
- Amazon Rekognition
- Amazon DynamoDB
- IAM
- CloudWatch Logs

## Repository Structure

```text
.
├── frontend/              # Next.js application
├── lambda-1/              # generate-upload-url Lambda
├── lambda-2/              # process-image-labels Lambda
├── lambda-3/              # get-label-result / list results Lambda
└── README.md
```

## API Endpoints

Use your API Gateway base URL, for example:

```text
https://your-api-id.execute-api.us-east-1.amazonaws.com
```

### POST /upload-url

Generates a presigned S3 upload URL.

Request body:

```json
{
  "filename": "image.jpg",
  "contentType": "image/jpeg"
}
```

Response:

```json
{
  "imageId": "uuid.jpg",
  "objectKey": "uploads/uuid.jpg",
  "uploadUrl": "https://...",
  "expiresIn": 300
}
```

### GET /results/{imageId}

Fetches a processed Rekognition result from DynamoDB.

Response:

```json
{
  "item": {
    "imageId": "uuid.jpg",
    "status": "COMPLETED",
    "objectKey": "uploads/uuid.jpg",
    "imageUrl": "https://...",
    "presignedImageUrl": "https://...",
    "labels": [
      {
        "name": "Person",
        "confidence": 99.74,
        "instances": [
          {
            "confidence": 99.5,
            "boundingBox": {
              "left": 0.1,
              "top": 0.2,
              "width": 0.3,
              "height": 0.4
            }
          }
        ]
      }
    ],
    "faces": [],
    "createdAt": "..."
  }
}
```

### GET /results

Fetches previous completed image label records from DynamoDB.

Response:

```json
{
  "items": [
    {
      "imageId": "uuid.jpg",
      "status": "COMPLETED",
      "objectKey": "uploads/uuid.jpg",
      "imageUrl": "https://...",
      "presignedImageUrl": "https://...",
      "labels": [],
      "faces": [],
      "createdAt": "..."
    }
  ],
  "count": 1
}
```

## DynamoDB Table

Table name:

```text
ImageLabelResults
```

Partition key:

```text
imageId
```

Stored attributes:

- imageId
- bucket
- objectKey
- status
- labels
- faces
- imageUrl
- presignedImageUrl
- createdAt

## S3 Bucket Structure

Bucket:

```text
rekognition-label-generator-umesh
```

Folders:

```text
uploads/    original uploaded images
results/    optional JSON/result output
labeled/    optional future labeled image output
```

## Lambda Functions

### Lambda 1: generate-upload-url

Location:

```text
lambda-1/lambda_function.py
```

Purpose:

Generates a presigned S3 upload URL so the browser can upload directly to S3.

Environment variables:

```text
BUCKET_NAME=rekognition-label-generator-umesh
UPLOAD_PREFIX=uploads/
```

IAM permissions:

- `s3:PutObject` on `arn:aws:s3:::rekognition-label-generator-umesh/uploads/*`

### Lambda 2: process-image-labels

Location:

```text
lambda-2/lambda_function.py
```

Purpose:

Triggered by an S3 ObjectCreated event. Calls Amazon Rekognition DetectLabels, optionally detects faces, and stores the result in DynamoDB.

Trigger:

- S3 ObjectCreated
- Prefix: `uploads/`

IAM permissions:

- `s3:GetObject` on `arn:aws:s3:::rekognition-label-generator-umesh/uploads/*`
- `rekognition:DetectLabels` on `*`
- `rekognition:DetectFaces` on `*`
- `dynamodb:PutItem` on the `ImageLabelResults` table
- CloudWatch Logs permissions

### Lambda 3: get-label-result

Location:

```text
lambda-3/lambda_function.py
```

Purpose:

Fetches image label results from DynamoDB and generates a temporary presigned image read URL from S3. This Lambda supports both:

- `GET /results/{imageId}`
- `GET /results`

Environment variables:

```text
TABLE_NAME=ImageLabelResults
```

IAM permissions:

- `dynamodb:GetItem` on the `ImageLabelResults` table
- `dynamodb:Scan` or `dynamodb:Query` on the `ImageLabelResults` table
- `s3:GetObject` on `arn:aws:s3:::rekognition-label-generator-umesh/uploads/*`
- CloudWatch Logs permissions

## IAM Roles

| Lambda Function | IAM Role Purpose | Required Permissions |
|---|---|---|
| generate-upload-url | Generate presigned upload URL | `s3:PutObject` |
| process-image-labels | Process uploaded images | `s3:GetObject`, `rekognition:DetectLabels`, `rekognition:DetectFaces`, `dynamodb:PutItem` |
| get-label-result | Return result to frontend | `dynamodb:GetItem`, `dynamodb:Scan` or `dynamodb:Query`, `s3:GetObject` |
| past-records endpoint | Fetch history | Handled by `get-label-result` using `dynamodb:Scan` or `dynamodb:Query` |

Each Lambda must also have CloudWatch Logs permissions:

- `logs:CreateLogGroup`
- `logs:CreateLogStream`
- `logs:PutLogEvents`

## CORS Configuration

### API Gateway CORS

Allowed origins:

- `http://localhost:3000`
- deployed frontend URL later

Allowed methods:

- `GET`
- `POST`
- `OPTIONS`

Allowed headers:

- `content-type`

### S3 CORS

```json
[
  {
    "AllowedHeaders": ["*"],
    "AllowedMethods": ["PUT", "GET", "HEAD"],
    "AllowedOrigins": [
      "http://localhost:3000"
    ],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3000
  }
]
```

For production, replace `localhost` with the deployed frontend domain.

## Environment Variables

### Frontend

Create `frontend/.env.local`:

```env
NEXT_PUBLIC_API_URL=https://your-api-id.execute-api.us-east-1.amazonaws.com
```

The frontend also supports:

```env
NEXT_PUBLIC_API_BASE_URL=https://your-api-id.execute-api.us-east-1.amazonaws.com
```

### Lambda 1

```env
BUCKET_NAME=rekognition-label-generator-umesh
UPLOAD_PREFIX=uploads/
```

### Lambda 3

```env
TABLE_NAME=ImageLabelResults
```

## Local Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

The frontend runs on:

```text
http://localhost:3000
```

## Testing

### Test upload URL

```bash
curl -X POST "https://your-api-url/upload-url" \
  -H "Content-Type: application/json" \
  -d '{"filename":"test.jpg","contentType":"image/jpeg"}'
```

### Upload image to S3 using the returned uploadUrl

```bash
curl -X PUT "PASTE_UPLOAD_URL_HERE" \
  -H "Content-Type: image/jpeg" \
  --upload-file ./test.jpg
```

### Fetch one result

```bash
curl "https://your-api-url/results/YOUR_IMAGE_ID"
```

### Fetch past records

```bash
curl "https://your-api-url/results"
```

## Common Issues and Fixes

| Issue | Cause | Fix |
|---|---|---|
| CORS error from API Gateway | Missing or incomplete CORS headers | Enable CORS for `GET`, `POST`, and `OPTIONS`; return CORS headers from Lambda |
| CORS error from S3 | S3 bucket CORS does not allow browser origin | Add the S3 CORS JSON shown above |
| `SignatureDoesNotMatch` | Upload `Content-Type` does not match the presigned URL `ContentType` | Use the same content type when requesting and using the presigned URL |
| `AccessDenied` for `s3:PutObject` | Lambda role lacks S3 permission | Add `s3:PutObject` permission for the `uploads/*` prefix |
| DynamoDB `ValidationException` | Partition key mismatch | Ensure the table partition key is `imageId` and Lambda writes `imageId` |
| Result not ready yet | S3-triggered processing is asynchronous | Poll `/results/{imageId}` until Lambda finishes and writes to DynamoDB |
| Image preview broken | S3 object is private or URL expired | Return a fresh `presignedImageUrl` from the results Lambda |

## Screenshots

Add screenshots or diagrams here:

- Architecture diagram
- Next.js upload UI
- Detected labels result
- DynamoDB stored record
- CloudWatch logs

## Future Improvements

- Add bounding boxes overlay
- Add generated labeled image using Pillow
- Add authentication
- Add user-specific history
- Deploy frontend
- Add Infrastructure as Code using Terraform or AWS SAM

## Security Notes

- Do not commit AWS access keys or credentials.
- Use IAM roles with least privilege for each Lambda.
- Keep S3 objects private and serve images through temporary presigned URLs.
- Restrict CORS origins to the deployed frontend domain in production.
