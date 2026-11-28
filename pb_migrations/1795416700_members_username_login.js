/// <reference path="../pb_data/types.d.ts" />
// 空库只跑 migrations 时 passwordAuth.identityFields 只有 email，
// 而前端用 username（zwh/mm）登录。线上库曾用 scripts/schema/schema9_login.py 补过，
// 这里把同一变更纳入正式迁移，保证新部署可复现。
migrate((app) => {
  const collection = app.findCollectionByNameOrId("members")
  const pa = collection.passwordAuth || {}
  const fields = Array.isArray(pa.identityFields) ? pa.identityFields : ["email"]
  if (fields.indexOf("username") >= 0) return
  unmarshal({
    "passwordAuth": {
      "enabled": true,
      "identityFields": fields.concat(["username"]),
    },
  }, collection)
  return app.save(collection)
}, (app) => {
  // 旧库可能本来就包含 username，回滚移除会破坏登录，保持空回滚
})
