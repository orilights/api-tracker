<script setup lang="ts">
import { getHighlighterCore } from 'shiki'
import getWasm from 'shiki/wasm'
import dayjs from 'dayjs'

const API_BASE = import.meta.env.VITE_API_BASE || '.'

const highlighter = ref<any>(null)
const archiveData = ref<Record<string, string[]>>({})
const projects = ref<{
  name: string
  versionCount: number
  latestVersion: string
}[]>([])
const versions = ref<string[]>([])
const versionData = ref('')
const selectedProject = ref('')
const selectedVersion = ref('')
const searchStr = ref('')

const display = computed(() => {
  if (highlighter.value === null)
    return ''
  return highlighter.value.codeToHtml(versionData.value, {
    lang: 'json',
    theme: 'one-dark-pro',
  })
})
const searchEnable = computed(() => searchStr.value.trim() !== '')

onMounted(async () => {
  highlighter.value = await getHighlighterCore({
    themes: [import('shiki/themes/one-dark-pro.mjs')],
    langs: [import('shiki/langs/json.mjs')],
    loadWasm: getWasm,
  })
  const response = await fetch(`${API_BASE}/archive.json`)
  archiveData.value = await response.json()
  projects.value = Object.keys(archiveData.value).sort().map((project) => {
    return {
      name: project,
      versionCount: archiveData.value[project].length,
      latestVersion: formatTime(archiveData.value[project].sort((a, b) => {
        return Number.parseInt(b) - Number.parseInt(a)
      })[0]),
    }
  })
  handleProjectChange(projects.value[0].name)
})

function handleProjectChange(project: string) {
  selectedProject.value = project
  versions.value = archiveData.value[project].sort((a, b) => {
    return Number.parseInt(b) - Number.parseInt(a)
  })
  handleVersionChange(versions.value[0])
}

function handleVersionChange(version: string) {
  selectedVersion.value = version
  fetch(`${API_BASE}/archive/${selectedProject.value}-${selectedVersion.value}.json`)
    .then(response => response.text())
    .then((data) => {
      versionData.value = data
    })
}

function copyVersionData() {
  navigator.clipboard.writeText(versionData.value)
}

function openVersion() {
  window.open(`${API_BASE}/archive/${selectedProject.value}-${selectedVersion.value}.json`)
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
  const seconds = dayjs().diff(dayjs(time, 'YYYYMMDDHHmmss'), 'second')
  if (seconds < 60)
    return `${seconds}秒前`

  if (seconds < 3600)
    return `${Math.floor(seconds / 60)}分钟前`

  if (seconds < 86400)
    return `${Math.floor(seconds / 3600)}小时前`

  return `${Math.floor(seconds / 86400)}天前`
}
</script>

<template>
  <div class="flex h-screen w-screen overflow-hidden">
    <div class="flex h-full w-[300px] shrink-0 flex-col border-r">
      <h2 class="border-b p-2 text-xl font-bold">
        API
      </h2>
      <div>
        <input v-model="searchStr" type="text" placeholder="Search" class="w-full border-b p-2 outline-none">
      </div>
      <div class="flex-1 overflow-y-auto">
        <ul>
          <li
            v-for="project in projects"
            v-show="!searchEnable || project.name.includes(searchStr)"
            :key="project.name"
            class="border-b px-2 py-1.5 transition-colors"
            :class="{
              'bg-gray-200': selectedProject === project.name,
            }"
            @click="handleProjectChange(project.name)"
          >
            <div class="inline-block" v-html="project.name.replaceAll(searchStr, '<span class=\'text-blue-500\'>$&</span>')" />
            <span class="ml-1 rounded-md bg-gray-300 px-1 text-xs">{{ project.versionCount }}</span><br>
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
        <button class="ml-2" @click="copyVersionData">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-4">
            <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 0 1-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 0 1 1.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 0 0-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 0 1-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 0 0-3.375-3.375h-1.5a1.125 1.125 0 0 1-1.125-1.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H9.75" />
          </svg>
        </button>
        <button class="ml-2" @click="openVersion">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-4">
            <path stroke-linecap="round" stroke-linejoin="round" d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
          </svg>
        </button>
        <button class="ml-2" @click="downloadVersionData">
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
</style>
