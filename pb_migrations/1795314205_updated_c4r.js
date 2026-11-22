/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_3218560509")

  // update collection data
  unmarshal({
    "indexes": [
      "CREATE UNIQUE INDEX `c4r_game_uniq` ON `c4r` (`game`)"
    ]
  }, collection)

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_3218560509")

  // update collection data
  unmarshal({
    "indexes": []
  }, collection)

  return app.save(collection)
})
