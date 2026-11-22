/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_3635776793")

  // update collection data
  unmarshal({
    "indexes": [
      "CREATE UNIQUE INDEX `gmkr_game_uniq` ON `gmkr` (`game`)"
    ]
  }, collection)

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_3635776793")

  // update collection data
  unmarshal({
    "indexes": []
  }, collection)

  return app.save(collection)
})
