"use server";
import "server-only";

import { OpenAIInstance, OpenAIModelInstance } from "@/features/common/services/openai";
import { ChatCompletionStreamingRunner } from "openai/resources/beta/chat/completions";
import { ChatThreadModel } from "../models";

export const ChatApiMultimodal = async (props: {
  chatThread: ChatThreadModel;
  userMessage: string;
  file: string;
  signal: AbortSignal;
  model?: string;
  apiVersion?: string;
  modelType?: string;
}): Promise<ChatCompletionStreamingRunner> => {
  const { chatThread, userMessage, signal, file, model, apiVersion, modelType } = props;

  const openAI = OpenAIModelInstance(model, apiVersion);

  // Check if this is an o-series model that requires a developer message
  const isOSeriesModel = modelType === "o3_reasoning";
  
  // Add formatting prefix for o-series models to ensure markdown output
  const formattingPrefix = isOSeriesModel ? "Formatting re-enabled - please enclose code blocks with appropriate markdown tags.\n\n" : "";

  return await openAI.beta.chat.completions.stream(
    {
      model: "",
      stream: true,
      max_tokens: 4096,
      messages: [
        {
          role: isOSeriesModel ? "developer" : "system",
          content:
            formattingPrefix + chatThread.personaMessage +
            "\n You are an expert in extracting insights from images that are uploaded to the chat. \n You will answer questions about the image that is provided.",
        },
        {
          role: "user",
          content: [
            { type: "text", text: userMessage },
            {
              type: "image_url",
              image_url: {
                url: file,
              },
            },
          ],
        },
      ],
    },
    { signal }
  );
};
