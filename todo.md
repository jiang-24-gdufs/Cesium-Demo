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

---
属性查询联动功能（已优化）：

### 问题根因分析
1. **二维查询图层名错误**：之前使用 `dongchesuo-ditu@dongchesuo-poumian` 作为查询图层名，但该名称不存在。
   - 实际情况：地图 `dongchesuo-ditu` 的 `queryable=false`，但其下有 18 个子图层（DWG 数据，数据源 `dongchesuo-dwg`）均 `queryable=true`
   - 正确的查询图层名应是子图层名如 `dongchesuo_poumian_广州动车所四线检查库_1_1剖视图_去图框__1__dwg_R@dongchesuo-dwg` 等

2. **联动字段问题**：三维拾取后仅传 SmID 联动，SmID 是数据集内部 ID，跨数据集无对应关系。
   - 三维 BIM 数据（S3M）有 ELEMENTID/UNIQUEID 等业务字段
   - 二维 DWG 剖面图数据没有这些 BIM 字段，二者属于不同数据源
   - 联动逻辑已优化为优先使用 ELEMENTID > UNIQUEID 作为关联字段

### 已实施的优化
1. **`ensureMapLayerNames()`**：通过 `/layers.json` 接口动态获取所有 `queryable=true` 的子图层名列表并缓存
2. **`queryLayersBatch()`**：将所有可查询子图层作为 `queryParams` 数组一次性提交 BoundsQuery，遍历 recordsets 找第一个有结果的图层
3. **渐进容差策略**：50 → 200 → 500 三级容差递增，适配投影坐标系下的不同精度需求
4. **三维拾取日志增强**：输出 ELEMENTID/UNIQUEID/SmID/数据集等关键字段，方便诊断
5. **`linkPick3Dto2D()`**：三维→二维联动逻辑独立函数，日志中标注使用的关联字段

### 待确认
- 二维 DWG 剖面图与三维 BIM S3M 模型属于不同数据源，可能无法通过字段直接关联
- 需验证二维子图层查询是否能返回有效要素属性

---
二维查询性能优化（已完成）：

### 原始问题
- 一次查询 18 个子图层，服务端逐个扫描开销大
- `expectCount: 10` 且未禁用几何返回，DWG 要素几何体积巨大导致响应 ≥ 200MB
- 三级容差递增（50→200→500）串行请求，最坏情况发 3 次请求
- 快速连续点击无防抖，前一个请求未完成又发新的

### 优化措施
1. **空间预过滤**：`ensureMapQueryLayers()` 缓存每个子图层的 bounds，查询前用 `filterLayersByBounds()` 剔除点位不在其 bounds 内的图层（18 → 少数几个）
2. **减少响应体积**：`expectCount: 1`（拾取只需最近 1 个要素）
3. **简化容差策略**：单次 tolerance=100 查询替代三级递增，配合空间预过滤即可覆盖
4. **防抖 150ms**：连续快速点击只发最后一次查询
5. **AbortController**：新拾取自动取消前一次未完成的请求
6. **计时日志**：输出每次查询耗时（`performance.now()`）便于诊断

---
继续优化（已完成）：

### 1. 响应体积优化
- **根因**：`queryOption: 'ATTRIBUTEANDGEOMETRY'` 导致 DWG 要素返回完整几何（TEXT 类型含数百个 points/texts/rotations 数组）
- **修复**：`queryOption` 改为 `'ATTRIBUTE'`，仅返回属性字段，响应体积从 MB 级降到 KB 级

### 2. 二维↔三维联动字段桥接
- **问题**：DWG 子图层没有 `ELEMENTID`/`UNIQUEID` 字段，无法直接与三维 BIM 数据关联
- **发现**：DWG 的 `BlockName` 字段中嵌入了 Revit ElementID，格式为 `..._dwg-{elementId}-{视图名}` (如 `..._dwg-554611-剖面 1`)
- **修复**：`extractLinkKey()` 增加正则解析 `/_dwg-(\d+)-/`，从 BlockName 提取 ElementID
- **优化**：`highlightInModelByKey()` 对纯数字 key 直接查 `ELEMENTID`（跳过 UNIQUEID），减少无效请求
- **待验证**：BlockName 中的数字是否确实对应三维 BIM 的 ELEMENTID（需实际拾取测试）

### 3. Leaflet 缩放修复
- **问题**：`minZoom: -5` 且 `fitBounds` 设了 `maxZoom: 5`，投影坐标范围约 65000×24000 在 CRS.Simple 下需要更低缩放级别才能看到全貌
- **修复**：`minZoom` 从 `-5` 调到 `-10`，`fitBounds` 去掉 `maxZoom` 限制