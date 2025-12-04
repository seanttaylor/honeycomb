export class PluginNOOP {
    #logger;
    static target = 'NOOPService';
    static mode = 'pre_ex';
  
    constructor(sandbox) {
      this.#logger = sandbox.core.logger.getLoggerInstance();
      this.#logger.log('What a feeling!');
    }
  
    async hello(receiver, args) {
      //throw new Error('uh oh');
      return [`smelly ${receiver}`, 'yo mama'];
    }
  }
  