// AIUSAGE_BUILD is replaced by the production build, so dist runs without env setup.
export const production = Bun.env.NODE_ENV === "production" || process.env.AIUSAGE_BUILD === "production";
