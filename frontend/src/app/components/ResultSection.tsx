"use client";

import { useMemo, useState } from "react";
import { LABEL_COLORS } from "../lib/config";
import {
  generateSceneSummary,
  getBoundingBoxLabels,
  getConfidence,
  getDisplayImageUrl,
  getFaceBoundingBoxes,
  getLabelName,
  getLabelType,
  hasBoundingBox,
} from "../lib/result-utils";
import type { ResultResponse } from "../types";

type ResultSectionProps = {
  result: ResultResponse;
};

export function ResultSection({ result }: ResultSectionProps) {
  const [imageFailed, setImageFailed] = useState(false);
  const resultImageUrl = getDisplayImageUrl(result);

  const boundingBoxes = useMemo(
    () => [
      ...getBoundingBoxLabels(result.labels || []),
      ...getFaceBoundingBoxes(result.faces),
    ],
    [result]
  );

  const generalLabels = useMemo(
    () =>
      (result.labels || []).filter(
        (label) =>
          !(label.Instances || label.instances || []).some(hasBoundingBox)
      ),
    [result]
  );

  return (
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
              {resultImageUrl && !imageFailed ? (
                <img
                  src={resultImageUrl}
                  alt="Analyzed image"
                  className="block h-auto w-full object-contain"
                  onError={() => setImageFailed(true)}
                />
              ) : (
                <div className="flex h-80 items-center justify-center px-8 text-center text-sm text-zinc-600">
                  Image preview is unavailable for this result.
                </div>
              )}

              {resultImageUrl &&
                !imageFailed &&
                boundingBoxes.map((item) => {
                  const color =
                    LABEL_COLORS[item.labelIndex % LABEL_COLORS.length];

                  return (
                    <div
                      key={item.id}
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
              Scene Summary
            </h3>
            <p className="mt-3 text-sm leading-6 text-zinc-500">
              {generateSceneSummary(result)}
            </p>
          </div>

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
                          <p className="mt-1 text-xs text-zinc-500">{type}</p>
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
        </aside>
      </div>
    </section>
  );
}
