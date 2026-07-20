import { CesiumLeafletSyncController } from './sync-controller.js';

// ── 超图服务配置 ──
const MODEL_SERVICE_URL = 'https://ct.sunrtcloud.com/iserver/services/3D-dongchesuotest/rest/realspace';
const MODEL_SCENE_NAME = 'dongchesuotest';

const MAP_SERVICE_URL = 'https://ct.sunrtcloud.com/iserver/services/map-dongchesuo-poumian/rest/maps/dongchesuo-ditu';

const DATA_URL = 'https://ct.sunrtcloud.com/iserver/services/data-dongchesuotest/rest/data';
const DATA_SOURCE = 'dongchesuo';
const DATASETS = [
  'Line_dongchesuo', 'changguimoxing_dongchesuo', 'chuang_dongchesuo',
  'jiegoujichu_dongchesuo', 'jiegoukuangjia_dongchesuo', 'langanfushou_dongchesuo',
  'louban_dongchesuo', 'louti_dongchesuo', 'men_dongchesuo',
  'muqiangqianbaj_dongchesuo', 'podao_dongchesuo', 'qiang_dongchesuo',
  'tianhuaban_dongchesuo', 'wuding_dongchesuo', 'zhuanyongshebei_dongchesuo',
];

// 二维地图查询服务（用于 Leaflet 端拾取属性查询）
const MAP_QUERY_URL = 'https://ct.sunrtcloud.com/iserver/services/map-dongchesuo-poumian/rest/maps/dongchesuo-ditu';

const statusEl = document.getElementById('status-text');
const cameraInfoEl = document.getElementById('camera-info');

console.log('[Init] 服务配置:', {
  '三维模型': MODEL_SERVICE_URL,
  '场景名': MODEL_SCENE_NAME,
  '二维地图': MAP_SERVICE_URL,
  '数据服务': DATA_URL,
});

// ── 创建 Cesium 三维 Viewer ──
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
console.log('[Init] Cesium Viewer 创建完成');

// ── 创建 Leaflet 二维地图 ──
const map2D = L.map('viewer-2d', {
  center: [0, 0],
  zoom: 0,
  zoomControl: false,
  attributionControl: false,
  crs: L.CRS.Simple,
  minZoom: -10,
  maxZoom: 25,
});
L.control.zoom({ position: 'bottomright' }).addTo(map2D);
console.log('[Init] Leaflet Map 创建完成');

// ── Leaflet 图层加载 ──
// CRS.Simple 下不使用 OSM 底图（投影坐标系与经纬度瓦片不兼容）
const osmLayer = null;
console.log('[Leaflet] CRS.Simple 模式，跳过 OSM 底图');

let supermapLayer = null;
let supermapLayerLoaded = false;

function fitMapToService() {
  console.log('[Leaflet] 查询地图服务范围用于自动定位...');
  fetch(MAP_SERVICE_URL + '.json')
    .then(r => r.json())
    .then(mapInfo => {
      if (mapInfo && mapInfo.bounds) {
        const b = mapInfo.bounds;
        // CRS.Simple 下坐标映射: latLng(y, x)
        const sw = L.latLng(b.bottom, b.left);
        const ne = L.latLng(b.top, b.right);
        const bounds = L.latLngBounds(sw, ne);
        console.log('[Leaflet] 服务范围 (原始):', b);
        console.log('[Leaflet] fitBounds:', { sw: [b.bottom, b.left], ne: [b.top, b.right] });
        map2D.fitBounds(bounds, { padding: [20, 20] });
        console.log('[Leaflet] 已定位到地图服务范围, 当前 zoom:', map2D.getZoom());
      } else if (mapInfo && mapInfo.center) {
        map2D.setView([mapInfo.center.y, mapInfo.center.x], 2);
        console.log('[Leaflet] 已定位到地图服务中心:', mapInfo.center);
      }
    })
    .catch(err => {
      console.warn('[Leaflet] 查询地图服务范围失败:', err);
    });
}

