import type { ChangeEvent, DragEvent } from "react";

type UploadSectionProps = {
  file: File | null;
  previewUrl: string;
  loading: boolean;
  message: string;
  debugInfo: string;
  isError: boolean;
  onFileChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onDrop: (event: DragEvent<HTMLLabelElement>) => void;
  onAnalyze: () => void;
};

export function UploadSection({
  file,
  previewUrl,
  loading,
  message,
  debugInfo,
  isError,
  onFileChange,
  onDrop,
  onAnalyze,
}: UploadSectionProps) {
  const isAnalyzeDisabled = loading || !file;
  const buttonLabel = loading ? "Analyzing Image..." : "Analyze Image";

  return (
    <section className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4 sm:p-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Upload Image</h2>
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
          onDrop={onDrop}
          className="group flex min-h-80 cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-zinc-700 bg-neutral-950 p-8 text-center transition hover:border-zinc-500"
        >
          <input
            type="file"
            accept="image/png,image/jpeg"
            onChange={onFileChange}
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
          type="button"
          onClick={() => {
            if (isAnalyzeDisabled) return;
            onAnalyze();
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
  );
}
