"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

interface Listing {
  id: number;
  business_id: number;
  slug: string;
  is_dofollow: boolean;
  has_profile_page: boolean;
  featured_until: string | null;
  view_count: number;
  business_name: string;
  business_website_url: string;
  business_description_short: string;
  business_logo_url: string;
  business_city: string;
  business_state: string;
  target_anchor_text: string | null;
  industries: string[];
}

interface Category {
  slug: string;
  name: string;
}

export default function DirectoryPage() {
  const params = useParams();
  const category = params.category as string;

  const [listings, setListings] = useState<Listing[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadListings() {
      try {
        const res = await fetch(`/api/listings?category=${category}`);
        if (!res.ok) {
          setError("Failed to load listings");
          return;
        }
        const data = await res.json();
        setListings(data.listings);
        setCategories(data.categories);
      } catch {
        setError("Something went wrong");
      } finally {
        setLoading(false);
      }
    }
    loadListings();
  }, [category]);

  const currentCategory = categories.find(c => c.slug === category);
  const categoryName = currentCategory?.name || category.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#f8fafc" }}>
        <div className="animate-pulse text-slate-600">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: "#f8fafc" }}>
      {/* Header */}
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <Link href="/" className="text-xl font-bold no-underline">
            <span className="text-[#22C55E]">Link</span><span className="text-slate-900">Planter</span>
          </Link>
          <div className="flex items-center gap-4">
            <Link href="/login" className="text-sm text-slate-600 hover:text-slate-900 no-underline">
              Sign in
            </Link>
            <Link
              href="/register"
              className="text-sm px-4 py-2 bg-[#22C55E] text-white rounded-lg hover:bg-[#16a34a] no-underline"
            >
              Get Started
            </Link>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Page header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-slate-900 mb-4">
            {categoryName} Directory
          </h1>
          <p className="text-lg text-slate-600">
            Browse {categoryName.toLowerCase()} businesses and get instant backlinks for your business.
          </p>
        </div>

        {/* Category filter */}
        <div className="mb-8">
          <div className="flex flex-wrap gap-2">
            <Link
              href="/directory/all"
              className={`px-4 py-2 rounded-lg text-sm font-medium no-underline transition-colors ${
                category === "all"
                  ? "bg-[#22C55E] text-white"
                  : "bg-white text-slate-600 hover:bg-slate-50 border border-slate-200"
              }`}
            >
              All Categories
            </Link>
            {categories.map((cat) => (
              <Link
                key={cat.slug}
                href={`/directory/${cat.slug}`}
                className={`px-4 py-2 rounded-lg text-sm font-medium no-underline transition-colors ${
                  category === cat.slug
                    ? "bg-[#22C55E] text-white"
                    : "bg-white text-slate-600 hover:bg-slate-50 border border-slate-200"
                }`}
              >
                {cat.name}
              </Link>
            ))}
          </div>
        </div>

        {/* Error message */}
        {error && (
          <div className="mb-6 p-4 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
            {error}
          </div>
        )}

        {/* Listings */}
        {listings.length === 0 ? (
          <div className="bg-white rounded-xl p-12 border border-slate-200 text-center">
            <p className="text-slate-600">No listings found in this category yet.</p>
            <Link
              href="/register"
              className="mt-4 inline-block px-6 py-3 bg-[#22C55E] text-white rounded-lg hover:bg-[#16a34a] no-underline"
            >
              Be the first to list your business
            </Link>
          </div>
        ) : (
          <div className="grid gap-6">
            {listings.map((listing) => {
              // Determine the link text to use (anchor text optimization)
              const linkText = listing.target_anchor_text || listing.business_name;
              const isFeatured = listing.featured_until && new Date(listing.featured_until) > new Date();

              return (
                <div
                  key={listing.id}
                  className={`bg-white rounded-xl p-6 border transition-all hover:shadow-md ${
                    isFeatured
                      ? "border-[#22C55E] shadow-sm"
                      : "border-slate-200"
                  }`}
                >
                  <div className="flex gap-6">
                    {/* Logo */}
                    {listing.business_logo_url && (
                      <div className="flex-shrink-0">
                        <img
                          src={listing.business_logo_url}
                          alt={listing.business_name}
                          className="w-24 h-24 rounded-lg object-cover border border-slate-200"
                        />
                      </div>
                    )}

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-4 mb-2">
                        <div>
                          <h2 className="text-xl font-bold text-slate-900 mb-1">
                            {listing.has_profile_page ? (
                              <Link
                                href={`/business/${listing.slug}`}
                                className="text-slate-900 hover:text-[#22C55E] no-underline"
                              >
                                {listing.business_name}
                              </Link>
                            ) : (
                              listing.business_name
                            )}
                          </h2>
                          {isFeatured && (
                            <span className="inline-block px-2 py-1 text-xs font-semibold text-[#22C55E] bg-green-50 rounded">
                              Featured
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Description */}
                      {listing.business_description_short && (
                        <p className="text-slate-600 mb-4">
                          {listing.business_description_short}
                        </p>
                      )}

                      {/* Location and link */}
                      <div className="flex flex-wrap items-center gap-4 text-sm">
                        {(listing.business_city || listing.business_state) && (
                          <div className="flex items-center text-slate-500">
                            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                            {[listing.business_city, listing.business_state].filter(Boolean).join(", ")}
                          </div>
                        )}

                        {listing.business_website_url && (
                          <a
                            href={listing.business_website_url}
                            target="_blank"
                            rel={listing.is_dofollow ? "noopener noreferrer" : "noopener noreferrer nofollow"}
                            className="inline-flex items-center text-[#22C55E] hover:text-[#16a34a] font-medium"
                          >
                            {linkText}
                            <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                            </svg>
                          </a>
                        )}

                        {listing.industries && listing.industries.length > 0 && (
                          <div className="flex flex-wrap gap-2">
                            {listing.industries.map((industry, idx) => (
                              <span
                                key={idx}
                                className="px-2 py-1 text-xs bg-slate-100 text-slate-600 rounded"
                              >
                                {industry}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center text-sm text-slate-500">
            <Link href="/" className="text-[#22C55E] hover:text-[#16a34a] no-underline font-semibold">
              LinkPlanter
            </Link>
            {" "}- Get instant backlinks for your business
          </div>
        </div>
      </footer>
    </div>
  );
}