function loadSupermapLayer() {
  console.log('[Leaflet] 尝试加载 SuperMap 地图服务:', MAP_SERVICE_URL);
  try {
    supermapLayer = L.supermap.imageMapLayer(MAP_SERVICE_URL, {
      transparent: true,
      cacheEnabled: false,
    }).addTo(map2D);

    supermapLayer.on('load', () => {
      if (!supermapLayerLoaded) {
        supermapLayerLoaded = true;
        console.log('[Leaflet] SuperMap imageMapLayer 首次加载完成');
        statusEl.textContent = '二维地图图层加载完成';
        fitMapToService();
        renderLayerPanel();
      }
    });

    supermapLayer.on('error', (e) => {
      console.warn('[Leaflet] imageMapLayer 加载出错, 降级到 tiledMapLayer:', e);
      try { map2D.removeLayer(supermapLayer); } catch (_) {}
      supermapLayer = L.supermap.tiledMapLayer(MAP_SERVICE_URL, {
        transparent: true,
        cacheEnabled: false,
      }).addTo(map2D);

      supermapLayer.on('tileload', function onFirstTile() {
        if (!supermapLayerLoaded) {
          supermapLayerLoaded = true;
          console.log('[Leaflet] SuperMap tiledMapLayer 首次加载完成');
          statusEl.textContent = '二维地图图层加载完成 (瓦片模式)';
          fitMapToService();
          renderLayerPanel();
        }
        supermapLayer.off('tileload', onFirstTile);
      });
    });
  } catch (e) {
    console.error('[Leaflet] imageMapLayer 创建失败:', e);
    try {
      supermapLayer = L.supermap.tiledMapLayer(MAP_SERVICE_URL, {
        transparent: true,
        cacheEnabled: false,
      }).addTo(map2D);
      console.log('[Leaflet] 降级使用 tiledMapLayer');
    } catch (e2) {
      console.error('[Leaflet] tiledMapLayer 也创建失败:', e2);
    }
  }
}
loadSupermapLayer();
fitMapToService();

// ── 初始化联动控制器 ──
const syncController = new CesiumLeafletSyncController(viewer3D, map2D);
console.log('[Init] 联动控制器初始化完成');

// ── 加载三维 S3M 场景 ──
let sceneLayers = [];
let initialCamera = null;
statusEl.textContent = '正在加载三维场景...';

function loadModelScene() {
  console.log('[3D] 开始加载三维模型场景:', MODEL_SERVICE_URL, '场景:', MODEL_SCENE_NAME);
  try {
    const promise = viewer3D.scene.open(MODEL_SERVICE_URL, MODEL_SCENE_NAME);
    Cesium.when(promise, (layers) => {
      sceneLayers = layers || [];
      console.log('[3D] 三维模型场景加载完成, 图层数:', sceneLayers.length);

      for (let i = 0; i < sceneLayers.length; i++) {
        const sl = sceneLayers[i];
        console.log(`[3D] 图层[${i}]:`, {
          name: sl._name || sl.name,
          visible: sl.visible,
          lon: sl.lon, lat: sl.lat, height: sl.height,
          hasBounds: !!(sl._boundingSphere || sl._layerBounds),
        });
      }

      initialCamera = {
        destination: viewer3D.scene.camera.position.clone(),
        orientation: {
          heading: viewer3D.scene.camera.heading,
          pitch: viewer3D.scene.camera.pitch,
          roll: viewer3D.scene.camera.roll,
        },
      };
      console.log('[3D] 初始视角已记录');

      setupLayerQueryParams(sceneLayers);
      statusEl.textContent = `三维场景加载完成，共 ${sceneLayers.length} 个 S3M 图层`;
      renderLayerPanel();
    }, (e) => {
      statusEl.textContent = `三维场景加载失败: ${e.message || e}`;
      console.error('[3D] 场景加载失败:', e);
    });
  } catch (e) {
    statusEl.textContent = `三维场景打开异常: ${e.message || e}`;
    console.error('[3D] 场景打开异常:', e);
  }
}

function setupLayerQueryParams(layers) {
  let boundCount = 0;
  for (const layer of layers) {
    const layerName = (layer._name || layer.name || '').toLowerCase();
    let matchedDs = null;
    for (const ds of DATASETS) {
      const dsClean = ds.replace('_dongchesuo', '').toLowerCase();
      if (layerName.indexOf(dsClean) !== -1 || dsClean.indexOf(layerName) !== -1) {
        matchedDs = ds;
        break;
      }
    }
    if (matchedDs && layer.setQueryParameter) {
      try {
        layer.setQueryParameter({
          url: DATA_URL,
          dataSourceName: DATA_SOURCE,
          dataSetName: matchedDs,
        });
        boundCount++;
        console.log(`[3D] 图层 "${layer._name || '?'}" 绑定数据集: ${matchedDs}`);
      } catch (e) {
        console.warn(`[3D] setQueryParameter 失败: ${layer._name}`, e);
      }
    }
  }
  console.log(`[3D] 数据集绑定完成: ${boundCount}/${layers.length} 个图层`);
}

loadModelScene();

