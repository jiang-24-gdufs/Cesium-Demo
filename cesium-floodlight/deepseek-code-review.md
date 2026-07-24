在 SuperMap Cesium 11.2.0（基于原生 Cesium 定制）中，**你的 GLSL 着色器逻辑本身完全正确**，语法也符合 WebGL 1.0/2.0 规范（`czm_viewport.zw`、`v_textureCoordinates` 等内置变量均可正常识别）。

导致**“参数一直没有生效”**，通常不是着色器本身的问题，而是**JavaScript 端的 Uniforms 绑定、后处理阶段的添加顺序，或者阈值（Threshold）设置过高**导致的。以下是完整的排查指南和修正方案：

---

### 🔍 调试清单 1：是否漏掉了关键的 JavaScript Uniforms 绑定？
在 Cesium 中，`uniform float u_threshold;` 等变量**不会自动从 JS 读取**。如果你在实例化 `PostProcessStage` 时，没有在 `uniforms` 对象中传入这些属性，它们的值会默认为 `0` 或者 `undefined`（导致着色器失效）。

**正确实例化代码必须如下所示：**

```javascript
// 定义你的着色器代码（保持原样）
var BLOOM_SHADER = [/*你的代码*/].join('\n');

// 关键步骤：将 Uniforms 正确注入到 Stage 中
const bloomStage = new Cesium.PostProcessStage({
    name: 'main_bloom',
    fragmentShader: BLOOM_SHADER,
    uniforms: {
        // 必须赋予初始默认值，否则无法生效！
        u_threshold: 0.65,      // 亮度阈值，建议 0.4 ~ 0.8
        u_intensity: 1.2,       // 发光强度
        u_radius: 2.0,          // 模糊采样半径
        u_sigma: 2.5            // 高斯模糊平滑度
    }
});

// 一定要加入到场景的后处理管线中！
scene.postProcessStages.add(bloomStage);
```
> **调试技巧：** 在运行时打开浏览器的 F12 开发者工具，如果在 `scene.postProcessStages` 数组中能看见 `main_bloom`，说明已添加。如果 UBO 绑定失败，Cesium 通常会在控制台抛出 WebGL 编译错误（`ERROR: 0:XX: 'u_threshold' : no field`）。

---

### 🔍 调试清单 2：亮度阈值（u_threshold）设置过高
你代码中使用了 `smoothstep(u_threshold, u_threshold + 0.15, lum)` 来提取亮部。
*   如果你的场景背景是带阴影的，而发光桥梁不发光（需要配合第一步的 `CustomShader` 给桥梁赋强自发光值）。
*   如果 `u_threshold = 0.9`，那么画面中只有亮度 > 0.9 的极少数像素才会被提取出来。**如果桥梁没有达到这个亮度，泛光就会完全透明。**
*   **修复建议：** 将阈值稍微调低到 `0.65`，或者确保你配合了上一轮的 `emissive = vec3(1.0) * 3.0` 强自发光。

---

### 🔍 调试清单 3：着色器逻辑与性能的致命隐患（建议重构）
你使用的 `BLOOM_SHADER` 和 `WIDE_BLOOM_SHADER` 写法是**单 Pass 全屏暴力采样**：
*   **性能黑洞：** 主泛光是 `9×9=81` 次纹理采样，宽域泛光是 `7×7=49` 次。屏幕上的**每一个像素**都要进行 81 次从显存读纹理。这在 11.2.0 版本中，极大概率会导致**帧率骤降（降至 10帧以下）**，甚至因为执行超时被浏览器或 WebGL 降级为黑屏，让你误以为“没生效”。
*   **修正建议（高性能双 Pass 模糊）：**
    真正的泛光需要拆分成 **3个阶段**：`提取高亮 -> 水平高斯模糊 -> 垂直高斯模糊 -> 与源图叠加`。建议你将代码拆解为 3 个 `PostProcessStage` 并通过 `Cesium.PostProcessStageComposite` 组合。

**下面是可以直接替换的高性能核心逻辑模版（二段式模糊）：**

