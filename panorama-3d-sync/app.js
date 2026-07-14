import { PanoramaViewer } from './panorama-viewer.js';
import { SyncController } from './sync-controller.js';
import { UIControls } from './ui-controls.js';

/**
 * 360全景 ↔ 3D场景 联动 Demo
 *
 * 架构：
 *   左屏: Three.js 全景球（Equirectangular → Sphere 内壁）
 *   右屏: Cesium 3D 场景（加载 BIM 建筑模型）
 *   联动: SyncController 通过 heading / pitch 双向同步
 *   约束: CameraBounds 限制相机在 BIM 模型内部活动
 *
 * Token 优先级：URL 参数 > localStorage > 内置评估 Token
 */
const urlParams = new URLSearchParams(window.location.search);
const savedToken = urlParams.get('token')
  || localStorage.getItem('cesium_ion_token')
  || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiJlYWE1OWUxNy1mMWZiLTQzYjYtYTQ0OS1kMWFjYmFkNjc5YzciLCJpZCI6NTc3MzMsImlhdCI6MTYyNzg0NTE4Mn0.XcKpgANiY19MC4bdFUXMVEBToBmqS8kuYpUlxJHYZxk';

Cesium.Ion.defaultAccessToken = savedToken;

// ── 创建全景视图 ──
const panoramaViewer = new PanoramaViewer(
  document.getElementById('panorama-container')
);

// ── 创建 Cesium 3D 场景 ──
const baseImageryProvider = new Cesium.OpenStreetMapImageryProvider({
  url: 'https://tile.openstreetmap.org/',
});

const cesiumViewer = new Cesium.Viewer('cesium-container', {
  animation: false,
  baseLayerPicker: false,
  fullscreenButton: false,
  vrButton: false,
  geocoder: false,
  homeButton: true,
  infoBox: true,
  sceneModePicker: false,
  selectionIndicator: true,
  timeline: false,
  navigationHelpButton: false,
  scene3DOnly: true,
  creditContainer: document.createElement('div'),
  baseLayer: Cesium.ImageryLayer.fromProviderAsync(
    Cesium.TileMapServiceImageryProvider.fromUrl(
      Cesium.buildModuleUrl('Assets/Textures/NaturalEarthII')
    )
  ),
});

cesiumViewer.imageryLayers.addImageryProvider(baseImageryProvider);

async function tryLoadTerrain() {
  try {
    const terrain = await Cesium.CesiumTerrainProvider.fromIonAssetId(1);
    cesiumViewer.terrainProvider = terrain;
  } catch (e) {
    console.warn('Ion 地形加载失败，使用默认平坦地形:', e.message);
  }
}

tryLoadTerrain();

async function loadOSMBuildings() {
  try {
    const tileset = await Cesium.createOsmBuildingsAsync();
    cesiumViewer.scene.primitives.add(tileset);
  } catch (e) {
    console.warn('OSM Buildings 加载失败，跳过:', e.message);
  }
}

loadOSMBuildings();

// ══════════════════════════════════════════════════
// BIM 建筑模型（使用 Cesium Entity 组合构建）
// 模拟一栋 3 层办公楼，尺寸约 40m × 30m × 12m
// ══════════════════════════════════════════════════

const bimCenter = {
  longitude: 116.3912,
  latitude: 39.9060,
};

const FLOOR_HEIGHT = 4;
const FLOORS = 3;
const BUILDING_WIDTH = 40;
const BUILDING_DEPTH = 30;
const WALL_THICKNESS = 0.3;
const BUILDING_HEIGHT = FLOORS * FLOOR_HEIGHT;

const bimEntities = [];

/**
 * 构建 BIM 建筑模型
 * 包含：外墙、楼板、内部分隔墙、窗户标记
 */
