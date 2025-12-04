/**
 * @description Utility methods supporitng plugin management
 */
export const PluginUtilities = {
    /**
     * @returns {Boolean}
     */
    isArray(input) {
      return Array.isArray(input);
    },
    /**
     * @returns {Boolean}
     */
    isObject(input) {
      return input !== null && typeof input === 'object' && !this.isArray(input);
    },
    /**
     * @returns {Boolean}
     */
    isUndefined(input) {
      return input === undefined;
    },
    /**
     * Determines whether a specified function is asynchronous
     * @param {Function} fn
     * @returns {Boolean}
     */
    isAsync(fn) {
      return fn && fn[Symbol.toStringTag] === 'AsyncFunction';
    },
    /**
     * Used to **INFER** the basic call signature of function (i.e. does the function take positional arguments or an options hash) by args supplied. Returns true if the args are a valid options object and false otherwise.
     * @param {Any} args - arguments from a given instance method being extended by a plugin
     * @returns {Boolean}
     */
    isOptionsObjectArgument(args) {
      return (
        args.length === 1 &&
        typeof args[0] === 'object' &&
        args[0] !== null &&
        !Array.isArray(args[0])
      );
    },
    preEx: {
      /**
       * Ensures the value(s) returned from a pre-execution plugin method will satisfy the call signature of the method being extended (i.e. if the original method takes an options object as an argument, the pre-ex plugin method **actually** returns an options object)
       * @param {Any} pluginResult - any result returned from the pre-execution plugin method
       * @param {Any} args - the arguments provided to the original service method being extended
       */
      verifyInterfaceCompatibility(pluginResult, args) {
        // plugins can optionally return replacement args (array) or undefined
        let modifiedArgs = args;
  
        if (pluginResult !== undefined) {
          const PLUGIN_RESULT_IS_ARRAY = Array.isArray(pluginResult);
          const PLUGIN_RESULT_IS_OBJ = PluginUtilities.isObject(pluginResult);
          const ORIGINAL_METHOD_REQUIRES_OPTIONS_OBJ =
            PluginUtilities.isOptionsObjectArgument(args);
  
          // the method on the service instance **REQUIRES** an options object argument
          if (ORIGINAL_METHOD_REQUIRES_OPTIONS_OBJ && !PLUGIN_RESULT_IS_OBJ) {
            throw new TypeError(
              `Plugin method ${pluginName}.${method} must return a NON-ARRAY **object** or undefined when extending a method taking an options object. Received: ${typeof pluginResult}. Honeycomb **INFERS** the function signature of methods extended by plugins at runtime. Inspect the call site of the original method; ensure it is being called with the correctly`
            );
          }
  
          // the method on the service instance **REQUIRES** positional arguments
          if (!ORIGINAL_METHOD_REQUIRES_OPTIONS_OBJ && !PLUGIN_RESULT_IS_ARRAY) {
            throw new TypeError(
              `Plugin method ${pluginName}.${method} must return an **array** or undefined when extending a method taking positional arguments. Received: ${typeof pluginResult}. Honeycomb **INFERS** the function signature of methods extended by plugins at runtime. Inspect the call site of the original method; ensure it is being called correctly`
            );
          }
  
          // ensures the correct argument interface is supplied to the original service method
          if (PLUGIN_RESULT_IS_OBJ) modifiedArgs = [pluginResult];
          if (PLUGIN_RESULT_IS_ARRAY) modifiedArgs = pluginResult;
  
          return modifiedArgs;
        }
      },
    },
  };
  