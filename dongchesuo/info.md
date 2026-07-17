1. 使用超图切片发布了场景服务
服务地址为：https://ct.sunrtcloud.com/iserver/services/3D-dongchesuotest/rest/realspace
场景名称为：dongchesuotest
在桌面软件预览选择了OSGB （三维模型）
基于示例来创建一个加载这个服务的三维场景，并正确初始化和聚焦；如果可以的话集成拾取+属性查询的功能交互

---

1. 使用一个panel展示所有的图层，并支持点击图层名称快速定位聚焦到这个图层
2. "清除拾取"时报错 scene.layers.getLength is not a function ，试试通过“layerQueue”这个属性来执行后续的逻辑
3. 集成全球影像，仅集成低精度瓦片
4. 复位视角也没有正确执行

---
0. 这个场景的图层初始化位置是否正确？是否有
1. 属性拾取，展示有用的信息
```
picked
{primitive: _0x28459f, id: '1', height: 17.9113048327834}
Object.keys($_.primitive).filter(e=>e[0]!=='_')
(10) ['lon', 'lat', 'height', 'positionUnits', 'waterEffectSet', 'hasQueryAttrAction', 'max', 'min', 'hasAttributeIndex', 'index']
```
2. 不要使用天地图底图，使用其他的，这个一直提示429
3. 展示camera当前所在的位置信息，在底部的bar 右侧展示
4. 现在展示的layer是_attributeExtentName值为"s3md"
5. 图层无法通过点击来定位，以下提供更多layer的属性, 找到可以使用的属性并优化
```
[
    "_materialType",
    "_isS3MB",
    "_isOSGB",
    "_isS3MZ",
    "_isS3MBlock",
    "_context",
    "_gl",
    "_name",
    "_globeType",
    "_groupName",
    "_id",
    "_version",
    "_baseUri",
    "_dataType",
    "_isTextureShare",
    "_associateMaterialUrl",
    "_isTransparencyOptimization",
    "_vertexCompressionType",
    "_vertexWeightMode",
    "_triangleFiltratePixel",
    "_urlType",
    "_urlArguments",
    "_fileType",
    "_RGBTOBGR",
    "_tilesLoaded",
    "_statistics",
    "_S3MTileLoadedEvent",
    "_allTilesLoaded",
    "_colorTableChanged",
    "_attributeDownloaded",
    "_prepareLoadSize",
    "_prepareLoadEvent",
    "_supportCompressType",
    "lon",
    "lat",
    "height",
    "positionUnits",
    "_layerBounds",
    "_layerRange",
    "_style3D",
    "_lodRangeScale",
    "_adjustedLodRangeScale",
    "_maximumScreenSpaceError",
    "_selectColorType",
    "_mixColorType",
    "_brightness",
    "_contrast",
    "_hue",
    "_saturation",
    "_gamma",
    "_visibleDistanceMax",
    "_visibleDistanceMin",
    "_minVisibleAltitude",
    "_maxVisibleAltitude",
    "_hasLight",
    "_selectEnabled",
    "_enableHighlight",
    "_heading",
    "_cullEnabled",
    "_cullMode",
    "_shadowType",
    "_visibleViewport",
    "_visible",
    "_sceneMode",
    "_selections",
    "_multiChoose",
    "_selectedColor",
    "_selectedLineColor",
    "_skeletonSelectedColor",
    "_selectedTranslate",
    "_objsColorList",
    "_objsOffsetList",
    "_objsVisibleList",
    "_objsHideList",
    "_objsVisibleMap",
    "_objsOperationList",
    "_operationType",
    "_effect",
    "_bloomEffect",
    "waterEffectSet",
    "_noiseMapUrl",
    "_noiseMapTexture",
    "_flattenTextureWidth",
    "_flattening",
    "_flattenBounds",
    "_flattenTexture",
    "_flattenRegions",
    "_flattenUpdate",
    "_flattenVisibleViewport",
    "_hasExcavation",
    "_hasServerExcavation",
    "_excavationBounds",
    "_excavationTexture",
    "_excavationRegions",
    "_excavationUpdate",
    "_excavationMode",
    "_serverExcavationMode",
    "_serverExcavationBounds",
    "_serverExcavationRegions",
    "_hasOverlay",
    "_overlayBounds",
    "_overlayRegions",
    "_overlayTextures",
    "_overlayTexture",
    "__overlayUpdate",
    "_hypsometricSetting",
    "_hypsometricTexture",
    "_hypsometricRenderTexture",
    "_hypsometricRegion",
    "_hypsometricBound",
    "_bUseHypColorTable",
    "_bUseHypRegion",
    "_hypsometricRegionUpdate",
    "_hypAnalysisMode",
    "_hypMaxInstensity",
    "_hypMinInstensity",
    "_hypMaxHeight",
    "_hypMinHeight",
    "_hypMaxCategory",
    "_hypMinCategory",
    "_hypUseColorByHeight",
    "_categorieTexture",
    "_categoryHideList",
    "_fHorizontalLine",
    "_oriClipPlane",
    "_renderClipPlaneArray",
    "_clipPlane",
    "_clipMode",
    "_clipLineColor",
    "_clipping",
    "_section",
    "_clipPlaneMode",
    "_clipPlaneColor",
    "_matModel",
    "_oriMatModel",
    "_bReleaseColor",
    "_ignoreNormal",
    "_textureLod",
    "_nProcessType",
    "_nLoadingMode",
    "_clockStart",
    "_polygonOffsetConfig",
    "_wireFrameType",
    "_bVolume",
    "_maps",
    "_volData",
    "_splitDirection",
    "_splitPosition",
    "_pickPosition",
    "_selectionFiltrateByTransparency",
    "_receiveObjectClamp",
    "_edgeCurrentTotalLength",
    "_edgeCurrentCount",
    "_edgeDistanceFalloffFactor",
    "_enableDepthTest",
    "_position",
    "_rsColor",
    "_rsClampColor",
    "_rsClampLineColor",
    "_rsStencil",
    "_layerModelBounds",
    "hasQueryAttrAction",
    "_indexedDBSetting",
    "_isJsonScp",
    "_queryFieldNames",
    "_fieldsInfo",
    "_indexInfoMap",
    "_indexInfoAttributeMap",
    "_attributeExtentName",
    "max",
    "min",
    "_oriBoundingSphere",
    "_boundingSphere",
    "_layerScheduler",
    "_clearMemoryImmediately",
    "_totalMemoryUsageInBytes",
    "_maximumMemoryUsage",
    "_PBRMaterialType",
    "_pbrMetalTexture",
    "_pbrRoughTexture",
    "_PBRMaterialParams",
    "_localCacheMemoryReserveCount",
    "_textureUVSpeed",
    "_pointCloudEyeDomeLighting",
    "_pointCloudShading",
    "_pointCloudClassificationInfos",
    "_styleEngine",
    "_manualShadowVolumeBottomHeight",
    "_manualShadowVolumeTopHeight",
    "_shadowVolumeBottomHeight",
    "_shadowVolumeTopHeight",
    "_level",
    "_refreshVolume",
    "_useMercatorProject",
    "_groupNameBounds",
    "_skeletonSelectEnable",
    "_lastSelectSkeletonId",
    "_minTransparentAlpha",
    "_maxTransparentAlpha",
    "_selectRect",
    "_selectUpdate",
    "_matSelectViewProj",
    "_useOIT",
    "_partlyTransparent",
    "_showLabel",
    "_s3MTilesLabelStyle",
    "_labelCollection",
    "_scene",
    "_transparentBackColor",
    "_transparentBackColorTolerance",
    "_shadowDarkness",
    "_spatialQueryEnable",
    "_spatialClipEnable",
    "_sqTextures",
    "_sqViewMatirx",
    "_sqPrjMatirx",
    "_sqMode",
    "_swipeRegion",
    "_swipeEnabled",
    "_allObjsHide",
    "_residentRootTile",
    "_idFieldName",
    "_imageryLayer",
    "_needCoverImageryLayer",
    "_iconCollection",
    "_showIcon",
    "_boundingSphereOffset",
    "_loadVolumeData",
    "_hasWireframe",
    "_edgeStrokesTexture",
    "_subdomains",
    "_subdomainsUrlScheme",
    "_isOverlapDisplayed",
    "_iconRelatedTextLayerID",
    "_priorityScale",
    "_blockCache",
    "_clippingType",
    "_spatialQuery",
    "_pickObjs",
    "_hasMixedContent",
    "_backfaceCommands",
    "_excavateRegionCommands",
    "_rasterPerFrame",
    "_animationInfo",
    "_textureEmissionUnit",
    "_pbrParameter",
    "_maxSkipNum",
    "_maximumPriority",
    "_minimumPriority",
    "_computeHeight",
    "_polygonsTranslate",
    "_maxSkipLevel",
    "_skipLevelSpan",
    "_mipmapEnabled",
    "_enableFusion",
    "_floodFlagTexture",
    "_floodRect",
    "_matFloodInvertMatrix",
    "_heightScale",
    "_useRasterCull",
    "_temporalCount",
    "_temporalSetting",
    "_translucencyByDistance",
    "_overlapWeightAttributeName",
    "_heightRangeAttributeName",
    "hasAttributeIndex",
    "_envMapIntensity",
    "_historyCommands",
    "_showCallout",
    "_maxLayerHeight",
    "_vertexColorLinear",
    "_lastPbrMaterialsArrLen",
    "index",
    "_projection",
    "_picking",
    "_frameState",
    "_hasObjsVisibleMap",
    "_hasHeightRangeAttributeName",
    "_dataVersion"
]
```

