"use client";
import { useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { saveVerifiedUser } from "@/lib/save-verified-user";
import { LOGO_URL } from "@/lib/assets";
import { supabase } from "@/lib/supabase";
import Image from "next/image";
import { useAuth } from "@/context/AuthContext";
import DPTOneFashion from "../page";
import { useCart, CartItem } from "@/context/CartContext";

type AuthStep = "form" | "verify";

async function logUserCreatedActivity(userId: string, userEmail: string) {
  await supabase.from("activities").insert({
    type: "user_created",
    email: userEmail,
    user_id: userId,
  });
}

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [error, setError] = useState("");
  const [verifyMessage, setVerifyMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [authStep, setAuthStep] = useState<AuthStep>("form");

  const searchParams = useSearchParams();
  const router = useRouter();
  const [isRegistering, setIsRegistering] = useState(false);
  const { user, loading, refreshUser } = useAuth();
  const { addToCart, cartItems, cartLoading } = useCart();
  const [pendingAdded, setPendingAdded] = useState(false);
  const [emailError, setEmailError] = useState<string>("");
  const [passwordError, setPasswordError] = useState<string>("");
  const [confirmPasswordError, setConfirmPasswordError] = useState<string>("");

  useEffect(() => {
    if (loading) return;

    if (user && !user.emailVerified) {
      setEmail(user.email ?? "");
      setAuthStep("verify");
      return;
    }

    if (user?.emailVerified) {
      const pendingBuyNow =
        typeof window !== "undefined"
          ? localStorage.getItem("pendingBuyNowItem")
          : null;
      if (pendingBuyNow) {
        localStorage.removeItem("pendingBuyNowItem");
        router.push("/checkout?buyNow=1");
        return;
      }

      const pending =
        typeof window !== "undefined"
          ? localStorage.getItem("pendingCartItem")
          : null;
      if (pending) {
        try {
          const cartItem = JSON.parse(pending);
          if (cartItem && cartItem.id && cartItem.selectedSize) {
            const compositeKey = cartItem.selectedSize
              ? `${cartItem.id}-${cartItem.selectedSize}`
              : cartItem.id;
            const alreadyInCart = cartItems.some((item) => {
              const key = item.selectedSize
                ? `${item.id}-${item.selectedSize}`
                : item.id;
              return key === compositeKey;
            });
            if (!alreadyInCart && !pendingAdded) {
              addToCart(cartItem);
              setPendingAdded(true);
              return;
            }
            localStorage.removeItem("pendingCartItem");
            const buyNow = cartItem.buyNow;
            if (buyNow) {
              router.push(`/checkout?selected=${compositeKey}`);
            } else {
              router.push("/");
            }
            return;
          }
        } catch {
          /* ignore parse errors */
        }
        localStorage.removeItem("pendingCartItem");
        return;
      }
      router.push("/");
    }

    const signupParam = searchParams.get("signup");
    setIsRegistering(signupParam === "true");
  }, [
    searchParams,
    router,
    user,
    loading,
    cartItems,
    cartLoading,
    addToCart,
    pendingAdded,
  ]);

  useEffect(() => {
    if (searchParams.get("verified") !== "1") return;

    async function onVerifiedRedirect() {
      const { data } = await supabase.auth.getUser();
      const authUser = data.user;
      if (authUser?.email_confirmed_at) {
        const saved = await saveVerifiedUser({
          id: authUser.id,
          email: authUser.email,
        });
        if (saved) {
          await logUserCreatedActivity(authUser.id, authUser.email ?? "");
        }
      }
      await refreshUser();
      setShowModal(true);
    }

    onVerifiedRedirect();
  }, [searchParams, refreshUser]);

  useEffect(() => {
    if (showModal) {
      const timer = setTimeout(() => {
        router.push("/");
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [showModal, router]);

  const validateRegistration = () => {
    setEmailError("");
    setPasswordError("");
    setConfirmPasswordError("");
    let hasError = false;

    if (!email) {
      setEmailError("Email can't be blank");
      hasError = true;
    } else if (!/^\S+@\S+\.\S+$/.test(email)) {
      setEmailError("Email is invalid");
      hasError = true;
    }
    if (!password) {
      setPasswordError("Password can't be blank");
      hasError = true;
    } else if (password.length < 6) {
      setPasswordError("Password is too short (minimum is 6 characters)");
      hasError = true;
    }
    if (!confirmPassword) {
      setConfirmPasswordError("Confirm Password can't be blank");
      hasError = true;
    } else if (password !== confirmPassword) {
      setConfirmPasswordError("Passwords do not match");
      hasError = true;
    }

    return !hasError;
  };

  /** OTP emails use the Magic link template (not Confirm signup). */
  const sendOtpCode = async (createUser: boolean) => {
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: createUser },
    });
    if (error) throw error;
  };

  const handleRegister = async () => {
    if (!validateRegistration()) return;

    setIsLoading(true);
    setError("");
    setVerifyMessage("");

    try {
      await sendOtpCode(true);
      setAuthStep("verify");
      setVerifyMessage(
        "We sent a 6-digit code to your email. Enter it below (check spam if you do not see it)."
      );
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : "Could not send verification code.";
      if (message.toLowerCase().includes("confirmation mail")) {
        setError(
          `${message} — Check Supabase → Logs → Auth and SMTP (Gmail App Password, port 587).`
        );
      } else {
        setError(message);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignIn = async () => {
    if (!email || !password) {
      setError("Please enter both email and password.");
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      const { data, error: signInError } = await supabase.auth.signInWithPassword(
        { email, password }
      );
      if (signInError) throw signInError;

      if (!data.user?.email_confirmed_at) {
        await supabase.auth.signOut();
        await sendOtpCode(false);
        setAuthStep("verify");
        setVerifyMessage(
          "Your email is not verified yet. We sent a new 6-digit code — enter it below."
        );
        return;
      }

      setShowModal(true);
    } catch (err: unknown) {
      const authErr = err as { message?: string; code?: string };
      const code = authErr.code ?? "";
      const message = authErr.message ?? "Authentication failed.";

      if (
        code === "email_not_confirmed" ||
        message.toLowerCase().includes("email not confirmed")
      ) {
        setAuthStep("verify");
        try {
          await sendOtpCode(false);
          setVerifyMessage(
            "Your email is not verified yet. We sent a new 6-digit code — enter it below."
          );
        } catch {
          setVerifyMessage(
            "Your email is not verified yet. Use Resend code after 60 seconds."
          );
        }
        return;
      }

      if (
        code === "invalid_credentials" ||
        code === "auth/invalid-credential" ||
        code === "auth/wrong-password" ||
        code === "auth/user-not-found"
      ) {
        setError("Wrong email or password.");
      } else {
        setError(message);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setVerifyMessage("");

    const code = verificationCode.trim();
    if (!email) {
      setError("Email is required.");
      return;
    }
    if (!/^\d{6}$/.test(code)) {
      setError("Enter the 6-digit code from your email.");
      return;
    }

    setIsLoading(true);
    try {
      const { data, error: verifyError } = await supabase.auth.verifyOtp({
        email,
        token: code,
        type: "email",
      });
      if (verifyError) throw verifyError;

      if (isRegistering && password) {
        const { error: passwordError } = await supabase.auth.updateUser({
          password,
        });
        if (passwordError) throw passwordError;
      }

      await refreshUser();

      const verifiedUser = data.user;
      if (verifiedUser) {
        const saved = await saveVerifiedUser({
          id: verifiedUser.id,
          email: verifiedUser.email ?? email,
        });
        if (saved) {
          await logUserCreatedActivity(
            verifiedUser.id,
            verifiedUser.email ?? email
          );
        }
      }

      setShowModal(true);
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : "Invalid or expired code. Try again or resend.";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendCode = async () => {
    if (!email) {
      setError("Enter your email first.");
      return;
    }

    setIsLoading(true);
    setError("");
    setVerifyMessage("");
    try {
      await sendOtpCode(isRegistering);
      setVerifyMessage(
        "A new 6-digit code was sent. Check inbox and spam (wait at least 60 seconds between resends)."
      );
    } catch (err: unknown) {
      const authErr = err as { message?: string };
      const message = authErr.message ?? "Could not resend code.";
      if (message.toLowerCase().includes("rate limit")) {
        setError("Please wait 60 seconds before requesting another code.");
      } else if (message.toLowerCase().includes("confirmation mail")) {
        setError(
          `${message} Check Supabase → Logs → Auth and SMTP (username = full Gmail, App Password, port 587).`
        );
      } else {
        setError(message);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (isRegistering) {
      await handleRegister();
    } else {
      await handleSignIn();
    }
  };

  if (authStep === "verify") {
    return (
      <div className="relative min-h-screen w-full flex items-center justify-center">
        <div className="fixed inset-0 -z-10">
          <div className="absolute inset-0">
            <div className="w-full h-full">
              <div className="w-full h-full backdrop-blur-sm">
                <DPTOneFashion />
              </div>
            </div>
          </div>
        </div>
        <div className="fixed inset-0 bg-black/10 -z-10" />
        <div className="w-full max-w-md p-10 space-y-6 bg-[#101828] rounded-2xl shadow-2xl border border-[#60A5FA] relative text-[#60A5FA]">
          <button
            onClick={() => {
              setAuthStep("form");
              setVerificationCode("");
              setError("");
              setVerifyMessage("");
            }}
            className="absolute top-4 right-4 text-[#60A5FA] hover:text-white text-2xl font-bold"
          >
            &times;
          </button>
          <div className="flex justify-center mb-2">
            <Image
              src={LOGO_URL}
              alt="DPT ONE Logo"
              width={90}
              height={90}
              className="rounded-full shadow-lg"
              priority
              style={{ width: "90px", height: "90px" }}
            />
          </div>
          <h2 className="text-3xl font-extrabold mb-2 text-center tracking-tight">
            Enter verification code
          </h2>
          <p className="text-center text-sm mb-2">
            We sent a 6-digit code to{" "}
            <span className="font-semibold">{email}</span>
          </p>
          {verifyMessage && (
            <div className="text-sm text-center p-2 bg-[#19223a] rounded-md">
              {verifyMessage}
            </div>
          )}
          <form onSubmit={handleVerifyCode} className="space-y-4">
            <input
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              required
              className="w-full px-4 py-3 border-2 border-[#60A5FA] rounded-lg focus:ring-2 focus:ring-[#60A5FA] bg-[#19223a] text-[#60A5FA] placeholder-[#60A5FA] text-center text-2xl tracking-widest"
              placeholder="000000"
              value={verificationCode}
              onChange={(e) =>
                setVerificationCode(e.target.value.replace(/\D/g, ""))
              }
              disabled={isLoading}
            />
            {error && (
              <div className="text-red-600 text-sm text-center p-2 bg-red-50 rounded-md">
                {error}
              </div>
            )}
            <button
              type="submit"
              className={`w-full bg-[#60A5FA] text-[#101828] py-3 px-4 rounded-lg font-bold border-2 border-[#60A5FA] shadow-md hover:bg-[#3380c0] transition-colors ${isLoading ? "opacity-50 cursor-not-allowed" : ""}`}
              disabled={isLoading}
            >
              {isLoading ? "Verifying..." : "Verify & Continue"}
            </button>
          </form>
          <button
            type="button"
            onClick={handleResendCode}
            disabled={isLoading}
            className="w-full text-sm font-semibold hover:underline disabled:opacity-50"
          >
            Resend code
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen w-full flex items-center justify-center">
      <div className="fixed inset-0 -z-10">
        <div className="absolute inset-0">
          <div className="w-full h-full">
            <div className="w-full h-full backdrop-blur-sm">
              <DPTOneFashion />
            </div>
          </div>
        </div>
      </div>
      <div className="fixed inset-0 bg-black/10 -z-10" />
      <div className="w-full max-w-md p-10 space-y-6 bg-[#101828] rounded-2xl shadow-2xl border border-[#60A5FA] relative text-[#60A5FA]">
        <button
          onClick={() => router.push("/")}
          className="absolute top-4 right-4 text-[#60A5FA] hover:text-white text-2xl font-bold"
        >
          &times;
        </button>
        <div className="flex justify-center mb-2">
          <Image
            src={LOGO_URL}
            alt="DPT ONE Logo"
            width={90}
            height={90}
            className="rounded-full shadow-lg"
            priority
            style={{ width: "90px", height: "90px" }}
          />
        </div>
        <h2 className="text-3xl font-extrabold mb-2 text-center tracking-tight">
          {isRegistering ? "Sign Up" : "Sign In"}
        </h2>
        <p className="text-center mb-6 text-base">
          {isRegistering
            ? "Create your account to get started."
            : "Log in to your account."}
        </p>
        <form onSubmit={handleAuth} className="space-y-4">
          <input
            id="email"
            type="email"
            required
            className="w-full px-4 py-3 border-2 border-[#60A5FA] rounded-lg focus:ring-2 focus:ring-[#60A5FA] bg-[#19223a] text-[#60A5FA] placeholder-[#60A5FA]"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={isLoading}
          />
          {isRegistering && emailError && (
            <div className="text-red-600 text-xs mt-1">{emailError}</div>
          )}
          <input
            id="password"
            type="password"
            required
            className="w-full px-4 py-3 border-2 border-[#60A5FA] rounded-lg focus:ring-2 focus:ring-[#60A5FA] bg-[#19223a] text-[#60A5FA] placeholder-[#60A5FA]"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={isLoading}
          />
          {isRegistering && passwordError && (
            <div className="text-red-600 text-xs mt-1">{passwordError}</div>
          )}
          {isRegistering && (
            <>
              <input
                id="confirm-password"
                type="password"
                required
                className="w-full px-4 py-3 border-2 border-[#60A5FA] rounded-lg focus:ring-2 focus:ring-[#60A5FA] bg-[#19223a] text-[#60A5FA] placeholder-[#60A5FA]"
                placeholder="Confirm Password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={isLoading}
              />
              {confirmPasswordError && (
                <div className="text-red-600 text-xs mt-1">
                  {confirmPasswordError}
                </div>
              )}
            </>
          )}
          {error && (
            <div className="text-red-600 text-sm text-center p-2 bg-red-50 rounded-md">
              {error}
            </div>
          )}
          <button
            type="submit"
            className={`w-full bg-[#60A5FA] text-[#101828] py-3 px-4 rounded-lg font-bold border-2 border-[#60A5FA] shadow-md hover:bg-[#3380c0] transition-colors ${isLoading ? "opacity-50 cursor-not-allowed" : ""}`}
            disabled={isLoading}
          >
            {isLoading
              ? isRegistering
                ? "Registering..."
                : "Logging In..."
              : isRegistering
                ? "Sign Up"
                : "Sign In"}
          </button>
        </form>
        <div className="text-center text-sm mt-4">
          {isRegistering ? (
            <>
              Already have an account?{" "}
              <button
                onClick={() => setIsRegistering(false)}
                className="font-semibold hover:underline"
              >
                Sign In
              </button>
            </>
          ) : (
            <>
              Don&apos;t have an account?{" "}
              <button
                onClick={() => setIsRegistering(true)}
                className="font-semibold hover:underline"
              >
                Sign Up
              </button>
            </>
          )}
        </div>
      </div>
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-[#101828] border border-[#60A5FA] rounded-xl p-8 text-center text-[#60A5FA]">
            <p className="text-lg font-bold">
              {isRegistering ? "Account verified!" : "Welcome back!"}
            </p>
            <p className="text-sm mt-2">Redirecting...</p>
          </div>
        </div>
      )}
    </div>
  );
}
