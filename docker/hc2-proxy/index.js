import express from 'express';
import http from 'http';
import morgan from 'morgan';
import Nano from 'nano'

import figlet from 'figlet';
import crypo from 'node:crypto';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { HC2ServiceManifest } from './interfaces.js';


/**
 * Houses configuration and routing data for running services; published by the HC2 instance.
 * Each key is a service name. The value is an array of service profiles representing
 * active instances of that service.
 * @type {Object.<string, Array<HC2ServiceManifest>>}
 */
const serviceProfiles = {};


/** 
 * @typedef {Object} CouchDBChangeFeedObject
 * @property {String} seq - a string indicating the sequence of the change in the feed
 * @property {String} id - uuid for the CouchDB document
 * @property {Boolean} [deleted] - indicates whether the change in question is a deletion
 * @property {Object[]} changes - revision metadata about the document from CouchDB
 * @property {Object} doc - the CouchDB document that changed (i.e. a service registration receipt) 
*/

/**
 * Listens for documment updates to the database at {COUCH_DB_NAME}
 * @param {CouchDBChangeFeedObject} changeFeedObj - the change object emitted by CouchDB
 * @returns {void}
 */
function onRegistrationUpdate(changeFeedObj) {
  try {
    console.log(changeFeedObj);

    if (changeFeedObj.deleted) {
      return;
    }

    const { claims: serviceClaims, receipt } = changeFeedObj.doc;
    if (!serviceProfiles[serviceClaims.name]) {
      serviceProfiles[serviceClaims.name] = [];
    }
    
    serviceProfiles[serviceClaims.name].push({ 
      id: crypto.randomUUID(),
      registrationReceiptId: receipt.id,
      createdAt: new Date().toISOString(), 
      ...serviceClaims, 
    });
  } catch (ex) {
    console.error(`INTERNAL_ERROR (HC2.Proxy): **EXCEPTION ENCOUNTERED** during service profile updates. See details -> ${ex.message}`);
  }
};

/**
 * Triggered in the event of an error in the CouchDB watcher
 * @param {Object} error 
 * @returns {void}
 */
function onCouchDBError(error) {
  console.error(`INTERNAL_ERROR (HC2.Proxy): An error occurred while watching the CouchDB instance for changes. See details -> ${error.message}`);
}

(async function HC2ProxyServer() {
  /******** CONTAINER ENVIRONMENT VARIABLES ********/
  const COUCH_DB_NAME = process.env.COUCH_DB_NAME;
  const COUCH_DB_INSTANCE_URL = process.env.COUCH_DB_INSTANCE_URL;
  const COUCH_DB_INSTANCE_USER_NAME = process.env.COUCH_DB_INSTANCE_USER_NAME;
  const COUCH_DB_INSTANCE_USER_PASSWORD = process.env.COUCH_DB_INSTANCE_USER_PASSWORD;
  
  const HC2_INSTANCE_URL = process.env.HC2_INSTANCE_URL;
  const HC2_INSTANCE_ID = process.env.HC2_INSTANCE_ID;
  const SERVICE_INSTANCE_NAME = process.env.SERVICE_INSTANCE_NAME;
  const SERVICE_NAME = process.env.SERVICE_NAME;
  
  const PORT = process.env.PORT || 3000;
  const VERSION = process.env.VERSION;

  try {
    const banner = await figlet.text(`${SERVICE_NAME} v${VERSION}`);
    const n = Nano(COUCH_DB_INSTANCE_URL);
    const db = n.db.use(COUCH_DB_NAME);
    const dbInfo = await db.info();

    const app = express();
    const proxy = createProxyMiddleware({
      target: HC2_INSTANCE_URL,
      changeOrigin: true,
    });

    db.changesReader.start({ includeDocs: true })
    .on('change', onRegistrationUpdate)
    .on('error', onCouchDBError);
    
    app.use(morgan('combined'));

    app.get('/api/v1/profiles', async(req, res, next) => {
      try {
        res.set('X-Count', 1);
        res.set('X-HC2-Resource', 'urn:hcp:hc2:service-profile');
        res.status(200).json(Object.values(serviceProfiles).flat());
      } catch(ex) {
        console.error(`INTERNAL_ERROR (honeycomb.HC2.proxy): **EXCEPTION ENCOUNTERED** while fetching service profiles. See details -> ${ex.message}`);
        next(ex);
      }
    });

    app.get('/health', (req, res) => {
      res.status(200).json({
        name: 'HC2Proxy',
        hc2InstanceId: HC2_INSTANCE_ID,
        timestamp: new Date().toISOString()
      });
    });

    app.use(proxy);

    app.use((err, req, res, next) => {
      const status = err.status || 500;
      console.error(err);
      res.status(status).send({ status, error: 'There was an error.' });
    });

    http.createServer(app).listen(PORT, async () => {
      console.log(banner);
      console.log(`HC2Proxy serving instance (${HC2_INSTANCE_ID}) listening on port ${PORT} as alias (${SERVICE_INSTANCE_NAME})`);
      console.log(`HC2Proxy connected to HC2 instance datastore (${dbInfo.db_name}) at ${ new Date().toISOString() }`);
      // TODO: Service has rebuild store of profiles on start
    });
              
  } catch(ex) {
    console.error(`INTERNAL_ERROR (HC2.Proxy): **EXCEPTION ENCOUNTERED** while running the HC2 service proxy (${SERVICE_INSTANCE_NAME}). See details -> ${ex.message}` );
  }
}());