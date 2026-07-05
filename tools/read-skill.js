import { getSkill } from './skills.js'

export class ReadSkill {
  async run({ skill: skillName }) {
    try {
      const skill = getSkill(skillName)
      return skill ? skill.body : `未找到 skill：${ skillName }`
    } catch (e) {

    }
  }
}