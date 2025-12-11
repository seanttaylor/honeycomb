class ApplicationService {
  constructor() {}

  get status() {
    return {
      name: this.constructor.name,
      timestamp: new Date().toISOString(),
    };
  }
  
}

/**
 * This service is just used as a sanity check to ensure
 * the module system is working
 */
export class NOOPService extends ApplicationService {
    #logger;
    #sandbox;
    #HC2_PROXY;
  
    /**
     * @param {Object} hc2Proxy
     */
    constructor(hc2Proxy) {
      super();
  
      //this.#sandbox = sandbox;
      //this.#logger = sandbox.core.logger.getLoggerInstance();
  
      try {
        this.#HC2_PROXY = hc2Proxy;
      } catch (ex) {
        console.error(
          `INTERNAL_ERROR (NOOPService): Exception encountered while starting the service. See details -> ${ex.message}`
        );
      }
    }
    
    /**
     * @param {Object} options
     * @param {String} options.receiver
     * @param {String} options.sender
     * @returns {String}
     */
    async hello({ receiver, sender }) {
      return `[${this.constructor.name}] has a message for ${receiver} from: ${
        sender ? sender : 'Someone special'
      }`;
    }
}