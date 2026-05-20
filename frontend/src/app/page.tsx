"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type LabelResult = {
  name: string;
  confidence: string;
};

type ResultResponse = {
  imageId: string;
  status: string;
  objectKey: string;
  imageUrl: string;
  labels: LabelResult[];
  createdAt?: string;
};

type UploadUrlResponse = {
  imageId: string;
  objectKey: string;
  uploadUrl: string;
  expiresIn: number;
};

const API_URL = process.env.NEXT_PUBLIC_API_URL;

const steps = [
  "Generate presigned URL",
  "Upload image to S3",
  "Process with Rekognition",
  "Fetch labels from DynamoDB",
];

export default function HomePage() {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [result, setResult] = useState<ResultResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [activeStep, setActiveStep] = useState(-1);
  const [debugInfo, setDebugInfo] = useState("");
  const router = useRouter();

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  function sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const selectedFile = event.target.files?.[0];
    if (!selectedFile) return;

    const allowedTypes = ["image/jpeg", "image/png"];

    if (!allowedTypes.includes(selectedFile.type)) {
      setMessage("Only JPG, JPEG, and PNG images are allowed.");
      setFile(null);
      setPreviewUrl("");
      return;
    }

    setFile(selectedFile);
    setResult(null);
    setMessage("");
    setDebugInfo("");
    setActiveStep(-1);

    const localPreviewUrl = URL.createObjectURL(selectedFile);
    setPreviewUrl(localPreviewUrl);
  }

  async function getResultWithRetry(imageId: string) {
    for (let attempt = 1; attempt <= 6; attempt++) {
      setActiveStep(3);
      setMessage(`Fetching Rekognition result... attempt ${attempt}/6`);

      const resultResponse = await fetch(`${API_URL}/results/${imageId}`, {
        method: "GET",
      });

      const resultData = await resultResponse.json();

      if (resultResponse.ok && resultData.status === "COMPLETED") {
        return resultData as ResultResponse;
      }

      if (attempt < 6) {
        await sleep(2000);
      }
    }

    throw new Error("Result not ready yet. Please try again after a few seconds.");
  }

  async function handleUpload() {
    if (!API_URL) {
      setMessage(
        "NEXT_PUBLIC_API_URL is missing. Check .env.local and restart npm run dev."
      );
      return;
    }

    if (!file) {
      setMessage("Please select an image first.");
      return;
    }

    try {
      setLoading(true);
      setResult(null);
      setDebugInfo("");

      console.log("Selected file:", {
        name: file.name,
        type: file.type,
        size: file.size,
      });

      setActiveStep(0);
      setMessage("Generating secure S3 upload URL...");

      const uploadUrlResponse = await fetch(`${API_URL}/upload-url`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          filename: file.name,
          contentType: file.type,
        }),
      });

      const uploadUrlText = await uploadUrlResponse.text();

      if (!uploadUrlResponse.ok) {
        throw new Error(
          `Failed to generate upload URL. Status: ${uploadUrlResponse.status}`
        );
      }

      const uploadData = JSON.parse(uploadUrlText) as UploadUrlResponse;

      setActiveStep(1);
      setMessage("Uploading image directly to Amazon S3...");

      const s3UploadResponse = await fetch(uploadData.uploadUrl, {
        method: "PUT",
        headers: {
          "Content-Type": file.type,
        },
        body: file,
      });

      if (!s3UploadResponse.ok) {
        const s3ErrorText = await s3UploadResponse.text();
        console.error("S3 upload failed:", s3ErrorText);
        setDebugInfo(s3ErrorText);

        throw new Error(
          `Failed to upload image to S3. Status: ${s3UploadResponse.status}`
        );
      }

      setActiveStep(2);
      setMessage("Image uploaded. Amazon Rekognition is analyzing it...");

      await sleep(3000);

      const finalResult = await getResultWithRetry(uploadData.imageId);

      setResult(finalResult);
      setActiveStep(4);
      setMessage("Image labels generated successfully.");

      router.push(`/results/${encodeURIComponent(uploadData.imageId)}`);
    } catch (error) {
      console.error(error);
      setMessage(
        error instanceof Error ? error.message : "Something went wrong."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen overflow-hidden bg-[#020617] text-white">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_top_left,#1d4ed833,transparent_35%),radial-gradient(circle_at_top_right,#0ea5e933,transparent_35%)]" />

      <section className="relative mx-auto flex max-w-7xl flex-col gap-10 px-6 py-10 md:py-14">
        <div className="mx-auto max-w-3xl text-center">
          <div className="mx-auto mb-5 inline-flex rounded-full border border-blue-400/30 bg-blue-500/10 px-4 py-2 text-xs font-medium uppercase tracking-[0.25em] text-blue-300">
            AWS Rekognition Serverless Project
          </div>

          <h1 className="text-4xl font-bold tracking-tight md:text-6xl">
            Image Labels Generator
          </h1>

          <p className="mx-auto mt-5 max-w-2xl text-sm leading-7 text-slate-300 md:text-base">
            Upload an image from the browser, store it in Amazon S3, analyze it
            using Amazon Rekognition, save labels in DynamoDB, and display the
            result in a clean Next.js interface.
          </p>

          <div className="mt-6 flex flex-wrap justify-center gap-2 text-xs text-slate-300">
            {["Next.js", "API Gateway", "Lambda", "S3", "Rekognition", "DynamoDB"].map(
              (item) => (
                <span
                  key={item}
                  className="rounded-full border border-white/10 bg-white/5 px-3 py-1"
                >
                  {item}
                </span>
              )
            )}
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 shadow-2xl backdrop-blur md:p-7">
            <div className="mb-6 flex items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold">Upload Image</h2>
                <p className="mt-1 text-sm text-slate-400">
                  Supports JPG, JPEG, and PNG.
                </p>
              </div>

              <div className="rounded-2xl bg-blue-500/10 px-4 py-2 text-xs font-medium text-blue-300">
                Private S3 Upload
              </div>
            </div>

            <div className="rounded-2xl border border-dashed border-blue-400/30 bg-slate-950/70 p-5">
              <label className="block text-sm font-medium text-slate-300">
                Select image
              </label>

              <input
                type="file"
                accept="image/png,image/jpeg"
                onChange={handleFileChange}
                className="mt-4 block w-full cursor-pointer rounded-xl border border-slate-700 bg-slate-950 text-sm text-slate-300 file:mr-4 file:border-0 file:bg-blue-600 file:px-4 file:py-3 file:text-white hover:file:bg-blue-500"
              />

              {file && (
                <div className="mt-4 grid gap-3 rounded-xl border border-white/10 bg-slate-900/80 p-4 text-sm text-slate-400 md:grid-cols-3">
                  <div>
                    <p className="text-xs uppercase text-slate-500">File</p>
                    <p className="mt-1 truncate text-slate-200">{file.name}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase text-slate-500">Type</p>
                    <p className="mt-1 text-slate-200">{file.type}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase text-slate-500">Size</p>
                    <p className="mt-1 text-slate-200">
                      {(file.size / 1024).toFixed(2)} KB
                    </p>
                  </div>
                </div>
              )}
            </div>

            {previewUrl && (
              <div className="mt-5 overflow-hidden rounded-2xl border border-white/10 bg-slate-950/70">
                <div className="border-b border-white/10 px-4 py-3 text-sm text-slate-300">
                  Local Preview
                </div>
                <img
                  src={previewUrl}
                  alt="Selected preview"
                  className="h-80 w-full object-contain p-4"
                />
              </div>
            )}

            <button
              onClick={handleUpload}
              disabled={loading || !file}
              className="mt-5 w-full rounded-2xl bg-blue-600 px-5 py-4 font-semibold text-white shadow-lg shadow-blue-950/40 transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:bg-slate-700"
            >
              {loading ? "Processing Image..." : "Upload and Generate Labels"}
            </button>

            <div className="mt-5 rounded-2xl border border-white/10 bg-slate-950/60 p-4">
              <p className="mb-3 text-sm font-medium text-slate-300">
                Processing Flow
              </p>

              <div className="space-y-3">
                {steps.map((step, index) => {
                  const isDone = activeStep > index;
                  const isActive = activeStep === index;

                  return (
                    <div
                      key={step}
                      className="flex items-center gap-3 text-sm text-slate-400"
                    >
                      <div
                        className={`flex h-7 w-7 items-center justify-center rounded-full border text-xs ${
                          isDone
                            ? "border-emerald-400 bg-emerald-500/20 text-emerald-300"
                            : isActive
                            ? "border-blue-400 bg-blue-500/20 text-blue-300"
                            : "border-slate-700 bg-slate-900 text-slate-500"
                        }`}
                      >
                        {isDone ? "✓" : index + 1}
                      </div>

                      <span
                        className={
                          isActive
                            ? "text-blue-300"
                            : isDone
                            ? "text-emerald-300"
                            : ""
                        }
                      >
                        {step}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {message && (
              <p className="mt-5 rounded-2xl border border-white/10 bg-slate-950/70 p-4 text-sm text-slate-300">
                {message}
              </p>
            )}

            {debugInfo && (
              <pre className="mt-5 max-h-72 overflow-auto rounded-2xl border border-red-500/30 bg-red-950/40 p-4 text-xs text-red-100">
                {debugInfo}
              </pre>
            )}
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 shadow-2xl backdrop-blur md:p-7">
            <div className="mb-6 flex items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold">Detected Labels</h2>
                <p className="mt-1 text-sm text-slate-400">
                  Results returned from DynamoDB.
                </p>
              </div>

              {result && (
                <div className="rounded-2xl bg-emerald-500/10 px-4 py-2 text-xs font-medium text-emerald-300">
                  COMPLETED
                </div>
              )}
            </div>

            {!result && (
              <div className="flex h-[520px] flex-col items-center justify-center rounded-2xl border border-white/10 bg-slate-950/70 p-8 text-center">
                <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-3xl bg-blue-500/10 text-2xl">
                  ✨
                </div>
                <h3 className="text-lg font-semibold">No result yet</h3>
                <p className="mt-2 max-w-sm text-sm leading-6 text-slate-400">
                  Select an image and run the pipeline. The labels, confidence
                  scores, image ID, and S3 object key will appear here.
                </p>
              </div>
            )}

            {result && (
              <div className="space-y-5">
                <div className="overflow-hidden rounded-2xl border border-white/10 bg-slate-950/70">
                  <div className="border-b border-white/10 px-4 py-3 text-sm text-slate-300">
                    Processed Image
                  </div>
                  <img
                    src={result.imageUrl}
                    alt="Processed image"
                    className="h-80 w-full object-contain p-4"
                  />
                </div>

                <div className="space-y-3">
                  {result.labels.map((label) => {
                    const confidence = Number(label.confidence);
                    const confidenceWidth = Math.min(
                      Math.max(confidence, 0),
                      100
                    );

                    return (
                      <div
                        key={label.name}
                        className="rounded-2xl border border-white/10 bg-slate-950/70 p-4"
                      >
                        <div className="mb-2 flex items-center justify-between gap-4">
                          <span className="font-medium text-slate-100">
                            {label.name}
                          </span>
                          <span className="text-sm text-blue-300">
                            {label.confidence}%
                          </span>
                        </div>

                        <div className="h-2 overflow-hidden rounded-full bg-slate-800">
                          <div
                            className="h-full rounded-full bg-blue-500"
                            style={{ width: `${confidenceWidth}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="rounded-2xl border border-white/10 bg-slate-950/80 p-4 text-xs text-slate-500">
                  <p>
                    <span className="text-slate-300">Image ID:</span>{" "}
                    {result.imageId}
                  </p>
                  <p className="mt-1 break-all">
                    <span className="text-slate-300">Object Key:</span>{" "}
                    {result.objectKey}
                  </p>
                  {result.createdAt && (
                    <p className="mt-1">
                      <span className="text-slate-300">Created At:</span>{" "}
                      {result.createdAt}
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}
