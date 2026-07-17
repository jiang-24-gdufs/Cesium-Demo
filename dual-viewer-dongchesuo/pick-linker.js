/**
 * PickLinker - 拾取联动控制器
 *
 * 核心功能：
 * 1. ViewerA (S3M) 点击拾取 -> 查询属性 -> 在 ViewerB (3DTileset) 中高亮匹配 feature
 * 2. ViewerB (3DTileset) 点击拾取 -> 展示属性 -> 在 ViewerA (S3M) 中高亮匹配对象
 *
 * 联动键：优先 UNIQUEID，降级到 ELEMENTID / SmID
 */
export class PickLinker {
  constructor(viewerA, viewerB, syncController) {
    this._viewerA = viewerA;
    this._viewerB = viewerB;
    this._sync = syncController;

    this._pickEnabled = false;
    this._linkEnabled = true;

    this._handlerA = null;
    this._handlerB = null;

    this._modelLayers = [];
    this._sectionTileset = null;
    this._lastHighlightedFeature = null;

    this._DATA_URL = 'https://ct.sunrtcloud.com/iserver/services/data-dongchesuotest/rest/data';
    this._DATA_SOURCE = 'dongchesuo';
    this._DATASETS = [
      'Line_dongchesuo', 'changguimoxing_dongchesuo', 'chuang_dongchesuo',
      'jiegoujichu_dongchesuo', 'jiegoukuangjia_dongchesuo', 'langanfushou_dongchesuo',
      'louban_dongchesuo', 'louti_dongchesuo', 'men_dongchesuo',
      'muqiangqianbaj_dongchesuo', 'podao_dongchesuo', 'qiang_dongchesuo',
      'tianhuaban_dongchesuo', 'wuding_dongchesuo', 'zhuanyongshebei_dongchesuo',
    ];

    this._statusEl = document.getElementById('status-text');
    this._infoPanelEl = document.getElementById('info-panel');
    this._infoContentEl = document.getElementById('info-content');

    this._initHandlers();
    this._initInfoClose();
  }

  setModelLayers(layers) { this._modelLayers = layers || []; }
  setSectionTileset(tileset) { this._sectionTileset = tileset; }

  // 向后兼容旧的 setSectionLayers 调用
  setSectionLayers() {}

  get pickEnabled() { return this._pickEnabled; }
  get linkEnabled() { return this._linkEnabled; }

  togglePick(enabled) {
    this._pickEnabled = typeof enabled === 'boolean' ? enabled : !this._pickEnabled;
    return this._pickEnabled;
  }

  toggleLink(enabled) {
    this._linkEnabled = typeof enabled === 'boolean' ? enabled : !this._linkEnabled;
    return this._linkEnabled;
  }

  _initHandlers() {
    this._handlerA = new Cesium.ScreenSpaceEventHandler(this._viewerA.scene.canvas);
    this._handlerB = new Cesium.ScreenSpaceEventHandler(this._viewerB.scene.canvas);

    this._handlerA.setInputAction((e) => this._onPickA(e), Cesium.ScreenSpaceEventType.LEFT_CLICK);
    this._handlerB.setInputAction((e) => this._onPickB(e), Cesium.ScreenSpaceEventType.LEFT_CLICK);
  }

  _initInfoClose() {
    document.getElementById('info-close').addEventListener('click', () => {
      this._infoPanelEl.style.display = 'none';
    });
  }

  /**
   * ViewerA 拾取 (S3M Layer)
   */
  _onPickA(event) {
    if (!this._pickEnabled) return;

    const scene = this._viewerA.scene;
    const picked = scene.pick(event.position);

    if (!Cesium.defined(picked) || !picked.primitive) {
      this._statusEl.textContent = '未拾取到对象';
      return;
    }

    const layer = picked.primitive;
    const smId = picked.id;

    if (smId === undefined || smId === null) {
      this._showBasicInfo(layer, picked);
      return;
    }

    this._statusEl.textContent = `拾取: SmID=${smId}，查询属性中...`;

    if (layer.setSelection) {
      layer.setSelection([smId]);
    }

    const matchedDs = this._matchDataset(layer);

    if (matchedDs && layer.hasQueryAttrAction) {
      this._queryModelAndLink(matchedDs, smId, layer);
    } else {
      this._showBasicInfo(layer, picked);
    }
  }

  /**
   * ViewerB 拾取 (Cesium3DTileFeature)
   */
  _onPickB(event) {
    if (!this._pickEnabled) return;

    const scene = this._viewerB.scene;
    const picked = scene.pick(event.position);

    if (!Cesium.defined(picked)) {
      this._statusEl.textContent = '未拾取到对象';
      return;
    }

    if (picked instanceof Cesium.Cesium3DTileFeature) {
      this._onPickTileFeature(picked);
      return;
    }

    // 可能是其他 primitive
    this._statusEl.textContent = '拾取到非 3DTile 对象';
    console.log('[PickB] non-tile picked:', picked);
  }

