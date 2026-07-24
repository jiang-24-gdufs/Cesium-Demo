# app.js Code Review — 着色器参数应用 & 目标效果匹配分析

> 审阅版本：app.js (681 lines)
> 审阅焦点：着色器参数应用逻辑、泛光效果实现、与 target.png 效果对照

---

## 1. 目标效果分析（target.png）

目标效果图中的高铁桥梁呈现以下视觉特征：
- **半透明冰玉质感**：桥梁主体呈现柔和的乳白色，可透视背后地形
- **柔和外溢泛光**：光晕沿桥梁轮廓向外扩散 2-3 个像素宽度，边缘平滑过渡
- **结构清晰可辨**：桥墩、主梁、护栏等结构层次在泛光中依然保留
- **背景不受干扰**：地形、水面等背景区域保持自然色调，无过曝
- **整体亮度适中**：模型泛光区域未出现硬边纯白（burn-out）

---

## 2. 核心缺陷

### 2.1 [P0/崩溃] `fillForeColor` 写入未定义对象

```
Cannot set properties of undefined (setting 'fillForeColor')
at applyModelColor (app.js:390:58)
```

**位置**：`applyModelColor()` 第 388-391 行

```javascript
for (var i = 0; i < sceneLayers.length; i++) {
    sceneLayers[i].orderIndependentTranslucency = true;
    sceneLayers[i].style3D.fillForeColor = color; // style3D 可能为 undefined
}
```

**原因**：部分 S3M 图层（如地形、标注等非模型图层）不具备 `style3D` 属性。未做防御判空，导致开启泛光时直接崩溃。

**修复**：

```javascript
for (var i = 0; i < sceneLayers.length; i++) {
    var layer = sceneLayers[i];
    if (!layer.style3D) continue;
    layer.orderIndependentTranslucency = true;
    layer.style3D.fillForeColor = color;
}
```

---

### 2.2 [P0/视觉] LDR 色彩空间下 HDR 颜色值被硬件截断 — 导致所有泛光参数失效

这是当前效果与目标差距巨大的**根本原因**。

**现状**：
```javascript
colorR: 2.0, colorG: 2.0, colorB: 2.0, alpha: 0.55
```

**问题链**：
1. SuperMap Cesium 11.2.0 默认 LDR 渲染管线，帧缓冲为 8-bit unsigned，颜色值被硬件 clamp 到 `[0, 1]`
2. `RGB = (2.0, 2.0, 2.0)` 写入帧缓冲后变为 `(1.0, 1.0, 1.0)` — 纯白
3. 着色器中 `luminance = dot(rgb, vec3(0.2126, 0.7152, 0.0722))` 恒等于 `1.0`
4. `smoothstep(threshold, threshold+0.15, 1.0)` 在阈值 < 0.85 时恒等于 `1.0` — **阈值滑块失效**
5. 合成公式 `src.rgb + bloom * intensity`：`1.0 + x > 1.0` 再次被 clamp — **强度增大 = 纯白**
6. Alpha 混合：`2.0 * alpha` 在 alpha > 0.5 时即超过 1.0 — **Alpha 必须极低才不白爆**

**影响**：阈值、强度、模糊半径、高斯衰减四个核心参数实质上全部失效，用户无论怎么拖动滑块都看不到预期的渐变效果。

---

### 2.3 [P0/视觉] Bloom 合成公式缺少 Tone Mapping — 高光必然溢出

```javascript
// buildBloomShader 第 139 行
'gl_FragColor = vec4(src.rgb + bloom * ' + mul + ', src.a);\n'
```

纯加法合成在 LDR 管线下完全没有安全网：只要 `bloom > 0`，结果就超过 `1.0` 被截断为纯白。

**对比 target**：目标效果中泛光区域有从亮到暗的柔和梯度过渡，说明制作方使用了某种 tone mapping 或 screen-blend 来压制高光。

---

### 2.4 [P1/精度] 着色器 Slider 精度不足、范围不合理

