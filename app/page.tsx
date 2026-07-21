import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen bg-white">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white shadow-sm border-b border-slate-100">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="flex justify-between items-center h-20">
            <Link href="/" className="font-display text-2xl font-bold tracking-tight no-underline flex-shrink-0">
              <span className="text-[#0F172A]">Link</span>
              <span className="text-[#16a34a]">Planter</span>
            </Link>

            <div className="hidden md:flex items-center gap-10">
              <a href="#why" className="text-[#475569] hover:text-[#0F172A] text-[15px] font-medium transition-colors">Why Us</a>
              <a href="#how" className="text-[#475569] hover:text-[#0F172A] text-[15px] font-medium transition-colors">How It Works</a>
              <a href="#pricing" className="text-[#475569] hover:text-[#0F172A] text-[15px] font-medium transition-colors">Pricing</a>
            </div>

            <div className="flex items-center gap-4">
              <Link href="/login" className="text-[#475569] hover:text-[#0F172A] text-[15px] font-medium transition-colors hidden sm:block">
                Sign in
              </Link>
              <Link href="/register" className="no-underline bg-[#0F172A] hover:bg-[#1e293b] text-white px-5 py-2.5 rounded-lg text-[15px] font-semibold transition-all">
                Start free
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-28 pb-20 sm:pt-32 lg:pt-44 lg:pb-32 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-[#f8fafc] via-white to-white" />
        <div className="absolute top-0 right-0 w-1/2 h-full" style={{background: "linear-gradient(to left, rgba(34,197,94,0.05), transparent)"}} />

        <div className="relative max-w-7xl mx-auto px-6 lg:px-8">
          <div className="max-w-4xl">
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 mb-8">
              <span
                className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full"
                style={{background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.2)"}}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-[#16a34a] animate-pulse" />
                <span className="text-[13px] font-semibold text-[#16a34a] tracking-wide uppercase">Now Live</span>
              </span>
              <span className="text-[#475569] text-sm">100+ directories • 50+ industries</span>
            </div>

            <h1 className="font-display text-[3.25rem] sm:text-[4rem] lg:text-[5rem] leading-[1.05] font-bold text-[#0F172A] tracking-tight mb-8">
              Stop chasing backlinks.<br />
              <span className="text-[#16a34a]">Start planting them.</span>
            </h1>

            <p className="text-xl lg:text-2xl text-[#475569] leading-relaxed mb-10 max-w-2xl">
              Most directory tools help you submit and hope. We <em className="font-semibold text-[#0F172A] not-italic">own</em> the directories.
              Sign up and get real, dofollow backlinks—instantly.
            </p>

            <div className="flex flex-wrap gap-4 mb-14">
              <Link href="/register" className="group bg-[#16a34a] hover:bg-[#15803d] text-white px-8 py-4 rounded-xl text-lg font-semibold transition-all shadow-lg hover:shadow-xl" style={{boxShadow: "0 10px 25px -5px rgba(34,197,94,0.25)"}}>
                Plant your first links free →
              </Link>
              <a href="#how" className="px-8 py-4 rounded-xl text-lg font-semibold text-[#0F172A] border-2 border-[#e2e8f0] hover:border-[#94a3b8] transition-colors">
                See how it works
              </a>
            </div>

            <div className="flex flex-wrap items-center gap-x-8 gap-y-3 text-sm text-[#475569]">
              <span className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-[#16a34a] flex items-center justify-center text-white text-xs font-bold">✓</span>
                No credit card required
              </span>
              <span className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-[#16a34a] flex items-center justify-center text-white text-xs font-bold">✓</span>
                Instant backlinks on sign up
              </span>
              <span className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-[#16a34a] flex items-center justify-center text-white text-xs font-bold">✓</span>
                Cancel anytime
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* The Problem / Our Difference */}
      <section id="why" className="py-24 lg:py-32 bg-[#0F172A] relative">
        <div className="relative max-w-7xl mx-auto px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-16 lg:gap-24 items-center">
            <div>
              <h2 className="font-display text-3xl sm:text-4xl lg:text-5xl font-bold text-white leading-tight mb-8">
                Other tools help you knock on doors.<br />
                <span className="text-[#16a34a]">We hand you the keys.</span>
              </h2>
              <div className="space-y-6 text-lg text-[#cbd5e1]">
                <p>
                  Traditional directory submission is a grind. You fill out forms, wait weeks for approval,
                  and half your submissions disappear into the void.
                </p>
                <p>
                  <span className="text-white font-semibold">LinkPlanter is different.</span> We operate our own network
                  of high-authority directories. When you sign up, you get listed immediately—with real,
                  dofollow backlinks that Google actually counts.
                </p>
                <p>
                  Plus, we give you access to 100+ external directories with smart recommendations
                  and one-click submissions where possible.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-6">
              {[
                { value: "100+", label: "Curated directories", sublabel: "No spam or dead sites" },
                { value: "DA 40+", label: "Average authority", sublabel: "Quality backlinks only" },
                { value: "Instant", label: "First backlinks", sublabel: "From our own network" },
                { value: "$99", label: "Per year, unlimited", sublabel: "Less than a coffee/week" },
              ].map((stat) => (
                <div
                  key={stat.label}
                  className="rounded-2xl p-6 transition-colors hover:bg-white/10"
                  style={{
                    background: "rgba(255,255,255,0.05)",
                    border: "1px solid rgba(255,255,255,0.1)",
                    backdropFilter: "blur(8px)"
                  }}
                >
                  <div className="font-display text-3xl lg:text-4xl font-bold text-[#16a34a] mb-2">{stat.value}</div>
                  <div className="text-white font-medium mb-1">{stat.label}</div>
                  <div className="text-sm text-[#94a3b8]">{stat.sublabel}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how" className="py-24 lg:py-32 bg-[#f8fafc]">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="text-center mb-20">
            <h2 className="font-display text-3xl sm:text-4xl lg:text-5xl font-bold text-[#0F172A] mb-6">
              Three steps to stronger rankings
            </h2>
            <p className="text-xl text-[#475569] max-w-2xl mx-auto">
              Stop spending hours on manual submissions. Get your business listed across quality directories in minutes.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 lg:gap-12">
            {[
              {
                step: "01",
                title: "Add your business",
                description: "Enter your details once. We can pull from Google Business Profile to save time and ensure accuracy across all submissions.",
              },
              {
                step: "02",
                title: "Choose your targets",
                description: "Browse our curated database or let our AI recommend the best directories for your industry, location, and SEO goals.",
              },
              {
                step: "03",
                title: "Submit and track",
                description: "We handle submissions automatically where possible. Track every approval, monitor your backlinks, and watch your rankings climb.",
              },
            ].map((item) => (
              <div key={item.step} className="relative">
                <div className="bg-white rounded-2xl p-8 lg:p-10 border border-[#e2e8f0] hover:shadow-xl hover:-translate-y-1 transition-all h-full">
                  <div
                    className="w-14 h-14 rounded-xl text-[#16a34a] flex items-center justify-center mb-6 font-display font-bold text-xl"
                    style={{background: "rgba(34,197,94,0.1)"}}
                  >
                    {item.step}
                  </div>
                  <h3 className="font-display text-2xl font-bold text-[#0F172A] mb-4">{item.title}</h3>
                  <p className="text-[#475569] leading-relaxed">{item.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* The Network Advantage */}
      <section className="py-24 lg:py-32 bg-white">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div>
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-amber-100 border border-amber-200 mb-6">
                <span className="text-[13px] font-semibold text-amber-700 tracking-wide uppercase">★ Exclusive</span>
              </div>
              <h2 className="font-display text-3xl sm:text-4xl lg:text-5xl font-bold text-[#0F172A] leading-tight mb-6">
                Backlinks you can count on
              </h2>
              <p className="text-xl text-[#475569] mb-8">
                The LinkPlanter Directory Network is our secret weapon. These are real, indexed sites with
                actual domain authority—and you get listed on every single one the moment you upgrade to Pro.
              </p>
              <ul className="space-y-4">
                {[
                  "Dofollow links from DA 30-50 sites",
                  "Full business profile with your branding",
                  "Indexed by Google within days",
                  "Permanent listings (as long as you are subscribed)",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-3 text-[#0F172A]">
                    <span className="w-6 h-6 rounded-full bg-[#16a34a] flex items-center justify-center text-white text-xs font-bold flex-shrink-0 mt-0.5">✓</span>
                    <span className="text-lg">{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="relative">
              <div
                className="absolute -inset-4 rounded-3xl blur-2xl"
                style={{background: "linear-gradient(to bottom right, rgba(34,197,94,0.2), rgba(34,197,94,0.05))"}}
              />
              <div className="relative bg-white rounded-2xl border border-[#e2e8f0] shadow-xl p-8">
                <div className="flex items-center gap-4 mb-8 pb-8 border-b border-[#f1f5f9]">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#22C55E] to-[#16a34a] flex items-center justify-center">
                    <span className="font-display text-white font-bold text-xl">LP</span>
                  </div>
                  <div>
                    <h3 className="font-display text-xl font-bold text-[#0F172A]">LinkPlanter Network</h3>
                    <p className="text-[#475569]">Your guaranteed backlinks</p>
                  </div>
                </div>
                <div className="space-y-5">
                  {[
                    { label: "Sites in network", value: "12 directories" },
                    { label: "Average DA", value: "DA 38" },
                    { label: "Link type", value: "Dofollow" },
                    { label: "Approval time", value: "Instant" },
                  ].map((row) => (
                    <div key={row.label} className="flex justify-between items-center">
                      <span className="text-[#475569]">{row.label}</span>
                      <span className="font-semibold text-[#0F172A]">{row.value}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-8 pt-6 border-t border-[#f1f5f9]">
                  <div className="flex items-center justify-between">
                    <span className="text-[#475569]">Pro members</span>
                    <span
                      className="px-3 py-1 rounded-full text-[#16a34a] font-semibold text-sm"
                      style={{background: "rgba(34,197,94,0.1)"}}
                    >
                      Included free
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-24 lg:py-32 bg-[#f8fafc]">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="font-display text-3xl sm:text-4xl lg:text-5xl font-bold text-[#0F172A] mb-6">
              Pricing that makes sense
            </h2>
            <p className="text-xl text-[#475569] max-w-2xl mx-auto">
              Start free. Upgrade when you are ready to go all-in on your backlink strategy.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            {/* Free */}
            <div className="bg-white rounded-2xl border-2 border-[#e2e8f0] p-10">
              <div className="mb-8">
                <h3 className="font-display text-2xl font-bold text-[#0F172A] mb-2">Free</h3>
                <p className="text-[#475569]">Perfect for getting started</p>
              </div>
              <div className="mb-8">
                <span className="font-display text-5xl font-bold text-[#0F172A]">$0</span>
                <span className="text-[#475569] ml-2">/month</span>
              </div>
              <ul className="space-y-4 mb-10">
                {[
                  "50 directories to browse",
                  "5 submissions per month",
                  "Basic submission tracking",
                  "Nofollow network listing",
                ].map((f) => (
                  <li key={f} className="flex items-start gap-3 text-[#475569]">
                    <span className="w-5 h-5 rounded-full bg-[#e2e8f0] flex items-center justify-center text-[#475569] text-xs font-bold flex-shrink-0 mt-0.5">✓</span>
                    {f}
                  </li>
                ))}
              </ul>
              <Link href="/register" className="block w-full py-4 rounded-xl border-2 border-[#e2e8f0] text-center font-semibold text-[#0F172A] hover:border-[#94a3b8] transition-colors">
                Get started free
              </Link>
            </div>

            {/* Pro */}
            <div className="bg-[#0F172A] rounded-2xl p-10 relative overflow-hidden">
              <div className="absolute top-6 right-6">
                <span className="px-3 py-1 rounded-full bg-[#16a34a] text-white text-sm font-semibold">Best value</span>
              </div>
              <div className="mb-8">
                <h3 className="font-display text-2xl font-bold text-[#ffffff] mb-2">Pro</h3>
                <p className="text-[#cbd5e1]">For serious link builders</p>
              </div>
              <div className="mb-8">
                <span className="font-display text-5xl font-bold text-[#ffffff]">$99</span>
                <span className="text-[#cbd5e1] ml-2">/year</span>
                <p className="text-[#16a34a] text-sm mt-2">That is just $8.25/month</p>
              </div>
              <ul className="space-y-4 mb-10">
                {[
                  "100+ directories, full access",
                  "Unlimited submissions",
                  "AI-powered recommendations",
                  "Dofollow network listings",
                  "Campaign analytics",
                  "Priority support",
                ].map((f) => (
                  <li key={f} className="flex items-start gap-3 text-[#e2e8f0]">
                    <span className="w-5 h-5 rounded-full bg-[#16a34a] flex items-center justify-center text-white text-xs font-bold flex-shrink-0 mt-0.5">✓</span>
                    {f}
                  </li>
                ))}
              </ul>
              <Link href="/register?plan=pro" className="block w-full py-4 rounded-xl bg-[#16a34a] hover:bg-[#15803d] text-center font-semibold text-white transition-colors">
                Start 7-day free trial
              </Link>
            </div>
          </div>

          <p className="text-center mt-10 text-[#475569]">
            30-day money-back guarantee. No questions asked.
          </p>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-24 lg:py-32 bg-[#0F172A] relative">
        <div className="relative max-w-4xl mx-auto px-6 lg:px-8 text-center">
          <h2 className="font-display text-3xl sm:text-4xl lg:text-5xl font-bold text-white mb-6">
            Your competitors are building backlinks.<br />
            <span className="text-[#16a34a]">Are you?</span>
          </h2>
          <p className="text-xl text-[#cbd5e1] mb-10 max-w-2xl mx-auto">
            Every day you wait is another day they are pulling ahead in search rankings.
            Start building your backlink portfolio today—it takes less than 5 minutes.
          </p>
          <Link
            href="/register"
            className="inline-flex bg-[#16a34a] hover:bg-[#15803d] text-white px-10 py-4 rounded-xl text-lg font-semibold transition-all hover:shadow-xl"
            style={{boxShadow: "0 10px 25px -5px rgba(34,197,94,0.25)"}}
          >
            Start planting links free →
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-16 bg-[#0F172A]" style={{borderTop: "1px solid rgba(255,255,255,0.1)"}}>
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-10 mb-16">
            <div className="col-span-2 md:col-span-1">
              <div className="font-display text-xl font-bold mb-4">
                <span className="text-white">Link</span>
                <span className="text-[#16a34a]">Planter</span>
              </div>
              <p className="text-[#94a3b8] text-sm leading-relaxed">
                Build backlinks that matter.<br />Grow your search rankings.
              </p>
            </div>
            <div>
              <h2 className="text-white font-semibold mb-4 text-base">Product</h2>
              <ul className="space-y-3 text-sm">
                <li><a href="#why" className="text-[#cbd5e1] hover:text-white transition-colors">Why LinkPlanter</a></li>
                <li><a href="#how" className="text-[#cbd5e1] hover:text-white transition-colors">How It Works</a></li>
                <li><a href="#pricing" className="text-[#cbd5e1] hover:text-white transition-colors">Pricing</a></li>
              </ul>
            </div>
            <div>
              <h2 className="text-white font-semibold mb-4 text-base">Company</h2>
              <ul className="space-y-3 text-sm">
                <li><a href="#" className="text-[#cbd5e1] hover:text-white transition-colors">About</a></li>
                <li><a href="#" className="text-[#cbd5e1] hover:text-white transition-colors">Blog</a></li>
                <li><a href="#" className="text-[#cbd5e1] hover:text-white transition-colors">Contact</a></li>
              </ul>
            </div>
            <div>
              <h2 className="text-white font-semibold mb-4 text-base">Legal</h2>
              <ul className="space-y-3 text-sm">
                <li><a href="#" className="text-[#cbd5e1] hover:text-white transition-colors">Privacy</a></li>
                <li><a href="#" className="text-[#cbd5e1] hover:text-white transition-colors">Terms</a></li>
              </ul>
            </div>
          </div>
          <div className="pt-8 text-center text-[#94a3b8] text-sm" style={{borderTop: "1px solid rgba(255,255,255,0.1)"}}>
            © 2025 LinkPlanter. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}
