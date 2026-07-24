// ============================================================
// config.js — 泛光 Demo 配置、预设、滑块定义、工具函数
// 由 app.js 拆分而来，app.js 通过 window.Floodlight 命名空间引用
// ============================================================

(function () {
  'use strict';

  // ==================== 场景配置 ====================

  var CONFIG = {
    sceneUrl: 'https://ct.sunrtcloud.com/iserver/services/3D-ycgt_20260414/rest/realspace',
    terrainUrl: 'https://ct.sunrtcloud.com/iserver/services/3D-local3DCache-terrain_20260415/rest/realspace/datas/dixin',
    tiandituToken: 'd044a50924a839d21691035e52fe43a5',
  };

  // ==================== 预设 ====================

  var PRESETS = {
    target: {
      colorR: 1,
      colorG: 0.90,
      colorB: 0.78,
      alpha: 0.86,
      ambientBoost: 1.3,

      threshold: 0.72,
      intensity: 1.0,
      radius: 3.6,
      sigma: 4.4,

      wideEnabled: true,
      wideIntensity: 0.28,
      wideRadius: 7.0,

      outlineEnabled: true,
      outlineStrength: 0.12,
      outlineColor: "#FFFFFF"
    },
    // defaults: {
    //     colorR: 0.92, colorG: 0.94, colorB: 0.92, alpha: 0.45,
    //     ambientBoost: 1.5,
    //     threshold: 0.58, intensity: 1.5, radius: 3.0, sigma: 3.0,
    //     wideEnabled: false, wideIntensity: 0.08, wideRadius: 3.50,
    //     outlineEnabled: false, outlineStrength: 0.3, outlineColor: '#BFFFFF',
    // },
    defaults: {
      "colorR": 1,
      "colorG": 0.91,
      "colorB": 0.8,
      "alpha": 0.4,
      "ambientBoost": 1.4,
      "threshold": 1,
      "intensity": 3.4,
      "radius": 4.2,
      "sigma": 4.45,
      "wideEnabled": false,
      "wideIntensity": 0.15,
      "wideRadius": 0.75,
      "outlineEnabled": false,
      "outlineStrength": 0,
      "outlineColor": "#000000"
    }

  };

  // ==================== 滑块定义 ====================

  var MODEL_SLIDERS = [
    {
      key: 'colorR', label: '颜色 R', min: 0, max: 1, step: 0.01,
      tip: '模型填充颜色红色分量 (0~1)\n⚠️ LDR 模式下值 >1.0 会被硬件截断为 1.0\n值=1.0 时模型为纯白\n值 <1.0 时留出泛光头room\n建议: 0.85 ~ 1.0\n⚡ 实时生效'
    },
    {
      key: 'colorG', label: '颜色 G', min: 0, max: 1, step: 0.01,
      tip: '模型填充颜色绿色分量 (0~1)\n⚠️ 超过 1.0 无额外效果\n建议: 0.85 ~ 1.0'
    },
    {
      key: 'colorB', label: '颜色 B', min: 0, max: 1, step: 0.01,
      tip: '模型填充颜色蓝色分量 (0~1)\n⚠️ 超过 1.0 无额外效果\n建议: 0.85 ~ 1.0'
    },
    {
      key: 'alpha', label: '透明度', min: 0.05, max: 1, step: 0.01,
      tip: '模型半透明度 (fillForeColor.alpha)\n值越低越通透，显示"冰玉"质感\n值越高越不透明\n⚠️ 值接近 1.0 + RGB 高 → 白爆\n建议: 0.35 ~ 0.55\n⚡ 实时生效'
    },
    {
      key: 'ambientBoost', label: '环境光', min: 0.3, max: 4.0, step: 0.1,
      tip: '场景环境光/图层亮度\n增大让模型更亮\n过大会让地形也变亮\n建议: 1.0 ~ 2.0\n⚡ 实时生效'
    },
  ];

  var SHADER_SLIDERS = [
    {
      key: 'threshold', label: '亮度阈值', min: 0, max: 1, step: 0.01,
      tip: '像素亮度(luminance)超过此值才参与泛光\n↓ 降低 → 更多区域发光（含背景）\n↑ 升高 → 仅最亮部分发光\n设太高模型可能不够亮无法被提取\n设太低地形也会发光\n建议: 0.4 ~ 0.7\n💡 用"提取调试"按钮查看提取效果\n⚡ 松手后 ~150ms 重建着色器生效'
    },
    {
      key: 'intensity', label: '泛光强度', min: 0, max: 6, step: 0.05,
      tip: '泛光结果的叠加乘数\n0 = 无泛光效果\n值越大发光越强\n⚠️ 仅当模型 RGB < 1.0 时可见\n(RGB=1.0 时公式退化为恒等)\n建议: 0.8 ~ 2.5\n⚡ 松手后 ~150ms 重建着色器生效'
    },
    {
      key: 'radius', label: '模糊半径', min: 0.1, max: 8, step: 0.05,
      tip: '高斯核每步的纹素偏移倍率\n控制泛光向外扩散的像素距离\n值越大光晕越宽\n值极小(0.1~0.5)时泛光紧贴模型\n建议: 1.5 ~ 4.0\n⚡ 松手后 ~150ms 重建着色器生效'
    },
    {
      key: 'sigma', label: '高斯衰减', min: 0.1, max: 8, step: 0.05,
      tip: '高斯核的标准差 σ\n控制权重随距离的衰减速度\nσ越大 → 边缘越平滑柔和\nσ越小 → 中心集中、泛光锐利\n值极小(0.1~0.5)时泛光非常集中\n建议: 1.5 ~ 4.0\n⚡ 松手后 ~150ms 重建着色器生效'
    },
  ];

  var WIDE_SLIDERS = [
    {
      key: 'wideIntensity', label: '扩散强度', min: 0, max: 3, step: 0.01,
      tip: '二次泛光（宽域扩散）的叠加强度\n在主泛光基础上做更大范围扩散\n产生远距离柔和光晕\n⚡ 松手后 ~150ms 重建着色器生效'
    },
    {
      key: 'wideRadius', label: '扩散半径', min: 0.1, max: 12, step: 0.05,
      tip: '二次泛光的采样步长倍率\n值越大光晕延伸越远\n过大可能导致可见的采样锯齿\n建议: 1.0 ~ 8.0\n⚡ 松手后 ~150ms 重建着色器生效'
    },
  ];

  // ==================== 图层工具 ====================

  function isModelLayer(layer) {
    var name = layer._name || layer.name || '';
    if (name.indexOf('@map') !== -1) return false;
    if (name.indexOf('terrain') !== -1) return false;
    return !!layer.style3D;
  }

  // ==================== 颜色工具 ====================

  function parseColor(input) {
    var str = (input || '').trim();
    var m = str.match(/^#?([0-9a-fA-F]{6})$/);
    if (m) {
      return {
        r: parseInt(m[1].substring(0, 2), 16) / 255,
        g: parseInt(m[1].substring(2, 4), 16) / 255,
        b: parseInt(m[1].substring(4, 6), 16) / 255,
      };
    }
    var nums = str.replace(/rgba?\s*\(/i, '').replace(/\)/, '')
      .split(/[\s,]+/).filter(Boolean).map(Number);
    if (nums.length >= 3 && !nums.some(isNaN)) {
      var scale = (nums[0] > 1 || nums[1] > 1 || nums[2] > 1) ? 255 : 1;
      return { r: nums[0] / scale, g: nums[1] / scale, b: nums[2] / scale };
    }
    return null;
  }

  function rgbToHex(r, g, b) {
    function ch(v) {
      var clamped = Math.max(0, Math.min(1, v));
      return Math.round(clamped * 255);
    }
    return '#' + ((1 << 24) | (ch(r) << 16) | (ch(g) << 8) | ch(b))
      .toString(16).slice(1).toUpperCase();
  }

  // ==================== 导出到全局命名空间 ====================

  window.Floodlight = {
    CONFIG: CONFIG,
    PRESETS: PRESETS,
    MODEL_SLIDERS: MODEL_SLIDERS,
    SHADER_SLIDERS: SHADER_SLIDERS,
    WIDE_SLIDERS: WIDE_SLIDERS,
    isModelLayer: isModelLayer,
    parseColor: parseColor,
    rgbToHex: rgbToHex,
  };
})();
