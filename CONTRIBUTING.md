# 贡献指南

感谢参与智芽。所有贡献都必须遵守 [PolyForm Noncommercial License 1.0.0](LICENSE)，仅用于该许可证允许的非商业目的。提交贡献即表示你有权提供相关内容，并同意它按仓库许可证分发。

## 开始之前

- 先搜索现有 Issue 和 Pull Request，避免重复工作。
- 对较大功能、数据模型或安全边界变更，先在 Issue 中说明目标与范围；不得公开安全漏洞或密钥。
- 不要提交真实儿童数据、真实凭据、生成产物、个人 `.env` 或签名材料。
- 保持变更聚焦，并同步更新受影响的测试与文档。

## 本地验证

建议使用 Node.js 24、Python 3.12 与系统 FFmpeg。安装锁定依赖并运行完整基线：

```powershell
npm ci
npm run test:all
npm run build
```

涉及仓库政策或 GitHub 配置时，还应运行：

```powershell
npm run test:repository-policy
```

## Pull Request 流程

协作者也必须通过功能分支和 Pull Request 合并，不要直接推送到 `main`。Pull Request 应说明动机、实现、验证结果、界面变化和已知风险，并保持 CI 检查 `ci / test-and-build` 通过。评审意见解决后再请求复审；未经授权不要改写共享分支历史或强制推送。

维护者可以要求拆分超出范围的改动、补充测试，或拒绝与儿童安全、隐私和非商业许可冲突的贡献。
