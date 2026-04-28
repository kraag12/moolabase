// import { withSentryConfig } from "@sentry/nextjs";
import type { NextConfig } from "next";

const supabaseHostname = (() => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!url) return null

  try {
    return new URL(url).hostname
  } catch {
    return null
  }
})()

const nextConfig: NextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  experimental: {
    workerThreads: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**.supabase.co",
      },
      ...(supabaseHostname
        ? [
            {
              protocol: "https" as const,
              hostname: supabaseHostname,
            },
          ]
        : []),
    ],
  },
  async redirects() {
    return [
      {
        source: "/post/services/:id",
        destination: "/post/jobs/service/:id",
        permanent: true,
      },
      {
        source: "/post/services/:id/apply",
        destination: "/post/jobs/service/:id/apply",
        permanent: true,
      },
      {
        source: "/post/jobs/services",
        destination: "/post/jobs/service",
        permanent: true,
      },
      {
        source: "/post/jobs/services/:id",
        destination: "/post/jobs/service/:id",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;

// export default withSentryConfig(nextConfig, {
//   // For all available options, see:
//   // https://www.npmjs.com/package/@sentry/webpack-plugin#options

//   org: "moolabase",

//   project: "javascript-nextjs",

//   // Only print logs for uploading source maps in CI
//   silent: !process.env.CI,

//   // For all available options, see:
//   // https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/

//   // Upload a larger set of source maps for prettier stack traces (increases build time)
//   widenClientFileUpload: true,

//   // Route browser requests to Sentry through a Next.js rewrite to circumvent ad-blockers.
//   // This can increase your server load as well as your hosting bill.
//   // Note: Check that the configured route will not match with your Next.js middleware, otherwise reporting of client-
//   // side errors will fail.
//   tunnelRoute: "/monitoring",

//   webpack: {
//     // Enables automatic instrumentation of Vercel Cron Monitors. (Does not yet work with App Router route handlers.)
//     // See the following for more information:
//     // https://docs.sentry.io/product/crons/
//     // https://vercel.com/docs/cron-jobs
//     automaticVercelMonitors: true,

//     // Tree-shaking options for reducing bundle size
//     treeshake: {
//       // Automatically tree-shake Sentry logger statements to reduce bundle size
//       removeDebugLogging: true,
//     },
//   }
// });
