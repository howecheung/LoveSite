import React from 'react'
import {
  ArrowClockwise,
  ArrowLeft,
  ArrowDown,
  ArrowUp,
  Bell,
  Camera,
  Cards,
  ChatCircleText,
  CheckCircle,
  Cloud,
  Coins,
  DotsThree,
  Drop,
  EnvelopeOpen,
  Eye,
  FloppyDisk,
  Footprints,
  ForkKnife,
  GameController,
  Handshake,
  Heart,
  HeartBreak,
  Hourglass,
  House,
  Image as PImage,
  Layout,
  ListChecks,
  Lock,
  LockKeyOpen,
  MagnifyingGlass,
  MapPin,
  MapTrifold,
  Moon,
  Notebook,
  Palette,
  Paperclip,
  PencilSimple,
  PiggyBank,
  Plus,
  PuzzlePiece,
  Smiley,
  SmileyMeh,
  SmileySad,
  SmileyWink,
  Sun,
  Sunglasses,
  TShirt,
  Tag,
  Toolbox,
  TrashSimple,
  Trophy,
  UserCircle,
  UserSquare,
  X,
} from '@phosphor-icons/react'

// 界面图标 = Phosphor Icons（MIT，https://phosphoricons.com）
// duotone 权重自带 20% 透明副层，接近动森软色；颜色继承 currentColor。
// Ic({v})：emoji 键命中 → 画 Phosphor 组件；否则原样输出
//   （兼容数据库里用户自选的 emoji，如日子/打卡图标）。
const M: Record<string, [any, string?]> = {
  '🏠': [House], '📔': [Notebook], '🎬': [PImage], '🖼️': [PImage], '📋': [ListChecks],
  '⋯': [DotsThree], '➕': [Plus],
  '💑': [Heart], 'couple': [Heart], '👩‍❤️‍👨': [Heart], '💗': [Heart],
  '❤️': [Heart, 'fill'], '😍': [Heart],
  '👦': [UserSquare], '👧': [UserCircle], '👤': [UserCircle],
  '🔔': [Bell], '☀️': [Sun], '🌙': [Moon],
  '💰': [PiggyBank], '👗': [TShirt], '🧰': [Toolbox], '🩸': [Drop], '📌': [MapPin],
  '💬': [ChatCircleText], '⏳': [Hourglass], '🥹': [HeartBreak], '🥺': [HeartBreak],
  '😄': [Smiley], '😌': [SmileyMeh], '😎': [Sunglasses], '😢': [SmileySad],
  '💌': [EnvelopeOpen], '🔒': [Lock], '✅': [CheckCircle], '📎': [Paperclip],
  '🏷️': [Tag], 'palette': [Palette], '🧊': [ArrowClockwise], '🍜': [ForkKnife], '🗺️': [MapTrifold], '💾': [FloppyDisk],
  '🔍': [MagnifyingGlass], '🔐': [LockKeyOpen], '📷': [Camera],
  '☁️': [Cloud], '👣': [Footprints], '👁️': [Eye],
  '🎮': [GameController], 'gomoku': [Coins], '🧩': [PuzzlePiece], '🃏': [Cards],
  '🗑️': [TrashSimple], 'arrowL': [ArrowLeft], layout: [Layout], up: [ArrowUp, 'bold'], down: [ArrowDown, 'bold'], edit: [PencilSimple], del: [TrashSimple], '✏️': [PencilSimple], 'trophy': [Trophy, 'fill'], 'handshake': [Handshake, 'duotone'], 'close': [X, 'bold'],
}

export function Ic({ v, size = 20, w }: { v: string; size?: number; w?: any }) {
  const e = M[v]
  if (!e) return <span style={{ fontSize: size, lineHeight: 1 }}>{v}</span>
  const [C, weight] = e
  return <span className="icsvg" aria-label={v} style={{ width: size, height: size }}>
    <C size={size} weight={w || weight || 'duotone'} />
  </span>
}
