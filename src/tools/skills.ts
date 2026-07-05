import fsp from 'node:fs/promises'
import path from 'node:path'
import * as os from 'node:os'
import matter from 'gray-matter'
import type { SkillDefinition, SlashCommand } from '../types.js'

// 技能搜索路径：项目级技能优先，用户主目录技能作为全局补充。
const SKILLS_DIR = [
  path.join(process.cwd(), '.claude', 'skills'),
  path.join(os.homedir(), '.claude', 'skills')
]

// 技能注册表，key 是技能名称，value 是模型可读取的描述和正文。
const skills = new Map<string, SkillDefinition>()

// 重新扫描所有技能目录，返回当前可用技能列表。
export async function loadSkills(): Promise<SkillDefinition[]> {
  skills.clear()
  for (const dir of SKILLS_DIR) {
    await scanDir(dir)
  }
  return [...skills.values()]
}

async function scanDir(dir: string): Promise<void> {
  try {
    // 每个技能目录约定包含一个 SKILL.md。
    const entries = await fsp.readdir(dir, { withFileTypes: true })
    for (const entry of entries) {
      if (!entry.isDirectory()) {
        continue
      }
      const fullPath = path.join(dir, entry.name, 'SKILL.md')
      const raw = await fsp.readFile(fullPath, 'utf-8')
      // frontmatter 提供 name/description，正文在匹配后通过 readSkill 注入。
      const { meta, body } = parseFrontmatter(raw)
      // 未显式声明 name 时，使用目录名作为技能名。
      const name = typeof meta.name === 'string' ? meta.name : entry.name
      const description = typeof meta.description === 'string' ? meta.description : name
      skills.set(name, {
        name,
        description,
        // 技能正文
        body
      })
    }
  } catch (e) { }
}

function parseFrontmatter(raw: string): { meta: Record<string, unknown>, body: string } {
  // gray-matter 会把 YAML frontmatter 和 Markdown 正文分离。
  const { data, content } = matter(raw)
  return {
    meta: data,
    body: content
  }
}

// 根据名称查找技能，兼容用户传入 "/skillName" 的形式。
export function getSkill(name: string | null | undefined): SkillDefinition | null {
  return skills.get(String(name || '').replace(/^\//, '').trim()) || null
}

// 把可用技能摘要附加到系统提示词，让模型知道何时调用 readSkill。
export function enrichSystem(base: string): string {
  if (!skills.size) return base
  const lines = [
    ...[...skills.values()].map(skill => `- ${ skill.name }: ${ skill.description }`)
  ]
  return [base, '\nSkills(匹配时使用 readSkill 加载正文)', lines.join('\n')].join('\n')
}

// 解析 /skillName args 形式的输入；未命中技能时返回 null，按普通文本处理。
export function parseSlash(line: string): SlashCommand | null {
  const t = line.trim()
  if (!t.startsWith('/')) return null
  const rest = t.slice(1)
  const sp = rest.indexOf(' ')
  // 第一个空格前是技能名，空格后保留为用户补充参数。
  const cmd = (sp === -1 ? rest : rest.slice(0, sp)).trim()
  const skill = getSkill(cmd)
  if (!skill) return null
  return {
    skill,
    args: sp === -1 ? '' : rest.slice(sp + 1).trim()
  }
}
