// "use server"; // Temporarily removed to test return value issue
import "server-only";

import { ServerActionResponse } from "@/features/common/server-action-response";
import { GetBlob, UploadBlob } from "../../common/services/azure-storage";

const IMAGE_CONTAINER_NAME = "images";
const IMAGE_API_PATH = process.env.NEXTAUTH_URL + "/api/images";

export const GetBlobPath = (threadId: string, blobName: string): string => {
  return `${threadId}/${blobName}`;
};

export const UploadImageToStore = async (
  threadId: string,
  fileName: string,
  imageData: Buffer
): Promise<ServerActionResponse<string>> => {
  return await UploadBlob(
    IMAGE_CONTAINER_NAME,
    `${threadId}/${fileName}`,
    imageData
  );
};

export const GetImageFromStore = async (
  threadId: string,
  fileName: string
): Promise<ServerActionResponse<ReadableStream>> => {
  const blobPath = GetBlobPath(threadId, fileName);
  return await GetBlob(IMAGE_CONTAINER_NAME, blobPath);
};

export const GetImageUrl = (threadId: string, fileName: string): string => {
  // add threadId and fileName as query parameters t and img respectively
  const params = `?t=${threadId}&img=${fileName}`;

  return `${IMAGE_API_PATH}/${params}`;
};

export const GetThreadAndImageFromUrl = (
  urlString: string
): ServerActionResponse<{ threadId: string; imgName: string }> => {
  try {
    // Get threadId and img from query parameters t and img
    const url = new URL(urlString);
    const threadId = url.searchParams.get("t");
    const imgName = url.searchParams.get("img");

    // Check if threadId and img are valid
    if (!threadId || !imgName) {
      const errorResponse = {
        status: "ERROR" as const,
        errors: [
          {
            message:
              "Invalid URL, threadId and/or imgName not formatted correctly.",
          },
        ],
      };
      return errorResponse;
    }

    const successResponse = {
      status: "OK" as const,
      response: {
        threadId,
        imgName,
      },
    };
    return successResponse;

  } catch (error: any) {
    console.error("Error parsing URL in GetThreadAndImageFromUrl:", error);
    const catchResponse = {
      status: "ERROR" as const,
      errors: [
        {
          message: error?.message || "An unexpected error occurred parsing the image URL.",
        },
      ],
    };
    return catchResponse;
  }
};