// ── 图层管理面板 ──
function renderLayerPanel() {
  const list3D = document.getElementById('3d-layer-list');
  const count3D = document.getElementById('3d-layer-count');
  const list2D = document.getElementById('2d-layer-list');
  const count2D = document.getElementById('2d-layer-count');

  count3D.textContent = sceneLayers.length;
  list3D.innerHTML = '';

  if (sceneLayers.length === 0) {
    list3D.innerHTML = '<li class="layer-item" style="color:#666;">加载中或无图层...</li>';
  } else {
    if (sceneLayers.length > 1) {
      const masterLi = document.createElement('li');
      masterLi.className = 'layer-item layer-master';
      const masterCb = document.createElement('input');
      masterCb.type = 'checkbox';
      masterCb.checked = true;
      masterCb.className = 'layer-cb';
      masterCb.addEventListener('change', () => {
        for (const layer of sceneLayers) layer.visible = masterCb.checked;
        list3D.querySelectorAll('.layer-sub .layer-cb').forEach((cb) => { cb.checked = masterCb.checked; });
      });
      const masterName = document.createElement('span');
      masterName.className = 'layer-name';
      masterName.style.fontWeight = '600';
      masterName.textContent = `全部三维图层 (${sceneLayers.length})`;
      masterLi.appendChild(masterCb);
      masterLi.appendChild(masterName);
      list3D.appendChild(masterLi);
    }

    for (let i = 0; i < sceneLayers.length; i++) {
      const layer = sceneLayers[i];
      const name = getS3MDisplayName(layer, i);
      const li = document.createElement('li');
      li.className = sceneLayers.length > 1 ? 'layer-item layer-sub' : 'layer-item';

      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.checked = layer.visible !== false;
      cb.className = 'layer-cb';
      cb.addEventListener('change', () => {
        layer.visible = cb.checked;
        console.log(`[LayerPanel] 三维图层 "${name}" 可见性: ${cb.checked}`);
      });

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

  const leafletLayers = [];
  if (osmLayer) {
    leafletLayers.push({ name: 'OpenStreetMap 底图', layer: osmLayer, type: 'base' });
  }
  if (supermapLayer) {
    leafletLayers.push({ name: '动车所平面图 (SuperMap)', layer: supermapLayer, type: 'overlay' });
  }

  count2D.textContent = leafletLayers.length;
  list2D.innerHTML = '';

  for (const { name, layer, type } of leafletLayers) {
    const li = document.createElement('li');
    li.className = 'layer-item';

    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.checked = map2D.hasLayer(layer);
    cb.className = 'layer-cb';
    cb.addEventListener('change', () => {
      if (cb.checked) map2D.addLayer(layer);
      else map2D.removeLayer(layer);
      console.log(`[LayerPanel] 二维图层 "${name}" 可见性: ${cb.checked}`);
    });

    const nameSpan = document.createElement('span');
    nameSpan.className = 'layer-name';
    nameSpan.textContent = name;

    const badge = document.createElement('span');
    badge.className = 'layer-type-badge';
    badge.textContent = type === 'base' ? '底图' : '叠加';

    if (type === 'overlay') {
      const locateBtn = document.createElement('button');
      locateBtn.className = 'layer-locate-btn';
      locateBtn.textContent = '定位';
      locateBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        fitMapToService();
        console.log(`[LayerPanel] 定位到二维图层: ${name}`);
      });
      li.appendChild(cb);
      li.appendChild(nameSpan);
      li.appendChild(locateBtn);
      li.appendChild(badge);
    } else {
      li.appendChild(cb);
      li.appendChild(nameSpan);
      li.appendChild(badge);
    }
    list2D.appendChild(li);
  }

  console.log('[LayerPanel] 图层面板已刷新:', { '三维': sceneLayers.length, '二维': leafletLayers.length });
}

function getS3MDisplayName(layer, index) {
  const name = layer._name || layer.name || '';
  if (name && name !== 's3md') {
    return name.replace(/@[^@]+$/, '').replace(/dongchesuo[_ ]?poumian[_ ]?/gi, '')
      .replace(/_dongchesuo/g, '').replace(/_/g, ' ').trim() || `图层_${index}`;
  }
  return layer._groupName || `图层_${index}`;
}

function flyToS3MLayer(layer, layerName) {
  console.log(`[Navigate] 定位到三维图层: ${layerName}`);
  if (layer._boundingSphere && layer._boundingSphere.center &&
      !Cesium.Cartesian3.equals(layer._boundingSphere.center, Cesium.Cartesian3.ZERO)) {
    const offset = new Cesium.HeadingPitchRange(0, Cesium.Math.toRadians(-45), layer._boundingSphere.radius * 2.5);
    viewer3D.scene.camera.flyToBoundingSphere(layer._boundingSphere, { offset, duration: 1.5 });
    statusEl.textContent = `已定位到图层: ${layerName}`;
    return;
  }
  if (layer._layerBounds && layer._layerBounds.west !== undefined) {
    const b = layer._layerBounds;
    viewer3D.scene.camera.flyTo({ destination: Cesium.Rectangle.fromDegrees(b.west, b.south, b.east, b.north), duration: 1.5 });
    statusEl.textContent = `已定位到图层: ${layerName}`;
    return;
  }
  if (layer.lon !== undefined && layer.lat !== undefined) {
    viewer3D.scene.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(layer.lon, layer.lat, (layer.height || 0) + 500),
      orientation: { heading: 0, pitch: Cesium.Math.toRadians(-45), roll: 0 }, duration: 1.5,
    });
    statusEl.textContent = `已定位到图层: ${layerName}`;
    return;
  }
  statusEl.textContent = '该图层无范围信息，无法定位';
  console.warn(`[Navigate] 图层 "${layerName}" 无范围信息`);
}

