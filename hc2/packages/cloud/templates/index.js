export class JSONSchemaTemplate {
    #schema;
  
    constructor() {
      this.#schema = {
        type: 'object',
        properties: {},
        required: [],
        additionalProperties: false,
      };
    }
  
    get schema() {
      return this.#schema;
    }
    /**
     * @param {String} name
     * @param {Object} definition - JSON Schema property definition
     * @param {Object} options
     * @param {Object} options.required
     */
    addProperty(name, definition, { required = true } = {}) {
      this.#schema.properties[name] = definition;
      if (required) {
        this.#schema.required.push(name);
      }
      return this;
    }
  
    /**
     * @param {String} name
     * @param {Any} value
     */
    addConstant(name, value) {
      this.#schema.properties[name] = { const: value };
      this.#schema.required.push(name);
      return this;
    }
  }

  export class ServiceCertificateTemplate extends JSONSchemaTemplate {
    /**
     *
     */
    constructor(cert) {
      super();
      try {
        const certBody = cert.payload;
        // Required constant matches
        this.addConstant('service', certBody.service);
        this.addConstant('app', certBody.app);
        this.addConstant('version', certBody.version);
        this.addConstant('api', certBody.api);
  
        this.addConstant('callbackURL', certBody.callbackURL);
      } catch (ex) {
        console.error(
          `INTERNAL_ERROR (honeycomb.HC2) **EXCEPTION ENCOUNTERED** while creating service certificate claims template. See details -> ${ex.message}`
        );
      }
    }
  }


  