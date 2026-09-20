/** 全局配置常量 */

import manifest from '@/manifest.json'

const manifestMeta = manifest as { name?: string; versionName?: string }

/** 应用名称唯一来源：manifest.json 的 name */
export const APP_NAME = manifestMeta.name ?? 'uni-app'

/** 后端统一响应成功码（按你们的接口约定修改） */
export const SUCCESS_CODE = 0

/** 未授权状态码（HTTP 或业务 code 均按此处理） */
export const UNAUTHORIZED_CODE = 401

/**
 * 当前应用版本号：直接取 manifest.json 的 versionName，单数据源，
 * 避免与 config 硬编码两处维护漂移。
 */
export const APP_VERSION: string = manifestMeta.versionName ?? '1.0.0'

/** 请求超时时间（ms） */
export const REQUEST_TIMEOUT = 15000

/** 刷新 token 接口（按你们的接口约定修改） */
export const REFRESH_TOKEN_URL = '/auth/refresh-token'

/** 登录页路径（forceLogout 跳转目标） */
export const LOGIN_PATH = '/pages/login/login'