// ══════════════════════════════════════════════════
// 拾取与联动
// ══════════════════════════════════════════════════

let pickEnabled = false;

/**
 * SuperMap REST SQL 查询封装
 */
function doSqlQuery(serviceUrl, datasetName, filter, onSuccess) {
  if (!serviceUrl) { onSuccess([]); return; }
  try {
    const getFeatureParam = new SuperMap.REST.FilterParameter({ attributeFilter: filter });
    const params = new SuperMap.REST.GetFeaturesBySQLParameters({
      queryParameter: getFeatureParam,
      toIndex: 49,
      datasetNames: [datasetName],
      returnContent: true,
    });
    const service = new SuperMap.REST.GetFeaturesBySQLService(serviceUrl, {
      eventListeners: {
        processCompleted: (resultSet) => {
          if (resultSet.result && resultSet.result.features && resultSet.result.features.length > 0) {
            onSuccess(resultSet.result.features);
          } else {
            onSuccess([]);
          }
        },
        processFailed: (err) => {
          console.warn('[Query] SQL 查询失败:', err);
          onSuccess([]);
        },
      },
    });
    service.processAsync(params);
  } catch (e) {
    console.error('[Query] doSqlQuery error:', e);
    onSuccess([]);
  }
}

function featureToInfo(feat) {
  const info = {};
  if (feat.fieldNames && feat.fieldValues) {
    for (let i = 0; i < feat.fieldNames.length; i++) {
      const val = feat.fieldValues[i];
      if (val !== undefined && val !== null && val !== '') {
        info[feat.fieldNames[i]] = val;
      }
    }
  } else if (feat.data) {
    Object.assign(info, feat.data);
  } else if (feat.attributes) {
    Object.assign(info, feat.attributes);
  }
  return info;
}

/**
 * 提取联动关联键：
 * - 三维 BIM 数据优先使用 UNIQUEID / ELEMENTID
 * - 二维 DWG 数据从 BlockName 中解析嵌入的 Revit ElementID
 *   格式: "..._dwg-{elementId}-{视图名}"  如 "..._dwg-554611-剖面 1"
 */
function extractLinkKey(info) {
  const directKey = info['UNIQUEID'] || info['UniqueId'] || info['uniqueid']
    || info['ELEMENTID'] || info['ElementId'] || info['elementid']
    || info['elementId'];
  if (directKey) return directKey;

  const blockName = info['BlockName'] || info['blockName'] || info['BLOCKNAME'];
  if (blockName) {
    const match = blockName.match(/_dwg-(\d+)-/);
    if (match) {
      console.log(`[LinkKey] 从 BlockName 解析出 ElementID: ${match[1]} (BlockName: ${blockName})`);
      return match[1];
    }
  }
  return null;
}

function extractSmId(feat) {
  if (feat.fieldNames && feat.fieldValues) {
    for (let i = 0; i < feat.fieldNames.length; i++) {
      if (feat.fieldNames[i].toUpperCase() === 'SMID') return parseInt(feat.fieldValues[i]);
    }
  }
  if (feat.data && feat.data.SMID !== undefined) return parseInt(feat.data.SMID);
  if (feat.attributes && feat.attributes.SMID !== undefined) return parseInt(feat.attributes.SMID);
  return null;
}

function matchDataset(layer) {
  const layerName = (layer._name || layer.name || '').toLowerCase();
  for (const ds of DATASETS) {
    const dsClean = ds.replace('_dongchesuo', '').toLowerCase();
    if (layerName.indexOf(dsClean) !== -1 || dsClean.indexOf(layerName) !== -1) return ds;
  }
  return DATASETS.length > 1 ? DATASETS[1] : DATASETS[0];
}

/**
 * 通过关联键在三维 S3M 图层中高亮匹配对象
 * - 纯数字 key（来自 DWG BlockName 解析）→ 直接查 ELEMENTID
 * - UUID 格式 key → 先查 UNIQUEID，回退 ELEMENTID
 * - 命中后立即停止后续查询
 */
