import { CesiumLeafletSyncController } from './sync-controller.js';

// ── 超图服务配置 ──
const REALSPACE_URL = 'https://ct.sunrtcloud.com/iserver/services/3D-dongchesuo-poumian/rest/realspace';
const REALSPACE_SCENE = 'dongchesuo-poumian';

const MAP_SERVICE_URL = 'https://ct.sunrtcloud.com/iserver/services/map-dongchesuo-poumian/rest/maps/dongchesuo-ditu';

const statusEl = document.getElementById('status-text');
const cameraInfoEl = document.getElementById('camera-info');

// ── 创建 Cesium 三维 Viewer（超图扩展） ──
const viewer3D = new Cesium.Viewer('viewer-3d', {
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
});

// ── 创建 Leaflet 二维地图 ──
const map2D = L.map('viewer-2d', {
  center: [39.0, 117.0],
  zoom: 15,
  zoomControl: false,
  attributionControl: false,
});

L.control.zoom({ position: 'bottomright' }).addTo(map2D);

// OSM 底图
const osmLayer = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 19,
}).addTo(map2D);

// 超图 SingleImage 图层（使用 iClient for Leaflet）
let supermapLayer = null;
try {
  supermapLayer = L.supermap.imageMapLayer(MAP_SERVICE_URL, {
    transparent: true,
    cacheEnabled: false,
  }).addTo(map2D);

  supermapLayer.on('load', () => {
    statusEl.textContent = '二维地图图层加载完成';
    console.log('[Leaflet] SuperMap 图层加载完成');
  });

  supermapLayer.on('error', (e) => {
    console.warn('[Leaflet] SuperMap 图层加载失败, 尝试 tiledMapLayer:', e);
    map2D.removeLayer(supermapLayer);
    supermapLayer = L.supermap.tiledMapLayer(MAP_SERVICE_URL, {
      transparent: true,
      cacheEnabled: false,
    }).addTo(map2D);
  });
} catch (e) {
  console.warn('[Leaflet] imageMapLayer 不可用, 尝试 tiledMapLayer:', e);
  supermapLayer = L.supermap.tiledMapLayer(MAP_SERVICE_URL, {
    transparent: true,
    cacheEnabled: false,
  }).addTo(map2D);
}

// ── 初始化联动控制器 ──
const syncController = new CesiumLeafletSyncController(viewer3D, map2D);

// ── 加载三维 S3M 场景 ──
let sceneLayers = [];
let initialCamera = null;

statusEl.textContent = '正在加载三维场景...';

function loadRealspaceScene() {
  try {
    const promise = viewer3D.scene.open(REALSPACE_URL, REALSPACE_SCENE);
    Cesium.when(promise, (layers) => {
      sceneLayers = layers || [];
      statusEl.textContent = `三维场景加载完成，共 ${sceneLayers.length} 个 S3M 图层`;
      console.log('[3D] 场景加载完成, 图层数:', sceneLayers.length);

      initialCamera = {
        destination: viewer3D.scene.camera.position.clone(),
        orientation: {
          heading: viewer3D.scene.camera.heading,
          pitch: viewer3D.scene.camera.pitch,
          roll: viewer3D.scene.camera.roll,
        },
      };

      renderLayerPanel();

      setTimeout(() => {
        syncCesiumViewToLeaflet();
      }, 1000);
    }, (e) => {
      statusEl.textContent = `三维场景加载失败: ${e.message || e}`;
      console.error('[3D] 场景加载失败:', e);
    });
  } catch (e) {
    statusEl.textContent = `三维场景打开异常: ${e.message || e}`;
    console.error('[3D] 场景打开异常:', e);
  }
}

function syncCesiumViewToLeaflet() {
  const cam = viewer3D.camera;
  const carto = cam.positionCartographic;
  const lng = Cesium.Math.toDegrees(carto.longitude);
  const lat = Cesium.Math.toDegrees(carto.latitude);
  const height = carto.height;
  const C = 40075016.686;
  const zoom = Math.max(1, Math.min(22, Math.log2(C / Math.max(height, 1)) - 1));
  map2D.setView([lat, lng], zoom, { animate: false });
}

