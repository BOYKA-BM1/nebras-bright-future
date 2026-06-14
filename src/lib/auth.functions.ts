import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const confirmSchema = z.object({ email: z.string().email() });

export const confirmUserEmail = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => confirmSchema.parse(data))
  .handler(async ({ data }) => {
    const { data: users, error: listErr } = await supabaseAdmin.auth.admin.listUsers({ email: data.email });
    if (listErr) throw new Error("تعذّر التحقق من الحساب.");
    const user = users?.users?.[0];
    if (!user) throw new Error("الحساب غير موجود.");

    if (!user.email_confirmed_at) {
      const { error: updateErr } = await supabaseAdmin.auth.admin.updateUserById(user.id, {
        email_confirm: true,
      });
      if (updateErr) throw new Error("تعذّر تأكيد البريد الإلكتروني.");
    }
    return { confirmed: true };
  });
