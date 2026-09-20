import { reportLog } from './report'

/**
 * 小程序版本更新检查（App 冷启动时调一次即可）。
 * - 有新版本：新包下载就绪后弹窗提示用户重启生效（用户取消则下次冷启动再提示，微信会自动应用）
 * - 下载失败：上报 + 轻提示，不阻塞使用
 * - 非小程序端（H5 等无此概念）直接跳过
 */
export function checkMiniProgramUpdate(): void {
  // #ifdef MP
  try {
    const manager = uni.getUpdateManager()
    if (!manager) {
      return
    }
    manager.onCheckForUpdate?.(() => {
      // 有无更新都无需处理：有则等 onUpdateReady，无则静默
    })
    manager.onUpdateReady?.(() => {
      uni.showModal({
        title: '发现新版本',
        content: '新版本已下载完成，是否立即重启应用？',
        confirmText: '立即重启',
        cancelText: '稍后',
        success: (res) => {
          if (res.confirm) {
            manager.applyUpdate()
          }
        },
      })
    })
    manager.onUpdateFailed?.((err) => {
      reportLog({ type: 'error', message: `UpdateFailed: ${JSON.stringify(err)}` })
      uni.showToast({ title: '新版本下载失败，请稍后重试', icon: 'none' })
    })
  } catch {
    // 低版本基础库可能不支持，忽略
  }
  // #endif
}
