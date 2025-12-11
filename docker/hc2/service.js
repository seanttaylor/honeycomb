
import Ajv from 'ajv';
import { HC2Utilities } from '@honeycomb/cloud';

/**
 * 
 */
export class HC2Instance {
    #PUBLIC_KEY;
    #PRIVATE_KEY;
    #INSTANCE_ID;
    #serviceRegistry = new Map();
    #services = new Set();
    #routeTable = new Map();

    constructor({ publicKey, privateKey, instanceId }) {
        this.#PUBLIC_KEY = publicKey;
        this.#PRIVATE_KEY = privateKey;
        this.#INSTANCE_ID = instanceId;
    }

    get serviceRegistry() {
        return this.#serviceRegistry;
    }

    get routeTable() {
        return this.#routeTable;
    }

    get services() {
        return Object.assign(this.#services, {});
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
            }) on HC2 instance (${this.#INSTANCE_ID}). See details -> ${ex.message}`
            );
        }
    }

    /**
     * @param {Object} reg
     * @param {HC2ServiceRegistration} reg.payload - the registration details of the service
     * @param {String} reg.signature - signature of the service requesting registration
     * @returns {Object}
     */
    async registerService(reg) {
        try {
            const { app, callbackURL, service: serviceName } = reg.payload;
            const serviceId = crypto.randomUUID();
            const routeTableEntry = {
                callbackURL,
                methods: reg.payload.api.methods,
            };

            const serviceRegistrationReceipt = {
                app,
                callbackURL,
                serviceId,
                serviceName,
                createdAt: new Date().toISOString(),
                expiresAt: new Date().getTime() + 604800000,
                hc2InstanceId:
                    reg.payload.HC2ServiceCertificate.payload.metadata.hc2InstanceId,
                hc2InstancePublicKey: this.#PUBLIC_KEY,
                hc2ServiceCertificateHash: await sha256(
                    JSON.stringify(reg.payload.HC2ServiceCertificate)
                ),
                nonce: generateNonce(),
                serviceShortName: RandomNameGenerator.get(1).replaceAll(' ', '-'),
            };

            this.#serviceRegistry.set(serviceId, serviceRegistrationReceipt);
            this.#services.add(serviceName);
            this.#routeTable.set(serviceName, routeTableEntry);

            return serviceRegistrationReceipt;
        } catch (ex) {
            console.error(
            `INTERNAL_ERROR (honeycomb.HC2): Service registration failure. Could not generate registration receipt for service (${reg.payload.service}) `
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
     * @param {Object} certificateRequest
     */
    async generateServiceCert(certificateRequest) {
        await sleep(1000);

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
            signature: HC2Utilities.ArrayBuffer.toBase64(signature),
        };
    }
}