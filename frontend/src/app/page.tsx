"use client";

import { useEffect, useState } from "react";

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

export default function HomePage() {
  const [mounted, setMounted] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [result, setResult] = useState<ResultResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [debugInfo, setDebugInfo] = useState("");

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
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

    const localPreviewUrl = URL.createObjectURL(selectedFile);
    setPreviewUrl(localPreviewUrl);
  }

  async function getResultWithRetry(imageId: string) {
    for (let attempt = 1; attempt <= 5; attempt++) {
      setMessage(`Checking Rekognition result... attempt ${attempt}/5`);

      const resultResponse = await fetch(`${API_URL}/results/${imageId}`, {
        method: "GET",
      });

      const resultData = await resultResponse.json();

      if (resultResponse.ok && resultData.status === "COMPLETED") {
        return resultData as ResultResponse;
      }

      if (attempt < 5) {
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

      setMessage("Generating S3 upload URL...");

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
        console.error("Upload URL API failed:", uploadUrlText);
        throw new Error(
          `Failed to generate upload URL. Status: ${uploadUrlResponse.status}`
        );
      }

      const uploadData = JSON.parse(uploadUrlText) as UploadUrlResponse;

      console.log("Upload URL response:", uploadData);

      setMessage("Uploading image directly to S3...");

      const s3UploadResponse = await fetch(uploadData.uploadUrl, {
        method: "PUT",
        headers: {
          "Content-Type": file.type,
        },
        body: file,
      });

      if (!s3UploadResponse.ok) {
        const s3ErrorText = await s3UploadResponse.text();

        console.error("S3 upload failed");
        console.error("Status:", s3UploadResponse.status);
        console.error("Response:", s3ErrorText);

        setDebugInfo(s3ErrorText);

        throw new Error(
          `Failed to upload image to S3. Status: ${s3UploadResponse.status}`
        );
      }

      setMessage("Image uploaded. Waiting for Rekognition processing...");

      await sleep(3000);

      const finalResult = await getResultWithRetry(uploadData.imageId);

      setResult(finalResult);
      setMessage("Image labels generated successfully.");
    } catch (error) {
      console.error(error);

      setMessage(
        error instanceof Error ? error.message : "Something went wrong."
      );
    } finally {
      setLoading(false);
    }
  }

  if (!mounted) {
    return <main className="min-h-screen bg-slate-950 text-white" />;
  }

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <section className="mx-auto flex max-w-6xl flex-col gap-8 px-6 py-12">
        <div className="text-center">
          <p className="text-sm font-medium uppercase tracking-[0.3em] text-blue-400">
            AWS Rekognition Project
          </p>

          <h1 className="mt-4 text-4xl font-bold md:text-5xl">
            Image Labels Generator
          </h1>

          <p className="mx-auto mt-4 max-w-2xl text-slate-300">
            Upload an image to S3, process it with Amazon Rekognition, store
            results in DynamoDB, and display detected labels in Next.js.
          </p>
        </div>

        <div className="grid gap-6 rounded-3xl border border-white/10 bg-white/5 p-6 shadow-2xl md:grid-cols-2">
          <div className="space-y-5">
            <div className="rounded-2xl border border-dashed border-slate-600 bg-slate-900 p-6">
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
                <div className="mt-4 rounded-xl bg-slate-950 p-4 text-sm text-slate-400">
                  <p>
                    <span className="text-slate-300">File:</span> {file.name}
                  </p>
                  <p>
                    <span className="text-slate-300">Type:</span> {file.type}
                  </p>
                  <p>
                    <span className="text-slate-300">Size:</span>{" "}
                    {(file.size / 1024).toFixed(2)} KB
                  </p>
                </div>
              )}
            </div>

            {previewUrl && (
              <div className="overflow-hidden rounded-2xl border border-white/10 bg-slate-900">
                <img
                  src={previewUrl}
                  alt="Selected preview"
                  className="h-72 w-full object-contain"
                />
              </div>
            )}

            <button
              onClick={handleUpload}
              disabled={loading || !file}
              className="w-full rounded-xl bg-blue-600 px-5 py-3 font-semibold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:bg-slate-700"
            >
              {loading ? "Processing..." : "Upload and Generate Labels"}
            </button>

            {message && (
              <p className="rounded-xl border border-white/10 bg-slate-900 p-4 text-sm text-slate-300">
                {message}
              </p>
            )}

            {debugInfo && (
              <pre className="max-h-72 overflow-auto rounded-xl border border-red-500/30 bg-red-950/40 p-4 text-xs text-red-100">
                {debugInfo}
              </pre>
            )}
          </div>

          <div className="rounded-2xl border border-white/10 bg-slate-900 p-6">
            <h2 className="text-xl font-semibold">Detected Labels</h2>

            {!result && (
              <p className="mt-4 text-sm text-slate-400">
                Labels will appear here after image processing.
              </p>
            )}

            {result && (
              <div className="mt-5 space-y-4">
                <div className="overflow-hidden rounded-xl border border-white/10">
                  <img
                    src={result.imageUrl}
                    alt="Processed image"
                    className="h-64 w-full object-contain"
                  />
                </div>

                <div className="space-y-3">
                  {result.labels.map((label) => (
                    <div
                      key={label.name}
                      className="flex items-center justify-between rounded-xl bg-slate-800 px-4 py-3"
                    >
                      <span className="font-medium">{label.name}</span>
                      <span className="text-sm text-blue-300">
                        {label.confidence}%
                      </span>
                    </div>
                  ))}
                </div>

                <div className="rounded-xl bg-slate-950 p-4 text-xs text-slate-500">
                  <p>Image ID: {result.imageId}</p>
                  <p>Object Key: {result.objectKey}</p>
                  {result.createdAt && <p>Created At: {result.createdAt}</p>}
                </div>
              </div>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}