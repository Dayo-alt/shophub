import { Store, ShieldCheck, Users, Globe2 } from 'lucide-react';

export function AboutPage() {
  return (
    <div className="bg-gray-50 min-h-[calc(100vh-4rem)]">
      <section className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-10 animate-fade-in">
        {/* Intro */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-8">
          <div className="space-y-4 max-w-xl">
            <div className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700">
              <Store className="size-3.5" />
              <span>About ShopHub</span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight text-gray-900">
              A marketplace built for buyers and sellers
            </h1>
            <p className="text-sm sm:text-base text-gray-600 leading-relaxed">
              ShopHub is a simple ecommerce experience where anyone can discover quality products,
              compare options, and buy with confidence. Sellers get the tools they need to list
              products, manage orders, and grow their business – all in one place.
            </p>
          </div>

          <div className="hidden md:block rounded-2xl bg-gradient-to-br from-blue-600 via-indigo-500 to-sky-500 text-white p-6 shadow-lg min-w-[260px]">
            <p className="text-xs uppercase tracking-widest text-blue-100 mb-2">Our focus</p>
            <p className="text-sm font-medium mb-3">
              Make it easy to shop, and even easier to sell.
            </p>
            <ul className="space-y-1.5 text-xs text-blue-50">
              <li>• Clear, modern buyer experience</li>
              <li>• Straightforward tools for sellers</li>
              <li>• Secure, reliable infrastructure</li>
            </ul>
          </div>
        </div>

        {/* Values / pillars */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="rounded-2xl bg-white p-5 shadow-sm border border-gray-100 transition-all duration-300 hover:-translate-y-1 hover:shadow-md">
            <div className="flex items-center gap-3 mb-3">
              <Users className="size-5 text-blue-600" />
              <h2 className="text-sm font-semibold text-gray-900">For every buyer</h2>
            </div>
            <p className="text-xs text-gray-600 leading-relaxed">
              Browse by category, search by keyword, and explore detailed product cards with
              ratings, reviews, and clear pricing so you always know what you are getting.
            </p>
          </div>

          <div className="rounded-2xl bg-white p-5 shadow-sm border border-gray-100 transition-all duration-300 hover:-translate-y-1 hover:shadow-md">
            <div className="flex items-center gap-3 mb-3">
              <Store className="size-5 text-blue-600" />
              <h2 className="text-sm font-semibold text-gray-900">Built for sellers</h2>
            </div>
            <p className="text-xs text-gray-600 leading-relaxed">
              Sellers get a dedicated dashboard to add products, set stock levels, manage
              categories, and track performance – without needing a separate website.
            </p>
          </div>

          <div className="rounded-2xl bg-white p-5 shadow-sm border border-gray-100 transition-all duration-300 hover:-translate-y-1 hover:shadow-md">
            <div className="flex items-center gap-3 mb-3">
              <ShieldCheck className="size-5 text-blue-600" />
              <h2 className="text-sm font-semibold text-gray-900">Secure by design</h2>
            </div>
            <p className="text-xs text-gray-600 leading-relaxed">
              Authentication, payments, and data are handled with modern best practices so that
              buyers and sellers can focus on their transactions, not the underlying tech.
            </p>
          </div>
        </section>

        {/* Mission blurb */}
        <section className="rounded-2xl bg-white p-6 sm:p-7 shadow-sm border border-gray-100 flex flex-col md:flex-row md:items-center gap-6">
          <div className="flex-1 space-y-3">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <Globe2 className="size-5 text-blue-600" />
              Our mission
            </h2>
            <p className="text-sm text-gray-600 leading-relaxed">
              We are building a marketplace experience that feels fast, familiar, and trustworthy
              – whether you are browsing from your phone in a few spare minutes or managing a full
              catalogue of products as a seller. ShopHub is intentionally designed to stay out of
              your way and let great products speak for themselves.
            </p>
          </div>
          <div className="text-xs text-gray-500 max-w-xs">
            <p className="mb-2 font-medium text-gray-700">Who is ShopHub for?</p>
            <p>
              • Buyers who want a clean, focused way to shop.
              <br />
              • New sellers testing ideas.
              <br />
              • Growing businesses that need a simple online storefront.
            </p>
          </div>
        </section>
      </section>
    </div>
  );
}
