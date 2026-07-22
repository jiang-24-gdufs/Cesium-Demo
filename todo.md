1. 基于这个示例中的两个服务；使用双屏渲染的模式来加载；并添加可展开/收缩的panel来列举layer，并支持图层管理交互
2. 不要直接修改这个源文件，新建一个文件夹来实现需求
3. 除了viewer连动之外，还需要加上这个点击拾取通信联动，一个点击拾取另一个也要基于拾取的部件正确聚焦并高亮

我已经处理好的矢量瓦片的服务，现在提供的iServer服务相关信息：
```
名称：map-mvt-dongchesuo
别名：    
类型： 地图服务
状态： 
访问次数：142
服务地址：
 https://ct.sunrtcloud.com/iserver/services/map-mvt-dongchesuo/restjsr
地图列表：
dongchesuo
浏览于 iClient for openlayers3 (with MVT) , for MapboxGL
```
补充iServer预览使用的html： iServer.html
---
1. 完善视角重置交互
- Cesium
- OpenLayers 视角没有还原；
- 补充ol地图相机相关的信息到底部bar中
2. 属性查询联动交互逻辑补充说明：
现在属性查询都能检索到"ElementID	419754" 能不能新增一个拾取后正确定位+高亮对向场景要素的功能交互

3. 现在联动需要先固定为"ElementID"这个key
二维拾取结果
```
{
    "BottomAttitude": 3.7,
    "CategoryID": -2001300,
    "ElementID": 433053,
    "ElementName": "检查井",
    "Height": 2.2,
    "IFC_预定义类型": "",
    "IfcGUID": "3cqCv_QDb0yxvnu14fwU7V",
    "SmBimInfo": "1F-0.000#*#*#结构基础#*#*#检查井#*#*#检查井#*#*#检查井[433053]",
    "SmUserID": 0,
    "UniqueID": "e6d0ce7e-68d9-40f3-be71-e01129ef7a42-00069b9d",
    "体积": 1.354092,
    "创建的阶段": "新构造",
    "导出到_IFC": 0,
    "导出到_IFC_作为": "",
    "底部偏移": -3.1,
    "底部标高": "1F-0.000",
    "底部高程": 3.7,
    "底部高程测量": 3.7,
    "族": "检查井",
    "族与类型": "检查井 : 检查井",
    "标高": "1F-0.000",
    "类别": "结构基础",
    "类型": "检查井",
    "类型_ID": 428611,
    "长度": 2.1,
    "面积": 3.2864,
    "顶部偏移": -1,
    "顶部标高": "1F-0.000",
    "顶部高程": 5.9,
    "顶部高程测量": 5.9,
    "layer": "result_modelToRegion_smallobject@dongchesuo-merge-rvt-geo"
}
```

三维拾取结果：
```
{
    "SMID": "106",
    "SMUSERID": "0",
    "SMMAXZ": "6.07681942731142",
    "SMMINZ": "3.8763575898483396",
    "SMINDEXKEY": "AAHmEAAARaTj4fMCgD/ntR9tooyGPyIgDq0rCoA/zhtl0uaThj98AwAAAAEAAAAFAAAARaTj4fMCgD/OG2XS5pOGPyIgDq0rCoA/zhtl0uaThj8iIA6tKwqAP+e1H22ijIY/RaTj4fMCgD/ntR9tooyGP0Wk4+HzAoA/zhtl0uaThj/+",
    "SMBIMINFO": "1F-0.000#*#*#结构基础#*#*#检查井#*#*#检查井#*#*#检查井[433053]",
    "ELEMENTID": "433053",
    "ELEMENTNAME": "检查井",
    "CATEGORYID": "-2001300",
    "UNIQUEID": "e6d0ce7e-68d9-40f3-be71-e01129ef7a42-00069b9d",
    "类别": "结构基础",
    "导出到_IFC": "0",
    "IFCGUID": "3cqCv_QDb0yxvnu14fwU7V",
    "体积": "1.354092",
    "面积": "3.2864",
    "创建的阶段": "新构造",
    "顶部偏移": "-1.0",
    "底部偏移": "-3.1",
    "顶部标高": "1F-0.000",
    "底部标高": "1F-0.000",
    "标高": "1F-0.000",
    "族与类型": "检查井 : 检查井",
    "族": "检查井",
    "类型": "检查井",
    "类型_ID": "428611",
    "底部高程测量": "3.7",
    "顶部高程测量": "5.9",
    "顶部高程": "5.9",
    "长度": "2.1",
    "底部高程": "3.7",
    "启用分析模型": "true",
    "随轴网移动": "true"
}
```

现在联动的交互实际情况为：
- 拾取二维的要素，属性查询成功，三维场景只有视角切换，而且也没有正确高亮部件；
- 拾取三维的构建，属性查询成功，二维场景随缩放后脱离了原始的地图范围，高亮点打在一个没有任何意义的位置

