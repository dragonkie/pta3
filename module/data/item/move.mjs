import ItemData from "../item.mjs";
import { PTA } from "../../helpers/config.mjs";
import utils from "../../helpers/utils.mjs";

const {
    ArrayField, BooleanField, IntegerSortField, NumberField, SchemaField, SetField, StringField
} = foundry.data.fields;

export default class MoveData extends ItemData {
    static defineSchema() {
        const isRequired = { required: true, nullable: false };
        const schema = super.defineSchema();

        // is this a physical, special, or effect move
        // moves that deal damage are still classified as physical / effect, such as ember
        const MoveClasses = {};
        for (const a in PTA.moveClass) MoveClasses[a] = pta.utils.localize(PTA.moveClass[a]);
        schema.class = new StringField({
            ...isRequired,
            blank: false,
            choices: { ...MoveClasses },
            initial: 'physical'
        })

        // Move typing
        const TypeChoices = {};
        for (const a in PTA.pokemonTypes) TypeChoices[a] = pta.utils.localize(PTA.pokemonTypes[a]);
        schema.type = new StringField({ ...isRequired, initial: 'normal', label: PTA.generic.type, choices: { ...TypeChoices } });

        // move damage
        schema.damage = new SchemaField({
            // normal data
            formula: new StringField({ ...isRequired, blank: false, initial: '2d6 + @atk', validate: (value) => Roll.validate(value), validationError: 'PTA.Error.InvalidFormula' }),
            // simulator data
            pokesim: new SchemaField({
                dice: new NumberField({ initial: 2 })
            })
        })

        schema.range = new NumberField({ initial: 5 })

        // additional crit chance
        schema.critical_chance = new NumberField({ initial: 0, ...isRequired, min: 0, max: 100 });

        // how many times can this move be used, set max to 0 for unlimited uses
        schema.uses = new SchemaField({
            value: new NumberField({ initial: 0 }),
            max: new NumberField({ initial: 0 }),
        })

        // Accuracy, a number added to accuracy roll, or if in sim, the strict percentile hit chance
        schema.accuracy = new NumberField({ ...isRequired, initial: 100 });

        // does this move heal the user for damage dealt
        schema.drain = new NumberField({ ...isRequired, initial: 0 });

        schema.aoe = new SchemaField({
            width: new NumberField({ initial: 0 }),
            length: new NumberField({ initial: 0 }),
            type: new StringField({
                initial: 'none',
                choices: { ...PTA.aoeTypes }
            })
        })

        schema.ailment = new SchemaField({
            type: new StringField({ initial: '' }),
            chance: new NumberField({ initial: 0 })
        })

        // if max or min hits is set to 0, the move isnt treated as a multi hit
        schema.multi_hit = new SchemaField({
            max: new NumberField({ initial: 0 }),
            min: new NumberField({ initial: 0 })
        })

        schema.priority = new NumberField({ initial: 0, ...isRequired });

        return schema;
    }

    get isRanged() { return this.range > 5 };

    getRollData() {
        const data = super.getRollData();
        let stat_key = 'atk'
        switch (this.class) {
            case 'special':
                stat_key = 'satk';
                break;
            case 'effect':
                stat_key = 'spd'
                break;
        }
        data.stat = {
            key: stat_key,
            ...data.actor.system.stats[stat_key]
        };

        return data;
    }

    async use(event, target, action) {
        console.log(action);
        console.trace();
        if (action == 'reload') return this._onUseReload(event, target);
        if (action == 'attack') return this._onUseAttack(event, target);
        return this._onUseAttack(event, target);
    }

