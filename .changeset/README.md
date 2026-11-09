# 发布流程（Changesets + GitHub Actions）

本仓库只有一个要发布的包：`@10coding/i18n-trans`（`packages/i18n-trans`）。
发布走**极简流程**：不生成 `changeset-release/*` 分支、不创建 Version Packages PR、没有独立 CI；
只有 **PR 合并到 `master`** 时，由 [`.github/workflows/release.yml`](../.github/workflows/release.yml)
判断版本号并发布。

## 1. 本地准备版本

```bash
# 1) 记录本次变更（patch / minor / major）
pnpm changeset

# 2) 应用版本号 + 生成 CHANGELOG，并删除 changeset 文件
pnpm changeset version

# 3) 提交版本变化（PR 里必须包含这一步的结果）
git add .
git commit -m "chore: release x.y.z"
```

然后把分支 push，开 PR 到 `master`。

> `release.yml` 比较的是 `packages/i18n-trans/package.json` 的版本和 npm latest。
> PR 里没有版本变化时，合并后 workflow 会直接跳过发布（成功退出）。

## 2. 合并 PR 后自动发布

PR 合并到 `master` 后，workflow 依次执行：

1. checkout `master`；
2. 校验 npm 版本（Trusted Publishing 需要 npm >= 11.5.1）；
3. 读取本地版本，与 `npm view @10coding/i18n-trans version` 比较：
   - 相同：跳过，不发布；
   - 本地更高：继续；
   - 本地更低：失败（防止版本回退）；
4. 跑 `pnpm --filter @10coding/i18n-trans test` 和 build（仅版本有更新时）；
5. `npm publish --access public`（OIDC Trusted Publishing，无 `NPM_TOKEN`，仅版本有更新时）；
6. 幂等 ensure `vX.Y.Z` git tag 和 GitHub Release 存在（无论是否发生本次发布）。

## 3. 一次性配置

### 3.1 先手动发布首版

Trusted Publishing 不能创建 npm 上还不存在的包。首次需要手动发一次：

```bash
cd packages/i18n-trans
pnpm build
npm login
npm publish --access public
```

发布成功后，再到 npm 包的 Settings → Trusted publishing 配置。

### 3.2 Trusted Publisher

| 字段 | 值 |
| --- | --- |
| Organization or user | `ALiuYiLin` |
| Repository | `i18n-llm-trans` |
| Workflow filename | `release.yml` |
| Environment name | 留空 |
| Allowed actions | 勾选 `npm publish` |

工作流文件名必须与 npm 上配置完全一致；如果用了别的名字，需删除旧配置后用新文件名重建。

### 3.3 分支保护

- `master` 建议只允许通过 PR 合并；
- 不需要配置 required status checks（本仓库没有 CI workflow）。

## 4. 注意

- 只在 PR 合并时触发；feature 分支 push / PR（未合并）不会触发任何 workflow；
- 如果 PR 来自 fork 且 `pull_request` 事件的 OIDC 受限，把 `release.yml` 的触发条件改成
  `push: branches: [master]` 即可；只有合并会进入 `master`，行为等价；
- 没有 `changeset-release/master` 分支，也没有 Version Packages PR；
- 发布失败可直接重跑 workflow；tag / GitHub Release 是幂等的 ensure 步骤，
  即使 npm 已经发布成功、tag/release 失败，重跑也会补齐。
