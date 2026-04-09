import chalk from 'chalk';
import { execSync } from 'child_process';
import os from 'os';

const isWindows = os.platform() === 'win32';

export function initConsole() {
  if (isWindows) {
    try {
      if (process.env.TERM !== 'dumb') {
        execSync('chcp 65001 >NUL 2>&1', { stdio: 'ignore' });
      }
    } catch {
    }
    process.env.FORCE_COLOR = '1';
  }
}

export function supportsColor() {
  if (isWindows) {
    const term = process.env.TERM;
    if (term === 'dumb' || process.env.NO_COLOR) return false;
    if (process.env.TERM && !term.includes('xterm') && !term.includes('screen')) {
      return false;
    }
    return true;
  }
  return chalk.supportsColor.hasBasic;
}

const WINDOWS_EMOJI_FALLBACK = isWindows;

export function stripEmoji(text) {
  const emojiRegex = /[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|[\u{1F600}-\u{1F64F}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2300}-\u{23FF}]|[\u{2B50}]|[\u{1FA00}-\u{1FAFF}]|[\u{231A}-\u{231B}]|[\u{23E9}-\u{23F3}]|[\u{23F8}-\u{23FA}]|[\u{25AA}-\u{25AB}]|[\u{25B6}]|[\u{25C0}]|[\u{25FB}-\u{25FE}]|[\u{2614}-\u{2615}]|[\u{2648}-\u{2653}]|[\u{267F}]|[\u{2693}]|[\u{26A1}]|[\u{26AA}-\u{26AB}]|[\u{26BD}-\u{26BE}]|[\u{26C4}-\u{26C5}]|[\u{26CE}]|[\u{26D4}]|[\u{26EA}]|[\u{26F2}-\u{26F3}]|[\u{26F5}]|[\u{26FA}]|[\u{26FD}]|[\u{2702}]|[\u{2705}]|[\u{2708}-\u{270D}]|[\u{270F}]|[\u{2712}]|[\u{2714}]|[\u{2716}]|[\u{271D}]|[\u{2721}]|[\u{2728}]|[\u{2733}-\u{2734}]|[\u{2744}]|[\u{2747}]|[\u{274C}]|[\u{274E}]|[\u{2753}-\u{2755}]|[\u{2757}]|[\u{2763}-\u{2764}]|[\u{2795}-\u{2797}]|[\u{27A1}]|[\u{27B0}]|[\u{27BF}]|[\u{2934}-\u{2935}]|[\u{2B05}-\u{2B07}]|[\u{2B1B}-\u{2B1C}]|[\u{2B1F}]|[\u{2B50}]|[\u{2B55}]|[\u{3030}]|[\u{303D}]|[\u{3297}]|[\u{3299}]|[\u{1F004}]|[\u{1F0CF}]|[\u{1F170}-\u{1F171}]|[\u{1F17E}-\u{1F17F}]|[\u{1F18E}]|[\u{1F191}-\u{1F19A}]|[\u{1F201}-\u{1F202}]|[\u{1F21A}]|[\u{1F22F}]|[\u{1F232}-\u{1F23A}]|[\u{1F250}-\u{1F251}]/gu;
  return text.replace(emojiRegex, '');
}

export function emojiToAscii(emoji) {
  const map = {
    '✅': '[OK]',
    '❌': '[X]',
    '⚠️': '[!]',
    '🚀': '>>',
    '📋': '[]',
    '📊': '[S]',
    '📄': '[F]',
    '🔍': '[?]',
    '🧪': '[T]',
    '⚡': '[*]',
    '💥': '[!!]',
    '✓': '[v]',
    '✗': '[x]',
    '⏱': '[ms]',
    '⏰': '[T]',
    '🔧': '[W]',
    '💻': '[C]',
    '📁': '[D]',
    '📝': '[M]',
    '🗑': '[D]',
    '🔄': '[R]',
    '📌': '[P]',
    '🏷': '[L]',
    '🎯': '[G]',
    '🔗': '[L]',
    '📈': '[Up]',
    '📉': '[Dn]',
    '🔒': '[S]',
    '🔓': '[US]',
    '🌐': '[W]',
    '📡': '[N]',
    '💡': '[!]',
    '🛠': '[T]',
    '⚙️': '[C]',
    '🗝': '[K]',
    '🧹': '[S]',
    '🎨': '[A]',
    '📦': '[PK]',
    '🏁': '[F]',
    '🚧': '[WIP]',
    '🔀': '[M]',
    '🔁': '[L]',
    '➡️': '->',
    '⬅️': '<-',
    '⬆️': '^',
    '⬇️': 'v',
    '⭐': '*',
    '🌟': '**',
    '✨': '**',
    '🔵': '[o]',
    '🔴': '[o]',
    '🟢': '[o]',
    '🟡': '[o]',
    '🔶': '[o]',
    '🔷': '[o]',
    '◀': '<',
    '▶': '>',
    '●': '*',
    '○': 'o',
    '■': '#',
    '□': '[]',
    '▪': '#',
    '▫': '_',
    '━': '-',
    '┃': '|',
    '┗': '+',
    '┏': '+',
    '┓': '+',
    '┛': '+',
  };
  return map[emoji] || emoji;
}

export function safeChalk(text) {
  if (!supportsColor()) {
    return typeof text === 'string' ? text : String(text);
  }
  return text;
}

export function formatConsoleText(text, options = {}) {
  const { stripEmoji: shouldStrip = false, fallbackEmoji = true } = options;

  if (!supportsColor() || shouldStrip) {
    let result = text;
    if (fallbackEmoji) {
      for (const [emoji, ascii] of Object.entries(emojiToAsciiMap)) {
        result = result.split(emoji).join(ascii);
      }
    } else {
      result = stripEmoji(result);
    }
    return result;
  }

  return text;
}

const emojiToAsciiMap = {
  '✅': '[OK]',
  '❌': '[X]',
  '⚠️': '[!]',
  '🚀': '>>',
  '📋': '[]',
  '📊': '[S]',
  '📄': '[F]',
  '🔍': '[?]',
  '🧪': '[T]',
  '⚡': '[*]',
  '💥': '[!!]',
  '✓': '[v]',
  '✗': '[x]',
};

export function logWithChalk(level, message) {
  const colorMap = {
    info: chalk.blue,
    success: chalk.green,
    warn: chalk.yellow,
    error: chalk.red,
    debug: chalk.gray,
  };

  const colorFn = colorMap[level] || chalk.white;
  const iconMap = {
    info: 'ℹ',
    success: '√',
    warn: '!',
    error: 'X',
    debug: '?',
  };

  const icon = iconMap[level] || '·';
  const formattedMessage = formatConsoleText(message);

  if (level === 'error') {
    console.error(colorFn(`${icon} ${formattedMessage}`));
  } else {
    console.log(colorFn(`${icon} ${formattedMessage}`));
  }
}

export default {
  initConsole,
  supportsColor,
  stripEmoji,
  safeChalk,
  formatConsoleText,
  logWithChalk,
  emojiToAscii,
};