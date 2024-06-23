<script setup lang="ts">
import { createHighlighterCore } from 'shiki'
import getWasm from 'shiki/wasm'
import { transformerNotationDiff } from '@shikijs/transformers'
import dayjs from 'dayjs'
import { SettingType, Settings } from '@orilight/vue-settings'
import * as Diff from 'diff'

const API_BASE = import.meta.env.VITE_API_BASE || '.'
const API_BASE_FALLBACK = import.meta.env.VITE_API_BASE_FALLBACK || ''

let apiBase: string = API_BASE

const settings = new Settings('api-viewer')

const highlighter = ref<any>(null)
const archiveData = ref<Record<string, string[]>>({})
const projects = ref<{
  name: string
  versionCount: number
  latestVersion: string
}[]>([])
const versions = ref<string[]>([])
const versionData = ref('')
const versionDataDiff = ref('')
const selectedProject = ref('')
const selectedVersion = ref('')
const searchStr = ref('')
const sort = ref<'name' | 'update'>('name')
const enableDiff = ref(true)
const useFallback = ref(false)

const sortedProjects = computed(() => {
  if (sort.value === 'name')
    return projects.value.slice().sort((a, b) => a.name.localeCompare(b.name))
  return projects.value.slice().sort((a, b) => dayjs(b.latestVersion).diff(dayjs(a.latestVersion)))
})
const display = computed(() => {
  if (highlighter.value === null)
    return ''
  return highlighter.value.codeToHtml(
    enableDiff.value && versionDataDiff.value !== ''
      ? versionDataDiff.value
      : versionData.value,
    {
      lang: 'json',
      theme: 'one-dark-pro',
      transformers: [transformerNotationDiff()],
    },
  )
})
const searchEnable = computed(() => searchStr.value.trim() !== '')

onMounted(async () => {
  settings.register('sort', sort)
  settings.register('enableDiff', enableDiff, SettingType.Bool)
  highlighter.value = await createHighlighterCore({
    themes: [import('shiki/themes/one-dark-pro.mjs')],
    langs: [import('shiki/langs/json.mjs')],
    loadWasm: getWasm,
  })
  fetchData()
})

onUnmounted(() => {
  settings.unregisterAll()
})

function fetchData() {
  fetch(`${apiBase}/archive.json`)
    .then(res => res.json())
    .then((data) => {
      archiveData.value = data
      projects.value = Object.keys(archiveData.value).map((project) => {
        return {
          name: project,
          versionCount: archiveData.value[project].length,
          latestVersion: formatTime(archiveData.value[project].sort((a, b) => {
            return Number.parseInt(b) - Number.parseInt(a)
          })[0]),
        }
      })
      nextTick(() =>
        handleProjectChange(sortedProjects.value[0].name),
      )
    })
    .catch((_err) => {
      if (!useFallback.value && API_BASE_FALLBACK !== '') {
        useFallback.value = true
        apiBase = API_BASE_FALLBACK
        fetchData()
        return
      }
      archiveData.value = {
        数据加载失败: [],
      }
      projects.value = [{
        name: '数据加载失败',
        versionCount: 0,
        latestVersion: '',
      }]
    })
}

function handleProjectChange(project: string) {
  selectedProject.value = project
  versions.value = archiveData.value[project].sort((a, b) => {
    return Number.parseInt(b) - Number.parseInt(a)
  })
  if (versions.value.length === 0)
    return
  handleVersionChange(versions.value[0])
}

function handleVersionChange(version: string) {
  selectedVersion.value = version
  fetch(`${apiBase}/archive/${selectedProject.value}-${selectedVersion.value}.json`)
    .then(response => response.text())
    .then((data) => {
      if (selectedVersion.value !== version)
        return
      versionData.value = data
      versionDataDiff.value = ''
      const hasPreviousVersion = versions.value.indexOf(selectedVersion.value) + 1 < versions.value.length
      if (hasPreviousVersion) {
        const previousVersion = versions.value[versions.value.indexOf(selectedVersion.value) + 1]
        fetch(`${apiBase}/archive/${selectedProject.value}-${previousVersion}.json`)
          .then(response => response.text())
          .then((previousData) => {
            if (selectedVersion.value !== version)
              return
            const diffs = Diff.diffLines(previousData, versionData.value)
            let diffText = ''
            diffs.forEach((part) => {
              if (part.added) {
                diffText += part.value.split('\n').map((line) => {
                  if (line === '') {
                    return ''
                  }
                  else {
                    return `${line} // [!code ++]`
                  }
                }).join('\n')
              }
              else if (part.removed) {
                diffText += part.value.split('\n').map((line) => {
                  if (line === '') {
                    return ''
                  }
                  else {
                    return `${line} // [!code --]`
                  }
                }).join('\n')
              }
              else {
                diffText += part.value
              }
            })
            versionDataDiff.value = diffText
          })
          .catch(() => {
            versionData.value = '数据加载失败'
          })
      }
    })
    .catch(() => {
      versionData.value = '数据加载失败'
    })
}

