import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

export type BookmarkTargetType = "lesson" | "course";

export function useMyBookmarks(targetType?: BookmarkTargetType) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["my-bookmarks", user?.id, targetType],
    enabled: !!user,
    queryFn: async () => {
      let q = supabase.from("bookmarks").select("*").order("created_at", { ascending: false });
      if (targetType) q = q.eq("target_type", targetType);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useIsBookmarked(targetType: BookmarkTargetType, targetId: string | undefined) {
  const { data: bookmarks = [] } = useMyBookmarks(targetType);
  return !!targetId && bookmarks.some((b) => b.target_id === targetId);
}

export function useToggleBookmark() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ targetType, targetId, isBookmarked }: { targetType: BookmarkTargetType; targetId: string; isBookmarked: boolean }) => {
      if (!user) throw new Error("auth required");
      if (isBookmarked) {
        const { error } = await supabase.from("bookmarks").delete().eq("user_id", user.id).eq("target_type", targetType).eq("target_id", targetId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("bookmarks").insert({ user_id: user.id, target_type: targetType, target_id: targetId });
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["my-bookmarks"] }),
  });
}