---

0. 补充iServer中的data服务地址： https://ct.sunrtcloud.com/iserver/services/data-dongchesuotest/rest，基于这个data服务丰富场景的查询，交互等功能
1. 现在看不到底图

---

SQL查询报错：
实际返回对象格式为：
```
{
    "layer": null,
    "lonlat": null,
    "data": {
        "SMID": "43",
        "SMUSERID": "0",
        "SMMAXZ": "6.177857155911624",
        "SMMINZ": "5.876260606572032",
        "SMINDEXKEY": "AAHmEAAA9RrQXys1ej8xMSuUfoWMP3nBlyvvSno/RIb7pMGSjD98AwAAAAEAAAAFAAAA9RrQXys1ej9EhvukwZKMP3nBlyvvSno/RIb7pMGSjD95wZcr70p6PzExK5R+hYw/9RrQXys1ej8xMSuUfoWMP/Ua0F8rNXo/RIb7pMGSjD/+",
        "SMBIMINFO": "无标高#*#*#坡道#*#*#坡道#*#*#坡道 1#*#*#坡道[380147]",
        "ELEMENTID": "380147",
        "ELEMENTNAME": "坡道 1",
        "CATEGORYID": "-2000180",
        "UNIQUEID": "62a0f54d-d710-4ecb-829f-256219bf1574-0005ccf3",
        "类别": "坡道",
        "IFC_预定义类型": "",
        "导出到_IFC_作为": "",
        "导出到_IFC": "0",
        "IFCGUID": "1YeFLDrn1EouAV9M8Pkjc7",
        "创建的阶段": "新构造",
        "在所有视图中显示向上箭头": "false",
        "向下箭头": "true",
        "向下标签": "true",
        "向上箭头": "true",
        "向上标签": "true",
        "实际踏板深度": "0.0",
        "实际踢面数": "2",
        "顶部偏移": "-0.95",
        "底部偏移": "-1.1",
        "实际踢面高度": "0.0",
        "所需踢面数": "0",
        "宽度": "1.0",
        "顶部标高": "1F-0.000",
        "底部标高": "1F-0.000",
        "族与类型": "坡道 : 坡道 1",
        "族": "坡道",
        "类型": "坡道 1",
        "类型_ID": "350"
    },
    "id": "SuperMap.Feature.Vector_137",
    "geometry": null,
    "state": null,
    "attributes": {
        "SMID": "43",
        "SMUSERID": "0",
        "SMMAXZ": "6.177857155911624",
        "SMMINZ": "5.876260606572032",
        "SMINDEXKEY": "AAHmEAAA9RrQXys1ej8xMSuUfoWMP3nBlyvvSno/RIb7pMGSjD98AwAAAAEAAAAFAAAA9RrQXys1ej9EhvukwZKMP3nBlyvvSno/RIb7pMGSjD95wZcr70p6PzExK5R+hYw/9RrQXys1ej8xMSuUfoWMP/Ua0F8rNXo/RIb7pMGSjD/+",
        "SMBIMINFO": "无标高#*#*#坡道#*#*#坡道#*#*#坡道 1#*#*#坡道[380147]",
        "ELEMENTID": "380147",
        "ELEMENTNAME": "坡道 1",
        "CATEGORYID": "-2000180",
        "UNIQUEID": "62a0f54d-d710-4ecb-829f-256219bf1574-0005ccf3",
        "类别": "坡道",
        "IFC_预定义类型": "",
        "导出到_IFC_作为": "",
        "导出到_IFC": "0",
        "IFCGUID": "1YeFLDrn1EouAV9M8Pkjc7",
        "创建的阶段": "新构造",
        "在所有视图中显示向上箭头": "false",
        "向下箭头": "true",
        "向下标签": "true",
        "向上箭头": "true",
        "向上标签": "true",
        "实际踏板深度": "0.0",
        "实际踢面数": "2",
        "顶部偏移": "-0.95",
        "底部偏移": "-1.1",
        "实际踢面高度": "0.0",
        "所需踢面数": "0",
        "宽度": "1.0",
        "顶部标高": "1F-0.000",
        "底部标高": "1F-0.000",
        "族与类型": "坡道 : 坡道 1",
        "族": "坡道",
        "类型": "坡道 1",
        "类型_ID": "350"
    },
    "style": null,
    "fid": 43
}
```