    async _onUseAttack(event, target) {
        if (this.uses.max > 0 && this.uses.value <= 0) return void utils.warn('PTA.Warn.NoUses');

        // gather relevant data
        const attacker = this.actor;
        if (!attacker) return void utils.warn('PTA.Warn.NoUser');

        const targets = utils.getTargets();
        const rolldata = this.getRollData();
        if (!rolldata) return void utils.error('PTA.Error.RolldataMissing');

        //=====================================================================================================
        // POKESIM 
        //=====================================================================================================
        if (game.settings.get(game.system.id, 'pokesim')) {
            if (!targets) return void utils.warn('PTA.Warn.EnforceTargeting');
            // loop through targets to attack
            for (const target of targets) {
                let target_stat = {};
                // get the defending stats
                if (this.class == 'physical') target_stat = target.actor.system.stats.def;
                if (this.class == 'special') target_stat = target.actor.system.stats.sdef;
                if (this.class == 'effect') target_stat = target.actor.system.stats.spd;

                // make the accuracy roll
                const r_accuracy = new Roll('1d100', rolldata);
                let accuracy_tn = this.accuracy * (utils.AccuracyStage(attacker));
                await r_accuracy.evaluate();
                let critical = false;
                let missed = false;
                let dodged = false;

                // validate what happened with the attack
                if (r_accuracy.total >= 96) missed = true; // crit miss
                else if (r_accuracy.total > accuracy_tn) missed = true; // regular miss
                else if (r_accuracy.total <= 5 + this.critical_chance) critical = true; // critical hit

                // prepare message data
                const message_data = {};
                const message_config = { user: attacker.name, move: this.parent.name, target: target.token.name }

                // the user missed due to an evasion buff or accuracy debuff
                message_data.content = `<p><b>Accuracy</b></p>`
                if (r_accuracy.total <= this.accuracy && r_accuracy.total > accuracy_tn) {
                    message_data.content += utils.format('PTA.Chat.Attack.Dodge', message_config);
                    dodged = true;
                } else if (missed) message_data.content += utils.format(PTA.chat.attack.miss, message_config)
                else message_data.content += utils.format(critical ? PTA.chat.attack.crit : PTA.chat.attack.hit, message_config)
                message_data.content += await r_accuracy.render();
                // send the attack chat card
                if (missed) {
                    await r_accuracy.toMessage(message_data);
                    continue;
                }
                //============================================================================
                // Damage Roll
                //============================================================================
                let effectiveness = { value: 0, percent: 1, immune: false };
                if (target.actor.type == 'pokemon') {
                    let overriden = false
                    console.log(target.actor)
                    for (const override of target.actor.system.resistance_override) {
                        if (override.type == this.type) {
                            console.log('overide targets')
                            overriden = true;
                            switch (override.value) {
                                case 'immune':
                                    effectiveness = { value: 0, percent: 0, immune: true }
                                    break;
                                case 'double':
                                    effectiveness = { value: 1, percent: 2, immune: false }
                                    break;
                                case 'quadruple':
                                    effectiveness = { value: 2, percent: 4, immune: false }
                                    break;
                                case 'half':
                                    effectiveness = { value: -1, percent: 0.5, immune: false }
                                    break;
                                case 'quarter':
                                    effectiveness = { value: -2, percent: 0.25, immune: false }
                                    break;
                            }
                        }
                    }
                    if (!overriden) effectiveness = utils.typeEffectiveness(this.type, target.actor.system.getTypes());
                }
                let damage_scale = rolldata.stat.total / target_stat.total;
                let stab = attacker.system.getTypes().includes(this.type) ? 1.5 : 1;
                let crit = critical ? 1.5 : 1;

                let formula = `round((${this.damage.formula})*${damage_scale}*${effectiveness.percent}*${stab}*${crit})`;

                message_data.content += `<p><b>Damage</b></p>`
                // configure the damage chat card
                if (effectiveness.immune) {
                    message_data.content += utils.format(PTA.chat.damage.immune, message_config);
                }
                else switch (effectiveness.value) {
                    case -2:
                        message_data.content += utils.format(PTA.chat.damage.quarter, message_config);
                        break;
                    case -1:
                        message_data.content += utils.format(PTA.chat.damage.half, message_config);
                        break;
                    case 0:
                        message_data.content += utils.format(PTA.chat.damage.normal, message_config);
                        break;
                    case 1:
                        message_data.content += utils.format(PTA.chat.damage.double, message_config);
                        break;
                    case 2:
                        message_data.content += utils.format(PTA.chat.damage.quadruple, message_config);
                        break;
                }

                const r_damage = new Roll(formula, rolldata);
                await r_damage.evaluate();

                message_data.content += await r_damage.render();
                message_data.content += await TextEditor.enrichHTML(this.description);
                if (this.actor.type == 'pokemon' && this.actor.system.trainer != '') {
                    // validate that theres a real trainer attached to this pokemon
                    let trainer = await fromUuid(this.actor.system.trainer);
                    if (!trainer) message_data.speaker = ChatMessage.getSpeaker({ actor: this.actor })
                    else message_data.speaker = ChatMessage.getSpeaker({ actor: trainer })
                }

                let msg_damage = await r_damage.toMessage(message_data, message_config);
            }
        }
        //=====================================================================================================
        // REGULAR 
        //=====================================================================================================
        else {
            let r_accuracy = new Roll('1d20 + @stat.mod', rolldata);
            await r_accuracy.evaluate();
            let r_damage = new Roll(this.damage.formula);
            await r_damage.evaluate();

            const message_data = {
                content: '',
                speaker: null
            }

            if (this.actor.type == 'pokemon' && this.actor.system.trainer != '') {
                // validate that theres a real trainer attached to this pokemon
                let trainer = await fromUuid(this.actor.system.trainer);
                if (!trainer) message_data.speaker = ChatMessage.getSpeaker({ actor: this.actor })
                else message_data.speaker = ChatMessage.getSpeaker({ actor: trainer })
            }

            message_data.content += `<p><b>${utils.localize(PTA.generic.accuracy)}</b></p>`
            message_data.content += await r_accuracy.render();
            message_data.content += `<p><b>${utils.localize(PTA.generic.damage)}</b></p>`
            message_data.content += await r_damage.render();

            let message = r_accuracy.toMessage(message_data);
        }

        if (this.uses.max > 0) this.parent.update({ 'system.uses.value': this.uses.value - 1 });
    }

    async _onUseReload(event, target) {
        if (this.uses.max > 0 && this.uses.value < this.uses.max) {
            this.parent.update({ system: { uses: { value: this.uses.max } } });
        }
    }
}