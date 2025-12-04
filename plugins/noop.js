export class PluginNOOP {
    #logger;
    static target = 'NOOPService';
    static mode = 'pre_ex';
  
    constructor(sandbox) {
      this.#logger = sandbox.core.logger.getLoggerInstance();
      // plugin has access to sandboxed services
      this.#logger.log('What a feeling!');
    }
    
    /**
     * @param {String} receiver 
     * @returns String[]
     */
    hello(receiver) {
      //throw new Error('uh oh');
      return [`smelly ${receiver}`, 'yo mama'];
    }
  }
  