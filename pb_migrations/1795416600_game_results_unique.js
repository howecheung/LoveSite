/// <reference path="../pb_data/types.d.ts" />
// 对局结算由两端同时写 gmkr/c4r/flyr，先查再建不是原子操作。
// 空库只跑 migrations 时缺少 game 唯一索引，会写出重复战绩；这里补索引并先清掉历史重复。
migrate((app) => {
  for (const name of ["gmkr", "c4r", "flyr"]) {
    const col = app.findCollectionByNameOrId(name)
    const rows = app.findRecordsByFilter(name, "game != ''", "created", 0, 0)
    const seen = {}
    for (const r of rows) {
      const game = String(r.get("game") || "")
      if (seen[game]) app.delete(r)
      else seen[game] = true
    }
    const indexes = (Array.isArray(col.indexes) ? col.indexes : []).slice()
    const idxName = name + "_game_uniq"
    if (!indexes.some((i) => i.indexOf(idxName) >= 0)) {
      indexes.push("CREATE UNIQUE INDEX `" + idxName + "` ON `" + name + "` (`game`) WHERE `game` != ''")
    }
    unmarshal({ "indexes": indexes }, col)
    app.save(col)
  }
}, (app) => {
  for (const name of ["gmkr", "c4r", "flyr"]) {
    const col = app.findCollectionByNameOrId(name)
    const indexes = (Array.isArray(col.indexes) ? col.indexes : []).filter((i) => i.indexOf(name + "_game_uniq") < 0)
    unmarshal({ "indexes": indexes }, col)
    app.save(col)
  }
})
