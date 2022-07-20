const axios = require('axios')
const { auth } = require('./classes/auth.js')
const { Contact } = require('./classes/contact.js')
const _ = require("lodash")
const e = require('express')
const { Owner } = require('./classes/owner.js')
const base = 'https://api.hubapi.com'

const delay = time => new Promise(res => setTimeout(res, time))

//get engagements for a contact
async function getEngagements(type, contactId) {
  let config = await auth.getConfig()
  //type: email, note, etc (singular form)
  let urlEngagementIDs = base + '/crm/v3/associations/contact/' + type + '/batch/read'
  let data = {
    "inputs": [
      {
        "id": contactId
      }
    ]
  }

  let res = await axios.post(urlEngagementIDs, data, config)

  let detailedEngagements = []

  if (res.data.results.length > 0) {
    let engagements = res.data.results[0].to
    for (let i = 0; i < engagements.length; i++) {
      let engagement = engagements[i]
      let urlEngagmentDetail = base + '/crm/v3/objects/' + type + 's/' + engagement.id + '?properties=hubspot_owner_id'
      let resEngagementDetail = await axios.get(urlEngagmentDetail, config)

      if (resEngagementDetail.data.properties.hubspot_owner_id !== null) {
        detailedEngagements.push({
          id: resEngagementDetail.data.id,
          hubspot_owner_id: resEngagementDetail.data.properties.hubspot_owner_id,
          type: type
        })
      }

    }
  }

  return detailedEngagements;
}

//get MyAgentContact for a specific owner, create one if not found
async function getSecondaryContactId(contactId, ownerId) {
  let config = await auth.getConfig()

  let secondaryContactId
  let urlSsearch = base + '/crm/v3/objects/contacts/search'
  let data = {
    "filterGroups": [
      {
        "filters": [
          {
            "propertyName": "hubspot_owner_id",
            "operator": "EQ",
            "value": ownerId
          },
          {
            "propertyName": "primary_contact_id",
            "operator": "EQ",
            "value": contactId
          }
        ]
      }
    ]
  }
  let resSearch = await axios.post(urlSsearch, data, config)
  if (resSearch.data.total == 0) { //create new secondary Contact for owner when not found

    //get contact data
    const properties = ['email', 'phone', 'firstname', 'lastname']
    const urlContact = base + '/crm/v3/objects/contacts/' + contactId + '?properties=' + properties.join(',')
    let resContact = await axios.get(urlContact, config)
    let contactProperties = resContact.data.properties

    let urlSecondaryContact = base + '/crm/v3/objects/contacts'
    let dataSecondaryContact = {
      properties: {
        primary_email: contactProperties.email,
        firstname: contactProperties.firstname,
        lastname: contactProperties.lastname,
        phone: contactProperties.phone,
        hubspot_owner_id: ownerId,
        primary_contact_id: contactId,
        agent_private_contact: 'true'

      }
    }
    let resCreateSecondaryContact = await axios.post(urlSecondaryContact, dataSecondaryContact, config)
    secondaryContactId = resCreateSecondaryContact.data.id
    //await delay(10000) //wait 10 sec for hs to fully update

    // //associate MyAgentContact to Contact
    // let urlCreateAssociation = base + '/crm/v3/objects/'+myAgentContact+'/'+myAgentContactId+'/associations/contact/'+contactId+'/my_agent_contact_to_contact'
    // await axios.put(urlCreateAssociation,[],config)

  } else {
    secondaryContactId = resSearch.data.results[0].id
  }

  return secondaryContactId
}

async function updateAssociation(type, engagementId, contactId, secondaryContactId) { //type: emails (plural form)
  let config = await auth.getConfig()

  //make new association
  let asso_type = type == 'meeting' ? 'meeting_event' : type //contact_to_meeting_event
  let urlCreateAssociation = base + '/crm/v3/objects/' + type + 's/' + engagementId + '/associations/contact/' + secondaryContactId + '/' + asso_type + '_to_contact'
  await axios.put(urlCreateAssociation, [], config)

  //delete existing association
  let urlDeleteAssociation = base + '/crm/v3/objects/' + type + 's/' + engagementId + '/associations/contact/' + contactId + '/contact_to_' + type
  await axios.delete(urlDeleteAssociation, config)
}

