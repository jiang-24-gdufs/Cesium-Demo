new Cesium.S3MTilesLayer(options)
S3M(Spatial 3D Model)图层类，通过该图层实现加载三维切片缓存，包括倾斜摄影模型、BIM模型、点云数据、精细模型、矢量数据、符号等。

通过Scene.addS3MTilesLayerByScp(url, options)的方式将发布的*.s3m格式的三维服务添加到场景中。

注：通过本地三维切片（.scp）发布的服务，不支持字段专题图功能。
Name	Type	Description
options	Object	optional参数对象具有以下属性:
Name	Type	Default	Description
gl	WebGLRenderingContext		optionalwebgl上下文。
servers	Array		optional包含服务器地址的数组。
urls	Array		optional包含xml地址的数组。
position	Array		optional图层插入点位置（[经度、纬度、高度]）。
name	Array		optional图层名称。
WaterEffectSet	Object		optional水面特效参数。
urlType	UrlType		optionalentity数据请求形式。
urlArguments	String		optional数据服务URL所带参数。
format	Boolean		optional是否支持纹理压缩。
cacheEntityCount	Number	0	optionalLOD调度时缓存的实体个数。
layerBounds	Rectangle		optional图层范围。
tileSpliteType	String	'LOCAL'	optional切片剖分类型。
volumeObj	Object		optional体渲染参数对象。
boundingSphereColc	Array		optional根节点boundingSphere。
MaxInstensity	Number		optional最大强度。
MinInstensity	Number		optional最小强度。
MaxHeight	Number		optional最大高度。
MinHeight	Number		optional最小高度。
HorizontalLine	Number		optional水平等高线。
fileType	String		optional文件类型（数据类型）。
ProcessType	String		optional处理方式。
cullEnabled	Boolean	false	optional是否剔除背面（默认为否，即双面渲染）。
cacheKey	String		optional三维缓存密钥，该密钥即是iserver发布三维缓存服务设置的三维缓存密钥。
keyframes	Object		optional时间点。
duration	Object		optional动画持续时间。
interpolationType	Object		optional插值类型，默认值Linear。
emissionTextureUnit	EmissionTextureUnit		optional设置自发光纹理单元。
cullMode	WindingOrder		optional单面渲染时，可设置渲染时顺逆时针渲染。
Example:
//new S3MTilesLayer instance
var S3MTilesLayer = new S3MTilesLayer({
 gl : gl,
 servers : ["http://localhost:8090"],
 urls : ["http://localhost:8090/data/tile_001.xml","http://localhost:8090/data/tile_002.xml"],
 position : [10,20],
 name : ["S3MTilesLayer"]
});
Members
staticCesium.S3MTilesLayer.DEFAULT_TRANSPARENT_BACK_COLOR : Color
图层透明的目标颜色默认色为黑色（Color.BLACK）。
staticCesium.S3MTilesLayer.DEFAULT_TRANSPARENT_BACK_COLOR_TOLERANCE : number
图层透明容限的默认值为0.0，即不透明
Default Value: 0.0
allTilesLoaded : Event
当前视角下所有切片加载完成的事件。该事件会在所有切片加载完成时触发。
attributeDownloaded : Event
判断属性文件是否已经下载完成的事件。该事件会在所有属性文件都下载完成时触发。 说明：使用部分属性字段设置专题图时，设置queryFiledNames后会开始下载属性文件，不需要开启indexedDB的isAttributesSave。
Example:
layer.queryFieldNames = ['FLOOR','HEIGHT']
readonlybloomEffect : BloomEffect
获取场景的泛光效果，包括泛光强度值，泛光亮度阈值等。
bloomEnable : boolean
获取泛光效果是否开启。
bReleaseColor : Number
释放顶点颜色内存，还原顶点颜色。（已废弃）
brightness : Number
设置图层亮度值调节颜色。
clearMemoryImmediately : Boolean
是否及时释放内存，默认值为true。若设置为false，则需要对setCacheSize设置一个值。（废弃） 目前可根据显卡类型动态调配资源。如果想立即释放内存请使用SuperMap3D.MemoryManager.setCacheSize()整体释放，不需要对单个图层进行设置。
Default Value: true
Example:
设置缓存空间大小，单位MB
Cesium.MemoryManager.setCacheSize(512);
选择不及时释放内存
Cesium.when.all ([promise],function (layers){
layers[0].forEach ((layer)=>{
layer.clearMemoryImmediately = false
})
See:
MemoryManager
clipLineColor : Color
获取或设置对S3M图层进行BOX裁剪时裁剪线的颜色。
clippingType : ClippingType
获取或者设置裁剪模式。
clipPlaneColor : Color
获取或者设置裁剪截面的颜色
ColorDictTableMode : String
设置颜色表模式。
colorTableChanged : Event
当前视角下所有体数据切片的颜色表应用完成时的事件。该事件会在体数据切片的颜色表应用完成时触发。
computeHeight : Boolean
用于指定是否在前端自动计算模型的高度，默认值为false不计算高度。对于不带高度的数据指定为true可以保证淹没分析、设置等高线等操作正常运行。
Default Value: false
contrast : Number
设置图层对比度值调节颜色。
coverImageryLayer : ImageryLayer
获取或者设置(用于贴到倾斜模型表面的)覆盖影像图层。(注：现不支持对叠加后的影像图层进行操作)
cullMode : WindingOrder
单面渲染时，获取或者设置顺逆时针渲染
customRequestHeaders : Object
获取或者设置自定义请求头。
dataMaxValue : Number
获取数据的最大高度值或最大强度值。 对点云数据而言，该属性为高度值或强度值（默认为强度值）；对其他三维数据而言，该属性为高度值。
Example:
//获取数据最大值
var dataMaxValue = S3MTilesLayer.DataMaxValue;
dataMinValue : Number
获取数据的最小高度值或最小强度值。 对点云数据而言，该属性为高度值或强度值（默认为强度值）；对其他三维数据而言，该属性为高度值。
Example:
//获取数据最小值
var dataMinValue = S3MTilesLayer.DataMinValue;
effect : S3MPolylineEffect
获取或设置S3M图层的线型符号。
enableHighlight : Boolean
获取或者设置图层是否高亮
Default Value: True
gamma : Number
设置图层gamma值调节颜色。
readonlygroupName : String
获取图层所在群组名称
hasLight : Boolean
获取或者设置图层是否开启光照效果。
readonlyhasWireframe : Boolean
获取图层是否有线框。
heading : Number
获取或者设置相机的heading角度（单位：弧度）。
heightScale : Number
设置模型z方向拉升高度值，默认值为1
Default Value: 1
horizontalColor : Color
获取或者设置水平线颜色。
horizontalline : Number
获取或设置水平线高度。
hue : Number
设置图层色调值调节颜色。
hypsometricSetting : Object
获取或设置图层的分层设色表达。
Example:
//设置图层分层设色属性
var hypsometricSetting = new Cesium.HypsometricSetting();
hypsometricSetting.MinVisibleValue = 30;
hypsometricSetting.MaxVisibleValue = 150;
var colorTable = new Cesium.ColorTable();
colorTable.insert(150, new Cesium.Color(1, 0, 0));
colorTable.insert(30, new Cesium.Color(0, 0, 1));
hypsometricSetting.ColorTable= colorTable;
S3MTilesLayer.hypsometricSetting = {
hypsometricSetting : hypsometricSetting,
analysisMode: Cesium.HypsometricSettingEnum.AnalysisRegionMode.ARM_ALL
}
//获取图层分层设色属性
var hyp = S3MTilesLayer.hypsometricSetting ;
iconRelatedTextLayerID : Number|Undefined
获取或者设置文字图层的ID。该接口根据ID指定一个文字图层，让图标图层跟随该图层进行避让。 注意：只有当overlapDisplayOptions.allowIconWithTextDisplay为true时才会生效。
Default Value: undefined
readonlyid : Number
获取图层id。
ignoreNormal : Boolean
获取或者设置是否在GPU中自动计算法线，默认值为false。值为true时，在GPU中自动计算法线，不使用数据自带的法线。值为false时,在GPU中不自动计算法线，使用数据自带的法线。
indexedDBSetting : Object
获取或者设置indexedDB属性信息(IE浏览器不支持)。其中，在设置indexeDB属性时， 有三个布尔类型的分支属性：isGeoTilesSave——是否保存切片； isAttributesSave--是否保存属性；isGeoTilesRootNodeSave--是否保存根节点。
Example:
//打开倾斜数据的Config图层
var layer = scene.layers.find('Config');
//设置是否保存切片缓存
layer.indexedDBSetting.isGeoTilesSave = true
isOverlapDisplayed : Boolean
获取或者设置图层重叠的部分是否显示。设为true时，重叠的部分依然显示，即不参与避让。默认值为false。
Default Value: false
labelStyle : S3MTilesLabelStyle
获取或者设置图层文字标签风格。
layerBounds : Rectangle
获取或设置图层范围。
LoadingMode : Number
获取或者设置点云层级切换时的加载模式，分为追加模式和替换模式。
LoadingPriority : LoadingPriorityMode
获取或者设置加载的优先级模式，分为深度优先、层优先、空间索引、深度优先非线性切换。
Default Value: Child_Priority : 1
loadVolumeData : Boolean
获取或者设置是否加载体数据，默认值为true。
Default Value: true
lodRangeScale : Number
获取或设置图层的LOD层级切换距离缩放系数。
maximumMemoryUsage : Number
切片数据集可以使用的最大内存量（单位：MB），默认值是512MB。
Default Value: 512
maxTransparentAlpha : number
获取或者设置最大透明度阈值（前景色透明度设置为[0,maxTransparentAlpha]之间将被认为同一透明效果，[maxTransparentAlpha,1]之间将会有透明过渡效果）。
Default Value: 0.98
maxVisibleAltitude : Number
获取或设置图层的最大可见高度。
minTransparentAlpha : number
获取或者设置最小透明度阈值（小于这个值将被过滤掉）
Default Value: 0.1
minVisibleAltitude : Number
获取或设置图层的最小可见高度。
mipmapEnabled : Boolean
用于指定纹理是否创建mipmap，默认值为true表示创建mipmap；设置为false则表示不创建。
Default Value: true
mixColorType : MixColorType
设置纹理显示模式（混合、替换）
multiChoose : Boolean
获取或者设置图层是否支持多选。
readonlyname : String
获取图层名称
orderIndependentTranslucency : Boolean
获取或者设置是否开启透明排序功能（OIT），默认是true。
Default Value: true
overlapWeightAttributeName : String
获取或者设置指定避让权重的属性字段名称，可根据该字段区分避让优先级。
partlyTransparent : Boolean
获取和设置透明材质在开启OIT时，其显示效果是否优化。
Default Value: false
pointCloudShading : Object
获取封装点云渲染参数对象pointCloudShading
priorityScale : Number
获取或者设置更新优先级系数，可以控制多个图层间的更新优先级顺序。
constantrainEffect
设置或者获取雨水材质影响因素。
rasterPerFrame : Boolean
是否实时绘制栅格化矢量线，以确保线粗细在不同层级保持一致,默认值为false。
Default Value: false
receiveObjectClamp : Boolean
获取或者设置图层是否接受贴对象，默认设置为true，设置为false时则不会被贴对象。
Default Value: true
residentRootTile : boolean
设置根节点是否驻留内存不删除。默认值为false。
RGBTOBGR : Boolean
纹理压缩格式为webp的情况下，当纹理红绿反转时，使用颜色通道RGB转BGR。
Default Value: false
S3MTileLoadedEvent : Event
获取S3M切片加载完成时触发的事件，该事件的处理函数会被传入切片的包围球（BoundingSphere）作为参数。
saturation : Number
设置图层饱和度值调节颜色。
selectBound : Rectangle
获取和设置框选范围。
selectColorType : SelectColorType
获取或设置选取对象的显示风格，模型纹理与颜色混合显示或纯色显示。
selectedColor : Color
获取或者设置选中图层显示的高亮颜色。当前模式为线框模式时，用来获取或者设置选中轮廓线的高亮颜色。
selectedLineColor : Color
获取或者设置图层选中对象线框发光轮廓线的高亮颜色。
Default Value: new Color(1.0,1.0,1.0,1.0)
selectedSkeletonId : Number
获取或者设置子对象ID
selectedTranslate : Cartesian3
获取或设置选中对象的偏移位置。
selectEnabled : Boolean
获取或者设置图层是否可选。
selectionFiltrateByTransparency : Number
获取或设置透明选择过滤阈值。
shadowType : ShadowType
获取或设置图层中模型参与显示阴影的范围类型。
shadowVolumeBottomHeight : Number
获取和设置阴影体向下拉升的最低高度。
shadowVolumeTopHeight : Number
获取和设置阴影体向上拉升的最大高度。
showCallout : Boolean
获取或者设置是否显示牵引线。
showIcon : Boolean
获取或者设置是否显示图标.
showLabel : Boolean
获取或者设置是否显示标签。
constantsilhouetteColor : Color
设置或者获取边缘轮廓颜色，默认蓝色
constantsilhouetteSize : Number
设置或者获取边缘轮廓大小，默认2，单位像素
Default Value: 2.0
skeletonSelectedColor : Color
获取或者设置子对象选中高亮的颜色
skeletonSelectEnable : Boolean
获取或者设置图层中子对象是否可选择
splitDirection : SplitDirection
获取或设置卷帘方向。
splitPosition : Number
获取或设置卷帘位置。
style3D : Style3D
获取或设置图层风格。
Example:
//获取图层风格
var style = S3MTilesLayer.style3D;
//设置图层风格
var style3D = new Cesium.Style3D();
var color = new Cesium.Color(1.0, 0.0, 0.0);
style3D.fillForeColor = color;
S3MTilesLayer.style3D = style3D;
//设置后需刷新图层
S3MTilesLayer.refresh();
subdomains : String
获取或者设置子域名称。通过该接口可以向指定的子域请求数据。
swipeEnabled : Boolean
获取或者设置是否开启卷帘功能。
swipeRegion : BoundingRectangle
获取或者设置卷帘的四边形区域。
textureUVSpeed : Number
获取或者设置模型纹理在UV坐标上的运动速度
themeStyle : Cesium3DTileStyle
获取或设置专题图风格，目前支持贴地面矢量缓存在前端根据ID设置填充颜色和纹理的专题图。 注意：当使用模型数据做专题图，生成缓存时需要在桌面软件中把“属性存储类型”改为“ATTRIBUTR”
transparentBackColor : Color
获取或者设置图层透明目标颜色。
transparentBackColorTolerance : Number
获取或者设置图层透明容限。取值范围为0.0~1.0，0.0表示完全不透明，1.0表示完全透明。
triangleFiltratePixel : Number
获取和设置过滤像素的大小。
urlType : UrlType
获取或者设置图层数据的请求形式。
visible : Boolean
获取或设置图层可见性。
Example:
//获取可见性
var isVisible = S3MTilesLayer.visible;
//设置不可见
S3MTilesLayer.visible = false;
visibleDistanceMax : Number
获取或设置该图层的最大可见距离值，单位为米。该距离值用于距离过滤功能，当相机与图层的距离大于该距离值时，该图层将不可见。
visibleDistanceMin : Number
获取或设置该图层的最小可见距离值，单位为米。该距离值用于距离过滤功能，当相机与图层的距离小于该距离值时，该图层将不可见。
volName : String
获取或者设置体数据名称。
waterColor : Color
获取或者设置水面颜色。
waterSpeed : Cartesian2
获取或者设置水面速度与水流方向。该量为一个二维的量，用数值的大小表示速度大小，用其x,y的正负来表示水流的方向。
waterWaveScale : Number
获取或者设置水面波纹强度。
wireFrameMode : Number
获取或设置图层线框模式。
Methods
addExcavationRegion(options) → Boolean
添加开挖面。
Name	Type	Description
options	Object	开挖区域参数：
Name	Type	Description
position	Array	开挖区域位置信息。
name	String	开挖区域名称。
Returns:
bool 成功返回true,失败返回false。
addFlattenRegion(options) → Boolean
添加压平面，用于压平模型表面。
Name	Type	Description
options	Object	压平区域参数：
Name	Type	Description
position	Array	指定压平区域位置信息。
name	String	压平区域名称。
Returns:
成功返回true,失败返回false。
Example:
S3MTilesLayer.addFlattenRegion({
    position : [13.0500640714, 47.8279189759, 400.0,
                13.0500640714, 47.8230189759, 400.0,
                13.0530640714, 47.8260189759, 400.0,
                13.0538640714, 47.8230189759, 400.0,
                13.0538640714, 47.8279189759, 400.0],
       name : 'flatten' + Cesium.createGuid()});
AddImageArray(imgArray)
利用一组纹理图片对S3M图层进行体渲染。体渲染时需设置体渲染的范围。
Name	Type	Description
imgArray	Promise.<Image>	纹理数组。
addOverlayImage(options) → Boolean
S3M图层指定范围叠加图片。
Name	Type	Description
options	Object	对象具有以下属性：
Name	Type	Description
name	String	指定范围的名称。
bounds	Array	指定范围的点集数组。
image	Element	html image元素,用于叠加的纹理图片。
Returns:
bool 成功返回true,失败返回false。
clearCustomClipBox()
清除自定义裁剪面。
Example:
S3MTilesLayer.clearCustomClipBox();
clearModifyRegions()
清除多边形对象裁剪S3M图层。
datasetInfo() → Promise.Array
获取图层数据集名称以及对应的Id范围（适用于多数据集生成缓存）。
Returns:
数组包含所有数据集相关信息，每个数据集对象包含数据集名称、起始Id、终止Id。
Example:
var data =  layer.datasetInfo();
Cesium.when(data,function(dataSet){
       var length = dataSet.length;
       .......
        });
destroy()
销毁图层，释放内存、释放webgl资源
fillStyleChange()
设置填充模式后边框线不消失
getAttributesById(id)
获取本地对象属性信息（indexedDB中的scvd，IE浏览器不支持）。
Name	Type	Description
id	Number	索引。
getClipRegion()
获取剖面裁剪的范围。
getLodRangeScale() → Number
获取图层的lOD层级切换距离缩放系数。
Returns:
LOD层级切换距离缩放系数。
Example:
var num = S3MTilesLayer.getLodRangeScale();
getObjsColor() → Color
根据ID获取对应图元对象的颜色表。
Returns:
对应ID的颜色。
getObjsVisible(id) → Boolean
获得指定ID的对象可见性。
Name	Type	Description
id	Number	指定的对象ID。
Returns:
对象是否可见。
Example:
var id = 12;
S3MTilesLayer.getObjsVisible(id);
getPointCloudClassificationInfos()
获取点云分类信息数组。
Returns:
第一次请求数据返回promise。
getPointCloudGroupBounds(name) → undefined|*
获取点云分组的对应范围。
Name	Type	Description
name	String	对应范围的名称。
Returns:
通过点云名称获取点云分组的范围（Bounds），如果未获取到返回undefined
Example:
layer.getPointCloudGroupBounds(name);
getPointCloudGroupInfos()
获取点云的分组信息
Example:
layer.getPointCloudGroupInfos();
getQueryParameter() → Object
获取属性查询参数。
Returns:
属性查询参数对象。
getSelection() → AssociativeArray
获取选择集。
Returns:
包含所有选中ID的关系数组。
Example:
S3MTilesLayer.getSelection();
getVisibleInViewport(index) → Boolean
获取图层对应视口的可见性。
Name	Type	Description
index	Number	索引。
Returns:
visible 可见性。
Throws:
DeveloperError : 索引值范围为0~3。
getVolNames() → Array
获取所有的体数据名称。
Returns:
所有体数据名称数组。
refresh()
刷新图层。
releaseSelection()
释放选择集。
Example:
S3MTilesLayer.releaseSelection();
removeAllExcavationRegion()
移除所有的开挖面。
removeAllFlattenRegion()
移除所有压平面。
Example:
S3MTilesLayer. removeAllFlattenRegion();
removeAllObjectsOperation()
移除所有图元的操作。
removeAllObjsColor()
移除所有图元设置的颜色。
removeAllObjsExtendHeight()
移除所有设置的拉伸高度。
removeAllObjsOffset()
清除所有的对象偏移。
removeAllObjsTranslate()
移除所有对象的偏移。
removeExcavationRegion(name) → Boolean
移除指定名称的开挖面。
Name	Type	Description
name	String	开挖面的名称。
Returns:
bool 成功返回true,失败返回false。
removeFlattenRegion(name) → Boolean
移除指定名称的压平面。
Name	Type	Description
name	String	待移除压平面的名称。
Returns:
移除成功返回true,失败返回false。
Example:
S3MTilesLayer. removeFlattenRegion(regionName);
removeObjectsOperation(ids)
根据图元ID列表，移除指定图元的操作（裁剪或者偏移）。
Name	Type	Description
ids	Array	图元ID列表。
removeObjsColor(ids)
根据图元ID列表移除相应图元被设置的颜色。
Name	Type	Description
ids	Array	图元ID列表。
removeObjsExtendHeight(ids)
根据图元ID列表移除对象被设置的拉伸高度。
Name	Type	Description
ids	Array	图元ID列表。
removeObjsOffset(ids)
根据对象ID列表清除对象偏移。
Name	Type	Description
ids	Array	对象ID列表。
removeObjsTranslate(ids)
移除指定id对象的偏移。
Name	Type	Description
ids	Array	拟移除偏移的对象的id集合。
removeOverlayImage(name) → Boolean
移除指定名称的覆盖层区域
Name	Type	Description
name	String	覆盖层区域名称
Returns:
成功返回true,失败返回false
removePBRMaterial()
用于移除PBR材质
setAnimation(keyframes, duration, InterpolationType)
设置图层的动画。
Name	Type	Description
keyframes	Object	时间点。
duration	Object	动画持续时间。
InterpolationType	Object	表示插值类型,默认值Linear。
Throws:
InterpolationType
Example:
var promise = layer.setAnimation({
                                keyframes: {
                                    '0%': { // 时间点
                                        translation: Cesium.Cartesian3.fromDegrees(layer.lon, layer.lat, layer.height),
                                        rotation: new Cesium.HeadingPitchRoll(0, 0, 0),
                                        scale: new Cesium.Cartesian3(1, 1, 1),
                                        interpolationType: Cesium.InterpolationType.SmoothStep // 这个时间点到下一时间点这段时间的插值类型，没有设置就用keyframes同级的InterpolationType。
                                    },
                                    // '20%': {},
                                    '100%': {
                                        translation: Cesium.Cartesian3.fromDegrees(layer.lon, layer.lat, layer.height),
                                        rotation: new Cesium.HeadingPitchRoll(0, 0, 0),
                                        scale: new Cesium.Cartesian3(5, 5, 5)
                                    },
                                },
                                duration:
                                    5, // 动画持续几秒
                                interpolationType: Cesium.InterpolationType.Linear // 插值类型，默认值Linear
})
setBatchObjsTranslate(option)
批量设置对象偏移。
Name	Type	Description
option	Object	拟移除偏移的对象的id和偏移量集合。
Example:
var option = {
     id1：Cartesian3,
     id2: Cartesian3,
     }
layer.setBatchObjsTranslate(option);
SetBound3D(left, bottom, right, top, minHeight, maxHeight)
为图层设置一个包围盒，盒子区域内模型具有体渲染效果，区域外模型保持原样。
Name	Type	Description
left	Number	包围盒左侧的经度，以度为范围。
bottom	Number	包围盒下方的纬度，度为范围。
right	Number	包围盒右侧的经度，以度为范围。
top	Number	包围盒上方的纬度，以度为单位。
minHeight	Number	包围盒高度最小值，以米为范围。
maxHeight	Number	包围盒高度最大值，以米为范围。
setCategoriesVisible(categories, mode)
根据W位特征值隐藏显示对象
Name	Type	Description
categories	Array.<Number> | Number	特征值数组,或者特征值
mode	CategoryVisibleMode	隐藏、显示、重置
setClipSection(firstPoint, secondPoint, thirdPoint, renderClipSection)
设置裁剪面
Name	Type	Description
firstPoint	Cartesian3	绘制裁剪面的第一个点。
secondPoint	Cartesian3	绘制裁剪面的第二个点。
thirdPoint	Cartesian3	绘制裁剪面的第三个点。
renderClipSection	Boolean	绘制裁剪截面。
Example:
var p1 =  new Cesium.Cartesian3(-8787.4,2084.7,7021.04335128);
 var p2 =  new Cesium.Cartesian3(-8786.3,2081.8,7024.90146083);
 var p3 =  new Cesium.Cartesian3(-8783.2,2086.8,7021.04335128);
 for(var i = 0;i < layers.length;i++){
    layers[i].setClipSection(p1,p2,p3，true);
  }
setCustomClipBox(options) → Boolean
添加自定义裁剪面。
Name	Type	Description
options	Object	裁剪面参数：
Name	Type	Description
dimensions	Cartesian3	指定裁剪box的长宽高。
position	Cartesian3	指定裁剪面位置。
clipMode	String	指定裁剪模式。 裁剪模式包括以下几类：

clip_behind_any_plane：裁剪掉位于任何裁剪面后面的部分。

clip_behind_all_plane：裁剪掉位于所有裁剪面后面的部分。

only_keep_line：只保留裁剪线，裁剪掉其他部分。
Returns:
添加成功返回true,失败返回false。
Throws:
DeveloperError : options and options.dimensions and options.position are required.
Example:
var boxOptions = {
      dimensions : new Cesium.Cartesian3(10, 10, 10)
      position : Cesium.Cartesian3.fromDegrees(120, 40, 20),
      clipMode : "clip_behind_all_plane"
};
S3MTilesLayer.setCustomClipBox(boxOptions);
setCustomClipCross(options)
设置区域裁剪参数。
Name	Type	Description
options	Object	参数对象包含以下属性:
Name	Type	Description
position	Cartesian3	optional中心点位置坐标。
dimensions	Cartesian2	optional裁剪区域的宽度和高度，单位：米。
heading	Number	optional裁剪面绕Z轴的旋转角度，单位：度。
pitch	Number	optional裁剪面绕X轴的旋转角度，单位：度。
roll	Number	optional裁剪面绕Y轴的旋转角度，单位：度。
extrudeDistance	Number	optional裁剪区域中心点拉伸距离，单位：米。
setCustomClipGeometry(options)
设置多面体裁剪参数。
Name	Type	Description
options	Object	参数对象包含以下属性:
Name	Type	Description
geometry	Geometry3D	optional几何体对象（目前只支持凸多面体）。
clippingType	ClippingType	optional裁剪类型
spatialQuery	SpatialQuery3D	optional空间查询对象。
Example:
var geometry = new Geometry3D(pts)
geometry.extrudeHeight = 100;
var spatialQuery = new SpatialQuery3D();
spatialQuery.build();
layer.setCustomClipGeometry({
 geometry : geometry;
 clippingType : ClippingType.KeepOutside;
 spatialQuery : spatialQuery
 })
setCustomClipPlane(firstPoint, secondPoint, thirdPoint, clipPlaneMode)
剖面分析。
Name	Type	Description
firstPoint	Cartesian3	绘制剖面的第一个点。
secondPoint	Cartesian3	绘制剖面的第二个点。
thirdPoint	Cartesian3	绘制剖面的第三个点。
clipPlaneMode	ClipPlaneMode	裁剪截面模式。
Example:
var p1 =  new Cesium.Cartesian3(-8787.4,2084.7,7021.04335128);
 var p2 =  new Cesium.Cartesian3(-8786.3,2081.8,7024.90146083);
 var p3 =  new Cesium.Cartesian3(-8783.2,2086.8,7021.04335128);
 for(var i = 0;i < layers.length;i++){
    layers[i].setCustomClipPlane(p1,p2,p3);
  }
setExtrudedPolygons()
对指定对象在前端分楼层显示
setFlattenRegionVisibleInViewport(index) → Boolean
设置压平区域分屏。
Name	Type	Description
index	Number	索引。
Returns:
visible 可见性。
Throws:
DeveloperError : 索引值范围为0~8。
setLodRangeScale(lodrange)
设置图层的lOD层级切换距离缩放系数。
Name	Type	Description
lodrange	Number	LOD层级切换距离缩放系数。
Example:
S3MTilesLayer.setLodRangeScale();
setModifyRegions(regions, mode)
根据多边形对象裁剪S3M图层。
Name	Type	Description
regions	Array	多边形数组。
mode	mode	裁剪模式，设置裁剪多边形对象的内部范围或外部范围。值为CLIP_INSIDE时裁剪内部范围，值为CLIP_OUTSIDE时裁剪外部范围。
setObjectsOperationByID(ids, operationType)
针对指定的ID对象进行功能操作。
Name	Type	Description
ids	Array	对象ID列表。
operationType	Number	功能操作类型，值为CLIP，针对裁剪功能生效。
setObjsColor(ids, color)
根据图元IDS列表，设置对应图元的颜色。
Name	Type	Description
ids	Array	图元ID列表。
color	Color	图元的颜色。
setObjsExtendHeight(ids, height)
根据IDS列表，设置对象的拉伸高度。
Name	Type	Description
ids	Array	图元ID列表。
height	Number	对象拉伸高度值。
setObjsOffset(ids)
根据对象ID列表设置对象偏移。
Name	Type	Description
ids	Array	对象ID列表。
setObjsTranslate(ids, translate)
根据指定的id设置对象的偏移。
Name	Type	Description
ids	Array	指定拟设置偏移的对象的id。
translate	Cartesian3	指定偏移量。
setObjsVisible(ids, isVisible)
根据图元ID列表，设置对应的图元的可见性，并与该图层其他图元成互斥可见关系。
Name	Type	Description
ids	Array	图元ID列表。
isVisible	Boolean	是否可见。
Example:
//设置该图层id为1的图元显示，其余所有图元全部不可见。
layer.setObjsVisible([1],true);
//设置图元id=1的隐藏，其余所有图元可见。
layer.setObjsVisible([1],false);
setOnlyObjsVisible(ids, isVisible)
根据图元ID列表，设置对应图元的可见性（手动设置），若ids为空则isVisible为设置所有图层的可见性。
Name	Type	Description
ids	Array	图元ID列表。
isVisible	Boolean	是否可见。
Example:
//设置id为1和2的图元为不可见，其余图元的可见状态不变。
layer.setOnlyObjsVisible([1,2],false);
//设置id为1和2的图元为可见，其余图元的可见状态不变。
layer.setOnlyObjsVisible([1,2],true);
setPBRMaterial()
用来设置PBR材质类型
See:
PBRMaterialType
setPBRMaterialFromJSON()
用于从JSON文件中导入PBR材质，参数为JSON文件的URL。
setPointCloudGroupsVisible(groupNames, isVisible)
设置点云分组的可见性。
Name	Type	Description
groupNames	Array	图层分组名称。
isVisible	Boolean	是否可见。
Example:
//设置该图层分组名为"group1"的对象为可见状态
layer.setPointCloudGroupsVisible(["group1"],true);
setPolygonoffset(factor, units)
设置多边形偏移。
Name	Type	Description
factor	Number	偏移斜率因子，默认为0。
units	Number	偏移单位，默认为0。
Example:
layer.setPolygonoffset(-1,-1);
setQueryParameter(options)
设置属性查询参数。
Name	Type	Description
options	Object	对象具有以下属性：
Name	Type	Default	Description
url	String		optional数据服务url。
dataSourceName	String		optional数据源名称。
dataSetName	String		optional数据集名称。
isMerge	Boolean		optional该图层是否为合并数据集的，如果是则不用指定数据集名称。
hasGeometry	Boolean	false	optional属性查询返回结果是否包含几何信息。
Example:
layer.setQueryParameter({
                    url: 'localhost:8090/services/realspace/services/xxx/rest/data',
                    dataSourceName: 'xxx',
                    dataSetName: 'xxx'
});
setSelection(ids)
设置选择集，用于scene.pick时的选中。
Name	Type	Description
ids	Array	图元ID集。
setTextureEmissive()
用来设置自发光单元
See:
EmissionTextureUnit
setVisibleInViewport(index, visible)
设置图层对应视口的可见性。
Name	Type	Description
index	Number	索引。
visible	Boolean	可见性。
Throws:
DeveloperError : 索引值范围为0~3。
updateObjsColor(ids)
遍历所有图元，根据ID列表，更新对应图元颜色。
Name	Type	Description
ids	AssociativeArray	图元ID列表与颜色的关系数组。
updateObjsVisible(ids, visible)
遍历所有图元，根据ID列表，更新对应图元可见性，互斥可见关系。 如果设置[1,2]为可见，则其余图元都不可见，如果设置[1,2]为不可见。 则其余图元都可见。
Name	Type	Description
ids	AssociativeArray	图元ID列表与颜色的关系数组。
visible	Boolean	是否可见。
updateRenderState()
更新渲染状态。