## v0.40.6

- Replaced the GitHub update command with update from the new host in relation to [#7841](https://github.com/pocketbase/pocketbase/discussions/7841).
    Note that this will be most likely the last release here on GitHub. The next time when you run update, new releases will be fetched from `https://ganigeorgiev.com` _(there is nothing there yet)_.

- Additional fileblob bucket escape checks for just in case if the filesystem abstraction is used as standalone without the PocketBase validations.

- Added a global restriction for the max `WxH` pixels size when generating a thumb to reduce the risk of excessive memory usage.
    The issue was initially privately reported by [@reload3d](https://github.com/reload3d) but it is treated as regular public issue since it is a [known Go caveat](https://github.com/golang/go/issues/27830).
    The default limit is pretty generous and currently set to max `250<<20 (262144000)` pixels and can be changed with the env `PB_THUMBS_MAX_SOURCE_PIXELS`.
    **The workaround is not bulletproof and thumbs generation remains one of the main culprit for potential OOMs in PocketBase**, so better solutions will have to be investigated in the future, including eventually switching to [libvips](https://github.com/libvips/libvips) or other similar library once there is [better CGO portability](https://github.com/golang/go/issues/81450) _(if you have better suggestions, please open a discussion)_.

- Bumped the min Go GitHub action version to 1.27.3 as it includes a [security fix](https://groups.google.com/g/golang-announce/c/66pojueaQek) related to the recent eMudhra CA compromise.
    _I didn't rush a fix 2 days ago as the impact for most PocketBase servers is not that serious and requires to already have a MiTM, but nonetheless it is recommended to update. Please make sure to also check for OS/Docker image updates to make sure that you have the latest `ca-certificates` bundle._

- Bumped `golang.org/x/` dependencies ([#7865](https://github.com/pocketbase/pocketbase/discussions/7865)).

- Bumped goja and its related dependencies _(string allocations optimization, `Date.getYear/setYear` support and other minor correctness fixes)_.

- Minor UI fixes - superuser IPs description grammar fix, rotating btn loader icon alignment fix, slight dark background correction in attempt to minimize the color profile differences between Chrome and Firefox, etc.


## v0.40.5

- Minor improvements for the JSVM migration error handling:
    - Included the recovered panic stack trace of `routine.SafeWrap` in the returned error (max 2KB).
    - Wrap the individual `up`/`down` JSVM migration arguments in `routine.SafeWrap` so that in case of panic we can still print the failed js migration filename.

- Updated `modernc.org/sqlite` to 1.60.1 _(minor performance improvements for queries with large text fields and/or many params)_.

- Bumped the min Go GitHub action version to 1.27.2 as it includes several [`net/http` security fixes](https://github.com/golang/go/issues?q=milestone%3AGo1.27.2).
    _One of the fixes is for a DoS that could potentially affect PocketBase applications and it is advised to update._

- Other minor fixes _(godoc typos, normalized negative jsvm pool size, extra CORS wildcard subdomain checks to prevent misuse, support `Promise` as autocomplete suggestions return, autoexpand textarea scrollbar-gutter fix, etc.)_.


## v0.40.4

- Fixed migration deadlock if a logs db write happens to run while the migration is still executing ([#7836](https://github.com/pocketbase/pocketbase/issues/7836)).

- `app.ResetBootstrapState()` was soft-deprecated in favour of `app.ClearBootstrap()`.
    _Additionally a new `app.OnBootstrapClear()` hook was added to allow clearing custom allocated `OnBootstrap` resources in case the app uses a non-standard initialization (e.g. doesn't call `Start()` or intentionally skip the `OnTerminate` hook)._

- Bumped `golang.org/x/*` dependencies.


## v0.40.3

- Write the status header for JSON responses only if the fields picker succeed or has acceptable fallback.
    _This is to allow custom response status code for failed json writes._

- Fixed collection index validator to allow expressions with parenthesis in the optional `WHERE` clause.

- Clamped arccosine to [-1,1] in the Harvesine formula for the `geoDistance()` filter function to workaround edge case related to float rounding errors for some coordinates.

- Prevent unnecessary body chunk read if we already known that we are beyond the allowed limit.

- Updated the `json` field validator to check the `encoding/json/v2` semantics and allow duplicated keys on record marshalize for compliance with old jsonv1 data.

- Fixed nested cascade delete of self-referenced relation records.

- Minor UI fixes (updated dark primary btn color contrast, force reload the records list if the deleted record has self-referenced cascade relation field, etc.).

- Changed JSVM `$app` variable definition from TS type to interface ([#7834](https://github.com/pocketbase/pocketbase/issues/7834)).

- Bumped `golang.org/x/*` dependencies to silence security scanners ([#7829](https://github.com/pocketbase/pocketbase/discussions/7829)).


## v0.40.2

- Return an error when filter params fallback fails to json serialize and optimized params replacement to execute in a single pass.

- Fixed collection index parsing error for indexes with missing name.

- Minor UI autocomplete optimizations _(prefix match, autocomplete debounce, etc.)_.

- Fixed linter warnings and comment typos.

- Bumped goja and its related dependencies _(regex unescaped dash error fix and base64 optimizations)_.

- Bumped the min Go GitHub action version to 1.27.1 as it includes some [minor `database/sql` and `enconding/json/v2` bug fixes](https://github.com/golang/go/issues?q=milestone%3AGo1.27.1).


## v0.40.1

- Fixes for some reported regressions related to the `encoding/json/v2` update:
    - allow mangling invalid UTF8 characters when serializing json data ([#7814](https://github.com/pocketbase/pocketbase/issues/7814))
    - fixed OAuth2 providers config merge incorrectly replacing the entire slice ([#7815](https://github.com/pocketbase/pocketbase/issues/7815))


## v0.40.0

- Propagate console command errors and recovered panics to `app.Start()` so that the program can exit with non-zero code while still ensuring that `app.OnTerminate` hook was triggered _(responsible for the app graceful shutdown handling)_.
    _⚠️ Note that this could be a slight breaking change in case you are chaining PocketBase commands and relied on the previous `0` exit status for `Command.RunE` returned errors._
    _Or in other words, if you have `./pocketbase invalid && someothercommand` and previously relied that `someothercommand` will be always executed then this is no longer the case and you'll have to adjust it or replace `&&` with `;`._

- Added quotes around the default `Content-Disposition` serving filename in case custom name with special characters is provided.

- Added `Cross-Origin-Opener-Policy:same-origin` to the default security response headers.
    _This is an extra precaution to prevent tab-nabbing in case custom UI plugins use `target="_blank"` without `rel="noopener"`._

- Added `Record.GetInt64(field)` helper (note that the serializable max safe integer of the `number` field is ~2^53-1).

- Added `Store.Keys()` method that returns a slice with all of the store keys.

- Added new `DELETE /api/logs` endpoint and UI control to delete all logs without changing the `maxDays` retention setting.

- Added new log settings option to limit the max `Log.Data` size that will be saved in the database (default to ~16KB).
    _This is an extra precaution for the cases when logging user supplied data without validating it beforehand._
    _If the resulting `Log.Data` json is above the limit, it is truncated to the last valid decoded character and an extra `"__pb_truncated__":true` log data entry will be added.`_
    _Additionally, for just in case the log message is also truncated at max 8k characters._

- Added new `filesystem` low-level helper methods:
    - `filesystem.NewWriter(key, opts)` to allow direct file create from an `io.Reader` value.
    - `filesystem.OnNewWriter()` hook to allow listening for new/to-be-created files _(it is not exposed in `core.App` instance for now to avoid introducing breaking changes)_.
    - `filesystem.OnDelete()` hook to allow listening for deleted files _(it is not exposed in `core.App` instance for now to avoid introducing breaking changes)_.

- Optimized backups to no longer transaction lock the database during backup generation ([#7799](https://github.com/pocketbase/pocketbase/discussions/7799#discussioncomment-18108244)).

- Updated `modernc.org/sqlite` to 1.57.0 and registered by default the new `_defensive=1` DSN query parameter to enable [SQLite's defensive mode](https://sqlite.org/c3ref/c_dbconfig_defensive.html#sqlitedbconfigdefensive).

- Bumped the min Go version to 1.27.0 and migrated to the new `encoding/json/v2` package.
    _⚠️ Please note that Go 1.27.0 retrofitted `encoding/json` to use the v2 package under the hood but unfortunately is not fully backward compatible._
    _I recommend to not push blindly an update on production and to test your PocketBase application first locally to see if everything works correctly._
## v57 — 2026-11-20 代码结构整理
- 新增 core.ts（PB 单例/错误胶囊）、Gomoku.tsx（五子棋 5 组件独立成文件）；App.tsx 1440 → 1030 行
- 五子棋：悔棋改为只退发起人一颗（棋谱带色 i:c 格式）；4 位房号建房/输号加入/满员与查无提示
- 修复棋子被网格线穿模（z-index 层级）
- 清理：删除玻璃/材质试验页 4 张与被否脚本、一次性调试脚本 11 个；测试归 tests/、迁移归 scripts/schema/


## v61 — 2026-11-21 动效统一 + 六件套
- 特效语言归一：全站 CSS 缓动统一官方 cubic-bezier(.4,0,.2,1)（--ease），时长收敛三档 --d-fast/.15s --d/.25s --d-slow/.35s；keyframes 全部吃变量，改一处全站同步
- ① 照片灯箱"原地生长"：缩略图↔大图 layoutId 共享（spring 380/32），黑幕淡入淡出包在 AnimatePresence
- ② 天数 CountUp：改用 AIUI 官方 CountUp（easeOutExpo 1.1s，render prop 保留原样式）
- ③ 点赞心爆：小爱心上浮 26px 渐隐 0.55s
- ④ 宫格入场波浪：tilePop 按 --i 45ms 错峰
- ⑤ 按压反馈补全：tile/返回/行 加 :active 缩放（reduced-motion 下全关）
- ⑥ 底栏滑丸：tab 高亮改 layoutId 滑动胶囊（单枚在五个 tab 间滑行）
- headless 回归：CountUp/错峰/滑丸/巡历 0 异常；灯箱生长为真机验收项

## v66 — 2026-11-21 弹窗对齐 + 功能回归
- 全站弹窗输入框对齐修正：AIUI Input 组件 wrapper 自带左右 18px 图标位（本站不用图标），导致相对正文基线内缩；CSS 清零后实测 Input L=64 = textarea/标签/按钮 L=64
- 天数卡改自研行内计数（官方 CountUp 的数字牌壳会撑坏「第 N 天」排版且动画卡 0）
- 关于我们保存防御：iOS 日期控件交空值时自动沿用原起始日，无值则提示不发请求
- 功能回归（API 级）：发日常 ✓ 点赞 ✓ 评论 ✓ 相册创建+图片上传+文件访问 200 ✓ 浏览计数 ✓

## v77–v81 (2026-11-22) 糖果四子棋 + 情侣飞行棋
- 四子棋（Connect4.tsx，c4/c4r 集合）：7×6 重力落子、四连金环、彩带终局特效；完整复用五子棋联机底座（4 位房号/心跳/悔棋提案/和棋/认输/再来一局/换色/战绩胜率）。掉落回弹动画、列满提示。
- 情侣飞行棋（Flying.tsx，fly/flyr 集合）：S 型 24 格，💞 任务格（40 条自写情侣任务）/🎁 奖励格再掷/💤 瞌睡停轮；🐻 vs 🐰；**联机+同屏热座双模式**；纯 CSS 点阵骰子（零字体依赖）。
- 游戏厅新增两行；飞行棋任务与棋谱全部走服务器实时同步。
- 测试：tests/c4_e2e.py（双 profile 浏览器全流程：建房→报号→重力落子→四连→再来→悔棋提案）、tests/fly_e2e.py（同屏 16 回合打完一局+联机双端 bd 一致）。
- 经验：PocketBase SDK 的 authStore 跟随 localStorage——**同浏览器双标签页测双用户会互相串号，必须起第二个 headless Chrome（独立 --user-data-dir）模拟真机双人**；测试残留房会污染 create 融合逻辑，E2E 前必须清表。

## v84 (2026-11-22) 对局记录全面修复
- 病根三连：①recorded 标志永不重置→同页第二局起全漏记 ②双端竞写→同局重复→胜率虚高（历史已清 8 条重复/假数据）③bId/wId 字段名不匹配静默丢失。
- 修复：战绩键改 `房id#轮次`（再来一局 round+1）；gmkr/c4r/flyr 的 game 建 **SQLite 唯一索引**（竞写第二条被数据库拒绝，实测生效）；胜率归属改玩家 id 判定、姓名兜底；同屏(热座)模式终局同样落库；战绩超 100 条自动修剪最旧；对局记录卡默认显示 3 条 +「查看全部 N 局 ▼」折叠。
- 验收：同房连下两局=恰好 2 条战绩（#1白胜/#2黑胜，bId 已入库）；同屏飞行棋打完 flyr 落库；0 异常。

## v85 (2026-11-22) 代码整理 + 文档对齐
- App.tsx 1231→1103 行：功能卡片管理页与宫格定义拆出 Tiles.tsx；游戏组件 Connect4/Flying 已独立成文件。
- 清理：5 个风格试验页（glass4/island/styletest/meow/fluent）删除；重复 LICENSE.md 并入 THIRD_PARTY_LICENSES.md；v83-84 战绩体系迁移脚本归档 scripts/schema/schema10_game_rounds.py。
- emoji.css + public/emoji/ 字体子集确认为主站依赖，保留。
- README 功能表补四子棋/飞行棋/功能卡片；18 页 UI 巡礼 0 JS 异常、核心 API 全 200。
