import type { uiEn } from './ui.en'

export const uiZh = {
  'ui.error.generic': '出了点问题，请重试。',
  'ui.error.unreachable': '无法连接 Elevate API，请确认它是否正在运行。',

  'ui.close': '关闭',
  'ui.dismiss': '关闭通知',

  'ui.upload.video': '上传视频',
  'ui.upload.audio': '上传音频',
  'ui.upload.image': '上传图片',
  'ui.upload.document': '上传文件',
  'ui.upload.preparing': '正在准备上传…',
  'ui.upload.uploading': '正在上传 {percent}%',
  'ui.upload.toVideoPipeline': '正在上传到视频处理服务…',
  'ui.upload.processing': '处理中…',
  'ui.upload.processing.hint': '转码通常需要一两分钟。',
  'ui.upload.failed': '上传失败',
  'ui.upload.processingFailed': '处理失败',
  'ui.upload.retry': '点击重试',
  'ui.upload.replace': '替换',
  'ui.upload.ready': '已就绪',
  'ui.upload.minutes': '{count} 分钟',
  'ui.mediaStatus.pending': '等待中',
  'ui.mediaStatus.processing': '处理中',
  'ui.mediaStatus.ready': '已就绪',
  'ui.mediaStatus.errored': '出错',

  'ui.media.openDocument': '打开文件',
} satisfies Record<keyof typeof uiEn, string>
