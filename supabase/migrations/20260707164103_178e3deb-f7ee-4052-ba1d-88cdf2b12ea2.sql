revoke execute on function public.my_xp() from public, anon;
revoke execute on function public.leaderboard(integer) from public, anon;
revoke execute on function public.award_xp(uuid, text, integer) from public, anon;
revoke execute on function public.on_lesson_completed() from public, anon;
revoke execute on function public.on_enrolled() from public, anon;
grant execute on function public.my_xp() to authenticated;
grant execute on function public.leaderboard(integer) to authenticated;