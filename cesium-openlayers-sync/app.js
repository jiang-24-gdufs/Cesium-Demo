// ══════════════════════════════════════════════════
// 服务配置
// ══════════════════════════════════════════════════

const MODEL_SERVICE_URL = 'https://ct.sunrtcloud.com/iserver/services/3D-dongchesuotest/rest/realspace';
const MODEL_SCENE_NAME = 'dongchesuotest';

const MVT_BASE_URL = 'https://ct.sunrtcloud.com/iserver/services/map-mvt-dongchesuo/restjsr/v1/vectortile/maps/dongchesuo';
const MVT_STYLE_URL = MVT_BASE_URL + '/style.json';
const MVT_TILE_URL = MVT_BASE_URL + '/tiles/{z}/{x}/{y}.mvt';

const DATA_URL = 'https://ct.sunrtcloud.com/iserver/services/data-dongchesuotest/rest/data';
const DATA_SOURCE = 'dongchesuo';
const DATASETS = [
  'Line_dongchesuo', 'changguimoxing_dongchesuo', 'chuang_dongchesuo',
  'jiegoujichu_dongchesuo', 'jiegoukuangjia_dongchesuo', 'langanfushou_dongchesuo',
  'louban_dongchesuo', 'louti_dongchesuo', 'men_dongchesuo',
  'muqiangqianbaj_dongchesuo', 'podao_dongchesuo', 'qiang_dongchesuo',
  'tianhuaban_dongchesuo', 'wuding_dongchesuo', 'zhuanyongshebei_dongchesuo',
];

const statusEl = document.getElementById('status-text');
const cameraInfoEl = document.getElementById('camera-info');
const toastContainer = document.getElementById('toast-container');

/**
 * 显示 toast 通知
 * @param {string} message - 消息内容
 * @param {'info'|'warning'|'error'} type - 通知类型
 * @param {number} duration - 持续时间 ms
 */
function showToast(message, type, duration) {
  type = type || 'info';
  duration = duration || 3500;
  var el = document.createElement('div');
  el.className = 'sync-toast toast-' + type;
  el.textContent = message;
  toastContainer.appendChild(el);
  setTimeout(function () {
    el.classList.add('toast-out');
    setTimeout(function () { el.remove(); }, 300);
  }, duration);
}

console.log('[Init] 服务配置:', {
  '三维模型': MODEL_SERVICE_URL,
  '场景名': MODEL_SCENE_NAME,
  'MVT服务': MVT_STYLE_URL,
  '数据服务': DATA_URL,
});

// ══════════════════════════════════════════════════
// Cesium 三维 Viewer
// ══════════════════════════════════════════════════

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

// ══════════════════════════════════════════════════
// OpenLayers 二维地图 + MVT 矢量瓦片
// （参照 iServer 预览页面逻辑）
// ══════════════════════════════════════════════════

// iServer 返回的地图 JSON 信息（与 iServer.html 中 originResult 一致）
var mvtOriginResult = null;
var mvtStyleJson = null;
var map2D = null;
var mvtLayer = null;
var highlightLayer = null;
var outlineSource = null;
var outlineLayer = null;
var highlightedFeatureId = null;

function getStyleResolutions(bounds) {
  var styleResolutions = [];
  var temp = Math.abs(bounds.left - bounds.right) / 512;
  for (var i = 0; i < 22; i++) {
    if (i === 0) {
      styleResolutions[i] = temp;
      continue;
    }
    temp = temp / 2;
    styleResolutions[i] = temp;
  }
  return styleResolutions;
}

function computeResolutionsFromScales(visibleScales) {
  var inchPerMeter = 1 / 0.0254;
  var res = [];
  for (var i = 0; i < visibleScales.length; i++) {
    res.push(1 / (visibleScales[i] * 96 * inchPerMeter));
  }
  return res;
}

function getCorrectZoom(visableResolution, styleResolutions) {
  var subResultArray = [];
  for (var i = 0; i < styleResolutions.length; i++) {
    subResultArray.push(Math.abs(visableResolution - styleResolutions[i]));
  }
  var target = Math.min.apply(null, subResultArray);
  var zoom = subResultArray.indexOf(target);
  if (styleResolutions[zoom] > visableResolution) {
    return zoom + 1;
  }
  return zoom;
}

function initOLMap() {
  console.log('[OL] 开始初始化 OpenLayers 地图和 MVT 图层...');
  statusEl.textContent = '正在加载 MVT 矢量瓦片...';

  // 1. 获取地图 JSON 信息
  fetch(MVT_BASE_URL + '.json')
    .then(function (r) { return r.json(); })
    .then(function (originResult) {
      mvtOriginResult = originResult;
      console.log('[OL] 地图 JSON 获取完成:', {
        projection: originResult.prjCoordSys.epsgCode,
        bounds: originResult.bounds,
        center: originResult.center,
        visibleScales: originResult.visibleScales ? originResult.visibleScales.length : 0,
      });

      // 2. 获取 style.json
      return fetch(MVT_STYLE_URL).then(function (r) { return r.json(); });
    })
    .then(function (styleJson) {
      mvtStyleJson = styleJson;
      console.log('[OL] style.json 获取完成, sources:', Object.keys(styleJson.sources || {}));

      buildMVTMap();
    })
    .catch(function (err) {
      console.error('[OL] MVT 初始化失败:', err);
      statusEl.textContent = 'MVT 加载失败: ' + err.message;
      // 即使 MVT 失败，也需要创建一个空白 map 以支持联动控制器
      createFallbackMap();
    });
}

function createFallbackMap() {
  map2D = new ol.Map({
    target: 'viewer-2d',
    view: new ol.View({ center: [0, 0], zoom: 2, projection: 'EPSG:3857' }),
  });
  initAfterMapCreated();
}

