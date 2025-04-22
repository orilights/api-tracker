<script setup lang="ts">
import type { HighlighterCore } from 'shiki'
import { copyText, exportFile, formatTime, getShortTime, initShiki, openLink, renderDiffs, renderLink } from '@/utils'
import { Settings, SettingType } from '@orilight/vue-settings'
import { transformerNotationDiff } from '@shikijs/transformers'
import dayjs from 'dayjs'
import * as Diff from 'diff'

const API_BASE = import.meta.env.VITE_API_BASE || '.'
const API_BASE_FALLBACK = import.meta.env.VITE_API_BASE_FALLBACK || ''

let apiBase: string = API_BASE

const settings = new Settings('api-tracker')

const highlighter = ref<HighlighterCore | null>(null)
const archiveData = ref<Record<string, string[]>>({})
const projects = ref<{
  name: string
  versionCount: number
  latestVersion: string
}[]>([])
const nameDict = ref<Record<string, string>>({})
const versions = ref<string[]>([])
const versionData = ref('')
const versionDataDiff = ref('')
const selectedProject = ref('')
const selectedVersion = ref('')
const searchStr = ref('')
const sort = ref<'name' | 'update'>('name')
const displayName = ref(true)
const enableDiff = ref(true)
const useFallback = ref(false)

const dialog = ref({
  show: false,
  type: 'link' as 'link' | 'image',
  data: [] as string[],
})

const sortedProjects = computed(() => {
  if (sort.value === 'name')
    return projects.value.slice().sort((a, b) => a.name.localeCompare(b.name))
  return projects.value.slice().sort((a, b) => dayjs(b.latestVersion).diff(dayjs(a.latestVersion)))
})
const display = computed(() => {
  if (highlighter.value === null)
    return 'highlighter not initialized'
  return renderLink(highlighter.value.codeToHtml(
    enableDiff.value && versionDataDiff.value !== ''
      ? versionDataDiff.value
      : versionData.value,
    {
      lang: 'json',
      theme: 'one-dark-pro',
      transformers: [transformerNotationDiff()],
    },
  ))
})
const searchEnable = computed(() => searchStr.value.trim() !== '')

onMounted(() => {
  regSettings()
  initShiki().then(hl => highlighter.value = hl)
  fetchData()
})

onUnmounted(() => {
  settings.unregisterAll()
})

function regSettings() {
  settings.register('sort', sort)
  settings.register('displayName', displayName, SettingType.Bool)
  settings.register('enableDiff', enableDiff, SettingType.Bool)
}

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
      fetchNameDict()
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

