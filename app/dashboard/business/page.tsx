"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface Business {
  id?: number;
  name: string;
  website_url: string;
  email: string;
  phone: string;
  description_short: string;
  description_long: string;
  logo_url: string;
  address_line1: string;
  address_line2: string;
  city: string;
  state: string;
  postal_code: string;
  country: string;
  social_facebook: string;
  social_twitter: string;
  social_linkedin: string;
  social_instagram: string;
  target_anchor_text: string;
  secondary_anchor_text_1: string;
  secondary_anchor_text_2: string;
  secondary_anchor_text_3: string;
}

interface User {
  id: number;
  email: string;
  subscription_status: "free" | "paid" | "cancelled";
}

const emptyBusiness: Business = {
  name: "",
  website_url: "",
  email: "",
  phone: "",
  description_short: "",
  description_long: "",
  logo_url: "",
  address_line1: "",
  address_line2: "",
  city: "",
  state: "",
  postal_code: "",
  country: "United States",
  social_facebook: "",
  social_twitter: "",
  social_linkedin: "",
  social_instagram: "",
  target_anchor_text: "",
  secondary_anchor_text_1: "",
  secondary_anchor_text_2: "",
  secondary_anchor_text_3: "",
};

export default function BusinessPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [business, setBusiness] = useState<Business>(emptyBusiness);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [autofilling, setAutofilling] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    async function loadData() {
      try {
        // Check auth
        const authRes = await fetch("/api/auth/me");
        if (!authRes.ok) {
          router.push("/login");
          return;
        }
        const authData = await authRes.json();
        setUser(authData.user);

        // Load existing business
        const bizRes = await fetch("/api/businesses");
        const bizData = await bizRes.json();
        if (bizData.business) {
          const biz = bizData.business;
          // Convert secondary_anchor_texts array to individual fields
          const secondaryTexts = biz.secondary_anchor_texts || [];
          setBusiness({
            ...emptyBusiness,
            ...biz,
            target_anchor_text: biz.target_anchor_text || "",
            secondary_anchor_text_1: secondaryTexts[0] || "",
            secondary_anchor_text_2: secondaryTexts[1] || "",
            secondary_anchor_text_3: secondaryTexts[2] || "",
          });
        }
      } catch {
        router.push("/login");
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [router]);

  const handleAutofill = useCallback(async () => {
    if (!business.website_url) {
      setError("Enter a website URL first");
      return;
    }

    setAutofilling(true);
    setError("");

    try {
      const res = await fetch("/api/businesses/autofill", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: business.website_url }),
      });

      const result = await res.json();

      if (!res.ok) {
        setError(result.error || "Could not fetch website data");
        return;
      }

      // Merge autofill data with existing data (don't overwrite user edits)
      setBusiness((prev) => ({
        ...prev,
        website_url: result.website_url || prev.website_url,
        name: result.data.name || prev.name,
        description_short: result.data.description_short || prev.description_short,
        email: result.data.email || prev.email,
        phone: result.data.phone || prev.phone,
        logo_url: result.data.logo_url || prev.logo_url,
        social_facebook: result.data.social_facebook || prev.social_facebook,
        social_twitter: result.data.social_twitter || prev.social_twitter,
        social_linkedin: result.data.social_linkedin || prev.social_linkedin,
        social_instagram: result.data.social_instagram || prev.social_instagram,
        target_anchor_text: result.data.suggested_anchor_text || prev.target_anchor_text,
      }));

      setSuccess("Data fetched from website. Review and complete the remaining fields.");
    } catch {
      setError("Could not fetch website data");
    } finally {
      setAutofilling(false);
    }
  }, [business.website_url]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!business.name) {
      setError("Business name is required");
      return;
    }

    setSaving(true);

    try {
      // Convert secondary anchor text fields to array
      const secondary_anchor_texts = [
        business.secondary_anchor_text_1,
        business.secondary_anchor_text_2,
        business.secondary_anchor_text_3,
      ].filter(text => text.trim() !== "");

      const businessData = {
        ...business,
        secondary_anchor_texts: secondary_anchor_texts.length > 0 ? secondary_anchor_texts : null,
      };

      const res = await fetch("/api/businesses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(businessData),
      });

      const result = await res.json();

      if (!res.ok) {
        setError(result.error || "Could not save business");
        return;
      }

      // Convert secondary_anchor_texts array back to individual fields
      const biz = result.business;
      const secondaryTexts = biz.secondary_anchor_texts || [];
      setBusiness({
        ...emptyBusiness,
        ...biz,
        target_anchor_text: biz.target_anchor_text || "",
        secondary_anchor_text_1: secondaryTexts[0] || "",
        secondary_anchor_text_2: secondaryTexts[1] || "",
        secondary_anchor_text_3: secondaryTexts[2] || "",
      });
      setSuccess(result.created ? "Business profile created!" : "Business profile updated!");
    } catch {
      setError("Something went wrong");
    } finally {
      setSaving(false);
    }
  }

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
            <Link href="/dashboard" className="text-sm text-slate-600 hover:text-slate-900 no-underline">
              Dashboard
            </Link>
            <button onClick={handleLogout} className="text-sm text-slate-500 hover:text-slate-700">
              Sign out
            </button>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-slate-900">Business Profile</h1>
          <p className="text-slate-600">Add your business details. This information will be used for directory submissions.</p>
        </div>

        {/* Autofill section */}
        <div className="bg-white rounded-xl p-6 border border-slate-200 mb-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">Quick Start: Auto-fill from Website</h2>
          <p className="text-sm text-slate-600 mb-4">
            Enter your website URL and we will try to extract your business information automatically.
          </p>
          <div className="flex gap-3">
            <input
              type="url"
              value={business.website_url}
              onChange={(e) => setBusiness({ ...business, website_url: e.target.value })}
              placeholder="https://yourwebsite.com"
              className="flex-1 px-4 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#22C55E] focus:border-transparent"
            />
            <button
              type="button"
              onClick={handleAutofill}
              disabled={autofilling}
              className="px-6 py-2 bg-[#22C55E] text-white font-medium rounded-lg hover:bg-[#16a34a] transition-colors disabled:opacity-50"
            >
              {autofilling ? "Fetching..." : "Auto-fill"}
            </button>
          </div>
        </div>

        {/* Messages */}
        {error && (
          <div className="mb-6 p-4 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
            {error}
          </div>
        )}
        {success && (
          <div className="mb-6 p-4 rounded-lg bg-green-50 border border-green-200 text-green-700 text-sm">
            {success}
          </div>
        )}

        {/* Business form */}
        <form onSubmit={handleSubmit}>
          <div className="bg-white rounded-xl p-6 border border-slate-200 space-y-6">
            {/* Basic info */}
            <div>
              <h3 className="text-md font-semibold text-slate-900 mb-4">Basic Information</h3>
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Business Name *</label>
                  <input
                    type="text"
                    value={business.name}
                    onChange={(e) => setBusiness({ ...business, name: e.target.value })}
                    required
                    className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#22C55E]"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Website URL</label>
                  <input
                    type="url"
                    value={business.website_url}
                    onChange={(e) => setBusiness({ ...business, website_url: e.target.value })}
                    className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#22C55E]"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                  <input
                    type="email"
                    value={business.email}
                    onChange={(e) => setBusiness({ ...business, email: e.target.value })}
                    className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#22C55E]"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Phone</label>
                  <input
                    type="tel"
                    value={business.phone}
                    onChange={(e) => setBusiness({ ...business, phone: e.target.value })}
                    className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#22C55E]"
                  />
                </div>
              </div>
            </div>

            {/* Descriptions */}
            <div>
              <h3 className="text-md font-semibold text-slate-900 mb-4">Description</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Short Description <span className="text-slate-400">(max 500 chars, for directory listings)</span>
                  </label>
                  <textarea
                    value={business.description_short}
                    onChange={(e) => setBusiness({ ...business, description_short: e.target.value.substring(0, 500) })}
                    rows={3}
                    maxLength={500}
                    className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#22C55E]"
                  />
                  <div className="text-xs text-slate-400 mt-1">{business.description_short.length}/500</div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Long Description <span className="text-slate-400">(optional, for detailed listings)</span>
                  </label>
                  <textarea
                    value={business.description_long}
                    onChange={(e) => setBusiness({ ...business, description_long: e.target.value })}
                    rows={5}
                    className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#22C55E]"
                  />
                </div>
              </div>
            </div>

            {/* Address */}
            <div>
              <h3 className="text-md font-semibold text-slate-900 mb-4">Address</h3>
              <div className="grid md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-1">Address Line 1</label>
                  <input
                    type="text"
                    value={business.address_line1}
                    onChange={(e) => setBusiness({ ...business, address_line1: e.target.value })}
                    className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#22C55E]"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-1">Address Line 2</label>
                  <input
                    type="text"
                    value={business.address_line2}
                    onChange={(e) => setBusiness({ ...business, address_line2: e.target.value })}
                    className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#22C55E]"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">City</label>
                  <input
                    type="text"
                    value={business.city}
                    onChange={(e) => setBusiness({ ...business, city: e.target.value })}
                    className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#22C55E]"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">State/Province</label>
                  <input
                    type="text"
                    value={business.state}
                    onChange={(e) => setBusiness({ ...business, state: e.target.value })}
                    className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#22C55E]"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Postal Code</label>
                  <input
                    type="text"
                    value={business.postal_code}
                    onChange={(e) => setBusiness({ ...business, postal_code: e.target.value })}
                    className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#22C55E]"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Country</label>
                  <input
                    type="text"
                    value={business.country}
                    onChange={(e) => setBusiness({ ...business, country: e.target.value })}
                    className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#22C55E]"
                  />
                </div>
              </div>
            </div>

            {/* Social Media */}
            <div>
              <h3 className="text-md font-semibold text-slate-900 mb-4">Social Media</h3>
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Facebook</label>
                  <input
                    type="url"
                    value={business.social_facebook}
                    onChange={(e) => setBusiness({ ...business, social_facebook: e.target.value })}
                    placeholder="https://facebook.com/..."
                    className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#22C55E]"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Twitter/X</label>
                  <input
                    type="url"
                    value={business.social_twitter}
                    onChange={(e) => setBusiness({ ...business, social_twitter: e.target.value })}
                    placeholder="https://twitter.com/..."
                    className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#22C55E]"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">LinkedIn</label>
                  <input
                    type="url"
                    value={business.social_linkedin}
                    onChange={(e) => setBusiness({ ...business, social_linkedin: e.target.value })}
                    placeholder="https://linkedin.com/company/..."
                    className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#22C55E]"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Instagram</label>
                  <input
                    type="url"
                    value={business.social_instagram}
                    onChange={(e) => setBusiness({ ...business, social_instagram: e.target.value })}
                    placeholder="https://instagram.com/..."
                    className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#22C55E]"
                  />
                </div>
              </div>
            </div>

            {/* SEO Settings */}
            <div>
              <h3 className="text-md font-semibold text-slate-900 mb-2">SEO Settings</h3>
              <p className="text-sm text-slate-600 mb-4">
                Optimize your anchor text (link text) for better SEO when submitting to directories.
              </p>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Primary Target Anchor Text <span className="text-slate-400">(max 100 chars)</span>
                  </label>
                  <input
                    type="text"
                    value={business.target_anchor_text}
                    onChange={(e) => setBusiness({ ...business, target_anchor_text: e.target.value.substring(0, 100) })}
                    placeholder="e.g., Texas Government Relations"
                    maxLength={100}
                    className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#22C55E]"
                  />
                  <div className="text-xs text-slate-400 mt-1">{business.target_anchor_text.length}/100</div>
                </div>
                <div className="grid md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Secondary Anchor Text 1 <span className="text-slate-400">(optional)</span>
                    </label>
                    <input
                      type="text"
                      value={business.secondary_anchor_text_1}
                      onChange={(e) => setBusiness({ ...business, secondary_anchor_text_1: e.target.value.substring(0, 100) })}
                      placeholder="Alternative anchor text"
                      maxLength={100}
                      className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#22C55E]"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Secondary Anchor Text 2 <span className="text-slate-400">(optional)</span>
                    </label>
                    <input
                      type="text"
                      value={business.secondary_anchor_text_2}
                      onChange={(e) => setBusiness({ ...business, secondary_anchor_text_2: e.target.value.substring(0, 100) })}
                      placeholder="Alternative anchor text"
                      maxLength={100}
                      className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#22C55E]"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Secondary Anchor Text 3 <span className="text-slate-400">(optional)</span>
                    </label>
                    <input
                      type="text"
                      value={business.secondary_anchor_text_3}
                      onChange={(e) => setBusiness({ ...business, secondary_anchor_text_3: e.target.value.substring(0, 100) })}
                      placeholder="Alternative anchor text"
                      maxLength={100}
                      className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#22C55E]"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Submit */}
            <div className="flex justify-end pt-4 border-t border-slate-100">
              <button
                type="submit"
                disabled={saving}
                className="px-8 py-3 bg-[#22C55E] text-white font-semibold rounded-lg hover:bg-[#16a34a] transition-colors disabled:opacity-50"
              >
                {saving ? "Saving..." : business.id ? "Update Business" : "Create Business"}
              </button>
            </div>
          </div>
        </form>
      </main>
    </div>
  );
}
