// ============================================================
// app.js — 宜常高铁 · 模型泛光效果 Demo
// Vue3 Composition API + SuperMap iClient3D for Cesium 11.2.0
// ============================================================
//
// 着色器策略（v5 — LDR 模型软掩膜方案）：
//   1. HDR 强制关闭：SuperMap Cesium 11.2.0 PostProcessStage
//      在 HDR 模式触发 WebGL Feedback Loop。
//   2. fillForeColor ≤ 1.0 + 半透明 alpha：
//      在 LDR 帧缓冲中模型像素保留 < 1.0 的 headroom，
//      使泛光可以叠加可见亮度。RGB > 1.0 被硬件截断为 1.0，
//      导致 bloom 公式退化为恒等式（bloom 完全不可见）。
//   3. depthTexture 排除天空像素，并以模型填充色的归一化色相距离
//      构造软掩膜，抑制地形和影像中的高亮区域。
//   4. 亮度阈值与颜色软掩膜相乘，仅保留高置信度模型像素。
//   5. 渐近饱和合成: src + (1-exp(-glow))*(1-src)，
//      glow=0→像素不变, glow→∞→渐近1.0, LDR 安全。
//   6. isModelLayer 过滤：只对模型图层着色，跳过底图。
//   7. 仅使用 layer.brightness，绝不修改场景级 ambientLightColor。
// ============================================================