function buildBIMModel() {
  const halfW = BUILDING_WIDTH / 2;
  const halfD = BUILDING_DEPTH / 2;
  const wallColor = Cesium.Color.fromCssColorString('#8899AA').withAlpha(0.6);
  const floorColor = Cesium.Color.fromCssColorString('#BBCCDD').withAlpha(0.4);
  const windowColor = Cesium.Color.fromCssColorString('#66AADD').withAlpha(0.5);
  const roofColor = Cesium.Color.fromCssColorString('#667788').withAlpha(0.7);

  const cLon = bimCenter.longitude;
  const cLat = bimCenter.latitude;

  const meterToDegLon = 1 / (111320 * Math.cos(Cesium.Math.toRadians(cLat)));
  const meterToDegLat = 1 / 110574;

  function offsetDeg(mX, mY) {
    return [cLon + mX * meterToDegLon, cLat + mY * meterToDegLat];
  }

  function addWall(id, name, corners, baseH, topH, color) {
    const positions = corners.map(([mx, my]) => {
      const [lon, lat] = offsetDeg(mx, my);
      return Cesium.Cartesian3.fromDegrees(lon, lat);
    });
    const entity = cesiumViewer.entities.add({
      id,
      name,
      wall: {
        positions,
        minimumHeights: corners.map(() => baseH),
        maximumHeights: corners.map(() => topH),
        material: color,
      },
    });
    bimEntities.push(entity);
    return entity;
  }

  function addFloor(id, name, height, color) {
    const corners = [
      offsetDeg(-halfW, -halfD),
      offsetDeg(halfW, -halfD),
      offsetDeg(halfW, halfD),
      offsetDeg(-halfW, halfD),
    ];
    const entity = cesiumViewer.entities.add({
      id,
      name,
      polygon: {
        hierarchy: new Cesium.PolygonHierarchy(
          corners.map(([lon, lat]) => Cesium.Cartesian3.fromDegrees(lon, lat))
        ),
        height,
        material: color,
      },
    });
    bimEntities.push(entity);
    return entity;
  }

  for (let floor = 0; floor < FLOORS; floor++) {
    const baseH = floor * FLOOR_HEIGHT;
    const topH = (floor + 1) * FLOOR_HEIGHT;
    const floorLabel = `${floor + 1}F`;

    addWall(`wall-south-${floor}`, `南墙 ${floorLabel}`,
      [[-halfW, -halfD], [halfW, -halfD]], baseH, topH, wallColor);
    addWall(`wall-north-${floor}`, `北墙 ${floorLabel}`,
      [[halfW, halfD], [-halfW, halfD]], baseH, topH, wallColor);
    addWall(`wall-east-${floor}`, `东墙 ${floorLabel}`,
      [[halfW, -halfD], [halfW, halfD]], baseH, topH, wallColor);
    addWall(`wall-west-${floor}`, `西墙 ${floorLabel}`,
      [[-halfW, halfD], [-halfW, -halfD]], baseH, topH, wallColor);

    addWall(`wall-inner-ns-${floor}`, `南北隔墙 ${floorLabel}`,
      [[0, -halfD], [0, halfD]], baseH, topH, wallColor.withAlpha(0.35));
    addWall(`wall-inner-ew-${floor}`, `东西隔墙 ${floorLabel}`,
      [[-halfW, 0], [halfW, 0]], baseH, topH, wallColor.withAlpha(0.35));

    addFloor(`floor-${floor}`, `楼板 ${floorLabel}`, baseH, floorColor);

    const windowH = baseH + 1.2;
    const windowTopH = baseH + 3.2;
    for (let wx = -halfW + 3; wx < halfW; wx += 5) {
      addWall(`win-s-${floor}-${wx}`, `窗户`,
        [[wx, -halfD - 0.05], [wx + 2, -halfD - 0.05]], windowH, windowTopH, windowColor);
      addWall(`win-n-${floor}-${wx}`, `窗户`,
        [[wx, halfD + 0.05], [wx + 2, halfD + 0.05]], windowH, windowTopH, windowColor);
    }
    for (let wy = -halfD + 3; wy < halfD; wy += 5) {
      addWall(`win-e-${floor}-${wy}`, `窗户`,
        [[halfW + 0.05, wy], [halfW + 0.05, wy + 2]], windowH, windowTopH, windowColor);
      addWall(`win-w-${floor}-${wy}`, `窗户`,
        [[-halfW - 0.05, wy], [-halfW - 0.05, wy + 2]], windowH, windowTopH, windowColor);
    }
  }

  addFloor('roof', '屋顶', BUILDING_HEIGHT, roofColor);

  const panoHeight = FLOOR_HEIGHT * 0.5 + FLOOR_HEIGHT;
  const panoEntity = cesiumViewer.entities.add({
    id: 'pano-point',
    name: '全景拍摄点 (2F 中心)',
    position: Cesium.Cartesian3.fromDegrees(cLon, cLat, panoHeight),
    point: {
      pixelSize: 14,
      color: Cesium.Color.fromCssColorString('#e94560'),
      outlineColor: Cesium.Color.WHITE,
      outlineWidth: 3,
      disableDepthTestDistance: Number.POSITIVE_INFINITY,
    },
    label: {
      text: '全景拍摄点 (2F)',
      font: 'bold 13px sans-serif',
      fillColor: Cesium.Color.WHITE,
      style: Cesium.LabelStyle.FILL_AND_OUTLINE,
      outlineWidth: 2,
      outlineColor: Cesium.Color.BLACK,
      verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
      pixelOffset: new Cesium.Cartesian2(0, -20),
      disableDepthTestDistance: Number.POSITIVE_INFINITY,
    },
    description: '当前360全景图的拍摄位置，位于建筑2楼中心',
  });
  bimEntities.push(panoEntity);

  return {
    center: { longitude: cLon, latitude: cLat, height: panoHeight },
    panoHeight,
  };
}

