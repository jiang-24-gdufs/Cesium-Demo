/**
 * EntityManager - 双屏实体管理
 * 在两个 Viewer 中同步创建/删除实体，管理选中状态联动。
 */
export class EntityManager {
  constructor(viewerA, viewerB) {
    this._viewerA = viewerA;
    this._viewerB = viewerB;
    this._entityMap = new Map(); // entityId -> { a: Entity, b: Entity, data: Object }
    this._selectionSyncEnabled = true;
    this._syncing = false;

    this._setupSelectionSync();
  }

  /**
   * 在双屏中同步添加一个标记实体
   */
  addMarker(id, { longitude, latitude, height = 0, name, color, description }) {
    const position = Cesium.Cartesian3.fromDegrees(longitude, latitude, height);
    const materialColor = color || Cesium.Color.fromCssColorString('#e94560');

    const entityOpts = {
      id,
      name: name || id,
      position,
      point: {
        pixelSize: 12,
        color: materialColor,
        outlineColor: Cesium.Color.WHITE,
        outlineWidth: 2,
        heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
      },
      label: {
        text: name || id,
        font: '13px sans-serif',
        fillColor: Cesium.Color.WHITE,
        style: Cesium.LabelStyle.FILL_AND_OUTLINE,
        outlineWidth: 2,
        outlineColor: Cesium.Color.BLACK,
        verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
        pixelOffset: new Cesium.Cartesian2(0, -18),
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
      },
      description: description || '',
    };

    const a = this._viewerA.entities.add({ ...entityOpts });
    const b = this._viewerB.entities.add({
      ...entityOpts,
      position: position.clone(),
      point: { ...entityOpts.point },
      label: { ...entityOpts.label },
    });

    this._entityMap.set(id, { a, b, data: { longitude, latitude, height, name, color: materialColor } });
    return id;
  }

  /**
   * 添加折线
   */
  addPolyline(id, { positions, color, width = 3, name }) {
    const cartesians = positions.map(p => Cesium.Cartesian3.fromDegrees(p[0], p[1], p[2] || 0));
    const materialColor = color || Cesium.Color.CYAN;

    const entityOpts = {
      id,
      name: name || id,
      polyline: {
        positions: cartesians,
        width,
        material: materialColor,
        clampToGround: true,
      },
    };

    const a = this._viewerA.entities.add({ ...entityOpts, polyline: { ...entityOpts.polyline, positions: cartesians.map(c => c.clone()) } });
    const b = this._viewerB.entities.add({ ...entityOpts, polyline: { ...entityOpts.polyline, positions: cartesians.map(c => c.clone()) } });

    this._entityMap.set(id, { a, b, data: { positions, name } });
    return id;
  }

  /**
   * 添加多边形
   */
  addPolygon(id, { positions, color, outlineColor, name, height = 0, extrudedHeight }) {
    const hierarchy = new Cesium.PolygonHierarchy(
      positions.map(p => Cesium.Cartesian3.fromDegrees(p[0], p[1]))
    );
    const materialColor = color || Cesium.Color.fromCssColorString('#e94560').withAlpha(0.4);

    const entityOpts = {
      id,
      name: name || id,
      polygon: {
        hierarchy,
        material: materialColor,
        outline: true,
        outlineColor: outlineColor || Cesium.Color.WHITE,
        height,
        extrudedHeight,
      },
    };

    const a = this._viewerA.entities.add(entityOpts);
    const hierarchyB = new Cesium.PolygonHierarchy(
      positions.map(p => Cesium.Cartesian3.fromDegrees(p[0], p[1]))
    );
    const b = this._viewerB.entities.add({ ...entityOpts, polygon: { ...entityOpts.polygon, hierarchy: hierarchyB } });

    this._entityMap.set(id, { a, b, data: { positions, name } });
    return id;
  }

  /**
   * 删除实体（双屏同步）
   */
  remove(id) {
    const entry = this._entityMap.get(id);
    if (!entry) return false;
    this._viewerA.entities.remove(entry.a);
    this._viewerB.entities.remove(entry.b);
    this._entityMap.delete(id);
    return true;
  }

  /**
   * 清除全部实体
   */
  clearAll() {
    for (const [id] of this._entityMap) {
      this.remove(id);
    }
  }

  /**
   * 选中状态联动
   */
  _setupSelectionSync() {
    const createHandler = (sourceViewer, targetViewer, sourceKey, targetKey) => {
      sourceViewer.selectedEntityChanged.addEventListener((entity) => {
        if (!this._selectionSyncEnabled || this._syncing) return;
        this._syncing = true;
        try {
          if (!entity) {
            targetViewer.selectedEntity = undefined;
            return;
          }
          const entry = this._entityMap.get(entity.id);
          if (entry) {
            targetViewer.selectedEntity = entry[targetKey];
          }
        } finally {
          this._syncing = false;
        }
      });
    };

    createHandler(this._viewerA, this._viewerB, 'a', 'b');
    createHandler(this._viewerB, this._viewerA, 'b', 'a');
  }

  get entityMap() { return this._entityMap; }

  /**
   * 加载示例实体数据
   */
  loadDemoEntities() {
    this.addMarker('beijing', {
      longitude: 116.3912, latitude: 39.9060, height: 0,
      name: '北京', description: '中华人民共和国首都',
    });
    this.addMarker('shanghai', {
      longitude: 121.4737, latitude: 31.2304, height: 0,
      name: '上海', description: '中国最大的经济中心',
    });
    this.addMarker('tokyo', {
      longitude: 139.6917, latitude: 35.6895, height: 0,
      name: '东京', description: '日本首都',
      color: Cesium.Color.fromCssColorString('#00d2ff'),
    });
    this.addMarker('newyork', {
      longitude: -74.0060, latitude: 40.7128, height: 0,
      name: '纽约', description: '美国最大城市',
      color: Cesium.Color.fromCssColorString('#ffd700'),
    });
    this.addMarker('london', {
      longitude: -0.1276, latitude: 51.5074, height: 0,
      name: '伦敦', description: '英国首都',
      color: Cesium.Color.fromCssColorString('#00ff88'),
    });

    this.addPolyline('silk-road-segment', {
      name: '丝绸之路（片段）',
      positions: [
        [116.39, 39.90],
        [104.07, 30.67],
        [91.11, 29.65],
        [69.17, 34.53],
        [44.37, 33.31],
        [28.97, 41.01],
      ],
      color: Cesium.Color.fromCssColorString('#ff6b6b'),
      width: 3,
    });

    this.addPolygon('tiananmen-area', {
      name: '天安门广场区域',
      positions: [
        [116.3883, 39.9055],
        [116.3980, 39.9055],
        [116.3980, 39.9005],
        [116.3883, 39.9005],
      ],
      color: Cesium.Color.fromCssColorString('#e94560').withAlpha(0.3),
      outlineColor: Cesium.Color.fromCssColorString('#e94560'),
      height: 0,
      extrudedHeight: 50,
    });
  }
}
