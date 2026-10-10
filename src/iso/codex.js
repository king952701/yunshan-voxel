// 游戏内置数据库：把物品、矿脉、配方、技能、品级、操作汇编成可索引、可检索的条目。
// 帮助面板与搜索框都读这一份，数据与游戏本体同源，不会说一套做一套。
import {
  ITEMS, BLOCKS, QUALITY, qualityOf, itemName, itemColor, itemIcon,
} from '../core/items.js';
import { ORES, VEIN_CD, BASE_TIME, MINE_ORE, oreInfo } from './veins.js';
import { KINDS, NODE_CD, NB } from './nodes.js';
import { SKILLS, SKILL_BY_KEY } from './skill.js';
import { ALL_RECIPES, CATEGORIES, CRAFT_CATS } from '../game/crafting.js';
import { BUILD_MATS } from './edit2d.js';
import { WORLD } from './world2d.js';
import { SEA, SNOW_LINE } from './palette.js';
import { BIOME_NAME, GRID, MINE_KEYS, MINE_NAME } from '../core/biome.js';

/** 索引分类 */
export const CATS = [
  { key: 'all', label: '全部' },
  { key: 'item', label: '物品道具' },
  { key: 'ore', label: '矿脉' },
  { key: 'node', label: '采集点' },
  { key: 'block', label: '方块' },
  { key: 'recipe', label: '配方' },
  { key: 'skill', label: '技能' },
  { key: 'life', label: '生存' },
  { key: 'quality', label: '品级' },
  { key: 'control', label: '操作' },
  { key: 'world', label: '山川' },
];

const TOOL_CN = { pickaxe: '镐', axe: '斧', shovel: '铲', sickle: '镰', sword: '剑' };
const PICK_CN = ['', '木镐', '石镐', '铁镐'];
const CAT_CN = new Map([...CATEGORIES, ...CRAFT_CATS].map((c) => [c.key, c.label]));

