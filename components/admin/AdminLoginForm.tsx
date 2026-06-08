"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";

export default function AdminLoginForm({
  onLogin,
}: {
  onLogin: (email: string, password: string) => Promise<boolean>;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!email || !password) {
      setError("Please enter both email and password.");
      return;
    }
    setIsLoading(true);
    const success = await onLogin(email, password);
    if (!success) setError("Wrong admin user or password.");
    setIsLoading(false);
  };

  return (
    <div className="flex h-screen w-full bg-[#161e2e] overflow-hidden">
      <main className="flex-1 flex items-center justify-center">
        <div className="w-full max-w-md p-8 space-y-6 bg-[#161e2e] rounded-2xl shadow-2xl border border-[#22304a]">
          <div className="text-center">
            <h2 className="text-2xl font-bold mb-2 text-[#3390ff]">DPT ONE Admin</h2>
            <p className="text-[#8ec0ff]">Administrator Access Required</p>
          </div>
          <form onSubmit={handleSubmit} className="space-y-4">
            <input
              type="email"
              required
              className="w-full px-4 py-2 bg-[#22304a] border border-[#22304a] rounded-md focus:outline-none focus:ring-2 focus:ring-[#3390ff] text-white placeholder-[#8ec0ff]"
              placeholder="Admin Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
            />
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                required
                className="w-full px-4 py-2 bg-[#22304a] border border-[#22304a] rounded-md focus:outline-none focus:ring-2 focus:ring-[#3390ff] text-white placeholder-[#8ec0ff] pr-10"
                placeholder="Admin Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
              />
              <button
                type="button"
                tabIndex={-1}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-[#8ec0ff] hover:text-[#3390ff]"
                onClick={() => setShowPassword((v) => !v)}
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
            {error && (
              <div className="text-red-400 text-sm text-center p-2 bg-[#2a1a1a] rounded-md">
                {error}
              </div>
            )}
            <button
              type="submit"
              disabled={isLoading}
              className={`w-full bg-[#3390ff] text-white py-3 px-4 rounded-md font-semibold hover:bg-[#2360b7] ${isLoading ? "opacity-50" : ""}`}
            >
              {isLoading ? "Authenticating..." : "Access Admin Panel"}
            </button>
          </form>
          <div className="text-center">
            <button
              type="button"
              onClick={() => router.push("/")}
              className="text-[#8ec0ff] hover:underline text-sm"
            >
              ← Back to Home
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
