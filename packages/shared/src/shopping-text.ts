const UNITS = [
  '公斤',
  '千克',
  'kg',
  'KG',
  'g',
  'ml',
  'L',
  '斤',
  '两',
  '克',
  '个',
  '只',
  '盒',
  '包',
  '袋',
  '瓶',
  '罐',
  '箱',
  '桶',
  '把',
  '根',
  '块',
  '片',
  '条',
  '颗',
  '枚',
  '支',
  '卷',
  '板',
  '份',
  '提',
  '打',
  '升',
  '毫升',
  '件',
  '双',
  '套',
]

const unitPattern = UNITS.slice()
  .sort((a, b) => b.length - a.length)
  .map((u) => u.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  .join('|')

const TRAILING = new RegExp(
  `^(.+?)(\\s*[x×*]\\s*|\\s+)?(\\d+(?:\\.\\d+)?)\\s*(${unitPattern})?$`,
  'i',
)
const LEADING = new RegExp(`^(\\d+(?:\\.\\d+)?)\\s*(${unitPattern})?\\s+(.+)$`, 'i')

export type ParsedItemText = { name: string; qty: number | null; unit: string | null }

/** Splits free text such as `鸡蛋 2盒`, `牛奶x3` or `2斤 五花肉` into name, quantity and unit. */
export function parseItemText(input: string): ParsedItemText {
  const text = input.trim().replace(/\s+/g, ' ')
  const leading = LEADING.exec(text)
  if (leading?.[1] && leading[3]) {
    return { name: leading[3].trim(), qty: Number(leading[1]), unit: leading[2] ?? null }
  }
  const trailing = TRAILING.exec(text)
  if (trailing?.[1] && trailing[3]) {
    const name = trailing[1].trim()
    // Names ending in digits (e.g. "iPhone15") are left intact unless a unit or separator is present.
    if (name && (trailing[2] !== undefined || trailing[4] !== undefined)) {
      return { name, qty: Number(trailing[3]), unit: trailing[4] ?? null }
    }
  }
  return { name: text, qty: null, unit: null }
}

export function normalizeItemName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, ' ')
}

// Order matters: earlier, more specific categories win (e.g. 奶粉 is 母婴, 牛奶 is 乳品 not 肉蛋).
const KEYWORD_CATEGORIES: Array<[string, RegExp]> = [
  ['母婴', /尿不湿|纸尿裤|奶粉|奶瓶|湿巾/],
  ['药品', /药|创可贴|口罩|维生素|感冒|体温计/],
  ['乳品', /奶|芝士|奶酪|黄油/],
  ['零食饮料', /零食|饼干|薯片|糖果|巧克力|饮料|可乐|果汁|咖啡|茶|啤酒|酒|水$/],
  ['水产', /鱼|虾|蟹|贝|鱿|海带|紫菜|蛤/],
  ['肉蛋', /肉|排骨|鸡|鸭|牛|羊|猪|蛋|培根|火腿|香肠/],
  ['清洁', /洗衣|洗洁|清洁|消毒|洁厕|洗涤|垃圾袋|抹布/],
  ['日用', /纸|牙|毛巾|洗发|沐浴|香皂|电池|灯泡|保鲜/],
  ['粮油', /米|面|油|盐|糖|酱|醋|调料|粉|饺子|馒头/],
  ['蔬果', /菜|瓜|果|葱|姜|蒜|椒|茄|土豆|番茄|西红柿|萝卜|菇|蕉|橙|桃|梨|莓|葡萄|柠檬|芒果/],
]

export function guessCategory(name: string): string | null {
  for (const [category, pattern] of KEYWORD_CATEGORIES) {
    if (pattern.test(name)) return category
  }
  return null
}