loadRealspaceScene();

// ── 图层管理面板 ──
function renderLayerPanel() {
  const list3D = document.getElementById('3d-layer-list');
  const count3D = document.getElementById('3d-layer-count');
  const list2D = document.getElementById('2d-layer-list');
  const count2D = document.getElementById('2d-layer-count');

  count3D.textContent = sceneLayers.length;
  list3D.innerHTML = '';

  if (sceneLayers.length === 0) {
    list3D.innerHTML = '<li class="layer-item" style="color:#666;">无图层</li>';
  } else {
    for (let i = 0; i < sceneLayers.length; i++) {
      const layer = sceneLayers[i];
      const name = getS3MDisplayName(layer, i);

      const li = document.createElement('li');
      li.className = 'layer-item';

      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.checked = layer.visible !== false;
      cb.className = 'layer-cb';
      cb.addEventListener('change', () => { layer.visible = cb.checked; });

      const nameSpan = document.createElement('span');
      nameSpan.className = 'layer-name';
      nameSpan.textContent = name;
      nameSpan.title = layer._name || layer.name || name;

      const locateBtn = document.createElement('button');
      locateBtn.className = 'layer-locate-btn';
      locateBtn.textContent = '定位';
      locateBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        flyToS3MLayer(layer, name);
      });

      li.appendChild(cb);
      li.appendChild(nameSpan);
      li.appendChild(locateBtn);
      list3D.appendChild(li);
    }
  }

  // 二维图层
  const leafletLayers = [];
  if (osmLayer) leafletLayers.push({ name: 'OpenStreetMap 底图', layer: osmLayer });
  if (supermapLayer) leafletLayers.push({ name: '动车所剖面 (SuperMap)', layer: supermapLayer });

  count2D.textContent = leafletLayers.length;
  list2D.innerHTML = '';

  for (const { name, layer } of leafletLayers) {
    const li = document.createElement('li');
    li.className = 'layer-item';

    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.checked = map2D.hasLayer(layer);
    cb.className = 'layer-cb';
    cb.addEventListener('change', () => {
      if (cb.checked) {
        map2D.addLayer(layer);
      } else {
        map2D.removeLayer(layer);
      }
    });

    const nameSpan = document.createElement('span');
    nameSpan.className = 'layer-name';
    nameSpan.textContent = name;

    li.appendChild(cb);
    li.appendChild(nameSpan);
    list2D.appendChild(li);
  }
}

function getS3MDisplayName(layer, index) {
  const name = layer._name || layer.name || '';
  if (name && name !== 's3md') {
    return name
      .replace(/@[^@]+$/, '')
      .replace(/dongchesuo[_ ]?poumian[_ ]?/gi, '')
      .replace(/_dongchesuo/g, '')
      .replace(/_/g, ' ')
      .trim() || `图层_${index}`;
  }
  return layer._groupName || `图层_${index}`;
}

function flyToS3MLayer(layer, layerName) {
  if (layer._boundingSphere && layer._boundingSphere.center &&
      !Cesium.Cartesian3.equals(layer._boundingSphere.center, Cesium.Cartesian3.ZERO)) {
    const offset = new Cesium.HeadingPitchRange(0, Cesium.Math.toRadians(-45), layer._boundingSphere.radius * 2.5);
    viewer3D.scene.camera.flyToBoundingSphere(layer._boundingSphere, { offset, duration: 1.5 });
    statusEl.textContent = `已定位到图层: ${layerName}`;
    return;
  }
  if (layer._layerBounds && layer._layerBounds.west !== undefined) {
    const b = layer._layerBounds;
    viewer3D.scene.camera.flyTo({
      destination: Cesium.Rectangle.fromDegrees(b.west, b.south, b.east, b.north),
      duration: 1.5,
    });
    statusEl.textContent = `已定位到图层: ${layerName}`;
    return;
  }
  if (layer.lon !== undefined && layer.lat !== undefined) {
    viewer3D.scene.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(layer.lon, layer.lat, (layer.height || 0) + 500),
      orientation: { heading: 0, pitch: Cesium.Math.toRadians(-45), roll: 0 },
      duration: 1.5,
    });
    statusEl.textContent = `已定位到图层: ${layerName}`;
    return;
  }
  statusEl.textContent = '该图层无范围信息，无法定位';
}

