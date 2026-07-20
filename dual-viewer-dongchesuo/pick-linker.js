/**
 * PickLinker - 拾取联动控制器
 *
 * 核心功能：
 * 1. ViewerA (S3M) 点击拾取 -> 查询属性 -> 在 ViewerB (S3M 剖面图) 中通过 UNIQUEID 高亮匹配图层对象
 * 2. ViewerB (S3M 剖面图) 点击拾取 -> 展示属性 -> 在 ViewerA (S3M) 中通过 UNIQUEID 高亮匹配对象
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
    this._sectionLayers = [];

    this._DATA_URL = 'https://ct.sunrtcloud.com/iserver/services/data-dongchesuotest/rest/data';
    this._DATA_SOURCE = 'dongchesuo';
    this._DATASETS = [
      'Line_dongchesuo', 'changguimoxing_dongchesuo', 'chuang_dongchesuo',
      'jiegoujichu_dongchesuo', 'jiegoukuangjia_dongchesuo', 'langanfushou_dongchesuo',
      'louban_dongchesuo', 'louti_dongchesuo', 'men_dongchesuo',
      'muqiangqianbaj_dongchesuo', 'podao_dongchesuo', 'qiang_dongchesuo',
      'tianhuaban_dongchesuo', 'wuding_dongchesuo', 'zhuanyongshebei_dongchesuo',
    ];

    this._SECTION_DATA_SOURCE = 'dongchesuo-dwg';
    this._SECTION_DATA_URL = '';

    this._statusEl = document.getElementById('status-text');
    this._infoPanelEl = document.getElementById('info-panel');
    this._infoContentEl = document.getElementById('info-content');

    this._initHandlers();
    this._initInfoClose();
  }

  setModelLayers(layers) { this._modelLayers = layers || []; }

  setSectionLayers(layers) { this._sectionLayers = layers || []; }

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

    this._handlerA.setInputAction((e) => this._onPickS3M(e, 'A'), Cesium.ScreenSpaceEventType.LEFT_CLICK);
    this._handlerB.setInputAction((e) => this._onPickS3M(e, 'B'), Cesium.ScreenSpaceEventType.LEFT_CLICK);
  }

  _initInfoClose() {
    document.getElementById('info-close').addEventListener('click', () => {
      this._infoPanelEl.style.display = 'none';
    });
  }

  /**
   * 通用 S3M 图层拾取（ViewerA / ViewerB 共用）
   */
  _onPickS3M(event, sourceId) {
    if (!this._pickEnabled) return;

    const viewer = sourceId === 'A' ? this._viewerA : this._viewerB;
    const scene = viewer.scene;
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

    const label = sourceId === 'A' ? '三维模型' : '剖面图';
    this._statusEl.textContent = `拾取 ${label}: SmID=${smId}，查询属性中...`;

    if (layer.setSelection) {
      layer.setSelection([smId]);
    }

    if (sourceId === 'A') {
      const matchedDs = this._matchDataset(layer, this._DATASETS);
      if (matchedDs && layer.hasQueryAttrAction) {
        this._queryAndLinkToSection(matchedDs, smId);
      } else {
        this._showBasicInfo(layer, picked);
      }
    } else {
      this._querySectionAndLinkToModel(layer, smId);
    }
  }

  /**
   * A→B: 查询三维模型属性后在剖面图 S3M 图层中联动高亮
   */
  _queryAndLinkToSection(datasetName, smId) {
    const fullName = `${this._DATA_SOURCE}:${datasetName}`;
    this._doSqlQuery(this._DATA_URL, fullName, `SmID = ${smId}`, (features) => {
      if (!features || features.length === 0) {
        this._statusEl.textContent = `查询无结果 (SmID=${smId})`;
        return;
      }

      const feat = features[0];
      const info = this._featureToInfo(feat);
      this._showInfo(info);

      if (this._linkEnabled && this._sectionLayers.length > 0) {
        const linkKey = this._extractLinkKey(info);
        if (linkKey) {
          this._highlightInSectionLayers(linkKey);
        }
      }
    });
  }

  /**
   * B→A: 查询剖面图属性后在三维模型 S3M 图层中联动高亮
   */
  _querySectionAndLinkToModel(layer, smId) {
    if (this._SECTION_DATA_URL && layer.hasQueryAttrAction) {
      const layerName = layer._name || layer.name || '';
      const dsName = layerName.indexOf('@') > 0 ? layerName.split('@')[0] : layerName;
      const fullName = `${this._SECTION_DATA_SOURCE}:${dsName}`;

      this._doSqlQuery(this._SECTION_DATA_URL, fullName, `SmID = ${smId}`, (features) => {
        if (!features || features.length === 0) {
          this._statusEl.textContent = `剖面图查询无结果 (SmID=${smId})`;
          return;
        }

        const feat = features[0];
        const info = this._featureToInfo(feat);
        this._showInfo(info);

        if (this._linkEnabled) {
          const linkKey = this._extractLinkKey(info);
          if (linkKey) {
            this._highlightInModelByKey(linkKey);
          }
        }
      });
    } else {
      this._showBasicInfo(layer, { id: smId });
      if (this._linkEnabled) {
        this._statusEl.textContent = '剖面图数据服务未配置，联动不可用';
        console.info('剖面图联动需要配置 SECTION_DATA_URL');
      }
    }
  }

  /**
   * 在剖面图 S3M 图层中，通过 UNIQUEID 查找并高亮
   */
  _highlightInSectionLayers(linkKey) {
    if (this._sectionLayers.length === 0) return;

    if (!this._SECTION_DATA_URL) {
      this._statusEl.textContent = '剖面图数据服务未配置，无法联动高亮';
      return;
    }

    this._statusEl.textContent = `正在剖面图中查找 (key=${linkKey})...`;
    const keyStr = String(linkKey);

    for (const layer of this._sectionLayers) {
      const layerName = layer._name || layer.name || '';
      const dsName = layerName.indexOf('@') > 0 ? layerName.split('@')[0] : layerName;
      const fullName = `${this._SECTION_DATA_SOURCE}:${dsName}`;
      const filter = `UNIQUEID = '${keyStr}'`;

      this._doSqlQuery(this._SECTION_DATA_URL, fullName, filter, (features) => {
        if (features && features.length > 0) {
          const feat = features[0];
          const smId = this._extractSmId(feat);
          if (smId !== null && layer.setSelection) {
            layer.setSelection([smId]);
            this._statusEl.textContent = `已在剖面图中高亮 (图层: ${dsName}, SmID=${smId})`;
          }
        }
      });
    }
  }

  /**
   * B→A: 通过属性键值在三维模型 S3M 图层中查找并高亮
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

      this._doSqlQuery(this._DATA_URL, fullName, filterByUniqueId, (features) => {
        if (features && features.length > 0) {
          this._highlightModelFeature(features[0], ds, keyStr);
          return;
        }

        this._doSqlQuery(this._DATA_URL, fullName, filterByElementId, (features2) => {
          if (features2 && features2.length > 0) {
            this._highlightModelFeature(features2[0], ds, keyStr);
          }
        });
      });
    }
  }

  _highlightModelFeature(feat, datasetName, linkKey) {
    const smId = this._extractSmId(feat);
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

  _extractLinkKey(info) {
    return info['UNIQUEID'] || info['UniqueId'] || info['uniqueid']
      || info['ELEMENTID'] || info['ElementId'] || info['elementid']
      || info['elementId'] || null;
  }

  _extractSmId(feat) {
    if (feat.fieldNames && feat.fieldValues) {
      for (let i = 0; i < feat.fieldNames.length; i++) {
        if (feat.fieldNames[i].toUpperCase() === 'SMID') {
          return parseInt(feat.fieldValues[i]);
        }
      }
    }
    if (feat.data && feat.data.SMID !== undefined) return parseInt(feat.data.SMID);
    if (feat.attributes && feat.attributes.SMID !== undefined) return parseInt(feat.attributes.SMID);
    return null;
  }

  _matchDataset(layer, datasets) {
    const layerName = (layer._name || layer.name || '').toLowerCase();
    for (const ds of datasets) {
      const dsClean = ds.replace('_dongchesuo', '').toLowerCase();
      if (layerName.indexOf(dsClean) !== -1 || dsClean.indexOf(layerName) !== -1) {
        return ds;
      }
    }
    return datasets.length > 1 ? datasets[1] : datasets[0];
  }

  clearAllSelection() {
    for (const layer of this._modelLayers) {
      try {
        if (layer.releaseSelection) layer.releaseSelection();
        if (layer.setSelection) layer.setSelection([]);
      } catch (_) {}
    }

    for (const layer of this._sectionLayers) {
      try {
        if (layer.releaseSelection) layer.releaseSelection();
        if (layer.setSelection) layer.setSelection([]);
      } catch (_) {}
    }

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

  _doSqlQuery(serviceUrl, datasetName, filter, onSuccess) {
    if (!serviceUrl) {
      onSuccess([]);
      return;
    }

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
