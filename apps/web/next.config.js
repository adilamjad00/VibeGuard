/**
 * The browser never talks to the API's public URL directly. Same-origin
 * `/api/*` is proxied to the api service over the Zerops private network, which
 * removes CORS entirely and means the frontend never has to know a public
 * hostname that only exists after the API's subdomain is enabled. Phase 4's SSE
 * stream rides the same path.
 *
 * Caveat, verified by testing rather than assumed: rewrite destinations are
 * resolved at BUILD time and frozen into the routes manifest — re-running
 * next.config.js on `next start` does not change them. So API_INTERNAL_URL must
 * be set as a *build* env var in zerops.yaml, not just a run one. The default
 * below is the correct production value; it is the local dev case that cannot
 * override it.
 *
 * @type {import('next').NextConfig}
 */
const nextConfig = {
  reactStrictMode: true,
  async rewrites() {
    const api = process.env.API_INTERNAL_URL ?? "http://api:3001";
    return [{ source: "/api/:path*", destination: `${api}/:path*` }];
  },
};

export default nextConfig;
