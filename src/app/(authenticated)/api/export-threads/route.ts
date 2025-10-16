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

    let userEmail: string | null = null;
    let providedLegacyId: string | null = null;

    if (isInternalRequest) {
      if (!configuredToken || providedToken !== configuredToken) {
        return NextResponse.json(
          { error: "Invalid internal token" },
          { status: 401 }
        );
      }

      const targetEmail = url.searchParams.get("userEmail")?.trim();
      const targetLegacyId = url.searchParams.get("legacyUserId")?.trim();

      if (!targetEmail && !targetLegacyId) {
        return NextResponse.json(
          {
            error:
              "Missing required userEmail or legacyUserId query parameter for internal export",
          },
          { status: 400 }
        );
      }

      if (targetEmail) {
        userEmail = targetEmail;
      } else {
        providedLegacyId = targetLegacyId!;
      }
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

    const format = url.searchParams.get("format");

    if (format === "portal" && !userEmail) {
      return NextResponse.json(
        {
          error:
            "Portal export requires userEmail. Provide userEmail alongside legacyUserId.",
        },
        { status: 400 }
      );
    }

    const container = HistoryContainer();
    const candidateHashes: string[] = [];

    if (providedLegacyId) {
      candidateHashes.push(providedLegacyId);
    } else if (userEmail) {
      const trimmedEmail = userEmail.trim();
      const directHash = hashValue(trimmedEmail);
      candidateHashes.push(directHash);

      const lowerEmail = trimmedEmail.toLowerCase();
      const lowerHash = hashValue(lowerEmail);
      if (lowerHash !== directHash) {
        candidateHashes.push(lowerHash);
      }
    }

    const uniqueCandidates = Array.from(new Set(candidateHashes)).filter(Boolean);

    if (uniqueCandidates.length === 0) {
      return NextResponse.json(
        { error: "Unable to resolve user partition for export." },
        { status: 400 }
      );
    }

    type FetchResult = {
      bundles: LegacyThreadBundle[];
      counts: {
        threads: number;
        messages: number;
        documents: number;
      };
    };

    const fetchPartitionData = async (partitionKey: string): Promise<FetchResult> => {
      const threadQuery: SqlQuerySpec = {
        query:
          "SELECT * FROM c WHERE c.type = @type AND c.userId = @userId AND c.isDeleted = false",
        parameters: [
          { name: "@type", value: CHAT_THREAD_ATTRIBUTE },
          { name: "@userId", value: partitionKey },
        ],
      };

      const messageQuery: SqlQuerySpec = {
        query:
          "SELECT * FROM c WHERE c.type = @type AND c.userId = @userId AND c.isDeleted = false",
        parameters: [
          { name: "@type", value: MESSAGE_ATTRIBUTE },
          { name: "@userId", value: partitionKey },
        ],
      };

      const documentQuery: SqlQuerySpec = {
        query:
          "SELECT * FROM c WHERE c.type = @type AND c.userId = @userId AND c.isDeleted = false",
        parameters: [
          { name: "@type", value: CHAT_DOCUMENT_ATTRIBUTE },
          { name: "@userId", value: partitionKey },
        ],
      };

      const [
        { resources: threads = [] },
        { resources: messages = [] },
        { resources: documents = [] },
      ] = await Promise.all([
        container.items
          .query<ChatThreadModel>(threadQuery, {
            partitionKey,
          })
          .fetchAll(),
        container.items
          .query<ChatMessageModel>(messageQuery, {
            partitionKey,
          })
          .fetchAll(),
        container.items
          .query<ChatDocumentModel>(documentQuery, {
            partitionKey,
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

      const bundles: LegacyThreadBundle[] = threads.map((thread) => ({
        thread,
        messages: sortByCreatedAt(messagesByThread.get(thread.id) ?? []),
        documents: documentsByThread.get(thread.id) ?? [],
      }));

      return {
        bundles,
        counts: {
          threads: threads.length,
          messages: messages.length,
          documents: documents.length,
        },
      };
    };

    let legacyUserId: string | null = null;
    let compiledThreads: LegacyThreadBundle[] = [];
    let lastCounts: FetchResult["counts"] = {
      threads: 0,
      messages: 0,
      documents: 0,
    };

    for (let i = 0; i < uniqueCandidates.length; i++) {
      const candidate = uniqueCandidates[i];
      const result = await fetchPartitionData(candidate);
      const hasContent =
        result.counts.threads > 0 ||
        result.counts.messages > 0 ||
        result.counts.documents > 0;

      legacyUserId = candidate;
      compiledThreads = result.bundles;
      lastCounts = result.counts;

      if (hasContent || i === uniqueCandidates.length - 1) {
        break;
      }
    }

    if (!legacyUserId) {
      return NextResponse.json(
        { error: "Unable to resolve user partition for export." },
        { status: 400 }
      );
    }

    if (
      lastCounts.threads === 0 &&
      lastCounts.messages === 0 &&
      lastCounts.documents === 0
    ) {
      console.warn(
        `Legacy export returned no content for partition ${legacyUserId}. Candidates tried: ${uniqueCandidates.join(
          ", "
        )}`
      );
    }

    if (format === "portal") {
      const portalPayload = {
        user: {
          email: userEmail!,
          legacyUserId,
        },
        threads: portalThreadShape(compiledThreads, userEmail!, legacyUserId),
      };

      return NextResponse.json(portalPayload, {
        headers: {
          "Content-Disposition": `attachment; filename="threads-portal-${legacyUserId}.json"`,
        },
      });
    }

    const responsePayload = {
      userId: userEmail ?? legacyUserId,
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
