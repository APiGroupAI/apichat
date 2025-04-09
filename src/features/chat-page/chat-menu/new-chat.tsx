"use client";

import { Button } from "@/features/ui/button";
import { LoadingIndicator } from "@/features/ui/loading";
import { Plus } from "lucide-react";
import { useState } from "react";
import { CreateChatThread } from "../chat-services/chat-thread-service";
import { RedirectToChatThread } from "@/features/common/navigation-helpers";
import { showError } from "@/features/globals/global-message-store";

type bSize = "default" | "sm" | "lg"

interface NewChatProps {
  size?: bSize;
  textSize?: string;
}

export const NewChat: React.FC<NewChatProps> = ({ size = "default", textSize}) => {
  const [isLoading, setIsLoading] = useState(false);
  const textStyle = { fontSize: textSize, fontWeight: "bold"}

  const handleNewChat = async () => {
    setIsLoading(true);
    try {
      const response = await CreateChatThread();
      if (response.status === "OK") {
        RedirectToChatThread(response.response.id);
      } else {
        showError(response.errors.map((e) => e.message).join(", "));
      }
    } catch (error) {
      showError("An unexpected error occurred while creating the chat.");
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Button
      disabled={isLoading}
      onClick={handleNewChat}
      size={size}
      className="flex gap-2"
      variant={"outline"}
    >
      {isLoading ? <LoadingIndicator isLoading={isLoading} /> : <Plus size={18} />}
      <span style={textStyle}>New Chat</span> {/* Apply custom text styles here */}
    </Button>
  );
};