(function () {
    'use strict';

    var FL = window.Floodlight;
    var CONFIG        = FL.CONFIG;
    var PRESETS       = FL.PRESETS;
    var MODEL_SLIDERS = FL.MODEL_SLIDERS;
    var SHADER_SLIDERS = FL.SHADER_SLIDERS;
    var isModelLayer  = FL.isModelLayer;
    var parseColor    = FL.parseColor;
    var rgbToHex      = FL.rgbToHex;

    // ==================== 着色器动态构建 ====================

    var stageSeq = 0;

    var TEST_SHADER =
        'uniform sampler2D colorTexture;\n' +
        'varying vec2 v_textureCoordinates;\n' +
        'void main() {\n' +
        '    vec4 c = texture2D(colorTexture, v_textureCoordinates);\n' +
        '    gl_FragColor = vec4(c.r + 0.35, c.g * 0.7, c.b * 0.7, c.a);\n' +
        '}';

    function buildExtractDebugShader(threshold, colorR, colorG, colorB) {
        var thr = threshold.toFixed(6);
        var hi  = Math.min(1.0, threshold + 0.08).toFixed(6);
        var marker = [
            Math.max(colorR, 0.001).toFixed(6),
            Math.max(colorG, 0.001).toFixed(6),
            Math.max(colorB, 0.001).toFixed(6),
        ].join(', ');
        return '' +
            'uniform sampler2D colorTexture;\n' +
            'uniform sampler2D depthTexture;\n' +
            'varying vec2 v_textureCoordinates;\n' +
            'void main() {\n' +
            '    vec4 src = texture2D(colorTexture, v_textureCoordinates);\n' +
            '    float depth = texture2D(depthTexture, v_textureCoordinates).r;\n' +
            '    float notSky = step(0.001, 1.0 - depth);\n' +
            '    float lum = dot(src.rgb, vec3(0.2126, 0.7152, 0.0722));\n' +
            '    vec3 marker = normalize(vec3(' + marker + '));\n' +
            '    float colorDistance = distance(normalize(src.rgb + vec3(0.0001)), marker);\n' +
            '    float modelColor = 1.0 - smoothstep(0.06, 0.13, colorDistance);\n' +
            '    float warmMarker = smoothstep(0.05, 0.12, src.r - src.b);\n' +
            '    float mask = smoothstep(' + thr + ', ' + hi + ', lum) * modelColor * warmMarker * notSky;\n' +
            '    gl_FragColor = vec4(vec3(mask), 1.0);\n' +
            '}';
    }

    // 主泛光：7×7 高斯核 (49采样), 亮部提取 + 模糊 + 渐近饱和合成
    // combined = src + (1 - exp(-glow)) * (1 - src)
    function buildBloomShader(threshold, intensity, radius, sigma, colorR, colorG, colorB) {
        var s2  = (sigma * sigma * 2.0).toFixed(6);
        var thr = threshold.toFixed(6);
        var hi  = Math.min(1.0, threshold + 0.08).toFixed(6);
        var rad = radius.toFixed(6);
        var mul = intensity.toFixed(6);
        var glowColor = [
            Math.max(colorR, 0.001).toFixed(6),
            Math.max(colorG, 0.001).toFixed(6),
            Math.max(colorB, 0.001).toFixed(6),
        ].join(', ');
        return '' +
            'uniform sampler2D colorTexture;\n' +
            'uniform sampler2D depthTexture;\n' +
            'varying vec2 v_textureCoordinates;\n' +
            'void main() {\n' +
            '    vec4 src = texture2D(colorTexture, v_textureCoordinates);\n' +
            '    vec2 texel = 1.0 / czm_viewport.zw;\n' +
            '    vec3 bloom = vec3(0.0);\n' +
            '    float wSum = 0.0;\n' +
            '    vec3 marker = normalize(vec3(' + glowColor + '));\n' +
            '    for (int i = -3; i <= 3; i++) {\n' +
            '        for (int j = -3; j <= 3; j++) {\n' +
            '            vec2 uv = v_textureCoordinates + vec2(float(i), float(j)) * texel * ' + rad + ';\n' +
            '            vec4 s = texture2D(colorTexture, uv);\n' +
            '            float depth = texture2D(depthTexture, uv).r;\n' +
            '            float notSky = step(0.001, 1.0 - depth);\n' +
            '            float lum = dot(s.rgb, vec3(0.2126, 0.7152, 0.0722));\n' +
            '            float colorDistance = distance(normalize(s.rgb + vec3(0.0001)), marker);\n' +
            '            float modelColor = 1.0 - smoothstep(0.06, 0.13, colorDistance);\n' +
            '            float warmMarker = smoothstep(0.05, 0.12, s.r - s.b);\n' +
            '            float mask = smoothstep(' + thr + ', ' + hi + ', lum) * modelColor * warmMarker * notSky;\n' +
            '            float d2 = float(i * i + j * j);\n' +
            '            float w = exp(-d2 / ' + s2 + ');\n' +
            '            bloom += vec3(' + glowColor + ') * mask * w;\n' +
            '            wSum += w;\n' +
            '        }\n' +
            '    }\n' +
            '    if (wSum > 0.0) bloom /= wSum;\n' +
            '    vec3 glow = bloom * ' + mul + ';\n' +
            '    vec3 bf = vec3(1.0) - exp(-glow);\n' +
            '    vec3 combined = src.rgb + bf * (vec3(1.0) - src.rgb);\n' +
            '    gl_FragColor = vec4(combined, src.a);\n' +
            '}';
    }

    // ==================== Vue3 应用 ====================

    var vue = Vue;
    var createApp = vue.createApp;
    var ref = vue.ref;
    var reactive = vue.reactive;
    var watch = vue.watch;
    var computed = vue.computed;
    var onMounted = vue.onMounted;

    createApp({
        setup: function () {

            // ---- 响应式状态 ----
            var status = ref('正在初始化...');
            var cameraInfo = ref('');
            var bloomEnabled = ref(false);
            var sceneReady = ref(false);
            var diagLog = ref('');

            var params = reactive(Object.assign({}, PRESETS.target));

            var activeTooltip = ref('');
            var tooltipStyle = reactive({ left: '0px', top: '0px' });

            // ---- Cesium 引用（非响应式）----
            var viewer = null;
            var scene = null;
            var sceneLayers = [];
            var initialCamera = null;
            var bloomStage = null;
            var testStage = null;
            var extractDebugStage = null;
            var rebuildTimer = null;
            var savedAmbient = null;
            var modelLayerStates = [];

            // ---- 计算属性 ----
            var colorPreviewStyle = computed(function () {
                var r = Math.min(params.colorR, 1.0);
                var g = Math.min(params.colorG, 1.0);
                var b = Math.min(params.colorB, 1.0);
                return {
                    background: 'rgba(' +
                        Math.round(r * 255) + ',' +
                        Math.round(g * 255) + ',' +
                        Math.round(b * 255) + ',' +
                        params.alpha + ')',
                };
            });

            var colorInput = ref('');

            // ---- 颜色输入解析 ----
            function applyColorInput() {
                var result = parseColor(colorInput.value);
                if (!result) return;
                params.colorR = result.r;
                params.colorG = result.g;
                params.colorB = result.b;
                colorInput.value = rgbToHex(result.r, result.g, result.b);
                log('颜色输入: R=' + result.r.toFixed(4) +
                    ' G=' + result.g.toFixed(4) +
                    ' B=' + result.b.toFixed(4) +
                    ' → ' + colorInput.value);
            }

            function clampNumberParam(key, min, max) {
                var value = Number(params[key]);
                if (!Number.isFinite(value)) value = min;
                params[key] = Math.min(max, Math.max(min, value));
            }

            // ---- 复制配置 ----
            function copyConfig() {
                var obj = {
                    colorR: +params.colorR.toFixed(4),
                    colorG: +params.colorG.toFixed(4),
                    colorB: +params.colorB.toFixed(4),
                    alpha: +params.alpha.toFixed(2),
                    modelBrightness: +params.modelBrightness.toFixed(2),
                    sceneAmbient: +params.sceneAmbient.toFixed(2),
                    threshold: +params.threshold.toFixed(2),
                    intensity: +params.intensity.toFixed(2),
                    radius: +params.radius.toFixed(2),
                    sigma: +params.sigma.toFixed(2),
                };
                var text = JSON.stringify(obj, null, 4);
                if (navigator.clipboard && navigator.clipboard.writeText) {
                    navigator.clipboard.writeText(text).then(function () {
                        status.value = '配置已复制到剪贴板';
                        log('配置已复制');
                    }, function () { fallbackCopy(text); });
                } else {
                    fallbackCopy(text);
                }
            }

            function fallbackCopy(text) {
                var ta = document.createElement('textarea');
                ta.value = text;
                ta.style.cssText = 'position:fixed;left:-9999px';
                document.body.appendChild(ta);
                ta.select();
                try {
                    document.execCommand('copy');
                    status.value = '配置已复制到剪贴板';
                    log('配置已复制(fallback)');
                } catch (_) {
                    status.value = '复制失败，请查看控制台';
                    console.log(text);
                }
                document.body.removeChild(ta);
            }

            // ---- 诊断日志 ----
            function log(msg) {
                var ts = new Date().toLocaleTimeString();
                var line = '[' + ts + '] ' + msg;
                diagLog.value = line + '\n' + diagLog.value;
                console.log('[Floodlight] ' + msg);
            }

            // ---- Tooltip ----
            function showTip(e, text) {
                if (!text) return;
                var rect = e.currentTarget.getBoundingClientRect();
                var tipW = 260;
                var x = rect.left - tipW - 12;
                if (x < 10) x = rect.right + 12;
                var y = rect.top - 8;
                if (y < 10) y = 10;
                tooltipStyle.left = x + 'px';
                tooltipStyle.top = y + 'px';
                activeTooltip.value = text;
            }

            function hideTip() {
                activeTooltip.value = '';
            }

            // ---- 初始化 Cesium ----
            function initCesium() {
                Cesium.Ellipsoid.WGS84 = Object.freeze(
                    new Cesium.Ellipsoid(6378137.0, 6378137.0, 6356752.3142451793)
                );

                if (Cesium.MemoryManager) {
                    try {
                        Cesium.MemoryManager.showMemoryInfo(true);
                        Cesium.MemoryManager.setMaxMemory(16384);
                    } catch (_) {}
                }

                viewer = new Cesium.Viewer('cesiumContainer', {
                    infoBox: false,
                    selectionIndicator: false,
                    shouldAnimate: true,
                    navigation: false,
                    shadows: true,
                    showRenderLoopErrors: false,
                });
                window.viewer = viewer;

                viewer.imageryLayers.addImageryProvider(
                    new Cesium.TiandituImageryProvider({
                        mapStyle: Cesium.TiandituMapsStyle.IMG_C,
                        token: CONFIG.tiandituToken,
                        maximumLevel: 17,
                    })
                );

                viewer.clock.currentTime = Cesium.JulianDate.fromDate(
                    new Date('2024-12-09T06:19:00Z')
                );

                scene = viewer.scene;

                // HDR 在 SuperMap Cesium 11.2.0 下触发 Feedback Loop
                scene.highDynamicRange = false;
                log('HDR 渲染: OFF (SuperMap 11.2.0 兼容模式)');

                if (scene.lightSource && scene.lightSource.ambientLightColor) {
                    savedAmbient = scene.lightSource.ambientLightColor.clone();
                    log('原始环境光: ' + savedAmbient.toString());
                }

                log('Cesium Viewer 已创建');
                log('PostProcessStages API: ' +
                    (scene.postProcessStages ? 'OK' : 'NOT FOUND'));
                if (scene.postProcessStages) {
                    log('  .add: ' + typeof scene.postProcessStages.add);
                    log('  .remove: ' + typeof scene.postProcessStages.remove);
                    log('  .length: ' + scene.postProcessStages.length);
                }
                log('Cesium.PostProcessStage: ' + (typeof Cesium.PostProcessStage));
                log('scene.lightSource: ' + (scene.lightSource ? 'OK' : 'NOT FOUND'));

                scene.postRender.addEventListener(function () {
                    var cp = scene.camera.positionCartographic;
                    cameraInfo.value =
                        '经度:' + Cesium.Math.toDegrees(cp.longitude).toFixed(6) +
                        ' 纬度:' + Cesium.Math.toDegrees(cp.latitude).toFixed(6) +
                        ' 高度:' + cp.height.toFixed(1) + 'm';
                });

                loadScene();
            }

            function loadScene() {
                status.value = '正在加载场景...';
                try {
                    var p = scene.open(CONFIG.sceneUrl);
                    Cesium.when(p, function (layers) {
                        sceneLayers = layers;
                        sceneReady.value = true;
                        status.value = '场景加载完成，共 ' + layers.length + ' 个图层';
                        log('场景加载成功, 图层数=' + layers.length);

                        for (var i = 0; i < layers.length; i++) {
                            var l = layers[i];
                            var props = [];
                            if ('brightness' in l) props.push('brightness=' + l.brightness);
                            if ('style3D' in l) props.push('style3D=OK');
                            if ('selectColorType' in l) props.push('selectColorType=' + l.selectColorType);
                            props.push('isModel=' + isModelLayer(l));
                            log('  图层[' + i + '] name=' +
                                (l._name || l.name || '?') +
                                ', visible=' + l.visible +
                                ', ' + props.join(', '));
                        }

                        modelLayerStates = [];
                        for (var j = 0; j < layers.length; j++) {
                            var modelLayer = layers[j];
                            if (!isModelLayer(modelLayer) || !modelLayer.style3D) continue;
                            modelLayerStates.push({
                                layer: modelLayer,
                                fillForeColor: modelLayer.style3D.fillForeColor &&
                                    modelLayer.style3D.fillForeColor.clone
                                    ? modelLayer.style3D.fillForeColor.clone()
                                    : modelLayer.style3D.fillForeColor,
                                brightness: modelLayer.brightness,
                                orderIndependentTranslucency:
                                    modelLayer.orderIndependentTranslucency,
                            });
                        }

                        initialCamera = {
                            destination: scene.camera.position.clone(),
                            orientation: {
                                heading: scene.camera.heading,
                                pitch: scene.camera.pitch,
                                roll: scene.camera.roll,
                            },
                        };
                    }, function (err) {
                        status.value = '场景加载失败: ' + (err.message || err);
                        log('ERROR 场景加载失败: ' + (err.message || err));
                    });
                } catch (e) {
                    status.value = '场景打开异常: ' + (e.message || e);
                    log('ERROR: ' + e.message);
                }
            }

            // ---- 模型外观 + 亮度控制 ----
            function applyModelColor() {
                if (!sceneLayers.length) return;
                var color = new Cesium.Color(
                    params.colorR, params.colorG, params.colorB, params.alpha
                );
                var modelCount = 0;
                for (var i = 0; i < sceneLayers.length; i++) {
                    var layer = sceneLayers[i];
                    if (!isModelLayer(layer) || !layer.style3D) continue;
                    try {
                        layer.orderIndependentTranslucency = true;
                        layer.style3D.fillForeColor = color;
                        modelCount++;
                    } catch (e) {
                        log('WARN 模型图层着色失败: ' +
                            (layer._name || layer.name || i) + ' - ' + e.message);
                    }
                }

                applyBrightness();
                applySceneAmbient();

                var ldrWarn = (params.colorR > 1 || params.colorG > 1 || params.colorB > 1)
                    ? ' ⚠️ RGB>1.0 被LDR截断' : '';
                log('模型颜色: rgba(' +
                    params.colorR.toFixed(2) + ', ' +
                    params.colorG.toFixed(2) + ', ' +
                    params.colorB.toFixed(2) + ', ' +
                    params.alpha.toFixed(2) + ')' +
                    ' [' + modelCount + ' 个模型图层]' + ldrWarn);
            }

            function applyBrightness() {
                var b = params.modelBrightness;
                var applied = [];

                for (var i = 0; i < sceneLayers.length; i++) {
                    var layer = sceneLayers[i];
                    if (!isModelLayer(layer)) continue;
                    try {
                        if ('brightness' in layer) {
                            layer.brightness = b;
                            applied.push('layer.brightness');
                        }
                    } catch (_) {}
                }

                log('亮度控制: ' + b.toFixed(2) +
                    ' (' + (applied.length ? applied.join('+') : '无可用 API') + ')');
            }

            function applySceneAmbient() {
                if (!scene.lightSource || !savedAmbient) return;
                var factor = params.sceneAmbient;
                scene.lightSource.ambientLightColor = new Cesium.Color(
                    savedAmbient.red * factor,
                    savedAmbient.green * factor,
                    savedAmbient.blue * factor,
                    savedAmbient.alpha
                );
                log('场景环境光: ' + factor.toFixed(2) + '× 原始值');
            }

            function restoreModelColor() {
                for (var i = 0; i < modelLayerStates.length; i++) {
                    var state = modelLayerStates[i];
                    var layer = state.layer;
                    try {
                        if (layer.style3D) {
                            layer.style3D.fillForeColor = state.fillForeColor &&
                                state.fillForeColor.clone
                                ? state.fillForeColor.clone()
                                : state.fillForeColor;
                        }
                        layer.orderIndependentTranslucency =
                            state.orderIndependentTranslucency;
                        if ('brightness' in layer) layer.brightness = state.brightness;
                    } catch (_) {}
                }
                if (scene.lightSource && savedAmbient) {
                    scene.lightSource.ambientLightColor = savedAmbient.clone();
                }
            }

            // ---- Stage 管理 ----
            function addStage(name, shaderSrc) {
                var fullName = name + '_' + (++stageSeq);
                try {
                    var stage = scene.postProcessStages.add(
                        new Cesium.PostProcessStage({
                            name: fullName,
                            fragmentShader: shaderSrc,
                        })
                    );
                    log('Stage 创建: ' + fullName +
                        '  enabled=' + stage.enabled +
                        '  ready=' + stage.ready);
                    return stage;
                } catch (e) {
                    log('ERROR Stage [' + fullName + ']: ' + e.message);
                    return null;
                }
            }

            function removeStage(stage) {
                if (!stage) return;
                try { scene.postProcessStages.remove(stage); } catch (_) {}
            }

            // ---- 着色器创建/销毁 ----
            function createShaderStages() {
                removeShaderStages();

                log('构建主泛光(7x7): thr=' + params.threshold +
                    ' int=' + params.intensity +
                    ' rad=' + params.radius +
                    ' sig=' + params.sigma);

                var src = buildBloomShader(
                    params.threshold, params.intensity,
                    params.radius, params.sigma,
                    params.colorR, params.colorG, params.colorB
                );
                bloomStage = addStage('bloom', src);

                diagStages();
            }

            function removeShaderStages() {
                removeStage(bloomStage);
                bloomStage = null;
            }

            function scheduleRebuild() {
                if (rebuildTimer) clearTimeout(rebuildTimer);
                rebuildTimer = setTimeout(function () {
                    if (bloomEnabled.value) createShaderStages();
                }, 150);
            }

            // ---- 诊断 ----
            function diagStages() {
                if (!scene || !scene.postProcessStages) return;
                var col = scene.postProcessStages;
                var n = col.length;
                log('--- PostProcessStages (共 ' + n + ') ---');
                for (var i = 0; i < n; i++) {
                    var s = col.get(i);
                    log('  [' + i + '] ' + (s.name || '?') +
                        '  enabled=' + s.enabled +
                        '  ready=' + s.ready);
                }
            }

            // ---- 测试着色器 ----
            function runTestShader() {
                if (testStage) {
                    removeStage(testStage); testStage = null;
                    status.value = '测试着色器已关闭';
                    log('测试着色器已移除');
                    return;
                }
                log('创建测试着色器（红色色调）...');
                testStage = addStage('test_red', TEST_SHADER);
                if (testStage) {
                    status.value = '测试着色器 ON — 画面应出现红色色调';
                    log('画面出现红色色调 → PostProcessStage 管线正常');
                    log('画面无变化 → PostProcessStage 不可用');
                } else {
                    status.value = '测试着色器创建失败';
                }
                diagStages();
            }

            // ---- 亮度提取调试 ----
            function runExtractDebug() {
                if (extractDebugStage) {
                    removeStage(extractDebugStage); extractDebugStage = null;
                    status.value = '提取调试已关闭';
                    log('提取调试已关闭');
                    return;
                }
                var thr = params.threshold;
                log('提取调试开启: threshold=' + thr);
                log('预期: 桥梁=白色, 背景=黑色');
                log('如果全黑 → 模型亮度不足, 请增大"模型亮度"或降低"亮度阈值"');
                log('如果全白 → 阈值过低, 请升高"亮度阈值"');

                var src = buildExtractDebugShader(
                    thr, params.colorR, params.colorG, params.colorB
                );
                extractDebugStage = addStage('extract_debug', src);
                if (extractDebugStage) {
                    status.value = '提取调试 ON — 白=捕获 黑=未捕获 (期望桥梁白色)';
                } else {
                    status.value = '提取调试着色器创建失败';
                }
                diagStages();
            }

            // ---- 总控 ----
            function toggleBloom() {
                if (bloomEnabled.value) {
                    bloomEnabled.value = false;
                    restoreModelColor();
                    removeShaderStages();
                    status.value = '泛光已关闭';
                    log('泛光关闭');
                } else {
                    if (!sceneLayers.length) {
                        status.value = '场景尚未加载完成';
                        return;
                    }
                    bloomEnabled.value = true;
                    applyModelColor();
                    createShaderStages();
                    status.value = '泛光已开启（自定义着色器 7×7）';
                    log('泛光开启');
                }
            }

            // ---- 预设 ----
            function applyPreset(name) {
                var preset = PRESETS[name];
                if (!preset) return;
                Object.assign(params, preset);
                status.value = name === 'target' ? '已应用目标效果预设' : '已重置为默认参数';
                log('应用预设: ' + name);
            }

            function resetView() {
                if (initialCamera) {
                    scene.camera.flyTo({
                        destination: initialCamera.destination,
                        orientation: initialCamera.orientation,
                        duration: 1.5,
                    });
                    status.value = '已复位视角';
                }
            }

            function formatVal(v) {
                return Number(v).toFixed(2);
            }

            // ---- Watchers ----

            watch(
                function () {
                    return [params.colorR, params.colorG, params.colorB,
                            params.alpha, params.modelBrightness,
                            params.sceneAmbient];
                },
                function () {
                    if (!bloomEnabled.value) return;
                    applyModelColor();
                    // 泛光软掩膜依赖当前模型颜色。
                    scheduleRebuild();
                }
            );

            watch(
                function () {
                    return [params.threshold, params.intensity, params.radius,
                            params.sigma];
                },
                function () {
                    if (bloomEnabled.value) scheduleRebuild();
                }
            );

            // ---- 生命周期 ----
            onMounted(function () {
                initCesium();
            });

            // ---- 模板绑定 ----
            return {
                status: status,
                cameraInfo: cameraInfo,
                bloomEnabled: bloomEnabled,
                sceneReady: sceneReady,
                diagLog: diagLog,
                params: params,
                colorPreviewStyle: colorPreviewStyle,
                colorInput: colorInput,
                activeTooltip: activeTooltip,
                tooltipStyle: tooltipStyle,

                MODEL_SLIDERS: MODEL_SLIDERS,
                SHADER_SLIDERS: SHADER_SLIDERS,

                toggleBloom: toggleBloom,
                applyPreset: applyPreset,
                resetView: resetView,
                formatVal: formatVal,
                showTip: showTip,
                hideTip: hideTip,
                runTestShader: runTestShader,
                runExtractDebug: runExtractDebug,
                diagStages: function () { diagStages(); },
                applyColorInput: applyColorInput,
                clampNumberParam: clampNumberParam,
                copyConfig: copyConfig,
            };
        },
    }).mount('#app');
})();
