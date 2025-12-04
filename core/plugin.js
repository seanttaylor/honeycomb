const isArray = (result) => Array.isArray(result);
const isObject = (result) =>
  result !== null && typeof result === 'object' && !isArray(result);
const isUndefined = (result) => result === undefined;

/**
 * @param {Any[]| Object |undefined} input
 * @returns {Boolean}
 */
function validatePluginOutput(input) {
  if (!isArray(input) && !isObject(input) && !isUndefined(input)) {
    throw new TypeError(
      `Plugin return values **MUST** be of type array, object, or undefined. Received type (${typeof input}) `
    );
  }

  return input;
}

/**
 *
 */
export const PluginProvider = {
  SUPPORTED_PLUGIN_EXECUTION_MODE: ['pre_ex', 'post_ex', 'override'],
  /**
   * @param {String} serviceName - the name of the service to be extended
   * @param {Object} instance - an instance of the service that will be extended
   * @param {Object} PluginDef - the class that implements the plugin
   * @param {Object} declaredSandbox - the restricted sandbox created for the module
   */
  applyPlugin(serviceName, instance, PluginDef, declaredSandbox) {
    const mode = PluginDef.mode;
    const pluginInstance = new PluginDef(declaredSandbox);
    const pluginName = pluginInstance.constructor.name;
    const targetName = instance.constructor.name;

    const pluginProto = Object.getPrototypeOf(pluginInstance);
    const methodNames = Object.getOwnPropertyNames(pluginProto).filter(
      (methodName) =>
        methodName !== 'constructor' &&
        typeof pluginProto[methodName] === 'function'
    );

    methodNames.forEach((method) => {
      if (typeof instance[method] !== 'function') {
        // Warn — plugin implements a method not present on the target service
        console.warn(
          `WARNING (core.plugin): Plugin (${pluginName}) targeting "${serviceName}" implements method "${method}" which **DOES NOT** exist on the target service. Plugins may **ONLY** extend methods currently defined on the target.`
        );
        return;
      }

      const original = instance[method].bind(instance);
      const pluginHandler = pluginInstance[method].bind(pluginInstance);

      if (mode === 'override') {
        console.info(
          `⚡ Attaching plugin (${pluginName}) to target (${targetName}) in mode (${mode})`
        );

        instance[method] = async (...args) => {
          try {
            // plugin fully replaces original
            return validatePluginOutput(await pluginHandler(...args));
          } catch (ex) {
            console.error(
              `INTERNAL_ERROR (${pluginName}): **EXCEPTION ENCOUNTERED** while executing plugin method (${pluginName}.${method}). This plugin targets ${targetName}. See details -> ${ex.message}`
            );
            console.warn(
              `WARNING (core.plugin): Executing original method implemented in target service (${targetName}.${method}) after override plugin exception. **EXPECT ERRORS**`
            );
            return await original(...args);
          }
        };
      } else if (mode === 'pre_ex') {
        console.info(
          `⚡ Attaching plugin (${pluginName}) to target (${targetName}) in mode (${mode})`
        );
        instance[method] = async (...args) => {
          // plugin can optionally return replacement args (array) or undefined
          let modifiedArgs = args;

          try {
            const pluginResult = validatePluginOutput(
              await pluginHandler(...args)
            );

            //
            // Infer the *shape* of the original method call:
            //
            const originalAcceptsOptionsObject =
              args.length === 1 &&
              typeof args[0] === 'object' &&
              args[0] !== null &&
              !Array.isArray(args[0]);

            //
            // Enforce shape-matching rules:
            //
            if (pluginResult !== undefined) {
              const isArr = Array.isArray(pluginResult);
              const isObj =
                typeof pluginResult === 'object' &&
                pluginResult !== null &&
                !Array.isArray(pluginResult);

              // Insert links to docs and explainers on these errors in the message body
              if (originalAcceptsOptionsObject && !isObj) {
                throw new TypeError(
                  `Plugin method ${pluginName}.${method} must return a NON-ARRAY **object** or undefined when extending a method taking an options object. Received: ${typeof pluginResult}. Honeycomb **INFERS** the function signature of methods extended by plugins at runtime. Inspect the call site of the original method; ensure it is being called with the correctly`
                );
              }

              if (!originalAcceptsOptionsObject && !isArr) {
                throw new TypeError(
                  `Plugin method ${pluginName}.${method} must return an **array** or undefined when extending a method taking positional arguments. Received: ${typeof pluginResult}. Honeycomb **INFERS** the function signature of methods extended by plugins at runtime. Inspect the call site of the original method. Ensure it is being called correctly. Ensure the plugin method matches the function signature and/or interface of the method it extends. `
                );
              }

              //
              // Apply correctly:
              //
              if (isObj) modifiedArgs = [pluginResult];
              if (isArr) modifiedArgs = pluginResult;
            }
            return await original(...modifiedArgs);
          } catch (ex) {
            console.error(
              `INTERNAL_ERROR (${pluginName}): **EXCEPTION ENCOUNTERED** while executing plugin method (${pluginName}.${method}). This plugin targets ${targetName}. See details -> ${ex.message}`
            );
            console.warn(
              `WARNING (core): Executing original method implemented in target service (${targetName}.${method}) after pre-execution plugin exception. **EXPECT DEFAULT BEAHVIOR**`
            );

            return await original(...args);
          }
        };
      } else if (mode === 'post_ex') {
        console.info(
          `⚡ Attaching plugin (${pluginName}) to target (${targetName}) in mode (${mode})`
        );

        instance[method] = async (...args) => {
          const result = await original(...args);
          // plugin receives args and result; plugin may observe but cannot alter return value
          try {
            await pluginHandler(...args, result);
          } catch (ex) {
            // plugin errors shouldn't break core behavior — surface console.error
            console.error(
              `INTERNAL_ERROR (${pluginName}): **EXCEPTION ENCOUNTERED** while executing post-execution plugin method (${pluginName}.${method}). This plugin targets ${targetName}. See details -> ${ex.message}`
            );
            return result; // preserve original return value
          }
        };
      } else {
        // unreachable due to validation in #plugin
        throw new Error(
          `INTERNAL_ERROR (${pluginName}): **EXCEPTION ENCOUNTERED** during plugin execution. See details ->  Unsupported execution mode (${mode}) for plugin (${pluginName}) targeting ${serviceName}`
        );
      }
    });
  },
  /**
   *
   * @param {Object} PluginDefinition - a class that **defines** a service plugin
   * @returns {Boolean}
   */
  validatePlugin(PluginDefinition) {
    if (typeof PluginDefinition !== 'function') {
      console.error(
        `INTERNAL_ERROR (core.plugin): Could not register plugin. See details -> Plugins **MUST** be defined as a class.`
      );
      return false;
    }

    const serviceName = PluginDefinition.target;

    if (!serviceName) {
      console.error(
        `INTERNAL_ERROR (core.plugin): Could not register plugin (${PluginDefinition.name}). See details -> Plugins **MUST** be implemented with a static property 'target' specifying the name of the service the plugin will extend.`
      );
      return false;
    }

    const mode =
      PluginDefinition.mode ||
      PluginDefinition.static?.mode ||
      PluginDefinition?.constructor?.mode;

    if (!this.SUPPORTED_PLUGIN_EXECUTION_MODE.includes(mode)) {
      console.error(
        `INTERNAL_ERROR (core.plugin): Could not register plugin (${PluginDefinition.constructor.name}) for "${serviceName}". See details -> Plugins **MUST** declare static property 'mode' = "pre_ex" | "post_ex" | "override".`
      );
      return false;
    }

    return true;
  },
};
