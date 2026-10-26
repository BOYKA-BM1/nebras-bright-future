import { createFileRoute, Link, Outlet } from "@tanstack/react-router";
import { Loader2, ShieldAlert } from "lucide-react";
import { useRoles } from "@/hooks/use-roles";

export const Route = createFileRoute("/_authenticated/admin")({
  component: AdminLayout,
});

function AdminLayout() {
  const { isAdmin, isLoading } = useRoles();

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-4 text-center">
        <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-destructive/15 text-destructive">
          <ShieldAlert className="h-8 w-8" />
        </span>
        <h1 className="text-2xl font-extrabold">غير مصرّح لك</h1>
        <p className="max-w-md text-muted-foreground">
          الصفحة دي مخصّصة لإدارة المنصة فقط. لو محتاج صلاحية أدمن تواصل مع المسؤول.
        </p>
        <Link to="/" className="rounded-xl bg-gradient-gold px-6 py-3 text-sm font-bold text-primary-foreground shadow-gold">
          الرجوع للرئيسية
        </Link>
      </div>
    );
  }

  return (
    <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
      <Outlet />
    </main>
  );
}
