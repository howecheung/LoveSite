# LoveSite 情侣小站

一套自托管的双人情侣站点：在一起的日子、恋爱日记、相册、纪念日、清单、留言板、小游戏（联机五子棋）……数据完全在你自己的服务器上。

> 视觉语言借鉴《动物森友会》的软萌质感，**未使用任何任天堂素材**——界面为纯代码自绘，依赖全部为开源许可（见文末）。

## 功能一览

| 模块 | 说明 |
|---|---|
| 天数卡 | 在一起第 N 天 · 秒级计时 · 签名句 |
| 恋爱日记 | 双人发帖、心情标签、私密标记、点赞评论 |
| 时光相册 | 相册 + 照片流 + 灯箱浏览 + 手机直传（EXIF 拍摄地） |
| 纪念日 / 倒计时 | 公历农历、每年重复、临近提醒 |
| 爱情清单 | 想一起做的事，完成打勾 |
| 留言板 | 每日祝福流 |
| 小游戏 · 五子棋 | **跨设备实时联机**：4 位房号建房/加入、带色棋谱、悔棋只退发起方一颗、断线续战、终局特效、同屏离线模式、胜率战绩 |
| 小游戏 · 糖果四子棋 | 7×6 重力落子、四连即胜，联机底座同上（房号/悔棋/续战/特效/战绩） |
| 小游戏 · 情侣飞行棋 | S 型 24 格 + 40 条内置情侣任务卡 + 奖励/陷阱格；联机 + 同屏双模式 |
| 首页功能卡片 | 「更多 → 功能卡片」自定义首页宫格：排序、改名改图标、删减、添加自定义链接，双端实时同步 |
| 双主题配色 | 玫瑰奶油 / 森绿 × 浅色 / 深色（token 体系，localStorage 记忆） |
| PWA | 添加到主屏幕，全屏无浏览器框 |

## 技术栈（全开源链路）

- 前端：React 19 + Vite + TypeScript + [animal-island-ui](https://github.com/guokaigdg/animal-island-ui) (MIT) + [Motion](https://motion.dev) (MIT) + [Phosphor Icons](https://phosphoricons.com) (MIT)
- 后端：[PocketBase](https://pocketbase.io) 单文件（账号、数据、文件、实时订阅、管理面板）
- 字体：Nunito + Noto Sans SC（SIL OFL）

## 快速开始

```bash
# 1. 构建前端
cd app && npm install && npm run build   # 产物在 app/dist

# 2. 启动 PocketBase（pb_hooks/ 与 pb_migrations/ 都要和可执行文件同级）
#    Windows:     mkdir ..\pb_public; Copy-Item -Recurse dist\* ..\pb_public\
#    macOS/Linux: mkdir -p ../pb_public && cp -r dist/* ../pb_public/
./pocketbase serve :8094
```

首次打开 `http://<主机>:8094/_/` 建超管账号，再在管理面板的 `members` 集合里**手动添加两个成员账号**（该集合已禁用自助注册）。默认两个账号是 `zwh` / `123`（男孩）和 `mm` / `123`（女孩）——仅供本地试跑，正式部署请务必改掉。PocketBase 的密码字段允许 1 位以上，但短密码只适合内网自用。
数据表由 `pb_migrations/` 自动创建（`members/diaries/albums/moments/wishes/messages/checkins/gmk/c4/fly/bkcfg` 等）。

> **pb_hooks 必须带上**：`pb_hooks/` 提供 `/api/ai/backup/*`（完整备份 + WebDAV 上传）。
> PocketBase 默认只到**可执行文件同级目录**找 `pb_hooks`，放到别处要加 `--hooksDir 路径`。
> 缺了它备份页会提示「备份接口不可用」，其余功能不受影响。
> WebDAV 口令存在 `bkcfg` 集合里（登录成员可读，页面不回显）。站点仅供两人使用；如需更严，请把 `webdavPass` 挪进 hooks 的私有配置。

### 备份

| 方式 | 内容 | 用法 |
| --- | --- | --- |
| 页面「立即备份」 | 整个 `pb_data`（数据库 + 上传文件）打成 PocketBase 备份 zip | 更多 → 数据备份 → 立即备份；勾了「备份后自动上传」会同时推 WebDAV |
| 计划任务 | 同上，走官方 `/api/backups` | `PB_ADMIN_EMAIL=... PB_ADMIN_PASS=... DAV_URL=... node scripts/backup-webdav.mjs` |
| 手工 | 直接拷 `pb_data/` 目录 | 停机后复制，最省事 |

> 自动备份没有做进 PocketBase 的 cron：0.40 的 JSVM 里 `createBackup` 必须传 request context，cron 里没有（传 null 会 panic），所以定时任务交给系统计划任务跑上面的脚本更稳。
>
> 备份文件名固定为 `lovesite-backup-YYYYMMDD-HHmmss.zip`（本地时间）；早期生成的 `ai-YYYYMMDD-HHmmss.zip` 仍能被识别和清理。


## 目录结构

```
app/            前端（src/App.tsx 主壳 · pages/modals/shared 拆分 · Gomoku/Connect4/Flying 三款游戏 · Footprint 足迹地图 · core.ts · 主题 CSS）
app/public/     PWA（sw.js / manifest / icons / emoji 字体）
pb_hooks/       PocketBase 自定义接口（备份 + WebDAV 上传），必须与可执行文件同级
pb_migrations/  PocketBase 迁移（集合字段与权限）
scripts/schema/ 集合字段迁移脚本（可重放）
scripts/smoke.mjs 接口自检（见下）
scripts/backup-webdav.mjs 完整备份 + 上传 WebDAV（可挂计划任务）
tests/          双浏览器 E2E（CDP）：房号加入、悔棋、终局特效回归
docs/           PocketBase 官方更新日志存档
```

## 自检

```bash
PB_URL=http://127.0.0.1:8094 SMOKE_USER_1=你的账号 SMOKE_USER_2=对方账号 SMOKE_PASS=你的密码 node scripts/smoke.mjs
```

跑 48 项接口检查：认证、读写权限负例、点赞计数、相册追加、三款游戏建房→落子→判胜→战绩→删局、改密兜底。默认值只是本地开发示例，**自己的环境必须用环境变量覆盖**：

| 变量 | 默认（仅本地示例） |
|---|---|
| `PB_URL` | `http://127.0.0.1:8094` |
| `SMOKE_USER_1` / `SMOKE_USER_2` | `zwh` / `mm` |
| `SMOKE_PASS` | `12345678` |
| `SMOKE_ADMIN_EMAIL` / `SMOKE_ADMIN_PASS` | 空（改密项失败时用超管复原） |

前端类型检查与构建：`cd app && npm run typecheck && npm run build`（tsconfig 已开启 `noUnusedLocals` / `noUnusedParameters`）。

## 第三方许可

animal-island-ui、Motion、Phosphor Icons、PocketBase 均为 MIT；字体为 SIL OFL；PWA 图标构图元素来自 Microsoft Fluent Emoji（MIT）。本仓库代码以 MIT 授权发布。
