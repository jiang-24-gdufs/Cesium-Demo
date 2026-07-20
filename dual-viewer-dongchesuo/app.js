import { DualSyncController } from './sync-controller.js';
import { LayerManager } from './layer-manager.js';
import { PickLinker } from './pick-linker.js';

// ── 超图服务配置 ──
const MODEL_SERVICE_URL = 'https://ct.sunrtcloud.com/iserver/services/3D-dongchesuotest/rest/realspace';
const MODEL_SCENE_NAME = 'dongchesuotest';

const DATA_URL = 'https://ct.sunrtcloud.com/iserver/services/data-dongchesuotest/rest/data';
const DATA_SOURCE = 'dongchesuo';
const DATASETS = [
  'Line_dongchesuo', 'changguimoxing_dongchesuo', 'chuang_dongchesuo',
  'jiegoujichu_dongchesuo', 'jiegoukuangjia_dongchesuo', 'langanfushou_dongchesuo',
  'louban_dongchesuo', 'louti_dongchesuo', 'men_dongchesuo',
  'muqiangqianbaj_dongchesuo', 'podao_dongchesuo', 'qiang_dongchesuo',
  'tianhuaban_dongchesuo', 'wuding_dongchesuo', 'zhuanyongshebei_dongchesuo',
];

// 剖面图 realspace 3D 服务（超图 scene.open 加载）
const SECTION_SERVICE_URL = 'https://ct.sunrtcloud.com/iserver/services/3D-dongchesuo-poumian/rest/realspace';
const SECTION_SCENE_NAME = 'dongchesuo-poumian';
const SECTION_DATA_SOURCE = 'dongchesuo-dwg';
const SECTION_DATA_URL = '';
const statusEl = document.getElementById('status-text');
const cameraInfoEl = document.getElementById('camera-info');

// ── 创建双 Viewer（超图扩展的 Cesium.Viewer） ──
const viewerOpts = {
  infoBox: false,
  selectionIndicator: false,
  baseLayerPicker: false,
  geocoder: false,
  homeButton: false,
  animation: false,
  timeline: false,
  fullscreenButton: false,
  navigationHelpButton: false,
  sceneModePicker: false,
  creditContainer: document.createElement('div'),
  imageryProvider: new Cesium.ArcGisMapServerImageryProvider({
    url: 'https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer',
  }),
};

const viewerA = new Cesium.Viewer('viewer-a', viewerOpts);
const viewerB = new Cesium.Viewer('viewer-b', {
  ...viewerOpts,
  imageryProvider: new Cesium.ArcGisMapServerImageryProvider({
    url: 'https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer',
  }),
});

// ── 初始化联动控制器（默认关闭相机联动，两侧场景独立导航） ──
const syncController = new DualSyncController(viewerA, viewerB);
syncController.toggleCameraSync(false);

// ── 初始化图层管理器 ──
const layerManager = new LayerManager(viewerA.scene, viewerB.scene);

// ── 初始化拾取联动 ──
const pickLinker = new PickLinker(viewerA, viewerB, syncController);

// ── 场景加载状态 ──
let modelInitialCamera = null;
let sectionLayers = [];
let modelLoadComplete = false;
let sectionLoadComplete = false;

// ── 加载三维模型场景 (Viewer A) ──
statusEl.textContent = '正在加载三维模型场景...';

function loadModelScene() {
  try {
    const promise = viewerA.scene.open(MODEL_SERVICE_URL, MODEL_SCENE_NAME);
    Cesium.when(promise, (layers) => {
      modelLoadComplete = true;
      statusEl.textContent = `三维模型加载完成，共 ${layers.length} 个图层`;
      console.log('[Model] 加载完成, 图层数:', layers.length);

      modelInitialCamera = {
        destination: viewerA.scene.camera.position.clone(),
        orientation: {
          heading: viewerA.scene.camera.heading,
          pitch: viewerA.scene.camera.pitch,
          roll: viewerA.scene.camera.roll,
        },
      };

      const modelLayersArr = [];
      for (let i = 0; i < layers.length; i++) {
        modelLayersArr.push(layers[i]);
      }

      setupLayerQueryParams(modelLayersArr, DATA_URL, DATA_SOURCE, DATASETS);
      layerManager.setModelLayers(modelLayersArr);
      pickLinker.setModelLayers(modelLayersArr);

      checkBothLoaded();
      loadSectionScene();
    }, (e) => {
      statusEl.textContent = `三维模型加载失败: ${e.message || e}`;
      console.error('Model load failed:', e);
      loadSectionScene();
    });
  } catch (e) {
    statusEl.textContent = `三维模型打开异常: ${e.message || e}`;
    console.error('Model open error:', e);
    loadSectionScene();
  }
}