  /**
   * 处理 3DTileFeature 拾取
   */
  _onPickTileFeature(feature) {
    this._clearTileHighlight();

    feature.color = Cesium.Color.YELLOW.withAlpha(0.7);
    this._lastHighlightedFeature = feature;

    const propertyIds = feature.getPropertyIds ? feature.getPropertyIds() : (feature.getPropertyNames ? feature.getPropertyNames() : []);
    const info = {};
    for (const name of propertyIds) {
      const val = feature.getProperty(name);
      if (val !== undefined && val !== null && val !== '') {
        info[name] = val;
      }
    }

    this._showInfo(info);
    this._statusEl.textContent = `拾取剖面图 Feature (${propertyIds.length} 个属性)`;

    if (this._linkEnabled) {
      const linkKey = info['UNIQUEID'] || info['UniqueId'] || info['uniqueid']
        || info['ELEMENTID'] || info['ElementId'] || info['elementid']
        || info['elementId'];

      if (linkKey) {
        this._highlightInModelByKey(linkKey);
      }
    }
  }

  /**
   * A→B: 查询模型属性后在 3DTileset 中联动高亮
   */
  _queryModelAndLink(datasetName, smId, sourceLayer) {
    const fullName = `${this._DATA_SOURCE}:${datasetName}`;
    this._doSqlQuery(fullName, `SmID = ${smId}`, (features) => {
      if (!features || features.length === 0) {
        this._statusEl.textContent = `查询无结果 (SmID=${smId})`;
        return;
      }

      const feat = features[0];
      const info = this._featureToInfo(feat);
      this._showInfo(info);

      if (this._linkEnabled && this._sectionTileset) {
        const linkKey = info['UNIQUEID'] || info['UniqueId'] || info['uniqueid']
          || info['ELEMENTID'] || info['ElementId'] || info['elementid']
          || info['elementId'];

        if (linkKey) {
          this._highlightInTileset(linkKey);
        }
      }
    });
  }

  /**
   * 在 3DTileset 中遍历所有可见 tile，找到匹配的 feature 并高亮
   */
  _highlightInTileset(linkKey) {
    if (!this._sectionTileset) return;

    this._clearTileHighlight();

    const root = this._sectionTileset.root;
    if (!root) {
      this._statusEl.textContent = '剖面图 tileset 尚未就绪';
      return;
    }

    const keyStr = String(linkKey);
    let found = false;

    const searchTile = (tile) => {
      if (found) return;
      if (tile.content) {
        const count = tile.content.featuresLength || 0;
        for (let i = 0; i < count; i++) {
          const feature = tile.content.getFeature(i);
          const fUniqueId = this._getFeatureProperty(feature, ['UNIQUEID', 'UniqueId', 'uniqueid']);
          const fElementId = this._getFeatureProperty(feature, ['ELEMENTID', 'ElementId', 'elementid', 'elementId']);

          if ((fUniqueId && String(fUniqueId) === keyStr) || (fElementId && String(fElementId) === keyStr)) {
            feature.color = Cesium.Color.YELLOW.withAlpha(0.7);
            this._lastHighlightedFeature = feature;
            found = true;
            this._statusEl.textContent = `已在剖面图中高亮匹配对象 (key=${keyStr})`;
            return;
          }
        }
      }
      if (tile.children) {
        for (const child of tile.children) {
          searchTile(child);
          if (found) return;
        }
      }
    };

    searchTile(root);

    if (!found) {
      this._statusEl.textContent = `剖面图中未找到匹配对象 (key=${keyStr})`;
    }
  }

  /**
   * B→A: 通过属性键值在 S3M 模型图层中查找并高亮
   */
  _highlightInModelByKey(linkKey) {
    if (this._modelLayers.length === 0) return;

    this._statusEl.textContent = `正在三维模型中查找 (key=${linkKey})...`;

    const keyStr = String(linkKey);
    const isNumeric = /^\d+$/.test(keyStr);

    const filterByUniqueId = `UNIQUEID = '${keyStr}'`;
    const filterByElementId = isNumeric ? `ELEMENTID = ${keyStr}` : `ELEMENTID = '${keyStr}'`;

    for (const ds of this._DATASETS) {
      const fullName = `${this._DATA_SOURCE}:${ds}`;

      this._doSqlQuery(fullName, filterByUniqueId, (features) => {
        if (features && features.length > 0) {
          this._highlightModelFeature(features[0], ds, keyStr);
          return;
        }

        this._doSqlQuery(fullName, filterByElementId, (features2) => {
          if (features2 && features2.length > 0) {
            this._highlightModelFeature(features2[0], ds, keyStr);
          }
        });
      });
    }
  }

