/// <reference path="../pb_data/types.d.ts" />
// 相册的 exifs 是一张照片一条（约 80-120 字节），2000 字符只够存十几张，
// 张数一多就 400，照片能传上去但 EXIF 写不进去。放宽到 200000。
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_3287366145")
  const field = collection.fields.getByName("exifs")
  field.max = 200000
  app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_3287366145")
  const field = collection.fields.getByName("exifs")
  field.max = 2000
  app.save(collection)
})
