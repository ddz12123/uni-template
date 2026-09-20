# uni-enterprise-template

HBuilderX 原生工程的 uni-app 空白模板（Vue3 + TS + Pinia + Wot UI v2 + SCSS）。
基础设施已就位，页面为空白，HBuilderX 直接「运行 / 发行」，不走 CLI 编译。

## 快速开始

1. HBuilderX 打开项目根目录。
2. 首次运行按 HBuilderX 提示启用 SCSS/Sass 编译支持。
3. 微信小程序在 `manifest.json` 填写 `mp-weixin.appid`。
4. 根据目标平台填写开发/生产环境的接口地址，并完成平台发布配置。

本项目以 HBuilderX 为运行和发行入口，不提供 CLI dev/build 流程。仓库中的 npm 命令仅用于可选的代码检查，不影响 HBuilderX 运行。

## 目录结构

```
components/AppProvider.vue   页面根容器：组件库暗黑模式 + 页面主题变量联动
config/index.ts              全局常量（应用名/版本号取自 manifest、成功码、超时、刷新接口、登录页）
pages/                       首页 / 我的（tabbar）+ login（401 登出回跳目标，redirect 回原页）
store/                       pinia + persistedstate；modules: user（响应式登录态）/ app（主题）
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

### 登录页与登录态

模板不包含登录接口和假登录逻辑。`pages/login/login.vue` 只保留页面占位和跳转说明。
请求层检测到登录失效时，会跳转到登录页并携带 `redirect` 参数；接入真实登录后，在登录页完成以下流程：

1. 调用登录接口。
2. 调用 `useUserStore().setToken(token, refreshToken)` 保存令牌。
3. 将用户信息写入 `userInfo`。
4. 使用 `uni.reLaunch({ url: redirect || '/pages/index/index' })` 回到原页面。

令牌只由 `utils/auth.ts` 持久化，Pinia 中的 `token` / `refreshToken` 只是响应式镜像；Pinia 只持久化 `userInfo`，避免出现两套登录态。

### 全局分享（utils/share.ts）

`main.ts` 里 `app.mixin(shareMixin)` 一次接入，所有页面默认可发送给朋友 / 分享到朋友圈，
无需逐页处理。分享菜单在 mixin 的 `onShow` 里逐页开启（微信侧 `menus` 是页面级开关，
放到 `App.onLaunch` 只调一次时页面栈为空，朋友圈入口不会出现）。某页要定制，用 options 写法覆盖即可：

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
- `styles/tokens.scss`：运行时变量（`--app-*`），暗黑经媒体查询 + `.app-theme-dark` 覆盖层
- `theme.json`：原生导航栏 / tabBar 深浅色，`pages.json` 里用 `@变量名` 引用；
  **`darkmode` 与 `themeLocation` 配在 `manifest.json -> mp-weixin` 下**（官方 DarkMode 指南要求写在
  manifest 的平台节点；写在 `pages.json` 时 `darkmode` 不会进编译产物 `app.json`，缺它微信就不做变量替换，
  `@navBgColor` 会被当成非法颜色值）。改完重新编译，以 `unpackage/dist/.../app.json` 里能看到
  `"darkmode": true` 为准
- 组件库暗黑由 `AppProvider` 的 `wd-config-provider` 联动；调用 `useAppStore().setTheme()` 时会同步原生导航栏和 tabBar

### 小程序启动优化

- `manifest.json -> mp-weixin -> lazyCodeLoading: "requiredComponents"`：开启按需注入（官方 manifest
  文档明确支持该字段，目前仅此取值），只注入当前页面用到的代码，降低启动耗时与内存。
  注意微信侧说明全局 `usingComponents` 声明的组件会被强制拉进依赖池，本模板 `pages.json` 里的
  `^wd-` easycom 全局规则会削弱收益；是否真有提升要自己对比开关前后的真机启动耗时，
  配置不当还可能被审核提示「启动组件按需注入未通过」
- tabBar 用原生配置（`pages.json -> tabBar`），启动时无需等 JS 初始化即可渲染

### 应用名称

应用名称唯一维护在 `manifest.json` 的 `name` 字段。分享标题和运行时代码从 `config/index.ts` 的 `APP_NAME` 读取；不要再新增 `VITE_APP_TITLE`。

### 环境变量

| 变量                | 说明                                                                        |
| ------------------- | --------------------------------------------------------------------------- |
| `VITE_APP_BASE_URL` | 接口地址（「运行」加载 `.env.development`，「发行」加载 `.env.production`） |
| `VITE_REPORT_URL`   | 日志上报地址，留空只打印                                                    |

代码中 `import.meta.env.VITE_XXX` 访问。
本地环境文件不要提交到 Git，复制 `.env.example` 后按 HBuilderX 的运行/发行环境命名并填写。

## 常见问题

- easycom 规则（`pages.json`）修改后需重启 HBuilderX 运行
- 页面使用 Wot UI 反馈类 hooks 时，需要在当前页面显式挂载对应的 `wd-toast` / `wd-dialog` 实例
- 工程化命令（可选，不影响 HBuilderX 运行；ESLint 管代码质量，Prettier 管格式，两者已解耦不会互相覆盖）：
  - `npm run lint` 质量检查，`npm run lint:fix` 自动修
  - `npm run format` Prettier 排版，`npm run format:check` 只校验不改动（可用于 CI）
  - `npm run typecheck` TS 类型检查（vue / pinia 等 HBuilderX 内置依赖不装 npm 包，
    由 `types/builtin-modules.d.ts` 声明放行，故 store 成员的推导精度有限）

## 新页面约定

新页面保持统一的根结构，确保主题变量和 Wot UI 暗黑模式生效：

```vue
<script setup lang="ts">
import AppProvider from '@/components/AppProvider.vue'
</script>

<template>
  <AppProvider>
    <view class="page" />
  </AppProvider>
</template>
```

页面私有样式写在页面自身；全局只保留页面基础样式和 `.app-safe-bottom`，避免新增无前缀的 `.card`、`.title` 等通用类名。

## 新项目初始化清单

- 修改 `manifest.json.name`，它是应用名称唯一来源。
- 填写微信小程序 `mp-weixin.appid`，并检查目标平台的包名、签名和隐私协议配置。
- `manifest.json -> mp-weixin` 下的 `darkmode` / `themeLocation` / `lazyCodeLoading` 保持现状（已在位），改 `theme.json` 变量名时同步 `pages.json` 的 `@引用`。
- 按环境填写接口地址。
- 接入真实登录后，删除登录页占位文案并实现 `redirect` 回跳。
- 确认是否启用全局分享、错误上报和小程序版本更新；不需要时移除对应初始化调用。

## 发布前检查

- H5、微信小程序和 App 均能正常启动。
- 浅色、深色和手动主题下，页面、Wot UI、导航栏、TabBar 颜色一致。
- 登录失效能跳转登录页，登录成功能回到 `redirect` 指向的页面。
- 生产环境开启平台域名校验，并核对接口域名和隐私配置。
- 不提交 `.env`、`.env.development`、`.env.production` 等本地环境文件。