---

1. ~~加载这个rest地图服务；https://ct.sunrtcloud.com/iserver/services/map-dongchesuo_poumian/rest~~ ✅ 已完成
2. ~~这个地图服务是动车所的剖面dwg，我现在想在这个场景中做拾取交互的联动，核心逻辑是通过他们的唯一id来达到构建高亮效果~~ ✅ 已完成

**实现说明：**
- 引入 OpenLayers + iClient-OpenLayers 加载剖面 REST 地图服务
- 底部新增可折叠的"剖面图联动"面板，通过工具栏【剖面联动】按钮开关
- 三维拾取 → 剖面图：拾取模型获得 UNIQUEID 后，通过 queryBySQL 在剖面图中查询并高亮对应要素
- 剖面图 → 三维场景：点击剖面图要素获取 UNIQUEID，遍历数据集查询 SmID 后调用 `layer.setSelection` 高亮三维对象
- 联动关键字段：`UNIQUEID`

---

1. ~~使用Cesium来加载这个rest map，而不是引入新的引擎~~ ✅ 已完成
2. ~~支持在的图层list中定位到这个新的rest map~~ ✅ 已完成

**改造说明（v3 - 使用 scene.open 加载 realspace 3D 服务）：**
- 使用 `scene.open(SECTION_SERVICE_URL, SECTION_SCENE_NAME)` 加载剖面场景
- 服务地址: `https://ct.sunrtcloud.com/iserver/services/3D-dongchesuo-poumian/rest/realspace`
- 场景名称: `dongchesuo-poumian`（包含18个 dwg 图层）
- 图层列表底部按组分隔，显示所有剖面子图层，每个支持独立的可见性开关和定位
- 总控行可一键切换全部剖面图层可见性
- 联动高亮通过 `layer.setSelection([smId])` 实现

