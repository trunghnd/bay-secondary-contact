//this is a Node Express server
//bay-secondary-contact-4m6xe.ondigitalocean.app
const express = require('express')
const Sentry = require('@sentry/node');
const Tracing = require("@sentry/tracing");
const bodyParser = require('body-parser')
const logger = require('morgan')
const cors = require('cors')
require('dotenv').config();


const { reassociateEngagements, getSecondaryContactId, matchPrimaryEmail, processOwnershipRequest } = require('./app.js')
const { auth } = require('./classes/auth.js')
const { Owner } = require('./classes/owner.js')
const { Contact } = require('./classes/contact.js')
const { AOF } = require('./classes/aof.js')


const serverUrl = process.env.SERVER_URL

//setup express server
const app = express()

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  integrations: [
    // enable HTTP calls tracing
    new Sentry.Integrations.Http({ tracing: true }),
    // enable Express.js middleware tracing
    new Tracing.Integrations.Express({ app }),
  ],

  // Set tracesSampleRate to 1.0 to capture 100%
  // of transactions for performance monitoring.
  // We recommend adjusting this value in production
  tracesSampleRate: 1.0,
});

// RequestHandler creates a separate execution context using domains, so that every
// transaction/span/breadcrumb is attached to its own Hub instance
app.use(Sentry.Handlers.requestHandler());
// TracingHandler creates a trace for every incoming request
app.use(Sentry.Handlers.tracingHandler());

app.use(cors())
app.use(bodyParser.json()) // for parsing application/json
app.use(bodyParser.urlencoded({ extended: true })) // for parsing application/x-www-form-urlencoded
app.use(logger('dev'))
app.set("view engine", "ejs");

//setup routes
var router = express.Router()

router.get('/testing', (req, res) => {

  res.send('<h1>Testing is working</h1>')

})

// router.get('/testingObjects', async (req, res) => {
//   // let contact = new Contact()
//   // await contact.load(1851)
//   // await contact.addOwner("163230989")
//   // console.log(contact)
//   // res.json(contact.data)

//   let owner = new Owner()
//   await owner.loadByEmail('trung.ly@hypeanddexter.nz')
//   console.log(owner)
//   res.json(owner)

// })

router.get('/card-view1', async (req, res) => {
  let query = req.query
  let owner = new Owner()
  await owner.loadByUserId(query.userid)
  let privateContactId = await owner.getPrivateContact(query.contactid)
  if (!privateContactId) {
    res.render("view1", {
      firstname: query.firstname,
      lastname: query.lastname,
      email: query.email,
      contactid: query.contactid,
      ownerid: owner.data.id,
      portalid: query.portalid,
      serverUrl: serverUrl
    })

  } else {
    res.render("view2", {
      contactid: privateContactId,
      portalid: query.portalid,
      message: `Private view of contact (${query.firstname} ${query.lastname}) already exists`
    })
  }



})

router.get('/make-secondary-contact', (req, res) => {
  let query = req.query
  getSecondaryContactId(query.contactid, query.ownerid)
    .then(id => {
      res.render("view2", {
        contactid: id,
        portalid: query.portalid,
        message: 'Private view of contact is successfully created'
      })
    })
    .catch((error) => {
      console.log(error)
      return res.send('Oops')
    })
})


router.get('/card-data', auth.checkHubspotSignature, async (req, res) => {
  // await auth.authoriseRequest(req, '/card-data')

  let query = req.query
  let contact = new Contact()
  await contact.load(query.hs_object_id)
  let data = {}
  if (contact.data.agent_private_contact != 'true') {
    let owner = new Owner()
    await owner.loadByUserId(query.userId)
    let privateContactId = await owner.getPrivateContact(query.hs_object_id)
    if (!privateContactId) {
      if (query.email) {
        data = {
          "primaryAction": {
            "type": "IFRAME",
            "width": 600,
            "height": 400,
            "uri": `${serverUrl}/card-view1?userid=${query.userId}&contactid=${query.hs_object_id}&firstname=${encodeURIComponent(query.firstname)}&lastname=${encodeURIComponent(query.lastname)}&email=${encodeURIComponent(query.email)}&portalid=${query.portalId}`,
            "label": "Create private view"
          }
        }
      } else {
        data = {
          "results": [
            {
              "objectId": 245,
              "title": "Private views are not available"
            }
          ]
        }
      }
    } else {
      data = {
        "results": [
          {
            "objectId": 245,
            "title": query.firstname + ' ' + (query.lastname),
            "link": `https://app.hubspot.com/contacts/${query.portalId}/contact/${privateContactId}`,
          }
        ]
      }
    }

  } else {
    data = {
      "results": [
        {
          "objectId": 245,
          "title": `Public contact: ${contact.data.firstname} ${contact.data.lastname}`,
          "link": `https://app.hubspot.com/contacts/${query.portalId}/contact/${contact.data.primary_contact_id}`,
        }
      ]
    }
  }
  res.json(data)
})

router.get('/login', async (req, res) => {

  let code = req.query.code

  let cred = auth.login(code)
  // let bla = await auth.getAccessToken()
  res.json(cred)

})

//get list of companies from Hubspot with relevant properties

router.post('/associateEngagements', auth.checkHubspotSignature, async (req, res) => {

  let contactId = req.body.object.objectId
  await reassociateEngagements(contactId)
  res.json('Done')
})

router.post('/matchPrimaryEmail', auth.checkHubspotSignature, async (req, res) => {

  let contactId = req.body.object.objectId
  await matchPrimaryEmail(contactId)
  res.json('Done')

})

router.post('/requestOwnership', auth.checkHubspotSignature, async (req, res) => {

  let contactId = req.body.object.objectId
  await processOwnershipRequest(contactId)
  res.json('Done')

})

router.post('/addContactSubscription',auth.checkHubspotSignature, async (req, res) => {

  let contactId = req.body.object.objectId
  let contact = new Contact()
  await contact.load(contactId)
  await contact.updateSubscription()

  res.send('Done')

})
//use server to serve up routes
app.use('/', router)

// The error handler must be before any other error middleware and after all controllers
app.use(Sentry.Handlers.errorHandler());

// Optional fallthrough error handler
app.use(function onError(err, req, res, next) {
  // The error id is attached to `res.sentry` to be returned
  // and optionally displayed to the user for support.
  res.statusCode = 500;
  res.end(res.sentry + "\n");
});

// launch our backend into a port
const apiPort = 80;
app.listen(apiPort, () => console.log('Listening on port ' + apiPort));