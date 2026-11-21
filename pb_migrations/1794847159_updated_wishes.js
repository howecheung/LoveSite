/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_3927760422")

  // add field
  collection.fields.addAt(4, new Field({
    "hidden": false,
    "id": "autodate9cr",
    "name": "created",
    "onCreate": true,
    "onUpdate": false,
    "presentable": false,
    "system": false,
    "type": "autodate"
  }))

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_3927760422")

  // remove field
  collection.fields.removeById("autodate9cr")

  return app.save(collection)
})
