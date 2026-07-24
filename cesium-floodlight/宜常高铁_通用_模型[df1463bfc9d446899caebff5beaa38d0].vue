<template><!-- 如果是vue语法写组件，外层必须套一个<div> 等价于vue中的<template>-->
    <div class="ycgt-bim">
        <div style="width: 100%;height: 100%">
            <!-- <div style="position:absolute;z-index:10">
      {{isShowBim}}
      <button @click="$com.method.toggleMap('map')">切换图片</button>
      <button @click="$com.method.toggleMap">切换模型</button>
      <el-button @click="$com.method.resetView">c重置</el-button>
      <el-button @click="$com.method.addStatus">进度</el-button>
      <el-button @click="$com.method.cancleProcess">进度取消</el-button>
      <el-button @click="$com.method.startFly">飞行</el-button>
      <el-button @click="$com.method.stopFly">停止</el-button>
      <el-button @click="()=>{$com.method.onLocation('634332')}">定位</el-button>
      <button @click="$com.method.testSetColor">设置构件颜色</button>
    </div> -->
            <div style="position:absolute;z-index:10;top:10px;left:10px;display:flex;gap:8px">
                <button @click="$com.method.testGlow">{{ isGlowing ? '取消泛光' : '测试泛光' }}</button>
            </div>
            <div id="bhzCesiumContainer" style="width: 100%;height: 100%" v-if="isShowBim"></div>
            <img src="https://hysz.sunrtcloud.com/platform/file/download?attachmentId=2018902229303726082"
                style="width: 100%;height: 100%" alt="" v-else />
        </div>
    </div>

