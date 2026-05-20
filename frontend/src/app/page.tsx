"use client";

import { useEffect, useMemo, useState } from "react";

type BoundingBox = {
  Left?: number;
  Top?: number;
  Width?: number;
  Height?: number;
  left?: number;
  top?: number;
  width?: number;
  height?: number;
};

type LabelInstance = {
  BoundingBox?: BoundingBox;
  boundingBox?: BoundingBox;
  Confidence?: number | string;
  confidence?: number | string;
};

type LabelCategory =
  | string
  | {
  Name?: string;
  name?: string;
};

type FaceResult = {
  name?: string;
  confidence?: number | string;
  Confidence?: number | string;
  boundingBox?: BoundingBox;
  BoundingBox?: BoundingBox;
};

type LabelResult = {
  name?: string;
  Name?: string;
  confidence?: string;
  Confidence?: number | string;
  Instances?: LabelInstance[];
  instances?: LabelInstance[];
  Categories?: LabelCategory[];
  categories?: LabelCategory[];
};

type ResultResponse = {
  imageId: string;
  bucket?: string;
  status?: string;
  objectKey?: string;
  imageUrl?: string;
  labels?: LabelResult[];
  faces?: FaceResult[];
  createdAt?: string;
};

type PastUploadsResponse = {
  items?: ResultResponse[];
  count?: number;
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
  id: string;
  name: string;
  confidence: number;
  box: {
    Left: number;
    Top: number;
    Width: number;
    Height: number;
  };
  labelIndex: number;
};

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  "https://6qund1fwc8.execute-api.us-east-1.amazonaws.com";

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

function getInstanceConfidence(
  instance: LabelInstance,
  fallback: number | string | undefined
) {
  const value = instance.Confidence ?? instance.confidence ?? fallback ?? 0;
  const numberValue = Number(value);

  if (!Number.isFinite(numberValue)) {
    return 0;
  }

  return Math.min(Math.max(numberValue, 0), 100);
}

