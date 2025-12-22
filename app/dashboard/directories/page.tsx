"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface Directory {
  id: number;
  name: string;
  slug: string;
  url: string;
  da_score: number | null;
  dr_score: number | null;
  difficulty: string;
  submission_type: string;
  avg_approval_days: number | null;
  is_free: boolean;
  is_premium: boolean;
  instructions: string | null;
  submission_url: string | null;
  anchor_text_field: string;
  industries: string[];
}

interface Business {
  target_anchor_text: string;
  secondary_anchor_texts: string[];
}

interface Industry {
  slug: string;
  name: string;
}

interface Stats {
  total: number;
  premium: number;
  easy: number;
  medium: number;
  hard: number;
}

export default function DirectoriesPage() {
  const router = useRouter();
  const [directories, setDirectories] = useState<Directory[]>([]);
  const [industries, setIndustries] = useState<Industry[]>([]);
  const [stats, setStats] = useState<Stats>({ total: 0, premium: 0, easy: 0, medium: 0, hard: 0 });
  const [business, setBusiness] = useState<Business>({ target_anchor_text: "", secondary_anchor_texts: [] });
  const [loading, setLoading] = useState(true);
  const [selectedDirectory, setSelectedDirectory] = useState<Directory | null>(null);
  const [copiedText, setCopiedText] = useState<string | null>(null);

  // Filters
  const [difficulty, setDifficulty] = useState("all");
  const [premium, setPremium] = useState("all");
  const [industry, setIndustry] = useState("all");
  const [search, setSearch] = useState("");

  const loadDirectories = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (difficulty !== "all") params.set("difficulty", difficulty);
      if (premium !== "all") params.set("premium", premium);
      if (industry !== "all") params.set("industry", industry);
      if (search) params.set("search", search);

      const res = await fetch(`/api/directories?${params}`);
      if (!res.ok) {
        if (res.status === 401) {
          router.push("/login");
          return;
        }
        throw new Error("Failed to load");
      }

      const data = await res.json();
      setDirectories(data.directories || []);
      setIndustries(data.industries || []);
      setStats(data.stats || { total: 0, premium: 0, easy: 0, medium: 0, hard: 0 });
      setBusiness(data.business || { target_anchor_text: "", secondary_anchor_texts: [] });
    } catch (error) {
      console.error("Load directories error:", error);
    } finally {
      setLoading(false);
    }
  }, [difficulty, premium, industry, search, router]);

  useEffect(() => {
    loadDirectories();
  }, [loadDirectories]);

  const getDifficultyColor = (diff: string) => {
    switch (diff) {
      case "easy": return { bg: "rgba(34,197,94,0.1)", text: "#16a34a" };
      case "medium": return { bg: "rgba(234,179,8,0.1)", text: "#ca8a04" };
      case "hard": return { bg: "rgba(239,68,68,0.1)", text: "#dc2626" };
      default: return { bg: "rgba(100,116,139,0.1)", text: "#64748b" };
    }
  };

  const getAnchorTextTip = (anchorTextField: string) => {
    const targetText = business.target_anchor_text || "your target keywords";

    switch (anchorTextField) {
      case "business_name":
        return {
          message: "This directory uses your business name as link text. Consider updating your business name to include keywords.",
          suggestedText: null,
          showCopy: false
        };
      case "description":
        return {
          message: "This directory uses your description as link text. Start your description with your target anchor text for maximum SEO impact.",
          suggestedText: targetText,
          showCopy: true
        };
      case "custom":
        return {
          message: "You can set custom anchor text! Use your target anchor text for best results.",
          suggestedText: targetText,
          showCopy: true
        };
      case "none":
        return {
          message: "This directory doesn't allow custom link text. The backlink value comes from the domain authority alone.",
          suggestedText: null,
          showCopy: false
        };
      default:
        return null;
    }
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedText(text);
      setTimeout(() => setCopiedText(null), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#0F172A" }}>
        <div className="animate-pulse text-slate-400">Loading directories...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: "#f8fafc" }}>
      {/* Header */}
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <Link href="/dashboard" className="text-xl font-bold no-underline">
            <span className="text-[#22C55E]">Link</span><span className="text-slate-900">Planter</span>
          </Link>
          <nav className="flex items-center gap-6">
            <Link href="/dashboard" className="text-sm text-slate-600 hover:text-slate-900 no-underline">Dashboard</Link>
            <Link href="/dashboard/business" className="text-sm text-slate-600 hover:text-slate-900 no-underline">Business</Link>
            <Link href="/dashboard/directories" className="text-sm text-[#22C55E] font-medium no-underline">Directories</Link>
          </nav>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Page header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-slate-900">Directory Database</h1>
          <p className="text-slate-600">Browse {stats.total} directories to submit your business for backlinks.</p>
        </div>

        {/* Stats cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
          <div className="bg-white rounded-xl p-4 border border-slate-200">
            <div className="text-2xl font-bold text-slate-900">{stats.total}</div>
            <div className="text-sm text-slate-500">Total</div>
          </div>
          <div className="bg-white rounded-xl p-4 border border-slate-200" style={{ borderColor: "rgba(34,197,94,0.3)" }}>
            <div className="text-2xl font-bold text-[#22C55E]">{stats.premium}</div>
            <div className="text-sm text-slate-500">Instant Backlinks</div>
          </div>
          <div className="bg-white rounded-xl p-4 border border-slate-200">
            <div className="text-2xl font-bold text-green-600">{stats.easy}</div>
            <div className="text-sm text-slate-500">Easy</div>
          </div>
          <div className="bg-white rounded-xl p-4 border border-slate-200">
            <div className="text-2xl font-bold text-yellow-600">{stats.medium}</div>
            <div className="text-sm text-slate-500">Medium</div>
          </div>
          <div className="bg-white rounded-xl p-4 border border-slate-200">
            <div className="text-2xl font-bold text-red-600">{stats.hard}</div>
            <div className="text-sm text-slate-500">Hard</div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-xl p-4 border border-slate-200 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div className="md:col-span-2">
              <input
                type="text"
                placeholder="Search directories..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#22C55E] focus:border-transparent"
              />
            </div>
            <div>
              <select
                value={difficulty}
                onChange={(e) => setDifficulty(e.target.value)}
                className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#22C55E]"
              >
                <option value="all">All Difficulties</option>
                <option value="easy">Easy</option>
                <option value="medium">Medium</option>
                <option value="hard">Hard</option>
              </select>
            </div>
            <div>
              <select
                value={premium}
                onChange={(e) => setPremium(e.target.value)}
                className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#22C55E]"
              >
                <option value="all">All Types</option>
                <option value="true">Instant Backlinks</option>
                <option value="false">Manual Submission</option>
              </select>
            </div>
            <div>
              <select
                value={industry}
                onChange={(e) => setIndustry(e.target.value)}
                className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#22C55E]"
              >
                <option value="all">All Industries</option>
                {industries.map((ind) => (
                  <option key={ind.slug} value={ind.slug}>{ind.name}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Directory list */}
        <div className="space-y-4">
          {directories.length === 0 ? (
            <div className="bg-white rounded-xl p-12 border border-slate-200 text-center">
              <div className="text-slate-400 mb-2">No directories found</div>
              <div className="text-sm text-slate-500">Try adjusting your filters</div>
            </div>
          ) : (
            directories.map((dir) => {
              const diffColor = getDifficultyColor(dir.difficulty);
              return (
                <div
                  key={dir.id}
                  className="bg-white rounded-xl p-5 border border-slate-200 hover:border-[#22C55E] hover:shadow-sm transition-all cursor-pointer"
                  onClick={() => setSelectedDirectory(dir)}
                >
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="font-semibold text-slate-900">{dir.name}</h3>
                        {dir.is_premium && (
                          <span
                            className="text-xs px-2 py-0.5 rounded-full font-medium"
                            style={{ background: "rgba(34,197,94,0.1)", color: "#16a34a" }}
                          >
                            Instant Backlink
                          </span>
                        )}
                        <span
                          className="text-xs px-2 py-0.5 rounded-full font-medium capitalize"
                          style={{ background: diffColor.bg, color: diffColor.text }}
                        >
                          {dir.difficulty}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-slate-500 mb-2">
                        <span className="text-slate-400">{new URL(dir.url).hostname}</span>
                        {dir.da_score && (
                          <span>DA: <span className="font-medium text-slate-700">{dir.da_score}</span></span>
                        )}
                        {dir.dr_score && (
                          <span>DR: <span className="font-medium text-slate-700">{dir.dr_score}</span></span>
                        )}
                        {dir.avg_approval_days !== null && (
                          <span>
                            Approval: <span className="font-medium text-slate-700">
                              {dir.avg_approval_days === 0 ? "Instant" : `~${dir.avg_approval_days} days`}
                            </span>
                          </span>
                        )}
                      </div>
                      {dir.industries && dir.industries.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {dir.industries.slice(0, 3).map((ind) => (
                            <span
                              key={ind}
                              className="text-xs px-2 py-0.5 rounded bg-slate-100 text-slate-600"
                            >
                              {ind}
                            </span>
                          ))}
                          {dir.industries.length > 3 && (
                            <span className="text-xs text-slate-400">+{dir.industries.length - 3} more</span>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      {dir.submission_url && (
                        <a
                          href={dir.submission_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="px-4 py-2 text-sm font-medium rounded-lg transition-colors no-underline"
                          style={{
                            background: dir.is_premium ? "#22C55E" : "transparent",
                            color: dir.is_premium ? "white" : "#22C55E",
                            border: dir.is_premium ? "none" : "1px solid #22C55E"
                          }}
                        >
                          {dir.is_premium ? "Get Instant Link" : "Submit"}
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Results count */}
        <div className="mt-6 text-center text-sm text-slate-500">
          Showing {directories.length} of {stats.total} directories
        </div>
      </main>

      {/* Directory detail modal */}
      {selectedDirectory && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"
          onClick={() => setSelectedDirectory(null)}
        >
          <div
            className="bg-white rounded-2xl max-w-lg w-full max-h-[80vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h2 className="text-xl font-bold text-slate-900">{selectedDirectory.name}</h2>
                  <a
                    href={selectedDirectory.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-[#22C55E] hover:underline"
                  >
                    {new URL(selectedDirectory.url).hostname}
                  </a>
                </div>
                <button
                  onClick={() => setSelectedDirectory(null)}
                  className="text-slate-400 hover:text-slate-600"
                >
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Stats row */}
              <div className="grid grid-cols-3 gap-4 mb-6">
                <div className="text-center p-3 rounded-lg bg-slate-50">
                  <div className="text-lg font-bold text-slate-900">{selectedDirectory.da_score || "-"}</div>
                  <div className="text-xs text-slate-500">Domain Authority</div>
                </div>
                <div className="text-center p-3 rounded-lg bg-slate-50">
                  <div className="text-lg font-bold text-slate-900">{selectedDirectory.dr_score || "-"}</div>
                  <div className="text-xs text-slate-500">Domain Rating</div>
                </div>
                <div className="text-center p-3 rounded-lg bg-slate-50">
                  <div className="text-lg font-bold text-slate-900">
                    {selectedDirectory.avg_approval_days === 0 ? "Instant" : `${selectedDirectory.avg_approval_days || "-"} days`}
                  </div>
                  <div className="text-xs text-slate-500">Approval Time</div>
                </div>
              </div>

              {/* Tags */}
              <div className="flex flex-wrap gap-2 mb-6">
                {selectedDirectory.is_premium && (
                  <span className="text-xs px-3 py-1 rounded-full font-medium" style={{ background: "rgba(34,197,94,0.1)", color: "#16a34a" }}>
                    Instant Backlink
                  </span>
                )}
                <span
                  className="text-xs px-3 py-1 rounded-full font-medium capitalize"
                  style={{ background: getDifficultyColor(selectedDirectory.difficulty).bg, color: getDifficultyColor(selectedDirectory.difficulty).text }}
                >
                  {selectedDirectory.difficulty} difficulty
                </span>
                <span className="text-xs px-3 py-1 rounded-full font-medium bg-slate-100 text-slate-600">
                  {selectedDirectory.submission_type === "auto" ? "Automated" : "Manual"} submission
                </span>
                {selectedDirectory.is_free && (
                  <span className="text-xs px-3 py-1 rounded-full font-medium bg-slate-100 text-slate-600">
                    Free
                  </span>
                )}
              </div>

              {/* Instructions */}
              {selectedDirectory.instructions && (
                <div className="mb-6">
                  <h3 className="text-sm font-medium text-slate-700 mb-2">Submission Tips</h3>
                  <p className="text-sm text-slate-600 bg-slate-50 rounded-lg p-4">
                    {selectedDirectory.instructions}
                  </p>
                </div>
              )}

              {/* Industries */}
              {selectedDirectory.industries && selectedDirectory.industries.length > 0 && (
                <div className="mb-6">
                  <h3 className="text-sm font-medium text-slate-700 mb-2">Best for Industries</h3>
                  <div className="flex flex-wrap gap-2">
                    {selectedDirectory.industries.map((ind) => (
                      <span key={ind} className="text-xs px-2 py-1 rounded bg-slate-100 text-slate-600">
                        {ind}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Anchor Text Tip */}
              {(() => {
                const anchorTip = getAnchorTextTip(selectedDirectory.anchor_text_field);
                if (!anchorTip) return null;

                return (
                  <div className="mb-6 p-4 rounded-lg" style={{ background: "rgba(34,197,94,0.05)", border: "1px solid rgba(34,197,94,0.2)" }}>
                    <div className="flex items-start gap-2 mb-2">
                      <svg className="w-5 h-5 text-[#22C55E] flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <div className="flex-1">
                        <h3 className="text-sm font-medium text-slate-900 mb-1">Anchor Text Tip</h3>
                        <p className="text-sm text-slate-600">{anchorTip.message}</p>
                      </div>
                    </div>
                    {anchorTip.showCopy && anchorTip.suggestedText && (
                      <div className="mt-3 flex items-center gap-2 p-3 rounded bg-white border border-slate-200">
                        <span className="text-sm font-medium text-slate-700 flex-1">{anchorTip.suggestedText}</span>
                        <button
                          onClick={() => copyToClipboard(anchorTip.suggestedText!)}
                          className="px-3 py-1.5 text-xs font-medium rounded transition-colors"
                          style={{
                            background: copiedText === anchorTip.suggestedText ? "#22C55E" : "transparent",
                            color: copiedText === anchorTip.suggestedText ? "white" : "#22C55E",
                            border: copiedText === anchorTip.suggestedText ? "none" : "1px solid #22C55E"
                          }}
                        >
                          {copiedText === anchorTip.suggestedText ? "Copied!" : "Copy"}
                        </button>
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Action button */}
              {selectedDirectory.submission_url && (
                <a
                  href={selectedDirectory.submission_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block w-full py-3 text-center text-white font-semibold rounded-lg transition-colors no-underline"
                  style={{ background: "#22C55E" }}
                >
                  {selectedDirectory.is_premium ? "Get Instant Backlink" : "Go to Submission Page"}
                </a>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
