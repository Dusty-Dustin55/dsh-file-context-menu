# 项目约定

- 这是一个 DSH 客户端插件（没有构建步骤，`client.js` 直接由 ModuleLoader 加载）。
- 修改 `client.js` 后需要刷新 DSH 页面才能看到效果；Host 侧改动需要重启应用。
- 安装方式：`dsh plugin --profile desktop add link:C:/Users/12890/dsh-plugins/file-actions`。
- 提交前检查：`node -e "JSON.parse(require('fs').readFileSync('package.json','utf8'))"` 与
  `node --check index.js`、`node --check client.js`。
- 不要写入 `~/.dsh/profiles/desktop/package.json` 或 `cordis.patch.yml`；安装/卸载走 `dsh plugin`。
