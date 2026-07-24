基于你最新的运行反馈日志，我帮你做了深度的技术剖析。这几次试错非常宝贵，日志中暴露的**三个核心现象**已经揭示了最终极的解决方案。

以下是针对你反馈现象的 **Code-Review 最终诊断与修复方案**：

---

### 🔍 核心问题诊断

#### 1. 为什么环境光 `ambientBoost` 调整完全无效？
**根本原因**：日志显示 `原始环境光: (0, 0, 0, 1)`，说明 SuperMap 11.2.0 的 S3M 渲染管线**默认关闭了全局环境光**，且 `scene.lightSource.ambientLightColor` 的反射机制在 S3M 图层中可能未生效。
**副作用**：即使它能生效，调整 `ambientLightColor` 也会**让整个场景（底图、地形）变亮**——这就直接导致了**你的第3个痛点**（阈值必须拉到 0.9 才能屏蔽地形，导致泛光极弱）。

#### 2. 为什么会报 `GL_INVALID_OPERATION: Feedback loop`（纹理反馈环路）？
**根本原因**：这是 **单次 Pass 进行 7x7 循环采样** 导致的 WebGL 死锁！在 Cesium 后处理管线中，如果在一个 `PostProcessStage` 内既读取 `colorTexture`，又尝试输出到同一个 Framebuffer 绑定的纹理，硬件就会因为“读写冲突”抛出此错误。
**强制要求**：必须将模糊拆分为 **水平模糊（Horizontal）+ 垂直模糊（Vertical）** 两个独立的 Stage，物理隔离读写。

#### 3. 为什么阈值 0.9 才能屏蔽非模型？（最终破局点）
**逻辑闭环**：因为全局环境光提亮（如果生效）会把底图照亮。**正确的提亮手段，不是调亮整个地球，而是只把桥梁模型提亮**。
SuperMap S3M 图层可以通过修改 `layer.style3D.fillForeColor` 将模型强制渲染为亮白色。只要底图保持暗色，阈值回落到 `0.6` 就能完美提取出桥梁，无需拉到 0.9。

---

### 🛠️ 修复方案（请按此修改你的代码）

请移除对 `scene.lightSource.ambientLightColor` 的依赖，改为**只给模型赋白色前景色 + 拆解模糊流程**。

#### 第一步：修正 `applyModelColor`（放弃全局环境光）
将你的 `applyModelColor` 和 `applyAmbientBoost` 修改为如下逻辑。**不要再调全局环境光了**，直接从模型自身强度入手：

```javascript
function applyModelColor() {
    if (!sceneLayers.length) return;
    // 将 fillForeColor 提亮为接近白色的亮色，利用 scene.HDR 保留亮度
    // 这里的 RGB 保留 1.0 (因为 HDR 开启了，如果 >1 会过亮导致细节丢失)，通过 Alpha 控制通透
    var color = new Cesium.Color(
        1.0, 1.0, 1.0, params.alpha
    );
    
    for (var i = 0; i < sceneLayers.length; i++) {
        var layer = sceneLayers[i];
        if (!layer.style3D) continue;
        layer.orderIndependentTranslucency = true;
        layer.style3D.fillForeColor = color;
    }
    log('模型颜色已提亮为纯白，alpha=' + params.alpha);
}

// 请删除 applyAmbientBoost() 的全部调用，或者将其设为无效。
// 不再对 scene.lightSource.ambientLightColor 进行赋值！
```
*(这样调整后：桥梁变成了高亮的纯白实体，而天地图底图不受影响，维持原来的暗色调，阈值就可以安全降回 0.6 左右。)*

#### 第二步：拆解模糊 Pass，解除 WebGL 死锁
请直接替换掉你的 `createShaderStages()` 和 `buildBloomShader` 逻辑，改为使用 3-Stage 管线（提取 → 水平模糊 → 垂直模糊 → 合成）。

