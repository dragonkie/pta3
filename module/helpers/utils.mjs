import PtaDialog from "../applications/dialog.mjs";
import pokeapi from "./pokeapi.mjs";
import { PTA } from "./config.mjs";

/**
 * @typedef {Object} NotifyOptions
 * @prop {Boolean} permanent - should the mssage be displayed until manually dismissed
 * @prop {Boolean} localize - should the message be localize
 * @prop {Boolean} console - Should this notification be logged to console
 */

export default class utils {
    //============================================================
    // Notifications
    //============================================================

    static info(message, options) {
        ui.notifications.info(this.localize(message), options);
    }
    static warn(message, options) {
        ui.notifications.warn(this.localize(message), options);
    }
    static error(message, options) {
        ui.notifications.error(this.localize(message), options);
    }

    //============================================================
    // Localization
    //============================================================
    static localize(str) { return game.i18n.localize(str); }
    static format(str, data) { return game.i18n.format(str, data); }

    //============================================================
    // Pokemon functions
    //============================================================

    /**
     * @param {Object} options -
     * @param {String|null} options.name - if we already got a name, we can avoid prompting for one
     * @param {Boolean} options.forms -
     * @param {Boolean} options.species - 
     * @param {Boolean} options.moves - 
     * @returns 
     */
    static async importPokemonData(options = {}) {

        options = Object.assign({
            forms: false,
            species: false,
            moves: false,
            all: false,
            name: null
        }, options)

        try {
            // get the pokemon name to import with
            if (!options.name || options.name == '') {
                options.name = await new Promise(async (resolve, reject) => {
                    const app = await new PtaDialog({
                        window: { title: "PTA.Dialog.PokemonImporter" },
                        content: `
                        <input type="text" class="pokemon-name" placeholder="${pta.utils.localize(PTA.generic.pokemon)}">
                        <div class="form-group">
                            <label>Moves</label>
                            <div class="form-fields">
                                <input type="checkbox" name="moves">
                            </div>
                        </div>
                        <div class="form-group">
                            <label>Species</label>
                            <div class="form-fields">
                                <input type="checkbox" name="species">
                            </div>
                        </div>
                        <div class="form-group">
                            <label>Forms</label>
                            <div class="form-fields">
                                <input type="checkbox" name="forms">
                            </div>
                        </div>
                    `,
                        buttons: [{
                            label: "Confirm",
                            action: "confirm",
                            callback: () => { resolve(app.element.querySelector('.pokemon-name')?.value); app.close(); }
                        }, {
                            label: "Cancel",
                            action: "cancel",
                            callback: () => { reject(null); app.close() }
                        }],
                        submit: () => { resolve(app.element.querySelector('.pokemon-name')?.value); app.close(); }
                    }).render(true);

                    console.log(app)
                })
            }

            if (!options.name || options.name == '') return void pta.utils.warn('PTA.Warn.NeedPokemonName');

            // format the name a bit
            options.name = options.name.replace(/\s+/g, '-');

            this.info('PTA.Info.PleaseWaitImporting');

            // import the pokemon
            let pokemon = await pokeapi.pokemon(options.name);
            if (options.all || options.species) pokemon.species = await pokeapi.request(pokemon.species.url);
            if (options.all || options.forms) for (let i = 0; i < pokemon.forms.length; i++) pokemon.forms[i] = await pokeapi.request(pokemon.forms[i].url);
            if (options.all || options.moves) {
                for (let i = 0; i < pokemon.moves.length; i++) {
                    pokemon.moves[i] = await pokeapi.request(pokemon.moves[i].move.url);
                }
            }

            this.info('PTA.Info.ImportComplete');
            return pokemon;
        } catch (err) {
            console.error(err)
            return null;
        }
    }

    static honourLevel(num) {
        num += 1;
        let level = 1;
        let cost = 1;
        let count = 0;
        while (num > cost) {
            num -= cost;
            level += 1;
            count += 1;
            if (count >= 3) {
                count = 0;
                cost = Math.min(cost + 1, 5);
            }
        }
        return level;
    }

    static toTitleCase(str) {
        return str.replace(
            /\w\S*/g,
            text => text.charAt(0).toUpperCase() + text.substring(1).toLowerCase()
        );
    }

