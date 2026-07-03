import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV || "development",

  // Edge Runtime（middleware）采样率，生产 10%
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,

  enabled: process.env.NODE_ENV === "production" || !!process.env.SENTRY_DSN,
});