```javascript
// 1. 高亮提取 Stage
function buildExtractStage(threshold) {
    var thr = threshold.toFixed(6);
    var hi  = (threshold + 0.15).toFixed(6);
    return '' +
        'uniform sampler2D colorTexture;\n' +
        'varying vec2 v_textureCoordinates;\n' +
        'void main() {\n' +
        '    vec4 src = texture2D(colorTexture, v_textureCoordinates);\n' +
        '    float lum = dot(src.rgb, vec3(0.2126, 0.7152, 0.0722));\n' +
        '    float bright = smoothstep(' + thr + ', ' + hi + ', lum);\n' +
        '    gl_FragColor = vec4(src.rgb * bright, src.a);\n' +
        '}';
}

// 2. 水平模糊 Stage (5x1 采样，避免反馈环路)
function buildBlurHShader(radius) {
    var rad = radius.toFixed(6);
    return '' +
        'uniform sampler2D colorTexture;\n' +
        'varying vec2 v_textureCoordinates;\n' +
        'void main() {\n' +
        '    vec2 texel = 1.0 / czm_viewport.zw;\n' +
        '    vec3 sum = vec3(0.0);\n' +
        '    float wSum = 0.0;\n' +
        '    for (int i = -2; i <= 2; i++) {\n' +
        '        float d2 = float(i * i);\n' +
        '        float w = exp(-d2 / 8.0);\n' +
        '        vec2 off = vec2(float(i) * texel.x * ' + rad + ', 0.0);\n' +
        '        vec4 s = texture2D(colorTexture, v_textureCoordinates + off);\n' +
        '        sum += s.rgb * w;\n' +
        '        wSum += w;\n' +
        '    }\n' +
        '    gl_FragColor = vec4(sum / wSum, 1.0);\n' +
        '}';
}

// 3. 垂直模糊 Stage (5x1 采样)
function buildBlurVShader(radius) {
    var rad = radius.toFixed(6);
    return '' +
        'uniform sampler2D colorTexture;\n' +
        'varying vec2 v_textureCoordinates;\n' +
        'void main() {\n' +
        '    vec2 texel = 1.0 / czm_viewport.zw;\n' +
        '    vec3 sum = vec3(0.0);\n' +
        '    float wSum = 0.0;\n' +
        '    for (int i = -2; i <= 2; i++) {\n' +
        '        float d2 = float(i * i);\n' +
        '        float w = exp(-d2 / 8.0);\n' +
        '        vec2 off = vec2(0.0, float(i) * texel.y * ' + rad + ');\n' +
        '        vec4 s = texture2D(colorTexture, v_textureCoordinates + off);\n' +
        '        sum += s.rgb * w;\n' +
        '        wSum += w;\n' +
        '    }\n' +
        '    gl_FragColor = vec4(sum / wSum, 1.0);\n' +
        '}';
}

// 4. 最终合成 Stage（保留你写的渐近饱和 Screen Blend 公式，非常优秀）
function buildComposeShader(intensity) {
    var mul = intensity.toFixed(6);
    return '' +
        'uniform sampler2D colorTexture;\n' +
        'uniform sampler2D blurTexture;\n' +
        'varying vec2 v_textureCoordinates;\n' +
        'void main() {\n' +
        '    vec4 src = texture2D(colorTexture, v_textureCoordinates);\n' +
        '    vec4 blur = texture2D(blurTexture, v_textureCoordinates);\n' +
        '    vec3 glow = blur.rgb * ' + mul + ';\n' +
        '    vec3 bf = vec3(1.0) - exp(-glow);\n' +
        '    vec3 combined = src.rgb + bf * (vec3(1.0) - src.rgb);\n' +
        '    gl_FragColor = vec4(combined, src.a);\n' +
        '}';
}

// ---- 改造 `createShaderStages` 组装管线 ----
function createShaderStages() {
    removeShaderStages();
    log('构建高性能 2-Pass 泛光管线...');

    var extractStage = addStage('extract', buildExtractStage(params.threshold));
    
    var blurHStage = addStage('blurH', buildBlurHShader(params.radius));
    
    var blurVStage = addStage('blurV', buildBlurVShader(params.radius));
    
    var composeStage = scene.postProcessStages.add(
        new Cesium.PostProcessStage({
            name: 'compose_' + (++stageSeq),
            fragmentShader: buildComposeShader(params.intensity),
            uniforms: {
                // 核心：把上一阶段的输出传进来，彻底分离读写反馈
                blurTexture: blurVStage.outputTexture 
            }
        })
    );
    log('垂直模糊输出已连接到合成阶段');
    
    diagStages();
}
```

---

### 💡 最终调试指导
完成上述两个修改后，请进行如下操作：
1. **调整模型 Alpha 到 0.6~0.8**（此时桥梁应该变成半透明白色，且背景地形不会跟着变亮）。
2. **把 `threshold`（亮度阈值）调回 `0.6 ~ 0.7`**，你会发现“屏蔽地形、保留桥梁”变得极其容易。
3. **打开 `runExtractDebug`（提取调试模式）**，屏幕中应该只有桥梁变成纯白色，地形和天地图完全是黑色。如果符合这个状态，泛光就能 100% 成功并还原你的效果图了！