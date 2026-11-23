/// <reference path="../pb_data/types.d.ts" />
// doneDate 原来是 autodate：客户端传值会被忽略，且每次 update 都会刷新（取消勾选也会改日期）。
// 改成 text，由前端写 YYYY-MM-DD，语义才是“哪天完成的”。
// 注意：PocketBase 改字段类型会先 DROP COLUMN 再 ADD COLUMN，直接改会清空历史完成日期，
// 所以这里先把存量的 autodate 值读出来（形如 "2026-11-20 00:00:00.000Z"），
// 截成 YYYY-MM-DD 保存在内存里，等新字段加好再逐条回写。
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_3927760422")
  const old = collection.fields.getByName("doneDate")
  const kept = {}
  if (old) {
    const rows = app.findRecordsByFilter("pbc_3927760422", "", "", 0, 0)
    for (const row of rows) {
      const raw = row.get("doneDate")
      const text = raw ? String(raw).slice(0, 10) : ""
      if (text) kept[row.id] = text
    }
    collection.fields.removeById(old.id)
  }
  collection.fields.addAt(collection.fields.length, new Field({
    "autogeneratePattern": "",
    "help": "",
    "hidden": false,
    "id": "text2914782150",
    "max": 0,
    "min": 0,
    "name": "doneDate",
    "pattern": "",
    "presentable": false,
    "primaryKey": false,
    "required": false,
    "system": false,
    "type": "text"
  }))
  app.save(collection)
  for (const id of Object.keys(kept)) {
    try {
      const rec = app.findRecordById("pbc_3927760422", id)
      rec.set("doneDate", kept[id])
      app.save(rec)
    } catch (err) {
      // 单条回写失败不应该让整条迁移失败
      console.warn("doneDate backfill failed for " + id + ": " + err)
    }
  }
  return
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_3927760422")
  collection.fields.removeById("text2914782150")
  collection.fields.addAt(collection.fields.length, new Field({
    "hidden": false,
    "id": "autodate9dd",
    "name": "doneDate",
    "onCreate": false,
    "onUpdate": true,
    "presentable": false,
    "system": false,
    "type": "autodate"
  }))
  return app.save(collection)
})
