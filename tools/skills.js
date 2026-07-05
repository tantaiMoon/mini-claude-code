import fsp from 'fs/promises'
import path from 'path'
import * as os from 'node:os'
// 用于解析 skill。md 文件
import matter from 'gray-matter'

// 技能的存放目录，既有当前的项目目录，也有用户的根目录 .claude/skills
const SKILLS_DIR = [
  path.join(process.cwd(), '.claude', 'skills'),
  path.join(os.homedir(), '.claude', 'skills')
]

// 用与存放所有的技能
const skills = new Map

// 加载所有的 skills
export async function loadSkills() {
  skills.clear()
  for (const dir of SKILLS_DIR) {
    await scanDir(dir)
  }
  return [...skills.values()]
}

async function scanDir(dir) {
  try {
    const entries = await fsp.readdir(dir, { withFileTypes: true })
    for (const entry of entries) {
      if (!entry.isDirectory()) {
        continue
      }
      const fullPath = path.join(dir, entry.name, 'SKILL.md')
      const raw = await fsp.readFile(fullPath, 'utf-8')
      // 解析 SKILL。md文件，获取元数据和正文
      const { meta, body } = parseFrontmatter(raw)
      // 技能名称，如果没有使用目录名称
      const name = meta.name || entry.name
      skills.set(name, {
        name,
        description: meta.description || name,
        body // 节能正文
      })
    }
  } catch (e) { }
}

function parseFrontmatter(raw) {
  const { data, content } = matter(raw)
  return {
    meta: data,
    body: content
  }
}

// 获取 skill
export function getSkill(name) {
  // 根据技能获取对应的技能
  return skills.get(String(name || '').replace(/^\//, '').trim()) || null
}

//丰富系统提示词
export function enrichSystem(base) {
  // 没有技能返回原始
  if (!skills.size) return base
  let lines = [
    ...skills.values().map(skill => `- ${ skill.name }: ${ skill.description }`)
  ]
  return [base, '\nSkills(匹配时使用 readSkill 加载正文)', lines.join('\n')].join('\n')
}

// 解析 斜杠 开头的命令
export function parseSlash(line) {
  const t = line.trim()
  // 如果不是以斜杠开头返回 null
  if (!t.startsWith('/')) return null
  const rest = t.slice(1)
  // 查找第一个空格
  const sp = rest.indexOf(' ')
  // 获取目标命令
  const cmd = (sp === -1 ? rest : rest.slice(0, sp)).trim()
  const skill = getSkill(cmd)
  if (!skill) return null
  return {
    skill,
    args: sp === -1 ? '' : rest.slice(sp + 1).trim() // 额外的信息
  }
}