function loadSectionScene() {
  statusEl.textContent = `正在加载剖面场景 (${SECTION_SCENE_NAME})...`;

  try {
    const promise = viewerB.scene.open(SECTION_SERVICE_URL, SECTION_SCENE_NAME);
    Cesium.when(promise, (layers) => {
      sectionLoadComplete = true;
      sectionLayers = layers || [];

      console.log('[Section] 剖面场景加载完成, 图层数:', sectionLayers.length);

      for (let i = 0; i < sectionLayers.length; i++) {
        const sl = sectionLayers[i];
        sl.visible = true;
        console.log(`[剖面图层 ${i}]`, {
          name: sl._name || sl.name,
          visible: sl.visible,
          lon: sl.lon, lat: sl.lat, height: sl.height,
          bounds: sl._layerBounds,
          boundingSphere: sl._boundingSphere
            ? { center: sl._boundingSphere.center, radius: sl._boundingSphere.radius }
            : null,
        });
      }

      setupSectionLayerQueryParams(sectionLayers);
      layerManager.setSectionLayers(sectionLayers);
      pickLinker.setSectionLayers(sectionLayers);

      flyToSectionScene(sectionLayers);
      checkBothLoaded();
    }, (e) => {
      statusEl.textContent = `剖面场景加载失败: ${e.message || e}`;
      console.error('Section scene load failed:', e);
    });
  } catch (e) {
    statusEl.textContent = `剖面场景打开异常: ${e.message || e}`;
    console.error('Section scene open error:', e);
  }
}

function setupSectionLayerQueryParams(layers) {
  if (!SECTION_DATA_URL) {
    console.info(
      '剖面图层未绑定查询参数：SECTION_DATA_URL 未配置。\n' +
      `如需拾取剖面图层时获取属性，请在 iServer 中为 "${SECTION_DATA_SOURCE}" 发布 data 服务后配置 SECTION_DATA_URL。`
    );
    return;
  }

  for (const layer of layers) {
    const layerName = layer._name || layer.name || '';
    if (layerName && layer.setQueryParameter) {
      try {
        const dsName = layerName.indexOf('@') > 0
          ? layerName.split('@')[0]
          : layerName;
        layer.setQueryParameter({
          url: SECTION_DATA_URL,
          dataSourceName: SECTION_DATA_SOURCE,
          dataSetName: dsName,
        });
        console.log(`剖面图层 "${layerName}" 绑定数据集: ${dsName}`);
      } catch (e) {
        console.warn('剖面图层 setQueryParameter 失败:', layerName, e);
      }
    }
  }
}

function flyToSectionScene(layers) {
  if (!layers || layers.length === 0) return;

  for (const layer of layers) {
    if (layer._boundingSphere && layer._boundingSphere.center &&
        !Cesium.Cartesian3.equals(layer._boundingSphere.center, Cesium.Cartesian3.ZERO)) {
      const offset = new Cesium.HeadingPitchRange(
        Cesium.Math.toRadians(0),
        Cesium.Math.toRadians(-45),
        layer._boundingSphere.radius * 2.5
      );
      viewerB.scene.camera.flyToBoundingSphere(layer._boundingSphere, {
        offset,
        duration: 1.5,
      });
      return;
    }
    if (layer._layerBounds && layer._layerBounds.west !== undefined) {
      const b = layer._layerBounds;
      viewerB.scene.camera.flyTo({
        destination: Cesium.Rectangle.fromDegrees(b.west, b.south, b.east, b.north),
        duration: 1.5,
      });
      return;
    }
    if (layer.lon !== undefined && layer.lat !== undefined) {
      viewerB.scene.camera.flyTo({
        destination: Cesium.Cartesian3.fromDegrees(layer.lon, layer.lat, (layer.height || 0) + 500),
        orientation: { heading: 0, pitch: Cesium.Math.toRadians(-45), roll: 0 },
        duration: 1.5,
      });
      return;
    }
  }
}

function checkBothLoaded() {
  if (modelLoadComplete && sectionLoadComplete) {
    statusEl.textContent = `双场景加载完成 (模型: ${layerManager.modelLayers.length} 个S3M图层, 剖面: ${sectionLayers.length} 个S3M图层)`;
  }
}

function setupLayerQueryParams(layers, dataUrl, dataSource, datasets) {
  for (const layer of layers) {
    const layerName = (layer._name || layer.name || '').toLowerCase();
    let matchedDs = null;
    for (const ds of datasets) {
      const dsClean = ds.replace('_dongchesuo', '').toLowerCase();
      if (layerName.indexOf(dsClean) !== -1 || dsClean.indexOf(layerName) !== -1) {
        matchedDs = ds;
        break;
      }
    }

    if (matchedDs && layer.setQueryParameter) {
      try {
        layer.setQueryParameter({
          url: dataUrl,
          dataSourceName: dataSource,
          dataSetName: matchedDs,
        });
        console.log(`已绑定数据集: ${layer._name || '?'} -> ${matchedDs}`);
      } catch (e) {
        console.warn('setQueryParameter 失败:', layer._name, e);
      }
    }
  }
}

// 启动场景加载
loadModelScene();

// ── 工具栏事件 ──

// 相机联动（默认关闭，因为两侧场景坐标系不同）
const cameraSyncBtn = document.getElementById('btn-camera-sync');
cameraSyncBtn.classList.remove('active');
cameraSyncBtn.textContent = '相机联动: 关';
cameraSyncBtn.addEventListener('click', () => {
  const enabled = syncController.toggleCameraSync();
  cameraSyncBtn.classList.toggle('active', enabled);
  cameraSyncBtn.textContent = enabled ? '相机联动: 开' : '相机联动: 关';
});

