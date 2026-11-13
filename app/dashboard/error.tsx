"use client";
export default function DashboardError({ reset }: { reset: () => void }) {
  return <main className="page-loading"><h1>We couldn’t open your workspace.</h1><p>Please try again in a moment.</p><button className="primary" onClick={reset}>Try again</button></main>;
}
