import { createFileRoute, useParams } from "@tanstack/react-router";
import { AiChatWindow } from "@/components/site/AiChatWindow";

export const Route = createFileRoute("/_authenticated/ai/$threadId")({
  component: ThreadPage,
});

function ThreadPage() {
  const { threadId } = useParams({ from: "/_authenticated/ai/$threadId" });
  return <AiChatWindow key={threadId} conversationId={threadId} />;
}