function buildMVTMap() {
  var originResult = mvtOriginResult;
  var styleJson = mvtStyleJson;

  var projection = 'EPSG:3857';
  var visableResolution = originResult.visibleScalesEnabled && originResult.visibleScales
    ? computeResolutionsFromScales(originResult.visibleScales)
    : [];

  // 如果服务直接提供了 visableResolution（iServer 通常硬编码）
  if (visableResolution.length === 0) {
    visableResolution = [2.388657133911757, 1.1943285669558785, 0.5971642834779393, 0.29858214173896963, 0.14929107086948482, 0.07464553543474241];
  }

  var envelope = originResult.bounds;
  if (styleJson && styleJson.metadata && styleJson.metadata.indexbounds) {
    var ib = styleJson.metadata.indexbounds;
    if (ib.length === 4) {
      envelope = { left: ib[0], bottom: ib[1], right: ib[2], top: ib[3] };
    }
  }

  var center;
  if (originResult.center && originResult.center.x && originResult.center.y) {
    center = [originResult.center.x, originResult.center.y];
  } else {
    center = [(envelope.left + envelope.right) / 2, (envelope.bottom + envelope.top) / 2];
  }

  // 根据 resolution 计算初始 zoom
  var resolution = 1 / (originResult.scale * 96 * (1 / 0.0254) * 1);
  var zoom = 0;
  var tempDiff;
  for (var j = 0; j < visableResolution.length; j++) {
    var diff = Math.abs(resolution - visableResolution[j]);
    if (j === 0 || diff < tempDiff) {
      tempDiff = diff;
      zoom = j;
    }
  }

  var view = new ol.View({
    center: center,
    zoom: zoom,
    projection: projection,
    resolutions: visableResolution,
  });

  map2D = new ol.Map({
    target: 'viewer-2d',
    view: view,
  });
  console.log('[OL] OpenLayers Map 创建完成, projection=' + projection + ', zoom=' + zoom);

  // 3. 创建 MVT 图层
  var styleResolutions = getStyleResolutions(envelope);
  var origin = [envelope.left, envelope.top];
  var minZoom = getCorrectZoom(visableResolution[0], styleResolutions);

  var format = new ol.format.MVT({
    featureClass: ol.Feature,
  });
  format.defaultDataProjection = new ol.proj.Projection({
    code: projection,
    units: ol.proj.Units.TILE_PIXELS,
  });

  var mbStyle = new ol.supermap.MapboxStyles({
    style: styleJson,
    source: styleJson.name,
    resolutions: styleResolutions,
    map: map2D,
  });

  mbStyle.on('styleloaded', function () {
    console.log('[OL] MapboxStyles styleloaded');

    mvtLayer = new ol.layer.VectorTile({
      declutter: true,
      source: new ol.source.VectorTile({
        projection: projection,
        url: MVT_TILE_URL,
        wrapX: false,
        tileGrid: new ol.tilegrid.TileGrid({
          resolutions: styleResolutions,
          origin: origin,
          minZoom: minZoom,
          tileSize: 512,
        }),
        format: format,
      }),
      style: mbStyle.getStyleFunction(),
    });

    map2D.addLayer(mvtLayer);
    console.log('[OL] MVT 图层已添加到地图');
    statusEl.textContent = 'MVT 矢量瓦片加载完成';

    setupHighlightLayer();
    renderLayerPanel();
  });

  initAfterMapCreated();
}

function setupHighlightLayer() {
  if (!mvtLayer) return;
  highlightLayer = new ol.layer.VectorTile({
    source: mvtLayer.getSource(),
    declutter: true,
    style: function (feature) {
      var matched = false;
      if (highlightedFeatureId !== null && feature.getId() === highlightedFeatureId) {
        matched = true;
      }
      if (!matched && highlightedAttr) {
        var props = feature.getProperties();
        var val = props[highlightedAttr.name] || props[highlightedAttr.name.toUpperCase()] || props[highlightedAttr.name.toLowerCase()];
        if (val !== undefined && String(val) === highlightedAttr.value) {
          matched = true;
        }
      }
      if (matched) {
        return new ol.style.Style({
          stroke: new ol.style.Stroke({ color: '#FFE600', width: 3 }),
          fill: new ol.style.Fill({ color: 'rgba(255, 230, 0, 0.3)' }),
        });
      }
      return null;
    },
  });
  map2D.addLayer(highlightLayer);

  // 独立矢量轮廓图层：基于 feature 几何绘制精确轮廓线
  outlineSource = new ol.source.Vector();
  outlineLayer = new ol.layer.Vector({
    source: outlineSource,
    style: new ol.style.Style({
      stroke: new ol.style.Stroke({ color: '#FFE600', width: 3, lineDash: [6, 4] }),
      fill: new ol.style.Fill({ color: 'rgba(255, 230, 0, 0.12)' }),
    }),
    zIndex: 999,
  });
  map2D.addLayer(outlineLayer);
  console.log('[OL] 高亮图层 + 轮廓图层已创建');
}

function fitToMVTExtent() {
  if (!mvtOriginResult) return;
  var b = mvtOriginResult.bounds;
  var extent = [b.left || b.leftBottom.x, b.bottom || b.leftBottom.y, b.right || b.rightTop.x, b.top || b.rightTop.y];
  map2D.getView().fit(extent, { padding: [20, 20, 20, 20] });
  console.log('[OL] 已定位到 MVT 服务范围');
}

initOLMap();

// ══════════════════════════════════════════════════
// 联动控制器（在 map2D 创建后初始化）
// ══════════════════════════════════════════════════

var syncController = null;

