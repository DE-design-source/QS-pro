import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

/* Cỡ chữ (Cài đặt ▸ Giao diện ▸ Cỡ chữ) chỉ phóng CHỮ, không phóng cả giao diện.
   Toàn app viết cỡ chữ bằng px cố định nên lúc build mọi font-size được nhân với biến --fs
   (ThemeContext / global.css gán lên <html>, mặc định 1):
     CSS   font-size: 13px        ->  font-size: calc(13px * var(--fs, 1))   (kể cả clamp(...) có px)
     JSX   fontSize: 13           ->  fontSize: 'calc(13px * var(--fs, 1))'
   Cỡ chữ tính bằng biểu thức (vd. size * 0.36 của avatar) được giữ nguyên. */
const FS = 'var(--fs, 1)'
const NUM = '(\\d+(?:\\.\\d+)?)'
const END = '(?=\\s*[,}\\n\\r])'

const fontScaleCss = {
  postcssPlugin: 'siteflow-font-scale',
  Declaration: {
    'font-size': decl => {
      const value = decl.value.trim()
      const m = /^(\d*\.?\d+)px$/.exec(value)
      if (m) { if (Number(m[1]) > 0) decl.value = `calc(${m[1]}px * ${FS})` }
      /* Cỡ chữ co giãn theo khung, vd. clamp(11.5px, 3.8cqi, 13px): nhân cả biểu thức */
      else if (/\dpx/.test(value) && !value.includes('--fs')) decl.value = `calc(${value} * ${FS})`
    },
  },
}

function fontScaleJsx() {
  const plain = new RegExp(`\\bfontSize:\\s*${NUM}${END}`, 'g')
  const quoted = new RegExp(`\\bfontSize:\\s*(['"])${NUM}px\\1`, 'g')
  const ternary = new RegExp(`\\bfontSize:\\s*([\\w.!]+)\\s*\\?\\s*${NUM}\\s*:\\s*${NUM}${END}`, 'g')
  return {
    name: 'siteflow-font-scale',
    enforce: 'pre',
    transform(code, id) {
      const file = id.split('?')[0]
      if (!file.includes('/src/') || !/\.jsx?$/.test(file) || !code.includes('fontSize')) return null
      const out = code
        .replace(plain, (_, n) => `fontSize: 'calc(${n}px * ${FS})'`)
        .replace(quoted, (_, q, n) => `fontSize: 'calc(${n}px * ${FS})'`)
        .replace(ternary, (_, cond, a, b) => `fontSize: \`calc(\${${cond} ? ${a} : ${b}}px * ${FS})\``)
      return out === code ? null : { code: out, map: null }
    },
  }
}

export default defineConfig({
  plugins: [fontScaleJsx(), react()],
  css: { postcss: { plugins: [fontScaleCss] } },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
