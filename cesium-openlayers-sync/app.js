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
    ? (function () {
        var res = [];
        var inchPerMeter = 1 / 0.0254;
        for (var i = 0; i < originResult.visibleScales.length; i++) {
          res.push(1 / (originResult.visibleScales[i] * 96 * inchPerMeter * 1));
        }
        return res;
      })()
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
          stroke: new ol.style.Stroke({ color: '#ff4757', width: 3 }),
          fill: new ol.style.Fill({ color: 'rgba(255, 71, 87, 0.3)' }),
        });
      }
      return null;
    },
  });
  map2D.addLayer(highlightLayer);
  console.log('[OL] 高亮图层已创建');
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

    for (var i = 0; i < sceneLayers.length; i++) {
      (function (idx) {
        var layer = sceneLayers[idx];
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
      })(i);
    }
  }

  var olLayers = [];
  if (mvtLayer) {
    olLayers.push({ name: '动车所 MVT 矢量瓦片', layer: mvtLayer, type: 'overlay' });
  }

  count2D.textContent = olLayers.length;
  list2D.innerHTML = '';

  for (var j = 0; j < olLayers.length; j++) {
    (function (item) {
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
    })(olLayers[j]);
  }

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
  if (layer._boundingSphere && layer._boundingSphere.center &&
      !Cesium.Cartesian3.equals(layer._boundingSphere.center, Cesium.Cartesian3.ZERO)) {
    var offset = new Cesium.HeadingPitchRange(0, Cesium.Math.toRadians(-45), layer._boundingSphere.radius * 2.5);
    viewer3D.scene.camera.flyToBoundingSphere(layer._boundingSphere, { offset: offset, duration: 1.5 });
    statusEl.textContent = '已定位到图层: ' + layerName;
    return;
  }
  if (layer._layerBounds && layer._layerBounds.west !== undefined) {
    var b = layer._layerBounds;
    viewer3D.scene.camera.flyTo({ destination: Cesium.Rectangle.fromDegrees(b.west, b.south, b.east, b.north), duration: 1.5 });
    statusEl.textContent = '已定位到图层: ' + layerName;
    return;
  }
  if (layer.lon !== undefined && layer.lat !== undefined) {
    viewer3D.scene.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(layer.lon, layer.lat, (layer.height || 0) + 500),
      orientation: { heading: 0, pitch: Cesium.Math.toRadians(-45), roll: 0 },
      duration: 1.5,
    });
    statusEl.textContent = '已定位到图层: ' + layerName;
    return;
  }
  statusEl.textContent = '该图层无范围信息，无法定位';
  console.warn('[Navigate] 图层 "' + layerName + '" 无范围信息');
}

// ══════════════════════════════════════════════════
// 拾取与联动
// ══════════════════════════════════════════════════

var pickEnabled = false;