```javascript
// 1. 高亮提取（无循环，性能极好）
const brightStage = new Cesium.PostProcessStage({
    fragmentShader: `
        uniform sampler2D colorTexture;
        uniform float u_threshold;
        varying vec2 v_textureCoordinates;
        void main() {
            vec4 src = texture2D(colorTexture, v_textureCoordinates);
            float lum = dot(src.rgb, vec3(0.2126, 0.7152, 0.0722));
            float bright = smoothstep(u_threshold, u_threshold + 0.1, lum);
            gl_FragColor = vec4(src.rgb * bright, 1.0);
        }
    `,
    uniforms: { u_threshold: 0.6 }
});

// 2. 水平模糊（7x1 采样，比 9x9 快 9 倍）
const blurHStage = new Cesium.PostProcessStage({
    fragmentShader: `
        uniform sampler2D colorTexture;
        uniform float u_radius;
        varying vec2 v_textureCoordinates;
        void main() {
            vec2 texel = 1.0 / czm_viewport.zw;
            vec4 sum = vec4(0.0);
            float wSum = 0.0;
            for (int i = -3; i <= 3; i++) {
                float w = exp(-float(i*i) / 8.0);
                vec4 s = texture2D(colorTexture, v_textureCoordinates + vec2(float(i) * texel.x * u_radius, 0.0));
                sum += s * w;
                wSum += w;
            }
            gl_FragColor = sum / wSum;
        }
    `,
    uniforms: { u_radius: 1.5 }
});

// 3. 垂直模糊（7x1 采样）
const blurVStage = new Cesium.PostProcessStage({
    fragmentShader: `
        uniform sampler2D colorTexture;
        uniform float u_radius;
        varying vec2 v_textureCoordinates;
        void main() {
            vec2 texel = 1.0 / czm_viewport.zw;
            vec4 sum = vec4(0.0);
            float wSum = 0.0;
            for (int i = -3; i <= 3; i++) {
                float w = exp(-float(i*i) / 8.0);
                vec4 s = texture2D(colorTexture, v_textureCoordinates + vec2(0.0, float(i) * texel.y * u_radius));
                sum += s * w;
                wSum += w;
            }
            gl_FragColor = sum / wSum;
        }
    `,
    uniforms: { u_radius: 1.5 }
});

// 4. 最终合成（把原图和模糊后的图加在一起）
const composeStage = new Cesium.PostProcessStage({
    fragmentShader: `
        uniform sampler2D colorTexture;
        uniform sampler2D blurTexture;
        uniform float u_intensity;
        varying vec2 v_textureCoordinates;
        void main() {
            vec4 src = texture2D(colorTexture, v_textureCoordinates);
            vec4 blur = texture2D(blurTexture, v_textureCoordinates);
            gl_FragColor = vec4(src.rgb + blur.rgb * u_intensity, src.a);
        }
    `,
    uniforms: { 
        blurTexture: blurVStage.outputTexture, // 把 V 模糊的输出传进来
        u_intensity: 1.2 
    }
});

// 5. 组合成管线
const bloomComposite = new Cesium.PostProcessStageComposite([brightStage, blurHStage, blurVStage, composeStage]);
scene.postProcessStages.add(bloomComposite);
```

---

### ⚠️ 关于你代码中的 `OUTLINE_SHADER`（轮廓描边）
你最后那段 Sobel 边缘检测的写法非常标准。**但请注意：**
因为它是**全屏**检测亮度的 Sobel，地图的地形纹理、树木、水面波纹都会产生“边缘”，如果你的目地仅仅是“让桥梁发光”，Sobel 会让整个画面出现奇怪的高亮边缘杂色（特别在 SuperMap 的三维地形格网上）。**建议你单独调试出泛光效果后，再谨慎开启轮廓描边。**

**最终解决方案说明：**
请**优先检查第一步的 Uniforms 绑定**，并**警惕 9x9 暴力采样导致的崩溃**。如果应用了上述双 Pass 分阶段后处理，并且模型的 `CustomShader` 已经开启了高强度自发光，大屏上即可立刻还原你图中的沉浸式柔光发光效果。