"use client";

import { useState } from "react";
import Link from "next/link";

export default function InstallationChecker() {
    const [urlInput, setUrlInput] = useState("");
    const [result, setResult] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState("");

    const handleCheck = async () => {
        setError("");
        const url = urlInput.trim();

        if (!url) {
            setError("Please enter a URL to check.");
            return;
        }

        setIsLoading(true);
        setResult(null);

        try {
            const response = await fetch("/api/check-installation", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                // We could also pass credentials here if needed by UI
                body: JSON.stringify({ url }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || "Failed to check installation");
            }

            setResult(data);
        } catch (err) {
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    };

    const StatusIcon = ({ pass, warning = false }) => {
        if (pass && !warning) {
            return (
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-400 border border-emerald-500/20 shadow-[0_0_15px_rgba(16,185,129,0.15)]">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                    </svg>
                </div>
            );
        }
        if (warning) {
            return (
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-amber-500/10 flex items-center justify-center text-amber-400 border border-amber-500/20 shadow-[0_0_15px_rgba(245,158,11,0.15)]">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                </div>
            );
        }
        return (
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-red-500/10 flex items-center justify-center text-red-400 border border-red-500/20 shadow-[0_0_15px_rgba(239,68,68,0.15)]">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
            </div>
        );
    };

    return (
        <div className="min-h-screen bg-slate-950 text-slate-200 p-6 md:p-12 font-sans selection:bg-purple-500/30">
            <div className="max-w-6xl mx-auto space-y-8">

                {/* Header */}
                <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-6">
                    <div>
                        <Link href="/" className="text-purple-400 hover:text-purple-300 text-sm font-medium inline-flex items-center mb-2 transition-colors">
                            <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
                            </svg>
                            Back to Dashboard
                        </Link>
                        <h1 className="text-3xl font-bold text-white">Installation Validation</h1>
                        <p className="text-slate-400 mt-1">Deep analysis of script tags, CSP headers, and performance constraints.</p>
                    </div>
                </header>

                {/* Form area */}
                <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6 shadow-xl relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-purple-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>

                    <div className="relative space-y-4">
                        <label htmlFor="url" className="block text-sm font-medium text-slate-300">
                            Target URL
                        </label>
                        <div className="flex flex-col md:flex-row gap-4">
                            <input
                                id="url"
                                type="url"
                                className="flex-1 w-full bg-slate-950/50 border border-slate-700/50 rounded-xl px-4 py-3 text-slate-200 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50 transition-all font-mono text-sm"
                                placeholder="https://example.com"
                                value={urlInput}
                                onChange={(e) => setUrlInput(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleCheck()}
                            />
                            <button
                                onClick={handleCheck}
                                disabled={isLoading}
                                className="group relative inline-flex items-center justify-center rounded-xl bg-purple-600 px-8 py-3 text-sm font-semibold text-white shadow-sm hover:bg-purple-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-purple-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all md:w-auto w-full"
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
                                        Run Deep Analysis
                                        <svg className="ml-2 w-4 h-4 group-hover:translate-x-0.5 transition-transform" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12h15m0 0l-6.75-6.75M19.5 12l-6.75 6.75" />
                                        </svg>
                                    </>
                                )}
                            </button>
                        </div>

                        {error && (
                            <div className="flex items-center gap-2 text-red-400 bg-red-950/20 border border-red-900/50 rounded-lg p-3 text-sm animate-in fade-in slide-in-from-top-2">
                                <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                </svg>
                                {error}
                            </div>
                        )}
                    </div>
                </div>

                {/* Results Dashboard */}
                {result && (
                    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-8 duration-700 delay-150">

                        {/* Automatic Checks Collection */}
                        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
                            <div className="px-6 py-5 border-b border-slate-800 flex justify-between items-center bg-slate-800/20">
                                <h3 className="font-semibold text-lg text-white flex items-center">
                                    <svg className="w-5 h-5 mr-3 text-purple-400" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3l-4.5 16.5" />
                                    </svg>
                                    Automatic Checks
                                </h3>
                            </div>

                            {(() => {
                                const groups = [];

                                // 1. Loading speed and anti flicker of the engine
                                const speedAndFlickerChecks = result.tests?.filter(t =>
                                    t.id === 'engine-head' ||
                                    t.id === 'engine-async' ||
                                    t.id === 'engine-fetchpriority' ||
                                    t.id.startsWith('antiflicker-')
                                ) || [];

                                // Create a pseudo-check for the UI render function to handle the performance card
                                const performanceComponent = {
                                    isCustomComponent: true,
                                    component: (
                                        <div className="px-6 py-6 bg-slate-900 border-b border-slate-800/50">
                                            <h4 className="text-slate-300 font-medium mb-2 flex items-center">
                                                <svg className="w-4 h-4 mr-2 text-indigo-400" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                </svg>
                                                Loading Timeline
                                            </h4>
                                            <p className="text-sm text-slate-400 mb-6 w-full">
                                                The speed calculated below is a consequence of how well your installation follows the best practices listed in this section.
                                            </p>
                                            <div className="space-y-3 w-full">
                                                <div className="flex justify-between items-end border-b border-slate-800 pb-2">
                                                    <span className="text-sm text-slate-500">Wait Time <span className="text-xs opacity-75">(Started at)</span></span>
                                                    <span className="text-lg font-mono text-slate-300">{result.performance?.startTime || 0}ms</span>
                                                </div>
                                                <div className="flex justify-between items-end border-b border-slate-800 pb-2">
                                                    <span className="text-sm text-slate-500">Download <span className="text-xs opacity-75">(Fetch duration)</span></span>
                                                    <span className="text-lg font-mono text-slate-300">{result.performance?.duration || 0}ms</span>
                                                </div>
                                                <div className="flex justify-between items-end border-b border-slate-800 pb-2">
                                                    <span className="text-sm text-slate-500">Artificial Delay <span className="text-xs opacity-75">(Added manually)</span></span>
                                                    <span className="text-lg font-mono text-slate-300">+300ms</span>
                                                </div>
                                                <div className="flex justify-between items-end pt-1">
                                                    <span className="text-sm font-medium text-slate-400">Total Ready Time</span>
                                                    <span className="text-xl font-bold font-mono text-slate-100">{result.performance ? (result.performance.responseEnd + 300) : 0}ms</span>
                                                </div>
                                            </div>
                                            <div className="mt-5 flex items-center gap-2 w-full bg-slate-950/50 p-3 rounded-lg border border-slate-800/50">
                                                <StatusIcon pass={result.performance?.loadedWithin3s && (result.performance?.responseEnd + 300) < 1000} warning={(result.performance?.responseEnd + 300) >= 1000 && (result.performance?.responseEnd + 300) <= 2000} />
                                                <span className={`text-sm font-medium leading-tight ${result.performance?.loadedWithin3s && (result.performance?.responseEnd + 300) < 1000 ? 'text-emerald-400' : ((result.performance?.responseEnd + 300) <= 2000 ? 'text-amber-400' : 'text-red-400')}`}>
                                                    {result.performance?.loadedWithin3s
                                                        ? ((result.performance?.responseEnd + 300) < 1000 ? 'Excellent speed (<1s total)' : ((result.performance?.responseEnd + 300) <= 2000 ? `Slow load (${result.performance?.responseEnd + 300}ms total)` : `Ewwww (${result.performance?.responseEnd + 300}ms total)`))
                                                        : 'Load timeout (>3s total)'}
                                                </span>
                                            </div>
                                        </div>
                                    )
                                };

                                groups.push({
                                    title: 'Loading speed and anti flicker of the engine',
                                    checks: speedAndFlickerChecks,
                                    customComponent: performanceComponent
                                });

                                // 2. Proofs of the engine working
                                const workingProofsChecks = (result.apiChecks || []).map(c => ({
                                    test: c.pass,
                                    pass: c.message,
                                    fail: c.message,
                                    warning: false
                                }));

                                // Eval policy check
                                workingProofsChecks.push({
                                    id: 'eval-policy',
                                    test: result.evalWorks,
                                    pass: 'Eval() execution is permitted by CSP headers',
                                    fail: 'Eval() execution is BLOCKED by CSP headers (Required for execution)',
                                    warning: false
                                });

                                // Iframe checks
                                const iframeChecks = result.tests?.filter(t => t.id.startsWith('iframe-')) || [];
                                const combinedWorkingProofs = [...workingProofsChecks, ...iframeChecks];

                                if (combinedWorkingProofs.length > 0) {
                                    groups.push({ title: 'Proofs of the engine working', checks: combinedWorkingProofs });
                                }

                                // 3. General good practice checks
                                const bestPracticeChecks = result.tests?.filter(t =>
                                    t.id === 'engine-presence' ||
                                    t.id === 'engine-unique'
                                ) || [];

                                if (bestPracticeChecks.length > 0) {
                                    groups.push({ title: 'General good practice checks', checks: bestPracticeChecks });
                                }

                                if (groups.length === 0) {
                                    return (
                                        <div className="px-6 py-8 text-center text-slate-500">
                                            No automatic checks ran (Kameleoon script not detected).
                                        </div>
                                    );
                                }

                                return (
                                    <div className="divide-y divide-slate-800">
                                        {groups.map((group, groupIdx) => (
                                            <div key={groupIdx}>
                                                <div className="bg-slate-800/80 px-6 py-2.5 text-xs font-semibold text-purple-300 uppercase tracking-wider shadow-inner">
                                                    {group.title}
                                                </div>
                                                {group.customComponent && group.customComponent.component}
                                                <ul className="divide-y divide-slate-800/50">
                                                    {group.checks.map((check, i) => (
                                                        <li key={i} className="px-6 py-4 flex items-start gap-4 hover:bg-slate-800/50 transition-colors bg-slate-900">
                                                            <div className="mt-0.5">
                                                                <StatusIcon pass={check.test} warning={check.warning} />
                                                            </div>
                                                            <div className="space-y-1 flex-1">
                                                                <p className={`font-medium ${check.test ? (check.warning ? 'text-amber-300' : 'text-slate-200') : 'text-red-300'}`}>
                                                                    {check.test ? check.pass : check.fail}
                                                                </p>
                                                                {check.debug && (
                                                                    <p className={`text-sm ${check.warning ? 'text-amber-500/80 bg-amber-950/30 border-amber-900/50' : 'text-slate-500 bg-slate-950 border-slate-800/50'} font-mono  p-2 rounded-lg border mt-2 break-all`}>
                                                                        {check.debug}
                                                                    </p>
                                                                )}
                                                            </div>
                                                        </li>
                                                    ))}
                                                </ul>
                                            </div>
                                        ))}
                                    </div>
                                );
                            })()}
                        </div>

                        {/* Interactive Manual Checks Guide */}
                        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl mb-12">
                            <div className="px-6 py-5 border-b border-slate-800 flex justify-between items-center bg-slate-800/20">
                                <h3 className="font-semibold text-lg text-white flex items-center">
                                    <svg className="w-5 h-5 mr-3 text-slate-400" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z" />
                                    </svg>
                                    Manual Checklist Guide
                                </h3>
                            </div>
                            <div className="p-6 text-slate-300 space-y-6">
                                <p className="text-sm text-slate-400">These checks require manual intervention via the browser console or network tab.</p>

                                <div className="space-y-4">
                                    <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
                                        <h4 className="font-semibold text-slate-200 flex items-center mb-2">
                                            📍 Graphic Editor - CORS Check
                                        </h4>
                                        <ul className="list-disc list-inside text-sm space-y-1 text-slate-400 ml-2">
                                            <li>Open the Kameleoon graphic editor</li>
                                            <li>Check the browser console for CORS errors</li>
                                            <li>If CORS errors exist, client needs to whitelist: <code className="text-purple-300">*.kameleoon.js</code>, <code className="text-purple-300">*.kameleoon.eu</code>, <code className="text-purple-300">*.kameleoon.io</code></li>
                                        </ul>
                                    </div>

                                    <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
                                        <h4 className="font-semibold text-slate-200 flex items-center mb-2">
                                            📍 Consent Management
                                        </h4>
                                        <ul className="list-disc list-inside text-sm space-y-1 text-slate-400 ml-2">
                                            <li>Before interaction: check <code className="text-purple-300">Kameleoon.API.Visitor.experimentLegalConsent === null</code></li>
                                            <li>After accept check: <code className="text-purple-300">=== true</code></li>
                                            <li>After reject check: <code className="text-purple-300">=== false</code></li>
                                        </ul>
                                    </div>
                                </div>
                            </div>
                        </div>

                    </div>
                )}
            </div>
        </div>
    );
}
