import { AI_NAME } from "@/features/theme/theme-config";
import { AzureChatCompletion, AzureChatCompletionAbort, ChatThreadModel } from "../models";
import { CreateChatMessage } from "../chat-message-service";
import { ChatCompletionChunk } from "openai/resources/chat/completions";
import { APIUserAbortError } from "openai";

export const OpenAIStream = (props: {
  runner: AsyncIterable<ChatCompletionChunk>;
  chatThread: ChatThreadModel;
}) => {
  const encoder = new TextEncoder();
  const { runner, chatThread } = props;

  const readableStream = new ReadableStream({
    async start(controller) {
      const streamResponse = (event: string, value: string) => {
        controller.enqueue(encoder.encode(`event: ${event}\n`));
        controller.enqueue(encoder.encode(`data: ${value}\n\n`));
      };

      let accumulatedMessage = "";
      let functionCallName = "";
      let functionCallArguments = "";
      let finalContent = "";
      let errorOccurred = false;

      try {
        for await (const chunk of runner) {
          const delta = chunk.choices[0]?.delta;

          if (delta?.content) {
            accumulatedMessage += delta.content;
            finalContent += delta.content;
            const response: AzureChatCompletion = {
              type: "content",
              response: chunk,
            };
            streamResponse(response.type, JSON.stringify(response));
          } else if (delta?.function_call) {
            if (delta.function_call.name) {
              functionCallName = delta.function_call.name;
            }
            if (delta.function_call.arguments) {
              functionCallArguments += delta.function_call.arguments;
            }
          } else if (chunk.choices[0]?.finish_reason) {
            const finishReason = chunk.choices[0].finish_reason;

            if (finishReason === "function_call") {
              await CreateChatMessage({
                name: functionCallName,
                content: functionCallArguments,
                role: "function",
                chatThreadId: chatThread.id,
              });

              const response: AzureChatCompletion = {
                type: "functionCall",
                response: { name: functionCallName, arguments: functionCallArguments },
              };
              streamResponse(response.type, JSON.stringify(response));

              functionCallName = "";
              functionCallArguments = "";

            } else if (finishReason === "stop") {
              await CreateChatMessage({
                name: AI_NAME,
                content: finalContent,
                role: "assistant",
                chatThreadId: props.chatThread.id,
              });

              const response: AzureChatCompletion = {
                type: "finalContent",
                response: finalContent,
              };
              streamResponse(response.type, JSON.stringify(response));
            }
          }
        }
      } catch (error: any) {
        errorOccurred = true;
        console.error("🔴 Stream error:", error);

        if (error instanceof APIUserAbortError) {
          console.log("Stream aborted by user.");
          const response: AzureChatCompletionAbort = {
            type: "abort",
            response: "Chat aborted by user.",
          };
          streamResponse(response.type, JSON.stringify(response));
        } else {
          const response: AzureChatCompletion = {
            type: "error",
            response: error.message || "An unexpected error occurred.",
          };
          streamResponse(response.type, JSON.stringify(response));

          if (finalContent) {
            try {
              await CreateChatMessage({
                name: AI_NAME,
                content: finalContent,
                role: "assistant",
                chatThreadId: props.chatThread.id,
              });
            } catch (saveError) {
              console.error("🔴 Error saving message after stream error:", saveError);
            }
          }
        }
      } finally {
        if (!errorOccurred) {
          if (finalContent.length > 0) {
          }
          controller.close();
        }
      }
    },
    cancel(reason) {
      console.log("Stream cancelled:", reason);
    }
  });

  return readableStream;
};