function highlightInModelByKey(linkKey) {
  if (sceneLayers.length === 0) return;
  const keyStr = String(linkKey);
  const isNumeric = /^\d+$/.test(keyStr);

  console.log(`[Pick→3D] 查找: key="${keyStr}" (${isNumeric ? 'ElementID' : 'UUID'}), 遍历 ${DATASETS.length} 个数据集`);
  statusEl.textContent = `正在三维模型中查找 (key=${keyStr})...`;

  let found = false;

  const filterByElementId = isNumeric ? `ELEMENTID = ${keyStr}` : `ELEMENTID = '${keyStr}'`;

  for (const ds of DATASETS) {
    const fullName = `${DATA_SOURCE}:${ds}`;

    if (isNumeric) {
      doSqlQuery(DATA_URL, fullName, filterByElementId, (features) => {
        if (found) return;
        if (features.length > 0) {
          found = true;
          doHighlight(features[0], ds, keyStr);
        }
      });
    } else {
      const filterByUniqueId = `UNIQUEID = '${keyStr}'`;
      doSqlQuery(DATA_URL, fullName, filterByUniqueId, (features) => {
        if (found) return;
        if (features.length > 0) {
          found = true;
          doHighlight(features[0], ds, keyStr);
          return;
        }
        doSqlQuery(DATA_URL, fullName, filterByElementId, (features2) => {
          if (found) return;
          if (features2.length > 0) {
            found = true;
            doHighlight(features2[0], ds, keyStr);
          }
        });
      });
    }
  }
}

function doHighlight(feat, datasetName, linkKey) {
  const smId = extractSmId(feat);
  if (smId === null) return;
  const dsClean = datasetName.replace('_dongchesuo', '').toLowerCase();
  for (const layer of sceneLayers) {
    const layerName = (layer._name || layer.name || '').toLowerCase();
    if (layerName.indexOf(dsClean) !== -1 || dsClean.indexOf(layerName) !== -1) {
      if (layer.setSelection) {
        layer.setSelection([smId]);
        console.log(`[Pick→3D] 已高亮三维图层 "${layer._name}", SmID=${smId}, key=${linkKey}`);
        statusEl.textContent = `已在三维模型中高亮 (SmID=${smId}, key=${linkKey})`;
      }
      return;
    }
  }
  for (const layer of sceneLayers) {
    if (layer.setSelection) {
      try { layer.setSelection([smId]); } catch (_) {}
    }
  }
  statusEl.textContent = `已在三维模型中高亮 (SmID=${smId}, key=${linkKey})`;
}

// ── 三维拾取 ──
const pickHandler3D = new Cesium.ScreenSpaceEventHandler(viewer3D.scene.canvas);

pickHandler3D.setInputAction((event) => {
  if (!pickEnabled) return;
  const picked = viewer3D.scene.pick(event.position);
  if (!Cesium.defined(picked) || !picked.primitive) {
    statusEl.textContent = '未拾取到对象';
    console.log('[Pick3D] 未命中对象');
    return;
  }

  const layer = picked.primitive;
  const smId = picked.id;
  const layerName = layer._name || layer.name || '?';
  console.log('[Pick3D] 命中:', { SmID: smId, layer: layerName });
  statusEl.textContent = `拾取三维对象: SmID=${smId}, 查询属性中...`;

  if (layer.setSelection && smId !== undefined && smId !== null) {
    layer.setSelection([smId]);
  }

  const ds = matchDataset(layer);
  if (ds && smId !== undefined && smId !== null) {
    const fullName = `${DATA_SOURCE}:${ds}`;
    doSqlQuery(DATA_URL, fullName, `SmID = ${smId}`, (features) => {
      if (features.length > 0) {
        const info = featureToInfo(features[0]);
        const elementId = info['ELEMENTID'] || info['ElementId'] || info['elementId'];
        const uniqueId = info['UNIQUEID'] || info['UniqueId'] || info['uniqueid'];
        console.log('[Pick3D] 查询到属性:', {
          字段数: Object.keys(info).length,
          ELEMENTID: elementId || '无',
          UNIQUEID: uniqueId || '无',
          SmID: smId,
          数据集: ds,
        });
        showInfoFromObject(info, '三维拾取');

        if (syncController.pickSyncEnabled) {
          linkPick3Dto2D(event.position, info, smId);
        }
      } else {
        console.log('[Pick3D] 数据集查询无结果, 显示基本信息');
        showBasicPickInfo(layer, picked);

        if (syncController.pickSyncEnabled) {
          linkPick3Dto2D(event.position, null, smId);
        }
      }
    });
  } else {
    showBasicPickInfo(layer, picked);
  }
}, Cesium.ScreenSpaceEventType.LEFT_CLICK);

/**
 * 三维拾取后联动到二维地图
 * 二维为 CRS.Simple (投影坐标)，三维拾取给出经纬度，两者坐标系不同，
 * 仅在二维地图上放置标记 + 展示 popup 属性信息
 */
