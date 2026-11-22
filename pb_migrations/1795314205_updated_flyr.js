/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_423620760")

  // update collection data
  unmarshal({
    "indexes": [
      "CREATE UNIQUE INDEX `flyr_game_uniq` ON `flyr` (`game`)"
    ]
  }, collection)

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_423620760")

  // update collection data
  unmarshal({
    "indexes": []
  }, collection)

  return app.save(collection)
})
