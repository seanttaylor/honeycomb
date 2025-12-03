export class ApplicationService {
    constructor() {}
  
    get status() {
      return {
        name: this.constructor.name,
        timestamp: new Date().toISOString(),
      };
    }
  }
  