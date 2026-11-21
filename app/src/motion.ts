// 全站动效令牌——所有页面/组件从这里取参数，改一处全站同步
// 风格基准：Apple HIG —— ease-out 收尾、弹簧轻微过冲、列表错峰 50ms

export const spring = {
  soft:   { type: 'spring' as const, stiffness: 320, damping: 30, mass: 0.9 },   // 页面转场/大位移
  bouncy: { type: 'spring' as const, stiffness: 520, damping: 16 },               // 点赞/勾选/按压回弹
  snappy: { type: 'spring' as const, stiffness: 600, damping: 30 },               // 图标微动/hover
}

export const STAGGER = 0.05

// 页面转场方向：1=前进(进二级页/向右推入) -1=后退(返回) 0=同级(淡入上浮)
export const pageVariants = {
  initial: (d: number) => d === 1 ? { opacity: 0, x: 56 } : d === -1 ? { opacity: 0, x: -56 } : { opacity: 0, y: 18 },
  animate: { opacity: 1, x: 0, y: 0 },
  exit: (d: number) => d === 1 ? { opacity: 0, x: -40 } : d === -1 ? { opacity: 0, x: 60 } : { opacity: 0, y: -10 },
}

// 列表/宫格错峰容器
export const listVariant = {
  animate: { transition: { staggerChildren: STAGGER } },
}
export const itemVariant = {
  initial: { opacity: 0, scale: 0.86, y: 12 },
  animate: { opacity: 1, scale: 1, y: 0, transition: spring.soft },
}

// 按压通用
export const tapProps = { whileTap: { scale: 0.955 }, transition: spring.bouncy }
export const tapSmall = { whileTap: { scale: 0.88 }, transition: spring.bouncy }
