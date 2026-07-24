非常理解你的困境。你现在遇到的问题（调整阈值没反应、调高强度就成纯白、Alpha必须极低不然全白）并不是你的代码逻辑有误，而是 **SuperMap Cesium 11.2.0 在 LDR（低动态范围）色彩空间下的固有特性**与你的 HDR 参数配置产生了冲突。

以下是造成此现象的**根本原因**以及**立即生效的修正方案**。

---

### 🔍 为什么会出现这些现象？（根因剖析）

1. **为什么 `Alpha` 参数极低才有效，稍高就纯白？**
   你将模型的 `colorR/G/B` 设置为了 `2.0`（HDR 值）。但在默认的 LDR 渲染流程中，像素亮度超过 `1.0` 会被**硬件强制截断（Clamp）到 `1.0`**。当 `Alpha=0.55` 时，强烈的白色像素叠加在地图上，直接达到了 `1.0`，所以看起来是纯白。只有把 `Alpha` 降到 `0.05-0.1`，混合后的像素亮度才能降到 `1.0` 以下，避免硬件截断。
2. **为什么调整 `Threshold`（亮度阈值）几乎看不到变化？**
   因为颜色值被截断到了 `1.0`。着色器中的 `lum`（亮度）也就固定成了 `1.0`。如果你的阈值 `threshold` 设为 `0.6`，那么 `smoothstep` 计算出的明亮系数永远是 `1.0`。**这意味着无论你怎么调阈值，模型的 100% 像素都被判定为“高亮像素”进行全屏模糊**，所以你感觉不到变化。
3. **为什么调大 `Intensity`（泛光强度）会变成纯白？**
   合成公式是 `src.rgb + bloom * intensity`。原本 `src` 已经被截断到了 `1.0`，如果 `intensity` 再大于 `1.0`，浮点数加法就会爆掉，导致画面出现大面积刺眼的纯白色块。

---

### 🛠️ 立即修正方案（代码级改动）

你只需要做**三处改动**，就可以完美解决上述所有问题：

#### 改动一：强制开启 Scene 的 HDR 渲染和色调映射（避免数值截断）
在 `initCesium()` 函数中创建完 Viewer 之后，**必须**加上这两行，让颜色值能顺利浮动在 `2.0` 而不会被硬件截断。

```javascript
// 在创建 viewer 之后立刻设置
viewer.scene.highDynamicRange = true;
// 开启 Cesium 自带的色调映射，防止高光溢出时死白
viewer.scene.toneMapping = Cesium.ToneMapping.ACES; 
viewer.scene.toneMappingExposure = 1.0;
```
*⚠️ 注意：开启 HDR 后，曝光度可能会略有变化，你可以通过调节 `toneMappingExposure` 的值（0.5 ~ 2.0）来微调画面整体亮度。*

#### 改动二：重构 `buildBloomShader` 的合成公式，防止强度爆表
目前的直接加法太暴力。请将你的 `buildBloomShader` 函数中的最后一行 `gl_FragColor` 计算替换为**线性插值 + Reinhard 色调映射**，防止高光溢出：

**替换 `buildBloomShader` 里的这部分：**
```javascript
        // 旧代码：
        // if (wSum > 0.0) bloom /= wSum;
        // gl_FragColor = vec4(src.rgb + bloom * ' + mul + ', src.a);

        // 👇 替换为以下新代码：
        '    if (wSum > 0.0) bloom /= wSum;\n' +
        '    vec3 bloomFinal = src.rgb + bloom * ' + mul + ';\n' +
        // 使用 Reinhard 色调映射将 HDR 亮部压回 [0, 1] 区间，防止变成纯白
        '    bloomFinal = bloomFinal / (bloomFinal + vec3(1.0));\n' +
        '    gl_FragColor = vec4(bloomFinal, src.a);\n' +
        '}';
```

#### 改动三：把色值从 `2.0` 降下来，通过环境光提亮
既然颜色设为 `2.0` 会导致贴图完全发白、Alpha 失效，**目标效果图中那种高亮透明的白，不应该靠把物体本身颜色拉爆来实现**，而是应该靠泛光算法来提取。

建议你将 `PRESETS.target` 和 `PRESETS.defaults` 里的颜色配置修改为：
```javascript
// 建议值：保持物体原本的白色，但不要过爆
colorR: 1.0, colorG: 1.0, colorB: 1.0, alpha: 0.45, // 颜色改回 1.0
ambientBoost: 2.5, // 环境光亮度提高
threshold: 0.65, // 稍微提高阈值，过滤掉地形
intensity: 1.5,
radius: 3.0,
sigma: 3.0,
```
**解释**：把模型颜色固定在 `1.0`，配合 `ambientBoost: 2.5` 的环境光，画面并不会变暗。因为开启 HDR 后，你的 `bloom` 渲染方程能提取 `1.0` 亮度的纯白部分，并把它们放大。这样**既保留了 Alpha 透明度平滑变化的能力，又有非常饱满的发光泛光效果**。

---

### 💡 附加建议：为什么你之前的 7×7 采样还是会卡？

你之前的代码采用了单 Pass 里面 **7×7 (49次纹理采样)** 的循环逻辑。
虽然不一定会卡爆，但在开启 HDR 且使用高分辨率屏幕时，**这种在每个像素上跑 `for` 循环的做法在 WebGL 中依然是非常消耗 GPU 的。**
**终极优化建议：** 既然你现在的代码是动态构建字符串，如果要量产或流畅运行，建议直接取消 `buildBloomShader` 里的 49次采样循环，**只用 5 个纹理采样 + 1 个整体模糊**，或者利用 `czm_material` 内置函数。但对于你的紧急演示需求，只要加了上述的**HDR + 色调映射**和**降低颜色值**，目前勉强可以跑通。

**总结操作顺序：**
1. 确保在 `initCesium` 里加上了 `scene.highDynamicRange = true;`。
2. 把模型基础 R/G/B 改成 `1.0`（而不是 2.0）。
3. 把合成公式改成 `bloomFinal = bloomFinal / (bloomFinal + vec3(1.0));`。
4. 重新加载页面，把面板上的 `AmbientBoost`（环境光）拉到最大，这时候调整 `Threshold` 和 `Intensity` 就可以看到极其明显的渐变泛光效果了。