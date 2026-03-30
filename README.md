# 配置管理网站

一个用于管理 `codex` 和 `openclaw` 配置的私有后台，支持：

- 单管理员登录
- 配置新增、编辑、删除、启用
- 启用时写回真实配置文件
- 自动创建备份
- 备份列表和还原
- `openclaw` 配置更新或还原后自动执行 `openclaw gateway restart`

## 技术栈

- `Next.js`
- `TypeScript`
- `better-sqlite3`
- 自定义 Session Cookie

## 本地开发

当前项目默认直接使用仓库内的脱敏示例文件：

- `sample.config.toml`
- `sample.auth.json`
- `sample.openclaw.json`

运行步骤：

```bash
npm install
npm run hash-password -- your-password
```

把生成的哈希写入 `.env.local`：

```env
ADMIN_USERNAME=admin
ADMIN_PASSWORD_HASH=scrypt$...
SESSION_SECRET=replace-with-a-long-random-string
```

然后启动：

```bash
npm run dev
```

## 生产部署

服务器部署时，建议至少配置以下环境变量：

```env
ADMIN_USERNAME=admin
ADMIN_PASSWORD_HASH=scrypt$...
SESSION_SECRET=replace-with-a-long-random-string
CODEX_CONFIG_DIR=/home/your-user/.codex
OPENCLAW_CONFIG_DIR=/home/your-user/.openclaw
OPENCLAW_PROVIDER_KEY=custom-goood-my
OPENCLAW_RESTART_COMMAND=openclaw gateway restart
```

说明：

- `CODEX_CONFIG_DIR` 指向真实的 `~/.codex`
- `OPENCLAW_CONFIG_DIR` 指向真实的 `~/.openclaw`
- 服务进程必须对上述目录有读写权限
- 服务进程必须能执行 `openclaw gateway restart`

## 一键安装

当前仓库已经内置 Linux 安装脚本，面向 `Debian/Ubuntu + systemd`。

默认安装行为：

- 安装到 `/opt/config-manager-web`
- 自动安装 Node.js 20、`git`、`build-essential`
- 自动执行 `npm ci` 和 `npm run build`
- 自动写入 systemd 服务
- 自动执行 `systemctl enable --now config-manager-web`

最简安装命令：

```bash
curl -fsSL https://raw.githubusercontent.com/xiedonge/openaiconfig/main/install.sh | sudo bash
```

推荐安装命令：

```bash
curl -fsSL https://raw.githubusercontent.com/xiedonge/openaiconfig/main/install.sh | \
sudo ADMIN_USERNAME=admin \
ADMIN_PASSWORD='change-this-password' \
SESSION_SECRET='replace-with-a-long-random-string' \
bash
```

常用可覆盖变量：

```bash
CONFIG_MANAGER_USER=your-linux-user
INSTALL_DIR=/opt/config-manager-web
APP_PORT=3000
CODEX_CONFIG_DIR=/home/your-linux-user/.codex
OPENCLAW_CONFIG_DIR=/home/your-linux-user/.openclaw
OPENCLAW_PROVIDER_KEY=custom-goood-my
OPENCLAW_RESTART_COMMAND='openclaw gateway restart'
```

安装完成后：

- 服务名：`config-manager-web`
- 查看状态：`systemctl status config-manager-web`
- 开机自启：已默认开启
- 查看日志：`journalctl -u config-manager-web -f`

如果不传 `ADMIN_PASSWORD` 或 `ADMIN_PASSWORD_HASH`，安装脚本会自动生成一个临时管理员密码，并在安装输出中打印一次。

## 主要路由

- `/login`
- `/configs`
- `/backups`

## 可用脚本

```bash
npm run dev
npm run build
npm run start
npm run typecheck
npm run hash-password -- your-password
```

## 验证情况

已完成：

- `npm run typecheck`
- `npm run build`

## 注意事项

- 仓库中的 `sample.*` 文件是脱敏样例，不会包含真实 URL 或密钥。
- 生产环境一定要通过 `CODEX_CONFIG_DIR` 和 `OPENCLAW_CONFIG_DIR` 指向真实运行目录。
- 编辑已启用配置后，系统会把该记录自动置为未启用，并提示需要重新启用，以避免数据库状态与真实文件状态不一致。
