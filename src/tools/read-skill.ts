import { getSkill } from './skills.js'
import type { ReadSkillArgs, ToolRunner } from '../types.js'

export class ReadSkill implements ToolRunner<ReadSkillArgs> {
  // 返回指定 Skill 的完整正文，供模型在命中技能后读取详细指令。
  async run({ skill: skillName }: ReadSkillArgs): Promise<string | undefined> {
    try {
      const skill = getSkill(skillName)
      return skill ? skill.body : `未找到 skill：${ skillName }`
    } catch (e) {
      return undefined
    }
  }
}