// ── 拾取模式 ──
let pickEnabled = false;
const pickHandler3D = new Cesium.ScreenSpaceEventHandler(viewer3D.scene.canvas);

pickHandler3D.setInputAction((event) => {
  if (!pickEnabled) return;
  const picked = viewer3D.scene.pick(event.position);
  if (!Cesium.defined(picked) || !picked.primitive) {
    statusEl.textContent = '未拾取到对象';
    return;
  }

  const layer = picked.primitive;
  const smId = picked.id;
  statusEl.textContent = `拾取三维对象: SmID=${smId}`;

  if (layer.setSelection && smId !== undefined && smId !== null) {
    layer.setSelection([smId]);
  }

  // 拾取联动到二维
  if (syncController.pickSyncEnabled) {
    const cartesian = viewer3D.scene.pickPosition(event.position);
    if (cartesian) {
      const carto = Cesium.Cartographic.fromCartesian(cartesian);
      const lng = Cesium.Math.toDegrees(carto.longitude);
      const lat = Cesium.Math.toDegrees(carto.latitude);

      syncController.showPickMarker2D(lng, lat, `<b>SmID:</b> ${smId || '--'}`);
      map2D.panTo([lat, lng]);
    }
  }

  showPickInfo(layer, picked);
}, Cesium.ScreenSpaceEventType.LEFT_CLICK);

// Leaflet 二维点击
map2D.on('click', (e) => {
  if (!pickEnabled) return;
  const { lat, lng } = e.latlng;
  statusEl.textContent = `拾取二维位置: ${lng.toFixed(6)}, ${lat.toFixed(6)}`;

  syncController.showPickMarker2D(lng, lat);

  if (syncController.pickSyncEnabled) {
    syncController.showPickEntity3D(lng, lat, 0, `${lng.toFixed(4)}, ${lat.toFixed(4)}`);
  }
});

// 超图三维 pickEvent
viewer3D.pickEvent.addEventListener((feature) => {
  if (!pickEnabled) return;
  if (!feature) return;

  const info = {};
  const keys = Object.keys(feature);
  for (const key of keys) {
    if (feature[key] !== undefined && feature[key] !== null && feature[key] !== '') {
      info[key] = feature[key];
    }
  }

  if (Object.keys(info).length > 0) {
    showInfoFromObject(info);
  }
});

function showPickInfo(layer, picked) {
  const info = {};
  if (picked.id !== undefined) info['SmID'] = picked.id;
  if (picked.height !== undefined) info['拾取高度'] = picked.height.toFixed(4) + 'm';
  if (layer._name) info['图层名称'] = layer._name;
  if (layer._groupName) info['组名'] = layer._groupName;
  ['lon', 'lat', 'height'].forEach((k) => {
    if (layer[k] !== undefined) info[k] = layer[k];
  });
  showInfoFromObject(info);
}

function showInfoFromObject(info) {
  if (!info || Object.keys(info).length === 0) return;

  const skipKeys = ['SMINDEXKEY', 'SMBIMINFO'];
  let html = '<table>';
  for (const [key, val] of Object.entries(info)) {
    if (val === undefined || val === null || val === '') continue;
    if (skipKeys.includes(key.toUpperCase())) continue;
    html += `<tr><td>${key}</td><td>${val}</td></tr>`;
  }
  html += '</table>';

  document.getElementById('info-content').innerHTML = html;
  document.getElementById('info-panel').style.display = 'flex';
  statusEl.textContent = `已获取属性 (${Object.keys(info).length} 个字段)`;
}

// ── 工具栏事件绑定 ──

// 视角联动开关
const viewSyncBtn = document.getElementById('btn-view-sync');
viewSyncBtn.addEventListener('click', () => {
  const enabled = syncController.toggleViewSync();
  viewSyncBtn.classList.toggle('active', enabled);
  viewSyncBtn.textContent = enabled ? '视角联动: 开' : '视角联动: 关';
});