async function removeNonOwnerEngagements(type, engagementId, ownerId) { //type: emails (plural form)
  let config = await auth.getConfig()
  let urlDeals = base + '/crm/v3/objects/' + type + '/' + engagementId + '/associations/deals'
  let resDeals = await axios.get(urlDeals, config)

  if (resDeals.data.results.length > 0) {
    let deals = resDeals.data.results
    for (let i = 0; i < deals.length; i++) {
      let deal = deals[i]
      let urlDealDetail = base + '/crm/v3/objects/deals/' + deal.id + '?properties=hubspot_owner_id'
      let resDealDetail = await axios.get(urlDealDetail, config)

      // console.log(resDealDetail.data)

      if (resDealDetail.data.properties.hubspot_owner_id !== ownerId) {
        //delele engagement association when deal owner is not the same a engagment owner

        //delete existing association
        let urlDeleteAssociation = base + '/crm/v3/objects/' + type + 's/' + engagementId + '/associations/deal/' + deal.id + '/deal_to_' + type
        await axios.delete(urlDeleteAssociation, config)
      }

    }
  }

}

async function reassociateEngagements(contactId) {

  let contact = new Contact()
  await contact.load(contactId)
  if (contact.data.agent_private_contact != 'false') {
    return false
  }

  let types = ['note', 'email', 'call', 'task', 'meeting']

  let allEngagements = []
  for (let i = 0; i < types.length; i++) {
    let type = types[i]
    let engagements = await getEngagements(type, contactId)
    allEngagements = allEngagements.concat(engagements)
  }

  let engagementsGrouped = _.groupBy(allEngagements, ({ hubspot_owner_id }) => hubspot_owner_id)
  for (const key in engagementsGrouped) {

    let ownerId = key
    let engagements = engagementsGrouped[key]

    let secondaryContactId = await getSecondaryContactId(contactId, ownerId)
    for (let i = 0; i < engagements.length; i++) {
      //delete engagements on deals not belonging to the same engagement owner
      await removeNonOwnerEngagements(engagements[i].type, engagements[i].id, ownerId)

      //reassociation to my agent contact
      await updateAssociation(engagements[i].type, engagements[i].id, contactId, secondaryContactId)

    }
  }
}

async function matchPrimaryEmail(contactId) {

  let contact = new Contact()
  await contact.load(contactId)

  if (!contact.data.primary_contact_id) {

    let originalContact = await Contact.search('email', contact.data.primary_email)

    if (originalContact == false) {
      //original contact not found, create contact
      originalContact = new Contact()
      originalContact.data.email = contact.data.primary_email
      originalContact.data.firstname = contact.data.firstname
      originalContact.data.lastname = contact.data.lastname
      originalContact.data.agent_private_contact = 'false'
      await originalContact.save() //create
    }
    //update
    await originalContact.addOwner(contact.data.hubspot_owner_id)

    //update
    contact.data.agent_private_contact = 'true'
    contact.data.primary_contact_id = originalContact.data.hs_object_id
    await contact.save()

    //find and merge exising privat contacts with same owner
    let filters = [
      {
        "propertyName": 'primary_contact_id',
        "operator": 'EQ',
        "value": contact.data.primary_contact_id
      },
      {
        "propertyName": 'hubspot_owner_id',
        "operator": 'EQ',
        "value": contact.data.hubspot_owner_id
      },
      {
        "propertyName": 'hs_object_id',
        "operator": 'NEQ',
        "value": contact.data.hs_object_id
      }
    ]
    let otherPrivateContact = await Contact.searchComplex(filters)
    if (otherPrivateContact != false) {
      console.log('merge contact')
      contact.merge(otherPrivateContact.data.hs_object_id)
    }

  }

  // console.log(originalContact)
}

async function processOwnershipRequest(contactId) {

  let contact = new Contact()
  await contact.load(contactId)

  let owner = new Owner()
  let canLoad = await owner.loadByEmail(contact.data.ownership_requested_by)
  if(canLoad){
    await contact.addOwner(owner.data.id)
    contact.data.ownership_requested_by = ''
    await contact.save()
  }


}

exports.reassociateEngagements = reassociateEngagements
exports.getSecondaryContactId = getSecondaryContactId
exports.matchPrimaryEmail = matchPrimaryEmail
exports.processOwnershipRequest = processOwnershipRequest
//KPak to do: set up work flow to remove primary_email if email is known
//Kpak to do: modify work flow when adding contact with primary_email and no email
//tell Kpak about owner_id