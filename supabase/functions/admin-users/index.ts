// Curlywave OS — admin-only user management (create logins, change role, deactivate, reset password)
import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

const ROLES = ["admin", "employee", "client"];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const url = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

  // Who is calling?
  const token = (req.headers.get("Authorization") ?? "").replace("Bearer ", "");
  const { data: who, error: whoErr } = await admin.auth.getUser(token);
  if (whoErr || !who?.user) return json({ error: "Not signed in" }, 401);
  const { data: me } = await admin.from("profiles").select("role,is_active").eq("id", who.user.id).single();
  if (!me || me.role !== "admin" || !me.is_active) return json({ error: "Admins only" }, 403);

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return json({ error: "Invalid JSON" }, 400); }
  const action = String(body.action ?? "");

  try {
    if (action === "create") {
      const email = String(body.email ?? "").trim().toLowerCase();
      const password = String(body.password ?? "");
      const role = String(body.role ?? "employee");
      const full_name = String(body.full_name ?? "").trim();
      if (!email || !email.includes("@")) return json({ error: "Valid email required" }, 400);
      if (password.length < 8) return json({ error: "Password must be at least 8 characters" }, 400);
      if (!ROLES.includes(role)) return json({ error: "Invalid role" }, 400);

      const { data, error } = await admin.auth.admin.createUser({
        email, password, email_confirm: true,
        app_metadata: { role }, user_metadata: { full_name },
      });
      if (error) return json({ error: error.message }, 400);

      await admin.from("profiles").update({
        role, full_name,
        designation: body.designation ? String(body.designation) : null,
        phone: body.phone ? String(body.phone) : null,
      }).eq("id", data.user.id);

      // Optionally link a client portal login to a client record.
      if (role === "client" && body.client_id) {
        await admin.from("clients").update({ portal_user_id: data.user.id }).eq("id", String(body.client_id));
      }
      return json({ ok: true, user_id: data.user.id });
    }

    const userId = String(body.user_id ?? "");
    if (!userId) return json({ error: "user_id required" }, 400);

    if (action === "update") {
      if (userId === who.user.id && (body.role !== undefined || body.is_active === false)) {
        return json({ error: "You cannot change your own role or deactivate yourself" }, 400);
      }
      const patch: Record<string, unknown> = {};
      for (const k of ["full_name", "designation", "phone"]) if (body[k] !== undefined) patch[k] = body[k];
      if (body.role !== undefined) {
        if (!ROLES.includes(String(body.role))) return json({ error: "Invalid role" }, 400);
        patch.role = body.role;
        await admin.auth.admin.updateUserById(userId, { app_metadata: { role: body.role } });
      }
      if (body.is_active !== undefined) {
        patch.is_active = !!body.is_active;
        await admin.auth.admin.updateUserById(userId, { ban_duration: body.is_active ? "none" : "876000h" });
      }
      const { error } = await admin.from("profiles").update(patch).eq("id", userId);
      if (error) return json({ error: error.message }, 400);
      return json({ ok: true });
    }

    if (action === "reset_password") {
      const password = String(body.password ?? "");
      if (password.length < 8) return json({ error: "Password must be at least 8 characters" }, 400);
      const { error } = await admin.auth.admin.updateUserById(userId, { password });
      if (error) return json({ error: error.message }, 400);
      return json({ ok: true });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});
