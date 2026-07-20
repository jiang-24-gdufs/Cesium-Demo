1. 基于这个示例中的两个服务；使用双屏渲染的模式来加载；并添加可展开/收缩的panel来列举layer，并支持图层管理交互
2. 不要直接修改这个源文件，新建一个文件夹来实现需求
3. 除了viewer连动之外，还需要加上这个点击拾取通信联动，一个点击拾取另一个也要基于拾取的部件正确聚焦并高亮

---

ViewerB 加载图层（from CesiumION）做剖面图
const tileset = viewer.scene.primitives.add(
  await Cesium.Cesium3DTileset.fromIonAssetId(5071436),
);

基于这个剖面图和原场景中的三维模型来实现拾取联动

---
1. viewerB 加载图层失败
```
"<!DOCTYPE html>\n<html lang=\"en\">\n<head>\n<meta charset=\"utf-8\">\n<title>Error</title>\n</head>\n<body>\n<pre>Cannot GET /Cesium-Demo/dual-viewer-dongchesuo/v1/assets/5071436/endpoint</pre>\n</body>\n</html>\n"
```

2. 由于超图内部的Cesium版本兼容问题不能使用ION数据
```
An error occurred while rendering. Rendering has stopped.
RuntimeError: Unsupported glTF Extension: KHR_mesh_quantization
Error
```
3. 我再提供一个地图服务，这个地图服务在平台中可以使用leaflet来加载，你尝试使用超图来加载看看
https://ct.sunrtcloud.com/iserver/services/map-dongchesuo-poumian/rest/maps

地图列表：

dongchesuo-ditu     	浏览于 iClient for Leaflet (with SingleImage) , for openlayers3 (with MVT) , for MapboxGL , for Classic (with Vector Tile) , for WebGL3D

但是目前我发现智能在Leaflet中正确预览，其他都不能看到这个服务；
4.  基于double-viewer-render模块生成一个新的副本，使用这个leaflet cdn模块来加载并生成一个新的viewer替代其中的一个viewer使用二维/三维联动的效果，使用正确的通信模块，并正确加载图层（二维的和三维的：
- https://ct.sunrtcloud.com/iserver/services/map-dongchesuo-poumian/rest/maps
- https://ct.sunrtcloud.com/iserver/services/3D-dongchesuo-poumian/rest/realspace

5. Bug Fix:
- 需要额外加载的图层服务你没有加载出来；三维的图层参考 Dual-viewer-dongcheso; 二维的图层服务使用leaflet加载，也还没有实现；还需要额外实现图层管理的panel，正确操作定位逻辑； 补充console日志
```
VM341:1 [Violation] Permissions policy violation: unload is not allowed in this document.
app.js:484 [CesiumLeafletSync] 二三维联动应用已启动
Cesium.js:26 
 GET https://ct.sunrtcloud.com/iserver/services/3D-dongchesuo-poumian/rest/realspace/scenes.json 404 (Not Found)
app.js:107 [3D] 场景加载失败: get scene list failed,Request has failed. Status Code: 404
content_main.js:4847 This page uses Chrome's Built-In AI features (LanguageDetector)! We're always improving our models; please submit your feedback here: https://issues.chromium.org/issues/new?component=1583316
112
app.js:55 [Leaflet] SuperMap 图层加载完成
```
- console一直output “112app.js:55 [Leaflet] SuperMap 图层加载完成” 这个应该是不合理的，fix