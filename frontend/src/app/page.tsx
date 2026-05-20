"use client";

import { useEffect, useMemo, useState } from "react";

type BoundingBox = {
  Left?: number;
  Top?: number;
  Width?: number;
  Height?: number;
};

type LabelInstance = {
  BoundingBox?: BoundingBox;
  Confidence?: number | string;
};

type LabelResult = {
  name?: string;
  Name?: string;
  confidence?: string;
  Confidence?: number | string;
  Instances?: LabelInstance[];
  Categories?: { Name?: string }[];
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

type ActiveTab = "upload" | "past";
type LabelType = "Object" | "Person" | "Scene" | "General";
type BoundingBoxLabel = {
  name: string;
  confidence: number;
  box: Required<BoundingBox>;
  labelIndex: number;
};

const API_URL = process.env.NEXT_PUBLIC_API_URL;

const labelColors = [
  "border-emerald-400",
  "border-blue-400",
  "border-yellow-400",
  "border-pink-400",
  "border-purple-400",
  "border-orange-400",
];

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getLabelName(label: LabelResult) {
  return label.name || label.Name || "Unknown";
}

function getConfidence(label: LabelResult) {
  const value = label.confidence ?? label.Confidence ?? 0;
  const numberValue = Number(value);

  if (!Number.isFinite(numberValue)) {
    return 0;
  }

  return Math.min(Math.max(numberValue, 0), 100);
}

function getLabelType(label: LabelResult): LabelType {
  const name = getLabelName(label).toLowerCase();
  const categoryNames = label.Categories?.map((category) =>
    category.Name?.toLowerCase()
  ).filter((category): category is string => Boolean(category));

  if (name === "person" || categoryNames?.includes("person")) {
    return "Person";
  }

  if (label.Instances?.some((instance) => instance.BoundingBox)) {
    return "Object";
  }

  if (
    categoryNames?.some((category) =>
      ["scene", "landscape", "environment"].includes(category)
    )
  ) {
    return "Scene";
  }

  return "General";
}

function hasBoundingBox(instance: LabelInstance) {
  const box = instance.BoundingBox;

  return (
    typeof box?.Left === "number" &&
    typeof box.Top === "number" &&
    typeof box.Width === "number" &&
    typeof box.Height === "number"
  );
}

function getBoundingBoxLabels(labels: LabelResult[]): BoundingBoxLabel[] {
  return labels.flatMap((label, labelIndex) =>
    (label.Instances || []).filter(hasBoundingBox).map((instance) => ({
      name: getLabelName(label),
      confidence: getConfidence({
        confidence: String(instance.Confidence ?? label.Confidence ?? label.confidence ?? 0),
      }),
      box: instance.BoundingBox as Required<BoundingBox>,
      labelIndex,
    }))
  );
}

export default function HomePage() {
  const [activeTab, setActiveTab] = useState<ActiveTab>("upload");
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [result, setResult] = useState<ResultResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [debugInfo, setDebugInfo] = useState("");

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  function selectFile(selectedFile: File) {
    const allowedTypes = ["image/jpeg", "image/png"];

    if (!allowedTypes.includes(selectedFile.type)) {
      setMessage("Only JPG, JPEG, and PNG images are allowed.");
      setFile(null);
      setPreviewUrl("");
      return;
    }

    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }

    setFile(selectedFile);
    setResult(null);
    setMessage("");
    setDebugInfo("");
    setPreviewUrl(URL.createObjectURL(selectedFile));
  }

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const selectedFile = event.target.files?.[0];
    if (!selectedFile) return;

    selectFile(selectedFile);
  }

  function handleDrop(event: React.DragEvent<HTMLLabelElement>) {
    event.preventDefault();

    const selectedFile = event.dataTransfer.files?.[0];
    if (!selectedFile) return;

    selectFile(selectedFile);
  }

  async function getResultWithRetry(imageId: string) {
    for (let attempt = 1; attempt <= 6; attempt++) {
      setMessage(`Analyzing image... ${attempt}/6`);

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

      setMessage("Preparing secure upload...");

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

      setMessage("Uploading image...");

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

      setMessage("Image uploaded. Analyzing with Rekognition...");

      await sleep(3000);

      const finalResult = await getResultWithRetry(uploadData.imageId);

      setResult(finalResult);
      setMessage("Image analyzed successfully.");
    } catch (error) {
      console.error(error);
      setMessage(
        error instanceof Error ? error.message : "Something went wrong."
      );
    } finally {
      setLoading(false);
    }
  }

  const boundingBoxes = useMemo(
    () => (result ? getBoundingBoxLabels(result.labels) : []),
    [result]
  );

  const generalLabels = useMemo(() => {
    if (!result) return [];

    return result.labels.filter(
      (label) => !label.Instances?.some(hasBoundingBox)
    );
  }, [result]);

  const isError = Boolean(message && !loading && !result);
  const buttonLabel = loading ? "Analyzing Image..." : "Analyze Image";

  return (
    <main className="min-h-screen bg-black text-white">
      <div className="sticky top-0 z-30 border-b border-zinc-800 bg-black/85 backdrop-blur">
        <nav className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
          <button
            type="button"
            onClick={() => setActiveTab("upload")}
            className="text-left text-sm font-semibold tracking-tight text-white"
          >
            Image Labels Generator
          </button>

          <div className="flex rounded-full border border-zinc-800 bg-zinc-950 p-1 text-sm">
            {[
              { id: "upload", label: "Upload" },
              { id: "past", label: "Past Uploads" },
            ].map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id as ActiveTab)}
                className={`rounded-full px-4 py-2 transition ${
                  activeTab === item.id
                    ? "bg-white text-black"
                    : "text-zinc-400 hover:text-white"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </nav>
      </div>

      <section className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:py-14">
        <div className="max-w-3xl">
          <h1 className="text-4xl font-semibold tracking-tight text-white md:text-6xl">
            Image Labels Generator
          </h1>
        </div>

        {activeTab === "upload" ? (
          <div className="mt-10 space-y-6">
            <section className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4 sm:p-6">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <h2 className="text-xl font-semibold tracking-tight">
                    Upload Image
                  </h2>
                  <p className="mt-1 text-sm text-zinc-500">
                    Choose a JPG or PNG image to analyze.
                  </p>
                </div>
                {file && (
                  <p className="max-w-full truncate text-sm text-zinc-400 sm:max-w-xs">
                    {file.name}
                  </p>
                )}
              </div>

              <div className="mt-6 grid gap-5 lg:grid-cols-[1fr_0.9fr]">
                <label
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={handleDrop}
                  className="group flex min-h-80 cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-zinc-700 bg-neutral-950 p-8 text-center transition hover:border-zinc-500"
                >
                  <input
                    type="file"
                    accept="image/png,image/jpeg"
                    onChange={handleFileChange}
                    className="sr-only"
                  />

                  <div className="flex h-14 w-14 items-center justify-center rounded-full border border-zinc-800 bg-black text-2xl text-zinc-300 transition group-hover:border-zinc-600 group-hover:text-white">
                    +
                  </div>
                  <p className="mt-5 text-lg font-medium text-zinc-100">
                    Drag and drop an image
                  </p>
                  <p className="mt-2 text-sm leading-6 text-zinc-500">
                    Browse from your device or drop a file here.
                  </p>
                  <span className="mt-6 rounded-full border border-zinc-800 px-4 py-2 text-sm font-medium text-zinc-300">
                    Select Image
                  </span>
                </label>

                <div className="overflow-hidden rounded-2xl border border-zinc-800 bg-neutral-950">
                  {previewUrl ? (
                    <img
                      src={previewUrl}
                      alt="Selected preview"
                      className="h-80 w-full object-contain p-4"
                    />
                  ) : (
                    <div className="flex h-80 items-center justify-center px-8 text-center text-sm text-zinc-600">
                      Image preview appears here after selection.
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
                <button
                  onClick={handleUpload}
                  disabled={loading || !file}
                  className="inline-flex h-12 items-center justify-center rounded-xl bg-white px-6 text-sm font-semibold text-black transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:bg-zinc-800 disabled:text-zinc-500"
                >
                  {buttonLabel}
                </button>

                {loading && (
                  <div className="flex items-center gap-3 text-sm text-zinc-400">
                    <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
                    {message}
                  </div>
                )}
              </div>

              {message && !loading && (
                <p
                  className={`mt-5 rounded-xl border px-4 py-3 text-sm ${
                    isError
                      ? "border-red-900/60 bg-red-950/30 text-red-200"
                      : "border-emerald-900/60 bg-emerald-950/20 text-emerald-200"
                  }`}
                >
                  {message}
                </p>
              )}

              {debugInfo && (
                <pre className="mt-5 max-h-72 overflow-auto rounded-xl border border-red-900/60 bg-red-950/30 p-4 text-xs text-red-100">
                  {debugInfo}
                </pre>
              )}
            </section>

            {result && (
              <section className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4 sm:p-6">
                <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <h2 className="text-xl font-semibold tracking-tight">
                      Analysis Result
                    </h2>
                    <p className="mt-1 text-sm text-zinc-500">
                      Rekognition results from the uploaded image.
                    </p>
                  </div>
                  <span className="w-fit rounded-full border border-emerald-900/70 bg-emerald-950/30 px-3 py-1 text-xs font-medium text-emerald-300">
                    Completed
                  </span>
                </div>

                <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
                  <div className="space-y-4">
                    <div className="text-center">
                      <div className="relative inline-block w-full overflow-hidden rounded-2xl border border-zinc-800 bg-black">
                        <img
                          src={result.imageUrl}
                          alt="Analyzed image"
                          className="block h-auto w-full object-contain"
                        />

                        {boundingBoxes.map((item, index) => {
                          const color =
                            labelColors[item.labelIndex % labelColors.length];

                          return (
                            <div
                              key={`${item.name}-${index}`}
                              className={`pointer-events-none absolute rounded-sm border-2 ${color}`}
                              style={{
                                left: `${item.box.Left * 100}%`,
                                top: `${item.box.Top * 100}%`,
                                width: `${item.box.Width * 100}%`,
                                height: `${item.box.Height * 100}%`,
                              }}
                            >
                              <div className="absolute -top-7 left-0 whitespace-nowrap rounded-md border border-zinc-700 bg-black/90 px-2 py-1 text-xs font-medium text-white">
                                {item.name} {item.confidence.toFixed(1)}%
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {generalLabels.length > 0 && (
                      <div className="rounded-2xl border border-zinc-800 bg-neutral-950 p-4">
                        <h3 className="text-sm font-semibold text-zinc-200">
                          Scene / General Labels
                        </h3>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {generalLabels.map((label) => (
                            <span
                              key={getLabelName(label)}
                              className="rounded-full border border-zinc-800 bg-black px-3 py-1.5 text-sm text-zinc-300"
                            >
                              {getLabelName(label)}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  <aside className="space-y-4">
                    <div className="rounded-2xl border border-zinc-800 bg-neutral-950 p-4">
                      <h3 className="text-sm font-semibold text-zinc-200">
                        Detected Labels
                      </h3>

                      {result.labels.length > 0 ? (
                        <div className="mt-4 space-y-3">
                          {result.labels.map((label) => {
                            const confidence = getConfidence(label);
                            const type = getLabelType(label);

                            return (
                              <div
                                key={getLabelName(label)}
                                className="rounded-xl border border-zinc-800 bg-black p-4"
                              >
                                <div className="flex items-start justify-between gap-3">
                                  <div>
                                    <p className="font-medium text-zinc-100">
                                      {getLabelName(label)}
                                    </p>
                                    <p className="mt-1 text-xs text-zinc-500">
                                      {type}
                                    </p>
                                  </div>
                                  <span className="rounded-full border border-zinc-800 px-2.5 py-1 text-xs font-medium text-zinc-300">
                                    {confidence.toFixed(1)}%
                                  </span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <p className="mt-4 text-sm text-zinc-500">
                          No labels were returned for this image.
                        </p>
                      )}
                    </div>

                    <div className="rounded-2xl border border-zinc-800 bg-neutral-950 p-4">
                      <h3 className="text-sm font-semibold text-zinc-200">
                        Scene Description
                      </h3>
                      <p className="mt-3 text-sm leading-6 text-zinc-500">
                        Description will be generated from detected labels in
                        the next phase.
                      </p>
                    </div>
                  </aside>
                </div>
              </section>
            )}
          </div>
        ) : (
          <section className="mt-10 rounded-2xl border border-zinc-800 bg-zinc-950 p-10 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-zinc-800 bg-black text-zinc-500">
              -
            </div>
            <h2 className="mt-5 text-xl font-semibold tracking-tight">
              No past uploads yet
            </h2>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-zinc-500">
              Your analyzed images will appear here after DynamoDB history is
              connected.
            </p>
          </section>
        )}
      </section>
    </main>
  );
}
