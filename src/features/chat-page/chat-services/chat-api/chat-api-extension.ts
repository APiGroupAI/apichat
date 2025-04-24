"use server";
import "server-only";

import { OpenAIInstance, OpenAIModelInstance } from "@/features/common/services/openai";
import { FindExtensionByID } from "@/features/extensions-page/extension-services/extension-service";
import { RunnableToolFunction } from "openai/lib/RunnableFunction";
import { ChatCompletionStreamingRunner } from "openai/resources/beta/chat/completions";
import { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import { ChatThreadModel } from "../models";
export const ChatApiExtensions = async (props: {
  chatThread: ChatThreadModel;
  userMessage: string;
  history: ChatCompletionMessageParam[];
  extensions: RunnableToolFunction<any>[];
  signal: AbortSignal;
  model?: string;
  apiVersion?: string;
  modelType?: string;
}): Promise<ChatCompletionStreamingRunner> => {
  const { userMessage, history, signal, chatThread, extensions, model, apiVersion, modelType } = props;

  const openAI = OpenAIModelInstance(model, apiVersion);
  const systemMessage = await extensionsSystemMessage(chatThread);
  
  // Check if this is an o-series model that requires a developer message
  const isOSeriesModel = modelType === "o3_reasoning";
  
  // Add formatting prefix for o-series models to ensure markdown output
  const formattingPrefix = isOSeriesModel ? "Formatting re-enabled - please enclose code blocks with appropriate markdown tags.\n\n" : "";
  
  return openAI.beta.chat.completions.runTools(
    {
      model: "",
      stream: true,
      messages: [
        {
          // Use developer role for o-series models, system for others
          role: isOSeriesModel ? "developer" : "system",
          content: formattingPrefix + chatThread.personaMessage + "\n" + systemMessage,
        },
        ...history,
        {
          role: "user",
          content: userMessage,
        },
      ],
      tools: extensions,
    },
    { signal: signal }
  );
};

const extensionsSystemMessage = async (chatThread: ChatThreadModel) => {
  let message = "";

  for (const e of chatThread.extension) {
    const extension = await FindExtensionByID(e);
    if (extension.status === "OK") {
      message += ` ${extension.response.executionSteps} \n`;
    }
  }

  return message;
};
