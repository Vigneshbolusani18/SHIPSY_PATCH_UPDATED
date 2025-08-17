/** @type {import('next').NextConfig} */
const nextConfig = {
  // Remove swcMinify - it's deprecated
  // swcMinify: true,
  
  experimental: {
    // Remove typedRoutes for Turbopack compatibility
    // typedRoutes: true,
    optimizeCss: true,
    scrollRestoration: true,
  },
}

export default nextConfig