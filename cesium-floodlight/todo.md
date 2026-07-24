1. 拆分html为css + app.js; 并正确引入；
2. 可以考虑引入Vue3 CDN
3. 深化泛光panel和效果；明确如果现在的着色器编码（从Vue组件中迁移的）不能满足需求，则考虑及时提出更找到更好的替代方案
- 增加tooltip，现在这几个参数到底是起到什么作用？什么时候生效都需要明确的提示，避免盲仔在slider-bar上拖动猜测效果
- 现在高铁模型没有发光的效果，调整着色器参数也没有正确生效；找到问题并正确修复
4. fix：
- 泛光button没有正确设置关闭的样式区别以及文本说明
---
1. Panel效果交互说明：现在只有着色器参数还不能看到调试的效果
- 泛光着色器参数一直都没有生效，需要确认这个超图Cesium着色器（版本为11.2.0）是否可以正确生效，考虑在console中添加更多的日志来协助debug
- 宽域扩散默认应该是不开启的，扩散强度和半径调整为：0.1和1.00（并考虑增加这两个参数的精度，调整slider-bar的step）
2. Tooltip被CSS截断了
3. 注释内置的bloomEffect, 这个不能满足让模型自发光的效果
---
1. fix：
 Cannot set properties of undefined (setting 'fillForeColor')
    at applyModelColor (app.js:390:58)
2. alpha透明度参数只能设置极低的参数（0.05-0.1）不然高铁模型就是纯白色
3. 着色器参数调整，看不到明确效果的情况：
- 泛光强度调大之后，会逐渐变为纯白色
- 着色器slider-bar没有把精度优化为0.01；模糊半径和高斯衰减调整min的最小值，而不是0.5

---
0. 泛光效果默认不开启，手动点击按钮才开启
1. 新增copy配置参数，复制结果为对象
2. 轮廓描边添加颜色参数
3. RGB，支持从HEX/rgb解析；如从截图中提取的color信息：203, 206, 199
4. 布局调整：color-preview和上述3新增的input在同一行
5. 补充test log：
[Floodlight] 测试着色器已移除
app.js:268 [Floodlight] 创建测试着色器（红色色调）...
app.js:268 [Floodlight] Stage 创建: test_red_96  enabled=true  ready=false
app.js:268 [Floodlight] 画面出现红色色调 → PostProcessStage 管线正常
app.js:268 [Floodlight] 画面无变化 → PostProcessStage 不可用
app.js:268 [Floodlight] --- PostProcessStages (共 2) ---
app.js:268 [Floodlight]   [0] bloom_93  enabled=true  ready=true
app.js:268 [Floodlight]   [1] test_red_96  enabled=true  ready=false
app.js:268 [Floodlight] 测试着色器已移除

[Floodlight] 提取调试开启: threshold=0.91
app.js:268 [Floodlight] 预期: 桥梁=白色, 背景=黑色
app.js:268 [Floodlight] 如果全黑 → 模型亮度不足, 请增大"环境光"或降低"亮度阈值"
app.js:268 [Floodlight] 如果全白 → 阈值过低, 请升高"亮度阈值"
app.js:268 [Floodlight] Stage 创建: extract_debug_97  enabled=true  ready=false
app.js:268 [Floodlight] --- PostProcessStages (共 2) ---
app.js:268 [Floodlight]   [0] bloom_93  enabled=true  ready=true
app.js:268 [Floodlight]   [1] extract_debug_97  enabled=true  ready=false
app.js:268 [Floodlight] 提取调试已关闭


[Floodlight] --- PostProcessStages (共 1) ---
app.js:268 [Floodlight]   [0] bloom_93  enabled=true  ready=true

执行提取调试后画面全黑；

