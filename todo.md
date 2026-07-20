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

6. Bug Fix: 
- 图层管理的panel被遮挡了， 无法交互；应该正确在三维场景的容器中展示，不能被二维地图模块遮挡；
- 新增leaflet地图的拾取交互，输出拾取部件完整信息（三维场景拾取也需要输出）；如果二维场景拾取补充能查询信息可以询问；通过唯一ID，联动三维场景中的三维部件高亮； 
- 这个二维/三维场景默认关闭视角联动；直接移除这个视角联动交互

7. Bug Fix：
- 现在二维的服务加载异常了，刚刚修复之前还是正确的; 可能是没有正确在初始化后聚焦到场景中的地图服务中；二维场景leaflet额外实现一个基于已经加载的服务定位的交互；
- Cesium.js:26  GET https://ct.sunrtcloud.com/iserver/services/3D-dongchesuo-poumian/rest/realspace/scenes.json 404 (Not Found)； Cesium 不再需要加载这个poumian服务
- 继续移除相机联动交互入口； 修改二维场景名称为leaflet

8. Bug Fix:
- 由于二维地图的range太大，导致无法正确聚焦到这个图层，怎么处理？
[LayerPanel] 定位到二维图层: 动车所平面图 (SuperMap)
app.js:82 [Leaflet] 已定位到地图服务范围: 
{top: 17069.480773367242, left: -54936.20651449464, bottom: -6671.335316738036, leftBottom: {…}, right: 9923.859925007138, …}
bottom
: 
-6671.335316738036
left
: 
-54936.20651449464
leftBottom
: 
{x: -54936.20651449464, y: -6671.335316738036}
right
: 
9923.859925007138
rightTop
: 
{x: 9923.859925007138, y: 17069.480773367242}
top
: 
17069.480773367242
[[Prototype]]
: 
Object

- 无法正确定位到二维场景中加载的图层；现在的设置中二维场景也不能缩放
- 属性查询信息z-index被二维地图遮挡； 
- 三维场景中拾取后，二维地图可以正确关联线，并展示属性；但是二维地图中拾取要素无法查询：
```
属性信息
×
二维拾取
位置	663.346214, -124.000000
状态	未查询到要素
```