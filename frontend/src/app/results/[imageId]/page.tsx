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

export default function ResultPage() {
  const params = useParams();
  const imageId = decodeURIComponent(params.imageId as string);

  const [result, setResult] = useState<ResultResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("Loading result...");

  useEffect(() => {
    async function fetchResult() {
      if (!API_URL) {
        setMessage("NEXT_PUBLIC_API_URL is missing.");
        setLoading(false);
        return;
      }

      try {
        const response = await fetch(`${API_URL}/results/${imageId}`);
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.message || "Failed to load result");
        }

        setResult(data);
        setMessage("Result loaded successfully.");
      } catch (error) {
        setMessage(
          error instanceof Error ? error.message : "Something went wrong."
        );
      } finally {
        setLoading(false);
      }
    }

    fetchResult();
  }, [imageId]);

  return (
    <main className="min-h-screen bg-[#020617] px-6 py-10 text-white">
      <section className="mx-auto max-w-5xl">
        <div className="mb-8 flex items-center justify-between gap-4">
          <div>
            <p className="text-sm uppercase tracking-[0.25em] text-blue-300">
              AWS Rekognition Result
            </p>
            <h1 className="mt-3 text-3xl font-bold md:text-5xl">
              Detected Image Labels
            </h1>
          </div>

          <Link
            href="/"
            className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-300 hover:bg-white/10"
          >
            Upload New
          </Link>
        </div>

        {loading && (
          <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-8 text-slate-300">
            {message}
          </div>
        )}

        {!loading && !result && (
          <div className="rounded-3xl border border-red-500/20 bg-red-950/30 p-8 text-red-100">
            {message}
          </div>
        )}

        {result && (
          <div className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
            <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
              <h2 className="mb-4 text-xl font-semibold">Processed Image</h2>

              <div className="overflow-hidden rounded-2xl border border-white/10 bg-slate-950/70">
                <img
                  src={result.imageUrl}
                  alt="Processed image"
                  className="h-[460px] w-full object-contain p-4"
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

            <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-xl font-semibold">Detected Labels</h2>
                <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-xs text-emerald-300">
                  {result.status}
                </span>
              </div>

              <div className="space-y-3">
                {result.labels.map((label) => {
                  const confidence = Number(label.confidence);
                  const width = Math.min(Math.max(confidence, 0), 100);

                  return (
                    <div
                      key={label.name}
                      className="rounded-2xl border border-white/10 bg-slate-950/70 p-4"
                    >
                      <div className="mb-2 flex items-center justify-between">
                        <span className="font-medium">{label.name}</span>
                        <span className="text-sm text-blue-300">
                          {label.confidence}%
                        </span>
                      </div>

                      <div className="h-2 overflow-hidden rounded-full bg-slate-800">
                        <div
                          className="h-full rounded-full bg-blue-500"
                          style={{ width: `${width}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}