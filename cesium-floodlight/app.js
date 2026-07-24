// ============================================================
// app.js — 宜常高铁 · 模型泛光效果 Demo
// Vue3 Composition API + SuperMap iClient3D for Cesium 11.2.0
// ============================================================
//
// 着色器策略：
//   SuperMap iClient3D Cesium 11.x 的 PostProcessStage 对自定义
//   uniform 支持不稳定（回调函数/命令式赋值均可能失效）。
//   因此本实现采用 **动态构建着色器源码** 的方式——将参数作为
//   GLSL 常量内联到 fragmentShader 字符串中，参数变化时销毁
//   旧 Stage 并创建新 Stage（带 debounce）。这与 Vue 组件中
//   硬编码着色器的做法一致，确保兼容。
// ============================================================

(function () {
    'use strict';

    // ==================== 配置 ====================

    var CONFIG = {
        sceneUrl: 'https://ct.sunrtcloud.com/iserver/services/3D-ycgt_20260414/rest/realspace',
        terrainUrl: 'https://ct.sunrtcloud.com/iserver/services/3D-local3DCache-terrain_20260415/rest/realspace/datas/dixin',
        tiandituToken: 'd044a50924a839d21691035e52fe43a5',
    };

    // ==================== 预设 ====================

    var PRESETS = {
        target: {
            colorR: 1.0, colorG: 1.0, colorB: 1.0, alpha: 0.55,
            threshold: 0.35, intensity: 2.5, radius: 3.5, sigma: 3.0,
            wideEnabled: false, wideIntensity: 0.10, wideRadius: 1.00,
            outlineEnabled: false, outlineStrength: 0.6,
        },
        defaults: {
            colorR: 1.0, colorG: 1.0, colorB: 1.0, alpha: 0.55,
            threshold: 0.35, intensity: 2.5, radius: 3.5, sigma: 3.0,
            wideEnabled: false, wideIntensity: 0.10, wideRadius: 1.00,
            outlineEnabled: false, outlineStrength: 0.6,
        },
    };

    // ==================== 滑块定义 ====================

    var MODEL_SLIDERS = [
        { key: 'colorR', label: '颜色 R', min: 0, max: 1, step: 0.01,
          tip: '模型填充颜色的红色分量\n与 G/B 共同决定泛光底色\n全白(1,1,1) = 白色泛光\n⚡ 实时生效（改变图层 fillForeColor）' },
        { key: 'colorG', label: '颜色 G', min: 0, max: 1, step: 0.01,
          tip: '模型填充颜色的绿色分量\n⚡ 实时生效' },
        { key: 'colorB', label: '颜色 B', min: 0, max: 1, step: 0.01,
          tip: '模型填充颜色的蓝色分量\n⚡ 实时生效' },
        { key: 'alpha', label: '透明度', min: 0.05, max: 1, step: 0.01,
          tip: '模型半透明度 (style3D.fillForeColor.alpha)\n值越低越通透、泛光更柔和\n值越高越不透明\n建议: 0.3 ~ 0.7\n⚡ 实时生效' },
    ];

    var SHADER_SLIDERS = [
        { key: 'threshold', label: '亮度阈值', min: 0, max: 1, step: 0.01,
          tip: '像素亮度(luminance)超过此值才参与泛光\n↓ 降低 → 更多区域发光（含背景）\n↑ 升高 → 仅最亮部分发光\n建议: 0.2 ~ 0.5\n⚡ 松手后 ~150ms 重建着色器生效' },
        { key: 'intensity', label: '泛光强度', min: 0, max: 6, step: 0.1,
          tip: '泛光结果叠加到原图的乘数\n0 = 无泛光效果\n值越大发光越强烈\n建议: 1.0 ~ 3.0\n⚡ 松手后 ~150ms 重建着色器生效' },
        { key: 'radius', label: '模糊半径', min: 0.5, max: 8, step: 0.1,
          tip: '高斯核每步的纹素偏移倍率\n控制泛光向外扩散的像素距离\n值越大光晕越宽\n建议: 2.0 ~ 5.0\n⚡ 松手后 ~150ms 重建着色器生效' },
        { key: 'sigma', label: '高斯衰减', min: 0.5, max: 8, step: 0.1,
          tip: '高斯核的标准差 σ\n控制权重随距离的衰减速度\nσ越大 → 边缘越平滑柔和\nσ越小 → 中心集中、泛光锐利\n建议: 2.0 ~ 5.0\n⚡ 松手后 ~150ms 重建着色器生效' },
    ];

    var WIDE_SLIDERS = [
        { key: 'wideIntensity', label: '扩散强度', min: 0, max: 3, step: 0.01,
          tip: '二次泛光（宽域扩散）的叠加强度\n在主泛光基础上做更大范围扩散\n产生远距离柔和光晕\n⚡ 松手后 ~150ms 重建着色器生效' },
        { key: 'wideRadius', label: '扩散半径', min: 0.5, max: 12, step: 0.01,
          tip: '二次泛光的采样步长倍率\n值越大光晕延伸越远\n过大可能导致可见的采样锯齿\n建议: 1.0 ~ 8.0\n⚡ 松手后 ~150ms 重建着色器生效' },
    ];

    // ==================== 着色器动态构建 ====================

    var stageSeq = 0;

    // 测试着色器：给画面叠加红色色调，用于验证 PostProcessStage 本身可用
    var TEST_SHADER =
        'uniform sampler2D colorTexture;\n' +
        'varying vec2 v_textureCoordinates;\n' +
        'void main() {\n' +
        '    vec4 c = texture2D(colorTexture, v_textureCoordinates);\n' +
        '    gl_FragColor = vec4(c.r + 0.35, c.g * 0.7, c.b * 0.7, c.a);\n' +
        '}';

    function buildBloomShader(threshold, intensity, radius, sigma) {
        var s2  = (sigma * sigma * 2.0).toFixed(6);
        var thr = threshold.toFixed(6);
        var hi  = (threshold + 0.15).toFixed(6);
        var rad = radius.toFixed(6);
        var mul = intensity.toFixed(6);
        return '' +
            'uniform sampler2D colorTexture;\n' +
            'varying vec2 v_textureCoordinates;\n' +
            'void main() {\n' +
            '    vec4 src = texture2D(colorTexture, v_textureCoordinates);\n' +
            '    vec2 texel = 1.0 / czm_viewport.zw;\n' +
            '    vec3 bloom = vec3(0.0);\n' +
            '    float wSum = 0.0;\n' +
            '    for (int i = -4; i <= 4; i++) {\n' +
            '        for (int j = -4; j <= 4; j++) {\n' +
            '            vec2 off = vec2(float(i), float(j)) * texel * ' + rad + ';\n' +
            '            vec4 s = texture2D(colorTexture, v_textureCoordinates + off);\n' +
            '            float lum = dot(s.rgb, vec3(0.2126, 0.7152, 0.0722));\n' +
            '            float bright = smoothstep(' + thr + ', ' + hi + ', lum);\n' +
            '            float d2 = float(i * i + j * j);\n' +
            '            float w = exp(-d2 / ' + s2 + ');\n' +
            '            bloom += s.rgb * bright * w;\n' +
            '            wSum += bright * w;\n' +
            '        }\n' +
            '    }\n' +
            '    if (wSum > 0.0) bloom /= wSum;\n' +
            '    gl_FragColor = vec4(src.rgb + bloom * ' + mul + ', src.a);\n' +
            '}';
    }

    function buildWideBloomShader(threshold, intensity, radius) {
        var thr = threshold.toFixed(6);
        var hi  = (threshold + 0.20).toFixed(6);
        var rad = radius.toFixed(6);
        var mul = intensity.toFixed(6);
        return '' +
            'uniform sampler2D colorTexture;\n' +
            'varying vec2 v_textureCoordinates;\n' +
            'void main() {\n' +
            '    vec4 src = texture2D(colorTexture, v_textureCoordinates);\n' +
            '    vec2 texel = 1.0 / czm_viewport.zw;\n' +
            '    vec3 bloom = vec3(0.0);\n' +
            '    float wSum = 0.0;\n' +
            '    for (int i = -3; i <= 3; i++) {\n' +
            '        for (int j = -3; j <= 3; j++) {\n' +
            '            vec2 off = vec2(float(i), float(j)) * texel * ' + rad + ';\n' +
            '            vec4 s = texture2D(colorTexture, v_textureCoordinates + off);\n' +
            '            float lum = dot(s.rgb, vec3(0.2126, 0.7152, 0.0722));\n' +
            '            float bright = smoothstep(' + thr + ', ' + hi + ', lum);\n' +
            '            float d2 = float(i * i + j * j);\n' +
            '            float w = exp(-d2 / 12.0);\n' +
            '            bloom += s.rgb * bright * w;\n' +
            '            wSum += bright * w;\n' +
            '        }\n' +
            '    }\n' +
            '    if (wSum > 0.0) bloom /= wSum;\n' +
            '    gl_FragColor = vec4(src.rgb + bloom * ' + mul + ', src.a);\n' +
            '}';
    }

    function buildOutlineShader(strength) {
        var str = strength.toFixed(6);
        return '' +
            'uniform sampler2D colorTexture;\n' +
            'varying vec2 v_textureCoordinates;\n' +
            'float lum(vec2 uv) {\n' +
            '    vec4 s = texture2D(colorTexture, uv);\n' +
            '    return dot(s.rgb, vec3(0.2126, 0.7152, 0.0722));\n' +
            '}\n' +
            'void main() {\n' +
            '    vec4 src = texture2D(colorTexture, v_textureCoordinates);\n' +
            '    vec2 ts = 1.5 / czm_viewport.zw;\n' +
            '    float tl = lum(v_textureCoordinates + vec2(-ts.x,  ts.y));\n' +
            '    float t  = lum(v_textureCoordinates + vec2(  0.0,  ts.y));\n' +
            '    float tr = lum(v_textureCoordinates + vec2( ts.x,  ts.y));\n' +
            '    float l  = lum(v_textureCoordinates + vec2(-ts.x,   0.0));\n' +
            '    float r  = lum(v_textureCoordinates + vec2( ts.x,   0.0));\n' +
            '    float bl = lum(v_textureCoordinates + vec2(-ts.x, -ts.y));\n' +
            '    float b  = lum(v_textureCoordinates + vec2(  0.0, -ts.y));\n' +
            '    float br = lum(v_textureCoordinates + vec2( ts.x, -ts.y));\n' +
            '    float gx = (tr + 2.0 * r + br) - (tl + 2.0 * l + bl);\n' +
            '    float gy = (bl + 2.0 * b + br) - (tl + 2.0 * t + tr);\n' +
            '    float edge = clamp(sqrt(gx * gx + gy * gy), 0.0, 1.0);\n' +
            '    vec3 edgeCol = vec3(0.75, 1.0, 1.0);\n' +
            '    gl_FragColor = vec4(src.rgb + edgeCol * edge * ' + str + ', src.a);\n' +
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

            var params = reactive(Object.assign({}, PRESETS.defaults));

            // Tooltip 状态
            var activeTooltip = ref('');
            var tooltipStyle = reactive({ left: '0px', top: '0px' });

            // ---- Cesium 引用（非响应式）----
            var viewer = null;
            var scene = null;
            var sceneLayers = [];
            var initialCamera = null;
            var bloomStage = null;
            var wideBloomStage = null;
            var outlineStage = null;
            var testStage = null;
            var rebuildTimer = null;

            // ---- 计算属性 ----
            var colorPreviewStyle = computed(function () {
                return {
                    background: 'rgba(' +
                        Math.round(params.colorR * 255) + ',' +
                        Math.round(params.colorG * 255) + ',' +
                        Math.round(params.colorB * 255) + ',' +
                        params.alpha + ')',
                };
            });

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

                log('Cesium Viewer 已创建');
                log('PostProcessStages API: ' +
                    (scene.postProcessStages ? 'OK' : 'NOT FOUND'));
                if (scene.postProcessStages) {
                    log('  .add: ' + typeof scene.postProcessStages.add);
                    log('  .remove: ' + typeof scene.postProcessStages.remove);
                    log('  .length: ' + scene.postProcessStages.length);
                }
                log('Cesium.PostProcessStage: ' +
                    (typeof Cesium.PostProcessStage));

                // 相机信息
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
                            log('  图层[' + i + '] name=' + (l._name || l.name || '?') +
                                ', visible=' + l.visible);
                        }

                        initialCamera = {
                            destination: scene.camera.position.clone(),
                            orientation: {
                                heading: scene.camera.heading,
                                pitch: scene.camera.pitch,
                                roll: scene.camera.roll,
                            },
                        };

                        toggleBloom();
                    }, function (err) {
                        status.value = '场景加载失败: ' + (err.message || err);
                        log('ERROR 场景加载失败: ' + (err.message || err));
                    });
                } catch (e) {
                    status.value = '场景打开异常: ' + (e.message || e);
                    log('ERROR: ' + e.message);
                }
            }

            // ---- 模型外观 ----
            function applyModelColor() {
                if (!sceneLayers.length) return;
                var color = new Cesium.Color(
                    params.colorR, params.colorG, params.colorB, params.alpha
                );
                for (var i = 0; i < sceneLayers.length; i++) {
                    sceneLayers[i].orderIndependentTranslucency = true;
                    sceneLayers[i].style3D.fillForeColor = color;
                }
                log('模型颜色已设置: rgba(' +
                    params.colorR.toFixed(2) + ', ' +
                    params.colorG.toFixed(2) + ', ' +
                    params.colorB.toFixed(2) + ', ' +
                    params.alpha.toFixed(2) + ')');
            }

            function restoreModelColor() {
                for (var i = 0; i < sceneLayers.length; i++) {
                    sceneLayers[i].style3D.fillForeColor = new Cesium.Color(1, 1, 1, 1);
                    sceneLayers[i].orderIndependentTranslucency = false;
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
                    log('Stage 创建成功: ' + fullName +
                        ', enabled=' + stage.enabled +
                        ', ready=' + stage.ready);
                    return stage;
                } catch (e) {
                    log('ERROR Stage 创建失败 [' + fullName + ']: ' + e.message);
                    return null;
                }
            }

            function removeStage(stage) {
                if (!stage) return;
                try {
                    scene.postProcessStages.remove(stage);
                } catch (_) {}
            }

            // ---- 着色器创建/销毁 ----
            function createShaderStages() {
                removeShaderStages();

                log('构建主泛光着色器: thr=' + params.threshold +
                    ' int=' + params.intensity +
                    ' rad=' + params.radius +
                    ' sig=' + params.sigma);
                var src = buildBloomShader(
                    params.threshold, params.intensity,
                    params.radius, params.sigma
                );
                bloomStage = addStage('bloom', src);

                if (params.wideEnabled) {
                    createWideStage();
                }
                if (params.outlineEnabled) {
                    createOutlineStage();
                }

                diagStages();
            }

            function createWideStage() {
                removeStage(wideBloomStage);
                wideBloomStage = null;
                log('构建宽域泛光: thr=' + (params.threshold * 0.85).toFixed(3) +
                    ' int=' + params.wideIntensity +
                    ' rad=' + params.wideRadius);
                var src = buildWideBloomShader(
                    params.threshold * 0.85,
                    params.wideIntensity,
                    params.wideRadius
                );
                wideBloomStage = addStage('wide', src);
            }

            function createOutlineStage() {
                removeStage(outlineStage);
                outlineStage = null;
                var src = buildOutlineShader(params.outlineStrength);
                outlineStage = addStage('outline', src);
            }

            function removeShaderStages() {
                removeStage(bloomStage);   bloomStage = null;
                removeStage(wideBloomStage); wideBloomStage = null;
                removeStage(outlineStage);  outlineStage = null;
            }

            // 防抖重建
            function scheduleRebuild() {
                if (rebuildTimer) clearTimeout(rebuildTimer);
                rebuildTimer = setTimeout(function () {
                    if (bloomEnabled.value) {
                        createShaderStages();
                    }
                }, 150);
            }

            // ---- 诊断 ----
            function diagStages() {
                if (!scene || !scene.postProcessStages) return;
                var col = scene.postProcessStages;
                var n = col.length;
                log('--- PostProcessStages 诊断 (共 ' + n + ' 个) ---');
                for (var i = 0; i < n; i++) {
                    var s = col.get(i);
                    log('  [' + i + '] ' + (s.name || '(unnamed)') +
                        '  enabled=' + s.enabled +
                        '  ready=' + s.ready);
                }
            }

            // ---- 测试着色器（红色色调，验证 PostProcessStage 管线可用）----
            function runTestShader() {
                if (testStage) {
                    removeStage(testStage);
                    testStage = null;
                    log('测试着色器已移除');
                    status.value = '测试着色器已关闭';
                    return;
                }
                log('创建测试着色器（红色色调）...');
                testStage = addStage('test_red', TEST_SHADER);
                if (testStage) {
                    status.value = '测试着色器已开启 — 画面应出现红色色调';
                    log('如果画面出现红色色调，说明 PostProcessStage 管线正常工作');
                    log('如果画面无变化，说明 PostProcessStage 在此 Cesium 版本不可用');
                } else {
                    status.value = '测试着色器创建失败，查看诊断日志';
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
                    status.value = '泛光已开启（自定义着色器）';
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
                function () { return [params.colorR, params.colorG, params.colorB, params.alpha]; },
                function () {
                    if (bloomEnabled.value) applyModelColor();
                }
            );

            watch(
                function () {
                    return [params.threshold, params.intensity, params.radius, params.sigma,
                            params.wideIntensity, params.wideRadius, params.outlineStrength];
                },
                function () {
                    if (!bloomEnabled.value) return;
                    scheduleRebuild();
                }
            );

            watch(
                function () { return params.wideEnabled; },
                function (on) {
                    if (!bloomEnabled.value) return;
                    if (on) {
                        createWideStage();
                    } else {
                        removeStage(wideBloomStage);
                        wideBloomStage = null;
                    }
                }
            );

            watch(
                function () { return params.outlineEnabled; },
                function (on) {
                    if (!bloomEnabled.value) return;
                    if (on) {
                        createOutlineStage();
                    } else {
                        removeStage(outlineStage);
                        outlineStage = null;
                    }
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
                activeTooltip: activeTooltip,
                tooltipStyle: tooltipStyle,

                MODEL_SLIDERS: MODEL_SLIDERS,
                SHADER_SLIDERS: SHADER_SLIDERS,
                WIDE_SLIDERS: WIDE_SLIDERS,

                toggleBloom: toggleBloom,
                applyPreset: applyPreset,
                resetView: resetView,
                formatVal: formatVal,
                showTip: showTip,
                hideTip: hideTip,
                runTestShader: runTestShader,
                diagStages: function () { diagStages(); },
            };
        },
    }).mount('#app');
})();
