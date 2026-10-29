# 便携运行时与第三方许可

完整 Windows 演示包会随附以下运行时。它们不是智芽项目 PolyForm Noncommercial
许可的一部分，继续适用各自的许可证。

## Node.js 24

- 随包文件：`runtime/node/node.exe`
- 分发版本：以复制时 `node.exe --version` 的检测结果为准
- 项目中的 npm CLI 来自同一 Node.js 安装
- 官方许可：<https://github.com/nodejs/node/blob/main/LICENSE>
- 若安装目录没有根级 Node.js 许可证，打包器会复制 npm 的许可证并生成
  `NODE-LICENSE-NOTICE.txt`，不会伪造或改写第三方条款

## Python 3.12

- 随包文件：`runtime/python/python.exe` 和 Python 标准库
- 不复制用户 site-packages、pip 缓存、`__pycache__` 或 `.pyc` 文件
- Python 安装中的 `LICENSE.txt` 会复制到运行时根目录

## FFmpeg / FFprobe 9

- 随包文件：`runtime/ffmpeg/ffmpeg.exe`、`runtime/ffmpeg/ffprobe.exe`
- 当前来源为 Gyan.dev 的 FFmpeg 9 full build
- 构建来源和第三方 `LICENSE` 文件会与二进制一起保留
- 官方许可说明：<https://ffmpeg.org/legal.html>

打包流程会在生成 ZIP 前执行 Node、npm、Python、FFmpeg 和 FFprobe 的版本自检。
任何运行时缺失或命令失败都会阻止生成交付包。