function fetchNameDict() {
  fetch(`${apiBase}/index.json`)
    .then(res => res.json())
    .then((data) => {
      nameDict.value = data
    })
    .catch(() => {
      nameDict.value = {}
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
  fetch(`${apiBase}/archive/${selectedProject.value}/${selectedVersion.value}.json`)
    .then(response => response.text())
    .then((data) => {
      if (selectedVersion.value !== version)
        return
      versionData.value = data
      versionDataDiff.value = ''

      const currentVersionIndex = versions.value.indexOf(selectedVersion.value)
      const hasPreviousVersion = currentVersionIndex + 1 < versions.value.length
      if (!hasPreviousVersion)
        return

      const previousVersion = versions.value[currentVersionIndex + 1]
      fetch(`${apiBase}/archive/${selectedProject.value}/${previousVersion}.json`)
        .then(response => response.text())
        .then((previousData) => {
          if (selectedVersion.value !== version)
            return
          const diffs = Diff.diffLines(previousData, versionData.value)
          versionDataDiff.value = renderDiffs(diffs)
        })
        .catch(() => {
          versionData.value = '数据加载失败'
        })
    })
    .catch(() => {
      versionData.value = '数据加载失败'
    })
}

function copyVersionData() {
  copyText(versionData.value)
}

function openVersionData() {
  openLink(`${apiBase}/archive/${selectedProject.value}/${selectedVersion.value}.json`)
}

function downloadVersionData() {
  exportFile(versionData.value, `${selectedProject.value}-${selectedVersion.value}.json`)
}

function switchFullscreen() {
  const el = document.querySelector('.code-browser')
  if (el === null)
    return
  el.requestFullscreen()
}

function switchSort() {
  sort.value = sort.value === 'name' ? 'update' : 'name'
}

function getDisplayName(key: string) {
  return displayName.value ? (nameDict.value[key] || key) : key
}

function extractLinks(showType: 'link' | 'image' = 'link') {
  const links = versionData.value.match(/https?:\/\/[^'"\s\\]+/g) || []
  if (showType === 'link') {
    dialog.value = {
      show: true,
      type: 'link',
      data: links,
    }
    return
  }
  const imageExts = ['jpg', 'jpeg', 'png', 'gif', 'webp']
  dialog.value = {
    show: true,
    type: 'image',
    data: links.filter(link => imageExts.some(ext => link.endsWith(ext))),
  }
}
function searchFilter(projectName: string) {
  return !searchEnable.value || getDisplayName(projectName).includes(searchStr.value)
}

function highlightKeyword(projectName: string, keyword: string) {
  return getDisplayName(projectName).replace(new RegExp(keyword, 'g'), '<span class=\'text-blue-500\'>$&</span>')
}
</script>

<template>
  <div class="flex h-screen w-screen overflow-hidden">
    <div class="flex h-full w-[300px] shrink-0 flex-col border-r">
      <h2 class="flex h-[45px] items-center border-b px-2 text-xl font-bold">
        API
        <button
          v-if="sort === 'name'"
          class="ml-2 transition-colors hover:text-blue-500" title="按名称排序"
          @click="switchSort"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-4">
            <path stroke-linecap="round" stroke-linejoin="round" d="M3 7.5 7.5 3m0 0L12 7.5M7.5 3v13.5m13.5 0L16.5 21m0 0L12 16.5m4.5 4.5V7.5" />
          </svg>
        </button>
        <button
          v-if="sort === 'update'"
          class="ml-2 transition-colors hover:text-blue-500" title="按更新时间排序"
          @click="switchSort"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-4">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
          </svg>
        </button>
        <button
          class="ml-2 transition-colors hover:text-blue-500" title="切换名称显示"
          @click="displayName = !displayName"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-4">
            <path stroke-linecap="round" stroke-linejoin="round" d="m10.5 21 5.25-11.25L21 21m-9-3h7.5M3 5.621a48.474 48.474 0 0 1 6-.371m0 0c1.12 0 2.233.038 3.334.114M9 5.25V3m3.334 2.364C11.176 10.658 7.69 15.08 3 17.502m9.334-12.138c.896.061 1.785.147 2.666.257m-4.589 8.495a18.023 18.023 0 0 1-3.827-5.802" />
          </svg>
        </button>
      </h2>
      <div>
        <input v-model="searchStr" type="text" placeholder="Search" class="w-full border-b p-2 outline-hidden">
      </div>
      <div class="flex-1 overflow-y-auto">
        <ul>
          <li
            v-for="project in sortedProjects"
            v-show="searchFilter(project.name)"
            :key="project.name"
            class="border-b px-2 py-1.5 transition-colors"
            :class="{
              'bg-gray-200': selectedProject === project.name,
            }"
            @click="handleProjectChange(project.name)"
          >
            <div class="break-all">
              <span v-if="searchEnable" v-html="highlightKeyword(project.name, searchStr)" />
              <span v-else>
                {{ getDisplayName(project.name) }}
              </span>
              <span class="ml-1 rounded-md bg-gray-500/20 px-1 text-xs">{{ project.versionCount }}</span>
            </div>
            <div class="mt-1 text-xs">
              <span class="text-gray-500">最新: {{ project.latestVersion }}</span>
              <span class="ml-1 text-gray-500">({{ getShortTime(project.latestVersion) }})</span>
              <span v-if="project.name.endsWith('_D')" class="ml-1 text-red-500">已弃用</span>
            </div>
          </li>
        </ul>
      </div>
    </div>
    <div class="flex h-full w-[240px] shrink-0 flex-col border-r">
      <h2 class="flex h-[45px] items-center border-b px-2 ">
        <span class="text-xl font-bold">
          Version
        </span>
        <div class="group relative ml-2">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-4">
            <path stroke-linecap="round" stroke-linejoin="round" d="m11.25 11.25.041-.02a.75.75 0 0 1 1.063.852l-.708 2.836a.75.75 0 0 0 1.063.853l.041-.021M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9-3.75h.008v.008H12V8.25Z" />
          </svg>
          <div class="pointer-events-none absolute left-[-102px] top-6 w-[220px] rounded-md border bg-white p-2 text-xs opacity-0 shadow-md transition-opacity group-hover:opacity-100">
            此处显示时间为抓取到更新的时间，抓取存在间隔且可能遇到网络错误，通常与 API 实际更新时间存在 0~10 分钟的延迟。
          </div>
        </div>
      </h2>
      <div class="flex-1 overflow-y-auto">
        <ul>
          <li
            v-for="version in versions" :key="version" class="border-b px-2 py-1 text-sm transition-colors"
            :class="{
              'bg-gray-200': selectedVersion === version,
            }"
            @click="handleVersionChange(version)"
          >
            {{ formatTime(version) }} <span class="text-xs text-gray-500">({{ getShortTime(version) }})</span>
          </li>
        </ul>
      </div>
    </div>
    <div class="flex h-full flex-1 flex-col overflow-hidden">
      <h2 class="flex h-[45px] items-center border-b px-2 text-xl font-bold">
        Data
        <button
          class="mx-2 box-border rounded-md border px-2 text-base font-medium transition-colors hover:border-blue-500 hover:text-blue-500"
          :class="{
            'border-blue-500 bg-blue-500 text-white! hover:border-blue-400 hover:bg-blue-400': enableDiff,
          }"
          @click="enableDiff = !enableDiff"
        >
          Diff
        </button>
        <button class="ml-2 transition-colors hover:text-blue-500" title="复制" @click="copyVersionData">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-4">
            <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 0 1-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 0 1 1.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 0 0-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 0 1-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 0 0-3.375-3.375h-1.5a1.125 1.125 0 0 1-1.125-1.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H9.75" />
          </svg>
        </button>
        <button class="ml-2 transition-colors hover:text-blue-500" title="新窗口打开" @click="openVersionData">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-4">
            <path stroke-linecap="round" stroke-linejoin="round" d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
          </svg>
        </button>
        <button class="ml-2 transition-colors hover:text-blue-500" title="下载" @click="downloadVersionData">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-4">
            <path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
          </svg>
        </button>
        <button class="ml-2 transition-colors hover:text-blue-500" title="全屏显示" @click="switchFullscreen">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-4">
            <path stroke-linecap="round" stroke-linejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" />
          </svg>
        </button>
        <button class="ml-2 transition-colors hover:text-blue-500" title="提取链接" @click="extractLinks('link')">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-4">
            <path stroke-linecap="round" stroke-linejoin="round" d="M13.19 8.688a4.5 4.5 0 0 1 1.242 7.244l-4.5 4.5a4.5 4.5 0 0 1-6.364-6.364l1.757-1.757m13.35-.622 1.757-1.757a4.5 4.5 0 0 0-6.364-6.364l-4.5 4.5a4.5 4.5 0 0 0 1.242 7.244" />
          </svg>
        </button>
        <button class="ml-2 transition-colors hover:text-blue-500" title="提取图片" @click="extractLinks('image')">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-4">
            <path stroke-linecap="round" stroke-linejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 0 0 1.5-1.5V6a1.5 1.5 0 0 0-1.5-1.5H3.75A1.5 1.5 0 0 0 2.25 6v12a1.5 1.5 0 0 0 1.5 1.5Zm10.5-11.25h.008v.008h-.008V8.25Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" />
          </svg>
        </button>
      </h2>
      <div class="code-browser w-full flex-1 overflow-hidden" v-html="display" />
    </div>
    <Teleport to="body">
      <Transition name="fade">
        <div v-if="dialog.show" class="fixed left-0 top-0 flex h-screen w-screen justify-center overflow-y-auto bg-black/30 px-[20px] py-[60px]" @click="dialog.show = false">
          <div class="content relative mx-auto h-fit w-full rounded-md border bg-white p-2 md:w-[730px]" @click.stop="null">
            <div class="flex items-center justify-between">
              <span class="pl-4 font-bold">
                {{ dialog.type === 'link' ? '链接' : '图片' }}提取
                <span class="rounded-md bg-gray-500/20 px-1 text-xs font-normal">{{ dialog.data.length }}</span>
              </span>
              <button class="rounded-md p-2 transition-colors hover:bg-black/10" @click="dialog.show = false">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-4">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <template v-if="dialog.type === 'link'">
              <div v-if="dialog.data.length === 0" class="p-2 text-center text-sm text-gray-500">
                无数据
              </div>
              <div class="flex flex-wrap p-2">
                <div v-for="link in dialog.data" :key="link" :title="link" class="flex min-w-full justify-between gap-2 text-nowrap rounded-md p-2 text-xs transition-all hover:bg-black/10 hover:pl-4">
                  <div class=" overflow-hidden text-ellipsis">
                    {{ link }}
                  </div>
                  <div class="flex gap-2">
                    <button class="transition-colors hover:text-blue-500" title="复制链接" @click="copyText(link)">
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-4">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 0 1-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 0 1 1.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 0 0-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 0 1-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 0 0-3.375-3.375h-1.5a1.125 1.125 0 0 1-1.125-1.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H9.75" />
                      </svg>
                    </button>
                    <button class="transition-colors hover:text-blue-500" title="新窗口打开" @click="openLink(link)">
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-4">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            </template>
            <template v-if="dialog.type === 'image'">
              <div v-if="dialog.data.length === 0" class="p-2 text-center text-sm text-gray-500">
                无数据
              </div>
              <div class="flex flex-wrap p-2">
                <div v-for="image in dialog.data" :key="image" :title="image" class="inline-block rounded-md p-2 transition-colors hover:bg-black/10">
                  <img class="block h-[50px] w-[100px] rounded-sm object-scale-down" loading="lazy" :src="image">
                  <div class="flex justify-center gap-2 p-2">
                    <button class="transition-colors hover:text-blue-500" title="复制图片链接" @click="copyText(image)">
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-4">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 0 1-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 0 1 1.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 0 0-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 0 1-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 0 0-3.375-3.375h-1.5a1.125 1.125 0 0 1-1.125-1.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H9.75" />
                      </svg>
                    </button>
                    <button class="transition-colors hover:text-blue-500" title="新窗口打开" @click="openLink(image)">
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-4">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            </template>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<style lang="scss">
.shiki {
  box-sizing: border-box;
  padding: 16px;
  width: 100%;
  height: 100%;
  overflow: auto;
  font-size: var(--text-sm);
  line-height: var(--tw-leading, var(--text-sm--line-height));
}

code {
  display: block;
  counter-reset: step;
  counter-increment: step 0;
  min-width: 100%;
  width: fit-content;
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

code .link {
  text-decoration: underline;
}

.has-diff .diff.line {
  width: calc(100% + 32px);
  display: inline-block;
  margin: 0 -16px;
  padding: 0 16px;
}

.has-diff .diff.remove {
  background-color: rgba(220, 38, 38, .14);
}

.has-diff .diff.remove::before {
  content :'';
  counter-increment: none;
}

.has-diff .diff.add {
  background-color: rgba(16, 185, 129, .14);
}

.fade-enter-active, .fade-leave-active {
  transition: opacity .3s;

  .content {
    transition: transform .3s;
  }
}

.fade-enter-from, .fade-leave-to {
  opacity: 0;

  .content {
    transform: scale(.9) translateY(20px);
  }
}
</style>