function doSqlQuery(serviceUrl, datasetName, filter, onSuccess) {
  if (!serviceUrl) { onSuccess([]); return; }
  try {
    var getFeatureParam = new SuperMap.REST.FilterParameter({ attributeFilter: filter });
    var params = new SuperMap.REST.GetFeaturesBySQLParameters({
      queryParameter: getFeatureParam,
      toIndex: 49,
      datasetNames: [datasetName],
      returnContent: true,
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
  // 优先使用 ElementID 作为联动 key（数值型，跨二三维一致）
  var elementId = info['ElementID'] || info['ELEMENTID'] || info['ElementId'] || info['elementid'] || info['elementId'];
  if (elementId) return String(elementId);

  var uniqueId = info['UNIQUEID'] || info['UniqueId'] || info['uniqueid'];
  if (uniqueId) return uniqueId;

  var blockName = info['BlockName'] || info['blockName'] || info['BLOCKNAME'];
  if (blockName) {
    var match = blockName.match(/_dwg-(\d+)-/);
    if (match) {
      console.log('[LinkKey] 从 BlockName 解析出 ElementID: ' + match[1]);
      return match[1];
    }
  }
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

function highlightInModelByKey(linkKey) {
  if (sceneLayers.length === 0) return;
  var keyStr = String(linkKey);
  var isNumeric = /^\d+$/.test(keyStr);

  // 先清除上一次的三维高亮
  if (syncController) {
    syncController.clearS3MHighlight(sceneLayers);
    syncController.clearPickEntity3D();
  }

  console.log('[Pick→3D] 查找: key="' + keyStr + '" (' + (isNumeric ? 'ElementID' : 'UUID') + '), 遍历 ' + DATASETS.length + ' 个数据集');
  statusEl.textContent = '正在三维模型中查找 (key=' + keyStr + ')...';

  var found = false;
  var filterByElementId = isNumeric ? ('ELEMENTID = ' + keyStr) : ("ELEMENTID = '" + keyStr + "'");

  for (var i = 0; i < DATASETS.length; i++) {
    (function (ds) {
      var fullName = DATA_SOURCE + ':' + ds;

      if (isNumeric) {
        doSqlQuery(DATA_URL, fullName, filterByElementId, function (features) {
          if (found) return;
          if (features.length > 0) {
            found = true;
            doHighlight3D(features[0], ds, keyStr);
          }
        });
      } else {
        var filterByUniqueId = "UNIQUEID = '" + keyStr + "'";
        doSqlQuery(DATA_URL, fullName, filterByUniqueId, function (features) {
          if (found) return;
          if (features.length > 0) {
            found = true;
            doHighlight3D(features[0], ds, keyStr);
            return;
          }
          doSqlQuery(DATA_URL, fullName, filterByElementId, function (features2) {
            if (found) return;
            if (features2.length > 0) {
              found = true;
              doHighlight3D(features2[0], ds, keyStr);
            }
          });
        });
      }
    })(DATASETS[i]);
  }
}

function doHighlight3D(feat, datasetName, linkKey) {
  var smId = extractSmId(feat);
  if (smId === null) return;

  // 1. 清除上一次高亮
  if (syncController) {
    syncController.clearS3MHighlight(sceneLayers);
    syncController.clearPickEntity3D();
  }

  // 2. 匹配目标图层
  var dsClean = datasetName.replace('_dongchesuo', '').toLowerCase();
  var targetLayer = null;

  for (var i = 0; i < sceneLayers.length; i++) {
    var layer = sceneLayers[i];
    var layerName = (layer._name || layer.name || '').toLowerCase();
    if (layerName.indexOf(dsClean) !== -1 || dsClean.indexOf(layerName) !== -1) {
      targetLayer = layer;
      break;
    }
  }

  // 3. 高亮 — 通过 syncController 统一管理（黄色 selectedColor）
  if (targetLayer && syncController) {
    syncController.highlightS3MObject(targetLayer, [smId]);
  } else if (targetLayer && targetLayer.setSelection) {
    targetLayer.selectedColor = new Cesium.Color(1.0, 0.9, 0.0, 0.6);
    targetLayer.setSelection([smId]);
    console.log('[Pick→3D] 已高亮三维图层 "' + (targetLayer._name || '?') + '", SmID=' + smId + ', key=' + linkKey);
  }

  // 4. 定位 — 优先使用要素的 SMSDRI 包围盒精确定位
  var fields = extractFieldsMap(feat);
  var positioned = false;

  if (syncController && fields) {
    positioned = syncController.flyToFeatureBounds(fields, mercatorToLonLat, linkKey);
  }

  // fallback: 使用要素中心点定位
  if (!positioned) {
    var geomCenter = extractFeatureCenter(feat);
    if (geomCenter) {
      viewer3D.scene.camera.flyTo({
        destination: Cesium.Cartesian3.fromDegrees(geomCenter[0], geomCenter[1], (geomCenter[2] || 0) + 150),
        orientation: {
          heading: Cesium.Math.toRadians(0),
          pitch: Cesium.Math.toRadians(-45),
          roll: 0,
        },
        duration: 1.2,
      });
      console.log('[Pick→3D] fallback 飞行定位: lng=' + geomCenter[0].toFixed(6) + ', lat=' + geomCenter[1].toFixed(6) + ', key=' + linkKey);

      if (syncController) {
        syncController.showPickEntity3D(geomCenter[0], geomCenter[1], geomCenter[2] || 0, 'ID:' + linkKey);
      }
    } else if (targetLayer && targetLayer._boundingSphere && targetLayer._boundingSphere.center &&
        !Cesium.Cartesian3.equals(targetLayer._boundingSphere.center, Cesium.Cartesian3.ZERO)) {
      var offset = new Cesium.HeadingPitchRange(0, Cesium.Math.toRadians(-45), targetLayer._boundingSphere.radius * 1.5);
      viewer3D.scene.camera.flyToBoundingSphere(targetLayer._boundingSphere, { offset: offset, duration: 1.2 });
      console.log('[Pick→3D] 无精确坐标，飞行定位到图层包围球, key=' + linkKey);
    }
  }

  statusEl.textContent = '已在三维模型中定位+高亮 (SmID=' + smId + ', key=' + linkKey + ')';
}

/**
 * 从 iServer feature 中提取字段为大写 key 的 map
 */
function extractFieldsMap(feat) {
  if (!feat) return null;
  var fields = {};
  if (feat.fieldNames && feat.fieldValues) {
    for (var i = 0; i < feat.fieldNames.length; i++) {
      fields[feat.fieldNames[i].toUpperCase()] = feat.fieldValues[i];
    }
    return fields;
  }
  if (feat.data) {
    var keys = Object.keys(feat.data);
    for (var j = 0; j < keys.length; j++) {
      fields[keys[j].toUpperCase()] = feat.data[keys[j]];
    }
    return fields;
  }
  if (feat.attributes) {
    var akeys = Object.keys(feat.attributes);
    for (var k = 0; k < akeys.length; k++) {
      fields[akeys[k].toUpperCase()] = feat.attributes[akeys[k]];
    }
    return fields;
  }
  return null;
}


function extractFeatureCenter(feat) {
  // iServer 返回的坐标是 EPSG:3857 墨卡托投影坐标（单位：米），需要转换为经纬度
  var projCoord = extractFeatureProjCoord(feat);
  if (!projCoord) return null;

  // 墨卡托 → 经纬度
  var lonlat = mercatorToLonLat(projCoord[0], projCoord[1]);
  return [lonlat[0], lonlat[1], projCoord[2] || 0];
}

function extractFeatureProjCoord(feat) {
  // 从 iServer feature 中提取投影坐标（EPSG:3857 墨卡托，单位米）
  if (feat.geometry && feat.geometry.center) {
    return [feat.geometry.center.x, feat.geometry.center.y, feat.geometry.center.z || 0];
  }
  if (feat.geometry && feat.geometry.points && feat.geometry.points.length > 0) {
    var pts = feat.geometry.points;
    var sumX = 0, sumY = 0, sumZ = 0;
    for (var i = 0; i < pts.length; i++) {
      sumX += pts[i].x;
      sumY += pts[i].y;
      sumZ += (pts[i].z || 0);
    }
    return [sumX / pts.length, sumY / pts.length, sumZ / pts.length];
  }
  if (feat.fieldNames && feat.fieldValues) {
    var fields = {};
    for (var fi = 0; fi < feat.fieldNames.length; fi++) {
      fields[feat.fieldNames[fi].toUpperCase()] = feat.fieldValues[fi];
    }

    // 优先 SmX/SmY
    if (fields['SMX'] && fields['SMY']) {
      var x = parseFloat(fields['SMX']);
      var y = parseFloat(fields['SMY']);
      var z = fields['SMZ'] ? parseFloat(fields['SMZ']) : 0;
      if (!isNaN(x) && !isNaN(y) && Math.abs(x) > 1) return [x, y, z];
    }

    // fallback: 使用 SMSDRI 范围字段的中心
    if (fields['SMSDRIW'] && fields['SMSDRIE'] && fields['SMSDRIN'] && fields['SMSDRIS']) {
      var cx = (parseFloat(fields['SMSDRIW']) + parseFloat(fields['SMSDRIE'])) / 2;
      var cy = (parseFloat(fields['SMSDRIN']) + parseFloat(fields['SMSDRIS'])) / 2;
      var cz = 0;
      if (fields['SMMINZ'] && fields['SMMAXZ']) {
        cz = (parseFloat(fields['SMMINZ']) + parseFloat(fields['SMMAXZ'])) / 2;
      }
      if (!isNaN(cx) && !isNaN(cy) && Math.abs(cx) > 1) return [cx, cy, cz];
    }

    // fallback: 使用 SMMAXZ/SMMINZ 获取高度，但无 XY 则放弃
  }
  return null;
}

function mercatorToLonLat(mx, my) {
  // EPSG:3857 墨卡托坐标 → EPSG:4326 经纬度
  var lon = (mx / 20037508.342789244) * 180;
  var lat = (my / 20037508.342789244) * 180;
  lat = (180 / Math.PI) * (2 * Math.atan(Math.exp(lat * Math.PI / 180)) - Math.PI / 2);
  return [lon, lat];
}

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
        var elementId = info['ELEMENTID'] || info['ElementId'] || info['elementId'];
        var uniqueId = info['UNIQUEID'] || info['UniqueId'] || info['uniqueid'];
        console.log('[Pick3D] 查询到属性:', {
          字段数: Object.keys(info).length,
          ELEMENTID: elementId || '无',
          UNIQUEID: uniqueId || '无',
          SmID: smId,
          数据集: ds,
        });
        showInfoFromObject(info, '三维拾取');

        if (syncController && syncController.pickSyncEnabled) {
          linkPick3Dto2D(event.position, info, smId);
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

function linkPick3Dto2D(screenPos, info, smId) {
  var elementId = info ? (info['ELEMENTID'] || info['ElementId'] || info['elementId']) : null;
  var linkField = elementId ? ('ELEMENTID=' + elementId) : ('SmID=' + smId);

  // 优先通过数据服务查询要素的投影坐标（更精确），fallback 用 pickPosition
  if (elementId) {
    queryFeatureCoordFor2D(elementId, function (olCoord) {
      if (olCoord) {
        console.log('[Pick3D→2D] 通过数据服务定位二维: coord=[' + olCoord[0].toFixed(2) + ',' + olCoord[1].toFixed(2) + '], ' + linkField);
        flyOLToCoord(olCoord);
        highlightMVTFeatureByAttr('ElementID', elementId);
      } else {
        // fallback: 使用 Cesium pickPosition 转投影坐标
        linkPick3Dto2DByScreenPos(screenPos, elementId, linkField);
      }
    });
  } else {
    linkPick3Dto2DByScreenPos(screenPos, elementId, linkField);
  }
}

function linkPick3Dto2DByScreenPos(screenPos, elementId, linkField) {
  var cartesian = viewer3D.scene.pickPosition(screenPos);
  if (!cartesian) return;
  var carto = Cesium.Cartographic.fromCartesian(cartesian);
  var lng = Cesium.Math.toDegrees(carto.longitude);
  var lat = Cesium.Math.toDegrees(carto.latitude);

  var olCoord = ol.proj.fromLonLat([lng, lat]);
  console.log('[Pick3D→2D] 通过屏幕坐标定位二维: lonlat=(' + lng.toFixed(6) + ',' + lat.toFixed(6) + '), proj=(' + olCoord[0].toFixed(2) + ',' + olCoord[1].toFixed(2) + '), ' + linkField);

  flyOLToCoord(olCoord);

  if (elementId && mvtLayer) {
    highlightMVTFeatureByAttr('ElementID', elementId);
  }
}

function queryFeatureCoordFor2D(elementId, callback) {
  // 通过 iServer 数据服务查询要素的墨卡托坐标，用于精确定位 OL 地图
  var found = false;
  var pending = DATASETS.length;
  var filter = 'ELEMENTID = ' + elementId;

  for (var i = 0; i < DATASETS.length; i++) {
    (function (ds) {
      var fullName = DATA_SOURCE + ':' + ds;
      doSqlQuery(DATA_URL, fullName, filter, function (features) {
        pending--;
        if (found) return;
        if (features.length > 0) {
          found = true;
          var projCoord = extractFeatureProjCoord(features[0]);
          if (projCoord) {
            // 返回墨卡托坐标，直接用于 OL（OL 就是 EPSG:3857）
            callback([projCoord[0], projCoord[1]]);
          } else {
            callback(null);
          }
        } else if (pending === 0) {
          callback(null);
        }
      });
    })(DATASETS[i]);
  }
}

function flyOLToCoord(olCoord) {
  if (!map2D) return;
  if (syncController) syncController.showPickMarker2D(olCoord);

  var view = map2D.getView();
  var resolutions = view.getResolutions();
  // 使用倒数第二级分辨率（较高细节），确保不超出范围
  var maxZoomIdx = resolutions ? resolutions.length - 1 : 5;
  var targetZoom = Math.min(maxZoomIdx, Math.max(view.getZoom() || 0, maxZoomIdx - 1));

  view.animate({
    center: olCoord,
    zoom: targetZoom,
    duration: 800,
  });
}

function highlightMVTFeature(elementId) {
  highlightMVTFeatureByAttr('ELEMENTID', elementId);
}

function highlightMVTFeatureByAttr(attrName, attrValue) {
  highlightedFeatureId = null;
  highlightedAttr = { name: attrName, value: String(attrValue) };

  if (highlightLayer) {
    highlightLayer.changed();
    console.log('[OL] 高亮 MVT 要素: ' + attrName + '=' + attrValue);
  }
}

var highlightedAttr = null;

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

  if (syncController) syncController.showPickMarker2D(coordinate);

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

    showInfoFromObject(props, '二维拾取 (MVT)');

    if (syncController && syncController.pickSyncEnabled) {
      var linkKey = extractLinkKey(props);
      if (linkKey) {
        console.log('[Pick2D→3D] 联动定位+高亮: ElementID="' + linkKey + '"');
        highlightInModelByKey(linkKey);
      } else {
        console.log('[Pick2D→3D] 未找到有效联动字段，尝试 SmID');
        var smIdVal = props['SmID'] || props['SMID'] || props['smid'];
        if (smIdVal) {
          highlightInModelByKey(smIdVal);
        }
      }
      // 标注点由 doHighlight3D 中通过精确的要素几何坐标添加，这里不再重复
    }
  } else {
    console.log('[Pick2D] 未命中 MVT 要素');
    highlightedFeatureId = null;
    if (highlightLayer) highlightLayer.changed();
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

  if (map2D && map2D.getTargetElement()) {
    map2D.getTargetElement().style.cursor = pickEnabled ? 'crosshair' : '';
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
