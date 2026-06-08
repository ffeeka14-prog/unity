/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Landmark {
  id: string;
  name: string;
  englishName: string;
  x: number; // coordinate representation
  z: number;
  height: number;
  color: string;
  description: string;
  architectureStyle: string;
}

export const LANDMARKS: Landmark[] = [
  {
    id: "main_gate",
    name: "校门主轴线",
    englishName: "Main Entrance Grid",
    x: 0,
    z: -140,
    height: 18,
    color: "#E2E8F0",
    description: "具有对称性对称和精修石砌雕刻工艺的校门，象征着石家庄铁道大学百年育人的厚重积淀。",
    architectureStyle: "对称俄式巨柱风格 / 现代石材铺装"
  },
  {
    id: "main_building",
    name: "一号教学楼 (主楼)",
    englishName: "Main Classroom Building 1",
    x: 0,
    z: -30,
    height: 38,
    color: "#D1FAE5",
    description: "宏伟对称的一号教学主楼，列柱巍峨，是铁大标志性代表建筑。",
    architectureStyle: "严谨折衷主义风格 / 列柱对称式立面"
  },
  {
    id: "library",
    name: "高线穹顶图书馆",
    englishName: "Dome Library Hub",
    x: -80,
    z: 40,
    height: 48,
    color: "#DBEAFE",
    description: "雄浑饱满的钢结构网球拱形穹顶，提供优美的弧线外观，是学校现代学术底蕴的象征性中心。",
    architectureStyle: "现代化弧形钢结构 / 透明玻璃幕墙"
  },
  {
    id: "memorial",
    name: "詹天佑纪念馆与铜像",
    englishName: "Zhan Tianyou Statuary",
    x: 10,
    z: -85,
    height: 12,
    color: "#FEF3C7",
    description: "纪念中国铁路之父詹天佑的主题铜像林，环抱翠屏湖，象征着铁道学子严谨笃行、知行合一的精神核心。",
    architectureStyle: "青铜铸造基座 / 严实厚实大理石底座"
  },
  {
    id: "lake_pond",
    name: "翠屏湖与菲涅尔折射区",
    englishName: "Cuiping Lake & Fresnel Pond",
    x: 80,
    z: -10,
    height: 1, // water level plane
    color: "#99F6E4",
    description: "清澈如洗的铁大翠屏湖。带有高级菲涅尔着色器公式，在边缘呈现高亮度半透视，在深水区呈现波光粼粼的高反射效果。",
    architectureStyle: "生态水文景观 / URP菲涅尔高光着色"
  },
  {
    id: "track_field",
    name: "高标准综合运动场",
    englishName: "Sports Track Arena",
    x: -90,
    z: -70,
    height: 2,
    color: "#FCA5A5",
    description: "配有红色环形沥青塑胶沥青轨道、人工天然绿色草皮足球草坪，也是师生体育锻炼和物理碰撞仿真的核心场地。",
    architectureStyle: "防滑红色塑胶跑道 / 聚氨酯生态草皮"
  }
];

export interface PhysicalCube {
  id: string;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  size: number;
  color: string;
  grounded: boolean;
  angleX: number;
  angleY: number;
  angleZ: number;
}
