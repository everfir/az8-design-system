import type { NextConfig } from "next";

// GitHub Pages 静态导出。
// - output: "export" → next build 产出 out/ 静态文件
// - basePath / assetPrefix：repo 名作为子路径（仓库托管在 user.github.io/<repo> 时必须）
//   想自定义域名时把 NEXT_PUBLIC_BASE_PATH 留空即可。
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

const nextConfig: NextConfig = {
  output: "export",
  basePath,
  assetPrefix: basePath || undefined,
  trailingSlash: true,
  images: { unoptimized: true },
};

export default nextConfig;