---
1. 场景模型初始化时就比较黑，但是我调整环境光，模型也没有任何变化：
[Floodlight] HDR 渲染: ON
app.js:367 [Floodlight] 原始环境光: (0, 0, 0, 1)
app.js:367 [Floodlight] Cesium Viewer 已创建
app.js:367 [Floodlight] PostProcessStages API: OK
app.js:367 [Floodlight]   .add: function
app.js:367 [Floodlight]   .remove: function
app.js:367 [Floodlight]   .length: 0
app.js:367 [Floodlight] Cesium.PostProcessStage: function
app.js:367 [Floodlight] scene.lightSource: OK
Cesium.js:88 [Violation] 'requestAnimationFrame' handler took 63ms
:5500/favicon.ico:1  GET http://127.0.0.1:5500/favicon.ico 404 (Not Found)
app.js:367 [Floodlight] 场景加载成功, 图层数=5
app.js:367 [Floodlight]   图层[0] name=CGMX, visible=true
app.js:367 [Floodlight]   图层[1] name=JGJC, visible=true
app.js:367 [Floodlight]   图层[2] name=LB, visible=true
app.js:367 [Floodlight]   图层[3] name=Q, visible=true
app.js:367 [Floodlight]   图层[4] name=hubei1@map, visible=undefined
content_main.js:4891 This page uses Chrome's Built-In AI features (LanguageDetector)! We're always improving our models; please submit your feedback here: https://issues.chromium.org/issues/new?component=1583316

2. Fix:
[Floodlight] 泛光开启
floodlight.html:1 [.WebGL-0x58cc0010f200] GL_INVALID_OPERATION: glDrawElements: Feedback loop formed between Framebuffer and active Texture.

3. 开启泛光后避免场景中非模型的其他内容高亮，在测试时我只能把阈值拉高到0.9才能屏蔽掉场景中非模型的泛白的内容

---
1. 这个配置下，高铁模型逐渐出现白爆现象;如增加alpha和增强环境光，都会加剧；
```
{
    "colorR": 3.35,
    "colorG": 3.35,
    "colorB": 3.4,
    "alpha": 0.55,
    "ambientBoost": 0.3,
    "threshold": 0.82,
    "intensity": 1.2,
    "radius": 2.5,
    "sigma": 2.5,
    "wideEnabled": false,
    "wideIntensity": 0.06,
    "wideRadius": 3,
    "outlineEnabled": false,
    "outlineStrength": 0.3,
    "outlineColor": "#BFFFFF"
}
```

同时这个参数下调整非阈值的着色器参数不会有什么改变；

2. HEX RGB 颜色换算到模型外观参数时会不准确； 可能是由于不同的range导致换算错误
3. 继续拆分app.js，新增一个js模块保留和调参相关的内容； 把一些常量也拆分出来

---
1. 给所有的slider都添加一个对应的number-input来作为手动键入的表单元素，即把`.ctrl-val`的span改为number-input
2. 现在模型的颜色和截图的颜色有偏差，截图中偏暖白，现在场景中的模型偏黄；视角移动时，模型重叠的区域就是偏白，重叠越多越白，然后也越亮
3. 截图中也是有比较浅白色描边已经修改了target.outlineColor，开启轮廓高亮时会明显对模型很明显，需要额外微调

4. 细节微调说明：
- 预期描边的作用： 一开始我只是想给模型的整体外部轮廓加一层描边，但是实际上应用后是给所有的构件都添加的描边，这个不知道能不能改
- 开启目标预设参数后，我关闭宽域扩散和轮廓描边后，前后对比基本没有视觉差异；那这样如果仅凭模型外观参数，能调整成目标的效果么？ 必须保证专业颜色上极度接近的效果
- 感觉高铁模型的路面和桥墩比有颜色差异；还有就是在环境光下，迎光面和被光面都有视觉上的差异；不确定要不要处理统一。

---
重构说明（已经备份了核心文件）直接：
1. 描边不再需要，因为这个会导致如果视角从透明的模型看到地面影像，则是给影像添加了描边，而不是模型；这个先暂时移除
2. 宽域描边也暂时不要了，这个和泛光效果相同，并且增加了配置的复杂度
3. 基于以上信息准备对核心的内容进行瘦身，仅凭模型外观和泛光着色器来实现调出目标图效果
---
先对代码进行重构，再基于重构后的panel再去调整参数，去匹配直到和目标图的效果完全一致，注意是完全一致