function copyVersionData() {
  navigator.clipboard.writeText(versionData.value)
}

function openVersionData() {
  const a = document.createElement('a')
  a.href = `${apiBase}/archive/${selectedProject.value}-${selectedVersion.value}.json`
  a.target = '_blank'
  a.click()
}

function downloadVersionData() {
  const blob = new Blob([versionData.value], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${selectedProject.value}-${selectedVersion.value}.json`
  a.click()
  URL.revokeObjectURL(url)
}

function formatTime(time: string) {
  return dayjs(time, 'YYYYMMDDHHmmss').format('YYYY-MM-DD HH:mm:ss')
}

function getShortTime(time: string) {
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

function switchSort() {
  sort.value = sort.value === 'name' ? 'update' : 'name'
}
</script>

<template>
  <div class="flex h-screen w-screen overflow-hidden">
    <div class="flex h-full w-[300px] shrink-0 flex-col border-r">
      <h2 class="gap-2 border-b p-2 text-xl font-bold">
        API
        <button v-if="sort === 'name'" class="ml-2" title="按名称排序" @click="switchSort">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-4">
            <path stroke-linecap="round" stroke-linejoin="round" d="M3 7.5 7.5 3m0 0L12 7.5M7.5 3v13.5m13.5 0L16.5 21m0 0L12 16.5m4.5 4.5V7.5" />
          </svg>
        </button>
        <button v-if="sort === 'update'" class="ml-2" title="按更新时间排序" @click="switchSort">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-4">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
          </svg>
        </button>
      </h2>
      <div>
        <input v-model="searchStr" type="text" placeholder="Search" class="w-full border-b p-2 outline-none">
      </div>
      <div class="flex-1 overflow-y-auto">
        <ul>
          <li
            v-for="project in sortedProjects"
            v-show="!searchEnable || project.name.includes(searchStr)"
            :key="project.name"
            class="border-b px-2 py-1.5 transition-colors"
            :class="{
              'bg-gray-200': selectedProject === project.name,
            }"
            @click="handleProjectChange(project.name)"
          >
            <div class="inline-block" v-html="project.name.replaceAll(searchStr, '<span class=\'text-blue-500\'>$&</span>')" />
            <span class="ml-1 rounded-md bg-gray-500/20 px-1 text-xs">{{ project.versionCount }}</span><br>
            <span class="text-xs text-gray-500">最新: {{ project.latestVersion }}  ({{ getShortTime(project.latestVersion) }})</span>
          </li>
        </ul>
      </div>
    </div>
    <div class="flex h-full w-[200px] shrink-0 flex-col border-r">
      <h2 class="border-b p-2 text-xl font-bold">
        Version
      </h2>
      <div class="flex-1 overflow-y-auto">
        <ul>
          <li
            v-for="version in versions" :key="version" class="border-b px-2 py-0.5 transition-colors"
            :class="{
              'bg-gray-200': selectedVersion === version,
            }"
            @click="handleVersionChange(version)"
          >
            {{ formatTime(version) }}
          </li>
        </ul>
      </div>
    </div>
    <div class="flex h-full flex-1 flex-col overflow-hidden">
      <h2 class="border-b p-2 text-xl font-bold">
        Data
        <button
          class="rounded-md border px-2 text-base font-medium transition-colors"
          :class="{
            'border-blue-500 text-blue-500': enableDiff,
          }"
          @click="enableDiff = !enableDiff"
        >
          Diff
        </button>
        <button class="ml-2" title="复制" @click="copyVersionData">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-4">
            <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 0 1-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 0 1 1.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 0 0-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 0 1-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 0 0-3.375-3.375h-1.5a1.125 1.125 0 0 1-1.125-1.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H9.75" />
          </svg>
        </button>
        <button class="ml-2" title="新窗口打开" @click="openVersionData">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-4">
            <path stroke-linecap="round" stroke-linejoin="round" d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
          </svg>
        </button>
        <button class="ml-2" title="下载" @click="downloadVersionData">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-4">
            <path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
          </svg>
        </button>
      </h2>
      <div class="w-full flex-1 overflow-hidden" v-html="display" />
    </div>
  </div>
</template>

<style>
.shiki {
  @apply box-border p-4 size-full overflow-auto text-sm;
}

code {
  counter-reset: step;
  counter-increment: step 0;
}

code .line::before {
  content: counter(step);
  counter-increment: step;
  width: 1rem;
  margin-right: 1.5rem;
  display: inline-block;
  text-align: right;
  color: rgba(115,138,148,.4)
}

.has-diff .diff.remove {
  background-color: rgba(220, 38, 38, .14);
}

code .line.diff.remove::before {
  content :'';
  counter-increment: none;
}

.has-diff .diff.add {
  background-color: rgba(16, 185, 129, .14);
}
</style>
