import { hashValue, userSession } from "@/features/auth-page/helpers";
import { HistoryContainer } from "@/features/common/services/cosmos";
import {
  CHAT_DOCUMENT_ATTRIBUTE,
  CHAT_THREAD_ATTRIBUTE,
  MESSAGE_ATTRIBUTE,
  ChatDocumentModel,
  ChatMessageModel,
  ChatThreadModel,
} from "@/features/chat-page/chat-services/models";
import { SqlQuerySpec } from "@azure/cosmos";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const preferredRegion = "auto";
export const maxDuration = 120;

type LegacyThreadBundle = {
  thread: ChatThreadModel;
  messages: ChatMessageModel[];
  documents: ChatDocumentModel[];
};

const sortByCreatedAt = <
  T extends { createdAt: string | Date }
>(
  items: T[]
) => {
  return [...items].sort((a, b) => {
    const left = new Date(a.createdAt).getTime();
    const right = new Date(b.createdAt).getTime();
    return left - right;
  });
};

const portalThreadShape = (
  threads: LegacyThreadBundle[],
  userEmail: string,
  legacyUserId: string
) => {
  return threads.map((bundle) => {
    const orderedMessages = sortByCreatedAt(bundle.messages);
    return {
      id: bundle.thread.id,
      userId: userEmail,
      name: bundle.thread.name,
      createdAt: bundle.thread.createdAt,
      lastMessageAt: bundle.thread.lastMessageAt,
      personaMessage: bundle.thread.personaMessage,
      personaMessageTitle: bundle.thread.personaMessageTitle,
      extension: bundle.thread.extension,
      metadata: {
        legacyTranscript: true,
        sourceLegacyUserId: legacyUserId,
      },
      messages: orderedMessages.map((message, index) => ({
        id: message.id,
        threadId: bundle.thread.id,
        index,
        role: message.role,
        content: message.content,
        name: message.name,
        createdAt: message.createdAt,
        multiModalImage: message.multiModalImage,
        modelType: message.modelType,
        metadata: {
          legacyTranscript: true,
          sourceThreadId: bundle.thread.id,
          sourceMessageId: message.id,
        },
      })),
      documents: bundle.documents.map((document) => ({
        id: document.id,
        name: document.name,
        createdAt: document.createdAt,
        metadata: {
          legacyTranscript: true,
          sourceThreadId: bundle.thread.id,
        },
      })),
    };
  });
};

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const providedToken = request.headers.get("x-internal-token");
    const configuredToken = process.env.EXPORT_THREADS_INTERNAL_TOKEN;
    const isInternalRequest = Boolean(providedToken);

    let userEmail: string;

    if (isInternalRequest) {
      if (!configuredToken || providedToken !== configuredToken) {
        return NextResponse.json(
          { error: "Invalid internal token" },
          { status: 401 }
        );
      }

      const targetEmail = url.searchParams.get("userEmail");
      if (!targetEmail) {
        return NextResponse.json(
          {
            error:
              "Missing required userEmail query parameter for internal export",
          },
          { status: 400 }
        );
      }

      userEmail = targetEmail;
    } else {
      const user = await userSession();

      if (!user) {
        return NextResponse.json(
          { error: "User not authenticated" },
          { status: 401 }
        );
      }

      userEmail = user.email;
    }

    const legacyUserId = hashValue(userEmail);
    const format = url.searchParams.get("format");

    const container = HistoryContainer();

    const threadQuery: SqlQuerySpec = {
      query:
        "SELECT * FROM c WHERE c.type = @type AND c.userId = @userId AND c.isDeleted = false",
      parameters: [
        { name: "@type", value: CHAT_THREAD_ATTRIBUTE },
        { name: "@userId", value: legacyUserId },
      ],
    };

    const messageQuery: SqlQuerySpec = {
      query:
        "SELECT * FROM c WHERE c.type = @type AND c.userId = @userId AND c.isDeleted = false",
      parameters: [
        { name: "@type", value: MESSAGE_ATTRIBUTE },
        { name: "@userId", value: legacyUserId },
      ],
    };

    const documentQuery: SqlQuerySpec = {
      query:
        "SELECT * FROM c WHERE c.type = @type AND c.userId = @userId AND c.isDeleted = false",
      parameters: [
        { name: "@type", value: CHAT_DOCUMENT_ATTRIBUTE },
        { name: "@userId", value: legacyUserId },
      ],
    };

    const [
      { resources: threads = [] },
      { resources: messages = [] },
      { resources: documents = [] },
    ] = await Promise.all([
      container.items
        .query<ChatThreadModel>(threadQuery, {
          partitionKey: legacyUserId,
        })
        .fetchAll(),
      container.items
        .query<ChatMessageModel>(messageQuery, {
          partitionKey: legacyUserId,
        })
        .fetchAll(),
      container.items
        .query<ChatDocumentModel>(documentQuery, {
          partitionKey: legacyUserId,
        })
        .fetchAll(),
    ]);

    const messagesByThread = new Map<string, ChatMessageModel[]>();
    messages.forEach((message) => {
      if (!messagesByThread.has(message.threadId)) {
        messagesByThread.set(message.threadId, []);
      }
      messagesByThread.get(message.threadId)!.push(message);
    });

    const documentsByThread = new Map<string, ChatDocumentModel[]>();
    documents.forEach((document) => {
      if (!documentsByThread.has(document.chatThreadId)) {
        documentsByThread.set(document.chatThreadId, []);
      }
      documentsByThread.get(document.chatThreadId)!.push(document);
    });

    const compiledThreads: LegacyThreadBundle[] = threads.map((thread) => ({
      thread,
      messages: sortByCreatedAt(messagesByThread.get(thread.id) ?? []),
      documents: documentsByThread.get(thread.id) ?? [],
    }));

    if (format === "portal") {
      const portalPayload = {
        user: {
          email: userEmail,
          legacyUserId,
        },
        threads: portalThreadShape(compiledThreads, userEmail, legacyUserId),
      };

      return NextResponse.json(portalPayload, {
        headers: {
          "Content-Disposition": `attachment; filename="threads-portal-${legacyUserId}.json"`,
        },
      });
    }

    const responsePayload = {
      userId: userEmail,
      legacyUserId,
      threads: compiledThreads,
    };

    return NextResponse.json(responsePayload, {
      headers: {
        "Content-Disposition": `attachment; filename="threads-${legacyUserId}.json"`,
      },
    });
  } catch (error) {
    console.error("Failed to export legacy threads", error);
    return NextResponse.json(
      { error: "Unable to export threads" },
      { status: 500 }
    );
  }
}
