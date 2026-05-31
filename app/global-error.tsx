"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

export default function GlobalError({
  error,
}: {
  error: Error & { digest?: string };
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en">
      <body>
        <main className="min-h-screen bg-neutral-50 flex items-center justify-center px-6">
          <div className="w-full max-w-lg rounded-2xl border border-neutral-200 bg-white p-8 text-center shadow-sm">
            <h1 className="text-2xl font-bold text-neutral-900">Something went wrong</h1>
            <p className="mt-3 text-neutral-600">
              The app hit an unexpected client error. Please refresh the page and try again.
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-6 inline-flex items-center justify-center rounded-lg bg-black px-5 py-3 text-sm font-semibold text-white hover:bg-neutral-800"
            >
              Refresh page
            </button>
          </div>
        </main>
      </body>
    </html>
  );
}
