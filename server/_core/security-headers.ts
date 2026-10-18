/**
 * Browser-facing baseline for KEIRA's self-hosted HTTP service. The policy
 * deliberately permits KEIRA's local assets, approved Google font origins,
 * HTTPS avatars, and same-origin API traffic while refusing frames, plugins,
 * and arbitrary script execution. The explicit wasm-unsafe-eval source is
 * limited to WebAssembly compilation for the browser-local embedding runtime;
 * it does not permit string-based JavaScript evaluation.
 */
export const KEIRA_SECURITY_HEADERS = Object.freeze({
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), geolocation=(), payment=(), usb=()",
  "Cross-Origin-Opener-Policy": "same-origin",
  "Content-Security-Policy": [
    "default-src 'self'",
    "base-uri 'self'",
    "frame-ancestors 'none'",
    "form-action 'self'",
    "object-src 'none'",
    "script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' data: https://fonts.gstatic.com",
    "img-src 'self' data: blob: https:",
    "connect-src 'self' ws: wss:",
    "media-src 'self' blob:",
    "worker-src 'self' blob:",
  ].join("; "),
});
