/**
 * CameraBounds - BIM 室内相机活动范围约束
 *
 * 在 BIM 室内全景场景中，相机不应飞出建筑边界。
 * 此模块定义一个 AABB（轴对齐包围盒）约束区域，
 * 并在每帧渲染前将 Cesium Camera 的 position 钳位到盒内。
 *
 * 同时对 pitch 角度做室内场景友好的约束：
 * - 室内模式下 pitch 限制在 [-80°, 80°]，避免穿透天花板/地板
 * - 普通模式下无 position 约束
 */
export class CameraBounds {
  /**
   * @param {Cesium.Viewer} cesiumViewer
   * @param {Object} options
   * @param {Object} options.center  - 约束中心点 { longitude, latitude, height }
   * @param {number} options.radius  - 水平活动半径(米)，默认 50
   * @param {number} options.minHeight - 最低高度(米)，默认 1（地面以上）
   * @param {number} options.maxHeight - 最高高度(米)，默认 30（天花板）
   * @param {number} options.pitchMin - pitch 最小值(度)，默认 -80
   * @param {number} options.pitchMax - pitch 最大值(度)，默认 80
   */
  constructor(cesiumViewer, options = {}) {
    this._viewer = cesiumViewer;
    this._enabled = false;
    this._preRenderListener = null;

    this._center = options.center || { longitude: 116.3912, latitude: 39.9060, height: 5 };
    this._radius = options.radius ?? 50;
    this._minHeight = options.minHeight ?? 1;
    this._maxHeight = options.maxHeight ?? 30;
    this._pitchMin = options.pitchMin ?? -80;
    this._pitchMax = options.pitchMax ?? 80;

    this._centerCartesian = Cesium.Cartesian3.fromDegrees(
      this._center.longitude,
      this._center.latitude,
      this._center.height
    );

    this._boundingSphere = new Cesium.BoundingSphere(
      this._centerCartesian,
      this._radius
    );
  }

  /** 启用室内限位 */
  enable() {
    if (this._enabled) return;
    this._enabled = true;

    this._preRenderListener = () => {
      this._clampCamera();
    };
    this._viewer.scene.preRender.addEventListener(this._preRenderListener);
  }

  /** 禁用室内限位 */
  disable() {
    if (!this._enabled) return;
    this._enabled = false;

    if (this._preRenderListener) {
      this._viewer.scene.preRender.removeEventListener(this._preRenderListener);
      this._preRenderListener = null;
    }
  }

  get enabled() { return this._enabled; }

  /**
   * 更新约束配置
   */
  updateBounds(options) {
    if (options.center) {
      this._center = options.center;
      this._centerCartesian = Cesium.Cartesian3.fromDegrees(
        this._center.longitude,
        this._center.latitude,
        this._center.height
      );
      this._boundingSphere.center = this._centerCartesian;
    }
    if (options.radius !== undefined) {
      this._radius = options.radius;
      this._boundingSphere.radius = this._radius;
    }
    if (options.minHeight !== undefined) this._minHeight = options.minHeight;
    if (options.maxHeight !== undefined) this._maxHeight = options.maxHeight;
    if (options.pitchMin !== undefined) this._pitchMin = options.pitchMin;
    if (options.pitchMax !== undefined) this._pitchMax = options.pitchMax;
  }

  /** 获取当前约束配置 */
  getBounds() {
    return {
      center: { ...this._center },
      radius: this._radius,
      minHeight: this._minHeight,
      maxHeight: this._maxHeight,
      pitchMin: this._pitchMin,
      pitchMax: this._pitchMax,
      enabled: this._enabled,
    };
  }

