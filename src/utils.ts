import dayjs from 'dayjs'
import { createHighlighterCore } from 'shiki'
import getWasm from 'shiki/wasm'

export function formatTime(time: string) {
  return dayjs(time, 'YYYYMMDDHHmmss').format('YYYY-MM-DD HH:mm:ss')
}

export function getShortTime(time: string) {
  const minute = 60
  const hour = 60 * minute
  const day = 24 * hour
  const seconds = dayjs().diff(dayjs(time, 'YYYYMMDDHHmmss'), 'second')
  if (seconds < minute)
    return `${seconds}秒前`

  if (seconds < hour)
    return `${Math.floor(seconds / minute)}分钟前`

  if (seconds < day)
    return `${Math.floor(seconds / hour)}小时前`

  return `${Math.floor(seconds / day)}天前`
}

export function renderLink(html: string) {
  const regex = /"https?:\/\/[^"]+"/g

  return html.replace(regex, (text) => {
    const url = text.slice(1, -1)
    return `"<a href="${url}"" target="_blank" class="click-link">${url}</a>"`
  })
}

export function renderDiffs(diffs: Diff.Change[]) {
  let result = ''
  diffs.forEach((part) => {
    if (part.added) {
      result += part.value.split('\n').map((line) => {
        if (line === '') {
          return ''
        }
        else {
          return `${line} // [!code ++]`
        }
      }).join('\n')
    }
    else if (part.removed) {
      result += part.value.split('\n').map((line) => {
        if (line === '') {
          return ''
        }
        else {
          return `${line} // [!code --]`
        }
      }).join('\n')
    }
    else {
      result += part.value
    }
  })
  return result
}

export function copyText(text: string) {
  navigator.clipboard.writeText(text)
}

export function exportFile(data: string, fileName: string) {
  const blob = new Blob([data], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  a.click()
  URL.revokeObjectURL(url)
}

export function initShiki() {
  return createHighlighterCore({
    themes: [import('shiki/themes/one-dark-pro.mjs')],
    langs: [import('shiki/langs/json.mjs')],
    loadWasm: getWasm,
  })
}
