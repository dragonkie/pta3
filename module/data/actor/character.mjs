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
      for (const [skill, ability] of Object.entries(CONFIG.PTA.skillAbilities)) {
        // grab the ability that matches this skill
        for (const [key, value] of Object.entries(CONFIG.PTA.abilities)) {
          if (ability === value) _field[skill] = new SchemaField({
            talent: new NumberField({ ...requiredInteger, max: 2, min: 0, initial: 0 }),
            ability: new StringField({ required: true, nullable: false, initial: key }),
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
      active: new BooleanField({initial: false, required: true, nullable: false})
    }), { initial: [] })

    return schema;
  }

  prepareDerivedData() {
    super.prepareDerivedData();
    for (const key in this.skills) {
      let skill = this.skills[key]
      let ability = this.abilities[skill.ability];
      skill.total = skill.value + ability.mod + Math.floor(skill.talent * 2.5);
    }
  }

  getRollData() {
    const data = {};

    // Copy the ability scores to the top level, so that rolls can use
    // formulas like `@str.mod + 4`.
    if (this.abilities) {
      for (let [k, v] of Object.entries(this.abilities)) {
        data[k] = foundry.utils.deepClone(v);
      }
    }

    return data
  }

  async _preUpdate(...args) {
    console.log('preUpdate ', args);
    return super._preUpdate(...args);
  }

  _onUpdate(...args) {
    console.log('onUpdate ', args);
    super._onUpdate(...args);
  }
}