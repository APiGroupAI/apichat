import { DisplayError } from "@/features/ui/error/display-error";
import { CreatePersonaChat } from "@/features/persona-page/persona-services/persona-service";
import { redirect } from "next/navigation";

interface ChatCreatePersonaParams {
  params: {
    id: string;
  };
}

export default async function Page(props: ChatCreatePersonaParams) {
  const { id } = props.params;

  // Create new chat thread based on persona (no published restriction)
  const chatResponse = await CreatePersonaChat(id);
  if (chatResponse.status === "OK") {
    redirect(`/chat/${chatResponse.response.id}`);
  }

  return <DisplayError errors={chatResponse.errors} />;
} 