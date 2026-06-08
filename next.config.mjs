import os from "os";

function getLanIps() {
  const hosts = [];
  for (const iface of Object.values(os.networkInterfaces())) {
    for (const net of iface ?? []) {
      if (net.family === "IPv4" && !net.internal && net.address) {
        hosts.push(net.address);
      }
    }
  }
  return hosts;
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  allowedDevOrigins: getLanIps(),
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
