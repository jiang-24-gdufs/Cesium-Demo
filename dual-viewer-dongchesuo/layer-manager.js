/**
 * LayerManager - 图层管理面板
 *
 * - 三维模型组 (ViewerA): 超图 S3M 图层列表
 * - 剖面图组 (ViewerB): 超图 S3M 图层列表（realspace 剖面场景）
 */
export class LayerManager {
  constructor(sceneA, sceneB) {
    this._sceneA = sceneA;
    this._sceneB = sceneB;
    this._modelLayers = [];
    this._sectionLayers = [];

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
    this._renderS3MLayerList(this._modelListEl, this._modelLayers, this._sceneA, 'model');
  }

  setSectionLayers(layers) {
    this._sectionLayers = layers || [];
    this._sectionCountEl.textContent = this._sectionLayers.length;
    this._renderS3MLayerList(this._sectionListEl, this._sectionLayers, this._sceneB, 'section');
  }

  _renderS3MLayerList(ulEl, layers, scene, group) {
    ulEl.innerHTML = '';
    if (!layers || layers.length === 0) {
      ulEl.innerHTML = '<li class="layer-item" style="color:#666;">无图层</li>';
      return;
    }

    // 总控行（仅剖面图组，因为图层数量可能较多）
    if (group === 'section' && layers.length > 1) {
      const masterLi = document.createElement('li');
      masterLi.className = 'layer-item layer-master';

      const masterCb = document.createElement('input');
      masterCb.type = 'checkbox';
      masterCb.checked = true;
      masterCb.className = 'layer-cb';
      masterCb.addEventListener('change', () => {
        for (const layer of layers) {
          layer.visible = masterCb.checked;
        }
        ulEl.querySelectorAll('.layer-sub .layer-cb').forEach((cb) => {
          cb.checked = masterCb.checked;
        });
      });

      const masterName = document.createElement('span');
      masterName.className = 'layer-name';
      masterName.style.fontWeight = '600';
      masterName.textContent = `全部剖面图层 (${layers.length})`;

      masterLi.appendChild(masterCb);
      masterLi.appendChild(masterName);
      ulEl.appendChild(masterLi);
    }

    for (let i = 0; i < layers.length; i++) {
      const layer = layers[i];
      const name = this._getS3MDisplayName(layer, i, group);

      const li = document.createElement('li');
      li.className = group === 'section' ? 'layer-item layer-sub' : 'layer-item';

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

  _getS3MDisplayName(layer, index, group) {
    const name = layer._name || layer.name || '';
    if (name && name !== 's3md' && name !== '') {
      let display = name
        .replace(/@[^@]+$/, '')
        .replace(/_dongchesuo/g, '')
        .replace(/_/g, ' ')
        .trim();

      if (group === 'section') {
        display = display
          .replace(/dongchesuo[_ ]?poumian[_ ]?/gi, '')
          .trim();
      }

      return display || `图层_${index}`;
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
  get sectionLayers() { return this._sectionLayers; }
}
