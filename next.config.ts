import type { NextConfig } from "next";
const config: NextConfig = {
  poweredByHeader: false,
  ...(process.env.TECHKASIR_STATIC === "true" ? { output: "export" as const } : {}),
};
export default config;