// 拾取联动开关
const pickSyncBtn = document.getElementById('btn-pick-sync');
pickSyncBtn.addEventListener('click', () => {
  const enabled = pickLinker.toggleLink();
  pickSyncBtn.classList.toggle('active', enabled);
  pickSyncBtn.textContent = enabled ? '拾取联动: 开' : '拾取联动: 关';
});

// 拾取模式
const pickModeBtn = document.getElementById('btn-pick-mode');
pickModeBtn.addEventListener('click', () => {
  const enabled = pickLinker.togglePick();
  pickModeBtn.classList.toggle('pick-active', enabled);
  pickModeBtn.textContent = enabled ? '拾取中...' : '拾取查询';
  statusEl.textContent = enabled ? '点击模型进行拾取查询' : '就绪';
});

// 清除拾取
document.getElementById('btn-clear-pick').addEventListener('click', () => {
  pickLinker.clearAllSelection();
});

// 复位视角
document.getElementById('btn-reset').addEventListener('click', () => {
  if (modelInitialCamera) {
    viewerA.scene.camera.flyTo({
      destination: modelInitialCamera.destination,
      orientation: modelInitialCamera.orientation,
      duration: 1.5,
    });
    statusEl.textContent = '已复位视角';
  } else {
    statusEl.textContent = '初始视角未记录，等待场景加载';
  }
  if (sectionLayers.length > 0) {
    flyToSectionScene(sectionLayers);
  }
});

// ── 分割线拖拽 ──
const divider = document.getElementById('divider');
const container = document.getElementById('main-container');
const panelLeft = document.getElementById('panel-left');
const panelRight = document.getElementById('panel-right');
let isDragging = false;

divider.addEventListener('pointerdown', (e) => {
  isDragging = true;
  divider.classList.add('dragging');
  divider.setPointerCapture(e.pointerId);
  e.preventDefault();
});

document.addEventListener('pointermove', (e) => {
  if (!isDragging) return;
  const rect = container.getBoundingClientRect();
  const ratio = Math.max(0.2, Math.min(0.8, (e.clientX - rect.left) / rect.width));
  panelLeft.style.flex = `0 0 ${ratio * 100}%`;
  panelRight.style.flex = `0 0 ${(1 - ratio) * 100}%`;
});

const stopDrag = () => {
  if (isDragging) {
    isDragging = false;
    divider.classList.remove('dragging');
    viewerA.resize();
    viewerB.resize();
  }
};
document.addEventListener('pointerup', stopDrag);
document.addEventListener('pointercancel', stopDrag);

// ── 状态栏：相机信息 ──
const updateCameraInfo = () => {
  const source = syncController.activeSource;
  const viewer = source === 'B' ? viewerB : viewerA;
  const cam = viewer.scene.camera.positionCartographic;
  const lng = Cesium.Math.toDegrees(cam.longitude).toFixed(6);
  const lat = Cesium.Math.toDegrees(cam.latitude).toFixed(6);
  const alt = cam.height.toFixed(1);
  cameraInfoEl.textContent = `经度:${lng}° 纬度:${lat}° 高度:${alt}m`;
};

viewerA.scene.postRender.addEventListener(updateCameraInfo);

// ── 活跃源追踪 ──
const panelLeftEl = document.getElementById('panel-left');
const panelRightEl = document.getElementById('panel-right');
const activeSourceEl = document.getElementById('active-source-info');

syncController.onActiveSourceChange((sourceId) => {
  panelLeftEl.classList.toggle('active-source', sourceId === 'A');
  panelRightEl.classList.toggle('active-source', sourceId === 'B');
  activeSourceEl.textContent = `活跃: ${sourceId === 'A' ? '三维模型' : '剖面图'}`;
});

// ── pickEvent（超图原生拾取事件）──
viewerA.pickEvent.addEventListener((feature) => {
  if (!pickLinker.pickEnabled) return;
  showPickEventInfo(feature, 'A');
});

viewerB.pickEvent.addEventListener((feature) => {
  if (!pickLinker.pickEnabled) return;
  showPickEventInfo(feature, 'B');
});

function showPickEventInfo(feature, sourceId) {
  if (!feature) return;
  const info = {};
  const keys = Object.keys(feature);
  for (const key of keys) {
    if (feature[key] !== undefined && feature[key] !== null && feature[key] !== '') {
      info[key] = feature[key];
    }
  }

  if (Object.keys(info).length > 0) {
    const skipKeys = ['SMINDEXKEY', 'SMBIMINFO'];
    let html = '<table>';
    for (const [key, val] of Object.entries(info)) {
      if (skipKeys.includes(key.toUpperCase())) continue;
      if (val === undefined || val === null || val === '') continue;
      html += `<tr><td>${key}</td><td>${val}</td></tr>`;
    }
    html += '</table>';
    document.getElementById('info-content').innerHTML = html;
    document.getElementById('info-panel').style.display = 'flex';
  }
}

console.log('[DualViewer-Dongchesuo] 双屏联动应用已启动');
