"use client";

import { useState } from "react";
import {
  formatUploadDate,
  generateSceneSummary,
  getDisplayImageUrl,
  getTopLabels,
} from "../lib/result-utils";
import type { ResultResponse } from "../types";

type PastUploadsSectionProps = {
  items: ResultResponse[];
  loading: boolean;
  message: string;
  onRefresh: () => void;
  onViewResult: (item: ResultResponse) => void;
};

type PastUploadCardProps = {
  item: ResultResponse;
  onViewResult: (item: ResultResponse) => void;
};

function PastUploadCard({ item, onViewResult }: PastUploadCardProps) {
  const [imageFailed, setImageFailed] = useState(false);
  const imageUrl = getDisplayImageUrl(item);
  const labels = item.labels || [];
  const faces = item.faces || [];
  const topLabels = getTopLabels(labels);
  const sceneSummary = generateSceneSummary(item);

  return (
    <article className="overflow-hidden rounded-2xl border border-zinc-800 bg-neutral-950">
      <div className="flex h-[220px] items-center justify-center border-b border-zinc-800 bg-black">
        {imageUrl && !imageFailed ? (
          <img
            src={imageUrl}
            alt={item.imageId || "Analyzed upload"}
            className="h-full w-full object-cover"
            onError={() => setImageFailed(true)}
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
              {item.imageId || "Untitled upload"}
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
            <span className="text-sm text-zinc-600">No labels</span>
          )}
        </div>

        <p className="line-clamp-2 text-sm leading-6 text-zinc-500">
          {sceneSummary}
        </p>

        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="rounded-xl border border-zinc-800 bg-black p-3">
            <p className="text-xs text-zinc-500">Labels</p>
            <p className="mt-1 font-semibold text-zinc-100">{labels.length}</p>
          </div>
          <div className="rounded-xl border border-zinc-800 bg-black p-3">
            <p className="text-xs text-zinc-500">Faces</p>
            <p className="mt-1 font-semibold text-zinc-100">{faces.length}</p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => onViewResult(item)}
          className="inline-flex h-10 w-full items-center justify-center rounded-xl bg-white px-4 text-sm font-semibold text-black transition hover:bg-zinc-200"
        >
          View Result
        </button>
      </div>
    </article>
  );
}

export function PastUploadsSection({
  items,
  loading,
  message,
  onRefresh,
  onViewResult,
}: PastUploadsSectionProps) {
  return (
    <section className="mt-10 rounded-2xl border border-zinc-800 bg-zinc-950 p-4 sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Past Uploads</h2>
          <p className="mt-1 text-sm text-zinc-500">
            Analyzed images stored in DynamoDB.
          </p>
        </div>

        <button
          type="button"
          onClick={onRefresh}
          aria-disabled={loading}
          className={`inline-flex h-10 items-center justify-center rounded-xl border px-4 text-sm font-medium transition ${
            loading
              ? "cursor-not-allowed border-zinc-800 text-zinc-600"
              : "border-zinc-700 text-zinc-200 hover:border-zinc-500 hover:bg-neutral-950"
          }`}
        >
          {loading ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      {message && (
        <p className="mt-5 rounded-xl border border-red-900/60 bg-red-950/30 px-4 py-3 text-sm text-red-200">
          {message}
        </p>
      )}

      {loading && items.length === 0 ? (
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((item) => (
            <div
              key={item}
              className="h-80 animate-pulse rounded-2xl border border-zinc-800 bg-neutral-950"
            />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="py-14 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-zinc-800 bg-black text-zinc-500">
            -
          </div>
          <h3 className="mt-5 text-xl font-semibold tracking-tight">
            No past uploads yet
          </h3>
          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-zinc-500">
            Your analyzed images will appear here after DynamoDB history is
            connected.
          </p>
        </div>
      ) : (
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => (
            <PastUploadCard
              key={item.imageId}
              item={item}
              onViewResult={onViewResult}
            />
          ))}
        </div>
      )}
    </section>
  );
}
