import sha256 from 'js-sha256';

import { PluginProvider } from './plugin/core.plugin.index.js';
import { HCSystemConfigurationProvider } from './core.config.js';

/**
 * Generates a version 4 UUID
 * @returns {String}
 */
const generateUUID = () => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

export class Sandbox extends EventTarget {
  #registry = {}; // module factories (moduleName -> factory)
  #policies = {}; // moduleName -> { allowedAPIs: [] }
  #plugins = {}; // module plugins (moduleName -> factory)

  /**
   * @param {String[]} modules - module names to register for this sandbox instance
   * @param {Function} callback - app entrypoint, receives unrestricted sandbox
   * @param {Object} policies - maps moduleName -> { allowedAPIs: [string] }
   */
  constructor(modules, callback, policies = {}) {
    super();

    // Save policies
    this.#policies = Object.assign({}, policies);

    // --- CORE namespace (always available to both app and modules) ---
    const core = {
      createHash(str) {
        return sha256.create().update(str).hex();
      },
      generateUUID,
      fetch: fetch,
      logger: {
        getLoggerInstance: () => console,
      },
    };

    // The app-visible 'my' object that will host lazy getters for all modules.
    // This object is the single source-of-truth backing modules, and module proxies
    // will forward to it when allowed.
    const my = {};

    // We'll collect factory functions and a list of bootstrap modules.
    const factories = {};
    const bootstrapList = [];

    // Phase 1: Build factories (no instantiation yet) and capture bootstrap intent.
    modules.forEach((moduleName) => {
      const moduleDefinition = Sandbox.modules[moduleName];

      if (!moduleDefinition) {
        console.error(
          `INTERNAL_ERROR (core): Cannot create factory; module definition not found (${moduleName})`
        );
        return;
      }

      // If the module class declares `bootstrap=true`, mark it for autostart.
      if (moduleDefinition.bootstrap) {
        bootstrapList.push(moduleName);
      }

      // Create factory: when invoked, construct the service with a restricted sandbox
      factories[moduleName] = () => {
        // Each module's constructor receives a *restricted* sandbox view.
        // We call this.declare(...) here so the module never sees the full 'my' namespace.
        const declared = this.#declare(moduleName, core, my);
        const instance = new Sandbox.modules[moduleName](declared);

        // If there is a registered plugin for this service, apply the plugin to the service instance
        const PluginDef = this.#plugins[moduleName];

        if (PluginDef) {
          try {
            PluginProvider.applyPlugin(
              moduleName,
              instance,
              PluginDef,
              declared
            );
          } catch (ex) {
            console.error(
              `INTERNAL_ERROR (core): **EXCEPTION ENCOUNTERED** while applying plugin to service (${moduleName}). See details -> ${ex.message}`
            );
          }
        }

        return instance;
      };
    });

    // Phase 2: Define lazy getters on the public 'my' object so every service name is addressable.
    Object.entries(factories).forEach(([moduleName, factory]) => {
      Object.defineProperty(my, moduleName, {
        configurable: true,
        enumerable: true,
        get: () => {
          // Store the instance on a internal key so the getter can detect prior instantiation.
          const internalKey = `__${moduleName}`;

          if (!my[internalKey]) {
            try {
              my[internalKey] = factory();
            } catch (ex) {
              console.error(
                `INTERNAL_ERROR (core): Could not create module (${moduleName}); ensure this module is registered via Sandbox.modules.of() and that it is INITIALIZED. See details -> ${ex.message}`
              );
            }
          }

          return my[internalKey];
        },
      });
    });

    // The unrestricted sandbox (what the application host callback receives).
    // It exposes all methods on the 'my' (unrestricted) and 'core' namespaces.
    const fullSandbox = {
      core,
      my,
      addEventListener: this.addEventListener.bind(this),
      dispatchEvent: this.dispatchEvent.bind(this),
    };

    // Phase 3: Instantiate autostart/bootstrap modules by accessing the lazy getters.
    // Because getters already exist, any lazy lookup inside bootstrap constructors is safe.
    bootstrapList.forEach((moduleName) => {
      try {
        // Accessing fullSandbox.my[moduleName] triggers the getter -> factory -> instance.
        /* eslint-disable no-unused-expressions */
        fullSandbox.my[moduleName];
        /* eslint-enable no-unused-expressions */
      } catch (ex) {
        console.error(
          `INTERNAL_ERROR (sandbox): Failed to autostart bootstrap module (${moduleName}). ${ex.message}`
        );
      }
    });

    // Execute the app callback with the unrestricted sandbox.
    setTimeout(async () => {
      try {
        await callback(fullSandbox);
      } catch (ex) {
        console.error(
          `INTERNAL_ERROR (core): Exception in application callback. See details -> ${ex.message}`
        );
      }
      // timeout of 0 milliseconds ensures the callback fires on the next tick allowing any plugins defined to be registered
    }, 0);

    // Restrict external return surface: only expose a safe dispatchEvent method.
    return {
      // allows code **outside** the Sandbox instance to notify the instance of events
      dispatchEvent: this.dispatchEvent.bind(this),
      plugin: this.#plugin.bind(this),
    };
  }

