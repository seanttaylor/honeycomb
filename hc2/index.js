import Ajv from 'ajv';
import {
  ArrayBufferUtils,
  JSONSchemaTemplate,
  generateNonce,
  sha256,
} from '../utils.js';

import RandomNameGenerator from '@atomiclotus/random-name-generator';

const sleep = async (timeout) => {
  const p = new Promise((resolve) => {
    setTimeout(() => {
      resolve();
    }, timeout);
  });
  return p;
};

const ServiceCertificateTemplate = class extends JSONSchemaTemplate {
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
};

/**
 * @typedef {Object} HC2ProxyRegistration
 * @property {String} app - the high-level application this service is part of
 * @property {String} serviceName - the service name peer application services will use to access this service's APIs
 * @property {Number} version - the version number of the service
 * @property {Object} api the public API of the service
 * @property {Object[]} api.methods - List of methods defined on the service
 * @property {String} api.methods[].name - Method name
 * @property {Object} api.methods[].params - key/value pairs, maybe even a JSON Schema?
 * @property {String} callbackURL - URL the application service can be contacted for RPC calls
 * @property {String} HC2ServiceCertificate - the certificate signed by the HC2 instance the proxy will connect to
 */

export class HC2Proxy {
  #HC2_INSTANCE_URL;

  /**
   * @param {String} HC2_URL - URL of the HC2 instance the proxy will communicate with
   */
  constructor(HC2_URL) {
    this.#HC2_INSTANCE_URL = HC2_URL;
  }

  /**
   * Registers a Honeycomb application service with the HC2 instance specified in the constructor
   * @param {Object} reg
   * @param {HC2ProxyRegistration} reg.payload - the registration details of the service
   * @param {String} reg.signature - signature of the service requesting registration
   * @param {HC2Instance} instance - the HC2 instance targeted by the registration request
   * @returns {Object} - the registration receipt
   */
  async register(reg, instance) {
    try {
      const certificateResponse = await instance.verifyHC2ServiceCertificate(
        reg
      );
      if (!certificateResponse.isVerified) {
        console.error(
          `INTERNAL_ERROR (honeycomb.HC2): Cannot complete registration for service (${reg.payload.service}). The HC2 service certificate could not be verified. See docs.`
        );
        return;
      }

      const validationReponse = instance.validateCertificateClaims(reg);

      if (!validationReponse.isValid) {
        console.error(
          `INTERNAL_ERROR (honeycomb.HC2): Cannot complete registration for service (${reg.payload.service}). The HC2 service certificate claims could not be validated. See docs.`
        );
        return;
      }

      const registrationReceipt = {
        app: reg.payload.app,
        createdAt: new Date().toISOString(),
        expiresAt: new Date().getTime() + 604800000,
        hc2InstanceId:
          reg.payload.HC2ServiceCertificate.payload.metadata.hc2InstanceId,
        hc2ServiceCertificateHash: await sha256(
          JSON.stringify(reg.payload.HC2ServiceCertificate)
        ),
        nonce: generateNonce(),
        callbackURL: reg.payload.callbackURL,
        serviceId: crypto.randomUUID(),
        serviceName: reg.payload.service,
        serviceShortName: RandomNameGenerator.get(1).replaceAll(' ', '-'),
      };

      // TODO: Create service registration record

      return registrationReceipt;
    } catch (ex) {
      console.error(
        `INTERNAL_ERROR (honeycomb.HC2): **EXCEPTION ENCOUNTERED** during service registration with HC2 instance (${
          this.#HC2_INSTANCE_URL
        }). See details -> ${ex.message}`
      );
    }
  }
}

export class HC2Instance {
  #INSTANCE_ID = crypto.randomUUID();
  #PUBLIC_KEY;
  #PRIVATE_KEY;

