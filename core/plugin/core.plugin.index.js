import { PluginUtilities } from './core.plugin.utils.js';

/**
 * Enforces the return types produced by plugin methods are one of (Array, Non-Array Object or undefined)
 * @param {Any} input
 * @returns {Boolean}
 */
function validatePluginOutput(input) {
  if (
    !PluginUtilities.isArray(input) &&
    !PluginUtilities.isObject(input) &&
    !PluginUtilities.isUndefined(input)
  ) {
    throw new TypeError(
      `Plugin return values **MUST** be of type array, object, or undefined. Received type (${typeof input}) `
    );
  }

  return input;
}

/**
 * Determines whether a specified function is asynchronous
 * @param {Function} fn
 * @returns {Boolean}
 */
function isAsync(fn) {
  return fn && fn[Symbol.toStringTag] === 'AsyncFunction';
}

/**
 * @description Houses logic for plugin registration
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

      const originalIsAsync = PluginUtilities.isAsync(original);
      const pluginIsAsync = PluginUtilities.isAsync(pluginHandler);

      // Wrapper MUST be async if either side is async
      const wrapperIsAsync = originalIsAsync || pluginIsAsync;

      if (mode === 'override') {
        console.info(
          `⚡ Attaching plugin (${pluginName}) to target (${targetName}) in mode (${mode})`
        );

        if (wrapperIsAsync) {
          instance[method] = async (...args) => {
            try {
              return validatePluginOutput(await pluginHandler(...args));
            } catch (ex) {
              console.error(
                `INTERNAL_ERROR (${pluginName}): **EXCEPTION ENCOUNTERED** while executing plugin method (${pluginName}.${method}). This plugin targets ${targetName}. See details -> ${ex.message}`
              );
              console.warn(
                `WARNING (core.plugin): Executing original method implemented in target service (${targetName}.${method}) after override plugin exception. **EXPECT DEFAULT BEAHVIOR**`
              );
              return await original(...args);
            }
          };
        } else {
          instance[method] = (...args) => {
            try {
              return validatePluginOutput(pluginHandler(...args));
            } catch (ex) {
              console.error(
                `INTERNAL_ERROR (${pluginName}): **EXCEPTION ENCOUNTERED** while executing plugin method (${pluginName}.${method}). This plugin targets ${targetName}. See details -> ${ex.message}`
              );
              console.warn(
                `WARNING (core.plugin): Executing original method implemented in target service (${targetName}.${method}) after override plugin exception. **EXPECT DEFAULT BEAHVIOR**`
              );
              return original(...args);
            }
          };
        }
      } else if (mode === 'pre_ex') {
        console.info(
          `⚡ Attaching plugin (${pluginName}) to target (${targetName}) in mode (${mode})`
        );

        if (wrapperIsAsync) {
          instance[method] = async (...args) => {
            let modifiedArgs = args;
            try {
              const pluginResult = validatePluginOutput(
                await pluginHandler(...args)
              );
              modifiedArgs = PluginUtilities.preEx.verifyInterfaceCompatibility(
                pluginResult,
                args
              );
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
        } else {
          instance[method] = (...args) => {
            let modifiedArgs = args;
            try {
              const pluginResult = validatePluginOutput(pluginHandler(...args));
              modifiedArgs = PluginUtilities.preEx.verifyInterfaceCompatibility(
                pluginResult,
                args
              );
              return original(...modifiedArgs);
            } catch (ex) {
              console.error(
                `INTERNAL_ERROR (${pluginName}): **EXCEPTION ENCOUNTERED** while executing plugin method (${pluginName}.${method}). This plugin targets ${targetName}. See details -> ${ex.message}`
              );
              console.warn(
                `WARNING (core): Executing original method implemented in target service (${targetName}.${method}) after pre-execution plugin exception. **EXPECT DEFAULT BEAHVIOR**`
              );
              return original(...args);
            }
          };
        }
      } else if (mode === 'post_ex') {
        console.info(
          `⚡ Attaching plugin (${pluginName}) to target (${targetName}) in mode (${mode})`
        );

        if (wrapperIsAsync) {
          instance[method] = async (...args) => {
            const result = await original(...args);
            setTimeout(async () => {
              try {
                await pluginHandler(...args, result);
              } catch (ex) {
                console.error(
                  `INTERNAL_ERROR (${pluginName}): **EXCEPTION ENCOUNTERED** while executing post-execution plugin method (${pluginName}.${method}). This plugin targets ${targetName}. See details -> ${ex.message}`
                );
              }
              // timeout of 1 millisecond ensures `pluginHandler` and all side-effects fire after `original`
            }, 1);
            return result;
          };
        } else {
          instance[method] = (...args) => {
            const result = original(...args);
            try {
              pluginHandler(...args, result);
            } catch (ex) {
              console.error(
                `INTERNAL_ERROR (${pluginName}): **EXCEPTION ENCOUNTERED** while executing post-execution plugin method (${pluginName}.${method}). This plugin targets ${targetName}. See details -> ${ex.message}`
              );
            }
            return result;
          };
        }
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
