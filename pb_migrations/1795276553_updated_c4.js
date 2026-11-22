/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_140417895")

  // update collection data
  unmarshal({
    "deleteRule": null,
    "listRule": "@request.auth.id != \"\""
  }, collection)

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_140417895")

  // update collection data
  unmarshal({
    "deleteRule": "@request.auth.id = black",
    "listRule": null
  }, collection)

  return app.save(collection)
})
