# 更新日志

本文件记录本项目自身的版本变化。PocketBase 官方的更新日志已存档在 [`docs/POCKETBASE_CHANGELOG.md`](docs/POCKETBASE_CHANGELOG.md)。

## v57.1

- 修复 `wishes.doneDate` 迁移会清空历史完成日期：PocketBase 改字段类型是先 `DROP COLUMN` 再 `ADD COLUMN`，
  迁移现在会先按服务器本地时区把存量 `autodate` 值格式化成 `YYYY-MM-DD` 暂存，新字段建好后再逐条回写。
  **已经执行过旧迁移的环境**（数据库里 `doneDate` 已是 `text` 且值为空）需要从 `pb_data` 备份恢复，改迁移文件不会重跑。

## v57

- 新增三款双人小游戏：五子棋、糖果四子棋、情侣飞行棋（4 位房号跨设备联机 + 同屏模式）
- 新增首页功能卡片自定义：排序、改名、换图标、删减、添加外链
- 新增备份页：本地打包备份 + WebDAV 异地备份（依赖自建 `pb_hooks/`）
- 新增相册多选直传，本地解析 EXIF 拍摄时间与 GPS
- 新增双主题配色与 PWA 离线壳
- 修复相册追加照片会覆盖旧照片、打卡与恋爱天数在 UTC+8 凌晨差一天的问题
- 安全：私密口令改为随机盐 + PBKDF2 存储
