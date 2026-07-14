import { CameraBounds } from './camera-bounds.js';

/**
 * SyncController - 全景 ↔ Cesium 3D 联动控制器
 *
 * 核心同步逻辑：
 * - 全景视图只有 heading / pitch / fov，没有 position（相机固定在球心）
 * - Cesium 3D 场景有完整的 position / heading / pitch / roll
 * - 联动时仅同步 heading 和 pitch，position 由各自视图独立控制
 * - 防循环机制：通过 source 标记避免 A→B→A 的无限循环
 * - BIM 室内模式：启用 CameraBounds 约束 + pitch 范围收紧
 */
export class SyncController {
  constructor(panoramaViewer, cesiumViewer) {
    this._pano = panoramaViewer;
    this._cesium = cesiumViewer;
    this._syncing = false;
    this._syncEnabled = true;
    this._activeSource = null;
    this._indoorMode = false;

    this._cameraBounds = null;
    this._preRenderListener = null;
    this._pointerListeners = [];

    this._init();
  }

  _init() {
    this._setupPointerTracking();
    this._setupPanoToCesiumSync();
    this._setupCesiumToPanoSync();
  }

  /**
   * 追踪用户当前操作的视图，决定同步方向
   */
  _setupPointerTracking() {
    const panoContainer = this._pano._container;
    const cesiumContainer = this._cesium.container;

    const handlers = [
      { el: panoContainer, source: 'panorama' },
      { el: cesiumContainer, source: 'cesium' },
    ];

    for (const { el, source } of handlers) {
      const handler = () => { this._activeSource = source; };
      el.addEventListener('pointerdown', handler);
      el.addEventListener('wheel', handler, { passive: true });
      this._pointerListeners.push({ el, type: 'pointerdown', handler });
      this._pointerListeners.push({ el, type: 'wheel', handler });
    }
  }

  /**
   * 全景 → Cesium 同步
   * 当用户在全景中拖动时，将 heading/pitch 同步到 Cesium 相机
   */
  _setupPanoToCesiumSync() {
    this._pano.onChange((state, source) => {
      if (!this._syncEnabled || this._syncing || this._activeSource !== 'panorama') return;
      this._syncing = true;
      try {
        const headingRad = Cesium.Math.toRadians(state.heading);
        const pitchRad = Cesium.Math.toRadians(state.pitch);

        this._cesium.camera.setView({
          destination: this._cesium.camera.positionWC.clone(),
          orientation: {
            heading: headingRad,
            pitch: pitchRad,
            roll: 0,
          },
        });
      } finally {
        this._syncing = false;
      }
    });
  }

  /**
   * Cesium → 全景同步
   * 当用户在 Cesium 3D 场景中操作时，将 heading/pitch 同步到全景视图
   */
  _setupCesiumToPanoSync() {
    this._preRenderListener = () => {
      if (!this._syncEnabled || this._syncing || this._activeSource !== 'cesium') return;
      this._syncing = true;
      try {
        const cam = this._cesium.camera;
        const headingDeg = Cesium.Math.toDegrees(cam.heading);
        const pitchDeg = Cesium.Math.toDegrees(cam.pitch);

        this._pano.setView(headingDeg, pitchDeg);
      } finally {
        this._syncing = false;
      }
    };

    this._cesium.scene.preRender.addEventListener(this._preRenderListener);
  }

  /** 切换联动开关 */
  toggleSync(enabled) {
    this._syncEnabled = typeof enabled === 'boolean' ? enabled : !this._syncEnabled;
    return this._syncEnabled;
  }

  get syncEnabled() { return this._syncEnabled; }

  /**
   * 双屏同步飞行到指定方位
   */
  flyToDirection(heading, pitch, duration = 1.5) {
    this._pano.setView(heading, pitch);

    this._cesium.camera.flyTo({
      destination: this._cesium.camera.positionWC.clone(),
      orientation: {
        heading: Cesium.Math.toRadians(heading),
        pitch: Cesium.Math.toRadians(pitch),
        roll: 0,
      },
      duration,
    });
  }