    static randomNature(options = {}) {
        let _options = {
            use: [],
            ban: [],
            neutral: true
        };
        // if only a boolean was passed, use it to decide neutrals
        if (typeof options == "boolean") options = { neutral: options }
        options = Object.assign(_options, options);

        // create a roster of valid natures to use
        let choices = [];
        if (options.use.length > 0) choices = options.use;
        else if (options.neutral) choices = Object.keys(pta.config.natures);
        else {
            choices = Object.keys(pta.config.natures);
            for (const i of Object.keys(pta.config.natureNeutral)) options.ban.push(i);
        }

        // check if neutral natures ahve been turned on
        if (!game.settings.get('pta3', 'neutralNatures')) {
            for (const a in pta.config.natureNeutral) options.ban.push(a);
        }

        for (const i of options.ban) {
            let index = 0;
            while (index > -1) {
                index = choices.indexOf(i);
                if (index < 0) break;
                choices.splice(index, 1);
            }
        }

        return choices[Math.floor(Math.random() * choices.length)];
    }

    /**
     * Converts the effectiveness level
     * @param {Array|String} attacker
     * @param {Array|String} defender 
     * @returns {Object}
     */
    static typeEffectiveness(attacker = [], defender = []) {
        if (!attacker || !defender) return null;
        if (!Array.isArray(attacker)) attacker = [attacker];
        if (!Array.isArray(defender)) defender = [defender];

        let data = {
            value: 0,
            percent: 1,
            immune: false,
        }

        for (const a of attacker) {
            if (typeof a != 'string' || a == '') continue;
            for (const d of defender) {
                if (typeof d != 'string' || d == '') continue;
                if (pta.config.typeEffectiveness[d].double.includes(a)) { data.value += 1; data.percent *= 2 }
                if (pta.config.typeEffectiveness[d].half.includes(a)) { data.value -= 1; data.percent /= 2 }
                if (pta.config.typeEffectiveness[d].immune.includes(a)) data.immune = true;
            }
        }
        return data;
    }

    /**
     * Calculates the damage dealt based on type effectiveness
     * @param {Number} num 
     * @param {String} type 
     */
    static damageCalc(num, type) {

    }

    /**
     * converts a number from -6 to 6 into a stat booster
     * @param {Number} num 
     * @returns {Number}
     */
    static AbilityStage(num) {
        num = Math.max(Math.min(6, num), -6); // clamps the boost value to what is allowed
        if (num < 0) {
            return 2 / (2 + (num * -1));// convert number to positive, reduce damage by the reduciton value
        } else if (num > 0) {
            return (2 + num) / 2; // nice and easy
        }
        return 1;
    }

    /**
     * 
     * @param {Number} num 
     */
    static AccuracyStage(num) {
        num = Math.max(Math.min(6, num), -6); // clamps the boost value to what is allowed
        if (num < 0) {
            return 3 / (3 + (num * -1));// convert number to positive, reduce damage by the reduciton value
        } else if (num > 0) {
            return (3 + num) / 3; // nice and easy
        }
        return 1;
    }

    //============================================================
    // Math animation helpers
    //============================================================
    static lerp(x, y, t) {
        return x * (1 - t) + y * t;
    }

    static lerpPoint(x1, y1, x2, y2, t) {
        return {
            x: this.lerp(x1, x2, t),
            y: this.lerp(y1, y2, t)
        }
    }

    static fastBezier(x1, y1, x2, y2, t) {
        const x3 = x1;
        const y3 = y2;

        const a = {
            x: this.lerp(x1, x3, t),
            y: this.lerp(y1, y3, t)
        }

        const b = {
            x: this.lerp(x3, x2, t),
            y: this.lerp(y3, y2, t)
        }

        return { x: this.lerp(a.x, b.x, t), y: this.lerp(a.y, b.y, t) };
    }

    static quadraticBezier(x1, y1, x2, y2, x3, y3, t) {

    }

    //============================================================
    // Combat
    //============================================================

    static getTargets() {
        const targets = [];
        for (const token of game.user.targets.entries()) {
            let doc = token[0].document;
            targets.push({
                token: token[0],
                doc: doc,
                sys: doc.actor.system
            })
        }
        if (targets.length <= 0) return null;
        return targets;
    }
}