function initAfterMapCreated() {
  syncController = new CesiumOpenLayersSyncController(viewer3D, map2D);
  console.log('[Init] 联动控制器初始化完成');

  // 记录 OL 初始视角
  var view = map2D.getView();
  initialOLView = {
    center: view.getCenter() ? view.getCenter().slice() : null,
    zoom: view.getZoom(),
    resolution: view.getResolution(),
    rotation: view.getRotation(),
  };
  console.log('[Init] OL 初始视角已记录:', initialOLView);

  // 二维拾取绑定
  map2D.on('click', onMap2DClick);

  // 分割线拖拽 - resize
  map2D.updateSize();

  // OL 视角变化时更新底部状态栏
  view.on('change:center', updateOLCameraInfo);
  view.on('change:resolution', updateOLCameraInfo);
  view.on('change:rotation', updateOLCameraInfo);
  updateOLCameraInfo();

  // 活跃源追踪
  syncController.onActiveSourceChange(function (sourceId) {
    panelLeftEl.classList.toggle('active-source', sourceId === '3D');
    panelRightEl.classList.toggle('active-source', sourceId === '2D');
    activeSourceEl.textContent = '活跃: ' + (sourceId === '3D' ? '三维场景' : '二维地图');
  });
}

// ══════════════════════════════════════════════════
// 三维 S3M 场景加载
// ══════════════════════════════════════════════════

let sceneLayers = [];
let initialCamera = null;
let initialOLView = null;

function loadModelScene() {
  console.log('[3D] 开始加载三维模型场景:', MODEL_SERVICE_URL, '场景:', MODEL_SCENE_NAME);
  statusEl.textContent = '正在加载三维场景...';
  try {
    var promise = viewer3D.scene.open(MODEL_SERVICE_URL, MODEL_SCENE_NAME);
    Cesium.when(promise, function (layers) {
      sceneLayers = layers || [];
      console.log('[3D] 三维模型场景加载完成, 图层数:', sceneLayers.length);

      for (var i = 0; i < sceneLayers.length; i++) {
        var sl = sceneLayers[i];
        console.log('[3D] 图层[' + i + ']:', {
          name: sl._name || sl.name,
          visible: sl.visible,
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
      statusEl.textContent = '三维场景加载完成，共 ' + sceneLayers.length + ' 个 S3M 图层';
      renderLayerPanel();
    }, function (e) {
      statusEl.textContent = '三维场景加载失败: ' + (e.message || e);
      console.error('[3D] 场景加载失败:', e);
    });
  } catch (e) {
    statusEl.textContent = '三维场景打开异常: ' + (e.message || e);
    console.error('[3D] 场景打开异常:', e);
  }
}

function setupLayerQueryParams(layers) {
  var boundCount = 0;
  for (var li = 0; li < layers.length; li++) {
    var layer = layers[li];
    var layerName = (layer._name || layer.name || '').toLowerCase();
    var matchedDs = null;
    for (var di = 0; di < DATASETS.length; di++) {
      var ds = DATASETS[di];
      var dsClean = ds.replace('_dongchesuo', '').toLowerCase();
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
        console.log('[3D] 图层 "' + (layer._name || '?') + '" 绑定数据集: ' + matchedDs);
      } catch (e) {
        console.warn('[3D] setQueryParameter 失败: ' + layer._name, e);
      }
    }
  }
  console.log('[3D] 数据集绑定完成: ' + boundCount + '/' + layers.length + ' 个图层');
}

loadModelScene();

// ══════════════════════════════════════════════════
// 图层管理面板
// ══════════════════════════════════════════════════

function renderLayerPanel() {
  var list3D = document.getElementById('3d-layer-list');
  var count3D = document.getElementById('3d-layer-count');
  var list2D = document.getElementById('2d-layer-list');
  var count2D = document.getElementById('2d-layer-count');

  count3D.textContent = sceneLayers.length;
  list3D.innerHTML = '';

  if (sceneLayers.length === 0) {
    list3D.innerHTML = '<li class="layer-item" style="color:#666;">加载中或无图层...</li>';
  } else {
    if (sceneLayers.length > 1) {
      var masterLi = document.createElement('li');
      masterLi.className = 'layer-item layer-master';
      var masterCb = document.createElement('input');
      masterCb.type = 'checkbox';
      masterCb.checked = true;
      masterCb.className = 'layer-cb';
      masterCb.addEventListener('change', function () {
        for (var k = 0; k < sceneLayers.length; k++) sceneLayers[k].visible = masterCb.checked;
        list3D.querySelectorAll('.layer-sub .layer-cb').forEach(function (cb) { cb.checked = masterCb.checked; });
      });
      var masterName = document.createElement('span');
      masterName.className = 'layer-name';
      masterName.style.fontWeight = '600';
      masterName.textContent = '全部三维图层 (' + sceneLayers.length + ')';
      masterLi.appendChild(masterCb);
      masterLi.appendChild(masterName);
      list3D.appendChild(masterLi);
    }

    sceneLayers.forEach(function (layer, idx) {
      var name = getS3MDisplayName(layer, idx);
      var li = document.createElement('li');
      li.className = sceneLayers.length > 1 ? 'layer-item layer-sub' : 'layer-item';

      var cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.checked = layer.visible !== false;
      cb.className = 'layer-cb';
      cb.addEventListener('change', function () {
        layer.visible = cb.checked;
        console.log('[LayerPanel] 三维图层 "' + name + '" 可见性: ' + cb.checked);
      });

      var nameSpan = document.createElement('span');
      nameSpan.className = 'layer-name';
      nameSpan.textContent = name;
      nameSpan.title = layer._name || layer.name || name;

      var locateBtn = document.createElement('button');
      locateBtn.className = 'layer-locate-btn';
      locateBtn.textContent = '定位';
      locateBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        flyToS3MLayer(layer, name);
      });

      li.appendChild(cb);
      li.appendChild(nameSpan);
      li.appendChild(locateBtn);
      list3D.appendChild(li);
    });
  }

  var olLayers = [];
  if (mvtLayer) {
    olLayers.push({ name: '动车所 MVT 矢量瓦片', layer: mvtLayer, type: 'overlay' });
  }

  count2D.textContent = olLayers.length;
  list2D.innerHTML = '';

  olLayers.forEach(function (item) {
    var li = document.createElement('li');
    li.className = 'layer-item';

    var cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.checked = item.layer.getVisible();
    cb.className = 'layer-cb';
    cb.addEventListener('change', function () {
      item.layer.setVisible(cb.checked);
      console.log('[LayerPanel] 二维图层 "' + item.name + '" 可见性: ' + cb.checked);
    });

    var nameSpan = document.createElement('span');
    nameSpan.className = 'layer-name';
    nameSpan.textContent = item.name;

    var badge = document.createElement('span');
    badge.className = 'layer-type-badge';
    badge.textContent = 'MVT';

    var locateBtn = document.createElement('button');
    locateBtn.className = 'layer-locate-btn';
    locateBtn.textContent = '定位';
    locateBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      fitToMVTExtent();
      console.log('[LayerPanel] 定位到二维图层: ' + item.name);
    });

    li.appendChild(cb);
    li.appendChild(nameSpan);
    li.appendChild(locateBtn);
    li.appendChild(badge);
    list2D.appendChild(li);
  });

  console.log('[LayerPanel] 图层面板已刷新:', { '三维': sceneLayers.length, '二维': olLayers.length });
}

