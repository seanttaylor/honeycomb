class ApplicationService {
    constructor() {}
  
    get status() {
      return {
        name: this.constructor.name,
        timestamp: new Date().toISOString(),
      };
    }
  
}

export class FeedService extends ApplicationService {
  #logger;
  #sandbox;

  /**
   * @param {ISandbox} sandbox
   */
  constructor(sandbox) {
    super();
    // this.#sandbox = sandbox;
    // this.#logger = sandbox.core.logger.getLoggerInstance();
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
