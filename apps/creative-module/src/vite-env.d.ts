/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** COCO-SSD 模型自定义加载地址（用于无法访问 Google Storage 的网络环境） */
  readonly VITE_COCO_SSD_MODEL_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
