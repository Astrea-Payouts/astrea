import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
	/* config options here */
	allowedDevOrigins: ["192.168.100.8"],
};

export default withNextIntl(nextConfig);