function linkPick3Dto2D(screenPos, info, smId) {
  const cartesian = viewer3D.scene.pickPosition(screenPos);
  if (!cartesian) return;
  const carto = Cesium.Cartographic.fromCartesian(cartesian);
  const lng = Cesium.Math.toDegrees(carto.longitude);
  const lat = Cesium.Math.toDegrees(carto.latitude);
  const popupHtml = info ? buildPopupHtml(info) : `<b>SmID:</b> ${smId || '--'}`;

  syncController.showPickMarker2D(lng, lat, popupHtml);
  map2D.panTo([lat, lng]);

  const elementId = info ? (info['ELEMENTID'] || info['ElementId'] || info['elementId']) : null;
  const linkField = elementId ? `ELEMENTID=${elementId}` : `SmID=${smId}`;
  console.log(`[Pick3D→2D] 联动标记到二维: lnglat=(${lng.toFixed(6)}, ${lat.toFixed(6)}), ${linkField}`);
}

// 超图原生 pickEvent
viewer3D.pickEvent.addEventListener((feature) => {
  if (!pickEnabled || !feature) return;
  const info = {};
  for (const key of Object.keys(feature)) {
    if (feature[key] !== undefined && feature[key] !== null && feature[key] !== '') {
      info[key] = feature[key];
    }
  }
  if (Object.keys(info).length > 0) {
    console.log('[Pick3D] pickEvent 属性:', Object.keys(info).join(', '));
    showInfoFromObject(info, '三维拾取 (pickEvent)');
  }
});

// ── 二维地图拾取 ──
map2D.on('click', (e) => {
  if (!pickEnabled) return;
  // CRS.Simple 下: latlng.lat = y坐标, latlng.lng = x坐标
  const x = e.latlng.lng;
  const y = e.latlng.lat;
  console.log(`[Pick2D] 二维拾取位置 (投影坐标): x=${x.toFixed(2)}, y=${y.toFixed(2)}`);
  statusEl.textContent = `二维拾取: x=${x.toFixed(2)}, y=${y.toFixed(2)}, 查询中...`;

  syncController.showPickMarker2D(x, y);

  // 直接传投影坐标进行查询 (lng=x, lat=y)
  queryMapFeatureByPoint(x, y);
});

function queryMapFeatureByPoint(lng, lat) {
  console.log('[Pick2D] 通过 SuperMap 地图查询服务查询点位要素...', { x: lng, y: lat });

  // CRS.Simple 下 latlng 实际为投影坐标 (y=lat, x=lng)
  // 使用 REST API 的 geometry 查询
  queryMapFeatureByPointREST(lng, lat);
}

// 动态获取地图所有可查询子图层（名称 + bounds），首次查询时缓存
let _mapQueryLayers = null;
let _mapQueryLayersFetched = false;

function ensureMapQueryLayers() {
  if (_mapQueryLayersFetched) return Promise.resolve(_mapQueryLayers);
  return fetch(MAP_QUERY_URL + '/layers.json')
    .then(r => r.json())
    .then(layersInfo => {
      _mapQueryLayersFetched = true;
      _mapQueryLayers = [];

      function collectQueryableLayers(layers) {
        if (!Array.isArray(layers)) return;
        for (const layer of layers) {
          if (layer.queryable && layer.name) {
            _mapQueryLayers.push({
              name: layer.name,
              bounds: layer.bounds || null,
              type: (layer.datasetInfo && layer.datasetInfo.type) || 'UNKNOWN',
            });
          }
          if (layer.subLayers && layer.subLayers.layers) {
            collectQueryableLayers(layer.subLayers.layers);
          }
        }
      }

      collectQueryableLayers(layersInfo);

      if (_mapQueryLayers.length === 0 && Array.isArray(layersInfo) && layersInfo.length > 0 && layersInfo[0].subLayers && layersInfo[0].subLayers.layers) {
        collectQueryableLayers(layersInfo[0].subLayers.layers);
      }

      console.log(`[Pick2D] 获取到 ${_mapQueryLayers.length} 个可查询子图层:`,
        _mapQueryLayers.slice(0, 3).map(l => `${l.name}(${l.type})`).join(', '),
        _mapQueryLayers.length > 3 ? '...' : '');
      return _mapQueryLayers;
    })
    .catch(err => {
      console.warn('[Pick2D] 获取子图层列表失败:', err);
      _mapQueryLayersFetched = true;
      _mapQueryLayers = [];
      return _mapQueryLayers;
    });
}

// 查询防抖与取消控制
let _queryAbortController = null;
let _queryDebounceTimer = null;
const QUERY_DEBOUNCE_MS = 150;