**iDesktop 端必须明确的参数（发布前需在 iDesktop 中确认）：**

| 参数 | 当前值 | 说明 |
|------|--------|------|
| `SECTION_SERVICE_URL` | `.../3D-dongchesuo-poumian/rest/realspace` | dwg 工作空间发布为 3D 服务后的 realspace 地址 |
| `SECTION_SCENE_NAME` | `dongchesuo-poumian` | iDesktop 工作空间中的场景名 |
| `SECTION_DATA_SOURCE` | `dongchesuo-dwg` | 数据源名称，与场景图层名中 `@` 后面的部分一致 |
| `SECTION_DATA_URL` | **待发布** | 需在 iServer 为 dongchesuo-dwg 数据源发布独立 data 服务 |
| `UNIQUEID` 字段 | 两端数据集共享 | 三维 BIM 模型和剖面 DWG 通过此字段关联 |

---
1. 初始化就加载剖面图服务，并和现在的dongchesuotest 一样的初始化逻辑，要支持图层管理；
2. 剖面图layers能确认有正确的请求返回https://ct.sunrtcloud.com/iserver/services/3D-dongchesuo-poumian/rest/realspace/scenes/dongchesuo-poumian/layers.json；但是我在场景中没有看到这个剖面图图层内容加载出来
3. 现在基于图层管理模块的定位交互，定位不准，会飞到部件的下方