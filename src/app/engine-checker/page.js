"use client";

import { useState } from "react";
import Link from "next/link";

export default function EngineChecker() {
    const [urlsInput, setUrlsInput] = useState("");
    const [results, setResults] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState("");

    const handleCheck = async () => {
        setError("");
        const urlArray = urlsInput
            .split("\n")
            .map((u) => u.trim())
            .filter((u) => u !== "");

        if (urlArray.length === 0) {
            setError("Please enter at least one URL.");
            return;
        }

        setIsLoading(true);

        try {
            const response = await fetch("/api/check-engine", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ urls: urlArray }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || "Failed to check URLs");
            }

            setResults(data.results);
        } catch (err) {
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-950 text-slate-200 p-6 md:p-12 font-sans selection:bg-indigo-500/30">
            <div className="max-w-6xl mx-auto space-y-8">
                {/* Header */}
                <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-6">
                    <div>
                        <Link href="/" className="text-indigo-400 hover:text-indigo-300 text-sm font-medium inline-flex items-center mb-2 transition-colors">
                            <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
                            </svg>
                            Back to Dashboard
                        </Link>
                        <h1 className="text-3xl font-bold text-white">Engine Checker</h1>
                        <p className="text-slate-400 mt-1">Bulk analyze domains to find Kameleoon installations.</p>
                    </div>
                </header>

                {/* Form area */}
                <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6 shadow-xl relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>

                    <div className="relative space-y-4">
                        <label htmlFor="urls" className="block text-sm font-medium text-slate-300">
                            List of URLs (one per line)
                        </label>
                        <textarea
                            id="urls"
                            rows={6}
                            className="w-full bg-slate-950/50 border border-slate-700/50 rounded-xl p-4 text-slate-200 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition-all font-mono text-sm leading-relaxed"
                            placeholder="example.com&#10;https://another-site.com"
                            value={urlsInput}
                            onChange={(e) => setUrlsInput(e.target.value)}
                        />

                        {error && (
                            <div className="flex items-center gap-2 text-red-400 bg-red-950/20 border border-red-900/50 rounded-lg p-3 text-sm">
                                <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                </svg>
                                {error}
                            </div>
                        )}

                        <div className="flex justify-end">
                            <button
                                onClick={handleCheck}
                                disabled={isLoading}
                                className="group relative inline-flex items-center justify-center rounded-xl bg-indigo-600 px-6 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                            >
                                {isLoading ? (
                                    <>
                                        <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                        </svg>
                                        Analyzing...
                                    </>
                                ) : (
                                    <>
                                        Run Analysis
                                        <svg className="ml-2 w-4 h-4 group-hover:translate-x-0.5 transition-transform" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12h15m0 0l-6.75-6.75M19.5 12l-6.75 6.75" />
                                        </svg>
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>

                {/* Results Area */}
                {results.length > 0 && (
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-xl overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm text-slate-300">
                                <thead className="text-xs uppercase bg-slate-800/50 text-slate-400 border-b border-slate-700">
                                    <tr>
                                        <th scope="col" className="px-6 py-4 font-semibold tracking-wider">URL</th>
                                        <th scope="col" className="px-6 py-4 font-semibold tracking-wider">Detection Result</th>
                                        <th scope="col" className="px-6 py-4 font-semibold tracking-wider">Details</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-800">
                                    {results.map((res, i) => (
                                        <tr key={i} className="hover:bg-slate-800/20 transition-colors">
                                            <td className="px-6 py-4 whitespace-nowrap font-medium text-slate-200">
                                                <a href={res.url} target="_blank" rel="noopener noreferrer" className="hover:text-indigo-400 transition-colors">
                                                    {res.url}
                                                </a>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${res.result === 'kameleoon.js'
                                                    ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                                                    : res.result === 'engine.js'
                                                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                                        : res.result === 'BOTH (Unexpected)'
                                                            ? 'bg-red-500/10 text-red-400 border-red-500/20'
                                                            : res.result === 'NONE'
                                                                ? 'bg-slate-500/10 text-slate-400 border-slate-500/20'
                                                                : 'bg-red-500/10 text-red-400 border-red-500/20'
                                                    }`}>
                                                    {res.result === 'engine.js' ? (
                                                        <svg className="mr-1 h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>
                                                    ) : res.result === 'kameleoon.js' ? (
                                                        <svg className="mr-1 h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                                                    ) : res.result === 'NONE' ? (
                                                        <svg className="mr-1 h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 12h-15" /></svg>
                                                    ) : (
                                                        <svg className="mr-1 h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                                                    )}
                                                    {res.result === 'engine.js' ? 'engine.js (Modern)' : res.result === 'kameleoon.js' ? 'kameleoon.js (Legacy)' : res.result}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-xs text-slate-500">
                                                {res.details || '-'}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