function queryMapFeatureByPointREST(lng, lat) {
  const x = lng;
  const y = lat;

  if (_queryAbortController) {
    _queryAbortController.abort();
    _queryAbortController = null;
  }
  clearTimeout(_queryDebounceTimer);

  _queryDebounceTimer = setTimeout(() => {
    _queryAbortController = new AbortController();
    const signal = _queryAbortController.signal;

    ensureMapQueryLayers().then(queryLayers => {
      if (signal.aborted) return;
      if (!queryLayers || queryLayers.length === 0) {
        console.warn('[Pick2D-REST] 无可查询子图层，跳过查询');
        showInfoFromObject({ '位置': `${x.toFixed(2)}, ${y.toFixed(2)}`, '状态': '无可查询图层' }, '二维拾取');
        return;
      }

      const tolerance = 100;
      const filteredNames = filterLayersByBounds(queryLayers, x, y, tolerance);

      if (filteredNames.length === 0) {
        console.log(`[Pick2D-REST] 点位 (${x.toFixed(0)}, ${y.toFixed(0)}) 不在任何子图层 bounds 内 (含 tolerance=${tolerance})`);
        statusEl.textContent = '二维拾取: 该位置不在任何图层范围内';
        showInfoFromObject({ '位置': `${x.toFixed(2)}, ${y.toFixed(2)}`, '状态': '不在图层范围内' }, '二维拾取');
        return;
      }

      console.log(`[Pick2D-REST] 空间过滤: ${queryLayers.length} → ${filteredNames.length} 个图层, 点位: (${x.toFixed(0)}, ${y.toFixed(0)}), tolerance=${tolerance}`);

      queryLayersBatch(x, y, filteredNames, tolerance, signal).then(result => {
        if (signal.aborted) return;
        if (!result) {
          statusEl.textContent = '二维拾取: 该位置无可查询要素';
          console.log('[Pick2D-REST] 查询无结果');
          showInfoFromObject({ '位置': `${x.toFixed(2)}, ${y.toFixed(2)}`, '状态': '未查询到要素' }, '二维拾取');
        }
      });
    });
  }, QUERY_DEBOUNCE_MS);
}

/**
 * 根据子图层 bounds 预过滤：仅保留点位(含 tolerance 扩展)与图层 bounds 相交的图层
 */
function filterLayersByBounds(queryLayers, x, y, tolerance) {
  const result = [];
  for (const ql of queryLayers) {
    if (!ql.bounds) {
      result.push(ql.name);
      continue;
    }
    const b = ql.bounds;
    const left = b.left !== undefined ? b.left : (b.leftBottom ? b.leftBottom.x : -Infinity);
    const bottom = b.bottom !== undefined ? b.bottom : (b.leftBottom ? b.leftBottom.y : -Infinity);
    const right = b.right !== undefined ? b.right : (b.rightTop ? b.rightTop.x : Infinity);
    const top = b.top !== undefined ? b.top : (b.rightTop ? b.rightTop.y : Infinity);

    if (x + tolerance >= left && x - tolerance <= right && y + tolerance >= bottom && y - tolerance <= top) {
      result.push(ql.name);
    }
  }
  return result;
}

/**
 * 批量查询子图层，仅返回属性（不返回几何），取第一个命中结果
 */
function queryLayersBatch(x, y, layerNames, tolerance, signal) {
  const url = `${MAP_QUERY_URL}/queryResults.json?returnContent=true`;
  const queryParams = layerNames.map(name => ({ name }));

  const body = {
    queryMode: 'BoundsQuery',
    queryParameters: {
      queryParams,
      expectCount: 1,
      returnContent: true,
    },
    bounds: {
      leftBottom: { x: x - tolerance, y: y - tolerance },
      rightTop: { x: x + tolerance, y: y + tolerance },
    },
    geometry: null,
    queryOption: 'ATTRIBUTE',
  };

  const t0 = performance.now();
  console.log(`[Pick2D-REST] BoundsQuery: tolerance=${tolerance}, ${queryParams.length} 个图层`);

  return fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  })
    .then(r => r.json())
    .then(data => {
      const elapsed = (performance.now() - t0).toFixed(0);
      if (data && !data.succeed && data.error) {
        console.warn(`[Pick2D-REST] 查询错误 (${elapsed}ms):`, data.error.errorMsg || data.error);
        return false;
      }

      if (data && data.recordsets && data.recordsets.length > 0) {
        for (let i = 0; i < data.recordsets.length; i++) {
          const rs = data.recordsets[i];
          const rsLayerName = rs.datasetName || `recordset[${i}]`;
          if (rs.features && rs.features.length > 0) {
            const feat = rs.features[0];
            const info = featureToInfo(feat);
            console.log(`[Pick2D-REST] 命中: ${rsLayerName}, ${elapsed}ms, ${Object.keys(info).length} 个字段`);
            showInfoFromObject(info, `二维拾取 (${rsLayerName})`);

            if (syncController.pickSyncEnabled) {
              const linkKey = extractLinkKey(info);
              if (linkKey) {
                console.log(`[Pick2D-REST→3D] 联动: key="${linkKey}"`);
                highlightInModelByKey(linkKey);
              }
            }
            return true;
          }
        }
      }
      console.log(`[Pick2D-REST] 无结果 (${elapsed}ms)`);
      return false;
    })
    .catch(err => {
      if (err.name === 'AbortError') {
        console.log('[Pick2D-REST] 查询已取消 (新拾取覆盖)');
        return false;
      }
      console.error('[Pick2D-REST] 查询失败:', err);
      return false;
    });
}

