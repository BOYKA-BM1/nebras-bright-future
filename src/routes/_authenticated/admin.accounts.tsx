import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Ban, ShieldCheck, Trash2, Search, UserCog, ChevronDown } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import {
  listAccounts,
  banAccount,
  unbanAccount,
  deleteAccount,
  setUserRole,
  ASSIGNABLE_ROLES,
} from "@/lib/admin-accounts.functions";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";

export const Route = createFileRoute("/_authenticated/admin/accounts")({
  component: AccountsPage,
});

type AppRoleName = (typeof ASSIGNABLE_ROLES)[number];

const ROLE_META: Record<AppRoleName, { text: string; cls: string }> = {
  admin: { text: "أدمن", cls: "bg-primary/15 text-primary" },
  teacher: { text: "مدرّس", cls: "bg-blue-500/15 text-blue-400" },
  student: { text: "طالب", cls: "bg-secondary text-muted-foreground" },
  customer_service: { text: "خدمة عملاء", cls: "bg-emerald-500/15 text-emerald-400" },
  secretary: { text: "سكرتير", cls: "bg-purple-500/15 text-purple-400" },
  montage: { text: "مونتاج", cls: "bg-orange-500/15 text-orange-400" },
};


function roleLabel(roles: string[]) {
  const order: AppRoleName[] = ["admin", "teacher", "customer_service", "secretary", "montage"];
  for (const r of order) {
    if (roles.includes(r)) return ROLE_META[r];
  }
  return ROLE_META.student;
}

function AccountsPage() {
  const fetchAccounts = useServerFn(listAccounts);
  const ban = useServerFn(banAccount);
  const unban = useServerFn(unbanAccount);
  const del = useServerFn(deleteAccount);
  const assignRole = useServerFn(setUserRole);

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
    mutationFn: (a: { userId: string; email: string }) => del({ data: { ...a, alsoBan: false } }),
    onSuccess: () => { toast.success("تم حذف الحساب."); invalidate(); },
    onError: (e: any) => toast.error(e?.message ?? "تعذّر الحذف."),
  });
  const roleM = useMutation({
    mutationFn: (a: { userId: string; role: AppRoleName }) => assignRole({ data: a }),
    onSuccess: (_d, v) => { toast.success(`تم تعيين الحساب كـ${ROLE_META[v.role].text}.`); invalidate(); },
    onError: (e: any) => toast.error(e?.message ?? "تعذّر تعيين الصلاحية."),
  });
  const resetDeviceM = useMutation({
    mutationFn: (a: { userId: string }) => resetDevice({ data: a }),
    onSuccess: () => { toast.success("تم إعادة تعيين الجهاز، يقدر يسجّل من جهاز جديد."); invalidate(); },
    onError: (e: any) => toast.error(e?.message ?? "تعذّر إعادة التعيين."),
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
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button className="flex items-center gap-1 rounded-lg border border-primary/40 px-2.5 py-1.5 text-xs font-bold text-primary hover:bg-primary/10">
                              <UserCog className="h-3.5 w-3.5" /> تعيين
                              <ChevronDown className="h-3 w-3" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="min-w-40">
                            {ASSIGNABLE_ROLES.map((r) => (
                              <DropdownMenuItem
                                key={r}
                                disabled={r === "student" ? a.roles.length === 0 : a.roles.includes(r)}
                                onClick={() => {
                                  if (confirm(`تعيين ${a.email} كـ${ROLE_META[r].text}؟`))
                                    roleM.mutate({ userId: a.id, role: r });
                                }}
                                className="cursor-pointer font-bold"
                              >
                                <span className={`ml-2 h-2 w-2 rounded-full ${ROLE_META[r].cls}`} />
                                {ROLE_META[r].text}
                              </DropdownMenuItem>
                            ))}
                          </DropdownMenuContent>
                        </DropdownMenu>





                        <button
                          onClick={() => {
                            if (confirm(`حذف حساب ${a.email} نهائيًا؟ (لن يتم حظره)`))
                              delM.mutate({ userId: a.id, email: a.email });
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
