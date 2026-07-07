import { createFileRoute } from "@tanstack/react-router";
import { AiChatWindow } from "@/components/site/AiChatWindow";

export const Route = createFileRoute("/_authenticated/ai/")({
  component: () => <AiChatWindow conversationId={null} />,
});
