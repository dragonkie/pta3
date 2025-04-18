import { PTA } from "../../helpers/config.mjs";
import ActorData from "../actor.mjs";

const {
  ArrayField, BooleanField, IntegerSortField, NumberField, SchemaField, SetField, StringField, ObjectField
} = foundry.data.fields;

export default class CharacterData extends ActorData {

  static defineSchema() {
    const requiredInteger = { required: true, nullable: false, integer: true };
    const schema = super.defineSchema();

    schema.honours = new NumberField({ ...requiredInteger, initial: 0, min: 0 });

    // helper function for defining skills
    const _getSkillField = () => {
      let _field = {};
      // loop through list of skills
      for (const [skill, stat] of Object.entries(CONFIG.PTA.skillAbilities)) {
        // grab the stats that matches this skill
        for (const [key, value] of Object.entries(CONFIG.PTA.stats)) {
          if (stat === value) _field[skill] = new SchemaField({
            talent: new NumberField({ ...requiredInteger, max: 2, min: 0, initial: 0 }),
            stat: new StringField({ required: true, nullable: false, initial: key }),
            value: new NumberField({ ...requiredInteger, initial: 0 })
          })
        }
      }
      return new SchemaField(_field);
    }

    schema.skills = _getSkillField();
    schema.credits = new NumberField({ ...requiredInteger, initial: 0 });

    schema.pokemon = new ArrayField(new SchemaField({
      uuid: new StringField({ initial: '', required: true, nullable: false }),
      name: new StringField({ initial: '', required: true, nullable: false }),
      active: new BooleanField({ initial: false, required: true, nullable: false })
    }), { initial: [] })

    return schema;
  }

  prepareDerivedData() {
    super.prepareDerivedData();
    for (const key in this.skills) {
      let skill = this.skills[key]
      let stat = this.stats[skill.stat];
      skill.total = skill.value + stat.mod + Math.floor(skill.talent * 2.5);
    }
  }

  getRollData() {
    const data = super.getRollData();

    // Copy the stat scores to the top level, so that rolls can use
    // formulas like `@str + 4`.
    // abbreviations repersent modifiers
    // full length repersents total score
    for (let [k, v] of Object.entries(this.stats)) {
      data[k] = v.mod;
      data[PTA.statKeyLong[k]] = v.total;
    }

    return data;
  }

  async _preUpdate(changed, options, userId) {
    return await super._preUpdate(changed, options, userId);
  }

  _onUpdate(changed, options, userId) {
    return super._onUpdate(changed, options, userId);
  }
}