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

# 2. 启动 PocketBase（把 dist 放到 pb_public 目录）
cp -r dist ../pb_public
./pocketbase serve :8094                  # pb_hooks/、pb_migrations/ 同目录放置
```

首次打开 `http://<主机>:8094/_/` 建超管账号，注册两个成员账号即可使用。
数据表通过 `scripts/schema/` 中的脚本或管理面板创建（members/diaries/albums/moments/wishes/messages/checkins/gmk 等）。

## 目录结构

```
app/            前端（src/App.tsx 主壳 · Gomoku.tsx 五子棋 · core.ts · 主题 CSS）
pb_hooks/       PocketBase 服务端钩子
pb_migrations/  PocketBase 迁移
scripts/schema/ 集合字段迁移脚本（可重放）
tests/          双浏览器 E2E（CDP）：房号加入、悔棋、终局特效回归
```

## 第三方许可

animal-island-ui、Motion、Phosphor Icons、PocketBase 均为 MIT；字体为 SIL OFL；PWA 图标构图元素来自 Microsoft Fluent Emoji（MIT）。本仓库代码以 MIT 授权发布。