const bimInfo = buildBIMModel();

// ══════════════════════════════════════════════════
// 以 BIM 模型中心作为全景相机锚点
// ══════════════════════════════════════════════════

const panoLocation = bimInfo.center;

const indoorBoundsConfig = {
  center: { ...panoLocation },
  radius: Math.max(BUILDING_WIDTH, BUILDING_DEPTH) / 2 + 2,
  minHeight: FLOOR_HEIGHT + 0.5,
  maxHeight: FLOOR_HEIGHT * 2 - 0.3,
  pitchMin: -60,
  pitchMax: 60,
};

cesiumViewer.camera.setView({
  destination: Cesium.Cartesian3.fromDegrees(
    panoLocation.longitude,
    panoLocation.latitude,
    panoLocation.height
  ),
  orientation: {
    heading: 0,
    pitch: 0,
    roll: 0,
  },
});

// ── 初始化联动控制器 ──
const syncController = new SyncController(panoramaViewer, cesiumViewer);

// ── 初始化 UI 控件（传入 indoorBoundsConfig 供室内模式切换使用） ──
const uiControls = new UIControls(panoramaViewer, cesiumViewer, syncController, indoorBoundsConfig);

// ── Token 设置功能（暴露到全局） ──
window.setCesiumToken = (token) => {
  if (!token) return;
  localStorage.setItem('cesium_ion_token', token);
  Cesium.Ion.defaultAccessToken = token;
  window.location.reload();
};

// ── 提供外部查看按钮（从建筑外围俯瞰） ──
window.flyToOverview = () => {
  cesiumViewer.camera.flyTo({
    destination: Cesium.Cartesian3.fromDegrees(
      bimCenter.longitude + 0.001,
      bimCenter.latitude - 0.001,
      80
    ),
    orientation: {
      heading: Cesium.Math.toRadians(315),
      pitch: Cesium.Math.toRadians(-35),
      roll: 0,
    },
    duration: 2,
  });
};

// ── 提供飞入建筑内部按钮 ──
window.flyToIndoor = () => {
  cesiumViewer.camera.flyTo({
    destination: Cesium.Cartesian3.fromDegrees(
      panoLocation.longitude,
      panoLocation.latitude,
      panoLocation.height
    ),
    orientation: {
      heading: 0,
      pitch: 0,
      roll: 0,
    },
    duration: 2,
  });
};

console.log('[Panorama3DSync] 360全景 ↔ BIM 3D场景联动应用已启动');
console.log('[Panorama3DSync] BIM 模型中心:', panoLocation);
console.log('[Panorama3DSync] 室内约束范围:', indoorBoundsConfig);
