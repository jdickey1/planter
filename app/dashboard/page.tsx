"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface User {
  id: number;
  email: string;
  subscription_status: "free" | "paid" | "cancelled";
  email_verified: boolean;
}

interface Business {
  id: number;
  name: string;
}

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [business, setBusiness] = useState<Business | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function checkAuth() {
      try {
        const res = await fetch("/api/auth/me");
        if (!res.ok) {
          router.push("/login");
          return;
        }
        const data = await res.json();
        setUser(data.user);

        // Also fetch business
        const bizRes = await fetch("/api/businesses");
        const bizData = await bizRes.json();
        if (bizData.business) {
          setBusiness(bizData.business);
        }
      } catch {
        router.push("/login");
      } finally {
        setLoading(false);
      }
    }
    checkAuth();
  }, [router]);

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/");
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#0F172A" }}>
        <div className="animate-pulse text-slate-400">Loading...</div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="min-h-screen" style={{ background: "#f8fafc" }}>
      {/* Header */}
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <Link href="/dashboard" className="text-xl font-bold no-underline">
            <span className="text-[#22C55E]">Link</span><span className="text-slate-900">Planter</span>
          </Link>
          <div className="flex items-center gap-4">
            <span className="text-sm text-slate-600">{user.email}</span>
            <span
              className="text-xs px-2 py-1 rounded-full font-medium"
              style={{
                background: user.subscription_status === "paid" ? "rgba(34,197,94,0.1)" : "rgba(100,116,139,0.1)",
                color: user.subscription_status === "paid" ? "#16a34a" : "#64748b"
              }}
            >
              {user.subscription_status === "paid" ? "Pro" : "Free"}
            </span>
            <button
              onClick={handleLogout}
              className="text-sm text-slate-500 hover:text-slate-700"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
          <p className="text-slate-600">Welcome back! Here is your directory submission overview.</p>
        </div>

        {/* Quick stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          {[
            { label: "Businesses", value: business ? "1" : "0", icon: "M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" },
            { label: "Active Campaigns", value: "0", icon: "M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" },
            { label: "Submissions", value: "0", icon: "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" },
            { label: "Backlinks Live", value: "0", icon: "M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" },
          ].map((stat) => (
            <div key={stat.label} className="bg-white rounded-xl p-6 border border-slate-200">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: "rgba(34,197,94,0.1)" }}>
                  <svg className="w-5 h-5 text-[#22C55E]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={stat.icon} />
                  </svg>
                </div>
              </div>
              <div className="text-2xl font-bold text-slate-900">{stat.value}</div>
              <div className="text-sm text-slate-500">{stat.label}</div>
            </div>
          ))}
        </div>

        {/* Business profile card */}
        {business ? (
          <div className="bg-white rounded-xl p-6 border border-slate-200 mb-8">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">{business.name}</h2>
                <p className="text-sm text-slate-500">Your business profile is set up and ready for submissions.</p>
              </div>
              <Link
                href="/dashboard/business"
                className="px-4 py-2 text-sm font-medium text-[#22C55E] hover:bg-green-50 rounded-lg transition-colors no-underline"
              >
                Edit Profile
              </Link>
            </div>
          </div>
        ) : (
          <div className="bg-gradient-to-r from-[#22C55E] to-[#16a34a] rounded-xl p-6 text-white mb-8">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold mb-1">Set up your business profile</h2>
                <p className="text-white/80">Add your business details to start submitting to directories.</p>
              </div>
              <Link
                href="/dashboard/business"
                className="inline-flex items-center justify-center px-6 py-3 bg-white text-[#16a34a] font-semibold rounded-lg hover:bg-slate-50 transition-colors no-underline"
              >
                Add Business
              </Link>
            </div>
          </div>
        )}

        {/* Get started */}
        <div className="bg-white rounded-xl p-8 border border-slate-200">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">Get Started</h2>
          <div className="grid md:grid-cols-3 gap-6">
            <Link href="/dashboard/business" className="block p-4 rounded-lg border border-slate-200 hover:border-[#22C55E] transition-colors no-underline">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center mb-3" style={{ background: business ? "rgba(34,197,94,0.1)" : "rgba(100,116,139,0.1)" }}>
                <span className={business ? "text-[#22C55E] font-bold" : "text-slate-400 font-bold"}>
                  {business ? "✓" : "1"}
                </span>
              </div>
              <h3 className="font-medium text-slate-900 mb-1">Add a business</h3>
              <p className="text-sm text-slate-500">
                {business ? "Business profile complete" : "Create a business profile with your details."}
              </p>
            </Link>
            <div className="p-4 rounded-lg border border-slate-200 hover:border-[#22C55E] transition-colors opacity-60">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center mb-3" style={{ background: "rgba(100,116,139,0.1)" }}>
                <span className="text-slate-400 font-bold">2</span>
              </div>
              <h3 className="font-medium text-slate-900 mb-1">Start a campaign</h3>
              <p className="text-sm text-slate-500">Choose directories and launch submissions.</p>
            </div>
            <div className="p-4 rounded-lg border border-slate-200 hover:border-[#22C55E] transition-colors opacity-60">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center mb-3" style={{ background: "rgba(100,116,139,0.1)" }}>
                <span className="text-slate-400 font-bold">3</span>
              </div>
              <h3 className="font-medium text-slate-900 mb-1">Track progress</h3>
              <p className="text-sm text-slate-500">Monitor your listings and backlinks.</p>
            </div>
          </div>
        </div>

        {/* Upgrade CTA for free users */}
        {user.subscription_status !== "paid" && (
          <div className="mt-8 rounded-xl p-6 text-white" style={{ background: "linear-gradient(135deg, #22C55E 0%, #16a34a 100%)" }}>
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <h3 className="text-lg font-semibold mb-1">Unlock all directories</h3>
                <p className="text-white/80">Upgrade to Pro for just $99/year and access 100+ premium directories.</p>
              </div>
              <Link
                href="/#pricing"
                className="inline-flex items-center justify-center px-6 py-3 bg-white text-[#16a34a] font-semibold rounded-lg hover:bg-slate-50 transition-colors no-underline"
              >
                Upgrade to Pro
              </Link>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
