"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

interface Business {
  id: number;
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
  target_anchor_text: string | null;
}

interface Listing {
  id: number;
  slug: string;
  is_dofollow: boolean;
  view_count: number;
  industries: string[];
}

export default function BusinessProfilePage() {
  const params = useParams();
  const slug = params.slug as string;

  const [listing, setListing] = useState<Listing | null>(null);
  const [business, setBusiness] = useState<Business | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadBusinessProfile() {
      try {
        // In a real implementation, you'd have an API endpoint for this
        // For now, we'll create a placeholder
        const res = await fetch(`/api/listings?slug=${slug}`);
        if (!res.ok) {
          setError("Business not found");
          return;
        }
        const data = await res.json();

        if (data.listings && data.listings.length > 0) {
          const listingData = data.listings[0];
          setListing({
            id: listingData.id,
            slug: listingData.slug,
            is_dofollow: listingData.is_dofollow,
            view_count: listingData.view_count,
            industries: listingData.industries || []
          });

          setBusiness({
            id: listingData.business_id,
            name: listingData.business_name,
            website_url: listingData.business_website_url,
            email: "",
            phone: "",
            description_short: listingData.business_description_short,
            description_long: "",
            logo_url: listingData.business_logo_url,
            address_line1: "",
            address_line2: "",
            city: listingData.business_city,
            state: listingData.business_state,
            postal_code: "",
            country: "",
            social_facebook: "",
            social_twitter: "",
            social_linkedin: "",
            social_instagram: "",
            target_anchor_text: listingData.target_anchor_text
          });

          // Increment view count
          await fetch(`/api/listings/${listingData.id}/view`, { method: "POST" });
        } else {
          setError("Business not found");
        }
      } catch {
        setError("Something went wrong");
      } finally {
        setLoading(false);
      }
    }
    loadBusinessProfile();
  }, [slug]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#f8fafc" }}>
        <div className="animate-pulse text-slate-600">Loading...</div>
      </div>
    );
  }

  if (error || !business || !listing) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#f8fafc" }}>
        <div className="text-center">
          <h1 className="text-2xl font-bold text-slate-900 mb-4">Business Not Found</h1>
          <p className="text-slate-600 mb-6">The business you're looking for doesn't exist or has been removed.</p>
          <Link
            href="/directory/all"
            className="inline-block px-6 py-3 bg-[#22C55E] text-white rounded-lg hover:bg-[#16a34a] no-underline"
          >
            Browse Directory
          </Link>
        </div>
      </div>
    );
  }

  // Use optimized anchor text or fallback to business name
  const linkText = business.target_anchor_text || business.name;

  return (
    <div className="min-h-screen" style={{ background: "#f8fafc" }}>
      {/* Header */}
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <Link href="/" className="text-xl font-bold no-underline">
            <span className="text-[#22C55E]">Link</span><span className="text-slate-900">Planter</span>
          </Link>
          <div className="flex items-center gap-4">
            <Link href="/directory/all" className="text-sm text-slate-600 hover:text-slate-900 no-underline">
              Browse Directory
            </Link>
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
      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Business header */}
        <div className="bg-white rounded-xl p-8 border border-slate-200 mb-6">
          <div className="flex gap-8">
            {/* Logo */}
            {business.logo_url && (
              <div className="flex-shrink-0">
                <img
                  src={business.logo_url}
                  alt={business.name}
                  className="w-32 h-32 rounded-xl object-cover border border-slate-200"
                />
              </div>
            )}

            {/* Info */}
            <div className="flex-1">
              <h1 className="text-3xl font-bold text-slate-900 mb-4">
                {business.name}
              </h1>

              {/* Location */}
              {(business.city || business.state) && (
                <div className="flex items-center text-slate-600 mb-4">
                  <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  {[business.city, business.state].filter(Boolean).join(", ")}
                </div>
              )}

              {/* Categories */}
              {listing.industries && listing.industries.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-4">
                  {listing.industries.map((industry, idx) => (
                    <span
                      key={idx}
                      className="px-3 py-1 text-sm bg-slate-100 text-slate-700 rounded-lg"
                    >
                      {industry}
                    </span>
                  ))}
                </div>
              )}

              {/* Website link with optimized anchor text */}
              {business.website_url && (
                <a
                  href={business.website_url}
                  target="_blank"
                  rel={listing.is_dofollow ? "noopener noreferrer" : "noopener noreferrer nofollow"}
                  className="inline-flex items-center px-6 py-3 bg-[#22C55E] text-white font-semibold rounded-lg hover:bg-[#16a34a] transition-colors"
                >
                  {linkText}
                  <svg className="w-5 h-5 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </a>
              )}
            </div>
          </div>
        </div>

        {/* Description */}
        {(business.description_short || business.description_long) && (
          <div className="bg-white rounded-xl p-8 border border-slate-200 mb-6">
            <h2 className="text-2xl font-bold text-slate-900 mb-4">About</h2>

            {business.description_short && (
              <p className="text-slate-700 mb-4 text-lg">
                {business.description_short}
              </p>
            )}

            {business.description_long && (
              <div className="text-slate-600 whitespace-pre-line">
                {business.description_long}
              </div>
            )}
          </div>
        )}

        {/* Social links */}
        {(business.social_facebook || business.social_twitter || business.social_linkedin || business.social_instagram) && (
          <div className="bg-white rounded-xl p-8 border border-slate-200">
            <h2 className="text-2xl font-bold text-slate-900 mb-4">Connect</h2>
            <div className="flex gap-4">
              {business.social_facebook && (
                <a
                  href={business.social_facebook}
                  target="_blank"
                  rel="noopener noreferrer nofollow"
                  className="flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors no-underline"
                >
                  Facebook
                </a>
              )}
              {business.social_twitter && (
                <a
                  href={business.social_twitter}
                  target="_blank"
                  rel="noopener noreferrer nofollow"
                  className="flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors no-underline"
                >
                  Twitter/X
                </a>
              )}
              {business.social_linkedin && (
                <a
                  href={business.social_linkedin}
                  target="_blank"
                  rel="noopener noreferrer nofollow"
                  className="flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors no-underline"
                >
                  LinkedIn
                </a>
              )}
              {business.social_instagram && (
                <a
                  href={business.social_instagram}
                  target="_blank"
                  rel="noopener noreferrer nofollow"
                  className="flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors no-underline"
                >
                  Instagram
                </a>
              )}
            </div>
          </div>
        )}

        {/* View count */}
        <div className="mt-6 text-center text-sm text-slate-500">
          {listing.view_count} {listing.view_count === 1 ? "view" : "views"}
        </div>
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