  /**
   * 重置双屏视角到初始状态
   */
  resetView() {
    this._pano.setView(0, 0);
    this._cesium.camera.setView({
      destination: this._cesium.camera.positionWC.clone(),
      orientation: {
        heading: 0,
        pitch: 0,
        roll: 0,
      },
    });
  }

  /**
   * 同步切换 Cesium 影像图层
   */
  switchImagery(providerFactory) {
    const layers = this._cesium.imageryLayers;
    if (layers.length > 0) {
      layers.remove(layers.get(0));
    }
    layers.addImageryProvider(providerFactory(), 0);
  }

  /**
   * 启用 BIM 室内模式
   * - 创建 CameraBounds 约束相机活动范围
   * - 收紧全景 pitch 范围
   * - 禁止 Cesium 地下穿透
   *
   * @param {Object} boundsConfig - 约束配置
   * @param {Object} boundsConfig.center - { longitude, latitude, height }
   * @param {number} boundsConfig.radius - 水平活动半径(米)
   * @param {number} boundsConfig.minHeight - 最低高度(米)
   * @param {number} boundsConfig.maxHeight - 最高高度(米)
   * @param {number} boundsConfig.pitchMin - pitch 最小值(度)
   * @param {number} boundsConfig.pitchMax - pitch 最大值(度)
   */
  enableIndoorMode(boundsConfig = {}) {
    this._indoorMode = true;

    if (this._cameraBounds) {
      this._cameraBounds.destroy();
    }
    this._cameraBounds = new CameraBounds(this._cesium, boundsConfig);
    this._cameraBounds.enable();

    this._pano.setIndoorMode(true, {
      pitchMin: boundsConfig.pitchMin ?? -60,
      pitchMax: boundsConfig.pitchMax ?? 60,
    });

    this._cesium.scene.screenSpaceCameraController.enableCollisionDetection = true;

    this._pano.loadPanorama('indoor');
  }

  /** 禁用 BIM 室内模式 */
  disableIndoorMode() {
    this._indoorMode = false;

    if (this._cameraBounds) {
      this._cameraBounds.destroy();
      this._cameraBounds = null;
    }

    this._pano.setIndoorMode(false);
    this._pano.loadPanorama('default');
  }

  /** 切换室内模式 */
  toggleIndoorMode(boundsConfig) {
    if (this._indoorMode) {
      this.disableIndoorMode();
    } else {
      this.enableIndoorMode(boundsConfig);
    }
    return this._indoorMode;
  }

  get indoorMode() { return this._indoorMode; }
  get cameraBounds() { return this._cameraBounds; }

  /** 显示/隐藏约束边界可视化 */
  toggleBoundsVisualization(show) {
    if (!this._cameraBounds) return;
    if (show) {
      this._cameraBounds.visualizeBounds();
    } else {
      this._cameraBounds.removeBoundsVisualization();
    }
  }

  /**
   * 获取当前同步状态信息
   */
  getStatus() {
    const panoState = this._pano.getState();
    const cam = this._cesium.camera;
    return {
      panorama: {
        heading: panoState.heading,
        pitch: panoState.pitch,
        fov: panoState.fov,
      },
      cesium: {
        heading: Cesium.Math.toDegrees(cam.heading),
        pitch: Cesium.Math.toDegrees(cam.pitch),
        roll: Cesium.Math.toDegrees(cam.roll),
      },
      syncEnabled: this._syncEnabled,
      indoorMode: this._indoorMode,
      boundsEnabled: this._cameraBounds?.enabled ?? false,
      activeSource: this._activeSource,
    };
  }

  destroy() {
    if (this._preRenderListener) {
      this._cesium.scene.preRender.removeEventListener(this._preRenderListener);
    }
    for (const { el, type, handler } of this._pointerListeners) {
      el.removeEventListener(type, handler);
    }
    this._pointerListeners = [];
    if (this._cameraBounds) {
      this._cameraBounds.destroy();
      this._cameraBounds = null;
    }
  }
}