function getLabelType(label: LabelResult): LabelType {
  const name = getLabelName(label).toLowerCase();
  const categoryNames = (label.Categories || label.categories || [])
    .map((category) =>
      typeof category === "string"
        ? category.toLowerCase()
        : (category.Name || category.name)?.toLowerCase()
    )
    .filter((category): category is string => Boolean(category));

  if (name === "person" || categoryNames?.includes("person")) {
    return "Person";
  }

  if ((label.Instances || label.instances || []).some(hasBoundingBox)) {
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

function normalizeBoundingBox(box?: BoundingBox) {
  const left = box?.Left ?? box?.left;
  const top = box?.Top ?? box?.top;
  const width = box?.Width ?? box?.width;
  const height = box?.Height ?? box?.height;

  if (
    typeof left !== "number" ||
    typeof top !== "number" ||
    typeof width !== "number" ||
    typeof height !== "number"
  ) {
    return null;
  }

  return {
    Left: left,
    Top: top,
    Width: width,
    Height: height,
  };
}

function getInstanceBoundingBox(instance: LabelInstance) {
  return normalizeBoundingBox(instance.BoundingBox || instance.boundingBox);
}

function hasBoundingBox(instance: LabelInstance) {
  return Boolean(getInstanceBoundingBox(instance));
}

function getBoundingBoxLabels(labels: LabelResult[]): BoundingBoxLabel[] {
  return labels.flatMap((label, labelIndex) => {
    const instances = label.Instances || label.instances || [];
    const name = getLabelName(label);
    const labelConfidence = label.Confidence ?? label.confidence ?? 0;

    return instances.flatMap((instance, instanceIndex) => {
      const box = getInstanceBoundingBox(instance);

      if (!box) {
        return [];
      }

      return {
        id: `${name}-${labelIndex}-${instanceIndex}`,
        name,
        confidence: getInstanceConfidence(instance, labelConfidence),
        box,
        labelIndex,
      };
    });
  });
}

function getFaceBoundingBoxes(faces: FaceResult[] = []): BoundingBoxLabel[] {
  return faces.flatMap((face, faceIndex) => {
    const box = normalizeBoundingBox(face.BoundingBox || face.boundingBox);

    if (!box) {
      return [];
    }

    return {
      id: `${face.name || "Face"}-${faceIndex}`,
      name: face.name || `Face ${faceIndex + 1}`,
      confidence: getInstanceConfidence(
        {
          Confidence: face.Confidence,
          confidence: face.confidence,
        },
        0
      ),
      box,
      labelIndex: faceIndex + 100,
    };
  });
}

function formatUploadDate(value?: string) {
  if (!value) {
    return "Unknown date";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function getTopLabels(labels: LabelResult[] = []) {
  return labels
    .map((label) => ({
      name: getLabelName(label),
      confidence: getConfidence(label),
    }))
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 3);
}

export default function HomePage() {
  const [activeTab, setActiveTab] = useState<ActiveTab>("upload");
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [result, setResult] = useState<ResultResponse | null>(null);
  const [pastUploads, setPastUploads] = useState<ResultResponse[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyMessage, setHistoryMessage] = useState("");
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

      const resultResponse = await fetch(`${API_BASE_URL}/results/${imageId}`, {
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

  async function fetchPastUploads() {
    try {
      setHistoryLoading(true);
      setHistoryMessage("");

      const response = await fetch(`${API_BASE_URL}/results`, {
        method: "GET",
      });

      const data = (await response.json()) as PastUploadsResponse;

      if (!response.ok) {
        throw new Error(`Failed to load past uploads. Status: ${response.status}`);
      }

      setPastUploads(Array.isArray(data.items) ? data.items : []);
    } catch (error) {
      console.error(error);
      setPastUploads([]);
      setHistoryMessage(
        error instanceof Error ? error.message : "Failed to load past uploads."
      );
    } finally {
      setHistoryLoading(false);
    }
  }

  function handleTabChange(tab: ActiveTab) {
    setActiveTab(tab);

    if (tab === "past") {
      fetchPastUploads();
    }
  }

  function handleViewPastUpload(item: ResultResponse) {
    setResult(item);
    setMessage("");
    setDebugInfo("");
    setActiveTab("upload");
  }

  async function handleUpload() {
    if (!API_BASE_URL) {
      setMessage(
        "API base URL is missing. Check .env.local and restart npm run dev."
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

      const uploadUrlResponse = await fetch(`${API_BASE_URL}/upload-url`, {
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

      console.log(
        "labels with instances",
        (finalResult.labels || []).filter(
          (label) => (label.Instances || label.instances || []).length > 0
        )
      );
      console.log("faces with bounding boxes", finalResult.faces || []);

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
    () =>
      result
        ? [
            ...getBoundingBoxLabels(result.labels || []),
            ...getFaceBoundingBoxes(result.faces),
          ]
        : [],
    [result]
  );

  const generalLabels = useMemo(() => {
    if (!result) return [];

    return (result.labels || []).filter(
      (label) => !(label.Instances || label.instances || []).some(hasBoundingBox)
    );
  }, [result]);

  const isError = Boolean(message && !loading && !result);
  const buttonLabel = loading ? "Analyzing Image..." : "Analyze Image";
  const isAnalyzeDisabled = loading || !file;

  return (
    <main className="min-h-screen bg-black text-white">
      <div className="sticky top-0 z-30 border-b border-zinc-800 bg-black/85 backdrop-blur">
        <nav className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
          <button
            type="button"
            onClick={() => handleTabChange("upload")}
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
                onClick={() => handleTabChange(item.id as ActiveTab)}
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
                  onClick={() => {
                    if (isAnalyzeDisabled) return;
                    handleUpload();
                  }}
                  aria-disabled={isAnalyzeDisabled}
                  className={`inline-flex h-12 items-center justify-center rounded-xl px-6 text-sm font-semibold transition ${
                    isAnalyzeDisabled
                      ? "cursor-not-allowed bg-zinc-800 text-zinc-500"
                      : "bg-white text-black hover:bg-zinc-200"
                  }`}
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
                        {result.imageUrl ? (
                          <img
                            src={result.imageUrl}
                            alt="Analyzed image"
                            className="block h-auto w-full object-contain"
                          />
                        ) : (
                          <div className="flex h-80 items-center justify-center px-8 text-center text-sm text-zinc-600">
                            Image preview is unavailable for this result.
                          </div>
                        )}

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

                      {(result.labels || []).length > 0 ? (
                        <div className="mt-4 space-y-3">
                          {(result.labels || []).map((label) => {
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
          <section className="mt-10 rounded-2xl border border-zinc-800 bg-zinc-950 p-4 sm:p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="text-xl font-semibold tracking-tight">
                  Past Uploads
                </h2>
                <p className="mt-1 text-sm text-zinc-500">
                  Analyzed images stored in DynamoDB.
                </p>
              </div>

              <button
                type="button"
                onClick={fetchPastUploads}
                aria-disabled={historyLoading}
                className={`inline-flex h-10 items-center justify-center rounded-xl border px-4 text-sm font-medium transition ${
                  historyLoading
                    ? "cursor-not-allowed border-zinc-800 text-zinc-600"
                    : "border-zinc-700 text-zinc-200 hover:border-zinc-500 hover:bg-neutral-950"
                }`}
              >
                {historyLoading ? "Refreshing..." : "Refresh"}
              </button>
            </div>

            {historyMessage && (
              <p className="mt-5 rounded-xl border border-red-900/60 bg-red-950/30 px-4 py-3 text-sm text-red-200">
                {historyMessage}
              </p>
            )}

            {historyLoading && pastUploads.length === 0 ? (
              <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {[0, 1, 2].map((item) => (
                  <div
                    key={item}
                    className="h-80 animate-pulse rounded-2xl border border-zinc-800 bg-neutral-950"
                  />
                ))}
              </div>
            ) : pastUploads.length === 0 ? (
              <div className="py-14 text-center">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-zinc-800 bg-black text-zinc-500">
                  -
                </div>
                <h3 className="mt-5 text-xl font-semibold tracking-tight">
                  No past uploads yet
                </h3>
                <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-zinc-500">
                  Your analyzed images will appear here after DynamoDB history
                  is connected.
                </p>
              </div>
            ) : (
              <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {pastUploads.map((item) => {
                  const labels = item.labels || [];
                  const faces = item.faces || [];
                  const topLabels = getTopLabels(labels);

                  return (
                    <article
                      key={item.imageId}
                      className="overflow-hidden rounded-2xl border border-zinc-800 bg-neutral-950"
                    >
                      <div className="flex h-48 items-center justify-center border-b border-zinc-800 bg-black">
                        {item.imageUrl ? (
                          <img
                            src={item.imageUrl}
                            alt={item.imageId}
                            className="h-full w-full object-contain"
                          />
                        ) : (
                          <span className="px-6 text-center text-sm text-zinc-600">
                            Image unavailable
                          </span>
                        )}
                      </div>

                      <div className="space-y-4 p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-zinc-100">
                              {item.imageId}
                            </p>
                            <p className="mt-1 text-xs text-zinc-500">
                              {formatUploadDate(item.createdAt)}
                            </p>
                          </div>
                          <span className="shrink-0 rounded-full border border-emerald-900/70 bg-emerald-950/30 px-2.5 py-1 text-xs font-medium text-emerald-300">
                            {item.status || "UNKNOWN"}
                          </span>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          {topLabels.length > 0 ? (
                            topLabels.map((label) => (
                              <span
                                key={`${item.imageId}-${label.name}`}
                                className="rounded-full border border-zinc-800 bg-black px-2.5 py-1 text-xs text-zinc-300"
                              >
                                {label.name} {label.confidence.toFixed(1)}%
                              </span>
                            ))
                          ) : (
                            <span className="text-sm text-zinc-600">
                              No labels
                            </span>
                          )}
                        </div>

                        <div className="grid grid-cols-2 gap-3 text-sm">
                          <div className="rounded-xl border border-zinc-800 bg-black p-3">
                            <p className="text-xs text-zinc-500">Labels</p>
                            <p className="mt-1 font-semibold text-zinc-100">
                              {labels.length}
                            </p>
                          </div>
                          <div className="rounded-xl border border-zinc-800 bg-black p-3">
                            <p className="text-xs text-zinc-500">Faces</p>
                            <p className="mt-1 font-semibold text-zinc-100">
                              {faces.length}
                            </p>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleViewPastUpload(item)}
                          className="inline-flex h-10 w-full items-center justify-center rounded-xl bg-white px-4 text-sm font-semibold text-black transition hover:bg-zinc-200"
                        >
                          View Result
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        )}
      </section>
    </main>
  );
}
