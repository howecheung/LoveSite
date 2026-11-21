/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_3702085596")

  // add field
  collection.fields.addAt(4, new Field({
    "help": "",
    "hidden": false,
    "id": "select1002749145",
    "maxSelect": 1,
    "name": "kind",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "select",
    "values": [
      "good",
      "bad"
    ]
  }))

  // add field
  collection.fields.addAt(5, new Field({
    "help": "",
    "hidden": false,
    "id": "select221331120",
    "maxSelect": 1,
    "name": "per",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "select",
    "values": [
      "day",
      "week"
    ]
  }))

  // add field
  collection.fields.addAt(6, new Field({
    "help": "",
    "hidden": false,
    "id": "number2140596320",
    "max": null,
    "min": null,
    "name": "limit",
    "onlyInt": false,
    "presentable": false,
    "required": false,
    "system": false,
    "type": "number"
  }))

  // add field
  collection.fields.addAt(7, new Field({
    "help": "",
    "hidden": false,
    "id": "number1322349139",
    "max": null,
    "min": null,
    "name": "reward",
    "onlyInt": false,
    "presentable": false,
    "required": false,
    "system": false,
    "type": "number"
  }))

  // add field
  collection.fields.addAt(8, new Field({
    "autogeneratePattern": "",
    "help": "",
    "hidden": false,
    "id": "text3727396320",
    "max": 10,
    "min": 0,
    "name": "startD",
    "pattern": "",
    "presentable": false,
    "primaryKey": false,
    "required": false,
    "system": false,
    "type": "text"
  }))

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_3702085596")

  // remove field
  collection.fields.removeById("select1002749145")

  // remove field
  collection.fields.removeById("select221331120")

  // remove field
  collection.fields.removeById("number2140596320")

  // remove field
  collection.fields.removeById("number1322349139")

  // remove field
  collection.fields.removeById("text3727396320")

  return app.save(collection)
})
