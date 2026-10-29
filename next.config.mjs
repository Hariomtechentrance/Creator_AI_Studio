export default {
  reactStrictMode: true,
  poweredByHeader: false,
  compress: true,
  // ffmpeg-static's binary and the stitch route's bundled font are only
  // reached via a runtime fs path (process.cwd()-relative), never a static
  // import/require, so Next's file tracer can't discover them on its own —
  // without this they'd be missing from the deployed serverless function
  // even though `next dev` (which serves straight off disk) hides the gap.
  outputFileTracingIncludes: {
    "/api/generate-video": ["./node_modules/ffmpeg-static/**"],
    "/api/video-pipeline/stitch": ["./node_modules/ffmpeg-static/**", "./assets/fonts/**"],
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-XSS-Protection', value: '1; mode=block' },
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
          // Partial CSP on purpose. A full `default-src`/`script-src` policy
          // would break this app's heavy inline-style usage (React `style={{}}`
          // => style attributes) and the many third-party media hosts
          // (Replicate, HeyGen, HF, Google) until a nonce-based CSP is built.
          // These directives close the highest-severity holes without that
          // refactor: clickjacking (frame-ancestors), <base> hijacking, plugin
          // injection, and form redirection.
          { key: 'Content-Security-Policy', value: "frame-ancestors 'none'; base-uri 'self'; object-src 'none'; form-action 'self'" },
        ],
      },
    ];
  },
};
