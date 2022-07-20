//this is a Node Express server
//bay-secondary-contact-4m6xe.ondigitalocean.app
const express = require('express')
const bodyParser = require('body-parser')
const logger = require('morgan')
const cors = require('cors')
require('dotenv').config();


const { reassociateEngagements, getSecondaryContactId, matchPrimaryEmail } = require('./app.js')
const { auth } = require('./classes/auth.js')
const { Owner } = require('./classes/owner.js')
const { Contact } = require('./classes/contact.js')

const serverUrl = process.env.SERVER_URL

//setup express server
const app = express()

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


router.get('/card-data', async (req, res) => {

  await auth.authoriseRequest(req, '/card-data')

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

router.post('/associateEngagements', (req, res) => {

  let contactId = req.body.object.objectId
  let promise = reassociateEngagements(contactId)
  promise
    .then(response => {
      return res.json('Done')
    })
    .catch((error) => {
      console.log(error)
      return res.json('Oops')
    })

})



router.post('/matchPrimaryEmail', async (req, res) => {

  let contactId = req.body.object.objectId
  let promise = matchPrimaryEmail(contactId)
  promise
    .then(response => {
      return res.json('Done')
    })
    .catch((error) => {
      console.log(error)
      return res.json('Oops')
    })

})

//use server to serve up routes
app.use('/', router)

// launch our backend into a port
const apiPort = 80;
app.listen(apiPort, () => console.log('Listening on port ' + apiPort));