  /**
   * 每帧执行：将 Camera position 钳位到约束范围内
   */
  _clampCamera() {
    const camera = this._viewer.camera;
    const carto = Cesium.Cartographic.fromCartesian(camera.positionWC);

    const centerCarto = Cesium.Cartographic.fromDegrees(
      this._center.longitude,
      this._center.latitude
    );

    const horizontalDistance = this._haversineDistance(
      Cesium.Math.toDegrees(carto.latitude),
      Cesium.Math.toDegrees(carto.longitude),
      this._center.latitude,
      this._center.longitude
    );

    let needsClamp = false;
    let clampedLon = Cesium.Math.toDegrees(carto.longitude);
    let clampedLat = Cesium.Math.toDegrees(carto.latitude);
    let clampedHeight = carto.height;

    if (horizontalDistance > this._radius) {
      const ratio = this._radius / horizontalDistance;
      const dLon = Cesium.Math.toDegrees(carto.longitude) - this._center.longitude;
      const dLat = Cesium.Math.toDegrees(carto.latitude) - this._center.latitude;
      clampedLon = this._center.longitude + dLon * ratio;
      clampedLat = this._center.latitude + dLat * ratio;
      needsClamp = true;
    }

    if (carto.height < this._minHeight) {
      clampedHeight = this._minHeight;
      needsClamp = true;
    } else if (carto.height > this._maxHeight) {
      clampedHeight = this._maxHeight;
      needsClamp = true;
    }

    const pitchDeg = Cesium.Math.toDegrees(camera.pitch);
    let clampedPitch = camera.pitch;
    if (pitchDeg < this._pitchMin) {
      clampedPitch = Cesium.Math.toRadians(this._pitchMin);
      needsClamp = true;
    } else if (pitchDeg > this._pitchMax) {
      clampedPitch = Cesium.Math.toRadians(this._pitchMax);
      needsClamp = true;
    }

    if (needsClamp) {
      camera.setView({
        destination: Cesium.Cartesian3.fromDegrees(clampedLon, clampedLat, clampedHeight),
        orientation: {
          heading: camera.heading,
          pitch: clampedPitch,
          roll: camera.roll,
        },
      });
    }
  }

  /**
   * Haversine 公式计算两点间地表距离(米)
   */
  _haversineDistance(lat1, lon1, lat2, lon2) {
    const R = 6371000;
    const dLat = Cesium.Math.toRadians(lat2 - lat1);
    const dLon = Cesium.Math.toRadians(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(Cesium.Math.toRadians(lat1)) *
      Math.cos(Cesium.Math.toRadians(lat2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  /**
   * 在 Cesium 场景中可视化约束边界
   * 返回创建的 Entity 数组，方便后续移除
   */
  visualizeBounds() {
    const entities = [];

    entities.push(this._viewer.entities.add({
      id: '_bounds-cylinder',
      name: '活动范围',
      position: this._centerCartesian,
      cylinder: {
        length: this._maxHeight - this._minHeight,
        topRadius: this._radius,
        bottomRadius: this._radius,
        material: Cesium.Color.CYAN.withAlpha(0.08),
        outline: true,
        outlineColor: Cesium.Color.CYAN.withAlpha(0.4),
        outlineWidth: 2,
      },
    }));

    entities.push(this._viewer.entities.add({
      id: '_bounds-floor',
      name: '地面边界',
      position: Cesium.Cartesian3.fromDegrees(
        this._center.longitude,
        this._center.latitude,
        this._minHeight
      ),
      ellipse: {
        semiMajorAxis: this._radius,
        semiMinorAxis: this._radius,
        material: Cesium.Color.CYAN.withAlpha(0.05),
        outline: true,
        outlineColor: Cesium.Color.CYAN.withAlpha(0.3),
        height: this._minHeight,
      },
    }));

    entities.push(this._viewer.entities.add({
      id: '_bounds-ceiling',
      name: '天花板边界',
      position: Cesium.Cartesian3.fromDegrees(
        this._center.longitude,
        this._center.latitude,
        this._maxHeight
      ),
      ellipse: {
        semiMajorAxis: this._radius,
        semiMinorAxis: this._radius,
        material: Cesium.Color.ORANGE.withAlpha(0.05),
        outline: true,
        outlineColor: Cesium.Color.ORANGE.withAlpha(0.3),
        height: this._maxHeight,
      },
    }));

    return entities;
  }

  /** 移除边界可视化 */
  removeBoundsVisualization() {
    ['_bounds-cylinder', '_bounds-floor', '_bounds-ceiling'].forEach(id => {
      const entity = this._viewer.entities.getById(id);
      if (entity) this._viewer.entities.remove(entity);
    });
  }

  destroy() {
    this.disable();
    this.removeBoundsVisualization();
  }
}