  constructor() {
    this.#generateKeyPair()
      .then(({ publicKey, privateKey }) => {
        this.#PRIVATE_KEY = privateKey;
        this.#PUBLIC_KEY = publicKey;
      })
      .catch((ex) => {
        console.error(
          `INTERNAL_ERROR (honeycomb.HC2): Could not generate key pair. See details -> ${ex.message}`
        );
      });
  }

  /**
   * On a registration request from an application service, ensures the service certificate presented by the requesting service has been signed by the HC2 instance using the instance's PUBLIC_KEY
   * @param {Object} reg
   * @param {Object} reg.payload - the body of the registration reqeuest
   * @param {Object} reg.payload.HC2ServiceCertificate - the certificate issued by the HC2 instance
   * @param {Object} reg.signature - signature of the requesting service
   * @returns {Object}
   */
  async verifyHC2ServiceCertificate(reg) {
    const cert = reg.payload.HC2ServiceCertificate;
    const { payload: body, signature } = cert;

    //TODO: check expiry on body.metadata.expiresAt

    try {
      const encoder = new TextEncoder();
      const data = encoder.encode(JSON.stringify(body));
      const isVerified = await crypto.subtle.verify(
        { name: 'RSA-PSS', saltLength: 32 },
        this.#PUBLIC_KEY,
        ArrayBufferUtils.fromBase64(signature),
        data
      );

      return { isVerified };
    } catch (ex) {
      console.error(
        `INTERNAL_ERROR (honeycomb.HC2): **EXCEPTION ENCOUNTERED** during certificate verification for service (${
          body.service
        }) on HC2 instance (${this.#INSTANCE_ID}). See details -> ${ex.message}`
      );
    }
  }

  /**
   * Checks the claims specified on the HC2ServiceCertificate match the fields in
   * the registration request. This ensures only services with the characteristics
   * attested to in the service certificate can successfully register
   * @param {Object} reg
   * @param {Object} reg.payload - the body of the registration reqeuest
   * @param {Object} reg.payload.HC2ServiceCertificate - the certificate issued by the HC2 instance
   * @param {Object} reg.signature - signature of the requesting service
   * @returns {Object}
   */
  validateCertificateClaims(reg) {
    const { HC2ServiceCertificate: cert, ...request } = reg.payload;
    const certTemplate = new ServiceCertificateTemplate(cert);
    const ajv = new Ajv();
    const isValid = ajv.validate(certTemplate.schema, request);

    if (!isValid) {
      console.error(
        `INTERNAL_ERROR (honeycomb.HC2): Service registration failed for service (${
          request.service
        }). Could not validate HC2 service certificate claims. See details -> ${JSON.stringify(
          ajv.errors
        )}`
      );
      return { isValid: false };
    }

    return { isValid };
  }

  /**
   * @return {Object}
   */
  async #generateKeyPair() {
    try {
      return await crypto.subtle.generateKey(
        {
          name: 'RSA-PSS',
          modulusLength: 2048,
          publicExponent: new Uint8Array([1, 0, 1]),
          hash: 'SHA-256',
        },
        true, // extractable
        ['sign', 'verify']
      );
    } catch (ex) {
      console.error(
        `INTERNAL_ERROR (honeycomb.HC2): Could not generate instance key pair. See details -> ${ex.message}`
      );
    }
  }

  /**
   * @param {Object} certificateRequest
   */
  async generateServiceCert(certificateRequest) {
    await sleep(1000);

    const cert = {
      ...certificateRequest,
      metadata: {
        deploymentId: crypto.randomUUID(),
        hc2InstanceId: this.#INSTANCE_ID,
        issuedAt: new Date().getTime(),
        //EXPIRES IN ONE WEEK
        expiresAt: new Date().getTime() + 604800000,
      },
    };
    const encoder = new TextEncoder();
    const data = encoder.encode(JSON.stringify(cert));
    const signature = await crypto.subtle.sign(
      {
        name: 'RSA-PSS',
        saltLength: 32,
      },
      this.#PRIVATE_KEY,
      data
    );
    return {
      payload: cert,
      signature: ArrayBufferUtils.toBase64(signature),
    };
  }
}