/** 汇编全部条目。skills 用来显示当前技能等级，可省略。 */
export function buildCodex(skills) {
  const out = [];

  for (const q of QUALITY) {
    out.push({
      cat: 'quality', title: q.name, color: q.color,
      sub: `第 ${q.tier} 阶 · 效力 ×${q.mul.toFixed(2)}`,
      body: `品级越高，同一件东西越强：兵器的杀伤、防具的护体、食物的饱食、丹药的疗效，`
        + `都按这个倍率折算。共十阶，最高为仙品（×2.10）。`,
      tags: `品级 ${q.name} 阶 第${q.tier}阶`,
    });
  }

  for (const o of ORES) {
    out.push({
      cat: 'ore', title: o.name, color: '#' + o.color.toString(16).padStart(6, '0'),
      sub: `${qualityOf(o.id).name} · 须${PICK_CN[o.tier] || '镐'}`,
      body: `埋在地表之下，露头处按 E 开采。每次得 ${o.count} 个，采矿经验 ${o.exp}。`
        + `基础耗时 ${BASE_TIME} 秒，采矿等级与镐都会缩短；采空后 ${VEIN_CD} 秒（5 分钟）自行复生。`,
      tags: `矿 矿脉 采矿 ${o.name} ${qualityOf(o.id).name}`,
    });
  }

  for (const [key, k] of Object.entries(KINDS)) {
    const sk = SKILL_BY_KEY.get(k.skill);
    out.push({
      cat: 'node', title: k.name, color: k.color, icon: k.icon,
      sub: `${sk ? sk.name : k.skill} · ${k.tool ? `须持${TOOL_CN[k.tool]}` : '徒手即可'}`,
      body: `地表采集点，走近按 E 采集，耗时随${sk ? sk.name : k.skill}等级与家伙好坏缩短。`
        + `采空后 ${NODE_CD} 秒（5 分钟）自行复生。每 ${NB}×${NB} 的片区按地形长出几处：`
        + `${sk ? sk.desc : ''}`,
      tags: `${k.name} 采集点 ${sk ? sk.name : ''} ${k.tool || '徒手'}`,
    });
  }

  const LIFE = [
    ['气血', '受伤、挨饿、缺水都会掉气血；敷药、服丹、进食可补回。归零则力竭倒下。',
      '敷药可回（草药膏、金疮药、丹药），进食也小幅回气。'],
    ['饱食', '一昼夜约掉六成饱食，见底后开始掉气血。', '烤肉、炖肉、干粮、鱼与果脯都能垫肚子，越精细的越顶饿。'],
    ['渴饮', '比饱食掉得更快，一昼夜约掉八成。', '走到水边按 F 可直接捧水喝；茶、酒、浆、露也能解渴。'],
    ['夜里遇袭', '入夜之后人在野外、附近有野兽，会被扑上来咬一口。', '手上有兵器可逼退，赤手空拳只能挨。天亮或离开野兽便无事。'],
    ['力竭倒下', '气血归零后在自家门口（图心）醒来。', '行囊里的东西掉一半，但家伙（镐斧铲镰剑钓竿）会留下，好让你翻身。'],
  ];
  for (const [title, body, sub] of LIFE) {
    out.push({
      cat: 'life', title, icon: '❤', color: '#d84a6a',
      sub: '生存', body: `${body}　${sub}`,
      tags: `${title} 生存 气血 饱食 渴饮 夜袭`,
    });
  }

  for (const [key, it] of Object.entries(ITEMS)) {
    const id = Number(key);
    const q = qualityOf(id);
    const bits = [];
    if (it.food) bits.push(`进食回复 ${it.food} 饱食`);
    if (it.heal) bits.push(`疗伤 ${it.heal}`);
    if (it.armor) bits.push(`护体 ${it.armor}`);
    if (it.tool) {
      bits.push(`${TOOL_CN[it.tool.kind] || it.tool.kind} · 品级 ${it.tool.tier} · 速度 ${it.tool.speed}`
        + (it.tool.damage ? ` · 杀伤 ${it.tool.damage}` : ''));
    }
    if (it.stack > 1) bits.push(`每格可叠 ${it.stack}`);
    else bits.push('每格仅一件');
    out.push({
      cat: 'item', title: it.name, color: it.color, icon: it.icon,
      sub: `${q.name}（第 ${q.tier} 阶）`,
      body: bits.join('　'),
      tags: `${it.name} ${q.name} 物品 ${it.tool ? TOOL_CN[it.tool.kind] : ''}`,
    });
  }

  for (const b of BLOCKS) {
    if (b.id === 0) continue;
    const bits = [`硬度 ${b.hard}`];
    if (b.drop != null) bits.push(`挖取得 ${itemName(b.drop)}`);
    if (b.needTool) bits.push(`须持${TOOL_CN[b.needTool] || b.needTool}`);
    if (b.light) bits.push('自发光');
    if (!b.solid) bits.push('可穿过');
    if (BUILD_MATS.includes(b.id)) bits.push('可自建');
    out.push({
      cat: 'block', title: b.name, color: itemColor(b.id),
      sub: b.solid ? '实心' : '非实心',
      body: bits.join('　'),
      tags: `${b.name} 方块 地形`,
    });
  }

  for (const r of ALL_RECIPES) {
    const need = Object.entries(r.in)
      .map(([id, n]) => `${itemName(Number(id))}×${n}`).join('　');
    const cn = CAT_CN.get(r.cat) || r.cat;
    out.push({
      cat: 'recipe', title: `${itemName(r.out.id)}×${r.out.count}`, color: itemColor(r.out.id),
      sub: cn,
      body: `${need}${r.tip ? `　—— ${r.tip}` : ''}`,
      tags: `${itemName(r.out.id)} 配方 合成 ${cn}`,
    });
  }

  for (const s of SKILLS) {
    const lv = skills ? skills.level(s.key) : 1;
    const xp = skills ? skills.exp(s.key) : 0;
    out.push({
      cat: 'skill', title: s.name,
      sub: `${s.kind === 'gather' ? '采集' : '制作'} · 当前 ${lv} 级 ${xp} 经验`,
      body: s.desc,
      tags: `${s.name} 技能 ${s.kind === 'gather' ? '采集' : '制作'}`,
    });
  }

  const controls = [
    ['拖拽', '按住左键拖动', '在山水长卷上漫游'],
    ['滚轮', '向上放大 / 向下缩小', '长卷与近景之间切换；近景才能动土与采矿'],
    ['左键', '掘土开采', '挖掉一格，按地表掉落材料；水域挖不动'],
    ['右键', '垒建材', '在当前建材上垒一层，高度 +1'],
    ['1 ~ 9', '切换建材', '青砖、木梁、纸窗、竹席等十二种中式建材'],
    ['E', '采矿脉', '靠近露头按 E，5 秒进度条；须持矿镐，走开即中断'],
    ['C', '百工谱', '开合成面板，五类共五十式，缺料者变灰'],
    ['R', '回到图心', '视野跳回原点'],
    ['WASD / 方向键', '漫游', '按等距方向移动视野'],
    ['Esc 或右上角齿轮', '设置与帮助', '打开设置菜单，帮助标签里就是这份数据库'],
  ];
  for (const [k, t, d] of controls) {
    out.push({ cat: 'control', title: `${k}　${t}`, sub: '操作', body: d, tags: `${k} ${t} 操作 按键 帮助` });
  }

  const n = WORLD;
  const zoneNames = [];
  for (let r = 0; r < GRID.length; r++) {
    for (let c = 0; c < GRID[r].length; c++) {
      const z = GRID[r][c];
      if (!zoneNames.includes(z)) zoneNames.push(z);
    }
  }
  out.push({
    cat: 'world', title: '云山图幅',
    sub: `${n} × ${n} 格 · 十二区 · 四面环海`,
    body: `整幅山水分五横三纵，共 ${zoneNames.length} 区，四面环海：`
      + `北部是雪原与针叶林，中北为沙丘、平原、山地，中央为戈壁、草原、阔叶林，`
      + `中南为沼泽、河网、湖泊，最南五分之一是南海。`
      + `分界由噪声扭曲，区与区之间插值过渡，所以既不是棋盘格，也不会出断崖。`
      + `一图共 ${(n * n / 1e6).toFixed(0)} 百万格，海平面 ${SEA}，雪线 ${SNOW_LINE}；`
      + `地形由纯函数生成，走到哪算到哪，改动另存一层，所以原始山水永远不会被写坏。`,
    tags: '世界 图幅 山川 地形 海平面 雪线 分区 地貌 海洋',
  });

  // 十二区各是什么样子
  const POS = {
    snow: '北部西半', taiga: '北部东半',
    dune: '中北·西', plain: '中北·中', mount: '中北·东',
    gobi: '中央·西', steppe: '中央·中', forest: '中央·东',
    swamp: '中南·西', rivernet: '中南·中', lake: '中南·东',
    ocean: '南部 1/5',
  };
  const BIOME_DESC = {
    snow: '极北的雪原，终年积雪，雪线比别处低得多；雪线之下是冻土苔原，山间挂着冰川与雪溪。',
    taiga: '北方的针叶林海，深绿连绵，林下多药丛与野兽，是伐木的好去处。',
    dune: '西北的沙丘，风蚀出一道道波纹；低洼处偶尔积成绿洲，湖边才见草与灌木。',
    plain: '中北平原，平缓开阔，主河穿境而过，两岸最宜安家。',
    mount: '东北山地，群峰壁立、崖多雪早，五金矿山多半藏在这里。',
    gobi: '西部戈壁，黄褐碎石遍地，雨水稀少，只长着旱生的稀疏灌木。',
    steppe: '中央草原，世界的心脏，草场连绵、灌木点缀，河网自此发端。',
    forest: '东部阔叶林，茂密深绿，林中最是阴凉，野兽也最多。',
    swamp: '西南沼泽，低平积水，泥泞水道与浮萍连片，涉水要当心。',
    rivernet: '中南河网，主河在此分出无数支流，溪涧密如蛛网。',
    lake: '东南湖泊群，大小湖泊由小溪串成一串，水边芦苇与灌木最密。',
    ocean: '南海，占最南五分之一；沿岸有沙滩、崖岸与半岛，海中散布着小岛。',
  };
  for (const key of zoneNames) {
    out.push({
      cat: 'world', title: `地貌 · ${BIOME_NAME[key]}`,
      sub: POS[key] || '一带',
      body: BIOME_DESC[key],
      tags: `地貌 ${BIOME_NAME[key]} 分区 地形 山川`,
    });
  }

  // 水系：主河、支流、溪、湖、海
  const WATERS = [
    ['主河', '一条主河自北部雪山发源，蜿蜒南下穿过平原，越到下游越宽，最后注入南海；两岸留河滩，沿河最宜安家。'],
    ['支流', '主河之外的蜿蜒大江，横贯各区；河心最深，走兽常来饮水。'],
    ['小溪', '沿山脊的细密支流，比江窄得多也多得多；溪畔多是灌木与药丛。'],
    ['湖泊', '低洼处积水成湖。东南是一整片湖群，由小溪串连；别处的湖则零星散布。'],
    ['海洋', '四面环海，南面最阔。沿岸有沙滩与崖岸，海中散布岛屿；越往外越深。'],
  ];
  for (const [name, body] of WATERS) {
    out.push({
      cat: 'world', title: `水系 · ${name}`, sub: '随机生成', body,
      tags: `水系 ${name} 水 地图 河流 湖泊 海洋`,
    });
  }

  // 五金矿山
  for (const key of MINE_KEYS) {
    const ore = oreInfo(MINE_ORE[key]);
    out.push({
      cat: 'world', title: `矿山 · ${MINE_NAME[key]}`,
      sub: `出${ore.name}`,
      body: `低频噪声圈出成片的矿区，一座${MINE_NAME[key]}的露头格外密，区内多半就是${ore.name}。`
        + `须持${PICK_CN[ore.tier] || '矿镐'}以上，采空后五分钟自行复生。`,
      tags: `矿山 ${MINE_NAME[key]} ${ore.name} 矿脉 五金`,
    });
  }

  out.push({
    cat: 'world', title: '矿脉分布',
    sub: '约每千格一处露头',
    body: `${ORES.length} 种矿脉，按坐标确定性生成：低频噪声先圈出成片矿区，再在区内落矿，`
      + `所以矿是一脉一脉的。常见石煤占大头，灵矿万中无一。`,
    tags: '矿脉 分布 采集点 灵矿',
  });

  return out;
}

/** 关键词检索：标题、副题、正文、索引词都算 */
export function searchCodex(list, q) {
  const k = (q || '').trim().toLowerCase();
  if (!k) return list;
  return list.filter((e) => (e.title + e.sub + e.body + e.tags).toLowerCase().includes(k));
}

export function codexByCat(list, cat) {
  return !cat || cat === 'all' ? list : list.filter((e) => e.cat === cat);
}

export function catCount(list, cat) {
  return codexByCat(list, cat).length;
}
