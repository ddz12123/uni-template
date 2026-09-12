# uni-enterprise-template

HBuilderX 原生工程的 uni-app 空白模板（Vue3 + TS + Pinia + Wot UI v2 + SCSS）。
基础设施已就位，页面为空白，HBuilderX 直接「运行 / 发行」，不走 CLI 编译。

## 快速开始

```bash
npm install
```

HBuilderX 打开项目根目录 → 运行（首次提示安装「scss/sass 编译」插件，按提示装）。
微信小程序需在 `manifest.json` 填 `mp-weixin.appid`。

## 目录结构

```
components/AppProvider.vue   页面根容器：组件库暗黑模式 + 页面主题变量联动
config/index.ts              全局常量（成功码、超时、版本号取自 manifest.versionName、刷新接口、登录页）
pages/                       首页 / 我的（tabbar）+ login（401 登出回跳目标，redirect 回原页）
store/                       pinia + persistedstate；modules: user（登录态）/ app（主题）
styles/                      tokens.scss 设计令牌 / index.scss 全局样式
types/                       env.d.ts 环境变量类型 / vue-shim.d.ts / uni-app-shim.d.ts
utils/                       request 请求层 / auth / storage / report（节流上报）/ update（版本更新）/ share（全局分享）/ 工具函数（基于 @vueuse/core）
```

## 约定

### 请求（utils/request）

```ts
import { http } from '@/utils/request'

const data = await http.get<UserInfo>('/user/info', { id: 1 })
await http.post('/demo/form', data, { loading: true }) // 请求级选项：loading / silent
```

直接返回业务 data，失败抛 `ApiError` 并统一弹 toast（`silent: true` 关闭）。
token 自动注入（`/auth/login` 与刷新接口免带）；401 自动单飞刷新 token 并重放原请求，
刷新失败清登录态并 `reLaunch` 到登录页（已在登录页不再跳转，登录成功后按 `redirect` 回跳）。
接口约定改 `config/index.ts` 的 `SUCCESS_CODE` / `REFRESH_TOKEN_URL`。

### 登录态（store/modules/user.ts）

登录接口接入后调用 `setToken(token, refreshToken)`，用户信息维护到 `userInfo`；
`persist.pick` 的字段自动持久化到 uni storage。

### 全局分享（utils/share.ts）

`main.ts` 里 `app.mixin(shareMixin)` 一次接入，所有页面默认可发送给朋友 / 分享到朋友圈，
无需逐页处理。某页要定制，用 options 写法覆盖即可：

```vue
<script>
export default {
  onShareAppMessage() {
    return { title: '今日特价', path: '/pages/index/index' }
  },
}
</script>
```

注意：不要用 setup 的 `onShareAppMessage` 做覆盖，与全局 mixin 同存时可能不生效
（dcloudio/uni-app#3084）。

### 版本更新与异常

- 版本更新：`App.onLaunch` 调 `checkMiniProgramUpdate()`，有新包下载就绪后弹窗提示重启
- 异常链路：Vue 渲染报错（`main.ts errorHandler`）→ 小程序脚本错误（`App onError` + `uni.onError` 兜底）
  → 未捕获 Promise（`onUnhandledRejection`）→ 野路径（`onPageNotFound` 上报并回首页），统一进 `reportLog`
- 上报节流：`reportLog` 相同错误合并（`extra.repeatCount` 记次数），同批次最多 20 条、队列 200 条，
  后台延迟 ≤3 秒发送；`VITE_REPORT_URL` 留空则只打印不发送

### 主题

- `uni.scss`：编译期变量（`$app-*`），保留官方 `$uni-*` 兼容市场插件
- `styles/tokens.scss`：运行时变量（`--app-*`），暗黑经媒体查询 + `.theme-dark` 覆盖层
- `theme.json`：原生导航栏 / tabBar 深色（跟随系统）
- 组件库暗黑由 `AppProvider` 的 `wd-config-provider` 联动

### 环境变量

| 变量 | 说明 |
| --- | --- |
| `VITE_APP_BASE_URL` | 接口地址（「运行」加载 `.env.development`，「发行」加载 `.env.production`） |
| `VITE_APP_TITLE` | 应用标题 |
| `VITE_REPORT_URL` | 日志上报地址，留空只打印 |

代码中 `import.meta.env.VITE_XXX` 访问。

### H5 跨域联调（vite 反向代理）

根目录 `vite.config.js` 已配好 `/api` → 测试域名的代理（仅 H5「运行」时生效，小程序无跨域概念不受影响）。
H5 联调时把 `.env.development` 的 `VITE_APP_BASE_URL` 改为 `'/api'` 即可；
后端接口本身带 `/api` 前缀的话，把 `vite.config.js` 里那行 `rewrite` 删掉。

## 常见问题

- easycom 规则（`pages.json`）修改后需重启 HBuilderX 运行
- scss 报找不到 `@wot-ui/ui` 包路径：先执行 `npm install`（已改为相对路径直引，一般不再需要手动改）
- 工程化命令（可选，不影响编译运行）：`npm run lint` / `npm run format` / `npm run typecheck`
