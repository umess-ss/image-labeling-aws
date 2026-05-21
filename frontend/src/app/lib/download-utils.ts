import type { ResultResponse } from "../types";
import { getConfidence, getLabelName, getLabelType } from "./result-utils";

function getSafeFilenamePart(value?: string) {
  return (value || "image-result").replace(/[^a-z0-9._-]+/gi, "-");
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function escapeCsvValue(value: string | number | undefined) {
  const text = String(value ?? "");

  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }

  return text;
}

export function downloadResultJson(result: ResultResponse) {
  const filename = `${getSafeFilenamePart(result.imageId)}-labels.json`;
  const blob = new Blob([JSON.stringify(result, null, 2)], {
    type: "application/json;charset=utf-8",
  });

  downloadBlob(blob, filename);
}

export function downloadResultCsv(result: ResultResponse) {
  const rows = [
    ["imageId", "label", "confidence", "type", "instanceCount"],
    ...(result.labels || []).map((label) => [
      result.imageId,
      getLabelName(label),
      getConfidence(label).toFixed(2),
      getLabelType(label),
      String((label.Instances || label.instances || []).length),
    ]),
  ];

  const csv = rows
    .map((row) => row.map((value) => escapeCsvValue(value)).join(","))
    .join("\n");

  const filename = `${getSafeFilenamePart(result.imageId)}-labels.csv`;
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });

  downloadBlob(blob, filename);
}
