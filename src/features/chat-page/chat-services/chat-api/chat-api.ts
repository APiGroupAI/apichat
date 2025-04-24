"use server";
import "server-only";

import { getCurrentUser } from "@/features/auth-page/helpers";
import { CHAT_DEFAULT_SYSTEM_PROMPT } from "@/features/theme/theme-config";
import { ChatCompletionStreamingRunner } from "openai/resources/beta/chat/completions";
import { ChatApiRAG } from "../chat-api/chat-api-rag";
import { FindAllChatDocuments } from "../chat-document-service";
import {
  CreateChatMessage,
  FindTopChatMessagesForCurrentUser,
} from "../chat-message-service";
import { EnsureChatThreadOperation } from "../chat-thread-service";
import { ChatThreadModel, UserPrompt } from "../models";
import { mapOpenAIChatMessages } from "../utils";
import { GetDefaultExtensions } from "./chat-api-default-extensions";
import { GetDynamicExtensions } from "./chat-api-dynamic-extensions";
import { ChatApiExtensions } from "./chat-api-extension";
import { ChatApiMultimodal } from "./chat-api-multimodal";
import { OpenAIStream } from "./open-ai-stream";
import { OpenAI } from "openai";
type ChatTypes = "extensions" | "chat-with-file" | "multimodal";

export const ChatAPIEntry = async (props: UserPrompt, signal: AbortSignal) => {
  const currentChatThreadResponse = await EnsureChatThreadOperation(props.id);

  if (currentChatThreadResponse.status !== "OK") {
    return new Response("", { status: 401 });
  }

  const currentChatThread = currentChatThreadResponse.response;

  // promise all to get user, history and docs
  const [user, history, docs, extension] = await Promise.all([
    getCurrentUser(),
    _getHistory(currentChatThread),
    _getDocuments(currentChatThread),
    _getExtensions({
      chatThread: currentChatThread,
      userMessage: props.message,
      signal,
    }),
  ]);
  // Starting values for system and user prompt
  // Note that the system message will also get prepended with the extension execution steps. Please see ChatApiExtensions method.
  currentChatThread.personaMessage = `${CHAT_DEFAULT_SYSTEM_PROMPT} \n\n ${currentChatThread.personaMessage}`;

  let chatType: ChatTypes = "extensions";

  if (props.multimodalImage && props.multimodalImage.length > 0) {
    chatType = "multimodal";
  } else if (docs.length > 0) {
    chatType = "chat-with-file";
  } else if (extension.length > 0) {
    chatType = "extensions";
  }

  // save the user message
  await CreateChatMessage({
    name: user.name,
    content: props.message,
    role: "user",
    chatThreadId: currentChatThread.id,
    multiModalImage: props.multimodalImage,
  });

  // Get the model to use based on user selection
  const modelType = props.modelType || "default";
  
  // Default model uses AZURE_OPENAI_API_DEPLOYMENT_NAME
  // o3_reasoning model uses AZURE_OPENAI_O3_DEPLOYMENT_NAME with fallback to "o3"
  const model = modelType === "o3_reasoning" 
    ? (process.env.AZURE_OPENAI_O3_DEPLOYMENT_NAME || "o3") 
    : process.env.AZURE_OPENAI_API_DEPLOYMENT_NAME;
  
  // Use different API versions for different models
  // O3 model requires the latest API version (2024-02-01-preview or newer)
  const apiVersion = modelType === "o3_reasoning"
    ? process.env.AZURE_OPENAI_O3_API_VERSION || "2025-03-01-preview"  // Try env var first, then fall back to hardcoded value
    : process.env.AZURE_OPENAI_API_VERSION; // Use default API version for other models
    
  console.log(`Selected model type: ${modelType}, using deployment: ${model}, API version: ${apiVersion}`);

  let runner: ChatCompletionStreamingRunner;

  switch (chatType) {
    case "chat-with-file":
      runner = await ChatApiRAG({
        chatThread: currentChatThread,
        userMessage: props.message,
        history: history,
        signal: signal,
        model: model,
        apiVersion: apiVersion,
        modelType: modelType,
      });
      break;
    case "multimodal":
      runner = await ChatApiMultimodal({
        chatThread: currentChatThread,
        userMessage: props.message,
        file: props.multimodalImage,
        signal: signal,
        model: model,
        apiVersion: apiVersion,
        modelType: modelType,
      });
      break;
    case "extensions":
      runner = await ChatApiExtensions({
        chatThread: currentChatThread,
        userMessage: props.message,
        history: history,
        extensions: extension,
        signal: signal,
        model: model,
        apiVersion: apiVersion,
        modelType: modelType,
      });
      break;
  }

  const readableStream = OpenAIStream({
    runner: runner,
    chatThread: currentChatThread,
    modelType: modelType,
  });

  return new Response(readableStream, {
    headers: {
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "Content-Type": "text/event-stream"
    },
  });
};

const _getHistory = async (chatThread: ChatThreadModel) => {
  const historyResponse = await FindTopChatMessagesForCurrentUser(
    chatThread.id
  );

  if (historyResponse.status === "OK") {
    const historyResults = historyResponse.response;
    return mapOpenAIChatMessages(historyResults).reverse();
  }

  console.error("🔴 Error on getting history:", historyResponse.errors);

  return [];
};

const _getDocuments = async (chatThread: ChatThreadModel) => {
  const docsResponse = await FindAllChatDocuments(chatThread.id);

  if (docsResponse.status === "OK") {
    return docsResponse.response;
  }

  console.error("🔴 Error on AI search:", docsResponse.errors);
  return [];
};

const _getExtensions = async (props: {
  chatThread: ChatThreadModel;
  userMessage: string;
  signal: AbortSignal;
}) => {
  const extension: Array<any> = [];

  const response = await GetDefaultExtensions({
    chatThread: props.chatThread,
    userMessage: props.userMessage,
    signal: props.signal,
  });
  if (response.status === "OK" && response.response.length > 0) {
    extension.push(...response.response);
  }

  const dynamicExtensionsResponse = await GetDynamicExtensions({
    extensionIds: props.chatThread.extension,
  });
  if (
    dynamicExtensionsResponse.status === "OK" &&
    dynamicExtensionsResponse.response.length > 0
  ) {
    extension.push(...dynamicExtensionsResponse.response);
  }

  return extension;
};
