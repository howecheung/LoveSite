/// <reference path="../pb_data/types.d.ts" />
// doneDate 原来是 autodate：客户端传值会被忽略、且每次 update 都会刷新（取消勾选也会改日期）。
// 改成 text，由前端写 YYYY-MM-DD，语义才是“哪天完成的”。
// 注意：类型变更会清空该字段已有值（本项目此前没真正写入过，无损失）。
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_3927760422")
  const old = collection.fields.getByName("doneDate")
  if (old) collection.fields.removeById(old.id)
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
  return app.save(collection)
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
