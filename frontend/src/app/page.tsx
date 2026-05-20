"use client";

import { useEffect, useState } from "react";
import type { ChangeEvent, DragEvent } from "react";
import { AppNavbar } from "./components/AppNavbar";
import { PastUploadsSection } from "./components/PastUploadsSection";
import { ResultSection } from "./components/ResultSection";
import { UploadSection } from "./components/UploadSection";
import { API_BASE_URL } from "./lib/config";
import { sleep } from "./lib/result-utils";
import type {
  ActiveTab,
  PastUploadsResponse,
  ResultResponse,
  UploadUrlResponse,
} from "./types";

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

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const selectedFile = event.target.files?.[0];
    if (!selectedFile) return;

    selectFile(selectedFile);
  }

  function handleDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();

    const selectedFile = event.dataTransfer.files?.[0];
    if (!selectedFile) return;

    selectFile(selectedFile);
  }

  async function getResultWithRetry(
    imageId: string,
    retries = 20,
    delay = 1500
  ) {
    for (let attempt = 1; attempt <= retries; attempt++) {
      setMessage(
        `Analyzing image with Rekognition... This can take a few seconds. (${attempt}/${retries})`
      );

      const response = await fetch(`${API_BASE_URL}/results/${imageId}`, {
        method: "GET",
      });

      if (response.ok) {
        const data = await response.json();
        const resultData = (data.item || data) as ResultResponse;

        if (!resultData.status || resultData.status === "COMPLETED") {
          return resultData;
        }
      }

      if (!response.ok && response.status !== 404) {
        const errorText = await response.text();
        throw new Error(errorText || "Failed to fetch result");
      }

      if (attempt < retries) {
        await sleep(delay);
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

      setMessage(
        "Analyzing image with Rekognition... This can take a few seconds."
      );

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

  const isError = Boolean(message && !loading && !result);

  return (
    <main className="min-h-screen bg-black text-white">
      <AppNavbar activeTab={activeTab} onTabChange={handleTabChange} />

      <section className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:py-14">
        <div className="max-w-3xl">
          <h1 className="text-4xl font-semibold tracking-tight text-white md:text-6xl">
            Image Labels Generator
          </h1>
        </div>

        {activeTab === "upload" ? (
          <div className="mt-10 space-y-6">
            <UploadSection
              file={file}
              previewUrl={previewUrl}
              loading={loading}
              message={message}
              debugInfo={debugInfo}
              isError={isError}
              onFileChange={handleFileChange}
              onDrop={handleDrop}
              onAnalyze={handleUpload}
            />

            {result && <ResultSection result={result} />}
          </div>
        ) : (
          <PastUploadsSection
            items={pastUploads}
            loading={historyLoading}
            message={historyMessage}
            onRefresh={fetchPastUploads}
            onViewResult={handleViewPastUpload}
          />
        )}
      </section>
    </main>
  );
}