---
首先先关注二维->三维的联动交互:
- 拾取二维联动时，三维高亮交互在高亮前应该正确清除上一次的高亮效果；高亮颜色改为黄色
- 联动定位到三维构建时，包围盒不准确，具体体现在定位到大的构建和小的构建，他们的包围盒好像是一样的；

拾取时的日志：
```
[Pick2D] 二维拾取位置: 12612339.644300, 2635438.456713
app.js:1018 [Pick2D] 命中 MVT 要素: {id: 443, 字段数: 28, 字段: 'BottomAttitude, CategoryID, ElementID, ElementName…IFC_预定义类型, IfcGUID, SmBimInfo, SmUserID, UniqueID'}
app.js:1032 [Pick2D→3D] 联动定位+高亮: ElementID="344579"
app.js:668 [Pick→3D] 查找: key="344579" (ElementID), 遍历 15 个数据集
Uncaught TypeError: SuperMap.Util.RequestJSONP.supermap_callbacks[1784627380601473] is not a function
app.js:732 [Pick→3D] 已高亮三维图层 "louban_dongchesuo@dongchesuo", SmID=1, key=344579
app.js:760 [Pick→3D] 无精确坐标，飞行定位到图层包围球, key=344579
```

doHighlight3D 应该考虑使用后处理的方式来添加轮廓高亮，并定位到瓦片；
尝试：瓦片通过root.tile遍历来获取并定位

---

三维二维高亮联动效果提升计划：
1. 二维拾取高亮添加轮廓高亮，基于feature的几何信息添加对应的轮廓
2. 三维拾取联动到二维时，坐标对应错误导致二维地图移动后已经偏离地图的中心坐标：
联动前：2D 中心:[12612297.03, 2635556.94] Z:0.0 Res:2.3887
联动后：2D 中心:[839.85, 1332.36] Z:4.0 Res:0.1493

验证是否缺少坐标转换导致坐标定位偏移
3. 在处理三维的高亮定位时，我认为应该优先使用三维相关的服务数据来做处理会更贴合实际需求，关联方法doHighlight3D；补充说明：
```
[Pick→3D] 查找: key="379531" (ElementID), 遍历 15 个数据集
sync-controller.js:127 [SyncCtrl] S3M 高亮: layer="podao_dongchesuo@dongchesuo", SmIDs=30
```
在通过key查询到数据集后，为什么这个ElementID在后续没有被使用到？为什么仅做日志使用，不应该是从这个elementid 关联到具体的三维模型中的构建对象才进行定位么，验证我的逻辑并考虑优化

---
1. 基于todo之前提供的拾取信息，应该改为uniqueid作为唯一id的字段
2. 同时uniqueid也作为三维场景中构建定位的唯一查询id；输出查询到的三维部件到日志中辅助调试
3. 二维地图中的拾取后添加的点可以考虑先隐藏；
4. 二三维拾取的cursor样式应该一致；轮廓高亮效果的基础颜色应该统一为一个颜色--以三维的颜色黄色作为高亮色

5. 全部删除使用elementid的逻辑，全部转向为uniqueid；
最佳实践：将 UNIQUEID 作为你业务逻辑里的主键（Primary Key），将 SMID 仅作为 SuperMap 内部空间索引的辅助键。
ElementID（433053）的用处：当你的业务系统需要对接 Revit 原生插件或按设计图编号检索时使用，但在 SuperMap 生态中，它不如 UNIQUEID 可靠
6. 现在只有策略D会生效，想基于构建的包围盒boundingSphere来定位而不是targetlayer 在已经知道targetLayer以及uniqueId的情况下

7. 定位包围盒位置错误
```
app.js:768 [Pick→3D] 构件无 SMSDRI 包围盒字段, UniqueID=0f2bb55d-4ddf-4a46-9e61-edf36dd6739b-00054203
app.js:742 [Pick→3D] fallback 图层包围球定位, UniqueID=0f2bb55d-4ddf-4a46-9e61-edf36dd6739b-00054203
```

8. 还原拾取三维时，二维也需要正确添加飞行动画并定位的逻辑
9. 避免在代码中出现立即执行函数，正确抽离封装；

10. 对整个cesium-openlayers-sync模块的代码进行review，并输出review文档

---

1. 由于三维场景构建比二维平面的内容更多，会存在拾取三维后，二维面没有正确的对应feature，则需要弹出一个tooltip
2. 这个通过点击二维场景的feature，正确关联到Cesium（超图）场景中三维构建的逻辑，其中飞行动画的目标（或目标位置）一直没处理好，怎么才能通过现在的信息来聚焦到这个构建呢？
3. 现在拾取三维高亮后，二维没有正确联动高亮，还原这个效果；高亮联动是双向的，必须要保留