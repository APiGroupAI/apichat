"use server";
import "server-only";

import { userHashedId } from "@/features/auth-page/helpers";
import { OpenAIInstance, OpenAIModelInstance } from "@/features/common/services/openai";
import {
  ChatCompletionStreamingRunner,
  ChatCompletionStreamParams,
} from "openai/resources/beta/chat/completions";
import { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import { SimilaritySearch } from "../azure-ai-search/azure-ai-search";
import { CreateCitations, FormatCitations } from "../citation-service";
import { ChatCitationModel, ChatThreadModel } from "../models";

export const ChatApiRAG = async (props: {
  chatThread: ChatThreadModel;
  userMessage: string;
  history: ChatCompletionMessageParam[];
  signal: AbortSignal;
  model?: string;
  apiVersion?: string;
  modelType?: string;
}): Promise<ChatCompletionStreamingRunner> => {
  const { chatThread, userMessage, history, signal, model, apiVersion, modelType } = props;

  const openAI = OpenAIModelInstance(model, apiVersion);

  // Check if this is an o-series model that requires a developer message
  const isOSeriesModel = modelType === "o3_reasoning";
  
  // Add formatting prefix for o-series models to ensure markdown output
  const formattingPrefix = isOSeriesModel ? "Formatting re-enabled - please enclose code blocks with appropriate markdown tags.\n\n" : "";
  
  const documentResponse = await SimilaritySearch(
    userMessage,
    10,
    `user eq '${await userHashedId()}' and chatThreadId eq '${chatThread.id}'`
  );

  const documents: ChatCitationModel[] = [];

  if (documentResponse.status === "OK") {
    const withoutEmbedding = FormatCitations(documentResponse.response);
    const citationResponse = await CreateCitations(withoutEmbedding);

    citationResponse.forEach((c) => {
      if (c.status === "OK") {
        documents.push(c.response);
      }
    });
  }

  const content = documents
    .map((result, index) => {
      const content = result.content.document.pageContent;
      const context = `[${index}]. file name: ${result.content.document.metadata} \n file id: ${result.id} \n ${content}`;
      return context;
    })
    .join("\n------\n");
  // Augment the user prompt
  const _userMessage = `\n
- Review the following content from documents uploaded by the user and create a final answer.
- If you don't know the answer, just say that you don't know. Don't try to make up an answer.
- You must always include a citation at the end of your answer and don't include full stop after the citations.
- Use the format for your citation {% citation items=[{name:"filename 1",id:"file id"}, {name:"filename 2",id:"file id"}] /%}
----------------
content: 
${content}
\n
---------------- \n
question: 
${userMessage}
`;

  const stream: ChatCompletionStreamParams = {
    model: "",
    stream: true,
    messages: [
      {
        role: isOSeriesModel ? "developer" : "system",
        content: formattingPrefix + chatThread.personaMessage,
      },
      ...history,
      {
        role: "user",
        content: _userMessage,
      },
    ],
  };

  return openAI.beta.chat.completions.stream(stream, { signal });
};