// ── 属性信息展示 ──

function showBasicPickInfo(layer, picked) {
  const info = {};
  if (picked.id !== undefined) info['SmID'] = picked.id;
  if (picked.height !== undefined) info['拾取高度'] = picked.height.toFixed(4) + 'm';
  if (layer._name) info['图层名称'] = layer._name;
  if (layer._groupName) info['组名'] = layer._groupName;
  ['lon', 'lat', 'height'].forEach((k) => { if (layer[k] !== undefined) info[k] = layer[k]; });
  showInfoFromObject(info, '三维拾取');
}

function showInfoFromObject(info, sourceLabel) {
  if (!info || Object.keys(info).length === 0) return;

  const skipKeys = ['SMINDEXKEY', 'SMBIMINFO'];
  let html = '';
  if (sourceLabel) {
    html += `<div class="info-source-label">${sourceLabel}</div>`;
  }
  html += '<table>';
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

function buildPopupHtml(info) {
  const keys = ['UNIQUEID', 'UniqueId', 'ELEMENTID', 'ElementId', 'SMID', 'SmID'];
  let html = '<div style="font-size:12px;">';
  for (const key of keys) {
    if (info[key] !== undefined && info[key] !== null && info[key] !== '') {
      html += `<b>${key}:</b> ${info[key]}<br>`;
    }
  }
  const displayName = info['NAME'] || info['Name'] || info['name'] || '';
  if (displayName) html += `<b>名称:</b> ${displayName}<br>`;
  html += '</div>';
  return html;
}

// ── 工具栏事件绑定 ──

const pickModeBtn = document.getElementById('btn-pick-mode');
pickModeBtn.addEventListener('click', () => {
  pickEnabled = !pickEnabled;
  pickModeBtn.classList.toggle('pick-active', pickEnabled);
  pickModeBtn.textContent = pickEnabled ? '拾取中...' : '拾取查询';
  statusEl.textContent = pickEnabled ? '点击场景进行拾取查询' : '就绪';
  console.log(`[Toolbar] 拾取模式: ${pickEnabled ? '开启' : '关闭'}`);
});

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
  console.log('[Toolbar] 已清除所有拾取');
});

document.getElementById('btn-reset').addEventListener('click', () => {
  if (initialCamera) {
    viewer3D.scene.camera.flyTo({
      destination: initialCamera.destination,
      orientation: initialCamera.orientation,
      duration: 1.5,
    });
    statusEl.textContent = '已复位视角';
    console.log('[Toolbar] 视角已复位');
  } else {
    statusEl.textContent = '初始视角未记录，等待场景加载';
    console.warn('[Toolbar] 复位失败: 初始视角尚未记录');
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

document.querySelectorAll('.layer-group-header').forEach((header) => {
  header.addEventListener('click', () => { header.classList.toggle('collapsed'); });
});

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
viewer3D.scene.postRender.addEventListener(() => {
  const cam = viewer3D.scene.camera.positionCartographic;
  const lng = Cesium.Math.toDegrees(cam.longitude).toFixed(6);
  const lat = Cesium.Math.toDegrees(cam.latitude).toFixed(6);
  const alt = cam.height.toFixed(1);
  cameraInfoEl.textContent = `经度:${lng}° 纬度:${lat}° 高度:${alt}m`;
});

// 活跃源追踪
const panelLeftEl = document.getElementById('panel-left');
const panelRightEl = document.getElementById('panel-right');
const activeSourceEl = document.getElementById('active-source-info');

syncController.onActiveSourceChange((sourceId) => {
  panelLeftEl.classList.toggle('active-source', sourceId === '3D');
  panelRightEl.classList.toggle('active-source', sourceId === '2D');
  activeSourceEl.textContent = `活跃: ${sourceId === '3D' ? '三维场景' : '二维地图'}`;
});

renderLayerPanel();
console.log('[CesiumLeafletSync] 二三维联动应用已启动');
