"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

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

const API_URL = process.env.NEXT_PUBLIC_API_URL;

type PageState = "loading" | "error" | "success";

function getErrorMessage(data: unknown, fallback: string) {
  if (
    data &&
    typeof data === "object" &&
    "message" in data &&
    typeof data.message === "string"
  ) {
    return data.message;
  }

  return fallback;
}

function isLabelResult(value: unknown): value is LabelResult {
  return (
    value !== null &&
    typeof value === "object" &&
    "name" in value &&
    "confidence" in value &&
    typeof value.name === "string" &&
    typeof value.confidence === "string"
  );
}

function isResultResponse(value: unknown): value is ResultResponse {
  return (
    value !== null &&
    typeof value === "object" &&
    "imageId" in value &&
    "status" in value &&
    "objectKey" in value &&
    "imageUrl" in value &&
    "labels" in value &&
    typeof value.imageId === "string" &&
    typeof value.status === "string" &&
    typeof value.objectKey === "string" &&
    typeof value.imageUrl === "string" &&
    Array.isArray(value.labels) &&
    value.labels.every(isLabelResult)
  );
}

function formatConfidence(confidence: string) {
  const value = Number(confidence);

  if (!Number.isFinite(value)) {
    return {
      display: confidence,
      width: 0,
    };
  }

  return {
    display: value.toFixed(2),
    width: Math.min(Math.max(value, 0), 100),
  };
}