</template>
<script>
export default {
    name: {
        value: 'ycgt-bim',
        CN: '宜常高铁_通用_模型',
    },
    method: {
        NFDW: function (data) { },
        init: function () {
            let _this = this;
            vbi.package.vue.creat(this, {
                data() {
                    return {
                        isShowBim: true,
                        isGlowing: false,
                        bloomStage: null,
                        outlineStage: null,
                        id: 'bhzCesiumContainer',
                        modelInfo: {
                            terrain_url:
                                'https://ct.sunrtcloud.com/iserver/services/3D-local3DCache-terrain_20260415/rest/realspace/datas/dixin',
                            scene_url: 'https://ct.sunrtcloud.com/iserver/services/3D-ycgt_20260414/rest/realspace',
                            //   仅存梁页面使用，只有一个地板
                            property_data_url: 'https://ct.sunrtcloud.com/iserver/services/data-ycgs_property/rest/data',
                            // 构件信息
                            info_datasetName: ['property:info_20260414'],
                            // originCamera: {
                            //   longitude: 114.24674341554108,
                            //   latitude: 22.767569033624195,
                            //   height: 246.82353295146314,
                            //   heading: 3.611946108134342,
                            //   pitch: -0.7158734603147572,
                            //   roll: 6.283185028215771,
                            //   destination: {
                            //     x: -2416506.6919200607,
                            //     y: 5365260.252516177,
                            //     z: 2453100.7559113037,
                            //   },
                            //   orientation: {
                            //     heading: 3.611946108134342,
                            //     pitch: -0.7158734603147572,
                            //     roll: 6.283185028215771,
                            //   },
                            // },
                        },
                    };
                },
                computed: {},
                watch: {},
                created() { },
                mounted() {
                    // setTimeout(() => {
                    //   const dom = document.querySelector('.cesium-viewer-navigationContainer');
                    //   if (dom) {
                    //     dom.style.top = '100px';
                    //     dom.style.right = '400px';
                    //   }
                    // }, 2000);
                },
                methods: {
                    // 数据分组
                    groupIdsByLayerCode(data) {
                        const groupedMap = new Map();
                        data.forEach((item) => {
                            const layerCode = item.layer_code;
                            const elementId = item.element_id;
                            if (!groupedMap.has(layerCode)) {
                                groupedMap.set(layerCode, []);
                            }
                            groupedMap.get(layerCode).push(elementId);
                        });
                        const result = [];
                        groupedMap.forEach((ids, layerCode) => {
                            result.push({
                                layer: layerCode,
                                ids: ids,
                            });
                        });
                        return result;
                    },

                    getHeaders() {
                        return {
                            'X-Authorization-Access-Token': window.$utils.getCookie('ibps-3.5.6-LC.SAAS.BETA-token'),
                            'X-Authorization-tenantid': window.$utils.getCookie('ibps-3.5.6-LC.SAAS.BETA-tenant_id'),
                        };
                    },
                },
            });
            window.rawWindow.CESIUM_BASE_URL = `${window.location.protocol}//${document.domain}${window.location.port ? ':' + window.location.port : ''
                }/ui-bim/Cesium`;
            this.method.resetWindowVariable();
            this.method.renderModel();
        },
        toggleMap(type) {
            this.data.vm.isShowBim = type == 'map' ? false : true;
            setTimeout(() => {
                if (!this.data.vm.isShowBim) {
                    this.method.clearBim();
                } else {
                    this.method.renderModel();
                }
            }, 100);
        },
        clearBim() {
            if (window.cView && Cesium.defined(window.cView)) {
                this.method.stopFly();
                window.cView.entities.removeAll();
                window.cView.imageryLayers.removeAll();
                window.cView.dataSources.removeAll();
                window.cView.scene.primitives.removeAll();
                // 获取webgl上下文
                let gl = window.cView.scene.context._originalGLContext;
                gl.canvas.width = 1;
                gl.canvas.height = 1;
                window.cView.destroy(); // 销毁Viewer实例
                gl.getExtension('WEBGL_lose_context').loseContext();
                gl = null;
                window.cView = '';
            }
        },
        resetWindowVariable() {
            window.cView = '';
            window.flyObj = '';
            //   sessionStorage.setItem(this.data.vm.se)
        },
        /**
         * 设置椭球体坐标
         */
        setEllipsoid() {
            let obj = [6378137.0, 6378137.0, 6356752.3142451793];
            Cesium.Ellipsoid.WGS84 = Object.freeze(new Cesium.Ellipsoid(obj[0], obj[1], obj[2]));
        },
        /**
         * 设置内存
         */
        setMemory() {
            Cesium.MemoryManager.showMemoryInfo(true); //显示内存调用
            Cesium.MemoryManager.setMaxMemory(16384); //设置最大内存
            //   Cesium.MemoryManager.setCacheSize(4096); //设置缓存空间的大小,单位为MB
        },
        setTime() {
            window.cView.clock.currentTime = Cesium.JulianDate.fromDate(new Date('2024-12-09 06:19:00 UTC'));
        },
        /**
         * 设置图层
         */
        setLayerStyle(layers) {
            layers.forEach((i) => {
                i.skeletonSelectedColor = new Cesium.Color(0, 179 / 255, 1, 0.9);
                i.selectedColor = new Cesium.Color(0, 179 / 255, 1, 0.9);
                i.orderIndependentTranslucency = false;
            });
        },
        resetView() {
            let { destination, orientation } = this.data.vm.modelInfo.originCamera;
            window.cView.scene.camera.setView({
                destination,
                orientation,
            });
        },
        getCamarePosition(scene) {
            // 获取当前相机的笛卡尔坐标位置
            var cameraPosition = scene.camera.position;
            // 将这个位置转换为经纬度和高度
            var cartographic = Cesium.Cartographic.fromCartesian(cameraPosition);
            var longitude = Cesium.Math.toDegrees(cartographic.longitude);
            var latitude = Cesium.Math.toDegrees(cartographic.latitude);
            var height = cartographic.height;

            var heading = scene.camera.heading; // 偏航角，绕Y轴旋转的角度
            var pitch = scene.camera.pitch; // 俯仰角，绕X轴旋转的角度
            var roll = scene.camera.roll; // 翻滚角，绕Z轴旋转的角度
            return {
                longitude,
                latitude,
                height,
                heading,
                pitch,
                roll,
                destination: scene.camera.position.clone(),
                orientation: {
                    heading,
                    pitch,
                    roll,
                },
            };
        },
        handleClick(e, result) {
            //   vbi.system.call('宜常大屏_地图_弹窗').handleOpen(result, e);
            // 需要用到的模型集通过全局配置中配置 window.handleClick 内部调用业务组件方法
            window.handleClick(result, e);
        },
        addScreenEvent(viewer) {
            let _this = this;
            // 监听鼠标点击事件
            viewer.screenSpaceEventHandler.setInputAction(async function (movement) {
                let pickedObject = viewer.scene.pick(movement.position);

                if (Cesium.defined(pickedObject)) {
                    console.log('pickedObject', pickedObject);
                    let result = await _this.method.getEntityDetail(pickedObject);
                    _this.method.handleClick(movement.position, result);
                }
            }, Cesium.ScreenSpaceEventType.LEFT_CLICK);
        },
        findIndexByName(fieldNames, name) {
            return fieldNames.findIndex((i) => {
                return i == name;
            });
        },
        getData({
            data_url,
            datasetNames,
            maxFeatures,
            queryParameter = {
                attributeFilter: '',
            },
        }) {
            let url = data_url + '/featureResults.rjson?returnContent=true';
            let sqlParameter = {
                datasetNames: datasetNames,
                getFeatureMode: 'SQL',
                queryParameter,
                maxFeatures,
            };
            let queryData = JSON.stringify(sqlParameter);
            return new Promise((resolve, reject) => {
                vbi.package.$.ajax({
                    type: 'post',
                    url: url,
                    data: queryData,
                    success: function (result) {
                        let resultObj = JSON.parse(result);
                        resolve(resultObj);
                    },
                    error: function (msg) {
                        console.log(msg);
                        reject(msg);
                    },
                });
            });
        },
        /**
         * 获取构件详情
         */
        async getEntityDetail(pickedObject) {
            let url = this.data.vm.modelInfo.property_data_url;
            let datasetNames = this.data.vm.modelInfo.info_datasetName;
            let attributeFilter = `ELEMENTID=${pickedObject.id}`;
            let item = {};

            // 获取该点对应的数据
            if (datasetNames) {
                let data = await this.method.getData({
                    data_url: url,
                    datasetNames,
                    maxFeatures: 1,
                    queryParameter: {
                        attributeFilter,
                    },
                });
                item = data.features?.[0];
                if (!item) return;
            }
            let code = item.fieldValues[this.method.findIndexByName(item.fieldNames, '类型')];
            let result = {
                name: `#${Math.floor(Math.random() * 10)}` + this.method.getNameByCode(code),
                code,
                index: item.fieldValues[this.method.findIndexByName(item.fieldNames, 'SMID')],
                elementId: item.fieldValues[this.method.findIndexByName(item.fieldNames, 'ELEMENTID')],
                layerName: pickedObject.primitive.name,
                typeName: this.method.getNameByCode(code),
            };
            console.log('item', result);
            return result;
        },
        /**
         * 名称映射
         */
        getNameByCode(type) {
            let nameMap = {
                CT: '承台',
                DLCGB: '人行道板',
                DM: '台帽',
                JZXL: '混凝土箱梁',
                QD: '桥墩',
                QMB: '桥面板',
                SQ: '防撞墙',
                TD: '桥台',
                TS: '台身',
                ZKZ: '钻孔灌注桩',
            };
            return nameMap[type];
        },
        /**
         * 添加模型
         */
        openModel() {
            const _this = this;
            let scene = window.cView.scene;
            // let promise = scene.open('http://www.supermapol.com/realspace/services/3D-BIMbuilding/rest/realspace');
            let promise = scene.open(this.data.vm.modelInfo.scene_url);

            promise.then((layers) => {
                // console.log('layers', layers);
                if (this.data.vm.modelInfo.originCamera) {
                    this.method.resetView();
                } else {
                    this.data.vm.modelInfo.originCamera = this.method.getCamarePosition(scene);
                }
                // 设置图层相关
                // this.method.setLayerStyle(layers);

                this.method.addScreenEvent(window.cView);
                // console.log('window.cView.entities', window.cView.entities);
                // 配置完成的构件添加响应的颜色
                window?.openModel();
            });
        },
        /**
         * 创建容器
         */
        createViewer() {
            window.cView = new Cesium.Viewer(this.data.vm.id, {
                // animation: false, // 动画小组件
                infoBox: false, // 信息框
                selectionIndicator: false,
                shouldAnimate: true,
                navigation: false,
                shadows: true,
                // timeline: true,
                showRenderLoopErrors: false,
            });
            window.cView.imageryLayers.addImageryProvider(
                new Cesium.TiandituImageryProvider({
                    mapStyle: Cesium.TiandituMapsStyle.IMG_C, //天地图全球中文注记服务（经纬度投影）
                    token: 'd044a50924a839d21691035e52fe43a5',
                    maximumLevel: 17,
                })
            );
            this.data.vm.imageryLayer = window.cView.imageryLayers.get(1);

            // let scene = window.cView.scene;
            // 修复线路不同角度出现断点
            //   window.cView.scene.globe.depthTestAgainstTerrain = false;
            // 设置地球缩小范围
            // window.cView.scene.screenSpaceCameraController.maximumZoomDistance = 650;
            // scene.shadowMap.softShadows = true
            // scene.shadowMap.darkness = 0.8;

            // window.cView.scene.lightSource.ambientLightColor = new Cesium.Color(0.9, 0.9, 0.9, 1);
            let terrainProvider = new Cesium.CesiumTerrainProvider({
                url: this.data.vm.modelInfo.terrain_url,
                isSct: true,
            });

            // window.cView.terrainProvider = terrainProvider;
        },
        async renderModel(options) {
            // 修复模型交界处不匹配
            this.method.setEllipsoid();
            // 优化性能配置
            this.method.setMemory();
            // 创建容器
            this.method.createViewer();

            // 获取场景
            let scene = window.cView.scene;
            //   固定时间
            this.method.setTime();

            this.method.openModel();
        },
        /**
         * 添加飞行逻辑
         */
        addFly(fpfUrl, callback) {
            let _this = this;
            let routes = new Cesium.RouteCollection(window.cView.entities);
            //添加fpf飞行文件，fpf由SuperMap iDesktop生成
            routes.fromFile(fpfUrl);
            //初始化飞行管理
            let flyManager = new Cesium.FlyManager({
                scene: window.cView.scene,
                routes: routes,
            });

            //注册站点到达事件
            flyManager.stopArrived.addEventListener(function (routeStop) {
                routeStop.waitTime = 0.001; // 在每个站点处停留1s
            });
            flyManager.readyPromise.then(function () {
                // 飞行路线就绪
                let currentRoute = flyManager.currentRoute;
                currentRoute.isLineVisible = false;
                currentRoute.isStopVisible = false;
                window.flyObj = flyManager;
                // 收集entityid
                console.log('window.flyObj.routes._entityCollection.values', window.flyObj.routes._entityCollection.values);
                _this.method.collectFlyEntityId(window.flyObj.routes._entityCollection.values);
                callback && callback();
            });
            // 获取飞行索引
            flyManager.stopArrived.addEventListener(function (routeStop, e) {
                _this.data.vm.curStopIndex = routeStop.index;
            });
        },
        /**
         * 收集id
         */
        collectFlyEntityId(entitys) {
            let ids = [];
            entitys.forEach((i) => {
                //   获取飞行路径产生的entity
                ids.push(i.id);
            });
            this.data.vm.flyEntityId = ids;
        },
        /**
         * 触发漫游
         */
        startFly() {
            let fpfUrl = '/platform/file/download?attachmentId=2014623529523515393';
            this.method.addFly(fpfUrl, () => {
                // 飞行
                window.flyObj && window.flyObj.play();
            });
            // this.method.setTerrainAlpha(0.2);

            //   console.log('window.cView.entities', window.cView.entities);
        },
        stopFly() {
            // 停止
            window.flyObj && window.flyObj.stop();
            // 清除路径entity
            this.data.vm.flyEntityId?.forEach((i) => {
                window.cView.entities.removeById(i);
            });
            window.flyObj = null;
            //   this.method.setTerrainAlpha(1);
            //   console.log('window.cView.entities', window.cView.entities);
        },
        /**
         * 设置地形透明度
         */
        setTerrainAlpha(alpha) {
            window.cView.scene.globe.globeAlpha = alpha; // 应用于地球背面的恒定半透明度
            //   去掉裙边
            //   window.cView.scene.terrainProvider.isCreateSkirt = false;
        },
        getStatus() {
            return [
                {
                    layer: 'CGMX',
                    ids: ['631080', '634172'],
                    status: 1,
                },
                {
                    layer: 'JGJC',
                    ids: ['660076', '662627', '663498', '634332', '663571'],
                    status: 1,
                },
                {
                    layer: 'JGJC',
                    ids: ['631080'],
                    status: 0,
                },
                {
                    layer: 'Q',
                    ids: ['580413'],
                    status: 0,
                },
                {
                    layer: 'LB',
                    ids: ['580582', '564964'],
                    status: 0,
                },
                {
                    layer: 'CGMX',
                    ids: ['619673', '574965', '628783', '620629', '576810', '576826', '576838', '634186'],
                    status: 0,
                },
            ];
        },
        /**
         * 添加进度管理
         */
        addStatus() {
            let layers = window.cView.scene.layers.layerQueue;
            let _this = this;
            this.data.vm.imageryLayer.gamma = 0.5;
            let finishColor = new Cesium.Color(0, 163 / 255, 1, 0.3);
            let ingColor = new Cesium.Color(0, 163 / 255, 1, 0.3);
            let unstartColor = new Cesium.Color(1, 1, 1, 0.3);
            let mapList = this.method.getStatus();
            layers.forEach((layer) => {
                for (let i = 0; i < mapList.length; i++) {
                    if (layer.name == mapList[i].layer) {
                        // //0：未开始 1：施工中 2：已完成
                        if (mapList[i].status == 0) {
                            layer.setObjsColor(mapList[i].ids, unstartColor);
                        } else if (mapList[i].status == 1) {
                            layer.setObjsColor(mapList[i].ids, ingColor);
                        } else if (mapList[i].status == 2) {
                            layer.setObjsColor(mapList[i].ids, finishColor);
                        } else {
                            layer.setObjsColor(mapList[i].ids, unstartColor);
                        }
                    }
                }
                // let status = mapList[dwgcProperty[list.datasetName].id];
            });
        },
        /**
         *设置构件颜色
             mapList:[{layer:'CGMX',ids:['619673']}]
             color:new Cesium.Color(0, 163 / 255, 1, 0.3)
         */
        setElementColor(mapList, color) {
            let layers = window.cView.scene.layers.layerQueue;
            layers.forEach((layer) => {
                for (let i = 0; i < mapList.length; i++) {
                    if (layer.name == mapList[i].layer) {
                        layer.setObjsColor(mapList[i].ids, color);
                    }
                }
            });
        },
        testSetColor() {
            this.method.setElementColor(
                [
                    {
                        layer: 'CGMX',
                        ids: ['619673', '574965', '628783', '620629', '576810', '576826', '576838', '634186'],
                    },
                ],
                new Cesium.Color(0, 163 / 255, 1, 0.3)
            );
            setTimeout(() => {
                this.method.setElementColor(
                    [
                        {
                            layer: 'CGMX',
                            ids: ['634186'],
                        },
                    ],
                    new Cesium.Color(103 / 255, 194, 58 / 255, 0.8)
                );
            }, 3000);
        },
        /**
         * 测试：模型半透明泛光效果
         */
        testGlow() {
            if (!window.cView || !Cesium.defined(window.cView)) return;
            let scene = window.cView.scene;
            let layers = scene.layers.layerQueue;
            if (this.data.vm.isGlowing) {
                // 恢复正常显示
                layers.forEach((layer) => {
                    layer.style3D.fillForeColor = new Cesium.Color(1, 1, 1, 1);
                    layer.orderIndependentTranslucency = false;
                });
                // 关闭泛光与轮廓高亮
                if (this.data.vm.bloomStage) {
                    this.data.vm.bloomStage.enabled = false;
                }
                if (this.data.vm.outlineStage) {
                    this.data.vm.outlineStage.enabled = false;
                }
                this.data.vm.isGlowing = false;
                return;
            }
            // 半透明泛光：高亮青色半透明（亮度足够以便被泛光捕获）
            let glowColor = new Cesium.Color(0.1, 0.9, 1.0, 0.55);
            layers.forEach((layer) => {
                layer.orderIndependentTranslucency = true;
                layer.style3D.fillForeColor = glowColor;
            });
            // 自定义泛光后处理：提取亮部 -> 高斯模糊 -> 叠加回原图
            try {
                if (!this.data.vm.bloomStage) {
                    this.data.vm.bloomStage = scene.postProcessStages.add(
                        new Cesium.PostProcessStage({
                            name: 'custom_bloom',
                            fragmentShader: `uniform sampler2D colorTexture;
                            varying vec2 v_textureCoordinates;
                            void main() {
                                vec4 srcColor = texture2D(colorTexture, v_textureCoordinates);
                                vec2 texelSize = 1.0 / czm_viewport.zw;
                                vec3 bloom = vec3(0.0);
                                float brightWeight = 0.0;
                                for (int i = -4; i <= 4; i++) {
                                    for (int j = -4; j <= 4; j++) {
                                        vec2 offset = vec2(float(i), float(j)) * texelSize * 3.0;
                                        vec4 s = texture2D(colorTexture, v_textureCoordinates + offset);
                                        // 仅青色模型参与泛光：蓝-红 与 绿-红 同时较高（排除蓝色天空与地形）
                                        float cyanNess = smoothstep(0.3, 0.45, s.b - s.r) * smoothstep(0.3, 0.45, s.g - s.r);
                                        float w = exp(-float(i*i + j*j) / 8.0);
                                        bloom += s.rgb * cyanNess * w;
                                        brightWeight += cyanNess * w;
                                    }
                                }
                                bloom = (brightWeight > 0.0) ? bloom / brightWeight : vec3(0.0);
                                gl_FragColor = vec4(srcColor.rgb + bloom * 2.0, srcColor.a);
                            }`,
                        })
                    );
                }
                this.data.vm.bloomStage.enabled = true;
            } catch (e) {
                console.log('custom bloom failed', e);
            }
            // 模型轮廓高亮：对青色掩膜做 Sobel 边缘检测，仅在模型边界描边
            try {
                if (!this.data.vm.outlineStage) {
                    this.data.vm.outlineStage = scene.postProcessStages.add(
                        new Cesium.PostProcessStage({
                            name: 'custom_outline',
                            fragmentShader: `uniform sampler2D colorTexture;
varying vec2 v_textureCoordinates;
float cyanNess(vec2 uv) {
    vec4 s = texture2D(colorTexture, uv);
    return smoothstep(0.3, 0.45, s.b - s.r) * smoothstep(0.3, 0.45, s.g - s.r);
}
void main() {
    vec4 srcColor = texture2D(colorTexture, v_textureCoordinates);
    vec2 ts = 1.0 / czm_viewport.zw;
    float tl = cyanNess(v_textureCoordinates + ts * vec2(-2.0, 2.0));
    float t  = cyanNess(v_textureCoordinates + ts * vec2( 0.0, 2.0));
    float tr = cyanNess(v_textureCoordinates + ts * vec2( 2.0, 2.0));
    float l  = cyanNess(v_textureCoordinates + ts * vec2(-2.0, 0.0));
    float r  = cyanNess(v_textureCoordinates + ts * vec2( 2.0, 0.0));
    float bl = cyanNess(v_textureCoordinates + ts * vec2(-2.0,-2.0));
    float b  = cyanNess(v_textureCoordinates + ts * vec2( 0.0,-2.0));
    float br = cyanNess(v_textureCoordinates + ts * vec2( 2.0,-2.0));
    float gx = (tr + 2.0 * r + br) - (tl + 2.0 * l + bl);
    float gy = (bl + 2.0 * b + br) - (tl + 2.0 * t + tr);
    float edge = clamp(sqrt(gx * gx + gy * gy), 0.0, 1.0);
    vec3 outlineColor = vec3(0.6, 1.0, 1.0);
    gl_FragColor = vec4(srcColor.rgb + outlineColor * edge, srcColor.a);
}`,
                        })
                    );
                }
                this.data.vm.outlineStage.enabled = true;
            } catch (e) {
                console.log('custom outline failed', e);
            }
            this.data.vm.isGlowing = true;
        },
        range(startID, endID) {
            let array = [];
            for (let i = startID; i < endID + 1; i++) {
                array.push(i);
            }
            return array;
        },
        /**
         * 取消
         */
        cancleProcess() {
            let _this = this;
            this.data.vm.imageryLayer.gamma = 1;
            window.cView.scene.layers.layerQueue.forEach((layer) => {
                layer.removeAllObjsColor();
            });
        },
        /**
         * 飞行到桥梁
         */
        flyTo(cx, cy, h) {
            let _this = this;
            let center = Cesium.Cartesian3.fromDegrees(parseFloat(cx), parseFloat(cy), parseFloat(h + 2000));

            let head = Cesium.Math.toRadians(0);
            let pitch = Cesium.Math.toRadians(-20);
            let roll = Cesium.Math.toRadians(0);
            // let head = 0.35433603624352905;
            // let pitch = -0.8162020075039385;
            // let roll = 2.803020038300019;
            window.cView.camera.flyToBoundingSphere(new Cesium.BoundingSphere(center, 60), {
                offset: new Cesium.HeadingPitchRange(head, pitch, roll), //duration:2,
                complete() {
                    console.log('finish');
                    //定时器是为了解决飞行后，相机事件触发
                    setTimeout(() => {
                        _this.data.vm.isFlying = false;

                        console.log('flyToBoundingSphere');
                    }, 100);
                },
            });
        },
        /**
         * 定位到具体单位工程
         */
        async onLocation(id) {
            let data = await this.method.getData({
                data_url: this.data.vm.modelInfo.property_data_url,
                datasetNames: this.data.vm.modelInfo.info_datasetName,
                queryParameter: {
                    attributeFilter: `ELEMENTID = ${id}`,
                },
                maxFeatures: 1,
            });
            if (data?.features) {
                let item = data?.features?.[0];

                let x = item.fieldValues[this.method.findIndexByName(item.fieldNames, 'CENTER_X')];
                let y = item.fieldValues[this.method.findIndexByName(item.fieldNames, 'CENTER_Y')];
                let z = item.fieldValues[this.method.findIndexByName(item.fieldNames, 'TOPALTITUDE')];

                this.method.flyTo(x, y, z);
            } else {
                console.log('暂无该模型');
            }
            //   console.log('data==', data);
        },
        /**
         * 通过单位工程id获取模型id
         */
        loadData(id) {
            const content = window.MOCK_CARD.getElementID(id);
            if (content) {
                this.method.onLocation(content);
            } else {
                this.method.resetView();
            }
        },

        // 获取所有构件并分组调用
        async getTableList() {
            const options = {
                baseUrl: 'https://hysz.sunrtcloud.com/ibps/business/v3',
                url: `/data/template/queryDataTable`,
                type: 'post',
                data: {
                    requestPage: {
                        limit: 2000,
                        pageNo: 1,
                    },
                    parameters: [
                        {
                            key: 'response_data',
                            value: JSON.stringify({
                                key: 'gjjd',
                                datasetKey: 'gjjd',
                            }),
                        },
                    ],
                },
                headers: this.data.vm.getHeaders(),
            };
            const res = await window.$utils.sendRequest(options);
            const layerGroup = this.data.vm.groupIdsByLayerCode(res.data?.dataResult || []);
            console.log('layerGroup:', layerGroup);
            this.method.setElementColor(layerGroup, new Cesium.Color(103 / 255, 194, 58 / 255, 0.8));
        },
    },
    attribute: {
        class: '',
    },
    // 暴露到界面的可编辑属性
    custom: {},
    // 暴露到界面的可编辑行内样式
    style: {
        width: '100%',
        height: '100%',
    },
    // 绑定面板定义 如果行、列、值字段绑定个数不设限制则直接移除count属性即可
    binds: {
        rows: {
            display: true,
            label: '行',
            info: '',
        },
        columns: {
            display: false,
            label: '列',
            info: '',
        },
        values: {
            display: true,
            label: '值',
            info: '',
        },
        wheres: {
            display: true,
            info: '',
        },
        orders: {
            display: true,
            info: '',
        },
        rowCount: {
            display: true,
            info: '',
        },
        options: {
            display: true,
            info: '',
        },
    },
    // 不支持IE9属性 默认false支持 true不支持
    nIE: false,
};


</script>
<style lang="scss"></style>