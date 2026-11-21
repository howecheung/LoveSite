/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_3083645948")

  // update collection data
  unmarshal({
    "updateRule": "black = \"\" || white = \"\" || @request.auth.id = black || @request.auth.id = white"
  }, collection)

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_3083645948")

  // update collection data
  unmarshal({
    "updateRule": "winner = \"\" && (@request.auth.id = black || @request.auth.id = white || black = \"\" || white = \"\")"
  }, collection)

  return app.save(collection)
})