export default function ResultPage() {
  const params = useParams();
  const imageIdParam = params.imageId;
  const imageId =
    typeof imageIdParam === "string" ? decodeURIComponent(imageIdParam) : "";

  const [result, setResult] = useState<ResultResponse | null>(null);
  const [pageState, setPageState] = useState<PageState>("loading");
  const [message, setMessage] = useState("Loading result...");

  useEffect(() => {
    if (!imageId) {
      return;
    }

    async function fetchResult() {
      if (!API_URL) {
        setMessage("NEXT_PUBLIC_API_URL is missing.");
        setPageState("error");
        return;
      }

      try {
        setPageState("loading");
        setMessage("Loading Rekognition result...");

        const response = await fetch(`${API_URL}/results/${imageId}`);
        const data: unknown = await response.json();

        if (!response.ok) {
          throw new Error(getErrorMessage(data, "Failed to load result."));
        }

        if (!isResultResponse(data)) {
          throw new Error("The API returned an invalid result.");
        }

        setResult(data);
        setMessage("Result loaded successfully.");
        setPageState("success");
      } catch (error) {
        setMessage(
          error instanceof Error ? error.message : "Something went wrong."
        );
        setPageState("error");
      }
    }

    fetchResult();
  }, [imageId]);

  const hasLabels = Boolean(result?.labels.length);
  const visiblePageState: PageState = imageId ? pageState : "error";
  const visibleMessage = imageId ? message : "Result ID is missing or invalid.";

  return (
    <main className="min-h-screen overflow-hidden bg-[#020617] px-6 py-10 text-white">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_top_left,#1d4ed833,transparent_35%),radial-gradient(circle_at_top_right,#0ea5e933,transparent_35%)]" />

      <section className="relative mx-auto max-w-6xl">
        <div className="mb-8 flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.25em] text-blue-300">
              AWS Rekognition Result
            </p>
            <h1 className="mt-3 text-3xl font-bold md:text-5xl">
              Detected Image Labels
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400">
              Review the uploaded image and the labels returned by Amazon
              Rekognition.
            </p>
          </div>

          <Link
            href="/"
            className="inline-flex w-fit items-center justify-center rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-semibold text-slate-200 transition hover:bg-white/10"
          >
            Back to Upload
          </Link>
        </div>

        {visiblePageState === "loading" && (
          <div className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
            <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 shadow-2xl backdrop-blur">
              <div className="mb-4 h-6 w-40 animate-pulse rounded-full bg-white/10" />
              <div className="flex h-[420px] items-center justify-center rounded-2xl border border-white/10 bg-slate-950/70">
                <div className="h-12 w-12 animate-spin rounded-full border-4 border-blue-400/20 border-t-blue-400" />
              </div>
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 shadow-2xl backdrop-blur">
              <div className="mb-5 flex items-center justify-between">
                <div className="h-6 w-44 animate-pulse rounded-full bg-white/10" />
                <div className="h-7 w-24 animate-pulse rounded-full bg-blue-500/10" />
              </div>

              <div className="space-y-3">
                {[0, 1, 2, 3].map((item) => (
                  <div
                    key={item}
                    className="rounded-2xl border border-white/10 bg-slate-950/70 p-4"
                  >
                    <div className="mb-3 flex items-center justify-between">
                      <div className="h-4 w-28 animate-pulse rounded-full bg-white/10" />
                      <div className="h-4 w-14 animate-pulse rounded-full bg-blue-400/20" />
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-slate-800">
                      <div className="h-full w-2/3 animate-pulse rounded-full bg-blue-500/40" />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <p className="text-sm text-slate-400 lg:col-span-2">
              {visibleMessage}
            </p>
          </div>
        )}

        {visiblePageState === "error" && (
          <div className="rounded-3xl border border-red-500/20 bg-red-950/30 p-8 shadow-2xl">
            <p className="text-sm font-medium uppercase tracking-[0.2em] text-red-300">
              Result unavailable
            </p>
            <h2 className="mt-3 text-2xl font-semibold text-red-50">
              Could not load this result
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-red-100/80">
              {visibleMessage}
            </p>
            <Link
              href="/"
              className="mt-6 inline-flex rounded-2xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-950/40 transition hover:bg-blue-500"
            >
              Back to Upload
            </Link>
          </div>
        )}

        {visiblePageState === "success" && result && (
          <div className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
            <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 shadow-2xl backdrop-blur md:p-6">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-semibold">Uploaded Image</h2>
                  <p className="mt-1 text-sm text-slate-400">
                    Image analyzed by Rekognition
                  </p>
                </div>
                <span className="rounded-full bg-blue-500/10 px-3 py-1 text-xs font-medium text-blue-300">
                  S3
                </span>
              </div>

              <div className="overflow-hidden rounded-2xl border border-white/10 bg-slate-950/70">
                <img
                  src={result.imageUrl}
                  alt="Processed image"
                  className="h-[360px] w-full object-contain p-4 md:h-[460px]"
                />
              </div>

              <div className="mt-5 rounded-2xl border border-white/10 bg-slate-950/80 p-4 text-xs text-slate-500">
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

            <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 shadow-2xl backdrop-blur md:p-6">
              <div className="mb-5 flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-semibold">Detected Labels</h2>
                  <p className="mt-1 text-sm text-slate-400">
                    {hasLabels
                      ? `${result.labels.length} label${
                          result.labels.length === 1 ? "" : "s"
                        } returned`
                      : "No labels returned"}
                  </p>
                </div>
                <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-xs text-emerald-300">
                  {result.status}
                </span>
              </div>

              {!hasLabels && (
                <div className="rounded-2xl border border-dashed border-blue-400/30 bg-slate-950/70 p-8 text-center">
                  <h3 className="text-lg font-semibold text-slate-100">
                    No labels found
                  </h3>
                  <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-400">
                    Rekognition completed the request, but it did not return
                    any labels for this image.
                  </p>
                </div>
              )}

              {hasLabels && (
                <div className="grid gap-3 sm:grid-cols-2">
                  {result.labels.map((label) => {
                    const confidence = formatConfidence(label.confidence);

                    return (
                      <div
                        key={`${label.name}-${label.confidence}`}
                        className="rounded-2xl border border-white/10 bg-slate-950/70 p-4"
                      >
                        <div className="mb-3 flex items-start justify-between gap-3">
                          <span className="break-words font-medium text-slate-100">
                            {label.name}
                          </span>
                          <span className="shrink-0 rounded-full bg-blue-500/10 px-2.5 py-1 text-xs font-semibold text-blue-300">
                            {confidence.display}%
                          </span>
                        </div>

                        <div className="h-2 overflow-hidden rounded-full bg-slate-800">
                          <div
                            className="h-full rounded-full bg-blue-500"
                            style={{ width: `${confidence.width}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
