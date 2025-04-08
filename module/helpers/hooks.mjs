import utils from "./utils.mjs";

/**
 * @callback HooksOn
 * @param {String} hook - the event to be called on
 * @param {Function} fn - the function to be triggered
 * @param {Object} options - options to customize the registered hook
 * @returns {Number} Id number of the registered hook
 */

/**
 * @callback HookOnce
 * @param {String} hook - the hook to be called on
 * @param {Function} fn - the function to be triggered
 */

/**
 * @callback HookOff
 * @param {String} hook - the event to unregister from
 * @param {Function|Number} fn - the function, or it's id number, to be disabled
 */

/**
 * @typedef {Object} Hooks
 * @prop {HooksOn} on - register a hook to be called
 * @prop {HookOnce} once - register a single use hook
 * @prop {HookOff} off - delist a hook from active duty
 */

export default function registerHooks() {
    Hooks.once('renderItemDirectory', async (directory, element, data) => {
        /**@type {Element} */
        let ele = element[0].querySelector('.directory-footer.action-buttons');

        let button = document.createElement('BUTTON');
        button.innerHTML = utils.localize(`PTA.Button.ImportItem`);
        ele.appendChild(button);
    })

    Hooks.once('renderActorDirectory', async (directory, element, data) => {
        /**@type {Element} */
        let ele = element[0].querySelector('.directory-footer.action-buttons');

        let button = document.createElement('BUTTON');
        button.innerHTML = utils.localize(`PTA.Button.ImportPokemon`);
        ele.appendChild(button);

        button.addEventListener('click', async () => {
            console.log('open actor import application')
        })
    })
}