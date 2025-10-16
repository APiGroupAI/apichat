"use client";

import { Button } from "@/features/ui/button";
import { useState } from "react";

const getFilenameFromHeader = (headerValue: string | null) => {
  if (!headerValue) {
    return null;
  }

  const matches = /filename\*?=(?:UTF-8'')?["']?([^"';]+)["']?/i.exec(headerValue);
  if (matches && matches[1]) {
    return decodeURIComponent(matches[1]);
  }

  return null;
};

export const ExportLegacyThreadsButton = () => {
  const [isLoading, setIsLoading] = useState(false);

  const handleExport = async () => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/export-threads?format=portal");
      if (!response.ok) {
        throw new Error(`Export failed with status ${response.status}`);
      }

      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      const fileName =
        getFilenameFromHeader(response.headers.get("Content-Disposition")) ??
        "legacy-threads.json";

      link.href = objectUrl;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(objectUrl);
    } catch (error) {
      console.error("Unable to export legacy threads", error);
      alert("Unable to export legacy threads. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Button onClick={handleExport} disabled={isLoading} variant="outline">
      {isLoading ? "Exporting..." : "Export legacy threads"}
    </Button>
  );
};
