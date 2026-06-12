import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Ban, ShieldCheck, Trash2, Search, ShieldPlus, ShieldMinus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { listAccounts, banAccount, unbanAccount, deleteAccount, setAdminRole } from "@/lib/admin-accounts.functions";

export const Route = createFileRoute("/_authenticated/admin/accounts")({
  component: AccountsPage,
});

function roleLabel(roles: string[]) {
  if (roles.includes("admin")) return { text: "أدمن", cls: "bg-primary/15 text-primary" };
  if (roles.includes("teacher")) return { text: "مدرّس", cls: "bg-blue-500/15 text-blue-400" };
  return { text: "طالب", cls: "bg-secondary text-muted-foreground" };
}

function AccountsPage() {
  const fetchAccounts = useServerFn(listAccounts);
  const ban = useServerFn(banAccount);
  const unban = useServerFn(unbanAccount);
  const del = useServerFn(deleteAccount);
  const qc = useQueryClient();
  const [q, setQ] = useState("");

  const { data: accounts = [], isLoading } = useQuery({
    queryKey: ["admin-accounts"],
    queryFn: () => fetchAccounts(),
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["admin-accounts"] });

  const banM = useMutation({
    mutationFn: (a: { userId: string; email: string }) => ban({ data: a }),
    onSuccess: () => { toast.success("تم حظر الحساب."); invalidate(); },
    onError: (e: any) => toast.error(e?.message ?? "تعذّر الحظر."),
  });
  const unbanM = useMutation({
    mutationFn: (a: { userId: string; email: string }) => unban({ data: a }),
    onSuccess: () => { toast.success("تم رفع الحظر."); invalidate(); },
    onError: (e: any) => toast.error(e?.message ?? "تعذّر رفع الحظر."),
  });
  const delM = useMutation({
    mutationFn: (a: { userId: string; email: string; alsoBan: boolean }) => del({ data: a }),
    onSuccess: () => { toast.success("تم حذف الحساب."); invalidate(); },
    onError: (e: any) => toast.error(e?.message ?? "تعذّر الحذف."),
  });

  const filtered = accounts.filter(
    (a) =>
      a.email.toLowerCase().includes(q.toLowerCase()) ||
      (a.full_name ?? "").toLowerCase().includes(q.toLowerCase()),
  );

  return (
    <div>
      <h1 className="text-2xl font-extrabold sm:text-3xl">
        كل <span className="text-gradient-gold">الحسابات</span>
      </h1>
      <p className="mt-2 text-muted-foreground">
        جميع الحسابات والإيميلات المسجّلة في المنصة ({accounts.length}).
      </p>

      <div className="relative mt-6 max-w-sm">
        <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="ابحث بالبريد أو الاسم..."
          className="w-full rounded-xl border border-input bg-background/60 px-10 py-2.5 text-sm outline-none focus:border-primary"
        />
      </div>

      {isLoading ? (
        <div className="mt-10 flex justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-2xl border border-border">
          <table className="w-full text-right text-sm">
            <thead className="bg-card/60 text-muted-foreground">
              <tr>
                <th className="p-3 font-bold">الاسم</th>
                <th className="p-3 font-bold">البريد الإلكتروني</th>
                <th className="p-3 font-bold">النوع</th>
                <th className="p-3 font-bold">الحالة</th>
                <th className="p-3 font-bold">إجراءات</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((a) => {
                const rl = roleLabel(a.roles);
                return (
                  <tr key={a.id} className="border-t border-border/60">
                    <td className="p-3 font-semibold">{a.full_name ?? "—"}</td>
                    <td className="p-3 text-muted-foreground">{a.email}</td>
                    <td className="p-3">
                      <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${rl.cls}`}>{rl.text}</span>
                    </td>
                    <td className="p-3">
                      {a.banned ? (
                        <span className="rounded-full bg-destructive/15 px-2.5 py-1 text-xs font-bold text-destructive">
                          محظور
                        </span>
                      ) : (
                        <span className="rounded-full bg-green-500/15 px-2.5 py-1 text-xs font-bold text-green-500">
                          نشط
                        </span>
                      )}
                    </td>
                    <td className="p-3">
                      <div className="flex flex-wrap gap-2">
                        {a.banned ? (
                          <button
                            onClick={() => unbanM.mutate({ userId: a.id, email: a.email })}
                            className="flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-xs font-bold hover:bg-accent"
                          >
                            <ShieldCheck className="h-3.5 w-3.5" /> رفع الحظر
                          </button>
                        ) : (
                          <button
                            onClick={() => banM.mutate({ userId: a.id, email: a.email })}
                            className="flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-xs font-bold text-destructive hover:bg-destructive/10"
                          >
                            <Ban className="h-3.5 w-3.5" /> حظر
                          </button>
                        )}
                        <button
                          onClick={() => {
                            if (confirm(`حذف حساب ${a.email} نهائيًا وحظره؟`))
                              delM.mutate({ userId: a.id, email: a.email, alsoBan: true });
                          }}
                          className="flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-xs font-bold text-destructive hover:bg-destructive/10"
                        >
                          <Trash2 className="h-3.5 w-3.5" /> حذف
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
