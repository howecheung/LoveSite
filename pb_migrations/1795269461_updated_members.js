/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_2620428958")

  // update collection data
  unmarshal({
    "indexes": [
      "CREATE UNIQUE INDEX `idx_tokenKey_pbc_2620428958` ON `members` (`tokenKey`)",
      "CREATE UNIQUE INDEX `idx_email_pbc_2620428958` ON `members` (`email`) WHERE `email` != ''",
      "CREATE UNIQUE INDEX idx_username ON members (username)"
    ]
  }, collection)

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_2620428958")

  // update collection data
  unmarshal({
    "indexes": [
      "CREATE UNIQUE INDEX `idx_tokenKey_pbc_2620428958` ON `members` (`tokenKey`)",
      "CREATE UNIQUE INDEX `idx_email_pbc_2620428958` ON `members` (`email`) WHERE `email` != ''"
    ]
  }, collection)

  return app.save(collection)
})
