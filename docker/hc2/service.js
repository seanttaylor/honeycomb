
import Ajv from 'ajv';
import crypto from 'node:crypto';
import randomPetName from 'node-petname';
import { HC2Utilities } from '@honeycomb/cloud';
import { ServiceCertificateTemplate } from './utils.js';

const { sha256, generateNonce } = HC2Utilities;

/**
 * @typedef {Object} HC2ServiceRegistration
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

/**
 * 
 */
export class HC2Instance {
  #PUBLIC_KEY;
  // Public key in PEM format for serialization 
  #PUBLIC_KEY_PEM;
  #PRIVATE_KEY;
  #INSTANCE_ID;
  #serviceRegistry = new Map();
  #services = new Set();

  /**
   * @param {Object} options
   * @param {CryptoKey} options.publicKey
   * @param {CryptoKey} options.privateKey
   * @param {String} options.instanceId 
   */
  constructor({ publicKey, privateKey, instanceId }) {
    this.#PUBLIC_KEY = publicKey;
    this.#PRIVATE_KEY = privateKey;
    this.#INSTANCE_ID = instanceId;
  }

  get serviceRegistry() {
    return this.#serviceRegistry;
  }

  /**
   * @param {Object} certificateRequest
   */
  async generateServiceCert(certificateRequest) {

    const cert = {
      ...certificateRequest,
      metadata: {
        deploymentId: crypto.randomUUID(),
        certificateId: crypto.randomUUID(),
        hc2InstanceId: this.#INSTANCE_ID,
        issuedAt: new Date().getTime(),
        //EXPIRES IN ONE WEEK
        expiresAt: new Date().getTime() + 604800000,
      },
    };

    const encoder = new TextEncoder();
    const data = encoder.encode(JSON.stringify(cert));
    const signature = await crypto.subtle.sign({
        name: 'RSA-PSS',
        saltLength: 32,
      },
      this.#PRIVATE_KEY,
      data
    );

    return {
      payload: cert,
      signature: HC2Utilities.ArrayBuffer.toBase64(signature),
    };
  }

  /**
   * On a registration request from an application service, ensures the service certificate presented by the requesting service has been signed by the HC2 instance using the instance's PUBLIC_KEY
   * @param {Object} cert
   * @param {Object} cert.payload - the body of the registration reqeuest
   * @param {Object} cert.signature - signature of the requesting service
   * @returns {Object}
   */
  async verifyHC2ServiceCertificate(cert) {
    const { payload: body, signature } = cert;

    //TODO: check expiry on body.metadata.expiresAt

    try {
      const encoder = new TextEncoder();
      const data = encoder.encode(JSON.stringify(body));
      const isVerified = await crypto.subtle.verify({ 
        name: 'RSA-PSS',
        saltLength: 32
      },
      this.#PUBLIC_KEY,
      HC2Utilities.ArrayBuffer.fromBase64(signature),
      data
      );

      return { isVerified };
    } catch (ex) {
      console.error(
      `INTERNAL_ERROR (honeycomb.HC2): **EXCEPTION ENCOUNTERED** during certificate verification for service (${
          body.service
      }) on HC2 instance (${this.#INSTANCE_ID}). See details -> ${ex.message}`);
    }
  }

  /**
   * Takes a registration request object
   * Checks the claims specified on the HC2ServiceCertificate match the fields in the registration request. This ensures only services with the characteristics
   * attested to in the service certificate can successfully register
   * @param {Object} reg
   * @param {Object} reg.payload - the body of the registration request
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
            request.service.name
        }). Could not validate HC2 service certificate claims. See details -> ${JSON.stringify(
            ajv.errors
        )}`
        );
        return { isValid: false };
    }

    return { isValid };
  }

  /**
   * @param {Object} reg
   * @param {HC2ServiceRegistration} reg.payload - the registration details of the service
   * @param {String} reg.signature - signature of the service requesting registration
   * @returns {Object}
   */
  async registerService(reg) {
    try {
      const { app, service } = reg.payload;
      const serviceId = crypto.randomUUID();
      const serviceName = service.name;
      const routeTableEntry = {
        callbackURL: service.network.rpcEndpoint,
        methods: service.api.methods,
      };

      const hc2InstancePublicKey = this.#PUBLIC_KEY_PEM ? this.#PUBLIC_KEY_PEM : await crypto.subtle.exportKey('spki', this.#PUBLIC_KEY);

      const receiptId = crypto.randomUUID();
      const serviceRegistrationReceipt = {
        app,
        serviceId,
        serviceName,
        alias: randomPetName(2, '-'),
        callbackURL: service.network.rpcEndpoint,
        createdAt: new Date().toISOString(),
        expiresAt: new Date().getTime() + 604800000,
        hc2InstanceId:
        reg.payload.HC2ServiceCertificate.payload.metadata.hc2InstanceId,
        hc2InstancePublicKey: btoa(HC2Utilities.ArrayBuffer.toString(hc2InstancePublicKey)),
        hc2ServiceCertificateHash: await sha256(
          JSON.stringify(reg.payload.HC2ServiceCertificate)
        ),
        id: crypto.randomUUID(),
        nonce: generateNonce(),
        urn: `urn:hcp:hc2:service-registration-receipt:${receiptId}`
      };
     
      this.#serviceRegistry.set(serviceRegistrationReceipt.id, serviceRegistrationReceipt);
      this.#services.add(serviceName);

      return serviceRegistrationReceipt;
    } catch (ex) {
      console.error(
      `INTERNAL_ERROR (honeycomb.HC2): Service registration failure. Could not generate registration receipt for service (${reg.payload.service.name}). See details -> ${ex.message}`
      );
    }
  }

  /**
   * @returns Object[]
   */
  async getServices() {
    return Array.from(this.serviceRegistry.values());
  }
}