| 参数 | 当前 step | 当前 min | 建议 step | 建议 min |
|------|-----------|----------|-----------|----------|
| threshold | 0.01 | 0 | 0.01 | 0 | ✅ OK |
| intensity | **0.1** | 0 | **0.05** | 0 |
| radius | **0.1** | **0.5** | **0.05** | **0.1** |
| sigma | **0.1** | **0.5** | **0.05** | **0.1** |
| wideIntensity | 0.01 | 0 | 0.01 | 0 | ✅ OK |
| wideRadius | 0.01 | **0.5** | 0.01 | **0.1** |

**影响**：radius/sigma 最小值 0.5 使得用户无法设置更集中的泛光（小光晕），不利于精细调参。

---

### 2.5 [P1/Bug] 宽域泛光 sigma 硬编码

```javascript
// buildWideBloomShader 第 164 行
'float w = exp(-d2 / 12.0);\n'   // sigma² 被硬编码为 6.0
```

主泛光中 sigma 由参数动态注入，但宽域泛光中 sigma 写死为 `12.0`（对应 σ=√6≈2.45）。用户拖动"高斯衰减"滑块对宽域泛光无任何影响。

---

### 2.6 [P2/性能] 单 Pass 49 次纹理采样

7×7 高斯核在单个 fragment shader 中发出 49 次 `texture2D` 调用。在高分辨率（1920×1080 = 2M 像素 × 49 = ~1 亿次纹理采样）下，低端 GPU 或集显可能出现帧率骤降或 WebGL context lost。

**建议**（非本次修复重点）：后续可改为两 Pass 分离式高斯（水平 + 垂直），将 49 采样降为 14 采样。

---

## 3. 与目标效果对照的差距总结

| 维度 | 目标效果 | 当前实现 | 差距原因 |
|------|---------|---------|---------|
| 模型亮度 | 柔和乳白、不刺眼 | 纯白死白 | HDR 值被 LDR clamp，无 tone mapping |
| 透明度 | α ≈ 0.4-0.6 | α 必须 < 0.1 | RGB=2.0 + LDR clamp 导致混合后过曝 |
| 泛光扩散 | 柔和外溢 2-3px | 无可见泛光或全白 | 阈值失效 + 强度白爆 |
| 参数调节 | 滑块应渐变生效 | 拖动无反应 | 全被 LDR clamp 抹平 |
| 结构层次 | 桥墩主梁可辨 | 全部淹没在白色中 | 合成公式无 soft-clamp |
| 背景 | 自然不受影响 | 背景也被泛光影响 | 阈值不生效，所有像素参与泛光 |

---

## 4. 修复方案

### 方案 A：启用 Scene HDR（优先尝试）

```javascript
scene.highDynamicRange = true;
```

如果 SuperMap Cesium 11.2.0 支持，帧缓冲将升级为 float16/float32，HDR 颜色值不再被 clamp。配合 Reinhard tone mapping 即可完美匹配 target。

### 方案 B：LDR 兼容模式（Fallback）

若 HDR 不可用或导致其他渲染异常：
1. **降低 RGB 到 1.0**，纯靠 ambientBoost 提亮模型
2. **Bloom shader 中加入 Reinhard tone mapping**：`result = result / (result + 1.0)`
3. **改加法合成为 Screen Blend**：`result = 1.0 - (1.0 - src) * (1.0 - bloom * intensity)`

Screen Blend 的优势：永远不超过 1.0，高亮区域自动压缩，低亮区域保持原样。

### 方案 C：混合模式（推荐实施）

同时启用 HDR（如果可用）+ 在 shader 中始终内置 Reinhard，双保险：
- HDR 可用时：Reinhard 对 >1.0 的值做柔和压缩
- HDR 不可用时：RGB=1.0 + Screen Blend 保底

---

## 5. 实施优先级

1. **[立即修复]** `style3D` null-check 防崩溃
2. **[立即修复]** 尝试启用 HDR，bloom shader 内置 Reinhard tone mapping
3. **[立即修复]** 调整预设参数匹配 target 效果
4. **[立即修复]** 修正滑块精度和范围
5. **[立即修复]** 修复宽域泛光 sigma 硬编码
6. **[后续优化]** 分离式两 Pass 高斯优化性能
