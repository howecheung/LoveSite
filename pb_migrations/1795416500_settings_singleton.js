/// <reference path="../pb_data/types.d.ts" />
// settings 是单例，但历史版本在并发首存/读取失败时可能创建多条。
// 这里把多条合并成一条：优先保留有 startDate / siteName 的那条，字段取各条中第一个非空值。
migrate((app) => {
  const rows = app.findRecordsByFilter("settings", "", "id", 0, 0)
  if (rows.length <= 1) return

  const fields = [
    "names", "startDate", "quote", "siteName", "boyName", "girlName",
    "story", "tiles", "eatOpts", "doOpts",
  ]
  const isEmpty = (v) => v === "" || v === null || v === undefined ||
    (Array.isArray(v) && v.length === 0) ||
    (typeof v === "object" && v !== null && !Array.isArray(v) && Object.keys(v).length === 0)

  const keeper = rows.find((r) => String(r.get("startDate") || "") !== "") ||
    rows.find((r) => String(r.get("siteName") || "") !== "") ||
    rows[0]

  for (const f of fields) {
    for (const r of rows) {
      const v = r.get(f)
      if (!isEmpty(v)) { keeper.set(f, v); break }
    }
  }

  // 锁是 hash + salt 一对，必须从同一条记录取，避免拼出无法验证的组合
  const lockRow = rows.find((r) => String(r.get("lockHash") || "") !== "")
  if (lockRow) {
    keeper.set("lockHash", lockRow.get("lockHash") || "")
    keeper.set("lockSalt", lockRow.get("lockSalt") || "")
  }
  if (rows.some((r) => r.get("lockOn") === true)) keeper.set("lockOn", true)

  app.save(keeper)
  for (const r of rows) {
    if (r.id !== keeper.id) app.delete(r)
  }
}, (app) => {
  // 合并会删除重复记录，无法可靠还原；保留空回滚
})
