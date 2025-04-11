import {
  GetImageFromStore,
  GetThreadAndImageFromUrl,
} from "./chat-image-service";

export const ImageAPIEntry = async (request: Request): Promise<Response> => {
  const urlPath = request.url;

  const response = GetThreadAndImageFromUrl(urlPath);

  if (response.status !== "OK") {
    const errorMessage = response.errors?.[0]?.message || "An unknown error occurred retrieving the image URL details.";
    return new Response(errorMessage, { status: 404 });
  }

  const { threadId, imgName } = response.response;
  const imageData = await GetImageFromStore(threadId, imgName);

  if (imageData.status === "OK") {
    return new Response(imageData.response, {
      headers: { "content-type": "image/png" },
    });
  } else {
    const errorMessage = imageData.errors?.[0]?.message || "An unknown error occurred retrieving the image data.";
    return new Response(errorMessage, { status: 404 });
  }
};
