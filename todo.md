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