// 拾取联动开关
const pickSyncBtn = document.getElementById('btn-pick-sync');
pickSyncBtn.addEventListener('click', () => {
  const enabled = syncController.togglePickSync();
  pickSyncBtn.classList.toggle('active', enabled);
  pickSyncBtn.textContent = enabled ? '拾取联动: 开' : '拾取联动: 关';
});

// 拾取模式
const pickModeBtn = document.getElementById('btn-pick-mode');
pickModeBtn.addEventListener('click', () => {
  pickEnabled = !pickEnabled;
  pickModeBtn.classList.toggle('pick-active', pickEnabled);
  pickModeBtn.textContent = pickEnabled ? '拾取中...' : '拾取查询';
  statusEl.textContent = pickEnabled ? '点击场景进行拾取查询' : '就绪';
});

// 清除拾取
document.getElementById('btn-clear-pick').addEventListener('click', () => {
  syncController.clearAllPick();
  for (const layer of sceneLayers) {
    try {
      if (layer.releaseSelection) layer.releaseSelection();
      if (layer.setSelection) layer.setSelection([]);
    } catch (_) {}
  }
  document.getElementById('info-panel').style.display = 'none';
  statusEl.textContent = '已清除拾取';
});

// 复位视角
document.getElementById('btn-reset').addEventListener('click', () => {
  if (initialCamera) {
    viewer3D.scene.camera.flyTo({
      destination: initialCamera.destination,
      orientation: initialCamera.orientation,
      duration: 1.5,
    });
    statusEl.textContent = '已复位视角';
  } else {
    statusEl.textContent = '初始视角未记录，等待场景加载';
  }
});

// 图层管理面板
const layerPanel = document.getElementById('layer-panel');
const layerPanelBtn = document.getElementById('btn-layer-panel');
const layerPanelToggle = document.getElementById('layer-panel-toggle');

layerPanelBtn.addEventListener('click', () => {
  layerPanel.classList.toggle('collapsed');
  layerPanelBtn.classList.toggle('active', !layerPanel.classList.contains('collapsed'));
});

layerPanelToggle.addEventListener('click', () => {
  layerPanel.classList.add('collapsed');
  layerPanelBtn.classList.remove('active');
});

// 图层分组折叠
document.querySelectorAll('.layer-group-header').forEach((header) => {
  header.addEventListener('click', () => {
    header.classList.toggle('collapsed');
  });
});

// 属性面板关闭
document.getElementById('info-close').addEventListener('click', () => {
  document.getElementById('info-panel').style.display = 'none';
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
    viewer3D.resize();
    map2D.invalidateSize();
  }
};
document.addEventListener('pointerup', stopDrag);
document.addEventListener('pointercancel', stopDrag);

// ── 状态栏 ──
const updateCameraInfo = () => {
  const cam = viewer3D.scene.camera.positionCartographic;
  const lng = Cesium.Math.toDegrees(cam.longitude).toFixed(6);
  const lat = Cesium.Math.toDegrees(cam.latitude).toFixed(6);
  const alt = cam.height.toFixed(1);
  cameraInfoEl.textContent = `经度:${lng}° 纬度:${lat}° 高度:${alt}m`;
};
viewer3D.scene.postRender.addEventListener(updateCameraInfo);

// 活跃源追踪
const panelLeftEl = document.getElementById('panel-left');
const panelRightEl = document.getElementById('panel-right');
const activeSourceEl = document.getElementById('active-source-info');

syncController.onActiveSourceChange((sourceId) => {
  panelLeftEl.classList.toggle('active-source', sourceId === '3D');
  panelRightEl.classList.toggle('active-source', sourceId === '2D');
  activeSourceEl.textContent = `活跃: ${sourceId === '3D' ? '三维场景' : '二维地图'}`;
});

// 初始化二维图层列表
renderLayerPanel();

console.log('[CesiumLeafletSync] 二三维联动应用已启动');
