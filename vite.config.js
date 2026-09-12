// HBuilderX 3.2.0+ 会自动加载本文件并与内置编译配置合并（仅 vue3 工程生效）。
// 用途：H5 联调时的开发服务器反向代理，解决浏览器 CORS 跨域。
//
// 注意：
// 1. 只在 H5「运行（devServer）」时生效；发行构建、小程序（原生请求，无跨域概念）不受影响。
// 2. 不要在这里加 uni() 插件 —— HBuilderX 内部已经注入；本文件只放增量配置。
// 3. 用法：H5 联调时把 .env.development 的 VITE_APP_BASE_URL 改为 '/api'（相对路径），
//    请求即命中下面代理转发到真实后端；小程序不支持相对路径，切回小程序联调时改回绝对地址。
//    （request 层的 joinURL 已兼容相对 / 绝对两种写法，切来切去无需改代码）
//
// 故意用纯对象导出、不 import 'vite'：零新增依赖，开箱即用。
export default {
  server: {
    proxy: {
      '/api': {
        target: 'https://api.example-dev.com',
        changeOrigin: true,
        // 后端接口本身带 /api 前缀时，删掉下面这行 rewrite（否则会把前缀 strip 掉导致 404）
        rewrite: path => path.replace(/^\/api/, ''),
        // 目标是自签证书的 https 时打开下面两项
        // secure: false,
        // ws: true, // 需要代理 websocket 时打开
      },
    },
  },
}
