/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // SQLite on Vercel: run the /tmp copy hook and bundle the DB into functions.
  experimental: {
    instrumentationHook: true,
    outputFileTracingIncludes: {
      "/*": ["./prisma/dev.db"],
    },
  },
  images: {
    unoptimized: true,
    remotePatterns: [{ protocol: "https", hostname: "**" }],
  },
};
module.exports = nextConfig;
