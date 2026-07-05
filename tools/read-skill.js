import { getSkill } from './skills.js'

export class ReadSkill {
  // 返回指定 Skill 的完整正文，供模型在命中技能后读取详细指令。
  async run({ skill: skillName }) {
    try {
      const skill = getSkill(skillName)
      return skill ? skill.body : `未找到 skill：${ skillName }`
    } catch (e) {

    }
  }
}
