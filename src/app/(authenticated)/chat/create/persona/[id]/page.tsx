import { DisplayError } from "@/features/ui/error/display-error";
import {
  CreatePersonaChat,
  FindPersonaForCurrentUser,
} from "@/features/persona-page/persona-services/persona-service";
import { redirect } from "next/navigation";

interface ChatCreatePersonaParams {
  params: {
    id: string;
  };
}

export default async function Page(props: ChatCreatePersonaParams) {
  const { id } = props.params;

  // Validate persona is accessible for current user
  const personaResponse = await FindPersonaForCurrentUser(id);
  if (personaResponse.status !== "OK") {
    return <DisplayError errors={personaResponse.errors} />;
  }

  // Create new chat thread based on persona
  const chatResponse = await CreatePersonaChat(id);
  if (chatResponse.status === "OK") {
    redirect(`/chat/${chatResponse.response.id}`);
  }

  return <DisplayError errors={chatResponse.errors} />;
} 