function getS3MDisplayName(layer, index) {
  var name = layer._name || layer.name || '';
  if (name && name !== 's3md') {
    return name.replace(/@[^@]+$/, '').replace(/dongchesuo[_ ]?poumian[_ ]?/gi, '')
      .replace(/_dongchesuo/g, '').replace(/_/g, ' ').trim() || ('图层_' + index);
  }
  return layer._groupName || ('图层_' + index);
}

function flyToS3MLayer(layer, layerName) {
  console.log('[Navigate] 定位到三维图层: ' + layerName);

  // 优先：有效 _boundingSphere（center 非 ZERO）
  if (layer._boundingSphere && layer._boundingSphere.center &&
      !Cesium.Cartesian3.equals(layer._boundingSphere.center, Cesium.Cartesian3.ZERO)) {
    var offset = new Cesium.HeadingPitchRange(0, Cesium.Math.toRadians(-45), layer._boundingSphere.radius * 2.5);
    viewer3D.scene.camera.flyToBoundingSphere(layer._boundingSphere, { offset: offset, duration: 1.5 });
    statusEl.textContent = '已定位到图层: ' + layerName;
    return;
  }

  // 次选：_layerBounds 矩形范围
  if (layer._layerBounds && layer._layerBounds.west !== undefined) {
    var b = layer._layerBounds;
    viewer3D.scene.camera.flyTo({ destination: Cesium.Rectangle.fromDegrees(b.west, b.south, b.east, b.north), duration: 1.5 });
    statusEl.textContent = '已定位到图层: ' + layerName;
    return;
  }

  // 保底：lon/lat + fixedHeight（基于 positionUnits 判断是否为有效经纬度）
  if (layer.lon !== undefined && layer.lat !== undefined) {
    var isValidDegree = (layer.positionUnits === 'Degree') &&
      Math.abs(layer.lon) <= 180 && Math.abs(layer.lat) <= 90 &&
      (Math.abs(layer.lon) > 0.001 || Math.abs(layer.lat) > 0.001);

    if (isValidDegree) {
      var fixedHeight = (layer.height || 0) + 300;
      viewer3D.scene.camera.flyTo({
        destination: Cesium.Cartesian3.fromDegrees(layer.lon, layer.lat, fixedHeight),
        orientation: { heading: 0, pitch: Cesium.Math.toRadians(-45), roll: 0 },
        duration: 1.5,
      });
      statusEl.textContent = '已定位到图层: ' + layerName;
      return;
    }
  }

  statusEl.textContent = '该图层无范围信息，无法定位';
  console.warn('[Navigate] 图层 "' + layerName + '" 无范围信息');
}

// ══════════════════════════════════════════════════
// 拾取与联动
// ══════════════════════════════════════════════════

var pickEnabled = false;