  _highlightModelFeature(feat, datasetName, linkKey) {
    let smId = null;
    for (let i = 0; i < feat.fieldNames.length; i++) {
      if (feat.fieldNames[i].toUpperCase() === 'SMID') {
        smId = parseInt(feat.fieldValues[i]);
        break;
      }
    }

    if (smId === null) return;

    const dsClean = datasetName.replace('_dongchesuo', '').toLowerCase();
    for (const layer of this._modelLayers) {
      const layerName = (layer._name || layer.name || '').toLowerCase();
      if (layerName.indexOf(dsClean) !== -1 || dsClean.indexOf(layerName) !== -1) {
        if (layer.setSelection) {
          layer.setSelection([smId]);
          this._statusEl.textContent = `已在三维模型中高亮 (SmID=${smId}, key=${linkKey})`;
        }
        return;
      }
    }

    for (const layer of this._modelLayers) {
      if (layer.setSelection) {
        try { layer.setSelection([smId]); } catch (_) {}
      }
    }
    this._statusEl.textContent = `已在三维模型中高亮 (SmID=${smId}, key=${linkKey})`;
  }

  _getFeatureProperty(feature, candidates) {
    for (const key of candidates) {
      try {
        const val = feature.getProperty(key);
        if (val !== undefined && val !== null) return val;
      } catch (_) {}
    }
    return null;
  }

  _clearTileHighlight() {
    if (this._lastHighlightedFeature) {
      try {
        this._lastHighlightedFeature.color = Cesium.Color.WHITE;
      } catch (_) {}
      this._lastHighlightedFeature = null;
    }
  }

  _matchDataset(layer) {
    const layerName = (layer._name || layer.name || '').toLowerCase();
    for (const ds of this._DATASETS) {
      const dsClean = ds.replace('_dongchesuo', '').toLowerCase();
      if (layerName.indexOf(dsClean) !== -1 || dsClean.indexOf(layerName) !== -1) {
        return ds;
      }
    }
    return this._DATASETS.length > 1 ? this._DATASETS[1] : this._DATASETS[0];
  }

  clearAllSelection() {
    for (const layer of this._modelLayers) {
      try {
        if (layer.releaseSelection) layer.releaseSelection();
        if (layer.setSelection) layer.setSelection([]);
      } catch (_) {}
    }

    this._clearTileHighlight();

    this._infoPanelEl.style.display = 'none';
    this._statusEl.textContent = '已清除拾取';
  }

  _showBasicInfo(layer, picked) {
    const info = {};
    if (picked.id !== undefined) info['对象ID (SmID)'] = picked.id;
    if (picked.height !== undefined) info['拾取高度'] = picked.height.toFixed(4) + 'm';
    if (layer._name) info['图层名称'] = layer._name;
    if (layer._groupName) info['组名'] = layer._groupName;
    ['lon', 'lat', 'height'].forEach((k) => {
      if (layer[k] !== undefined) info[k] = layer[k];
    });
    this._showInfo(info);
  }

  _showInfo(info) {
    if (!info || Object.keys(info).length === 0) {
      this._statusEl.textContent = '未获取到属性信息';
      return;
    }

    const skipKeys = ['SMINDEXKEY', 'SMBIMINFO'];
    let html = '<table>';
    for (const [key, val] of Object.entries(info)) {
      if (val === undefined || val === null || val === '') continue;
      if (skipKeys.includes(key.toUpperCase())) continue;
      html += `<tr><td>${key}</td><td>${val}</td></tr>`;
    }
    html += '</table>';

    this._infoContentEl.innerHTML = html;
    this._infoPanelEl.style.display = 'flex';
    this._statusEl.textContent = `已获取属性 (${Object.keys(info).length} 个字段)`;
  }

  _featureToInfo(feat) {
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

  _doSqlQuery(datasetName, filter, onSuccess) {
    try {
      const getFeatureParam = new SuperMap.REST.FilterParameter({
        attributeFilter: filter,
      });
      const params = new SuperMap.REST.GetFeaturesBySQLParameters({
        queryParameter: getFeatureParam,
        toIndex: 49,
        datasetNames: [datasetName],
        returnContent: true,
      });
      const service = new SuperMap.REST.GetFeaturesBySQLService(this._DATA_URL, {
        eventListeners: {
          processCompleted: (resultSet) => {
            if (resultSet.result && resultSet.result.features && resultSet.result.features.length > 0) {
              onSuccess(resultSet.result.features);
            } else {
              onSuccess([]);
            }
          },
          processFailed: (err) => {
            console.warn('SQL 查询失败:', err);
            onSuccess([]);
          },
        },
      });
      service.processAsync(params);
    } catch (e) {
      console.error('doSqlQuery error:', e);
      onSuccess([]);
    }
  }

  destroy() {
    if (this._handlerA) this._handlerA.destroy();
    if (this._handlerB) this._handlerB.destroy();
  }
}
