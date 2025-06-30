"use client";

import { ImportPersonaFromChat } from "@/features/persona-page/persona-services/persona-service";
import { ChatThreadModel } from "@/features/chat-page/chat-services/models";
import { Button } from "@/features/ui/button";
import { LoadingIndicator } from "@/features/ui/loading";
import { Plus } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/features/ui/use-toast";

interface Props {
  chatThread: ChatThreadModel;
}

export default function AddPersonaButton({ chatThread }: Props) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  // Only show button if there's persona data to import
  if (!chatThread.personaMessage || chatThread.personaMessage.trim() === "") {
    return null;
  }

  const handleAdd = async () => {
    setIsLoading(true);
    try {
      const result = await ImportPersonaFromChat(chatThread);
      if (result.status === "OK") {
        toast({ title: "Persona added to your list!" });
      } else {
        toast({ 
          title: "Error", 
          description: result.errors?.map((e) => e.message).join(", ") ?? "Failed to add persona",
          variant: "destructive"
        });
      }
    } catch (error) {
      toast({ 
        title: "Error", 
        description: "An unexpected error occurred while adding the persona",
        variant: "destructive"
      });
      console.error("Error importing persona:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Button onClick={handleAdd} variant="outline" size="icon" aria-label="Add persona" disabled={isLoading}>
      {isLoading ? <LoadingIndicator isLoading /> : <Plus size={16} />}
    </Button>
  );
} 