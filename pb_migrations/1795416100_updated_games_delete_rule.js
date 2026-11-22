/// <reference path="../pb_data/types.d.ts" />
// 三款游戏的“建房竞态收敛”需要删掉自己多建的局，原 deleteRule=null 会让删除直接 403
migrate((app) => {
  const rule = "@request.auth.id != '' && (black = @request.auth.id || white = @request.auth.id)"
  for (const name of ["gmk", "c4", "fly"]) {
    const collection = app.findCollectionByNameOrId(name)
    collection.deleteRule = rule
    app.save(collection)
  }
}, (app) => {
  for (const name of ["gmk", "c4", "fly"]) {
    const collection = app.findCollectionByNameOrId(name)
    collection.deleteRule = null
    app.save(collection)
  }
})