  /**
   * Returns a restricted view of the sandbox for a specific moduleId.
   * Modules receive this view when they are constructed.
   *
   * Policy semantics (default-deny):
   * - If a policy entry exists for moduleId, allowedAPIs = policies[moduleId].allowedAPIs
   * - If no policy entry exists, allowedAPIs = [] (default deny)
   *
   * The returned object includes:
   * - core (always available)
   * - my (Proxy that throws POLICY_ERROR on unauthorized access)
   * - addEventListener / dispatchEvent bound to this Sandbox
   *
   * @param {String} moduleId
   * @param {Object} core - the core utilities object
   * @param {Object} my - the backing 'my' with lazy getters (unrestricted)
   */
  #declare(moduleId, core, my) {
    // Pull allowed APIs for this module; default deny if none specified.
    const allowed =
      (this.#policies[moduleId] && this.#policies[moduleId].allowedAPIs) || [];

    // Freeze a shallow copy to avoid accidental mutation
    const allowedSet = new Set(Array.isArray(allowed) ? allowed.slice() : []);

    const restrictedMy = new Proxy(
      {},
      {
        get: (_, prop) => {
          // Non-string props (symbols etc.) should be forwarded if they are internal
          if (typeof prop !== 'string') {
            return undefined;
          }

          // Putting the module's own name in allowed is unnecessary; attempts to
          // access its own API via my.SelfService would be considered inter-module access.
          // Deny unless explicitly allowed.
          if (!allowedSet.has(prop)) {
            throw new Error(
              `POLICY_ERROR: Access to API "${prop}" denied for module "${moduleId}".` +
                ` Ensure a policy entry exists for "${moduleId}" granting access to this API.`
            );
          }

          // If the target service is not registered, surface a clear error.
          if (!Object.prototype.hasOwnProperty.call(my, prop)) {
            throw new Error(
              `INTERNAL_ERROR (core): The service (${prop}) does NOT exist. Ensure it has been registered via Sandbox.modules.of() and provided in the Sandbox modules list.`
            );
          }

          // Access the backing 'my' (this may trigger lazy construction).
          return my[prop];
        },
        // Prevent writes through the restricted view
        set: () => {
          throw new Error(
            `POLICY_ERROR: Cannot assign properties on sandbox.my from module "${moduleId}".`
          );
        },
        has: (_, prop) => {
          return (
            allowedSet.has(prop) &&
            Object.prototype.hasOwnProperty.call(my, prop)
          );
        },
        ownKeys: () => {
          // Only list allowed APIs that are registered
          return Object.keys(my).filter((k) => allowedSet.has(k));
        },
        getOwnPropertyDescriptor: (_, prop) => {
          if (
            allowedSet.has(prop) &&
            Object.prototype.hasOwnProperty.call(my, prop)
          ) {
            return {
              enumerable: true,
              configurable: true,
            };
          }
          return undefined;
        },
      }
    );

    // The restricted sandbox view returned to modules
    return {
      core,
      my: restrictedMy,
      addEventListener: this.addEventListener.bind(this),
      dispatchEvent: this.dispatchEvent.bind(this),
    };
  }

  /**
   * Registers a plugin for an existing service
   * @param {Object} PluginDefinition - a class defining a plugin for a specified service
   * @returns {void}
   */
  #plugin(PluginDefinition) {
    const isValid = PluginProvider.validatePlugin(PluginDefinition);

    if (!isValid) {
      return;
    }

    this.#plugins[PluginDefinition.target] = PluginDefinition;
  }

  /**
   * Static modules registry
   */
  static modules = {
    of: function (moduleName, moduleClass) {
      Sandbox.modules[moduleName] = moduleClass;
    },
    autoLoad: async function () {
      const HC_CONFIG = await HCSystemConfigurationProvider.loadConfig();
      const eligibleServices = await HCSystemConfigurationProvider.discoverServices(HC_CONFIG);

      if (!eligibleServices.length) {
        console.warn(`WARNING (core): Could not autoload services. No eligible services found. Ensure the correct service directory is defined in .honeyrc.js and that filenames match the patterns defined in the patterns field.`);
        return;
      }

      await Promise.all(eligibleServices.map(async (path) => {
        const serviceDefinition = await import(path);
        let serviceName; 
        
        if (!serviceDefinition.default.service) {
          serviceName = serviceDefinition.default.name;
          console.info(`INFO (core): Service classes defined **WITHOUT** a static "service" property will be registered with the name of their constructor (${serviceName})`);
        } else {
          serviceName = serviceDefinition.default.service;
        }

        Sandbox.modules.of(serviceName, serviceDefinition.default);
      }));    
    },
  };
}
