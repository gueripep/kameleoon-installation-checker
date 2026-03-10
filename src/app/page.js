import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 text-slate-100 font-sans p-8 md:p-24 selection:bg-indigo-500/30">
      <div className="max-w-4xl mx-auto space-y-12">
        <header className="space-y-4">
          <div className="inline-flex items-center rounded-full bg-indigo-500/10 px-3 py-1 text-sm font-medium text-indigo-400 ring-1 ring-inset ring-indigo-500/20 mb-4">
            v2.0 Developer Tools
          </div>
          <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-indigo-200 via-purple-200 to-indigo-200">
            Kameleoon Checker
          </h1>
          <p className="text-lg text-slate-400 max-w-2xl leading-relaxed">
            Automated analysis and validation suite for Kameleoon installations. Ensure your scripts are properly embedded, prioritized, and executing correctly.
          </p>
        </header>

        <div className="grid md:grid-cols-2 gap-6 mt-12">
          {/* Card 1: Engine Checker */}
          <Link href="/engine-checker" className="group relative rounded-2xl p-8 bg-slate-800/50 hover:bg-slate-800 border border-slate-700 hover:border-indigo-500/50 shadow-xl transition-all duration-300 hover:-translate-y-1 overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/10 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
            <div className="relative">
              <div className="w-12 h-12 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-400 mb-6 group-hover:scale-110 transition-transform duration-300">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M14.25 9.75L16.5 12l-2.25 2.25m-4.5 0L7.5 12l2.25-2.25M6 20.25h12A2.25 2.25 0 0020.25 18V6A2.25 2.25 0 0018 3.75H6A2.25 2.25 0 003.75 6v12A2.25 2.25 0 006 20.25z" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-white mb-3">Engine Checker</h2>
              <p className="text-slate-400 line-clamp-3">
                Bulk test a list of URLs to verify whether they load <code className="text-indigo-300 text-sm">engine.js</code> or <code className="text-indigo-300 text-sm">kameleoon.js</code>. Perfect for auditing multiple domains.
              </p>
              <div className="mt-8 flex items-center text-indigo-400 font-medium">
                Launch tool
                <svg className="ml-2 w-4 h-4 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12h15m0 0l-6.75-6.75M19.5 12l-6.75 6.75" />
                </svg>
              </div>
            </div>
          </Link>

          {/* Card 2: Installation Checker */}
          <Link href="/installation-checker" className="group relative rounded-2xl p-8 bg-slate-800/50 hover:bg-slate-800 border border-slate-700 hover:border-purple-500/50 shadow-xl transition-all duration-300 hover:-translate-y-1 overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-purple-500/10 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
            <div className="relative">
              <div className="w-12 h-12 rounded-xl bg-purple-500/10 flex items-center justify-center text-purple-400 mb-6 group-hover:scale-110 transition-transform duration-300">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 01-1.043 3.296 3.745 3.745 0 01-3.296 1.043A3.745 3.745 0 0112 21c-1.268 0-2.39-.63-3.068-1.593a3.746 3.746 0 01-3.296-1.043 3.745 3.745 0 01-1.043-3.296A3.745 3.745 0 013 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 011.043-3.296 3.746 3.746 0 013.296-1.043A3.746 3.746 0 0112 3c1.268 0 2.39.63 3.068 1.593a3.746 3.746 0 013.296 1.043 3.746 3.746 0 011.043 3.296A3.745 3.745 0 0121 12z" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-white mb-3">Installation Validation</h2>
              <p className="text-slate-400 line-clamp-3">
                Deep-dive analysis of a single URL. Verifies script order, CSP headers, fetch priorities, eval permissions, and API presence.
              </p>
              <div className="mt-8 flex items-center text-purple-400 font-medium">
                Launch tool
                <svg className="ml-2 w-4 h-4 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12h15m0 0l-6.75-6.75M19.5 12l-6.75 6.75" />
                </svg>
              </div>
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
}