function doSqlQuery(serviceUrl, datasetName, filter, onSuccess, options) {
  if (!serviceUrl) { onSuccess([]); return; }
  var opts = options || {};
  try {
    var getFeatureParam = new SuperMap.REST.FilterParameter({ attributeFilter: filter });
    var params = new SuperMap.REST.GetFeaturesBySQLParameters({
      queryParameter: getFeatureParam,
      toIndex: opts.toIndex || 49,
      datasetNames: [datasetName],
      returnContent: true,
      hasGeometry: opts.hasGeometry !== false,
    });
    var service = new SuperMap.REST.GetFeaturesBySQLService(serviceUrl, {
      eventListeners: {
        processCompleted: function (resultSet) {
          if (resultSet.result && resultSet.result.features && resultSet.result.features.length > 0) {
            onSuccess(resultSet.result.features);
          } else {
            onSuccess([]);
          }
        },
        processFailed: function (err) {
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
  var info = {};
  if (feat.fieldNames && feat.fieldValues) {
    for (var i = 0; i < feat.fieldNames.length; i++) {
      var val = feat.fieldValues[i];
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

function extractLinkKey(info) {
  var uniqueId = info['UNIQUEID'] || info['UniqueId'] || info['uniqueid'] || info['UniqueID'];
  if (uniqueId) return String(uniqueId);
  return null;
}

function extractSmId(feat) {
  if (feat.fieldNames && feat.fieldValues) {
    for (var i = 0; i < feat.fieldNames.length; i++) {
      if (feat.fieldNames[i].toUpperCase() === 'SMID') return parseInt(feat.fieldValues[i]);
    }
  }
  if (feat.data && feat.data.SMID !== undefined) return parseInt(feat.data.SMID);
  if (feat.attributes && feat.attributes.SMID !== undefined) return parseInt(feat.attributes.SMID);
  return null;
}

function matchDataset(layer) {
  var layerName = (layer._name || layer.name || '').toLowerCase();
  for (var i = 0; i < DATASETS.length; i++) {
    var ds = DATASETS[i];
    var dsClean = ds.replace('_dongchesuo', '').toLowerCase();
    if (layerName.indexOf(dsClean) !== -1 || dsClean.indexOf(layerName) !== -1) return ds;
  }
  return DATASETS.length > 1 ? DATASETS[1] : DATASETS[0];
}

function highlightInModelByKey(uniqueId) {
  if (sceneLayers.length === 0) return;
  var keyStr = String(uniqueId);

  if (syncController) {
    syncController.clearS3MHighlight(sceneLayers);
    syncController.clearPickEntity3D();
  }

  console.log('[Pick→3D] 查找: UniqueID="' + keyStr + '", 遍历 ' + DATASETS.length + ' 个数据集');
  statusEl.textContent = '正在三维模型中查找 (UniqueID=' + keyStr + ')...';

  var found = false;
  var pending = DATASETS.length;
  var filter = "UNIQUEID = '" + keyStr + "'";

  DATASETS.forEach(function (ds) {
    var fullName = DATA_SOURCE + ':' + ds;
    doSqlQuery(DATA_URL, fullName, filter, function (features) {
      pending--;
      if (found) return;
      if (features.length > 0) {
        found = true;
        console.log('[Pick→3D] UniqueID 命中: ds="' + ds + '", SmID=' + extractSmId(features[0]) +
          ', UNIQUEID=' + keyStr);
        doHighlight3D(features[0], ds, keyStr);
      } else if (pending === 0 && !found) {
        console.warn('[Pick→3D] 所有数据集均未找到 UniqueID=' + keyStr);
        showToast('该图元没有对应的BIM构件', 'warning');
        statusEl.textContent = '该图元没有对应的BIM构件';
      }
    }, { hasGeometry: true });
  });
}

function doHighlight3D(feat, datasetName, linkKey) {
  var smId = extractSmId(feat);
  if (smId === null) return;

  if (syncController) {
    syncController.clearS3MHighlight(sceneLayers);
    syncController.clearPickEntity3D();
  }

  var targetLayer = matchS3MLayerByDataset(datasetName);

  var featInfo = featureToInfo(feat);
  var featUniqueId = featInfo['UNIQUEID'] || featInfo['UniqueID'] || featInfo['UniqueId'] || linkKey;
  console.log('[Pick→3D] 定位构件: UniqueID=' + featUniqueId +
    ', 数据集=' + datasetName + ', SmID=' + smId +
    ', 三维图层=' + (targetLayer ? (targetLayer._name || '?') : '未匹配'));

  if (targetLayer && syncController) {
    syncController.highlightS3MObject(targetLayer, [smId]);
  } else if (targetLayer && targetLayer.setSelection) {
    targetLayer.selectedColor = new Cesium.Color(1.0, 0.9, 0.0, 0.6);
    targetLayer.setSelection([smId]);
  }

  statusEl.textContent = '已高亮三维构件 (SmID=' + smId + ', UniqueID=' + featUniqueId + ')';
}

/**
 * 通过数据集名称匹配对应的 S3M 三维图层
 */
function matchS3MLayerByDataset(datasetName) {
  var dsClean = datasetName.replace('_dongchesuo', '').toLowerCase();
  for (var i = 0; i < sceneLayers.length; i++) {
    var layer = sceneLayers[i];
    var layerName = (layer._name || layer.name || '').toLowerCase();
    if (layerName.indexOf(dsClean) !== -1 || dsClean.indexOf(layerName) !== -1) {
      return layer;
    }
  }
  return null;
}

// flyToComponent3D 及相关辅助函数已移除 — 详见 二维联动三维定位方案总结.md


// ── 三维拾取 ──
var pickHandler3D = new Cesium.ScreenSpaceEventHandler(viewer3D.scene.canvas);

pickHandler3D.setInputAction(function (event) {
  if (!pickEnabled) return;
  var picked = viewer3D.scene.pick(event.position);
  if (!Cesium.defined(picked) || !picked.primitive) {
    statusEl.textContent = '未拾取到对象';
    console.log('[Pick3D] 未命中对象');
    return;
  }

  // 同步阶段立即获取世界坐标（必须在当前帧完成，异步后 pickPosition 不可靠）
  var pickedCartesian = viewer3D.scene.pickPosition(event.position);

  var layer = picked.primitive;
  var smId = picked.id;
  var layerName = layer._name || layer.name || '?';
  console.log('[Pick3D] 命中:', { SmID: smId, layer: layerName });
  statusEl.textContent = '拾取三维对象: SmID=' + smId + ', 查询属性中...';

  if (syncController && layer.setSelection && smId !== undefined && smId !== null) {
    syncController.highlightS3MObject(layer, [smId]);
  } else if (layer.setSelection && smId !== undefined && smId !== null) {
    layer.selectedColor = new Cesium.Color(1.0, 0.9, 0.0, 0.6);
    layer.setSelection([smId]);
  }

  var ds = matchDataset(layer);
  if (ds && smId !== undefined && smId !== null) {
    var fullName = DATA_SOURCE + ':' + ds;
    doSqlQuery(DATA_URL, fullName, 'SmID = ' + smId, function (features) {
      if (features.length > 0) {
        var info = featureToInfo(features[0]);
        var uniqueId = info['UNIQUEID'] || info['UniqueId'] || info['uniqueid'] || info['UniqueID'];
        console.log('[Pick3D] 查询到属性:', {
          字段数: Object.keys(info).length,
          UNIQUEID: uniqueId || '无',
          SmID: smId,
          数据集: ds,
        });
        showInfoFromObject(info, '三维拾取');

        if (syncController && syncController.pickSyncEnabled) {
          linkPick3Dto2D(pickedCartesian, info, smId);
        }
      } else {
        console.log('[Pick3D] 数据集查询无结果, 显示基本信息');
        showBasicPickInfo(layer, picked);
      }
    });
  } else {
    showBasicPickInfo(layer, picked);
  }
}, Cesium.ScreenSpaceEventType.LEFT_CLICK);

/**
 * 三维拾取后联动二维高亮
 *
 * 通过 SQL 查询二维数据服务确认 UniqueID 是否存在对应的二维 feature：
 * - 存在 → 设置 highlightedAttr 触发 highlightLayer 渲染高亮 + 附加轮廓线
 * - 不存在 → toast 提示"该BIM构件没有对应的图元"
 *
 * @param {Cesium.Cartesian3|null} pickedCartesian - 三维拾取点的世界坐标
 * @param {Object} info - 属性信息
 * @param {number} smId - SmID
 */
function linkPick3Dto2D(pickedCartesian, info, smId) {
  highlightedFeatureId = null;
  highlightedAttr = null;
  if (highlightLayer) highlightLayer.changed();
  clearOutlineLayer();
  if (syncController) syncController.clearPickMarker2D();

  var uniqueId = info ? (info['UNIQUEID'] || info['UniqueID'] || info['UniqueId'] || info['uniqueid']) : null;
  if (!uniqueId) return;

  var keyStr = String(uniqueId);
  var filter = "UNIQUEID = '" + keyStr + "'";
  var found = false;
  var pending = DATASETS.length;

  DATASETS.forEach(function (ds) {
    var fullName = DATA_SOURCE + ':' + ds;
    doSqlQuery(DATA_URL, fullName, filter, function (features) {
      pending--;
      if (found) return;
      if (features.length > 0) {
        found = true;
        highlightedAttr = { name: 'UniqueID', value: keyStr };
        if (highlightLayer) highlightLayer.changed();
        findAndOutlineMVTFeature('UniqueID', keyStr);
        console.log('[Pick3D→2D] 二维高亮成功: UniqueID=' + keyStr + ', ds=' + ds);
      } else if (pending === 0 && !found) {
        console.log('[Pick3D→2D] 所有数据集均无此 UniqueID: ' + keyStr);
        showToast('该BIM构件没有对应的图元', 'warning');
      }
    }, { hasGeometry: false, toIndex: 0 });
  });
}

/**
 * 从当前已加载 MVT 瓦片中查找并绘制轮廓
 * @returns {boolean} 是否找到要素
 */
function findAndOutlineMVTFeature(attrName, attrValue) {
  clearOutlineLayer();
  if (!mvtLayer || !outlineSource) return false;

  var strVal = String(attrValue);
  var source = mvtLayer.getSource();
  var found = false;

  try {
    var tileGrid = source.getTileGrid();
    if (!tileGrid || !source.forEachLoadedTile) return false;

    source.forEachLoadedTile(tileGrid, map2D.getView().getZoom(), map2D.getView().calculateExtent(), function (tile) {
      if (found) return;
      var features = tile.getFeatures ? tile.getFeatures() : [];
      for (var i = 0; i < features.length; i++) {
        var f = features[i];
        var props = f.getProperties();
        var val = props[attrName] || props[attrName.toUpperCase()] || props[attrName.toLowerCase()];
        if (val !== undefined && String(val) === strVal) {
          addOutlineFromFeature(f);
          found = true;
          return;
        }
      }
    });
  } catch (e) {
    console.warn('[OL] forEachLoadedTile 不可用，轮廓绘制跳过:', e.message);
  }

  return found;
}

/**
 * 判断坐标是否为合法的 EPSG:3857 墨卡托坐标
 * EPSG:3857 的 X 范围 ≈ [-20037508, 20037508]，Y 范围 ≈ [-20037508, 20037508]
 * BIM 模型局部坐标通常只有几百~几千，可通过数量级判断
 */
function isValidMercatorCoord(x, y) {
  return Math.abs(x) > 100000 && Math.abs(y) > 100000;
}

/**
 * 二维地图飞行定位到指定墨卡托坐标
 * 支持平滑动画 + 坐标合法性校验 + 自适应缩放级别
 * @param {Array<number>} olCoord - EPSG:3857 坐标 [x, y]
 * @param {Object} [options] - 可选配置
 * @param {number} [options.duration=800] - 动画时长 ms
 * @param {number} [options.minZoom] - 最低缩放级别
 * @param {Function} [options.onComplete] - 动画完成回调
 */
function flyOLToCoord(olCoord, options) {
  if (!map2D) return;
  var opts = options || {};

  if (!isValidMercatorCoord(olCoord[0], olCoord[1])) {
    console.error('[flyOLToCoord] 坐标不是合法墨卡托值，拒绝定位: [' + olCoord[0] + ', ' + olCoord[1] + ']');
    return;
  }

  var view = map2D.getView();
  var resolutions = view.getResolutions();
  var maxZoomIdx = resolutions ? resolutions.length - 1 : 5;
  var currentZoom = view.getZoom() || 0;
  var minZoom = opts.minZoom !== undefined ? opts.minZoom : Math.max(maxZoomIdx - 2, 0);
  var targetZoom = Math.min(maxZoomIdx, Math.max(currentZoom, minZoom));
  var duration = opts.duration !== undefined ? opts.duration : 800;

  view.animate({
    center: olCoord,
    zoom: targetZoom,
    duration: duration,
  }, function (completed) {
    if (completed && syncController) {
      syncController.showPickMarker2D(olCoord);
    }
    if (completed && opts.onComplete) {
      opts.onComplete();
    }
  });
}

function highlightMVTFeatureByAttr(attrName, attrValue) {
  highlightedFeatureId = null;
  highlightedAttr = { name: attrName, value: String(attrValue) };

  if (highlightLayer) {
    highlightLayer.changed();
    console.log('[OL] 高亮 MVT 要素: ' + attrName + '=' + attrValue);
  }

  findAndOutlineMVTFeature(attrName, attrValue);
}

var highlightedAttr = null;

/**
 * 从 MVT feature 提取几何并添加到轮廓图层
 */
function addOutlineFromFeature(mvtFeature) {
  if (!outlineSource) return;
  var geom = mvtFeature.getGeometry();
  if (!geom) return;

  var cloned = geom.clone();
  var outlineFeat = new ol.Feature({ geometry: cloned });
  outlineSource.addFeature(outlineFeat);
  console.log('[OL] 轮廓要素已添加, 类型: ' + cloned.getType());
}

/**
 * 直接用 OL feature 对象添加轮廓
 */
function showOutlineForFeature(olFeature) {
  clearOutlineLayer();
  if (!outlineSource || !olFeature) return;
  addOutlineFromFeature(olFeature);
}

function clearOutlineLayer() {
  if (outlineSource) outlineSource.clear();
}

viewer3D.pickEvent.addEventListener(function (feature) {
  if (!pickEnabled || !feature) return;
  var info = {};
  var keys = Object.keys(feature);
  for (var i = 0; i < keys.length; i++) {
    var key = keys[i];
    if (feature[key] !== undefined && feature[key] !== null && feature[key] !== '') {
      info[key] = feature[key];
    }
  }
  if (Object.keys(info).length > 0) {
    console.log('[Pick3D] pickEvent 属性:', Object.keys(info).join(', '));
    showInfoFromObject(info, '三维拾取 (pickEvent)');
  }
});

// ── 二维 OpenLayers 拾取 ──
function onMap2DClick(evt) {
  if (!pickEnabled) return;

  var coordinate = evt.coordinate;
  console.log('[Pick2D] 二维拾取位置: ' + coordinate[0].toFixed(6) + ', ' + coordinate[1].toFixed(6));
  statusEl.textContent = '二维拾取: ' + coordinate[0].toFixed(4) + ', ' + coordinate[1].toFixed(4);

  var features = [];
  map2D.forEachFeatureAtPixel(evt.pixel, function (feature, layer) {
    features.push({ feature: feature, layer: layer });
  }, { hitTolerance: 5 });

  if (features.length > 0) {
    var feat = features[0].feature;
    var props = feat.getProperties();
    delete props.geometry;

    console.log('[Pick2D] 命中 MVT 要素:', {
      id: feat.getId(),
      字段数: Object.keys(props).length,
      字段: Object.keys(props).slice(0, 10).join(', '),
    });

    highlightedFeatureId = feat.getId();
    if (highlightLayer) highlightLayer.changed();

    showOutlineForFeature(feat);

    showInfoFromObject(props, '二维拾取 (MVT)');

    if (syncController && syncController.pickSyncEnabled) {
      var linkKey = extractLinkKey(props);
      if (linkKey) {
        console.log('[Pick2D→3D] 联动定位+高亮: UniqueID="' + linkKey + '"');
        highlightInModelByKey(linkKey);
      } else {
        console.log('[Pick2D→3D] 未找到 UniqueID，跳过三维联动');
        showToast('该图元没有对应的BIM构件', 'warning');
      }
    }
  } else {
    console.log('[Pick2D] 未命中 MVT 要素');
    highlightedFeatureId = null;
    if (highlightLayer) highlightLayer.changed();
    clearOutlineLayer();
    showInfoFromObject({ '位置': coordinate[0].toFixed(6) + ', ' + coordinate[1].toFixed(6), '状态': '未命中要素' }, '二维拾取');
  }
}

// ── 属性信息展示 ──

function showBasicPickInfo(layer, picked) {
  var info = {};
  if (picked.id !== undefined) info['SmID'] = picked.id;
  if (picked.height !== undefined) info['拾取高度'] = picked.height.toFixed(4) + 'm';
  if (layer._name) info['图层名称'] = layer._name;
  if (layer._groupName) info['组名'] = layer._groupName;
  ['lon', 'lat', 'height'].forEach(function (k) { if (layer[k] !== undefined) info[k] = layer[k]; });
  showInfoFromObject(info, '三维拾取');
}

function showInfoFromObject(info, sourceLabel) {
  if (!info || Object.keys(info).length === 0) return;

  var skipKeys = ['SMINDEXKEY', 'SMBIMINFO'];
  var html = '';
  if (sourceLabel) {
    html += '<div class="info-source-label">' + sourceLabel + '</div>';
  }
  html += '<table>';
  var entries = Object.entries(info);
  for (var i = 0; i < entries.length; i++) {
    var key = entries[i][0];
    var val = entries[i][1];
    if (val === undefined || val === null || val === '') continue;
    if (skipKeys.indexOf(key.toUpperCase()) !== -1) continue;
    if (typeof val === 'object') continue;
    html += '<tr><td>' + key + '</td><td>' + val + '</td></tr>';
  }
  html += '</table>';

  document.getElementById('info-content').innerHTML = html;
  document.getElementById('info-panel').style.display = 'flex';
  statusEl.textContent = '已获取属性 (' + Object.keys(info).length + ' 个字段)';
}

// ══════════════════════════════════════════════════
// 工具栏事件
// ══════════════════════════════════════════════════

var pickModeBtn = document.getElementById('btn-pick-mode');
pickModeBtn.addEventListener('click', function () {
  pickEnabled = !pickEnabled;
  pickModeBtn.classList.toggle('pick-active', pickEnabled);
  pickModeBtn.textContent = pickEnabled ? '拾取中...' : '拾取查询';
  statusEl.textContent = pickEnabled ? '点击场景进行拾取查询' : '就绪';

  var pickCursor = pickEnabled ? 'crosshair' : '';
  if (map2D && map2D.getTargetElement()) {
    map2D.getTargetElement().style.cursor = pickCursor;
  }
  if (viewer3D && viewer3D.scene && viewer3D.scene.canvas) {
    viewer3D.scene.canvas.style.cursor = pickCursor;
  }
  console.log('[Toolbar] 拾取模式: ' + (pickEnabled ? '开启' : '关闭'));
});

document.getElementById('btn-clear-pick').addEventListener('click', function () {
  if (syncController) {
    syncController.clearAllPick();
    syncController.clearS3MHighlight(sceneLayers);
  }
  highlightedFeatureId = null;
  highlightedAttr = null;
  if (highlightLayer) highlightLayer.changed();
  clearOutlineLayer();
  document.getElementById('info-panel').style.display = 'none';
  statusEl.textContent = '已清除拾取';
  console.log('[Toolbar] 已清除所有拾取');
});

document.getElementById('btn-reset').addEventListener('click', function () {
  // 复位 Cesium 三维视角
  if (initialCamera) {
    viewer3D.scene.camera.flyTo({
      destination: initialCamera.destination,
      orientation: initialCamera.orientation,
      duration: 1.5,
    });
    console.log('[Toolbar] 三维视角已复位');
  } else {
    console.warn('[Toolbar] 三维复位失败: 初始视角尚未记录');
  }

  // 复位 OpenLayers 二维视角
  if (map2D && initialOLView) {
    var view = map2D.getView();
    if (initialOLView.center) {
      view.animate({
        center: initialOLView.center,
        zoom: initialOLView.zoom,
        rotation: initialOLView.rotation || 0,
        duration: 800,
      });
    }
    console.log('[Toolbar] 二维视角已复位');
  }

  statusEl.textContent = '已复位视角（三维 + 二维）';
});

// 图层管理面板
var layerPanel = document.getElementById('layer-panel');
var layerPanelBtn = document.getElementById('btn-layer-panel');
var layerPanelToggle = document.getElementById('layer-panel-toggle');

layerPanelBtn.addEventListener('click', function () {
  layerPanel.classList.toggle('collapsed');
  layerPanelBtn.classList.toggle('active', !layerPanel.classList.contains('collapsed'));
});

layerPanelToggle.addEventListener('click', function () {
  layerPanel.classList.add('collapsed');
  layerPanelBtn.classList.remove('active');
});

document.querySelectorAll('.layer-group-header').forEach(function (header) {
  header.addEventListener('click', function () { header.classList.toggle('collapsed'); });
});

document.getElementById('info-close').addEventListener('click', function () {
  document.getElementById('info-panel').style.display = 'none';
});

// ── 分割线拖拽 ──
var divider = document.getElementById('divider');
var container = document.getElementById('main-container');
var panelLeft = document.getElementById('panel-left');
var panelRight = document.getElementById('panel-right');
var isDragging = false;

divider.addEventListener('pointerdown', function (e) {
  isDragging = true;
  divider.classList.add('dragging');
  divider.setPointerCapture(e.pointerId);
  e.preventDefault();
});

document.addEventListener('pointermove', function (e) {
  if (!isDragging) return;
  var rect = container.getBoundingClientRect();
  var ratio = Math.max(0.2, Math.min(0.8, (e.clientX - rect.left) / rect.width));
  panelLeft.style.flex = '0 0 ' + (ratio * 100) + '%';
  panelRight.style.flex = '0 0 ' + ((1 - ratio) * 100) + '%';
});

var stopDrag = function () {
  if (isDragging) {
    isDragging = false;
    divider.classList.remove('dragging');
    viewer3D.resize();
    if (map2D) map2D.updateSize();
  }
};
document.addEventListener('pointerup', stopDrag);
document.addEventListener('pointercancel', stopDrag);

// ── 状态栏 ──
viewer3D.scene.postRender.addEventListener(function () {
  var cam = viewer3D.scene.camera.positionCartographic;
  var lng = Cesium.Math.toDegrees(cam.longitude).toFixed(6);
  var lat = Cesium.Math.toDegrees(cam.latitude).toFixed(6);
  var alt = cam.height.toFixed(1);
  cameraInfoEl.textContent = '3D 经度:' + lng + '° 纬度:' + lat + '° 高度:' + alt + 'm';
});

function updateOLCameraInfo() {
  if (!map2D) return;
  var view = map2D.getView();
  var center = view.getCenter();
  var zoom = view.getZoom();
  var resolution = view.getResolution();
  if (!center) return;
  var olInfoStr = '2D 中心:[' + center[0].toFixed(2) + ', ' + center[1].toFixed(2) + '] ' +
    'Z:' + (zoom !== undefined ? zoom.toFixed(1) : '--') + ' ' +
    'Res:' + (resolution !== undefined ? resolution.toFixed(4) : '--');
  var olInfoEl = document.getElementById('ol-camera-info');
  if (olInfoEl) olInfoEl.textContent = olInfoStr;
}

// 活跃源追踪 DOM 引用（供 initAfterMapCreated 使用）
var panelLeftEl = document.getElementById('panel-left');
var panelRightEl = document.getElementById('panel-right');
var activeSourceEl = document.getElementById('active-source-info');

renderLayerPanel();
console.log('[CesiumOLSync] 二三维联动应用已启动 (Cesium + OpenLayers MVT)');
