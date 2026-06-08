"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { saveVerifiedUser } from "@/lib/save-verified-user";
import { supabase } from "@/lib/supabase";

async function logUserCreatedActivity(userId: string, userEmail: string) {
  await supabase.from("activities").insert({
    type: "user_created",
    email: userEmail,
    user_id: userId,
  });
}

export default function AuthCallbackPage() {
  const router = useRouter();
  const [message, setMessage] = useState("Confirming your email...");

  useEffect(() => {
    let cancelled = false;

    async function confirmEmail() {
      const params = new URLSearchParams(window.location.search);
      const code = params.get("code");
      const tokenHash = params.get("token_hash");
      const type = params.get("type");

      try {
        if (code) {
          const { data, error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) throw error;
          if (data.user) {
            const saved = await saveVerifiedUser({
              id: data.user.id,
              email: data.user.email,
            });
            if (saved) {
              await logUserCreatedActivity(
                data.user.id,
                data.user.email ?? ""
              );
            }
          }
          if (!cancelled) router.replace("/login?verified=1");
          return;
        }

        if (tokenHash && type) {
          const { data, error } = await supabase.auth.verifyOtp({
            token_hash: tokenHash,
            type: type as "signup" | "email" | "recovery" | "invite",
          });
          if (error) throw error;
          if (data.user) {
            const saved = await saveVerifiedUser({
              id: data.user.id,
              email: data.user.email,
            });
            if (saved) {
              await logUserCreatedActivity(
                data.user.id,
                data.user.email ?? ""
              );
            }
          }
          if (!cancelled) router.replace("/login?verified=1");
          return;
        }

        const { data: sessionData } = await supabase.auth.getSession();
        if (sessionData.session?.user?.email_confirmed_at) {
          const u = sessionData.session.user;
          const saved = await saveVerifiedUser({
            id: u.id,
            email: u.email,
          });
          if (saved) {
            await logUserCreatedActivity(u.id, u.email ?? "");
          }
          if (!cancelled) router.replace("/login?verified=1");
          return;
        }

        if (!cancelled) {
          setMessage(
            "Could not confirm your email. Open the latest link from your inbox or enter the code on the login page."
          );
        }
      } catch (err: unknown) {
        if (!cancelled) {
          setMessage(
            err instanceof Error
              ? err.message
              : "Email confirmation failed. Request a new email from the login page."
          );
        }
      }
    }

    confirmEmail();
    return () => {
      cancelled = true;
    };
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#101828] text-[#60A5FA] px-6 text-center">
      <p>{message}</p>
    </div>
  );
}
