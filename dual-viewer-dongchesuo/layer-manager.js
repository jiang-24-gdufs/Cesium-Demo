/**
 * LayerManager - 图层管理面板
 *
 * - 三维模型组 (ViewerA): 超图 S3M 图层列表
 * - 剖面图组 (ViewerB): CesiumION 3DTileset
 */
export class LayerManager {
  constructor(sceneA, sceneB) {
    this._sceneA = sceneA;
    this._sceneB = sceneB;
    this._modelLayers = [];
    this._sectionTileset = null;

    this._modelListEl = document.getElementById('model-layer-list');
    this._sectionListEl = document.getElementById('section-layer-list');
    this._modelCountEl = document.getElementById('model-layer-count');
    this._sectionCountEl = document.getElementById('section-layer-count');

    this._initGroupToggle();
    this._initPanelToggle();
  }

  _initPanelToggle() {
    const panel = document.getElementById('layer-panel');
    const btn = document.getElementById('btn-layer-panel');
    const toggle = document.getElementById('layer-panel-toggle');

    btn.addEventListener('click', () => {
      panel.classList.toggle('collapsed');
      btn.classList.toggle('active', !panel.classList.contains('collapsed'));
    });

    toggle.addEventListener('click', () => {
      panel.classList.add('collapsed');
      btn.classList.remove('active');
    });
  }

  _initGroupToggle() {
    document.querySelectorAll('.layer-group-header').forEach((header) => {
      header.addEventListener('click', () => {
        header.classList.toggle('collapsed');
      });
    });
  }

  setModelLayers(layers) {
    this._modelLayers = layers || [];
    this._modelCountEl.textContent = this._modelLayers.length;
    this._renderS3MLayerList(this._modelListEl, this._modelLayers, this._sceneA);
  }

  setSectionTileset(tileset) {
    this._sectionTileset = tileset;
    this._sectionCountEl.textContent = '1';
    this._renderTilesetEntry(this._sectionListEl, tileset);
  }

  // 向后兼容
  setSectionLayers(layers) {
    if (layers && layers.length > 0) {
      this._sectionCountEl.textContent = layers.length;
    }
  }

  _renderS3MLayerList(ulEl, layers, scene) {
    ulEl.innerHTML = '';
    if (!layers || layers.length === 0) {
      ulEl.innerHTML = '<li class="layer-item" style="color:#666;">无图层</li>';
      return;
    }

    for (let i = 0; i < layers.length; i++) {
      const layer = layers[i];
      const name = this._getS3MDisplayName(layer, i);

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
        this._flyToS3MLayer(scene, layer, name);
      });

      li.appendChild(cb);
      li.appendChild(nameSpan);
      li.appendChild(locateBtn);
      ulEl.appendChild(li);
    }
  }

  _renderTilesetEntry(ulEl, tileset) {
    ulEl.innerHTML = '';

    const li = document.createElement('li');
    li.className = 'layer-item';

    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.checked = tileset.show !== false;
    cb.className = 'layer-cb';
    cb.addEventListener('change', () => { tileset.show = cb.checked; });

    const nameSpan = document.createElement('span');
    nameSpan.className = 'layer-name';
    nameSpan.textContent = 'CesiumION 剖面图';
    nameSpan.title = `ION Asset (3DTileset)`;

    const locateBtn = document.createElement('button');
    locateBtn.className = 'layer-locate-btn';
    locateBtn.textContent = '定位';
    locateBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this._flyToTileset(tileset);
    });

    li.appendChild(cb);
    li.appendChild(nameSpan);
    li.appendChild(locateBtn);
    ulEl.appendChild(li);
  }

  _flyToTileset(tileset) {
    const statusEl = document.getElementById('status-text');
    try {
      if (tileset.boundingSphere) {
        const offset = new Cesium.HeadingPitchRange(
          Cesium.Math.toRadians(0),
          Cesium.Math.toRadians(-45),
          tileset.boundingSphere.radius * 2.5
        );
        this._sceneB.camera.flyToBoundingSphere(tileset.boundingSphere, {
          offset,
          duration: 1.5,
        });
        statusEl.textContent = '已定位到剖面图';
      } else {
        statusEl.textContent = '剖面图无范围信息';
      }
    } catch (e) {
      statusEl.textContent = `定位失败: ${e.message || e}`;
    }
  }

  _getS3MDisplayName(layer, index) {
    const name = layer._name || layer.name || '';
    if (name && name !== 's3md' && name !== '') {
      return name
        .replace(/@[^@]+$/, '')
        .replace(/_dongchesuo/g, '')
        .replace(/_/g, ' ')
        .trim() || `图层_${index}`;
    }
    if (layer._groupName) return layer._groupName;
    return `图层_${index}`;
  }

  _flyToS3MLayer(scene, layer, layerName) {
    const statusEl = document.getElementById('status-text');
    try {
      if (layer._boundingSphere && layer._boundingSphere.center &&
          !Cesium.Cartesian3.equals(layer._boundingSphere.center, Cesium.Cartesian3.ZERO)) {
        const bs = layer._boundingSphere;
        const offset = new Cesium.HeadingPitchRange(
          Cesium.Math.toRadians(0),
          Cesium.Math.toRadians(-45),
          bs.radius * 2.5
        );
        scene.camera.flyToBoundingSphere(bs, { offset, duration: 1.5 });
        statusEl.textContent = `已定位到图层: ${layerName}`;
        return;
      }

      if (layer._layerBounds && layer._layerBounds.west !== undefined) {
        const b = layer._layerBounds;
        scene.camera.flyTo({
          destination: Cesium.Rectangle.fromDegrees(b.west, b.south, b.east, b.north),
          duration: 1.5,
        });
        statusEl.textContent = `已定位到图层: ${layerName}`;
        return;
      }

      if (layer.lon !== undefined && layer.lat !== undefined) {
        scene.camera.flyTo({
          destination: Cesium.Cartesian3.fromDegrees(layer.lon, layer.lat, (layer.height || 0) + 500),
          orientation: { heading: 0, pitch: Cesium.Math.toRadians(-45), roll: 0 },
          duration: 1.5,
        });
        statusEl.textContent = `已定位到图层: ${layerName}`;
        return;
      }

      statusEl.textContent = '该图层无范围信息，无法定位';
    } catch (e) {
      statusEl.textContent = `定位失败: ${e.message || e}`;
      console.warn('flyToLayer error:', e);
    }
  }

  get modelLayers() { return this._modelLayers; }
  get sectionTileset() { return this._sectionTileset; }
}
